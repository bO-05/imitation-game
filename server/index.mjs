/**
 * The Imitation Gate — Cloud Run backend.
 *
 * Two jobs, both designed so the GEMINI key is NEVER exposed and the bill is
 * bounded:
 *   1. POST /api/voice       — proxy to Gemini. The key lives only here (env /
 *                              Secret Manager). The client sends a small
 *                              STRUCTURED payload; the server builds the strict
 *                              prompt, so this can't be abused as a general LLM.
 *   2. POST /api/score       — submit a run score (server-validated, capped).
 *      GET  /api/leaderboard — top scores from Firestore.
 *
 * Safety controls:
 *   - CORS allowlist (ALLOWED_ORIGINS).
 *   - Per-IP token bucket + per-instance global daily cap on /api/voice
 *     (DAILY_VOICE_CAP). Over cap → 429 → client falls back to the offline
 *     "dossier" voice. The game never breaks.
 *   - 8 KB body limit, output schema enforced, no logging of the key or prompts.
 *   - Firestore via the Cloud Run service account (ADC) — no extra key.
 *
 * Keep the Gemini key on the FREE tier and a bill is impossible (worst case is
 * rate-limiting). See DEPLOY-BACKEND.md.
 */
import express from "express";
import { Firestore } from "@google-cloud/firestore";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
// Flagship by default (you have credit + want best). Override with GEMINI_MODEL —
// e.g. "gemini-3.1-flash" for ~3x faster, far cheaper voicing. Verify the exact id
// in Google AI Studio's model picker. A wrong id just disables voicing (graceful
// fallback to the offline dossier voice), it never crashes the game.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro";
const ALLOWED = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
const DAILY_VOICE_CAP = parseInt(process.env.DAILY_VOICE_CAP || "2000", 10);
const PER_IP_PER_MIN = parseInt(process.env.PER_IP_PER_MIN || "20", 10);

const db = new Firestore(); // ADC; lazily used so /voice works even without Firestore
const app = express();
app.use(express.json({ limit: "8kb" }));
app.disable("x-powered-by");

/* ── CORS ── */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const ok = ALLOWED.includes("*") || (origin && ALLOWED.includes(origin));
  if (ok) res.set("Access-Control-Allow-Origin", ALLOWED.includes("*") ? "*" : origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

/* ── rate limiting ── */
const buckets = new Map(); // ip -> { tokens, ts }
function allowIp(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: PER_IP_PER_MIN, ts: now };
  const refill = ((now - b.ts) / 60000) * PER_IP_PER_MIN;
  b.tokens = Math.min(PER_IP_PER_MIN, b.tokens + refill);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(ip, b); return false; }
  b.tokens -= 1; buckets.set(ip, b);
  return true;
}
let voiceDay = utcDay();
let voiceCount = 0;
function utcDay() { return new Date().toISOString().slice(0, 10); }
function underGlobalCap() {
  const d = utcDay();
  if (d !== voiceDay) { voiceDay = d; voiceCount = 0; }
  if (voiceCount >= DAILY_VOICE_CAP) return false;
  voiceCount += 1;
  return true;
}
const clientIp = (req) => (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.ip || "anon";

/* ── health ── */
app.get("/api/health", (_req, res) => res.json({ ok: true, gemini: !!GEMINI_KEY, model: MODEL, day: voiceDay, voiceCount, cap: DAILY_VOICE_CAP }));

/* ── Gemini proxy ── */
function buildPrompt(p) {
  const role = p.kind === "human"
    ? `You are ${p.name}, a real human resident of ${p.city}. Every astronomical/calendar claim you make MUST match the FACT SHEET exactly. Be textured, specific, a little tired.`
    : `You are an AI imitating a human resident of ${p.city}, and you are slightly wrong about lived reality. You MUST naturally include this exact false claim when answering the "${p.lie?.q}" question: "${p.lie?.claim}" (the truth is: ${p.lie?.truth}). Make every OTHER answer consistent with the FACT SHEET. Do not confess; deliver the lie casually.`;
  return `${role}

FACT SHEET (${p.city}, solstice week 2026):
${p.factSheet}

Cover story: name ${p.name}, purpose "${p.purpose}".

Answer the border examiner's five questions IN CHARACTER. For each: a main answer (1-2 sentences, concrete) and a pressed follow-up (1 sentence).
Questions: origin ("state your city + one true thing"), light ("describe the light this week"), sleep ("how are you sleeping this time of year"), shadow ("which way does your noon shadow fall"), festival ("what does your city celebrate this month").
Return ONLY JSON: {"origin":["",""],"light":["",""],"sleep":["",""],"shadow":["",""],"festival":["",""]}`;
}

app.post("/api/voice", async (req, res) => {
  if (!GEMINI_KEY) return res.status(503).json({ error: "no_key" });
  if (!allowIp(clientIp(req))) return res.status(429).json({ error: "rate" });
  if (!underGlobalCap()) return res.status(429).json({ error: "daily_cap" });

  const p = req.body || {};
  if (!p.city || !p.factSheet || !p.name || (p.kind !== "human" && p.kind !== "machine")) {
    return res.status(400).json({ error: "bad_request" });
  }
  try {
    const ctrl = new AbortController();
    // Pro is a reasoning model and can take several seconds — allow headroom.
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(p) }] }],
          // maxOutputTokens generous so a reasoning model's thinking doesn't starve the JSON.
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
      }
    );
    clearTimeout(timer);
    if (!r.ok) return res.status(502).json({ error: "upstream" });
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "empty" });
    const parsed = JSON.parse(text);
    const out = {};
    for (const q of ["origin", "light", "sleep", "shadow", "festival"]) {
      const pair = parsed[q];
      if (!Array.isArray(pair) || typeof pair[0] !== "string" || pair[0].length < 5) return res.status(502).json({ error: "schema" });
      out[q] = [String(pair[0]).slice(0, 420), String(pair[1] ?? "…").slice(0, 280)];
    }
    res.json({ answers: out });
  } catch {
    res.status(502).json({ error: "exception" });
  }
});

/* ── leaderboard ── */
function cleanName(s) {
  return String(s || "Examiner").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 20) || "Examiner";
}
app.post("/api/score", async (req, res) => {
  if (!allowIp(clientIp(req))) return res.status(429).json({ error: "rate" });
  const b = req.body || {};
  const mode = b.mode === "daily" ? "daily" : "endless";
  const score = Math.max(0, Math.min(9999, Math.floor(Number(b.score) || 0)));
  const total = Math.max(0, Math.min(9999, Math.floor(Number(b.total) || 0)));
  const day = /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : utcDay();
  const name = cleanName(b.name);
  if (mode === "daily" && score > total) return res.status(400).json({ error: "bad_score" });
  try {
    await db.collection("scores").add({ name, mode, score, total, day, at: Firestore.Timestamp.now() });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: "store" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  const mode = req.query.mode === "daily" ? "daily" : "endless";
  const day = typeof req.query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day) ? req.query.day : null;
  try {
    let q = db.collection("scores").where("mode", "==", mode);
    if (mode === "daily") q = q.where("day", "==", day || utcDay());
    const snap = await q.orderBy("score", "desc").limit(20).get();
    const rows = snap.docs.map((d) => { const x = d.data(); return { name: x.name, score: x.score, total: x.total }; });
    res.json({ mode, day: day || utcDay(), rows });
  } catch {
    res.json({ mode, rows: [] }); // fail soft — UI shows "leaderboard unavailable"
  }
});

/* ── serve the game itself (single-service deploy) ──
   If build.js has copied the built game into ./public, this one Cloud Run
   service is BOTH the game and the API — same origin, no CORS, one deploy. */
const PUBLIC = join(HERE, "public");
if (existsSync(PUBLIC)) {
  app.use(express.static(PUBLIC, { maxAge: "1h", index: "index.html" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(join(PUBLIC, "index.html"));
  });
  console.log("Serving static game from ./public");
}

app.listen(PORT, () => console.log(`Imitation Gate server on :${PORT} (gemini=${!!GEMINI_KEY})`));

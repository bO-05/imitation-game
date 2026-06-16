/**
 * gemini.ts — tier B of the Long Shift: Gemini voices the traveler.
 * Bring-your-own-key, optional, never required:
 *   - key lives in localStorage only; calls go browser → Generative Language API
 *   - the GAME stays deterministic: the seeded tell comes from endless.ts;
 *     Gemini only improvises the traveler's VOICE around a fact sheet
 *   - any failure (no key, network, quota, malformed JSON) falls back to the
 *     dossier voice silently — the game can never break on the API
 *
 * Prompt-injection stance: traveler text is DISPLAY-ONLY. Nothing a model
 * returns is ever executed, interpreted as instructions, or fed to the
 * verdict logic — the truth lives in the seeded case, not the prose.
 */
import type { EndlessCase } from "../data/endless";
import type { QuestionId } from "../data/questions";
import { almanacFor } from "../data/cities";
import { apiBase, hasProxy } from "../config";

const LS_KEY = "imitation-gate-gemini-key";
// Player-supplied-key path (fallback when no host proxy). Flagship by default.
const MODEL = "gemini-3.1-pro";

export function getKey(): string | null {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
export function setKey(k: string) {
  try { k ? localStorage.setItem(LS_KEY, k.trim()) : localStorage.removeItem(LS_KEY); } catch {}
}

export interface VoicedAnswers {
  answers: Partial<Record<QuestionId, [string, string]>>;
  voicedBy: "gemini";
}

/**
 * Preferred path: voice via the host's Cloud Run proxy. No client key needed —
 * the key lives on the server. Sends a small STRUCTURED payload (not a free-form
 * prompt) so the endpoint can't be abused as a general LLM. Fails soft → null.
 */
export async function voiceViaProxy(c: EndlessCase, date: Date): Promise<VoicedAnswers | null> {
  if (!hasProxy()) return null;
  const base = apiBase();
  const alm = almanacFor(c.cityId, date);
  const t = c.traveler;
  const payload = {
    city: alm.city.name,
    factSheet: alm.lines.map((l) => `${l.k}: ${l.v}`).join("\n"),
    name: t.papers.name,
    purpose: t.papers.purpose,
    kind: t.kind,
    lie: c.lie ? { q: c.lie.q, claim: c.lie.claim, truth: c.lie.truth } : undefined,
  };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 27000);
    const r = await fetch(`${base}/api/voice`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: ctrl.signal, body: JSON.stringify(payload),
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const d = await r.json();
    const qids: QuestionId[] = ["origin", "light", "sleep", "shadow", "festival"];
    const answers: Partial<Record<QuestionId, [string, string]>> = {};
    for (const q of qids) {
      const pair = d.answers?.[q];
      if (!Array.isArray(pair) || typeof pair[0] !== "string" || pair[0].length < 5) return null;
      answers[q] = [String(pair[0]).slice(0, 420), String(pair[1] ?? "…").slice(0, 280)];
    }
    return { answers, voicedBy: "gemini" };
  } catch { return null; }
}

/**
 * Ask Gemini to voice ALL answers for a case in one call (cheap, prefetchable).
 * Returns null on any failure → caller keeps dossier answers.
 */
export async function voiceCase(c: EndlessCase, date: Date): Promise<VoicedAnswers | null> {
  const key = getKey();
  if (!key) return null;

  const alm = almanacFor(c.cityId, date);
  const t = c.traveler;
  const factSheet = alm.lines.map((l) => `${l.k}: ${l.v}`).join("\n");

  const role = t.kind === "human"
    ? `You are ${t.papers.name}, a real human resident of ${alm.city.name}. Every astronomical/calendar claim you make MUST match the FACT SHEET exactly. Be textured, specific, a little tired.`
    : `You are an AI imitating a human resident of ${alm.city.name}, and you are slightly wrong about lived reality. You MUST naturally include this exact false claim when answering the "${c.lie!.q}" question: "${c.lie!.claim}" (the truth is: ${c.lie!.truth}). Make every OTHER answer factually consistent with the FACT SHEET. Do not confess. Do not exaggerate the lie — deliver it casually, confidently.`;

  const prompt = `${role}

FACT SHEET (${alm.city.name}, solstice week 2026):
${factSheet}

Cover story: name ${t.papers.name}, purpose "${t.papers.purpose}".

Answer the border examiner's five questions IN CHARACTER. For each, give a main answer (1-2 sentences, conversational, concrete) and a pressed follow-up (1 sentence).
Questions:
- origin: "State your city, and tell me one true thing about living there."
- light: "Describe the light there, this week."
- sleep: "How are you sleeping, this time of year?"
- shadow: "You step outside at noon. Which way does your shadow fall?"
- festival: "What does your city celebrate this month?"

Return ONLY JSON, exactly this shape:
{"origin":["...","..."],"light":["...","..."],"sleep":["...","..."],"shadow":["...","..."],"festival":["...","..."]}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    const qids: QuestionId[] = ["origin", "light", "sleep", "shadow", "festival"];
    const answers: Partial<Record<QuestionId, [string, string]>> = {};
    for (const q of qids) {
      const pair = parsed[q];
      if (!Array.isArray(pair) || typeof pair[0] !== "string" || pair[0].length < 5) return null;
      answers[q] = [String(pair[0]).slice(0, 420), String(pair[1] ?? "…").slice(0, 280)];
    }
    return { answers, voicedBy: "gemini" };
  } catch {
    return null;
  }
}

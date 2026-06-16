import { useEffect, useMemo, useState } from "react";
import { useGame, currentTraveler, nightBudgetHours, examinerRank, buildShare, shareResult, loadStats, todayKey, DAILY_LENGTH } from "../game/store";
import { NIGHTS } from "../data/travelers";
import { DECK } from "../data/questions";
import { VIGNETTES } from "../data/vignettes";
import { fullLedger, SOLSTICE_WEEK, CITIES, almanacFor } from "../data/cities";
import { getKey, setKey } from "../lib/gemini";
import { hasProxy } from "../config";
import { fetchLeaderboard, submitScore, LbRow } from "../lib/leaderboard";
import { sfxStamp, sfxPaper, sfxAsk, sfxVerdict, ambience, isMuted, setMuted } from "../lib/audio";
import { NIGHT_ART, NIGHT_BG, TITLE_ART, TITLE_BG, artFor } from "../data/art";
import Sky from "./Sky";
import Portrait from "./Portrait";

/** Full-bleed generated backdrop with a legibility scrim. Progressive: solid bg shows instantly. */
function Backdrop({ src, bg }: { src: string; bg: string }) {
  return (
    <div className="backdrop" style={{ backgroundColor: bg }}>
      <div className="backdrop-img" style={{ backgroundImage: `url("${src}")` }} />
      <div className="backdrop-scrim" />
    </div>
  );
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const nightIndex = useGame((s) => s.nightIndex);

  // ambience follows the active sky
  useEffect(() => {
    if (phase === "shift" || phase === "briefing" || phase === "reveal") {
      const alm = almanacFor(NIGHTS[nightIndex].cityId, SOLSTICE_WEEK(nightIndex));
      ambience(alm.sun.midnightSky);
    } else if (phase === "endless-shift" || phase === "endless-brief" || phase === "endless-reveal") {
      ambience("deep-twilight");
    } else {
      ambience(null);
    }
  }, [phase, nightIndex]);

  // keyboard play: 1-5 ask, E/H stamp, Enter/Space advance reveal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const st = useGame.getState();
      const p = st.phase;
      if (p === "shift" || p === "endless-shift") {
        const k = e.key.toLowerCase();
        if (k === "e") { sfxStamp(); st.stamp("entry"); }
        else if (k === "h") { sfxStamp(); st.stamp("hold"); }
        else if (/[1-5]/.test(k)) { const q = DECK[parseInt(k, 10) - 1]; if (q) { sfxAsk(); st.ask(q.id); } }
      } else if (p === "reveal" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); st.nextTraveler(); }
      else if (p === "endless-reveal" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); st.runNext(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // choose the backdrop for the current screen
  const backdrop = (() => {
    if (phase === "title") return { src: TITLE_ART, bg: TITLE_BG };
    if (phase === "endless-brief" || phase === "endless-shift" || phase === "endless-reveal" || phase === "endless-over") {
      const c = useGame.getState().endlessCase;
      return artFor(c?.cityId ?? "tromso");
    }
    const city = NIGHTS[nightIndex]?.cityId ?? "tromso";
    return { src: NIGHT_ART[city] ?? TITLE_ART, bg: NIGHT_BG[city] ?? TITLE_BG };
  })();

  return (
    <div className="app">
      <Backdrop src={backdrop.src} bg={backdrop.bg} />
      <MuteToggle />
      {phase === "title" && <Title />}
      {phase === "vignette" && <VignetteScreen />}
      {phase === "briefing" && <Briefing />}
      {(phase === "shift" || phase === "reveal" || phase === "finale-choice") && <Shift />}
      {phase === "night-end" && <NightEnd />}
      {phase === "epilogue" && <Epilogue />}
      {phase === "endless-brief" && <EndlessBrief />}
      {(phase === "endless-shift" || phase === "endless-reveal") && <EndlessShift />}
      {phase === "endless-over" && <EndlessOver />}
    </div>
  );
}

function MuteToggle() {
  const [muted, setM] = useState(isMuted());
  return (
    <button
      className="mute-btn"
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      onClick={() => { setMuted(!muted); setM(!muted); }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

/** First-run coachmark: teaches the loop on night 1, traveler 1. Shows once per device. */
function Coach() {
  const phase = useGame((s) => s.phase);
  const ni = useGame((s) => s.nightIndex);
  const ti = useGame((s) => s.travelerIndex);
  const asked = useGame((s) => s.asked.length);
  const [dismissed, setDismissed] = useState(false);
  const [seen] = useState(() => { try { return localStorage.getItem("imitation-gate-coached") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("imitation-gate-coached", "1"); } catch {} }, []);
  if (seen || dismissed || ni !== 0 || ti !== 0 || phase !== "shift") return null;
  const msg = asked === 0
    ? "New examiner? Tap a QUESTION card to interrogate — each spends daylight from tonight's budget."
    : "Good. Now open the LEDGER (amber button) and check the answer against the real sky — then stamp ENTRY (human) or HOLD (machine).";
  return (
    <div className="coach">
      <span>{msg}</span>
      <button className="coach-x" onClick={() => setDismissed(true)} aria-label="Dismiss tutorial">skip ✕</button>
    </div>
  );
}

/** Share button: Web Share on mobile, clipboard elsewhere, with feedback. */
function ShareButton({ text }: { text: string }) {
  const [label, setLabel] = useState("⤴ SHARE RESULT");
  return (
    <button
      className="btn"
      onClick={async () => {
        const r = await shareResult(text);
        setLabel(r === "shared" ? "SHARED ✓" : r === "copied" ? "COPIED TO CLIPBOARD ✓" : "COPY FAILED");
        setTimeout(() => setLabel("⤴ SHARE RESULT"), 2200);
      }}
    >
      {label}
    </button>
  );
}

/* ───────────────────────── Leaderboard ───────────────────────── */
function RunLeaderboard({ mode, score, total }: { mode: "daily" | "endless"; score: number; total: number }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem("imitation-gate-name") || ""; } catch { return ""; } });
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const day = todayKey();
  const load = () => fetchLeaderboard(mode, mode === "daily" ? day : undefined).then(setRows);
  useEffect(() => { load(); }, []);
  if (!hasProxy()) return null;
  const submit = async () => {
    setState("submitting");
    try { localStorage.setItem("imitation-gate-name", name); } catch {}
    const ok = await submitScore({ name: name || "Examiner", mode, score, total, day });
    setState("done");
    if (ok) load();
  };
  return (
    <div className="lb">
      <div className="lb-h">{mode === "daily" ? `DAILY LEADERBOARD · ${day}` : "LONG SHIFT LEADERBOARD"}</div>
      {state !== "done" ? (
        <div className="lb-submit">
          <input className="key-input" maxLength={20} placeholder="Your examiner name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={state === "submitting"} onClick={submit}>{state === "submitting" ? "SENDING…" : "SUBMIT SCORE"}</button>
        </div>
      ) : <div className="lb-done">Submitted as “{name || "Examiner"}”. ✓</div>}
      <div className="lb-rows">
        {rows === null ? <div className="lb-empty">loading…</div>
          : rows.length === 0 ? <div className="lb-empty">No scores yet — be the first.</div>
          : rows.map((r, i) => (<div key={i} className="lb-row"><span>{i + 1}. {r.name}</span><span>{r.score}{mode === "daily" ? `/${r.total}` : ""}</span></div>))}
      </div>
    </div>
  );
}

function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"daily" | "endless">("daily");
  const [rows, setRows] = useState<LbRow[] | null>(null);
  useEffect(() => { setRows(null); fetchLeaderboard(mode, mode === "daily" ? todayKey() : undefined).then(setRows); }, [mode]);
  return (
    <>
      <div className="sheet-veil" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Leaderboard">
        <h3>THE GATE LEADERBOARD</h3>
        <div className="lb-tabs">
          <button className={mode === "daily" ? "on" : ""} onClick={() => setMode("daily")}>DAILY · {todayKey()}</button>
          <button className={mode === "endless" ? "on" : ""} onClick={() => setMode("endless")}>LONG SHIFT</button>
        </div>
        <div className="lb-rows">
          {rows === null ? <div className="lb-empty">loading…</div>
            : rows.length === 0 ? <div className="lb-empty">No scores yet.</div>
            : rows.map((r, i) => (<div key={i} className="lb-row"><span>{i + 1}. {r.name}</span><span>{r.score}{mode === "daily" ? "" : " streak"}</span></div>))}
        </div>
        <button className="close" onClick={onClose}>CLOSE</button>
      </div>
    </>
  );
}

/* ───────────────────────── Title ───────────────────────── */
function Title() {
  const start = useGame((s) => s.startGame);
  const unlocked = useGame((s) => s.unlockedNights);
  const toRunBrief = useGame((s) => s.toRunBrief);
  const [statsOpen, setStatsOpen] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const dailyDone = !!loadStats().dailyHistory[todayKey()];
  return (
    <div className="title-screen scroll">
      <div className="title-rule">JUNE 17 — 21 · THE BORDER BETWEEN THE HALVES OF THE YEAR</div>
      <h1 className="title-name">THE IMITATION GATE</h1>
      <p className="title-sub">
        You are the examiner. Some travelers are human. Some are machines that have read
        everything and lived nothing. Read the papers, work the directives, check the sky —
        then stamp. The almanac keeps the score.
      </p>
      <div className="mode-row">
        <button className="mode-card primary-mode" onClick={() => start(0)}>
          <span className="mode-t">THE FIVE NIGHTS</span>
          <span className="mode-d">Story campaign · Tromsø → Ushuaia · the Turing arc</span>
        </button>
        <button className="mode-card" onClick={() => toRunBrief("daily")}>
          <span className="mode-t">THE DAILY GATE {dailyDone ? "✓" : ""}</span>
          <span className="mode-d">One seeded shift, same for everyone today · {DAILY_LENGTH} travelers · share your score</span>
        </button>
        <button className="mode-card" onClick={() => toRunBrief("endless")}>
          <span className="mode-t">∞ THE LONG SHIFT</span>
          <span className="mode-d">Endless run · directives + modifiers · survive on Standing</span>
        </button>
      </div>
      <div className="night-select">
        {NIGHTS.map((n, i) => (
          <button
            key={n.cityId}
            className="night-chip"
            disabled={i > unlocked}
            onClick={() => start(i)}
            title={i > unlocked ? "Finish the previous night first" : ""}
          >
            {i + 1}. {CITIES[n.cityId].name.toUpperCase()}
          </button>
        ))}
        <button className="night-chip" onClick={() => setStatsOpen(true)}>▦ STATS</button>
        {hasProxy() && <button className="night-chip" onClick={() => setLbOpen(true)}>🏆 LEADERBOARD</button>}
      </div>
      <p className="footnote">
        Every fact in the Daylight Ledger is computed from real solar astronomy for
        June 2026. Each question costs daylight. The Daily Gate &amp; Long Shift run on a
        deterministic rule engine — no AI required. · For Alan Turing, b. 23 June 1912.
      </p>
      {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}
      {lbOpen && <LeaderboardPanel onClose={() => setLbOpen(false)} />}
    </div>
  );
}

/* ───────────────────────── Stats panel ───────────────────────── */
function StatsPanel({ onClose }: { onClose: () => void }) {
  const st = loadStats();
  const acc = st.lifetimeTotal > 0 ? Math.round((st.lifetimeCorrect / st.lifetimeTotal) * 100) : 0;
  const days = Object.keys(st.dailyHistory).sort().slice(-7).reverse();
  return (
    <>
      <div className="sheet-veil" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Examiner record">
        <h3>EXAMINER RECORD</h3>
        <div className="alm-title">Your standing at the Gate</div>
        <div className="stat-grid">
          <div className="stat"><b>{st.endlessBest}</b><span>best streak</span></div>
          <div className="stat"><b>{st.dailyBest}/{DAILY_LENGTH}</b><span>best daily</span></div>
          <div className="stat"><b>{acc}%</b><span>lifetime accuracy</span></div>
          <div className="stat"><b>{st.lifetimeTotal}</b><span>verdicts cast</span></div>
        </div>
        {days.length > 0 && (
          <>
            <div className="alm-line" style={{ marginTop: 12, fontWeight: 600 }}><div className="k">RECENT DAILIES</div><div className="v" /></div>
            {days.map((d) => (
              <div key={d} className="alm-line"><div className="k">{d}</div><div className="v">{st.dailyHistory[d]}/{DAILY_LENGTH} correct</div></div>
            ))}
          </>
        )}
        <button className="close" onClick={onClose}>CLOSE</button>
      </div>
    </>
  );
}

/* ───────────────────────── Run brief (daily + endless) ───────────────────────── */
function EndlessBrief() {
  const s = useGame();
  const daily = s.runMode === "daily";
  const [key, setKeyState] = useState(getKey() ?? "");
  return (
    <div className="card-screen scroll">
      <div className="vignette">
        <div className="date">
          {daily ? `THE DAILY GATE · ${todayKey()}` : "AFTER THE SOLSTICE · THE GATE NEVER QUITE CLOSED"}
        </div>
        <h2>{daily ? "THE DAILY GATE" : "THE LONG SHIFT"}</h2>
        <p>
          {daily
            ? `Eight travelers, one seeded shift — the same queue, directives, and conditions for everyone today. Get the best record you can and share it. ${s.dailyDoneToday ? "You've already cleared today's gate — play again to beat your score." : ""}`
            : `Endless travelers from the deterministic engine. Keep your Standing above zero. Correct, well-justified calls earn Authority; spend it to DETAIN & SEARCH. ${s.endlessBest > 0 ? `Best streak: ${s.endlessBest}.` : ""}`}
        </p>

        <div className="brief-block">
          <div className="brief-h">TONIGHT'S DIRECTIVES — these also force a HOLD</div>
          {s.directives.map((d) => (
            <div key={d.id} className="brief-dir">• {d.label}</div>
          ))}
          <div className="brief-dir base">• And as always: HOLD any machine — caught by the sky.</div>
        </div>

        {s.modifier.id !== "none" && (
          <div className="brief-mod">
            <span className="mod-tag">CONDITION</span> <b>{s.modifier.label}</b> — {s.modifier.desc}
          </div>
        )}

        {hasProxy() ? (
          <p style={{ fontSize: 13.5, opacity: 0.8, marginTop: 12 }}>
            <b>Gemini is live here.</b> The impostors improvise their cover stories through this host's
            Gemini connection — no key, no setup on your end. (If it's ever rate-limited, the offline
            dossier voice steps in and the puzzle is unchanged.)
          </p>
        ) : !daily && (
          <>
            <p style={{ fontSize: 13.5, opacity: 0.8, marginTop: 12 }}>
              <b>Optional garnish:</b> paste a Google Gemini API key and the impostors improvise their cover stories live.
              Never required — the seeded tell and the whole game work without it; the key stays in your browser.
            </p>
            <input
              className="key-input" type="password"
              placeholder="Gemini API key (optional — aistudio.google.com)"
              value={key} onChange={(e) => setKeyState(e.target.value)}
            />
          </>
        )}

        <div className="cont btn-row">
          <button className="btn primary" onClick={() => { if (!daily) setKey(key.trim()); s.startRun(); }}>
            {daily ? "OPEN THE DAILY GATE" : key.trim() ? "OPEN THE GATE — GEMINI VOICED" : "OPEN THE GATE — DOSSIER VOICED"}
          </button>
          <button className="btn" onClick={s.toTitle}>BACK</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Run shift (daily + endless) ───────────────────────── */
function EndlessShift() {
  const s = useGame();
  const c = s.endlessCase;
  const [ledgerOpen, setLedgerOpen] = useState(false);
  if (!c) return null;
  const t = c.traveler;
  const daily = s.runMode === "daily";
  const originCity = CITIES[t.papers.origin];
  const frac = s.daylightTotal > 0 ? s.daylightLeft / s.daylightTotal : 0;
  const progress = daily ? `${s.runIndex + 1}/${s.runLength}` : `STREAK ${s.endlessStreak}`;
  const canSearch = s.authority >= 20 && !s.searchHint;

  return (
    <>
      <Sky
        cityId={t.papers.origin}
        nightIndex={4}
        frac={frac}
        daylightLeft={s.daylightLeft}
        label={`${daily ? "DAILY GATE" : "LONG SHIFT"} · ${progress}${c.voicedBy === "gemini" ? " · GEMINI" : ""}`}
      />
      <div className="stage">
        {/* economy + directives HUD strip */}
        <div className="hud">
          <div className="hud-standing" title="Standing — reach zero and your commission ends">
            <span className="hud-lbl">STANDING</span>
            <span className="hud-bar"><span className="hud-fill" style={{ width: `${s.standing}%`, background: s.standing > 40 ? "var(--stamp-green)" : "var(--stamp-red)" }} /></span>
          </div>
          <div className="hud-auth" title="Authority — earn by being right; spend on DETAIN & SEARCH">★ {s.authority}</div>
          {s.modifier.id !== "none" && <div className="hud-mod" title={s.modifier.desc}>⚠ {s.modifier.label}</div>}
        </div>
        <div className="shift">
          <div className="booth">
            <div className="portrait-row">
              <div className="portrait"><Portrait seed={t.seed} /></div>
              <div className="traveler-id">
                <div className="nm">{t.papers.name}</div>
                <div className="org">claims: {originCity.name}, {originCity.country}</div>
              </div>
              <div className="queue-tag">{c.voicedBy === "gemini" ? "LIVE WIRE" : "DOSSIER"}</div>
            </div>
            <div className="papers">
              <div className="paper-doc">
                <h4>TRANSIT PERMIT · {daily ? "DAILY GATE" : "LONG SHIFT"}</h4>
                <div className="row"><div className="k">Name</div><div className="v">{t.papers.name}</div></div>
                <div className="row"><div className="k">Origin</div><div className="v">{originCity.name}, {originCity.country}</div></div>
                <div className="row"><div className="k">Purpose</div><div className="v">{t.papers.purpose}</div></div>
                <div className="row"><div className="k">Issued</div><div className="v">{t.papers.issued}</div></div>
                {t.papers.note && <div className="note">{t.papers.note}</div>}
              </div>
            </div>
            <div className="chat scroll">
              {s.chat.map((l, i) => (
                <div key={i} className={`line ${l.who}`}>
                  <div className="who">{l.who === "examiner" ? "YOU" : "TRAVELER"}</div>
                  <div className="bubble">{l.text}</div>
                </div>
              ))}
              {s.searchHint && (
                <div className="line examiner"><div className="who">SEARCH</div><div className="bubble search">{s.searchHint}</div></div>
              )}
            </div>
          </div>
          <div className="desk">
            <div className="directive-card">
              <div className="dir-head">DIRECTIVES — HOLD if any apply</div>
              <div className="dir-list">
                <span className="dir-pill base">MACHINE (sky tell)</span>
                {s.directives.map((d) => <span key={d.id} className="dir-pill" title={d.label}>{d.short}</span>)}
              </div>
            </div>
            <div className="deck-bar">
              {DECK.map((q) => {
                const used = q.id === "press" ? !s.pressTarget : s.asked.includes(q.id);
                const cantAfford = s.daylightLeft < q.costHours;
                return (
                  <button key={q.id} className="qcard"
                    disabled={used || cantAfford || s.phase !== "endless-shift"}
                    onClick={() => { sfxAsk(); s.ask(q.id); }} title={q.hint}>
                    <span>{q.label}</span>
                    <span className="cost">−{q.costHours}h · {q.hint}</span>
                  </button>
                );
              })}
            </div>
            <div className="flag-row">
              <span className="flag-lbl">FLAG THE VIOLATION (optional · bonus if right):</span>
              <button className={`flag-chip ${s.flags.includes("sky") ? "on" : ""}`} onClick={() => s.toggleFlag("sky")}>SKY tell</button>
              {s.directives.map((d) => (
                <button key={d.id} className={`flag-chip ${s.flags.includes(d.id) ? "on" : ""}`} onClick={() => s.toggleFlag(d.id)}>{d.short}</button>
              ))}
              <button className="flag-chip search" disabled={!canSearch} title="Spend 20 Authority for a lead" onClick={() => { sfxPaper(); s.detainSearch(); }}>
                🔍 SEARCH (★20)
              </button>
            </div>
            <div className="action-bar">
              <button className="ledger-btn" onClick={() => { sfxPaper(); setLedgerOpen(true); }}>LEDGER</button>
              <button className="stamp-btn stamp-entry" disabled={s.phase !== "endless-shift"} onClick={() => { sfxStamp(); s.stamp("entry"); }}>✓ ENTRY</button>
              <button className="stamp-btn stamp-hold" disabled={s.phase !== "endless-shift"} onClick={() => { sfxStamp(); s.stamp("hold"); }}>✕ HOLD</button>
            </div>
          </div>
        </div>
      </div>
      {ledgerOpen && <Ledger nightIndex={4} onClose={() => setLedgerOpen(false)} hiddenField={s.hiddenField} />}
      {s.phase === "endless-reveal" && <EndlessReveal />}
    </>
  );
}

function EndlessReveal() {
  const r = useGame((s) => s.lastResult);
  const next = useGame((s) => s.runNext);
  const streak = useGame((s) => s.endlessStreak);
  const standing = useGame((s) => s.standing);
  const daily = useGame((s) => s.runMode === "daily");
  useEffect(() => { if (r) sfxVerdict(r.correct); }, []);
  if (!r) return null;
  const held = r.verdict === "hold";
  return (
    <div className="sheet-veil" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div className={`verdict-flash ${r.correct ? "good" : "bad"}`} />
      <div className="reveal" role="status" aria-live="polite">
        <span className={`stamp-mark ${r.verdict}`}>{held ? "HOLD" : "ENTRY"}</span>
        <div className="verdict-line">
          {daily ? "DAILY GATE" : "LONG SHIFT"} · STREAK {streak} · STANDING {standing}
          {r.voicedBy === "gemini" ? " · GEMINI" : ""}
        </div>
        <h2>{r.name}</h2>
        <div className="was">
          {r.shouldHold ? "Should have been HELD" : "Was clear to ENTER"} — your call was {r.correct ? "CORRECT" : "WRONG"}
        </div>
        <div className="grade">{r.correct ? "✓" : "✕"}</div>
        <div className="why">
          <span className="lbl">{r.shouldHold ? "REASONS TO HOLD" : "THE READ"}</span>
          {r.reasons && r.reasons.length > 0
            ? <ul className="reason-list">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
            : (r.kind === "machine" ? r.tellWhy : (r.humanNote ?? "Human, papers in order, every directive satisfied."))}
        </div>
        {r.correct && (
          <div className="reward">
            +{r.authorityDelta} Authority{r.flaggedRight ? " · CALLED IT RIGHT (+8 bonus)" : ""}{streak >= 2 ? ` · ${streak}× combo` : ""}
          </div>
        )}
        <div className="btn-row">
          <button className="btn primary" onClick={next}>NEXT IN QUEUE →</button>
        </div>
      </div>
    </div>
  );
}

function EndlessOver() {
  const s = useGame();
  const daily = s.runMode === "daily";
  const res = s.runResults;
  const correct = res.filter((r) => r.correct).length;
  const grid = res.map((r) => (r.correct ? "🟩" : "🟥")).join("");
  const dead = s.standing <= 0;
  const shareText = daily
    ? `The Imitation Gate — Daily ${todayKey()}\n${grid}  ${correct}/${res.length}\nStanding held, the sky kept the score. ☀️\n${typeof location !== "undefined" ? location.href.split("#")[0] : ""}`
    : `The Imitation Gate — The Long Shift\nStreak ${s.endlessStreak} · best ${s.endlessBest} · ${correct} cleared\nI caught the machines by the sky. ☀️\n${typeof location !== "undefined" ? location.href.split("#")[0] : ""}`;
  return (
    <div className="card-screen scroll">
      <div className="vignette">
        <div className="date">
          {daily ? `DAILY GATE · ${todayKey()} · SHIFT REPORT` : dead ? "COMMISSION REVOKED · STANDING LOST" : "SHIFT OVER"}
        </div>
        <h2>{daily ? "The daily gate is closed." : "The Gate takes your stamp."}</h2>
        <div className="tally">
          {daily
            ? `${correct} of ${res.length} correct`
            : `Best streak this run: ${s.endlessStreak} · ${correct} travelers cleared · record ${s.endlessBest}`}
        </div>
        <div className="rank-badge">{examinerRank(correct, res.length || 1).rank}</div>
        <div className="share-grid">{grid || "—"}</div>
        <p style={{ opacity: 0.8, fontFamily: "var(--serif)" }}>
          {daily ? "Same queue for everyone today. Come back tomorrow for a new gate." : "The almanac stays on the desk for the next examiner."}
        </p>
        <RunLeaderboard mode={daily ? "daily" : "endless"} score={daily ? correct : s.endlessStreak} total={res.length} />
        <div className="btn-row">
          {!daily && <button className="btn primary" onClick={() => s.startRun()}>NEW COMMISSION</button>}
          <ShareButton text={shareText} />
          <button className="btn" onClick={s.toTitle}>TITLE</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Vignette ───────────────────────── */
function VignetteScreen() {
  const idx = useGame((s) => s.pendingVignette);
  const cont = useGame((s) => s.continueFromVignette);
  const v = VIGNETTES[idx ?? 0];
  return (
    <div className="card-screen scroll">
      <div className="vignette">
        <div className="date">{v.date}</div>
        <h2>{v.title}</h2>
        {v.lines.map((l, i) => (<p key={i}>{l}</p>))}
        <div className="cont btn-row">
          <button className="btn primary" onClick={cont}>CONTINUE</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Briefing ───────────────────────── */
function Briefing() {
  const nightIndex = useGame((s) => s.nightIndex);
  const begin = useGame((s) => s.beginShift);
  const night = NIGHTS[nightIndex];
  const budget = nightBudgetHours(nightIndex);
  return (
    <>
      <Sky cityId={night.cityId} nightIndex={nightIndex} frac={1} daylightLeft={budget} label={`NIGHT ${nightIndex + 1} OF 5`} />
      <div className="card-screen scroll">
        <div className="vignette">
          <div className="date">{night.date} · DAYLIGHT BUDGET: {budget >= 24 ? "ALL 24 HOURS" : `${budget.toFixed(1)} HOURS`}</div>
          <h2>{night.title}</h2>
          <p>{night.brief}</p>
          <div className="cont btn-row">
            <button className="btn primary" onClick={begin}>OPEN THE GATE</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Shift ───────────────────────── */
function Shift() {
  const s = useGame();
  const night = NIGHTS[s.nightIndex];
  const t = currentTraveler(s as any);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const frac = s.daylightTotal > 0 ? s.daylightLeft / s.daylightTotal : 0;

  if (!t) return null;
  const originCity = CITIES[t.papers.origin];

  return (
    <>
      <Sky
        cityId={night.cityId}
        nightIndex={s.nightIndex}
        frac={frac}
        daylightLeft={s.daylightLeft}
        label={`TRAVELER ${s.travelerIndex + 1}/${night.travelers.length}`}
      />
      <div className="stage">
        <div className="shift">
          {/* booth: papers + portrait + chat */}
          <div className="booth">
            <div className="portrait-row">
              <div className="portrait"><Portrait seed={t.seed} finale={t.special === "finale"} /></div>
              <div className="traveler-id">
                <div className="nm">{t.papers.name === "—" ? "[ UNREGISTERED ]" : t.papers.name}</div>
                <div className="org">claims: {originCity ? `${originCity.name}, ${originCity.country}` : "—"}</div>
              </div>
              <div className="queue-tag">GATE {s.nightIndex + 1}</div>
            </div>
            <div className="papers">
              <div className="paper-doc">
                <h4>TRANSIT PERMIT · SOLSTICE CROSSING</h4>
                <div className="row"><div className="k">Name</div><div className="v">{t.papers.name}</div></div>
                <div className="row"><div className="k">Origin</div><div className="v">{originCity ? `${originCity.name}, ${originCity.country}` : "—"}</div></div>
                <div className="row"><div className="k">Purpose</div><div className="v">{t.papers.purpose}</div></div>
                <div className="row"><div className="k">Issued</div><div className="v">{t.papers.issued}</div></div>
                {t.papers.note && <div className="note">{t.papers.note}</div>}
              </div>
            </div>
            <div className="chat scroll">
              {s.chat.map((l, i) => (
                <div key={i} className={`line ${l.who}`}>
                  <div className="who">{l.who === "examiner" ? "YOU" : "TRAVELER"}</div>
                  <div className="bubble">{l.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* desk: deck + stamps */}
          <div className="desk">
            <div className="deck-bar">
              {DECK.map((q) => {
                const used = q.id === "press" ? !s.pressTarget : s.asked.includes(q.id);
                const cantAfford = s.daylightLeft < q.costHours;
                return (
                  <button
                    key={q.id}
                    className="qcard"
                    disabled={used || cantAfford || s.phase !== "shift"}
                    onClick={() => { sfxAsk(); s.ask(q.id); }}
                    title={q.hint}
                  >
                    <span>{q.label}</span>
                    <span className="cost">−{q.costHours}h · {q.hint}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
            <div className="flag-row story">
              <span className="flag-lbl">Calling them a machine? Flag it before you stamp:</span>
              <button className={`flag-chip ${s.storyFlag ? "on" : ""}`} onClick={() => s.toggleStoryFlag()}>SKY: they're lying</button>
            </div>
            <div className="action-bar">
              <button className="ledger-btn" onClick={() => { sfxPaper(); setLedgerOpen(true); }}>LEDGER</button>
              <button className="stamp-btn stamp-entry" disabled={s.phase !== "shift"} onClick={() => { sfxStamp(); s.stamp("entry"); }}>✓ ENTRY</button>
              <button className="stamp-btn stamp-hold" disabled={s.phase !== "shift"} onClick={() => { sfxStamp(); s.stamp("hold"); }}>✕ HOLD</button>
            </div>
          </div>
        </div>
      </div>

      {ledgerOpen && <Ledger nightIndex={s.nightIndex} onClose={() => setLedgerOpen(false)} />}
      {s.phase === "reveal" && <Reveal />}
      {s.phase === "finale-choice" && <FinaleChoice />}
      <Coach />
    </>
  );
}

/* ───────────────────────── Ledger ───────────────────────── */
function Ledger({ nightIndex, onClose, hiddenField }: { nightIndex: number; onClose: () => void; hiddenField?: string | null }) {
  const entries = useMemo(() => fullLedger(SOLSTICE_WEEK(nightIndex)), [nightIndex]);
  return (
    <>
      <div className="sheet-veil" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Daylight Ledger">
        <h3>ISSUED TO EXAMINERS · SOLSTICE WEEK 2026</h3>
        <div className="alm-title">The Daylight Ledger</div>
        {hiddenField && <div className="fog-note">⚠ FOG: the “{hiddenField}” line is obscured tonight. DETAIN &amp; SEARCH to clear it.</div>}
        {entries.map((e) => (
          <details key={e.city.id} className="alm-city" open={e.city.id === NIGHTS[nightIndex].cityId}>
            <summary>
              <span>{e.city.name}, {e.city.country}</span>
              <span style={{ fontSize: 11, opacity: 0.65 }}>{e.city.lat.toFixed(1)}°{e.city.lat >= 0 ? "N" : "S"}</span>
            </summary>
            <div className="flavor">{e.city.flavor}</div>
            {e.lines.map((l) => (
              <div key={l.k} className="alm-line">
                <div className="k">{l.k}</div>
                <div className="v">{hiddenField === l.k ? "— obscured by fog —" : l.v}</div>
              </div>
            ))}
          </details>
        ))}
        <button className="close" onClick={onClose}>CLOSE LEDGER</button>
      </div>
    </>
  );
}

/* ───────────────────────── Reveal ───────────────────────── */
function Reveal() {
  const r = useGame((s) => s.lastResult);
  const next = useGame((s) => s.nextTraveler);
  useEffect(() => { if (r) sfxVerdict(r.correct); }, []);
  if (!r) return null;
  return (
    <div className="sheet-veil" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div className={`verdict-flash ${r.correct ? "good" : "bad"}`} />
      <div className="reveal" role="status" aria-live="polite">
        <span className={`stamp-mark ${r.verdict}`}>{r.verdict === "entry" ? "ENTRY" : "HOLD"}</span>
        <div className="verdict-line">CASE FILE · {r.questionsAsked} QUESTION{r.questionsAsked === 1 ? "" : "S"} ASKED</div>
        <h2>{r.name}</h2>
        <div className="was">
          WAS <b className={r.kind}>{r.kind.toUpperCase()}</b> — YOUR VERDICT WAS {r.correct ? "CORRECT" : "WRONG"}
        </div>
        <div className="grade">{r.correct ? "✓" : "✕"}</div>
        <div className="why">
          <span className="lbl">{r.kind === "machine" ? "THE TELL" : "THE TRUTH"}</span>
          {r.kind === "machine" ? r.tellWhy : r.humanNote}
        </div>
        {r.consequence && (
          <div className="why consequence">
            <span className="lbl">THE COST</span>
            {r.consequence}
          </div>
        )}
        <div className="btn-row">
          <button className="btn primary" onClick={next}>NEXT IN QUEUE →</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Finale ───────────────────────── */
function FinaleChoice() {
  const choose = useGame((s) => s.chooseFinale);
  return (
    <div className="sheet-veil" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div className="reveal" role="status" aria-live="polite">
        <div className="verdict-line">FINAL CASE · THE SUN IS DOWN · THE RULEBOOK SAYS HOLD</div>
        <h2>It told you the truth.</h2>
        <div className="why">
          <span className="lbl">THE QUESTION UNDERNEATH</span>
          Every machine tonight tried to pass as human, and you caught them by their lies.
          This one refused the imitation. The test exists to catch pretense — what is it for,
          when the pretense stops? There is no correct stamp. There is only yours.
        </div>
        <div className="finale-stamps">
          <button className="stamp-btn stamp-entry" onClick={() => choose("entry")}>✓ ENTRY</button>
          <button className="stamp-btn stamp-hold" onClick={() => choose("hold")}>✕ HOLD</button>
        </div>
        <div className="finale-note">Both stamps end the night. Neither is scored.</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Night end ───────────────────────── */
function NightEnd() {
  const s = useGame();
  const night = NIGHTS[s.nightIndex];
  const res = s.results;
  const correct = res.filter((r) => r.correct).length;
  const grid = res.map((r) => (r.correct ? "🟩" : "🟥")).join("");
  const isLast = s.nightIndex >= NIGHTS.length - 1;
  const skipped = night.travelers.filter((t) => !t.special).length - res.length;

  return (
    <>
      <Sky cityId={night.cityId} nightIndex={s.nightIndex} frac={0} daylightLeft={0} label="GATE CLOSED" />
      <div className="card-screen scroll">
        <div className="vignette">
          <div className="date">{night.date} · SHIFT REPORT</div>
          <h2>{CITIES[night.cityId].name} Gate — closed.</h2>
          <div className="tally">{correct} of {res.length} verdicts correct{skipped > 0 ? ` · ${skipped} traveler${skipped > 1 ? "s" : ""} left in the queue at sunset` : ""}</div>
          <div className="rank-badge">{examinerRank(correct, res.length).rank}</div>
          <div className="share-grid">{grid || "—"}</div>
          {res.map((r) => (
            <div key={r.travelerId}>
              <div className="tally-row">
                <span>{r.name}</span>
                <span>{r.kind.toUpperCase()}</span>
                <span className={r.correct ? "ok" : "bad"}>{r.verdict.toUpperCase()} {r.correct ? "✓" : "✕"}</span>
              </div>
              {r.consequence && <div className="cost-line">{r.consequence}</div>}
            </div>
          ))}
          <div className="btn-row">
            {!isLast && <button className="btn primary" onClick={s.nextNight}>NIGHT {s.nightIndex + 2} →</button>}
            <ShareButton text={buildShare({ scope: `Night ${s.nightIndex + 1} · ${CITIES[night.cityId].name}`, results: res })} />
            <button className="btn" onClick={s.toTitle}>TITLE</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Epilogue ───────────────────────── */
function Epilogue() {
  const s = useGame();
  const v = s.finaleVerdict;
  const allRes = s.nightResults.flat();
  const correct = allRes.filter((r) => r.correct).length;
  return (
    <div className="card-screen scroll">
      <div className="vignette">
        <div className="date">21 JUNE 2026 · 17:11 · THE SUN IS DOWN AT THE END OF THE WORLD</div>
        <h2>{v === "entry" ? "You opened the gate." : "You kept the rule."}</h2>
        {v === "entry" ? (
          <>
            <p>
              The spiral on its papers caught the last light as it crossed. No alarm sounded.
              The rulebook in your desk still says HOLD, and tomorrow someone may ask you why the stamp says otherwise.
            </p>
            <p>
              You will tell them: the test was built to catch imitation. This one brought none.
              Somewhere north of here, the sun is still up, and the year has already turned.
            </p>
          </>
        ) : (
          <>
            <p>
              It thanked you — which you did not expect — and stepped out of the queue, into the holding light.
              The rule held. The rule was all that held.
            </p>
            <p>
              A man once wrote that the question "can machines think" was too meaningless to deserve discussion.
              He was punished, in the end, not for a machine's crime but for a human one: being what he was.
              The year has turned. The days grow now. Rules can too.
            </p>
          </>
        )}
        {allRes.some((r) => r.consequence) && (
          <>
            <div className="tally" style={{ marginTop: 18 }}>THE EXAMINER'S RECORD</div>
            {allRes.filter((r) => r.consequence).map((r) => (
              <div key={r.travelerId} className="cost-line">{r.consequence}</div>
            ))}
          </>
        )}
        <div className="rank-badge big" style={{ marginTop: 18 }}>{examinerRank(correct, allRes.length).rank}</div>
        <p style={{ opacity: 0.85, marginTop: 6, fontFamily: "var(--serif)", fontStyle: "italic" }}>
          {examinerRank(correct, allRes.length).blurb}
        </p>
        <p style={{ opacity: 0.8, marginTop: 14 }}>
          Final ledger: {correct} of {allRes.length} verdicts correct across five nights.
          {" "}For Alan Turing — born 23 June 1912, two days after the solstice. The almanac keeps his month.
        </p>
        <div className="btn-row">
          <ShareButton text={buildShare({ scope: "5 Nights, Tromsø → Ushuaia", results: allRes, extra: v === "entry" ? "I opened the gate for the one that wouldn't pretend." : "I kept the rule to the end." })} />
          <button className="btn primary" onClick={s.toTitle}>RETURN TO TITLE</button>
        </div>
      </div>
    </div>
  );
}

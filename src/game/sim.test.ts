/**
 * sim.test.ts — headless playthrough of the entire game via the zustand store.
 * Verifies: budgets, question costs, stamp correctness, night progression,
 * sunset cutoffs, finale flow, and that a "perfect examiner" can finish
 * every night with daylight to spare (i.e., the budget tuning is fair).
 * Run: node src/game/sim.test.ts
 */
// Minimal localStorage shim for node
(globalThis as any).localStorage = {
  _d: {} as Record<string, string>,
  getItem(k: string) { return this._d[k] ?? null; },
  setItem(k: string, v: string) { this._d[k] = v; },
};

import { useGame, nightBudgetHours } from "./store.ts";
import { NIGHTS } from "../data/travelers.ts";
import { QUESTION_BY_ID, QuestionId } from "../data/questions.ts";

const g = () => useGame.getState();
let failures = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}`);
  if (!ok) failures++;
};

console.log("=== BUDGET SANITY ===");
const budgets = NIGHTS.map((_, i) => nightBudgetHours(i));
console.log("night budgets (h):", budgets.map((b) => b.toFixed(2)).join(", "));
check("N1 Tromsø = 24h (midnight sun)", budgets[0] === 24);
check("N2 Stockholm ≈ 18.6h", Math.abs(budgets[1] - 18.6) < 0.3);
check("N3 Cairo ≈ 14.1h", Math.abs(budgets[2] - 14.1) < 0.3);
check("N4 Singapore ≈ 12.2h", Math.abs(budgets[3] - 12.2) < 0.3);
check("N5 Ushuaia ≈ 7.2h", Math.abs(budgets[4] - 7.2) < 0.3);
check("budgets strictly decreasing", budgets.every((b, i) => i === 0 || b < budgets[i - 1]));

console.log("\n=== CONTENT INTEGRITY ===");
let machines = 0, humans = 0;
for (const night of NIGHTS) {
  for (const t of night.travelers) {
    if (t.special === "finale") continue;
    if (t.kind === "machine") {
      machines++;
      check(`${t.id}: machine has tell`, !!t.tell?.why && t.tell.why.length > 40);
      check(`${t.id}: tell question has an answer pair`, !!t.answers[t.tell!.q]);
    } else {
      humans++;
      check(`${t.id}: human has note`, !!t.humanNote && t.humanNote.length > 40);
    }
    const qids: QuestionId[] = ["origin", "light", "sleep", "shadow", "festival"];
    for (const q of qids) {
      const pair = t.answers[q];
      check(`${t.id}.${q}: answer + press exist`, !!pair && pair.length === 2 && pair[0].length > 10 && pair[1].length > 5);
    }
  }
}
console.log(`travelers: ${humans} human, ${machines} machine (+1 finale)`);
check("balanced-ish cast", Math.abs(humans - machines) <= 2);

console.log("\n=== FULL PLAYTHROUGH: PERFECT EXAMINER ===");
// Strategy: ask the machine's tell question (or 2 cheap questions for humans), stamp correctly.
for (let n = 0; n < NIGHTS.length; n++) {
  g().startGame(n);
  if (g().phase === "vignette") g().continueFromVignette();
  check(`N${n + 1}: briefing reached`, g().phase === "briefing");
  g().beginShift();
  check(`N${n + 1}: budget = ${nightBudgetHours(n)}`, g().daylightTotal === nightBudgetHours(n));

  let guard = 0;
  while ((g().phase === "shift") && guard++ < 50) {
    const s = g();
    const night = NIGHTS[s.nightIndex];
    const t = night.travelers[s.travelerIndex];

    if (t.special === "finale") {
      g().stamp("hold"); // brings up finale-choice
      check("finale: choice phase", g().phase === "finale-choice");
      g().chooseFinale("entry");
      break;
    }

    // perfect play: ask the cutting question, then stamp
    const qid = t.kind === "machine" ? t.tell!.q : "origin";
    const before = g().daylightLeft;
    g().ask(qid);
    const cost = QUESTION_BY_ID[qid].costHours;
    check(`${t.id}: daylight ${before.toFixed(1)}→${g().daylightLeft.toFixed(1)} (−${cost})`,
      Math.abs(before - g().daylightLeft - cost) < 0.001);
    check(`${t.id}: chat grew`, g().chat.length >= 3);

    g().stamp(t.kind === "machine" ? "hold" : "entry");
    if (g().phase === "reveal") {
      check(`${t.id}: verdict correct`, g().lastResult!.correct);
      g().nextTraveler();
    }
  }

  const endPhase = g().phase as string;
  if (n < 4) {
    check(`N${n + 1}: ended at night-end (phase=${endPhase})`, endPhase === "night-end");
    const res = g().results;
    check(`N${n + 1}: all ${res.length} verdicts correct`, res.every((r) => r.correct));
    check(`N${n + 1}: daylight remained ≥ 0`, g().daylightLeft >= 0);
    g().nextNight();
  } else {
    check("N5: ended at epilogue", endPhase === "epilogue");
    check("N5: nights unlocked = 4", g().unlockedNights === 4);
  }
}

console.log("\n=== SPENDTHRIFT EXAMINER (Ushuaia sunset cutoff) ===");
// Ask EVERYTHING on night 5 and confirm the gate closes early (sunset) rather than breaking.
g().startGame(4);
if (g().phase === "vignette") g().continueFromVignette();
g().beginShift();
let guard2 = 0;
let sawCutoff = false;
while (g().phase === "shift" && guard2++ < 60) {
  const s = g();
  const t = NIGHTS[4].travelers[s.travelerIndex];
  if (t.special === "finale") { g().stamp("hold"); g().chooseFinale("hold"); break; }
  // burn: ask all five + press
  (["origin", "light", "sleep", "shadow", "festival", "press"] as QuestionId[]).forEach((q) => g().ask(q));
  g().stamp("entry"); // sloppy verdicts too
  if (g().phase === "reveal") g().nextTraveler();
  if ((g().phase as string) === "night-end") { sawCutoff = true; break; }
}
const ended = (g().phase as string);
check(`spendthrift: night ends gracefully (phase=${ended}, cutoff=${sawCutoff})`,
  ended === "night-end" || ended === "epilogue");
check("spendthrift: budget never negative", g().daylightLeft >= 0);

console.log(failures === 0 ? "\nPHASE-1 CHECKS PASSED ✓" : `\n${failures} PHASE-1 FAILURES ✗`);

/* ─── PHASE 2 REGRESSION: endless mode + consequences ─── */
(async () => {
console.log("\n=== ENDLESS MODE (tier A, no key) ===");
const { generateCase } = await import("../data/endless.ts");
const D = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
let mach = 0, hum = 0, lieOk = 0, total = 200;
for (let i = 0; i < total; i++) {
  const c = generateCase(i % 12, D);
  const t = c.traveler;
  if (t.kind === "machine") {
    mach++;
    if (c.lie && t.tell && t.answers[t.tell.q]) lieOk++;
  } else hum++;
  const qs = ["origin","light","sleep","shadow","festival"] as const;
  for (const q of qs) {
    const p = t.answers[q];
    if (!p || p[0].length < 10) { console.error(`  ✗ gen case missing answer ${q}`); failures++; }
  }
}
check(`200 generated: ${hum} human / ${mach} machine (40-60% split)`, mach > total*0.35 && mach < total*0.65);
check(`every machine has wired lie+tell (${lieOk}/${mach})`, lieOk === mach);

// run store flow (daily + endless engine)
const { resolveCase } = await import("./store.ts");
g().toRunBrief("endless");
check("run brief phase", g().phase === "endless-brief");
check(`directives assigned (${g().directives.length})`, g().directives.length >= 2);
g().startRun();
check("run shift started, budget set", g().phase === "endless-shift" && g().daylightTotal > 0);

// deliberately stamp WRONG until Standing depletes
let guard3 = 0;
while ((g().phase === "endless-shift" || g().phase === "endless-reveal") && guard3++ < 40) {
  if (g().phase === "endless-reveal") { g().runNext(); continue; }
  const c = g().endlessCase!;
  const sh = resolveCase(c, g().directives).shouldHold;
  g().stamp(sh ? "entry" : "hold"); // wrong on purpose
}
check(`endless ends at Standing 0 (phase=${g().phase}, standing=${g().standing})`, g().phase === "endless-over" && g().standing === 0);

// correct verdict continues + earns authority
g().toRunBrief("endless"); g().startRun();
const c2 = g().endlessCase!;
const sh2 = resolveCase(c2, g().directives).shouldHold;
g().stamp(sh2 ? "hold" : "entry"); // correct
check("correct verdict → streak 1 + reveal", g().endlessStreak === 1 && g().phase === "endless-reveal");
check(`authority earned on correct (${g().authority})`, g().authority > 0);

// daily determinism: same seed → same first traveler + directives
g().toTitle(); g().toRunBrief("daily"); g().startRun();
const dayA = { id: g().endlessCase!.traveler.id, dirs: g().directives.map((d) => d.id).join(",") };
g().toTitle(); g().toRunBrief("daily"); g().startRun();
const dayB = { id: g().endlessCase!.traveler.id, dirs: g().directives.map((d) => d.id).join(",") };
check("daily seed is deterministic (same traveler + directives)", dayA.id === dayB.id && dayA.dirs === dayB.dirs);

// resolveCase semantics with no directives
const { generateCase: gc } = await import("../data/endless.ts");
let machHold = 0, humanClear = 0;
for (let i = 0; i < 80; i++) {
  const cc = gc(0, D, 5000 + i);
  const r0 = resolveCase(cc, []);
  if (cc.traveler.kind === "machine" && r0.shouldHold) machHold++;
  if (cc.traveler.kind === "human" && !cc.ctx.paperMismatch && !r0.shouldHold) humanClear++;
}
check(`machines hold with no directives (${machHold})`, machHold > 0);
check(`compliant humans clear with no directives (${humanClear})`, humanClear > 0);

console.log("\n=== CONSEQUENCES ===");
const { consequenceFor } = await import("./store.ts");
const { NIGHTS: NN } = await import("../data/travelers.ts");
let withCons = 0, regular = 0;
for (const night of NN) for (const t of night.travelers) {
  if (t.special) continue;
  regular++;
  const wrongVerdict = t.kind === "machine" ? "entry" : "hold";
  if (consequenceFor(t, wrongVerdict as any, false)) withCons++;
  if (consequenceFor(t, wrongVerdict as any, true)) { console.error(`  ✗ ${t.id}: consequence on CORRECT verdict`); failures++; }
}
check(`all ${regular} regular travelers have a wrong-verdict consequence (${withCons})`, withCons === regular);

console.log(failures === 0 ? "\nPHASE 2 CHECKS PASSED ✓" : `\n${failures} PHASE-2 FAILURES ✗`);
process.exit(failures === 0 ? 0 : 1);
})();

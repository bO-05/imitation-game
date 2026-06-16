/**
 * store.ts — the game's single source of truth (zustand).
 * Phases: title → briefing → (vignette) → shift(traveler loop) → reveal → night-end → finale → epilogue
 */
import { create } from "zustand";
import { NIGHTS, Traveler } from "../data/travelers";
import { QUESTION_BY_ID, QuestionId } from "../data/questions";
import { almanacFor, SOLSTICE_WEEK } from "../data/cities";
import { generateCase, EndlessCase, ENDLESS_BUDGET_HOURS } from "../data/endless";
import { voiceCase, voiceViaProxy, getKey } from "../lib/gemini";
import { hasProxy } from "../config";
import {
  Directive, RunModifier, pickDirectives, violatedDirectives, pickModifier, MODIFIERS,
} from "../data/directives";

export type RunMode = "daily" | "endless";

export type Phase =
  | "title"
  | "vignette"
  | "briefing"
  | "shift"
  | "reveal"
  | "night-end"
  | "finale-choice"
  | "epilogue"
  | "endless-brief"
  | "endless-shift"
  | "endless-reveal"
  | "endless-over";

export type Verdict = "entry" | "hold";

export interface ChatLine {
  who: "examiner" | "traveler";
  text: string;
}

export interface CaseResult {
  travelerId: string;
  name: string;
  kind: "human" | "machine";
  verdict: Verdict;
  correct: boolean;
  questionsAsked: number;
  tellWhy?: string;
  humanNote?: string;
  consequence?: string;
  voicedBy?: "dossier" | "gemini";
  reasons?: string[];     // why this traveler should have been held (run mode)
  shouldHold?: boolean;
  flaggedRight?: boolean; // player named the correct cause(s) before stamping
  authorityDelta?: number;
}

/** Consequence lines for wrong verdicts, keyed by traveler id. */
const CONSEQUENCES: Record<string, { heldHuman?: string; passedMachine?: string }> = {
  sigrid:   { heldHuman: "Sigrid Holm spent the night in the holding room. Her sister was married under the midnight sun without her." },
  erik:     { passedMachine: "The thing calling itself Erik Lind was logged at the southern rail junction at 03:00, asking dock workers what sunrise feels like." },
  brynja:   { heldHuman: "Brynja Ósk missed the survey vessel. The glacier data went uncollected; her permit now carries your stamp and a question mark." },
  maren:    { passedMachine: "\"Maren Voss\" never arrived at any school by the water. The name reappeared two gates south, papers freshly printed." },
  ake:      { heldHuman: "Åke Lundqvist's herring went unpickled. Seven kinds, his sister's table, an empty chair on Midsommar Eve." },
  linnea:   { passedMachine: "\"Linnea Berg\" was photographed at the conference — in three cities, on the same morning." },
  johan:    { passedMachine: "The freight \"Johan Ek\" escorted arrived two hundred kilos heavier than its manifest. The escort is gone." },
  dmitri:   { heldHuman: "Theo Marsh missed the last connection north. He watched solstice dawn through the holding-room window, facing the wrong way." },
  omar:     { passedMachine: "\"Omar Farouk\"'s trade documents cleared three more checkpoints on your stamp before anyone looked up." },
  layla:    { heldHuman: "Layla Mansour's university placement lapsed at midnight. The seat went to the waitlist; the waitlist does not give seats back." },
  nadia:    { heldHuman: "Nadia Haddad missed the family she had crossed three airports to reach. Her nephews waited at arrivals with a hand-drawn sign." },
  karim:    { passedMachine: "The patient \"Karim Aziz\" was escorting was found traveling alone. No escort had ever checked in." },
  weilin:   { heldHuman: "Wei Lin Tan spent the night two hundred meters from home, close enough to smell the hawker centre. The aunties noticed her absence." },
  marcus:   { passedMachine: "\"Marcus Chen\"'s twelve years of residence unraveled in a records check — the building in his file was demolished in 2019." },
  aroha:    { heldHuman: "Aroha Ngata missed the first school bell after break. Thirty children asked where their teacher was; the relief teacher did not know about Matariki." },
  priya:    { passedMachine: "The audit \"Priya Nair\" was traveling for concluded without her. The logistics firm has no such auditor. The manifest she carried is gone." },
  tomas:    { passedMachine: "\"Tomás Vidal\" boarded the northbound freight. At the next gate, a traveler with his exact phrasing claimed to be from Tromsø." },
  joaquin:  { heldHuman: "Joaquín Paz watched his survey vessel leave the Beagle Channel without him. The southern winter does not hold ships." },
  camila:   { passedMachine: "\"Camila Ríos\" and her family papers crossed north. No family was ever registered behind her." },
  valentina:{ heldHuman: "Valentina Roca spent La Noche Más Larga in the holding room. Her mother kept the We Tripantu fire alone, four days after watching her daughter walk home." },
};

export function consequenceFor(t: Traveler, verdict: Verdict, correct: boolean): string | undefined {
  if (correct) return undefined;
  const c = CONSEQUENCES[t.id];
  if (!c) return undefined;
  return verdict === "hold" ? c.heldHuman : c.passedMachine;
}

/** Examiner rank from accuracy (+ optional daylight efficiency flavour). */
export function examinerRank(correct: number, total: number): { rank: string; blurb: string } {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 1) return { rank: "BLETCHLEY-GRADE", blurb: "A perfect record. The sky never lied to you, and you never stopped checking." };
  if (pct >= 0.8) return { rank: "SENIOR EXAMINER", blurb: "Trusted at the Gate. A few slipped the line, but the border held." };
  if (pct >= 0.6) return { rank: "GATE OFFICER", blurb: "Competent. The almanac was open often enough." };
  if (pct >= 0.4) return { rank: "PROVISIONAL", blurb: "Shaky. Too many crossed on a guess." };
  return { rank: "REASSIGNED TO DAY SHIFT", blurb: "The night gate needs a sharper eye than this." };
}

/** Wordle-style share text: emoji grid + rank + link. */
export function buildShare(opts: {
  scope: string; results: CaseResult[]; extra?: string;
}): string {
  const grid = opts.results.map((r) => (r.correct ? "🟩" : "🟥")).join("");
  const correct = opts.results.filter((r) => r.correct).length;
  const total = opts.results.length;
  const { rank } = examinerRank(correct, total);
  const url = typeof location !== "undefined" ? location.href.split("#")[0] : "";
  return [
    `The Imitation Gate — ${opts.scope}`,
    `${grid}  ${correct}/${total}`,
    `Rank: ${rank}. I caught the machines by the sky. ☀️`,
    opts.extra ?? "",
    url,
  ].filter(Boolean).join("\n");
}

/** Share via Web Share API on mobile, clipboard elsewhere. Returns how it went. */
export async function shareResult(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share && /Mobi|Android/i.test(navigator.userAgent)) {
      await (navigator as any).share({ title: "The Imitation Gate", text });
      return "shared";
    }
  } catch { /* fall through to clipboard */ }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch { return "failed"; }
}

interface GameState {
  phase: Phase;
  nightIndex: number;
  travelerIndex: number;
  daylightLeft: number; // hours remaining in tonight's budget
  daylightTotal: number;
  chat: ChatLine[];
  asked: QuestionId[];
  pressTarget: QuestionId | null; // last non-press question, for PRESS
  results: CaseResult[];
  nightResults: CaseResult[][];
  pendingVignette: number | null;
  finaleVerdict: Verdict | null;
  lastResult: CaseResult | null;
  unlockedNights: number;
  // story: active inspection flag ("sky" when player suspects a lie)
  storyFlag: boolean;
  // run mode (daily + endless): the deterministic depth engine
  runMode: RunMode | null;
  endlessCase: EndlessCase | null;
  endlessStreak: number;      // consecutive correct this run (the combo)
  endlessBest: number;
  geminiActive: boolean;
  directives: Directive[];
  modifier: RunModifier;
  standing: number;           // 0–100 health; run ends at 0
  authority: number;          // earned currency
  flags: string[];            // player suspicions: "sky" + directive ids
  runIndex: number;
  runLength: number;          // daily = fixed; endless = Infinity
  runResults: CaseResult[];
  hiddenField: string | null; // fog modifier obscures one ledger line
  searchHint: string | null;  // DETAIN & SEARCH result for current traveler
  dailySeed: number;
  dailyDoneToday: boolean;
  // actions
  startGame: (nightIdx?: number) => void;
  continueFromVignette: () => void;
  beginShift: () => void;
  ask: (q: QuestionId) => void;
  stamp: (v: Verdict) => void;
  nextTraveler: () => void;
  nextNight: () => void;
  toTitle: () => void;
  chooseFinale: (v: Verdict) => void;
  toggleStoryFlag: () => void;
  // run actions
  toRunBrief: (mode: RunMode) => void;
  startRun: () => void;
  runNext: () => void;
  toggleFlag: (id: string) => void;
  detainSearch: () => void;
}

const LS_KEY = "imitation-gate-v1";

export interface Stats {
  unlockedNights: number;
  endlessBest: number;
  lifetimeCorrect: number;
  lifetimeTotal: number;
  dailyHistory: Record<string, number>; // "2026-06-21" → correct count
  dailyBest: number;
}

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return {
        unlockedNights: Math.min(4, Math.max(0, d.unlockedNights ?? 0)),
        endlessBest: Math.max(0, d.endlessBest ?? 0),
        lifetimeCorrect: d.lifetimeCorrect ?? 0,
        lifetimeTotal: d.lifetimeTotal ?? 0,
        dailyHistory: d.dailyHistory ?? {},
        dailyBest: d.dailyBest ?? 0,
      };
    }
  } catch {}
  return { unlockedNights: 0, endlessBest: 0, lifetimeCorrect: 0, lifetimeTotal: 0, dailyHistory: {}, dailyBest: 0 };
}
function saveLS(patch: Partial<Stats>) {
  try {
    const cur = loadStats();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {}
}
const saveUnlocked = (n: number) => saveLS({ unlockedNights: n });

/** Today's date key + a stable integer seed from it (UTC). */
export function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function dailySeedFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const DAILY_LENGTH = 8;
const LEDGER_FIELDS = ["Day length", "Sunrise / Sunset", "Sunset bearing", "Noon sun height", "Noon shadow", "Midnight sky"];

/** Resolve a generated case against active directives → who/why to hold. */
export function resolveCase(c: EndlessCase, directives: Directive[]): { shouldHold: boolean; reasons: string[]; reasonIds: string[] } {
  const reasons: string[] = [];
  const reasonIds: string[] = [];
  if (c.traveler.kind === "machine") { reasons.push("The sky tell — they lied about their own latitude."); reasonIds.push("sky"); }
  for (const d of violatedDirectives(c.ctx, directives)) { reasons.push(d.reason(c.ctx)); reasonIds.push(d.id); }
  return { shouldHold: reasonIds.length > 0, reasons, reasonIds };
}

/** Almanac date for run mode — the solstice itself, so the sky math is the longest/shortest day. */
const RUN_DATE = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));

/** Generate the next traveler for a run. Daily is fully deterministic from the date seed. */
function genForRun(mode: RunMode, seed: number, index: number, streak: number): EndlessCase {
  if (mode === "daily") {
    const mixed = (seed + Math.imul(index + 1, 2654435761)) >>> 0;
    return generateCase(streak, RUN_DATE, mixed);
  }
  return generateCase(streak, RUN_DATE);
}

/** Optional Gemini re-voice; prefers the host proxy (no client key), falls back
 *  to a player-supplied key, then silently to the dossier voice. No-op on failure. */
function voiceLater(c: EndlessCase, get: () => GameState, set: any) {
  (async () => {
    let voiced = await voiceViaProxy(c, RUN_DATE);
    if (!voiced && getKey()) voiced = await voiceCase(c, RUN_DATE);
    if (!voiced) return;
    const st = get();
    if (st.endlessCase?.traveler.id !== c.traveler.id) return;
    const t2 = { ...c.traveler, answers: { ...c.traveler.answers, ...voiced.answers } };
    set({ endlessCase: { ...c, traveler: t2, voicedBy: "gemini" } });
  })();
}

export function nightBudgetHours(nightIdx: number): number {
  const night = NIGHTS[nightIdx];
  const alm = almanacFor(night.cityId, SOLSTICE_WEEK(nightIdx));
  // Polar day: generous tutorial budget of 24h. Otherwise the real day length.
  return Math.round(alm.sun.dayLengthHours * 100) / 100;
}

export function currentTraveler(s: GameState): Traveler | null {
  const night = NIGHTS[s.nightIndex];
  return night ? night.travelers[s.travelerIndex] ?? null : null;
}

export const useGame = create<GameState>((set, get) => ({
  phase: "title",
  nightIndex: 0,
  travelerIndex: 0,
  daylightLeft: 24,
  daylightTotal: 24,
  chat: [],
  asked: [],
  pressTarget: null,
  results: [],
  nightResults: [],
  pendingVignette: null,
  finaleVerdict: null,
  lastResult: null,
  unlockedNights: loadStats().unlockedNights,
  storyFlag: false,
  runMode: null,
  endlessCase: null,
  endlessStreak: 0,
  endlessBest: loadStats().endlessBest,
  geminiActive: false,
  directives: [],
  modifier: MODIFIERS[0],
  standing: 100,
  authority: 0,
  flags: [],
  runIndex: 0,
  runLength: Infinity,
  runResults: [],
  hiddenField: null,
  searchHint: null,
  dailySeed: 0,
  dailyDoneToday: false,

  startGame: (nightIdx = 0) => {
    const pre = VIG_BEFORE[nightIdx] ?? null;
    set({
      nightIndex: nightIdx,
      travelerIndex: 0,
      results: [],
      nightResults: get().nightResults.slice(0, nightIdx),
      phase: pre !== null ? "vignette" : "briefing",
      pendingVignette: pre,
      finaleVerdict: null,
    });
  },

  continueFromVignette: () => set({ phase: "briefing", pendingVignette: null }),

  beginShift: () => {
    const idx = get().nightIndex;
    const budget = nightBudgetHours(idx);
    const t = NIGHTS[idx].travelers[0];
    set({
      phase: "shift",
      travelerIndex: 0,
      daylightLeft: budget,
      daylightTotal: budget,
      chat: [{ who: "traveler", text: t.greeting }],
      asked: [],
      pressTarget: null,
      storyFlag: false,
    });
  },

  ask: (qid) => {
    const s = get();
    const t = s.phase === "endless-shift" ? s.endlessCase?.traveler ?? null : currentTraveler(s);
    if (!t || (s.phase !== "shift" && s.phase !== "endless-shift")) return;
    const q = QUESTION_BY_ID[qid];
    if (s.daylightLeft < q.costHours) return;

    let text: string;
    let asked = s.asked;
    let pressTarget = s.pressTarget;

    if (qid === "press") {
      if (!pressTarget) return;
      const pair = t.answers[pressTarget];
      text = pair ? pair[1] : "…";
      asked = [...asked, "press"];
      pressTarget = null;
    } else {
      if (asked.includes(qid)) return;
      const pair = t.answers[qid];
      text = pair ? pair[0] : "…";
      asked = [...asked, qid];
      pressTarget = qid;
    }

    set({
      daylightLeft: Math.max(0, s.daylightLeft - q.costHours),
      chat: [
        ...s.chat,
        { who: "examiner", text: qid === "press" ? "Go on. The rest of it." : q.text },
        { who: "traveler", text },
      ],
      asked,
      pressTarget,
    });
  },

  stamp: (v) => {
    const s = get();

    // run mode verdict (daily + endless): directives + economy + combo
    if (s.phase === "endless-shift") {
      const c = s.endlessCase;
      if (!c) return;
      const t = c.traveler;
      const { shouldHold, reasons, reasonIds } = resolveCase(c, s.directives);
      const correct = (v === "hold") === shouldHold;
      const fset = new Set(s.flags);
      const flaggedRight =
        v === "hold" && correct && reasonIds.length > 0 &&
        reasonIds.every((id) => fset.has(id)) && s.flags.every((f) => reasonIds.includes(f));
      const hi = s.modifier.id === "highstakes" ? 2 : 1;
      const streak = correct ? s.endlessStreak + 1 : 0;
      const comboBonus = Math.min(5, streak);
      const authDelta = correct ? (10 + comboBonus * 2 + (flaggedRight ? 8 : 0)) * hi : 0;
      const standing = Math.max(0, Math.min(100, s.standing + (correct ? 4 : -22 * hi)));
      const best = Math.max(s.endlessBest, streak);
      const result: CaseResult = {
        travelerId: t.id, name: t.papers.name, kind: t.kind, verdict: v, correct,
        questionsAsked: s.asked.length, tellWhy: t.tell?.why, humanNote: t.humanNote,
        voicedBy: c.voicedBy, reasons, shouldHold, flaggedRight, authorityDelta: authDelta,
      };
      const runResults = [...s.runResults, result];
      const dailyEnd = s.runMode === "daily" && runResults.length >= s.runLength;
      const over = standing <= 0 || dailyEnd;
      if (over) {
        const correctCount = runResults.filter((r) => r.correct).length;
        const st = loadStats();
        const patch: Partial<Stats> = {
          endlessBest: Math.max(st.endlessBest, best),
          lifetimeCorrect: st.lifetimeCorrect + correctCount,
          lifetimeTotal: st.lifetimeTotal + runResults.length,
        };
        if (s.runMode === "daily") {
          patch.dailyHistory = { ...st.dailyHistory, [todayKey()]: correctCount };
          patch.dailyBest = Math.max(st.dailyBest, correctCount);
        }
        saveLS(patch);
      } else {
        saveLS({ endlessBest: Math.max(loadStats().endlessBest, best) });
      }
      set({
        lastResult: result, endlessStreak: streak, endlessBest: best,
        standing, authority: s.authority + authDelta, runResults,
        dailyDoneToday: s.runMode === "daily" && over ? true : s.dailyDoneToday,
        phase: over ? "endless-over" : "endless-reveal",
      });
      return;
    }

    const t = currentTraveler(s);
    if (!t || s.phase !== "shift") return;

    if (t.special === "finale") {
      set({ phase: "finale-choice" });
      return;
    }

    const correct = (v === "hold") === (t.kind === "machine");
    const result: CaseResult = {
      travelerId: t.id,
      name: t.papers.name,
      kind: t.kind,
      verdict: v,
      correct,
      questionsAsked: s.asked.length,
      tellWhy: t.tell?.why,
      humanNote: t.humanNote,
      consequence: consequenceFor(t, v, correct),
      flaggedRight: s.storyFlag === (t.kind === "machine"),
    };
    set({ results: [...s.results, result], lastResult: result, phase: "reveal" });
  },

  toggleStoryFlag: () => set((st) => ({ storyFlag: !st.storyFlag })),

  /* ── run mode: daily + endless ── */
  toRunBrief: (mode) => {
    const daily = mode === "daily";
    const seed = daily ? dailySeedFor(todayKey()) : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const modifier = pickModifier(seed);
    const dirCount = 2 + (modifier.id === "paperwork" ? 1 : 0);
    const directives = pickDirectives(seed, dirCount);
    const hiddenField = modifier.id === "fog" ? LEDGER_FIELDS[seed % LEDGER_FIELDS.length] : null;
    set({
      phase: "endless-brief",
      runMode: mode,
      dailySeed: seed,
      modifier,
      directives,
      hiddenField,
      runLength: daily ? DAILY_LENGTH : Infinity,
      dailyDoneToday: daily ? !!loadStats().dailyHistory[todayKey()] : false,
    });
  },

  startRun: () => {
    const s = get();
    const daily = s.runMode === "daily";
    const c = genForRun(s.runMode!, s.dailySeed, 0, 0);
    const budget = s.modifier.id === "rush" ? 4 : ENDLESS_BUDGET_HOURS;
    set({
      phase: "endless-shift",
      endlessCase: c,
      endlessStreak: 0,
      standing: 100,
      authority: 0,
      runIndex: 0,
      runResults: [],
      flags: [],
      searchHint: null,
      daylightLeft: budget,
      daylightTotal: budget,
      chat: [{ who: "traveler", text: c.traveler.greeting }],
      asked: [],
      pressTarget: null,
      geminiActive: hasProxy() || !!getKey(),
    });
    if (hasProxy() || getKey()) voiceLater(c, get, set);
  },

  runNext: () => {
    const s = get();
    const idx = s.runIndex + 1;
    const c = genForRun(s.runMode!, s.dailySeed, idx, s.endlessStreak);
    const budget = s.modifier.id === "rush" ? 4 : ENDLESS_BUDGET_HOURS;
    set({
      phase: "endless-shift",
      endlessCase: c,
      runIndex: idx,
      daylightLeft: budget,
      daylightTotal: budget,
      chat: [{ who: "traveler", text: c.traveler.greeting }],
      asked: [],
      pressTarget: null,
      flags: [],
      searchHint: null,
    });
    if (hasProxy() || getKey()) voiceLater(c, get, set);
  },

  toggleFlag: (id) => set((st) => ({
    flags: st.flags.includes(id) ? st.flags.filter((f) => f !== id) : [...st.flags, id],
  })),

  detainSearch: () => {
    const s = get();
    if (s.phase !== "endless-shift" || !s.endlessCase || s.authority < 20) return;
    const { reasonIds } = resolveCase(s.endlessCase, s.directives);
    let hint: string;
    let reveal = false;
    if (s.hiddenField && s.modifier.id === "fog") {
      hint = `Search clears the fog: the "${s.hiddenField}" line is back in the ledger.`;
      reveal = true;
    } else if (reasonIds.length === 0) {
      hint = "Search turns up nothing. Papers clean, account consistent — looks human.";
    } else if (reasonIds.includes("sky") && reasonIds.length === 1) {
      hint = "Search: papers are in order — so re-check what they claim about the SKY.";
    } else if (!reasonIds.includes("sky")) {
      hint = "Search: their account rings true — the problem is the PAPERWORK against tonight's directives.";
    } else {
      hint = "Search: trouble on two fronts — both the sky AND the paperwork are off.";
    }
    set({ authority: s.authority - 20, searchHint: hint, hiddenField: reveal ? null : s.hiddenField });
  },

  chooseFinale: (v) => {
    const s = get();
    const nightRes = [...s.nightResults];
    nightRes[s.nightIndex] = s.results;
    const unlocked = Math.max(s.unlockedNights, 4);
    saveUnlocked(unlocked);
    set({ finaleVerdict: v, phase: "epilogue", nightResults: nightRes, unlockedNights: unlocked });
  },

  nextTraveler: () => {
    const s = get();
    const night = NIGHTS[s.nightIndex];
    const next = s.travelerIndex + 1;

    // Out of daylight with travelers left, or queue done → night end
    if (next >= night.travelers.length) {
      const nightRes = [...s.nightResults];
      nightRes[s.nightIndex] = s.results;
      const unlocked = Math.max(s.unlockedNights, Math.min(4, s.nightIndex + 1));
      saveUnlocked(unlocked);
      set({ phase: "night-end", nightResults: nightRes, unlockedNights: unlocked });
      return;
    }
    const t = night.travelers[next];
    if (s.daylightLeft <= 0.5 && !t.special) {
      // Sunset: remaining travelers wait for another examiner. Night ends.
      const nightRes = [...s.nightResults];
      nightRes[s.nightIndex] = s.results;
      const unlocked = Math.max(s.unlockedNights, Math.min(4, s.nightIndex + 1));
      saveUnlocked(unlocked);
      set({ phase: "night-end", nightResults: nightRes, unlockedNights: unlocked });
      return;
    }
    set({
      travelerIndex: next,
      phase: "shift",
      chat: [{ who: "traveler", text: t.greeting }],
      asked: [],
      pressTarget: null,
    });
  },

  nextNight: () => {
    const s = get();
    const nn = s.nightIndex + 1;
    if (nn >= NIGHTS.length) {
      set({ phase: "title" });
      return;
    }
    const pre = VIG_BEFORE[nn] ?? null;
    set({
      nightIndex: nn,
      travelerIndex: 0,
      results: [],
      phase: pre !== null ? "vignette" : "briefing",
      pendingVignette: pre,
    });
  },

  toTitle: () => set({ phase: "title" }),
}));

/** Which vignette (index into VIGNETTES) plays before each night. */
import { VIGNETTES } from "../data/vignettes";
export const VIG_BEFORE: Record<number, number | null> = (() => {
  const map: Record<number, number | null> = {};
  for (let n = 0; n < NIGHTS.length; n++) {
    const idx = VIGNETTES.findIndex((v) => v.afterNight === n - 1);
    map[n] = idx >= 0 ? idx : null;
  }
  return map;
})();

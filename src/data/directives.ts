/**
 * directives.ts — THE RULEBOOK ENGINE.
 * Turns the binary (human vs machine) into a layered judgment: each night the
 * Gate posts directives that also force HOLD. The verdict becomes a cross-check
 * of the sky (is the traveler lying?) AND the paperwork (do they break a rule?).
 * Everything is deterministic and checkable from visible info — no AI involved.
 */

export interface DirectiveCtx {
  hemisphere: "N" | "S";
  polarDay: boolean;     // origin is a midnight-sun latitude this week
  issuedDay: number;     // day of June the permit was issued (1–30)
  purpose: string;
  paperMismatch: boolean; // papers and spoken origin disagree
  cityId: string;
}

export interface Directive {
  id: string;
  group: string;         // mutually-exclusive group key ("" = standalone)
  label: string;         // full text on the directive board
  short: string;         // chip label for flagging
  violated: (c: DirectiveCtx) => boolean;
  reason: (c: DirectiveCtx) => string;
}

export const ALL_DIRECTIVES: Directive[] = [
  {
    id: "permit15", group: "permit",
    label: "Entry permits issued after 15 June are void tonight.",
    short: "Permit ≤ Jun 15",
    violated: (c) => c.issuedDay > 15,
    reason: (c) => `Permit issued ${c.issuedDay} June — past the 15 June cutoff.`,
  },
  {
    id: "permit12", group: "permit",
    label: "Only permits issued on or before 12 June are valid tonight.",
    short: "Permit ≤ Jun 12",
    violated: (c) => c.issuedDay > 12,
    reason: (c) => `Permit issued ${c.issuedDay} June — past the 12 June cutoff.`,
  },
  {
    id: "noSeasonal", group: "purpose",
    label: "Seasonal-work crossings are suspended tonight.",
    short: "No seasonal work",
    violated: (c) => /seasonal/i.test(c.purpose),
    reason: () => "Purpose is seasonal work — suspended tonight.",
  },
  {
    id: "noFreight", group: "purpose",
    label: "Freight and trade escorts are barred tonight.",
    short: "No freight/trade",
    violated: (c) => /freight|trade|logistics/i.test(c.purpose),
    reason: () => "Purpose is freight/trade — barred tonight.",
  },
  {
    id: "holdSouth", group: "hemi",
    label: "Southern-hemisphere crossings are closed tonight.",
    short: "Hold S. hemisphere",
    violated: (c) => c.hemisphere === "S",
    reason: () => "Origin is in the southern hemisphere.",
  },
  {
    id: "holdNorth", group: "hemi",
    label: "Northern-hemisphere crossings are closed tonight.",
    short: "Hold N. hemisphere",
    violated: (c) => c.hemisphere === "N",
    reason: () => "Origin is in the northern hemisphere.",
  },
  {
    id: "polarPass", group: "",
    label: "Midnight-sun latitudes require a polar pass (none are being issued).",
    short: "Polar pass req'd",
    violated: (c) => c.polarDay,
    reason: () => "From a midnight-sun latitude, with no polar pass.",
  },
  {
    id: "docMatch", group: "",
    label: "Papers must match the traveler's own account — hold any discrepancy.",
    short: "Docs must match",
    violated: (c) => c.paperMismatch,
    reason: () => "Papers and spoken origin disagree.",
  },
];

const DIR_BY_ID = Object.fromEntries(ALL_DIRECTIVES.map((d) => [d.id, d]));
export const directiveById = (id: string) => DIR_BY_ID[id];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically pick `count` directives for a seed, never choosing two from
 * the same mutually-exclusive group (so the set is always satisfiable).
 */
export function pickDirectives(seed: number, count: number): Directive[] {
  const r = mulberry(seed ^ 0x9e3779b9);
  const pool = [...ALL_DIRECTIVES];
  // Fisher–Yates with the seeded RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen: Directive[] = [];
  const usedGroups = new Set<string>();
  for (const d of pool) {
    if (chosen.length >= count) break;
    if (d.group && usedGroups.has(d.group)) continue;
    if (d.group) usedGroups.add(d.group);
    chosen.push(d);
  }
  return chosen;
}

export function violatedDirectives(ctx: DirectiveCtx, dirs: Directive[]): Directive[] {
  return dirs.filter((d) => d.violated(ctx));
}

/* ── Roguelike run modifiers (Long Shift) ───────────────────────────── */

export interface RunModifier {
  id: string;
  label: string;
  desc: string;
}

export const MODIFIERS: RunModifier[] = [
  { id: "none", label: "STANDARD SHIFT", desc: "No special conditions tonight." },
  { id: "rush", label: "BORDER RUSH", desc: "Less daylight per traveler — decide faster." },
  { id: "paperwork", label: "HEAVY PAPERWORK", desc: "An extra directive is in force." },
  { id: "highstakes", label: "HIGH STAKES", desc: "Wrong calls cost double standing; correct calls pay double Authority." },
  { id: "fog", label: "FOG OVER THE LEDGER", desc: "One almanac field is obscured tonight — trust what you can." },
];

export function pickModifier(seed: number): RunModifier {
  const r = mulberry(seed ^ 0x51ed270b);
  // 45% standard, else one of the four conditions
  if (r() < 0.45) return MODIFIERS[0];
  const rest = MODIFIERS.slice(1);
  return rest[Math.floor(r() * rest.length)];
}

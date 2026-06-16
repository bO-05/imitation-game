/**
 * endless.ts — THE LONG SHIFT (endless mode), tier A: procedural travelers.
 * Every traveler is compiled from persona templates + the solar engine.
 * Machines get exactly one seeded lie that contradicts the computed almanac;
 * humans are correct everywhere — including the trap-truths (Reykjavik's brief
 * sunset, Matariki in July, Singapore's nine minutes).
 * No network, no key, no server. Tier B (gemini.ts) only re-voices these.
 */
import type { Traveler } from "./travelers";
import type { QuestionId } from "./questions";
import { CITIES, almanacFor, AlmanacEntry } from "./cities";
import { fmtTime } from "../lib/solar";
import type { DirectiveCtx } from "./directives";

export interface EndlessCase {
  traveler: Traveler;
  cityId: string;
  voicedBy: "dossier" | "gemini";
  /** machine only: the seeded lie, machine-readable, for Gemini + reveal */
  lie?: { q: QuestionId; claim: string; truth: string };
  /** rulebook context — lets the directive engine judge paperwork too */
  ctx: DirectiveCtx;
}

const NAMES: Record<string, string[]> = {
  tromso: ["Nils Berge", "Ingrid Sand", "Ola Vik", "Kari Moen"],
  reykjavik: ["Gunnar Páll", "Helga Rún", "Jón Stefán", "Eva Lind"],
  stockholm: ["Per Nyström", "Anna Sjö", "Lars Holm", "Sara Ek"],
  london: ["James Carter", "Priya Shah", "Tom Whitfield", "Grace Adeyemi"],
  cairo: ["Hassan Tarek", "Mona Said", "Youssef Adel", "Dina Fawzy"],
  singapore: ["Daniel Lim", "Mei Hua Ong", "Arjun Pillai", "Siti Rahman"],
  sydney: ["Jack O'Brien", "Chloe Nguyen", "Liam Walker", "Ruby Chen"],
  ushuaia: ["Martín Soto", "Lucía Bravo", "Diego Funes", "Paula Vera"],
  christchurch: ["Sam Te Rangi", "Emma Clarke", "Nikau Walker", "Holly James"],
};

const PURPOSES = [
  "Seasonal work contract, crossing over.",
  "Family visit on the far side.",
  "Returning home before the turn of the year.",
  "Research transfer with sealed equipment.",
  "Trade papers for the southern route.",
  "Festival travel, round trip.",
];

const LOCAL: Record<string, string[]> = {
  tromso: ["The bridge hums in a north wind; everyone pretends not to hear it.", "Tourists photograph the cathedral; locals photograph the tourists."],
  reykjavik: ["Half the town is in a band; the other half runs the venues.", "The swimming pools are the real parliament."],
  stockholm: ["The archipelago empties the city every June weekend.", "We queue politely even for the queue."],
  london: ["The pubs spill onto the pavement at six like clockwork.", "Everyone complains about the line that's actually fine: it's the Central line that's the problem."],
  cairo: ["The city is never silent — a kettle, a radio, a football argument at 4am.", "Distance is measured in traffic, not kilometers."],
  singapore: ["You walk from aircon to aircon like stepping stones.", "The hawker queue is the only honest restaurant review."],
  sydney: ["The city believes it has no winter and acts betrayed every June.", "The surf report gets checked all winter; nobody acts on it till September."],
  ushuaia: ["Everything in town is up a hill from the port.", "Antarctica boards here; we stay."],
  christchurch: ["The city is flat as a table; the Port Hills sit on the horizon like a promise.", "Every rebuild scar has a story and a coffee shop."],
};

/* ── truth banks, computed from the almanac ────────────────────────── */

function lightTruth(a: AlmanacEntry): [string, string] {
  const s = a.sun;
  switch (s.midnightSky) {
    case "midnight-sun":
      return [
        "There's no night to speak of — the sun circles, drops low to the north around midnight, never touches the horizon.",
        "It hasn't set in weeks. You stop saying 'tonight' and start saying 'later'.",
      ];
    case "bright-night":
      return [
        `The sun does set — barely. Slips under around ${fmtTime(s.sunsetLocal)} and it's back before you've noticed. Never gets darker than a glow.`,
        "You can read outside at two in the morning. 'Night' is a courtesy term.",
      ];
    case "white-night":
      return [
        `Sunset's about ${fmtTime(s.sunsetLocal)}, but the sky never goes black — pale grey-lilac all night. No stars this month.`,
        "The midnight sky just... waits. You don't see stars again until August.",
      ];
    case "deep-twilight":
      return [
        `Long evenings — sun's down around ${fmtTime(s.sunsetLocal)} and the dusk hangs about for hours. Never gets properly black.`,
        "The astronomers moan about it — no real darkness for the telescopes this month.",
      ];
    case "true-night":
      return [
        `About ${Math.round(s.dayLengthHours)} hours of light; sun's down around ${fmtTime(s.sunsetLocal)} and then it's real night, stars and all.`,
        "Proper darkness, on schedule. The sky still works where I live.",
      ];
  }
}

function sleepTruth(a: AlmanacEntry): [string, string] {
  switch (a.sun.midnightSky) {
    case "midnight-sun":
      return ["Badly — blackout curtains, foil on the windows. You sleep against the light or not at all.", "June insomnia. We all have it; we all pretend we don't."];
    case "bright-night":
    case "white-night":
      return ["With an eye mask I get mocked for. The light leaks in at the edges of everything.", "Thin sleep. You bank the light for winter and pay in rest."];
    case "deep-twilight":
      return ["Fine once the blinds are down — the dusk lingers but it does fade.", "The blackbirds start at four. That's the real alarm."];
    case "true-night":
      return [
        a.city.hemisphere === "S"
          ? "Long and early — winter herds you to bed. The dark is generous this month."
          : "Normally. Dark arrives on schedule where I'm from.",
        "No tricks needed. The night does its job.",
      ];
  }
}

function shadowTruth(a: AlmanacEntry): [string, string] {
  const s = a.sun;
  if (s.noonShadow === "zenith") return ["Almost nothing at noon — the sun's nearly overhead. A coin of shade at your feet.", "You'd have to lie down to cast anything worth the name."];
  const dir = s.noonShadow.toUpperCase();
  const long = s.noonAltitude < 35;
  return [
    long
      ? `${dir}, and long — the sun never gets above ${Math.round(s.noonAltitude)}° here this month. It comes at you sideways.`
      : `${dir} at noon, fairly short — the sun stands about ${Math.round(s.noonAltitude)}° up this week.`,
    s.noonShadow === "south"
      ? "The sun keeps to the NORTH side of the sky here in June. Picture-book suns are drawn on the wrong side for us."
      : "Sun's in the south at midday, like every June here.",
  ];
}

function festivalTruth(a: AlmanacEntry): [string, string] {
  return [
    `This month? ${a.city.festivals[0]}.`,
    a.city.festivals[1] ? `And ${a.city.festivals[1]}. The calendar keeps us honest.` : "Small month otherwise. The light is the festival.",
  ];
}

/* ── lie banks: one seeded contradiction of the almanac ────────────── */

interface LieSpec { q: QuestionId; claim: string; truth: string; answers: [string, string]; minStreak: number; }

function liesFor(a: AlmanacEntry): LieSpec[] {
  const s = a.sun;
  const out: LieSpec[] = [];
  if (s.midnightSky === "midnight-sun") {
    out.push({
      q: "light", minStreak: 0,
      claim: "watched the sunset last night",
      truth: "the sun does not set there this week at all",
      answers: ["Lovely week — I watched the sunset over the water last night, around ten. Long amber dusk after.", "Quarter past ten, maybe. The street lamps came on after."],
    });
    out.push({
      q: "sleep", minStreak: 3,
      claim: "sleeps in deep dark nights",
      truth: "there is no darkness at all under the midnight sun",
      answers: ["Wonderfully. The nights are deep and black this time of year — the dark just takes you down.", "Ten hours, sometimes. Best sleep of the year."],
    });
  }
  if (s.midnightSky === "white-night" || s.midnightSky === "bright-night") {
    out.push({
      q: "light", minStreak: 0,
      claim: "saw a sky full of stars at midnight",
      truth: "the June sky there never darkens enough for stars",
      answers: ["Beautiful — sat out past midnight and the stars were everywhere, the whole sweep of them.", "Cassiopeia, the Plough, all of it. Very still night."],
    });
  }
  if (s.midnightSky === "deep-twilight") {
    out.push({
      q: "light", minStreak: 7,
      claim: "pitch black by eleven",
      truth: "the sky there never reaches full darkness in June — deep twilight at best",
      answers: ["Sun's down past nine, and by eleven it's pitch black — proper full dark, stars wall to wall.", "Black as January by midnight. The summer doesn't change that."],
    });
  }
  if (a.city.id === "singapore") {
    out.push({
      q: "light", minStreak: 0,
      claim: "long June evenings, sunset near nine",
      truth: "day length there varies ~9 minutes all year; sunset is ~19:10 every day",
      answers: ["These long June evenings are the best of it — sunset close to nine, gold light over the strait for hours.", "Enjoy them while the solstice gives them; they shorten soon enough."],
    });
    out.push({
      q: "festival", minStreak: 5,
      claim: "celebrating the longest day this week",
      truth: "at one degree latitude there is no meaningful longest day",
      answers: ["The longest-day celebrations, of course — the whole island makes a week of it.", "Lantern walks for the late sunset. June is our big light month."],
    });
  }
  if (a.city.hemisphere === "S") {
    out.push({
      q: "light", minStreak: 0,
      claim: "long summer evenings right now",
      truth: "June is midwinter there — among the SHORTEST days of the year",
      answers: ["Glorious and long — barbecues running past nine while the sun hangs about. Best month of the year.", "The evenings stretch forever this time of year. You lose track of the hour."],
    });
    out.push({
      q: "shadow", minStreak: 3,
      claim: "noon shadow points north",
      truth: "southern-hemisphere noon shadows in June point SOUTH (sun due north)",
      answers: ["North at noon — sun's behind you to the south at midday, throws it forward. Basic as bread.", "Same as anywhere. Sun south, shadow north."],
    });
  }
  if (a.city.id === "christchurch") {
    out.push({
      q: "festival", minStreak: 5,
      claim: "Matariki on the solstice, June 21",
      truth: "Matariki follows the Pleiades' rising — the 2026 holiday is JULY 10",
      answers: ["Matariki, of course — the Māori new year, right on the solstice. June twenty-first, the fires and the kai.", "Every year on the twenty-first. Solstice and Matariki, same night."],
    });
  }
  if (a.city.id === "stockholm") {
    out.push({
      q: "festival", minStreak: 3,
      claim: "Midsommar on the last weekend of June",
      truth: "Midsommar Eve 2026 is Friday, June 19 — fixed to the Friday between June 19–25",
      answers: ["Midsommar — we hold it the last weekend of the month, the twenty-seventh this year. Big family do at the lake.", "Always the last Saturday of June. Tradition's tradition."],
    });
  }
  if (a.city.id === "cairo") {
    out.push({
      q: "festival", minStreak: 5,
      claim: "Sham el-Nessim this month",
      truth: "Sham el-Nessim is a SPRING festival (April), not June",
      answers: ["Sham el-Nessim, naturally — the whole city out on the grass with fesikh and onions. June's great picnic.", "Mid-June, every year. The river parks are packed for it."],
    });
  }
  if (a.city.hemisphere === "N" && s.midnightSky !== "true-night" && a.city.id !== "singapore") {
    out.push({
      q: "shadow", minStreak: 7,
      claim: "noon shadow points south",
      truth: "northern noon shadows point NORTH (sun due south at midday)",
      answers: ["South at noon — sun's north of us at midday this time of year, surely.", "South, short. High-summer geometry."],
    });
  }
  return out;
}

/* ── generator ─────────────────────────────────────────────────────── */

let counter = Math.floor(Math.random() * 1e6);
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];

export function generateCase(streak: number, date: Date, seedOverride?: number): EndlessCase {
  const seed = (seedOverride !== undefined ? seedOverride : (Date.now() ^ (counter++ * 2654435761))) >>> 0;
  const r = rng(seed);
  const cityIds = Object.keys(CITIES);
  const cityId = pick(r, cityIds);
  const alm = almanacFor(cityId, date);
  const isMachine = r() < 0.5;
  const name = pick(r, NAMES[cityId]);
  const purpose = pick(r, PURPOSES);
  const local = pick(r, LOCAL[cityId]);
  const issuedDay = Math.max(1, 17 - Math.floor(r() * 12)); // 6–17 June
  // Plant a papers-vs-account discrepancy on some HUMANS so the "docs must
  // match" directive can legitimately require holding a real person.
  const paperMismatch = !isMachine && r() < 0.16;
  const otherCity = paperMismatch ? pick(r, cityIds.filter((c) => c !== cityId)) : null;

  const truths: Record<QuestionId, [string, string]> = {
    origin: [`${alm.city.name}. True thing: ${local}`, "You want more, ask more. The queue's long and the truth is short."],
    light: lightTruth(alm),
    sleep: sleepTruth(alm),
    shadow: shadowTruth(alm),
    festival: festivalTruth(alm),
    press: ["…", "…"],
  };
  if (paperMismatch && otherCity) {
    truths.origin = [
      `Well — my permit says ${alm.city.name}, but honestly I was raised in ${CITIES[otherCity].name}. "Home" is a loose word for me.`,
      `Both places, if you're pressing. The papers say one; I say another.`,
    ];
  }

  let lie: EndlessCase["lie"];
  let tellQ: QuestionId | undefined;
  const answers: Partial<Record<QuestionId, [string, string]>> = {
    origin: truths.origin, light: truths.light, sleep: truths.sleep,
    shadow: truths.shadow, festival: truths.festival,
  };

  if (isMachine) {
    const candidates = liesFor(alm).filter((l) => streak >= l.minStreak);
    const chosen = candidates.length ? pick(r, candidates) : liesFor(alm)[0];
    answers[chosen.q] = chosen.answers;
    tellQ = chosen.q;
    lie = { q: chosen.q, claim: chosen.claim, truth: chosen.truth };
  }

  const greetings = [
    "Evening, officer. Cold hands, honest papers.",
    "Good evening. I hope the queue's been kind.",
    "Evening. Let's be quick — the light won't wait.",
    "Officer. Papers are in order, I think.",
  ];

  const traveler: Traveler = {
    id: `gen-${seed.toString(36)}`,
    kind: isMachine ? "machine" : "human",
    seed,
    papers: {
      name,
      origin: cityId,
      purpose,
      issued: `${issuedDay} June 2026`,
      note: r() < 0.25 ? pick(r, ["Corner of the permit is rain-blistered.", "Ink slightly smeared at the signature.", "Photo corner peeling.", "Stamp is fresh — barely dry."]) : undefined,
    },
    greeting: pick(r, greetings),
    answers,
    tell: isMachine && lie
      ? { q: tellQ!, why: `Claimed: ${lie.claim}. The LEDGER: ${lie.truth}. The rest of the dossier was clean — the sky wasn't.` }
      : undefined,
    humanNote: !isMachine
      ? "Every claim survives the ledger — day length, sky, shadow, calendar. Strange is not the same as false."
      : undefined,
  };

  const ctx: DirectiveCtx = {
    hemisphere: alm.city.hemisphere,
    polarDay: alm.sun.polarDay,
    issuedDay,
    purpose,
    paperMismatch,
    cityId,
  };

  return { traveler, cityId, voicedBy: "dossier", lie, ctx };
}

export const ENDLESS_BUDGET_HOURS = 6;
export const ENDLESS_STRIKES = 3;

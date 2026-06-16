/**
 * cities.ts — the gate's ports of call and the Daylight Ledger (almanac).
 * Every almanac line is generated from the solar engine at runtime, so the
 * rulebook the player reads is computed truth, not copy.
 */
import { sunDay, fmtDayLength, fmtTime, compass, SunDay } from "../lib/solar";

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  tz: number; // clock offset hours
  hemisphere: "N" | "S";
  flavor: string; // one-line dossier flavor
  festivals: string[]; // verified June-window notes
}

export const CITIES: Record<string, City> = {
  tromso: {
    id: "tromso", name: "Tromsø", country: "Norway",
    lat: 69.65, lon: 18.96, tz: 2, hemisphere: "N",
    flavor: "Arctic harbor above 69°N. The sun has not touched the horizon since mid-May.",
    festivals: ["Midnight Sun Marathon (late June)", "St. Hans bonfires (June 23, weather permitting)"],
  },
  reykjavik: {
    id: "reykjavik", name: "Reykjavik", country: "Iceland",
    lat: 64.15, lon: -21.94, tz: 0, hemisphere: "N",
    flavor: "Just south of the Arctic Circle. The sun dips, the dark never comes.",
    festivals: ["Secret Solstice gatherings", "Jónsmessa (June 24) — folklore night"],
  },
  stockholm: {
    id: "stockholm", name: "Stockholm", country: "Sweden",
    lat: 59.33, lon: 18.07, tz: 2, hemisphere: "N",
    flavor: "White nights. The sky goes pale, never black. No stars in June.",
    festivals: ["Midsommar (Friday Jun 19, 2026) — maypoles, herring, the year's biggest holiday"],
  },
  london: {
    id: "london", name: "London", country: "United Kingdom",
    lat: 51.51, lon: -0.13, tz: 1, hemisphere: "N",
    flavor: "Long evenings, late dusk. True darkness never arrives in June.",
    festivals: ["Summer solstice at Stonehenge (Jun 20–21)", "Pride month events citywide"],
  },
  cairo: {
    id: "cairo", name: "Cairo", country: "Egypt",
    lat: 30.04, lon: 31.24, tz: 3, hemisphere: "N",
    flavor: "Subtropical. Noon sun near the zenith; real night returns after a 14-hour day.",
    festivals: ["No major June festival; Sham el-Nessim falls in SPRING (April), not June"],
  },
  singapore: {
    id: "singapore", name: "Singapore", country: "Singapore",
    lat: 1.35, lon: 103.82, tz: 8, hemisphere: "N",
    flavor: "One degree north. Day length is a flat line: ~12h every day of every year.",
    festivals: ["June school holidays", "Hari Raya Haji fell in late May 2026"],
  },
  sydney: {
    id: "sydney", name: "Sydney", country: "Australia",
    lat: -33.87, lon: 151.21, tz: 10, hemisphere: "S",
    flavor: "Southern winter. June 21 is the SHORTEST day. The noon sun hangs low in the NORTH.",
    festivals: ["Winter solstice fire festivals", "Vivid Sydney light festival (through mid-June)"],
  },
  ushuaia: {
    id: "ushuaia", name: "Ushuaia", country: "Argentina",
    lat: -54.8, lon: -68.3, tz: -3, hemisphere: "S",
    flavor: "The end of the world. Seven hours of low sun, then the long dark.",
    festivals: ["Fiesta de la Noche Más Larga (longest-night festival)", "We Tripantu — Mapuche new year, fires on Jun 23–24"],
  },
  christchurch: {
    id: "christchurch", name: "Christchurch", country: "New Zealand",
    lat: -43.53, lon: 172.64, tz: 12, hemisphere: "S",
    flavor: "Southern winter. Matariki (Pleiades) new year is a winter observance — in 2026 the holiday falls on JULY 10, not the solstice.",
    festivals: ["Matariki 2026: public holiday July 10 (varies with the star cluster's rising)"],
  },
};

/** The five nights of story mode: the Gate descends the globe. */
export const NIGHT_CITIES = ["tromso", "stockholm", "cairo", "singapore", "ushuaia"] as const;

export const SOLSTICE_WEEK = (n: number) =>
  new Date(Date.UTC(2026, 5, 17 + n, 12, 0, 0)); // June 17 + n

export interface AlmanacEntry {
  city: City;
  sun: SunDay;
  lines: { k: string; v: string }[];
}

const SKY_LABEL: Record<SunDay["midnightSky"], string> = {
  "midnight-sun": "MIDNIGHT SUN — the sun is above the horizon all night",
  "bright-night": "BRIGHT NIGHT — sun barely dips; never darker than civil twilight",
  "white-night": "WHITE NIGHT — pale sky all night; NO STARS visible",
  "deep-twilight": "DEEP TWILIGHT — dusky midnight; only bright stars",
  "true-night": "TRUE NIGHT — full darkness; stars out",
};

export function almanacFor(cityId: string, date: Date): AlmanacEntry {
  const city = CITIES[cityId];
  const sun = sunDay(city.lat, city.lon, date, city.tz);
  const lines: { k: string; v: string }[] = [
    { k: "Day length", v: fmtDayLength(sun.dayLengthHours) },
    {
      k: "Sunrise / Sunset",
      v: sun.polarDay
        ? "does not rise or set — circles the sky"
        : `${fmtTime(sun.sunriseLocal)} / ${fmtTime(sun.sunsetLocal)} local`,
    },
    {
      k: "Sunset bearing",
      v: sun.polarDay ? "— (no sunset)" : `${compass(sun.sunsetAzimuth)} (${Math.round(sun.sunsetAzimuth ?? 0)}°)`,
    },
    { k: "Noon sun height", v: `${sun.noonAltitude.toFixed(0)}° above horizon` },
    {
      k: "Noon shadow",
      v: sun.noonShadow === "zenith"
        ? "almost none — sun overhead"
        : `points ${sun.noonShadow.toUpperCase()} (sun is ${sun.noonShadow === "north" ? "south" : "north"} at noon)`,
    },
    { k: "Midnight sky", v: SKY_LABEL[sun.midnightSky] },
    { k: "Season here", v: city.hemisphere === "N" ? "SUMMER — near the longest day" : "WINTER — near the SHORTEST day" },
    { k: "Calendar", v: city.festivals.join(" · ") },
  ];
  return { city, sun, lines };
}

/** All almanac entries for a given date (for the ledger UI + endless mode). */
export function fullLedger(date: Date): AlmanacEntry[] {
  return Object.keys(CITIES).map((id) => almanacFor(id, date));
}

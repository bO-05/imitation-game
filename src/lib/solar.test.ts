/**
 * Verification of the solar engine against published ephemeris values
 * (timeanddate.com) for June 21, 2026. Run: node src/lib/solar.test.ts
 * (Node 24 strips types natively.)
 */
import { sunDay, fmtDayLength, fmtTime, compass, solarDeclination } from "./solar.ts";

const JUNE21 = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));

interface Expect {
  name: string;
  lat: number;
  lon: number;
  tz: number;
  expectHours: number | "polar-day"; // published day length
  tolMin?: number;
}

const CASES: Expect[] = [
  { name: "Tromsø",    lat: 69.65, lon: 18.96,  tz: 2,  expectHours: "polar-day" },
  { name: "Reykjavik", lat: 64.15, lon: -21.94, tz: 0,  expectHours: 21 + 8 / 60, tolMin: 10 },
  { name: "Stockholm", lat: 59.33, lon: 18.07,  tz: 2,  expectHours: 18 + 37 / 60, tolMin: 8 },
  { name: "London",    lat: 51.51, lon: -0.13,  tz: 1,  expectHours: 16 + 38 / 60, tolMin: 8 },
  { name: "Cairo",     lat: 30.04, lon: 31.24,  tz: 3,  expectHours: 14 + 5 / 60,  tolMin: 8 },
  { name: "Singapore", lat: 1.35,  lon: 103.82, tz: 8,  expectHours: 12 + 12 / 60, tolMin: 8 },
  { name: "Sydney",    lat: -33.87,lon: 151.21, tz: 10, expectHours: 9 + 54 / 60,  tolMin: 8 },
  { name: "Ushuaia",   lat: -54.80,lon: -68.30, tz: -3, expectHours: 7 + 11 / 60,  tolMin: 12 },
];

let failures = 0;
const decl = solarDeclination(JUNE21);
console.log(`Solar declination June 21 2026: ${decl.toFixed(3)}° (expect ≈ 23.43)`);
if (Math.abs(decl - 23.43) > 0.1) { console.error("  ✗ declination off"); failures++; }

console.log("\ncity        daylen      sunrise sunset  noonAlt shadow  setAz  midnightSky");
for (const c of CASES) {
  const s = sunDay(c.lat, c.lon, JUNE21, c.tz);
  const dl = fmtDayLength(s.dayLengthHours).padEnd(11);
  const line = `${c.name.padEnd(11)} ${dl} ${fmtTime(s.sunriseLocal)}   ${fmtTime(s.sunsetLocal)}   ${s.noonAltitude.toFixed(1).padStart(5)}° ${s.noonShadow.padEnd(7)} ${compass(s.sunsetAzimuth).padEnd(5)} ${s.midnightSky}`;
  console.log(line);

  if (c.expectHours === "polar-day") {
    if (!s.polarDay) { console.error(`  ✗ ${c.name}: expected midnight sun`); failures++; }
  } else {
    const errMin = Math.abs(s.dayLengthHours - c.expectHours) * 60;
    if (errMin > (c.tolMin ?? 8)) {
      console.error(`  ✗ ${c.name}: day length off by ${errMin.toFixed(1)} min`);
      failures++;
    }
  }
}

// Categorical invariants the gameplay depends on:
const tromso = sunDay(69.65, 18.96, JUNE21, 2);
const reyk = sunDay(64.15, -21.94, JUNE21, 0);
const sthlm = sunDay(59.33, 18.07, JUNE21, 2);
const london = sunDay(51.51, -0.13, JUNE21, 1);
const sing = sunDay(1.35, 103.82, JUNE21, 8);
const sydney = sunDay(-33.87, 151.21, JUNE21, 10);

function inv(name: string, ok: boolean) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}`);
  if (!ok) failures++;
}

console.log("\nGameplay invariants:");
inv("Tromsø: midnight sun", tromso.midnightSky === "midnight-sun");
inv("Reykjavik: bright night, NOT midnight sun", reyk.midnightSky === "bright-night" && !reyk.polarDay);
inv("Stockholm: white night (no stars)", sthlm.midnightSky === "white-night");
inv("London: deep twilight at midnight (no astro darkness)", london.midnightSky === "deep-twilight");
inv("Singapore: true night", sing.midnightSky === "true-night");
inv("Sydney noon shadow points SOUTH", sydney.noonShadow === "south");
inv("London noon shadow points NORTH", london.noonShadow === "north");
inv("Singapore noon shadow points SOUTH in June", sing.noonShadow === "south");
inv("Stockholm sunset in NNW–NW", (sthlm.sunsetAzimuth ?? 0) > 305 && (sthlm.sunsetAzimuth ?? 0) < 335);
inv("Sydney winter day < 10h", sydney.dayLengthHours < 10);

// Singapore annual variation check (the 9-minute fact)
const DEC21 = new Date(Date.UTC(2026, 11, 21, 12, 0, 0));
const singDec = sunDay(1.35, 103.82, DEC21, 8);
const varMin = Math.abs(sing.dayLengthHours - singDec.dayLengthHours) * 60;
inv(`Singapore June↔Dec variation ≤ 25 min (got ${varMin.toFixed(0)}m)`, varMin <= 25);

console.log(failures === 0 ? "\nALL CHECKS PASSED ✓" : `\n${failures} FAILURES ✗`);
process.exit(failures === 0 ? 0 : 1);

/**
 * solar.ts — The Rulebook Is The Sky
 * ----------------------------------
 * Dependency-free solar astronomy for The Imitation Gate.
 *
 * Computes, for any latitude/longitude/date:
 *   - solar declination (NOAA low-accuracy algorithm, good to ~0.01°)
 *   - day length via the refraction-corrected sunrise equation
 *   - sunrise / sunset in local solar time and clock time
 *   - solar noon altitude, noon shadow direction
 *   - sunset azimuth (where on the horizon the sun goes down)
 *   - polar day / polar night detection
 *
 * Accuracy: within ~5–8 minutes of published ephemerides at the latitudes
 * the game uses (verified against timeanddate.com for June 21, 2026).
 * The refraction correction uses the standard -0.8333° threshold
 * (solar disc radius + atmospheric refraction at the horizon).
 */

export const DEG = Math.PI / 180;

/** Day of year, 1-based. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

/**
 * Solar declination in degrees for a given date.
 * NOAA simplified formula via fractional year — accurate to ~0.01° which is
 * far more precision than gameplay needs, and importantly gets the
 * polar-day boundary (Arctic Circle ≈ 66.56°N at June solstice) right.
 */
export function solarDeclination(date: Date): number {
  const N = dayOfYear(date);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const gamma = ((2 * Math.PI) / 365) * (N - 1 + (hour - 12) / 24);
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  return decl / DEG;
}

/** Equation of time in minutes (solar noon offset from clock mean noon). */
export function equationOfTime(date: Date): number {
  const N = dayOfYear(date);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const gamma = ((2 * Math.PI) / 365) * (N - 1 + (hour - 12) / 24);
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  );
}

export interface SunDay {
  /** Hours of daylight, 0..24 */
  dayLengthHours: number;
  /** true = sun never sets (polar day / midnight sun) */
  polarDay: boolean;
  /** true = sun never rises (polar night) */
  polarNight: boolean;
  /** Local clock time of sunrise/sunset as fractional hours (0..24), null in polar regimes */
  sunriseLocal: number | null;
  sunsetLocal: number | null;
  /** Solar altitude at solar noon, degrees */
  noonAltitude: number;
  /** Solar altitude at local solar midnight, degrees (negative = below horizon) */
  midnightAltitude: number;
  /** "north" | "south" | "zenith" — where your noon shadow points */
  noonShadow: "north" | "south" | "zenith";
  /** Azimuth of sunset in degrees (0=N, 90=E, 180=S, 270=W), null in polar regimes */
  sunsetAzimuth: number | null;
  /** Darkness class at solar midnight for sky rendering + almanac text */
  midnightSky:
    | "midnight-sun"      // sun above horizon
    | "bright-night"      // 0 to -6° (civil twilight all night)
    | "white-night"       // -6 to -12° (nautical twilight; no stars)
    | "deep-twilight"     // -12 to -18° (astronomical twilight)
    | "true-night";       // below -18°
}

/**
 * Compute the solar day for a latitude/longitude/date.
 * @param latDeg  latitude in degrees, north positive
 * @param lonDeg  longitude in degrees, east positive
 * @param date    any Date within the desired UTC day
 * @param tzOffsetHours  the location's clock offset from UTC (e.g. Singapore = 8)
 */
export function sunDay(
  latDeg: number,
  lonDeg: number,
  date: Date,
  tzOffsetHours: number
): SunDay {
  const decl = solarDeclination(date);
  const lat = latDeg * DEG;
  const dec = decl * DEG;

  // Refraction-corrected hour angle: sun's center at -0.8333° altitude.
  const h0 = -0.8333 * DEG;
  const cosH =
    (Math.sin(h0) - Math.sin(lat) * Math.sin(dec)) /
    (Math.cos(lat) * Math.cos(dec));

  const noonAltitude = 90 - Math.abs(latDeg - decl);

  let polarDay = false;
  let polarNight = false;
  let dayLengthHours: number;
  let sunriseLocal: number | null = null;
  let sunsetLocal: number | null = null;
  let sunsetAzimuth: number | null = null;

  if (cosH < -1) {
    polarDay = true;
    dayLengthHours = 24;
  } else if (cosH > 1) {
    polarNight = true;
    dayLengthHours = 0;
  } else {
    const H = Math.acos(cosH); // radians
    dayLengthHours = (2 * H * 12) / Math.PI;

    // Solar noon in local clock time = 12:00 solar, corrected for
    // longitude-vs-timezone offset and equation of time.
    const eot = equationOfTime(date); // minutes
    const solarNoonClock = 12 + (tzOffsetHours * 15 - lonDeg) * 4 / 60 - eot / 60;
    sunriseLocal = wrap24(solarNoonClock - dayLengthHours / 2);
    sunsetLocal = wrap24(solarNoonClock + dayLengthHours / 2);

    // Sunset azimuth from spherical trig:
    // cos(az) = (sin(dec) - sin(alt)·sin(lat)) / (cos(alt)·cos(lat)), alt≈-0.8333°
    const cosAz =
      (Math.sin(dec) - Math.sin(h0) * Math.sin(lat)) /
      (Math.cos(h0) * Math.cos(lat));
    const azFromNorth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / DEG;
    // Sunset is on the western half: azimuth = 360 - (angle from north toward east)
    sunsetAzimuth = 360 - azFromNorth;
  }

  const noonShadow: SunDay["noonShadow"] =
    Math.abs(latDeg - decl) < 0.7
      ? "zenith"
      : latDeg > decl
        ? "north" // sun due south at noon → shadow points north
        : "south"; // sun due north at noon → shadow points south

  const midAlt = altitudeAtHourAngle(lat, dec, Math.PI);
  const midnightSky: SunDay["midnightSky"] =
    midAlt > 0
      ? "midnight-sun"
      : midAlt > -6
        ? "bright-night"
        : midAlt > -12
          ? "white-night"
          : midAlt > -18
            ? "deep-twilight"
            : "true-night";

  return {
    dayLengthHours,
    polarDay,
    polarNight,
    sunriseLocal,
    sunsetLocal,
    noonAltitude,
    midnightAltitude: midAlt,
    noonShadow,
    sunsetAzimuth,
    midnightSky,
  };
}

/** Solar altitude (degrees) at a given hour angle H (radians; 0 = solar noon). */
export function altitudeAtHourAngle(lat: number, dec: number, H: number): number {
  const sinAlt =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
}

function wrap24(h: number): number {
  return ((h % 24) + 24) % 24;
}

/** Format fractional hours as "HH:MM" (24h clock). */
export function fmtTime(h: number | null): string {
  if (h === null) return "—";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const h2 = mm === 60 ? hh + 1 : hh;
  const m2 = mm === 60 ? 0 : mm;
  return `${String(h2 % 24).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
}

/** Format day length as "18h 37m". */
export function fmtDayLength(hours: number): string {
  if (hours >= 24) return "24h — the sun does not set";
  if (hours <= 0) return "0h — the sun does not rise";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Compass label for an azimuth. */
export function compass(az: number | null): string {
  if (az === null) return "—";
  const names = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return names[Math.round(az / 22.5) % 16];
}

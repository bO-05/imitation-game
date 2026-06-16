/**
 * Sky.tsx — the daylight meter IS the sky.
 * A canvas strip rendering tonight's city sky. The sun's position along its
 * arc = fraction of the daylight budget remaining. Palette and sun path are
 * derived from the city's real solar regime (midnight sun / white night /
 * true night), so the five nights LOOK like their latitudes.
 */
import { useEffect, useRef } from "react";
import { almanacFor, SOLSTICE_WEEK, CITIES } from "../data/cities";
import { fmtDayLength } from "../lib/solar";

interface Props {
  cityId: string;
  nightIndex: number;
  /** 0..1 — fraction of daylight budget remaining */
  frac: number;
  daylightLeft: number;
  label?: string;
}

interface Palette { top: string; mid: string; low: string; ground: string; sunCore: string; sunGlow: string; }

const PALETTES: Record<string, Palette> = {
  "midnight-sun": { top: "#3f5d8c", mid: "#d98e54", low: "#f2b96b", ground: "#1d2742", sunCore: "#ffe9b0", sunGlow: "rgba(255,210,120,0.55)" },
  "bright-night": { top: "#41598a", mid: "#c98a6b", low: "#ecc27e", ground: "#1c2440", sunCore: "#ffe5a6", sunGlow: "rgba(255,200,120,0.5)" },
  "white-night":  { top: "#5a6a96", mid: "#9c93a8", low: "#d9c3a8", ground: "#202741", sunCore: "#fff0c4", sunGlow: "rgba(240,220,170,0.45)" },
  "deep-twilight":{ top: "#2c3a66", mid: "#6f6890", low: "#cf9a72", ground: "#181f38", sunCore: "#ffdf9e", sunGlow: "rgba(250,190,110,0.5)" },
  "true-night":   { top: "#16204a", mid: "#34406e", low: "#e0975c", ground: "#121831", sunCore: "#ffd98c", sunGlow: "rgba(250,180,100,0.5)" },
};

export default function Sky({ cityId, nightIndex, frac, daylightLeft, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const alm = almanacFor(cityId, SOLSTICE_WEEK(nightIndex));
  const city = CITIES[cityId];
  const pal = PALETTES[alm.sun.midnightSky];

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // dim everything as the budget burns — polar day dims far less
    const polar = alm.sun.polarDay;
    const dim = polar ? 0.92 + frac * 0.08 : 0.45 + frac * 0.55;

    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(pal.top, dim));
    g.addColorStop(0.62, shade(pal.mid, dim));
    g.addColorStop(1, shade(pal.low, dim));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // stars only where the regime allows them, and only when budget is low
    if (alm.sun.midnightSky === "true-night" && frac < 0.45) {
      const seedBase = cityId.length * 73;
      ctx.fillStyle = `rgba(235,240,255,${0.7 * (1 - frac / 0.45)})`;
      for (let i = 0; i < 42; i++) {
        const x = ((seedBase * (i + 7) * 2654435761) % 1000) / 1000 * w;
        const y = ((seedBase * (i + 13) * 40503) % 1000) / 1000 * (h * 0.55);
        const r = (i % 3 === 0 ? 1.1 : 0.6);
        ctx.fillRect(x, y, r, r);
      }
    }

    // sun arc: high arc for high budgets; polar-day sun rides a low flat circuit
    const horizon = h * 0.78;
    let sx: number, sy: number;
    if (polar) {
      sx = w * (0.08 + 0.84 * (1 - frac));
      sy = horizon - h * (0.22 + 0.1 * Math.sin(frac * Math.PI)); // never sets
    } else {
      const t = 1 - frac; // 0 = sunrise side, 1 = sunset
      sx = w * (0.06 + 0.88 * t);
      const peak = Math.min(0.62, alm.sun.noonAltitude / 110);
      sy = horizon - Math.sin(Math.min(1, frac) * Math.PI) * h * peak - 6;
      if (frac <= 0) sy = horizon + 10; // gone
    }

    const glowR = polar ? 26 : 22 + 10 * frac;
    const rg = ctx.createRadialGradient(sx, sy, 2, sx, sy, glowR * 2.4);
    rg.addColorStop(0, pal.sunGlow);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(sx - glowR * 3, sy - glowR * 3, glowR * 6, glowR * 6);
    ctx.beginPath();
    ctx.arc(sx, sy, polar ? 9 : 10, 0, Math.PI * 2);
    ctx.fillStyle = pal.sunCore;
    ctx.fill();

    // ground / mountains silhouette
    ctx.fillStyle = pal.ground;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const peaks = [0.12, 0.3, 0.46, 0.63, 0.8, 0.95];
    peaks.forEach((p, i) => {
      ctx.lineTo(w * p, horizon - (i % 2 === 0 ? 16 : 9) - (cityId.charCodeAt(0) % 7));
    });
    ctx.lineTo(w, horizon);
    ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // the gate: small silhouette at center
    ctx.fillStyle = "#0a0d18";
    const gx = w / 2;
    ctx.fillRect(gx - 22, horizon - 26, 6, 26);
    ctx.fillRect(gx + 16, horizon - 26, 6, 26);
    ctx.fillRect(gx - 26, horizon - 30, 52, 6);
  }, [cityId, frac, nightIndex]);

  const low = !alm.sun.polarDay && frac < 0.25;

  return (
    <div className="sky-wrap" aria-label={`Daylight remaining: ${daylightLeft.toFixed(1)} hours`}>
      <canvas ref={ref} className="sky-canvas" />
      <div className="sky-meta">
        <span>
          {city.name.toUpperCase()} · {city.country.toUpperCase()}
          {label ? ` — ${label}` : ""}
        </span>
        <span className={`big ${low ? "dl-low" : ""}`}>
          {alm.sun.polarDay ? "MIDNIGHT SUN" : `☀ ${daylightLeft.toFixed(1)}h`}
          <span style={{ opacity: 0.65, fontSize: 11, marginLeft: 8 }}>
            / {fmtDayLength(alm.sun.dayLengthHours)}
          </span>
        </span>
      </div>
    </div>
  );
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

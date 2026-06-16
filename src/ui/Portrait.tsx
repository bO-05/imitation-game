/**
 * Portrait.tsx — procedural traveler silhouettes.
 * Deterministic from seed: hooded/hatted profile silhouettes against the
 * night's palette. Nobody gets a face — at this gate, faces prove nothing.
 */
import { useEffect, useRef } from "react";

export default function Portrait({ seed, finale }: { seed: number; finale?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const S = 76, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = S * dpr; cv.height = S * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const rnd = mulberry(seed);
    // background wash
    const hue = Math.floor(rnd() * 360);
    ctx.fillStyle = `hsl(${hue}, 22%, 13%)`;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = `hsla(${(hue + 40) % 360}, 30%, 22%, 0.5)`;
    ctx.fillRect(0, S * (0.55 + rnd() * 0.2), S, S);

    if (finale) {
      // the finale traveler: a slow spiral, no silhouette
      ctx.strokeStyle = "#f5c66b";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const cx = S / 2, cy = S / 2;
      for (let a = 0; a < Math.PI * 7; a += 0.08) {
        const r = 2 + a * 2.1;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    // silhouette: shoulders + head, slight profile, hat/hood variants
    const skin = `hsl(${hue}, 12%, ${7 + rnd() * 5}%)`;
    ctx.fillStyle = skin;
    const cx = S / 2 + (rnd() - 0.5) * 6;
    const headR = 13 + rnd() * 4;
    const headY = 30 + rnd() * 4;
    // shoulders
    ctx.beginPath();
    ctx.ellipse(cx, S - 6, 26 + rnd() * 6, 22, 0, Math.PI, 0);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    // headwear
    const style = Math.floor(rnd() * 4);
    if (style === 0) { // brimmed hat
      ctx.fillRect(cx - headR - 6, headY - headR + 2, headR * 2 + 12, 3);
      ctx.fillRect(cx - headR + 2, headY - headR - 7, headR * 2 - 4, 9);
    } else if (style === 1) { // hood
      ctx.beginPath();
      ctx.arc(cx, headY - 2, headR + 5, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
    } else if (style === 2) { // beanie
      ctx.beginPath();
      ctx.arc(cx, headY - 3, headR + 1, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    // breath of light on the rim (the only warmth)
    ctx.strokeStyle = "rgba(245,198,107,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + headR * 0.4, headY - headR * 0.3, headR + 1, -0.9, 0.6);
    ctx.stroke();
  }, [seed, finale]);

  return <canvas ref={ref} aria-hidden="true" />;
}

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

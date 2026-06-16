/**
 * audio.ts — synthesized checkpoint foley + per-night ambience.
 * Pure Web Audio, zero assets (single-file build stays single-file).
 * Respects a mute toggle (persisted) and starts only on user gesture.
 */
let ctx: AudioContext | null = null;
let ambGain: GainNode | null = null;
let ambNodes: OscillatorNode[] = [];
let muted = ((): boolean => {
  try { return localStorage.getItem("imitation-gate-muted") === "1"; } catch { return false; }
})();

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem("imitation-gate-muted", m ? "1" : "0"); } catch {}
  if (ambGain) ambGain.gain.value = m ? 0 : AMB_LEVEL;
}

/* ── foley ── */
export function sfxStamp() {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime;
  // thunk: filtered noise burst + low sine knock
  const noise = a.createBufferSource();
  const buf = a.createBuffer(1, a.sampleRate * 0.09, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25));
  noise.buffer = buf;
  const nf = a.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 900;
  const ng = a.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  noise.connect(nf).connect(ng).connect(a.destination);
  noise.start(t);
  const osc = a.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  const og = a.createGain(); og.gain.setValueAtTime(0.55, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(og).connect(a.destination);
  osc.start(t); osc.stop(t + 0.18);
}

export function sfxPaper() {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime;
  const src = a.createBufferSource();
  const buf = a.createBuffer(1, a.sampleRate * 0.22, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const env = Math.sin((i / d.length) * Math.PI);
    d[i] = (Math.random() * 2 - 1) * env * 0.5;
  }
  src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3600; f.Q.value = 0.8;
  const g = a.createGain(); g.gain.value = 0.16;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export function sfxAsk() {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime;
  const o = a.createOscillator(); o.type = "triangle";
  o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.07);
  const g = a.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.1);
}

export function sfxVerdict(correct: boolean) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime;
  const freqs = correct ? [523.25, 659.25] : [233.08, 220.0];
  freqs.forEach((f, i) => {
    const o = a.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
    o.connect(g).connect(a.destination);
    o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.55);
  });
}

/* ── ambience: latitude drone ── */
const AMB_LEVEL = 0.05;
const AMB_BASE: Record<string, number> = {
  "midnight-sun": 110, "bright-night": 98, "white-night": 87.3,
  "deep-twilight": 73.4, "true-night": 61.7,
};

export function ambience(sky: keyof typeof AMB_BASE | null) {
  const a = ac(); if (!a) return;
  // tear down
  ambNodes.forEach((n) => { try { n.stop(); } catch {} });
  ambNodes = [];
  if (!sky) { if (ambGain) { ambGain.disconnect(); ambGain = null; } return; }
  if (!ambGain) { ambGain = a.createGain(); ambGain.connect(a.destination); }
  ambGain.gain.value = muted ? 0 : AMB_LEVEL;
  const base = AMB_BASE[sky] ?? 80;
  [1, 1.5, 2.01].forEach((mult, i) => {
    const o = a.createOscillator();
    o.type = i === 0 ? "sine" : "triangle";
    o.frequency.value = base * mult;
    o.detune.value = (i - 1) * 7;
    const g = a.createGain(); g.gain.value = i === 0 ? 1 : 0.35 / i;
    o.connect(g).connect(ambGain!);
    o.start();
    ambNodes.push(o);
  });
}

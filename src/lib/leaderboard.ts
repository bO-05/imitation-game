/**
 * leaderboard.ts — talks to the Cloud Run proxy's /api/score and
 * /api/leaderboard. Every call fails soft: no proxy, or any network error,
 * and the game simply carries on with no leaderboard. Never blocks play.
 */
import { apiBase, hasProxy } from "../config";

export interface LbRow { name: string; score: number; total: number; }

export async function fetchLeaderboard(mode: "daily" | "endless", day?: string): Promise<LbRow[]> {
  if (!hasProxy()) return [];
  const base = apiBase();
  try {
    const q = mode === "daily" ? `?mode=daily${day ? `&day=${encodeURIComponent(day)}` : ""}` : "?mode=endless";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${base}/api/leaderboard${q}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.rows) ? d.rows.slice(0, 20) : [];
  } catch { return []; }
}

export async function submitScore(p: {
  name: string; mode: "daily" | "endless"; score: number; total: number; day?: string;
}): Promise<boolean> {
  if (!hasProxy()) return false;
  const base = apiBase();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${base}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify(p),
    });
    clearTimeout(timer);
    return r.ok;
  } catch { return false; }
}

/**
 * config.ts — runtime configuration for self-hosters.
 *
 * You do NOT put any API key here. The only thing the browser ever learns is
 * the URL of your Cloud Run proxy (which holds the key as a server secret).
 *
 * Two ways to set it:
 *   1. Edit gate.config.json before `node build.js` (it gets injected), OR
 *   2. Edit the built index.html directly — change the one line:
 *        <script>window.__GATE__ = { "proxyUrl": "https://YOUR-SERVICE.run.app" };</script>
 *
 * Leave it empty and the game runs exactly as before (offline dossier voice,
 * optional player-supplied key, no leaderboard).
 */
const BUILD_DEFAULT = ""; // optional compile-time fallback

function cfg(): any {
  const w: any = typeof window !== "undefined" ? window : {};
  return w.__GATE__ || {};
}

/**
 * Base URL for API calls.
 *  - split deploy  (game on Pages, API on Cloud Run): set proxyUrl → absolute URL
 *  - single service (Cloud Run serves game + API):    set sameOrigin → "" (relative /api)
 */
export function apiBase(): string {
  const c = cfg();
  if (c.proxyUrl) return String(c.proxyUrl).replace(/\/+$/, "");
  if (c.sameOrigin) return ""; // relative — backend serves this page
  return BUILD_DEFAULT ? BUILD_DEFAULT.replace(/\/+$/, "") : "";
}

/** Is a backend available at all (proxy URL, same-origin service, or build default)? */
export function hasProxy(): boolean {
  const c = cfg();
  return !!(c.proxyUrl || c.sameOrigin || BUILD_DEFAULT);
}

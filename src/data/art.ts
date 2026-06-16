/**
 * art.ts — generated key art (risograph checkpoint series).
 * Served from /assets as relative URLs: works on GitHub Pages, itch, and
 * file:// (assets sit next to index.html). Art is progressive enhancement —
 * every screen has a solid fallback colour so it reads instantly and looks
 * intentional before the image arrives or if it's unavailable offline.
 */
export const NIGHT_ART: Record<string, string> = {
  tromso: "assets/tromso.webp",
  stockholm: "assets/stockholm.webp",
  cairo: "assets/cairo.webp",
  singapore: "assets/singapore.webp",
  ushuaia: "assets/ushuaia.webp",
};

/** Solid fallbacks keyed to each night's palette. */
export const NIGHT_BG: Record<string, string> = {
  tromso: "#1b2742",
  stockholm: "#2c2942",
  cairo: "#0e1838",
  singapore: "#0f2a33",
  ushuaia: "#16263a",
};

export const TITLE_ART = NIGHT_ART.tromso;
export const TITLE_BG = NIGHT_BG.tromso;

/** Endless mode: use the traveler's origin art if we have it, else the anchor. */
export function artFor(cityId: string): { src: string; bg: string } {
  return {
    src: NIGHT_ART[cityId] ?? TITLE_ART,
    bg: NIGHT_BG[cityId] ?? TITLE_BG,
  };
}

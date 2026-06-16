# The Imitation Gate

*A solstice border-checkpoint deduction game for the [DEV June Solstice Game Jam 2026](https://dev.to/challenges/june-game-jam-2026-06-03).*

**You are the examiner at the Solstice Gate — the border between the dark and light halves of the year.**
Five nights, June 17–21. Some travelers are human. Some are machines that have read everything and lived nothing.
Your only instrument is the **Daylight Ledger** — an almanac of real solar astronomy. The sky keeps the score.

> The machine's crime was passing the test. Turing's crime was failing one he never agreed to take.

## Play

**It's one HTML file. No server, no install, no account, no API key.**

- Open `imitation-gate.html` in any browser (double-click works — it runs from `file://`), or
- Serve the repo root statically (`index.html` is the same file)

### How it plays

1. A traveler approaches with papers: name, claimed origin city, purpose.
2. Ask questions from the **deck** — each costs daylight. Your budget is the night city's *true* day length (24h under Tromsø's midnight sun… 7h13m in midwinter Ushuaia).
3. Open the **LEDGER** and check their claims against computed astronomy: day length, sunset time *and bearing*, midnight sky class, noon shadow direction, festival dates.
4. Stamp **ENTRY** or **HOLD**. Machines are fluent and wrong; humans are messy and right. Wrong verdicts have costs — you'll read them.
5. **The Long Shift** (endless mode): procedurally generated travelers, 3 strikes, streak scoring.

### Optional: Gemini-voiced impostors

In The Long Shift you can paste a **Google Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com)). Travelers are then *improvised live by Gemini* — the model plays the impostor, weaving its assigned lie into a fresh cover story. Without a key (or if any call fails) the built-in dossier voice takes over seamlessly. The key lives only in your browser's `localStorage` and is sent only to Google's API, directly from your browser. **The game never requires it.**

## The almanac is real

Every fact in the Daylight Ledger is computed at runtime by a ~150-line dependency-free solar engine (`src/lib/solar.ts`): NOAA declination, refraction-corrected sunrise equation, sunset azimuth, twilight classification. Verified against published ephemerides (±8 min) — see `src/lib/solar.test.ts`. That's the whole trick of the game: **machines memorize textbooks, but the sky is a clock, and locals live under it.**

Favorite tells, all true:
- Tromsø (69.6°N): the sun *does not set* from mid-May to late July. Anyone who "watched the sunset last night" is lying.
- Stockholm (59.3°N): white nights — **no stars in June**. The sky never passes nautical twilight.
- Singapore (1.35°N): annual day-length variation is **nine minutes**. There are no "long June evenings."
- Sydney / Ushuaia: June 21 is the **shortest** day. Noon sun due **north**, shadows point **south**.
- Matariki (NZ): follows the Pleiades' heliacal rising, **not** the solstice — the 2026 holiday is July 10.

## Build from source

```bash
npm install          # installs react, zustand, esbuild (~5 MB total)
node build.js        # → index.html (+ imitation-gate.html), art served from ./assets
                     #   also → imitation-gate.standalone.html (art inlined, one portable file)
node build.js --test # solar-engine verification + full headless playthrough
```

Two build outputs:
- **`index.html` + `assets/`** — the deploy build. Art loads from `./assets/*.webp` (async, cached, fast). Use this for GitHub Pages / Netlify / itch.
- **`imitation-gate.standalone.html`** — one portable file with the art base64-inlined. Double-click to play offline, e-mail it, drop it anywhere.

Stack: TypeScript + React 18 + Zustand, bundled by esbuild. Canvas for the live sky meter and portraits; a generated risograph art series for backdrops; Web Audio for synthesized foley + ambience (no audio asset files). Full keyboard play, reduced-motion and colorblind-aware, ARIA-labelled. No analytics, no cookies, no tracking.

## Deploy anywhere

The build output is static. Any of these work as-is:

- **GitHub Pages**: Settings → Pages → deploy from branch → root. (`index.html` is already there.)
- **Netlify / Vercel / Cloudflare Pages**: point at the repo, no build command needed (or `node build.js`, publish dir `.`).
- **itch.io**: zip `index.html`, upload as an HTML5 game.
- **Anywhere else**: copy one file.

## Project layout

```
src/
  lib/solar.ts        the solar engine (the game's rulebook)
  lib/gemini.ts       optional Gemini voicing for endless mode (BYO key)
  lib/audio.ts        synthesized foley + per-latitude ambience
  data/cities.ts      the nine cities + runtime-computed almanac
  data/travelers.ts   story mode: 5 nights, 21 hand-written travelers
  data/endless.ts     endless mode: procedural traveler generator
  data/questions.ts   the interrogation deck
  data/vignettes.ts   Turing interstitials (all dates verified)
  data/art.ts         backdrop art manifest (relative /assets URLs)
  game/store.ts       zustand state machine + scoring/share
  ui/                 React components: Backdrop, Sky, Portrait, App screens
  ...tests            solar.test.ts + sim.test.ts (headless full playthrough)
assets/               generated risograph backdrops (5 × WebP)
press/                cover-dev.jpg (DEV post cover) + cover-full.png
build.js              cross-platform build (deploy + standalone outputs)
```

## For Alan Turing

Born 23 June 1912, two days after the solstice. Bletchley Park's bombes hunted contradictions — a settings guess that forced a letter to encrypt to itself was impossible, and died. This game is that idea worn as a border post: hold the impossible against the claim, and the claim confesses. Turing was convicted in 1952 for being what he was, and died on 7 June 1954, two weeks before the longest day. The finale asks the question he left under the imitation game: what does the examiner owe the ones who stop pretending?

MIT licensed. Built during the jam window, June 2026.

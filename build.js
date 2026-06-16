/**
 * build.js — cross-platform build for The Imitation Gate.
 * Works on Windows / macOS / Linux. Requires: `npm install` once.
 *
 *   node build.js          → builds imitation-gate.html + index.html (same file)
 *   node build.js --test   → runs the solar-engine + full-game simulation tests
 *
 * Output is ONE self-contained HTML file: all JS + CSS inlined, no assets,
 * no server, works from file:// or any static host.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === "win32";

// Prefer a DIRECTLY-executable esbuild binary so we can run it with shell:false.
// Running through the .cmd shim with shell:true lets cmd.exe strip the quotes in
// --define:...="production", which silently breaks the bundle (NODE_ENV becomes a
// bare identifier → "production is not defined" → blank page). Pointing at the real
// platform binary and using shell:false passes every arg verbatim on all OSes.
function esbuildBin() {
  const nm = join(root, "node_modules");
  const candidates = [
    join(nm, "@esbuild", "win32-x64", "esbuild.exe"),
    join(nm, "@esbuild", "win32-arm64", "esbuild.exe"),
    join(nm, "@esbuild", "darwin-arm64", "bin", "esbuild"),
    join(nm, "@esbuild", "darwin-x64", "bin", "esbuild"),
    join(nm, "@esbuild", "linux-x64", "bin", "esbuild"),
    join(nm, "@esbuild", "linux-arm64", "bin", "esbuild"),
    join(root, "tools", isWin ? "esbuild.exe" : "esbuild"),
    join(nm, ".bin", isWin ? "esbuild.cmd" : "esbuild"), // last resort (needs shell on win)
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("esbuild not found — run `npm install` first.");
}

function run(args) {
  const bin = esbuildBin();
  const needShell = bin.endsWith(".cmd"); // only the shim needs a shell
  execFileSync(bin, args, { cwd: root, stdio: "inherit", shell: needShell });
}

const TEST = process.argv.includes("--test");

if (TEST) {
  // Bundle each test to CJS and run it with node.
  for (const t of ["src/lib/solar.test.ts", "src/game/sim.test.ts"]) {
    const out = join(root, ".test-bundle.cjs");
    run([t, "--bundle", "--format=cjs", "--platform=node", "--target=es2022",
         `--outfile=${out}`, '--define:process.env.NODE_ENV="production"', "--log-level=warning"]);
    execFileSync(process.execPath, [out], { cwd: root, stdio: "inherit" });
  }
  console.log("\nAll test suites passed.");
  process.exit(0);
}

run(["src/main.tsx", "--bundle", "--minify", "--format=iife", "--target=es2020",
     "--jsx=automatic", '--define:process.env.NODE_ENV="production"',
     "--outfile=dist-bundle.js", "--log-level=warning"]);

const js = readFileSync(join(root, "dist-bundle.js"), "utf8");
const css = readFileSync(join(root, "dist-bundle.css"), "utf8");

// Guard against the quote-stripping shell bug: if the NODE_ENV define didn't
// apply, the dev React build leaks in and the page crashes at runtime with
// "production is not defined". Fail loudly here instead of shipping a blank page.
if (js.includes("react.development")) {
  throw new Error(
    "Build error: the production NODE_ENV define did not apply (development React leaked\n" +
    "into the bundle). This happens when esbuild runs through a shell that strips the quotes\n" +
    "in --define. You're on an old build.js — re-pull it (esbuildBin() now runs the binary\n" +
    "with shell:false) and rebuild."
  );
}

// Optional runtime config (proxy URL for the Cloud Run backend). Self-hosters
// set proxyUrl in gate.config.json (or edit the injected line in index.html).
// NO secrets here — only the public URL of your proxy.
let gateConfig = {};
const cfgPath = join(root, "gate.config.json");
if (existsSync(cfgPath)) {
  try { gateConfig = JSON.parse(readFileSync(cfgPath, "utf8")); } catch { gateConfig = {}; }
}
const configLine = `<script>window.__GATE__ = ${JSON.stringify(gateConfig)};</script>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0b0e1a" />
<meta name="description" content="The Imitation Gate — a solstice border-checkpoint game. You are the examiner. Some travelers are human. Some are not. The sky keeps the score." />
<title>The Imitation Gate</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
${configLine}
<script>${js}</script>
</body>
</html>`;

writeFileSync(join(root, "imitation-gate.html"), html);
writeFileSync(join(root, "index.html"), html); // GitHub Pages / Netlify root — loads art from ./assets
console.log(`Built imitation-gate.html + index.html (${(html.length / 1024).toFixed(0)} KB app, art served from ./assets)`);

// Standalone: inline every assets/*.webp as a base64 data URI → one portable file
// that works from file:// with zero loose files (used for previews and offline play).
const assetsDir = join(root, "assets");
if (existsSync(assetsDir)) {
  let standalone = html;
  for (const f of readdirSync(assetsDir).filter((n) => /\.(webp|png|jpg|jpeg)$/.test(n))) {
    const mime = f.endsWith(".webp") ? "image/webp" : f.endsWith(".png") ? "image/png" : "image/jpeg";
    const dataUri = `data:${mime};base64,${readFileSync(join(assetsDir, f)).toString("base64")}`;
    standalone = standalone.split(`assets/${f}`).join(dataUri);
  }
  writeFileSync(join(root, "imitation-gate.standalone.html"), standalone);
  console.log(`Built imitation-gate.standalone.html (${(standalone.length / 1024).toFixed(0)} KB, art inlined, single portable file)`);
}

// Single-service deploy: copy the built game into server/public so one Cloud Run
// service serves BOTH the game and the key-backed API (same origin → no CORS).
// This copy always runs with sameOrigin config so its API calls are relative.
const serverPublic = join(root, "server", "public");
if (existsSync(join(root, "server"))) {
  const serverHtml = html.replace(configLine, `<script>window.__GATE__ = {"sameOrigin":true};</script>`);
  rmSync(serverPublic, { recursive: true, force: true });
  mkdirSync(join(serverPublic, "assets"), { recursive: true });
  writeFileSync(join(serverPublic, "index.html"), serverHtml);
  if (existsSync(assetsDir)) {
    for (const f of readdirSync(assetsDir)) copyFileSync(join(assetsDir, f), join(serverPublic, "assets", f));
  }
  console.log("Copied game into server/public (single-service deploy ready)");
}

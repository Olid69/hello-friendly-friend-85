// Generates a static SPA index.html for Capacitor from the built client assets.
// TanStack Start's cloudflare/nitro build only emits SSR output — no static
// index.html. Capacitor's WebView needs one to boot, so we synthesize a
// minimal shell that loads the hashed client entry chunk and its CSS.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// Try common output locations. Different TanStack Start / Nitro presets
// (cloudflare vs node vs static) emit the browser bundle in different dirs.
const candidateClientDirs = [
  "dist/client",
  "dist/public",
  "dist/static",
  ".output/public",
  ".output/server/public",
  "dist",
];

const capacitorWebDir = "dist/client";

function findClientDir() {
  for (const dir of candidateClientDirs) {
    const assets = join(dir, "assets");
    if (existsSync(assets) && statSync(assets).isDirectory()) {
      const files = readdirSync(assets);
      if (files.some((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f))) {
        return dir;
      }
    }
  }
  return null;
}

const clientDir = findClientDir();

if (!clientDir) {
  console.error("[capacitor-shell] Could not find built client assets in any known location.");
  console.error("[capacitor-shell] Searched:", candidateClientDirs.join(", "));
  console.error("[capacitor-shell] dist/ tree:");
  function walk(dir, depth = 0) {
    if (depth > 3 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const isDir = statSync(full).isDirectory();
      console.error("  ".repeat(depth) + (isDir ? "[d] " : "    ") + entry);
      if (isDir) walk(full, depth + 1);
    }
  }
  walk("dist");
  process.exit(1);
}

if (clientDir !== capacitorWebDir) {
  console.log(`[capacitor-shell] Normalizing ${clientDir} -> ${capacitorWebDir}`);
  rmSync(capacitorWebDir, { recursive: true, force: true });
  mkdirSync(capacitorWebDir, { recursive: true });
  cpSync(clientDir, capacitorWebDir, { recursive: true });
}

const finalClientDir = capacitorWebDir;
const assetsDir = join(finalClientDir, "assets");
console.log(`[capacitor-shell] Using client dir: ${finalClientDir}`);

const files = readdirSync(assetsDir);

// The client entry chunk is emitted as `index-<hash>.js` and is the only
// chunk that references React DOM's hydrateRoot/createRoot at top level.
const entryCandidates = files.filter((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
let entryJs = null;
for (const f of entryCandidates) {
  const content = readFileSync(join(assetsDir, f), "utf8");
  if (content.includes("hydrateRoot") || content.includes("createRoot")) {
    entryJs = f;
    break;
  }
}
if (!entryJs) {
  console.error("[capacitor-shell] Could not locate client entry chunk (index-*.js with createRoot).");
  process.exit(1);
}

// All top-level CSS bundles — include every .css so global styles load
// regardless of which chunk owns them.
const cssFiles = files.filter((f) => f.endsWith(".css"));

const cssTags = cssFiles.map((f) => `    <link rel="stylesheet" href="./assets/${f}" />`).join("\n");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" />
    <title>Sonora</title>
${cssTags}
    <link rel="icon" href="./favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/${entryJs}"></script>
  </body>
</html>
`;

writeFileSync(join(finalClientDir, "index.html"), html);
console.log(`[capacitor-shell] Wrote ${finalClientDir}/index.html (entry: ${entryJs}, css: ${cssFiles.length})`);

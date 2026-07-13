// Generates a static SPA index.html for Capacitor from the built client assets.
// TanStack Start's cloudflare/nitro build only emits SSR output — no static
// index.html. Capacitor's WebView needs one to boot, so we synthesize a
// minimal shell that loads the hashed client entry chunk and its CSS.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const assetsDir = join(clientDir, "assets");

if (!existsSync(assetsDir)) {
  console.error(`[capacitor-shell] Missing ${assetsDir}. Run 'bun run build' first.`);
  process.exit(1);
}

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

writeFileSync(join(clientDir, "index.html"), html);
console.log(`[capacitor-shell] Wrote ${clientDir}/index.html (entry: ${entryJs}, css: ${cssFiles.length})`);

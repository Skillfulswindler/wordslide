/* Wordslide — build the single-file standalone HTML export.
 *
 * Recipe (mirrors game/CLAUDE.md): Phaser CDN + window.WORDLIST + the nine WS
 * modules concatenated in dependency order (worlds, svgart, art, audio,
 * monetize, game, scenes, ui, boot). The head (embedded Baloo 2 fonts + the
 * dictionary string) is reused verbatim from the previous export so the proven
 * font/wordlist blobs stay byte-identical; the module <script> is regenerated
 * from current src/ every run, so tuning + code changes are always captured.
 *
 * v7 adds the world background PNGs: boot.js loads them via import.meta.glob in
 * the Vite build, which does not exist in a plain <script>. Here we swap that
 * one line for an inline { "bg_<world>.png": <dataURI> } map read from the
 * current PNGs in src/assets/backgrounds/ — re-running picks up refreshed art.
 *
 * Usage:  node build_standalone.mjs [prevExport] [outFile]
 *   defaults: ../Wordslide_Game_v6.html  ->  ../Wordslide_Game_v7.html
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here    = dirname(fileURLToPath(import.meta.url));            // game/
const root    = join(here, '..');                                  // repo root
const prev    = process.argv[2] || join(root, 'Wordslide_Game_v6.html');
const outFile = process.argv[3] || join(root, 'Wordslide_Game_v7.html');

// ---- module order (must match main.js import chain, minus main/words) ----
// layout MUST be first (everything destructures its constants at import time)
// and health/analytics/econ must precede monetize (it reports into all three).
// This list was missing layout/tuning/health/analytics/econ — a regenerated
// export would have died at boot with undefined layout constants.
const MODULES = ['layout','tuning','worlds','assets','svgart','art','juice','weather',
                 'audio','health','analytics','econ','monetize','game','scenes','ui','boot'];
const MODULE_MARK = '/* Wordslide — shared config';   // start of the first module in the export

// ---- 1. reuse the head + wordlist preamble from the previous export ----
const prevHtml = readFileSync(prev, 'utf8');
const cut = prevHtml.indexOf(MODULE_MARK);
if (cut < 0) throw new Error(`could not find module marker in ${prev}`);
// back up to the opening <script> that wraps the modules
const scriptOpen = prevHtml.lastIndexOf('<script>', cut);
const preamble = prevHtml.slice(0, scriptOpen);       // <head>…</head><body>…<script>WORDLIST…</script>

// ---- 2. base64 every shipped asset, grouped exactly as assets.js expects ----
// Keys mimic the Vite glob paths ("./assets/<group>/<key>.png") so the basename
// key-derivation in assets.js is unchanged; load.image takes the data URI.
const GROUP_DIRS = ['backgrounds','tiles','board','ui','icons','fx'];
const groups = {};
let assetCount = 0;
for (const g of GROUP_DIRS) {
  groups[g] = {};
  let files = [];
  try { files = readdirSync(join(here,'src','assets',g)).filter(f => /\.(png|jpe?g)$/i.test(f)).sort(); }
  catch { /* group dir absent — fine, procedural fallback covers it */ }
  for (const f of files) {
    const b64 = readFileSync(join(here,'src','assets',g,f)).toString('base64');
    const mime = /\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/png';
    groups[g][`./assets/${g}/${f}`] = `data:${mime};base64,${b64}`;
    assetCount++;
  }
}

// ---- 3. concat the modules, patching assets.js (which owns the globs) ----
let modules = '';
for (const name of MODULES) {
  let code = readFileSync(join(here, 'src', `${name}.js`), 'utf8');
  if (name === 'assets') {
    const before = code;
    code = code.replace(/const GROUPS = \{[\s\S]*?\n\};/, 'const GROUPS = ' + JSON.stringify(groups) + ';');
    code = code.replace(/const ATLAS_PNG\s*=\s*import\.meta\.glob\([^;]*\);/,  'const ATLAS_PNG = {};');
    code = code.replace(/const ATLAS_JSON\s*=\s*import\.meta\.glob\([^;]*\);/, 'const ATLAS_JSON = {};');
    if (code === before || /import\.meta\.glob/.test(code))
      throw new Error('assets.js: failed to inline the import.meta.glob manifests');
  }
  modules += code.replace(/\s*$/, '') + '\n\n';
}

// ---- 4. stitch and write ----
const html = preamble + '<script>\n' + modules + '</script>\n</body>\n</html>\n';
writeFileSync(outFile, html);
console.log(`wrote ${outFile}`);
console.log(`  modules: ${MODULES.join(', ')}`);
for (const g of GROUP_DIRS) {
  const keys = Object.keys(groups[g]).map(k => k.split('/').pop().replace(/\.(png|jpe?g)$/i,''));
  console.log(`  ${g.padEnd(12)}: ${keys.length ? keys.join(', ') : '(none — procedural fallback)'}`);
}
console.log(`  total assets embedded: ${assetCount}`);
console.log(`  size: ${(html.length/1024/1024).toFixed(2)} MB`);

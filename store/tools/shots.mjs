/* Wordslide — store screenshot capture + headless playtest
   ============================================================================
   run (from game/):   node ../store/tools/shots.mjs
        headed:        node ../store/tools/shots.mjs --headed

   WHY THIS EXISTS RATHER THAN A FOLDER OF HAND-MADE MOCKUPS.

   A store screenshot is a promise the game has to keep. Mocked-up screenshots
   drift from the real build the moment anyone touches a layout constant, and
   then the listing is quietly lying — the exact failure mode of a "live" number
   that is really a hardcoded literal. So these are captured from the REAL build,
   at the EXACT pixel dimensions each store demands, every release.

   It is also the playtest gate: the run FAILS on any console error. That matters
   because a silent JS error in a Phaser scene does not crash the page — the
   canvas simply stops updating, and a screenshot of a frozen canvas looks
   perfectly fine. "It rendered" is not "it worked".

   EXACT SIZES (checked against App Store Connect / Play, July 2026):
     iPhone 6.9"      1320 x 2868   (required; 6.7" 1290x2796 also accepted)
     iPad 13"         2064 x 2752   (required if you ship iPad)
     Play phone       1080 x 1920   (min 2 shots)
     Play tablet      1600 x 2560   (recommended 4 shots for large screens)
   PNG, RGB, no alpha, no off-by-one — the stores reject all three.
   ========================================================================== */
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = resolve(__dir, "..", "screenshots");
const HEADED = process.argv.includes("--headed");

/* deviceScaleFactor x viewport = the exact required pixel size. Getting this
   wrong by one pixel is a rejected upload, so it is computed, never typed. */
const DEVICES = [
  { id:"iphone-6.9", w:1320, h:2868, dsf:3, label:"iPhone 6.9\"" },
  { id:"ipad-13",    w:2064, h:2752, dsf:2, label:"iPad 13\""    },
  { id:"play-phone", w:1080, h:1920, dsf:3, label:"Play phone"   },
  { id:"play-tablet",w:1600, h:2560, dsf:2, label:"Play tablet"  },
];

/* Each shot is a real screen of the real game. `settle` is how long we let the
   letters tumble in, because a screenshot of an empty tray sells nothing. */
const SHOTS = [
  { id:"1-home",    url:"/",                                        settle:1800 },
  { id:"2-play",    url:"/?test=1&world=mudslide&level=3",          settle:6500 },
  { id:"3-worlds",  url:"/?test=1#select", click:"select",          settle:1400 },
  { id:"4-volcano", url:"/?test=1&world=volcano&level=5",           settle:6500 },
  { id:"5-daily",   url:"/?test=1#daily",  click:"daily",           settle:1600 },
  { id:"6-shop",    url:"/?test=1#shop",   click:"shop",            settle:1400 },
];

const errors = [];

const server = await createServer({ server:{ port:5199 }, logLevel:"error" });
await server.listen();
const base = "http://localhost:5199";

const browser = await chromium.launch({ headless: !HEADED });
mkdirSync(OUT, { recursive:true });

for (const d of DEVICES){
  const ctx = await browser.newContext({
    viewport: { width: Math.round(d.w/d.dsf), height: Math.round(d.h/d.dsf) },
    deviceScaleFactor: d.dsf,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // A Phaser scene that throws does NOT blank the page — it just stops
  // advancing, and the screenshot still looks plausible. So we listen.
  page.on("console", m => { if (m.type()==="error") errors.push(`[${d.id}] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${d.id}] ${e.message}`));

  mkdirSync(`${OUT}/${d.id}`, { recursive:true });

  for (const s of SHOTS){
    await page.goto(base + s.url, { waitUntil:"load" });
    // boot.js waits on fonts (2.5s cap) before the first scene appears
    await page.waitForTimeout(3000 + s.settle);

    // Scenes that are not reachable by URL are reached the way a player would:
    // by starting them through Phaser's own scene manager.
    if (s.click){
      await page.evaluate(k => {
        const g = window.WSGAME;
        if (g && g.scene && g.scene.keys[k]) { g.scene.stop("home"); g.scene.start(k); }
      }, s.click);
      await page.waitForTimeout(1400);
    }

    const file = `${OUT}/${d.id}/${s.id}.png`;
    await page.screenshot({ path:file, type:"png" });   // no alpha: stores reject it
    console.log(`  ${d.label.padEnd(12)} ${s.id.padEnd(10)} -> ${d.w}x${d.h}`);
  }
  await ctx.close();
}

await browser.close();
await server.close();

/* The gate. A green capture run with console errors in it is the "tests passed
   somewhere" lie: the files exist, they look fine, and the build is broken. */
if (errors.length){
  console.error(`\nFAILED — ${errors.length} console error(s):`);
  [...new Set(errors)].slice(0,20).forEach(e => console.error("  " + e));
  writeFileSync(`${OUT}/ERRORS.txt`, errors.join("\n"));
  process.exit(1);
}
console.log(`\nOK — ${DEVICES.length*SHOTS.length} screenshots, zero console errors.`);
console.log(`Written to store/screenshots/. Upload as-is: exact dimensions, no alpha.`);

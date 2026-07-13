/* Wordslide — pacing model
   ============================================================================
   run:  node tools/pacing.mjs

   Prints, for every world and level: how fast letters arrive, how many seconds
   per word the player can afford before the tray overflows, and — the number
   that actually matters — HOW LONG A LEVEL TAKES.

   THE KEY INSIGHT THIS MODEL ENCODES. A level is not gated by how clever the
   player is. It is gated by LETTER SUPPLY. To clear a level you must place
   roughly `target / pointsPerTile` tiles, and tiles arrive at a fixed rate. So:

       level duration >= tilesNeeded x dropInterval

   You cannot make a level shorter by playing better, only by lowering the
   target, speeding up the slide, or scoring more per tile. That is why "level 1
   feels long" is a CONFIG bug, not a skill issue.

   It reads the REAL config out of src/worlds.js. It does not restate any of it,
   because a model that carries its own copy of the numbers will disagree with
   the game the first time someone tunes a knob, and then confidently mislead.
   ========================================================================== */

global.window = { innerWidth:480, innerHeight:854 };
const _ls = {};
global.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k,v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; },
};
global.WORDLIST = "cat dog slide";

await import("../src/tuning.js");
const WS = global.window.WS;

if (!WS.WORLDS || !WS.levelTarget){
  console.error("ABORT: tuning.js did not load. Any table printed would be wrong.");
  process.exit(2);
}

/* ---- the two behavioural assumptions, stated out loud so they can be argued
   with. Everything downstream is arithmetic. ---- */
const TILES_PER_WORD  = 3.6;   // measured avg in the HANDOFF playtest analysis
const POINTS_PER_TILE = 4.4;   // ~16 pts / 3.6 tiles, incl. modest bonus/combo uplift

const dropAt = (w, L) => Math.max(w.minDrop, w.dropEvery - w.ramp * (L - 1));
const perWave = w => (w.mode === "wave" ? (w.waveCount || 1) : 1);

// seconds the player can spend per word before the tray runs away from them
const secPerWord = (w, L) => TILES_PER_WORD * (dropAt(w, L) / 1000) / perWave(w);

// how long the level LASTS, gated by letter supply (see header)
const levelMins = (w, L) => {
  const tiles = WS.levelTarget(L) / POINTS_PER_TILE;
  const secsPerTile = (dropAt(w, L) / 1000) / perWave(w);
  return (tiles * secsPerTile) / 60;
};

const LEVELS = [1, 3, 5, 7, 10];

console.log("\nSECONDS PER WORD the player can afford  (below ~8s = frantic; 15-20s = casual comfort)");
console.log("world        order " + LEVELS.map(l => ("L"+l).padStart(7)).join(""));
const rows = WS.WORLD_ORDER.map(k => WS.WORLDS[k]);
for (const w of rows){
  const cells = LEVELS.map(l => secPerWord(w, l).toFixed(1).padStart(7)).join("");
  console.log(w.key.padEnd(12) + String(w.order).padEnd(6) + cells);
}

console.log("\nDIFFICULTY ORDER at L1 (easiest first) — should track world order 1..7");
const byEase = [...rows].sort((a,b) => secPerWord(b,1) - secPerWord(a,1));
byEase.forEach((w,i) => {
  const flag = (i + 1 === w.order) ? "" : `   <-- sits at position ${w.order}`;
  console.log(`  ${i+1}. ${w.key.padEnd(11)} ${secPerWord(w,1).toFixed(1)}s${flag}`);
});
console.log("  (raw letter-rate only — boulders/embers/gusts/frost add difficulty on top)");

console.log("\nMINUTES PER LEVEL  (mobile casual wants 2-4 min; >6 is a grind)");
console.log("world        order " + LEVELS.map(l => ("L"+l).padStart(7)).join(""));
for (const w of rows){
  const cells = LEVELS.map(l => levelMins(w, l).toFixed(1).padStart(7)).join("");
  console.log(w.key.padEnd(12) + String(w.order).padEnd(6) + cells);
}

console.log("\nTIME TO FIRST CLEAR (Mudslide L1) — the single most important onboarding number");
const m = WS.WORLDS.mudslide;
console.log(`  target ${WS.levelTarget(1)} pts  =  ~${Math.round(WS.levelTarget(1)/POINTS_PER_TILE)} tiles`);
console.log(`  letters arrive every ${dropAt(m,1)/1000}s`);
console.log(`  => ${levelMins(m,1).toFixed(1)} minutes before a new player sees their first win\n`);

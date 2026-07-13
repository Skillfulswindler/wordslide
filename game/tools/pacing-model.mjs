/* Wordslide — pacing model
   ============================================================================
   run:  node tools/pacing-model.mjs

   Prints, for every world and level: how much breathing room the player has per
   word, and — the number that actually decides retention — HOW LONG A LEVEL TAKES.

   THE INSIGHT THIS MODEL ENCODES. A level is not gated by how clever the player
   is. It is gated by LETTER SUPPLY. Clearing a level needs roughly
   `target / pointsPerTile` tiles placed, and tiles arrive at exactly one per
   `dropEvery` ms. So:

       level duration  >=  tilesNeeded x dropInterval

   Playing better does not shorten a level. It only buys slack against the tray
   overflowing. "Level 1 feels long" is therefore a CONFIG fact, not a skill
   issue, and there are only three levers: lower the target, speed up the slide,
   or score more per tile.

   It imports the REAL numbers from src/tuning.js. It does not restate any of
   them — a model carrying its own copy of the config disagrees with the game the
   first time someone turns a knob, and then misleads you with great authority.
   ========================================================================== */

global.window = { innerWidth:480, innerHeight:854 };

await import("../src/tuning.js");
const WS = global.window.WS;

if (!WS.WORLDS || !WS.levelTarget){
  console.error("ABORT: tuning.js did not load; any table printed would be wrong.");
  process.exit(2);
}

/* The two behavioural assumptions, stated out loud so they can be argued with.
   Everything downstream is arithmetic. Both come from the HANDOFF playtest. */
const TILES_PER_WORD  = 3.6;
const POINTS_PER_TILE = 4.4;   // ~16 pts / 3.6 tiles, incl. modest bonus + combo uplift

const dropAt  = (w, L) => Math.max(w.minDrop, w.dropEvery - w.ramp * (L - 1));
const perDrop = w => (w.mode === "wave" ? (w.waveCount || 1) : 1);

// seconds the player can afford per word before the tray runs away from them
const secPerWord = (w, L) => TILES_PER_WORD * (dropAt(w, L) / 1000) / perDrop(w);

// how long the level LASTS — gated by letter supply, not by skill
const levelMins = (w, L) => {
  const tiles       = WS.levelTarget(L) / POINTS_PER_TILE;
  const secsPerTile = (dropAt(w, L) / 1000) / perDrop(w);
  return (tiles * secsPerTile) / 60;
};

const LEVELS = [1, 3, 5, 7, 10];
const rows   = WS.WORLD_ORDER.map(k => WS.WORLDS[k]);
const head   = "world        ord " + LEVELS.map(l => ("L" + l).padStart(7)).join("");

console.log("\nSECONDS PER WORD the player can afford");
console.log("  (<8s = frantic · 15-20s = casual comfort · >25s = sleepy)");
console.log(head);
for (const w of rows)
  console.log(w.key.padEnd(12) + String(w.order).padEnd(4) +
    LEVELS.map(l => secPerWord(w, l).toFixed(1).padStart(7)).join(""));

console.log("\nDIFFICULTY ORDER at L1 (easiest first) — must track play order 1..7");
[...rows].sort((a, b) => secPerWord(b, 1) - secPerWord(a, 1))
  .forEach((w, i) => {
    const bad = (i + 1 !== w.order);
    console.log(`  ${i + 1}. ${w.key.padEnd(11)} ${secPerWord(w, 1).toFixed(1)}s` +
                (bad ? `   <-- MIS-ORDERED: it sits at position ${w.order}` : ""));
  });
console.log("  (raw letter rate only — boulders/embers/gusts/frost stack on top)");

console.log("\nMINUTES PER LEVEL  (mobile casual wants 2-4 min; >6 is a grind)");
console.log(head);
for (const w of rows)
  console.log(w.key.padEnd(12) + String(w.order).padEnd(4) +
    LEVELS.map(l => levelMins(w, l).toFixed(1).padStart(7)).join(""));

console.log("\nTIME TO FIRST CLEAR (Mudslide L1) — the most important onboarding number");
const m = WS.WORLDS.mudslide;
console.log(`  target ${WS.levelTarget(1)} pts  ~=  ${Math.round(WS.levelTarget(1) / POINTS_PER_TILE)} tiles`);
console.log(`  a letter lands every ${dropAt(m, 1) / 1000}s`);
console.log(`  => ${levelMins(m, 1).toFixed(1)} min before a new player sees their first win\n`);

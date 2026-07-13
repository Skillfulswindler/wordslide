/* Wordslide — TUNING KNOBS. Everything that decides how hard the game feels.
   ============================================================================
   Pulled out of worlds.js so that the numbers you actually balance live in one
   small file, and so the pacing model (tools/pacing.mjs) can import the REAL
   values rather than carrying its own copy of them. A model with a private copy
   of the config disagrees with the game the first time someone turns a knob, and
   then it lies to you with great authority.

   Loaded after layout.js, before worlds.js.

   ---------------------------------------------------------------------------
   HOW THE PACING ACTUALLY WORKS — read this before touching a number.

   A level is NOT gated by how clever the player is. It is gated by LETTER
   SUPPLY. Clearing a level needs roughly `levelTarget / pointsPerTile` tiles on
   the board, and tiles arrive at exactly one per `dropEvery` ms. Therefore:

       level duration  >=  tilesNeeded x dropInterval

   Playing better does not make a level shorter. It only buys you slack against
   the tray overflowing. So if a level "feels long", that is a config fact, and
   the only three levers are: lower the target, speed up the slide, or score more
   per tile.

   The other number is the player's breathing room:

       seconds per word  =  3.6 tiles/word x dropInterval / lettersPerDrop

   Below ~8s is frantic. 15-20s is casual comfort. Run `node tools/pacing.mjs`
   after ANY change here — it prints both tables for every world and level.
   ========================================================================== */
(function(){
"use strict";
const WS = (window.WS = window.WS || {});

/* ---- levels -------------------------------------------------------------
   levelTarget was 150 + 60*(L-1). That made deep levels balloon: by L10 it
   demanded ~43 words, while the slide had sped up, turning L8+ into a 6-8 minute
   grind — long after the level had stopped teaching the player anything. The
   curve is flatter now; combo scoring is what should carry a strong run, not
   sheer volume of words.

   allowedLosses is the tension curve and it is GOOD — 10 letters of slack at L1
   down to a floor of 3. Left alone deliberately. */
WS.levelTarget   = l => 130 + 45*(l-1);          // score needed to clear level l
WS.allowedLosses = l => Math.max(3, 11 - l);     // letters you may lose on level l

/* ---- worlds -------------------------------------------------------------
   dropEvery : ms between tumbling letters at level 1
   ramp      : ms shaved off dropEvery per level
   minDrop   : floor — the slide never gets faster than this
   mode      : "steady" = one letter per drop; "wave" = waveCount letters at once
   (Tile legibility is now carried by the fully OPAQUE board — the per-world
   `scrim` veil was removed with the v7 board-translucence experiment.)

   ORDERING RULE: worlds must get harder in play order. `tools/pacing.mjs` prints
   the L1 difficulty ranking and flags any world sitting out of position — the
   raw letter rate must be monotonic, and the per-world mechanic (boulders,
   embers, gusts, frost) then adds difficulty ON TOP of that. */
WS.WORLDS = {
  mudslide: { key:"mudslide", name:"Mudslide", order:1, sub:"Slow & sticky. Learn the ropes.", unlock:0,
    dropEvery:6800, ramp:520, minDrop:2800, mode:"steady",
    accent:0xB87333, accentD:0x7A4A1E, sky:[0xCDB89A,0xF1E7D6], mtn:[0x9C6B3F,0x7A8B5A] },
  landslide:{ key:"landslide", name:"Landslide", order:2, sub:"Boulders block the board — crack them with words.", unlock:300,
    dropEvery:6300, ramp:500, minDrop:2600, mode:"steady", boulderEvery:16000,
    accent:0xA9843E, accentD:0x6B4A24, sky:[0xD9C6A8,0xF4EADB], mtn:[0x8A7355,0x6E7D54] },
  avalanche:{ key:"avalanche", name:"Avalanche", order:3, sub:"Letters arrive in sudden bursts.", unlock:450,
    dropEvery:11800, ramp:820, minDrop:5200, mode:"wave", waveCount:2,
    accent:0x5B93C4, accentD:0x39617F, sky:[0xAFC7DA,0xEAF2F7], mtn:[0x8FA6B8,0xC7D6E0] },
  volcano:  { key:"volcano", name:"Volcano", order:4, sub:"Ember letters burn away if not played fast.", unlock:600,
    dropEvery:5600, ramp:460, minDrop:2400, mode:"steady", emberChance:0.16, emberFuse:22000,
    accent:0xE03826, accentD:0x9E1B0E, sky:[0xE7A77F,0xF5D6C6], mtn:[0x7A2A1C,0xC0392B] },
  sandstorm:{ key:"sandstorm", name:"Sandstorm", order:5, sub:"Gusts scramble your tray.", unlock:750,
    dropEvery:5200, ramp:430, minDrop:2300, mode:"steady", gustEvery:14000,
    accent:0xF0B02E, accentD:0xA86E10, sky:[0xEED9A8,0xFBF1D8], mtn:[0xD9A441,0xC28F58] },
  // Waterfall is the raw-speed world and MUST be the fastest of the steady worlds.
  waterfall:{ key:"waterfall", name:"Waterfall", order:6, sub:"A constant, relentless flow.", unlock:900,
    dropEvery:4400, ramp:380, minDrop:2000, mode:"steady",
    accent:0x1493C0, accentD:0x0C5A78, sky:[0x9AD3E6,0xE3F4F9], mtn:[0x2E8BA8,0x7FC2D6] },
  // Blizzard is LAST, so it must not be gentler than Waterfall. It used to be
  // (5900 vs 5300) and only the frost mechanic disguised it.
  blizzard: { key:"blizzard", name:"Blizzard", order:7, sub:"Frost hides your letters.", unlock:1050,
    dropEvery:4200, ramp:360, minDrop:1900, mode:"steady", frostEvery:12000, frostCount:2, frostDur:4200,
    accent:0x4F9BD8, accentD:0x356B99, sky:[0xDCEAF4,0xFFFFFF], mtn:[0xB8CFE0,0xE4EEF6] },
};

WS.WORLD_ORDER = ["mudslide","landslide","avalanche","volcano","sandstorm","waterfall","blizzard"];
})();

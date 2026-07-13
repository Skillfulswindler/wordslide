# Wordslide — project guide

Context for anyone (human or agent) picking up this codebase. Wordslide is a
mobile word game: **"Spell fast. Before it falls."**

## The game (v2 — this is the locked design)

A **Words-With-Friends-style 15×15 board** with bonus squares, played solo
against time pressure instead of an opponent:

1. Letters **tumble down the left-side channel** of the screen, one at a time
   (bouncing, spinning), and land in the **7-slot tray** at the bottom.
2. New letters enter the tray from the left and **push older letters right**;
   when the tray is full, the oldest letter is **pushed off the edge and lost**.
3. The player **drags letters from the tray onto the board** to spell words —
   **full crossword rules** (first word crosses the center ★, later words must
   connect, all cross-words must be valid). Tap **Play word** to score.
4. Played tiles stay on the board, like WWF. Bonus squares (2L/3L/2W/3W, ★)
   multiply newly placed tiles.
5. **Levels:** reach the target score (150 + 60·(L−1)) to clear the level; the
   board sweeps clean, the slide speeds up, and the loss allowance tightens —
   **10 lost letters allowed on level 1, one fewer per level (floor 3)**.
6. **Lose** when the lost-letter meter is spent.

Trademark distance vs WWF/Scrabble: solo real-time survival (no opponent, no
turns), letters arrive by conveyor not by rack-refill, original bonus-square
layout (8 TW / 12 DW / 10 TL / 20 DL / center ★, 4-way symmetric — NOT either
game's arrangement), neutral 2L/3L/2W/3W labels, original theme/art/names.

## Tech stack

- **Phaser 3** (canvas/WebGL) · **Vite** · **Capacitor** (native iOS+Android)
- App id `com.wordslide.game`. Store steps: `NATIVE_BUILD.md`.

## Run / build

```bash
npm install
npm run dev            # play at http://localhost:5173
npm run build          # -> dist/  (verified passing)
```

## Architecture

```
src/main.js         entry; sets window.Phaser + window.WORDLIST, then dynamic-imports
                    worlds -> audio -> monetize -> game -> scenes -> ui -> boot (ORDER MATTERS)
src/worlds.js       config: dictionary, letter values/bag, BOARD_BONUS layout (WS.sqAt),
                    layout constants (tray/channel/dump), WORLDS, POWERS, store, XP,
                    daily goals, seeded RNG, share, haptics, level formulas
src/audio.js        WS.Audio — synthesized SFX + generative per-world music
src/monetize.js     WS.Ads — interstitial/rewarded stubs + removeAds flag
src/game.js         GameScene — tray/tumble system, drag & drop, crossword validator
                    (validateMove — PURE, unit-tested), scoring, levels, world
                    mechanics, tutorial, results/XP; modes classic|daily|duel
src/scenes.js       Home + Select + WS.ui helpers
src/ui.js           Settings, Stats, Daily, Duel setup/handoff/results
src/words.js        269,870-word dictionary (2–15 letters; 2-letter words REQUIRED
                    for crossword rules)
src/boot.js         Phaser.Game with all 9 scenes
```

Modules are IIFEs attaching to `window.WS`; keep the dynamic-import order.

## Key game.js systems

- **Tumble/tray:** `dropLetter → tweens.chain (bounce down channel) → enterTray
  → unshift; overflow → loseTile` (meter++, game over at `allowed`).
- **Drag & drop:** scene-level pointer events; dragged tile floats **above** the
  finger (occlusion), drop-target cell highlighted; drop on board = provisional;
  drag to the 🗑 chute = discard for ⚡8; **Recall** returns provisional tiles.
- **validateMove():** pure function of board+prov: one line, contiguous, first
  move on ★ (2+ letters), connectivity, all words (main + crosses, len≥2) in
  DICT; scoring = letters × letter-mults (board 2L/3L on new cells, gold ×2,
  ember ×2) × word-mults (new cells) per word, +40 full-tray bonus,
  × combo (1+0.1·n, 25s window) × golden power. **Committed unit suite:
  `test/validate.test.mjs`** (part of `npm test`) — stubs Phaser.Scene, imports
  the REAL modules, and exercises placement rules, connectivity, dictionary,
  cross-words, and every scoring multiplier. Rerun after touching validateMove.
- **Worlds:** mudslide (slow), landslide (**boulders** land on board squares;
  crack +10 by playing an adjacent word), avalanche (letters in bursts of 3),
  volcano (**ember letters** burn away in the tray = count as lost),
  sandstorm (**gusts scramble the tray**), waterfall (fast), blizzard (**frost
  hides tray letters**). Unlock = best score in previous world.
- **Powers:** Slow ⚡18, Shuffle ⚡14, Vowels ⚡12 (next 3 are vowels),
  Purge ⚡10 (Q/Z/X/J out of tray), Golden ⚡26 (next word ×2). Energy = +1 per
  tile played. Discard costs ⚡8.
- **Modes:** classic (levels), daily (2-min score attack, date-seeded letter
  stream, streaks/share), duel (pass-and-play, same seed, 2 min each). All
  randomness flows through `this.rand` (mulberry32 when seeded) → ready for
  future online async PvP.

## Persistence / progression

localStorage `wordslide_save`: best scores + best level per world, bestWord,
settings (music/sfx/haptics/colorblind), xp (level = 250+(n−1)·150 curve),
3 daily goals (60 XP each), daily streaks, duel tally, tutorialDone, removeAds,
unlockAll (testing toggle in Settings).

## v2.5 — ship-ready: device tuning, live ads/IAP, analytics, privacy

July 12, 2026. The release layer. **Read `NATIVE_BUILD.md` and
`../store/STORE_SUBMISSION.md` before touching any of it.**

New modules (load order in `main.js` matters — layout FIRST):

```
src/layout.js     WS.solveLayout — PURE device-geometry solver. Runs before every
                  other module because art/game/scenes/ui destructure W/H/CELL/
                  BOARD_*/TRAY_*/SAFE at IMPORT time; anything earlier captures
                  stale geometry. Canvas height now follows the device aspect
                  (800–920); safe-area insets are charged only for the part that
                  actually OVERLAPS the canvas (the letterbox absorbs the rest —
                  iPhone 15 pays 12px of its 59px notch, not 59). Lower stack is
                  bottom-anchored so it clears the gesture bar.
src/health.js     WS.Health — durable status artifact. THE point: "$0 revenue" and
                  "the SDK never initialised" look identical in a dashboard and need
                  opposite responses. Surfaced in Settings → Diagnostics.
src/analytics.js  WS.Analytics — ONE event taxonomy, swappable emitters (Firebase
                  native; console in dev). Unknown event/prop names are dropped
                  loudly. Chose Firebase over GameAnalytics for native AdMob
                  ad-revenue reporting + BigQuery export; adding GameAnalytics later
                  = adding an emitter, not re-instrumenting the game.
src/econ.js       WS.Econ — coins. balance() is the ONE predicate; spend() cannot go
                  negative and returns false (callers MUST check); every movement is
                  ledgered; chest odds are published and unit-tested against 20k
                  rolls. Offer fires at the NEAR-MISS (65–100% of target), not at run
                  start — players spend when close to a goal, not when facing one.
src/monetize.js   WS.Ads / WS.IAP / WS.Entitle — real AdMob + RevenueCat (was a stub).
                  Entitle.isPremium() is the ONLY definition of "paid". The RECEIPT
                  is the truth, localStorage is a cache — RevenueCat revokes as well
                  as grants, but offline is NOT a revocation. Rewarded ads grant only
                  on genuine completion. Consent → ATT → SDK init, in that order
                  (ATT after a decline is an App Store rejection).
```

`WS.MONETIZE` holds every ad/IAP id in ONE place, and `isProd()` is a POSITIVE check
that the real ids were filled in — until then the build uses Google's test units and
RevenueCat refuses to start. This is deliberate: real ad requests from a dev build get
an AdMob account banned, not warned.

New scenes: `WS.ShopScene` (coins, chest, remove-ads), `WS.DiagScene` (health).
Tests: `npm test` → `test/run-tests.mjs`, **87 assertions** (10-device layout matrix +
economy + chest odds). Store art: `store/tools/gen_store_art.py`. Screenshots:
`store/tools/shots.mjs` — captures the REAL build at exact store sizes and fails on any
console error (a Phaser scene that throws does not blank the page; it just stops, and a
frozen canvas screenshots fine).

⚠️ `WS.PRIVACY_URL` in `worlds.js` GUESSES the GitHub username. Publish `docs/` to
Pages and fix it, or the in-app privacy link 404s and the app is rejected.

⚠️ **Sandbox note for future agents:** the Cowork bash mount served *stale and torn*
reads of modified files in this session (new content truncated to the old byte length).
New files synced fine. Do not trust a `grep`/`node --check`/build result from the mount
against a file you just edited — verify with the file tool, and run the real build on
the host.

## Status: v2.1.0 — machine-playtested end to end

July 2, 2026: full headless-browser playtest pass (Playwright + chromium in the
dev sandbox — harness lives at ~/pw in the Cowork VM, pattern documented below).
Fixed this round: **the drop bug** (onUp cleared `this.drag` before `dropCell()`
read it → tiles could never land on the board), drop target now computed from
the pointer (occlusion offset is visual-only, touch-aware), WebGL-only gradient
calls replaced with baked textures (crashed the canvas renderer), unhandled
clipboard rejection, tutorial button overlap.

**Look & feel (v2.1):** bundled display font (Baloo 2 via @fontsource — set in
`WS.FONT`, chunky outlined text via `WS.T()`/`WS.shadow()`), per-world jungle-style
foliage framing (canopy + swaying corner fronds + bottom bush, baked in
`WS.Art.foliage`/`dressScene`), wooden sign headers, chunky beveled buttons,
confetti celebrations (`WS.Art.confetti`). Boot waits for fonts (2.5s cap).

**Rendering is texture-baked** (`src/art.js`): world scenery, board cells,
wooden frames, tray panel, tile faces are generated ONCE into textures —
Phaser re-tessellates live Graphics every frame, so keep new static art in
art.js, not in per-frame Graphics.

Verified by scripted play: tutorial (drag SLIDE through ★, score 12), cross-word
scoring, tumble→tray→overflow→lose meter→game over, level clear→level 2 with
tighter allowance, all 5 powers, daily (seeded, timed), duel P1→handoff→P2→
results, settings toggles, stats. Zero console errors.

**SVG illustration layer (v2.2, `src/svgart.js`):** the "asset pack" tier —
hand-authored vector scenes per world (gradient skies, glowing sun, bezier
mountain layers, volcano/waterfall/dune/pine set pieces) + a 10-icon UI set,
rasterized at 2x by `WS.PreloadScene` (boot.js) via Image decode (renderer-
agnostic; no free packs are reachable from the sandbox — npm was checked).
`WS.Art.scenery` prefers `bg_<world>` textures and falls back to procedural.
Add new art as SVG strings in svgart.js; keep it in the manifest.

**v2.3 competitive-parity round** (researched vs WWF's Tile Bag / Word Strength):
next-letter preview queue in the tumble channel (`nextQ`/`paintNext` — the
planning tool; Vowels power rewrites the visible queue), proper pause menu
(`WS.PauseScene`: resume/restart/quit — Menu no longer kills the run), all menu
scenes unified on the SVG art (`menuBG` in ui.js), wooden results/level-clear
cards, rare-letter rule (+12 per Q/Z/X/J), 8 achievements (WS.ACH). Pressure
suite: restart-leak (stable), input fuzz, marathon-to-L7 — all clean.

**v2.4 round** (researched vs Wordscapes' GREAT!/SPECTACULAR! tier system):
word-quality praise tiers (`praise()` — NICE/GREAT/AMAZING/SPECTACULAR at
25/45/70/100 pts with scaled confetti/arpeggio/haptics), **tap-to-place**
(tap a tray tile → carry mode with hover pulse, tap an empty cell → place;
coexists with drag; `dropCarry()` guards submit/recall/powers/endRun),
StatsScene rewritten compact 2-column (was overflowing after 7 worlds —
regression from the 5-world layout).

**2D world backgrounds (v7):** bright cartoon PNG scenes (960×1708) live at
`src/assets/backgrounds/bg_<world>.png` (sources + generator in `art/`).
`WS.PreloadScene` (boot.js) loads them **filename-driven** via
`import.meta.glob('./assets/backgrounds/*.png')` → texture key `bg_<name>`, then
runs `WS.SVGART.loadAll` as fallback (its `toTexture` skips keys that already
exist), then starts `home`. Drop in more `bg_*.png` (incl. `bg_home.png`) and
they load automatically — nothing is hardcoded. `home` stays procedural. Vite
bundles them (hashed URLs); do NOT put the `Textures/tiles/` PBR sets here
(those are for letter tiles/board, separate task).

Superseded: `Wordslide_Game_v1–v11.html`. Current export: `Wordslide_Game_v12.html`
(regenerate: `node game/build_standalone.mjs <prevExport> <outFile>` — reuses the
previous export's head/font/wordlist preamble, re-concats the modules from
current `src/`, and swaps the `import.meta.glob` manifests for inline base64
maps read from the current asset files. Phaser via CDN).

## v2.5.1 — audit fixes (July 13, 2026 — see HANDOFF/cowork-notes-02.md)

Full engineering + design audit by Cowork. Fixed in this round:
- **Analytics truth pass:** `word_played.len` sent the string "undefined" on
  every event (read `.length` of a detail object — now `res.main.length`);
  `level_start` now fires from `nextLevel()` so L2+ have matching starts;
  `level_end (fail)` moved outside the `counted` guard so a death AFTER a
  Second Wind still emits (XP/stats still count once); `offer_shown` tracked
  whenever the offer renders, with context near_miss|results.
- `WS.VERSION` bumped to 2.5.0 (was 2.4.0 — displayed on Home; keep in
  lockstep with package.json).
- **validateMove tests committed** (`test/validate.test.mjs`, in `npm test`).
- **The 5 power icons** (`ic_slow/shuffle/vowels/purge/golden`) now exist in
  svgart.js — powers no longer render as text labels. Drop-in PNGs at
  `assets/icons/ic_<power>.png` still override them.
- Docs de-drifted: README rewrote (was describing the abandoned v0.1 swipe
  game), START_HERE + CLAUDE_CODE_PROMPTS pointers synced, Session 0 (git
  init) added to the prompts file.
Known open (needs Nick / host machine): git init + GitHub Pages + PRIVACY_URL
(Session 0), real-device feel pass (Session 1), monetization IDs (Session 4),
mudslide bg regenerate (`--ar 9:16`), `WS.Econ.REWARDED_AD_COINS` is defined
but has no placement yet (wire a capped shop button or delete before it becomes
a doc/code contradiction), bonus-square legibility check on device (colourblind
claim rests on a ~3px glyph at 28px cells).

## v2.5.2 — visual fix round (July 13, 2026 — HANDOFF/cowork-notes-03.md)

Four owner-directed visual fixes:
1. **Board is OPAQUE again.** The v7 "world glows through the empty cells"
   experiment is revoked (milky wash + a pale block over the board). `buildBoard`
   draws the cells and bonus tags at full alpha, the dark scrim is gone, and the
   per-world `scrim:` values were removed from tuning.js (tile legibility now
   rides on the opaque board). The "pale square" was `panel_frame.png`'s cream
   centre — `WS.Art.hollowFrame` now ALWAYS punches a transparent centre (canvas
   erase) on both the shipped and procedural paths, so a hollow frame is hollow
   regardless of the source PNG.
2. **No platform emoji in the UI.** New drawn icons in svgart.js
   (`ic_bolt/coin/gift/trophy/menu`) replace every ⚡🪙🎁🏆☰ etc.; label rows use
   an icon+text pair (`GameScene.iconNum`, `WS.ui.iconText`), toasts were reworded.
   Emoji inside SHARE text (clipboard) stays.
3. **Button skins parked.** The six `btn_*.png` + `btn_base.png` moved to
   `art/parked/` (plank-photo 9-slice smeared through the middle) — buttons fall
   back to the procedural bevel, which tints per world and reads clean. The
   panels (`panel_frame/wood/tray`, `sign_wood`, `slot_empty`) passed the eyeball
   test and stay.
4. **"Climb the slide" map rebuilt.** `WS.Art.mapBackdrop` returns `bg_map` when
   `assets/backgrounds/bg_map.jpg` is present (procedural fallback otherwise, with
   its right-flank + sun bugs fixed). Node medallions are now a CIRCULAR CROP of
   each world's own background (`WS.Art.mapNode` via canvas — accent ring, gloss,
   desaturated + `ic_lock` when locked), the world number sits in a badge
   bottom-right, and every label rides a translucent plate (`WS.Art.mapPlate`) so
   it reads on snow / trail / paint. Trail footpath-dots removed; trail alpha 0.9.

## Roadmap / next

1. Human playtest; tune pacing + tray drag feel on a real phone.
2. Tablet layout pass (see research doc §tablets).
3. Icons/splash (`npx @capacitor/assets generate`), native builds, AdMob/IAP.
4. Online async duel (Supabase) reusing the seeded letter stream.

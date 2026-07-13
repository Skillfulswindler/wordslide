# Cowork notes 03 — visual fix round (owner-reported + live play-test findings)
*July 13, 2026. Nick play-tested the map + several worlds and reported four issues; Cowork
play-tested the real build over Chrome (map → Mudslide → tile placement — zero console
errors, tap-to-place works, new power icons live). This is the implementation spec for the
next Claude Code session. Everything below is OWNER-DIRECTED — do not re-litigate the
board-translucence decision, just remove it.*

---

## 1. Kill the board translucence + find the pale square (owner: "get rid of it")

The v7 "world glows through the empty cells" experiment is REVOKED. On real screens it
reads as a milky wash, and on most worlds there is a visible pale rectangle sitting
under/over the board region (see Nick's Blizzard + Sandstorm screenshots — a crisp-edged
pale block roughly board-sized, slightly offset, extending past the frame edge).

Do:
- Draw the cell grid fully OPAQUE: remove `.setAlpha(0.82)` on the board image and the
  `0.85` alpha on bonus tags in `buildBoard()` (game.js).
- Remove the dark scrim graphics entirely (`scrim.fillStyle(0x0D1426, cfg.scrim)`), and
  remove the now-dead `scrim:` values from tuning.js worlds (keep a comment that tile
  legibility is now carried by the opaque board).
- HUNT THE PALE SQUARE while the board is still translucent (easier to see). Suspects,
  in order: (a) the shipped `panel_frame.png` baked by `hollowFrame()` — if its centre
  is cream rather than transparent, the whole board area gets a pale fill; (b) the
  `h+4` under-shadow band baked into frame/tray textures showing as a pale strip;
  (c) `cell_base.png` compositing in the `boardcells` RenderTexture. Fix at the source,
  not with a cover-up rect.
- Acceptance: no pale rectangle on ANY of the 7 worlds + home; board fully opaque; the
  wooden frame edge crisp all the way round. Screenshot each world (`?world=<key>`).

## 2. Remove every ⚡ emoji — replace with a drawn bolt icon (owner: "AI slop")

Platform emoji render inconsistently and look pasted-on. Add `ic_bolt` to svgart.js
(chunky lightning bolt, gold `#FFC336` fill, `#4A2E14` outline, same 48-viewBox style as
the other icons) and replace every visible ⚡:

- game.js: powers-row cost labels (`"⚡"+p.cost`), the energy HUD (`"⚡ "+this.energy` /
  `"⚡ FREE"`), the dump chute (`"⚡"+DUMP_COST`), toasts ("Need ⚡8 to toss" → "Need 8
  energy to toss", "start with ⚡30" wording, etc.).
- ui.js ShopScene: "⚡ Head start", "Begin your next run with ⚡30", "⚡ Free power…" toast.
- worlds.js POWERS descs if any slip through to UI.
- Pattern: for label rows, render `ic_bolt` image + number text side by side (the
  `button()` icon param and the powers row already do image+text composition). For
  plain-text toasts, reword without the glyph.

While in there, audit the OTHER emoji the same way (owner called out ⚡ specifically,
but the same argument applies): 🪙 coins (home pill, shop, level-clear card, results
offer), 🎁 chest, 🔥 streak (ic_flame exists — use it), 🔒 (ic_lock exists), 🏆
(ic_trophy is spec'd in ART_BIBLE §4.5 — add it to svgart), ☰ Menu, 🗑 (ic_trash
exists), 🎬 on the Second Wind button, 🚫 on remove-ads. Add `ic_coin` + `ic_gift` to
svgart (gold coin with W emboss; wrapped gift box). Emoji inside SHARE TEXT (copied to
clipboard) can stay.

## 3. Buttons: the wood-panel 9-slice is misreading (owner: "misused wood panel textures")

The shipped `btn_*.png` skins stretch a plank-photo texture through the 9-slice middle —
plank seams smear and repeat (clearly visible on Recall / Play word). Two-step fix:

1. IMMEDIATE: park the six `btn_*.png` (+ `btn_base.png`) out of `src/assets/ui/` into
  `art/parked/` so `WS.Assets.btnSkin()` finds nothing and every button falls back to the
  procedural bevel (which reads clean and tints per world). Keep `panel_tray`,
  `panel_wood`, `panel_frame`, `sign_wood`, `slot_empty` ONLY if they pass the same
  eyeball test after fix #1 — park any that don't.
2. LATER (art round): proper button art authored AS buttons (uniform surface, detail only
  in the corners/lip, per ART_BIBLE §4.4 insets) — not crops of a plank panel.

## 4. Rebuild the "Climb the slide" screen (owner: "looks terrible")

Three sub-fixes:

a) **Backdrop**: replace the flat procedural `mapBackdrop` with painted art. Nick is
   generating `bg_map` in Midjourney (same --sref as the world set; export 960×1708,
   drop at `src/assets/backgrounds/bg_map.jpg`). Change `WS.Art.mapBackdrop` to return
   `bg_map` when the texture exists, procedural fallback otherwise (same pattern as
   `scenery()`). The art is prompted with an OPEN central face and NO painted trail —
   our Catmull-Rom trail stays and defines the route; consider dropping trail opacity
   slightly (~0.9) so it sits INTO the painting rather than on it.
   Until the art lands, ALSO fix the procedural fallback's two bugs Cowork found:
   the right-flank shading polygon drops a hard VERTICAL line from the peak
   (`lineTo(peakX,H)`) — make it follow the slope; and the sun overlaps the header text.

b) **Node medallions** ("little circle icons"): replace the flat colored discs with
   world-portrait badges — bake each node as a CIRCULAR CROP of that world's own
   background (`bg_<world>`, centre-weighted crop via canvas, like bakeNine does),
   inside a chunky ring in the world accent, gloss highlight on top. Locked = same
   portrait DESATURATED (canvas grayscale pass) + dark ring + `ic_lock`. This uses art
   we already own and will read instantly ("that's the volcano level"). Number moves to
   a small badge bottom-right of the medallion rather than covering the portrait.

c) **Layout collisions** (from Cowork's live test + Nick's screenshots): the Blizzard
   label sits on the white snow cap and vanishes — give the summit node's label a
   stronger treatment or nudge the top node down; trail footpath dots pass through
   several labels — mask dots near label rects or drop dots under labels; sub-labels
   ("Reach 1050 in Waterfall") clip against the trail on Waterfall/Blizzard.
   Acceptance: every label legible on a screenshot at 480 logical width, locked and
   unlocked states, test-bar on and off.

## Verification for the whole round
`npm test` → `npm run build` → screenshot: home, map (locked + test-mode), all 7 worlds
in-game, shop, settings. No console errors. Then commit + push, and regenerate the
standalone (`node build_standalone.mjs ../Wordslide_Game_v11.html ../Wordslide_Game_v12.html`)
— note Cowork already fixed the MODULES list in build_standalone.mjs (it was missing
layout/tuning/health/analytics/econ; v8–v11 exports are suspect — sanity-open v12).

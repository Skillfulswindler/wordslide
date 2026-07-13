# Cowork notes 04 — WORK ORDER: close the parking exploit + Home art on the map
*July 13, 2026. Two owner-directed items, to ship BEFORE the Android Studio session.
Owner-verified symptoms; specs below. Feel numbers are first-pass — tune live with Nick.*

---

## W/O 1 — Provisional tiles must not be a safe harbour (the parking cheat)

**The exploit (owner-demonstrated, Volcano screenshot):** letters dragged onto the board
but never played sit there forever. They are outside the tray, so they can never be
pushed off; the loss meter only counts tray overflow. A player can park every arriving
letter on the board and stall indefinitely — the fail state is fully dodgeable in
classic mode. Bonus leak in the same family: `service()` only ticks ember fuses for
tiles in `this.tray`, so dragging an ember onto the board (without playing it) FREEZES
its fuse.

**The fix — "the slide sweeps loose tiles":** a provisional tile left on the board too
long is swept off and counts as a lost letter. Thematic (loose letters get buried),
per-level (tightens as the slide speeds up), and it closes the stall completely.

Spec:
- Each provisional tile gets `placedAt` when it lands on the board (drag-drop, tap-place,
  and the bounce-back path in `returnToTray` that re-boards a tile). Recall / re-grab
  clears it.
- Sweep timeout: `SWEEP_S = max(12, 26 - level)` seconds (26−L, floor 12 — L1 = 25s,
  generous; L14+ = 12s). Expose it in tuning.js next to the other knobs, NOT hardcoded.
- Warning state at 65% elapsed: the tile wobbles (small angle yoyo tween) and pulses a
  countdown ring/tint — the player must SEE it coming; a silent sweep will read as a bug.
- On expiry: the tile slides off the board edge with dust (reuse loseTile's motion +
  `WS.Juice.sparks`), `this.lost++`, meter update, `tile_lost` analytics, endRun check —
  i.e. route it THROUGH `loseTile(tile,"swept")` (generalise loseTile to accept
  non-tray tiles) so every loss path stays one function.
- Toast on first sweep of a run: "Swept away! Loose letters don't last." Teach once,
  then stay quiet.
- Pause/entry-sequence/tutorial: the timer must not tick while `!this.running` or during
  the entry hold; simplest is to advance per-tick in `service()` (`+250ms` per tick)
  rather than wall-clock, since service() already respects `running`.
- Ember fix in the same pass: ember fuses keep burning while PROVISIONAL (tick
  `this.prov` embers in service() too); the fuse still stops permanently on COMMIT
  (submit), as today.
- Tests: extend test/validate.test.mjs or a small new suite for the pure parts if any
  are extracted; at minimum a scripted check that a parked tile is lost after the
  timeout and that recall resets the timer.
- OPTIONAL second knob if feel-testing wants it: cap live provisional tiles at
  TRAY_SIZE (8th placement refused with a shake). Ship the sweep first; add the cap
  only if Nick still finds parking abusable.

**Do not** expire COMMITTED (played) tiles — only provisional ones. Played tiles staying
forever is the game.

## W/O 2 — Map backdrop: use the owner's HOME image (second request — just do it)

Owner wants `Background Images/Home.png` (the grand mountain establishing shot) as the
"Climb the slide" backdrop, replacing the procedural mountain. No new Midjourney art.

Spec:
- Import `Background Images/Home.png` through the same pipeline as the worlds
  (art/import_bgs.py pattern): cover-fit to 960×1708 anchored top, JPEG q88, write to
  `game/src/assets/backgrounds/bg_map.jpg`. (Note: this file was reported modified/
  unstaged earlier — use whatever is currently in Background Images/, and commit both.)
- `WS.Art.mapBackdrop` already prefers a `bg_map` texture — verify it picks it up and
  the procedural path remains only as fallback.
- LEGIBILITY PASS on top of the painting: the node medallions, label plates, and trail
  must read against the busy art. Keep the label plates from the last round; if the
  trail fights the painting, raise the trail's dark edge alpha or add a soft dark
  under-glow along the path. If any node face (world-portrait crop) blends into a
  similar-coloured region of the backdrop, thicken that ring.
- Screenshot acceptance: map in locked state AND test mode, every label readable,
  trail visibly connecting base→summit, no seams. Also check the HOME menu still looks
  right (it shares the same source art as bg_home — cohesion is fine, but verify the
  two screens don't feel like a duplicated frame; if they do, nudge the map's cover-crop
  anchor lower so the map shows more foothills than the menu does).

## Order of work + gate
1. W/O 1 (gameplay integrity beats art), 2. W/O 2.
`npm test` → `npm run build` → screenshots (map both states, Volcano parking scenario:
park 5 letters, watch the wobble→sweep→meter tick) → commit/push → regenerate standalone
v13. THEN proceed to the Android Studio session (Session 3) with these included.

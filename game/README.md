# Wordslide

A mobile word game. **Spell fast. Before it falls.**

A Words-With-Friends-style **15×15 bonus-square board**, played solo against time
pressure instead of an opponent. Letters tumble down the left-side chute into a
**7-slot tray**; new arrivals push old letters off the end (lose 10 on level 1,
one fewer each level, and you're buried). Drag or tap-to-place letters on the
board, full crossword rules, hit **Play word** to score. Clear the level target
and the slide speeds up. Seven fall-themed worlds (Mudslide → Blizzard), each
with a mechanic that attacks the tray differently. Modes: classic, daily
(seeded, 2-min), pass-and-play duel.

> **The full technical handoff — architecture, systems, gotchas, test patterns —
> is `CLAUDE.md` in this folder. Read that, not this, before touching code.**
> Balance knobs live in `src/tuning.js`; design doc: `../Wordslide_Design_Document.pdf`.

## Tech stack

- **Phaser 3** (game engine) + **Vite** (dev/build)
- **Capacitor** to package the same web build as native iOS + Android apps

## Run it (web / playtest)

```bash
npm install
npm run dev        # http://localhost:5173 — use a mobile viewport
```

Test access: `?test=1` unlocks all worlds; `?world=volcano&level=6` boots
straight in; `?canvas` forces the Canvas renderer.

## The gate (before any release)

```bash
npm test                          # layout device matrix + economy + validateMove
npm run build                     # must be clean
node ../store/tools/shots.mjs     # real screenshots, zero console errors
```

⚠️ Run these on the host machine. The Cowork sandbox mount serves stale/torn
reads of modified files — its results are not evidence (see CLAUDE.md).

## Native builds

See `NATIVE_BUILD.md` (store shipping guide) and `../store/STORE_SUBMISSION.md`
(privacy forms, listing copy, release checklist). App id `com.wordslide.game`.

## Status (v2.5)

Feature-complete release layer: live AdMob/RevenueCat/Firebase integrations
behind `WS.MONETIZE.isProd()` (placeholder IDs → test units by design), coin
economy, shop, daily chest, diagnostics screen. Blocking store submission:
real monetization IDs, published privacy policy URL, native builds, and a
real-device feel-tuning pass.

# Wordslide — integrate the new 2D world backgrounds (Claude Code task)

New bright 2D cartoon world backgrounds have been produced and exported:
- Final PNGs (960×1708 portrait): `game/src/assets/backgrounds/bg_<world>.png`
  Present: waterfall, volcano, mudslide, landslide, sandstorm, avalanche, blizzard.
- Source SVGs + reproducible generator (Python + cairosvg): `art/backgrounds/*.svg`, `art/gen_worlds.py`.

Goal: make the game use these PNGs as world scenery, keep the procedural/SVG path as fallback, and regenerate the single-file HTML export with the art embedded.

## Current scenery contract (don't break it)
- `src/art.js` → `WS.Art.scenery(scene, worldKey)` returns `'bg_'+worldKey` when `scene.textures.exists('bg_'+worldKey)`, else builds procedural art. So any texture named `bg_<world>` is used automatically.
- `src/boot.js` → `WS.PreloadScene` calls `WS.SVGART.loadAll(this)` then `this.scene.start('home')`.
- `src/svgart.js` → `loadAll()`/`manifest()` create `bg_<world>` textures from SVG strings; `toTexture` already guards with `textures.exists`.

## Tasks
1. In `WS.PreloadScene` (boot.js): load every `bg_*.png` in `assets/backgrounds/` as texture key `bg_<name>` (derive names from filenames — DO NOT hardcode; more worlds/`bg_home.png` may be added). Use `this.load.image(...)` in `preload()`. In `create()`, still run `WS.SVGART.loadAll(this)` so any world WITHOUT a PNG falls back to procedural (its `toTexture` skips keys that already exist). Only `this.scene.start('home')` after all loads resolve.
2. Keep `home` menu background on the procedural/SVG path (no `bg_home.png` yet).
3. Vite: ensure `assets/backgrounds/` is bundled (either `src/assets` imported by URL, or `public/assets/...`). Confirm `npm run build` includes them.
4. Regenerate single-file playable as `Wordslide_Game_v7.html` (same concat recipe as v6) but EMBED the 7 backgrounds as base64 data URIs (standalone file can't reference external files). Script it to read current PNGs from `assets/backgrounds/` at build time so re-runs pick up updates.
5. Verify with the headless Playwright harness (~/pw pattern in game/CLAUDE.md): boot each world, confirm `bg_<world>` texture is used (not procedural), zero console errors, stable texture count across a world sweep, scenery renders behind the board.

## Notes
- Art is still being refined: `bg_*.png` may be replaced in place and `bg_home.png` may be added. Keep everything filename-driven so re-running just picks up new/updated files.
- The PBR texture sets in `Textures/tiles/` (BaseColor/Normal/Height/Roughness/AO) are for the LETTER TILES / board surface — a separate task; do NOT put them in the sky scenes.

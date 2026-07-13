# Wordslide — Art Bible & Asset Spec

**Version 1.0 · July 2026 · for v2.4 of the game**

This is the single document you hand to an asset-pack search, a Scenario style model, or a
hired illustrator. Every filename in it is wired into the code already: **drop a PNG at the
path given and it appears in the game with no code change.** Anything you don't supply falls
back to the existing procedural art, so the game never breaks mid-way through an art pass.

---

## 1. The look we're buying

**One line:** *Bright, chunky, hand-illustrated 2D cartoon — the confidence of Angry Birds,
the warmth of a wooden board game.*

The game is a word game played on a wooden board, set on the slope of a mountain that is
falling apart around you. Seven worlds, each a different kind of slide (mud, rock, snow,
lava, sand, water, ice). The mood is **playful peril** — the mountain is coming down but
nobody is actually in danger. Think Saturday-morning cartoon, not disaster movie.

**Do:** thick confident outlines (3–5px at 2x), saturated but not neon colour, soft cel
shading with one clear light source (upper-left), rounded chunky forms, generous drop
shadows, a tactile "you could pick it up" quality on every interactive object.

**Don't:** thin lines, gradients-as-a-substitute-for-form, muddy desaturated palettes,
realism, photobashing, gritty texture, dark/horror framing, flat minimalism, anything that
looks vector-generated rather than drawn.

**Reference points:** Angry Birds (confidence, silhouette, outline weight), Toon Blast /
Royal Match (UI chunkiness, button feel, juice), Wordscapes (calm, legible word-game
surfaces), Alto's Odyssey (layered parallax landscapes, though we are far more saturated).

**The single most important asset is the letter tile.** It is on screen 100% of the time,
the player touches it constantly, and it is what a store screenshot is really showing. It
should feel like a heavy, slightly-worn wooden or ceramic tile you want to pick up. Spend
the most money here.

---

## 2. Palette (locked — these come from the code)

| Role | Hex | Notes |
|---|---|---|
| Ink (text/outline) | `#233A4F` | primary dark |
| Tile ink | `#4A2E14` | letters on tiles |
| Clay (primary CTA) | `#E0561F` / dark `#B8420F` | Play button |
| Teal (secondary) | `#0FB8B0` / dark `#0A928A` | confirm, positive |
| Gold | `#FFC336` | bonus, energy, stars |
| Cream | `#FFF7E8` | panels, tile face |
| Danger | `#E24B4A` | reset, lose meter |
| Purple (duel) | `#8E6FC1` / dark `#6B4F99` | duel only |
| Wood mid / dark | `#A9713D` / `#6E4526` | frames, shelf |

**Per-world accents** (backgrounds must sit against these without fighting them):
mudslide `#B87333` · landslide `#A9843E` · avalanche `#5B93C4` · volcano `#E03826` ·
sandstorm `#F0B02E` · waterfall `#1493C0` · blizzard `#4F9BD8`

---

## 3. Authoring rules (read before drawing anything)

The game canvas is **480 × 854 logical pixels**, scaled to fit the device.

**Everything except backgrounds is authored at 2× and drawn at 0.5 scale.** That keeps it
crisp on 3x phone screens. So when the table below says "108 × 112", that is the pixel size
of the PNG you deliver; it will display at 54 × 56.

- **Format:** PNG-24, transparent background (except backgrounds, which are opaque).
- **Trim:** no extra padding. The art must fill the stated canvas exactly — the code
  positions by the PNG's edges.
- **Naming:** exact, lowercase, as given. The filename *is* the code hook. `tile_n.png`,
  not `Tile_N.png` or `tile-n.png`.
- **9-slice assets** (panels, buttons) stretch to any size, so only the corners and edges
  matter. The **inset** column tells the artist how many pixels in from each edge the
  stretchable middle begins. Keep all detail (studs, grain, bevels) *inside* the inset.

---

## 4. The asset list

### 4.1 Backgrounds — `src/assets/backgrounds/` · **960 × 1708** · opaque

Full-bleed illustrated scenes. The board sits in the middle third, so **keep the vertical
band from y=220 to y=1100 (2x) visually calm** — low contrast, no busy detail — or the
letters become unreadable. Put your set pieces top and bottom.

| File | World | Content |
|---|---|---|
| `bg_home.png` | Menu | Warm, inviting establishing shot of the whole mountain. This is the first thing a player sees. |
| `bg_mudslide.png` | 1 | Wet brown hillside, sticky mud flows, sparse scrub. Gentle, tutorial mood. |
| `bg_landslide.png` | 2 | Dry rocky slope, tumbling boulders, cracked earth. |
| `bg_avalanche.png` | 3 | Blue-grey alpine peaks, snow shelf about to give way, pines. |
| `bg_volcano.png` | 4 | Cone, glowing crater, lava runnels, ash sky. The most dramatic. |
| `bg_sandstorm.png` | 5 | Dunes, ochre haze, wind streaks. |
| `bg_waterfall.png` | 6 | Lush green gorge, big falling water, mist, rainbow. |
| `bg_blizzard.png` | 7 | White-out, ice, faint sun. Nearly monochrome — high risk of washing out the tiles, keep the mid-band darker than instinct says. |

### 4.2 Letter tiles — `src/assets/tiles/` · **216 × 216** · transparent

The hero assets. The letter itself is drawn by the game in Baloo 2 — **deliver the tile
blank.** Square canvas; put any drop-shadow inside it.

*(The code derives the draw scale from the PNG's actual width, so 108, 216 or 432 all render
identically. 216 is the recommended target — it's 4× the 54px display size, crisp on any
phone. Just keep every tile in the set the same size as each other.)*

| File | What it is |
|---|---|
| `tile_n.png` | Standard letter tile. Cream/ivory face, warm bevel, subtle wear. **Most important asset in the game.** |
| `tile_gold.png` | Golden letter (2× value). Same silhouette, gold face, glint. Must read as "valuable" at a glance. |
| `tile_ember.png` | Volcano ember tile — burns away on a fuse. Hot orange, glowing crack, wisp of flame. Must read as "urgent". |
| `tile_boulder.png` | A rock blocking a board cell. Grey, chunky, breakable-looking. |
| `tile_frost.png` | Blizzard frost overlay that hides the letter. Translucent pale-blue ice with a frost star. |

### 4.3 Board cells — `src/assets/board/` · **52 × 52** · transparent

The 15×15 grid. Quiet by design — these sit *under* the letters and must never compete.

| File | Square |
|---|---|
| `cell_base.png` | Plain square. Pale, slightly inset, faint wood or stone. |
| `cell_DL.png` | Double letter |
| `cell_TL.png` | Triple letter |
| `cell_DW.png` | Double word |
| `cell_TW.png` | Triple word |
| `cell_ST.png` | Centre star square |

The four bonus types must be distinguishable **by shape/symbol, not colour alone** — the
game has a colourblind mode and these are the assets that carry it.

### 4.4 UI panels & buttons (9-slice) — `src/assets/ui/` · transparent

| File | Source size | Inset (L,R,T,B) | What it is |
|---|---|---|---|
| `panel_wood.png` | 256 × 256 | 44,44,44,48 | Chunky wooden frame. Used for the board surround and every modal card. Corner studs, visible grain, cream inner panel. |
| `panel_paper.png` | 160 × 160 | 28,28,28,28 | Clean cream info card (stats rows, settings rows). |
| `panel_tray.png` | 256 × 160 | 40,40,40,44 | The wooden shelf holding the 7-tile rack. |
| `sign_wood.png` | 160 × 96 | 30,30,24,28 | Hanging plank for headers. |
| `slot_empty.png` | 108 × 108 | — | One empty well in the tray shelf. Recessed, shadowed. |
| `frame_canopy.png` | 960 × 1708 | — | *Optional.* Transparent overlay: foliage/rock framing the screen edges. Replaces the procedural leaves. Centre must be fully transparent. |
| `frame_bush.png` | 960 × 240 | — | *Optional.* Bottom-edge foliage strip. |

**Buttons** — all `256 × 128`, inset `32,32,28,36`. Chunky, beveled, with a clear bottom
"lip" so the press-down animation reads. The game tints nothing; deliver each in its colour.

| File | Colour | Used for |
|---|---|---|
| `btn_primary.png` | Clay `#E0561F` | Play, main CTA |
| `btn_teal.png` | Teal `#0FB8B0` | Confirm, Resume, Recall |
| `btn_purple.png` | Purple `#8E6FC1` | Duel |
| `btn_slate.png` | Slate `#6F8FA8` | Stats, neutral |
| `btn_wood.png` | Wood `#9C6B3F` | Settings |
| `btn_danger.png` | Red `#E24B4A` | Reset |

### 4.5 Icons — `src/assets/icons/` · **128 × 128** · transparent

Single cohesive set. Chunky, outlined, readable at 22px. No thin strokes.

**Navigation & HUD:** `ic_play` · `ic_cal` (daily) · `ic_duel` (two swords / two players) ·
`ic_chart` (stats) · `ic_gear` (settings) · `ic_lock` · `ic_flame` (streak) · `ic_trash`
(discard chute) · `ic_trophy` · `ic_star`

**The five powers** (these appear as a row of buttons and badly need icons — right now they
are text):

| File | Power | Idea |
|---|---|---|
| `ic_slow.png` | Slow | Hourglass / stopwatch |
| `ic_shuffle.png` | Shuffle | Crossed arrows over tiles |
| `ic_vowels.png` | Vowels | A/E glowing |
| `ic_purge.png` | Purge | Q/Z swept away |
| `ic_golden.png` | Golden | ×2 starburst |

### 4.6 FX — `src/assets/fx/` · transparent

| File | Size | Use |
|---|---|---|
| `fx_star.png` | 64 × 64 | Score pops, praise tiers |
| `fx_spark.png` | 48 × 48 | Tile land, word submit |
| `fx_confetti.png` | 32 × 48 | Level clear |
| `fx_smoke.png` | 128 × 128 | Tile break, boulder crack |

---

## 5. How to actually get these made

**Step 1 — buy a pack to lock the style (~$50–300, this week).**
Look for a *casual mobile game GUI pack* plus a *cartoon landscape/parallax pack*. The pack
does two jobs: it gives you shippable UI immediately, and it becomes the style reference
everything else must match. Places worth searching: **GameDev Market**, **Craftpix**,
**Unity Asset Store**, **GraphicRiver/Envato**, **itch.io**. Search terms that work:
"casual game GUI wooden", "cartoon game UI kit", "match-3 UI pack", "parallax cartoon
mountain background". Check the licence permits commercial use in a paid/ad-supported app.

**Step 2 — pay a human for the three assets that sell the game (~$500–1,500).**
The **app icon**, the **letter tile**, and the **logo/wordmark**. These three drive your
store install rate more than everything inside the game combined, and they are exactly the
assets AI is worst at. ArtStation, Dribbble, or Upwork; look for someone with shipped
casual-mobile work in their portfolio, not general illustration.

**Step 3 — use Scenario for volume (~$20–200/mo).**
Train a style model on the pack + the hero assets from step 2 (10–20 reference images), then
generate the 8 backgrounds and prop variations on-style. This is what Scenario is built for
and it is the only reliable answer to style drift. Do **not** try to generate the UI kit or
the icon set with it — those need pixel-exact sizing and clean alpha, and you will spend
longer fixing them than drawing them.

**Step 4 — drop the files in.** Match the paths and names above. The pipeline picks them up
automatically. Nothing else to do.

---

## 6. Acceptance checklist

- [ ] Every PNG is at the exact stated pixel size, trimmed, no stray padding.
- [ ] Filenames exactly match §4 (lowercase, underscores).
- [ ] 9-slice art keeps all detail inside the stated insets.
- [ ] A letter tile is legible against **all eight** backgrounds — check `bg_blizzard` and
      `bg_sandstorm` especially, they are the two that wash out.
- [ ] Bonus squares are distinguishable without colour.
- [ ] The whole set looks like it came from one artist on one afternoon. If any asset makes
      you think "that's from a different game", cut it.

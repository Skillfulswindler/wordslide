# Wordslide — Background Prompt Pack (Midjourney)

**v1.0 · July 2026 · pairs with ART_BIBLE.md**

Copy-paste prompts for the 8 world backgrounds. Read §1 and §2 first — they are the
difference between art that works and art that gets swallowed by the UI.

---

## 1. The thing nobody tells you: two thirds of the background is hidden

I measured the real UI against the 480×854 canvas. The board, tray and buttons are opaque
and they cover **66% of the screen**. Here is what a player actually sees:

| Zone | Area | Visible? |
|---|---|---|
| Top band, y 0–112 | 13.1% | **Yes — fully.** The single most valuable strip. |
| Left chute, x 0–46 (full height) | 4.7% | **Yes — top to bottom.** Letters tumble down it. |
| Right edge, x 466–480 | 1.4% | Yes, a sliver |
| Bottom bands, y 608–854 | 13.3% | **Yes** |
| Middle (behind the 15×15 board) | 66% | **Mostly hidden** — now faintly visible, see below |

The old backgrounds put every set piece — the volcano cone, the waterfall, the dunes — at
y=300–560. Dead centre. **Entirely behind the board.** All you ever saw was sky and an
identical green jungle frame, which is exactly why all seven looked the same.

Two things changed in the code to fix this:

- The board grid now draws at **90% alpha over a soft scrim**, so the world glows faintly
  through the *empty* cells. Placed letter tiles are opaque sprites on top, so legibility is
  untouched. The middle is no longer a dead zone — but it's a *whisper*, not a stage.
- The procedural green foliage overlay that was pasted on every world is **gone**. Each
  background now carries its own framing.

**So when you prompt: the drama belongs at the TOP and the BOTTOM. The middle should be
atmospheric haze, mist, or open distance — low contrast, nothing busy.** This is a gift, not
a restriction: it's exactly how good parallax mobile backgrounds are composed anyway.

---

## 2. Workflow — do this in order, it's what buys you consistency

**Step 1. Generate the style anchor.** Run the `home` prompt (§3.0) first. Generate 4–8
variations. Pick the one whose *style* you love — not the composition, the style. This image
defines the entire game's look.

**Step 2. Lock the style.** Upscale your pick, copy its image URL, and append
`--sref <that-url>` to **every** subsequent prompt. `--sref` copies palette, linework,
lighting and texture without copying the subject — it is the single mechanism that stops the
eight worlds drifting into eight different games. If the style is coming through too weakly,
raise `--sw` (style weight, default 100, range 0–1000); try `--sw 250`. If it's overpowering
the subject, drop to `--sw 60`.

*Alternative:* if you find a numeric sref code you prefer from a library, use
`--sref 1234567890` instead of a URL. Same effect, more repeatable.

**Step 3. Generate the other seven** using the prompts in §3, each with your `--sref`.

**Step 4. Export.** Upscale, download, resize to exactly **960 × 1708** (that's 2× the
480×854 canvas), save as PNG named `bg_<world>.png`, and drop into:

```
game/src/assets/backgrounds/
```

That's it. The pipeline picks them up by filename automatically — no code change. If a file
is missing, the procedural version I regenerated is used as the fallback, so nothing breaks
while you work through them one at a time.

**Suffix to append to every prompt** (after the `--sref`):

```
--ar 9:16 --v 8.1 --style raw
```

`--ar 9:16` gives you the portrait shape. `--style raw` reduces Midjourney's tendency to
prettify everything into the same soft painterly mush — you want graphic, confident,
game-ready shapes.

---

## 3. The prompts

Each is written to (a) match its level name literally, (b) put its signature at top and
bottom, and (c) keep the middle calm. The shared style spine is deliberate — it's what makes
them a set.

### 3.0 — HOME (generate this first: it is your style anchor)

```
Bright 2D cartoon game background, vertical mobile game art, a grand welcoming mountain seen
from its base, snow-capped peak at the very top of frame, warm golden morning light, soft
layered parallax ridges receding into pale haze in the middle distance, lush green pines and
mossy boulders across the bottom foreground, fluffy stylised clouds, thick confident outlines,
saturated but not neon colours, soft cel shading with one clear light source from the upper
left, flat vector illustration with hand-painted texture, Angry Birds meets a wooden board
game, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

### 3.1 — MUDSLIDE *(Slow & sticky. Learn the ropes.)*

```
Bright 2D cartoon game background, vertical mobile game art, a churning wall of thick brown
mud spilling over a jungle ridge at the top of frame, heavy rain, wet drooping tropical
leaves, glossy chocolate-brown mud pools and a half-sunk mossy log across the bottom
foreground, cool grey-green overcast sky, soft mist filling the middle distance, thick
confident outlines, soft cel shading, flat vector illustration with hand-painted texture,
playful not scary, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

### 3.2 — LANDSLIDE *(Boulders block the board — crack them with words.)*

```
Bright 2D cartoon game background, vertical mobile game art, a dry cracked cliff face
shearing away at the top of frame with a fresh pale scar and round boulders already tumbling
loose, dusty ochre and tan rock, sparse olive scrub pines, scattered rounded boulders and
gravel across the bottom foreground, clear blue sky, warm dust haze in the middle distance,
thick confident outlines, soft cel shading, flat vector illustration with hand-painted
texture, playful not scary, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

### 3.3 — AVALANCHE *(Letters arrive in sudden bursts.)*

```
Bright 2D cartoon game background, vertical mobile game art, a breaking cornice of snow
cracking loose from jagged blue alpine peaks at the top of frame, visible fracture line,
tumbling snowballs, crisp cold blue and white palette, snow-laden pines and half-buried
rocks across the bottom foreground, falling snow, pale blue haze in the middle distance,
thick confident outlines, soft cel shading, flat vector illustration with hand-painted
texture, playful not scary, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

### 3.4 — VOLCANO *(Ember letters burn away if not played fast.)*

```
Bright 2D cartoon game background, vertical mobile game art, an erupting volcano crater rim
glowing from within at the top of frame, molten orange lava spilling in runnels, dark ash
plume, dramatic red and purple twilight sky, black basalt rock and cooling lava cracks
glowing orange across the bottom foreground, charred bare branches framing the edges,
floating embers, hot orange glow in the middle distance, absolutely no green vegetation,
thick confident outlines, soft cel shading, flat vector illustration with hand-painted
texture, playful not scary, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

### 3.5 — SANDSTORM *(Gusts scramble your tray.)*

```
Bright 2D cartoon game background, vertical mobile game art, a towering wall of ochre sand
rolling in across the top of frame, wind-whipped dust streaks, hot golden yellow haze, silhouetted
palm fronds framing the edges, rippled sand dunes and a lone cactus across the bottom
foreground, blowing sand blurring the middle distance, warm amber and gold palette, thick
confident outlines, soft cel shading, flat vector illustration with hand-painted texture,
playful not scary, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

### 3.6 — WATERFALL *(A constant, relentless flow.)*

```
Bright 2D cartoon game background, vertical mobile game art, a powerful waterfall pouring
between two mossy emerald cliff walls at the top of frame, white foam and spray, a faint
rainbow in the mist, lush jungle fronds framing the edges, a turquoise plunge pool with wet
rounded boulders across the bottom foreground, bright tropical blue sky, cool mist filling
the middle distance, vivid emerald and turquoise palette, thick confident outlines, soft cel
shading, flat vector illustration with hand-painted texture, no characters, no text, no UI
--ar 9:16 --v 8.1 --style raw
```

### 3.7 — BLIZZARD *(Frost hides your letters.)*

```
Bright 2D cartoon game background, vertical mobile game art, a howling white-out blizzard,
driving horizontal streaks of wind and snow across the top of frame, faint pale sun barely
showing through, hanging icicles framing the top edge, frozen pines and ice shards half
buried in deep snow across the bottom foreground, near-monochrome pale blue and white
palette but with enough tonal depth to keep foreground shapes readable, thick confident
outlines, soft cel shading, flat vector illustration with hand-painted texture, playful not
scary, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

---

## 4. Watch-outs

**Blizzard and Sandstorm are the two that will fail.** Blizzard goes so white that cream
letter tiles vanish into it; Sandstorm goes so golden that the gold bonus tiles disappear.
Both prompts already push back on this, but check them against a real screenshot before
accepting. If a background washes out, regenerate with "richer mid-tones", or darken it
15–20% in any image editor before dropping it in. Legibility beats beauty — a player who
can't read their tiles quits.

**Reject anything with characters, text, or a UI frame.** Midjourney loves adding fake HUD
elements to anything you call "game art". The `no characters, no text, no UI` tail helps but
isn't bulletproof.

**Keep the middle boring.** If a generation has a gorgeous detailed castle dead-centre, it's
a bad background for *this* game — it'll sit invisible behind the board. Pick the one with
the open, hazy middle even if it looks less impressive as a standalone picture.

---

## 5. About the texture packs you downloaded

I looked through them. `Textures/tiles/Ghibli Inspired Textures/` (732 MB) and
`Textures/FreeContent/` are **PBR tiling materials** — BaseColor, Normal, Roughness, Height,
AO maps, themed around castles, fortresses, medieval streets and village squares.

**They cannot make backgrounds.** They're surface materials for 3D, not illustrated scenes,
and the medieval theme doesn't match a mountain word game.

**But they're excellent for the assets that are still procedural** — and those sit in the
most-looked-at part of the screen. Specifically, from the BaseColor maps:

- `VillageSquare/BrownWeatheredBoard` and `DarkBrownWeatheredBoard` → the letter tile face
  and the tray shelf (`tile_n.png`, `panel_tray.png`)
- `CastleGrounds/Carved Wooden Trim` and `Painted Cracked Wood` → the board frame and modal
  cards (`panel_wood.png`)
- `FortressCourtyard/Heavy Timber Planks` → the wooden sign plank (`sign_wood.png`)
- `CastleGrounds/Aged Courtyard Stone Slab` / `Flagstone Walkway` → the board cells
  (`cell_base.png`)

Crop a clean square from the BaseColor map, add the bevel and the drop shadow, save at the
size in ART_BIBLE.md §4. That gets you a real wooden tile — which is the single highest-value
asset in the game — out of something you already own.

---

# ADDENDUM — after importing your 7 (July 12)

All seven are **in the game**. Notes on what I did to them, and what's still missing.

## What I changed on import (`art/import_bgs.py`, re-runnable)

- **Mudslide came back square** (1024×1024, pillarboxed with near-black bars) — you left `--ar` off
  that one. I detected and trimmed the bars, then cover-fit it. It works, but it's cropped harder
  than the others; if you want it perfect, regenerate it with `--ar 9:16`.
- All seven cover-fit to **960×1708**, anchored to the top (the top band is the most visible zone).
- **Converted PNG → JPEG q88.** Backgrounds are opaque, so alpha is wasted bytes: **13.2 MB → 2.1 MB**
  with no visible loss. The pipeline now loads `.jpg` and `.png` interchangeably. Keep exporting
  JPEGs for backgrounds; everything else (tiles, UI, icons) must stay PNG for transparency.
- **Measured the luminance behind the board on each** and set a per-world darkening scrim from it.
  This mattered: Blizzard came back at mean luminance **220 with a standard deviation of 17** — a
  flat white wall, exactly the failure mode §4 warned about. It now gets a 0.44 scrim; Volcano
  (luminance 74) gets 0.14. Without this your cream tiles would have vanished into the snow.

## Still needed: HOME

You didn't generate one, so the menu is still using the old procedural art and it looks like a
different game next to the other seven. Run this with the **same `--sref`** as the rest:

```
Bright 2D cartoon game background, vertical mobile game art, a grand welcoming mountain seen from
its base, snow-capped peak at the top of frame, warm golden morning light, layered parallax ridges
receding into soft haze in the middle distance, lush green pines and mossy boulders across the
bottom foreground, a faint winding trail leading up toward the peak, fluffy stylised clouds,
inviting and adventurous rather than dangerous, thick confident outlines, soft cel shading,
painterly cartoon game art, no characters, no text, no UI --ar 9:16 --v 8.1 --style raw
```

Export as `bg_home.jpg` into `game/src/assets/backgrounds/`.

## The real remaining gap is NOT the backgrounds

The backgrounds are now good. Put a screenshot next to Angry Birds and what gives the game away is
**the board and the UI**: flat white cells, loud primary-coloured bonus squares, plain grey buttons,
and a letter tile that's a flat tan rectangle. That's now the weakest thing on screen — and it's the
part the player stares at for the entire session.

**Midjourney is the wrong tool for this.** It cannot do pixel-exact sizes, clean alpha edges, or a
consistent 9-slice button set. Don't try. Two better routes, in order:

1. **Your texture packs already contain the answer.** `Textures/tiles/Ghibli Inspired Textures/` has
   `VillageSquare/BrownWeatheredBoard` and `CastleGrounds/Painted Cracked Wood` — crop a clean square
   from the **BaseColor** map, add a bevel and drop shadow, and you have a real wooden letter tile.
   Full mapping in ART_BIBLE.md §5. This costs you an afternoon and nothing else.
2. **Pay a human ~$500–1,500** for the three that sell the game: app icon, letter tile, logo.

If you do want MJ for *concepting* the tile look (to hand to an artist as reference, not to ship):

```
A single blank wooden letter tile for a word game, chunky rounded square, warm cream face, carved
bevelled edge, subtle wood grain and gentle wear, soft drop shadow, no letter on it, no text,
centred on a plain neutral background, game asset, thick confident outlines, soft cel shading,
painterly cartoon game art, product shot --ar 1:1 --v 8.1 --style raw
```

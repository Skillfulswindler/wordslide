#!/usr/bin/env python3
"""
Wordslide — store art generator (icon, splash, Play feature graphic).

These are BRAND assets, authored here. They are NOT screenshots: store
screenshots must come from the real running game (see tools/shots.mjs), because
a mocked-up screenshot is a promise the game has to keep.

Every output is written at an EXACT store dimension, RGB, no alpha — the stores
reject off-by-one sizes and alpha channels outright.

  icon.png                1024x1024   -> @capacitor/assets source
  splash.png              2732x2732   -> @capacitor/assets source
  play/icon-512.png        512x512    -> Play hi-res icon
  play/feature-1024x500.png 1024x500  -> Play feature graphic (required)

run:  python3 store/tools/gen_store_art.py
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math

OUT = os.path.join(os.path.dirname(__file__), "..")
F800 = "/tmp/Baloo2-800.ttf"     # the game's display face (Baloo 2 ExtraBold)

# palette lifted straight from WS.C in src/worlds.js — the store art and the
# game must not drift apart into two different brands
SKY_T   = (0x8F, 0xD6, 0xEC)
SKY_B   = (0xE8, 0xF6, 0xFB)
CREAM   = (0xFF, 0xF7, 0xE8)
TILE    = (0xEC, 0xC2, 0x5A)
TILE_D  = (0xC9, 0x9A, 0x3E)
TILE_INK= (0x4A, 0x2E, 0x14)
CLAY    = (0xE0, 0x56, 0x1F)
TEAL    = (0x0F, 0xB8, 0xB0)
INK     = (0x23, 0x3A, 0x4F)
ROCK    = (0x9C, 0x6B, 0x3F)
ROCK_D  = (0x7A, 0x4A, 0x1E)
GRASS   = (0x6F, 0x9E, 0x4C)

def font(px):
    return ImageFont.truetype(F800, px)

def vgrad(size, top, bot):
    w, h = size
    img = Image.new("RGB", (1, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.point((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return img.resize(size, Image.BICUBIC)

def slope(img, y0, y1, col, seed=0.0):
    """A cartoon mountain slope: the 'slide' the letters fall down."""
    w, h = img.size
    d = ImageDraw.Draw(img)
    pts = [(0, h), (0, y0)]
    steps = 40
    for i in range(steps + 1):
        x = w * i / steps
        t = i / steps
        y = y0 + (y1 - y0) * (t ** 1.5) + math.sin(t * 7 + seed) * h * 0.012
        pts.append((x, y))
    pts.append((w, h))
    d.polygon(pts, fill=col)

def tile(size, ch, rot=0, val=None):
    """One letter tile, drawn the way the game draws it: bevel, shadow, ink."""
    s = size * 4  # supersample, then downscale — keeps the rounded corners clean
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(s * 0.17)
    d.rounded_rectangle([0, int(s*0.06), s-1, s-1], r, fill=TILE_D + (255,))   # shadow lip
    d.rounded_rectangle([0, 0, s-1, int(s*0.94)], r, fill=TILE + (255,))
    sheen = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).rounded_rectangle(
        [int(s*0.11), int(s*0.09), int(s*0.89), int(s*0.21)],
        int(s*0.05), fill=(255, 255, 255, 54))
    im.alpha_composite(sheen)                                                  # thin top sheen
    f = ImageFont.truetype(F800, int(s * 0.62))
    bb = d.textbbox((0, 0), ch, font=f)
    d.text(((s - (bb[2]-bb[0]))/2 - bb[0], (s*0.94 - (bb[3]-bb[1]))/2 - bb[1]),
           ch, font=f, fill=TILE_INK + (255,))
    if val is not None:
        fv = ImageFont.truetype(F800, int(s * 0.17))
        d.text((s*0.74, s*0.60), str(val), font=fv, fill=TILE_INK + (220,))
    im = im.resize((size, size), Image.LANCZOS)
    return im.rotate(rot, resample=Image.BICUBIC, expand=True) if rot else im

def drop_shadow(base, layer, xy, blur=6, off=(0, 5), op=90):
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    a = layer.split()[3].point(lambda p: min(p, op))
    blk = Image.new("RGBA", layer.size, (30, 18, 6, 0)); blk.putalpha(a)
    sh.paste(blk, (xy[0] + off[0], xy[1] + off[1]), blk)
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))

# ----------------------------------------------------------------- ICON ------
def make_icon(px=1024):
    img = vgrad((px, px), SKY_T, SKY_B).convert("RGBA")
    # a slope from upper-left to lower-right: the landslide the game is named for
    slope(img, px*0.44, px*0.86, GRASS + (255,), 1.0)
    slope(img, px*0.56, px*0.98, ROCK + (255,), 2.2)
    slope(img, px*0.72, px*1.10, ROCK_D + (255,), 3.1)

    # the hero tile — big, centred, slightly tilted, exactly like a played tile
    T = int(px * 0.46)
    t = tile(T, "W", rot=-8, val=4)
    x, y = int(px*0.27), int(px*0.24)
    drop_shadow(img, t, (x, y), blur=int(px*0.012), off=(0, int(px*0.018)), op=110)
    img.alpha_composite(t, (x, y))

    # dust kicked up where the slide bites: the icon should read as MOTION
    dust = Image.new("RGBA", img.size, (0,0,0,0))
    dd = ImageDraw.Draw(dust)
    for (cx, cy, rr, op) in [(0.20,0.70,0.075,42),(0.33,0.78,0.058,34),
                             (0.10,0.79,0.048,28),(0.45,0.86,0.062,24)]:
        dd.ellipse([px*(cx-rr), px*(cy-rr), px*(cx+rr), px*(cy+rr)],
                   fill=(255,255,255,op))
    img.alpha_composite(dust.filter(ImageFilter.GaussianBlur(px*0.035)))

    # two smaller tiles tumbling down the slope behind it
    for (ch, sc, rx, ry, rot) in [("S", 0.20, 0.66, 0.13, 14), ("E", 0.16, 0.78, 0.42, -20)]:
        s = int(px * sc)
        tt = tile(s, ch, rot=rot)
        px_, py_ = int(px*rx), int(px*ry)
        drop_shadow(img, tt, (px_, py_), blur=int(px*0.008), off=(0, int(px*0.012)), op=90)
        img.alpha_composite(tt, (px_, py_))
    return img.convert("RGB")

# ---------------------------------------------------------------- SPLASH -----
def make_splash(px=2732):
    img = vgrad((px, px), SKY_T, SKY_B).convert("RGBA")
    slope(img, px*0.60, px*0.78, GRASS + (255,), 1.0)
    slope(img, px*0.68, px*0.90, ROCK + (255,), 2.2)
    slope(img, px*0.80, px*1.02, ROCK_D + (255,), 3.1)
    d = ImageDraw.Draw(img)
    # keep the wordmark well inside the centre: iOS/Android crop the splash hard
    f = font(int(px*0.105))
    word, slide = "Word", "slide"
    wl = d.textlength(word, font=f); sl = d.textlength(slide, font=f)
    x0 = (px - (wl + sl)) / 2; y0 = px*0.42
    for dx, dy in [(-6,0),(6,0),(0,-6),(0,6),(-4,-4),(4,4),(-4,4),(4,-4)]:
        d.text((x0+dx, y0+dy), word,  font=f, fill=CREAM)
        d.text((x0+wl+dx, y0+dy), slide, font=f, fill=CREAM)
    d.text((x0, y0), word,  font=f, fill=TEAL)
    d.text((x0+wl, y0), slide, font=f, fill=CLAY)
    f2 = font(int(px*0.026))
    tag = "Spell fast. Before it falls."
    d.text(((px - d.textlength(tag, font=f2))/2, y0 + px*0.135), tag, font=f2, fill=INK)
    return img.convert("RGB")

# ------------------------------------------------- PLAY FEATURE GRAPHIC ------
def make_feature(w=1024, h=500):
    img = vgrad((w, h), SKY_T, SKY_B).convert("RGBA")
    slope(img, h*0.50, h*0.72, GRASS + (255,), 1.0)
    slope(img, h*0.64, h*0.92, ROCK + (255,), 2.2)
    slope(img, h*0.82, h*1.10, ROCK_D + (255,), 3.1)
    d = ImageDraw.Draw(img)
    f = font(96)
    x0, y0 = 56, 150
    wl = d.textlength("Word", font=f)
    for dx, dy in [(-5,0),(5,0),(0,-5),(0,5),(-4,-4),(4,4),(-4,4),(4,-4)]:
        d.text((x0+dx, y0+dy), "Word",  font=f, fill=CREAM)
        d.text((x0+wl+dx, y0+dy), "slide", font=f, fill=CREAM)
    d.text((x0, y0), "Word",  font=f, fill=TEAL)
    d.text((x0+wl, y0), "slide", font=f, fill=CLAY)
    f2 = font(30)
    d.text((x0+4, y0+118), "Spell fast. Before it falls.", font=f2, fill=INK)

    # a cascade of tiles spilling in from the right — the core fantasy in one image
    for (ch, s, x, y, rot) in [("S",118,620,60,-10), ("L",104,742,120,8),
                               ("I",96,856,64,-16), ("D",110,900,210,12),
                               ("E",92,760,262,-6)]:
        t = tile(s, ch, rot=rot)
        drop_shadow(img, t, (x, y), blur=7, off=(0, 8), op=100)
        img.alpha_composite(t, (x, y))
    return img.convert("RGB")

os.makedirs(os.path.join(OUT, "play"), exist_ok=True)
os.makedirs(os.path.join(OUT, "..", "game", "assets"), exist_ok=True)

icon = make_icon(1024)
icon.save(os.path.join(OUT, "..", "game", "assets", "icon.png"))
icon.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "play", "icon-512.png"))
make_splash(2732).save(os.path.join(OUT, "..", "game", "assets", "splash.png"))
make_feature().save(os.path.join(OUT, "play", "feature-1024x500.png"))

for p in ["../game/assets/icon.png", "../game/assets/splash.png",
          "play/icon-512.png", "play/feature-1024x500.png"]:
    im = Image.open(os.path.join(OUT, p))
    print(f"  {p:34s} {im.size[0]}x{im.size[1]}  {im.mode}")
print("store art written.")

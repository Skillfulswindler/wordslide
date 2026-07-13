#!/usr/bin/env python3
"""Import Midjourney backgrounds -> game assets.

- trims letterbox bars (Mudslide came back square with black pillarboxing)
- cover-fits to 960x1708 (2x the 480x854 canvas), anchored so the TOP of the
  image survives: the top band is the most-visible zone (see ART_BIBLE)
- measures mean luminance behind the board (y 112..532 logical) per world so the
  in-game scrim can adapt: bright worlds (blizzard, sandstorm) get more scrim or
  the letter tiles vanish into them.
"""
from PIL import Image, ImageChops, ImageStat
import os, json

SRC = "Background Images"
DST = "game/src/assets/backgrounds"
TW, TH = 960, 1708           # 2x canvas
os.makedirs(DST, exist_ok=True)

MAP = {"Mudslide":"mudslide","Landslide":"landslide","Avalanche":"avalanche","Volcano":"volcano",
       "Sandstorm":"sandstorm","Waterfall":"waterfall","Blizzard":"blizzard","Home":"home"}

def trim_bars(im, thresh=14):
    """Remove near-black letterbox bars. Midjourney pads to square when --ar is
    omitted, and the bars are *near* black (e.g. rgb(0,0,10)), not pure black —
    so threshold on luminance rather than diffing against the corner pixel."""
    import numpy as np
    a = np.asarray(im.convert("RGB"), dtype=float)
    lum = a.mean(axis=2)
    cols = np.where(lum.mean(axis=0) >= thresh)[0]
    rows = np.where(lum.mean(axis=1) >= thresh)[0]
    if len(cols) == 0 or len(rows) == 0:
        return im
    box = (int(cols.min()), int(rows.min()), int(cols.max())+1, int(rows.max())+1)
    if (box[2]-box[0]) < im.size[0]*0.25 or (box[3]-box[1]) < im.size[1]*0.25:
        return im
    return im.crop(box)

def cover(im, tw, th):
    """Scale to cover tw x th, crop centred horizontally, anchored to the TOP."""
    w, h = im.size
    s = max(tw/w, th/h)
    nw, nh = round(w*s), round(h*s)
    im = im.resize((nw, nh), Image.LANCZOS)
    x = (nw - tw)//2
    y = 0 if nh - th < th*0.25 else int((nh - th)*0.15)   # favour the top
    return im.crop((x, y, x+tw, y+th))

report = {}
for src, key in MAP.items():
    p = os.path.join(SRC, src + ".png")
    im = Image.open(p).convert("RGB")
    before = im.size
    im = trim_bars(im)
    trimmed = im.size
    im = cover(im, TW, TH)
    out = os.path.join(DST, f"bg_{key}.jpg")
    im.save(out, "JPEG", quality=88, optimize=True, progressive=True)

    # luminance behind the board: logical y 112..532, x 46..466 -> x2
    band = im.crop((92, 224, 932, 1064)).convert("L")
    st = ImageStat.Stat(band)
    lum, sd = st.mean[0], st.stddev[0]
    # scrim alpha: bright + flat backgrounds swallow cream tiles. Map 130..215 -> 0.16..0.42
    scrim = max(0.14, min(0.44, 0.16 + (lum-130)/85 * 0.26))
    report[key] = dict(lum=round(lum,1), sd=round(sd,1), scrim=round(scrim,2))
    print(f"{key:11} {before[0]}x{before[1]} -> trim {trimmed[0]}x{trimmed[1]} -> {TW}x{TH}   "
          f"board-band luminance {lum:6.1f} (sd {sd:5.1f})   scrim {scrim:.2f}")

print()
print("SCRIM TABLE (paste into worlds.js):")
print(json.dumps({k:v["scrim"] for k,v in report.items()}, indent=1))

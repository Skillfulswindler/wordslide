#!/usr/bin/env python3
"""Import the Home establishing shot as the "Climb the slide" map backdrop.

Same cover-fit pipeline as import_bgs.py (960x1708, JPEG q88), but Home.png's
aspect is almost identical to the canvas, so a plain top-anchored cover-fit would
reproduce bg_home 1:1 and the map would feel like a duplicate of the menu. So we
zoom in a touch and anchor the crop LOWER — the map shows more foothills (where
the climb begins) and less of the summit sky the menu already owns.
"""
from PIL import Image, ImageChops
import numpy as np

SRC = "Background Images/Home.png"
DST = "game/src/assets/backgrounds/bg_map.jpg"
TW, TH = 960, 1708           # 2x canvas
ZOOM   = 1.15                # tighter than the menu's full-frame shot
ANCHOR = 0.46                # 0=top .. 1=bottom; favour foothills

def trim_bars(im, thresh=14):
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

im = Image.open(SRC).convert("RGB")
before = im.size
im = trim_bars(im)
w, h = im.size
s = max(TW/w, TH/h) * ZOOM
nw, nh = round(w*s), round(h*s)
im = im.resize((nw, nh), Image.LANCZOS)
x = (nw - TW)//2
y = int((nh - TH) * ANCHOR)
im = im.crop((x, y, x+TW, y+TH))
im.save(DST, "JPEG", quality=88, optimize=True, progressive=True)
print(f"Home {before[0]}x{before[1]} -> zoom {ZOOM} anchor {ANCHOR} -> {DST} {im.size}")

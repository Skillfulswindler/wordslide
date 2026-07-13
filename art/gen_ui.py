#!/usr/bin/env python3
"""
Wordslide — build the UI + tile asset set from Nick's PBR texture packs.

The packs are tiling MATERIALS (BaseColor / Height / Normal / Roughness), not
game assets. This turns them into game assets:

  BaseColor  -> the grain and colour variation (recoloured through a luminance
                ramp, so a weathered oak board can become a cream tile face or a
                clay-red button while KEEPING its real wood grain)
  Height     -> a real emboss pass, lit from the upper-left, so edges and cracks
                catch light instead of looking like a flat photo

Then: rounded-rect mask, carved bevel, dark outline, drop shadow. That's what
turns a texture swatch into something that reads as a physical object you could
pick up — which is the whole difference between this and the flat tan rectangle.

Sizes and 9-slice insets must match WS.Assets.NINE in game/src/assets.js and
ART_BIBLE.md §4. Change one, change all three.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps

ROOT = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(ROOT, "..", "game", "src", "assets"))
TEX  = os.path.normpath(os.path.join(ROOT, "..", "Textures", "tiles", "Ghibli Inspired Textures"))

MAT = {
 "oak":    "VillageSquare/BrownWeatheredBoard",
 "walnut": "VillageSquare/DarkBrownWeatheredBoard",
 "painted":"CastleGrounds/Painted Cracked Wood",
 "trim":   "CastleGrounds/Carved Wooden Trim",
 "timber": "FortressCourtyard/Heavy Timber Planks",
 "slab":   "CastleGrounds/Aged Courtyard Stone Slab",
 "flag":   "CastleGrounds/Flagstone Walkway",
}
_cache = {}
def mat(name, kind="BaseColor"):
    key=(name,kind)
    if key in _cache: return _cache[key]
    d = os.path.join(TEX, MAT[name])
    f = next(x for x in os.listdir(d) if kind in x)
    im = Image.open(os.path.join(d, f))
    im = im.convert("L" if kind=="Height" else "RGB")
    _cache[key]=im
    return im

# ---------------------------------------------------------------- primitives
def swatch(name, size, box=(0,0,700,700)):
    """crop a region of the material and scale to size (w,h)"""
    return mat(name).crop(box).resize(size, Image.LANCZOS)

def heightmap(name, size, box=(0,0,700,700)):
    return mat(name,"Height").crop(box).resize(size, Image.LANCZOS)

def ramp(gray, dark, base, light, lo=0.30, hi=0.78):
    """Recolour a luminance image through dark->base->light. Keeps the grain,
       replaces the colour. This is what lets one oak board become a cream tile
       AND a clay button without looking like two different materials."""
    g = ImageOps.autocontrast(gray, cutoff=2)
    out = Image.new("RGB", g.size)
    px, gp = out.load(), g.load()
    w,h = g.size
    for y in range(h):
        for x in range(w):
            t = gp[x,y]/255.0
            if t < lo:
                k = t/max(lo,1e-6); c = tuple(round(dark[i]+(base[i]-dark[i])*k) for i in range(3))
            elif t > hi:
                k = (t-hi)/max(1-hi,1e-6); c = tuple(round(base[i]+(light[i]-base[i])*k) for i in range(3))
            else:
                c = base
            px[x,y] = c
    return out

def emboss(img, hm, strength=0.55):
    """Light the surface from the upper-left using the real Height map."""
    h = hm.filter(ImageFilter.GaussianBlur(0.8))
    dx = ImageChops.difference(h, ImageChops.offset(h, 2, 0))
    dy = ImageChops.difference(h, ImageChops.offset(h, 0, 2))
    lit = ImageChops.add(dx, dy).filter(ImageFilter.GaussianBlur(0.6))
    lit = ImageOps.autocontrast(lit)
    hi = Image.new("RGB", img.size, (255,255,255))
    sh = Image.new("RGB", img.size, (0,0,0))
    m_hi = lit.point(lambda v: int(v*strength*0.55))
    m_sh = ImageOps.invert(lit).point(lambda v: int(v*strength*0.30))
    out = Image.composite(hi, img, m_hi.point(lambda v:v))
    out = Image.blend(img, out, 0.55)
    out = Image.composite(sh, out, m_sh)
    return Image.blend(img, out, 0.75)

def rrect_mask(size, r, ss=4):
    m = Image.new("L", (size[0]*ss, size[1]*ss), 0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,size[0]*ss-1,size[1]*ss-1], radius=r*ss, fill=255)
    return m.resize(size, Image.LANCZOS)

def bevel(img, mask, r, top=(255,255,255,150), bot=(0,0,0,120), w=5):
    """carved edge: light catches the top lip, shadow pools under the bottom lip"""
    W,H = img.size
    lay = Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    d.rounded_rectangle([w*0.6,w*0.5,W-w*0.6,H-w*0.5], radius=r, outline=bot, width=w)
    d.rounded_rectangle([w*0.6,w*0.2,W-w*0.6,H-w*1.6], radius=r, outline=top, width=max(2,w-2))
    lay = lay.filter(ImageFilter.GaussianBlur(1.6))
    lay.putalpha(ImageChops.multiply(lay.split()[3], mask))
    out = img.convert("RGBA"); out.alpha_composite(lay)
    return out

def outline(img, mask, colour=(58,36,20,235), w=5):
    W,H = img.size
    edge = mask.filter(ImageFilter.FIND_EDGES)
    edge = edge.filter(ImageFilter.MaxFilter(w if w%2 else w+1))
    lay = Image.new("RGBA",(W,H),colour); lay.putalpha(ImageChops.multiply(edge, mask))
    out = img.convert("RGBA"); out.alpha_composite(lay)
    return out

def shadow(img, dy=6, blur=5, alpha=110, pad_bottom=0):
    W,H = img.size
    canvas = Image.new("RGBA",(W,H+pad_bottom),(0,0,0,0))
    a = img.split()[3]
    sh = Image.new("RGBA",(W,H),(0,0,0,alpha)); sh.putalpha(a.point(lambda v:int(v*alpha/255)))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh,(0,dy))
    canvas.alpha_composite(img,(0,0))
    return canvas

def surface(material, size, colours, r, box=(0,0,700,700), emb=0.55, flat=0.0):
    """the core recipe: grain -> recolour -> emboss -> mask.
       flat: 0..1, blend back toward the flat base colour. ramp() autocontrasts
       (which is what makes a wooden tile sing), but a board cell must RECEDE —
       it sits under a letter and must never compete. flat=0.75 kills the veining
       while keeping just enough surface to not look like flat vector."""
    dark, base, light = colours
    g  = swatch(material, size, box).convert("L")
    hm = heightmap(material, size, box)
    im = ramp(g, dark, base, light)
    if flat > 0:
        im = Image.blend(im, Image.new("RGB", size, base), flat)
    im = emboss(im, hm, emb)
    m  = rrect_mask(size, r)
    im = im.convert("RGBA"); im.putalpha(m)
    return im, m

def save(img, group, name):
    d = os.path.join(GAME, group); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name+".png")
    img.save(p, "PNG", optimize=True)
    print(f"  {group}/{name}.png  {img.size[0]}x{img.size[1]}")

# =============================================================================
# THE ASSETS.  Sizes/insets mirror ART_BIBLE.md §4 and WS.Assets.NINE.
# =============================================================================

# ---- letter tiles (216x216) -------------------------------------------------
def tiles():
    S=(256,256); R=40                 # 256 = power of two -> mipmappable
    U = S[0]/216.0                    # decorations were authored against 216
    def base_tile(material, cols, box, emb=0.6, flat=0.0):
        im,m = surface(material,S,cols,R,box,emb,flat)
        im = bevel(im,m,R,w=8)
        im = outline(im,m,(62,40,22,225),w=6)
        return shadow(im, dy=7, blur=6, alpha=120)

    # tile_n — the hero. Warm ivory face on real weathered-oak grain.
    save(base_tile("oak", ((178,144,98),(246,231,195),(255,251,238)), (420,180,900,660), emb=0.42, flat=0.30),
         "tiles","tile_n")
    # tile_gold — 2x letter. Same silhouette, gold face, brighter specular.
    g = base_tile("oak", ((132,86,20),(238,182,60),(255,232,150)), (200,140,900,840), emb=0.7)
    d = ImageDraw.Draw(g)
    d.polygon([(168*U,44*U),(176*U,66*U),(198*U,74*U),(176*U,82*U),
               (168*U,104*U),(160*U,82*U),(138*U,74*U),(160*U,66*U)], fill=(255,248,206,235))
    save(g,"tiles","tile_gold")
    # tile_ember — burns away on a fuse. Hot, glowing crack.
    e = base_tile("painted", ((92,22,10),(226,104,46),(255,196,96)), (120,120,820,820), emb=0.75)
    d = ImageDraw.Draw(e)
    d.line([(52*U,164*U),(84*U,120*U),(72*U,96*U),(104*U,54*U)], fill=(255,214,110,225), width=8, joint="curve")
    d.line([(150*U,176*U),(170*U,140*U),(158*U,116*U)], fill=(255,190,80,190), width=6, joint="curve")
    e = Image.alpha_composite(e, e.filter(ImageFilter.GaussianBlur(6)).point(lambda v:int(v*0.45)))
    save(e,"tiles","tile_ember")
    # tile_boulder — blocks a cell until you crack it with a word.
    save(base_tile("slab", ((44,40,36),(132,126,118),(202,198,190)), (0,0,760,760), emb=0.85),
         "tiles","tile_boulder")
    # tile_frost — translucent ice that hides the letter underneath.
    im,m = surface("slab",S,((122,164,192),(206,232,246),(248,253,255)),R,(150,150,850,850),0.5)
    im = bevel(im,m,R,top=(255,255,255,190),bot=(120,160,190,110),w=8)
    im = outline(im,m,(126,172,204,225),w=5)
    d = ImageDraw.Draw(im)
    cx,cy=S[0]/2, S[1]/2-4
    for k in range(6):
        import math
        a=math.radians(k*60)
        d.line([(cx,cy),(cx+math.cos(a)*58*U, cy+math.sin(a)*58*U)], fill=(255,255,255,215), width=9)
    im.putalpha(im.split()[3].point(lambda v:int(v*0.93)))
    save(shadow(im,dy=6,blur=5,alpha=90),"tiles","tile_frost")

# ---- board cells (104x104) --------------------------------------------------
# Quiet by design: they sit UNDER the letters and must never compete. Pale
# stone, gently inset. Bonus squares carry a shape as well as a colour so the
# colourblind mode still works.
def cells():
    S=(128,128); R=15                 # power of two
    V = S[0]/104.0
    SHAPES = {
      "DL":((116,178,222),(70,132,182),"circle"),
      "TL":((104,196,150),(52,146,104),"triangle"),
      "DW":((236,150,176),(190,96,126),"square"),
      "TW":((244,178,92),(206,128,44),"diamond"),
      "ST":((236,124,110),(190,66,56),"star"),
    }
    def cell(cols, emb=0.16):                       # near-flat: cells must recede
        im,m = surface("slab",S,cols,R,(300,300,620,620),emb,flat=0.78)
        lay=Image.new("RGBA",S,(0,0,0,0)); d=ImageDraw.Draw(lay)
        d.rounded_rectangle([2,2,S[0]-3,S[1]-3],radius=R,outline=(0,0,0,46),width=3)   # inset
        d.line([(6,4),(S[0]-6,4)], fill=(255,255,255,70), width=3)                      # top lip
        lay.putalpha(ImageChops.multiply(lay.split()[3],m))
        im.alpha_composite(lay)
        return im,m
    base,_ = cell(((214,212,206),(240,241,238),(252,252,250)))   # very low contrast
    save(base,"board","cell_base")
    for k,(light,dark,shape) in SHAPES.items():
        soft = tuple(round(light[i]*0.72 + 40) for i in range(3))
        im,m = cell((soft, light, (255,255,255)), 0.14)
        d = ImageDraw.Draw(im)
        cx,cy,s = 78*V, 26*V, 9*V
        if shape=="circle":   d.ellipse([cx-s,cy-s,cx+s,cy+s], fill=dark+(210,))
        elif shape=="triangle": d.polygon([(cx,cy-s),(cx-s,cy+s),(cx+s,cy+s)], fill=dark+(210,))
        elif shape=="square": d.rectangle([cx-s,cy-s,cx+s,cy+s], fill=dark+(210,))
        elif shape=="diamond":d.polygon([(cx,cy-s),(cx-s,cy),(cx,cy+s),(cx+s,cy)], fill=dark+(210,))
        elif shape=="star":
            import math
            pts=[]
            for i in range(10):
                rr = (30 if i%2==0 else 13)*V
                a = math.radians(-90+i*36)
                pts.append((S[0]/2+math.cos(a)*rr, S[1]/2+math.sin(a)*rr))
            d.polygon(pts, fill=(255,244,200,235), outline=dark+(255,))
        save(im,"board","cell_"+k)

# ---- 9-slice panels ---------------------------------------------------------
# The middle of a 9-slice STRETCHES, so all detail (studs, border, grain
# contrast) must live inside the inset. Middles stay deliberately calm.
def panels():
    # panel_wood 256x256, inset 44,44,44,48 — board frame + every modal card
    S=(256,256); R=24; B=44
    im,m = surface("trim",S,((74,44,22),(150,100,56),(206,158,102)),R,(0,0,900,900),0.7)
    im = bevel(im,m,R,w=7)
    im = outline(im,m,(58,34,16,240),w=6)
    d = ImageDraw.Draw(im)
    inner = [B-8, B-8, S[0]-(B-8), S[1]-(B-12)]
    ip,ipm = surface("oak",(inner[2]-inner[0], inner[3]-inner[1]),
                     ((176,150,112),(246,238,220),(255,252,242)),14,(300,300,760,760),0.35)
    im.alpha_composite(ip,(inner[0],inner[1]))
    d.rounded_rectangle(inner, radius=14, outline=(84,54,28,190), width=4)
    for (x,y) in [(20,20),(S[0]-20,20),(20,S[1]-20),(S[0]-20,S[1]-20)]:      # corner studs
        d.ellipse([x-7,y-7,x+7,y+7], fill=(92,60,30,255), outline=(48,28,12,255), width=2)
        d.ellipse([x-4,y-5,x+2,y+1], fill=(178,132,80,220))
    save(im,"ui","panel_wood")

    # panel_frame 256x256, inset 44,44,44,48 — the BOARD frame. Identical border
    # to panel_wood but with a HOLLOW centre. panel_wood's opaque cream inner
    # panel was filling the whole board with beige once the grid went translucent,
    # hiding the world art behind it. A frame must frame, not fill.
    S=(256,256); R=24; B=44
    fr,m = surface("trim",S,((74,44,22),(150,100,56),(206,158,102)),R,(0,0,900,900),0.7)
    fr = bevel(fr,m,R,w=7)
    fr = outline(fr,m,(58,34,16,240),w=6)
    d = ImageDraw.Draw(fr)
    for (x,y) in [(20,20),(S[0]-20,20),(20,S[1]-20),(S[0]-20,S[1]-20)]:
        d.ellipse([x-7,y-7,x+7,y+7], fill=(92,60,30,255), outline=(48,28,12,255), width=2)
        d.ellipse([x-4,y-5,x+2,y+1], fill=(178,132,80,220))
    # punch the centre out, leaving a dark inner lip so the board still reads as inset
    hole = [B-6, B-6, S[0]-(B-6), S[1]-(B-10)]
    d.rounded_rectangle(hole, radius=14, outline=(52,32,16,220), width=5)
    cut = Image.new("L", S, 255)
    ImageDraw.Draw(cut).rounded_rectangle([hole[0]+4,hole[1]+4,hole[2]-4,hole[3]-4], radius=12, fill=0)
    fr.putalpha(ImageChops.multiply(fr.split()[3], cut))
    save(fr,"ui","panel_frame")

    # panel_paper 160x160, inset 28 — clean info card
    S=(160,160); R=18
    im,m = surface("oak",S,((196,180,152),(250,246,236),(255,255,252)),R,(300,300,760,760),0.25)
    im = bevel(im,m,R,top=(255,255,255,170),bot=(0,0,0,60),w=5)
    im = outline(im,m,(218,204,178,220),w=4)
    save(im,"ui","panel_paper")

    # panel_tray 256x160, inset 40,40,40,44 — the shelf under the 7 slots
    S=(256,160); R=20
    im,m = surface("timber",S,((70,44,22),(146,102,58),(202,158,104)),R,(0,0,900,600),0.75)
    im = bevel(im,m,R,w=7)
    im = outline(im,m,(56,34,16,240),w=6)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle([14,14,S[0]-15,S[1]-17], radius=12, fill=None, outline=(46,28,14,150), width=4)
    save(im,"ui","panel_tray")

    # sign_wood 160x96, inset 30,30,24,28 — header plank
    S=(160,96); R=14
    im,m = surface("oak",S,((78,48,24),(158,110,64),(214,168,110)),R,(0,200,900,700),0.7)
    im = bevel(im,m,R,w=6)
    im = outline(im,m,(58,34,16,240),w=5)
    d=ImageDraw.Draw(im)
    for x in (18, S[0]-18):
        d.ellipse([x-6,42,x+6,54], fill=(88,56,28,255), outline=(46,26,12,255), width=2)
    save(im,"ui","sign_wood")

    # slot_empty 128x128 — one recessed well in the tray (power of two)
    S=(128,128); R=19
    im,m = surface("timber",S,((38,24,12),(96,68,40),(140,104,64)),R,(200,200,700,700),0.6)
    d=ImageDraw.Draw(im)
    lay=Image.new("RGBA",S,(0,0,0,0)); ld=ImageDraw.Draw(lay)
    ld.rounded_rectangle([3,3,S[0]-4,S[1]-4], radius=R, outline=(0,0,0,150), width=7)   # inner shadow
    ld.line([(8,S[1]-6),(S[0]-8,S[1]-6)], fill=(196,160,110,120), width=4)              # bottom bounce
    lay=lay.filter(ImageFilter.GaussianBlur(2.4))
    lay.putalpha(ImageChops.multiply(lay.split()[3],m))
    im.alpha_composite(lay)
    im = outline(im,m,(44,28,14,220),w=4)
    save(im,"ui","slot_empty")

# ---- 9-slice buttons (256x128, inset 32,32,28,36) ---------------------------
# Chunky, with a clear bottom lip so the press-down animation reads. Painted
# wood: the grain keeps them from looking like flat vector rectangles.
def buttons():
    S=(256,128); R=22
    BTN = {
      "btn_primary":((122,38,10),(224,86,31),(255,158,104)),   # clay   #E0561F
      "btn_teal":   ((6,88,84),(15,184,176),(126,240,232)),    # teal   #0FB8B0
      "btn_purple": ((70,48,116),(142,111,193),(206,186,240)), # purple #8E6FC1
      "btn_slate":  ((52,72,88),(111,143,168),(186,208,224)),  # slate  #6F8FA8
      "btn_wood":   ((78,48,24),(156,107,63),(214,168,110)),   # wood   #9C6B3F
      "btn_danger": ((116,26,26),(226,75,74),(255,150,148)),   # red    #E24B4A
    }
    # btn_base: near-white, so setTint() can turn it into ANY colour (the seven
    # world accents aren't in the fixed palette). Tint multiplies, so a white base
    # keeps its grain, bevel and gloss whatever colour you throw at it.
    BTN["btn_base"] = ((150,146,142),(242,240,238),(255,255,255))
    for name,(dark,base,light) in BTN.items():
        im,m = surface("oak",S,(dark,base,light),R,(420,200,900,560),0.16)
        # bottom lip: a darker band the whole way across, so pressing reads
        lay=Image.new("RGBA",S,(0,0,0,0)); d=ImageDraw.Draw(lay)
        d.rounded_rectangle([0,S[1]-26,S[0]-1,S[1]-1], radius=R, fill=dark+(150,))
        d.rounded_rectangle([6,5,S[0]-7,44], radius=16, fill=(255,255,255,58))   # top gloss
        lay=lay.filter(ImageFilter.GaussianBlur(1.4))
        lay.putalpha(ImageChops.multiply(lay.split()[3],m))
        im.alpha_composite(lay)
        im = bevel(im,m,R,top=(255,255,255,120),bot=dark+(150,),w=6)
        im = outline(im,m,tuple(max(0,c-24) for c in dark)+(240,),w=6)
        save(shadow(im,dy=5,blur=4,alpha=95),"ui",name)

if __name__ == "__main__":
    print("building UI + tiles from PBR materials...")
    tiles(); cells(); panels(); buttons()
    print("done ->", GAME)

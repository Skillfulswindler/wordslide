#!/usr/bin/env python3
"""
Wordslide world backgrounds — GENERATOR v2.

WHY v2 EXISTS
-------------
v1 drew one shared template (same sun, same clouds, same three hill curves) and
swapped a palette + a single prop. Worse, every prop sat at y=300..560 — which
is EXACTLY where the opaque 15x15 board sits. So the signature of each world was
invisible, and all you ever saw was the sky strip and an identical green jungle
frame. Hence "they all look the same".

THE VISIBLE ZONES (measured against the real UI, 480x854 logical)
-----------------------------------------------------------------
  TOP BAND     y   0..112   13.1%  <- fully visible. Put the signature HERE.
  LEFT CHUTE   x   0..46    4.7%   <- visible the whole way down. Theme the walls.
  RIGHT EDGE   x 466..480   1.4%
  BOTTOM       y 608..854   13.3%  <- visible between tray and buttons, and below.
  MID (behind board)        66%    <- now only *faintly* visible: the board image
                                      is drawn at alpha 0.9, so keep this band
                                      low-contrast and atmospheric, never busy.

So: each world is composed independently, its signature reads in the top band and
the bottom, its chute walls are themed, and its side framing is its own (v1 used
jungle fronds on the volcano and the blizzard alike).
"""
import os, math, random, subprocess

W, H = 480, 854
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, "..", "game", "src", "assets", "backgrounds"))
ART  = os.path.join(HERE, "backgrounds")

# ---------------------------------------------------------------- svg helpers
def stops(lst):
    out = ""
    for s in lst:
        o = f' stop-opacity="{s[2]}"' if len(s) > 2 else ""
        out += f'<stop offset="{s[0]}" stop-color="{s[1]}"{o}/>'
    return out
def lg(i, st, x1=0, y1=0, x2=0, y2=1):
    return f'<linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{stops(st)}</linearGradient>'
def rg(i, st):
    return f'<radialGradient id="{i}" cx="0.5" cy="0.5" r="0.5">{stops(st)}</radialGradient>'

def cloud(cx, cy, s, op=1.0, fill="#FFFFFF"):
    return (f'<g opacity="{op}"><ellipse cx="{cx}" cy="{cy}" rx="{34*s}" ry="{17*s}" fill="{fill}"/>'
            f'<circle cx="{cx-16*s}" cy="{cy-4*s}" r="{13*s}" fill="{fill}"/>'
            f'<circle cx="{cx+4*s}" cy="{cy-11*s}" r="{16*s}" fill="{fill}"/>'
            f'<circle cx="{cx+22*s}" cy="{cy-3*s}" r="{12*s}" fill="{fill}"/></g>')
def sun(cx, cy, r, disc="#FFF3C0"):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r*3.2}" fill="url(#sunglow)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#sundisc)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r*0.58}" fill="{disc}"/>')
def rays(cx, cy, n=7, L=300, op=0.30):
    o = f'<g opacity="{op}">'
    for i in range(n):
        a = -70 + i * (140 / (n - 1))
        w = 9 + (i % 3) * 5
        rad = math.radians(a)
        x2, y2 = cx + math.sin(rad) * L, cy + math.cos(rad) * L
        px, py = math.cos(rad) * w, -math.sin(rad) * w
        o += f'<path d="M{cx-px},{cy-py} L{x2-px*2.6},{y2-py*2.6} L{x2+px*2.6},{y2+py*2.6} L{cx+px},{cy+py} Z" fill="url(#ray)"/>'
    return o + "</g>"

def rock(x, y, r, grad="url(#rock)", rot=0):
    return (f'<g transform="translate({x},{y}) rotate({rot})"><path d="M{-r},{r*0.4} L{-r*0.75},{-r*0.55} '
            f'L{-r*0.1},{-r} L{r*0.72},{-r*0.62} L{r},{r*0.35} L{r*0.35},{r*0.75} L{-r*0.5},{r*0.8} Z" fill="{grad}"/>'
            f'<path d="M{-r*0.75},{-r*0.55} L{-r*0.1},{-r} L{r*0.2},{-r*0.3} L{-r*0.4},{r*0.1} Z" fill="#FFFFFF" opacity="0.16"/></g>')
def pine(cx, base, s, snow=True, dark="#2A5C3C", lite="#3E7A50"):
    o = f'<rect x="{cx-3*s}" y="{base-10*s}" width="{6*s}" height="{12*s}" fill="#5E3A20"/>'
    for i, k in enumerate([1.0, 0.76, 0.5]):
        ty = base - 10 * s - i * 16 * s
        o += f'<path d="M{cx},{ty-30*s} L{cx+18*s*k},{ty} L{cx-18*s*k},{ty} Z" fill="{dark if i%2 else lite}"/>'
        if snow:
            o += f'<path d="M{cx},{ty-30*s} L{cx+11*s*k},{ty-12*s} L{cx-11*s*k},{ty-12*s} Z" fill="#FFFFFF" opacity="0.92"/>'
    return o
def frond(cx, cy, L, ang, fill, hi, n=7):
    o = f'<g transform="translate({cx},{cy}) rotate({ang})">'
    o += f'<path d="M0,0 Q{L*0.5},{-L*0.10} {L},0" stroke="{hi}" stroke-width="4" fill="none"/>'
    for i in range(n):
        t = (i + 1) / (n + 1)
        x = L * t
        ln = L * 0.30 * math.sin(math.pi * t) + 8
        o += (f'<ellipse cx="{x}" cy="{-ln*0.42}" rx="{ln*0.5}" ry="{ln*0.24}" fill="{fill}" transform="rotate(-32 {x} 0)"/>'
              f'<ellipse cx="{x}" cy="{ln*0.42}" rx="{ln*0.5}" ry="{ln*0.24}" fill="{hi}" transform="rotate(32 {x} 0)"/>')
    return o + "</g>"
def palm(cx, cy, L, ang, fill, hi):
    o = f'<g transform="translate({cx},{cy}) rotate({ang})">'
    for k in (-26, -9, 9, 26):
        o += (f'<path d="M0,0 Q{L*0.55},{k*1.8} {L},{k*2.6} Q{L*0.55},{k*0.4} 0,0 Z" '
              f'fill="{fill if k < 0 else hi}" transform="rotate({k*0.5})"/>')
    return o + "</g>"
def bush(x, y, s, fill, hi, snow=False):
    o = (f'<ellipse cx="{x}" cy="{y}" rx="{56*s}" ry="{32*s}" fill="{fill}"/>'
         f'<ellipse cx="{x-13*s}" cy="{y-9*s}" rx="{28*s}" ry="{15*s}" fill="{hi}" opacity="0.9"/>')
    if snow:
        o += f'<ellipse cx="{x}" cy="{y-17*s}" rx="{48*s}" ry="{15*s}" fill="#FFFFFF" opacity="0.9"/>'
    return o
def cactus(cx, base, s=1.0):
    return (f'<g><rect x="{cx-9*s}" y="{base-70*s}" width="{18*s}" height="{70*s}" rx="{9*s}" fill="url(#cact)"/>'
            f'<path d="M{cx-9*s},{base-46*s} h{-14*s} a{7*s},{7*s} 0 0 0 {-7*s},{7*s} v{12*s} a{7*s},{7*s} 0 0 0 {14*s},0 v{-6*s} z" fill="url(#cact)"/>'
            f'<path d="M{cx+9*s},{base-54*s} h{14*s} a{7*s},{7*s} 0 0 1 {7*s},{7*s} v{16*s} a{7*s},{7*s} 0 0 1 {-14*s},0 v{-10*s} z" fill="url(#cact)"/></g>')

def weather(kind, seed, n=26):
    random.seed(seed); o = ""
    for _ in range(n):
        x, y = random.uniform(0, W), random.uniform(0, H)
        if kind == "rain":
            o += f'<line x1="{x}" y1="{y}" x2="{x-4}" y2="{y+16}" stroke="#CFEAF7" stroke-width="2" opacity="{random.uniform(.25,.6):.2f}"/>'
        elif kind == "snow":
            o += f'<circle cx="{x}" cy="{y}" r="{random.uniform(1.6,4):.1f}" fill="#FFFFFF" opacity="{random.uniform(.5,.95):.2f}"/>'
        elif kind == "ember":
            o += f'<circle cx="{x}" cy="{y}" r="{random.uniform(1.4,3.4):.1f}" fill="#FFB03A" opacity="{random.uniform(.4,.95):.2f}"/>'
        elif kind == "dust":
            o += f'<ellipse cx="{x}" cy="{y}" rx="{random.uniform(5,16):.1f}" ry="{random.uniform(1,2.4):.1f}" fill="#F3DCA0" opacity="{random.uniform(.15,.4):.2f}"/>'
        elif kind == "mud":
            o += f'<circle cx="{x}" cy="{y}" r="{random.uniform(1.6,4):.1f}" fill="#7A5230" opacity="{random.uniform(.2,.5):.2f}"/>'
        elif kind == "leaf":
            o += f'<ellipse cx="{x}" cy="{y}" rx="{random.uniform(3,6):.1f}" ry="{random.uniform(1.6,3):.1f}" fill="#8BD94A" opacity="{random.uniform(.3,.7):.2f}" transform="rotate({random.uniform(0,180):.0f} {x} {y})"/>'
        elif kind == "spray":
            o += f'<circle cx="{x}" cy="{y}" r="{random.uniform(1.4,3.6):.1f}" fill="#EAFBFF" opacity="{random.uniform(.25,.7):.2f}"/>'
    return o

# ---------------------------------------------------------------- chute walls
# x 0..46 is visible top-to-bottom: it is the tumbling channel. Theme its walls.
def chute(kind, seed):
    random.seed(seed + 991)
    o = ""
    if kind == "rock":
        o += f'<path d="M0,90 L44,96 L46,854 L0,854 Z" fill="url(#chuteA)"/>'
        for i in range(9):
            o += rock(random.uniform(2, 42), random.uniform(130, 830), random.uniform(6, 13), "url(#rockdark)", random.uniform(0, 90))
    elif kind == "mud":
        o += f'<path d="M0,90 L44,96 L46,854 L0,854 Z" fill="url(#chuteA)"/>'
        o += f'<path d="M6,100 Q30,300 14,520 Q2,700 20,854 L0,854 Z" fill="#5E3C1E" opacity="0.5"/>'
        for i in range(7):
            y = random.uniform(140, 820)
            o += f'<ellipse cx="{random.uniform(8,38):.0f}" cy="{y:.0f}" rx="{random.uniform(6,13):.0f}" ry="{random.uniform(3,6):.0f}" fill="#6E4826" opacity="0.65"/>'
    elif kind == "ice":
        o += f'<path d="M0,90 L44,96 L46,854 L0,854 Z" fill="url(#chuteA)"/>'
        for i in range(10):
            x, y = random.uniform(2, 42), random.uniform(110, 830)
            ln = random.uniform(14, 34)
            o += f'<path d="M{x-5},{y} L{x+5},{y} L{x},{y+ln} Z" fill="#EAF7FF" opacity="0.85"/>'
    elif kind == "sand":
        o += f'<path d="M0,90 L44,96 L46,854 L0,854 Z" fill="url(#chuteA)"/>'
        for i in range(8):
            y = random.uniform(120, 830)
            o += f'<path d="M2,{y} Q24,{y-7} 44,{y+3}" stroke="#E8CB8A" stroke-width="2.4" fill="none" opacity="0.55"/>'
    elif kind == "moss":
        o += f'<path d="M0,90 L44,96 L46,854 L0,854 Z" fill="url(#chuteA)"/>'
        for i in range(8):
            y = random.uniform(120, 820)
            o += f'<ellipse cx="{random.uniform(2,40):.0f}" cy="{y:.0f}" rx="{random.uniform(8,16):.0f}" ry="{random.uniform(4,8):.0f}" fill="#4E9E3E" opacity="0.5"/>'
    elif kind == "basalt":
        o += f'<path d="M0,90 L44,96 L46,854 L0,854 Z" fill="url(#chuteA)"/>'
        for i in range(11):
            y = random.uniform(110, 830)
            o += f'<rect x="{random.uniform(0,34):.0f}" y="{y:.0f}" width="{random.uniform(8,14):.0f}" height="{random.uniform(16,34):.0f}" rx="2" fill="#3A241C" opacity="0.55"/>'
    # glowing lip so the channel still reads as a chute
    o += '<path d="M0,86 L46,92 L46,104 L0,98 Z" fill="#FFFFFF" opacity="0.30"/>'
    return o

# =============================================================================
# PER-WORLD COMPOSITION
# Each world defines: top() the signature (y 0..150, ALWAYS visible),
# mid() faint atmosphere (behind the board), bot() the foreground (y 600..854),
# frame() its own side dressing. No shared template, no shared prop.
# =============================================================================

# ---- 1. MUDSLIDE — wet brown torrent, rain, sagging jungle. Slow & sticky. ----
def mud_top(c):
    o = f'<path d="M0,58 Q120,20 240,52 Q360,84 480,40 L480,150 L0,150 Z" fill="url(#hillfar)" opacity="0.55"/>'
    # a churning wall of mud spilling over the ridge — the signature, right at the top
    o += ('<path d="M0,96 Q70,66 132,100 Q190,132 262,104 Q330,78 396,110 Q440,132 480,104 '
          'L480,168 Q400,150 330,166 Q250,184 170,164 Q90,146 0,166 Z" fill="url(#mudA)"/>')
    o += ('<path d="M0,120 Q80,100 150,126 Q220,152 300,128 Q380,104 480,132 L480,168 '
          'Q380,150 300,166 Q210,184 130,162 Q60,144 0,160 Z" fill="url(#mudB)" opacity="0.9"/>')
    for x, y, r in [(96, 128, 9), (208, 140, 7), (330, 126, 8), (420, 142, 6)]:
        o += f'<circle cx="{x}" cy="{y}" r="{r}" fill="#8A5E34" opacity="0.8"/>'
    return o
def mud_mid(c):
    return ('<path d="M0,300 Q140,268 260,300 Q380,332 480,296 L480,600 L0,600 Z" fill="url(#hazeA)" opacity="0.30"/>'
            '<path d="M0,430 Q160,404 300,432 Q400,452 480,428 L480,620 L0,620 Z" fill="url(#hazeB)" opacity="0.26"/>')
def mud_bot(c):
    o = '<path d="M0,640 Q120,606 250,638 Q370,668 480,634 L480,854 L0,854 Z" fill="url(#groundA)"/>'
    o += '<path d="M0,712 Q140,684 280,714 Q390,738 480,708 L480,854 L0,854 Z" fill="url(#groundB)"/>'
    # mud pools + soaked logs
    for x, y, rx in [(110, 812, 62), (360, 828, 70), (240, 850, 54)]:
        o += f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{rx*0.26:.0f}" fill="#5E3C1E" opacity="0.75"/>'
        o += f'<ellipse cx="{x-8}" cy="{y-4}" rx="{rx*0.6:.0f}" ry="{rx*0.13:.0f}" fill="#8A5E34" opacity="0.55"/>'
    o += '<rect x="126" y="768" width="104" height="15" rx="7" fill="#6E4826" transform="rotate(-6 178 776)"/>'
    o += bush(58, 760, 1.15, "url(#leaf)", "url(#leafhi)") + bush(430, 768, 1.2, "url(#leaf)", "url(#leafhi)")
    return o
def mud_frame(c):
    return (frond(-10, -8, 250, 54, "url(#leaf)", "url(#leafhi)") +
            frond(492, -12, 250, 126, "url(#leaf)", "url(#leafhi)") +
            frond(-12, 862, 210, -56, "url(#leaf)", "url(#leafhi)") +
            frond(494, 866, 210, -124, "url(#leaf)", "url(#leafhi)"))

# ---- 2. LANDSLIDE — dry cracked rock face collapsing. Boulders. ----
def land_top(c):
    o = f'<path d="M0,70 L92,26 L176,74 L268,32 L360,80 L440,44 L480,72 L480,150 L0,150 Z" fill="url(#hillfar)" opacity="0.6"/>'
    # a shearing cliff with a fresh scar + boulders already tumbling
    o += '<path d="M0,84 L110,44 L188,92 L300,50 L392,96 L480,60 L480,176 L0,176 Z" fill="url(#cliffA)"/>'
    o += '<path d="M110,44 L188,92 L300,50 L268,120 L150,132 Z" fill="#C4A276" opacity="0.55"/>'
    o += '<path d="M0,140 L120,112 L240,148 L360,116 L480,150 L480,176 L0,176 Z" fill="url(#cliffB)"/>'
    for x, y, r, rot in [(84, 148, 15, 20), (196, 158, 11, 60), (322, 146, 14, 10), (426, 160, 9, 40)]:
        o += rock(x, y, r, "url(#rockdark)", rot)
    return o
def land_mid(c):
    return ('<path d="M0,320 L140,290 L300,326 L480,296 L480,620 L0,620 Z" fill="url(#hazeA)" opacity="0.28"/>'
            '<path d="M0,450 L160,424 L340,456 L480,430 L480,640 L0,640 Z" fill="url(#hazeB)" opacity="0.24"/>')
def land_bot(c):
    o = '<path d="M0,648 L110,616 L250,652 L380,620 L480,650 L480,854 L0,854 Z" fill="url(#groundA)"/>'
    o += '<path d="M0,724 L140,698 L300,730 L480,702 L480,854 L0,854 Z" fill="url(#groundB)"/>'
    for x, y, r, rot in [(74, 792, 30, 12), (146, 826, 20, 50), (356, 786, 34, 70), (430, 824, 22, 25), (250, 846, 26, 0)]:
        o += rock(x, y, r, "url(#rock)", rot)
    o += pine(112, 762, 0.8, False, "#5E7D46", "#7D9C58") + pine(398, 754, 0.9, False, "#5E7D46", "#7D9C58")
    return o
def land_frame(c):
    return ('<path d="M0,0 L152,0 C120,44 60,66 0,74 Z" fill="url(#rockdark)"/>'
            '<path d="M480,0 L330,0 C362,48 424,70 480,80 Z" fill="url(#rockdark)"/>'
            '<path d="M0,854 L0,760 C58,772 108,808 132,854 Z" fill="url(#rockdark)"/>'
            '<path d="M480,854 L480,770 C424,782 372,812 350,854 Z" fill="url(#rockdark)"/>')

# ---- 3. AVALANCHE — a wall of snow breaking loose off blue alpine peaks. ----
def ava_top(c):
    o = '<path d="M0,96 L74,30 L132,86 L210,18 L288,88 L360,36 L432,92 L480,58 L480,150 L0,150 Z" fill="url(#peakA)"/>'
    o += '<path d="M74,30 L110,66 L132,86 L96,96 L48,86 Z" fill="#FFFFFF"/><path d="M210,18 L252,62 L288,88 L232,98 L172,84 Z" fill="#FFFFFF"/><path d="M360,36 L398,74 L432,92 L378,100 L332,88 Z" fill="#FFFFFF"/>'
    # the slab: a breaking cornice with a fracture line — the signature
    o += '<path d="M0,112 Q90,92 180,116 Q270,140 366,114 Q430,96 480,118 L480,186 Q380,166 288,188 Q190,210 96,184 Q40,168 0,182 Z" fill="#FFFFFF"/>'
    o += '<path d="M0,124 Q90,104 180,128 Q270,152 366,126 Q430,108 480,130" stroke="#AECFE6" stroke-width="3" fill="none" opacity="0.9"/>'
    for x, y, r in [(120, 168, 12), (250, 182, 9), (378, 166, 11)]:
        o += f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF"/><circle cx="{x-3}" cy="{y-3}" r="{r*0.5:.0f}" fill="#E6F2FA"/>'
    return o
def ava_mid(c):
    return ('<path d="M0,320 Q160,296 320,324 Q420,340 480,318 L480,620 L0,620 Z" fill="url(#hazeA)" opacity="0.30"/>'
            '<path d="M0,460 Q170,438 340,464 Q430,478 480,458 L480,640 L0,640 Z" fill="url(#hazeB)" opacity="0.26"/>')
def ava_bot(c):
    o = '<path d="M0,650 Q130,618 260,648 Q380,676 480,644 L480,854 L0,854 Z" fill="#EAF4FB"/>'
    o += '<path d="M0,726 Q150,700 300,728 Q400,746 480,720 L480,854 L0,854 Z" fill="#FFFFFF"/>'
    o += pine(78, 786, 1.0) + pine(150, 818, 0.7) + pine(402, 780, 1.1) + pine(340, 822, 0.72)
    for x, y, r in [(230, 828, 20), (444, 830, 16)]:
        o += rock(x, y, r, "url(#rock)") + f'<ellipse cx="{x}" cy="{y-r*0.66:.0f}" rx="{r*0.9:.0f}" ry="{r*0.38:.0f}" fill="#FFFFFF"/>'
    return o
def ava_frame(c):
    o = ""
    random.seed(c["seed"])
    for i in range(9):
        x = random.uniform(10, 470); ln = random.uniform(18, 44)
        o += f'<path d="M{x-8},0 L{x+8},0 L{x},{ln} Z" fill="#EAF7FF" opacity="0.95"/>'
    o += pine(-4, 150, 1.5) + pine(486, 160, 1.5)
    return o

# ---- 4. VOLCANO — night-red sky, erupting cone, ash, basalt. No green. ----
def volc_top(c):
    o = '<path d="M0,88 L88,44 L150,90 L240,30 L330,92 L410,52 L480,96 L480,150 L0,150 Z" fill="url(#hillfar)" opacity="0.65"/>'
    # the crater rim, lit from inside — the signature reads instantly
    o += '<path d="M116,176 L196,58 L286,58 L366,176 Z" fill="url(#volc)"/>'
    o += '<path d="M196,58 L286,58 L300,86 L182,86 Z" fill="#FF5A2D"/>'
    o += '<ellipse cx="241" cy="60" rx="52" ry="13" fill="#FFD24A"/><ellipse cx="241" cy="60" rx="34" ry="8" fill="#FFF3C0"/>'
    o += '<ellipse cx="241" cy="58" rx="96" ry="34" fill="url(#lavaglow)"/>'
    # lava runnels spilling toward the board
    o += '<path d="M214,84 Q206,130 220,178" stroke="url(#lava)" stroke-width="9" fill="none"/>'
    o += '<path d="M268,84 Q280,128 266,178" stroke="url(#lava)" stroke-width="6" fill="none"/>'
    # ash plume
    o += cloud(241, 26, 1.5, 0.5, "#6E5A52") + cloud(300, 18, 1.0, 0.4, "#6E5A52") + cloud(180, 20, 1.1, 0.4, "#6E5A52")
    return o
def volc_mid(c):
    return ('<path d="M0,320 L120,296 L280,326 L480,300 L480,620 L0,620 Z" fill="url(#hazeA)" opacity="0.32"/>'
            '<ellipse cx="240" cy="470" rx="260" ry="150" fill="url(#lavaglow)" opacity="0.22"/>')
def volc_bot(c):
    o = '<path d="M0,652 L120,624 L260,656 L390,628 L480,654 L480,854 L0,854 Z" fill="url(#groundA)"/>'
    o += '<path d="M0,730 L150,704 L310,734 L480,708 L480,854 L0,854 Z" fill="url(#groundB)"/>'
    # cooling lava cracks glowing through black basalt
    for x, y, w in [(60, 800, 90), (300, 822, 120), (180, 846, 80), (410, 790, 70)]:
        o += f'<path d="M{x},{y} q{w*0.3:.0f},-9 {w*0.55:.0f},4 q{w*0.3:.0f},10 {w:.0f},-3" stroke="url(#lava)" stroke-width="4" fill="none" opacity="0.9"/>'
    for x, y, r, rot in [(96, 776, 26, 15), (368, 772, 30, 60), (240, 840, 22, 30)]:
        o += rock(x, y, r, "url(#rockdark)", rot)
    return o
def volc_frame(c):
    o = ('<path d="M0,0 L120,0 C96,40 50,58 0,64 Z" fill="#2A1812"/>'
         '<path d="M480,0 L364,0 C388,42 434,62 480,70 Z" fill="#2A1812"/>')
    # charred dead branches, not jungle fronds
    o += '<path d="M0,180 q40,-26 76,-6 q-30,10 -46,30 q30,-8 58,6" stroke="#3A241C" stroke-width="6" fill="none"/>'
    o += '<path d="M480,200 q-44,-28 -82,-6 q32,10 50,32 q-32,-8 -62,6" stroke="#3A241C" stroke-width="6" fill="none"/>'
    return o

# ---- 5. SANDSTORM — ochre whiteout, wind walls, dunes, palms. ----
def sand_top(c):
    o = '<ellipse cx="240" cy="150" rx="330" ry="70" fill="url(#hillfar)" opacity="0.5"/>'
    # the storm wall itself, rolling in from the right — the signature
    o += '<path d="M480,0 Q380,30 322,86 Q276,132 200,150 Q120,168 0,158 L0,190 L480,190 Z" fill="url(#sandwall)" opacity="0.85"/>'
    o += '<path d="M480,20 Q400,52 340,104 Q292,146 214,166 L480,166 Z" fill="#E8C069" opacity="0.6"/>'
    for i, (x, y, rx) in enumerate([(120, 92, 66), (250, 60, 50), (386, 116, 58)]):
        o += f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{rx*0.28:.0f}" fill="#F7E4A8" opacity="0.4"/>'
    return o
def sand_mid(c):
    o = ""
    for i in range(5):
        y = 300 + i * 62
        o += f'<path d="M0,{y} Q160,{y-16} 320,{y+8} T480,{y-6}" stroke="#F7E4A8" stroke-width="3" fill="none" opacity="0.30"/>'
    o += '<ellipse cx="240" cy="470" rx="300" ry="180" fill="url(#hazeA)" opacity="0.28"/>'
    return o
def sand_bot(c):
    o = '<ellipse cx="70" cy="700" rx="240" ry="80" fill="url(#groundA)"/><ellipse cx="410" cy="732" rx="270" ry="92" fill="url(#groundA)"/>'
    o += '<ellipse cx="240" cy="812" rx="330" ry="110" fill="url(#groundB)"/>'
    for i, y in enumerate([742, 786, 830]):
        o += f'<path d="M0,{y} Q140,{y-14} 280,{y+6} T480,{y-4}" stroke="#F7E4A8" stroke-width="3" fill="none" opacity="0.45"/>'
    o += cactus(70, 786, 0.95) + cactus(420, 776, 1.05)
    for x, y, r in [(160, 828, 16), (330, 840, 13)]:
        o += rock(x, y, r, "url(#rock)")
    return o
def sand_frame(c):
    return (palm(16, -6, 130, 62, "url(#leaf)", "url(#leafhi)") + palm(464, -10, 130, 118, "url(#leaf)", "url(#leafhi)") +
            palm(-8, 40, 110, 34, "url(#leaf)", "url(#leafhi)") + palm(488, 46, 110, 146, "url(#leaf)", "url(#leafhi)"))

# ---- 6. WATERFALL — lush emerald gorge, a real falls, mist, rainbow. ----
def wf_top(c):
    o = '<path d="M0,64 Q110,28 232,60 Q350,92 480,50 L480,150 L0,150 Z" fill="url(#hillfar)" opacity="0.6"/>'
    # cliff walls with the falls pouring between them — signature at the top
    o += '<path d="M0,72 L128,54 L166,190 L0,190 Z" fill="url(#cliffA)"/>'
    o += '<path d="M480,80 L340,58 L306,190 L480,190 Z" fill="url(#cliffA)"/>'
    o += '<path d="M166,74 L306,74 L300,190 L172,190 Z" fill="url(#water)"/>'
    for x in (188, 214, 240, 266, 288):
        o += f'<path d="M{x},76 Q{x+3},130 {x-2},190" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="0.55"/>'
    o += '<ellipse cx="236" cy="70" rx="76" ry="12" fill="#EAFBFF"/>'
    o += cloud(70, 40, 0.8, 0.85) + cloud(410, 32, 0.7, 0.8)
    # rainbow in the mist
    for i, col in enumerate(["#FF8A8A", "#FFC96B", "#FFF48A", "#8FE39A", "#8FC9F2", "#B79BE6"]):
        o += f'<path d="M96,190 A146,146 0 0 1 {388-i*2},190" stroke="{col}" stroke-width="4" fill="none" opacity="0.30" transform="translate(0,{i*5})"/>'
    return o
def wf_mid(c):
    return ('<path d="M0,300 Q140,272 280,302 Q390,326 480,296 L480,620 L0,620 Z" fill="url(#hazeA)" opacity="0.28"/>'
            '<ellipse cx="240" cy="520" rx="220" ry="120" fill="#FFFFFF" opacity="0.16"/>')
def wf_bot(c):
    o = '<path d="M0,636 Q120,602 250,634 Q370,664 480,630 L480,854 L0,854 Z" fill="url(#groundA)"/>'
    o += '<path d="M0,708 Q140,680 280,710 Q390,734 480,704 L480,854 L0,854 Z" fill="url(#groundB)"/>'
    # the plunge pool
    o += '<ellipse cx="240" cy="800" rx="180" ry="46" fill="url(#water)" opacity="0.95"/>'
    o += '<ellipse cx="240" cy="792" rx="130" ry="28" fill="#FFFFFF" opacity="0.35"/>'
    for x, y, r in [(84, 790, 24), (398, 796, 26), (150, 828, 16), (330, 834, 18)]:
        o += rock(x, y, r, "url(#rock)")
    o += bush(40, 748, 1.15, "url(#leaf)", "url(#leafhi)") + bush(444, 754, 1.2, "url(#leaf)", "url(#leafhi)")
    return o
def wf_frame(c):
    return (frond(-10, -8, 270, 52, "url(#leaf)", "url(#leafhi)") + frond(492, -12, 270, 128, "url(#leaf)", "url(#leafhi)") +
            frond(-14, 300, 150, 20, "url(#leaf)", "url(#leafhi)") + frond(496, 320, 150, 160, "url(#leaf)", "url(#leafhi)") +
            frond(-12, 866, 220, -54, "url(#leaf)", "url(#leafhi)") + frond(494, 870, 220, -126, "url(#leaf)", "url(#leafhi)"))

# ---- 7. BLIZZARD — near-white-out, wind streaks, frozen pines, pale sun. ----
def bliz_top(c):
    o = '<path d="M0,104 L80,48 L150,100 L236,40 L318,102 L400,56 L480,104 L480,160 L0,160 Z" fill="url(#peakA)" opacity="0.75"/>'
    o += '<path d="M236,40 L272,80 L318,102 L262,110 L196,98 Z" fill="#FFFFFF" opacity="0.9"/>'
    # driving wind — horizontal streaks are the signature of a blizzard
    random.seed(c["seed"])
    for i in range(14):
        y = random.uniform(14, 176); x = random.uniform(-40, 300); ln = random.uniform(90, 230)
        o += f'<path d="M{x},{y} q{ln*0.5:.0f},{random.uniform(-8,8):.0f} {ln:.0f},2" stroke="#FFFFFF" stroke-width="{random.uniform(2,5):.1f}" fill="none" opacity="{random.uniform(.35,.8):.2f}"/>'
    o += '<circle cx="392" cy="62" r="34" fill="#FFFFFF" opacity="0.45"/><circle cx="392" cy="62" r="20" fill="#FFFFFF" opacity="0.7"/>'
    return o
def bliz_mid(c):
    o = '<rect x="0" y="240" width="480" height="400" fill="#FFFFFF" opacity="0.22"/>'
    random.seed(c["seed"] + 3)
    for i in range(9):
        y = random.uniform(280, 610); x = random.uniform(-60, 260); ln = random.uniform(120, 300)
        o += f'<path d="M{x},{y} q{ln*0.5:.0f},{random.uniform(-6,6):.0f} {ln:.0f},1" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.35"/>'
    return o
def bliz_bot(c):
    o = '<path d="M0,656 Q140,624 280,654 Q390,678 480,648 L480,854 L0,854 Z" fill="#E4F1FA"/>'
    o += '<path d="M0,736 Q150,708 300,738 Q400,756 480,730 L480,854 L0,854 Z" fill="#FFFFFF"/>'
    o += pine(66, 796, 0.95) + pine(136, 826, 0.66) + pine(414, 790, 1.0) + pine(348, 828, 0.68)
    for cx, b, h, w in [(228, 820, 40, 15), (300, 834, 28, 11), (466, 826, 32, 12)]:
        o += f'<path d="M{cx-w},{b-h} L{cx+w},{b-h} L{cx},{b} Z" fill="#EAF7FF" opacity="0.95"/>'
    random.seed(c["seed"] + 5)
    for i in range(7):
        y = random.uniform(700, 846); x = random.uniform(-40, 300); ln = random.uniform(90, 200)
        o += f'<path d="M{x},{y} q{ln*0.5:.0f},-4 {ln:.0f},2" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.5"/>'
    return o
def bliz_frame(c):
    o = ""
    random.seed(c["seed"] + 7)
    for i in range(12):
        x = random.uniform(6, 474); ln = random.uniform(20, 52)
        o += f'<path d="M{x-9},0 L{x+9},0 L{x},{ln} Z" fill="#FFFFFF" opacity="0.95"/>'
    o += '<path d="M0,0 L0,140 Q30,90 22,0 Z" fill="#FFFFFF" opacity="0.5"/><path d="M480,0 L480,150 Q450,96 458,0 Z" fill="#FFFFFF" opacity="0.5"/>'
    return o

# ---- 8. HOME — the whole mountain, warm and inviting. Its OWN scene. ----
def home_top(c):
    o = '<path d="M0,110 L86,40 L156,104 L240,26 L330,106 L410,52 L480,110 L480,160 L0,160 Z" fill="url(#peakA)"/>'
    o += '<path d="M240,26 L286,74 L330,106 L262,116 L184,102 Z" fill="#FFFFFF"/><path d="M86,40 L124,80 L156,104 L98,112 L46,100 Z" fill="#FFFFFF" opacity="0.9"/>'
    o += cloud(66, 52, 0.9, 0.9) + cloud(400, 40, 0.8, 0.85) + cloud(300, 92, 0.6, 0.6)
    return o
def home_mid(c):
    return ('<path d="M0,300 Q130,264 270,300 Q390,330 480,292 L480,620 L0,620 Z" fill="url(#hazeA)" opacity="0.30"/>'
            '<path d="M0,440 Q160,410 320,442 Q420,462 480,436 L480,640 L0,640 Z" fill="url(#hazeB)" opacity="0.26"/>')
def home_bot(c):
    o = '<path d="M0,630 Q120,596 250,628 Q370,658 480,624 L480,854 L0,854 Z" fill="url(#groundA)"/>'
    o += '<path d="M0,706 Q140,676 280,708 Q390,732 480,700 L480,854 L0,854 Z" fill="url(#groundB)"/>'
    o += pine(60, 780, 0.9, False, "#2E7A1A", "#4E9E3E") + pine(430, 774, 1.0, False, "#2E7A1A", "#4E9E3E")
    o += bush(150, 800, 1.2, "url(#leaf)", "url(#leafhi)") + bush(330, 812, 1.3, "url(#leaf)", "url(#leafhi)")
    for x, y, r in [(240, 836, 20), (96, 840, 14)]:
        o += rock(x, y, r, "url(#rock)")
    return o
def home_frame(c):
    return (frond(-10, -8, 240, 52, "url(#leaf)", "url(#leafhi)") + frond(492, -12, 240, 128, "url(#leaf)", "url(#leafhi)") +
            frond(-12, 866, 200, -54, "url(#leaf)", "url(#leafhi)") + frond(494, 870, 200, -126, "url(#leaf)", "url(#leafhi)"))

# =============================================================================
# WORLD TABLE — every world has its own sky, palette, chute, weather and cast.
# Nothing is shared but the helper shapes.
# =============================================================================
WORLDS = {
 "mudslide": dict(
    seed=8, weather="rain", chute="mud", celestial=None,
    sky=[(0,"#5E93AE"),(0.38,"#86B4C6"),(0.72,"#B8CFC4"),(1,"#D6D8B8")],
    far=[(0,"#6E8A70"),(1,"#4E6A52")], haze=[(0,"#8AA88E"),(1,"#6E8A72")], haze2=[(0,"#A8BC96"),(1,"#7E9670")],
    gA=[(0,"#6E5230"),(1,"#4E3A1E")], gB=[(0,"#4E3A1E"),(1,"#33260F")],
    leaf=[(0,"#2E7A1A"),(1,"#164A10")], leafhi=[(0,"#7ECA42"),(1,"#2E8A1E")],
    chuteA=[(0,"#7A5230"),(1,"#4E3218")],
    top=mud_top, mid=mud_mid, bot=mud_bot, frame=mud_frame),
 "landslide": dict(
    seed=6, weather="dust", chute="rock", celestial=(376,64,44),
    sky=[(0,"#6FBEDE"),(0.42,"#9FD4E8"),(0.75,"#D8DCC4"),(1,"#EFE0BC")],
    far=[(0,"#BBA786"),(1,"#93795A")], haze=[(0,"#B49A78"),(1,"#8E7656")], haze2=[(0,"#C6AE8A"),(1,"#9A8262")],
    gA=[(0,"#9A8256"),(1,"#6E5A38")], gB=[(0,"#7E6842"),(1,"#544326")],
    leaf=[(0,"#5E7D46"),(1,"#3E5A2E")], leafhi=[(0,"#9CB86A"),(1,"#6E8C48")],
    chuteA=[(0,"#A08862"),(1,"#6A5638")],
    top=land_top, mid=land_mid, bot=land_bot, frame=land_frame),
 "avalanche": dict(
    seed=5, weather="snow", chute="ice", celestial=(388,56,38),
    sky=[(0,"#4C86BE"),(0.40,"#82B4DC"),(0.74,"#C0DCF0"),(1,"#E8F4FC")],
    far=[(0,"#8FAAC2"),(1,"#6E8AA4")], haze=[(0,"#B8D0E4"),(1,"#94B4CE")], haze2=[(0,"#D2E6F4"),(1,"#AECAE0")],
    gA=[(0,"#D6E8F4"),(1,"#B4CEE2")], gB=[(0,"#FFFFFF"),(1,"#DCEBF6")],
    leaf=[(0,"#2A5C3C"),(1,"#1A3E28")], leafhi=[(0,"#FFFFFF"),(1,"#DCEFF0")],
    chuteA=[(0,"#BCD8EC"),(1,"#8EB2CE")],
    top=ava_top, mid=ava_mid, bot=ava_bot, frame=ava_frame),
 "volcano": dict(
    seed=4, weather="ember", chute="basalt", celestial=None,
    sky=[(0,"#3A1E30"),(0.34,"#8E3A34"),(0.66,"#D9622E"),(1,"#F2A03E")],
    far=[(0,"#5E2A22"),(1,"#3A1A16")], haze=[(0,"#8E4030"),(1,"#5A241A")], haze2=[(0,"#B0543A"),(1,"#7A3020")],
    gA=[(0,"#3A241C"),(1,"#241412")], gB=[(0,"#241412"),(1,"#140A0A")],
    leaf=[(0,"#3A241C"),(1,"#1E1210")], leafhi=[(0,"#6E4432"),(1,"#3A241C")],
    chuteA=[(0,"#5A342A"),(1,"#2A1812")],
    top=volc_top, mid=volc_mid, bot=volc_bot, frame=volc_frame),
 "sandstorm": dict(
    seed=3, weather="dust", chute="sand", celestial=(150,70,50),
    sky=[(0,"#E08A2A"),(0.36,"#F0AE44"),(0.70,"#F6D488"),(1,"#FBEDC6")],
    far=[(0,"#D8A85E"),(1,"#B88A3E")], haze=[(0,"#E8C888"),(1,"#C8A056")], haze2=[(0,"#F0DAA0"),(1,"#D4AE68")],
    gA=[(0,"#E0AC50"),(1,"#B8842A")], gB=[(0,"#C8922E"),(1,"#96681A")],
    leaf=[(0,"#8A8A3A"),(1,"#5E6022")], leafhi=[(0,"#C8C86A"),(1,"#8A8A3A")],
    chuteA=[(0,"#D8B45E"),(1,"#A07A32")],
    top=sand_top, mid=sand_mid, bot=sand_bot, frame=sand_frame),
 "waterfall": dict(
    seed=7, weather="spray", chute="moss", celestial=(392,58,42),
    sky=[(0,"#1E9ED8"),(0.40,"#5EC6E6"),(0.74,"#AEE4EE"),(1,"#DFF6E4")],
    far=[(0,"#4EA88E"),(1,"#2E7E68")], haze=[(0,"#6EBE96"),(1,"#3E8E6E")], haze2=[(0,"#8ED2A8"),(1,"#56A47E")],
    gA=[(0,"#3FA028"),(1,"#2A7018")], gB=[(0,"#2E8018"),(1,"#1C5810")],
    leaf=[(0,"#2E7A1A"),(1,"#164A10")], leafhi=[(0,"#9BEA52"),(1,"#2E8A1E")],
    chuteA=[(0,"#5E8A4E"),(1,"#38602E")],
    top=wf_top, mid=wf_mid, bot=wf_bot, frame=wf_frame),
 "blizzard": dict(
    seed=2, weather="snow", chute="ice", celestial=None,
    sky=[(0,"#8EB6CE"),(0.36,"#B6D2E2"),(0.70,"#DCEAF2"),(1,"#F4FAFE")],
    far=[(0,"#AEC6D6"),(1,"#8EA8BC")], haze=[(0,"#D2E4EE"),(1,"#B0C8D8")], haze2=[(0,"#E8F2F8"),(1,"#C6DAE6")],
    gA=[(0,"#DCEAF4"),(1,"#BCD2E2")], gB=[(0,"#FFFFFF"),(1,"#E2EEF6")],
    leaf=[(0,"#2A5C3C"),(1,"#1A3E28")], leafhi=[(0,"#FFFFFF"),(1,"#DCEFF0")],
    chuteA=[(0,"#CFE4F0"),(1,"#9EBED4")],
    top=bliz_top, mid=bliz_mid, bot=bliz_bot, frame=bliz_frame),
 "home": dict(
    seed=11, weather="leaf", chute="moss", celestial=(392,60,46),
    sky=[(0,"#22B0F0"),(0.42,"#6FCDF0"),(0.74,"#BFE8F2"),(1,"#E8F7DE")],
    far=[(0,"#8FC0D8"),(1,"#6E9EBC")], haze=[(0,"#8FD08A"),(1,"#5EA46A")], haze2=[(0,"#AEE49A"),(1,"#78BE72")],
    gA=[(0,"#5FBE38"),(1,"#3E8E24")], gB=[(0,"#3E8E24"),(1,"#286614")],
    leaf=[(0,"#2E7A1A"),(1,"#164A10")], leafhi=[(0,"#9BEA52"),(1,"#2E8A1E")],
    chuteA=[(0,"#5E8A4E"),(1,"#38602E")],
    top=home_top, mid=home_mid, bot=home_bot, frame=home_frame),
}

def defs(c):
    d = [lg("sky", c["sky"]), lg("hillfar", c["far"]), lg("hazeA", c["haze"]), lg("hazeB", c["haze2"]),
         lg("groundA", c["gA"]), lg("groundB", c["gB"]), lg("leaf", c["leaf"]), lg("leafhi", c["leafhi"]),
         lg("chuteA", c["chuteA"]),
         rg("sundisc", [(0,"#FFFBE0"),(0.6,"#FFEEA8"),(1,"#FFD98A")]),
         rg("sunglow", [(0,"#FFE9A8",0.85),(0.5,"#FFE9A8",0.35),(1,"#FFE9A8",0.0)]),
         lg("ray", [(0,"#FFF6CE",0.5),(1,"#FFF6CE",0.0)]),
         lg("rock", [(0,"#C9AE86"),(1,"#8A6B4A")]), lg("rockdark", [(0,"#8A7256"),(1,"#4E3E2C")]),
         lg("cliffA", [(0,"#B49470"),(1,"#7E6448")]), lg("cliffB", [(0,"#8E7454"),(1,"#5E4A32")]),
         lg("peakA", [(0,"#CFE0EC"),(1,"#8FB0C8")]),
         lg("water", [(0,"#EAFBFF"),(0.35,"#9FE6F2"),(1,"#37AED2")]),
         lg("volc", [(0,"#6E3A2A"),(1,"#2E1812")]),
         rg("lavaglow", [(0,"#FF8A3D",0.75),(1,"#FF8A3D",0.0)]), lg("lava", [(0,"#FFD24A"),(1,"#FF5A2D")]),
         lg("mudA", [(0,"#8A5E34"),(1,"#5E3C1E")]), lg("mudB", [(0,"#6E4826"),(1,"#432B12")]),
         lg("sandwall", [(0,"#F2C86E"),(1,"#D89A34")]),
         lg("cact", [(0,"#6FB05A"),(1,"#3E7A34")])]
    return "<defs>" + "".join(d) + "</defs>"

def scene(c):
    P = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    if c["celestial"]:
        x, y, r = c["celestial"]
        P += [sun(x, y, r), rays(x, y)]
    P += [c["top"](c), c["mid"](c), c["bot"](c), chute(c["chute"], c["seed"]),
          c["frame"](c), weather(c["weather"], c["seed"])]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*2}" height="{H*2}" viewBox="0 0 {W} {H}">'
            + defs(c) + "".join(P) + "</svg>")

if __name__ == "__main__":
    import cairosvg
    os.makedirs(PROJ, exist_ok=True); os.makedirs(ART, exist_ok=True)
    for name, c in WORLDS.items():
        svg = scene(c)
        open(f"{ART}/{name}.svg", "w").write(svg)
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f"{PROJ}/bg_{name}.png",
                         output_width=W*2, output_height=H*2)
        print(f"  bg_{name}.png")
    print("done ->", PROJ)

import math, random, subprocess, os
W,H=480,854
def stops(lst):
    out=""
    for s in lst:
        o,c=s[0],s[1]; op=s[2] if len(s)>2 else 1
        out+=f'<stop offset="{o}" stop-color="{c}" stop-opacity="{op}"/>'
    return out
def lg(i,st,x1=0,y1=0,x2=0,y2=1): return f'<linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{stops(st)}</linearGradient>'
def rg(i,st): return f'<radialGradient id="{i}" cx="0.5" cy="0.5" r="0.5">{stops(st)}</radialGradient>'
def cloud(cx,cy,s,op=1.0):
    return f'''<g opacity="{op}"><ellipse cx="{cx}" cy="{cy+4*s}" rx="{46*s}" ry="{15*s}" fill="#CFE6EF"/>
    <circle cx="{cx-24*s}" cy="{cy}" r="{16*s}" fill="#FFFFFF"/><circle cx="{cx}" cy="{cy-12*s}" r="{22*s}" fill="#FFFFFF"/>
    <circle cx="{cx+24*s}" cy="{cy-2*s}" r="{17*s}" fill="#FFFFFF"/><ellipse cx="{cx}" cy="{cy+2*s}" rx="{44*s}" ry="{15*s}" fill="#FFFFFF"/>
    <ellipse cx="{cx-6*s}" cy="{cy-14*s}" rx="{20*s}" ry="{7*s}" fill="#FFFFFF" opacity="0.9"/></g>'''
def leaf(cx,cy,L,ang,fill,hi):
    a=math.radians(ang); dx,dy=math.cos(a),math.sin(a); wx,wy=-dy,dx
    ex,ey=cx+dx*L,cy+dy*L; b1x,b1y=cx+wx*L*0.32,cy+wy*L*0.32; b2x,b2y=cx-wx*L*0.32,cy-wy*L*0.32
    mx,my=cx+dx*L*0.5,cy+dy*L*0.5
    return (f'<path d="M{cx:.1f},{cy:.1f} Q{b1x:.1f},{b1y:.1f} {ex:.1f},{ey:.1f} Q{b2x:.1f},{b2y:.1f} {cx:.1f},{cy:.1f} Z" fill="{fill}"/>'
            f'<path d="M{cx:.1f},{cy:.1f} Q{mx+wx*L*0.14:.1f},{my+wy*L*0.14:.1f} {ex:.1f},{ey:.1f}" stroke="{hi}" stroke-width="{L*0.05:.1f}" fill="none" opacity="0.7"/>')
def frond(cx,cy,L,ang,fill,hi,n=7,snow=False):
    a=math.radians(ang); dx,dy=math.cos(a),math.sin(a); ex,ey=cx+dx*L,cy+dy*L
    out=[f'<path d="M{cx:.1f},{cy:.1f} L{ex:.1f},{ey:.1f}" stroke="{fill}" stroke-width="{L*0.045:.1f}" fill="none"/>']
    for i in range(1,n+1):
        t=i/(n+1); px,py=cx+dx*L*t,cy+dy*L*t; ll=L*0.36*(1-0.5*t)
        for side in (+1,-1):
            out.append(leaf(px,py,ll,ang+side*52,fill,hi))
            if snow:
                sx=px+math.cos(math.radians(ang+side*52))*ll*0.5; sy=py+math.sin(math.radians(ang+side*52))*ll*0.5
                out.append(f'<ellipse cx="{sx:.1f}" cy="{sy:.1f}" rx="{ll*0.3:.1f}" ry="{ll*0.17:.1f}" fill="#FFFFFF" opacity="0.92"/>')
    return "<g>"+"".join(out)+"</g>"
def palm_leaf(cx,cy,L,ang,fill,hi):
    a=math.radians(ang); ex=cx+math.cos(a)*L; ey=cy+math.sin(a)*L+L*0.22
    mx=cx+math.cos(a)*L*0.55; my=cy+math.sin(a)*L*0.55
    o=[f'<path d="M{cx},{cy} Q{mx:.1f},{my:.1f} {ex:.1f},{ey:.1f}" stroke="{fill}" stroke-width="5" fill="none"/>']
    n=9; ba=math.degrees(math.atan2(ey-cy,ex-cx))
    for i in range(1,n+1):
        t=i/(n+1); px=(1-t)**2*cx+2*(1-t)*t*mx+t*t*ex; py=(1-t)**2*cy+2*(1-t)*t*my+t*t*ey
        ll=L*0.36*(1-0.35*t)
        for side in (+1,-1): o.append(leaf(px,py,ll,ba+side*56+12,fill,hi))
    o.append(leaf(ex,ey,L*0.22,ba+12,fill,hi))
    return "<g>"+"".join(o)+"</g>"
def vine(x,y,L,fill,hi):
    o=[f'<path d="M{x},{y} q10,{L*0.4} -4,{L}" stroke="{fill}" stroke-width="5" fill="none"/>']
    n=int(L/34)
    for i in range(1,n+1):
        t=i/(n+1); px=x+10*t-4*t*t; py=y+L*t
        o.append(leaf(px,py,20-6*t,150,fill,hi)); o.append(leaf(px,py,20-6*t,30,fill,hi))
    o.append(f'<ellipse cx="{x+6}" cy="{y+L}" rx="9" ry="13" fill="{fill}"/>'); return "<g>"+"".join(o)+"</g>"
def icicle(x,y,ln,w):
    return (f'<path d="M{x-w/2},{y} L{x+w/2},{y} L{x},{y+ln} Z" fill="url(#ice)"/>'
            f'<path d="M{x-w*0.22},{y} L{x+w*0.12},{y} L{x},{y+ln*0.72} Z" fill="#FFFFFF" opacity="0.6"/>')
def reed(x,base,h,fill):
    o=''
    for dx in (-6,0,6): o+=f'<path d="M{x+dx},{base} Q{x+dx+dx*0.4},{base-h*0.6} {x+dx*1.5},{base-h}" stroke="{fill}" stroke-width="4" fill="none" stroke-linecap="round"/>'
    return o
def cattail(x,base,h,fill):
    return (f'<path d="M{x},{base} Q{x+5},{base-h*0.6} {x+2},{base-h}" stroke="{fill}" stroke-width="4" fill="none" stroke-linecap="round"/>'
            f'<ellipse cx="{x+2}" cy="{base-h}" rx="5" ry="13" fill="#7A4A28"/>')
def lilypad(x,y,r,fill,flower=None):
    o=f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r*0.5}" fill="{fill}"/><ellipse cx="{x-r*0.3}" cy="{y-r*0.14}" rx="{r*0.4}" ry="{r*0.2}" fill="#B8ED88" opacity="0.7"/>'
    if flower: o+=flowerc(x,y-3,flower)
    return o
def cactus(cx,base,s=1.0):
    return (f'<rect x="{cx-11*s}" y="{base-96*s}" width="{22*s}" height="{98*s}" rx="{11*s}" fill="url(#cactus)"/>'
            f'<rect x="{cx-36*s}" y="{base-70*s}" width="{16*s}" height="{40*s}" rx="{8*s}" fill="url(#cactus)"/><rect x="{cx-36*s}" y="{base-70*s}" width="{40*s}" height="{16*s}" rx="{8*s}" fill="url(#cactus)"/>'
            f'<rect x="{cx+20*s}" y="{base-58*s}" width="{16*s}" height="{34*s}" rx="{8*s}" fill="url(#cactus)"/><rect x="{cx-4*s}" y="{base-58*s}" width="{40*s}" height="{16*s}" rx="{8*s}" fill="url(#cactus)"/>'
            f'<rect x="{cx-4*s}" y="{base-96*s}" width="{8*s}" height="{40*s}" fill="#2E6A28" opacity="0.3"/>')
def rock_shape(x,y,r,grad="url(#rock)"):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{grad}"/>'
            f'<path d="M{x-r},{y} A{r},{r} 0 0 1 {x+r*0.25},{y-r*0.97} L{x},{y} Z" fill="#FFFFFF" opacity="0.13"/>'
            f'<ellipse cx="{x+r*0.35}" cy="{y+r*0.42}" rx="{r*0.7}" ry="{r*0.5}" fill="#000000" opacity="0.16"/>')
def shrub(x,base,s,fill,hi):
    return (f'<ellipse cx="{x}" cy="{base}" rx="{34*s}" ry="{20*s}" fill="{fill}"/><circle cx="{x-14*s}" cy="{base-8*s}" r="{15*s}" fill="{fill}"/>'
            f'<circle cx="{x+12*s}" cy="{base-6*s}" r="{14*s}" fill="{fill}"/><ellipse cx="{x-8*s}" cy="{base-12*s}" rx="{16*s}" ry="{9*s}" fill="{hi}" opacity="0.8"/>')
def logp(x,y,w,h=16):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="url(#trunk)"/><ellipse cx="{x}" cy="{y+h/2}" rx="{h*0.5}" ry="{h*0.5}" fill="#8A5A34"/><ellipse cx="{x}" cy="{y+h/2}" rx="{h*0.26}" ry="{h*0.26}" fill="#B07A4A"/>')
def mushroom(x,base,s,cap="#E8563C"):
    return (f'<rect x="{x-4*s}" y="{base-14*s}" width="{8*s}" height="{16*s}" rx="{4*s}" fill="#F3E6C8"/>'
            f'<path d="M{x-16*s},{base-12*s} A{16*s},{13*s} 0 0 1 {x+16*s},{base-12*s} Z" fill="{cap}"/>'
            f'<ellipse cx="{x-5*s}" cy="{base-16*s}" rx="{4*s}" ry="{2.6*s}" fill="#FFFFFF" opacity="0.85"/>')
def fern(x,base,s,fill,hi):
    return "".join(frond(x,base,60*s,a,fill,hi,n=6) for a in (60,90,120))
def grasstuft(x,base,s,fill):
    return "".join(f'<path d="M{x+dx*s},{base} Q{x+dx*s+3*s},{base-16*s} {x+dx*s+1*s},{base-24*s}" stroke="{fill}" stroke-width="{3*s}" fill="none" stroke-linecap="round"/>' for dx in (-8,-3,2,7))
def flowerc(x,y,c):
    o="".join(f'<circle cx="{x+7*math.cos(math.radians(k*72)):.1f}" cy="{y+7*math.sin(math.radians(k*72)):.1f}" r="5" fill="{c}"/>' for k in range(5))
    return o+f'<circle cx="{x}" cy="{y}" r="4" fill="#FFF3B0"/>'
def pine(cx,base,s,snow=True):
    g=(f'<rect x="{cx-3*s}" y="{base-8*s}" width="{6*s}" height="{12*s}" fill="#6B4A2A"/>'
       f'<path d="M{cx},{base-56*s} L{cx+20*s},{base-24*s} L{cx-20*s},{base-24*s} Z" fill="url(#pinef)"/>'
       f'<path d="M{cx},{base-40*s} L{cx+24*s},{base-6*s} L{cx-24*s},{base-6*s} Z" fill="url(#pinef)"/>')
    if snow: g+=(f'<path d="M{cx},{base-56*s} L{cx+11*s},{base-38*s} L{cx-11*s},{base-38*s} Z" fill="#FFFFFF"/>'
                 f'<path d="M{cx},{base-40*s} L{cx+14*s},{base-22*s} L{cx-14*s},{base-22*s} Z" fill="#FFFFFF" opacity="0.9"/>')
    return g
def tree(cx,base,s):
    return (f'<rect x="{cx-4*s}" y="{base-26*s}" width="{8*s}" height="{30*s}" rx="{3*s}" fill="url(#trunk)"/><circle cx="{cx-14*s}" cy="{base-34*s}" r="{16*s}" fill="url(#canopy)"/>'
            f'<circle cx="{cx+14*s}" cy="{base-32*s}" r="{15*s}" fill="url(#canopy)"/><circle cx="{cx}" cy="{base-48*s}" r="{20*s}" fill="url(#canopy)"/><circle cx="{cx-6*s}" cy="{base-40*s}" r="{15*s}" fill="url(#canopyhi)" opacity="0.9"/>')
def ice_shard(cx,base,h,w):
    return (f'<path d="M{cx},{base-h} L{cx+w/2},{base-h*0.45} L{cx+w*0.3},{base} L{cx-w*0.3},{base} L{cx-w/2},{base-h*0.45} Z" fill="url(#ice)"/>'
            f'<path d="M{cx},{base-h} L{cx+w*0.2},{base-h*0.5} L{cx},{base} Z" fill="#FFFFFF" opacity="0.5"/>')
def sun(cx,cy,rc,warm="#FFF3C0"):
    return f'<circle cx="{cx}" cy="{cy}" r="{rc*3.4}" fill="url(#sunglow)"/><circle cx="{cx}" cy="{cy}" r="{rc}" fill="url(#sundisc)"/><circle cx="{cx}" cy="{cy}" r="{rc*0.6}" fill="{warm}"/>'
def rays(cx,cy):
    o='<g opacity="0.42">'
    for dx,w in [(-40,24),(30,28),(110,24),(190,32),(-120,20)]: o+=f'<polygon points="{cx},{cy} {cx+dx-w},560 {cx+dx+w},560" fill="url(#ray)"/>'
    return o+'</g>'
def sparkles(seed,n=18):
    random.seed(seed); o=''
    for i in range(n):
        x=random.uniform(40,440); y=random.uniform(60,430); r=random.uniform(1.5,3.4)
        o+=f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#FFFFFF" opacity="{random.uniform(0.4,0.9):.2f}"/>'
    random.seed(seed*7+2)
    for i in range(10):
        x=random.uniform(30,450); y=random.uniform(80,430); r=random.uniform(2,4.5)
        o+=f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#FFF7C8" opacity="{random.uniform(0.25,0.5):.2f}"/>'
    return o
def particles(kind,seed):
    random.seed(seed*13+1); o='<g>'
    if kind=='snow':
        for i in range(64): o+=f'<circle cx="{random.uniform(0,480):.0f}" cy="{random.uniform(0,780):.0f}" r="{random.uniform(1.5,3.6):.1f}" fill="#FFFFFF" opacity="{random.uniform(0.5,0.95):.2f}"/>'
    elif kind=='ember':
        for i in range(30):
            c="#FF8A3D" if random.random()>0.4 else "#FFD24A"; o+=f'<circle cx="{random.uniform(150,330):.0f}" cy="{random.uniform(120,520):.0f}" r="{random.uniform(1.5,3.2):.1f}" fill="{c}" opacity="{random.uniform(0.6,0.95):.2f}"/>'
    elif kind=='dust':
        for i in range(34): o+=f'<circle cx="{random.uniform(0,480):.0f}" cy="{random.uniform(220,600):.0f}" r="{random.uniform(1.2,2.6):.1f}" fill="#EAD49A" opacity="{random.uniform(0.35,0.6):.2f}"/>'
    elif kind=='rain':
        for i in range(40):
            x=random.uniform(0,480); y=random.uniform(60,520); o+=f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x-4:.0f}" y2="{y+16:.0f}" stroke="#BFE6F2" stroke-width="2" opacity="{random.uniform(0.3,0.6):.2f}"/>'
    elif kind=='leaf':
        for i in range(14):
            c=random.choice(["#F0A83C","#E86A3C","#8FC24A"]); o+=leaf(random.uniform(20,460),random.uniform(60,440),random.uniform(8,15),random.uniform(0,360),c,"#FFFFFF")
    return o+'</g>'
# ---- heroes ----
def hero_waterfall():
    p=f'<path d="M150,300 C150,360 168,420 168,470 L312,470 C312,420 330,360 330,300 C300,286 210,286 150,300 Z" fill="url(#cliff)"/>'
    p+=f'<path d="M206,318 C204,380 208,430 210,470 L270,470 C272,430 276,380 274,318 C258,310 222,310 206,318 Z" fill="url(#water)"/>'
    for x in (218,232,246,260): p+=f'<rect x="{x}" y="318" width="4" height="150" rx="2" fill="#FFFFFF" opacity="0.7"/>'
    p+=f'<ellipse cx="240" cy="486" rx="86" ry="22" fill="url(#water)"/><ellipse cx="240" cy="474" rx="46" ry="12" fill="#FFFFFF" opacity="0.9"/>'
    for (x,y,s) in [(180,478,1.0),(300,480,1.1),(150,500,0.8),(330,504,0.9)]: p+=rock_shape(x,y,24*s)
    return p
def hero_volcano():
    p=f'<circle cx="240" cy="356" r="130" fill="url(#lavaglow)"/>'
    p+=f'<path d="M108,548 L206,300 Q240,286 274,300 L372,548 Z" fill="url(#volc)"/>'
    p+=f'<path d="M108,548 L206,300 Q222,292 240,292 L240,548 Z" fill="#C08A5A" opacity="0.35"/><path d="M240,292 Q258,292 274,300 L372,548 L240,548 Z" fill="#000000" opacity="0.16"/>'
    p+=f'<path d="M200,322 C196,382 205,442 196,522" stroke="#4A2E1E" stroke-width="5" fill="none" opacity="0.4"/><path d="M282,332 C288,392 280,452 290,522" stroke="#4A2E1E" stroke-width="5" fill="none" opacity="0.32"/>'
    p+=f'<path d="M206,300 Q240,286 274,300 L268,314 Q240,304 212,314 Z" fill="#7A2A12"/><ellipse cx="240" cy="303" rx="26" ry="7" fill="url(#lava)"/>'
    p+=f'<path d="M226,308 C220,360 236,404 226,452" stroke="#FF6A2E" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M226,308 C220,360 236,404 226,452" stroke="#FFC24A" stroke-width="4" fill="none" stroke-linecap="round"/>'
    for (cx,cy,r,op) in [(252,274,16,0.5),(276,242,22,0.42),(306,206,30,0.3)]: p+=f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#C9BEB4" opacity="{op}"/>'
    return p
def hero_mud():
    p=f'<path d="M300,300 L360,300 L360,560 L150,560 Z" fill="url(#hillmid)" opacity="0.55"/>'
    p+=f'<path d="M224,300 C214,360 196,440 168,560 L322,560 C300,440 276,360 262,300 Q243,292 224,300 Z" fill="url(#mud)"/>'
    p+=f'<path d="M236,312 C230,380 224,460 214,548 L276,548 C270,460 262,380 252,312 Q244,306 236,312 Z" fill="url(#mudhi)" opacity="0.85"/>'
    p+=f'<path d="M230,340 C226,420 220,500 214,548" stroke="#5E3E22" stroke-width="4" fill="none" opacity="0.5"/>'
    for (x,y) in [(182,556),(320,556),(250,560),(210,552)]: p+=f'<circle cx="{x}" cy="{y}" r="5" fill="#8A5A32"/>'
    return p
def hero_boulders():
    p=f'<path d="M480,300 L480,540 L120,540 Z" fill="url(#hillmid)"/><path d="M480,300 L480,320 L200,540 L120,540 Z" fill="#000000" opacity="0.06"/>'
    p+=f'<g fill="#D8C6A2" opacity="0.5"><circle cx="300" cy="470" r="34"/><circle cx="346" cy="452" r="42"/><circle cx="392" cy="474" r="32"/></g>'
    for (x,y,r) in [(280,500,30),(340,470,40),(400,500,26),(250,536,20),(372,532,24)]: p+=rock_shape(x,y,r)
    return p
def hero_peaks(snow=True):
    p=''
    for (cx,base,w,h) in [(150,470,150,180),(320,460,170,200),(240,480,120,150)]:
        p+=f'<path d="M{cx},{base-h} L{cx+w/2},{base} L{cx-w/2},{base} Z" fill="url(#peak)"/>'
        p+=f'<path d="M{cx},{base-h} L{cx+w*0.18},{base-h*0.62} L{cx},{base-h*0.5} L{cx-w*0.18},{base-h*0.6} Z" fill="#FFFFFF"/>'
    for (x,y,rx) in [(120,560,150),(360,566,170)]: p+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="34" fill="#FFFFFF" opacity="0.9"/>'
    return p
def hero_avalanche():
    p=hero_peaks(True)
    p+=f'<path d="M300,318 L338,318 C356,410 372,496 396,562 L232,562 C262,496 282,410 300,318 Z" fill="#FFFFFF" opacity="0.9"/>'
    for (x,y,r) in [(268,558,20),(312,562,26),(356,558,20)]: p+=f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF" opacity="0.92"/>'
    return p
def hero_ice():
    p=''
    for (cx,base,h,w,op) in [(150,522,120,34,1),(300,508,155,42,1),(210,532,96,26,0.95),(372,520,120,32,0.95)]: p+=ice_shard(cx,base,h,w)
    ix,iy=238,552
    p+=f'<path d="M{ix-48},{iy} A48,42 0 0 1 {ix+48},{iy} Z" fill="#EAF4FB"/><path d="M{ix-30},{iy} A30,44 0 0 1 {ix+30},{iy}" fill="none" stroke="#C4DCEC" stroke-width="2"/><ellipse cx="{ix}" cy="{iy}" rx="13" ry="17" fill="#8FB0C8"/>'
    for (x,y,rx) in [(120,556,150),(360,562,170)]: p+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="30" fill="#FFFFFF"/>'
    return p
def hero_dunes():
    p=f'<ellipse cx="120" cy="470" rx="240" ry="80" fill="url(#hillmid)"/><ellipse cx="380" cy="510" rx="270" ry="90" fill="url(#hillnear)"/>'
    p+=f'<path d="M120,430 L170,360 L220,430 Z" fill="url(#sand)" opacity="0.7"/>'  # distant mesa/pyramid
    p+=f'<path d="M0,430 Q160,410 320,430 T520,432" stroke="#F7E4A8" stroke-width="3" fill="none" opacity="0.5"/><path d="M40,470 Q200,452 360,470 T560,474" stroke="#F7E4A8" stroke-width="3" fill="none" opacity="0.4"/>'
    p+=cactus(360,470,1.0)
    return p
# ---- theme frames (top/side framing) ----
def frame_jungle(cfg):
    P=[frond(-6,-6,320,58,"url(#leaffg)","url(#leafhi)"),frond(486,-10,320,122,"url(#leaffg)","url(#leafhi)"),
       vine(80,0,150,"url(#leaffg)","url(#leafhi)"),vine(150,0,110,"url(#leaffg)","url(#leafhi)"),
       vine(400,0,140,"url(#leaffg)","url(#leafhi)"),vine(330,0,96,"url(#leaffg)","url(#leafhi)"),
       frond(-10,884,300,-58,"url(#leaffg)","url(#leafhi)"),frond(490,888,300,-122,"url(#leaffg)","url(#leafhi)")]
    return "".join(P)
def frame_palm(cfg):
    P=[palm_leaf(24,-6,200,60,"url(#leaffg)","url(#leafhi)"),palm_leaf(456,-10,200,120,"url(#leaffg)","url(#leafhi)"),
       palm_leaf(-4,18,170,38,"url(#leaffg)","url(#leafhi)"),palm_leaf(484,22,170,142,"url(#leaffg)","url(#leafhi)"),
       palm_leaf(-6,882,150,-52,"url(#leaffg)","url(#leafhi)"),palm_leaf(486,886,150,-128,"url(#leaffg)","url(#leafhi)")]
    return "".join(P)
def frame_snow(cfg):
    P=[frond(-6,-6,300,58,"url(#pinef2)","#FFFFFF",snow=True),frond(486,-10,300,122,"url(#pinef2)","#FFFFFF",snow=True),
       frond(-8,884,280,-58,"url(#pinef2)","#FFFFFF",snow=True),frond(488,888,280,-122,"url(#pinef2)","#FFFFFF",snow=True)]
    random.seed(cfg['seed'])
    for i in range(11): P.append(icicle(random.uniform(16,464),0,random.uniform(16,42),random.uniform(8,16)))
    return "".join(P)
def frame_rock(cfg):
    P=[f'<path d="M0,0 L160,0 C126,42 62,62 0,68 Z" fill="url(#rockdark)"/>',f'<path d="M480,0 L320,0 C354,46 418,66 480,72 Z" fill="url(#rockdark)"/>']
    P+=[shrub(58,68,1.0,"url(#leaffg)","url(#leafhi)"),shrub(422,74,1.0,"url(#leaffg)","url(#leafhi)")]
    for i in range(6): P.append(icicle(0,0,0,0)) if False else None
    P+=[frond(-8,884,260,-58,"url(#leaffg)","url(#leafhi)"),frond(488,888,260,-122,"url(#leaffg)","url(#leafhi)")]
    return "".join([x for x in P if x])
# ---- theme grounds (bottom props) ----
def bushrow(fill,hi,snow=False):
    o=''
    for (x,y,s) in [(60,824,1.4),(420,826,1.4),(240,848,1.5)]:
        o+=f'<ellipse cx="{x}" cy="{y}" rx="{60*s}" ry="{34*s}" fill="{fill}"/><ellipse cx="{x-14*s}" cy="{y-10*s}" rx="{30*s}" ry="{16*s}" fill="{hi}" opacity="0.85"/>'
        if snow: o+=f'<ellipse cx="{x}" cy="{y-18*s}" rx="{52*s}" ry="{16*s}" fill="#FFFFFF" opacity="0.85"/>'
    return o
def ground_jungle(cfg):
    o=bushrow("url(#leaffg)","url(#leafhi)")
    for (x,b,s) in [(40,808,1.2),(446,806,1.2)]: o+=fern(x,b,s,"url(#leaffg)","url(#leafhi)")
    for (x,b,s,c) in [(70,830,1.1,"#E8563C"),(410,828,1.0,"#F0A83C"),(150,846,0.8,"#E8563C")]: o+=mushroom(x,b,s,c)
    for (x,y,c) in [(96,806,"#FF7EA6"),(400,806,"#FF7EA6"),(60,846,"#FFD24A")]: o+=flowerc(x,y,c)
    random.seed(cfg['seed'])
    for i in range(18):
        gx=random.uniform(0,480)
        if 130<gx<350: continue
        o+=grasstuft(gx,556+random.uniform(-4,8),0.7+random.random()*0.6,"#2E8A1E")
    return o
def ground_swamp(cfg):
    o=bushrow("url(#leaffg)","url(#leafhi)")
    for (x,b,h) in [(40,808,62),(74,814,72),(444,806,66),(412,814,58)]: o+=reed(x,b,h,"url(#leaffg)")
    for (x,b,h) in [(58,810,66),(428,810,60)]: o+=cattail(x,b,h,"url(#leaffg)")
    o+=lilypad(96,842,26,"url(#leafhi)","#FF9E4A")+lilypad(392,846,28,"url(#leafhi)",None)+logp(150,836,92)
    o+=f'<ellipse cx="300" cy="846" rx="46" ry="12" fill="#5E4A2E" opacity="0.5"/>'
    return o
def ground_rocky(cfg):
    o=bushrow("url(#leaffg)","url(#leafhi)")
    for (x,y,r) in [(60,824,22),(92,838,15),(410,826,24),(442,840,15),(240,848,20)]: o+=rock_shape(x,y,r)
    o+=pine(120,834,0.8,False)+pine(380,832,0.9,False)+shrub(40,820,0.9,"url(#leaffg)","url(#leafhi)")+shrub(446,822,0.9,"url(#leaffg)","url(#leafhi)")
    random.seed(cfg['seed'])
    for i in range(14):
        gx=random.uniform(0,480)
        if 140<gx<340: continue
        o+=grasstuft(gx,556+random.uniform(-2,8),0.6+random.random()*0.5,"#7A8A3A")
    return o
def ground_volcanic(cfg):
    o=bushrow("url(#leaffg)","url(#leafhi)")
    for (x,y,r) in [(60,826,22),(410,828,24),(240,848,20),(96,840,14)]: o+=rock_shape(x,y,r,"url(#rockdark)")
    for (x,b,s) in [(44,816,1.0),(442,818,1.0)]: o+=fern(x,b,s,"url(#leaffg)","url(#leafhi)")
    o+=shrub(120,830,0.9,"url(#leaffg)","url(#leafhi)")+shrub(380,828,0.9,"url(#leaffg)","url(#leafhi)")
    return o
def ground_desert(cfg):
    o=''
    for (x,y,rx) in [(60,832,88),(420,834,96),(240,852,120)]: o+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="30" fill="url(#hillnear)"/>'
    o+=cactus(72,828,0.85)+cactus(414,826,0.95)
    for (x,y,r) in [(120,842,18),(360,844,20),(180,850,14)]: o+=rock_shape(x,y,r,"url(#rock)")
    random.seed(cfg['seed'])
    for i in range(16):
        gx=random.uniform(0,480)
        if 140<gx<340: continue
        o+=grasstuft(gx,558+random.uniform(-2,8),0.6+random.random()*0.5,"#B89A4A")
    return o
def ground_snow(cfg):
    o=''
    for (x,y,rx) in [(60,830,96),(420,832,104),(240,852,128)]: o+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="30" fill="#FFFFFF"/>'
    o+=pine(84,830,0.8,True)+pine(406,828,0.9,True)+pine(150,842,0.6,True)
    for (x,y,r) in [(120,842,18),(356,844,20)]:
        o+=rock_shape(x,y,r,"url(#rock)")+f'<ellipse cx="{x}" cy="{y-r*0.7}" rx="{r*0.9}" ry="{r*0.4}" fill="#FFFFFF"/>'
    return o
def ground_ice(cfg):
    o=''
    for (x,y,rx) in [(60,832,96),(420,834,104),(240,854,128)]: o+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="28" fill="#FFFFFF"/>'
    for (cx,b,h,w) in [(70,826,44,16),(410,824,48,18),(150,840,30,12),(356,842,30,12)]: o+=ice_shard(cx,b,h,w)
    for (x,y,r) in [(110,844,16),(370,846,18)]: o+=rock_shape(x,y,r,"url(#rock)")+f'<ellipse cx="{x}" cy="{y-r*0.7}" rx="{r*0.9}" ry="{r*0.4}" fill="#FFFFFF"/>'
    return o
def base_defs(cfg):
    d=[lg("sky",cfg['sky']),rg("sundisc",[(0,"#FFFBE0"),(0.6,"#FFEEA8"),(1,cfg['sunc'])]),
       rg("sunglow",[(0,cfg['sunc'],0.9),(0.5,cfg['sunc'],0.4),(1,cfg['sunc'],0.0)]),lg("ray",[(0,"#FFF6CE",0.55),(1,"#FFF6CE",0.0)]),
       lg("hillfar",cfg['far']),lg("hillmid",cfg['mid']),lg("hillnear",cfg['near']),lg("leaffg",cfg['leaf']),lg("leafhi",cfg['leafhi']),
       lg("trunk",[(0,"#8A5A34"),(1,"#5E3A20")]),lg("canopy",[(0,"#6FC24A"),(1,"#3C8A28")]),lg("canopyhi",[(0,"#A8E67A"),(1,"#6FC24A")]),
       lg("pinef",[(0,"#3E7A4E"),(1,"#245234")]),lg("pinef2",[(0,"#356B45"),(1,"#1E4A2E")]),lg("rock",[(0,"#C9AE86"),(1,"#8A6B4A")]),lg("rockdark",[(0,"#9A7E5C"),(1,"#5E4630")]),
       lg("cliff",[(0,"#7FBF55"),(1,"#3F7A2A")]),lg("water",[(0,"#EAFBFF"),(0.35,"#9FE6F2"),(1,"#37AED2")]),
       lg("volc",[(0,"#8A5A3E"),(1,"#4A2E1E")]),rg("lavaglow",[(0,"#FF8A3D",0.7),(1,"#FF8A3D",0.0)]),lg("lava",[(0,"#FFD24A"),(1,"#FF5A2D")]),
       lg("cactus",[(0,"#6FB05A"),(1,"#3E7A34")]),lg("peak",[(0,"#CFE0EC"),(1,"#8FB0C8")]),lg("sand",[(0,"#F2DA9E"),(1,"#D8B45E")]),
       lg("mud",[(0,"#7A5230"),(1,"#4E3218")]),lg("mudhi",[(0,"#A8703E"),(1,"#7A5230")]),lg("ice",[(0,"#EAF7FF"),(1,"#A8D2EC")])]
    return "<defs>"+"".join(d)+"</defs>"
def scene(cfg):
    sunx,suny,rc=cfg.get('sunpos',(118,120,58))
    P=[f'<rect width="{W}" height="{H}" fill="url(#sky)"/>',sun(sunx,suny,rc,cfg.get('sunwarm','#FFF3C0')),rays(sunx,suny),
       cloud(360,110,1.0,0.95),cloud(250,70,0.7,0.8),cloud(60,210,0.6,0.7),cloud(410,190,0.55,0.65),
       f'<path d="M0,360 C80,320 150,340 240,320 C330,302 400,332 480,316 L480,540 L0,540 Z" fill="url(#hillfar)" opacity="0.9"/>',
       f'<path d="M0,430 C70,398 160,418 250,404 C340,390 420,414 480,402 L480,640 L0,640 Z" fill="url(#hillmid)"/>',
       cfg['hero'](),particles(cfg['particle'],cfg['seed']),
       f'<path d="M0,560 C80,528 170,548 260,536 C350,524 420,548 480,540 L480,854 L0,854 Z" fill="url(#hillnear)"/>',
       cfg['ground'](cfg),cfg['frame'](cfg),sparkles(cfg['seed'])]
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*2}" height="{H*2}" viewBox="0 0 {W} {H}">'+base_defs(cfg)+"".join(P)+"</svg>"
G=[(0,"#2E7A1A"),(1,"#164A10")]; GH=[(0,"#9BEA52"),(1,"#2E8A1E")]
WORLDS={
 'waterfall':dict(sky=[(0,"#22B0F0"),(0.45,"#5FCBEE"),(0.75,"#B4E8F2"),(1,"#E4F7DE")],sunc="#FFE59A",sunpos=(118,120,58),far=[(0,"#8FE0CE"),(1,"#5FBFB2")],mid=[(0,"#8BE04A"),(1,"#3FA028")],near=[(0,"#3FA028"),(1,"#2E8018")],leaf=G,leafhi=GH,hero=hero_waterfall,frame=frame_jungle,ground=ground_jungle,particle='leaf',seed=7),
 'home':dict(sky=[(0,"#22B0F0"),(0.45,"#5FCBEE"),(0.75,"#B4E8F2"),(1,"#E4F7DE")],sunc="#FFE59A",sunpos=(118,116,60),far=[(0,"#8FE0CE"),(1,"#5FBFB2")],mid=[(0,"#8BE04A"),(1,"#3FA028")],near=[(0,"#3FA028"),(1,"#2E8018")],leaf=G,leafhi=GH,hero=hero_waterfall,frame=frame_jungle,ground=ground_jungle,particle='leaf',seed=11),
 'volcano':dict(sky=[(0,"#20A6C8"),(0.4,"#6FCBDC"),(0.72,"#FFBE86"),(1,"#FFDCB4")],sunc="#FFD9A0",sunpos=(370,120,54),sunwarm="#FFE3B0",far=[(0,"#E0A488"),(1,"#C0806A")],mid=[(0,"#8BE04A"),(1,"#3FA028")],near=[(0,"#3FA028"),(1,"#2E8018")],leaf=G,leafhi=GH,hero=hero_volcano,frame=frame_palm,ground=ground_volcanic,particle='ember',seed=4),
 'mudslide':dict(sky=[(0,"#2FB6F0"),(0.45,"#6FCDF0"),(0.75,"#BFE8F2"),(1,"#E4F5DE")],sunc="#FFE59A",sunpos=(118,120,56),far=[(0,"#8FE0CE"),(1,"#5FBFB2")],mid=[(0,"#7FCA46"),(1,"#3A9226")],near=[(0,"#3A9226"),(1,"#2A7016")],leaf=G,leafhi=GH,hero=hero_mud,frame=frame_jungle,ground=ground_swamp,particle='rain',seed=8),
 'landslide':dict(sky=[(0,"#4FBEE0"),(0.45,"#8FD6EC"),(0.78,"#D6EEE0"),(1,"#EEF8E4")],sunc="#FFE7A6",sunpos=(360,120,56),far=[(0,"#BBA786"),(1,"#9A7E5C")],mid=[(0,"#8BE04A"),(1,"#3FA028")],near=[(0,"#3FA028"),(1,"#2E8018")],leaf=G,leafhi=GH,hero=hero_boulders,frame=frame_rock,ground=ground_rocky,particle='dust',seed=6),
 'sandstorm':dict(sky=[(0,"#F7B032"),(0.4,"#F8C85E"),(0.72,"#F8E2A0"),(1,"#FBEEC4")],sunc="#FFEEA8",sunpos=(360,116,60),sunwarm="#FFF4C0",far=[(0,"#E6C888"),(1,"#D0A85E")],mid=[(0,"#F0B84E"),(1,"#C98A2E")],near=[(0,"#E0A83E"),(1,"#A86A10")],leaf=[(0,"#8A8A3A"),(1,"#5E6022")],leafhi=[(0,"#C8C86A"),(1,"#8A8A3A")],hero=hero_dunes,frame=frame_palm,ground=ground_desert,particle='dust',seed=3),
 'avalanche':dict(sky=[(0,"#6FB2E0"),(0.45,"#A0CEEE"),(0.78,"#D4EAF8"),(1,"#EDF7FF")],sunc="#EAF6FF",sunpos=(360,120,50),sunwarm="#FFFFFF",far=[(0,"#AEC6DA"),(1,"#8FAAC2")],mid=[(0,"#CFE2F0"),(1,"#A8C6DC")],near=[(0,"#E0EEF8"),(1,"#BCD4E6")],leaf=[(0,"#2E5E3E"),(1,"#1E4230")],leafhi=[(0,"#FFFFFF"),(1,"#DCEFF0")],hero=hero_avalanche,frame=frame_snow,ground=ground_snow,particle='snow',seed=5),
 'blizzard':dict(sky=[(0,"#6FBCE0"),(0.42,"#A6DCEE"),(0.78,"#D6EEF8"),(1,"#F2FCFF")],sunc="#EAF9FF",sunpos=(118,120,48),sunwarm="#FFFFFF",far=[(0,"#B8D4E8"),(1,"#9AC0D8")],mid=[(0,"#D4ECF6"),(1,"#AAD2E8")],near=[(0,"#E6F4FB"),(1,"#BEE0F0")],leaf=[(0,"#2E5E3E"),(1,"#1E4230")],leafhi=[(0,"#FFFFFF"),(1,"#DCEFF0")],hero=hero_ice,frame=frame_snow,ground=ground_ice,particle='snow',seed=2),
}
from PIL import Image, ImageDraw
proj="/sessions/gallant-blissful-wozniak/mnt/Wordslide/game/src/assets/backgrounds"; art="/sessions/gallant-blissful-wozniak/mnt/Wordslide/art/backgrounds"
os.makedirs(proj,exist_ok=True); os.makedirs(art,exist_ok=True)
for name,cfg in WORLDS.items():
    svg=scene(cfg); open(f"{art}/{name}.svg","w").write(svg); open(f"w_{name}.svg","w").write(svg)
    subprocess.run(["python3","-m","cairosvg",f"w_{name}.svg","-o",f"w_{name}.png","-W","480","-H","854"])
    subprocess.run(["python3","-m","cairosvg",f"w_{name}.svg","-o",f"{proj}/bg_{name}.png","-W","960","-H","1708"])
order=['waterfall','volcano','mudslide','landslide','sandstorm','avalanche','blizzard']
cols=4; th=(230,409); rows=2; pad=12
sheet=Image.new("RGB",(cols*(th[0]+pad)+pad, rows*(th[1]+pad+18)+pad),(26,26,30)); d=ImageDraw.Draw(sheet)
for i,name in enumerate(order):
    im=Image.open(f"w_{name}.png").convert("RGB").resize(th); c=i%cols; r=i//cols
    x=pad+c*(th[0]+pad); y=pad+r*(th[1]+pad+18); sheet.paste(im,(x,y)); d.text((x+4,y+th[1]+2),name,fill=(230,230,230))
sheet.save("_worlds_contact.png"); print("done")

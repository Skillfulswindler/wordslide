/* Wordslide — WS.Art: bakes all static artwork into textures ONCE per scene
   (huge perf win: Phaser re-tessellates Graphics every frame; Images are free).
   Everything is procedural — layered skies, mountains, world set pieces, wooden
   frames, beveled tiles — bright and stylized. */
(function(){
"use strict";
const WS=window.WS;
const {W,H,COLS,ROWS,CELL,TILE,TRAY_TILE,BOARD_LEFT,BOARD_TOP,BOARD_W,BOARD_H,TRAY_X,TRAY_Y,TRAY_SIZE,TRAY_GAP,C}=WS;

const mix=(a,b,t)=>{
  const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;
  return (Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t);
};
const shade=(c,t)=>mix(c,0x000000,t), tint=(c,t)=>mix(c,0xFFFFFF,t);

// deterministic pseudo-random for scenery jitter
function prand(seed){ let a=seed>>>0; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; }

WS.Art={
  has(scene,key){ return scene.textures.exists(key); },

  // ---------- shared small textures ----------
  common(scene){
    const g=scene.make.graphics({add:false});
    if(!this.has(scene,'cloud')){
      g.clear(); g.fillStyle(0xffffff,1);
      g.fillCircle(26,26,16); g.fillCircle(46,18,14); g.fillCircle(64,26,15); g.fillCircle(84,22,11);
      g.fillRoundedRect(12,24,84,16,8);
      g.generateTexture('cloud',104,44);
    }
    if(!this.has(scene,'glowdot')){
      g.clear();
      for(let i=8;i>0;i--){ g.fillStyle(0xFFE9A8,0.12); g.fillCircle(32,32,i*4); }
      g.generateTexture('glowdot',64,64);
    }
    g.destroy();
  },

  // ---------- tiles (drawn 2x for crispness) ----------
  tiles(scene){
    const S=TRAY_TILE*2, r=16;
    const face=(g,base)=>{
      g.fillStyle(shade(base,0.45),1); g.fillRoundedRect(0,10,S,S-10,r);        // under-shadow
      g.fillStyle(shade(base,0.22),1); g.fillRoundedRect(0,6,S,S-8,r);          // side
      g.fillStyle(base,1); g.fillRoundedRect(0,0,S,S-8,r);                      // face
      g.fillStyle(tint(base,0.5),0.85); g.fillRoundedRect(5,3,S-10,16,{tl:12,tr:12,bl:6,br:6}); // top highlight
      g.lineStyle(3,shade(base,0.35),0.6); g.strokeRoundedRect(1.5,1.5,S-3,S-9.5,r);
    };
    const mk=(key,base,extra)=>{
      if(this.has(scene,key)) return;            // shipped PNG wins (assets/tiles/<key>.png)
      const g=scene.make.graphics({add:false});
      face(g,base);
      if(extra) extra(g);
      g.generateTexture(key,S,S+4); g.destroy();
    };
    mk('tile_n',0xFFF1CE);
    mk('tile_gold',0xFBC85A,g=>{
      g.lineStyle(4,0xD9A32E,1); g.strokeRoundedRect(2,2,S-4,S-12,r);
      g.fillStyle(0xFFFFFF,0.9);                                                // sparkle
      g.fillTriangle(S-22,10,S-18,20,S-26,20); g.fillTriangle(S-22,30,S-18,20,S-26,20);
    });
    mk('tile_ember',0xF07A46,g=>{
      g.lineStyle(4,0xFFC04A,1); g.strokeRoundedRect(2,2,S-4,S-12,r);
      g.fillStyle(0xFFD24A,0.95); g.fillTriangle(14,26,20,10,26,26); g.fillCircle(20,26,7); // little flame
    });
    mk('tile_boulder',0x9A8F82,g=>{
      g.fillStyle(0xB5AA9C,1); g.fillCircle(S*0.34,S*0.34,S*0.2);
      g.fillStyle(0x84796C,1); g.fillCircle(S*0.66,S*0.6,S*0.15);
      g.fillStyle(0x776D61,1); g.fillCircle(S*0.3,S*0.72,S*0.1);
      g.lineStyle(3,0x6E655B,0.7); g.strokeRoundedRect(1.5,1.5,S-3,S-9.5,r);
    });
    // frost overlay (color-independent snow star baked in)
    if(this.has(scene,'tile_frost')) return;
    const g=scene.make.graphics({add:false});
    g.fillStyle(0xDCEFFA,0.94); g.fillRoundedRect(0,0,S,S-8,r);
    g.lineStyle(3,0xA9D3EC,1); g.strokeRoundedRect(1.5,1.5,S-3,S-11,r);
    g.lineStyle(4,0x7FB4D6,1);
    const cx=S/2,cy=(S-8)/2;
    for(let i=0;i<6;i++){ const a=i*Math.PI/3;
      g.lineBetween(cx,cy,cx+Math.cos(a)*16,cy+Math.sin(a)*16); }
    g.generateTexture('tile_frost',S,S+4); g.destroy();
  },

  // ---------- board cells + wooden frames ----------
  board(scene,cb){
    const key='boardcells'+(cb?'_cb':'');
    if(this.has(scene,key)) return key;
    // Shipped art path: compose the board from per-cell PNGs (cell_base + one
    // per bonus type). Authored @2x, so draw at TILE*2 then bake down.
    if(this.has(scene,'cell_base')){
      const rt=scene.make.renderTexture({x:0,y:0,width:BOARD_W+2,height:BOARD_H+2},false);
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        const sq=WS.sqAt(r,c);
        const ck = sq && this.has(scene,'cell_'+sq.key) ? 'cell_'+sq.key : 'cell_base';
        const im=scene.make.image({x:0,y:0,key:ck,add:false}).setOrigin(0).setDisplaySize(TILE,TILE);
        rt.draw(im, c*CELL+1, r*CELL+1);
        im.destroy();
      }
      rt.saveTexture(key);
      return key;
    }
    {
      const g=scene.make.graphics({add:false});
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        const sq=WS.sqAt(r,c);
        let fill=C.boardCell;
        if(sq) fill=cb&&WS.SQ_CB[sq.key]?WS.SQ_CB[sq.key]:sq.fill;
        const x=c*CELL+1,y=r*CELL+1;
        g.fillStyle(shade(fill,0.18),1); g.fillRoundedRect(x,y+1.5,TILE,TILE,5);
        g.fillStyle(fill,1); g.fillRoundedRect(x,y,TILE,TILE-1,5);
        g.fillStyle(0xffffff,0.25); g.fillRoundedRect(x+2,y+1,TILE-4,5,2);
        if(sq&&sq.shape){
          g.fillStyle(sq.ink,0.5);
          const sx=x+TILE-6,sy=y+6,s=3;
          if(sq.shape==='circle') g.fillCircle(sx,sy,s);
          else if(sq.shape==='triangle') g.fillTriangle(sx,sy-s,sx-s,sy+s,sx+s,sy+s);
          else if(sq.shape==='square') g.fillRect(sx-s,sy-s,s*2,s*2);
          else if(sq.shape==='diamond'){ g.fillTriangle(sx,sy-s,sx-s,sy,sx+s,sy); g.fillTriangle(sx-s,sy,sx+s,sy,sx,sy+s); }
        }
      }
      g.generateTexture(key,BOARD_W+2,BOARD_H+2); g.destroy();
    }
    return key;
  },
  /* A HOLLOW wooden frame: border only, transparent centre. Used for the board,
     which is now translucent — woodFrame's opaque cream inner panel was filling
     the board with beige and hiding the world art behind it. */
  hollowFrame(scene,key,w,h,r0){
    if(this.has(scene,key)) return;
    const bd=10, R=r0||18;
    // Border art: shipped wooden 9-slice if present, else procedural.
    if(!WS.Assets.bakeNine(scene,'panel_frame',key,w,h+4)){
      const g=scene.make.graphics({add:false});
      g.fillStyle(0x8A5A32,1); g.fillRoundedRect(0,4,w,h,R);
      g.fillStyle(0xA9713D,1); g.fillRoundedRect(0,0,w,h,R);
      g.fillStyle(0xC08A4E,0.9); g.fillRoundedRect(3,2,w-6,7,4);
      g.fillStyle(0x6E4526,0.9);
      [[7,7],[w-7,7],[7,h-7],[w-7,h-7]].forEach(([x,y])=>g.fillCircle(x,y,3.5));
      g.lineStyle(3,0x6E4526,0.9); g.strokeRoundedRect(bd,bd,w-2*bd,h-2*bd,R-8);
      g.generateTexture(key,w,h+4); g.destroy();
    }
    // A hollow frame must be HOLLOW regardless of source: the shipped
    // panel_frame.png ships a CREAM centre, and that pale fill was the "pale
    // square" bleeding out around the board. Punch a transparent centre via
    // canvas (Graphics can't erase) on BOTH the shipped and procedural paths.
    try{
      const src=scene.textures.get(key).getSourceImage();
      const cw=src.width, ch=src.height;
      const cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
      const ctx=cv.getContext('2d');
      ctx.drawImage(src,0,0);
      ctx.globalCompositeOperation='destination-out';
      ctx.beginPath();
      const rr=Math.max(2,R-8), x0=bd+2, y0=bd+2, ww=cw-2*bd-4, hh=ch-2*bd-8;
      ctx.moveTo(x0+rr,y0);
      ctx.arcTo(x0+ww,y0,x0+ww,y0+hh,rr); ctx.arcTo(x0+ww,y0+hh,x0,y0+hh,rr);
      ctx.arcTo(x0,y0+hh,x0,y0,rr);       ctx.arcTo(x0,y0,x0+ww,y0,rr);
      ctx.closePath(); ctx.fill();
      scene.textures.remove(key);
      scene.textures.addCanvas(key, cv);
    }catch(e){ /* keep the filled frame rather than crash */ }
  },

  woodFrame(scene,key,w,h,r0){
    if(this.has(scene,key)) return;
    // Shipped art path: bake the 9-sliced wooden panel into <key> so every
    // existing add.image(x,y,key) call site works untouched.
    if(WS.Assets.bakeNine(scene,'panel_wood',key,w,h+4)) return;
    const g=scene.make.graphics({add:false});
    const bd=10, R=r0||18;
    g.fillStyle(0x8A5A32,1); g.fillRoundedRect(0,4,w,h,R);                       // under
    g.fillStyle(0xA9713D,1); g.fillRoundedRect(0,0,w,h,R);                       // frame
    g.fillStyle(0xC08A4E,0.9); g.fillRoundedRect(3,2,w-6,7,4);                   // top light
    const rnd=prand(w*31+h*7);
    g.lineStyle(2,0x8A5A32,0.35);                                                // grain
    for(let i=0;i<Math.floor(w/26);i++){ const x=8+rnd()*(w-16); g.lineBetween(x,4,x+rnd()*8-4,h-4); }
    g.fillStyle(0xF7EFE2,1); g.fillRoundedRect(bd,bd,w-2*bd,h-2*bd,R-8);         // inner panel
    g.fillStyle(0x6E4526,0.9);                                                   // corner studs
    [[7,7],[w-7,7],[7,h-7],[w-7,h-7]].forEach(([x,y])=>g.fillCircle(x,y,3.5));
    g.generateTexture(key,w,h+4); g.destroy();
  },

  // ---------- full world scenery, baked to one texture ----------
  scenery(scene,worldKey){
    if(this.has(scene,'bg_'+worldKey)) return 'bg_'+worldKey;   // SVG illustration (svgart.js)
    const key='scene_'+worldKey;
    if(this.has(scene,key)) return key;
    const cfg=WS.WORLDS[worldKey]||{sky:[0x8FD6EC,0xFFF7E8],mtn:[0x2E8BA8,0x56C06A],accent:0x15A6A0,key:'home'};
    const g=scene.make.graphics({add:false});
    const rnd=prand(WS.hashStr(worldKey));
    // sky: 3-stop gradient in bands (baked => free)
    const top=cfg.sky[0], bot=cfg.sky[1], mid=mix(top,bot,0.45);
    for(let i=0;i<40;i++){
      const t=i/40, c=t<0.5?mix(top,mid,t*2):mix(mid,bot,(t-0.5)*2);
      g.fillStyle(c,1); g.fillRect(0,Math.floor(H*t),W,Math.ceil(H/40)+1);
    }
    // sun tucked into the top corner (the HUD owns that band)
    const sunX=W-40, sunY=18;
    for(let i=4;i>0;i--){ g.fillStyle(0xFFF2C4,0.08); g.fillCircle(sunX,sunY,20+i*10); }
    g.fillStyle(0xFFE9A8,0.7); g.fillCircle(sunX,sunY,22);
    // faint small clouds high up, behind the HUD
    for(let i=0;i<3;i++){
      const cx=40+rnd()*(W-120), cy=8+rnd()*26, s=0.4+rnd()*0.4;
      g.fillStyle(0xffffff,0.3);
      g.fillCircle(cx,cy,14*s); g.fillCircle(cx+16*s,cy-5*s,11*s); g.fillCircle(cx+30*s,cy,12*s);
      g.fillRoundedRect(cx-10*s,cy,50*s,10*s,5*s);
    }
    // mountain layers (3, far->near)
    const ridge=(baseY,amp,col,alpha,peaks)=>{
      g.fillStyle(col,alpha);
      g.beginPath(); g.moveTo(0,H);
      g.lineTo(0,baseY+rnd()*amp*0.5);
      const n=peaks||6;
      for(let i=1;i<=n;i++){
        const x=W*i/n, y=baseY-(i%2?amp:amp*0.35)-rnd()*amp*0.5;
        g.lineTo(x-W/n/2, y);
        g.lineTo(x, baseY-rnd()*amp*0.3);
      }
      g.lineTo(W,H); g.closePath(); g.fillPath();
    };
    ridge(H*0.52,70,tint(cfg.mtn[0],0.45),0.9,5);
    ridge(H*0.60,90,cfg.mtn[1],0.95,6);
    ridge(H*0.70,80,cfg.mtn[0],1,4);
    // world set pieces
    if(worldKey==='volcano'){
      g.fillStyle(0x5A241A,1); g.beginPath(); g.moveTo(W*0.18,H*0.62); g.lineTo(W*0.38,H*0.30); g.lineTo(W*0.44,H*0.30); g.lineTo(W*0.64,H*0.62); g.closePath(); g.fillPath();
      g.fillStyle(0xFF5A2D,1); g.fillEllipse(W*0.41,H*0.305,34,10);
      for(let i=4;i>0;i--){ g.fillStyle(0xFF7A3D,0.14); g.fillEllipse(W*0.41,H*0.30,40+i*14,12+i*5); }
      g.fillStyle(0xFF8A4D,0.9); g.fillRect(W*0.40,H*0.31,5,60); g.fillRect(W*0.435,H*0.31,3,40);
    }
    if(worldKey==='waterfall'){
      g.fillStyle(0xEAF7FB,0.95); g.fillRoundedRect(W*0.44,H*0.36,34,H*0.30,8);
      g.fillStyle(0xBFE6F2,0.8); g.fillRoundedRect(W*0.448,H*0.36,10,H*0.30,4);
      for(let i=3;i>0;i--){ g.fillStyle(0xffffff,0.18); g.fillEllipse(W*0.475,H*0.67,50+i*18,14+i*5); }
    }
    if(worldKey==='blizzard'||worldKey==='avalanche'){
      // snow caps on the near ridge + pines
      g.fillStyle(0xffffff,0.9);
      for(let i=0;i<5;i++){ const x=30+rnd()*(W-60), y=H*0.52+rnd()*40; g.fillTriangle(x,y,x-22,y+16,x+22,y+16); }
      g.fillStyle(shade(cfg.mtn[0],0.3),1);
      for(let i=0;i<6;i++){ const x=20+rnd()*(W-40), y=H*0.66+rnd()*30, s=0.7+rnd()*0.6;
        g.fillTriangle(x,y-26*s,x-11*s,y,x+11*s,y); g.fillTriangle(x,y-16*s,x-13*s,y+8*s,x+13*s,y+8*s); g.fillRect(x-2,y+8*s,4,7); }
    }
    if(worldKey==='sandstorm'){
      g.fillStyle(tint(cfg.mtn[1],0.25),0.8);
      g.fillEllipse(W*0.3,H*0.66,220,60); g.fillEllipse(W*0.75,H*0.70,260,70);
      g.fillStyle(0xE8CB8A,0.35); for(let i=0;i<8;i++){ const y=H*0.3+rnd()*H*0.3; g.fillRect(0,y,W,2+rnd()*2); }
    }
    if(worldKey==='mudslide'||worldKey==='landslide'){
      // winding slide path + rocks
      g.fillStyle(shade(cfg.mtn[0],0.15),0.9);
      g.beginPath(); g.moveTo(W*0.52,H*0.40); g.lineTo(W*0.60,H*0.40);
      g.lineTo(W*0.72,H*0.58); g.lineTo(W*0.60,H*0.75); g.lineTo(W*0.44,H*0.75); g.lineTo(W*0.58,H*0.58); g.closePath(); g.fillPath();
      g.fillStyle(0x84796C,1);
      for(let i=0;i<7;i++){ const x=W*0.45+rnd()*W*0.25, y=H*0.45+rnd()*H*0.28; g.fillCircle(x,y,3+rnd()*5); }
    }
    // near foliage strip at the very bottom (behind UI)
    g.fillStyle(shade(cfg.mtn[1],0.25),1); g.fillEllipse(W*0.15,H+10,320,120); g.fillEllipse(W*0.85,H+16,360,130);
    // tumble channel groove
    g.fillStyle(0xffffff,0.32); g.fillRoundedRect(4,BOARD_TOP-6,38,BOARD_H+12,12);
    g.lineStyle(2,0xEADFCA,0.85); g.strokeRoundedRect(4,BOARD_TOP-6,38,BOARD_H+12,12);
    g.generateTexture(key,W,H); g.destroy();
    return key;
  },

  // ---------- foliage (jungle-style framing, baked per world) ----------
  LEAVES:{
    mudslide:  [0x4E8C3A,0x6BAF4C,0x8BC34A,0x3E6E2E],
    landslide: [0x5E7D46,0x7D9C58,0x9CB86A,0x4A6338],
    avalanche: [0x2E6B54,0x3E8B6E,0x6BAF8C,0xD8EEE6],
    volcano:   [0x2E5E3A,0x3E7E4A,0xC0392B,0xE85D3A],
    sandstorm: [0x9CA84E,0xBAC468,0xD9C978,0x7E8A3E],
    waterfall: [0x2E7E4A,0x4E9E5E,0x6BBF7C,0x8BD98C],
    blizzard:  [0x2E5E4A,0x3E6E5A,0xDCEAF4,0xFFFFFF],
    home:      [0x4E8C3A,0x6BAF4C,0x8BC34A,0xC75B33],
  },
  _leaf(g,x,y,len,wid,ang,col,vein){
    g.save(); g.translateCanvas(x,y); g.rotateCanvas(ang);
    g.fillStyle(col,1); g.fillEllipse(len/2,0,len,wid);
    if(vein!==false){ g.lineStyle(1.5,mix(col,0x000000,0.25),0.6); g.lineBetween(3,0,len-4,0); }
    g.restore();
  },
  foliage(scene,worldKey){
    const pal=this.LEAVES[worldKey]||this.LEAVES.home;
    const rnd=prand(WS.hashStr('leaf'+worldKey));
    const keys={canopy:'canopy_'+worldKey, frond:'frond_'+worldKey, bush:'bush_'+worldKey};
    if(!this.has(scene,keys.canopy)){
      const g=scene.make.graphics({add:false});
      for(let x=-6;x<W+10;x+=17){
        const n=2+Math.floor(rnd()*2);
        for(let i=0;i<n;i++){
          const col=pal[Math.floor(rnd()*3)];
          this._leaf(g,x+rnd()*10, -4+rnd()*8, 34+rnd()*30, 12+rnd()*8,
                     Math.PI/2 + (rnd()-0.5)*1.1, col);
        }
      }
      // hanging vine tips
      for(let i=0;i<6;i++){
        const x=20+rnd()*(W-40), drop=30+rnd()*34;
        g.lineStyle(3,pal[3],0.9); g.lineBetween(x,0,x+6,drop);
        this._leaf(g,x+6,drop,20,9,Math.PI/2+(rnd()-0.5),pal[1]);
      }
      g.generateTexture(keys.canopy,W,110); g.destroy();
    }
    if(!this.has(scene,keys.frond)){
      const g=scene.make.graphics({add:false});
      for(let i=0;i<9;i++){
        const a=-0.15+i*(Math.PI*0.55/9)+rnd()*0.08;
        const col=pal[i%3];
        this._leaf(g,6,6,74+rnd()*40,16+rnd()*9,a,col);
      }
      g.generateTexture(keys.frond,150,150); g.destroy();
    }
    if(!this.has(scene,keys.bush)){
      const g=scene.make.graphics({add:false});
      for(let x=-10;x<W+20;x+=15){
        const col=pal[Math.floor(rnd()*3)];
        this._leaf(g,x,84,40+rnd()*30,15+rnd()*9,-Math.PI/2+(rnd()-0.5)*0.9,col);
      }
      g.generateTexture(keys.bush,W,90); g.destroy();
    }
    return keys;
  },
  // attach animated foliage framing to a scene (canopy + swaying corner fronds + bottom bush)
  dressScene(scene,worldKey,opts){
    opts=opts||{};
    // A shipped background is art-directed as a whole — it carries its OWN
    // per-world framing (rock ledges on landslide, icicles on blizzard, charred
    // branches on volcano...). Pasting the generic green procedural leaves on
    // top is what made all seven worlds look identical. So: if bg_<world> is
    // shipped, the background IS the framing. Opt back in with {force:true}.
    if(!opts.force && WS.Assets.shipped('bg_'+worldKey)) return;
    // Shipped art path: a real illustrated frame overlay (assets/ui/frame_canopy.png
    // + optional frame_bush.png). Otherwise fall through to procedural leaves.
    if(WS.Assets.has(scene,'frame_canopy')){
      const d=opts.depth!=null?opts.depth:2;
      scene.add.image(0,0,'frame_canopy').setOrigin(0).setDisplaySize(W,H).setDepth(d);
      if(opts.bush!==false && WS.Assets.has(scene,'frame_bush')){
        const b=scene.add.image(0,H).setTexture('frame_bush').setOrigin(0,1)
          .setDisplaySize(W,120).setDepth(opts.bushDepth!=null?opts.bushDepth:6);
        scene.tweens.add({targets:b,y:H+4,duration:3400,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
      }
      return;
    }
    const k=this.foliage(scene,worldKey);
    scene.add.image(0,-6,k.canopy).setOrigin(0).setDepth(opts.depth!=null?opts.depth:2);
    const fl=scene.add.image(-8,-8,k.frond).setOrigin(0.04,0.04).setDepth(opts.depth!=null?opts.depth:2);
    const fr=scene.add.image(W+8,-8,k.frond).setOrigin(0.04,0.04).setFlipX(true).setDepth(opts.depth!=null?opts.depth:2);
    fr.setOrigin(0.96,0.04);
    scene.tweens.add({targets:fl,angle:3.5,duration:2600,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
    scene.tweens.add({targets:fr,angle:-3.5,duration:3100,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
    if(opts.bush!==false){
      const b=scene.add.image(0,H-64,k.bush).setOrigin(0).setDepth(opts.bushDepth!=null?opts.bushDepth:6);
      scene.tweens.add({targets:b,y:H-60,duration:3400,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
    }
  },
  // wooden sign plank for headers
  sign(scene,key,w,h){
    if(this.has(scene,key)) return key;
    if(WS.Assets.bakeNine(scene,'sign_wood',key,w,h+5)) return key;
    const g=scene.make.graphics({add:false});
    g.fillStyle(0x6E4526,1); g.fillRoundedRect(0,5,w,h,12);
    g.fillStyle(0x9C6B3F,1); g.fillRoundedRect(0,0,w,h,12);
    g.fillStyle(0xB98A55,0.8); g.fillRoundedRect(4,3,w-8,7,4);
    g.lineStyle(3,0x5E3A20,0.8); g.strokeRoundedRect(1.5,1.5,w-3,h-1,11);
    const rnd=prand(w*13+h);
    g.lineStyle(1.5,0x6E4526,0.4);
    for(let i=0;i<4;i++){ const x=10+rnd()*(w-20); g.lineBetween(x,5,x+rnd()*6-3,h-5); }
    g.generateTexture(key,w,h+5); g.destroy();
    return key;
  },
  // confetti burst helper (runtime, cheap)
  confetti(scene,x,y,n){
    const cols=[0xF2A33C,0x56C06A,0x5BB7E6,0xF26C86,0xFBC85A,0x8E6FC1];
    for(let i=0;i<(n||24);i++){
      const p=scene.add.rectangle(x,y,5+Math.random()*5,8+Math.random()*6,cols[i%cols.length]).setDepth(420);
      p.angle=Math.random()*360;
      scene.tweens.add({targets:p,
        x:x+(Math.random()-0.5)*300, y:y+120+Math.random()*260,
        angle:p.angle+(Math.random()-0.5)*720, alpha:0,
        duration:900+Math.random()*700, ease:"Quad.easeIn", onComplete:()=>p.destroy()});
    }
  },

  // simple banded sky texture (fillGradientStyle is WebGL-only, so bake instead)
  skyTex(scene,key,top,bot){
    if(this.has(scene,key)) return key;
    const g=scene.make.graphics({add:false});
    const mid2=mix(top,bot,0.45);
    for(let i=0;i<40;i++){ const t=i/40, c=t<0.5?mix(top,mid2,t*2):mix(mid2,bot,(t-0.5)*2);
      g.fillStyle(c,1); g.fillRect(0,Math.floor(H*t),W,Math.ceil(H/40)+1); }
    g.generateTexture(key,W,H); g.destroy();
    return key;
  },

  // home scene (its own palette)
  homeScene(scene){
    const key='scene_homeart';
    if(this.has(scene,key)) return key;
    const g=scene.make.graphics({add:false});
    const rnd=prand(777);
    const top=0x7ECDEB, mid=0xBFE8F2, bot=0xFFF7E8;
    for(let i=0;i<40;i++){ const t=i/40, c=t<0.5?mix(top,mid,t*2):mix(mid,bot,(t-0.5)*2);
      g.fillStyle(c,1); g.fillRect(0,Math.floor(H*t),W,Math.ceil(H/40)+1); }
    for(let i=6;i>0;i--){ g.fillStyle(0xFFF2C4,0.10); g.fillCircle(W-88,110,26+i*13); }
    g.fillStyle(0xFFE9A8,0.95); g.fillCircle(W-88,110,32);
    const ridge=(baseY,amp,col,alpha,n)=>{ g.fillStyle(col,alpha); g.beginPath(); g.moveTo(0,H); g.lineTo(0,baseY);
      for(let i=1;i<=n;i++){ const x=W*i/n; g.lineTo(x-W/n/2,baseY-(i%2?amp:amp*0.4)-rnd()*amp*0.4); g.lineTo(x,baseY-rnd()*amp*0.2); }
      g.lineTo(W,H); g.closePath(); g.fillPath(); };
    ridge(H*0.58,80,0xA8D8E8,0.9,5);
    ridge(H*0.66,95,0x7FB86A,0.95,6);
    ridge(H*0.76,70,0xC75B33,0.35,4);
    g.fillStyle(0x5E8B4C,1); g.fillEllipse(W*0.16,H+8,340,130); g.fillEllipse(W*0.86,H+14,380,140);
    g.generateTexture(key,W,H); g.destroy();
    return key;
  },

  // ---------- level map (Select scene): a mountain you climb ----------
  // Backdrop: sky gradient + distant range + one central snowy massif. Baked
  // ONCE — the whole thing is a single Image, no per-frame Graphics.
  mapBackdrop(scene){
    // Prefer the painted map art (bg_map.jpg, dropped in like the world scenery).
    if(this.has(scene,'bg_map')) return 'bg_map';
    const key='map_bg';
    if(this.has(scene,key)) return key;
    const g=scene.make.graphics({add:false});
    const top=0x86C6E6, mid=0xC1E2EF, bot=0xF4E8CC;
    for(let i=0;i<44;i++){ const t=i/44, c=t<0.5?mix(top,mid,t*2):mix(mid,bot,(t-0.5)*2);
      g.fillStyle(c,1); g.fillRect(0,Math.floor(H*t),W,Math.ceil(H/44)+1); }
    // sun glow, upper-RIGHT sky — clear of the top-left header text (was upper-left,
    // which sat under the "Climb the slide" title).
    const sunX=W*0.80, sunY=H*0.15;
    for(let i=6;i>0;i--){ g.fillStyle(0xFFF2C4,0.09); g.fillCircle(sunX,sunY,18+i*12); }
    g.fillStyle(0xFFE9A8,0.92); g.fillCircle(sunX,sunY,24);
    const rnd=prand(4242);
    // distant range
    const ridge=(baseY,amp,col,alpha,n)=>{ g.fillStyle(col,alpha); g.beginPath(); g.moveTo(0,H); g.lineTo(0,baseY);
      for(let i=1;i<=n;i++){ const x=W*i/n; g.lineTo(x-W/n/2,baseY-(i%2?amp:amp*0.5)-rnd()*amp*0.3); g.lineTo(x,baseY-rnd()*amp*0.25); }
      g.lineTo(W,H); g.closePath(); g.fillPath(); };
    ridge(H*0.30,64,0xA9CFE1,0.75,5);
    // central massif — the summit sits top-centre where world 7 lands
    const peakX=W*0.52, peakY=H*0.10;
    g.fillStyle(0x8C7A66,1);
    g.beginPath(); g.moveTo(0,H); g.lineTo(W*0.16,H*0.60); g.lineTo(peakX,peakY);
    g.lineTo(W*0.90,H*0.56); g.lineTo(W,H*0.64); g.lineTo(W,H); g.closePath(); g.fillPath();
    // shaded right flank — inner edge follows the fall-line as a SLOPE back to the
    // peak (was a hard vertical line straight down from the summit).
    g.fillStyle(0x6F5F4E,0.5);
    g.beginPath(); g.moveTo(peakX,peakY); g.lineTo(W*0.90,H*0.56); g.lineTo(W,H*0.64); g.lineTo(W,H); g.lineTo(peakX+W*0.12,H); g.closePath(); g.fillPath();
    // snow cap
    g.fillStyle(0xF4F8FC,1);
    g.beginPath(); g.moveTo(peakX,peakY);
    g.lineTo(W*0.40,H*0.27); g.lineTo(W*0.455,H*0.24); g.lineTo(W*0.50,H*0.285);
    g.lineTo(W*0.55,H*0.235); g.lineTo(W*0.60,H*0.28); g.lineTo(W*0.655,H*0.27);
    g.closePath(); g.fillPath();
    // green lower slopes fading to warm base
    g.fillStyle(0x6FA85B,0.92);
    g.beginPath(); g.moveTo(0,H); g.lineTo(W*0.20,H*0.74); g.lineTo(W*0.5,H*0.84); g.lineTo(W*0.8,H*0.73); g.lineTo(W,H); g.closePath(); g.fillPath();
    g.generateTexture(key,W,H); g.destroy();
    return key;
  },

  // Winding trail through the node centres (bottom -> top), baked into one Image.
  // pts: [{x,y}...] in logical coords. Catmull-Rom smoothed rope + footpath dots.
  mapTrail(scene,key,pts){
    if(this.has(scene,key)) return key;
    if(!pts||pts.length<2) return null;
    // smooth polyline through pts
    const path=[]; const at=i=>pts[Math.max(0,Math.min(pts.length-1,i))];
    for(let i=0;i<pts.length-1;i++){
      const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
      for(let t=0;t<1;t+=0.045){ const tt=t*t,ttt=tt*t;
        path.push({
          x:0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*tt+(-p0.x+3*p1.x-3*p2.x+p3.x)*ttt),
          y:0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*tt+(-p0.y+3*p1.y-3*p2.y+p3.y)*ttt)});
      }
    }
    path.push(pts[pts.length-1]);
    const g=scene.make.graphics({add:false});
    const blob=(col,alpha,r,dy)=>{ g.fillStyle(col,alpha); for(const p of path) g.fillCircle(p.x,p.y+(dy||0),r); };
    blob(0x000000,0.12,15,4);      // soft shadow
    blob(0x9C7B4C,1,14,0);         // trail edge (darker)
    blob(0xE7CF9E,1,11,0);         // trail body (tan)
    blob(0xF6EBC9,0.9,6,0);        // inner highlight
    // (footpath dots removed — they cut through the node labels)
    g.generateTexture(key,W,H); g.destroy();
    return key;
  },

  // A node medallion = a CIRCULAR CROP of the world's own background inside a
  // chunky accent ring with a gloss highlight — reads instantly as "that world".
  // Locked worlds get the same portrait desaturated + a slate ring. Baked once
  // per (world, locked) via canvas (like bakeNine). Falls back to a flat accent
  // disc if the world background hasn't loaded.
  mapNode(scene,key,worldKey,accent,locked){
    if(this.has(scene,key)) return key;
    const D=140, R=D/2, ring=9;
    const cv=document.createElement('canvas'); cv.width=D; cv.height=D;
    const ctx=cv.getContext('2d');
    const hex=n=>'#'+(n>>>0).toString(16).padStart(6,'0').slice(-6);
    ctx.save();
    ctx.beginPath(); ctx.arc(R,R,R-ring/2,0,Math.PI*2); ctx.clip();
    const src='bg_'+worldKey;
    if(scene.textures.exists(src)){
      const img=scene.textures.get(src).getSourceImage();
      // centre-weighted square crop from the scenic upper third of the painting
      const s=Math.min(img.width,img.height);
      const sx=(img.width-s)/2, sy=Math.min(img.height-s, img.height*0.16);
      ctx.drawImage(img, sx,sy,s,s, ring/2,ring/2, D-ring, D-ring);
    } else {
      ctx.fillStyle=hex(accent); ctx.fillRect(0,0,D,D);
    }
    if(locked){
      ctx.globalCompositeOperation='saturation'; ctx.fillStyle='hsl(0,0%,50%)'; ctx.fillRect(0,0,D,D);
      ctx.globalCompositeOperation='source-over'; ctx.fillStyle='rgba(44,54,68,0.42)'; ctx.fillRect(0,0,D,D);
    }
    // top gloss
    const grd=ctx.createLinearGradient(0,0,0,D);
    grd.addColorStop(0,'rgba(255,255,255,0.38)'); grd.addColorStop(0.42,'rgba(255,255,255,0)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,D,D);
    ctx.restore();
    // accent ring + inner shade line for depth
    ctx.lineWidth=ring; ctx.strokeStyle=locked?'#5A6570':hex(accent);
    ctx.beginPath(); ctx.arc(R,R,R-ring/2,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=2.5; ctx.strokeStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.arc(R,R,R-ring-1,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=2.5; ctx.strokeStyle=locked?'rgba(255,255,255,0.25)':hex(tint(accent,0.5));
    ctx.beginPath(); ctx.arc(R,R,R-ring+3,0,Math.PI*2); ctx.stroke();
    scene.textures.addCanvas(key, cv);
    return key;
  },

  // Translucent rounded plate placed behind a node's label so it reads on any
  // backdrop (white snow, trail rope, painted art). Baked once, stretched per label.
  mapPlate(scene){
    const key='map_plate';
    if(this.has(scene,key)) return key;
    const W0=220,H0=52,R=15;
    const g=scene.make.graphics({add:false});
    g.fillStyle(0x14212E,0.52); g.fillRoundedRect(0,0,W0,H0,R);
    g.generateTexture(key,W0,H0); g.destroy();
    return key;
  },

  // Soft ring for the pulsing "you are here" node.
  mapPulse(scene){
    const key='map_pulse';
    if(this.has(scene,key)) return key;
    const D=160, R=D/2;
    const g=scene.make.graphics({add:false});
    g.lineStyle(10,0xFFFFFF,1); g.strokeCircle(R,R,R-12);
    g.generateTexture(key,D,D); g.destroy();
    return key;
  },
};
})();

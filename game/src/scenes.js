/* Wordslide — Home + Select scenes, plus shared UI helpers (WS.ui). Reads window.WS. */
(function(){
"use strict";
const WS=window.WS;
const {W,H,MARGIN,C,HEX}=WS;

function skyBG(scene, topHex, botHex, opts){
  opts=opts||{};
  scene.add.image(0,0,WS.Art.skyTex(scene,"sky_"+topHex.toString(16)+"_"+botHex.toString(16),topHex,botHex)).setOrigin(0);
  if(opts.sun){
    const s=scene.add.graphics(); s.fillStyle(0xFFE9A8,0.9); s.fillCircle(W-90,110,46);
    s.fillStyle(0xFFF4CE,0.5); s.fillCircle(W-90,110,62);
  }
  if(opts.clouds){
    for(let i=0;i<3;i++){
      const cg=scene.add.graphics(); cg.fillStyle(0xffffff,0.65);
      const cy=70+i*52, cx=60+i*140;
      cg.fillCircle(cx,cy,16); cg.fillCircle(cx+18,cy-6,13); cg.fillCircle(cx+34,cy,15); cg.fillRect(cx-14,cy,62,14);
      scene.tweens.add({targets:cg,x:40,duration:9000+i*2600,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
    }
  }
  const m1=scene.add.graphics(); m1.fillStyle(opts.mtnA||0xC75B33,0.18);
  m1.beginPath(); m1.moveTo(0,H); m1.lineTo(0,H*0.70); m1.lineTo(W*0.2,H*0.54); m1.lineTo(W*0.4,H*0.66);
  m1.lineTo(W*0.56,H*0.46); m1.lineTo(W*0.74,H*0.64); m1.lineTo(W*0.9,H*0.5); m1.lineTo(W,H*0.64); m1.lineTo(W,H); m1.closePath(); m1.fillPath();
  const m2=scene.add.graphics(); m2.fillStyle(opts.mtnB||0x56C06A,0.2);
  m2.beginPath(); m2.moveTo(0,H); m2.lineTo(0,H*0.82); m2.lineTo(W*0.24,H*0.7); m2.lineTo(W*0.46,H*0.84);
  m2.lineTo(W*0.64,H*0.66); m2.lineTo(W*0.82,H*0.82); m2.lineTo(W,H*0.7); m2.lineTo(W,H); m2.closePath(); m2.fillPath();
}

function button(scene,x,y,w,h,label,fill,shadow,cb,fontSize,icon){
  // Shipped art path: a 9-sliced button skin (assets/ui/btn_*.png) replaces the
  // procedural bevel. Falls back to Graphics when the skin isn't shipped.
  const skin = WS.Assets.btnSkin(fill);
  let g=null, ns=null;
  if(skin && scene.textures.exists(skin)){
    ns = WS.Assets.nine(scene, skin, x, y, w, h+4, 0, 0,
                        WS.Assets.btnNeedsTint(skin) ? fill : null);
  } else {
    g=scene.add.graphics();
    g.fillStyle(0x000000,0.18); g.fillRoundedRect(x+2,y+6,w,h,16);
    g.fillStyle(shadow,1); g.fillRoundedRect(x,y+4,w,h,16);
    g.fillStyle(fill,1); g.fillRoundedRect(x,y,w,h,16);
    g.fillStyle(0xffffff,0.28); g.fillRoundedRect(x+4,y+3,w-8,Math.min(14,h*0.3),8);
    g.lineStyle(3,shadow,0.9); g.strokeRoundedRect(x+1.5,y+1.5,w-3,h+1,15);
  }
  const t=WS.shadow(scene.add.text(x+w/2,y+h/2,label,WS.T(fontSize||20,"#ffffff",{strokeColor:WS.HEX(shadow),strokeWidth:4})).setOrigin(0.5),2);
  let ico=null, iy=y+h/2;
  if(icon&&scene.textures.exists(icon)){
    const isz=Math.min(30,h*0.55);
    t.setX(x+w/2+isz/2+4);
    ico=scene.add.image(t.x-t.width/2-isz/2-8,iy,icon).setDisplaySize(isz,isz);
  }
  const z=scene.add.zone(x,y,w,h).setOrigin(0).setInteractive();
  const press=(down)=>{
    t.setY(y+h/2+(down?3:0));
    if(ns) ns.setY(y+(down?3:0));
    if(ico) ico.setY(iy+(down?3:0));
  };
  z.on("pointerdown",()=>press(true));
  z.on("pointerup",()=>{ press(false); WS.Audio.sfx(520,0.06,"sine",0.04); cb(); });
  z.on("pointerout",()=>press(false));
  return {g,t,z,ns};
}

function backButton(scene, target){
  const bx=W-MARGIN-72,by=24,bw=72,bh=30;
  const bg=scene.add.graphics(); bg.fillStyle(0xffffff,0.9); bg.fillRoundedRect(bx,by,bw,bh,9);
  scene.add.text(bx+bw/2,by+bh/2,"‹ Back",{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0.5);
  const bz=scene.add.zone(bx,by,bw,bh).setOrigin(0).setInteractive();
  bz.on("pointerup",()=>scene.scene.start(target||"home"));
}

WS.ui = {skyBG, button, backButton};

WS.HomeScene = class extends Phaser.Scene {
  constructor(){ super("home"); }
  create(){
    WS.Art.common(this);
    const bg=this.textures.exists("bg_home")?"bg_home":WS.Art.homeScene(this);
    this.add.image(0,0,bg).setOrigin(0).setDisplaySize(W,H);
    for(let i=0;i<3;i++){
      const c=this.add.image(60+i*150,64+i*52,"cloud").setAlpha(0.8).setScale(0.8+i*0.3);
      this.tweens.add({targets:c,x:c.x+50,duration:9000+i*2600,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
    }
    WS.Art.dressScene(this,"home",{depth:2,bushDepth:6});
    // title
    WS.shadow(this.add.text(W/2,128,"Word",WS.T(58,C.teal,{strokeColor:"#ffffff",strokeWidth:8})).setOrigin(1,0.5).setX(W/2-2).setDepth(3),4);
    WS.shadow(this.add.text(W/2,128,"slide",WS.T(58,C.clay,{strokeColor:"#ffffff",strokeWidth:8})).setOrigin(0,0.5).setX(W/2+2).setDepth(3),4);
    // logo tiles row "SLIDE" with a playful drop-in
    const letters=["S","L","I","D","E"], tw=58, gap=8, tot=letters.length*tw+(letters.length-1)*gap, sx=(W-tot)/2, ty=196;
    letters.forEach((ch,i)=>{ const x=sx+i*(tw+gap);
      const cont=this.add.container(0,-90);
      const g=this.add.graphics(); g.fillStyle(0xD9B98A,1); g.fillRoundedRect(x,ty+4,tw,tw,10);
      g.fillStyle(i===4?0xC75B33:0xFFF1CE,1); g.fillRoundedRect(x,ty,tw,tw,10);
      const t=this.add.text(x+tw/2,ty+tw/2,ch,{fontFamily:WS.FONT,fontSize:"34px",fontStyle:"bold",color:i===4?"#ffffff":HEX(0x2B4257)}).setOrigin(0.5);
      cont.add([g,t]);
      this.tweens.add({targets:cont,y:0,duration:420,delay:i*90,ease:"Bounce.easeOut"});
    });
    this.add.text(W/2,300,"Spell fast. Before it falls.",{fontFamily:WS.FONT,fontSize:"20px",fontStyle:"italic",color:HEX(C.ink)}).setOrigin(0.5).setAlpha(0.8);

    // player level + XP bar
    const info=WS.levelInfo(WS.store.get("xp",0));
    const lw=280, lx=W/2-lw/2, ly=352;
    const lg=this.add.graphics(); lg.fillStyle(0xffffff,0.92); lg.fillRoundedRect(lx-14,ly-14,lw+28,54,14);
    this.add.text(lx,ly-6,"LEVEL "+info.level,{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(C.clayD)});
    this.add.text(lx+lw,ly-6,info.into+" / "+info.need+" XP",{fontFamily:WS.FONT,fontSize:"11px",color:HEX(C.mute)}).setOrigin(1,0);
    const xg=this.add.graphics(); xg.fillStyle(0xE9EEF2,1); xg.fillRoundedRect(lx,ly+14,lw,10,5);
    xg.fillStyle(C.teal,1); xg.fillRoundedRect(lx,ly+14,Math.max(8,lw*info.into/info.need),10,5);

    // buttons
    const bw2=W-2*46;
    button(this,46,442,bw2,64,"Play",C.clay,C.clayD,()=>this.scene.start("select"),26,"ic_play");
    const half=(bw2-12)/2;
    const streak=WS.store.daily().streak;
    button(this,46,522,half,56,"Daily"+(streak?(" "+streak):""),C.teal,C.tealD,()=>this.scene.start("daily"),17,"ic_cal");
    button(this,46+half+12,522,half,56,"Duel",0x8E6FC1,0x6B4F99,()=>this.scene.start("duel"),17,"ic_duel");
    button(this,46,594,half,50,"Stats",0x6F8FA8,0x4C6577,()=>this.scene.start("stats"),15,"ic_chart");
    button(this,46+half+12,594,half,50,"Settings",0x9C6B3F,0x6F4A28,()=>this.scene.start("settings"),15,"ic_gear");

    // coin pill -> shop. A pulse when the daily chest is unopened: the free
    // reward is the reason to come back, so it should be the thing that glows,
    // not the thing you have to go looking for.
    const chest=WS.Econ.chestAvailable();
    const pg=this.add.graphics().setDepth(4);
    pg.fillStyle(0x000000,0.18); pg.fillRoundedRect(W-134,WS.SAFE.top+16,120,38,19);
    pg.fillStyle(0xFFFFFF,0.95);  pg.fillRoundedRect(W-136,WS.SAFE.top+14,120,38,19);
    const pill=this.add.text(W-76,WS.SAFE.top+33,(chest?"🎁 ":"🪙 ")+WS.Econ.balance(),
      {fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:HEX(chest?C.clay:C.ink)}).setOrigin(0.5).setDepth(5);
    const pz=this.add.zone(W-136,WS.SAFE.top+14,120,38).setOrigin(0).setInteractive().setDepth(5);
    pz.on("pointerup",()=>this.scene.start("shop"));
    if(chest) this.tweens.add({targets:pill,scale:1.12,duration:620,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});

    // best line + goals teaser
    const tb=WS.store.totalBest(), bwd=WS.store.bestWord();
    this.add.text(W/2,678,"Best score: "+tb+(bwd.w?("   ·   Best word: "+bwd.w+" ("+bwd.p+")"):""),{fontFamily:WS.FONT,fontSize:"12px",fontStyle:"bold",color:"#ffffff"}).setOrigin(0.5).setAlpha(0.95);
    const g=WS.goals.today(); const doneN=g.done.filter(Boolean).length;
    this.add.text(W/2,700,"Today's goals: "+doneN+"/3 done  (see Stats)",{fontFamily:WS.FONT,fontSize:"12px",color:"#ffffff"}).setOrigin(0.5).setAlpha(0.85);
    this.add.text(W/2,H-24,"v"+WS.VERSION,{fontFamily:WS.FONT,fontSize:"11px",color:"#ffffff"}).setOrigin(0.5).setAlpha(0.6);

    WS.Audio.startMusic("home");
    this.events.once("shutdown",()=>WS.Audio.stopMusic());
  }
};

WS.SelectScene = class extends Phaser.Scene {
  constructor(){ super("select"); }
  create(){
    // Mountain backdrop — the thing you climb. Baked once (art.js), one Image.
    this.add.image(0,0,WS.Art.mapBackdrop(this)).setOrigin(0).setDisplaySize(W,H).setDepth(0);

    this.testOn = WS.store.get("unlockAll",false);
    this.startLevel = WS.store.get("testLevel",1);
    const BAR = 56;

    // --- node layout: a serpentine climb, world 1 at the base, 7 at the summit ---
    const order=WS.WORLD_ORDER, n=order.length;
    const topY=140, botY=H-BAR-64, cx=W/2, amp=96;
    const stepY=(botY-topY)/(n-1);
    const off=i=>(i%2===0?-1:1)*(0.5+0.2*Math.sin(i*1.3));
    const pos=order.map((k,i)=>({x:cx+amp*off(i), y:botY-i*stepY}));

    // current world = highest unlocked; it pulses ("you are here")
    let cur=0; order.forEach((k,i)=>{ if(WS.isUnlocked(k)) cur=i; });

    // winding trail behind the nodes (baked)
    const trail=WS.Art.mapTrail(this,"map_trail",pos);
    if(trail) this.add.image(0,0,trail).setOrigin(0).setDepth(1);

    const ND=68;                                   // node display diameter
    order.forEach((key,i)=>{
      const cfg=WS.WORLDS[key], p=pos[i], unlocked=WS.isUnlocked(key);
      const nodeKey = unlocked ? ("node_"+cfg.accent.toString(16)) : "node_lock";
      WS.Art.mapNode(this,nodeKey,cfg.accent,!unlocked);

      // pulsing halo on the current node
      if(i===cur){
        const ring=this.add.image(p.x,p.y,WS.Art.mapPulse(this)).setDepth(2).setScale(ND/160).setAlpha(0.7);
        this.tweens.add({targets:ring,scale:ND/160*1.5,alpha:0,duration:1300,repeat:-1,ease:"Sine.easeOut"});
      }

      const node=this.add.image(p.x,p.y,nodeKey).setOrigin(0.5,0.48).setDepth(3).setScale(ND/140);
      if(i===cur) this.tweens.add({targets:node,scale:ND/140*1.06,duration:760,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});

      // node face: world number (unlocked) or lock (locked)
      if(unlocked){
        WS.shadow(this.add.text(p.x,p.y,""+cfg.order,WS.T(24,"#FFF6E4",{strokeColor:WS.HEX(cfg.accentD),strokeWidth:4})).setOrigin(0.5).setDepth(4),2);
      } else if(this.textures.exists("ic_lock")){
        this.add.image(p.x,p.y,"ic_lock").setDisplaySize(28,28).setDepth(4);
      } else {
        this.add.text(p.x,p.y,"🔒",{fontFamily:WS.FONT,fontSize:"22px"}).setOrigin(0.5).setDepth(4);
      }

      // labels under the node (outlined text reads on the mountain — no plates)
      const ly=p.y+ND/2+8;
      WS.shadow(this.add.text(p.x,ly,cfg.name,WS.T(17,unlocked?"#FFFFFF":"#E6ECF2",{strokeColor:"#2A3A22",strokeWidth:4})).setOrigin(0.5,0).setDepth(4).setAlpha(unlocked?1:0.9),2);
      let sub;
      if(!unlocked){
        const prev=WS.WORLDS[order[i-1]];
        sub="🔒 Reach "+cfg.unlock+" in "+prev.name;
      } else if(this.testOn){
        sub="Start · Lv "+this.startLevel+" ›";
      } else {
        const best=WS.store.best(key), bl=WS.store.bestLevel(key);
        sub = best>0 ? ("Best "+best+(bl>0?("  ·  Lv "+bl):"")) : "Play ›";
      }
      WS.shadow(this.add.text(p.x,ly+21,sub,WS.T(12,"#FFFFFF",{weight:"700",strokeColor:"#2A3A22",strokeWidth:3})).setOrigin(0.5,0).setDepth(4).setAlpha(0.96),1);

      // tap an unlocked node to play
      if(unlocked){
        const z=this.add.zone(p.x-ND/2,p.y-ND/2,ND,ND).setOrigin(0).setInteractive().setDepth(5);
        z.on("pointerdown",()=>this.tweens.add({targets:node,scale:ND/140*0.92,duration:80,yoyo:true}));
        z.on("pointerup",()=>{
          WS.Audio.sfx(560,0.06,"sine",0.05);
          this.scene.start("game",{world:key,mode:"classic",startLevel:this.testOn?this.startLevel:1});
        });
      }
    });

    // header — outlined text reads on the sky; no scrim (would cover Back)
    WS.shadow(this.add.text(MARGIN,20,"Climb the slide",WS.T(26,"#FFF3DC",{strokeColor:"#3A5A2A",strokeWidth:5})).setDepth(10),2);
    this.add.text(MARGIN,62,"Beat a world's target score to unlock the next peak.",WS.T(12,"#FFFFFF",{weight:"700",strokeColor:"#2A3A22",strokeWidth:3})).setAlpha(0.98).setDepth(10);
    backButton(this,"home");

    this.buildTestBar(H-BAR+2, BAR-10);
  }

  /* Test bar — tap to unlock every world, then step the starting level.
     Persisted, so it survives a restart. Level ramps the slide speed and the
     loss allowance too, so trialling level 7 actually feels like level 7. */
  buildTestBar(y,h){
    const g=this.add.graphics();
    const paint=()=>{
      g.clear();
      g.fillStyle(this.testOn?0x0FB8B0:0x233A4F, this.testOn?0.95:0.62);
      g.fillRoundedRect(MARGIN,y,W-2*MARGIN,h,12);
    };
    paint();

    if(!this.testOn){
      const t=this.add.text(W/2,y+h/2,"TEST MODE  —  tap to unlock every world & level",
        {fontFamily:WS.FONT,fontSize:"12px",fontStyle:"bold",color:"#ffffff"}).setOrigin(0.5).setAlpha(0.95);
      const z=this.add.zone(MARGIN,y,W-2*MARGIN,h).setOrigin(0).setInteractive();
      z.on("pointerup",()=>{ WS.store.set("unlockAll",true); WS.Audio.sfx(700,0.06,"sine",0.05); this.scene.restart(); });
      return {g,t};
    }

    this.add.text(MARGIN+12,y+h/2,"TEST",{fontFamily:WS.FONT,fontSize:"12px",fontStyle:"800",color:"#ffffff"}).setOrigin(0,0.5);
    const lvlTxt=this.add.text(W/2+16,y+h/2,"Level "+this.startLevel,
      {fontFamily:WS.FONT,fontSize:"15px",fontStyle:"bold",color:"#ffffff"}).setOrigin(0.5);
    const step=(d)=>{
      this.startLevel=Phaser.Math.Clamp(this.startLevel+d,1,30);
      WS.store.set("testLevel",this.startLevel);
      lvlTxt.setText("Level "+this.startLevel);
      WS.Audio.sfx(560,0.05,"sine",0.04);
      this.scene.restart();               // refresh the "Lv N ›" hint on every card
    };
    const arrow=(x,ch2,d)=>{
      const t=this.add.text(x,y+h/2,ch2,{fontFamily:WS.FONT,fontSize:"26px",fontStyle:"bold",color:"#ffffff"}).setOrigin(0.5);
      const z=this.add.zone(x-20,y,40,h).setOrigin(0,0).setInteractive();
      z.on("pointerup",()=>step(d));
    };
    arrow(W/2-42,"‹",-1); arrow(W/2+74,"›",1);
    // off switch
    const off=this.add.text(W-MARGIN-14,y+h/2,"OFF",{fontFamily:WS.FONT,fontSize:"11px",fontStyle:"800",color:"#ffffff"}).setOrigin(1,0.5).setAlpha(0.9);
    const oz=this.add.zone(W-MARGIN-52,y,52,h).setOrigin(0).setInteractive();
    oz.on("pointerup",()=>{ WS.store.set("unlockAll",false); WS.Audio.sfx(320,0.06,"sine",0.05); this.scene.restart(); });
    return {g,lvlTxt,off};
  }
};
})();

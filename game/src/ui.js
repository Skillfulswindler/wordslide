/* Wordslide — secondary scenes: Settings, Stats, Daily, Duel setup / handoff / results.
   Reads window.WS and WS.ui (scenes.js). */
(function(){
"use strict";
const WS=window.WS;
const {W,H,MARGIN,C,HEX}=WS;
const {skyBG,button,backButton,iconText}=WS.ui;

// shared: SVG-art background + foliage for menu scenes
function menuBG(scene,worldKey){
  const k=worldKey&&scene.textures.exists("bg_"+worldKey)?"bg_"+worldKey:(scene.textures.exists("bg_home")?"bg_home":null);
  if(k) scene.add.image(0,0,k).setOrigin(0).setDisplaySize(W,H);
  else skyBG(scene,0xCDEEF7,0xFFF7E8);
  WS.Art.dressScene(scene,worldKey||"home",{depth:0,bushDepth:0});
}

// ---------- Pause ----------
WS.PauseScene = class extends Phaser.Scene {
  constructor(){ super("pause"); }
  init(d){ this.d=d||{}; }
  create(){
    const sh=this.add.graphics(); sh.fillStyle(0x0d1426,0.66); sh.fillRect(0,0,W,H);
    const cw=W-100,chh=330,cx=50,cy=H/2-chh/2;
    WS.Art.woodFrame(this,"card_pause",cw,chh,20);
    this.add.image(cx,cy,"card_pause").setOrigin(0);
    WS.shadow(this.add.text(W/2,cy+52,"Paused",WS.T(30,"#5E3A20",{strokeColor:"#FFF3DC",strokeWidth:5})).setOrigin(0.5),2);
    const resume=()=>{ this.scene.stop(); this.scene.resume("game");
      WS.Audio.startMusic(this.d.world||"home"); };
    button(this,cx+40,cy+100,cw-80,54,"Resume",C.teal,C.tealD,resume,20);
    if(this.d.mode==="classic")
      button(this,cx+40,cy+168,cw-80,50,"Restart run",0x6F8FA8,0x4C6577,()=>{
        const g=this.scene.get("game"); this.scene.stop();
        g.scene.restart({world:this.d.world,mode:"classic"});
      },17);
    button(this,cx+40,cy+232,cw-80,50,"Quit to menu",C.clay,C.clayD,()=>{
      const g=this.scene.get("game"); this.scene.stop();
      g.shutdownTimers&&g.shutdownTimers();
      g.scene.stop(); this.scene.start(this.d.mode==="classic"?"select":"home");
    },17);
  }
};

// ---------- Settings ----------
WS.SettingsScene = class extends Phaser.Scene {
  constructor(){ super("settings"); }
  create(){
    menuBG(this);
    this.add.text(MARGIN,24,"Settings",{fontFamily:WS.FONT,fontSize:"26px",fontStyle:"bold",color:HEX(C.ink)});
    backButton(this,"home");

    const rows=[
      {k:"music",     label:"Music"},
      {k:"sfx",       label:"Sound effects"},
      {k:"haptics",   label:"Vibration"},
      {k:"colorblind",label:"Colorblind-friendly tiles"},
    ];
    let y=110;
    rows.forEach(r=>{ this.toggleRow(y, r.label, ()=>WS.store.settings()[r.k], v=>{
        WS.store.setSetting(r.k,v);
        if(r.k==="music"&&!v) WS.Audio.stopMusic();
        if(r.k==="music"&&v) WS.Audio.startMusic("home");
      }); y+=66; });

    // Analytics opt-out. "Off" must mean genuinely OFF — not collected-but-hidden.
    this.toggleRow(y,"Share anonymous play data",
      ()=>!WS.store.get("analyticsOptOut",false),
      v=>WS.Analytics.setOptOut(!v)); y+=66;

    // unlock-all (testing) toggle
    this.toggleRow(y,"Unlock all worlds (testing)",()=>WS.store.get("unlockAll",false),v=>WS.store.set("unlockAll",v)); y+=72;

    // ---- purchases -------------------------------------------------------
    // Apple REQUIRES a visible Restore control for non-consumables. An app
    // without one is rejected, and a player who reinstalls and loses what they
    // paid for is a refund and a one-star review.
    if (WS.Entitle.isPremium()){
      const g=this.add.graphics(); g.fillStyle(0xffffff,0.94); g.fillRoundedRect(MARGIN,y,W-2*MARGIN,54,14);
      this.add.text(MARGIN+18,y+27,"Ads removed",{fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0,0.5);
      this.add.text(W-MARGIN-18,y+27,"OWNED ✓",{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(C.teal)}).setOrigin(1,0.5);
      y+=66;
    } else {
      button(this,MARGIN,y,W-2*MARGIN,50,"Remove ads — "+WS.IAP.priceOf(WS.MONETIZE.revenuecat.products.removeAds,"$4.99"),
        C.gold,0xD9A32E,async()=>{
          const r=await WS.IAP.buyRemoveAds();
          if(r.ok) this.scene.restart();
          else if(r.reason==="unavailable") this.toast("Purchases aren't available in this build.");
          else if(r.reason!=="cancelled")   this.toast("Purchase failed. You were not charged.");
        },16);
      y+=62;
    }
    const rst=button(this,MARGIN,y,W-2*MARGIN,44,"Restore purchases",0x6F8FA8,0x4C6577,async()=>{
      rst.t.setText("Restoring…");
      const r=await WS.IAP.restore();
      rst.t.setText("Restore purchases");
      if(r.ok && r.restored){ this.toast("Restored — ads removed."); this.scene.restart(); }
      else if(r.ok)         this.toast("Nothing to restore on this account.");
      else                  this.toast("Restore unavailable in this build.");
    },14);
    y+=60;

    // ---- legal + diagnostics --------------------------------------------
    const half=(W-2*MARGIN-10)/2;
    button(this,MARGIN,y,half,42,"Privacy policy",0x6F8FA8,0x4C6577,
      ()=>WS.openURL(WS.PRIVACY_URL),13);
    button(this,MARGIN+half+10,y,half,42,"Diagnostics",0x6F8FA8,0x4C6577,
      ()=>this.scene.start("diag"),13);
    y+=58;

    // reset progress (two-tap confirm)
    let armed=false;
    const rb=button(this,MARGIN,y,W-2*MARGIN,46,"Reset all progress",0xE24B4A,0xB03230,()=>{
      if(!armed){ armed=true; rb.t.setText("Tap again to confirm reset"); this.time.delayedCall(2500,()=>{ armed=false; rb.t.setText("Reset all progress"); }); }
      else { WS.store.reset(); this.scene.start("home"); }
    },15);

    this.add.text(W/2,H-24,"Wordslide v"+WS.VERSION+" — spell fast, before it falls",{fontFamily:WS.FONT,fontSize:"11px",color:HEX(C.mute)}).setOrigin(0.5);
  }
  toast(msg){
    const t=this.add.text(W/2,H-70,msg,{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:"#ffffff",backgroundColor:"#233A4F",padding:{x:14,y:8}}).setOrigin(0.5).setDepth(500);
    this.tweens.add({targets:t,alpha:0,delay:1600,duration:400,onComplete:()=>t.destroy()});
  }
  toggleRow(y,label,getV,setV){
    const g=this.add.graphics(); g.fillStyle(0xffffff,0.94); g.fillRoundedRect(MARGIN,y,W-2*MARGIN,54,14);
    this.add.text(MARGIN+18,y+27,label,{fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0,0.5);
    const tg=this.add.graphics(); const tx=W-MARGIN-70, tw=52, th=28;
    const paint=()=>{ const on=getV(); tg.clear();
      tg.fillStyle(on?C.teal:0xC3CCD4,1); tg.fillRoundedRect(tx,y+13,tw,th,14);
      tg.fillStyle(0xffffff,1); tg.fillCircle(on?tx+tw-14:tx+14,y+27,11); };
    paint();
    const z=this.add.zone(tx-8,y+5,tw+16,44).setOrigin(0).setInteractive();
    z.on("pointerup",()=>{ setV(!getV()); paint(); WS.Audio.sfx(600,0.05,"sine",0.04); });
  }
};

// ---------- Stats ----------
WS.StatsScene = class extends Phaser.Scene {
  constructor(){ super("stats"); }
  create(){
    menuBG(this);
    WS.shadow(this.add.text(MARGIN,20,"Stats & Goals",WS.T(26,"#FFF3DC",{strokeColor:"#3A5A2A",strokeWidth:5})),2);
    backButton(this,"home");
    let y=78;
    const card=(h)=>{ const g=this.add.graphics(); g.fillStyle(0xffffff,0.95); g.fillRoundedRect(MARGIN,y,W-2*MARGIN,h,14);
      g.lineStyle(2,0xEADFCA,1); g.strokeRoundedRect(MARGIN,y,W-2*MARGIN,h,14); };
    const title=(t)=>this.add.text(MARGIN+16,y+8,t,{fontFamily:WS.FONT,fontSize:"11px",fontStyle:"800",color:HEX(C.mute)});
    const HALF=(W-2*MARGIN)/2;
    const cell=(col,row,l,v,accent)=>{
      const x=MARGIN+16+col*HALF, yy=y+26+row*20;
      this.add.text(x,yy,l,{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)});
      this.add.text(x+HALF-36,yy,""+v,{fontFamily:WS.FONT,fontSize:"12px",fontStyle:"bold",color:HEX(accent||C.ink)}).setOrigin(1,0);
    };

    // level + XP
    const info=WS.levelInfo(WS.store.get("xp",0));
    card(62);
    this.add.text(MARGIN+16,y+10,"LEVEL "+info.level,{fontFamily:WS.FONT,fontSize:"17px",fontStyle:"800",color:HEX(C.clayD)});
    this.add.text(W-MARGIN-16,y+14,info.into+" / "+info.need+" XP",{fontFamily:WS.FONT,fontSize:"11px",color:HEX(C.mute)}).setOrigin(1,0);
    const bx=MARGIN+16,bw=W-2*MARGIN-32;
    const xg=this.add.graphics(); xg.fillStyle(0xE9EEF2,1); xg.fillRoundedRect(bx,y+40,bw,11,5);
    xg.fillStyle(C.teal,1); xg.fillRoundedRect(bx,y+40,Math.max(8,bw*info.into/info.need),11,5);
    y+=74;

    // today's goals
    const g=WS.goals.today();
    card(24+g.list.length*20+8); title("TODAY'S GOALS  (+"+WS.GOAL_XP+" XP each)");
    g.list.forEach((goal,i)=>{
      const yy=y+26+i*20, done=g.done[i];
      this.add.text(MARGIN+16,yy,(done?"✓ ":"· ")+goal.txt,{fontFamily:WS.FONT,fontSize:"12px",fontStyle:done?"bold":"normal",color:HEX(done?C.teal:C.ink)});
      this.add.text(W-MARGIN-16,yy,Math.min(g.prog[i],goal.target)+"/"+goal.target,{fontFamily:WS.FONT,fontSize:"11px",color:HEX(C.mute)}).setOrigin(1,0);
    });
    y+=24+g.list.length*20+20;

    // lifetime (2-col)
    const st=WS.store.stats(), bwd=WS.store.bestWord(), d=WS.store.daily(), duel=WS.store.duel();
    card(24+3*20+10); title("LIFETIME");
    cell(0,0,"Runs",st.games); cell(1,0,"Words",st.words);
    cell(0,1,"Letters",st.tiles); cell(1,1,"Top combo",st.topCombo?("×"+st.topCombo):"—");
    cell(0,2,"Best word",bwd.w||"—",C.teal); cell(1,2,"Longest",st.longest||"—");
    y+=24+3*20+22;

    // world bests (2-col) + daily/duel
    card(24+4*20+10+44); title("BEST SCORES");
    WS.WORLD_ORDER.forEach((k,i)=>cell(i%2,Math.floor(i/2),WS.WORLDS[k].name,WS.store.best(k)||"—"));
    cell(1,3,"Daily streak",d.streak+" (best "+d.bestStreak+")",C.clayD);
    const dy=y+26+4*20+6;
    this.add.text(MARGIN+16,dy,"Duel wins",{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)});
    this.add.text(W-MARGIN-16,dy,"P1 "+duel.p1+" · P2 "+duel.p2+" · ties "+duel.ties,{fontFamily:WS.FONT,fontSize:"12px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(1,0);
    y+=24+4*20+10+44+12;

    // achievements (2-col, names only)
    const earned=WS.store.get("ach",{}); const n=Object.keys(earned).length;
    const rows=Math.ceil(WS.ACH.length/2);
    card(24+rows*20+10); title("ACHIEVEMENTS  "+n+" / "+WS.ACH.length);
    WS.ACH.forEach((a,i)=>{
      const got=!!earned[a.id];
      const x=MARGIN+16+(i%2)*HALF, yy=y+26+Math.floor(i/2)*20;
      if(got && this.textures.exists("ic_trophy")) this.add.image(x+6,yy+8,"ic_trophy").setDisplaySize(14,14).setOrigin(0.5);
      this.add.text(x+(got?15:0),yy,(got?"":"· ")+a.name,{fontFamily:WS.FONT,fontSize:"12px",fontStyle:got?"bold":"normal",color:HEX(got?C.teal:C.mute)});
    });
  }
};

// ---------- Daily challenge intro ----------
WS.DailyScene = class extends Phaser.Scene {
  constructor(){ super("daily"); }
  create(){
    const date=WS.todayKey();
    const seed=WS.hashStr("wordslide-daily:"+date);
    const world=WS.WORLD_ORDER[seed%WS.WORLD_ORDER.length];
    const cfg=WS.WORLDS[world];
    menuBG(this,world);
    backButton(this,"home");
    this.add.text(W/2,120,"Daily Challenge",{fontFamily:WS.FONT,fontSize:"34px",fontStyle:"bold",color:HEX(cfg.accentD)}).setOrigin(0.5);
    this.add.text(W/2,160,date,{fontFamily:WS.FONT,fontSize:"15px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0.5).setAlpha(0.75);

    const d=WS.store.daily();
    if(this.textures.exists("ic_flame")) this.add.image(W/2,240,"ic_flame").setDisplaySize(72,72);
    else this.add.text(W/2,240,"🔥",{fontSize:"56px"}).setOrigin(0.5);
    this.add.text(W/2,300,d.streak+"-day streak",{fontFamily:WS.FONT,fontSize:"20px",fontStyle:"bold",color:HEX(C.clayD)}).setOrigin(0.5);
    this.add.text(W/2,326,"best "+d.bestStreak,{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)}).setOrigin(0.5);

    const g=this.add.graphics(); g.fillStyle(0xffffff,0.94); g.fillRoundedRect(40,370,W-80,150,16);
    this.add.text(W/2,398,"Today's slide: "+cfg.name,{fontFamily:WS.FONT,fontSize:"17px",fontStyle:"bold",color:HEX(cfg.accentD)}).setOrigin(0.5);
    this.add.text(W/2,436,"Everyone gets the same letters, in the\nsame order. 2 minutes on the board.\nPlaying keeps your streak alive!",{fontFamily:WS.FONT,fontSize:"13px",color:HEX(C.ink),align:"center",lineSpacing:6}).setOrigin(0.5);
    const todayBest=d.best[date]||0;
    if(todayBest) this.add.text(W/2,496,"Your best today: "+todayBest,{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(C.teal)}).setOrigin(0.5);

    button(this,60,560,W-120,60,todayBest?"Play again":"Play today's board",cfg.accent,cfg.accentD,
      ()=>this.scene.start("game",{world:world,mode:"daily",seed:seed}),20);
    if(todayBest) button(this,60,640,W-120,48,"Share result",C.teal,C.tealD,()=>{
      WS.share("Wordslide Daily "+date+" ⛰️ "+todayBest+" pts · 🔥 "+d.streak+"-day streak. Spell fast, before it falls!");
      const t=this.add.text(W/2,720,"Copied! Paste it anywhere.",{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(C.teal)}).setOrigin(0.5);
      this.time.delayedCall(1600,()=>t.destroy());
    },16);
  }
};

// ---------- Duel: setup / handoff / results ----------
WS.DuelScene = class extends Phaser.Scene {
  constructor(){ super("duel"); }
  create(){
    menuBG(this);
    backButton(this,"home");
    this.add.text(W/2,120,"Pass & Play Duel",{fontFamily:WS.FONT,fontSize:"30px",fontStyle:"bold",color:HEX(0x6B4F99)}).setOrigin(0.5);
    this.add.text(W/2,210,"Two players, the same letter stream.\n2 minutes each. Highest score wins.\nPlay, then pass the phone!",{fontFamily:WS.FONT,fontSize:"15px",color:HEX(C.ink),align:"center",lineSpacing:8}).setOrigin(0.5);

    // world picker (unlocked worlds only)
    this.worlds=WS.WORLD_ORDER.filter(k=>WS.isUnlocked(k));
    this.idx=0;
    const g=this.add.graphics(); g.fillStyle(0xffffff,0.94); g.fillRoundedRect(70,320,W-140,90,16);
    this.worldTxt=this.add.text(W/2,352,"",{fontFamily:WS.FONT,fontSize:"22px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0.5);
    this.subTxt=this.add.text(W/2,382,"",{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)}).setOrigin(0.5);
    const arrow=(x,ch,d)=>{ const t=this.add.text(x,365,ch,{fontFamily:WS.FONT,fontSize:"34px",fontStyle:"bold",color:HEX(0x6B4F99)}).setOrigin(0.5).setInteractive();
      t.on("pointerup",()=>{ this.idx=(this.idx+d+this.worlds.length)%this.worlds.length; this.paintWorld(); WS.Audio.sfx(500,0.05,"sine",0.04); }); };
    arrow(96,"‹",-1); arrow(W-96,"›",1);
    this.paintWorld();

    button(this,60,470,W-120,60,"Start — Player 1 first",0x8E6FC1,0x6B4F99,()=>{
      const seed=(Math.random()*0xFFFFFFFF)>>>0;
      this.scene.start("game",{world:this.worlds[this.idx],mode:"duel",seed:seed,duelPlayer:1});
    },19);

    const duel=WS.store.duel();
    this.add.text(W/2,570,"All-time: P1 "+duel.p1+" wins · P2 "+duel.p2+" wins · "+duel.ties+" ties",{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)}).setOrigin(0.5);
  }
  paintWorld(){ const cfg=WS.WORLDS[this.worlds[this.idx]]; this.worldTxt.setText(cfg.name); this.subTxt.setText(cfg.sub); }
};

WS.DuelMidScene = class extends Phaser.Scene {
  constructor(){ super("duelmid"); }
  init(d){ this.data_=d; }
  create(){
    const d=this.data_;
    menuBG(this);
    this.add.text(W/2,200,"Player 1 scored",{fontFamily:WS.FONT,fontSize:"20px",color:HEX(C.ink)}).setOrigin(0.5);
    this.add.text(W/2,270,""+d.p1Score,{fontFamily:WS.FONT,fontSize:"64px",fontStyle:"bold",color:HEX(0x6B4F99)}).setOrigin(0.5);
    this.add.text(W/2,380,"Pass the phone to Player 2!\nSame letters, same 2 minutes.",{fontFamily:WS.FONT,fontSize:"16px",color:HEX(C.ink),align:"center",lineSpacing:8}).setOrigin(0.5);
    button(this,60,470,W-120,60,"Player 2 — Go!",0x8E6FC1,0x6B4F99,
      ()=>this.scene.start("game",{world:d.world,mode:"duel",seed:d.seed,duelPlayer:2,p1Score:d.p1Score}),20);
  }
};

WS.DuelEndScene = class extends Phaser.Scene {
  constructor(){ super("duelend"); }
  init(d){ this.data_=d; }
  create(){
    const d=this.data_;
    menuBG(this);
    const win = d.p1===d.p2 ? 0 : (d.p1>d.p2?1:2);
    WS.store.bumpDuel(win===0?"ties":(win===1?"p1":"p2"));
    if(win!==0 && this.textures.exists("ic_trophy")) this.add.image(W/2,116,"ic_trophy").setDisplaySize(46,46).setOrigin(0.5);
    this.add.text(W/2,160,win===0?"It's a tie!":("Player "+win+" wins!"),{fontFamily:WS.FONT,fontSize:"34px",fontStyle:"bold",color:HEX(0x6B4F99)}).setOrigin(0.5);
    const row=(label,score,y,hl)=>{
      const g=this.add.graphics(); g.fillStyle(0xffffff,hl?1:0.8); g.fillRoundedRect(70,y,W-140,74,16);
      if(hl){ g.lineStyle(3,0x8E6FC1,1); g.strokeRoundedRect(70,y,W-140,74,16); }
      this.add.text(100,y+37,label,{fontFamily:WS.FONT,fontSize:"18px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0,0.5);
      this.add.text(W-100,y+37,""+score,{fontFamily:WS.FONT,fontSize:"30px",fontStyle:"bold",color:HEX(0x6B4F99)}).setOrigin(1,0.5);
    };
    row("Player 1",d.p1,240,win===1); row("Player 2",d.p2,330,win===2);
    button(this,60,470,W-120,60,"Rematch",0x8E6FC1,0x6B4F99,()=>{
      const seed=(Math.random()*0xFFFFFFFF)>>>0;
      this.scene.start("game",{world:d.world,mode:"duel",seed:seed,duelPlayer:1});
    },20);
    button(this,60,550,W-120,52,"Home",C.teal,C.tealD,()=>this.scene.start("home"),17);
  }
};

// ---------- Shop ----------
// One soft currency, honest prices, published odds. The daily chest is the
// variable-reward hook; the coin packs are the only real-money sink besides
// remove-ads. Nothing here is time-pressured or hidden.
WS.ShopScene = class extends Phaser.Scene {
  constructor(){ super("shop"); }
  create(){
    menuBG(this);
    WS.shadow(this.add.text(MARGIN,20,"Shop",WS.T(26,"#FFF3DC",{strokeColor:"#3A5A2A",strokeWidth:5})),2);
    backButton(this,"home");
    this.balTxt=this.add.text(W-MARGIN,28,""+WS.Econ.balance(),{fontFamily:WS.FONT,fontSize:"20px",fontStyle:"bold",color:HEX(C.gold)}).setOrigin(1,0.5);
    if(this.textures.exists("ic_coin")) this.add.image(this.balTxt.x-this.balTxt.width-6,28,"ic_coin").setDisplaySize(20,20).setOrigin(1,0.5);

    let y=76;

    // ---- daily chest (free, variable reward, odds shown) ----
    const chestOpen=WS.Econ.chestAvailable();
    const cg=this.add.graphics(); cg.fillStyle(0xffffff,0.95); cg.fillRoundedRect(MARGIN,y,W-2*MARGIN,96,16);
    iconText(this,MARGIN+16,y+30,"ic_gift",chestOpen?"Daily chest":"Daily chest — come back tomorrow",
      {size:20,fontSize:16,color:HEX(chestOpen?C.ink:C.mute)});
    const odds=WS.Econ.chestOdds().map(o=>(o.reward==="power"?"power":o.amount+"c")+" "+o.pct+"%").join("  ·  ");
    this.add.text(MARGIN+16,y+46,odds,{fontFamily:WS.FONT,fontSize:"10px",color:HEX(C.mute)});
    if(chestOpen){
      button(this,MARGIN+16,y+62,W-2*MARGIN-32,26,"Open",C.teal,C.tealD,()=>{
        const win=WS.Econ.openChest();
        if(!win) return;
        WS.Art.confetti(this,W/2,y+40,20);
        this.toast(win.reward==="coins" ? ("+"+win.amount+" coins!") : "Free power on your next run!");
        this.time.delayedCall(700,()=>this.scene.restart());
      },12);
    }
    y+=112;

    // ---- pre-run booster (coin sink) ----
    const boosted=WS.store.get("pendingBooster",false);
    const bg2=this.add.graphics(); bg2.fillStyle(0xffffff,0.95); bg2.fillRoundedRect(MARGIN,y,W-2*MARGIN,62,14);
    iconText(this,MARGIN+16,y+22,"ic_bolt","Head start",{size:16,fontSize:15,color:HEX(C.ink),originY:0});
    this.add.text(MARGIN+16,y+42,"Begin your next run with "+WS.Econ.BOOSTER_ENERGY+" energy",{fontFamily:WS.FONT,fontSize:"11px",color:HEX(C.mute)});
    if(boosted){
      this.add.text(W-MARGIN-16,y+31,"ARMED ✓",{fontFamily:WS.FONT,fontSize:"12px",fontStyle:"bold",color:HEX(C.teal)}).setOrigin(1,0.5);
    } else {
      button(this,W-MARGIN-110,y+16,94,30,""+WS.Econ.BOOSTER_COST,C.gold,0xD9A32E,()=>{
        if(!WS.Econ.spend(WS.Econ.BOOSTER_COST,"booster")) return this.toast("Not enough coins.");
        WS.store.set("pendingBooster",true);
        this.scene.restart();
      },13,"ic_coin");
    }
    y+=78;

    // ---- remove ads ----
    if(!WS.Entitle.isPremium()){
      button(this,MARGIN,y,W-2*MARGIN,48,
        "Remove ads — "+WS.IAP.priceOf(WS.MONETIZE.revenuecat.products.removeAds,"$4.99"),
        C.clay,C.clayD,async()=>{
          const r=await WS.IAP.buyRemoveAds();
          if(r.ok){ this.toast("Ads removed. Thank you!"); this.scene.restart(); }
          else if(r.reason==="unavailable") this.toast("Purchases aren't available in this build.");
          else if(r.reason!=="cancelled")   this.toast("Purchase failed. You were not charged.");
        },15);
      y+=60;
    }

    // ---- coin packs ----
    this.add.text(MARGIN,y,"COIN PACKS",{fontFamily:WS.FONT,fontSize:"10px",fontStyle:"bold",color:HEX(C.mute)});
    y+=18;
    WS.Econ.PACKS.forEach(p=>{
      const g=this.add.graphics(); g.fillStyle(0xffffff,0.95); g.fillRoundedRect(MARGIN,y,W-2*MARGIN,52,14);
      if(p.best){ g.lineStyle(3,C.gold,1); g.strokeRoundedRect(MARGIN,y,W-2*MARGIN,52,14); }
      iconText(this,MARGIN+16,y+26,"ic_coin",p.coins+"  "+p.label+(p.bonus?("  "+p.bonus):""),
        {size:18,fontSize:15,color:HEX(C.ink)});
      // priceOf falls back to the USD literal only when the store has not told
      // us the real localised price. Never charge a euro and print a dollar.
      const price=WS.IAP.priceOf(WS.MONETIZE.revenuecat.products[p.key],"$"+p.usd.toFixed(2));
      button(this,W-MARGIN-96,y+11,80,30,price,C.teal,C.tealD,async()=>{
        const r=await WS.IAP.buyCoins(p.key);
        if(r.ok){ this.toast("+"+r.coins+" coins!"); this.scene.restart(); }
        else if(r.reason==="unavailable") this.toast("Purchases aren't available in this build.");
        else if(r.reason!=="cancelled")   this.toast("Purchase failed. You were not charged.");
      },13);
      y+=60;
    });
  }
  toast(msg){
    const t=this.add.text(W/2,H-60,msg,{fontFamily:WS.FONT,fontSize:"14px",fontStyle:"bold",color:"#ffffff",backgroundColor:"#233A4F",padding:{x:14,y:8}}).setOrigin(0.5).setDepth(500);
    this.tweens.add({targets:t,alpha:0,delay:1500,duration:400,onComplete:()=>t.destroy()});
  }
};

// ---------- Diagnostics ----------
// The screen that answers "is £0 a market fact or a build fact?".
// Ads, IAP and analytics each report green / amber / red here, so a dead SDK can
// never masquerade as an unpopular game. See health.js for why this exists.
WS.DiagScene = class extends Phaser.Scene {
  constructor(){ super("diag"); }
  create(){
    menuBG(this);
    this.add.text(MARGIN,24,"Diagnostics",{fontFamily:WS.FONT,fontSize:"24px",fontStyle:"bold",color:HEX(C.ink)});
    backButton(this,"settings");

    const rep=WS.Health.report();
    const dot={green:0x2FA84F, amber:0xE0A21F, red:0xE24B4A, grey:0x9AA7B2};
    const meaning={
      green:"working",
      amber:"inert (dev/web build) — proves nothing",
      red:"FAILED — a zero here is a bug, not a market signal",
      grey:"never ran",
    };
    let y=76;
    this.add.text(MARGIN,y,rep.prod?"PRODUCTION BUILD":"TEST BUILD — ads use Google test units",
      {fontFamily:WS.FONT,fontSize:"11px",fontStyle:"bold",color:HEX(rep.prod?C.teal:C.clay)});
    y+=24;

    Object.keys(rep.subs).forEach(k=>{
      const s=rep.subs[k], st=s.status;
      const g=this.add.graphics(); g.fillStyle(0xffffff,0.95); g.fillRoundedRect(MARGIN,y,W-2*MARGIN,58,12);
      g.fillStyle(dot[st],1); g.fillCircle(MARGIN+22,y+29,8);
      this.add.text(MARGIN+42,y+16,k.toUpperCase(),{fontFamily:WS.FONT,fontSize:"14px",fontStyle:"bold",color:HEX(C.ink)});
      this.add.text(MARGIN+42,y+34,meaning[st],{fontFamily:WS.FONT,fontSize:"10px",color:HEX(C.mute),wordWrap:{width:W-2*MARGIN-60}});
      const d=s.detail;
      if(d&&d.state) this.add.text(W-MARGIN-12,y+16,d.state,{fontFamily:WS.FONT,fontSize:"10px",color:HEX(C.mute)}).setOrigin(1,0);
      y+=66;
    });

    y+=6;
    this.add.text(MARGIN,y,"COINS: "+WS.Econ.balance()+"   ·   PREMIUM: "+(WS.Entitle.isPremium()?"yes":"no"),
      {fontFamily:WS.FONT,fontSize:"11px",fontStyle:"bold",color:HEX(C.ink)});
    y+=22;
    this.add.text(MARGIN,y,"SCREEN: "+Math.round(window.innerWidth)+"×"+Math.round(window.innerHeight)+
      "  canvas "+WS.W+"×"+WS.H+"  safe "+JSON.stringify(WS.SAFE),
      {fontFamily:WS.FONT,fontSize:"10px",color:HEX(C.mute),wordWrap:{width:W-2*MARGIN}});
    y+=30;

    this.add.text(MARGIN,y,"RECENT EVENTS (proof they fire)",{fontFamily:WS.FONT,fontSize:"10px",fontStyle:"bold",color:HEX(C.mute)});
    y+=16;
    const ev=WS.Analytics.recent().slice(0,7);
    if(!ev.length) this.add.text(MARGIN,y,"none yet",{fontFamily:WS.FONT,fontSize:"10px",color:HEX(C.mute)});
    ev.forEach(e=>{
      this.add.text(MARGIN,y,"· "+e.name+"  "+JSON.stringify(e.props).slice(0,44),
        {fontFamily:WS.FONT,fontSize:"9px",color:HEX(C.mute)});
      y+=13;
    });
  }
};
})();

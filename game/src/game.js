/* Wordslide — GameScene v2. Words-With-Friends-style 15×15 board with bonus
   squares; letters tumble down the LEFT channel into a 7-slot tray; new
   arrivals push old letters off the tray (lose meter). Drag tiles from the
   tray onto the board, full crossword rules, tap Play to score. Levels with
   score targets; the slide speeds up and the loss allowance tightens.
   Modes: classic | daily | duel. Reads WS (worlds.js), WS.Audio, WS.Ads. */
(function(){
"use strict";
const cfgAccent = sc => (sc.cfg && sc.cfg.accent) || 0xFFD98A;
const WS = window.WS;
const {COLS,ROWS,W,H,MARGIN,CELL,GAP,TILE,BOARD_LEFT,BOARD_TOP,BOARD_W,BOARD_H,
       CHANNEL_X,CHAN_L,CHAN_R,TRAY_SIZE,TRAY_X,TRAY_Y,TRAY_TILE,TRAY_GAP,DUMP,DUMP_COST,
       VALUES,VOWELS,BAG,DICT,C,HEX} = WS;

const TIMED_SECONDS = 120;
const COMBO_WINDOW  = 25000;
const FULL_TRAY_BONUS = 40;

WS.GameScene = class extends Phaser.Scene {
  constructor(){ super("game"); }

  init(data){
    data = data||{};
    this.cfg = WS.WORLDS[data.world] || WS.WORLDS.mudslide;
    this.mode = data.mode || "classic";
    this.duelPlayer = data.duelPlayer || 1;
    this.p1Score = data.p1Score || 0;
    this.seed = data.seed;
    this.rand = (this.seed!=null) ? WS.mulberry32(this.seed) : Math.random;
    this.timed = (this.mode==="daily" || this.mode==="duel");
    // TEST ACCESS: jump straight into any level (world-select stepper / ?level=N).
    this.startLevel = Math.max(1, Math.min(30, parseInt(data.startLevel,10)||1));
  }

  create(){
    const cfg=this.cfg;
    // board: permanent tiles + boulders
    this.board=[]; for(let r=0;r<ROWS;r++) this.board.push(new Array(COLS).fill(null));
    this.tray=[];                 // left→right; new letters enter at index 0
    this.prov=[];                 // provisional placements: tiles with .r/.c set
    this.firstMove=true;
    this.score=0; this.levelScore=0; this.level=this.startLevel; this.words=0;
    this.combo=0; this.comboUntil=0; this.topCombo=0; this.tilesPlayed=0;
    this.lost=0; this.allowed = this.timed ? 10 : WS.allowedLosses(this.level);
    this.energy=0; this.best=""; this.bestPts=0;
    // ramp the slide speed to match the level we're starting on, so trialling
    // level 7 actually feels like level 7 and not like a fresh level 1
    this.dropEvery=Math.max(cfg.minDrop, cfg.dropEvery-cfg.ramp*(this.level-1));
    this.running=true; this.over=false; this.slowUntil=0;
    this.goldenNext=false; this.vowelsNext=0;
    this.counted=false; this.secondWindUsed=false;
    this.timeLeft=TIMED_SECONDS;
    this.cb=WS.store.settings().colorblind;
    this.tut=(this.mode==="classic" && cfg.key==="mudslide" && !WS.store.get("tutorialDone",false)) ? {step:0} : null;

    this.runStartedAt=Date.now();
    WS.Analytics.track("level_start",{ world:cfg.key, level:this.level, mode:this.mode });
    // paint the page behind the canvas with this world's sky, so the letterbox
    // on a tablet reads as intentional matting rather than a broken build
    WS.setPageBG(Array.isArray(cfg.sky) ? cfg.sky[0] : (cfg.sky || 0x8FD6EC));

    // a booster bought before the run starts banks energy up front
    if (WS.store.get("pendingBooster", false)){
      WS.store.set("pendingBooster", false);
      this.energy = WS.Econ.BOOSTER_ENERGY;
    }
    // the daily chest's rare 5% roll: one free power, spent on the next one used.
    // Consumed here so it cannot be re-used by restarting the run.
    this.freePower = false;
    if (WS.store.get("freePower", false)){
      WS.store.set("freePower", false);
      this.freePower = true;
    }

    this.drawBackground();
    this.buildHUD();
    this.buildBoard();
    this.buildTrayUI();
    this.buildControls();

    this.tileLayer=this.add.container(0,0).setDepth(20);
    this.dragLayer=this.add.container(0,0).setDepth(300);

    this.input.on("pointerdown", this.onDown, this);
    this.input.on("pointermove", this.onMove, this);
    this.input.on("pointerup",   this.onUp,   this);

    // starting letters
    if(this.tut) this.seedTutorialTray();
    else { for(let i=0;i<3;i++) this.time.delayedCall(300+i*520,()=>this.dropLetter(true)); }

    if(this.tut) this.buildTutorial();
    else this.startRun();

    this.updateHUD(); this.updateEnergy(); this.refreshPreview();
    this.nextQ=[]; while(this.nextQ.length<3) this.nextQ.push(this.pickChar());
    this.paintNext();
    WS.Audio.startMusic(cfg.key);
    this.events.once("shutdown", ()=>{ WS.Audio.stopMusic(); WS.Weather.stop(this); });
    this.playEntry();
  }

  /* ======================= LEVEL ENTRY =======================================
     The old version snapped straight to a full board — no sense of place, and
     you never saw the world you'd chosen. Now:
        1. the background stands alone, pushed in slightly (Ken Burns)
        2. the world's name lands on it
        3. its OWN weather gusts across the board area — snow, sand, ash, rain
        4. the board is revealed BY that gust: cells fade up in a diagonal wave,
           the wooden frame drops in with weight, the tray slides up, HUD last
     Everything is held until the sequence lands, so no letter tumbles into an
     empty board. Skippable: tap anywhere.
     ========================================================================= */
  playEntry(){
    const cfg=this.cfg;
    // hold the run
    this.running=false;
    ["dropEvt","svc","boulderEvt","gustEvt","frostEvt","clockEvt"].forEach(k=>{ if(this[k]) this[k].paused=true; });

    // hide everything that isn't the background or the weather
    const items=this.children.list.filter(o=>!o._noEntry && o!==this.bg && o.alpha!==undefined);
    items.forEach(o=>{ o._a0=(o.alpha==null?1:o.alpha); o.alpha=0; });

    // 1. Ken Burns push — the background is the star for a beat
    this.bg.setDisplaySize(W*1.10, H*1.10).setPosition(-W*0.05, -H*0.05);
    this.tweens.add({targets:this.bg, displayWidth:W, displayHeight:H, x:0, y:0,
      duration:2200, ease:"Sine.easeOut", onComplete:()=>this.bgDrift()});

    // 2. the world's name
    const title=WS.shadow(this.add.text(W/2, H*0.36, cfg.name,
      WS.T(44,"#FFF3DC",{strokeColor:WS.HEX(cfg.accentD),strokeWidth:7}))
      .setOrigin(0.5).setDepth(500).setAlpha(0).setScale(0.86),4);
    const sub=this.add.text(W/2, H*0.36+42, cfg.sub,
      {fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:"#FFF3DC"})
      .setOrigin(0.5).setDepth(500).setAlpha(0);
    title._noEntry=sub._noEntry=true;
    this.tweens.add({targets:[title,sub], alpha:1, duration:420, ease:"Quad.easeOut"});
    this.tweens.add({targets:title, scale:1, duration:520, ease:"Back.easeOut"});
    this.tweens.add({targets:[title,sub], alpha:0, y:"-=18", delay:1250, duration:420,
      onComplete:()=>{ title.destroy(); sub.destroy(); }});

    // 3. the gust — the world itself blows the board in
    this.time.delayedCall(1450, ()=>{
      WS.Weather.sweep(this, cfg.key, {duration:900, count:170, depth:24});
      this.beep(180,0.5,"sine",0.04);
      WS.buzz(18);
      this.cameras.main.shake(260, 0.0028);
    });

    // 4. reveal, cascading top-left -> bottom-right so it reads as "swept in"
    this.time.delayedCall(1650, ()=>{
      items.forEach(o=>{
        const x=(o.x||0), y=(o.y||0);
        const d=Math.min(620, (y*0.55 + x*0.18));       // diagonal wave
        o.alpha=0;
        this.tweens.add({targets:o, alpha:o._a0, duration:340, delay:d, ease:"Quad.easeOut"});
      });
      // the wooden frame and the tray get weight, not just a fade
      const frame=items.find(o=>o.texture && o.texture.key==="frame_board");
      if(frame){ frame.y-=26; this.tweens.add({targets:frame, y:frame.y+26, duration:520, delay:60, ease:"Back.easeOut"}); }
      const tray=items.find(o=>o.texture && o.texture.key==="traypanel");
      if(tray){ tray.y+=48; this.tweens.add({targets:tray, y:tray.y-48, duration:520, delay:380, ease:"Back.easeOut"}); }
    });

    // 5. hand control back
    this.entryDone=false;
    this.entryEvt=this.time.delayedCall(2500, ()=>this.endEntry());
    this.input.once("pointerdown", ()=>this.endEntry());     // tap to skip
  }
  endEntry(){
    if(this.entryDone) return;
    this.entryDone=true;
    if(this.entryEvt) this.entryEvt.remove();
    this.tweens.killTweensOf(this.bg);
    this.bg.setDisplaySize(W,H).setPosition(0,0); this.bgDrift();
    this.children.list.forEach(o=>{ if(o._a0!==undefined && o.alpha<o._a0){ this.tweens.killTweensOf(o); o.alpha=o._a0; } });
    ["dropEvt","svc","boulderEvt","gustEvt","frostEvt","clockEvt"].forEach(k=>{ if(this[k]) this[k].paused=false; });
    if(!this.over) this.running=true;
  }
  /* a scene should never be perfectly still: drift the background forever */
  bgDrift(){
    this.tweens.killTweensOf(this.bg);
    this.bg.setDisplaySize(W*1.045, H*1.045);
    this.tweens.add({targets:this.bg, x:-W*0.045, y:-H*0.02, duration:14000,
      yoyo:true, repeat:-1, ease:"Sine.easeInOut"});
  }

  startRun(){
    this.startDrops();
    this.svc=this.time.addEvent({delay:250, loop:true, callback:()=>this.service()});
    if(this.cfg.boulderEvery) this.boulderEvt=this.time.addEvent({delay:this.cfg.boulderEvery, loop:true, callback:()=>this.dropBoulder()});
    if(this.cfg.gustEvery)    this.gustEvt=this.time.addEvent({delay:this.cfg.gustEvery, loop:true, callback:()=>this.gust()});
    if(this.cfg.frostEvery)   this.frostEvt=this.time.addEvent({delay:this.cfg.frostEvery, loop:true, callback:()=>this.frostWave()});
    if(this.timed) this.clockEvt=this.time.addEvent({delay:1000, loop:true, callback:()=>this.clockTick()});
  }
  startDrops(){
    if(this.dropEvt) this.dropEvt.remove();
    this.dropEvt=this.time.addEvent({delay:this.dropEvery, loop:true, callback:()=>this.dropTick()});
  }
  dropTick(){
    if(!this.running) return;
    if(this.time.now<this.slowUntil) return;
    if(this.cfg.mode==="wave"){
      for(let i=0;i<this.cfg.waveCount;i++) this.time.delayedCall(i*420,()=>this.dropLetter(false));
    } else this.dropLetter(false);
  }
  clockTick(){
    if(!this.running) return;
    this.timeLeft--;
    if(this.timerTxt){
      const m=Math.floor(this.timeLeft/60), s=String(this.timeLeft%60).padStart(2,"0");
      this.timerTxt.setText(m+":"+s);
      this.timerTxt.setColor(this.timeLeft<=10 ? HEX(C.danger) : HEX(this.cfg.accentD));
      if(this.timeLeft<=10){ this.beep(880,0.05,"square",0.03); this.tweens.add({targets:this.timerTxt,scale:1.2,duration:110,yoyo:true}); }
    }
    if(this.timeLeft<=0) this.endRun("time");
  }

  // ================= background & HUD =================
  drawBackground(){
    const cfg=this.cfg;
    WS.Art.common(this); WS.Art.tiles(this);
    // keep the ref: the entry sequence pushes it in (Ken Burns) and it drifts
    // slowly forever after, so a level is never a dead still image.
    this.bg=this.add.image(0,0,WS.Art.scenery(this,cfg.key)).setOrigin(0).setDisplaySize(W,H);
    this.bg._noEntry=true;
    WS.Art.dressScene(this,cfg.key,{depth:0,bush:false});
    const chg=this.add.graphics();
    chg.fillStyle(0xffffff,0.32); chg.fillRoundedRect(4,BOARD_TOP-6,38,BOARD_H+12,12);
    chg.lineStyle(2,0xEADFCA,0.85); chg.strokeRoundedRect(4,BOARD_TOP-6,38,BOARD_H+12,12);
    // real particle weather (see weather.js). The old version re-drew 24 shapes
    // into a Graphics object every single frame.
    this.wx=WS.Weather.start(this,cfg.key,{depth:4});
    if(this.wx) this.wx._noEntry=true;
  }
  update(){ /* weather is now GPU particles (weather.js) — nothing to redraw here */ }


  buildHUD(){
    const cfg=this.cfg;
    // SY = the part of the status-bar/notch inset that actually overlaps the
    // canvas (WS.solveLayout already subtracted the letterbox). On a device with
    // no notch this is 0 and the HUD sits exactly where it always did.
    const SY=WS.SAFE.top;
    const title = this.mode==="daily" ? "Daily · "+cfg.name
                : this.mode==="duel" ? "Duel · Player "+this.duelPlayer : cfg.name;
    WS.Art.sign(this,"sign_t",178,34);
    this.add.image(MARGIN-4,SY+6,"sign_t").setOrigin(0).setDepth(5);
    WS.shadow(this.add.text(MARGIN+85,SY+23,title,WS.T(19,"#FFF3DC",{strokeColor:"#4A2E14",strokeWidth:4})).setOrigin(0.5).setDepth(5),2);
    if(this.timed) this.timerTxt=this.add.text(W/2+30,SY+12,"2:00",{fontFamily:WS.FONT,fontSize:"22px",fontStyle:"bold",color:HEX(cfg.accentD)}).setOrigin(0.5,0);
    // menu
    const mx=W-MARGIN-70,my=SY+10,mw=70,mh=28;
    const mg=this.add.graphics(); mg.fillStyle(0xffffff,0.9); mg.fillRoundedRect(mx,my,mw,mh,9);
    if(this.textures.exists("ic_menu")) this.add.image(mx+17,my+mh/2,"ic_menu").setDisplaySize(15,15).setOrigin(0.5);
    this.add.text(mx+29,my+mh/2,"Menu",{fontFamily:WS.FONT,fontSize:"12px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0,0.5);
    const mz=this.add.zone(mx,my,mw,mh).setOrigin(0).setInteractive();
    mz.on("pointerup",()=>{
      if(this.over) return;
      WS.Audio.stopMusic();
      this.scene.launch("pause",{world:this.cfg.key,mode:this.mode});
      this.scene.pause();
    });
    // chips: LEVEL | SCORE | TARGET  + loss meter right
    const chip=(x,w,lbl)=>{ const g=this.add.graphics(); g.fillStyle(0xffffff,0.92); g.fillRoundedRect(x,SY+46,w,42,10);
      this.add.text(x+8,SY+51,lbl,{fontFamily:WS.FONT,fontSize:"8px",fontStyle:"bold",color:HEX(C.mute)}); };
    chip(MARGIN,64,"LEVEL"); chip(MARGIN+70,96,"SCORE");
    if(!this.timed) chip(MARGIN+172,104,"TARGET");
    this.levelTxt=this.add.text(MARGIN+8,SY+60,"1",{fontFamily:WS.FONT,fontSize:"20px",fontStyle:"bold",color:HEX(cfg.accentD)});
    this.scoreTxt=this.add.text(MARGIN+78,SY+60,"0",{fontFamily:WS.FONT,fontSize:"20px",fontStyle:"bold",color:HEX(C.ink)});
    if(!this.timed) this.targetTxt=this.add.text(MARGIN+180,SY+62,"",{fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:HEX(C.teal)});
    // loss meter (letters you can still lose)
    this.add.text(W-MARGIN,SY+44,"LETTERS LEFT",{fontFamily:WS.FONT,fontSize:"8px",fontStyle:"bold",color:HEX(C.mute)}).setOrigin(1,0);
    this.meterGfx=this.add.graphics();
    this.comboTxt=this.add.text(W-MARGIN,SY+92,"",{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(cfg.accentD)}).setOrigin(1,0);
    this.updateMeter();
  }
  updateMeter(){
    const g=this.meterGfx; g.clear();
    const n=this.allowed, remain=Math.max(0,this.allowed-this.lost);
    const r=5, sp=13, x0=W-MARGIN-n*sp+sp/2, y=WS.SAFE.top+62;
    for(let i=0;i<n;i++){
      const on=i<remain;
      g.fillStyle(on?(remain<=3?C.danger:C.teal):0xD5DCE2,1);
      g.fillCircle(x0+i*sp,y,r);
    }
  }
  updateHUD(){
    this.levelTxt.setText(""+this.level);
    this.scoreTxt.setText(""+this.score);
    if(this.targetTxt) this.targetTxt.setText(this.levelScore+" / "+WS.levelTarget(this.level));
    const c=this.time.now<this.comboUntil?this.combo:0;
    this.comboTxt.setText(c>1?("COMBO ×"+c):"");
    this.updateMeter();
  }

  // ================= board =================
  buildBoard(){
    WS.Art.hollowFrame(this,"frame_board",BOARD_W+22,BOARD_H+22,18);
    this.add.image(BOARD_LEFT-11,BOARD_TOP-11,"frame_board").setOrigin(0);
    // The v7 "world glows through the empty cells" experiment is revoked: on real
    // screens the translucent grid read as a milky wash and left a pale block over
    // the board. The board is now fully OPAQUE — tile legibility rides on the board
    // itself, not on a dark scrim — and each world's art frames it instead.
    this.add.image(BOARD_LEFT-1,BOARD_TOP-1,WS.Art.board(this,this.cb)).setOrigin(0);
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const sq=WS.sqAt(r,c);
      if(sq&&sq.tag) this.add.text(this.cellX(c)+TILE/2,this.cellY(r)+TILE/2,sq.tag,
        {fontFamily:WS.FONT,fontSize:sq.key==="ST"?"15px":"10px",fontStyle:"bold",color:HEX(sq.ink)}).setOrigin(0.5);
    }
    this.hintGfx=this.add.graphics().setDepth(15);
  }
  cellX(c){ return BOARD_LEFT+c*CELL+GAP/2; }
  cellY(r){ return BOARD_TOP+r*CELL+GAP/2; }
  cellAt(x,y){
    const c=Math.floor((x-BOARD_LEFT)/CELL), r=Math.floor((y-BOARD_TOP)/CELL);
    if(r<0||r>=ROWS||c<0||c>=COLS) return null;
    return {r,c};
  }
  occupied(r,c){
    if(this.board[r][c]) return this.board[r][c];
    const p=this.prov.find(t=>t.r===r&&t.c===c);
    return p||null;
  }

  // ================= tray & tumbling letters =================
  buildTrayUI(){
    // Shipped art path: panel_tray.png (9-slice) + optional slot_empty.png.
    if(!WS.Art.has(this,"traypanel") && WS.Assets.has(this,"panel_tray")){
      const w=BOARD_W+22,h=TRAY_TILE+24;
      if(WS.Assets.bakeNine(this,"panel_tray","traypanel",w,h+4)){
        // stamp the 7 empty slot wells on top of the baked shelf (logical px)
        if(WS.Assets.has(this,"slot_empty")){
          const rt=this.make.renderTexture({x:0,y:0,width:w,height:h+4},false);
          const base=this.make.image({x:0,y:0,key:"traypanel",add:false}).setOrigin(0).setDisplaySize(w,h+4);
          rt.draw(base,0,0); base.destroy();
          for(let i=0;i<TRAY_SIZE;i++){
            const x=this.slotX(i)-TRAY_X+11;
            const im=this.make.image({x:0,y:0,key:"slot_empty",add:false}).setOrigin(0).setDisplaySize(TRAY_TILE,TRAY_TILE);
            rt.draw(im,x,12); im.destroy();
          }
          this.textures.remove("traypanel");
          rt.saveTexture("traypanel");
        }
      }
    }
    if(!WS.Art.has(this,"traypanel")){
      const g=this.make.graphics({add:false});
      const w=BOARD_W+22,h=TRAY_TILE+24;
      g.fillStyle(0x8A5A32,1); g.fillRoundedRect(0,4,w,h,16);
      g.fillStyle(0xA9713D,1); g.fillRoundedRect(0,0,w,h,16);
      g.fillStyle(0xC08A4E,0.9); g.fillRoundedRect(3,2,w-6,6,3);
      g.fillStyle(0xF7EFE2,1); g.fillRoundedRect(8,8,w-16,h-16,10);
      for(let i=0;i<TRAY_SIZE;i++){
        const x=this.slotX(i)-TRAY_X+11;
        g.fillStyle(0xD9CDB6,1); g.fillRoundedRect(x,13.5,TRAY_TILE,TRAY_TILE,8);
        g.fillStyle(0xEDE3D0,1); g.fillRoundedRect(x,12,TRAY_TILE,TRAY_TILE-1,8);
      }
      g.fillStyle(0x6E4526,0.9);
      [[7,7],[w-7,7],[7,h-7],[w-7,h-7]].forEach(([x,y])=>g.fillCircle(x,y,3.5));
      g.generateTexture("traypanel",w,h+4); g.destroy();
    }
    this.add.image(TRAY_X-11,TRAY_Y-12,"traypanel").setOrigin(0);
    // dump chute
    const d=this.add.graphics();
    d.fillStyle(0xC9856B,1); d.fillRoundedRect(DUMP.x,DUMP.y+3,DUMP.w,DUMP.h,10);
    d.fillStyle(0xF6E3DC,1); d.fillRoundedRect(DUMP.x,DUMP.y,DUMP.w,DUMP.h,10);
    d.lineStyle(2,0xE0B8A8,1); d.strokeRoundedRect(DUMP.x+1,DUMP.y+1,DUMP.w-2,DUMP.h-2,9);
    const bx=DUMP.x+DUMP.w/2, byy=DUMP.y+17;
    if(this.textures.exists("ic_trash")) this.add.image(bx,byy,"ic_trash").setDisplaySize(26,26);
    else { d.fillStyle(0xA4451F,1); d.fillRect(bx-7,byy-4,14,12); d.fillRect(bx-9,byy-7,18,3); d.fillRect(bx-3,byy-10,6,3); }
    this.iconNum(bx-1,DUMP.y+38,"ic_bolt",DUMP_COST,11,HEX(C.clayD),10);
  }
  slotX(i){ const w=(BOARD_W-(TRAY_SIZE-1)*TRAY_GAP)/TRAY_SIZE; return TRAY_X+i*(w+TRAY_GAP)+(w-TRAY_TILE)/2 + (w>TRAY_TILE?0:0); }
  slotCenter(i){ return {x:this.slotX(i)+TRAY_TILE/2, y:TRAY_Y+TRAY_TILE/2}; }

  // letters are drawn from a visible 2-deep queue (the "what's tumbling next" preview)
  nextChar(){
    while((this.nextQ=this.nextQ||[]).length<3) this.nextQ.push(this.pickChar());
    const ch=this.nextQ.shift();
    this.paintNext();
    return ch;
  }
  paintNext(){
    if(!this.nextUI){ this.nextUI=[]; }
    this.nextUI.forEach(o=>o.destroy()); this.nextUI=[];
    if(!this.nextQ) return;
    this.nextQ.slice(0,2).forEach((ch,i)=>{
      const y=BOARD_TOP+8+i*26, x=CHANNEL_X;
      const img=this.add.image(x,y+9,"tile_n").setDisplaySize(22,23).setAlpha(i===0?0.95:0.6).setDepth(6);
      const t=this.add.text(x,y+8,ch.toUpperCase(),{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"800",color:HEX(C.tileInk)}).setOrigin(0.5).setAlpha(i===0?1:0.65).setDepth(6);
      this.nextUI.push(img,t);
    });
  }
  pickChar(){
    if(this.vowelsNext>0){ this.vowelsNext--; return "aeiou"[Math.floor(this.rand()*5)]; }
    // vowel balancing: keep the tray from going vowel-dry
    const vs=this.tray.filter(t=>VOWELS[t.ch]).length;
    if(this.tray.length>=3 && vs===0 && this.rand()<0.75) return "aeiou"[Math.floor(this.rand()*5)];
    return BAG[Math.floor(this.rand()*BAG.length)];
  }

  /* Scale factor that renders texture <key> at exactly <target> logical px wide.
     Art authored at ANY scale (108/216/432px) lands the same size — so a dropped-in
     PNG can never blow out the tray the way a hardcoded 0.5 did. */
  texScale(key,target){
    const src=this.textures.get(key);
    const w=(src && src.source && src.source[0] && src.source[0].width) || target*2;
    return target/w;
  }

  makeLetterTile(ch,opts){
    opts=opts||{};
    const cont=this.add.container(0,0);
    const T=TRAY_TILE;
    // `spin` pivots at the tile's CENTRE. Rotate this, never `cont` — cont's
    // origin is the top-left corner, and spinning about a corner throws the
    // tile a full corner-radius sideways, straight out of the channel.
    const spin=this.add.container(T/2,T/2);
    cont.add(spin);
    const tex=opts.ember?"tile_ember":(opts.gold?"tile_gold":"tile_n");
    const img=this.add.image(-T/2,-T/2,tex).setOrigin(0).setScale(this.texScale(tex,T));
    const tile={ch,gold:!!opts.gold,ember:!!opts.ember,fuse:opts.ember?this.cfg.emberFuse:0,
                cont,spin,img,T,inTray:false,r:-1,c:-1,frost:null};
    spin.add(img);
    const txt=this.add.text(0,-2,ch.toUpperCase(),{fontFamily:WS.FONT,fontSize:Math.round(T*0.52)+"px",fontStyle:"bold",color:HEX(C.tileInk)}).setOrigin(0.5);
    const val=this.add.text(T/2-5,T/2-4,""+VALUES[ch],{fontFamily:WS.FONT,fontSize:"11px",fontStyle:"bold",color:HEX(C.tileInk)}).setOrigin(1,1).setAlpha(0.6);
    spin.add([txt,val]); tile.txt=txt; tile.val=val;
    if(tile.ember){
      tile.fuseTxt=this.add.text(-T/2+4,-T/2+2,"",{fontFamily:WS.FONT,fontSize:"11px",fontStyle:"bold",color:"#ffffff"});
      spin.add(tile.fuseTxt);
    }
    this.tileLayer.add(cont);
    return tile;
  }

  /* Where cont.x must sit for the tile's CENTRE to land on worldX at scale sc.
     (cont scales about its top-left, so the centre moves with the scale.) */
  contXForCentre(worldX,T,sc){ return worldX-(T/2)*sc; }

  // a letter tumbles down the left channel into the tray
  dropLetter(seedFast){
    if(this.over) return;
    const gold=this.rand()<WS.GOLD_CHANCE;
    const ember=this.cfg.emberChance && this.rand()<this.cfg.emberChance;
    const tile=this.makeLetterTile(this.nextChar(),{gold,ember});
    const t=tile.cont;
    const sc=TILE/tile.T*1.1;                       // small while tumbling
    t.setScale(sc);
    // Keep the whole rotating tile inside the channel. A square of side `d`
    // spinning about its centre sweeps a circle of radius d*sqrt2/2, so the
    // centre may only wander that far from the walls.
    const d=tile.T*sc, radius=d*Math.SQRT2/2;
    const minX=Math.max(CHAN_L+radius, radius+2);   // +2: never touch x=0
    const maxX=CHAN_R-radius;
    const centreX=()=>Phaser.Math.Clamp(CHANNEL_X+Phaser.Math.Between(-5,5), Math.min(minX,CHANNEL_X), Math.max(maxX,CHANNEL_X));
    t.x=this.contXForCentre(CHANNEL_X,tile.T,sc); t.y=BOARD_TOP-70;
    tile.spin.angle=Phaser.Math.Between(-30,30);    // spin the CENTRE-pivoted child
    this.dragLayer.add(t);
    const bounces=seedFast?2:3, span=(TRAY_Y-40)-(BOARD_TOP-40);
    // The whole tumble must comfortably finish before the NEXT letter drops, or
    // letters pile up in the chute. Scale it to the current level's drop rate.
    const BASE=seedFast?885:1980;                                  // unscaled total
    const target=Phaser.Math.Clamp(this.dropEvery*0.46, 620, 1500);
    const k=(seedFast?900:target)/BASE;
    const chain=[];
    for(let i=1;i<=bounces;i++){
      const dur=Math.round(((seedFast?300:470)+i*95)*k);
      chain.push({targets:t, y:BOARD_TOP-40+span*(i/bounces),
        x:this.contXForCentre(centreX(),tile.T,sc),
        duration:dur, ease:i===bounces?"Quad.easeIn":"Sine.easeInOut"});
      this.tweens.add({targets:tile.spin, delay:chain.slice(0,i-1).reduce((a,c)=>a+c.duration,0),
        angle:tile.spin.angle+Phaser.Math.Between(120,240)*(i%2?1:-1),
        duration:dur, ease:"Sine.easeInOut"});
    }
    this.beep(240+Math.random()*60,0.05,"triangle",0.03);
    this.tweens.chain({tweens:chain, onComplete:()=>this.enterTray(tile)});
  }
  enterTray(tile){
    if(this.over){ tile.cont.destroy(); return; }
    tile.inTray=true;
    this.tray.unshift(tile);
    let pushed=null;
    if(this.tray.length>TRAY_SIZE) pushed=this.tray.pop();
    this.reflowTray();
    this.beep(430,0.06,"sine",0.04);
    if(pushed) this.loseTile(pushed,"pushed");
  }
  reflowTray(){
    this.tray.forEach((tile,i)=>{
      tile.inTray=true;
      if(tile.cont.parentContainer!==this.tileLayer) this.tileLayer.add(tile.cont);
      const s=this.slotCenter(i);
      this.tweens.add({targets:tile.cont,x:s.x-tile.T/2,y:s.y-tile.T/2,angle:0,scale:1,duration:180,ease:"Quad.easeOut"});
      this.tweens.add({targets:tile.spin,angle:0,duration:180,ease:"Quad.easeOut"});
    });
  }
  loseTile(tile,why){
    tile.inTray=false; tile.lost=true; tile.cont.name="lost";   // flies off-screen by design
    this.dragLayer.add(tile.cont);
    this.tweens.add({targets:tile.cont, x:W+60, y:TRAY_Y+140, angle:Phaser.Math.Between(160,320),
      duration:520, ease:"Quad.easeIn", onComplete:()=>tile.cont.destroy()});
    this.lost++;
    this.updateMeter();
    WS.Analytics.track("tile_lost",{ world:this.cfg.key, level:this.level });
    this.beep(150,0.25,"sawtooth",0.06); WS.buzz(50);
    this.cameras.main.shake(120,0.004);
    if(this.lost>=this.allowed) this.endRun("letters");
    else if(this.allowed-this.lost===3) this.toast("Careful — 3 letters left!");
  }

  // ================= drag & drop =================
  onDown(p){
    if(this.over) return;
    // tap-to-place: a carried tile places on any tapped empty cell
    if(this.carry){
      const cell=this.cellAt(p.x,p.y);
      const c=this.carry;
      if(cell && !this.occupied(cell.r,cell.c) && !this.boulderAt(cell.r,cell.c)){
        this.carry=null;
        c.r=cell.r; c.c=cell.c; this.prov.push(c);
        this.tileLayer.add(c.cont);
        const sc=TILE/c.T;
        this.tweens.add({targets:c.cont,x:this.cellX(cell.c),y:this.cellY(cell.r),scaleX:sc,scaleY:sc,duration:130,ease:"Quad.easeOut"});
        this.beep(600,0.05,"sine",0.05); WS.buzz(12);
        this.refreshPreview();
        if(this.tut&&this.tut.step===0) this.setTutStep(1);
        return;
      }
      this.dropCarry();   // tapped elsewhere: put it back, fall through
    }
    // provisional tiles are re-grabbable
    let tile=this.prov.find(t=>this.hit(t,p,TILE));
    if(tile){
      this.prov=this.prov.filter(t=>t!==tile);
      this.grab(tile,p); this.refreshPreview(); return;
    }
    tile=this.tray.find(t=>this.hit(t,p,TRAY_TILE));
    if(tile){
      this.tray=this.tray.filter(t=>t!==tile); tile.inTray=false;
      this.reflowTray(); this.grab(tile,p);
    }
  }
  hit(tile,p,size){
    // A tray tile is hit-tested against its SLOT, not its animating position.
    // reflowTray() tweens tiles into place over 180ms; testing the live x/y made
    // a tile un-grabbable while it was still sliding in — so a tap right after a
    // letter landed (which is most taps) silently did nothing. This is why
    // placing felt broken.
    if(tile.inTray){
      const i=this.tray.indexOf(tile);
      if(i>=0){
        const x=this.slotX(i), y=TRAY_Y, w=TRAY_TILE;
        return p.x>=x-8 && p.x<=x+w+8 && p.y>=y-10 && p.y<=y+w+10;
      }
    }
    const b=tile.cont, sc=b.scaleX||1, w=tile.T*sc;
    return p.x>=b.x-8 && p.x<=b.x+w+8 && p.y>=b.y-8 && p.y<=b.y+w+8;
  }
  grab(tile,p){
    this.drag=tile; this.dragPt={x:p.x,y:p.y};
    this.downAt={x:p.x,y:p.y,t:this.time.now};
    this.dragLayer.add(tile.cont);
    tile.cont.setScale(1.05); tile.cont.angle=0; if(tile.spin) tile.spin.angle=0;
    this.moveDrag(p);
    this.beep(520,0.04,"sine",0.04); WS.buzz(10);
  }
  moveDrag(p){
    const t=this.drag; if(!t) return;
    this.dragPt={x:p.x,y:p.y};
    // visual: float above a FINGER so it isn't occluded; barely offset for a mouse
    const off=(p.wasTouch)?t.T*1.05:8;
    const half=t.T*1.05/2;
    t.cont.x=p.x-half;
    t.cont.y=p.y-half-off;
    // drop-target highlight — always where the POINTER is
    this.hintGfx.clear();
    const cell=this.dropCell();
    if(cell){
      this.hintGfx.fillStyle(C.selOutline,0.22);
      this.hintGfx.fillRoundedRect(this.cellX(cell.c)-1,this.cellY(cell.r)-1,TILE+2,TILE+2,5);
      this.hintGfx.lineStyle(3,C.selOutline,0.95);
      this.hintGfx.strokeRoundedRect(this.cellX(cell.c)-1,this.cellY(cell.r)-1,TILE+2,TILE+2,5);
    }
  }
  onMove(p){ if(this.drag) this.moveDrag(p); }
  dropCell(){
    if(!this.drag||!this.dragPt) return null;
    const cell=this.cellAt(this.dragPt.x,this.dragPt.y);
    if(!cell) return null;
    if(this.occupied(cell.r,cell.c)) return null;
    if(this.boulderAt(cell.r,cell.c)) return null;
    return cell;
  }
  dropCarry(){
    const c=this.carry; if(!c) return;
    this.carry=null;
    if(c._pulse){ c._pulse.stop(); c._pulse=null; }
    this.returnToTray(c);
  }
  onUp(p){
    const t=this.drag; if(!t) return;
    // a short, motionless press on a tray tile = pick it up (tap-to-place)
    const d=this.downAt, moved=d?Math.hypot(p.x-d.x,p.y-d.y):99;
    if(d && moved<9 && this.time.now-d.t<450 && t.r<0){
      this.drag=null; this.hintGfx.clear();
      this.carry=t;
      this.dragLayer.add(t.cont);
      this.tweens.add({targets:t.cont,y:TRAY_Y-46,scaleX:1.12,scaleY:1.12,duration:150,ease:"Back.easeOut"});
      t._pulse=this.tweens.add({targets:t.cont,y:TRAY_Y-54,duration:420,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
      this.beep(560,0.05,"sine",0.05);
      return;
    }
    this.dragPt={x:p.x,y:p.y};
    const cell=this.dropCell();          // BEFORE clearing drag state
    this.drag=null; this.hintGfx.clear();
    if(cell){
      // place provisionally on the board
      t.r=cell.r; t.c=cell.c;
      this.prov.push(t);
      this.tileLayer.add(t.cont);
      const sc=TILE/t.T;
      // shrink INTO the cell as it travels, then land with weight
      this.tweens.add({targets:t.cont,x:this.cellX(cell.c),y:this.cellY(cell.r),
        scaleX:sc,scaleY:sc,duration:130,ease:WS.Juice.E.snap,
        onComplete:()=>{ WS.Juice.land(this,t.cont,sc); WS.Juice.sparks(this,t.cont.x+TILE/2,t.cont.y+TILE/2,4); }});
      this.beep(600,0.05,"sine",0.05); WS.buzz(12);
      this.refreshPreview();
      if(this.tut&&this.tut.step===0) this.setTutStep(1);
      return;
    }
    // dump chute?
    if(p.x<DUMP.x+DUMP.w+10 && p.y>DUMP.y-20 && p.y<DUMP.y+DUMP.h+20){
      if(this.energy>=DUMP_COST){
        this.energy-=DUMP_COST; this.updateEnergy();
        this.tweens.add({targets:t.cont,y:H+80,angle:200,alpha:0.6,duration:380,ease:"Quad.easeIn",onComplete:()=>t.cont.destroy()});
        this.toast("Tossed!"); this.beep(300,0.1,"triangle",0.05);
        this.refreshPreview();
        return;
      }
      this.toast("Need "+DUMP_COST+" energy to toss");
    }
    this.returnToTray(t);
  }
  returnToTray(t){
    if(this.tray.length>=TRAY_SIZE){
      // no room (tray refilled while tile was out) — bounce back to board if it was there
      if(t.r>=0 && !this.occupied(t.r,t.c)){ this.prov.push(t); this.tileLayer.add(t.cont);
        const sc=TILE/t.T;
        this.tweens.add({targets:t.cont,x:this.cellX(t.c),y:this.cellY(t.r),scaleX:sc,scaleY:sc,duration:140});
        this.refreshPreview(); return;
      }
      this.toast("Tray full!");
    }
    t.r=-1; t.c=-1;
    const idx=Math.min(this.tray.length,TRAY_SIZE-1);
    this.tray.splice(idx,0,t);
    this.reflowTray(); this.refreshPreview();
  }
  recallAll(){
    this.dropCarry();
    if(!this.prov.length) return;
    const back=this.prov.slice(); this.prov=[];
    back.forEach(t=>{ if(this.tray.length<TRAY_SIZE){ t.r=-1;t.c=-1; this.tray.push(t); } else this.prov.push(t); });
    this.reflowTray(); this.refreshPreview();
    this.beep(260,0.06,"sine",0.04);
  }

  // ================= move validation & scoring (crossword rules) =================
  validateMove(){
    const cells=this.prov;
    if(!cells.length) return {valid:false};
    const rs=[...new Set(cells.map(t=>t.r))], cs=[...new Set(cells.map(t=>t.c))];
    let horiz;
    if(rs.length===1&&cs.length===1) horiz=null;         // single tile — try both
    else if(rs.length===1) horiz=true;
    else if(cs.length===1) horiz=false;
    else return {valid:false, reason:"one line only"};

    const occ=(r,c)=> (r>=0&&r<ROWS&&c>=0&&c<COLS) ? this.occupied(r,c) : null;
    const lineOK=(h)=>{
      const fix=h?cells[0].r:cells[0].c;
      const xs=cells.map(t=>h?t.c:t.r), lo=Math.min(...xs), hi=Math.max(...xs);
      for(let i=lo;i<=hi;i++){ if(!(h?occ(fix,i):occ(i,fix))) return false; }
      return true;
    };
    if(horiz===null){ if(lineOK(true)) horiz=true; else horiz=false; }
    if(!lineOK(horiz)) return {valid:false, reason:"gap in word"};

    // collect words
    const wordAt=(r,c,h)=>{
      let r0=r,c0=c;
      while(occ(h?r0:r0-1,h?c0-1:c0)) { if(h) c0--; else r0--; }
      let word="",tiles=[];
      let rr=r0,cc=c0;
      while(true){
        const t=occ(rr,cc); if(!t) break;
        word+=t.ch; tiles.push({t,r:rr,c:cc});
        if(h) cc++; else rr++;
      }
      return {word,tiles,h};
    };
    const isNew=(r,c)=>cells.some(t=>t.r===r&&t.c===c);
    const words=[];
    const main=wordAt(cells[0].r,cells[0].c,horiz);
    if(main.word.length>=2) words.push(main);
    cells.forEach(t=>{
      const wsd=wordAt(t.r,t.c,!horiz);
      if(wsd.word.length>=2 && !words.some(w=>w.h===wsd.h && w.tiles[0].r===wsd.tiles[0].r && w.tiles[0].c===wsd.tiles[0].c)) words.push(wsd);
    });
    if(!words.length) return {valid:false, reason:"2+ letters"};

    // placement rules
    if(this.firstMove){
      if(!cells.some(t=>t.r===7&&t.c===7)) return {valid:false, reason:"start on the ★"};
      if(main.word.length<2) return {valid:false, reason:"2+ letters"};
    } else {
      const touches=words.some(w=>w.tiles.some(x=>!isNew(x.r,x.c)));
      if(!touches) return {valid:false, reason:"must connect"};
    }
    // dictionary
    for(const w of words){ if(!DICT.has(w.word)) return {valid:false, reason:w.word.toUpperCase()+" isn't a word"}; }

    // scoring
    let total=0;
    const detail=words.map(w=>{
      let sum=0, wm=1;
      w.tiles.forEach(x=>{
        let lv=VALUES[x.t.ch]*(x.t.gold?2:1)*(x.t.ember?2:1);
        const nw=isNew(x.r,x.c), sq=nw?WS.sqAt(x.r,x.c):null;
        if(sq){ lv*=sq.lm; wm*=sq.wm; }
        sum+=lv;
      });
      const pts=sum*wm; total+=pts;
      return {word:w.word,pts,tiles:w.tiles};
    });
    if(cells.length===TRAY_SIZE) total+=FULL_TRAY_BONUS;
    const rare=cells.filter(t=>({q:1,z:1,x:1,j:1})[t.ch]).length;   // Q/Z/X/J reward
    if(rare) total+=12*rare;
    const combo=this.time.now<this.comboUntil?this.combo:0;
    total=Math.round(total*(1+0.1*combo)*(this.goldenNext?2:1));
    return {valid:true, words:detail, total, main:main.word, full:cells.length===TRAY_SIZE, rare:rare>0};
  }

  refreshPreview(){
    const res=this.validateMove();
    if(!this.prov.length){ this.wordTxt.setText(""); this.previewTxt.setText(""); this.setButtonEnabled(this.playBtn,false); this.setButtonEnabled(this.recallBtn,false); return; }
    this.setButtonEnabled(this.recallBtn,true);
    if(res.valid){
      this.wordTxt.setText(res.main.toUpperCase()+(res.words.length>1?" +"+(res.words.length-1):""));
      this.previewTxt.setText("+"+res.total+" points"+(res.full?"  ·  FULL TRAY!":"")+(res.rare?"  ·  RARE LETTER!":"")+(this.goldenNext?"  ·  GOLDEN ×2":""));
      this.previewTxt.setColor(HEX(C.teal));
    } else {
      this.wordTxt.setText(this.prov.map(t=>t.ch.toUpperCase()).join(""));
      this.previewTxt.setText(res.reason||"keep going…");
      this.previewTxt.setColor(HEX(C.mute));
    }
    this.setButtonEnabled(this.playBtn,!!res.valid);
  }

  submit(){
    this.dropCarry();
    const res=this.validateMove();
    if(!res.valid){ this.cameras.main.shake(160,0.005); this.beep(120,0.2,"sawtooth",0.05); return; }
    const cells=this.prov.slice(); this.prov=[];
    // commit tiles to the board
    let bonusCovered=0;
    cells.forEach(t=>{
      this.board[t.r][t.c]=t; t.inTray=false;
      if(WS.sqAt(t.r,t.c)) bonusCovered++;
      t.cont.x=this.cellX(t.c); t.cont.y=this.cellY(t.r);
      const sc=TILE/t.T; t.cont.setScale(sc);
      if(t.fuseTxt){ t.fuseTxt.destroy(); t.fuseTxt=null; } t.fuse=0;   // ember fuse stops once on the board
    });
    // the wave: each tile pops in reading order, ~55ms apart, throwing sparks.
    // simultaneous pops read as a glitch; a wave reads as a chain reaction.
    const waveMs = WS.Juice.wordWave(this, cells, t=>TILE/t.T, {half:TILE/2, color:cfgAccent(this)});
    this.firstMove=false;
    // crack boulders adjacent to new tiles
    this.crackBoulders(cells);
    // score
    this.score+=res.total; this.levelScore+=res.total; this.words++;
    WS.Analytics.track("word_played",{
      // res.words[0] is a {word,pts,tiles} detail object — its .length is
      // undefined, and String(undefined) was being sent on EVERY event. The
      // length of the word is res.main's.
      len:res.main.length,
      points:res.total,
      tier:(res.total>=100?"spectacular":res.total>=70?"amazing":res.total>=45?"great":res.total>=25?"nice":"ok"),
    });
    const now=this.time.now;
    this.combo=(now<this.comboUntil)?this.combo+1:1;
    this.comboUntil=now+COMBO_WINDOW;
    this.topCombo=Math.max(this.topCombo,this.combo);
    this.energy=Math.min(99,this.energy+cells.length);
    this.tilesPlayed+=cells.length;
    if(this.goldenNext){ this.goldenNext=false; }
    if(res.total>this.bestPts){ this.bestPts=res.total; this.best=res.main.toUpperCase(); }
    WS.store.setBestWord(res.main.toUpperCase(),res.total);
    // goals
    const done=g=>this.goalToast(g);
    WS.goals.bump("word",1,done);
    WS.goals.bump("tiles",cells.length,done);
    if(bonusCovered) WS.goals.bump("bonus",bonusCovered,done);
    if(res.main.length>=5) WS.goals.bump("longword",1,done);
    WS.goals.bump("combo",this.combo,done);
    // juice
    const mid=cells[Math.floor(cells.length/2)];
    this.time.delayedCall(waveMs, ()=>this.flyup("+"+res.total,this.cellX(mid.c)+TILE/2,this.cellY(mid.r)));
    if(res.full){ this.toast("FULL TRAY! +"+FULL_TRAY_BONUS); WS.Juice.impact(this,1,false); WS.Art.confetti(this,W/2,BOARD_TOP+BOARD_H/2,30); }
    this.praise(res.total);
    // impact scales with the score: routine words shouldn't rattle the screen
    WS.Juice.impact(this, Math.min(1,res.total/90), true);
    WS.buzz(20);
    this.beep(660,0.09,"sine",0.06); this.time.delayedCall(70,()=>this.beep(880,0.1,"sine",0.05));
    res.words.forEach((w,i)=>{ if(i>0) this.time.delayedCall(i*120,()=>this.beep(700+i*80,0.06,"sine",0.04)); });
    this.updateHUD(); this.updateEnergy(); this.refreshPreview();
    this.nextQ=[]; while(this.nextQ.length<3) this.nextQ.push(this.pickChar());
    this.paintNext();
    if(this.tut&&this.tut.step===1) this.setTutStep(2);
    // level cleared?
    if(!this.timed && this.levelScore>=WS.levelTarget(this.level)) this.levelCleared();
  }

  // ================= levels =================
  levelCleared(){
    this.running=false;
    if(this.dropEvt) this.dropEvt.remove();
    WS.goals.bump("level",this.level+1,g=>this.goalToast(g));
    WS.store.setBestLevel(this.cfg.key,this.level+1);
    this.beep(740,0.12,"square",0.05); this.time.delayedCall(120,()=>this.beep(980,0.15,"triangle",0.05));
    WS.Art.confetti(this,W/2,H*0.32,34);

    // the main coin faucet: clearing a level pays, and pays more the deeper you are
    const coins = WS.Econ.levelReward(this.level);
    WS.Econ.grant(coins, "level_clear");
    WS.Analytics.track("level_end",{
      world:this.cfg.key, level:this.level, mode:this.mode, result:"clear",
      score:this.score, words:this.words, lost:this.lost,
      duration_s: Math.round((Date.now()-(this.runStartedAt||Date.now()))/1000),
    });

    const ov=this.add.container(0,0).setDepth(400);
    const sh=this.add.graphics(); sh.fillStyle(0x0d1426,0.6); sh.fillRect(0,0,W,H); ov.add(sh);
    const cw=W-80,chh=250,cx=40,cy=H/2-chh/2;
    WS.Art.woodFrame(this,"card_lvl",cw,chh,20);
    ov.add(this.add.image(cx,cy,"card_lvl").setOrigin(0));
    ov.add(this.add.text(W/2,cy+40,"Level "+this.level+" cleared!",{fontFamily:WS.FONT,fontSize:"28px",fontStyle:"bold",color:HEX(this.cfg.accentD)}).setOrigin(0.5));
    ov.add(this.add.text(W/2,cy+80,"Run score: "+this.score,{fontFamily:WS.FONT,fontSize:"15px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0.5));
    ov.add(this.add.text(W/2+4,cy+104,"+"+coins+" coins",{fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:HEX(C.gold)}).setOrigin(0,0.5));
    if(this.textures.exists("ic_coin")) ov.add(this.add.image(W/2-6,cy+104,"ic_coin").setDisplaySize(18,18).setOrigin(1,0.5));
    const nl=this.level+1;
    ov.add(this.add.text(W/2,cy+130,"Next: faster slide · only "+WS.allowedLosses(nl)+" letters may fall",{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)}).setOrigin(0.5));
    const bw=200,bh=52,bx=W/2-bw/2,by=cy+chh-80;
    const bg=this.add.graphics();
    bg.fillStyle(0x000000,0.18); bg.fillRoundedRect(bx+2,by+6,bw,bh,14);
    bg.fillStyle(this.cfg.accentD,1); bg.fillRoundedRect(bx,by+4,bw,bh,14);
    bg.fillStyle(this.cfg.accent,1); bg.fillRoundedRect(bx,by,bw,bh,14);
    bg.fillStyle(0xffffff,0.28); bg.fillRoundedRect(bx+4,by+3,bw-8,13,7); ov.add(bg);
    ov.add(WS.shadow(this.add.text(W/2,by+bh/2,"Keep sliding ▶",WS.T(18,"#ffffff",{strokeColor:WS.HEX(this.cfg.accentD),strokeWidth:4})).setOrigin(0.5),2));
    const z=this.add.zone(bx,by,bw,bh).setOrigin(0).setInteractive(); ov.add(z);
    z.on("pointerup",()=>{ ov.destroy(); this.nextLevel(); });
  }
  nextLevel(){
    this.level++;
    this.levelScore=0; this.lost=0;
    this.allowed=WS.allowedLosses(this.level);
    this.dropEvery=Math.max(this.cfg.minDrop,this.cfg.dropEvery-this.cfg.ramp*(this.level-1));
    this.firstMove=true;
    // sweep the board clear (cascade)
    this.recallAll();
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const t=this.board[r][c];
      if(t){ this.board[r][c]=null;
        this.tweens.add({targets:t.cont,y:H+60,angle:Phaser.Math.Between(-180,180),alpha:0,duration:400+Math.random()*300,delay:(r*15),ease:"Quad.easeIn",onComplete:()=>t.cont.destroy()});
      }
      const b=this.boulders&&this.boulders.find(b=>b.r===r&&b.c===c);
      if(b){ this.tweens.add({targets:b.cont,y:H+60,alpha:0,duration:420,onComplete:()=>b.cont.destroy()}); }
    }
    this.boulders=[];
    this.running=true;
    this.startDrops();
    this.updateHUD();
    // Without this, only level 1 ever emitted level_start (create() fires once
    // per scene) and every level_end from L2+ had no matching start — which
    // silently corrupts any progression funnel built on the pair.
    WS.Analytics.track("level_start",{ world:this.cfg.key, level:this.level, mode:this.mode });
    this.toast("Level "+this.level+" — the slide quickens!");
  }

  // ================= world mechanics =================
  service(){
    if(!this.running) return;
    // volcano: embers burn down while in the tray
    if(this.cfg.emberChance){
      const burnt=[];
      this.tray.forEach(t=>{
        if(t.ember){ t.fuse-=250;
          if(t.fuseTxt) t.fuseTxt.setText(""+Math.ceil(Math.max(0,t.fuse)/1000));
          if(t.fuse<=0) burnt.push(t);
        }
      });
      burnt.forEach(t=>{
        this.tray=this.tray.filter(x=>x!==t);
        const x=t.cont.x+t.T/2,y=t.cont.y+t.T/2;
        for(let i=0;i<8;i++){ const p=this.add.circle(x,y,Phaser.Math.Between(2,4),0xF06236).setDepth(310);
          this.tweens.add({targets:p,x:x+Phaser.Math.Between(-40,40),y:y-Phaser.Math.Between(10,50),alpha:0,duration:420,onComplete:()=>p.destroy()}); }
        t.cont.destroy();
        this.toast("Ember burned away!");
        this.reflowTray();
        this.lost++; this.updateMeter();
        this.beep(110,0.25,"sawtooth",0.06);
        if(this.lost>=this.allowed) this.endRun("letters");
      });
    }
    this.updateHUD();
  }
  // landslide boulders — tumble down and land on a random empty board square
  dropBoulder(){
    if(!this.running) return;
    const empty=[];
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      if(!this.board[r][c] && !this.boulderAt(r,c) && !(r===7&&c===7&&this.firstMove) && !this.prov.some(t=>t.r===r&&t.c===c)) empty.push({r,c});
    }
    if(!empty.length) return;
    const cell=empty[Math.floor(this.rand()*empty.length)];
    const cont=this.add.container(CHANNEL_X-TILE/2,BOARD_TOP-70);
    const img=this.add.image(0,0,"tile_boulder").setOrigin(0).setScale(this.texScale("tile_boulder",TILE));
    cont.add(img); cont.setDepth(310);
    const b={boulder:true,r:cell.r,c:cell.c,cont};
    this.boulders=this.boulders||[]; this.boulders.push(b);
    this.tweens.chain({tweens:[
      {targets:cont,y:BOARD_TOP+BOARD_H*0.5,angle:220,duration:420,ease:"Quad.easeIn"},
      {targets:cont,x:this.cellX(cell.c),y:this.cellY(cell.r),angle:360,duration:380,ease:"Sine.easeOut"},
    ], onComplete:()=>{ cont.setDepth(18); this.cameras.main.shake(90,0.003); this.beep(140,0.15,"sawtooth",0.05); }});
    this.toast("Boulder incoming!");
  }
  boulderAt(r,c){ return (this.boulders||[]).find(b=>b.r===r&&b.c===c)||null; }
  crackBoulders(cells){
    if(!this.boulders||!this.boulders.length) return;
    const hit=[];
    cells.forEach(t=>{ [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
      const b=this.boulderAt(t.r+dr,t.c+dc); if(b&&hit.indexOf(b)<0) hit.push(b);
    });});
    if(!hit.length) return;
    hit.forEach(b=>{
      this.boulders=this.boulders.filter(x=>x!==b);
      const x=this.cellX(b.c)+TILE/2,y=this.cellY(b.r)+TILE/2;
      for(let i=0;i<7;i++){ const p=this.add.circle(x,y,Phaser.Math.Between(2,4),0x9A8F82).setDepth(60);
        this.tweens.add({targets:p,x:x+Phaser.Math.Between(-30,30),y:y+Phaser.Math.Between(-24,24),alpha:0,duration:400,onComplete:()=>p.destroy()}); }
      b.cont.destroy();
      this.score+=10; this.levelScore+=10;
    });
    this.toast(hit.length>1?"Boulders cracked! +"+(10*hit.length):"Boulder cracked! +10");
    this.beep(320,0.14,"square",0.05);
  }
  // sandstorm — gust scrambles the tray
  gust(){
    if(!this.running||this.tray.length<2) return;
    Phaser.Utils.Array.Shuffle(this.tray);
    this.reflowTray();
    this.beep(180,0.3,"sawtooth",0.03);
    const dir=this.rand()<0.5?-1:1;
    for(let i=0;i<7;i++){
      const y=TRAY_Y-30+Math.random()*90, x0=dir>0?-40:W+40;
      const ln=this.add.rectangle(x0,y,46,2,0xF2E2B8,0.8).setDepth(320);
      this.tweens.add({targets:ln,x:dir>0?W+60:-60,duration:420+Math.random()*220,delay:i*40,ease:"Sine.easeIn",onComplete:()=>ln.destroy()});
    }
    this.toast("Gust! Tray scrambled");
  }
  // blizzard — frost hides tray letters briefly
  frostWave(){
    if(!this.running) return;
    const cand=this.tray.filter(t=>!t.frost);
    Phaser.Utils.Array.Shuffle(cand);
    cand.slice(0,this.cfg.frostCount).forEach(t=>{
      const fr=this.add.image(0,0,"tile_frost").setOrigin(0).setScale(this.texScale("tile_frost",TRAY_TILE));
      fr.setPosition(-t.T/2,-t.T/2); t.spin.add(fr); t.frost={fr};
      this.time.delayedCall(this.cfg.frostDur,()=>{ if(t.frost){ t.frost.fr.destroy(); t.frost=null; } });
    });
  }

  // ================= controls =================
  buildControls(){
    const cfg=this.cfg;
    // All y-coords come from WS.solveLayout (worlds.js): the lower stack is
    // bottom-anchored so it clears the gesture bar / home indicator on every device.
    this.wordTxt=WS.shadow(this.add.text(W/2,WS.PREVIEW_Y-28,"",WS.T(24,"#FFF3DC",{strokeColor:WS.HEX(cfg.accentD),strokeWidth:5})).setOrigin(0.5,0),2);
    this.previewTxt=this.add.text(W/2,WS.PREVIEW_Y,"",{fontFamily:WS.FONT,fontSize:"12px",color:HEX(C.mute)}).setOrigin(0.5,0);
    const by=WS.BTN_Y,bh=WS.BTN_H, rw=150, pw=W-2*MARGIN-rw-10;
    this.recallBtn=this.makeButton(MARGIN,by,rw,bh,"↩ Recall",C.teal,C.tealD,()=>this.recallAll());
    this.playBtn=this.makeButton(MARGIN+rw+10,by,pw,bh,"Play word",cfg.accent,cfg.accentD,()=>this.submit());
    // powers
    this.energyTxt=this.add.text(W-MARGIN,WS.POWERS_LABEL_Y,"0",{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(cfg.accentD)}).setOrigin(1,0);
    this.energyIcon=this.textures.exists("ic_bolt")?this.add.image(W-MARGIN,WS.POWERS_LABEL_Y+8,"ic_bolt").setDisplaySize(15,15).setOrigin(1,0.5):null;
    this.add.text(MARGIN,WS.POWERS_LABEL_Y,"POWERS",{fontFamily:WS.FONT,fontSize:"10px",fontStyle:"bold",color:HEX(C.mute)});
    const n=WS.POWERS.length, gap=6, pw2=(W-2*MARGIN-(n-1)*gap)/n, py=WS.POWERS_Y, ph=WS.POWERS_H;
    this.powerBtns=[];
    WS.POWERS.forEach((p,i)=>{
      const x=MARGIN+i*(pw2+gap);
      const g=this.add.graphics();
      // Shipped art path: assets/icons/ic_<power>.png replaces the text label.
      const ik="ic_"+p.key, hasIcon=WS.Assets.has(this,ik);
      let ico=null, nt=null;
      if(hasIcon){
        ico=this.add.image(x+pw2/2,py+15,ik).setDisplaySize(22,22);
      } else {
        nt=this.add.text(x+pw2/2,py+12,p.name,{fontFamily:WS.FONT,fontSize:"11px",fontStyle:"bold",color:"#ffffff"}).setOrigin(0.5);
      }
      const pair=this.iconNum(x+pw2/2-1,py+30,"ic_bolt",p.cost,11,"#ffffff",10);
      const ct=pair.txt, cbolt=pair.ico;
      const z=this.add.zone(x,py,pw2,ph).setOrigin(0).setInteractive();
      z.on("pointerup",()=>this.usePower(p));
      this.powerBtns.push({p,g,nt,ct,cbolt,ico,x,py,pw:pw2,ph});
    });
  }
  makeButton(x,y,w,h,label,fill,shadow,cb){
    // shipped 9-slice skin (assets/ui/btn_*.png) when available, else Graphics
    const skin=WS.Assets.btnSkin(fill);
    let g=null, ns=null;
    if(skin && this.textures.exists(skin)){
      ns=WS.Assets.nine(this,skin,x,y,w,h+4,0,0,
                        WS.Assets.btnNeedsTint(skin) ? fill : null);
    } else {
      g=this.add.graphics();
      g.fillStyle(0x000000,0.18); g.fillRoundedRect(x+2,y+6,w,h,16);
      g.fillStyle(shadow,1); g.fillRoundedRect(x,y+4,w,h,16);
      g.fillStyle(fill,1); g.fillRoundedRect(x,y,w,h,16);
      g.fillStyle(0xffffff,0.28); g.fillRoundedRect(x+4,y+3,w-8,Math.min(14,h*0.3),8);
      g.lineStyle(3,shadow,0.9); g.strokeRoundedRect(x+1.5,y+1.5,w-3,h+1,15);
    }
    const t=WS.shadow(this.add.text(x+w/2,y+h/2,label,WS.T(19,"#ffffff",{strokeColor:WS.HEX(shadow),strokeWidth:4})).setOrigin(0.5),2);
    const z=this.add.zone(x,y,w,h).setOrigin(0).setInteractive();
    const press=(d)=>{ t.y=y+h/2+(d?3:0); if(ns) ns.y=y+(d?3:0); };
    z.on("pointerdown",()=>press(true));
    z.on("pointerup",()=>{ press(false); cb(); });
    z.on("pointerout",()=>press(false));
    return {g,ns,skin,t,fill,shadow,x,y,w,h};
  }
  setButtonEnabled(btn,on){
    if(btn.ns){
      // colour is baked into the texture, so "disabled" is expressed with alpha
      // rather than setTint (which the Canvas renderer ignores).
      btn.ns.setAlpha(on?1:0.62);
      btn.t.setColor("#ffffff");
      btn.t.setStroke(WS.HEX(on?btn.shadow:0x8A949C),4);
      btn.t.setAlpha(on?1:0.7);
      return;
    }
    const g=btn.g,{x,y,w,h}=btn; g.clear();
    const fill=on?btn.fill:0xCED5DB, sh=on?btn.shadow:0xAEB6BE;
    g.fillStyle(0x000000,0.18); g.fillRoundedRect(x+2,y+6,w,h,16);
    g.fillStyle(sh,1); g.fillRoundedRect(x,y+4,w,h,16);
    g.fillStyle(fill,1); g.fillRoundedRect(x,y,w,h,16);
    g.fillStyle(0xffffff,0.28); g.fillRoundedRect(x+4,y+3,w-8,Math.min(14,h*0.3),8);
    g.lineStyle(3,sh,0.9); g.strokeRoundedRect(x+1.5,y+1.5,w-3,h+1,15);
    btn.t.setColor(on?"#ffffff":"#f4f6f8"); btn.t.setStroke(WS.HEX(sh),4);
  }
  // small drawn-icon + number pair (replaces pasted-on ⚡ emoji). Icon is
  // right-anchored at x, number runs off to the right; roughly centres on x.
  iconNum(x,y,iconKey,val,size,color,fontSize){
    const ico=this.textures.exists(iconKey)?this.add.image(x,y,iconKey).setDisplaySize(size,size).setOrigin(1,0.5):null;
    const txt=this.add.text(x+3,y,""+val,{fontFamily:WS.FONT,fontSize:(fontSize||10)+"px",fontStyle:"bold",color:color||"#ffffff"}).setOrigin(0,0.5);
    return {ico,txt};
  }
  updateEnergy(){
    this.energyTxt.setText(this.freePower ? "FREE" : ""+this.energy);
    if(this.energyIcon) this.energyIcon.x = this.energyTxt.x - this.energyTxt.width - 4;
    this.powerBtns.forEach(b=>{
      // a banked free power makes EVERY power affordable, so they must all light up
      const on=this.freePower || this.energy>=b.p.cost;
      b.g.clear(); b.g.fillStyle(on?b.p.color:0xC9D0D6,1); b.g.fillRoundedRect(b.x,b.py,b.pw,b.ph,11);
      if(b.nt) b.nt.setAlpha(on?1:0.7);
      if(b.ico) b.ico.setAlpha(on?1:0.7);
      if(b.cbolt) b.cbolt.setAlpha(on?1:0.7);
      b.ct.setAlpha(on?1:0.7);
    });
  }
  usePower(p){
    if(this.over) return;
    // The daily chest can bank ONE free power (5% roll). It is spent on the next
    // power used, whatever it is, and it ignores the energy cost entirely.
    const free = !!this.freePower;
    if(!free && this.energy<p.cost) return;
    this.dropCarry();
    if(free){ this.freePower=false; this.toast("Free power — from the chest!"); }
    else     { this.energy-=p.cost; }
    this.beep(620,0.09,"triangle",0.05); WS.buzz(24);
    WS.Analytics.track("power_used",{ power:p.key, cost:free?0:p.cost });
    WS.goals.bump("power",1,g=>this.goalToast(g));
    if(p.key==="slow"){ this.slowUntil=this.time.now+8000; this.toast("Solid ground — the slide pauses!"); }
    else if(p.key==="shuffle"){
      this.tray.forEach(t=>{ if(t.ember) return;
        t.ch=BAG[Math.floor(this.rand()*BAG.length)]; t.txt.setText(t.ch.toUpperCase()); t.val.setText(""+VALUES[t.ch]);
        this.tweens.add({targets:t.cont,scaleX:0.6,duration:90,yoyo:true}); });
      this.toast("Tray re-rolled!"); this.refreshPreview();
    }
    else if(p.key==="vowels"){ this.vowelsNext=Math.max(0,3-(this.nextQ?this.nextQ.length:0));
      if(this.nextQ) this.nextQ=this.nextQ.map(()=>"aeiou"[Math.floor(this.rand()*5)]);
      this.paintNext(); this.toast("Vowels on the way!"); }
    else if(p.key==="purge"){
      const heavy={q:1,z:1,x:1,j:1};
      const out=this.tray.filter(t=>heavy[t.ch]);
      this.tray=this.tray.filter(t=>!heavy[t.ch]);
      out.forEach(t=>{ this.tweens.add({targets:t.cont,y:H+80,angle:180,alpha:0,duration:360,onComplete:()=>t.cont.destroy()}); });
      this.reflowTray(); this.toast(out.length?"Heavies purged!":"No Q/Z/X/J in tray");
    }
    else if(p.key==="golden"){ this.goldenNext=true; this.toast("Next word scores DOUBLE!"); this.refreshPreview(); }
    this.updateEnergy();
  }

  // ================= tutorial =================
  seedTutorialTray(){
    "slider".split("").concat(["o"]).forEach((ch,i)=>{
      this.time.delayedCall(150+i*220,()=>{
        const tile=this.makeLetterTile(ch,{});
        const sc=TILE/tile.T*1.1;
        tile.cont.setScale(sc);
        tile.cont.x=this.contXForCentre(CHANNEL_X,tile.T,sc); tile.cont.y=BOARD_TOP-70;
        this.dragLayer.add(tile.cont);
        this.tweens.add({targets:tile.cont,y:TRAY_Y-40,duration:340,ease:"Quad.easeIn",onComplete:()=>this.enterTray(tile)});
      });
    });
  }
  buildTutorial(){
    this.tutBox=this.add.container(0,0).setDepth(350);
    const g=this.add.graphics(); g.fillStyle(0x2B4257,0.95); g.fillRoundedRect(MARGIN,42,W-2*MARGIN,52,12); this.tutBox.add(g);
    this.tutTxt=this.add.text(W/2,68,"",{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:"#ffffff",align:"center",wordWrap:{width:W-2*MARGIN-80}}).setOrigin(0.5);
    this.tutBox.add(this.tutTxt);
    const sk=this.add.text(W-MARGIN-10,68,"Skip ›",{fontFamily:WS.FONT,fontSize:"11px",color:"#9fd8d5"}).setOrigin(1,0.5).setInteractive();
    sk.on("pointerup",()=>this.finishTutorial()); this.tutBox.add(sk);
    this.setTutStep(0);
  }
  setTutStep(n){
    if(!this.tut) return;
    this.tut.step=n;
    const msgs=[
      "Drag letters from your tray onto the board. Spell a word crossing the ★ (try SLIDE or RODES!)",
      "Great — now press  Play word  to score it!",
      "Letters keep tumbling down the left into your tray. When it overflows, letters fall off — lose "+this.allowed+" and you're buried. Reach "+WS.levelTarget(1)+" points to clear the level!",
    ];
    this.tutTxt.setText(msgs[n]);
    if(n===2){
      const go=this.add.text(W/2,BOARD_TOP+BOARD_H-60,"▶  Let's slide!",{fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:"#ffffff",backgroundColor:HEX(C.teal),padding:{x:20,y:9}}).setOrigin(0.5,0).setDepth(350).setInteractive();
      go.on("pointerup",()=>{ go.destroy(); this.finishTutorial(); });
      this.tutGo=go;
    }
  }
  finishTutorial(){
    if(!this.tut) return;
    this.tut=null; WS.store.set("tutorialDone",true);
    if(this.tutBox) this.tutBox.destroy();
    if(this.tutGo) this.tutGo.destroy();
    this.startRun(); this.toast("Here comes the slide!");
  }

  // ================= juice =================
  flyup(txt,x,y){
    const f=WS.shadow(this.add.text(x,y,txt,WS.T(30,"#FFF3DC",{strokeColor:WS.HEX(this.cfg.accentD),strokeWidth:6})).setOrigin(0.5).setDepth(320),3);
    this.tweens.add({targets:f,y:y-64,alpha:0,scale:1.2,duration:900,ease:"Cubic.easeOut",onComplete:()=>f.destroy()});
  }
  toast(msg){
    const t=this.add.text(W/2,BOARD_TOP+BOARD_H/2,msg,{fontFamily:WS.FONT,fontSize:"18px",fontStyle:"800",color:"#ffffff",backgroundColor:HEX(this.cfg.accentD),padding:{x:16,y:9},align:"center",wordWrap:{width:W-90}}).setOrigin(0.5).setDepth(380).setAlpha(0).setScale(0.7);
    this.tweens.add({targets:t,alpha:1,scale:1,duration:180,ease:"Back.easeOut"});
    this.tweens.add({targets:t,alpha:0,delay:1150,duration:200,onComplete:()=>t.destroy()});
  }
  // Wordscapes-style quality tiers — the bigger the word, the bigger the party
  praise(pts){
    const tier = pts>=100?["SPECTACULAR!",0xF2A33C,34,4]
               : pts>=70 ?["AMAZING!",0xF26C86,30,3]
               : pts>=45 ?["GREAT!",0x8E6FC1,27,2]
               : pts>=25 ?["NICE!",0x56C06A,24,1] : null;
    if(!tier) return;
    const [msg,col,size,n]=tier;
    const t=WS.shadow(this.add.text(W/2,BOARD_TOP+BOARD_H*0.4,msg,WS.T(size,"#FFF3DC",{strokeColor:WS.HEX(col),strokeWidth:Math.round(size*0.22)})).setOrigin(0.5).setDepth(390).setScale(0.3).setAlpha(0),3);
    this.tweens.add({targets:t,scale:1.15,alpha:1,duration:240,ease:"Back.easeOut"});
    this.tweens.add({targets:t,y:t.y-40,alpha:0,delay:750,duration:380,onComplete:()=>t.destroy()});
    if(n>=2) WS.Art.confetti(this,W/2,BOARD_TOP+BOARD_H*0.4,8*n);
    for(let i=0;i<n+1;i++) this.time.delayedCall(90*i,()=>this.beep(620+i*110,0.08,"triangle",0.05));
    if(n>=3) WS.Juice.impact(this, 0.5, false);
    WS.buzz(14+n*8);
  }
  goalToast(goal){ this.toast("Goal done: "+goal.txt+"  +"+WS.GOAL_XP+" XP"); this.beep(980,0.12,"triangle",0.05); }
  beep(f,d,type,v){ WS.Audio.sfx(f,d,type,v); }
  shutdownTimers(){ ["dropEvt","svc","boulderEvt","gustEvt","frostEvt","clockEvt"].forEach(k=>{ if(this[k]) this[k].remove(); }); this.running=false; }

  // ================= end of run =================
  endRun(reason){
    if(this.over) return; this.dropCarry(); this.over=true; this.running=false; this.shutdownTimers();
    WS.Audio.stopMusic();
    this.beep(reason==="time"?520:160,0.4,reason==="time"?"triangle":"sawtooth",0.06);

    let xpRes=null,isBest=false,daily=null;
    if(!this.counted){
      this.counted=true;
      WS.store.bumpStats({games:1,words:this.words,tiles:this.tilesPlayed,longest:this.best,topCombo:this.topCombo});
      WS.goals.bump("game",1,()=>{});
      WS.goals.bump("runScore",this.score,()=>{});
      xpRes=WS.addXP(this.score/10 + this.words*2);
      this.time.delayedCall(300,()=>WS.checkAchievements(a=>{ this.toast("Unlocked: "+a.name+"!  +"+WS.ACH_XP+" XP"); WS.Art.confetti(this,W/2,H*0.3,20); }));
      if(this.mode==="daily"){ daily=WS.store.playDaily(WS.todayKey(),this.score); }
      else if(this.mode==="classic"){ isBest=WS.store.setBest(this.cfg.key,this.score); WS.store.setBestLevel(this.cfg.key,this.level); }

      if(this.mode==="daily" && daily) WS.Analytics.track("daily_played",{ streak:daily.streak });
      if(this.mode==="duel") WS.Analytics.track("duel_played",{});
    }
    // OUTSIDE the counted guard: `counted` exists so XP/stats are granted once
    // per run, but a Second Wind resets `over` and the run can die AGAIN — and
    // that second (final) death used to emit nothing, so every continue-then-die
    // run vanished from the funnel. Each death is a real fail event; XP and
    // stats above still count exactly once.
    WS.Analytics.track("level_end",{
      world:this.cfg.key, level:this.level, mode:this.mode, result:"fail",
      score:this.score, words:this.words, lost:this.lost,
      duration_s: Math.round((Date.now()-(this.runStartedAt||Date.now()))/1000),
    });

    if(this.mode==="duel"){
      const go=()=>{
        if(this.duelPlayer===1) this.scene.start("duelmid",{world:this.cfg.key, seed:this.seed, p1Score:this.score});
        else this.scene.start("duelend",{world:this.cfg.key, p1:this.p1Score, p2:this.score});
      };
      this.time.delayedCall(600,go);
      this.toast(reason==="time"?"Time!":"Buried!");
      return;
    }
    WS.Ads.maybeInterstitial(this, ()=>this.showResults(reason,xpRes,isBest,daily));
  }

  showResults(reason,xpRes,isBest,daily){
    const ov=this.add.container(0,0).setDepth(400); this.resultsOv=ov;
    const sh=this.add.graphics(); sh.fillStyle(0x0d1426,0.7); sh.fillRect(0,0,W,H); ov.add(sh);
    const cardW=W-60,cardH=440,cx=30,cy=H/2-cardH/2;
    WS.Art.woodFrame(this,"card_res",cardW,cardH,22);
    ov.add(this.add.image(cx,cy,"card_res").setOrigin(0));
    const add=o=>{ ov.add(o); return o; };

    add(this.add.text(W/2,cy+30,reason==="time"?"Time!":"Buried!",{fontFamily:WS.FONT,fontSize:"30px",fontStyle:"bold",color:HEX(this.cfg.accentD)}).setOrigin(0.5));
    const sub=this.mode==="daily"
      ? ("Daily "+WS.todayKey()+(daily?("  ·  "+daily.streak+"-day streak"):""))
      : (this.cfg.name+"  ·  reached level "+this.level+(isBest?"  —  NEW BEST!":""));
    add(this.add.text(W/2,cy+64,sub,{fontFamily:WS.FONT,fontSize:"13px",fontStyle:"bold",color:HEX(C.teal)}).setOrigin(0.5));
    add(this.add.text(W/2,cy+110,""+this.score,{fontFamily:WS.FONT,fontSize:"50px",fontStyle:"bold",color:HEX(C.ink)}).setOrigin(0.5));
    add(this.add.text(W/2,cy+148,"points · "+this.words+" words",{fontFamily:WS.FONT,fontSize:"13px",color:HEX(C.mute)}).setOrigin(0.5));
    if(this.best) add(this.add.text(W/2,cy+172,"Best word: "+this.best+" ("+this.bestPts+")",{fontFamily:WS.FONT,fontSize:"13px",color:HEX(C.ink)}).setOrigin(0.5));

    if(xpRes){
      const info=WS.levelInfo(WS.store.get("xp",0));
      const bx=cx+40,bw2=cardW-80,byy=cy+214;
      add(this.add.text(bx,byy-16,"LEVEL "+info.level,{fontFamily:WS.FONT,fontSize:"11px",fontStyle:"bold",color:HEX(C.mute)}));
      add(this.add.text(bx+bw2,byy-16,info.into+" / "+info.need+" XP",{fontFamily:WS.FONT,fontSize:"11px",color:HEX(C.mute)}).setOrigin(1,0));
      const bg=this.add.graphics(); bg.fillStyle(0xE9EEF2,1); bg.fillRoundedRect(bx,byy,bw2,12,6);
      bg.fillStyle(C.teal,1); bg.fillRoundedRect(bx,byy,Math.max(10,bw2*info.into/info.need),12,6); add(bg);
      if(xpRes.leveled){ add(this.add.text(W/2,byy+30,"⬆ LEVEL UP!",{fontFamily:WS.FONT,fontSize:"16px",fontStyle:"bold",color:HEX(C.clay)}).setOrigin(0.5)); this.beep(880,0.15,"triangle",0.06); }
    }

    const bh=48,gap=10,bw=140;
    const mkBtn=(x,y,w2,fill,shadow,label,cb)=>{
      const bg=this.add.graphics();
      bg.fillStyle(0x000000,0.18); bg.fillRoundedRect(x+2,y+6,w2,bh,14);
      bg.fillStyle(shadow,1); bg.fillRoundedRect(x,y+4,w2,bh,14);
      bg.fillStyle(fill,1); bg.fillRoundedRect(x,y,w2,bh,14);
      bg.fillStyle(0xffffff,0.28); bg.fillRoundedRect(x+4,y+3,w2-8,12,7);
      bg.lineStyle(3,shadow,0.9); bg.strokeRoundedRect(x+1.5,y+1.5,w2-3,bh+1,13); add(bg);
      add(WS.shadow(this.add.text(x+w2/2,y+bh/2,label,WS.T(15,"#ffffff",{strokeColor:WS.HEX(shadow),strokeWidth:3})).setOrigin(0.5),2));
      const z=this.add.zone(x,y,w2,bh).setOrigin(0).setInteractive(); add(z); z.on("pointerup",cb);
    };
    /* ---- the offer -------------------------------------------------------
       Placed at the NEAR-MISS, which is where players actually spend: the pain
       of losing a level you were 80% through is what makes help worth buying.
       The same button at run start is a toll booth and converts badly.

       Two paths, always: an ad (free) and coins (paid). Never coins alone — a
       revive that can ONLY be bought reads as a wall, and the ad path is what
       makes the coin path feel like a convenience rather than a shakedown. */
    const rowY=cy+cardH-128;
    if(this.mode==="classic" && reason==="letters" && !this.secondWindUsed){
      const target = WS.levelTarget(this.level);
      const near   = WS.Econ.nearMiss(this.levelScore, target);
      const canAd  = WS.Ads.rewardedAvailable();
      const canBuy = WS.Econ.canAfford(WS.Econ.CONTINUE_COST);

      // Track EVERY time the offer is actually rendered, not only near-misses —
      // the button shows on both paths, and offer CTR computed against a
      // partial "shown" count is a lie.
      if (canAd || canBuy)
        WS.Analytics.track("offer_shown",{ offer:"continue", context:near?"near_miss":"results" });

      if (canAd){
        mkBtn(cx+30,rowY,cardW-60,C.gold,0xD9A32E,
          near ? "So close! Second Wind (ad)" : "Second Wind — reset the meter (ad)",
          ()=>{
            this.secondWindUsed=true;
            WS.Analytics.track("offer_accepted",{ offer:"continue", context:near?"near_miss":"results" });
            WS.Ads.showRewarded(this,
              ()=>this.secondWind(),
              ()=>this.toast("Ad didn't finish — no revive."));   // never grant on failure
          });
      } else if (canBuy){
        // Only offered when the ad path is genuinely unavailable, and only when
        // they can already afford it — dangling a price they cannot pay is just
        // an advert for the coin shop dressed up as a rescue.
        mkBtn(cx+30,rowY,cardW-60,C.gold,0xD9A32E,
          "Second Wind — "+WS.Econ.CONTINUE_COST+" coins",()=>{
            if (!WS.Econ.spend(WS.Econ.CONTINUE_COST,"continue")) return this.toast("Not enough coins.");
            this.secondWindUsed=true;
            WS.Analytics.track("offer_accepted",{ offer:"continue", context:"coins" });
            this.secondWind();
          });
      }
    }
    const by2=cy+cardH-66, tot=bw*2+gap, bx2=W/2-tot/2;
    mkBtn(bx2,by2,bw,C.teal,C.tealD,"Menu",()=>{ this.scene.start(this.mode==="classic"?"select":"home"); });
    if(this.mode==="daily") mkBtn(bx2+bw+gap,by2,bw,this.cfg.accent,this.cfg.accentD,"Share",()=>{
      const d=WS.store.daily();
      WS.share("Wordslide Daily "+WS.todayKey()+" ⛰️ "+this.score+" pts · "+this.words+" words · 🔥 "+d.streak+"-day streak. Spell fast, before it falls!");
      this.toast("Copied! Paste it anywhere.");
    });
    else mkBtn(bx2+bw+gap,by2,bw,this.cfg.accent,this.cfg.accentD,"Retry",()=>this.scene.restart({world:this.cfg.key,mode:this.mode}));
  }

  secondWind(){
    if(this.resultsOv) this.resultsOv.destroy();
    this.lost=0; this.updateMeter();
    this.over=false; this.running=true;
    this.slowUntil=this.time.now+5000;
    this.startRun();
    WS.Audio.startMusic(this.cfg.key);
    this.toast("Second wind! The slide holds for 5s");
    this.cameras.main.flash(200,255,247,210);
  }
};
})();

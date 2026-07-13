/* Wordslide — boot. Creates the Phaser game with all scenes. Reads window.WS. */
(function(){
"use strict";
const WS=window.WS;
const qs = new URLSearchParams(location.search);
// Asset loading is filename-driven and lives in assets.js (WS.Assets): every
// PNG under src/assets/** is queued here as texture "<basename>". Anything not
// shipped falls back to the procedural art in art.js, so the game always runs.
WS.PreloadScene = class extends Phaser.Scene {
  constructor(){ super("pre"); }
  preload(){
    const t=this.add.text(WS.W/2,WS.H/2,"Wordslide",{fontFamily:WS.FONT,fontSize:"34px",fontStyle:"800",color:"#ffffff"}).setOrigin(0.5);
    this.tweens.add({targets:t,alpha:0.4,duration:400,yoyo:true,repeat:-1});
    WS.Assets.queue(this);
    this.load.on('loaderror', f => console.warn('[assets] failed to load', f.key));
  }
  create(){
    // SVGART.loadAll skips any key already loaded as a PNG (toTexture guards on
    // textures.exists), so worlds without a PNG fall back to procedural art.
    WS.SVGART.loadAll(this).then(()=>{
      // TEST ACCESS via URL, for trialling without clicking through menus:
      //   ?test=1                    unlock every world
      //   ?world=volcano&level=6     boot straight into that world at that level
      if(qs.has("test")) WS.store.set("unlockAll", true);
      const w=qs.get("world");
      if(w && WS.WORLDS[w]){
        WS.store.set("unlockAll", true);        // a direct link implies test intent
        return this.scene.start("game",{
          world:w, mode:qs.get("mode")||"classic",
          startLevel: parseInt(qs.get("level"),10)||1,
        });
      }
      this.scene.start("home");
    });
  }
};
const config = {
  type: qs.has("canvas") ? Phaser.CANVAS : Phaser.AUTO,
  width: WS.W, height: WS.H,
  backgroundColor: "#8FD6EC",
  parent: "game-root",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Tiles are authored at 256px and drawn as small as ~28px while tumbling.
  // Without mipmaps that minification aliases into a pixelated mess. Textures are
  // power-of-two so WebGL can generate the chain.
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR', antialias: true, roundPixels: false },
  scene: [WS.PreloadScene, WS.HomeScene, WS.SelectScene, WS.GameScene,
          WS.SettingsScene, WS.StatsScene, WS.DailyScene,
          WS.DuelScene, WS.DuelMidScene, WS.DuelEndScene, WS.PauseScene,
          WS.ShopScene, WS.DiagScene]
};
let booted=false;
function go(){ if(booted) return; booted=true; window.WSGAME = new Phaser.Game(config); }
function start(){
  setTimeout(go,2500);                                  // never block on fonts
  try{
    if(document.fonts&&document.fonts.ready){
      Promise.all([document.fonts.load('800 20px "Baloo 2"'),document.fonts.load('600 20px "Baloo 2"')])
        .then(()=>document.fonts.ready).then(go,go);
    } else go();
  }catch(e){ go(); }
}
if(document.readyState==="complete") start();
else window.addEventListener("load", start);
})();

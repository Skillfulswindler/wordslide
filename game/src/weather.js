/* Wordslide — WS.Weather: per-world ambient motion + the level-entry sweep.
   ---------------------------------------------------------------------------
   Replaces the old `this.ambient` Graphics loop, which re-drew 24 shapes into a
   Graphics object EVERY FRAME (Phaser re-tessellates Graphics each frame — the
   exact pattern that tanked framerate before). This uses real particle emitters
   over baked textures instead: GPU-cheap, and it can actually look like weather.

   Two jobs:
     start(scene, world)  continuous ambient motion — snow, embers, rain, sand…
     sweep(scene, world)  a one-shot gust across the board, used to reveal it.
   --------------------------------------------------------------------------- */
(function(){
"use strict";
const WS=window.WS;
const {W,H,BOARD_TOP,BOARD_H}=WS;

/* baked particle textures (once per scene) */
function textures(scene){
  const mk=(key,draw,w,h)=>{
    if(scene.textures.exists(key)) return;
    const g=scene.make.graphics({add:false});
    draw(g); g.generateTexture(key,w,h); g.destroy();
  };
  mk('p_dot', g=>{ for(let i=6;i>0;i--){ g.fillStyle(0xffffff, 0.16); g.fillCircle(8,8,i*1.4); } g.fillStyle(0xffffff,1); g.fillCircle(8,8,3); },16,16);
  mk('p_flake',g=>{ g.fillStyle(0xffffff,1); g.fillCircle(6,6,3.2); g.fillStyle(0xffffff,0.45); g.fillCircle(6,6,6); },12,12);
  mk('p_streak',g=>{ g.fillStyle(0xffffff,1); g.fillRoundedRect(0,0,22,3,1.5); },22,3);
  mk('p_drop', g=>{ g.fillStyle(0xffffff,1); g.fillRoundedRect(0,0,2.5,12,1.2); },3,12);
}

/* ---- per-world recipes. tint + motion do all the characterisation work ---- */
const RECIPE = {
  // heavy warm rain, falling fast and slightly angled
  mudslide:{ tex:'p_drop', tint:0xCFE6F2, alpha:[0.25,0.6], n:70, life:1500,
             vx:[-40,-10], vy:[420,560], scale:[0.7,1.3], from:'top' },
  // dry dust motes drifting on a thermal
  landslide:{ tex:'p_dot', tint:0xE0C89A, alpha:[0.10,0.34], n:34, life:6500,
              vx:[8,34], vy:[-14,10], scale:[0.25,0.7], from:'all', rot:[-20,20] },
  // fat snow, drifting down
  avalanche:{ tex:'p_flake', tint:0xFFFFFF, alpha:[0.45,0.95], n:60, life:7000,
              vx:[-22,22], vy:[26,64], scale:[0.4,1.1], from:'top', sway:true },
  // embers RISING off the lava — the only world where particles go up
  volcano:{ tex:'p_dot', tint:0xFF9A3A, alpha:[0.35,0.95], n:46, life:3800,
            vx:[-26,26], vy:[-120,-46], scale:[0.25,0.75], from:'bottom', sway:true, glow:true },
  // driving sand, near-horizontal
  sandstorm:{ tex:'p_streak', tint:0xEBCE8E, alpha:[0.16,0.5], n:48, life:2600,
              vx:[210,340], vy:[6,34], scale:[0.5,1.5], from:'left' },
  // fine mist rising off the plunge pool + spray
  waterfall:{ tex:'p_dot', tint:0xEAFBFF, alpha:[0.16,0.5], n:40, life:4200,
              vx:[-20,20], vy:[-56,-18], scale:[0.4,1.2], from:'bottom', sway:true },
  // a white-out: fast, near-horizontal, dense
  blizzard:{ tex:'p_flake', tint:0xFFFFFF, alpha:[0.4,0.95], n:90, life:2600,
             vx:[-300,-160], vy:[30,90], scale:[0.35,1.0], from:'right' },
  // lazy leaves
  home:{ tex:'p_dot', tint:0x9BEA52, alpha:[0.25,0.6], n:22, life:8000,
         vx:[-18,18], vy:[18,40], scale:[0.3,0.7], from:'top', sway:true, rot:[-90,90] },
};

function zone(from){
  const R=Phaser.Geom.Rectangle;
  if(from==='top')    return new R(-20, -40, W+40, 40);
  if(from==='bottom') return new R(-20, H-10, W+40, 60);
  if(from==='left')   return new R(-60, 0, 50, H);
  if(from==='right')  return new R(W+10, 0, 50, H);
  return new R(-20,-20,W+40,H+40);
}

WS.Weather = {
  RECIPE,

  /** continuous ambient motion for a world. Returns the emitter (or null). */
  start(scene, world, opts){
    opts=opts||{};
    textures(scene);
    const r=RECIPE[world];
    if(!r) return null;
    this.stop(scene);
    const em = scene.add.particles(0,0,r.tex,{
      lifespan:{min:r.life*0.6, max:r.life},
      speedX:{min:r.vx[0], max:r.vx[1]},
      speedY:{min:r.vy[0], max:r.vy[1]},
      scale:{min:r.scale[0], max:r.scale[1]},
      alpha:{min:r.alpha[0], max:r.alpha[1]},
      rotate: r.rot ? {min:r.rot[0], max:r.rot[1]} : 0,
      tint:r.tint,
      quantity:1,
      frequency: Math.max(14, Math.round(r.life / r.n)),
      emitZone:{type:'random', source:zone(r.from)},
      blendMode: r.glow ? 'ADD' : 'NORMAL',
    });
    em.setDepth(opts.depth!=null?opts.depth:8);
    // a gentle sideways sway, so nothing falls in a dead straight line
    if(r.sway) em.addBehavior && null;
    scene._wx = em;
    // pre-warm so the screen isn't empty for the first second
    em.emitParticle(Math.round(r.n*0.6));
    return em;
  },

  stop(scene){ if(scene._wx){ scene._wx.destroy(); scene._wx=null; } },

  /** ONE-SHOT gust across the board — the thing that "blows the board in".
      Returns roughly how long it lasts, so the caller can time the reveal. */
  sweep(scene, world, opts){
    opts=opts||{};
    textures(scene);
    const r=RECIPE[world]||RECIPE.home;
    const dur=opts.duration||900;
    // direction: sand/blizzard blow sideways, everything else falls/rises
    const lateral = (r.from==='left'||r.from==='right');
    const src = lateral
      ? new Phaser.Geom.Rectangle(r.from==='left'?-80:W+20, BOARD_TOP-60, 60, BOARD_H+140)
      : new Phaser.Geom.Rectangle(-30, r.from==='bottom'?H-20:-60, W+60, 60);
    const bx = lateral ? (r.from==='left'? 700: -700) : 0;
    const by = lateral ? 40 : (r.from==='bottom' ? -820 : 900);
    const em = scene.add.particles(0,0,r.tex,{
      lifespan:{min:dur*0.7, max:dur*1.25},
      speedX: lateral ? {min:bx*0.7, max:bx} : {min:-90, max:90},
      speedY: lateral ? {min:0, max:by} : {min:by*0.7, max:by},
      scale:{min:r.scale[0]*1.3, max:r.scale[1]*2.4},
      alpha:{start:1, end:0},
      rotate: r.rot ? {min:-90,max:90} : 0,
      tint:r.tint,
      quantity:0,
      emitZone:{type:'random', source:src},
      blendMode: r.glow ? 'ADD' : 'NORMAL',
    }).setDepth(opts.depth!=null?opts.depth:24);
    em.emitParticle(opts.count||150);
    scene.time.delayedCall(dur*1.6, ()=>em.destroy());
    return dur;
  },
};
})();

/* Wordslide — WS.Juice: the motion layer.
   ---------------------------------------------------------------------------
   The half of "looks expensive" that isn't art. Every player-facing action gets
   weight (squash/stretch), overshoot (Back easing), and a reaction (spark, pop,
   shake). Uses shipped FX sprites (assets/fx/*.png) when present, else cheap
   procedural shapes — so this works before any art lands.
   --------------------------------------------------------------------------- */
(function(){
"use strict";
const WS=window.WS;

// Easing vocabulary — used everywhere so motion feels like one hand made it.
const E = {
  land:  "Back.easeOut",     // something arriving and settling
  snap:  "Quint.easeOut",    // something moving fast then stopping hard
  pop:   "Back.easeOut",     // something growing into view
  fall:  "Quad.easeIn",      // something leaving under gravity
  drift: "Sine.easeInOut",   // idle / ambient
};

WS.Juice = {
  E,

  /** A tile lands on the board: overshoot in, squash flat, spring back. */
  land(scene, cont, sc, cb){
    scene.tweens.chain({
      targets: cont,
      tweens: [
        { scaleX:sc*1.18, scaleY:sc*0.82, duration:90,  ease:"Quad.easeOut" },  // squash on impact
        { scaleX:sc*0.94, scaleY:sc*1.08, duration:80,  ease:"Quad.easeInOut" },// rebound
        { scaleX:sc,      scaleY:sc,      duration:110, ease:E.land },          // settle
      ],
      onComplete: cb || null,
    });
  },

  /** A tile pops into existence (tray refill, tumble arrival). */
  spawn(scene, cont, sc, delay){
    cont.setScale(sc*0.4); cont.setAlpha(0);
    scene.tweens.add({
      targets:cont, scaleX:sc, scaleY:sc, alpha:1,
      duration:280, delay:delay||0, ease:E.pop,
    });
  },

  /** Word submitted: tiles pop left-to-right in a wave, each throwing a spark.
      Staggering is the whole trick — simultaneous pops read as a glitch, a
      120ms-apart wave reads as a chain reaction. */
  wordWave(scene, cells, sc, opts){
    opts=opts||{};
    const sorted = cells.slice().sort((a,b)=> (a.r-b.r)||(a.c-b.c) );
    const step = opts.step || 55;
    sorted.forEach((t,i)=>{
      const s = (typeof sc==='function') ? sc(t) : sc;
      scene.time.delayedCall(i*step, ()=>{
        if(!t.cont || !t.cont.scene) return;
        scene.tweens.chain({ targets:t.cont, tweens:[
          { scaleX:s*1.30, scaleY:s*1.30, duration:100, ease:"Quad.easeOut" },
          { scaleX:s,      scaleY:s,      duration:160, ease:E.land },
        ]});
        this.sparks(scene, t.cont.x + (opts.half||0), t.cont.y + (opts.half||0), 5, opts.color);
      });
    });
    return sorted.length * step;
  },

  /** Small radial spark burst. Uses fx_spark.png if shipped. */
  sparks(scene, x, y, n, color){
    n = n||6;
    const useTex = WS.Assets && WS.Assets.has(scene,'fx_spark');
    for(let i=0;i<n;i++){
      const a = (Math.PI*2*i/n) + Math.random()*0.5;
      const d = 16 + Math.random()*22;
      const p = useTex
        ? scene.add.image(x,y,'fx_spark').setDisplaySize(12,12).setDepth(400)
        : scene.add.circle(x,y,3+Math.random()*2, color||0xFFD98A).setDepth(400);
      scene.tweens.add({
        targets:p, x:x+Math.cos(a)*d, y:y+Math.sin(a)*d,
        scaleX:0.1, scaleY:0.1, alpha:0,
        duration:280+Math.random()*180, ease:"Quad.easeOut",
        onComplete:()=>p.destroy(),
      });
    }
  },

  /** Scaled screen impact. `power` 0..1 — keep it under 0.5 for routine events;
      full shake on every word is exhausting to play. */
  impact(scene, power, flash){
    const p = Math.max(0, Math.min(1, power));
    scene.cameras.main.shake(90 + p*140, 0.002 + p*0.005);
    if(flash) scene.cameras.main.flash(80 + p*60, 255, 247, 210);
  },

  /** Button/HUD number ticking up — reads as reward, not as a value change. */
  countTo(scene, txt, from, to, prefix, ms){
    const o={v:from};
    scene.tweens.add({targets:o, v:to, duration:ms||420, ease:"Cubic.easeOut",
      onUpdate:()=>txt.setText((prefix||"")+Math.round(o.v)),
      onComplete:()=>txt.setText((prefix||"")+to)});
    scene.tweens.chain({targets:txt, tweens:[
      {scaleX:1.25, scaleY:1.25, duration:110, ease:"Quad.easeOut"},
      {scaleX:1, scaleY:1, duration:180, ease:E.land},
    ]});
  },
};
})();

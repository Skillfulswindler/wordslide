/* Wordslide — WS.Audio: WebAudio SFX + light generative background music.
   No audio assets: everything is synthesized, so the bundle stays tiny and
   nothing needs licensing. Respects WS.store.settings().music / .sfx. */
(function(){
"use strict";
const WS=window.WS;

// music "moods" per world (pentatonic-ish note sets as frequencies)
const N = m => 440*Math.pow(2,(m-69)/12);   // midi -> Hz
const MOODS = {
  home:     { notes:[60,62,65,67,69,72,74].map(N), beat:520, wave:"triangle", bass:[36,43].map(N), vol:0.030 },
  mudslide: { notes:[57,60,62,64,67,69].map(N),    beat:560, wave:"triangle", bass:[33,40].map(N), vol:0.030 },
  landslide:{ notes:[55,58,60,62,65,67].map(N),    beat:500, wave:"triangle", bass:[31,38].map(N), vol:0.028 },
  avalanche:{ notes:[62,64,67,69,71,74].map(N),    beat:460, wave:"sine",     bass:[38,45].map(N), vol:0.028 },
  sandstorm:{ notes:[59,62,63,66,67,70].map(N),    beat:420, wave:"triangle", bass:[35,42].map(N), vol:0.024 },
  volcano:  { notes:[57,60,62,63,67,68].map(N),    beat:380, wave:"sawtooth", bass:[33,36].map(N), vol:0.020 },
  waterfall:{ notes:[60,62,64,67,69,72].map(N),    beat:300, wave:"sine",     bass:[36,43].map(N), vol:0.026 },
  blizzard: { notes:[69,72,74,76,79,81].map(N),    beat:640, wave:"sine",     bass:[45,52].map(N), vol:0.024 },
};

WS.Audio = {
  ctx:null, musicTimer:null, mood:null, step:0, lastNote:0,

  _ac(){
    if(!this.ctx){
      try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
    }
    if(this.ctx && this.ctx.state==="suspended"){ try{ this.ctx.resume(); }catch(e){} }
    return this.ctx;
  },

  // ---------- SFX ----------
  sfx(f,d,type,v){
    if(!WS.store.settings().sfx) return;
    const ac=this._ac(); if(!ac) return;
    try{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type=type||"sine"; o.frequency.value=f; g.gain.value=v||0.05;
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime+d);
      g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+d);
    }catch(e){}
  },
  chord(fs,d,type,v){ fs.forEach((f,i)=>setTimeout(()=>this.sfx(f,d,type,v),i*60)); },

  // ---------- music ----------
  startMusic(worldKey){
    this.stopMusic();
    if(!WS.store.settings().music) return;
    const ac=this._ac(); if(!ac) return;
    this.mood=MOODS[worldKey]||MOODS.home; this.step=0;
    const play=()=>{
      if(!WS.store.settings().music){ this.stopMusic(); return; }
      const m=this.mood;
      // melody: gentle random walk over the note set, resting sometimes
      if(Math.random()<0.78){
        let i=this.lastNote + Math.floor(Math.random()*3)-1;
        i=(i+m.notes.length)%m.notes.length; this.lastNote=i;
        this._note(m.notes[i], m.beat/1000*1.7, m.wave, m.vol);
      }
      // bass every 4 steps
      if(this.step%4===0) this._note(m.bass[(this.step/4)%m.bass.length], m.beat/1000*3.2, "sine", m.vol*1.15);
      this.step++;
    };
    this.musicTimer=setInterval(play, this.mood.beat);
  },
  stopMusic(){ if(this.musicTimer){ clearInterval(this.musicTimer); this.musicTimer=null; } },
  _note(f,d,type,v){
    const ac=this._ac(); if(!ac) return;
    try{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type=type; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,ac.currentTime);
      g.gain.exponentialRampToValueAtTime(v,ac.currentTime+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+d);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime+d+0.05);
    }catch(e){}
  },
};
})();

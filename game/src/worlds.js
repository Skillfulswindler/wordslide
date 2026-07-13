/* Wordslide — shared config: dictionary, letters, board bonus layout, world
   definitions, power-ups, palette, persistence, progression (XP/goals/unlocks),
   seeded RNG. Attaches everything to window.WS. Expects global `WORDLIST`. */
(function(){
"use strict";
const WS = (window.WS = window.WS || {});

WS.VERSION = "2.5.0";   // keep in lockstep with package.json — this string is shown on the Home screen

WS.DICT = new Set((window.WORDLIST||"").split(" "));
WS.VALUES = {a:1,e:1,i:1,o:1,u:1,l:1,n:1,s:1,t:1,r:1,d:2,g:2,b:3,c:3,m:3,p:3,f:4,h:4,v:4,w:4,y:4,k:5,j:8,x:8,q:10,z:10};
WS.FREQ = {a:9,b:2,c:2,d:4,e:12,f:2,g:3,h:2,i:9,j:1,k:1,l:4,m:2,n:6,o:8,p:2,q:1,r:6,s:4,t:6,u:4,v:2,w:2,x:1,y:2,z:1};
WS.VOWELS = {a:1,e:1,i:1,o:1,u:1};
WS.BAG = []; for(const c in WS.FREQ){ for(let i=0;i<WS.FREQ[c];i++) WS.BAG.push(c); }

WS.HEX = n => "#"+(n>>>0).toString(16).padStart(6,"0").slice(-6);

// ---- typography (Baloo 2, bundled via @fontsource) ----
WS.FONT = '"Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif';
// chunky outlined game text style
WS.T = function(size, color, opts){
  opts = opts || {};
  const st = {
    fontFamily: WS.FONT,
    fontSize: size + "px",
    fontStyle: opts.weight || "800",
    color: (typeof color === "number") ? WS.HEX(color) : (color || "#ffffff"),
  };
  if (opts.stroke !== false && size >= 15) {
    st.stroke = opts.strokeColor || "#3A2A1A";
    st.strokeThickness = opts.strokeWidth != null ? opts.strokeWidth : Math.max(3, Math.round(size * 0.14));
  }
  if (opts.wrap) st.wordWrap = { width: opts.wrap };
  if (opts.align) st.align = opts.align;
  if (opts.lineSpacing) st.lineSpacing = opts.lineSpacing;
  return st;
};
// apply a soft drop shadow to any text object
WS.shadow = function(t, d){ t.setShadow(0, d==null?3:d, "rgba(40,20,0,0.35)", 4); return t; };

// ---- seeded RNG (mulberry32) + string hash — for daily / duel letter streams ----
WS.mulberry32 = function(seed){
  let a = seed>>>0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a>>>15), 1 | a);
    t = (t + Math.imul(t ^ (t>>>7), 61 | t)) ^ t;
    return ((t ^ (t>>>14)) >>> 0) / 4294967296;
  };
};
WS.hashStr = function(s){
  let h = 2166136261;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h>>>0;
};
WS.todayKey = function(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
};

// ---- board bonus squares (ON the board, like WWF/Scrabble — but an ORIGINAL
// symmetric layout, deliberately not a copy of either game's arrangement).
// Types: DL/TL multiply the letter placed on them; DW/TW multiply the word.
// Center ★ doubles the first word. GOLD is a rare bonus that rides on LETTERS.
WS.SQ = {
  DL:{key:"DL", lm:2, wm:1, tag:"2L", fill:0x2E8FC8, ink:0x0C447C, shape:"circle"},
  TL:{key:"TL", lm:3, wm:1, tag:"3L", fill:0x57B646, ink:0x173404, shape:"triangle"},
  DW:{key:"DW", lm:1, wm:2, tag:"2W", fill:0xF0881E, ink:0x4B1528, shape:"square"},
  TW:{key:"TW", lm:1, wm:3, tag:"3W", fill:0xCE2A22, ink:0x412402, shape:"diamond"},
  ST:{key:"ST", lm:1, wm:2, tag:"★",  fill:0xCE2A22, ink:0x6B4708, shape:null},
};
// colorblind-safe fills (Okabe–Ito derived), swapped in when the setting is on
WS.SQ_CB = { DL:0x56B4E9, TL:0x009E73, DW:0xCC79A7, TW:0xE69F00, ST:0xF0E442 };

// quadrant generator entries [r,c,key] mirrored 4 ways around the center (7,7)
const QUAD = [
  [1,5,"TW"],[5,1,"TW"],
  [0,0,"DW"],[3,3,"DW"],[6,6,"DW"],
  [2,7,"TL"],[6,5,"TL"],[5,3,"TL"],
  [0,7,"DL"],[1,1,"DL"],[4,6,"DL"],[7,4,"DL"],[3,0,"DL"],[6,2,"DL"],
];
WS.BOARD_BONUS = {};
QUAD.forEach(([r,c,k])=>{
  [[r,c],[r,14-c],[14-r,c],[14-r,14-c]].forEach(([rr,cc])=>{ WS.BOARD_BONUS[rr+","+cc]=k; });
});
WS.BOARD_BONUS["7,7"]="ST";
WS.sqAt = (r,c)=>{ const k=WS.BOARD_BONUS[r+","+c]; return k?WS.SQ[k]:null; };

// golden letters (2× letter value, ride on the tile itself)
WS.GOLD_CHANCE = 0.06;

/* The layout constants (W, H, CELL, BOARD_TOP, TRAY_Y, SAFE, ...) are solved in
   src/layout.js, which main.js imports BEFORE this file. They are deliberately
   NOT defined here as well: two places computing the same geometry is exactly
   how a board ends up 28px wide on one screen and 26px on another with no way to
   tell which is right. One definition, one source of truth.

   See layout.js for the reasoning (notch handling, bottom-anchored stack) and
   test/layout.test.mjs for the device-matrix invariants. */

WS.C = {
  ink:0x233A4F, mute:0x7C8A99, clay:0xE0561F, clayD:0xB8420F,
  teal:0x0FB8B0, tealD:0x0A928A, gold:0xFFC336, cream:0xFFF7E8, white:0xFFFFFF,
  selOutline:0x0FB8B0, danger:0xE24B4A,
  tile:0xECC25A, tileInk:0x4A2E14, tileShadow:0xC99A3E, boardCell:0xEDF3F7
};

// Levels (levelTarget / allowedLosses) and the WORLDS table live in src/tuning.js,
// which main.js loads BEFORE this file. All the balance knobs are in that one
// place so they can be tuned — and modelled by tools/pacing.mjs — without anyone
// having to go hunting through here. One definition, one source of truth.

WS.isUnlocked = function(key){
  const i = WS.WORLD_ORDER.indexOf(key);
  if(i<=0) return true;
  const prev = WS.WORLD_ORDER[i-1];
  return WS.store.best(prev) >= WS.WORLDS[key].unlock || !WS.isLockEnabled();
};
WS.isLockEnabled = function(){ return !WS.store.get("unlockAll", false); };

// ---- power-ups ----
WS.POWERS = [
  { key:"slow",    name:"Slow",    cost:18, color:0x56C06A, desc:"Pause the slide for 8s" },
  { key:"shuffle", name:"Shuffle", cost:14, color:0x5BB7E6, desc:"Re-roll your tray letters" },
  { key:"vowels",  name:"Vowels",  cost:12, color:0xFBC85A, desc:"Next 3 letters are vowels" },
  { key:"purge",   name:"Purge",   cost:10, color:0x8E6FC1, desc:"Remove Q Z X J from tray" },
  { key:"golden",  name:"Golden",  cost:26, color:0xC75B33, desc:"Next word scores 2×" },
];

// ---- persistence ----
WS.store = {
  _read(){ try{ return JSON.parse(localStorage.getItem("wordslide_save")||"{}"); }catch(e){ return {}; } },
  _write(o){ try{ localStorage.setItem("wordslide_save", JSON.stringify(o)); }catch(e){} },
  get(k,dflt){ const s=this._read(); return (k in s)? s[k] : dflt; },
  set(k,v){ const s=this._read(); s[k]=v; this._write(s); },
  reset(){ try{ localStorage.removeItem("wordslide_save"); }catch(e){} },

  best(world){ const s=this._read(); return (s.best&&s.best[world])||0; },
  setBest(world,score){ const s=this._read(); s.best=s.best||{}; if(score>(s.best[world]||0)){ s.best[world]=score; this._write(s); return true; } return false; },
  bestLevel(world){ const s=this._read(); return (s.bestLevel&&s.bestLevel[world])||0; },
  setBestLevel(world,l){ const s=this._read(); s.bestLevel=s.bestLevel||{}; if(l>(s.bestLevel[world]||0)){ s.bestLevel[world]=l; this._write(s); } },
  bestWord(){ const s=this._read(); return s.bestWord||{w:"",p:0}; },
  setBestWord(w,p){ const s=this._read(); const b=s.bestWord||{w:"",p:0}; if(p>b.p){ s.bestWord={w:w,p:p}; this._write(s); } },
  totalBest(){ const s=this._read(); let m=0; if(s.best) for(const k in s.best) m=Math.max(m,s.best[k]); return m; },

  settings(){ const s=this._read(); return Object.assign({music:true,sfx:true,haptics:true,colorblind:false}, s.settings||{}); },
  setSetting(k,v){ const s=this._read(); s.settings=Object.assign(this.settings(),s.settings||{}); s.settings[k]=v; this._write(s); },

  stats(){ const s=this._read(); return Object.assign({games:0,words:0,tiles:0,longest:"",topCombo:0}, s.stats||{}); },
  bumpStats(d){ const s=this._read(); const st=Object.assign({games:0,words:0,tiles:0,longest:"",topCombo:0}, s.stats||{});
    st.games+=d.games||0; st.words+=d.words||0; st.tiles+=d.tiles||0;
    if(d.longest && d.longest.length>st.longest.length) st.longest=d.longest;
    if((d.topCombo||0)>st.topCombo) st.topCombo=d.topCombo;
    s.stats=st; this._write(s); },

  daily(){ const s=this._read(); return Object.assign({last:"",streak:0,bestStreak:0,best:{}}, s.daily||{}); },
  playDaily(dateKey,score){
    const s=this._read(); const d=Object.assign({last:"",streak:0,bestStreak:0,best:{}}, s.daily||{});
    if(d.last!==dateKey){
      const y=new Date(); y.setDate(y.getDate()-1);
      const yKey=y.getFullYear()+"-"+String(y.getMonth()+1).padStart(2,"0")+"-"+String(y.getDate()).padStart(2,"0");
      d.streak = (d.last===yKey)? d.streak+1 : 1;
      d.bestStreak=Math.max(d.bestStreak,d.streak); d.last=dateKey;
    }
    if(score>(d.best[dateKey]||0)) d.best[dateKey]=score;
    const keys=Object.keys(d.best).sort(); while(keys.length>30) delete d.best[keys.shift()];
    s.daily=d; this._write(s); return d;
  },

  duel(){ const s=this._read(); return Object.assign({p1:0,p2:0,ties:0}, s.duel||{}); },
  bumpDuel(k){ const s=this._read(); const d=Object.assign({p1:0,p2:0,ties:0}, s.duel||{}); d[k]++; s.duel=d; this._write(s); },
};

// ---- XP / player level ----
WS.levelInfo = function(xp){
  let l=1, rem=xp, need=250;
  while(rem>=need){ rem-=need; l++; need=250+(l-1)*150; }
  return {level:l, into:rem, need:need};
};
WS.addXP = function(n){
  const before=WS.levelInfo(WS.store.get("xp",0)).level;
  const xp=WS.store.get("xp",0)+Math.max(0,Math.round(n));
  WS.store.set("xp",xp);
  const after=WS.levelInfo(xp).level;
  return {before:before, after:after, leveled:after>before};
};

// ---- daily goals (3 per day from a pool, seeded by date) ----
WS.GOALPOOL = [
  {id:"words12", txt:"Play 12 words",             target:12,  ev:"word"},
  {id:"score300",txt:"Score 300 in one run",      target:300, ev:"runScore"},
  {id:"len5",    txt:"Play a 5+ letter word",     target:1,   ev:"longword"},
  {id:"combo4",  txt:"Reach a 4× combo",          target:4,   ev:"combo"},
  {id:"bonus5",  txt:"Cover 5 bonus squares",     target:5,   ev:"bonus"},
  {id:"power2",  txt:"Use 2 powers",              target:2,   ev:"power"},
  {id:"games3",  txt:"Finish 3 runs",             target:3,   ev:"game"},
  {id:"tiles30", txt:"Play 30 letters",           target:30,  ev:"tiles"},
  {id:"level3",  txt:"Reach level 3 in a run",    target:3,   ev:"level"},
];
WS.GOAL_XP = 60;
WS.goals = {
  today(){
    const date=WS.todayKey();
    let g=WS.store.get("goals",null);
    if(!g || g.date!==date){
      const rand=WS.mulberry32(WS.hashStr("goals:"+date));
      const pool=WS.GOALPOOL.slice();
      const pick=[];
      while(pick.length<3){ pick.push(pool.splice(Math.floor(rand()*pool.length),1)[0]); }
      g={date:date, ids:pick.map(p=>p.id), prog:[0,0,0], done:[false,false,false]};
      WS.store.set("goals",g);
    }
    g.list=g.ids.map(id=>WS.GOALPOOL.find(p=>p.id===id));
    return g;
  },
  bump(ev, amt, onComplete){
    const g=this.today(); let changed=false;
    g.list.forEach((goal,i)=>{
      if(g.done[i] || goal.ev!==ev) return;
      if(ev==="combo"||ev==="runScore"||ev==="level") g.prog[i]=Math.max(g.prog[i],amt);
      else g.prog[i]+=amt;
      changed=true;
      if(g.prog[i]>=goal.target){ g.done[i]=true; WS.addXP(WS.GOAL_XP); if(onComplete) onComplete(goal); }
    });
    if(changed) WS.store.set("goals",{date:g.date,ids:g.ids,prog:g.prog,done:g.done});
  },
};

// ---- achievements (local, XP-rewarded) ----
WS.ACH=[
  {id:"first",   name:"First Slide",    desc:"Play your first word",          test:st=>st.words>=1},
  {id:"words50", name:"Wordsmith",      desc:"Play 50 words lifetime",        test:st=>st.words>=50},
  {id:"words250",name:"Lexicon Legend", desc:"Play 250 words lifetime",       test:st=>st.words>=250},
  {id:"long7",   name:"Seven Wonders",  desc:"Play a 7-letter word",          test:st=>st.longest.length>=7},
  {id:"combo6",  name:"On Fire",        desc:"Reach a 6× combo",              test:st=>st.topCombo>=6},
  {id:"level5",  name:"Mountaineer",    desc:"Reach level 5 in a run",        test:(st,S)=>{let m=0; WS.WORLD_ORDER.forEach(k=>m=Math.max(m,S.bestLevel(k))); return m>=5;}},
  {id:"streak3", name:"Daily Devotion", desc:"3-day daily streak",            test:(st,S)=>S.daily().bestStreak>=3},
  {id:"score800",name:"Landslide!",     desc:"Score 800 in one run",          test:(st,S)=>S.totalBest()>=800},
];
WS.ACH_XP=80;
WS.checkAchievements=function(onEarn){
  const earned=WS.store.get("ach",{});
  const st=WS.store.stats();
  const fresh=[];
  WS.ACH.forEach(a=>{
    if(earned[a.id]) return;
    try{ if(a.test(st,WS.store)){ earned[a.id]=true; fresh.push(a); WS.addXP(WS.ACH_XP); } }catch(e){}
  });
  if(fresh.length){
    WS.store.set("ach",earned);
    // achievements are a coin faucet too — they are the reward for the kind of
    // play we want more of, so they should pay in the currency that matters
    if(WS.Econ) WS.Econ.grant(WS.Econ.ACH_REWARD * fresh.length, "achievement");
    if(onEarn) fresh.forEach(onEarn);
  }
  return fresh;
};

// ---- external links + legal ----
// Both stores require a reachable privacy-policy URL, and it must be linked from
// inside the app as well as from the store listing.
// Live on GitHub Pages from the docs/ folder of Skillfulswindler/wordslide.
// The Pages HOSTNAME is lowercase even though the GitHub login is capitalised —
// getting that wrong is a silent 404 on the one link a store reviewer clicks.
WS.PRIVACY_URL = "https://skillfulswindler.github.io/wordslide/privacy.html";
WS.TERMS_URL   = "https://skillfulswindler.github.io/wordslide/terms.html";
WS.SUPPORT_EMAIL = "nick.potter.one@gmail.com";
WS.openURL = function(url){
  try{
    const B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (B && B.open) return B.open({ url });          // in-app browser on native
    window.open(url, "_blank", "noopener");
  }catch(e){}
};

// ---- share ----
WS.share = function(text){
  try{
    if(navigator.share) return navigator.share({text:text}).catch(()=>{});
    if(navigator.clipboard) return navigator.clipboard.writeText(text).catch(()=>{});
  }catch(e){}
  return Promise.resolve();
};

// ---- haptics (navigator.vibrate on Android; Capacitor Haptics when native) ----
WS.buzz = function(ms){
  if(!WS.store.settings().haptics) return;
  try{
    const H=window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if(H){ H.impact({style:"MEDIUM"}); return; }
    if(navigator.vibrate) navigator.vibrate(ms||20);
  }catch(e){}
};
})();

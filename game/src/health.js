/* Wordslide — WS.Health : the "is it actually working?" record (v2.5)
   ============================================================================
   THE LESSON THIS FILE EXISTS FOR:

     A ZERO IS NOT A FACT UNTIL YOU KNOW THE SOURCE WAS HEALTHY.

   Once ads, IAP and analytics are live, the three most dangerous numbers in the
   project are all zero:

     - "0 ad revenue"      -> is nobody watching ads, or did AdMob never init?
     - "0 purchases"       -> is nobody buying, or is the buy button throwing?
     - "0 analytics events"-> is nobody playing, or is the SDK unkeyed?

   In every pair, the two cases look IDENTICAL from the outside and require
   opposite responses. One says "change the game", the other says "fix the
   build". Guessing wrong costs weeks — you tune a funnel that was never
   running.

   So every subsystem writes here on EVERY exit, success or failure. This is a
   durable status artifact, not a log line: log lines are not read, and an
   exception that gets swallowed by a `catch` and reported as success is the
   quietest and most expensive lie a codebase can tell.

   Read it: Settings -> Diagnostics (or `WS.Health.report()` in the console).
   ========================================================================== */
(function(){
"use strict";
const WS=window.WS;
const KEY="wordslide_health";
const MAX_EVENTS=60;

WS.Health = {
  _load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; }
  },
  _save(h){
    try{ localStorage.setItem(KEY, JSON.stringify(h)); }catch(e){}
  },

  /** Record a subsystem's state. `sub` is ads|iap|analytics|entitlement|game. */
  note(sub, state, data){
    const h=this._load();
    h[sub] = h[sub] || { state:"unknown", ok:0, fail:0, events:[] };
    h[sub].state = state;
    h[sub].at = Date.now();
    h[sub].ok = (h[sub].ok||0) + 1;
    if (data) h[sub].last = data;
    h.events = (h.events||[]).concat([{ t:Date.now(), sub, state, data:data||null }]).slice(-MAX_EVENTS);
    this._save(h);
  },

  /** Record a FAILURE. Kept separate from note() on purpose: a subsystem that
   *  has failed even once must never read as green just because it later logged
   *  something innocuous. */
  fail(sub, state, err){
    const h=this._load();
    h[sub] = h[sub] || { state:"unknown", ok:0, fail:0, events:[] };
    h[sub].state = state;
    h[sub].at = Date.now();
    h[sub].fail = (h[sub].fail||0) + 1;
    h[sub].error = String((err && err.message) || err || "unknown");
    h.events = (h.events||[]).concat([{ t:Date.now(), sub, state, err:h[sub].error }]).slice(-MAX_EVENTS);
    this._save(h);
    try{ console.warn("[health] "+sub+" FAILED: "+state, err); }catch(e){}
  },

  get(sub){ return this._load()[sub] || null; },

  /** Traffic light for one subsystem.
   *  green  = initialised and working
   *  amber  = deliberately inert (web build / dev stub) — NOT an error, but also
   *           NOT evidence that anything works
   *  red    = it tried and it broke
   *  grey   = never even ran, which is its own kind of red once you have shipped */
  status(sub){
    const s=this._load()[sub];
    if (!s) return "grey";
    if (s.fail) return "red";
    if (/stub|unconfigured/.test(s.state||"")) return "amber";
    return "green";
  },

  /** The one call to make before believing any zero. If this returns anything
   *  other than all-green, a zero in your dashboard is a BUILD fact, not a
   *  MARKET fact. */
  report(){
    const h=this._load();
    const subs=["ads","iap","analytics","entitlement"];
    const out={ ok:true, subs:{}, prod: WS.MONETIZE ? WS.MONETIZE.isProd() : false };
    subs.forEach(s=>{
      const st=this.status(s);
      out.subs[s]={ status:st, detail:h[s]||null };
      if (st==="red" || st==="grey") out.ok=false;
    });
    out.events=(h.events||[]).slice(-20);
    return out;
  },

  reset(){ try{ localStorage.removeItem(KEY); }catch(e){} },
};
})();

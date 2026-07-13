/* Wordslide — WS.Analytics : one event taxonomy, swappable emitters (v2.5)
   ============================================================================
   CHOICE OF PROVIDER (researched, July 2026): Firebase Analytics / GA4, via
   @capacitor-firebase/analytics.

     - free and unlimited events, which GameAnalytics matches, but Firebase also
     - reports AdMob ad revenue per user natively (ARPDAU without gluing two
       dashboards together), which is the number that decides whether the ad
       placements are right, and
     - exports raw events to BigQuery, so we are never locked into whatever the
       console decides to show us this year.

   GameAnalytics has the prettier out-of-the-box game dashboards (retention,
   progression funnels) and remains a genuinely good second opinion. That is why
   the emitter list below is an ARRAY: the taxonomy is defined ONCE, here, and
   any number of backends can consume it. Adding GameAnalytics later means
   adding an emitter, not re-instrumenting the game.

   THE RULE THIS FILE ENFORCES:
     ONE TAXONOMY, MANY FRONT DOORS.
   Event names and their properties are declared in EVENTS below and nowhere
   else. Ad-hoc `track("some_string")` calls scattered through gameplay code is
   how you end up with three surfaces reporting three different numbers and no
   way to know which is right.

   Everything is queued until an emitter is ready, so an event fired during boot
   is not silently dropped — a dropped event is indistinguishable from a player
   who never did the thing.
   ========================================================================== */
(function(){
"use strict";
const WS=window.WS;
const cap = () => (window.Capacitor && window.Capacitor.Plugins) || {};
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/* ---- the taxonomy. If an event is not in here, it does not get sent. -------
   Declaring the props is not bureaucracy: it is what stops "level" being a
   number in one call site and a string in another, which quietly ruins every
   funnel built on it. */
const EVENTS = {
  // lifecycle
  app_open:            [],
  tutorial_begin:      [],
  tutorial_complete:   [],
  // progression  (GameAnalytics-compatible shape: world/level/result)
  level_start:         ["world","level","mode"],
  level_end:           ["world","level","mode","result","score","words","lost","duration_s"],
  world_unlocked:      ["world"],
  // core loop
  word_played:         ["len","points","tier"],
  power_used:          ["power","cost"],
  tile_lost:           ["world","level"],
  // modes
  daily_played:        ["streak"],
  duel_played:         [],
  // economy
  coins_earned:        ["amount","source","balance"],
  coins_spent:         ["amount","sink","balance"],
  chest_opened:        ["reward","amount"],
  // offers (progress-proximity: shown at a near-miss, never at run start)
  offer_shown:         ["offer","context"],
  offer_accepted:      ["offer","context"],
  offer_declined:      ["offer","context"],
  // ads
  ad_shown:            ["format"],
  ad_failed:           ["format","nofill"],
  ad_reward_earned:    ["format"],
  ad_reward_abandoned: ["format"],
  // money — fired ONCE, at the moment the receipt resolves. Never on intent,
  // never on the results screen, or the conversion count double-counts and the
  // ROAS it feeds is corrupt.
  iap_checkout_start:  ["product"],
  iap_purchase:        ["product","value","currency"],
  iap_cancelled:       ["product"],
  iap_failed:          ["product"],
  iap_restore:         ["restored"],
  entitlement_changed: ["premium"],
};

WS.Analytics = {
  ready:false,
  optedOut:false,
  _queue:[],
  _emitters:[],
  _recent:[],            // local ring buffer: proof that events fire, with no dashboard

  async init(){
    // Respect an explicit opt-out (Settings). Analytics off must mean OFF, not
    // "collected but hidden".
    this.optedOut = !!WS.store.get("analyticsOptOut", false);
    if (this.optedOut){
      WS.Health.note("analytics","opted_out");
      this._queue.length = 0;
      return;
    }

    if (isNative() && cap().FirebaseAnalytics){
      try{
        const FA = cap().FirebaseAnalytics;
        await FA.setEnabled({ enabled:true });
        this._emitters.push({
          name:"firebase",
          send:(n,p)=>FA.logEvent({ name:n, params:p }),
          setProp:(k,v)=>FA.setUserProperty({ key:k, value:String(v) }),
        });
        WS.Health.note("analytics","ready",{ provider:"firebase" });
      }catch(e){
        WS.Health.fail("analytics","init_failed",e);
      }
    } else {
      // Dev/web: log to console. Amber in the health report, never green — an
      // inert emitter must not be mistaken for a working one.
      this._emitters.push({
        name:"console",
        send:(n,p)=>{ try{ console.debug("[analytics]", n, p); }catch(e){} },
        setProp:()=>{},
      });
      WS.Health.note("analytics","web_stub",{ provider:"console" });
    }

    this.ready = true;
    // user properties make every event sliceable by the things we actually
    // decide on: paying vs not, device class, install cohort.
    this.setProp("premium",  WS.Entitle ? WS.Entitle.isPremium() : false);
    this.setProp("device",   WS.isTablet ? "tablet" : "phone");
    const q=this._queue.splice(0);
    q.forEach(e=>this._emit(e.name, e.props));
  },

  /** Fire an event. Unknown names are DROPPED loudly rather than sent quietly:
   *  a typo'd event name that silently reaches the dashboard creates a metric
   *  nobody can find and everybody trusts. */
  track(name, props){
    if (this.optedOut) return;
    if (!EVENTS[name]){
      try{ console.warn("[analytics] unknown event dropped:", name); }catch(e){}
      return;
    }
    const clean = {};
    (props ? Object.keys(props) : []).forEach(k=>{
      if (EVENTS[name].indexOf(k) === -1){
        try{ console.warn("[analytics] unknown prop on "+name+":", k); }catch(e){}
        return;
      }
      const v = props[k];
      clean[k] = (typeof v === "number" || typeof v === "boolean") ? v : String(v);
    });
    this._recent = this._recent.concat([{ t:Date.now(), name, props:clean }]).slice(-40);
    if (!this.ready) { this._queue.push({ name, props:clean }); return; }
    this._emit(name, clean);
  },

  _emit(name, props){
    this._emitters.forEach(em=>{
      try{ em.send(name, props); }
      catch(e){ WS.Health.fail("analytics","emit_failed:"+name, e); }
    });
  },

  setProp(k,v){
    if (this.optedOut) return;
    this._emitters.forEach(em=>{ try{ em.setProp(k,v); }catch(e){} });
  },

  /** Settings toggle. Turning it off must also stop the queue draining later. */
  setOptOut(v){
    WS.store.set("analyticsOptOut", !!v);
    this.optedOut = !!v;
    if (v){ this._queue.length = 0; this._emitters.length = 0; WS.Health.note("analytics","opted_out"); }
  },

  /** For the Diagnostics screen: proves events are actually firing. */
  recent(){ return this._recent.slice(-20).reverse(); },
};
})();

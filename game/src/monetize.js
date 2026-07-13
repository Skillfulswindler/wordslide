/* Wordslide — WS.Ads / WS.IAP / WS.Entitle : live monetization (v2.5)
   ============================================================================
   Replaces the v2.4 stubs. Real AdMob (@capacitor-community/admob) + real IAP
   (RevenueCat, @revenuecat/purchases-capacitor), with a working web fallback so
   `npm run dev` and headless playtests still run with zero native plugins.

   FOUR RULES BAKED IN HERE. Every one of them is a bug that has already been
   shipped by someone, at cost:

   1. ONE COUNTING PREDICATE. `WS.Entitle.isPremium()` is the ONLY definition of
      "this player paid". Nothing else may decide. Three surfaces reporting
      three different answers is how you serve ads to a paying customer.

   2. THE RECEIPT IS THE TRUTH; localStorage IS ONLY A CACHE. When RevenueCat is
      reachable it overrides the cache in BOTH directions — it grants, and it
      also REVOKES (refund, chargeback, family-sharing removal). A local
      removeAds:true with no receipt behind it is a free ride forever.

   3. A ZERO IS NOT A FACT UNTIL YOU KNOW THE SOURCE WAS HEALTHY. "No ad revenue"
      and "the ad SDK never initialised" look IDENTICAL in a dashboard and are
      opposite problems. Every SDK call writes to WS.Health so the two can always
      be told apart.

   4. CONSENT BEFORE ADS; ATT ONLY AFTER CONSENT. Apple rejects apps that show
      the ATT prompt to a user who already declined tracking on the GDPR form.
      Order is strictly: UMP consent -> (if not denied) ATT -> initialise ads.
   ========================================================================== */
(function(){
"use strict";
const WS=window.WS;
const {W,H,HEX,C}=WS;

const cap = () => (window.Capacitor && window.Capacitor.Plugins) || {};
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const platform = () => (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "web";

/* ------------------------------------------------------------------ config --
   Every id lives HERE and nowhere else. A literal duplicated into a second file
   is a number that will one day disagree with itself.

   The TEST ids are Google's public always-fill units. A dev build must never be
   able to fire a real ad request: invalid impressions get an AdMob account
   banned, not warned. `isProd()` is therefore a POSITIVE check that the real ids
   were actually filled in — an un-replaced placeholder can never fall through
   to a live call. */
WS.MONETIZE = {
  // ---- FILL THESE IN before a store build (NATIVE_BUILD.md §3) ----
  admob: {
    appId:       { android:"ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
                   ios:    "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX" },
    interstitial:{ android:"ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
                   ios:    "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" },
    rewarded:    { android:"ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
                   ios:    "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" },
  },
  admobTest: {   // Google's official test units — always fill, never billable
    interstitial:{ android:"ca-app-pub-3940256099942544/1033173712",
                   ios:    "ca-app-pub-3940256099942544/4411468910" },
    rewarded:    { android:"ca-app-pub-3940256099942544/5224354917",
                   ios:    "ca-app-pub-3940256099942544/1712485313" },
  },
  revenuecat: {
    apiKey: { android:"goog_XXXXXXXXXXXXXXXXXXXXXXXXXXX",
              ios:    "appl_XXXXXXXXXXXXXXXXXXXXXXXXXXX" },
    entitlement: "premium",                        // entitlement id set in RevenueCat
    // Product ids are PERMANENT once created in the stores — they can never be
    // renamed. So they name the coin amount they actually grant, and the keys
    // match WS.Econ.PACKS exactly.
    products: {
      removeAds:  "com.wordslide.game.removeads",  // non-consumable  $4.99
      coins_1200: "com.wordslide.game.coins1200",  // consumable      $0.99
      coins_3000: "com.wordslide.game.coins3000",  // consumable      $1.99
      coins_8000: "com.wordslide.game.coins8000",  // consumable      $4.99
    },
  },

  isProd(){
    const id = this.admob.interstitial[platform()==="ios"?"ios":"android"] || "";
    return isNative() && id.indexOf("XXXX") === -1;
  },
  adUnit(kind){
    const p = platform()==="ios" ? "ios" : "android";
    return this.isProd() ? this.admob[kind][p] : this.admobTest[kind][p];
  },
};

/* ------------------------------------------------------------- entitlement --
   Rules 1 and 2 live in this object. It is deliberately tiny. */
WS.Entitle = {
  _cache: null,

  /** THE one predicate. Every ad gate, store screen and analytics property must
   *  call this and nothing else. */
  isPremium(){
    if (this._cache !== null) return this._cache;
    return !!WS.store.get("removeAds", false);     // cold-start cache; refreshed by IAP
  },

  /** Called ONLY by the IAP layer, with a verified receipt state. `active:false`
   *  is as meaningful as true — a refund has to be able to take it back. */
  _setFromReceipt(active){
    const was = this.isPremium();
    this._cache = !!active;
    WS.store.set("removeAds", !!active);
    if (was !== !!active){
      WS.Health.note("entitlement","changed",{ from:was, to:!!active });
      WS.Analytics.track("entitlement_changed", { premium:!!active });
    }
    return this._cache;
  },

  /** Dev/QA only. Writes the cache with NO receipt behind it — which is exactly
   *  the bug Rule 2 exists to prevent. Never call from product code. */
  _devGrant(v){ this._cache=!!v; WS.store.set("removeAds", !!v); },
};

/* --------------------------------------------------------------------- ads -- */
WS.Ads = {
  ready:false,
  consent:"unknown",          // unknown | obtained | not_required | denied | error
  gameOvers:0,
  INTERSTITIAL_EVERY:3,
  MIN_GAP_MS:90000,           // never two interstitials inside 90s, even on the 3rd
  _lastInterstitial:0,
  _rewardedLoaded:false,

  // back-compat with existing call sites
  removeAds(){ return WS.Entitle.isPremium(); },
  setRemoveAds(v){ WS.Entitle._devGrant(v); },

  async init(){
    if (!isNative() || !cap().AdMob){
      WS.Health.note("ads","web_stub",{ reason: isNative()?"plugin_missing":"web" });
      this.ready=false; return;
    }
    const AdMob = cap().AdMob;
    try{
      // 1. GDPR / UMP consent, before any ad request can exist.
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === "REQUIRED"){
        const r = await AdMob.showConsentForm();
        this.consent = (r && r.status) ? String(r.status).toLowerCase() : "obtained";
      } else {
        this.consent = (info.status === "NOT_REQUIRED") ? "not_required" : "obtained";
      }

      // 2. ATT — iOS only, and ONLY if the player did not already decline
      //    tracking on the consent form. Prompting after a decline is a
      //    rejection, not a warning.
      if (platform()==="ios" && this.consent!=="denied" && AdMob.trackingAuthorizationStatus){
        const t = await AdMob.trackingAuthorizationStatus();
        if (t.status === "notDetermined") await AdMob.requestTrackingAuthorization();
      }

      // 3. Only now does the ad SDK come up.
      await AdMob.initialize({
        initializeForTesting: !WS.MONETIZE.isProd(),
        tagForChildDirectedTreatment:false,
      });
      this.ready = true;
      WS.Health.note("ads","ready",{ prod:WS.MONETIZE.isProd(), consent:this.consent });
      this.preloadRewarded();
    }catch(e){
      this.ready=false; this.consent="error";
      WS.Health.fail("ads","init_failed",e);   // Rule 3: a dead SDK must be loud
    }
  },

  /** Interstitial after every 3rd game over. Never for premium. The run must
   *  continue whether or not an ad plays — done() is called on every path. */
  async maybeInterstitial(scene, done){
    this.gameOvers++;
    const now = Date.now();
    if (WS.Entitle.isPremium())                          return done();
    if (this.gameOvers % this.INTERSTITIAL_EVERY !== 0)  return done();
    if (now - this._lastInterstitial < this.MIN_GAP_MS)  return done();
    if (!this.ready || !cap().AdMob)
      return this._stub(scene,"Interstitial ad placeholder",1200,done);

    const AdMob = cap().AdMob;
    try{
      await AdMob.prepareInterstitial({ adId: WS.MONETIZE.adUnit("interstitial") });
      await AdMob.showInterstitial();
      this._lastInterstitial = now;
      WS.Health.note("ads","interstitial_shown");
      WS.Analytics.track("ad_shown",{ format:"interstitial" });
    }catch(e){
      // No-fill is NORMAL inventory behaviour and must not read as breakage.
      // Anything else must. Conflating them is how a broken ad unit hides.
      const nofill = /no.?fill|no ad/i.test(String(e && e.message));
      WS.Health.note("ads", nofill?"interstitial_nofill":"interstitial_error",
                     { err:String(e && e.message) });
      WS.Analytics.track("ad_failed",{ format:"interstitial", nofill });
    }
    done();
  },

  async preloadRewarded(){
    if (!this.ready || !cap().AdMob) return;
    try{
      await cap().AdMob.prepareRewardVideoAd({ adId: WS.MONETIZE.adUnit("rewarded") });
      this._rewardedLoaded = true;
    }catch(e){
      this._rewardedLoaded = false;
      WS.Health.note("ads","rewarded_preload_failed",{ err:String(e && e.message) });
    }
  },

  /** Rewarded video. `grant` fires ONLY on a genuine completion — never on
   *  dismiss, never on error. Granting on failure teaches players to cancel the
   *  ad and take the reward anyway. */
  async showRewarded(scene, grant, onFail){
    if (!this.ready || !cap().AdMob)
      return this._stub(scene,"Rewarded ad placeholder",1200,grant);

    const AdMob = cap().AdMob;
    try{
      if (!this._rewardedLoaded)
        await AdMob.prepareRewardVideoAd({ adId: WS.MONETIZE.adUnit("rewarded") });
      const reward = await AdMob.showRewardVideoAd();
      this._rewardedLoaded = false;
      this.preloadRewarded();                        // keep the next one warm
      if (reward && (reward.type || reward.amount)){
        WS.Health.note("ads","rewarded_completed");
        WS.Analytics.track("ad_reward_earned",{ format:"rewarded" });
        return grant();
      }
      WS.Analytics.track("ad_reward_abandoned",{ format:"rewarded" });
      if (onFail) onFail("dismissed");
    }catch(e){
      this._rewardedLoaded = false;
      WS.Health.note("ads","rewarded_error",{ err:String(e && e.message) });
      WS.Analytics.track("ad_failed",{ format:"rewarded" });
      if (onFail) onFail("error");
    }
  },

  /** Availability, for UI. A rewarded BUTTON that leads nowhere is worse than no
   *  button — hide it rather than let a player tap into a dead end. */
  rewardedAvailable(){
    return (!isNative() && !WS.Entitle.isPremium()) ? true : (this.ready === true);
  },

  /* dev/web placeholder so ad PLACEMENT stays playtestable with no SDK present */
  _stub(scene,label,ms,done){
    if (!scene || !scene.add) return done();
    const ov=scene.add.container(0,0).setDepth(500);
    const sh=scene.add.graphics(); sh.fillStyle(0x0d1426,0.85); sh.fillRect(0,0,W,H); ov.add(sh);
    const g=scene.add.graphics(); g.fillStyle(0xffffff,1); g.fillRoundedRect(40,H/2-70,W-80,140,18); ov.add(g);
    ov.add(scene.add.text(W/2,H/2-24,"AD",{fontFamily:"Arial",fontSize:"34px",fontStyle:"bold",color:HEX(C.clay)}).setOrigin(0.5));
    ov.add(scene.add.text(W/2,H/2+20,label,{fontFamily:"Arial",fontSize:"13px",color:HEX(C.mute)}).setOrigin(0.5));
    scene.time.delayedCall(ms,()=>{ ov.destroy(); done(); });
  },
};

/* --------------------------------------------------------------------- IAP --
   RevenueCat, chosen over raw StoreKit/Billing because it owns receipt
   validation, restore, and cross-store entitlement — the three things that are
   each easy to write and collectively where every IAP bug actually lives. */
WS.IAP = {
  ready:false,
  offerings:null,

  async init(){
    if (!isNative() || !cap().Purchases){
      WS.Health.note("iap","web_stub",{ reason: isNative()?"plugin_missing":"web" });
      return;
    }
    const P = cap().Purchases;
    const key = WS.MONETIZE.revenuecat.apiKey[platform()==="ios"?"ios":"android"] || "";
    if (key.indexOf("XXXX") !== -1){
      // Refuse to pretend we are configured. A store screen that dies at the
      // moment of purchase is the most expensive bug you can ship.
      WS.Health.fail("iap","unconfigured", new Error("RevenueCat api key not set"));
      return;
    }
    try{
      await P.configure({ apiKey:key });
      this.ready = true;
      await this.refreshEntitlement();
      try{ this.offerings = await P.getOfferings(); }
      catch(e){ WS.Health.note("iap","offerings_failed",{ err:String(e && e.message) }); }
      WS.Health.note("iap","ready",{ premium:WS.Entitle.isPremium() });
    }catch(e){
      WS.Health.fail("iap","init_failed",e);
    }
  },

  /** Pull receipt state and let it OVERRIDE the cache — both directions (Rule 2). */
  async refreshEntitlement(){
    if (!this.ready || !cap().Purchases) return WS.Entitle.isPremium();
    try{
      const { customerInfo } = await cap().Purchases.getCustomerInfo();
      const ent = WS.MONETIZE.revenuecat.entitlement;
      const active = !!(customerInfo && customerInfo.entitlements &&
                        customerInfo.entitlements.active &&
                        customerInfo.entitlements.active[ent]);
      return WS.Entitle._setFromReceipt(active);
    }catch(e){
      // Offline is NOT a revocation. Keep the cached answer — do not lock a
      // paying player out of what they bought because their train hit a tunnel.
      WS.Health.note("iap","refresh_failed_keeping_cache",{ err:String(e && e.message) });
      return WS.Entitle.isPremium();
    }
  },

  async buyRemoveAds(){
    if (!this.ready || !cap().Purchases) return { ok:false, reason:"unavailable" };
    WS.Analytics.track("iap_checkout_start",{ product:"removeAds" });
    try{
      const id  = WS.MONETIZE.revenuecat.products.removeAds;
      const pkg = this._findPackage(id);
      const res = pkg
        ? await cap().Purchases.purchasePackage({ aPackage:pkg })
        : await cap().Purchases.purchaseStoreProduct({ product:{ identifier:id } });
      const ent = WS.MONETIZE.revenuecat.entitlement;
      const active = !!(res && res.customerInfo && res.customerInfo.entitlements.active[ent]);
      WS.Entitle._setFromReceipt(active);
      WS.Analytics.track("iap_purchase",{ product:"removeAds", value:4.99, currency:"USD" });
      WS.Health.note("iap","purchase_removeads",{ active });
      return { ok:active, reason: active ? "ok" : "not_entitled" };
    }catch(e){
      const cancelled = !!(e && (e.userCancelled || /cancel/i.test(String(e.message))));
      WS.Analytics.track(cancelled?"iap_cancelled":"iap_failed",{ product:"removeAds" });
      if (!cancelled) WS.Health.note("iap","purchase_failed",{ err:String(e && e.message) });
      return { ok:false, reason: cancelled ? "cancelled" : "error" };
    }
  },

  /** Coins are granted ONLY after the purchase resolves — never optimistically. */
  async buyCoins(packKey){
    const pack = WS.Econ.PACKS.find(p=>p.key===packKey);
    if (!pack) return { ok:false, reason:"unknown_pack" };
    if (!this.ready || !cap().Purchases) return { ok:false, reason:"unavailable" };
    WS.Analytics.track("iap_checkout_start",{ product:packKey });
    try{
      const id  = WS.MONETIZE.revenuecat.products[packKey];
      const pkg = this._findPackage(id);
      pkg ? await cap().Purchases.purchasePackage({ aPackage:pkg })
          : await cap().Purchases.purchaseStoreProduct({ product:{ identifier:id } });
      WS.Econ.grant(pack.coins, "iap:"+packKey);
      WS.Analytics.track("iap_purchase",{ product:packKey, value:pack.usd, currency:"USD" });
      WS.Health.note("iap","purchase_coins",{ pack:packKey, coins:pack.coins });
      return { ok:true, coins:pack.coins };
    }catch(e){
      const cancelled = !!(e && (e.userCancelled || /cancel/i.test(String(e.message))));
      WS.Analytics.track(cancelled?"iap_cancelled":"iap_failed",{ product:packKey });
      return { ok:false, reason: cancelled ? "cancelled" : "error" };
    }
  },

  /** Apple REQUIRES a visible restore control for non-consumables; an app
   *  without one is rejected. Wired into Settings. */
  async restore(){
    if (!this.ready || !cap().Purchases) return { ok:false, reason:"unavailable" };
    try{
      const { customerInfo } = await cap().Purchases.restorePurchases();
      const ent = WS.MONETIZE.revenuecat.entitlement;
      const active = !!(customerInfo && customerInfo.entitlements.active[ent]);
      WS.Entitle._setFromReceipt(active);
      WS.Analytics.track("iap_restore",{ restored:active });
      return { ok:true, restored:active };
    }catch(e){
      WS.Health.note("iap","restore_failed",{ err:String(e && e.message) });
      return { ok:false, reason:"error" };
    }
  },

  _findPackage(productId){
    try{
      const cur = this.offerings && this.offerings.current;
      if (!cur || !cur.availablePackages) return null;
      return cur.availablePackages.find(p => p.product && p.product.identifier === productId) || null;
    }catch(e){ return null; }
  },

  /** Localised price string, or a fallback. Never show a hardcoded "$4.99" to a
   *  player who is actually being charged in euros. */
  priceOf(productId, fallback){
    try{
      const pkg = this._findPackage(productId);
      return (pkg && pkg.product && pkg.product.priceString) || fallback;
    }catch(e){ return fallback; }
  },
};

/* Boot the money layer off the critical path: ads or IAP failing must never
   stop the game from starting. */
WS.initMonetize = function(){
  try{ WS.IAP.init(); }catch(e){ WS.Health.fail("iap","init_threw",e); }
  try{ WS.Ads.init(); }catch(e){ WS.Health.fail("ads","init_threw",e); }
};
})();

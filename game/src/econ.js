/* Wordslide — WS.Econ : the coin economy (v2.5)
   ============================================================================
   ONE soft currency, clear sources, clear sinks (the Wordscapes / Royal Match
   structure). Coins are the only spendable thing in the game; energy (⚡) stays
   a per-run resource and is never bought directly, so there is exactly one
   currency a player has to reason about.

   DESIGN RULES HELD HERE:

   1. ONE COUNTING PREDICATE for the balance. `WS.Econ.balance()`. Nothing reads
      the raw store key. Two places computing "how many coins" is how a player
      ends up seeing 340 on one screen and 290 on another and rightly not
      trusting either.

   2. EVERY MOVEMENT IS LEDGERED. grant/spend append to an audit trail. When a
      player writes in saying "I lost 300 coins", the alternative to a ledger is
      taking their word for it or calling them a liar. Both are bad.

   3. SPEND CANNOT GO NEGATIVE, AND IT IS CHECKED, NOT ASSUMED. spend() returns
      false and changes nothing if the balance is short. The caller must honour
      the return value — never grant the thing and reconcile later.

   4. THE OFFER GOES AT THE NEAR-MISS, NOT AT THE START. Players spend when they
      are CLOSE to a goal, not when they are staring at a fresh one. So the
      continue offer fires when a run dies within reach of the level target, and
      `nearMiss()` is the predicate that decides. Offering at run start converts
      badly and feels like a toll booth.

   5. CHEST ODDS ARE PUBLISHED. CHEST_TABLE is exported and rendered in the UI.
      Apple requires disclosure of odds for randomised rewards; beyond that, a
      variable reward with visible odds still works, and one with hidden odds is
      just a worse thing to have built.
   ========================================================================== */
(function(){
"use strict";
const WS=window.WS;

const KEY="coins", LEDGER="coinLedger", MAX_LEDGER=50;

WS.Econ = {
  /* ---------------------------------------------------------------- sources
     The faucet is deliberately generous — coins are the reward for playing well,
     and a reward that arrives in a trickle does not feel like a reward. The
     balancing is done on the SINKS, not by making the payout stingy. */
  levelReward: (lvl) => 20 + 5*Math.max(0, lvl-1),   // 20 at L1 -> 65 at L10
  ACH_REWARD: 100,         // per achievement (8 exist -> 800 lifetime, one-off)
  REWARDED_AD_COINS: 60,   // watching a rewarded ad, outside a run

  /* ------------------------------------------------------------------ sinks
     THESE NUMBERS ARE MODELLED, NOT GUESSED — run `node tools/econ-model.mjs`
     after changing any of them.

     The first pass had CONTINUE_COST at 120 against a faucet paying ~370/day.
     The model's verdict was blunt: a regular player earned THREE continues a day,
     which means the sinks were decoration and the coin packs had no reason to
     exist. A $0.99 pack was worth 1.4 days of play — nobody would ever buy it.

     Target: a regular player affords a continue roughly every 1-2 days. Below
     ~0.5 days coins are confetti; above ~3 days the shop is a wall and reads as
     hostile. The rewarded ad remains the FREE continue path, so coins are always
     a convenience, never a toll. */
  BOOSTER_COST: 150,       // start a run with ⚡30 banked
  BOOSTER_ENERGY: 30,
  CONTINUE_COST: 400,      // mid-run revive; the rewarded ad is the free path
  CONTINUE_CLEARS: 4,      // revive also forgives this many lost letters

  /* ------------------------------------------------------------- coin packs
     Sized against the retuned sinks: the cheapest pack must buy a few continues
     (not a fraction of one), and the top pack should feel like a decisive
     shortcut rather than a rounding error. */
  PACKS: [
    { key:"coins_1200", coins:1200, usd:0.99, label:"Handful" },
    { key:"coins_3000", coins:3000, usd:1.99, label:"Sack",  bonus:"+25%" },
    { key:"coins_8000", coins:8000, usd:4.99, label:"Chest", best:true, bonus:"+33%" },
  ],

  /* ------------------------------------------------- daily chest (variable) */
  // Published odds. Weights are relative; pct is computed for display so the UI
  // can never drift out of sync with the actual table.
  CHEST_TABLE: [
    { reward:"coins", amount:10,  weight:30 },
    { reward:"coins", amount:25,  weight:34 },
    { reward:"coins", amount:60,  weight:22 },
    { reward:"coins", amount:150, weight:9  },
    { reward:"power", amount:1,   weight:5  },   // a free power on the next run
  ],
  chestOdds(){
    const total = this.CHEST_TABLE.reduce((s,r)=>s+r.weight, 0);
    return this.CHEST_TABLE.map(r=>({ ...r, pct: Math.round(r.weight/total*1000)/10 }));
  },
  /** PURE: roll the chest with an injected RNG so the odds are unit-testable. */
  rollChest(rand){
    const r = (rand || Math.random)();
    const total = this.CHEST_TABLE.reduce((s,x)=>s+x.weight, 0);
    let acc = 0;
    for (const row of this.CHEST_TABLE){
      acc += row.weight/total;
      if (r < acc) return { reward:row.reward, amount:row.amount };
    }
    return { reward:"coins", amount:10 };   // unreachable, but never return undefined
  },
  chestAvailable(){ return WS.store.get("chestDate","") !== WS.todayKey(); },
  openChest(){
    if (!this.chestAvailable()) return null;
    WS.store.set("chestDate", WS.todayKey());
    const win = this.rollChest(Math.random);
    if (win.reward === "coins") this.grant(win.amount, "chest");
    else WS.store.set("freePower", true);
    WS.Analytics.track("chest_opened", { reward:win.reward, amount:win.amount });
    return win;
  },

  /* ---------------------------------------------------------------- balance */
  /** Rule 1: THE predicate. */
  balance(){ return Math.max(0, WS.store.get(KEY, 0) | 0); },

  grant(n, source){
    n = Math.max(0, Math.round(n||0));
    if (!n) return this.balance();
    const bal = this.balance() + n;
    WS.store.set(KEY, bal);
    this._ledger("+", n, source, bal);
    WS.Analytics.track("coins_earned", { amount:n, source:String(source||"?"), balance:bal });
    return bal;
  },

  /** Rule 3: returns FALSE and changes nothing when short. Callers must check. */
  spend(n, sink){
    n = Math.max(0, Math.round(n||0));
    const bal = this.balance();
    if (n > bal) return false;
    const next = bal - n;
    WS.store.set(KEY, next);
    this._ledger("-", n, sink, next);
    WS.Analytics.track("coins_spent", { amount:n, sink:String(sink||"?"), balance:next });
    return true;
  },

  canAfford(n){ return this.balance() >= Math.max(0, Math.round(n||0)); },

  _ledger(dir, n, what, bal){
    try{
      const l = WS.store.get(LEDGER, []);
      l.push({ t:Date.now(), dir, n, what:String(what||"?"), bal });
      WS.store.set(LEDGER, l.slice(-MAX_LEDGER));
    }catch(e){}
  },
  ledger(){ return (WS.store.get(LEDGER, []) || []).slice().reverse(); },

  /* -------------------------------------------------------------- the offer */
  /** Rule 4. TRUE when the run just died close enough to the target that help is
   *  worth buying. 65% is the "so nearly had it" band; below that a continue
   *  does not actually rescue the level and the purchase would be regretted,
   *  which costs more than the sale is worth. */
  nearMiss(score, target){
    if (!target || target <= 0) return false;
    const p = score / target;
    return p >= 0.65 && p < 1;
  },
};
})();

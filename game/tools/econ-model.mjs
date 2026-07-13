/* Wordslide — economy model
   ============================================================================
   run:  node tools/econ-model.mjs

   The coin numbers were originally ASSERTED, not modelled. This answers the
   question that decides whether the shop is a real system or a decoration:

       In a normal session, does a player earn enough to ever USE a coin sink —
       and not so much that the sinks stop mattering?

   Two failure modes, both fatal and both invisible without arithmetic:

     * TOO STINGY -> a continue costs more than a week of play. Nobody ever
       spends, the shop is dead, and the only way to get coins is to buy them,
       which reads as a wall and converts badly.
     * TOO GENEROUS -> coins pile up unspent, the sinks are meaningless, and the
       coin IAP has no reason to exist at all.

   The target: a committed player can afford a continue every few sessions from
   play alone, and a coin pack is a shortcut rather than the only path. Coins
   must feel EARNED and SPENDABLE — the moment they feel like a paywall token,
   the whole economy reads as hostile.

   Imports the real numbers from src/tuning.js and src/econ.js. No private copy.
   ========================================================================== */

global.window = { innerWidth:480, innerHeight:854 };
const _ls = {};
global.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k,v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; },
};

await import("../src/tuning.js");
const WS = global.window.WS;
WS.store     = { _d:{}, get(k,d){ return (k in this._d) ? this._d[k] : d; }, set(k,v){ this._d[k]=v; } };
WS.Analytics = { track(){} };
WS.todayKey  = () => "2026-07-12";
await import("../src/econ.js");
const E = WS.Econ;

if (!E || !WS.levelTarget){ console.error("ABORT: modules did not load."); process.exit(2); }

const line = s => console.log(s);
const chestEV = E.chestOdds()
  .reduce((s,o) => s + (o.reward === "coins" ? o.amount * o.pct/100 : 0), 0);

line("\nSOURCES (what a player earns)");
line(`  level clear        ${E.levelReward(1)} coins at L1, ${E.levelReward(5)} at L5, ${E.levelReward(10)} at L10  (20 + 5 per level)`);
line(`  daily chest        ${chestEV.toFixed(1)} coins expected  (+ a 5% free-power roll)`);
line(`  achievement        ${E.ACH_REWARD} each  (8 exist -> ${E.ACH_REWARD*8} lifetime, one-off)`);
line(`  rewarded ad        ${E.REWARDED_AD_COINS} coins`);

line("\nSINKS (what a player spends on)");
line(`  head start (⚡${E.BOOSTER_ENERGY})  ${E.BOOSTER_COST} coins`);
line(`  continue a run      ${E.CONTINUE_COST} coins   (the rewarded ad is the FREE path)`);

/* A "session" = one run. How deep does a run get? A casual player dies around
   L3-L4; a committed one reaches L6-L7. Coins earned = sum of level rewards for
   every level they CLEARED (the level they died on pays nothing). */
const runEarnings = deepest => {
  let c = 0;
  for (let l = 1; l < deepest; l++) c += E.levelReward(l);
  return c;
};

line("\nCOINS PER RUN, by how deep the player gets");
line("  dies on   cleared   coins   = continues   = head starts");
[2,3,4,5,6,7,8,10].forEach(d => {
  const c = runEarnings(d);
  line(`  L${String(d).padEnd(7)} ${String(d-1).padEnd(9)} ${String(c).padEnd(7)} ${(c/E.CONTINUE_COST).toFixed(2).padEnd(12)} ${(c/E.BOOSTER_COST).toFixed(2)}`);
});

/* A realistic day: 3 runs + the daily chest. */
const profiles = [
  { name:"casual   (3 runs, dies ~L3)",    runs:3, deepest:3 },
  { name:"regular  (3 runs, dies ~L5)",    runs:3, deepest:5 },
  { name:"committed(4 runs, dies ~L7)",    runs:4, deepest:7 },
];
line("\nA DAY OF PLAY (runs + one daily chest)");
line("  profile                        coins/day   days to afford a continue");
profiles.forEach(p => {
  const day = p.runs * runEarnings(p.deepest) + chestEV;
  const days = E.CONTINUE_COST / day;
  line(`  ${p.name.padEnd(30)} ${day.toFixed(0).padStart(6)}      ${days.toFixed(1)}`);
});

line("\nWHAT A COIN PACK IS WORTH, in the currency of play");
E.PACKS.forEach(p => {
  const daysOfPlay = p.coins / (3 * runEarnings(5) + chestEV);   // vs a 'regular' day
  line(`  $${p.usd.toFixed(2)}  ${String(p.coins).padStart(4)} coins  = ${(p.coins/E.CONTINUE_COST).toFixed(1)} continues  = ${daysOfPlay.toFixed(1)} days of regular play`);
});

line("\nVERDICT");
const regularDay = 3 * runEarnings(5) + chestEV;
const daysPerContinue = E.CONTINUE_COST / regularDay;
if (daysPerContinue > 3)
  line(`  TOO STINGY — a regular player needs ${daysPerContinue.toFixed(1)} days to afford one continue.`);
else if (daysPerContinue < 0.5)
  line(`  TOO GENEROUS — a regular player earns ${(1/daysPerContinue).toFixed(1)} continues a day; the sinks stop mattering.`);
else
  line(`  HEALTHY — a regular player affords a continue every ${daysPerContinue.toFixed(1)} days.`);
line(`  (target: roughly 0.5-3 days. Below that coins are confetti; above it, the shop is a wall.)\n`);

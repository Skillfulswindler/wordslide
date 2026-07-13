/* Wordslide — layout + economy unit tests (node, no browser)
   ----------------------------------------------------------------------------
   run:  node test/run-tests.mjs

   WHY THESE EXIST.

   - The DEVICE MATRIX. "Looks fine on my phone" is not evidence. A notch eating
     the score, or a Play button under the home indicator, is invisible until it
     is in front of a store reviewer. These assertions encode the invariants —
     nothing under an inset, tray never overlapping the board, everything
     on-canvas — and check them against ten real devices we do not own.

   - The ECONOMY. Any path that moves money or grants entitlement needs a
     COMMITTED test, not a one-off manual check; a verification that lives in a
     scratch buffer is not a test. Coins are real value to the player and real
     revenue to us. `spend()` going negative even once is a free shop.

   Both modules under test are PURE and self-contained, which is exactly why they
   are separate files: they can be exercised with no Phaser, no canvas, no DOM.
   ========================================================================== */

let pass=0, fail=0;
const ok = (name, cond, extra="") => cond
  ? (pass++, console.log("  [ok] "+name))
  : (fail++, console.error("  [XX] "+name+(extra?"  -- "+extra:"")));
const eq = (name, a, b) => ok(name, a===b, "got "+JSON.stringify(a)+" want "+JSON.stringify(b));

/* ---- minimal browser shim: we import the REAL modules, not a copy of them.
   A test written against a re-typed copy of the logic tests nothing. --------- */
global.window = { innerWidth:480, innerHeight:854 };
const _ls = {};
global.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k,v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; },
};

await import("../src/layout.js");
const WS = global.window.WS;

// econ.js talks to WS.store / WS.Analytics / WS.todayKey — stub exactly those.
WS.store = {
  _d:{},
  get(k,d){ return (k in this._d) ? this._d[k] : d; },
  set(k,v){ this._d[k]=v; },
};
WS.Analytics = { track(){} };
WS.todayKey  = () => "2026-07-12";
await import("../src/econ.js");

/* ============================================================ DEVICE MATRIX ==
   css px + the safe-area insets each device actually reports in portrait. */
const DEVICES = [
  { name:"iPhone SE (2022)",      vw:375,  vh:667,  insets:{top:20, bottom:0,  left:0, right:0} },
  { name:"iPhone 13 mini",        vw:375,  vh:812,  insets:{top:50, bottom:34, left:0, right:0} },
  { name:"iPhone 15",             vw:393,  vh:852,  insets:{top:59, bottom:34, left:0, right:0} },
  { name:"iPhone 17 Pro Max",     vw:440,  vh:956,  insets:{top:62, bottom:34, left:0, right:0} },
  { name:"Pixel 8",               vw:412,  vh:915,  insets:{top:48, bottom:24, left:0, right:0} },
  { name:"Galaxy S24 Ultra",      vw:412,  vh:946,  insets:{top:44, bottom:24, left:0, right:0} },
  { name:"Galaxy Z Fold (front)", vw:344,  vh:882,  insets:{top:40, bottom:24, left:0, right:0} },
  { name:"iPad mini",             vw:744,  vh:1133, insets:{top:24, bottom:20, left:0, right:0} },
  { name:"iPad Pro 13in",         vw:1024, vh:1366, insets:{top:24, bottom:20, left:0, right:0} },
  { name:"Old 16:9 Android",      vw:360,  vh:640,  insets:{top:24, bottom:0,  left:0, right:0} },
];

console.log("\nDEVICE MATRIX -- layout invariants");
for (const d of DEVICES){
  const L = WS.solveLayout(d);
  const t = d.name.padEnd(22);

  ok(t+"HUD clears the notch",
     L.HUD_TOP >= L.SAFE.top, "hudTop="+L.HUD_TOP+" safeTop="+L.SAFE.top);

  // The one that actually bites: the powers row is the bottom-most interactive
  // thing, and a button under the gesture bar cannot be pressed at all.
  ok(t+"powers clear the gesture bar",
     L.POWERS_Y + L.POWERS_H <= L.H - L.SAFE.bottom,
     "powersBottom="+(L.POWERS_Y+L.POWERS_H)+" limit="+(L.H-L.SAFE.bottom));

  // Tray and board are both drop targets; an overlap makes a drop ambiguous.
  ok(t+"tray sits below the board",
     L.TRAY_Y >= L.BOARD_TOP + L.BOARD_H,
     "trayY="+L.TRAY_Y+" boardBottom="+(L.BOARD_TOP+L.BOARD_H));

  ok(t+"board fits beside the channel",
     L.BOARD_LEFT >= L.CHAN_R && L.BOARD_LEFT + L.BOARD_W <= L.W - L.SAFE.right,
     "left="+L.BOARD_LEFT+" right="+(L.BOARD_LEFT+L.BOARD_W)+" W="+L.W);

  ok(t+"cell stays thumb-sized", L.CELL >= 20, "cell="+L.CELL);
  ok(t+"whole stack is on-canvas", L.TRAY_Y > 0 && L.POWERS_Y + L.POWERS_H <= L.H);
}

console.log("\nLAYOUT -- the specific things that were wrong before");
{
  const tall  = WS.solveLayout({ vw:412, vh:946, insets:{top:44,bottom:24,left:0,right:0} });
  const short = WS.solveLayout({ vw:360, vh:640, insets:{top:24,bottom:0, left:0,right:0} });
  ok("a tall phone gets a TALLER canvas, not fatter bars", tall.H > short.H, tall.H+" vs "+short.H);
  ok("canvas height stays inside the supported band", tall.H<=920 && short.H>=800);

  // THE subtlety. A 19.5:9 phone letterboxes ~50px at the top, so a 59px notch
  // barely intrudes. Charging the full inset would throw away ~50px of board to
  // dodge a notch that was never over the board in the first place.
  const notched = WS.solveLayout({ vw:393, vh:852, insets:{top:59,bottom:34,left:0,right:0} });
  ok("only the INTRUDING part of the notch is charged to the canvas",
     notched.SAFE.top < 59, "safeTop="+notched.SAFE.top+" (raw inset was 59)");

  // A plain no-notch screen must still reproduce the original hand-tuned board.
  const plain = WS.solveLayout({ vw:480, vh:854, insets:{top:0,bottom:0,left:0,right:0} });
  eq("no-notch: cell is still the original 28", plain.CELL, 28);
  eq("no-notch: board is still the original 420", plain.BOARD_W, 420);
  // compare VALUES, not JSON key order — key order is not a fact about the layout
  ok("no-notch: insets are all zero",
     plain.SAFE.top===0 && plain.SAFE.right===0 && plain.SAFE.bottom===0 && plain.SAFE.left===0,
     JSON.stringify(plain.SAFE));
}

/* ================================================================= ECONOMY == */
console.log("\nECONOMY -- coins cannot be conjured, and cannot go negative");
{
  const E = WS.Econ;
  WS.store.set("coins", 0);
  WS.store.set("coinLedger", []);

  eq("starts at zero", E.balance(), 0);

  E.grant(100, "test");
  eq("grant adds", E.balance(), 100);

  ok("a spend within balance succeeds", E.spend(60, "booster") === true);
  eq("it deducts exactly", E.balance(), 40);

  // THE test. If this ever fails, the shop is free.
  ok("a spend BEYOND the balance is refused", E.spend(41, "booster") === false);
  eq("and a refused spend changes nothing", E.balance(), 40);

  ok("spending exactly the balance is allowed", E.spend(40, "x") === true);
  eq("balance floors at zero", E.balance(), 0);

  E.grant(-50, "malicious");
  eq("a negative grant cannot drain the balance", E.balance(), 0);

  E.grant(10,"a"); E.spend(5,"b");
  ok("every movement is ledgered", E.ledger().length >= 2);

  ok("level reward grows with depth", E.levelReward(5) > E.levelReward(1));
  eq("level 1 pays the documented 20", E.levelReward(1), 20);
}

console.log("\nCHEST -- the published odds must BE the odds");
{
  const E = WS.Econ;
  const total = E.chestOdds().reduce((s,o)=>s+o.pct, 0);
  ok("published odds sum to 100%", Math.abs(total-100) < 0.5, "sum="+total);

  eq("rand=0 lands in the first bucket", E.rollChest(()=>0).amount, 10);
  eq("rand~1 lands in the last bucket",  E.rollChest(()=>0.999).reward, "power");
  ok("never returns undefined",          !!E.rollChest(()=>1).reward);

  // 20k rolls against the published table. A randomised reward is allowed to be
  // random. It is not allowed to lie about its odds.
  let seed=42;
  const rng=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  const counts={};
  for(let i=0;i<20000;i++){ const r=E.rollChest(rng); const k=r.reward+":"+r.amount; counts[k]=(counts[k]||0)+1; }
  let good=true, worst="";
  E.chestOdds().forEach(row=>{
    const k=row.reward+":"+row.amount;
    const actual=(counts[k]||0)/20000*100;
    if (Math.abs(actual-row.pct) > 1.5){ good=false; worst=k+": published "+row.pct+"% actual "+actual.toFixed(1)+"%"; }
  });
  ok("empirical odds match the published table (20k rolls)", good, worst);
}

console.log("\nOFFER -- shown at the near-miss, not at the wall");
{
  const E = WS.Econ;
  ok("80% of target IS a near miss",  E.nearMiss(80, 100) === true);
  ok("30% of target is not",          E.nearMiss(30, 100) === false);
  ok("a cleared level is not a miss", E.nearMiss(100,100) === false);
  ok("no target means no offer",      E.nearMiss(50, 0)   === false);
}

console.log("\n"+pass+" passed, "+fail+" failed\n");
process.exit(fail ? 1 : 0);

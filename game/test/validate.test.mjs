/* Wordslide — validateMove() unit tests (node, no browser)
   ----------------------------------------------------------------------------
   run:  node test/validate.test.mjs      (also part of `npm test`)

   WHY THIS FILE EXISTS. validateMove() is the function every point in the game
   flows through — it is the gameplay equivalent of a billing path. Its "11 node
   unit tests" used to live in a session scratch buffer ("see git/README or
   ask"), which the project ledgers call out precisely: A VERIFICATION THAT
   LIVES IN /tmp IS NOT A TEST. This is the committed version.

   We import the REAL modules (layout -> tuning -> worlds -> game) with a
   minimal browser/Phaser shim, then call validateMove on a bare object carrying
   GameScene's prototype. No Phaser rendering, no DOM, no copy of the logic.
   ========================================================================== */

let pass=0, fail=0;
const ok = (name, cond, extra="") => cond
  ? (pass++, console.log("  [ok] "+name))
  : (fail++, console.error("  [XX] "+name+(extra?"  -- "+extra:"")));
const eq = (name, a, b) => ok(name, a===b, "got "+JSON.stringify(a)+" want "+JSON.stringify(b));

/* ---- browser + Phaser shims (game.js only needs Phaser.Scene at import) ---- */
global.window = { innerWidth:480, innerHeight:854 };
const _ls = {};
global.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k,v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; },
};
global.Phaser = { Scene: class {} };
// the dictionary under test — every word used below, and ONLY those
global.window.WORDLIST = "cat at rat art qat sliders slide aa";
global.WORDLIST = global.window.WORDLIST;

await import("../src/layout.js");
await import("../src/tuning.js");
await import("../src/worlds.js");
const WS = global.window.WS;
await import("../src/game.js");

/* ---- a bare scene: GameScene's prototype, hand-filled state --------------- */
function scene(){
  const s = Object.create(WS.GameScene.prototype);
  s.board = []; for(let r=0;r<15;r++) s.board.push(new Array(15).fill(null));
  s.prov = [];
  s.boulders = [];
  s.firstMove = true;
  s.time = { now: 0 };
  s.combo = 0; s.comboUntil = 0;
  s.goldenNext = false;
  return s;
}
const tile = (ch,r,c,o) => Object.assign({ch, r, c, gold:false, ember:false}, o||{});

console.log("\nVALIDATEMOVE -- placement rules");
{
  const s = scene();
  ok("empty prov is invalid", s.validateMove().valid === false);

  s.prov = [tile("c",3,3), tile("a",3,4), tile("t",3,5)];
  const r = s.validateMove();
  ok("first move off the star is rejected", !r.valid && /★/.test(r.reason||""), r.reason);

  s.prov = [tile("c",7,6), tile("a",7,7), tile("t",7,8)];
  ok("first move across the star is accepted", s.validateMove().valid === true);

  s.prov = [tile("c",7,6), tile("t",7,8)];                       // hole at 7,7
  const g = s.validateMove();
  ok("a gap in the line is rejected", !g.valid, g.reason);

  s.prov = [tile("c",7,7), tile("a",8,8)];                       // L-shape
  ok("two rows AND two cols is rejected", s.validateMove().valid === false);

  s.prov = [tile("a",7,7)];                                      // 1 letter, no word
  ok("a single letter forming no 2+ word is rejected", s.validateMove().valid === false);
}

console.log("\nVALIDATEMOVE -- connectivity + dictionary");
{
  const s = scene();
  s.firstMove = false;
  s.board[7][7] = tile("a",7,7);                                  // committed
  s.prov = [tile("t",7,8)];                                       // extends to "at"
  const r = s.validateMove();
  ok("extending a board word connects and validates", r.valid === true, r.reason);
  eq("cross-free extension scores plain letter sum", r.total, 2); // a1+t1, no new-cell bonus

  s.prov = [tile("c",1,1), tile("a",1,2), tile("t",1,3)];         // island
  const i = s.validateMove();
  ok("a disconnected word is rejected", !i.valid && /connect/.test(i.reason||""), i.reason);

  s.prov = [tile("x",7,8)];                                       // "ax"? not in dict
  const d = s.validateMove();
  ok("a non-dictionary word is rejected with the word named",
     !d.valid && /isn't a word/i.test(d.reason||""), d.reason);
}

console.log("\nVALIDATEMOVE -- scoring");
{
  const s = scene();
  s.prov = [tile("c",7,6), tile("a",7,7), tile("t",7,8)];
  eq("star doubles the first word: CAT = (3+1+1)x2", s.validateMove().total, 10);

  s.prov = [tile("c",7,6), tile("a",7,7), tile("t",7,8,{gold:true})];
  eq("a gold letter doubles its letter value", s.validateMove().total, 12);

  s.prov = [tile("q",7,6), tile("a",7,7), tile("t",7,8)];
  const q = s.validateMove();
  eq("rare letter bonus: QAT = (10+1+1)x2 +12", q.total, 36);
  ok("rare flag is set", q.rare === true);

  // full tray: SLIDERS through the star, DLs at (7,4) and (7,10)
  s.prov = "sliders".split("").map((ch,i)=>tile(ch,7,4+i));
  const f = s.validateMove();
  eq("full-tray: DLx2 + star wordx2 + 40 bonus", f.total, 60);
  ok("full flag is set", f.full === true);

  s.prov = [tile("c",7,6), tile("a",7,7), tile("t",7,8)];
  s.goldenNext = true;
  eq("golden power doubles the total", s.validateMove().total, 20);
  s.goldenNext = false;

  s.combo = 2; s.comboUntil = 999999; s.time.now = 0;
  eq("a live x2 combo multiplies by 1.2", s.validateMove().total, 12);
  s.comboUntil = 0; s.time.now = 1;
  eq("an expired combo multiplies by nothing", s.validateMove().total, 10);
}

console.log("\nVALIDATEMOVE -- cross-words");
{
  const s = scene();
  s.firstMove = false;
  s.board[7][7] = tile("a",7,7);
  s.board[7][8] = tile("t",7,8);                                  // "at" on board
  // play "rat" vertically: r at (6,8) on top of the board's t? no — build
  // r(6,7) a-board t? keep simple: new a at (6,8), forming vertical "at" and
  // needing horizontal cross "a?" — place r(6,7),a(6,8),t(6,9): word RAT, with
  // crosses ra?/at/… — craft the clean case instead:
  // vertical word "aa" crossing the board's a at (7,7): new a at (6,7)
  s.prov = [tile("a",6,7)];
  const r = s.validateMove();
  ok("a vertical cross-word against a board letter validates", r.valid === true, r.reason);
  eq("it scores the whole cross-word", r.total, 2);               // a1+a1, no bonus at (6,7)

  // one bad incidental cross-word rejects the whole play
  s.board[6][8] = tile("x",6,8);                                  // "ax" would form
  s.prov = [tile("a",6,7)];                                       // now also forms "ax" horizontally
  const bad = s.validateMove();
  ok("one invalid incidental cross-word rejects the play", bad.valid === false, bad.reason);
}

console.log("\nSWEEP -- provisional tiles are not a safe harbour");
{
  // the knob is pure and lives in tuning.js
  eq("SWEEP_S L1 = 25s", WS.SWEEP_S(1), 25);
  eq("SWEEP_S L14 floors at 12s", WS.SWEEP_S(14), 12);
  eq("SWEEP_S L30 stays at the floor", WS.SWEEP_S(30), 12);

  // behavioural: drive the real sweepProvisional() on a bare scene, stubbing the
  // side-effecting collaborators. One tick = 250ms, exactly as service() calls it.
  const s = scene();
  s.level = 1; s.sweptOnce = true;
  const lost = [];
  s.loseTile      = t => { s.prov = s.prov.filter(x => x !== t); lost.push(t); };
  s.burnEmber     = t => { s.prov = s.prov.filter(x => x !== t); s.burned.push(t); };
  s.startSweepWarn = () => {};
  s.clearSweepWarn = () => {};
  s.toast = () => {}; s.refreshPreview = () => {};
  s.burned = [];
  const ticksPerSweep = WS.SWEEP_S(1) * 1000 / 250;      // 100

  const parked = tile("q",5,5);
  s.prov = [parked];
  for (let i=0;i<ticksPerSweep-1;i++) s.sweepProvisional();
  ok("parked tile survives right up to the timeout", lost.length===0 && parked.sweepMs===(ticksPerSweep-1)*250);
  s.sweepProvisional();
  ok("parked tile is swept once the timeout passes", lost.length===1 && lost[0]===parked);

  // recall (re-arm) resets the clock — it survives a second nearly-full cycle
  const p2 = tile("z",6,6);
  s.prov = [p2];
  for (let i=0;i<ticksPerSweep-5;i++) s.sweepProvisional();
  s.armSweep(p2);                                          // recall + re-place
  for (let i=0;i<ticksPerSweep-1;i++) s.sweepProvisional();
  ok("recall resets the sweep timer", s.prov.includes(p2));
  s.sweepProvisional();
  ok("re-parked tile is swept only after a full fresh timeout", !s.prov.includes(p2));

  // a provisional ember keeps burning (the fuse-freeze exploit is closed)
  const emb = tile("e",4,4,{ember:true, fuse:500});
  s.prov = [emb];
  s.sweepProvisional();
  ok("provisional ember fuse ticks down while on the board", emb.fuse===250 && s.burned.length===0);
  s.sweepProvisional();
  ok("provisional ember burns away (a lost letter) when its fuse expires", s.burned.length===1 && s.burned[0]===emb);
}

console.log("\n"+pass+" passed, "+fail+" failed\n");
process.exit(fail ? 1 : 0);

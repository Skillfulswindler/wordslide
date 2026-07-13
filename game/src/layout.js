/* Wordslide — WS.solveLayout : device-tuned geometry (v2.5)
   ============================================================================
   Loaded FIRST, before worlds.js, because art/game/scenes/ui all destructure
   these constants at *import* time — anything that loads before the layout is
   solved captures stale geometry and silently lays itself out for the wrong
   screen.

   THE IDEA. The design canvas is 480 wide (46px tumble channel + 15x28 board +
   14px margin). Height is NOT fixed: it follows the device's aspect ratio, so a
   20:9 phone gets a taller canvas instead of thick letterbox bars.

   THE SUBTLETY THAT MATTERS. Phaser runs Scale.FIT + CENTER_BOTH, so the canvas
   is scaled to fit and centred, and any leftover screen becomes a letterbox bar.
   A notch or gesture bar therefore only costs us canvas for the part of it that
   actually OVERLAPS the canvas — the rest lands harmlessly in the bar. Naively
   subtracting the full 59px iPhone inset would throw away ~55px of board to
   avoid a notch that was never over the board in the first place.

   So: compute the letterbox, subtract it from the inset, and charge only the
   remainder. That is what `intrude()` does, and it is the whole trick.

   solveLayout() is PURE — no DOM, no globals — so the device matrix in
   test/layout.test.mjs can check the invariants on ten phones we do not own.
   ========================================================================== */
(function(){
"use strict";
const WS = (window.WS = window.WS || {});

WS.COLS = 15;
WS.ROWS = 15;
WS.DESIGN_W = 480;
WS.H_MIN = 800;   // below this the lower stack (tray + buttons + powers) will not fit
WS.H_MAX = 920;   // above this a tall phone just gains dead space; letterbox instead

/** PURE. env = { vw, vh, insets:{top,right,bottom,left} } -> layout constants. */
WS.solveLayout = function(env){
  const vw = Math.max(1, env.vw), vh = Math.max(1, env.vh);
  const ins = env.insets || { top:0, right:0, bottom:0, left:0 };
  const W = WS.DESIGN_W;

  // 1. design height follows the device aspect, clamped to what the UI supports
  const H = Math.round(Math.min(WS.H_MAX, Math.max(WS.H_MIN, W * (vh / vw))));

  // 2. how Phaser's FIT will actually place that canvas on the real screen
  const scale = Math.min(vw / W, vh / H);
  const lbX = (vw - W * scale) / 2;    // letterbox bar, css px, each side
  const lbY = (vh - H * scale) / 2;

  // 3. charge only the INTRUDING part of each inset, converted to design px
  const intrude = (inset, bar) => Math.max(0, (inset || 0) - bar) / scale;
  const SAFE = {
    top:    Math.round(intrude(ins.top,    lbY)),
    bottom: Math.round(intrude(ins.bottom, lbY)),
    left:   Math.round(intrude(ins.left,   lbX)),
    right:  Math.round(intrude(ins.right,  lbX)),
  };

  // 4. the lower stack is BOTTOM-anchored, so it always clears the gesture bar.
  //    (Anchoring it to the top and hoping is how a Play button ends up under
  //    the home indicator, where it cannot be pressed at all.)
  const MARGIN = 12, TRAY_TILE = 54, PAD_B = 22, POWERS_H = 44, BTN_H = 52;
  const POWERS_Y       = H - SAFE.bottom - PAD_B - POWERS_H;
  const POWERS_LABEL_Y = POWERS_Y - 18;
  const BTN_Y          = POWERS_LABEL_Y - 12 - BTN_H;
  const PREVIEW_Y      = BTN_Y - 22;
  const TRAY_Y         = PREVIEW_Y - 14 - TRAY_TILE;

  // 5. board hangs under the HUD, and shrinks ONLY if the tray would collide
  const HUD_H = 112;
  const boardTopMin = SAFE.top + HUD_H;
  const boardRoom   = TRAY_Y - 10 - boardTopMin;
  let CELL = 28;
  if (boardRoom < CELL * WS.ROWS) CELL = Math.max(20, Math.floor(boardRoom / WS.ROWS));
  const GAP = 2;
  const BOARD_W = CELL * WS.COLS, BOARD_H = CELL * WS.ROWS;

  // leftover slack: the board drifts down a little, the rest is breathing room
  const slack = Math.max(0, TRAY_Y - 18 - BOARD_H - boardTopMin);
  const BOARD_TOP = Math.round(boardTopMin + slack * 0.45);

  // horizontal: the channel is fixed width; the board centres in what remains
  const CHAN_W = 46;
  const BOARD_LEFT = Math.round(SAFE.left + CHAN_W +
    (W - SAFE.left - SAFE.right - CHAN_W - 14 - BOARD_W) / 2);

  return {
    W, H, MARGIN, SAFE, scale, letterbox:{ x:lbX, y:lbY },
    COLS:WS.COLS, ROWS:WS.ROWS,
    CELL, GAP, TILE: CELL - GAP,
    BOARD_LEFT, BOARD_TOP, BOARD_W, BOARD_H,
    CHANNEL_X: SAFE.left + 23, CHAN_L: SAFE.left + 4, CHAN_R: SAFE.left + 42,
    TRAY_SIZE:7, TRAY_Y, TRAY_TILE, TRAY_GAP:6, TRAY_X: BOARD_LEFT,
    DUMP: { x: SAFE.left + 2, y: TRAY_Y, w:40, h:TRAY_TILE },
    DUMP_COST: 8,
    HUD_TOP: SAFE.top + 8,
    PREVIEW_Y, BTN_Y, BTN_H, POWERS_LABEL_Y, POWERS_Y, POWERS_H,
  };
};

/** CSS env() is the ONLY source of truth for a notch — there is no JS API for
 *  it. Park a probe with inset-sized padding and measure it. Zeros on desktop,
 *  which is the correct answer there. */
WS.readInsets = function(){
  if (typeof document === "undefined" || !document.body) return {top:0,right:0,bottom:0,left:0};
  try{
    const p = document.createElement("div");
    p.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);" +
      "padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);";
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    const n = v => parseFloat(v) || 0;
    const out = { top:n(cs.paddingTop), right:n(cs.paddingRight),
                  bottom:n(cs.paddingBottom), left:n(cs.paddingLeft) };
    p.remove();
    return out;
  }catch(e){ return {top:0,right:0,bottom:0,left:0}; }
};

/** Solve for the real device and stamp the constants onto WS. */
WS.applyLayout = function(env){
  env = env || {
    vw: (typeof window !== "undefined" ? window.innerWidth  : 480),
    vh: (typeof window !== "undefined" ? window.innerHeight : 854),
    insets: WS.readInsets(),
  };
  const L = WS.solveLayout(env);
  Object.assign(WS, L);
  WS.LAYOUT = L;
  WS.isTablet = (env.vh / env.vw) < 1.6;
  return L;
};

/** A tablet leaves side bars whatever we do (a 15x15 board has a shape). Paint
 *  the page behind the canvas with the world's sky so they read as intentional
 *  matting rather than a broken build. */
WS.setPageBG = function(hex){
  try{
    const c = (typeof hex === "number")
      ? "#" + (hex >>> 0).toString(16).padStart(6,"0").slice(-6)
      : hex;
    document.documentElement.style.background = c;
    document.body.style.background = c;
  }catch(e){}
};

WS.applyLayout();
})();

/* Wordslide — WS.Assets: the art pipeline.
   ---------------------------------------------------------------------------
   DROP-IN RULE: put a PNG at src/assets/<group>/<key>.png and it is loaded
   automatically as texture "<key>". No code change, no manifest edit.
   Every consumer checks WS.Assets.has(scene,key) and falls back to the
   procedural art in art.js, so the game always runs — assets only upgrade it.

   AUTHORING SCALE: all UI/tile/icon art is authored @2x (logical px * 2) and
   drawn at 0.5 scale, so it stays crisp on 3x phone displays. Backgrounds are
   the exception: they letterbox to 480x854 via setDisplaySize, so 960x1708.

   9-SLICE: panels/buttons stretch via Phaser nineslice. Insets below are in
   SOURCE pixels (i.e. @2x). See ART_BIBLE.md for the full spec.
   --------------------------------------------------------------------------- */
(function(){
"use strict";
const WS=window.WS;

// Vite resolves these globs at build time and bundles the files. The glob
// pattern must be a static literal, hence one line per group.
const GROUPS = {
  // Backgrounds are opaque paintings — JPEG at q88 is 1/6th the size of PNG with
  // no visible loss (13.2MB -> 2.1MB across the set). Everything else needs alpha,
  // so stays PNG. Both extensions resolve to the same basename texture key.
  backgroundsJpg: import.meta.glob('./assets/backgrounds/*.jpg', {eager:true, query:'?url', import:'default'}),
  backgrounds: import.meta.glob('./assets/backgrounds/*.png', {eager:true, query:'?url', import:'default'}),
  tiles:       import.meta.glob('./assets/tiles/*.png',       {eager:true, query:'?url', import:'default'}),
  board:       import.meta.glob('./assets/board/*.png',       {eager:true, query:'?url', import:'default'}),
  ui:          import.meta.glob('./assets/ui/*.png',          {eager:true, query:'?url', import:'default'}),
  icons:       import.meta.glob('./assets/icons/*.png',       {eager:true, query:'?url', import:'default'}),
  fx:          import.meta.glob('./assets/fx/*.png',          {eager:true, query:'?url', import:'default'}),
};
// Optional texture atlases: drop matching <name>.png + <name>.json into assets/atlas/.
const ATLAS_PNG  = import.meta.glob('./assets/atlas/*.png',  {eager:true, query:'?url', import:'default'});
const ATLAS_JSON = import.meta.glob('./assets/atlas/*.json', {eager:true, query:'?url', import:'default'});

const baseOf = p => p.split('/').pop().replace(/\.(png|jpg|jpeg|json)$/i,'');

// key -> url, flattened across groups
const MANIFEST = {};
for(const g in GROUPS) for(const p in GROUPS[g]) MANIFEST[baseOf(p)] = GROUPS[g][p];

const ATLASES = {};
for(const p in ATLAS_PNG){
  const k = baseOf(p);
  const j = Object.keys(ATLAS_JSON).find(q => baseOf(q) === k);
  if(j) ATLASES[k] = {png: ATLAS_PNG[p], json: ATLAS_JSON[j]};
}

// Authoring scale for everything except backgrounds.
const SCALE = 2;

// 9-slice corner insets, in SOURCE (@2x) pixels. A key absent here that is
// still used as a nineslice falls back to DEFAULT_NINE.
const NINE = {
  panel_wood:   {l:44, r:44, t:44, b:48},   // chunky wooden frame WITH cream inner (modal cards)
  panel_frame:  {l:44, r:44, t:44, b:48},   // same border, HOLLOW centre (the board)
  panel_paper:  {l:28, r:28, t:28, b:28},   // white/cream info card
  panel_tray:   {l:40, r:40, t:40, b:44},   // tray shelf under the 7 slots
  sign_wood:    {l:30, r:30, t:24, b:28},   // header plank
  btn_primary:  {l:32, r:32, t:28, b:36},   // clay  — Play / main CTA
  btn_teal:     {l:32, r:32, t:28, b:36},
  btn_purple:   {l:32, r:32, t:28, b:36},
  btn_slate:    {l:32, r:32, t:28, b:36},
  btn_wood:     {l:32, r:32, t:28, b:36},
  btn_danger:   {l:32, r:32, t:28, b:36},
};
const DEFAULT_NINE = {l:24, r:24, t:24, b:24};

// Which button texture a fill colour maps to, so scenes.js/ui.js need no edit.
const BTN_BY_FILL = {};
WS.onceWorlds = ()=>{};   // (no-op hook; palette is read lazily below)

WS.Assets = {
  MANIFEST, ATLASES, SCALE, NINE,

  /** true if <key> resolved to a real PNG/atlas frame in this scene */
  has(scene,key){ return !!key && scene.textures.exists(key); },
  /** true if the project ships a file for this key (independent of load state) */
  shipped(key){ return key in MANIFEST; },

  /** queue every discovered asset onto a scene's loader. Call in preload(). */
  queue(scene){
    for(const key in MANIFEST){
      if(!scene.textures.exists(key)) scene.load.image(key, MANIFEST[key]);
    }
    for(const key in ATLASES){
      if(!scene.textures.exists(key)) scene.load.atlas(key, ATLASES[key].png, ATLASES[key].json);
    }
  },

  /** map a button fill colour to a shipped button skin, or null */
  btnSkin(fill){
    const C=WS.C;
    const m = {
      [C.clay]:'btn_primary', [C.teal]:'btn_teal', [0x8E6FC1]:'btn_purple',
      [0x6F8FA8]:'btn_slate', [0x9C6B3F]:'btn_wood', [0xE24B4A]:'btn_danger',
    };
    const k = m[fill];
    if(k && MANIFEST[k]) return k;
    // any other colour (e.g. the seven world accents) -> neutral base + setTint
    return MANIFEST['btn_base'] ? 'btn_base' : null;
  },
  /** true if this skin must be tinted to reach the requested colour */
  btnNeedsTint(skin){ return skin === 'btn_base'; },

  /** Add a 9-sliced panel/button at LOGICAL size w x h.
      NOTE: this deliberately does NOT use Phaser's NineSlice game object —
      NineSlice is WebGL-only and renders nothing under the Canvas renderer, so
      every button disappeared on any device that fell back to Canvas. Instead we
      bake the slice into a plain texture (canvas drawImage) and add an Image,
      which renders identically in both renderers and still supports
      setTint/setY/setAlpha, which the button press/disable states rely on. */
  nine(scene, key, x, y, w, h, originX, originY, tint){
    const outKey = key + '@' + Math.round(w) + 'x' + Math.round(h)
                 + (tint!=null ? '#'+(tint>>>0).toString(16) : '');
    if(!this.bakeNine(scene, key, outKey, w, h, tint)) return null;
    return scene.add.image(x, y, outKey)
      .setOrigin(originX==null?0:originX, originY==null?0:originY);
  },

  /** Bake a 9-sliced panel into a plain texture under <outKey>, at LOGICAL size
      (so existing add.image(x,y,outKey) call sites work unchanged).

      Done by hand on a 2D canvas rather than via Phaser's NineSlice +
      RenderTexture: RenderTexture.draw() does NOT honour the drawn object's
      scale, so a 2x-authored panel baked that way silently produced the
      top-left QUADRANT of the panel — which is mostly the flat inner fill, so
      the board frame and the tray shelf just vanished. drawImage() scales
      exactly as asked, every time.

      Returns true on success, false if the source asset is missing. */
  bakeNine(scene, srcKey, outKey, w, h, tint){
    if(scene.textures.exists(outKey)) return true;
    if(!scene.textures.exists(srcKey)) return false;
    try{
      const n = NINE[srcKey] || DEFAULT_NINE;
      const src = scene.textures.get(srcKey).getSourceImage();
      const sw = src.width, sh = src.height;
      const S = SCALE;
      // source insets (authored px) -> destination insets (logical px)
      const sl=n.l, sr=n.r, st=n.t, sb=n.b;
      const dl=sl/S, dr=sr/S, dt=st/S, db=sb/S;
      w = Math.max(Math.ceil(dl+dr)+1, Math.round(w));
      h = Math.max(Math.ceil(dt+db)+1, Math.round(h));

      // Compose the 9 slices into an OFFSCREEN canvas first. This matters for the
      // tint pass: 'destination-in' INTERSECTS on every draw, so masking with the
      // nine slices one-by-one clips the result down to the intersection of the
      // corners — i.e. nothing. The mask must be applied as a single image.
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const octx = off.getContext('2d');
      octx.imageSmoothingEnabled = true;
      const d = (sx,sy,sW,sH, dx,dy,dW,dH) => {
        if(sW<=0||sH<=0||dW<=0||dH<=0) return;
        octx.drawImage(src, sx,sy,sW,sH, dx,dy,dW,dH);
      };
      const smw = sw-sl-sr, smh = sh-st-sb;      // source middle
      const dmw = w-dl-dr,  dmh = h-dt-db;       // dest middle (stretched)
      d(0,0,sl,st,           0,0,dl,dt);                 // corners
      d(sw-sr,0,sr,st,       w-dr,0,dr,dt);
      d(0,sh-sb,sl,sb,       0,h-db,dl,db);
      d(sw-sr,sh-sb,sr,sb,   w-dr,h-db,dr,db);
      d(sl,0,smw,st,         dl,0,dmw,dt);               // edges
      d(sl,sh-sb,smw,sb,     dl,h-db,dmw,db);
      d(0,st,sl,smh,         0,dt,dl,dmh);
      d(sw-sr,st,sr,smh,     w-dr,dt,dr,dmh);
      d(sl,st,smw,smh,       dl,dt,dmw,dmh);             // middle

      const cv = scene.textures.createCanvas(outKey, w, h);
      const ctx = cv.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0);
      // Colour by BAKING the tint in rather than setTint(): Phaser's canvas
      // renderer doesn't tint reliably, so tinted buttons came out white (or
      // invisible) on any device that fell back to Canvas. multiply keeps the
      // grain and bevel; one destination-in pass restores the rounded alpha.
      if(tint != null){
        const hex = '#' + (tint>>>0).toString(16).padStart(6,'0').slice(-6);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = hex;
        ctx.fillRect(0,0,w,h);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(off, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }
      cv.refresh();
      return true;
    }catch(e){
      console.warn('[assets] bakeNine failed for', srcKey, e);
      return false;
    }
  },
};
})();

/* Wordslide — WS.SVGART: hand-authored vector illustrations (SVG) rasterized
   into textures at 2x. This is the "asset pack" layer: full-gradient skies,
   glowing suns, layered bezier mountain scenes with per-world set pieces,
   and a crisp UI icon set. All original artwork, CC-free. */
(function(){
"use strict";
const WS=window.WS;

const PAL={
  mudslide: {sky:["#F4D9A8","#F7E7C8","#FDF6E3"], far:"#C9A06B", mid:"#9C6B3F", near:"#6F4A28", bush:"#5E3F22"},
  landslide:{sky:["#E8D5B0","#F0E4CB","#FAF3E3"], far:"#BBA27E", mid:"#8A7355", near:"#5F4E38", bush:"#4A3D2C"},
  avalanche:{sky:["#BFD9EC","#DCEBF5","#F4FAFD"], far:"#AFC4D6", mid:"#7C99B0", near:"#54718A", bush:"#3E5A73"},
  volcano:  {sky:["#FFB98A","#F7D2B0","#FBE9D8"], far:"#C98A6A", mid:"#8C4A32", near:"#5A2418", bush:"#431A10"},
  sandstorm:{sky:["#F5D98E","#F7E7B8","#FDF6DC"], far:"#E0BC6E", mid:"#C99C4E", near:"#A37418", bush:"#8A6212"},
  waterfall:{sky:["#A8E0EE","#CDEEF5","#EFFBFD"], far:"#8FC9DC", mid:"#3E93AE", near:"#1C607E", bush:"#154E68"},
  blizzard: {sky:["#DCEAF4","#EDF5FA","#FFFFFF"], far:"#C7DAE8", mid:"#9DBBD0", near:"#6E93AC", bush:"#587E9A"},
  home:     {sky:["#7ECDEB","#BFE8F2","#FFF7E8"], far:"#A8D8E8", mid:"#7FB86A", near:"#4E8C3A", bush:"#3E7030"},
};

function pieces(k){
  if(k==="volcano") return `
    <path d="M120,560 L198,326 L238,326 L322,560 Z" fill="url(#gnear)"/>
    <path d="M198,326 L238,326 L252,368 L186,368 Z" fill="#3A130C"/>
    <circle cx="218" cy="330" r="86" fill="url(#glow)"/>
    <ellipse cx="218" cy="330" rx="44" ry="13" fill="url(#lava)"/>
    <path d="M206,338 C214,392 198,438 210,486" stroke="#FF7A3D" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M228,338 C232,376 224,404 230,428" stroke="#FFB25A" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>
    <circle cx="238" cy="296" r="16" fill="#8A7B72" opacity="0.5"/>
    <circle cx="260" cy="264" r="22" fill="#9A8B82" opacity="0.4"/>
    <circle cx="288" cy="224" r="30" fill="#AA9B92" opacity="0.3"/>`;
  if(k==="waterfall") return `
    <path d="M198,438 L300,438 L288,470 L212,470 Z" fill="url(#gmid)"/>
    <rect x="224" y="466" width="42" height="196" rx="8" fill="#EAF7FB" opacity="0.95"/>
    <rect x="232" y="466" width="12" height="196" rx="6" fill="#FFFFFF"/>
    <rect x="252" y="466" width="7" height="196" rx="3" fill="#BFE6F2" opacity="0.8"/>
    <ellipse cx="245" cy="668" rx="64" ry="16" fill="#FFFFFF" opacity="0.75"/>
    <ellipse cx="245" cy="676" rx="96" ry="20" fill="#DFF3F9" opacity="0.5"/>
    <circle cx="196" cy="660" r="7" fill="#FFFFFF" opacity="0.8"/>
    <circle cx="300" cy="664" r="9" fill="#FFFFFF" opacity="0.7"/>`;
  if(k==="sandstorm") return `
    <ellipse cx="140" cy="600" rx="230" ry="70" fill="url(#gmid)"/>
    <ellipse cx="370" cy="640" rx="260" ry="80" fill="url(#gnear)"/>
    <path d="M0,420 Q240,404 480,424" stroke="#E8CB8A" stroke-width="5" fill="none" opacity="0.55"/>
    <path d="M0,470 Q240,452 480,468" stroke="#E8CB8A" stroke-width="4" fill="none" opacity="0.4"/>
    <path d="M0,380 Q240,368 480,384" stroke="#F2DCA0" stroke-width="3" fill="none" opacity="0.4"/>`;
  if(k==="blizzard"||k==="avalanche") return `
    <path d="M96,505 L124,432 L152,505 Z" fill="#FFFFFF" opacity="0.9"/>
    <path d="M300,492 L332,410 L364,492 Z" fill="#FFFFFF" opacity="0.9"/>
    <g fill="#2E5E4A"><path d="M84,660 L104,596 L124,660 Z"/><path d="M88,632 L104,580 L120,632 Z"/>
    <path d="M196,676 L220,600 L244,676 Z"/><path d="M201,644 L220,584 L239,644 Z"/>
    <path d="M356,664 L378,596 L400,664 Z"/><path d="M361,634 L378,582 L395,634 Z"/></g>
    <g fill="#FFFFFF" opacity="0.85"><path d="M96,612 L104,588 L112,612 Z"/><path d="M210,616 L220,588 L230,616 Z"/><path d="M369,608 L378,586 L387,608 Z"/></g>`;
  if(k==="mudslide") return `
    <path d="M252,470 C286,516 228,560 262,606 C284,638 252,672 268,704" stroke="#7A5230" stroke-width="30" fill="none" stroke-linecap="round" opacity="0.95"/>
    <path d="M252,470 C286,516 228,560 262,606 C284,638 252,672 268,704" stroke="#96693F" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="236" cy="540" r="9" fill="#84796C"/><circle cx="286" cy="590" r="7" fill="#9A8F82"/>
    <circle cx="248" cy="648" r="8" fill="#84796C"/><circle cx="300" cy="500" r="6" fill="#9A8F82"/>`;
  if(k==="landslide") return `
    <path d="M290,430 L410,430 L480,560 L250,560 Z" fill="url(#gmid)" opacity="0.9"/>
    <circle cx="330" cy="540" r="14" fill="#9A8F82"/><circle cx="366" cy="552" r="18" fill="#84796C"/>
    <circle cx="406" cy="540" r="12" fill="#AFA396"/><circle cx="308" cy="556" r="9" fill="#84796C"/>
    <circle cx="352" cy="518" r="10" fill="#AFA396"/>`;
  return "";
}

WS.SVGART={
  scene(k){
    const p=PAL[k]||PAL.home;
    const sunX=k==="volcano"?84:396, sunY=86;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1708" viewBox="0 0 480 854">
<defs>
 <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${p.sky[0]}"/><stop offset="0.55" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/>
 </linearGradient>
 <radialGradient id="sun"><stop offset="0" stop-color="#FFF6D8" stop-opacity="0.95"/><stop offset="0.5" stop-color="#FFEDB0" stop-opacity="0.45"/><stop offset="1" stop-color="#FFEDB0" stop-opacity="0"/></radialGradient>
 <radialGradient id="glow"><stop offset="0" stop-color="#FF8A3D" stop-opacity="0.8"/><stop offset="1" stop-color="#FF8A3D" stop-opacity="0"/></radialGradient>
 <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD24A"/><stop offset="1" stop-color="#FF5A2D"/></linearGradient>
 <linearGradient id="gfar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.far}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>
 <linearGradient id="gmid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.near}"/></linearGradient>
 <linearGradient id="gnear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.near}"/><stop offset="1" stop-color="${p.bush}"/></linearGradient>
</defs>
<rect width="480" height="854" fill="url(#sky)"/>
<circle cx="${sunX}" cy="${sunY}" r="95" fill="url(#sun)"/>
<circle cx="${sunX}" cy="${sunY}" r="34" fill="#FFE9A8"/>
<g fill="#FFFFFF">
 <g opacity="0.55"><ellipse cx="120" cy="120" rx="44" ry="16"/><ellipse cx="150" cy="108" rx="30" ry="13"/><ellipse cx="92" cy="110" rx="24" ry="11"/></g>
 <g opacity="0.4"><ellipse cx="330" cy="180" rx="52" ry="17"/><ellipse cx="366" cy="167" rx="30" ry="12"/></g>
 <g opacity="0.3"><ellipse cx="210" cy="70" rx="38" ry="13"/><ellipse cx="238" cy="60" rx="22" ry="9"/></g>
</g>
<path d="M0,470 C60,430 110,415 170,438 C230,462 280,405 340,420 C395,434 440,410 480,428 L480,854 L0,854 Z" fill="url(#gfar)" opacity="0.85"/>
${pieces(k)}
<path d="M0,560 C50,520 120,505 180,530 C240,556 300,495 360,515 C420,536 450,520 480,530 L480,854 L0,854 Z" fill="url(#gmid)" opacity="0.95"/>
<path d="M0,680 C70,640 140,655 210,672 C280,690 340,640 410,660 C450,672 465,668 480,664 L480,854 L0,854 Z" fill="url(#gnear)"/>
<path d="M0,854 L0,802 C60,782 130,802 190,792 C270,779 340,802 480,788 L480,854 Z" fill="${p.bush}"/>
</svg>`;
  },

  icon(name){
    const S='stroke="#4A2E14" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"';
    const bodies={
      play:  `<path d="M17,12 L37,24 L17,36 Z" fill="#FFFFFF" ${S}/>`,
      cal:   `<rect x="9" y="12" width="30" height="26" rx="5" fill="#FFFFFF" ${S}/><line x1="9" y1="21" x2="39" y2="21" ${S}/><line x1="17" y1="8" x2="17" y2="15" ${S}/><line x1="31" y1="8" x2="31" y2="15" ${S}/><circle cx="18" cy="29" r="2.4" fill="#4A2E14"/><circle cx="27" cy="29" r="2.4" fill="#4A2E14"/>`,
      chart: `<rect x="10" y="24" width="7" height="14" rx="2" fill="#FFFFFF" ${S}/><rect x="20.5" y="16" width="7" height="22" rx="2" fill="#FFFFFF" ${S}/><rect x="31" y="10" width="7" height="28" rx="2" fill="#FFFFFF" ${S}/>`,
      gear:  `<circle cx="24" cy="24" r="9" fill="#FFFFFF" ${S}/><circle cx="24" cy="24" r="3.6" fill="#4A2E14"/><g ${S}><line x1="24" y1="9" x2="24" y2="14"/><line x1="24" y1="34" x2="24" y2="39"/><line x1="9" y1="24" x2="14" y2="24"/><line x1="34" y1="24" x2="39" y2="24"/><line x1="13.4" y1="13.4" x2="16.9" y2="16.9"/><line x1="31.1" y1="31.1" x2="34.6" y2="34.6"/><line x1="13.4" y1="34.6" x2="16.9" y2="31.1"/><line x1="31.1" y1="16.9" x2="34.6" y2="13.4"/></g>`,
      duel:  `<g ${S}><line x1="12" y1="12" x2="33" y2="33" stroke-width="5" stroke="#FFFFFF"/><line x1="12" y1="12" x2="33" y2="33"/><line x1="36" y1="12" x2="15" y2="33" stroke-width="5" stroke="#FFFFFF"/><line x1="36" y1="12" x2="15" y2="33"/><line x1="29" y1="35" x2="37" y2="35"/><line x1="11" y1="35" x2="19" y2="35"/></g>`,
      trash: `<path d="M13,17 L35,17 L32.5,38 L15.5,38 Z" fill="#FFFFFF" ${S}/><line x1="11" y1="14" x2="37" y2="14" ${S}/><path d="M20,14 L20,10 L28,10 L28,14" fill="none" ${S}/><line x1="20" y1="22" x2="20.8" y2="33" ${S}/><line x1="28" y1="22" x2="27.2" y2="33" ${S}/>`,
      flame: `<path d="M24,7 C28,15 35,19 35,28 A11,11 0 0 1 13,28 C13,21 18,17 19,12 C21,15 23,16 24,7 Z" fill="#F2A33C" ${S}/><path d="M24,20 C26,24 29,26 29,30 A5,5 0 0 1 19,30 C19,26 22,25 24,20 Z" fill="#FFE9A8" stroke="none"/>`,
      lock:  `<rect x="13" y="20" width="22" height="18" rx="5" fill="#FFFFFF" ${S}/><path d="M17,20 L17,15 A7,7 0 0 1 31,15 L31,20" fill="none" ${S}/><circle cx="24" cy="29" r="3" fill="#4A2E14"/>`,
      home:  `<path d="M10,24 L24,11 L38,24 L38,38 L28,38 L28,28 L20,28 L20,38 L10,38 Z" fill="#FFFFFF" ${S}/>`,
      share: `<circle cx="14" cy="24" r="5" fill="#FFFFFF" ${S}/><circle cx="34" cy="13" r="5" fill="#FFFFFF" ${S}/><circle cx="34" cy="35" r="5" fill="#FFFFFF" ${S}/><line x1="18" y1="21" x2="30" y2="15" ${S}/><line x1="18" y1="27" x2="30" y2="33" ${S}/>`,
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 48">${bodies[name]||bodies.play}</svg>`;
  },

  manifest(){
    const m=[];
    Object.keys(PAL).forEach(k=>m.push({key:"bg_"+k, svg:this.scene(k)}));
    ["play","cal","chart","gear","duel","trash","flame","lock","home","share"].forEach(n=>m.push({key:"ic_"+n, svg:this.icon(n)}));
    return m;
  },

  // rasterize an SVG string into the texture manager (renderer-agnostic)
  toTexture(scene,key,svg){
    return new Promise(res=>{
      if(scene.textures.exists(key)) return res();
      const img=new Image();
      img.onload=()=>{ try{ scene.textures.addImage(key,img); }catch(e){} res(); };
      img.onerror=()=>res();
      img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    });
  },
  loadAll(scene){
    return Promise.all(this.manifest().map(it=>this.toTexture(scene,it.key,it.svg)));
  },
};
})();

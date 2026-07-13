import Phaser from 'phaser';
import { WORDS } from './words.js';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';

window.Phaser = Phaser;
window.WORDLIST = WORDS;

// wait for the display font before booting (Phaser rasterizes text at create time)
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('600 20px "Baloo 2"'),
    document.fonts.load('800 20px "Baloo 2"'),
  ]).then(()=>document.fonts.ready),
  new Promise(r=>setTimeout(r,2500)),   // never block boot on a font
]);

// load game modules in order (each attaches to window.WS / reads globals)
// ORDER MATTERS. worlds.js runs WS.applyLayout() at module scope, and art/game/
// scenes/ui destructure the layout constants at *import* time — so worlds.js must
// land first or they capture stale geometry. health -> analytics -> econ come
// before monetize because monetize reports into all three.
fontsReady
  .then(() => import('./layout.js'))
  .then(() => import('./tuning.js'))
  .then(() => import('./worlds.js'))
  .then(() => import('./assets.js'))
  .then(() => import('./svgart.js'))
  .then(() => import('./art.js'))
  .then(() => import('./juice.js'))
  .then(() => import('./weather.js'))
  .then(() => import('./audio.js'))
  .then(() => import('./health.js'))
  .then(() => import('./analytics.js'))
  .then(() => import('./econ.js'))
  .then(() => import('./monetize.js'))
  .then(() => import('./game.js'))
  .then(() => import('./scenes.js'))
  .then(() => import('./ui.js'))
  .then(() => import('./boot.js'))
  .then(() => {
    // Off the critical path: the game must boot even if every SDK is dead.
    const WS = window.WS;
    WS.Analytics.init().then(() => WS.Analytics.track('app_open'));
    WS.initMonetize();
  });

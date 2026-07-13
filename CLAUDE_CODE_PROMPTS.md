# Wordslide — Claude Code prompts (current as of v2.5.0)

Open a terminal in `Wordslide/game/` and run `claude`. It auto-loads
`game/CLAUDE.md` (the full technical handoff — architecture, systems, gotchas,
test patterns). Run these as separate sessions, in order. Paste them as-is.

---

## Session 0 — Version control  ⟵ DO THIS FIRST (nothing is safe until it exists)
> This project has NO git repo and 640 files of real work. From the Wordslide
> root (one level above game/): create a `.gitignore` covering node_modules/,
> dist/, ios/, android/, `*.timestamp-*.mjs`, and OS junk; then `git init`,
> `git add -A`, and make the first commit ("v2.5.0 — full project baseline").
> Then create a PRIVATE GitHub repo named `wordslide` and push. Finally publish
> the `docs/` folder via GitHub Pages (Settings → Pages → main branch, /docs)
> and correct `WS.PRIVACY_URL` + `WS.TERMS_URL` in `game/src/worlds.js` to the
> real Pages URL — the current value GUESSES the username and a 404ing privacy
> link inside the app is a store rejection. Verify the URLs actually load.
> NOTE: do not archive the `Wordslide_Game_vN.html` exports out of the repo —
> they are the only pre-git history; commit them as-is.

## Session 1 — Live playtest + feel tuning  ⟵ highest gameplay value
> Run `npm install` then `npm run dev -- --host` and give me the LAN URL so I
> can play on my phone. While I playtest, watch the terminal/console for
> errors. I'll give you reactions like "letters come too slow" or "level 1
> target too high" — respond by tuning ONE knob at a time in src/tuning.js
> (dropEvery/ramp/minDrop per world, WS.levelTarget, WS.allowedLosses) or
> worlds.js (power costs, WS.GOLD_CHANCE), run `node tools/pacing.mjs` after
> each change, and tell me to refresh. Keep a running log of every change we
> settle on and write it into game/CLAUDE.md at the end.

Feel checklist while playing: Is level 1 relaxing? Do you first feel real
pressure around level 3–4? Is drag placement accurate? Does tap-to-place feel
better than drag? Are the praise tiers (NICE/GREAT/AMAZING) firing at the
right moments? Is the tumble animation satisfying or too slow?

## Session 2 — Level map progression screen
> Replace SelectScene's card list with a Wordscapes-style vertical level map:
> a winding path up a mountain, one node per world (7), locked nodes show the
> lock icon and unlock requirement, current world pulses, best score/level
> under each node. Reuse the art pipeline (drop-in PNGs via src/assets.js, or
> author SVG in src/svgart.js) and WS.ui helpers. Follow the IIFE/window.WS
> module pattern and the texture-baking rule in CLAUDE.md (no per-frame
> Graphics for static art).

## Session 3 — Device builds
> Follow NATIVE_BUILD.md: `npm run verify`, generate icons/splash with
> `npx capacitor-assets generate` (source art exists at game/assets/icon.png +
> splash.png), `npx cap add android`, `npm run cap:sync`, open Android Studio,
> and walk me through a debug install on my phone. Verify: haptics work, audio
> starts after first touch, no letterbox color glitch around the notch, 60fps,
> and Settings → Diagnostics reads amber (dev build) not red.
> Then repeat for iOS on the Mac.

## Session 4 — Monetization go-live (only when store accounts exist)
> src/monetize.js is already fully integrated (AdMob + RevenueCat + consent/ATT
> ordering). The work is CONFIGURATION: fill every id in WS.MONETIZE (AdMob app
> + unit ids, RevenueCat keys), put the AdMob app id in AndroidManifest.xml and
> Info.plist, add NSUserTrackingUsageDescription, create the four products in
> both stores and map them to the `premium` entitlement in RevenueCat. Then run
> the on-device checklist in store/STORE_SUBMISSION.md §C (Diagnostics all
> green, sandbox purchase, restore after reinstall, rewarded-ad
> cancel-grants-nothing).

## Session 5 — Online async duel (the big one, after launch)
> Build a thin Supabase backend for async duels: anonymous auth, a matches
> table {id, seed, p1_score, p2_score, status}, and src/online.js in the WS
> module style. Both players play the same seeded letter stream — all board
> randomness already flows through this.rand/WS.mulberry32, so reuse the duel
> mode's seed plumbing and the duelend scene for results.

## Session 6 — Composed music (optional polish)
> The music in src/audio.js is generative (scheduled oscillator notes). Write
> proper 8-bar looping chiptune-style compositions per world using the same
> WebAudio scheduling (chord progressions + melody + bass), keeping the
> zero-asset approach, volume discipline (~0.03), and the settings toggle.

---

## Working rules for every session
- `game/CLAUDE.md` is the source of truth; update it when you change systems.
- The gate is `npm test` (layout matrix + economy + validateMove) then
  `npm run build` then `node ../store/tools/shots.mjs`. Run it on the HOST —
  the Cowork sandbox mount serves stale/torn reads and its results are not
  evidence.
- After touching src/game.js, `node test/validate.test.mjs` must pass (the
  validateMove suite is committed now — no more scratch-buffer verification).
- Never put static art in per-frame Graphics — bake to textures (art.js),
  author SVG (svgart.js), or drop PNGs into src/assets/ (assets.js picks them
  up by filename).
- Regenerate the standalone export after src changes:
  `node build_standalone.mjs ../Wordslide_Game_v11.html ../Wordslide_Game_v12.html`
  so the folder always has a double-clickable build.
- Commit at the end of every session. Cowork (this assistant) handles
  research/design/doc rounds — leave notes in HANDOFF/ for anything you want
  reviewed there.

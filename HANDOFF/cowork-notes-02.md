# Cowork notes 02 — Head Design Engineer review (full project audit)
*July 12, 2026. Two passes: software engineering, then design/UX/UI. Cross-referenced
against the Datum/TenderBridge lesson ledgers (Nick's other projects) so their expensive
mistakes are not repeated here.*

---

## PASS 1 — Software engineering

### Verdict
The codebase is in unusually good shape for a solo project: a pure, device-matrix-tested
layout solver; one entitlement predicate; a durable health artifact (Diagnostics screen);
a declared analytics taxonomy; a ledgered coin economy whose numbers are modelled, not
guessed; and Canvas-renderer fallbacks for every WebGL-only trap already found the hard
way. The architecture (IIFE modules on `window.WS`, strict import order, texture-baking
rule) is consistently honoured across all 20 source files.

### E1 — CRITICAL: there is no version control. Anywhere.
640 files, no `.git` at the root or in `game/`. The project's only history is
`Wordslide_Game_v1..v11.html` snapshots. Every single lesson in the sibling-project
ledgers — deploy drift, truncated files, "the only copy died with the session",
"a gate run only counts against a known file" — is a version-control lesson. One bad
overwrite (and this environment demonstrably makes them: see E2) loses work with no
recovery path. **Recommendation: `git init` + first commit is the single highest-value
30 minutes available, done on Nick's machine via Claude Code, not from the sandbox**
(the sandbox mount can't manage `.git/index.lock` — documented in the Datum ledger).

### E2 — The sandbox mount lies (confirmed live this session)
Bash-side reads of this project are stale/torn: `wc -l` reported monetize.js at 34 lines
(really 393), `node` threw syntax errors on a file that is valid on the host, and `grep`
called worlds.js a binary file. The warning already in CLAUDE.md is correct and current.
Consequence: **no test run, build, or grep from the Cowork sandbox is evidence.** Gates
must run on the host (Claude Code). This is the same disease as TenderBridge's
"tests passed somewhere" incident — the instrument, not the code.

### E3 — Documentation drift (the "marketing claims rot" lesson, aimed at our own docs)
- `game/README.md` describes the **v0.1 swipe-to-trace gravity game** — a mechanic that
  was abandoned. Anyone onboarding from the README learns the wrong game. It also says
  "~14k-word dictionary" (real: 269,870).
- `START_HERE.md` says current playable is v6 and tells you to playtest **v4**;
  CLAUDE.md says current export is **v7**; the folder's latest is **v11**.
- `WS.VERSION` in worlds.js is `"2.4.0"`; package.json is `2.5.0`. The stale string is
  displayed on the Home screen and in Settings.
- `CLAUDE_CODE_PROMPTS.md` Session 4 says "replace the stubs in monetize.js" — already
  done in v2.5.
- BACKGROUNDS addendum says `bg_home` is still missing — it now exists and is wired.
All small, all cheap, and the ledger's rule applies: a doc that contradicts the code
sends the next agent debugging the wrong thing for a day.

### E4 — The core gameplay function has no committed test
`validateMove()` — the function every point flows through — is covered by "11 node unit
tests" whose harness is described as "see git/README or ask". There is no git, and no
such file exists in the repo. Per the ledger's tattooed rule: **a verification that
lives in a scratch buffer is not a test.** The committed suite (`test/run-tests.mjs`)
covers layout + economy well, but not one line of game.js. Recommendation: commit the
validateMove harness as `test/validate.test.mjs`, wired into `npm test`.

### E5 — Analytics bugs (metrics that will quietly lie)
1. `word_played.len` is broken: `res.words[0].length` reads `.length` of a
   `{word,pts,tiles}` object → `undefined` → sent as the string `"undefined"` on every
   event. Should be `res.main.length`.
2. `level_start` fires only in `create()`. `nextLevel()` never emits it, so levels 2+
   within a run have `level_end` events with no matching start — every progression
   funnel built on this pair will be wrong from day one.
3. After a Second Wind, `counted` stays true, so the run's *final* death emits no
   `level_end` at all. Continue-then-die runs vanish from the funnel.
4. `offer_shown` is only tracked when `near` is true, but the ad-path button is shown
   regardless — offer CTR will be miscomputed.
These are exactly the "signups counted off the row birthday" class from the ledger:
cheap to fix now, weeks of misdirected tuning if discovered via a dashboard later.

### E6 — Dead/unwired economy faucet
`WS.Econ.REWARDED_AD_COINS = 60` ("watching a rewarded ad, outside a run") has no
placement — no button anywhere grants it. Either wire it into the Shop or delete the
constant before it becomes a doc/code contradiction.

### E7 — Known, deliberate release blockers (correctly designed, still open)
- `WS.MONETIZE` IDs are placeholders; `isProd()` correctly keeps the build on test ad
  units and refuses RevenueCat until filled. Needs: AdMob, RevenueCat, App Store
  Connect, Play Console accounts + products created.
- `WS.PRIVACY_URL` guesses the GitHub username (`nickpotter.github.io`); `docs/` is not
  yet published to Pages. In-app 404 = store rejection.
- Native projects (`npx cap add ios/android`) have never been generated; no real-device
  run has happened. All pacing is machine-tested, not hand-felt.

### E8 — Smaller notes
- `boot.js` re-waits up to 2.5s for fonts that `main.js` already awaited — worst-case
  double delay on flaky connections. Harmless but free to remove.
- Daily streak "yesterday" math uses local device time; a timezone change can break a
  streak. Acceptable for v1; noted for the support inbox.
- `vite.config.js.timestamp-*.mjs` junk (15 files) should be cleaned/ignored.
- `svgart.backup.js` and `gen_worlds_v1_backup.py` are the `.bak`-in-deploy-folder
  pattern the TenderBridge ledger warns about; move to an archive once git exists.

---

## PASS 2 — Design / UX / UI

### Verdict
The v7 Midjourney background set is genuinely strong — cohesive, saturated, correctly
composed for the "top and bottom bands are all the player sees" reality, and the
measured-luminance per-world scrim (blizzard 0.44, volcano 0.14) is exactly the kind of
craft that keeps tiles legible on snow. The motion layer (WS.Juice easing vocabulary,
level-entry weather sweep, word wave) gives the game real production feel. The remaining
art gap is precisely what the BACKGROUNDS addendum said: **the board, tiles and UI are
now the weakest thing on screen, and they're what the player stares at all session.**

### D1 — The three assets that sell the game are still placeholder-grade
Store icon (`icon-512.png`) and feature graphic are flat vector shapes that don't match
the painterly in-game world; the letter tile is clean wood but flat next to the
backgrounds. The Art Bible's own advice stands: **these three (icon, tile, logo) drive
install rate more than everything else combined and are the correct place for the
$500–1,500 human-artist spend.** Nothing in-code blocks this: drop-in PNG paths are
already wired.

### D2 — Bonus-square legibility and the colourblind claim
The shipped `cell_*` PNGs are washed-out pastels whose distinguishing shape is a ~3px
corner glyph. At 28px cells under a 0.9-alpha grid over a busy painting, I doubt 2W vs
3L reads at a glance — and the design doc *claims* full colourblind playability by
shape. That claim needs to survive a real-device screenshot check (blizzard and
sandstorm especially), or the cells need a contrast pass. This is the "headline claim
your own data contradicts" lesson, in pixel form.

### D3 — Power buttons are still text
`ic_slow/shuffle/vowels/purge/golden` don't exist (no `assets/icons/` dir shipped); the
five powers render as 11px text labels. The Art Bible flags this as the neediest icon
gap. Cheap win, big perceived-quality lift.

### D4 — Mudslide background is the one weak plate
It came back square (no `--ar 9:16`) and is cover-cropped harder than its siblings.
It's also the FIRST world every new player sees. Worth the one regeneration.

### D5 — UX systems are in good shape
Tap-to-place coexisting with drag (with slot-based hit-testing so tiles are grabbable
mid-animation), next-letter preview queue, pause that doesn't kill the run, praise
tiers, near-miss-gated Second Wind with an always-free ad path, published chest odds,
no mid-level interstitials, 90s interstitial gap. The monetization posture ("the
category leaders' 1-star reviews are our acquisition strategy") is coherent and
review-safe. Onboarding math: first win ≈ 3.3 minutes at current Mudslide L1 tuning —
at the long end; real-device feel will decide.

### D6 — What only a phone can answer (unchanged, still the top design item)
All pacing values are first-pass and machine-verified only. The feel checklist in
CLAUDE_CODE_PROMPTS Session 1 (is L1 relaxing? does pressure arrive at L3–4? does drag
placement feel accurate?) is the single most important unanswered design question in
the project.

---

## Actions taken this session (July 13, Cowork)
- Fixed all four analytics bugs (E5) in game.js: `word_played.len`,
  `level_start` on `nextLevel()`, `level_end` after Second Wind, `offer_shown`
  on both offer paths.
- Bumped `WS.VERSION` to 2.5.0 (E3).
- Committed `test/validate.test.mjs` (E4) — 20+ assertions over placement,
  connectivity, dictionary, cross-words, and every scoring multiplier; wired
  into `npm test`. **Must be run on the host** (sandbox reads are torn); if any
  expectation disagrees with the real engine, trust the engine and tell me.
- Added the 5 power icons (D3) to svgart.js (`ic_slow/shuffle/vowels/purge/
  golden`) — powers no longer render as text; shipped PNGs still override.
- Doc-truth pass (E3): game/README.md rewritten (was describing the abandoned
  v0.1 game), START_HERE.md synced to v11/v2.5, CLAUDE_CODE_PROMPTS.md updated
  (Session 4 is now config-only) and **Session 0 (git init + GitHub Pages +
  PRIVACY_URL fix) added — run it first.**
- CLAUDE.md updated with a v2.5.1 section recording all of the above.

Not done here (needs Nick / host): git init (Session 0), host `npm test` run,
mudslide regeneration (`--ar 9:16`, same `--sref`), REWARDED_AD_COINS decision,
device check of bonus-square legibility, everything requiring store accounts.

## Recommended priority order (both hats on)
1. **git init + commit everything** (Nick's machine, Claude Code). Nothing else is safe
   until this exists.
2. Fix the four analytics bugs (E5) — before any real telemetry ever flows.
3. Doc-truth pass (E3): rewrite game/README, sync START_HERE/CLAUDE.md version pointers,
   bump WS.VERSION.
4. Commit the validateMove test harness (E4).
5. Real-device playtest + pacing feel pass (D6) — needs Nick + phone.
6. Art: regenerate mudslide (D4), power icons (D3), then the human-artist trio (D1).
7. Store plumbing when accounts exist (E7): IDs, GitHub Pages, native builds.

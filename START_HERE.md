# Wordslide — Start Here

Read this first; deep code detail in `game/CLAUDE.md`.

## What Wordslide is

**"Spell fast. Before it falls."** A Words-With-Friends-style 15×15 bonus-square
board — but solo and real-time. Letters tumble down the left side of the screen
into your 7-slot tray; new letters push old ones off the edge. Drag letters onto
the board, spell connected crossword-style words, and hit the level's score
target before you lose too many letters (10 allowed on level 1, fewer each
level). Seven fall-themed worlds: Mudslide, Landslide (boulders), Avalanche
(bursts), Volcano (burning embers), Sandstorm (tray-scrambling gusts),
Waterfall (fast), Blizzard (frost). Target: native iOS + Android, phones & tablets.

## What's in this folder

| File / folder | What it is |
|---|---|
| `START_HERE.md` | This handoff. |
| `Wordslide_Game_v11.html` | **Current playable** — double-click (needs internet for the Phaser CDN). v1–v10 are superseded. |
| `game/` | **The real codebase**: Phaser 3 + Vite + Capacitor. See `game/CLAUDE.md`. |
| `game/NATIVE_BUILD.md` + `store/STORE_SUBMISSION.md` | App Store / Play Store shipping guide + submission pack. |
| `Wordslide_Design_Document.pdf` | Game design document v2.9 (generated from source values). |
| `Wordslide_How_To_Play.pdf` | Player-facing manual. |
| `ART_BIBLE.md` + `BACKGROUNDS_MIDJOURNEY_PACK.md` | Art spec + background prompt pack. |
| `HANDOFF/` | Cowork ⇄ Claude Code session notes (newest: cowork-notes-02, full audit). |
| `Wordslide_Design_UX_Research_Panel.docx`, `_Research_and_Design_Brief.docx`, `_Pitch_Deck.pptx` | June 2026 concept docs (pre-pivot background). |

## Status — v2.5.0 (release layer built; store submission blocked on IDs)

Machine-playtested end to end; live AdMob + RevenueCat + Firebase integrations
exist but run on test/placeholder IDs by design until store accounts exist.
The seven Midjourney world backgrounds are in. Full audit and priority list:
`HANDOFF/cowork-notes-02.md`. **Top open items: git init (no version control
yet!), real-device feel-tuning, monetization IDs, publish `docs/` to GitHub
Pages and fix `WS.PRIVACY_URL`.**

## How to continue

1. Playtest `Wordslide_Game_v11.html` (or `cd game && npm install && npm run dev`).
2. Tune pacing in `game/src/tuning.js` (dropEvery/ramp, levelTarget, allowedLosses).
3. Use `CLAUDE_CODE_PROMPTS.md` to continue development in Claude Code (Session 0 = git init, do it first).
4. Ship natively via `game/NATIVE_BUILD.md`.

## Gotchas

- **No git yet** — until Session 0 runs, the only history is the vN.html exports.
- Cowork chats don't sync between machines — this file + `game/CLAUDE.md` are
  the portable memory; keep them current.
- The Cowork sandbox bash mount serves **stale/torn reads** of modified files:
  verify with the file tools, run builds/tests on the host.
- `game/` has no `node_modules`; run `npm install` fresh.
- Regenerate the standalone HTML after src changes: `node game/build_standalone.mjs
  <prevExport> <outFile>` (reuses the previous export's font/wordlist preamble,
  embeds current src + assets).

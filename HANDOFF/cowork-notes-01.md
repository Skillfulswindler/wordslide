# Cowork notes 01 — pacing analysis + profitability research battery
*(For Claude Code session 1 and Nick. Cowork will not touch `src/` while the
tuning session is live — apply these through the live session.)*

## A. Quantitative pacing analysis (model: avg word = 3.6 tiles, 16 pts)

Max sustainable seconds-per-word before the tray falls behind:

| World (order) | L1 | L3 | L5 | L7 |
|---|---|---|---|---|
| Mudslide (1) | 19.4s | 16.7s | 14.0s | 11.2s |
| Landslide (2) | 18.0s | 15.4s | 12.8s | 10.2s |
| **Avalanche (3)** | **11.4s** | **10.0s** | 8.5s | 7.1s |
| Volcano (4) | 16.6s | 14.2s | 11.8s | 9.4s |
| Sandstorm (5) | 15.8s | 13.5s | 11.2s | 8.9s |
| Waterfall (6) | 13.7s | 11.7s | 9.6s | 7.6s |
| Blizzard (7) | 15.1s | 13.0s | 10.8s | 8.6s |

Findings → recommended knob changes (verify by feel, one at a time):
1. **Avalanche is mis-ordered** — at 3 letters/wave it's harder than Waterfall.
   Fix: `waveCount 3→2` or `waveEvery 9500→12500`. Target L1 ≈ 17s.
2. **Mudslide L1 is borderline stressful** for a true beginner (19.4s vs the
   15–20s a casual player needs). Fix: `dropEvery 5400→6400` (L1 ≈ 23s).
3. **High levels balloon in duration**: words-needed grows 10→44 by L10 while
   the time budget shrinks — L8+ becomes a 6–8 minute grind. Fix: level
   target `150+60·(L−1)` → `150+45·(L−1)`, and let combo scoring carry the
   rest. Loss-slack curve (54s at L1 → 8s at L8) is a good tension shape — keep.

## B. Research battery — player psychology & profitability
Key findings (sources at bottom):
- **Variable rewards** are the strongest retention lever (anticipation, not the
  reward, drives the dopamine loop). Streaks work because losing progress hurts
  more than gaining feels good. We have streaks/goals/achievements; we lack any
  variable-schedule reward.
- **Progress-proximity spending**: players spend when *close* to a goal — the
  moment to offer help is at near-miss, not at start. Our Second Wind is
  correctly placed. A "finish the level for X" offer at a near-miss loss would
  be the highest-converting placement when IAP exists.
- **Colors**: orange/red CTAs click 32–40% higher; orange gives urgency without
  red's anxiety response. Our clay-orange Play button is already correct; use
  gold/orange for all future purchase/reward CTAs, teal for safe/utility, never
  red for calm contexts. Warm cream palette matches the 2026 soft-warm trend.
- **Economy structure** (Wordscapes/Royal Match pattern): ONE soft currency
  with clear sources (level clears, events, achievements, rewarded ads) and
  sinks (boosters, continues, cosmetics). Royal Match's pass: $9.99 for ~$219
  of perceived value, 30 tiers, free+premium tracks — value-stacking is the
  formula. Wordscapes runs relentless time-limited collection events
  (scarcity by timer) — that cadence, not the puzzles, drives its revenue.
- **Benchmarks**: casual ARPDAU $0.08–0.15; hybrid (ads+IAP) ≈ +28% ARPU vs
  ads-only; D1 30–35% / D30 25%+ is the retention bar; LTV:CAC 3:1.
- **Pay-once trend**: 35% of players now prefer pay-once — our $4.99-forever
  remove-ads is well positioned.

## C. Profitability roadmap for Wordslide (priority order)
1. **Coins (soft currency)** — earn: level clears (20+5·L), daily first-run
   chest, achievements, events; spend: start-run booster pack (⚡30 head
   start, 60c), mid-run continue (alternative to rewarded ad), cosmetics.
   *Cowork can build this + UI next round.*
2. **Daily Mystery Chest** — variable reward after first run of the day
   (coins 10–60, weighted; occasionally a power). Transparent odds, no paid
   loot boxes (regulatory + review safety). *Cowork can build.*
3. **Tile-skin cosmetics** — 5–6 skins (ice, lava, gold leaf, wood, night)
   via the SVG pipeline; coin-priced; one premium-only later. Pure-margin,
   review-safe monetization. *Cowork can build the system + 3 skins.*
4. **Weekly event scaffold** — "This week's slide": one world + modifier
   (e.g., double embers), separate local leaderboard, coin prize, countdown
   timer on home. Scarcity-by-timer, Wordscapes-style. *Cowork can build local
   version; server later.*
5. **Rewards pass** — design after coins exist: 30 tiers on the existing XP
   curve, free track always, premium track when IAP lands (Session 4).
6. **Never**: pay-to-win in duels, paid randomness, interstitials mid-level.
   The category leaders' 1-star reviews are our acquisition strategy.

## D. Requests to Claude Code (this session)
- Apply A.1–A.3 through live feel-testing with Nick.
- Report which praise-tier thresholds actually fire (praise() in game.js) —
  if NICE fires on most words, raise 25→28.
- Note in your report: agreed coin values shown above so Cowork's economy
  build lands on tuned numbers.

Sources: lancaric.me/monetization-mobile-games · elevatix.io behavioral insights ·
uxmag.com hot-streak psychology · cxl.com/blog/which-color-converts-the-best ·
usertesting.com color-ux-conversion · gamemakers.com royal-match battle pass ·
ludocious.com worldscapes live-ops · gamegrowthadvisor.com F2P models 2026 ·
appagent.com retention benchmarks · unity.com game economy guide

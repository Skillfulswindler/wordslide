# Wordslide — shipping to the App Store & Play Store

The game is one web build wrapped by Capacitor. Everything below runs on your
machine (Android Studio for Android; a Mac with Xcode for iOS).

---

## 0. One-time setup

```bash
cd game
npm install              # now also pulls AdMob, RevenueCat, Firebase Analytics
npm run verify           # tests + build. Must be clean before you go further.
npx cap add android      # first time only
npx cap add ios          # first time only (Mac)
```

## 1. Every release

```bash
npm run cap:sync         # rebuild web + copy into native projects
npx cap open android     # or: npx cap open ios
```

Then build / sign / upload from Android Studio or Xcode as usual.

---

## 2. The gate — run all three, in this order

```bash
npm test                          # 87 assertions: layout device matrix + economy
npm run build                     # must be clean
node ../store/tools/shots.mjs     # real screenshots + zero console errors
```

`npm test` covers the two things that are expensive to get wrong and impossible to
eyeball: **the layout on ten real devices** (nothing under a notch, nothing under a
gesture bar, tray never overlapping the board) and **the coin economy** (a spend can
never go negative; the chest's published odds are its actual odds).

`shots.mjs` is also the playtest. It fails on any console error — which matters
because a JS error inside a Phaser scene does *not* blank the page. The canvas just
stops updating, and a screenshot of a frozen canvas looks perfectly fine.
"It rendered" is not "it worked".

---

## 3. Monetization — LIVE, but the ids are placeholders

`src/monetize.js` is no longer stubbed. It contains real AdMob + RevenueCat
integration. **Everything is driven from one config block, `WS.MONETIZE`.**

### Fill these in before a store build

| What | Where | Notes |
|---|---|---|
| AdMob app id | `WS.MONETIZE.admob.appId` **and** `AndroidManifest.xml` / `Info.plist` | Both places, or the app crashes on launch |
| AdMob interstitial + rewarded unit ids | `WS.MONETIZE.admob.*` | per platform |
| RevenueCat public API keys | `WS.MONETIZE.revenuecat.apiKey` | `goog_…` / `appl_…` |
| Product ids | `WS.MONETIZE.revenuecat.products` | must match App Store Connect **and** Play Console |
| Entitlement id | `WS.MONETIZE.revenuecat.entitlement` | default `premium` |

### Why the game ships with test ad units and refuses to run RevenueCat

`WS.MONETIZE.isProd()` is a **positive** check that the real ids were actually filled
in. Until they are:

- ads use **Google's public test units** (which always fill), and
- RevenueCat **refuses to initialise**, and records `unconfigured` in Diagnostics.

That is deliberate, not a bug. Firing real ad requests from a dev or CI build
generates invalid impressions, and AdMob **bans accounts** for that — it does not warn
them. A placeholder id can therefore never silently fall through to a live ad call.

### Products to create

| Product | Type | Price | Grants | Entitlement |
|---|---|---|---|---|
| `com.wordslide.game.removeads` | non-consumable | $4.99 | ads off, forever | `premium` |
| `com.wordslide.game.coins1200` | consumable | $0.99 | 1,200 coins | — |
| `com.wordslide.game.coins3000` | consumable | $1.99 | 3,000 coins | — |
| `com.wordslide.game.coins8000` | consumable | $4.99 | 8,000 coins | — |

Product ids are **permanent** once created — they cannot be renamed — so they name the
coin amount they actually grant. If you retune the packs in `src/econ.js`, do **not**
change what an existing id grants downward; add a new id instead.

### Consent order (do not "simplify" this)

```
UMP consent form  →  (only if not declined)  ATT prompt  →  initialise ad SDK
```

Showing Apple's ATT prompt to someone who already declined tracking on the GDPR form
is a **documented App Store rejection**. Ads are never requested before consent
resolves. iOS also needs `NSUserTrackingUsageDescription` in Info.plist, or the ATT
prompt silently never appears at all.

### The rules the money layer holds

1. **One entitlement predicate.** `WS.Entitle.isPremium()` is the only definition of
   "this player paid". Nothing else may decide. Three surfaces with three answers is
   how you serve ads to a paying customer.
2. **The receipt is the truth; localStorage is only a cache.** RevenueCat overrides
   the local flag in *both* directions — it grants, and it revokes on refund or
   chargeback. But being offline is **not** a revocation: the cached answer is kept,
   so a paying player is never locked out of what they bought because their train
   went into a tunnel.
3. **A rewarded ad grants only on genuine completion.** Never on dismiss, never on
   error. Granting on failure teaches players to cancel the ad and take the reward.
4. **A zero is not a fact until you know the source was healthy** — see below.

---

## 4. Diagnostics — the screen that saves you weeks

**Settings → Diagnostics.** ADS / IAP / ANALYTICS each report:

- **green** — initialised and working
- **amber** — deliberately inert (dev/web build). *Not an error — but not evidence
  that anything works, either.*
- **red** — it tried and it broke
- **grey** — it never ran

Check this on a real device before submitting. It exists because these two look
**identical** in a revenue dashboard and demand opposite responses:

> "$0 of ad revenue because nobody watched an ad"
> "$0 of ad revenue because AdMob never initialised"

Without a health record you cannot tell them apart, and you will spend weeks tuning a
funnel that was never running. Same for "no purchases" versus "the buy button throws".

---

## 5. Device tuning

Layout is solved at boot by `src/layout.js` (`WS.solveLayout`, a pure function), which
runs **before every other module** — art/game/scenes/ui destructure the layout
constants at import time, so anything loading first would capture stale geometry.

- The canvas is 480 wide; its **height follows the device aspect** (clamped 800–920),
  so a 20:9 phone gets a taller canvas instead of thick letterbox bars.
- Safe-area insets come from CSS `env()` (the only source of truth for a notch), and
  **only the part of an inset that actually overlaps the canvas is charged against
  it** — the rest lands harmlessly in the letterbox. On an iPhone 15 that is 12px of
  the 59px notch, not 59px, so the board keeps its full 28px cells.
- The lower stack (tray → preview → buttons → powers) is **bottom-anchored**, so it
  always clears the gesture bar. A Play button under the home indicator cannot be
  pressed at all, and that is invisible until a reviewer finds it.
- Tablets keep the board's shape and letterbox at the sides; the page behind the canvas
  is painted with the world's sky colour so the bars read as intentional matting.

**Lock the app to portrait** (iOS Deployment Info; Android
`android:screenOrientation="portrait"`). The solver assumes portrait.

---

## 6. Icons & splash

Source art is generated by `python3 store/tools/gen_store_art.py` into
`game/assets/icon.png` (1024²) and `game/assets/splash.png` (2732²). Then:

```bash
npx capacitor-assets generate
```

## 7. Store listing, privacy forms, screenshots

See **`store/STORE_SUBMISSION.md`** — Play Data Safety answers, Apple
privacy-nutrition answers, listing copy, and the full release checklist.

Privacy policy and terms live in `docs/` and must be published to GitHub Pages before
submission. **Then correct `WS.PRIVACY_URL` in `src/worlds.js`** — it currently guesses
your GitHub username, and a privacy link that 404s from inside the app is a rejection.

## 8. Haptics

`WS.buzz()` uses `navigator.vibrate` and prefers Capacitor Haptics when present.
Already in `package.json`; no code changes needed.

## 9. Later: online multiplayer (deferred by design)

Duel is pass-and-play; the daily board is identical for everyone via seeded RNG.
Neither needs a server. For async PvP, add Supabase, store `{seed, moves[], scores}`
per match, and reuse the seeded-board code. All randomness already flows through
`this.rand`, which is the hard part.

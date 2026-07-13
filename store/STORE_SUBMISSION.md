# Wordslide — store submission pack

Everything a reviewer will ask for, answered. Three parts:
**A.** the privacy forms (the part that gets apps rejected),
**B.** listing copy, **C.** the release checklist.

> **The rule underneath all of this:** every answer below must match what the code
> *actually does*. The moment the app ships an SDK the form does not mention — or the
> form claims a protection the code does not implement — the listing is lying, and
> both stores now audit for exactly that. If you change `src/monetize.js` or
> `src/analytics.js`, come back here and to `docs/privacy.html` and change them too.

---

## A. Privacy forms

### What Wordslide actually collects (the source of truth for both forms)

| Collector | Data | Linked to identity? | Used for tracking? |
|---|---|---|---|
| **Google AdMob** | Advertising ID (IDFA/AAID), IP address, coarse location from IP, device model/OS, ad interactions | No | **Yes** (if the player consents) |
| **Firebase Analytics** | App-instance ID, device model/OS, country from IP, gameplay + purchase events | No | No |
| **RevenueCat / Apple / Google** | Anonymous purchase ID, receipt, purchase history | No | No |
| **The game itself** | Scores, progress, coins, settings — **device-local only, never transmitted** | n/a | n/a |

No name, email, phone, address, contacts, photos, precise location, or card details. No data sold.

---

### A1. Google Play — Data Safety form

**Does your app collect or share any of the required user data types?** → **Yes**

| Section | Answer |
|---|---|
| **Location → Approximate location** | Collected: **Yes** · Shared: **Yes** · Purpose: *Advertising or marketing*, *Analytics* · Optional: **Yes** (consent form) |
| **Personal info** | **No** — none collected |
| **Financial info → Purchase history** | Collected: **Yes** · Shared: **No** · Purpose: *App functionality* (entitlements, restore) · Required |
| **App activity → App interactions** | Collected: **Yes** · Shared: **No** · Purpose: *Analytics* · Optional: **Yes** (Settings toggle) |
| **App info & performance → Crash logs / Diagnostics** | Collected: **Yes** · Purpose: *Analytics* |
| **Device or other IDs** | Collected: **Yes** · Shared: **Yes** · Purpose: *Advertising or marketing* · Optional: **Yes** (consent form) |

- **Is all user data encrypted in transit?** → **Yes** (all SDKs use HTTPS/TLS)
- **Can users request data deletion?** → **Yes** — provide the support email; local data is deleted by uninstalling.
- **Data collection is optional** for ads/analytics → **true**, and it must stay true: the UMP consent form and the Settings analytics toggle are what make that answer honest.
- **Ads:** declare **“This app contains ads.”**
- **Target audience:** 13+. **Do not** opt into the Designed-for-Families / child-directed programme — the code sets `tagForChildDirectedTreatment: false`, and the two must agree.

---

### A2. Apple — App Privacy (nutrition label)

Declare three categories:

1. **Identifiers → Device ID**
   - Used for: **Third-Party Advertising**, *Analytics*
   - Linked to the user: **No** · **Used for Tracking: YES**
2. **Purchases → Purchase History**
   - Used for: **App Functionality** · Linked: **No** · Tracking: No
3. **Usage Data → Product Interaction**
   - Used for: **Analytics** · Linked: **No** · Tracking: No

**Because “Used for Tracking = Yes”, App Tracking Transparency is mandatory.** It is implemented in
`src/monetize.js` → `WS.Ads.init()`, and the *order* matters:

> UMP consent form → **only if the player did not decline** → ATT prompt → initialise the ad SDK.

Showing ATT to someone who already declined tracking on the GDPR form is a documented rejection
reason, not a warning. Do not "simplify" that ordering.

**Other App Store answers**
- Age rating: **4+** (no objectionable content). Ads and IAP do not force a higher rating.
- **Encryption / export compliance:** you use only standard HTTPS → answer **“No”** to
  *"Does your app use non-exempt encryption?"* (`ITSAppUsesNonExemptEncryption = false` in Info.plist).
- Privacy policy URL: **required**, see below.
- **Restore purchases** control: **required** for a non-consumable. It exists at
  Settings → *Restore purchases*. Reviewers do check.
- Sign in with Apple: **not applicable** — there are no accounts.

---

### A3. The URLs (both stores require a live, public policy URL)

```
Privacy:  https://<your-github-username>.github.io/wordslide/privacy.html
Terms:    https://<your-github-username>.github.io/wordslide/terms.html
```

**To publish (5 minutes):** create a public GitHub repo named `wordslide`, push the `docs/` folder,
then *Settings → Pages → Source: `main` branch, `/docs` folder*.

⚠️ **Then fix the URL in the code.** `src/worlds.js` currently has
`WS.PRIVACY_URL = "https://nickpotter.github.io/wordslide/privacy.html"` — a **guess** at your
username. Confirm it, and correct it if wrong. A privacy link that 404s from inside the app is a
rejection, and it is a very silly one to earn.

---

## B. Listing copy

**App name:** Wordslide
**Subtitle (iOS, ≤30 chars):** `Spell fast. Before it falls.` (28)
**Short description (Play, ≤80 chars):** `Letters tumble down the mountain. Spell them into words before they fall.` (72)

**Full description**

> **Spell fast. Before it falls.**
>
> Letters tumble down the mountainside and land in your tray. New ones shove the old ones along —
> and anything pushed off the end is gone for good.
>
> Build words on a 15×15 board with full crossword rules and real bonus squares. Clear the level
> before the slide buries you. There is no opponent and no waiting for a turn. Just you, the tray,
> and the letters piling up.
>
> **SEVEN WORLDS, SEVEN WAYS TO LOSE**
> • Mudslide — slow and sticky. Learn the ropes.
> • Landslide — boulders crash onto the board.
> • Avalanche — letters arrive in bursts.
> • Volcano — ember letters burn out of your tray.
> • Sandstorm — gusts scramble everything.
> • Waterfall — fast. Very fast.
> • Blizzard — frost hides your own letters from you.
>
> **A NEW BOARD EVERY DAY**
> Everyone gets the same letters in the same order. Two minutes. Build a streak, share your score.
>
> **DUEL ON ONE PHONE**
> Pass-and-play. Same seed, same letters, no account, no internet.
>
> **PLAY YOUR WAY**
> Drag a tile or tap to place it. Five powers to bend the rules. Colourblind-friendly tiles.
> Play offline, anywhere.
>
> Free to play, with optional ads. One tap removes them forever.

**Keywords (iOS, ≤100 chars):**
`word,puzzle,spelling,crossword,anagram,letters,brain,vocabulary,offline,daily,tiles,scrabble-like`

**Category:** Games → Word (primary), Puzzle (secondary)
**Content rating:** Everyone / 4+ · contains ads · in-app purchases $0.99–$4.99

---

## C. Release checklist

### Assets (generated — `python3 store/tools/gen_store_art.py`)
- [x] `game/assets/icon.png` — 1024×1024, RGB, no alpha
- [x] `game/assets/splash.png` — 2732×2732
- [x] `store/play/icon-512.png` — Play hi-res icon
- [x] `store/play/feature-1024x500.png` — Play feature graphic (**required**)
- [ ] Screenshots → `node ../store/tools/shots.mjs` from `game/`. Captures the **real build** at
      exact sizes (iPhone 1320×2868, iPad 2064×2752, Play 1080×1920 + 1600×2560) and **fails on any
      console error**. Never hand-mock these: a mocked screenshot drifts from the game the moment
      someone touches a layout constant.
- [ ] Generate native icons/splash: `npx capacitor-assets generate`

### Before the first store build
- [ ] `npm install` (adds AdMob, RevenueCat, Firebase Analytics, Browser, Haptics)
- [ ] **Fill in the real IDs in `src/monetize.js` → `WS.MONETIZE`.** Until they are filled, the code
      *deliberately* runs Google's test ad units and refuses to initialise RevenueCat. That is not a
      bug: firing real ad requests from a dev build gets an AdMob account **banned**, and
      `isProd()` is the positive check that prevents it. A build only goes live when the ids are real.
- [ ] AdMob app id into `AndroidManifest.xml` and `Info.plist`
- [ ] iOS: `NSUserTrackingUsageDescription` in Info.plist (ATT will not prompt without it)
- [ ] iOS: `ITSAppUsesNonExemptEncryption = false`
- [ ] Products created in App Store Connect **and** Play Console, and mapped to the `premium`
      entitlement in RevenueCat. Ids are **permanent** — they name the coins they grant:
      `removeads` (non-consumable, $4.99 → `premium`) ·
      `coins1200` ($0.99) · `coins3000` ($1.99) · `coins8000` ($4.99), all consumable
- [ ] Publish `docs/` to GitHub Pages and **correct `WS.PRIVACY_URL`**
- [ ] Lock orientation to **portrait** (iOS: Deployment Info; Android: `android:screenOrientation="portrait"`)
      — the layout solver assumes portrait

### The gate (run all three, in this order)
- [ ] `npm test` — layout device matrix + economy. **87 assertions.**
- [ ] `npm run build` — must be clean
- [ ] `node ../store/tools/shots.mjs` — real screenshots, **zero console errors**

### On the device, before you submit
- [ ] **Settings → Diagnostics.** ADS / IAP / ANALYTICS must all read **green**. Amber means the SDK
      is inert (dev build) and proves nothing. Grey means it never ran.
      **This is the screen that tells you whether "$0 revenue" is a market fact or a build fact** —
      those two look identical in a dashboard and need opposite responses.
- [ ] Buy remove-ads with a sandbox account → ads stop
- [ ] Delete and reinstall → **Restore purchases** brings it back
- [ ] Check the notch and the gesture bar: score not clipped, powers row fully tappable
- [ ] Watch a rewarded ad to completion → reward granted; **cancel one halfway → reward NOT granted**

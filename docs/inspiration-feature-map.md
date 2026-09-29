# Arete — features to take from the inspiration apps

Written 2026-09-30. Source of the app list: Rob's brief (`D:\Work\Projects\Prompts\Valerie full revamp.txt`). Store pages and reviews were read on the date above; links at the bottom. **Status** is checked against the repo at HEAD, not remembered:

- **Have** = shipped and verified in a browser
- **Partial** = something exists but is weaker than the reference app
- **Missing** = nothing in the code

Priority reasoning: Rob wants a "turn my life around" app whose AI is *ten steps ahead*. So the features that decide what to do next (adapt, predict, warn) rank above features that only record what already happened.

## Two assumptions to confirm

1. **STANCE is ambiguous.** The name matches at least three apps: an AI workout coach ("Stance — AI Workout Coach & Personal Trainer"), a bar-speed strength tracker, and a posture app. I assumed the AI coach because it fits the brief (workouts + meals + recovery + adaptive loads). If Rob meant another one, section 5 changes. This is still **Q-STANCE**.
2. **"Lockin" is ambiguous** too (a focus timer, a gym tracker, and "Lock In – Reset Your Life", a habit app with an overall rating). I used "Reset Your Life" because it is the habit/self-improvement one.

---

## 1. MyFitnessPal — nutrition

MyFitnessPal's paid tiers add meal scan, barcode scan, voice logging, per-day-of-week macro goals, intermittent fasting tracking, and (top tier) a 7-day meal planner with automated grocery lists.

| Feature | Arete | Priority |
|---|---|---|
| Food search + barcode (Open Food Facts) | Have (desktop + phone) | — |
| Recent & frequent foods, one-tap re-log with Undo | Have | — |
| Micronutrients and a 7-day gap coach | Have | — |
| AI meal plan → ingredients → grocery list → pantry aware | Have (and pantry subtraction is beyond MFP) | — |
| Copy yesterday | **Have** (2026-09-30, desktop + phone, with Undo) | — |
| Quick-add calories/macros with no food name | **Have** (2026-09-30, desktop + phone, with Undo) | — |
| Meal sections (breakfast / lunch / dinner / snacks) | **Have** (2026-09-30, by time logged, with subtotals; desktop log also gained remove-with-Undo) | — |
| Different macro goals for training vs rest days | **Have** (2026-09-30, Goal HQ: calories move in carbs only, weekly total holds, rest days keep at least half the carbs). Not arbitrary per-weekday goals: the schedule decides | — |
| Voice logging ("two eggs and toast") | Partial — the orb has speech, but it logs calories only, no foods/quantities | P2 |
| Photo meal scan (AI estimates macros) | Missing; needs the `ai-chat` gateway deployed first | P2 |
| Fasting timer | Missing | P3 |
| Saved and recent meals remember ingredients (so they use up the pantry) | **Have** (2026-09-30; plan meals also log in one tap with "Log now") | — |

## 2. Strong / Liftoff (and Stronger) — training

Strong is the clean set logger. Liftoff wraps logging in a game: XP, ranks per exercise, streaks, quests, a body graph and leaderboards. Stronger adds one benchmarked Strength Score, weak-point analytics and adaptive routines.

| Feature | Arete | Priority |
|---|---|---|
| Pre-filled sets, previous-set ghost, one-tap log, rest timer | Have | — |
| PR detection (Epley e1RM + heaviest) | Have | — |
| XP / level system | Partial — XP exists (Progress) but is not tied to lifts | P2 |
| **Next-session suggestion** ("add 2.5 kg", "repeat", "deload") from your own history | **Have** (2026-09-30, `domain/progression.js`: judged on all working sets, no drop after one bad day, layoff restart) | — |
| Plateau / stall detection on a lift | **Have** (no new best in 4+ sessions over 2+ weeks → STALLED chip, banner, deload suggestion, assistant context) | — |
| Per-exercise progress chart (e1RM over time) | **Have** (2026-09-30, History button on each Train card) | — |
| Warm-up ramp and plate calculator | **Have** (2026-09-30, barbell lifts only, standard 20 kg bar and plates; not yet configurable) | — |
| Supersets, RPE per set | Missing | P2 |
| Muscle recovery map (what is fresh / hot) | Partial — a body model exists in `Workout.jsx`, not fed by training volume | P2 |
| Strength Score / per-lift rank vs global standards | Missing (needs a standards table; bodyweight-relative) | P3 |
| Feed, friends, leaderboards | Missing — **recommend skipping**: single-user app | Skip |

## 3. Skin Bliss / Skinlab — looksmaxxing skin

Skin Bliss scans products (barcode, search, shelf photo) for ingredient clashes, builds tiered routines, scores products against a skin profile, keeps a daily rating and photo diary with side-by-side comparison, and reminds you before opened products expire.

| Feature | Arete | Priority |
|---|---|---|
| AM/PM checklist, weekday scheduling | Have | — |
| Ingredient clash warnings | Partial — a few families only (`domain/skin.js`) | P2 |
| Routine linked to Supplies so run-out is forecast | Have (beyond Skin Bliss) | — |
| Progress photos with before/after slider | **Have** for the body (front/side/back) and the face (Look, 2026-09-30) | — |
| Daily skin rating (1–5), weekly trend, and routine-vs-rating comparison | **Have** (2026-09-30, Look; no notes field) | — |
| Product scanner (barcode → ingredients) | Missing. Open Beauty Facts is a free, open database like the one already used for food | P2 |
| Score a product against your skin profile | Missing | P3 |
| Opened-product expiry (period-after-opening) reminder | **Have** (2026-09-30: "use within N months" on a supply; shown in Supplies, Today and the attention count). Not verified: the Today panel on screen | — |
| Tiered routine builder (Essential → Complete → Power) | Missing | P3 |

## 4. Sleep, water and weight coaches

RISE centres on a daily sleep-debt score. Sleep Cycle adds a smart wake window and sleep score. WaterMinder adapts reminders to weight and weather. Happy Scale smooths daily weight into a trend and predicts the goal date.

| Feature | Arete | Priority |
|---|---|---|
| Sleep log, window from settings | Have (Recover) | — |
| **Sleep debt** (needed − slept over the last 14 nights) | **Have** (2026-09-30, `domain/recovery.js`; only logged nights count; sleep-need setting) | — |
| **Readiness score** (sleep + recent training load) | **Have** (Recover screen desktop + phone, a line in Train, assistant context; low readiness holds a weight instead of adding one). No soreness input yet | — |
| Smart wake window / alarm | Missing; a PWA can't reliably alarm, so **suggest a bedtime instead of an alarm** | P3 |
| Water goal from weight, +training day, pace advice, one-tap log | Have | — |
| Drink types (coffee/tea count differently), weather adjustment | Missing | P3 |
| Weight trend, weekly rate, pace vs goal | Have | — |
| "You reach your goal weight around <date> at this rate" | **Have** (2026-09-30, optional goal weight in Goal HQ; shown on Body and Goal HQ) | — |
| Apple Health sync | Missing, **not possible from a PWA or Tauri desktop**; skip | Skip |

## 5. STANCE (AI workout coach, assumed) — the adaptive coach

Stance builds workouts and meals from a goal and training days, adjusts weights automatically, shows a live muscle map, plans before each session, and requires the user's approval for every change it makes.

| Feature | Arete | Priority |
|---|---|---|
| Goal → targets (cut/bulk/recomp/glow-up) and weekly adaptive maintenance proposal | Have (Goal HQ; never applied silently) | — |
| Coach chat that knows your goal, score, PRs and due supplies | Have, coded — not deployed until the key is rotated | — |
| **Approval before the coach changes anything** | **Have** for settings (2026-09-30: an Apply / Not now card; secret-like keys and non-plain values refused). Logging actions (water, food, sleep, tasks) stay instant by design | — |
| AI-built weekly workout plan from goal, days and equipment | Missing (there is a program editor, no generator) | P2 |
| Auto-adjusted loads | **Have** as suggestions the lifter can override (see section 2) | — |
| Pre-session advice ("sleep was short, keep it lighter") | **Have** (readiness line at the top of Train) | — |
| Plateau detection and intervention | **Have** (section 2) | — |
| Crews, challenges, "Winter Arc" seasons | Missing — skip (single user) | Skip |

## 6. Lock In – Reset Your Life — habits and self-improvement

Reference features: daily habits with tags (Gym, Health, Focus), an overall rating (OVR) that levels up with XP, habit heatmaps, journaling, breathing exercises and an AI coach.

| Feature | Arete | Priority |
|---|---|---|
| Daily habits, streaks that break correctly | Have (fixed this session; desktop + phone) | — |
| Habit heatmap | **Have** (2026-09-30, 12 weeks, desktop + phone) | — |
| One overall rating that rises with what you do | Partial — the Home goal ring scores today; there is no long-run OVR | P2 |
| Journal, breathing | Partial — Mind has notes; no breathing tool | P3 |
| Focus timer / blocking | Have (Focus tab); blocking apps is impossible in a web app | — |

---

## Recommended build order

The first six are small, pure-logic features on data the app already stores, and together they are what makes the AI "ten steps ahead":

1. ~~Next-session load suggestion + plateau detection (Train)~~ done 2026-09-30
2. ~~Sleep debt + readiness score~~ done 2026-09-30 (Home ring not wired)
3. ~~Goal-weight ETA and training/rest-day macro goals~~ done 2026-09-30
4. ~~Copy yesterday + quick-add calories~~ done 2026-09-30
5. ~~Face progress photos + daily skin rating~~ done 2026-09-30
6. ~~Habit heatmap~~ done 2026-09-30
7. ~~Approval cards for assistant actions~~ done 2026-09-30 (decided: settings need Apply, logging is instant)
8. Product barcode scanner via Open Beauty Facts, opened-product expiry
9. Voice and photo food logging (photo needs the gateway deployed)

Explicitly not recommended: feeds, friends, leaderboards and crews (single user), Apple Health sync (not reachable from a PWA or Tauri), alarm-clock features (unreliable on iOS web).

## Sources

- MyFitnessPal tiers and features: [MyFitnessPal Help — Premium features](https://support.myfitnesspal.com/hc/en-us/articles/360032625951-MyFitnessPal-Premium-features), [Premium vs Premium+](https://nutriscan.app/blog/posts/myfitnesspal-premium-vs-premium-plus-features-62075fe756)
- Liftoff and Stronger: [Liftoff UI breakdown](https://screensdesign.com/showcase/liftoff-ranked-gym-workouts), [Liftoff on the App Store](https://apps.apple.com/us/app/liftoff-ranked-gym-workouts/id6448081563), [Stronger vs Liftoff](https://www.strongermobileapp.com/compare/liftoff)
- Skin Bliss: [getskinbliss.com](https://getskinbliss.com/), [App Store listing](https://apps.apple.com/us/app/skin-bliss-skincare-routines/id1385561364)
- STANCE (AI coach): [stanceapp.app](https://stanceapp.app/); other apps sharing the name: [Stance Fitness bar-speed tracker](https://stancefitness.co/products/stance), [Stance posture app](https://apps.apple.com/in/app/stance-health/id6757695513)
- Lock In: [Lock In – Reset Your Life](https://apps.apple.com/ca/app/lock-in-reset-your-life/id6746586837), [LockIn: Gym Workout Tracker](https://play.google.com/store/apps/details?id=com.lockinfocusedlifts.app)
- Sleep, water, weight: [RISE sleep debt](https://www.risescience.com/blog/best-sleep-debt-tracking-app), [Sleep Foundation app reviews](https://www.sleepfoundation.org/best-sleep-apps), [WaterMinder](https://waterminder.com/), [Happy Scale](https://apps.apple.com/us/app/happy-scale/id532430574)
- Feature descriptions come from store listings and vendor pages, so they show what each app *claims*, not how well it works.

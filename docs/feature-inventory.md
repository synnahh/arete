# Arete — what is in the app now, and which inspiration app it comes from

Written 2026-10-01 from the repo at HEAD (`574c5d1`) and `HANDOVER-CODEX.md`. Source of the app list: Rob's brief (`Valerie full revamp.txt`): MyFitnessPal, Skinbliss/Skinlab, Lockin / Strong / Liftoff, a sleep tracker, a water coach, a weight coach, a macro and micro coach, STANCE.

**Status words.** *Verified* = seen working in a browser (stand-in data, never against the real Supabase). *Coded* = written and unit-tested, not seen on screen. *Needs deploy* = depends on the `ai-chat` Supabase function, which is not deployed yet. Nothing here has been verified on a real phone, in Tauri, or against live data.

Where the app goes beyond the reference app, it says so. Where it is weaker, it says that too.

## MyFitnessPal (nutrition)
| Feature | Where | Status |
|---|---|---|
| Food search + barcode (Open Food Facts) | Coach > Fuel | Verified (typed barcode on iPhone; no camera scan on iOS Safari) |
| Recent and frequent foods, one-tap re-log, Undo | Fuel | Verified |
| Copy yesterday; quick-add calories/macros | Fuel | Verified |
| Meal sections (breakfast/lunch/dinner/snacks) with subtotals | Fuel | Verified |
| Macro targets for training days vs rest days | Goal HQ, Fuel | Verified (not free per-weekday goals) |
| Describe a meal (typed or spoken) | Fuel > Describe | Coded; needs deploy |
| Photo meal scan | Fuel > Photo | Coded; needs deploy |
| Fasting timer (14/16/18/20 h), 30-day stats | Fuel | Verified |
| Micronutrient 7-day gap coach (refuses to judge on thin data) | Fuel > Nutrition, phone | Verified |
| AI meal plan, ingredients, grocery list, "Log now" | Fuel > Meal plan | Coded; generation needs deploy |
| Pantry that follows what you log (stock goes down as you eat) | Supplies | Verified. **Beyond MyFitnessPal** |

## Strong / Liftoff / Stronger (training)
| Feature | Where | Status |
|---|---|---|
| Pre-filled sets, previous-set ghost, one-tap log, rest timer | Coach > Train | Verified |
| PR detection (estimated 1RM + heaviest) | Train | Verified |
| Next-session weight suggestion (add / hold / deload / layoff restart), judged on all working sets | Train, `domain/progression.js` | Verified |
| Plateau detection, STALLED chip, deload suggestion | Train | Verified |
| RPE per set, feeds the next suggestion | Train | Verified |
| Per-lift estimated-1RM chart | Train > History | Verified |
| Warm-up ramp, plate breakdown, configurable bar and plates | Train | Verified |
| Strength Score vs bodyweight, weakest-lift hint | Train | Verified (rough adult-male ratios) |
| Muscle recovery map and weekly sets vs 10–20 | Recover | Verified |
| Exercise picker by equipment and goal | Train > Exercises | Verified |
| Split planner (2–6 days) | Train / Workout | Verified |
| XP, levels, tier badges | Mind/Progress | Exists, but **not tied to lifts** (Liftoff ties them) |
| Supersets | none | **Missing** |
| Friends, feed, leaderboards | none | Skipped on purpose (single user) |

## Skinbliss / Skinlab (skin and looksmaxxing)
| Feature | Where | Status |
|---|---|---|
| AM/PM checklist with weekday scheduling | Coach > Look > Skin | Verified |
| Ingredient clash warnings (retinoids, acids, benzoyl peroxide, vitamin C, copper peptides, scrubs) | Look | Verified |
| Check a product: barcode or pasted ingredients, add to routine and Supplies | Look > Skin | Pasted path verified; live barcode lookup not |
| Product score 0–100 against your skin profile, with a reason for each point | Look | Coded |
| Tiered routines (Essential / Complete / Power) | Look | Verified |
| Daily skin rating 1–5, weekly trend, routine vs rating | Look | Verified |
| Progress photos, before/after slider (face and body) | Look, Body | Verified with stub storage; needs `progress_photos.sql` |
| Skin photo analysis (scores, observations, change since last) | Look > Skin | Coded; needs deploy |
| Use-by dates for opened products | Supplies | Verified |
| Routine steps set usage, so run-out dates are forecast | Supplies | Verified. **Beyond Skinbliss** |
| Style board, wishlist, outfit ideas | Coach > Style | Exists (desktop and phone) |

## Sleep tracker (RISE / Sleep Cycle style)
| Feature | Where | Status |
|---|---|---|
| Sleep logger (bed/wake or "about N h") | Recover | Verified |
| 14-night sleep debt, only logged nights count | Recover | Verified |
| Readiness 0–100 (last night, debt, last 48 h training) | Recover, Train | Verified |
| Low readiness holds a weight instead of adding one | Train | Verified |
| Bedtime reminder and gradual screen dim | Health | Exists |
| Smart wake alarm | none | **Missing**, a PWA cannot alarm reliably; bedtime suggestion is the substitute |

## Water coach (WaterMinder style)
| Feature | Where | Status |
|---|---|---|
| One shared goal from weight, +500 ml on training days | Water, Home, phone | Verified |
| Pace advice with a one-tap log | Water, phone | Verified |
| Goal follows your weight automatically, with Undo | Coach engine | Verified |
| Drink types, weather | none | Skipped on purpose (would double-count caffeine; weather needs location) |

## Weight coach (Happy Scale style)
| Feature | Where | Status |
|---|---|---|
| Smoothed trend, weekly rate, pace vs goal | Body, Goal HQ | Verified |
| Goal-weight date at the current rate | Body, Goal HQ | Verified |
| Progress photos with weight change between them | Body | Verified with stub storage |

## Lock In / Reset Your Life (habits and self-improvement)
| Feature | Where | Status |
|---|---|---|
| Habits with streaks that break correctly | Habits, Home | Verified |
| 12-week habit heatmap | Habits | Verified |
| Overall rating 0–99 from five pillars, vs last month | Home | Verified |
| Breathing exercises (box, 4-7-8, quick reset) | Mind > Breathe | Verified |
| Journal, notes, focus timer | Mind, Focus | Exists (blocking other apps is impossible in a web app) |
| Next moves: ranked "do this now" list | Home | Verified |

## STANCE (assumed: AI workout coach — still unconfirmed with Rob)
| Feature | Where | Status |
|---|---|---|
| Goal templates (cut/bulk/recomp/glow-up) with targets | Goal HQ | Verified |
| **Coach engine**: raises or lowers calories and macros from your logs, switches goal when reached, suggests a split change, keeps water in step; each with a cooldown, a toast and Undo | Home, Goal HQ | Verified (split rule seen on 2026-10-01) |
| Approval before bigger changes | Coach engine | Verified (asks for goal-reached and split; routine tuning auto-applies with Undo) |
| Pre-session advice from sleep | Train | Verified |
| Auto-adjusted loads | Train | Verified (suggestions, never forced) |
| Coach check-ins morning and evening | Settings > Notifications | Verified |
| Crews, challenges, seasons | none | Skipped on purpose |

## Your own "ten steps ahead" idea (not from an app)
| Feature | Where | Status |
|---|---|---|
| Supplies with run-out dates from dose x uses/day x days | Supplies | Verified |
| Amazon cart link of what is running out | Supplies | Coded; the URL format is unverified |
| Grocery list from meal plan, minus pantry | Fuel | Verified |
| Projected 30-day supplies spend | Finance | Verified |
| Finance, portfolio, vault, calendar, tasks, routines, notes | their tabs | Existing app |

## Gaps against the best of those apps, ranked
1. **Streaks and a weekly recap** (Duolingo/Strava style): habit streaks exist but there is no recap card and no milestone moment. *Proposal pending.*
2. **Insights charts** with week/month/year ranges and correlations (sleep vs training, calories vs weight): pieces exist (weight, 1RM, heatmap), no common time-range view. *Proposal pending.*
3. Supersets in Train (Strong has them). Needs a decision, it changes how a session is structured.
4. XP tied to training (Liftoff). XP exists but is detached from lifts.
5. Per-weekday macro goals (MyFitnessPal Premium); the training/rest split covers most of it.
6. Smart alarm (Sleep Cycle) — not feasible on the web.
7. Anything needing a native app: widgets, HealthKit sync, background alarms, app blocking.

## Doubts about this list
- STANCE is guessed (it matches several apps). If Rob meant a different one, that section changes.
- "Lockin" is guessed as *Lock In – Reset Your Life*.
- Everything marked Coded or Needs deploy depends on `ai-chat` going live after the key is rotated.

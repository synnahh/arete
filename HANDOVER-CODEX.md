# BRANCH `overhaul-test` (2026-10-15, NOT merged to main; Rob said "as a test, not permanent")

Merge with `git merge overhaul-test` if kept; drop with `git switch main` then `git branch -D overhaul-test`.
- **Paste and apply** (`components/PasteApply.jsx`, `domain/workoutImport.js`): paste a meal plan OR a training plan from Claude/ChatGPT/notes; fixed rules (no AI) detect which, show what was understood, then save. Training plans become a `programs` row with per-day sets/reps, lifts matched to the exercise database (close wording allowed; unknown lifts added as own exercises and flagged). On Profile, and as "Import a training plan" above the Split planner. "Copy a training-plan prompt" gives the AI the exact JSON shape.
- **Fitbit-driven coach** (`domain/fitbitCoach.js`, wired in `hooks/useCoachEngine.js`, card `components/FitbitRead.jsx` on Progress > Insights): reads `health_sync` + `sleep_data` and proposes, via the existing Coach updates card: lighter day (resting HR up / HRV down / short sleep, 2 of 3), short-sleep advice, calories rebuilt from real active energy (only while maintenance is an estimate, never over the measured adaptive one), one fewer training day if resting HR climbs 3+ bpm over two weeks on a 5+ day plan. All ask first; advice type `advice` logs only. Needs the health sync to actually be delivering (the open item above). Tests use synthetic data only.
- **Food photos:** "Add a photo" in the food logger stores a ~10 KB thumbnail on the entry (`entry.photo`), shown in the day's log. Workout/body photos not done (progress photos already exist).
- **Display pass:** 44 px touch targets for small buttons, section tabs and Look chips on touch; text under 11.5 px raised; Home customise checkboxes enlarged. Empty Train says "Create or import a program".
- **Verified:** 847 tests, both builds, browser at 375/1280 (import read, FitbitRead with demo data, audit before/after). NOT verified: applying imports signed in, a real photo from a phone, the coach proposals on real Fitbit data (none has arrived).

# LATEST (2026-10-15, later): profile picture, no-AI meal plan with import, health setup guide

- **Profile picture:** tap the avatar on Profile; `utils/avatar.js` centre-crops to 256 px JPEG, stored as `settings.profile.avatar` (syncs with settings), shown by `components/Avatar.jsx` on Profile and the Home greeting. Also fixed Profile crashing when settings were still null.
- **Meal Plan tab (Fuel) rewritten, no AI:** `components/MealPlanTab.jsx` (Plan / Recipes / Import). Build a week by hand, add from saved recipes, log a meal now with Undo, save a meal as a recipe, shopping list. **Import:** copy a prompt (`buildPlanPrompt`) into Claude or ChatGPT, paste the reply back; `domain/mealPlanImport.js` reads the JSON, or plain text such as "Monday / Breakfast: Oats, 450 kcal, 35P 55C 9F". Same `meal_plan` document shape, so Supplies' shopping list still works. The old AI generator was deleted from `tabs/Health.jsx`.
- **Health setup guide:** `components/HealthSetupGuide.jsx` on Profile (ticks stay on the device). Same facts as `docs/health-ingest-checklist.md`. The sync itself is still the open item above (token on the phone).
- **Not done:** Rob's "overhaul of ease of use, display and logging (images)" note is vague; ask what he means (photo logging? which screens?) before starting.
- **Verified:** 826 tests, `build` and `build:pwa` pass; checked in the browser at 1280 and 375 (import to plan, add meal with ingredients, avatar upload, guide). NOT checked: signed-in saving, a real phone photo picker (HEIC), real recipe saving.

# Arete (was VALERIE) — Handover for the next agent

# LATEST (2026-10-15): Train, Fuel, Home polish, health sync setup (IN PROGRESS)

**Where the health sync stands (the one open item):** table `health_sync` is created in the Arete Supabase project (RLS on, realtime on, 0 rows). Function `health-ingest` is DEPLOYED (no JWT, token-gated) and passes the script's live test (wrong token 401, right token 200). **Nothing has arrived yet: every call from the iPhone's Health Auto Export is refused with 401**, i.e. the token in the phone is not the one deployed. Cause found in the function logs (Supabase > Edge Functions > health-ingest > Invocations): `scripts/setup-health-sync.ps1` makes a NEW token on every run and the old one stops working; it was run 3 times and the phone holds an older one. Next steps for whoever continues: (1) Rob runs `.\scripts\setup-health-sync.ps1 -Check`, pastes the phone's header value, reports length and ACCEPTED/REFUSED; (2) if refused, ONE final `-SkipTable` run, paste the token into the phone BEFORE pressing Enter, never re-run; (3) look for a POST 200 from the phone in Invocations, then Profile > Sync check should say health data arrived, Home > Metrics fills. Then C1-C6 in `docs/health-ingest-checklist.md` (EufyLife to Apple Health, Google Health 5.05+ > Partner apps > Apple Health, Health Auto Export REST API automation: POST, JSON, header `x-health-token`). Fitbit Air goes through Google Health to Apple Health (not Bevel: Bevel only reads). The token is never stored anywhere in the repo or in chat; do not ask for it. Not deployed: `send-sms` (Twilio) and `food-search` (404 when probed). `ai-chat` is deployed. Costs and services: `docs/services-and-costs.md`. The Supabase CLI choked on a BOM in `.env` (removed); `supabase/.temp/` is gitignored.

**Built this session (all committed, 807 tests, builds pass, checked in the browser at 375 and 1280 px; NOT on a real phone):**
- **Home:** wordmark + small greeting; cards dealt into balanced columns (`layoutRows` in `homeLayout.js`, no gaps; empty cards hidden by `.home-slot:empty`); desktop scrolls; Metrics card (`MetricsCard.jsx`, `domain/metrics.js`, `useHealthHistory.js`) with tile design, Edit to choose and order metrics (`settings.home.metrics`), unknown Health Auto Export metrics shown automatically (`healthMap.js` keeps them under `days[day].more`).
- **App feel:** no zoom (viewport, `touch-action`, gesture/ctrl+wheel/keys blocked in `main.jsx`), no scrollbars, no text selection except inputs, context menu blocked outside inputs.
- **Train:** each exercise shows grip, set-up and form (`domain/exerciseDetail.js`, every database exercise has an entry; a test enforces it); later sets take the weight/reps of the set just logged unless typed into (`carryForward`); ONE warm-up set button (`warmupOne`, about 60% for 5) plus "+ Warm-up", warm-ups kept on the device only and never logged as work; split planner min/max boxes commit on blur (typing 10 in Max no longer resets Min).
- **Fuel:** MyFitnessPal-style add screen (serving size, number of servings, meal, macro split, Add always visible); barcodes are matched in the bundled 10,877-product Australian pack first (offline), then Open Food Facts. Desktop New food / Build recipe now open in a dialog.
- **Settings:** the SMS test button uses the `send-sms` function first.

**Not reproduced / open:** Rob's note "adding a set adds one to all following exercises" could not be reproduced (adding a set changed only that exercise); ask what he taps and where. Real-phone checks outstanding: barcode camera, carry-forward in a real workout, saving a food/recipe signed in.

**Temporary, uncommitted, dev-only demo data:** `src/dev/demoData.js` plus `TEMP-DEMO` lines in `src/main.jsx` and `src/hooks/useHealthHistory.js`; `?demo=1` on the dev server, `?demo=0` removes it. Delete before anyone commits those two files. Never in builds (`import.meta.env.DEV`).

**Not pushed:** `main` is 182+ commits ahead of `origin/main` (GitHub `synnahh/Valerie-desktop`, visibility unknown; history contains Rob's personal details). Do not push until Rob confirms the repo is private. Deploy = rebuild `npm run build:pwa` and drag `dist` onto the existing Netlify site `arete-dash.netlify.app`.


# (earlier) 2026-10-14: desktop fixes, split inputs, Home Metrics

- **Desktop New food / Build recipe:** the forms rendered as cards far down the Nutrition page, so the buttons looked dead. They now open in a centred dialog (`Motion.jsx` `Sheet`, new `wide` prop, `.ui-sheet.is-wide` in `system.css`) in `tabs/Health.jsx`. Phone already used a bottom sheet (checked: opens, buttons not covered). Saving was NOT verified: dev view has no session, so `useCollection.add` reports "Not signed in".
- **Home scroll on desktop:** `main` is `overflow:hidden`, so `HomeScreen` now owns a scroll container when not `compact`.
- **Split Planner:** sets/min/max boxes (`TargetInput` in `SplitBuilder.jsx`) keep your typing and save on blur/Enter, so "10" in Max is no longer judged against Min after the "1" (that reset Min to 1). Labelled columns, previous/next day arrows, and the editor opens on today's (or the first) training day.
- **Metrics on Home** (`components/MetricsCard.jsx`, `domain/metrics.js`, `hooks/useHealthHistory.js`, section id `metrics`, default on, full width): tiles per metric with latest value, change vs the previous 7 days, 14-day sparkline, age of reading. Sources: `health_sync` rows, `body_metrics`, `sleep_data`. Any metric Health Auto Export sends that has no field of its own is stored by `healthMap.js` under `days[day].more[name] = {v,u}` (sum for distance/flights/time-type names, average otherwise) and shows as an "Other" tile on its own; `health-ingest/index.ts` merges `more` per name. **Needs a redeploy of `health-ingest`** (not deployed yet at all). Anyone who already saved a Home layout must switch Metrics on under Customise.
- **Verified:** 788 tests pass, `build` and `build:pwa` pass, no dev bypass in `dist`. In the browser (desktop 1280, phone 375): dialogs open, Home scrolls at 500 px high, Metrics tiles render from seeded body/sleep data, split Min 8 / Max 10 typed key by key survives. NOT verified: real Supabase, real health data, a real phone.

# LATEST (2026-10-13, later): UI and motion upgrade, Muscle Ranking v2, Home in the middle

- **Bar order:** `BAR_ORDER` in `nav/groups.js` = Train, Fuel, Home, Look, Progress (phone bar and desktop dock; `inBarOrder`). `GROUPS` keeps Home first because `groupOf()` falls back to `GROUPS[0]`.
- **Design + motion system:** `src/styles/system.css` (tokens: `--dur-1/2/3`, `--ease-emph/exit`, `--spring`, radii, surfaces, shadows, semantic `--ok/--warn/--bad/--info`; classes `ui-card`, `ui-btn` (`is-primary/soft/quiet/sm/icon`), `ui-chip`, `ui-tabs`, `ui-collapse`, `ui-check`, `ui-bar`, `ui-sheet`, `ui-toast`, `ui-draw` for chart lines, `ui-grow` for bars, `m-tabbar`). Components in `components/Motion.jsx`: `SlidingTabs`, `Collapse`, `ProgressRing`, `ProgressBar`, `Sheet` (portal, exit motion, Escape, drag-down), `usePresence`, `useReducedMotion`, `AnimatedNumber`. No animation library was added (CSS + small hooks). Reduced motion: the global kill switch in globals.css covers all of it (checked).
- **Gotcha fixed:** `.val-fade-up` and friends used `forwards`, which left `transform` on screen wrappers, so every `position: fixed` child (sheets, timers) was positioned inside the wrapper. Now `backwards`. Overlays are also portalled to `body`.
- **Workout (`tabs/TrainSession.jsx`):** current exercise highlighted, next set marked with one-tap nudges (±increment kg, ±1 rep), finished exercises fold to one line, sticky live summary (ring, sets, volume, minutes, PRs), Finish sheet (totals, vs last time; sets were already saved per tick), settings sheet behind the gear (rest, effort, cues, warm-ups, plates, equipment, edit program). Save/PR/readiness/replace logic unchanged; Replace now has Undo. Typed-but-unlogged values and start time survive a refresh (`domain/sessionDraft.js`, `arete_session_draft`). Today's PRs are recomputed from the logged sets.
- **Rest timer (`domain/restTimer.js`, `components/RestTimer.jsx`):** stores the end time, so it is right after backgrounding; saved in `arete_rest_timer` (survives reloads); mounted once per shell so it shows on every tab; pause, resume, ±15, +30, restart, skip; amber in the last 10 s, green "Go" at the end; optional buzz (Android only) and tone (`settings.train.restVibrate/restSound`). Cannot alert while the app is in the background (web limitation).
- **Muscle Ranking v2 (`domain/muscleScore.js`, `components/MuscleRanking.jsx`):** 0-100 per muscle = strength for bodyweight 40% (best e1RM in 120 days vs approximate adult-male standards per lift, helpers 75%, older than 120 days at 85%), weekly hard sets vs `splitCoach TARGETS` 25% (helpers half), progression 15% (last 6 weeks vs the 18 before; flat 50, +10% 100), consistency 20% (weeks of last 8, 2 days = full). Missing parts are re-weighted. Ranks 0/20/40/60/80, gated by training days (Intermediate 8, Advanced 20, Elite 40). Bodyweight from `useHealthData().latestWeight`. The old day-count ranking was removed from `tabs/Workout.jsx`.
- **Also restyled:** Home cards (stagger, count-ups, drawn ticks), toasts (enter/leave, Undo countdown, pause on hover/touch), section bars and Train sections (sliding highlight), chart lines draw in, exercise dialog.
- **Tests:** 768 passing (new: muscleScore, restTimer, sessionDraft, bar order). Both builds pass. Verified in the browser at 375 px and 1280 px against an in-memory Supabase stand-in; NOT on a real iPhone. Codex review could not run (the ChatGPT account rejects every model name tried).

# (earlier) LATEST (2026-10-13): the app is now a gym and looks app.

- **Navigation (`src/nav/groups.js`):** six groups, ids `home`, `train`, `eat` (label Fuel), `look`, `results` (label Progress), `settings` (label Profile). Phone bar: Train, Fuel, Home, Look, Progress (since the later 2026-10-13 change); Profile/Settings behind the gear. Tasks, calendar, notes, lists, focus, finance, portfolio, vault, mind and the old Plan/Coach front pages are OUT of the menus (their saved data is untouched and their files still exist as dead code); every old id aliases to Home. Never reuse a group id as a screen id.
- **Home (`components/HomeScreen.jsx`, `domain/homeLayout.js`):** one component for phone and desktop. Default cards (Rob's poll): calories and protein left, weight and goal progress, streak, skin routine, water, sleep and readiness. Opt-in under Customise: today's workout, next moves, steps, coach updates, recap, overall. Saved as `settings.home.sections`.
- **Offline-safe saving:** `supabase/writeQueue.js` + `useCollection.js` (rows get client-made UUIDs, queued in localStorage `arete_write_queue`, flushed on reconnect with backoff), `supabase/docQueue.js` (documents and settings, `arete_doc_queue`; the launch fetch no longer overwrites a document with a waiting edit). `SyncBanner` shows offline/syncing. Verified with tests and in a browser against a stand-in; NOT against real Supabase.
- **PWA:** `registerType: 'prompt'` (UpdatePrompt banner, never auto-reloads), manifest cleaned, `LaunchSplash` on every launch, `virtual:pwa-register` aliased to a stub in non-PWA builds (`vite.config.js`).
- **Face ID:** offered once per device (`faceIdOffered`), reason shown on failure, switch in Settings > Security. The iOS passkey sheet is how web apps get Face ID; unverified on a real phone.
- **Splits:** 16 templates in `domain/splits.js`; guide split in one tap (`GuideSplit`); coverage, fills and swaps (`domain/splitCoach.js`).
- **Security/deps:** the unused Firebase SDK and `src/firebase/` were removed; `npm audit --omit=dev` reports 0.
- **Audit:** `docs/audit-2026-10-13.md` (findings, checklist, roadmap, verification). Next on the roadmap: URL routing/back button, Playwright journeys, lazy-loaded screens, Sentry DSN, accessibility pass, delete dead screens.
- **Food database (2026-10-13):** `src/data/foods/generic.json` (8,000 USDA foods) and `branded-au.json` (10,877 Australian packaged products from the Open Food Facts export, ODbL; credit shown on the food search screen). Search/ranking in `domain/foodDb.js` (staples pinned for plain words, branded wins ties, Australian synonyms), loaded lazily by `hooks/useFoodDb.js`. The branded pack was built by a one-off filter script (tagged Australia, name + brand, complete kcal/protein/carbs/fat, numbers that add up); README in `src/data/foods/`. The 1.27 GB source file was deleted after use.
- **Still needs Rob:** deploy `dist` to Netlify; real-iPhone checks (Face ID, install, offline); the accounts steps in `docs/health-ingest-checklist.md`; (the branded food pack is done).

# (older) LATEST (2026-10-12): read this first, it supersedes parts of START HERE below

**Rob's standing decisions:** this is a personal app that will never be published. No onboarding, no paywall, no demo data. The coach asks its first questions itself (Goal HQ intake). Rob will upload his complete fitness and looks improvement guide; it is to be copied into the app's data so he does not type it (plan and folder: `docs/reference/guide/README.md`; the guide is NOT in the repo yet, so nothing from it has been imported).

**Dev view:** on the Vite dev server only, `DEV_VIEW` in `src/App.jsx` skips PIN, sign-in and onboarding so changes can be looked at (`?login=1` restores the gates). It is stripped from production builds; after any build confirm `grep -l "login=1" dist/assets/*.js` finds nothing. There is no session in that mode, so nothing syncs.

**Changed since START HERE (all committed, 605 tests):**
- **Removed:** the Mind tab (Notes and Lists moved to Plan; old Mind ids alias to Notes), fasting, onboarding, every demo/sample (Health overview and Body fallbacks, the sample exercise library). An empty library stays empty.
- **Coach intake** (`components/CoachIntake.jsx`, `domain/intake.js`, tests): goal, body (Mifflin-St Jeor maintenance), pace, experience/days/equipment, activity, limits, sleep, skin. Apply sets the goal and targets, `settings.profile`, skin profile, Train gym, a starter library only if the library is empty, and a NEW active program (old ones kept). Goal speed presets in `domain/goals.js` (`PACES`, floor 1,300 kcal, kept by the coach engine).
- **Train:** your own split (`domain/splits.js`, `components/SplitBuilder.jsx`: per-day exercises, templates built from YOUR library, filters by level/days, favourites, weekly volume), exercise database (`domain/exerciseDb.js`, 120+ moves), Replace, recommended sets line (`recommendedSets`), dated history list, rest-time chips (`settings.restSeconds`).
- **Food:** one add-food flow for phone and desktop (`components/FoodLogger.jsx`, `domain/foodLogger.js`): search across favourites/recents/own foods/meals plus database (`food-search` function: USDA + Open Food Facts, needs deploy and `USDA_API_KEY`), remembered portions (`food_portions` doc), meal slots stored as `entry.section`.
- **Progress/Profile (from GROWTH):** `components/WeeklyCheckIn.jsx` (kg lost/gained tiles, week number, weight + 3 photos; check-ins are `body_metrics` rows with `source:'check-in'`), `tabs/Profile.jsx` (screen id `profile`, Settings group: streak, goals achieved, training days, week strip, birth date/sex/height).
- **Health sync:** `health-ingest` function + `supabase/health_sync.sql` (Apple Health and the Eufy scale via Health Auto Export). Not deployed.
- **Phone feel:** iOS haptics, no input zoom, swipe-to-delete (`mobile/SwipeRow.jsx`) on food, water, tasks, saved meals, notes; slide transitions; loading screen (`components/LoadingScreen.jsx`); barcode scanning works on iPhone (ZXing, camera kept 30 s, photo fallback).
- **Notes on GROWTH** (the app Rob is learning from): `docs/reference/grow/GROWTH-feature-notes.md`.

**Added after that (2026-10-12, later):**
- **Custom goal** (`CUSTOM_PRESETS`, `cleanCustom`, `customFieldsFromPreset` in `domain/goals.js`; `components/CustomGoalFields.jsx`): your own calories-vs-maintenance % (-25 to +20) and protein g/kg, in the coach intake and the Goal editor. Stored as `coachGoal.custom`; `coachEngine.rebuilt` keeps it. Preset "Build muscle in a deficit" = -12%, 2.2 g/kg (Rob's chosen goal). `intake.js` handles `goal:'custom'` (`customText`, `customDeltaPct`, `customProtein`) and a `splitTemplate` override.
- **Rob's guides were read** (three .docx in his Downloads: Complete Personal Appearance Fitness and Skin Guide 25 Sep 2026; Robert Pearson Complete Appearance and Physique Guide 21 Sep 2026; the Phase 1 analysis/intake, whose answers are blank). Text was extracted to the scratchpad only; nothing from them is stored in the repo except `domain/guideAnswers.js` (`ROB_GUIDE_ANSWERS`, behind a "Fill in the answers from my guide" button in the intake: 71 kg, 180 cm, male, light activity, 5 days, gym, right-shoulder note, sensitive/redness skin, muscle-in-a-deficit goal). **Birth date is not in the guides (only "21"), so it is left blank.** New template `upperFrame` (Upper A/Lower A/Upper B/Lower B/Upper C) is the newer guide's week.
- **Key facts from the guides** (for the pending import): 21 y, 5'11", 71 kg, ~19-20% BF self-estimate, detrained, full gym; trial intake ~2,300 kcal, protein 145-160 g, fat 65-75 g, 8-10k steps, mini-cut = ~300 kcal deficit (0.25-0.5%/wk); first 2 weeks 2 sets per exercise at 3-4 RIR; right shoulder pops on heavy overhead press (no heavy vertical pressing; use neutral-grip, landmine, incline); rosacea-prone cheeks (barrier-first: gentle cleanser, moisturiser, SPF50+, azelaic acid only after 2 calm weeks, one active at a time); creatine 3-5 g + whey; two repeatable bowls (beef bowl, Korean chicken bowl) plus egg toast, whey shake, yoghurt and fruit; GP review for fatigue and tongue coating.

**PENDING (Rob said "hold off temporarily"):** importing the guide into app data. Decide first which program to use: the 25 Sep guide (Upper A / Lower A / Upper B / Lower B / Upper C, sets and reps in section 9) is newer than the 21 Sep guide (Upper strength / Lower A / Push / Pull / Lower B). Planned import: exercises + a program (via `domain/splits.js`, exercise names should match `exerciseDb.js`), the two-bowl meal plan as saved meals, creatine/whey in `supplements`, the rosacea routine as skin steps (`lm_profile.skinSteps`, `domain/skin.js`), standards/habits. Show it for review before saving; invent nothing.

**Added 2026-10-12 (guide import, tracking, Train customisation; 650 tests):**
- **Guide import** (`domain/guideImport.js`, `components/GuideImport.jsx`, card in Goal HQ): the 25 Sep guide as two programs (re-entry 3-day, active; 5-day frame-priority, inactive), 26 exercises, bowls and snacks as saved meals, creatine and whey, skin steps, 4 daily habits, a reference note. Review first, idempotent. Programs carry per-day `targets: { exerciseId: { sets, repsMin, repsMax } }` (`withDayTargets`, `setDayTarget` in `domain/splits.js`; read by Train, the volume panel, and editable in Split Planner). Snack carbs/fat are 0 because the guide gives none. Staying on Netlify (Vercel looked at and dropped).
- **Waist and steps** (`domain/waist.js`, `domain/steps.js`, `components/StepsCard.jsx` on Coach Today): the weekly check-in takes two waist readings (stored as `waist` on the `body_metrics` check-in row); a flat waist for 3 weeks (assumed: under 0.5 cm change) is a Next move when the goal is fat loss; typed steps (`step_log` document), 7-day average, goal ramp +1,000 no sooner than 7 days (`settings.stepGoal`, `stepGoalOn`).
- **Rosacea** (`domain/rosacea.js`, `components/RednessAzelaic.jsx` in Look > Skin): redness 0-10 on the `lm_daily` row; azelaic acid only after 14 days of the base routine and your own "calm" confirmation, Mon/Thu nights then Mon/Wed/Fri; clash warning if azelaic shares a night with a retinoid, acid or BPO. Tier routines now use "Centella serum" for redness (azelaic is only added through this gate).
- **XP for lifts** (`domain/liftXp.js`): +30 XP per personal best (new best e1RM on a lift logged before), idempotent.
- **Train customisation** (`domain/trainPrefs.js`, `settings.train`): effort scale RPE / RIR / off, auto rest timer, warm-up ramp, plate breakdown, default sets; per exercise a note and its own rest time (stored on the library entry as `note`, `restSeconds`; the exercise's own rest beats the session rest chip); a Demo link per exercise (opens a YouTube search; no images/videos stored).
- **Phone Train is now the full Train screen** (`WorkoutTab compact`, chip row: Session, Overload Coach, Split Planner, Exercises, Muscle Ranking, Calendar). Before, the phone only had the session, so splits and the library could not be created or edited there. Session has an "Edit this program" button.
- **Exercise demos** (`components/ExerciseDemo.jsx`, `domain/exerciseMedia.js`, `src/data/exerciseSteps.json`): start/finish photos and written steps from free-exercise-db (Unlicense, public domain) for 114 of our 127 database exercises; the 13 without a match fall back to a video search link. Only the name-to-id table and the steps (90 KB, lazy-loaded chunk) are in the repo; photos load from jsDelivr when a demo is opened (Netlify CSP `img-src https://*` already allows it). Shown on each Train exercise card and in the exercise database browser.
- **Live sync between devices (2026-10-12):** found that `useDocument` only fetched once and settings were only pulled when a device had none, so settings, the exercise library, steps, skin steps and favourites did NOT cross devices live. Now `useDocument` subscribes to `user_meta` realtime (unique topic per hook) and `utils/settingsSync.js` merges settings from the other device live (credentials stay local). New **Profile > Sync check** (`components/SyncCheck.jsx`): test ping with arrival time, and cloud-vs-device row counts. Needs `user_meta` in the realtime publication (`supabase/user_meta.sql` does it). Verified with a simulated realtime event, not two real devices.
- **Fitbit Air and Eufy:** Fitbit Air -> Google Health app (5.05+) -> Apple Health -> Health Auto Export -> `health-ingest`, same pipe as the Eufy scale; see `docs/deploy-runbook.md`. Direct Google Health API is blocked (not onboarding new projects, restricted scopes). `health-ingest` is still not deployed.
- **Health sync checklist:** `docs/health-ingest-checklist.md` (Supabase secrets, deploy `health-ingest --no-verify-jwt --use-api`, curl proofs with `docs/health-ingest-sample.json` and cleanup SQL, iPhone settings for automatic running, troubleshooting). Profile > Sync check also shows whether health data has arrived. Not yet done by Rob: A1-A6, B, C, D.
- **Not done:** supersets (Rob: skip), the steps from Apple Health (needs `health-ingest` deployed). Verified in a browser against an in-memory Supabase stand-in only.
- (old note, superseded) exercise demo images/video (needs a licensed dataset, ask Rob), supersets (Rob: skip), the steps from Apple Health (needs `health-ingest` deployed). Verified in a browser against an in-memory Supabase stand-in only.

**Not verified:** anything against real Supabase; swipe, slide, haptics and the food logger on a real iPhone; the intake Apply flow end to end (needs a signed-in session). Tests: 613 passing. HEAD: see `git log`.

# START HERE: current state (updated 2026-10-02)

Everything under the line "History" further down is older and partly superseded. Trust this section first, then the code.

**Repo** `D:\Work\Projects\Projects\VALERIE-MAKEOVER`, branch `main`, HEAD `9c61383`, tree clean, **533 tests pass**, `npm run build` and `build:pwa` pass. `dist/` holds a current PWA build ready for Netlify. Never touch `D:\Work\Projects\Projects\VALERIE` (Rob's original).

## Where the app is
- **No voice or chat AI** (Rob's decision). AI only runs as input tools (meal photo, describe a meal, skin photo, reviews, plan generators) through one Supabase function, `ai-chat`. The coach is a data engine (`domain/coachEngine.js`): it adjusts targets from logs, with Undo, and asks before bigger changes.
- **Navigation:** desktop is a floating **dock** (`components/Dock.jsx`, Greek glyphs, tab colours, a dot when Next moves are waiting in a group). Phone keeps its bottom bar. Every desktop screen sits in `.page-frame` (1240 px, centred). Logo: `components/AreteLogo.jsx` picks silver/gold/violet by theme (files in `src/public/assets/arete-*.png`, crops of the supplied board, so the wordmark is soft; Rob can supply cleaner exports).
- **Front pages (each group opens on one; desktop and phone):** Plan > **Agenda** (`tabs/PlanToday.jsx`, `domain/plan.js`), Coach > **Today** (`tabs/CoachToday.jsx`, `domain/coachToday.js`), Finance > **Overview** (`tabs/MoneyToday.jsx`, `domain/money.js`), Mind > **Today** (`tabs/MindToday.jsx`, `domain/mindToday.js`; journal entries are ordinary notes flagged `journal:true`). Coach also has **Insights** (week/month/year charts, one sleep-vs-training pattern) and a weekly recap + logging streak on Home (`domain/recap.js`, `domain/insights.js`). Screen ids are `agenda`, `coachtoday`, `moneytoday`, `mindtoday`, `insights` (never reuse the group ids `plan`, `coach`, `finance`, `mind`).
- **Food:** recipe builder (`components/RecipeBuilder.jsx`, `domain/recipes.js`), custom foods and favourites (`domain/customFoods.js`, `hooks/useFoodLibrary.js`, `components/CustomFoodForm.jsx`, `StarButton.jsx`). Saved meals store one serving at the top level plus the full recipe so they can be edited. Favourites are a document (`food_favourites` in user_meta); custom foods are the `custom_foods` collection.
- **Repeating tasks** now spawn their next copy from Home and Plan as well as Tasks (`domain/tasks.js nextOccurrence`).
- Removed this session: Focus mode, the dock quick-log and ring (Rob did not want them), dead mic buttons, orb CSS, the old VALERIE wording (user-facing text says Arete). Feature list vs the inspiration apps: `docs/feature-inventory.md`.

## Deployment state (Rob's accounts)
- **Supabase project in use: `jwzgxcqapxaomuenleyt`** (org Arete, Tokyo). The app's `.env` (gitignored) points at it. The OLD project `ywpwwxtimnqqruwxlpjb` (org Valerie, "VALERIE") is **paused**, untouched, resumable until Sep 2027, and still holds Rob's previous data. Nothing was migrated.
- **Done on the new project** (via the dashboard): `sync_all_tables.sql` (49 tables), `user_meta.sql`, `progress_photos.sql` (private bucket), plus `custom_foods`. All have owner-only row policies and realtime (verified by query). Edge function **`ai-chat` deployed** (Verify JWT on; refuses the public anon key with 401). Secret `ANTHROPIC_MODEL=claude-sonnet-5-5` set.
- **Netlify:** site `arete-dash.netlify.app`, deployed by dragging the `dist` folder. `netlify.toml` headers do not apply to drag-and-drop, so `src/public/_headers` carries the same headers (keep the two in step). Env vars for a Git-based deploy are listed in `docs/deploy-runbook.md` step 4.
- **STILL NEEDS ROB** (agents cannot do these: no API keys, no account creation, no security settings):
  1. Rotate the exposed keys (old Anthropic, ElevenLabs, Google search) and add the new Anthropic key as secret `ANTHROPIC_API_KEY` (Supabase > Edge Functions > Secrets). Until then every AI tool answers "not configured".
  2. Create his sign-in account (Supabase > Authentication > Users > Add user, Auto Confirm), then set secret `OWNER_USER_ID` and turn off public sign-ups.
  3. Redeploy `dist` to Netlify after any change (rebuild with `npm run build:pwa` first).
  4. Decide whether to migrate the old project's data.

## Verified vs not
- **Verified** in a browser with an in-memory Supabase stand-in (desktop 1280/1920, phone 375): every front page, recap/streak/Insights, dock, recipe builder, custom foods, favourites, button audit across all desktop screens (no crashes or console errors), and the production bundle loads through the PIN to the sign-in screen (served with `vite preview`).
- **Not verified:** anything against the real Supabase or the live `ai-chat`; Open Food Facts search (no route to it from the test browser; shows a fallback message); the Tauri/Windows build (no Rust toolchain here, installer renamed to Arete but never built); light (Arctic) theme and tablet widths; real iPhone.

## Gotchas that cost time
- **Test the production bundle before every deploy** (`npm run build:pwa`, `npx vite preview --port 4173 --outDir dist`). Dev mode hid a chunk cycle that blanked the live site (`shared -> tab-workout -> shared`). Fix: `src/domain` is in the `shared` chunk in `vite.config.js`. After a build, check the chunk graph has no cycles.
- **Browser testing needs a bypass** (PIN gate and sign-in gate) plus a fake Supabase: temporary lines marked `TEMP-VERIFY-BYPASS` in `src/App.jsx` and `src/main.jsx` and a throw-away `src/temp-verify-stub.js`. Remove all three before committing (`grep -rn TEMP-VERIFY src` must be empty). The stub also needs `.limit()` and friends. The browser pane can report width 0 (then the phone layout loads): call resize_window with an explicit size first.
- **Shell quoting:** long Node one-liners and heredocs containing apostrophes break in the bash tool. Write files with the Write tool, or edit with the Edit tool. Files are CRLF-aware in some cases (App.jsx is CRLF); scripts that edit them should match line endings. Never edit with PowerShell string ops (emoji corruption).
- The app opens each group on the last screen visited, so after adding a front page you may land on the old screen until you tap the new first chip.
- Only the browser's `localStorage` keys carry the doubled `valerie_valerie_lm_*` prefix for Look data (consistent everywhere; leave it).
- The PIN gate (`components/PinGate.jsx`) has a hard-coded PIN visible in the bundle. It is a light lock only; the real protection is the Supabase login.

## Rules that still bite
Never `git reset --hard`, `checkout --`, `clean`, or drop a stash. Never run `npm run deploy:pwa` (publishes to Firebase) unprompted. Never weaken `.gitignore`. No secrets in the repo, Obsidian or chat. Tailwind classes must be literal. Real personal data lives here: no destructive migrations. Screen ids never change. Local day keys via `utils/localDate.js`. Attach a verification level to every completion claim.

## Open work, in order
1. Rob's account steps above, then a real two-device sync test and a real `ai-chat` test (photo meal, describe a meal, skin photo, reviews, the Calendar day planner).
2. Phone Money screen is still the old phone layout under the new Overview chip; Settings > Notifications and a few other screens are unchanged and untested on the new dock.
3. Food gaps vs MyFitnessPal: remembered portions; star on the Recent & frequent chips; barcode scanning cannot work in iOS Safari (typed number is the path).
4. Dead code: unused Rust `ask_ollama` / `launch_ollama` / `ping_ollama` in `src-tauri/src/lib.rs` (remove only with a Tauri build available).
5. Desktop saved-meal and several other delete buttons have no confirmation.
6. Rob-blocked questions: Q-STANCE (which app), logo exports, whether to keep any of the older Mind screens, supersets in Train (needs a design decision), migrating old data.
7. Security tidy: replace the hard-coded PIN with a real unlock, move any remaining client-held credentials (Twilio) behind `send-sms`.

---
# History (older notes, in the order written; partly superseded)

**Written:** 2026-09-29, by Claude. **Repo:** `D:\Work\Projects\Projects\VALERIE-MAKEOVER`, branch `main`, clean tree, HEAD `8512a16`.
**Never touch** `D:\Work\Projects\Projects\VALERIE` (Rob's original, ~115 uncommitted changes). All work happens in MAKEOVER.

## Read first, in order
1. `C:\Users\bjp22\.claude\CLAUDE.md` and `.claude/CLAUDE.md` in the repo (engineering mode, verify don't assume, give every claim a verification level).
2. `docs/valerie-product-spec.md` — **the master spec (v2)**. Also `docs/valerie-revamp-audit.md`.
3. Obsidian: `D:\Work\Obsidian-Brain\BRAIN\01 - PROJECTS\Valerie\🧭 Agent Conduct.md` and `Session Handoff 2026-09-29 - Arete overhaul.md`.
4. Rob's brief: `D:\Work\Projects\Prompts\Valerie full revamp.txt`.

## What this is
A **rebuild of the existing VALERIE app**, not a new app. Rob wants a "turn my life around" app (gym, nutrition, finance, looksmaxxing) whose AI stays ten steps ahead: predicted restocks, meal-plan shopping lists, adaptive targets. It should stand beside MyFitnessPal, Strong/Liftoff, Skinbliss and sleep/water/weight coaches, with fast, professional animation that never lags. React 19 + Vite 7 + Tailwind 3 + Tauri 2, Supabase (Firebase leftovers exist). Ships as Tauri desktop, iOS PWA and Netlify. **One React codebase; phone and desktop count equally.**
Named **Arete**. Rob approved the visual board: https://claude.ai/artifact/JKq8pJ95VLtKVSQtdcHxbM.

## Decisions already made (don't reopen)
- Single user (Rob). Keep the existing shell, 6 themes, font picker, orb, backgrounds, animation intensity.
- Tabs: Home · Plan · Coach · Mind · Finance · Settings. Coach = Goal HQ · Train · Fuel · Recover · Look · Body · Habits · Style.
- Coach goal: templates (cut/bulk/recomp/glow-up) plus custom.
- Tab colours: Home #D8B26E, Plan #6FA8F2, Coach #F2784B, Mind #A98FF2, Finance #52CC9C; Settings uses the theme accent; Arctic gets darker variants.
- Headings Cinzel, numerals Geist Mono. Signature motion is transform/opacity only, ≤600 ms once per tab entry.

## What is built (commits since `3c77f12`)
| Commit | Area | Notes |
|---|---|---|
| `f199e8b`…`08b1f47` | Spec v2 | tab IA, Ahead engine, J11–J15 acceptance journeys |
| `9b1eb53` | Navigation | `src/nav/groups.js` maps groups onto **unchanged screen ids**; `SectionBar`; Sidebar shows groups; phone bar Home/Plan/Coach-orb/Finance/Mind, orb tap = Coach, hold = VALERIE sheet |
| `886b1ad` | Tokens | `--tab-accent`, `--font-display`, `--font-mono` in `globals.css`; `src/styles/appearance.js` applies theme, accent, fonts, tab colours, motion, background from settings; orb shape, animation intensity, background style now actually work |
| `d0c5f09` | Coach + Goal HQ | Health reused via `HEALTH_SECTIONS_BY_SCREEN`; `health` id aliases to `goal`; `domain/goals.js`; weekly adaptive-maintenance check proposes targets, never applies silently |
| `121d5bb` | Data safety | see "Fixed bugs" |
| `2019a09` | Train | `tabs/TrainSession.jsx`, `domain/training.js` |
| `635e6db` | Ahead engine | `domain/ahead.js`, Supplies (`tabs/Essentials.jsx`), meal plan ingredients |
| `6e9d303` | Rename | app surfaces only |
| `8512a16` | Home | `components/GoalRing.jsx`, `dayScore()` |

Key files: `src/nav/groups.js` (+`healthSection.js`), `src/domain/{goals,training,ahead,tasks}.js`, `src/tabs/{GoalHQ,Coach,TrainSession,Workout,Essentials}.jsx`, `src/utils/settingsStore.js` (single settings save path), `src/styles/appearance.js`.

## Verified state
- `npm test` → **77 passing** (vitest, `TZ=Australia/Sydney`). `npm run build` and `npm run build:pwa` pass.
- Every feature was exercised in the browser on desktop and 375 px (no console errors).
- **NOT verified:** Tauri build (no Rust toolchain on that machine); anything against the real Supabase (needs Rob's login — writes were tested with an in-memory stub of `supabase.from`); the Amazon add-to-cart URL (`https://www.<domain>/gp/aws/cart/add.html?ASIN.1=…&Quantity.1=…`); an independent review (Claude had no Codex second-opinion pass — **please review `domain/*.js` and `TrainSession.jsx`**).

## How to verify in a browser (there is a PIN and a sign-in gate)
Temporarily set in `src/App.jsx`: `useState(false)` for `locked`, `useState(true)` for `hasSession`, and `if (true) return;` at the top of the session effect, each marked `// TEMP-VERIFY-BYPASS`. Then `npx vite --port 1420 --strictPort`, set `localStorage.valerie_onboarded='true'`. To test writes, stub `supabase.auth.getSession` and `supabase.from` in the page. **Revert the bypass, `grep -rn TEMP-VERIFY src` must be empty, before every commit**; clear the localStorage keys you seeded; stop the dev server.

## Rules that bite (learned the hard way)
- **Never edit files with PowerShell string ops** (emoji corruption). Use the editor tools or Node. Shell quoting once ate backticked code in a heredoc; check diffs.
- No `git reset --hard`, `checkout --`, `clean`, or dropping stashes. Never run `npm run deploy:pwa`. Never weaken `.gitignore`.
- Tailwind class names must be literal (no interpolation). Real personal data lives here: no destructive migrations.
- Local day keys via `src/utils/localDate.js`, never `toISOString().split('T')[0]`. Tasks go through `useTasks`/`domain/tasks.js`; never write synced collections with `storage.set`.
- No `VITE_` secret may exist: Vite inlines it into the client bundle.
- Screen ids never change; groups only arrange them.
- `useCollection.add/update/remove` now return ids/booleans; failed fetches must never blank the local mirror.

## Fixed bugs worth knowing (all committed)
`usePeakState` and `useCollection` wrote `[]` over local mirrors on any failed fetch; `useCollection.update()` after `add()` silently did nothing; phone dashboard Tasks links opened a blank screen; meal plan vanished on leaving the screen and priced in GBP; Supplies used £ and had corrupted emoji.

## Known issues / risks (not fixed)
1. **Keys are exposed:** a live Anthropic key (plus ElevenLabs and a Google-shaped key) is bundled into every shipped build; the ElevenLabs key is also in plain text in `Obsidian …/Valerie/Core/🎙️ VALERIE VOICE.md`. Rob must rotate them; don't deploy until he has. Ask Rob before touching that note.
2. **Settings sync inconsistency:** `Settings.jsx`/`settingsStore.js` syncs the whole settings row including API keys to Supabase (intentional single-user design); `ai/actions.js` `toggleSetting`/`changeSetting` strip `apiKey`/`finnhubKey` before upserting the same row, which can wipe the synced keys. Fix with the server layer.
3. Twilio credentials are stored client-side; SMS is called from the browser (probably fails on web/iOS).
4. Dead code: `mobile/screens/MobileWorkout.jsx` (still imported by `MobileMore.jsx`) and the More grid. Delete once Rob agrees.
5. Phone Habits and Style show "available on desktop".
6. A saved `phantom` theme is silently changed to `obsidian` on load (`App.jsx`, leftover). Rob may want it restored.
7. The desktop Assistant orb (`VaIerieOrb.jsx`, canvas) is always a sphere; **don't change its drawing without Rob's visual approval.**
8. `.claude/launch.json` points at the dev server; the preview tool was flaky — start Vite by hand.
9. Logo: the app still uses the old star `src/assets/valerie-logo.png`. New Arete logos (silver/violet/gold) exist only as crops on the artboard; Rob must supply transparent full-size exports plus a small emblem.

## Open questions for Rob (blocked; ask, don't guess)
Q-INFRA approve Supabase Edge Functions as the server layer · Q-COACH personality (default calm expert, text) and voice on/off · Q-MIND keep Mind as its own tab? · Q-USE which features are used daily vs never (drives the removal list) · Q-STANCE what he wants from the STANCE app · Q-SMS countries/sender · restore Phantom? · Windows installer `productName`/start-menu folder rename (changing it installs a second app) · whether the AI keeps the name "VALERIE".

## Next work, in order
1. **Server layer (needs Q-INFRA yes):** Supabase Edge Function `ai-chat` (Anthropic key server-side only), then remove every `VITE_` secret, move ElevenLabs/Twilio behind it. Follow spec §7, §9.
2. **Coach AI:** one personality layer (spec §7.5) locked to the user's goal, fed by `coachGoal`, `dayScore`, Train PRs and Supplies forecasts. Voice pipeline notes are in Obsidian `Core/📐 VALERIE CORE OVERHAUL.md` (cleanForSpeech, action layer, continuous voice).
3. **Fuel (MyFitnessPal bar):** faster food logging (recents/frequents, barcode already exists in `utils/openFoodFacts.js`), macros+micros, water coach, weight coach. Then **Look (Skinbliss bar):** AM/PM skin routine that feeds Supplies usage schedules (the Ahead engine already reads `dosePerUse`/`usesPerDay`); progress photos.
4. **Ahead engine extensions:** food logs subtracting pantry items; skin/supplement schedules creating supply usage automatically; projected 30-day spend in Finance (spec §4.4).
5. **Signature motion** per tab (only Home's laurel draw and Coach's rep-kick exist; Plan time-snap, Mind ink-bloom, Finance odometer are designed in the board but not placed).
6. **Phone parity** for Habits/Style; delete dead phone code.
7. **Removal/revamp list** once Rob answers Q-USE.
8. **Logos** (when Rob supplies files), Tauri build/installer, security items above.

## Housekeeping when you finish a chunk
Commit small, one concern each, message ending with the attribution line the harness asks for. Update `docs/valerie-product-spec.md` and the Obsidian handoff note; log decisions with the Obsidian `log_decision` tool. Don't save secrets in Obsidian. The Obsidian MCP is available in Claude sessions; if you can't reach it, edit the markdown under `D:\Work\Obsidian-Brain\BRAIN\01 - PROJECTS\Valerie\` directly.

## Update — Codex independent review (2026-09-29)
- Reviewed `src/domain/*.js` and `src/tabs/TrainSession.jsx` as requested.
- Fixed malformed/impossible legacy supply dates crashing the full Supplies forecast; they now render as `unknown`.
- Fixed numeric-string top-set values being compared lexicographically (`"90"` could beat `"100"`).
- Fixed rapid queued Train writes recovering to an optimistic snapshot after a failure. Recovery now uses the last server-confirmed rows, only the newest mutation may repair UI state, and rejected promises use the same path.
- Verified: **79 unit tests**, `npm run build`, `npm run build:pwa`, `git diff --check`, and no `TEMP-VERIFY` markers.
- **Checkpoint pending:** this Codex environment was granted project and `.git` write access, but the OS still denied creation of `.git/index.lock`. The six changed files are intentionally left in the working tree; do not discard them.

## Update — server-side AI gateway coded (2026-09-29)
- Rob approved Supabase Edge Functions. Added authenticated `supabase/functions/ai-chat` plus the shared client in `src/ai/server.js`.
- All Anthropic calls now use the gateway: Coach chat, daily briefs, Mind/LM/Portfolio raw prompts and Fuel meal-plan generation. Desktop Ollama remains the offline fallback.
- Removed Claude API-key entry from Settings and removed every client reference to `VITE_ANTHROPIC_API_KEY`, `VITE_CLAUDE_API_KEY` and `VITE_ELEVENLABS_API_KEY`. Legacy Claude keys are scrubbed from local settings on load.
- `settingsStore.js` now strips Claude, voice, Twilio and integration credentials from the synced `user_meta` settings row. AI actions use that same save path, fixing the old whole-row overwrite inconsistency.
- Added manual deployment instructions under `supabase/functions/README.md`. **Not deployed:** the old exposed Anthropic key must be rotated first, then `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` set as Supabase secrets.
- Verified: **81 unit tests**, desktop build, PWA build, diff check, and built bundles contain no Anthropic/Claude/ElevenLabs secret markers. Edge runtime was not locally checked because neither Deno nor Supabase CLI is installed.
- Coach context now includes the locked goal and targets, today's five-factor score, PRs derived with Train's own detection rules, due-supply forecasts, and the selected personality (`calm expert` default; drill-sergeant and hype layers are ready when Q-COACH is answered).

## Claude resume summary — latest state

### Working tree
- Work only in `D:\Work\Projects\Projects\VALERIE-MAKEOVER`; never touch the original `VALERIE` tree.
- The working tree is intentionally **dirty** with the independent-review fixes and server/Coach work above. Codex could edit source but the environment denied `.git/index.lock`, even after `.git` permission was granted, so none of this latest work is committed. Preserve every listed change.
- Dev server was started with `npm run dev` at `http://localhost:1420/`.

### Latest coded work
- Review fixes: safe malformed supply dates, numeric top-set comparison, and server-confirmed recovery for rapid queued Train writes.
- Supabase Edge Function `ai-chat`: authenticated server-side Anthropic gateway; provider key and core Coach prompt no longer ship in the client.
- All Claude call sites route through the gateway, including Coach, daily briefs, Mind/LM/Portfolio and Fuel meal-plan generation. Ollama remains the desktop fallback.
- Client Claude-key UI and Vite secret paths removed. Legacy Claude keys are scrubbed locally. Provider credentials are stripped before settings sync. AI setting actions now use `settingsStore.js` instead of overwriting the row independently.
- Coach server context now contains active goal/targets, today's adherence score, recent PRs and due supplies. Calm expert is the default; drill-sergeant and hype prompt layers exist pending Rob's choice.

### Verification level
- **VERIFIED:** 81 unit tests pass; desktop Vite build passes; PWA build passes; `git diff --check` passes; built bundles contain no Anthropic/Claude/ElevenLabs secret markers.
- **NOT VERIFIED:** Edge Function runtime/deployment (no Deno or Supabase CLI); Tauri/Rust build; real Supabase writes; two-device propagation.
- Edge deployment is manual and blocked on rotating the exposed Anthropic key, then setting `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` as Supabase secrets. Instructions: `supabase/functions/README.md`.

### Database/cross-device audit — do not claim confirmed yet
- Intended design is correct: every device signs into the same email/password Supabase account; `getUserId()` uses the auth UID; `useCollection` fetches by `user_id`, maintains a local cache, writes to Supabase and subscribes to filtered realtime changes. `sync_all_tables.sql` creates collection tables, owner RLS policies and realtime publication entries.
- Live validation was blocked at the app's **Connect this device** sign-in screen; no credentials were entered or bypassed. The SQL's actual deployment status is unknown.
- The repository contains **no creation/RLS/realtime definition for `user_meta`**, although `useDocument` and settings depend on it. Verify the live table and add an idempotent schema migration to the repo before claiming full sync.
- AI actions still write water and sleep directly to local storage (`src/ai/actions.js`), so those assistant-created records do **not** propagate between devices. Calories use the legacy local health object too. Route these through the canonical Supabase collections/action handlers.
- `useDocument.save()` returns no success/failure result and initialises a query with a null UID if mounted outside the sign-in gate. Harden this while adding integration coverage.
- Required proof: apply/verify schemas, sign into two clients with the same account, create/update/delete a disposable record through normal UI, confirm realtime appearance on client B, reload both clients, and confirm settings/meal-plan documents plus collection data persist. Do not use Rob's real health/finance records for destructive testing.

### Best next order
1. Add/verify `user_meta` schema, RLS and uniqueness on `(user_id,key)`; harden `useDocument`.
2. Replace local-only AI health writes with canonical collection writes and confirmation cards.
3. Run a real same-account two-client sync test, then record the result.
4. Rotate/configure the Anthropic secret and deploy/test `ai-chat`.
5. Continue Fuel → Look → Ahead/Finance once the data foundation is proven.

## Update — Claude resumed (2026-09-29, after Codex)
Reviewed and committed Codex's dirty tree, then continued. HEAD is now `0d31c02`; tree clean; **102 tests**, build and build:pwa pass; every item below was also exercised in a browser (writes against an in-memory Supabase stub, never Rob's data).

| Commit | What |
|---|---|
| `4527dac` | Codex review fixes (bad supply dates, numeric set compare, Train write recovery) |
| `cb372f1` | Server AI gateway. **Added by Claude:** `ai-chat` now requires a signed-in user's token (`role=authenticated`). Supabase's default JWT check also accepts the public anon key that ships in every bundle, which would have let anyone spend the Anthropic budget. Still not deployed |
| `bd3ad22` | `supabase/user_meta.sql` (additive, idempotent, never touches rows; **not applied anywhere yet — Rob runs it in the SQL editor**) and a hardened `useDocument` (no null-UID query, keeps local on failed fetch, `save()` returns success) |
| `e02e1e2` | Assistant water/calories/sleep/mood now write the real tables via `domain/dayLogs.js` (before: device-local only; `logSleep` even replaced the `sleep_data` mirror list with an object). **Also fixed the phone:** `MobileHealth` read a nonexistent `sleep_logs` table and treated `duration` as hours (it is minutes) |
| `3b05923` | Fuel: one-tap "Recent & frequent" foods with Undo (`domain/foods.js`) |
| `0d31c02` | Look: structured skin routine (`tabs/SkinRoutine.jsx`, `domain/skin.js`): today's AM/PM checklist stored on the `lm_daily` row (`skin` field), weekday scheduling, ingredient-conflict warnings, steps linked to Supplies so the routine sets `usesPerDay` and the Ahead engine forecasts run-outs; imports the old free text (kept). Phone uses the same component |

| `de47099` | Weight coach (`domain/weight.js`, `components/WeightChart.jsx`): smoothed trend, weekly rate, pace vs the goal's weekly target; shown in Coach > Body > Weight and Goal HQ. Phone Body tab not yet |
| `1e8a145` | Finance overview: "Supplies · next 30 days" projected spend (`projectedSpend()` in `domain/ahead.js`). Phone Finance not yet |

| `a5145b4` | Water coach: one shared goal (`domain/water.js`, `utils/waterGoal.js`) used by the Water screen, overview, Home ring, Peak State, reminders, phone and assistant (four formulas before; the profile formula also ignored kg/lb); +500 ml on training days; pace advice with a one-tap log on the Water screen. Phone has the goal but no coaching line |
| `72c3904` | Plan "time snap" and Mind "ink bloom" screen entrances (CSS only; Reduced/None safe). Phone shell has no entrance animations yet |

| `371e532` | Micro coach (`domain/micros.js`): 7-day gaps + food suggestions in Fuel > Nutrition; refuses to judge unless 3+ days and half of meals carry micronutrient data (a missing value is not a deficiency) |
| `a1d71ee` | Phone parity: water pace advice, weight coach, supplies spend card; **fixed phone counting assistant/Gmail income as spending** (it tested `category==='income'`, those rows have `type:'income'`, category "Income") |

HEAD is now `a1d71ee`, **136 tests**, tree clean. Remaining gaps vs the brief: progress photos, micro coach on the phone, phone screen-entrance animations, STANCE (needs Rob).

### Gotchas found this session
- LM data keys carry a doubled prefix in localStorage (`valerie_valerie_lm_profile`, `valerie_valerie_lm_daily`) because the hooks pass `'valerie_lm_*'` as the storage key. Harmless, but remember it when seeding data.
- A dev server Codex left on port 1420 (this repo, sandboxed, cannot be stopped from a Claude session) serves **stale** files after edits. Start your own on another port (`npx vite --port 1421 --strictPort`).
- The browser-pane tool sometimes denies `navigate`; `preview_start` with the URL works.

### Still blocked on Rob (unchanged, plus new)
Rotate the Anthropic and ElevenLabs keys, then set `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` secrets and deploy `ai-chat`; run `supabase/user_meta.sql` and confirm `sync_all_tables.sql` has run; a same-account two-device sync test; Q-COACH, Q-MIND, Q-USE, Q-STANCE; logo exports; installer productName.

### Best next order (revised)
1. (Rob) apply SQL, rotate + deploy, two-device sync test. Without these the server AI reports unavailable off desktop.
2. Assistant actions should be proposals with confirmation cards (spec §7.3); today they still execute immediately (now to the right tables).
3. Fuel/Body: micro coach on the phone; barcode on the phone.
4. Look: progress photos; feed `skinSteps` into the coach context; ingredient warnings for more families.
5. Ahead: food logs subtracting pantry items (Finance projection is done).
6. Signature motion for Plan/Mind/Finance; phone Habits/Style; delete dead phone code; removal list once Q-USE is answered.

### Update — Claude resumed again (HEAD `697c2e3`)
- `8911f4f` micro coach on the phone (shared `components/MicroCoachCard.jsx`). `697c2e3` phone Plan/Mind screen entrances (`.m-screen` wrapper in `MobileShell.jsx`).
- 136 tests, build and build:pwa pass; checked in browser at 375 px. Remaining gaps: progress photos, phone Habits/Style, confirmation cards, pantry subtraction, removal list. Rob-blocked items unchanged.

### Update — progress photos (`cbf4a2f`)
- Body > Photos (desktop) and Body tab (phone) now use `components/ProgressPhotos.jsx`: Front/Side/Back, on-device compression (1600 px full, 420 px thumb), private bucket `progress-photos` with signed URLs, before/after slider with days and weight change (nearest weigh-in within 7 days, else none), lightbox with delete.
- **Rob must run `supabase/progress_photos.sql`** (table, RLS, realtime, private bucket, owner-only object policies). Until then uploads show "Photo storage isn't set up yet" and save nothing.
- Old device-only photos (localStorage `valerie_photos`) show under "On this device only" with a Move to cloud button; each is removed locally only after upload + row succeed.
- Verified in browser with in-memory Supabase/Storage stubs (desktop + 375 px): migrate, upload 4000x3000 -> 1600x1200, compare, delete, missing-bucket failure leaves no row or file. 148 tests; build and build:pwa pass. NOT verified: real Storage bucket/RLS, iPhone camera/EXIF, Tauri.

### Update — pantry subtraction (b42fbdc)
- Logged food now uses up Kitchen supplies (`pantryUsage`/`applyUsage` in `domain/ahead.js`, `utils/supplies.js` for mirror readers). Match rule: entry has a g/ml quantity, every word of the supply name is in the food name, same unit kind; most specific supply wins, ties match nothing. Derived on read: deleting a meal restores stock, nothing is saved. Per-supply "Subtract food I log" switch (`autoSubtract`).
- Run-out follows the log after 3+ days of use in 14, and is never later than the schedule. Feeds Supplies, cart, grocery list, Today, attention, assistant context, projected spend.
- Limits: needs g/ml quantities (search/scan entries have them; saved meals, recents and assistant-logged calories do not) and a pack size in g/kg/ml/l. Planned-meal ingredients are not yet logged with quantities.
- Verified: 160 tests; both builds; browser with seeded stub (5 kg rice, 6 days x 400 g -> 2.6 kg left, 10 days). Not verified: real data, phone Supplies view (none).

### Update — phone Habits and Style, feature map (692ec39)
- Phone Habits (`mobile/screens/MobileHabits.jsx`) and Style (`MobileStyle.jsx`, board + wishlist totals + outfit ideas) replace the "available on desktop" placeholders. Shared `mobile/Sheet.jsx`.
- Streaks were count-only (never broke). `domain/habits.js` now derives them from a stored `history`; legacy rows are backfilled from lastCompleted+streak. `streak`/`lastCompleted` are still written for other readers; Today, Progress, weekly review and assistant context use `withLiveStreaks`. Remaining stored-streak readers not changed: XP award loop (`utils/xp.js`, uses lastCompleted only), notifications.
- Style constants/helpers moved to `domain/style.js`. Desktop Google image search is not on the phone (needs a key in the client).
- `docs/inspiration-feature-map.md`: per-app gaps and a recommended build order. Q-STANCE still open (name matches several apps).
- 183 tests; both builds; browser at 375 px and desktop against a stub.

### Update — next-session suggestions and plateau detection (cba5e07)
- `domain/progression.js` (`suggestNext`, `detectPlateau`, `plateaus`, 17 tests) replaces the old last-top-set rule in `computeProgression` (Workout.jsx now delegates). Rules: add weight only if every working set (sets within 90% of the day's heaviest) hits the top of the range; hold and aim +1 rep otherwise; drop ~10% only after two consecutive missed sessions; restart 5/10/20% lighter after 3/6/12 weeks away; DELOAD (-10%) when no new estimated best for 4+ sessions over 2+ weeks, once (not again right after a deload). Suggestions only; nothing is written.
- Shown in Train (reason line, STALLED/SLIDING chip, stalled-lifts banner), the Overload Coach panel, and the assistant context. `plannedRows` uses the engine's `targetReps`.
- Limits: pure e1RM rule needs 5+ sessions; exercise settings (rep range, increment) come from the saved exercise list, the assistant falls back to 8-12 / 2.5 kg for unsaved lifts. Readiness (sleep debt) is not an input yet; planned next.
- Verified: 201 tests, both builds, browser with seeded 5-session bench history (DELOAD to 62.5 kg pre-filled, banner, chip, Overload Coach agrees). Not verified on a phone (the phone Train screen shares TrainSession).

### Update — recovery: sleep debt + readiness (8c3292c)
- `domain/recovery.js` (14 tests): sleep debt over 14 nights counting only logged nights (extra sleep repays max 1 h/night; needs 4+ nights), readiness 0-100 = last night 40% + debt 30% + last-48h training load 30%, renormalised over the parts that exist. `no-data` without a night or a debt. Sleep need setting `sleepNeedHours` (default 8, stepper in the card).
- `components/ReadinessCard.jsx` on Recover (desktop + phone), a line at the top of Train, and a line in the assistant context. `applyReadiness` in `progression.js`: on a go-easy day an ADD WEIGHT becomes HOLD (never lowers a weight, never blocks logging).
- Progression engine (`domain/progression.js`, 18 tests) shipped earlier this session: all-working-sets double progression, plateau detection (4+ sessions and 14+ days since best e1RM), DELOAD, layoff restart. Feeds Train, Overload Coach panel, assistant context.
- Verified: 216 tests; both builds; browser (desktop + 375 px, stub data). Not verified: real sleep data (rows come from the assistant, Health Auto Export or manual logs; nothing in the app logs sleep on the phone). Home ring not wired to readiness.

### Update — batch 2026-09-30 (Fuel/Look/Habits/assistant)
- **Goal weight ETA** (`weight.js goalEta`, Goal HQ field, `GoalEta` on Body and Goal HQ) and **training/rest-day targets** (`goals.js cycleTargets`, `utils/todaysTargets.js`; Goal HQ card; read by Fuel desktop+phone, Home ring, Peak State, assistant; stored base targets untouched; rest days keep at least half the base carbs, bonus scaled down if needed).
- **Fuel:** copy yesterday + quick-add with Undo (`domain/foods.js`, `components/FoodShortcuts.jsx`).
- **Toasts on the phone:** the toast host existed only in the desktop shell, so phone save errors and Undo prompts were silently dropped. Now `components/Toaster.jsx` is mounted by both shells.
- **Look:** daily skin rating (1-5 on the lm_daily row), weekly trend, routine-vs-rating comparison (`skin.js`); Face pose in the photo component, shown in Look.
- **Habits:** 12-week heatmap (`domain/habits.js heatmap`, `HabitHeatmap.jsx`), desktop + phone.
- **Assistant safety (Q-CONFIRM decided):** setting changes now need an Apply card (`ai/confirm.js`, `ActionConfirm.jsx`); secret-like keys (`key|token|secret|password|pin|auth|api|...`) and non-plain values are refused; logging stays instant.
- Verified: 254 tests; both builds; browser (desktop and 375 px) with stub data. Not verified against real Supabase.

### Update — batch 2 2026-09-30 (sleep, supplies, meal plan, Train polish, review)
- **Sleep logger** (`components/SleepLogger.jsx`, Recover desktop + phone): bed/wake or "about N h", updates the same night. Readiness needs logged sleep and nothing else in the app could create it.
- **useCollection**: instances of one collection now share changes instantly (in-memory peer bus), and each gets its **own realtime channel topic** (supabase.channel returns the existing channel for a repeated topic: a second hook threw and the first unmount killed it for all).
- **Supplies shelf life** (`paoMonths`, `expiry()`/`expiringItems()` in `domain/ahead.js`): use-by shown in Supplies, Today ("Use up soon", not visually verified) and the attention count.
- **Meal plan**: "Log now" logs a planned meal with its ingredients (Undo); pantry usage counts a meal's ingredients instead of the meal as a lump. Saved meals and recents keep ingredients. Meal sections (Breakfast/Lunch/Dinner/Snacks) with subtotals; desktop log can now remove entries (it could not before).
- **Train**: per-lift e1RM chart (History button), warm-up ramp and per-side plate breakdown for barbell lifts (`domain/plates.js`, fixed 20 kg bar and standard plates, not yet configurable).
- **Code review (high)** of everything since 91ddfb5: fixed the channel-topic bug, Netlify CSP (no Supabase in connect-src, camera blocked), `fetch(data:)` in photo migration, duplicate sleep rows summed, stale spend projection / Peak State deps, toast replacing an Undo. **Left as is:** TrainSession readiness dependency (needs a re-plan-untouched-rows design), 8 copies of a day-index helper, N fetches/channels per screen (a shared collection store), duplicated inline style constants.
- Verified: 279 tests; both builds; browser (desktop and 375 px, stub data). **Netlify CSP change is untested and undeployed.** Not verified: real Supabase, camera, skincare barcode scan, voice/photo food logging (not built).

### Update — batch 3 2026-09-30 (remaining features)
- **Fasting timer** (`domain/fasting.js`, `FastingCard`): 14/16/18/20 h presets, ring, 30-day stats, state in settings (`fast`, `fastLog`); desktop + phone Fuel.
- **Strength Score** (`domain/strength.js`, `StrengthCard` in Train): main barbell lifts vs bodyweight, rough adult-male ratios, weakest-lift hint. **Configurable bar and plates** (settings `barKg`, `platesKg`, editor in Train).
- **Check a product** (Look > Skin, `ProductCheck`, `utils/openBeautyFacts.js`, `checkProduct` in `domain/skin.js`): typed/scanned barcode via Open Beauty Facts or pasted ingredients; actives, morning/night clashes, add to routine + Supplies with shelf life. Paste path verified; live lookup and camera not. iOS Safari has no BarcodeDetector, so typing the number is the phone path. Netlify CSP now also lists the two Open *Facts hosts.
- **Split Planner**: "Suggest a week" for 2-6 days (`domain/split.js`), saved as a NEW program, optionally made active.
- **Photo meal scan** (`MealPhoto`, `domain/mealScan.js`, `ai-chat` now accepts one validated image in raw mode): estimate is editable, logged only on tap, marked estimated. Tested against a stubbed gateway only. **Redeploy `ai-chat`** (image support added) once the key is rotated.
- 322 tests; both builds; browser (desktop, stub data). Not built: dedicated voice-to-foods flow, exercise selection from goal/equipment, shared collection store, shared date helper.

### Update — batch 4 2026-09-30 (data core, Next moves, polish)
- **Shared collection store** (`supabase/useCollection.js`): one fetch and one realtime channel per table however many components use it; add/update/remove show everywhere at once; every mirror key of a table is kept in step; stop is delayed 8 s so screen changes do not refetch. Failed fetch never blanks the list. 11 tests with a fake Supabase (`useCollection.test.js`; `__store` export is for tests). Also unique realtime topics in `useAppleHealth` and `utils/xp.js`.
- **Next moves** (`domain/nextMoves.js`, `hooks/useNextMoves.js`, `NextMoves` under the Home goal ring, desktop + phone): ranked, time-of-day aware list (reorder, training vs readiness, fast done, log food, protein pace, under-eating, water, sleep debt, weigh-in, habits, expired supplies). Skin-routine step is not wired yet (`skin: null`). The old hydration nudge now uses the shared water goal.
- **Describe a meal** (typed or spoken) shares the photo review panel (`MealAI.jsx`); estimates carry ingredients so the pantry follows.
- **Fixes:** saved Phantom theme is no longer rewritten to Obsidian on launch; Train pre-filled rows refresh when readiness changes (untouched rows only); bottom sheets trap focus and restore it; one strict `utils/dayIndex.js` replaces six copies (four lax NaN-returning copies left alone on purpose: their arithmetic depends on NaN).
- 352 tests; both builds; browser (desktop + 375 px, stub data). Not verified against real Supabase or the live gateway.
- **Not built:** exercise selection from goal/equipment; skin step in Next moves; shared style constants (seven near-identical inline style sets); dead code removal (`MobileWorkout.jsx`, More grid) waits on Rob.

## Batch 5 (2026-09-30): product scoring and the coach's prompt layer

- **Next moves skincare** (`useNextMoves.js`): morning (7 am-noon) and night (from 8 pm) steps from `lm_profile.skinSteps` and today's `lm_daily.skin.am/pm` ticks. Ticks are per period.
- **Product scoring** (`domain/skinScore.js`, tests): 0-100 against `profile.skinProfile` = `{ type, concerns[], avoid }`, saved through the Look profile document. Every point carries a reason; null score without ingredients or profile. Cosmetic guidance, not medical. UI in `components/ProductCheck.jsx` ("Your skin" chips + score).
- **Coach prompt layer** (`ai/coachPrompt.js`, from `D:\Work\Projects\Prompts\Coaching Prompt`): `buildCoachBrief` picks methods by topic (nutrition, training, skin, sleep, body, habits), adds directives from `coachSnapshot()` in `ai/context.js` (weight pace, readiness, sleep debt, stalled lifts, skin trend), and a tone line. Sent as `coaching` to `ai-chat` (chat mode only, 12k cap, placed under the core rules). **Needs `ai-chat` redeployed**; until then the extra field is ignored and chat works as before.
- Not built from that prompt: skin/face photo analysis by the coach, scheduled reminders and notifications, wearable/device integration beyond Apple Health.

### Skin photo analysis (2026-09-30)
- `domain/skinAnalysis.js` (+tests): prompt, strict parser (missing/garbled scores fail rather than default), `scanContext` (skin profile + routine), `compareAssessments`, `assessmentRow` (same shape as the manual `lm_skin` assessment, plus `source: 'ai-photo'`). Prompt forbids diagnosis and prescriptions and sets `seeProfessional` for red flags.
- `components/SkinScan.jsx` in Look > Skin: photo -> review (scores 0-10, observations, suggestions, change since last assessment, referral banner) -> Save only on tap. Photo is shrunk, sent once through `ai-chat` raw mode with image, not stored.
- Needs `ai-chat` deployed with image support. Not verified against the live model or on screen.

### Batch 5b (2026-09-30): tiers, exercise picker, coach check-ins, shared label
- **Tiered routines** (`domain/skinTiers.js`, `components/SkinTiers.jsx`, in Look > Skin): Essential / Complete / Power from the skin profile; tests assert no clash warning for any tier x type x concern; steps shown first, added on tap, existing names skipped.
- **Exercise picker** (`domain/exercisePick.js`, `components/ExerciseSuggest.jsx`, in Train > Exercise Library): 37-move catalogue by equipment (Full gym / Home weights / Dumbbells / Bodyweight) and Coach goal; compounds first, then isolation; goal changes count and compound rep range; library-shaped entries; adds only names not already there. Starting weights are cautious guesses.
- **Coach check-ins** (`domain/reminders.js`, `hooks/useCoachReminders.js`, Settings > Notifications > Coach check-ins): morning (default 08:00) and evening (19:00), top Next move plus count of the rest, once per slot per day, within 3 h of the slot, never before 06:00 or from 22:00, 15 s warm-up after launch. Toast plus system notification where permitted; no SMS. `notifications.coach` is saved with the section (the section's save replaces the whole `notifications` object, so anything new must be added to that state too).
- **Shared style**: `components/ui.js` exports `label`, replacing 14 verbatim copies. Other near-duplicates (buttons, chips) differ slightly and were left.
- Verification: unit tests (408) and both builds only. None of these screens has been opened in a browser this batch.

### Browser check of batch 5 (2026-09-30, stand-in data, no Supabase)
Seen working in the desktop layout: Home "Morning skincare not done" move from ticks; Look > Skin > Check a product (profile chips, score with reasons, clash with a just-added retinol); Suggest a routine (Power tier preview, adds 3 steps, saved); Train > Exercises > Suggest exercises (Dumbbells only preview, adds 12, library 16 -> 28); Settings > Notifications > Coach check-ins (saved without losing the section's other settings) and the morning check-in firing once with the right message. NOT seen: Skin photo analysis with a real photo (needs `ai-chat`), the phone layout for these, push notifications.
Quirks found: Look mirrors and `notif_flags` are stored under a double `valerie_` prefix (`storage.get('valerie_lm_profile')` reads `valerie_valerie_lm_profile`); it is consistent everywhere, so leave it, but tests and manual seeds must use it. Avoid-list words now match label synonyms (fragrance = parfum, coconut = cocos nucifera, alcohol, paraben, sulfate).
Removed: `mobile/screens/MobileWorkout.jsx` and the unused More grid in `MobileMore.jsx` (only `TasksScreen` and `PlaceholderScreen` remain, used by MobileShell). Installer `productName` and Start Menu folder are now "Arete" (identifier `com.valerie.assistant` unchanged so app data stays put); the Tauri build was not run. Go-live steps that need your accounts: `docs/deploy-runbook.md`.

### Server-held voice and SMS credentials (2026-09-30)
- New Supabase functions (not deployed; Deno is not available here so they were not run): `voice-tts` (ElevenLabs; returns the MP3 as octet-stream so supabase-js hands back a Blob) and `send-sms` (Twilio; the destination is the `SMS_TO` secret, so it can only text the owner). Both require a signed-in user JWT via `functions/_shared/http.ts`.
- Client: `utils/serverVoice.js` (`fetchServerTTS`, `sendServerSMS`, tested with an injected invoke). A 404/503 marks a function unavailable for the session. `ai/speech.js` tries the server first, then the old client key, then Azure/browser voice. SMS is opt-in through Settings > Notifications > Text messages (`notifications.sms`); without it the old Twilio-in-settings path is unchanged.
- Still true until you migrate: `VITE_ELEVENLABS_API_KEY` is baked into the bundle. Steps: `docs/deploy-runbook.md` 2b.

### Batch 6 (2026-09-30): recovery map, Overall rating, breathing
- **Muscle recovery** (`domain/muscleRecovery.js`, `domain/muscles.js`, `components/MuscleRecovery.jsx`, Recover on desktop and phone): per-muscle worked / recovering / ready from logged sets (whole days: logs carry a date, not a time), weekly sets against 10-20, best split day. `muscles.js` is now the single exercise-to-muscle table (moved out of `tabs/Workout.jsx`, includes the picker's exercises).
- **Overall** (`domain/overall.js`, `hooks/useOverall.js`, `components/OverallCard.jsx`, Home under Next moves): 0-99 from five weighted pillars over 28 days vs the 28 before. A pillar with no record on or before the window's end is left out (so a first month shows no change); a lapse after tracking started scores low. Weights in `WEIGHTS`.
- **Breathing** (`domain/breathing.js`, `components/BreathingTool.jsx`, Mind > Breathe): box, 4-7-8, quick reset; timing is pure and tested. It uses requestAnimationFrame, which does not run in a hidden tab (the exercise resumes correctly from elapsed time when visible).
- Seen in a browser with stand-in data: all three. Not seen: phone layout, real synced data.

### RPE per set (2026-09-30)
- Finished sets in Train have a "How hard?" row (6-10, tap again to clear). Stored as `rpe` on each entry of `workout_logs.sets` (optional; older logs have none). `validRpe` in `domain/progression.js` is the one validator.
- `suggestNext`: when every working set hit the top of the range but the average effort was 9.5+, it HOLDs and says to repeat the weight; at 7 or under it still adds weight and notes it felt easy. Effort counts only when at least half the working sets were rated.
- Verified in a browser with a stubbed Supabase (set logged, rating saved, cleared, new set does not inherit it) and 5 new tests. To test writes in a browser: `await import("/src/supabase/supabase.js")`, then replace `supabase.auth.getSession` and `supabase.from` with an in-memory chain before tapping.

### Clash families and what was skipped (2026-09-30)
- `domain/skin.js` now also warns on: vitamin C with a retinoid or an acid (tip), benzoyl peroxide with an acid (tip), copper peptides with vitamin C / acids / retinoids (tip), a physical scrub with an active (warn), two retinoids in one routine (warn). New tags `copper` and `scrub`. Tier routines still produce no warnings (tested).
- Deliberately not built: supersets (would change how a session is structured; needs a decision), drink types and weather adjustment for water (see the feature map for why).

### Server-held voice and SMS credentials (2026-09-30)
- New Supabase functions (not deployed, Deno not available here so not run): `voice-tts` (ElevenLabs, returns MP3 as octet-stream so supabase-js gives a Blob) and `send-sms` (Twilio; destination is the `SMS_TO` secret, so it can only text the owner). Both require a signed-in user's JWT via `functions/_shared/http.ts`.
- Client: `utils/serverVoice.js` (`fetchServerTTS`, `sendServerSMS`, tested with an injected invoke). 404/503 marks a function unavailable for the session. `ai/speech.js` tries the server first, then the old client key, then Azure/browser. SMS is opt-in through Settings > Notifications > Text messages (`notifications.sms`); without it the old Twilio-in-settings path is unchanged.
- Still true until you migrate: `VITE_ELEVENLABS_API_KEY` is baked into the bundle. Steps in `docs/deploy-runbook.md` 2b.

### Polish pass (2026-09-30)
- **Text corruption repaired.** The 2026-09-21 checkpoint (3c77f12) had reduced every character above U+00FF to its low byte and dropped control results ("=% Afternoon  push it", "68 reps", junk emoji icons). 776 lines/fragments were restored exactly from 3c77f12~1 by recomputing that transform; leftovers were fixed by hand. If more junk shows up, compare against `git show 3c77f12~1:<file>`.
- **One icon set:** `components/icons.jsx` (`<Icon name size />`, 24px line icons, currentColor). Used by the sidebar, command palette, Train/Fuel/Settings side menus, empty states, Focus controls, phone Settings gear. Files with their own local `Icon` import it as `LineIcon`.
- **Readability:** inline font sizes below 10px raised (7-9.5 -> 10.5, 10 -> 11); hard-coded white text at 25-75% opacity now uses `--text-muted` / `--text-secondary`; `--text-muted` raised to about 42% in dark themes. 53 invalid `var(--x)HH` colours became `color-mix(...)`.
- **Layout:** Home is centred (max 1240) with two columns from 1100px (`.home-grid` in globals.css); no fixed-height panels. Width caps: Coach sections 1040, Mind 880, Settings 760. Nudges are bottom-right and hidden on Home. Weight chart draws at real width (`hooks/useWidth.js`). Heatmap cells square. Sliders themed globally. Phone: Tasks padding restored, dead Spotify placeholder removed, section row fades at the edge, Fuel shortcuts in an even grid.
- Seen in the browser at 1280x800 and 390x844 with stand-in data. Not seen: light (Arctic) theme, tablet widths, the Tauri window.

### No assistant; the coach is a data engine (2026-09-30)
Rob does not want a voice AI or anything to talk to. The coach keeps the plan in step with the logs.
- **Removed:** the orb and hold-to-talk sheet, the Ask screen (old links open Home), all speech (ElevenLabs, browser speech, spoken bedtime/focus lines), the AI daily brief, the Look coach chat, Mind advisors, the Portfolio advisor chat, Voice/AI/Daily Brief settings, assistant name/personality/greeting/custom context, onboarding steps 2-7, ActionConfirm + ai/actions + ai/confirm, the voice-tts function, and ai-chat's chat mode (it now accepts `mode: 'raw'` only). `src/ai/` now holds only `server.js` (used by `utils/claudeRaw.js`). Quick capture adds a task. The sidebar status light shows Internet and Sync only. Tauri's Rust `ask_ollama`/`launch_ollama` commands are still in `src-tauri` but nothing calls them.
- **Kept (tools over your own data):** meal photo, describe a meal, skin photo, weekly and monthly reviews, Mind insights, meal-plan and day-plan generators.
- **Coach engine** (`domain/coachEngine.js` + tests, `hooks/useCoachEngine.js`, `components/CoachUpdates.jsx`): rules maintenance (auto), macros (auto), goal-reached (ask), split (ask), each with a cooldown (14/14/30/28 days). App mounts `useCoachEngine({ run: true })`; it waits for body/nutrition/workout/program collections to sync, applies one auto update per pass, toasts it with Undo, and logs it in `settings.coachLog` (newest first, 30 max). Undo only works on the newest goal change and only while the goal is unchanged since. Split apply adds a new active program and deactivates the old; undo reactivates the old and keeps the new (never deletes a program). The feed is on Home (hidden when empty), phone Home, and Goal HQ (replaces the old manual "weekly check" card).
- Verified in a browser with a stubbed database: auto-apply raised calories 2240 -> 2360 from a real maintenance of 2950, Undo restored 2240/2800 and it did not re-apply; goal-reached Apply switched to Recomp at 2800. Not verified: the split rule in the UI, real Supabase.

### Water goal follows weight (192cec1)
- Coach engine has a fifth auto rule: the water goal is kept in step with body weight (cooldown, Undo via the same feed). 454 tests and `npm run build` pass (re-checked 2026-10-01, tree clean). Not verified in a browser or against real Supabase.

### Split rule checked in a browser (2026-10-01)
- Stubbed database, 5-day plan with 2 sessions a week for 3 weeks: Home showed "Switch to a 2-day split?" as a question (not auto-applied). Apply added an active "2-day plan (coach)" and deactivated the old plan (kept); Undo reactivated the old plan, left the new one inactive, marked the log entry undone, and the question did not come back. Not verified against real Supabase.
- Exposed keys removed from the gitignored `.env` (Claude, ElevenLabs key and voice id, unused Google search key and cx) and redacted in the Obsidian voice note. Git history and built bundles held no real key. The keys themselves are still live until rotated at the providers.

### Logos, recap, streak, Insights (2026-10-01, 62ad246)
- **Logos:** `components/AreteLogo.jsx` picks silver (Obsidian/Midnight), gold (Ember/Crimson/Arctic) or violet (Phantom) from `data-theme`; files are in `src/public/assets/arete-*.png` (black knocked out to transparent from the supplied board crops, 724 px, so the wordmark is soft). PWA icons and `src-tauri/icons` regenerated from the gold emblem. Arctic uses a darkening filter. Rob should still supply clean transparent exports if he wants crisper art. Tauri build not run.
- **Recap and streak:** `domain/recap.js`, `hooks/useRecap.js`, `RecapCard`, `StreakCard`, `HomeRecap` (Home Mon/Tue until dismissed via `settings.recapSeen`). Streak = any logged day (workout, food, sleep, weigh-in, habit).
- **Insights** (Coach > Insights, desktop and phone): `domain/insights.js`, `tabs/Insights.jsx`, `TrendChart`. Pattern shown only with 3+ weeks of sleep and 4+ trained days each side.
- Verified: 473 tests, both builds, browser with stub data (Home recap, Insights month/year, pattern, logo). Not seen: phone width, light theme, real Supabase.
- Also removed this session: dead mic buttons, VALERIE wording, orb CSS; the day planner now calls `ai-chat` (needs deploy).

### Front pages for Plan, Coach and Finance (2026-10-01)
- **Mind > Today** (`tabs/MindToday.jsx`, `domain/mindToday.js`: mood strip, daily journal stored as a flagged note, standard of the day, decisions to revisit, breathing). **Plan > Agenda** (`tabs/PlanToday.jsx`, `domain/plan.js`), **Coach > Today** (`tabs/CoachToday.jsx`, `domain/coachToday.js`), **Finance > Overview** (`tabs/MoneyToday.jsx`, `domain/money.js`): each group opens on a front page (desktop and phone) with one-tap logging; the older screens are unchanged and still reachable. Screen ids `agenda`, `coachtoday`, `moneytoday` (never `plan`/`coach`/`finance`: those are group ids).
- Desktop navigation is a floating dock (`components/Dock.jsx`); Focus mode was removed; every desktop screen sits in `.page-frame` (1240 px, centred).
- Finance Overview: safe-to-spend uses budgets when set (storage key `budgets`), otherwise income minus spend and bills still due. Month-end pace needs 5 days of data. Verified with demo data only; the month-start demo had just one day of spending.
- Repeating tasks now spawn their next copy from Home and Plan as well as Tasks (`domain/tasks.js nextOccurrence`).

### Recipe builder (2026-10-01)
- `components/RecipeBuilder.jsx` + `domain/recipes.js`: build a meal from ingredients (food search via Open Food Facts, recent foods, or by hand), quantities scale the numbers, servings divide the total. Saved to `saved_meals` as one serving at the top level plus `recipe: { servings, items }` so it can be edited; `ingredients` are per serving so logging a portion uses up pantry stock. Desktop: Fuel > Nutrition (Build recipe, My Meals Edit/portions/Log with Undo). Phone: "My meals" card on Fuel (sheet builder). Logged entries keep the recipe name and carry `portions` when not 1.
- Food search could not be exercised in the test browser (no route to Open Food Facts); it shows a clear fallback message. Verified with demo data: build, save, edit, delete, log 1.5 portions, ingredients scaled.
- The old desktop saved-meal "x" deletes with no confirmation (pre-existing).

### Custom foods and favourites (2026-10-01)
- **Custom foods** (`domain/customFoods.js`, `components/CustomFoodForm.jsx`, collection `custom_foods`): a food with a serving size and numbers for one serving; logged by servings (qty scales). Desktop: Fuel > Nutrition > "New food", "Log food" > My Foods. Phone: "My foods" card. They also appear as "My foods" chips in the recipe builder.
- **Favourites** (`hooks/useFoodLibrary.js`, document `food_favourites` in user_meta): star anything (a logged entry, a saved meal, a custom food) and log it again in one tap, exactly as starred. Row above Recent & frequent (desktop), card on the phone. Max 40, newest first, matched by name.
- **Database:** new table `custom_foods` (same shape and owner-only policy as the others) added to `supabase/sync_all_tables.sql` and already created on the Arete project through the SQL editor (RLS, policy and realtime checked).
- Not built: remembered portions; starring recent-food chips directly (star the logged row instead).

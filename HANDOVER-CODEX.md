# Arete (was VALERIE) — Handover for the next agent

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

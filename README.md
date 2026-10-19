# Arete

A personal gym, nutrition and looks app. One React codebase ships as an **iPhone/Android PWA**, a **Netlify website** and a **Windows desktop app (Tauri)**.

> Single-user and private by design. It holds real health, body, food and training data. Keep the repository private.

| | |
|---|---|
| **Stack** | React 19 · Vite 7 · Tailwind 3 · Tauri 2 · Supabase (database, auth, edge functions) · Sentry |
| **Language** | JavaScript (ESM). No TypeScript, no linter |
| **Tests** | Vitest, 879 tests on the pure logic (`src/domain`, `src/utils`, shared server code) |
| **No AI link** | The app runs without any AI provider. AI-written plans are pasted in and read by fixed rules |

---

## What it does

| Area | Highlights |
|---|---|
| **Train** | Session logger with progressive overload, rest timer, personal bests, readiness-aware weights. Split planner with 16 templates, 120+ exercise database with demos and form notes, muscle ranking, history |
| **Fuel** | Fast food logger (search 19,000 bundled foods, barcode scan, favourites, remembered portions, photos), recipe builder, custom foods, meal plan with shopping list, water coach, micronutrient coach |
| **Progress** | Weight trend and pace, measurements, progress photos, weekly check-in, goal ETA, sleep, habits, insights |
| **Look** | Skin routine with rosacea-aware rules, hair, grooming, style |
| **Home** | Configurable cards: calories left, weight, streak, skin, water, sleep and readiness, health metrics |
| **Coach (no AI)** | Rules engine that adjusts targets from your logs, with reasons and Undo. Also reads Fitbit data (resting heart rate, HRV, sleep, activity) |
| **Plan import** | Paste a meal or training plan from Claude, ChatGPT or notes. Fixed rules read it, you review it, then it is saved. Whole coaching briefs can be kept as **Plan options** beside your real plan |
| **Health sync** | Eufy scale and Fitbit Air to Apple Health to Health Auto Export to Supabase |
| **Reminders** | Free scheduled push notifications (replaces SMS) |

---

## Quick start

Requires Node 20+.

```bash
npm install
cp .env.example .env      # then fill in your Supabase values
npm run dev               # http://localhost:1420
```

On the dev server only, the PIN lock and sign-in are skipped so you can look at screens (add `?login=1` to see the real gates, `?demo=1` for sample health data). Nothing syncs in that mode. These shortcuts are removed from production builds.

### Environment variables (`.env`, never committed)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Your Supabase project (the anon key is public by design) |
| `VITE_VAPID_PUBLIC_KEY` | Public key for push reminders (optional) |
| `VITE_SENTRY_DSN` | Error reporting (optional) |

Anything prefixed `VITE_` is embedded in the shipped app, so **never** put a secret in one. Server secrets live in Supabase (Edge Functions > Secrets).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Run all tests (sets the Sydney time zone they expect) |
| `npm run build` | Desktop web bundle into `src-tauri/frontend/` |
| `npm run build:pwa` | PWA build into `dist/` (what Netlify serves) |
| `npm run tauri dev` / `npm run release` | Desktop app (needs the Rust toolchain) |
| `npm run deploy:pwa` | **Publishes to Firebase hosting. Outbound. Do not run casually** |

---

## Deploying

**Website / PWA (Netlify).** `npm run build:pwa`, then drag the `dist` folder onto the Netlify site, or connect the repo (`netlify.toml` is set up). Headers for drag-and-drop deploys live in `src/public/_headers`; keep it in step with `netlify.toml`. Test the production bundle before every deploy: `npx vite preview --port 4173 --outDir dist`.

**Desktop (Tauri).** `npm run release` builds the Windows installer. Needs Rust and the Tauri prerequisites.

**Supabase.** Run these in the SQL Editor (all idempotent): `supabase/sync_all_tables.sql`, `user_meta.sql`, `progress_photos.sql`, `health_sync.sql`, then `push.sql` after the push function is deployed. Edge functions are in `supabase/functions/` (see its README):

| Function | Purpose | JWT |
|---|---|---|
| `ai-chat` | One-shot AI input tools (meal photo, describe a meal, skin photo). Optional | on |
| `health-ingest` | Receives Health Auto Export data | **off**, token-gated |
| `push-send` | Sends scheduled push reminders | on, cron token |
| `food-search`, `send-sms` | Optional extras | on |

Step-by-step guides: [`docs/deploy-runbook.md`](docs/deploy-runbook.md), [`docs/health-ingest-checklist.md`](docs/health-ingest-checklist.md) (Eufy and Fitbit), [`docs/push-setup.md`](docs/push-setup.md) (push reminders), [`docs/services-and-costs.md`](docs/services-and-costs.md).

---

## Project layout

```
src/
  tabs/         Full screens (Train, Fuel/Health, Look, Profile, Insights ...)
  components/   Reusable UI (food logger, metrics card, plan importers ...)
  mobile/       Phone-specific screens and the bottom-sheet shell
  domain/       Pure logic with tests: coach engine, goals, splits, recovery,
                food database, plan importers, Fitbit coach, push schedule
  hooks/        Data hooks (collections, documents, health history, coach engine)
  supabase/     Client, offline write queue, realtime sync
  utils/        Helpers (dates, storage, photos, settings sync)
  nav/          Navigation groups and screen ids
  data/         Bundled food packs and exercise steps (lazy-loaded)
  styles/       Design tokens and motion system (system.css)
supabase/       SQL schemas and edge functions (shared code in functions/_shared)
src-tauri/      Desktop shell (Rust)
scripts/        Setup scripts (health sync) and data builders (food micros)
docs/           Runbooks, specs, audits and reference notes (see docs/README.md)
```

---

## Conventions that matter

- **Pure logic in `src/domain`** with a test beside it. UI stays thin.
- **Local day keys** come from `utils/localDate.js`, never `toISOString().split('T')[0]`.
- **Tailwind classes must be literal.** Never build a class name by string interpolation; use a lookup map.
- **Screen ids never change.** Navigation groups only arrange them.
- **Offline-safe saving.** Writes go through `useCollection` / `useDocument`, which queue while offline.
- **Real personal data lives here.** No destructive migrations without an explicit decision. Never weaken `.gitignore` (it keeps `.env`, `API KEY*` and `*.key.md` out).
- **A change that works in the browser but breaks the Tauri build is not done.** Run both builds.

---

## Docs

[`docs/README.md`](docs/README.md) indexes everything. Start with [`HANDOVER-CODEX.md`](HANDOVER-CODEX.md) for the current state, open items and gotchas.

## Privacy and security

- Single owner: lock the project to your account (`OWNER_USER_ID` secret, public sign-ups off).
- Health data goes only to your own Supabase project. Nothing is sent to a third-party server.
- The in-app PIN is a light lock; the real protection is the Supabase sign-in.
- Food data: USDA FoodData Central (public domain) and Open Food Facts (ODbL, credited in the app).

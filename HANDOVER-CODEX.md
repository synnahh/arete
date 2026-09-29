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

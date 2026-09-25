# Valerie Revamp — Audit & Baseline

> Working copy: `D:\Work\Projects\Projects\VALERIE-MAKEOVER` (a copy of `VALERIE` taken 2026-09-21, including the owner's ~114 uncommitted changes). The original folder is untouched.
> Audit date: 2026-09-25. Version audited: `package.json` 2.3.0 (`name: valerie-temp`).
>
> **Verification levels used below**
> `RAN` executed and observed · `SEEN` observed in a browser · `READ` read in source, not executed · `UNVERIFIED` inferred, needs a test.
> Nothing in this document is marked `RAN` or `SEEN` unless it was.

---

## 0. Read this first — urgent findings

### 0.1 A live Anthropic API key is baked into every shipped bundle — `READ` + `RAN`

Vite inlines every `VITE_*` variable into the JavaScript it emits. `.env` contains `VITE_CLAUDE_API_KEY`, and the resulting 108-character `sk-ant-api03…` key is present in:

| Location | Contains the key? |
|---|---|
| Fresh `npm run build:pwa` output (`dist/assets`) | yes |
| `NETLIFY DEPLOYS\VALERIE-V2` and `VALERIE-Unified` (what was uploaded to Netlify) | yes |
| `D:\Work\GitHub\Valerie-IOS\assets` (committed, commit `a674179`) | yes |
| `D:\Work\GitHub\Valerie-windows\VALERIE-Netlify-Desktop\assets` | yes |

Identity check: the SHA-256 prefix of the key in `.env` equals the one in the committed iOS bundle, so this is the live key, not a placeholder. The same folders also contain one ElevenLabs-shaped key and one Google `AIza…` key (counts only; values were never printed or stored).

What is **not** established: whether the Netlify site is publicly reachable (its URL is not in the repo) and whether any copy left this machine. The `origin` remotes (`github.com/synnahh/Valerie-IOS`, `Valerie-windows`, `Valerie-desktop`) return HTTP 404 both authenticated and anonymous, so those repos are not currently online under that account.

**Action for the owner (cannot be done by me):** treat the Anthropic and ElevenLabs keys as exposed. Rotate both in their consoles, then let the makeover move all model and voice calls behind a server so a browser never holds them (see spec §7). Until rotated, do not deploy any new build from this tree.

### 0.2 Other security-relevant findings

| # | Finding | Level |
|---|---|---|
| S1 | Claude is called directly from the browser with the `anthropic-dangerous-direct-browser-access` header (`src/ai/claude.js`). There is no server in this stack. | `READ` |
| S2 | The full settings object, including `twilioAuthToken`, `twilioAccountSid` and any user-entered Claude/ElevenLabs/Finnhub keys, is upserted to Supabase `user_meta` as plaintext JSON (`Settings.jsx` ~L2914; code comment: "keys are safe in the user's own row"). RLS limits reads to the owner, but secrets at rest in an application table are still a risk. | `READ` |
| S3 | The app PIN is the literal `'0308'` in client code (`PinGate.jsx`). It is a screen lock only, not access control, and is readable by anyone who can load the bundle. | `READ` |
| S4 | Twilio is called from the client with Basic auth (`src/utils/twilio.js`). Twilio's REST API is not designed for browser calls, so this probably fails on web and iOS and works only inside Tauri. | `UNVERIFIED` |
| S5 | Row-level security is sound in shape: `user_id = jwt.sub` on all 50 sync tables. But `user_meta`, `health_sync` and the push-subscription table are not defined anywhere in the repo, so the database cannot be rebuilt from source. | `READ` |
| S6 | `npm audit` at install: 11 vulnerabilities (1 critical, 6 high). Not triaged. | `RAN` |

---

## 1. Current architecture and stack

| Layer | Fact | Level |
|---|---|---|
| UI | React 19.1, Vite 7.3, Tailwind 3.4 configured but barely used (15 `className=` against 3,887 inline `style={{` blocks) | `READ` |
| Shipping targets | Tauri 2 desktop (NSIS), PWA build, Netlify static hosting. `npm run deploy:pwa` publishes to **Firebase** and must not be run unprompted. | `READ` |
| Data | Supabase (Postgres + realtime + email/password auth). One table per collection with shape `id, user_id, data jsonb, created_at`, plus a `user_meta` key/value table. | `READ` |
| Local state | `localStorage` under prefix `valerie_`; 55 keys in `STORAGE_KEYS`. | `READ` |
| Firebase | **Dead code.** Nothing outside `src/firebase/` imports it, and the fresh build emits no Firebase chunk. The `firebase` package, four files, and stale UI copy remain. | `READ` + `RAN` |
| AI | Claude `claude-sonnet-4-20250514` (hard-coded), non-streaming, `max_tokens 1024`, last 12 messages; Ollama local fallback; ElevenLabs/Azure/browser speech. | `READ` |
| Monitoring | Sentry, production only. Release string is `valerie@0.1.0` against app version 2.3.0. | `READ` |
| Server | **None.** No API, no edge functions, no cron, no webhook receiver. This is the central constraint for SMS, secrets and cross-device reminders. | `READ` |
| Size | 102 source files, 35,720 lines. 20 desktop tabs, 5,553 lines of mobile screens. | `READ` |

### 1.1 "iOS" is the mobile shell of this same codebase

`src/utils/platform.js` states it plainly: PWA/Netlify builds with `VITE_FORCE_MOBILE=true` always render the mobile shell, "this is the iOS app". `D:\Work\GitHub\Valerie-IOS` contains only compiled Vite output (`index.html`, `sw.js`, `assets/*.js`), no source and no Xcode project. There is no native iOS code anywhere I searched.

Consequence: web and iOS already share one codebase, one Supabase project and one auth. The real problem is that they are **two parallel UIs with unequal features** (§4).
**This needs owner confirmation** (see open questions in the spec).

### 1.2 Routing

No router. `App.jsx` holds `activeTab` in state and maps 20 ids through a static `TAB_MAP`. All 20 tabs are imported eagerly; there is no `React.lazy`. Ids: dashboard, assistant, tasks, calendar, notes, health, workout, finance, portfolio, progress, style, essentials, lists, focus, vault, settings, routines, mind, lm, places.

Global overlays mounted in `App.jsx`: `QuickCapture`, `CommandPalette` (Ctrl+K), `NudgeStack`, `WeeklyReview`, `TodayView`.

Mobile shell nav (7): Home, Health, More, Finance, Mind, Portfolio, Settings.

---

## 2. AI system as built (`src/ai/`)

| Concern | What exists | Gap |
|---|---|---|
| Prompt | One large identity prompt in `claude.js`. It hard-codes the user's name as "Rob" and instructs "address the user as Rob". | Personalisation is a string literal, not data. |
| Context | `context.js` builds a plain-text snapshot from `localStorage` every request: tasks, events, habits, focus, water, sleep, mood, XP, spend, body, looksmaxxing. | No retrieval, no relevance, no history. It reads only local storage, so anything that lives only in Supabase is invisible to the assistant. |
| Actions | `actions.js`: 16 action types (navigate, addTask, addNote, addCalendarEvent, logMood, logWater, addTransaction, changeSetting, …). The model is told to answer in a JSON envelope `{speech, actions, remember}`; `parseResponse` extracts it from free text. | Text protocol rather than typed tool calls. **No confirmation gate**: a grep for "confirm" in `src/ai/` and `Assistant.jsx` returns nothing. Actions execute on parse. `changeSetting` can alter app settings. |
| Memory | `useAI.js`: if the model returns `remember`, it is appended to a list capped at 20 facts in `localStorage` under `valerie_memory`. Conversation history: last 60 messages, `localStorage` only. | Writes are automatic and unreviewed. Neither memory nor history syncs across devices, so web and iOS have different memories. No provenance, no edit/forget UI, no expiry. |
| Routing | `router.js` chooses Claude, falls back to Ollama, then to a canned reply. | Model id is hard-coded and stale. No task-based routing, no cost guard beyond `rateLimitClaude`. |
| Streaming / stop / retry | None. Single blocking request. | Fails the "Ask Valerie" requirements. |
| Voice | Same pipeline via `speech.js`; ElevenLabs key read from the bundle. | Key exposure (§0.1). |

### 2.1 Verified functional defects

| # | Defect | Evidence | Level |
|---|---|---|---|
| D1 | **Task schema drift.** UI reads and writes `{text, done}` (Tasks, Dashboard, MobileDashboard). The assistant writes `{title, completed}` and its context filters on `!t.completed`, printing `t.title`. Assistant-created tasks have no `text`, so they render blank; UI-created tasks are counted as pending by the assistant even when done, and named "undefined". | `actions.js` L100–111, `context.js` L28–35, `Tasks.jsx` L46/144 | `READ` |
| D2 | **UTC "today".** 79 uses of `toISOString().split('T')[0]` / `.slice(0,10)` across 36 files define "today". For a user in Australia (locale `en-AU` is used throughout) that date is wrong for roughly 10–11 hours each day, so daily logs, reminders and the daily brief can land on the wrong day. | grep | `READ` |
| D3 | Reminder engine runs only while the app is open: a 60-second `setInterval`, per-day flags in `localStorage`, active 06:00–22:00 local. Nothing fires when the tab or iOS PWA is closed. Dedupe is per device, so two devices can both fire. | `useNotifications.js` | `READ` |
| D4 | Stale copy says "Data syncs automatically via Firebase" on five mobile placeholder screens. | `MobileMore.jsx` L206 | `READ` |
| D5 | Sentry release `valerie@0.1.0` mislabels every error report. | `main.jsx` | `READ` |
| D6 | **Silent task loss.** Both dashboards (desktop and iOS home) wrote tasks straight to `localStorage`. Those writes never reached Supabase, and the next `useCollection` fetch overwrote the local mirror, so a tick or add from either home screen was lost and never reached the other device. | `Dashboard.jsx`, `MobileDashboard.jsx` | `READ` |

### 2.2 Fixed in this pass

| # | Fix | Verification |
|---|---|---|
| D1 | `src/domain/tasks.js` normalises `{title, completed}` → `{text, done}` on every read; the assistant now writes the canonical shape. No stored rows rewritten. | 8 unit tests · `SEEN`: legacy task shows its title on desktop and iOS home; legacy done task counted as done |
| D2 | `src/utils/localDate.js`; 78 sites rewritten by a receiver-aware codemod; 2 deliberate pure-UTC helpers left alone; timestamp-vs-day comparisons (XP log, focus sessions) and UTC month keys fixed. | 11 unit tests pinned to `Australia/Sydney`, incl. DST start 2026-10-04 · `SEEN`: date header correct |
| D6 | `src/hooks/useTasks.js`: synced reads/writes, optimistic tick that reverts on failure, Add keeps text on failure. | `SEEN` with Supabase unreachable: tick reverted with "Couldn't update" toast; Add kept "Buy milk" and logged "Not signed in" — no silent success |

Not yet verified: a successful write against the real Supabase project (needs the owner's login).

**Behaviour change to know about:** day-keyed records written before this fix between local midnight and ~10–11am carry the previous UTC date. They stay where they are; only new records use the local day. On the day of upgrade a morning log may appear under yesterday.

---

## 3. Baseline — measured

| Check | Result | Level |
|---|---|---|
| `npm install` | 514 packages, ~25 s. 11 audit vulnerabilities. | `RAN` |
| `npm run build:pwa` | Succeeds, 501 modules, ~2.5–3.2 s, zero errors, PWA service worker generated. | `RAN` |
| Dev server (`vite`) | Starts in ~1.5 s and serves the PIN gate. Reached the dashboard only with a temporary local auth bypass (since reverted). | `SEEN` |
| Type check | Not applicable: JavaScript only. | confirmed |
| Lint | No linter configured. | confirmed |
| Tests | None at baseline. **Now:** `npm test` (vitest, TZ=Australia/Sydney), 19 passing. | `RAN` |
| Tauri build | Not run. `cargo` and `rustc` are not installed on this machine. | `RAN` (absence) |
| Console at runtime | Only network errors to Supabase, caused by the browser pane's sandbox DNS. No React errors. | `SEEN` |
| Real-data journeys | **Not exercised.** Needs the owner's Supabase login, which I will not enter. | — |

### 3.1 Bundle baseline (gzip in brackets)

| Chunk | Size |
|---|---|
| `index` (app shell + all 20 tabs' shared code) | 378 kB (92 kB) |
| `shared` (utils/hooks/ai/supabase) | 377 kB (113 kB) |
| `vendor-react` | 193 kB (60 kB) |
| `mobile` | 187 kB (44 kB) |
| `tab-settings` / `tab-health` / `tab-finance` / `tab-workout` | 105 / 98 / 53 / 51 kB |
| CSS | 19 kB (5 kB) |
| Service-worker precache | 22 entries, 2,928 KiB |

Every user downloads both desktop and mobile code, because there is no lazy loading.

### 3.2 Largest surfaces (lines)

Settings 3,007 · Health 2,720 · Finance 1,485 · LM 1,464 · Style 1,319 · Mind 1,191 · Workout 1,153 · Calendar 984 · Portfolio 684 · Vault 701 · Progress 857. `Dashboard.jsx` was 1,134 lines, ~150 of them dead.

---

## 4. Web / iOS capability parity matrix

`Desktop` = Tauri/web tabs. `iOS` = mobile PWA shell. Levels are `READ`.

| Capability | Desktop | iOS (mobile shell) | Gap |
|---|---|---|---|
| Auth | Supabase email/password via `SignIn`, then hard-coded PIN | same | Shared. `AuthGate.jsx` is an unused duplicate. |
| Onboarding | `Onboarding` (7 steps) | same component | Shared. |
| Today | `Dashboard` + `TodayView` overlay + `WeeklyReview` + `NudgeStack` | `MobileDashboard` (605 lines) | Different layouts and logic. |
| Ask Valerie | Full `Assistant` tab + orb | `MobileAI`, embedded compact (173 lines) | Weaker on iOS. |
| Tasks | Full tab | `TasksScreen` inside More | Present, thinner. |
| Calendar | Full tab | **Placeholder** ("available on your desktop") | Missing. |
| Notes | Full tab | **Placeholder** | Missing. |
| Focus | Full tab | **Placeholder** | Missing. |
| Lists | Full tab | **Placeholder** | Missing. |
| Routines | Full tab | **Placeholder** | Missing. |
| Health / Workout / Finance / Portfolio / Mind | Full | Real screens | Comparable, separately implemented. |
| Looksmaxxing | Full | Real screen | Separately implemented (984 vs 1,464 lines). |
| Style / Places / Essentials / Progress / Vault | Full tabs | Not in mobile nav or More | Missing. |
| Memory | `localStorage`, this device only | `localStorage`, this device only | **Diverges**: never synced. |
| Conversations | last 60 messages, this device only | same | **Diverges**. |
| Settings (incl. secrets) | Synced via `user_meta` | pulled on first launch | Shared, but see S2. |
| Reminders | client timer, app open | client timer, PWA foregrounded | Both unreliable; both can fire (no dedupe). |
| Push | Web Push via VAPID, subscription saved to Supabase | same | Registration exists; no sender exists. `UNVERIFIED` end-to-end. |
| Search / palette | Ctrl+K palette | none | Missing. |
| Data export / delete | `utils/backup.js`; no delete-account flow found | same | Export partial, deletion missing. |
| Offline | Service worker precache; no write queue | same | Pending writes are not queued. |

---

## 5. UI / UX problems and sources of clutter

| Problem | Evidence |
|---|---|
| Twenty top-level destinations in a 56 px icon rail, 7 category labels at 6.5 px type, plus a "focus mode" filter to compensate. | `Sidebar.jsx` |
| Dashboard forced ten bordered cards into one no-scroll viewport. (Already redesigned once in the copy; see §9.) | `Dashboard.jsx` before/after |
| Three overlapping "today" surfaces: `Dashboard`, `TodayView`, and an unused `DailyBrief` component. | `App.jsx`, import check |
| Domain sprawl: 30 `lm_*`/`mind_*` collections for looksmaxxing and mind, each with its own tab. | `sync_all_tables.sql` |
| Accessibility is close to absent: 4 `aria-*` attributes in 35k lines, 0 `:focus-visible` rules, 29 clickable `<div>`s, 2 `prefers-reduced-motion` rules. | grep of `src` |
| Styling is 3,887 inline style objects, so there is no shared token or component layer despite CSS variables existing. | grep |
| Error surfaces are inconsistent: some tabs have boundaries (`TabErrorBoundary`), many failures only `console.error`. | `App.jsx` |

---

## 6. The three ambiguous surfaces — where they appear today

You dictated: "hide style, hide lists, actually don't hide lists, hide places." That is unresolved, so nothing has been hidden or removed. Here is everything each one touches.

### Style
- **Desktop tab** `Style.jsx` (1,319 lines): "Discover" (occasion search, AI outfit visualisation, optional Google Custom Search) and "My Board" (wishlist / purchased / pass), stored in `style_board`.
- **Overlaps with** the Looksmaxxing tab, which has its own `STYLE` section (`StyleMaxxing`, using `lm_wardrobe` and `lm_outfits`), on both desktop (`LM.jsx`) and mobile (`MobileLM.jsx`).
- Also: sidebar entry, Ctrl+K "Go to Style", a Settings tab-visibility toggle, and the assistant's `navigate` target list. Not present on mobile outside Looksmaxxing.

### Lists
- **Desktop tab** `Lists.jsx` (411 lines). Despite the name it is a **media backlog** only: Books, Shows, Films, Podcasts, Articles, with statuses Up Next / In Progress / Done. Not a general to-do or shopping list.
- Also: sidebar entry, palette entry, mobile More brick (currently a placeholder), Settings toggle, storage key `lists`.

### Places
- **Desktop tab** `Places.jsx` (280 lines): saved outing spots ("alone time") with a type (park, cafe, hike, beach…), mood, free-text address and a visited flag. Collection `places`. **No map, no geolocation, no distance.**
- Also: sidebar entry, Settings toggle. Not on mobile.
- The only real location feature in the app is the weather widget (browser geolocation, permission-gated) on both dashboards; `DailyBrief.jsx` also uses it but is unused.

**Proposed default (pending your answer):** keep all three data stores intact, remove none of the data, and take them out of primary navigation. Details and options are in the spec §3.4.

---

## 7. Decision inventory — every major surface

Legend: **K** keep · **M** merge · **Mv** move · **R** redesign · **H** hide by default · **X** remove (code only; data is never deleted).

| Surface | Decision | Reason |
|---|---|---|
| Dashboard + TodayView | **M → R** as **Today** | One "what matters now" page. TodayView's read-only gather logic is reusable. |
| `DailyBrief.jsx` (unused) | **X** after proof | Dead code, duplicates the brief already in Today. |
| Assistant | **R** as **Ask Valerie** | Needs streaming, history, provenance, confirmation. |
| Tasks, Calendar, Routines, Focus | **M** into **Plan** | One planning surface; Focus becomes an action inside a task. |
| Progress (XP/rank/streaks/goals) | **M** goals into Plan; **H** XP/rank | Gamification is decorative next to real goals. Keep data. |
| Notes, Mind, WeeklyReview | **M** into **Reflect** | Notes, decisions, beliefs and reviews are one activity. |
| Health, Workout, Finance, Portfolio, Essentials | **Mv** into **Life** (domain hub) | Real, deep modules. Do not rebuild; give them one home and a consistent shell. |
| Looksmaxxing (LM) | **Mv** into Life; **H** by default | Large and personal; owner to say whether it stays visible. |
| Style | **Ask** (§6) | Overlaps LM Style. |
| Lists | **Ask** (§6) | Media backlog; suggest fold into Reflect or Life. |
| Places | **Ask** (§6) | Notes-with-an-address; suggest fold into Life or hide. |
| Vault | **Mv** into Me | Private storage belongs with privacy controls. |
| Settings | **R** as **Me** | 3,007 lines; split into Profile, Memory, Notifications, Integrations, Privacy, Appearance. |
| QuickCapture, CommandPalette | **K + R** | Promote to global, mobile included. |
| NudgeStack | **K + R** | Add dismiss/snooze/explain. |
| PinGate + LockScreen | **R** | Real device lock (biometric on iOS) instead of a literal PIN. |
| `AuthGate.jsx`, `src/firebase/*`, `firebase` package | **X** after proof | Dead. |
| Mobile placeholders (5 screens) | **R** | Either build real screens or remove the false promise. |

---

## 8. Technical debt

- Two backends' worth of code with one live (§1); dead Firebase config and copy.
- Two task schemas (D1); two date conventions (D2); likely more drift, since collections are untyped `jsonb`.
- No tests, no lint, no types, no CI. Any refactor is currently unprotected.
- 20 tabs imported eagerly; mobile and desktop code shipped together.
- `App.jsx` (498 lines) mixes shell, settings sync, auth, theme, sleep and notification wiring.
- Database schema incomplete in the repo (S5).
- `.gitignore` excludes `.env`; keep it that way. `src-tauri` builds are unverified.

---

## 9. What has already been changed in the copy (see git log in VALERIE-MAKEOVER)

Commits after the owner-state checkpoint `3c77f12`: the Dashboard declutter pass, these docs, the D1/D2 fix (`51439d3`), and the D6 fix (`d25ad25`). Original Dashboard pass: `src/tabs/Dashboard.jsx` (declutter pass: one glance strip, one unified Today panel, merged reflection card, dead badge code removed). `npm run build:pwa` passes with it. A temporary local auth bypass used for screenshots was reverted and `App.jsx` is byte-identical to the original.

---

## 10. Unknowns and assumptions

| # | Item | Treatment |
|---|---|---|
| U1 | Whether the Netlify site is publicly reachable | Assume yes until shown otherwise; keys are treated as exposed. |
| U2 | Whether any native iOS app exists outside this repo | Assumed not (§1.1). Needs confirmation. |
| U3 | Real-data behaviour of Health, Finance, Calendar sync, push | Not exercised (no login). Treated as `UNVERIFIED`. |
| U4 | Tauri build health | Cannot be tested here (no Rust toolchain). |
| U5 | Countries where SMS must work; sender registration status | Needed for Twilio compliance. Assumed Australia only. |
| U6 | Whether Twilio works from a browser at all | Will be moot once sending moves server-side. |
| U7 | Where Valerie is hosted beyond Netlify, and whether a Supabase Edge Functions budget is acceptable | Needed before any server work. |

---

## 11. Phased plan, dependencies, risk

| Phase | Work | Depends on | Risk |
|---|---|---|---|
| 0 | **Owner rotates exposed keys** | — | High if skipped |
| 1 | Checkpoint commit in the copy; add lint, a test runner and CI build | — | Low |
| 2 | Spec + IA (`valerie-product-spec.md`) | this audit | Low |
| 3 | Tokens, shell, six-destination navigation, focus/a11y foundation, motion tokens | 1, 2 | Medium: touches every screen |
| 4 | Today + global capture | 3 | Medium |
| 5 | Fix D1 and D2 with a shared date/task module and migration | 1 | Medium: touches user data |
| 6 | Server layer (Supabase Edge Functions): AI proxy, action validation, secrets | 0, owner decision on infra | High: new infra |
| 7 | Ask Valerie: streaming, history, typed tools, confirmation gate | 6 | Medium |
| 8 | Memory schema, retrieval, controls in Me | 6, 7 | Medium |
| 9 | Plan + Reflect loops | 4, 8 | Medium |
| 10 | Twilio: consent, scheduler, webhooks, delivery state | 6, owner credentials | High |
| 11 | Parity: build or retire the five mobile placeholders; sync memory/history | 3, 8 | Medium |
| 12 | Accessibility, performance (lazy tabs), failure states, visual QA | all | Low |

---

## 12. Reproducing this audit

```bash
# leaked-key check (prints only prefix/length, never the value)
grep -rhoE 'sk-ant-[A-Za-z0-9_-]{20,}' dist/assets | sort -u | awk '{print substr($0,1,12), length($0)}'
# UTC-date idiom
grep -rE "toISOString\(\)\.(split\('T'\)\[0\]|slice\(0, ?10\))" src | wc -l
# confirmation gate in AI layer
grep -rn -i confirm src/ai src/tabs/Assistant.jsx
```

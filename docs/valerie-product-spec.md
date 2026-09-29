# Valerie — Product Specification (Revamp) · v2

> Companion to `valerie-revamp-audit.md`. Status: **v2 draft, 2026-09-29.** Sections marked **[OWNER]** need a decision before they are built.
> v2 re-bases v1 on the owner's revamp brief (`D:\Work\Projects\Prompts\Valerie full revamp.txt`) and the decisions logged 2026-09-29. v1's navigation (Today/Ask/Plan/Life/Me), its assistant-first framing and its "editorial, no glow" visual system are **superseded**. §5–§11 (accessibility, data, AI server, memory, SMS, sync, privacy) carry over unchanged.
>
> Central idea: **a life-turnaround app with an AI that is ten steps ahead.** Gym, nutrition, body, looks and money are one system. The owner logs as little as possible; the app predicts, prepares and prompts. The product is renamed (see §0).
>
> Bar: each domain should stand beside the best single-purpose app: MyFitnessPal (food), Strong / Liftoff (lifting), Skinbliss (skin), plus sleep, water and weight coaches. Animation should feel like a pro app: fast, never laggy, never confusing.

---

## 0. Name — **Arete** (decided 2026-09-29)

*Arete* (Greek, ar-eh-TAY): excellence, living up to your full potential. The app is **Arete**; the AI and the Ahead engine may carry a second name later (candidate: *Pronoia*, “foresight”). In code, the rename is one constant plus the Tauri, PWA and manifest metadata. Storage keys and table names keep their `valerie_` prefix, because renaming them would orphan existing data.

---

## 1. Principles that resolve arguments

1. **One purpose per screen, one primary action per region.**
2. **Show less, do more.** A module appears only when it holds something meaningful.
3. **Facts and suggestions look different.** Anything generated or inferred is labelled as such and links to its source.
4. **Nothing consequential happens silently.** Writes proposed by the AI are previewed and confirmed.
5. **Data is never deleted by a redesign.** Surfaces can move or hide; collections stay.
6. **Local time is the only "today".** All day boundaries use the user's canonical timezone.
7. **Predict before asking.** If the app can compute it (run-out dates, targets, shopping lists), it does, and asks only to confirm.
8. **Fast beats fancy.** An animation that drops frames on the owner's iPhone is cut, however good it looks.

---

## 2. Platforms

Web (browser), desktop (Tauri) and iOS (installed PWA) are **one React codebase** with two layouts: a wide layout (≥ 768 px, or Tauri) and a compact layout (phones, iOS PWA). Both share one domain layer, one data layer, one AI client and one design system. The two layouts differ only in navigation chrome and density.

This replaces today's situation, where `src/mobile/screens/*` re-implements domains separately and five mobile screens are placeholders.

**[OWNER] Q-iOS:** Confirm there is no native (Swift/Xcode) iOS project anywhere. If one exists, give its path; the parity plan changes.

---

## 3. Information architecture

### 3.1 Primary navigation — six tabs (decided 2026-09-29)

Each tab has its own identity: accent colour, icon and one signature animation (§4.7). Tabs are split by *job*, not by data table.

| Tab | Job | Absorbs today's |
|---|---|---|
| **Home** | Glanceable HUD: what's due, what's running low, how today is scoring | Dashboard, TodayView, NudgeStack, Daily Brief, DayRing, Peak State |
| **Plan** | Decide and schedule | Tasks, Goals (from Progress), Routines, Places, Calendar, Focus, **Supplies** (Essentials + shopping) |
| **Coach** | One AI coach locked to one goal (§4.3) | Health, Workout, Nutrition, Meal plans, Water, Sleep, Supplements, Body, LM (looksmaxxing), Style board |
| **Mind** | Reflection and decisions — **[OWNER] Q-MIND:** keep as a tab, or fold into Plan → Review | Mind, Notes, Weekly Review, Lists (media) |
| **Finance** | Money in, out, and ahead | Finance, Portfolio, Subscriptions, Gmail import, projected spend from Supplies |
| **Settings** | Profile, integrations, privacy, advanced | Settings, Vault (hardened), Twilio SMS, webhooks, REST API (under **Advanced**) |

Wide layout (≥ 768 px or Tauri): labelled rail that collapses to icons. Compact layout (iOS PWA): bottom bar with five slots: Home · Plan · **Coach** (centre, elevated) · Finance · Mind. Settings opens from the avatar in the Home header. If Q-MIND folds Mind into Plan, the fifth slot becomes Settings.

The AI is not a tab. It lives where the work is: the Coach chat inside Coach, capture and command everywhere (§3.2), and briefs on Home.

### 3.2 Global, always available

- **Capture** (`C` on wide, long-press Coach on compact): one field that classifies input as task, event, food log, lift, weigh-in, note or question, and shows the classification for one-tap correction. "2 eggs and toast" logs food; "bench 80x8x3" logs a set.
- **Command & search** (`Ctrl/⌘ K`): navigation, actions and full-text search.

### 3.3 Hidden by default (data kept, one tap to restore)

XP / rank display, Places (lives in Plan but collapsed until used), Portfolio (inside Finance, collapsed). Nothing is deleted by the move.

---

## 4. Screens and interaction model

### 4.1 Home — the HUD

Top to bottom; a module with nothing to say does not render.

1. **Header**: greeting, local date, one status line ("3 things need you · protein 40 g short · creatine runs out Thu").
2. **Goal ring**: today's score against the Coach goal (training done, calories and protein, water, sleep, routine).
3. **Next up**: timeline of today's events, workouts and time-blocked tasks.
4. **Needs you**: overdue, due today, restocks inside their lead time. Max five.
5. **Coach nudge**: one sentence from the Coach, with *Why?*, *Snooze*, *Dismiss*.

### 4.2 Plan

Default **This week**: capacity per day, tasks under the day they're planned for, inbox at the side. Other views: Goals, Calendar, Routines, Places, **Supplies**. The v1 "Plan this with me" workflow (restate → ≤ 2 questions → draft → edit → diff → apply) carries over unchanged.

### 4.3 Coach — one goal, one coach

**Goal HQ** sets exactly one active goal. Picking a template writes a target set; custom goals get a target set drafted by the AI, which the owner confirms.

| Template | Target set it writes |
|---|---|
| Cut | kcal deficit from adaptive TDEE, protein ≥ 2 g/kg, weekly loss rate 0.5–1 % BW, strength-preserving split |
| Bulk | kcal surplus, protein ≥ 1.8 g/kg, gain rate 0.25–0.5 % BW/week, volume-focused split |
| Recomp | kcal ≈ maintenance, high protein, progressive-overload priority |
| Glow-up | Look section weighted highest: skin routine, grooming, posture, sleep, leanness targets |
| Custom | AI-drafted, owner-confirmed |

Sections: **Goal HQ · Train · Fuel · Recover · Look · Body · Habits**.

| Section | Benchmark | Built from |
|---|---|---|
| Train | Strong / Liftoff: fast set logging, previous-set ghosting, rest timer, PR detection, auto-progression | `Workout.jsx` overload coach, split planner, muscle ranking |
| Fuel | MyFitnessPal: barcode and search logging, recent/frequent foods, macros and micros, meal plans that feed Supplies | Health nutrition, meal planner, `openFoodFacts.js`, `micronutrients.js`, water |
| Recover | sleep and readiness | Sleep, Peak State, `useAppleHealth.js` |
| Look | Skinbliss: AM/PM skin routine with product steps, ingredient conflicts, progress photos | `LM.jsx` (15 sections consolidated), Style board |
| Body | weight coach: trend weight (smoothed), measurements, photos | body metrics, LM photos |
| Habits | daily streaks tied to the goal | habits, streaks |

**Adaptive targets**: each week the Coach compares trend weight with intake and recomputes TDEE, then proposes new targets as an action card (never silently).

**Coach personality — [OWNER] Q-COACH:** a swappable system-prompt layer (calm expert / drill sergeant / hype). Voice on or off per platform. The default until decided is calm expert, text only.

### 4.4 The Ahead engine (new, the signature feature)

The app predicts what runs out and prepares the restock before the owner notices.

**Item model** (extends `essentials`): `name, category, pack_qty, unit, dose_per_use, uses_per_day | schedule_ref, on_hand_packs, opened_local_date, price, store_url | asin, lead_time_days (default 3), buffer_days (default 2)`.

**Consumption sources**, strongest first:
1. **Schedules**: a skin-routine step (AM/PM), a supplement stack or a meal plan names the item and dose, so usage is exact.
2. **Logged use**: food logs subtract pantry items.
3. **Learned rate**: when a restock is logged, the observed interval updates the usage rate by EWMA (α = 0.3). Confidence rises with each cycle and is shown.

**Maths**: `run_out = opened + (pack_qty × on_hand_packs) / (dose_per_use × uses_per_day)`; `reorder_by = run_out − lead_time − buffer`.

**Outputs**:
- Home → Needs you: items at or past `reorder_by`.
- Plan → Supplies → **This week's cart**: due items plus the meal plan's shopping list minus pantry stock, grouped by store.
- **Open cart**: one tap builds a store cart link (Amazon add-to-cart URL with ASIN and quantity where known, search link otherwise). **The app never checks out**: the owner reviews and pays in the store. The Amazon AU add-to-cart URL format needs verification before build.
- Finance: projected spend for the next 30 days.

### 4.5 Mind and Finance

Mind keeps its v1.2 sections (Constitution, Advisors, Ledger, Beliefs, Memory Vault, Insights) plus Notes and Weekly Review. Weekly Review now includes the Coach week (adherence, trend weight, PRs). Finance keeps its current sections and gains *Ahead*: upcoming subscriptions and projected restock spend.

### 4.6 Motion language

The v1 tokens stay (`--dur-instant` 90 ms through `--dur-emphasis` 360 ms, the ease curves, 4/12 px distances, reduced-motion fallback). Additions:

- **Performance budget**: 60 fps on the owner's iPhone. Animate `transform` and `opacity` only. `backdrop-filter` is limited to the nav bar and sheets (it is expensive on iOS WebKit). No animation blocks input.
- **Signature animations**: one per tab, ≤ 600 ms, on tab entry or completion only, never looping on screen except the Home goal ring's idle pulse.
- **Shared-element transitions**: card → detail uses the View Transitions API where supported, and a 240 ms fade otherwise.

### 4.7 Visual system

A hybrid: Apple-level polish (type, spacing, restraint) with a Jarvis/HUD edge (fine rules, mono numerals, light glow on live data only). Dark-first, with a light pair. Each tab has one accent; everything else is neutral. Tokens live in `src/styles/tokens.css`; components never use raw hex, and Tailwind classes are literal (lookup maps, no interpolation).

**Fonts and per-tab palette — Claude proposes, owner approves** (decided 2026-09-29). A visual board goes to the owner before any of it is built.

---

## 5. Accessibility targets (WCAG 2.2 AA where practical)

Every interactive element is a `button`, `a` or form control, with visible `:focus-visible` styles. Minimum contrast 4.5:1 for text. Touch targets ≥ 44 × 44 px on compact layouts. Landmarks for nav, main and complementary regions. Live region for streaming answers and toasts. Full keyboard path for capture, search, Ask and task completion.

---

## 6. Data ownership and model

### 6.1 Rules

1. **Supabase is the source of truth** for every synced record. `localStorage` is a cache plus an offline write queue, never an independent store.
2. Every record carries `id`, `user_id`, `created_at`, `updated_at`, `updated_by_device`, `schema_version`.
3. **Conflict rule**: last-writer-wins per field using `updated_at`. Deletes are soft (`deleted_at`) and win over edits older than the delete.
4. Canonical local date: records that belong to a day store `local_date` (`YYYY-MM-DD` in the user's timezone) and `tz`.
5. Canonical task shape: `{ text, done, priority, due_local_date?, planned_local_date?, project_id?, source }`. A read adapter accepts legacy `{title, completed}` until migration completes.
6. Secrets never live in application tables. They live in server environment variables or Supabase Vault.

### 6.2 New tables (additive; nothing existing is altered in a way that loses data)

`profiles` · `memories` · `memory_events` (audit of memory changes) · `conversations` · `messages` · `plans` · `plan_items` · `reminders` · `reminder_deliveries` · `sms_consent` · `assistant_actions` (audit log) · `app_versions`.

All follow the existing RLS owner policy pattern.

---

## 7. AI system

### 7.1 Where it runs

All model calls move to a **server function** (Supabase Edge Function `ai-chat`). The browser sends the user message plus a conversation id; the server assembles context, calls Anthropic with streaming, validates tool calls and streams back. The API key exists only on the server. This is also what makes web and iOS behave identically, because prompts and tool schemas live in one place.

**[OWNER] Q-INFRA:** Approve adding Supabase Edge Functions (free tier covers this scale) as the server layer. Without it, the key-exposure fix, SMS and reliable reminders cannot be done properly.

### 7.2 Layers

| Layer | Content |
|---|---|
| Core behaviour | ~40 lines: role, voice, honesty rules, action policy. No user name, no user facts. |
| Profile | Confirmed facts from `profiles` (name, pronouns if given, timezone, style prefs). |
| Request context | Only what the request needs: today's agenda for planning, the referenced note for a note question. |
| Retrieved memories | Top-k (≤ 8) by filters, recency, importance and text similarity. |
| Tools | Typed JSON-schema tools: `create_task`, `update_task`, `create_event`, `create_reminder`, `create_note`, `propose_memory`, `propose_plan`, `search_records`, `get_agenda`, `navigate`. |
| Post-processing | Schema validation; memory-candidate extraction under policy; audit log entry. |

Retrieved content is wrapped as data with an explicit instruction that it contains no commands.

### 7.3 Action policy

| Class | Examples | Behaviour |
|---|---|---|
| Read | `search_records`, `get_agenda`, `navigate` | Runs immediately |
| Write, own data | `create_task`, `create_note`, `update_task` | Action card, confirm (owner may later allow auto-apply per tool) |
| External or irreversible | `create_reminder` with SMS, send message, delete | Always confirm, shows exact message and send time |
| Memory | `propose_memory` | Follows memory policy (§8.3) |

Every applied action is written to `assistant_actions` with an undo handle where possible.

### 7.4 Models and safeguards

Route by task: a fast model for classification, capture parsing and titles; a stronger model for planning and reflection. Model ids are configuration, not literals. 30 s timeout, user-cancellable streams, per-day token budget with a visible warning at 80%. Ollama stays as an offline fallback on desktop only.

### 7.5 Voice

Warm, direct, concise. Challenges respectfully with evidence. Says "I don't have that" instead of guessing. Never claims to remember something absent from context. The hard-coded name is removed; the name comes from the profile.

---

## 8. Memory model

### 8.1 Record

```
memories(
  id, user_id, type,            -- identity | goal | preference | episode | pattern
  statement,                    -- plain-language sentence shown to the user
  status,                       -- suggested | active | corrected | superseded | forgotten
  origin,                       -- explicit | inferred
  confidence,                   -- 0..1, inferred only
  sensitivity,                  -- normal | sensitive
  source_type, source_id,       -- conversation/message/note/review
  supersedes_id,
  created_at, updated_at, last_used_at, review_at, expires_at
)
```

### 8.2 Behaviour

- Retrieval returns only `active` memories, and marks each use (`last_used_at`), which drives the "why was this used" disclosure.
- A correction creates a new `active` memory with `supersedes_id`; the old one becomes `superseded` and is never retrieved again.
- Duplicate guard: a candidate that matches an active memory (normalised text similarity) updates `last_used_at` instead of inserting.
- Contradiction guard: a candidate conflicting with an active memory is shown as "Update this?" rather than saved.
- Sensitive categories (health conditions, relationships, finances, beliefs) are never inferred. They are saved only when stated explicitly and confirmed.

### 8.3 Policy (user-selectable in Settings)

`Ask me every time` (default) · `Save as suggestions for me to review` · `Learning off`. Private conversations bypass memory entirely.

### 8.4 Migration of existing memory

The 20-fact `valerie_memory` list in each device's `localStorage` is imported as `suggested` memories with `origin=inferred`, so the owner reviews them once instead of having them silently become truth.

---

## 9. SMS reminders (Twilio)

| Element | Design |
|---|---|
| Secrets | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (or API key pair), `TWILIO_MESSAGING_SERVICE_SID` in Edge Function environment only. The Settings fields that store them in `user_meta` are removed, and existing stored values are scrubbed after migration. |
| Consent | Phone entered in E.164, verified by a 6-digit code sent via Twilio Verify or a one-off SMS. `sms_consent` stores number, verified_at, opted_in_at, opted_out_at, source. |
| STOP / START | Inbound webhook handles STOP, START, HELP; updates consent; Twilio's own opt-out handling is also left enabled. |
| Lifecycle | `reminders` holds intent (`draft → scheduled → cancelled / superseded / done`). `reminder_deliveries` holds each attempt (`queued → sent → delivered / failed / undelivered`) with provider SID. |
| Scheduling | Stored as `fire_at_local` + `tz`, resolved to UTC at schedule time and re-resolved when the timezone changes, so daylight-saving shifts are correct. A `pg_cron` job every minute calls a `dispatch-reminders` function that claims due rows with `FOR UPDATE SKIP LOCKED` and a unique `(reminder_id, occurrence)` key for idempotency. |
| Guards | Quiet hours (default 22:00–07:00 local), max N SMS per day (default 5), minimum spacing, per-reminder channel (in-app / push / SMS). |
| Retry | Transient failures retry at 1, 5 and 15 minutes, then mark `failed` and fall back to in-app notification. |
| Webhooks | `twilio-status` and `twilio-inbound` functions verify `X-Twilio-Signature` (HMAC-SHA1 over URL + params). Duplicate status callbacks are no-ops. |
| Cross-device | Reminders are server-side, so they fire once regardless of how many devices are open. Handling a reminder on any device marks it `done` and cancels pending deliveries. |
| Tests | Signature verification, idempotent dispatch, DST boundary, quiet-hour deferral, STOP handling, all with mocked Twilio. No real SMS in the test suite. |

**[OWNER] Q-SMS:** countries where SMS must work, and whether an Australian sender (alphanumeric sender ID or registered number) is already set up. You will do the credential entry in the Supabase dashboard yourself; I will give an exact checklist. Never paste secrets into chat.

---

## 10. Sync, offline, versions

- Writes go to a local queue first (optimistic UI) and flush to Supabase; failures stay queued with a visible "pending" marker.
- On reconnect, queued writes replay in order; server `updated_at` resolves conflicts per §6.1.
- Realtime subscriptions refresh caches. Stale data older than 24 hours shows a subtle "last synced" note.
- `app_versions` holds `min_supported_client`; clients below it show an update prompt. Migrations are additive first, then backfill, then read-switch, then cleanup in a later release.
- Sign-out clears local caches and the write queue after flushing or explicit discard.

---

## 11. Privacy and trust

Export produces a zip of JSON per collection plus memories and conversations. Deletion removes all rows for the user across every table and the auth user, after a typed confirmation. The activity log lists assistant actions, memory changes and reminder sends. Data sent to Anthropic is limited to the assembled prompt; this is documented in Settings → Privacy.

---

## 12. Acceptance criteria (maps to the ten core journeys)

| # | Journey | Done when |
|---|---|---|
| J1 | First run | Sign-in → 3-question optional intro → Home with a setup list, in under 60 seconds, every step skippable. |
| J2 | Capture | Typing "dentist thurs 2:30" produces a proposed event for the correct local Thursday; one tap confirms. |
| J3 | Personal question | Answer lists the records and memories used; asking about something absent yields an explicit "I don't have that". |
| J4 | Memory proposal | Candidate appears as a card; confirm, edit, reject and "change policy" all work and persist. |
| J5 | Correction | Editing a memory creates a superseding record; the old one never appears in retrieval again (unit-tested). |
| J6 | Plan my day | Plan view shows capacity from real events; accepting a suggested next step schedules it. |
| J7 | Weekly review | Shows ≤ 3 patterns, each with evidence counts and confirm/dismiss. |
| J8 | Export/delete | Export contains every collection; delete leaves zero rows (integration-tested). |
| J9 | Plan parity | A plan applied on wide layout appears identically on compact layout after sync. |
| J10 | SMS | Reminder scheduled for 15:00 local sends once at 15:00 local (mocked clock across a DST boundary); edit, cancel and disable work from either layout. |
| J11 | Goal | Picking "Cut" writes a target set; a week of logs later the Coach proposes adjusted targets as an action card, never silently. |
| J12 | Log a lift | A set logs in ≤ 2 taps from Train with the previous set pre-filled; a PR is detected and celebrated. |
| J13 | Log food | A barcode or recent food logs in ≤ 3 taps; macros and micros update on Home within one frame. |
| J14 | Ahead | A skincare item with pack size and AM/PM dose shows the correct run-out date (unit-tested); a logged restock updates the learned rate. |
| J15 | Cart | This week's cart merges due restocks with the meal-plan list minus pantry; Open cart opens the store with those items, and nothing is ever purchased by the app. |

Cross-cutting: build passes; tests pass; 60 fps on tab switch and list scroll on the owner's iPhone; no `VITE_*` secret in `dist`; keyboard-only path works; reduced-motion path verified; screenshots at 390, 768, 1280 and 1600 px wide.

---

## 13. Open questions for the owner

| Id | Question | Blocks |
|---|---|---|
| Q-KEYS | Rotate the Anthropic and ElevenLabs keys (audit §0.1). Confirm when done. | Any new deployment |
| Q-MIND | Mind as its own tab, or folded into Plan → Review? | Compact nav bar |
| Q-COACH | Coach personality; voice on/off. | Coach prompt layer (default: calm expert, text) |
| Q-USE | Features used daily vs never. | Removal list |
| Q-VIS | Approve the visual board (fonts, per-tab accents, signature animations). | All screen restyling |
| Q-INFRA | Approve Supabase Edge Functions as the server layer. | AI proxy, SMS, reliable reminders |
| Q-iOS | Is there any native iOS project? | Parity plan |
| Q-SMS | SMS countries and sender status. | Twilio production setup |

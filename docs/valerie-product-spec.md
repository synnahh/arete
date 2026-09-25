# Valerie — Product Specification (Revamp)

> Companion to `valerie-revamp-audit.md`. Status: **proposal**. Sections marked **[OWNER]** need a decision before they are built.
> Central idea: **what matters now.** Valerie turns scattered records into a clear daily picture and a few useful next actions.

---

## 1. Principles that resolve arguments

1. **One purpose per screen, one primary action per region.**
2. **Show less, do more.** A module appears only when it holds something meaningful.
3. **Facts and suggestions look different.** Anything generated or inferred is labelled as such and links to its source.
4. **Nothing consequential happens silently.** Writes proposed by the AI are previewed and confirmed.
5. **Data is never deleted by a redesign.** Surfaces can move or hide; collections stay.
6. **Local time is the only "today".** All day boundaries use the user's canonical timezone.

---

## 2. Platforms

Web (browser), desktop (Tauri) and iOS (installed PWA) are **one React codebase** with two layouts: a wide layout (≥ 768 px, or Tauri) and a compact layout (phones, iOS PWA). Both share one domain layer, one data layer, one AI client and one design system. The two layouts differ only in navigation chrome and density.

This replaces today's situation, where `src/mobile/screens/*` re-implements domains separately and five mobile screens are placeholders.

**[OWNER] Q-iOS:** Confirm there is no native (Swift/Xcode) iOS project anywhere. If one exists, give its path; the parity plan changes.

---

## 3. Information architecture

### 3.1 Primary navigation — five destinations

| # | Destination | Purpose | Absorbs today's |
|---|---|---|---|
| 1 | **Today** | What matters now, and the next action | Dashboard, TodayView, NudgeStack, Daily Brief |
| 2 | **Ask** | Conversation workspace | Assistant, orb, MobileAI |
| 3 | **Plan** | Decide and schedule | Tasks, Calendar, Routines, Focus, Goals from Progress |
| 4 | **Life** | Domain trackers, one hub | Health, Workout, Finance, Portfolio, Essentials, (LM, Style, Places, Lists per §3.4) |
| 5 | **Me** | Profile, memory, settings, privacy | Settings, Vault, memory controls, integrations |

**Reflect** (Notes, Mind, Weekly Review) is the one judgement call. With five destinations already, Reflect lives as the second section of **Plan → Review** on compact screens and as a sixth rail item on wide screens. If it earns daily use it gets promoted.

Wide layout: a labelled rail (icon + word) that collapses to icons. Compact layout: a bottom bar with Today · Plan · Ask (centre, elevated) · Life · Me.

### 3.2 Global, always available

- **Capture** (`C` / long-press on the Ask button): one field that classifies input as task, event, note, reminder or question, then shows the classification for one-tap correction.
- **Command & search** (`Ctrl/⌘ K` on wide, pull-down on Today on compact): navigation, actions and full-text search over tasks, notes, events and memories.

### 3.3 Life hub

A single index page listing domain modules as rows with a one-line live status ("Water 1.2 / 2.5 L", "Spent $214 this week"). Each module opens in the same shell with consistent header, back behaviour and empty states. Modules can be pinned or hidden by the owner. Existing tab components are reused inside the shell first and restyled later, so no domain logic is rewritten up front.

### 3.4 Style, Lists and Places — [OWNER] Q-SLP

Current facts are in the audit §6. Proposed default, which is fully reversible and deletes no data:

| Surface | Default proposal | Alternatives |
|---|---|---|
| **Style** | Merge the Style board into Looksmaxxing's Style section; hide the standalone tab. | Keep as a Life module · Retire (data kept, exportable) |
| **Lists** (media backlog) | Keep, rename **Watch & Read**, place under Reflect. | Keep as a Life module · Hide |
| **Places** | Hide by default; reachable from Life → "Hidden modules". | Keep as a Life module · Retire (data kept, exportable) |

Nothing in this row is built until the owner answers.

### 3.5 Hidden by default (data kept, one tap to restore)

XP / rank display, Looksmaxxing (pending owner), Portfolio (pending owner), Places (pending owner).

---

## 4. Screens and interaction model

### 4.1 Today

Answers, top to bottom:

1. **Header**: greeting with the user's name from profile, local date, one-line status (e.g. "3 things need you · 2 events").
2. **Brief**: two or three sentences generated from real context. Each fact is a link to its record. Suggestions are visually distinct (italic label "Suggestion") with *Why?*, *Snooze*, *Dismiss*.
3. **Now & next**: a timeline of today's events and time-blocked tasks.
4. **Needs you**: overdue, due today, at-risk commitments, restocks. Maximum five; "Show all" goes to Plan.
5. **Routines**: only if one is scheduled today.
6. **Ask bar**: one entry point to Ask, pre-seeded with context-aware suggestions.

Modules with nothing to say do not render. First-run Today shows a three-item setup list instead of empty cards.

### 4.2 Ask

- Streaming responses with a visible state: *thinking*, *using your calendar*, *drafting*. No fake progress bars.
- Stop, retry, edit-and-resend, copy.
- Conversation list with auto titles and search; synced across devices.
- **Context used** disclosure under each answer: which records and memories were read.
- **Action cards** for proposed writes (task, event, reminder, note, memory, setting). Each card shows a preview with *Confirm*, *Edit*, *Discard*. Read-only actions (navigate, open) run immediately.
- Private mode per conversation: no memory reads or writes, history not saved.

### 4.3 Plan

Default view is **This week**: capacity bar per day (committed hours vs available hours, labelled "estimate"), tasks grouped under the day they are planned for, unplanned inbox on the side. Other views: **Projects/Goals**, **Calendar**, **Routines**. Focus mode starts from any task.

**Planning workflow** ("Plan this with me") from any task, goal, event or free text:
1. Valerie restates the outcome and constraints it found, and marks each as *confirmed* or *assumed*.
2. It asks at most two clarifying questions, and only if the answer changes the plan.
3. It returns a draft: phases if warranted, 3–7 next actions with honest time estimates, dependencies, risks, deadlines, and proposed placement around real calendar events.
4. The user edits conversationally or inline. Accepted edits persist in the draft.
5. **Apply** shows a diff ("creates 5 tasks, 2 events, 1 reminder") and requires confirmation.
6. The plan keeps a link to its created records; postponing or completing items updates the plan's status.

### 4.4 Reflect

Notes, Journal/check-ins, Decisions and Beliefs (from Mind), and **Weekly Review**: wins, slips, carry-overs, and up to three *pattern hypotheses* ("You postponed gym on 4 of 5 Mondays") each with *Confirm / Not true / Ignore*. Confirmed patterns become memories of type `pattern`.

### 4.5 Me

Profile · **What Valerie knows** · Memory policy · Notifications & SMS · Integrations · Privacy & data (export, delete, activity log) · Appearance · Device lock.

### 4.6 Motion language

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 90 ms | press feedback, toggles |
| `--dur-quick` | 160 ms | hover, small reveals |
| `--dur-standard` | 240 ms | view transitions, sheet open |
| `--dur-emphasis` | 360 ms | first-load reveal, completion |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entrances |
| `--ease-in-out` | `cubic-bezier(.4,0,.2,1)` | moves |
| `--distance-sm` / `--distance-md` | 4 px / 12 px | translate distances |

Rules: transform and opacity only; interruptible; stagger only for lists of ≤ 6 items, ≤ 40 ms apart; first-load reveal is ≤ 360 ms and never blocks input; `prefers-reduced-motion` replaces all motion with ≤ 90 ms opacity fades. Task completion gets a short check-draw plus haptic on iOS where supported.

### 4.7 Visual system

Editorial and calm: a neutral near-black and warm off-white theme pair, one accent colour, type-led hierarchy (a serif display face for headings, a humanist sans for UI), hairline dividers instead of boxes, cards only when they group. No glow, no glassmorphism by default, no gradient backgrounds. Tokens live in one CSS file (`src/styles/tokens.css`); components consume tokens, never raw hex. Existing theme names in `themes.js` map onto the new tokens so user theme choices survive.

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

### 8.3 Policy (user-selectable in Me)

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

Export produces a zip of JSON per collection plus memories and conversations. Deletion removes all rows for the user across every table and the auth user, after a typed confirmation. The activity log lists assistant actions, memory changes and reminder sends. Data sent to Anthropic is limited to the assembled prompt; this is documented in Me → Privacy.

---

## 12. Acceptance criteria (maps to the ten core journeys)

| # | Journey | Done when |
|---|---|---|
| J1 | First run | Sign-in → 3-question optional intro → Today with a setup list, in under 60 seconds, every step skippable. |
| J2 | Capture | Typing "dentist thurs 2:30" produces a proposed event for the correct local Thursday; one tap confirms. |
| J3 | Personal question | Answer lists the records and memories used; asking about something absent yields an explicit "I don't have that". |
| J4 | Memory proposal | Candidate appears as a card; confirm, edit, reject and "change policy" all work and persist. |
| J5 | Correction | Editing a memory creates a superseding record; the old one never appears in retrieval again (unit-tested). |
| J6 | Plan my day | Plan view shows capacity from real events; accepting a suggested next step schedules it. |
| J7 | Weekly review | Shows ≤ 3 patterns, each with evidence counts and confirm/dismiss. |
| J8 | Export/delete | Export contains every collection; delete leaves zero rows (integration-tested). |
| J9 | Plan parity | A plan applied on wide layout appears identically on compact layout after sync. |
| J10 | SMS | Reminder scheduled for 15:00 local sends once at 15:00 local (mocked clock across a DST boundary); edit, cancel and disable work from either layout. |

Cross-cutting: build passes; tests pass; no `VITE_*` secret in `dist`; keyboard-only path works; reduced-motion path verified; screenshots at 390, 768, 1280 and 1600 px wide.

---

## 13. Open questions for the owner

| Id | Question | Blocks |
|---|---|---|
| Q-KEYS | Rotate the Anthropic and ElevenLabs keys (audit §0.1). Confirm when done. | Any new deployment |
| Q-SLP | Style, Lists, Places: which option in §3.4 for each? | Life/Reflect placement of those three |
| Q-INFRA | Approve Supabase Edge Functions as the server layer. | AI proxy, SMS, reliable reminders |
| Q-iOS | Is there any native iOS project? | Parity plan |
| Q-SMS | SMS countries and sender status. | Twilio production setup |

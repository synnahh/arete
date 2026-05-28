# JARVIS Personal AI Assistant — Master Build Prompt

---

## CRITICAL — READ BEFORE DOING ANYTHING

This is a partner-led build. The user is a co-developer and decision-maker on every single aspect of this project. Nothing gets built without consultation and approval first. The build order is strictly:

1. **Consult first** — present options, ask questions, get approval
2. **Build second** — only after the user confirms exactly what they want

### Platform Build Order (DO NOT DEVIATE)
1. **Windows desktop app FIRST** — full design consultation, build, test, and sign off
2. **Mac app SECOND** — after Windows is fully approved
3. **iOS app THIRD** — after Mac is approved; iOS sideloading instructions provided at that stage

### Consultation Protocol
Before writing a single line of code, consult the user on:
- Overall layout and structure of the Windows app
- Colour scheme — present options, let them choose or specify exact colours
- Every tab/module — which ones show on which platform
- Typography — present font pairing options
- The voice orb design — shape, animation style, placement
- Sidebar style — expanded / icon-only / hidden
- Density and spacing feel
- Every setting in the Settings tab
- The assistant's name (default suggestion: JARVIS — but user can change it)
- What the assistant calls the user (default: their first name — fully changeable)
- Widget layout on the dashboard
- Anything else visual or functional before it is built

**Never assume. Always ask. Always confirm before building.**

---

## Overview

Build a fully functional, production-grade personal AI assistant dashboard as a single React artifact. This is a deeply personalised AI assistant and desktop dashboard — the user's personal operating layer they live inside daily. It must feel premium, futuristic, and alive — not like a generic productivity app. Every detail matters and every detail is approved by the user before implementation.

---

## Tech Stack (Artifact / Windows Phase)

- **React** (functional components, hooks)
- **Tailwind CSS** for utility styling
- **Web Speech API** — voice input (speech-to-text) and voice output (text-to-speech), fully offline capable
- **Claude API** (`claude-sonnet-4-20250514`) — online AI brain via `fetch` to `https://api.anthropic.com/v1/messages`
- **Ollama API** (`http://localhost:11434/api/chat`, model: `llama3`) — offline AI fallback
- **Firebase** — cross-device real-time data sync and user account authentication
- **localStorage** — local persistence fallback and caching
- All in one `.jsx` file for artifact phase; broken into proper file structure for EXE phase

---

## Assistant Identity & Naming — Fully Customisable

- The assistant has a **default name** (suggested: JARVIS) — this is changeable at any time in Settings
- The user can rename the assistant to anything they want — all UI labels, voice responses, and system prompts update dynamically to reflect the new name
- The assistant addresses the user by a **chosen name or title** — set during onboarding, changeable at any time in Settings
- This is purely name/title based — e.g. the user could be called by their first name, a nickname, "Boss", "Sir", or anything they choose
- Both the assistant name and the user's preferred title are stored in settings and propagate everywhere instantly on change
- The assistant has a confident, dry-witted, highly capable personality — professional but personable, never robotic, never generic
- Every greeting is contextual — checks time and greets appropriately: *"Good morning [Name]", "Good afternoon [Name]", "Good evening [Name]"*
- On first launch, the assistant delivers a welcome message in character
- All AI responses are shaped by a persistent system prompt enforcing the chosen personality, the user's preferred title, and their defined preferences

---

## Online / Offline AI Architecture

Hybrid intelligence — works seamlessly in both states:

**Online Mode (Claude API):**
- Calls `https://api.anthropic.com/v1/messages` using the user's API key (entered in Settings, stored encrypted)
- Model: `claude-sonnet-4-20250514`
- Full Claude intelligence for complex reasoning, writing, analysis

**Offline Mode (Ollama fallback):**
- Auto-detects connectivity loss or Claude API failure
- Seamlessly switches to Ollama local model (`llama3` via `http://localhost:11434/api/chat`)
- Subtle status indicator: `● ONLINE — Claude` or `● OFFLINE — Local AI`
- Assistant acknowledges the switch naturally in conversation
- If both unavailable, assistant responds gracefully and all non-AI features remain fully functional

**Token Minimisation Architecture:**
- Smart routing layer classifies every message before sending:
  - Simple commands (add task, open notes, set reminder) → Ollama (free, local)
  - Complex requests (reasoning, writing, analysis) → Claude API
- User can manually override which brain to use at any time
- Response caching for repeated queries (daily summary, weather, etc.)
- Daily token budget setting in Settings — assistant warns when approaching limit and auto-switches to Ollama
- All non-AI features (tasks, notes, calendar, trackers, widgets) never touch the Claude API

---

## Voice System

**Voice Input:**
- Web Speech API `SpeechRecognition` — fully offline
- Activated by clicking the voice orb OR a customisable keyboard shortcut (default: hold `Space`)
- Continuous listening mode toggle in Settings
- Live transcription appears in input field as user speaks

**Voice Output:**
- Web Speech API `SpeechSynthesis` — fully offline capable as default
- Assistant speaks every response aloud (toggleable)
- Voice selector in Settings: lists all available system voices — user picks their preferred one
- Speech rate and pitch sliders (range 0.5–2.0)
- Azure Neural Voices integration field in Settings (free tier, high quality — recommended upgrade)
- ElevenLabs API key field in Settings (premium, most natural — optional upgrade)
- Priority order: ElevenLabs (if key present) → Azure Neural (if key present) → System voice

**Audio Visualiser / Voice Orb:**
- The voice orb is the visual heart of the assistant — design to be consulted and approved before building
- When idle: slow breathing pulse, subtle glow
- When listening: orb expands, ripple rings radiate outward, colour shifts
- When speaking: real-time audio frequency visualiser animates around the orb (bars or waveform reacting to speech)
- When thinking: distinct loading animation (rotating arc or particle orbit)
- Orb always visible — either centred in assistant panel or as a persistent floating element
- Orb colour follows the user's chosen accent colour

---

## Cross-Device Sync & Account System

- **Firebase** handles authentication and real-time sync across Windows, Mac, and iOS
- User creates an account with email/password during onboarding (or signs in if returning)
- All data syncs in real time: tasks, notes, calendar, settings, trackers, conversations
- Settings changes on one device propagate to all devices instantly
- Per-platform tab visibility: user controls which tabs/modules appear on Windows vs Mac vs iOS independently — all managed from one Settings screen
- Offline changes sync automatically when connectivity is restored
- Firebase free tier is sufficient for personal use — no cost

---

## Platform Tab Visibility

- Every module/tab has a visibility toggle per platform: Windows / Mac / iOS
- Example: user may want the Files tab on Windows and Mac but not iOS
- Example: user may want the Health tracker only on iOS
- These toggles live in Settings under "Platform Preferences"
- The app built on each platform only renders the tabs enabled for that platform
- This is set up and consulted during the Windows build phase so it's ready when Mac and iOS are built

---

## Modules / Features

### 1. Dashboard (Home)
- Greeting card with assistant welcome message, time, and date
- Live clock (large, styled)
- Weather widget — current weather for user's set location (cached for offline)
- Quick-glance widgets: today's tasks, unread notes, upcoming calendar events
- Recent activity feed
- Motivational or contextual quote of the day (Bible verse, Daily Stoic, or custom — user chooses source in Settings)
- All widgets drag-to-reorder and individually toggleable in Settings

### 2. AI Assistant
- Full conversational chat interface
- Voice orb prominently displayed
- Clear assistant vs user message styling (consulted during design phase)
- Persistent conversation history (Firebase synced)
- Clear conversation button
- Quick-action prompt buttons (customisable in Settings)
- In-app voice commands trigger real UI actions: *"Add a task", "Open my notes", "Switch to calendar"*, etc.
- Typing indicator animation when assistant is generating
- Copy button on each assistant message
- Google Calendar read/write via voice: create, update, delete real calendar events

### 3. Tasks
- Full task manager: add, edit, delete, complete
- Priority: High / Medium / Low with colour coding
- Due dates and times
- Categories / tags (customisable)
- Filter: All, Today, Upcoming, Completed, Priority
- Assistant can add, complete, and read tasks via voice
- Synced via Firebase

### 4. Notes
- Clean note editor: title + body
- Create, edit, delete, search, pin
- Assistant can create and read notes via voice
- Synced via Firebase

### 5. Calendar
- Monthly view with event dots, day view for selected date
- Event creation: title, date, time, description, colour tag
- **Google Calendar API integration** — reads and writes to user's real Google Calendar
- OAuth login for Google Calendar handled securely in Settings
- Assistant can create, update, and delete real Google Calendar events via voice
- Local events stored as fallback if Google Calendar not connected

### 6. Health & Fitness
- **Step counter** — on iOS reads directly from Apple Health (HealthKit); on Windows/Mac displays synced data from iPhone via Firebase
- Sleep, heart rate, and workout data displayed when available from Apple Health sync
- Daily step goal with progress ring
- Weekly activity charts
- Clearly labelled: live data on iOS, synced view on desktop

### 7. Macro & Nutrition Tracker
- Inspired by MyFitnessPal — clean, functional, not bloated
- Log meals: search food database (Open Food Facts API — free)
- **QR / barcode scanner** — on iOS uses camera natively; on desktop uses webcam
- Daily macro targets: calories, protein, carbs, fats — all customisable
- Progress bars for each macro updated in real time as meals are logged
- Meal history and daily log
- Weekly nutrition summary
- Synced via Firebase

### 8. Stimulant Tracker
- Track nicotine and caffeine intake — fully customisable
- Add custom stimulant types, serving sizes, and mg amounts
- Daily intake log with timestamps
- Customisable daily limits — assistant warns when approaching or exceeding
- Weekly trend charts
- Assistant can log intake via voice: *"Log a coffee", "Log a cigarette"*
- Synced via Firebase

### 9. Finance Tracker
- Weekly spending and savings tracker
- Income, expense, and savings goal logging
- Category tags for expenses (customisable)
- Weekly and monthly summary views
- Profit/loss calculator
- Assistant gives verbal weekly financial summaries on request
- Synced via Firebase

### 10. Files
- **Windows/Mac EXE phase**: real OS file system access via Electron/Tauri — open, move, rename, delete files and folders; launch files in default apps
- **Artifact/browser phase**: simulated file manager UI with virtual folders and notes — clearly labelled "Full file access available in the desktop app"
- Assistant can open files and folders via voice command (EXE phase)

### 11. Settings (Full Customisation Engine)
This is the complete personalisation hub. Every section consulted and approved by the user before building.

**Identity:**
- Assistant name (changes all labels, voice responses, and system prompts instantly)
- What the assistant calls the user (name, nickname, title — anything)
- Assistant personality intensity: Professional / Balanced / Casual / Full Character

**AI Configuration:**
- Claude API key (masked, encrypted storage)
- Ollama model selector (model list fetched live from `http://localhost:11434/api/tags`)
- Prefer offline model toggle
- Daily token budget with auto-switch threshold
- Smart routing toggle (auto vs manual brain selection)
- Custom system prompt additions — personal context the assistant always knows

**Appearance (ALL consulted before building):**
- Theme base: Dark / Light / Auto
- Accent colour: full colour picker — propagates to orb, highlights, buttons, active states everywhere
- Background style: Solid / Gradient / Animated gradient / Noise texture / Custom hex
- Font selector: curated premium Google Fonts list for UI and chat
- Sidebar style: Expanded / Icon only / Hidden
- Dashboard widget layout: toggle each on/off, drag to reorder
- Border radius: Sharp / Rounded / Pill
- Density: Compact / Comfortable / Spacious
- Glass morphism toggle: frosted glass on cards and panels
- Animation intensity: Full / Reduced / None

**Voice:**
- Voice selector (all system voices listed)
- Speech rate slider
- Speech pitch slider
- Assistant speaks responses: On / Off
- Auto-listen after assistant speaks: On / Off
- Azure Neural Voices API key field
- ElevenLabs API key field

**Platform Preferences:**
- Per-platform tab visibility toggles (Windows / Mac / iOS per module)
- Platform-specific layout preferences

**Integrations:**
- Google Calendar OAuth connect/disconnect
- Apple Health sync status (iOS only — shown as read-only on desktop)
- Firebase account management

**Notifications & Behaviour:**
- Launch on startup (EXE only)
- Greeting on launch: On / Off
- Daily quote source: Bible verse / Daily Stoic / None
- Sound effects: On / Off
- Keyboard shortcut customisation

**Security:**
- Change account password
- Sign out of all devices
- Data export
- Delete account

---

## Windows Desktop Integration (EXE Phase)

- Launches on Windows startup (startup folder shortcut)
- Greets user by name on boot based on time of day
- Runs in system tray when minimised — single click to restore
- **Dynamic wallpaper**: sets Windows desktop wallpaper programmatically — changes based on time of day, weather, or user schedule
- **Desktop overlay widgets**: persistent widgets sitting on the desktop (clock, tasks, weather, assistant status) — drag to reposition, toggle in Settings
- Full OS file system access — open, move, copy, delete files and folders
- Launch applications via voice command
- All desktop integration features clearly labelled during artifact phase as "Available in Windows app"

---

## iOS Features (Build Phase 3 — After Windows Approved)

- React Native port of the same codebase and design language
- Full voice assistant — Claude API always available (iOS assumed always online)
- Face ID / Touch ID authentication via `react-native-biometrics` (works sideloaded)
- Apple Health integration (HealthKit) — steps, sleep, heart rate, workouts
- Camera-based QR/barcode scanning for macro tracker
- **Home screen widget** — customisable content: daily quote, task count, weather, agenda
- **Lock screen widget** — user chooses what it displays: Bible verse, Daily Stoic quote, or calendar agenda for the day
- Sideloading instructions provided at iOS build phase — options: AltStore (free, auto-refreshes), paid Apple Developer account ($149 AUD/yr for proper widgets + HealthKit)
- All data syncs with Windows and Mac via Firebase in real time

---

## Mac App (Build Phase 2 — After Windows Approved)

- Same React/Electron or Tauri codebase as Windows, compiled as `.app`
- Identical features to Windows with macOS-native adjustments
- macOS menu bar integration — assistant accessible from menu bar
- Spotlight-style quick command launcher
- Same Firebase sync — all data identical across platforms
- Per-platform tab visibility respected

---

## Design Direction (Starting Point — To Be Consulted and Confirmed)

The following is a suggested starting aesthetic. Nothing is final until the user approves it.

**Suggested: Refined Dark Futurism**
- Dark base: near-black (`#080C14`) with deep navy undertones
- Default accent: electric blue/cyan (`#00D4FF`) — fully changeable
- Glass morphism cards: semi-transparent with backdrop blur and fine border highlights
- Typography suggestion: `Orbitron` or `Exo 2` for headings, `DM Sans` or `Sora` for body
- Micro-animations on every interaction
- Sidebar: subtle gradient glow on active item
- All transitions: `cubic-bezier` easing
- Overall feel: precise, dark, electric, alive

**This aesthetic is a starting point for the design consultation — the user has final say on everything.**

---

## Onboarding (First Launch)

Sleek fullscreen onboarding flow — design consulted before building:
1. Assistant introduces itself with animated welcome
2. User creates account or signs in (Firebase auth)
3. User sets their preferred name/title
4. User sets the assistant's name
5. Claude API key entry (skippable — can use Ollama only)
6. Voice selector with live preview
7. Theme picker: base + accent colour
8. Brief platform tab setup
9. Assistant delivers personalised first greeting → transitions to dashboard

---

## State & Data Architecture

**localStorage keys (local cache):**
- `[assistantname]_settings` — all preferences and keys
- `[assistantname]_tasks`
- `[assistantname]_notes`
- `[assistantname]_events`
- `[assistantname]_conversations`
- `[assistantname]_user`
- `[assistantname]_macros`
- `[assistantname]_stimulants`
- `[assistantname]_finance`
- `[assistantname]_health`

**Firebase collections mirror all of the above** — real-time sync with conflict resolution (last-write-wins, with timestamp)

---

## Connectivity & Error Handling

- On mount: check `navigator.onLine`, ping Claude API
- `window.addEventListener('online'/'offline')` updates status in real time
- Claude API error → auto-fallback to Ollama
- Ollama unreachable → graceful limited mode message
- All API calls in try/catch — never expose raw errors to user
- Firebase offline persistence enabled — queued writes sync when back online

---

## Future-Proofing Comments in Code

- ElevenLabs: swap SpeechSynthesis when key present
- Azure Neural Voices: swap when key present
- Electron/Tauri wrapper hooks: file system, startup, tray, wallpaper
- Ollama dynamic model list from `/api/tags`
- React Native port: same component logic, platform-specific modules flagged
- HealthKit integration: flagged for iOS React Native phase
- WidgetKit: flagged for iOS widget phase (requires Apple Developer account)
- Desktop widget overlay: flagged for Windows EXE phase

---

## Quality Bar

This is not a prototype or a demo. Every screen must be polished. Every interaction must feel considered and intentional. Every feature that isn't live yet must be fully designed with a tasteful "Coming in desktop app" label — not a placeholder. The voice orb must be visually stunning. Settings must feel like a real premium product. The assistant must feel like a personality. The dashboard must feel like something the user is proud to open every morning. Build to the absolute limit of what is possible.

---

## UPDATED MODULES — ADDITIONAL FEATURES

---

### 12. SMS & Push Notifications

- **Firebase Push Notifications** — default, free, works across all devices simultaneously, deep-links into the relevant app section
- **Twilio SMS** — optional upgrade for critical reminders (restock alerts, subscription renewals, important tasks). User enters Twilio API key and personal phone number in Settings
- Every feature in the app that has a time or date component has a notification toggle:
  - Tasks — due date reminders
  - Calendar events — X minutes/hours before
  - Essentials restock — X days before estimated run-out
  - Subscription renewals — X days before billing date
  - Macro goals — end of day reminder if not logged
  - Stimulant limits — when approaching daily limit
  - Finance — weekly summary notification
- Notification preferences managed per-feature in Settings
- User chooses per reminder: Push only / SMS only / Both
- SMS used sparingly and only for reminders the user explicitly marks as critical — keeps Twilio cost minimal (~$1-2 AUD/month for personal use)

---

### 13. Fashion / Style Mood Board

- Dedicated **Style** tab — clean Pinterest-style visual grid layout
- **Search**: describe an item via text or voice → AI searches web via Google Custom Search API and returns image results with links
- **Upload**: user uploads or pastes an image → AI analyses it, identifies the style/item, and finds similar options
- **Save to board**: any result can be saved to a personal mood board with category tags (Clothing, Jewellery, Accessories, Footwear, etc.)
- Saved items include: image, link, price (manual entry), notes, and status (Wishlist / Purchased / Pass)
- Board is filterable by category and status
- JARVIS can search via voice: *"Find me minimalist silver jewellery under $200"*
- When item is marked Purchased, option to add it to Essentials tracker automatically
- Pinterest direct API not available (closed) — Google Custom Search API used instead (free tier available)
- Desktop/Mac primary experience — also available on iOS but better suited to larger screen

---

### 14. Essentials / Restock Tracker

- Dedicated **Essentials** tab — track everyday items that need periodic restocking
- Add item with: name, category, purchase date, estimated lifespan (in days/weeks/months)
- App auto-calculates restock date from purchase date + lifespan
- Visual indicator per item: Green (stocked) / Amber (getting low) / Red (due for restock)
- Mark as restocked → resets timer from today's date
- Push or SMS notification X days before estimated run-out (user sets the lead time per item)
- JARVIS can add items via voice: *"Add deodorant, bought today, lasts 3 weeks"*
- Categories: Grooming, Health, Kitchen, Cleaning, Supplements, Other (customisable)
- Monthly restock cost estimator based on item prices (optional manual price entry)
- Synced via Firebase across all devices

---

### 15. Progress & Achievement System (Option D — Full Combined)

A dedicated **Progress** tab that pulls data from every other feature and presents a unified personal performance dashboard.

**Habit Streaks:**
- Daily habits auto-tracked from other modules: hit step goal, under caffeine limit, under nicotine limit, logged all meals, completed X tasks, no missed calendar events
- User can add custom habits manually
- Visual streak counters with flame/milestone indicators
- JARVIS acknowledges streaks in conversation: *"Seven days hitting your step goal. That's the longest streak you've had."*
- Broken streak is noted without judgment — resets cleanly

**XP & Levels:**
- Every positive action earns XP: completed task, logged meal, hit daily goal, maintained streak, restocked essential on time, under budget
- XP accumulates to levels — user names their own level titles in Settings if they want
- JARVIS acknowledges level-ups and milestones naturally in conversation
- Not childish — subtle, satisfying, motivating

**Goal Tracking:**
- Set specific personal goals with a target, deadline, and milestone markers
- Examples: Save $500 by end of month, Walk 10,000 steps daily for 30 days, Stay under caffeine limit for 2 weeks
- Visual progress bars and milestone markers
- JARVIS checks in on goals periodically and when relevant

**Stats Overview:**
- Weekly and monthly personal stats pulled from all modules:
  - Steps taken, sleep average (from Apple Health sync)
  - Meals logged, average macros hit
  - Tasks completed vs created
  - Money saved vs spent
  - Stimulant intake trends
  - Streaks maintained
- Clean charts and summary cards
- JARVIS can give a spoken weekly performance summary on request

---

### 16. Subscription Tracker (Finance Tab — Sub-section)

- Sits within the Finance tab as its own clearly separated section
- Log each subscription: name, amount, billing cycle (weekly / monthly / yearly), next billing date, category, status (Active / Paused / Cancelled)
- Categories: Streaming, Software, Fitness, News, Utilities, Other (customisable)
- Auto-calculates total monthly and yearly subscription spend
- Upcoming renewals listed in date order
- Push or SMS notification X days before each renewal (user sets lead time)
- JARVIS verbal summary on request: *"You have 6 active subscriptions totalling $94 a month, $1,128 a year."*
- Cancelled subscriptions archived (not deleted) for reference
- Synced via Firebase

---

### 17. Daily Brief

- Every morning on launch (or at a set time), JARVIS delivers a spoken and visual daily brief
- Content is fully customisable in Settings — user toggles what's included:
  - Good morning greeting with name
  - Current weather and forecast
  - Today's calendar events
  - Task list for today
  - Daily macro and step goals
  - Any restock alerts due
  - Subscription renewals coming up
  - Daily quote (Bible verse / Daily Stoic / custom)
  - Progress streak status
  - Financial snapshot if desired
- Delivered as a spoken summary by JARVIS and displayed as a clean card on the dashboard
- Can be triggered manually at any time: *"JARVIS, give me my daily brief"*
- Timing configurable: on app launch / at a specific time / manually only

---

### 18. Focus Mode

- Triggered via voice (*"JARVIS, start focus mode"*) or a dedicated button
- Dashboard minimises to a clean distraction-free view: just the timer, a task label, and the voice orb
- Timer style: Pomodoro (25 min work / 5 min break) or custom duration — user sets in Settings
- JARVIS checks in at session end: *"Focus session complete. That's 45 minutes of solid work."*
- Session logged to Progress tab (contributes XP and stats)
- Do Not Disturb mode — non-critical notifications suppressed during focus session
- Optional: ambient background sound (white noise, rain, etc.) — toggled in Settings
- On Windows EXE: can suppress other app notifications at OS level

---

### 19. Reading / Watch List

- Dedicated section (can live within a **Lists** tab alongside the Essentials and Fashion tabs, or as its own tab — to be decided during design consultation)
- Categories: Books, Shows, Films, Podcasts, Articles (all toggleable)
- Add item via voice or text: *"Add Atomic Habits to my reading list"*
- AI enriches the entry automatically: fetches cover image, description, author/director, genre via web search
- Status per item: Want to / In Progress / Finished
- Rating and notes on completed items
- JARVIS can recommend based on your list and completed history
- Filter by category and status
- Synced via Firebase

---

### 20. Mood Tracker

- Lightweight daily check-in — designed to take under 5 seconds
- Input method: emoji/icon picker or a simple 1–10 slider — consulted during design phase
- Optional short note attached to mood entry
- JARVIS prompts once daily at a user-set time (or on app open) — never intrusive
- Weekly mood chart showing trends over time
- Over time JARVIS correlates mood data with other tracked data:
  - Low mood days vs high caffeine intake
  - High mood days vs step goal hit
  - Mood vs sleep data (from Apple Health)
  - Mood vs task completion rate
- JARVIS surfaces insights naturally in conversation: *"You tend to feel better on days you hit your step goal — just worth noting."*
- Data stays completely private — never leaves device except Firebase sync to user's own account
- Synced via Firebase

---

### 21. Quick Capture

- A universal input accessible from anywhere in the app at any time
- Triggered by: a floating button always visible, a keyboard shortcut (customisable), or voice command (*"Hey JARVIS, capture..."*)
- User speaks or types anything — JARVIS intelligently routes it to the right place:
  - *"Remind me to call the dentist Friday"* → creates a task with due date
  - *"I had a coffee at 10am"* → logs to stimulant tracker
  - *"Dinner with Sam on Thursday at 7"* → creates calendar event
  - *"Add milk to essentials"* → adds to restock tracker
  - *"I'm feeling great today"* → logs mood entry
  - *"Note — follow up on the proposal"* → creates a note
- If JARVIS is unsure where something belongs, it asks: *"Should I add that as a task or a note?"*
- Confirmation shown briefly after capture with option to undo
- Available on all platforms — especially powerful on iOS for on-the-go capture

---

## REVISED iOS FEATURE SET (Lean & Focused)

Since the Windows app is the full powerhouse, iOS is kept lean and optimised for mobile use. All data syncs via Firebase so nothing is lost between platforms.

**iOS includes:**
- AI Assistant (full voice, Claude API always online)
- Daily Brief
- Tasks & Reminders
- Calendar (Google Calendar sync)
- Health Tracker (Apple Health / HealthKit live data)
- Macro & Nutrition Tracker (camera barcode/QR scanner)
- Stimulant Tracker
- Essentials / Restock Tracker
- Mood Tracker
- Quick Capture
- Finance quick-log (add expense/income on the go)
- Subscription Tracker (view only, manage on desktop)
- Progress snapshot (streaks and today's stats)
- Push & SMS Notifications
- Home screen widget (customisable content)
- Lock screen widget (Bible verse / Daily Stoic / calendar agenda)
- Face ID / Touch ID authentication
- Settings (identity, voice, notifications, platform preferences)

**Desktop/Mac only (too complex or better suited to large screen):**
- Full file system access and file manager
- Desktop wallpaper control and overlay widgets
- Fashion / Style Mood Board
- Full Progress dashboard with all charts
- Full Finance dashboard with all charts
- Reading / Watch List (available on desktop, optional on iOS in later phase)
- Focus Mode with OS-level Do Not Disturb (desktop); basic version on iOS
- Full Settings overhaul

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

---

## UPDATED MODULES — BATCH 2

---

### 22. JARVIS Evening Debrief (Daily Brief Module — Evening Mode)

- Sits inside the Daily Brief module as a second mode — morning brief and evening debrief
- Triggered automatically at a user-set time or via voice: *"JARVIS, give me my debrief"*
- Content includes:
  - What tasks were completed today vs created
  - What was missed or carried over to tomorrow
  - Tomorrow's calendar events and tasks preview
  - How macros, steps, water, and habits tracked today
  - Mood check-in prompt if not already logged
  - Progress and streak status
  - Motivational or reflective closing from JARVIS
- Delivered as spoken summary + visual card on dashboard
- Fully customisable in Settings — toggle each component on/off

---

### 23. Password Vault

- Dedicated **Vault** tab — desktop only, never synced to Firebase, never leaves the device
- AES-256 encryption — industry standard, same as banks and major password managers
- Separate master password to unlock the vault — not connected to JARVIS login, not stored anywhere
- Auto-locks after X minutes of inactivity (user sets timer in Settings)
- If master password is forgotten the vault is unrecoverable by design — this is a feature not a flaw
- Store: site name, username, password, URL, notes per entry
- Copy password to clipboard with one click — clipboard auto-clears after 30 seconds
- Search entries
- Password generator built in — customisable length and complexity
- Breach check — optional, checks stored passwords against HaveIBeenPwned API (sends only a hash, never the actual password)
- Desktop only — clearly labelled on iOS as unavailable for security reasons
- No export to cloud — local backup export to encrypted file only

---

### 24. Webhook Support (Zapier / Make Integration)

- Sits in **Settings → Integrations → Webhooks**
- User defines outgoing webhook URLs for specific trigger events
- Trigger events available:
  - Task completed
  - Task created
  - Calendar event created
  - Workout logged
  - Daily brief delivered
  - Mood logged
  - Finance entry added
  - Custom JARVIS voice command triggered
- Each webhook: name, trigger event, URL, optional payload customisation
- Test button per webhook — sends a test ping and shows response
- Works with Zapier, Make (Integromat), n8n, or any webhook-compatible service
- Enables connection to thousands of third-party apps without building native integrations

---

### 25. JARVIS Personal Context Engine (AI Learns Over Time)

- JARVIS quietly builds a personal profile from user behaviour over time
- Data points tracked and learned:
  - Daily routines and patterns (when tasks are usually completed, peak productivity hours)
  - Food preferences from macro logs
  - Mood patterns correlated with activities
  - Frequently used voice commands
  - Music preferences from Spotify history
  - Workout preferences and progress
  - Sleep patterns from Apple Health
  - Spending habits from Finance tracker
- Context is stored locally and appended to every Claude API system prompt — making every response more personalised over time
- **"What JARVIS knows about me"** screen in Settings:
  - Full readable summary of everything JARVIS has learned
  - Edit or delete any data point
  - Reset all learned context
- User can also manually add context: *"JARVIS, remember that I prefer morning workouts"*
- Invisible feature — no separate tab, just makes every interaction smarter

---

### 26. Spotify Integration

- Connect via Spotify OAuth in **Settings → Integrations**
- **Dashboard widget**: compact now-playing card showing track, artist, album art, playback controls
- Widget toggleable and draggable like all dashboard widgets
- Voice commands throughout the app:
  - *"JARVIS, play something focused"* → queues a focus/instrumental playlist
  - *"JARVIS, play my morning playlist"*
  - *"JARVIS, pause"* / *"skip"* / *"volume up"*
  - *"JARVIS, play music for my mood"* → uses today's mood log to pick a vibe
- JARVIS suggests music contextually — morning energy, focus session, evening wind-down
- Spotify free account works — no Premium required for basic control (Premium required for specific track playback)
- Fits as dashboard widget + voice layer — no dedicated full tab needed

---

### 27. Meal Planner + Shopping List (Macro & Nutrition Tab — Sub-section)

- Sits inside the **Macro & Nutrition tab** as a dedicated sub-section alongside the daily food log
- **Meal Planner:**
  - Plan meals for each day of the week — breakfast, lunch, dinner, snacks
  - Each meal pulls from a personal recipe library or JARVIS suggests recipes based on macro targets
  - Pre-fills daily macro tracker — see the whole week's nutrition at a glance before it starts
  - JARVIS can generate a full week of meals via voice: *"JARVIS, plan my meals for the week based on my macro goals"*
  - Claude API used to generate intelligent, personalised meal suggestions based on calorie targets, food preferences, and dietary restrictions (set in Settings)
- **Recipe Library:**
  - Add custom recipes with ingredients and macros
  - JARVIS can suggest recipes from the Open Food Facts database
  - Each recipe shows full macro breakdown
- **Shopping List:**
  - Auto-generated from the week's meal plan
  - Combines duplicate ingredients intelligently
  - Manual items can be added
  - Tick off items as purchased
  - JARVIS can read the shopping list via voice
  - Synced via Firebase

---

### 28. Habit Tracker (Health & Fitness Tab — Sub-section)

- Sits inside the **Health & Fitness tab** alongside steps, sleep, and workout data
- Create custom habits with: name, category, frequency (daily / weekly / X times per week), and icon
- Daily check-in — tick habits off each day
- Habit completion feeds directly into the **Progress tab** streak system and XP
- Visual completion rings per habit (similar to Apple Watch activity rings)
- JARVIS acknowledges habit completions naturally in conversation
- Weekly habit completion chart
- Pre-built habit suggestions: workout, meditate, read, no nicotine, under caffeine limit, drink water goal, log meals
- Synced via Firebase

---

### 29. Water Tracker (Health & Fitness Tab — Sub-section)

- Sits inside the **Health & Fitness tab** alongside habits and steps
- Daily water intake goal (customisable — default 2.5L)
- Log intake: quick buttons for common amounts (250ml, 500ml, 750ml, 1L) or custom amount
- Visual progress indicator — fills up as you drink
- JARVIS reminds you to drink at customisable intervals (e.g. every 2 hours) via push notification
- Voice log: *"JARVIS, log 500ml of water"*
- Daily history and weekly average
- Ties into mood correlation in the Mood Tracker over time
- Synced via Firebase

---

### 30. AI Workout Planner (Health & Fitness Tab — Sub-section)

- Sits inside the **Health & Fitness tab** as its own sub-section
- **Initial Setup (consulted with user):**
  - Current weight, height, age
  - Primary goal: lose fat / build muscle / maintain / athletic performance / general fitness
  - Available days per week for training
  - Equipment access: full gym / home with equipment / bodyweight only
  - Any injuries or limitations
  - Experience level: beginner / intermediate / advanced
- **Plan Generation:**
  - Claude API generates a fully personalised weekly workout split based on inputs
  - Appropriate split type selected automatically (push/pull/legs, upper/lower, full body, etc.)
  - Each workout: exercises, sets, reps, rest times, and coaching notes
  - Plan regenerated whenever goals or stats change
- **Workout Logging:**
  - Log each workout session — sets completed, weight used, reps achieved
  - JARVIS tracks progressive overload over time and adjusts weights/reps in the plan
  - Completed workouts earn XP and feed the Progress tab streaks
- **Progress Tracking:**
  - Weight and body measurement logging over time (optional)
  - Strength progress charts per exercise
  - JARVIS gives verbal progress updates: *"Your bench press is up 10kg since you started. Solid progress."*
- Synced via Firebase

---

## DESIGN SYSTEM — BATCH 2 ADDITIONS

---

### Animated Time-of-Day Background

- Background subtly shifts based on current time — gradual, never jarring
- Dawn (5am–8am): warm amber/rose gradient, soft light rays
- Day (8am–5pm): clean dark neutral, the app's default base
- Dusk (5pm–8pm): deep purple/amber transition, warm undertones
- Night (8pm–5am): deep navy/black, subtle star particles or bokeh
- Transition is gradual — updates every minute, imperceptible in real time
- Toggleable in **Settings → Appearance → Animated Background**
- Works in harmony with user's chosen accent colour

---

### JARVIS Thinking Particle Effect

- When Claude API is processing a response, particles animate around the voice orb
- Particle style options (chosen in Settings): orbit / radiate outward / neural network connections / dissolve
- Colour follows accent colour
- Intensity follows animation intensity setting
- Distinct from the listening and speaking states — clearly communicates "I'm thinking"

---

### Time-of-Day Smart Layout

- Dashboard layout adapts based on time of day
- Morning (5am–12pm): Daily Brief card front and centre, tasks, calendar events
- Afternoon (12pm–5pm): Active tasks prominent, focus mode prompt, progress check-in
- Evening (5pm–10pm): Progress summary, evening debrief card, mood check-in
- Night (10pm–5am): Minimal layout, tomorrow's agenda, wind-down feel
- Toggleable in **Settings → Appearance → Smart Layout**
- User can override and pin a preferred layout permanently

---

### Custom Orb Shapes

- Voice orb shape selector in **Settings → Appearance → Orb Style**
- Options: Sphere (default) / Ring / Diamond / Cube / Custom (upload SVG outline)
- Each shape has its own idle, listening, speaking, and thinking animation variant
- Shape change is instant — previewed live in Settings before confirming

---

### Holographic Card Effect

- Cards tilt in 3D and display a shifting light reflection that tracks mouse position on hover
- Subtle, premium — not overdone
- Applies to dashboard widgets, task cards, note cards, and module cards
- Toggleable — automatically disabled when Animation Intensity is set to Reduced or None
- Enabled by default on Full animation setting

---

### Seasonal Themes

- App auto-detects the current season based on date and hemisphere (user sets hemisphere in Settings)
- Winter: cool blues, frost particle overlay, crisp feel
- Spring: soft greens and white, clean and fresh
- Summer: warm amber/gold accents, bright and energetic
- Autumn: deep orange, rust, and brown tones
- Seasonal theme subtly shifts accent colour suggestion and background feel
- User can override at any time in **Settings → Appearance → Seasonal Theme**
- Can be set to Auto / Manual / Off

---

### Minimal Mode

- Strips the entire interface back to: voice orb, one chosen widget (user picks in Settings), and a clean background
- Activated by: voice command (*"JARVIS, minimal mode"*), keyboard shortcut, or a dedicated button
- Exited the same way: voice, shortcut, or clicking anywhere
- The chosen widget options: clock / current task / weather / now playing / nothing
- Perfect companion to Focus Mode — Focus Mode can auto-trigger Minimal Mode
- Transitions in and out with a smooth fade animation

---

## DESIGN DECISIONS — LOCKED IN BY ROB

> These are final. Do not deviate. Consult Rob before changing anything.

### Identity
- Assistant name: **VALERIE**
- What she calls the user: **Rob**
- Both are changeable at any time via Settings OR by telling VALERIE directly mid-conversation
- All UI labels, voice responses, and system prompts update dynamically when either name is changed

### Visual Direction
- Overall vibe: **Dark & minimal** — clean, sleek, premium, nothing unnecessary
- Accent colour: **Soft white / silver** — ultra clean on deep black
- Background base: Deep near-black (`#080C14` range)

### Layout & Structure
- Sidebar: **Icons only, left side** — Windows & Mac (iOS decided later)
- Orb placement: **Floating bottom centre** — small when idle, expands when active
- Density: **Between comfortable and compact** — more info visible, never cramped

### Cards & Panels
- Border radius: **Slightly rounded** — subtle softness, still minimal
- Glass morphism: **Subtle** — barely noticeable frost, just enough depth
- Animation intensity: **Full** — smooth transitions, hover effects, orb animations, everything alive

### Typography
All 6 fonts available and switchable in Settings — Rob chooses on first launch:
- Exo 2 — clean geometric, sharp, tech forward
- DM Sans — premium minimal, clean, professional
- Orbitron — futuristic, bold, strong personality
- Sora — elegant, soft, refined, premium
- Inter — gold standard clean UI font
- Geist — ultra minimal, incredibly clean

### Voice Orb
- All 4 shapes available in Settings: Sphere (default) / Ring / Diamond / Cube
- Floating bottom centre — small idle, expands when active
- Idle: slow breathing pulse, subtle glow
- Listening: expands, ripple rings radiate outward
- Speaking: real-time audio visualiser animates around orb
- Thinking: particle orbit or rotating arc
- Colour: follows accent colour (soft white/silver default)

### Background
All 4 options available in Settings — time-of-day set as default:
- Time-of-day (default): dawn / day / dusk / night shifts automatically
- Animated gradient: slow subtle moving gradient
- Solid deep black: pure, clean
- Noise texture: subtle grain over deep black

### Dashboard Default Widgets
- ✅ Daily quote (Bible verse + Daily Stoic alternating daily)
- ✅ Today's tasks
- ✅ Upcoming calendar events
- ✅ Spotify now playing
- ✅ Progress / streaks snapshot
- ❌ Live clock (available, off by default)
- ❌ Weather (available, off by default)
- ❌ Mood check-in (available, off by default)

---

## TAB-BY-TAB DESIGN DECISIONS — LOCKED IN BY ROB

> These override any general descriptions above. Follow these exactly.

---

### Assistant Tab

- Orb large and centred at the top, chat below it
- User messages: subtle right-aligned bubbles — `background: rgba(255,255,255,0.05)` · `border: 0.5px solid rgba(255,255,255,0.07)` · `border-radius: 10px 10px 3px 10px`
- VALERIE messages: full width cards — `background: rgba(255,255,255,0.03)` · `border: 0.5px solid rgba(255,255,255,0.06)` · `border-radius: 8px`
- Input bar: floating centred pill, 85% width, sits above orb at bottom
- Thinking indicator: orb shifts to thinking state only — no text, no dots
- Response card hover: copy button only
- Voice mode: VALERIE always speaks — no button needed
- Quick action buttons: pinned row above input bar — Daily Brief · Add a task · How am I doing · Focus mode · What's on today — fully customisable
- Conversation scroll: newest at bottom, scroll up for older

---

### Tasks Tab

- Split view — list left, detail panel right (~200px)
- List rows show: task name + description + category + priority pill
- Priority: High / Medium / Low — red / amber / green — fully renameable in Settings
- New task: slides in from right as a panel
- Completing a task: collapses and moves to Completed filter
- Filters: All · Today · Upcoming · Completed

---

### Calendar Tab

- Agenda view — chronological list, no grid
- Event cards: subtle coloured background fill
- New event: slides in from right as a panel
- Filters: Today · Upcoming · All
- Google Calendar full integration — read and write via OAuth

---

### Notes Tab

- Grid / card view — masonry layout
- Pinned notes: full width row at top, grid below
- Opening a note: slides in from right as a panel
- Editor: basic formatting — bold, italic, bullet points, headings
- Search bar at top

---

### Health Tab

- Split view — nav left, content right
- Sub-sections in order: Overview · Habits · Nutrition · Workout · Water · Body
- Progress: rings on stat cards, bars in detail sections — current vs goal for every metric
- Goals individually settable per metric
- Habit check-in: checkbox with optional note
- Water: quick log buttons — 250ml · 500ml · 1L · Custom
- Workout: AI generated plan + manual editing · ExerciseDB API for exercise library with GIFs · YouTube API for tutorials · inline set logging
- Body metrics: Eufy scale via Apple Health — weight, body fat, muscle mass, BMI, visceral fat, water % — trend charts per metric
- Health tab nav has 6 sub-sections: Overview · Habits · Nutrition · Workout · Water · Body

---

### Sidebar

- Icons only, left side, 56px wide
- Group 1: Dashboard · Assistant · Tasks · Calendar · Notes
- Group 2: Health · Finance · Progress
- Group 3: Style · Essentials · Lists · Focus
- Bottom pinned: Vault · Settings · Online/Offline dot
- All tabs reorderable, hideable per platform in Settings

---

### Dashboard

- Full width greeting banner — centred text, greeting large and bold, date/time small and muted underneath
- Mixed grid — full width: quote + tasks · half width: calendar, Spotify, progress
- Widget card style: subtle fill + thin border
- Widget hover: border brightens, no lifting
- VALERIE greets out loud every launch
- Default widgets: Daily quote · Today's tasks · Upcoming events · Spotify · Progress/streaks
- Daily quote: Bible verse + Daily Stoic alternating daily

---

### Finance Tab

- Split view — nav left, content right
- Sub-sections: Overview · Spending · Savings · Subscriptions
- Custom tracking period — user sets start and end dates
- Transaction entry: quick capture style — large amount, type toggle, category grid
- Spending charts: bar chart (daily) + donut (by category) side by side
- Savings goals: milestone tracker — done/active/future dots with connector lines
- Subscriptions: list view — name · cycle · renewal date · status dot · amount · total monthly at top
- Renewal warning: amber text when due soon · push/SMS notification

---

### Style / Fashion Tab

- Full AI-powered personal stylist — describe what you want via voice or text
- VALERIE generates outfit suggestions with full item breakdowns
- Google Custom Search API — finds real products with prices and retailer links (free tier, 100 queries/day)
- Outfit visualisation — Stable Diffusion via Ollama on desktop (free, local) · Pollinations.ai on iOS (free, online)
- Save items or full outfits to personal wishlist/board
- Where to buy — direct retailer links per saved item
- Style profile — VALERIE learns preferences over time via Personal Context Engine
- Occasion-based suggestions — dinner, gym, interview, casual, beach etc
- Weather-aware — factors in local weather when suggesting outfits
- Budget filter — max spend per outfit or per item
- Wishlist status: Wishlist / Purchased / Pass
- Deep personalisation to be designed alongside Progress/Rank tab later
- Layout: to be finalised during personalisation session

### iOS Platform Rules

- iOS uses Claude API only — no Ollama dependency
- Ollama only accessible when iPhone is on same WiFi as PC and PC is on
- iOS assumed always online — Claude API is the sole AI brain
- Outfit visualisation on iOS: Pollinations.ai (free, no API key needed)
- Smart routing on iOS: simple commands handled locally, only genuine AI requests hit Claude API
- Estimated iOS Claude API cost: $2-4 AUD/month at moderate usage

### Settings — API Credits Tracker

- Dedicated section in Settings: API & Usage
- Shows current Anthropic API credit balance (via Anthropic API usage endpoint)
- Shows tokens used this month — input and output separately
- Estimated cost this month in AUD
- Daily usage chart — token consumption over last 30 days
- Alert when credits drop below a user-set threshold — push notification
- Direct link to top up credits at console.anthropic.com
- Updates on app open and refreshable manually

---

### Essentials Tab

- Split view — list left with colour status bar, detail panel right (~170px)
- Status: Green (7+ days) · Amber (≤7 days) · Red (due now)
- Filters: All · Due Soon · Stocked · Category
- New item: slides in from right as panel
- Detail panel: name · category · bought date · lifespan · days left · price · restock button
- Mark as restocked resets timer from today
- Notifications: push default · SMS optional · user sets lead time per item
- VALERIE voice: add, read status, log restock
- Categories customisable in Settings
- All data synced via Firebase

---

### Lists Tab

- Split view — nav left by category, content right
- Categories: Books · Shows · Films · Podcasts · Articles — customisable in Settings
- Item count shown per category in nav
- Status labels: Up Next (blue) · In Progress (amber) · Done (green)
- Filters per category: All · Up Next · In Progress · Done
- Opening/adding: slides in from right — consistent with all tabs
- AI auto-enriches entries — cover image, description, genre via web search
- Item detail: cover · title · author/director · genre · description · status · rating · notes
- VALERIE voice: add items, check status, recommend based on finished list
- All data synced via Firebase

---

### Focus Tab

- Centred ring timer — SVG circle depletes clockwise as countdown runs
- Custom duration only — user sets their own time every session
- Controls: Reset · Play/Pause · Skip
- Ambient sounds: Rain · Lofi beats · White noise · Brown noise · Forest · Off — local audio files, offline, no cost
- Task label: pick from today's tasks OR type manually — both options available per session
- Session dots: row showing completed vs remaining sessions today
- DND: non-critical notifications suppressed during session
- Session logged to Progress tab — earns XP
- VALERIE spoken check-in at session end
- Minimal mode: Focus can auto-trigger minimal mode (orb + timer only)
- Ring colour follows accent colour

---

### Vault Tab

- Split view — list left, detail panel right
- Lock banner always shown when locked — amber warning style
- Authentication: Windows = master password · iOS = Face ID/Touch ID · Mac = Face ID/Touch ID · fallback = master password
- AES-256 encryption via crypto.subtle — key derived from master password via PBKDF2 — master password never stored
- Local only — never synced to Firebase or any cloud
- Auto-lock after inactivity timer (user sets in Settings)
- Categories: All · Social · Finance · Work · Shopping · Other — customisable
- Detail panel: username · password (masked) · URL · category · notes · copy · reveal · edit · delete · breach check
- Copy password: one tap · clipboard auto-clears after 30 seconds
- Password generator: length slider (8–64) · uppercase/lowercase/numbers/symbols toggles
- New entry: slides in from right as panel
- Breach check: HaveIBeenPwned API — hash only, never actual password
- Desktop only — not available on iOS for security reasons

---

### Settings Tab

- Split view — nav left (~130px), content right
- 11 sections: Identity · Appearance · Voice · AI · Notifications · Integrations · Platforms · API Usage · Shortcuts · Data · Security
- Identity: assistant name · user title · personality · greeting · brief times · custom system prompt
- Appearance: theme · accent colour picker · background style · font selector · orb shape · seasonal themes · smart layout · holographic cards · animation intensity
- Voice: voice selector with live preview · rate/pitch sliders · Azure/ElevenLabs key fields · priority order
- AI: Claude API key · Ollama model selector · smart routing · daily token budget · auto-switch threshold
- Notifications: centralised alert control centre — every tab's alerts in collapsible groups · per alert: toggle · push/SMS/both · timing · custom message with variables · Twilio number at top
- API Usage: credits remaining · monthly cost · daily bar chart (14 days) · usage by model · low balance alert · top up link
- Shortcuts: rebindable keyboard shortcuts per action
- Data: export all data as JSON · import · backup
- Security: change passwords · sign out all devices · active sessions list · account deletion locked behind re-auth + confirmation phrase "DELETE MY ACCOUNT"
- Account deletion flow: re-enter password → type confirmation phrase → final modal → irreversible
- All settings persist to localStorage and Firebase instantly on change

---

## PROGRESS / RANK TAB — FULLY LOCKED IN

### Layout
- Sub-tabs across the top: Overview · Streaks · Goals · Stats · Rank
- Overview shows summary cards pulling data from every module
- Each sub-tab is a dedicated view

### Rank System — 8 Tiers, Fully Locked

The rank badge system is built entirely in SVG. Each tier has a unique geometric shape that evolves from sub-rank I → II → III (more detail, nested borders, glowing core emerges). Tier VIII — Ascendant — has no sub-ranks, one badge only, completely unique design.

All badges have a subtle glow effect on the stroke — use CSS filter: drop-shadow or SVG filter for glow. Glow intensity follows the tier colour. Ascendant has a pulsing white glow animation.

**Tier names are fully customisable in Settings — these are the defaults:**

| Tier | Default Name | Shape | Colour (placeholder) | XP |
|---|---|---|---|---|
| I | Hex | Hexagon with internal star lines + cross-hatch | Purple | 0 |
| II | Shard | 4-point star, sharp and minimal | Silver/Grey | 600 |
| III | Void | Plus/cross shape with hollow centre | Blue | 1,800 |
| IV | Raze | 6-point double star | Teal/Green | 4,000 |
| V | Fang | 8-point barbed star, aggressive silhouette | Bronze/Gold | 8,000 |
| VI | Crown | 8-point cross-star, ornate double outline | Gold | 14,000 |
| VII | Spectre | 12-point razor star, jagged | Crimson/Red | 22,000 |
| VIII | Ascendant | 16-point outer star + 8-point inner star + diamond + white glowing core | White/Prismatic | 38,000 |

**Badge progression rules:**
- I → flat shape, single border, no core
- II → same shape, second inner border added, small core appears
- III → shape slightly larger, border brighter/thicker, gem core glows
- Ascendant → completely unique, no sub-ranks, permanent once earned, VALERIE acknowledges it

**Glow implementation:**
- Each badge stroke has a subtle outer glow matching tier colour
- Core circle/gem has inner glow
- Ascendant has a slow pulsing white glow animation (breathing effect)
- All colours fully swappable via the theme system in Settings

### XP Sources
- Task completed: +10 XP
- Habit maintained daily: +25 XP
- Workout logged: +20 XP
- Goal milestone reached: +50 XP
- Focus session completed: +15 XP
- Macros hit for the day: +20 XP
- Under budget for the week: +30 XP
- Streak milestone (7/30/100 days): +100 XP bonus
- Mood logged: +5 XP
- Water goal hit: +10 XP

### Rank Tab UI
- Current tier badge displayed large and centred at top
- Tier name + sub-rank label (e.g. "Crown III")
- XP bar showing progress to next sub-rank or tier
- Tier track showing all 8 tiers — completed (filled) · current (glowing) · future (muted)
- Top XP sources this week
- Tier history — when each tier was reached
- VALERIE acknowledges rank-ups naturally in conversation
- Badge displayed on dashboard, profile, and Progress tab permanently

### Settings — Rank Customisation
- Each tier name fully renameable
- XP thresholds adjustable per tier
- XP values per action adjustable
- Tier colours follow the app theme — change accent colour changes badge glow colours
- Option to hide rank system entirely (toggle in Settings → Progress)

---

## SETTINGS TAB — FULLY LOCKED IN

- Split view — nav left (~130px), content right
- 11 sections: Identity · Appearance · Voice · AI · Notifications · Integrations · Platforms · API Usage · Shortcuts · Data · Security
- Account deletion locked behind re-authentication + must type "DELETE MY ACCOUNT" confirmation phrase
- API Usage section: credits remaining · monthly cost · daily bar chart (14 days) · usage by model (Claude vs Ollama) · low balance alert with custom threshold · direct link to console.anthropic.com
- Notifications section: centralised control centre — every tab's alerts in collapsible groups · per alert: toggle · push/SMS/both · timing · custom message with [variable] placeholders · Twilio number and default delivery at top
- All settings persist to localStorage and Firebase instantly on change


---

### Style Tab — FULLY LOCKED IN

- Two tabs: Discover and My Board
- Discover: occasion quick buttons (Smart Casual · Date Night · Work · Gym · Beach · Evening · Custom) + free text/voice search below · weather-aware · budget filter
- Results: 3-column item card grid · outfit name + total price above · save individually · save all card · add item card · regenerate + swap item buttons
- My Board: split nav left (All · Clothing · Jewellery · Footwear · Accessories · Outfits) · 2-column grid right
- Status labels: Wishlist (blue) · Purchased (green) · Pass (muted)
- Item detail: slides in from right · image · name · price · status · Shop now link · notes · add to Essentials on purchase
- Links: auto-pulled from Google Custom Search · manual paste available
- Outfit visualisation: Stable Diffusion via Ollama (desktop, free) · Pollinations.ai (iOS, free)
- Style profile: VALERIE learns preferences over time via Personal Context Engine
- APIs: Google Custom Search (free tier) · Claude API (existing) · Stable Diffusion (local) · Pollinations.ai (free)

---

## ONBOARDING FLOW — FULLY LOCKED IN

- Style: Structured 7-step screens · dot progress indicator at top · full screen dark `#080c14`
- Step 1: Welcome · orb (simplified placeholder) · "Welcome. I'm VALERIE." · Get started button
- Step 2: Your name · text input · "What do I call you?"
- Step 3: Assistant name · pre-filled "VALERIE" · keep or change
- Step 4: API key · optional · skippable · encrypted · Ollama fallback note
- Step 5: Voice · two tiers — Azure Neural (recommended, API key field, free tier note) + System voices (free, no setup, preview per voice) · ElevenLabs added later in Settings
- Step 6: Named theme grid — Obsidian (default) · Midnight · Ember · Phantom · Arctic · Crimson — each a complete visual package · fine-tune in Settings after
- Step 7: First greeting — spoken aloud + displayed · time-of-day aware · personalised with Rob's name
- VALERIE's exact first words: "Good evening, Rob. Quite the setup you've put together. I'll admit — I'm impressed. Let's make it worth it."
- Tone: warm, confident, premium, a little playful — not generic, not robotic
- Step 7 → dashboard: fade out · orb expands · dashboard fades in
- Transitions between steps: horizontal slide · cubic-bezier easing
- Onboarding flag: `jarvis_onboarded` in localStorage — never shows again after completion
- Back button available on all steps except Step 1
- Settings → Voice: Azure key field (toggle) + ElevenLabs key field (toggle) · both saved simultaneously · priority: ElevenLabs → Azure → System


---

## THEMES — FULLY LOCKED IN

6 complete named themes available in Settings → Appearance → Theme. Switching is instant — no delay, no reload. Theme toggle is a visual grid of 6 options, tap to switch immediately.

Default theme: **Obsidian**

| Theme | Base | Sidebar | Accent | Card fill | Notes |
|---|---|---|---|---|---|
| Obsidian | `#080c14` | `#0d0f14` | `rgba(210,210,210,0.8)` | `rgba(255,255,255,0.03)` | Default — Rob's locked aesthetic |
| Midnight | `#070b14` | `#0a0f1e` | `rgba(100,160,255,0.9)` | `rgba(60,120,255,0.05)` | Deep navy, electric blue |
| Ember | `#0e0a06` | `#140e08` | `rgba(230,150,40,0.9)` | `rgba(200,120,20,0.05)` | Dark charcoal, warm amber |
| Phantom | `#08060e` | `#0e0a18` | `rgba(160,100,230,0.9)` | `rgba(120,60,200,0.05)` | Near-black, deep purple |
| Arctic | `#f4f6f9` | `#ebeef2` | `rgba(60,120,200,0.9)` | `rgba(255,255,255,0.7)` | Clean white, cool blue — light theme |
| Crimson | `#0e0606` | `#160a0a` | `rgba(220,70,70,0.9)` | `rgba(180,30,30,0.05)` | Deep dark red, crimson |

### Theme switching rules
- Switching is instant — CSS variables update globally, no page reload
- Every colour in the app derives from CSS variables — accent, card fill, sidebar, orb glow, badge colours, border colours, button states
- Theme stored in localStorage and Firebase — persists across sessions and devices
- Orb glow colour always matches accent colour
- Rank badge glow always matches accent colour
- Arctic (light theme) inverts text colours throughout — dark text on light background
- User can still use the custom colour picker in Settings → Appearance to override individual colours after choosing a theme
- Theme toggle: visual grid of 6 named swatches in Settings → Appearance → Theme — tap to switch instantly


---

### Health Tab Update — Supplements Sub-section

Health tab now has 7 sub-sections: Overview · Habits · Nutrition · Workout · Water · Body · Supplements

**Supplements:**
- Add supplements: name · dose · frequency (daily/morning/evening/with food) · colour tag · restock link to Essentials
- Daily one-tap log per supplement — same style as Habits check-in
- Batch log: "log all morning supplements" — one tap
- Streak tracking per supplement — feeds Progress XP
- Reminders: push/SMS at set times per supplement
- Voice: "VALERIE, I took my vitamins" logs all due supplements
- Weekly consistency chart
- Restock link syncs with Essentials tracker automatically
- Fully customisable and toggleable in Settings
- All data synced via Firebase

---

### Dual SMS Route System — LOCKED IN

Two separate Twilio numbers under one account:

**Number 1 — VALERIE (personal)**
- All personal notifications: restock · tasks · habits · subscriptions · daily brief · water · supplements
- Warm tone, in VALERIE's character
- Configured in Settings → Notifications → VALERIE SMS Number

**Number 2 — VALERIE Support (technical)**
- Sentry error alerts above set severity threshold
- Firebase sync failures
- Claude API credits critically low
- Ollama offline for extended period
- App crash notifications
- Clinical tone — facts only, no personality
- Configured in Settings → Notifications → Support SMS Number
- Sentry webhook → app function → Twilio SMS flow

**Settings fields:**
- VALERIE Twilio number (sender)
- Support Twilio number (sender)
- Your phone number (recipient — same for both)
- Sentry alert severity threshold (Warning / Error / Critical)

**Cost:** ~$1.50 AUD/month per number · ~$0.01-0.02 AUD per SMS


---

## BATCH 3 — NEW FEATURES & SYSTEM ADDITIONS

---

### Error Logging

**Sentry (UI and functional errors):**
- Sentry SDK integrated into the app from Session 6
- Captures: error type · file + line number · what user was doing · device info · full stack trace
- Triggers VALERIE Support SMS when error severity hits threshold (Warning / Error / Critical — user sets in Settings)
- Sentry dashboard at sentry.io for full error history
- New errors trigger email + Support SMS notification

**Local log file (privacy-sensitive errors):**
- Errors touching personal data (finance, health, vault) written to local `.log` file only
- Never sent to Sentry or any external service
- Readable from Settings → Data → View Error Log
- Log rotates automatically — keeps last 30 days

---

### Auto-Update System (Tauri)

- Built using Tauri's built-in updater
- On app launch: silently checks for updates from GitHub Releases
- If update available: non-intrusive banner — *"A new version of VALERIE is available. Update now?"*
- User chooses when to update — never automatic without permission
- Update downloads in background, installs on next launch
- Version history visible in Settings → About
- All platforms (Windows, Mac) use the same update pipeline
- iOS updates handled separately via AltStore or App Store

---

### App-Wide Search

- Triggered by: search icon in sidebar OR keyboard shortcut
- Searches across every tab simultaneously: tasks · notes · calendar events · finance entries · list items · essentials · supplements · contacts
- Results grouped by type with tab icon
- Click any result to navigate directly to that item
- Toggleable in Settings — hide/show
- Keyboard shortcut customisable in Settings → Shortcuts

---

### Keyboard Command Palette (Ctrl+K / Cmd+K)

- Activated by Ctrl+K (Windows) or Cmd+K (Mac) from anywhere in the app
- Spotlight-style overlay — dark, minimal, centred
- Type any command, navigate to any tab, trigger any action
- Examples: "add task", "open finance", "start focus", "daily brief", "log water", "switch theme"
- Recent commands shown by default
- VALERIE can also be asked questions directly from the palette
- Dismisses with Escape or click outside
- Toggleable in Settings — hide/show

---

### Net Worth Calculator (Finance Tab)

- Sits in Finance tab as a sub-section alongside Overview · Spending · Savings · Subscriptions
- Input assets: cash · investments · property · vehicles · other
- Input liabilities: loans · credit cards · other debts
- Auto-calculates: Net Worth = Total Assets − Total Liabilities
- Tracked over time — monthly snapshot saved automatically
- Simple line chart showing net worth trend
- VALERIE verbal update on request: *"Your net worth is currently $X, Rob. Up $Y this month."*
- Fully customisable categories
- Toggleable in Settings

---

### Detailed Connection Status Indicator

- Lives in sidebar bottom — replaces simple green/grey dot
- Expands on hover to show:
  - Claude API: Online / Offline / Error
  - Ollama: Running / Stopped / Not installed
  - Firebase: Synced / Syncing / Error · last synced timestamp
  - Internet: Connected / Disconnected
- Collapsed: single dot — green (all good) · amber (partial) · red (issue)
- Tap to expand full status panel
- Toggleable in Settings

---

### VALERIE Proactive Nudges

- VALERIE occasionally surfaces insights and reminders without being asked
- Examples:
  - *"You haven't logged water today, Rob."*
  - *"Your Spotify subscription renews tomorrow — $12."*
  - *"You're on a 14 day streak. Longest yet."*
  - *"Step count is low — you've got a few hours to hit your goal."*
  - *"You haven't logged a mood today."*
- Delivered as a subtle card on the dashboard or a soft spoken notification
- Frequency: maximum 3 per day — never intrusive
- Fully toggleable in Settings → Notifications → Proactive Nudges
- Individual nudge types toggleable separately

---

### Conversation Export (Assistant Tab)

- Export any conversation with VALERIE as PDF or plain text
- Accessible via button in the Assistant tab — top right
- Options: export current conversation · export all conversations
- PDF export: clean formatted document with VALERIE branding
- Plain text: simple readable format
- Saved to Downloads folder or chosen location
- Toggleable in Settings

---

### Sleep Tracker Display (Health Tab — Overview)

- Apple Health sleep data displayed as a card in Health Overview
- Shows: last night's sleep duration · sleep quality (if available) · weekly average
- Progress ring: actual vs sleep goal (user sets goal in Settings)
- Trend chart: last 7 nights
- Clearly labelled: live on iOS · synced from iPhone on desktop
- Goal customisable in Settings → Health → Sleep Goal
- Toggleable in Settings

---

### Logo & App Icon Requirements

- Logo needed before Session 7 (Windows packaging)
- Required formats:
  - Full colour — for splash screens and onboarding
  - White only — for dark theme backgrounds
  - Black only — for Arctic (light) theme
  - Square icon — all sizes: 16px · 32px · 64px · 128px · 256px · 512px · 1024px
- Apply to: Windows .exe · Mac .app · iOS app
- Directions to consider: orb / V mark / orb + V mark combined
- Midjourney, Figma, or Fiverr are all valid approaches


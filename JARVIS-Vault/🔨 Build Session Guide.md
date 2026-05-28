# 🔨 Build Session Guide

> Session by session breakdown of exactly how to build VALERIE with Claude Code.
> Read this before every session. Follow the rules every time.

---

## Rules — Follow These Every Single Session

1. **Start every session by saying:** *"Read the Build Prompt at "C:\Projects\JARVIS\Claude Brain\📐 Build Prompt.md" and the relevant Design Specifics file before touching any code. We are partners — consult me before building anything."*
2. **Test after every session** before moving to the next. Don't stack unreviewed sessions.
3. **Commit to Git after every session:** `git add . && git commit -m "Session X — description"`
4. **If something breaks** — paste the error or Sentry log directly to Claude Code. Don't try to fix it manually.
5. **You approve every visual** before moving forward. Nothing ships without your sign-off.

---

## Session 1 — Project Scaffold + Core Shell

**Goal:** App opens, looks right, navigation works.

- [ ] Claude Code reads Build Prompt + Design Consultation file
- [ ] Tauri + React project scaffolded on your PC
- [ ] Folder structure created (src/components, src/tabs, src/styles, src/ai, src/utils)
- [ ] CSS variable theme system built — all 6 themes working with instant switching
- [ ] Sidebar built — icons only, correct order, groupings, status dot
- [ ] Basic routing between all tabs (empty placeholder screens)
- [ ] Onboarding flow built — all 7 steps, VALERIE's first words
- [ ] App opens and onboarding runs correctly

**Test:** Open the app. Go through onboarding. Navigate every tab. Confirm it looks like the design files.

---

## Session 2 — AI Brain + Dashboard

**Goal:** VALERIE is alive and the dashboard looks right.

- [ ] Claude API connected with your key
- [ ] Ollama fallback connected (llama3)
- [ ] Smart routing layer — simple commands → Ollama, complex → Claude
- [ ] Online/offline detection working
- [ ] Detailed connection status indicator in sidebar (Claude · Ollama · Firebase · last synced)
- [ ] Dashboard built — greeting banner, widget grid, all 5 default widgets
- [ ] Time-of-day background working
- [ ] Smart layout (morning/afternoon/evening/night) working
- [ ] VALERIE greets you on launch with correct time-of-day
- [ ] Daily Brief card functional
- [ ] Quick Capture floating input working from any tab

**Test:** Talk to VALERIE. Disconnect internet — confirm Ollama kicks in. Check dashboard looks exactly like design.

---

## Session 3 — Core Productivity Tabs

**Goal:** Tasks, Calendar, Notes fully working and synced.

- [ ] Firebase connected — auth + Firestore
- [ ] Tasks tab — split view, add/edit/delete, priority, filters, slide-in panel, voice commands
- [ ] Calendar tab — agenda view, Google Calendar OAuth connected, event creation
- [ ] Notes tab — grid view, pinned row, slide-in editor, basic formatting
- [ ] All three tabs sync via Firebase
- [ ] Voice commands working across all three (add task, create note, add event)

**Test:** Add tasks, notes, events. Sign out and back in — confirm data persists. Test voice commands.

---

## Session 4 — Health + Finance

**Goal:** Health and Finance tabs fully functional.

- [ ] Health tab — split nav, Overview/Habits/Nutrition/Workout/Water/Body
- [ ] ExerciseDB API connected — exercise library with GIFs
- [ ] YouTube API connected — tutorial videos per exercise
- [ ] Eufy body metrics via Apple Health (placeholder on desktop, live on iOS)
- [ ] Macro tracker — Open Food Facts API, QR scanner (webcam)
- [ ] Finance tab — split nav, Overview/Spending/Savings/Subscriptions
- [ ] Spending charts — bar + donut side by side
- [ ] Savings milestone tracker
- [ ] Subscription list with renewal dates
- [ ] Stimulant tracker built

**Test:** Log a workout, log a meal, log a transaction. Confirm charts update. Confirm Firebase sync.

---

## Session 5 — Remaining Tabs

**Goal:** Every tab in the sidebar is functional.

- [ ] Essentials tab — split view, restock tracker, traffic light status
- [ ] Lists tab — split nav, Books/Shows/Films/Podcasts/Articles
- [ ] Focus tab — ring timer, ambient sounds, session logging to Progress
- [ ] Vault tab — AES-256 encryption, master password, split view
- [ ] Style tab — Discover + My Board, Google Custom Search, Pollinations.ai
- [ ] Progress tab — all sub-tabs, rank badge system with glow, XP tracking
- [ ] All 8 rank badges rendered as SVG with glow effects
- [ ] Ascendant badge pulsing animation working
- [ ] Mood Tracker working
- [ ] Daily/Evening Debrief working

**Test:** Go through every tab. Add items to every section. Confirm XP accumulates and rank updates.

---

## Session 6 — Settings + Integrations

**Goal:** Settings is fully functional. All integrations connected.

- [ ] Full Settings tab — all 11 sections built
- [ ] All 6 themes instant-switching working
- [ ] Spotify OAuth connected — now-playing widget, voice control
- [ ] Sentry error logging connected and capturing errors
- [ ] Local error log file writing correctly
- [ ] Notifications centre — all tab alerts, push working, Twilio SMS optional
- [ ] API Usage section — credits, token chart, low balance alert
- [ ] Webhooks section in Settings → Integrations
- [ ] VALERIE proactive nudges working
- [ ] Keyboard command palette (Ctrl+K) working
- [ ] App-wide search working

**Test:** Trigger an error intentionally — confirm Sentry captures it. Switch all 6 themes. Test Spotify controls.

---

## Session 7 — Windows Packaging

**Goal:** VALERIE is a real .exe on your PC.

- [ ] Wrap in Tauri — builds as standalone .exe
- [ ] Launch on Windows startup working
- [ ] System tray — minimises to tray, single click to restore
- [ ] Dynamic desktop wallpaper control working
- [ ] Desktop overlay widgets — clock, tasks, weather, assistant status
- [ ] Full OS file system access working
- [ ] App launch via voice working
- [ ] OS-level DND during Focus Mode
- [ ] Auto-update system built — checks for updates on launch
- [ ] Windows installer built and tested

**Test:** Install the .exe fresh. Test every Windows-specific feature. Reboot PC — confirm it launches on startup.

---

## Session 8 — Polish + Mac Build

**Goal:** Everything is tight. Mac app works.

- [ ] Fix all bugs from Windows testing
- [ ] Performance pass — smooth animations, no lag
- [ ] Compile codebase as macOS .app
- [ ] macOS menu bar integration working
- [ ] Spotlight-style quick launcher working on Mac
- [ ] Mac tested end to end
- [ ] App icon finalised and applied to both Windows and Mac

**Test:** Full end-to-end test on both Windows and Mac. Fix anything that feels off.

---

## Session 9+ — iOS

**Goal:** VALERIE on your iPhone.

- [ ] React Native project set up — same design language
- [ ] Core modules ported
- [ ] Apple Health (HealthKit) — steps, sleep, heart rate, Eufy body metrics
- [ ] Camera QR/barcode scanner for macro tracker
- [ ] Face ID / Touch ID authentication
- [ ] Home screen widget built
- [ ] Lock screen widget — Bible verse / Daily Stoic / calendar agenda
- [ ] Push notifications on iOS working
- [ ] Sideload via AltStore or Apple Developer
- [ ] Full iOS test on device

---

## After Every Session

```bash
git add .
git commit -m "Session X — [what was built]"
git push
```

Never skip this. It's your safety net.

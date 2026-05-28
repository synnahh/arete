# 📋 Master Checklist

> Tick these off as we go. Organised by phase.

---

## PHASE 0 — Setup (Do Today)

- [x] Purchase Claude Pro (~$31 AUD/month)
- [x] Set up Claude Code
- [x] Create Anthropic API key at console.anthropic.com
- [x] Create Firebase project (free) at firebase.google.com
- [x] Create Google Cloud project for Google Calendar API (free)
- [x] Set up Ollama on your PC (download at ollama.com)
- [x] Pull Llama 3 model in Ollama (`ollama pull llama3`)
- [x] Install Node.js on your PC (nodejs.org)
- [x] Create a project folder on your PC (e.g. `C:/Projects/JARVIS`)
- [x] Drop this Obsidian vault into that folder

---

## PHASE 1 — Design Consultation (Before Any Code)

- [x] Decide on overall layout — sidebar left, content right
- [x] Choose colour scheme — dark base, accent colour
- [x] Choose fonts — heading font + body font
- [x] Decide voice orb style — shape, placement, animation feel
- [x] Decide sidebar style — expanded labels / icon only / hidden
- [x] Decide density — compact / comfortable / spacious
- [x] Choose border radius style — sharp / rounded / pill
- [x] Confirm glass morphism on or off
- [ ] Confirm animation intensity
- [ ] Decide which tabs show on Windows vs Mac vs iOS
- [ ] Choose assistant name (default: JARVIS)
- [ ] Choose what assistant calls you
- [ ] Choose daily quote source — Bible / Stoic / none
- [ ] Choose default voice

---

## PHASE 2 — Windows App Build

### Core Infrastructure
- [ ] React project scaffolded
- [ ] Tailwind CSS configured
- [ ] Firebase connected (auth + database)
- [ ] Routing between tabs working
- [ ] localStorage fallback working
- [ ] Online/offline detection working
- [ ] Claude API connected
- [ ] Ollama fallback connected
- [ ] Smart routing layer (simple → Ollama, complex → Claude)
- [ ] Onboarding flow built

### UI & Shell
- [ ] Dashboard layout built and approved
- [ ] Sidebar navigation built
- [ ] Theme system built (dark/light/auto)
- [ ] Accent colour picker working
- [ ] Font selector working
- [ ] Glass morphism toggle working
- [ ] Animation system working
- [ ] Voice orb built and animated
- [ ] Audio visualiser working

### Modules
- [ ] Dashboard home tab
- [ ] AI Assistant tab + chat interface
- [ ] Tasks tab
- [ ] Notes tab
- [ ] Calendar tab + Google Calendar connected
- [ ] Health & Fitness tab
- [ ] Macro & Nutrition Tracker
- [ ] Stimulant Tracker
- [ ] Finance Tracker + Subscription Tracker
- [ ] Files tab (simulated in artifact, real in EXE)
- [ ] Style / Fashion Mood Board
- [ ] Essentials / Restock Tracker
- [ ] Progress & Achievement tab
- [ ] Daily Brief
- [ ] Focus Mode
- [ ] Reading / Watch List
- [ ] Mood Tracker
- [ ] Quick Capture (floating universal input)

### Notifications
- [ ] Firebase push notifications working
- [ ] Twilio SMS integration (optional)
- [ ] Per-feature notification toggles in Settings

### Settings
- [ ] Identity section (assistant name, user title, personality)
- [ ] AI configuration section
- [ ] Appearance section (full theme overhaul)
- [ ] Voice section
- [ ] Platform preferences section
- [ ] Integrations section
- [ ] Notifications section
- [ ] Security section

### Windows Desktop Integration
- [ ] Launch on Windows startup
- [ ] System tray support
- [ ] Dynamic desktop wallpaper
- [ ] Desktop overlay widgets
- [ ] OS file system access
- [ ] App launch via voice
- [ ] OS-level DND during Focus Mode

### Testing & Sign Off
- [ ] Full feature test on Windows
- [ ] Design reviewed and approved
- [ ] Performance acceptable
- [ ] Offline mode tested
- [ ] Voice input and output tested
- [ ] Cross-device sync tested
- [ ] Windows app signed off ✅

---

## PHASE 3 — Mac App

- [ ] Codebase compiled as macOS .app
- [ ] macOS menu bar integration
- [ ] Spotlight-style quick command launcher
- [ ] Tested on Mac
- [ ] Mac app signed off ✅

---

## PHASE 4 — iOS App

- [ ] React Native project set up
- [ ] Core modules ported
- [ ] Apple Health (HealthKit) integration
- [ ] Camera QR/barcode scanner working
- [ ] Face ID / Touch ID working
- [ ] Home screen widget built
- [ ] Lock screen widget built
- [ ] Push notifications on iOS working
- [ ] Sideloading method chosen (AltStore or Apple Developer)
- [ ] App sideloaded and tested on device
- [ ] iOS app signed off ✅

---

## PHASE 5 — Polish & Ongoing

- [ ] Voice upgraded to Azure Neural or ElevenLabs
- [ ] Apple Developer Account purchased (if widgets/HealthKit needed properly)
- [ ] App icon and branding finalised
- [ ] Performance optimised
- [ ] Token usage reviewed and minimised
- [ ] Full cross-device sync stress tested

---

## BATCH 2 MODULES — Build Checklist

### New Tabs & Sections
- [ ] Evening Debrief added to Daily Brief module
- [ ] Password Vault tab built (desktop only, AES-256, master password, auto-lock)
- [ ] Webhook support built in Settings → Integrations
- [ ] Personal Context Engine built into AI system
- [ ] "What JARVIS knows" screen in Settings
- [ ] Spotify OAuth connected in Settings
- [ ] Spotify now-playing dashboard widget
- [ ] Spotify voice commands working
- [ ] Meal Planner sub-section in Macro tab
- [ ] Recipe library built
- [ ] Shopping list auto-generation working
- [ ] Habit Tracker sub-section in Health tab
- [ ] Water Tracker sub-section in Health tab
- [ ] AI Workout Planner sub-section in Health tab
- [ ] Progressive overload tracking working
- [ ] Workout logging feeds Progress tab

### Design System
- [ ] Time-of-day animated background working
- [ ] Thinking particle effect on voice orb
- [ ] Smart layout time-of-day switching working
- [ ] Custom orb shape selector in Settings
- [ ] Holographic card hover effect working
- [ ] Seasonal theme system working
- [ ] Minimal mode working (voice + keyboard trigger)

---

## PRE-BUILD — Accounts & Setup (Updated)

- [x] Claude Pro purchased ✅
- [x] Claude Code set up ✅
- [x] GitHub repo created + Git configured ✅
- [x] Node.js installed ✅
- [ ] Anthropic API key created + credits loaded (~$15 AUD)
- [ ] Firebase project created — Auth + Firestore + Cloud Messaging enabled
- [ ] Google Cloud project — Calendar API + Custom Search API + YouTube Data API enabled
- [ ] Ollama installed + Llama 3 pulled
- [ ] Sentry account created — new project named VALERIE
- [ ] Spotify Developer app created — Client ID + Secret saved
- [ ] Azure account — Speech Service enabled for Neural Voices
- [ ] ExerciseDB API key — RapidAPI free tier
- [ ] App logo / icon designed and exported in all required formats
- [ ] Obsidian vault dropped into project folder

---

## NEW FEATURES — Build Checklist (Batch 3)

- [ ] Sentry error logging connected and capturing errors
- [ ] Local error log file writing correctly
- [ ] Auto-update system built (Tauri updater)
- [ ] App-wide search working across all tabs
- [ ] Keyboard command palette (Ctrl+K / Cmd+K) working
- [ ] Net worth calculator built in Finance tab
- [ ] Detailed connection status indicator in sidebar
- [ ] VALERIE proactive nudges working (toggleable)
- [ ] Conversation export — PDF and text (Assistant tab)
- [ ] Sleep tracker display card in Health Overview
- [ ] App icon + logo applied to Windows, Mac, iOS

---

## LOGO & ICON — Checklist

- [ ] Logo concept decided (orb / V mark / combined)
- [ ] Logo designed — full colour version
- [ ] Logo exported — white only version
- [ ] Logo exported — black only version (Arctic theme)
- [ ] App icon — square format, all sizes (16px to 1024px)
- [ ] Applied to Windows .exe
- [ ] Applied to Mac .app
- [ ] Applied to iOS app

---

## TWILIO SETUP — Dual SMS Route

- [ ] Create Twilio account at twilio.com
- [ ] Add payment method + load credits (~$10 AUD)
- [ ] Purchase VALERIE number (Australian)
- [ ] Purchase VALERIE Support number (Australian)
- [ ] Save Account SID + Auth Token securely
- [ ] Add both to phone contacts — "VALERIE" and "VALERIE Support"
- [ ] Sentry alert webhook configured → VALERIE Support SMS
- [ ] Both numbers entered in Settings → Notifications when app is built

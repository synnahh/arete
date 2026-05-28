# 📋 Master Checklist

> Tick these off as we go. Organised by phase.

---

## PHASE 0 — Setup (Do Today)

- [ ] Purchase Claude Pro (~$31 AUD/month)
- [ ] Set up Claude Code
- [ ] Create Anthropic API key at console.anthropic.com
- [ ] Create Firebase project (free) at firebase.google.com
- [ ] Create Google Cloud project for Google Calendar API (free)
- [ ] Set up Ollama on your PC (download at ollama.com)
- [ ] Pull Llama 3 model in Ollama (`ollama pull llama3`)
- [ ] Install Node.js on your PC (nodejs.org)
- [ ] Create a project folder on your PC (e.g. `C:/Projects/JARVIS`)
- [ ] Drop this Obsidian vault into that folder

---

## PHASE 1 — Design Consultation (Before Any Code)

- [ ] Decide on overall layout — sidebar left, content right
- [ ] Choose colour scheme — dark base, accent colour
- [ ] Choose fonts — heading font + body font
- [ ] Decide voice orb style — shape, placement, animation feel
- [ ] Decide sidebar style — expanded labels / icon only / hidden
- [ ] Decide density — compact / comfortable / spacious
- [ ] Choose border radius style — sharp / rounded / pill
- [ ] Confirm glass morphism on or off
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

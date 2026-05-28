# 🗺 Build Roadmap

> Phase by phase. Do not skip ahead. Windows first, always.

---

## PHASE 0 — Setup (Before First Claude Code Session)

**Goal:** Everything ready so we can start building immediately.

- Install Node.js on your PC
- Install Ollama + pull Llama 3 (`ollama pull llama3`)
- Create Firebase project
- Create Google Cloud project + enable Calendar API
- Get Anthropic API key
- Install VS Code
- Create GitHub account and empty repo
- Drop this Obsidian vault into your project folder

**Time estimate:** 1-2 hours

---

## PHASE 1 — Design Consultation

**Goal:** Lock in every visual and structural decision before a single line of code.

Claude will consult you on:
- Layout and structure
- Colours and fonts
- Voice orb design
- Sidebar style
- Which tabs on which platform
- Assistant name and your title
- Dashboard widget layout

**Nothing gets built until you approve the design.**

**Time estimate:** 1 session with Claude Code

---

## PHASE 2 — Windows App (Artifact First, Then EXE)

**Step 1 — Artifact (in Claude.ai chat)**
Build the full dashboard as a React artifact. See it live, test it, approve it.

**Step 2 — Local Project (Claude Code)**
Claude Code scaffolds the real project on your PC. Same code, now running locally.

**Step 3 — Connect Everything**
- Firebase auth and sync
- Claude API + Ollama fallback
- Google Calendar OAuth
- All modules built and tested

**Step 4 — Package as EXE**
- Wrap in Electron or Tauri
- Add Windows startup, system tray, wallpaper, overlay widgets
- Build the .exe installer

**Step 5 — Test and Sign Off**
Full test of every feature. Make changes. Approve.

**Time estimate:** 2-4 focused sessions with Claude Code

---

## PHASE 3 — Mac App

**Goal:** Compile Windows codebase for macOS with native adjustments.

- Build as .app
- Add macOS menu bar
- Add Spotlight-style launcher
- Test on Mac
- Sign off

**Time estimate:** 1 session

---

## PHASE 4 — iOS App

**Goal:** React Native port with mobile-specific features.

- Port core modules to React Native
- Add Apple Health (HealthKit)
- Add Face ID / Touch ID
- Add camera QR scanner
- Build home screen and lock screen widgets
- Sideload via AltStore or Apple Developer
- Test on device
- Sign off

**Time estimate:** 2-3 sessions

---

## PHASE 5 — Polish

- Voice upgrade (Azure or ElevenLabs)
- Performance optimisation
- Token usage review
- Final design tweaks
- App icon and branding

---

## Notes

- **Build order is fixed.** Windows → Mac → iOS. No exceptions.
- **You approve everything.** No feature ships without your sign-off.
- **This is a partnership.** Every decision gets run past you first.

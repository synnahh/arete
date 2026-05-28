# 🛠 Tools & Services

> Every application, API, service, and tool used to build and run JARVIS.

---

## AI & Intelligence

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Anthropic Claude API** | Online AI brain (the main intelligence) | ~$5-15 AUD/month usage | console.anthropic.com |
| **Ollama** | Offline AI brain (local, runs on your PC) | Free | ollama.com |
| **Llama 3.1** | The offline AI model run via Ollama | Free | Pulled via Ollama |

---

## Voice

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Web Speech API** | Built-in browser voice input + output | Free | Built into Chrome/Edge |
| **Azure Neural Voices** | High quality voice upgrade | Free tier (500k chars/month) | azure.microsoft.com |
| **ElevenLabs** | Premium, most natural voice option | ~$8 AUD/month | elevenlabs.io |

---

## Backend & Sync

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Firebase** | Real-time cross-device sync + user accounts + push notifications | Free tier (personal use) | firebase.google.com |

---

## Notifications

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Firebase Cloud Messaging** | Push notifications on all devices | Free | Included in Firebase |
| **Twilio** | Optional SMS reminders | ~$1-2 AUD/month light use | twilio.com |

---

## Integrations

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Google Calendar API** | Read and write to real Google Calendar | Free | console.cloud.google.com |
| **Apple HealthKit** | iOS step/sleep/health data | Free | Requires Apple Developer account |
| **Open Food Facts API** | Food database for macro tracker | Free | openfoodfacts.org |
| **Google Custom Search API** | Fashion mood board image search | Free tier (100 queries/day) | console.cloud.google.com |

---

## Development Tools

| Tool                  | Purpose                                      | Cost                                    | Download                   |
| --------------------- | -------------------------------------------- | --------------------------------------- | -------------------------- |
| **Claude Code**       | AI-assisted coding — builds the app with you | Included in Claude Pro (~$31 AUD/month) | claude.ai                  |
| **Node.js**           | Required runtime for the project             | Free                                    | nodejs.org                 |
| **React**             | UI framework                                 | Free                                    | Included in project        |
| **Tailwind CSS**      | Styling                                      | Free                                    | Included in project        |
| **Electron or Tauri** | Packages the app as a Windows/Mac EXE        | Free                                    | electronjs.org / tauri.app |
| **React Native**      | iOS app build                                | Free                                    | reactnative.dev            |
| **VS Code**           | Code editor (recommended)                    | Free                                    | code.visualstudio.com      |
| **Git**               | Version control — save your progress         | Free                                    | git-scm.com                |
| **GitHub**            | Store your code safely in the cloud          | Free                                    | github.com                 |

---

## iOS Distribution

| Option | Purpose | Cost | Notes |
|---|---|---|---|
| **AltStore** | Free sideloading tool — auto-refreshes | Free | altstore.io |
| **Sideloadly** | Alternative sideloading tool | Free | sideloadly.io |
| **Apple Developer Account** | Proper signing, widgets, HealthKit | $149 AUD/year | developer.apple.com |

---

## Design & Fonts

| Service | Purpose | Cost |
|---|---|---|
| **Google Fonts** | Premium fonts (Orbitron, Exo 2, DM Sans, Sora) | Free |

---

## Project Management

| Tool | Purpose | Cost |
|---|---|---|
| **Obsidian** | This vault — project brain | Free |

---

## Accounts to Create Before Starting

- [ ] Anthropic account → get API key → console.anthropic.com
- [ ] Firebase project → firebase.google.com
- [ ] Google Cloud project (for Calendar API + Custom Search) → console.cloud.google.com
- [ ] GitHub account (to store your code) → github.com
- [ ] Twilio account (optional, for SMS) → twilio.com
- [ ] ElevenLabs account (optional, for premium voice) → elevenlabs.io
- [ ] Azure account (optional, for Neural Voices) → azure.microsoft.com

---

## Estimated Monthly Costs (Ongoing After Build)

| Scenario | Cost AUD/month |
|---|---|
| Fully free (Ollama only, no Claude API) | $0 |
| Light Claude usage + free voice | ~$5-8 |
| Moderate Claude + Azure Neural Voice | ~$8-15 |
| Moderate Claude + ElevenLabs | ~$13-20 |
| Apple Developer Account (yearly) | ~$12.50/month |

---

## Batch 2 — Additional Services

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Spotify Web API** | Music playback control, now-playing widget, mood-based playlists | Free | developer.spotify.com |
| **HaveIBeenPwned API** | Password breach checking in Vault (hash only, never actual password) | Free | haveibeenpwned.com/API |
| **Zapier / Make** | Webhook destinations for automation | Free tiers available | zapier.com / make.com |

## Additional Accounts to Create When Ready

- [ ] Spotify Developer account → developer.spotify.com (free, needed for OAuth)
- [ ] Zapier or Make account (optional, only if using webhooks)

---

## Error Logging & Monitoring

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Sentry** | Error logging — captures crashes, stack traces, what user was doing | Free tier | sentry.io |
| **Local log file** | Private error log on device — for errors touching personal data | Free | Built into app |

---

## Additional APIs (Added During Design Phase)

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **ExerciseDB (RapidAPI)** | Exercise library with GIF demos — ~1,300 exercises | Free — 500 req/day | rapidapi.com |
| **YouTube Data API** | Exercise tutorial videos per exercise | Free tier | console.cloud.google.com |
| **Pollinations.ai** | Outfit visualisation on iOS — free image generation | Free — no key needed | pollinations.ai |
| **Stable Diffusion (Ollama)** | Outfit visualisation on desktop — local, free | Free | Via Ollama |

---

## Complete Accounts Checklist — Prioritised

### Must Have Day 1 (Before First Claude Code Session)

- [x] Claude Pro purchased (~$31 AUD/month) — includes Claude Code ✅
- [x] Anthropic API key → console.anthropic.com — add credits (~$15 AUD to start)
- [x] Firebase project → firebase.google.com — enable Auth + Firestore + Cloud Messaging
- [x] Google Cloud project → console.cloud.google.com — enable Calendar API + Custom Search API
- [x] GitHub repo created — private, named VALERIE ✅
- [x] Node.js installed ✅
- [x] Ollama installed + Llama 3 pulled (`ollama pull llama3`)
- [x] Sentry account → sentry.io — free, create new project called VALERIE

### Set Up Before or Shortly After Starting

- [ ] Spotify Developer app → developer.spotify.com — get Client ID + Secret
- [ ] Azure account → azure.microsoft.com — enable Speech Service (Neural Voices free tier)
- [ ] ExerciseDB API key → rapidapi.com — search ExerciseDB, subscribe to free tier
- [ ] YouTube Data API → console.cloud.google.com — enable on same Google Cloud project

### Optional — Set Up When Ready

- [ ] Twilio → twilio.com — SMS reminders (~$1-2 AUD/month)
- [ ] ElevenLabs → elevenlabs.io — premium voice (~$8 AUD/month)
- [ ] Apple Developer Account → developer.apple.com — $149 AUD/yr (for iOS widgets + HealthKit)
- [ ] Zapier or Make → zapier.com / make.com — for webhook automation

---

## SMS — Dual Route System

| Service | Purpose | Cost | Sign Up |
|---|---|---|---|
| **Twilio — VALERIE number** | Personal assistant SMS — restock, tasks, habits, reminders | ~$1.50 AUD/month + ~$0.01-0.02 per SMS | twilio.com |
| **Twilio — VALERIE Support number** | Technical alerts — Sentry errors, sync failures, API issues | ~$1.50 AUD/month + ~$0.01-0.02 per SMS | twilio.com |

### Twilio Setup Checklist
- [ ] Create Twilio account at twilio.com
- [ ] Add payment method + load credits (~$10 AUD to start)
- [ ] Purchase first number (VALERIE) — choose an Australian number
- [ ] Purchase second number (VALERIE Support) — choose an Australian number
- [ ] Save both numbers + Account SID + Auth Token securely
- [ ] Add both numbers to your phone contacts: "VALERIE" and "VALERIE Support"
- [ ] Enter both numbers in Settings → Notifications when app is built

### Sentry → SMS Flow Setup
- [ ] Create Sentry account at sentry.io
- [ ] Create new project named VALERIE
- [ ] Set up alert rule: Error severity → webhook → app function → Twilio Support SMS
- [ ] Test by triggering a deliberate error

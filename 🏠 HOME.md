# JARVIS — Personal AI Assistant Project

> *A fully custom, cross-platform personal AI operating layer. Windows → Mac → iOS.*

---

## Quick Navigation

| File | Description |
|---|---|
| [[📋 Master Checklist]] | Everything that needs to be done, tick as you go |
| [[🔢 Complete Feature List]] | All 92 features numbered and categorised |
| [[💡 Ideas List]] | Future ideas, half-thoughts, things to revisit |
| [[🛠 Tools & Services]] | Every app, API, and service used to build this |
| [[📐 Build Prompt]] | The full master prompt to paste into Claude Code |
| [[🗺 Build Roadmap]] | Phase by phase plan — what gets built when |
| [[💰 Cost Breakdown]] | Ongoing costs, what's free, what's paid |

---

## Project Status

- [x] Planning complete
- [x] Feature list finalised
- [x] Build prompt written
- [ ] Claude Pro / Claude Code purchased
- [ ] Design consultation (Windows UI)
- [ ] Windows app built
- [ ] Windows app tested and approved
- [ ] Mac app built
- [ ] iOS app built and sideloaded

---

## Platform Build Order

1. **Windows** — full design, build, test, sign off
2. **Mac** — same codebase, macOS adjustments
3. **iOS** — React Native, sideload, test

---

## Key Decisions Made

- AI: Claude API (online) + Ollama/Llama3 (offline fallback)
- Sync: Firebase (free tier)
- Voice: System voices default → Azure Neural → ElevenLabs upgrade path
- Packaging: Electron or Tauri for Windows/Mac, React Native for iOS
- Sideloading: AltStore (free) or Apple Developer Account ($149 AUD/yr)
- SMS: Twilio optional, Firebase push notifications as default

---

*Started: May 2026*

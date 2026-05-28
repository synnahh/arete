# 🔒 Vault Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Vault tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split — list left, detail panel right |
| Lock banner | Always shown when vault is locked — amber warning style |
| Search | Search bar filters entries in real time |
| List items | Icon · Site name · Username |
| Detail panel | Full entry details — username, password (masked), URL, category, notes |

---

## Authentication

| Platform | Method | Fallback |
|---|---|---|
| Windows | Master password | — |
| iOS | Face ID / Touch ID | Master password |
| Mac | Touch ID / Face ID | Master password |

---

## Security

| Setting | Decision |
|---|---|
| Encryption | AES-256 — industry standard |
| Storage | Local only — never synced to Firebase or any cloud |
| Master password | Not stored anywhere — unrecoverable if forgotten by design |
| Auto-lock | Locks after X minutes of inactivity — user sets timer in Settings |
| Clipboard | Auto-clears 30 seconds after copying a password |

---

## Categories

| Category | Notes |
|---|---|
| All | Everything |
| Social | Instagram, Twitter, etc |
| Finance | Banking, crypto, etc |
| Work | Work accounts, tools |
| Shopping | Amazon, etc |
| Other | Everything else |

All categories customisable — add/remove in Settings.

---

## Detail Panel Actions

| Action | Notes |
|---|---|
| Copy password | One tap — clipboard clears after 30 seconds |
| Reveal password | Toggle to show/hide |
| Edit entry | Opens slide-in panel pre-filled |
| Delete entry | Confirmation required |
| Breach check | Optional — checks against HaveIBeenPwned API (hash only) |

---

## Password Generator

| Setting | Notes |
|---|---|
| Length | Slider — 8 to 64 characters |
| Complexity | Toggle: uppercase · lowercase · numbers · symbols |
| Generate | One tap — fills password field instantly |

---

## Adding a New Entry

| Setting | Decision |
|---|---|
| Trigger | + button top right |
| Animation | Slides in from right as panel |
| Fields | Site name · URL · Username · Password · Category · Notes |

---

## Build Notes

- Lock banner: `background: rgba(255,180,50,0.06)` · `border: 0.5px solid rgba(255,180,50,0.15)` · amber icon and text
- Passwords always masked by default — dots only
- Reveal button toggles visibility with eye icon
- Copy button: clipboard write + 30s countdown then clear
- AES-256 via `crypto.subtle` browser API — no third party library needed
- Master password used to derive encryption key via PBKDF2 — never stored
- iOS/Mac biometric: `react-native-biometrics` for React Native phase
- Desktop only — not synced, not on iOS (security by design)

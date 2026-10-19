> **Archived (June 2026).** Describes the original VALERIE desktop-only design (OS keychain, no backend). Arete now uses Supabase and server-side secrets; see the README and docs/deploy-runbook.md for the current model.

# VALERIE-VAULT — Security Architecture

*Last updated: 2026-06-02*

---

## Overview

VALERIE is a local-first Tauri desktop application. It has no backend server — all compute runs on the user's device or calls third-party APIs directly. The security model is built around three principles:

1. **Secrets never leave the OS keychain** — no API keys in code, env files, Firebase, or localStorage
2. **All external data is sanitized before use** — XSS and injection vectors stripped at every boundary
3. **Rate limiting protects credentials** — even if a key is extracted, it cannot be hammered

---

## 1. API Key Storage — OS Keychain

### Implementation
- Rust crate: `keyring` v2
- Windows: Windows Credential Manager
- macOS: Keychain Services
- Commands exposed via Tauri IPC: `store_secret`, `get_secret`

### What is stored in keychain
| Key | Service | Notes |
|-----|---------|-------|
| `elevenlabs_api_key` | `valerie` | Voice synthesis key |

### What is NOT stored in keychain (intentionally)
- Claude API key — entered per-session or via Settings, never persisted to disk in plaintext
- Finnhub key — low-sensitivity, stored in settings object
- Firebase config — public-facing SDK config, not a secret

### Key retrieval flow
```
speakText() called
  → voiceSettings.elevenlabsKey present? → use it
  → else: invoke('get_secret', { service:'valerie', key:'elevenlabs_api_key' })
  → else: silent fallback (browser TTS disabled)
```

API keys are **never** written to:
- Firebase Firestore
- localStorage / sessionStorage
- The React settings state object
- Any log output

---

## 2. Input Sanitization

### `src/utils/sanitize.js`

All user input and any string written to Firebase or localStorage passes through:

```js
sanitizeString(value, maxLength = 4000)
  - Strips <script> tags and content
  - Strips all HTML tags
  - Removes null bytes
  - Trims and enforces max length

sanitizePayload(obj)
  - Recursively sanitizes every string in an object/array
  - Non-string primitives pass through unchanged
```

### Applied at
- All Firebase write operations
- All localStorage set operations
- Claude AI action handlers (`src/ai/actions.js`)

---

## 3. Rate Limiting

### `src/utils/rateLimit.js`

Token-bucket algorithm. Each service has its own bucket refilled per minute. Calls that exceed the limit throw immediately — they do not queue silently.

| Service | Limit |
|---------|-------|
| Claude | 10 req / min |
| ElevenLabs | 20 req / min |
| Finnhub | 30 req / min |

Protects against:
- Accidental infinite loops hammering paid APIs
- Runaway AI action chains
- Credential abuse if a key is ever extracted

---

## 4. Firestore Security Rules

File: `firestore.rules` — deployed via `firebase deploy --only firestore:rules`

### Strategy
VALERIE does not use Firebase Auth. All data lives under `users/{deviceId}/*`. Only the device whose ID matches the path can read or write its own data.

### Rules enforced server-side
- `userId` must be non-null and > 8 characters (rejects empty/trivial IDs)
- Write payloads limited to **50 KB** per document
- Individual string fields (`title`, `content`, `description`) capped at 2 KB / 10 KB / 2 KB
- All other paths: **deny read and write**

### Future hardening path
Enable Firebase Anonymous Auth and replace path-based device ID with `request.auth.uid`. This makes impersonation cryptographically impossible rather than practically difficult.

---

## 5. Tauri IPC Boundary

Only the following Rust commands are exposed to the frontend:

| Command | Purpose |
|---------|---------|
| `launch_ollama` | Start local LLM process |
| `ping_ollama` | Health check |
| `ask_ollama` | Local inference |
| `store_secret` | Write to OS keychain |
| `get_secret` | Read from OS keychain |

No filesystem access, no shell execution, no network bypass is exposed. The Tauri `invoke_handler` allowlist is the hard boundary.

---

## 6. Network Security

### Tauri HTTP plugin (`@tauri-apps/plugin-http`)
- All ElevenLabs and Azure TTS calls use `tauriFetch` (not browser `fetch`)
- This ensures calls route through Tauri's native HTTP client, not the WebView2 renderer, bypassing CORS restrictions while keeping traffic auditable

### No outbound calls from backend
- There is no VALERIE server. No telemetry, no analytics, no phoning home.
- All API calls go directly: device → third-party service

---

## 7. Data Sensitivity Classification

| Data | Storage | Sensitivity |
|------|---------|-------------|
| ElevenLabs API key | OS Keychain | 🔴 High |
| Claude API key | Settings (session) | 🔴 High |
| Health logs (sleep, weight, nutrition) | Firestore + localStorage | 🟡 Medium |
| Financial transactions | Firestore + localStorage | 🟡 Medium |
| Tasks, routines, notes | Firestore + localStorage | 🟢 Low |
| Progress photos | localStorage only (base64) | 🟡 Medium — no cloud sync yet |
| Settings & preferences | Firestore + localStorage | 🟢 Low |

### Progress photos note
Photos are stored as base64 in localStorage only. They intentionally do **not** sync to Firestore (Firestore has a 1 MB document limit). Firebase Storage integration is a future phase.

---

## 8. Known Limitations & Future Work

| Item | Risk | Mitigation |
|------|------|-----------|
| No Firebase Auth | Device ID spoofing possible if ID is known | Practically low risk (ID is a UUID); upgrade path: Anonymous Auth |
| Claude key in settings object | In-memory during session | Never written to Firestore or localStorage in plaintext |
| localStorage not encrypted | Physical access to machine exposes data | Tauri secure storage plugin is the upgrade path |
| CSP not configured | XSS via injected content could execute | Sanitize.js mitigates; Tauri CSP config is the upgrade path |
| Progress photos unsynced | Data loss if localStorage cleared | Firebase Storage integration planned |

---

## Deployment Checklist

Before distributing a build:

- [ ] ElevenLabs key stored in keychain, not in `.env` or settings
- [ ] Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] No API keys committed to git (`git log --all -S "sk-"` clean)
- [ ] Rate limiters active (check `rateLimit.js` imports in `claude.js`, `speech.js`, `finnhub.js`)
- [ ] Sanitize wrappers present on all Firebase write paths

# Cross-Platform Strategy — VALERIE

> Locked in before any code is written. Every Tauri feature must follow these rules.

---

## Tauri v2 Platform Support

| Platform | Supported | How |
|---|---|---|
| Windows | ✅ | .exe / .msi via Tauri |
| macOS | ✅ | .app / .dmg via Tauri |
| Linux | ✅ | .AppImage / .deb via Tauri |
| iOS | ✅ (Session 9) | React Native port |
| Android | Future | React Native port (if ever needed) |

---

## Rules for Every Feature

### React Frontend (100% cross-platform — no exceptions)
- All UI, routing, state, AI logic, Firebase sync → pure React/JS
- No platform detection in JSX except for labelling ("Desktop only" chips)
- CSS variables, Tailwind, animations → all cross-platform

### Tauri Rust Backend (cross-platform by design)
Every Tauri API we use must be available on Windows AND macOS. Where a feature is platform-specific, it MUST be gated:

```rust
#[cfg(target_os = "windows")]
fn set_wallpaper() { ... }

#[cfg(target_os = "macos")]
fn set_wallpaper() { ... }
```

### Platform-Specific Features — How We Handle Them

| Feature | Windows | macOS | Strategy |
|---|---|---|---|
| System tray | ✅ Tauri tray API | ✅ Tauri tray API | Same API — works both |
| Desktop wallpaper | ✅ Windows API | ✅ macOS API | `#[cfg]` gates per OS |
| Startup on login | ✅ autostart plugin | ✅ autostart plugin | Same Tauri plugin — works both |
| File system access | ✅ Tauri fs plugin | ✅ Tauri fs plugin | Same API — works both |
| Notifications | ✅ Tauri notification | ✅ Tauri notification | Same API — works both |
| Menu bar | N/A | ✅ Session 8 | macOS-only, added in Session 8 |
| App packaging | .exe/.msi | .app/.dmg | Tauri handles both |

### Tauri Plugins Used (all cross-platform)
- `tauri-plugin-fs` — file system (Windows + macOS + Linux)
- `tauri-plugin-shell` — run system commands (cross-platform)
- `tauri-plugin-notification` — push notifications (cross-platform)
- `tauri-plugin-autostart` — startup on login (Windows + macOS)
- `tauri-plugin-updater` — auto-update (Windows + macOS)
- `tauri-plugin-store` — persistent key/value store (cross-platform)

### What NEVER goes in Tauri Rust backend
- Any Firebase logic → stays in React/JS
- Any Claude API calls → stays in React/JS
- Any UI logic → stays in React/JSX

---

## File Structure Rules
- `src/` — React frontend, 100% cross-platform
- `src-tauri/` — Tauri Rust backend, platform gates used where needed
- `src-tauri/src/main.rs` — entry point, minimal
- `src-tauri/src/commands/` — Tauri commands (file system, system, tray, etc.)
- Each command file clearly labelled if platform-specific

# ⏱ Focus Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Focus tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| Style | Centred ring timer with controls below |
| Timer ring | SVG circle progress ring — fills as session counts down |
| Task label | Shown below timer — pick from today's tasks or type manually |
| Session dots | Row of dots showing sessions completed vs remaining today |
| Ambient sound selector | Row of pill buttons below session dots |

---

## Timer

| Setting | Decision |
|---|---|
| Mode | Custom only — Rob sets duration every time |
| Default | No preset — opens with last used duration |
| Duration input | Simple number input — minutes |
| Controls | Reset · Play/Pause · Skip |
| Ring animation | Depletes clockwise as time counts down |

---

## Ambient Sounds

| Sound | Notes |
|---|---|
| Rain | — |
| Lofi beats | — |
| White noise | — |
| Brown noise | — |
| Forest | — |
| Off | Silence — default |

All sounds are local audio files — no streaming, no cost, works offline.

---

## Task Label

| Setting | Decision |
|---|---|
| Option 1 | Pick from today's tasks — dropdown of active tasks |
| Option 2 | Type manually — free text input |
| Both available | User chooses per session |

---

## Session Behaviour

| Setting | Decision |
|---|---|
| DND | Non-critical notifications suppressed during session |
| OS-level DND | Available in Windows EXE phase |
| Session logging | Completed sessions logged to Progress tab |
| XP | Each completed session earns XP |
| VALERIE check-in | Spoken message at session end |
| Minimal mode | Focus Mode can auto-trigger Minimal Mode (orb + timer only) |

---

## Build Notes

- Ring: SVG `stroke-dasharray` and `stroke-dashoffset` animated with JS
- Ring colour follows accent colour (soft white/silver)
- Timer font: large, spaced, premium feel — `letter-spacing: 2px`
- Session dots: filled = done · animated pulse = active · empty = remaining
- Ambient sounds: local MP3/OGG files bundled with app — loop seamlessly
- Sound pill row: same style as filter pills throughout app
- All focus session data synced via Firebase

# 🏠 Dashboard Design — Locked In

> Confirmed by Rob. All widgets are reorderable and toggleable in Settings.
> Last updated: May 2026

---

## Greeting Banner

| Setting | Decision |
|---|---|
| Width | Full width across the top |
| Layout | Centred — everything centred in the banner |
| Greeting text size | Large and bold |
| Date & time size | Small and muted underneath the greeting |
| Example | "Good morning, Rob" (large) · "Thursday, 29 May 2026 · 9:41 AM" (small, muted) |
| Spoken greeting on launch | Yes — VALERIE greets out loud every time the app opens |

---

## Widget Grid

| Setting | Decision |
|---|---|
| Layout type | Mixed — some full width, some half width |
| Full width widgets | Daily quote, Tasks |
| Half width widgets | Calendar events, Spotify, Progress/streaks |
| Widget order | Decided by Rob after seeing it live — fully drag-to-reorder |
| Reorderable | Yes — drag to reorder directly on dashboard and in Settings |
| Toggleable | Yes — each widget can be hidden/shown in Settings |

---

## Widget Card Style

| Setting | Decision |
|---|---|
| Background | Subtle fill — marginally lighter than base |
| Border | Thin border — barely visible outline |
| Combined | Both fill AND border |
| Hover effect | Border brightens slightly on hover — no lifting or movement |
| Hover transition | Smooth, cubic-bezier easing |

---

## Default Widgets (on by default)

| Widget | Width | Notes |
|---|---|---|
| Daily quote | Full | Bible verse + Daily Stoic alternating daily |
| Today's tasks | Full | Count + completion status |
| Upcoming calendar events | Half | Next event name and time |
| Spotify now playing | Half | Track, artist, basic controls |
| Progress / streaks | Half | Current streak count and goal status |

---

## Available But Off By Default

| Widget | Notes |
|---|---|
| Live clock | Available, toggled on in Settings |
| Weather | Available, toggled on in Settings |
| Mood check-in | Available, toggled on in Settings |

---

## Build Notes

- Banner background: slightly lighter than base — `rgba(255,255,255,0.03)` with bottom border
- Card fill: `rgba(255,255,255,0.03)`
- Card border: `0.5px solid rgba(255,255,255,0.06)`
- Card hover border: `0.5px solid rgba(255,255,255,0.18)` — brightens on hover
- All hover transitions: `cubic-bezier` easing, ~200ms
- Voice orb floats bottom centre — small and idle on dashboard, always visible

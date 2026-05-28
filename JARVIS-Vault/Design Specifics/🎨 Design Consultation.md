# 🎨 Design Consultation — Locked In

> All design decisions confirmed by Rob. Nothing gets built without following these.
> Last updated: May 2026

---

## Identity

| Setting | Value | Notes |
|---|---|---|
| Assistant name | **VALERIE** | Changeable anytime in Settings or by telling her directly |
| What she calls you | **Rob** | Changeable anytime in Settings or by telling her directly |

---

## Visual Direction

| Setting | Decision | Notes |
|---|---|---|
| Overall vibe | Dark & minimal | Clean, sleek, premium — nothing unnecessary |
| Accent colour | Soft white / silver | Ultra clean on deep black |
| Background base | Deep black | Near-black `#080C14` range |

---

## Layout & Structure

| Setting | Decision | Notes |
|---|---|---|
| Sidebar style | Icons only — left side | Windows & Mac. iOS decided later |
| Orb placement | Floating bottom centre | Small when idle, expands when active |
| Density | Comfortable–compact | Between comfortable and compact — more info visible, never cramped |

---

## Cards & Panels

| Setting | Decision | Notes |
|---|---|---|
| Border radius | Slightly rounded | Subtle softness, still minimal |
| Glass morphism | Subtle | Barely noticeable frost — just enough depth |
| Animation intensity | Full | Smooth transitions, hover effects, orb animations — everything alive |

---

## Typography — 6 Font Options in Settings

All available and switchable in Settings. No default locked — Rob chooses on first launch.

| Font | Style |
|---|---|
| Exo 2 | Clean geometric, sharp, modern, tech forward |
| DM Sans | Premium minimal, clean, readable, professional |
| Orbitron | Futuristic, bold, strong personality |
| Sora | Elegant, soft, refined, very premium |
| Inter | Gold standard clean UI font — simplistic and readable |
| Geist | Ultra minimal, used by Vercel — incredibly clean |

---

## Voice Orb

| Setting | Decision | Notes |
|---|---|---|
| Shape | All 4 options in Settings | Sphere / Ring / Diamond / Cube — Sphere as default |
| Placement | Floating bottom centre | Small idle, expands when active |
| Idle state | Slow breathing pulse, subtle glow | |
| Listening state | Expands, ripple rings radiate outward | |
| Speaking state | Real-time audio visualiser animates around orb | |
| Thinking state | Particle orbit or rotating arc animation | |
| Colour | Follows accent colour (soft white / silver default) | |

---

## Background

All 4 options available and switchable in Settings. Time-of-day set as default.

| Option | Description |
|---|---|
| Time-of-day ⭐ default | Dawn / day / dusk / night — shifts automatically |
| Animated gradient | Slow subtle moving gradient, barely noticeable |
| Solid deep black | Pure, clean, nothing behind the UI |
| Noise texture | Very subtle grain over deep black, adds depth |

---

## Dashboard — Default Widgets

These show on the home screen by default. All toggleable and drag-to-reorder.

- ✅ Daily quote
- ✅ Today's tasks
- ✅ Upcoming calendar events
- ✅ Spotify now playing
- ✅ Progress / streaks snapshot
- ❌ Live clock (available, off by default)
- ❌ Weather (available, off by default)
- ❌ Mood check-in prompt (available, off by default)

---

## Daily Quote

| Setting | Decision |
|---|---|
| Source | Both — Bible verse and Daily Stoic alternating daily |

---

## Design Principles to Follow During Build

- Never assume — always confirm with Rob before implementing
- Nothing ships without Rob's approval
- Every screen must feel premium — not a prototype
- Soft white / silver accent on deep black throughout
- Subtle glass, full animations, slightly rounded corners
- VALERIE feels like a personality, not a chatbot
- The dashboard should feel like something Rob is proud to open every morning

---

## Themes — Locked In

6 named themes, each a complete visual package. Instant switching via toggle grid in Settings → Appearance → Theme.

| Theme | Base | Accent | Feel |
|---|---|---|---|
| Obsidian ⭐ default | `#080c14` | Silver/white | Deep black, minimal, Rob's locked aesthetic |
| Midnight | `#070b14` | Electric blue | Deep navy, cool and sharp |
| Ember | `#0e0a06` | Warm amber | Dark charcoal, warm and rich |
| Phantom | `#08060e` | Deep purple | Near-black, mysterious |
| Arctic | `#f4f6f9` | Cool blue | Clean white — the only light theme |
| Crimson | `#0e0606` | Crimson red | Deep dark red, bold and intense |

- Switching is instant — no delay, no reload
- All colours derive from CSS variables — everything updates simultaneously
- Custom colour overrides still available in Settings → Appearance after theme selection
- Theme syncs across all devices via Firebase

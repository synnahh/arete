# 📅 Calendar Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Calendar tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| Default view | Agenda view — chronological list of upcoming events, no grid |
| Scroll direction | Newest/soonest at top, scrolls down into future |
| Date separators | Muted date label between each day's events |

---

## Event Cards

| Setting | Decision |
|---|---|
| Colour coding style | Subtle coloured background fill across the whole card |
| Card info shown | Time · Event name · Category/calendar tag |
| Selected event | Slides in detail panel from the right |

---

## Adding a New Event

| Setting | Decision |
|---|---|
| Trigger | + button top right |
| Animation | Slides in from the right as a panel — consistent with Tasks |
| Form fields | Event name · Date · Start time · End time · Description · Colour tag · Calendar |

---

## Filters

| Filter | Notes |
|---|---|
| Today | Events today only |
| Upcoming | All future events |
| All | Everything including past events |

---

## Google Calendar Integration

| Setting | Decision |
|---|---|
| Integration | Full read and write via Google Calendar API |
| Auth | OAuth — connect/disconnect in Settings → Integrations |
| Fallback | Local events stored if Google Calendar not connected |
| Voice | VALERIE can create, update and delete real Google Calendar events |

---

## Build Notes

- Date label: `font-size: 10px` · `color: rgba(255,255,255,0.35)` · margin above each day group
- Event card fill colours: low opacity tints — blue `rgba(100,160,255,0.06)` · green `rgba(100,210,130,0.06)` · amber `rgba(255,180,50,0.06)` etc.
- Event card border: matching colour at ~0.15 opacity
- Time column: `min-width: 44px` · muted · consistent alignment
- New event panel: same slide-in animation as Tasks — `translateX(100%)` → `translateX(0)` · cubic-bezier · ~250ms
- Filter pills: same style as Tasks — `border-radius: 20px` · active state subtle fill
- All events synced via Firebase + Google Calendar API

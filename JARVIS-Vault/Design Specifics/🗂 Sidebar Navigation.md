# 🗂 Sidebar Navigation — Locked In

> Confirmed by Rob. All tabs are reorderable, hideable/showable per platform from Settings.
> Last updated: May 2026

---

## Sidebar Style

| Setting | Decision |
|---|---|
| Style | Icons only — no labels |
| Position | Left side |
| Platforms | Windows & Mac (iOS decided later) |
| Reorderable | Yes — drag to reorder in Settings |
| Hide / Show per tab | Yes — toggle each tab on/off per platform |
| Sync | Order and visibility syncs across devices via Firebase |

---

## Confirmed Tab Order

### Group 1 — Core (top)

| Position | Tab | Icon |
|---|---|---|
| 1 | Dashboard | Home |
| 2 | Assistant | Message / Chat |
| 3 | Tasks | Checkmark |
| 4 | Calendar | Calendar |
| 5 | Notes | Notes |

### Group 2 — Lifestyle (middle)

| Position | Tab | Icon |
|---|---|---|
| 6 | Health | Heart |
| 7 | Finance | Chart / Bar |
| 8 | Progress | Star / Trophy |

### Group 3 — Extras (lower)

| Position | Tab | Icon |
|---|---|---|
| 9 | Style | Shirt / Hanger |
| 10 | Essentials | Box |
| 11 | Lists | List |
| 12 | Focus | Clock / Timer |

### Bottom — Always Visible

| Position | Tab | Icon |
|---|---|---|
| 13 | Vault | Lock |
| 14 | Settings | Gear |
| — | Online/Offline status dot | Green/Grey dot |

---

## Customisation Rules (Settings → Platform Preferences)

- Every tab has a visibility toggle per platform: Windows / Mac / iOS
- Tab order is drag-to-reorder — changes apply per platform independently
- Groups can be reordered too — not just individual tabs
- Vault and Settings are always pinned to the bottom — cannot be hidden
- Online/Offline status dot always visible at the very bottom of the sidebar
- Changes sync to all devices via Firebase instantly

---

## Notes for Build

- Dividers between the three groups are subtle — `0.5px rgba(255,255,255,0.06)`
- Active tab: slightly brighter icon + subtle background highlight `rgba(255,255,255,0.08)`
- Hover state: icon brightens slightly, no background
- VALERIE logo / initial sits at the very top above all tabs
- Sidebar width: 56px (icon only, no labels)
- All transitions on hover and active states use `cubic-bezier` easing

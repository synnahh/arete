# ✅ Tasks Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Tasks tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split view — list left, detail panel right |
| List items | Task name + description + category visible in each row |
| Detail panel | Full task details shown on right when task is selected |
| Selected task highlight | Slightly brighter background + brighter border |

---

## Priority Levels

| Setting | Decision |
|---|---|
| Default levels | High / Medium / Low |
| Colour coding | High = red · Medium = amber · Low = green |
| Renameable | Yes — fully customisable labels in Settings |

---

## Adding a Task

| Setting | Decision |
|---|---|
| Trigger | + button top right of the tab |
| Animation | Slides in from the right as a panel over the current view |
| Form fields | Task name · Description · Priority · Due date · Category |
| Dismiss | Click outside or press Escape |

---

## Completing a Task

| Setting | Decision |
|---|---|
| On tick | Collapses with smooth animation |
| Where it goes | Moves to Completed filter — archived, not deleted |
| Undo | Brief undo toast appears after completion |

---

## Filter Tabs

| Filter | Notes |
|---|---|
| All | All active tasks |
| Today | Tasks due today |
| Upcoming | Tasks due in the future |
| Completed | All completed/archived tasks |

---

## Build Notes

- List row: task name (12px/500) + description (10px muted) + category tag + priority pill
- Detail panel width: ~200px · background `#13161c` · left border `0.5px rgba(255,255,255,0.08)`
- Slide panel animation: `transform: translateX(100%)` → `translateX(0)` · cubic-bezier easing · ~250ms
- Completion animation: height collapses to 0 + opacity fades · ~200ms · then moves to Completed
- Filter pills: `border-radius: 20px` · active state has subtle fill + brighter text
- Priority pills: small, subtle — red/amber/green at low opacity to match minimal aesthetic
- VALERIE can add, complete and read tasks via voice throughout the app
- All tasks synced via Firebase

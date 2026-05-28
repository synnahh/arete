# 📦 Essentials Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Essentials / Restock Tracker tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split — list left with status bar, detail panel right |
| List items | Status bar · Item name · Category · Days left |
| Detail panel | Full item details — name, category, bought date, lifespan, days left, estimated cost |

---

## Status System

| Status | Colour | Condition |
|---|---|---|
| Stocked | Green | More than 7 days remaining |
| Due Soon | Amber | 7 days or less remaining |
| Due | Red | 0 days — restock now |

---

## Filters

| Filter | Notes |
|---|---|
| All | Every item regardless of status |
| Due Soon | Amber and red items only |
| Stocked | Green items only |
| Category | Filter by category — Grooming · Health · Kitchen · Cleaning · Supplements · Other |

---

## Adding a New Essential

| Setting | Decision |
|---|---|
| Trigger | + button top right |
| Animation | Slides in from the right as a panel |
| Form fields | Name · Category · Purchase date · Estimated lifespan · Price (optional) |

---

## Detail Panel Actions

| Action | Notes |
|---|---|
| Mark as restocked | Resets timer from today's date |
| Edit item | Opens slide-in panel pre-filled |
| Delete item | Confirmation required |

---

## Notifications

| Setting | Notes |
|---|---|
| Lead time | User sets how many days before run-out to be notified per item |
| Type | Push notification default · SMS optional via Twilio |

---

## VALERIE Integration

| Feature | Notes |
|---|---|
| Add via voice | "VALERIE, add deodorant, bought today, lasts 30 days" |
| Read status | "VALERIE, what essentials do I need to restock?" |
| Log restock | "VALERIE, I just restocked my protein powder" |

---

## Build Notes

- Status bar: `width: 3px` · `height: 28px` · left side of each list row
- Detail panel: ~170px wide · same style as Tasks and Health
- Progress mini bar on list rows optional — can be toggled in Settings
- Categories customisable — add/remove in Settings
- All data synced via Firebase

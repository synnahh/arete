# 📚 Lists Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Lists tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split — nav left by category, content right |
| Nav items | Books · Shows · Films · Podcasts · Articles |
| Item count | Shown beside each category in the nav |
| Content area | List of items for selected category with status filters |

---

## Status Labels

| Status | Colour | Notes |
|---|---|---|
| Up Next | Blue | Queued, not started |
| In Progress | Amber | Currently reading/watching/listening |
| Done | Green | Finished |

---

## Filters (within each category)

- All · Up Next · In Progress · Done

---

## Adding / Opening an Item

| Setting | Decision |
|---|---|
| Animation | Slides in from the right — consistent with all other tabs |
| New item fields | Title · Category · Author/Director · Status · Rating · Notes |
| AI enrichment | Auto-fetches cover image, description, genre via web search |

---

## Item Detail Panel

| Field | Notes |
|---|---|
| Cover image | Auto-fetched or placeholder icon |
| Title | — |
| Author / Director / Host | — |
| Genre | Auto-fetched |
| Description | Auto-fetched, editable |
| Status | Up Next / In Progress / Done — changeable |
| Rating | 1–5 stars, shown when Done |
| Personal notes | Free text field |
| VALERIE recommendation | "Based on your list, you might like…" |

---

## VALERIE Integration

| Feature | Notes |
|---|---|
| Add via voice | "VALERIE, add Atomic Habits to my reading list" |
| Check status | "VALERIE, what am I currently reading?" |
| Recommend | "VALERIE, suggest something based on my finished list" |

---

## Build Notes

- Nav: category name + item count · same split nav style as Health and Progress
- Status pills: blue (Up Next) · amber (In Progress) · green (Done)
- Cover image: fetched via web search · fallback to category icon
- Slide-in panel: same animation as all other tabs — cubic-bezier · ~250ms
- Categories customisable — add/remove in Settings
- All data synced via Firebase

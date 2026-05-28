# 📝 Notes Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Notes tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Grid / card view — masonry layout |
| Pinned notes | Separate row at the very top, full width — grid flows below |
| Card content | Title + preview text + date |
| Search | Search bar at the top of the tab |

---

## Opening a Note

| Setting | Decision |
|---|---|
| On click | Slides in from the right as a panel |
| Animation | Consistent with Tasks and Calendar — `translateX(100%)` → `translateX(0)` |
| Editor inside panel | Full title + body with basic formatting toolbar |

---

## Note Editor

| Setting | Decision |
|---|---|
| Formatting | Basic — bold, italic, bullet points, headings |
| Toolbar | Minimal floating toolbar appears on text selection |
| Plain text fallback | Yes — can write without any formatting |

---

## Actions

| Action | How |
|---|---|
| Create note | + button top right |
| Pin note | Pin icon on card or inside editor |
| Delete note | Inside editor — delete button with confirmation |
| Search | Search bar filters cards in real time |

---

## VALERIE Integration

| Feature | Notes |
|---|---|
| Create note via voice | "VALERIE, create a note called…" |
| Read note via voice | "VALERIE, read my weekly goals note" |
| Add to note via voice | "VALERIE, add this to my client notes…" |

---

## Build Notes

- Grid: `display: grid` · `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))` · `gap: 8px`
- Pinned row: full width row above grid · same card style with pin icon visible
- Card: `background: rgba(255,255,255,0.03)` · `border: 0.5px solid rgba(255,255,255,0.06)` · `border-radius: 8px` · `padding: 10px 11px`
- Card hover: border brightens — consistent with dashboard widget hover
- Panel slide-in: same animation as Tasks and Calendar — cubic-bezier · ~250ms
- Formatting toolbar: appears on text selection · minimal icons only · bold · italic · bullets · H1/H2
- All notes synced via Firebase

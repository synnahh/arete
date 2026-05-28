# 🏆 Progress Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Progress tab including the full rank system.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Sub-tabs across the top |
| Sub-tabs | Overview · Streaks · Goals · Stats · Rank |

---

## Rank System — 8 Tiers (LOCKED)

### Badge Design Rules
- Every tier has a completely unique geometric shape
- I → II → III: same shape, progressively more detailed, nested borders, gem core glows at III
- All badges built in SVG — sharp, scalable, animatable
- Glow effect on every badge stroke — CSS filter drop-shadow matching tier colour
- Ascendant: slow pulsing white glow animation (breathing effect), no sub-ranks

### Tier Table

| Tier | Default Name | Shape | Colour | XP Threshold |
|---|---|---|---|---|
| I | Hex | Hexagon with internal star lines + cross-hatch overlay | Purple (placeholder) | 0 |
| II | Shard | 4-point star, sharp and minimal | Silver/Grey (placeholder) | 600 |
| III | Void | Plus/cross shape with hollow centre, blue gem square at III | Blue (placeholder) | 1,800 |
| IV | Raze | 6-point double star, teal core at III | Teal/Green (placeholder) | 4,000 |
| V | Fang | 8-point barbed star, aggressive silhouette, gold core at III | Bronze/Gold (placeholder) | 8,000 |
| VI | Crown | 8-point cross-star, ornate double outline, blazing gold core | Gold (placeholder) | 14,000 |
| VII | Spectre | 12-point razor star, jagged, crimson blood core at III | Crimson/Red (placeholder) | 22,000 |
| VIII | Ascendant | 16-point outer star + 8-point inner star + diamond centre + white glowing core | White/Prismatic | 38,000 |

### Sub-rank Progression Per Tier
- **Rank I** — flat shape, single border, no core
- **Rank II** — same shape, second inner border added, small core appears
- **Rank III** — shape slightly larger, border brighter/thicker, gem core glows
- **Ascendant** — completely unique, no sub-ranks, earned once, permanent

### XP Sources
| Action | XP |
|---|---|
| Task completed | +10 |
| Habit maintained daily | +25 |
| Workout logged | +20 |
| Goal milestone reached | +50 |
| Focus session completed | +15 |
| Macros hit for the day | +20 |
| Under budget for the week | +30 |
| Streak milestone (7/30/100 days) | +100 bonus |
| Mood logged | +5 |
| Water goal hit | +10 |

---

## Rank Tab UI

| Element | Notes |
|---|---|
| Current badge | Large, centred at top, animated glow |
| Tier name + sub-rank | e.g. "Crown III" |
| XP progress bar | Shows progress to next sub-rank or tier |
| Tier track | All 8 tiers shown — completed/current/future states |
| Top XP sources | This week's top earners |
| Tier history | Date each tier was reached |
| VALERIE acknowledgement | Spoken rank-up message when tier changes |

---

## Customisation (Settings → Progress)

- Each tier name fully renameable
- XP thresholds adjustable per tier
- XP values per action adjustable
- Badge glow colours follow app accent colour theme
- Option to hide rank system entirely

---

## Streaks Sub-tab
- Daily habits auto-tracked from all modules
- Visual streak counters per habit
- Flame/milestone indicators
- Broken streak noted without judgment — resets cleanly
- VALERIE acknowledges streaks in conversation

## Goals Sub-tab
- Set personal goals with target, deadline, milestone markers
- Visual progress bars + milestone dots
- VALERIE checks in on goals periodically

## Stats Sub-tab
- Weekly and monthly stats from all modules
- Steps, sleep, macros, tasks, money, habits, focus time
- Clean charts and summary cards
- VALERIE spoken weekly performance summary on request

## Overview Sub-tab
- Summary cards: current streak · current tier · XP · goals active
- XP progress bar to next rank
- Quick snapshot of all stats

---

## Build Notes

- Sub-tab pills: same style as filter pills throughout app
- Badge SVG paths locked in — do not alter shapes
- Glow: `filter: drop-shadow(0 0 6px [tier-colour])` on SVG stroke
- Ascendant glow: CSS `@keyframes pulse` on drop-shadow opacity
- Tier track: horizontal row of badge icons · filled = done · glowing = current · muted = future
- All progress data synced via Firebase

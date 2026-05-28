# 💪 Health Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Health tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split — nav list left, content right |
| Sub-sections | Overview · Habits · Nutrition · Workout · Water |
| Nav order | Overview first, then Habits, Nutrition, Workout, Water |

---

## Overview Section

| Setting | Decision |
|---|---|
| Stat cards | Steps · Sleep · Water · Habits — all with ring progress |
| Progress style | Ring for stat cards, progress bar for detailed sections |
| Progress display | Current vs goal — e.g. 7,842 / 10,000 steps |
| Goals | Individually settable and changeable per metric in Settings |

---

## Habits Section

| Setting | Decision |
|---|---|
| Check-in style | Checkbox with optional note |
| Note field | Appears below checked habit — optional, collapsible |
| Streak display | Shown beside each habit — e.g. "7 day streak" |
| Custom habits | Yes — add, edit, delete habits in Settings |
| Pre-built suggestions | Morning workout · Hit step goal · No nicotine · Read · Meditate |
| Feeds Progress tab | Yes — habit completions contribute to streaks and XP |

---

## Nutrition Section

| Setting | Decision |
|---|---|
| Food database | Open Food Facts API — free |
| QR / barcode scanner | Yes — webcam on desktop, camera on iOS |
| Daily macro targets | Calories · Protein · Carbs · Fats — all individually customisable |
| Progress display | Progress bars per macro — current vs goal |
| Meal log | Daily log with meal entries and timestamps |
| Weekly summary | Charts showing macro averages over the week |

---

## Workout Section

| Setting | Decision |
|---|---|
| Plan creation | AI generated (Claude API) + full manual editing |
| Exercise library | ExerciseDB API — ~1,300 exercises with GIF demos |
| Video tutorials | YouTube API — full tutorial videos per exercise |
| Logging style | Inline set logging — weight and reps per set, tick when done |
| Progressive overload | VALERIE tracks weights over time and adjusts plan |
| Workout split | AI generates appropriate split based on goals and availability |
| Manual overrides | Swap any exercise from the library at any time |
| VALERIE overhaul | Ask VALERIE to regenerate the entire plan anytime |

---

## Water Section

| Setting | Decision |
|---|---|
| Log style | Quick log buttons — 250ml · 500ml · 1L · Custom |
| Daily goal | Customisable — default 2.5L |
| Progress display | Progress bar — current vs goal |
| VALERIE reminders | Push notification at customisable intervals |
| Voice log | "VALERIE, log 500ml of water" |

---

## APIs Used

| API | Purpose | Cost |
|---|---|---|
| ExerciseDB (RapidAPI) | Exercise library with GIF demos | Free — 500 req/day |
| YouTube Data API | Exercise tutorial videos | Free tier |
| Open Food Facts | Food database for nutrition | Free |
| Apple HealthKit | Steps, sleep, heart rate (iOS only) | Free |

---

## Build Notes

- Split nav width: ~120px · same style as Tasks split view
- Stat cards: ring progress using SVG `stroke-dasharray` · value shown inside ring
- Progress bars: `height: 4px` · fill colour follows accent · label shows `current / goal`
- Habit note field: slides down below checked habit · `font-size: 9px` · muted placeholder
- Set logging grid: `grid-template-columns: 30px 1fr 1fr 24px` · Set · Weight · Reps · Tick
- All health data synced via Firebase
- iOS: live Apple Health data · Desktop: synced data from iPhone via Firebase

---

## Body Metrics Section (Eufy Scale via Apple Health)

| Setting | Decision |
|---|---|
| Data source | Eufy Smart Scale → EufyLife app → Apple Health → VALERIE |
| Connection method | Apple Health (HealthKit) — no separate API needed |
| Setup required | Enable Apple Health sync once in EufyLife app settings |
| Cost | Free — covered by existing Apple Health integration |

### Metrics Tracked
- Weight — trend chart over time
- Body fat percentage — trend chart
- Muscle mass — trend chart
- BMI
- Bone mass
- Visceral fat
- Water percentage

### Display
- Body Metrics added as a sixth sub-section in the Health tab nav: Overview · Habits · Nutrition · Workout · Water · Body
- Weight trend chart — line graph, weekly/monthly toggle
- Body composition breakdown — progress rings per metric
- Progress toward user-set body composition goals
- VALERIE verbal updates: *"You're down 1.2kg this month, Rob. Body fat is trending in the right direction."*

### Platform Notes
- iOS: live data read directly from Apple Health
- Desktop/Mac: synced from iPhone via Firebase — same data, slightly delayed

---

## Supplements Section (7th Sub-section)

Health tab nav updated: **Overview · Habits · Nutrition · Workout · Water · Body · Supplements**

| Setting | Decision |
|---|---|
| Layout | List of supplements with daily check-in — same style as Habits section |
| Add supplement | Slides in from right — consistent with all tabs |
| Per supplement | Name · Dose · Frequency (daily/morning/evening/with food) · Colour tag · Restock link |
| Daily log | One-tap tick per supplement · optional note |
| Batch log | "Log all morning supplements" — one tap logs entire morning group |
| Streak tracking | Per supplement — feeds Progress tab streaks and XP |
| Reminders | Push/SMS notification at set times per supplement — managed in Settings → Notifications |
| Voice log | "VALERIE, I took my vitamins" — logs all due supplements at once |
| Weekly chart | Consistency chart per supplement |
| Restock link | When supplement marked as restocked in Essentials — syncs automatically |
| Fully customisable | Add/remove/edit any supplement · toggle section on/off in Settings |
| Synced | Firebase — all supplement data synced across devices |

### VALERIE Integration
- Reminds at set times: *"Time for your morning supplements, Rob"*
- Logs via voice: *"VALERIE, I took my vitamins"*
- Weekly summary: *"You've been consistent on Vitamin D — 7 days straight"*

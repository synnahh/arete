# How data flows between features

Source of truth for "what changes when X comes in". Verified = read in code and unit tested; live = seen against real synced data (none of this has been seen live yet).

## A weigh-in arrives (Eufy scale -> Apple Health -> `health-ingest` -> `body_metrics`)
One row per reading (`healthKey` stops duplicates), appears on every device through the shared collection store.

| Consumer | What it does with it |
|---|---|
| `domain/weight.js` | Smoothed trend, weekly rate, pace vs the goal's weekly target; goal-weight ETA |
| `domain/coachEngine.js` | Real maintenance calories from weight change + intake; auto-adjusts calorie and macro targets (with Undo); asks before switching goal when the target weight is reached; keeps the water goal in step with weight |
| `utils/waterGoal.js`, `domain/water.js` | Daily water goal scales with body weight |
| `domain/strength.js`, `StrengthCard` | Strength Score uses bodyweight ratios |
| `hooks/useOverall.js`, `useRecap.js` | Overall rating pillar, weekly recap, logging streak (a weigh-in counts as a logged day) |
| `hooks/useNextMoves.js` | "Log a weigh-in" move stops once a reading is recent |
| Goal HQ, Coach Today, Body, phone Body | Charts and numbers |

## Sleep arrives (Apple Watch -> `sleep_data`)
Recovery (sleep debt, readiness), Next moves (sleep debt), Train (go-easy day holds weights), Overall, recap, Insights (sleep vs training pattern). A night logged by hand is never overwritten.

## Steps, heart rate, HRV, active energy (`health_sync`)
Steps now drive a Next move (evening, under 60% of the goal; goal is `settings.stepGoal`, default 8,000). Everything else still only shows on the Health overview. Not yet used: active energy in calorie targets (the coach's maintenance estimate already reflects activity through weight change), resting heart rate in readiness, HRV in readiness.

## Food logged
Fuel totals -> Next moves (protein pace), coach maintenance, Overall, streak; ingredients use up Supplies stock (pantry).

## Gaps worth closing next
1. HRV and resting heart rate into the readiness score (the data now arrives).
2. Steps into the Overall rating and the weekly recap.
3. Body fat from the scale into Body charts and the weekly review (stored, little shown).
4. Scale weigh-in -> a "weight logged" toast on the phone when a push lands.

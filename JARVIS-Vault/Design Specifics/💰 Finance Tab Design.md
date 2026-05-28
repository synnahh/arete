# 💰 Finance Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Finance tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split — nav left, content right (consistent with Health tab) |
| Sub-sections | Overview · Spending · Savings · Subscriptions |

---

## Tracking Period

| Setting | Decision |
|---|---|
| Period type | Custom — Rob sets start and end dates |
| Use case | Match to pay cycle or any preferred period |
| Changeable | Yes — update anytime in Settings |

---

## Transaction Entry

| Setting | Decision |
|---|---|
| Style | Quick capture — amount large and centred, category grid below |
| Type selector | Expense / Income toggle at top |
| Amount input | Large prominent number input |
| Category | One-tap category grid — Food · Transport · Subscriptions · Other (customisable) |
| Description | Optional text field |
| Trigger | + button or via Quick Capture from anywhere in the app |
| Voice | VALERIE can log transactions: "Log $84 for groceries" |

---

## Spending Overview

| Setting | Decision |
|---|---|
| Chart style | Both — bar chart and donut side by side |
| Bar chart | Daily spending over the current period |
| Donut chart | Spending broken down by category |
| Colours | Each category has a consistent colour throughout |
| Today's bar | Highlighted / brighter than other bars |

---

## Savings Goals

| Setting | Decision |
|---|---|
| Display style | Milestone tracker per goal |
| Milestones | Set manually per goal — e.g. $2,500 · $5,000 · $7,500 · $10,000 |
| Milestone states | Done (green dot) · Active/in progress (amber dot) · Future (muted dot) |
| Goal fields | Name · Target amount · Target date · Milestones |
| Multiple goals | Yes — add as many as needed |
| VALERIE | Gives verbal savings updates on request |

---

## Subscriptions

| Setting | Decision |
|---|---|
| Display style | List view with renewal dates |
| Total | Monthly and yearly total always visible at top |
| Per subscription | Name · Amount · Billing cycle · Category · Renewal date · Status |
| Status | Active (green dot) · Paused (amber dot) · Cancelled (archived) |
| Renewal warning | Push or SMS notification X days before renewal |
| VALERIE | "You have 6 active subscriptions totalling $94.50 a month" |

---

## Build Notes

- Split nav: same style as Health tab — ~110px wide
- Quick capture amount: `font-size: 20px` · centred · large input feel
- Category grid: `grid-template-columns: repeat(4, 1fr)` · icon + label
- Bar chart: subtle white bars · today highlighted · x-axis day labels
- Donut: SVG `stroke-dasharray` · legend beside it · total in centre
- Milestone dots: green = done · amber = active · muted white = future
- Milestone connector lines: `1px rgba(255,255,255,0.08)`
- Subscription list: icon · name/cycle/due · status dot · amount
- Renewal due soon: amber colour on due date text
- All finance data synced via Firebase

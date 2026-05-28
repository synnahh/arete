# 💬 Assistant Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Assistant tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| Orb position | Large and centred at the top of the tab |
| Chat position | Below the orb, fills the rest of the tab |
| Input bar | Floating, centred, pill shaped — sits above the orb at the bottom |
| Orb at bottom | Small idle orb always visible below the input bar |

---

## Message Style

| Setting | Decision |
|---|---|
| Your messages | Subtle right-aligned bubbles — soft fill, barely visible border |
| VALERIE messages | Full width cards — subtle fill, thin border |
| VALERIE name tag | Small muted label above each card |
| Bubble style | Subtle — not bold or bright, fits the minimal aesthetic |

---

## Thinking Indicator

| Setting | Decision |
|---|---|
| While generating | Orb shifts to thinking state only — no text, no dots |
| Thinking orb state | Particle orbit or rotating arc animation |

---

## Response Card Actions

| Setting | Decision |
|---|---|
| On hover | Copy button appears — nothing else |
| Voice mode | VALERIE always speaks responses — no button needed |
| Text chat mode | Copy button only — read aloud available via voice toggle |

---

## Quick Action Buttons

| Setting | Decision |
|---|---|
| Style | Pinned row of pill-shaped buttons above the floating input bar |
| Default buttons | Daily Brief · Add a task · How am I doing · Focus mode · What's on today |
| Customisable | Yes — add, remove, reorder in Settings |

---

## Conversation History

| Setting | Decision |
|---|---|
| Scroll direction | Newest at the bottom, scroll up for older — like iMessage |
| History stored | Yes — persisted via Firebase, synced across devices |
| Clear conversation | Button available to clear history |

---

## Build Notes

- Orb idle state: slow breathing pulse, soft glow, centred top
- Orb thinking state: particle orbit or rotating arc — distinct from idle/listening/speaking
- User bubble: `background: rgba(255,255,255,0.05)` · `border: 0.5px solid rgba(255,255,255,0.07)` · `border-radius: 10px 10px 3px 10px`
- VALERIE card: `background: rgba(255,255,255,0.03)` · `border: 0.5px solid rgba(255,255,255,0.06)` · `border-radius: 8px`
- Input bar: floating centred pill, 85% width, sits above orb
- Quick action pills: `border-radius: 20px` · subtle fill · muted text
- All transitions cubic-bezier easing

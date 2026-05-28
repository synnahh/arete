# 👗 Style Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Style / Fashion tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Two tabs — Discover and My Board |
| Default tab | Discover |

---

## Discover Tab

| Setting | Decision |
|---|---|
| Occasion buttons | Quick pill buttons at top — Smart Casual · Date Night · Work · Gym · Beach · Evening · Custom |
| Search input | Free text or voice below occasion buttons |
| Search placeholder | "Describe what you want or ask VALERIE…" |
| Microphone button | Sits inside the search bar right side |
| Weather aware | Factors in current local weather automatically |
| Budget filter | Set max spend per outfit or per item |
| AI brain | Claude API generates outfit suggestions and interprets descriptions |
| Image search | Google Custom Search API — finds real products with prices and links |
| Outfit visualisation | Stable Diffusion via Ollama (desktop) · Pollinations.ai (iOS) — both free |

### Outfit Results Display

| Setting | Decision |
|---|---|
| Layout | Individual item cards grid — 3 columns |
| Per card | Item image · name · price · retailer · save button |
| Outfit name | Shown above the grid — e.g. "The Clean Minimal" |
| Total price | Shown beside outfit name |
| Save individually | Each card has its own save button |
| Save all | "Save all" card at end of grid |
| Add item | "+" card to add your own item to the outfit |
| Regenerate | Button to regenerate the full outfit |
| Swap item | Tap any card to swap that item only |

---

## My Board Tab

| Setting | Decision |
|---|---|
| Layout | Split — nav left by category, grid right |
| Nav categories | All · Clothing · Jewellery · Footwear · Accessories · Outfits |
| Item count | Shown beside each category in nav |
| Grid | 2-column card grid per category |

### Item Status Labels

| Status | Colour | Notes |
|---|---|---|
| Wishlist | Blue | Want it, not yet purchased |
| Purchased | Green | Already own it |
| Pass | Muted | Decided against — archived not deleted |

### Item Detail Panel

| Field | Notes |
|---|---|
| Animation | Slides in from right — consistent with all tabs |
| Image | Auto-pulled from search or uploaded manually |
| Name | Editable |
| Category | Editable |
| Price | Auto-pulled or manual entry |
| Status | Wishlist / Purchased / Pass — changeable |
| Shop now | Direct link to retailer — one tap opens product page |
| Link field | Auto-populated from search · paste manually if needed |
| Notes | Free text field |
| Add to Essentials | Option appears when status changed to Purchased |

---

## Style Profile (VALERIE Learns Over Time)

| Feature | Notes |
|---|---|
| Learns preferences | Tracks what you save, purchase, and pass on |
| Style profile | Builds over time — fed into Claude API system prompt |
| Occasion preferences | Learns your go-to style per occasion |
| Budget patterns | Learns your typical spend per category |
| VALERIE suggestions | Gets more personalised with every interaction |

---

## APIs Used

| API | Purpose | Cost |
|---|---|---|
| Google Custom Search API | Find products, images, prices, retailer links | Free — 100 queries/day |
| Claude API | Outfit generation, style advice, search interpretation | Existing API budget |
| Stable Diffusion (Ollama) | Outfit visualisation on desktop | Free — local |
| Pollinations.ai | Outfit visualisation on iOS | Free — online |

---

## Build Notes

- Tab pills: Discover / My Board — same style as filter pills throughout app
- Occasion buttons: pill row below header — scrollable if many
- Search bar: full width pill with microphone icon right side
- Item card: image top · name · price · retailer · status pill · save icon
- Results grid: `grid-template-columns: repeat(3, 1fr)` · gap 6px
- Split nav: same style as Health, Finance, Progress, Lists
- Detail panel: same slide-in animation as all other tabs
- Shop now button: opens external link via browser
- All board data synced via Firebase

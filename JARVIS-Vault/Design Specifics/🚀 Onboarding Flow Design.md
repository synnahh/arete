# 🚀 Onboarding Flow Design — Locked In

> Confirmed by Rob. All decisions finalised for the onboarding flow.
> Last updated: May 2026

---

## Flow Type

| Setting | Decision |
|---|---|
| Style | Structured step-by-step — Option A |
| Steps | 7 steps total |
| Progress indicator | Dot row at top — filled dots = done · elongated dot = active · muted = future |
| Step label | "Step X of 7" shown top right |
| Background | Full screen dark — `#080c14` |
| Skip options | Available on optional steps (API key) |

---

## Step 1 — Welcome

| Element | Notes |
|---|---|
| Orb | Small idle orb — simplified placeholder, NOT the full animated orb |
| Headline | "Welcome." |
| Subline | "I'm VALERIE — your personal AI assistant. Let's get you set up. This takes about 2 minutes." |
| Button | "Get started →" |

---

## Step 2 — Your Name

| Element | Notes |
|---|---|
| Headline | "What do I call you?" |
| Subline | "This is how I'll address you throughout the app. You can change it anytime in Settings." |
| Input | Text field — name or preferred title |
| Button | "Continue →" |

---

## Step 3 — Assistant Name

| Element | Notes |
|---|---|
| Headline | "What's my name?" |
| Subline | "I'm VALERIE by default — but you can call me anything. This can be changed anytime in Settings." |
| Input | Pre-filled with "VALERIE" — editable |
| Primary button | "Keep VALERIE →" |
| Secondary | "Change it" — clears field to type custom name |

---

## Step 4 — API Key (Optional)

| Element | Notes |
|---|---|
| Orb icon | Key icon |
| Headline | "Anthropic API key" |
| Subline | "Optional — paste your key for full AI intelligence. Without it I'll run locally via Ollama. You can add this later in Settings." |
| Input | Masked text field — "sk-ant-… (optional)" |
| Security note | "Your key is stored encrypted on your device and never shared." |
| Primary button | "Continue →" |
| Skip | "Skip for now" |

---

## Step 5 — Voice

| Element | Notes |
|---|---|
| Orb icon | Microphone icon |
| Headline | "Choose my voice" |
| Layout | Two tiers shown on one screen |

**Tier 1 — Azure Neural Voices (recommended)**
- Labelled as "Recommended — high quality, free tier"
- API key field with direct link to sign up at azure.microsoft.com
- Note: "Free up to 500,000 characters/month"
- Activates immediately when key is pasted
- Preview button unlocks when key is entered

**Tier 2 — System voices (free, no setup)**
- Labelled as "Free — no setup required"
- Lists all available system voices with preview button per voice
- Works instantly

**Primary button:** "Continue →"
**Skip:** "Use system voice for now"

**In Settings → Voice (post-onboarding):**
- Azure Neural Voices — API key field · toggle on/off independently
- ElevenLabs — API key field · toggle on/off independently
- Both keys saved simultaneously — toggle between them anytime
- Priority order: ElevenLabs (if toggled on) → Azure (if toggled on) → System (always available)
- Switching to ElevenLabs later: paste key → toggle on → instant switch

---

## Step 6 — Theme

| Element | Notes |
|---|---|
| Orb icon | Palette icon |
| Headline | "Make it yours" |
| Subline | "Choose a theme. Everything can be fine-tuned later in Settings." |
| Layout | Named theme grid — each theme is a complete visual package |

**Themes (to be designed in detail later):**
- Obsidian — deep black, silver accent (default — matches Rob's locked aesthetic)
- Midnight — deep navy, electric blue accent
- Ember — dark charcoal, warm amber/gold accent
- Phantom — near-black, deep purple accent
- Arctic — clean white/light, cool blue accent
- Crimson — deep dark red tones, crimson accent

Each theme is a complete package — background, accent, card fill, sidebar, orb glow — all pre-configured. Fine-tune in Settings → Appearance after.

**Primary button:** "Continue →"

---

## Step 7 — First Greeting

| Element | Notes |
|---|---|
| Orb | Small idle orb — warm subtle glow |
| VALERIE's first words | Spoken aloud AND displayed as text |
| Tone | Warm, confident, premium, a little playful |
| Button | "Enter VALERIE →" — transitions to dashboard |

**VALERIE's exact first greeting:**
> *"Good evening, Rob. Quite the setup you've put together. I'll admit — I'm impressed. Let's make it worth it."*

- Time-of-day aware — "Good morning/afternoon/evening" based on current time
- Name is personalised — uses the name entered in Step 2
- Spoken aloud using the voice selected in Step 5
- After button tap — smooth animated transition into the dashboard

---

## Transitions

| Setting | Decision |
|---|---|
| Between steps | Smooth horizontal slide — current step slides left, next slides in from right |
| Step 7 to dashboard | Fade out onboarding · orb expands · dashboard fades in |
| Animation | cubic-bezier easing throughout |

---

## Build Notes

- Onboarding only shows on first launch — `jarvis_onboarded` flag in localStorage
- All inputs saved to localStorage immediately on entry
- Back button available on all steps except Step 1
- Step 7 greeting dynamically uses Rob's name and current time
- Orb in onboarding is simplified — NOT the full animated voice orb
- Full animated orb debuts on the dashboard after onboarding completes

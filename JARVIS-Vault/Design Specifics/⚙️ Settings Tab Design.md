# ⚙️ Settings Tab Design — Locked In

> Confirmed by Rob. All decisions finalised for the Settings tab.
> Last updated: May 2026

---

## Layout

| Setting | Decision |
|---|---|
| View type | Split — nav left, content right |
| Nav width | ~130px |
| Nav style | Icon + label per section |

---

## Settings Sections (Left Nav Order)

| # | Section | Icon | Notes |
|---|---|---|---|
| 1 | Identity | User | Assistant name, user title, personality |
| 2 | Appearance | Palette | Full theme overhaul |
| 3 | Voice | Microphone | Voice selector, rate, pitch, ElevenLabs/Azure |
| 4 | AI | Brain | Claude API key, Ollama, smart routing, token budget |
| 5 | Notifications | Bell | Full centralised alert control centre |
| 6 | Integrations | Plug | Google Calendar, Spotify, Webhooks, Apple Health |
| 7 | Platforms | Device Mobile | Per-platform tab visibility and layout |
| 8 | API Usage | Chart Bar | Credits, token usage, daily chart, alerts |
| 9 | Shortcuts | Keyboard | Keyboard shortcut customisation |
| 10 | Data | Database | Export data, backup, import |
| 11 | Security | Shield | Password, sign out, account deletion |

---

## Identity Section

| Setting | Notes |
|---|---|
| Assistant name | Changes all labels, voice responses, system prompts instantly |
| What assistant calls you | Name, nickname, title — anything |
| Personality intensity | Professional / Balanced / Casual / Full Character |
| Greeting on launch | On / Off |
| Daily brief time | Set time for morning brief |
| Evening debrief time | Set time for evening debrief |
| Custom system prompt | Personal context VALERIE always knows |

---

## Appearance Section

| Setting | Notes |
|---|---|
| Theme base | Dark / Light / Auto |
| Accent colour | Full colour picker |
| Background style | Time-of-day / Animated gradient / Solid black / Noise texture |
| Font selector | Exo 2 · DM Sans · Orbitron · Sora · Inter · Geist |
| Sidebar style | Icons only (locked — per Rob's choice) |
| Border radius | Slightly rounded (locked — per Rob's choice) |
| Density | Comfortable–compact (locked — per Rob's choice) |
| Glass morphism | Subtle (locked — per Rob's choice) |
| Animation intensity | Full / Reduced / None |
| Orb shape | Sphere / Ring / Diamond / Cube |
| Seasonal themes | Auto / Manual / Off |
| Smart layout | On / Off — dashboard adapts by time of day |
| Holographic cards | On / Off |

---

## Voice Section

| Setting | Notes |
|---|---|
| Voice selector | All system voices listed with live preview |
| Speech rate | Slider 0.5–2.0 |
| Speech pitch | Slider 0.5–2.0 |
| VALERIE speaks responses | On / Off |
| Auto-listen after speaking | On / Off |
| Azure Neural Voices API key | Field — activates when filled |
| ElevenLabs API key | Field — activates when filled |
| Voice priority | ElevenLabs → Azure → System |

---

## AI Section

| Setting | Notes |
|---|---|
| Claude API key | Masked, encrypted storage |
| Ollama model selector | Dynamic list from localhost:11434/api/tags |
| Prefer offline model | Toggle — always use Ollama |
| Smart routing | Auto / Manual |
| Daily token budget | Set limit — VALERIE warns when approaching |
| Auto-switch to Ollama | Toggle — switches when budget hit |
| Custom system prompt | Additional personal context |

---

## Notifications Section

Centralised alert control centre — every tab's alerts in one place.

| Feature | Per Alert Controls |
|---|---|
| Toggle | On / Off |
| Delivery | Push / SMS / Both |
| Timing | When relevant — X min/hours/days before, or at a set time |
| Message | Prewritten template with [variable] placeholders or fully custom text |

**Global settings at top:**
- Twilio SMS phone number
- Default delivery method

**Alert groups (collapsible):**
- Tasks — due reminder · overdue
- Calendar — event reminder · daily agenda
- Health — water · steps · workout · habit end of day
- Finance — subscription renewal · over budget · weekly summary
- Essentials — restock reminder
- Progress — streak at risk · level up · weekly summary
- Daily Brief — morning time · evening time
- Focus — session complete
- Mood — daily check-in reminder

---

## API Usage Section

| Element | Notes |
|---|---|
| Credits remaining | e.g. $8.42 of $15.00 loaded |
| Used this month | Cost + average per day |
| Tokens this month | Input + output combined |
| Daily usage chart | Bar chart — last 14 days |
| Usage by model | Claude Sonnet vs Ollama breakdown |
| Low balance alert | Toggle + custom threshold amount |
| Top up link | Direct link to console.anthropic.com |

---

## Security Section

| Setting | Notes |
|---|---|
| Change master password (Vault) | Re-authentication required |
| Change account password | Re-authentication required |
| Sign out of all devices | Confirmation required |
| Account deletion | Locked behind full re-authentication — enter password + confirmation phrase |
| Data export | Download all data as JSON |
| Active sessions | List of logged-in devices |

**Account deletion flow:**
1. User clicks Delete Account
2. Prompted to re-enter password
3. Prompted to type confirmation phrase: "DELETE MY ACCOUNT"
4. Final confirmation modal with consequences listed
5. Account deleted — irreversible

---

## Build Notes

- Split nav: ~130px · same style as Health, Finance, Progress
- Each settings section renders in the right content panel
- Toggle style: pill toggle · on = accent colour fill · off = muted
- All settings persist to localStorage and Firebase instantly on change
- Keyboard shortcut customisation: list of actions with current shortcut · click to rebind

# 🔢 Complete Feature List

> All 92 features across the entire app. Use this as a reference during the build.

---

## CORE SYSTEM

1. Online AI brain — Claude API (when connected)
2. Offline AI brain — Ollama / Llama 3 (local, no internet needed)
3. Smart routing — simple commands go to Ollama, complex requests go to Claude (saves tokens)
4. Daily token budget — auto-switches to Ollama when limit approached
5. Cross-device sync — Firebase real-time sync across Windows, Mac and iPhone
6. Account system — email/password login, sign in on any device
7. Per-platform tab visibility — choose which tabs show on Windows vs Mac vs iPhone independently

---

## ASSISTANT IDENTITY

8. Fully customisable assistant name — default JARVIS, change anytime, updates everywhere instantly
9. Fully customisable user title — what the assistant calls you, change anytime
10. Personality intensity setting — Professional / Balanced / Casual / Full Character
11. Contextual greetings — Good morning / afternoon / evening based on time of day
12. Persistent memory — references previous conversations where relevant
13. Custom system prompt — add personal context the assistant always knows

---

## VOICE SYSTEM

14. Voice input — speak to the assistant, live transcription as you talk
15. Voice output — assistant speaks every response aloud (toggleable)
16. Voice selector — choose from all available system voices
17. Speech rate and pitch sliders
18. Azure Neural Voices support — free tier, high quality upgrade
19. ElevenLabs support — premium voice, most natural option
20. Voice orb — animated visual heart of the assistant
21. Audio visualiser — real-time waveform reacting to assistant speech
22. Customisable keyboard shortcut to activate voice (default: hold Space)
23. Continuous listening mode toggle

---

## DASHBOARD

24. Live clock — large, styled
25. Weather widget — live, cached for offline
26. Daily quote widget — Bible verse / Daily Stoic / none
27. Quick-glance widgets — today's tasks, notes, upcoming events
28. Recent activity feed
29. All widgets drag-to-reorder and individually toggleable

---

## TABS & MODULES

30. AI Assistant tab — full chat interface, voice orb, conversation history, quick-action buttons
31. Tasks tab — add, edit, delete, complete, priority, due dates, categories, filters
32. Notes tab — create, edit, delete, search, pin
33. Calendar tab — monthly and day view, Google Calendar full integration, voice commands
34. Health & Fitness tab — steps, sleep, heart rate, workouts (live iOS, synced desktop)
35. Macro & Nutrition Tracker — food log, database search, QR scanner, macro targets, weekly summary
36. Stimulant Tracker — nicotine and caffeine, custom types, daily limits, warnings, trends
37. Finance Tracker — income, expenses, savings goals, weekly/monthly summaries, profit/loss
38. Subscription Tracker — inside Finance, full subscription log, renewal alerts, yearly total
39. Files tab — full OS access on desktop, simulated in artifact phase
40. Style / Fashion Mood Board — AI search, image upload, save to board, wishlist/purchased status
41. Essentials / Restock Tracker — lifespan tracking, auto restock date, traffic light status, alerts
42. Progress & Achievement tab — habit streaks, XP/levels, goal tracking, full weekly stats
43. Daily Brief — spoken + visual morning summary, fully customisable, voice triggerable
44. Focus Mode — distraction-free timer, Pomodoro or custom, DND, ambient sound, logs to Progress
45. Reading / Watch List — books, shows, films, podcasts, AI auto-enriches, status tracking
46. Mood Tracker — 5-second daily check-in, weekly chart, JARVIS correlates with health data
47. Quick Capture — universal floating input, JARVIS routes to correct module automatically

---

## NOTIFICATIONS

48. Push notifications — Firebase, free, all devices, deep-links into app
49. SMS reminders — Twilio optional, critical alerts only
50. Per-feature notification toggles — tasks, calendar, restock, subscriptions, macros, stimulants, finance
51. Per-reminder choice — push only / SMS only / both

---

## SETTINGS & CUSTOMISATION

52. Full theme overhaul — Dark / Light / Auto
53. Accent colour picker — propagates everywhere including the orb
54. Background style — Solid / Gradient / Animated / Noise / Custom hex
55. Font selector — curated premium Google Fonts
56. Sidebar style — Expanded / Icon only / Hidden
57. Border radius — Sharp / Rounded / Pill
58. Density — Compact / Comfortable / Spacious
59. Glass morphism toggle
60. Animation intensity — Full / Reduced / None
61. Google Calendar OAuth connect/disconnect
62. Apple Health sync status
63. Launch on startup (Windows/Mac)
64. Greeting on launch toggle
65. Sound effects toggle
66. Keyboard shortcut customisation
67. Security — change password, sign out all devices, export data, delete account

---

## WINDOWS DESKTOP SPECIFIC

68. Launches on Windows startup, greets by name
69. Runs in system tray when minimised
70. Dynamic desktop wallpaper — changes based on time, weather, or schedule
71. Desktop overlay widgets — clock, tasks, weather, assistant status — draggable
72. Full OS file and folder access via voice
73. Launch applications via voice command
74. OS-level Do Not Disturb during Focus Mode

---

## iOS SPECIFIC

75. Full voice assistant (Claude API, always online)
76. Face ID / Touch ID authentication
77. Apple Health integration — steps, sleep, heart rate, workouts
78. Camera QR/barcode scanner for macro tracker
79. Home screen widget — customisable content
80. Lock screen widget — Bible verse / Daily Stoic / calendar agenda
81. Sideloading support — AltStore free or Apple Developer account

---

## MAC SPECIFIC

82. macOS menu bar integration
83. Spotlight-style quick command launcher
84. Same Firebase sync as Windows and iOS

---

## ONBOARDING

85. Animated first launch welcome
86. Account creation / sign in
87. Set your preferred name and title
88. Set the assistant's name
89. Claude API key entry (skippable)
90. Voice selector with live preview
91. Theme and accent colour picker
92. Platform tab setup

---

## BATCH 2 FEATURES

### New Modules
93. JARVIS Evening Debrief — end of day summary, completed tasks, tomorrow preview, mood prompt
94. Password Vault — AES-256 encrypted, local only, never synced, master password, auto-lock, breach check
95. Webhook Support — Zapier/Make integration, custom trigger events, fits in Settings → Integrations
96. JARVIS Personal Context Engine — learns your patterns over time, "What JARVIS knows" screen in Settings
97. Spotify Integration — OAuth connect, now-playing dashboard widget, mood-based playback, voice control
98. Meal Planner — weekly meal planning, macro pre-fill, recipe library, Claude-generated suggestions
99. Shopping List — auto-generated from meal plan, manual add, tick off as purchased, voice readable
100. Habit Tracker — custom habits, daily check-in, feeds Progress streaks and XP, completion rings
101. Water Tracker — daily goal, quick log buttons, JARVIS reminders, voice log
102. AI Workout Planner — Claude-generated personalised splits, progressive overload tracking, strength charts

### Design System Additions
103. Animated time-of-day background — dawn / day / dusk / night gradual transitions
104. JARVIS thinking particle effect — orbiting/radiating particles while Claude processes
105. Smart layout — dashboard adapts morning / afternoon / evening / night
106. Custom orb shapes — Sphere / Ring / Diamond / Cube / Custom SVG
107. Holographic card effect — 3D tilt + light reflection on hover
108. Seasonal themes — auto-shifts palette by season, hemisphere aware
109. Minimal mode — strips to orb + one widget, voice activated

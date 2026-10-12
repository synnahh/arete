# Health sync checklist: scale, Fitbit Air and iPhone into Arete

Goal: your Eufy scale and Fitbit Air readings arrive in Arete by themselves, with no typing and no tapping.

```
Eufy scale  -> EufyLife app  --\
                                 >-> Apple Health -> Health Auto Export -> health-ingest (Supabase) -> Arete
Fitbit Air  -> Google Health app -/
```

Every box below is a step only you can do (accounts, the phone, secrets). Each has the exact command or setting. Do them in order. Do not paste the token into chat.

Project: `jwzgxcqapxaomuenleyt` (the Arete Supabase project). Windows commands are PowerShell, run from `D:\Work\Projects\Projects\VALERIE-MAKEOVER`.

---

## A. Supabase (about 10 minutes)

- [ ] **A1. Create the table.** Supabase dashboard > SQL Editor > New query. Paste the whole of `supabase/health_sync.sql` and Run. Safe to run twice. Afterwards run this and expect one row of `true`:
  ```sql
  select relrowsecurity from pg_class where relname = 'health_sync';
  ```
- [ ] **A2. Make sure `user_meta` exists with realtime** (needed for settings to follow you between devices): run `supabase/user_meta.sql` the same way if you have not.
- [ ] **A3. Find your user id.** Dashboard > Authentication > Users > click your user > copy the UUID. Not a secret, but do not post it publicly.
- [ ] **A4. Make a token** (a long random password that only the phone and the function know). In PowerShell:
  ```powershell
  $b = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
  ```
  It prints 64 characters. Copy it into your password manager now. You need it twice (A5 and C3). Never put it in the repo, in Obsidian, or in chat.
- [ ] **A5. Store the secrets.** Dashboard > Edge Functions > Secrets, add:
  - `HEALTH_INGEST_TOKEN` = the token from A4
  - `OWNER_USER_ID` = the UUID from A3 (skip if already set for the other functions)

  Or from PowerShell (logs the token into your shell history, so the dashboard is safer):
  ```powershell
  npx supabase login
  npx supabase link --project-ref jwzgxcqapxaomuenleyt
  npx supabase secrets set HEALTH_INGEST_TOKEN=<token> OWNER_USER_ID=<uuid>
  ```
- [ ] **A6. Deploy the function with JWT verification OFF.** The phone cannot sign in, so the token is its key. This is the one function in this project that is deployed this way.
  ```powershell
  npx supabase functions deploy health-ingest --no-verify-jwt --use-api --project-ref jwzgxcqapxaomuenleyt
  ```
  (`--use-api` means no Docker needed.) The URL is `https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/health-ingest`.

## B. Prove it works from your computer (before touching the phone)

- [ ] **B1. A wrong token must be refused:**
  ```powershell
  curl.exe -s -X POST https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/health-ingest -H "x-health-token: wrong" -d "{}"
  ```
  Expect `{"error":"Not allowed"}`.
- [ ] **B2. The real token with an empty body must be accepted:**
  ```powershell
  curl.exe -s -X POST https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/health-ingest -H "x-health-token: <token>" -d "{}"
  ```
  Expect `{"ok":true,"days":0,"weighIns":0,"sleepNights":0}`. `503` means a secret is missing (A5). `404` means the deploy did not happen (A6).
- [ ] **B3. Send the sample** (a made-up day, 15 Jan 2026: 5,500 steps, one 71.2 kg weigh-in at 19.4% body fat, one night of 6.9 h sleep):
  ```powershell
  curl.exe -s -X POST https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/health-ingest -H "x-health-token: <token>" -H "Content-Type: application/json" --data-binary "@docs/health-ingest-sample.json"
  ```
  Expect `{"ok":true,"days":1,"weighIns":1,"sleepNights":1}`. Send it a second time: `weighIns` must be `0` (re-sending is safe, nothing doubles).
- [ ] **B4. Delete the test data.** It is fake and would sit in your real history. SQL Editor:
  ```sql
  delete from health_sync  where sync_date = '2026-01-15';
  delete from body_metrics where data->>'healthKey' like 'ah:2026-01-15%';
  delete from sleep_data   where data->>'date' = '2026-01-15' and data->>'source' = 'apple-health';
  ```

## C. iPhone: make it automatic

The three apps do the hand-offs. Apple does not allow any app to read Health while the phone is locked, so "automatic" means "runs by itself whenever the phone has been unlocked recently", not "runs at 3 am on a locked phone". The settings below make that as tight as iOS allows.

- [ ] **C1. EufyLife (scale):** Settings > turn on Apple Health sharing, allow Weight and Body Fat. Weigh in once and open the app so it writes. Keep EufyLife's Background App Refresh on (iOS Settings > General > Background App Refresh).
- [ ] **C2. Google Health (Fitbit Air):** update to version 5.05 or later. Connect the Fitbit Air. Then Profile (or Connections) > Apps and services > Apple Health > allow Steps, Heart Rate, Sleep, Exercise, Distance. Use the same Google account the Fitbit uses. Background App Refresh on. (HRV is not passed to Apple Health by Google, so it will not appear.)
- [ ] **C3. Health Auto Export (the courier):** install it and unlock Premium (the background automations need it; check the price in the app before buying). Then Automations > New > **REST API**:
  - URL: `https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/health-ingest`
  - Method: POST, format JSON (v2)
  - Header: `x-health-token` = the token from A4
  - Metrics to include: Step Count, Active Energy, Heart Rate, Resting Heart Rate, Heart Rate Variability, Respiratory Rate, Blood Oxygen Saturation, Weight and Body Mass, Body Fat Percentage, Sleep Analysis
  - Date range: the widest short range it offers (for example the last 7 days). The function ignores anything it already has, so overlap is free and a missed run is repaired by the next one.
  - Summarize data: on. Aggregate/sync interval: as short as it allows (15 to 60 minutes is realistic; iOS treats it as a target, not a promise).
- [ ] **C4. Let iOS run it.** iOS Settings > General > Background App Refresh: on, and on for Health Auto Export, EufyLife and Google Health. Turn Low Power Mode off (it blocks background runs). Add the Health Auto Export **Automations widget** to the Home Screen: it gives iOS a reason to run the sync, and one look at it shows the last run.
- [ ] **C5. Avoid double-counted steps.** If your iPhone and the Fitbit both write steps, Apple Health keeps one source per minute. In the Health app: Browse > Activity > Steps > Data Sources & Access > Edit, and drag **Google Health** above iPhone, so the Fitbit wins.
- [ ] **C6. First run by hand.** In Health Auto Export open the automation and tap Run/Sync once, with the phone unlocked. It should report success.

## D. Confirm it in Arete

- [ ] **D1.** Open Profile > Sync check. The health line should say "Health data: arrived today, N steps". If it says nothing has arrived, see "If it does not arrive".
- [ ] **D2.** Step on the Eufy scale. Within the hour (phone unlocked at some point) Coach > Body shows the weigh-in with body fat, with no typing.
- [ ] **D3.** Next morning: Recover shows last night's sleep from the Fitbit Air, and Home > Next moves shows the sleep and step lines.
- [ ] **D4.** The weigh-in should appear on the other device too (Profile > Sync check > Compare with the cloud: Weigh-ins "same").

## If it does not arrive

| What you see | Likely cause | Fix |
|---|---|---|
| Health Auto Export says 401 | token differs between the phone and A5 | re-enter it on the phone, check for a trailing space |
| 503 | `HEALTH_INGEST_TOKEN` (needs 16+ characters) or `OWNER_USER_ID` not set | A5 |
| 404 | function not deployed | A6 |
| 200 and `days:0` | metrics not selected, or the date range had no data | C3 metrics and date range |
| Weighed in, nothing in Arete | EufyLife has not written to Apple Health yet | open EufyLife once; check Health > Sharing |
| Fitbit data missing | Google Health is not connected to Apple Health, or is older than 5.05 | C2 |
| Worked for a day then stopped | iOS did not get a chance to run it | C4, then open the Automations widget |
| Sleep shows only duration | Fitbit sleep reaches Apple Health as a plain night, not stages | expected |

## What is stored and what is not

- Daily steps, active energy, heart rate (average, minimum, maximum), resting heart rate, HRV, respiratory rate, blood oxygen go to `health_sync`, one row per day, and Home and Next moves read them.
- Each weigh-in goes to `body_metrics` as its own row (source `apple-health`), so it shows in Body, the weight trend and the coach engine.
- Each night of sleep goes to `sleep_data` (source `apple-health`). A night you logged by hand is never overwritten.
- Fitbit-only measures (active zone minutes, skin temperature, stress) do not go through Apple Health and are not stored. Say if you want any of them, and what they would be used for.

## Security notes

- The function accepts only your token (constant-time compare) and writes only for your user id. The token lives in Supabase secrets and in the phone, nowhere else.
- If the phone is lost or the token leaks: generate a new token (A4), run A5 again, update the phone (C3). The old one stops working at once.
- Health Auto Export sends your health data to your own Supabase project only. It never goes to a third-party server.

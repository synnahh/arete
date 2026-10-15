# Push notifications setup (replaces SMS)

Arete sends short reminders to your iPhone at the times you choose in **Profile > Reminders**, even when the app is closed. No phone number, no Twilio, no per-message cost. It uses Web Push (free) and a Supabase function that runs every 5 minutes.

```
Profile > Reminders (your times)  ->  settings (synced)
Supabase cron, every 5 min  ->  push-send function  ->  Apple's push service  ->  your iPhone
```

Needs: iPhone on iOS 16.4 or later, with Arete **added to the Home Screen** (Safari > Share > Add to Home Screen) and opened from that icon. Safari tabs cannot receive push on iPhone.

Do these once. Windows commands are PowerShell, run in `D:\Work\Projects\Projects\VALERIE-MAKEOVER`. Never paste the private key or the cron token into chat, notes or git.

## 1. Make the keys

```powershell
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. The public one is safe to ship in the app. The private one is a secret.

Also make a cron token (any long random string):

```powershell
$b = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
```

## 2. Store the secrets and deploy the function

Dashboard > Edge Functions > Secrets (or `npx supabase secrets set ...`). Add:

| Secret | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:` plus your email, e.g. `mailto:you@example.com` |
| `PUSH_CRON_TOKEN` | the cron token |
| `OWNER_USER_ID` | your user id (already set if health sync works) |

Deploy (JWT verification stays ON; the cron job passes the project's public anon key):

```powershell
npx supabase functions deploy push-send --use-api --project-ref jwzgxcqapxaomuenleyt
```

## 3. Put the public key in the app and redeploy

Add one line to `.env` (the file is gitignored; save it as UTF-8 **without** BOM):

```
VITE_VAPID_PUBLIC_KEY=<the public key>
```

Then rebuild and redeploy the website:

```powershell
npm run build:pwa
```

Drag the `dist` folder onto the Netlify site (`arete-dash.netlify.app`) as before. Reopen Arete from the Home Screen icon (close it fully first so the new version loads).

## 4. Start the schedule

Open `supabase/push.sql`, replace `<ANON_KEY>` (Dashboard > Project Settings > API > anon public) and `<PUSH_CRON_TOKEN>` (the same token as the secret), and run it in the SQL Editor. Don't commit your edited copy.

Check it is running:

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'arete-push';
```

## 5. Turn it on in the app

Profile > Reminders > **Turn on** > Allow. Then **Send a test**: a notification should arrive within seconds. Adjust times, days and wording under each reminder; the standard set is Morning plan 07:30, Water 12:30, Training 17:00 (off), Log your food 19:30, Wind down 21:30, Weekly check-in Monday 07:00. Quiet hours (default 22:00 to 06:30) hold anything inside them back.

## If something does not arrive

| Symptom | Cause | Fix |
|---|---|---|
| Turn on says "no push key" | app built without `VITE_VAPID_PUBLIC_KEY` | step 3, rebuild, redeploy |
| "Only works from the Home Screen app" | opened in Safari | Share > Add to Home Screen, open from the icon |
| Allow prompt never appears / "blocked" | permission denied once | iPhone Settings > Notifications > Arete > Allow |
| Test says no device | subscription not saved | Turn off, then on again (signed in) |
| Test works, scheduled ones don't | cron not scheduled, or wrong token/anon key | step 4; `SELECT status, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;` |
| 401 in the cron results | `<ANON_KEY>` wrong | use the anon public key |
| 403/401 "Not allowed" | `x-cron-token` differs from `PUSH_CRON_TOKEN` | make them identical |
| A reminder never fires | its time is inside quiet hours, the day isn't ticked, or the time zone differs | check those; times use the phone's zone shown under the list |

Each reminder is sent once a day, within 10 minutes of its time (the cron runs every 5). The old in-app time-based reminders stop while this is on, so nothing arrives twice.

## Cost and privacy

Web Push and Supabase cron are free at this volume. Notification text is whatever you wrote; it is stored in your own Supabase project and sent via Apple's push service to your device only. Your health data is never in a notification.

# Arete — go-live steps that need your accounts

**Status 2026-10-01.** The app now points at the NEW Supabase project `jwzgxcqapxaomuenleyt` (org Arete); the old, paused project `ywpwwxtimnqqruwxlpjb` (org Valerie) still holds the previous data and is untouched. Already done on the new project: the three SQL files (50 tables with owner-only policies and realtime, the private `progress-photos` bucket, the `user_meta` unique index), the `ai-chat` function deployed (Verify JWT on), and the `ANTHROPIC_MODEL` secret. Still yours: the Anthropic key secret (step 1 and 2), creating your sign-in account, `OWNER_USER_ID`, turning off public sign-ups, and the Netlify environment variables (step 4).

These cannot be done from the coding session (no Supabase login, no database credentials, and API keys must not be moved by tooling). Each takes a minute. Do them in order.

## 1. New API keys
The keys that were in `.env` (`VITE_CLAUDE_API_KEY`, `VITE_ELEVENLABS_API_KEY`) must be treated as exposed.
- Anthropic console: create a new key, delete the old one.
- ElevenLabs: the app no longer has a voice, so delete that key in ElevenLabs (and the account, if you don't use it elsewhere).
- Remove both lines from `.env`. The app no longer reads either; the AI tools go through the `ai-chat` function.

## 2. Deploy the AI tools function (Supabase project `jwzgxcqapxaomuenleyt`)
Arete has no chat assistant. `ai-chat` only runs the tools that read your input: meal photo, describe a meal, skin photo, the weekly and monthly reviews, Mind insights, and the meal-plan and day-plan generators.
```bash
npx supabase login
npx supabase link --project-ref jwzgxcqapxaomuenleyt
npx supabase secrets set ANTHROPIC_API_KEY=<the new key> ANTHROPIC_MODEL=claude-sonnet-5-5
npx supabase functions deploy ai-chat
```

### 2a. Lock the functions to your account (do this)
Anyone who can create an account on the Supabase project would count as "signed in". Turn off public sign-ups (Authentication > Providers > Email > disable new sign-ups, once your own account exists) and set your user id as the owner:
```bash
npx supabase secrets set OWNER_USER_ID=<your user uuid from Authentication > Users>
```
Both functions then answer 403 to everyone else. Never deploy with `--no-verify-jwt`.

### 2b. Text messages (optional, takes the Twilio details out of the app)
`send-sms` holds the Twilio credentials in Supabase instead of app settings, and can only text your own number.
```bash
npx supabase secrets set TWILIO_ACCOUNT_SID=<sid> TWILIO_AUTH_TOKEN=<token> SMS_TO=+61XXXXXXXXX TWILIO_FROM_REMINDERS=+1XXXXXXXXXX
npx supabase functions deploy send-sms
```
`TWILIO_FROM_SENTRY` is an optional second sender. Then switch on Settings > Notifications > Text messages and clear the Twilio SID and token fields there.

If you deployed `voice-tts` earlier, remove it: `npx supabase functions delete voice-tts`.

## 3. Database
Open the Supabase dashboard > SQL editor and run, one after the other:
1. `supabase/user_meta.sql`
2. `supabase/progress_photos.sql` (creates the private `progress-photos` bucket and its owner-only policies)

## 4. Netlify
Set `VITE_SUPABASE_URL=https://jwzgxcqapxaomuenleyt.supabase.co` and `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API Keys > Legacy > anon) in the site environment variables. Never add an Anthropic or ElevenLabs key there.

`netlify.toml` was reviewed: the Content-Security-Policy allows Supabase (HTTPS + realtime WebSocket) and the Open Food/Beauty Facts APIs, and the camera is allowed for the app's own origin. Deploy, then open the site once and check the browser console for "Refused to connect" messages.

## 5. Check on a phone (5 minutes)
- Fuel: Photo and Describe a meal.
- Look > Skin: Skin photo analysis, Check a product with a typed barcode.
- Home and Goal HQ: Coach updates appear once you have two weeks of weigh-ins and food logged on your goal.
- Settings > Notifications: turn on and save, then check the morning/evening check-ins appear.
- Sign in on a second device with the same account: log water on one, watch it appear on the other.

## Health sync (Apple Health and the Eufy scale)

Eufy has no public API, so the route is EufyLife -> Apple Health -> Health Auto Export -> `health-ingest`.

1. Supabase SQL Editor: run `supabase/health_sync.sql`.
2. Secrets (Edge Functions > Secrets): `HEALTH_INGEST_TOKEN` (a long random string, 32+ characters) and `OWNER_USER_ID` (already set for the other functions).
3. Deploy `health-ingest` with JWT verification **off** (the phone app cannot sign in): `supabase functions deploy health-ingest --no-verify-jwt`, or turn "Verify JWT" off for it in the dashboard.
4. On the iPhone: EufyLife > turn on Apple Health sharing. Health Auto Export > Automations > REST API: URL `https://<project>.supabase.co/functions/v1/health-ingest`, POST, JSON v2, header `x-health-token: <the secret>`, date range Today, summarize data on.
5. Check: `curl -X POST <url> -H "x-health-token: <secret>" -d '{}'` returns `{"ok":true,"days":0,...}`. A wrong token returns 401.

### Fitbit Air (added 2026-10-12)
Route: Fitbit Air -> Google Health app -> Apple Health -> Health Auto Export -> `health-ingest` (the same pipe as the Eufy scale). Google Health 5.05 and later writes steps, distance, heart rate, sleep and exercise to Apple Health (HRV is not passed on). In Google Health: Profile or Connections > Apps and services > Apple Health, and sign in with the same Google account the Fitbit uses. In Health Auto Export, add the Fitbit-sourced metrics to the same REST automation. The direct Google Health API (`health.googleapis.com/v4`) is NOT used: Google is not onboarding new projects, all its scopes are restricted, and a testing-mode OAuth app loses its refresh token every 7 days. The legacy Fitbit Web API is switched off on 2026-10-30.

### Checking sync between devices
Profile > Sync check on both devices: Send test ping on one and watch the other receive it without a refresh (it shows the delay); Compare with the cloud lists row counts per kind of data against what this device holds. Settings and documents (exercise library, steps, skin steps) now follow changes live as well as the collections.


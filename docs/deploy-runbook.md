# Arete — go-live steps that need your accounts

These cannot be done from the coding session (no Supabase login, no database credentials, and API keys must not be moved by tooling). Each takes a minute. Do them in order.

## 1. New API keys
The keys that were in `.env` (`VITE_CLAUDE_API_KEY`, `VITE_ELEVENLABS_API_KEY`) must be treated as exposed.
- Anthropic console: create a new key, delete the old one.
- ElevenLabs: the app no longer has a voice, so delete that key in ElevenLabs (and the account, if you don't use it elsewhere).
- Remove both lines from `.env`. The app no longer reads either; the AI tools go through the `ai-chat` function.

## 2. Deploy the AI tools function (Supabase project `ywpwwxtimnqqruwxlpjb`)
Arete has no chat assistant. `ai-chat` only runs the tools that read your input: meal photo, describe a meal, skin photo, the weekly and monthly reviews, Mind insights, and the meal-plan and day-plan generators.
```bash
npx supabase login
npx supabase link --project-ref ywpwwxtimnqqruwxlpjb
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
`netlify.toml` was reviewed: the Content-Security-Policy allows Supabase (HTTPS + realtime WebSocket) and the Open Food/Beauty Facts APIs, and the camera is allowed for the app's own origin. Deploy, then open the site once and check the browser console for "Refused to connect" messages.

## 5. Check on a phone (5 minutes)
- Fuel: Photo and Describe a meal.
- Look > Skin: Skin photo analysis, Check a product with a typed barcode.
- Home and Goal HQ: Coach updates appear once you have two weeks of weigh-ins and food logged on your goal.
- Settings > Notifications: turn on and save, then check the morning/evening check-ins appear.
- Sign in on a second device with the same account: log water on one, watch it appear on the other.

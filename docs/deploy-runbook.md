# Arete — go-live steps that need your accounts

These cannot be done from the coding session (no Supabase login, no database credentials, and API keys must not be moved by tooling). Each takes a minute. Do them in order.

## 1. New API keys
The keys that were in `.env` (`VITE_CLAUDE_API_KEY`, `VITE_ELEVENLABS_API_KEY`) must be treated as exposed.
- Anthropic console: create a new key, delete the old one.
- ElevenLabs: regenerate the key. (Voice calls still use the client key until they are moved to a server function; see HANDOVER-CODEX.md.)
- Remove `VITE_CLAUDE_API_KEY` from `.env`. The app no longer uses it; the AI goes through the `ai-chat` function.

## 2. Deploy the AI gateway (Supabase project `ywpwwxtimnqqruwxlpjb`)
```bash
npx supabase login
npx supabase link --project-ref ywpwwxtimnqqruwxlpjb
npx supabase secrets set ANTHROPIC_API_KEY=<the new key> ANTHROPIC_MODEL=claude-sonnet-5-5
npx supabase functions deploy ai-chat
```
This one deploy carries everything added since it was last deployed: photo input (meal scan, skin photo) and the coaching brief.

### 2a. Lock the functions to your account (do this)
Anyone who can create an account on the Supabase project would count as "signed in". Turn off public sign-ups (Authentication > Providers > Email > disable new sign-ups, once your own account exists) and set your user id as the owner:
```bash
npx supabase secrets set OWNER_USER_ID=<your user uuid from Authentication > Users>
```
All three functions then answer 403 to everyone else. Never deploy with `--no-verify-jwt`.

### 2b. Voice and text messages (optional, takes the keys out of the app)
These two functions hold the ElevenLabs and Twilio credentials in Supabase instead of the app. The app uses them when they exist and falls back to the old settings when they do not.
```bash
npx supabase secrets set ELEVENLABS_API_KEY=<new key> ELEVENLABS_VOICE_ID=<voice id>
npx supabase secrets set TWILIO_ACCOUNT_SID=<sid> TWILIO_AUTH_TOKEN=<token> SMS_TO=+61XXXXXXXXX TWILIO_FROM_REMINDERS=+1XXXXXXXXXX
npx supabase functions deploy voice-tts
npx supabase functions deploy send-sms
```
`SMS_TO` is your own number: the function can only ever text that number. `TWILIO_FROM_SENTRY` is an optional second sender. Then switch on Settings > Notifications > Text messages. Once voice works, delete the ElevenLabs key from Settings and `.env` (`VITE_ELEVENLABS_API_KEY`) and clear the Twilio SID and token fields.

## 3. Database
Open the Supabase dashboard > SQL editor and run, one after the other:
1. `supabase/user_meta.sql`
2. `supabase/progress_photos.sql` (creates the private `progress-photos` bucket and its owner-only policies)

## 4. Netlify
`netlify.toml` was reviewed: the Content-Security-Policy now allows Supabase (HTTPS + realtime WebSocket) and the Open Food/Beauty Facts APIs, and the camera is allowed for the app's own origin. Deploy, then open the site once and check the browser console for "Refused to connect" messages.

## 5. Check on a phone (5 minutes)
- Fuel: Photo and Describe a meal.
- Look > Skin: Skin photo analysis, Check a product with a typed barcode.
- Settings > Notifications: turn on and save, then check the morning/evening coach check-ins appear.
- Sign in on a second device with the same account: log water on one, watch it appear on the other.

# Services and costs: what Arete needs, what is set up, what it costs

Checked 2026-10-14. Prices are from the vendors' pages or reports of them found that day, in the currency each vendor quotes (mostly USD). Vendors change prices: check the "confirm" link before paying. Nothing here is a quote.

## What is actually deployed (tested 2026-10-14)

I called each function on the live project (`jwzgxcqapxaomuenleyt`) without credentials. A 404 means "not deployed".

| Function | Result | Meaning |
|---|---|---|
| `ai-chat` | 401, missing authorization | Deployed and locked to a signed-in user. Works once the Anthropic key secret is set. |
| `send-sms` (Twilio) | **404** | **Not deployed. Text messages cannot work yet.** |
| `health-ingest` (Eufy, Fitbit Air) | **404** | **Not deployed. No health data can arrive yet.** |
| `food-search` (online food lookup) | **404** | Not deployed. Food search still works from the bundled 18,800-food packs; only the online top-up is missing. |

## The setup, in order

Everything below needs your accounts, so only you can do it. Do not paste tokens into chat.

### 1. Twilio: reset up and confirm
Already built: `supabase/functions/send-sms` holds the Twilio details in Supabase secrets and can only text your own number. The Settings "Send test SMS" button now uses it (the older path that kept the Twilio details in the app is only a fallback, and it fails in a browser anyway).

1. Twilio console: sign in (or make an account). Note **Account SID** and **Auth Token**.
2. Get a sender. **Australia has a catch**: from 1 July 2026 a text-only sender name (alphanumeric ID) must be registered with ACMA and needs an ASIC business extract, so for one person use a **Twilio mobile number** (the monthly rental below) as the sender instead.
3. **Trial account**: it can only text numbers you have verified in the console, and cannot use sender names. Fine for testing to your own phone; upgrade (add credit) to remove the limit.
4. Set the secrets (PowerShell, from the repo folder). Use your own numbers in E.164 form (`+61...`):
   ```powershell
   npx supabase login
   npx supabase link --project-ref jwzgxcqapxaomuenleyt
   npx supabase secrets set TWILIO_ACCOUNT_SID=<sid> TWILIO_AUTH_TOKEN=<token> SMS_TO=+61XXXXXXXXX TWILIO_FROM_REMINDERS=+1XXXXXXXXXX OWNER_USER_ID=<your-user-uuid>
   npx supabase functions deploy send-sms --use-api --project-ref jwzgxcqapxaomuenleyt
   ```
   Leave JWT verification on (do not use `--no-verify-jwt`).
5. In the app: Settings > Notifications > turn on "Send reminders as texts", clear the old Twilio SID and token fields, press **Send test SMS**. The text arriving on your phone is the confirmation.
6. **Confirm without the app** (expect 401, not 404, which proves it is deployed and locked):
   ```powershell
   curl.exe -s -o NUL -w "%{http_code}" -X POST https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/send-sms -d "{}"
   ```
   I could not do steps 1 to 5 for you: they need your Twilio account and secrets. Until you do, the answer to "is Twilio confirmed?" is **no, it is not deployed**.

### 2. Eufy scale and Fitbit Air: reset up
The full checklist with every command is `docs/health-ingest-checklist.md`. The chain:

```
Eufy scale -> EufyLife app --\
                              >-> Apple Health -> Health Auto Export -> health-ingest (Supabase) -> Arete
Fitbit Air -> Google Health --/
```

Short version: run `supabase/health_sync.sql`; make a long random token; set secrets `HEALTH_INGEST_TOKEN` and `OWNER_USER_ID`; deploy with
```powershell
npx supabase functions deploy health-ingest --no-verify-jwt --use-api --project-ref jwzgxcqapxaomuenleyt
```
then set up the three phone apps (checklist section C) and confirm with Profile > Sync check.

New this session: any metric Health Auto Export sends that Arete has no field for (VO2 max, distance, flights and so on) is now kept and shows as its own tile on Home > Metrics, so **redeploy `health-ingest`** when you deploy it the first time.

Facts that matter (from the sources at the end):
- The Fitbit Air is a screenless band. Google Health (the renamed Fitbit app) can now sync to Apple Health on iPhone (iOS 16.4+, app 5.05+): steps, distance, heart rate, sleep and more. **HRV does not transfer.**
- The EufyLife app writes weight and body fat to Apple Health. The scale can send over Wi-Fi, so your phone need not be nearby.
- Apple Health can only be read by an app on the phone itself, which is why Health Auto Export is in the chain. iOS runs it in the background when the phone has been unlocked recently, not at 3 am on a locked phone.

### 3. Other services, already in use
- **Supabase**: the database, login, photo storage and all the functions above.
- **Netlify**: hosts the app (`arete-dash.netlify.app`).
- **Anthropic API**: meal photo, describe-a-meal, skin photo and reviews (through `ai-chat`). Needs a new `ANTHROPIC_API_KEY` secret (the old key was exposed and must be rotated).
- **USDA FoodData Central key (free, optional)**: for the online `food-search` top-up.

## Cost list

| Item | Needed? | Cost | Notes |
|---|---|---|---|
| **Fitbit Air** | You have it / want it | about US$99.99 (US$129.99 special edition); prices vary by seller | Basic tracking works without a subscription. |
| Google Health Premium | No | US$9.99 a month (3-month trial included) | Not needed for syncing to Apple Health. |
| **Eufy Smart Scale P2 Pro** (or your model) | You have it | US$40 to US$60; Australian prices vary a lot, check a local retailer | EufyLife app is free. |
| EufyLife app | Yes | Free | Writes to Apple Health. |
| Google Health app | Yes | Free | Version 5.05+ for the Apple Health sync. |
| **Health Auto Export** | **Yes** (the courier) | Premium is required for automatic REST exports. App Store (Italy) listing: about 2 euro a month, about 8 euro a year, or about 30 euro lifetime. A 7-day free trial. Check the price in your own App Store. | Basic (about 3 euro) cannot do the automatic push. **Lifetime is the cheapest over a year or two.** |
| **Supabase** | Yes | **Free plan: US$0.** Pro: US$25 a month per organisation | Free: 500 MB database, 1 GB files, about 500,000 function calls a month, plenty for one person. **Catch: a free project is paused after about a week without activity** and must be restored by hand. Your old project is already paused this way. If you open the app most weeks it stays awake; Pro removes the pause. |
| **Netlify** | Yes | Free plan US$0 (300 credits a month, a hard limit); Personal US$9 a month | One person's app stays far under the free limit. If credits ran out the site would pause until the next month. |
| **Twilio** (texts) | Optional | Australian text about US$0.0515 each; mobile number about US$8.25 a month; carrier fees extra. About **US$9 a month** for a number plus a few texts, so the number rental is almost the whole cost. Trial: free credit but only to verified numbers. | Skip it if you only want in-app reminders (push notifications cost nothing). |
| **Anthropic API** | Only for the AI input tools | Pay as you go, by use | A meal photo or description is a small request, roughly cents a day at heavy use. Set a monthly spend limit in the Anthropic console. |
| USDA key | Optional | Free | |
| Apple developer account | **No** | | The app is a PWA, no App Store release. |

### What it adds up to
- **Minimum to get Fitbit Air and the scale into Arete:** Health Auto Export Premium (about 2 euro a month, or about 30 euro once for lifetime) plus the hardware you already own. Supabase and Netlify stay on their free plans. **About 0 dollars a month ongoing** with the lifetime option.
- **Add texts:** about US$9 a month more for Twilio.
- **Add reliability:** Supabase Pro (US$25 a month) removes the inactivity pause. Only worth it if you go weeks without opening the app.

## Confirm before paying
- [Fitbit Air and Apple Health sync (MacRumors)](https://www.macrumors.com/2026/08/03/fitbit-apple-health-syncing/) · [Fitbit Air review with prices](https://livity-app.com/en/blog/fitbit-air-review-apple-watch) · [How the sync works](https://motion-app.com/blog/sync-google-health-to-apple-health/)
- [Health Auto Export on the App Store](https://apps.apple.com/app/id1115567069)
- [Twilio Australia SMS pricing](https://www.twilio.com/en-us/sms/pricing/au) · [Twilio Australia sender ID rules](https://support.twilio.com/hc/en-us/articles/47624808819483-Registering-Your-Alphanumeric-Sender-ID-for-Australia-in-the-Twilio-Console)
- [Supabase pricing](https://supabase.com/pricing) (third-party summary: [Makerkit](https://makerkit.dev/blog/md/saas/supabase-pricing))
- [Netlify pricing](https://www.netlify.com/pricing/) (third-party summary: [netli.fyi](https://netli.fyi/blog/netlify-pricing-and-limits))
- [Eufy Smart Scale P2 Pro coverage](https://www.macworld.com/article/2803414/this-40-smart-scale-syncs-with-apple-health-to-track-your-diet.html)

Not verified: the exact Australian price of the Fitbit Air and the Eufy scale, Health Auto Export's price in the Australian App Store, and whether Netlify's bandwidth is 10 or 20 credits per GB (sources disagree).

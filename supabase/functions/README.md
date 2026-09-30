# Arete Edge Functions

`ai-chat` is authenticated by Supabase's default JWT verification. Do not set
`verify_jwt = false` for this function. The function also rejects the public
anon-key token (which every client bundle contains) and accepts only a
signed-in user's token (`role = authenticated`), so the AI budget can only be
spent by the account owner.

## Who can call these functions

Every function here checks for a signed-in user's token, but a signed-in user is
anyone who can create an account on the Supabase project. Because Arete is a
single-user app, do one of these (both is better):

1. Turn off public sign-ups: Supabase dashboard > Authentication > Providers >
   Email > disable "Allow new users to sign up" (after your own account exists).
2. Set the `OWNER_USER_ID` secret to your user id (Authentication > Users). The
   functions then return 403 to every other account.

```powershell
supabase secrets set OWNER_USER_ID=<your-user-uuid>
```

Never deploy with `--no-verify-jwt`: the platform's signature check is what makes
the token contents trustworthy.

`send-sms` (Twilio) follows the same rules; its secrets are listed in
`docs/deploy-runbook.md`. `ai-chat` only runs one-shot tools (`mode: "raw"`); there is no chat assistant.

Before deployment, configure server-only secrets in the Supabase project:

```powershell
supabase secrets set ANTHROPIC_API_KEY=<rotated-key> ANTHROPIC_MODEL=<model-id>
supabase functions deploy ai-chat
```

Use a newly rotated Anthropic key. Never prefix provider credentials with
`VITE_`; Vite variables are public client configuration and are embedded in
the desktop and PWA bundles.

The tools mode also accepts one optional `image` (`{ mediaType, data }`, base64 JPEG/PNG/WebP up to about 3.5 MB) so Fuel can estimate a meal from a photo. If you deployed `ai-chat` before that was added, deploy it again.

Deployment is intentionally manual. After deployment, try Fuel > Photo on your phone:
until the function is deployed the AI tools report that the service is unavailable, and
everything else in the app works as normal.

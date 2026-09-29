# Arete Edge Functions

`ai-chat` is authenticated by Supabase's default JWT verification. Do not set
`verify_jwt = false` for this function. The function also rejects the public
anon-key token (which every client bundle contains) and accepts only a
signed-in user's token (`role = authenticated`), so the AI budget can only be
spent by the account owner.

Before deployment, configure server-only secrets in the Supabase project:

```powershell
supabase secrets set ANTHROPIC_API_KEY=<rotated-key> ANTHROPIC_MODEL=<model-id>
supabase functions deploy ai-chat
```

Use a newly rotated Anthropic key. Never prefix provider credentials with
`VITE_`; Vite variables are public client configuration and are embedded in
the desktop and PWA bundles.

Deployment is intentionally manual. After deployment, sign in to Arete and use
Settings → AI → Test connection. Until then, desktop Ollama remains the local
fallback and the iOS/web AI service reports unavailable.

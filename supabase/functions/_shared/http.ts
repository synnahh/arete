// Shared by voice-tts and send-sms (ai-chat carries its own copy so it can be deployed alone).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Optional lock to one account: when the OWNER_USER_ID secret is set, only that user id may call.
// Without it, anyone who can sign up to the Supabase project counts as "signed in", so either turn
// public sign-ups off in the Auth settings or set this secret.
export function isOwner(userId: string): boolean {
  const owner = Deno.env.get('OWNER_USER_ID');
  return !owner || owner === userId;
}

// The platform verifies the JWT signature (verify_jwt stays on), but its default
// also accepts the public anon key that ships in every client bundle. Require a
// signed-in user's token so only the account owner can spend the budget.
export function signedInUser(authorization: string | null): string | null {
  try {
    const token = (authorization || '').replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const claims = JSON.parse(atob(padded));
    return claims?.role === 'authenticated' && typeof claims?.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

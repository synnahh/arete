// Sends Arete's scheduled push notifications (instead of SMS: no phone number to buy).
//
// Two callers:
//   1. A cron job every 5 minutes (supabase/push.sql sets it up). It sends the header
//      x-cron-token: <PUSH_CRON_TOKEN>; the function works out which reminders are due in your
//      time zone from settings.push (what you set in Profile > Reminders) and sends them to every
//      device saved in user_meta 'push_subs'. Each reminder is sent once a day.
//   2. The app, signed in as you, with { mode: 'test' } (sends one test notification now) or
//      { mode: 'status' } (is the server set up?).
//
// Deploy WITH JWT verification (the default): the cron job passes the project's anon key as the
// bearer token, which the platform accepts, and the x-cron-token is what actually authorises it.
//   supabase functions deploy push-send --use-api
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com),
//          PUSH_CRON_TOKEN (long random string), OWNER_USER_ID. Supabase supplies the rest.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders, isOwner, json, signedInUser } from '../_shared/http.ts';
import { safeEqual } from '../_shared/healthMap.js';
import { cleanPush, dueItems, markSent, payloadFor } from '../_shared/pushSchedule.js';

type Sub = { endpoint: string; keys: { p256dh: string; auth: string }; device?: string; addedAt?: number };

const need = (name: string) => Deno.env.get(name) || '';

function configured(): boolean {
  return !!(need('VAPID_PUBLIC_KEY') && need('VAPID_PRIVATE_KEY') && need('VAPID_SUBJECT') && need('OWNER_USER_ID'));
}

async function sendAll(subs: Sub[], payload: unknown): Promise<{ sent: number; gone: string[]; failed: number }> {
  let sent = 0, failed = 0;
  const gone: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint); // the device unsubscribed or the app was removed
      else failed++;
    }
  }
  return { sent, gone, failed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token' } });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cronGiven = req.headers.get('x-cron-token') || '';
  const isCron = cronGiven.length > 0 && safeEqual(cronGiven, need('PUSH_CRON_TOKEN'));
  const user = isCron ? null : signedInUser(req.headers.get('Authorization'));
  if (!isCron) {
    if (!user) return json({ error: 'Authentication required' }, 401);
    if (!isOwner(user)) return json({ error: 'Not allowed' }, 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* an empty body is fine for the cron call */ }

  if (body.mode === 'status') return json({ ok: true, configured: configured() });
  if (!configured()) return json({ error: 'Push is not set up on the server (VAPID keys and OWNER_USER_ID)' }, 503);
  webpush.setVapidDetails(need('VAPID_SUBJECT'), need('VAPID_PUBLIC_KEY'), need('VAPID_PRIVATE_KEY'));

  const owner = need('OWNER_USER_ID');
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: rows, error } = await db.from('user_meta').select('key,value').eq('user_id', owner).in('key', ['settings', 'push_subs', 'push_sent']);
  if (error) return json({ error: 'Could not read your settings' }, 500);
  const byKey = Object.fromEntries((rows || []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as Record<string, any>;
  const subs: Sub[] = Array.isArray(byKey.push_subs?.subs) ? byKey.push_subs.subs : [];
  if (!subs.length) return json({ ok: true, sent: 0, note: 'No device has turned push on yet' });

  const saveSubs = async (list: Sub[]) => db.from('user_meta').upsert({ user_id: owner, key: 'push_subs', value: { subs: list } }, { onConflict: 'user_id,key' });

  // Test from the app: one notification, right now, to every device.
  if (body.mode === 'test') {
    const r = await sendAll(subs, { title: 'Arete', body: 'Push is working. Your reminders will arrive like this.', tag: 'arete-test', url: '/' });
    if (r.gone.length) await saveSubs(subs.filter(s => !r.gone.includes(s.endpoint)));
    return json({ ok: r.sent > 0, sent: r.sent, failed: r.failed, removed: r.gone.length });
  }

  if (!isCron) return json({ error: 'Unknown mode' }, 400);

  // The scheduled run.
  const push = cleanPush(byKey.settings?.push);
  const now = new Date();
  const due = dueItems(push, now, byKey.push_sent ?? null);
  if (!due.length) return json({ ok: true, sent: 0, due: 0 });

  let sent = 0;
  const gone = new Set<string>();
  for (const item of due) {
    const r = await sendAll(subs, payloadFor(item));
    sent += r.sent;
    r.gone.forEach(g => gone.add(g));
  }
  // Mark them done even if every send failed, so a bad subscription never turns into a notification storm.
  await db.from('user_meta').upsert({ user_id: owner, key: 'push_sent', value: markSent(push, now, byKey.push_sent ?? null, due) }, { onConflict: 'user_id,key' });
  if (gone.size) await saveSubs(subs.filter(s => !gone.has(s.endpoint)));
  return json({ ok: true, due: due.length, sent, removed: gone.size });
});

// Receives the Health Auto Export app's REST push (Apple Health: steps, sleep, heart
// rate, weight and body fat from the Eufy scale via Apple Health) and files it where
// the app already reads from. Writes use the service role, so the caller is
// authenticated by a shared secret instead of a user session.
//
// Deploy WITHOUT JWT verification (the phone app cannot sign in):
//   supabase functions deploy health-ingest --no-verify-jwt
// Secrets: HEALTH_INGEST_TOKEN (long random string), OWNER_USER_ID (Rob's auth user id).
// Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY itself.
//
// Request: POST, header  x-health-token: <HEALTH_INGEST_TOKEN>  (or Authorization: Bearer <token>)
// Body: Health Auto Export JSON. Re-sending the same data is safe (idempotent).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { mapHealthExport, safeEqual } from '../_shared/healthMap.js';

const MAX_BYTES = 5_000_000;
const headers = { 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

// Steps and energy only grow through a day, so a partial push never lowers a total.
const KEEP_HIGHER = ['steps', 'activeEnergy'];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('HEALTH_INGEST_TOKEN') || '';
  const owner = Deno.env.get('OWNER_USER_ID') || '';
  if (secret.length < 16 || !owner) return reply({ error: 'Health sync is not configured' }, 503);

  const given = req.headers.get('x-health-token') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(given, secret)) return reply({ error: 'Not allowed' }, 401);

  const text = await req.text();
  if (text.length > MAX_BYTES) return reply({ error: 'Payload too large' }, 413);
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { return reply({ error: 'Invalid JSON' }, 400); }

  const { days, weights, sleep, metricNames } = mapHealthExport(payload);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const result = { days: 0, weighIns: 0, sleepNights: 0 };
  // What the phone actually sent, so a missing metric is visible in the reply and the function logs.
  console.log('health-ingest received metrics:', metricNames.join(', ') || '(none)');

  // 1. Daily summary (steps, heart rate ...) -> health_sync, one row per day.
  const dayKeys = Object.keys(days);
  if (dayKeys.length) {
    const { data: existing, error } = await db.from('health_sync').select('sync_date,data')
      .eq('user_id', owner).in('sync_date', dayKeys);
    if (error) return reply({ error: `health_sync: ${error.message}` }, 500);
    const old = new Map((existing || []).map((r: { sync_date: string; data: Record<string, unknown> }) => [r.sync_date, r.data || {}]));
    const rows = dayKeys.map((d) => {
      const merged: Record<string, unknown> = { ...(old.get(d) || {}), ...days[d] };
      // `more` holds the metrics without a field of their own: merge per name, never drop one a push did not repeat.
      const oldMore = (old.get(d) as Record<string, unknown> | undefined)?.more;
      const newMore = (days[d] as Record<string, unknown>).more;
      if (oldMore || newMore) merged.more = { ...(oldMore as object || {}), ...(newMore as object || {}) };
      for (const k of KEEP_HIGHER) {
        const prev = Number((old.get(d) as Record<string, unknown> | undefined)?.[k]);
        if (Number.isFinite(prev) && prev > Number(merged[k] ?? 0)) merged[k] = prev;
      }
      return { user_id: owner, sync_date: d, data: merged, updated_at: new Date().toISOString() };
    });
    const { error: upErr } = await db.from('health_sync').upsert(rows, { onConflict: 'user_id,sync_date' });
    if (upErr) return reply({ error: `health_sync: ${upErr.message}` }, 500);
    result.days = rows.length;
  }

  // 2. Weigh-ins -> body_metrics, one row per reading (skipped when already stored).
  if (weights.length) {
    const keys = weights.map((w: { key: string }) => w.key);
    const { data: have, error } = await db.from('body_metrics').select('data')
      .eq('user_id', owner).in('data->>healthKey', keys);
    if (error) return reply({ error: `body_metrics: ${error.message}` }, 500);
    const seen = new Set((have || []).map((r: { data: { healthKey?: string } }) => r.data?.healthKey));
    const fresh = weights.filter((w: { key: string }) => !seen.has(w.key)).map((w: { key: string; date: string; time: string | null; weight: number; bodyFat?: number }) => ({
      user_id: owner,
      data: { date: w.date, time: w.time, weight: w.weight, ...(w.bodyFat != null ? { bodyFat: w.bodyFat } : {}), source: 'apple-health', healthKey: w.key },
    }));
    if (fresh.length) {
      const { error: insErr } = await db.from('body_metrics').insert(fresh);
      if (insErr) return reply({ error: `body_metrics: ${insErr.message}` }, 500);
    }
    result.weighIns = fresh.length;
  }

  // 3. Sleep -> sleep_data, one row per night. A night logged by hand is never overwritten.
  for (const n of sleep as Array<{ date: string }>) {
    const { data: found, error } = await db.from('sleep_data').select('id,data')
      .eq('user_id', owner).eq('data->>date', n.date).limit(1);
    if (error) return reply({ error: `sleep_data: ${error.message}` }, 500);
    const row = found?.[0];
    if (row && row.data?.source && row.data.source !== 'apple-health') continue;
    const data = { ...(row?.data || {}), ...n, source: 'apple-health' };
    const { error: wErr } = row
      ? await db.from('sleep_data').update({ data }).eq('id', row.id).eq('user_id', owner)
      : await db.from('sleep_data').insert({ user_id: owner, data });
    if (wErr) return reply({ error: `sleep_data: ${wErr.message}` }, 500);
    result.sleepNights += 1;
  }

  return reply({ ok: true, ...result, metrics: metricNames });
});

// Text to speech through ElevenLabs, so the ElevenLabs key lives in a Supabase
// secret instead of the app bundle. Returns the MP3 bytes as application/octet-stream (supabase-js only hands binary back as a Blob for that type).
//
// Secrets: ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (optional default).
// Request: POST { text: string (max 1500 chars), voiceId?: string }
import { corsHeaders, json, signedInUser } from '../_shared/http.ts';

const MAX_TEXT = 1500;
const MODEL = 'eleven_monolingual_v1';
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75 };
const VOICE_ID = /^[A-Za-z0-9]{10,40}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!signedInUser(req.headers.get('Authorization'))) return json({ error: 'Authentication required' }, 401);

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) return json({ error: 'Voice service is not configured' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'Text is required' }, 400);
  if (text.length > MAX_TEXT) return json({ error: 'Text is too long' }, 413);

  const requested = typeof body.voiceId === 'string' && VOICE_ID.test(body.voiceId) ? body.voiceId : '';
  const voiceId = requested || Deno.env.get('ELEVENLABS_VOICE_ID') || '';
  if (!VOICE_ID.test(voiceId)) return json({ error: 'No voice configured' }, 503);

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: VOICE_SETTINGS }),
  });
  if (!upstream.ok) return json({ error: `Voice provider error (${upstream.status})` }, upstream.status === 401 || upstream.status === 402 || upstream.status === 403 ? 502 : upstream.status);

  return new Response(upstream.body, { headers: { ...corsHeaders, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
});

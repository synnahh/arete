// Claude calls are served by the authenticated Supabase Edge Function. The
// Anthropic credential and core personality prompt never enter client code.
import { rateLimitClaude } from '../utils/rateLimit.js';
import { aiStatus, invokeAI } from './server.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';

export async function askClaude(message, history = [], _legacyApiKey, { context = '', memory = [], coaching = '' } = {}) {
  rateLimitClaude();
  const settings = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
  const data = await invokeAI({ mode: 'chat', message, history, context, memory, coaching, personality: settings.coachPersonality || 'calm expert' });
  return data?.text ?? '';
}

export async function pingClaude() {
  return aiStatus();
}

export async function testClaudeConnection() {
  const ok = await aiStatus();
  return ok
    ? { ok: true, reason: 'Connected to the secure AI service' }
    : { ok: false, reason: 'AI service unavailable or not configured' };
}

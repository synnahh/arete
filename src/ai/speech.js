// ─── speech.js — VALERIE's voice layer ────────────────────────────────────────
// Priority: ElevenLabs (real voice) → Browser SpeechSynthesis (fallback)
// Includes: speech cleaning pipeline, ElevenLabs fetch, audio playback management,
//           voice session stop-intent detection.

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { invoke }              from '@tauri-apps/api/core';
import { rateLimitElevenLabs } from '../utils/rateLimit.js';

// ─── VALERIE's voice identity ──────────────────────────────────────────────────
// Default voice ID — locked in as VALERIE's voice. Overridable in Settings.
const DEFAULT_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'yj30vwTGJxSHezdAGsv9';
// API key is NOT read from env — enter it in Settings → Voice so it stays out of the bundle
const DEFAULT_API_KEY  = '';
const ELEVENLABS_MODEL    = 'eleven_monolingual_v1'; // compatible with free ElevenLabs plans

// Session-level disables — set to true on first auth/plan rejection to avoid
// hammering broken credentials on every message.
let _el11Disabled   = false;
let _azureDisabled  = false;
const ELEVENLABS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

// Voice character settings — tuned for VALERIE's confident, calm personality
const VALERIE_VOICE_SETTINGS = {
  stability:         0.45,  // slightly lower = more expressive, less monotone
  similarity_boost:  0.80,  // high fidelity to the chosen voice
  style:             0.20,  // light style exaggeration — gives her character
  use_speaker_boost: true,  // enhanced clarity and presence
};

// ─── Stop-intent phrases — end a continuous voice session ─────────────────────
export const STOP_INTENTS = [
  'stop listening', 'stop', "that's all", 'thats all', 'goodbye',
  'bye', 'end session', 'quiet', 'go to sleep', 'sleep mode',
  'thanks valerie', 'thank you valerie', 'enough', 'cancel',
  "we're done", 'were done', 'dismiss',
];

// ─── Audio state — tracks the current playing ElevenLabs audio element ────────
// Module-level so it can be cancelled from anywhere (endVoiceSession, etc.)
let _currentAudio = null;

// ─── cancelCurrentSpeech ──────────────────────────────────────────────────────
// Stops whatever is currently playing — ElevenLabs audio OR browser TTS.
// Call this before starting new speech, or when ending a voice session.

export function cancelCurrentSpeech() {
  // Cancel ElevenLabs audio
  if (_currentAudio) {
    try {
      _currentAudio.pause();
      _currentAudio.currentTime = 0;
      const src = _currentAudio.src;
      _currentAudio = null;
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    } catch {}
  }
  // Cancel browser SpeechSynthesis
  try { window.speechSynthesis?.cancel(); } catch {}
}

// ─── cleanForSpeech ────────────────────────────────────────────────────────────
// Converts raw AI text into natural spoken language.
// Strips all markdown, symbols, code, hex codes, and technical noise.
// VALERIE must never sound like a TTS bot reading formatting aloud.

export function cleanForSpeech(text) {
  if (!text) return '';

  let s = text;

  // Strip JSON wrapper if the response accidentally includes it
  try {
    const parsed = JSON.parse(s);
    if (parsed.speech) return cleanForSpeech(parsed.speech);
  } catch {}

  // Remove markdown code blocks
  s = s.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/`([^`]+)`/g, '$1');

  // Remove markdown headers
  s = s.replace(/^#{1,6}\s+/gm, '');

  // Remove bold / italic / strikethrough
  s = s.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1');
  s = s.replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1');
  s = s.replace(/~~([^~]+)~~/g, '$1');

  // Remove hex colour codes (e.g. #080c14, #fff)
  s = s.replace(/#[0-9a-fA-F]{3,8}\b/g, '');

  // Remove raw URLs
  s = s.replace(/https?:\/\/[^\s,)]+/g, '');

  // Remove markdown links — keep label text only
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Convert markdown lists to natural phrasing (remove bullet/number prefix)
  s = s.replace(/^[\-\*\+]\s+/gm, '');
  s = s.replace(/^\d+\.\s+/gm, '');

  // Remove blockquote syntax
  s = s.replace(/^>\s*/gm, '');

  // Remove horizontal rules
  s = s.replace(/^[-_*]{3,}$/gm, '');

  // Remove table pipes
  s = s.replace(/\|/g, ' ');
  s = s.replace(/^[-:]+$/gm, '');

  // Naturalise currency for speech
  s = s.replace(/A\$(\d[\d,.]*)/g, '$1 Australian dollars');
  s = s.replace(/\$(\d[\d,.]*)/g, '$1 dollars');
  s = s.replace(/£(\d[\d,.]*)/g, '$1 pounds');
  s = s.replace(/€(\d[\d,.]*)/g, '$1 euros');

  // Expand common abbreviations
  s = s.replace(/\be\.g\./gi, 'for example');
  s = s.replace(/\bi\.e\./gi, 'that is');
  s = s.replace(/\betc\./gi, 'and so on');
  s = s.replace(/\bvs\./gi, 'versus');

  // Remove remaining symbols
  s = s.replace(/[*_~^\\]/g, '');
  s = s.replace(/<[^>]+>/g, '');

  // Collapse whitespace
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]{2,}/g, ' ');

  return s.trim();
}

// ─── isStopIntent ─────────────────────────────────────────────────────────────
// Returns true if the transcript matches a voice session end phrase.

export function isStopIntent(transcript) {
  const lower = (transcript || '').toLowerCase().trim();
  return STOP_INTENTS.some(phrase => lower === phrase || lower.startsWith(phrase + ' '));
}

// ─── ElevenLabs fetch ─────────────────────────────────────────────────────────
// Makes the actual API call and returns a Blob of audio/mpeg.

async function _fetchElevenLabsAudio(text, apiKey, voiceId) {
  rateLimitElevenLabs();
  const response = await tauriFetch(`${ELEVENLABS_ENDPOINT}/${voiceId}`, {
    method:  'POST',
    headers: {
      'xi-api-key':   apiKey,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id:       ELEVENLABS_MODEL,
      voice_settings: VALERIE_VOICE_SETTINGS,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ElevenLabs ${response.status}${detail ? ': ' + detail : ''}`);
  }

  // tauriFetch returns ArrayBuffer via .arrayBuffer(), not a Blob
  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: 'audio/mpeg' });
}

// ─── Azure TTS fetch ──────────────────────────────────────────────────────────
// Calls the Azure Cognitive Services Speech REST API.
// voiceName must be a valid Neural voice name, e.g. "en-AU-NatashaNeural".
// region is the Azure region slug, e.g. "australiaeast".

function _escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function _fetchAzureAudio(text, apiKey, region, voiceName = 'en-AU-NatashaNeural') {
  // Derive xml:lang from the voice name prefix (e.g. "en-AU-NatashaNeural" → "en-AU")
  const langMatch = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
  const lang      = langMatch ? langMatch[1] : 'en-AU';

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>`
    + `<voice name='${voiceName}'>${_escapeXml(text)}</voice></speak>`;

  const response = await tauriFetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method:  'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type':              'application/ssml+xml',
        'X-Microsoft-OutputFormat':  'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    }
  );

  if (!response.ok) {
    throw new Error(`Azure TTS ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: 'audio/mpeg' });
}

// ─── speakText ─────────────────────────────────────────────────────────────────
// Primary speech function. ElevenLabs is always tried first.
// Falls back to browser SpeechSynthesis if ElevenLabs fails or has no key.
//
// IMPORTANT: This function is async (ElevenLabs fetch), but callers can fire-and-forget.
// Completion is communicated via the onEnd callback, not return value.

export async function speakText(text, voiceSettings = {}, { onStart, onEnd, onError } = {}) {
  if (!text?.trim()) {
    onEnd?.();
    return;
  }

  // Resolve credentials — voiceSettings → keyring → empty
  let apiKey = voiceSettings.elevenlabsKey || DEFAULT_API_KEY;
  if (!apiKey) {
    try { apiKey = await invoke('get_secret', { service: 'valerie', key: 'elevenlabs_api_key' }) || ''; }
    catch { /* keyring unavailable — fall through to browser TTS */ }
  }
  const voiceId = voiceSettings.elevenlabsVoiceId || DEFAULT_VOICE_ID;

  // Cancel anything currently speaking
  cancelCurrentSpeech();

  // ── Priority 1: ElevenLabs ───────────────────────────────────────────────────
  if (apiKey && !_el11Disabled) {
    try {
      const audioBlob = await _fetchElevenLabsAudio(text, apiKey, voiceId);
      const audioUrl  = URL.createObjectURL(audioBlob);
      const audio     = new Audio(audioUrl);
      _currentAudio   = audio;

      audio.onplay = () => onStart?.();

      audio.onended = () => {
        _currentAudio = null;
        try { URL.revokeObjectURL(audioUrl); } catch {}
        onEnd?.();
      };

      audio.onerror = () => {
        _currentAudio = null;
        try { URL.revokeObjectURL(audioUrl); } catch {}
        onError?.();
        onEnd?.();
      };

      await audio.play();
      return; // success — done

    } catch (err) {
      _currentAudio = null;
      const msg = err.message || '';

      // Disable for the rest of this session if the plan/key is rejected
      if (msg.includes('402') || msg.includes('403') || msg.includes('payment_required')) {
        _el11Disabled = true;
        console.info('[VALERIE/Voice] ElevenLabs disabled for this session (plan/key issue). Using System TTS.');
      } else {
        console.warn('[VALERIE/Voice] ElevenLabs failed, falling back to browser TTS:', msg);
      }
    }
  }

  // ── Priority 2: Azure Neural TTS ────────────────────────────────────────────
  const azureKey    = voiceSettings.azureKey;
  const azureRegion = voiceSettings.azureRegion;
  if (azureKey && azureRegion && !_azureDisabled) {
    try {
      const voiceName  = voiceSettings.azureVoiceName || 'en-AU-NatashaNeural';
      const audioBlob  = await _fetchAzureAudio(text, azureKey, azureRegion, voiceName);
      const audioUrl   = URL.createObjectURL(audioBlob);
      const audio      = new Audio(audioUrl);
      _currentAudio    = audio;

      audio.onplay = () => onStart?.();

      audio.onended = () => {
        _currentAudio = null;
        try { URL.revokeObjectURL(audioUrl); } catch {}
        onEnd?.();
      };

      audio.onerror = () => {
        _currentAudio = null;
        try { URL.revokeObjectURL(audioUrl); } catch {}
        onError?.();
        onEnd?.();
      };

      await audio.play();
      return; // success — done

    } catch (err) {
      _currentAudio = null;
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('403')) {
        _azureDisabled = true;
        console.info('[VALERIE/Voice] Azure TTS disabled for this session (key rejected).');
      } else {
        console.warn('[VALERIE/Voice] Azure TTS failed, falling back to browser TTS:', msg);
      }
    }
  }

  // ── Priority 3: Browser SpeechSynthesis ─────────────────────────────────────
  _speakWithBrowser(text, voiceSettings, { onStart, onEnd, onError });
}

function _speakWithBrowser(text, voiceSettings = {}, { onStart, onEnd, onError } = {}) {
  if (!window.speechSynthesis) {
    onEnd?.();
    return;
  }

  const utt = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  if (voiceSettings.voiceURI) {
    const found = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
    if (found) utt.voice = found;
  }

  utt.rate   = voiceSettings.rate   ?? 0.95;
  utt.pitch  = voiceSettings.pitch  ?? 1.0;
  utt.volume = voiceSettings.volume ?? 1.0;
  utt.lang   = voiceSettings.lang   ?? 'en-AU';

  utt.onstart = () => onStart?.();
  utt.onend   = () => onEnd?.();
  utt.onerror = (e) => {
    if (e.error !== 'interrupted') onError?.(e);
    onEnd?.();
  };

  try {
    window.speechSynthesis.speak(utt);
  } catch {
    onEnd?.();
  }
}

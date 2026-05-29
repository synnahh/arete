// ─── speech.js — TTS cleaning + voice session utilities ───────────────────────
// Strips all markdown, symbols, and code from AI responses before TTS.
// VALERIE should never read asterisks, hex codes, or raw URLs aloud.

// ─── Stop-intent phrases (end a continuous voice session) ─────────────────────
export const STOP_INTENTS = [
  'stop listening', 'stop', 'that\'s all', 'thats all', 'goodbye',
  'bye', 'end session', 'quiet', 'go to sleep', 'sleep mode',
  'thanks valerie', 'thank you valerie', 'enough', 'cancel',
];

// ─── cleanForSpeech ────────────────────────────────────────────────────────────
// Converts raw AI text output into natural spoken language.
// Removes all markdown formatting, symbols, code, and technical noise.

export function cleanForSpeech(text) {
  if (!text) return '';

  let s = text;

  // ── Strip JSON wrapper if response accidentally includes it ────────────────
  // (shouldn't happen if parsing worked, but defensive)
  try {
    const parsed = JSON.parse(s);
    if (parsed.speech) return cleanForSpeech(parsed.speech);
  } catch {}

  // ── Remove markdown code blocks ────────────────────────────────────────────
  s = s.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/`([^`]+)`/g, '$1');

  // ── Remove markdown headers ────────────────────────────────────────────────
  s = s.replace(/^#{1,6}\s+/gm, '');

  // ── Remove bold / italic / strikethrough ──────────────────────────────────
  s = s.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1');
  s = s.replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1');
  s = s.replace(/~~([^~]+)~~/g, '$1');

  // ── Remove hex colour codes (e.g. #080c14, #fff) ─────────────────────────
  s = s.replace(/#[0-9a-fA-F]{3,8}\b/g, '');

  // ── Remove raw URLs ────────────────────────────────────────────────────────
  s = s.replace(/https?:\/\/[^\s,)]+/g, '');

  // ── Remove markdown links — keep label text only ──────────────────────────
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // ── Convert markdown bullet / numbered lists to natural phrasing ──────────
  // Replace leading "- " or "* " with nothing (already handled by asterisk strip above)
  s = s.replace(/^[\-\*\+]\s+/gm, '');
  s = s.replace(/^\d+\.\s+/gm, '');

  // ── Remove blockquote syntax ───────────────────────────────────────────────
  s = s.replace(/^>\s*/gm, '');

  // ── Remove horizontal rules ────────────────────────────────────────────────
  s = s.replace(/^[-_*]{3,}$/gm, '');

  // ── Remove table syntax ────────────────────────────────────────────────────
  s = s.replace(/\|/g, ' ');
  s = s.replace(/^[-:]+$/gm, '');

  // ── Naturalise currency ────────────────────────────────────────────────────
  s = s.replace(/\$(\d[\d,.]*)/g, '$1 dollars');
  s = s.replace(/£(\d[\d,.]*)/g, '$1 pounds');
  s = s.replace(/€(\d[\d,.]*)/g, '$1 euros');
  s = s.replace(/A\$(\d[\d,.]*)/g, '$1 Australian dollars');

  // ── Expand common abbreviations ────────────────────────────────────────────
  s = s.replace(/\be\.g\./gi, 'for example');
  s = s.replace(/\bi\.e\./gi, 'that is');
  s = s.replace(/\betc\./gi, 'and so on');
  s = s.replace(/\bvs\./gi, 'versus');

  // ── Remove remaining symbols unlikely to appear in natural speech ─────────
  s = s.replace(/[*_~^\\]/g, '');
  s = s.replace(/<[^>]+>/g, ''); // HTML tags

  // ── Collapse excessive whitespace / blank lines ────────────────────────────
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]{2,}/g, ' ');

  // ── Trim ───────────────────────────────────────────────────────────────────
  s = s.trim();

  return s;
}

// ─── isStopIntent ─────────────────────────────────────────────────────────────
// Returns true if the transcript is a conversation-ending phrase.

export function isStopIntent(transcript) {
  const lower = (transcript || '').toLowerCase().trim();
  return STOP_INTENTS.some(phrase => lower === phrase || lower.startsWith(phrase + ' '));
}

// ─── speakText ────────────────────────────────────────────────────────────────
// Speaks text via Web Speech API with optional callbacks.

export function speakText(text, voiceSettings = {}, { onStart, onEnd, onError } = {}) {
  if (!window.speechSynthesis || !text?.trim()) {
    onEnd?.();
    return null;
  }

  // Cancel anything currently playing
  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);

  // Apply voice settings
  const voices = window.speechSynthesis.getVoices();
  if (voiceSettings.voiceURI) {
    const found = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
    if (found) utt.voice = found;
  }

  // Natural cadence settings — slightly slower than default for clarity
  utt.rate   = voiceSettings.rate   ?? 0.95;
  utt.pitch  = voiceSettings.pitch  ?? 1.0;
  utt.volume = voiceSettings.volume ?? 1.0;
  utt.lang   = voiceSettings.lang   ?? 'en-AU';

  utt.onstart = () => onStart?.();
  utt.onend   = () => onEnd?.();
  utt.onerror = (e) => {
    // Ignore 'interrupted' errors (these happen when we cancel speech ourselves)
    if (e.error !== 'interrupted') onError?.(e);
    onEnd?.();
  };

  try {
    window.speechSynthesis.speak(utt);
  } catch {
    onEnd?.();
    return null;
  }

  return utt;
}

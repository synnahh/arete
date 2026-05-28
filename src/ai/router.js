// ─── AI Router — smart routing between Claude and Ollama ──────────────────────
// Strategy:
//   • Simple / quick / offline  → Ollama (free, local, instant)
//   • Complex / nuanced / long  → Claude API (best quality)
//   • Fallback: if chosen engine fails, try the other

import { askClaude } from './claude.js';
import { askOllama } from './ollama.js';

// Keywords that flag a message as "complex" → Claude
const COMPLEX_INDICATORS = [
  'explain', 'analyse', 'analyze', 'write', 'draft', 'summarise', 'summarize',
  'plan', 'strategy', 'advice', 'why', 'compare', 'help me', 'what should',
  'research', 'create', 'generate', 'compose', 'review', 'evaluate',
];

// Short messages (under this char count) are always simple
const SHORT_THRESHOLD = 60;

/**
 * Classify whether a message should go to Claude or Ollama
 * @param {string} message
 * @returns {'claude'|'ollama'}
 */
export function classifyMessage(message) {
  const lower = message.toLowerCase().trim();

  // Very short → Ollama
  if (lower.length < SHORT_THRESHOLD) return 'ollama';

  // Complex indicator → Claude
  if (COMPLEX_INDICATORS.some(kw => lower.includes(kw))) return 'claude';

  // Default longer messages → Claude
  return lower.length > 200 ? 'claude' : 'ollama';
}

/**
 * Route and send a message to the appropriate AI engine
 * @param {object} params
 * @param {string}  params.message        — user's text
 * @param {Array}   params.history        — conversation history
 * @param {string}  params.apiKey         — Claude API key (may be empty)
 * @param {boolean} params.claudeOnline   — is Claude reachable?
 * @param {boolean} params.ollamaOnline   — is Ollama running?
 * @param {string}  [params.forceEngine]  — 'claude'|'ollama' to override routing
 * @returns {Promise<{ text: string, engine: 'claude'|'ollama' }>}
 */
export async function routeMessage({ message, history, apiKey, claudeOnline, ollamaOnline, forceEngine }) {
  const preferred = forceEngine ?? classifyMessage(message);

  // Determine actual engine based on availability
  let engine = preferred;
  if (engine === 'claude' && (!claudeOnline || !apiKey)) {
    engine = 'ollama'; // fall back
  }
  if (engine === 'ollama' && !ollamaOnline) {
    engine = 'claude'; // fall back
  }

  // Both unavailable — return polite error
  if ((engine === 'claude' && (!claudeOnline || !apiKey)) ||
      (engine === 'ollama' && !ollamaOnline)) {
    return {
      text: "I'm offline right now — no connection to Claude or a local model. Check your internet or start Ollama to continue.",
      engine: 'none',
    };
  }

  try {
    if (engine === 'claude') {
      const text = await askClaude(message, history, apiKey);
      return { text, engine: 'claude' };
    } else {
      const text = await askOllama(message, history);
      return { text, engine: 'ollama' };
    }
  } catch (err) {
    // Primary failed — try the other
    console.warn(`[Router] ${engine} failed, trying fallback:`, err.message);

    try {
      if (engine === 'claude' && ollamaOnline) {
        const text = await askOllama(message, history);
        return { text, engine: 'ollama' };
      } else if (engine === 'ollama' && claudeOnline && apiKey) {
        const text = await askClaude(message, history, apiKey);
        return { text, engine: 'claude' };
      }
    } catch (fallbackErr) {
      console.error('[Router] Fallback also failed:', fallbackErr.message);
    }

    return {
      text: "I ran into a problem reaching my AI engines. Please try again in a moment.",
      engine: 'error',
    };
  }
}

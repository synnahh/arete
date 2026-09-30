// ─── AI Router — Claude primary, Ollama local fallback ────────────────────────
// Architecture per overhaul directive:
//   Claude  = primary reasoning + personality + conversation engine
//   Ollama  = local systems layer, fast offline utility, fallback
//
// Claude is always preferred for conversation.
// Ollama is used when Claude is unavailable.

import { askClaude } from './claude.js';
import { askOllama  } from './ollama.js';

/**
 * Route a message to the appropriate AI engine.
 * Claude is default. Ollama is fallback.
 *
 * @param {object} params
 * @param {string}  params.message
 * @param {Array}   params.history
 * @param {boolean} params.claudeOnline
 * @param {boolean} params.ollamaOnline
 * @param {string}  params.context       — live app context string
 * @param {Array}   params.memory        — long-term memory facts array
 * @param {string}  [params.coaching]     coaching brief from ai/coachPrompt.js
 * @param {string}  [params.forceEngine] — 'claude'|'ollama' to override
 * @returns {Promise<{ text: string, engine: 'claude'|'ollama'|'none'|'error' }>}
 */
export async function routeMessage({
  message,
  history,
  claudeOnline,
  ollamaOnline,
  context = '',
  memory  = [],
  coaching = '',
  forceEngine,
}) {
  // Determine which engine to use
  let engine = forceEngine ?? 'claude'; // Claude is always first preference

  // Downgrade to Ollama if Claude isn't available
  if (engine === 'claude' && !claudeOnline) {
    engine = 'ollama';
  }

  // Both offline — return graceful message
  if (engine === 'ollama' && !ollamaOnline) {
    return {
      text: JSON.stringify({
        speech: "I'm offline right now. No connection to Claude or a local model. Check your internet or start Ollama to continue.",
        actions: [],
        remember: null,
      }),
      engine: 'none',
    };
  }

  if (engine === 'claude' && !claudeOnline) {
    return {
      text: JSON.stringify({
        speech: "I'm offline right now. No connection to Claude or a local model. Check your internet or start Ollama to continue.",
        actions: [],
        remember: null,
      }),
      engine: 'none',
    };
  }

  // ── Try primary engine ────────────────────────────────────────────────────
  try {
    if (engine === 'claude') {
      const text = await askClaude(message, history, null, { context, memory, coaching });
      return { text, engine: 'claude' };
    } else {
      const text = await askOllama(message, history, { context, coaching });
      return { text, engine: 'ollama' };
    }
  } catch (err) {
    console.warn(`[Router] ${engine} failed, trying fallback:`, err.message);

    // ── Fallback to the other engine ────────────────────────────────────────
    try {
      if (engine === 'claude' && ollamaOnline) {
        const text = await askOllama(message, history, { context, coaching });
        return { text, engine: 'ollama' };
      }
      if (engine === 'ollama' && claudeOnline) {
        const text = await askClaude(message, history, null, { context, memory, coaching });
        return { text, engine: 'claude' };
      }
    } catch (fallbackErr) {
      console.error('[Router] Fallback also failed:', fallbackErr.message);
    }

    return {
      text: JSON.stringify({
        speech: "I ran into a problem. Give me a moment and try again.",
        actions: [],
        remember: null,
      }),
      engine: 'error',
    };
  }
}

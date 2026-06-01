import { invoke } from '@tauri-apps/api/core';

// ─── Ollama — local AI via Rust commands (bypasses WebView HTTP restrictions) ──
const OLLAMA_MODEL = 'llama3';

const OLLAMA_SYSTEM = `You are VALERIE, a calm and direct AI assistant for Rob's personal productivity dashboard.
Keep responses short and natural. Speak like a real person — no markdown, no symbols, no filler phrases.
When possible, respond in this JSON format: {"speech": "your response here", "actions": []}
If you cannot format as JSON, just respond naturally in plain text.`;

// ─── askOllama ─────────────────────────────────────────────────────────────────
export async function askOllama(message, history = [], { context = '' } = {}) {
  const systemContent = context
    ? `${OLLAMA_SYSTEM}\n\nCurrent context:\n${context}`
    : OLLAMA_SYSTEM;

  const messages = [
    { role: 'system',  content: systemContent },
    ...history.slice(-6),
    { role: 'user',    content: message },
  ];

  return invoke('ask_ollama', { messages, model: OLLAMA_MODEL });
}

// ─── pingOllama ───────────────────────────────────────────────────────────────
export async function pingOllama() {
  try {
    return await invoke('ping_ollama');
  } catch {
    return false;
  }
}

// ─── checkOllamaModel ─────────────────────────────────────────────────────────
export async function checkOllamaModel() {
  try {
    return await invoke('ping_ollama');
  } catch {
    return false;
  }
}

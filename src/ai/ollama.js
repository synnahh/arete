//  Ollama  local AI via Rust commands (bypasses WebView HTTP restrictions) 
// Uses dynamic import so Tauri SDK is not bundled into the PWA build.

const OLLAMA_MODEL = 'llama3';

const OLLAMA_SYSTEM = `You are VALERIE, a calm and direct AI assistant for Rob's personal productivity dashboard.
Keep responses short and natural. Speak like a real person — no markdown, no symbols, no filler phrases.
Always respond in this JSON format: {"speech": "your response here", "actions": [], "remember": null}

When Rob asks you to do something, put one action object per thing in "actions". Available actions:
- {"type":"navigate","target":"tasks"} — targets: dashboard, tasks, calendar, notes, health, workout, finance, portfolio, progress, style, essentials, lists, focus, routines, mind, lm, vault, settings
- {"type":"addTask","title":"...","priority":"high|medium|low"}
- {"type":"addNote","title":"...","content":"..."}
- {"type":"addCalendarEvent","title":"...","date":"YYYY-MM-DD","time":"HH:MM"} (resolve dates yourself from the current date in context)
- {"type":"addEssential","name":"...","category":"grooming|health|kitchen|cleaning|supplements|other"}
- {"type":"addTransaction","transactionType":"income|expense","amount":0,"category":"...","description":"..."}
- {"type":"logWater","amount":500} · {"type":"logMood","value":7} · {"type":"logCalories","calories":600} · {"type":"logSleep","hours":7.5}
- {"type":"startFocus","duration":25}
Combine speech + actions: say what you're doing, then include the action(s).
If you cannot format as JSON, just respond naturally in plain text.`;

//  askOllama 
export async function askOllama(message, history = [], { context = '' } = {}) {
  const systemContent = context
    ? `${OLLAMA_SYSTEM}\n\nCurrent context:\n${context}`
    : OLLAMA_SYSTEM;

  const messages = [
    { role: 'system',  content: systemContent },
    ...history.slice(-6),
    { role: 'user',    content: message },
  ];

  // Dynamic import keeps Tauri SDK out of the PWA bundle
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('ask_ollama', { messages, model: OLLAMA_MODEL });
}

//  pingOllama 
export async function pingOllama() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ping_ollama');
  } catch {
    return false;
  }
}

//  checkOllamaModel 
export async function checkOllamaModel() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ping_ollama');
  } catch {
    return false;
  }
}

// ─── useAI — VALERIE's core AI brain hook ─────────────────────────────────────
// Full pipeline: voice → context → AI → action parsing → speech cleaning → TTS
// Supports continuous voice session mode (ChatGPT Voice-style).
// Two-layer memory: session (short-term) + localStorage (long-term).

import { useState, useEffect, useRef, useCallback } from 'react';
import { pingClaude }                from './claude.js';
import { pingOllama }                from './ollama.js';
import { routeMessage }              from './router.js';
import { buildContext }              from './context.js';
import { parseResponse, executeActions, registerActionHandler } from './actions.js';
import { cleanForSpeech, speakText, cancelCurrentSpeech, isStopIntent } from './speech.js';
import { storage, STORAGE_KEYS }     from '../utils/storage.js';
import { isTauri }                   from '../utils/platform.js';

// ── Tauri invoke — resolved once at module level, reused everywhere ────────────
// Dynamic import is cached by the module system but the async overhead adds up
// across pingAll (every 60s) and sendMessage. Resolve once, store the reference.
let _invoke = null;
async function getTauriInvoke() {
  if (_invoke) return _invoke;
  if (!isTauri()) return null;
  try {
    const mod  = await import('@tauri-apps/api/core');
    _invoke    = mod.invoke;
    return _invoke;
  } catch {
    return null;
  }
}
// Kick off resolution immediately on module load so it's ready before first use
getTauriInvoke().catch(() => {});

// Silence before ending a voice session (ms)
const VOICE_SILENCE_TIMEOUT = 9000;

// Wake word phrases that trigger voice session
const WAKE_WORDS = ['hey val', 'hey valerie', 'hey valerie,', 'ok val', 'ok valerie'];

export function useAI() {

  // ── Connection state ────────────────────────────────────────────────────────
  const [claudeOnline,   setClaudeOnline]   = useState(false);
  const [ollamaOnline,   setOllamaOnline]   = useState(false);
  const [internetOnline, setInternetOnline] = useState(navigator.onLine);
  const [lastPinged,     setLastPinged]     = useState(null);

  // ── Orb visual state ────────────────────────────────────────────────────────
  const [orbState, setOrbState] = useState('idle'); // idle | listening | thinking | speaking

  // ── Conversation ────────────────────────────────────────────────────────────
  const [messages,    setMessages]    = useState(() => storage.get(STORAGE_KEYS.CONVERSATIONS, []));
  const [loading,     setLoading]     = useState(false);
  const [lastEngine,  setLastEngine]  = useState(null);

  // ── Voice session state ─────────────────────────────────────────────────────
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const voiceSessionRef  = useRef(false); // ref for closure access in callbacks
  const silenceTimerRef  = useRef(null);

  // ── Long-term memory ────────────────────────────────────────────────────────
  const [ltMemory, setLtMemory] = useState(() => storage.get('valerie_memory', { facts: [] }));

  // ── Active tab (for context injection) ─────────────────────────────────────
  const activeTabRef = useRef('dashboard');

  // ── Refs for stable closure access ─────────────────────────────────────────
  const messagesRef      = useRef(messages);
  const claudeOnlineRef  = useRef(claudeOnline);
  const ollamaOnlineRef  = useRef(ollamaOnline);
  const ltMemoryRef      = useRef(ltMemory);
  const orbStateRef      = useRef(orbState);
  const settingsRef      = useRef(storage.get(STORAGE_KEYS.SETTINGS, {}));
  const loadingRef       = useRef(loading);

  useEffect(() => { messagesRef.current     = messages;      }, [messages]);
  useEffect(() => { claudeOnlineRef.current  = claudeOnline;  }, [claudeOnline]);
  useEffect(() => { ollamaOnlineRef.current  = ollamaOnline;  }, [ollamaOnline]);
  useEffect(() => { ltMemoryRef.current      = ltMemory;      }, [ltMemory]);
  useEffect(() => { orbStateRef.current      = orbState;      }, [orbState]);
  useEffect(() => { loadingRef.current       = loading;       }, [loading]);

  // ── Callback registry — components register action handlers here ────────────
  const callbacksRef = useRef({});

  const registerCallback = useCallback((name, fn) => {
    callbacksRef.current[name] = fn;
    // Also wire into the actions module for non-React contexts
    registerActionHandler(name, fn);
  }, []);

  // ── Internet detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setInternetOnline(true);
    const off = () => setInternetOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Ping Claude + Ollama (on mount and every 30s) ───────────────────────────
  const pingAll = useCallback(async () => {
    try {
      const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
      settingsRef.current = settings;
      // Priority: env var (hardlocked) → keychain (desktop) → settings (PWA fallback)
      let apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || settings.apiKey || '';
      if (!apiKey) {
        try {
          const inv = await getTauriInvoke();
          if (inv) {
            apiKey = await inv('get_secret', { service: 'valerie', key: 'claude_api_key' }) ?? '';
            if (apiKey) settingsRef.current = { ...settings, apiKey };
          }
        } catch {}
      }
      const [claude, ollama] = await Promise.all([pingClaude(apiKey), pingOllama()]);
      setClaudeOnline(claude);
      setOllamaOnline(ollama);
      setLastPinged(new Date());
    } catch { /* swallow — network errors during alt-tab should never crash the app */ }
  }, []);

  useEffect(() => {
    pingAll();
    // 60s interval (was 30s) — skip when tab is hidden to avoid burning API quota
    const id = setInterval(() => { if (!document.hidden) pingAll(); }, 60_000);
    return () => clearInterval(id);
  }, [pingAll]);

  useEffect(() => { if (internetOnline) pingAll(); }, [internetOnline, pingAll]);

  // ── Persist conversations ───────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) storage.set(STORAGE_KEYS.CONVERSATIONS, messages.slice(-60));
  }, [messages]);

  // ── Core send pipeline ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loadingRef.current) return;

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    loadingRef.current = true;
    setOrbState('thinking');

    const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
    // Priority: env var (hardlocked) → keychain (desktop) → settings (PWA fallback)
    let apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || settings.apiKey || '';
    if (!apiKey) {
      try {
        const inv = await getTauriInvoke();
        if (inv) apiKey = await inv('get_secret', { service: 'valerie', key: 'claude_api_key' }) ?? '';
      } catch {}
    }

    // Build context snapshot from live app state
    const context = buildContext({ activeTab: activeTabRef.current });

    // Get long-term memory facts
    const memory = ltMemoryRef.current.facts || [];

    // Build history (strip timestamps for AI)
    const history = messagesRef.current.slice(-14).map(m => ({ role: m.role, content: m.content }));

    try {
      const { text: rawReply, engine } = await routeMessage({
        message: text,
        history,
        apiKey,
        claudeOnline: claudeOnlineRef.current,
        ollamaOnline: ollamaOnlineRef.current,
        context,
        memory,
      });

      // Parse the structured response
      const { speech, actions, remember } = parseResponse(rawReply);

      // Execute any app actions VALERIE decided on
      if (actions.length > 0) {
        await executeActions(actions);
      }

      // Store new memory fact if VALERIE flagged one
      if (remember) {
        const newFacts = [...(ltMemoryRef.current.facts || []).slice(-19), remember];
        const newMemory = { facts: newFacts };
        setLtMemory(newMemory);
        storage.set('valerie_memory', newMemory);
      }

      // Add to conversation (display the speech text)
      const displayText = speech || rawReply;
      const assistantMsg = { role: 'assistant', content: displayText, ts: Date.now(), engine };
      setMessages(prev => [...prev, assistantMsg]);
      setLastEngine(engine);

      // Speak — clean text before TTS
      const toSpeak = cleanForSpeech(speech || rawReply);
      setOrbState('speaking');

      speakText(toSpeak, settings.voice ?? {}, {
        onEnd: () => {
          setOrbState('idle');
          // If a voice session is active, restart listening after VALERIE speaks
          if (voiceSessionRef.current) {
            // Small pause for natural feel before re-activating mic
            setTimeout(() => {
              if (voiceSessionRef.current) _startListeningCycle();
            }, 400);
          }
        },
        onError: () => {
          setOrbState('idle');
          if (voiceSessionRef.current) {
            setTimeout(() => {
              if (voiceSessionRef.current) _startListeningCycle();
            }, 400);
          }
        },
      });

    } catch (err) {
      console.error('[useAI] sendMessage error:', err);
      setOrbState('idle');
      if (voiceSessionRef.current) {
        setTimeout(() => { if (voiceSessionRef.current) _startListeningCycle(); }, 800);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice session — continuous listening loop ───────────────────────────────

  const recognitionRef = useRef(null);

  function _startListeningCycle() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !voiceSessionRef.current) return;

    // Clear any existing silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setOrbState('listening');

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = 'en-AU';

    rec.onresult = (e) => {
      // Got speech — clear silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const transcript = e.results[0]?.[0]?.transcript?.trim() ?? '';
      if (!transcript) return;

      // Check for conversation-ending intent
      if (isStopIntent(transcript)) {
        endVoiceSession();
        // Brief acknowledgement using VALERIE's voice
        const voiceSettings = storage.get(STORAGE_KEYS.SETTINGS, {}).voice ?? {};
        speakText('Got it.', voiceSettings, { onEnd: () => setOrbState('idle') });
        return;
      }

      // Process the utterance
      setOrbState('thinking');
      sendMessage(transcript);
    };

    rec.onend = () => {
      // Speech recognition ended without a result (silence)
      // Start a timer — if we haven't heard anything in VOICE_SILENCE_TIMEOUT, end the session
      if (voiceSessionRef.current && orbStateRef.current === 'listening') {
        silenceTimerRef.current = setTimeout(() => {
          if (voiceSessionRef.current) {
            endVoiceSession();
          }
        }, VOICE_SILENCE_TIMEOUT);
      }
    };

    rec.onerror = (e) => {
      // Ignore 'no-speech' errors (expected during pauses)
      if (e.error === 'no-speech') {
        if (voiceSessionRef.current) _startListeningCycle();
        return;
      }
      // Other errors — retry after a brief pause
      if (voiceSessionRef.current) {
        setTimeout(() => { if (voiceSessionRef.current) _startListeningCycle(); }, 1000);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      // Already started or browser issue
      console.warn('[useAI] SpeechRecognition start failed:', err.message);
    }
  }

  const startVoiceSession = useCallback(() => {
    if (voiceSessionRef.current) return; // already active
    voiceSessionRef.current = true;
    setVoiceSessionActive(true);
    _startListeningCycle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const endVoiceSession = useCallback(() => {
    voiceSessionRef.current = false;
    setVoiceSessionActive(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try { recognitionRef.current?.stop(); } catch {}
    cancelCurrentSpeech(); // cancels ElevenLabs audio AND browser TTS
    setOrbState('idle');
  }, []);

  // ── Wake word detection — continuous background listener ───────────────────
  const wakeRecRef    = useRef(null);
  const micGrantedRef = useRef(false); // true once getUserMedia succeeds
  const isStartingRef = useRef(false); // mutex — prevents race-condition double-starts

  // Pre-request mic permission via getUserMedia so WebView2 shows the OS prompt.
  // SpeechRecognition alone doesn't trigger the permission dialog in Tauri/WebView2.
  const _requestMicPermission = useCallback(async () => {
    if (micGrantedRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // release mic immediately
      micGrantedRef.current = true;
      return true;
    } catch (err) {
      console.warn('[VALERIE wake word] Mic permission denied:', err.message);
      return false;
    }
  }, []);

  const _startWakeWordListener = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn('[VALERIE wake word] SpeechRecognition not supported'); return; }

    const s = storage.get(STORAGE_KEYS.SETTINGS, {});
    if (s.wakeWordEnabled === false) return;
    // Guard: don't start if already running, session active, window hidden, or mid-start
    if (wakeRecRef.current || voiceSessionRef.current) return;
    if (isStartingRef.current) return;
    if (document.hidden) return;

    isStartingRef.current = true;

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = 'en-AU';

    rec.onresult = (e) => {
      const t = (e.results[0]?.[0]?.transcript ?? '').toLowerCase().trim();
      const triggered = WAKE_WORDS.some(w => t === w || t.startsWith(w + ' ') || t.startsWith(w + ','));
      if (triggered && !voiceSessionRef.current) {
        wakeRecRef.current = null;
        setOrbState('listening');
        setTimeout(() => startVoiceSession(), 100);
      } else {
        wakeRecRef.current = null;
        _startWakeWordListener();
      }
    };

    rec.onend = () => {
      wakeRecRef.current = null;
      const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
      if (!voiceSessionRef.current && settings.wakeWordEnabled !== false) {
        setTimeout(_startWakeWordListener, 300);
      }
    };

    rec.onerror = (e) => {
      wakeRecRef.current = null;
      console.warn('[VALERIE wake word] SpeechRecognition error:', e.error);
      if (e.error === 'no-speech' || e.error === 'aborted') {
        // Normal — just restart
        if (!voiceSessionRef.current) setTimeout(_startWakeWordListener, 300);
      } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Mic permission denied — retry after requesting permission properly
        console.error('[VALERIE wake word] Mic access denied. Will retry after permission request.');
        micGrantedRef.current = false;
        _requestMicPermission().then(granted => {
          if (granted && !voiceSessionRef.current) setTimeout(_startWakeWordListener, 500);
        });
      } else if (e.error === 'network') {
        // Speech service network issue — back off longer
        if (!voiceSessionRef.current) setTimeout(_startWakeWordListener, 3000);
      }
      // Any other error: don't restart (avoid tight error loops)
    };

    wakeRecRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.warn('[VALERIE wake word] rec.start() threw:', err);
      wakeRecRef.current = null;
    } finally {
      isStartingRef.current = false;
    }
  }, [startVoiceSession, _requestMicPermission]); // eslint-disable-line react-hooks/exhaustive-deps

  const _stopWakeWordListener = useCallback(() => {
    if (wakeRecRef.current) {
      try { wakeRecRef.current.stop(); } catch {}
      wakeRecRef.current = null;
    }
  }, []);

  // On mount: request mic permission first, then start wake word listener
  useEffect(() => {
    const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
    if (settings.wakeWordEnabled === false) return;

    // getUserMedia first so WebView2 shows the OS microphone permission prompt.
    // Without this, SpeechRecognition.start() silently fails with not-allowed in Tauri.
    const t = setTimeout(async () => {
      const granted = await _requestMicPermission();
      if (granted) _startWakeWordListener();
    }, 1500);

    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause wake word listener while a voice session is active
  useEffect(() => {
    if (voiceSessionActive) {
      _stopWakeWordListener();
    } else {
      // Restart when session ends
      const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
      if (settings.wakeWordEnabled !== false) {
        setTimeout(_startWakeWordListener, 800);
      }
    }
  }, [voiceSessionActive, _startWakeWordListener, _stopWakeWordListener]);

  // Stop wake word when window loses focus (alt-tab crash fix) — restart on return
  useEffect(() => {
    const onHide = () => {
      _stopWakeWordListener();
      isStartingRef.current = false;
    };
    const onShow = () => {
      const s = storage.get(STORAGE_KEYS.SETTINGS, {});
      if (s.wakeWordEnabled !== false && !voiceSessionRef.current && micGrantedRef.current) {
        setTimeout(_startWakeWordListener, 600);
      }
    };
    // Named reference required — anonymous functions can't be removed
    const handleVisibility = () => document.hidden ? onHide() : onShow();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', onHide);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', onHide);
      window.removeEventListener('focus', onShow);
    };
  }, [_startWakeWordListener, _stopWakeWordListener]);

  // ── Single-shot voice input (non-session, original behaviour) ───────────────
  const startListening = useCallback((onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    setOrbState('listening');
    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = 'en-AU';

    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      setOrbState('thinking');
      if (onResult) onResult(transcript);
      else sendMessage(transcript);
    };

    rec.onend   = () => { if (orbStateRef.current === 'listening') setOrbState('idle'); };
    rec.onerror = () => setOrbState('idle');

    recognitionRef.current = rec;
    rec.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setOrbState('idle');
  }, []);

  // ── Clear conversation ──────────────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    setMessages([]);
    storage.remove(STORAGE_KEYS.CONVERSATIONS);
  }, []);

  // ── Set active tab (called from App.jsx when tab changes) ───────────────────
  const setActiveTab = useCallback((tab) => {
    activeTabRef.current = tab;
  }, []);

  return {
    // Connection
    claudeOnline,
    ollamaOnline,
    internetOnline,
    lastPinged,
    pingAll,

    // Orb
    orbState,
    setOrbState,

    // Messages
    messages,
    loading,
    lastEngine,
    sendMessage,
    clearHistory,

    // Single-shot voice
    startListening,
    stopListening,

    // Continuous voice session
    voiceSessionActive,
    startVoiceSession,
    endVoiceSession,

    // Registration
    registerCallback,
    setActiveTab,

    // Memory (for display/debug)
    ltMemory,
  };
}

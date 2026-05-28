// ─── useAI — React hook for VALERIE's AI brain ────────────────────────────────
// Manages: connection status, orb state, message sending, TTS, history

import { useState, useEffect, useRef, useCallback } from 'react';
import { pingClaude } from './claude.js';
import { pingOllama } from './ollama.js';
import { routeMessage } from './router.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';

// TTS: speak text aloud via Web Speech API
function speak(text, voiceSettings = {}) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  if (voiceSettings.voiceURI) {
    const found = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
    if (found) utt.voice = found;
  }
  utt.rate  = voiceSettings.rate  ?? 1.0;
  utt.pitch = voiceSettings.pitch ?? 1.0;
  utt.volume = voiceSettings.volume ?? 1.0;
  window.speechSynthesis.speak(utt);
  return utt;
}

export function useAI() {
  // ── Connection state ──────────────────────────────────────────────────────
  const [claudeOnline,  setClaudeOnline]  = useState(false);
  const [ollamaOnline,  setOllamaOnline]  = useState(false);
  const [internetOnline, setInternetOnline] = useState(navigator.onLine);
  const [lastPinged, setLastPinged] = useState(null);

  // ── Orb visual state ──────────────────────────────────────────────────────
  const [orbState, setOrbState] = useState('idle'); // idle | listening | thinking | speaking

  // ── Conversation ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState(() => {
    return storage.get(STORAGE_KEYS.CONVERSATIONS, []);
  });
  const [loading, setLoading] = useState(false);
  const [lastEngine, setLastEngine] = useState(null);

  // ── Settings ──────────────────────────────────────────────────────────────
  const settingsRef = useRef(storage.get(STORAGE_KEYS.SETTINGS, {}));

  // ── Refs for stable closure access ───────────────────────────────────────
  const claudeOnlineRef  = useRef(claudeOnline);
  const ollamaOnlineRef  = useRef(ollamaOnline);
  useEffect(() => { claudeOnlineRef.current = claudeOnline; }, [claudeOnline]);
  useEffect(() => { ollamaOnlineRef.current = ollamaOnline; }, [ollamaOnline]);

  // ── Internet detection ────────────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setInternetOnline(true);
    const off = () => setInternetOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Ping Claude + Ollama (on mount and every 30s) ─────────────────────────
  const pingAll = useCallback(async () => {
    const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
    const apiKey = settings.apiKey ?? '';

    const [claude, ollama] = await Promise.all([
      pingClaude(apiKey),
      pingOllama(),
    ]);

    setClaudeOnline(claude);
    setOllamaOnline(ollama);
    setLastPinged(new Date());
  }, []);

  useEffect(() => {
    pingAll();
    const interval = setInterval(pingAll, 30_000);
    return () => clearInterval(interval);
  }, [pingAll]);

  // Re-ping when internet comes back
  useEffect(() => {
    if (internetOnline) pingAll();
  }, [internetOnline, pingAll]);

  // ── Persist conversations ─────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      storage.set(STORAGE_KEYS.CONVERSATIONS, messages.slice(-50));
    }
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loading) return;

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setOrbState('thinking');

    const settings = storage.get(STORAGE_KEYS.SETTINGS, {});
    const apiKey   = settings.apiKey ?? '';

    // Build history array for AI (strip timestamps)
    const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

    try {
      const { text: reply, engine } = await routeMessage({
        message: text,
        history,
        apiKey,
        claudeOnline: claudeOnlineRef.current,
        ollamaOnline: ollamaOnlineRef.current,
      });

      const assistantMsg = { role: 'assistant', content: reply, ts: Date.now(), engine };
      setMessages(prev => [...prev, assistantMsg]);
      setLastEngine(engine);

      // Speak the reply
      setOrbState('speaking');
      const voiceSettings = settings.voice ?? {};
      const utt = speak(reply, voiceSettings);
      if (utt) {
        utt.onend = () => setOrbState('idle');
        utt.onerror = () => setOrbState('idle');
      } else {
        setTimeout(() => setOrbState('idle'), 800);
      }
    } catch (err) {
      console.error('[useAI] sendMessage error:', err);
      setOrbState('idle');
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  // ── Voice input ───────────────────────────────────────────────────────────
  const recognitionRef = useRef(null);

  const startListening = useCallback((onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    setOrbState('listening');
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-AU';

    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      setOrbState('thinking');
      if (onResult) onResult(transcript);
      else sendMessage(transcript);
    };

    rec.onend  = () => { if (orbState === 'listening') setOrbState('idle'); };
    rec.onerror = () => setOrbState('idle');

    recognitionRef.current = rec;
    rec.start();
  }, [orbState, sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setOrbState('idle');
  }, []);

  // ── Clear conversation ────────────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    setMessages([]);
    storage.remove(STORAGE_KEYS.CONVERSATIONS);
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

    // Voice
    startListening,
    stopListening,
  };
}

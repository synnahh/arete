//  DailyBrief.jsx  Morning greeting + brief trigger 
// Shown once per day on first app open. VALERIE greets Rob and asks if he wants
// his brief. Accepting builds a context-rich message and sends it through the
// normal AI pipeline (she speaks it via TTS as usual).

import { useState, useEffect, useRef } from 'react';
import { platformFetch as fetch } from '../utils/platform.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { speakText, cancelCurrentSpeech } from '../ai/speech.js';
import { toLocalDateKey, isOnLocalDay } from '../utils/localDate.js';

// Fetch current weather from Open-Meteo (free, no API key, uses coordinates)
async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`,
      { method: 'GET' }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d?.current ?? null;
  } catch { return null; }
}

// Map WMO weather code to plain English
function weatherDescription(code) {
  if (code === 0)            return 'clear skies';
  if (code <= 2)             return 'partly cloudy';
  if (code === 3)            return 'overcast';
  if (code <= 49)            return 'foggy';
  if (code <= 59)            return 'drizzling';
  if (code <= 69)            return 'raining';
  if (code <= 79)            return 'snowing';
  if (code <= 84)            return 'rain showers';
  if (code <= 94)            return 'thunderstorms';
  return 'stormy';
}

function greetingByTime() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayISO() { return toLocalDateKey(new Date()); }

export default function DailyBrief({ ai, settings, onClose }) {
  const [visible,  setVisible]  = useState(false);
  const [building, setBuilding] = useState(false);
  const recRef = useRef(null);

  // Show only once per day  delay slightly to let network/ElevenLabs settle
  useEffect(() => {
    const lastShown = storage.get(STORAGE_KEYS.DAILY_BRIEF_DATE, null);
    if (lastShown === todayISO()) return;
    const t = setTimeout(() => setVisible(true), 4500);
    return () => clearTimeout(t);
  }, []);

  // Speak the greeting + ask for brief when modal appears; then listen for voice response
  useEffect(() => {
    if (!visible) return;
    const name     = settings?.userName || 'Rob';
    const greeting = greetingByTime();
    const question = `${greeting}, ${name}. Would you like your daily brief?`;

    const voiceSettings = settings?.voice ?? {};
    speakText(question, voiceSettings, {
      onEnd: () => {
        // After speaking, start voice recognition for yes/no response
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.continuous     = false;
        rec.interimResults = false;
        rec.lang           = 'en-AU';
        recRef.current     = rec;

        rec.onresult = (e) => {
          const transcript = (e.results[0]?.[0]?.transcript ?? '').toLowerCase().trim();
          recRef.current = null;
          if (transcript.includes('yes') || transcript.includes('yeah') || transcript.includes('sure') || transcript.includes('brief')) {
            startBrief();
          } else if (transcript.includes('no') || transcript.includes('later') || transcript.includes('dismiss')) {
            dismiss();
          }
        };

        rec.onerror = () => { recRef.current = null; };
        try { rec.start(); } catch {}
      },
    });

    return () => {
      cancelCurrentSpeech();
      if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() {
    storage.set(STORAGE_KEYS.DAILY_BRIEF_DATE, todayISO());
    setVisible(false);
    onClose?.();
  }

  async function startBrief() {
    setBuilding(true);
    storage.set(STORAGE_KEYS.DAILY_BRIEF_DATE, todayISO());

    const briefConfig = settings?.dailyBrief ?? {};
    const parts = [];

    //  Weather 
    if (briefConfig.weather !== false) {
      try {
        // Only request location if already granted — don't auto-prompt on iOS PWA
        const geoState = navigator.permissions
          ? (await navigator.permissions.query({ name: 'geolocation' }).catch(() => ({ state: 'granted' }))).state
          : 'granted';
        if (geoState === 'granted') {
          const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
          if (w) {
            parts.push(`Weather: ${Math.round(w.temperature_2m)}C and ${weatherDescription(w.weathercode)}, wind ${Math.round(w.windspeed_10m)} km/h.`);
          }
        }
      } catch { /* geolocation denied or unavailable */ }
    }

    //  Today's calendar events 
    if (briefConfig.calendar !== false) {
      const events = storage.get(STORAGE_KEYS.EVENTS, []);
      const todayEvents = events.filter(e => e.date === todayISO() || isOnLocalDay(e.start, todayISO()));
      if (todayEvents.length > 0) {
        parts.push(`Calendar: ${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''} today  ${todayEvents.map(e => e.title || e.summary).join(', ')}.`);
      } else {
        parts.push('Calendar: No events scheduled today.');
      }
    }

    //  Outstanding tasks 
    if (briefConfig.tasks !== false) {
      const tasks = storage.get(STORAGE_KEYS.TASKS, []);
      const open = tasks.filter(t => !t.completed);
      const high = open.filter(t => t.priority === 'high');
      if (high.length > 0) {
        parts.push(`Tasks: ${high.length} high-priority task${high.length > 1 ? 's' : ''} open  ${high.slice(0,3).map(t => t.title).join(', ')}.`);
      } else if (open.length > 0) {
        parts.push(`Tasks: ${open.length} open task${open.length > 1 ? 's' : ''}.`);
      } else {
        parts.push('Tasks: All clear.');
      }
    }

    //  Vitamins / supplements 
    if (briefConfig.vitamins !== false) {
      const supps = storage.get(STORAGE_KEYS.SUPPLEMENTS, []);
      const morning = supps.filter(s => s.active && (s.timing === 'morning' || !s.timing));
      if (morning.length > 0) {
        parts.push(`Vitamins: Remember to take ${morning.map(s => s.name).join(', ')}.`);
      }
    }

    //  Morning routine steps 
    if (briefConfig.routine !== false) {
      const routines = storage.get(STORAGE_KEYS.ROUTINES, []);
      const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
      const active = routines.find(r => r.reminder?.days?.includes(todayKey) || routines.length === 1);
      if (active?.steps?.length > 0) {
        parts.push(`Routine: ${active.name}  ${active.steps.slice(0, 4).map(s => s.label).join(', ')}${active.steps.length > 4 ? '&' : '.'}`);
      }
    }

    //  Compose and send to VALERIE 
    const now = new Date();
    const dayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    const briefMsg = [
      `Please give me my morning daily brief. Today is ${dayStr}.`,
      ...parts,
      'Give a smooth, natural spoken summary of the above. Keep it concise  cover the key points in one flowing response. Then wish Rob a good day.',
    ].join(' ');

    setVisible(false);
    onClose?.();
    await ai.sendMessage(briefMsg);
    setBuilding(false);
  }

  if (!visible) return null;

  const name = settings?.userName || 'Rob';
  const greeting = greetingByTime();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 420, background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 20,
        padding: '36px 36px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        {/* VALERIE orb placeholder */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, var(--accent), #0a0f1e)',
          boxShadow: '0 0 32px rgba(var(--accent-rgb, 120,80,255),0.4)',
          marginBottom: 22,
        }} />

        <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
          {greeting}, {name}.
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center', lineHeight: 1.6 }}>
          Covering weather, schedule, tasks, vitamins, and morning routine.
        </div>

        <div style={{ fontSize: 12, color: 'rgba(74,158,255,0.7)', marginBottom: 22, textAlign: 'center' }}>
          🎤 Listening for "yes" or "no"...
        </div>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={startBrief}
            disabled={building}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 500,
              opacity: building ? 0.7 : 1,
            }}
          >
            {building ? 'Building brief…' : 'Yes, brief me'}
          </button>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: 14,
            }}
          >
            Maybe later
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
          Configure what's included in Settings  Daily Brief
        </div>
      </div>
    </div>
  );
}

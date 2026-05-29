// ─── Settings Tab — Session 6 ────────────────────────────────────────────────
// Full 11-section settings hub. Every change persists to localStorage instantly.
// Split view: left nav (130px) + right scrollable content.

import { useState, useEffect, useCallback, useRef } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { THEMES, applyTheme }    from '../styles/themes.js';
import { testClaudeKey }                       from '../ai/claude.js';
import { TIER_CONFIG, TIER_THRESHOLDS, XP_SOURCES } from '../utils/xp.js';

// ─── Sections ────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'identity',      label: 'Identity',         icon: '👤' },
  { id: 'appearance',    label: 'Appearance',       icon: '🎨' },
  { id: 'voice',         label: 'Voice',            icon: '🎙️' },
  { id: 'ai',            label: 'AI',               icon: '🧠' },
  { id: 'units',         label: 'Units & Currency', icon: '💱' },
  { id: 'progress',      label: 'Progress & Rank',  icon: '⭐' },
  { id: 'notifications', label: 'Notifications',    icon: '🔔' },
  { id: 'integrations',  label: 'Integrations',     icon: '🔌' },
  { id: 'api_usage',     label: 'API Usage',        icon: '📊' },
  { id: 'platforms',     label: 'Platforms',        icon: '🖥️' },
  { id: 'data',          label: 'Data',             icon: '💾' },
  { id: 'security',      label: 'Security',         icon: '🔒' },
];

// ─── Currency & Unit constants ────────────────────────────────────────────────
export const CURRENCIES = [
  { code: 'AUD', symbol: '$',  label: 'AUD — Australian Dollar' },
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar'         },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound'     },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro'              },
];

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Row({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
      margin: '0 0 22px', paddingBottom: 12,
      borderBottom: '0.5px solid var(--sidebar-divider)',
    }}>
      {children}
    </h2>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '', masked = false }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={masked && !show ? 'password' : type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px',
          paddingRight: masked ? 40 : 12,
          boxSizing: 'border-box',
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
          outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
      />
      {masked && (
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 11,
          }}
        >
          {show ? 'hide' : 'show'}
        </button>
      )}
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      onClick={() => onChange(!value)}
    >
      {label && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>}
      <div style={{
        width: 40, height: 22, borderRadius: 11, position: 'relative',
        background: value ? 'var(--accent)' : 'var(--hover-bg)',
        border: '0.5px solid var(--card-border)',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  );
}

function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: `0.5px solid ${value === opt.value ? 'var(--accent)' : 'var(--card-border)'}`,
            background: value === opt.value ? 'var(--accent)22' : 'var(--hover-bg)',
            color: value === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: value === opt.value ? 700 : 400,
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ value, onChange, min, max, step = 1, suffix = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)' }}
      />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 36 }}>
        {value}{suffix}
      </span>
    </div>
  );
}

function SavedBadge({ show }) {
  return (
    <span style={{
      fontSize: 11, color: '#4caf7d',
      opacity: show ? 1 : 0, transition: 'opacity 0.4s',
      marginLeft: 8,
    }}>
      ✓ Saved
    </span>
  );
}

// ─── Section: Identity ────────────────────────────────────────────────────────
function IdentitySection({ settings, onSave }) {
  const [form, setForm] = useState({
    assistantName:    settings.assistantName    || 'VALERIE',
    userName:         settings.userName         || 'Rob',
    personality:      settings.personality      || 'balanced',
    greeting:         settings.greeting         ?? true,
    customPrompt:     settings.customPrompt     || '',
  });
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>Identity <SavedBadge show={saved} /></SectionTitle>

      <Row label="Assistant name" hint="Displayed everywhere and used in all voice responses">
        <Input value={form.assistantName} onChange={v => set('assistantName', v)} placeholder="VALERIE" />
      </Row>

      <Row label="Your name" hint="What VALERIE calls you">
        <Input value={form.userName} onChange={v => set('userName', v)} placeholder="Rob" />
      </Row>

      <Row label="Personality" hint="How VALERIE speaks and engages">
        <PillGroup
          value={form.personality}
          onChange={v => set('personality', v)}
          options={[
            { value: 'professional', label: 'Professional' },
            { value: 'balanced',     label: 'Balanced'     },
            { value: 'casual',       label: 'Casual'       },
            { value: 'full',         label: 'Full character' },
          ]}
        />
      </Row>

      <Row label="Greet on launch">
        <Toggle value={form.greeting} onChange={v => set('greeting', v)} />
      </Row>

      <Row label="Custom context" hint="Personal info VALERIE always knows — e.g. 'I work nights. I lift 4x a week.'">
        <textarea
          value={form.customPrompt}
          onChange={e => set('customPrompt', e.target.value)}
          rows={4}
          placeholder="Add any personal context you want VALERIE to always know about you…"
          style={{
            width: '100%', padding: '9px 12px', boxSizing: 'border-box',
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
            resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.55,
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
        />
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Identity
      </button>
    </div>
  );
}

// ─── Font options from design spec ───────────────────────────────────────────
const FONTS = [
  { value: "'Exo 2', sans-serif",     label: 'Exo 2',    description: 'Sharp · geometric · tech forward' },
  { value: "'DM Sans', sans-serif",   label: 'DM Sans',  description: 'Clean · minimal · professional'  },
  { value: "'Orbitron', sans-serif",  label: 'Orbitron', description: 'Futuristic · bold · strong'      },
  { value: "'Sora', sans-serif",      label: 'Sora',     description: 'Elegant · soft · premium'        },
  { value: "'Inter', sans-serif",     label: 'Inter',    description: 'Gold standard clean UI'          },
  { value: "'Geist Sans', sans-serif",label: 'Geist',    description: 'Ultra minimal · Vercel'          },
];

// ─── Section: Appearance ──────────────────────────────────────────────────────
function AppearanceSection({ settings, onSave }) {
  const [theme,       setTheme]       = useState(settings.theme             || 'obsidian');
  const [orbShape,    setOrbShape]    = useState(settings.orbShape           || 'sphere');
  const [animLevel,   setAnimLevel]   = useState(settings.animationIntensity || 'full');
  const [bgStyle,     setBgStyle]     = useState(settings.backgroundStyle    || 'time-of-day');
  const [fontFamily,  setFontFamily]  = useState(settings.fontFamily         || "'DM Sans', sans-serif");
  const [accentColor, setAccentColor] = useState(settings.accentColorHex     || '');
  const [saved, setSaved] = useState(false);

  const handleTheme = (key) => {
    setTheme(key);
    applyTheme(key);
    // Clear custom accent when switching theme
    setAccentColor('');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-solid');
    onSave({ theme: key, accentColorHex: '' });
  };

  const handleFont = (fontValue) => {
    setFontFamily(fontValue);
    document.documentElement.style.setProperty('--font-family', fontValue);
    onSave({ fontFamily: fontValue });
  };

  const handleAccentColor = (hex) => {
    setAccentColor(hex);
    // Apply to CSS vars immediately
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-solid', hex);
    onSave({ accentColorHex: hex });
  };

  const handleSave = () => {
    onSave({ orbShape, animationIntensity: animLevel, backgroundStyle: bgStyle });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>Appearance <SavedBadge show={saved} /></SectionTitle>

      {/* Theme grid */}
      <Row label="Theme" hint="Switches instantly — no reload">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {Object.values(THEMES).map(t => (
            <button
              key={t.key}
              onClick={() => handleTheme(t.key)}
              style={{
                padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${theme === t.key ? 'var(--accent)' : 'var(--card-border)'}`,
                background: t.preview.bg,
                display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: theme === t.key ? '0 0 0 2px var(--accent)55' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.preview.sidebar }} />
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.preview.bg }} />
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.preview.accent }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: t.light ? '#1a1a2e' : '#fff', textAlign: 'left' }}>
                {t.name}
              </span>
              <span style={{ fontSize: 9.5, color: t.light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)', textAlign: 'left', lineHeight: 1.3 }}>
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </Row>

      {/* Custom accent colour */}
      <Row label="Custom accent colour" hint="Overrides the theme's default accent — applies to orb, highlights, active states">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="color"
            value={accentColor || '#d2d2d2'}
            onChange={e => handleAccentColor(e.target.value)}
            style={{
              width: 44, height: 36, padding: 2, cursor: 'pointer',
              background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
              borderRadius: 8,
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
            {accentColor ? `Custom: ${accentColor}` : 'Using theme default'}
          </span>
          {accentColor && (
            <button
              onClick={() => { setAccentColor(''); document.documentElement.style.removeProperty('--accent'); document.documentElement.style.removeProperty('--accent-solid'); onSave({ accentColorHex: '' }); }}
              style={{ padding: '5px 10px', borderRadius: 6, border: '0.5px solid var(--card-border)', background: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
        </div>
      </Row>

      {/* Font selector */}
      <Row label="Font" hint="Applied instantly across the entire app">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FONTS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFont(f.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: `0.5px solid ${fontFamily === f.value ? 'var(--accent)' : 'var(--card-border)'}`,
                background: fontFamily === f.value ? 'var(--accent)11' : 'var(--hover-bg)',
                transition: 'all 0.15s',
              }}
            >
              <div>
                <span style={{
                  fontFamily: f.value, fontSize: 14, fontWeight: 600,
                  color: fontFamily === f.value ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {f.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {f.description}
                </span>
              </div>
              {fontFamily === f.value && <span style={{ color: 'var(--accent)', fontSize: 13 }}>✓</span>}
            </button>
          ))}
        </div>
      </Row>

      {/* Orb shape */}
      <Row label="Orb shape" hint="Visual shape of the VALERIE voice orb">
        <PillGroup
          value={orbShape}
          onChange={setOrbShape}
          options={[
            { value: 'sphere',  label: 'Sphere'  },
            { value: 'ring',    label: 'Ring'    },
            { value: 'diamond', label: 'Diamond' },
            { value: 'cube',    label: 'Cube'    },
          ]}
        />
      </Row>

      {/* Animation intensity */}
      <Row label="Animation intensity">
        <PillGroup
          value={animLevel}
          onChange={setAnimLevel}
          options={[
            { value: 'full',    label: 'Full'    },
            { value: 'reduced', label: 'Reduced' },
            { value: 'none',    label: 'None'    },
          ]}
        />
      </Row>

      {/* Background style */}
      <Row label="Background" hint="How the app background behaves">
        <PillGroup
          value={bgStyle}
          onChange={setBgStyle}
          options={[
            { value: 'time-of-day',       label: 'Time of day' },
            { value: 'animated-gradient', label: 'Animated'    },
            { value: 'solid',             label: 'Solid'       },
            { value: 'noise',             label: 'Noise'       },
          ]}
        />
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Appearance
      </button>
    </div>
  );
}

// ─── Section: Voice ────────────────────────────────────────────────────────────
function VoiceSection({ settings, onSave }) {

  // ── ElevenLabs state ──────────────────────────────────────────────────────
  const [el11Key,     setEl11Key]     = useState(
    settings.elevenlabsKey || import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  );
  const [el11VoiceId, setEl11VoiceId] = useState(
    settings.elevenlabsVoiceId || import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'yj30vwTGJxSHezdAGsv9'
  );
  const [el11Voices,  setEl11Voices]  = useState([]);
  const [el11Loading, setEl11Loading] = useState(false);
  const [el11Error,   setEl11Error]   = useState('');
  const [el11Playing, setEl11Playing] = useState(false);
  const [el11PreviewErr, setEl11PreviewErr] = useState('');

  // ── Browser TTS fallback state ────────────────────────────────────────────
  const [sysVoices,   setSysVoices]   = useState([]);
  const [voiceURI,    setVoiceURI]    = useState(settings.voice?.voiceURI || '');
  const [rate,        setRate]        = useState(settings.voice?.rate     ?? 0.95);
  const [pitch,       setPitch]       = useState(settings.voice?.pitch    ?? 1.0);

  // ── Azure state ───────────────────────────────────────────────────────────
  const [azureKey,    setAzureKey]    = useState(settings.azureKey || '');
  const [saved,       setSaved]       = useState(false);

  // Fetch available voices from ElevenLabs API
  const fetchEl11Voices = async (key) => {
    if (!key?.trim()) return;
    setEl11Loading(true);
    setEl11Error('');
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`ElevenLabs API ${res.status} — check your key`);
      const data = await res.json();
      const sorted = (data.voices || []).sort((a, b) => a.name.localeCompare(b.name));
      setEl11Voices(sorted);
    } catch (err) {
      setEl11Error(err.message || 'Could not reach ElevenLabs');
    } finally {
      setEl11Loading(false);
    }
  };

  // Load system TTS voices
  useEffect(() => {
    const load = () => setSysVoices(window.speechSynthesis?.getVoices() || []);
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // Auto-fetch ElevenLabs voices on mount if key is already set
  useEffect(() => {
    if (el11Key) fetchEl11Voices(el11Key);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview using ElevenLabs — plays real audio from her voice
  const handleEl11Preview = async () => {
    if (!el11Key || el11Playing) return;
    setEl11Playing(true);
    setEl11PreviewErr('');
    try {
      const trimmedKey = el11Key.trim();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${el11VoiceId}`, {
        method:  'POST',
        headers: { 'xi-api-key': trimmedKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text:           "Ready when you are, Rob.",
          model_id:       'eleven_turbo_v2_5',
          voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.20, use_speaker_boost: true },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const msg = res.status === 401 ? '401 — API key is invalid or unauthorised'
          : res.status === 402 ? '402 — Free plan limit reached. Upgrade ElevenLabs or use System TTS below (app falls back automatically).'
          : res.status === 403 ? '403 — This key does not have TTS access'
          : res.status === 422 ? '422 — Voice ID not found on this account'
          : `Error ${res.status}${errText ? ': ' + errText.slice(0, 80) : ''}`;
        throw new Error(msg);
      }
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setEl11Playing(false); };
      audio.onerror = (e) => {
        setEl11PreviewErr('Audio playback failed — check that audio is not muted');
        setEl11Playing(false);
      };
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(err => {
          setEl11PreviewErr(`Playback blocked: ${err.message}`);
          setEl11Playing(false);
        });
      }
    } catch (err) {
      setEl11PreviewErr(err.message || 'Preview failed');
      setEl11Playing(false);
    }
  };

  // Preview using browser TTS (fallback only)
  const handleSysPreview = () => {
    window.speechSynthesis.cancel();
    const utt   = new SpeechSynthesisUtterance("Ready when you are, Rob.");
    const found = sysVoices.find(v => v.voiceURI === voiceURI);
    if (found) utt.voice = found;
    utt.rate  = rate;
    utt.pitch = pitch;
    window.speechSynthesis.speak(utt);
  };

  const [wakeWordEnabled, setWakeWordEnabled] = useState(settings.wakeWordEnabled ?? true);

  const handleSave = () => {
    onSave({
      voice: {
        voiceURI, rate, pitch, volume: 1.0, lang: 'en-AU',
        elevenlabsKey:     el11Key,
        elevenlabsVoiceId: el11VoiceId,
      },
      azureKey,
      elevenlabsKey:     el11Key,
      elevenlabsVoiceId: el11VoiceId,
      wakeWordEnabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isEl11Active      = !!el11Key;
  const defaultVoiceId    = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'yj30vwTGJxSHezdAGsv9';
  const selectedVoiceName = el11Voices.find(v => v.voice_id === el11VoiceId)?.name || '';
  const enSysVoices       = sysVoices.filter(v => v.lang?.startsWith('en'));

  return (
    <div>
      <SectionTitle>Voice <SavedBadge show={saved} /></SectionTitle>

      {/* Active engine banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 10, marginBottom: 22,
        background: isEl11Active ? '#4caf7d14' : 'var(--hover-bg)',
        border: `1px solid ${isEl11Active ? '#4caf7d44' : 'var(--card-border)'}`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: isEl11Active ? '#4caf7d' : '#666',
          boxShadow: isEl11Active ? '0 0 6px #4caf7d99' : 'none',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isEl11Active ? 'ElevenLabs — Active' : 'System TTS — Active'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {isEl11Active
              ? `Priority order: ElevenLabs → Azure Neural → System${selectedVoiceName ? ` · ${selectedVoiceName}` : ''}`
              : "Add an ElevenLabs API key below to enable VALERIE's real voice"}
          </div>
        </div>
      </div>

      {/* ─── ElevenLabs block ─────────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${isEl11Active ? 'var(--accent)55' : 'var(--card-border)'}`,
        borderRadius: 12, padding: '16px 18px', marginBottom: 20,
        background: isEl11Active ? 'var(--accent)07' : 'var(--hover-bg)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8,
          color: isEl11Active ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          ELEVENLABS
          {isEl11Active && (
            <span style={{
              fontSize: 9, background: '#4caf7d22', color: '#4caf7d',
              padding: '2px 8px', borderRadius: 10, fontWeight: 700, letterSpacing: '0.04em',
            }}>ACTIVE</span>
          )}
        </div>

        {/* API key + load button */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>API Key</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input value={el11Key} onChange={setEl11Key} placeholder="sk_…" masked />
            </div>
            <button
              onClick={() => fetchEl11Voices(el11Key)}
              disabled={!el11Key || el11Loading}
              style={{
                padding: '0 14px', borderRadius: 8, flexShrink: 0,
                border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)',
                color: 'var(--text-secondary)', fontSize: 12,
                cursor: !el11Key || el11Loading ? 'not-allowed' : 'pointer',
                opacity: !el11Key || el11Loading ? 0.5 : 1,
              }}
            >
              {el11Loading ? '…' : 'Load voices'}
            </button>
          </div>
          {el11Error && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#e55a5a' }}>{el11Error}</p>
          )}
        </div>

        {/* Voice dropdown */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>
            Voice {el11Voices.length > 0 ? `(${el11Voices.length} available)` : '— click Load voices to fetch'}
          </div>
          <select
            value={el11VoiceId}
            onChange={e => setEl11VoiceId(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
            }}
          >
            {el11Voices.length === 0 ? (
              <option value={el11VoiceId}>
                {el11VoiceId ? `${el11VoiceId} (load voices to see name)` : 'Enter key and click Load voices'}
              </option>
            ) : (
              el11Voices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}
                  {v.voice_id === defaultVoiceId ? ' ★ VALERIE default' : ''}
                  {v.labels?.accent ? ` — ${v.labels.accent}` : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Preview button + error */}
        <button
          onClick={handleEl11Preview}
          disabled={!el11Key || el11Playing}
          style={{
            padding: '7px 16px', borderRadius: 8,
            border: `0.5px solid ${isEl11Active ? 'var(--accent)' : 'var(--card-border)'}`,
            background: isEl11Active ? 'var(--accent)15' : 'var(--hover-bg)',
            color: isEl11Active ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 12,
            cursor: !el11Key || el11Playing ? 'not-allowed' : 'pointer',
            opacity: !el11Key || el11Playing ? 0.5 : 1,
          }}
        >
          {el11Playing ? '▶ Playing…' : "▶ Preview VALERIE's voice"}
        </button>
        {el11PreviewErr && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#e55a5a', lineHeight: 1.4 }}>
            {el11PreviewErr}
          </p>
        )}
      </div>

      {/* ─── Azure fallback ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.06em', marginBottom: 8,
        }}>
          AZURE NEURAL VOICES <span style={{ fontWeight: 400 }}>(fallback tier 2)</span>
        </div>
        <Input value={azureKey} onChange={setAzureKey} placeholder="Your Azure Cognitive Services key" masked />
      </div>

      {/* ─── System TTS fallback ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.06em', marginBottom: 8,
        }}>
          SYSTEM VOICE <span style={{ fontWeight: 400 }}>(fallback tier 3)</span>
        </div>
        <select
          value={voiceURI}
          onChange={e => setVoiceURI(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', marginBottom: 10,
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
          }}
        >
          <option value="">— System default —</option>
          {enSysVoices.map(v => (
            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Rate</div>
            <Slider value={rate} onChange={setRate} min={0.5} max={2.0} step={0.05} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Pitch</div>
            <Slider value={pitch} onChange={setPitch} min={0.5} max={2.0} step={0.05} />
          </div>
        </div>

        <button
          onClick={handleSysPreview}
          style={{
            padding: '6px 14px', borderRadius: 8,
            border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}
        >
          ▶ Preview system voice
        </button>
      </div>

      {/* Wake word */}
      <Row
        label="Hey VAL / Hey Valerie wake word"
        hint="Always-on mic listens for your wake phrase to start a voice session hands-free"
      >
        <Toggle value={wakeWordEnabled} onChange={setWakeWordEnabled} />
        {wakeWordEnabled && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8,
            background: 'var(--accent)08', border: '0.5px solid var(--accent)33',
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            Say <strong style={{ color: 'var(--accent)' }}>"Hey VAL"</strong> or{' '}
            <strong style={{ color: 'var(--accent)' }}>"Hey Valerie"</strong> at any time to activate. Requires microphone permission.
          </div>
        )}
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Voice Settings
      </button>
    </div>
  );
}

// ─── Section: AI ───────────────────────────────────────────────────────────────
function AISection({ settings, onSave }) {
  const [apiKey,        setApiKey]        = useState(settings.apiKey        || '');
  const [ollamaModel,   setOllamaModel]   = useState(settings.ollamaModel   || 'llama3');
  const [preferOffline, setPreferOffline] = useState(settings.preferOffline ?? false);
  const [tokenBudget,   setTokenBudget]   = useState(settings.dailyTokenBudget || 100000);
  const [smartRouting,  setSmartRouting]  = useState(settings.smartRouting  ?? true);
  const [ollamaModels,  setOllamaModels]  = useState([]);
  const [saved,         setSaved]         = useState(false);
  const [testResult,    setTestResult]    = useState(null); // { ok, reason }
  const [testing,       setTesting]       = useState(false);

  useEffect(() => {
    fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
      .then(r => r.json())
      .then(d => setOllamaModels((d.models || []).map(m => m.name)))
      .catch(() => {});
  }, []);

  const handleSave = () => {
    onSave({ apiKey: apiKey.trim(), ollamaModel, preferOffline, dailyTokenBudget: tokenBudget, smartRouting });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setTestResult(null); // clear old test result after save
  };

  const handleTest = async () => {
    if (!apiKey.trim() || testing) return;
    setTesting(true);
    setTestResult(null);
    const result = await testClaudeKey(apiKey.trim());
    setTestResult(result);
    setTesting(false);
    // If test passed, also save the key immediately
    if (result.ok) {
      onSave({ apiKey: apiKey.trim() });
    }
  };

  return (
    <div>
      <SectionTitle>AI Configuration <SavedBadge show={saved} /></SectionTitle>

      {/* Claude API key + test */}
      <Row
        label="Claude API key"
        hint="Your Anthropic API key — stored locally, never transmitted except to api.anthropic.com"
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <Input value={apiKey} onChange={v => { setApiKey(v); setTestResult(null); }} placeholder="sk-ant-…" masked />
          </div>
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            style={{
              padding: '0 16px', borderRadius: 8, flexShrink: 0,
              border: `0.5px solid ${testResult?.ok ? '#4caf7d' : testResult ? '#e55a5a' : 'var(--card-border)'}`,
              background: testResult?.ok ? '#4caf7d15' : testResult ? '#e55a5a15' : 'var(--hover-bg)',
              color: testResult?.ok ? '#4caf7d' : testResult ? '#e55a5a' : 'var(--text-secondary)',
              fontSize: 12, cursor: !apiKey.trim() || testing ? 'not-allowed' : 'pointer',
              opacity: !apiKey.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            {testing ? '…testing' : testResult?.ok ? '✓ Connected' : 'Test connection'}
          </button>
        </div>
        {testResult && !testResult.ok && (
          <p style={{ margin: 0, fontSize: 11, color: '#e55a5a', lineHeight: 1.4 }}>
            {testResult.reason}
          </p>
        )}
        {testResult?.ok && (
          <p style={{ margin: 0, fontSize: 11, color: '#4caf7d' }}>
            {testResult.reason} — key saved automatically.
          </p>
        )}
      </Row>

      <Row label="Ollama model" hint="Local AI model — Ollama must be running at localhost:11434">
        {ollamaModels.length > 0 ? (
          <select
            value={ollamaModel}
            onChange={e => setOllamaModel(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
            }}
          >
            {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Input value={ollamaModel} onChange={setOllamaModel} placeholder="llama3" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Ollama offline</span>
          </div>
        )}
      </Row>

      <Row label="Prefer offline model" hint="Use Ollama first — only switch to Claude for complex tasks">
        <Toggle value={preferOffline} onChange={setPreferOffline} />
      </Row>

      <Row label="Smart routing" hint="Auto-select best AI engine per message type">
        <Toggle value={smartRouting} onChange={setSmartRouting} />
      </Row>

      <Row label="Daily token budget" hint="Approximate max tokens per day — VALERIE warns when approaching">
        <Slider value={tokenBudget} onChange={setTokenBudget} min={10000} max={500000} step={10000} suffix=" tok" />
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save AI Settings
      </button>
    </div>
  );
}

// ─── Section: Units & Currency ────────────────────────────────────────────────
function UnitsSection({ settings, onSave }) {
  const [currency, setCurrency] = useState(settings.currency || 'AUD');
  const [units,    setUnits]    = useState(settings.units    || 'metric');
  const [saved,    setSaved]    = useState(false);

  const handleSave = () => {
    onSave({ currency, units });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>Units & Currency <SavedBadge show={saved} /></SectionTitle>

      <Row label="Currency" hint="Used across Finance, Style, and any price display throughout the app">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${currency === c.code ? 'var(--accent)' : 'var(--card-border)'}`,
                background: currency === c.code ? 'var(--accent)11' : 'var(--hover-bg)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: currency === c.code ? 'var(--accent)22' : 'var(--bg-panel)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
                color: currency === c.code ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
                {c.symbol}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: currency === c.code ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {c.code}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.label.split(' — ')[1]}</div>
              </div>
              {currency === c.code && (
                <div style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 16 }}>✓</div>
              )}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Measurement units" hint="Used across Health, body metrics, workout logs, and water tracking">
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { value: 'metric',   label: 'Metric',   sub: 'kg · cm · km · ml' },
            { value: 'imperial', label: 'Imperial', sub: 'lbs · in · miles · fl oz' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setUnits(opt.value)}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${units === opt.value ? 'var(--accent)' : 'var(--card-border)'}`,
                background: units === opt.value ? 'var(--accent)11' : 'var(--hover-bg)',
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: units === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                marginBottom: 4,
              }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Units & Currency
      </button>
    </div>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────
function NotificationsSection({ settings, onSave }) {
  const [enabled,       setEnabled]       = useState(settings.notifications?.enabled       ?? true);
  const [nudges,        setNudges]        = useState(settings.notifications?.proactiveNudges ?? true);
  const [taskReminders, setTaskReminders] = useState(settings.notifications?.taskReminders  ?? true);
  const [habitRemind,   setHabitRemind]   = useState(settings.notifications?.habitReminders  ?? true);
  const [waterRemind,   setWaterRemind]   = useState(settings.notifications?.waterReminders  ?? false);
  const [weeklyFinance, setWeeklyFinance] = useState(settings.notifications?.weeklyFinance   ?? true);
  const [twilioNumber,  setTwilioNumber]  = useState(settings.twilioNumber  || '');
  const [phoneNumber,   setPhoneNumber]   = useState(settings.phoneNumber   || '');
  const [saved,         setSaved]         = useState(false);

  const handleSave = () => {
    onSave({
      notifications: { enabled, proactiveNudges: nudges, taskReminders, habitReminders: habitRemind, waterReminders: waterRemind, weeklyFinance },
      twilioNumber,
      phoneNumber,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>Notifications <SavedBadge show={saved} /></SectionTitle>

      <Row label="Enable notifications" hint="Master toggle for all VALERIE notifications">
        <Toggle value={enabled} onChange={setEnabled} />
      </Row>

      {enabled && (
        <>
          <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--hover-bg)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
              VALERIE NUDGES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Toggle label="Proactive nudges (max 3/day)" value={nudges}        onChange={setNudges} />
              <Toggle label="Task due reminders"            value={taskReminders} onChange={setTaskReminders} />
              <Toggle label="Habit reminders"              value={habitRemind}    onChange={setHabitRemind} />
              <Toggle label="Water intake reminders"       value={waterRemind}    onChange={setWaterRemind} />
              <Toggle label="Weekly finance summary"       value={weeklyFinance}  onChange={setWeeklyFinance} />
            </div>
          </div>

          <Row label="Twilio SMS number (sender)" hint="Your Twilio phone number for SMS alerts — optional">
            <Input value={twilioNumber} onChange={setTwilioNumber} placeholder="+614XXXXXXXX" />
          </Row>
          <Row label="Your phone number (recipient)">
            <Input value={phoneNumber} onChange={setPhoneNumber} placeholder="+614XXXXXXXX" />
          </Row>
        </>
      )}

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Notifications
      </button>
    </div>
  );
}

// ─── Section: Integrations ────────────────────────────────────────────────────
function IntegrationsSection({ settings, onSave }) {
  const [googleSearchKey, setGoogleSearchKey] = useState(settings.googleSearchKey || '');
  const [googleSearchCx,  setGoogleSearchCx]  = useState(settings.googleSearchCx  || '');
  const [exerciseDbKey,   setExerciseDbKey]   = useState(settings.exerciseDbKey   || '');
  const [saved,           setSaved]           = useState(false);

  const handleSave = () => {
    onSave({ googleSearchKey, googleSearchCx, exerciseDbKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const OAuthStub = ({ name, connected, icon }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: 10,
      border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {connected ? 'Connected' : 'Not connected'}
          </div>
        </div>
      </div>
      <button style={{
        padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        border: connected ? '0.5px solid #e55a5a55' : '0.5px solid var(--accent)55',
        background: connected ? 'rgba(229,90,90,0.1)' : 'var(--accent)11',
        color: connected ? '#e55a5a' : 'var(--accent)',
      }}>
        {connected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  );

  return (
    <div>
      <SectionTitle>Integrations <SavedBadge show={saved} /></SectionTitle>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          OAUTH SERVICES
        </div>
        <OAuthStub name="Google Calendar"   connected={false} icon="📅" />
        <OAuthStub name="Spotify"           connected={false} icon="🎵" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          API KEYS
        </div>

        <Row label="Google Custom Search — API key" hint="Enables real shopping results in the Style tab. Free tier: 100 searches/day">
          <Input value={googleSearchKey} onChange={setGoogleSearchKey} placeholder="AIza…" masked />
        </Row>
        <Row label="Google Custom Search — Engine ID (cx)" hint="Create at programmablesearchengine.google.com">
          <Input value={googleSearchCx} onChange={setGoogleSearchCx} placeholder="12345:abcdef" />
        </Row>
        <Row label="ExerciseDB API key" hint="Exercise library with GIFs for workout planning. Free tier available at rapidapi.com">
          <Input value={exerciseDbKey} onChange={setExerciseDbKey} placeholder="Your RapidAPI key" masked />
        </Row>
      </div>

      <div style={{
        background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
        marginBottom: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Webhooks</strong> — Connect to Zapier, Make, or n8n.
        Define outgoing webhook URLs for task completion, mood logs, focus sessions, and custom events.
        <br />
        <span style={{ color: 'var(--accent)', cursor: 'pointer', marginTop: 6, display: 'inline-block' }}>
          Coming in next session →
        </span>
      </div>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Integration Keys
      </button>
    </div>
  );
}

// ─── Section: API Usage ────────────────────────────────────────────────────────
// NOTE: Anthropic does not expose a public credit balance endpoint via API key.
// Usage data is only available at console.anthropic.com.
// This section shows locally tracked token estimates and links to the console.
function ApiUsageSection({ settings }) {
  // Read locally tracked usage from storage (we track tokens when we make calls)
  const localLog   = storage.get('valerie_xp', { total: 0, log: [] });
  const currency   = settings.currency || 'AUD';
  const currSymbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  const rate       = currency === 'AUD' ? 1.55 : currency === 'GBP' ? 0.64 : currency === 'EUR' ? 0.73 : 1.0;

  const hasKey = !!settings.apiKey?.trim();

  return (
    <div>
      <SectionTitle>API Usage</SectionTitle>

      {!hasKey ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
          Add your Claude API key in <strong style={{ color: 'var(--text-primary)' }}>Settings → AI</strong> first.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Console link — primary action */}
          <div style={{
            padding: '18px 20px', borderRadius: 12,
            background: 'var(--accent)08', border: '1px solid var(--accent)33',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              Monitor your usage
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.55 }}>
              Anthropic's API doesn't expose a public balance endpoint — exact credit usage,
              remaining balance, and per-model breakdown are only available at the Console.
            </div>
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', color: 'var(--bg-base)',
                fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}
            >
              Open Anthropic Console ↗
            </a>
          </div>

          {/* Pricing reference */}
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 10 }}>
              CLAUDE SONNET 4 PRICING REFERENCE
            </div>
            {[
              { label: 'Input tokens',  price: `${currSymbol}${(3.0 * rate).toFixed(2)}/M` },
              { label: 'Output tokens', price: `${currSymbol}${(15.0 * rate).toFixed(2)}/M` },
              { label: 'Typical session (~4K tokens)', price: `≈ ${currSymbol}${(0.004 * 15.0 * rate).toFixed(4)}` },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '0.5px solid var(--card-border)',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span>{row.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.price}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
              Prices approximate. Check console.anthropic.com for exact billing.
            </div>
          </div>

          {/* XP / activity as a proxy for usage */}
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 8 }}>
              LOCAL ACTIVITY TRACKER
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {localLog.total.toLocaleString()} XP accumulated
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {(localLog.log || []).length} logged events · VALERIE gets smarter with each interaction
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Progress & Rank ─────────────────────────────────────────────────
// Per the Progress Tab Design spec: tier names renameable, XP thresholds
// adjustable, XP per action adjustable, option to hide rank system entirely.
function ProgressSection({ settings, onSave }) {
  const rankSettings  = settings.rankSettings || {};
  const xpSettings    = settings.xpSettings   || {};

  // Tier names — defaults from TIER_CONFIG, overridable
  const [tierNames,    setTierNames]    = useState(() =>
    TIER_CONFIG.map(t => rankSettings.tierNames?.[t.tier] || t.name)
  );
  // XP thresholds — defaults from TIER_CONFIG
  const [thresholds,   setThresholds]   = useState(() =>
    TIER_CONFIG.map((t, i) => rankSettings.thresholds?.[t.tier] ?? TIER_THRESHOLDS[i] ?? 0)
  );
  // XP per action
  const [xpValues,     setXpValues]     = useState(() => ({
    TASK_COMPLETED:  xpSettings.TASK_COMPLETED  ?? 10,
    HABIT_DAILY:     xpSettings.HABIT_DAILY     ?? 25,
    WORKOUT_LOGGED:  xpSettings.WORKOUT_LOGGED  ?? 20,
    GOAL_MILESTONE:  xpSettings.GOAL_MILESTONE  ?? 50,
    FOCUS_SESSION:   xpSettings.FOCUS_SESSION   ?? 15,
    MACROS_HIT:      xpSettings.MACROS_HIT      ?? 20,
    UNDER_BUDGET:    xpSettings.UNDER_BUDGET     ?? 30,
    MOOD_LOGGED:     xpSettings.MOOD_LOGGED      ?? 5,
    WATER_GOAL:      xpSettings.WATER_GOAL       ?? 10,
  }));
  const [hideRank,     setHideRank]     = useState(settings.hideRankSystem ?? false);
  const [saved,        setSaved]        = useState(false);

  const setTierName   = (i, v) => setTierNames(p => p.map((n, j) => j === i ? v : n));
  const setThreshold  = (i, v) => setThresholds(p => p.map((n, j) => j === i ? Number(v) : n));
  const setXp         = (k, v) => setXpValues(p => ({ ...p, [k]: Number(v) }));

  const handleSave = () => {
    const namesMap      = Object.fromEntries(TIER_CONFIG.map((t, i) => [t.tier, tierNames[i]]));
    const threshMap     = Object.fromEntries(TIER_CONFIG.map((t, i) => [t.tier, thresholds[i]]));
    onSave({
      rankSettings:   { tierNames: namesMap, thresholds: threshMap },
      xpSettings:     xpValues,
      hideRankSystem: hideRank,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const XP_LABELS = {
    TASK_COMPLETED: 'Task completed',     HABIT_DAILY:    'Habit maintained daily',
    WORKOUT_LOGGED: 'Workout logged',     GOAL_MILESTONE: 'Goal milestone reached',
    FOCUS_SESSION:  'Focus session done', MACROS_HIT:     'Macros hit for the day',
    UNDER_BUDGET:   'Under budget (week)',MOOD_LOGGED:    'Mood logged',
    WATER_GOAL:     'Water goal hit',
  };

  return (
    <div>
      <SectionTitle>Progress & Rank <SavedBadge show={saved} /></SectionTitle>

      {/* Hide toggle */}
      <Row label="Hide rank system" hint="Removes rank badges and XP tracking from the app entirely">
        <Toggle value={hideRank} onChange={setHideRank} />
      </Row>

      {!hideRank && (
        <>
          {/* Tier name editor */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 12 }}>
              TIER NAMES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TIER_CONFIG.map((tier, i) => (
                <div key={tier.tier} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                }}>
                  {/* Tier colour dot */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: tier.color,
                    boxShadow: `0 0 6px ${tier.color}88`,
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36 }}>
                    Tier {tier.tier}
                  </span>
                  <input
                    value={tierNames[i]}
                    onChange={e => setTierName(i, e.target.value)}
                    style={{
                      flex: 1, padding: '5px 10px',
                      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
                      borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 56, textAlign: 'right' }}>
                    {i === 0 ? '0 XP' : (
                      <input
                        type="number"
                        value={thresholds[i]}
                        onChange={e => setThreshold(i, e.target.value)}
                        style={{
                          width: 70, padding: '4px 6px',
                          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
                          borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, outline: 'none',
                          textAlign: 'right',
                        }}
                      />
                    )}
                    {i > 0 && <span style={{ marginLeft: 3 }}>XP</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* XP per action */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 12 }}>
              XP PER ACTION
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(XP_LABELS).map(([key, label]) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      value={xpValues[key]}
                      onChange={e => setXp(key, e.target.value)}
                      min={0} max={500} step={5}
                      style={{
                        width: 60, padding: '4px 8px', textAlign: 'right',
                        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
                        borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>XP</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save Progress Settings
      </button>
    </div>
  );
}

// ─── Section: Platforms ───────────────────────────────────────────────────────
const PLATFORM_TABS = [
  { id: 'dashboard',  label: 'Dashboard'  },
  { id: 'assistant',  label: 'Assistant'  },
  { id: 'tasks',      label: 'Tasks'      },
  { id: 'calendar',   label: 'Calendar'   },
  { id: 'notes',      label: 'Notes'      },
  { id: 'health',     label: 'Health'     },
  { id: 'finance',    label: 'Finance'    },
  { id: 'progress',   label: 'Progress'   },
  { id: 'style',      label: 'Style'      },
  { id: 'essentials', label: 'Essentials' },
  { id: 'lists',      label: 'Lists'      },
  { id: 'focus',      label: 'Focus'      },
  { id: 'vault',      label: 'Vault'      },
];

const LAYOUT_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact',  label: 'Compact'  },
  { value: 'spacious', label: 'Spacious' },
];

function PlatformsSection({ settings, onSave }) {
  // hiddenTabs: array of tab IDs that are currently hidden
  const [hiddenTabs,  setHiddenTabs]  = useState(() => settings.hiddenTabs  || []);
  // tabLayouts: { [tabId]: 'standard' | 'compact' | 'spacious' }
  const [tabLayouts,  setTabLayouts]  = useState(() => settings.tabLayouts  || {});
  const [autostart,   setAutostart]   = useState(false);
  const [autostartOk, setAutostartOk] = useState(false);

  // Check current autostart state on mount
  useEffect(() => {
    import('@tauri-apps/plugin-autostart')
      .then(({ isEnabled }) => isEnabled())
      .then(enabled => { setAutostart(enabled); setAutostartOk(true); })
      .catch(() => setAutostartOk(false));
  }, []);

  const handleAutostartToggle = async (val) => {
    setAutostart(val);
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart');
      if (val) await enable();
      else     await disable();
    } catch (err) {
      console.warn('[Settings] Autostart plugin unavailable:', err.message);
    }
  };

  // Toggle a tab's visibility — save immediately so Sidebar updates in real time
  const toggleTab = (tabId, visible) => {
    const next = visible
      ? hiddenTabs.filter(id => id !== tabId)
      : [...hiddenTabs.filter(id => id !== tabId), tabId];
    setHiddenTabs(next);
    onSave({ hiddenTabs: next });
  };

  // Update layout for a tab — save immediately
  const setLayout = (tabId, layout) => {
    const next = { ...tabLayouts, [tabId]: layout };
    setTabLayouts(next);
    onSave({ tabLayouts: next });
  };

  return (
    <div>
      <SectionTitle>Platform Preferences</SectionTitle>

      {/* System behaviour */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          WINDOWS SYSTEM
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 10,
          background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Launch on startup</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              VALERIE starts automatically when Windows boots
            </div>
          </div>
          {autostartOk
            ? <Toggle value={autostart} onChange={handleAutostartToggle} />
            : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Desktop app only</span>
          }
        </div>
      </div>

      {/* Tab visibility + layout density */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.04em' }}>
          WINDOWS TAB VISIBILITY
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          Hidden tabs disappear from the sidebar — their data is preserved and restored when re-enabled.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PLATFORM_TABS.map(tab => {
            const visible = !hiddenTabs.includes(tab.id);
            const layout  = tabLayouts[tab.id] || 'standard';
            return (
              <div key={tab.id} style={{
                borderRadius: 10,
                border: '0.5px solid var(--card-border)',
                background: 'var(--hover-bg)',
                overflow: 'hidden',
              }}>
                {/* Toggle row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 500,
                    color: visible ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>
                    {tab.label}
                  </span>
                  <Toggle value={visible} onChange={v => toggleTab(tab.id, v)} />
                </div>

                {/* Layout density row — only shown when tab is visible */}
                {visible && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px 10px',
                    borderTop: '0.5px solid var(--sidebar-divider)',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 44 }}>Layout</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {LAYOUT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setLayout(tab.id, opt.value)}
                          style={{
                            padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                            border: `0.5px solid ${layout === opt.value ? 'var(--accent)' : 'var(--card-border)'}`,
                            background: layout === opt.value ? 'var(--accent)22' : 'transparent',
                            color: layout === opt.value ? 'var(--accent)' : 'var(--text-muted)',
                            transition: 'all 0.15s',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Data ────────────────────────────────────────────────────────────
function DataSection() {
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    const allData = {};
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      const val = storage.get(storageKey);
      if (val !== null) allData[key] = val;
    });
    // Exclude vault data from export for security
    delete allData.VAULT;

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `VALERIE_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div>
      <SectionTitle>Data</SectionTitle>

      <Row label="Export all data" hint="Downloads a JSON backup of all your VALERIE data. Vault is excluded for security.">
        <button
          onClick={handleExport}
          style={{
            padding: '9px 20px', borderRadius: 8,
            border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)',
            color: exported ? '#4caf7d' : 'var(--text-secondary)',
            fontSize: 13, cursor: 'pointer',
          }}
        >
          {exported ? '✓ Downloaded' : '⬇ Export as JSON'}
        </button>
      </Row>

      <Row label="Import data" hint="Restore from a previous JSON export">
        <div style={{
          padding: '14px 16px', borderRadius: 10, border: '1px dashed var(--card-border)',
          color: 'var(--text-muted)', fontSize: 12, textAlign: 'center',
        }}>
          Import — coming in next session
        </div>
      </Row>

      <Row label="Clear all app data" hint="Removes all local data except Vault. This cannot be undone.">
        <button
          onClick={() => {
            if (window.confirm('This will clear ALL VALERIE data (not the Vault). Are you absolutely sure?')) {
              const vaultSalt = localStorage.getItem('valerie_vault_salt');
              const vaultData = localStorage.getItem('valerie_vault_data');
              storage.clear();
              if (vaultSalt) localStorage.setItem('valerie_vault_salt', vaultSalt);
              if (vaultData) localStorage.setItem('valerie_vault_data', vaultData);
              window.location.reload();
            }
          }}
          style={{
            padding: '9px 20px', borderRadius: 8,
            border: '0.5px solid rgba(229,90,90,0.4)', background: 'rgba(229,90,90,0.08)',
            color: '#e55a5a', fontSize: 13, cursor: 'pointer',
          }}
        >
          Clear all data
        </button>
      </Row>
    </div>
  );
}

// ─── Section: Security ────────────────────────────────────────────────────────
function SecuritySection({ settings, onSave }) {
  const [autoLock,   setAutoLock]   = useState(settings.vaultAutoLockMinutes ?? 5);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [saved,      setSaved]      = useState(false);

  const handleSave = () => {
    onSave({ vaultAutoLockMinutes: autoLock });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = () => {
    if (deletePhrase !== 'DELETE MY ACCOUNT') {
      alert('Please type the exact phrase: DELETE MY ACCOUNT');
      return;
    }
    if (window.confirm('Final confirmation — this action is irreversible. All data will be destroyed.')) {
      storage.clear();
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div>
      <SectionTitle>Security <SavedBadge show={saved} /></SectionTitle>

      <Row label="Vault auto-lock" hint="Minutes of inactivity before the password vault locks itself">
        <Slider value={autoLock} onChange={setAutoLock} min={1} max={60} step={1} suffix=" min" />
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 32,
        }}
      >
        Save Security Settings
      </button>

      {/* Account deletion — locked behind confirmation phrase */}
      <div style={{
        padding: '20px', borderRadius: 12,
        border: '1px solid rgba(229,90,90,0.3)',
        background: 'rgba(229,90,90,0.05)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e55a5a', marginBottom: 8 }}>
          Delete Account
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.55 }}>
          This permanently deletes all your data, Firebase account, and settings.
          The Vault will also be destroyed. This cannot be undone under any circumstances.
          <br /><br />
          To confirm, type exactly: <strong style={{ color: 'var(--text-primary)' }}>DELETE MY ACCOUNT</strong>
        </div>
        <input
          value={deletePhrase}
          onChange={e => setDeletePhrase(e.target.value)}
          placeholder="Type the confirmation phrase"
          style={{
            width: '100%', padding: '9px 12px', boxSizing: 'border-box',
            background: 'var(--bg-panel)', border: '0.5px solid rgba(229,90,90,0.4)',
            borderRadius: 8, color: '#e55a5a', fontSize: 13,
            outline: 'none', marginBottom: 12, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleDelete}
          disabled={deletePhrase !== 'DELETE MY ACCOUNT'}
          style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: deletePhrase === 'DELETE MY ACCOUNT' ? '#e55a5a' : 'rgba(229,90,90,0.2)',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: deletePhrase === 'DELETE MY ACCOUNT' ? 'pointer' : 'not-allowed',
            opacity: deletePhrase === 'DELETE MY ACCOUNT' ? 1 : 0.5,
          }}
        >
          Permanently Delete Everything
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings Tab ────────────────────────────────────────────────────────
export default function SettingsTab({ settings: settingsProp }) {
  const [activeSection, setActiveSection] = useState('identity');

  // Load settings from localStorage — source of truth
  const [settings, setSettings] = useState(() => storage.get(STORAGE_KEYS.SETTINGS, {}));

  // Persist partial updates to localStorage and notify App in real time
  const handleSave = useCallback((updates) => {
    const merged = { ...settings, ...updates };
    setSettings(merged);
    storage.set(STORAGE_KEYS.SETTINGS, merged);

    // Apply theme immediately if changed
    if (updates.theme) applyTheme(updates.theme);

    // Notify App.jsx so it re-reads settings and re-renders all tabs with new values
    window.dispatchEvent(new CustomEvent('valerie:settings-changed', { detail: merged }));
  }, [settings]);

  const renderSection = () => {
    switch (activeSection) {
      case 'identity':      return <IdentitySection      settings={settings} onSave={handleSave} />;
      case 'appearance':    return <AppearanceSection    settings={settings} onSave={handleSave} />;
      case 'voice':         return <VoiceSection         settings={settings} onSave={handleSave} />;
      case 'ai':            return <AISection            settings={settings} onSave={handleSave} />;
      case 'units':         return <UnitsSection         settings={settings} onSave={handleSave} />;
      case 'progress':      return <ProgressSection      settings={settings} onSave={handleSave} />;
      case 'notifications': return <NotificationsSection settings={settings} onSave={handleSave} />;
      case 'integrations':  return <IntegrationsSection  settings={settings} onSave={handleSave} />;
      case 'api_usage':     return <ApiUsageSection      settings={settings} />;
      case 'platforms':     return <PlatformsSection     settings={settings} onSave={handleSave} />;
      case 'data':          return <DataSection />;
      case 'security':      return <SecuritySection      settings={settings} onSave={handleSave} />;
      default:              return null;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* ── Left nav ──────────────────────────────────────────────────────── */}
      <nav style={{
        width: 160, flexShrink: 0,
        borderRight: '0.5px solid var(--sidebar-divider)',
        overflowY: 'auto', padding: '16px 0',
        display: 'flex', flexDirection: 'column',
      }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            style={{
              width: '100%', padding: '9px 16px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: activeSection === sec.id ? 'var(--accent)15' : 'none',
              border: 'none',
              borderLeft: `2px solid ${activeSection === sec.id ? 'var(--accent)' : 'transparent'}`,
              color: activeSection === sec.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
              fontWeight: activeSection === sec.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>{sec.icon}</span>
            {sec.label}
          </button>
        ))}
      </nav>

      {/* ── Right content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
        {renderSection()}
      </div>
    </div>
  );
}

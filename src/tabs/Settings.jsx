//  Settings Tab  Session 6 
// Full 11-section settings hub. Every change persists to localStorage instantly.
// Split view: left nav (130px) + right scrollable content.

import { useState, useEffect, useCallback, useRef, Component } from 'react';
import { fetch }        from '@tauri-apps/plugin-http';
import { isTauri }      from '../utils/platform.js';
import { changeLockPassword, clearLockScreen, lockScreenEnabled } from '../components/LockScreen.jsx';

// Safe invoke  no-ops silently on PWA where Tauri isn't available
async function invoke(cmd, args) {
  if (!isTauri()) return null;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke(cmd, args);
}

// Local error boundary  catches crashes inside any settings section
class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#e55a5a', fontSize: 13 }}>
          Something went wrong in this section.{' '}
          <button onClick={() => this.setState({ error: null })}
            style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 6,
              border: '0.5px solid #e55a5a', background: 'transparent',
              color: '#e55a5a', cursor: 'pointer', fontSize: 12 }}>
            Retry
          </button>
          <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { THEMES, applyTheme }    from '../styles/themes.js';
import { testClaudeConnection }  from '../ai/claude.js';
import { sendTestSMS }           from '../utils/twilio.js';
import { requestPushPermission, pushPermissionStatus } from '../utils/pushNotifications.js';
import { spotifyLogin, spotifyDisconnect, isSpotifyConnected } from '../utils/spotify.js';
import { gmailLogin, gmailDisconnect, isGmailConnected, DEFAULT_EMAIL_RULES } from '../utils/gmail.js';
import { isMobile }              from '../utils/platform.js';
import { TIER_CONFIG, TIER_THRESHOLDS, XP_SOURCES } from '../utils/xp.js';
import { ALL_TABS }              from '../components/Sidebar.jsx';
import { supabase, getUserIdSync, signOut as supabaseSignOut, getAuthUser } from '../supabase/supabase.js';
import { currencySymbol as currencySym } from '../utils/currency.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';

//  Sections 
const SECTIONS = [
  { id: 'identity',      label: 'Identity',         icon: '👤' },
  { id: 'appearance',    label: 'Appearance',       icon: '🎨' },
  { id: 'voice',         label: 'Voice',            icon: '🎙' },
  { id: 'ai',            label: 'AI',               icon: '🧠' },
  { id: 'units',         label: 'Units & Currency', icon: '💱' },
  { id: 'progress',      label: 'Progress & Rank',  icon: '⭐' },
  { id: 'notifications', label: 'Notifications',    icon: '🔔' },
  { id: 'integrations',  label: 'Integrations',     icon: '🔌' },
  { id: 'api_usage',     label: 'API Usage',        icon: '📊' },
  { id: 'platforms',     label: 'Platforms',        icon: '🖥' },
  { id: 'data',          label: 'Data',             icon: '💾' },
  { id: 'daily_brief',   label: 'Daily Brief',      icon: '🌅' },
  { id: 'sidebar',       label: 'Sidebar Order',    icon: '☰'  },
  { id: 'security',      label: 'Security',         icon: '🔒' },
  { id: 'account',       label: 'Account',          icon: '☁'  },
];

//  Currency & Unit constants 
export const CURRENCIES = [
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar' },
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar'         },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound'     },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro'              },
];

//  Shared UI primitives 

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
      S Saved
    </span>
  );
}

//  Section: Identity 
export function IdentitySection({ settings, onSave }) {
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

      <Row label="Custom context" hint="Personal info VALERIE always knows  e.g. 'I work nights. I lift 4x a week.'">
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

//  Font options from design spec 
const FONTS = [
  { value: "'Exo 2', sans-serif",     label: 'Exo 2',    description: 'Sharp · geometric · tech forward' },
  { value: "'DM Sans', sans-serif",   label: 'DM Sans',  description: 'Clean · minimal · professional'  },
  { value: "'Orbitron', sans-serif",  label: 'Orbitron', description: 'Futuristic · bold · strong'      },
  { value: "'Sora', sans-serif",      label: 'Sora',     description: 'Elegant · soft · premium'        },
  { value: "'Inter', sans-serif",     label: 'Inter',    description: 'Gold standard clean UI'          },
  { value: "'Geist Sans', sans-serif",label: 'Geist',    description: 'Ultra minimal · Vercel'          },
];

//  Section: Appearance 
export function AppearanceSection({ settings, onSave }) {
  const [theme,       setTheme]       = useState(settings.theme             || 'obsidian');
  const [orbShape,    setOrbShape]    = useState(settings.orbShape           || 'sphere');
  const [animLevel,   setAnimLevel]   = useState(settings.animationIntensity || 'full');
  const [bgStyle,     setBgStyle]     = useState(settings.backgroundStyle    || 'time-of-day');
  const [fontFamily,  setFontFamily]  = useState(settings.fontFamily         || "'DM Sans', sans-serif");
  const [accentColor, setAccentColor] = useState(settings.accentColorHex     || '');
  const [tabColours,  setTabColours]  = useState(settings.tabColours         || 'per-tab');
  const [headingFont, setHeadingFont] = useState(settings.headingFont        || 'classical');
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
      <Row label="Theme" hint="Switches instantly  no reload">
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
      <Row label="Custom accent colour" hint="Overrides the theme's default accent  applies to orb, highlights, active states">
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

      {/* Headings */}
      <Row label="Headings" hint="Font for screen titles  body text keeps the font above">
        <PillGroup
          value={headingFont}
          onChange={(v) => { setHeadingFont(v); onSave({ headingFont: v }); }}
          options={[
            { value: 'classical', label: 'Classical' },
            { value: 'expanded',  label: 'Expanded'  },
            { value: 'body',      label: 'Match body font' },
          ]}
        />
      </Row>

      {/* Tab colours */}
      <Row label="Tab colours" hint="Each tab marks itself in its own colour, over any theme">
        <PillGroup
          value={tabColours}
          onChange={(v) => { setTabColours(v); onSave({ tabColours: v }); }}
          options={[
            { value: 'per-tab', label: 'Per tab' },
            { value: 'theme',   label: 'Theme accent only' },
          ]}
        />
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

//  Section: Voice 
export function VoiceSection({ settings, onSave }) {

  //  ElevenLabs state 
  // Key is stored in the OS keychain  never in settings/Firebase
  const [el11Key,     setEl11Key]     = useState('');
  const [el11VoiceId, setEl11VoiceId] = useState(settings.voice?.elevenlabsVoiceId || settings.elevenlabsVoiceId || import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'yj30vwTGJxSHezdAGsv9');
  const [el11Voices,  setEl11Voices]  = useState([]);
  const [el11Loading, setEl11Loading] = useState(false);
  const [el11Error,   setEl11Error]   = useState('');
  const [el11Playing, setEl11Playing] = useState(false);
  const [el11PreviewErr, setEl11PreviewErr] = useState('');

  //  Browser TTS fallback state 
  const [sysVoices,   setSysVoices]   = useState([]);
  const [voiceURI,    setVoiceURI]    = useState(settings.voice?.voiceURI || '');
  const [rate,        setRate]        = useState(settings.voice?.rate     ?? 0.95);
  const [pitch,       setPitch]       = useState(settings.voice?.pitch    ?? 1.0);

  //  Azure state 
  const [azureKey,       setAzureKey]       = useState(settings.voice?.azureKey    || settings.azureKey    || '');
  const [azureRegion,    setAzureRegion]    = useState(settings.voice?.azureRegion || settings.azureRegion || 'australiaeast');
  const [azureVoiceName, setAzureVoiceName] = useState(settings.voice?.azureVoiceName || 'en-AU-NatashaNeural');
  const [azurePlaying,   setAzurePlaying]   = useState(false);
  const [azureStatus,    setAzureStatus]    = useState(null); // null | 'ok' | 'bad_key' | 'bad_region' | 'error'
  const [saved,          setSaved]          = useState(false);

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
      if (!res.ok) throw new Error(`ElevenLabs API ${res.status}  check your key`);
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

  // Load ElevenLabs API key  keyring on Tauri desktop, env/settings on PWA
  useEffect(() => {
    invoke('get_secret', { service: 'valerie', key: 'elevenlabs_api_key' })
      .then(stored => {
        if (stored) {
          setEl11Key(stored);
          fetchEl11Voices(stored).catch(() => {});
        } else {
          // Tauri keyring empty  fall back to env or settings
          const legacy = settings.voice?.elevenlabsKey || settings.elevenlabsKey || '';
          if (legacy) {
            setEl11Key(legacy);
            if (isTauri()) invoke('store_secret', { service: 'valerie', key: 'elevenlabs_api_key', value: legacy }).catch(() => {});
            fetchEl11Voices(legacy).catch(() => {});
          }
        }
      })
      .catch(() => {
        // PWA  keyring not available, use env key directly
        const fallback = settings.voice?.elevenlabsKey || settings.elevenlabsKey || '';
        if (fallback) { setEl11Key(fallback); fetchEl11Voices(fallback).catch(() => {}); }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // el11Status: null | 'plan_required' | 'bad_key' | 'no_voice' | 'ok'
  const [el11Status, setEl11Status] = useState(null);

  // Preview using ElevenLabs  plays real audio from her voice
  const handleEl11Preview = async () => {
    if (!el11Key || el11Playing) return;
    setEl11Playing(true);
    setEl11PreviewErr('');
    setEl11Status(null);
    try {
      const trimmedKey = el11Key.trim();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${el11VoiceId}`, {
        method:  'POST',
        headers: { 'xi-api-key': trimmedKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text:           "Ready when you are, Rob.",
          model_id:       'eleven_monolingual_v1',
          voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.20, use_speaker_boost: true },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (res.status === 402 || res.status === 403) {
          setEl11Status('plan_required');
          setEl11Playing(false);
          return;
        }
        if (res.status === 401) { setEl11Status('bad_key'); setEl11Playing(false); return; }
        if (res.status === 422) { setEl11Status('no_voice'); setEl11Playing(false); return; }
        setEl11PreviewErr(`Preview failed (${res.status})  check your connection and try again.`);
        setEl11Playing(false);
        return;
      }
      setEl11Status('ok');
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setEl11Playing(false); };
      audio.onerror = () => {
        setEl11PreviewErr('Audio playback failed  check that audio is not muted');
        setEl11Playing(false);
      };
      const p = audio.play();
      if (p?.catch) p.catch(err => { setEl11PreviewErr(`Playback blocked: ${err.message}`); setEl11Playing(false); });
    } catch (err) {
      setEl11PreviewErr('Preview failed  check your connection.');
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

  // Preview Azure TTS
  const handleAzurePreview = async () => {
    if (!azureKey.trim() || !azureRegion || azurePlaying) return;
    setAzurePlaying(true);
    setAzureStatus(null);
    try {
      const langMatch = azureVoiceName.match(/^([a-z]{2}-[A-Z]{2})/);
      const lang      = langMatch ? langMatch[1] : 'en-AU';
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>`
        + `<voice name='${azureVoiceName}'>Ready when you are, Rob.</voice></speak>`;

      const res = await fetch(
        `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey.trim(),
            'Content-Type':              'application/ssml+xml',
            'X-Microsoft-OutputFormat':  'audio-16khz-128kbitrate-mono-mp3',
          },
          body:   ssml,
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { setAzureStatus('bad_key'); setAzurePlaying(false); return; }
        if (res.status === 404) { setAzureStatus('bad_region'); setAzurePlaying(false); return; }
        setAzureStatus('error'); setAzurePlaying(false); return;
      }
      setAzureStatus('ok');
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setAzurePlaying(false); };
      audio.onerror = () => { setAzurePlaying(false); };
      audio.play().catch(() => setAzurePlaying(false));
    } catch {
      setAzureStatus('error');
      setAzurePlaying(false);
    }
  };

  const handleSave = () => {
    // ElevenLabs API key   OS keychain on Tauri, localStorage on PWA
    if (el11Key.trim()) {
      if (isTauri()) {
        invoke('store_secret', { service: 'valerie', key: 'elevenlabs_api_key', value: el11Key.trim() }).catch(() => {});
      } else {
        localStorage.setItem('valerie_el11_key', el11Key.trim());
      }
    }
    onSave({
      voice: {
        voiceURI, rate, pitch, volume: 1.0, lang: 'en-AU',
        elevenlabsVoiceId: el11VoiceId,
        azureKey:          azureKey.trim(),
        azureRegion,
        azureVoiceName,
      },
      azureKey:          azureKey.trim(),
      azureRegion,
      azureVoiceName,
      elevenlabsVoiceId: el11VoiceId,
      wakeWordEnabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Active only if key is present AND hasn't been rejected (no 401/load error)
  const isEl11Active      = !!el11Key && !el11Error;
  const defaultVoiceId    = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'yj30vwTGJxSHezdAGsv9';
  const selectedVoiceName = el11Voices.find(v => v.voice_id === el11VoiceId)?.name || '';
  const enSysVoices       = sysVoices.filter(v => v.lang?.startsWith('en'));

  return (
    <div>
      <SectionTitle>Voice <SavedBadge show={saved} /></SectionTitle>

      {/* Active engine banner */}
      {/*  Active engine banner  */}
      {(() => {
        const isAzureConfigured = !!azureKey.trim();
        const engineLabel  = isEl11Active ? 'ElevenLabs' : isAzureConfigured ? 'Azure Neural' : 'System TTS';
        const engineColor  = isEl11Active || isAzureConfigured ? '#4caf7d' : '#666';
        const engineGlow   = isEl11Active || isAzureConfigured ? '#4caf7d99' : 'none';
        const engineBg     = isEl11Active || isAzureConfigured ? '#4caf7d14' : 'var(--hover-bg)';
        const engineBorder = isEl11Active || isAzureConfigured ? '#4caf7d44' : 'var(--card-border)';
        const engineSub    = isEl11Active
          ? `Priority: ElevenLabs   Azure Neural   System TTS${selectedVoiceName ? ` · ${selectedVoiceName}` : ''}`
          : isAzureConfigured
          ? `Priority: Azure Neural (${azureVoiceName})   System TTS  ElevenLabs not configured`
          : 'Add an ElevenLabs or Azure key below for VALERIE\'s real voice';
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 10, marginBottom: 22,
            background: engineBg, border: `1px solid ${engineBorder}`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: engineColor, boxShadow: `0 0 6px ${engineGlow}`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {engineLabel}  Active
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {engineSub}
              </div>
            </div>
          </div>
        );
      })()}

      {/*  ElevenLabs block  */}
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
            Voice {el11Voices.length > 0 ? `(${el11Voices.length} available)` : ' click Load voices to fetch'}
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
              el11Voices.map(v => {
                const accent = typeof v.labels?.accent === 'string' ? v.labels.accent : '';
                return (
                <option key={v.voice_id ?? v.name} value={v.voice_id ?? ''}>
                  {String(v.name ?? '')}
                  {v.voice_id === defaultVoiceId ? ' & VALERIE default' : ''}
                  {accent ? `  ${accent}` : ''}
                </option>
                );
              })
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
          {el11Playing ? '🔊 Playing…' : "🔊 Preview VALERIE's voice"}
        </button>
        {/* Clean status banner  no raw API text ever shown */}
        {(el11Status || el11PreviewErr) && (
          <div style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
            ...(el11Status === 'ok'
              ? { background: '#4caf7d14', border: '0.5px solid #4caf7d44', color: '#4caf7d' }
              : el11Status === 'plan_required'
              ? { background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.4)', color: '#f5a623' }
              : el11Status === 'bad_key'
              ? { background: 'rgba(229,90,90,0.08)', border: '0.5px solid rgba(229,90,90,0.35)', color: '#e55a5a' }
              : el11Status === 'no_voice'
              ? { background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.4)', color: '#f5a623' }
              : { background: 'rgba(229,90,90,0.08)', border: '0.5px solid rgba(229,90,90,0.35)', color: '#e55a5a' }),
          }}>
            {el11Status === 'ok'           && '✓ Voice preview played successfully.'}
            {el11Status === 'plan_required' && 'ElevenLabs plan required  this model is not available on your current tier. VALERIE will use system TTS as fallback.'}
            {el11Status === 'bad_key'       && 'API key rejected. Double-check your ElevenLabs key above and try again.'}
            {el11Status === 'no_voice'      && 'Voice ID not found. Click Load voices and select a different one.'}
            {!el11Status && el11PreviewErr  && el11PreviewErr}
          </div>
        )}
      </div>

      {/*  Azure Neural TTS  */}
      {(() => {
        const isAzureActive = !!azureKey.trim();
        return (
          <div style={{
            border: `1px solid ${isAzureActive ? 'var(--accent)55' : 'var(--card-border)'}`,
            borderRadius: 12, padding: '16px 18px', marginBottom: 20,
            background: isAzureActive ? 'var(--accent)07' : 'var(--hover-bg)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              color: isAzureActive ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              AZURE NEURAL VOICES
              <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-muted)' }}>(tier 2 fallback)</span>
              {isAzureActive && (
                <span style={{
                  fontSize: 9, background: 'var(--accent)22', color: 'var(--accent)',
                  padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                }}>CONFIGURED</span>
              )}
            </div>

            {/* API Key */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>API Key</div>
              <Input value={azureKey} onChange={v => { setAzureKey(v); setAzureStatus(null); }}
                placeholder="Azure Cognitive Services subscription key" masked />
            </div>

            {/* Region */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Region <span style={{ color: 'var(--text-muted)' }}> must match your Azure resource region</span>
              </div>
              <select
                value={azureRegion}
                onChange={e => { setAzureRegion(e.target.value); setAzureStatus(null); }}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                }}
              >
                {[
                  ['australiaeast',   'Australia East'],
                  ['eastus',          'East US'],
                  ['eastus2',         'East US 2'],
                  ['westus',          'West US'],
                  ['westus2',         'West US 2'],
                  ['centralus',       'Central US'],
                  ['northeurope',     'North Europe'],
                  ['westeurope',      'West Europe'],
                  ['uksouth',         'UK South'],
                  ['southeastasia',   'Southeast Asia'],
                  ['japaneast',       'Japan East'],
                  ['canadacentral',   'Canada Central'],
                ].map(([val, label]) => (
                  <option key={val} value={val}>{label}  {val}</option>
                ))}
              </select>
            </div>

            {/* Voice */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>Voice</div>
              <select
                value={azureVoiceName}
                onChange={e => { setAzureVoiceName(e.target.value); setAzureStatus(null); }}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                }}
              >
                <optgroup label="Australian English">
                  <option value="en-AU-NatashaNeural">Natasha  en-AU Female & VALERIE default</option>
                  <option value="en-AU-WilliamNeural">William  en-AU Male</option>
                </optgroup>
                <optgroup label="British English">
                  <option value="en-GB-SoniaNeural">Sonia  en-GB Female</option>
                  <option value="en-GB-RyanNeural">Ryan  en-GB Male</option>
                  <option value="en-GB-LibbyNeural">Libby  en-GB Female</option>
                </optgroup>
                <optgroup label="US English">
                  <option value="en-US-JennyNeural">Jenny  en-US Female</option>
                  <option value="en-US-AriaNeural">Aria  en-US Female</option>
                  <option value="en-US-GuyNeural">Guy  en-US Male</option>
                  <option value="en-US-SaraNeural">Sara  en-US Female</option>
                </optgroup>
              </select>
            </div>

            {/* Preview */}
            <button
              onClick={handleAzurePreview}
              disabled={!azureKey.trim() || azurePlaying}
              style={{
                padding: '7px 16px', borderRadius: 8,
                border: `0.5px solid ${isAzureActive ? 'var(--accent)' : 'var(--card-border)'}`,
                background: isAzureActive ? 'var(--accent)15' : 'var(--hover-bg)',
                color: isAzureActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 12, cursor: !azureKey.trim() || azurePlaying ? 'not-allowed' : 'pointer',
                opacity: !azureKey.trim() || azurePlaying ? 0.5 : 1,
              }}
            >
              {azurePlaying ? '🔊 Playing…' : '🔊 Preview Azure voice'}
            </button>

            {/* Status */}
            {azureStatus && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                ...(azureStatus === 'ok'
                  ? { background: '#4caf7d14', border: '0.5px solid #4caf7d44', color: '#4caf7d' }
                  : azureStatus === 'bad_key'
                  ? { background: 'rgba(229,90,90,0.08)', border: '0.5px solid rgba(229,90,90,0.35)', color: '#e55a5a' }
                  : azureStatus === 'bad_region'
                  ? { background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.4)', color: '#f5a623' }
                  : { background: 'rgba(229,90,90,0.08)', border: '0.5px solid rgba(229,90,90,0.35)', color: '#e55a5a' }),
              }}>
                {azureStatus === 'ok'         && '✓ Azure voice preview played successfully.'}
                {azureStatus === 'bad_key'    && 'API key rejected  check your Azure subscription key.'}
                {azureStatus === 'bad_region' && 'Region not found  make sure the region matches your Azure resource (e.g. australiaeast).'}
                {azureStatus === 'error'      && 'Preview failed  check your key and region, then try again.'}
              </div>
            )}
          </div>
        );
      })()}

      {/*  System TTS fallback  */}
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
          <option value=""> System default </option>
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
           Preview system voice
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

//  Section: AI 
export function AISection({ settings, onSave }) {
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
    onSave({ ollamaModel, preferOffline, dailyTokenBudget: tokenBudget, smartRouting });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    const result = await testClaudeConnection();
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div>
      <SectionTitle>AI Configuration <SavedBadge show={saved} /></SectionTitle>

      {/* Server-side Claude connection */}
      <Row
        label="Secure AI service"
        hint="Anthropic runs through the authenticated Arete server; no provider key is stored in this app"
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '0 16px', borderRadius: 8, flexShrink: 0,
              border: `0.5px solid ${testResult?.ok ? '#4caf7d' : testResult ? '#e55a5a' : 'var(--card-border)'}`,
              background: testResult?.ok ? '#4caf7d15' : testResult ? '#e55a5a15' : 'var(--hover-bg)',
              color: testResult?.ok ? '#4caf7d' : testResult ? '#e55a5a' : 'var(--text-secondary)',
              fontSize: 12, cursor: testing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {testing ? 'Testing…' : testResult?.ok ? '✓ Connected' : 'Test connection'}
          </button>
        </div>
        {testResult && !testResult.ok && (
          <p style={{ margin: 0, fontSize: 11, color: '#e55a5a', lineHeight: 1.4 }}>
            {testResult.reason}
          </p>
        )}
        {testResult?.ok && (
          <p style={{ margin: 0, fontSize: 11, color: '#4caf7d' }}>
            {testResult.reason}.
          </p>
        )}
      </Row>

      <Row label="Ollama model" hint="Local AI model  Ollama must be running at localhost:11434">
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

      <Row label="Prefer offline model" hint="Use Ollama first  only switch to Claude for complex tasks">
        <Toggle value={preferOffline} onChange={setPreferOffline} />
      </Row>

      <Row label="Smart routing" hint="Auto-select best AI engine per message type">
        <Toggle value={smartRouting} onChange={setSmartRouting} />
      </Row>

      <Row label="Daily token budget" hint="Approximate max tokens per day  VALERIE warns when approaching">
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

//  Section: Units & Currency 
export function UnitsSection({ settings, onSave }) {
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.label.split('  ')[1]}</div>
              </div>
              {currency === c.code && (
<div style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 16 }}>✓</div>
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

//  Section: Notifications 
const TAB_REMINDERS_DEFAULT = {
  water:       { enabled: true,  hour: 12, message: 'VALERIE: Only {value}ml logged. Goal is {goal}ml.' },
  nutrition:   { enabled: true,  hour: 13, message: 'VALERIE: No calories logged yet. {value} kcal remaining.' },
  supplements: { enabled: true,  hour: 10, message: 'VALERIE: {value} supplement(s) not taken yet today.' },
  habits:      { enabled: true,  hour: 9,  message: 'VALERIE: {value} habit(s) still pending today.' },
  tasks:       { enabled: true,  hour: 10, message: 'VALERIE: {value} task(s) need your attention.' },
  sleep:       { enabled: true,  hour: 8,  message: 'VALERIE: Log last night\'s sleep to track your recovery.' },
  workout:     { enabled: false, hour: 18, message: 'VALERIE: No workout logged today. Rest day or forgot?' },
  calendar:    { enabled: true,  hour: 8,  message: 'VALERIE: {value} starts in {time} minutes.', calMinutes: 30 },
  finance:     { enabled: true,  hour: 9,  message: 'VALERIE: Weekly spend so far: {value}.', weeklyOnly: true },
};

export function NotificationsSection({ settings, onSave }) {
  const [enabled,          setEnabled]          = useState(settings.notifications?.enabled ?? true);
  const [nudges,           setNudges]           = useState(settings.notifications?.proactiveNudges ?? true);
  const [tabReminders,     setTabReminders]     = useState(() => {
    const saved = settings.notifications?.tabs ?? {};
    const merged = {};
    for (const [key, def] of Object.entries(TAB_REMINDERS_DEFAULT)) {
      merged[key] = { ...def, ...(saved[key] ?? {}) };
    }
    return merged;
  });

  // Twilio numbers
  const [twilioReminders,  setTwilioReminders]  = useState(settings.twilioReminders || settings.twilioNumber    || '');
  const [twilioSentry,     setTwilioSentry]     = useState(settings.twilioSentry    || settings.twilioDevNumber || '');
  const [twilioAccountSid, setTwilioAccountSid] = useState(settings.twilioAccountSid || '');
  const [twilioAuthToken,  setTwilioAuthToken]  = useState(settings.twilioAuthToken  || '');
  const [phoneNumber,      setPhoneNumber]      = useState(settings.phoneNumber || '');
  const [msgAlert,         setMsgAlert]         = useState(settings.smsMessages?.alert || 'VALERIE ALERT: {message}');

  const [pushStatus,    setPushStatus]    = useState(() => pushPermissionStatus());
  const [pushLoading,   setPushLoading]   = useState(false);
  const [smsTestStatus, setSmsTestStatus] = useState(null);
  const [saved,         setSaved]         = useState(false);

  function updateTab(key, patch) {
    setTabReminders(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const handleSave = () => {
    onSave({
      notifications: { enabled, proactiveNudges: nudges, tabs: tabReminders },
      twilioReminders, twilioSentry, twilioAccountSid, twilioAuthToken, phoneNumber,
      smsMessages: { alert: msgAlert },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRequestPush = async () => {
    setPushLoading(true);
    const result = await requestPushPermission();
    setPushStatus(pushPermissionStatus());
    setPushLoading(false);
    if (result === 'no-vapid-key') {
      window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: 'Add VITE_FIREBASE_VAPID_KEY to .env to enable push notifications.', type: 'error' } }));
    }
  };

  const handleTestSMS = async () => {
    setSmsTestStatus('sending');
    const result = await sendTestSMS({ twilioAccountSid, twilioAuthToken, twilioReminders, phoneNumber });
    setSmsTestStatus(result.ok ? 'ok' : result.error || 'error');
    setTimeout(() => setSmsTestStatus(null), 4000);
  };

  const pushStatusLabel = {
    granted:        '✓ Enabled',
    denied:         '✗ Blocked — allow in browser settings',
    default:        'Not yet enabled',
    unavailable:    'Not supported on this device',
    'no-vapid-key': 'VAPID key missing',
  }[pushStatus] || pushStatus;

  const Block = ({ label, children }) => (
    <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--hover-bg)', borderRadius: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );

  const textareaSx = {
    width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
    borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)',
    outline: 'none', resize: 'vertical', minHeight: 52, fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const TAB_LABELS = {
    water: '💧 Water', nutrition: '🍎 Nutrition', supplements: '💊 Supplements',
    habits: '✅ Habits', tasks: '📋 Tasks', sleep: '😴 Sleep',
    workout: '🏋️ Workout', calendar: '📅 Calendar', finance: '💰 Finance',
  };

  const PLACEHOLDERS = {
    water:       '{value} = ml logged, {goal} = daily goal',
    nutrition:   '{value} = kcal remaining',
    supplements: '{value} = count not taken',
    habits:      '{value} = count pending',
    tasks:       '{value} = count overdue/urgent',
    sleep:       '(no placeholders)',
    workout:     '(no placeholders)',
    calendar:    '{value} = event name, {time} = minutes before',
    finance:     '{value} = weekly spend amount',
  };

  return (
    <div>
      <SectionTitle>Notifications <SavedBadge show={saved} /></SectionTitle>

      <Row label="Enable notifications" hint="Master toggle for all VALERIE notifications">
        <Toggle value={enabled} onChange={setEnabled} />
      </Row>

      {enabled && (
        <>
          {/*  iOS Push  */}
          {isMobile() && (
            <Block label="iOS Push Notifications">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 3 }}>Push Notifications</div>
                  <div style={{ fontSize: 11, color: pushStatus === 'granted' ? 'var(--accent)' : 'var(--text-muted)' }}>{pushStatusLabel}</div>
                </div>
                {pushStatus !== 'granted' && pushStatus !== 'unavailable' && (
                  <button onClick={handleRequestPush} disabled={pushLoading}
                    style={{ padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'var(--active-bg)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {pushLoading ? 'Requesting…' : 'Enable Push'}
                  </button>
                )}
              </div>
            </Block>
          )}

          {/*  Proactive nudges  */}
          <Block label="VALERIE Nudges">
            <Toggle label="Proactive nudges (max 3/day)" value={nudges} onChange={setNudges} />
          </Block>

          {/*  Per-tab SMS reminders  */}
          <Block label="Per-Tab SMS Reminders">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
              Each tab sends its own SMS reminder. Requires Twilio credentials below.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(TAB_LABELS).map(([key, label]) => {
                const tab = tabReminders[key];
                return (
                  <div key={key} style={{ padding: '12px 14px', borderRadius: 10, border: `0.5px solid ${tab.enabled ? 'rgba(255,255,255,0.12)' : 'var(--card-border)'}`, background: tab.enabled ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'all 0.2s' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tab.enabled ? 12 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                      <Toggle value={tab.enabled} onChange={v => updateTab(key, { enabled: v })} />
                    </div>

                    {tab.enabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Hour + calendar interval row */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>SEND AT HOUR</label>
                            <select value={tab.hour} onChange={e => updateTab(key, { hour: +e.target.value })}
                              style={{ width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}>
                              {Array.from({ length: 17 }, (_, i) => i + 6).map(h => (
                                <option key={h} value={h}>{h}:00 {h < 12 ? 'AM' : h === 12 ? 'PM' : `${h-12}PM`}</option>
                              ))}
                            </select>
                          </div>
                          {key === 'calendar' && (
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>REMINDER (MIN BEFORE)</label>
                              <input type="number" min={5} max={120} value={tab.calMinutes ?? 30}
                                onChange={e => updateTab(key, { calMinutes: +e.target.value })}
                                style={{ width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
                            </div>
                          )}
                        </div>

                        {/* Message */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>
                            MESSAGE &nbsp;<span style={{ opacity: 0.6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{PLACEHOLDERS[key]}</span>
                          </label>
                          <textarea style={textareaSx} value={tab.message}
                            onChange={e => updateTab(key, { message: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Block>

          {/*  Twilio credentials  */}
          <Block label="Twilio Credentials">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Account SID" hint="From twilio.com/console">
                <Input value={twilioAccountSid} onChange={setTwilioAccountSid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" masked />
              </Row>
              <Row label="Auth Token" hint="From twilio.com/console">
                <Input value={twilioAuthToken} onChange={setTwilioAuthToken} placeholder="your auth token" masked />
              </Row>
              <Row label="Your phone (recipient)">
                <Input value={phoneNumber} onChange={setPhoneNumber} placeholder="+61412345678" />
              </Row>
            </div>
          </Block>

          {/*  Twilio numbers  */}
          <Block label="Twilio SMS Numbers">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Reminders number" hint="Used for all tab reminders">
                <Input value={twilioReminders} onChange={setTwilioReminders} placeholder="+61400000001" />
              </Row>
              <Row label="Alerts number" hint="Used for critical system alerts and storage warnings">
                <Input value={twilioSentry} onChange={setTwilioSentry} placeholder="+61400000002" />
              </Row>
            </div>
          </Block>

          {/*  Alert template (critical only)  */}
          <Block label="Alert SMS Template">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Used for system warnings and critical alerts only. Use <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 }}>{'{message}'}</code> as placeholder.</div>
            <textarea style={textareaSx} value={msgAlert} onChange={e => setMsgAlert(e.target.value)} />
          </Block>

          {/*  Test SMS button  */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleTestSMS}
              disabled={!twilioAccountSid || !twilioAuthToken || !twilioReminders || !phoneNumber}
              style={{ padding: '7px 18px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: (!twilioAccountSid || !twilioAuthToken || !twilioReminders || !phoneNumber) ? 0.4 : 1 }}
            >
              {smsTestStatus === 'sending' ? 'Sending…' : 'Send test SMS'}
            </button>
            {smsTestStatus && smsTestStatus !== 'sending' && (
              <span style={{ fontSize: 12, color: smsTestStatus === 'ok' ? 'var(--accent)' : '#e55a5a' }}>
                {smsTestStatus === 'ok' ? '✓ Sent successfully' : smsTestStatus}
              </span>
            )}
          </div>
        </>
      )}

      <button
        onClick={handleSave}
        style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
      >
        Save Notifications
      </button>
    </div>
  );
}

//  Spotify OAuth component 
function SpotifyOAuth() {
  const [connected, setConnected] = useState(() => isSpotifyConnected());

  function handleConnect() { spotifyLogin(); }
  function handleDisconnect() { spotifyDisconnect(); setConnected(false); }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🎵</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Spotify</div>
          <div style={{ fontSize: 11, color: connected ? 'var(--accent)' : 'var(--text-muted)' }}>
            {connected ? '✓ Connected' : 'Not connected'}
          </div>
        </div>
      </div>
      <button
        onClick={connected ? handleDisconnect : handleConnect}
        style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: connected ? '0.5px solid #e55a5a55' : '0.5px solid #1db95455', background: connected ? 'rgba(229,90,90,0.1)' : 'rgba(29,185,84,0.1)', color: connected ? '#e55a5a' : '#1db954' }}
      >
        {connected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  );
}

//  Section: Integrations 
export function IntegrationsSection({ settings, onSave }) {
  const [googleSearchKey, setGoogleSearchKey] = useState(settings.googleSearchKey || '');
  const [googleSearchCx,  setGoogleSearchCx]  = useState(settings.googleSearchCx  || '');
  const [exerciseDbKey,   setExerciseDbKey]   = useState(settings.exerciseDbKey   || '');
  const [finnhubKey,      setFinnhubKey]      = useState(settings.finnhubKey      || '');
  const [watchlistInput,  setWatchlistInput]  = useState('');
  const [watchlist,       setWatchlist]       = useState(settings.stocksWatchlist || []);
  const [saved,           setSaved]           = useState(false);

  // Gmail state
  const [gmailConnected, setGmailConnected]   = useState(() => isGmailConnected());
  const [gmailLoading,   setGmailLoading]     = useState(false);
  const [gmailError,     setGmailError]       = useState('');
  const [emailRules,     setEmailRules]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('valerie_email_rules') || 'null') || DEFAULT_EMAIL_RULES; }
    catch { return DEFAULT_EMAIL_RULES; }
  });

  const googleClientId = settings.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  async function connectGmail() {
    setGmailLoading(true); setGmailError('');
    try {
      await gmailLogin(googleClientId);
      setGmailConnected(true);
    } catch (err) {
      setGmailError(err.message);
    } finally {
      setGmailLoading(false);
    }
  }

  function disconnectGmail() {
    gmailDisconnect();
    setGmailConnected(false);
  }

  function toggleRule(id) {
    const next = emailRules.map(r => r.id === id ? { ...r, enabled: r.enabled === false ? true : false } : r);
    setEmailRules(next);
    localStorage.setItem('valerie_email_rules', JSON.stringify(next));
  }

  const handleSave = () => {
    onSave({ googleSearchKey, googleSearchCx, exerciseDbKey, finnhubKey, stocksWatchlist: watchlist });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  function addTicker() {
    const sym = watchlistInput.trim().toUpperCase();
    if (!sym || watchlist.includes(sym)) { setWatchlistInput(''); return; }
    const next = [...watchlist, sym];
    setWatchlist(next);
    setWatchlistInput('');
    onSave({ stocksWatchlist: next });
  }
  function removeTicker(sym) {
    const next = watchlist.filter(s => s !== sym);
    setWatchlist(next);
    onSave({ stocksWatchlist: next });
  }

  return (
    <div>
      <SectionTitle>Integrations <SavedBadge show={saved} /></SectionTitle>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          OAUTH SERVICES
        </div>

        {/* Spotify */}
        <SpotifyOAuth />

        {/* Gmail */}
        <div style={{
          padding: '14px 16px', borderRadius: 10,
          border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: gmailConnected ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="20" height="20" viewBox="0 52 448 400">
                <path fill="#4285F4" d="M58 452h75V248L0 176v248c0 15.464 12.536 28 28 28h30z"/>
                <path fill="#34A853" d="M314 452h75c15.464 0 28-12.536 28-28V176l-103 72z"/>
                <path fill="#FBBC04" d="M314 204v248l103-72V176l-103 28z" opacity=".6"/>
                <path fill="#EA4335" d="M133 204V176L224 240l91-64v28L224 268z"/>
                <path fill="#C5221F" d="M0 176l103 72V204L0 176z"/>
                <path fill="#EA4335" d="M0 176l224 158 224-158v-28L224 304 0 148z"/>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Gmail</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {gmailConnected ? 'Connected — auto-detects payslips & transactions' : 'Connect to auto-import transactions from emails'}
                </div>
              </div>
            </div>
            <button
              onClick={gmailConnected ? disconnectGmail : connectGmail}
              disabled={gmailLoading}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: gmailConnected ? '0.5px solid #e55a5a55' : '0.5px solid var(--accent)55',
                background: gmailConnected ? 'rgba(229,90,90,0.1)' : 'var(--accent)11',
                color: gmailConnected ? '#e55a5a' : 'var(--accent)',
                opacity: gmailLoading ? 0.6 : 1,
              }}
            >
              {gmailLoading ? 'Connecting...' : gmailConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          {gmailError && <div style={{ fontSize: 11, color: '#e55a5a', marginTop: 6 }}>{gmailError}</div>}

          {/* Email rules */}
          {gmailConnected && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 8, fontFamily: 'ui-monospace,monospace' }}>
                DETECTION RULES — toggle to enable/disable
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {emailRules.map(rule => (
                  <div key={rule.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: rule.enabled !== false ? 'rgba(107,227,164,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `0.5px solid ${rule.enabled !== false ? 'rgba(107,227,164,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: rule.type === 'income' ? '#6BE3A4' : '#FF6B6B',
                      opacity: rule.enabled !== false ? 1 : 0.3,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: rule.enabled !== false ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>
                        {rule.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
                        keyword: "{rule.keyword}" &rarr; {rule.type} / {rule.category}
                      </div>
                    </div>
                    <button onClick={() => toggleRule(rule.id)} style={{
                      padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10,
                      background: rule.enabled !== false ? 'rgba(107,227,164,0.15)' : 'rgba(255,255,255,0.06)',
                      color: rule.enabled !== false ? '#6BE3A4' : 'rgba(255,255,255,0.3)',
                    }}>
                      {rule.enabled !== false ? 'ON' : 'OFF'}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8, lineHeight: 1.5 }}>
                Detected transactions appear in Finance &#8594; Overview as a review queue before being added.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          API KEYS
        </div>

        <Row label="Google Custom Search  API key" hint="Enables real shopping results in the Style tab. Free tier: 100 searches/day">
          <Input value={googleSearchKey} onChange={setGoogleSearchKey} placeholder="AIza…" masked />
        </Row>
        <Row label="Google Custom Search  Engine ID (cx)" hint="Create at programmablesearchengine.google.com">
          <Input value={googleSearchCx} onChange={setGoogleSearchCx} placeholder="12345:abcdef" />
        </Row>
        <Row label="ExerciseDB API key" hint="Exercise library with GIFs for workout planning. Free tier available at rapidapi.com">
          <Input value={exerciseDbKey} onChange={setExerciseDbKey} placeholder="Your RapidAPI key" masked />
        </Row>
        <Row label="Finnhub API key" hint="Free real-time stock quotes  sign up at finnhub.io (no credit card). 60 calls/min free tier.">
          <Input value={finnhubKey} onChange={setFinnhubKey} placeholder="Your Finnhub API key" masked />
        </Row>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          STOCKS WATCHLIST
        </div>
        <Row label="Add ticker" hint="US stocks, ETFs, and indices. E.g. AAPL, MSFT, SPY, BTC-USD">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={watchlistInput}
              onChange={e => setWatchlistInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addTicker()}
              placeholder="AAPL"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
            <button onClick={addTicker} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontSize: 13 }}>Add</button>
          </div>
        </Row>
        {watchlist.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {watchlist.map(sym => (
              <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{sym}</span>
                <button onClick={() => removeTicker(sym)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e55a5a', fontSize: 14, lineHeight: 1, padding: 0 }}></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*  Apple Health Auto Export  */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          APPLE HEALTH
        </div>
        <div style={{
          padding: '16px 18px', borderRadius: 12,
          border: '0.5px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🏥</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Health Auto Export</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Syncs Apple Health data to VALERIE automatically</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 14 }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Setup (one-time):</strong>
            1. Download <strong>Health Auto Export</strong> (free) from the App Store<br />
            2. Open   <strong>Automations   New Automation   REST API</strong><br />
            3. Paste the webhook URL below, set Method to <strong>POST</strong>, Format to <strong>JSON</strong><br />
            4. Select metrics: Sleep, Steps, Heart Rate, HRV, Active Energy, Weight, Body Fat<br />
            5. Set frequency: <strong>Hourly</strong>   Save   Enable
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '12px 14px',
            fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 2,
            color: 'rgba(255,255,255,0.7)', marginBottom: 14,
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 6, letterSpacing: '0.1em' }}>WEBHOOK CONFIG</div>
            <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>URL: </span><span style={{ color: 'var(--accent)', userSelect: 'all' }}>https://healthsync-eglap5gvxa-uc.a.run.app</span></div>
            <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Method: </span><span style={{ color: 'rgba(255,255,255,0.5)' }}>POST</span></div>
            <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Format: </span><span style={{ color: 'rgba(255,255,255,0.5)' }}>JSON</span></div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.55 }}>
            Once syncing, Health Overview shows a live badge and auto-fills sleep, steps, heart rate, HRV, and weight from your iPhone and Apple Watch.
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
        marginBottom: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Webhooks</strong>  Connect to Zapier, Make, or n8n.
        Define outgoing webhook URLs for task completion, mood logs, focus sessions, and custom events.
        <br />
        <span style={{ color: 'var(--accent)', cursor: 'pointer', marginTop: 6, display: 'inline-block' }}>
          Coming in next session  
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

//  Section: API Usage 
// NOTE: Anthropic does not expose a public credit balance endpoint via API key.
// Usage data is only available at console.anthropic.com.
// This section shows locally tracked token estimates and links to the console.
function ApiUsageSection({ settings }) {
  // Read locally tracked usage from storage (we track tokens when we make calls)
  const localLog   = storage.get('valerie_xp', { total: 0, log: [] });
  const currency   = settings.currency || 'AUD';
  const currSymbol = currencySym(currency);
  const rate       = currency === 'AUD' ? 1.55 : currency === 'GBP' ? 0.64 : currency === 'EUR' ? 0.73 : 1.0;

  return (
    <div>
      <SectionTitle>API Usage</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Console link  primary action */}
          <div style={{
            padding: '18px 20px', borderRadius: 12,
            background: 'var(--accent)08', border: '1px solid var(--accent)33',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              Monitor your usage
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.55 }}>
              Anthropic's API doesn't expose a public balance endpoint  exact credit usage,
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
              Open Anthropic Console  
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
              { label: 'Typical session (~4K tokens)', price: `0 ${currSymbol}${(0.004 * 15.0 * rate).toFixed(4)}` },
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
    </div>
  );
}

//  Section: Progress & Rank 
// Per the Progress Tab Design spec: tier names renameable, XP thresholds
// adjustable, XP per action adjustable, option to hide rank system entirely.
export function ProgressSection({ settings, onSave }) {
  const rankSettings  = settings.rankSettings || {};
  const xpSettings    = settings.xpSettings   || {};

  // Tier names  defaults from TIER_CONFIG, overridable
  const [tierNames,    setTierNames]    = useState(() =>
    TIER_CONFIG.map(t => rankSettings.tierNames?.[t.tier] || t.name)
  );
  // XP thresholds  defaults from TIER_CONFIG
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

//  Section: Platforms 
// Every screen except Settings (never hideable), labelled by group.
const PLATFORM_TABS = ALL_TABS.filter(t => t.id !== 'settings');

const LAYOUT_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact',  label: 'Compact'  },
  { value: 'spacious', label: 'Spacious' },
];

function PlatformsSection({ settings, onSave }) {
  const [hiddenTabs,  setHiddenTabs]  = useState(() => settings.hiddenTabs  || []);
  const [tabLayouts,  setTabLayouts]  = useState(() => settings.tabLayouts  || {});
  const [autostart,   setAutostart]   = useState(false);
  const [autostartOk, setAutostartOk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  //  Updater state 
  const [updateState,   setUpdateState]   = useState('idle'); // idle | checking | available | installing | uptodate | error
  const [updateInfo,    setUpdateInfo]    = useState(null);   // { version, notes }
  const [updateError,   setUpdateError]   = useState('');

  const handleCheckUpdate = async () => {
    setUpdateState('checking');
    setUpdateError('');
    try {
      const result = await invoke('check_for_update');
      if (result.available) {
        setUpdateInfo(result);
        setUpdateState('available');
      } else {
        setUpdateState('uptodate');
        setTimeout(() => setUpdateState('idle'), 3000);
      }
    } catch (err) {
      setUpdateError(err?.message || String(err));
      setUpdateState('error');
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateState('installing');
    try {
      await invoke('install_update');
      // App will restart automatically after install
    } catch (err) {
      setUpdateError(err?.message || String(err));
      setUpdateState('error');
    }
  };

  // Check current autostart state on mount
  useEffect(() => {
    import('@tauri-apps/plugin-autostart')
      .then(({ isEnabled }) => isEnabled())
      .then(enabled => { setAutostart(enabled); setAutostartOk(true); })
      .catch(() => setAutostartOk(false));

    // Check current fullscreen state
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().isFullscreen())
      .then(setIsFullscreen)
      .catch(() => {});
  }, []);

  const handleFullscreenToggle = async (val) => {
    setIsFullscreen(val);
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFullscreen(val);
      onSave({ startFullscreen: val });
    } catch (err) {
      console.warn('[Settings] Fullscreen toggle unavailable:', err.message);
    }
  };

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

  // Toggle a tab's visibility  save immediately so Sidebar updates in real time
  const toggleTab = (tabId, visible) => {
    const next = visible
      ? hiddenTabs.filter(id => id !== tabId)
      : [...hiddenTabs.filter(id => id !== tabId), tabId];
    setHiddenTabs(next);
    onSave({ hiddenTabs: next });
  };

  // Update layout for a tab  save immediately
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

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 10, marginTop: 8,
          background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Fullscreen mode</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Toggle true fullscreen  borderless windowed by default
            </div>
          </div>
          <Toggle value={isFullscreen} onChange={handleFullscreenToggle} />
        </div>
      </div>

      {/* Auto-updater */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          UPDATES
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 10,
          background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              VALERIE {updateState === 'available' ? `v${updateInfo?.version} available` : `v${__APP_VERSION__}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {updateState === 'idle'       && 'Check for a newer version'}
              {updateState === 'checking'   && 'Checking…'}
              {updateState === 'uptodate'   && '✓ You\'re on the latest version'}
              {updateState === 'available'  && (updateInfo?.notes || 'A new version is ready to install')}
              {updateState === 'installing' && 'Downloading and installing… VALERIE will restart'}
              {updateState === 'error'      && `Error: ${updateError}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {updateState === 'available' ? (
              <button
                onClick={handleInstallUpdate}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Install & Restart
              </button>
            ) : (
              <button
                onClick={handleCheckUpdate}
                disabled={updateState === 'checking' || updateState === 'installing'}
                style={{ padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: updateState === 'checking' ? 0.5 : 1, whiteSpace: 'nowrap' }}
              >
                {updateState === 'checking' ? 'Checking…' : 'Check for updates'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab visibility + layout density */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.04em' }}>
          WINDOWS TAB VISIBILITY
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          Hidden tabs disappear from the sidebar  their data is preserved and restored when re-enabled.
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

                {/* Layout density row  only shown when tab is visible */}
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

//  Section: Data 
export function DataSection() {
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
    a.download = `VALERIE_backup_${toLocalDateKey(new Date())}.json`;
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
          {exported ? '✓ Downloaded' : '📥 Export as JSON'}
        </button>
      </Row>

      <Row label="Import data" hint="Restore from a previous JSON export">
        <div style={{
          padding: '14px 16px', borderRadius: 10, border: '1px dashed var(--card-border)',
          color: 'var(--text-muted)', fontSize: 12, textAlign: 'center',
        }}>
          Import  coming in next session
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

//  Section: Daily Brief 
export function DailyBriefSection({ settings, onSave }) {
  const cfg = settings.dailyBrief ?? {};
  const [weather,  setWeather]  = useState(cfg.weather  !== false);
  const [calendar, setCalendar] = useState(cfg.calendar !== false);
  const [tasks,    setTasks]    = useState(cfg.tasks    !== false);
  const [vitamins, setVitamins] = useState(cfg.vitamins !== false);
  const [routine,  setRoutine]  = useState(cfg.routine  !== false);
  const [saved,    setSaved]    = useState(false);

  function handleSave() {
    onSave({ dailyBrief: { weather, calendar, tasks, vitamins, routine } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetToday() {
    storage.remove('daily_brief_date');
    alert('Daily brief will appear again on next app launch.');
  }

  return (
    <div>
      <SectionTitle>Daily Brief <SavedBadge show={saved} /></SectionTitle>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.55 }}>
        VALERIE greets you on first launch each day and offers a spoken brief. Toggle each section on or off.
      </div>

      <Row label="Weather" hint="Current temperature and conditions using your device location (Open-Meteo, no API key required)">
        <Toggle value={weather} onChange={setWeather} />
      </Row>
      <Row label="Calendar" hint="Today's events from your Calendar tab">
        <Toggle value={calendar} onChange={setCalendar} />
      </Row>
      <Row label="Tasks" hint="Outstanding high-priority tasks">
        <Toggle value={tasks} onChange={setTasks} />
      </Row>
      <Row label="Vitamins & Supplements" hint="Morning supplements from your Health tab">
        <Toggle value={vitamins} onChange={setVitamins} />
      </Row>
      <Row label="Morning Routine" hint="Active routine steps from the Routines tab">
        <Toggle value={routine} onChange={setRoutine} />
      </Row>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={handleSave} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Save
        </button>
        <button onClick={resetToday} style={{ padding: '9px 20px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Show brief again today
        </button>
      </div>
    </div>
  );
}

//  Section: Sidebar Order 
function SidebarSection({ settings, onSave }) {
  const defaultOrder = ALL_TABS.map(t => t.id);
  const [order, setOrder] = useState(() => {
    try {
      let saved = storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null);
      // Firestore may have stored { order: [...] }  unwrap if needed
      if (saved && !Array.isArray(saved) && Array.isArray(saved.order)) saved = saved.order;
      if (Array.isArray(saved) && saved.length) {
        const known = new Set(saved);
        const extra = defaultOrder.filter(id => !known.has(id));
        return [...saved.filter(id => defaultOrder.includes(id)), ...extra];
      }
    } catch { /* fall through to default */ }
    return defaultOrder;
  });
  const [dragIdx, setDragIdx] = useState(null);
  const [saved,   setSaved]   = useState(false);

  const tabLabels = Object.fromEntries(ALL_TABS.map(t => [t.id, t.label]));

  function handleDragStart(i) { setDragIdx(i); }
  function handleDragOver(e, i) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    setOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIdx(i);
  }
  function handleDragEnd() { setDragIdx(null); }

  function syncSidebarOrder(o) {
    storage.set(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, o);
    const userId = getUserIdSync();
    if (!userId) {
      window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: '⚠️ Not signed in — sidebar order saved on this device only', type: 'error' } }));
    } else {
      supabase.from('user_meta').upsert({ user_id: userId, key: 'sidebar_order_desktop', value: { order: o } }, { onConflict: 'user_id,key' }).then(({ error }) => {
        if (error) {
          console.error('[Sidebar order sync]', error.message);
          window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: `⚠️ Couldn't sync sidebar order — ${error.message}`, type: 'error' } }));
        }
      });
    }
    window.dispatchEvent(new Event('valerie:sidebar-order-changed'));
  }
  function saveOrder() {
    syncSidebarOrder(order);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  function resetOrder() {
    setOrder(defaultOrder);
    syncSidebarOrder(defaultOrder);
  }

  return (
    <div>
      <SectionTitle>Sidebar Order <SavedBadge show={saved} /></SectionTitle>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.55 }}>
        Drag to reorder sidebar tabs. Vault and Settings are always pinned at the bottom.
        Order is saved per platform  desktop and iOS have separate orders.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {order.map((id, i) => (
          <div
            key={id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: dragIdx === i ? 'var(--accent)15' : 'var(--bg-panel)',
              border: `0.5px solid ${dragIdx === i ? 'var(--accent)' : 'var(--card-border)'}`,
              cursor: 'grab', userSelect: 'none', transition: 'background 0.1s',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: 12, cursor: 'grab' }}>⠿</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tabLabels[id] || id}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{i + 1}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={saveOrder} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Save Order
        </button>
        <button onClick={resetOrder} style={{ padding: '9px 20px', borderRadius: 8, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Reset to default
        </button>
      </div>
    </div>
  );
}

//  Section: Security 
export function SecuritySection({ settings, onSave }) {
  const [autoLock,   setAutoLock]   = useState(settings.vaultAutoLockMinutes ?? 5);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [saved,      setSaved]      = useState(false);

  // Access code management
  const [hasCode,    setHasCode]    = useState(lockScreenEnabled);
  const [newPass,    setNewPass]    = useState('');
  const [confirmPass,setConfirmPass]= useState('');
  const [codeStatus, setCodeStatus] = useState('');

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
    if (window.confirm('Final confirmation  this action is irreversible. All data will be destroyed.')) {
      storage.clear();
      localStorage.clear();
      window.location.reload();
    }
  };

  async function handleSetCode(e) {
    e.preventDefault();
    if (newPass.length < 4) { setCodeStatus('Minimum 4 characters.'); return; }
    if (newPass !== confirmPass) { setCodeStatus('Passwords do not match.'); return; }
    await changeLockPassword(newPass);
    setHasCode(true); setNewPass(''); setConfirmPass('');
    setCodeStatus('Access code updated. Takes effect on next open.');
    setTimeout(() => setCodeStatus(''), 4000);
  }

  function handleRemoveCode() {
    if (!window.confirm('Remove your access code? The app will open without a password.')) return;
    clearLockScreen();
    setHasCode(false);
    setCodeStatus('Access code removed.');
    setTimeout(() => setCodeStatus(''), 3000);
  }

  return (
    <div>
      <SectionTitle>Security <SavedBadge show={saved} /></SectionTitle>

      {/* ── Access code ── */}
      <div style={{ marginBottom: 28, padding: '18px 20px', borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          App Access Code {hasCode && <span style={{ fontSize: 10, color: '#4caf7d', marginLeft: 6, fontWeight: 400 }}>● Active</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
          {hasCode
            ? 'The app is password-protected on every open. Face ID / Touch ID is offered if your device supports it.'
            : 'Set a password to lock VALERIE on every open. Face ID / Touch ID will be offered automatically on supported devices.'}
        </div>
        <form onSubmit={handleSetCode} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="password"
            placeholder={hasCode ? 'New password' : 'Create password'}
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            autoComplete="new-password"
            style={{ padding: '9px 12px', borderRadius: 8, border: '0.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            autoComplete="new-password"
            style={{ padding: '9px 12px', borderRadius: 8, border: '0.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ flex: 1, padding: '9px 16px', borderRadius: 8, border: '0.5px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: 'rgba(167,139,250,0.9)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              {hasCode ? 'Change access code' : 'Set access code'}
            </button>
            {hasCode && (
              <button type="button" onClick={handleRemoveCode} style={{ padding: '9px 14px', borderRadius: 8, border: '0.5px solid rgba(229,90,90,0.3)', background: 'rgba(229,90,90,0.07)', color: '#e55a5a', fontSize: 12, cursor: 'pointer' }}>
                Remove
              </button>
            )}
          </div>
        </form>
        {codeStatus && <div style={{ marginTop: 8, fontSize: 11, color: codeStatus.includes('don\'t') || codeStatus.includes('Minimum') || codeStatus.includes('match') ? '#e55a5a' : '#4caf7d' }}>{codeStatus}</div>}
      </div>

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

      {/* Account deletion  locked behind confirmation phrase */}
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

//  Main Settings Tab 

// --- Section: Account --------------------------------------------------------
export function AccountSection() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthUser().then(u => { setUser(u); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const email = user?.email || '';

  async function handleSignOut() {
    await supabaseSignOut();
    setUser(null);
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>;

  return (
    <div>
      <SectionTitle>Account and Sync</SectionTitle>
      <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)', marginBottom: 20 }}>
        {user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4caf7d', boxShadow: '0 0 6px #4caf7d' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Signed in</div>
                {email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{email}</div>}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              Data syncing across all your devices in real time.
            </div>
            <button onClick={handleSignOut} style={{ padding: '8px 18px', borderRadius: 8, border: '0.5px solid #e55a5a55', background: 'rgba(229,90,90,0.08)', color: '#e55a5a', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Sign out
            </button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not signed in.</div>
        )}
      </div>
    </div>
  );
}

export default function SettingsTab({ settings: settingsProp }) {
  const [activeSection, setActiveSection] = useState('identity');

  // Allow VALERIE to navigate to a specific settings section via action
  useEffect(() => {
    const handler = (e) => { if (e.detail) setActiveSection(e.detail); };
    window.addEventListener('valerie:settings-section', handler);
    return () => window.removeEventListener('valerie:settings-section', handler);
  }, []);

  // Load settings from localStorage  source of truth
  const [settings, setSettings] = useState(() => storage.get(STORAGE_KEYS.SETTINGS, {}));

  // Persist partial updates to localStorage + Firestore and notify App in real time
  const handleSave = useCallback((updates) => {
    try {
      const merged = updateSettings(updates, settings);
      setSettings(merged);
      if (updates.theme) applyTheme(updates.theme);
    } catch (err) {
      console.error('[Settings] handleSave error:', err);
    }
  }, [settings]);

  const renderSection = () => {
    const wrap = (el) => <SectionErrorBoundary key={activeSection}>{el}</SectionErrorBoundary>;
    switch (activeSection) {
      case 'identity':      return wrap(<IdentitySection      settings={settings} onSave={handleSave} />);
      case 'appearance':    return wrap(<AppearanceSection    settings={settings} onSave={handleSave} />);
      case 'voice':         return wrap(<VoiceSection         settings={settings} onSave={handleSave} />);
      case 'ai':            return wrap(<AISection            settings={settings} onSave={handleSave} />);
      case 'units':         return wrap(<UnitsSection         settings={settings} onSave={handleSave} />);
      case 'progress':      return wrap(<ProgressSection      settings={settings} onSave={handleSave} />);
      case 'notifications': return wrap(<NotificationsSection settings={settings} onSave={handleSave} />);
      case 'integrations':  return wrap(<IntegrationsSection  settings={settings} onSave={handleSave} />);
      case 'api_usage':     return wrap(<ApiUsageSection      settings={settings} />);
      case 'platforms':     return wrap(<PlatformsSection     settings={settings} onSave={handleSave} />);
      case 'data':          return wrap(<DataSection />);
      case 'daily_brief':   return wrap(<DailyBriefSection   settings={settings} onSave={handleSave} />);
      case 'sidebar':       return wrap(<SidebarSection      settings={settings} onSave={handleSave} />);
      case 'security':      return wrap(<SecuritySection      settings={settings} onSave={handleSave} />);
      case 'account':       return wrap(<AccountSection />);
      default:              return null;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/*  Left nav  */}
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

        {/*  Version label  */}
        <div style={{
          marginTop: 'auto', padding: '16px 16px 8px',
          fontSize: 10, color: 'var(--text-muted)',
          letterSpacing: '0.08em', fontFamily: 'ui-monospace, monospace',
          opacity: 0.5,
        }}>
          Arete v{__APP_VERSION__}
        </div>
      </nav>

      {/*  Right content  */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
        {renderSection()}
      </div>
    </div>
  );
}








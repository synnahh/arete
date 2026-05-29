// ─── Settings Tab — Session 6 ────────────────────────────────────────────────
// Full 11-section settings hub. Every change persists to localStorage instantly.
// Split view: left nav (130px) + right scrollable content.

import { useState, useEffect, useCallback, useRef } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { THEMES, applyTheme }    from '../styles/themes.js';

// ─── Sections ────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'identity',      label: 'Identity',      icon: '👤' },
  { id: 'appearance',    label: 'Appearance',    icon: '🎨' },
  { id: 'voice',         label: 'Voice',         icon: '🎙️' },
  { id: 'ai',            label: 'AI',            icon: '🧠' },
  { id: 'units',         label: 'Units & Currency', icon: '💱' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'integrations',  label: 'Integrations',  icon: '🔌' },
  { id: 'api_usage',     label: 'API Usage',     icon: '📊' },
  { id: 'platforms',     label: 'Platforms',     icon: '🖥️' },
  { id: 'data',          label: 'Data',          icon: '💾' },
  { id: 'security',      label: 'Security',      icon: '🔒' },
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

// ─── Section: Appearance ──────────────────────────────────────────────────────
function AppearanceSection({ settings, onSave }) {
  const [theme,     setTheme]     = useState(settings.theme     || 'obsidian');
  const [orbShape,  setOrbShape]  = useState(settings.orbShape  || 'sphere');
  const [animLevel, setAnimLevel] = useState(settings.animationIntensity || 'full');
  const [bgStyle,   setBgStyle]   = useState(settings.backgroundStyle   || 'time-of-day');
  const [saved, setSaved] = useState(false);

  const handleTheme = (key) => {
    setTheme(key);
    applyTheme(key);
    // Auto-save theme immediately
    onSave({ theme: key });
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
              {/* Colour swatch row */}
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.preview.sidebar }} />
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.preview.bg }} />
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.preview.accent }} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: t.light ? '#1a1a2e' : '#fff',
                textAlign: 'left',
              }}>{t.name}</span>
              <span style={{
                fontSize: 9.5,
                color: t.light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)',
                textAlign: 'left', lineHeight: 1.3,
              }}>{t.description}</span>
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
  const [voices,     setVoices]     = useState([]);
  const [voiceURI,   setVoiceURI]   = useState(settings.voice?.voiceURI   || '');
  const [rate,       setRate]       = useState(settings.voice?.rate       ?? 0.95);
  const [pitch,      setPitch]      = useState(settings.voice?.pitch      ?? 1.0);
  const [azureKey,   setAzureKey]   = useState(settings.azureKey          || '');
  const [el11Key,    setEl11Key]    = useState(settings.elevenlabsKey     || '');
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis?.getVoices() || [];
      setVoices(v);
    };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  const handlePreview = () => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance("Ready when you are, Rob.");
    const found = voices.find(v => v.voiceURI === voiceURI);
    if (found) utt.voice = found;
    utt.rate  = rate;
    utt.pitch = pitch;
    window.speechSynthesis.speak(utt);
  };

  const handleSave = () => {
    onSave({
      voice: { voiceURI, rate, pitch, volume: 1.0, lang: 'en-AU' },
      azureKey,
      elevenlabsKey: el11Key,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const enVoices = voices.filter(v => v.lang?.startsWith('en'));

  return (
    <div>
      <SectionTitle>Voice <SavedBadge show={saved} /></SectionTitle>

      {/* Priority explanation */}
      <div style={{
        background: 'var(--hover-bg)', borderRadius: 8, padding: '10px 14px',
        marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
      }}>
        Voice priority: <strong style={{ color: 'var(--text-primary)' }}>ElevenLabs</strong> (if key set)
        → <strong style={{ color: 'var(--text-primary)' }}>Azure Neural</strong> (if key set)
        → <strong style={{ color: 'var(--text-primary)' }}>System voice</strong>
      </div>

      <Row label="System voice" hint="Choose from voices available on your device">
        <select
          value={voiceURI}
          onChange={e => setVoiceURI(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px',
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
          }}
        >
          <option value="">— System default —</option>
          {enVoices.map(v => (
            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
          ))}
        </select>
        <button
          onClick={handlePreview}
          style={{
            marginTop: 8, padding: '6px 16px', borderRadius: 8,
            border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}
        >
          ▶ Preview voice
        </button>
      </Row>

      <Row label="Speech rate">
        <Slider value={rate} onChange={setRate} min={0.5} max={2.0} step={0.05} />
      </Row>

      <Row label="Pitch">
        <Slider value={pitch} onChange={setPitch} min={0.5} max={2.0} step={0.05} />
      </Row>

      <Row label="Azure Neural Voices API key" hint="Free tier available — premium quality voices">
        <Input value={azureKey} onChange={setAzureKey} placeholder="Your Azure Cognitive Services key" masked />
      </Row>

      <Row label="ElevenLabs API key" hint="Most natural voice — optional premium upgrade">
        <Input value={el11Key} onChange={setEl11Key} placeholder="Your ElevenLabs API key" masked />
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

  useEffect(() => {
    fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
      .then(r => r.json())
      .then(d => setOllamaModels((d.models || []).map(m => m.name)))
      .catch(() => {});
  }, []);

  const handleSave = () => {
    onSave({ apiKey, ollamaModel, preferOffline, dailyTokenBudget: tokenBudget, smartRouting });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>AI Configuration <SavedBadge show={saved} /></SectionTitle>

      <Row label="Claude API key" hint="Your Anthropic API key — stored locally, never transmitted anywhere except to api.anthropic.com">
        <Input value={apiKey} onChange={setApiKey} placeholder="sk-ant-…" masked />
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
function ApiUsageSection({ settings }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsage = async () => {
    if (!settings.apiKey) { setError('No API key set — add it in the AI section first.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('https://api.anthropic.com/v1/usage', {
        headers: { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setUsage(data);
    } catch (err) {
      setError(err.message || 'Could not reach Anthropic usage API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsage(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Estimate costs (approximate — Sonnet 4 pricing)
  const inputCost  = ((usage?.total_input_tokens  || 0) / 1_000_000) * 3.0;
  const outputCost = ((usage?.total_output_tokens || 0) / 1_000_000) * 15.0;
  const totalCost  = (inputCost + outputCost) * (settings.currency === 'AUD' ? 1.55 : 1.0);
  const currSymbol = settings.currency === 'GBP' ? '£' : settings.currency === 'EUR' ? '€' : '$';

  return (
    <div>
      <SectionTitle>API Usage</SectionTitle>

      {!settings.apiKey ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Add your Claude API key in the AI section to see usage stats.
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading usage data…</div>
      ) : error ? (
        <div>
          <div style={{ color: '#e55a5a', fontSize: 13, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchUsage} style={{
            padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)',
            background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>Retry</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Input tokens',  value: (usage?.total_input_tokens  || 0).toLocaleString() },
              { label: 'Output tokens', value: (usage?.total_output_tokens || 0).toLocaleString() },
              { label: 'Estimated cost', value: `${currSymbol}${totalCost.toFixed(4)}` },
              { label: 'Model',          value: 'Sonnet 4' },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <button onClick={fetchUsage} style={{
            padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--card-border)',
            background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: 12,
            cursor: 'pointer', alignSelf: 'flex-start',
          }}>
            Refresh
          </button>

          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Top up credits at console.anthropic.com ↗
          </a>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Pricing estimate based on claude-sonnet-4 public rates ($3/M input · $15/M output).
            Check console.anthropic.com for exact billing.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Platforms ───────────────────────────────────────────────────────
function PlatformsSection() {
  const tabs = ['Dashboard','Assistant','Tasks','Calendar','Notes','Health','Finance',
                'Progress','Style','Essentials','Lists','Focus','Vault','Settings'];
  const [win, setWin] = useState(() => Object.fromEntries(tabs.map(t => [t, true])));

  return (
    <div>
      <SectionTitle>Platform Preferences</SectionTitle>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55 }}>
        Control which tabs are visible on each platform. Windows is fully managed here.
        Mac and iOS visibility will be configured in later sessions.
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
          WINDOWS APP
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tabs.map(tab => (
            <div key={tab} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tab}</span>
              <Toggle value={win[tab] ?? true} onChange={v => setWin(p => ({ ...p, [tab]: v }))} />
            </div>
          ))}
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

  // Persist partial updates to localStorage
  const handleSave = useCallback((updates) => {
    const merged = { ...settings, ...updates };
    setSettings(merged);
    storage.set(STORAGE_KEYS.SETTINGS, merged);

    // Apply theme immediately if changed
    if (updates.theme) applyTheme(updates.theme);
  }, [settings]);

  const renderSection = () => {
    switch (activeSection) {
      case 'identity':      return <IdentitySection      settings={settings} onSave={handleSave} />;
      case 'appearance':    return <AppearanceSection    settings={settings} onSave={handleSave} />;
      case 'voice':         return <VoiceSection         settings={settings} onSave={handleSave} />;
      case 'ai':            return <AISection            settings={settings} onSave={handleSave} />;
      case 'units':         return <UnitsSection         settings={settings} onSave={handleSave} />;
      case 'notifications': return <NotificationsSection settings={settings} onSave={handleSave} />;
      case 'integrations':  return <IntegrationsSection  settings={settings} onSave={handleSave} />;
      case 'api_usage':     return <ApiUsageSection      settings={settings} />;
      case 'platforms':     return <PlatformsSection />;
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

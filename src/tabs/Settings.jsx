// ─── Settings Tab — Session 6 ────────────────────────────────────────────────
// Full 11-section settings hub. Every change persists to localStorage instantly.
// Split view: left nav (130px) + right scrollable content.

import { Icon as LineIcon } from '../components/icons.jsx';
import { DEFAULT_COACH_REMINDERS } from '../domain/reminders.js';
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

// Local error boundary — catches crashes inside any settings section
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

// ─── Sections ────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'identity',      label: 'Profile',          icon: 'user' },
  { id: 'appearance',    label: 'Appearance',       icon: 'theme' },
  { id: 'units',         label: 'Units & Currency', icon: 'globe' },
  { id: 'progress',      label: 'Progress & Rank',  icon: 'progress' },
  { id: 'notifications', label: 'Notifications',    icon: 'bell' },
  { id: 'integrations',  label: 'Integrations',     icon: 'plug' },
  { id: 'api_usage',     label: 'API Usage',        icon: 'chart' },
  { id: 'platforms',     label: 'Platforms',        icon: 'monitor' },
  { id: 'data',          label: 'Data',             icon: 'database' },
  { id: 'sidebar',       label: 'Sidebar Order',    icon: 'lists'  },
  { id: 'security',      label: 'Security',         icon: 'lock' },
  { id: 'account',       label: 'Account',          icon: 'cloud'  },
];

// ─── Currency & Unit constants ────────────────────────────────────────────────
export const CURRENCIES = [
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar' },
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
            background: value === opt.value ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'var(--hover-bg)',
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

// ─── Section: Identity ────────────────────────────────────────────────────────
export function IdentitySection({ settings, onSave }) {
  const [userName, setUserName] = useState(settings.userName || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave({ userName: userName.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle>Profile <SavedBadge show={saved} /></SectionTitle>

      <Row label="Your name" hint="Shown in the greeting on Home">
        <Input value={userName} onChange={setUserName} placeholder="Your name" />
      </Row>

      <button
        onClick={handleSave}
        style={{
          padding: '9px 24px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--bg-base)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Save
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
export function AppearanceSection({ settings, onSave }) {
  const [theme,       setTheme]       = useState(settings.theme             || 'obsidian');
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
    onSave({ animationIntensity: animLevel, backgroundStyle: bgStyle });
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
                boxShadow: theme === t.key ? '0 0 0 2px color-mix(in srgb, var(--accent) 33%, transparent)' : 'none',
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
              <span style={{ fontSize: 10.5, color: t.light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)', textAlign: 'left', lineHeight: 1.3 }}>
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </Row>

      {/* Custom accent colour */}
      <Row label="Custom accent colour" hint="Overrides the theme's default accent for highlights and active states">
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
                background: fontFamily === f.value ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'var(--hover-bg)',
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
      <Row label="Headings" hint="Font for screen titles. Body text keeps the font above.">
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

// ─── Section: Units & Currency ────────────────────────────────────────────────
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
                background: currency === c.code ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'var(--hover-bg)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: currency === c.code ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'var(--bg-panel)',
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
                background: units === opt.value ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'var(--hover-bg)',
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
const TAB_REMINDERS_DEFAULT = {
  water:       { enabled: true,  hour: 12, message: 'Arete: Only {value}ml logged. Goal is {goal}ml.' },
  nutrition:   { enabled: true,  hour: 13, message: 'Arete: No calories logged yet. {value} kcal remaining.' },
  supplements: { enabled: true,  hour: 10, message: 'Arete: {value} supplement(s) not taken yet today.' },
  habits:      { enabled: true,  hour: 9,  message: 'Arete: {value} habit(s) still pending today.' },
  tasks:       { enabled: true,  hour: 10, message: 'Arete: {value} task(s) need your attention.' },
  sleep:       { enabled: true,  hour: 8,  message: 'Arete: Log last night\'s sleep to track your recovery.' },
  workout:     { enabled: false, hour: 18, message: 'Arete: No workout logged today. Rest day or forgot?' },
  calendar:    { enabled: true,  hour: 8,  message: 'Arete: {value} starts in {time} minutes.', calMinutes: 30 },
  finance:     { enabled: true,  hour: 9,  message: 'Arete: Weekly spend so far: {value}.', weeklyOnly: true },
};

export function NotificationsSection({ settings, onSave }) {
  const [enabled,          setEnabled]          = useState(settings.notifications?.enabled ?? true);
  const [nudges,           setNudges]           = useState(settings.notifications?.proactiveNudges ?? true);
  const [sms,              setSms]              = useState(settings.notifications?.sms === true);
  const [coach,            setCoach]            = useState(() => ({ ...DEFAULT_COACH_REMINDERS, ...(settings.notifications?.coach ?? {}) }));
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
  const [msgAlert,         setMsgAlert]         = useState(settings.smsMessages?.alert || 'ARETE ALERT: {message}');

  const [pushStatus,    setPushStatus]    = useState(() => pushPermissionStatus());
  const [pushLoading,   setPushLoading]   = useState(false);
  const [smsTestStatus, setSmsTestStatus] = useState(null);
  const [saved,         setSaved]         = useState(false);

  function updateTab(key, patch) {
    setTabReminders(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const handleSave = () => {
    onSave({
      notifications: { enabled, proactiveNudges: nudges, tabs: tabReminders, coach, sms },
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

      <Row label="Enable notifications" hint="Master toggle for all Arete notifications">
        <Toggle value={enabled} onChange={setEnabled} />
      </Row>

      {enabled && (
        <>
          <Block label="Coach check-ins">
            <Row label="Morning and evening check-in" hint="Once each, the most important thing to do next, with why. Never at night.">
              <Toggle value={coach.enabled !== false} onChange={(v) => setCoach(c => ({ ...c, enabled: v }))} />
            </Row>
            {coach.enabled !== false && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                {[['morning', 'Morning', [6, 7, 8, 9, 10, 11]], ['evening', 'Evening', [16, 17, 18, 19, 20, 21]]].map(([k, name, hours]) => (
                  <label key={k} style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {name}
                    <select value={coach[k]} onChange={e => setCoach(c => ({ ...c, [k]: Number(e.target.value) }))}
                      style={{ background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', borderRadius: 7, padding: '6px 8px', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                      {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </Block>

          <Block label="Text messages">
            <Row label="Send reminders as texts" hint="Uses the send-sms server function, which holds the Twilio details and can only text your own number. Off until you set that up (docs/deploy-runbook.md).">
              <Toggle value={sms} onChange={setSms} />
            </Row>
          </Block>

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
          <Block label="Arete Nudges">
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
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>SEND AT HOUR</label>
                            <select value={tab.hour} onChange={e => updateTab(key, { hour: +e.target.value })}
                              style={{ width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}>
                              {Array.from({ length: 17 }, (_, i) => i + 6).map(h => (
                                <option key={h} value={h}>{h}:00 {h < 12 ? 'AM' : h === 12 ? 'PM' : `${h-12}PM`}</option>
                              ))}
                            </select>
                          </div>
                          {key === 'calendar' && (
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>REMINDER (MIN BEFORE)</label>
                              <input type="number" min={5} max={120} value={tab.calMinutes ?? 30}
                                onChange={e => updateTab(key, { calMinutes: +e.target.value })}
                                style={{ width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
                            </div>
                          )}
                        </div>

                        {/* Message */}
                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>
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

          {/* ── Twilio credentials ── */}
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

          {/* ── Twilio numbers ── */}
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

          {/* ── Test SMS button ── */}
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
        <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="music" size={22} strokeWidth={1.5} /></span>
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

// ─── Section: Integrations ────────────────────────────────────────────────────
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
                border: gmailConnected ? '0.5px solid #e55a5a55' : '0.5px solid color-mix(in srgb, var(--accent) 33%, transparent)',
                background: gmailConnected ? 'rgba(229,90,90,0.1)' : 'color-mix(in srgb, var(--accent) 7%, transparent)',
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
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'ui-monospace,monospace' }}>
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>
                        keyword: "{rule.keyword}" &rarr; {rule.type} / {rule.category}
                      </div>
                    </div>
                    <button onClick={() => toggleRule(rule.id)} style={{
                      padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
                      background: rule.enabled !== false ? 'rgba(107,227,164,0.15)' : 'rgba(255,255,255,0.06)',
                      color: rule.enabled !== false ? '#6BE3A4' : 'rgba(255,255,255,0.3)',
                    }}>
                      {rule.enabled !== false ? 'ON' : 'OFF'}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8, lineHeight: 1.5 }}>
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

        <Row label="Google Custom Search — API key" hint="Enables real shopping results in the Style tab. Free tier: 100 searches/day">
          <Input value={googleSearchKey} onChange={setGoogleSearchKey} placeholder="AIza…" masked />
        </Row>
        <Row label="Google Custom Search — Engine ID (cx)" hint="Create at programmablesearchengine.google.com">
          <Input value={googleSearchCx} onChange={setGoogleSearchCx} placeholder="12345:abcdef" />
        </Row>
        <Row label="ExerciseDB API key" hint="Exercise library with GIFs for workout planning. Free tier available at rapidapi.com">
          <Input value={exerciseDbKey} onChange={setExerciseDbKey} placeholder="Your RapidAPI key" masked />
        </Row>
        <Row label="Finnhub API key" hint="Free real-time stock quotes — sign up at finnhub.io (no credit card). 60 calls/min free tier.">
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
                <button onClick={() => removeTicker(sym)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e55a5a', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
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
            <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="health" size={22} strokeWidth={1.5} /></span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Health Auto Export</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Syncs Apple Health data to Arete automatically</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 14 }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Setup (one-time):</strong>
            1. Download <strong>Health Auto Export</strong> (free) from the App Store<br />
            2. Open <strong>Automations → New Automation → REST API</strong><br />
            3. Paste the webhook URL below, set Method to <strong>POST</strong>, Format to <strong>JSON</strong><br />
            4. Select metrics: Sleep, Steps, Heart Rate, HRV, Active Energy, Weight, Body Fat<br />
            5. Set frequency to <strong>Hourly</strong>, then Save and Enable
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '12px 14px',
            fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 2,
            color: 'var(--text-secondary)', marginBottom: 14,
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6, letterSpacing: '0.1em' }}>WEBHOOK CONFIG</div>
            <div><span style={{ color: 'var(--text-muted)' }}>URL: </span><span style={{ color: 'var(--accent)', userSelect: 'all' }}>https://healthsync-eglap5gvxa-uc.a.run.app</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Method: </span><span style={{ color: 'var(--text-secondary)' }}>POST</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Format: </span><span style={{ color: 'var(--text-secondary)' }}>JSON</span></div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Once syncing, Health Overview shows a live badge and auto-fills sleep, steps, heart rate, HRV, and weight from your iPhone and Apple Watch.
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
        marginBottom: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Webhooks</strong> — Connect to Zapier, Make, or n8n.
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

// ─── Section: API Usage ────────────────────────────────────────────────────────
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

          {/* Console link — primary action */}
          <div style={{
            padding: '18px 20px', borderRadius: 12,
            background: 'color-mix(in srgb, var(--accent) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
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
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
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
              {(localLog.log || []).length} logged events
            </div>
          </div>
      </div>
    </div>
  );
}

// ─── Section: Progress & Rank ─────────────────────────────────────────────────
// Per the Progress Tab Design spec: tier names renameable, XP thresholds
// adjustable, XP per action adjustable, option to hide rank system entirely.
export function ProgressSection({ settings, onSave }) {
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

  // ── Updater state ──────────────────────────────────────────────────────────
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
              Arete starts automatically when Windows boots
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
              Toggle true fullscreen — borderless windowed by default
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
              Arete {updateState === 'available' ? `v${updateInfo?.version} available` : `v${__APP_VERSION__}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {updateState === 'idle'       && 'Check for a newer version'}
              {updateState === 'checking'   && 'Checking…'}
              {updateState === 'uptodate'   && '✓ You\'re on the latest version'}
              {updateState === 'available'  && (updateInfo?.notes || 'A new version is ready to install')}
              {updateState === 'installing' && 'Downloading and installing… Arete will restart'}
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
                            background: layout === opt.value ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
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
    a.download = `Arete_backup_${toLocalDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div>
      <SectionTitle>Data</SectionTitle>

      <Row label="Export all data" hint="Downloads a JSON backup of all your Arete data. Vault is excluded for security.">
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
          Import — coming in next session
        </div>
      </Row>

      <Row label="Clear all app data" hint="Removes all local data except Vault. This cannot be undone.">
        <button
          onClick={() => {
            if (window.confirm('This will clear ALL Arete data (not the Vault). Are you absolutely sure?')) {
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

// ─── Section: Sidebar Order ───────────────────────────────────────────────────
function SidebarSection({ settings, onSave }) {
  const defaultOrder = ALL_TABS.map(t => t.id);
  const [order, setOrder] = useState(() => {
    try {
      let saved = storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null);
      // Firestore may have stored { order: [...] } — unwrap if needed
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
        Order is saved per platform — desktop and iOS have separate orders.
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
              background: dragIdx === i ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-panel)',
              border: `0.5px solid ${dragIdx === i ? 'var(--accent)' : 'var(--card-border)'}`,
              cursor: 'grab', userSelect: 'none', transition: 'background 0.1s',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: 12, cursor: 'grab' }}>⠿</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tabLabels[id] || id}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{i + 1}</span>
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

// ─── Section: Security ────────────────────────────────────────────────────────
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
    if (window.confirm('Final confirmation — this action is irreversible. All data will be destroyed.')) {
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
          App Access Code {hasCode && <span style={{ fontSize: 11, color: '#4caf7d', marginLeft: 6, fontWeight: 400 }}>● Active</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
          {hasCode
            ? 'The app is password-protected on every open. Face ID / Touch ID is offered if your device supports it.'
            : 'Set a password to lock Arete on every open. Face ID / Touch ID will be offered automatically on supported devices.'}
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

  // Load settings from localStorage — source of truth
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
      case 'units':         return wrap(<UnitsSection         settings={settings} onSave={handleSave} />);
      case 'progress':      return wrap(<ProgressSection      settings={settings} onSave={handleSave} />);
      case 'notifications': return wrap(<NotificationsSection settings={settings} onSave={handleSave} />);
      case 'integrations':  return wrap(<IntegrationsSection  settings={settings} onSave={handleSave} />);
      case 'api_usage':     return wrap(<ApiUsageSection      settings={settings} />);
      case 'platforms':     return wrap(<PlatformsSection     settings={settings} onSave={handleSave} />);
      case 'data':          return wrap(<DataSection />);
      case 'sidebar':       return wrap(<SidebarSection      settings={settings} onSave={handleSave} />);
      case 'security':      return wrap(<SecuritySection      settings={settings} onSave={handleSave} />);
      case 'account':       return wrap(<AccountSection />);
      default:              return null;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* ── Left nav ──────────────────────────────────────────────────────── */}
      <nav style={{
        width: 188, flexShrink: 0,
        borderRight: '0.5px solid var(--sidebar-divider)',
        overflowY: 'auto', padding: '16px 0',
        display: 'flex', flexDirection: 'column',
      }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            style={{
              width: '100%', padding: '8px 16px', minHeight: 36, whiteSpace: 'nowrap', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10,
              background: activeSection === sec.id ? 'var(--active-bg)' : 'none',
              border: 'none',
              borderLeft: `2px solid ${activeSection === sec.id ? 'var(--accent)' : 'transparent'}`,
              color: activeSection === sec.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
              fontWeight: activeSection === sec.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <LineIcon name={sec.icon} size={16} />
            {sec.label}
          </button>
        ))}

        {/*  Version label  */}
        <div style={{
          marginTop: 'auto', padding: '16px 16px 8px',
          fontSize: 11, color: 'var(--text-muted)',
          letterSpacing: '0.08em', fontFamily: 'ui-monospace, monospace',
          opacity: 0.5,
        }}>
          Arete v{__APP_VERSION__}
        </div>
      </nav>

      {/* ── Right content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
        {/* Forms read best at a set width rather than stretched across the window. */}
        <div style={{ maxWidth: 760 }}>{renderSection()}</div>
      </div>
    </div>
  );
}








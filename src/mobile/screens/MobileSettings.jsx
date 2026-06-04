// ─── MobileSettings.jsx — Settings tab for VALERIE iOS PWA ──────────────────
import { useState } from 'react';
import { applyTheme, THEMES } from '../../styles/themes.js';
import { storage, STORAGE_KEYS } from '../../utils/storage.js';

function MCard({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function Row({ icon, label, value, onClick, last = false, danger = false }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: last ? 'none' : '0.5px solid var(--card-border)',
      WebkitTapHighlightColor: 'transparent', textAlign: 'left',
    }}>
      <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 15, color: danger ? '#e05555' : 'var(--text-primary)' }}>
        {label}
      </span>
      {value && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{value}</span>}
      {!danger && (
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
          <path d="M1 1l5 5-5 5" stroke="var(--text-muted)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      padding: '20px 4px 8px' }}>
      {children}
    </div>
  );
}

export default function MobileSettings({ settings, onSettingsChange }) {
  const [showThemes, setShowThemes] = useState(false);
  const currentTheme = settings?.theme || 'obsidian';

  function selectTheme(key) {
    applyTheme(key);
    const updated = { ...(settings || {}), theme: key, accentColorHex: '' };
    storage.set(STORAGE_KEYS.SETTINGS, updated);
    onSettingsChange?.(updated);
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-solid');
    setShowThemes(false);
  }

  return (
    <div style={{ padding: '16px', paddingTop: 20 }}>

      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)',
        marginBottom: 20 }}>Settings</div>

      {/* ── Appearance ── */}
      <SectionHeader>Appearance</SectionHeader>
      <MCard>
        <Row icon="🎨" label="Theme"
          value={THEMES[currentTheme]?.name || 'Obsidian'}
          onClick={() => setShowThemes(!showThemes)} last />
      </MCard>

      {showThemes && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {Object.values(THEMES).map(t => {
            const active = currentTheme === t.key;
            return (
              <button key={t.key} onClick={() => selectTheme(t.key)} style={{
                background: t.preview.bg, borderRadius: 12, padding: '14px 16px',
                border: active ? `2px solid ${t.preview.accent}` : '0.5px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%',
                  background: t.preview.accent, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  {t.description}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Security ── */}
      <SectionHeader>Security</SectionHeader>
      <MCard>
        <Row icon="🔑" label="API Keys" />
        <Row icon="🔒" label="Biometric Lock" />
        <Row icon="🛡️" label="Data Privacy" last />
      </MCard>

      {/* ── Integrations ── */}
      <SectionHeader>Integrations</SectionHeader>
      <MCard>
        <Row icon="🔥" label="Firebase" value="Connected" />
        <Row icon="🎵" label="Spotify" />
        <Row icon="📱" label="Twilio / SMS" />
        <Row icon="🤖" label="AI Models" last />
      </MCard>

      {/* ── Danger ── */}
      <SectionHeader>Account</SectionHeader>
      <MCard>
        <Row icon="🚪" label="Sign Out" last danger />
      </MCard>

      <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>VALERIE</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, marginTop: 4 }}>
          Personal AI · All data synced via Firebase
        </div>
      </div>

    </div>
  );
}

//  MobileSettings.jsx  Full settings for VALERIE iOS PWA 
// Drill-down: category list  section (real desktop components, mobile shell)

import { useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '../../utils/storage.js';
import { Icon } from '../../components/icons.jsx';
import {
  IdentitySection,
  AppearanceSection,
  UnitsSection,
  NotificationsSection,
  ProgressSection,
  IntegrationsSection,
  DataSection,
  SecuritySection,
  AccountSection,
} from '../../tabs/Settings.jsx';

//  Primitives 
function MCard({ children }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function MRow({ icon, label, value, onClick, last = false, danger = false }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: last ? 'none' : '0.5px solid var(--card-border)',
      WebkitTapHighlightColor: 'transparent', textAlign: 'left',
    }}
    onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
    onTouchEnd={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0, color: danger ? '#e05555' : 'var(--text-secondary)' }}><Icon name={icon} size={20} /></span>
      <span style={{ flex: 1, fontSize: 15, color: danger ? '#e05555' : 'var(--text-primary)' }}>
        {label}
      </span>
      {value && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>{value}</span>}
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
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      padding: '20px 4px 8px',
    }}>
      {children}
    </div>
  );
}

//  Section list 
const SECTIONS = [
  { group: 'Personalisation', id: 'identity',      icon: 'user',     label: 'Profile'          },
  { group: 'Personalisation', id: 'appearance',    icon: 'theme',    label: 'Appearance'       },
  { group: 'Personalisation', id: 'units',         icon: 'globe',    label: 'Units & Currency' },
  { group: 'Features',        id: 'notifications', icon: 'bell',     label: 'Notifications'    },
  { group: 'Features',        id: 'progress',      icon: 'progress', label: 'Progress & Rank'  },
  { group: 'Connections',     id: 'integrations',  icon: 'plug',     label: 'Integrations'     },
  { group: 'Data',            id: 'data',          icon: 'database', label: 'Data'             },
  { group: 'Data',            id: 'security',      icon: 'lock',     label: 'Security'         },
  { group: 'Data',            id: 'account',       icon: 'cloud',   label: 'Account & Sync'   },
];

const GROUPS = [...new Set(SECTIONS.map(s => s.group))];

//  Section renderer 
function SectionContent({ id, settings, onSave }) {
  switch (id) {
    case 'identity':      return <IdentitySection      settings={settings} onSave={onSave} />;
    case 'appearance':    return <AppearanceSection    settings={settings} onSave={onSave} />;
    case 'units':         return <UnitsSection         settings={settings} onSave={onSave} />;
    case 'notifications': return <NotificationsSection settings={settings} onSave={onSave} />;
    case 'progress':      return <ProgressSection      settings={settings} onSave={onSave} />;
    case 'integrations':  return <IntegrationsSection  settings={settings} onSave={onSave} />;
    case 'data':          return <DataSection />;
    case 'security':      return <SecuritySection settings={settings} onSave={onSave} />;
    case 'account':       return <AccountSection />;
    default:              return null;
  }
}

//  Main 
export default function MobileSettings({ settings, onSettingsChange }) {
  const [activeSection, setActiveSection] = useState(null);

  const handleSave = useCallback((updates) => {
    const merged = { ...(settings || {}), ...updates };
    storage.set(STORAGE_KEYS.SETTINGS, merged);
    onSettingsChange?.(merged);
  }, [settings, onSettingsChange]);

  //  Section drill-down view 
  if (activeSection) {
    const sec = SECTIONS.find(s => s.id === activeSection);
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 18px 14px',
          borderBottom: '0.5px solid var(--card-border)',
          flexShrink: 0,
        }}>
          <button onClick={() => setActiveSection(null)} style={{
            background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
            borderRadius: 10, padding: '6px 14px', cursor: 'pointer',
            color: 'var(--accent)', fontSize: 13, fontWeight: 500,
            WebkitTapHighlightColor: 'transparent',
          }}> Back</button>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            {sec?.icon} {sec?.label}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' }}>
          <SectionContent id={activeSection} settings={settings} onSave={handleSave} />
        </div>
      </div>
    );
  }

  //  Category list view 
  return (
    <div style={{ padding: '16px', paddingTop: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 20 }}>
        Settings
      </div>

      {GROUPS.map(group => {
        const items = SECTIONS.filter(s => s.group === group);
        return (
          <div key={group}>
            <SectionHeader>{group}</SectionHeader>
            <MCard>
              {items.map((sec, i) => (
                <MRow
                  key={sec.id}
                  icon={sec.icon}
                  label={sec.label}
                  last={i === items.length - 1}
                  onClick={() => setActiveSection(sec.id)}
                />
              ))}
            </MCard>
          </div>
        );
      })}

      <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5,
          fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
          Arete v{__APP_VERSION__}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

// ─── Icons (inline SVG — no external dep needed for now) ──────────────────────
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  dashboard:  "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  assistant:  "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  tasks:      "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  calendar:   "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  notes:      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  health:     "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  finance:    "M12 2v20 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  progress:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  style:      "M20.38 8.57l-1.23 1.85a8 8 0 01-.22 7.58H5.07A8 8 0 0115.58 6.85l1.85-1.23A10 10 0 0121 12 M10.88 21.94A10 10 0 112.06 9.11",
  essentials: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  lists:      "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  focus:      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  vault:      "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings:   "M12 20a8 8 0 100-16 8 8 0 000 16z M12 14a2 2 0 100-4 2 2 0 000 4z",
};

// ─── Tab definitions in the locked order ──────────────────────────────────────
const GROUP_1 = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'tasks',     label: 'Tasks' },
  { id: 'calendar',  label: 'Calendar' },
  { id: 'notes',     label: 'Notes' },
];
const GROUP_2 = [
  { id: 'health',   label: 'Health' },
  { id: 'finance',  label: 'Finance' },
  { id: 'progress', label: 'Progress' },
];
const GROUP_3 = [
  { id: 'style',      label: 'Style' },
  { id: 'essentials', label: 'Essentials' },
  { id: 'lists',      label: 'Lists' },
  { id: 'focus',      label: 'Focus' },
];
const BOTTOM = [
  { id: 'vault',    label: 'Vault' },
  { id: 'settings', label: 'Settings' },
];

// ─── Single tab button ────────────────────────────────────────────────────────
function TabButton({ tab, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative group">
      <button
        onClick={() => onClick(tab.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          background: active ? 'var(--active-bg)' : hovered ? 'var(--hover-bg)' : 'transparent',
          color: active ? 'var(--accent)' : hovered ? 'var(--accent)' : 'var(--text-secondary)',
          opacity: active ? 1 : hovered ? 0.9 : 0.65,
        }}
        aria-label={tab.label}
      >
        <Icon d={ICONS[tab.id]} size={18} />
      </button>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: 48,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--bg-panel)',
          border: '0.5px solid var(--card-border)',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 12,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {tab.label}
        </div>
      )}
    </div>
  );
}

// ─── Group of tabs with a subtle divider ─────────────────────────────────────
function TabGroup({ tabs, activeTab, onTabClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
      {tabs.map(tab => (
        <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={onTabClick} />
      ))}
    </div>
  );
}

// ─── Status dot ──────────────────────────────────────────────────────────────
function StatusDot({ online }) {
  return (
    <div style={{
      width: 8, height: 8,
      borderRadius: '50%',
      background: online ? '#4caf7d' : '#888',
      boxShadow: online ? '0 0 6px rgba(76, 175, 125, 0.6)' : 'none',
      transition: 'all 0.4s ease',
    }} title={online ? 'Online' : 'Offline'} />
  );
}

// ─── Sidebar divider ─────────────────────────────────────────────────────────
function Divider() {
  return (
    <div style={{
      width: 28,
      height: '0.5px',
      background: 'var(--sidebar-divider)',
      margin: '2px auto',
    }} />
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ activeTab, onTabClick }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <aside style={{
      width: 56,
      minWidth: 56,
      height: '100%',
      background: 'var(--bg-sidebar)',
      borderRight: '0.5px solid var(--sidebar-divider)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 16,
      gap: 0,
      flexShrink: 0,
    }}>

      {/* VALERIE logo mark — V initial */}
      <div style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        color: 'var(--accent)',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '0.05em',
        opacity: 0.9,
      }}>
        V
      </div>

      {/* Scrollable tab area */}
      <div style={{ flex: 1, overflowY: 'auto', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        <TabGroup tabs={GROUP_1} activeTab={activeTab} onTabClick={onTabClick} />
        <Divider />
        <TabGroup tabs={GROUP_2} activeTab={activeTab} onTabClick={onTabClick} />
        <Divider />
        <TabGroup tabs={GROUP_3} activeTab={activeTab} onTabClick={onTabClick} />
      </div>

      {/* Bottom pinned section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Divider />
        {BOTTOM.map(tab => (
          <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={onTabClick} />
        ))}
        {/* Online / offline status dot */}
        <div style={{ marginTop: 8, marginBottom: 2 }}>
          <StatusDot online={online} />
        </div>
      </div>
    </aside>
  );
}

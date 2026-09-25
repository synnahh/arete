import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { supabase, getUserId, getUserIdSync } from '../supabase/supabase.js';
import { getAttentionTabs, FOCUS_ALWAYS_VISIBLE } from '../utils/attention.js';

//  Icons (inline SVG  no external dep needed for now) 
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  dashboard:  "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  // 3D extruded V  front face + back face offset + three connector lines
  assistant:  "M4 5L12 19L20 5 M6 3L14 17L22 3 M4 5L6 3 M20 5L22 3 M12 19L14 17",
  tasks:      "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  calendar:   "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  notes:      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  health:     "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  workout:    "M6.5 6.5h11v11h-11z M2 12h4 M18 12h4 M12 2v4 M12 18v4",
  finance:    "M12 2v20 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  portfolio:  "M18 20V10 M12 20V4 M6 20v-6",
  progress:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  style:      "M20.84 7l-3-4H6.16L3 7l3.5 2V20h11V9L20.84 7zM9 4c0 1.65 1.35 3 3 3s3-1.35 3-3",
  essentials: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  lists:      "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  focus:      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  vault:      "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings:   "M12 20a8 8 0 100-16 8 8 0 000 16z M12 14a2 2 0 100-4 2 2 0 000 4z",
  routines:   "M4 4h16v2H4z M4 8h10v2H4z M4 12h16v2H4z M4 16h10v2H4z M17 15l4 4-4 4",
  mind:       "M9.5 2a2.5 2.5 0 015 0v.5A7.5 7.5 0 0117 9.5v1.5h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v.5a3.5 3.5 0 01-3.5 3.5h-3A3.5 3.5 0 017 16.5V16H6a1 1 0 01-1-1v-3a1 1 0 011-1h1V9.5A7.5 7.5 0 019.5 2.5V2z",
  places:     "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  // Sharp 'chad' face — chiselled jaw silhouette + brow ticks
  lm:         "M7 4L17 4L18 10.5L14.5 19L12 21L9.5 19L6 10.5Z M8.8 9H10.6 M13.4 9H15.2",
};

//  All reorderable tabs in default order 
export const ALL_TABS = [
  { id: 'dashboard',  label: 'Dashboard',  desc: 'Your daily command centre'           },
  { id: 'assistant',  label: 'Assistant',  desc: 'Chat with VALERIE'                   },
  { id: 'tasks',      label: 'Tasks',      desc: 'To-dos, priorities & projects'       },
  { id: 'calendar',   label: 'Calendar',   desc: 'Schedule & upcoming events'          },
  { id: 'notes',      label: 'Notes',      desc: 'Markdown notes & quick capture'      },
  { id: 'health',     label: 'Health',     desc: 'Sleep · Nutrition · Water · Body'    },
  { id: 'workout',    label: 'Workout',    desc: 'Overload coach · Splits · Exercises' },
  { id: 'finance',    label: 'Finance',    desc: 'Budget · Transactions · Goals'       },
  { id: 'portfolio',  label: 'Portfolio',  desc: 'Stocks · Holdings · AI Advisor'      },
  { id: 'progress',   label: 'Progress',   desc: 'XP · Rank · Streaks · Goals'        },
  { id: 'style',      label: 'Style',      desc: 'Wardrobe & outfit planning'          },
  { id: 'essentials', label: 'Essentials', desc: 'Subscriptions & recurring items'     },
  { id: 'lists',      label: 'Lists',      desc: 'Shopping, reading & custom lists'    },
  { id: 'focus',      label: 'Focus',      desc: 'Pomodoro & deep work sessions'       },
  { id: 'routines',   label: 'Routines',   desc: 'Morning, evening & custom routines'  },
  { id: 'mind',       label: 'Mind',       desc: 'Constitution · Advisors · Vault'     },
  { id: 'places',    label: 'Places',     desc: 'Alone time · destinations · explore'  },
  { id: 'lm',         label: 'LM',         desc: 'Looksmaxxing'                         },
];

// Always pinned at bottom, not reorderable
const BOTTOM = [
  { id: 'vault',    label: 'Vault',    desc: 'Private encrypted storage'    },
  { id: 'settings', label: 'Settings', desc: 'App preferences & integrations' },
];

//  Single tab button 
function TabButton({ tab, active, onClick }) {
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  const handleEnter = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: r.top + r.height / 2, left: r.right + 10 });
    }
  }, []);

  const handleLeave = useCallback(() => setTooltipPos(null), []);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => onClick(tab.id)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
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
          background: active ? 'var(--active-bg)' : tooltipPos ? 'var(--hover-bg)' : 'transparent',
          color: active ? 'var(--accent)' : tooltipPos ? 'var(--accent)' : 'var(--text-secondary)',
          opacity: active ? 1 : tooltipPos ? 0.9 : 0.65,
        }}
        aria-label={tab.label}
      >
        <Icon d={ICONS[tab.id]} size={18} />
      </button>

      {/* Tooltip rendered via portal  escapes sidebar overflow */}
      {tooltipPos && createPortal(
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            position: 'fixed',
            left: tooltipPos.left,
            top: tooltipPos.top,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            animation: 'tooltipIn 0.12s ease',
          }}
        >
          {/* Arrow */}
          <div style={{
            width: 0, height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: '6px solid var(--card-border)',
            flexShrink: 0,
            marginRight: -1,
          }} />
          {/* Label card */}
          <div style={{
            background: 'var(--bg-panel)',
            border: '0.5px solid var(--card-border)',
            borderLeft: '2px solid var(--accent)',
            borderRadius: '0 8px 8px 0',
            padding: '7px 14px 7px 12px',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1 }}>
              {tab.label}
            </div>
            {tab.desc && (
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.01em' }}>
                {tab.desc}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

//  Group of tabs with a subtle divider 
function TabGroup({ tabs, activeTab, onTabClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
      {tabs.map(tab => (
        <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={onTabClick} />
      ))}
    </div>
  );
}

//  Connection status indicator 
function StatusIndicator({ claudeOnline, ollamaOnline, internetOnline, lastPinged, firebaseSynced }) {
  const [expanded, setExpanded] = useState(false);

  // Overall dot colour: green = all good | amber = partial | red = offline
  const overall = claudeOnline ? '#4caf7d' : ollamaOnline ? '#f4a642' : '#e55a5a';
  const overallGlow = claudeOnline
    ? 'rgba(76,175,125,0.55)'
    : ollamaOnline
    ? 'rgba(244,166,66,0.5)'
    : 'rgba(229,90,90,0.45)';

  const Row = ({ label, online, detail }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: online ? '#4caf7d' : '#666',
        boxShadow: online ? '0 0 4px rgba(76,175,125,0.6)' : 'none',
      }} />
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 46 }}>{label}</span>
      <span style={{
        fontSize: 9.5, color: online ? 'var(--text-secondary)' : 'var(--text-muted)',
        opacity: 0.75,
      }}>
        {detail ?? (online ? 'online' : 'offline')}
      </span>
    </div>
  );

  const pingAgo = lastPinged
    ? (() => {
        const s = Math.round((Date.now() - lastPinged.getTime()) / 1000);
        if (s < 10) return 'just now';
        if (s < 60) return `${s}s ago`;
        return `${Math.round(s/60)}m ago`;
      })()
    : '';

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger dot */}
      <button
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: overall,
          boxShadow: `0 0 6px ${overallGlow}`,
          transition: 'all 0.4s ease',
        }} />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div style={{
          position: 'absolute',
          bottom: 18,
          left: 16,
          background: 'var(--bg-panel)',
          border: '0.5px solid var(--card-border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          zIndex: 200,
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          minWidth: 168,
        }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>
            CONNECTION STATUS
          </span>
          <Row label="Internet"  online={internetOnline} />
          <Row label="Claude"    online={claudeOnline}   detail={claudeOnline ? 'API ready' : 'unavailable'} />
          <Row label="Ollama"    online={ollamaOnline}   detail={ollamaOnline ? 'llama3 local' : 'not running'} />
          <Row label="Firebase"  online={firebaseSynced ?? false} detail={firebaseSynced ? 'synced' : internetOnline ? 'connecting…' : 'offline'} />
          <div style={{ height: '0.5px', background: 'var(--sidebar-divider)', margin: '2px 0' }} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            Last checked: {pingAgo}
          </span>
        </div>
      )}
    </div>
  );
}

// Category → label mapping (drives grouping regardless of reorder)
const TAB_CATEGORY = {
  dashboard:  'CORE',
  assistant:  'CORE',
  tasks:      'PLAN',
  calendar:   'PLAN',
  notes:      'PLAN',
  health:     'BODY',
  workout:    'BODY',
  lm:         'BODY',
  finance:    'MONEY',
  portfolio:  'MONEY',
  progress:   'GROWTH',
  focus:      'GROWTH',
  routines:   'GROWTH',
  mind:       'GROWTH',
  style:      'LIFE',
  essentials: 'LIFE',
  lists:      'LIFE',
  places:     'LIFE',
};

//  Category divider with label
function CategoryLabel({ label, first }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: first ? '2px 0 2px' : '8px 0 2px',
    }}>
      {!first && <div style={{ width: 24, height: '0.5px', background: 'var(--sidebar-divider)' }} />}
      <span style={{
        fontSize: 6.5,
        letterSpacing: '0.10em',
        color: 'var(--text-muted)',
        opacity: 0.5,
        fontWeight: 600,
        userSelect: 'none',
      }}>{label}</span>
    </div>
  );
}

//  Focus Mode toggle  filters the sidebar down to tabs with items due today/tomorrow
function FocusModeButton({ mode, onCycle, count }) {
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  const handleEnter = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: r.top + r.height / 2, left: r.right + 10 });
    }
  }, []);
  const handleLeave = useCallback(() => setTooltipPos(null), []);

  const active = mode !== 'off';
  const accent = mode === 'tomorrow' ? '#a78bfa' : '#f4a642';
  const label = mode === 'tomorrow' ? 'Focus Mode · Tomorrow' : mode === 'today' ? 'Focus Mode · Today' : 'Focus Mode';
  const desc = active
    ? `${count} item${count === 1 ? '' : 's'} need attention  other tabs hidden. Click for ${mode === 'today' ? 'tomorrow' : 'off'}.`
    : 'Click to hide tabs with nothing due today.';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={onCycle}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        aria-label={label}
        style={{
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          background: active ? 'var(--active-bg)' : tooltipPos ? 'var(--hover-bg)' : 'transparent',
          color: active ? accent : tooltipPos ? 'var(--accent)' : 'var(--text-secondary)',
          opacity: active ? 1 : tooltipPos ? 0.9 : 0.65,
        }}
      >
        <Icon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16a4 4 0 100-8 4 4 0 000 8z" size={18} />
        {active && (
          <span style={{
            position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%',
            background: accent, boxShadow: `0 0 4px ${accent}`,
          }} />
        )}
      </button>

      {tooltipPos && createPortal(
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            position: 'fixed', left: tooltipPos.left, top: tooltipPos.top, transform: 'translateY(-50%)',
            pointerEvents: 'none', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 0,
            animation: 'tooltipIn 0.12s ease',
          }}
        >
          <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid var(--card-border)', flexShrink: 0, marginRight: -1 }} />
          <div style={{
            background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', borderLeft: `2px solid ${active ? accent : 'var(--accent)'}`,
            borderRadius: '0 8px 8px 0', padding: '7px 14px 7px 12px', whiteSpace: 'nowrap', backdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1 }}>{label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.01em', maxWidth: 200, whiteSpace: 'normal' }}>{desc}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

//  Main Sidebar
//  Peak State dot indicator
function PeakStateDot({ peakState }) {
  const [expanded, setExpanded] = useState(false);
  if (!peakState) return null;
  const { score, color, suggestion, factors } = peakState;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title={`Peak State: ${score}/100`}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 7px ${color}99`,
          transition: 'all 0.3s ease',
          transform: expanded ? 'scale(1.3)' : 'scale(1)',
        }} />
      </button>

      {expanded && (
        <div style={{
          position: 'absolute', left: 28, bottom: 0,
          background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
          borderRadius: 12, padding: '14px 16px', width: 240, zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {/* Score header */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/100 Peak State</span>
          </div>

          {/* Factor rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
            {Object.values(factors).map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</div>
                <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ width: `${f.pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.pts}/{f.max}</div>
              </div>
            ))}
          </div>

          {/* Suggestion */}
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '0.5px solid var(--sidebar-divider)', paddingTop: 8 }}>
            {suggestion}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ activeTab, onTabClick, claudeOnline, ollamaOnline, internetOnline, lastPinged, firebaseSynced, hiddenTabs = [], peakState }) {

  // Load platform-specific tab order from storage
  const [orderedTabs, setOrderedTabs] = useState(() => {
    const saved = storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null);
    if (saved?.length) {
      // Merge saved order with ALL_TABS  include any new tabs at end
      const known = new Set(saved);
      const extra = ALL_TABS.filter(t => !known.has(t.id));
      return [...saved.map(id => ALL_TABS.find(t => t.id === id)).filter(Boolean), ...extra];
    }
    return ALL_TABS;
  });

  // Sync when storage changes (Settings tab reorders  same device)
  useEffect(() => {
    const handler = () => {
      const saved = storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null);
      if (saved?.length) {
        const known = new Set(saved);
        const extra = ALL_TABS.filter(t => !known.has(t.id));
        setOrderedTabs([...saved.map(id => ALL_TABS.find(t => t.id === id)).filter(Boolean), ...extra]);
      }
    };
    window.addEventListener('valerie:sidebar-order-changed', handler);
    return () => window.removeEventListener('valerie:sidebar-order-changed', handler);
  }, []);

  // Sync sidebar order from Supabase (cross-device)
  useEffect(() => {
    let channel;
    let alive = true;
    getUserId().then(userId => {
      if (!alive) return; // cleaned up before getUserId resolved (StrictMode race)
      const applyOrder = (saved) => {
        if (!saved?.length) return;
        storage.set(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, saved);
        const known = new Set(saved);
        const extra = ALL_TABS.filter(t => !known.has(t.id));
        setOrderedTabs([...saved.map(id => ALL_TABS.find(t => t.id === id)).filter(Boolean), ...extra]);
      };

      supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', 'sidebar_order_desktop').maybeSingle()
        .then(({ data }) => { if (data?.value?.order) applyOrder(data.value.order); });

      channel = supabase.channel(`sidebar:${userId}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_meta', filter: `user_id=eq.${userId}` },
          async () => {
            const { data } = await supabase.from('user_meta').select('value').eq('user_id', userId).eq('key', 'sidebar_order_desktop').maybeSingle();
            if (data?.value?.order) applyOrder(data.value.order);
          })
        .subscribe();
    });
    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus Mode: cycles off  today  tomorrow  off, filtering the sidebar
  // down to only tabs with actionable items due (see src/utils/attention.js)
  const [focusMode, setFocusMode] = useState('off');
  const attention = useMemo(
    () => focusMode === 'off' ? null : getAttentionTabs(focusMode === 'tomorrow' ? 1 : 0),
    [focusMode]
  );
  const cycleFocus = useCallback(
    () => setFocusMode(m => m === 'off' ? 'today' : m === 'today' ? 'tomorrow' : 'off'),
    []
  );

  const visible = (tabs) => tabs.filter(t => {
    if (hiddenTabs.includes(t.id)) return false;
    if (attention && !FOCUS_ALWAYS_VISIBLE.has(t.id) && !attention.tabs.has(t.id)) return false;
    return true;
  });
  const visibleMain = visible(orderedTabs);

  // Group tabs by category (fixed category order, user order preserved within each)
  const CATEGORY_ORDER = ['CORE', 'PLAN', 'BODY', 'MONEY', 'GROWTH', 'LIFE', 'OTHER'];
  const withDividers = useMemo(() => {
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]));
    visibleMain.forEach(tab => {
      const cat = TAB_CATEGORY[tab.id] ?? 'OTHER';
      (groups[cat] ?? (groups['OTHER'] = groups['OTHER'] || [])).push(tab);
    });
    const result = [];
    let first = true;
    CATEGORY_ORDER.forEach(cat => {
      const tabs = groups[cat];
      if (!tabs?.length) return;
      result.push({ divider: true, key: `div-${cat}`, label: cat, first });
      first = false;
      tabs.forEach(tab => result.push(tab));
    });
    return result;
  }, [visibleMain]);

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

      {/* VALERIE logo mark */}
      <div style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <img
          src="/assets/valerie-logo.png"
          alt="VALERIE"
          style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.9 }}
        />
      </div>

      {/* Focus Mode toggle */}
      <div style={{ marginBottom: 10 }}>
        <FocusModeButton mode={focusMode} onCycle={cycleFocus} count={attention?.count ?? 0} />
      </div>

      {/* Scrollable tab area */}
      <div style={{ flex: 1, overflowY: 'auto', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0 4px' }}>
          {withDividers.map(item =>
            item.divider
              ? <CategoryLabel key={item.key} label={item.label} first={item.first} />
              : <TabButton key={item.id} tab={item} active={activeTab === item.id} onClick={onTabClick} />
          )}
        </div>
      </div>

      {/* Bottom pinned section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <CategoryLabel label="SYS" />
        {visible(BOTTOM).map(tab => (
          <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={onTabClick} />
        ))}
        {/* Settings is always visible  never hideable */}
        {hiddenTabs.includes('settings') && (
          <TabButton tab={{ id: 'settings', label: 'Settings' }} active={activeTab === 'settings'} onClick={onTabClick} />
        )}
        {/* Peak State dot */}
        <PeakStateDot peakState={peakState} />
        {/* Connection status indicator */}
        <div style={{ marginBottom: 2 }}>
          <StatusIndicator
            claudeOnline={claudeOnline ?? false}
            ollamaOnline={ollamaOnline ?? false}
            internetOnline={internetOnline ?? navigator.onLine}
            lastPinged={lastPinged}
            firebaseSynced={firebaseSynced ?? false}
          />
        </div>
      </div>
    </aside>
  );
}



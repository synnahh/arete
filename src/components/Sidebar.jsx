import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { supabase, getUserId, getUserIdSync } from '../supabase/supabase.js';
import { getAttentionTabs, FOCUS_ALWAYS_VISIBLE } from '../utils/attention.js';
import { ICON_PATHS } from './icons.jsx';
import { GROUPS, groupScreens, groupOf, ALL_SCREENS, SCREEN_LABELS } from '../nav/groups.js';

// ─── Icons: the shared set in components/icons.jsx ────────────────────────────
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = ICON_PATHS;

// ─── All reorderable tabs in default order ────────────────────────────────────
// Every screen, labelled by group (Settings uses this for hiding and ordering).
export const ALL_TABS = ALL_SCREENS.map(id => ({ id, label: `${groupOf(id).label} · ${SCREEN_LABELS[id] ?? id}` }));


// ─── Single tab button ────────────────────────────────────────────────────────
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
          color: active ? 'var(--tab-accent)' : tooltipPos ? 'var(--accent)' : 'var(--text-secondary)',
          opacity: active ? 1 : tooltipPos ? 0.9 : 0.65,
        }}
        aria-label={tab.label}
        aria-current={active ? 'page' : undefined}
      >
        <Icon d={ICONS[tab.id]} size={18} />
      </button>

      {/* Tooltip rendered via portal — escapes sidebar overflow */}
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

// ─── Connection status indicator ────────────────────────────────────────────
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
    : '—';

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

export default function Sidebar({ activeGroup, onGroupClick, claudeOnline, ollamaOnline, internetOnline, lastPinged, firebaseSynced, hiddenTabs = [], peakState }) {

  // Sync the saved screen order from Supabase (cross-device). The order now
  // decides section order inside each group; App reads it from storage.
  useEffect(() => {
    let channel;
    let alive = true;
    getUserId().then(userId => {
      if (!alive) return; // cleaned up before getUserId resolved (StrictMode race)
      const applyOrder = (saved) => {
        if (!saved?.length) return;
        storage.set(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, saved);
        window.dispatchEvent(new CustomEvent('valerie:sidebar-order-changed'));
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
  // down to only groups with actionable items due (see src/utils/attention.js)
  const [focusMode, setFocusMode] = useState('off');
  const attention = useMemo(
    () => focusMode === 'off' ? null : getAttentionTabs(focusMode === 'tomorrow' ? 1 : 0),
    [focusMode]
  );
  const cycleFocus = useCallback(
    () => setFocusMode(m => m === 'off' ? 'today' : m === 'today' ? 'tomorrow' : 'off'),
    []
  );

  // A group shows when it has a visible screen and, in Focus Mode, when one of
  // its screens needs attention (Settings always shows).
  const groupVisible = (g) => {
    const screens = groupScreens(g.id, { hidden: hiddenTabs });
    if (!screens.length) return false;
    if (g.id === 'settings' || !attention) return true;
    return screens.some(id => FOCUS_ALWAYS_VISIBLE.has(id) || attention.tabs.has(id));
  };
  const mainGroups   = GROUPS.filter(g => g.id !== 'settings' && groupVisible(g));
  const settingsTab  = GROUPS.find(g => g.id === 'settings');

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
          alt="Arete"
          style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.9 }}
        />
      </div>

      {/* Focus Mode toggle */}
      <div style={{ marginBottom: 10 }}>
        <FocusModeButton mode={focusMode} onCycle={cycleFocus} count={attention?.count ?? 0} />
      </div>

      {/* Groups */}
      <div style={{ flex: 1, overflowY: 'auto', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <TabGroup tabs={mainGroups} activeTab={activeGroup} onTabClick={onGroupClick} />
      </div>

      {/* Bottom pinned section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <CategoryLabel label="SYS" />
        <TabButton tab={settingsTab} active={activeGroup === 'settings'} onClick={onGroupClick} />
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

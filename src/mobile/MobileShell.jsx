//  MobileShell.jsx  iOS PWA shell with bottom tab navigation 
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAI }              from '../ai/useAI.js';
import { usePeakState }       from '../hooks/usePeakState.js';
import { useNotifications }   from '../hooks/useNotifications.js';
import { requestPushPermission, pushPermissionStatus, registerFCMToken } from '../utils/pushNotifications.js';
import { isInstalledPWA }     from '../utils/platform.js';
import MobileDashboard  from './screens/MobileDashboard.jsx';
import MobileHealth     from './screens/MobileHealth.jsx';
import MobileMore       from './screens/MobileMore.jsx';
import MobileFinance    from './screens/MobileFinance.jsx';
import MobileSettings   from './screens/MobileSettings.jsx';
import MobileAI         from './screens/MobileAI.jsx';
import MobileMind       from './screens/MobileMind.jsx';
import MobilePortfolio  from './screens/MobilePortfolio.jsx';
import { haptics }     from './utils/haptics.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';

//  Tab definitions 
const TABS = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'health',
    label: 'Health',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 21C12 21 3 14.5 3 8.5a4.5 4.5 0 018.598-1.873A4.5 4.5 0 0121 8.5C21 14.5 12 21 12 21z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
      </svg>
    ),
  },
  {
    id: 'more',
    label: 'More',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4"    y="4"    width="6.5" height="6.5" rx="2"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
        <rect x="13.5" y="4"    width="6.5" height="6.5" rx="2"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
        <rect x="4"    y="13.5" width="6.5" height="6.5" rx="2"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
      </svg>
    ),
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="3"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.1 : 0} />
        <path d="M2 10h20" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
        <path d="M6 15h3M15 15h3" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'mind',
    label: 'Mind',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M9.5 2a2.5 2.5 0 015 0v.5A7.5 7.5 0 0117 9.5v1a5 5 0 01-10 0v-1A7.5 7.5 0 019.5 2.5V2z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
        <path d="M12 16v6M9 22h6" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polyline points="4 18 8 12 12 15 16 8 20 11"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.1 : 0} />
        <line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={active ? 2 : 1.5}
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.3 : 0} />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      </svg>
    ),
  },
];

//  Floating VALERIE orb button 
function VALERIEOrb({ onClick, orbState }) {
  const color = orbState === 'listening' ? '#4a9eff'
              : orbState === 'thinking'  ? '#f59e0b'
              : orbState === 'speaking'  ? 'var(--accent)'
              : 'var(--accent)';
  const pulse = orbState === 'listening' || orbState === 'speaking';
  const stateLabel = orbState === 'listening' ? 'Listening...'
                   : orbState === 'thinking'  ? 'Thinking...'
                   : orbState === 'speaking'  ? 'Speaking...'
                   : null;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(82px + env(safe-area-inset-bottom))',
        width: 50, height: 50,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${color}55, ${color}20)`,
        border: `1px solid ${color}60`,
        boxShadow: `0 4px 24px ${color}35, 0 2px 8px rgba(0,0,0,0.5)`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.12s ease',
      }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.90)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {pulse && (
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          background: color, opacity: 0.12,
          animation: 'orbPulse 1.6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, opacity: 0.9 }} />
      {/* State label pill */}
      {stateLabel && (
        <div style={{
          position: 'absolute', right: 54, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--bg-sidebar)', border: '0.5px solid var(--card-border)',
          borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
          fontSize: 11, color, fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>{stateLabel}</div>
      )}
    </button>
  );
}

//  VALERIE slide-up chat sheet 
function VALERIESheet({ open, onClose, ai, settings }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 290,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0,
        bottom: open ? 0 : '-88vh',
        height: '88vh',
        zIndex: 300,
        background: 'var(--bg-sidebar)',
        borderTop: '0.5px solid var(--card-border)',
        borderRadius: '20px 20px 0 0',
        transition: 'bottom 0.35s cubic-bezier(0.32,0.72,0,1)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Drag handle + close */}
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--card-border)' }} />
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)' }}>VALERIE</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {ai?.claudeOnline ? 'Claude online' : 'Offline mode'}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
              borderRadius: '50%', width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              color: 'var(--text-muted)', fontSize: 16,
            }}></button>
          </div>
        </div>

        {/* AI screen content (no header since we have one above) */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MobileAI settings={settings} ai={ai} compact />
        </div>
      </div>
    </>
  );
}

//  Pull-to-refresh 
function usePullToRefresh(scrollRef, onRefresh) {
  const startY   = useRef(null);
  const pulling  = useRef(false);
  const [pullPct, setPullPct] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const THRESHOLD = 72;

  const onTouchStart = useCallback(e => {
    if (scrollRef.current?.scrollTop === 0) startY.current = e.touches[0].clientY;
  }, [scrollRef]);

  const onTouchMove = useCallback(e => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      pulling.current = true;
      setPullPct(Math.min(1, dy / THRESHOLD));
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (pulling.current && pullPct >= 1) {
      haptics.success();
      setRefreshing(true);
      setPullPct(0);
      await onRefresh?.();
      setTimeout(() => setRefreshing(false), 800);
    } else {
      setPullPct(0);
    }
    startY.current = null;
    pulling.current = false;
  }, [pullPct, onRefresh]);

  return { pullPct, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}

//  Shell 
export default function MobileShell({ settings, onSettingsChange }) {
  const [activeTab, setActiveTab]   = useState('dashboard');
  const [valOpen,   setValOpen]     = useState(false);
  const scrollRef = useRef(null);
  const ai        = useAI();
  const peakState = usePeakState(settings);

  // Notification scheduler  drives SMS + push on mobile
  useNotifications(settings);

  // Request push permission once on first installed PWA launch
  useEffect(() => {
    if (!isInstalledPWA()) return;
    const alreadyAsked = localStorage.getItem('valerie_push_asked');
    if (alreadyAsked) {
      // Permission already granted  refresh the FCM token silently
      if (pushPermissionStatus() === 'granted') registerFCMToken();
      return;
    }
    // Delay so the user has settled into the app before the prompt appears
    const t = setTimeout(async () => {
      localStorage.setItem('valerie_push_asked', '1');
      await requestPushPermission();
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { ai.setActiveTab?.(activeTab); }, [activeTab]);

  function switchTab(id) { haptics.tap(); setActiveTab(id); }

  const { pullPct, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(scrollRef, () => new Promise(r => setTimeout(r, 600)));

  const screenProps = { settings, onSettingsChange, ai, peakState, onTabChange: switchTab };

  const screens = {
    dashboard: <MobileDashboard {...screenProps} />,
    health:    <MobileHealth    {...screenProps} />,
    more:      <MobileMore      {...screenProps} />,
    finance:   <MobileFinance   {...screenProps} />,
    mind:      <MobileMind      {...screenProps} />,
    portfolio: <MobilePortfolio {...screenProps} />,
    settings:  <MobileSettings  {...screenProps} />,
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <style>{`
        @keyframes orbPulse {
          0%, 100% { transform: scale(1);   opacity: 0.15; }
          50%       { transform: scale(1.4); opacity: 0.05; }
        }
        @keyframes mSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/*  Screen content with pull-to-refresh  */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden',
          paddingBottom: 'calc(140px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull indicator */}
        <div style={{
          height: pullPct > 0 ? `${pullPct * 48}px` : refreshing ? '48px' : '0px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', transition: pullPct > 0 ? 'none' : 'height 0.3s ease',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2px solid var(--card-border)',
            borderTopColor: 'var(--accent)',
            animation: refreshing ? 'mSpin 0.7s linear infinite' : 'none',
            transform: refreshing ? 'none' : `rotate(${pullPct * 270}deg)`,
            opacity: Math.max(0.3, pullPct),
            transition: refreshing ? 'none' : 'opacity 0.15s',
          }} />
        </div>
        {screens[activeTab]}
      </div>

      {/*  Floating VALERIE orb  */}
      <VALERIEOrb onClick={() => setValOpen(true)} orbState={ai?.orbState || 'idle'} />

      {/*  VALERIE slide-up sheet  */}
      <VALERIESheet open={valOpen} onClose={() => setValOpen(false)} ai={ai} settings={settings} />

      {/*  Bottom tab bar  */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'calc(72px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--bg-sidebar)',
        borderTop: '0.5px solid var(--card-border)',
        display: 'flex', alignItems: 'stretch',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 100,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'color 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                minHeight: 72,
              }}
            >
              {tab.icon(active)}
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                letterSpacing: '0.02em',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

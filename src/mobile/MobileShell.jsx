// ─── MobileShell.jsx — iOS PWA shell with bottom tab navigation ───────────────
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAI }              from '../ai/useAI.js';
import { usePeakState }       from '../hooks/usePeakState.js';
import { useNotifications }   from '../hooks/useNotifications.js';
import { requestPushPermission, pushPermissionStatus, registerFCMToken } from '../utils/pushNotifications.js';
import { isInstalledPWA }     from '../utils/platform.js';
import MobileDashboard  from './screens/MobileDashboard.jsx';
import MobileHealth     from './screens/MobileHealth.jsx';
import { TasksScreen, PlaceholderScreen } from './screens/MobileMore.jsx';
import { TrainSessionScreen } from '../tabs/Workout.jsx';
import MobileLM         from './screens/MobileLM.jsx';
import GoalHQ           from '../tabs/GoalHQ.jsx';
import MobileFinance    from './screens/MobileFinance.jsx';
import MobileSettings   from './screens/MobileSettings.jsx';
import MobileAI         from './screens/MobileAI.jsx';
import MobileMind       from './screens/MobileMind.jsx';
import MobilePortfolio  from './screens/MobilePortfolio.jsx';
import MobileHabits     from './screens/MobileHabits.jsx';
import Toaster          from '../components/Toaster.jsx';
import ActionConfirm    from '../components/ActionConfirm.jsx';
import MobileStyle      from './screens/MobileStyle.jsx';
import { haptics }     from './utils/haptics.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import SectionBar      from '../components/SectionBar.jsx';
import { groupOf, groupScreens, resolveTarget, DEFAULT_SCREEN, SCREEN_LABELS } from '../nav/groups.js';
import { setActiveGroup, backgroundClass } from '../styles/appearance.js';
import { getTimeOfDay } from '../utils/time.js';

//  Bottom bar: Home · Plan · Coach (the orb) · Finance · Mind
// Settings opens from the gear in the section row. Screen ids are unchanged;
// see src/nav/groups.js.
const stroke = (active) => ({ stroke: 'currentColor', strokeWidth: active ? 2 : 1.5 });
const BAR = [
  {
    id: 'home',
    label: 'Home',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          {...stroke(active)} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
        <path d="M9 21V12h6v9" {...stroke(active)} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'plan',
    label: 'Plan',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5"
          {...stroke(active)} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
        <path d="M3.5 10h17M8 3v4M16 3v4" {...stroke(active)} strokeLinecap="round"/>
      </svg>
    ),
  },
  { id: 'coach', label: 'Coach', orb: true },
  {
    id: 'finance',
    label: 'Finance',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="3"
          {...stroke(active)} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.1 : 0} />
        <path d="M2 10h20" {...stroke(active)} />
        <path d="M6 15h3M15 15h3" {...stroke(active)} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'mind',
    label: 'Mind',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9.5 2a2.5 2.5 0 015 0v.5A7.5 7.5 0 0117 9.5v1a5 5 0 01-10 0v-1A7.5 7.5 0 019.5 2.5V2z"
          {...stroke(active)} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
        <path d="M12 16v6M9 22h6" {...stroke(active)} strokeLinecap="round" />
      </svg>
    ),
  },
];

//  Coach button: the VALERIE orb, centre of the bar
// Tap opens Coach; hold (450 ms) opens the VALERIE conversation sheet.
const HOLD_MS = 450;

// Orb shapes, matching Settings → Appearance → Orb shape
function orbShapeStyle(shape, color, active) {
  const fill = `radial-gradient(circle at 35% 30%, #ffffff 0%, ${color} 40%, var(--bg-base) 100%)`;
  const glow = `0 0 20px var(--orb-glow)${active ? ', 0 0 0 2px var(--tab-accent)' : ''}`;
  if (shape === 'ring') {
    return { borderRadius: '50%', boxSizing: 'border-box', border: `4px solid ${color}`, background: 'var(--bg-sidebar)', boxShadow: glow };
  }
  if (shape === 'diamond') {
    return { width: 42, height: 42, marginTop: -14, marginBottom: 6, transform: 'rotate(45deg)', borderRadius: 8, background: fill, boxShadow: glow };
  }
  if (shape === 'cube') {
    return { clipPath: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', background: fill, filter: 'drop-shadow(0 0 8px var(--orb-glow))' };
  }
  return { borderRadius: '50%', background: fill, boxShadow: glow };
}

function CoachOrb({ active, orbState, shape = 'sphere', onTap, onHold }) {
  const timer = useRef(null);
  const held  = useRef(false);
  const color = orbState === 'listening' ? '#4a9eff'
              : orbState === 'thinking'  ? '#f59e0b'
              : 'var(--accent)';
  const pulse = orbState === 'listening' || orbState === 'speaking';

  function down() {
    held.current = false;
    timer.current = setTimeout(() => { held.current = true; haptics.success(); onHold(); }, HOLD_MS);
  }
  function up() {
    clearTimeout(timer.current);
    if (!held.current) onTap();
  }
  function cancel() { clearTimeout(timer.current); }

  return (
    <button
      type="button"
      aria-label="Coach. Hold to talk to VALERIE"
      aria-current={active ? 'page' : undefined}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={cancel}
      onContextMenu={e => e.preventDefault()}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        gap: 4, background: 'none', border: 'none', cursor: 'pointer', paddingTop: 0,
        color: active ? 'var(--tab-accent)' : 'var(--text-muted)',
        WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none', userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      <span style={{ position: 'relative', width: 54, height: 54, marginTop: -20, ...orbShapeStyle(shape, color, active) }}>
        {pulse && (
          <span style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            background: color, opacity: 0.12,
            animation: 'orbPulse 1.6s ease-in-out infinite', pointerEvents: 'none',
          }} />
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: '0.02em' }}>Coach</span>
    </button>
  );
}

// ── VALERIE slide-up chat sheet ────────────────────────────────────────────────
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
            }}>×</button>
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

// ── Pull-to-refresh ────────────────────────────────────────────────────────────
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

//  Screens available on the phone, by screen id. Screens without a mobile
//  version yet keep the existing "available on desktop" placeholder.
const MOBILE_SCREENS = {
  dashboard: (p) => <MobileDashboard {...p} />,
  tasks:     ()  => <TasksScreen />,
  goal:      (p) => <GoalHQ {...p} compact overview={<MobileHealth {...p} tabs={['Overview']} title={null} />} />,
  workout:   ()  => <TrainSessionScreen compact />,
  fuel:      (p) => <MobileHealth {...p} tabs={['Nutrition', 'Water']} title={null} />,
  recover:   (p) => <MobileHealth {...p} tabs={['Sleep']} title={null} />,
  body:      (p) => <MobileHealth {...p} tabs={['Body']} title={null} />,
  habits:    ()  => <MobileHabits />,
  style:     (p) => <MobileStyle {...p} />,
  lm:        ()  => <MobileLM />,
  mind:      (p) => <MobileMind {...p} />,
  finance:   (p) => <MobileFinance {...p} />,
  portfolio: (p) => <MobilePortfolio {...p} />,
  settings:  (p) => <MobileSettings {...p} />,
};
// The assistant lives in the orb's conversation sheet on the phone.
const MOBILE_EXCLUDED = ['assistant'];

//  Shell
export default function MobileShell({ settings, onSettingsChange }) {
  const [activeTab, setActiveTab]   = useState(DEFAULT_SCREEN);
  const [valOpen,   setValOpen]     = useState(false);
  const scrollRef = useRef(null);
  const lastByGroupRef = useRef({});
  const ai        = useAI();
  const peakState = usePeakState(settings);

  // Notification scheduler — drives SMS + push on mobile
  useNotifications(settings);

  // Request push permission once on first installed PWA launch
  useEffect(() => {
    if (!isInstalledPWA()) return;
    const alreadyAsked = localStorage.getItem('valerie_push_asked');
    if (alreadyAsked) {
      // Permission already granted — refresh the FCM token silently
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

  useEffect(() => {
    setActiveGroup(groupOf(activeTab).id);
    ai.setActiveTab?.(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const navOpts = () => ({
    hidden: [...(settings?.hiddenTabs ?? []), ...MOBILE_EXCLUDED],
    order:  storage.get(STORAGE_KEYS.SIDEBAR_ORDER_IOS, null) ?? storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null),
  });

  // Accepts a screen id or a group id; ignores anything unknown.
  function switchTab(target) {
    if (target === 'assistant') { setValOpen(true); return; }
    const screen = resolveTarget(target, { ...navOpts(), lastByGroup: lastByGroupRef.current });
    if (!screen) return;
    haptics.tap();
    lastByGroupRef.current[groupOf(screen).id] = screen;
    setActiveTab(screen);
  }

  // VALERIE's navigate action drives the phone shell too
  useEffect(() => {
    ai.registerCallback?.('navigate', switchTab);
  }, [ai.registerCallback]); // eslint-disable-line react-hooks/exhaustive-deps

  const { pullPct, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(scrollRef, () => new Promise(r => setTimeout(r, 600)));

  const screenProps = { settings, onSettingsChange, ai, peakState, onTabChange: switchTab };
  const activeGroup = groupOf(activeTab);
  const sections    = groupScreens(activeGroup.id, navOpts());
  const render      = MOBILE_SCREENS[activeTab];

  return (
    <div className={backgroundClass(settings?.backgroundStyle, getTimeOfDay())} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
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

      {/*  Section row: this group's screens + Settings  */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionBar group={activeGroup} screens={sections} active={activeTab} onPick={switchTab} compact />
        </div>
        <button
          type="button"
          aria-label="Settings"
          aria-current={activeGroup.id === 'settings' ? 'page' : undefined}
          onClick={() => switchTab('settings')}
          style={{
            width: 44, height: 44, marginRight: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeGroup.id === 'settings' ? 'var(--accent)' : 'var(--text-muted)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Screen content with pull-to-refresh ── */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
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
        <div key={activeTab} className="val-fade-up m-screen">
          {render
            ? render(screenProps)
            : <div style={{ padding: 16 }}><PlaceholderScreen title={SCREEN_LABELS[activeTab] ?? activeTab} /></div>}
        </div>
      </div>

      <Toaster phone />
      <ActionConfirm phone />

      {/*  VALERIE slide-up sheet (hold the Coach orb)  */}
      <VALERIESheet open={valOpen} onClose={() => setValOpen(false)} ai={ai} settings={settings} />

      {/* ── Bottom tab bar ── */}
      <nav aria-label="Tabs" style={{
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
        {BAR.map(tab => {
          const active = activeGroup.id === tab.id;
          if (tab.orb) {
            return (
              <CoachOrb key={tab.id} active={active} orbState={ai?.orbState || 'idle'} shape={settings?.orbShape}
                onTap={() => switchTab('coach')} onHold={() => setValOpen(true)} />
            );
          }
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => switchTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--tab-accent)' : 'var(--text-muted)',
                transition: 'color 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                minHeight: 72,
              }}
            >
              {tab.icon(active)}
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                letterSpacing: '0.02em',
                color: active ? 'var(--tab-accent)' : 'var(--text-muted)',
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

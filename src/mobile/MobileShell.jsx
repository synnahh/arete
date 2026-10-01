// ─── MobileShell.jsx — iOS PWA shell with bottom tab navigation ───────────────
import { Icon } from '../components/icons.jsx';
import { useState, useEffect, useRef, useCallback } from 'react';
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
import MobileMind       from './screens/MobileMind.jsx';
import MobilePortfolio  from './screens/MobilePortfolio.jsx';
import MobileHabits     from './screens/MobileHabits.jsx';
import Toaster          from '../components/Toaster.jsx';
import MobileStyle      from './screens/MobileStyle.jsx';
import Insights         from '../tabs/Insights.jsx';
import PlanToday        from '../tabs/PlanToday.jsx';
import CoachToday       from '../tabs/CoachToday.jsx';
import { haptics }     from './utils/haptics.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import SectionBar      from '../components/SectionBar.jsx';
import { groupOf, groupScreens, resolveTarget, DEFAULT_SCREEN, SCREEN_LABELS } from '../nav/groups.js';
import { setActiveGroup, backgroundClass } from '../styles/appearance.js';
import { getTimeOfDay } from '../utils/time.js';

//  Bottom bar: Home · Plan · Coach · Finance · Mind
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
  {
    id: 'coach',
    label: 'Coach',
    // Same bar-and-plates mark as the desktop sidebar's Coach group.
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 7v10M17 7v10M4 9.5v5M20 9.5v5M7 12h10" {...stroke(active)} strokeLinecap="round" />
      </svg>
    ),
  },
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
  insights:  ()  => <Insights />,
  coachtoday:(p) => <CoachToday compact onTabChange={p.onTabChange} />,
  agenda:    (p) => <PlanToday compact onTabChange={p.onTabChange} />,
  lm:        ()  => <MobileLM />,
  mind:      (p) => <MobileMind {...p} />,
  finance:   (p) => <MobileFinance {...p} />,
  portfolio: (p) => <MobilePortfolio {...p} />,
  settings:  (p) => <MobileSettings {...p} />,
};
// Screens that exist on desktop only.
const MOBILE_EXCLUDED = [];

//  Shell
export default function MobileShell({ settings, onSettingsChange }) {
  const [activeTab, setActiveTab]   = useState(DEFAULT_SCREEN);
  const scrollRef = useRef(null);
  const lastByGroupRef = useRef({});
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
  }, [activeTab]);

  const navOpts = () => ({
    hidden: [...(settings?.hiddenTabs ?? []), ...MOBILE_EXCLUDED],
    order:  storage.get(STORAGE_KEYS.SIDEBAR_ORDER_IOS, null) ?? storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null),
  });

  // Accepts a screen id or a group id; ignores anything unknown.
  function switchTab(target) {
    const screen = resolveTarget(target, { ...navOpts(), lastByGroup: lastByGroupRef.current });
    if (!screen) return;
    haptics.tap();
    lastByGroupRef.current[groupOf(screen).id] = screen;
    setActiveTab(screen);
  }

  const { pullPct, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(scrollRef, () => new Promise(r => setTimeout(r, 600)));

  const screenProps = { settings, onSettingsChange, peakState, onTabChange: switchTab };
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
          <Icon name="settings" size={20} />
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
                fontSize: 11, fontWeight: active ? 600 : 400,
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

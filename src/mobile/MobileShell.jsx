// ─── MobileShell.jsx — iOS PWA shell with bottom tab navigation ───────────────
import { Icon } from '../components/icons.jsx';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePeakState }       from '../hooks/usePeakState.js';
import { useNotifications }   from '../hooks/useNotifications.js';
import { requestPushPermission, pushPermissionStatus, registerFCMToken } from '../utils/pushNotifications.js';
import { isInstalledPWA }     from '../utils/platform.js';
import MobileHealth     from './screens/MobileHealth.jsx';
import { PlaceholderScreen } from './screens/MobileMore.jsx';
import Essentials       from '../tabs/Essentials.jsx';
import HomeScreen       from '../components/HomeScreen.jsx';
import Profile from '../tabs/Profile.jsx';
import WorkoutTab from '../tabs/Workout.jsx';
import MobileLM         from './screens/MobileLM.jsx';
import GoalHQ           from '../tabs/GoalHQ.jsx';
import MobileSettings   from './screens/MobileSettings.jsx';
import MobileHabits     from './screens/MobileHabits.jsx';
import Toaster          from '../components/Toaster.jsx';
import RestTimer        from '../components/RestTimer.jsx';
import SyncBanner       from '../components/SyncBanner.jsx';
import MobileStyle      from './screens/MobileStyle.jsx';
import Insights         from '../tabs/Insights.jsx';
import { haptics, installTapHaptics } from './utils/haptics.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import SectionBar      from '../components/SectionBar.jsx';
import { groupOf, groupScreens, resolveTarget, DEFAULT_SCREEN, SCREEN_LABELS, BAR_ORDER } from '../nav/groups.js';
import { setActiveGroup, backgroundClass } from '../styles/appearance.js';
import { getTimeOfDay } from '../utils/time.js';

//  Bottom bar: Train · Fuel · Home · Look · Progress (Home in the middle, see BAR_ORDER)
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
    id: 'train',
    label: 'Train',
    // Bar and plates.
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 7v10M17 7v10M4 9.5v5M20 9.5v5M7 12h10" {...stroke(active)} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'eat',
    label: 'Fuel',
    // An apple with a leaf.
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8.2c-1.6-1.4-5.5-1.3-6.5 2.1-1 3.5 1.3 8.7 4 9.7 1 .4 1.6-.2 2.5-.2s1.5.6 2.5.2c2.7-1 5-6.2 4-9.7-1-3.4-4.9-3.5-6.5-2.1z"
          {...stroke(active)} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} strokeLinejoin="round" />
        <path d="M12 8.2c0-2 1-3.4 2.8-4.2" {...stroke(active)} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'look',
    label: 'Look',
    // An eye.
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" {...stroke(active)} strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.8" {...stroke(active)} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
      </svg>
    ),
  },
  {
    id: 'results',
    label: 'Progress',
    // Rising columns.
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19.5h16M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5" {...stroke(active)} strokeLinecap="round" />
      </svg>
    ),
  },
].sort((a, b) => BAR_ORDER.indexOf(a.id) - BAR_ORDER.indexOf(b.id));   // Train · Fuel · Home · Look · Progress

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
  dashboard: (p) => <HomeScreen {...p} compact />,
  goal:      (p) => <GoalHQ {...p} compact overview={<MobileHealth {...p} tabs={['Overview']} title={null} />} />,
  workout:   (p) => <WorkoutTab settings={p.settings} compact />,
  fuel:      (p) => <MobileHealth {...p} tabs={['Nutrition', 'Water']} title={null} />,
  essentials:()  => <Essentials />,
  recover:   (p) => <MobileHealth {...p} tabs={['Sleep']} title={null} />,
  body:      (p) => <MobileHealth {...p} tabs={['Body']} title={null} />,
  habits:    ()  => <MobileHabits />,
  style:     (p) => <MobileStyle {...p} />,
  insights:  ()  => <Insights />,
  lm:        ()  => <MobileLM />,
  profile:   (p) => <Profile settings={p.settings} />,
  settings:  (p) => <MobileSettings {...p} />,
};
// Screens that exist on desktop only.
const MOBILE_EXCLUDED = [];

//  Shell
export default function MobileShell({ settings, onSettingsChange }) {
  const [activeTab, setActiveTab]   = useState(DEFAULT_SCREEN);
  const [slide, setSlide] = useState(null);   // 'fwd' | 'back' when moving between screens of one group
  const scrollRef = useRef(null);
  const lastByGroupRef = useRef({});
  const peakState = usePeakState(settings);

  // A light tap on every button press, the way native apps feel (iPhone Safari 17.4+ and Android).
  useEffect(() => installTapHaptics(document), []);

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
    // A new screen starts at its top, not wherever the last one was scrolled to.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
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
    // Within a group the new screen slides in from the side you are heading toward;
    // a change of group keeps that group's own entrance.
    const to = groupOf(screen);
    let dir = null;
    if (screen !== activeTab && groupOf(activeTab).id === to.id) {
      const list = groupScreens(to.id, navOpts());
      dir = list.indexOf(screen) > list.indexOf(activeTab) ? 'fwd' : 'back';
    }
    setSlide(dir);
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

      <SyncBanner />

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
        <div key={activeTab} className="val-fade-up m-screen" data-dir={slide || undefined}>
          {render
            ? render(screenProps)
            : <div style={{ padding: 16 }}><PlaceholderScreen title={SCREEN_LABELS[activeTab] ?? activeTab} /></div>}
        </div>
      </div>

      <Toaster phone />
      <RestTimer />


      {/* ── Bottom tab bar ── */}
      {/* Home sits in the middle as a raised disc; for the other tabs a soft pill slides across. */}
      <nav aria-label="Tabs" className="m-tabbar">
        {(() => {
          const i = BAR.findIndex(t => t.id === activeGroup.id);
          const show = i >= 0 && BAR[i].id !== 'home';
          return (
            <span className="m-tab-slot" aria-hidden="true"
              style={{ width: `calc((100% - 12px) / ${BAR.length})`, transform: `translateX(${Math.max(0, i) * 100}%)`, opacity: show ? 1 : 0 }}>
              <span className="m-tab-thumb" />
            </span>
          );
        })()}
        {BAR.map(tab => {
          const active = activeGroup.id === tab.id;
          return (
            <button key={tab.id} type="button" className={`m-tab${tab.id === 'home' ? ' is-home' : ''}`}
              aria-current={active ? 'page' : undefined} onClick={() => switchTab(tab.id)}>
              <span className="m-tab-icon">{tab.icon(active)}</span>
              <span className="m-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

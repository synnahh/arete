import { useState, useEffect, useCallback, useRef, Component } from 'react';
import { Icon as LineIcon } from './components/icons.jsx';
import { isMobile } from './utils/platform.js';
import { handleSpotifyCallback }    from './utils/spotify.js';
import { storage, STORAGE_KEYS }    from './utils/storage.js';
import { supabase, getUserId }       from './supabase/supabase.js';
import { startSettingsSync }       from './utils/settingsSync.js';
import MobileShell                  from './mobile/MobileShell.jsx';
import Toaster                      from './components/Toaster.jsx';
import { applyTheme }            from './styles/themes.js';
import { applyAppearance, setActiveGroup, backgroundClass } from './styles/appearance.js';
import { stripLegacyClaudeKeys } from './utils/settingsSecurity.js';
import { getTimeOfDay }          from './utils/time.js';
import { useOnline }             from './hooks/useOnline.js';
import { useSupabaseStatus }    from './supabase/useSupabaseStatus.js';
import { usePeakState }         from './hooks/usePeakState.js';
import { useSleepSchedule }    from './hooks/useSleepSchedule.js';
import { useNotifications }    from './hooks/useNotifications.js';
import { useCoachReminders }   from './hooks/useCoachReminders.js';
import { useCoachEngine }      from './hooks/useCoachEngine.js';
import PinGate                   from './components/PinGate.jsx';
import LoadingScreen              from './components/LoadingScreen.jsx';
import SignIn                    from './components/SignIn.jsx';
import Sidebar                   from './components/Sidebar.jsx';
import QuickCapture              from './components/QuickCapture.jsx';
import CommandPalette            from './components/CommandPalette.jsx';
import SectionBar                from './components/SectionBar.jsx';
import { groupOf, groupScreens, resolveTarget, DEFAULT_SCREEN } from './nav/groups.js';

// ─── Tab imports ──────────────────────────────────────────────────────────────
import Dashboard  from './tabs/Dashboard.jsx';
import Tasks      from './tabs/Tasks.jsx';
import Calendar   from './tabs/Calendar.jsx';
import Notes      from './tabs/Notes.jsx';
import { Goal, Fuel, Recover, Body, Habits } from './tabs/Coach.jsx';
import Workout    from './tabs/Workout.jsx';
import Finance    from './tabs/Finance.jsx';
import Portfolio  from './tabs/Portfolio.jsx';
import Progress   from './tabs/Progress.jsx';
import Style      from './tabs/Style.jsx';
import Essentials from './tabs/Essentials.jsx';
import Lists      from './tabs/Lists.jsx';
import Focus      from './tabs/Focus.jsx';
import Vault      from './tabs/Vault.jsx';
import Settings   from './tabs/Settings.jsx';
import Profile    from './tabs/Profile.jsx';
import Places     from './tabs/Places.jsx';
import Routines   from './tabs/Routines.jsx';
import Mind       from './tabs/Mind.jsx';
import Insights   from './tabs/Insights.jsx';
import PlanToday  from './tabs/PlanToday.jsx';
import CoachToday from './tabs/CoachToday.jsx';
import MoneyToday from './tabs/MoneyToday.jsx';
import MindToday  from './tabs/MindToday.jsx';
import LM         from './tabs/LM.jsx';
import NudgeStack from './components/NudgeStack.jsx';
import WeeklyReview from './components/WeeklyReview.jsx';
import TodayView from './components/TodayView.jsx';

const TAB_MAP = {
  dashboard:  Dashboard,
  tasks:      Tasks,
  calendar:   Calendar,
  notes:      Notes,
  goal:       Goal,
  workout:    Workout,
  fuel:       Fuel,
  recover:    Recover,
  body:       Body,
  habits:     Habits,
  insights:   Insights,
  agenda:     PlanToday,
  coachtoday: CoachToday,
  moneytoday: MoneyToday,
  mindtoday:  MindToday,
  finance:    Finance,
  portfolio:  Portfolio,
  progress:   Progress,
  style:      Style,
  essentials: Essentials,
  lists:      Lists,
  focus:      Focus,
  vault:      Vault,
  settings:   Settings,
  profile:    Profile,
  routines:   Routines,
  mind:       Mind,
  lm:         LM,
  places:     Places,
};

// ─── Tab-level error boundary ─────────────────────────────────────────────────
// Catches any crash inside an active tab and shows a recovery UI instead of
// taking down the entire app with a white screen.
// ── Root-level boundary — catches anything outside tabs, auto-reloads ──────────
class RootErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, reloading: false }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err) { console.error('[VALERIE] Root crash:', err); }
  reload() {
    this.setState({ reloading: true });
    setTimeout(() => window.location.reload(), 300);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#080808',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="alert" size={30} strokeWidth={1.5} /></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Arete hit an error</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 360, textAlign: 'center', lineHeight: 1.7 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.reload()}
            style={{ padding: '10px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent, #a78bfa)', color: '#000',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
          >
            {this.state.reloading ? 'Reloading…' : 'Reload Arete'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err) { console.error('[VALERIE] Tab crash:', err); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          color: 'var(--text-secondary)', padding: 40,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="alert" size={26} strokeWidth={1.5} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Something crashed in this tab.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'var(--bg-base)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload tab
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [ready,         setReady]         = useState(false); // settings loaded
  const [activeTab,     setActiveTab]     = useState(DEFAULT_SCREEN);
  const [settings,      setSettings]      = useState(null);
  const [paletteOpen,   setPaletteOpen]   = useState(false);

  //  Navigation  activeTab is always a screen id; groups (Home, Plan, Coach,
  //  Mind, Finance, Settings) resolve to their last-visited screen.
  const lastByGroupRef = useRef({});
  const settingsRef    = useRef(null);
  settingsRef.current  = settings;
  const goTo = useCallback((target) => {
    const screen = resolveTarget(target, {
      hidden:      settingsRef.current?.hiddenTabs ?? [],
      order:       storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null),
      lastByGroup: lastByGroupRef.current,
    });
    if (!screen) return;
    lastByGroupRef.current[groupOf(screen).id] = screen;
    setActiveTab(screen);
  }, []);

  // ── Dev view ───────────────────────────────────────────────────────────────
  // On the local dev server only, skip the PIN and sign-in so a change can be looked
  // at while it is being built. import.meta.env.DEV is replaced with false in every
  // production build, so this whole path is removed from dist: it cannot ship. There
  // is no session in this mode, so nothing syncs. Add ?login=1 to the address to see
  // the real gates on the dev server.
  const DEV_VIEW = import.meta.env.DEV && new URLSearchParams(window.location.search).get('login') !== '1';

  // ── PIN gate — always required on app open (hardcoded single-user PIN) ──────
  const [locked, setLocked] = useState(!DEV_VIEW);

  // ── Supabase session ──────────────────────────────────────────────────────
  // One shared account across all devices = one auth.uid() = RLS lets every
  // device see the same rows. Sign-in shows ONCE per device (session persists).
  const [hasSession, setHasSession] = useState(DEV_VIEW ? true : null); // null = checking
  useEffect(() => {
    if (DEV_VIEW) return undefined;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const internetOnline = useOnline();

  // ── Firebase status ───────────────────────────────────────────────────────
  const firebaseSynced = useSupabaseStatus();

  // ── Peak State — computed once at app level, shared to Sidebar + Dashboard ─
  const peakState = usePeakState(settings);

  // ── Sleep Schedule — dims interface + fires reminders as bedtime approaches ─
  const { dimLevel, isSleepTime } = useSleepSchedule(settings);

  // ── Notification scheduler — habits, water, tasks, finance, storage alerts ──
  useNotifications(settings);
  useCoachReminders(settings);
  // The coach engine: keeps targets and plans in step with the logs (hooks/useCoachEngine.js).
  useCoachEngine({ run: true });

  //  Spotify OAuth callback 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    if (code && window.location.pathname === '/callback') {
      handleSpotifyCallback(code)
        .then(() => {
          window.history.replaceState({}, '', '/');
          window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: '🎵 Spotify connected', type: 'success' } }));
        })
        .catch(err => {
          console.error('[Spotify callback]', err);
          window.history.replaceState({}, '', '/');
        });
    }
  }, []);

  // ── WebView2 black-screen recovery on focus ───────────────────────────────
  // When Chrome (or any window) occludes VALERIE, WebView2 can suspend its GPU
  // swap chain. On refocus the frame stays black. Forcing a GPU composite layer
  // re-establishment via a transform toggle kicks the renderer back to life.
  // This runs alongside the Rust-side CalculateNativeWinOcclusion fix as a
  // second line of defence for any frames that still slip through.
  useEffect(() => {
    const recover = () => {
      const html = document.documentElement;
      // Promote the root to its own compositor layer, then immediately release it.
      // This forces WebView2 to re-establish the swap chain for the current frame.
      html.style.transform = 'translateZ(0)';
      requestAnimationFrame(() => {
        html.style.transform = '';
      });
    };
    window.addEventListener('focus', recover);
    return () => window.removeEventListener('focus', recover);
  }, []);

  //  Keep VALERIE's context aware of the active tab; tab colour follows the group
  useEffect(() => {
    setActiveGroup(groupOf(activeTab).id);
  }, [activeTab]);

  // ── Ctrl+K global keyboard shortcut ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
      // Also close on Escape when palette isn't open (safety)
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen]);

  //  On mount: load settings and apply the theme. (A personal app: no onboarding.)
  useEffect(() => {
    setReady(true);

    function applyAndSet(s) {
      s = stripLegacyClaudeKeys(s);
      setSettings(s);
      storage.set(STORAGE_KEYS.SETTINGS, s);
      applyAppearance(s);
    }

    const local = storage.get(STORAGE_KEYS.SETTINGS);
    if (local) {
      applyAndSet(local);
    } else {
      applyAppearance({});
    }

    // If no local settings (e.g. first launch on iOS PWA), pull from Supabase
    if (!local) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        const uid = session.user.id;
        supabase.from('user_meta').select('value').eq('user_id', uid).eq('key', 'settings').single()
          .then(({ data }) => { if (data?.value) applyAndSet(data.value); });
      });
    }

    // Log unhandled errors without suppressing React's own error handling
    const onError       = (e) => { console.error('[VALERIE] error:', e.error || e.message); };
    const onRejection   = (e) => { e.preventDefault(); console.error('[VALERIE] rejection:', e.reason); };
    window.addEventListener('error',              onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error',              onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // ── Settings follow you between devices: a change on one reaches the others live ──
  useEffect(() => {
    if (DEV_VIEW || hasSession !== true) return undefined;
    let stop = () => {};
    let alive = true;
    getUserId().then((uid) => {
      if (!alive || !uid) return;
      stop = startSettingsSync(uid, (merged) => window.dispatchEvent(new CustomEvent('valerie:settings-changed', { detail: merged })));
    });
    return () => { alive = false; stop(); };
  }, [hasSession, DEV_VIEW]);

  // ── Live settings sync — update state when Settings tab saves changes ──────
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail ?? storage.get(STORAGE_KEYS.SETTINGS, {});
      setSettings(updated);
      // Re-apply every appearance choice so CSS always matches saved state
      applyAppearance(updated);
    };
    window.addEventListener('valerie:settings-changed', handler);
    return () => window.removeEventListener('valerie:settings-changed', handler);
  }, []);

  // ── Apply time-of-day background class ────────────────────────────────────
  const tod = getTimeOfDay();

  // ── PIN gate takes priority over everything ──
  if (locked) {
    return <PinGate onUnlock={() => setLocked(false)} />;
  }

  // ── One-time device sign-in (only when there's no persisted session) ──
  if (hasSession === null) {
    return <LoadingScreen message="Signing in" />;
  }
  if (hasSession === false) {
    return <SignIn onSignedIn={() => setHasSession(true)} />;
  }

  //  Loading state (settings loading)
  if (!ready) {
    return <LoadingScreen message="Loading your data" />;
  }

  // ── Mobile PWA shell — renders instead of desktop layout on phones/tablets ──
  if (isMobile()) {
    return (
      <MobileShell
        settings={settings}
        onSettingsChange={(updated) => {
          setSettings(updated);
          storage.set(STORAGE_KEYS.SETTINGS, updated);
        }}
      />
    );
  }

  // ── Main app shell ────────────────────────────────────────────────────────
  const ActiveTab = TAB_MAP[activeTab] || Dashboard;
  const activeGroup = groupOf(activeTab);
  const sectionScreens = groupScreens(activeGroup.id, {
    hidden: settings?.hiddenTabs ?? [],
    order:  storage.get(STORAGE_KEYS.SIDEBAR_ORDER_DESKTOP, null),
  });

  // Layout density for the active tab — drives CSS variable + prop
  const layoutDensity = settings?.tabLayouts?.[activeTab] || 'standard';

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}
      className={backgroundClass(settings?.backgroundStyle, tod)}
    >
      {/* Sidebar */}
      <Sidebar
        activeGroup={activeGroup.id}
        onGroupClick={goTo}
        internetOnline={internetOnline}
        firebaseSynced={firebaseSynced}
        hiddenTabs={settings?.hiddenTabs ?? []}
        peakState={peakState}
      />

      {/* Main content area */}
      <main
        data-layout={layoutDensity}
        style={{
          flex: 1, height: '100%',
          paddingBottom: 76, // room for the floating dock (components/Dock.jsx)
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Every screen sits in one centred frame so nothing hugs the left edge on a wide window. */}
        <div className="page-frame" data-screen={activeTab}>
          <SectionBar group={activeGroup} screens={sectionScreens} active={activeTab} onPick={goTo} />

          <TabErrorBoundary key={activeTab}>
            <div className="val-fade-up" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ActiveTab
                settings={settings}
                onTabChange={goTo}
                density={layoutDensity}
                peakState={peakState}
              />
            </div>
          </TabErrorBoundary>
        </div>

        {/* Quick Capture — floats above all content */}
        <QuickCapture />
      </main>

      {/* Ctrl+K Command Palette — renders above everything */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onTabChange={goTo}
      />

      {/* Proactive nudges + whole-life Weekly Review + unified Today view */}
      {/* Home already lists these as Next moves; elsewhere they float bottom right. */}
      {activeTab !== 'dashboard' && <NudgeStack onTabChange={goTo} />}
      <WeeklyReview />
      <TodayView onTabChange={goTo} />

      {/* Sleep dim overlay — fades in as bedtime approaches. Max 80% opacity (never fully black). */}
      {dimLevel > 0 && (
        <div
          onClick={() => {
            // Clicking the overlay during sleep mode shows a brief "wake" indicator
            if (isSleepTime) {
              window.dispatchEvent(new CustomEvent('valerie:toast', {
                detail: { message: 'Sleep mode is on.', type: 'sleep' },
              }));
            }
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: `rgba(0,0,0,${Math.min(0.80, dimLevel * 0.80)})`,
            pointerEvents: 'none',
            transition: 'background 8s linear',
          }}
        />
      )}

      <Toaster />
    </div>
  );
}


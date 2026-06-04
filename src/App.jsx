import { useState, useEffect, useCallback, Component } from 'react';
import { platformInvoke, isMobile } from './utils/platform.js';
import { storage, STORAGE_KEYS }    from './utils/storage.js';
import MobileShell                  from './mobile/MobileShell.jsx';
import { applyTheme }            from './styles/themes.js';
import { getTimeOfDay }          from './utils/time.js';
import { useAI }                 from './ai/useAI.js';
import { useFirebaseStatus }    from './firebase/useFirebaseStatus.js';
import { usePeakState }         from './hooks/usePeakState.js';
import { useSleepSchedule }    from './hooks/useSleepSchedule.js';
import { useNotifications }    from './hooks/useNotifications.js';
import Onboarding                from './onboarding/Onboarding.jsx';
import Sidebar                   from './components/Sidebar.jsx';
import QuickCapture              from './components/QuickCapture.jsx';
import CommandPalette            from './components/CommandPalette.jsx';

// ─── Tab imports ──────────────────────────────────────────────────────────────
import Dashboard  from './tabs/Dashboard.jsx';
import Assistant  from './tabs/Assistant.jsx';
import Tasks      from './tabs/Tasks.jsx';
import Calendar   from './tabs/Calendar.jsx';
import Notes      from './tabs/Notes.jsx';
import Health     from './tabs/Health.jsx';
import Workout    from './tabs/Workout.jsx';
import Finance    from './tabs/Finance.jsx';
import Progress   from './tabs/Progress.jsx';
import Style      from './tabs/Style.jsx';
import Essentials from './tabs/Essentials.jsx';
import Lists      from './tabs/Lists.jsx';
import Focus      from './tabs/Focus.jsx';
import Vault      from './tabs/Vault.jsx';
import Settings   from './tabs/Settings.jsx';
import Routines   from './tabs/Routines.jsx';
import DailyBrief from './components/DailyBrief.jsx';

const TAB_MAP = {
  dashboard:  Dashboard,
  assistant:  Assistant,
  tasks:      Tasks,
  calendar:   Calendar,
  notes:      Notes,
  health:     Health,
  workout:    Workout,
  finance:    Finance,
  progress:   Progress,
  style:      Style,
  essentials: Essentials,
  lists:      Lists,
  focus:      Focus,
  vault:      Vault,
  settings:   Settings,
  routines:   Routines,
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
          <div style={{ fontSize: 32 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>VALERIE encountered an error</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', maxWidth: 360, textAlign: 'center', lineHeight: 1.7 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.reload()}
            style={{ padding: '10px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent, #a78bfa)', color: '#000',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
          >
            {this.state.reloading ? 'Reloading…' : 'Reload VALERIE'}
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
          <div style={{ fontSize: 28 }}>⚠</div>
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
  const [onboarded,     setOnboarded]     = useState(null); // null = loading
  const [activeTab,     setActiveTab]     = useState('dashboard');
  const [settings,      setSettings]      = useState(null);
  const [paletteOpen,   setPaletteOpen]   = useState(false);

  // ── AI brain ──────────────────────────────────────────────────────────────
  const ai = useAI();

  // ── Firebase status ───────────────────────────────────────────────────────
  const firebaseSynced = useFirebaseStatus();

  // ── Peak State — computed once at app level, shared to Sidebar + Dashboard ─
  const peakState = usePeakState(settings);

  // ── Sleep Schedule — dims interface + fires reminders as bedtime approaches ─
  const { dimLevel, isSleepTime } = useSleepSchedule(settings);

  // ── Notification scheduler — habits, water, tasks, finance, storage alerts ──
  useNotifications(settings);

  // ── Sleep toast ───────────────────────────────────────────────────────────
  const [sleepToast, setSleepToast] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      setSleepToast(e.detail?.message || null);
      setTimeout(() => setSleepToast(null), 5000);
    };
    window.addEventListener('valerie:toast', handler);
    return () => window.removeEventListener('valerie:toast', handler);
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

  // ── Wire VALERIE's navigate action to the real tab-change function ─────────
  useEffect(() => {
    ai.registerCallback('navigate', setActiveTab);
  }, [ai.registerCallback]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep VALERIE's context aware of the active tab ─────────────────────────
  useEffect(() => {
    ai.setActiveTab(activeTab);
  }, [activeTab, ai.setActiveTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── On mount: load settings, apply theme, check onboarding flag ────────────
  useEffect(() => {
    const savedSettings = storage.get(STORAGE_KEYS.SETTINGS);
    const isOnboarded   = storage.get(STORAGE_KEYS.ONBOARDED, false);

    if (savedSettings) {
      // One-time migration: phantom theme was accidentally saved — reset to obsidian
      if (savedSettings.theme === 'phantom') {
        savedSettings.theme = 'obsidian';
        savedSettings.accentColorHex = '';
        storage.set(STORAGE_KEYS.SETTINGS, savedSettings);
      }
      setSettings(savedSettings);
      applyTheme(savedSettings.theme || 'obsidian');

      // Always clear any stale inline accent override first, then re-apply only if saved
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-solid');
      if (savedSettings.accentColorHex) {
        document.documentElement.style.setProperty('--accent',       savedSettings.accentColorHex);
        document.documentElement.style.setProperty('--accent-solid', savedSettings.accentColorHex);
      }

      // Restore custom font if set
      if (savedSettings.fontFamily) {
        document.documentElement.style.setProperty('--font-family', savedSettings.fontFamily);
      }
    } else {
      applyTheme('obsidian');
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-solid');
    }

    setOnboarded(isOnboarded);

    // Launch Ollama silently in the background — no terminal window
    platformInvoke('launch_ollama').catch(() => {});

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

  // ── Live settings sync — update state when Settings tab saves changes ──────
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail ?? storage.get(STORAGE_KEYS.SETTINGS, {});
      setSettings(updated);
      // Re-apply theme + clear/restore accent so CSS vars always match saved state
      if (updated.theme) applyTheme(updated.theme);
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-solid');
      if (updated.accentColorHex) {
        document.documentElement.style.setProperty('--accent',       updated.accentColorHex);
        document.documentElement.style.setProperty('--accent-solid', updated.accentColorHex);
      }
    };
    window.addEventListener('valerie:settings-changed', handler);
    return () => window.removeEventListener('valerie:settings-changed', handler);
  }, []);

  // ── Apply time-of-day background class ────────────────────────────────────
  const tod = getTimeOfDay();

  // ── Loading state ─────────────────────────────────────────────────────────
  if (onboarded === null) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#080c14',
      }} />
    );
  }

  // ── Onboarding ────────────────────────────────────────────────────────────
  if (!onboarded) {
    return (
      <Onboarding onComplete={(data) => {
        setSettings(data);
        applyTheme(data.theme || 'obsidian');
        setOnboarded(true);
      }} />
    );
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

  // Layout density for the active tab — drives CSS variable + prop
  const layoutDensity = settings?.tabLayouts?.[activeTab] || 'standard';

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}
      className={`bg-${tod}`}
    >
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabClick={setActiveTab}
        claudeOnline={ai.claudeOnline}
        ollamaOnline={ai.ollamaOnline}
        internetOnline={ai.internetOnline}
        lastPinged={ai.lastPinged}
        firebaseSynced={firebaseSynced}
        hiddenTabs={settings?.hiddenTabs ?? []}
        peakState={peakState}
      />

      {/* Main content area */}
      <main
        data-layout={layoutDensity}
        style={{
          flex: 1, height: '100%',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}
      >
        <TabErrorBoundary key={activeTab}>
          <ActiveTab
            settings={settings}
            onTabChange={setActiveTab}
            ai={ai}
            density={layoutDensity}
            peakState={peakState}
          />
        </TabErrorBoundary>

        {/* Quick Capture — floats above all content */}
        <QuickCapture ai={ai} />
      </main>

      {/* Ctrl+K Command Palette — renders above everything */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onTabChange={setActiveTab}
        ai={ai}
      />

      {/* Daily Brief — once-per-day greeting overlay */}
      <DailyBrief ai={ai} settings={settings} />

      {/* Sleep dim overlay — fades in as bedtime approaches. Max 80% opacity (never fully black). */}
      {dimLevel > 0 && (
        <div
          onClick={() => {
            // Clicking the overlay during sleep mode shows a brief "wake" indicator
            if (isSleepTime) {
              window.dispatchEvent(new CustomEvent('valerie:toast', {
                detail: { message: 'Good morning, Sir. Sleep mode active.', type: 'sleep' },
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

      {/* Sleep toast */}
      {sleepToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(8,12,20,0.96)', border: '0.5px solid rgba(74,158,255,0.3)',
          borderRadius: 12, padding: '11px 20px', zIndex: 10000,
          fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', gap: 9,
          animation: 'fadeIn 0.25s ease',
        }}>
          <span style={{ fontSize: 16 }}>🌙</span>
          {sleepToast}
        </div>
      )}
    </div>
  );
}

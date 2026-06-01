import { useState, useEffect, useCallback } from 'react';
import { invoke }                from '@tauri-apps/api/core';
import { storage, STORAGE_KEYS } from './utils/storage.js';
import { applyTheme }            from './styles/themes.js';
import { getTimeOfDay }          from './utils/time.js';
import { useAI }                 from './ai/useAI.js';
import { useFirebaseStatus }    from './firebase/useFirebaseStatus.js';
import { usePeakState }         from './hooks/usePeakState.js';
import { useSleepSchedule }    from './hooks/useSleepSchedule.js';
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
      setSettings(savedSettings);
      applyTheme(savedSettings.theme || 'obsidian');

      // Restore custom font if set
      if (savedSettings.fontFamily) {
        document.documentElement.style.setProperty('--font-family', savedSettings.fontFamily);
      }
      // Restore custom accent colour override if set
      if (savedSettings.accentColorHex) {
        document.documentElement.style.setProperty('--accent',       savedSettings.accentColorHex);
        document.documentElement.style.setProperty('--accent-solid', savedSettings.accentColorHex);
      }
    } else {
      applyTheme('obsidian');
    }

    setOnboarded(isOnboarded);

    // Launch Ollama silently in the background — no terminal window
    invoke('launch_ollama').catch(() => {});

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
        <ActiveTab
          settings={settings}
          onTabChange={setActiveTab}
          ai={ai}
          density={layoutDensity}
          peakState={peakState}
        />

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

      {/* Sleep dim overlay — fades in as bedtime approaches */}
      {dimLevel > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: `rgba(0,0,0,${dimLevel * 0.72})`,
          pointerEvents: isSleepTime ? 'none' : 'none',
          transition: 'background 60s linear',
        }} />
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

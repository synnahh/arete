import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from './utils/storage.js';
import { applyTheme }            from './styles/themes.js';
import { getTimeOfDay }          from './utils/time.js';
import { useAI }                 from './ai/useAI.js';
import { useFirebaseStatus }    from './firebase/useFirebaseStatus.js';
import Onboarding                from './onboarding/Onboarding.jsx';
import Sidebar                   from './components/Sidebar.jsx';
import QuickCapture              from './components/QuickCapture.jsx';

// ─── Tab imports ──────────────────────────────────────────────────────────────
import Dashboard  from './tabs/Dashboard.jsx';
import Assistant  from './tabs/Assistant.jsx';
import Tasks      from './tabs/Tasks.jsx';
import Calendar   from './tabs/Calendar.jsx';
import Notes      from './tabs/Notes.jsx';
import Health     from './tabs/Health.jsx';
import Finance    from './tabs/Finance.jsx';
import Progress   from './tabs/Progress.jsx';
import Style      from './tabs/Style.jsx';
import Essentials from './tabs/Essentials.jsx';
import Lists      from './tabs/Lists.jsx';
import Focus      from './tabs/Focus.jsx';
import Vault      from './tabs/Vault.jsx';
import Settings   from './tabs/Settings.jsx';

const TAB_MAP = {
  dashboard:  Dashboard,
  assistant:  Assistant,
  tasks:      Tasks,
  calendar:   Calendar,
  notes:      Notes,
  health:     Health,
  finance:    Finance,
  progress:   Progress,
  style:      Style,
  essentials: Essentials,
  lists:      Lists,
  focus:      Focus,
  vault:      Vault,
  settings:   Settings,
};

export default function App() {
  const [onboarded, setOnboarded] = useState(null); // null = loading
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings]   = useState(null);

  // ── AI brain ──────────────────────────────────────────────────────────────
  const ai = useAI();

  // ── Firebase status ───────────────────────────────────────────────────────
  const firebaseSynced = useFirebaseStatus();

  // ── Wire VALERIE's navigate action to the real tab-change function ─────────
  useEffect(() => {
    ai.registerCallback('navigate', setActiveTab);
  }, [ai.registerCallback]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep VALERIE's context aware of the active tab ─────────────────────────
  useEffect(() => {
    ai.setActiveTab(activeTab);
  }, [activeTab, ai.setActiveTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On mount: load settings, apply theme, check onboarding flag ────────────
  useEffect(() => {
    const savedSettings = storage.get(STORAGE_KEYS.SETTINGS);
    const isOnboarded   = storage.get(STORAGE_KEYS.ONBOARDED, false);

    if (savedSettings) {
      setSettings(savedSettings);
      applyTheme(savedSettings.theme || 'obsidian');
    } else {
      applyTheme('obsidian');
    }

    setOnboarded(isOnboarded);
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
      />

      {/* Main content area */}
      <main style={{
        flex: 1, height: '100%',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        <ActiveTab
          settings={settings}
          onTabChange={setActiveTab}
          ai={ai}
        />

        {/* Quick Capture — floats above all content */}
        <QuickCapture ai={ai} />
      </main>
    </div>
  );
}

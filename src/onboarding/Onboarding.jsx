import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { getGreeting } from '../utils/time.js';
import { THEMES, applyTheme } from '../styles/themes.js';
import Step1Welcome       from './steps/Step1Welcome.jsx';
import Step2Name          from './steps/Step2Name.jsx';
import Step3AssistantName from './steps/Step3AssistantName.jsx';
import Step4ApiKey        from './steps/Step4ApiKey.jsx';
import Step5Voice         from './steps/Step5Voice.jsx';
import Step6Theme         from './steps/Step6Theme.jsx';
import Step7Greeting      from './steps/Step7Greeting.jsx';

const TOTAL_STEPS = 7;

export default function Onboarding({ onComplete }) {
  const [step, setStep]   = useState(1);
  const [data, setData]   = useState({
    userName:      '',
    assistantName: 'VALERIE',
    apiKey:        '',
    voice:         null,
    theme:         'obsidian',
  });
  const [animating, setAnimating] = useState(false);

  // Apply theme live as user picks it
  useEffect(() => { applyTheme(data.theme); }, [data.theme]);

  function update(patch) {
    setData(prev => ({ ...prev, ...patch }));
  }

  function next() {
    if (animating || step >= TOTAL_STEPS) return;
    setAnimating(true);
    setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 10);
  }

  function back() {
    if (animating || step <= 1) return;
    setAnimating(true);
    setTimeout(() => { setStep(s => s - 1); setAnimating(false); }, 10);
  }

  function finish() {
    // Save everything to localStorage
    storage.set(STORAGE_KEYS.USER, { name: data.userName, assistantName: data.assistantName });
    storage.set(STORAGE_KEYS.SETTINGS, {
      userName:      data.userName,
      assistantName: data.assistantName,
      apiKey:        data.apiKey,
      voice:         data.voice,
      theme:         data.theme,
    });
    storage.set(STORAGE_KEYS.ONBOARDED, true);
    onComplete(data);
  }

  const stepProps = { data, update, next, back, finish, step, total: TOTAL_STEPS };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 999,
    }}>
      {/* Progress dots */}
      {step < TOTAL_STEPS && (
        <ProgressDots current={step} total={TOTAL_STEPS} />
      )}

      {/* Step content */}
      <div key={step} className="slide-in-step" style={{ width: '100%', maxWidth: 480, padding: '0 24px' }}>
        {step === 1 && <Step1Welcome  {...stepProps} />}
        {step === 2 && <Step2Name     {...stepProps} />}
        {step === 3 && <Step3AssistantName {...stepProps} />}
        {step === 4 && <Step4ApiKey   {...stepProps} />}
        {step === 5 && <Step5Voice    {...stepProps} />}
        {step === 6 && <Step6Theme    {...stepProps} />}
        {step === 7 && <Step7Greeting {...stepProps} />}
      </div>
    </div>
  );
}

function ProgressDots({ current, total }) {
  return (
    <div style={{
      position: 'absolute', top: 32,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {Array.from({ length: total - 1 }, (_, i) => { // -1 because step 7 is the reveal
        const idx = i + 1;
        const done   = idx < current;
        const active = idx === current;
        return (
          <div key={idx} style={{
            height: 5,
            width: active ? 22 : 8,
            borderRadius: 3,
            background: done || active ? 'var(--accent)' : 'var(--text-muted)',
            opacity: done ? 0.55 : active ? 1 : 0.3,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        );
      })}

      {/* Step label */}
      <span style={{
        position: 'absolute', right: -72, top: -2,
        fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em',
      }}>
        {current} / {total}
      </span>
    </div>
  );
}

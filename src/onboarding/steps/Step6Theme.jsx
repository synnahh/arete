import { PrimaryButton } from './Step1Welcome.jsx';
import { BackButton } from './Step2Name.jsx';
import { THEMES, THEME_KEYS } from '../../styles/themes.js';

export default function Step6Theme({ data, update, next, back }) {
  const current = data.theme || 'obsidian';

  function pick(key) {
    update({ theme: key });
    // Theme is applied live in Onboarding.jsx via useEffect
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <BackButton onClick={back} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 28, opacity: 0.4 }}><</div>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Make it yours
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Choose a theme. Everything can be fine-tuned later in Settings.
        </p>
      </div>

      {/* Theme grid — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {THEME_KEYS.map(key => {
          const t = THEMES[key];
          const active = current === key;
          return (
            <button key={key} onClick={() => pick(key)} style={{
              padding: '14px 16px',
              borderRadius: 10,
              border: `0.5px solid ${active ? t.preview.accent : 'rgba(255,255,255,0.07)'}`,
              background: t.preview.bg,
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 8,
              alignItems: 'flex-start',
              transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
              outline: 'none',
              boxShadow: active ? `0 0 0 1px ${t.preview.accent}30` : 'none',
            }}>
              {/* Mini accent swatch */}
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: `radial-gradient(circle, ${t.preview.accent}, transparent)`,
                  border: `1px solid ${t.preview.accent}60`,
                }} />
                {active && (
                  <span style={{ fontSize: 10, color: t.preview.accent, opacity: 0.9 }}>✓</span>
                )}
              </div>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: t.light ? '#1a2040' : 'rgba(255,255,255,0.88)',
                }}>
                  {t.name}
                </div>
                <div style={{
                  fontSize: 11,
                  color: t.light ? 'rgba(40,60,100,0.5)' : 'rgba(255,255,255,0.35)',
                  marginTop: 2,
                }}>
                  {t.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <PrimaryButton onClick={next}>Continue →</PrimaryButton>
    </div>
  );
}

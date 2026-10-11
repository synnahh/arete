// LoadingScreen — shown while the app works out whether you are signed in and loads
// your settings. It stays invisible for the first moment (so a fast load never
// flashes it) and then fades in: the emblem, a thin ring and one line of text.
// Transform and opacity only; reduced-motion users get the static version.
import AreteLogo from './AreteLogo.jsx';

export default function LoadingScreen({ message = 'Loading' }) {
  return (
    <div role="status" aria-live="polite" aria-label={message} className="arete-loading" style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
      background: 'var(--bg-base, #080c14)', zIndex: 9000,
    }}>
      <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg className="arete-loading-ring" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="48" cy="48" r="44" fill="none" stroke="var(--card-border, rgba(255,255,255,0.12))" strokeWidth="2" />
          <path d="M48 4a44 44 0 0 1 44 44" fill="none" stroke="var(--accent, #D8B26E)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <AreteLogo alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
      </div>
      <div style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--text-muted, #8a8f98)', fontFamily: 'ui-monospace, monospace' }}>{message}</div>
      <style>{`
        .arete-loading { animation: arete-load-in 0.35s ease-out 0.3s both; }
        .arete-loading-ring { animation: arete-load-spin 1.1s linear infinite; }
        @keyframes arete-load-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes arete-load-spin { to { transform: rotate(360deg); } }
        html[data-motion="reduced"] .arete-loading-ring { animation: none; }
      `}</style>
    </div>
  );
}

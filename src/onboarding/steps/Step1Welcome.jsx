// Step 1 — Welcome screen with VALERIE logo

export default function Step1Welcome({ next }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, textAlign: 'center' }}>
      <img
        src="/assets/valerie-logo.png"
        alt="Arete"
        style={{
          width: 120,
          height: 120,
          objectFit: 'contain',
          marginBottom: 8,
          filter: 'drop-shadow(0 0 24px var(--orb-glow))',
          animation: 'orb-breathe 3.2s ease-in-out infinite',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{
          fontSize: 36, fontWeight: 300, letterSpacing: '0.06em',
          color: 'var(--text-primary)',
        }}>
          Welcome.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 340 }}>
          <strong>Arete</strong> — train, eat, look and spend with a plan that adjusts to your logs.{' '}
          Let's get you set up. This takes about 2 minutes.
        </p>
      </div>

      <PrimaryButton onClick={next}>Get started →</PrimaryButton>
    </div>
  );
}

export function PrimaryButton({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 32px',
        borderRadius: 10,
        border: '0.5px solid var(--card-border)',
        background: disabled ? 'var(--hover-bg)' : 'var(--active-bg)',
        color: disabled ? 'var(--text-muted)' : 'var(--accent)',
        fontSize: 14, fontWeight: 500, letterSpacing: '0.04em',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: 160,
      }}
      onMouseEnter={e => { if (!disabled) e.target.style.background = 'var(--active-bg)'; }}
    >
      {children}
    </button>
  );
}

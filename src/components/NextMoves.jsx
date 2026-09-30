// "Next moves": the few things worth doing now, most important first, each with
// the reason. Rules: domain/nextMoves.js. Tapping one opens the screen for it.
import { useNextMoves } from '../hooks/useNextMoves.js';

const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };

export default function NextMoves({ onTabChange, compact = false }) {
  const moves = useNextMoves();
  if (!moves.length) return null;
  return (
    <section aria-label="Next moves" style={{ padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...label, marginBottom: 6 }}>Next moves</div>
      {moves.map((m, i) => (
        <button key={m.id} type="button" onClick={() => onTabChange?.(m.tab)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', minHeight: 52, padding: '8px 4px', cursor: 'pointer', fontFamily: 'inherit',
            background: 'none', border: 'none', borderTop: i ? '0.5px solid var(--card-border)' : 'none', WebkitTapHighlightColor: 'transparent',
          }}>
          <span className="val-num" aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: i === 0 ? 'var(--tab-accent)' : 'var(--hover-bg)', color: i === 0 ? 'var(--on-tab-accent)' : 'var(--text-secondary)' }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</span>
            <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{m.why}</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>›</span>
        </button>
      ))}
    </section>
  );
}

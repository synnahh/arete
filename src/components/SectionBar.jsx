//  SectionBar  switches between the screens inside one navigation group
// (e.g. Coach: Train · Health · Look · Style). Renders nothing for a group
// with a single visible screen.
import { SCREEN_LABELS } from '../nav/groups.js';

export default function SectionBar({ group, screens, active, onPick, compact = false }) {
  if (!screens || screens.length < 2) return null;

  return (
    <nav
      aria-label={`${group.label} sections`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: compact ? '10px 16px 4px' : '14px 24px 6px',
        overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}
    >
      {!compact && (
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--tab-accent)', marginRight: 8,
        }}>
          {group.label}
        </span>
      )}
      {screens.map(id => {
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onPick(id)}
            style={{
              flexShrink: 0,
              minHeight: compact ? 36 : 30,
              padding: compact ? '0 14px' : '0 12px',
              borderRadius: 999,
              border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
              background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
              color: on ? 'var(--tab-accent)' : 'var(--text-secondary)',
              fontSize: compact ? 13 : 12, fontWeight: on ? 600 : 500,
              fontFamily: 'inherit', cursor: 'pointer',
              transition: 'background 0.16s ease, color 0.16s ease, border-color 0.16s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {SCREEN_LABELS[id] ?? id}
          </button>
        );
      })}
    </nav>
  );
}

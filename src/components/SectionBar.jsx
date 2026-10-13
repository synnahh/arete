//  SectionBar  switches between the screens inside one navigation group
// (e.g. Progress: Body · Goal · Sleep · Habits). Renders nothing for a group
// with a single visible screen. The highlight slides to the chosen section.
import { SCREEN_LABELS } from '../nav/groups.js';
import { SlidingTabs } from './Motion.jsx';

export default function SectionBar({ group, screens, active, onPick, compact = false }) {
  if (!screens || screens.length < 2) return null;

  return (
    <nav
      aria-label={`${group.label} sections`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: compact ? '10px 16px 4px' : '14px 24px 6px', flexShrink: 0, minWidth: 0,
        // On the phone the row scrolls sideways: fade the right edge so a cut-off chip reads as "more".
        ...(compact ? { maskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)' } : {}),
      }}
    >
      {!compact && (
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--tab-accent)', marginRight: 8, flexShrink: 0,
        }}>
          {group.label}
        </span>
      )}
      <SlidingTabs mode="nav" scroll size={compact ? 'md' : 'sm'} value={active} onChange={onPick} style={{ minWidth: 0 }}
        items={screens.map(id => ({ id, label: SCREEN_LABELS[id] ?? id }))} />
    </nav>
  );
}

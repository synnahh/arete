// Dock — the desktop navigation: a floating pill at the bottom centre with one
// Greek-inspired glyph per group. The active group glows in its own tab colour,
// hover lifts a glyph and names it above. The phone keeps its bottom bar.
// Motion is transform/opacity only and is switched off by the global reduced-motion rules.
import { useMemo, useState } from 'react';
import { useNextMoves } from '../hooks/useNextMoves.js';
import { groupOf } from '../nav/groups.js';

// 24x24 line glyphs. Each is a single path string so it can sit in <path d>.
export const GREEK_GLYPHS = {
  // Temple: pediment, architrave, four columns, base.
  home:    'M3 9.5 12 4l9 5.5z M4.5 11.5h15 M6.5 11.5v7 M10 11.5v7 M14 11.5v7 M17.5 11.5v7 M3 20.5h18',
  // Scroll: a sheet with a curled edge and two lines of writing.
  plan:    'M8 4h10v12.5a2.5 2.5 0 0 1-2.5 2.5H8.5A2.5 2.5 0 0 1 6 16.5V6a2 2 0 0 1 2-2z M10 8.5h5 M10 12h5',
  // Laurel: two branches meeting at the stem, three leaves each.
  coach:   'M12 20.5C7 20 4 15.5 5.5 7.5 M9 19.6Q8.8 17 6.3 16.2Q6.5 18.8 9 19.6z M6.7 17.4Q6.5 14.8 4 14Q4.2 16.6 6.7 17.4z M5.4 14.1Q5.1 11.5 2.6 10.7Q2.9 13.3 5.4 14.1z M5.2 10.2Q4.9 7.6 2.4 6.8Q2.7 9.4 5.2 10.2z M12 20.5C17 20 20 15.5 18.5 7.5 M15 19.6Q15.2 17 17.7 16.2Q17.5 18.8 15 19.6z M17.3 17.4Q17.5 14.8 20 14Q19.8 16.6 17.3 17.4z M18.6 14.1Q18.9 11.5 21.4 10.7Q21.1 13.3 18.6 14.1z M18.8 10.2Q19.1 7.6 21.6 6.8Q21.3 9.4 18.8 10.2z',
  // Lyre: two arms, crossbar, three strings, stand.
  mind:    'M7 4v8a5 5 0 0 0 10 0V4 M6 5.5h12 M10 5.5v10 M12 5.5v10 M14 5.5v10 M9 20h6 M12 17v3',
  // Coin: rim, inner ring, and the letter A.
  finance: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17z M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 1 0 0-11z M9.5 15l2.5-6 2.5 6 M10.4 13h3.2',
  // Meander (Greek key) spiral.
  settings: 'M4 20V4h16v16H8V8h8v8',
};

const Glyph = ({ d, size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function Item({ id, label, desc, active, onClick, glyph, tint, due = 0 }) {
  return (
    <button type="button" className={`dock-item${active ? ' is-active' : ''}`} data-tint={tint} onClick={onClick}
      aria-label={label} aria-current={active ? 'page' : undefined}>
      <Glyph d={glyph} />
      {due > 0 && !active && <span className="dock-due" aria-label={`${due} waiting`}>{due > 1 ? due : ''}</span>}
      <span className="dock-tip" role="tooltip"><strong>{label}</strong>{desc ? <em>{desc}</em> : null}</span>
    </button>
  );
}

function Status({ internetOnline, synced }) {
  const [open, setOpen] = useState(false);
  const colour = !internetOnline ? '#e55a5a' : synced ? '#4caf7d' : '#f4a642';
  const text = !internetOnline ? 'Offline' : synced ? 'Online · synced' : 'Online · connecting';
  return (
    <button type="button" className="dock-status" aria-label={`Connection: ${text}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colour, boxShadow: `0 0 6px ${colour}99` }} />
      {open && <span className="dock-tip is-on" role="tooltip"><strong>{text}</strong></span>}
    </button>
  );
}

export default function Dock({ groups, settingsGroup, activeGroup, onGroupClick, internetOnline, synced }) {
  // What is waiting, per group: the Next moves, counted by the group their screen lives in.
  const moves = useNextMoves();
  const due = useMemo(() => {
    const by = {};
    for (const m of moves || []) { const g = m.tab ? groupOf(m.tab)?.id : null; if (g) by[g] = (by[g] || 0) + 1; }
    return by;
  }, [moves]);
  return (
    <nav className="dock" aria-label="Main">
      {groups.map(g => (
        <Item key={g.id} id={g.id} tint={g.id} label={g.label} desc={g.desc} glyph={GREEK_GLYPHS[g.id]}
          active={activeGroup === g.id} due={due[g.id] || 0} onClick={() => onGroupClick(g.id)} />
      ))}
      <span className="dock-sep" aria-hidden="true" />
      {settingsGroup && (
        <Item id="settings" tint="settings" label={settingsGroup.label} desc={settingsGroup.desc} glyph={GREEK_GLYPHS.settings}
          active={activeGroup === 'settings'} due={due.settings || 0} onClick={() => onGroupClick('settings')} />
      )}
      <Status internetOnline={internetOnline} synced={synced} />
    </nav>
  );
}

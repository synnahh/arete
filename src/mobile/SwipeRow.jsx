// SwipeRow — swipe a list row left to delete it, the way iOS lists work.
//
// A short swipe parks the row open on a red Delete button (tap it to delete, swipe
// right or tap the row to close). A long swipe deletes straight away. The row only
// moves with transform, vertical scrolling is left to the browser (touch-action:
// pan-y), and the caller supplies onDelete, which should offer Undo.
//
// Mouse and keyboard users keep the existing delete buttons: the swipe is an extra.
import { useRef, useState } from 'react';
import { haptics } from './utils/haptics.js';

const OPEN = 88;          // px the row parks at
const COMMIT = 0.55;      // fraction of the row width that deletes on release
const LOCK = 8;           // px of movement before we decide horizontal vs vertical

export default function SwipeRow({ onDelete, children, label = 'Delete', disabled = false, style }) {
  const row = useRef(null);
  const g = useRef(null);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  const move = (x, ms) => {
    if (!row.current) return;
    row.current.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none';
    row.current.style.transform = `translateX(${x}px)`;
  };

  const finish = async () => {
    haptics.heavy();
    move(-(row.current?.offsetWidth || 400), 200);
    setGone(true);
    try { await onDelete?.(); }
    catch { setGone(false); move(0, 250); setOpen(false); }
  };

  const down = (e) => {
    if (disabled || gone || e.pointerType === 'mouse' || e.target.closest('input, textarea, select')) return;
    g.current = { x: e.clientX, y: e.clientY, from: open ? -OPEN : 0, mode: null, crossed: false };
  };
  const moveEv = (e) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.mode) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      s.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (s.mode === 'x') e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (s.mode !== 'x') return;
    const x = Math.min(0, Math.max(-(row.current?.offsetWidth || 400), s.from + dx));
    // Rubber-band past the open position so it feels weighted.
    const shown = x < -OPEN ? -OPEN + (x + OPEN) * 0.6 : x;
    move(shown, 0);
    const past = -x > (row.current?.offsetWidth || 400) * COMMIT;
    if (past !== s.crossed) { s.crossed = past; haptics.tap(); }
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s || s.mode !== 'x') return;
    const cur = row.current ? new DOMMatrixReadOnly(getComputedStyle(row.current).transform).m41 : 0;
    if (-cur > (row.current?.offsetWidth || 400) * COMMIT) { finish(); return; }
    const park = -cur > OPEN / 2;
    setOpen(park);
    move(park ? -OPEN : 0, 260);
  };

  if (gone) return <div aria-hidden="true" style={{ height: 0, overflow: 'hidden', transition: 'height 0.2s ease' }} />;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <button
        type="button" onClick={finish} tabIndex={open ? 0 : -1} aria-hidden={!open} data-no-haptic
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: OPEN, border: 'none', background: '#d64545', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}
      >{label}</button>
      <div
        ref={row} onPointerDown={down} onPointerMove={moveEv} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { if (open) { e.stopPropagation(); e.preventDefault(); setOpen(false); move(0, 220); } }}
        style={{ position: 'relative', background: 'var(--bg-panel)', touchAction: 'pan-y', willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}

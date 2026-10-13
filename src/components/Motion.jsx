//  VALERIE motion primitives  thin wrappers over the CSS motion system
//  (globals.css "VALERIE MOTION SYSTEM" and styles/system.css v3). transform/opacity only; all
//  honour prefers-reduced-motion automatically because the CSS does, and the JS-driven ones
//  (AnimatedNumber, sheets) check useReducedMotion.

import { useState, useEffect, useLayoutEffect, useRef, useCallback, Children, isValidElement } from 'react';
import { createPortal } from 'react-dom';

function prefersReduced() {
  return typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
     document.documentElement.getAttribute('data-reduce-motion') === 'true');
}

/** True while the OS or Settings asks for less motion; follows changes live. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReduced);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(prefersReduced());
    mq?.addEventListener?.('change', on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => { mq?.removeEventListener?.('change', on); mo.disconnect(); };
  }, []);
  return reduced;
}

// Fade + rise on mount. `as` lets you keep semantic tags. `delay` in ms.
export function FadeUp({ children, delay = 0, as: Tag = 'div', style, className = '', ...rest }) {
  return (
    <Tag className={`val-fade-up ${className}`} style={{ '--d': `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

// Stagger direct children's entrance. Each child gets an increasing delay.
export function Stagger({ children, step = 40, start = 0, as: Tag = 'div', style, className = '', ...rest }) {
  const kids = Children.toArray(children).filter(Boolean);
  return (
    <Tag className={className} style={style} {...rest}>
      {kids.map((child, i) => (
        <div key={isValidElement(child) && child.key != null ? child.key : i}
             className="val-fade-up" style={{ '--d': `${start + i * step}ms` }}>
          {child}
        </div>
      ))}
    </Tag>
  );
}

// Count-up number. `value` is numeric; `format` renders it. Animates on change.
export function AnimatedNumber({ value = 0, duration = 700, format = (n) => Math.round(n).toLocaleString(), style, className }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef  = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to   = value;
    if (from === to) return;
    if (prefersReduced()) { setDisplay(to); fromRef.current = to; return; }

    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const now = from + (to - from) * eased;
      fromRef.current = now;   // an interrupted count continues from where it is, not from the old target
      setDisplay(now);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{format(display)}</span>;
}

// Shimmer placeholder block.
export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  return <div className="val-skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/**
 * One-of-many tabs or chips with an indicator that slides to the chosen one.
 * items: [{ id, label }]. mode 'tabs' (role tablist, aria-selected), 'nav' (aria-current) or
 * 'toggle' (aria-pressed). boxed draws a segmented control; scroll lets a long row scroll.
 */
export function SlidingTabs({ items, value, onChange, label, mode = 'tabs', boxed = false, scroll = false, size = 'md', style, className = '' }) {
  const wrap = useRef(null);
  const btns = useRef({});
  const [thumb, setThumb] = useState(null);
  const placed = useRef(false);

  const measure = useCallback(() => {
    const el = btns.current[value];
    if (!el || !wrap.current) { setThumb(null); return; }
    setThumb({ x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight, y: el.offsetTop });
  }, [value]);

  const labels = items.map(t => `${t.id}:${typeof t.label === 'string' ? t.label : ''}`).join('|');
  useLayoutEffect(() => { measure(); }, [measure, labels]);
  useEffect(() => {
    if (!wrap.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [measure]);
  // Keep the chosen chip in view in a scrolling row. Scrolls this row only: scrollIntoView would
  // also scroll every ancestor (even overflow:hidden ones), shifting the whole page sideways.
  useEffect(() => {
    if (!scroll || !wrap.current) return;
    const el = btns.current[value], row = wrap.current;
    if (!el) return;
    const left = el.offsetLeft - 12, right = el.offsetLeft + el.offsetWidth + 12;
    const to = left < row.scrollLeft ? left : right > row.scrollLeft + row.clientWidth ? right - row.clientWidth : null;
    if (to != null) row.scrollTo({ left: Math.max(0, to), behavior: placed.current && !prefersReduced() ? 'smooth' : 'auto' });
  }, [value, scroll]);
  useEffect(() => { if (thumb) { const t = requestAnimationFrame(() => { placed.current = true; }); return () => cancelAnimationFrame(t); } return undefined; }, [thumb]);

  const attr = (on) => (mode === 'nav' ? { 'aria-current': on ? 'page' : undefined } : mode === 'toggle' ? { 'aria-pressed': on } : { role: 'tab', 'aria-selected': on });
  const onKey = (e) => {
    if (mode !== 'tabs' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = items.findIndex(t => t.id === value);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    onChange(items[n].id);
    btns.current[items[n].id]?.focus();
  };

  return (
    <div ref={wrap} role={mode === 'tabs' ? 'tablist' : 'group'} aria-label={label} onKeyDown={onKey}
      className={`ui-tabs${boxed ? ' is-boxed' : ''}${scroll ? ' is-scroll' : ''} ${className}`} style={{ position: 'relative', ...style }}>
      {thumb && (
        <span className="ui-tabs-thumb" aria-hidden="true"
          style={{ width: thumb.w, height: thumb.h, transform: `translate3d(${thumb.x}px, ${thumb.y}px, 0)`, transition: placed.current ? undefined : 'none' }} />
      )}
      {items.map(t => {
        const on = t.id === value;
        return (
          <button key={t.id} ref={el => { btns.current[t.id] = el; }} type="button" className="ui-tab" {...attr(on)}
            tabIndex={mode === 'tabs' && !on ? -1 : 0} onClick={() => onChange(t.id)}
            style={size === 'sm' ? { minHeight: 30, padding: '0 12px', fontSize: 12 } : size === 'lg' ? { minHeight: 40, padding: '0 16px', fontSize: 14 } : undefined}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Smooth open and close without measuring heights. Children stay mounted (state is kept). */
export function Collapse({ open, children, id, style }) {
  return (
    <div id={id} className={`ui-collapse${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open} style={style}>
      <div className="ui-collapse-inner">{children}</div>
    </div>
  );
}

/** Animated circular progress. value 0..1. */
export function ProgressRing({ value = 0, size = 44, stroke = 4, color = 'var(--tab-accent)', track, children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  return (
    <div role={label ? 'img' : undefined} aria-label={label} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ui-ring-track" style={track ? { stroke: track } : undefined} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="ui-ring-value"
          stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      {children != null && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>}
    </div>
  );
}

/** Thin animated bar. value 0..1. Grows from zero on first show. */
export function ProgressBar({ value = 0, color, height = 4, label, style }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, Number(value) || 0)))); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <div className="ui-bar" role={label ? 'progressbar' : undefined} aria-label={label} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round((Number(value) || 0) * 100) : undefined} style={{ height, ...style }}>
      <span style={{ transform: `scaleX(${shown})`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

/**
 * Keep something on screen long enough to play its exit animation.
 * Returns [mounted, leaving]: render while mounted, add the leaving class while leaving.
 */
export function usePresence(open, ms = 240) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); setLeaving(false); return undefined; }
    if (!mounted) return undefined;
    if (prefersReduced()) { setMounted(false); return undefined; }
    setLeaving(true);
    const t = setTimeout(() => { setMounted(false); setLeaving(false); }, ms);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return [mounted, leaving];
}

/**
 * Bottom sheet on the phone, centred dialog on wide screens. Escape, the backdrop or dragging
 * the grip down closes it; focus moves in on open and back to where it was on close.
 */
export function Sheet({ open, onClose, title, children, labelledBy, wide = false }) {
  const [mounted, leaving] = usePresence(open, 240);
  const panel = useRef(null);
  const back = useRef(null);
  const drag = useRef(null);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    back.current = document.activeElement;
    const t = setTimeout(() => panel.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true }), 30);
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); try { back.current?.focus?.({ preventScroll: true }); } catch { /* element gone */ } };
  }, [open, onClose]);

  if (!mounted) return null;
  const start = (e) => { drag.current = e.touches[0].clientY; };
  const move = (e) => { if (drag.current != null) setDy(Math.max(0, e.touches[0].clientY - drag.current)); };
  const end = () => { if (dy > 90) onClose?.(); setDy(0); drag.current = null; };

  return createPortal(
    <>
      <div className={`ui-backdrop${leaving ? ' is-leaving' : ''}`} onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy}
        className={`ui-sheet${wide ? ' is-wide' : ''}${leaving ? ' is-leaving' : ''}`}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none', animation: 'none' } : undefined}>
        <div className="ui-sheet-grip" onTouchStart={start} onTouchMove={move} onTouchEnd={end} aria-hidden="true" style={{ touchAction: 'none', padding: '6px 0' }} />
        {children}
      </div>
    </>,
    document.body,
  );
}

/** Light haptic tap where the platform has one (Android Chrome; iPhone Safari has no vibrate API). */
export function haptic(pattern = 12) {
  try { if (!prefersReduced()) navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

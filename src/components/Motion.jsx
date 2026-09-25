//  VALERIE motion primitives  thin wrappers over the CSS motion system
//  (see globals.css "VALERIE MOTION SYSTEM"). transform/opacity only; all
//  honour prefers-reduced-motion automatically because the CSS does.

import { useState, useEffect, useRef, Children, cloneElement, isValidElement } from 'react';

function prefersReduced() {
  return typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
     document.documentElement.getAttribute('data-reduce-motion') === 'true');
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
      setDisplay(from + (to - from) * eased);
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
  return <div className="val-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

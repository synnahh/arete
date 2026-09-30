// useWidth — the rendered width of an element, kept current with a ResizeObserver.
// Charts draw at this real width so their text stays at its real size instead of
// being scaled up with the window.
import { useEffect, useRef, useState } from 'react';

export function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

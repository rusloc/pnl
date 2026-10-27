import { useEffect, useRef, useState } from 'react';

/** Size of an element in CSS px, tracked with a ResizeObserver (the SVG charts draw at their panel's size). */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) =>
        s.width === Math.floor(width) && s.height === Math.floor(height)
          ? s
          : { width: Math.floor(width), height: Math.floor(height) },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

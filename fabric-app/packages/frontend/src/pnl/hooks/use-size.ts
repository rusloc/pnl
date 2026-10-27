// Content box of an element, kept current with a ResizeObserver; a fixed
// fallback where the observer does not exist (jsdom), so the SVG charts render
// in tests at a known size.
import { useLayoutEffect, useState } from 'react';

export const FALLBACK_SIZE = { width: 640, height: 420 } as const;

export function useSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState<{ width: number; height: number }>(() => (typeof ResizeObserver === 'undefined' ? FALLBACK_SIZE : { width: 0, height: 0 }));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

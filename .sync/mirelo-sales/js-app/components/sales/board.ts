import { useSyncExternalStore } from 'react';

// Board height (2026-11-01, owner: no empty band under the report). The board is 1440 px wide and as tall as the
// page's viewport, never less than the 810 px design height; SalesApp spreads the extra over the chart rows and the
// band tables. vosk.dev does the same inside its host scaler; standalone, the viewport is the iframe the host sizes, so
// a 1440 × 810 frame renders exactly the design board. The server and a first render without a window use 810.

export const DESIGN_H = 810;

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
// clientHeight excludes a horizontal scrollbar (a viewport narrower than the board), so the board never adds a
// vertical one
const viewportHeight = () => Math.max(DESIGN_H, document.documentElement.clientHeight);

export const useBoardHeight = (): number => useSyncExternalStore(subscribe, viewportHeight, () => DESIGN_H);

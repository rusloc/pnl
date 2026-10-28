import { describe, expect, it } from 'vitest';
import { barGeometry } from './bars.ts';

// v5 spark() geometry: 2 px gaps, bottom-aligned bars, padded range, target line, labels every third bar and the last.

describe('barGeometry', () => {
  it('13 bars across the width, the last one current, all on the baseline', () => {
    const g = barGeometry([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 7, 260, 100);
    expect(g.rects).toHaveLength(13);
    expect(g.rects.filter((r) => r.current)).toEqual([g.rects.at(-1)]);
    expect(g.rects.every((r) => Math.abs(r.y + r.h - 100) < 0.11)).toBe(true);
    expect(Math.abs((g.rects.at(-1)?.x ?? 0) + (g.rects.at(-1)?.w ?? 0) - 260)).toBeLessThan(0.11);
    expect(g.targetY).not.toBeNull();
  });

  it('a null value leaves a gap; labels W31, W34, … and the current week', () => {
    const labels = Array.from({ length: 13 }, (_, i) => `W${31 + i}`);
    const g = barGeometry([null, ...Array.from({ length: 12 }, (_, i) => i + 1)], null, 240, 72, labels);
    expect(g.rects).toHaveLength(12);
    expect(g.labels.map((l) => l.text)).toEqual(['W31', 'W34', 'W37', 'W40', 'W43']);
    expect(g.targetY).toBeNull();
  });
});

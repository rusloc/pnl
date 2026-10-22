// Sparkline and target-bar geometry (K-24, K-25).
import { describe, expect, it } from 'vitest';

import { segmentPath, sparklineGeometry, targetBarGeometry } from './trend-geometry';
import type { KpiTrendPoint } from './types';

function series(values: (number | null)[], open: number[] = []): KpiTrendPoint[] {
  return values.map((value, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, value, text: value === null ? '' : String(value), isOpen: open.includes(i) }));
}

describe('sparklineGeometry (K-24)', () => {
  it('spaces 13 months evenly, scales y to the range and marks the selected (last) month', () => {
    const g = sparklineGeometry(series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), 104, 32);
    expect(g.xs).toHaveLength(13);
    expect(g.xs[0]).toBe(3);
    expect(g.xs[12]).toBe(101);
    expect(g.xs[6]).toBeCloseTo(52, 6);
    expect(g.segments).toHaveLength(1);
    expect(g.segments[0]).toHaveLength(13);
    // Max at the top (pad), min at the bottom (height − pad).
    expect(g.segments[0][12].y).toBe(3);
    expect(g.segments[0][0].y).toBe(29);
    expect(g.marker).toEqual({ x: 101, y: 3 });
    expect(g.blanks).toEqual([]);
    expect(g.selectedIndex).toBe(12);
  });

  it('leaves open months blank: the line breaks and the selected month has no marker when it is open', () => {
    const g = sparklineGeometry(series([5, 6, 7, null, 9, 10, 11, 12, 13, 14, 15, 16, 17], [3, 11, 12]), 104, 32);
    expect(g.blanks).toEqual([3, 11, 12]);
    expect(g.segments.map((s) => s.length)).toEqual([3, 7]);
    expect(g.marker).toBeNull();
    // Values of open months do not stretch the scale: y of 15 (index 10) is the top.
    expect(g.segments[1][6].y).toBe(3);
  });

  it('draws a flat series at mid-height and a lone point as a short dash', () => {
    const flat = sparklineGeometry(series([4, 4, 4]), 60, 30);
    expect(flat.segments[0].every((p) => p.y === 15)).toBe(true);
    const lone = sparklineGeometry(series([null, 2, null]), 60, 30);
    expect(lone.segments).toEqual([[{ x: 30, y: 15 }]]);
    expect(segmentPath(lone.segments[0])).toBe('M29.5 15H30.5');
  });

  it('an all-blank series has no segments and no marker', () => {
    const g = sparklineGeometry(series([null, null, null]), 60, 30);
    expect(g.segments).toEqual([]);
    expect(g.marker).toBeNull();
    expect(g.blanks).toEqual([0, 1, 2]);
  });

  it('segmentPath joins a run with M/L and rounds to 2 decimals', () => {
    expect(segmentPath([{ x: 3, y: 29 }, { x: 11.166666, y: 3 }])).toBe('M3 29L11.17 3');
  });
});

describe('targetBarGeometry (K-25)', () => {
  it('scales 0 … max over the width; the base is the bar, the comparisons are ticks in order', () => {
    const g = targetBarGeometry({ base: 80, marks: [{ name: 'Budget', value: 100, text: '100' }, { name: 'Prior year', value: 50, text: '50' }] }, 100, 0);
    expect(g).not.toBeNull();
    expect(g?.zero).toBe(0);
    expect(g?.bar).toEqual({ from: 0, to: 80 });
    expect(g?.ticks).toEqual([
      { name: 'Budget', x: 100, kind: 'a' },
      { name: 'Prior year', x: 50, kind: 'b' },
    ]);
  });

  it('keeps zero on the scale when values are negative: the bar runs left of zero', () => {
    const g = targetBarGeometry({ base: -20, marks: [{ name: 'Budget', value: 60, text: '60' }] }, 80, 0);
    expect(g?.zero).toBe(20);
    expect(g?.bar).toEqual({ from: 0, to: 20 });
    expect(g?.ticks[0].x).toBe(80);
  });

  it('skips blank comparisons, draws no bar for a blank base, and is null with nothing to draw', () => {
    const g = targetBarGeometry({ base: null, marks: [{ name: 'Budget', value: 10, text: '10' }, { name: 'Prior year', value: null, text: '' }] }, 100, 0);
    expect(g?.bar).toBeNull();
    expect(g?.ticks.map((t) => t.name)).toEqual(['Budget']);
    expect(targetBarGeometry({ base: null, marks: [{ name: 'Budget', value: null, text: '' }] }, 100)).toBeNull();
  });

  it('a single zero value does not divide by zero', () => {
    const g = targetBarGeometry({ base: 0, marks: [] }, 100, 1);
    expect(g?.zero).toBe(1);
    expect(g?.bar).toEqual({ from: 1, to: 1 });
  });
});

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

  it('labels counted back from the picked bar: 12 periods every third, 8 quarters every second, 2 years both (E-96)', () => {
    const text = (labels: string[]) =>
      barGeometry(
        labels.map((_, i) => i + 1),
        null,
        240,
        72,
        labels,
      ).labels.map((l) => l.text);
    const p = ['P11', 'P12', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
    expect(text(p)).toEqual(['P1', 'P4', 'P7', 'P10']);
    const q = ['Q1 FY25', 'Q2 FY25', 'Q3 FY25', 'Q4 FY25', 'Q1 FY26', 'Q2 FY26', 'Q3 FY26', 'Q4 FY26'];
    expect(text(q)).toEqual(['Q2 FY25', 'Q4 FY25', 'Q2 FY26', 'Q4 FY26']);
    expect(text(['FY25', 'FY26'])).toEqual(['FY25', 'FY26']);
  });
});

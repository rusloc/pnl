// Comparison bar geometry (docs/design/kpi-card-v2.md; K-20, K-21): direction by
// favourability (Higher / Lower is better / Neutral), one shared scale, the cap,
// and the no-data case.
import { describe, expect, it } from 'vitest';

import { barOnScale, COMPARE_BAR_SCALE, compareBar, favourableSide } from './compare-bar';

describe('favourableSide', () => {
  it('Higher is better: a positive Δ grows right, a negative one left; zero sits right', () => {
    expect(favourableSide(0.02, 'Higher')).toBe(1);
    expect(favourableSide(-0.02, 'Higher')).toBe(-1);
    expect(favourableSide(0, 'Higher')).toBe(1);
  });

  it('Lower is better (gross-to-net, cost ratios): the sides swap', () => {
    expect(favourableSide(0.3, 'Lower')).toBe(-1);
    expect(favourableSide(-2.5, 'Lower')).toBe(1);
    expect(favourableSide(0, 'Lower')).toBe(1);
  });

  it('Neutral KPIs always grow right, by absolute size', () => {
    expect(favourableSide(-2.5, 'Neutral')).toBe(1);
    expect(favourableSide(2.5, 'Neutral')).toBe(1);
  });
});

describe('compareBar', () => {
  it('amount KPIs: Δ as a fraction on the ±20 % scale', () => {
    expect(COMPARE_BAR_SCALE.pct).toBe(0.2);
    expect(compareBar(0.02, false, 'Higher')?.fraction).toBeCloseTo(0.1, 12);
    expect(compareBar(-0.02, false, 'Higher')?.fraction).toBeCloseTo(-0.1, 12);
    expect(compareBar(0.02, false, 'Higher')?.capped).toBe(false);
    expect(compareBar(0.2, false, 'Higher')).toEqual({ fraction: 1, capped: false });
  });

  it('percent KPIs: Δ in pp on the ±5 pp scale', () => {
    expect(COMPARE_BAR_SCALE.pp).toBe(5);
    expect(compareBar(1.25, true, 'Higher')).toEqual({ fraction: 0.25, capped: false });
    expect(compareBar(-5, true, 'Higher')).toEqual({ fraction: -1, capped: false });
  });

  it('caps beyond the scale at the track end, on the side of the Δ', () => {
    expect(compareBar(0.359, false, 'Higher')).toEqual({ fraction: 1, capped: true });
    expect(compareBar(-0.5, false, 'Higher')).toEqual({ fraction: -1, capped: true });
    expect(compareBar(7, true, 'Higher')).toEqual({ fraction: 1, capped: true });
    expect(compareBar(-7, true, 'Lower')).toEqual({ fraction: 1, capped: true });
  });

  it('Lower is better flips the side; Neutral is right by absolute size', () => {
    expect(compareBar(0.3, true, 'Lower')).toEqual({ fraction: -0.06, capped: false });
    expect(compareBar(-2.5, true, 'Lower')).toEqual({ fraction: 0.5, capped: false });
    expect(compareBar(-2.5, true, 'Neutral')).toEqual({ fraction: 0.5, capped: false });
    expect(compareBar(-0.5, false, 'Neutral')).toEqual({ fraction: 1, capped: true });
  });

  it('shares one scale: the same |Δ| is the same length whatever the KPI prefers', () => {
    const sizes = (['Higher', 'Lower', 'Neutral'] as const).map((b) => Math.abs(compareBar(-1.5, true, b)!.fraction));
    expect(sizes).toEqual([0.3, 0.3, 0.3]);
  });

  it('zero Δ is a zero-length bar (never −0), and no Δ is no bar', () => {
    expect(compareBar(0, true, 'Lower')).toEqual({ fraction: 0, capped: false });
    expect(Object.is(compareBar(0, true, 'Lower')!.fraction, 0)).toBe(true);
    expect(compareBar(null, false, 'Higher')).toBeNull();
    expect(compareBar(Number.NaN, false, 'Higher')).toBeNull();
  });

  it('barOnScale takes an explicit side (the sample path reads it from the mockup tone)', () => {
    expect(barOnScale(0.019, false, -1).fraction).toBeCloseTo(-0.095, 12);
    expect(barOnScale(0.019, false, -1).capped).toBe(false);
    expect(barOnScale(0.4, true, 1).fraction).toBeCloseTo(0.08, 12);
  });
});

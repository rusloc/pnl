import { describe, expect, it } from 'vitest';

import { bridgeGeometry } from './bridge-geometry';

describe('bridgeGeometry (C-40, §6.3)', () => {
  it('reproduces the mockup geometry for the Consumer Products bridge', () => {
    const g = bridgeGeometry(
      [
        { label: 'Budget', amount: 3464.8, kind: 'total' },
        { label: 'Volume', amount: -65.0, kind: 'step' },
        { label: 'Price / mix', amount: -30.8, kind: 'step' },
        { label: 'FX translation', amount: 29.5, kind: 'step' },
        { label: 'Actual', amount: 3398.5, kind: 'total' },
      ],
      (v) => String(v)
    );
    expect(g.axis).toBe(3254);
    const [budget, volume, price, fx, actual] = g.steps;
    expect(budget.heightPct).toBeCloseTo(89.8, 1);
    expect(volume).toMatchObject({ kind: 'unf' });
    expect(volume.bottomPct).toBeCloseTo(62.11, 1);
    expect(volume.heightPct).toBeCloseTo(27.68, 1);
    expect(price.bottomPct).toBeCloseTo(48.98, 1);
    expect(fx).toMatchObject({ kind: 'fav' });
    expect(fx.heightPct).toBeCloseTo(12.58, 1);
    expect(actual.heightPct).toBeCloseTo(61.56, 1);
  });

  it('adds up: comparison + steps = base (T-05) is the caller’s job, but totals bottom out at the axis', () => {
    const g = bridgeGeometry(
      [
        { label: 'Budget', amount: 100, kind: 'total' },
        { label: 'Step', amount: 10, kind: 'step' },
        { label: 'Actual', amount: 110, kind: 'total' },
      ],
      (v) => String(v)
    );
    expect(g.steps[0].bottomPct).toBe(0);
    expect(g.steps[2].bottomPct).toBe(0);
    expect(g.steps[2].heightPct).toBeGreaterThan(g.steps[0].heightPct);
  });
});

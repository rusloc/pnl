import { describe, expect, it } from 'vitest';
import { withinTolerance } from '../../scripts/control-totals.ts';
import { engineControlRows } from '../test-utils/control-engine.ts';
import { controlTotals, loadDataset } from '../test-utils/marketing-data.ts';

// AT-01 (contract §7.1): every row of checks/control_totals_usd.csv reproduced by the engine within verify.py's
// tolerance, both ways — every CSV row has an engine value and the engine emits nothing the CSV lacks (n/a matches).
// The 32 CR: creative rows are the build's (§2.4) and are excluded here, exactly those.

describe('control totals (AT-01)', async () => {
  const ds = await loadDataset();
  const csv = controlTotals();
  const engine = engineControlRows(ds);
  const rows = csv.filter((r) => !r.scope.startsWith('CR:'));

  it('excludes exactly the 32 CR: creative rows', () => {
    expect(csv.length - rows.length).toBe(32);
    expect(rows.length).toBe(28_628);
  });

  it('every CSV row has an engine value within tolerance', () => {
    const miss: string[] = [];
    const bad: string[] = [];
    for (const r of rows) {
      const v = engine.get(`${r.scope}|${r.periodKey}|${r.metric}`);
      if (v === undefined) miss.push(`${r.scope} ${r.periodKey} ${r.metric}`);
      else if (!withinTolerance(r.metric, r.value, v))
        bad.push(`${r.scope} ${r.periodKey} ${r.metric}: ${v} vs ${r.value}`);
    }
    expect({ missing: miss.length, bad: bad.length, sample: [...miss.slice(0, 10), ...bad.slice(0, 10)] }).toEqual({
      missing: 0,
      bad: 0,
      sample: [],
    });
  });

  it('the engine emits no row the CSV lacks', () => {
    const have = new Set(rows.map((r) => `${r.scope}|${r.periodKey}|${r.metric}`));
    const extra = [...engine.keys()].filter((k) => !have.has(k));
    expect({ extra: extra.length, sample: extra.slice(0, 10) }).toEqual({ extra: 0, sample: [] });
  });
});

describe('control totals: anchors (AT-02 spot checks)', async () => {
  const engine = engineControlRows(await loadDataset());
  const W = 'R30-2026-11-03';
  it('reads the story values', () => {
    expect(engine.get(`ALL|${W}|spend`)).toBeCloseTo(188_400, 2);
    expect(engine.get(`ALL|${W}|blended_cac`)).toBeCloseTo(530.66, 2);
    expect(engine.get(`CP:SOC_META_LAL2|${W}|roas_delta`)).toBeCloseTo(-0.41, 2);
    expect(engine.get(`ALL|${W}|alerts_tripped`)).toBe(5);
    expect(engine.get('CP:SOC_META_LAL2|C-2025-11|payback_month')).toBe(9);
  });
});

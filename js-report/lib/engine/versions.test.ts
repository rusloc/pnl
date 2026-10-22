import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '../data/dataset.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { createEngine } from './index.ts';
import type { Engine } from './index.ts';
import { versionPlan } from './versions.ts';

// Spec §7 Versions on the dummy data: last close Sep 2026 (month index 32); FC2609 covers Oct–Dec 2026.
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

let ds: Dataset;
let engine: Engine;
beforeAll(async () => {
  ds = await loadPublicDataset(['P', 'S']);
  engine = createEngine(ds);
});

const nr = (rows: { code: string; base: number | null }[]) => rows.find((r) => r.code === 'NR')?.base;

describe('T-11 Actual base with a window past the last close', () => {
  it('drops the open months (C-01) and comparisons use exactly the remaining months (C-03)', () => {
    const plan = versionPlan(ds.manifest, selection({ timeView: 'FY', month: 12 }));
    expect(plan.window).toEqual(range(24, 35));
    expect(plan.months).toEqual(range(24, 32));
    expect(plan.droppedMonths).toEqual([33, 34, 35]); // the C-50 notice condition
    expect(plan.base.parts).toEqual([{ version: 'ACT', months: range(24, 32) }]);
    expect(plan.compareA?.parts).toEqual([{ version: 'BUD', months: range(24, 32) }]);
    expect(plan.compareB?.parts).toEqual([{ version: 'ACT', months: range(12, 20) }]);
  });

  it('FY2026 Actual equals YTD Sep, base and comparisons alike', () => {
    const fy = engine.statement(selection({ timeView: 'FY', month: 12 })).rows;
    const ytd = engine.statement(selection()).rows;
    for (const [i, r] of fy.entries()) {
      expect(r.base).toBe(ytd[i]?.base);
      expect(r.compareA?.value).toBe(ytd[i]?.compareA?.value);
      expect(r.compareB?.value).toBe(ytd[i]?.compareB?.value);
    }
  });

  it('full-year outlook columns keep the whole year (M-14)', () => {
    const plan = versionPlan(ds.manifest, selection());
    expect(plan.fyBudget.parts).toEqual([{ version: 'BUD', months: range(24, 35) }]);
    expect(plan.fyLE.parts).toEqual([
      { version: 'ACT', months: range(24, 32) },
      { version: 'FC2609', months: [33, 34, 35] },
    ]);
  });
});

describe('T-12 prior year for the first year of data', () => {
  it('has no prior-year months: the column is n/a on every row', () => {
    const sel = selection({ fy: 2024, timeView: 'FY', month: 12 });
    const plan = versionPlan(ds.manifest, sel);
    expect(plan.compareB?.parts).toEqual([]);
    expect(plan.compareB?.missingMonths).toEqual(range(0, 11)); // the C-50 notice condition
    for (const r of engine.statement(sel).rows) {
      expect(r.compareB).not.toBeNull(); // the column is on …
      expect(r.compareB?.value).toBeNull(); // … and reads "n/a"
      expect(r.compareB?.delta).toBeNull();
      expect(r.compareB?.favourable).toBeNull();
    }
  });

  it('a window partly before the history keeps the months it has and lists the missing ones (C-04)', () => {
    const plan = versionPlan(ds.manifest, selection({ fy: 2025, month: 9, timeView: 'LTM' }));
    expect(plan.months).toEqual(range(9, 20));
    expect(plan.compareB?.parts).toEqual([{ version: 'ACT', months: range(0, 8) }]);
    expect(plan.compareB?.missingMonths).toEqual([9, 10, 11]);
  });

  it('counts LTM months before the data history (C-50)', () => {
    const plan = versionPlan(ds.manifest, selection({ fy: 2024, month: 3, timeView: 'LTM' }));
    expect(plan.months).toEqual([0, 1, 2]);
    expect(plan.monthsBeforeHistory).toBe(9);
  });
});

describe('C-02 latest estimate and C-05 budget', () => {
  it('Latest estimate = Actual for closed months + the latest forecast for open months', () => {
    const plan = versionPlan(ds.manifest, selection({ base: 'LE', timeView: 'FY', month: 12 }));
    expect(plan.months).toEqual(range(24, 35));
    expect(plan.droppedMonths).toEqual([]);
    expect(plan.base.forecastMonths).toEqual([33, 34, 35]);
    expect(plan.base.missingMonths).toEqual([]);
  });

  it('LE before the last close is plain Actual', () => {
    const le = engine.statement(selection({ base: 'LE' })).rows;
    const act = engine.statement(selection()).rows;
    expect(nr(le)).toBe(nr(act));
  });

  it('Budget base covers every window month, open or closed', () => {
    const plan = versionPlan(ds.manifest, selection({ base: 'B', timeView: 'FY', month: 12 }));
    expect(plan.base.parts).toEqual([{ version: 'BUD', months: range(24, 35) }]);
  });
});

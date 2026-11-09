import { beforeAll, describe, expect, it } from 'vitest';
import { loadDataset } from '../test-utils/trucks-data.ts';
import type { Dataset, TimeTable } from './data.ts';
import { NC, colOf } from './hours.ts';
import { TIME_SORTS } from '../data/manifest.ts';
import { ppText, pillText, roundDecimal, signedInteger, tablePct, tilePct, integer, roundValue } from './format.ts';
import { loaderList, loaderMask, officeList } from './scope.ts';
import { RESET_SELECTION } from './selection.ts';
import type { Selection } from './selection.ts';
import { ratio, sideShares } from './shares.ts';
import type { Scope } from './shares.ts';
import { board, chips, headerContext } from './view.ts';
import { computeKpis } from './kpi.ts';

// Contract §7.1 "additional tests": the blank table, R5 on a synthetic loader-week, R7, R8, chip and header texts,
// the recompute budget.

let ds: Dataset;
beforeAll(async () => {
  ds = await loadDataset();
});

const weekOf = (label: string) => ds.m.weeks.find((w) => w.week_label === label)?.week_ix ?? -1;
const sel = (o: Partial<Selection> = {}): Selection => ({ ...RESET_SELECTION, ...o });
const scope = (o: Partial<Selection> = {}): Scope => {
  const s = sel(o);
  return { mask: loaderMask(ds, s), week: s.week, planType: s.planType, calculation: s.calculation };
};
const row = (rows: ReturnType<typeof sideShares>, sort: number) => rows.find((r) => r.sort === sort);

describe('ratio (§3.3 blank arithmetic; BLANK / number is BLANK, per the pinned rows)', () => {
  it('the four cases', () => {
    expect(ratio(Number.NaN, Number.NaN)).toBeNaN();
    expect(ratio(Number.NaN, 5)).toBeNaN();
    expect(ratio(5, Number.NaN)).toBe(Number.POSITIVE_INFINITY);
    expect(ratio(5, 10)).toBe(0.5);
  });
});

function synthetic(activeWithoutHours: boolean): Dataset {
  // two loaders, vol 10 and 30; loader 1 has rows but no hour column in the plan table when activeWithoutHours
  const empty = () => new Float64Array(2).fill(Number.NaN);
  const cols = TIME_SORTS.map(empty);
  const c1 = cols[colOf(1)] as Float64Array;
  const c2 = cols[colOf(2)] as Float64Array;
  c1[0] = 100;
  c2[0] = 20;
  if (!activeWithoutHours) {
    c1[1] = 100;
    c2[1] = 40;
  }
  const t: TimeTable = {
    id: 'planMonth',
    rows: 2,
    loader: Int32Array.from([0, 1]),
    week: Int32Array.from([0, 0]),
    nRows: Int32Array.from([3, 2]),
    cols,
  };
  return {
    ...ds,
    nLoaders: 2,
    vol: Float64Array.from([10, 30]),
    planMonth: t,
    time: { ...t, id: 'fact' },
    planWeek: null,
    windows: new Map(),
  };
}

describe('R5: active without hours dilutes the weighted means', () => {
  it('loss diluted toward 0, subtotal toward 1, chain holds', () => {
    const d = synthetic(true);
    const rows = sideShares(d, { mask: [0, 1], week: 0, planType: 'Month', calculation: 'Weighted' }, 'plan');
    // loader 0: 20/100 = .2; loader 1 null, but its vol 30 stays in the denominator
    expect(row(rows, 2)?.share).toBeCloseTo((10 * 0.2) / 40, 12);
    // subtotal 6: loader 0: 1 − .2 = .8, loader 1: 1 − null = 1 → (8 + 30) / 40
    expect(row(rows, 6)?.share).toBeCloseTo((10 * 0.8 + 30 * 1) / 40, 12);
    expect((row(rows, 6)?.share ?? 0) + (row(rows, 2)?.share ?? 0)).toBeCloseTo(1, 12);
  });
  it('without the empty loader the same row is the plain weighted mean', () => {
    const d = synthetic(false);
    const rows = sideShares(d, { mask: [0, 1], week: 0, planType: 'Month', calculation: 'Weighted' }, 'plan');
    expect(row(rows, 2)?.share).toBeCloseTo((10 * 0.2 + 30 * 0.4) / 40, 12);
  });
});

describe('R7: the Month plan before 2023', () => {
  it('week 44: plan shares blank or zero, tiles as §3.5', () => {
    const s = scope({ week: weekOf('44 (29.10-4.11)') });
    const plan = sideShares(ds, s, 'plan');
    const fact = sideShares(ds, s, 'fact');
    expect(row(plan, 2)?.share).toBeNull();
    expect(row(plan, 27)?.share).toBe(0);
    const k = computeKpis(ds, s, plan, fact);
    expect(k.truckLoading.plan).toBe(0);
    expect(k.truckLoading.delta).toBeCloseTo((k.truckLoading.fact as number) * 100, 9);
    expect(k.mass.plan).toBe(0);
    expect(k.performance.plan).toBeNull();
    expect(k.performance.delta).toBeNull();
    const view = board(ds, sel({ week: weekOf('44 (29.10-4.11)') }));
    expect(view.rows.every((r) => r.planText === '–')).toBe(true);
    expect(view.tiles[0]?.plan).toBe('0.0%');
    expect(view.tiles[2]?.plan).toBe('–');
    expect(view.tiles[2]?.delta).toBe('');
    expect(view.tiles[3]?.plan).toBe('0');
  });
});

describe('R8: empty mask', () => {
  it('table all dashes, neutral pills, tiles 1-2 zero, tiles 3-4 dash + empty pill', () => {
    const view = board(
      ds,
      sel({ offices: ['K1'], loaders: [ds.m.loaders.find((l) => l.office_name !== 'K1')?.loader_name ?? ''] }),
    );
    expect(view.rows.every((r) => r.planText === '–' && r.factText === '–' && r.pill === '0.00')).toBe(true);
    expect(view.rows.every((r) => r.planBar.width === 2 && r.factBar.width === 2)).toBe(true);
    expect(view.tiles[0]).toMatchObject({ plan: '0.0%', fact: '0.0%', delta: '0.00 pp', tone: 'neutral' });
    expect(view.tiles[2]).toMatchObject({ plan: '–', fact: '–', delta: '', tone: 'neutral' });
    expect(view.tiles[3]).toMatchObject({ plan: '–', fact: '–', delta: '' });
  });
});

describe('chips and headers (§3.6)', () => {
  it('Reset chips', () => {
    expect(chips(ds, sel()).map((c) => c.value)).toEqual([
      'All',
      'All',
      'Month',
      'Weighted',
      'On spot, Trucks',
      'All (130)',
    ]);
  });
  it('chip values follow the picks; work type all three → All', () => {
    const s = sel({
      week: weekOf('9 (25.2-3.3)'),
      offices: ['K1'],
      loaders: ['LDR-12-09', 'LDR-12-12'],
      workTypes: ['On spot', 'Trucks', 'Undefined'],
    });
    expect(chips(ds, s).map((c) => c.value)).toEqual(['9 (25.2-3.3)', 'K1', 'Month', 'Weighted', 'All', '2 selected']);
  });
  it('header strings', () => {
    expect(headerContext(ds.m.weeks, null, 'Weighted', 'Month')).toBe(
      'Weeks 44 (2022) – 14 (2023)  ·  Weighted calculation  ·  Month plan',
    );
    expect(headerContext(ds.m.weeks, weekOf('9 (25.2-3.3)'), 'Linear', 'Week')).toBe(
      'Week 9 (2023)  ·  Linear calculation  ·  Week plan',
    );
  });
  it('lists cross-filter inside dim_loader', () => {
    const k3 = sel({ offices: ['K3'] });
    expect(loaderList(ds, k3).length).toBeLessThan(loaderList(ds, sel()).length);
    expect(officeList(ds, { ...k3, loaders: ['LDR-12-09'], offices: [] })).toEqual(['K1']);
  });
});

describe('format (§3.5)', () => {
  it('rounds half away from zero on the decimal string', () => {
    expect(roundDecimal(1.005, 2)).toBe('1.01');
    expect(roundDecimal(0.125, 2)).toBe('0.13');
    expect(roundDecimal(2.675, 2)).toBe('2.68');
    expect(roundValue(-1.005, 2)).toBe(-1.01);
  });
  it('table shares, signs and neutral bands', () => {
    expect(tablePct(null)).toBe('–');
    expect(tablePct(0)).toBe('–');
    expect(tablePct(0.1234)).toBe('12.34%');
    expect(tilePct(0.42925)).toBe('42.9%');
    expect(ppText(2.4238)).toBe('+2.42 pp');
    expect(ppText(-2.1254)).toBe('−2.13 pp');
    expect(ppText(0)).toBe('0.00 pp');
    expect(pillText(0.004)).toBe('0.00');
    expect(pillText(-3.33)).toBe('−3.33');
    expect(integer(7155.96)).toBe('7,156');
    expect(signedInteger(-127.157)).toBe('−127');
    expect(signedInteger(null)).toBe('');
    expect(integer(null)).toBe('–');
  });
});

describe('budgets (§1)', () => {
  it('a full recompute stays under 50 ms on the shipped data', () => {
    const fresh = { ...ds, windows: new Map() };
    const t0 = performance.now();
    board(fresh, sel());
    board(fresh, sel({ week: 3, calculation: 'Linear' }));
    expect(performance.now() - t0).toBeLessThan(50);
    expect(NC).toBe(19);
  });
});

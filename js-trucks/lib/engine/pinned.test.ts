import { beforeAll, describe, expect, it } from 'vitest';
import { hasUnfiltered, loadDataset, loadUnfiltered, pinnedRows } from '../test-utils/trucks-data.ts';
import type { PinnedRow } from '../test-utils/trucks-data.ts';
import type { UnfilteredManifest, WorkType } from '../data/manifest.ts';
import type { Dataset } from './data.ts';
import { colOf, hoursUnder, maskSum, planTable, windowSums } from './hours.ts';
import { computeKpis } from './kpi.ts';
import { loaderMask } from './scope.ts';
import { RESET_SELECTION } from './selection.ts';
import { sideShares } from './shares.ts';
import type { RowShares, Scope } from './shares.ts';
import { headerContext } from './view.ts';
import { PILL_FILL, timeShareDelta, toneOf } from './waterfall.ts';
import { isSubtotal } from './hours.ts';
import { roundValue } from './format.ts';

// Contract §7.1 (the fixture trucks-pinned.csv is hunter's, extracted once from the DAX tests): every captured + derived
// row, relative tol × max(1, |expected|), and null exactly where the CSV says BLANK (). Contexts the shipped set cannot
// answer (no fixed filters) run on the unfiltered fixture set. `model_total` needs Plan type and Calculation unselected,
// a state the page never reaches: its values are the DAX fall-throughs, asserted at engine level here.

type Value = number | string | null;
interface Context {
  ds: Dataset;
  scope: Scope;
  /** No category and no slicer on Calculation (kpi_total, model_total). */
  noCalculation?: boolean;
}

let shipped: Dataset;
let unfiltered: { ds: Dataset; m: UnfilteredManifest };

const weekIx = (ds: Dataset, label: string): number => {
  const w = ds.m.weeks.find((x) => x.week_label === label);
  if (!w) throw new Error(`no week ${label}`);
  return w.week_ix;
};
const resetScope = (ds: Dataset, week: number | null = null): Scope => ({
  mask: loaderMask(ds, RESET_SELECTION),
  week,
  planType: 'Month',
  calculation: 'Weighted',
});
const allLoaders = (ds: Dataset) => Array.from({ length: ds.nLoaders }, (_, i) => i);

function contextOf(name: string): Context {
  switch (name) {
    case 'PT-01:reset':
      return { ds: shipped, scope: resetScope(shipped) };
    case 'PT-02:week9':
      return { ds: shipped, scope: resetScope(shipped, weekIx(shipped, '9 (25.2-3.3)')) };
    case 'PT-03:week10':
      return { ds: shipped, scope: resetScope(shipped, weekIx(shipped, '10 (4.3-10.3)')) };
    case 'PT-06:waterfall_switches':
    case 'PT-06:kpi_switches':
      return { ds: unfiltered.ds, scope: { ...resetScope(unfiltered.ds), mask: allLoaders(unfiltered.ds) } };
    case 'PT-06:kpi_total':
      return {
        ds: unfiltered.ds,
        scope: { ...resetScope(unfiltered.ds), mask: allLoaders(unfiltered.ds) },
        noCalculation: true,
      };
    default:
      throw new Error(`unknown context ${name}`);
  }
}

function rowOf(rows: readonly RowShares[], sort: number): RowShares {
  const r = rows.find((x) => x.sort === sort);
  if (!r) throw new Error(`no row ${sort}`);
  return r;
}

function chainResidual(rows: readonly RowShares[], sort: number): number {
  let level = rowOf(rows, 1).subtotal ?? 0;
  for (const r of rows) {
    if (r.sort === 1) continue;
    const sub = isSubtotal(r.sort);
    const residual = sub ? (r.subtotal ?? 0) - level : (r.base ?? 0) + (r.loss ?? 0) - level;
    if (r.sort === sort) return residual;
    level = sub ? (r.subtotal ?? 0) : (r.base ?? 0);
  }
  throw new Error(`no chain row ${sort}`);
}

function actual(row: PinnedRow, ctx: Context): Value {
  const { ds, scope } = ctx;
  const plan = sideShares(ds, scope, 'plan');
  const fact = sideShares(ds, scope, 'fact');
  const k = computeKpis(ds, scope, plan, fact);
  const coalesce0 = (v: number | null) => v ?? 0;
  const delta = (s: number) => timeShareDelta(rowOf(fact, s).share, rowOf(plan, s).share);
  const c = (s: number) => colOf(s);
  switch (row.measure) {
    case 'WF Plan %':
      return coalesce0(rowOf(plan, need(row)).share);
    case 'WF Fact %':
      return coalesce0(rowOf(fact, need(row)).share);
    case 'Time Share Plan %':
      return rowOf(plan, need(row)).share;
    case 'Time Share Fact %':
      return rowOf(fact, need(row)).share;
    case 'Time Share Δ':
      return delta(need(row));
    case '_WF Plan Base':
      return rowOf(plan, need(row)).base;
    case '_WF Plan Loss':
      return rowOf(plan, need(row)).loss;
    case '_WF Plan Subtotal':
      return rowOf(plan, need(row)).subtotal;
    case '_WF Fact Base':
      return rowOf(fact, need(row)).base;
    case '_WF Fact Loss':
      return rowOf(fact, need(row)).loss;
    case '_WF Fact Subtotal':
      return rowOf(fact, need(row)).subtotal;
    case '_Plan Hours':
      return blank(
        hoursUnder(
          ds,
          windowSums(ds, planTable(ds, scope.planType), scope.week),
          scope.mask,
          c(need(row)),
          scope.calculation,
          1,
        ),
      );
    case '_Fact Hours':
      return blank(
        hoursUnder(ds, windowSums(ds, ds.time, scope.week), scope.mask, c(need(row)), scope.calculation, 3600),
      );
    case '_Fact Hours Linear':
      return blank(maskSum(windowSums(ds, ds.time, scope.week), scope.mask, c(need(row))) / 3600);
    case '_Zero':
      return 0;
    case 'chain residual plan':
      return chainResidual(plan, need(row));
    case 'chain residual fact':
      return chainResidual(fact, need(row));
    case 'WF Δ pp':
      return roundValue((delta(need(row)) ?? 0) * 100, 2);
    case 'WF Δ Pill fill':
      return PILL_FILL[toneOf((delta(need(row)) ?? 0) * 100, isSubtotal(need(row)))];
    case 'KPI Truck Loading Plan %':
      return k.truckLoading.plan;
    case 'KPI Truck Loading Fact %':
      return k.truckLoading.fact;
    case 'KPI Truck Loading Δ pp':
      return k.truckLoading.delta;
    case 'KPI Effective Work Plan %':
      return k.effectiveWork.plan;
    case 'KPI Effective Work Fact %':
      return k.effectiveWork.fact;
    case 'KPI Effective Work Δ pp':
      return k.effectiveWork.delta;
    case 'Performance per Truck Plan':
      return ctx.noCalculation ? null : k.performance.plan;
    case 'Performance per Truck Fact':
      return ctx.noCalculation ? null : k.performance.fact;
    case 'KPI Performance per Truck Δ':
      return k.performance.delta;
    case 'KPI Performance per Truck Δ - (Fact - Plan)':
      return (k.performance.delta ?? 0) - ((k.performance.fact ?? 0) - (k.performance.plan ?? 0));
    case 'Rock Mass by Truck Plan':
      return k.mass.plan;
    case 'Rock Mass by Truck Fact':
      return k.mass.fact;
    case 'KPI Rock Mass by Truck Δ':
      return k.mass.delta;
    case 'KPI Rock Mass by Truck Δ - (Fact - Plan)':
      return (k.mass.delta ?? 0) - ((k.mass.fact ?? 0) - (k.mass.plan ?? 0));
    case '_Header Context':
      return headerContext(ds.m.weeks, scope.week === null ? null : scope.week, scope.calculation, scope.planType);
    default:
      throw new Error(`unmapped measure "${row.measure}" in ${row.context}`);
  }
}

const need = (row: PinnedRow): number => {
  if (row.sort === null) throw new Error(`${row.measure} needs a category`);
  return row.sort;
};
const blank = (v: number) => (Number.isNaN(v) ? null : v);

function compare(row: PinnedRow, got: Value): string | null {
  const label = `${row.context}|${row.sort ?? ''}|${row.measure} (${row.source})`;
  if (row.expected === 'BLANK ()') return got === null ? null : `${label}: expected BLANK, got ${String(got)}`;
  if (row.tol === 'exact')
    return String(got) === row.expected ? null : `${label}: expected ${row.expected}, got ${String(got)}`;
  if (typeof got !== 'number') return `${label}: expected ${row.expected}, got ${String(got)}`;
  const want = Number(row.expected);
  const tol = Number(row.tol) * Math.max(1, Math.abs(want));
  return Math.abs(got - want) <= tol ? null : `${label}: expected ${want}, got ${got}`;
}

const ROWS = pinnedRows();

describe('pinned values (contract §7.1)', () => {
  beforeAll(async () => {
    shipped = await loadDataset();
    if (hasUnfiltered()) unfiltered = await loadUnfiltered();
  });

  it.skipIf(!hasUnfiltered())('the fixture set is present', () => {
    expect(unfiltered.m.loaders.length).toBe(169);
  });

  it('every captured + derived row reproduces', () => {
    const gaps: string[] = [];
    let run = 0;
    for (const row of ROWS) {
      if (row.context === 'PT-01:reset.unfiltered' || row.context === 'PT-06:model_total') continue;
      if (!hasUnfiltered() && row.context.startsWith('PT-06')) continue;
      run += 1;
      const gap = compare(row, actual(row, contextOf(row.context)));
      if (gap) gaps.push(gap);
    }
    expect(gaps.slice(0, 40)).toEqual([]);
    expect(run).toBeGreaterThan(hasUnfiltered() ? 900 : 650); // the PT-06 contexts need the fixture set, absent in a pack
  });

  it.skipIf(!hasUnfiltered())('tab 7: the contractor filter changes no KPI under Trucks + On spot', () => {
    const { ds, m } = unfiltered;
    const included = allLoaders(ds).filter((i) => {
      const l = m.loaders[i];
      return l?.is_included && l.work_type !== null && (['Trucks', 'On spot'] as WorkType[]).includes(l.work_type);
    });
    const contractors = included.filter((i) => m.loaders[i]?.contractor_blank === false);
    const scopeOf = (mask: number[]): Scope => ({ mask, week: null, planType: 'Month', calculation: 'Weighted' });
    const kpiOf = (mask: number[]) => {
      const scope = scopeOf(mask);
      return computeKpis(ds, scope, sideShares(ds, scope, 'plan'), sideShares(ds, scope, 'fact'));
    };
    const blankOnly = included.filter((i) => m.loaders[i]?.contractor_blank);
    const a = kpiOf(included);
    const b = kpiOf(blankOnly);
    expect(new Set(m.loaders.filter((l) => !l.is_blank_member).map((l) => l.contractor_blank)).size).toBe(2);
    expect(contractors).toHaveLength(0);
    expect(b.truckLoading.fact).toBeCloseTo(a.truckLoading.fact as number, 12);
    expect(b.mass.fact).toBeCloseTo(a.mass.fact as number, 6);
  });

  it.skipIf(!hasUnfiltered())(
    'model_total: no slicer on Plan type or Calculation (engine level, DAX fall-through)',
    () => {
      const rows = ROWS.filter((r) => r.context === 'PT-06:model_total');
      expect(rows.length).toBe(13);
      const allSec = unfiltered.m.meta.fact_duration_sec_all;
      const fallThrough: Record<string, Value> = {
        '_WF Plan Subtotal': 0, // SWITCH default 0
        '_WF Plan Base': 0,
        '_WF Plan Loss': 0,
        '_WF Fact Subtotal': 0,
        '_WF Fact Base': null, // SWITCH default BLANK
        '_WF Fact Loss': null,
        'Time Share Plan %': 0,
        'Time Share Fact %': 0,
        'Time Share Δ': 0,
        '_Plan Hours': null, // HASONEVALUE false
        '_Fact Hours': null,
        '_Fact Hours Linear': allSec / 3600, // SUM(duration) with no category: every source row, mapped or not
        _Zero: 0,
      };
      const gaps = rows.map((r) => compare(r, fallThrough[r.measure] ?? null)).filter((g) => g !== null);
      expect(gaps).toEqual([]);
    },
  );
});

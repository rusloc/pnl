import type { Dataset } from './data.ts';
import { colOf, divide, hoursUnder, maskSum, nullOf, planTable, rockSum, windowSums } from './hours.ts';
import type { RowShares, Scope } from './shares.ts';

// The four KPI tiles (contract §3.4, R6). Tiles 1–2 are the waterfall rows 27 / 24. Tile 3 is NOT those rows: Performance
// = rock ÷ (Linear total hours × a truck-loading share under the chosen calculation, with no `active` filter) × 1000.

export interface Tile {
  plan: number | null;
  fact: number | null;
  /** fact − plan (× 100 for the share tiles), null when either side is null. */
  delta: number | null;
}

export interface Kpis {
  truckLoading: Tile;
  effectiveWork: Tile;
  performance: Tile;
  mass: Tile;
}

const delta = (plan: number | null, fact: number | null, unit: number) =>
  plan !== null && fact !== null ? (fact - plan) * unit : null;
const tile = (plan: number | null, fact: number | null, unit = 1): Tile => ({
  plan,
  fact,
  delta: delta(plan, fact, unit),
});

const shareOf = (rows: readonly RowShares[], sort: number) => rows.find((r) => r.sort === sort)?.share ?? null;

const C27 = colOf(27);
const C1 = colOf(1);

export function computeKpis(ds: Dataset, scope: Scope, plan: readonly RowShares[], fact: readonly RowShares[]): Kpis {
  const planW = windowSums(ds, planTable(ds, scope.planType), scope.week);
  const factW = windowSums(ds, ds.time, scope.week);
  const { mask, week, calculation } = scope;

  const loadingHours = (w: typeof planW, divisor: number) => {
    const total = maskSum(w, mask, C1) / divisor;
    const share = divide(
      hoursUnder(ds, w, mask, C27, calculation, divisor),
      hoursUnder(ds, w, mask, C1, calculation, divisor),
    );
    return total * share; // NaN (BLANK) when either side is blank
  };

  const rockPlan = rockSum(ds.rock, scope.planType === 'Week' ? ds.rock.plan : ds.rock.planMonth, week, mask);
  const rockFact = rockSum(ds.rock, ds.rock.fact, week, mask);
  const perfPlan = divide(rockPlan, loadingHours(planW, 1)) * 1000;
  const perfFact = divide(rockFact, loadingHours(factW, 3600)) * 1000;

  return {
    truckLoading: tile(shareOf(plan, 27), shareOf(fact, 27), 100),
    effectiveWork: tile(shareOf(plan, 24), shareOf(fact, 24), 100),
    performance: tile(nullOf(perfPlan), nullOf(perfFact)),
    mass: tile(nullOf(rockPlan), nullOf(rockFact)),
  };
}

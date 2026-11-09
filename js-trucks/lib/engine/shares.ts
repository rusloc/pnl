import { TIME_SORTS } from '../data/manifest.ts';
import type { Dataset } from './data.ts';
import {
  NC,
  colOf,
  cumulativeList,
  divide,
  isSubtotal,
  maskSum,
  nanSum,
  nullOf,
  planTable,
  subtotalList,
  windowSums,
} from './hours.ts';
import type { WindowSums } from './hours.ts';
import type { Calculation, PlanType } from './selection.ts';

// The two calculations of the waterfall (contract §3.3, mirrored from the TMDL, which wins where the contract
// simplifies). Linear is a ratio of sums over the masked loaders; Weighted a bucket-volume-weighted mean of per-loader
// ratios over the ACTIVE loaders (any source row in the window, mapped or not: R5). DAX blank arithmetic is NaN here and
// null at the public surface.

export type Side = 'fact' | 'plan';

export interface Scope {
  mask: readonly number[];
  week: number | null;
  planType: PlanType;
  calculation: Calculation;
}

export interface RowShares {
  sort: number;
  /** `Time Share Plan %` / `Time Share Fact %` for this row. */
  share: number | null;
  /** `_WF * Subtotal`: the DAX branch per calculation; BLANK on loss rows except the plan Linear branch (0). */
  subtotal: number | null;
  /** `_WF * Loss`: 0 on subtotal rows, except the fact Weighted Total-time row, which has no 0 branch (= 1). */
  loss: number | null;
  /** `_WF * Base`: where the floating loss bar starts. */
  base: number | null;
}

const T_COL = colOf(1);

/** ratio(h, T) of §3.3 in DAX blank arithmetic: BLANK / anything = BLANK (the pinned rows of sort 22 settle it against
 *  the contract's "h null & T number → 0"); `h / 0` keeps DAX's h / BLANK (+∞, NaN for 0 / BLANK). */
export function ratio(h: number, t: number): number {
  if (Number.isNaN(h)) return Number.NaN;
  return Number.isNaN(t) ? h / 0 : h / t;
}

function listSum(w: WindowSums, l: number, list: readonly number[]): number {
  let s = Number.NaN;
  for (const c of list) {
    const v = w.h[l * NC + c] as number;
    if (!Number.isNaN(v)) s = Number.isNaN(s) ? v : s + v;
  }
  return s;
}

export function sideShares(ds: Dataset, scope: Scope, side: Side): RowShares[] {
  const w = windowSums(ds, side === 'fact' ? ds.time : planTable(ds, scope.planType), scope.week);
  const M = scope.mask;
  const A = M.filter((l) => (w.rows[l] as number) > 0);
  const weighted = scope.calculation === 'Weighted';
  const isFact = side === 'fact';

  const T = (l: number) => w.h[l * NC + T_COL] as number;
  const sumT = (set: readonly number[]) => nanSum(set.map(T));
  const sumList = (set: readonly number[], list: readonly number[]) => nanSum(set.map((l) => listSum(w, l, list)));
  const mean = (p: (l: number) => number) => {
    let top = Number.NaN;
    let bottom = Number.NaN;
    for (const l of A) {
      const vol = ds.vol[l] as number;
      if (Number.isNaN(vol)) continue;
      bottom = Number.isNaN(bottom) ? vol : bottom + vol;
      const v = vol * p(l);
      if (!Number.isNaN(v)) top = Number.isNaN(top) ? v : top + v;
    }
    return divide(top, bottom);
  };
  // `1 − ([@hours] / [@totalHours])`: 1 − null = 1
  const oneMinus = (r: number) => (Number.isNaN(r) ? 1 : 1 - r);

  const totalM = sumT(M);
  const totalA = sumT(A);

  const lossValue = (c: number) =>
    weighted ? mean((l) => ratio(w.h[l * NC + c] as number, T(l))) : divide(maskSum(w, M, c), totalM);

  const subtotalValue = (sort: number) => {
    const list = subtotalList(sort);
    if (!weighted) {
      const part = divide(sumList(M, list), totalM);
      if (isFact) return Number.isNaN(totalM) ? 0 : oneMinus(part);
      return 1 - (Number.isNaN(part) ? 1 : part); // 1 − COALESCE(DIVIDE(…), 1)
    }
    const guard = isFact ? totalA : sumList(A, list); // ISBLANK(SUMX(_percent, [@totalHours] / [@hours]))
    if (Number.isNaN(guard)) return 0;
    return mean((l) => oneMinus(ratio(listSum(w, l, list), T(l))));
  };

  const totalShare = () => {
    if (isFact || !weighted) return Number.isNaN(totalM) ? 0 : 1;
    const v = divide(sumT(A), totalA); // COALESCE(DIVIDE(Σ_A h(ℓ, 1), Σ_A T), 0)
    return Number.isNaN(v) ? 0 : v;
  };

  const baseValue = (sort: number) => {
    if (sort === 1) {
      if (!isFact) return 0;
      return Number.isNaN(weighted ? totalA : totalM) ? Number.NaN : 0; // DIVIDE(Σ 0, Σ T)
    }
    if (isSubtotal(sort)) {
      if (weighted) return A.length === 0 ? Number.NaN : 0; // @percent is 0 here
      return isFact ? Number.NaN : 1; // fact: SWITCH without an else; plan: 1 − DIVIDE(Σ 0, Σ T)
    }
    const list = cumulativeList(sort);
    if (!weighted) return oneMinus(divide(sumList(M, list), totalM));
    return mean((l) => oneMinus(ratio(listSum(w, l, list), T(l))));
  };

  return TIME_SORTS.map((sort) => {
    const c = colOf(sort);
    const sub = isSubtotal(sort);
    const share = sort === 1 ? totalShare() : sub ? subtotalValue(sort) : lossValue(c);

    let subtotal: number;
    if (sort === 1) {
      if (weighted) subtotal = divide(sumT(A), totalA);
      else subtotal = isFact ? (Number.isNaN(totalM) ? 0 : 1) : divide(totalM, totalM);
    } else if (sub) subtotal = subtotalValue(sort);
    else subtotal = !weighted && !isFact ? 0 : Number.NaN;

    let loss: number;
    if (sort === 1) loss = isFact && weighted ? mean((l) => ratio(T(l), T(l))) : 0;
    else loss = sub ? 0 : lossValue(c);

    return {
      sort,
      share: nullOf(share),
      subtotal: nullOf(subtotal),
      loss: nullOf(loss),
      base: nullOf(baseValue(sort)),
    };
  });
}

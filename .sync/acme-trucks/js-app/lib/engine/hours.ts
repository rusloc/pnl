import { TIME_SORTS } from '../data/manifest.ts';
import type { Dataset, RockTable, TimeTable } from './data.ts';
import type { Calculation, PlanType } from './selection.ts';

// Per-loader window sums and the category lists (contract §3.2, §3.3). A window is one business week or all weeks. Every
// sum is Float64 over the loader-week rows; "no row in the window" is NaN (DAX BLANK), a sum of zeros is 0.

export const NC = TIME_SORTS.length;
const COL_OF = new Map<number, number>(TIME_SORTS.map((s, i) => [s, i]));

export const colOf = (sort: number): number => COL_OF.get(sort) ?? -1;
const cols = (sorts: readonly number[]) => sorts.map(colOf).filter((c) => c >= 0);

// R2: the lists of _Fact Loss % Linear / _Fact Share % * / _Plan * %. 26 has no column; it stays in L_TL for fidelity.
const L_KTG = [2, 3, 4, 5];
const L_KIO = [...L_KTG, 7, 8, 9, 10, 11, 12, 14, 15, 21, 22];
const L_TL = [...L_KIO, 25, 26];
export const LOSSES = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 21, 22, 25] as const;
export const SUBTOTALS = [1, 6, 24, 27] as const;
export const isSubtotal = (sort: number) => (SUBTOTALS as readonly number[]).includes(sort);

/** Columns of the subtotal list of s ∈ {6, 24, 27}. */
export const subtotalList = (sort: number): number[] => cols(sort === 6 ? L_KTG : sort === 24 ? L_KIO : L_TL);

/** Columns of the cumulative loss list up to and including loss row r (_*_Base % *). */
export function cumulativeList(sort: number): number[] {
  const at = (LOSSES as readonly number[]).indexOf(sort);
  return cols(LOSSES.slice(0, at + 1));
}

export interface WindowSums {
  /** h[loader × NC + col]; NaN = no row of that category in the window. */
  h: Float64Array;
  /** Σ n_rows per loader: `active` counts any source row, mapped or not (R5). */
  rows: Int32Array;
}

export function windowSums(ds: Dataset, t: TimeTable, week: number | null): WindowSums {
  const key = `${t.id}:${week ?? 'all'}`;
  const hit = ds.windows.get(key) as WindowSums | undefined;
  if (hit) return hit;
  const h = new Float64Array(ds.nLoaders * NC).fill(Number.NaN);
  const rows = new Int32Array(ds.nLoaders);
  for (let r = 0; r < t.rows; r++) {
    if (week !== null && t.week[r] !== week) continue;
    const l = t.loader[r] as number;
    rows[l] = (rows[l] as number) + (t.nRows[r] as number);
    for (let c = 0; c < NC; c++) {
      const v = (t.cols[c] as Float64Array)[r] as number;
      if (Number.isNaN(v)) continue;
      const at = l * NC + c;
      const prev = h[at] as number;
      h[at] = Number.isNaN(prev) ? v : prev + v;
    }
  }
  const out = { h, rows };
  ds.windows.set(key, out);
  return out;
}

export const planTable = (ds: Dataset, p: PlanType): TimeTable => {
  if (p === 'Month') return ds.planMonth;
  if (!ds.planWeek) throw new Error('plan-week.parquet is not loaded');
  return ds.planWeek;
};

/** Σ over the rows; NaN (no term) when every term is NaN. */
export function nanSum(values: Iterable<number>): number {
  let s = Number.NaN;
  for (const v of values) if (!Number.isNaN(v)) s = Number.isNaN(s) ? v : s + v;
  return s;
}

/** DIVIDE: blank numerator or denominator, or a zero denominator, gives BLANK. */
export const divide = (a: number, b: number): number =>
  Number.isNaN(a) || Number.isNaN(b) || b === 0 ? Number.NaN : a / b;

export const nullOf = (v: number): number | null => (Number.isNaN(v) ? null : v);

/** Hours of a category per loader in the window (NaN if none). */
const cell = (w: WindowSums, l: number, c: number): number => w.h[l * NC + c] as number;

/** Σ_{ℓ∈M} h(ℓ, c), or for a column list the sum of the present columns (NaN when none is present). */
export function maskSum(w: WindowSums, mask: readonly number[], c: number): number {
  let s = Number.NaN;
  for (const l of mask) {
    const v = cell(w, l, c);
    if (!Number.isNaN(v)) s = Number.isNaN(s) ? v : s + v;
  }
  return s;
}

/** Σ vol·h(ℓ, c) ÷ Σ vol over the masked loaders (_Plan Hours Weighted, _Fact Hours Weighted: no `active` filter). */
export function weightedHours(ds: Dataset, w: WindowSums, mask: readonly number[], c: number): number {
  let top = Number.NaN;
  let bottom = Number.NaN;
  for (const l of mask) {
    const vol = ds.vol[l] as number;
    if (Number.isNaN(vol)) continue;
    bottom = Number.isNaN(bottom) ? vol : bottom + vol;
    const v = cell(w, l, c);
    if (!Number.isNaN(v)) top = Number.isNaN(top) ? vol * v : top + vol * v;
  }
  return divide(top, bottom);
}

/** `_Plan Hours` / `_Fact Hours` of category c under the calculation (fact hours = seconds ÷ 3600 after summing, R4). */
export function hoursUnder(
  ds: Dataset,
  w: WindowSums,
  mask: readonly number[],
  c: number,
  calc: Calculation,
  divisor: number,
): number {
  const v = calc === 'Linear' ? maskSum(w, mask, c) : weightedHours(ds, w, mask, c);
  return v / divisor;
}

/** Σ over the mask and the window of one rock column (null terms add nothing). */
export function rockSum(rock: RockTable, column: Float64Array, week: number | null, mask: readonly number[]): number {
  const inMask = new Set(mask);
  let s = Number.NaN;
  for (let r = 0; r < rock.rows; r++) {
    if (week !== null && rock.week[r] !== week) continue;
    if (!inMask.has(rock.loader[r] as number)) continue;
    const v = column[r] as number;
    if (!Number.isNaN(v)) s = Number.isNaN(s) ? v : s + v;
  }
  return s;
}

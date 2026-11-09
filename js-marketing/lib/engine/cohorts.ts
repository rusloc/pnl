import { MONTHS, RET_DAYS, coIx } from './data.ts';
import type { Dataset } from './data.ts';
import { retentionCell } from './metrics.ts';

// Cohorts (contract §3.9; data README › Cohorts): DDA only, the scope's campaigns; the window only picks the months.
// Cohort cost = spend of the acquisition month (actual days) × (1 + the month's team pool ÷ the month's UNFILTERED
// spend); payback at offset k = Σ_{≤ k} (revenue − refunds) × GM ÷ cost over the offsets that have a row.

export interface Cohort {
  month: number;
  customers: number;
  arpa: number;
  cac: number;
  refundRate: number;
  /** payback by offset (only offsets with a row in the scope) */
  payback: { offset: number; value: number }[];
  paybackMonth: number | undefined;
  /** retention by day N (undefined = no cell yet, A-74) */
  retention: Record<number, number | undefined>;
}

const monthSpend = new WeakMap<Dataset, { spend: Float64Array; team: Float64Array }>();
function monthTotals(ds: Dataset) {
  let t = monthSpend.get(ds);
  if (!t) {
    const spend = new Float64Array(ds.NC * MONTHS);
    const team = new Float64Array(MONTHS);
    for (let d = 0; d < ds.ND; d++) {
      const m = ds.cal.monthIx[d] ?? 0;
      team[m] = (team[m] ?? 0) + (ds.teamDay[d] ?? 0);
      for (let c = 0; c < ds.NC; c++)
        spend[c * MONTHS + m] = (spend[c * MONTHS + m] ?? 0) + (ds.cd.spend_usd[c * ds.ND + d] ?? 0);
    }
    t = { spend, team };
    monthSpend.set(ds, t);
  }
  return t;
}

const nan0 = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? 0 : v);

/** One acquisition month of the scope, or undefined when it has no customers (no row, or 0 credits). */
export function cohort(ds: Dataset, cs: readonly number[], m: number): Cohort | undefined {
  const { co } = ds;
  let n0 = 0;
  let rev0 = 0;
  let refunds = 0;
  for (const c of cs) {
    n0 += nan0(co.customers_start[coIx(c, m, 0)]);
    rev0 += nan0(co.revenue_usd[coIx(c, m, 0)]);
    for (let k = 0; k < MONTHS; k++) refunds += nan0(co.refund_count[coIx(c, m, k)]);
  }
  if (!(n0 > 0)) return undefined;
  const t = monthTotals(ds);
  let spm = 0;
  let spAll = 0;
  for (let c = 0; c < ds.NC; c++) spAll += t.spend[c * MONTHS + m] ?? 0;
  for (const c of cs) spm += t.spend[c * MONTHS + m] ?? 0;
  const cost = spm * (1 + (t.team[m] ?? 0) / spAll);
  const payback: Cohort['payback'] = [];
  let cum = 0;
  for (let k = 0; k < MONTHS; k++) {
    let has = false;
    let net = 0;
    for (const c of cs) {
      const rv = co.revenue_usd[coIx(c, m, k)] ?? Number.NaN;
      if (!Number.isNaN(rv)) has = true;
      net += nan0(rv) - nan0(co.refunds_usd[coIx(c, m, k)]);
    }
    if (!has) continue;
    cum += net;
    payback.push({ offset: k, value: (cum * ds.gm) / cost });
  }
  const retention: Record<number, number | undefined> = {};
  for (const n of RET_DAYS) retention[n] = retentionCell(ds, cs, m, n);
  return {
    month: m,
    customers: n0,
    arpa: rev0 / n0,
    cac: cost / n0,
    refundRate: refunds / n0,
    payback,
    paybackMonth: payback.find((x) => x.value >= 1)?.offset,
    retention,
  };
}

/** `Cohort Customers` (Σ customers_start at offset 0) of month m, or undefined when the scope has no offset-0 row. */
export function cohortCustomers(ds: Dataset, cs: readonly number[], m: number): number | undefined {
  let n = 0;
  let has = false;
  for (const c of cs) {
    const v = ds.co.customers_start[coIx(c, m, 0)] ?? Number.NaN;
    if (Number.isNaN(v)) continue;
    has = true;
    n += v;
  }
  return has ? n : undefined;
}

/** Month index of the window end (`_Cohort End Index`). */
export const cohortEnd = (ds: Dataset, b: number): number => ds.cal.monthOf(b);

/** K1 heatmap rows: the 12 acquisition months before the window's end month (`_K1 Heat Month`: m < end, m ≥ end − 12). */
export function k1Months(ds: Dataset, b: number): number[] {
  const end = cohortEnd(ds, b);
  const out: number[] = [];
  for (let m = Math.max(end - 12, 0); m < end; m++) out.push(m);
  return out;
}

/** K7 / P7 months: the 12 acquisition months ending with the window's end month. */
export function lastTwelve(ds: Dataset, b: number): number[] {
  const end = cohortEnd(ds, b);
  const out: number[] = [];
  for (let m = Math.max(end - 11, 0); m <= end; m++) out.push(m);
  return out;
}

/** K3 rows: the latest six cohort months with a retention row whose month start ≤ the window end (scope-independent). */
export function k3Months(ds: Dataset, b: number): number[] {
  let last = -1;
  for (let m = 0; m < MONTHS; m++) {
    if (ds.cal.monthStart(m) > b) break;
    for (let n = 0; n < RET_DAYS.length; n++) if (ds.retHas[n * MONTHS + m] === 1) last = m;
  }
  const out: number[] = [];
  for (let m = Math.max(last - 5, 0); m <= last && last >= 0; m++) out.push(m);
  return out;
}

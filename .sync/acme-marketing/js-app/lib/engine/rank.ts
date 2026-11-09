import { MODEL_KEY, MONTHS, coIx } from './data.ts';
import type { Dataset } from './data.ts';
import { lastTwelve } from './cohorts.ts';
import { metrics, s } from './metrics.ts';
import { campaignAlerts } from './rules.ts';
import type { ModelCode } from '../data/manifest.ts';
import type { RankMode } from './selection.ts';
import { moversWindow } from './windows.ts';
import type { Comparator, Win } from './windows.ts';

// Rankings (contract §3.8, §3.9): O6 movers by Δ ROAS 90 d, O5 anomalies by Δ paid customers (both over the movers
// window), the selected campaign of P5, and P6 / P7 per channel. Ties break by campaign key, as the PBIP's TOPN.

export const MOVER_OBJECTIVES = ['PAID', 'INSTALL', 'PIPELINE'] as const;

export interface Delta {
  c: number;
  delta: number;
}

/** Δ ROAS 90 d per campaign of `cs` (objective PAID / INSTALL / PIPELINE, spend > 0 in both windows). */
export function roasDeltas(ds: Dataset, cs: readonly number[], now: Win, before: Win, model: ModelCode): Delta[] {
  const out: Delta[] = [];
  for (const c of cs) {
    const obj = ds.campaigns[c]?.objective_code;
    if (!MOVER_OBJECTIVES.some((o) => o === obj)) continue;
    const r = metrics(ds, [c], now.a, now.b, { rich: false, single: c, model });
    if (!(r.spend > 0) || r.roas_90d === undefined) continue;
    const p = metrics(ds, [c], before.a, before.b, { rich: false, single: c, model });
    if (!((p.spend ?? 0) > 0) || p.roas_90d === undefined) continue;
    out.push({ c, delta: r.roas_90d - p.roas_90d });
  }
  return out;
}

/** Δ paid customers (model) per campaign of `cs` with spend > 0 in both windows. */
export function paidDeltas(ds: Dataset, cs: readonly number[], now: Win, before: Win, model: ModelCode) {
  const k = `paid_${MODEL_KEY[model]}` as const;
  const out: (Delta & { paid: number; before: number })[] = [];
  for (const c of cs) {
    if (!(s(ds, 'spend_usd', [c], now.a, now.b) > 0) || !(s(ds, 'spend_usd', [c], before.a, before.b) > 0)) continue;
    const paid = s(ds, k, [c], now.a, now.b);
    const prev = s(ds, k, [c], before.a, before.b);
    out.push({ c, delta: paid - prev, paid, before: prev });
  }
  return out;
}

const byKey = (ds: Dataset) => (x: Delta, y: Delta) =>
  (ds.campaigns[x.c]?.campaign_key ?? '').localeCompare(ds.campaigns[y.c]?.campaign_key ?? '');

/** Worst n (negatives only, most negative first) or Top n (positives only, largest first). */
export function rankDeltas<T extends Delta>(ds: Dataset, deltas: readonly T[], mode: RankMode, n = 5): T[] {
  const keyOrder = byKey(ds);
  return deltas
    .filter((d) => (mode === 'worst' ? d.delta < 0 : d.delta > 0))
    .sort((x, y) => (mode === 'worst' ? x.delta - y.delta : y.delta - x.delta) || keyOrder(x, y))
    .slice(0, n);
}

/** O6 rows over the movers window. */
export function movers(ds: Dataset, cs: readonly number[], w: Win, cmp: Comparator, mode: RankMode, model: ModelCode) {
  const mw = moversWindow(ds.cal, w, cmp);
  return { window: mw, rows: rankDeltas(ds, roasDeltas(ds, cs, mw.now, mw.before, model), mode) };
}

/** O5 rows over the movers window, each with the most severe campaign alert that trips on the same days. */
export function anomalies(
  ds: Dataset,
  cs: readonly number[],
  w: Win,
  cmp: Comparator,
  mode: RankMode,
  model: ModelCode,
) {
  const mw = moversWindow(ds.cal, w, cmp);
  const rows = rankDeltas(ds, paidDeltas(ds, cs, mw.now, mw.before, model), mode).map((d) => ({
    ...d,
    alert: campaignAlerts(ds, d.c, mw.now.a, mw.now.b, model)[0]?.rule ?? null,
  }));
  return { window: mw, rows };
}

/** `_Selected Campaign`: the one campaign of the scope, else the worst mover (min Δ ROAS, ties by key), else the top
 *  spender of the window. */
export function selectedCampaign(ds: Dataset, cs: readonly number[], w: Win, cmp: Comparator, model: ModelCode) {
  if (cs.length === 1) return cs[0] ?? null;
  const mw = moversWindow(ds.cal, w, cmp);
  const deltas = roasDeltas(ds, cs, mw.now, mw.before, model).sort((x, y) => x.delta - y.delta || byKey(ds)(x, y));
  if (deltas[0]) return deltas[0].c;
  const spend = cs
    .map((c) => ({ c, delta: -s(ds, 'spend_usd', [c], w.a, w.b) }))
    .filter((x) => x.delta < 0)
    .sort((x, y) => x.delta - y.delta || byKey(ds)(x, y));
  return spend[0]?.c ?? null;
}

/** P6: churned customers per channel (undefined = BLANK: no cohort row contributes), offsets ≥ 1 whose calendar month is in the trailing 3 complete months (DDA). */
export function churnedByChannel(ds: Dataset, cs: readonly number[], b: number): (number | undefined)[] {
  const e = ds.cal.lastCompleteMonth(b);
  const out = new Array<number | undefined>(ds.m.channels.length).fill(undefined);
  for (const c of cs)
    for (let m = 0; m < MONTHS; m++)
      for (let k = 1; k < MONTHS; k++) {
        if (m + k < e - 2 || m + k > e) continue;
        const v = ds.co.churned[coIx(c, m, k)] ?? Number.NaN;
        if (!Number.isNaN(v)) out[ds.chIx[c] ?? 0] = (out[ds.chIx[c] ?? 0] ?? 0) + v;
      }
  return out;
}

/** P7: refunds (refund_count, all offsets) per channel of the 12 acquisition months to the end month (DDA). */
export function refundsByChannel(ds: Dataset, cs: readonly number[], b: number): (number | undefined)[] {
  const out = new Array<number | undefined>(ds.m.channels.length).fill(undefined);
  for (const c of cs)
    for (const m of lastTwelve(ds, b))
      for (let k = 0; k < MONTHS; k++) {
        const v = ds.co.refund_count[coIx(c, m, k)] ?? Number.NaN;
        if (!Number.isNaN(v)) out[ds.chIx[c] ?? 0] = (out[ds.chIx[c] ?? 0] ?? 0) + v;
      }
  return out;
}

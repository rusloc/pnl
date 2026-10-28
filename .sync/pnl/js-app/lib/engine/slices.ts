import type { Dataset } from '../data/dataset.ts';
import { planFactors } from './aggregate.ts';
import type { Translation } from './aggregate.ts';
import type { ColumnPlan, EntityCode } from './types.ts';

// Slice cuts (C-30, C-31) for the Vitals, Analysis and Profitability views. Direct lines (revenue, gross-to-net,
// cost of revenue, variable selling) are booked at region × channel × line × segment and are read as booked. Lines
// below contribution margin are booked by region only; for a cut by channel, line or segment they are allocated by net
// revenue share within entity × version × month × region, exactly the rule the build checks against
// fact_pl_allocated (scripts/build-data.ts §4): allocated = line(entity, region, month) × NR(slice) ÷ NR(region).

export type SliceDim = 'region' | 'channel' | 'line' | 'segment';

/** Member key of a cut: the members' codes joined by "|" in `by` order; "" for the total. */
export type MemberKey = string;

export interface OpsSum {
  units: number;
  gmv: number; // reporting-currency units
  merchants: number; // at the plan's last month (period-end stock, K-23)
}

const DIMS: readonly SliceDim[] = ['region', 'channel', 'line', 'segment'];

function accountFlags(ds: Dataset) {
  const { dict, tables } = ds.manifest;
  const byCode = new Map(tables.dim_account.map((a) => [a.account_code, a]));
  const belowCm = new Uint8Array(dict.account.length);
  const nrBlock = new Uint8Array(dict.account.length);
  dict.account.forEach((code, i) => {
    const a = byCode.get(code);
    if (!a) throw new Error(`slices: account ${code} missing from dim_account`);
    belowCm[i] = a.is_below_cm ? 1 : 0;
    nrBlock[i] = a.block_code === 'GR' || a.block_code === 'GTN' ? 1 : 0; // NR = GR + GTN (spec §3 step 3)
  });
  return { belowCm, nrBlock };
}

/**
 * Σ per account and member of the cut, translated per row (D-30). Members with no rows are absent. `by` = [] gives
 * one member "" equal to aggregateAccounts. Single entity only (the Group view is not built in Track C).
 */
export function aggregateBy(
  ds: Dataset,
  entity: EntityCode,
  plan: ColumnPlan,
  tr: Translation,
  by: readonly SliceDim[],
): Map<MemberKey, Float64Array> {
  const { dict, tables } = ds.manifest;
  const pl = ds.pl.get(entity);
  if (!pl) throw new Error(`slices: entity ${entity} not loaded`);
  const nAcc = dict.account.length;
  const nMonths = tables.dim_month.length;
  const nRegions = dict.region.length;
  const factor = planFactors(ds, plan, tr);
  const out = new Map<MemberKey, Float64Array>();
  const slot = (key: MemberKey) => {
    let a = out.get(key);
    if (!a) out.set(key, (a = new Float64Array(nAcc)));
    return a;
  };
  const cols = { region: pl.region, channel: pl.channel, line: pl.line, segment: pl.segment };
  const keyOf = (r: number, c: number, l: number, s: number) => {
    const idx = { region: r, channel: c, line: l, segment: s };
    return by.map((d) => dict[d][idx[d]] ?? '?').join('|');
  };
  const { n, monthIdx, version, account, cents } = pl;
  const allocate = by.some((d) => d !== 'region');

  if (!allocate) {
    for (let i = 0; i < n; i++) {
      const f = factor[((version[i] ?? 0) * nMonths + (monthIdx[i] ?? 0)) * nRegions + (cols.region[i] ?? 0)] ?? 0;
      if (f === 0) continue;
      const key = keyOf(cols.region[i] ?? 0, cols.channel[i] ?? 0, cols.line[i] ?? 0, cols.segment[i] ?? 0);
      const a = slot(key);
      const acc = account[i] ?? 0;
      a[acc] = (a[acc] ?? 0) + (cents[i] ?? 0) * f;
    }
    return out;
  }

  // Pass 1: direct rows straight into their member; NR per (group, slice tuple) and below-CM totals per group.
  const { belowCm, nrBlock } = accountFlags(ds);
  const nL = dict.line.length;
  const nS = dict.segment.length;
  const tupleOf = (c: number, l: number, s: number) => (c * nL + l) * nS + s;
  const nr = new Map<number, Map<number, number>>(); // group → tuple → NR cents (local)
  const nrTotal = new Map<number, number>();
  const below = new Map<number, Map<number, number>>(); // group → account → cents (local)
  for (let i = 0; i < n; i++) {
    const r = cols.region[i] ?? 0;
    const g = ((version[i] ?? 0) * nMonths + (monthIdx[i] ?? 0)) * nRegions + r;
    const f = factor[g] ?? 0;
    if (f === 0) continue;
    const acc = account[i] ?? 0;
    const c = cents[i] ?? 0;
    if (belowCm[acc]) {
      const m = below.get(g) ?? new Map<number, number>();
      m.set(acc, (m.get(acc) ?? 0) + c);
      below.set(g, m);
      continue;
    }
    const ch = cols.channel[i] ?? 0;
    const li = cols.line[i] ?? 0;
    const sg = cols.segment[i] ?? 0;
    const a = slot(keyOf(r, ch, li, sg));
    a[acc] = (a[acc] ?? 0) + c * f;
    if (nrBlock[acc]) {
      const t = tupleOf(ch, li, sg);
      const m = nr.get(g) ?? new Map<number, number>();
      m.set(t, (m.get(t) ?? 0) + c);
      nr.set(g, m);
      nrTotal.set(g, (nrTotal.get(g) ?? 0) + c);
    }
  }
  // Pass 2: spread each group's below-CM amounts over its slices by NR share (C-31).
  for (const [g, accounts] of below) {
    const f = factor[g] ?? 0;
    const r = g % nRegions;
    const slices = nr.get(g);
    const total = nrTotal.get(g) ?? 0;
    if (!slices || total === 0) throw new Error(`slices: no net revenue to allocate group ${g} by (C-31)`);
    for (const [t, sliceNr] of slices) {
      const s = t % nS;
      const l = Math.floor(t / nS) % nL;
      const ch = Math.floor(t / (nS * nL));
      const a = slot(keyOf(r, ch, l, s));
      const share = sliceNr / total;
      for (const [acc, c] of accounts) a[acc] = (a[acc] ?? 0) + c * share * f;
    }
  }
  return out;
}

/** Operational facts by member of a cut: units and GMV over the plan's months, merchants at its last month. */
export function aggregateOpsBy(
  ds: Dataset,
  entity: EntityCode,
  plan: ColumnPlan,
  tr: Translation,
  by: readonly SliceDim[],
): Map<MemberKey, OpsSum> {
  const { dict, tables } = ds.manifest;
  const o = ds.ops;
  const e = dict.entity.indexOf(entity);
  const nMonths = tables.dim_month.length;
  const nRegions = dict.region.length;
  const factor = planFactors(ds, plan, tr);
  const lastMonth = Math.max(-1, ...plan.parts.flatMap((p) => p.months));
  const out = new Map<MemberKey, OpsSum>();
  const cols = { region: o.region, channel: o.channel, line: o.line, segment: o.segment };
  for (let i = 0; i < o.n; i++) {
    if (o.entity[i] !== e) continue;
    const t = o.monthIdx[i] ?? 0;
    const f = factor[((o.version[i] ?? 0) * nMonths + t) * nRegions + (o.region[i] ?? 0)] ?? 0;
    if (f === 0) continue;
    const key = by.map((d) => dict[d][cols[d][i] ?? 0] ?? '?').join('|');
    const s = out.get(key) ?? { units: 0, gmv: 0, merchants: 0 };
    s.units += o.units[i] ?? 0;
    s.gmv += (o.gmvCents[i] ?? 0) * f;
    if (t === lastMonth) s.merchants += o.merchants[i] ?? 0;
    out.set(key, s);
  }
  return out;
}

/** Per-dataset memo of the scans (one Vitals / Analysis / Profitability render evaluates the same plans repeatedly). */
export function createSliceCache(ds: Dataset) {
  const accounts = new Map<string, Map<MemberKey, Float64Array>>();
  const ops = new Map<string, Map<MemberKey, OpsSum>>();
  const keyOf = (entity: EntityCode, plan: ColumnPlan, tr: Translation, by: readonly SliceDim[]) =>
    JSON.stringify([entity, plan.parts, tr.currency, tr.basis, tr.fy, by]);
  const remember = <T>(cache: Map<string, T>, key: string, make: () => T): T => {
    const hit = cache.get(key);
    if (hit) return hit;
    if (cache.size > 96) cache.clear();
    const v = make();
    cache.set(key, v);
    return v;
  };
  return {
    accounts: (entity: EntityCode, plan: ColumnPlan, tr: Translation, by: readonly SliceDim[] = []) =>
      remember(accounts, keyOf(entity, plan, tr, by), () => aggregateBy(ds, entity, plan, tr, by)),
    ops: (entity: EntityCode, plan: ColumnPlan, tr: Translation, by: readonly SliceDim[] = []) =>
      remember(ops, keyOf(entity, plan, tr, by), () => aggregateOpsBy(ds, entity, plan, tr, by)),
  };
}

export type SliceCache = ReturnType<typeof createSliceCache>;
export { DIMS as SLICE_DIMS };

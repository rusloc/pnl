import type { Dataset } from '../data/dataset.ts';
import { translationFactor } from './fx.ts';
import type { Fx, FxBasis } from './fx.ts';
import type { ColumnPlan, Currency, EntityCode, EntityView, ReportingCurrency } from './types.ts';

export interface Translation {
  fx: Fx;
  currency: ReportingCurrency;
  basis: FxBasis;
  fy: number; // selected fiscal year (C-12)
}

/**
 * Translation factors of a plan, indexed [(version × month) × region]: local cents → reporting units, 0 = the row is
 * not in the plan. Each month × currency at its own rate (D-30, C-11 … C-13). Shared by every scan.
 */
export function planFactors(ds: Dataset, plan: ColumnPlan, tr: Translation): Float64Array {
  const { dict, tables } = ds.manifest;
  const nMonths = tables.dim_month.length;
  const nRegions = dict.region.length;
  const budgetKey = tables.dim_version.find((v) => v.version_code === 'Budget')?.version_key;
  const regionCcy: Currency[] = dict.region.map((code) => {
    const r = tables.dim_region.find((d) => d.region_code === code);
    if (!r) throw new Error(`aggregate: region ${code} missing from dim_region`);
    return r.functional_currency;
  });
  const ccMonth = (t: number) => {
    const monthNumber = tables.dim_month[t]?.month_number;
    const cc = tables.dim_month.find((d) => d.fiscal_year === tr.fy && d.month_number === monthNumber);
    if (!cc) throw new Error(`aggregate: no FY${tr.fy} month for constant currency`);
    return cc.month_index;
  };
  const factor = new Float64Array(dict.version.length * nMonths * nRegions);
  for (const p of plan.parts) {
    const v = dict.version.indexOf(p.version);
    if (v < 0) throw new Error(`aggregate: version ${p.version} is not in the built data`);
    const isBudget = p.version === budgetKey;
    for (const t of p.months)
      regionCcy.forEach((ccy, r) => {
        factor[(v * nMonths + t) * nRegions + r] =
          translationFactor(tr.fx, ccy, tr.currency, t, isBudget, tr.basis, ccMonth(t)) / 100;
      });
  }
  return factor;
}

/**
 * The one scan (ADR-0002 §2.3): Σ per account over the plan's version × month rows, each row translated at its own
 * month × currency rate before summing (D-30), in reporting-currency units. GROUP = both entities without the rows
 * that carry a counterparty, i.e. intercompany removed (C-36, D-33). Slice cuts: slices.ts (C-30, C-31).
 */
export function aggregateAccounts(ds: Dataset, entity: EntityView, plan: ColumnPlan, tr: Translation): Float64Array {
  const { dict, tables } = ds.manifest;
  const nMonths = tables.dim_month.length;
  const nRegions = dict.region.length;
  const factor = planFactors(ds, plan, tr);

  const out = new Float64Array(dict.account.length);
  const entities: EntityCode[] = entity === 'GROUP' ? ['P', 'S'] : [entity];
  const consolidate = entity === 'GROUP';
  for (const e of entities) {
    const pl = ds.pl.get(e);
    if (!pl) throw new Error(`aggregate: entity ${e} not loaded`);
    const { n, monthIdx, version, region, account, counterparty, cents } = pl;
    for (let i = 0; i < n; i++) {
      const f = factor[((version[i] ?? 0) * nMonths + (monthIdx[i] ?? 0)) * nRegions + (region[i] ?? 0)] ?? 0;
      if (f === 0 || (consolidate && counterparty[i] !== 0)) continue;
      const a = account[i] ?? 0;
      out[a] = (out[a] ?? 0) + (cents[i] ?? 0) * f;
    }
  }
  return out;
}

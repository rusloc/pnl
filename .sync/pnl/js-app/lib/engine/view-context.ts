import type { Dataset } from '../data/dataset.ts';
import type { Translation } from './aggregate.ts';
import { formatAmount, formatPercent, formatPoints } from './format.ts';
import type { Units } from './format.ts';
import type { Fx } from './fx.ts';
import type { MemberKey, SliceCache, SliceDim } from './slices.ts';
import { buildSpine, evaluateSpine } from './spine.ts';
import type { ColumnPlan, CompareChoice, EntityCode, Selection, SpineRow, VersionPlan } from './types.ts';
import { hasNoData, versionPlan } from './versions.ts';

// Shared plumbing of the Vitals, Analysis and Profitability views (P&L views redesign v4, build-brief §0): the plans
// every view compares against, the three translations (selected basis, actual rates, constant currency) and spine
// values per slice member. Framework-free.

export type Values = ReadonlyMap<string, number | null>; // spine row code → value (amounts in reporting units)

export const CHOICE_NAMES: Readonly<Record<'B' | 'LE' | 'PY', string>> = {
  B: 'Budget',
  LE: 'Latest estimate',
  PY: 'Prior year',
};

export interface Compare {
  choice: 'B' | 'LE' | 'PY';
  name: string; // "Budget"
  plan: ColumnPlan;
}

export interface ViewContext {
  ds: Dataset;
  sel: Selection;
  entity: EntityCode;
  spine: readonly SpineRow[];
  plan: VersionPlan;
  tr: Translation; // the selected FX basis (Display flyout)
  trAct: Translation; // actual rates
  trCC: Translation; // constant currency: every version at the selected year's budget rates (C-12)
  compareA: Compare | null; // card rows (parity rule 17: NONE drops the row)
  compareB: Compare | null;
  /** Bridge / variances / profitability comparison: Compare A, else Compare B, else prior year (parity rule 1). */
  bridgeCmp: Compare;
  budget: ColumnPlan; // status chips compare with Budget only (build-brief §0)
  py: ColumnPlan; // prior year of the base months (C-04)
  units: Units;
  unitLabel: string; // "m" / "k"
  symbol: string; // "$"
  /** Spine values per member of a cut ("" = total); null when the plan has no data at all (M-13). */
  values(plan: ColumnPlan, tr: Translation, by?: readonly SliceDim[]): ReadonlyMap<MemberKey, Values> | null;
  total(plan: ColumnPlan | null, tr: Translation): Values | null;
  leaves(plan: ColumnPlan, tr: Translation, by?: readonly SliceDim[]): ReadonlyMap<MemberKey, Float64Array>;
  ops: SliceCache['ops'];
  /** A plan restricted to its last month (ARR, K-23 period-end metrics). */
  lastMonth(plan: ColumnPlan): ColumnPlan;
}

function choicePlan(m: Dataset['manifest'], sel: Selection, choice: CompareChoice): ColumnPlan | null {
  return versionPlan(m, { ...sel, compareA: choice }).compareA;
}

export function createViewContext(ds: Dataset, sel: Selection, cache: SliceCache, fx: Fx): ViewContext {
  const m = ds.manifest;
  if (sel.entity === 'GROUP') throw new Error('views: the Group view is not built in Track C');
  const entity = sel.entity;
  const plan = versionPlan(m, sel);
  const spine = buildSpine(m, entity);
  const tr: Translation = { fx, currency: sel.currency, basis: sel.fxBasis, fy: sel.fy };
  const trAct: Translation = { ...tr, basis: 'ACT' };
  const trCC: Translation = { ...tr, basis: 'CC' };
  const compare = (choice: CompareChoice, p: ColumnPlan | null): Compare | null =>
    choice === 'NONE' || p === null ? null : { choice, name: CHOICE_NAMES[choice], plan: p };
  const compareA = compare(sel.compareA, plan.compareA);
  const compareB = compare(sel.compareB, plan.compareB);
  const pyPlan = choicePlan(m, sel, 'PY');
  const budget = choicePlan(m, sel, 'B');
  if (!pyPlan || !budget) throw new Error('views: no prior-year or budget plan');
  const bridgeCmp: Compare = compareA ?? compareB ?? { choice: 'PY', name: CHOICE_NAMES.PY, plan: pyPlan };
  const units = m.tables.param_units.find((u) => u.units_code === sel.units) ?? { divisor: 1_000_000, decimals: 1 };
  const symbol = m.tables.param_reporting_currency.find((c) => c.currency_code === sel.currency)?.symbol ?? '';

  const values = (p: ColumnPlan, t: Translation, by: readonly SliceDim[] = []) => {
    if (hasNoData(p)) return null;
    const out = new Map<MemberKey, Values>();
    for (const [k, acc] of cache.accounts(entity, p, t, by)) out.set(k, evaluateSpine(m, spine, acc));
    return out;
  };
  return {
    ds,
    sel,
    entity,
    spine,
    plan,
    tr,
    trAct,
    trCC,
    compareA,
    compareB,
    bridgeCmp,
    budget,
    py: pyPlan,
    units,
    unitLabel: sel.units === 'M' ? 'm' : 'k',
    symbol,
    values,
    total: (p, t) => (p === null ? null : (values(p, t)?.get('') ?? null)),
    leaves: (p, t, by = []) => cache.accounts(entity, p, t, by),
    ops: cache.ops,
    lastMonth(p) {
      const last = Math.max(-1, ...p.parts.flatMap((x) => x.months));
      return { ...p, parts: p.parts.filter((x) => x.months.includes(last)).map((x) => ({ ...x, months: [last] })) };
    },
  };
}

// ---------- formatting helpers shared by the view modules (format.ts stays the only place that rounds) ----------

export const v = (vals: Values | null, code: string): number | null => vals?.get(code) ?? null;
export const ratio = (num: number | null, den: number | null): number | null =>
  num === null || den === null || den === 0 ? null : num / den;
export const rel = (cur: number | null, cmp: number | null): number | null =>
  cur === null || cmp === null || cmp === 0 ? null : (cur - cmp) / Math.abs(cmp);
export const diff = (cur: number | null, cmp: number | null): number | null =>
  cur === null || cmp === null ? null : cur - cmp;

/** "$667.4 m" (amount in the selected units, F-14, N-06). */
export function money(ctx: ViewContext, value: number | null, signed = false): string {
  if (value === null) return 'n/a';
  const body = formatAmount(Math.abs(value), ctx.units);
  const zero = /^[0.,]+$/.test(body); // rounds to zero: no sign ("$0.0 m", never "−$0.0 m")
  const sign = zero ? '' : value < 0 ? '−' : signed && value > 0 ? '+' : '';
  return `${sign}${ctx.symbol}${body} ${ctx.unitLabel}`;
}
export const pct = (r: number | null, decimals = 1) => formatPercent(r, decimals);
export const pctSigned = (r: number | null, decimals = 1) => formatPercent(r, decimals, { signed: true });
export const pp = (d: number | null) => formatPoints(d);

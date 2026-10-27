import type { Dataset } from '../../data/dataset.ts';
import { createFx } from '../../engine/fx.ts';
import type { Engine } from '../../engine/index.ts';
import { createSliceCache } from '../../engine/slices.ts';
import type { KpiStatus } from '../../engine/thresholds.ts';
import type { Selection } from '../../engine/types.ts';
import { createViewContext, ratio, rel, v } from '../../engine/view-context.ts';

// Track C side of the cross-track parity rows (parity_selections.csv, P&L views redesign v4). Each metric id is the
// contract id that Track B (DAX rows) and Track A resolve the same way; see docs/ADD/features/parity-check-2026-10-27.md
// for the measure map. Values are raw: amounts in reporting-currency units (not millions), ratios as fractions, pp as
// fractions (0.003 = 0.3 pp), status as Track B `_KPI Status` codes (ontrack / ahead / watch / off / neutral).

export type Resolved = ReadonlyMap<string, number | string | null>;

const STATUS_CODE: Readonly<Record<KpiStatus, string>> = {
  onTrack: 'ontrack',
  ahead: 'ahead',
  watch: 'watch',
  off: 'off',
};

/** Bridge step ids follow Track B dim_bridge_step / dim_profit_step codes so bip can map them 1:1. */
const NR_STEPS_S = ['START', 'SVC_SUB', 'SVC_PAY', 'SVC_APP', 'SVC_PS', 'CC_SUB', 'FX', 'END'] as const;
const NR_STEPS_P = ['START', 'VOL', 'PRICE', 'CC_SUB', 'FX', 'END'] as const;
const PROFIT_STEPS = [
  'BUD',
  'VOL',
  'GM_RATE',
  'GM_MIX',
  'VSC',
  'SM',
  'RD',
  'GA',
  'OOI',
  'FX',
  'ACT',
  'DA',
  'ADJ',
  'OP',
] as const;

export function resolvePnl(ds: Dataset, engine: Engine, sel: Selection): Resolved {
  const out = new Map<string, number | string | null>();
  const put = (k: string, x: number | string | null | undefined) => out.set(k, x ?? null);
  const ctx = createViewContext(ds, sel, createSliceCache(ds), createFx(ds.manifest));
  const base = ctx.total(ctx.plan.base, ctx.tr);
  const budget = ctx.total(ctx.budget, ctx.tr);

  // ---- control totals (T-06; only meaningful for USD at actual rates) ----
  for (const code of ['NR', 'EBITDA', 'OP', 'NP']) put(`ct.${code}`, v(base, code));

  // ---- Vitals ----
  const vm = engine.vitals(sel);
  for (const c of [...vm.results, ...vm.drivers]) {
    put(`vitals.${c.id}.value_text`, c.value);
    put(`vitals.${c.id}.status`, c.status ? STATUS_CODE[c.status.status] : 'neutral');
    put(`vitals.${c.id}.rows`, c.rows.map((r) => r.label).join(' | '));
  }
  const nr = v(base, 'NR');
  put('vitals.nr.value', nr);
  put('vitals.ebitda.value', v(base, 'EBITDA'));
  put('vitals.op.value', v(base, 'OP'));
  put('vitals.gm.value', ratio(v(base, 'GP'), nr));
  const opex = (x: typeof base) => -((v(x, 'SM') ?? 0) + (v(x, 'RD') ?? 0) + (v(x, 'GA') ?? 0));
  put('vitals.opex.value', ratio(opex(base), nr));
  put('vitals.nr.d_bud_pct', rel(nr, v(budget, 'NR')));
  put('vitals.opex.d_bud_pp', (ratio(opex(base), nr) ?? 0) - (ratio(opex(budget), v(budget, 'NR')) ?? 0));
  put('vitals.nr.organic', rel(v(ctx.total(ctx.plan.base, ctx.trCC), 'NR'), v(ctx.total(ctx.py, ctx.trCC), 'NR')));
  const fyLe = ctx.total(ctx.plan.fyLE, ctx.tr);
  put('vitals.fy.value', v(fyLe, 'NR'));
  put('vitals.fy.attainment', ratio(v(fyLe, 'NR'), v(ctx.total(ctx.plan.fyBudget, ctx.tr), 'NR')));
  const info = (id: string, label: string) =>
    [...vm.results, ...vm.drivers].find((c) => c.id === id)?.info.values.find((x) => x.label === label)?.value;
  if (sel.entity === 'S') {
    const lines = ctx.values(ctx.plan.base, ctx.tr, ['line']);
    put('vitals.mix.sub_share', ratio(v(lines?.get('SUB') ?? null, 'NR'), nr));
    put('vitals.mix.pay_share', ratio(v(lines?.get('PAY') ?? null, 'NR'), nr));
    const ops = ctx.ops(ctx.entity, ctx.plan.base, ctx.tr).get('');
    put('vitals.gmv.value', ops?.gmv);
    put('vitals.merchants.value', ops?.merchants);
    const last = ctx.values(ctx.lastMonth(ctx.plan.base), ctx.tr, ['line']);
    const sub = v(last?.get('SUB') ?? null, 'NR');
    put('vitals.arr.value', sub === null ? null : sub * 12);
    put('vitals.merchants.gmv_per_merchant_text', info('merchants', 'GMV per merchant'));
  }

  // ---- Analysis page 1: bridges ----
  const an = engine.analysis(sel);
  const nrIds = sel.entity === 'S' ? NR_STEPS_S : NR_STEPS_P;
  an.nr.steps.forEach((s, i) => {
    put(`nr_bridge.${nrIds[i] ?? `#${i}`}.value`, s.value);
    put(`nr_bridge.${nrIds[i] ?? `#${i}`}.label`, s.label);
  });
  an.profit.steps.forEach((s, i) => put(`profit_bridge.${PROFIT_STEPS[i] ?? `#${i}`}.value`, s.value));

  // ---- Analysis page 2: largest variances (Top 8, by block, no cut; All for the full ranking) ----
  const v8 = engine.variances(sel, 8, 'block', 'none');
  const all = engine.variances(sel, 'all', 'abs', 'none');
  const total = v8.footer.find((f) => f.code === 'TOTAL');
  put('var.total_delta', total?.delta);
  put('var.coverage_top8', v8.coverage);
  put('var.leaf_count', all.rows.filter((r) => r.kind === 'leaf').length);
  put(
    'var.top8_codes',
    all.rows
      .slice(0, 8)
      .map((r) => r.code)
      .join(' '),
  );
  put(
    'var.nm_codes',
    all.rows
      .filter((r) => r.deltaPct === 'n.m.')
      .map((r) => r.code)
      .sort()
      .join(' '),
  );
  put('var.py_column', v8.columns.py || 'none'); // label of the vs-Compare-B column; 'none' when dropped (rule 17)
  const ccDelta =
    (v(ctx.total(ctx.plan.base, ctx.trCC), 'OP') ?? 0) - (v(ctx.total(ctx.bridgeCmp.plan, ctx.trCC), 'OP') ?? 0);
  put('var.total_fx', (total?.delta ?? 0) - ccDelta);

  // ---- Profitability (by region, constant currency: build-brief §3, README decision 7) ----
  const pf = engine.profitability(sel);
  put('prof.basis', pf.subtitle.startsWith('Constant currency') ? 'CC' : 'ACT');
  const now = ctx.values(ctx.plan.base, ctx.trCC, ['region']);
  const cmp = ctx.values(ctx.bridgeCmp.plan, ctx.trCC, ['region']);
  const tot = ctx.total(ctx.plan.base, ctx.trCC);
  const totCmp = ctx.total(ctx.bridgeCmp.plan, ctx.trCC);
  const rowOf = (key: string, a: typeof tot, c: typeof tot) => {
    const cm = ratio(v(a, 'CM'), v(a, 'NR'));
    const cmC = ratio(v(c, 'CM'), v(c, 'NR'));
    put(`prof.${key}.nr`, v(a, 'NR'));
    put(`prof.${key}.nr_delta_pct`, rel(v(a, 'NR'), v(c, 'NR')));
    put(`prof.${key}.gm_pct`, ratio(v(a, 'GP'), v(a, 'NR')));
    put(`prof.${key}.cm_pct`, cm);
    put(`prof.${key}.cm_delta_pp`, cm === null || cmC === null ? null : cm - cmC);
    put(`prof.${key}.ebitda`, v(a, 'EBITDA'));
  };
  for (const [key, a] of now ?? []) rowOf(key, a, cmp?.get(key) ?? null);
  rowOf('TOTAL', tot, totCmp);
  for (const r of pf.table.rows)
    put(`prof.${r.total ? 'TOTAL' : r.key}.cm_status`, r.cmDelta.status ? STATUS_CODE[r.cmDelta.status] : 'neutral');
  const levelCode: Record<string, string> = { 'Net revenue': 'NR', Contribution: 'CM', 'Adj. EBITDA': 'EBITDA' };
  for (const l of pf.concentration.levels)
    for (const s of l.segments) put(`conc.${s.key}.${levelCode[l.label] ?? l.label}`, s.share);
  for (const p of pf.bubble.points) put(`bubble.${p.key}.growth`, p.x);
  put('bubble.company.growth', pf.bubble.ref.x);
  put('bubble.company.cm_pct', pf.bubble.ref.y);
  for (const c of pf.heat.cols) put(`heat.${c.key}.colour_gm`, c.gm);
  return out;
}

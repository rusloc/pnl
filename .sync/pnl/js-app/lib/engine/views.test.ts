import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '../data/dataset.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { createFx } from './fx.ts';
import { createEngine } from './index.ts';
import type { Engine } from './index.ts';
import { aggregateBy, createSliceCache } from './slices.ts';
import { aggregateAccounts } from './aggregate.ts';
import type { Selection } from './types.ts';
import { createViewContext, money } from './view-context.ts';
import { versionPlan } from './versions.ts';

// P&L views redesign v4 (Vitals · Analysis · Profitability): values against control_totals_usd.csv (the quoted
// Commerce Cloud FY2025 view) and the internal reconciliations of build-brief §5 (bridge Σ steps = Δ, variances total
// = operating-profit Δ, coverage, of which FX = reported − constant currency, shares sum to 100 %, allocation
// conserves every account).

let ds: Dataset;
let engine: Engine;
beforeAll(async () => {
  ds = await loadPublicDataset(['P', 'S']);
  engine = createEngine(ds);
});

const fy2025 = (o: Partial<Selection> = {}) => selection({ entity: 'S', fy: 2025, month: 12, timeView: 'FY', ...o });
const SELECTIONS: [string, Selection][] = [
  ['S FY2025 vs Budget', fy2025()],
  ['P FY2025 vs Budget', fy2025({ entity: 'P' })],
  ['S YTD Sep 2026', selection({ entity: 'S' })],
  ['P YTD Sep 2026 vs PY only', selection({ compareA: 'PY', compareB: 'NONE' })],
  ['S Q3 2026 in EUR at CC', selection({ entity: 'S', timeView: 'QTD', currency: 'EUR', fxBasis: 'CC' })],
];

describe('Vitals', () => {
  it('hero values of the quoted Commerce Cloud FY2025 view (control_totals_usd: NR 667.4, EBITDA 82.8, OP 48.6)', () => {
    const vm = engine.vitals(fy2025());
    expect(vm.results.map((c) => [c.title, c.value])).toEqual([
      ['Net revenue', '$667.4 m'],
      ['Adjusted EBITDA', '$82.8 m'],
      ['Operating profit', '$48.6 m'],
      ['Gross margin %', '55.9%'],
      ['Opex % revenue', '38.9%'],
    ]);
    expect(vm.drivers.map((c) => c.title)).toEqual([
      'GMV processed',
      'Active merchants',
      'ARR (run-rate)',
      'Revenue mix',
      'FY outlook',
    ]);
  });

  it('cards: two Δ rows (Compare A, B), Budget-only chip, a complete ⓘ, no sparkline', () => {
    for (const [, sel] of SELECTIONS) {
      const vm = engine.vitals(sel);
      expect(vm.results).toHaveLength(5);
      expect(vm.drivers).toHaveLength(5);
      for (const c of [...vm.results, ...vm.drivers]) {
        expect(c).not.toHaveProperty('spark');
        expect(c.info.what.length, c.id).toBeGreaterThan(10);
        expect(c.info.source.length, c.id).toBeGreaterThan(5);
        expect(JSON.stringify(c), c.id).not.toMatch(/NaN|undefined|Infinity/);
      }
      const rows = sel.compareB === 'NONE' ? 1 : 2;
      expect(vm.results[0]?.rows).toHaveLength(rows); // parity rule 17: NONE drops the row
    }
    expect(engine.vitals(selection()).drivers.map((c) => c.id)).toEqual(['units', 'nrPerUnit', 'gtn', 'ap', 'fy']); // L-10
  });

  it('heroes equal the statement (one engine, one number)', () => {
    for (const [, sel] of SELECTIONS) {
      const st = engine.statement(sel).rows;
      const val = (code: string) => st.find((r) => r.code === code)?.base ?? null;
      const ctx = createViewContext(ds, sel, createSliceCache(ds), createFx(ds.manifest));
      const t = ctx.total(ctx.plan.base, ctx.tr);
      for (const code of ['NR', 'EBITDA', 'OP']) expect(t?.get(code)).toBeCloseTo(val(code) ?? NaN, 6);
    }
  });
});

describe('Analysis page 1 — bridges reconcile (T-05)', () => {
  it.each(SELECTIONS)('%s', (_, sel) => {
    const vm = engine.analysis(sel);
    expect(Math.abs(vm.nr.residual)).toBeLessThan(1e-3);
    expect(Math.abs(vm.profit.residual)).toBeLessThan(1e-3);
    const st = engine.statement(sel).rows;
    const op = st.find((r) => r.code === 'OP')?.base ?? NaN;
    expect(vm.profit.steps.at(-1)?.value).toBeCloseTo(op, 3);
    const nr = st.find((r) => r.code === 'NR')?.base ?? NaN;
    expect(vm.nr.steps.at(-1)?.value).toBeCloseTo(nr, 3);
    // CC subtotal + FX = actual
    const cc = vm.nr.steps.find((s) => s.kind === 'subtotal')?.value ?? NaN;
    const fx = vm.nr.steps.find((s) => s.kind === 'fx')?.value ?? NaN;
    expect(cc + fx).toBeCloseTo(nr, 3);
    if (sel.fxBasis === 'CC') expect(fx).toBeCloseTo(0, 6); // Bridge FX is zero at constant currency
  });

  it('Commerce Cloud bridge steps are the four service lines; Consumer Products volume + price / mix', () => {
    const s = engine.analysis(fy2025()).nr.steps;
    expect(s.map((x) => (x.kind === 'up' || x.kind === 'down' ? 'step' : x.kind))).toEqual([
      'start',
      'step',
      'step',
      'step',
      'step',
      'subtotal',
      'fx',
      'end',
    ]);
    expect(s[1]?.label).toBe('Platform subscriptions');
    expect(engine.analysis(fy2025({ entity: 'P' })).nr.steps.map((s) => s.label)).toEqual([
      'Budget NR',
      'Volume',
      'Price / mix',
      'Constant-currency NR',
      'FX',
      'Actual NR',
    ]); // build-brief §2 labels (PV-11)
  });
});

describe('Analysis page 2 — largest variances', () => {
  it.each(SELECTIONS)('%s: total = operating-profit Δ, coverage, FX = reported − CC', (_, sel) => {
    const vm = engine.variances(sel, 8, 'block', 'none');
    const ctx = createViewContext(ds, sel, createSliceCache(ds), createFx(ds.manifest));
    const op = (p: typeof ctx.plan.base, t = ctx.tr) => ctx.total(p, t)?.get('OP') ?? 0;
    const total = vm.footer.find((f) => f.code === 'TOTAL');
    expect(total?.delta).toBeCloseTo(op(ctx.plan.base) - op(ctx.bridgeCmp.plan), 3);
    const shown = vm.footer.find((f) => f.code === 'SHOWN');
    const other = vm.footer.find((f) => f.code === 'OTHER');
    expect((shown?.delta ?? 0) + (other?.delta ?? 0)).toBeCloseTo(total?.delta ?? NaN, 3);
    expect(vm.coverage).toBeGreaterThan(0);
    expect(vm.coverage).toBeLessThanOrEqual(1);
    expect(vm.rows.filter((r) => r.kind === 'leaf')).toHaveLength(8);
    // of which FX: Δ at the selected basis − Δ at constant currency, summed over every leaf = OP
    const ccDelta = op(ctx.plan.base, ctx.trCC) - op(ctx.bridgeCmp.plan, ctx.trCC);
    const fxTotal = (total?.delta ?? 0) - ccDelta;
    expect(total?.fx).toBe(money(ctx, fxTotal, true));
    if (sel.fxBasis === 'CC') expect(Math.abs(fxTotal)).toBeLessThan(1e-6);
  });

  it('Top 8 / 12 / All, by block or by |Δ|; block rows carry "n of m lines"', () => {
    const sel = fy2025();
    expect(engine.variances(sel, 12, 'abs', 'none').rows.filter((r) => r.kind === 'leaf')).toHaveLength(12);
    const all = engine.variances(sel, 'all', 'block', 'none');
    expect(all.coverage).toBeCloseTo(1, 9);
    expect(all.rows.filter((r) => r.kind === 'block').map((r) => r.code)).toEqual([
      'GR',
      'GTN',
      'COR',
      'VSC',
      'SM',
      'RD',
      'GA',
      'OOI',
      'DA',
      'ADJ',
    ]);
    expect(all.rows.find((r) => r.kind === 'block')?.count).toMatch(/^\d+ of \d+ lines$/);
    const abs = engine.variances(sel, 'all', 'abs', 'none').rows.map((r) => Math.abs(r.delta));
    expect(abs).toEqual([...abs].sort((a, b) => b - a));
  });

  it('a cut splits every leaf exactly into its members; below-CM rows are allocated (alloc.) unless cut by region', () => {
    for (const cut of ['region', 'channel', 'line', 'segment'] as const) {
      const vm = engine.variances(fy2025(), 'all', 'abs', cut);
      for (const r of vm.rows) {
        const sum = r.members.reduce((s, x) => s + x.delta, 0);
        expect(sum, `${cut} ${r.code}`).toBeCloseTo(r.delta, 3);
      }
      const allocated = vm.rows.filter((r) => r.alloc).map((r) => r.code);
      if (cut === 'region') expect(allocated).toEqual([]);
      else expect(allocated.every((c) => /^(SM|RD|GA|OOI|DA|ADJ)_/.test(c))).toBe(true);
    }
  });

  it('n.m. when |comparison| < 2.0 display units or |Δ %| > 50 %', () => {
    const vm = engine.variances(fy2025(), 'all', 'abs', 'none');
    for (const r of vm.rows)
      if (r.deltaPct !== 'n.m.') expect(Math.abs(parseFloat(r.deltaPct.replace('−', '-')))).toBeLessThanOrEqual(50);
    expect(vm.rows.some((r) => r.deltaPct === 'n.m.')).toBe(true);
  });

  it('hides lines with no data in either version; they never show as n.m. (Track B parity round)', () => {
    const sel = fy2025({ entity: 'S' });
    const vm = engine.variances(sel, 'all', 'abs', 'none');
    const leaves = vm.rows.filter((r) => r.kind === 'leaf');
    // S FY2025 vs Budget: OOI_2, ADJ_1 and ADJ_2 are empty in both versions (35 leaves → 32)
    expect(leaves).toHaveLength(32);
    for (const code of ['OOI_2', 'ADJ_1', 'ADJ_2']) expect(leaves.some((r) => r.code === code)).toBe(false);
    const shown = engine.variances(sel, 8, 'block', 'none');
    const total = shown.footer.find((f) => f.code === 'TOTAL');
    expect(total?.delta).toBeCloseTo(
      leaves.reduce((s, r) => s + r.delta, 0),
      6,
    ); // hiding moves no money
  });
});

describe('C-31 allocation in the engine', () => {
  it('a cut by channel / line / segment conserves every account (Σ members = total)', () => {
    const sel = fy2025();
    const fx = createFx(ds.manifest);
    const tr = { fx, currency: sel.currency, basis: sel.fxBasis, fy: sel.fy };
    const plan = versionPlan(ds.manifest, sel).base;
    const total = aggregateAccounts(ds, 'S', plan, tr);
    for (const dim of ['channel', 'line', 'segment'] as const) {
      const cut = aggregateBy(ds, 'S', plan, tr, [dim]);
      for (let a = 0; a < total.length; a++) {
        const s = [...cut.values()].reduce((x, arr) => x + (arr[a] ?? 0), 0);
        expect(s, `${dim} ${ds.manifest.dict.account[a]}`).toBeCloseTo(total[a] ?? 0, 2);
      }
      expect([...cut.keys()].some((k) => k.endsWith('UNASSIGNED'))).toBe(false); // nothing left unallocated
    }
  });
});

describe('Profitability', () => {
  it.each(SELECTIONS)('%s: shares sum to 100 %, heat and table reconcile, CC subtitle', (_, sel) => {
    const vm = engine.profitability(sel);
    for (const level of vm.concentration.levels)
      expect(
        level.segments.reduce((s, x) => s + x.share, 0),
        level.label,
      ).toBeCloseTo(1, 9);
    expect(vm.table.rows.at(-1)?.label).toBe('Total');
    expect(vm.table.rows.at(-1)?.nr).toBe(vm.heat.grand); // table total = heatmap grand total (both CC)
    expect(vm.subtitle).toMatch(/^Constant currency \(FY\d{4} budget rates\)/);
    expect(vm.heat.rows).toHaveLength(4);
    expect(vm.bubble.points.length).toBeGreaterThan(0);
    expect(JSON.stringify(vm)).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('heat cells add up to their region and line totals (CC)', () => {
    const sel = fy2025();
    const ctx = createViewContext(ds, sel, createSliceCache(ds), createFx(ds.manifest));
    const cells = ctx.values(ctx.plan.base, ctx.trCC, ['region', 'line']);
    const regions = ctx.values(ctx.plan.base, ctx.trCC, ['region']);
    for (const [r, vals] of regions ?? []) {
      const sum = [...(cells ?? [])]
        .filter(([k]) => k.startsWith(`${r}|`))
        .reduce((s, [, x]) => s + (x.get('NR') ?? 0), 0);
      expect(sum, r).toBeCloseTo(vals.get('NR') ?? NaN, 3);
    }
  });

  it('prior-year trails need two earlier years (C-04): none for FY2025, drawn for FY2026', () => {
    expect(engine.profitability(fy2025()).bubble.points.every((p) => p.trail === null)).toBe(true);
    expect(engine.profitability(selection({ entity: 'S' })).bubble.points.every((p) => p.trail !== null)).toBe(true);
  });
});

describe('How to read', () => {
  it('one per view, starting with the period sentence', () => {
    const titles = (['kpi', 'analysis', 'profitability'] as const).map(
      (view) => engine.howToRead(selection({ view })).title,
    );
    expect(titles).toEqual(['How to read - Vitals', 'How to read - Analysis', 'How to read - Profitability']);
    expect(engine.howToRead(selection({ view: 'kpi' })).lines[0]?.value).toMatch(/^Showing /);
  });
});

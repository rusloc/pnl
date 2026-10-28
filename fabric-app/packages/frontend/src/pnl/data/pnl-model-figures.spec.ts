// Model result tables → zone shapes (ADR-0006 phase 2). Fixtures are rows the
// published model returned on 2026-10-22 through `rayfin connector invoke`
// (rayfin/probes/q*-smoke.query.json) for Consumer Products / Group, FY2026 YTD
// Sep, Actual vs Budget and Prior year, USD, millions — so the mapped texts must
// equal the control totals (data/acme_pl_dummy_data/checks/control_totals_usd.csv)
// and the Ledger mockup where both cover the same cell. The redesign-v4 zones use
// the Commerce Cloud FY2025 numbers of the parity check (§4), so the texts must
// equal Track C's where both print the same cell.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it } from 'vitest';

import { defaultFilters } from '../model/filters';
import type { FilterState } from '../model/types';
import { PnlModelError } from './pnl-model-client';
import {
  breakdownOptions,
  driversFromVariances,
  mapBridge,
  mapBubble,
  mapConcentration,
  mapContext,
  mapHeat,
  mapProfitability,
  mapProfitBridge,
  mapVarianceLeaves,
  mapVarianceMembers,
  mapVitals,
  mapVitalsInfo,
  mapVitalsMeta,
  profitabilitySubtitle,
} from './pnl-model-figures';
import { sampleReference } from './sample-reference';

const reference = sampleReference();
const filter: FilterState = defaultFilters(reference);

const table = (names: string[], rows: unknown[][]): QueryTable => ({
  columns: names.map((name) => ({ name, dataType: 'String' })),
  rows,
});

// --- QV: Vitals for S, Commerce Cloud FY2025 vs Budget / Prior year (the quoted view;
// values as the parity check §4 lists them, so the texts must equal Track C's) ----
const VITALS_META = table(
  ['dim_kpi[entity_view_code]', 'dim_kpi[vitals_slot]', 'dim_kpi[vitals_tier]', 'dim_kpi[kpi_code]', 'dim_kpi[kpi_label]', 'dim_kpi[better_when]', 'dim_kpi[value_type]', 'dim_kpi[definition]'],
  [
    ['S', 6, 'Driver', 'GMV', 'GMV processed', 'Higher', 'AMT', 'Merchant GMV through Payments, translated'],
    ['S', 1, 'Hero', 'NR', 'Net revenue', 'Higher', 'AMT', 'Gross revenue + gross-to-net deductions'],
    ['S', 2, 'Hero', 'EBITDA', 'Adjusted EBITDA', 'Higher', 'AMT', 'Contribution margin + operating expenses (MPM)'],
    ['S', 3, 'Hero', 'OP', 'Operating profit', 'Higher', 'AMT', 'IFRS 18 operating profit'],
    ['S', 4, 'Secondary', 'GM_PCT', 'Gross margin %', 'Higher', 'PCT', 'Gross profit / NR'],
    ['S', 5, 'Secondary', 'OPEX_PCT', 'Opex % of NR', 'Lower', 'PCT', '- (sales & marketing + R&D + G&A) / NR'],
    ['S', 7, 'Driver', 'MERCHANTS', 'Active merchants (period end)', 'Higher', 'INT', 'Merchants on a paid plan at the last month-end'],
    ['S', 8, 'Driver', 'ARR', 'ARR (period end)', 'Higher', 'AMT', 'Subscription NR of the last month in the window x 12'],
    ['S', 9, 'Driver', 'MIX', 'Subscription share of NR', 'Neutral', 'PCT', 'Platform subscriptions NR / NR (revenue mix)'],
    ['S', 10, 'Driver', 'FY_OUTLOOK', 'FY outlook (net revenue)', 'Higher', 'AMT', 'Latest estimate for the fiscal year'],
  ]
);
const VITALS_VALUES = [
  table(
    ['[@NR]', '[@NR_cmp_a]', '[@NR_cmp_b]', '[@EBITDA]', '[@EBITDA_cmp_a]', '[@EBITDA_cmp_b]', '[@OP]', '[@OP_cmp_a]', '[@OP_cmp_b]'],
    [[667.4, 658.2, 513.8, 82.8, 83.1, 56.0, 48.6, 50.2, 32.9]]
  ),
  table(
    ['[@GM_PCT]', '[@GM_PCT_cmp_a]', '[@GM_PCT_cmp_b]', '[@OPEX_PCT]', '[@OPEX_PCT_cmp_a]', '[@OPEX_PCT_cmp_b]', '[@GMV]', '[@GMV_cmp_a]', '[@GMV_cmp_b]'],
    [[0.56, 0.563, 0.569, 0.39, 0.39, 0.421, 11315.0, 10943.0, 8730.0]]
  ),
  table(
    ['[@MERCHANTS]', '[@MERCHANTS_cmp_a]', '[@MERCHANTS_cmp_b]', '[@ARR]', '[@ARR_cmp_a]', '[@ARR_cmp_b]', '[@MIX]', '[@MIX_pay]', '[@MIX_py]', '[@MIX_pay_py]'],
    [[124291, 128135, 108420, 262.8, 268.1, 215.6, 0.375, 0.453, 0.401, 0.427]]
  ),
  table(['[@FY_OUTLOOK]', '[@FY_OUTLOOK_bud]', '[@FY_OUTLOOK_e]', '[@FY_OUTLOOK_e_bud]'], [[667.4, 658.2, 82.8, 83.1]]),
];
const S_FILTER: FilterState = { ...filter, entity: 'S', fiscalYear: 2025, month: 12, timeView: 'fy' };

describe('Vitals (redesign v4, build-brief §1)', () => {
  const meta = mapVitalsMeta(VITALS_META);

  it('orders the cards by vitals_slot, three tiers, and validates the tier / better_when', () => {
    expect(meta.map((m) => [m.slot, m.tier])).toEqual([[1, 'hero'], [2, 'hero'], [3, 'hero'], [4, 'secondary'], [5, 'secondary'], [6, 'driver'], [7, 'driver'], [8, 'driver'], [9, 'driver'], [10, 'driver']]);
    expect(() => mapVitalsMeta(table(VITALS_META.columns.map((c) => c.name), [['S', 1, 'Huge', 'X', 'x', 'Higher', 'AMT', '']]))).toThrow(PnlModelError);
  });

  it('prints the quoted Commerce Cloud FY2025 heroes with Δ rows vs Budget / Prior year and the status chip (parity check §4)', () => {
    const { results, drivers } = mapVitals(meta, VITALS_VALUES, S_FILTER);
    expect(results.map((c) => [c.label, c.value])).toEqual([
      ['Net revenue', '$667.4 m'],
      ['Adjusted EBITDA', '$82.8 m'],
      ['Operating profit', '$48.6 m'],
      ['Gross margin %', '56.0%'],
      ['Opex % of NR', '39.0%'],
    ]);
    expect(drivers.map((c) => c.label)).toEqual(['GMV processed', 'Active merchants (period end)', 'ARR (period end)', 'Subscription share of NR', 'FY outlook (net revenue)']);
    const nr = results[0];
    expect(nr.rows).toEqual([
      { name: 'vs Budget', abs: '+9.2', rel: '+1.4%', tone: 'ahead' },
      { name: 'vs Prior year', abs: '+153.6', rel: '+29.9%', tone: 'neutral' },
    ]);
    expect(nr.status).toEqual({ kind: 'ahead', text: 'ahead' });
    // ⓘ copy from the shared block (docs/ADD/features/info-popovers.md), not the model's definition.
    expect(nr.info).toMatchObject({ title: 'Net revenue', what: expect.stringMatching(/^Gross revenue less gross-to-net deductions/), formula: 'NR = GR + GTN; Δ = actual − comparison, % of |comparison|', source: expect.stringMatching(/^KPI Value K-01/) });
    expect(results[4].info.title).toBe('Opex % revenue');
    expect(results[1]).toMatchObject({ status: { kind: 'ontrack', text: 'on track' }, rows: [{ name: 'vs Budget', abs: '−0.3', rel: '−0.4%', tone: 'plan' }, expect.anything()] });
    expect(results[2]).toMatchObject({ status: { kind: 'off' }, rows: [{ name: 'vs Budget', abs: '−1.6', rel: '−3.2%', tone: 'off' }, expect.anything()] });
  });

  it('ratio cards: pp rows without an amount, "on plan" for a zero Δ, "lower is better" inverted on Opex %', () => {
    const { results, drivers } = mapVitals(meta, VITALS_VALUES, S_FILTER);
    expect(results[3].rows).toEqual([
      { name: 'vs Budget', abs: null, rel: '−0.3 pp', tone: 'plan' },
      { name: 'vs Prior year', abs: null, rel: '−0.9 pp', tone: 'neutral' },
    ]);
    expect(results[3].status?.kind).toBe('ontrack');
    expect(results[4].rows[0]).toEqual({ name: 'vs Budget', abs: null, rel: 'on plan', tone: 'plan' });
    expect(results[4].rows[1]).toEqual({ name: 'vs Prior year', abs: null, rel: '−3.1 pp', tone: 'neutral' });
    expect(results[4].status?.kind).toBe('ontrack');
    // Drivers: GMV ahead (+3.4 %), merchants watch (−3.0 %, an integer KPI), ARR watch (−2.0 %).
    expect(drivers[0]).toMatchObject({ value: '$11,315.0 m', status: { kind: 'ahead' }, rows: [{ abs: '+372.0', rel: '+3.4%', tone: 'ahead' }, expect.anything()] });
    expect(drivers[1]).toMatchObject({ value: '124,291', status: { kind: 'watch' }, rows: [{ abs: '−3,844', rel: '−3.0%', tone: 'watch' }, expect.anything()] });
    expect(drivers[2]).toMatchObject({ value: '$262.8 m', status: { kind: 'watch' }, rows: [{ abs: '−5.3', rel: '−2.0%', tone: 'watch' }, expect.anything()] });
  });

  it('revenue mix shows Sub % / Pay % with one row vs prior year in pp and no chip (PV-04); FY outlook compares with the FY Budget', () => {
    const { drivers } = mapVitals(meta, VITALS_VALUES, S_FILTER);
    expect(drivers[3]).toMatchObject({ value: '37.5% / 45.3%', status: null, rows: [{ name: 'Sub / Pay vs PY', abs: null, rel: '−2.6 pp / +2.6 pp', tone: 'neutral' }] });
    expect(drivers[4]).toMatchObject({
      value: '$667.4 m',
      status: { kind: 'ahead' },
      rows: [
        { name: 'vs FY Budget', abs: '+9.2', rel: '+1.4%', tone: 'ahead' },
        { name: 'EBITDA vs FY Bud', abs: '−0.3', rel: '−0.4%', tone: 'neutral' },
      ],
    });
  });

  it('the chip compares with Budget whatever Compare A is (PV-01): Compare A = Prior year reads the `_bud` column, the Budget row is the coloured one', () => {
    const f: FilterState = { ...S_FILTER, compareA: 'PY', compareB: 'NONE' };
    const values = [table(['[@NR]', '[@NR_cmp_a]', '[@NR_bud]'], [[667.4, 513.8, 658.2]])];
    const { results } = mapVitals(meta.filter((m) => m.code === 'NR'), values, f);
    expect(results[0].status).toEqual({ kind: 'ahead', text: 'ahead' });
    expect(results[0].rows).toEqual([{ name: 'vs Prior year', abs: '+153.6', rel: '+29.9%', tone: 'neutral' }]);
    // Compare B = Budget: the Budget row carries the status colour and no `_bud` column is needed.
    const g: FilterState = { ...S_FILTER, compareA: 'PY', compareB: 'BUD' };
    const { results: r2 } = mapVitals(meta.filter((m) => m.code === 'NR'), [table(['[@NR]', '[@NR_cmp_a]', '[@NR_cmp_b]'], [[667.4, 513.8, 658.2]])], g);
    expect(r2[0].rows.map((r) => [r.name, r.tone])).toEqual([['vs Prior year', 'neutral'], ['vs Budget', 'ahead']]);
    expect(() => mapVitals(meta.filter((m) => m.code === 'NR'), [table(['[@NR]', '[@NR_cmp_a]'], [[667.4, 513.8]])], f)).toThrow(/missing column @NR_bud/);
  });

  it('n/a rows without a chip when a side is blank; the info zone maps the KPI Info Sub texts per code', () => {
    const { results } = mapVitals(meta.filter((m) => m.code === 'NR'), [table(['[@NR]', '[@NR_cmp_a]', '[@NR_cmp_b]'], [[667.4, null, 513.8]])], S_FILTER);
    expect(results[0].rows[0]).toEqual({ name: 'vs Budget', abs: null, rel: 'n/a', tone: 'neutral' });
    expect(results[0].status).toBeNull();
    expect(mapVitalsInfo(['NR', 'OP'], [table(['[@NR_i]', '[@OP_i]'], [['Organic growth +27.5%', null]])])).toEqual({ NR: 'Organic growth +27.5%' });
  });
});

// --- Q3: net revenue bridge for S, FY2025 (Track C numbers: 658.2 → 655.6 → +11.8 → 667.4) ---
const BRIDGE_S = table(
  ['[step_code]', '[step_label]', '[step_sort]', '[@delta]', '[@is_total]'],
  [
    ['START', 'Comparison NR', 10, 658.2, 1],
    ['SVC_SUB', 'Platform subscriptions', 21, -4.6, 0],
    ['SVC_PAY', 'Payments', 22, 11.0, 0],
    ['SVC_APP', 'Apps, partners & ads', 23, -3.4, 0],
    ['SVC_PS', 'Professional services', 24, -5.6, 0],
    ['CC_SUB', 'Constant-currency NR', 80, 0, 1],
    ['FX', 'FX', 90, 11.8, 0],
    ['END', 'Actual NR', 99, 0, 1],
    ['END', 'Actual NR', 999, 667.4, 2],
  ]
);

describe('net revenue bridge (C-40, redesign v4)', () => {
  it('draws comparison → service lines → constant-currency subtotal → FX → actual, with step % labels and the ⓘ values', () => {
    const bridge = mapBridge(BRIDGE_S, S_FILTER);
    expect(bridge.steps.map((s) => s.label)).toEqual(['Budget', 'Platform subscriptions', 'Payments', 'Apps, partners & ads', 'Professional services', 'Constant currency', 'FX', 'Actual']);
    expect(bridge.steps.map((s) => s.kind)).toEqual(['total', 'unf', 'fav', 'unf', 'unf', 'subtotal', 'fx', 'total']);
    expect(bridge.steps.map((s) => s.valueText)).toEqual(['$658.2 m', '−4.6', '+11.0', '−3.4', '−5.6', '$655.6 m', '+11.8', '$667.4 m']);
    expect(bridge.steps.map((s) => s.sub)).toEqual([null, '−0.7%', '+1.7%', '−0.5%', '−0.9%', '−0.4%', null, '+1.4%']);
    expect(bridge.subtitle).toMatch(/^Change by service line/);
    expect(bridge.info.what).toMatch(/^Budget to actual: driver steps at constant currency/);
    expect(bridge.info.formula).toMatch(/^service-line step = NRcc actual − NRcc comparison per line; CC subtotal/);
    expect(bridge.info.values).toEqual([
      { label: 'Reported Δ vs Budget', value: '+$9.2 m (+1.4%)' },
      { label: 'Constant-currency Δ', value: '−$2.6 m (−0.4%)' },
      { label: 'FX', value: '+$11.8 m' },
    ]);
    // The subtotal sits at the running level; FX lifts it to the actual level (T-05).
    const cc = bridge.steps[5];
    const fx = bridge.steps[6];
    expect(fx.bottomPct).toBeCloseTo(cc.heightPct, 1);
    expect(fx.bottomPct + fx.heightPct).toBeCloseTo(bridge.steps[7].heightPct, 1);
  });

  it('labels the START total with the C-40 comparison and flags steps that do not reconcile (the Group gap, T-05)', () => {
    const start = (f: Partial<FilterState>) => mapBridge(BRIDGE_S, { ...S_FILTER, ...f }).steps[0].label;
    expect(start({ compareA: 'LE' })).toBe('Latest est.');
    expect(start({ compareA: 'NONE', compareB: 'PY' })).toBe('Prior year');
    const gap = table(BRIDGE_S.columns.map((c) => c.name), BRIDGE_S.rows.map((r) => (r[0] === 'END' && r[4] === 2 ? ['END', 'Actual NR', 999, 773.7, 2] : r)));
    expect(mapBridge(gap, S_FILTER).info.values.at(-1)).toEqual({ label: 'Steps not reconciling to the actual level (T-05)', value: '−$106.3 m' });
    expect(() => mapBridge(table(BRIDGE_S.columns.map((c) => c.name), [['VOL', 'Volume', 20, -1, 0]]), S_FILTER)).toThrow(PnlModelError);
  });
});

// --- QP: profit bridge for S, FY2025 (Track C numbers) ------------------------
const PROFIT_S = table(
  ['[step_code]', '[step_label]', '[step_sort]', '[@delta]', '[@is_total]'],
  [
    ['BUD', 'Comparison Adj. EBITDA', 10, 82.9, 1],
    ['VOL', 'Revenue volume', 20, -1.5, 0],
    ['GM_RATE', 'GM rate', 30, 0.0, 0],
    ['GM_MIX', 'GM mix', 40, -1.4, 0],
    ['VSC', 'Variable selling', 50, 0.2, 0],
    ['SM', 'S&M', 60, 0.5, 0],
    ['RD', 'R&D', 70, 0.5, 0],
    ['GA', 'G&A', 80, 0.2, 0],
    ['OOI', 'Other operating', 90, -0.1, 0],
    ['FX', 'FX', 100, 1.5, 0],
    ['ACT', 'Adj. EBITDA', 110, 0, 1],
    ['DA', 'D&A', 120, -31.0, 0],
    ['ADJ', 'Adjusting items', 130, -3.2, 0],
    ['OP', 'Operating profit', 140, 0, 1],
    ['CMP_DA', '', 901, -30.1, 0],
    ['CMP_ADJ', '', 902, -4.1, 0],
    ['CMP_OP', '', 903, 50.2, 0],
  ]
);

describe('profit bridge (redesign v4)', () => {
  it('runs comparison EBITDA → changes → FX → actual EBITDA (subtotal) → D&A, adjusting items (levels) → operating profit, with Δ labels on the levels', () => {
    const b = mapProfitBridge(PROFIT_S, S_FILTER);
    expect(b.steps.map((s) => s.kind)).toEqual(['total', 'unf', 'fav', 'unf', 'fav', 'fav', 'fav', 'fav', 'unf', 'fx', 'subtotal', 'level', 'level', 'total']);
    expect(b.steps[0]).toMatchObject({ label: 'Budget EBITDA', valueText: '$82.9 m', sub: null });
    expect(b.steps[10]).toMatchObject({ label: 'Adj. EBITDA', valueText: '$82.8 m', sub: 'Δ −0.1' });
    expect(b.steps[11]).toMatchObject({ label: 'D&A', valueText: '−31.0', sub: 'Δ −0.9' });
    expect(b.steps[12]).toMatchObject({ label: 'Adjusting items', valueText: '−3.2', sub: 'Δ +0.9' });
    expect(b.steps[13]).toMatchObject({ label: 'Operating profit', valueText: '$48.6 m', sub: 'Δ −1.6' });
    expect(b.subtitle).toBe('Budget Adj. EBITDA → Actual → Operating profit');
    expect(b.info.values).toEqual([
      { label: 'Adj. EBITDA Δ vs Budget', value: '−$0.1 m' },
      { label: 'of which FX', value: '+$1.5 m' },
      { label: 'Δ at constant currency', value: '−$1.6 m' },
      { label: 'Operating profit Δ vs Budget', value: '−$1.6 m' },
    ]);
    expect(() => mapProfitBridge(table(PROFIT_S.columns.map((c) => c.name), [['VOL', 'Revenue volume', 20, -1, 0]]), S_FILTER)).toThrow(PnlModelError);
  });
});

// --- QL: variance leaves (three of them) and a cut --------------------------
const LEAVES = table(
  ['dim_pl_row[row_key]', 'dim_pl_row[line_code]', 'dim_pl_row[line_label]', 'dim_pl_row[account_code]', 'dim_pl_row[account_label]', 'dim_pl_row[line_sort]', 'dim_pl_row[account_sort]', '[@base]', '[@cmp]', '[@d_b]', '[@fx]', '[@below_cm]'],
  [
    ['GR|GR_P1', 'GR', 'Gross revenue', 'GR_P1', 'Gross product sales', 10, 10, 4302.3611, 4371.877, 329.76, 12.1, false],
    ['SM|SM_P1', 'SM', 'Sales & marketing', 'SM_P1', 'Advertising: working media', 110, 400, -221.9509, -240.2039, -15.3, -0.4, true],
    ['COR|COR_P2', 'COR', 'Cost of revenue', 'COR_P2', 'Sourced finished goods', 40, 170, -452.3033, -466.8099, -28.4, null, false],
    ['TAX|TAX_P1', 'TAX', 'Income tax expense', 'TAX_P1', 'Income tax', 260, 900, -125.1, -130.2, -13.9, -0.2, true],
    ['OOI|OOI_P9', 'OOI', 'Other operating income', 'OOI_P9', 'Not in this entity', 200, 10, null, null, null, null, false],
  ]
);

describe('largest variances zone (C-45)', () => {
  it('maps the leaves with their level columns and derives the AI assistant\'s top 8 (Gross product sales −69.5 (−1.6%), working media +18.3 (+7.6%))', () => {
    const zone = mapVarianceLeaves(LEAVES);
    expect(zone.leaves).toHaveLength(4); // the all-blank OOI_P9 leaf is dropped
    expect(zone.leaves.map((l) => l.rowKey)).not.toContain('OOI|OOI_P9');
    expect(zone.leaves[1]).toMatchObject({ rowKey: 'SM|SM_P1', code: 'SM_P1', block: 'SM', blockName: 'Sales & marketing', base: -221.9509, comparison: -240.2039, deltaB: -15.3, fx: -0.4, belowCm: true });
    expect(zone.leaves[2].fx).toBeNull();
    const drivers = driversFromVariances(zone, filter);
    expect(drivers.map((d) => d.name)).toEqual(['Gross product sales', 'Advertising: working media', 'Sourced finished goods']);
    expect(drivers[0]).toMatchObject({ block: 'Gross revenue', deltaText: '−69.5', deltaPctText: '−1.6%', tone: 'unf' });
    expect(drivers[1]).toMatchObject({ block: 'Sales & marketing', deltaText: '+18.3', deltaPctText: '+7.6%', tone: 'fav' });
    expect(driversFromVariances(zone, { ...filter, units: 'k' })[0].deltaText).toBe('−69,516');
  });

  it('maps the cut members in the reference order with their deltas per leaf', () => {
    const cut = table(
      ['[row_key]', '[@member]', '[@name]', '[@in_view]', '[@d]'],
      [
        ['GR|GR_P1', 'UK', 'UK & Ireland', 1, -10.5],
        ['GR|GR_P1', 'NA', 'North America', 1, -40.0],
        ['SM|SM_P1', 'NA', 'North America', 1, 12.0],
        ['SM|SM_P1', 'XX', 'Unknown', 1, null],
      ]
    );
    const members = mapVarianceMembers(cut, { ...filter, varCut: 'region' }, reference);
    expect(members.cut).toBe('region');
    expect(members.members).toEqual([
      { key: 'NA', label: 'North America' },
      { key: 'UK', label: 'UK & Ireland' },
    ]);
    expect(members.deltas).toEqual({ 'GR|GR_P1': { UK: -10.5, NA: -40.0 }, 'SM|SM_P1': { NA: 12.0 } });
    expect(() => mapVarianceMembers(cut, filter, reference)).toThrow(PnlModelError);
  });
});

// --- Q5: profitability by region for S at constant currency (Track C numbers) ----
const PROF_S = table(
  ['[@code]', '[@name]', '[@in_view]', '[@nr]', '[@nr_d_pct]', '[@gm]', '[@cm]', '[@cm_d_pp]', '[@contrib]', '[@ebitda]'],
  [
    ['TOTAL', 'Total', 1, 655.6, -0.004, 0.56, 0.513, -0.2, 336.3, 81.3],
    ['NA', 'North America', 1, 358.0, 0.012, 0.531, 0.509, -1.2, 182.2, 43.0],
    ['EU', 'Continental Europe', 1, 153.7, -0.049, 0.59, 0.52, 0.4, 79.9, 20.1],
    [null, null, 1, null, null, null, null, null, null, null],
  ]
);

describe('profitability table (C-46, redesign v4)', () => {
  it('prints the eight columns, the status dot on CM Δ only, the total last and the CC subtitle from the selection', () => {
    const p = mapProfitability(PROF_S, S_FILTER, reference);
    expect(p).toMatchObject({ by: 'region', column: 'Region', compareLabel: 'Budget', allocated: false });
    expect(p.subtitle).toBe('Constant currency (FY2025 budget rates) - USD m - vs Budget - opex booked by region, allocated for other breakdowns');
    expect(p.rows.map((r) => r.name)).toEqual(['North America', 'Continental Europe', 'Total']);
    expect(p.rows[0]).toEqual({ key: 'NA', name: 'North America', nrText: '358.0', nrDeltaText: '+1.2%', gm: '53.1%', cm: '50.9%', cmDeltaText: '−1.2 pp', cmStatus: 'off', contributionText: '182.2', ebitdaText: '43.0', total: false });
    expect(p.rows[1].cmStatus).toBe('ahead');
    expect(p.rows[2]).toMatchObject({ total: true, nrText: '655.6', nrDeltaText: '−0.4%', cm: '51.3%', cmDeltaText: '−0.2 pp', cmStatus: 'ontrack', ebitdaText: '81.3' });
    expect(p.info.values[0]).toEqual({ label: 'Comparison', value: 'Budget' });
    expect(p.info.what).toMatch(/Δ vs Budget % on net revenue/);
    expect(p.info.formula).toBe('GM % = GP ÷ NR; CM % = contribution ÷ NR; CM Δ = CM % − comparison CM %');
  });

  it('follows the breakdown index (allocated below Region / Company) and the Group options; the comparison per C-40', () => {
    expect(breakdownOptions({ entity: 'G' }, reference)).toEqual(['Region', 'Company']);
    expect(breakdownOptions({ entity: 'S' }, reference)).toEqual(['Region', 'Sales motion', 'Service line', 'Customer segment']);
    const byLine = mapProfitability(PROF_S, { ...S_FILTER, breakdown: { ...S_FILTER.breakdown, S: 2 } }, reference);
    expect(byLine).toMatchObject({ by: 'service line', column: 'Service line', allocated: true });
    expect(mapProfitability(PROF_S, { ...S_FILTER, entity: 'G', breakdown: { ...S_FILTER.breakdown, G: 1 } }, reference)).toMatchObject({ column: 'Company', allocated: false });
    expect(mapProfitability(PROF_S, { ...S_FILTER, compareA: 'NONE', compareB: 'NONE' }, reference).compareLabel).toBe('Prior year');
    expect(profitabilitySubtitle({ ...S_FILTER, entity: 'G', currency: 'EUR', units: 'k' })).toBe('Constant currency (FY2025 budget rates) - EUR k - vs Budget');
  });
});

// --- QC, QB, QH ------------------------------------------------------------------
const CONC = table(
  ['dim_conc_level[level_code]', 'dim_conc_level[level_label]', 'dim_conc_level[level_sort]', 'dim_region[region_code]', 'dim_region[region_name]', '[@share]'],
  [
    ['CM', 'Contribution', 2, 'EU', 'Continental Europe', 0.238],
    ['CM', 'Contribution', 2, 'NA', 'North America', 0.542],
    ['EBITDA', 'Adj. EBITDA', 3, 'EU', 'Continental Europe', 0.247],
    ['EBITDA', 'Adj. EBITDA', 3, 'NA', 'North America', 0.524],
    ['NR', 'Net revenue', 1, 'EU', 'Continental Europe', 0.234],
    ['NR', 'Net revenue', 1, 'NA', 'North America', 0.546],
  ]
);

describe('concentration, growth × margin and the mix heatmap (redesign v4 Profitability)', () => {
  it('concentration: levels in order, regions by NR share, the drift from NR to EBITDA share in pp', () => {
    const c = mapConcentration(CONC, S_FILTER);
    expect(c.levels.map((l) => l.label)).toEqual(['Net revenue', 'Contribution', 'Adj. EBITDA']);
    expect(c.levels[0].segments.map((s) => [s.key, s.text])).toEqual([
      ['NA', '54.6%'],
      ['EU', '23.4%'],
    ]);
    expect(c.levels[2].segments[0].share).toBeCloseTo(0.524, 6);
    expect(c.legend).toEqual([
      { key: 'NA', label: 'North America', drift: '54.6% → 52.4% (−2.2 pp)' },
      { key: 'EU', label: 'Continental Europe', drift: '23.4% → 24.7% (+1.3 pp)' },
    ]);
    expect(c.info.values[0]).toEqual({ label: 'North America', value: '54.6% / 54.2% / 52.4%' });
  });

  it('bubble: points by NR with their labels, the company references, no trails yet', () => {
    const b = mapBubble(
      table(
        ['[@code]', '[@name]', '[@growth]', '[@cm]', '[@nr]'],
        [
          ['COMPANY', 'Company', 0.275, 0.513, 655.6],
          ['EU', 'Continental Europe', 0.312, 0.52, 153.7],
          ['NA', 'North America', 0.278, 0.509, 358.0],
          ['XX', 'No growth', null, 0.5, 10],
        ]
      ),
      S_FILTER
    );
    expect(b.points.map((p) => p.key)).toEqual(['NA', 'EU']);
    expect(b.points[0]).toMatchObject({ label: 'North America', x: 0.278, y: 0.509, size: 358.0, text: 'CM 50.9% - +27.8%', detail: 'North America: NR $358.0 m, growth +27.8%, CM 50.9%', trail: null });
    expect(b.ref).toEqual({ x: 0.275, y: 0.513, xText: 'company +27.5%', yText: 'company 51.3%' });
    expect(b.info.values.at(-1)).toEqual({ label: 'Prior-year trails', value: 'n/a: no per-region prior-year growth measure in the model yet (C-04)' });
    expect(mapBubble(table(['[@code]', '[@name]', '[@growth]', '[@cm]', '[@nr]'], []), S_FILTER)).toMatchObject({ points: [], ref: null });
  });

  it('heat: cells with the share of the region, totals from the model, columns with their GM % (the fill), regions by NR', () => {
    const h = mapHeat(
      table(
        ['[@region]', '[@region_name]', '[@line]', '[@line_name]', '[@line_sort]', '[@nr]', '[@gm]'],
        [
          ['EU', 'Continental Europe', 'PAY', 'Payments', 2, 60.0, 0.3],
          ['EU', 'Continental Europe', 'SUB', 'Platform subscriptions', 1, 70.0, 0.8],
          ['NA', 'North America', 'PAY', 'Payments', 2, 170.0, 0.31],
          ['NA', 'North America', 'SUB', 'Platform subscriptions', 1, 120.0, 0.82],
          ['', '', 'PAY', 'Payments', 2, 230.0, 0.306],
          ['', '', 'SUB', 'Platform subscriptions', 1, 190.0, 0.81],
          ['EU', 'Continental Europe', '', '', 0, 153.7, 0.59],
          ['NA', 'North America', '', '', 0, 358.0, 0.531],
          ['', '', '', '', 0, 655.6, 0.56],
        ]
      ),
      S_FILTER
    );
    expect(h.rows.map((r) => r.label)).toEqual(['North America', 'Continental Europe']);
    expect(h.cols.map((c) => [c.label, c.gm, c.gmText, c.total])).toEqual([
      ['Platform subscriptions', 0.81, 'GM 81.0%', '190.0'],
      ['Payments', 0.306, 'GM 30.6%', '230.0'],
    ]);
    expect(h.rows[0].cells.map((c) => [c.text, c.share])).toEqual([
      ['120.0', '34%'],
      ['170.0', '47%'],
    ]);
    expect(h.rows[0].cells[1].detail).toBe('North America × Payments: NR 170.0 m, 47% of the region, GM 31.0%');
    expect(h.rows[0].total).toBe('358.0');
    expect(h.grand).toBe('655.6');
  });
});

// --- Q6: context for P, Dec selected (probe q6-context-smoke) ---------------
const CONTEXT_P = table(
  ['[@status]', '[@notices]', '[@prof_note]', '[@cm_pct]'],
  [[
    'Closed through Sep 2026  ·  Refreshed 21 Oct 2026 18:00',
    'Actuals closed through Sep 2026: later months excluded; use Latest estimate for the full window   |   Slice filter on: lines from operating expenses down are allocated by net-revenue share',
    'EBITDA and operating margins by slice are indicative: lines below contribution margin are allocated by NR share.',
    0.3914539833181823,
  ]]
);

describe('context (C-50, N-02)', () => {
  it('splits the model’s notices and carries the data status, note and CM average', () => {
    const c = mapContext(CONTEXT_P);
    expect(c.dataStatus).toBe('Closed through Sep 2026  ·  Refreshed 21 Oct 2026 18:00');
    expect(c.notices).toEqual([
      'Actuals closed through Sep 2026: later months excluded; use Latest estimate for the full window',
      'Slice filter on: lines from operating expenses down are allocated by net-revenue share',
    ]);
    expect(c.profitabilityNote).toMatch(/^EBITDA and operating margins/);
    expect(c.cmAverage).toBeCloseTo(0.39145, 4);
    // `@refreshed` is optional (older captures lack it); when present it is passed through as text.
    expect(c.refreshedAt).toBeNull();
    const withRefresh = table([...CONTEXT_P.columns.map((c) => c.name), '[@refreshed]'], [[...CONTEXT_P.rows[0], '2026-10-22T13:53:00']]);
    expect(mapContext(withRefresh).refreshedAt).toBe('2026-10-22T13:53:00');
    expect(mapContext(table(CONTEXT_P.columns.map((c) => c.name), [['s', '', '', null]])).notices).toEqual([]);
    expect(() => mapContext(table(CONTEXT_P.columns.map((c) => c.name), []))).toThrow(PnlModelError);
  });
});

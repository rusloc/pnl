// Model result tables → zone shapes (ADR-0006 phase 2). Fixtures are rows the
// published model returned on 2026-10-22 through `rayfin connector invoke`
// (rayfin/probes/q*-smoke.query.json) for Consumer Products / Group, FY2026 YTD
// Sep, Actual vs Budget and Prior year, USD, millions — so the mapped texts must
// equal the control totals (data/acme_pl_dummy_data/checks/control_totals_usd.csv)
// and the Ledger mockup where both cover the same cell.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it } from 'vitest';

import { defaultFilters } from '../model/filters';
import type { FilterState } from '../model/types';
import { PnlModelError } from './pnl-model-client';
import {
  bridgeComparison,
  breakdownOptions,
  kpiValueText,
  mapBridge,
  mapContext,
  mapDrivers,
  mapKpiMeta,
  mapKpiTiles,
  mapProfitability,
} from './pnl-model-figures';
import { sampleReference } from './sample-reference';

const reference = sampleReference();
const filter: FilterState = defaultFilters(reference);

const table = (names: string[], rows: unknown[][]): QueryTable => ({
  columns: names.map((name) => ({ name, dataType: 'String' })),
  rows,
});

// --- Q2a: dim_kpi rows for P (probe k3-meta) ---------------------------------
const KPI_META = table(
  ['dim_kpi[entity_view_code]', 'dim_kpi[slot]', 'dim_kpi[kpi_code]', 'dim_kpi[kpi_label]', 'dim_kpi[kpi_group]', 'dim_kpi[better_when]', 'dim_kpi[value_type]', 'dim_kpi[definition]'],
  [
    ['P', 3, 'GM_PCT', 'Gross margin %', 'Financial', 'Higher', 'PCT', 'Gross profit / NR'],
    ['P', 1, 'NR', 'Net revenue', 'Financial', 'Higher', 'AMT', 'Gross revenue + gross-to-net deductions'],
    ['P', 2, 'ORG_GROWTH', 'Organic growth vs PY', 'Financial', 'Higher', 'PCT', 'NR at constant currency / PY NR at the same rates - 1'],
    ['P', 4, 'GTN_PCT', 'Gross-to-net %', 'Financial', 'Lower', 'PCT', '- gross-to-net deductions / gross revenue'],
    ['P', 10, 'NR_PER_UNIT', 'Net revenue per unit', 'Operational', 'Higher', 'PRICE', 'NR / units sold'],
    ['P', 9, 'UNITS', 'Units sold', 'Operational', 'Higher', 'CNT', 'Units shipped in the window'],
  ]
);

// --- Q2b: values (probe k1-fin-a: NR, ORG_GROWTH, GM_PCT, GTN_PCT; t2: UNITS, NR_PER_UNIT) ---
const KPI_VALUES: QueryTable[] = [
  table(
    ['[@NR]', '[@NR_a]', '[@NR_b]', '[@NR_s]', '[@ORG_GROWTH]', '[@ORG_GROWTH_a]', '[@ORG_GROWTH_b]', '[@ORG_GROWTH_s]', '[@GM_PCT]', '[@GM_PCT_a]', '[@GM_PCT_b]', '[@GM_PCT_s]'],
    [[3398.5219426605, -0.019128599306347662, 0.08246880445391276, null, 0.060786957516311135, -3.016150456932576, 6.0786957516311135, 'Reported +8.2%', 0.4941001143709982, -0.41203953323923903, 0.03054340767127961, null]]
  ),
  table(
    ['[@GTN_PCT]', '[@GTN_PCT_a]', '[@GTN_PCT_b]', '[@GTN_PCT_s]', '[@UNITS]', '[@UNITS_a]', '[@UNITS_b]', '[@UNITS_s]', '[@NR_PER_UNIT]', '[@NR_PER_UNIT_a]', '[@NR_PER_UNIT_b]', '[@NR_PER_UNIT_s]'],
    [[0.21348738290488004, 0.2684416640451187, 0.07506272058351582, null, 419.838143, -0.0171, 0.039, null, 8.094838449827318, -0.002, 0.042, null]]
  ),
];

describe('KPI tiles (§5)', () => {
  const meta = mapKpiMeta(KPI_META);

  it('orders the slots and validates group / better_when', () => {
    expect(meta.map((m) => m.slot)).toEqual([1, 2, 3, 4, 9, 10]);
    expect(() => mapKpiMeta(table(KPI_META.columns.map((c) => c.name), [['P', 1, 'X', 'x', 'Other', 'Higher', 'AMT', '']]))).toThrow(PnlModelError);
  });

  it('prints the control total on the net revenue tile with Δ vs Budget and Prior year (K-20, T-06 at the app boundary)', () => {
    const { financial } = mapKpiTiles(meta, KPI_VALUES, filter);
    const nr = financial.find((t) => t.label === 'Net revenue')!;
    expect(nr.value).toBe('$3,398.5m');
    expect(nr.hint).toBe('Gross revenue + gross-to-net deductions');
    expect(nr.deltas).toEqual([
      { name: 'vs Budget', text: '−1.9%', tone: 'unf', arrow: true },
      { name: 'vs Prior year', text: '+8.2%', tone: 'fav', arrow: true },
    ]);
  });

  it('shows percent KPIs with pp deltas, inverts the colour when lower is better (K-21) and drops Δ on growth KPIs', () => {
    const { financial } = mapKpiTiles(meta, KPI_VALUES, filter);
    const gm = financial.find((t) => t.label === 'Gross margin %')!;
    expect(gm.value).toBe('49.4%');
    expect(gm.deltas.map((d) => d.text)).toEqual(['−0.4 pp', '0.0 pp']);
    expect(gm.deltas.map((d) => d.tone)).toEqual(['unf', 'neutral']);
    const gtn = financial.find((t) => t.label === 'Gross-to-net %')!;
    expect(gtn.value).toBe('21.3%');
    // +0.3 pp of deductions is unfavourable when lower is better.
    expect(gtn.deltas[0]).toEqual({ name: 'vs Budget', text: '+0.3 pp', tone: 'unf', arrow: true });
    const org = financial.find((t) => t.label === 'Organic growth vs PY')!;
    expect(org.value).toBe('+6.1%');
    expect(org.deltas).toEqual([{ name: 'Reported', text: '+8.2%', tone: 'neutral', arrow: false }]);
  });

  it('formats counts and prices by value_type and keeps operational tiles apart', () => {
    const { operational } = mapKpiTiles(meta, KPI_VALUES, filter);
    expect(operational.map((t) => t.value)).toEqual(['419.8m', '$8.09']);
    expect(mapKpiTiles(meta, KPI_VALUES, { ...filter, units: 'k', currency: 'EUR' }).financial[0].value).toBe('€3,398,522k');
    expect(kpiValueText(0.0266, 'PCT2', filter, false)).toBe('2.66%');
    expect(kpiValueText(138726, 'INT', filter, false)).toBe('138,726');
    expect(kpiValueText(null, 'AMT', filter, false)).toBe('n/a');
  });

  it('omits a comparison set to None and refuses a result without the chunk columns', () => {
    const { financial } = mapKpiTiles(meta, KPI_VALUES, { ...filter, compareB: 'NONE' });
    expect(financial[0].deltas.map((d) => d.name)).toEqual(['vs Budget']);
    expect(() => mapKpiTiles(meta, [KPI_VALUES[0]], filter)).toThrow(/missing column @GTN_PCT/);
  });
});

// --- Q3: Group bridge (probe q3-bridge-smoke), steps from the model + END = Net Revenue ---
const BRIDGE_G = table(
  ['[step_code]', '[step_label]', '[step_sort]', '[@value]'],
  [
    ['START', 'Comparison NR', 10, 4045.4342],
    ['ENT_P', 'Consumer Products', 41, -95.7915],
    ['ENT_S', 'Commerce Cloud', 42, -10.5085],
    ['ELIM', 'Eliminations', 43, -106.3902],
    ['FX', 'FX', 90, 33.6434],
    ['END', 'Base', 999, 3972.6875],
  ]
);

describe('bridge (C-40)', () => {
  it('labels the totals with the versions, formats steps as signed deltas and keeps the model’s step labels', () => {
    const bridge = mapBridge(BRIDGE_G, { ...filter, entity: 'G' });
    expect(bridge.steps.map((s) => s.label)).toEqual(['Budget', 'Consumer Products', 'Commerce Cloud', 'Eliminations', 'FX', 'Actual']);
    expect(bridge.steps.map((s) => s.valueText)).toEqual(['$4,045.4m', '−95.8', '−10.5', '−106.4', '+33.6', '$3,972.7m']);
    expect(bridge.steps.map((s) => s.kind)).toEqual(['total', 'unf', 'unf', 'unf', 'fav', 'total']);
    expect(bridge.subtitle).toMatch(/^Change by company/);
    expect(bridge.axisText).toMatch(/^\$[\d,]+m$/);
  });

  it('shows the known T-05 gap honestly: the Group steps end 106.3 M short of the Actual total (model bug, bip)', () => {
    const bridge = mapBridge(BRIDGE_G, { ...filter, entity: 'G' });
    const stepsSum = 4045.4342 - 95.7915 - 10.5085 - 106.3902 + 33.6434;
    expect(3972.6875 - stepsSum).toBeCloseTo(106.3, 1);
    // The last step's top and the Actual bar's top differ: the chart does not pretend they meet.
    const fx = bridge.steps[4];
    const actual = bridge.steps[5];
    expect(Math.abs(fx.bottomPct + fx.heightPct - actual.heightPct)).toBeGreaterThan(5);
  });

  it('refuses a result without both totals', () => {
    expect(() => mapBridge(table(BRIDGE_G.columns.map((c) => c.name), [['VOL', 'Volume', 20, -1]]), filter)).toThrow(PnlModelError);
  });
});

// --- Q4: drivers for P (probe q4-variances-smoke) ---------------------------
const DRIVERS_P = table(
  ['dim_pl_row[row_key]', 'dim_pl_row[line_code]', 'dim_pl_row[line_label]', 'dim_pl_row[account_code]', 'dim_pl_row[account_label]', '[@base]', '[@cmp]', '[@d]', '[@d_pct]', '[@abs_d]'],
  [
    ['SM|SM_P1', 'SM', 'Sales & marketing', 'SM_P1', 'Advertising: working media', -221.9509, -240.2039, 18.253, 0.0759895230648985, 18252977.381],
    ['GR|GR_P1', 'GR', 'Gross revenue', 'GR_P1', 'Gross product sales', 4302.3611, 4371.877, -69.516, -0.015900712753983765, 69515960.7797],
    ['COR|COR_P2', 'COR', 'Cost of revenue', 'COR_P2', 'Sourced finished goods', -452.3033, -466.8099, 14.5066, 0.031076012525355964, 14506591.4454],
  ]
);

describe('largest variances (C-45)', () => {
  it('ranks by |Δ| and prints the mockup’s cells: Gross product sales −69.5 (−1.6%), working media +18.3 (+7.6%)', () => {
    const drivers = mapDrivers(DRIVERS_P, filter);
    expect(drivers.map((d) => d.name)).toEqual(['Gross product sales', 'Advertising: working media', 'Sourced finished goods']);
    expect(drivers[0]).toMatchObject({ block: 'Gross revenue', deltaText: '−69.5', deltaPctText: '−1.6%', tone: 'unf' });
    expect(drivers[1]).toMatchObject({ block: 'Sales & marketing', deltaText: '+18.3', deltaPctText: '+7.6%', tone: 'fav' });
    expect(mapDrivers(DRIVERS_P, { ...filter, units: 'k' })[0].deltaText).toBe('−69,516');
  });
});

// --- Q5: profitability by channel for P (probe q5-profitability-smoke) ------
const PROF_P = table(
  ['[@code]', '[@name]', '[@in_view]', '[@nr]', '[@share]', '[@nr_d_pct]', '[@gm]', '[@cm]', '[@ebitda]', '[@op]'],
  [
    ['GRO', 'Grocery & mass retail', 1, 1107.7233, 0.32594267626247236, -0.03789907748124347, 0.4940466351511016, 0.4362466349946812, 0.24564235953228106, 0.206693159078139],
    ['D2C', 'Own D2C webstore', 1, 484.4905, 0.14255917597660744, 0.012974950232676509, 0.4941349279094561, 0.31933492823429366, 0.12873449534341988, 0.08980006357166674],
  ]
);

describe('profitability by slice (C-46)', () => {
  it('prints the mockup row for Grocery & mass retail and names the breakdown and comparison', () => {
    const p = mapProfitability(PROF_P, 0.3914539833181823, 'note from the model', filter, reference);
    expect(p.by).toBe('channel');
    expect(p.column).toBe('Channel');
    expect(p.options).toEqual(['Region', 'Channel', 'Category', 'Price tier']);
    expect(p.compareLabel).toBe('Budget');
    expect(p.note).toBe('note from the model');
    expect(p.rows[0]).toMatchObject({
      name: 'Grocery & mass retail', nrText: '1,107.7', shareText: '32.6%',
      deltaPctText: '−3.8%', tone: 'unf', gm: '49.4%', cm: '43.6%', ebitda: '24.6%', op: '20.7%',
    });
    expect(p.rows[0].sharePct).toBeCloseTo(32.594, 3);
    expect(p.rows[1].tone).toBe('fav');
    expect(p.cmAverageText).toBe('39.1%');
    expect(p.cmAveragePct).toBeCloseTo(39.145, 2);
  });

  it('drops the model’s blank member row (Group by entity returned [null, null, 1, …] on 2026-10-22)', () => {
    const withBlank = table(PROF_P.columns.map((c) => c.name), [...PROF_P.rows, [null, null, 1, null, null, null, null, null, null, null]]);
    expect(mapProfitability(withBlank, null, '', filter, reference).rows.map((r) => r.name)).toEqual(['Grocery & mass retail', 'Own D2C webstore']);
  });

  it('follows the breakdown index and the Group options, and resolves the comparison per C-40', () => {
    expect(breakdownOptions({ entity: 'G' }, reference)).toEqual(['Region', 'Company']);
    expect(breakdownOptions({ entity: 'S' }, reference)).toEqual(['Region', 'Sales motion', 'Service line', 'Customer segment']);
    const byRegion = mapProfitability(PROF_P, null, '', { ...filter, breakdown: { ...filter.breakdown, P: 0 } }, reference);
    expect(byRegion.by).toBe('region');
    expect(byRegion.cmAverageText).toBe('');
    expect(bridgeComparison({ compareA: 'NONE', compareB: 'LE' })).toBe('LE');
    expect(bridgeComparison({ compareA: 'NONE', compareB: 'NONE' })).toBe('PY');
    expect(mapProfitability(PROF_P, null, '', { ...filter, compareA: 'NONE', compareB: 'NONE' }, reference).compareLabel).toBe('Prior year');
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
    expect(mapContext(table(CONTEXT_P.columns.map((c) => c.name), [['s', '', '', null]])).notices).toEqual([]);
    expect(() => mapContext(table(CONTEXT_P.columns.map((c) => c.name), []))).toThrow(PnlModelError);
  });
});

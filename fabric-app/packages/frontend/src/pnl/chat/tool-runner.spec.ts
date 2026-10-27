// The tool runner on a fake zone reader (ADR-0009 §2): one zone per tool, the
// views' own mappers, capped and aggregated results within the size budget,
// rejected arguments and failed zones reported as errors the model can read.
import { CHAT_BOUNDS, TOOL_ROW_CAPS } from '@rayfin-app/shared';
import { describe, expect, it, vi } from 'vitest';

import type { ZoneReader, ZoneResult } from '../data/data-source';
import { Q1_DEFAULT } from '../data/fixtures/q1-statement-parity.fixture';
import { mapVitalsMeta } from '../data/pnl-model-figures';
import { sampleReference } from '../data/sample-reference';
import { defaultFilters } from '../model/filters';
import type { FilterState, ZoneKey } from '../model/types';
import { fitPayload, runTool, type ToolRunContext } from './tool-runner';

const reference = sampleReference();
const current = defaultFilters(reference);

const col = (names: string[]) => names.map((name) => ({ name, dataType: 'String' }));

const vitalsMeta = {
  columns: col(['dim_kpi[vitals_slot]', 'dim_kpi[vitals_tier]', 'dim_kpi[kpi_code]', 'dim_kpi[kpi_label]', 'dim_kpi[better_when]', 'dim_kpi[value_type]', 'dim_kpi[definition]']),
  rows: [
    [1, 'Hero', 'NR', 'Net revenue', 'Higher', 'AMT', 'Revenue after discounts and returns.'],
    [4, 'Secondary', 'GM_PCT', 'Gross margin', 'Higher', 'PCT', 'Gross profit as a share of net revenue.'],
    [6, 'Driver', 'HEADCOUNT', 'Headcount', 'Neutral', 'INT', ''],
  ],
};
const vitalsValues = {
  columns: col(['[@NR]', '[@NR_cmp_a]', '[@NR_cmp_b]', '[@GM_PCT]', '[@GM_PCT_cmp_a]', '[@GM_PCT_cmp_b]', '[@HEADCOUNT]', '[@HEADCOUNT_cmp_a]', '[@HEADCOUNT_cmp_b]']),
  rows: [[3398.52, 3464.8, 3139.6, 0.4941, 0.4982, 0.4938, 1240, 1200, 1180]],
};
const vitalsInfo = { columns: col(['[@NR_i]', '[@GM_PCT_i]', '[@HEADCOUNT_i]']), rows: [['Organic growth +6.1% - reported +8.2% vs prior year', null, null]] };
const bridgeTable = {
  columns: col(['[step_code]', '[step_label]', '[step_sort]', '[@delta]', '[@is_total]']),
  rows: [
    ['START', 'Comparison NR', 0, 3464.8, 1],
    ['VOL', 'Volume', 1, 128.4, 0],
    ['PM', 'Price / mix', 2, -150.2, 0],
    ['CC_SUB', 'Constant-currency NR', 3, 0, 1],
    ['FX', 'FX', 4, -44.5, 0],
    ['END', 'Actual NR', 999, 3398.5, 2],
  ],
};
const variancesTable = {
  columns: col(['dim_pl_row[row_key]', 'dim_pl_row[line_code]', 'dim_pl_row[line_label]', 'dim_pl_row[account_code]', 'dim_pl_row[account_label]', 'dim_pl_row[line_sort]', 'dim_pl_row[account_sort]', '[@base]', '[@cmp]', '[@d_b]', '[@fx]', '[@below_cm]']),
  rows: Array.from({ length: 12 }, (_, i) => [`SM|a${i}`, 'SM', 'Sales & marketing', `a${i}`, `Account ${i}`, 110, i, -100 - i, -90, -5, -0.3, true]),
};
const profitabilityTable = {
  columns: col(['[@code]', '[@name]', '[@in_view]', '[@nr]', '[@nr_d_pct]', '[@gm]', '[@cm]', '[@cm_d_pp]', '[@contrib]', '[@ebitda]']),
  rows: [...Array.from({ length: 30 }, (_, i) => [`R${i}`, `Region ${i}`, 1, 100 - i, 0.02, 0.5, 0.4, -0.2, 40, 20]), ['TOTAL', 'Total', 1, 2535, 0.02, 0.5, 0.4, -0.2, 1200, 600]],
};
const contextTable = {
  columns: col(['[@status]', '[@notices]', '[@prof_note]', '[@cm_pct]', '[@refreshed]']),
  rows: [['Closed through Sep 2026', 'Actuals closed through Sep 2026: later months excluded   |   Slice filter on: allocated', 'Costs allocated by revenue share', 0.41, '2026-10-21T18:00:00']],
};

function reader(overrides: Partial<Record<ZoneKey, () => Promise<ZoneResult>>> = {}): ZoneReader & { calls: { zone: ZoneKey; filter: FilterState }[] } {
  const calls: { zone: ZoneKey; filter: FilterState }[] = [];
  const unused = (zone: ZoneKey) => async (): Promise<ZoneResult> => {
    throw new Error(`${zone} is not a chat zone`);
  };
  const base: Record<ZoneKey, () => Promise<ZoneResult>> = {
    statement: async () => ({ zone: 'statement', table: Q1_DEFAULT.new, requestId: 'r-s' }),
    vitals: async () => ({ zone: 'vitals', meta: mapVitalsMeta(vitalsMeta), values: [vitalsValues], requestId: 'r-k' }),
    vitalsInfo: async () => ({ zone: 'vitalsInfo', codes: ['NR', 'GM_PCT', 'HEADCOUNT'], tables: [vitalsInfo], requestId: 'r-i' }),
    bridge: async () => ({ zone: 'bridge', table: bridgeTable, requestId: 'r-b' }),
    variances: async () => ({ zone: 'variances', table: variancesTable, requestId: 'r-d' }),
    profitability: async () => ({ zone: 'profitability', table: profitabilityTable, requestId: 'r-p' }),
    context: async () => ({ zone: 'context', table: contextTable, requestId: 'r-c' }),
    profit: unused('profit'),
    variancesCut: unused('variancesCut'),
    concentration: unused('concentration'),
    bubble: unused('bubble'),
    heat: unused('heat'),
  };
  return {
    calls,
    loadZone: async (zone, filter) => {
      calls.push({ zone, filter });
      return (overrides[zone] ?? base[zone])();
    },
  };
}

const ctx = (r: ZoneReader): ToolRunContext => ({ reader: r, reference, current });
const parse = (text: string) => JSON.parse(text) as Record<string, unknown>;

describe('runTool', () => {
  it('get_statement: lines only by default (≤ 30), account rows with detail (≤ 50), level columns rounded to 1 dp, amounts in millions', async () => {
    const r = reader();
    const lines = await runTool({ name: 'get_statement', argumentsJson: '{}' }, ctx(r));
    expect(lines.error).toBeNull();
    expect(r.calls).toEqual([{ zone: 'statement', filter: current }]);
    const p = parse(lines.text);
    const rows = p.rows as { code: string; kind: string; base: number | null; dA: number | null }[];
    expect(rows.length).toBeLessThanOrEqual(TOOL_ROW_CAPS.get_statement.lines);
    expect(rows.every((row) => row.kind !== 'leaf')).toBe(true);
    const nr = rows.find((row) => row.code === 'NR');
    expect(nr?.base).toBe(3398.5);
    expect(nr?.dA).toBe(-66.3);
    expect(String(p.units)).toMatch(/USD millions/);
    expect(lines.view).toBe('pnl');
    expect(lines.summary).toBe('Consumer Products - YTD Sep 2026 - Actual vs Budget, Prior year - USD');
    expect(lines.filter).toEqual(current);
    expect(lines.text.length).toBeLessThanOrEqual(CHAT_BOUNDS.maxToolResultChars);

    const detail = await runTool({ name: 'get_statement', argumentsJson: '{"detail":true}' }, ctx(r));
    const detailRows = parse(detail.text).rows as { kind: string }[];
    expect(detailRows.length).toBeLessThanOrEqual(TOOL_ROW_CAPS.get_statement.detail);
    expect(detailRows.some((row) => row.kind === 'leaf')).toBe(true);
    expect(detail.text.length).toBeLessThanOrEqual(CHAT_BOUNDS.maxToolResultChars);
  });

  it('runs on the validated filters, not the current ones, and the card opens those filters in the tool’s view', async () => {
    const r = reader();
    const out = await runTool({ name: 'get_kpis', argumentsJson: '{"entity":"S","time_view":"qtd"}' }, ctx(r));
    expect(r.calls[0].zone).toBe('vitals');
    expect(r.calls[0].filter).toMatchObject({ entity: 'S', timeView: 'qtd', compareA: 'BUD' });
    expect(out.filter).toEqual(r.calls[0].filter);
    expect(out.view).toBe('kpi');
    expect(out.summary).toMatch(/^Commerce Cloud - Q3 2026/);
    const kpis = parse(out.text).kpis as { code: string; value: string; changes?: string[] }[];
    expect(kpis.map((k) => k.code)).toEqual(['NR', 'GM_PCT', 'HEADCOUNT']);
    expect(kpis[0].value).toBe('$3,398.5 m');
    expect(kpis[0].changes?.[0]).toBe('vs Budget: −66.3 −1.9%');
    expect((kpis[0] as { status?: string }).status).toBe('watch vs Budget');
    expect(kpis[1].changes?.[0]).toMatch(/pp$/);
    expect(out.detail).toBe('3 vitals');
  });

  it('get_bridge / get_largest_variances / get_profitability: capped rows with the view’s own texts', async () => {
    const r = reader();
    const bridge = parse((await runTool({ name: 'get_bridge', argumentsJson: '{}' }, ctx(r))).text);
    expect((bridge.steps as { step: string; kind: string }[]).map((s) => `${s.step}:${s.kind}`)).toEqual(['Budget:total', 'Volume:favourable', 'Price / mix:unfavourable', 'Constant currency:constant-currency subtotal', 'FX:FX translation', 'Actual:total']);
    const drivers = await runTool({ name: 'get_largest_variances', argumentsJson: '{}' }, ctx(r));
    expect((parse(drivers.text).rows as unknown[]).length).toBe(TOOL_ROW_CAPS.get_largest_variances);
    expect(drivers.detail).toBe('8 lines');
    const prof = await runTool({ name: 'get_profitability', argumentsJson: '{"breakdown":"region"}' }, ctx(r));
    expect(r.calls.filter((c) => c.zone === 'profitability')).toHaveLength(1);
    const rows = parse(prof.text).rows as Record<string, string>[];
    expect(rows.length).toBe(TOOL_ROW_CAPS.get_profitability);
    expect(rows[0]).toMatchObject({ region: 'Region 0', grossMargin: '50.0%', contributionMargin: '40.0%' });
    expect(rows[0]['vs Budget %']).toBe('+2.0%');
    expect(rows[0].contributionMarginDeltaPp).toBe('−0.2 pp');
    expect(parse(prof.text).basis).toMatch(/^Constant currency/);
    expect(prof.view).toBe('prof');
  });

  it('get_context: filters in words, the window sentence, notices and the refresh time', async () => {
    const out = await runTool({ name: 'get_context', argumentsJson: '{}' }, ctx(reader()));
    const p = parse(out.text);
    expect(p.status).toMatch(/^Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed 21 Oct 2026 18:00/);
    expect((p.appliedFilters as Record<string, string>).Company).toBe('Consumer Products');
    expect(p.notices).toEqual(['Cut-off: Actuals closed through Sep 2026: later months excluded', 'Allocation: Slice filter on: allocated']);
    expect(out.detail).toBe('2 notices');
  });

  it('explain_line / explain_kpi: definitions from the loaded zone, no numbers; unknown subjects list the choices', async () => {
    const r = reader();
    const line = await runTool({ name: 'explain_line', argumentsJson: '{"name":"net revenue"}' }, ctx(r));
    const lp = parse(line.text);
    expect(lp.code).toBe('NR');
    expect(lp.level).toBe('key');
    expect(Object.keys(lp)).not.toContain('base');
    expect(line.summary).toMatch(/NET REVENUE/);
    const missing = await runTool({ name: 'explain_line', argumentsJson: '{"name":"Unicorns"}' }, ctx(r));
    expect(missing.error).toMatch(/^No line "Unicorns"\. Lines: /);
    const kpi = await runTool({ name: 'explain_kpi', argumentsJson: '{"name":"gross margin"}' }, ctx(r));
    expect(parse(kpi.text)).toMatchObject({ code: 'GM_PCT', definition: 'Gross profit as a share of net revenue. A ratio: variances in percentage points.', formula: 'GM % = GP ÷ NR' });
    expect(kpi.summary).toBe('Gross margin');
    const nr = await runTool({ name: 'explain_kpi', argumentsJson: '{"name":"NR"}' }, ctx(r));
    expect(parse(nr.text).subMetrics).toBe('Organic growth +6.1% - reported +8.2% vs prior year');
    const noKpi = await runTool({ name: 'explain_kpi', argumentsJson: '{"name":"EBIT"}' }, ctx(r));
    expect(noKpi.error).toMatch(/^No vital "EBIT"\. Vitals: Net revenue \(NR\)/);
  });

  it('rejected arguments and failed zones come back as an error the model can read, and no zone is loaded for a rejection', async () => {
    const r = reader({
      bridge: async () => {
        throw new Error('Query timed out');
      },
    });
    const rejected = await runTool({ name: 'get_kpis', argumentsJson: '{"entity":"Z"}' }, ctx(r));
    expect(rejected.error).toMatch(/entity must be one of/);
    expect(rejected.filter).toBeNull();
    expect(parse(rejected.text)).toEqual({ error: rejected.error });
    expect(r.calls).toHaveLength(0);
    const failed = await runTool({ name: 'get_bridge', argumentsJson: '{}' }, ctx(r));
    expect(failed.error).toBe('The model could not answer: Query timed out');
    expect(failed.filter).not.toBeNull();
    expect(parse(failed.text)).toEqual({ error: failed.error });
  });

  it('relays the validator’s notes (open month under Actual) with the result', async () => {
    const out = await runTool({ name: 'get_kpis', argumentsJson: '{"month":12}' }, ctx(reader()));
    expect(parse(out.text).notes).toEqual(['Actuals are closed through September 2026; the window stops there. Use base_version LE for the full window.']);
  });
});

describe('fitPayload', () => {
  it('drops rows until the JSON fits the budget and counts them', () => {
    const rows = Array.from({ length: 400 }, (_, i) => ({ i, label: `row ${i}`.padEnd(40, '.') }));
    const text = fitPayload({ tool: 'get_statement', filters: 'f', rows }, 'rows');
    expect(text.length).toBeLessThanOrEqual(CHAT_BOUNDS.maxToolResultChars);
    const p = JSON.parse(text) as { rows: unknown[]; truncated: number };
    expect(p.rows.length + p.truncated).toBe(400);
    expect(p.truncated).toBeGreaterThan(0);
  });
  it('leaves a small payload untouched', () => {
    expect(JSON.parse(fitPayload({ tool: 'get_context', filters: 'f', notices: ['a'] }, 'notices'))).toEqual({ tool: 'get_context', filters: 'f', notices: ['a'] });
  });
  it('never calls the reader for a tool whose arguments were rejected', async () => {
    const loadZone = vi.fn();
    await runTool({ name: 'get_statement', argumentsJson: 'nope' }, { reader: { loadZone }, reference, current });
    expect(loadZone).not.toHaveBeenCalled();
  });
});

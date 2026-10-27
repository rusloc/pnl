// DAX builders for the pnlModel connector (ADR-0006 §8): allow-listed codes only,
// filters mapped to the model's parameter tables, slices dropped for Group (F-32),
// "All" selections emit no filter, and anything outside the allow-list throws
// before a query could be sent. One EVALUATE per query (executeQueries limit).
import { describe, expect, it } from 'vitest';

import { defaultFilters } from '../model/filters';
import type { FilterState } from '../model/types';
import {
  breakdownKeys,
  budgetAlias,
  buildBridgeQuery,
  buildBubbleQuery,
  buildConcentrationQuery,
  buildContextQuery,
  buildHeatQuery,
  buildProfitabilityQuery,
  buildProfitBridgeQuery,
  buildStatementQuery,
  buildVariancesCutQuery,
  buildVariancesQuery,
  buildVitalsInfoQuery,
  buildVitalsMetaQuery,
  buildVitalsValuesQuery,
  daxString,
  filterVars,
  kpiAliases,
  PnlQueryError,
  selectedBreakdown,
  VISIBLE_ENTITIES_QUERY,
  vitalsInfoAlias,
} from './pnl-model-queries';
import { sampleReference } from './sample-reference';

const reference = sampleReference();
const defaults: FilterState = defaultFilters(reference);

const oneEvaluate = (dax: string) => expect(dax.match(/EVALUATE/g)).toHaveLength(1);

describe('filterVars', () => {
  it('maps the default filters to the model parameter tables, units pinned to millions, "All" emitting nothing', () => {
    const dax = buildStatementQuery(defaults, reference);
    expect(dax.startsWith('DEFINE\n')).toBe(true);
    expect(dax).toContain('TREATAS ( { "P" }, param_entity_view[entity_view_code] )');
    expect(dax).toContain(`TREATAS ( { ${reference.lastClosed.fiscalYear} }, param_fiscal_year[fiscal_year] )`);
    expect(dax).toContain(`TREATAS ( { ${reference.lastClosed.monthNumber} }, param_period[month_number] )`);
    expect(dax).toContain('TREATAS ( { "YTD" }, param_time_view[time_view_code] )');
    expect(dax).toContain('TREATAS ( { "A" }, param_base_version[choice_code] )');
    expect(dax).toContain('TREATAS ( { "B" }, param_compare_a[choice_code] )');
    expect(dax).toContain('TREATAS ( { "PY" }, param_compare_b[choice_code] )');
    expect(dax).toContain('TREATAS ( { "USD" }, param_reporting_currency[currency_code] )');
    expect(dax).toContain('TREATAS ( { "ACT" }, param_fx_basis[fx_basis_code] )');
    expect(dax).toContain('TREATAS ( { "M" }, param_units[units_code] )');
    expect(dax).not.toContain('dim_region[');
    expect(dax).not.toContain('dim_channel[');
    expect(dax).not.toContain('dim_line[');
    expect(dax).not.toContain('dim_segment[');
  });

  it('follows every enum filter (F-02 … F-07, F-12, F-13)', () => {
    const dax = buildStatementQuery(
      { ...defaults, fiscalYear: 2025, month: 6, timeView: 'month', baseVersion: 'LE', compareA: 'NONE', compareB: 'BUD', currency: 'EUR', fxBasis: 'constant' },
      reference
    );
    expect(dax).toContain('TREATAS ( { 2025 }, param_fiscal_year[fiscal_year] )');
    expect(dax).toContain('TREATAS ( { 6 }, param_period[month_number] )');
    expect(dax).toContain('TREATAS ( { "MTD" }, param_time_view[time_view_code] )');
    expect(dax).toContain('TREATAS ( { "LE" }, param_base_version[choice_code] )');
    expect(dax).toContain('TREATAS ( { "NONE" }, param_compare_a[choice_code] )');
    expect(dax).toContain('TREATAS ( { "B" }, param_compare_b[choice_code] )');
    expect(dax).toContain('TREATAS ( { "EUR" }, param_reporting_currency[currency_code] )');
    expect(dax).toContain('TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )');
  });

  it('emits region and slice filters on the *name* columns from reference-validated codes (the model detects slices with ISFILTERED on names)', () => {
    const regions = reference.regions.slice(0, 2);
    const channel = reference.slices.P.channel.values[0];
    const dax = buildStatementQuery(
      { ...defaults, regions: regions.map((r) => r.code), slices: { ...defaults.slices, P: { channel: [channel.code], line: null, segment: null } } },
      reference
    );
    expect(dax).toContain(`TREATAS ( { "${regions[0].name}", "${regions[1].name}" }, dim_region[region_name] )`);
    expect(dax).toContain(`TREATAS ( { "${channel.name}" }, dim_channel[channel_name] )`);
    expect(dax).toMatch(/,_regions\n\s+,_channels\n/);
    expect(dax).not.toContain('dim_line[');
    expect(dax).not.toContain('[channel_code]');
  });

  it('drops channel, line and segment in the Group view (F-32) and maps G to GROUP', () => {
    const channel = reference.slices.P.channel.values[0].code;
    const vars = filterVars(
      { ...defaults, entity: 'G', slices: { ...defaults.slices, P: { channel: [channel], line: null, segment: null } } },
      reference
    );
    expect(vars.map((v) => v.name)).not.toContain('_channels');
    expect(vars[0].expression).toBe('TREATAS ( { "GROUP" }, param_entity_view[entity_view_code] )');
  });

  it('sends Compare A as selected, None included: the model picks the bridge comparison itself (C-40, parity rule 1)', () => {
    const vars = filterVars({ ...defaults, compareA: 'NONE' }, reference);
    expect(vars.find((v) => v.name === '_cmp_a')?.expression).toBe('TREATAS ( { "NONE" }, param_compare_a[choice_code] )');
  });

  it('refuses values outside the allow-list before any query is built', () => {
    expect(() => buildStatementQuery({ ...defaults, month: 13 }, reference)).toThrow(PnlQueryError);
    expect(() => buildStatementQuery({ ...defaults, month: 1.5 }, reference)).toThrow(PnlQueryError);
    expect(() => buildStatementQuery({ ...defaults, fiscalYear: 1999 }, reference)).toThrow(PnlQueryError);
    expect(() => buildStatementQuery({ ...defaults, regions: ['ZZ'] }, reference)).toThrow(/Unknown region code: ZZ/);
    expect(() => buildStatementQuery({ ...defaults, regions: [] }, reference)).toThrow(/Empty region/);
    // A code that belongs to the other entity's channels is not a P channel.
    const sChannel = reference.slices.S.channel.values[0].code;
    expect(reference.slices.P.channel.values.map((v) => v.code)).not.toContain(sChannel);
    expect(() =>
      buildStatementQuery(
        { ...defaults, slices: { ...defaults.slices, P: { channel: [sChannel], line: null, segment: null } } },
        reference
      )
    ).toThrow(/Unknown channel code/);
    expect(() =>
      buildStatementQuery({ ...defaults, timeView: 'weekly' as unknown as FilterState['timeView'] }, reference)
    ).toThrow(/Unknown time view/);
  });
});

describe('buildStatementQuery (Q1)', () => {
  it('reads dim_pl_row as a lines half and a leaves half (ISINSCOPE contract) and only the five level measures through CONVERT ( …, DOUBLE ) — Δ, Δ % and % NR are derived in the app (ADR-0006 §16)', () => {
    const dax = buildStatementQuery(defaults, reference);
    expect(dax).toContain('    VAR _lines =\n        SELECTCOLUMNS (\n            SUMMARIZECOLUMNS (\n                dim_pl_row[row_key]\n                ,dim_pl_row[line_code]');
    expect(dax).toContain(',TREATAS ( { FALSE () }, dim_pl_row[is_leaf] )');
    expect(dax).toContain(',TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )');
    const linesHalf = dax.slice(dax.indexOf('VAR _lines'), dax.indexOf('VAR _leaves'));
    expect(linesHalf).not.toContain(',dim_pl_row[account_label]');
    expect(linesHalf).toContain(',"account_label", ""');
    expect(linesHalf).toContain(',"is_leaf", FALSE ()');
    expect(linesHalf).toContain(',"account_sort", 0');
    const leavesHalf = dax.slice(dax.indexOf('VAR _leaves'), dax.indexOf('EVALUATE'));
    expect(leavesHalf).toContain(',dim_pl_row[account_label]');
    expect(leavesHalf).toContain(',"is_leaf", dim_pl_row[is_leaf]');
    expect(dax).toContain('EVALUATE\nUNION ( _lines, _leaves )');
    for (const [alias, measure] of [
      ['@base', 'PL Base'],
      ['@cmp_a', 'PL Compare A'],
      ['@cmp_b', 'PL Compare B'],
      ['@fy_bud', 'PL FY Budget'],
      ['@fy_le', 'PL FY LE'],
    ]) {
      expect(dax).toContain(`,"${alias}", CONVERT ( [${measure}], DOUBLE )`);
    }
    for (const measure of ['PL Δ A', 'PL Δ A %', 'PL Δ B', 'PL Δ B %', 'PL % NR', 'PL Δ LE vs Budget']) {
      expect(dax).not.toContain(`[${measure}]`);
    }
    expect(dax.match(/CONVERT \(/g)).toHaveLength(10);
    expect(dax.endsWith('\nORDER BY [line_sort], [account_sort]')).toBe(true);
    oneEvaluate(dax);
  });
});

describe('buildVitalsMetaQuery / buildVitalsValuesQuery / buildVitalsInfoQuery (QV)', () => {
  it('reads the entity’s Vitals rows of dim_kpi (vitals_slot > 0) in slot order', () => {
    expect(buildVitalsMetaQuery('S')).toBe('EVALUATE\nFILTER ( dim_kpi, dim_kpi[entity_view_code] = "S" && dim_kpi[vitals_slot] > 0 )\nORDER BY dim_kpi[vitals_slot]');
    expect(buildVitalsMetaQuery('G')).toContain('= "GROUP"');
  });

  it('values: KPI Value, the Compare A / B values, and the Budget value for the status unless a Compare is Budget already (PV-01)', () => {
    const dax = buildVitalsValuesQuery(defaults, reference, ['NR', 'GM_PCT']);
    oneEvaluate(dax);
    expect(dax).toContain('"@NR", CONVERT ( CALCULATE ( [KPI Value], TREATAS ( { "NR" }, dim_kpi[kpi_code] ) ), DOUBLE )');
    expect(dax).toContain('"@NR_cmp_a", CONVERT ( CALCULATE ( [KPI Value], TREATAS ( { "NR" }, dim_kpi[kpi_code] ), REMOVEFILTERS ( param_eval ), TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ), DOUBLE )');
    expect(dax).toContain('"@GM_PCT_cmp_b"');
    expect(dax).not.toContain('_bud');
    expect(dax).not.toContain('KPI Secondary');
    // Compare A = Prior year, Compare B = None: the Budget value comes through CMP_A with Compare A forced to B.
    const py = buildVitalsValuesQuery({ ...defaults, compareA: 'PY', compareB: 'NONE' }, reference, ['NR']);
    expect(py).toContain('"@NR_bud", CONVERT ( CALCULATE ( [KPI Value], TREATAS ( { "NR" }, dim_kpi[kpi_code] ), REMOVEFILTERS ( param_eval ), TREATAS ( { "CMP_A" }, param_eval[eval_code] ), REMOVEFILTERS ( param_compare_a ), TREATAS ( { "B" }, param_compare_a[choice_code] ) ), DOUBLE )');
    expect(py).not.toContain('"@NR_cmp_b"');
    expect(kpiAliases('ARR')).toEqual({ value: '@ARR', cmpA: '@ARR_cmp_a', cmpB: '@ARR_cmp_b', secondary: '@ARR_s', budget: '@ARR_bud' });
    expect(budgetAlias(defaults, 'NR')).toBe('@NR_cmp_a');
    expect(budgetAlias({ compareA: 'PY', compareB: 'BUD' }, 'NR')).toBe('@NR_cmp_b');
    expect(budgetAlias({ compareA: 'PY', compareB: 'NONE' }, 'NR')).toBe('@NR_bud');
  });

  it('the FY outlook card reads its four FY measures; the revenue-mix card both shares now and as prior year (PV-04)', () => {
    const dax = buildVitalsValuesQuery(defaults, reference, ['FY_OUTLOOK', 'MIX']);
    expect(dax).toContain('"@FY_OUTLOOK", CONVERT ( CALCULATE ( [KPI Value], TREATAS ( { "FY_OUTLOOK" }, dim_kpi[kpi_code] ) ), DOUBLE )');
    expect(dax).toContain('"@FY_OUTLOOK_bud", CONVERT ( CALCULATE ( [KPI FY Budget NR],');
    expect(dax).toContain('"@FY_OUTLOOK_e", CONVERT ( CALCULATE ( [KPI FY Outlook EBITDA],');
    expect(dax).toContain('"@FY_OUTLOOK_e_bud", CONVERT ( CALCULATE ( [KPI FY Budget EBITDA],');
    expect(dax).not.toContain('"@FY_OUTLOOK_cmp_a"');
    expect(dax).toContain('"@MIX", CONVERT ( CALCULATE ( [KPI Subscription Share], TREATAS ( { "MIX" }, dim_kpi[kpi_code] ) ), DOUBLE )');
    expect(dax).toContain('"@MIX_pay", CONVERT ( CALCULATE ( [KPI Payments Share],');
    expect(dax).toContain('"@MIX_py", CONVERT ( CALCULATE ( [KPI Subscription Share], TREATAS ( { "MIX" }, dim_kpi[kpi_code] ), REMOVEFILTERS ( param_eval ), TREATAS ( { "CMP_B" }, param_eval[eval_code] ), REMOVEFILTERS ( param_compare_b ), TREATAS ( { "PY" }, param_compare_b[choice_code] ) ), DOUBLE )');
    expect(dax).toContain('"@MIX_pay_py"');
    expect(() => buildVitalsValuesQuery(defaults, reference, [])).toThrow(PnlQueryError);
    expect(() => buildVitalsValuesQuery(defaults, reference, ['bad code'])).toThrow(PnlQueryError);
  });

  it('info: KPI Info Sub per code in one ROW', () => {
    const dax = buildVitalsInfoQuery(defaults, reference, ['NR', 'OPEX_PCT']);
    oneEvaluate(dax);
    expect(dax).toContain('"@NR_i", CALCULATE ( [KPI Info Sub], TREATAS ( { "NR" }, dim_kpi[kpi_code] ) )');
    expect(dax).toContain(',"@OPEX_PCT_i", CALCULATE ( [KPI Info Sub]');
    expect(vitalsInfoAlias('NR')).toBe('@NR_i');
  });
});

describe('buildBridgeQuery (Q3) and buildProfitBridgeQuery (QP)', () => {
  it('reads Bridge Step Delta / Bridge Is Total per step, drops other entities’ steps, appends the actual NR as the END level and sends Compare A / B as selected (parity rule 1)', () => {
    const dax = buildBridgeQuery({ ...defaults, compareA: 'PY', compareB: 'NONE' }, reference);
    oneEvaluate(dax);
    expect(dax).toContain('TREATAS ( { "PY" }, param_compare_a[choice_code] )');
    expect(dax).toContain('TREATAS ( { "NONE" }, param_compare_b[choice_code] )');
    expect(dax).toContain(',"@delta", CONVERT ( [Bridge Step Delta], DOUBLE )');
    expect(dax).toContain(',"@is_total", CONVERT ( [Bridge Is Total], DOUBLE )');
    expect(dax).toContain(',NOT ISBLANK ( [@is_total] )');
    expect(dax).toContain('"step_code", "END"');
    expect(dax).toContain(',"@is_total", 2');
    expect(dax).toContain('CONVERT ( CALCULATE ( [Prof Net Revenue], _entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _units ), DOUBLE )');
    expect(dax.endsWith('EVALUATE\nUNION ( _steps, _end )\nORDER BY [step_sort]')).toBe(true);
  });

  it('profit bridge: Profit Step Delta / Profit Is Total per dim_profit_step plus the comparison levels of D&A, adjusting items and operating profit', () => {
    const dax = buildProfitBridgeQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain('dim_profit_step[step_code]');
    expect(dax).toContain(',"@delta", CONVERT ( [Profit Step Delta], DOUBLE )');
    expect(dax).toContain(',"@is_total", CONVERT ( [Profit Is Total], DOUBLE )');
    expect(dax).toContain('"step_code", "CMP_DA"');
    expect(dax).toContain('CONVERT ( CALCULATE ( [LV Comparison], REMOVEFILTERS ( dim_pl_row ), TREATAS ( { "OP" }, dim_pl_row[line_code] ), _entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _units ), DOUBLE )');
    expect(dax.endsWith('EVALUATE\nUNION ( _steps, _cmp_da, _cmp_adj, _cmp_op )\nORDER BY [step_sort]')).toBe(true);
  });
});

describe('buildVariancesQuery / buildVariancesCutQuery (QL)', () => {
  it('reads every leaf of dim_pl_row with LV Base / LV Comparison / LV Δ B / LV FX and is_below_cm; no TOPN (ranking is client-side)', () => {
    const dax = buildVariancesQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).not.toContain('TOPN');
    expect(dax).toContain('    dim_pl_row[row_key]\n    ,dim_pl_row[line_code]\n    ,dim_pl_row[line_label]\n    ,dim_pl_row[account_code]\n    ,dim_pl_row[account_label]\n    ,dim_pl_row[line_sort]\n    ,dim_pl_row[account_sort]');
    expect(dax).toContain(',TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )');
    for (const [alias, measure] of [['@base', 'LV Base'], ['@cmp', 'LV Comparison'], ['@d_b', 'LV Δ B'], ['@fx', 'LV FX']]) {
      expect(dax).toContain(`,"${alias}", CONVERT ( [${measure}], DOUBLE )`);
    }
    expect(dax).toContain(',"@below_cm", LOOKUPVALUE ( dim_account[is_below_cm], dim_account[account_code], dim_pl_row[account_code] )');
    expect(dax.endsWith('ORDER BY dim_pl_row[line_sort], dim_pl_row[account_sort]')).toBe(true);
  });

  it('cut: LV Δ per leaf × member of the allow-listed cut column, members in view only; Entity for the Group view only', () => {
    const dax = buildVariancesCutQuery({ ...defaults, varCut: 'channel' }, reference);
    oneEvaluate(dax);
    expect(dax).toContain('            dim_pl_row[row_key]\n            ,dim_channel[channel_code]\n            ,dim_channel[channel_name]');
    expect(dax).toContain(',"@in_view", [Slice Member In View]');
    expect(dax).toContain(',"@d", CONVERT ( [LV Δ], DOUBLE )');
    expect(dax).toContain(',[@in_view] = 1 && NOT ISBLANK ( dim_channel[channel_code] ) && NOT ISBLANK ( [@d] )');
    expect(buildVariancesCutQuery({ ...defaults, entity: 'G', varCut: 'entity' }, reference)).toContain('dim_entity[short_name]');
    expect(() => buildVariancesCutQuery(defaults, reference)).toThrow(PnlQueryError);
    expect(() => buildVariancesCutQuery({ ...defaults, varCut: 'entity' }, reference)).toThrow(/Group view only/);
  });
});

describe('buildProfitabilityQuery (Q5)', () => {
  it('groups by the allow-listed breakdown pair (F-21), keeps members in view, reads the eight columns and appends the total', () => {
    expect(breakdownKeys('P')).toEqual(['region', 'channel', 'line', 'segment']);
    expect(breakdownKeys('G')).toEqual(['region', 'entity']);
    expect(selectedBreakdown(defaults)).toBe('region');
    const dax = buildProfitabilityQuery({ ...defaults, breakdown: { ...defaults.breakdown, P: 1 } }, reference);
    oneEvaluate(dax);
    expect(dax).toContain('                    dim_channel[channel_code]\n                    ,dim_channel[channel_name]');
    expect(dax).toContain(',"@in_view", [Slice Member In View]');
    expect(dax).toContain(',[@in_view] = 1 && NOT ISBLANK ( dim_channel[channel_code] )');
    for (const [alias, measure] of [
      ['@nr', 'Prof Net Revenue'],
      ['@nr_d_pct', 'Prof NR Δ % CC'],
      ['@gm', 'KPI Gross Margin %'],
      ['@cm', 'KPI CM %'],
      ['@cm_d_pp', 'Prof CM Δ pp'],
      ['@contrib', 'Prof Contribution'],
      ['@ebitda', 'Prof Adj EBITDA'],
    ]) {
      expect(dax.split(`,"${alias}", CONVERT ( [${measure}], DOUBLE )`)).toHaveLength(3);
    }
    expect(dax).toContain('"@code", "TOTAL"');
    expect(dax.endsWith('EVALUATE\nUNION ( _members, _total )\nORDER BY [@nr] DESC')).toBe(true);
    expect(buildProfitabilityQuery({ ...defaults, entity: 'G', breakdown: { ...defaults.breakdown, G: 1 } }, reference)).toContain('dim_entity[entity_code]\n                    ,dim_entity[short_name]');
    expect(() => buildProfitabilityQuery({ ...defaults, breakdown: { ...defaults.breakdown, P: 7 } }, reference)).toThrow(/Breakdown index/);
  });
});

describe('buildConcentrationQuery / buildBubbleQuery / buildHeatQuery', () => {
  it('concentration: Conc Share on dim_conc_level × dim_region', () => {
    const dax = buildConcentrationQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain('    dim_conc_level[level_code]\n    ,dim_conc_level[level_label]\n    ,dim_conc_level[level_sort]\n    ,dim_region[region_code]\n    ,dim_region[region_name]');
    expect(dax).toContain(',"@share", CONVERT ( [Conc Share], DOUBLE )');
  });

  it('bubble: growth, CM % and NR per region plus the company references', () => {
    const dax = buildBubbleQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain(',"@growth", CONVERT ( [KPI Organic Growth], DOUBLE )');
    expect(dax).toContain(',"@cm", CONVERT ( [KPI CM %], DOUBLE )');
    expect(dax).toContain('"@code", "COMPANY"');
    expect(dax).toContain(',"@growth", CONVERT ( [Prof Company Growth], DOUBLE )');
    expect(dax).toContain(',"@cm", CONVERT ( [Prof Company CM %], DOUBLE )');
    expect(dax.endsWith('EVALUATE\nUNION ( _regions, _company )\nORDER BY [@nr] DESC')).toBe(true);
  });

  it('heat: cells for the company’s own lines (no unassigned), region / line / company totals; the Group view evaluates the cells per line’s company', () => {
    const dax = buildHeatQuery({ ...defaults, entity: 'S' }, reference);
    oneEvaluate(dax);
    expect(dax).toContain('TREATAS ( { "S" }, dim_line[entity_code] )');
    expect(dax).toContain('TREATAS ( { FALSE () }, dim_line[is_unassigned] )');
    expect(dax).toContain(',"@nr", CONVERT ( [Prof Net Revenue], DOUBLE )');
    expect(dax).toContain(',"@gm", CONVERT ( [KPI Gross Margin %], DOUBLE )');
    expect(dax.endsWith('EVALUATE\nUNION ( _cells_s, _lines_s, _regions, _company )\nORDER BY [@region], [@line_sort]')).toBe(true);
    const group = buildHeatQuery({ ...defaults, entity: 'G' }, reference);
    oneEvaluate(group);
    expect(group).toContain('VAR _entity_p = TREATAS ( { "P" }, param_entity_view[entity_view_code] )');
    expect(group).toContain('VAR _entity_s = TREATAS ( { "S" }, param_entity_view[entity_view_code] )');
    expect(group).toContain('UNION ( _cells_p, _lines_p, _cells_s, _lines_s, _regions, _company )');
    expect(group).toContain(',_entity_p, _fy,');
    expect(group).toContain(',_entity, _fy,');
  });
});

describe('buildContextQuery (Q6) and Q0', () => {
  it('reads the model’s texts and the company CM % in one ROW', () => {
    const dax = buildContextQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain('"@status", [Data Status]');
    expect(dax).toContain(',"@notices", [Notices]');
    expect(dax).toContain(',"@refreshed", MAX ( _meta_refresh[refreshed_at] )');
    expect(dax).toContain(',"@prof_note", [Profitability Note]');
    expect(dax).toContain(',"@cm_pct", CONVERT ( [KPI CM %], DOUBLE )');
    expect(VISIBLE_ENTITIES_QUERY).toBe('EVALUATE\nVALUES ( dim_entity[entity_code] )');
  });
});

describe('daxString', () => {
  it('quotes a code, doubling embedded quotes, and refuses control characters', () => {
    expect(daxString('NA')).toBe('"NA"');
    expect(daxString('a"b')).toBe('"a""b"');
    expect(() => daxString('a\nb')).toThrow(PnlQueryError);
  });
});

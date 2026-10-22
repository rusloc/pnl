// DAX builders for the pnlModel connector (ADR-0006 §8): allow-listed codes only,
// filters mapped to the model's parameter tables, slices dropped for Group (F-32),
// "All" selections emit no filter, and anything outside the allow-list throws
// before a query could be sent. One EVALUATE per query (executeQueries limit).
import { describe, expect, it } from 'vitest';

import { defaultFilters } from '../model/filters';
import type { FilterState } from '../model/types';
import {
  breakdownKeys,
  buildBridgeQuery,
  buildContextQuery,
  buildDriversQuery,
  buildKpiMetaQuery,
  buildKpiValuesQuery,
  buildProfitabilityQuery,
  buildStatementQuery,
  daxString,
  filterVars,
  kpiAliases,
  PnlQueryError,
  selectedBreakdown,
  VISIBLE_ENTITIES_QUERY,
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

  it('lets the analysis zones override Compare A (C-40: the bridge comparison is Compare A)', () => {
    const vars = filterVars({ ...defaults, compareA: 'NONE' }, reference, { compareA: 'PY' });
    expect(vars.find((v) => v.name === '_cmp_a')?.expression).toBe('TREATAS ( { "PY" }, param_compare_a[choice_code] )');
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
  it('reads dim_pl_row as a lines half and a leaves half (ISINSCOPE contract) and the eleven statement measures through CONVERT ( …, DOUBLE )', () => {
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
      ['@pct_nr', 'PL % NR'],
      ['@cmp_a', 'PL Compare A'],
      ['@d_a', 'PL Δ A'],
      ['@d_a_pct', 'PL Δ A %'],
      ['@cmp_b', 'PL Compare B'],
      ['@d_b', 'PL Δ B'],
      ['@d_b_pct', 'PL Δ B %'],
      ['@fy_bud', 'PL FY Budget'],
      ['@fy_le', 'PL FY LE'],
      ['@fy_d', 'PL Δ LE vs Budget'],
    ]) {
      expect(dax).toContain(`,"${alias}", CONVERT ( [${measure}], DOUBLE )`);
    }
    expect(dax.endsWith('\nORDER BY [line_sort], [account_sort]')).toBe(true);
    oneEvaluate(dax);
  });
});

describe('KPI queries (Q2)', () => {
  it('reads the entity’s dim_kpi rows without measures, then values as one scalar CALCULATE per code (no SWITCH fan-out)', () => {
    expect(buildKpiMetaQuery('G')).toBe('EVALUATE\nFILTER ( dim_kpi, dim_kpi[entity_view_code] = "GROUP" )\nORDER BY dim_kpi[slot]');
    const dax = buildKpiValuesQuery(defaults, reference, ['NR', 'GM_PCT']);
    oneEvaluate(dax);
    expect(dax).not.toContain('SUMMARIZECOLUMNS');
    expect(dax).toContain('"@NR", CONVERT ( CALCULATE ( [KPI Value], TREATAS ( { "NR" }, dim_kpi[kpi_code] ) ), DOUBLE )');
    expect(dax).toContain('"@NR_a", CONVERT ( CALCULATE ( [KPI Δ A], TREATAS ( { "NR" }, dim_kpi[kpi_code] ) ), DOUBLE )');
    expect(dax).toContain('"@GM_PCT_b", CONVERT ( CALCULATE ( [KPI Δ B], TREATAS ( { "GM_PCT" }, dim_kpi[kpi_code] ) ), DOUBLE )');
    expect(dax).toContain('"@GM_PCT_s", CALCULATE ( [KPI Secondary], TREATAS ( { "GM_PCT" }, dim_kpi[kpi_code] ) )');
    expect(dax.endsWith(')\n    ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _units\n)')).toBe(true);
    expect(kpiAliases('ARR')).toEqual({ value: '@ARR', dA: '@ARR_a', dB: '@ARR_b', secondary: '@ARR_s' });
  });

  it('refuses a kpi_code that is not the model’s shape and an empty chunk', () => {
    expect(() => buildKpiValuesQuery(defaults, reference, ['NR"; EVALUATE'])).toThrow(PnlQueryError);
    expect(() => buildKpiValuesQuery(defaults, reference, ['nr'])).toThrow(/Unknown KPI code/);
    expect(() => buildKpiValuesQuery(defaults, reference, [])).toThrow(/Empty KPI chunk/);
  });
});

describe('buildBridgeQuery (Q3)', () => {
  it('reads Bridge Value per step, drops blank steps, appends the base NR as an END row and follows "Compared with"', () => {
    const dax = buildBridgeQuery({ ...defaults, analysisCompare: 'PY' }, reference);
    oneEvaluate(dax);
    expect(dax).toContain('TREATAS ( { "PY" }, param_compare_a[choice_code] )');
    expect(dax).toContain('dim_bridge_step[step_code]');
    expect(dax).toContain(',"@value", CONVERT ( [Bridge Value], DOUBLE )');
    expect(dax).toContain(',NOT ISBLANK ( [@value] )');
    expect(dax).toContain('"step_code", "END"');
    expect(dax).toContain('CONVERT ( CALCULATE ( [Prof Net Revenue], _entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _units ), DOUBLE )');
    expect(dax.endsWith('EVALUATE\nUNION ( _steps, _end )\nORDER BY [step_sort]')).toBe(true);
  });
});

describe('buildDriversQuery (Q4)', () => {
  it('ranks the leaf rows of dim_pl_row by |Δ| vs the bridge comparison, top 8, and follows "Compared with"', () => {
    const dax = buildDriversQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain('TOPN (\n    8');
    expect(dax).toContain(',TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )');
    expect(dax).toContain('TREATAS ( { "B" }, param_compare_a[choice_code] )');
    for (const [alias, measure] of [['@base', 'LV Base'], ['@cmp', 'LV Comparison'], ['@d', 'LV Δ'], ['@d_pct', 'LV Δ %'], ['@abs_d', 'LV Abs Δ']]) {
      expect(dax).toContain(`,"${alias}", CONVERT ( [${measure}], DOUBLE )`);
    }
    expect(dax.endsWith(',[@abs_d], DESC\n)\nORDER BY [@abs_d] DESC')).toBe(true);
  });
});

describe('buildProfitabilityQuery (Q5)', () => {
  it('groups by the allow-listed breakdown pair (F-21) and keeps only members in view', () => {
    expect(breakdownKeys('P')).toEqual(['region', 'channel', 'line', 'segment']);
    expect(breakdownKeys('G')).toEqual(['region', 'entity']);
    expect(selectedBreakdown(defaults)).toBe('channel');
    const dax = buildProfitabilityQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain('            dim_channel[channel_code]\n            ,dim_channel[channel_name]');
    expect(dax).toContain(',"@in_view", [Slice Member In View]');
    expect(dax).toContain(',[@in_view] = 1 && NOT ISBLANK ( dim_channel[channel_code] )');
    for (const [alias, measure] of [
      ['@nr', 'Prof Net Revenue'],
      ['@share', 'Prof NR Share'],
      ['@nr_d_pct', 'Prof NR Δ %'],
      ['@gm', 'KPI Gross Margin %'],
      ['@cm', 'KPI CM %'],
      ['@ebitda', 'KPI Adj EBITDA Margin'],
      ['@op', 'KPI Operating Margin'],
    ]) {
      expect(dax).toContain(`,"${alias}", CONVERT ( [${measure}], DOUBLE )`);
    }
    expect(dax.endsWith('ORDER BY [@nr] DESC')).toBe(true);
    const group = buildProfitabilityQuery({ ...defaults, entity: 'G', breakdown: { ...defaults.breakdown, G: 1 } }, reference);
    expect(group).toContain('dim_entity[entity_code]\n            ,dim_entity[short_name]');
    const region = buildProfitabilityQuery({ ...defaults, breakdown: { ...defaults.breakdown, P: 0 } }, reference);
    expect(region).toContain('dim_region[region_code]\n            ,dim_region[region_name]');
    expect(() => buildProfitabilityQuery({ ...defaults, breakdown: { ...defaults.breakdown, P: 7 } }, reference)).toThrow(/Breakdown index/);
  });
});

describe('buildContextQuery (Q6) and Q0', () => {
  it('reads the model’s texts and the company CM % in one ROW', () => {
    const dax = buildContextQuery(defaults, reference);
    oneEvaluate(dax);
    expect(dax).toContain('"@status", [Data Status]');
    expect(dax).toContain(',"@notices", [Notices]');
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

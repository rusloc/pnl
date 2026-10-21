// DAX builder for the pnlModel connector (ADR-0006 §8): allow-listed codes only,
// filters mapped to the model's parameter tables, slices dropped for Group (F-32),
// "All" selections emit no filter, and anything outside the allow-list throws
// before a query could be sent.
import { describe, expect, it } from 'vitest';

import { defaultFilters } from '../model/filters';
import type { FilterState } from '../model/types';
import { buildStatementQuery, daxString, PnlQueryError, statementFilterVars } from './pnl-model-queries';
import { sampleReference } from './sample-reference';

const reference = sampleReference();
const defaults: FilterState = defaultFilters(reference);

describe('buildStatementQuery', () => {
  it('maps the default filters to the model parameter tables, units pinned to millions', () => {
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
    // "All" regions / slices: no filter argument at all.
    expect(dax).not.toContain('dim_region[');
    expect(dax).not.toContain('dim_channel[');
    expect(dax).not.toContain('dim_line[');
    expect(dax).not.toContain('dim_segment[');
  });

  it('reads dim_pl_row as a lines half and a leaves half (ISINSCOPE contract) and the eleven statement measures through CONVERT ( …, DOUBLE )', () => {
    const dax = buildStatementQuery(defaults, reference);
    expect(dax).toContain('    VAR _lines =\n        SELECTCOLUMNS (\n            SUMMARIZECOLUMNS (\n                dim_pl_row[row_key]\n                ,dim_pl_row[line_code]');
    expect(dax).toContain(',TREATAS ( { FALSE () }, dim_pl_row[is_leaf] )');
    expect(dax).toContain(',TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )');
    // The lines half never groups by the account columns; it projects constants instead.
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
    // One EVALUATE, one result table (executeQueries limit).
    expect(dax.match(/EVALUATE/g)).toHaveLength(1);
  });

  it('follows the month and the other enum filters', () => {
    const dax = buildStatementQuery(
      { ...defaults, month: 6, timeView: 'month', baseVersion: 'LE', compareA: 'NONE', compareB: 'BUD', currency: 'EUR', fxBasis: 'constant' },
      reference
    );
    expect(dax).toContain('TREATAS ( { 6 }, param_period[month_number] )');
    expect(dax).toContain('TREATAS ( { "MTD" }, param_time_view[time_view_code] )');
    expect(dax).toContain('TREATAS ( { "LE" }, param_base_version[choice_code] )');
    expect(dax).toContain('TREATAS ( { "NONE" }, param_compare_a[choice_code] )');
    expect(dax).toContain('TREATAS ( { "B" }, param_compare_b[choice_code] )');
    expect(dax).toContain('TREATAS ( { "EUR" }, param_reporting_currency[currency_code] )');
    expect(dax).toContain('TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )');
  });

  it('emits region and slice filters from reference-validated codes only', () => {
    const regions = reference.regions.slice(0, 2).map((r) => r.code);
    const channel = reference.slices.P.channel.values[0].code;
    const dax = buildStatementQuery(
      { ...defaults, regions, slices: { ...defaults.slices, P: { channel: [channel], line: null, segment: null } } },
      reference
    );
    expect(dax).toContain(`TREATAS ( { "${regions[0]}", "${regions[1]}" }, dim_region[region_code] )`);
    expect(dax).toContain(`TREATAS ( { "${channel}" }, dim_channel[channel_code] )`);
    expect(dax).toMatch(/,_regions\n\s+,_channels\n/);
    expect(dax).not.toContain('dim_line[');
  });

  it('drops channel, line and segment in the Group view (F-32) and maps G to GROUP', () => {
    const channel = reference.slices.P.channel.values[0].code;
    const vars = statementFilterVars(
      { ...defaults, entity: 'G', slices: { ...defaults.slices, P: { channel: [channel], line: null, segment: null } } },
      reference
    );
    expect(vars.map((v) => v.name)).not.toContain('_channels');
    expect(vars[0].expression).toBe('TREATAS ( { "GROUP" }, param_entity_view[entity_view_code] )');
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

describe('daxString', () => {
  it('quotes a code, doubling embedded quotes, and refuses control characters', () => {
    expect(daxString('NA')).toBe('"NA"');
    expect(daxString('a"b')).toBe('"a""b"');
    expect(() => daxString('a\nb')).toThrow(PnlQueryError);
  });
});

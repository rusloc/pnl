// Tool-argument validation (ADR-0009 §2, §6 tests): unknown entity, slices in
// the Group view, an open month under Actual, unknown names, out-of-range
// values, inheritance of the current filters, name → code mapping.
import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import { defaultFilters } from '../model/filters';
import { filterSummary, validateToolArgs } from './tool-args';

const reference = sampleReference();
const current = defaultFilters(reference);
const ok = (name: Parameters<typeof validateToolArgs>[0], args: unknown, filter = current) => {
  const r = validateToolArgs(name, JSON.stringify(args), filter, reference);
  if (!r.ok) throw new Error(r.reason);
  return r.args;
};
const bad = (name: Parameters<typeof validateToolArgs>[0], args: unknown, filter = current) => {
  const r = validateToolArgs(name, typeof args === 'string' ? args : JSON.stringify(args), filter, reference);
  if (r.ok) throw new Error('expected a rejection');
  return r.reason;
};

describe('validateToolArgs', () => {
  it('inherits every unspecified field from the current filters and reports nothing changed', () => {
    const a = ok('get_kpis', {});
    expect(a.filter).toEqual(current);
    expect(a.changed).toEqual([]);
    expect(a.notes).toEqual([]);
    expect(a.view).toBe('kpi');
  });

  it('maps the snake_case patch onto FilterState and lists what changed', () => {
    const a = ok('get_statement', { entity: 'S', time_view: 'qtd', compare_a: 'LE', currency: 'EUR', fx_basis: 'constant', detail: true });
    expect(a.filter).toMatchObject({ entity: 'S', timeView: 'qtd', compareA: 'LE', currency: 'EUR', fxBasis: 'constant', fiscalYear: current.fiscalYear, month: current.month });
    expect(a.detail).toBe(true);
    expect(a.changed).toEqual(['Commerce Cloud', 'time view', 'vs Latest est.', 'EUR', 'constant currency']);
    expect(filterSummary(a.filter)).toBe('Commerce Cloud - Q3 2026 - Actual vs Latest est., Prior year - EUR constant currency');
  });

  it('rejects an unknown entity, enum, key or JSON', () => {
    expect(bad('get_kpis', { entity: 'X' })).toMatch(/entity must be one of P, S, G/);
    expect(bad('get_kpis', { time_view: 'quarter' })).toMatch(/time_view must be one of/);
    expect(bad('get_kpis', { base_version: 'actual' })).toMatch(/base_version/);
    expect(bad('get_kpis', { foo: 1 })).toBe('Unknown argument: foo');
    expect(bad('get_kpis', { detail: true })).toBe('Unknown argument: detail');
    expect(bad('get_kpis', '{not json')).toBe('Arguments are not valid JSON');
    expect(bad('get_kpis', '[]')).toBe('Arguments must be an object');
  });

  it('rejects slices in the Group view, whether the entity comes from the arguments or the current filters', () => {
    expect(bad('get_statement', { entity: 'G', channel: ['Own D2C webstore'] })).toMatch(/do not apply to the Group view/);
    expect(bad('get_statement', { line: ['Payments'] }, { ...current, entity: 'G' })).toMatch(/do not apply to the Group view/);
    // Regions do apply to the Group view.
    expect(ok('get_statement', { entity: 'G', regions: ['North America'] }).filter.regions).toEqual(['NA']);
  });

  it('notes an open month under Actual instead of refusing (C-01), and not under Latest estimate', () => {
    const open = ok('get_kpis', { month: 12 });
    expect(open.notes).toEqual(['Actuals are closed through September 2026; the window stops there. Use base_version LE for the full window.']);
    expect(ok('get_kpis', { month: 12, base_version: 'LE' }).notes).toEqual([]);
    expect(bad('get_kpis', { month: 13 })).toMatch(/month must be an integer between 1 and 12/);
    expect(bad('get_kpis', { month: 9.5 })).toMatch(/month/);
  });

  it('accepts only fiscal years present in the reference data', () => {
    expect(ok('get_kpis', { fiscal_year: 2025 }).filter.fiscalYear).toBe(2025);
    expect(bad('get_kpis', { fiscal_year: 2019 })).toBe('fiscal_year 2019 is not in the data (2024-2026)');
    expect(bad('get_kpis', { fiscal_year: '2025' })).toMatch(/fiscal_year must be an integer/);
  });

  it('maps region and slice names or codes to codes in reference order; a full set is "All"; unknown names are listed', () => {
    expect(ok('get_kpis', { regions: ['uk & ireland', 'NA'] }).filter.regions).toEqual(['NA', 'UK']);
    expect(ok('get_kpis', { regions: ['North America', 'Continental Europe', 'UK & Ireland', 'Asia-Pacific'] }).filter.regions).toBeNull();
    expect(bad('get_kpis', { regions: ['Mars'] })).toMatch(/^Unknown region: Mars\. Known: North America/);
    expect(bad('get_kpis', { regions: [] })).toMatch(/regions must be a non-empty list/);
    const s = ok('get_profitability', { entity: 'S', line: ['Payments', 'Platform subscriptions'] });
    expect(s.filter.slices.S.line).toEqual(['Platform subscriptions', 'Payments']);
    expect(s.filter.slices.P).toEqual(current.slices.P);
    expect(s.changed).toEqual(['Commerce Cloud', '2 service line']);
    expect(bad('get_profitability', { entity: 'S', segment: ['Premium'] })).toMatch(/^Unknown customer segment: Premium/);
  });

  it('checks the breakdown against the company (entity only for Group; channel, line, segment only for operating companies)', () => {
    expect(ok('get_profitability', { breakdown: 'channel' }).filter.breakdown.P).toBe(1);
    expect(ok('get_profitability', { entity: 'G', breakdown: 'entity' }).filter.breakdown.G).toBe(1);
    expect(bad('get_profitability', { breakdown: 'entity' })).toMatch(/breakdown entity is not available for this company; use region, channel, line, segment/);
    expect(bad('get_profitability', { entity: 'G', breakdown: 'segment' })).toMatch(/use region, entity/);
  });

  it('requires a short subject for explain_line / explain_kpi', () => {
    expect(ok('explain_line', { name: ' Net revenue ' }).subject).toBe('Net revenue');
    expect(bad('explain_line', {})).toBe('name must be a short name or code');
    expect(bad('explain_kpi', { name: 'x'.repeat(81) })).toBe('name must be a short name or code');
    expect(bad('explain_kpi', { kpi: 'NR' })).toBe('Unknown argument: kpi');
    // `line` stays the slice slot even on explain_line: the subject is `name`.
    expect(bad('explain_line', { name: 'NR', line: 'Payments' })).toMatch(/line must be a non-empty list/);
  });
});

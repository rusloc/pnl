import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { csvTable } from '../../scripts/csv.ts';
import type { Dataset } from '../data/dataset.ts';
import { DATA_DIR, loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { createEngine } from './index.ts';
import type { Engine } from './index.ts';
import type { BaseChoice, EntityView, MonthNumber, Selection } from './types.ts';

// T-06: net revenue, operating profit, net profit — and every other subtotal in control_totals_usd.csv — match the
// generator's trial balance per entity, for closed, open and first-year windows. Tolerance 0.01 USD (ADR-0002 §2.7).

const CONTROL = [
  ...csvTable(
    readFileSync(join(DATA_DIR, 'checks', 'control_totals_usd.csv'), 'utf8'),
    ['entity_code', 'version', 'window', 'line_code', 'amount_usd'],
    'control_totals_usd.csv',
  ),
].map(([entity = '', version = '', window = '', line = '', amount = '']) => ({
  entity,
  version,
  window,
  line,
  amount: Number(amount),
}));

const ENTITY: Record<string, EntityView> = { P: 'P', S: 'S', GROUP: 'GROUP' };
const BASE: Record<string, BaseChoice> = { ACT: 'A', BUD: 'B', LE: 'LE' };
const MONTH_NUMBER: Record<string, MonthNumber> = { Sep: 9 };

/** "FY2025" → full year; "FY2026 YTD Sep" → YTD to Sep; "FY2026 (actual Jan-Sep + forecast 9+3)" → full year. */
function toSelection(entityCode: string, version: string, window: string): Selection {
  const match = /^FY(\d{4})(?: YTD (\w{3}))?/.exec(window);
  const entity = ENTITY[entityCode];
  const base = BASE[version];
  const ytd = match?.[2];
  const month = ytd === undefined ? 12 : MONTH_NUMBER[ytd];
  if (!match?.[1] || !entity || !base || !month)
    throw new Error(`unmapped control row ${entityCode} ${version} ${window}`);
  return selection({
    entity,
    base,
    fy: Number(match[1]),
    timeView: ytd ? 'YTD' : 'FY',
    month,
    compareA: 'NONE',
    compareB: 'NONE',
  });
}

const cases = [...new Set(CONTROL.map((c) => `${c.entity}|${c.version}|${c.window}`))].map((key) => {
  const [entity = '', version = '', window = ''] = key.split('|');
  return { entity, version, window, rows: CONTROL.filter((c) => `${c.entity}|${c.version}|${c.window}` === key) };
});

describe('T-06 control totals (control_totals_usd.csv)', () => {
  let engine: Engine;
  let dataset: Dataset;
  let compared = 0;

  beforeAll(async () => {
    dataset = await loadPublicDataset(['P', 'S']);
    engine = createEngine(dataset);
  });

  it('covers 552 rows: P / S / GROUP × 8 windows × 23 lines', () => {
    expect(CONTROL).toHaveLength(552);
    expect(cases).toHaveLength(24);
  });

  it.each(cases)('$entity · $version · $window', ({ entity, version, window, rows }) => {
    const statement = engine.statement(toSelection(entity, version, window));
    const byCode = new Map(statement.rows.map((r) => [r.code, r.base]));
    for (const c of rows) {
      const actual = byCode.get(c.line);
      expect(actual, `${c.line} missing`).toBeTypeOf('number');
      expect(Math.abs((actual ?? NaN) - c.amount), `${entity} ${version} ${window} ${c.line}`).toBeLessThanOrEqual(
        0.01,
      );
      compared++;
    }
  });

  it('compared every control row', () => {
    expect(compared).toBe(552);
  });

  it('README headline: Consumer Products Actual FY2026 YTD Sep NR 3,398.5 m, Adj. EBITDA 682.6 m', () => {
    const rows = new Map(engine.statement(selection()).rows.map((r) => [r.code, r.base ?? NaN]));
    expect((rows.get('NR') ?? NaN) / 1e6).toBeCloseTo(3398.5, 1);
    expect((rows.get('EBITDA') ?? NaN) / 1e6).toBeCloseTo(682.6, 1);
  });
});

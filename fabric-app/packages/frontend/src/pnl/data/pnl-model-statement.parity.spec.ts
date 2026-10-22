// Parity of the client-side statement derivation (ADR-0006 §16) with the model's own
// `PL Δ A/B`, `PL Δ A/B %`, `PL % NR` and `PL Δ LE vs Budget`: both query shapes were
// captured live on 2026-10-22 for the same filters; the §16 shape mapped through
// `mapStatementRows` must reproduce every model column, blank for blank, within
// floating-point noise (the model scales before subtracting, the app after).
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it } from 'vitest';

import type { StatementValues } from '../model/types';
import { Q1_DEFAULT, Q1_SLICED } from './fixtures/q1-statement-parity.fixture';
import { columnName } from './pnl-model-client';
import { mapStatementRows } from './pnl-model-statement';

/** Model column → mapped value (display scaling undone where the mapper applies it). */
const MODEL_COLUMNS: readonly [column: string, pick: (v: StatementValues, ratio: boolean) => number | null][] = [
  ['@pct_nr', (v) => (v.pctNr === null ? null : v.pctNr / 100)],
  ['@d_a', (v) => v.dA],
  ['@d_a_pct', (v) => (v.dApct === null ? null : v.dApct / 100)],
  ['@d_b', (v) => v.dB],
  ['@d_b_pct', (v) => (v.dBpct === null ? null : v.dBpct / 100)],
  ['@fy_d', (v) => v.fyD],
  ['@base', (v, ratio) => (v.base === null ? null : ratio ? v.base / 100 : v.base)],
  ['@cmp_a', (v, ratio) => (v.cmpA === null ? null : ratio ? v.cmpA / 100 : v.cmpA)],
];

function cells(table: QueryTable): Map<string, Record<string, unknown>> {
  const names = table.columns.map((c) => columnName(c.name));
  return new Map(table.rows.map((row) => [row[names.indexOf('row_key')] as string, Object.fromEntries(names.map((n, i) => [n, row[i]]))]));
}

function expectParity(fixture: { old: QueryTable; new: QueryTable }) {
  const model = cells(fixture.old);
  expect(new Set(cells(fixture.new).keys())).toEqual(new Set(model.keys()));
  const rows = mapStatementRows(fixture.new);
  expect(rows).toHaveLength(fixture.old.rows.length);
  let compared = 0;
  let blanks = 0;
  for (const row of rows) {
    const key = row.kind === 'leaf' ? `${row.parent}|${row.code}` : row.code;
    const expected = model.get(key);
    expect(expected, key).toBeDefined();
    for (const [column, pick] of MODEL_COLUMNS) {
      const want = expected![column] as number | null;
      const got = pick(row.values, row.kind === 'ratio');
      if (want === null) {
        expect(got, `${key} ${column}`).toBeNull();
        blanks++;
      } else {
        expect(got, `${key} ${column}`).not.toBeNull();
        expect(Math.abs((got as number) - want), `${key} ${column}: ${got} vs ${want}`).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(want)));
        compared++;
      }
    }
  }
  return { compared, blanks };
}

describe('statement derivation parity with the model (live captures 2026-10-22)', () => {
  it('default filters (Actual vs Budget / Prior year, USD): every Δ, Δ %, % NR and FY Δ equals the model’s column', () => {
    const { compared, blanks } = expectParity(Q1_DEFAULT);
    expect(compared).toBeGreaterThan(300);
    expect(blanks).toBeGreaterThan(0);
  });

  it('sliced filters (LE vs Budget / None, EUR constant currency, regions + channels): Compare B blank → Δ B blank, ratios in pp', () => {
    const { compared, blanks } = expectParity(Q1_SLICED);
    expect(compared).toBeGreaterThan(200);
    // Compare B = None blanks @cmp_b, @d_b and @d_b_pct on every row.
    expect(blanks).toBeGreaterThanOrEqual(2 * Q1_SLICED.old.rows.length);
  });
});

// Parity of the client-side KPI Δ derivation (ADR-0006 §16) with the model's `KPI Δ A`
// / `KPI Δ B`: both Q2b shapes captured live on 2026-10-22 for NR, ORG_GROWTH, GM_PCT
// and GTN_PCT; the Δ derived from the §16 value / comparison pairs must equal the
// model's Δ columns (pp on percent KPIs, a fraction on amounts).
import { describe, expect, it } from 'vitest';

import { kpiDelta } from '../model/derive';
import { Q2_FIN } from './fixtures/q2-kpi-parity.fixture';
import { columnName } from './pnl-model-client';

const PERCENT: Record<string, boolean> = { NR: false, ORG_GROWTH: true, GM_PCT: true, GTN_PCT: true };

function row(table: { columns: { name: string }[]; rows: unknown[][] }): Record<string, unknown> {
  expect(table.rows).toHaveLength(1);
  return Object.fromEntries(table.columns.map((c, i) => [columnName(c.name), table.rows[0][i]]));
}

describe('KPI Δ derivation parity with the model (live capture 2026-10-22)', () => {
  const model = row(Q2_FIN.old);
  const pairs = row(Q2_FIN.new);

  it.each(Object.keys(PERCENT))('%s: Δ A and Δ B from the value / comparison pair equal KPI Δ A / KPI Δ B', (code) => {
    expect(pairs[`@${code}`]).toBe(model[`@${code}`]);
    expect(pairs[`@${code}_s`]).toBe(model[`@${code}_s`]);
    for (const side of ['a', 'b']) {
      const want = model[`@${code}_${side}`] as number | null;
      const got = kpiDelta(pairs[`@${code}`] as number | null, pairs[`@${code}_cmp_${side}`] as number | null, PERCENT[code], false);
      if (want === null) expect(got).toBeNull();
      else expect(Math.abs((got as number) - want)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(want)));
    }
  });
});

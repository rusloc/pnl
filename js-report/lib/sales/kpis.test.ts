import { describe, expect, it } from 'vitest';
import { filterLine } from './copy.ts';
import { kpiRows } from './kpis.ts';
import { monthIndex } from './windows.ts';

// KPI card rows since 2026-11-01: "vs Budget" and "vs PY" both shown (Budget first), the chip follows the chosen
// comparator; and the one-line filter summary beside the Filters button.

describe('KPI comparator rows', () => {
  const b = { actual: 110, budget: 100, py: 120 };

  it('shows vs Budget and vs PY, Budget first, whatever the comparator', () => {
    for (const cmp of ['BUD', 'PY'] as const)
      expect(kpiRows('countUp', b, cmp).rows.map((r) => r.label)).toEqual(['vs Budget', 'vs PY']);
  });

  it('the chip follows the chosen comparator', () => {
    expect(kpiRows('countUp', b, 'BUD').chip?.status).toBe('good'); // 110 vs 100
    expect(kpiRows('countUp', b, 'PY').chip?.status).not.toBe('good'); // 110 vs 120
  });

  it('a metric without a Budget shows vs PY alone; a fixed comparator shows itself alone', () => {
    expect(kpiRows('countUp', { actual: 1, py: 1 }, 'BUD').rows.map((r) => r.label)).toEqual(['vs PY']);
    expect(
      kpiRows('countUp', { actual: 1, py: 1, ref: { label: 'vs target', value: 2 } }, 'BUD').rows.map((r) => r.label),
    ).toEqual(['vs target']);
  });

  it("falls back to the other row's chip when the chosen one has no value", () => {
    const r = kpiRows('countUp', { actual: 110, budget: null, py: 100 }, 'BUD');
    expect(r.rows).toHaveLength(2);
    expect(r.chip?.status).toBe('good');
  });
});

describe('filter line', () => {
  it('period - comparison - region', () => {
    const closed = monthIndex('2026-09');
    const s = (from: string, to: string) => ({
      view: 'overview' as const,
      market: 'RO' as const,
      from: monthIndex(from),
      anchor: monthIndex(to),
      cmp: 'PY' as const,
      drill: null,
    });
    expect(filterLine(s('2026-07', '2026-09'), closed)).toBe('Q3 2026 - vs Prior year - Romania');
    expect(filterLine(s('2025-06', '2025-09'), closed)).toBe('Jun–Sep 2025 - vs Prior year - Romania');
  });
});

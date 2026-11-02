import { beforeAll, describe, expect, it } from 'vitest';
import { loadSalesBase } from '../test-utils/sales-data.ts';
import { createUrlCodec } from './url-state.ts';
import type { UrlCodec } from './url-state.ts';
import { monthIndex, periodKind, periodLabel, statView } from './windows.ts';

// Periods since 2026-11-01: any range of closed months. Labels and kinds, the window-stats key (distinct counts and
// medians exist only for Month / QTD / YTD / R12M windows), and the `from` URL key with the legacy `period` read.

const M = monthIndex;
const CLOSED = M('2026-09');
const w = (a: string, b: string) => ({ start: M(a), end: M(b) });

describe('period kind and label', () => {
  it.each([
    ['2026-09', '2026-09', 'month', 'Sep 2026'],
    ['2025-10', '2025-12', 'quarter', 'Q4 2025'],
    ['2024-01', '2024-12', 'year', 'Year 2024'],
    ['2026-01', '2026-09', 'year', 'Year 2026 (Jan–Sep)'],
    ['2025-06', '2025-09', 'range', 'Jun–Sep 2025'],
    ['2026-07', '2026-08', 'range', 'Jul–Aug 2026'],
    ['2025-11', '2026-02', 'range', 'Nov 2025–Feb 2026'],
  ])('%s…%s = %s, %s', (a, b, kind, label) => {
    expect(periodKind(w(a, b), CLOSED)).toBe(kind);
    expect(periodLabel(w(a, b), CLOSED)).toBe(label);
  });
});

describe('window-stats key', () => {
  it('a month, a quarter or year to its end, and 12 months map to a stats row', () => {
    expect(statView(w('2026-09', '2026-09'))).toEqual({
      tv: 'M',
      anchor: CLOSED,
    });
    expect(statView(w('2025-10', '2025-12'))).toEqual({
      tv: 'Q',
      anchor: M('2025-12'),
    });
    expect(statView(w('2026-07', '2026-08'))).toEqual({
      tv: 'Q',
      anchor: M('2026-08'),
    });
    expect(statView(w('2024-01', '2024-12'))).toEqual({
      tv: 'Y',
      anchor: M('2024-12'),
    });
    expect(statView(w('2024-10', '2025-09'))).toEqual({
      tv: 'R',
      anchor: M('2025-09'),
    });
  });
  it('other ranges have none', () => {
    expect(statView(w('2025-06', '2025-09'))).toBeNull();
    expect(statView(w('2025-11', '2026-02'))).toBeNull();
  });
});

describe('URL: from + month', () => {
  let codec: UrlCodec;
  beforeAll(async () => {
    codec = createUrlCodec((await loadSalesBase()).manifest);
  });
  const q = (s: string) => new URLSearchParams(s);

  it('round-trips a range; one month omits from', () => {
    const sel = codec.parse(q('from=2025-06&month=2025-09'));
    expect([sel.from, sel.anchor]).toEqual([M('2025-06'), M('2025-09')]);
    expect(codec.serialize(sel)).toBe('from=2025-06&month=2025-09');
    expect(codec.serialize(codec.parse(q('month=2025-09')))).toBe('month=2025-09');
  });

  it('from after month, before the data or malformed falls back to one month', () => {
    for (const bad of ['from=2025-10&month=2025-09', 'from=2023-12&month=2025-09', 'from=junk&month=2025-09'])
      expect(codec.parse(q(bad)).from).toBe(M('2025-09'));
  });

  it('reads the legacy period key and rewrites it as a range', () => {
    const sel = codec.parse(q('period=ytd&month=2026-09'));
    expect([sel.from, sel.anchor]).toEqual([M('2026-01'), M('2026-09')]);
    expect(codec.serialize(sel)).toBe('from=2026-01');
    expect(codec.parse(q('period=r12m&month=2024-06')).from).toBe(M('2024-01')); // clamped to the data start
  });
});

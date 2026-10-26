import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { csvTable } from '../../scripts/csv.ts';
import { SALES_DATA_DIR, loadSalesBase } from '../test-utils/sales-data.ts';
import { createCube } from './cube.ts';
import type { Cube } from './cube.ts';
import { createMetrics } from './metrics.ts';
import type { Metrics } from './metrics.ts';
import type { MarketSel, TimeView } from './types.ts';
import { monthIndex, monthKey, windowOf } from './windows.ts';

// ADR-0011 §3 parity gate: the engine reproduces data/mirelo_sales_dummy_data/checks/control_totals_eur.csv (the
// generator's own totals, re-checked by verify.py) from the shipped pre-aggregates. Amounts to the cent (the CSV
// rounds at the end), ratios to the CSV's 6 decimals, counts exactly.

const CONTROL = new Map(
  [
    ...csvTable(
      readFileSync(join(SALES_DATA_DIR, 'checks', 'control_totals_eur.csv'), 'utf8'),
      ['market_code', 'period', 'metric_code', 'value'],
      'control_totals_eur.csv',
    ),
  ].map(([market = '', period = '', metric = '', value = '']) => [`${market}|${period}|${metric}`, Number(value)]),
);

const control = (market: MarketSel, period: string, metric: string): number => {
  const v = CONTROL.get(`${market}|${period}|${metric}`);
  if (v === undefined) throw new Error(`control_totals_eur.csv has no ${market} ${period} ${metric}`);
  return v;
};

const MARKETS: MarketSel[] = ['ALL', 'PL', 'RO', 'PT'];
/** Control period → time view + anchor month. */
const PERIODS: [string, TimeView, string][] = [
  ['2026-09', 'M', '2026-09'],
  ['FY2024', 'Y', '2024-12'],
  ['FY2025', 'Y', '2025-12'],
  ['FY2026_YTD_SEP', 'Y', '2026-09'],
];

let cube: Cube;
let m: Metrics;
beforeAll(async () => {
  cube = createCube(await loadSalesBase());
  m = createMetrics(cube);
});

const CENT = 0.0051; // the CSV rounds the exact sum to cents
const RATIO = 5.1e-7; // the CSV keeps 6 decimals

describe.each(PERIODS)('control totals %s (%s anchored %s)', (period, tv, anchorKey) => {
  const anchor = monthIndex(anchorKey);
  const w = windowOf(tv, anchor);

  it.each(MARKETS)('%s: loans, principal EUR, new clients', (mk) => {
    const s = m.loans(w, mk);
    expect(s.loans).toBe(control(mk, period, 'loans_count'));
    expect(Math.abs(s.principal - control(mk, period, 'principal_eur'))).toBeLessThan(CENT);
    expect(s.first).toBe(control(mk, period, 'new_clients'));
    expect(Math.abs((m.repeatShare(s) ?? NaN) - control(mk, period, 'returning_pct_loans'))).toBeLessThan(RATIO);
  });

  it.each(MARKETS)('%s: returning clients (client-weighted)', (mk) => {
    const stat = cube.windowStat(tv, anchorKey, mk);
    expect(stat?.borrowers).toBe(control(mk, period, 'borrowers'));
    expect(stat?.returning).toBe(control(mk, period, 'returning_clients'));
    expect(Math.abs((m.returning(tv, anchor, mk) ?? NaN) - control(mk, period, 'returning_pct_clients'))).toBeLessThan(
      RATIO,
    );
  });

  it.each(MARKETS)('%s: 30+ / 90+ DPD at the last month of the window', (mk) => {
    const s = m.snap(anchor, mk);
    expect(Math.abs((s?.outstanding ?? NaN) - control(mk, period, 'outstanding_eur'))).toBeLessThan(CENT);
    expect(Math.abs((s ? s.b30_59 + s.b60_89 + s.b90p : NaN) - control(mk, period, 'dpd30_balance_eur'))).toBeLessThan(
      CENT,
    );
    expect(Math.abs((m.dpd30(s) ?? NaN) - control(mk, period, 'dpd30_pct'))).toBeLessThan(RATIO);
    expect(Math.abs((m.dpd90(s) ?? NaN) - control(mk, period, 'dpd90_pct'))).toBeLessThan(RATIO);
  });

  it.each(MARKETS)('%s: revenue EUR, total and per stream', (mk) => {
    expect(Math.abs(m.revenue(w, mk) - control(mk, period, 'revenue_eur'))).toBeLessThan(CENT);
    const streams = cube.revenueBy(w, mk, (r) => r.stream);
    for (const [stream, metric] of [
      ['INTEREST', 'revenue_interest_eur'],
      ['FEE', 'revenue_fee_eur'],
      ['INTERCHANGE', 'revenue_interchange_eur'],
      ['SUBSCRIPTION', 'revenue_subscription_eur'],
    ] as const)
      expect(Math.abs((streams.get(stream) ?? 0) - control(mk, period, metric))).toBeLessThan(CENT);
  });
});

describe('every closed month 2024-01 … 2026-09, every market', () => {
  it('loans, principal, new clients, borrowers, 30+ DPD and revenue match', () => {
    let checked = 0;
    for (let i = monthIndex('2024-01'); i <= monthIndex('2026-09'); i++) {
      const key = monthKey(i);
      const w = { start: i, end: i };
      for (const mk of MARKETS) {
        const s = m.loans(w, mk);
        expect(s.loans, `${mk} ${key}`).toBe(control(mk, key, 'loans_count'));
        expect(Math.abs(s.principal - control(mk, key, 'principal_eur')), `${mk} ${key}`).toBeLessThan(CENT);
        expect(s.first, `${mk} ${key}`).toBe(control(mk, key, 'new_clients'));
        expect(cube.windowStat('M', key, mk)?.returning, `${mk} ${key}`).toBe(control(mk, key, 'returning_clients'));
        expect(Math.abs((m.dpd30At(i, mk) ?? NaN) - control(mk, key, 'dpd30_pct')), `${mk} ${key}`).toBeLessThan(RATIO);
        expect(Math.abs(m.revenue(w, mk) - control(mk, key, 'revenue_eur')), `${mk} ${key}`).toBeLessThan(CENT);
        checked++;
      }
    }
    expect(checked).toBe(33 * 4);
  });
});

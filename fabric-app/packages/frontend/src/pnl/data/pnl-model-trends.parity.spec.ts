// K-24 parity on live captures (2026-10-22, model republished with `KPI Trend`):
// the selected-month point of every trend equals the tile value the model gives
// for time view = Month at that month (the contract: each point is what the tile
// shows with Month at that month, param_eval = BASE). Also the batch shape the
// app sends (fin8 + ops4) covers all 12 KPIs × 13 months with no blank point in a
// fully closed window.
import { describe, expect, it } from 'vitest';

import { defaultFilters } from '../model/filters';
import type { FilterState } from '../model/types';
import { Q2B_P_MTD, Q7_P_FIN8, Q7_P_OPS4 } from './fixtures/q7-kpi-trend-live.fixture';
import { cellNumber, indexColumns } from './pnl-model-client';
import { type KpiMeta, mapKpiTrends, trendMonthKeys } from './pnl-model-figures';
import { kpiAliases } from './pnl-model-queries';
import { sampleReference } from './sample-reference';

const reference = sampleReference();
const filter: FilterState = defaultFilters(reference);

const meta = (code: string, group: KpiMeta['group'], valueType: string): KpiMeta => ({ slot: 0, code, label: code, group, betterWhen: 'Higher', valueType, definition: '' });
const FIN8 = [
  meta('NR', 'Financial', 'AMT'), meta('ORG_GROWTH', 'Financial', 'PCT'), meta('GM_PCT', 'Financial', 'PCT'), meta('GTN_PCT', 'Financial', 'PCT'),
  meta('AP_PCT', 'Financial', 'PCT'), meta('CM_PCT', 'Financial', 'PCT'), meta('EBITDA', 'Financial', 'AMT'), meta('OP', 'Financial', 'AMT'),
];
const OPS4 = [meta('UNITS', 'Operational', 'CNT'), meta('NR_PER_UNIT', 'Operational', 'PRICE'), meta('VOL_GROWTH', 'Operational', 'PCT'), meta('PRICE_MIX', 'Operational', 'PCT')];

describe('KPI trend parity (K-24, live captures)', () => {
  it('the selected-month point equals the Month-view tile value, to the double, on NR, ORG_GROWTH, GM_PCT and GTN_PCT', () => {
    const trends = mapKpiTrends(Q7_P_FIN8, filter, reference, FIN8);
    const col = indexColumns(Q2B_P_MTD, []);
    const tile = (code: string) => cellNumber(Q2B_P_MTD.rows[0][col.get(kpiAliases(code).value) as number]);
    for (const code of ['NR', 'ORG_GROWTH', 'GM_PCT', 'GTN_PCT']) {
      const t = trends[code];
      expect(t.kind).toBe('ready');
      if (t.kind !== 'ready') continue;
      const last = t.trend.points[12];
      expect(last.month).toBe('2026-09');
      expect(last.isOpen).toBe(false);
      expect(last.value).toBe(tile(code));
      expect(last.value).not.toBeNull();
    }
    // Sep 2026 net revenue of Consumer Products, Month view: $405.9m (vs YTD $3,398.5m on the tile).
    expect((trends.NR as { trend: { points: { text: string }[] } }).trend.points[12].text).toBe('$405.9m');
  });

  it('fin8 + ops4 cover the 12 KPIs × 13 months ending Sep 2026 with no blank point (every month closed, Actual)', () => {
    const trends = { ...mapKpiTrends(Q7_P_FIN8, filter, reference, FIN8), ...mapKpiTrends(Q7_P_OPS4, filter, reference, OPS4) };
    expect(Object.keys(trends)).toHaveLength(12);
    const keys = trendMonthKeys(filter);
    for (const t of Object.values(trends)) {
      if (t.kind !== 'ready') throw new Error('not ready');
      expect(t.trend.points.map((p) => p.month)).toEqual(keys);
      expect(t.trend.points.every((p) => p.value !== null && p.text !== '' && !p.isOpen)).toBe(true);
    }
    expect(Q7_P_FIN8.rows).toHaveLength(104);
    expect(Q7_P_OPS4.rows).toHaveLength(52);
  });
});

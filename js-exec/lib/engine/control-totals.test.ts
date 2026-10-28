import { beforeAll, describe, expect, it } from 'vitest';
import { SCOPES } from '../data/manifest.ts';
import type { Scope } from '../data/manifest.ts';
import { controlTotals, loadExecData, tolerance } from '../test-utils/exec-data.ts';
import { parsePeriodKey } from './calendar.ts';
import type { ExecData } from './cube.ts';
import { computeMetrics } from './metrics.ts';

// ET-01 (E-76): the engine reproduces EVERY row of data/nordmark_retail_dummy_data/checks/control_totals_eur.csv from
// the shipped pre-aggregates, with verify.py's tolerances; and it returns no value the CSV leaves out (absent = N/A).

const rows = controlTotals();
let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});

const periods = [...new Set(rows.map((r) => r.periodKey))].sort();

describe('ET-01 control totals', () => {
  it('covers 4 scopes × 33 period keys, 9,328 values', () => {
    expect(rows).toHaveLength(9328);
    expect(new Set(rows.map((r) => r.scope))).toEqual(new Set(SCOPES));
    expect(periods).toHaveLength(33);
  });

  it.each(periods)('%s: every scope reconciles, both ways', (key) => {
    const p = parsePeriodKey(d, key);
    expect(p).not.toBeNull();
    if (!p) return;
    for (const scope of SCOPES) {
      const expected = new Map(
        rows.filter((r) => r.periodKey === key && r.scope === scope).map((r) => [r.metric, r.value]),
      );
      const got = computeMetrics(d, scope as Scope, p.kind, p.asOf);
      const off = [...expected].filter(([metric, v]) => {
        const g = got[metric];
        return g === undefined || !(Math.abs(g - v) <= tolerance(metric));
      });
      expect(off.map(([metric, v]) => `${scope} ${metric}: csv ${v}, engine ${got[metric]}`)).toEqual([]);
      expect(
        Object.keys(got)
          .filter((metric) => !expected.has(metric))
          .map((x) => `${scope} extra ${x}`),
      ).toEqual([]);
    }
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { SCOPES } from '../data/manifest.ts';
import { controlTotals, loadExecData, tolerance } from '../test-utils/exec-data.ts';
import type { ExecData } from './cube.ts';
import { parseItemKey, prevMonthToDate, toDate } from './items.ts';
import type { Window } from './items.ts';
import { computeMetrics } from './metrics.ts';

// ET-01 (E-76, E-99): the engine reproduces EVERY row of data/nordmark_retail_dummy_data/checks/control_totals_eur.csv
// from the shipped pre-aggregates, with verify.py's tolerances; and it returns no value the CSV leaves out (absent = N/A).
// Keys: the period-model grammar `{W|P|Q|FY}-FY{yyyy}[-{n}][@{k}]` (items.ts parseItemKey) and, while the CSV still
// carries them, the retired `PTD-` / `YTD-FY{yyyy}-{ww}` keys (period / year to date through week ww, ADR-0013 (k)).

const rows = controlTotals();
let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});

const periods = [...new Set(rows.map((r) => r.periodKey))].sort();
const retiredKey = (k: string) => /^(PTD|YTD)-/.test(k);

interface Plan {
  win: Window;
  /** Retired PTD- / YTD- key (still in the CSV until ginee drops it, exec-period-model.md §6). */
  retired: boolean;
}

function plan(key: string): Plan | null {
  const old = /^(PTD|YTD)-FY(\d{4})-(\d{2})$/.exec(key);
  if (!old) {
    const win = parseItemKey(d, key);
    return win && { win, retired: false };
  }
  const L = d.weekIx.get(`FY${old[2]}-W${old[3]}`);
  return L === undefined ? null : { win: toDate(d, old[1] === 'PTD' ? 'P' : 'FY', L), retired: true };
}

/**
 * How a CSV metric is checked. Retired keys were written with the pre-model readings, which the period model changes by
 * design: Channel mix at the window's last week (now the window's shares, USER 2026-10-29) and the EBITDA flash pair
 * `ebitda_ptd` / `ebitda_bud_ptd` (now Week-only, E-93) → checked against the engine's Week reading of that last week;
 * their statuses, counts and dot follow those readings → not checked here (the W keys and the new keys check them).
 */
type Check = 'window' | 'lastWeek' | 'skip';
function check(p: Plan, metric: string): Check {
  if (!p.retired) return 'window';
  if (metric.startsWith('status.')) return 'skip';
  return metric.startsWith('mix_') || (metric.startsWith('ebitda_') && metric.endsWith('_ptd')) ? 'lastWeek' : 'window';
}

describe('ET-01 control totals', () => {
  it('covers 4 scopes × the 62 period-model keys (E-99), the EBITDA previous-month keys P-…@k and the retired PTD / YTD keys', () => {
    expect(new Set(rows.map((r) => r.scope))).toEqual(new Set(SCOPES));
    expect(periods.filter((k) => plan(k) === null)).toEqual([]);
    const model = periods.filter((k) => !retiredKey(k));
    expect(model.filter((k) => !/@/.test(k) || /^(Q-FY2026-3|Q-FY2025-4)@4$|^FY-FY2025@43$/.test(k))).toHaveLength(62);
    // EBITDA at Week vs Previous = the previous month's first k weeks (USER 2026-10-30): every W key has its P-…@k window
    // in the CSV, except week 5 of a 5-week month (previous month too short → N/A, no key)
    for (const k of periods.filter((x) => x.startsWith('W-'))) {
      const L = parseItemKey(d, k)?.weeks[0] ?? -1;
      const pm = prevMonthToDate(d, L);
      const key = pm && `P-FY${pm.item.fy}-${String(pm.item.n).padStart(2, '0')}@${pm.win.weeks.length}`;
      expect(key === null || periods.includes(key) ? 'ok' : `${k}: ${key} missing`).toBe('ok');
    }
    expect(periods.filter(retiredKey).every((k) => /^(PTD|YTD)-FY\d{4}-\d{2}$/.test(k))).toBe(true);
  });

  it.each(periods)('%s: every scope reconciles, both ways', (key) => {
    const p = plan(key);
    expect(p).not.toBeNull();
    if (!p) return;
    for (const scope of SCOPES) {
      const expected = new Map(
        rows.filter((r) => r.periodKey === key && r.scope === scope).map((r) => [r.metric, r.value]),
      );
      const got = computeMetrics(d, scope, p.win);
      const last = computeMetrics(d, scope, { gran: 'W', weeks: [p.win.weeks.at(-1) ?? -1] }); // retired keys only
      const off = [...expected].filter(([metric, v]) => {
        const how = check(p, metric);
        const g = how === 'lastWeek' ? last[metric] : got[metric];
        return how !== 'skip' && (g === undefined || !(Math.abs(g - v) <= tolerance(metric)));
      });
      expect(off.map(([metric, v]) => `${scope} ${metric}: csv ${v}, engine ${got[metric]}`)).toEqual([]);
      expect(
        Object.keys(got)
          .filter((metric) => !expected.has(metric) && check(p, metric) === 'window')
          .map((x) => `${scope} extra ${x}`),
      ).toEqual([]);
    }
  });
});

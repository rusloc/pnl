import { beforeAll, describe, expect, it } from 'vitest';
import { SCOPES } from '../data/manifest.ts';
import type { Scope } from '../data/manifest.ts';
import { CATEGORY_CHECKS, categoryControlTotals, loadExecData, tolerance } from '../test-utils/exec-data.ts';
import { categoryMask } from './cube.ts';
import type { ExecData } from './cube.ts';
import { parseItemKey } from './items.ts';
import { computeMetrics } from './metrics.ts';

// ET-33 … ET-35 against ginee's category control totals (E-104): scope `{ALL|NL|BE|ONLINE}#{code}[+{code}…]`, codes in
// dim_category.sort_order, the period-key grammar of E-99. Every CSV row reconciles with verify.py's tolerances and the
// engine returns no value the CSV leaves out (absent = N/A). Skipped, by name, until the file exists.

const rows = categoryControlTotals();
let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});

const parseScope = (s: string): { scope: Scope; codes: string[] } | null => {
  const m = /^(ALL|NL|BE|ONLINE)#([A-Z]+(?:\+[A-Z]+)*)$/.exec(s);
  const scope = SCOPES.find((x) => x === m?.[1]);
  return scope && m?.[2] ? { scope, codes: m[2].split('+') } : null;
};
const cells = rows ? [...new Set(rows.map((r) => `${r.scope}|${r.periodKey}`))].sort() : [];

describe.skipIf(rows === null)(`E-104 category control totals (${CATEGORY_CHECKS[0]})`, () => {
  it('every scope parses into a region and known codes in sort_order; every key is an item key', () => {
    const codes = (x: string[]) => d.categories.filter((c) => x.includes(c.category_code)).map((c) => c.category_code);
    const bad = cells.filter((cell) => {
      const [s = '', k = ''] = cell.split('|');
      const p = parseScope(s);
      return !p || codes(p.codes).join('+') !== p.codes.join('+') || parseItemKey(d, k) === null;
    });
    expect(bad).toEqual([]);
  });

  it.each(cells)('%s reconciles, both ways', (cell) => {
    const [s = '', key = ''] = cell.split('|');
    const p = parseScope(s);
    const w = parseItemKey(d, key);
    if (!p || !w) throw new Error(`unparsed ${cell}`);
    const expected = new Map(
      (rows ?? []).filter((r) => r.scope === s && r.periodKey === key).map((r) => [r.metric, r.value]),
    );
    const got = computeMetrics(d, p.scope, w, categoryMask(d, p.codes));
    const off = [...expected].filter(([m, v]) => {
      const g = got[m];
      return g === undefined || !(Math.abs(g - v) <= tolerance(m));
    });
    expect(off.map(([m, v]) => `${m}: csv ${v}, engine ${got[m]}`)).toEqual([]);
    expect(
      Object.keys(got)
        .filter((m) => !expected.has(m))
        .map((m) => `extra ${m}`),
    ).toEqual([]);
  });
});

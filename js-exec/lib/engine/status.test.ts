import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '../test-utils/exec-data.ts';
import type { ExecData } from './cube.ts';
import { badness } from './metrics.ts';
import { dotOf, dotRule, statusOf } from './status.ts';

// ET-10 status rules at their edges (E-22, data README "Status": the Watch edge is Watch, Off track starts beyond it),
// direction handling (Markdown ↓ inverts, cover and mix are bands); ET-03 / E-26 the literal v5 dot rule.

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});
const rule = (code: string) => {
  const r = d.rules.get(code);
  if (!r) throw new Error(code);
  return r;
};

describe('ET-10 status rules', () => {
  it('every card rule: 0 and the watch edge → On track; past it → Watch; off edge → Watch; past it → Off track', () => {
    for (const k of d.cards) {
      const r = rule(k.kpi_code);
      const w = r.watch_from ?? NaN;
      const o = r.off_from ?? NaN;
      expect([statusOf(0, r), statusOf(w, r), statusOf(w + 1e-6, r), statusOf(o, r), statusOf(o + 1e-6, r)]).toEqual([
        'good',
        'good',
        'watch',
        'watch',
        'off',
      ]);
    }
  });

  it('Net sales at exactly −3 % vs budget is Watch despite float noise (b rounded to 10 decimals)', () => {
    const b = badness('NET_SALES', { net_sales: 97, net_sales_bud: 100 }) ?? NaN;
    expect(b).not.toBe(0.03); // 0.030000000000000027
    expect(statusOf(b, rule('NET_SALES'))).toBe('watch');
    expect(statusOf(badness('NET_SALES', { net_sales: 96.99, net_sales_bud: 100 }) ?? NaN, rule('NET_SALES'))).toBe(
      'off',
    );
    expect(statusOf(badness('NET_SALES', { net_sales: 100, net_sales_bud: 100 }) ?? NaN, rule('NET_SALES'))).toBe(
      'good',
    );
  });

  it('Markdown is ↓: below budget is On track, +1.0 pp is Watch, beyond is Off track', () => {
    const md = (a: number) =>
      statusOf(badness('MARKDOWN', { markdown_pct: a, markdown_pct_bud: 0.085 }) ?? NaN, rule('MARKDOWN'));
    expect([md(0.07), md(0.085), md(0.09), md(0.095), md(0.0951)]).toEqual(['good', 'good', 'watch', 'watch', 'off']);
  });

  it('Weeks of cover and Channel mix are bands: the absolute distance counts both ways', () => {
    const wc = (a: number) =>
      statusOf(badness('WEEKS_OF_COVER', { weeks_of_cover: a, cover_target_wks: 9.5 }) ?? NaN, rule('WEEKS_OF_COVER'));
    expect([wc(8.5), wc(10.5), wc(7.4), wc(11.4), wc(7.5), wc(11.6)]).toEqual([
      'good',
      'good',
      'off',
      'watch',
      'watch',
      'off',
    ]);
    const mx = (dev: number) => statusOf(badness('CHANNEL_MIX', { mix_max_dev_pp: dev }) ?? NaN, rule('CHANNEL_MIX'));
    expect([mx(-0.02), mx(0.02), mx(-0.025), mx(0.03), mx(-0.031)]).toEqual(['good', 'good', 'watch', 'watch', 'off']);
  });

  it('a blank input is N/A (no status)', () => {
    expect(badness('AVAILABILITY', { availability_target: 0.97 })).toBeNull();
    expect(badness('LFL_GROWTH', {})).toBeNull();
  });
});

describe('E-26 overall dot (literal v5 rule, constants from param_status_rule)', () => {
  it('reads the three constants from the data', () => {
    const r = dotRule(d.rules);
    expect([r.redOff, r.orangeWatchOff, r.greenGood].map((x) => Math.round(x * 1e6) / 1e6)).toEqual([
      0.333333, 0.5, 0.666667,
    ]);
  });

  it.each([
    [7, 3, 2, 0, 'orange'], // the Week-43 story: on track 58 % < 2/3
    [11, 0, 1, 0, 'green'], // USER 2026-10-28: no "any off-track" guard
    [8, 0, 4, 0, 'red'], // off = 1/3
    [6, 6, 0, 0, 'orange'], // watch + off = 50 % is not > 50 %, on 50 % < 2/3
    [5, 7, 0, 0, 'orange'], // watch + off > 50 %
    [8, 4, 0, 0, 'green'], // on = 2/3
    [8, 0, 2, 2, 'green'], // N/A excluded from the denominator (ONLINE Week 43)
  ] as const)('%i on / %i watch / %i off / %i N/A → %s', (on, watch, off, na, dot) => {
    expect(dotOf({ on, watch, off, na }, dotRule(d.rules))).toBe(dot);
  });
});

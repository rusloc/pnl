import { describe, expect, it } from 'vitest';
import { loadDataset } from '../test-utils/marketing-data.ts';
import type { Dataset } from './data.ts';
import { metrics } from './metrics.ts';
import { freshness } from './rules.ts';
import { windowScope } from './scope.ts';
import { DEFAULT_FILTERS, DEFAULT_SELECTION } from './selection.ts';
import type { Selection } from './selection.ts';
import { campaigns, channels, cohorts, context, dynamics, frame, journey, overview, trend } from './view.ts';
import { buckets, moversWindow, resolveWindow, win } from './windows.ts';

// The contract's AT list beyond AT-01 (§7.1): presets, precedence and the status rule, the model switch, the step, the
// alerts and movers, verdicts vs the comparator, Journey, freshness fixtures, Ended / Paused history, the `_Mv Start`
// cases, the dynamics window and the A-83 performance proxy.

const ds: Dataset = await loadDataset();
const S = (over: Partial<Selection> = {}): Selection => ({ ...DEFAULT_SELECTION, ...over });
const iso = (w: { a: number; b: number }) => [ds.cal.iso(w.a), ds.cal.iso(w.b)];
const ix = (d: string) => ds.cal.ix(d);

describe('AT-03 presets and modes', () => {
  it('resolves the preset windows from the as-of day', () => {
    expect(iso(resolveWindow(ds.cal, '30d'))).toEqual(['2026-10-05', '2026-11-03']);
    expect(iso(resolveWindow(ds.cal, '7d'))).toEqual(['2026-10-28', '2026-11-03']);
    expect(iso(resolveWindow(ds.cal, 'mtd'))).toEqual(['2026-11-01', '2026-11-03']);
    expect(iso(resolveWindow(ds.cal, 'qtd'))).toEqual(['2026-10-01', '2026-11-03']);
    expect(iso(resolveWindow(ds.cal, 'custom', ix('2026-10-10'), ix('2026-10-01')))).toEqual([
      '2026-10-05',
      '2026-11-03',
    ]);
    expect(iso(resolveWindow(ds.cal, 'custom', -40, ds.cal.asOf + 9))).toEqual(['2025-01-01', '2026-11-03']);
  });
  it('previous period, same period last year, plan', () => {
    const w = resolveWindow(ds.cal, '30d');
    expect(iso(moversWindow(ds.cal, w, 'prev').before)).toEqual(['2026-09-05', '2026-10-04']);
    expect(iso(moversWindow(ds.cal, w, 'ly').before)).toEqual(['2025-10-05', '2025-11-03']);
    expect(Math.round(metrics(ds, windowScope(ds, DEFAULT_FILTERS), w.a, w.b).plan / 100) / 10).toBe(176.0);
  });
  it('granularity re-buckets O3 without changing the window totals', () => {
    const w = resolveWindow(ds.cal, '30d');
    const total = metrics(ds, windowScope(ds, DEFAULT_FILTERS), w.a, w.b).spend;
    for (const grain of ['day', 'week', 'month'] as const) {
      const pts = trend(context(ds, S({ grain }))).points;
      expect(pts.reduce((x, p) => x + p.spend, 0)).toBeCloseTo(total, 6);
    }
    expect(buckets(ds.cal, w, 'week').map((b) => ds.cal.iso(b.a))[1]).toBe('2026-10-12'); // Mondays
    expect(trend(context(ds, S({ preset: 'custom', from: 0, to: ds.cal.asOf, grain: 'month' }))).points).toHaveLength(
      23,
    );
  });
  it('None hides every Δ on the pill basis', () => {
    expect(frame(context(ds, S({ cmp: 'none' }))).pill).toBe('Oct 5 – Nov 3  |  no comparison');
  });
});

describe('AT-04 filter precedence and the status rule', () => {
  it('iOS + Android = the mobile campaigns ($72.4k)', () => {
    expect(frame(context(ds, S({ platforms: ['IOS', 'ANDROID'] }))).vitals[0]?.value).toBe('$72.4k');
  });
  it('a cross-filter scopes the body and never the vitals', () => {
    const base = frame(context(ds, S()));
    const x = frame(context(ds, S({ cross: { kind: 'channel', channel: 'PAID_SOCIAL', platform: null } })));
    expect(x.vitals).toEqual(base.vitals);
    expect(x.chips.map((c) => c.label)).toEqual(['Selected: Paid social']);
    const o = overview(context(ds, S({ cross: { kind: 'channel', channel: 'PAID_SOCIAL', platform: null } })));
    expect(o.o7.map((r) => r.code)).toEqual(['PAID_SOCIAL']);
  });
  it('status default = Live + Learning on the list (16 rows), totals keep every campaign', () => {
    const v = campaigns(context(ds, S()));
    expect(v.p1).toHaveLength(16);
    const prev = context(ds, S({ preset: 'custom', from: ix('2026-09-05'), to: ix('2026-10-04') }));
    expect(Math.round(metrics(ds, prev.winScope, prev.w.a, prev.w.b).spend)).toBe(176_100);
  });
});

describe('AT-06 attribution model switch', () => {
  it('changes paid customers and the CAC family only', () => {
    const dda = frame(context(ds, S())).vitals;
    const lc = frame(context(ds, S({ model: 'LAST_CLICK' }))).vitals;
    expect(lc[0]).toEqual(dda[0]); // spend
    expect(lc[1]).toEqual(dda[1]); // sign-ups
    expect(lc[3]).toEqual(dda[3]); // time to activation
    expect(frame(context(ds, S({ model: 'LAST_CLICK' }))).chips.map((c) => c.label)).toEqual([
      'Attribution: Last click',
    ]);
  });
  it('the Platform-reported gap uses DDA as the first-party model', () => {
    const w = resolveWindow(ds.cal, '30d');
    const cs = windowScope(ds, DEFAULT_FILTERS);
    expect(metrics(ds, cs, w.a, w.b, { model: 'PLATFORM' }).attribution_gap).toBeCloseTo(
      metrics(ds, cs, w.a, w.b).attribution_gap ?? Number.NaN,
      12,
    );
  });
});

describe('AT-08 the step on Oct 18', () => {
  it('O3 marker sits on 2026-10-18', () => {
    const t = trend(context(ds, S()));
    expect(t.marker?.label).toBe('Oct 18');
    expect(t.points[t.marker?.index ?? -1]?.day).toBe('2026-10-18');
    expect(trend(context(ds, S({ preset: '7d' }))).marker).toBeNull();
  });
});

describe('AT-10 alerts and movers (O5 / O6 default lists)', () => {
  it('Worst 5 at defaults', () => {
    const o = overview(context(ds, S()));
    expect(o.o5.map((r) => [r.campaign, r.delta, r.alert])).toEqual([
      ['Google UAC · Android growth', '−9.1', 'Install quality'],
      ['Meta prospecting · Lookalike 2%', '−5.9', 'Creative fatigue'],
      ['YouTube · Product demo', '−5.7', ''],
      ['LinkedIn · Data teams ABM', '−0.3', ''],
    ]);
    expect(o.o6.map((r) => r.delta)).toEqual(['−0.41', '−0.18', '−0.09', '−0.04', '−0.03']);
  });
  it('Channel = paid search drops the Lookalike row', () => {
    const o = overview(context(ds, S({ channels: ['PAID_SEARCH'] })));
    expect(o.o5.some((r) => r.key === 'SOC_META_LAL2')).toBe(false);
  });
});

describe('AT-12 verdicts never follow the comparator', () => {
  it('guardrail tones are identical under every comparator', () => {
    const tones = (cmp: Selection['cmp']) => overview(context(ds, S({ cmp }))).guardrails.map((g) => g.tone);
    expect(tones('ly')).toEqual(tones('prev'));
    expect(tones('plan')).toEqual(tones('prev'));
    expect(tones('none')).toEqual(tones('prev'));
  });
});

describe('AT-13 Journey', () => {
  it('J2 highlights Connect data source, J3 median 26 h and shares sum to 100 %', () => {
    const j = journey(context(ds, S()));
    expect(j?.j2.find((x) => x.highlight)?.label).toBe('Connect data source');
    expect(j?.median).toBe('26 h');
    expect(j?.j3.reduce((x, b) => x + b.value, 0)).toBeCloseTo(1, 12);
    expect(j?.j1.filter((r) => r.cells[3] === '—')).toHaveLength(2); // store pages: no bounce / LCP
  });
});

describe('AT-14 cohorts', () => {
  it('K3 blanks per A-74 and the Sep 2026 D7 / D30 pair', () => {
    const k = cohorts(context(ds, S()));
    const row = (label: string) => k.k3.find((r) => r.label === label)?.cells.map((c) => c.text);
    expect(row('Oct 2026')?.[4]).toBe(''); // D30
    const sep = row('Sep 2026');
    expect([sep?.[2], sep?.[4], sep?.[5]]).toEqual(['27%', '13%', '']); // D7, D30, D60
    expect(row('Aug 2026')?.[6]).toBe(''); // D90
  });
});

describe('AT-15 freshness fixtures', () => {
  const at = (source: string, ts: string) =>
    freshness({
      ...ds,
      m: { ...ds.m, sync_log: ds.m.sync_log.map((x) => (x.source_code === source ? { ...x, last_sync_ts: ts } : x)) },
    });
  it('green as written, amber with billing at 2026-11-03 06:00, red with ad platforms at 2026-11-03 12:40', () => {
    expect(freshness(ds).dot).toBe(1);
    expect(frame(context(ds, S())).synced).toBe('Synced 2 h ago');
    expect(at('BILLING', '2026-11-03T06:00').dot).toBe(2);
    expect(at('AD_PLATFORMS', '2026-11-03T12:40').dot).toBe(3);
  });
});

describe('AT-22 Ended / Paused history', () => {
  it('SOC_META_LAL1 spends in the LY window and not in R30; RT_META_RETENTION CPA / ROAS "—"', () => {
    const lal1 = ds.campIndex.get('SOC_META_LAL1') ?? -1;
    expect(metrics(ds, [lal1], ix('2025-10-05'), ix('2025-11-03')).spend).toBeGreaterThan(0);
    expect(metrics(ds, [lal1], ix('2026-10-05'), ix('2026-11-03')).spend).toBe(0);
    const ret = ds.campIndex.get('RT_META_RETENTION') ?? -1;
    expect(metrics(ds, [ret], ix('2026-10-01'), ix('2026-11-03')).spend).toBe(0);
    expect(metrics(ds, [ret], ix('2026-09-30'), ix('2026-09-30')).spend).toBeGreaterThan(0);
    const p1 = campaigns(
      context(ds, S({ preset: 'custom', from: ix('2026-09-01'), to: ix('2026-09-30'), statuses: ['PAUSED'] })),
    );
    expect(p1.p1.map((r) => [r.key, r.cells[5], r.cells[6]])).toEqual([['RT_META_RETENTION', '—', '—']]);
  });
});

describe('movers window (`_Mv Start`, §3.8)', () => {
  const mw = (from: string, to: string, cmp: 'prev' | 'ly') =>
    iso(moversWindow(ds.cal, resolveWindow(ds.cal, 'custom', ix(from), ix(to)), cmp).now);
  it('R30 unchanged', () => {
    expect(iso(moversWindow(ds.cal, resolveWindow(ds.cal, '30d'), 'prev').now)).toEqual(['2026-10-05', '2026-11-03']);
  });
  it('Custom from 2025-01-01 → the last 30 days, PREV and LY', () => {
    expect(mw('2025-01-01', '2026-11-03', 'prev')).toEqual(['2026-10-05', '2026-11-03']);
    expect(mw('2025-01-01', '2026-11-03', 'ly')).toEqual(['2026-10-05', '2026-11-03']);
  });
  it('a 31-day window from 2025-01-01 falls back, a 30-day one does not', () => {
    expect(mw('2025-01-01', '2025-01-31', 'prev')).toEqual(['2025-01-02', '2025-01-31']);
    expect(mw('2025-01-01', '2025-01-30', 'prev')).toEqual(['2025-01-01', '2025-01-30']);
  });
  it('PA-04: the saved state lists O5 / O6 rows', () => {
    const o = overview(context(ds, S({ preset: 'custom', from: 0, to: ds.cal.asOf, grain: 'month' })));
    expect(o.o5).toHaveLength(4);
    expect(o.o6).toHaveLength(5);
  });
});

describe('dynamics window (§5.4)', () => {
  it('30 d → 30 points; 672 d → the last 30; one metric per pop-up', () => {
    const d30 = dynamics(context(ds, S()), 1);
    expect(d30.points).toHaveLength(30);
    expect(d30.title).toBe('Spend | dynamics');
    const all = dynamics(context(ds, S({ preset: 'custom', from: 0, to: ds.cal.asOf })), 5);
    expect([all.points[0]?.day, all.points.at(-1)?.day]).toEqual(['2026-10-05', '2026-11-03']);
    expect(all.title).toBe('CAC | dynamics');
    expect(win(0, 90).days).toBe(91);
  });
});

describe('A-83 performance proxy', () => {
  it('recomputes the default Overview in < 100 ms', () => {
    overview(context(ds, S())); // warm-up (JIT)
    const t = performance.now();
    const ctx = context(ds, S({ cmp: 'ly' }));
    frame(ctx);
    overview(ctx);
    expect(performance.now() - t).toBeLessThan(100);
  });
  it('Channels view builds for a cross-filter', () => {
    expect(
      channels(context(ds, S({ cross: { kind: 'channel', channel: 'PAID_SOCIAL', platform: null } }))).c1,
    ).toHaveLength(6);
  });
});

describe('BLANK semantics (DEF-007: a bare SUM over no rows is BLANK, not 0)', () => {
  const mar25 = S({ preset: 'custom', from: ix('2025-03-01'), to: ix('2025-03-31'), cmp: 'ly' });
  it('V1 / V2 read "LY —" when the LY window holds no rows (was "LY $0.0k" / "LY 0")', () => {
    const v = frame(context(ds, mar25)).vitals;
    expect([v[0]?.ly, v[1]?.ly]).toEqual(['LY —', 'LY —']);
    expect([v[0]?.delta, v[1]?.delta]).toEqual(['', '']);
    expect(v[0]?.value).not.toBe('—');
  });
  it('dynamics: no LY point on a day without rows', () => {
    expect(dynamics(context(ds, mar25), 1).points.every((p) => p.ly === null)).toBe(true);
  });
  it('K7 draws only months with a non-blank K5 Customers (SRCH_SUMMER_PROMO: 3, was 12)', () => {
    expect(cohorts(context(ds, S({ campaigns: ['SRCH_SUMMER_PROMO'] }))).k7).toHaveLength(3);
    expect(cohorts(context(ds, S())).k7).toHaveLength(12);
  });
  it('O7 draws a channel only when its spend is not BLANK in the window', () => {
    expect(overview(context(ds, S({ campaigns: ['SOC_META_LAL1'] }))).o7).toEqual([]);
    expect(overview(context(ds, S())).o7).toHaveLength(6);
  });
  it('K1 / K3 drop all-blank rows', () => {
    const k = cohorts(context(ds, S({ campaigns: ['SRCH_SUMMER_PROMO'] })));
    expect(k.k1.every((r) => r.cells.some((c) => c.text !== ''))).toBe(true);
    expect(k.k3.every((r) => r.cells.some((c) => c.text !== ''))).toBe(true);
  });
});

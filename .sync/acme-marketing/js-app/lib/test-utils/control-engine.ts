import { cohort } from '../engine/cohorts.ts';
import type { Dataset } from '../engine/data.ts';
import { ALL_CAMPAIGNS, installQuality, metrics, s } from '../engine/metrics.ts';
import type { Metrics } from '../engine/metrics.ts';
import { roasDeltas } from '../engine/rank.ts';
import { flags, freshness, verdict } from '../engine/rules.ts';
import type { VerdictMetric } from '../engine/rules.ts';
import { windowScope } from '../engine/scope.ts';
import { DEFAULT_FILTERS } from '../engine/selection.ts';
import { win } from '../engine/windows.ts';

// The control-total surface of the engine (contract §7.1): enumerates scope × period key × metric exactly as
// checks/control_totals_usd.csv is defined (data README › Control totals; generator/metrics.py control_totals) and asks
// the engine modules for every value. Which rows exist is the CSV's contract (this file); every value comes from
// lib/engine. CR: rows are the build's (scripts/build-marketing-data.ts) and are not produced here.

export type ControlKey = `${string}|${string}|${string}`;

const CHANNELS = ['PAID_SEARCH', 'PAID_SOCIAL', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES'];

interface Scope {
  name: string;
  cs: number[];
  single: number | null;
}

/** Control-total scopes through the same mask builder as the Filters window (§3.3: the keys map 1:1 to masks). */
export function controlScopes(ds: Dataset): Scope[] {
  const mask = (f: Partial<typeof DEFAULT_FILTERS>) => windowScope(ds, { ...DEFAULT_FILTERS, ...f });
  const out: Scope[] = [{ name: 'ALL', cs: ALL_CAMPAIGNS(ds), single: null }];
  for (const ch of CHANNELS) out.push({ name: `CH:${ch}`, cs: mask({ channels: [ch] }), single: null });
  for (const p of ['WEB', 'IOS', 'ANDROID']) out.push({ name: `PF:${p}`, cs: mask({ platforms: [p] }), single: null });
  out.push({ name: 'PF:IOS+ANDROID', cs: mask({ platforms: ['IOS', 'ANDROID'] }), single: null });
  ds.campaigns.forEach((c, i) =>
    out.push({ name: `CP:${c.campaign_key}`, cs: mask({ campaigns: [c.campaign_key] }), single: i }),
  );
  const combos: [string, string[], string][] = [
    ['PF:IOS+CH:PAID_SOCIAL', ['IOS'], 'PAID_SOCIAL'],
    ['PF:ANDROID+CH:PAID_SOCIAL', ['ANDROID'], 'PAID_SOCIAL'],
    ['PF:IOS+ANDROID+CH:PAID_SOCIAL', ['IOS', 'ANDROID'], 'PAID_SOCIAL'],
    ['PF:WEB+CH:PAID_SEARCH', ['WEB'], 'PAID_SEARCH'],
  ];
  for (const [name, platforms, ch] of combos) out.push({ name, cs: mask({ platforms, channels: [ch] }), single: null });
  return out;
}

const VERDICT_SRC: Record<VerdictMetric, string> = {
  pacing: 'pacing',
  paid_customers: 'paid_customers.dda',
  blended_cac: 'blended_cac',
  payback_months: 'payback_months',
  ltv_cac: 'ltv_cac',
  trial_to_paid: 'trial_to_paid',
  d7_retention: 'd7_retention',
  d30_retention: 'd30_retention',
  refund_rate: 'refund_rate',
  brand_share: 'brand_share',
  attribution_gap: 'attribution_gap',
};
const TARGET_ROWS: [string, string, boolean][] = [
  ['paid_customers_target', 'PAID_CUSTOMERS_30D', true],
  ['blended_cac_target', 'BLENDED_CAC', false],
  ['payback_target', 'PAYBACK_MONTHS', false],
  ['ltv_cac_target', 'LTV_CAC', false],
  ['trial_to_paid_target', 'TRIAL_TO_PAID', false],
  ['activation_target', 'ACTIVATION_7D', false],
  ['d7_target', 'D7_RETENTION', false],
  ['d30_target', 'D30_RETENTION', false],
  ['refund_target', 'REFUND_RATE', false],
  ['brand_share_target', 'BRAND_SHARE', false],
  ['attribution_gap_target', 'ATTR_GAP', false],
  ['roas_target', 'ROAS', false],
];

export function engineControlRows(ds: Dataset): Map<ControlKey, number> {
  const { cal } = ds;
  const out = new Map<ControlKey, number>();
  const add = (sc: string, pk: string, m: string, v: number) => out.set(`${sc}|${pk}|${m}`, v);
  const ix = (iso: string) => cal.ix(iso);
  const asOf = cal.iso(cal.asOf);
  const R: [string, number, number][] = [
    [`R30-${asOf}`, cal.asOf - 29, cal.asOf],
    ['R30-2026-10-04', ix('2026-09-05'), ix('2026-10-04')],
    ['R30-2025-11-03', ix('2025-10-05'), ix('2025-11-03')],
    [`R7-${asOf}`, cal.asOf - 6, cal.asOf],
    [`MTD-${asOf}`, cal.monthStart(cal.monthOf(cal.asOf)), cal.asOf],
    [`QTD-${asOf}`, cal.quarterStart(cal.asOf), cal.asOf],
  ];
  const M: [string, number, number][] = [];
  for (let m = 0; m < 22; m++) M.push([`M-${cal.monthKey(m)}`, cal.monthStart(m), cal.monthStart(m + 1) - 1]);
  const scopes = controlScopes(ds);
  const cache = new Map<string, Metrics>();
  const monthScope = (n: string) =>
    n === 'ALL' ||
    n === 'PF:WEB' ||
    n === 'PF:IOS' ||
    n === 'PF:ANDROID' ||
    n.startsWith('CH:') ||
    n === 'CP:SOC_META_LAL2';

  for (const [pk, a, b] of [...R, ...M]) {
    const rich = !pk.startsWith('M');
    const n = b - a + 1;
    for (const { name, cs, single } of scopes) {
      if (!rich && !monthScope(name)) continue;
      const r = metrics(ds, cs, a, b, { rich, single });
      if (!(r.spend > 0) && !((r['paid_customers.dda'] ?? 0) > 0) && !(r.signups > 0)) continue;
      cache.set(`${name}|${pk}`, r);
      for (const [k, v] of Object.entries(r)) add(name, pk, k, v);
      if (name === 'ALL')
        for (const [k, code, scaled] of TARGET_ROWS) add(name, pk, k, ds.param(code) * (scaled ? n / 30 : 1));
      if (name.startsWith('CH:')) {
        const t = ds.channelTarget(name.slice(3), 'CPA');
        if (t !== undefined) add(name, pk, 'cpa_target', t);
      }
      if (single !== null) {
        const t = ds.campaigns[single]?.cpa_target_usd;
        if (t !== null && t !== undefined) add(name, pk, 'cpa_target', t);
      }
    }
  }

  for (const [pk, a, b] of R) {
    const n = b - a + 1;
    for (const { name, cs, single } of scopes) {
      const r = cache.get(`${name}|${pk}`);
      if (!r) continue;
      const rp = metrics(ds, cs, a - n, a - 1, { rich: false, single });
      if (name === 'ALL')
        for (const vk of Object.keys(VERDICT_SRC) as VerdictMetric[]) {
          const v = r[VERDICT_SRC[vk]];
          if (v !== undefined) add(name, pk, `verdict.${vk}`, verdict(ds, vk, v, n));
        }
      if ((name.startsWith('CP:') || name.startsWith('CH:')) && r.spend > 0) {
        const iq =
          single !== null && ds.campaigns[single]?.objective_code === 'INSTALL'
            ? installQuality(ds, cs, a, b)
            : undefined;
        if (iq !== undefined) add(name, pk, 'install_quality_delta', iq);
        for (const [k, v] of Object.entries(flags(ds, { r, cs, single, iq }))) add(name, pk, `flag.${k}`, v);
      }
      if (pk.startsWith('R30') && (single !== null || name === 'ALL') && r.trials > 0 && rp.trials > 0)
        add(
          name,
          pk,
          'trial_shortfall',
          (r.trials * (rp['paid_customers.dda'] ?? 0)) / rp.trials - (r['paid_customers.dda'] ?? 0),
        );
    }
  }

  // default window only
  const [W, a, b] = R[0] as [string, number, number];
  const n = 30;
  const allc = ALL_CAMPAIGNS(ds);
  let tripped = 0;
  ds.campaigns.forEach((c, i) => {
    const r = cache.get(`CP:${c.campaign_key}|${W}`);
    if (!r || !(r.spend > 0)) return;
    const fat =
      (r.ctr_slope_7d ?? 0) < ds.param('FATIGUE_SLOPE') && (r.frequency_7d ?? 0) > ds.param('FATIGUE_FREQ') ? 1 : 0;
    add(`CP:${c.campaign_key}`, W, 'alert.FATIGUE', fat);
    tripped += fat;
    if (fat && r.ctr_slope_7d !== undefined) add(`CP:${c.campaign_key}`, W, 'alert_value.FATIGUE', r.ctr_slope_7d);
    if (c.objective_code === 'INSTALL') {
      const iq = installQuality(ds, [i], a, b) ?? 0;
      const t = iq < ds.param('INSTALL_QUALITY_PT') ? 1 : 0;
      add(`CP:${c.campaign_key}`, W, 'alert.INSTALL_QUALITY', t);
      tripped += t;
      if (t) add(`CP:${c.campaign_key}`, W, 'alert_value.INSTALL_QUALITY', iq);
    }
  });
  for (const ch of CHANNELS) {
    const r = cache.get(`CH:${ch}|${W}`) as Metrics;
    const po = (r.pacing ?? 0) > ds.param('PACING_HI') ? 1 : 0;
    add(`CH:${ch}`, W, 'alert.PACING_OVER', po);
    tripped += po;
    if (po) add(`CH:${ch}`, W, 'alert_value.PACING_OVER', r.spend - r.plan);
    const us = (r.pacing ?? 0) < ds.param('PACING_LO') && (r.roas_90d ?? 0) >= ds.param('ROAS_SCALE') ? 1 : 0;
    add(`CH:${ch}`, W, 'alert.UNDERSPENT_SCALE', us);
    tripped += us;
    if (us) add(`CH:${ch}`, W, 'alert_value.UNDERSPENT_SCALE', r.plan - r.spend);
  }
  const rA = cache.get(`ALL|${W}`) as Metrics;
  const rpA = metrics(ds, allc, a - n, a - 1, { rich: false });
  const gapDelta = (rA.attribution_gap ?? 0) - (rpA.attribution_gap ?? 0);
  const gw = gapDelta >= ds.param('ATTR_GAP_WIDEN_PT') ? 1 : 0;
  add('ALL', W, 'alert.ATTR_GAP_WIDEN', gw);
  tripped += gw;
  add('ALL', W, 'alert_value.ATTR_GAP_WIDEN', gapDelta);
  const fr = freshness(ds);
  add('ALL', W, 'alert.DATA_STALE', fr.stale ? 1 : 0);
  tripped += fr.stale ? 1 : 0;
  add('ALL', W, 'alerts_tripped', tripped);
  add('ALL', W, 'freshness_dot', fr.dot);
  add('ALL', W, 'synced_hours_ago', fr.syncedHours);
  for (const x of fr.ages) add('ALL', W, `source_age_h.${x.source.source_code}`, x.hours);

  // movers (pre-round-1 three best / three worst control rows; the cards show five)
  const deltas = roasDeltas(ds, allc, win(a, b), win(a - n, a - 1), 'DDA');
  for (const d of deltas) add(`CP:${ds.campaigns[d.c]?.campaign_key}`, W, 'roas_delta', d.delta);
  const order = [...deltas].sort((x, y) => y.delta - x.delta);
  order.slice(0, 3).forEach((d, j) => add(`CP:${ds.campaigns[d.c]?.campaign_key}`, W, 'mover_rank', j + 1));
  [...order]
    .reverse()
    .slice(0, 3)
    .forEach((d, j) => add(`CP:${ds.campaigns[d.c]?.campaign_key}`, W, 'mover_rank', -(j + 1)));

  // story rows (A-63, A-64)
  const dayCac = (d: number) => s(ds, 'spend_usd', allc, d, d) / s(ds, 'paid_dda', allc, d, d);
  const mean = (lo: number, hi: number) => {
    let t = 0;
    for (let d = lo; d <= hi; d++) t += dayCac(d);
    return t / (hi - lo + 1);
  };
  const st: Record<string, number> = {};
  st['story.step_date'] = 20261018;
  st['story.cac_step_7d'] = mean(ix('2026-10-18'), ix('2026-10-24')) / mean(ix('2026-10-11'), ix('2026-10-17')) - 1;
  const A0 = ix('2026-10-05');
  const A1 = ix('2026-10-17');
  const Z0 = ix('2026-10-18');
  const t2p = (cs: number[], lo: number, hi: number) => s(ds, 'paid_dda', cs, lo, hi) / s(ds, 'trials', cs, lo, hi);
  const sc = (pf: (p: string) => boolean, ch: string) =>
    allc.filter((c) => pf(ds.campaigns[c]?.platform_code ?? '') && ds.campaigns[c]?.channel_code === ch);
  for (const [nm, cs] of [
    ['mps', sc((p) => p !== 'WEB', 'PAID_SOCIAL')],
    ['web_search', sc((p) => p === 'WEB', 'PAID_SEARCH')],
  ] as const) {
    st[`story.${nm}_trial_to_paid_before`] = t2p(cs, A0, A1);
    st[`story.${nm}_trial_to_paid_after`] = t2p(cs, Z0, b);
  }
  for (const ch of CHANNELS.filter((c) => c !== 'PAID_SOCIAL')) {
    const cs = allc.filter((c) => ds.campaigns[c]?.channel_code === ch);
    st[`story.trial_to_paid_shift.${ch}`] = t2p(cs, Z0, b) - t2p(cs, A0, A1);
  }
  st['story.loss_share_lookalike'] =
    (out.get(`CP:SOC_META_LAL2|${W}|trial_shortfall`) ?? Number.NaN) /
    (out.get(`ALL|${W}|trial_shortfall`) ?? Number.NaN);
  const u = [ds.campIndex.get('APP_UAC_ANDROID') ?? -1];
  const irate = (lo: number, hi: number) => s(ds, 'signups', u, lo, hi) / s(ds, 'installs', u, lo, hi);
  st['story.uac_install_signup_before'] = irate(A0, ix('2026-10-21'));
  st['story.uac_install_signup_after'] = irate(ix('2026-10-22'), b);
  st['story.uac_install_signup_last7'] = irate(b - 6, b);
  st['story.uac_install_signup_prev'] = irate(a - n, a - 1);
  st['story.attr_gap_delta'] = gapDelta;
  for (const [k, v] of Object.entries(st)) add('ALL', W, k, v);

  // cohort keys at ALL and CP:SOC_META_LAL2
  const lal2 = ds.campIndex.get('SOC_META_LAL2') ?? -1;
  for (const [name, cs] of [
    ['ALL', allc],
    ['CP:SOC_META_LAL2', [lal2]],
  ] as const) {
    for (let m = 0; m < 23; m++) {
      const k = cohort(ds, cs, m);
      if (!k) continue;
      const pk = `C-${cal.monthKey(m)}`;
      add(name, pk, 'customers', k.customers);
      add(name, pk, 'arpa', k.arpa);
      add(name, pk, 'cohort_cac', k.cac);
      add(name, pk, 'refund_rate', k.refundRate);
      for (const p of k.payback) add(name, pk, `payback.m${p.offset}`, p.value);
      if (k.paybackMonth !== undefined) add(name, pk, 'payback_month', k.paybackMonth);
      for (const [dn, v] of Object.entries(k.retention)) if (v !== undefined) add(name, pk, `retention.d${dn}`, v);
    }
  }

  // term keys (P5) of SOC_META_LAL2 and SRCH_NONBRAND_ANALYTICS over the default window
  const terms = ds.terms;
  if (!terms) throw new Error('term-day not loaded');
  ds.m.terms.forEach((t, ti) => {
    if (t.campaign_key !== 'SOC_META_LAL2' && t.campaign_key !== 'SRCH_NONBRAND_ANALYTICS') return;
    const T = (col: keyof typeof terms.t) => {
      let x = 0;
      for (let d = a; d <= b; d++) x += terms.t[col][ti * ds.ND + d] ?? 0;
      return x;
    };
    const im = T('impressions');
    const cl = T('clicks');
    const sp = T('spend_usd');
    const su = T('signups');
    if (im === 0 && cl === 0 && sp === 0 && su === 0) return;
    const sk = `TM:${t.term_key}`;
    add(sk, W, 'impressions', im);
    add(sk, W, 'clicks', cl);
    add(sk, W, 'spend', sp);
    add(sk, W, 'signups', su);
    if (cl > 0) {
      add(sk, W, 'cpc', sp / cl);
      add(sk, W, 'cvr', su / cl);
    }
  });

  // daily keys (O3) at ALL and CP:SOC_META_LAL2
  for (const [name, cs] of [
    ['ALL', allc],
    ['CP:SOC_META_LAL2', [lal2]],
  ] as const) {
    for (let t = a; t <= b; t++) {
      const pk = `D-${cal.iso(t)}`;
      const r = metrics(ds, cs, t, t, { rich: false });
      add(name, pk, 'spend', r.spend);
      add(name, pk, 'plan', r.plan);
      add(name, pk, 'impressions', r.impressions);
      add(name, pk, 'clicks', r.clicks);
      add(name, pk, 'signups', r.signups);
      add(name, pk, 'trials', r.trials);
      add(name, pk, 'paid_customers.dda', r['paid_customers.dda'] ?? 0);
      add(name, pk, 'new_mrr.dda', r['new_mrr.dda'] ?? 0);
      if (r.paid_cac !== undefined) add(name, pk, 'paid_cac', r.paid_cac);
    }
  }
  return out;
}

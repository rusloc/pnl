import type { ModelCode } from '../data/manifest.ts';
import { cohort, cohortCustomers, k1Months, k3Months, lastTwelve } from './cohorts.ts';
import {
  ACT_BINS,
  C2_STAGES,
  CARDS,
  CHIPS,
  FLAG_JOIN,
  FLAG_WORDS,
  FUNNEL_STAGES,
  GUARDRAILS,
  MARKET_NAMES,
  P5_CAPTION,
  PILL,
  STATUS_NAMES,
  TIER_NAMES,
  VITAL_LABELS,
  cpaOverWord,
  dynamicsTitle,
  infoNote,
  syncedText,
} from './copy.ts';
import type { CardCode } from './copy.ts';
import { MODEL_KEY, RET_DAYS, hasRows, sum } from './data.ts';
import type { Dataset } from './data.ts';
import { DASH, arrowOf, compact, isFlat, monthName, num, pct, shortDate, signed, times, usd, usdK } from './format.ts';
import { BIN_COLS, installQuality, metrics, s } from './metrics.ts';
import type { Metrics } from './metrics.ts';
import { anomalies, churnedByChannel, movers, refundsByChannel, selectedCampaign } from './rank.ts';
import { flagList, flags, freshness, pacingColour, verdict } from './rules.ts';
import type { FlagCode, Verdict, VerdictMetric } from './rules.ts';
import { bodyScope, listScope, singleOf, windowScope } from './scope.ts';
import type { Filters, Selection } from './selection.ts';
import { buckets, dynamicsWindow, lastYear, resolveWindow, win } from './windows.ts';
import type { Win } from './windows.ts';

// View models (contract §3.11, §5): everything a component renders, as strings and plain numbers for the geometry.
// Components compute nothing (CLAUDE.md › Track C); the engine modules compute, this file formats (format.ts) and
// picks copy (copy.ts). One Ctx per selection; each view builder is called only for the view on screen.

export type Tone = 'good' | 'warn' | 'crit' | 'flat' | 'ink';
const VERDICT_TONE: Record<Verdict, Tone> = { 1: 'good', 2: 'warn', 3: 'crit' };

export interface Ctx {
  ds: Dataset;
  sel: Selection;
  w: Win;
  model: ModelCode;
  /** window filters only (the vitals) */
  winScope: number[];
  /** window filters ∩ cross-filter (every body card) */
  body: number[];
}

export function context(ds: Dataset, sel: Selection): Ctx {
  const w = resolveWindow(ds.cal, sel.preset, sel.from ?? undefined, sel.to ?? undefined);
  return { ds, sel, w, model: sel.model, winScope: windowScope(ds, sel), body: bodyScope(ds, sel, sel.cross) };
}

const paidKey = (m: ModelCode) => `paid_customers.${MODEL_KEY[m]}`;
const channelName = (ds: Dataset, code: string) =>
  ds.m.channels.find((c) => c.channel_code === code)?.channel_name ?? code;
const platformName = (ds: Dataset, code: string) =>
  ds.m.platforms.find((p) => p.platform_code === code)?.platform_name ?? code;
const modelName = (ds: Dataset, m: ModelCode) => ds.m.models.find((x) => x.model_code === m)?.model_name ?? m;

// ---------- frame: pill, freshness, chips, vitals ----------

export function pillText(ctx: Ctx): string {
  const { ds, w, sel } = ctx;
  const end = ds.cal.iso(w.b);
  const year = end.slice(0, 4) !== ds.m.meta.as_of.slice(0, 4) ? ` ${end.slice(0, 4)}` : '';
  const basis =
    sel.cmp === 'prev' ? PILL.prev(w.days) : sel.cmp === 'ly' ? PILL.ly : sel.cmp === 'plan' ? PILL.plan : PILL.none;
  return `${shortDate(ds.cal.iso(w.a))} – ${shortDate(end)}${year}${PILL.sep}${basis}`;
}

export interface Chip {
  /** facet removed by the chip's ×; 'cross' = the cross-filter */
  facet: keyof Filters | 'model' | 'cross';
  label: string;
}

/** One chip per active non-default facet (measure 'Chips Line'), the cross-filter chip last. */
export function chips(ds: Dataset, sel: Selection): Chip[] {
  const out: Chip[] = [];
  const byName = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b)).join(CHIPS.join);
  if (sel.platforms.length > 0) {
    const names = ds.m.platforms.filter((p) => sel.platforms.includes(p.platform_code)).map((p) => p.platform_name);
    out.push({ facet: 'platforms', label: CHIPS.platform + names.join(CHIPS.join) });
  }
  if (sel.market)
    out.push({
      facet: 'market',
      label: CHIPS.market + (MARKET_NAMES[sel.market as keyof typeof MARKET_NAMES] ?? sel.market),
    });
  if (sel.tier)
    out.push({ facet: 'tier', label: CHIPS.tier + (TIER_NAMES[sel.tier as keyof typeof TIER_NAMES] ?? sel.tier) });
  if (sel.channels.length > 0)
    out.push({ facet: 'channels', label: CHIPS.channel + byName(sel.channels.map((c) => channelName(ds, c))) });
  if (sel.networks.length > 0)
    out.push({
      facet: 'networks',
      label:
        CHIPS.network +
        byName(sel.networks.map((n) => ds.m.networks.find((x) => x.network_code === n)?.network_name ?? n)),
    });
  if (sel.campaigns.length > 0) {
    const one = sel.campaigns.length === 1 ? ds.campaigns.find((c) => c.campaign_key === sel.campaigns[0]) : undefined;
    out.push({
      facet: 'campaigns',
      label: CHIPS.campaign + (one ? one.campaign_name : CHIPS.picked(sel.campaigns.length)),
    });
  }
  if (sel.statuses)
    out.push({ facet: 'statuses', label: CHIPS.status + byName(sel.statuses.map((x) => STATUS_NAMES[x])) });
  if (sel.model !== 'DDA') out.push({ facet: 'model', label: CHIPS.attribution + modelName(ds, sel.model) });
  if (sel.cross) out.push({ facet: 'cross', label: CHIPS.selected + crossName(ds, sel) });
  return out;
}

/** The chips as one line (the PBIP 'Chips Line', joined by CHIPS.segmentJoin); '' when nothing is active. */
export const chipsText = (cs: readonly Chip[]): string => cs.map((c) => c.label).join(CHIPS.segmentJoin);

function crossName(ds: Dataset, sel: Selection): string {
  const x = sel.cross;
  if (!x) return '';
  if (x.kind === 'campaign')
    return ds.campaigns.find((c) => c.campaign_key === x.campaign)?.campaign_name ?? x.campaign;
  return channelName(ds, x.channel) + (x.platform ? CHIPS.crossJoin + platformName(ds, x.platform) : '');
}

/** Active facets per Filters rail group (the dots) and the Filters button badge. */
export function activeCounts(sel: Selection) {
  const period =
    Number(sel.preset !== 'custom' ? sel.preset !== '30d' : true) +
    Number(sel.cmp !== 'prev') +
    Number(sel.grain !== 'day');
  const groups = {
    period,
    scope: Number(sel.platforms.length > 0) + Number(sel.tier !== null),
    channels: Number(sel.channels.length > 0) + Number(sel.networks.length > 0),
    campaigns: Number(sel.campaigns.length > 0) + Number(sel.statuses !== null),
    audience: Number(sel.market !== null),
    attribution: Number(sel.model !== 'DDA'),
  };
  // badge = the PBIP '_Filter Count': platform, market, tier, channel / network, campaign, status, model
  const badge =
    Number(sel.platforms.length > 0) +
    Number(sel.market !== null) +
    Number(sel.tier !== null) +
    Number(sel.channels.length > 0 || sel.networks.length > 0) +
    Number(sel.campaigns.length > 0) +
    Number(sel.statuses !== null) +
    Number(sel.model !== 'DDA');
  return { groups, badge };
}

export interface VitalView {
  n: number;
  code: CardCode;
  label: string;
  value: string;
  delta: string;
  arrow: string;
  tone: Tone;
  ly: string;
  dynTitle: string;
}

type VitalSpec = {
  value: (r: Metrics) => number | undefined;
  /** relative Δ (%) or absolute (pt / d / ×) */
  rel: boolean;
  /** up is good */
  upGood: boolean;
  fmt: (v: number) => string;
  fmtD: (d: number) => string;
};
const VITALS: VitalSpec[] = [
  { value: (r) => r.spend, rel: true, upGood: false, fmt: usdK, fmtD: (d) => `${num(Math.abs(d) * 100, 1)}%` },
  {
    value: (r) => r.signups,
    rel: true,
    upGood: true,
    fmt: (v) => num(v),
    fmtD: (d) => `${num(Math.abs(d) * 100, 1)}%`,
  },
  { value: (r) => r._v3, rel: false, upGood: true, fmt: (v) => pct(v), fmtD: (d) => `${num(Math.abs(d) * 100, 1)} pt` },
  {
    value: (r) => r._v4,
    rel: false,
    upGood: false,
    fmt: (v) => `${num(v, 1)} d`,
    fmtD: (d) => `${num(Math.abs(d), 1)} d`,
  },
  {
    value: (r) => r.paid_cac,
    rel: true,
    upGood: false,
    fmt: (v) => usd(v),
    fmtD: (d) => `${num(Math.abs(d) * 100, 1)}%`,
  },
  { value: (r) => r.roas_90d, rel: false, upGood: true, fmt: (v) => times(v), fmtD: (d) => num(Math.abs(d), 2) },
];

/** The window metrics a vital reads, plus V3 (paid ÷ sign-ups) and V4 (median hours ÷ 24). */
function vitalMetrics(ds: Dataset, cs: readonly number[], w: Win, model: ModelCode): Metrics {
  const r = metrics(ds, cs, w.a, w.b, { single: singleOf(cs), model });
  const p = r[paidKey(model)] ?? 0;
  if (r.signups > 0) r._v3 = p / r.signups;
  if (r.act_median_hours !== undefined) r._v4 = r.act_median_hours / 24;
  return r;
}

export function vitals(ctx: Ctx): VitalView[] {
  const { ds, w, model, winScope } = ctx;
  const lyw = lastYear(ds.cal, w);
  const now = vitalMetrics(ds, winScope, w, model);
  const ly = vitalMetrics(ds, winScope, lyw, model);
  // V1 / V2 are bare SUMs: no rows in the window = BLANK ("—"), not 0 (DEF-007); the ratio vitals blank on their own
  const rowsNow = hasRows(ds, winScope, w.a, w.b);
  const rowsLy = hasRows(ds, winScope, lyw.a, lyw.b);
  return VITALS.map((v, i) => {
    const code = `V${i + 1}` as CardCode;
    const sum = i < 2;
    const a = sum && !rowsNow ? undefined : v.value(now);
    const b = sum && !rowsLy ? undefined : v.value(ly);
    const d = a === undefined || b === undefined || (v.rel && b === 0) ? undefined : v.rel ? a / b - 1 : a - b;
    const card = CARDS.find((c) => c.code === code);
    return {
      n: i + 1,
      code,
      label: VITAL_LABELS[code as keyof typeof VITAL_LABELS],
      value: a === undefined ? DASH : v.fmt(a),
      delta: d === undefined ? '' : `${d < 0 ? '−' : '+'}${v.fmtD(d)}`,
      arrow: d === undefined ? '' : arrowOf(d),
      tone: d === undefined || isFlat(d) ? 'flat' : d > 0 === v.upGood ? 'good' : 'crit',
      ly: b === undefined ? `LY ${DASH}` : `LY ${v.fmt(b)}`,
      dynTitle: dynamicsTitle(card?.title ?? ''),
    };
  });
}

export function frame(ctx: Ctx) {
  const { ds, sel } = ctx;
  const fr = freshness(ds);
  return {
    pill: pillText(ctx),
    synced: syncedText(fr.syncedHours),
    dot: fr.dot,
    sources: fr.ages.map((x) => ({
      name: x.source.source_name,
      at: x.source.last_sync_ts.replace('T', ' '),
      hours: x.hours,
    })),
    chips: chips(ds, sel),
    active: activeCounts(sel),
    vitals: vitals(ctx),
  };
}

/** ⓘ pop-up: title · what · formula · note + the window and model in use. */
export function cardInfo(ctx: Ctx, code: CardCode) {
  const card = CARDS.find((c) => c.code === code);
  if (!card) throw new Error(`card ${code}`);
  return {
    title: card.title,
    what: card.what,
    formula: card.formula,
    note: infoNote(card.note, pillText(ctx), modelName(ctx.ds, ctx.model)),
  };
}

// ---------- flags ----------

const ROOT_CAUSE: readonly FlagCode[] = ['FATIGUE', 'FREQUENCY', 'INSTALL_QUALITY', 'CPA_OVER', 'OVER_PACING'];
const GATES: readonly FlagCode[] = ['LEARNING', 'PIPELINE_LED', 'LEAD_GOAL', 'NO_CPA_GOAL'];

export interface FlagView {
  text: string;
  tone: Tone;
}
function flagView(
  ds: Dataset,
  codes: FlagCode[],
  r: Metrics,
  target: number | null | undefined,
  model: ModelCode,
): FlagView {
  const words = codes.map((c) => {
    if (c !== 'CPA_OVER') return FLAG_WORDS[c];
    const cpa = r[`cpa.${MODEL_KEY[model]}`];
    return cpaOverWord(cpa !== undefined && target ? pct(cpa / target - 1, 0) : DASH);
  });
  const tone: Tone = codes.some((c) => ROOT_CAUSE.includes(c))
    ? 'crit'
    : codes.some((c) => c === 'UNDERSPENT' || c === 'VIEW_THROUGH')
      ? 'warn'
      : codes.includes('ON_TARGET')
        ? 'good'
        : codes.some((c) => GATES.includes(c))
          ? 'ink'
          : 'ink';
  return { text: words.join(FLAG_JOIN), tone };
}

// ---------- Overview ----------

export function overview(ctx: Ctx) {
  const { ds, w, model, body, sel } = ctx;
  const r = metrics(ds, body, w.a, w.b, { single: singleOf(body), model });
  const paid = r[paidKey(model)] ?? 0;
  const cpa = r[`cpa.${MODEL_KEY[model]}`];
  const funnelVals = [r.impressions, r.clicks, r.landed, r.signups, r.activated, r.trials, paid];
  const logs = funnelVals.map((v) => (v > 0 ? Math.log10(v) : 0));
  const maxLog = Math.max(...logs, 1e-9);
  const tips = [
    `${compact(r.impressions)}  |  CPM $${num(r.cpm, 1)}`,
    `${compact(r.clicks)}  |  CTR ${pct(r.ctr, 2)} | CPC $${num(r.cpc, 2)}`,
    `${compact(r.landed)}  |  ${compact(r.sessions)} web + ${compact(r.installs)} installs`,
    `${compact(r.signups)}  |  ${pct(r.click_signup_rate)} of clicks | CPL $${num(r.cpl)}`,
    `${compact(r.activated)}  |  ${pct(r.activation_rate, 0)} | $${num(r.cost_per_activated)}`,
    `${compact(r.trials)}  |  ${pct(r.trial_rate, 0)} of sign-ups`,
    `${num(paid)}  |  ${pct(r.trial_to_paid)} of trials | CPA $${num(cpa)}`,
  ];
  const funnel = FUNNEL_STAGES.map((label, i) => ({
    label,
    value: num(funnelVals[i]),
    width: (logs[i] ?? 0) / maxLog,
    tip: tips[i] ?? '',
  }));

  const G: [VerdictMetric, string, number, string][] = [
    ['trial_to_paid', 'TRIAL_TO_PAID', 1, 'p1'],
    ['d7_retention', 'D7_RETENTION', 1, 'p0'],
    ['d30_retention', 'D30_RETENTION', 1, 'p0'],
    ['refund_rate', 'REFUND_RATE', 1, 'p1'],
    ['brand_share', 'BRAND_SHARE', 1, 'p0'],
    ['attribution_gap', 'ATTR_GAP', 1, 's0'],
  ];
  const guardrails = G.map(([metric, code, , fmt], i) => {
    const v = r[metric];
    const t = ds.param(code);
    const text = v === undefined ? 'n/a' : fmt === 'p1' ? pct(v) : fmt === 'p0' ? pct(v, 0) : `${signed(v * 100, 0)}%`;
    return {
      label: GUARDRAILS[i]?.label ?? '',
      target: `${GUARDRAILS[i]?.target ?? ''}${pct(t, 0)}`,
      value: text,
      meter: v === undefined || t <= 0 ? 0 : Math.min(Math.max(v, 0) / (2 * t), 1),
      tone: v === undefined ? ('flat' as Tone) : VERDICT_TONE[verdict(ds, metric, v, w.days)],
    };
  });

  const channelsIn = ds.m.channels.filter((c) =>
    hasRows(
      ds,
      body.filter((x) => ds.campaigns[x]?.channel_code === c.channel_code),
      w.a,
      w.b,
    ),
  );
  const o7rows = channelsIn.map((c) => {
    const cs = body.filter((x) => ds.campaigns[x]?.channel_code === c.channel_code);
    const sp = s(ds, 'spend_usd', cs, w.a, w.b);
    const pc = s(ds, `paid_${MODEL_KEY[model]}`, cs, w.a, w.b);
    return { code: c.channel_code, name: c.channel_name, spend: sp, spendText: usdK(sp), paid: pc, paidText: num(pc) };
  });
  const maxSp = Math.max(...o7rows.map((x) => x.spend), 1e-9);
  const maxPc = Math.max(...o7rows.map((x) => x.paid), 1e-9);
  const o7 = o7rows.map((x) => ({ ...x, spendW: x.spend / maxSp, paidW: x.paid / maxPc }));

  const an = anomalies(ds, body, w, sel.cmp, sel.o5, model);
  const alertTitle = (rule: string | null) =>
    rule ? (ds.m.alert_rules.find((x) => x.rule_code === rule)?.title ?? rule) : '';
  const o5 = an.rows.map((d, i) => ({
    rank: i + 1,
    key: ds.campaigns[d.c]?.campaign_key ?? '',
    campaign: ds.campaigns[d.c]?.campaign_name ?? '',
    channel: channelName(ds, ds.campaigns[d.c]?.channel_code ?? ''),
    paid: num(d.paid),
    before: num(d.before),
    delta: signed(d.delta, 1),
    tone: (d.delta >= 0 ? 'good' : 'crit') as Tone,
    alert: alertTitle(d.alert),
  }));
  const mv = movers(ds, body, w, sel.cmp, sel.o6, model);
  const maxD = Math.max(...mv.rows.map((d) => Math.abs(d.delta)), 1e-9);
  const o6 = mv.rows.map((d) => ({
    key: ds.campaigns[d.c]?.campaign_key ?? '',
    campaign: ds.campaigns[d.c]?.campaign_name ?? '',
    delta: signed(d.delta, 2),
    height: Math.abs(d.delta) / maxD,
    tone: (sel.o6 === 'top' ? 'good' : 'crit') as Tone,
  }));

  return { funnel, guardrails, o7, o5, o6, o3: trend(ctx) };
}

/** O3: spend and plan columns + paid CAC line per bucket; the fixed story day (Oct 18) when inside the window. */
export function trend(ctx: Ctx) {
  const { ds, w, model, body, sel } = ctx;
  const pk = `paid_${MODEL_KEY[model]}` as const;
  const pts = buckets(ds.cal, w, sel.grain).map((bk) => {
    const sp = s(ds, 'spend_usd', body, bk.a, bk.b);
    const pl = sum(ds.plan, ds.ND, body, bk.a, bk.b);
    const pd = s(ds, pk, body, bk.a, bk.b);
    const day = ds.cal.iso(bk.a);
    const axis = sel.grain === 'month' ? monthName(day.slice(0, 7)) : shortDate(day);
    return {
      day,
      axis,
      axisLong: sel.grain === 'day' ? shortDate(day) : axis,
      spend: sp,
      plan: pl,
      cac: pd > 0 ? sp / pd : null,
    };
  });
  const story = ds.cal.ix('2026-10-18');
  const markerIx =
    story >= w.a && story <= w.b ? buckets(ds.cal, w, sel.grain).findIndex((bk) => story >= bk.a && story <= bk.b) : -1;
  return {
    grain: sel.grain,
    points: pts,
    marker: markerIx >= 0 ? { index: markerIx, label: shortDate('2026-10-18') } : null,
  };
}

// ---------- Channels ----------

export function channels(ctx: Ctx) {
  const { ds, w, model, sel } = ctx;
  // C1 is a cross-filter source: it ignores its own channel pick (a campaign cross-filter still scopes it)
  const base = sel.cross?.kind === 'campaign' ? bodyScope(ds, sel, sel.cross) : windowScope(ds, sel);
  const scopeTotal = s(ds, 'spend_usd', base, w.a, w.b);
  // `Spend Share` removes the channel filter only: a platform row is a share of that platform's spend in scope
  const platformTotal = (pf: string) =>
    s(
      ds,
      'spend_usd',
      base.filter((x) => ds.campaigns[x]?.platform_code === pf),
      w.a,
      w.b,
    );
  const row = (cs: number[], label: string, code: string, platform: string | null, total: number) => {
    const r = metrics(ds, cs, w.a, w.b, { single: null, model });
    const iq = undefined;
    const f = flagList(flags(ds, { r, cs, single: null, iq, model }));
    const fv = flagView(ds, f, r, ds.channelTarget(code, 'CPA'), model);
    return {
      code,
      platform,
      label,
      spend: usd(r.spend),
      share: total > 0 ? pct(r.spend / total) : DASH,
      paid: num(r[paidKey(model)]),
      cac: usd(r.paid_cac),
      roas: r.roas_90d === undefined ? DASH : num(r.roas_90d, 2),
      cs: pct(r.click_signup_rate),
      pacing: pct(r.pacing, 0),
      pacingTone: (['ink', 'ink', 'warn', 'crit'] as Tone[])[pacingColour(ds, r.pacing)] ?? 'ink',
      flags: r.spend > 0 ? fv : { text: '', tone: 'ink' as Tone },
      selected: sel.cross?.kind === 'channel' && sel.cross.channel === code && sel.cross.platform === platform,
    };
  };
  const c1 = ds.m.channels
    .map((c) => {
      const cs = base.filter((x) => ds.campaigns[x]?.channel_code === c.channel_code);
      const channelTotal = s(ds, 'spend_usd', cs, w.a, w.b);
      if (cs.length === 0 || !(channelTotal > 0 || s(ds, 'paid_dda', cs, w.a, w.b) > 0)) return null;
      const platforms = ds.m.platforms
        .map((p) => {
          const ps = cs.filter((x) => ds.campaigns[x]?.platform_code === p.platform_code);
          return ps.length > 0 && s(ds, 'spend_usd', ps, w.a, w.b) > 0
            ? row(ps, p.platform_name, c.channel_code, p.platform_code, platformTotal(p.platform_code))
            : null;
        })
        .filter((x) => x !== null);
      return { ...row(cs, c.channel_name, c.channel_code, null, scopeTotal), platforms };
    })
    .filter((x) => x !== null);

  const { body } = ctx;
  const web = body.filter((x) => ds.campaigns[x]?.platform_code === 'WEB');
  const app = body.filter((x) => ds.campaigns[x]?.platform_code !== 'WEB');
  const rw = metrics(ds, web, w.a, w.b, { rich: false, model });
  const ra = metrics(ds, app, w.a, w.b, { rich: false, model });
  const div = (x: number | undefined, y: number | undefined) => (x !== undefined && y ? x / y : undefined);
  const webRates = [
    rw.ctr,
    div(rw.sessions, rw.clicks),
    undefined,
    div(rw.signups, rw.sessions),
    rw.activation_rate,
    rw.trial_rate,
    rw.trial_to_paid,
  ];
  const appRates = [
    ra.ctr,
    div(ra.store_views, ra.clicks),
    ra.store_cvr,
    div(ra.signups, ra.installs),
    ra.activation_rate,
    ra.trial_rate,
    ra.trial_to_paid,
  ];
  const c2 = C2_STAGES.map((label, i) => ({
    label,
    web: web.length > 0 ? webRates[i] : undefined,
    app: app.length > 0 ? appRates[i] : undefined,
    webText: web.length > 0 && webRates[i] !== undefined ? pct(webRates[i]) : '',
    appText: app.length > 0 && appRates[i] !== undefined ? pct(appRates[i]) : '',
  }));
  const byChannel = (cs: number[]) =>
    ds.m.channels
      .map((c) => {
        const xs = cs.filter((x) => ds.campaigns[x]?.channel_code === c.channel_code);
        const p = s(ds, `paid_${MODEL_KEY[model]}`, xs, w.a, w.b);
        const sp = s(ds, 'spend_usd', xs, w.a, w.b);
        return {
          code: c.channel_code,
          name: c.channel_name,
          value: p,
          label: `${num(p)}  |  ${p > 0 ? usd(sp / p) : DASH}`,
        };
      })
      .filter((x) => x.value > 0);
  return { c1, c2, c5: byChannel(web), c6: byChannel(app) };
}

// ---------- Campaigns ----------

export function campaigns(ctx: Ctx) {
  const { ds, w, model, sel, body } = ctx;
  const base = sel.cross?.kind === 'channel' ? bodyScope(ds, sel, sel.cross) : windowScope(ds, sel);
  const rows = listScope(ds, sel, base).map((c) => {
    const camp = ds.campaigns[c];
    const r = metrics(ds, [c], w.a, w.b, { single: c, model });
    const noGoal = camp?.objective_code === 'LEAD' || camp?.objective_code === 'RETENTION';
    const has = r.spend > 0;
    const iq = camp?.objective_code === 'INSTALL' ? installQuality(ds, [c], w.a, w.b) : undefined;
    const f = flagList(flags(ds, { r, cs: [c], single: c, iq, model }));
    const cpa = r[`cpa.${MODEL_KEY[model]}`];
    return {
      key: camp?.campaign_key ?? '',
      spendValue: r.spend,
      cells: [
        camp?.campaign_name ?? '',
        channelName(ds, camp?.channel_code ?? ''),
        platformName(ds, camp?.platform_code ?? ''),
        has ? usd(r.spend) : '',
        r.pacing === undefined ? '' : pct(r.pacing, 0),
        !has ? '' : noGoal ? DASH : cpa === undefined ? '' : usd(cpa),
        !has ? '' : noGoal ? DASH : r.roas_90d === undefined ? '' : num(r.roas_90d, 2),
        r.ctr_slope_7d === undefined ? '' : `${signed(r.ctr_slope_7d * 100, 0)}%`,
        r.frequency_7d === undefined ? '' : num(r.frequency_7d, 1),
      ],
      pacingTone: (['ink', 'ink', 'warn', 'crit'] as Tone[])[pacingColour(ds, r.pacing)] ?? 'ink',
      flags: has ? flagView(ds, f, r, camp?.cpa_target_usd, model) : { text: '', tone: 'ink' as Tone },
      selected: sel.cross?.kind === 'campaign' && sel.cross.campaign === camp?.campaign_key,
    };
  });
  rows.sort((x, y) => y.spendValue - x.spendValue || x.key.localeCompare(y.key));
  // a campaign whose P1 measures are all blank in the window is not listed (contract §3.11, 2026-11-05)
  const listed = rows.filter((r) => r.cells.slice(3).some((c) => c !== '') || r.flags.text !== '');

  const target =
    sel.cross?.kind === 'campaign'
      ? (ds.campIndex.get(sel.cross.campaign) ?? null)
      : selectedCampaign(ds, body, w, sel.cmp, model);
  const tc = target === null ? undefined : ds.campaigns[target];
  let p5: { caption: string; rows: string[][] } | null = null;
  if (ds.terms && tc) {
    const T = ds.terms;
    const termRows = ds.m.terms
      .map((t, ti) => ({ t, ti }))
      .filter((x) => x.t.campaign_key === tc.campaign_key)
      .map(({ t, ti }) => {
        const tot = (col: keyof typeof T.t) => sum(T.t[col], ds.ND, [ti], w.a, w.b);
        const cl = tot('clicks');
        const su = tot('signups');
        return {
          su,
          cells: [t.term_text, cl > 0 ? usd(tot('spend_usd') / cl, 2) : DASH, cl > 0 ? pct(su / cl) : DASH, num(su)],
        };
      })
      .sort((x, y) => y.su - x.su)
      .map((x) => x.cells);
    const keywords = ds.m.terms.some((t) => t.campaign_key === tc.campaign_key && t.term_type === 'KEYWORD');
    p5 = {
      caption:
        (tc.channel_code === 'PAID_SEARCH' || keywords ? P5_CAPTION.keywords : P5_CAPTION.placements) +
        tc.campaign_name,
      rows: termRows,
    };
  }
  // P6 / P7: scoped to the cross-filtered campaign's channel, else the body scope
  const p67scope =
    sel.cross?.kind === 'campaign' && tc
      ? windowScope(ds, sel).filter((x) => ds.campaigns[x]?.channel_code === tc.channel_code)
      : body;
  const top5 = (vals: (number | undefined)[]) =>
    ds.m.channels
      .flatMap((c, i) => {
        const v = vals[i];
        return v === undefined ? [] : [{ code: c.channel_code, name: c.channel_name, value: v, label: num(v) }];
      })
      .sort((x, y) => y.value - x.value)
      .slice(0, 5);
  return {
    p1: listed,
    p5,
    p6: top5(churnedByChannel(ds, p67scope, w.b)),
    p7: top5(refundsByChannel(ds, p67scope, w.b)),
  };
}

// ---------- Journey ----------

export function journey(ctx: Ctx) {
  const { ds, w, body } = ctx;
  if (!ds.journey) return null;
  const r = metrics(ds, body, w.a, w.b, { single: singleOf(body), model: ctx.model });
  const j1 = ds.m.pages.map((p) => {
    const k = `page.${p.page_key}`;
    const store = p.page_type !== 'WEB';
    const visits = store ? r[`${k}.store_views`] : r[`${k}.sessions`];
    return {
      visits: visits ?? 0,
      cells: [
        p.page_name,
        num(visits),
        pct(r[`${k}.cvr`]),
        store || visits === undefined ? DASH : pct(r[`${k}.bounce_rate`]),
        store || visits === undefined ? DASH : `${num(r[`${k}.lcp_ms`])} ms`,
      ],
    };
  });
  j1.sort((x, y) => y.visits - x.visits);
  const shares = [
    r.signups > 0 ? 1 : undefined,
    r.step_verified_pct,
    r.step_workspace_pct,
    r.step_connected_pct,
    r.step_first_dashboard_pct,
    r.step_invited_pct,
  ];
  let drop = -1;
  let best = -Infinity;
  for (let i = 1; i < shares.length; i++) {
    const a = shares[i - 1];
    const b = shares[i];
    if (a !== undefined && b !== undefined && a - b > best) {
      best = a - b;
      drop = i;
    }
  }
  const j2 = ds.m.steps.map((st, i) => ({
    label: st.step_name,
    value: shares[i] ?? 0,
    text: pct(shares[i], 0),
    highlight: i === drop,
  }));
  const med = r.act_median_hours;
  const j3 = BIN_COLS.map((c, i) => {
    const v = r[`${c}_share`];
    const lo = [0, 1, 6, 24, 48, 96, 168][i] ?? 0;
    const hi = [1, 6, 24, 48, 96, 168, 720][i] ?? 0;
    return {
      label: ACT_BINS[i] ?? '',
      value: v ?? 0,
      text: pct(v),
      highlight: med !== undefined && med >= lo && med < hi,
    };
  });
  const target = ds.param('ACTIVATION_7D');
  const j4 = ds.m.segments.map((sg) => {
    const v = r[`segment.${sg.segment_code}.activation_rate`];
    return {
      label: sg.segment_name,
      value: v ?? 0,
      text: pct(v),
      tone: (v !== undefined && v < target ? 'warn' : 'ink') as Tone,
    };
  });
  return { j1, j2, j3, j4, target, targetText: pct(target, 0), median: med === undefined ? DASH : `${num(med)} h` };
}

// ---------- Cohorts ----------

/** One-hue ramp of K1 / K3 (`K1 Heat Colour`, `K3 Cell Colour`): white → accent #4A57E8 at t. */
const heat = (t: number) => {
  const c = (to: number) => Math.round(255 - (255 - to) * t);
  return `rgb(${c(74)}, ${c(87)}, ${c(232)})`;
};

export function cohorts(ctx: Ctx) {
  const { ds, w, body, model } = ctx;
  const months = k1Months(ds, w.b);
  const k1 = months
    .map((m) => {
      const k = cohort(ds, body, m);
      return {
        label: monthName(ds.cal.monthKey(m)),
        cells: Array.from({ length: 12 }, (_, off) => {
          const v = k?.payback.find((x) => x.offset === off)?.value;
          return v === undefined
            ? { text: '', fill: null, dark: false }
            : {
                text: pct(v, 0),
                fill: v >= 1 ? '#1E9E6A' : heat(Math.min(Math.max(v, 0), 1) * 0.8 + 0.06),
                dark: v >= 1 || v > 0.6,
              };
        }),
      };
    })
    .filter((r) => r.cells.some((c) => c.text !== ''));
  const k3 = k3Months(ds, w.b)
    .map((m) => {
      const k = cohort(ds, body, m);
      return {
        label: monthName(ds.cal.monthKey(m)),
        cells: RET_DAYS.map((n) => {
          const v = k?.retention[n];
          return v === undefined
            ? { text: '', fill: null, dark: false }
            : { text: pct(v, 0), fill: heat(Math.min(v / 0.6, 1) * 0.85 + 0.08), dark: v / 0.6 > 0.55 };
        }),
      };
    })
    .filter((r) => r.cells.some((c) => c.text !== ''));
  const perChannel = (f: (r: Metrics) => number | undefined, fmt: (v: number) => string) =>
    ds.m.channels
      .map((c) => {
        const cs = body.filter((x) => ds.campaigns[x]?.channel_code === c.channel_code);
        const v = cs.length > 0 ? f(metrics(ds, cs, w.a, w.b, { rich: false, model })) : undefined;
        return {
          code: c.channel_code,
          name: c.channel_name,
          value: v ?? 0,
          label: v === undefined ? '' : fmt(v),
          has: v !== undefined,
        };
      })
      .filter((x) => x.has);
  const k7 = lastTwelve(ds, w.b).flatMap((m) => {
    const n = cohortCustomers(ds, body, m);
    return n === undefined ? [] : [{ label: monthName(ds.cal.monthKey(m)), value: n, text: num(n) }];
  });
  return {
    k1,
    k3,
    k3Days: RET_DAYS.map((n) => `D${n}`),
    k2: perChannel(
      (r) => r.ltv_cac,
      (v) => num(v, 1),
    ),
    k2Line: ds.param('LTV_CAC'),
    k6: perChannel(
      (r) => r.payback_months,
      (v) => num(v, 1),
    ),
    k6Line: ds.param('PAYBACK_MONTHS'),
    k7,
  };
}

// ---------- Dynamics (§5.4) ----------

export function dynamics(ctx: Ctx, n: number) {
  const { ds, w, model, winScope } = ctx;
  const dw = dynamicsWindow(w);
  const spec = VITALS[n - 1];
  if (!spec) throw new Error(`vital ${n}`);
  // `Dyn <metric>` per day; V1 / V2 are bare SUMs, BLANK on a day without rows (DEF-007)
  const day = (d: number) =>
    d < 0 || (n <= 2 && !hasRows(ds, winScope, d, d))
      ? undefined
      : spec.value(vitalMetrics(ds, winScope, win(d, d), model));
  const points = [];
  for (let d = dw.a; d <= dw.b; d++)
    points.push({ day: ds.cal.iso(d), value: day(d) ?? null, ly: day(ds.cal.ly(d)) ?? null });
  const last = points.at(-1)?.value;
  const dynFmt: ((v: number) => string)[] = [
    usd,
    (v) => num(v),
    (v) => pct(v),
    (v) => num(v, 1),
    usd,
    (v) => num(v, 2),
  ];
  const fmt = dynFmt[n - 1] ?? ((v: number) => num(v));
  return {
    title: vitals(ctx)[n - 1]?.dynTitle ?? '',
    points,
    lastLabel: last === null || last === undefined ? DASH : fmt(last),
    fmt,
  };
}

// ---------- Filters window: live preview of the pending selection (JS only, §5.5) ----------

export function preview(ds: Dataset, pending: Selection) {
  const ctx = context(ds, { ...pending, cross: null });
  const r = metrics(ds, ctx.winScope, ctx.w.a, ctx.w.b, { rich: false, model: pending.model });
  const paid = r[paidKey(pending.model)] ?? 0;
  const camps = ctx.winScope.filter((c) => s(ds, 'spend_usd', [c], ctx.w.a, ctx.w.b) > 0);
  const chs = new Set(camps.map((c) => ds.campaigns[c]?.channel_code));
  const pfs = new Set(camps.map((c) => ds.campaigns[c]?.platform_code));
  return {
    spend: usdK(r.spend),
    paid: num(paid),
    cac: usd(r.paid_cac),
    counts: `${camps.length} campaigns | ${chs.size} channels | ${pfs.size} platforms`,
    pill: pillText(ctx),
    chips: chips(ds, { ...pending, cross: null }),
  };
}

/** Distinct option lists of the Filters window. */
export function options(ds: Dataset) {
  return {
    platforms: ds.m.platforms.map((p) => ({ code: p.platform_code, name: p.platform_name })),
    markets: [...new Set(ds.campaigns.map((c) => c.market_code))].map((code) => ({
      code,
      name: MARKET_NAMES[code as keyof typeof MARKET_NAMES] ?? code,
    })),
    tiers: [...new Set(ds.campaigns.map((c) => c.tier_code))].map((code) => ({
      code,
      name: TIER_NAMES[code as keyof typeof TIER_NAMES] ?? code,
    })),
    channels: ds.m.channels.map((c) => ({
      code: c.channel_code,
      name: c.channel_name,
      networks: ds.m.networks
        .filter((n) => ds.campaigns.some((x) => x.channel_code === c.channel_code && x.network_code === n.network_code))
        .map((n) => ({ code: n.network_code, name: n.network_name })),
    })),
    campaigns: ds.campaigns.map((c) => ({ key: c.campaign_key, name: c.campaign_name, status: c.status_code })),
    models: ds.m.models.map((m) => ({ code: m.model_code, name: m.model_name })),
    range: { first: ds.cal.iso(0), last: ds.cal.iso(ds.cal.asOf) },
  };
}

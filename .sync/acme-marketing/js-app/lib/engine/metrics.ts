import { MODEL_KEY, MONTHS, RET_DAYS, coIx, retIx, sum } from './data.ts';
import type { CdCol, Dataset } from './data.ts';
import type { ModelCode } from '../data/manifest.ts';

// Metric catalogue (contract §3.6; data README › Rules): scope (a campaign list) × window (day indices a … b) → value,
// keyed by the control-total metric codes of checks/control_totals_usd.csv. Mirrors the generator's control-total engine
// (generator/metrics.py Engine.metrics) rule for rule; a key that is absent means n/a (blank in the PBIP). Full
// precision throughout: rounding happens in format.ts only (A-49).

/** Always present (flows); every other key is optional (absent = n/a). */
type Flows =
  | 'spend'
  | 'plan'
  | 'impressions'
  | 'clicks'
  | 'sessions'
  | 'store_views'
  | 'installs'
  | 'landed'
  | 'signups'
  | 'activated'
  | 'trials'
  | 'team_cost';
export type Metrics = Record<string, number> & Record<Flows, number>;

export interface MetricOptions {
  /** R-keys: steps, activation bins, segments, pages, frequency / slope (the M-keys skip them) */
  rich?: boolean;
  /** campaign index when the scope is one campaign (R90 falls back to its channel, then ALL) */
  single?: number | null;
  /** attribution model for paid customers and New MRR (A-16); DDA by default */
  model?: ModelCode;
}

export const MODEL_CODES: readonly ModelCode[] = ['DDA', 'LAST_CLICK', 'FIRST_TOUCH', 'PLATFORM'];
export const STEP_KEYS = [
  ['verified', 'step_verified'],
  ['workspace', 'step_workspace'],
  ['connected', 'step_connected'],
  ['first_dashboard', null],
  ['invited', 'step_invited'],
] as const;
export const BIN_COLS = ['act_lt1h', 'act_1_6h', 'act_6_24h', 'act_1_2d', 'act_2_4d', 'act_4_7d', 'act_7_30d'] as const;
export const BIN_EDGES = [0, 1, 6, 24, 48, 96, 168, 720] as const;

export const ALL_CAMPAIGNS = (ds: Dataset): number[] => ds.campaigns.map((_, i) => i);
const fpModel = (m: ModelCode): ModelCode => (m === 'PLATFORM' ? 'DDA' : m);

/** Σ of a campaign-day column. */
export const s = (ds: Dataset, col: CdCol, cs: readonly number[], a: number, b: number): number =>
  sum(ds.cd[col], ds.ND, cs, a, b);

/** Team cost of a window allocated by spend share of the UNFILTERED ALL spend of the same window (A-38, §11 rule 3). */
export function teamCost(ds: Dataset, cs: readonly number[], a: number, b: number): number {
  const sp = s(ds, 'spend_usd', cs, a, b);
  const spAll = s(ds, 'spend_usd', ALL_CAMPAIGNS(ds), a, b);
  let pool = 0;
  for (let d = Math.max(a, 0); d <= Math.min(b, ds.ND - 1); d++) pool += ds.teamDay[d] ?? 0;
  return pool * (spAll > 0 ? sp / spAll : 0);
}

/** R90 (§3.6, §11 rule 2): cohort month = last complete month − 2; scope campaigns with offset-0 revenue > 0 and an
 *  offset-2 row; a single-campaign scope without one falls back to its channel, then ALL. */
export function r90(ds: Dataset, cs: readonly number[], b: number, single: number | null = null): number | undefined {
  const m = ds.cal.lastCompleteMonth(b) - 2;
  if (m < 0) return undefined;
  const rev = ds.co.revenue_usd;
  const calc = (cc: readonly number[]) => {
    const ok = cc.filter((c) => (rev[coIx(c, m, 0)] ?? 0) > 0 && !Number.isNaN(rev[coIx(c, m, 2)] ?? Number.NaN));
    if (ok.length === 0) return undefined;
    let num = 0;
    let den = 0;
    for (const c of ok) {
      for (let k = 0; k <= 2; k++) {
        const v = rev[coIx(c, m, k)] ?? Number.NaN;
        if (!Number.isNaN(v)) num += v;
      }
      den += rev[coIx(c, m, 0)] ?? 0;
    }
    return num / den;
  };
  let v = calc(cs);
  if (v === undefined && single !== null) v = calc(ALL_CAMPAIGNS(ds).filter((c) => ds.chIx[c] === ds.chIx[single]));
  if (v === undefined) v = calc(ALL_CAMPAIGNS(ds));
  return v;
}

const nan0 = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? 0 : v);

/** Monthly logo churn: offsets ≥ 1 whose calendar month (cohort + offset) is in the trailing 3 complete months. */
export function churn(ds: Dataset, cs: readonly number[], b: number): number | undefined {
  const e = ds.cal.lastCompleteMonth(b);
  let num = 0;
  let den = 0;
  for (const c of cs)
    for (let m = 0; m < MONTHS; m++)
      for (let k = 1; k < MONTHS; k++) {
        const cm = m + k;
        if (cm < e - 2 || cm > e) continue;
        den += nan0(ds.co.customers_start[coIx(c, m, k)]);
        num += nan0(ds.co.churned[coIx(c, m, k)]);
      }
  return den > 0 ? num / den : undefined;
}

/** Refund rate: Σ refund_count (all offsets) ÷ Σ customers_start (offset 0), 12 acquisition months to the end month. */
export function refundRate(ds: Dataset, cs: readonly number[], b: number): number | undefined {
  const e = ds.cal.monthOf(b);
  let n = 0;
  let d = 0;
  for (const c of cs)
    for (let m = Math.max(e - 11, 0); m <= e; m++) {
      for (let k = 0; k < MONTHS; k++) n += nan0(ds.co.refund_count[coIx(c, m, k)]);
      d += nan0(ds.co.customers_start[coIx(c, m, 0)]);
    }
  return d > 0 ? n / d : undefined;
}

/** D7 / D30 guardrail month: latest cohort month (scope-independent) with month start + 44 d ≤ b and a D30 cell. */
export function retentionMonth(ds: Dataset, b: number): number | undefined {
  const n30 = RET_DAYS.indexOf(30);
  let best: number | undefined;
  for (let m = 0; m < MONTHS; m++) if (ds.cal.monthStart(m) + 44 <= b && ds.retHas[n30 * MONTHS + m] === 1) best = m;
  return best;
}

/** users_active ÷ users_matured of the scope at day N for cohort month m (undefined where no cell, A-74). */
export function retentionCell(ds: Dataset, cs: readonly number[], m: number, dayN: number): number | undefined {
  const n = RET_DAYS.indexOf(dayN as (typeof RET_DAYS)[number]);
  if (n < 0 || ds.retHas[n * MONTHS + m] !== 1) return undefined;
  let mat = 0;
  let act = 0;
  for (const c of cs) {
    mat += ds.retMatured[retIx(n, ds.NC, c, m)] ?? 0;
    act += ds.retActive[retIx(n, ds.NC, c, m)] ?? 0;
  }
  return mat > 0 ? act / mat : undefined;
}

/** Median of the seven activation bins in hours, linear inside the median bin (A-47). */
export function medianHours(bins: readonly number[]): number | undefined {
  const total = bins.reduce((x, y) => x + y, 0);
  if (!(total > 0)) return undefined;
  let cum = 0;
  for (let i = 0; i < bins.length; i++) {
    const lo = cum;
    cum += (bins[i] ?? 0) / total;
    if (cum >= 0.5) {
      const a = BIN_EDGES[i] ?? 0;
      const z = BIN_EDGES[i + 1] ?? a;
      return a + ((0.5 - lo) / (cum - lo)) * (z - a);
    }
  }
  return undefined;
}

/** Install quality (D-6): INSTALL campaigns' sign-ups ÷ installs of the window's last 7 days − the previous period's. */
export function installQuality(ds: Dataset, cs: readonly number[], a: number, b: number): number | undefined {
  const n = b - a + 1;
  const i7 = s(ds, 'installs', cs, b - 6, b);
  const s7 = s(ds, 'signups', cs, b - 6, b);
  const ip = s(ds, 'installs', cs, a - n, a - 1);
  const sp = s(ds, 'signups', cs, a - n, a - 1);
  return i7 > 0 && ip > 0 ? s7 / i7 - sp / ip : undefined;
}

/** Every metric of §3.6 for scope `cs` over days a … b. */
export function metrics(ds: Dataset, cs: readonly number[], a: number, b: number, opt: MetricOptions = {}): Metrics {
  const { rich = true, single = null, model = 'DDA' } = opt;
  const S = (col: CdCol) => s(ds, col, cs, a, b);
  const r = {} as Metrics; // the flows are set first, unconditionally, below
  const sp = S('spend_usd');
  r.spend = sp;
  const pl = sum(ds.plan, ds.ND, cs, a, b);
  r.plan = pl;
  if (pl > 0) r.pacing = sp / pl;
  const im = S('impressions');
  const ck = S('clicks');
  r.impressions = im;
  r.clicks = ck;
  if (im > 0) {
    r.ctr = ck / im;
    r.cpm = (sp / im) * 1000;
  }
  if (ck > 0) r.cpc = sp / ck;
  const web = cs.filter((c) => ds.campaigns[c]?.platform_code === 'WEB');
  const mob = cs.filter((c) => ds.campaigns[c]?.platform_code !== 'WEB');
  const se = S('sessions');
  r.sessions = se;
  const wck = s(ds, 'clicks', web, a, b);
  if (wck > 0) r.web_land_rate = se / wck;
  const sv = S('store_views');
  const ins = S('installs');
  r.store_views = sv;
  r.installs = ins;
  if (ds.journey) r.first_opens = sum(ds.journey.jd.first_opens, ds.ND, cs, a, b);
  if (sv > 0) r.store_cvr = ins / sv;
  const msu = s(ds, 'signups', mob, a, b);
  const wsu = s(ds, 'signups', web, a, b);
  if (ins > 0) r.install_signup_rate = msu / ins;
  if (se > 0) r.landing_signup_rate = wsu / se;
  r.landed = se + ins;
  const su = S('signups');
  r.signups = su;
  if (ck > 0) r.click_signup_rate = su / ck;
  if (su > 0) r.cpl = sp / su;
  const ac = S('activated');
  r.activated = ac;
  if (su > 0) r.activation_rate = ac / su;
  if (ac > 0) r.cost_per_activated = sp / ac;
  const tr = S('trials');
  r.trials = tr;
  if (su > 0) r.trial_rate = tr / su;
  for (const code of MODEL_CODES) {
    const k = MODEL_KEY[code];
    const p = S(`paid_${k}`);
    r[`paid_customers.${k}`] = p;
    r[`new_mrr.${k}`] = S(`mrr_${k}`);
    if (p > 0) r[`cpa.${k}`] = sp / p;
  }
  const mk = MODEL_KEY[model];
  const p = r[`paid_customers.${mk}`] ?? 0;
  const mr = r[`new_mrr.${mk}`] ?? 0;
  if (tr > 0) r.trial_to_paid = p / tr;
  const team = teamCost(ds, cs, a, b);
  r.team_cost = team;
  let blended: number | undefined;
  let arpa: number | undefined;
  if (p > 0) {
    r.paid_cac = sp / p;
    blended = (sp + team) / p;
    arpa = mr / p;
    r.blended_cac = blended;
    r.arpa = arpa;
    if (mr > 0) r.payback_months = blended / (arpa * ds.gm);
  }
  const ch = churn(ds, cs, b);
  if (ch !== undefined) {
    r.churn_monthly = ch;
    if (p > 0 && mr > 0 && ch > 0 && arpa !== undefined && blended !== undefined) {
      r.ltv = (arpa * ds.gm) / ch;
      r.ltv_cac = r.ltv / blended;
    }
  }
  const r9 = r90(ds, cs, b, single);
  if (r9 !== undefined && sp > 0) {
    r.r90 = r9;
    r.roas_90d = (mr * r9) / sp;
  }
  const pfp = r[`paid_customers.${MODEL_KEY[fpModel(model)]}`] ?? 0;
  const pplat = r['paid_customers.platform'] ?? 0;
  if (pfp > 0 && pplat > 0) r.attribution_gap = pplat / pfp - 1;
  const srch = cs.filter((c) => ds.campaigns[c]?.channel_code === 'PAID_SEARCH');
  if (srch.length > 0) {
    const ss = s(ds, 'spend_usd', srch, a, b);
    const brand = srch.filter((c) => ds.campaigns[c]?.is_brand);
    if (ss > 0) r.brand_share = brand.length > 0 ? s(ds, 'spend_usd', brand, a, b) / ss : 0;
  }
  const rr = refundRate(ds, cs, b);
  if (rr !== undefined) r.refund_rate = rr;
  const rm = retentionMonth(ds, b);
  if (rm !== undefined) {
    const [y, mo] = ds.cal.monthKey(rm).split('-');
    r.retention_cohort_month = Number(y) * 100 + Number(mo);
    for (const n of [7, 30]) {
      const v = retentionCell(ds, cs, rm, n);
      if (v !== undefined) r[`d${n}_retention`] = v;
    }
  }
  if (!rich) return r;

  if (su > 0)
    for (const [name, col] of STEP_KEYS) {
      if (col === null) r[`step_${name}_pct`] = ac / su;
      else if (ds.journey) r[`step_${name}_pct`] = sum(ds.journey.jd[col], ds.ND, cs, a, b) / su;
    }
  const bins = BIN_COLS.map((c) => S(c));
  const bt = bins.reduce((x, y) => x + y, 0);
  if (bt > 0) {
    BIN_COLS.forEach((c, i) => (r[`${c}_share`] = (bins[i] ?? 0) / bt));
    const med = medianHours(bins);
    if (med !== undefined) r.act_median_hours = med;
  }
  const j = ds.journey;
  if (j) {
    const segBlock = ds.NC * ds.ND;
    ds.m.segments.forEach((seg, si) => {
      const ssu = sum(j.segSignups.subarray(si * segBlock, (si + 1) * segBlock), ds.ND, cs, a, b);
      const sac = sum(j.segActivated.subarray(si * segBlock, (si + 1) * segBlock), ds.ND, cs, a, b);
      if (ssu > 0) {
        r[`segment.${seg.segment_code}.signups`] = ssu;
        r[`segment.${seg.segment_code}.activation_rate`] = sac / ssu;
      }
    });
    ds.m.pages.forEach((pg, pi) => {
      const P = (col: keyof typeof j.page) =>
        sum(j.page[col].subarray(pi * segBlock, (pi + 1) * segBlock), ds.ND, cs, a, b);
      const ses = P('sessions');
      const svp = P('store_views');
      const k = `page.${pg.page_key}`;
      if (ses > 0) {
        r[`${k}.sessions`] = ses;
        r[`${k}.cvr`] = P('signups') / ses;
        r[`${k}.bounce_rate`] = P('bounces') / ses;
        r[`${k}.lcp_ms`] = P('lcp_x_sessions') / ses;
      }
      if (svp > 0) {
        r[`${k}.store_views`] = svp;
        r[`${k}.cvr`] = P('installs') / svp;
      }
    });
  }
  if (b - a >= 13) {
    const i7 = s(ds, 'impressions', cs, b - 6, b);
    const c7 = s(ds, 'clicks', cs, b - 6, b);
    const ip = s(ds, 'impressions', cs, b - 13, b - 7);
    const cp = s(ds, 'clicks', cs, b - 13, b - 7);
    const rch = s(ds, 'reach_7d', cs, b, b);
    if (rch > 0) r.frequency_7d = i7 / rch;
    if (i7 > 0 && ip > 0 && cp > 0) r.ctr_slope_7d = c7 / i7 / (cp / ip) - 1;
  }
  return r;
}

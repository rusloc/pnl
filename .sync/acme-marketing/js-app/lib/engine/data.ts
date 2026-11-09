import type { CampaignsFiles, CoreFiles, JourneyFiles } from '../data/loader.ts';
import { FILES } from '../data/manifest.ts';
import type { CampaignRow, Manifest, ModelCode } from '../data/manifest.ts';
import { createCalendar } from './calendar.ts';
import type { Calendar } from './calendar.ts';

// The Dataset (contract §3, DEC-001): typed arrays built once from the loader's rows; the file format hides behind it.
// Every flow is a dense Float64Array indexed [campaign × day] (19 × 672 cells), so a window × scope sum is a plain loop
// over the masked campaigns and the window's days (no prefix sums: they would trade exactness for speed nobody needs).
// Cohort facts are [campaign × cohort month × offset] with NaN where no row exists (a row's absence is information:
// R90, payback offsets). Framework-free.

export const MONTHS = 24; // dim_month 2025-01 … 2026-12
export const RET_DAYS = [1, 3, 7, 14, 30, 60, 90] as const;

type Cols<K extends keyof typeof FILES> = Exclude<keyof (typeof FILES)[K]['columns'], 'day_ix' | 'camp_ix'>;
export type CdCol = Cols<'campaignDay'>;
export type JdCol = Exclude<Cols<'journeyDay'>, never>;
export type PageCol = Exclude<Cols<'trafficPageDay'>, 'page_ix'>;
export type TermCol = Exclude<keyof (typeof FILES)['termDay']['columns'], 'day_ix' | 'term_ix'>;
export type CohortCol = 'customers_start' | 'churned' | 'revenue_usd' | 'refunds_usd' | 'refund_count';

export const MODEL_KEY = {
  DDA: 'dda',
  LAST_CLICK: 'last_click',
  FIRST_TOUCH: 'first_touch',
  PLATFORM: 'platform',
} as const;
export type ModelKey = (typeof MODEL_KEY)[ModelCode];

export interface Journey {
  jd: Record<JdCol, Float64Array>;
  /** [page × campaign × day] */
  page: Record<PageCol, Float64Array>;
  /** [segment × campaign × day] */
  segSignups: Float64Array;
  segActivated: Float64Array;
}
export interface Terms {
  /** [term × day] */
  t: Record<TermCol, Float64Array>;
  termCamp: Int32Array;
}

export interface Dataset {
  readonly m: Manifest;
  readonly cal: Calendar;
  readonly NC: number;
  readonly ND: number;
  readonly campaigns: readonly CampaignRow[];
  readonly campIndex: ReadonlyMap<string, number>;
  /** channel / platform / network index per campaign (into m.channels / m.platforms / m.networks) */
  readonly chIx: Int32Array;
  readonly pfIx: Int32Array;
  readonly nwIx: Int32Array;
  readonly cd: Record<CdCol, Float64Array>;
  /** 1 where campaign-day.parquet has a row ([campaign × day]): a sum over no rows is BLANK, not 0 (DEF-007) */
  readonly cdRow: Uint8Array;
  /** daily plan = budget_usd ÷ days_in_month, [campaign × day] */
  readonly plan: Float64Array;
  /** daily paid-team cost pool = PAID_TEAM_COST_MONTH_USD (valid that day) ÷ days_in_month */
  readonly teamDay: Float64Array;
  readonly gm: number;
  /** [campaign × month × offset], NaN = no row */
  readonly co: Record<CohortCol, Float64Array>;
  /** [day-N slot × campaign × month] */
  readonly retMatured: Float64Array;
  readonly retActive: Float64Array;
  /** [day-N slot × month]: any retention row for that month (scope-independent) */
  readonly retHas: Uint8Array;
  /** ALL-scope parameter of param_target (A-75); throws when missing */
  param(metric: string): number;
  /** CHANNEL-scope target (CPA, CTR bands) */
  channelTarget(channel: string, metric: string): number | undefined;
  journey: Journey | null;
  terms: Terms | null;
}

export const coIx = (c: number, m: number, k: number) => (c * MONTHS + m) * MONTHS + k;
export const retIx = (n: number, nc: number, c: number, m: number) => (n * nc + c) * MONTHS + m;

function dense<K extends string>(keys: readonly K[], size: number): Record<K, Float64Array> {
  return Object.fromEntries(keys.map((k) => [k, new Float64Array(size)])) as Record<K, Float64Array>;
}
const colsOf = <K extends keyof typeof FILES>(k: K, skip: readonly string[]) =>
  Object.keys(FILES[k].columns).filter((c) => !skip.includes(c));

export function createDataset(files: CoreFiles): Dataset {
  const { manifest: m } = files;
  const cal = createCalendar(m.meta.first_day, m.meta.as_of);
  if (cal.days !== m.meta.days) throw new Error(`manifest days ${m.meta.days} ≠ calendar ${cal.days}`);
  const NC = m.campaigns.length;
  const ND = cal.days;
  const index = <T>(rows: readonly T[], key: (r: T) => string) => new Map(rows.map((r, i) => [key(r), i]));
  const ch = index(m.channels, (r) => r.channel_code);
  const pf = index(m.platforms, (r) => r.platform_code);
  const nw = index(m.networks, (r) => r.network_code);
  const look = (map: Map<string, number>, k: string) => {
    const i = map.get(k);
    if (i === undefined) throw new Error(`unknown code ${k}`);
    return i;
  };
  const chIx = Int32Array.from(m.campaigns, (c) => look(ch, c.channel_code));
  const pfIx = Int32Array.from(m.campaigns, (c) => look(pf, c.platform_code));
  const nwIx = Int32Array.from(m.campaigns, (c) => look(nw, c.network_code));

  const cdKeys = colsOf('campaignDay', ['day_ix', 'camp_ix']) as CdCol[];
  const cd = dense(cdKeys, NC * ND);
  const cdRow = new Uint8Array(NC * ND);
  for (const r of files.campaignDay) {
    const i = r.camp_ix * ND + r.day_ix;
    cdRow[i] = 1;
    for (const k of cdKeys) (cd[k] as Float64Array)[i] = r[k];
  }

  const budget = new Float64Array(NC * MONTHS);
  for (const [mi, c, v] of m.budget) budget[c * MONTHS + mi] = (budget[c * MONTHS + mi] ?? 0) + v;
  const plan = new Float64Array(NC * ND);
  for (let c = 0; c < NC; c++)
    for (let d = 0; d < ND; d++) {
      const mi = cal.monthIx[d] ?? 0;
      plan[c * ND + d] = (budget[c * MONTHS + mi] ?? 0) / cal.daysInMonth(mi);
    }

  const team = m.finance
    .filter((f) => f.metric_code === 'PAID_TEAM_COST_MONTH_USD')
    .map((f) => ({ from: cal.ix(f.valid_from), value: f.value }))
    .sort((a, b) => a.from - b.from);
  const teamDay = new Float64Array(ND);
  for (let d = 0; d < ND; d++) {
    const row = team.filter((t) => t.from <= d).at(-1);
    teamDay[d] = (row?.value ?? 0) / cal.daysInMonth(cal.monthIx[d] ?? 0);
  }
  const gmRow = m.finance
    .filter((f) => f.metric_code === 'GROSS_MARGIN_PCT' && cal.ix(f.valid_from) <= cal.asOf)
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
    .at(-1);
  if (!gmRow) throw new Error('GROSS_MARGIN_PCT missing');

  const coKeys: CohortCol[] = ['customers_start', 'churned', 'revenue_usd', 'refunds_usd', 'refund_count'];
  const co = Object.fromEntries(
    coKeys.map((k) => [k, new Float64Array(NC * MONTHS * MONTHS).fill(Number.NaN)]),
  ) as Record<CohortCol, Float64Array>;
  for (const r of files.cohortMonth) {
    const i = coIx(r.camp_ix, r.cohort_month_ix, r.month_offset);
    for (const k of coKeys) co[k][i] = r[k];
  }

  const retMatured = new Float64Array(RET_DAYS.length * NC * MONTHS);
  const retActive = new Float64Array(RET_DAYS.length * NC * MONTHS);
  const retHas = new Uint8Array(RET_DAYS.length * MONTHS);
  for (const r of files.retention) {
    const n = RET_DAYS.indexOf(r.day_n as (typeof RET_DAYS)[number]);
    if (n < 0) throw new Error(`retention day_n ${r.day_n}`);
    const i = retIx(n, NC, r.camp_ix, r.cohort_month_ix);
    retMatured[i] = (retMatured[i] ?? 0) + r.users_matured;
    retActive[i] = (retActive[i] ?? 0) + r.users_active;
    retHas[n * MONTHS + r.cohort_month_ix] = 1;
  }

  const params = new Map(m.targets.map((t) => [`${t.scope_code}|${t.metric_code}`, t.target_value]));
  return {
    m,
    cal,
    NC,
    ND,
    campaigns: m.campaigns,
    campIndex: index(m.campaigns, (c) => c.campaign_key),
    chIx,
    pfIx,
    nwIx,
    cd,
    cdRow,
    plan,
    teamDay,
    gm: gmRow.value,
    co,
    retMatured,
    retActive,
    retHas,
    param: (metric) => {
      const v = params.get(`ALL|${metric}`);
      if (v === undefined) throw new Error(`param_target ALL ${metric} missing`);
      return v;
    },
    channelTarget: (channel, metric) => params.get(`${channel}|${metric}`),
    journey: null,
    terms: null,
  };
}

/** Adds the Journey files (first open of Journey); returns the same Dataset object. */
export function addJourney(ds: Dataset, f: JourneyFiles): Dataset {
  const { NC, ND } = ds;
  const jdKeys = colsOf('journeyDay', ['day_ix', 'camp_ix']) as JdCol[];
  const jd = dense(jdKeys, NC * ND);
  for (const r of f.journeyDay) for (const k of jdKeys) (jd[k] as Float64Array)[r.camp_ix * ND + r.day_ix] = r[k];
  const pageKeys = colsOf('trafficPageDay', ['day_ix', 'camp_ix', 'page_ix']) as PageCol[];
  const page = dense(pageKeys, ds.m.pages.length * NC * ND);
  for (const r of f.trafficPageDay) {
    const i = (r.page_ix * NC + r.camp_ix) * ND + r.day_ix;
    for (const k of pageKeys) (page[k] as Float64Array)[i] = r[k];
  }
  const segSignups = new Float64Array(ds.m.segments.length * NC * ND);
  const segActivated = new Float64Array(ds.m.segments.length * NC * ND);
  for (const r of f.segmentDay) {
    const i = (r.seg_ix * NC + r.camp_ix) * ND + r.day_ix;
    segSignups[i] = r.signups;
    segActivated[i] = r.activated_7d;
  }
  ds.journey = { jd, page, segSignups, segActivated };
  return ds;
}

/** Adds term-day (first open of Campaigns); returns the same Dataset object. */
export function addTerms(ds: Dataset, f: CampaignsFiles): Dataset {
  const { ND } = ds;
  const NT = ds.m.terms.length;
  const keys = Object.keys(FILES.termDay.columns).filter((c) => c !== 'day_ix' && c !== 'term_ix') as TermCol[];
  const t = dense(keys, NT * ND);
  for (const r of f.termDay) for (const k of keys) (t[k] as Float64Array)[r.term_ix * ND + r.day_ix] = r[k];
  const termCamp = Int32Array.from(ds.m.terms, (x) => ds.campIndex.get(x.campaign_key) ?? -1);
  ds.terms = { t, termCamp };
  return ds;
}

/** True when the scope has at least one campaign-day row in days a … b (the DAX "not BLANK" of a bare SUM). */
export function hasRows(ds: Dataset, cs: readonly number[], a: number, b: number): boolean {
  const lo = Math.max(a, 0);
  const hi = Math.min(b, ds.ND - 1);
  for (const c of cs) for (let d = lo; d <= hi; d++) if (ds.cdRow[c * ds.ND + d] === 1) return true;
  return false;
}

/** Σ of a [campaign × day] array over campaigns `cs` and days a … b (clipped to the actual days). */
export function sum(arr: Float64Array, ND: number, cs: readonly number[], a: number, b: number): number {
  const lo = Math.max(a, 0);
  const hi = Math.min(b, ND - 1);
  let s = 0;
  for (const c of cs) {
    const base = c * ND;
    for (let d = lo; d <= hi; d++) s += arr[base + d] ?? 0;
  }
  return s;
}

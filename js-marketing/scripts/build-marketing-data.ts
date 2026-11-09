// ACME Marketing data build (contract docs/ADD/features/marketing-js-flavour.md §2; ADR-0002 §2.2 pattern, as
// js-exec/scripts/build-exec-data.ts): ../data/acme_marketing_dummy_data/parquet/*.parquet → public/data/ (manifest.json
// + seven Parquet files). Every sum over days is pre-aggregated to day × campaign; INT64 / DATE / TIMESTAMP values are
// converted here, so the browser loader only ever sees INT32 / DOUBLE columns and ISO strings (CAND-022). The checks of
// §2.4 run here: footers, calendar derivation, ties (AT-05), attribution coverage, the 32 CR: creative control rows and
// the byte budgets. Runs on Node's native type stripping. Every check throws, which fails `npm run build` (prebuild).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetMetadata, parquetReadObjects } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type { ColumnSource } from 'hyparquet-writer';
import { z } from 'zod';
import { FILES, FIRST_PAINT_FILES, manifestSchema, sourceManifestSchema } from '../lib/data/manifest.ts';
import type { FileKey, Manifest, SourceManifest, SourceTable } from '../lib/data/manifest.ts';
import { createCalendar } from '../lib/engine/calendar.ts';
import { readControlTotals, withinTolerance } from './control-totals.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, '..', 'data', 'acme_marketing_dummy_data');
const SRC = join(DATA, 'parquet');
const OUT = join(ROOT, 'public', 'data');

const FIRST_PAINT_BUDGET = 750_000; // §2.3: first paint ≤ 750 kB (hard fail 1 MB)
const FIRST_PAINT_MAX = 1_000_000;
const TOTAL_BUDGET = 2_500_000; // total ≤ 2.5 MB (hard fail 3 MB)
const TOTAL_MAX = 3_000_000;
const CAMPAIGN_DAY_FALLBACK = 600_000; // §2.3: over this, the agreed attribution-alt.parquet split applies

function fail(message: string): never {
  throw new Error(`build-marketing-data: ${message}`);
}

// ---------- 1 · source manifest + footers ----------

const source: SourceManifest = sourceManifestSchema.parse(JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')));
const bytesOf = (t: SourceTable): ArrayBuffer => {
  const b = readFileSync(join(SRC, `${t}.parquet`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
for (const t of source.tables) {
  const b = bytesOf(t.table);
  if (b.byteLength !== t.parquet_bytes) fail(`${t.table}: ${b.byteLength} bytes, manifest says ${t.parquet_bytes}`);
  const meta = parquetMetadata(b);
  if (Number(meta.num_rows) !== t.rows) fail(`${t.table}: ${meta.num_rows} rows, manifest says ${t.rows}`);
  const columns = meta.schema.slice(1).map((s) => s.name);
  if (columns.join() !== Object.keys(t.columns).join()) fail(`${t.table}: columns ${columns.join(', ')} ≠ manifest`);
}

type Row = Record<string, string | number | boolean | null>;

/** Reads a source table into plain rows: date32 → 'YYYY-MM-DD', timestamp[ms] → 'YYYY-MM-DDTHH:MM', int64 → number
 *  (checked safe), NaN → null. */
async function read(table: SourceTable): Promise<Row[]> {
  const types = source.tables.find((t) => t.table === table)?.columns ?? fail(`${table}: not in the manifest`);
  const raw = await parquetReadObjects({ file: bytesOf(table) });
  return raw.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      const type = types[k];
      if (v === null || v === undefined) out[k] = null;
      else if (v instanceof Date) {
        const iso = v.toISOString();
        out[k] = type === 'timestamp[ms]' ? iso.slice(0, 16) : iso.slice(0, 10);
      } else if (typeof v === 'bigint') {
        const n = Number(v);
        if (!Number.isSafeInteger(n)) fail(`${table}.${k}: int64 ${v} outside the safe range`);
        out[k] = n;
      } else if (typeof v === 'number') out[k] = Number.isNaN(v) ? null : v;
      else if (typeof v === 'string' || typeof v === 'boolean') out[k] = v;
      else fail(`${table}.${k}: unexpected value ${String(v)}`);
    }
    return out;
  });
}

const str = (r: Row, k: string): string => {
  const v = r[k];
  return typeof v === 'string' ? v : fail(`${k}: "${String(v)}" is not text`);
};
const num = (r: Row, k: string): number => {
  const v = r[k];
  return typeof v === 'number' ? v : fail(`${k}: "${String(v)}" is not a number`);
};
const num0 = (r: Row, k: string): number => (r[k] === null ? 0 : num(r, k));

const T = Object.fromEntries(
  await Promise.all(SOURCE_TABLES_USED().map(async (t) => [t, await read(t)] as const)),
) as Record<SourceTable, Row[]>;

function SOURCE_TABLES_USED(): SourceTable[] {
  return source.tables.map((t) => t.table).filter((t) => !['fact_pipeline_month', 'dim_ad_set'].includes(t));
}

// ---------- 2 · calendar derivation = dim_date / dim_month ----------

const FIRST_DAY = str(T.dim_date[0] ?? fail('dim_date empty'), 'date');
const cal = createCalendar(FIRST_DAY, source.as_of_date);
T.dim_date.forEach((r, i) => {
  const want = {
    date: cal.iso(i),
    month_key: cal.monthKey(cal.monthOf(i)),
    week_start: cal.iso(cal.weekStart(i)),
    ly_date: cal.iso(cal.ly(i)),
    is_actual: i <= cal.asOf,
  };
  for (const [k, v] of Object.entries(want)) if (r[k] !== v) fail(`dim_date row ${i} ${k}: ${String(r[k])} ≠ ${v}`);
});
T.dim_month.forEach((r, m) => {
  const start = cal.monthStart(m);
  const want = {
    month_key: cal.monthKey(m),
    month_start: cal.iso(start),
    month_index: m,
    days_in_month: cal.daysInMonth(m),
    is_actual: start <= cal.asOf,
    is_complete: start + cal.daysInMonth(m) - 1 <= cal.asOf,
  };
  for (const [k, v] of Object.entries(want)) if (r[k] !== v) fail(`dim_month row ${m} ${k}: ${String(r[k])} ≠ ${v}`);
});
const ND = cal.days;
const dayIx = (r: Row): number => {
  const i = cal.ix(str(r, 'date'));
  return i >= 0 && i < ND ? i : fail(`date ${String(r.date)} outside the actual days`);
};
const monthIxOf = (key: string): number => {
  const m = (Number(key.slice(0, 4)) - cal.firstYear) * 12 + Number(key.slice(5, 7)) - 1;
  return m >= 0 && m < 24 ? m : fail(`month ${key} outside 0 … 23`);
};

// ---------- 3 · dimensions (indices = sort_order order) ----------

const bySort = (rows: Row[]) => [...rows].sort((a, b) => num(a, 'sort_order') - num(b, 'sort_order'));
const campaigns = bySort(T.dim_campaign);
if (campaigns.map((c) => c.campaign_key).join() !== T.dim_campaign.map((c) => c.campaign_key).join())
  fail('dim_campaign is not stored in sort_order order');
const CAMP = new Map(campaigns.map((c, i) => [str(c, 'campaign_key'), i]));
const NC = campaigns.length;
const campIx = (r: Row): number =>
  CAMP.get(str(r, 'campaign_key')) ?? fail(`unknown campaign ${String(r.campaign_key)}`);
const terms = [...T.dim_term].sort(
  (a, b) => (campIx(a) - campIx(b)) * 1000 + (num(a, 'sort_order') - num(b, 'sort_order')),
);
const TERM = new Map(terms.map((t, i) => [str(t, 'term_key'), i]));
const pages = bySort(T.dim_landing_page);
const PAGE = new Map(pages.map((p, i) => [str(p, 'page_key'), i]));
const segments = bySort(T.dim_platform_segment);
const SEG = new Map(segments.map((s, i) => [str(s, 'segment_code'), i]));

// ---------- 4 · day × campaign collapse ----------

const key = (d: number, c: number) => d * NC + c;
type Acc = Record<string, number>;
const cd = new Map<number, Acc>();
const jd = new Map<number, Acc>();
const acc = (m: Map<number, Acc>, k: number): Acc => {
  let a = m.get(k);
  if (!a) m.set(k, (a = {}));
  return a;
};
const add = (a: Acc, k: string, v: number) => {
  a[k] = (a[k] ?? 0) + v;
};

const deliveryDays = new Set<number>();
for (const r of T.fact_ad_delivery_day) {
  const k = key(dayIx(r), campIx(r));
  deliveryDays.add(k);
  const a = acc(cd, k);
  add(a, 'impressions', num(r, 'impressions'));
  add(a, 'clicks', num(r, 'clicks'));
  add(a, 'spend_usd', num(r, 'spend_usd'));
  add(a, 'reach_7d', num(r, 'reach_7d'));
}
const funnelDays = new Set<number>();
const BINS = ['act_lt1h', 'act_1_6h', 'act_6_24h', 'act_1_2d', 'act_2_4d', 'act_4_7d', 'act_7_30d'];
for (const r of T.fact_funnel_day) {
  const k = key(dayIx(r), campIx(r));
  funnelDays.add(k);
  const a = acc(cd, k);
  add(a, 'signups', num(r, 'signups'));
  add(a, 'activated', num(r, 'step_first_dashboard'));
  add(a, 'trials', num(r, 'trials'));
  for (const b of BINS) add(a, b, num(r, b));
  const j = acc(jd, k);
  for (const s of ['step_verified', 'step_workspace', 'step_connected', 'step_invited']) add(j, s, num(r, s));
  // AT-05: Σ of the first six bins = step_first_dashboard; steps monotone
  const six = BINS.slice(0, 6).reduce((s, b) => s + num(r, b), 0);
  if (six !== num(r, 'step_first_dashboard'))
    fail(`AT-05 bins ≠ first dashboard at ${String(r.date)} ${String(r.campaign_key)}`);
}
const MODEL_COL = { DDA: 'dda', LAST_CLICK: 'last_click', FIRST_TOUCH: 'first_touch', PLATFORM: 'platform' } as const;
for (const r of T.fact_attribution_day) {
  const k = key(dayIx(r), campIx(r));
  if (!deliveryDays.has(k) && !funnelDays.has(k))
    fail(`attribution ${String(r.date)} ${String(r.campaign_key)}: no delivery / funnel row (credit would vanish)`);
  const m = MODEL_COL[str(r, 'model_code') as keyof typeof MODEL_COL] ?? fail(`model ${String(r.model_code)}`);
  const a = acc(cd, k);
  add(a, `paid_${m}`, num(r, 'paid_customers'));
  add(a, `mrr_${m}`, num(r, 'new_mrr_usd'));
}
const tp = new Map<number, Acc>();
const trafficSignups = new Map<number, number>();
for (const r of T.fact_traffic_day) {
  const d = dayIx(r);
  const c = campIx(r);
  const k = key(d, c);
  const a = acc(cd, k);
  add(a, 'sessions', num0(r, 'sessions'));
  add(a, 'store_views', num0(r, 'store_views'));
  add(a, 'installs', num0(r, 'installs'));
  add(acc(jd, k), 'first_opens', num0(r, 'first_opens'));
  trafficSignups.set(k, (trafficSignups.get(k) ?? 0) + num0(r, 'signups'));
  const p = PAGE.get(str(r, 'page_key')) ?? fail(`page ${String(r.page_key)}`);
  const t = acc(tp, k * 8 + p);
  add(t, 'sessions', num0(r, 'sessions'));
  add(t, 'bounces', num0(r, 'bounces'));
  add(t, 'lcp_x_sessions', num0(r, 'lcp_ms_p75') * num0(r, 'sessions'));
  add(t, 'store_views', num0(r, 'store_views'));
  add(t, 'installs', num0(r, 'installs'));
  add(t, 'signups', num0(r, 'signups'));
}
const segSignups = new Map<number, number>();
const segActivated = new Map<number, number>();
const segRows = T.fact_signup_segment_day.map((r) => {
  const d = dayIx(r);
  const c = campIx(r);
  const k = key(d, c);
  segSignups.set(k, (segSignups.get(k) ?? 0) + num(r, 'signups'));
  segActivated.set(k, (segActivated.get(k) ?? 0) + num(r, 'activated_7d'));
  return {
    day_ix: d,
    camp_ix: c,
    seg_ix: SEG.get(str(r, 'segment_code')) ?? fail(`segment ${String(r.segment_code)}`),
    signups: num(r, 'signups'),
    activated_7d: num(r, 'activated_7d'),
  };
});
const termClicks = new Map<number, number>();
const termRows = T.fact_term_day.map((r) => {
  const d = dayIx(r);
  const k = key(d, campIx(r));
  termClicks.set(k, (termClicks.get(k) ?? 0) + num(r, 'clicks'));
  return {
    day_ix: d,
    term_ix: TERM.get(str(r, 'term_key')) ?? fail(`term ${String(r.term_key)}`),
    impressions: num(r, 'impressions'),
    clicks: num(r, 'clicks'),
    spend_usd: num(r, 'spend_usd'),
    signups: num(r, 'signups'),
  };
});

// ---------- 5 · ties (AT-05) ----------

if (deliveryDays.size !== funnelDays.size || [...deliveryDays].some((k) => !funnelDays.has(k)))
  fail('delivery and funnel campaign-days differ');
if (cd.size !== funnelDays.size) fail(`campaign-day rows ${cd.size} ≠ funnel campaign-days ${funnelDays.size}`);
for (const [k, a] of cd) {
  const where = `${cal.iso(Math.floor(k / NC))} ${String(campaigns[k % NC]?.campaign_key)}`;
  const su = a.signups ?? 0;
  if ((trafficSignups.get(k) ?? 0) !== su) fail(`AT-05 traffic sign-ups ≠ funnel at ${where}`);
  if ((segSignups.get(k) ?? 0) !== su) fail(`AT-05 segment sign-ups ≠ funnel at ${where}`);
  if ((segActivated.get(k) ?? 0) !== (a.activated ?? 0)) fail(`AT-05 activated_7d ≠ first dashboard at ${where}`);
  if ((termClicks.get(k) ?? 0) > (a.clicks ?? 0)) fail(`AT-05 term clicks > campaign clicks at ${where}`);
  const web = campaigns[k % NC]?.platform_code === 'WEB';
  const j = jd.get(k) ?? {};
  const ok =
    (a.impressions ?? 0) >= (a.clicks ?? 0) &&
    (web
      ? (a.sessions ?? 0) <= (a.clicks ?? 0)
      : (a.store_views ?? 0) <= (a.clicks ?? 0) &&
        (a.installs ?? 0) <= (a.store_views ?? 0) &&
        (j.first_opens ?? 0) <= (a.installs ?? 0) &&
        su <= (a.sessions ?? 0) + (a.installs ?? 0));
  if (!ok) fail(`AT-05 stages not monotone at ${where}`);
}
const mrrMonth = new Float64Array(NC * 24);
const paidMonth = new Float64Array(NC * 24);
for (const [k, a] of cd) {
  const i = (k % NC) * 24 + cal.monthOf(Math.floor(k / NC));
  mrrMonth[i] = (mrrMonth[i] ?? 0) + (a.mrr_dda ?? 0);
  paidMonth[i] = (paidMonth[i] ?? 0) + (a.paid_dda ?? 0);
}
for (const r of T.fact_cohort_revenue_month) {
  if (num(r, 'month_offset') !== 0) continue;
  const i = campIx(r) * 24 + monthIxOf(str(r, 'cohort_month'));
  if (Math.abs(num(r, 'revenue_usd') - (mrrMonth[i] ?? 0)) > 0.01)
    fail(`AT-05 offset-0 revenue ≠ Σ DDA MRR at ${String(r.cohort_month)} ${String(r.campaign_key)}`);
  if (Math.abs(num(r, 'customers_start') - (paidMonth[i] ?? 0)) > 1e-3)
    fail(`AT-05 customers_start ≠ Σ DDA credits at ${String(r.cohort_month)} ${String(r.campaign_key)}`);
}

// ---------- 6 · CR: creative control rows (§2.4 item 5; build-time only, no creative data ships) ----------

const P = new Map(
  T.param_target.map((r) => [`${str(r, 'scope_code')}|${str(r, 'metric_code')}`, num(r, 'target_value')]),
);
const param = (m: string): number => P.get(`ALL|${m}`) ?? fail(`param_target ALL ${m} missing`);
const controls = readControlTotals(readFileSync(join(DATA, 'checks', 'control_totals_usd.csv'), 'utf8'));
const crRows = controls.filter((r) => r.scope.startsWith('CR:'));
if (crRows.length !== 32) fail(`expected 32 CR: control rows, found ${crRows.length}`);
{
  const b = cal.asOf;
  const byCreative = new Map<string, Row[]>();
  for (const r of T.fact_ad_delivery_day)
    if (r.campaign_key === 'SOC_META_LAL2') {
      const list = byCreative.get(str(r, 'creative_key')) ?? [];
      list.push(r);
      byCreative.set(str(r, 'creative_key'), list);
    }
  const got = new Map<string, number>();
  for (const [ck, rows] of byCreative) {
    if (!rows.some((r) => dayIx(r) === b)) continue;
    const sum = (k: string, lo: number, hi: number) =>
      rows.filter((r) => dayIx(r) >= lo && dayIx(r) <= hi).reduce((s, r) => s + num(r, k), 0);
    const ctr7 = sum('clicks', b - 6, b) / sum('impressions', b - 6, b);
    const slope = ctr7 / (sum('clicks', b - 13, b - 7) / sum('impressions', b - 13, b - 7)) - 1;
    const freq = sum('impressions', b - 6, b) / sum('reach_7d', b, b);
    const status =
      slope < param('FATIGUE_SLOPE') && freq > param('FATIGUE_FREQ')
        ? 3
        : slope < 0 && freq > param('WATCH_FREQ')
          ? 2
          : 1;
    const k = `CR:${ck}|R30-${source.as_of_date}|`;
    got.set(`${k}ctr_7d`, ctr7);
    got.set(`${k}ctr_slope_7d`, slope);
    got.set(`${k}frequency_7d`, freq);
    got.set(`${k}creative_status`, status);
  }
  if (got.size !== crRows.length) fail(`CR: rows ${got.size} computed, ${crRows.length} in the CSV`);
  for (const r of crRows) {
    const v = got.get(`${r.scope}|${r.periodKey}|${r.metric}`);
    if (v === undefined || !withinTolerance(r.metric, r.value, v))
      fail(`CR: ${r.scope} ${r.metric} = ${String(v)}, control ${r.value}`);
  }
}

// ---------- 7 · manifest ----------

const pick = (r: Row, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));
const sorted = <K extends string>(rows: Row[], keys: readonly K[]) => bySort(rows).map((r) => pick(r, keys));
const budget = T.fact_budget_month
  .map((r) => [monthIxOf(str(r, 'month_key')), campIx(r), num(r, 'budget_usd')] as [number, number, number])
  .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const draft = {
  schema: 'acme-marketing/1',
  meta: {
    seed: source.seed,
    as_of: source.as_of_date,
    refreshed: source.refreshed.slice(0, 16),
    first_day: FIRST_DAY,
    days: ND,
    default_window: { start: source.default_window_start, end: source.default_window_end },
    previous_window: { start: source.previous_window_start, end: source.previous_window_end },
    currency: source.currency,
  },
  platforms: sorted(T.dim_platform, ['platform_code', 'platform_name', 'is_mobile', 'sort_order']),
  segments: sorted(T.dim_platform_segment, ['segment_code', 'segment_name', 'platform_code', 'sort_order']),
  channels: sorted(T.dim_channel, [
    'channel_code',
    'channel_name',
    'color_slot',
    'color_light',
    'color_dark',
    'sort_order',
  ]),
  networks: sorted(T.dim_network, ['network_code', 'network_name', 'sort_order']),
  campaigns: campaigns.map((r) =>
    pick(r, [
      'campaign_key',
      'campaign_name',
      'channel_code',
      'network_code',
      'platform_code',
      'market_code',
      'tier_code',
      'objective_code',
      'status_code',
      'is_brand',
      'start_date',
      'end_date',
      'learning_end_date',
      'cpa_target_usd',
      'sort_order',
    ]),
  ),
  pages: pages.map((r) => pick(r, ['page_key', 'page_name', 'page_type', 'platform_code', 'sort_order'])),
  steps: sorted(T.dim_onboarding_step, ['step_code', 'step_name', 'fact_column', 'is_activation', 'sort_order']),
  models: sorted(T.dim_attribution_model, [
    'model_code',
    'model_name',
    'lookback_click_days',
    'lookback_view_days',
    'is_default',
    'is_first_party',
    'description',
    'sort_order',
  ]),
  terms: terms.map((r) => pick(r, ['term_key', 'campaign_key', 'term_text', 'term_type', 'match_type', 'sort_order'])),
  targets: sorted(T.param_target, [
    'scope_type',
    'scope_code',
    'metric_code',
    'target_value',
    'direction',
    'sort_order',
  ]),
  finance: T.param_finance.map((r) => pick(r, ['metric_code', 'valid_from', 'value'])),
  alert_rules: sorted(T.param_alert_rule, [
    'rule_code',
    'severity',
    'title',
    'scope_type',
    'metric_code',
    'condition',
    'sort_order',
  ]),
  sync_log: T.sync_log.map((r) =>
    pick(r, ['source_code', 'source_name', 'cadence', 'last_sync_ts', 'stale_after_h', 'red_after_h', 'status']),
  ),
  budget,
};

// ---------- 8 · write ----------

const rowsOf = (m: Map<number, Acc>, extra: (k: number) => Record<string, number>) =>
  [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, a]) => ({ ...extra(k), ...a }));
const dc = (k: number) => ({ day_ix: Math.floor(k / NC), camp_ix: k % NC });
const outputs: Record<FileKey, Record<string, number>[]> = {
  campaignDay: rowsOf(cd, dc),
  cohortMonth: T.fact_cohort_revenue_month
    .map((r) => ({
      cohort_month_ix: monthIxOf(str(r, 'cohort_month')),
      camp_ix: campIx(r),
      month_offset: num(r, 'month_offset'),
      customers_start: num(r, 'customers_start'),
      churned: num(r, 'churned'),
      customers_end: num(r, 'customers_end'),
      revenue_usd: num(r, 'revenue_usd'),
      refunds_usd: num(r, 'refunds_usd'),
      refund_count: num(r, 'refund_count'),
    }))
    .sort((a, b) => a.cohort_month_ix - b.cohort_month_ix || a.camp_ix - b.camp_ix || a.month_offset - b.month_offset),
  retention: T.fact_retention_cohort_month
    .map((r) => ({
      cohort_month_ix: monthIxOf(str(r, 'cohort_month')),
      camp_ix: campIx(r),
      day_n: num(r, 'day_n'),
      users_matured: num(r, 'users_matured'),
      users_active: num(r, 'users_active'),
    }))
    .sort((a, b) => a.cohort_month_ix - b.cohort_month_ix || a.camp_ix - b.camp_ix || a.day_n - b.day_n),
  journeyDay: rowsOf(jd, dc),
  trafficPageDay: rowsOf(tp, (k) => ({ ...dc(Math.floor(k / 8)), page_ix: k % 8 })),
  segmentDay: segRows.sort((a, b) => a.day_ix - b.day_ix || a.camp_ix - b.camp_ix || a.seg_ix - b.seg_ix),
  termDay: termRows.sort((a, b) => a.day_ix - b.day_ix || a.term_ix - b.term_ix),
};

function encode(fk: FileKey, rows: readonly Record<string, number>[]): ArrayBuffer {
  if (rows.length === 0) fail(`${fk}: no rows`);
  const columnData: ColumnSource[] = Object.entries(FILES[fk].columns).map(([name, kind]) => {
    const data = rows.map((r) => r[name] ?? 0); // a missing measure on a campaign-day is a true 0 (no row in that fact)
    if (kind === 'int' && data.some((v) => !Number.isInteger(v) || Math.abs(v) > 2 ** 31 - 1))
      fail(`${fk}.${name}: not int32`);
    return {
      name,
      data: kind === 'int' ? Int32Array.from(data) : Float64Array.from(data),
      type: kind === 'int' ? 'INT32' : 'DOUBLE',
      nullable: false,
    };
  });
  return parquetWriteBuffer({
    columnData,
    rowGroupSize: rows.length,
    createdBy: 'acme js-marketing build-marketing-data',
  });
}

mkdirSync(OUT, { recursive: true });
const files = {} as Manifest['files'];
for (const fk of Object.keys(FILES) as FileKey[]) {
  const rows = outputs[fk];
  for (const r of rows)
    for (const col of Object.keys(r)) if (!(col in FILES[fk].columns)) fail(`${fk}: column ${col} not in FILES`);
  const buffer = encode(fk, rows);
  writeFileSync(join(OUT, FILES[fk].file), new Uint8Array(buffer));
  files[fk] = { name: FILES[fk].file, rows: rows.length, bytes: buffer.byteLength };
}

const parsed = manifestSchema.safeParse({ ...draft, files });
if (!parsed.success) fail(z.prettifyError(parsed.error));
const manifestText = `${JSON.stringify(parsed.data)}\n`;
writeFileSync(join(OUT, 'manifest.json'), manifestText);

// ---------- 9 · budgets (§2.3) ----------

const mBytes = Buffer.byteLength(manifestText);
const firstPaint = mBytes + FIRST_PAINT_FILES.reduce((s, k) => s + files[k].bytes, 0);
const total = mBytes + Object.values(files).reduce((s, f) => s + f.bytes, 0);
if (files.campaignDay.bytes > CAMPAIGN_DAY_FALLBACK)
  fail(
    `campaign-day.parquet ${files.campaignDay.bytes} B > ${CAMPAIGN_DAY_FALLBACK} B: apply the attribution-alt split`,
  );
if (firstPaint > FIRST_PAINT_MAX) fail(`first paint ${firstPaint} B > ${FIRST_PAINT_MAX} B`);
if (total > TOTAL_MAX) fail(`total ${total} B > ${TOTAL_MAX} B`);
if (firstPaint > FIRST_PAINT_BUDGET) console.warn(`build-marketing-data: first paint ${firstPaint} B over the budget`);
if (total > TOTAL_BUDGET) console.warn(`build-marketing-data: total ${total} B over the budget`);

console.log(
  `build-marketing-data: ${source.tables.length} source tables OK · calendar = dim_date / dim_month · AT-05 ties OK · ` +
    `32 CR: rows OK`,
);
for (const fk of Object.keys(FILES) as FileKey[])
  console.log(
    `  ${files[fk].name.padEnd(26)} ${String(files[fk].rows).padStart(6)} rows ${String(files[fk].bytes).padStart(8)} B${FILES[fk].lazy ? '  (lazy)' : ''}`,
  );
console.log(`  manifest.json${' '.repeat(26)}${String(mBytes).padStart(8)} B`);
console.log(`  first paint ${firstPaint} B (≤ ${FIRST_PAINT_BUDGET}) · total ${total} B (≤ ${TOTAL_BUDGET})`);

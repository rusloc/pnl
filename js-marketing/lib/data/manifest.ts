import { z } from 'zod';
import type { ColumnSpec } from './parquet-columns.ts';

// Data contracts (docs/ADD/features/marketing-js-flavour.md §2; ADR-0015 (b): the data README's table and column names
// win over every other name). Two manifests: the SOURCE manifest of data/acme_marketing_dummy_data/parquet (read by the
// build only) and the SHIPPED manifest of public/data (schema 'acme-marketing/1', written by
// scripts/build-marketing-data.ts, read by the loader). FILES is the one place the build and the loader share the
// Parquet column specs; the engine never names a Parquet column outside it.

// ---------- source ----------

/** The 27 tables of the dataset, in manifest order (data README › Files). */
export const SOURCE_TABLES = [
  'dim_date',
  'dim_month',
  'dim_platform',
  'dim_platform_segment',
  'dim_channel',
  'dim_network',
  'dim_campaign',
  'dim_ad_set',
  'dim_creative',
  'dim_term',
  'dim_landing_page',
  'dim_onboarding_step',
  'dim_attribution_model',
  'fact_ad_delivery_day',
  'fact_term_day',
  'fact_traffic_day',
  'fact_funnel_day',
  'fact_signup_segment_day',
  'fact_attribution_day',
  'fact_cohort_revenue_month',
  'fact_retention_cohort_month',
  'fact_budget_month',
  'fact_pipeline_month',
  'param_target',
  'param_finance',
  'param_alert_rule',
  'sync_log',
] as const;
export type SourceTable = (typeof SOURCE_TABLES)[number];

/** Arrow types the generator writes (pyarrow names, as manifest.json spells them). */
export const ARROW_TYPES = ['string', 'bool', 'int32', 'int64', 'double', 'date32[day]', 'timestamp[ms]'] as const;

const isoDate = z.iso.date();
const int = z.number().int();

const sourceTable = z
  .object({
    table: z.enum(SOURCE_TABLES),
    rows: int.positive(),
    parquet_bytes: int.positive(),
    columns: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), z.enum(ARROW_TYPES)),
  })
  .strict();

export const sourceManifestSchema = z
  .object({
    dataset: z.literal('acme_marketing_dummy_data'),
    generator_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    seed: int,
    as_of_date: isoDate,
    refreshed: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
    default_window_start: isoDate,
    default_window_end: isoDate,
    previous_window_start: isoDate,
    previous_window_end: isoDate,
    currency: z.literal('USD'),
    tables: z
      .array(sourceTable)
      .refine(
        (t) => t.length === SOURCE_TABLES.length && t.every((x, i) => x.table === SOURCE_TABLES[i]),
        'tables must list SOURCE_TABLES in order',
      ),
  })
  .strict();
export type SourceManifest = z.infer<typeof sourceManifestSchema>;

// ---------- shipped (public/data/manifest.json, schema 'acme-marketing/1') ----------

const code = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
const text = z.string().min(1);
const hex = z.string().regex(/^#[0-9A-F]{6}$/);
const minute = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const span = z.object({ start: isoDate, end: isoDate }).strict();

export const OBJECTIVES = ['PAID', 'INSTALL', 'LEAD', 'PIPELINE', 'RETENTION'] as const;
export const STATUSES = ['LIVE', 'LEARNING', 'PAUSED', 'ENDED'] as const;
export const MODELS = ['DDA', 'LAST_CLICK', 'FIRST_TOUCH', 'PLATFORM'] as const;
export type Objective = (typeof OBJECTIVES)[number];
export type Status = (typeof STATUSES)[number];
export type ModelCode = (typeof MODELS)[number];

const platform = z
  .object({ platform_code: code, platform_name: text, is_mobile: z.boolean(), sort_order: int })
  .strict();
const segment = z.object({ segment_code: code, segment_name: text, platform_code: code, sort_order: int }).strict();
const channel = z
  .object({
    channel_code: code,
    channel_name: text,
    color_slot: int.min(1).max(6),
    color_light: hex,
    color_dark: hex,
    sort_order: int,
  })
  .strict();
const network = z.object({ network_code: code, network_name: text, sort_order: int }).strict();
const campaign = z
  .object({
    campaign_key: code,
    campaign_name: text,
    channel_code: code,
    network_code: code,
    platform_code: code,
    market_code: code,
    tier_code: code,
    objective_code: z.enum(OBJECTIVES),
    status_code: z.enum(STATUSES),
    is_brand: z.boolean(),
    start_date: isoDate,
    end_date: isoDate.nullable(),
    learning_end_date: isoDate.nullable(),
    cpa_target_usd: z.number().positive().nullable(),
    sort_order: int,
  })
  .strict();
const page = z
  .object({
    page_key: code,
    page_name: text,
    page_type: z.enum(['WEB', 'APP_STORE', 'PLAY_STORE']),
    platform_code: code,
    sort_order: int,
  })
  .strict();
const step = z
  .object({ step_code: code, step_name: text, fact_column: text, is_activation: z.boolean(), sort_order: int })
  .strict();
const model = z
  .object({
    model_code: z.enum(MODELS),
    model_name: text,
    lookback_click_days: int,
    lookback_view_days: int,
    is_default: z.boolean(),
    is_first_party: z.boolean(),
    description: text,
    sort_order: int,
  })
  .strict();
const term = z
  .object({
    term_key: z.string().regex(/^[A-Z0-9_]+-T\d+$/),
    campaign_key: code,
    term_text: text,
    term_type: z.enum(['KEYWORD', 'PLACEMENT', 'AUDIENCE']),
    match_type: z.enum(['EXACT', 'PHRASE', 'BROAD']).nullable(),
    sort_order: int,
  })
  .strict();
const target = z
  .object({
    scope_type: z.enum(['ALL', 'CHANNEL']),
    scope_code: code,
    metric_code: code,
    target_value: z.number(),
    direction: z.enum(['UP', 'DOWN', 'BAND']),
    sort_order: int,
  })
  .strict();
const finance = z.object({ metric_code: code, valid_from: isoDate, value: z.number() }).strict();
const alertRule = z
  .object({
    rule_code: code,
    severity: z.enum(['CRIT', 'WARN', 'INFO', 'OK']),
    title: text,
    scope_type: z.enum(['CAMPAIGN', 'CHANNEL', 'ALL', 'SOURCE']),
    metric_code: code,
    condition: text,
    sort_order: int,
  })
  .strict();
const sync = z
  .object({
    source_code: code,
    source_name: text,
    cadence: z.enum(['HOURLY', 'DAILY']),
    last_sync_ts: minute,
    stale_after_h: z.number().positive(),
    red_after_h: z.number().positive(),
    status: text,
  })
  .strict();
const fileEntry = z
  .object({ name: z.string().regex(/^[a-z-]+\.parquet$/), rows: int.positive(), bytes: int.positive() })
  .strict();

export const manifestSchema = z
  .object({
    schema: z.literal('acme-marketing/1'),
    meta: z
      .object({
        seed: int,
        as_of: isoDate,
        refreshed: minute,
        first_day: isoDate,
        days: int.positive(),
        default_window: span,
        previous_window: span,
        currency: z.literal('USD'),
      })
      .strict(),
    platforms: z.array(platform).length(3),
    segments: z.array(segment).length(6),
    channels: z.array(channel).length(6),
    networks: z.array(network).length(8),
    campaigns: z.array(campaign).length(19),
    pages: z.array(page).length(8),
    steps: z.array(step).length(6),
    models: z.array(model).length(4),
    terms: z.array(term).length(152),
    targets: z.array(target).length(43),
    finance: z.array(finance).min(1),
    alert_rules: z.array(alertRule).length(6),
    sync_log: z.array(sync).length(7),
    budget: z.array(z.tuple([int.min(0).max(23), int.min(0), z.number().min(0)])).length(456),
    files: z
      .object({
        campaignDay: fileEntry,
        cohortMonth: fileEntry,
        retention: fileEntry,
        journeyDay: fileEntry,
        trafficPageDay: fileEntry,
        segmentDay: fileEntry,
        termDay: fileEntry,
      })
      .strict(),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;
export type CampaignRow = z.infer<typeof campaign>;
export type ChannelRow = z.infer<typeof channel>;
export type TermRow = z.infer<typeof term>;
export type TargetRow = z.infer<typeof target>;
export type AlertRuleRow = z.infer<typeof alertRule>;
export type SyncRow = z.infer<typeof sync>;

/** Columns of each shipped Parquet file (INT32 'int', DOUBLE 'num'); indices point into the manifest arrays. */
export const FILES = {
  /** day × campaign: every flow metric of the vitals, Overview, Channels and Campaigns, the four attribution models. */
  campaignDay: {
    file: 'campaign-day.parquet',
    lazy: false,
    columns: {
      day_ix: 'int',
      camp_ix: 'int',
      impressions: 'int',
      clicks: 'int',
      spend_usd: 'num',
      reach_7d: 'int',
      sessions: 'int',
      store_views: 'int',
      installs: 'int',
      signups: 'int',
      activated: 'int',
      trials: 'int',
      act_lt1h: 'int',
      act_1_6h: 'int',
      act_6_24h: 'int',
      act_1_2d: 'int',
      act_2_4d: 'int',
      act_4_7d: 'int',
      act_7_30d: 'int',
      paid_dda: 'num',
      paid_last_click: 'num',
      paid_first_touch: 'num',
      paid_platform: 'num',
      mrr_dda: 'num',
      mrr_last_click: 'num',
      mrr_first_touch: 'num',
      mrr_platform: 'num',
    },
  },
  /** cohort month × campaign × month offset (DDA; fact_cohort_revenue_month as is). */
  cohortMonth: {
    file: 'cohort-month.parquet',
    lazy: false,
    columns: {
      cohort_month_ix: 'int',
      camp_ix: 'int',
      month_offset: 'int',
      customers_start: 'num',
      churned: 'num',
      customers_end: 'num',
      revenue_usd: 'num',
      refunds_usd: 'num',
      refund_count: 'num',
    },
  },
  /** cohort month × campaign × day N (fact_retention_cohort_month as is). */
  retention: {
    file: 'retention.parquet',
    lazy: false,
    columns: { cohort_month_ix: 'int', camp_ix: 'int', day_n: 'int', users_matured: 'int', users_active: 'int' },
  },
  /** day × campaign: the onboarding steps not in campaign-day and first opens (Journey). */
  journeyDay: {
    file: 'journey-day.parquet',
    lazy: true,
    columns: {
      day_ix: 'int',
      camp_ix: 'int',
      step_verified: 'int',
      step_workspace: 'int',
      step_connected: 'int',
      step_invited: 'int',
      first_opens: 'int',
    },
  },
  /** day × campaign × page (J1); lcp_x_sessions = Σ lcp_ms_p75 × sessions (sessions-weighted LCP, A-46). */
  trafficPageDay: {
    file: 'traffic-page-day.parquet',
    lazy: true,
    columns: {
      day_ix: 'int',
      camp_ix: 'int',
      page_ix: 'int',
      sessions: 'int',
      bounces: 'int',
      lcp_x_sessions: 'num',
      store_views: 'int',
      installs: 'int',
      signups: 'int',
    },
  },
  /** day × campaign × platform segment (J4). */
  segmentDay: {
    file: 'segment-day.parquet',
    lazy: true,
    columns: { day_ix: 'int', camp_ix: 'int', seg_ix: 'int', signups: 'int', activated_7d: 'int' },
  },
  /** day × term (P5 and the TM: control rows). */
  termDay: {
    file: 'term-day.parquet',
    lazy: true,
    columns: { day_ix: 'int', term_ix: 'int', impressions: 'int', clicks: 'int', spend_usd: 'num', signups: 'int' },
  },
} as const satisfies Record<string, { file: string; lazy: boolean; columns: ColumnSpec }>;

export type FileKey = keyof typeof FILES;
export const FIRST_PAINT_FILES = ['campaignDay', 'cohortMonth', 'retention'] as const satisfies readonly FileKey[];
export const JOURNEY_FILES = ['journeyDay', 'trafficPageDay', 'segmentDay'] as const satisfies readonly FileKey[];
export const CAMPAIGNS_FILES = ['termDay'] as const satisfies readonly FileKey[];

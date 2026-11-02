import { z } from 'zod';
import type { ColumnSpec } from '../data/parquet-columns.ts';

// Data contract between scripts/build-sales-data.ts and the browser (ADR-0011 (c), same pattern as the P&L's
// lib/data/manifest.ts). FILES declares every shipped Parquet file with its columns and kinds: the build writes them
// from these specs and the loader reads them back through the same specs. The small dimensions and parameters travel
// inside manifest.json and are validated here with strict Zod objects, so a drift either way fails loudly.

const code = z.string().min(1);
const text = z.string().min(1);
const isoDate = z.iso.date();
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);
const int = z.number().int();

export const MARKETS = ['PL', 'RO', 'PT'] as const;
export const marketCode = z.enum(MARKETS);
export type MarketCode = z.infer<typeof marketCode>;

const DIMS = {
  market: z
    .object({
      market_code: marketCode,
      market_name: text,
      currency_code: z.enum(['PLN', 'RON', 'EUR']),
      launch_date: isoDate,
      sort_order: int,
    })
    .strict(),
  product: z
    .object({
      product_code: code,
      product_name: text,
      product_line: z.enum(['Microloan', 'Account', 'Card']),
      segment_code: z.enum(['CONSUMER', 'MICRO_BUSINESS']).nullable(),
      repayment_type: z.enum(['Bullet', 'Instalment']).nullable(),
      term_months: int.nullable(),
      tenor_days: int.nullable(),
      pl_launch_date: isoDate.nullable(),
      ro_launch_date: isoDate.nullable(),
      pt_launch_date: isoDate.nullable(),
      sort_order: int,
    })
    .strict(),
  channel: z.object({ channel_code: code, channel_name: text, is_assisted: z.boolean(), sort_order: int }).strict(),
  agent: z
    .object({
      agent_code: code,
      agent_name: text,
      agent_type: z.enum(['AGENT', 'PARTNER']),
      market_code: marketCode,
      team: text,
      start_date: isoDate,
      is_ramp_cohort: z.boolean(),
      sort_order: int,
    })
    .strict(),
  funnel_stage: z
    .object({
      stage_code: code,
      stage_name: text,
      sort_order: int,
      is_terminal: z.boolean(),
      outcome: z.enum(['Progress', 'Won', 'Lost']),
      fact_column: text,
      sla_hours: int.nullable(),
    })
    .strict(),
  revenue_type: z.object({ revenue_type_code: code, revenue_type_name: text, sort_order: int }).strict(),
  loan_status: z
    .object({
      status_code: code,
      status_name: text,
      status_group: text,
      dpd_min: int.nullable(),
      dpd_max: int.nullable(),
      is_active: z.boolean(),
      is_overdue_30: z.boolean(),
      is_bad_90: z.boolean(),
      sort_order: int,
    })
    .strict(),
  month: z
    .object({
      month_key: monthKey,
      month_start: isoDate,
      month_index: int,
      year: int,
      quarter: int.min(1).max(4),
      month_name: text,
      days_in_month: int,
      is_closed: z.boolean(),
      has_actuals: z.boolean(),
    })
    .strict(),
  thresholds: z
    .object({
      threshold_set: code,
      metric_code: code,
      band_code: code,
      min_value: z.number().nullable(),
      max_value: z.number().nullable(),
      label: text,
      sort_order: int,
    })
    .strict(),
  fx: z
    .object({
      currency_code: z.enum(['PLN', 'RON', 'EUR']),
      month_key: monthKey,
      rate_type: z.enum(['ACTUAL_AVG', 'BUDGET']),
      local_per_eur: z.number().positive(),
    })
    .strict(),
} as const;

export type DimName = keyof typeof DIMS;
export type DimRow<T extends DimName> = z.infer<(typeof DIMS)[T]>;

export const dimsSchema = z
  .object(
    Object.fromEntries(Object.entries(DIMS).map(([name, row]) => [name, z.array(row).min(1)])) as {
      [T in DimName]: z.ZodArray<(typeof DIMS)[T]>;
    },
  )
  .strict();
export { DIMS };

/** Shipped Parquet files that load with the page (the first paint needs them). The detail window's files: DETAIL. */
export const FILES = {
  loansMonth: {
    file: 'loans-month.parquet',
    load: 'base',
    columns: {
      month: 'str',
      market: 'str',
      product: 'str',
      channel: 'str',
      repeat: 'bool',
      loans: 'int',
      principal_local: 'num',
    },
  },
  funnelMonth: {
    file: 'funnel-month.parquet',
    load: 'base',
    columns: {
      month: 'str',
      market: 'str',
      product: 'str',
      channel: 'str',
      repeat: 'bool',
      leads: 'int',
      started: 'int',
      submitted: 'int',
      kyc_passed: 'int',
      approved: 'int',
      disbursed: 'int',
    },
  },
  portfolioMonth: {
    file: 'portfolio-month.parquet',
    load: 'base',
    columns: {
      month: 'str',
      market: 'str',
      product: 'str',
      loans_active: 'int',
      loans_dpd_30p: 'int',
      outstanding: 'num',
      bal_current: 'num',
      bal_1_29: 'num',
      bal_30_59: 'num',
      bal_60_89: 'num',
      bal_90p: 'num',
      written_off: 'num',
      provision: 'num',
    },
  },
  vintage: {
    file: 'vintage.parquet',
    load: 'base',
    columns: { vintage: 'str', market: 'str', mob: 'int', disbursed: 'int', first_30p: 'int', first_90p: 'int' },
  },
  windowStats: {
    file: 'window-stats.parquet',
    load: 'base',
    columns: {
      tv: 'str',
      anchor: 'str',
      market: 'str',
      segment: 'str',
      borrowers: 'int',
      returning: 'int',
      median_hours_to_cash: 'num?', // medians only on segment ALL; null when the window has no loans
      median_hours_to_approve: 'num?',
      median_hours_payout: 'num?',
      median_days_between: 'num?',
    },
  },
  cohortCurve: {
    file: 'cohort-curve.parquet',
    load: 'base',
    columns: { cohort: 'str', market: 'str', day: 'int', clients: 'int', repeated: 'int', observable: 'bool' },
  },
  agentMonth: {
    file: 'agent-month.parquet',
    load: 'base',
    columns: {
      month: 'str',
      agent: 'str',
      loans: 'int',
      principal_local: 'num',
      target_loans: 'num',
      target_principal_local: 'num',
    },
  },
  revenueMonth: {
    file: 'revenue-month.parquet',
    load: 'base',
    columns: { month: 'str', market: 'str', product: 'str', stream: 'str', amount_local: 'num' },
  },
  subsMonth: {
    file: 'subs-month.parquet',
    load: 'base',
    columns: {
      month: 'str',
      market: 'str',
      tier: 'str',
      subscribers_start: 'int',
      subscribers_new: 'int',
      subscribers_churned: 'int',
      subscribers_end: 'int',
      revenue_local: 'num',
      mrr_local: 'num',
    },
  },
  targetMonth: {
    file: 'target-month.parquet',
    load: 'base',
    columns: { month: 'str', market: 'str', product: 'str?', metric: 'str', value: 'num' },
  },
} as const satisfies Record<string, { file: string; load: 'base'; columns: ColumnSpec }>;

export type FileKey = keyof typeof FILES;

/**
 * Full loan / client detail for the detail window (2026-11-01, owner: every list complete; it was a capped sample).
 * `scripts/build-sales-data.ts` cuts the generator's output into `public/data/sales/detail/`: `loans-YYYY-MM` (every
 * loan of a closed month), `cohort-YYYY-MM` (every client whose first loan is in that month, with its to-date summary),
 * `overdue` (every loan 30+ DPD with a balance at the last close) and, per client_id % `buckets`, `client-NN` (loans)
 * + `client-dim-NN` (dims). `index.json` lists rows and bytes per file; the loader checks every read against it.
 */
const LOAN_COLUMNS = {
  loan_id: 'int',
  client_id: 'int',
  disbursed: 'str',
  market: 'str',
  product: 'str',
  channel: 'str',
  agent: 'str?',
  repeat: 'bool',
  principal_local: 'num',
  hours_to_cash: 'num',
  status: 'str',
  dpd_close: 'int',
  outstanding_close_local: 'num',
} as const satisfies ColumnSpec;
const CLIENT_COLUMNS = {
  client_id: 'int',
  market: 'str',
  segment: 'str',
  acquisition_channel: 'str',
  acquisition_agent: 'str?',
  first_loan_date: 'str',
  first_product: 'str',
  cohort_month: 'str',
  birth_year_band: 'str',
  city_tier: 'int',
  loans_before_2024: 'int',
} as const satisfies ColumnSpec;
export const DETAIL = {
  dir: 'detail',
  buckets: 64,
  loans: LOAN_COLUMNS,
  clients: CLIENT_COLUMNS,
  cohort: {
    ...CLIENT_COLUMNS,
    loans_to_date: 'int', // fact loans through the close + loans before 2024
    principal_eur_to_date: 'num', // since 2024, each loan at its month's actual rate
    last_disbursed: 'str',
    last_status: 'str',
  },
} as const satisfies {
  dir: string;
  buckets: number;
  loans: ColumnSpec;
  clients: ColumnSpec;
  cohort: ColumnSpec;
};

const fileInfo = z.object({ rows: int.min(0), bytes: int.min(0) }).strict();

export const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    builtAt: z.iso.datetime(),
    source: z
      .object({
        seed: int,
        firstMonth: monthKey,
        lastClosedMonth: monthKey,
        actualsThrough: isoDate,
      })
      .strict(),
    cohortDays: z.array(int.min(0)).min(2),
    files: z.object(Object.fromEntries(Object.values(FILES).map((f) => [f.file, fileInfo]))).strict(),
    dims: dimsSchema,
  })
  .strict();

export type SalesManifest = z.infer<typeof manifestSchema>;

export function parseManifest(json: unknown): SalesManifest {
  return manifestSchema.parse(json);
}

export const detailIndexSchema = z
  .object({
    lastClose: isoDate,
    buckets: z.literal(DETAIL.buckets),
    files: z.record(z.string().regex(/^[a-z0-9-]+\.parquet$/), fileInfo),
  })
  .strict();
export type DetailIndexFile = z.infer<typeof detailIndexSchema>;

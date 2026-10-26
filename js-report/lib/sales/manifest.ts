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

/**
 * Shipped Parquet files. `base` files load with the page (the first paint needs them); `detail` files hold the capped
 * loan / client sample for the slide-over and the two detail tables, and load on first need.
 */
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
  detailLoans: {
    file: 'detail-loans.parquet',
    load: 'detail',
    columns: {
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
    },
  },
  detailClients: {
    file: 'detail-clients.parquet',
    load: 'detail',
    columns: {
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
    },
  },
} as const satisfies Record<string, { file: string; load: 'base' | 'detail'; columns: ColumnSpec }>;

export type FileKey = keyof typeof FILES;

/** Caps of the detail sample (the slide-over shows the top rows; the counts in titles come from the aggregates). */
export const DETAIL_CAPS = {
  loansPerMonthMarket: 50, // top by principal per disbursement month × market
  loansPerAgentMonth: 10, // top by principal per agent × month
  overduePerMarket: 100, // top by DPD at the last closed month, per market
  clientsPerCohortMarket: 20, // top by principal to date per first-loan month × market
} as const;

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
    caps: z
      .object({
        loansPerMonthMarket: int.min(1),
        loansPerAgentMonth: int.min(1),
        overduePerMarket: int.min(1),
        clientsPerCohortMarket: int.min(1),
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

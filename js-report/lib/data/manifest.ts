import { z } from 'zod';

// Data contract between scripts/build-data.ts and the browser (ADR-0002 §2.2). Each object below declares one source
// CSV's columns in header order and with their types: the build script parses the CSVs from these shapes, and the
// loader validates manifest.json against them, so a drift in either direction fails loudly.

const code = z.string().min(1);
const text = z.string().min(1);
const optText = z.string().min(1).nullable();
const int = z.number().int();
const currency = z.enum(['USD', 'EUR', 'GBP', 'AUD']);
const reportingCurrency = z.enum(['USD', 'EUR', 'GBP']);

export const TABLES = {
  // D-10
  dim_account: z
    .object({
      account_code: code,
      account_name: text,
      entity_scope: z.enum(['P', 'S', 'BOTH', 'GROUP']),
      entity_scope_name: text,
      block_code: code,
      block_name: text,
      block_alias_products: text,
      block_alias_services: text,
      spine_step: code,
      sort_order: int,
      natural_sign: int.min(-1).max(1),
      ifrs18_category: text,
      is_direct: z.boolean(),
      is_below_cm: z.boolean(),
      is_intercompany: z.boolean(),
      has_fact_rows: z.boolean(),
      definition: text,
      published_comparable: text,
      default_cost_centre_products: optText,
      default_cost_centre_services: optText,
    })
    .strict(),
  // D-11
  dim_report_line: z
    .object({
      line_code: code,
      line_name: text,
      row_type: z.enum(['input_block', 'subtotal', 'ratio', 'group_total', 'memo']),
      formula: optText,
      block_code: optText,
      spine_step: code,
      tag: optText,
      parent_line_code: optText,
      is_key: z.boolean(),
      alias_products: optText,
      alias_services: optText,
      ifrs18_category: optText,
      sort_order: int,
    })
    .strict(),
  // D-12
  bridge_account_nature: z.object({ account_code: code, nature_code: code, weight: z.number() }).strict(),
  // D-13
  dim_nature: z
    .object({ nature_code: code, nature_name: text, sort_order: int, natural_sign: int.min(-1).max(0) })
    .strict(),
  // D-14
  dim_entity: z
    .object({
      entity_code: z.enum(['P', 'S']),
      entity_name: text,
      short_name: text,
      description: text,
      consolidation_group: text,
    })
    .strict(),
  // D-15
  dim_month: z
    .object({
      month_key: z.string().regex(/^\d{4}-\d{2}$/),
      month_start_date: z.iso.date(),
      month_index: int.min(0),
      fiscal_year: int,
      quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
      month_number: int.min(1).max(12),
      month_name: text,
      is_closed: z.boolean(),
    })
    .strict(),
  // D-16
  dim_version: z
    .object({
      version_key: code,
      version_code: z.enum(['Actual', 'Budget', 'Forecast']),
      version_name: text,
      forecast_cycle: optText,
      is_latest_forecast: z.boolean(),
      first_month_key: code,
      last_month_key: code,
    })
    .strict(),
  // D-17
  dim_region: z
    .object({ region_code: code, region_name: text, functional_currency: currency, sort_order: int })
    .strict(),
  // D-18 … D-20
  dim_channel: z
    .object({
      channel_code: code,
      channel_name: text,
      entity_code: z.enum(['P', 'S']),
      slot_label: text,
      sort_order: int,
      is_unassigned: z.boolean(),
    })
    .strict(),
  dim_line: z
    .object({
      line_code: code,
      line_name: text,
      entity_code: z.enum(['P', 'S']),
      slot_label: text,
      sort_order: int,
      is_unassigned: z.boolean(),
    })
    .strict(),
  dim_segment: z
    .object({
      segment_code: code,
      segment_name: text,
      entity_code: z.enum(['P', 'S']),
      slot_label: text,
      sort_order: int,
      is_unassigned: z.boolean(),
    })
    .strict(),
  // D-21 parameter tables
  param_reporting_currency: z
    .object({
      currency_code: reportingCurrency,
      currency_name: text,
      symbol: text,
      sort_order: int,
      is_default: z.boolean(),
    })
    .strict(),
  param_fx_basis: z
    .object({ fx_basis_code: z.enum(['ACT', 'CC']), fx_basis_name: text, sort_order: int, is_default: z.boolean() })
    .strict(),
  param_units: z
    .object({
      units_code: z.enum(['M', 'K']),
      units_name: text,
      divisor: z.number().positive(),
      decimals: int.min(0),
      sort_order: int,
      is_default: z.boolean(),
    })
    .strict(),
  param_version_choice: z
    .object({
      choice_code: z.enum(['A', 'LE', 'B', 'PY', 'NONE']),
      choice_name: text,
      allowed_as_base: z.boolean(),
      allowed_as_compare: z.boolean(),
      sort_order: int,
      default_for: optText,
    })
    .strict(),
  param_time_view: z
    .object({
      time_view_code: z.enum(['MTD', 'QTD', 'YTD', 'LTM', 'FY']),
      time_view_name: text,
      sort_order: int,
      is_default: z.boolean(),
    })
    .strict(),
  param_layout: z.object({ layout_code: code, layout_name: text, available_for: text, sort_order: int }).strict(),
  param_cost_lens: z
    .object({ lens_code: z.enum(['FN', 'NAT']), lens_name: text, sort_order: int, is_default: z.boolean() })
    .strict(),
  param_detail_level: z
    .object({
      detail_code: z.enum(['SUM', 'STD', 'FULL']),
      detail_name: text,
      sort_order: int,
      is_default: z.boolean(),
    })
    .strict(),
  param_cost_sign: z
    .object({
      cost_sign_code: z.enum(['NEG', 'POS']),
      cost_sign_name: text,
      display_multiplier_for_costs: int
        .min(-1)
        .max(1)
        .refine((v) => v !== 0),
      sort_order: int,
      is_default: z.boolean(),
    })
    .strict(),
  param_variance_format: z
    .object({
      variance_format_code: z.enum(['BOTH', 'ABS', 'PCT']),
      variance_format_name: text,
      sort_order: int,
      is_default: z.boolean(),
    })
    .strict(),
  param_breakdown: z
    .object({ breakdown_code: code, breakdown_name: text, available_for: text, sort_order: int })
    .strict(),
  // D-04
  fact_fx_rate: z
    .object({
      currency_code: currency,
      month_key: z.string().regex(/^\d{4}-\d{2}$/),
      rate_type: z.enum(['ACTUAL_AVG', 'BUDGET']),
      local_per_usd: z.number().positive(),
    })
    .strict(),
} as const;

export type TableName = keyof typeof TABLES;
export type TableRow<T extends TableName> = z.infer<(typeof TABLES)[T]>;

// Object.fromEntries widens keys to string; the mapped type restores the exact name → schema pairing built here.
export const tablesSchema = z
  .object(
    Object.fromEntries(Object.entries(TABLES).map(([name, row]) => [name, z.array(row)])) as {
      [T in TableName]: z.ZodArray<(typeof TABLES)[T]>;
    },
  )
  .strict();

const fileInfo = z.object({ rows: int.min(0), bytes: int.min(0) }).strict();
const dictionary = z.array(code).min(1);

export const PL_FILES = { P: 'pl-P.parquet', S: 'pl-S.parquet' } as const;
export const OPS_FILE = 'ops.parquet';

export const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    builtAt: z.iso.datetime(),
    files: z.object({ [PL_FILES.P]: fileInfo, [PL_FILES.S]: fileInfo, [OPS_FILE]: fileInfo }).strict(),
    // Parquet code columns hold indexes into these arrays. counterparty[0] is the "none" member (empty cell in D-01).
    dict: z
      .object({
        entity: dictionary,
        version: dictionary,
        region: dictionary,
        channel: dictionary,
        line: dictionary,
        segment: dictionary,
        account: dictionary,
        counterparty: z.tuple([z.literal('')], code),
      })
      .strict(),
    tables: tablesSchema,
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(json: unknown): Manifest {
  return manifestSchema.parse(json);
}

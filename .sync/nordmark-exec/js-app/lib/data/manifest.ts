import { z } from 'zod';
import type { ColumnSpec } from './parquet-columns.ts';

// Data contract of public/data/ (ADR-0013 (b), (h); ADR-0002 §2.2 pattern). scripts/build-exec-data.ts writes the
// files from these specs and the loader reads them back through the same specs. The small dimensions and parameters
// travel inside manifest.json as strict Zod objects; the facts ship as pre-aggregated Parquet cubes (E-83: stores and
// suppliers never ship). Names follow data/nordmark_retail_dummy_data/README.md (ADR-0013 (j): the data README wins).

/** Site groups of the cubes. dim_store.scope_code NL / BE / ONLINE, plus the sites that only count in ALL (E-15). */
export const GROUPS = ['NL', 'BE', 'ONLINE', 'WHOLESALE', 'DC', 'CENTRAL'] as const;
export type Group = (typeof GROUPS)[number];

export const SCOPES = ['ALL', 'NL', 'BE', 'ONLINE'] as const;
export type Scope = (typeof SCOPES)[number];

const code = z.string().min(1);
const text = z.string().min(1);
const isoDate = z.iso.date();
const int = z.number().int();
const weekKey = z.string().regex(/^FY\d{4}-W\d{2}$/);

const week = z
  .object({
    week_key: weekKey,
    fy: int,
    week_of_fy: int.min(1).max(53),
    period: int.min(1).max(12),
    period_key: z.string().regex(/^FY\d{4}-P\d{2}$/),
    week_of_period: int.min(1).max(5),
    weeks_in_period: int.min(4).max(5),
    week_start: isoDate,
    week_end: isoDate,
    period_start: isoDate,
    period_end: isoDate,
    ly_week_key: weekKey.nullable(),
    lw_week_key: weekKey.nullable(),
    is_actual: z.boolean(),
    season_code: code.nullable(),
    season_week: int.min(1).nullable(),
    week_label: text,
  })
  .strict();

const category = z
  .object({
    category_code: code,
    category_name: text,
    is_seasonal: z.boolean(),
    cover_target_wks: z.number().positive(),
    gmroi_target: z.number().positive(),
    sellthrough_target: z.number().nullable(),
    sort_order: int,
  })
  .strict();

const attr = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable();

const kpi = z
  .object({
    kpi_code: code,
    catalogue_no: int,
    kpi_name: text,
    domain: text,
    is_landing: z.boolean(),
    size: z.enum(['hero', 'medium', 'small']).nullable(),
    card_order: int.min(1).max(12).nullable(),
    group: attr(['B1', 'B2', 'B3', 'B4']),
    lever: attr(['sales', 'margin', 'stock', 'supply', 'cash']),
    horizon: attr(['week', 'month', 'quarter']),
    owner: z.enum(['commercial', 'supply', 'finance', 'digital']),
    statement: attr(['pl', 'bs', 'ops']),
    drill_page: text,
    is_provisional: z.boolean(),
    direction: z.enum(['UP', 'DOWN', 'BAND', 'CONTEXT']),
    basis: z.enum(['BUDGET', 'TARGET', 'PLAN']).nullable(),
    formula: text.nullable(),
    owner_initials: text.nullable(),
    cadence: text,
  })
  .strict();

const rule = z
  .object({
    rule_code: code,
    kpi_code: code.nullable(),
    direction: z.enum(['UP', 'DOWN', 'BAND']).nullable(),
    watch_from: z.number().nullable(),
    off_from: z.number().nullable(),
    threshold: z.number().nullable(),
  })
  .strict();

const target = z.object({ kpi_code: code, category_code: code, target_value: z.number() }).strict();

const fileEntry = z.object({
  name: z.string().regex(/^[a-z-]+\.parquet$/),
  rows: int.positive(),
  bytes: int.positive(),
});

export const manifestSchema = z
  .object({
    schema: z.literal('nordmark-exec/1'),
    seed: int,
    as_of: isoDate,
    current_week_key: weekKey,
    refreshed: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    groups: z
      .array(z.enum(GROUPS))
      .refine((g) => g.length === GROUPS.length && g.every((x, i) => x === GROUPS[i]), 'groups must equal GROUPS'),
    weeks: z.array(week).min(1),
    categories: z.array(category).min(1),
    kpis: z.array(kpi).length(32),
    rules: z.array(rule).min(1),
    targets: z.array(target).min(1),
    files: z.object({ cube: fileEntry, opex: fileEntry, po: fileEntry, sites: fileEntry }).strict(),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;
export type WeekRow = z.infer<typeof week>;
export type CategoryRow = z.infer<typeof category>;
export type KpiRow = z.infer<typeof kpi>;
export type RuleRow = z.infer<typeof rule>;

/** Columns of each shipped Parquet file; indices point into manifest.weeks / groups / categories. */
export const FILES = {
  /** week × site group × category: every additive card input (sales, budget, stock, forecast, availability, receipts). */
  cube: {
    file: 'cube.parquet',
    columns: {
      week_ix: 'int',
      group_ix: 'int',
      category_ix: 'int',
      gross_sales: 'num',
      markdown: 'num',
      returns: 'num',
      net_sales: 'num',
      cogs: 'num',
      back_margin: 'num',
      units: 'num',
      net_sales_lfl: 'num', // rows with is_lfl (current side, E-31)
      net_sales_lfl_as_ly: 'num', // rows with is_lfl_as_ly (the LY side of the period one year later)
      net_sales_bud: 'num',
      gross_sales_bud: 'num',
      markdown_bud: 'num',
      cogs_bud: 'num',
      back_margin_bud: 'num',
      net_sales_bud_lfl: 'num',
      on_hand_units: 'num',
      on_hand_cost: 'num',
      on_order_cost: 'num',
      forecast_cogs: 'num',
      ranged_sku_days: 'num',
      in_stock_sku_days: 'num',
      receipt_units: 'num',
    },
  },
  /** scenario (0 ACT, 1 BUD) × week × cost type × site group (CENTRAL = no site). */
  opex: {
    file: 'opex.parquet',
    columns: { scenario_ix: 'int', week_ix: 'int', cost_type_ix: 'int', group_ix: 'int', amount: 'num' },
  },
  /** week: PO lines (no site, E-15) and suppliers below 85 % OTIF in that week (ⓘ mini stat). */
  po: {
    file: 'po.parquet',
    columns: { week_ix: 'int', po_lines_due: 'int', po_lines_otif: 'int', suppliers_below_85: 'int' },
  },
  /** week × site group: trading stores and LFL stores (distinct store counts do not add over categories). */
  sites: {
    file: 'sites.parquet',
    columns: { week_ix: 'int', group_ix: 'int', trading_stores: 'int', lfl_stores: 'int' },
  },
} as const satisfies Record<string, { file: string; columns: ColumnSpec }>;

export type FileKey = keyof typeof FILES;
export const COST_TYPES = ['SHRINK', 'STORE_OPEX', 'CENTRAL_OPEX', 'FULFILMENT'] as const;
export type CostType = (typeof COST_TYPES)[number];
export const SCENARIOS = ['ACT', 'BUD'] as const;

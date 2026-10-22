// Engine data contract (ADR-0002 §2.3). Framework-free: no React, no DOM, no fetch.

export type EntityCode = 'P' | 'S';
export type EntityView = EntityCode | 'GROUP';
export type ReportingCurrency = 'USD' | 'EUR' | 'GBP';
export type Currency = ReportingCurrency | 'AUD';
export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type TimeView = 'MTD' | 'QTD' | 'YTD' | 'LTM' | 'FY';
export type BaseChoice = 'A' | 'LE' | 'B';
export type CompareChoice = 'B' | 'LE' | 'PY' | 'NONE';

/** One entity's P&L rows, columnar (pl-{entity}.parquet). Code columns index into manifest.dict. */
export interface PlColumns {
  n: number;
  monthIdx: Int32Array;
  version: Int32Array;
  region: Int32Array;
  channel: Int32Array;
  line: Int32Array;
  segment: Int32Array;
  account: Int32Array;
  counterparty: Int32Array; // 0 = no counterparty
  cents: Float64Array; // integer cents, local currency, signed (M-01)
}

/** Validated URL state (F-01 … F-21, ADR-0002 §2.4). */
export interface Selection {
  entity: EntityView;
  fy: number;
  month: MonthNumber;
  timeView: TimeView;
  base: BaseChoice;
  compareA: CompareChoice;
  compareB: CompareChoice;
  region: string[];
  channel: string[];
  line: string[];
  segment: string[]; // slice codes; [] = all
  currency: ReportingCurrency;
  fxBasis: 'ACT' | 'CC';
  units: 'M' | 'K';
  costSign: 'NEG' | 'POS';
  varianceFormat: 'BOTH' | 'ABS' | 'PCT';
  showPctNr: boolean;
  showFyOutlook: boolean;
  showTags: boolean;
  hideEmpty: boolean;
  layout: 'VAR' | 'TREND_M' | 'TREND_Q' | 'ENTITY';
  costLens: 'FN' | 'NAT';
  detail: 'SUM' | 'STD' | 'FULL';
  breakdown: 'REGION' | 'CHANNEL' | 'LINE' | 'SEGMENT' | 'ENTITY';
  view: 'statement' | 'kpi' | 'analysis' | 'profitability';
}

/** Months of one version that feed a column; `months` are source months (already shifted for prior year). */
export interface PlanPart {
  version: string;
  months: readonly number[];
}

export interface ColumnPlan {
  choice: BaseChoice | 'PY';
  parts: readonly PlanPart[];
  /** Base months this column has no data for (C-04: prior year before the data history). */
  missingMonths: readonly number[];
  /** Source months read from the latest forecast (C-02). */
  forecastMonths: readonly number[];
}

export interface VersionPlan {
  /** Months of the time view, in month index; months before the data history are counted, not listed. */
  window: readonly number[];
  monthsBeforeHistory: number;
  /** Months the base covers after C-01; every comparison uses exactly these (C-03). */
  months: readonly number[];
  /** Window months dropped from an Actual base because they are past the last close (C-01). */
  droppedMonths: readonly number[];
  base: ColumnPlan;
  compareA: ColumnPlan | null;
  compareB: ColumnPlan | null;
  fyBudget: ColumnPlan; // M-14: always the whole fiscal year
  fyLE: ColumnPlan;
}

export type RowKind = 'block' | 'leaf' | 'subtotal' | 'ratio' | 'memo' | 'group_total';

export interface SpineRow {
  code: string; // line_code for spine rows, account_code for leaves
  kind: RowKind;
  label: string; // N-11: from dim_report_line / dim_account
  alias: string | null; // L-11: entity-specific name of a spine line, shown as a secondary label
  parent: string | null;
  level: 0 | 1 | 2;
  tag: string | null; // L-14: IFRS 18 · MPM · Mgmt · IC
  isKey: boolean;
  isCost: boolean; // F-15 / M-25: flipped by "Costs shown as positives" (display only)
}

/** One comparison cell group. `value` null = "n/a" (M-13). Ratio rows: Δ in percentage points, no Δ %. */
export interface Variance {
  value: number | null;
  delta: number | null;
  deltaPct: number | null;
  favourable: boolean | null; // null = no colour (zero Δ, n/a, effective tax rate M-11)
}

export interface StatementRow extends SpineRow {
  base: number | null;
  pctNr: number | null;
  compareA: Variance | null; // null = comparison switched off (NONE)
  compareB: Variance | null;
  fyBudget: number | null;
  fyLE: Variance; // FY Latest estimate with Δ vs FY Budget
}

/** Unrounded, in the reporting currency's whole units; ratios as fractions. Format through format.ts only (D-30). */
export interface StatementResult {
  rows: StatementRow[];
  plan: VersionPlan;
}

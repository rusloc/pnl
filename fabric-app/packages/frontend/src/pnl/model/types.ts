// Domain types for the ACME Unified P&L app (spec docs/Requirements.md).
// Every view renders from these shapes; the data source behind them is
// swappable (sample today, lhraw after ADR-0005).

export type EntityCode = 'P' | 'S' | 'G';
export type OperatingEntity = Exclude<EntityCode, 'G'>;
export type ViewKey = 'pnl' | 'kpi' | 'ana' | 'prof';
export type PanelKey = 'period' | 'compare' | 'slice' | 'display';

export type TimeView = 'month' | 'qtd' | 'ytd' | 'ltm' | 'fy';
export type BaseVersion = 'ACT' | 'LE' | 'BUD';
export type CompareVersion = 'BUD' | 'LE' | 'PY' | 'NONE';
export type Currency = 'USD' | 'EUR' | 'GBP';
export type FxBasis = 'actual' | 'constant';
export type Units = 'm' | 'k';
export type CostSign = 'neg' | 'pos';
export type VarianceFormat = 'both' | 'amount' | 'pct';
export type Layout = 'variance' | 'trend' | 'entity';
export type CostLens = 'function' | 'nature';
export type Detail = 'summary' | 'standard' | 'full';
export type SliceSlot = 'channel' | 'line' | 'segment';
export type Tone = 'fav' | 'unf' | 'neutral';

/** `null` = every value selected (F-08 to F-11 default "All"). */
export type Selection = readonly string[] | null;

export interface SliceSelection {
  channel: Selection;
  line: Selection;
  segment: Selection;
}

export interface FilterState {
  entity: EntityCode;
  // Period (F-02 to F-04)
  fiscalYear: number;
  month: number;
  timeView: TimeView;
  // Versions (F-05 to F-07)
  baseVersion: BaseVersion;
  compareA: CompareVersion;
  compareB: CompareVersion;
  // Slice (F-08 to F-11); slices are remembered per operating entity (F-30)
  regions: Selection;
  slices: Record<OperatingEntity, SliceSelection>;
  // Display (F-12 to F-17)
  currency: Currency;
  fxBasis: FxBasis;
  units: Units;
  costSign: CostSign;
  varianceFormat: VarianceFormat;
  showPctNr: boolean;
  showFyOutlook: boolean;
  showTags: boolean;
  hideEmpty: boolean;
  // Statement toolbar (F-18 to F-20)
  layout: Layout;
  costLens: CostLens;
  detail: Detail;
  // Analysis / profitability toolbars (C-45, F-21)
  analysisCompare: 'BUD' | 'PY';
  breakdown: Record<EntityCode, number>;
}

// ---------------------------------------------------------------------------
// Reference data (dims) — real through lhraw, sample fallback offline.

export interface EntityRef {
  code: EntityCode;
  name: string;
  shortName: string;
}

export interface MonthRef {
  key: string;
  monthIndex: number;
  fiscalYear: number;
  monthNumber: number;
  monthName: string;
  isClosed: boolean;
}

export interface VersionRef {
  key: string;
  code: string;
  name: string;
  isLatestForecast: boolean;
}

export interface RegionRef {
  code: string;
  name: string;
  currency: string;
}

export interface SliceValue {
  code: string;
  name: string;
}

export interface SliceSet {
  label: string;
  values: SliceValue[];
}

export interface ReferenceData {
  source: 'lhraw' | 'sample';
  entities: EntityRef[];
  months: MonthRef[];
  /** Last month with is_closed = TRUE (N-03). */
  lastClosed: MonthRef;
  versions: VersionRef[];
  regions: RegionRef[];
  slices: Record<OperatingEntity, Record<SliceSlot, SliceSet>>;
  /** Row counts of the reference tables that were read, for the probe view. */
  counts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Figures (numbers) — sample today, lhraw after ADR-0005.

export type RowKind = 'sec' | 'grp' | 'leaf' | 'ent' | 'sub' | 'memo' | 'key' | 'ratio';

/**
 * One statement row in the Variance layout (spec §4). Amount columns are in
 * reporting-currency millions; ratio rows hold percentages (49.4 = 49.4 %)
 * and their deltas in percentage points (M-11). `null` = no value (M-13).
 */
export interface StatementValues {
  base: number | null;
  pctNr: number | null;
  cmpA: number | null;
  dA: number | null;
  dApct: number | null;
  cmpB: number | null;
  dB: number | null;
  dBpct: number | null;
  fyBud: number | null;
  fyLe: number | null;
  fyD: number | null;
}

export interface StatementRow {
  code: string;
  parent: string | null;
  kind: RowKind;
  label: string;
  alias: string;
  tags: string[];
  values: StatementValues;
  /** Δ % vs Compare A on the ±15 % scale, clamped to [−1, 1]; null = no bar. */
  barFraction: number | null;
  /** Rows whose Δ never carries favourable/unfavourable colour (ETR, M-11). */
  neutralDelta: boolean;
}

export interface KpiDelta {
  name: string;
  text: string;
  tone: Tone;
  arrow: boolean;
}

export interface KpiTile {
  label: string;
  hint: string;
  value: string;
  deltas: KpiDelta[];
}

export interface BridgeStep {
  label: string;
  valueText: string;
  kind: 'total' | 'fav' | 'unf';
  bottomPct: number;
  heightPct: number;
}

export interface Bridge {
  subtitle: string;
  steps: BridgeStep[];
  axisText: string;
}

export interface Driver {
  name: string;
  block: string;
  delta: number;
  deltaText: string;
  deltaPctText: string;
  tone: Tone;
}

export interface ProfitabilityRow {
  name: string;
  nrText: string;
  shareText: string;
  sharePct: number;
  deltaPctText: string;
  tone: Tone;
  gm: string;
  cm: string;
  ebitda: string;
  op: string;
}

export interface Profitability {
  by: string;
  column: string;
  options: string[];
  note: string;
  rows: ProfitabilityRow[];
  cmAverageText: string;
  cmAveragePct: number;
}

/** A zone whose numbers were read from the semantic model (ADR-0006). */
export interface LiveStatement {
  source: 'semantic model';
  requestId: string;
}

export interface Figures {
  /** True when the numbers are illustrative (mockup) rather than read from lh_raw. */
  sample: boolean;
  /**
   * Set when `statement` came from the semantic model (ADR-0006 phase 1) while
   * the other zones are still sample. Absent on an all-sample or all-live result.
   */
  liveStatement?: LiveStatement;
  /** Set when the model read failed and `statement` fell back to the sample rows. */
  liveFallbackReason?: string;
  notices: string[];
  sliceSummary: string;
  statement: StatementRow[];
  financial: KpiTile[];
  operational: KpiTile[];
  bridge: Bridge;
  drivers: Driver[];
  profitability: Profitability;
}

export interface ReferenceLoadResult {
  reference: ReferenceData;
  /** Set when the real source could not be read and a fallback was used. */
  fallbackReason?: string;
}

/** The one interface the views depend on. Swap the implementation, not the UI. */
export interface PnlDataSource {
  loadReference(): Promise<ReferenceLoadResult>;
  loadFigures(filter: FilterState, reference: ReferenceData): Promise<Figures>;
}

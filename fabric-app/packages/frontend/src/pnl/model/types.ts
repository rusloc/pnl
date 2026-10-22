// Domain types for the ACME Unified P&L app (spec docs/Requirements.md).
// Every view renders from these shapes; the data source behind them is
// swappable (the semantic model when deployed, ADR-0006; sample offline).

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
  // Analysis / profitability toolbars (C-45, F-21). The statement has one
  // layout (Variance) and one cost lens (By function); its expansion state is
  // view state, not a filter (M-20, M-21; ADR-0007).
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
  /**
   * Operating entities the signed-in user can see in the semantic model (Q0,
   * ADR-0006 §8.2: RLS probe). The Group view needs both. Absent when the model
   * could not be asked (offline), in which case nothing is gated on it.
   */
  visibleEntities?: OperatingEntity[];
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
// Figures (numbers) — from the semantic model zone by zone (ADR-0006 phase 2);
// the sample figures remain the offline fallback.

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

/** A tick on the target bar (K-25): one comparison's value, named. */
export interface KpiTargetMark {
  name: string;
  value: number | null;
  /** The value in the tile's own format ('' when blank), for the description. */
  text: string;
}

/** Target bar inputs (K-25): the base value as the bar, the comparisons as ticks. */
export interface KpiTarget {
  base: number | null;
  marks: KpiTargetMark[];
}

export interface KpiTile {
  /** Key of the tile's trend in `Figures.trends` (the model's kpi_code when live). */
  code: string;
  label: string;
  hint: string;
  value: string;
  deltas: KpiDelta[];
  /** Null on growth KPIs and tiles without a comparison: sparkline only (K-25). */
  target: KpiTarget | null;
}

/** One month of a KPI's 13-month series (K-24). `value` null = blank (open month or no data). */
export interface KpiTrendPoint {
  /** Month key `YYYY-MM`. */
  month: string;
  value: number | null;
  /** The value in the tile's own format ('' when blank), for descriptions and tooltips. */
  text: string;
  /** Open (not closed) Actual month: plotted blank. */
  isOpen: boolean;
}

/** The KPI's monthly value for the 13 months ending at the selected month (K-24); the last point is the selected month. */
export interface KpiTrend {
  code: string;
  points: KpiTrendPoint[];
}

/**
 * Where a tile's trend stands. Trends load after the tile values (K-25) and
 * each settles on its own; `unavailable` names the reason instead of showing
 * numbers that were not read (LSN-002).
 */
export type KpiTrendState =
  | { kind: 'loading' }
  | { kind: 'ready'; trend: KpiTrend }
  | { kind: 'unavailable'; reason: string };

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
  /** Short name of the comparison behind "vs …" (C-46: the bridge comparison). */
  compareLabel: string;
  note: string;
  rows: ProfitabilityRow[];
  cmAverageText: string;
  cmAveragePct: number;
}

/** The zones of the one-window layout, each read by its own model query (ADR-0006 §8). */
export type ZoneKey = 'statement' | 'kpi' | 'bridge' | 'drivers' | 'profitability' | 'context';

/**
 * Where a zone's numbers stand. `sample` = illustrative mockup figures (offline
 * only); `loading` = the model query is in flight; `live` = read from the
 * semantic model; `error` = the model could not answer, and the zone shows the
 * reason rather than numbers that would not match the filters (LSN-002).
 */
export type ZoneStatus =
  | { kind: 'sample' }
  | { kind: 'loading' }
  | { kind: 'live'; requestId: string }
  | { kind: 'error'; reason: string; requestId?: string };

export interface Figures {
  /** True when every zone is illustrative (mockup) because no backend could be reached. */
  sample: boolean;
  zones: Record<ZoneKey, ZoneStatus>;
  /** Notices (C-50): the model's `Notices` when live, the mockup's when sample. */
  notices: string[];
  /** Header data status (N-02): last closed month and refresh time, from the model when live. */
  dataStatus: string | null;
  statement: StatementRow[];
  financial: KpiTile[];
  operational: KpiTile[];
  /** Per-tile trends by `KpiTile.code`; a tile with no entry is still loading (K-24, K-25). */
  trends: Record<string, KpiTrendState>;
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
  /**
   * Figures for a filter state. A source that reads zones independently calls
   * `onUpdate` with a fresh snapshot each time a zone settles (zones still in
   * flight are `loading`); the returned promise resolves with the final snapshot.
   */
  loadFigures(filter: FilterState, reference: ReferenceData, onUpdate?: (figures: Figures) => void): Promise<Figures>;
}

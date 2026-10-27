// Domain types for the ACME Unified P&L app (spec docs/Requirements.md).
// Every view renders from these shapes; the data source behind them is
// swappable (the semantic model when deployed, ADR-0006; sample offline).

export type EntityCode = 'P' | 'S' | 'G';
export type OperatingEntity = Exclude<EntityCode, 'G'>;
/** `kpi` is the Vitals view (formerly Key figures; the state key stays, redesign v4). */
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
/** Largest-variances cut (Analysis page 2, `param_var_cut`): Total, or one slice dimension; Entity in the Group view only. */
export type VarCut = 'none' | 'region' | 'channel' | 'line' | 'segment' | 'entity';

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
  // Profitability toolbar (F-21). The analysis zones follow the C-40 comparison
  // (Compare A, else B, else Prior year; parity rule 1), no toggle of their own.
  // The statement has one layout (Variance) and one cost lens (By function); its
  // expansion state is view state, not a filter (M-20, M-21; ADR-0007).
  breakdown: Record<EntityCode, number>;
  /** Largest-variances cut (Analysis page 2); a query input like `breakdown`, so it lives here. */
  varCut: VarCut;
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

// --- ⓘ pop-ups (ADR-0012 §2.3, parity rule 18) --------------------------------

/** One ⓘ pop-up: name, what it shows, the formula, sub-metrics with values, the source measures (grey). */
export interface InfoCopy {
  title: string;
  what: string;
  formula: string | null;
  /** Sub-metrics as "label: value" rows, filled from the zone's numbers. */
  values: { label: string; value: string }[];
  /** Track B measure names / spec IDs, as in the design's INFO `s` field. */
  source: string | null;
}

// --- Vitals (redesign v4, build-brief §1; formerly Key figures) ----------------

/** The model's `_KPI Status` values (spec KPI §6 thresholds, `param_kpi_threshold`). */
export type StatusKind = 'neutral' | 'ontrack' | 'ahead' | 'watch' | 'off';

/** Colour of a Δ row or dot: ahead (green), watch (amber), off (orange), plan (on track, grey), neutral (ink). */
export type DeltaTone = 'ahead' | 'watch' | 'off' | 'plan' | 'neutral';

/** "vs Budget  +9.2  +1.4%" on a Vitals card; `abs` is null on ratio KPIs, `rel` is "on plan" for a zero Δ (spec KPI §4). */
export interface DeltaRow {
  name: string;
  abs: string | null;
  rel: string;
  tone: DeltaTone;
}

/** The status chip: the model's `KPI Status` word (never colour alone, N-07). */
export interface StatusChip {
  kind: Exclude<StatusKind, 'neutral'>;
  text: string;
}

export interface VitalsCard {
  code: string;
  label: string;
  tier: 'hero' | 'secondary' | 'driver';
  value: string;
  rows: DeltaRow[];
  status: StatusChip | null;
  info: InfoCopy;
}

export interface VitalsZone {
  /** 3 heroes then 2 secondary (`dim_kpi[vitals_slot]` 1–5). */
  results: VitalsCard[];
  /** 5 drivers, content swaps by company (slots 6–10, L-10). */
  drivers: VitalsCard[];
}

// --- Bridges (C-40, redesign v4) ------------------------------------------------

/** total = start / end level (company colour), subtotal = constant-currency NR / Adj. EBITDA (ink), fx = hatched, level = D&A / adjusting items drawn as a level step (slate). */
export type BridgeKind = 'total' | 'subtotal' | 'fav' | 'unf' | 'fx' | 'level';

export interface BridgeStep {
  label: string;
  valueText: string;
  kind: BridgeKind;
  bottomPct: number;
  heightPct: number;
  /** Small label under the value: step % of the comparison, or a level's Δ vs the comparison. */
  sub: string | null;
}

export interface Bridge {
  subtitle: string;
  steps: BridgeStep[];
  axisText: string;
  info: InfoCopy;
}

/** Largest-variances row for the AI assistant (ADR-0009): the top 8 leaves of the variances zone. */
export interface Driver {
  name: string;
  block: string;
  delta: number;
  deltaText: string;
  deltaPctText: string;
  tone: Tone;
}

// --- Largest variances (C-45, redesign v4) -------------------------------------

/** One leaf line to operating profit, as the model returns it (pinned units); the view model ranks and groups client-side (`model/variances.ts`). */
export interface VarianceLeaf {
  /** `dim_pl_row[row_key]` = "<block>|<account>". */
  rowKey: string;
  code: string;
  label: string;
  block: string;
  blockName: string;
  lineSort: number;
  accountSort: number;
  base: number | null;
  comparison: number | null;
  /** Δ vs Compare B (`LV Δ B`); null when Compare B is None or both sides blank. */
  deltaB: number | null;
  /** Of which FX (`LV FX`). */
  fx: number | null;
  /** `dim_account[is_below_cm]`: allocated by NR share when cut by anything but Region / Entity (C-31). */
  belowCm: boolean;
}

export interface VariancesZone {
  leaves: VarianceLeaf[];
}

/** Member deltas of the selected cut: per leaf rowKey, Δ per member key. */
export interface VarianceMembers {
  cut: VarCut;
  members: { key: string; label: string }[];
  deltas: Record<string, Record<string, number>>;
}

// --- Profitability (C-46, redesign v4) -----------------------------------------

export interface ProfRow {
  key: string;
  name: string;
  nrText: string;
  /** Plain text: CM Δ is the table's only status indicator (PV-13). */
  nrDeltaText: string;
  gm: string;
  cm: string;
  cmDeltaText: string;
  /** The only status dot of the table (`_Prof CM Status`). */
  cmStatus: StatusKind;
  contributionText: string;
  ebitdaText: string;
  total: boolean;
}

export interface Profitability {
  /** Lower-case breakdown name ("region", "channel", …). */
  by: string;
  /** Column header for the member names ("Region", "Sales motion", …). */
  column: string;
  options: string[];
  /** Short name of the comparison behind "vs …" (C-46: the bridge comparison). */
  compareLabel: string;
  /** Built from the selection (parity rule 13), Track B's `Prof Subtitle CC` wording. */
  subtitle: string;
  /** True when the breakdown is not Region / Company: EBITDA is allocated by NR share (C-31). */
  allocated: boolean;
  rows: ProfRow[];
  info: InfoCopy;
}

export interface ConcentrationLevel {
  code: string;
  label: string;
  segments: { key: string; label: string; share: number; text: string }[];
}

export interface Concentration {
  levels: ConcentrationLevel[];
  legend: { key: string; label: string; drift: string }[];
  info: InfoCopy;
}

export interface BubblePoint {
  key: string;
  label: string;
  /** NR growth vs prior year at constant currency (fraction). */
  x: number;
  /** CM % (fraction). */
  y: number;
  /** NR in the pinned units. */
  size: number;
  text: string;
  detail: string;
  /** Prior-year position; null until the model publishes a prior-year growth measure (C-04). */
  trail: { x: number; y: number } | null;
}

export interface Bubble {
  points: BubblePoint[];
  ref: { x: number; y: number; xText: string; yText: string } | null;
  quadrants: [string, string, string, string];
  info: InfoCopy;
}

export interface HeatCell {
  text: string;
  share: string;
  /** GM % of the cell (fraction), for the hover detail; null = blank cell. */
  gm: number | null;
  detail: string;
}

export interface Heat {
  rows: { key: string; label: string; cells: HeatCell[]; total: string }[];
  /** `gm` = the column's GM % (fraction) drives the cell fill (PV-03). */
  cols: { key: string; label: string; gm: number | null; gmText: string; total: string }[];
  grand: string;
  info: InfoCopy;
}

/** The zones of the one-window layout, each read by its own model query (ADR-0006 §8). */
export type ZoneKey =
  | 'statement'
  | 'vitals'
  | 'vitalsInfo'
  | 'bridge'
  | 'profit'
  | 'variances'
  | 'variancesCut'
  | 'profitability'
  | 'concentration'
  | 'bubble'
  | 'heat'
  | 'context';

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
  /** The model's last refresh (`_meta_refresh[refreshed_at]`, ISO-like text) when live; null otherwise. */
  refreshedAt: string | null;
  statement: StatementRow[];
  vitals: VitalsZone;
  /** `KPI Info Sub` per kpi_code: the sub-metrics line of a card's ⓘ. */
  vitalsInfo: Record<string, string>;
  bridge: Bridge;
  profit: Bridge;
  variances: VariancesZone;
  variancesCut: VarianceMembers | null;
  /** Top 8 variances for the AI assistant, derived from `variances`. */
  drivers: Driver[];
  profitability: Profitability;
  concentration: Concentration;
  bubble: Bubble;
  heat: Heat;
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

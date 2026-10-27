// Filter state and its rules (spec §6: F-01 to F-36; T-14, T-15).
import type {
  CompareVersion,
  EntityCode,
  FilterState,
  OperatingEntity,
  ReferenceData,
  Selection,
  SliceSelection,
  SliceSlot,
  VarCut,
} from './types';

export const SLICE_SLOTS: readonly SliceSlot[] = ['channel', 'line', 'segment'];

const ALL_SLICES: SliceSelection = { channel: null, line: null, segment: null };

/** Spec §6 defaults. The anchor month comes from dim_month.is_closed (N-03). */
export function defaultFilters(reference: Pick<ReferenceData, 'lastClosed'>): FilterState {
  return {
    entity: 'P',
    fiscalYear: reference.lastClosed.fiscalYear,
    month: reference.lastClosed.monthNumber,
    timeView: 'ytd',
    baseVersion: 'ACT',
    compareA: 'BUD',
    compareB: 'PY',
    regions: null,
    slices: { P: ALL_SLICES, S: ALL_SLICES },
    currency: 'USD',
    fxBasis: 'actual',
    units: 'm',
    costSign: 'neg',
    varianceFormat: 'both',
    showPctNr: true,
    showFyOutlook: true,
    showTags: true,
    hideEmpty: true,
    // Profitability breakdown opens on Region for every company (F-21, ADR-0007 §3a; parity rule 4).
    breakdown: { P: 0, S: 0, G: 0 },
    varCut: 'none',
  };
}

/** Largest-variances cuts per entity (`param_var_cut`): Total, Region, the company's three slice slots; Group: Total, Region, Entity. */
export function varCutsFor(entity: EntityCode): readonly VarCut[] {
  return entity === 'G' ? ['none', 'region', 'entity'] : ['none', 'region', 'channel', 'line', 'segment'];
}

/** Cut labels for the toolbar: slice slots carry the company's own names (L-10). */
export function varCutLabel(cut: VarCut, entity: EntityCode, reference: Pick<ReferenceData, 'slices'>): string {
  switch (cut) {
    case 'none':
      return 'Total';
    case 'region':
      return 'Region';
    case 'entity':
      return 'Entity';
    default:
      return reference.slices[entity === 'G' ? 'P' : entity][cut].label;
  }
}

export type FilterPatch = Partial<Omit<FilterState, 'entity' | 'slices' | 'regions' | 'breakdown' | 'varCut'>>;

export type FilterAction =
  | { type: 'entity'; entity: EntityCode }
  | { type: 'set'; patch: FilterPatch }
  | { type: 'toggleRegion'; code: string; all: readonly string[] }
  | { type: 'toggleSlice'; slot: SliceSlot; code: string; all: readonly string[] }
  | { type: 'breakdown'; index: number }
  | { type: 'varCut'; cut: VarCut }
  | { type: 'resetGroup'; group: 'period' | 'compare' | 'slice' | 'display'; defaults: FilterState }
  /** The AI chat's "Open in view" (ADR-0009): a whole state the tool validator already checked. */
  | { type: 'replace'; state: FilterState };

/**
 * Multi-select toggle (F-33): never empty — the last selected value stays on;
 * a selection equal to the full set collapses back to `null` ("All").
 */
export function toggleSelection(current: Selection, code: string, all: readonly string[]): Selection {
  const selected = new Set(current ?? all);
  if (selected.has(code)) {
    if (selected.size === 1) return current;
    selected.delete(code);
  } else {
    selected.add(code);
  }
  if (selected.size === all.length && all.every((c) => selected.has(c))) return null;
  return all.filter((c) => selected.has(c));
}

export function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'entity': {
      if (action.entity === state.entity) return state;
      // F-31: period, versions, currency, region and display carry across;
      // F-30: each entity's own slices are kept in `slices` untouched.
      // A cut the new company does not offer (Entity outside the Group view, a slice slot in it) falls back to Total.
      const varCut = varCutsFor(action.entity).includes(state.varCut) ? state.varCut : 'none';
      return { ...state, entity: action.entity, varCut };
    }
    case 'set':
      return { ...state, ...action.patch };
    case 'toggleRegion':
      return { ...state, regions: toggleSelection(state.regions, action.code, action.all) };
    case 'toggleSlice': {
      // F-32: slices are off in the Group view.
      if (state.entity === 'G') return state;
      const entity: OperatingEntity = state.entity;
      const current = state.slices[entity];
      const next = toggleSelection(current[action.slot], action.code, action.all);
      if (next === current[action.slot]) return state;
      return {
        ...state,
        slices: { ...state.slices, [entity]: { ...current, [action.slot]: next } },
      };
    }
    case 'breakdown':
      return { ...state, breakdown: { ...state.breakdown, [state.entity]: action.index } };
    case 'varCut':
      return varCutsFor(state.entity).includes(action.cut) ? { ...state, varCut: action.cut } : state;
    case 'replace':
      return action.state;
    case 'resetGroup': {
      // F-35: reset restores the defaults of one group, keeping the entity.
      const d = action.defaults;
      switch (action.group) {
        case 'period':
          return { ...state, fiscalYear: d.fiscalYear, month: d.month, timeView: d.timeView };
        case 'compare':
          return {
            ...state,
            baseVersion: d.baseVersion,
            compareA: d.compareA,
            compareB: d.compareB,
          };
        case 'slice':
          return state.entity === 'G'
            ? { ...state, regions: null }
            : { ...state, regions: null, slices: { ...state.slices, [state.entity]: ALL_SLICES } };
        case 'display':
          return {
            ...state,
            currency: d.currency,
            fxBasis: d.fxBasis,
            units: d.units,
            costSign: d.costSign,
            varianceFormat: d.varianceFormat,
            showPctNr: d.showPctNr,
            showFyOutlook: d.showFyOutlook,
            showTags: d.showTags,
            hideEmpty: d.hideEmpty,
          };
      }
    }
  }
  return state;
}

/** Slices that apply to the current entity (empty in the Group view, F-32). */
export function activeSlices(state: FilterState): SliceSelection | null {
  return state.entity === 'G' ? null : state.slices[state.entity];
}

/** True when any region or slice filter narrows the data (F-36, C-31). */
export function hasSliceFilter(state: FilterState): boolean {
  if (state.regions !== null) return true;
  const slices = activeSlices(state);
  return slices !== null && SLICE_SLOTS.some((slot) => slices[slot] !== null);
}

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export const VERSION_LABEL: Record<Exclude<FilterState['compareA'], 'NONE'> | 'ACT', string> = {
  ACT: 'Actual',
  LE: 'Latest estimate',
  BUD: 'Budget',
  PY: 'Prior year',
};

export const VERSION_SHORT: Record<Exclude<FilterState['compareA'], 'NONE'> | 'ACT', string> = {
  ACT: 'Actual',
  LE: 'Latest est.',
  BUD: 'Budget',
  PY: 'Prior year',
};

/** "YTD Sep 2026", "Sep 2026", "Q3 2026", "LTM Sep 2026", "FY2026" */
export function windowLabel(state: FilterState, long = false): string {
  const m = MONTH_SHORT[state.month - 1];
  const y = state.fiscalYear;
  switch (state.timeView) {
    case 'month':
      return `${m} ${y}`;
    case 'qtd':
      return `Q${Math.ceil(state.month / 3)} ${y}`;
    case 'ytd':
      return long ? `YTD Jan–${m} ${y}` : `YTD ${m} ${y}`;
    case 'ltm':
      return `LTM ${m} ${y}`;
    case 'fy':
      return `FY${y}`;
  }
}

/**
 * The comparison the analysis zones and Profitability's "vs …" use (C-40, parity
 * rule 1): Compare A, else Compare B, else Prior year — the model's bridge rule.
 */
export function bridgeComparison(state: Pick<FilterState, 'compareA' | 'compareB'>): Exclude<CompareVersion, 'NONE'> {
  if (state.compareA !== 'NONE') return state.compareA;
  if (state.compareB !== 'NONE') return state.compareB;
  return 'PY';
}

/** `{comparison}` of the info pop-ups (parity rule 16): the full name, lower case ("from budget", "from latest estimate"). */
export function comparisonText(version: Exclude<CompareVersion, 'NONE'>): string {
  return VERSION_LABEL[version].toLowerCase();
}

/**
 * The window part of a statement column-group title, as Track B's `PL Hdr Base`
 * writes it (parity rule 12): "YTD Sep 2026", "QTD Sep 2026", "LTM Sep 2026",
 * "Sep 2026", "Full year 2026".
 */
export function windowTitle(state: Pick<FilterState, 'fiscalYear' | 'month' | 'timeView'>): string {
  const anchor = `${MONTH_SHORT[state.month - 1]} ${state.fiscalYear}`;
  switch (state.timeView) {
    case 'month':
      return anchor;
    case 'fy':
      return `Full year ${state.fiscalYear}`;
    default:
      return `${state.timeView.toUpperCase()} ${anchor}`;
  }
}

/** Key figures caption, Track B's `Kpi Toolbar Caption` (parity rule 13): "Changes vs Budget and Prior year, same months". */
export function kpiCaption(state: Pick<FilterState, 'compareA' | 'compareB'>): string {
  const names = [state.compareA, state.compareB]
    .filter((c): c is Exclude<CompareVersion, 'NONE'> => c !== 'NONE')
    .map((c) => VERSION_LABEL[c]);
  if (names.length === 0) return 'No comparison selected';
  return `Changes vs ${names.join(' and ')}, same months`;
}

/**
 * Statement footnote built from the selection (parity rule 13; Track B's
 * `pl_footnote` wording, " - " separated): rates, cost sign, Δ convention, the
 * bar column's comparison when there is one, the tag legend when tags show.
 */
export function statementFootnote(
  state: Pick<FilterState, 'fiscalYear' | 'fxBasis' | 'costSign' | 'compareA' | 'showTags'>
): string {
  const parts = [
    state.fxBasis === 'constant' ? `Constant currency at FY${state.fiscalYear} budget rates` : 'Actual at average rates, budget at budget rates',
    state.costSign === 'pos' ? 'costs shown positive' : 'costs negative',
    'Δ positive when favourable',
  ];
  if (state.compareA !== 'NONE') parts.push(`bars in Δ % vs ${VERSION_LABEL[state.compareA]} on a ±15% scale`);
  if (state.showTags) parts.push('IFRS 18 required subtotal', 'MPM management-defined measure', 'Mgmt management subtotal', 'IC intercompany');
  return parts.join(' - ');
}

/** Rail summaries (§5.1, Track B's `Rail Sum *` wording); the period line is the picker's summary sentence (`model/period.ts`). */
export function railSummaries(state: FilterState, sliceSummary: string, periodText: string) {
  const compares = [state.compareA, state.compareB]
    .filter((c): c is Exclude<FilterState['compareA'], 'NONE'> => c !== 'NONE')
    .map((c) => VERSION_LABEL[c]);
  return {
    period: periodText,
    compare:
      compares.length === 0
        ? `${VERSION_LABEL[state.baseVersion]} only`
        : `${VERSION_LABEL[state.baseVersion]} vs ${compares.join(', ')}`,
    slice: sliceSummary,
    display: `${state.currency} ${state.units} - ${state.fxBasis === 'actual' ? 'actual rates' : 'constant currency'}`,
  };
}

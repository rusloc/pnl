// Filter state and its rules (spec §6: F-01 to F-36; T-14, T-15).
import type {
  EntityCode,
  FilterState,
  OperatingEntity,
  ReferenceData,
  Selection,
  SliceSelection,
  SliceSlot,
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
    layout: 'variance',
    costLens: 'function',
    detail: 'standard',
    analysisCompare: 'BUD',
    breakdown: { P: 1, S: 1, G: 1 },
  };
}

export type FilterPatch = Partial<Omit<FilterState, 'entity' | 'slices' | 'regions' | 'breakdown'>>;

export type FilterAction =
  | { type: 'entity'; entity: EntityCode }
  | { type: 'set'; patch: FilterPatch }
  | { type: 'toggleRegion'; code: string; all: readonly string[] }
  | { type: 'toggleSlice'; slot: SliceSlot; code: string; all: readonly string[] }
  | { type: 'breakdown'; index: number }
  | { type: 'resetGroup'; group: 'period' | 'compare' | 'slice' | 'display'; defaults: FilterState };

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
      // F-30: each entity's own slices are kept in `slices` untouched;
      // F-18: Entity columns exists only in the Group view.
      const layout =
        action.entity === 'G'
          ? state.layout
          : state.layout === 'entity'
            ? 'variance'
            : state.layout;
      return { ...state, entity: action.entity, layout };
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

export const TIME_VIEW_LABEL: Record<FilterState['timeView'], string> = {
  month: 'Month',
  qtd: 'QTD',
  ytd: 'YTD',
  ltm: 'LTM',
  fy: 'FY',
};

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

/** Context line (L-04): window · versions · currency/units/FX · slices. */
export function contextLine(state: FilterState, sliceSummary: string): string {
  const compares = [state.compareA, state.compareB]
    .filter((c): c is Exclude<FilterState['compareA'], 'NONE'> => c !== 'NONE')
    .map((c) => VERSION_LABEL[c]);
  const versions =
    compares.length === 0
      ? VERSION_LABEL[state.baseVersion]
      : `${VERSION_LABEL[state.baseVersion]} vs ${compares.join(' and ')}`;
  const fx = state.fxBasis === 'actual' ? 'actual rates' : 'constant currency';
  return `${windowLabel(state, true)} · ${versions} · ${state.currency} ${state.units}, ${fx} · ${sliceSummary}`;
}

/** Rail summaries (§5.1). */
export function railSummaries(state: FilterState, sliceSummary: string) {
  const compares = [state.compareA, state.compareB]
    .filter((c): c is Exclude<FilterState['compareA'], 'NONE'> => c !== 'NONE')
    .map((c) => VERSION_LABEL[c]);
  return {
    period: `${TIME_VIEW_LABEL[state.timeView]} · ${MONTH_SHORT[state.month - 1]} ${state.fiscalYear}`,
    compare:
      compares.length === 0
        ? VERSION_LABEL[state.baseVersion]
        : `${VERSION_LABEL[state.baseVersion]} vs ${compares.join(', ')}`,
    slice: sliceSummary,
    display: `${state.currency} ${state.units} · ${state.fxBasis === 'actual' ? 'actual rates' : 'constant currency'}`,
  };
}

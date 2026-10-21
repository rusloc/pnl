// Slice summary text for the rail, the context line (L-04, F-36) and the
// allocation notice (C-31, C-50).
import { activeSlices, SLICE_SLOTS } from './filters';
import type { FilterState, ReferenceData } from './types';

export function sliceSummary(state: FilterState, reference: ReferenceData): string {
  const parts: string[] = [];
  if (state.regions !== null) {
    parts.push(`${state.regions.length} of ${reference.regions.length} regions`);
  }
  const slices = activeSlices(state);
  if (slices && state.entity !== 'G') {
    const sets = reference.slices[state.entity];
    for (const slot of SLICE_SLOTS) {
      const sel = slices[slot];
      if (sel !== null) {
        parts.push(`${sel.length} of ${sets[slot].values.length} ${sets[slot].label.toLowerCase()}`);
      }
    }
  }
  if (parts.length === 0) return state.entity === 'G' ? 'All regions, consolidated' : 'All slices';
  return parts.join(' · ');
}

/** Notices computed from the filter state (C-50); figure notices are added by the source. */
export function filterNotices(state: FilterState, reference: ReferenceData): string[] {
  const out: string[] = [];
  const selectedKey = `${state.fiscalYear}-${String(state.month).padStart(2, '0')}`;
  if (state.baseVersion === 'ACT' && selectedKey > reference.lastClosed.key) {
    out.push(
      `Actual stops at ${reference.lastClosed.monthName} ${reference.lastClosed.fiscalYear}, the last closed month; later months are dropped and comparisons use the same months. Choose Latest estimate to include the forecast.`
    );
  }
  const slices = activeSlices(state);
  const sliceOn = slices !== null && SLICE_SLOTS.some((slot) => slices[slot] !== null);
  if (sliceOn) {
    out.push(
      'A slice filter is on: lines below contribution margin are allocated by net revenue share and tagged alloc.'
    );
  }
  return out;
}

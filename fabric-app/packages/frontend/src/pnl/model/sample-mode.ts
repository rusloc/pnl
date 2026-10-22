// Honest sample mode (LSN-002): while `figures.sample` is true the numbers are
// fixed at "YTD Sep 2026 · Actual vs Budget and Prior year · USD m" whatever the
// filters say, so every control that would re-label them (F-34 says each filter
// applies to every zone; the sample path honours none of them) is switched off
// with this reason, and the notice strip says so once. Sample figures appear
// only when no backend can be reached (rayfin dev, tests); deployed, every zone
// is live from the semantic model (ADR-0006) and nothing here applies.

/** Chip detail: the one caveat every view's "Sample data" chip carries. */
export const SAMPLE_FIGURES_DETAIL = 'YTD Sep 2026, Actual vs Budget and Prior year, whatever the filters say';

/** Notice-strip line (L-05) listing the filters the sample figures ignore. */
export const SAMPLE_FIGURES_NOTICE =
  'Sample figures (YTD Sep 2026, Actual vs Budget and Prior year, USD m) don’t respond to period, versions, slices, currency, FX basis or breakdown; those controls are off because the semantic model could not be reached.';

/** Reason on every switched-off control (`title`) and the in-panel note they are described by. */
export const SAMPLE_INERT_REASON = 'Off while sample figures are shown: they are fixed at YTD Sep 2026, Actual vs Budget and Prior year, USD m.';

/** Display controls that the sample path only honours in the statement. */
export const SAMPLE_STATEMENT_ONLY_NOTE = 'While sample figures are shown, units, costs shown and variance format apply to the P&L statement only.';

/** The window the sample figures are fixed at, for headings over sample numbers (LSN-002). */
export const SAMPLE_WINDOW_LONG = 'YTD Jan–Sep 2026';

// Live zones (ADR-0006 phase 2): copy for the per-zone states.

/** Chip detail on a live zone. */
export const LIVE_ZONE_DETAIL = 'follows every filter';

/** Loading line while a zone's model query is in flight. */
export function zoneLoadingText(what: string): string {
  return `Reading ${what} from the semantic model…`;
}

/** Error line when the model could not answer a zone (its numbers are not shown). */
export function zoneErrorText(what: string, reason: string): string {
  return `The ${what} could not be read from the semantic model: ${reason}`;
}

// KPI trends (K-24, K-25; ADR-0007): copy for the per-tile trend states.

/** Shown in the trend area while a tile's 13-month series is in flight. */
export const TREND_LOADING_TEXT = 'Trend loading…';

/** Shown in the trend area when the series could not be read; the reason is on the element's title. */
export const TREND_UNAVAILABLE_TEXT = 'Trend not available';

/** Reason on sample figures: there is no model to read a series from. */
export const TREND_SAMPLE_REASON = 'No semantic model could be reached; sample figures carry no monthly series.';

/** Structural twin of the segmented control's option (model stays free of component imports). */
interface GatedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

/** Marks every option disabled with the sample reason while `sample` is true. */
export function sampleGate<T extends string>(options: readonly GatedOption<T>[], sample: boolean): readonly GatedOption<T>[] {
  if (!sample) return options;
  return options.map((o) => ({ ...o, disabled: true, title: SAMPLE_INERT_REASON }));
}

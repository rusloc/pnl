// Honest sample mode (LSN-002): while `figures.sample` is true the numbers are
// fixed at "YTD Sep 2026 · Actual vs Budget and Prior year · USD m" whatever the
// filters say, so every control that would re-label them (F-34 says each filter
// applies to every zone; the sample path honours none of them) is switched off
// with this reason, and the notice strip says so once. Everything here goes
// away when the lhraw figures source lands (ADR-0005).

/** Chip detail: the one caveat every view's "Sample data" chip carries. */
export const SAMPLE_FIGURES_DETAIL = 'YTD Sep 2026, Actual vs Budget and Prior year, whatever the filters say';

/** Notice-strip line (L-05) listing the filters the sample figures ignore. */
export const SAMPLE_FIGURES_NOTICE =
  'Sample figures (YTD Sep 2026, Actual vs Budget and Prior year, USD m) don’t respond to period, versions, slices, currency, FX basis or breakdown yet; those controls are off until live figures land.';

/** Reason on every switched-off control (`title`) and the in-panel note they are described by. */
export const SAMPLE_INERT_REASON = 'Off while sample figures are shown: they are fixed at YTD Sep 2026, Actual vs Budget and Prior year, USD m.';

/** Display controls that the sample path only honours in the statement. */
export const SAMPLE_STATEMENT_ONLY_NOTE = 'While sample figures are shown, units, costs shown and variance format apply to the P&L statement only.';

// ADR-0006 phase 1: the P&L statement is read from the semantic model and follows
// the month; every other zone is still sample, so their gates and copy stay.

/** Chip detail on the live statement. */
export const LIVE_STATEMENT_DETAIL = 'follows the month; the other filters stay at their defaults for now';

/** Notice-strip line while the statement is live and the other views are sample. */
export const MIXED_FIGURES_NOTICE =
  'The P&L statement is live from the semantic model and follows the month. Key figures, analysis and profitability are still sample figures (YTD Sep 2026, Actual vs Budget and Prior year, USD m); fiscal year, time view, versions, slices, currency, FX basis and breakdown stay off until those zones go live.';

/** In-panel note the month grid is described by while it is the one live control. */
export const MONTH_LIVE_NOTE = 'Month is live: it drives the P&L statement read from the semantic model.';

/** The window the sample figures are fixed at, for headings over sample numbers (LSN-002). */
export const SAMPLE_WINDOW_LONG = 'YTD Jan–Sep 2026';

/** Notice-strip line when the model could not be read and the statement shows sample rows. */
export function liveFallbackNotice(reason: string): string {
  return `The P&L statement could not be read from the semantic model (${reason}); showing sample figures instead.`;
}

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

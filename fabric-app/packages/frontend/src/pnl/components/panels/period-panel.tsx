// Period panel v2 (docs/design/period-picker-v2.md Part 1; F-02 to F-04, C-01):
// live summary sentence, time view first with plain labels, year without "FY",
// a month grid whose label follows the time view (hidden for Full year), covered
// months shaded, open months handled by the base version. The footer ("Back to
// default" + "Done") is the flyout's.
import { useId } from 'react';

import { MONTH_SHORT } from '../../model/filters';
import { coveredMonths, fiscalYears, FULL_YEAR_LINE, monthGridLabel, monthState, periodSummary, TIME_VIEW_OPTIONS } from '../../model/period';
import { SAMPLE_INERT_REASON, sampleGate } from '../../model/sample-mode';
import { Caption, PanelGroup, type PanelProps } from '../filter-flyout';
import { RadioRow, type RadioOption } from '../ui/radio-row';

export function PeriodPanel({ filter, reference, dispatch, sample }: PanelProps) {
  const noteId = useId();
  const years = fiscalYears(reference);
  const gridLabel = monthGridLabel(filter.timeView);
  // Shading shows the selected year's part of the window; the sentence names the full range.
  const covered = new Set(
    coveredMonths(filter, reference)
      .filter((m) => m.fiscalYear === filter.fiscalYear)
      .map((m) => m.monthNumber)
  );
  const months: RadioOption<string>[] = MONTH_SHORT.map((label, i) => {
    const n = i + 1;
    const state = monthState({ fiscalYear: filter.fiscalYear, monthNumber: n }, filter.baseVersion, reference);
    const off = state.open && !state.selectable;
    return {
      value: String(n),
      label,
      sub: state.open ? state.text : undefined,
      disabled: sample || off,
      title: sample ? SAMPLE_INERT_REASON : off ? state.hint : undefined,
      covered: covered.has(n),
    };
  });

  return (
    <>
      <p className="m-0 text-[16px] font-semibold leading-[1.3]" data-testid="period-summary" aria-live="polite">
        {periodSummary(filter, reference)}
      </p>
      {/* LSN-002: the sample figures are fixed at YTD Sep 2026, so the period pickers are off. */}
      {sample && <Caption id={noteId}>{SAMPLE_INERT_REASON}</Caption>}
      <PanelGroup label="Show">
        <RadioRow
          label="Show"
          value={filter.timeView}
          options={sampleGate(TIME_VIEW_OPTIONS, sample)}
          onChange={(timeView) => dispatch({ type: 'set', patch: { timeView } })}
          describedBy={sample ? noteId : undefined}
        />
      </PanelGroup>
      <PanelGroup label="Year">
        <RadioRow
          label="Year"
          value={String(filter.fiscalYear)}
          options={sampleGate(
            years.map((y) => ({ value: String(y), label: String(y) })),
            sample
          )}
          onChange={(v) => dispatch({ type: 'set', patch: { fiscalYear: Number(v) } })}
          describedBy={sample ? noteId : undefined}
        />
      </PanelGroup>
      {gridLabel === null ? (
        <Caption>{FULL_YEAR_LINE}</Caption>
      ) : (
        <PanelGroup label={gridLabel}>
          <RadioRow
            label={gridLabel}
            variant="cells"
            columns={4}
            value={String(filter.month)}
            options={months}
            onChange={(v) => dispatch({ type: 'set', patch: { month: Number(v) } })}
            describedBy={sample ? noteId : undefined}
          />
        </PanelGroup>
      )}
    </>
  );
}

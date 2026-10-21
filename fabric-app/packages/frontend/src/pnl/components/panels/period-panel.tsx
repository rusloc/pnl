// Period flyout (F-02 to F-04): fiscal year, month grid (open months dashed), time view.
import { useId } from 'react';

import { cn } from '@/lib/utils';

import { MONTH_SHORT } from '../../model/filters';
import { MONTH_LIVE_NOTE, SAMPLE_INERT_REASON, sampleGate } from '../../model/sample-mode';
import type { TimeView } from '../../model/types';
import { Caption, PanelGroup, type PanelProps } from '../filter-flyout';
import { Segmented } from '../ui/segmented';

const TIME_VIEWS: readonly { value: TimeView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
  { value: 'ltm', label: 'LTM' },
  { value: 'fy', label: 'FY' },
];

export function PeriodPanel({ filter, reference, dispatch, sample, monthLive = false }: PanelProps) {
  const noteId = useId();
  const monthNoteId = useId();
  const years = [...new Set(reference.months.map((m) => m.fiscalYear))].sort();
  const monthsOfYear = reference.months.filter((m) => m.fiscalYear === filter.fiscalYear);
  // ADR-0006 phase 1: the month drives the live statement; year and time view stay off while sample.
  const monthOff = sample && !monthLive;
  return (
    <>
      {/* LSN-002: the sample figures are fixed at YTD Sep 2026, so the period pickers are off. */}
      {sample && <Caption id={noteId}>{SAMPLE_INERT_REASON}</Caption>}
      {sample && monthLive && <Caption id={monthNoteId}>{MONTH_LIVE_NOTE}</Caption>}
      <PanelGroup label="Fiscal year">
        <Segmented
          label="Fiscal year"
          value={String(filter.fiscalYear)}
          options={sampleGate(
            years.map((y) => ({ value: String(y), label: `FY${y}` })),
            sample
          )}
          onChange={(v) => dispatch({ type: 'set', patch: { fiscalYear: Number(v) } })}
          fontSize={14}
          describedBy={sample ? noteId : undefined}
        />
      </PanelGroup>
      <PanelGroup label="Month">
        <div
          role="group"
          aria-label="Month"
          aria-describedby={monthOff ? noteId : sample && monthLive ? monthNoteId : undefined}
          className="grid grid-cols-4 gap-[6px]"
        >
          {MONTH_SHORT.map((label, i) => {
            const n = i + 1;
            const ref = monthsOfYear.find((m) => m.monthNumber === n);
            const open = ref ? !ref.isClosed : true;
            const selected = filter.month === n;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                aria-label={open ? `${label} (open month)` : label}
                disabled={monthOff}
                title={monthOff ? SAMPLE_INERT_REASON : undefined}
                onClick={() => dispatch({ type: 'set', patch: { month: n } })}
                className={cn(
                  'h-[40px] rounded-[8px] border font-[inherit] text-[14px]',
                  monthOff ? 'cursor-not-allowed' : 'cursor-pointer',
                  selected
                    ? 'border-acc bg-acc font-semibold text-surface'
                    : open
                      ? 'border-dashed border-line-300 bg-subtle text-slate-600'
                      : 'border-line-300 bg-surface text-ink-900'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Caption>
          Dashed months are still open. They show figures only with Latest estimate or Budget as the base.
        </Caption>
      </PanelGroup>
      <PanelGroup label="Time view">
        <Segmented
          label="Time view"
          value={filter.timeView}
          options={sampleGate(TIME_VIEWS, sample)}
          onChange={(timeView) => dispatch({ type: 'set', patch: { timeView } })}
          describedBy={sample ? noteId : undefined}
        />
      </PanelGroup>
    </>
  );
}

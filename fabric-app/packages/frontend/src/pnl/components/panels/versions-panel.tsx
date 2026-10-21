// Versions flyout (F-05 to F-07): base version radio cards + Compare A / B.
import { useId } from 'react';

import { cn } from '@/lib/utils';

import { MONTH_SHORT } from '../../model/filters';
import { SAMPLE_INERT_REASON, sampleGate } from '../../model/sample-mode';
import type { BaseVersion, CompareVersion } from '../../model/types';
import { Caption, PanelGroup, type PanelProps } from '../filter-flyout';
import { Segmented } from '../ui/segmented';

const COMPARES: readonly { value: CompareVersion; label: string }[] = [
  { value: 'BUD', label: 'Budget' },
  { value: 'LE', label: 'Latest est.' },
  { value: 'PY', label: 'Prior year' },
  { value: 'NONE', label: 'None' },
];

export function VersionsPanel({ filter, reference, dispatch, sample }: PanelProps) {
  const noteId = useId();
  const closed = reference.lastClosed;
  const closedLabel = `${MONTH_SHORT[closed.monthNumber - 1]} ${closed.fiscalYear}`;
  const nextOpen = closed.monthNumber < 12 ? MONTH_SHORT[closed.monthNumber] : null;
  const bases: readonly { value: BaseVersion; label: string; description: string }[] = [
    { value: 'ACT', label: 'Actual', description: `Closed months only, Jan–${closedLabel}` },
    {
      value: 'LE',
      label: 'Latest estimate',
      description: nextOpen
        ? `Actual Jan–${MONTH_SHORT[closed.monthNumber - 1]} plus the ${MONTH_SHORT[closed.monthNumber - 1]} forecast for ${nextOpen}–Dec`
        : 'Actual for every closed month',
    },
    { value: 'BUD', label: 'Budget', description: `Approved FY${filter.fiscalYear} budget, phased by month` },
  ];
  return (
    <>
      {/* LSN-002: the sample figures are Actual vs Budget and Prior year, so the version pickers are
          off; otherwise Compare A = Latest est. would re-title the Budget column (F-06, F-07). */}
      {sample && <Caption id={noteId}>{SAMPLE_INERT_REASON}</Caption>}
      <PanelGroup label="Base version">
        <div
          role="radiogroup"
          aria-label="Base version"
          aria-describedby={sample ? noteId : undefined}
          className="flex flex-col gap-[8px]"
        >
          {bases.map((b) => {
            const selected = filter.baseVersion === b.value;
            return (
              <label
                key={b.value}
                title={sample ? SAMPLE_INERT_REASON : undefined}
                className={cn(
                  'flex items-start gap-[10px] rounded-[8px] border px-[12px] py-[10px]',
                  sample ? 'cursor-not-allowed' : 'cursor-pointer',
                  selected ? 'border-acc bg-acc-t shadow-[0_0_0_1px_var(--acc)]' : 'border-line-300 bg-surface'
                )}
              >
                <input
                  type="radio"
                  name="base-version"
                  value={b.value}
                  checked={selected}
                  disabled={sample}
                  onChange={() => dispatch({ type: 'set', patch: { baseVersion: b.value } })}
                  className="mt-[3px]"
                  style={{ accentColor: 'var(--acc)' }}
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-[12px] text-slate-600">{b.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </PanelGroup>
      <PanelGroup label="Compare A">
        <Segmented
          label="Compare A"
          value={filter.compareA}
          options={sampleGate(COMPARES, sample)}
          onChange={(compareA) => dispatch({ type: 'set', patch: { compareA } })}
          describedBy={sample ? noteId : undefined}
        />
      </PanelGroup>
      <PanelGroup label="Compare B">
        <Segmented
          label="Compare B"
          value={filter.compareB}
          options={sampleGate(COMPARES, sample)}
          onChange={(compareB) => dispatch({ type: 'set', patch: { compareB } })}
          describedBy={sample ? noteId : undefined}
        />
        <Caption>Comparisons always cover the same months as the base.</Caption>
      </PanelGroup>
    </>
  );
}

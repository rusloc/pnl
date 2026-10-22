// Header (design brief §5.3): eyebrow, title + context line (L-04), view tabs
// (roving arrow keys) and the per-view toolbar. The company switch lives on the
// rail brand mark (ADR-0007 §2.4); the statement toolbar is inside the statement
// card (Expand all / Collapse all, ADR-0007 §2.3).
import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import { MONTH_SHORT } from '../model/filters';
import { sampleGate } from '../model/sample-mode';
import type { FilterState, ReferenceData, ViewKey } from '../model/types';
import { AnalysisIcon, ProfitabilityIcon, TableIcon, TilesIcon } from './ui/icons';
import { Segmented } from './ui/segmented';

const TABS: readonly { key: ViewKey; label: string; Icon: typeof TableIcon }[] = [
  { key: 'pnl', label: 'P&L statement', Icon: TableIcon },
  { key: 'kpi', label: 'Key figures', Icon: TilesIcon },
  { key: 'ana', label: 'Analysis', Icon: AnalysisIcon },
  { key: 'prof', label: 'Profitability', Icon: ProfitabilityIcon },
];

interface AppHeaderProps {
  filter: FilterState;
  reference: ReferenceData;
  contextLine: string;
  view: ViewKey;
  onView: (view: ViewKey) => void;
  onPatch: (patch: Partial<Pick<FilterState, 'analysisCompare'>>) => void;
  onBreakdown: (index: number) => void;
  breakdownOptions: readonly string[];
  /** True while the figures are sample: Compared with / Break down by are off (LSN-002). */
  sample: boolean;
  /** Header data status from the model (N-02): "Closed through … · Refreshed …"; null while unknown. */
  dataStatus: string | null;
}

export function AppHeader({
  filter,
  reference,
  contextLine,
  view,
  onView,
  onPatch,
  onBreakdown,
  breakdownOptions,
  sample,
  dataStatus,
}: AppHeaderProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closed = reference.lastClosed;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (i + delta + TABS.length) % TABS.length;
    tabRefs.current[next]?.focus();
    onView(TABS[next].key);
  };

  return (
    <header className="flex flex-none flex-col gap-[8px] border-b border-line-200 bg-surface px-[24px] pt-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[10px]">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-slate-600">
            ACME Group · Management reporting ·{' '}
            {dataStatus ?? `Actuals closed through ${MONTH_SHORT[closed.monthNumber - 1]} ${closed.fiscalYear}`}
          </span>
          <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-[2px]">
            <h1 className="m-0 text-[22px] font-semibold leading-[1.25]">Profit &amp; loss</h1>
            <span className="text-[13px] text-slate-600">{contextLine}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-[24px] gap-y-[4px]">
        <div role="tablist" aria-label="View" className="flex flex-wrap gap-[4px]">
          {TABS.map(({ key, label, Icon }, i) => {
            const selected = view === key;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`view-${key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onView(key)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  'flex min-h-[48px] cursor-pointer items-center gap-[8px] border-0 border-b-[3px] bg-transparent px-[14px] font-[inherit] text-[15px]',
                  selected ? 'border-b-acc font-semibold text-ink-900' : 'border-b-transparent font-medium text-slate-600'
                )}
              >
                <Icon />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-[8px] pb-[8px]">
          {view === 'kpi' && (
            <span className="flex flex-wrap items-center gap-x-[14px] gap-y-[6px] text-[13px] text-slate-600">
              <span>Changes vs Budget and Prior year, same months</span>
              <span className="inline-flex items-center gap-[4px] rounded-[12px] bg-fav-tint px-[8px] py-px font-semibold text-fav">▲ favourable</span>
              <span className="inline-flex items-center gap-[4px] rounded-[12px] bg-unf-tint px-[8px] py-px font-semibold text-unf">▼ unfavourable</span>
            </span>
          )}
          {view === 'ana' && (
            <>
              <span className="text-[13px] text-slate-600">Compared with</span>
              {/* C-45; off while sample so the heading never says "vs Prior year" over Budget bars (LSN-002). */}
              <Segmented
                label="Compared with"
                variant="inline"
                value={filter.analysisCompare}
                options={sampleGate(
                  [
                    { value: 'BUD', label: 'Budget' },
                    { value: 'PY', label: 'Prior year' },
                  ],
                  sample
                )}
                onChange={(analysisCompare) => onPatch({ analysisCompare })}
              />
            </>
          )}
          {view === 'prof' && (
            <>
              <span className="text-[13px] text-slate-600">Break down by</span>
              {/* F-21; off while sample so "Region" never re-titles the channel table (LSN-002). */}
              <Segmented
                label="Break down by"
                variant="inline"
                value={String(filter.breakdown[filter.entity])}
                options={sampleGate(
                  breakdownOptions.map((label, i) => ({ value: String(i), label })),
                  sample
                )}
                onChange={(v) => onBreakdown(Number(v))}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

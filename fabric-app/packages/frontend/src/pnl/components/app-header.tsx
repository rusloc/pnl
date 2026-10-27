// Header (docs/design/period-picker-v2.md Part 2, Track B is the reference):
// title row = "Profit & loss" + the applied-filters button (funnel → pop-up with
// every filter value and the notices, L-04 / L-05 as amended, C-50) with the
// status line right-aligned (N-02, N-03); then the view tabs (roving arrow keys),
// the pager on Analysis / Profitability (parity rule 20), the per-view toolbar
// and one "How to read" per view (rule 19). No eyebrow, no context line, no
// notice strip. The company switch lives on the rail brand mark (ADR-0007 §2.4).
import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import type { FilterRow } from '../model/applied-filters';
import { kpiCaption } from '../model/filters';
import { howToRead } from '../model/info-popovers';
import type { FilterState, ReferenceData, ViewKey } from '../model/types';
import { AppliedFilters } from './applied-filters';
import { ChatButton } from './chat-panel';
import { HowToReadButton } from './how-to-read';
import { type Page, Pager } from './pager';
import { AnalysisIcon, ProfitabilityIcon, TableIcon, TilesIcon } from './ui/icons';

const TABS: readonly { key: ViewKey; label: string; Icon: typeof TableIcon }[] = [
  { key: 'pnl', label: 'P&L statement', Icon: TableIcon },
  { key: 'kpi', label: 'Vitals', Icon: TilesIcon },
  { key: 'ana', label: 'Analysis', Icon: AnalysisIcon },
  { key: 'prof', label: 'Profitability', Icon: ProfitabilityIcon },
];

interface AppHeaderProps {
  filter: FilterState;
  reference: ReferenceData;
  /** `<Company> - Management reporting - Closed through <Mon YYYY> - Refreshed <d Mon YYYY HH:MM>`. */
  statusLine: string;
  /** Rows of the applied-filters pop-up: the filters, then the notices (C-50). */
  filterRows: readonly FilterRow[];
  noticeRows: readonly FilterRow[];
  noticeCount: number;
  view: ViewKey;
  onView: (view: ViewKey) => void;
  /** Sub-page of the Analysis / Profitability view (parity rule 20). */
  page: Page;
  onPage: (page: Page) => void;
  /** True while the figures are sample: the Vitals caption names the fixed comparisons (LSN-002). */
  sample: boolean;
  /** The AI assistant's entry point (ADR-0009); absent when the feature is off. */
  chat?: { open: boolean; onToggle: () => void };
}

export function AppHeader({
  filter,
  reference,
  statusLine,
  filterRows,
  noticeRows,
  noticeCount,
  view,
  onView,
  page,
  onPage,
  sample,
  chat,
}: AppHeaderProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
      <div className="flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[6px]">
        <div className="flex items-center gap-[10px]">
          <h1 className="m-0 text-[22px] font-semibold leading-[1.25]">Profit &amp; loss</h1>
          <AppliedFilters rows={filterRows} noticeRows={noticeRows} noticeCount={noticeCount} />
          {chat && <ChatButton open={chat.open} onToggle={chat.onToggle} />}
        </div>
        <span data-testid="status-line" className="text-[12px] text-slate-600">
          {statusLine}
        </span>
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
          {(view === 'ana' || view === 'prof') && (
            <div className="ml-[10px] flex items-center pb-[8px]">
              <Pager page={page} onPage={onPage} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-[8px] pb-[8px]">
          {view === 'kpi' && (
            <span className="text-[13px] text-slate-600" data-testid="kpi-caption">
              {/* Caption from the selection (parity rule 13); while sample the figures are fixed at Budget / Prior year (LSN-002). */}
              {sample ? kpiCaption({ compareA: 'BUD', compareB: 'PY' }) : kpiCaption(filter)}
            </span>
          )}
          {/* No Analysis toolbar (its comparison is the C-40 one, parity rule 1) and no Profitability breakdown
              control (Region only, PV-19; the F-21 query path stays dormant behind `FilterState.breakdown`). */}
          {view !== 'pnl' && <HowToReadButton guide={howToRead(view, filter, reference)} />}
        </div>
      </div>
    </header>
  );
}

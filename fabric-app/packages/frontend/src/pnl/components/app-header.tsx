// Header (design brief §5.3): eyebrow, title + context line (L-04), company
// cards (F-01), view tabs (roving arrow keys) and the per-view toolbar.
import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import { MONTH_SHORT } from '../model/filters';
import { sampleGate } from '../model/sample-mode';
import type { CostLens, Detail, EntityCode, FilterState, Layout, ReferenceData, ViewKey } from '../model/types';
import { COMPANIES, COMPANY_THEME } from '../theme/company';
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
  onEntity: (entity: EntityCode) => void;
  onPatch: (patch: Partial<Pick<FilterState, 'layout' | 'costLens' | 'detail' | 'analysisCompare'>>) => void;
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
  onEntity,
  onPatch,
  onBreakdown,
  breakdownOptions,
  sample,
  dataStatus,
}: AppHeaderProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closed = reference.lastClosed;
  // Q0 (ADR-0006 §8.2): the Group view needs both entities visible to the user.
  const groupAllowed = reference.visibleEntities === undefined || reference.visibleEntities.length >= 2;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (i + delta + TABS.length) % TABS.length;
    tabRefs.current[next]?.focus();
    onView(TABS[next].key);
  };

  const isGroup = filter.entity === 'G';
  const layoutOptions: readonly { value: Layout; label: string; disabled?: boolean; title?: string }[] = [
    { value: 'variance', label: 'Variance' },
    { value: 'trend', label: 'Trend' },
    {
      value: 'entity',
      label: 'Entity columns',
      disabled: !isGroup,
      title: isGroup ? undefined : 'Available in the ACME Group view',
    },
  ];

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
        <div role="group" aria-label="Company" className="flex flex-wrap gap-[8px]">
          {COMPANIES.map((c) => {
            const selected = c.code === filter.entity;
            const theme = COMPANY_THEME[c.code];
            const off = c.code === 'G' && !groupAllowed;
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={selected}
                disabled={off}
                title={off ? 'The consolidated view needs access to both companies in the semantic model' : undefined}
                onClick={() => onEntity(c.code)}
                className={cn(
                  'box-border flex min-h-[52px] items-center gap-[10px] rounded-[10px] border py-[6px] pl-[12px] pr-[16px] text-left font-[inherit] text-ink-900',
                  off ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
                style={{
                  borderColor: selected ? theme.acc : '#CDD4DC',
                  boxShadow: selected ? `0 0 0 1px ${theme.acc}` : 'none',
                  background: selected ? theme.accT : '#FFFFFF',
                }}
              >
                <span aria-hidden="true" className="h-[12px] w-[12px] flex-none rounded-[6px]" style={{ background: theme.acc }} />
                <span className="flex flex-col leading-[1.25]">
                  <span className="text-[15px] font-semibold">{c.name}</span>
                  <span className="text-[12px] text-slate-600">{c.sub}</span>
                </span>
              </button>
            );
          })}
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
          {view === 'pnl' && (
            <>
              <Segmented label="Layout" variant="inline" value={filter.layout} options={layoutOptions} onChange={(layout) => onPatch({ layout })} />
              <Segmented<CostLens>
                label="Cost lens"
                variant="inline"
                value={filter.costLens}
                options={[
                  { value: 'function', label: 'By function' },
                  { value: 'nature', label: 'By nature' },
                ]}
                onChange={(costLens) => onPatch({ costLens })}
              />
              <Segmented<Detail>
                label="Detail"
                variant="inline"
                value={filter.detail}
                options={[
                  { value: 'summary', label: 'Summary' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'full', label: 'Full' },
                ]}
                onChange={(detail) => onPatch({ detail })}
              />
            </>
          )}
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

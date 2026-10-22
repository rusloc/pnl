// ACME Unified P&L — the "Ledger" shell (docs/design/design-requirements.md).
// One 16:9 window: filter rail · header · notice strip · one view at a time.
import { useCallback, useMemo, useReducer, useState } from 'react';

import { AppHeader } from './components/app-header';
import { FilterFlyout } from './components/filter-flyout';
import { FilterRail } from './components/filter-rail';
import { NoticeStrip } from './components/notice-strip';
import { appDataSource } from './data/data-source';
import { breakdownOptions } from './data/pnl-model-figures';
import { useFigures, useReference } from './hooks/use-pnl-data';
import { contextLine, defaultFilters, filterReducer, railSummaries, type FilterAction } from './model/filters';
import { SAMPLE_FIGURES_NOTICE } from './model/sample-mode';
import { filterNotices, sliceSummary } from './model/summary';
import type { EntityCode, FilterState, PanelKey, PnlDataSource, ReferenceData, ViewKey } from './model/types';
import { themeVars } from './theme/company';
import { AnalysisView } from './views/analysis-view';
import { KeyFiguresView } from './views/key-figures-view';
import { ProfitabilityView } from './views/profitability-view';
import { StatementView } from './views/statement-view';

/** Default open blocks (M-20): GR, GTN, COR, VSC, OPEX; Group: GR, VSC, OPEX. */
const DEFAULT_OPEN: Record<EntityCode, readonly string[]> = {
  P: ['GR', 'GTN', 'COR', 'VSC', 'OPEX'],
  S: ['GR', 'GTN', 'COR', 'VSC', 'OPEX'],
  G: ['GR', 'VSC', 'OPEX'],
};

function defaultOpen(): Record<EntityCode, ReadonlySet<string>> {
  return { P: new Set(DEFAULT_OPEN.P), S: new Set(DEFAULT_OPEN.S), G: new Set(DEFAULT_OPEN.G) };
}

export interface PnlAppProps {
  source?: PnlDataSource;
  initialView?: ViewKey;
}

export function PnlApp({ source = appDataSource, initialView = 'pnl' }: PnlAppProps) {
  const reference = useReference(source);
  if (reference.status === 'loading') {
    return (
      <div className="ledger flex h-full items-center justify-center bg-ground font-ledger text-[14px] text-slate-600">
        Loading reference data…
      </div>
    );
  }
  return (
    <PnlShell
      source={source}
      reference={reference.reference}
      fallbackReason={reference.fallbackReason}
      initialView={initialView}
    />
  );
}

interface ShellProps {
  source: PnlDataSource;
  reference: ReferenceData;
  fallbackReason?: string;
  initialView: ViewKey;
}

function PnlShell({ source, reference, fallbackReason, initialView }: ShellProps) {
  const defaults = useMemo(() => defaultFilters(reference), [reference]);
  const [filter, dispatch] = useReducer(filterReducer, defaults);
  const [view, setView] = useState<ViewKey>(initialView);
  const [wide, setWide] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const figures = useFigures(source, filter, reference);

  const closePanel = useCallback(() => setPanel(null), []);
  const togglePanel = useCallback((key: PanelKey) => setPanel((p) => (p === key ? null : key)), []);

  const dispatchFilter = useCallback(
    (action: FilterAction) => {
      dispatch(action);
      // M-21: expansion state resets when the cost lens changes; Full opens everything.
      if (action.type === 'set' && (action.patch.costLens !== undefined || action.patch.detail !== undefined)) {
        setOpen(defaultOpen());
      }
    },
    []
  );

  const toggleRow = useCallback(
    (code: string) =>
      setOpen((prev) => {
        const next = new Set(prev[filter.entity]);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        return { ...prev, [filter.entity]: next };
      }),
    [filter.entity]
  );

  const openCodes = useMemo(() => {
    if (filter.detail !== 'full' || !figures) return open[filter.entity];
    const all = new Set(open[filter.entity]);
    for (const r of figures.statement) if (r.parent) all.add(r.parent);
    return all;
  }, [filter.detail, filter.entity, figures, open]);

  const slices = sliceSummary(filter, reference);
  const summaries = railSummaries(filter, slices);
  // LSN-002: while the figures are sample, the pickers that would re-label them are off and
  // the strip says so once (F-34 is not met by the sample path).
  const sample = figures?.sample === true;
  // C-50: live, the notices are the model's (`Notices`); offline, the sample's plus the filter rules.
  const noAccess = reference.visibleEntities !== undefined && reference.visibleEntities.length === 0;
  const notices = [
    ...(fallbackReason
      ? [`Reference data (months, versions, regions, slices) is sample: lh_raw could not be read — ${fallbackReason}`]
      : []),
    ...(noAccess ? ['You have no P&L access: the semantic model shows you no company. Ask for a role on the model.'] : []),
    ...(sample ? [SAMPLE_FIGURES_NOTICE, ...filterNotices(filter, reference)] : []),
    ...(figures?.notices ?? []),
  ];
  const breakdown = sample ? (figures?.profitability.options ?? []) : breakdownOptions(filter, reference);

  return (
    <div
      className="ledger relative flex h-full min-h-[680px] overflow-hidden bg-ground font-ledger text-[14px] leading-[1.45] text-ink-900"
      style={themeVars(filter.entity)}
      data-entity={filter.entity}
    >
      <FilterRail
        wide={wide}
        onToggleWide={() => setWide((w) => !w)}
        openPanel={panel}
        onTogglePanel={togglePanel}
        summaries={summaries}
      />
      {panel && (
        <FilterFlyout
          panel={panel}
          wide={wide}
          defaults={defaults}
          onClose={closePanel}
          filter={filter}
          reference={reference}
          dispatch={dispatchFilter}
          sample={sample}
        />
      )}
      <div className="flex min-w-0 flex-auto flex-col">
        <AppHeader
          filter={filter}
          reference={reference}
          contextLine={contextLine(filter, slices)}
          view={view}
          onView={setView}
          onEntity={(entity) => dispatchFilter({ type: 'entity', entity })}
          onPatch={(patch) => dispatchFilter({ type: 'set', patch })}
          onBreakdown={(index) => dispatchFilter({ type: 'breakdown', index })}
          breakdownOptions={breakdown}
          sample={sample}
          dataStatus={figures?.dataStatus ?? null}
        />
        <div className="box-border flex min-h-0 flex-auto flex-col gap-[12px] overflow-auto px-[24px] pb-[16px] pt-[14px]">
          <NoticeStrip notices={notices} />
          {!figures ? (
            <div className="text-[13px] text-slate-600">Loading figures…</div>
          ) : view === 'pnl' ? (
            <StatementView
              figures={figures}
              filter={filter}
              entity={filter.entity}
              openCodes={openCodes}
              onToggleRow={toggleRow}
            />
          ) : view === 'kpi' ? (
            <KeyFiguresView figures={figures} />
          ) : view === 'ana' ? (
            <AnalysisView figures={figures} filter={filter} />
          ) : (
            <ProfitabilityView figures={figures} filter={filter} />
          )}
        </div>
      </div>
    </div>
  );
}

export type { FilterState };

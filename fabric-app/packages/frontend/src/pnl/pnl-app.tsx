// ACME Unified P&L — the "Ledger" shell (docs/design/design-requirements.md).
// One 16:9 window: filter rail (brand mark = company switch) · header · notice
// strip · one view at a time.
import { useCallback, useMemo, useReducer, useState } from 'react';

import { AppHeader } from './components/app-header';
import { EntityPicker } from './components/entity-picker';
import { FilterFlyout } from './components/filter-flyout';
import { FilterRail } from './components/filter-rail';
import { NoticeStrip } from './components/notice-strip';
import { appDataSource } from './data/data-source';
import { breakdownOptions } from './data/pnl-model-figures';
import { useFigures, useReference } from './hooks/use-pnl-data';
import { contextLine, defaultFilters, filterReducer, railSummaries, type FilterAction } from './model/filters';
import { SAMPLE_FIGURES_NOTICE } from './model/sample-mode';
import { COLLAPSED, expandableCodes, toggleOpen } from './model/statement-rows';
import { filterNotices, sliceSummary } from './model/summary';
import type { FilterState, PanelKey, PnlDataSource, ReferenceData, ViewKey } from './model/types';
import { themeVars } from './theme/company';
import { AnalysisView } from './views/analysis-view';
import { KeyFiguresView } from './views/key-figures-view';
import { ProfitabilityView } from './views/profitability-view';
import { StatementView } from './views/statement-view';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  // M-20 / M-21: collapsed by default; persists across filter changes; resets on entity change.
  const [open, setOpen] = useState<ReadonlySet<string>>(COLLAPSED);
  const figures = useFigures(source, filter, reference);

  const closePanel = useCallback(() => setPanel(null), []);
  const togglePanel = useCallback((key: PanelKey) => {
    setPickerOpen(false);
    setPanel((p) => (p === key ? null : key));
  }, []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const togglePicker = useCallback(() => {
    setPanel(null);
    setPickerOpen((o) => !o);
  }, []);

  const dispatchFilter = useCallback(
    (action: FilterAction) => {
      dispatch(action);
      if (action.type === 'entity' && action.entity !== filter.entity) setOpen(COLLAPSED);
    },
    [filter.entity]
  );

  const toggleRow = useCallback((code: string) => setOpen((prev) => toggleOpen(prev, code)), []);
  const expandAll = useCallback(() => setOpen(expandableCodes(figures?.statement ?? [])), [figures]);
  const collapseAll = useCallback(() => setOpen(COLLAPSED), []);

  // Q0 (ADR-0006 §8.2): the Group view needs both entities visible to the user.
  const groupAllowed = reference.visibleEntities === undefined || reference.visibleEntities.length >= 2;

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
        entity={filter.entity}
        pickerOpen={pickerOpen}
        onTogglePicker={togglePicker}
      />
      {pickerOpen && (
        <EntityPicker
          entity={filter.entity}
          groupAllowed={groupAllowed}
          wide={wide}
          onSelect={(entity) => dispatchFilter({ type: 'entity', entity })}
          onClose={closePicker}
        />
      )}
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
              openCodes={open}
              onToggleRow={toggleRow}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
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

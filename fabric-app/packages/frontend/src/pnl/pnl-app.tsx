// ACME Unified P&L — the "Ledger" shell (docs/design/design-requirements.md;
// page top per docs/design/period-picker-v2.md Part 2). One 16:9 window: filter
// rail (brand mark = company switch) · header (title + applied filters, status
// line, tabs, pager, How to read) · one view at a time; Analysis and
// Profitability have two sub-pages (‹ › or the ← → keys, parity rule 20).
// Notices live in the applied-filters pop-up.
// The AI assistant (ADR-0009) is a button in the title row and a right-docked
// panel, behind a build-time flag.
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { productionChatDeps } from './chat/chat-deps';
import { CHAT_ENABLED } from './chat/chat-flag';
import type { ChatDeps } from './chat/chat-session';
import { useChat } from './chat/use-chat';
import { AppHeader } from './components/app-header';
import { ChatPanel } from './components/chat-panel';
import { EntityPicker } from './components/entity-picker';
import { FilterFlyout } from './components/filter-flyout';
import { FilterRail } from './components/filter-rail';
import type { Page } from './components/pager';
import { appDataSource } from './data/data-source';
import { useFigures, useReference } from './hooks/use-pnl-data';
import { filterRows, noticeRows, refreshedText, statusLine } from './model/applied-filters';
import { defaultFilters, filterReducer, railSummaries, type FilterAction } from './model/filters';
import { periodSummary } from './model/period';
import { SAMPLE_FIGURES_NOTICE } from './model/sample-mode';
import { COLLAPSED, expandableCodes, toggleOpen } from './model/statement-rows';
import { filterNotices, sliceSummary } from './model/summary';
import type { FilterState, PanelKey, PnlDataSource, ReferenceData, ViewKey } from './model/types';
import type { VarMode, VarTop } from './model/variances';
import { themeVars } from './theme/company';
import { AnalysisView } from './views/analysis-view';
import { ProfitabilityView } from './views/profitability-view';
import { StatementView } from './views/statement-view';
import { VitalsView } from './views/vitals-view';

export interface PnlAppProps {
  source?: PnlDataSource;
  initialView?: ViewKey;
  /** AI assistant on/off; defaults to the build-time flag (RAYFIN_PUBLIC_PNL_CHAT). */
  chat?: boolean;
  /** The chat's function invoke and tool runner; defaults to the production wiring. */
  chatDeps?: ChatDeps;
}

export function PnlApp({ source = appDataSource, initialView = 'pnl', chat = CHAT_ENABLED, chatDeps }: PnlAppProps) {
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
      chatEnabled={chat}
      chatDeps={chatDeps}
    />
  );
}

interface ShellProps {
  source: PnlDataSource;
  reference: ReferenceData;
  fallbackReason?: string;
  initialView: ViewKey;
  chatEnabled: boolean;
  chatDeps?: ChatDeps;
}

function PnlShell({ source, reference, fallbackReason, initialView, chatEnabled, chatDeps }: ShellProps) {
  const defaults = useMemo(() => defaultFilters(reference), [reference]);
  const [filter, dispatch] = useReducer(filterReducer, defaults);
  const [view, setView] = useState<ViewKey>(initialView);
  const [wide, setWide] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // M-20 / M-21: collapsed by default; persists across filter changes; resets on entity change.
  const [open, setOpen] = useState<ReadonlySet<string>>(COLLAPSED);
  // Sub-page per paged view and the largest-variances controls (view state, kept across tab switches).
  const [pages, setPages] = useState<Record<'ana' | 'prof', Page>>({ ana: 1, prof: 1 });
  const [varTop, setVarTop] = useState<VarTop>(8);
  const [varMode, setVarMode] = useState<VarMode>('block');
  const figures = useFigures(source, filter, reference);
  const [chatOpen, setChatOpen] = useState(false);
  const deps = useMemo(() => chatDeps ?? productionChatDeps(source, reference), [chatDeps, source, reference]);
  const chat = useChat(deps, filter);

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
      const entity = action.type === 'entity' ? action.entity : action.type === 'replace' ? action.state.entity : filter.entity;
      if (entity !== filter.entity) setOpen(COLLAPSED);
    },
    [filter.entity]
  );
  const toggleChat = useCallback(() => setChatOpen((o) => !o), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  /** A tool card's "Open in view": its validated filters become the app's, and the matching view shows. */
  const openInView = useCallback(
    (state: FilterState, next: ViewKey) => {
      dispatchFilter({ type: 'replace', state });
      setView(next);
    },
    [dispatchFilter]
  );

  const paged = view === 'ana' || view === 'prof' ? view : null;
  const page: Page = paged ? pages[paged] : 1;
  const setPage = useCallback(
    (next: Page) => {
      if (paged) setPages((p) => (p[paged] === next ? p : { ...p, [paged]: next }));
    },
    [paged]
  );
  // ← → page the Analysis / Profitability views when the keys are not already taken (tabs, controls, an open pop-up).
  useEffect(() => {
    if (!paged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('button, input, select, textarea, [role="tab"], [role="dialog"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      setPage(e.key === 'ArrowLeft' ? 1 : 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paged, setPage]);

  const toggleRow = useCallback((code: string) => setOpen((prev) => toggleOpen(prev, code)), []);
  const expandAll = useCallback(() => setOpen(expandableCodes(figures?.statement ?? [])), [figures]);
  const collapseAll = useCallback(() => setOpen(COLLAPSED), []);

  // Q0 (ADR-0006 §8.2): the Group view needs both entities visible to the user.
  const groupAllowed = reference.visibleEntities === undefined || reference.visibleEntities.length >= 2;

  const slices = sliceSummary(filter, reference);
  // The rail carries the full "Showing …" sentence (parity rule 7).
  const summaries = railSummaries(filter, slices, periodSummary(filter, reference));
  // LSN-002: while the figures are sample, the pickers that would re-label them are off and
  // the pop-up says so once (F-34 is not met by the sample path).
  const sample = figures?.sample === true;
  // C-50: live, the notices are the model's (`Notices`); offline, the sample's plus the filter
  // rules. They are labelled rows of the applied-filters pop-up (Part 2), none when none applies.
  const noAccess = reference.visibleEntities !== undefined && reference.visibleEntities.length === 0;
  const notices = [
    ...(fallbackReason
      ? [`Reference data (months, versions, regions, slices) is sample: lh_raw could not be read — ${fallbackReason}`]
      : []),
    ...(sample ? [SAMPLE_FIGURES_NOTICE, ...filterNotices(filter, reference)] : []),
    ...(figures?.notices ?? []),
  ];

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
          statusLine={statusLine(filter, reference, refreshedText(figures?.refreshedAt ?? null))}
          filterRows={filterRows(filter, reference)}
          noticeRows={noticeRows(notices)}
          noticeCount={notices.length}
          view={view}
          onView={setView}
          page={page}
          onPage={setPage}
          sample={sample}
          chat={chatEnabled ? { open: chatOpen, onToggle: toggleChat } : undefined}
        />
        <div className="box-border flex min-h-0 flex-auto flex-col gap-[12px] overflow-auto px-[24px] pb-[16px] pt-[14px]">
          {/* A failure state, not a C-50 notice: without a model role every zone stays empty (Q0, N-04). */}
          {noAccess && (
            <div role="alert" className="rounded-[8px] border border-notice-border bg-notice-tint px-[12px] py-[8px] text-[13px] text-notice-text">
              You have no P&amp;L access: the semantic model shows you no company. Ask for a role on the model.
            </div>
          )}
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
            <VitalsView figures={figures} />
          ) : view === 'ana' ? (
            <AnalysisView
              figures={figures}
              filter={filter}
              reference={reference}
              page={page}
              controls={{ top: varTop, mode: varMode, onTop: setVarTop, onMode: setVarMode, onCut: (cut) => dispatchFilter({ type: 'varCut', cut }) }}
            />
          ) : (
            <ProfitabilityView figures={figures} filter={filter} page={page} />
          )}
        </div>
      </div>
      {chatEnabled && chatOpen && <ChatPanel chat={chat} onOpenInView={openInView} onClose={closeChat} />}
    </div>
  );
}

export type { FilterState };

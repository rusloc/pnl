'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createDatasetLoader, type Dataset } from '@/lib/data/dataset';
import { createEngine } from '@/lib/engine';
import { companyName } from '@/lib/engine/header';
import { hideEmptyLines } from '@/lib/engine/hide-empty';
import { windowLabel } from '@/lib/engine/notices';
import type { EntityCode, EntityView, Selection } from '@/lib/engine/types';
import { createSelectionCodec, parseEntity, restrictToBuilt } from '@/lib/state/selection-schema';
import { joinQuery, parseViewState, serializeViewState, type ViewState } from '@/lib/state/view-state';
import { CompanyPicker } from './CompanyPicker';
import { collapsedRows, expandedRows, openRows, type Expansion } from './expansion';
import { FilterRail, isPanelKey, type Overlay } from './FilterRail';
import { PopupProvider } from './glass';
import { Flyout } from './Flyout';
import { Header } from './Header';
import styles from './ledger.module.css';
import { StatementTable } from './StatementTable';
import { themeVars } from './theme';
import { AnalysisBridges, Variances } from './views/AnalysisView';
import { ProfitabilityCharts, ProfitabilityTable } from './views/ProfitabilityView';
import { VitalsView } from './views/VitalsView';

// Client root (ADR-0002 §2.5): loads public/data, owns Selection ↔ URL (F-37) and passes engine results down.
// Orchestration only: every number comes from lib/engine.

const loader = createDatasetLoader(async (name) => {
  const res = await fetch(`/data/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.arrayBuffer();
});

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entity: EntityCode; dataset: Dataset };

export function Shell() {
  const params = useSearchParams();
  const entityParam = parseEntity(params);
  const entity: EntityCode = entityParam === 'S' ? 'S' : 'P'; // Group view: build step 4
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Synchronise with the external data files; a stale response for another entity is ignored.
  useEffect(() => {
    let live = true;
    loader.load([entity]).then(
      (dataset) => live && setLoad({ status: 'ready', entity, dataset }),
      (error: unknown) =>
        live && setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
    };
  }, [entity, attempt]);

  if (load.status === 'ready' && load.entity === entity)
    return <Ledger dataset={load.dataset} search={params.toString()} />;
  return (
    <div className={styles.app} style={themeVars(entity)}>
      <main className={styles.main}>
        <div className={styles.content}>
          {load.status === 'error' ? (
            <p role="alert" className={styles.state}>
              The P&amp;L data could not be loaded ({load.message}).
              <button type="button" className={styles.linkButton} onClick={() => setAttempt((a) => a + 1)}>
                Retry
              </button>
            </p>
          ) : (
            <p className={styles.state}>Loading the P&amp;L…</p>
          )}
        </div>
      </main>
    </div>
  );
}

function Ledger({ dataset, search }: { dataset: Dataset; search: string }) {
  const m = dataset.manifest;
  const codec = useMemo(() => createSelectionCodec(m), [m]);
  const engine = useMemo(() => createEngine(dataset), [dataset]);
  const defaults = useMemo(() => codec.defaults('P'), [codec]);
  const sel = useMemo(() => restrictToBuilt(codec.parse(new URLSearchParams(search))), [codec, search]);
  // Sub-page and variances controls (p, lvn, lvm, lvc): validated like the Selection keys, appended after them.
  const vs = useMemo(() => parseViewState(new URLSearchParams(search)), [search]);
  const paged = sel.view === 'analysis' || sel.view === 'profitability';
  const canonical = joinQuery(codec.serialize(sel), serializeViewState(paged ? vs : { ...vs, page: 1 }));

  // Invalid or unbuilt input never stays in the URL: rewrite it to the state actually shown (ADR-0002 §2.4).
  useEffect(() => {
    if (canonical !== search)
      window.history.replaceState(null, '', canonical ? `?${canonical}` : window.location.pathname);
  }, [canonical, search]);

  const go = useCallback(
    (next: Selection, view: ViewState) => {
      const q = joinQuery(codec.serialize(next), serializeViewState(view));
      window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname);
    },
    [codec],
  );
  // A view switch opens its first sub-page (ADR-0004 pager).
  const update = useCallback(
    (patch: Partial<Selection>) =>
      go({ ...sel, ...patch }, patch.view && patch.view !== sel.view ? { ...vs, page: 1 } : vs),
    [go, sel, vs],
  );
  const updateView = useCallback((patch: Partial<ViewState>) => go(sel, { ...vs, ...patch }), [go, sel, vs]);

  // ← → page Analysis and Profitability (build-brief §0), unless the key belongs to a field, a pop-up or a control.
  useEffect(() => {
    if (!paged) return;
    const ctrl = new AbortController();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const t = e.target;
        if (
          t instanceof Element &&
          t.closest('input, select, textarea, [role="dialog"], [role="radiogroup"], [role="tablist"]')
        )
          return;
        updateView({ page: e.key === 'ArrowLeft' ? 1 : 2 });
      },
      { signal: ctrl.signal },
    );
    return () => ctrl.abort();
  }, [paged, updateView]);

  const [wide, setWide] = useState(false);
  // One pop-over at a time: a filter flyout, the company picker or the applied-filters pop-up
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const toggleOverlay = (key: Overlay) => setOverlay((o) => (o === key ? null : key));

  const statement = useMemo(() => engine.statement(sel), [engine, sel]);
  const howToRead = useMemo(() => (sel.view === 'statement' ? null : engine.howToRead(sel)), [engine, sel]);

  // M-20 / M-21 (parity rule 5): the statement opens collapsed; expansion persists across every filter change and
  // resets to collapsed only when the company changes. Presets read the full spine, so rows that Hide empty lines
  // drops do not change them.
  const [expansion, setExpansion] = useState<Expansion>({ entity: sel.entity, open: null });
  const collapsed = useMemo(() => collapsedRows(statement.rows), [statement]);
  const open = openRows(expansion, sel.entity, collapsed);
  const setOpen = (next: ReadonlySet<string>) => setExpansion({ entity: sel.entity, open: next });
  const toggle = (code: string) => {
    const next = new Set(open);
    if (!next.delete(code)) next.add(code);
    setOpen(next);
  };

  const notices = useMemo(() => engine.notices(sel), [engine, sel]);
  const period = useMemo(() => engine.period(sel), [engine, sel]);
  const header = useMemo(() => engine.header(sel), [engine, sel]); // viewer's time zone: client-only render
  const units = m.tables.param_units.find((u) => u.units_code === sel.units) ?? { divisor: 1_000_000, decimals: 1 };
  const costMultiplier =
    m.tables.param_cost_sign.find((c) => c.cost_sign_code === sel.costSign)?.display_multiplier_for_costs ?? 1;
  const window_ = windowLabel(m, sel);
  // F-37: absolute link from the runtime hook; Ledger mounts only in the browser (after the data load), so the
  // window fallback never runs on the server.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${window.location.origin}${window.location.pathname}`;
  const shareUrl = `${base}${canonical ? `?${canonical}` : ''}`;
  const rows = hideEmptyLines(statement.rows, sel, units); // M-22, rounded in the selected units

  const companies = (['P', 'S', 'GROUP'] as const satisfies readonly EntityView[]).map((code) => ({
    code,
    name: companyName(m, code),
  }));

  return (
    <div className={styles.app} style={themeVars(sel.entity)}>
      <FilterRail
        wide={wide}
        onToggleWide={() => setWide((w) => !w)}
        openPanel={overlay}
        onTogglePanel={toggleOverlay}
        summaries={{
          period: period.summary, // period picker v2: the rail tooltip uses the summary sentence
          versions: header.rail.versions,
          slice: 'All slices',
          display: header.rail.display,
        }}
      />
      {overlay === 'company' && (
        <CompanyPicker
          entity={sel.entity}
          companies={companies}
          wide={wide}
          onSelect={(entity) => update({ entity })}
          onClose={closeOverlay}
        />
      )}
      {overlay !== null && isPanelKey(overlay) && (
        <Flyout
          panel={overlay}
          wide={wide}
          sel={sel}
          defaults={defaults}
          manifest={m}
          period={period}
          onChange={update}
          onClose={closeOverlay}
        />
      )}
      <main className={styles.main}>
        {/* one glass pop-up at a time across header and content; a view or page change closes it */}
        <PopupProvider scope={`${sel.view}-${vs.page}`}>
          <Header
            sel={sel}
            status={header.status}
            filters={header.filters}
            notices={notices}
            filtersOpen={overlay === 'filters'}
            onToggleFilters={() => toggleOverlay('filters')}
            onCloseFilters={closeOverlay}
            shareUrl={shareUrl}
            onChange={update}
            pager={paged ? { page: vs.page, onPage: (page) => updateView({ page }) } : null}
            howToRead={howToRead}
          />
          <div className={styles.content}>
            {sel.view === 'statement' ? (
              <StatementTable
                rows={rows}
                sel={sel}
                windowLabel={window_}
                format={{ units, unitsLabel: `${sel.currency} ${sel.units === 'M' ? 'm' : 'k'}`, costMultiplier }}
                open={open}
                onToggle={toggle}
                onExpandAll={() => setOpen(expandedRows(statement.rows))}
                onCollapseAll={() => setOpen(collapsed)}
              />
            ) : (
              <RedesignedView engine={engine} sel={sel} vs={vs} onViewState={updateView} />
            )}
          </div>
        </PopupProvider>
      </main>
    </div>
  );
}

/** Vitals · Analysis · Profitability (P&L views redesign v4): engine view models in, components out. */
function RedesignedView({
  engine,
  sel,
  vs,
  onViewState,
}: {
  engine: ReturnType<typeof createEngine>;
  sel: Selection;
  vs: ViewState;
  onViewState: (patch: Partial<ViewState>) => void;
}) {
  const vm = useMemo(() => {
    if (sel.view === 'kpi') return { kind: 'vitals', vm: engine.vitals(sel) } as const;
    if (sel.view === 'analysis')
      return vs.page === 1
        ? ({ kind: 'bridges', vm: engine.analysis(sel) } as const)
        : ({ kind: 'variances', vm: engine.variances(sel, vs.top, vs.mode, vs.cut) } as const);
    if (sel.view === 'profitability')
      return { kind: vs.page === 1 ? 'profTable' : 'profCharts', vm: engine.profitability(sel) } as const;
    return null;
  }, [engine, sel, vs]);
  if (!vm) return null;
  return (
    <section
      id={`view-${sel.view}`}
      role="tabpanel"
      aria-label={`${sel.view === 'kpi' ? 'Vitals' : sel.view === 'analysis' ? 'Analysis' : 'Profitability'}${sel.view === 'kpi' ? '' : `, page ${vs.page} of 2`}`}
      style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0 }}
    >
      {vm.kind === 'vitals' ? <VitalsView vm={vm.vm} /> : null}
      {vm.kind === 'bridges' ? <AnalysisBridges vm={vm.vm} /> : null}
      {vm.kind === 'variances' ? (
        <Variances vm={vm.vm} top={vs.top} mode={vs.mode} cut={vs.cut} onChange={(patch) => onViewState(patch)} />
      ) : null}
      {vm.kind === 'profTable' ? <ProfitabilityTable vm={vm.vm} /> : null}
      {vm.kind === 'profCharts' ? <ProfitabilityCharts vm={vm.vm} /> : null}
    </section>
  );
}

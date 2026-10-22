'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createDatasetLoader, type Dataset } from '@/lib/data/dataset';
import { createEngine } from '@/lib/engine';
import { windowLabel } from '@/lib/engine/notices';
import type { EntityCode, Selection } from '@/lib/engine/types';
import { createSelectionCodec, parseEntity, restrictToBuilt } from '@/lib/state/selection-schema';
import { FilterRail, type PanelKey } from './FilterRail';
import { Flyout } from './Flyout';
import { Header } from './Header';
import { InfoIcon } from './Icons';
import styles from './ledger.module.css';
import { StatementTable } from './StatementTable';
import { themeVars } from './theme';

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

const DEFAULT_OPEN = ['GR', 'GTN', 'COR', 'VSC', 'OPEX']; // design guide §6.1, Standard detail (M-20)

function Ledger({ dataset, search }: { dataset: Dataset; search: string }) {
  const m = dataset.manifest;
  const codec = useMemo(() => createSelectionCodec(m), [m]);
  const engine = useMemo(() => createEngine(dataset), [dataset]);
  const defaults = useMemo(() => codec.defaults('P'), [codec]);
  const sel = useMemo(
    () => restrictToBuilt(codec.parse(new URLSearchParams(search)), defaults),
    [codec, search, defaults],
  );
  const canonical = codec.serialize(sel);

  // Invalid or unbuilt input never stays in the URL: rewrite it to the state actually shown (ADR-0002 §2.4).
  useEffect(() => {
    if (canonical !== search)
      window.history.replaceState(null, '', canonical ? `?${canonical}` : window.location.pathname);
  }, [canonical, search]);

  const update = useCallback(
    (patch: Partial<Selection>) => {
      const next = codec.serialize({ ...sel, ...patch });
      window.history.replaceState(null, '', next ? `?${next}` : window.location.pathname);
    },
    [codec, sel],
  );

  const [wide, setWide] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);

  // M-21: expansion persists across filter changes and resets when the entity or cost lens changes.
  const expansionKey = `${sel.entity}|${sel.costLens}`;
  const [expansion, setExpansion] = useState({ key: expansionKey, open: new Set(DEFAULT_OPEN) });
  const open = expansion.key === expansionKey ? expansion.open : new Set(DEFAULT_OPEN);
  const toggle = (code: string) => {
    const next = new Set(open);
    if (!next.delete(code)) next.add(code);
    setExpansion({ key: expansionKey, open: next });
  };

  const statement = useMemo(() => engine.statement(sel), [engine, sel]);
  const notices = useMemo(() => engine.notices(sel), [engine, sel]);
  const status = engine.dataStatus();
  const closedMonth = m.tables.dim_month.find((d) => d.month_key === status.lastClosedMonth);
  const units = m.tables.param_units.find((u) => u.units_code === sel.units) ?? { divisor: 1_000_000, decimals: 1 };
  const costMultiplier =
    m.tables.param_cost_sign.find((c) => c.cost_sign_code === sel.costSign)?.display_multiplier_for_costs ?? 1;
  const window_ = windowLabel(m, sel);
  const anchor = m.tables.dim_month.find((d) => d.fiscal_year === sel.fy && d.month_number === sel.month);
  const anchorLabel = `${anchor?.month_name ?? sel.month} ${sel.fy}`;
  // F-37: absolute link from the runtime hook; Ledger mounts only in the browser (after the data load), so the
  // window fallback never runs on the server.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${window.location.origin}${window.location.pathname}`;
  const shareUrl = `${base}${canonical ? `?${canonical}` : ''}`;
  const compares = [sel.compareA, sel.compareB]
    .filter((c) => c !== 'NONE')
    .map((c) => ({ B: 'Budget', LE: 'Latest est.', PY: 'Prior year' })[c]);

  const companies = [
    ...m.tables.dim_entity.map((e) => ({ code: e.entity_code, name: e.short_name })),
    { code: 'GROUP' as const, name: m.tables.dim_entity[0]?.consolidation_group ?? 'ACME Group' },
  ];

  return (
    <div className={styles.app} style={themeVars(sel.entity)}>
      <FilterRail
        wide={wide}
        onToggleWide={() => setWide((w) => !w)}
        openPanel={panel}
        onTogglePanel={(key) => setPanel((p) => (p === key ? null : key))}
        summaries={{
          period:
            sel.timeView === 'FY'
              ? `Full year · FY${sel.fy}`
              : `${sel.timeView === 'MTD' ? 'Month' : sel.timeView} · ${anchorLabel}`,
          versions: `${{ A: 'Actual', LE: 'Latest estimate', B: 'Budget' }[sel.base]}${compares.length ? ` vs ${compares.join(', ')}` : ''}`,
          slice: 'All slices',
          display: `${sel.currency} ${sel.units === 'M' ? 'm' : 'k'} · ${sel.fxBasis === 'CC' ? 'constant currency' : 'actual rates'}`,
        }}
      />
      {panel && (
        <Flyout
          panel={panel}
          wide={wide}
          sel={sel}
          defaults={defaults}
          manifest={m}
          onChange={update}
          onClose={closePanel}
        />
      )}
      <main className={styles.main}>
        <Header
          sel={sel}
          companies={companies}
          dataStatus={closedMonth ? `Actuals closed through ${closedMonth.month_name} ${closedMonth.fiscal_year}` : ''}
          context={engine.context(sel)}
          shareUrl={shareUrl}
          onChange={update}
        />
        <div className={styles.content}>
          {notices.length > 0 && (
            <ul className={styles.notices} aria-label="Notices">
              {notices.map((n) => (
                <li key={n.code}>
                  <InfoIcon />
                  {n.text}
                </li>
              ))}
            </ul>
          )}
          <StatementTable
            rows={statement.rows}
            sel={sel}
            windowLabel={window_}
            format={{ units, unitsLabel: `${sel.currency} ${sel.units === 'M' ? 'm' : 'k'}`, costMultiplier }}
            open={open}
            onToggle={toggle}
          />
        </div>
      </main>
    </div>
  );
}

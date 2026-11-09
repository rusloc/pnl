'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createLoader } from '@/lib/data/loader';
import { A11Y, FILTERS, FOOTNOTE, HEADER, KPI } from '@/lib/engine/copy';
import { addPlanWeek, createDataset } from '@/lib/engine/data';
import type { Dataset } from '@/lib/engine/data';
import { RESET_SELECTION } from '@/lib/engine/selection';
import type { Selection } from '@/lib/engine/selection';
import { parseSelection, serializeSelection } from '@/lib/engine/url-state';
import { board } from '@/lib/engine/view';
import type { TileView } from '@/lib/engine/view';
import { FilterBar } from './FilterBar';
import { Waterfall } from './Waterfall';

// Client root (contract §1, §5, §6): loads public/data in the browser, owns Selection ↔ URL (validated by url-state.ts)
// and the board frame. Orchestration only: every number and string comes from lib/engine.

const loader = createLoader(async (name) => {
  const res = await fetch(`/data/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.arrayBuffer();
});

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; ds: Dataset };

export function TrucksApp() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loader.core().then(
      (core) => live && setLoad({ status: 'ready', ds: createDataset(core) }),
      (e: unknown) => live && setLoad({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  if (load.status === 'ready') return <Board ds={load.ds} />;
  return (
    <p className="loading" role="status">
      {load.status === 'loading' ? `Loading ${HEADER.title}…` : `Could not load the data (${load.message}).`}
      {load.status === 'error' ? (
        <button
          type="button"
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((a) => a + 1);
          }}
        >
          Retry
        </button>
      ) : null}
    </p>
  );
}

const URL_EVENT = 'acme-trucks:url';
/** The URL as an external store: back / forward and our own writes (URL_EVENT) notify. */
function subscribeUrl(notify: () => void) {
  const ctrl = new AbortController();
  for (const e of ['popstate', URL_EVENT]) window.addEventListener(e, notify, { signal: ctrl.signal });
  return () => ctrl.abort();
}
const urlSnapshot = () => window.location.search;
const noUrlOnServer = () => null;

function Board({ ds }: { ds: Dataset }) {
  const loc = useSyncExternalStore(subscribeUrl, urlSnapshot, noUrlOnServer);
  const sel = useMemo(
    () => (loc === null ? RESET_SELECTION : parseSelection(new URLSearchParams(loc), ds.m)),
    [loc, ds],
  );

  const go = useCallback(
    (next: Selection) => {
      const q = serializeSelection(next, ds.m);
      window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
      window.dispatchEvent(new Event(URL_EVENT));
    },
    [ds],
  );

  // an invalid or non-canonical URL is rewritten to the validated state
  useEffect(() => {
    if (loc === null) return;
    const q = serializeSelection(sel, ds.m);
    if (`${q ? `?${q}` : ''}` !== loc) go(sel);
  }, [loc, sel, ds, go]);

  // plan-week.parquet: first pick of Week, or at load with pt=week
  const [planWeekReady, setPlanWeekReady] = useState(ds.planWeek !== null);
  const [planWeekError, setPlanWeekError] = useState<string | null>(null);
  const needWeek = sel.planType === 'Week' && !planWeekReady;
  useEffect(() => {
    if (!needWeek) return;
    let live = true;
    loader.planWeek().then(
      (rows) => {
        addPlanWeek(ds, rows);
        if (live) setPlanWeekReady(true);
      },
      (e: unknown) => live && setPlanWeekError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [needWeek, ds]);

  const view = useMemo(() => (needWeek ? null : board(ds, sel)), [ds, sel, needWeek]);

  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false), // clipboard denied (e.g. an iframe without the permission): nothing to report
    );
  }, []);

  if (!view)
    return (
      <p className="loading" role="status">
        {planWeekError ? `Could not load the week plan (${planWeekError}).` : `Loading ${HEADER.title}…`}
      </p>
    );

  return (
    <div className="board">
      <header className="hdr">
        <Image className="hdr-logo" src="/icons/trucks-logo.svg" alt="" width={24} height={24} unoptimized />
        <div className="hdr-title">
          <h1>{HEADER.title}</h1>
          <p>{HEADER.subtitle}</p>
        </div>
        <div className="hdr-context">
          <button type="button" className="hdr-copy" onClick={copyLink}>
            {copied ? HEADER.copied : HEADER.copyLink}
          </button>
          <span>{view.context}</span>
        </div>
      </header>

      <FilterBar
        ds={ds}
        sel={sel}
        chips={view.chips}
        onApply={go}
        onReset={() => go(RESET_SELECTION)}
        resetLabel={FILTERS.reset}
      />

      <section className="kpis" aria-label={A11Y.keyFigures}>
        {view.tiles.map((t) => (
          <KpiTile key={t.key} tile={t} />
        ))}
      </section>

      <Waterfall rows={view.rows} />

      <p className="footnote">{FOOTNOTE}</p>
    </div>
  );
}

function KpiTile({ tile }: { tile: TileView }) {
  return (
    <article
      className="kpi"
      tabIndex={0}
      aria-label={`${tile.title} ${tile.unit}: plan ${tile.plan}, fact ${tile.fact}`}
    >
      <div className="kpi-title">{tile.title}</div>
      <div className="kpi-unit">{tile.unit}</div>
      <div className="kpi-lbl kpi-lbl-plan">{KPI.plan}</div>
      <div className="kpi-plan">{tile.plan}</div>
      <div className="kpi-lbl kpi-lbl-fact">{KPI.fact}</div>
      <div className="kpi-fact">{tile.fact}</div>
      <div className={`kpi-delta tone-${tile.tone}`}>{tile.delta}</div>
    </article>
  );
}

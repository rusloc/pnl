'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createSalesLoader } from '@/lib/sales/data';
import { createSalesEngine } from '@/lib/sales';
import type { DetailIndex } from '@/lib/sales';
import type { Drill, SalesBase, SalesSelection } from '@/lib/sales/types';
import type { BandVM, OverviewVM, RowAction } from '@/lib/sales/view-model';
import { ChartCardView, HeroCardView, KpiCardView, TableCardView } from './cards';
import type { Box } from './cards';
import { Header } from './Header';
import { PopupProvider } from './popup';
import { SlideOver } from './SlideOver';
import styles from './sales.module.css';

// Client root of /sales (ADR-0011 (c)): loads public/data/sales in the browser, owns Selection ↔ URL and passes engine
// view models down. Orchestration only: every number and string comes from lib/sales.

const loader = createSalesLoader(async (name) => {
  const res = await fetch(`/data/sales/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.arrayBuffer();
});

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; base: SalesBase };

export function SalesApp() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loader.base().then(
      (base) => live && setLoad({ status: 'ready', base }),
      (e: unknown) => live && setLoad({ status: 'error', message: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (load.status === 'ready') return <Dashboard base={load.base} />;
  return (
    <div className={styles.page}>
      <div className={styles.board}>
        <p className={styles.status} role="status">
          {load.status === 'loading'
            ? 'Loading Mirelo sales data…'
            : `Could not load the sales data (${load.message}).`}
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
      </div>
    </div>
  );
}

// Layout-spec §1–§5 boxes (board px).
const HERO_X = [32, 380, 728, 1076] as const;
const KPI_X = [32, 264, 496, 728, 960, 1192] as const;
const THIRDS: readonly Box[] = [252, 430].flatMap((y) => [32, 496, 960].map((x) => ({ x, y, w: 448, h: 162 })));
const HALVES: readonly Box[] = [252, 430].flatMap((y) => [32, 728].map((x) => ({ x, y, w: 680, h: 162 })));
const WHY: readonly Box[] = [324, 500].flatMap((y) => [32, 728].map((x) => ({ x, y, w: 680, h: 160 })));

type Detail = { ix: DetailIndex } | { error: string } | null;

function Dashboard({ base }: { base: SalesBase }) {
  const engine = useMemo(() => createSalesEngine(base), [base]);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const search = params.toString();
  const sel = useMemo(() => engine.codec.parse(new URLSearchParams(search)), [engine, search]);
  const canonical = engine.codec.serialize(sel);
  const [stack, setStack] = useState<Drill[]>([]);
  const [detail, setDetail] = useState<Detail>(null);
  const panelId = useId();

  const go = useCallback(
    (next: SalesSelection) => {
      const q = engine.codec.serialize(next);
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [engine, router, pathname],
  );
  // Invalid or non-canonical query → rewrite to the validated state (unknown keys dropped).
  useEffect(() => {
    if (canonical !== search) go(sel);
  }, [canonical, search, go, sel]);

  // The capped loan / client sample loads on first need (Clients, Portfolio, any slide-over).
  const needs = engine.needsDetail(sel);
  useEffect(() => {
    if (!needs || detail) return;
    let live = true;
    loader.detail().then(
      (d) => live && setDetail({ ix: engine.indexDetail(d) }),
      (e: unknown) => live && setDetail({ error: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [needs, detail, engine]);
  const ix = detail && 'ix' in detail ? detail.ix : null;

  const header = useMemo(() => engine.header(sel), [engine, sel]);
  const overview = useMemo(() => (sel.view === 'overview' ? engine.overview(sel) : null), [engine, sel]);
  const band = useMemo(() => (sel.view === 'overview' ? null : engine.band(sel, ix)), [engine, sel, ix]);
  const slide = useMemo(() => (sel.drill ? engine.slideOver(sel, ix, sel.drill) : null), [engine, sel, ix]);

  const update = (patch: Partial<SalesSelection>) => go({ ...sel, ...patch });
  const onAction = (a: RowAction) => {
    if (a.kind === 'market') update({ market: a.market });
    else {
      setStack([]);
      update({ drill: a.drill });
    }
  };
  const onClose = useCallback(() => {
    setStack([]);
    go({ ...sel, drill: null });
  }, [go, sel]);

  return (
    <div className={styles.page}>
      {/* one pop-up open at a time; a view change closes it (remount) */}
      <PopupProvider key={sel.view}>
        <div className={styles.board}>
          <Header vm={header} sel={sel} panelId={panelId} onChange={update} />
          <div id={panelId} role="tabpanel" aria-labelledby={`tab-${sel.view}`} className={styles.panel}>
            {overview ? (
              <OverviewView
                vm={overview}
                onOpen={(view) => update({ view })}
                onMonth={(anchor) => update({ anchor })}
                onAction={onAction}
              />
            ) : null}
            {band ? <BandView vm={band} onMonth={(anchor) => update({ anchor })} onAction={onAction} /> : null}
          </div>
          {slide ? (
            <SlideOver
              vm={
                detail && 'error' in detail
                  ? { kind: 'missing', title: 'Could not load the loan sample', sub: detail.error }
                  : slide
              }
              onClose={onClose}
              onBack={
                stack.length > 0
                  ? () => {
                      const prev = stack.at(-1) ?? null;
                      setStack(stack.slice(0, -1));
                      update({ drill: prev });
                    }
                  : null
              }
              onClient={(client) => {
                if (sel.drill) setStack([...stack, sel.drill]);
                update({ drill: { kind: 'client', client } });
              }}
            />
          ) : null}
        </div>
      </PopupProvider>
    </div>
  );
}

function OverviewView({
  vm,
  onOpen,
  onMonth,
  onAction,
}: {
  vm: OverviewVM;
  onOpen: (v: SalesSelection['view']) => void;
  onMonth: (m: number) => void;
  onAction: (a: RowAction) => void;
}) {
  return (
    <>
      {vm.heroes.map((h, i) => (
        <HeroCardView key={h.id} card={h} box={{ x: HERO_X[i] ?? 32, y: 116, w: 332, h: 192 }} onOpen={onOpen} />
      ))}
      {vm.charts.map((c, i) => (
        <ChartCardView
          key={c.id}
          card={c}
          box={WHY[i] ?? { x: 32, y: 324, w: 680, h: 160 }}
          onOpen={onOpen}
          onMonth={onMonth}
        />
      ))}
      <TableCardView card={vm.table} box={{ x: 32, y: 676, w: 1376, h: 118 }} tight onAction={onAction} />
    </>
  );
}

function BandView({
  vm,
  onMonth,
  onAction,
}: {
  vm: BandVM;
  onMonth: (m: number) => void;
  onAction: (a: RowAction) => void;
}) {
  const boxes = vm.layout === 'thirds' ? THIRDS : HALVES;
  return (
    <>
      {vm.kpis.map((k, i) => (
        <KpiCardView key={k.id} card={k} box={{ x: KPI_X[i] ?? 32, y: 116, w: 216, h: 120 }} />
      ))}
      {vm.charts.map((c, i) => (
        <ChartCardView
          key={c.id}
          card={c}
          box={boxes[i] ?? { x: 32, y: 252, w: 448, h: 162 }}
          onOpen={() => undefined}
          onMonth={onMonth}
        />
      ))}
      <TableCardView card={vm.table} box={{ x: 32, y: 608, w: 1376, h: 186 }} tight={false} onAction={onAction} />
    </>
  );
}

'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, FocusEvent as ReactFocusEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createLoader } from '@/lib/data/loader';
import { createData } from '@/lib/engine/cube';
import type { ExecData } from '@/lib/engine/cube';
import { SIDEBAR_TIPS } from '@/lib/engine/copy';
import type { AttrKey } from '@/lib/engine/copy';
import { catalog } from '@/lib/engine/items';
import { DEFAULT_SELECTION, parseSelection, serializeSelection } from '@/lib/engine/url-state';
import type { Selection } from '@/lib/engine/url-state';
import { buildView } from '@/lib/engine/view';
import { Card } from './Card';
import { BenchDrawer, DrillPop, ExplainPop, FiltersMenu, HowPop, LayerFrame } from './Layers';
import { RichText, SideIcons, tip } from './ui';

// Client root (ADR-0013 (h)): loads public/data in the browser, owns Selection ↔ URL (E-62), the one open layer
// (E-52: one at a time, Esc / scrim / × close, focus trapped and returned) and the tooltip. Orchestration only: every
// number and string comes from lib/engine (buildView).

const loader = createLoader(async (name) => {
  const res = await fetch(`/data/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.arrayBuffer();
});

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: ExecData };

export function ExecApp() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loader().then(
      (files) => live && setLoad({ status: 'ready', data: createData(files) }),
      (e: unknown) => live && setLoad({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (load.status === 'ready') return <Dashboard data={load.data} />;
  return (
    <p className="loading" role="status">
      {load.status === 'loading' ? 'Loading Nordmark…' : `Could not load the data (${load.message}).`}
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

type Layer = { kind: 'menu' | 'how' | 'more' } | { kind: 'explain' | 'drill'; id: string };
type Tip = { title: string; body: string; el: HTMLElement };

const FOCUSABLE = 'button,[tabindex="0"],a[href]';

function Dashboard({ data }: { data: ExecData }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const search = params.toString();
  const sel = useMemo(() => parseSelection(new URLSearchParams(search), catalog(data)), [search, data]);
  const canonical = serializeSelection(sel);
  const go = useCallback(
    (next: Selection) => {
      const q = serializeSelection(next);
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  // Invalid or non-canonical query → rewrite to the validated state (unknown keys and bad values dropped).
  useEffect(() => {
    if (canonical !== search) go(sel);
  }, [canonical, search, go, sel]);

  const view = useMemo(() => buildView(data, sel), [data, sel]);

  // ---------- layers ----------
  const [layer, setLayer] = useState<Layer | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const container = useRef<HTMLElement | null>(null);
  const setContainer = (el: HTMLElement | null) => {
    container.current = el;
  };
  const layerOpen = useRef(false);
  const [tipState, setTip] = useState<Tip | null>(null);

  const open = (next: Layer, from: HTMLElement) => {
    if (!layer) opener.current = from; // a pop-up → pop-up switch keeps the first opener (v5 openLayer)
    setTip(null);
    setLayer(next);
  };
  const close = useCallback(() => {
    setLayer(null);
    opener.current?.focus(); // the tooltip stays hidden: layerOpen is still true during this focus
    setTip(null);
  }, []);

  useEffect(() => {
    layerOpen.current = layer !== null;
    if (!layer) return;
    const el = container.current;
    (el?.querySelector<HTMLElement>('.x') ?? el)?.focus(); // also after a content swap (CAND-004)
    document.body.style.overflow = 'hidden';
    const ctrl = new AbortController();
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          if (e.defaultPrevented) return; // an inner control (the Category list) closed itself
          close();
          return;
        }
        if (e.key !== 'Tab' || !el) return;
        const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.hidden);
        const first = f[0];
        const last = f.at(-1);
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      },
      { signal: ctrl.signal },
    );
    return () => {
      ctrl.abort();
      document.body.style.overflow = '';
    };
  }, [layer, close]);

  const onLayerClick = (e: ReactMouseEvent) => {
    if ((e.target as Element).closest('[data-close]')) close();
  };

  // ---------- tooltip (status chips, side bar, dot, card buttons) ----------
  const tipEl = useRef<HTMLDivElement>(null);
  const showTip = (target: EventTarget) => {
    const el = (target as Element).closest<HTMLElement>('[data-tip-title]');
    if (!el || layerOpen.current) return;
    setTip({ title: el.dataset.tipTitle ?? '', body: el.dataset.tipBody ?? '', el });
  };
  const hideTip = (target: EventTarget) => {
    if ((target as Element).closest('[data-tip-title]')) setTip(null);
  };
  useLayoutEffect(() => {
    const t = tipEl.current;
    if (!t || !tipState) return;
    const r = tipState.el.getBoundingClientRect();
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    let x: number;
    let y: number;
    if (tipState.el.closest('.sb')) {
      x = r.right + 10;
      y = r.top + r.height / 2 - h / 2;
    } else {
      x = r.right - w;
      y = r.bottom + 8;
      if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    }
    t.style.left = `${Math.max(8, x)}px`;
    t.style.top = `${Math.max(8, y)}px`;
  }, [tipState]);
  const tipHandlers = {
    onMouseOver: (e: ReactMouseEvent) => showTip(e.target),
    onMouseOut: (e: ReactMouseEvent) => hideTip(e.target),
    onFocus: (e: ReactFocusEvent) => showTip(e.target),
    onBlur: (e: ReactFocusEvent) => hideTip(e.target),
  };

  // ---------- selection ----------
  const toggle = (key: AttrKey, code: string) => {
    const cur = sel.picks[key];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    go({ ...sel, picks: { ...sel.picks, [key]: next } });
  };

  const { status } = view;
  const card =
    layer && (layer.kind === 'explain' || layer.kind === 'drill')
      ? view.cards.find((c) => c.id === layer.id)
      : undefined;
  const sideButton = (kind: 'menu' | 'how' | 'more', label: string, icon: keyof typeof SideIcons) => (
    <button
      type="button"
      className="ib"
      aria-haspopup="dialog"
      aria-expanded={layer?.kind === kind}
      aria-label={label}
      onClick={(e) => open({ kind }, e.currentTarget)}
      {...tip(SIDEBAR_TIPS[icon][0], SIDEBAR_TIPS[icon][1])}
    >
      {SideIcons[icon]}
      {kind === 'menu' ? (
        <span className="badge" hidden={status.picked === 0}>
          {status.picked}
        </span>
      ) : null}
    </button>
  );
  const onOpen = (kind: 'explain' | 'drill', id: string, from: HTMLElement) => open({ kind, id }, from);

  return (
    <div {...tipHandlers}>
      <nav className="sb" aria-label="Side bar">
        <div className="mark" aria-hidden="true">
          N
        </div>
        {sideButton('menu', `Filters and switchers${status.picked ? `, ${status.picked} active` : ''}`, 'filters')}
        {sideButton('how', 'How to read', 'how')}
        {sideButton('more', `More KPIs, ${view.bench.count} on the bench`, 'more')}
        <span className="sp" />
      </nav>

      <div className="page">
        <header className="top">
          <div className="brand">
            <h1>Nordmark Retail</h1>
            <small>Executive dashboard</small>
          </div>
          <div className="meta">
            <span>
              <RichText rich={view.header.period} />
            </span>
            <span>
              <RichText rich={view.header.compare} />
            </span>
            <span title={view.header.regionTitle ?? undefined}>
              <RichText rich={view.header.region} />
            </span>
          </div>
          <span className="rf">{view.header.refreshed}</span>
        </header>

        <div className="status">
          <span
            className={`dot ${status.dot}`}
            tabIndex={0}
            role="img"
            aria-label={`Overall status ${status.dot}`}
            {...tip(...status.dotTip)}
          />
          {/* one text node: .cnt is inline-flex with a gap, so split nodes would space out (v5 markup) */}
          <span className="cnt good">{`▲ ${status.counts.on} on track`}</span>
          <span className="cnt watch">{`● ${status.counts.watch} watch`}</span>
          <span className="cnt off">{`▼ ${status.counts.off} off track`}</span>
          <span className="sum" aria-live="polite">
            <b>
              {status.shown} of {status.total} metrics
            </b>{' '}
            · {status.picks}
          </span>
        </div>

        <section aria-labelledby="h-t1">
          <h2 id="h-t1">The three numbers</h2>
          <div className="grid">
            {view.cards
              .filter((c) => c.tier === 1)
              .map((c) => (
                <Card key={c.id} card={c} onOpen={onOpen} />
              ))}
          </div>
        </section>
        <section aria-labelledby="h-t2">
          <h2 id="h-t2">What explains them</h2>
          <div className="grid">
            {view.cards
              .filter((c) => c.tier === 2)
              .map((c) => (
                <Card key={c.id} card={c} onOpen={onOpen} />
              ))}
          </div>
        </section>
      </div>

      {layer ? (
        <LayerFrame
          key={'id' in layer ? `${layer.kind}-${layer.id}` : layer.kind}
          kind={layer.kind}
          onClose={close}
          onClick={onLayerClick}
          panelRef={setContainer}
        >
          {layer.kind === 'menu' ? (
            <FiltersMenu
              sel={sel}
              menu={view.menu}
              onSelect={go}
              onToggle={toggle}
              onReset={() => go(DEFAULT_SELECTION)}
            />
          ) : null}
          {layer.kind === 'how' ? <HowPop how={view.how} /> : null}
          {layer.kind === 'more' ? <BenchDrawer bench={view.bench} /> : null}
          {card && layer.kind === 'explain' ? (
            <ExplainPop card={card} onDrill={() => setLayer({ kind: 'drill', id: card.id })} />
          ) : null}
          {card && layer.kind === 'drill' ? (
            <DrillPop card={card} onExplain={() => setLayer({ kind: 'explain', id: card.id })} />
          ) : null}
        </LayerFrame>
      ) : null}
      <div ref={tipEl} className="tip glass" role="tooltip" hidden={tipState === null}>
        {tipState ? (
          <>
            <b>{tipState.title}</b>
            {tipState.body}
          </>
        ) : null}
      </div>
    </div>
  );
}

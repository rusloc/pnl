'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { createLoader } from '@/lib/data/loader';
import { BRAND, FILTERS, HOW_TO_READ, VIEWS } from '@/lib/engine/copy';
import type { CardCode } from '@/lib/engine/copy';
import { addJourney, addTerms, createDataset } from '@/lib/engine/data';
import type { Dataset } from '@/lib/engine/data';
import { DEFAULT_FILTERS, DEFAULT_SELECTION, resetAll } from '@/lib/engine/selection';
import type { RankMode, Selection, ViewKey } from '@/lib/engine/selection';
import { catalog, parseSelection, serializeSelection, viewHash } from '@/lib/engine/url-state';
import {
  activeCounts,
  campaigns,
  cardInfo,
  channels,
  cohorts,
  context,
  dynamics,
  frame,
  journey,
  options,
  overview,
  preview,
} from '@/lib/engine/view';
import type { Chip } from '@/lib/engine/view';
import { resolveWindow } from '@/lib/engine/windows';
import { DynamicsPop, FiltersWindow, HowPop, InfoPop } from './Layers';
import type { FilterGroup } from './Layers';
import { Binoculars, toneClass } from './ui';
import { CampaignsView, ChannelsView, CohortsView, JourneyView, OverviewView } from './views';

// Client root (contract §1, §5, §6): loads public/data in the browser (first paint + the lazy Journey / Campaigns
// files), owns Selection ↔ URL (hash = view, query = the 18 keys, validated by url-state.ts), the one open layer (one
// at a time; Esc / scrim / × close; focus trapped and returned) and the pending Filters state. Orchestration only:
// every number and string comes from lib/engine.

const loader = createLoader(async (name) => {
  const res = await fetch(`/data/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.arrayBuffer();
});

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; ds: Dataset };

export function MarketingApp() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loader.core().then(
      (f) => live && setLoad({ status: 'ready', ds: createDataset(f) }),
      (e: unknown) => live && setLoad({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  if (load.status === 'ready') return <Board ds={load.ds} />;
  return (
    <p className="loading" role="status">
      {load.status === 'loading' ? `Loading ${BRAND.alt}…` : `Could not load the data (${load.message}).`}
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

type Layer =
  | { kind: 'info'; code: CardCode; style: CSSProperties }
  | { kind: 'how' }
  | { kind: 'filters'; group: FilterGroup; pending: Selection };

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select,[tabindex="0"],a[href]';
const URL_EVENT = 'acme-marketing:url';
/** The URL as an external store: back / forward, a typed hash and our own writes (URL_EVENT) all notify. */
function subscribeUrl(notify: () => void) {
  const ctrl = new AbortController();
  for (const e of ['popstate', 'hashchange', URL_EVENT]) window.addEventListener(e, notify, { signal: ctrl.signal });
  return () => ctrl.abort();
}
const urlSnapshot = () => `${window.location.search}${window.location.hash}`;
const noUrlOnServer = () => null;

function Board({ ds }: { ds: Dataset }) {
  // ---------- URL ----------
  const loc = useSyncExternalStore(subscribeUrl, urlSnapshot, noUrlOnServer);
  const cat = useMemo(() => catalog(ds.m, ds.cal), [ds]);
  const sel = useMemo(() => {
    if (loc === null) return DEFAULT_SELECTION;
    const h = loc.indexOf('#');
    const search = h < 0 ? loc : loc.slice(0, h);
    return parseSelection(new URLSearchParams(search), cat, h < 0 ? '' : loc.slice(h));
  }, [loc, cat]);
  const go = useCallback(
    (next: Selection, push = false) => {
      const q = serializeSelection(next, ds.cal);
      const url = `${window.location.pathname}${q ? `?${q}` : ''}${viewHash(next.view)}`;
      if (push) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
      window.dispatchEvent(new Event(URL_EVENT));
    },
    [ds],
  );
  // invalid or non-canonical URL → rewrite to the validated state (unknown keys and bad values dropped)
  useEffect(() => {
    if (loc === null) return;
    const q = serializeSelection(sel, ds.cal);
    if (`${q ? `?${q}` : ''}${viewHash(sel.view)}` !== loc) go(sel);
  }, [loc, sel, ds, go]);

  // ---------- theme + channel colours (dim_channel is the truth, bound by code) ----------
  useEffect(() => {
    const el = document.documentElement;
    if (sel.theme) el.dataset.theme = sel.theme;
    else delete el.dataset.theme;
  }, [sel.theme]);
  const channelCss = useMemo(() => {
    const light = ds.m.channels.map((c) => `--ch-${c.channel_code}:${c.color_light}`).join(';');
    const dark = ds.m.channels.map((c) => `--ch-${c.channel_code}:${c.color_dark}`).join(';');
    return `:root{${light}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}:root[data-theme="dark"]{${dark}}`;
  }, [ds]);

  // ---------- lazy files ----------
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    let live = true;
    if (sel.view === 'journey' && !ds.journey)
      loader.journey().then(
        (f) => live && (addJourney(ds, f), setLoaded((n) => n + 1)),
        () => undefined,
      );
    if (sel.view === 'campaigns' && !ds.terms)
      loader.campaigns().then(
        (f) => live && (addTerms(ds, f), setLoaded((n) => n + 1)),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [sel.view, ds]);

  // ---------- view models ----------
  const ctx = useMemo(() => context(ds, sel), [ds, sel]);
  const fr = useMemo(() => frame(ctx), [ctx]);
  const opts = useMemo(() => options(ds), [ds]);

  // ---------- layers ----------
  const [layer, setLayer] = useState<Layer | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const opener = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const open = (next: Layer, from: HTMLElement | null) => {
    if (!layer && sel.dyn === null) opener.current = from;
    setLayer(next);
  };
  const close = useCallback(() => {
    setLayer(null);
    if (sel.dyn !== null) go({ ...sel, dyn: null });
    opener.current?.focus();
  }, [sel, go]);
  const anyOpen = layer !== null || sel.dyn !== null;
  const applyPending = useCallback(() => {
    if (layer?.kind !== 'filters') return;
    const { pending } = layer;
    setLayer(null);
    go(pending);
    opener.current?.focus();
  }, [layer, go]);

  useEffect(() => {
    if (!anyOpen) return;
    const el = panel.current;
    (el?.querySelector<HTMLElement>('.x') ?? el)?.focus();
    const ctrl = new AbortController();
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          return;
        }
        if (e.key === 'Enter' && layer?.kind === 'filters' && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          applyPending();
          return;
        }
        if (e.key !== 'Tab' || !el) return;
        const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
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
    return () => ctrl.abort();
  }, [anyOpen, layer?.kind, close, applyPending]);

  // F opens the Filters window (not while typing)
  useEffect(() => {
    const ctrl = new AbortController();
    document.addEventListener(
      'keydown',
      (e) => {
        const t = e.target as HTMLElement | null;
        if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey || anyOpen) return;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
          return;
        e.preventDefault();
        opener.current = document.activeElement as HTMLElement | null;
        setLayer({ kind: 'filters', group: 'scope', pending: sel });
      },
      { signal: ctrl.signal },
    );
    return () => ctrl.abort();
  }, [anyOpen, sel]);

  const onPanelClick = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-close]')) close();
  };

  // ---------- actions ----------
  const setView = (view: ViewKey) => {
    setLayer(null);
    go({ ...sel, view, dyn: null }, true);
  };
  const onInfo = (code: CardCode, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - 360, window.innerWidth - 368));
    const below = r.bottom + 8;
    const style: CSSProperties =
      below + 280 > window.innerHeight ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: below };
    open({ kind: 'info', code, style }, el);
  };
  const openFilters = (group: FilterGroup, el: HTMLElement) => open({ kind: 'filters', group, pending: sel }, el);
  const removeChip = (c: Chip) => {
    if (c.facet === 'cross') go({ ...sel, cross: null });
    else if (c.facet === 'model') go({ ...sel, model: 'DDA' });
    else go({ ...sel, [c.facet]: DEFAULT_FILTERS[c.facet] });
  };
  const onRank = (key: 'o5' | 'o6', m: RankMode) => go({ ...sel, [key]: m });
  const crossChannel = (channel: string, platform: string | null) => {
    const same = sel.cross?.kind === 'channel' && sel.cross.channel === channel && sel.cross.platform === platform;
    go({ ...sel, cross: same ? null : { kind: 'channel', channel, platform } });
  };
  const crossCampaign = (campaign: string) => {
    const same = sel.cross?.kind === 'campaign' && sel.cross.campaign === campaign;
    go({ ...sel, cross: same ? null : { kind: 'campaign', campaign } });
  };
  const onMover = (campaign: string) => go({ ...sel, view: 'campaigns', cross: { kind: 'campaign', campaign } }, true);
  const copyLink = () => void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);

  const tabKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = VIEWS.findIndex((v) => v.key === sel.view);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = VIEWS[(i + d + VIEWS.length) % VIEWS.length];
    if (next) {
      setView(next.key);
      requestAnimationFrame(() => document.getElementById(`tab-${next.key}`)?.focus());
    }
  };

  // ---------- render ----------
  const model = useMemo(() => {
    void loaded; // the lazy files mutate ds: recompute when one lands
    switch (ctx.sel.view) {
      case 'overview':
        return { view: 'overview' as const, v: overview(ctx) };
      case 'channels':
        return { view: 'channels' as const, v: channels(ctx) };
      case 'campaigns':
        return { view: 'campaigns' as const, v: campaigns(ctx) };
      case 'journey':
        return { view: 'journey' as const, v: journey(ctx) };
      case 'cohorts':
        return { view: 'cohorts' as const, v: cohorts(ctx) };
    }
  }, [ctx, loaded]);
  const body = (() => {
    switch (model.view) {
      case 'overview':
        return (
          <OverviewView
            v={model.v}
            modes={{ o5: sel.o5, o6: sel.o6 }}
            onInfo={onInfo}
            onRank={onRank}
            onMover={onMover}
          />
        );
      case 'channels':
        return (
          <ChannelsView
            v={model.v}
            onInfo={onInfo}
            expanded={expanded}
            onExpand={(code) =>
              setExpanded((s) => {
                const n = new Set(s);
                if (n.has(code)) n.delete(code);
                else n.add(code);
                return n;
              })
            }
            onCross={crossChannel}
          />
        );
      case 'campaigns':
        return <CampaignsView v={model.v} onInfo={onInfo} onCross={crossCampaign} />;
      case 'journey':
        return <JourneyView v={model.v} onInfo={onInfo} />;
      case 'cohorts':
        return <CohortsView v={model.v} onInfo={onInfo} />;
    }
  })();

  const dw = resolveWindow(ds.cal, '30d');
  return (
    <div className="app" data-view={sel.view}>
      <style>{channelCss}</style>
      <header className="top" aria-label={BRAND.alt}>
        <div className="brand">
          <Image src="/icons/acme-marketing-logo.svg" alt={BRAND.logoAlt} width={28} height={28} unoptimized priority />
          <h1>{BRAND.name}</h1>
        </div>
        <div className="tabs" role="tablist" aria-label="Views" onKeyDown={tabKeys}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              id={`tab-${v.key}`}
              type="button"
              role="tab"
              aria-selected={sel.view === v.key}
              tabIndex={sel.view === v.key ? 0 : -1}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="top-r">
          <button
            type="button"
            className="pill"
            onClick={(e) => openFilters('period', e.currentTarget)}
            aria-haspopup="dialog"
          >
            {fr.pill}
          </button>
          <button
            type="button"
            className="fbtn"
            onClick={(e) => (layer?.kind === 'filters' ? close() : openFilters('scope', e.currentTarget))}
            aria-haspopup="dialog"
          >
            {FILTERS.title}
            {fr.active.badge > 0 ? <span className="badge">{fr.active.badge}</span> : null}
          </button>
          <span className="fresh" tabIndex={0} title={fr.sources.map((x) => `${x.name}: ${x.at}`).join('\n')}>
            <i className={`dot d${fr.dot}`} aria-hidden="true" />
            {fr.synced}
          </span>
          <button type="button" className="link" onClick={copyLink} aria-label="Copy link to this view">
            Copy link
          </button>
        </div>
      </header>

      <div className="chipsline">
        <ul className="chips" aria-label="Active filters">
          {fr.chips.map((c) => (
            <li key={c.facet} className={c.facet === 'cross' ? 'cross' : undefined}>
              {c.label}
              <button type="button" aria-label={`Remove ${c.label}`} onClick={() => removeChip(c)}>
                ×
              </button>
            </li>
          ))}
          {fr.chips.length > 0 ? (
            <li className="clear">
              <button type="button" onClick={() => go(resetAll(sel))}>
                Clear
              </button>
            </li>
          ) : null}
        </ul>
        <button
          type="button"
          className="link"
          onClick={(e) => open({ kind: 'how' }, e.currentTarget)}
          aria-haspopup="dialog"
        >
          {HOW_TO_READ.title}
        </button>
      </div>

      <section className="vitals" aria-label="Vitals">
        {fr.vitals.map((v) => (
          <article key={v.code} className="tile glass">
            <div className="tile-h">
              <button
                type="button"
                className="bino"
                aria-label={v.dynTitle}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setLayer(null);
                  go({ ...sel, dyn: v.n });
                }}
              >
                <Binoculars />
              </button>
              <h2>{v.label}</h2>
              <button
                type="button"
                className="info"
                aria-label={`Definition of ${v.label}`}
                onClick={(e) => onInfo(v.code, e.currentTarget)}
              >
                i
              </button>
            </div>
            <div className="tile-v">
              <span className="val">{v.value}</span>
              <span className={`delta ${toneClass(v.tone)}`}>{v.arrow ? `${v.arrow} ${v.delta}` : ''}</span>
            </div>
            <div className="tile-ly">{v.ly}</div>
          </article>
        ))}
      </section>

      <main className="body" key={sel.view}>
        {body}
      </main>

      {anyOpen ? (
        <>
          <div className={`scrim ${layer?.kind === 'info' ? 'clear' : ''}`} onClick={close} />
          <div ref={panel} className="layer" tabIndex={-1} onClick={onPanelClick}>
            {sel.dyn !== null ? (
              <DynamicsPop v={dynamics(ctx, sel.dyn)} />
            ) : layer?.kind === 'info' ? (
              <InfoPop info={cardInfo(ctx, layer.code)} style={layer.style} />
            ) : layer?.kind === 'how' ? (
              <HowPop view={sel.view} />
            ) : layer?.kind === 'filters' ? (
              <FiltersWindow
                opts={opts}
                pending={layer.pending}
                set={(pending) => setLayer({ ...layer, pending })}
                group={layer.group}
                setGroup={(group) => setLayer({ ...layer, group })}
                dots={activeCounts(layer.pending).groups}
                pv={preview(ds, layer.pending)}
                toIso={ds.cal.iso}
                toIx={ds.cal.ix}
                defaultWindow={{ from: dw.a, to: dw.b }}
                onApply={applyPending}
                onResetGroup={() => setLayer({ ...layer, pending: resetGroup(layer.pending, layer.group) })}
                onResetAll={() => setLayer({ ...layer, pending: resetAll(layer.pending) })}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function resetGroup(s: Selection, g: FilterGroup): Selection {
  const d = DEFAULT_SELECTION;
  switch (g) {
    case 'period':
      return { ...s, preset: d.preset, from: null, to: null, cmp: d.cmp, grain: d.grain };
    case 'scope':
      return { ...s, platforms: [], tier: null };
    case 'channels':
      return { ...s, channels: [], networks: [] };
    case 'campaigns':
      return { ...s, campaigns: [], statuses: null };
    case 'audience':
      return { ...s, market: null };
    case 'attribution':
      return { ...s, model: d.model };
  }
}

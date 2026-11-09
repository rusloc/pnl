import { useId, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { FILTERS, HOW_TO_READ, STATUS_NAMES } from '@/lib/engine/copy';
import type { ViewKey } from '@/lib/engine/copy';
import { shortDate } from '@/lib/engine/format';
import type { ModelCode, Status } from '@/lib/data/manifest';
import { DEFAULT_STATUSES } from '@/lib/engine/selection';
import type { Selection } from '@/lib/engine/selection';
import type { Chip, cardInfo, dynamics, options, preview } from '@/lib/engine/view';
import { COMPARATORS, GRAINS, PRESETS } from '@/lib/engine/windows';
import { LineChart, tickIndices } from './charts';

// The layers (contract §5.3–§5.5, A-59): ⓘ pop-over, How to read, the single-metric dynamics window and the Filters
// window. MarketingApp owns which one is open (one at a time), the scrim, Esc / outside click / × and the focus trap;
// these components render view-model text and report picks.

export type FilterGroup = keyof typeof FILTERS.rail;
export const GROUPS = Object.keys(FILTERS.rail) as FilterGroup[];

export function Close({ label = 'Close' }: { label?: string }) {
  return (
    <button type="button" className="x" aria-label={label} data-close="">
      ×
    </button>
  );
}

export function InfoPop({ info, style }: { info: ReturnType<typeof cardInfo>; style: CSSProperties }) {
  return (
    <div className="pop glass" role="dialog" aria-modal="true" aria-labelledby="pop-title" style={style}>
      <div className="pop-h">
        <h2 id="pop-title">{info.title}</h2>
        <Close />
      </div>
      <p className="what">{info.what}</p>
      <p className="formula">{info.formula}</p>
      <p className="note">{info.note}</p>
    </div>
  );
}

export function HowPop({ view }: { view: ViewKey }) {
  return (
    <div className="how glass" role="dialog" aria-modal="true" aria-labelledby="how-title">
      <div className="pop-h">
        <h2 id="how-title">{HOW_TO_READ.title}</h2>
        <Close />
      </div>
      {HOW_TO_READ.text[view].map((t, i) => (
        <p key={i}>{t}</p>
      ))}
    </div>
  );
}

export function DynamicsPop({ v }: { v: ReturnType<typeof dynamics> }) {
  const pts = v.points.map((p) => ({
    axis: shortDate(p.day),
    value: p.value,
    ly: p.ly,
    tip: `${shortDate(p.day)}: ${p.value === null ? '—' : v.fmt(p.value)} | LY ${p.ly === null ? '—' : v.fmt(p.ly)}`,
  }));
  return (
    <div className="win dyn glass" role="dialog" aria-modal="true" aria-labelledby="dyn-title">
      <div className="pop-h">
        <h2 id="dyn-title">{v.title}</h2>
        <Close />
      </div>
      <LineChart
        width={846}
        height={480}
        points={pts}
        ticks={tickIndices(pts.length, 5)}
        axis={v.fmt}
        lastLabel={v.lastLabel}
      />
    </div>
  );
}

// ---------- Filters window ----------

type Opts = ReturnType<typeof options>;

function Tiles<T extends string>({
  label,
  items,
  isOn,
  onToggle,
  multi = false,
}: {
  label: string;
  items: readonly { code: T; name: string }[];
  isOn: (c: T) => boolean;
  onToggle: (c: T) => void;
  multi?: boolean;
}) {
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    btns[(i + dir + btns.length) % btns.length]?.focus();
    e.preventDefault();
  };
  return (
    <div className="tiles" role={multi ? 'group' : 'radiogroup'} aria-label={label} onKeyDown={onKeyDown}>
      {items.map((it) => (
        <button
          key={it.code}
          type="button"
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={isOn(it.code)}
          onClick={() => onToggle(it.code)}
        >
          {it.name}
        </button>
      ))}
    </div>
  );
}

const toggle = <T,>(xs: readonly T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export interface FiltersProps {
  opts: Opts;
  pending: Selection;
  set: (next: Selection) => void;
  group: FilterGroup;
  setGroup: (g: FilterGroup) => void;
  dots: Record<FilterGroup, number>;
  pv: ReturnType<typeof preview>;
  toIso: (ix: number) => string;
  toIx: (iso: string) => number;
  defaultWindow: { from: number; to: number };
  onApply: () => void;
  onResetGroup: () => void;
  onResetAll: () => void;
}

export function FiltersWindow(p: FiltersProps) {
  const titleId = useId();
  return (
    <div className="win filters glass" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="pop-h">
        <h2 id={titleId}>{FILTERS.title}</h2>
        <Close />
      </div>
      <div className="fw">
        <nav className="rail" aria-label={FILTERS.title}>
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-current={p.group === g ? 'true' : undefined}
              onClick={() => p.setGroup(g)}
            >
              {FILTERS.rail[g]}
              {p.dots[g] > 0 ? <i className="dot" aria-label={`${p.dots[g]} active`} /> : null}
            </button>
          ))}
        </nav>
        <div className="fmain">
          <Group {...p} />
        </div>
        <aside className="fprev" aria-live="polite">
          <dl>
            <dt>Spend</dt>
            <dd>{p.pv.spend}</dd>
            <dt>Paid customers</dt>
            <dd>{p.pv.paid}</dd>
            <dt>CAC</dt>
            <dd>{p.pv.cac}</dd>
          </dl>
          <p className="pv-pill">{p.pv.pill}</p>
          <p className="pv-counts">{p.pv.counts}</p>
          <ul className="pv-chips">
            {p.pv.chips.map((c: Chip) => (
              <li key={c.facet}>{c.label}</li>
            ))}
          </ul>
        </aside>
      </div>
      <footer className="ffoot">
        <button type="button" className="ghost" onClick={p.onResetGroup}>
          {FILTERS.resetGroup}
        </button>
        <button type="button" className="ghost" onClick={p.onResetAll}>
          {FILTERS.resetAll}
        </button>
        <button type="button" className="primary" onClick={p.onApply}>
          {FILTERS.apply}
        </button>
      </footer>
    </div>
  );
}

function Group(p: FiltersProps) {
  const { opts, pending: s, set } = p;
  switch (p.group) {
    case 'period': {
      const custom = s.preset === 'custom';
      const from = s.from ?? p.defaultWindow.from;
      const to = s.to ?? p.defaultWindow.to;
      return (
        <>
          <h3>{FILTERS.rail.period}</h3>
          <Tiles
            label={FILTERS.rail.period}
            items={PRESETS.map((x) => ({ code: x, name: FILTERS.presets[x] }))}
            isOn={(x) => s.preset === x}
            onToggle={(x) =>
              set({ ...s, preset: x, from: x === 'custom' ? from : null, to: x === 'custom' ? to : null })
            }
          />
          <div className="dates">
            <label>
              From
              <input
                type="date"
                disabled={!custom}
                min={opts.range.first}
                max={opts.range.last}
                value={p.toIso(from)}
                onChange={(e) => e.target.value && set({ ...s, from: p.toIx(e.target.value) })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                disabled={!custom}
                min={opts.range.first}
                max={opts.range.last}
                value={p.toIso(to)}
                onChange={(e) => e.target.value && set({ ...s, to: p.toIx(e.target.value) })}
              />
            </label>
          </div>
          <h4>{FILTERS.comparison}</h4>
          <Tiles
            label={FILTERS.comparison}
            items={COMPARATORS.map((x) => ({ code: x, name: FILTERS.comparators[x] }))}
            isOn={(x) => s.cmp === x}
            onToggle={(x) => set({ ...s, cmp: x })}
          />
          <h4>Granularity</h4>
          <Tiles
            label="Granularity"
            items={GRAINS.map((x) => ({ code: x, name: FILTERS.grains[x] }))}
            isOn={(x) => s.grain === x}
            onToggle={(x) => set({ ...s, grain: x })}
          />
        </>
      );
    }
    case 'scope':
      return (
        <>
          <h3>{FILTERS.rail.scope}</h3>
          <h4>Platform</h4>
          <Tiles
            multi
            label="Platform"
            items={opts.platforms}
            isOn={(x) => s.platforms.includes(x)}
            onToggle={(x) => {
              const next = opts.platforms.map((q) => q.code).filter((c) => toggle(s.platforms, x).includes(c));
              set({ ...s, platforms: next.length === opts.platforms.length ? [] : next });
            }}
          />
          <h4>Tier</h4>
          <Tiles
            label="Tier"
            items={opts.tiers}
            isOn={(x) => s.tier === x}
            onToggle={(x) => set({ ...s, tier: s.tier === x ? null : x })}
          />
        </>
      );
    case 'channels':
      return (
        <>
          <h3>{FILTERS.rail.channels}</h3>
          <ul className="treeview">
            {opts.channels.map((c) => {
              const on = s.channels.includes(c.code);
              const some = c.networks.some((n) => s.networks.includes(n.code));
              return (
                <li key={c.code}>
                  <label>
                    <input
                      type="checkbox"
                      checked={on}
                      ref={(el) => {
                        if (el) el.indeterminate = !on && some;
                      }}
                      onChange={() => set({ ...s, channels: orderBy(opts.channels, toggle(s.channels, c.code)) })}
                    />
                    <i className="sw" style={{ background: `var(--ch-${c.code})` }} />
                    {c.name}
                  </label>
                  <ul>
                    {c.networks.map((n) => (
                      <li key={n.code}>
                        <label>
                          <input
                            type="checkbox"
                            checked={s.networks.includes(n.code)}
                            onChange={() => set({ ...s, networks: toggle(s.networks, n.code) })}
                          />
                          {n.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      );
    case 'campaigns':
      return <CampaignsGroup {...p} />;
    case 'audience':
      return (
        <>
          <h3>{FILTERS.rail.audience}</h3>
          <label className="select">
            Market
            <select value={s.market ?? ''} onChange={(e) => set({ ...s, market: e.target.value || null })}>
              <option value="">All</option>
              {opts.markets.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </>
      );
    case 'attribution':
      return (
        <>
          <h3>{FILTERS.rail.attribution}</h3>
          <Tiles<ModelCode>
            label={FILTERS.rail.attribution}
            items={opts.models}
            isOn={(x) => s.model === x}
            onToggle={(x) => set({ ...s, model: x })}
          />
        </>
      );
  }
}

const orderBy = (all: readonly { code: string }[], picks: readonly string[]) =>
  all.map((x) => x.code).filter((c) => picks.includes(c));

function CampaignsGroup(p: FiltersProps) {
  const { opts, pending: s, set } = p;
  const [q, setQ] = useState('');
  const st = s.statuses ?? DEFAULT_STATUSES;
  const list = useMemo(
    () => opts.campaigns.filter((c) => st.includes(c.status) && c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [opts.campaigns, st, q],
  );
  const statusItems = (Object.keys(STATUS_NAMES) as Status[]).map((c) => ({ code: c, name: STATUS_NAMES[c] }));
  return (
    <>
      <h3>{FILTERS.rail.campaigns}</h3>
      <Tiles<Status>
        multi
        label="Status"
        items={statusItems}
        isOn={(x) => st.includes(x)}
        onToggle={(x) => {
          const next = statusItems.map((i) => i.code).filter((c) => toggle(st, x).includes(c));
          set({ ...s, statuses: next.length === 0 ? null : next });
        }}
      />
      <input
        type="search"
        className="search"
        placeholder="Search campaigns"
        aria-label="Search campaigns"
        value={q}
        maxLength={64}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="clist">
        {list.map((c) => (
          <li key={c.key}>
            <label>
              <input
                type="checkbox"
                checked={s.campaigns.includes(c.key)}
                onChange={() =>
                  set({
                    ...s,
                    campaigns: opts.campaigns.map((x) => x.key).filter((k) => toggle(s.campaigns, c.key).includes(k)),
                  })
                }
              />
              {c.name}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

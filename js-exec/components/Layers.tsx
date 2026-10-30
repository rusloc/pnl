import { Fragment, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { ACTUAL_LABEL, ATTRIBUTES, NO_BASIS_VALUE, SWITCH_LABELS } from '@/lib/engine/copy';
import type { AttrKey } from '@/lib/engine/copy';
import type { Selection } from '@/lib/engine/url-state';
import { NA } from '@/lib/engine/view';
import type { CardView, CategoryMenu, Chip, DashboardView, MenuView } from '@/lib/engine/view';
import { DrillIcon, InfoIcon, MixBar, RichText, Spark } from './ui';

// The frosted layers (E-52 … E-59): Filters menu, ⓘ explanation, drill path, How to read and the More-KPIs drawer.
// ExecApp owns which one is open and the focus; LayerFrame gives every layer the same scrim; the rest render
// view-model text.

export type LayerKind = 'menu' | 'how' | 'more' | 'explain' | 'drill';

const FRAME = {
  menu: { tag: 'aside', className: 'menu glass', labelledBy: 'menu-title' },
  more: { tag: 'aside', className: 'drawer glass', labelledBy: 'drawer-title' },
  pop: { tag: 'div', className: 'pop glass', labelledBy: 'pop-title' },
} as const;

/** One overlay for every layer (USER 2026-10-29): the same scrim (globals.css .scrim, above the side bar, below the
 *  panel) under each side-bar panel and card pop-up; a click on it closes. The panel is the modal dialog. */
export function LayerFrame({
  kind,
  onClose,
  onClick,
  panelRef,
  children,
}: {
  kind: LayerKind;
  onClose: () => void;
  onClick: (e: ReactMouseEvent) => void;
  panelRef: (el: HTMLElement | null) => void;
  children: ReactNode;
}) {
  const f = FRAME[kind === 'menu' || kind === 'more' ? kind : 'pop'];
  const Panel = f.tag;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <Panel
        ref={panelRef}
        className={f.className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={f.labelledBy}
        tabIndex={-1}
        onClick={onClick}
      >
        {children}
      </Panel>
    </>
  );
}

function Close() {
  return (
    <button type="button" className="x" aria-label="Close" data-close="">
      ×
    </button>
  );
}

function Head({ eyebrow, title, word, status }: { eyebrow: string; title: string; word?: string; status?: string }) {
  return (
    <div className="pop-h">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 id="pop-title">{title}</h2>
      </div>
      {word ? <span className={`word ${status ?? ''}`}>{word}</span> : null}
      <Close />
    </div>
  );
}

const STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Single-select chip row as a radio group (period picker, E-90): one tab stop on the checked chip, arrows move and
 *  select (the WAI-ARIA radio-group pattern), Home / End jump. */
function Radios({
  label,
  chips,
  onSelect,
  className = 'chips',
}: {
  label: string;
  chips: readonly Chip[];
  onSelect: (next: Selection) => void;
  className?: string;
}) {
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = chips.findIndex((c) => c.checked);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : i + (STEP[e.key] ?? NaN);
    const next = chips[(j + chips.length) % chips.length];
    if (Number.isNaN(j) || !next) return;
    e.preventDefault();
    e.currentTarget.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
    onSelect(next.next);
  };
  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          className="chip"
          aria-checked={c.checked}
          tabIndex={c.checked ? 0 : -1}
          data-id={c.id}
          onClick={() => onSelect(c.next)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Category dropdown (E-100): a button showing the pick ("All categories", a name, two names, "n categories") opens a
 *  list of checkboxes (names only, menu order); "All categories" clears the pick. Esc closes the list, not the menu. */
function CategoryDropdown({ menu, onSelect }: { menu: CategoryMenu; onSelect: (next: Selection) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useId();
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault(); // handled: the layer's Esc listener on document skips a prevented Esc (React's root is document)
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div className="dd" onKeyDown={onKeyDown}>
      <div className="gh">{menu.label}</div>
      <button
        ref={button}
        type="button"
        className="dd-b"
        aria-label={`${menu.label}: ${menu.summary}`}
        aria-expanded={open}
        aria-controls={list}
        title={menu.title ?? undefined}
        onClick={() => setOpen((o) => !o)}
        data-dd=""
      >
        <span>{menu.summary}</span>
        <span className="dd-c" aria-hidden="true" />
      </button>
      <div id={list} role="group" aria-label={menu.label} className="dd-l" hidden={!open}>
        {[menu.all, ...menu.options].map((o) => (
          <button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={o.checked}
            className="dd-o"
            data-id={o.id}
            onClick={() => onSelect(o.next)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FiltersMenu({
  sel,
  menu,
  onSelect,
  onToggle,
  onReset,
}: {
  sel: Selection;
  menu: MenuView;
  onSelect: (next: Selection) => void;
  onToggle: (key: AttrKey, code: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="mh">
        <h2 id="menu-title">Filters</h2>
        <button type="button" className="reset" onClick={onReset} data-reset="">
          Reset
        </button>
        <Close />
      </div>
      <div className="hint">Status is always vs budget or target; the comparator changes the Δ line.</div>
      <div className="gh">{SWITCH_LABELS.granularity.label}</div>
      <Radios label="Period type" chips={menu.granularity} onSelect={onSelect} />
      {menu.fy ? <Radios label="Fiscal year" chips={menu.fy} onSelect={onSelect} className="chips row2" /> : null}
      <Radios
        label="Period"
        chips={menu.items}
        onSelect={onSelect}
        className={menu.itemGrid ? 'chips row2 items' : 'chips row2'}
      />
      <div className="showing" aria-live="polite">
        Showing <RichText rich={menu.showing} />
      </div>
      {[
        { key: 'compare', label: SWITCH_LABELS.compare.label, chips: menu.compare },
        { key: 'region', label: SWITCH_LABELS.region.label, chips: menu.region },
      ].map((g) => (
        <div key={g.key}>
          <div className="gh">{g.label}</div>
          <div className="chips">
            {g.chips.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={c.checked}
                onClick={() => onSelect(c.next)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <CategoryDropdown menu={menu.category} onSelect={onSelect} />
      <div className="gh sec">
        Metric attributes <span>OR within a group · AND across groups</span>
      </div>
      {ATTRIBUTES.map((a) => (
        <div key={a.key}>
          <div className="gh">{a.label}</div>
          <div className="chips">
            {a.options.map(([code, label]) => (
              <button
                key={code}
                type="button"
                className="chip"
                aria-pressed={sel.picks[a.key].includes(code)}
                onClick={() => onToggle(a.key, code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function ExplainPop({ card, onDrill }: { card: CardView; onDrill: () => void }) {
  const e = card.explain;
  return (
    <>
      <Head eyebrow={e.eyebrow} title={card.title} word={card.word} status={card.status} />
      <div className="pop-v">
        <div>
          {/* figure block (USER 2026-10-30, shared with the PBI flavour): Actual → value, basis → value, stacked; one
              dt / dd pair each, so a screen reader reads the label with its number */}
          <dl className="fig">
            <div>
              <dt>{ACTUAL_LABEL}</dt>
              <dd className="big">
                {card.value}
                <small>{card.unit}</small>
              </dd>
            </div>
            {card.target ? (
              <div className="tgt">
                <dt>{card.target.label}</dt>
                {card.target.value === NA ? (
                  <dd className="none">{NO_BASIS_VALUE}</dd>
                ) : (
                  <dd>
                    {card.target.value}
                    <small>{card.target.unit}</small>
                  </dd>
                )}
              </div>
            ) : null}
          </dl>
          <div
            className="delta"
            style={{ color: `var(--${card.status === 'na' || card.deltaNa ? 'muted' : card.status})` }}
          >
            {e.delta}
          </div>
        </div>
        {card.mix ? <MixBar mix={card.mix} /> : null}
        {card.bars ? (
          <Spark
            values={card.bars.values}
            target={card.bars.target}
            width={240}
            height={72}
            labels={card.bars.labels}
          />
        ) : null}
      </div>
      <div className="stats">
        {e.stats.map(([label, value]) => (
          <div key={label}>
            {label}
            <b>{value}</b>
          </div>
        ))}
      </div>
      <dl className="body">
        {e.rows.map(([label, rich]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>
              <RichText rich={rich} />
            </dd>
          </Fragment>
        ))}
      </dl>
      {/* the footer's "Target …" moved under the value (USER 2026-10-29): the remaining note closes the tags row */}
      <div className="tags">
        {e.tags.map(([label, value]) => (
          <span key={label} className="tag">
            {label} <b>{value}</b>
          </span>
        ))}
        <span className="note">{e.updated}</span>
      </div>
      <button type="button" className="pill" onClick={onDrill}>
        <span className="n">
          <DrillIcon />
        </span>
        {e.drillLabel}
      </button>
    </>
  );
}

export function DrillPop({ card, onExplain }: { card: CardView; onExplain: () => void }) {
  const steps = card.drill.steps;
  return (
    <>
      <Head eyebrow={card.drill.eyebrow} title={card.title} word={card.word} status={card.status} />
      <ol className="steps">
        {steps.map(([title, text], i) => (
          <li key={title} className={i === steps.length - 1 ? 'last' : undefined}>
            <b>{title}</b>
            {text}
          </li>
        ))}
      </ol>
      <div className="pop-f">
        <span>Carried on every click: period · region / format · comparator · the metric</span>
      </div>
      <button type="button" className="pill" onClick={onExplain}>
        <span className="n">
          <InfoIcon />
        </span>
        Back to the explanation
      </button>
    </>
  );
}

export function HowPop({ how }: { how: DashboardView['how'] }) {
  return (
    <>
      <Head eyebrow={how.eyebrow} title="How to read this page" />
      <ul className="plain">
        {how.bullets.map((rich, i) => (
          <li key={i}>
            <RichText rich={rich} />
          </li>
        ))}
      </ul>
      <div className="pop-f">
        <span>{how.foot[0]}</span>
        <span>
          <b>{how.foot[1]}</b>
        </span>
      </div>
    </>
  );
}

export function BenchDrawer({ bench }: { bench: DashboardView['bench'] }) {
  return (
    <>
      <div className="pop-h">
        <div>
          <div className="eyebrow">KPI bench · inactive, switched on per client</div>
          <h2 id="drawer-title">More KPIs · {bench.count}</h2>
        </div>
        <Close />
      </div>
      {bench.domains.map((d) => (
        <div key={d.domain}>
          <div className="dom">{d.domain}</div>
          {d.items.map(([name, formula, owner]) => (
            <div key={name} className="bk">
              <div>
                <b>{name}</b>
                <span>{formula}</span>
              </div>
              <span className="o">{owner}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

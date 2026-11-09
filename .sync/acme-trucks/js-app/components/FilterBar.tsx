'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { WORK_TYPES } from '@/lib/data/manifest';
import type { WorkType } from '@/lib/data/manifest';
import { FILTERS } from '@/lib/engine/copy';
import type { Dataset } from '@/lib/engine/data';
import { loaderList, officeList } from '@/lib/engine/scope';
import { DEFAULT_WORK_TYPES } from '@/lib/engine/selection';
import type { Calculation, PlanType, Selection } from '@/lib/engine/selection';
import type { Chip } from '@/lib/engine/view';

// Filter chips and their popovers (contract §5.3): one open at a time; Esc, a click outside and Done close it, and focus
// returns to the chip. Week / Office / Work type / Loader hold pending picks until Done (Clear = that filter's Reset
// value); Plan type / Calculation apply on click and close.

type Key = Chip['key'];

interface PopoverProps {
  ds: Dataset;
  sel: Selection;
  apply: (next: Selection) => void;
}

const FOCUSABLE = 'input:not([type="search"]),button[role="radio"]';

function moveFocus(e: ReactKeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const at = items.indexOf(document.activeElement as HTMLElement);
  items[e.key === 'ArrowDown' ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0)]?.focus();
}

function Check(props: { label: string; checked: boolean; onChange: () => void; strong?: boolean }) {
  return (
    <label className={props.strong ? 'opt opt-strong' : 'opt'}>
      <input type="checkbox" checked={props.checked} onChange={props.onChange} />
      {props.label}
    </label>
  );
}

function Footer({ onClear, onDone }: { onClear: () => void; onDone: () => void }) {
  return (
    <div className="pop-footer">
      <button type="button" className="btn" onClick={onClear}>
        {FILTERS.clear}
      </button>
      <button type="button" className="btn btn-primary" onClick={onDone}>
        {FILTERS.done}
      </button>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="pop-title">{title}</div>
      {children}
    </>
  );
}

function WeekPop({ ds, sel, apply }: PopoverProps) {
  const [pending, setPending] = useState(sel.week);
  return (
    <Shell title={FILTERS.week}>
      <div className="pop-list" onKeyDown={moveFocus}>
        <Check label={FILTERS.selectAll} strong checked={pending === null} onChange={() => setPending(null)} />
        {ds.m.weeks.map((w) => (
          <Check
            key={w.week_ix}
            label={w.week_label}
            checked={pending === null || pending === w.week_ix}
            onChange={() => setPending(pending === w.week_ix ? null : w.week_ix)}
          />
        ))}
      </div>
      <Footer onClear={() => apply({ ...sel, week: null })} onDone={() => apply({ ...sel, week: pending })} />
    </Shell>
  );
}

/** Multi-select state over a cross-filtered list: all picked (or none) means no filter; hidden picks stay picked (§3.1). */
function useMultiPicks(current: readonly string[], list: readonly string[]) {
  const [pending, setPending] = useState(() => new Set(current.length > 0 ? current : list));
  const toggle = (x: string) =>
    setPending((p) => {
      const n = new Set(p);
      if (!n.delete(x)) n.add(x);
      return n;
    });
  const setAll = (items: readonly string[], on: boolean) =>
    setPending((p) => {
      const n = new Set(p);
      for (const x of items) {
        if (on) n.add(x);
        else n.delete(x);
      }
      return n;
    });
  const result = (order: readonly string[]) => {
    const everyListed = list.every((x) => pending.has(x)) && [...pending].every((x) => list.includes(x));
    return everyListed || pending.size === 0 ? [] : order.filter((x) => pending.has(x));
  };
  return { pending, toggle, setAll, result };
}

function OfficePop({ ds, sel, apply }: PopoverProps) {
  const list = officeList(ds, sel);
  const order = ds.m.offices.map((o) => o.office_name);
  const m = useMultiPicks(sel.offices, list);
  const all = list.every((x) => m.pending.has(x));
  return (
    <Shell title={FILTERS.office}>
      <div className="pop-list" onKeyDown={moveFocus}>
        <Check label={FILTERS.selectAll} strong checked={all} onChange={() => m.setAll(list, !all)} />
        {list.map((o) => (
          <Check key={o} label={o} checked={m.pending.has(o)} onChange={() => m.toggle(o)} />
        ))}
      </div>
      <Footer
        onClear={() => apply({ ...sel, offices: [] })}
        onDone={() => apply({ ...sel, offices: m.result(order) })}
      />
    </Shell>
  );
}

function LoaderPop({ ds, sel, apply }: PopoverProps) {
  const list = loaderList(ds, sel);
  const order = ds.m.loaders.map((l) => l.loader_name);
  const m = useMultiPicks(sel.loaders, list);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = q ? list.filter((x) => x.toLowerCase().includes(q)) : list;
  const all = visible.length > 0 && visible.every((x) => m.pending.has(x));
  return (
    <Shell title={FILTERS.loader}>
      <div className="pop-search">
        <input
          type="search"
          aria-label={FILTERS.searchLabel}
          placeholder={FILTERS.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="pop-list" onKeyDown={moveFocus}>
        <Check label={FILTERS.selectAll} strong checked={all} onChange={() => m.setAll(visible, !all)} />
        {visible.map((l) => (
          <Check key={l} label={l} checked={m.pending.has(l)} onChange={() => m.toggle(l)} />
        ))}
      </div>
      <Footer
        onClear={() => apply({ ...sel, loaders: [] })}
        onDone={() => apply({ ...sel, loaders: m.result(order) })}
      />
    </Shell>
  );
}

function WorkTypePop({ sel, apply }: PopoverProps) {
  const [pending, setPending] = useState<readonly WorkType[]>(sel.workTypes);
  const toggle = (t: WorkType) =>
    setPending((p) => {
      if (!p.includes(t)) return WORK_TYPES.filter((x) => p.includes(x) || x === t);
      return p.length === 1 ? p : p.filter((x) => x !== t); // Work type keeps ≥ 1 pick (§3.1)
    });
  return (
    <Shell title={FILTERS.workType}>
      <div className="pop-list" onKeyDown={moveFocus}>
        {WORK_TYPES.map((t) => (
          <Check key={t} label={t} checked={pending.includes(t)} onChange={() => toggle(t)} />
        ))}
      </div>
      <Footer
        onClear={() => apply({ ...sel, workTypes: [...DEFAULT_WORK_TYPES] })}
        onDone={() => apply({ ...sel, workTypes: [...pending] })}
      />
    </Shell>
  );
}

function Radios<T extends string>(props: { title: string; options: readonly T[]; value: T; onPick: (v: T) => void }) {
  return (
    <Shell title={props.title}>
      <div className="pop-radios" role="radiogroup" aria-label={props.title} onKeyDown={moveFocus}>
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === props.value}
            className="radio"
            onClick={() => props.onPick(o)}
          >
            <i aria-hidden="true" className={o === props.value ? 'radio-dot on' : 'radio-dot'} />
            {o}
          </button>
        ))}
      </div>
    </Shell>
  );
}

const PLAN_TYPES: readonly PlanType[] = ['Month', 'Week'];
const CALCULATIONS: readonly Calculation[] = ['Linear', 'Weighted'];

function PopoverBody({ open, ...p }: PopoverProps & { open: Key }) {
  switch (open) {
    case 'week':
      return <WeekPop {...p} />;
    case 'office':
      return <OfficePop {...p} />;
    case 'loader':
      return <LoaderPop {...p} />;
    case 'workType':
      return <WorkTypePop {...p} />;
    case 'planType':
      return (
        <Radios
          title={FILTERS.planType}
          options={PLAN_TYPES}
          value={p.sel.planType}
          onPick={(planType) => p.apply({ ...p.sel, planType })}
        />
      );
    case 'calculation':
      return (
        <Radios
          title={FILTERS.calculation}
          options={CALCULATIONS}
          value={p.sel.calculation}
          onPick={(calculation) => p.apply({ ...p.sel, calculation })}
        />
      );
  }
}

export function FilterBar(props: {
  ds: Dataset;
  sel: Selection;
  chips: Chip[];
  onApply: (next: Selection) => void;
  onReset: () => void;
  resetLabel: string;
}) {
  const [open, setOpen] = useState<Key | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const chipOf = (k: Key) => barRef.current?.querySelector<HTMLButtonElement>(`[data-chip="${k}"]`);
  const close = (k: Key) => {
    setOpen(null);
    chipOf(k)?.focus();
  };

  useEffect(() => {
    if (open === null) return;
    popRef.current?.querySelector<HTMLElement>('input,button')?.focus();
    const ctrl = new AbortController();
    const shut = () => {
      setOpen(null);
      barRef.current?.querySelector<HTMLButtonElement>(`[data-chip="${open}"]`)?.focus();
    };
    document.addEventListener('keydown', (e) => e.key === 'Escape' && shut(), { signal: ctrl.signal });
    document.addEventListener(
      'mousedown',
      (e) => {
        const t = e.target as Node;
        const chip = barRef.current?.querySelector(`[data-chip="${open}"]`);
        if (popRef.current?.contains(t) || chip?.contains(t)) return;
        e.preventDefault(); // or the browser's default moves focus to the clicked element, away from the chip (§1)
        shut();
      },
      { signal: ctrl.signal },
    );
    return () => ctrl.abort();
  }, [open]);

  return (
    <div className="filters" ref={barRef}>
      {props.chips.map((c) => (
        <button
          key={c.key}
          type="button"
          data-chip={c.key}
          className={`chip chip-${c.key}`}
          aria-expanded={open === c.key}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => (o === c.key ? null : c.key))}
        >
          <span className="chip-label">{c.label}</span>
          <span className="chip-value" title={c.value}>
            {c.value}
          </span>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="#5B6B7D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
      <button type="button" className="reset" onClick={props.onReset}>
        {props.resetLabel}
      </button>
      {open !== null ? (
        <div
          className={`pop pop-${open}`}
          role="dialog"
          aria-label={props.chips.find((c) => c.key === open)?.label}
          ref={popRef}
        >
          <PopoverBody
            key={open}
            open={open}
            ds={props.ds}
            sel={props.sel}
            apply={(next) => {
              props.onApply(next);
              close(open);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

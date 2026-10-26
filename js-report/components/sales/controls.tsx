import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import styles from './sales.module.css';

// Keyboard-complete controls (WAI-ARIA radio group and tabs patterns: roving tabindex, arrows / Home / End).

function roving<T>(
  e: KeyboardEvent,
  values: readonly T[],
  current: T,
  pick: (v: T) => void,
  focus: (i: number) => void,
) {
  const i = values.indexOf(current);
  const n = values.length;
  const next =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? (i - 1 + n) % n
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? n - 1
            : -1;
  if (next < 0) return;
  e.preventDefault();
  const v = values[next];
  if (v === undefined) return;
  pick(v);
  focus(next);
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  x,
}: {
  label: string;
  options: readonly { value: T; label: string; width: number }[];
  value: T;
  onChange: (v: T) => void;
  x: number;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const width = options.reduce((s, o) => s + o.width, 0) + 2;
  return (
    <div
      className={`${styles.abs} ${styles.seg}`}
      style={{ left: x, top: 20, width }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          style={{ width: o.width }}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) =>
            roving(
              e,
              options.map((p) => p.value),
              value,
              onChange,
              (k) => refs.current[k]?.focus(),
            )
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  panelId,
}: {
  tabs: readonly { value: T; label: string; width: number }[];
  value: T;
  onChange: (v: T) => void;
  panelId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={`${styles.abs} ${styles.tabs}`} role="tablist" aria-label="Views">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          id={`tab-${t.value}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          aria-controls={panelId}
          tabIndex={t.value === value ? 0 : -1}
          style={{ width: t.width }}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) =>
            roving(
              e,
              tabs.map((p) => p.value),
              value,
              onChange,
              (k) => refs.current[k]?.focus(),
            )
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Closes on Escape and on a pointer press outside `ref`, while `open`. */
function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close(), { signal: ctrl.signal });
    document.addEventListener(
      'pointerdown',
      (e) => e.target instanceof Node && !ref.current?.contains(e.target) && close(),
      { signal: ctrl.signal },
    );
    return () => ctrl.abort();
  }, [open, ref, close]);
}

/** ⓘ button with a pop-up of the card's definition (design-tokens §5 title row). */
export function InfoButton({ text, label, up = false }: { text: string; label: string; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, ref, close);
  return (
    <span className={styles.infoWrap} ref={ref}>
      <button
        type="button"
        className={styles.infoBtn}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={styles.icon} aria-hidden="true">
          i
        </i>
      </button>
      {open ? (
        <span id={id} role="note" className={`${styles.pop} ${up ? styles.popUp : ''}`}>
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function HowToRead({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, ref, close);
  return (
    <span className={styles.infoWrap} ref={ref}>
      <button
        type="button"
        className={styles.linkBtn}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={styles.icon} aria-hidden="true">
          i
        </i>
        How to read
      </button>
      {open ? (
        <span id={id} role="note" className={styles.pop}>
          {text}
        </span>
      ) : null}
    </span>
  );
}

/** Copies the current URL (the whole state, F-37 analogue). Clipboard can be blocked in a sandboxed iframe. */
export function CopyLink() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      className={styles.linkBtn}
      onClick={() =>
        navigator.clipboard.writeText(window.location.href).then(
          () => setState('copied'),
          () => setState('failed'),
        )
      }
    >
      <span aria-hidden="true">⧉</span>
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy blocked' : 'Copy link'}
      </span>
    </button>
  );
}

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import styles from './primitives.module.css';

/**
 * Arrow-key target in a radiogroup (WAI-ARIA radio pattern: → / ↓ next, ← / ↑ previous, wrapping); disabled options
 * are skipped. null = the key is not an arrow or there is nowhere to go.
 */
export function nextChoice(from: number, key: string, count: number, disabled: (i: number) => boolean): number | null {
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return null;
  let i = from;
  for (let n = 1; n < count; n++) {
    i = (i + step + count) % count;
    if (!disabled(i)) return i;
  }
  return null;
}

export interface Choice<T extends string> {
  value: T;
  content: ReactNode;
  className?: string; // CSS-module lookups are string | undefined under noUncheckedIndexedAccess
  style?: CSSProperties;
  /** Shown on hover; the option stays readable by screen readers (aria-disabled), is skipped and does nothing. */
  disabledReason?: string;
}

/**
 * Radiogroup with manual selection (period picker v2): arrow keys move focus, Space or Enter selects. Only the checked
 * option is in the tab order (the first enabled one when none is checked).
 */
export function ChoiceGroup<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
  className,
}: {
  labelledBy: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const tabbable = options.some((o) => o.value === value) ? value : options.find((o) => !o.disabledReason)?.value;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const from = radios.findIndex((r) => r === document.activeElement);
    const to = nextChoice(Math.max(from, 0), e.key, radios.length, (i) => Boolean(options[i]?.disabledReason));
    if (to === null) return;
    e.preventDefault();
    radios[to]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={className} onKeyDown={onKey}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-disabled={o.disabledReason ? true : undefined}
          tabIndex={o.value === tabbable ? 0 : -1}
          title={o.disabledReason}
          className={o.className}
          style={o.style}
          onClick={() => !o.disabledReason && onChange(o.value)}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Reason the option is off; a disabled option always says why (LSN-002). */
  disabledReason?: string;
}

/** Segmented single-select as a radiogroup: arrow keys move between enabled options (N-08). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const enabled = options.filter((o) => !o.disabledReason);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || enabled.length === 0) return;
    e.preventDefault();
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + step + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    e.currentTarget.querySelectorAll('button')[options.indexOf(next)]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${styles.segmented} ${compact ? styles.compact : ''}`}
      onKeyDown={onKey}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          disabled={Boolean(o.disabledReason)}
          title={o.disabledReason}
          className={styles.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
  disabledReason,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabledReason?: string;
}) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span>{label}</span>
        {disabledReason && <span className={styles.switchNote}>{disabledReason}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={Boolean(disabledReason)}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

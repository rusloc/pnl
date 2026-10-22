import type { KeyboardEvent } from 'react';
import styles from './primitives.module.css';

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

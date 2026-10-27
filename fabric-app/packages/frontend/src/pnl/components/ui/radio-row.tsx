// Radiogroup row for the Period panel (period-picker-v2 §Rules, N-08): one
// `role="radio"` button per option, roving tabindex, arrow keys move focus
// (skipping disabled options), Space / Enter select (a button's native click).
// Two looks: `segments` (wrapping pills: Show, Year) and `cells` (a grid with a
// second line: the month grid, where covered months are tinted and the anchor is solid).
import { type KeyboardEvent, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** Second line of a cell ("not closed yet", "forecast", "budget"). */
  sub?: string;
  disabled?: boolean;
  title?: string;
  /** Cell belongs to the covered window (shaded, light company tint). */
  covered?: boolean;
}

interface RadioRowProps<T extends string> {
  label: string;
  value: T;
  options: readonly RadioOption<T>[];
  onChange: (value: T) => void;
  variant?: 'segments' | 'cells';
  /** Grid columns for `cells`; Up / Down move by a row. */
  columns?: number;
  /** id of a visible note that explains the group (e.g. why its options are off). */
  describedBy?: string;
}

export function RadioRow<T extends string>({ label, value, options, onChange, variant = 'segments', columns = 4, describedBy }: RadioRowProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cells = variant === 'cells';
  const enabled = options.map((o) => !o.disabled);
  const checkedIndex = options.findIndex((o) => o.value === value);
  // The checked option is in the tab order; if it is off (or absent), the first enabled one is.
  const tabStop = checkedIndex >= 0 && enabled[checkedIndex] ? checkedIndex : enabled.indexOf(true);

  const move = (from: number, step: number) => {
    const n = options.length;
    for (let k = 1; k <= n; k += 1) {
      const i = (from + step * k + n * k) % n;
      if (enabled[i]) {
        refs.current[i]?.focus();
        return;
      }
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const rowStep = cells ? columns : 1;
    switch (e.key) {
      case 'ArrowRight':
        move(i, 1);
        break;
      case 'ArrowLeft':
        move(i, -1);
        break;
      case 'ArrowDown':
        move(i, rowStep);
        break;
      case 'ArrowUp':
        move(i, -rowStep);
        break;
      case 'Home':
        move(-1, 1);
        break;
      case 'End':
        move(options.length, -1);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn(cells ? 'grid gap-[6px]' : 'flex flex-wrap gap-[6px]')}
      style={cells ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.sub ? `${o.label}, ${o.sub}` : undefined}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex flex-col items-center justify-center rounded-[8px] border font-[inherit] leading-[1.2] -outline-offset-2',
              cells ? 'h-[46px] px-[4px] text-[14px]' : 'h-[36px] px-[12px] text-[13px]',
              o.disabled
                ? 'cursor-not-allowed border-line-200 bg-subtle text-slate-400'
                : checked
                  ? cells
                    ? 'cursor-pointer border-acc bg-acc font-semibold text-surface'
                    : 'cursor-pointer border-acc bg-acc-t font-semibold text-acc'
                  : o.covered
                    ? 'cursor-pointer border-acc-t bg-acc-t text-ink-900'
                    : 'cursor-pointer border-line-300 bg-surface text-ink-900'
            )}
          >
            <span>{o.label}</span>
            {o.sub && <span className="text-[10px] font-normal">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

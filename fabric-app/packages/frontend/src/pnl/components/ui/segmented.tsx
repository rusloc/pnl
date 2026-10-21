// Segmented control (design brief §5.2): 40 high in flyouts (equal columns),
// 36 high in view toolbars (content-sized). Selected = accT / acc / 600.
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** 'grid' = flyout control (40 px, equal columns); 'inline' = toolbar (36 px). */
  variant?: 'grid' | 'inline';
  /** Font size override (the mockup mixes 13 and 14 px). */
  fontSize?: 13 | 14;
  /** id of a visible note that explains the group (e.g. why its options are off). */
  describedBy?: string;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = 'grid',
  fontSize = 13,
  describedBy,
}: SegmentedProps<T>) {
  const grid = variant === 'grid';
  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn(
        'overflow-hidden rounded-[8px] border border-line-300 bg-surface',
        grid ? 'grid h-[40px]' : 'flex h-[36px]'
      )}
      style={grid ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'border-0 font-[inherit] -outline-offset-2',
              i > 0 && 'border-l border-l-line-300',
              grid ? 'px-1' : 'px-[12px]',
              o.disabled
                ? 'cursor-not-allowed bg-subtle text-slate-400'
                : selected
                  ? 'cursor-pointer bg-acc-t font-semibold text-acc'
                  : 'cursor-pointer bg-surface text-ink-900'
            )}
            style={{ fontSize }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

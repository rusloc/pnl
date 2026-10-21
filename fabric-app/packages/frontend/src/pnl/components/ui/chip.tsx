// Multi-select chip (design brief §5.2): pill 40 high, acc border + accT fill
// with a check when selected; Line 300 border, white when not.
import { CheckIcon } from './icons';

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Reason shown on hover when the chip is disabled. */
  title?: string;
}

export function Chip({ label, selected, onToggle, disabled = false, title }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={`inline-flex min-h-[40px] items-center gap-[6px] rounded-[20px] border px-[12px] font-[inherit] text-[13px] ${
        disabled
          ? 'cursor-not-allowed border-dashed border-line-300 bg-subtle text-slate-600'
          : selected
            ? 'cursor-pointer border-acc bg-acc-t text-ink-900'
            : 'cursor-pointer border-line-300 bg-surface text-ink-900'
      }`}
    >
      {selected ? <CheckIcon /> : <span aria-hidden="true" className="inline-block h-[12px] w-[12px]" />}
      {label}
    </button>
  );
}

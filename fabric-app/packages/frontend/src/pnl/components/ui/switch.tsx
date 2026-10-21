// 44 × 26 switch (design brief §5.2): on = acc track, white knob.
import { useId } from 'react';

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  last?: boolean;
}

export function SwitchRow({ label, checked, onChange, last = false }: SwitchRowProps) {
  const id = useId();
  return (
    <div
      className={`flex min-h-[44px] items-center justify-between gap-[12px] ${last ? '' : 'border-b border-line-100'}`}
    >
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`relative h-[26px] w-[44px] flex-none cursor-pointer rounded-[13px] border-0 transition-colors ${
          checked ? 'bg-acc' : 'bg-line-300'
        }`}
      >
        <span
          className="absolute top-[3px] h-[20px] w-[20px] rounded-[10px] bg-surface transition-[left]"
          style={{ left: checked ? 21 : 3 }}
        />
      </button>
    </div>
  );
}

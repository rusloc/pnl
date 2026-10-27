// "How to read" (ADR-0012 §2.3, parity rule 19): one button per view in the
// tabs row that opens a wide glass pop-up with the view's reading guide
// (`model/info-popovers.ts` `howToRead`), opening with the selection sentence.
import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import type { HowToRead } from '../model/info-popovers';
import { GlassDialog } from './glass-dialog';
import { InfoCircleIcon } from './ui/icons';

export function HowToReadButton({ guide }: { guide: HowToRead }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border bg-surface px-[12px] font-[inherit] text-[13px] font-medium',
          open ? 'border-acc text-acc' : 'border-line-300 text-ink-900 hover:border-acc'
        )}
      >
        <InfoCircleIcon size={14} />
        How to read
      </button>
      <GlassDialog open={open} onClose={() => setOpen(false)} rootRef={rootRef} openerRef={buttonRef} title={guide.title} align="end" width={780} testId="how-to-read">
        <dl className="m-0 grid grid-cols-[112px_1fr] gap-x-[14px] gap-y-[6px]">
          {guide.lines.map((l) => (
            <div key={l.label} className="contents">
              <dt className="font-semibold text-slate-600">{l.label}</dt>
              <dd className="m-0">{l.value}</dd>
            </div>
          ))}
        </dl>
      </GlassDialog>
    </span>
  );
}

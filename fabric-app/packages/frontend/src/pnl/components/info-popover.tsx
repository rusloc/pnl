// ⓘ pop-up (ADR-0012 §2.3, parity rule 18): an (i) button in a card's or
// panel's title row that opens a glass pop-up (`glass-dialog.tsx`) with the
// name, what it shows, the formula, the sub-metrics and the source measures
// (`model/info-popovers.ts`, Track B's `dim_pl_info` / `KPI Info Sub`).
import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import type { InfoCopy } from '../model/types';
import { GlassDialog } from './glass-dialog';
import { InfoCircleIcon } from './ui/icons';

/** The sub-metrics line of a card's ⓘ, read from the model in its own zone (`KPI Info Sub`). */
export type InfoDetail = { kind: 'text'; text: string } | { kind: 'loading' } | { kind: 'error'; reason: string } | null;

interface InfoPopoverProps {
  info: InfoCopy;
  detail?: InfoDetail;
  /** Which edge of the button the card aligns to; 'end' for cards at the right of the screen. */
  align?: 'start' | 'end';
}

export function InfoPopover({ info, detail = null, align = 'start' }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <span ref={rootRef} className="relative inline-flex font-ledger text-[14px] font-normal normal-case tracking-normal">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${info.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`About ${info.title}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border bg-surface p-0',
          open ? 'border-acc text-acc' : 'border-line-300 text-slate-600 hover:border-acc hover:text-acc'
        )}
      >
        <InfoCircleIcon size={14} />
      </button>
      <GlassDialog open={open} onClose={() => setOpen(false)} rootRef={rootRef} openerRef={buttonRef} title={info.title} align={align} width={420} testId="info-popover">
        <p className="m-0">{info.what}</p>
        {info.formula && (
          <p className="m-0 mt-[8px] whitespace-pre-wrap rounded-[8px] border border-line-200 bg-subtle/90 px-[8px] py-[5px] font-ledger-condensed text-[12.5px]" data-testid="info-formula">
            {info.formula}
          </p>
        )}
        {info.values.length > 0 && (
          <dl className="m-0 mt-[8px] grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[3px] tabular-nums" data-testid="info-values">
            {info.values.map((v) => (
              <div key={v.label} className="contents">
                <dt className="text-slate-600">{v.label}</dt>
                <dd className="m-0 font-medium">{v.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {detail && (
          <p className="m-0 mt-[8px]" data-testid="info-detail">
            {detail.kind === 'text' ? detail.text : detail.kind === 'loading' ? 'Sub-metrics: reading from the semantic model…' : `Sub-metrics could not be read: ${detail.reason}`}
          </p>
        )}
        {info.source && (
          <span className="mt-[10px] block font-ledger-condensed text-[11px] text-slate-400" data-testid="info-source">
            {info.source}
          </span>
        )}
      </GlassDialog>
    </span>
  );
}

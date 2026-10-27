// Vitals card (redesign v4 build-brief §1; ADR-0012 §2.3): title · ⓘ · status
// chip · value · one row per Compare ("vs Budget  +9.2  +1.4%", "on plan" for a
// zero Δ). No sparklines, no bars, no sub-lines on the face; sub-metrics live in
// the ⓘ. Colour never carries the meaning alone: the sign and the chip word do.
import { cn } from '@/lib/utils';

import type { DeltaTone, VitalsCard as Card } from '../model/types';
import { type InfoDetail, InfoPopover } from './info-popover';

const ROW_TEXT: Record<DeltaTone, string> = {
  ahead: 'text-fav',
  watch: 'text-notice-icon',
  off: 'text-unf',
  plan: 'text-slate-600',
  neutral: 'text-ink-900',
};

const CHIP: Record<Card['status'] extends infer S ? (S extends { kind: infer K } ? K : never) : never, { box: string; dot: string }> = {
  ontrack: { box: 'bg-line-100 text-ink-900', dot: 'bg-slate-400' },
  ahead: { box: 'bg-fav-tint text-fav', dot: 'bg-fav-bar' },
  watch: { box: 'bg-notice-tint text-notice-icon', dot: 'bg-[#D9A441]' },
  off: { box: 'bg-unf-tint text-unf', dot: 'bg-unf' },
};

const VALUE_SIZE: Record<Card['tier'], string> = {
  hero: 'text-[44px]',
  secondary: 'text-[28px]',
  driver: 'text-[30px]',
};

export function VitalsCard({ card, detail }: { card: Card; detail: InfoDetail }) {
  return (
    <article
      aria-label={card.label}
      className={cn(
        'relative box-border flex min-h-0 min-w-0 flex-col rounded-[12px] border border-line-200 px-[16px] py-[12px]',
        card.tier === 'driver' ? 'bg-subtle' : 'bg-surface'
      )}
    >
      <div className="flex items-center gap-[8px] text-[14px] font-medium text-slate-600">
        <h3 className="m-0 truncate text-[14px] font-medium">{card.label}</h3>
        <InfoPopover info={card.info} detail={detail} />
        {card.status && (
          <span
            data-testid="status-chip"
            data-status={card.status.kind}
            className={cn('ml-auto inline-flex items-center gap-[5px] whitespace-nowrap rounded-[12px] py-[2px] pl-[6px] pr-[8px] text-[11px] font-medium', CHIP[card.status.kind].box)}
          >
            <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-full', CHIP[card.status.kind].dot)} />
            {card.status.text}
          </span>
        )}
      </div>
      <div className={cn('mt-auto font-semibold leading-[1.05] tabular-nums', VALUE_SIZE[card.tier])} data-testid="card-value">
        {card.value}
      </div>
      <div className={cn('mb-auto mt-[10px] grid grid-cols-[auto_auto_auto] items-baseline justify-start gap-x-[14px] gap-y-[3px] whitespace-nowrap tabular-nums', card.tier === 'hero' ? 'text-[14px]' : 'text-[13px]')}>
        {card.rows.map((r) => (
          <div key={r.name} className="contents" data-testid="delta-row">
            <span className="text-slate-600">{r.name}</span>
            <span className={cn('text-right', r.tone === 'neutral' || r.tone === 'plan' ? 'font-medium' : 'font-semibold', ROW_TEXT[r.tone])}>{r.abs ?? ''}</span>
            <span className={cn('text-right', r.tone === 'neutral' || r.tone === 'plan' ? 'font-medium' : 'font-semibold', ROW_TEXT[r.tone])}>{r.rel}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

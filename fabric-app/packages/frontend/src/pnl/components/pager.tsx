// In-view pager (ADR-0004 mechanism, parity rule 20): ‹ › and "n / 2" next to
// the tabs on Analysis and Profitability; the ← → keys page too (pnl-app.tsx).
import { cn } from '@/lib/utils';

export const PAGE_COUNT = 2;
export type Page = 1 | 2;

interface PagerProps {
  page: Page;
  onPage: (page: Page) => void;
}

export function Pager({ page, onPage }: PagerProps) {
  const button = 'h-[32px] w-[32px] cursor-pointer rounded-[8px] border border-line-300 bg-surface font-[inherit] text-[18px] leading-none text-ink-900 disabled:cursor-default disabled:text-line-300';
  return (
    <div className="flex items-center gap-[4px] text-[13px] text-slate-600" data-testid="pager">
      <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(1)} className={cn(button)}>
        ‹
      </button>
      <span className="min-w-[44px] text-center tabular-nums" aria-live="polite">
        {page} / {PAGE_COUNT}
      </span>
      <button type="button" aria-label="Next page" disabled={page === PAGE_COUNT} onClick={() => onPage(2)} className={cn(button)}>
        ›
      </button>
    </div>
  );
}

// One comparison row of a Key figures tile (docs/design/kpi-card-v2.md; K-20,
// K-21): "vs Budget", a diverging bar with its centre line at 0 (right =
// favourable on every tile), and the Δ text with its arrow. The bar is drawn
// from `model/compare-bar.ts`; colour never carries the meaning alone — the
// arrow and the sign do too (N-08), so the bar itself is decorative.
import { cn } from '@/lib/utils';

import type { KpiCompare, Tone } from '../model/types';

const FILL: Record<Tone, string> = { fav: 'bg-fav-bar', unf: 'bg-unf-bar', neutral: 'bg-slate-400' };
const TEXT: Record<Tone, string> = { fav: 'text-fav', unf: 'text-unf', neutral: 'text-slate-600' };

function arrowFor(text: string): string {
  return text.startsWith('+') ? '▲' : text.startsWith('−') ? '▼' : '';
}

/** Where the fill sits on the track, as percentages of its width (centre = 50 %). */
function fillExtent(fraction: number): { left: string; width: string } {
  const pct = (v: number) => `${Math.round(v * 100) / 100}%`;
  return { left: pct(50 + Math.min(0, fraction) * 50), width: pct(Math.abs(fraction) * 50) };
}

export function CompareRow({ compare }: { compare: KpiCompare }) {
  const { name, text, tone, bar } = compare;
  return (
    <div className="flex items-center gap-[8px] text-[13px]" data-testid="compare-row">
      <span className="w-[96px] flex-none truncate text-slate-600" title={name}>
        {name}
      </span>
      <span aria-hidden="true" className="relative block h-[8px] min-w-[40px] flex-auto rounded-[2px] bg-line-100" data-testid="compare-bar" data-capped={bar?.capped ? 'true' : undefined}>
        {bar && bar.fraction !== 0 && <span className={cn('absolute inset-y-0 rounded-[2px]', FILL[tone])} style={fillExtent(bar.fraction)} data-testid="compare-fill" />}
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-900/40" />
        {bar?.capped && (
          <svg
            width={6}
            height={8}
            viewBox="0 0 6 8"
            className={cn('absolute top-0', bar.fraction > 0 ? 'right-px' : 'left-px')}
            data-testid="compare-cap"
          >
            <path d={bar.fraction > 0 ? 'M1 1l3 3-3 3' : 'M5 1L2 4l3 3'} fill="none" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={cn('w-[60px] flex-none text-right font-semibold tabular-nums', TEXT[tone])}>
        {bar && (
          <span aria-hidden="true" className="mr-[3px] text-[9px]">
            {arrowFor(text)}
          </span>
        )}
        {text}
      </span>
    </div>
  );
}

// Waterfall (both bridges, redesign v4 page 1): bars from the percentages of
// `model/bridge-geometry.ts` (truncated axis). Totals in the company colour,
// subtotals ink, increases green, decreases orange, FX hatched, P&L levels
// (D&A, adjusting items) slate; value above each bar, the small label under it
// (step % of the comparison, or a level's Δ); dashed connectors at the running
// level. Colour never carries the meaning alone: the signed value does too.
import { cn } from '@/lib/utils';

import { MINUS } from '../../model/format';
import type { Bridge, BridgeKind, BridgeStep } from '../../model/types';

const BAR: Record<BridgeKind, string> = {
  total: 'bg-acc',
  subtotal: 'bg-ink-700',
  fav: 'bg-fav-bar',
  unf: 'bg-unf-bar',
  fx: '',
  level: 'bg-slate-400',
};

const TEXT: Record<BridgeKind, string> = {
  total: 'text-ink-900',
  subtotal: 'text-ink-900',
  fav: 'text-fav',
  unf: 'text-unf',
  fx: 'text-ink-900',
  level: 'text-ink-900',
};

function negative(step: BridgeStep): boolean {
  return step.valueText.startsWith(MINUS);
}

/** Where the running level sits after a bar, as % of the chart height. */
function endPct(step: BridgeStep): number {
  if (step.kind === 'total' || step.kind === 'subtotal') return step.heightPct;
  if (step.kind === 'unf' || ((step.kind === 'fx' || step.kind === 'level') && negative(step))) return step.bottomPct;
  return step.bottomPct + step.heightPct;
}

function hatch(step: BridgeStep): React.CSSProperties {
  const colour = negative(step) ? '#E2804A' : '#3BA37B';
  return { backgroundImage: `repeating-linear-gradient(45deg, ${colour} 0 2.5px, #FFFFFF 2.5px 6px)`, boxShadow: `inset 0 0 0 1px ${colour}` };
}

export function Waterfall({ bridge, dense = false }: { bridge: Bridge; dense?: boolean }) {
  const { steps } = bridge;
  return (
    <div className="flex min-h-0 flex-auto flex-col" data-testid="waterfall">
      <div className="relative mt-[28px] flex min-h-[180px] flex-auto gap-[6px] border-b border-slate-400">
        {steps.map((s, i) => (
          <div key={`${s.label}-${i}`} className="relative min-w-0 flex-[1_1_0]" data-testid="bridge-step" data-kind={s.kind}>
            <div
              className={cn('absolute left-[18%] right-[18%] rounded-t-[3px]', BAR[s.kind])}
              style={{ bottom: `${s.bottomPct}%`, height: `${Math.max(s.heightPct, 0.4)}%`, ...(s.kind === 'fx' ? hatch(s) : {}) }}
            />
            {i < steps.length - 1 && (
              <div aria-hidden="true" className="absolute left-[82%] right-[-24%] border-t border-dashed border-line-300" style={{ bottom: `${endPct(s)}%` }} />
            )}
            <div
              className={cn('absolute left-0 right-0 text-center font-semibold tabular-nums', dense ? 'text-[11.5px]' : 'text-[12.5px]', TEXT[s.kind])}
              style={{ bottom: `calc(${Math.max(endPct(s), s.bottomPct + s.heightPct)}% + 4px)` }}
            >
              {s.valueText}
              {s.sub && <div className="text-[10px] font-normal text-slate-600">{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[6px] pt-[6px]">
        {steps.map((s, i) => (
          <div key={`${s.label}-${i}`} className={cn('min-w-0 flex-[1_1_0] text-center leading-[1.25] text-ink-700', dense ? 'text-[10.5px]' : 'text-[11.5px]')}>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

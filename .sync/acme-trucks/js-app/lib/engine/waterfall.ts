import { isSubtotal } from './hours.ts';
import type { RowShares } from './shares.ts';

// The 19 waterfall rows (contract §3.3, §3.5; TMDL WF Plan / Fact Bar, WF Δ Pill): bar value + start as fractions,
// `Time Share Δ` and the pill tone. Pixel geometry is view.ts's.

export type Tone = 'favourable' | 'unfavourable' | 'neutral';

/** Fill of the Δ pill per tone (WF Δ Pill). */
export const PILL_FILL: Record<Tone, string> = { neutral: '#EEF1F5', favourable: '#E3EEF7', unfavourable: '#FBEADF' };

export interface WaterfallRow {
  sort: number;
  isSubtotal: boolean;
  /** Share for the table text and the tooltip (null = BLANK). */
  plan: number | null;
  fact: number | null;
  /** `Time Share Δ` (fact − plan share, unrounded), BLANK when both sides are blank. */
  delta: number | null;
  /** `COALESCE(Δ, 0) × 100`: the pill's pp, unrounded. */
  pp: number;
  tone: Tone;
  planBar: { value: number; left: number };
  factBar: { value: number; left: number };
}

/** The Δ pill's tone on the unrounded pp (§3.5). */
export function toneOf(pp: number, subtotal: boolean): Tone {
  if (Math.abs(pp) < 0.005) return 'neutral';
  return (subtotal ? pp > 0 : pp < 0) ? 'favourable' : 'unfavourable';
}

/** `Fact − Plan` in DAX: BLANK − x = −x; BLANK − BLANK = BLANK. */
export function timeShareDelta(fact: number | null, plan: number | null): number | null {
  if (fact === null && plan === null) return null;
  return (fact ?? 0) - (plan ?? 0);
}

function bar(r: RowShares): { value: number; left: number } {
  return isSubtotal(r.sort) ? { value: r.subtotal ?? 0, left: 0 } : { value: r.loss ?? 0, left: r.base ?? 0 };
}

export function waterfallRows(plan: readonly RowShares[], fact: readonly RowShares[]): WaterfallRow[] {
  return plan.map((p, i) => {
    const f = fact[i] as RowShares; // both sides hold the same 19 rows in the same order
    const delta = timeShareDelta(f.share, p.share);
    const pp = (delta ?? 0) * 100;
    const subtotal = isSubtotal(p.sort);
    return {
      sort: p.sort,
      isSubtotal: subtotal,
      plan: p.share,
      fact: f.share,
      delta,
      pp,
      tone: toneOf(pp, subtotal),
      planBar: bar(p),
      factBar: bar(f),
    };
  });
}

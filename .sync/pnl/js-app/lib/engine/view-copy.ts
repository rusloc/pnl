import type { Manifest } from '../data/manifest.ts';
import { periodSummary } from './period.ts';
import type { Selection } from './types.ts';
import type { ViewContext } from './view-context.ts';
import type { HowToReadVM, InfoValue } from './view-types.ts';

// "How to read", one per view (ADR-0012 §2.3; copy after the v4 reference HOWTO object, shortened to one line per
// item). Built from the selection (parity rules 6, 7, 13). The statement view keeps its own page top.

const LEGEND =
  'Status vs Budget only: grey on track (±1 % / ±0.3 pp), amber watch (to 3 % / 1 pp), red off track beyond, green ahead; "lower is better" inverts on Opex %. ⓘ on each card holds its definition and sources.';

const BODY: Readonly<Record<Exclude<Selection['view'], 'statement'>, readonly [string, readonly InfoValue[]]>> = {
  kpi: [
    'Vitals',
    [
      {
        label: 'Results',
        value: 'Net revenue, Adj. EBITDA and Operating profit, then Gross margin % and Opex % revenue.',
      },
      {
        label: 'Drivers & health',
        value: 'Five cards whose content follows the company (L-10); FY outlook for every company.',
      },
      {
        label: 'Card face',
        value:
          'Value, Δ vs Compare A and Compare B ($ and %, pp for ratios), “on plan” for a zero Δ, status chip vs Budget.',
      },
    ],
  ],
  analysis: [
    'Analysis',
    [
      {
        label: 'Page 1',
        value:
          'Net revenue bridge (drivers at constant currency → CC subtotal → FX → actual) and profit bridge (comparison Adj. EBITDA → actual → operating profit).',
      },
      {
        label: 'Page 2',
        value:
          'Largest variances to operating profit: Top 8 / 12 / All, by block or by |Δ|, cut by slice, prior-year Δ and of which FX.',
      },
      { label: 'Paging', value: '‹ › in the tabs row, or the ← → keys.' },
      {
        label: 'Colours',
        value:
          'Bridges: increase green, decrease orange, totals company colour, subtotals dark, FX hatched; axes do not start at zero. Variance bars: right helps profit, left hurts, one scale.',
      },
    ],
  ],
  profitability: [
    'Profitability',
    [
      {
        label: 'Page 1',
        value:
          'Table by region at constant currency (status dot on CM Δ only) and concentration bars (share of revenue, contribution and Adj. EBITDA).',
      },
      {
        label: 'Page 2',
        value: 'Growth × margin by region with prior-year trails, and the mix of region × {line}.',
      },
      {
        label: 'Basis',
        value:
          'Constant currency by default when comparing; by region nothing is allocated (opex is booked by region, C-31).',
      },
      { label: 'Paging', value: '‹ › in the tabs row, or the ← → keys.' },
    ],
  ],
};

export function howToRead(m: Manifest, sel: Selection, ctx: ViewContext): HowToReadVM {
  const view = sel.view === 'statement' ? 'kpi' : sel.view;
  const [title, lines] = BODY[view];
  const compare = [ctx.compareA?.name, ctx.compareB?.name].filter(Boolean).join(' and ') || 'Prior year';
  return {
    title: `How to read - ${title}`,
    lines: [
      { label: 'Showing', value: `${periodSummary(m, sel)} - ${sel.currency} ${ctx.unitLabel} - vs ${compare}` },
      ...lines.map((l) => ({
        ...l,
        value: l.value.replace('{line}', ctx.entity === 'S' ? 'service line' : 'category'),
      })),
      { label: 'Legend', value: LEGEND },
    ],
  };
}

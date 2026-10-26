import { clientsView } from './clients.ts';
import { TITLE, periodLine } from './copy.ts';
import { createCube } from './cube.ts';
import { indexDetail, slideOver } from './detail.ts';
import type { DetailIndex } from './detail.ts';
import { loansView } from './loans.ts';
import { createMetrics } from './metrics.ts';
import { overview } from './overview.ts';
import { portfolioView } from './portfolio.ts';
import { revenueView } from './revenue.ts';
import type { Drill, SalesBase, SalesDetail, SalesSelection } from './types.ts';
import { createUrlCodec } from './url-state.ts';
import type { BandVM, HeaderVM, OverviewVM, SlideOverVM } from './view-model.ts';
import { monthKey, monthLabel } from './windows.ts';

// Mirelo sales engine (ADR-0011 (c)): framework-free, the single source of every number and string on /sales.

export type SalesEngine = ReturnType<typeof createSalesEngine>;
export type { DetailIndex };

export function createSalesEngine(base: SalesBase) {
  const cube = createCube(base);
  const ctx = { cube, m: createMetrics(cube) };
  const months = Array.from({ length: cube.closed - cube.first + 1 }, (_, i) => cube.closed - i);
  return {
    codec: createUrlCodec(base.manifest),
    header: (sel: SalesSelection): HeaderVM => ({
      title: TITLE,
      periodLine: periodLine(sel, cube.closed, cube.first),
      months: months.map((i) => ({ value: monthKey(i), label: monthLabel(i) })),
    }),
    overview: (sel: SalesSelection): OverviewVM => overview(ctx, sel),
    band: (sel: SalesSelection, ix: DetailIndex | null): BandVM => {
      switch (sel.view) {
        case 'loans':
          return loansView(ctx, sel);
        case 'clients':
          return clientsView(ctx, sel, ix);
        case 'portfolio':
          return portfolioView(ctx, sel, ix);
        case 'revenue':
          return revenueView(ctx, sel);
        case 'overview':
          throw new Error('band(): Overview is not a band view, use overview()');
      }
    },
    indexDetail: (detail: SalesDetail): DetailIndex => indexDetail(cube, detail),
    slideOver: (sel: SalesSelection, ix: DetailIndex | null, drill: Drill): SlideOverVM =>
      slideOver(cube, ix, sel, drill),
    /** True when the view or the drill reads the lazy detail sample. */
    needsDetail: (sel: SalesSelection): boolean =>
      sel.drill !== null || sel.view === 'clients' || sel.view === 'portfolio',
  };
}

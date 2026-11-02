import { clientsView } from './clients.ts';
import { TITLE, filterLine, howToRead, periodLine } from './copy.ts';
import { createCube } from './cube.ts';
import { detailFiles, slideOver } from './detail.ts';
import { loansView } from './loans.ts';
import { createMetrics } from './metrics.ts';
import { overview } from './overview.ts';
import { portfolioView } from './portfolio.ts';
import { revenueView } from './revenue.ts';
import type { DetailParts, Drill, SalesBase, SalesSelection } from './types.ts';
import { createUrlCodec } from './url-state.ts';
import type { BandVM, HeaderVM, OverviewVM, SlideOverVM } from './view-model.ts';

// Mirelo sales engine (ADR-0011 (c)): framework-free, the single source of every number and string on /sales.

export type SalesEngine = ReturnType<typeof createSalesEngine>;

export function createSalesEngine(base: SalesBase) {
  const cube = createCube(base);
  const ctx = { cube, m: createMetrics(cube) };
  return {
    codec: createUrlCodec(base.manifest),
    header: (sel: SalesSelection): HeaderVM => ({
      title: TITLE,
      periodLine: periodLine(sel, cube.closed, cube.first),
      filterLine: filterLine(sel, cube.closed),
      howToRead: howToRead(sel, cube.closed, cube.first),
      first: cube.first,
      last: cube.closed,
    }),
    overview: (sel: SalesSelection): OverviewVM => overview(ctx, sel),
    band: (sel: SalesSelection): BandVM => {
      switch (sel.view) {
        case 'loans':
          return loansView(ctx, sel);
        case 'clients':
          return clientsView(ctx, sel);
        case 'portfolio':
          return portfolioView(ctx, sel);
        case 'revenue':
          return revenueView(ctx, sel);
        case 'overview':
          throw new Error('band(): Overview is not a band view, use overview()');
      }
    },
    /** The `detail/` files a drill needs (the app loads them, then calls slideOver). */
    detailFiles: (sel: SalesSelection, drill: Drill): string[] => detailFiles(cube, sel, drill),
    slideOver: (sel: SalesSelection, parts: DetailParts | null, drill: Drill): SlideOverVM =>
      slideOver(cube, parts, sel, drill),
  };
}

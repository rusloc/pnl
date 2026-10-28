import type { RowOf } from '../data/parquet-columns.ts';
import type { FILES, FileKey, MarketCode, SalesManifest } from './manifest.ts';
import type { TimeView } from './windows.ts';

export type FileRows<K extends FileKey> = RowOf<(typeof FILES)[K]['columns']>[];

/** Everything the first paint needs (manifest + base Parquet files). */
export interface SalesBase {
  manifest: SalesManifest;
  loansMonth: FileRows<'loansMonth'>;
  funnelMonth: FileRows<'funnelMonth'>;
  portfolioMonth: FileRows<'portfolioMonth'>;
  vintage: FileRows<'vintage'>;
  windowStats: FileRows<'windowStats'>;
  cohortCurve: FileRows<'cohortCurve'>;
  agentMonth: FileRows<'agentMonth'>;
  revenueMonth: FileRows<'revenueMonth'>;
  subsMonth: FileRows<'subsMonth'>;
  targetMonth: FileRows<'targetMonth'>;
}

/** Capped loan / client sample, loaded on first need (slide-over, Clients and Portfolio tables). */
export interface SalesDetail {
  loans: FileRows<'detailLoans'>;
  clients: FileRows<'detailClients'>;
}

export type { MarketCode, TimeView };
export type MarketSel = 'ALL' | MarketCode;
export type Comparator = 'BUD' | 'PY';
export type ViewId = 'overview' | 'loans' | 'clients' | 'portfolio' | 'revenue';

/** What the slide-over shows (URL `drill`). */
export type Drill =
  | { kind: 'loans'; market: MarketSel } // loan grain, window × market
  | { kind: 'agent'; agent: string } // that agent's loans in the window
  | { kind: 'client'; client: number }; // client card + all loans of the client

export interface SalesSelection {
  view: ViewId;
  market: MarketSel;
  tv: TimeView;
  anchor: number; // month index of the selected closed month
  cmp: Comparator;
  drill: Drill | null;
}

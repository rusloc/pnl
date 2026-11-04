import type { RowOf } from "./parquet-columns";
import type {
  DETAIL,
  FILES,
  FileKey,
  MarketCode,
  SalesManifest,
} from "./manifest";
import type { TimeView } from "./windows";

export type FileRows<K extends FileKey> = RowOf<(typeof FILES)[K]["columns"]>[];

/** Everything the first paint needs (manifest + base Parquet files). */
export interface SalesBase {
  manifest: SalesManifest;
  loansMonth: FileRows<"loansMonth">;
  funnelMonth: FileRows<"funnelMonth">;
  portfolioMonth: FileRows<"portfolioMonth">;
  vintage: FileRows<"vintage">;
  windowStats: FileRows<"windowStats">;
  cohortCurve: FileRows<"cohortCurve">;
  agentMonth: FileRows<"agentMonth">;
  revenueMonth: FileRows<"revenueMonth">;
  subsMonth: FileRows<"subsMonth">;
  targetMonth: FileRows<"targetMonth">;
}

export type LoanRow = RowOf<typeof DETAIL.loans>;
export type ClientRow = RowOf<typeof DETAIL.clients>;
export type CohortRow = RowOf<typeof DETAIL.cohort>;

/** The detail files one drill needs, loaded on demand (`detail/`, 2026-11-01: the full data, no sample). */
export interface DetailParts {
  loans: LoanRow[]; // loans-YYYY-MM, overdue, client-NN
  cohort: CohortRow[]; // cohort-YYYY-MM
  clients: ClientRow[]; // client-dim-NN
}

export type { MarketCode, TimeView };
export type MarketSel = "ALL" | MarketCode;
export type Comparator = "BUD" | "PY";
export type ViewId = "overview" | "loans" | "clients" | "portfolio" | "revenue";

/** What the slide-over shows (URL `drill`). */
export type Drill =
  | { kind: "loans"; market: MarketSel } // loan grain, window × market
  | { kind: "agent"; agent: string } // that agent's loans in the window
  | { kind: "client"; client: number } // client card + all loans of the client
  // 2026-11-01: the Clients and Portfolio tables became aggregates; their rows open these lists
  | { kind: "clients"; market: MarketSel; channel: string | null } // cohort clients of the window, one channel or all
  | { kind: "overdue"; market: MarketSel; product: string | null }; // loans 30+ DPD at the last close

export interface SalesSelection {
  view: ViewId;
  market: MarketSel;
  from: number; // first month index of the period (2026-11-01: any closed range, see windows.ts periodKind)
  anchor: number; // last month index of the period: a closed month
  cmp: Comparator;
  drill: Drill | null;
}

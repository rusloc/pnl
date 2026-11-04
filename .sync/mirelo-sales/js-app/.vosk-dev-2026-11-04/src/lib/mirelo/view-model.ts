import type { HowToReadVM, InfoVM } from "./copy";
import type { Unit } from "./format";
import type { CmpRow, Status } from "./status";
import type { Drill, MarketCode, ViewId } from "./types";

// Shapes the engine hands to the components: every string is final copy, every number is a plotted value. The
// components own geometry (px, scales) and nothing else (CLAUDE.md Track C: no business logic in components).

/** Series roles map 1:1 to design-tokens §2.2: actual ink, budget teal, PY grey dashed; c1…c4 categorical (ink, teal, grey-400, grey-300), c5 outline. */
export type SeriesRole =
  "actual" | "budget" | "py" | "c1" | "c2" | "c3" | "c4" | "c5";

export interface Series {
  name: string;
  role: SeriesRole;
  values: (number | null)[];
}

export interface LegendItem {
  label: string;
  // pyFill: prior year as a filled yellow bar; lost: the funnel's yellow drop-out line (both 2026-11-01)
  role: SeriesRole | "selected" | "ghost" | "pyFill" | "lost";
}

export interface BarRow {
  label: string;
  value: number | null;
  ghost: number | null; // PY: a filled yellow bar under the actual one (2026-11-01; was an outline)
  tick: number | null; // target / SLA / average tick
  text: string;
}

export type Chart =
  | {
      kind: "line";
      x: string[];
      unit: Unit;
      series: Series[];
      selected: number | null;
      callout: { index: number; text: string } | null;
      zeroBased: boolean;
    }
  | {
      kind: "columns";
      x: string[];
      unit: Unit;
      stacks: Series[]; // bottom → top
      ghost: (number | null)[] | null; // PY total as an outline
      line: Series | null; // Budget line + dots over the columns
      selected: number | null;
      labels: (string | null)[] | null; // text above each column
      percent: boolean; // 100 % stacked
    }
  | { kind: "bars"; unit: Unit; rows: BarRow[] }
  | {
      kind: "stackedBars";
      unit: Unit;
      segments: { name: string; role: SeriesRole }[];
      rows: { label: string; values: number[]; text: string }[];
    }
  | {
      kind: "funnel";
      rows: {
        label: string;
        value: number;
        text: string;
        sub: string;
        lost: number | null; // did not reach the next stage: a yellow line over the bar's end
      }[];
    }
  | {
      kind: "bullets";
      unit: Unit;
      rows: {
        label: string;
        value: number;
        target: number;
        text: string;
        status: Status;
      }[];
    }
  | {
      kind: "waterfall";
      steps: {
        label: string;
        value: number;
        kind: "total" | "up" | "down";
        text: string;
      }[];
    }
  | {
      kind: "heat";
      cols: string[];
      rows: {
        label: string;
        cells: { text: string; level: number | null }[]; // 0 … 1 over the whole grid; null = blank
      }[];
      side: { title: string; unit: Unit; rows: BarRow[] } | null;
    }
  | {
      kind: "bubble";
      xUnit: Unit;
      yUnit: Unit;
      points: {
        label: string;
        x: number;
        y: number;
        size: number;
        cls: 0 | 1 | 2;
        highlight: boolean;
        showLabel: boolean;
      }[];
    }
  | { kind: "placeholder"; text: string };

export interface ChartCard {
  id: string;
  title: string;
  info: InfoVM;
  open: ViewId | null; // "Open <view> ↗" on Overview why panels
  legend: LegendItem[];
  chart: Chart;
  /** A small filter on the card itself (P12 market, 2026-11-01): one chart per option, `value` first. */
  variants?: {
    label: string;
    value: string;
    options: { key: string; label: string; chart: Chart }[];
  };
}

/** Status chip: glyph + word (design-tokens §2.3), never colour alone. */
export interface Chip {
  text: string;
  status: Status;
}

export interface HeroCard {
  id: string;
  label: string;
  info: InfoVM;
  value: string;
  second: string | null;
  rows: [CmpRow, CmpRow];
  status: Chip | null; // status chip of the header comparator row (top-right)
  open: ViewId;
}

export interface KpiCard {
  id: string;
  label: string;
  info: InfoVM;
  value: string;
  rows: CmpRow[]; // "vs Budget" (when the metric has one) and "vs PY", or one fixed comparator
  status: Chip | null; // follows the chosen comparator
}

export interface Cell {
  text: string;
  status?: Status; // coloured text
  chip?: boolean; // status chip with glyph + word
  bar?: number | null; // 0 … 1 attainment bar (target at 1)
  tag?: string; // small tag after the text ("Ramp")
  sort?: number | string | null; // raw value for column sorting (sortable tables); null sorts last
}

export type RowAction =
  { kind: "market"; market: MarketCode } | { kind: "drill"; drill: Drill };

export interface TableRow {
  key: string;
  cells: Cell[];
  selected: boolean;
  action: RowAction | null; // click / Enter
  secondary: RowAction | null; // double-click (Overview: market row → loans)
}

export interface TableCard {
  id: string;
  title: string;
  info: InfoVM;
  columns: {
    key: string;
    label: string;
    width: number;
    align: "left" | "right";
  }[];
  rows: TableRow[];
  empty: string | null; // shown in place of rows when there are none (or while the sample loads)
  action: { label: string; drill: Drill } | null; // "Show loans ↗"
  needsDetail: boolean; // rows come from the lazy detail sample
  sortable?: boolean; // header click sorts by the cells' `sort` values (2026-11-01: the agent leaderboard)
}

export interface OverviewVM {
  heroes: HeroCard[];
  charts: ChartCard[]; // 2 × 2
  table: TableCard;
}

export interface BandVM {
  kpis: KpiCard[]; // 6
  charts: ChartCard[]; // 2 × 3 (thirds) or 2 × 2 (halves)
  layout: "thirds" | "halves";
  table: TableCard;
}

export interface HeaderVM {
  title: string;
  periodLine: string;
  filterLine: string; // the applied filters beside the Filters button: "Q4 2025 - vs Budget - All markets"
  howToRead: HowToReadVM;
  months: { value: string; label: string }[]; // closed months, newest first
  first: number; // first month with data (calendar bound)
  last: number; // last closed month (calendar bound)
}

export interface DetailLoanRow {
  key: string;
  client: number;
  cells: string[];
}

/** A detail list (2026-11-01: every row of the data, paged in the window; rowAt formats one row, csv() writes all). */
export interface DetailList {
  title: string;
  sub: string;
  chips: string[];
  columns: { label: string; align: "left" | "right" }[];
  total: number;
  rowAt: (i: number) => DetailLoanRow;
  footer: string; // what a row does / the order, beside the pager
  csv: () => string;
  csvName: string;
}

export type SlideOverVM =
  | ({ kind: "loans" | "clients" } & DetailList) // a row opens the client card
  | ({
      kind: "client";
      facts: { label: string; value: string }[];
    } & DetailList)
  | { kind: "missing"; title: string; sub: string };

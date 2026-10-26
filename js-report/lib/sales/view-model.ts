import type { Unit } from './format.ts';
import type { CmpRow, Status } from './status.ts';
import type { Drill, MarketCode, ViewId } from './types.ts';

// Shapes the engine hands to the components: every string is final copy, every number is a plotted value. The
// components own geometry (px, scales) and nothing else (CLAUDE.md Track C: no business logic in components).

/** Series roles map 1:1 to design-tokens §2.2: actual ink, budget teal, PY grey dashed; c1…c4 categorical (ink, teal, grey-400, grey-300), c5 outline. */
export type SeriesRole = 'actual' | 'budget' | 'py' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5';

export interface Series {
  name: string;
  role: SeriesRole;
  values: (number | null)[];
}

export interface LegendItem {
  label: string;
  role: SeriesRole | 'selected' | 'ghost';
}

export interface BarRow {
  label: string;
  value: number | null;
  ghost: number | null; // PY outline
  tick: number | null; // target / SLA / average tick
  text: string;
}

export type Chart =
  | {
      kind: 'line';
      x: string[];
      months: number[] | null; // month index per x (mark click → month), null when x is not months
      unit: Unit;
      series: Series[];
      selected: number | null;
      callout: { index: number; text: string } | null;
      zeroBased: boolean;
    }
  | {
      kind: 'columns';
      x: string[];
      months: number[] | null;
      unit: Unit;
      stacks: Series[]; // bottom → top
      ghost: (number | null)[] | null; // PY total as an outline
      line: Series | null; // Budget line + dots over the columns
      selected: number | null;
      labels: (string | null)[] | null; // text above each column
      percent: boolean; // 100 % stacked
    }
  | { kind: 'bars'; unit: Unit; rows: BarRow[] }
  | {
      kind: 'stackedBars';
      unit: Unit;
      segments: { name: string; role: SeriesRole }[];
      rows: { label: string; values: number[]; text: string }[];
    }
  | { kind: 'funnel'; rows: { label: string; value: number; text: string; sub: string; lost: number | null }[] }
  | {
      kind: 'bullets';
      unit: Unit;
      rows: { label: string; value: number; target: number; text: string; status: Status }[];
    }
  | { kind: 'waterfall'; steps: { label: string; value: number; kind: 'total' | 'up' | 'down'; text: string }[] }
  | {
      kind: 'heat';
      cols: string[];
      rows: { label: string; cells: { text: string; bin: 0 | 1 | 2 | 3 | null }[] }[];
      side: { title: string; unit: Unit; rows: BarRow[] } | null;
    }
  | {
      kind: 'bubble';
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
  | { kind: 'placeholder'; text: string };

export interface ChartCard {
  id: string;
  title: string;
  info: string;
  open: ViewId | null; // "Open <view> ↗" on Overview why panels
  legend: LegendItem[];
  chart: Chart;
}

export interface HeroCard {
  id: string;
  label: string;
  info: string;
  value: string;
  second: string | null;
  sub: string;
  rows: [CmpRow, CmpRow];
  spark: { actual: (number | null)[]; py: (number | null)[] };
  open: ViewId;
}

export interface KpiCard {
  id: string;
  label: string;
  info: string;
  value: string;
  sub: string;
  row: CmpRow;
  alt: CmpRow | null; // the other comparator, shown on hover / focus (layout-spec §6)
}

export interface Cell {
  text: string;
  status?: Status; // coloured text
  chip?: boolean; // status chip with glyph + word
  bar?: number | null; // 0 … 1 attainment bar (target at 1)
  tag?: string; // small tag after the text ("Ramp")
}

export type RowAction = { kind: 'market'; market: MarketCode } | { kind: 'drill'; drill: Drill };

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
  info: string;
  columns: { key: string; label: string; width: number; align: 'left' | 'right' }[];
  rows: TableRow[];
  note: string | null; // footer / empty-state copy
  action: { label: string; drill: Drill } | null; // "Show loans ↗"
  needsDetail: boolean; // rows come from the lazy detail sample
}

export interface OverviewVM {
  heroes: HeroCard[];
  charts: ChartCard[]; // 2 × 2
  table: TableCard;
}

export interface BandVM {
  kpis: KpiCard[]; // 6
  charts: ChartCard[]; // 2 × 3 (thirds) or 2 × 2 (halves)
  layout: 'thirds' | 'halves';
  table: TableCard;
}

export interface HeaderVM {
  title: string;
  periodLine: string;
  months: { value: string; label: string }[]; // closed months, newest first
}

export interface DetailLoanRow {
  key: string;
  client: number;
  cells: string[];
}

export type SlideOverVM =
  | {
      kind: 'loans';
      title: string;
      sub: string;
      chips: string[];
      columns: { label: string; align: 'left' | 'right' }[];
      rows: DetailLoanRow[];
      footer: string;
      csv: string;
      csvName: string;
    }
  | {
      kind: 'client';
      title: string;
      sub: string;
      chips: string[];
      facts: { label: string; value: string }[];
      columns: { label: string; align: 'left' | 'right' }[];
      rows: DetailLoanRow[];
      footer: string;
      csv: string;
      csvName: string;
    }
  | { kind: 'missing'; title: string; sub: string };

// Copy source (contract §4): verbatim from the PBIR text boxes of page ReportSectionbdcfb2b87f3167b0ec4f and the tooltip
// page tt_time_structure, the column headers from the mockup (§5.4 (3)). Category names come from manifest.categories;
// numbers never live here. Deviations from the PBIP strings are listed in js-trucks/README.md › Deviations.

export const DOCUMENT_TITLE = 'Truck time utilization — Plan vs Fact';

export const HEADER = {
  title: 'Truck time utilization',
  subtitle: 'Haul fleet · Plan vs Fact · share of total time',
  copyLink: 'Copy link',
  copied: 'Copied',
} as const;

export const FILTERS = {
  week: 'Week',
  office: 'Office',
  planType: 'Plan type',
  calculation: 'Calculation',
  workType: 'Work type',
  loader: 'Loader',
  all: 'All',
  selected: 'selected',
  selectAll: 'Select all',
  search: 'Search…',
  searchLabel: 'Search loaders',
  clear: 'Clear',
  done: 'Done',
  reset: '↺  Reset filters',
} as const;

export const KPI = {
  plan: 'Plan',
  fact: 'Fact',
  truckLoading: { title: 'TRUCK LOADING', unit: '% of total time' },
  effectiveWork: { title: 'EFFECTIVE WORK TIME', unit: '% of total time' },
  performance: { title: 'PERFORMANCE PER TRUCK', unit: 'm³/h' },
  mass: { title: 'MASS LOADED PER TRUCK', unit: 'thousand m³' },
} as const;

export const WATERFALL = {
  title: 'Time structure',
  subtitle: 'Waterfall from total time to truck loading, % of total',
  legend: { subtotal: 'Subtotal', loss: 'Time loss', better: 'Better than plan', worse: 'Worse than plan' },
  columns: { category: 'CATEGORY', plan: 'PLAN', planPct: '%', fact: 'FACT', factPct: '%', delta: 'Δ FACT − PLAN, PP' },
  columnLabels: { planPct: 'Plan %', factPct: 'Fact %' },
} as const;

export const TOOLTIP = { plan: 'Plan share', fact: 'Fact share', delta: 'Δ fact − plan' } as const;

export const FOOTNOTE =
  'Δ is favorable (blue) when a subtotal grows or a time loss shrinks against plan; unfavorable (orange) otherwise.';

export const A11Y = { keyFigures: 'Key figures', timeStructure: 'Time structure, plan versus fact' } as const;

/** The axis labels of both bar columns (native text, §5.4 (5)). */
export const AXIS = ['0%', '50%', '100%'] as const;

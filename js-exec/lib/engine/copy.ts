// Fixed copy of the page (E-57, E-58, E-88): v5 text (docs/design/executive dashboard (reseller)/prototype.html) is
// the source. Numbers never live here: every value in a worked example, mini stat or footer comes from the engine
// (view.ts). Deviations from the v5 strings are deliberate and listed in js-exec/README.md › Deviations from v5.
// This module is the TS source for the shared copy file of ADR-0013 (j) sync point 1.

export const ATTRIBUTES = [
  {
    key: 'group',
    label: 'Group',
    options: [
      ['B1', 'B1 base-crucial'],
      ['B2', 'B2 margin & cost'],
      ['B3', 'B3 stock & supply'],
      ['B4', 'B4 channel & customer'],
    ],
  },
  {
    key: 'lever',
    label: 'Lever',
    options: [
      ['sales', 'Sales'],
      ['margin', 'Margin'],
      ['stock', 'Stock'],
      ['supply', 'Supply'],
      ['cash', 'Cash'],
    ],
  },
  {
    key: 'horizon',
    label: 'Horizon',
    options: [
      ['week', 'Week'],
      ['month', 'Month'],
      ['quarter', 'Quarter'],
    ],
  },
  {
    key: 'owner',
    label: 'Owner',
    options: [
      ['commercial', 'Commercial'],
      ['supply', 'Supply chain'],
      ['finance', 'Finance'],
      ['digital', 'Digital'],
    ],
  },
  {
    key: 'statement',
    label: 'Statement',
    options: [
      ['pl', 'P&L'],
      ['bs', 'Balance sheet'],
      ['ops', 'Operational'],
    ],
  },
] as const;

export type AttrKey = (typeof ATTRIBUTES)[number]['key'];

export const SWITCH_LABELS = {
  period: { label: 'Period', options: { week: 'Week', ptd: 'Period to date', ytd: 'Year to date' } },
  compare: { label: 'Comparator', options: { budget: 'Budget', ly: 'Last year', lw: 'Last week' } },
  region: {
    label: 'Region / format',
    options: { all: 'All', nl: 'Netherlands', be: 'Belgium', online: 'Online only' },
  },
} as const;

export const DRILL_PAGES: Readonly<Record<string, string>> = {
  Sales: 'Sales page',
  Margin: 'Margin page',
  Inventory: 'Inventory page',
  Supplier: 'Supplier page',
  Channel: 'Channel & customer page',
};

export const STATUS_WORD = { good: 'On track', watch: 'Watch', off: 'Off track', na: 'N/A' } as const;
export const STATUS_GLYPH = { good: '▲', watch: '●', off: '▼', na: '–' } as const;

export interface CardCopy {
  /** Basis sub-title (hero and medium cards); "prov." is appended from dim_kpi.is_provisional (E-27). */
  sub: string;
  rule: string;
  what: string;
  why: string;
  formula: string;
  note: string;
  /** Footer right when the card is not provisional: the refresh stamp or "Updated weekly". */
  cadence: 'refresh' | 'weekly';
  /** Footer right of a provisional card (E-27). */
  provisional?: string;
  drill: readonly (readonly [string, string])[];
}

export const CARD_COPY: Readonly<Record<string, CardCopy>> = {
  NET_SALES: {
    sub: 'all channels', // the window is prefixed in view.ts: "week 43, all channels"
    rule: 'Watch when −3% to 0% vs budget; Off track below −3%.',
    what: 'The money customers actually paid us this week, after returns, discounts and VAT.',
    why: 'It is the top line every other number divides by or adds up to; if it slips, the margin and stock numbers follow.',
    formula: 'Gross sales at ticket price − markdowns and discounts − returns, excluding VAT.',
    note: 'Stores −1.2 pp from three closures; online +12% LFL; wholesale order book −4%.',
    cadence: 'refresh',
    drill: [
      [
        'Weekly net sales vs budget and LY',
        '13–26 retail weeks; the same frame as the card, with the comparator carried.',
      ],
      ['Store ranking', '142 rows: net sales, Δ vs budget, LFL %, basket value, traffic; click a store.'],
      ['Store × category × week', 'A matrix for the chosen store; click a cell.'],
      [
        'SKU-store-day rows',
        'Units, net sales, markdown, on-hand; "open receipt lines" hands the key to the POS domain model.',
      ],
    ],
  },
  TOTAL_MARGIN: {
    sub: 'front + back',
    rule: 'Watch when −1.0 pp to 0 vs budget; Off track below −1.0 pp. Provisional until the monthly true-up.',
    what: 'The share of each euro of sales we keep after paying suppliers for the goods, counting the money suppliers pay back to us.',
    why: 'Front margin alone hides half of a reseller’s profit; this is the margin the business really keeps.',
    formula:
      '(Front margin + back margin) ÷ Net sales. Front = sales − cost of goods; back = supplier rebates, promo funding and listing fees.',
    note: 'Q4 volume rebates accrued; finance true-up 10 Nov.',
    cadence: 'refresh',
    provisional: 'Provisional · true-up 10 Nov',
    drill: [
      ['Margin bridge', 'LY margin % → price → mix → landed cost → markdown → back margin → this week.'],
      ['Category × subcategory matrix', 'Net sales, front %, back %, total %, markdown %, shrink %, Δ pp vs plan.'],
      ['SKU × promotion list', 'Sell price, landed cost, markdown €, promo funding, margin €.'],
      ['Contract accrual lines', 'Rate, qualifying purchases, accrued, invoiced, provisional flag.'],
    ],
  },
  WEEKS_OF_COVER: {
    sub: 'forward',
    rule: 'On track within ±1 wk of target 9.5; Watch 1–2 wks away; Off track beyond ±2 wks.',
    what: 'How many weeks our stock would last at the sales we expect, if nothing more arrived.',
    why: 'Too little and shelves go empty; too much and the stock ends in markdown. It decides this week’s buying actions.',
    formula: '(Stock on hand + stock on order, at cost) ÷ forecast cost of goods sold per week.',
    note: 'Toys intake landed 2 weeks early; Garden overstock.',
    cadence: 'refresh',
    drill: [
      ['Stock at cost by category vs target cover', 'Bars with target markers, over and under coloured.'],
      ['SKU exception list', 'Three tabs: out-of-stock top sellers, overstock (cover > 26 wks), delisted with stock.'],
      ['SKU-store-day snapshot', 'On hand, on order, in transit, first-receipt date, last sale.'],
      ['Open PO lines', 'Due date, supplier, OTIF status; the PO domain model from here.'],
    ],
  },
  MARKDOWN: {
    sub: '% of gross sales',
    rule: 'Lower is better. Watch when 0 to +1.0 pp vs budget; Off track above +1.0 pp.',
    what: 'The part of the ticket price we gave away through price cuts and promotions.',
    why: 'Every point of markdown is margin lost; rising markdown is the first sign of too much or the wrong stock.',
    formula: 'Markdown value (permanent + promotional) ÷ gross sales at ticket price.',
    note: 'Apparel autumn clearance 4 weeks early; Garden end of season.',
    cadence: 'refresh',
    drill: [
      ['Markdown by promo type', 'TPR, multibuy, clearance, loyalty: value and % of sales.'],
      ['Category × subcategory matrix', 'Markdown % next to front, back and total margin.'],
      ['SKU × promotion list', 'Markdown €, funding source (supplier / own), start and end.'],
      ['Receipt lines', 'POS domain model, via the SKU-store-day key.'],
    ],
  },
  AVAILABILITY: {
    sub: 'top-500 SKUs, weighted',
    rule: 'On track at 97% or above; Watch 95–97%; Off track below 95%.',
    what: 'How often our best-selling products were actually on the shelf when a customer could buy them.',
    why: 'A gap on the shelf is a sale that never happens; it is the "too little stock" failure mode.',
    formula: 'SKU-store-days in stock ÷ SKU-store-days ranged, for the top-500 sellers, weighted by sales.',
    note: 'DC Tilburg WMS outage Tuesday; Fresh top-50 at 91%.',
    cadence: 'refresh',
    drill: [
      ['Availability by store cluster', 'Heatmap: cluster × week.'],
      ['Out-of-stock top sellers', 'SKU list with lost-sales estimate.'],
      ['SKU-store-day snapshot', 'On hand, on order, in transit, last sale.'],
      ['Open PO lines', 'Due date, supplier, OTIF status.'],
    ],
  },
  EBITDA: {
    sub: 'to date', // "period 10 to date" from the calendar in view.ts
    rule: 'Watch when −5% to 0 vs budget; Off track below −5%. Provisional until month-end close.',
    what: 'Profit before interest, tax and depreciation for the period so far: what is left after all operating costs.',
    why: 'It is the bottom line the board sees; every margin and cost move lands here.',
    formula: 'Total margin − shrink − store costs − central costs − fulfilment costs; ÷ Net sales for the margin %.',
    note: 'Energy below plan; payroll over on Sunday trading.',
    cadence: 'refresh',
    provisional: 'Provisional · weekly flash',
    drill: [
      ['EBITDA bridge', 'Total margin → shrink → store OpEx → central OpEx → fulfilment → EBITDA.'],
      ['Store operating cost % by format and region', 'Payroll, rent, utilities vs budget.'],
      ['Cost centre × account', 'GL detail for the period.'],
      ['GL journal lines', 'Finance system, via the cost-centre key.'],
    ],
  },
  LFL_GROWTH: {
    sub: 'vs LY', // the window noun is appended in view.ts: "vs LY week"
    rule: 'Watch when −2 pp to 0 vs budget LFL; Off track below −2 pp.',
    what: 'Sales growth in the stores that were open a year ago too, so new openings and closures do not distort it.',
    why: 'It tells you whether the existing business is growing, not just the estate.',
    formula:
      'Sales of stores open ≥ 13 months this week ÷ the same stores’ sales in the same retail week last year − 1.',
    note: 'Online LFL +12.1%; hyper formats +1.8%, convenience +4.0%.',
    cadence: 'refresh',
    drill: [
      ['LFL vs non-LFL bridge', 'LY → LFL growth → new stores → closures → online → wholesale → actual.'],
      ['LFL growth by format and region', 'Hyper, super, convenience × NL, BE.'],
      ['Store ranking, LFL set', '131 rows: LFL %, Δ vs budget, basket, traffic.'],
      ['Store × category × week', 'Matrix for the chosen store.'],
    ],
  },
  FRONT_GM: {
    sub: '% of net sales',
    rule: 'Watch when −1.0 pp to 0 vs budget; Off track below −1.0 pp.',
    what: 'The share of sales left after paying what the goods cost us, landed in our warehouse.',
    why: 'It is the price-minus-cost half of profit; pricing, buying cost and category mix show up here first.',
    formula: '(Net sales − cost of goods at landed cost) ÷ Net sales.',
    note: 'H&B and Electronics mix offsets Apparel clearance.',
    cadence: 'refresh',
    drill: [
      ['Margin % by category vs plan', 'Dumbbell: plan vs actual per category.'],
      ['Category × subcategory matrix', 'Front %, back %, total %, markdown %, shrink %.'],
      ['SKU × promotion list', 'Sell price, landed cost, margin €.'],
      ['Receipt lines for COGS', 'POS domain model.'],
    ],
  },
  SELL_THROUGH: {
    sub: 'A/W season to date',
    rule: 'Watch when −5 pp to 0 vs the season target; Off track below −5 pp.',
    what: 'The share of the season’s stock we have sold so far.',
    why: 'It says whether the season is clearing on time or heading for clearance markdown.',
    formula: 'Units sold season to date ÷ (opening stock units + units received).',
    note: 'Apparel 58% after clearance; Home & kitchen 69%. Season week 12 of 20.',
    cadence: 'weekly',
    drill: [
      ['Sell-through by season × category', 'Curve vs target curve per category.'],
      ['Aged stock buckets', '0–30 / 31–90 / 91–180 / 180+ days at cost.'],
      ['SKU exception list, overstock tab', 'Cover > 26 wks, € at cost.'],
      ['SKU-store-day snapshot', 'On hand, on order, in transit, last sale.'],
    ],
  },
  GMROI: {
    sub: 'rolling 12 months',
    rule: 'On track at 2.5× or above; Watch 2.0–2.5×; Off track below 2.0×.',
    what: 'How many euros of margin each euro tied up in stock earned over the last 12 months.',
    why: 'Stock costs money to hold; this says whether it is earning its keep.',
    // v5 said "Total margin for the last 12 months"; ADR-0013 OQ 11 / data README open point 12: front margin, 52 weeks
    formula: 'Front gross margin for the last 52 weeks ÷ average stock at cost over the same 52 week-ends.',
    note: 'Electronics 1.9× below target; H&B 4.1×.',
    cadence: 'weekly',
    drill: [
      ['GMROI by category', 'Ranked bar vs category target.'],
      ['Stock at cost by category vs cover', 'Where the stock sits.'],
      ['SKU exception list', 'Overstock and delisted with stock.'],
      ['SKU-store-day snapshot', 'On hand, on order, last sale.'],
    ],
  },
  SUPPLIER_OTIF: {
    sub: 'inbound, PO lines',
    rule: 'On track at 95% or above; Watch 92–95%; Off track below 92%.',
    what: 'The share of purchase-order lines suppliers delivered on the agreed day and in the agreed quantity.',
    why: 'Late or short deliveries become empty shelves two weeks later.',
    formula: 'PO lines received on time and in full ÷ PO lines due.',
    note: 'Two Electronics suppliers below 85%; see the scorecard.',
    cadence: 'refresh',
    drill: [
      ['OTIF trend and by supplier', 'Ranked bar, volume-weighted.'],
      ['Supplier scorecard', 'Spend, OTIF, lead time, PPV, back margin %.'],
      ['Contract', 'Terms, rebate scheme, accrual vs earned.'],
      ['PO line × receipt', 'Ordered, received, due and received dates.'],
    ],
  },
  CHANNEL_MIX: {
    sub: '% of net sales vs plan',
    rule: 'On track within ±2 pp of the plan mix per channel; Watch 2–3 pp away; Off track beyond 3 pp.',
    what: 'What share of sales came through stores, online and wholesale.',
    why: 'A shift between channels changes margin and cost to serve even when total sales look fine.',
    formula: 'Each channel’s net sales ÷ total net sales, compared with the planned mix.',
    note: 'Online ahead of plan; stores −1.6 pp after three closures.',
    cadence: 'refresh',
    drill: [
      ['Channel mix trend', '100% stacked area, 13–26 weeks.'],
      ['Channel P&L matrix', 'Net sales, margin, cost to serve, contribution per channel.'],
      ['Store format / online site', 'Hyper, super, convenience; web, app, marketplace.'],
      ['Order lines', 'E-commerce and wholesale domain models.'],
    ],
  },
};

/** Tooltips: bold title + the rest, separator included (v5 data-tip strings). */
export const SIDEBAR_TIPS = {
  filters: ['Filters', ' · period, comparator, region and the metric attributes'],
  how: ['How to read', ' this page'],
  more: ['More KPIs', ' · 20 bench metrics, inactive'],
  notes: ['Notes', ' · status rules, margin logic, data contract'],
  explain: ['Explain', ' · what it is, why it matters, formula, worked example'],
  drill: ['Drill path', ' · from this card to the lowest grain'],
} as const;

export const MARGIN_LOGIC =
  'Front margin = Net sales − COGS at landed cost. Back margin = contract rate × qualifying purchases, accrued weekly, provisional until the monthly true-up. Total margin = front + back. Markdown already reduces the sell price, so it is shown as % of gross sales and never enters the margin sum twice. EBITDA = Total margin − shrink − store OpEx − central OpEx − fulfilment.';

export const DATA_CONTRACT = [
  'Facts at week × site × category: sales, budget, week-end stock, forecast cost of goods, availability, receipts; supplier income and PO lines at week × supplier; OpEx at week × cost type × site × scenario.',
  'LY by week key on the 4-5-4 retail calendar (week 43 ↔ LY week 43, never the same dates). LFL flag per retail period (open ≥ 13 months, not closed, not refitted). Provisional flag on back margin and EBITDA flash until close.',
  'This page reads pre-aggregated cubes (week × region / channel × category); stores, suppliers and SKUs stay in the source data.',
] as const;

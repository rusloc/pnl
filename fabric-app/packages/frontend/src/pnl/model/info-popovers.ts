// ⓘ and "How to read" copy (ADR-0012 §2.3, parity rules 16, 18–19). The shared
// source for every track is `docs/ADD/features/info-popovers.md`, block
// "redesign-v4" (generated from Track C's view modules): title · what it is ·
// formula ("; " between terms) · values · source. The strings below are that
// block's, with `{comparison}` filled from the selection and the company's own
// word for its service-line slot; the values come from the zone's numbers at
// render time, a card's sub-metrics line from the model's `KPI Info Sub`.
import { bridgeComparison, VERSION_LABEL } from './filters';
import { periodWindowText } from './period';
import type { EntityCode, FilterState, InfoCopy, ReferenceData, ViewKey } from './types';

/** The company's name for its `dim_line` slot (L-10): Consumer Products sells categories. */
export function lineWord(entity: EntityCode): string {
  return entity === 'P' ? 'category' : 'service line';
}

export type PanelInfoKey = 'NRBRIDGE' | 'PBRIDGE' | 'VAR' | 'PROFTABLE' | 'CONC' | 'BUBBLE' | 'HEAT';

export interface PanelContext {
  /** The comparison the panel uses (C-40): "Budget", "Prior year", "Latest est.". */
  comparison: string;
  entity: EntityCode;
}

const CC_FX = 'CC subtotal = comparison + Σ steps; FX = (NR − NRcc) actual − (NR − NRcc) comparison';

const NR_BRIDGE_FORMULA: Record<EntityCode, string> = {
  P: `volume = Σ slices (U − Ucmp) × NRcc cmp ÷ Ucmp; price / mix = ΔNRcc − volume; ${CC_FX}`,
  S: `service-line step = NRcc actual − NRcc comparison per line; ${CC_FX}`,
  G: `company step = NRcc actual − NRcc comparison per company; eliminations = change of the eliminated intercompany revenue at constant currency; ${CC_FX}`,
};

/** The panel's copy for the selection; `values` are filled by the mappers. */
export function panelInfo(key: PanelInfoKey, ctx: PanelContext): InfoCopy {
  const cmp = ctx.comparison;
  const line = lineWord(ctx.entity);
  switch (key) {
    case 'NRBRIDGE':
      return {
        title: 'Net revenue bridge',
        what: `${cmp} to actual: driver steps at constant currency, a constant-currency subtotal, then FX (translation, not controllable). The axis does not start at zero; read the labels.`,
        formula: NR_BRIDGE_FORMULA[ctx.entity],
        values: [],
        source: 'Bridge Value - Bridge Comparison NR - _NR CC Base - _NR CC Bridge Cmp - Bridge FX - C-40 - new step "Constant-currency NR"',
      };
    case 'PBRIDGE':
      return {
        title: 'Profit bridge',
        what: `${cmp} Adj. EBITDA to actual: revenue volume at the comparison's gross margin, GM rate and mix by ${line}, variable selling, the opex blocks (all at constant currency), then FX. D&A and adjusting items are actual levels (their Δ is the small label) so the bridge reconciles to operating profit. No share-based compensation step: not in the data.`,
        formula: 'volume = ΔNRcc × GM %cmp; mix = Σ lines (NR − NR × share cmp) × GM %cmp,line; rate = ΔGPcc − volume − mix; FX = (E − Ecc) − (Ecmp − Ecc,cmp)',
        values: [],
        source: 'PL Δ A rows VSC SM RD GA OOI - PL Base rows DA ADJ - GP by dim_line - _Bridge NR CC Change - CC branch of _Amt Raw - new dim_profit_step - spec Analysis §5.2',
      };
    case 'VAR':
      return {
        title: `Largest variances vs ${cmp}`,
        what: 'Leaf lines of the P&L down to operating profit. Δ = actual − comparison on signed values, so a positive Δ always helps profit and a negative one hurts it; bars share one scale. Top 8 / 12 / All; By block groups the shown lines under their P&L block with the block’s full subtotal; By |Δ| is one flat ranking. A cut splits every bar into slice members; opex and below are booked by region only and allocated by NR share to the other slices (marked alloc.).',
        formula: 'Δ = actual − comparison; Δ % = Δ ÷ |comparison|, n.m. when |comparison| < 2.0 or |Δ %| > 50 %; FX = (actual − actual cc) − (comparison − comparison cc); coverage = Σ|Δ shown| ÷ Σ|Δ all|',
        values: [],
        source: 'LV Base - LV Comparison - LV Δ - LV Δ % - LV Abs Δ (TopN) - Compare B Amount (PY) - dim_account.block_code - _Amt Row block subtotals - fact_pl / fact_pl_allocated cut (C-30, C-31) - new: LV FX, TopN parameter, block grouping - C-45',
      };
    case 'PROFTABLE':
      return {
        title: 'Profitability by Region',
        what: `Constant currency, rows by net revenue. Δ vs ${cmp} % on net revenue; GM % and CM % of the region’s revenue; CM Δ = contribution margin % minus ${cmp} in pp, the only column with a status dot. Adj. EBITDA is booked by region (C-31): nothing here is allocated.`,
        formula: 'GM % = GP ÷ NR; CM % = contribution ÷ NR; CM Δ = CM % − comparison CM %',
        values: [],
        source: 'Prof Net Revenue - Prof NR Δ % (CC) - Gross Profit - Contribution Margin - KPI CM % - Adjusted EBITDA - new: CM Δ pp - C-46',
      };
    case 'CONC':
      return {
        title: 'Concentration - share by profit level',
        what: 'Three 100 % bars: each region’s share of net revenue, of contribution and of Adj. EBITDA (booked by region). A region whose share shrinks from revenue to contribution dilutes the margin; one whose share grows is accretive.',
        formula: 'share = region value ÷ company value, per level; drift = EBITDA share − NR share (pp)',
        values: [],
        source: 'Prof NR Share - contribution and EBITDA shares (same pattern on Contribution Margin / Adjusted EBITDA)',
      };
    case 'BUBBLE':
      return {
        title: 'Growth × margin by region',
        what: 'x = net revenue growth year on year at constant currency, y = contribution margin %, bubble = net revenue; dashed lines = company values, giving four quadrants. The thin line runs from the prior-year position (hollow dot) to the current one; it needs two earlier years, so it is blank where the prior year has no prior year (C-04).',
        formula: 'growth = NRcc ÷ PY NRcc − 1; CM % = contribution ÷ NR, per region',
        values: [],
        source: 'KPI Organic Growth per slice (K-22) - KPI CM % per slice - Prof Net Revenue - PY: Compare B Amount',
      };
    case 'HEAT':
      return {
        title: `Mix - region × ${line}`,
        what: 'Cells: net revenue at constant currency and its share of the region; colour = gross margin % of the column (dark = high). Row and column totals reconcile to the table.',
        formula: 'cell = NR(region, line); share = cell ÷ region NR; colour = GP ÷ NR of the line',
        values: [],
        source: 'Net Revenue - Gross Profit at dim_region × dim_line grain (both direct, C-30)',
      };
  }
}

/** Copy of a panel before its zone has answered (sample mode, empty figures). */
export const PANEL_INFO: Record<PanelInfoKey, InfoCopy> = Object.fromEntries(
  (['NRBRIDGE', 'PBRIDGE', 'VAR', 'PROFTABLE', 'CONC', 'BUBBLE', 'HEAT'] as const).map((key) => [key, panelInfo(key, { comparison: 'Budget', entity: 'S' })])
) as Record<PanelInfoKey, InfoCopy>;

// ---------------------------------------------------------------------------
// Vitals cards: the shared block's "What it is / Formula / Source" per kpi_code
// (per company where the block lists both); the card face keeps `dim_kpi[kpi_label]`.

interface CardCopy {
  title: string;
  what: string;
  formula: string;
  source: string;
}

type CardCopyByEntity = CardCopy | Partial<Record<EntityCode, CardCopy>>;

const EBITDA_WHAT = 'Contribution margin plus operating expenses (spine step 9, management performance measure). Excludes D&A and adjusting items; the data has no share-based compensation.';
const GM_WHAT = 'Gross profit as a share of net revenue. A ratio: variances in percentage points.';

const CARD_COPY: Record<string, CardCopyByEntity> = {
  NR: {
    title: 'Net revenue',
    what: 'Gross revenue less gross-to-net deductions (spine step 3). The chip compares with Budget only; other rows are text.',
    formula: 'NR = GR + GTN; Δ = actual − comparison, % of |comparison|',
    source: 'KPI Value K-01 - KPI Δ A / Δ B - KPI Organic Growth - KPI Reported Growth',
  },
  EBITDA: {
    P: { title: 'Adjusted EBITDA', what: EBITDA_WHAT, formula: 'Adj. EBITDA = CM + OPEX', source: 'KPI Value K-07 - KPI Adj EBITDA Margin' },
    S: { title: 'Adjusted EBITDA', what: EBITDA_WHAT, formula: 'Adj. EBITDA = CM + OPEX', source: 'KPI Value K-07 - KPI Adj EBITDA Margin - KPI Rule of 40 (K-12 S)' },
    G: { title: 'Adjusted EBITDA', what: EBITDA_WHAT, formula: 'Adj. EBITDA = CM + OPEX', source: 'KPI Value K-07 - KPI Adj EBITDA Margin' },
  },
  OP: {
    title: 'Operating profit',
    what: 'IFRS 18 required subtotal (spine step 13).',
    formula: 'OP = Adj. EBITDA + D&A + adjusting items (signed)',
    source: 'KPI Value K-08 - KPI Operating Margin - Net Profit - KPI Net Margin',
  },
  GM_PCT: {
    P: { title: 'Gross margin %', what: GM_WHAT, formula: 'GM % = GP ÷ NR', source: 'KPI Gross Margin % K-03 - GM % by category (dim_line)' },
    S: { title: 'Gross margin %', what: GM_WHAT, formula: 'GM % = GP ÷ NR', source: 'KPI Gross Margin % K-03 - KPI Subscription GM % - Payments GM % (same pattern on PAY)' },
    G: { title: 'Gross margin %', what: GM_WHAT, formula: 'GM % = GP ÷ NR', source: 'KPI Gross Margin % K-03' },
  },
  OPEX_PCT: {
    title: 'Opex % revenue',
    what: 'Sales & marketing, R&D and G&A as a share of net revenue. Lower is better, so the colour logic is inverted. Excludes other operating items, D&A and adjusting items.',
    formula: 'Opex % = −(SM + RD + GA) ÷ NR',
    source: 'new: Opex % NR = blocks SM + RD + GA ÷ NR (PL % NR rows) - spec KPI §5 1.3',
  },
  UNITS: { title: 'Units sold', what: 'Units shipped in the window (a flow: sums over the months).', formula: 'units = Σ units_sold', source: 'KPI Units Sold K-09 P' },
  NR_PER_UNIT: { title: 'Net revenue per unit', what: 'Net revenue divided by units sold: the price / mix lever.', formula: 'NR per unit = NR ÷ units sold', source: 'KPI NR per Unit K-10 P' },
  GTN_PCT: {
    title: 'Gross-to-net %',
    what: 'Deductions from gross revenue (trade spend, rebates, returns) as a share of gross revenue. Lower is better.',
    formula: 'GTN % = − GTN ÷ GR',
    source: 'KPI Gross-to-Net % K-04 P',
  },
  AP_PCT: {
    title: 'A&P % of NR',
    what: 'Advertising (working media) and consumer promotions as a share of net revenue. Neutral: no colour.',
    formula: 'A&P % = − (SM_P1 + SM_P2) ÷ NR',
    source: 'KPI A&P % NR K-05 P',
  },
  FY_OUTLOOK: {
    title: 'FY outlook vs Budget',
    what: 'Latest estimate of net revenue for the whole fiscal year: actual closed months plus the latest forecast for open months (C-02). Same card for every company.',
    formula: 'attainment = FY LE ÷ FY Budget',
    source: 'FY LE Amount - FY Budget Amount - PL Δ LE vs Budget (M-14)',
  },
  GMV: {
    title: 'GMV processed',
    what: 'Transaction value processed in the window, translated like amounts.',
    formula: 'GMV = Σ gmv_local → reporting currency, per month × currency',
    source: 'KPI GMV K-09 S - KPI Payments Take Rate K-05 S',
  },
  MERCHANTS: {
    title: 'Active merchants',
    what: 'Merchants with an active paid plan at the last month-end of the window; never a sum over months.',
    formula: 'merchants = active_merchants_end at the window end (K-23)',
    source: 'KPI Active Merchants K-10 S - new: KPI GMV ÷ KPI Active Merchants',
  },
  ARR: {
    title: 'ARR (run-rate)',
    what: 'Platform-subscription net revenue of the last month in the window × 12. A run-rate proxy, not contract ARR.',
    formula: 'ARR = SUB NR (last month) × 12',
    source: 'KPI ARR K-04 S - new: KPI ARR − KPI ARR as Compare B',
  },
  MIX: {
    title: 'Revenue mix',
    what: 'Platform subscriptions and Payments as shares of net revenue; the rest is apps, partners & ads and professional services. Neutral: no colour.',
    formula: 'share = NR of the service line ÷ NR',
    source: 'Prof NR Share by dim_line (SUB, PAY) - gap analysis P1',
  },
};

/** A card's ⓘ copy: the shared block's text for the code (and company), else the model's label and definition. */
export function cardInfo(code: string, entity: EntityCode, label: string, definition: string): InfoCopy {
  const entry = CARD_COPY[code];
  const copy: CardCopy | undefined = entry === undefined ? undefined : 'title' in entry ? entry : entry[entity];
  if (!copy) return { title: label, what: definition, formula: null, values: [], source: `KPI Value (${code})` };
  return { title: copy.title, what: copy.what, formula: copy.formula, values: [], source: copy.source };
}

// ---------------------------------------------------------------------------
// "How to read", one per view (parity rule 19): the shared block's lines.

export interface HowToRead {
  title: string;
  lines: { label: string; value: string }[];
}

const LEGEND =
  'Status vs Budget only: grey on track (±1 % / ±0.3 pp), amber watch (to 3 % / 1 pp), red off track beyond, green ahead; "lower is better" inverts on Opex %. ⓘ on each card holds its definition and sources.';

function body(view: Exclude<ViewKey, 'pnl'>, entity: EntityCode): { title: string; lines: { label: string; value: string }[] } {
  switch (view) {
    case 'kpi':
      return {
        title: 'Vitals',
        lines: [
          { label: 'Results', value: 'Net revenue, Adj. EBITDA and Operating profit, then Gross margin % and Opex % revenue.' },
          { label: 'Drivers & health', value: 'Five cards whose content follows the company (L-10); FY outlook for every company.' },
          { label: 'Card face', value: 'Value, Δ vs Compare A and Compare B ($ and %, pp for ratios), “on plan” for a zero Δ, status chip vs Budget.' },
        ],
      };
    case 'ana':
      return {
        title: 'Analysis',
        lines: [
          {
            label: 'Page 1',
            value: 'Net revenue bridge (drivers at constant currency → CC subtotal → FX → actual) and profit bridge (comparison Adj. EBITDA → actual → operating profit).',
          },
          { label: 'Page 2', value: 'Largest variances to operating profit: Top 8 / 12 / All, by block or by |Δ|, cut by slice, prior-year Δ and of which FX.' },
          { label: 'Paging', value: '‹ › in the tabs row, or the ← → keys.' },
          {
            label: 'Colours',
            value: 'Bridges: increase green, decrease orange, totals company colour, subtotals dark, FX hatched; axes do not start at zero. Variance bars: right helps profit, left hurts, one scale.',
          },
        ],
      };
    case 'prof':
      return {
        title: 'Profitability',
        lines: [
          { label: 'Page 1', value: 'Table by region at constant currency (status dot on CM Δ only) and concentration bars (share of revenue, contribution and Adj. EBITDA).' },
          { label: 'Page 2', value: `Growth × margin by region with prior-year trails, and the mix of region × ${lineWord(entity)}.` },
          { label: 'Basis', value: 'Constant currency by default when comparing; by region nothing is allocated (opex is booked by region, C-31).' },
          { label: 'Paging', value: '‹ › in the tabs row, or the ← → keys.' },
        ],
      };
  }
}

/** The view's guide, opening with the selection sentence (parity rules 6, 7, 13). */
export function howToRead(view: Exclude<ViewKey, 'pnl'>, filter: FilterState, reference: ReferenceData): HowToRead {
  const b = body(view, filter.entity);
  const compares = [filter.compareA, filter.compareB].filter((c) => c !== 'NONE').map((c) => VERSION_LABEL[c as Exclude<typeof c, 'NONE'>]);
  const compare = compares.length > 0 ? compares.join(' and ') : VERSION_LABEL[bridgeComparison(filter)];
  return {
    title: `How to read - ${b.title}`,
    lines: [{ label: 'Showing', value: `${periodWindowText(filter, reference)} - ${filter.currency} ${filter.units} - vs ${compare}` }, ...b.lines, { label: 'Legend', value: LEGEND }],
  };
}

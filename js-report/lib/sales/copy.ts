import type { Comparator, MarketSel, SalesSelection } from './types.ts';
import { TIME_VIEW_NAMES, isComplete, monthLabel, windowLabel, windowOf } from './windows.ts';

// UI copy built from the selection (design-tokens §9: " - " separator, "Showing …" sentence, subtitles never
// hard-coded; CONV-001: copy lives in the engine, components render strings).

export const TITLE = 'Mirelo - Sales & revenue';

export const MARKET_NAMES: Readonly<Record<MarketSel, string>> = {
  ALL: 'All markets',
  PL: 'Poland',
  RO: 'Romania',
  PT: 'Portugal',
};

export const CMP_NAMES: Readonly<Record<Comparator, string>> = { BUD: 'Budget', PY: 'Prior year' };

/** Short channel names for sub-lines and axis labels (dim_channel.channel_name is the long form). */
export const CHANNEL_SHORT: Readonly<Record<string, string>> = {
  APP: 'App',
  PAID: 'Paid',
  PARTNER: 'Partner',
  AGENT: 'Agent',
};

export const SEGMENT_NAMES: Readonly<Record<string, string>> = {
  CONSUMER: 'Consumer',
  MICRO_BUSINESS: 'Micro-business',
};

export const STREAM_NAMES: Readonly<Record<string, string>> = {
  INTEREST: 'Interest',
  FEE: 'Fees',
  INTERCHANGE: 'Interchange',
  SUBSCRIPTION: 'Subscriptions',
};

/** "Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026" */
export function periodLine(sel: SalesSelection, lastClosed: number, firstMonth: number): string {
  const w = windowOf(sel.tv, sel.anchor);
  const shown = isComplete(w, firstMonth)
    ? windowLabel(w)
    : `${windowLabel({ start: firstMonth, end: w.end })} (data from ${monthLabel(firstMonth)})`;
  const other: Comparator = sel.cmp === 'BUD' ? 'PY' : 'BUD';
  return [
    `Showing ${shown}`,
    TIME_VIEW_NAMES[sel.tv],
    MARKET_NAMES[sel.market],
    `Actual vs ${CMP_NAMES[sel.cmp]} and ${CMP_NAMES[other]}`,
    `Closed through ${monthLabel(lastClosed)}`,
  ].join(' - ');
}

/** Story events annotated on trend charts when their month is in range (README "Stories built into the data"). */
export const STORY_EVENTS: readonly { month: string; text: string; charts: readonly string[] }[] = [
  { month: '2026-03', text: 'RO credit policy tightened Mar 2026', charts: ['o8', 'p10'] },
  { month: '2026-01', text: 'Plus price rise Jan 2026', charts: ['r11'] },
];

export const HOW_TO_READ =
  '▲ up / ▼ down - green = favourable, amber = watch, red = off. Hero cards compare with Budget and Prior year; KPI cards with the header comparator (Prior year where no Budget exists). Money in EUR at actual monthly rates; Budget at Budget rates.';

/** ⓘ copy per card (what it shows - how to read). One source for both tracks once docs/ADD/features/sales-info-popovers.md exists. */
export const INFO: Readonly<Record<string, string>> = {
  o1: 'Loans disbursed in the window (count) and their principal in EUR, translated per month × currency at actual rates.',
  o2: 'Clients whose first loan was disbursed in the window. Not first approval, not first account.',
  o3: 'Borrowers in the window with at least one earlier loan ÷ all borrowers in the window (client-weighted). Sub-line: share of loans that are repeat loans.',
  o4: '30+ days past due balance ÷ outstanding principal at the last month of the window. Down is favourable.',
  o5: 'Loans per month for the 13 months to the selected month: Actual, Budget and Prior year. Click a month to select it.',
  o6: 'New clients in the window by acquisition channel, with the Prior-year window as an outline.',
  o7: 'Share of a first-loan cohort with a second loan within N days. Months are counted only once all their clients are N days old.',
  o8: '30+ DPD by balance per market, month-end, 13 months.',
  o9: 'Loans, principal, new clients, returning % and 30+ DPD per market. Click a row to filter the page; double-click or Show loans for the loan list.',
  l1: 'Count of loans disbursed in the window.',
  l2: 'Disbursed principal in EUR at actual rates; the sub-line shows the gap to Budget at Budget FX (constant currency).',
  l3: 'Principal ÷ loans. Context metric: no favourable side.',
  l4: 'Approved ÷ submitted applications, cohorted by submission day. No Budget exists for this ratio.',
  l5: 'Disbursed ÷ approved applications.',
  l6: 'Median hours from submission to cash (MEDIANX over the window’s loans). Down is favourable.',
  l7: 'Loans per month: Actual columns, Budget line, Prior year outline.',
  l8: 'Applications by stage in the window, with % of the previous stage and the Δ vs Prior year in pp.',
  l9: 'Principal bridge from Budget to Actual: volume (loans × budget ticket), product × market mix, ticket, and FX (actual vs budget rates).',
  l10: 'Loans in the window per market, split by product.',
  l11: 'Loans vs a channel target. The dataset has no channel targets (fact_target holds market × product and agent rows only).',
  l12: 'Median hours of the two timed legs (submitted → approved, approved → cash) against the stage SLA in dim_funnel_stage.',
  l13: 'Agents and partners: loans vs quota (AGENT_LOANS) in the window, sorted by attainment. Click a row for that agent’s loans.',
  c1: 'Clients whose first loan was disbursed in the window.',
  c2: 'Borrowers with an earlier loan ÷ borrowers (client-weighted). No Budget exists for this ratio.',
  c3: 'Repeat loans ÷ loans (loan-weighted).',
  c4: 'Approved ÷ submitted applications of first-time applicants.',
  c5: 'Share of the cohort whose first loan was 6 months before the selected month with a second loan within 180 days.',
  c6: 'Median days between a repeat loan and the client’s previous loan.',
  c7: 'New clients per month by acquisition channel, Budget total as a line.',
  c8: 'First-time applicants by stage in the window, with % of the previous stage.',
  c9: 'Second-loan share by days since first loan, for the last four quarter cohorts.',
  c10: 'Returning % (client-weighted) per market × client segment; bars: repeat share of loans per product with the company average as a tick.',
  c11: 'Clients whose first loan falls in the window, top by principal to date (draft sample). Click a row for the client card.',
  p1: '30+ DPD balance ÷ outstanding at the last month of the window, against the planned risk appetite (DPD30_RATIO).',
  p2: '90+ DPD balance ÷ outstanding.',
  p3: 'Loans 30+ DPD ÷ active loans.',
  p4: 'Loans first 90+ within 6 months on book ÷ loans disbursed, for the vintage 6 months before the selected month.',
  p5: '60–89 DPD balance this month ÷ 30–59 balance last month (approximation: balances also amortise).',
  p6: 'Provision charge annualised ÷ average outstanding over the window.',
  p7: 'Overdue balance per bucket at month-end, 13 months.',
  p8: 'Cumulative share of loans that reached 30+ DPD by months on book, last four vintage quarters.',
  p9: '30+ DPD by balance per product × market at the last month of the window.',
  p10: '30+ DPD by balance per market, month-end, 13 months.',
  p11: 'Balance rolling one bucket per month: 1–29 → 30+ and 30 → 60.',
  p12: 'One bubble per product × market: average ticket (x), 30+ DPD (y), outstanding (size). Worst bubble in yellow.',
  p13: 'Loans 30+ days past due at the last close (Sep 2026 snapshot), worst first (draft sample: top 100 per market).',
  r1: 'Interest, fees, interchange and subscription revenue in EUR at actual rates.',
  r2: 'Revenue ÷ Budget revenue. Bands: ≥ 100 % good, 95–99.9 % watch, below off.',
  r3: 'Interest income. Budget is set per product, not per stream, so it compares with Prior year.',
  r4: 'Origination and late fees. Budget is set per product, not per stream, so it compares with Prior year.',
  r5: 'Monthly recurring revenue of paying tiers (Plus, Pro) at month-end.',
  r6: 'Paying subscribers (Plus, Pro) at month-end.',
  r7: 'Revenue per month: Actual, Budget and Prior year.',
  r8: 'Revenue per month by stream.',
  r9: 'Revenue vs Budget per market in the window.',
  r10: 'Paying subscribers per month by tier; MRR on top of each column.',
  r11: 'Paying subscribers churned ÷ subscribers at the start of the month.',
  r12: 'Share of loans per month by channel.',
  r13: 'Revenue per stream × market. Budget exists for interchange, subscriptions and the total only.',
};

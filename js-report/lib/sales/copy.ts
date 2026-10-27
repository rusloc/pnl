import type { Comparator, MarketSel, SalesSelection, ViewId } from './types.ts';
import { TIME_VIEW_NAMES, isComplete, monthLabel, windowLabel, windowOf } from './windows.ts';

// UI copy built from the selection (design-tokens §9: " - " separator, "Showing …" sentence, subtitles never
// hard-coded; CONV-001: copy lives in the engine, components render strings). ADR-0012: card faces carry title ·
// value - delta rows - status chip only; everything else lives in the ⓘ pop-ups and the per-view "How to read".

export const TITLE = 'Mirelo - Sales & revenue';

export const MARKET_NAMES: Readonly<Record<MarketSel, string>> = {
  ALL: 'All markets',
  PL: 'Poland',
  RO: 'Romania',
  PT: 'Portugal',
};

export const CMP_NAMES: Readonly<Record<Comparator, string>> = { BUD: 'Budget', PY: 'Prior year' };

/** Short channel names for pop-up values and axis labels (dim_channel.channel_name is the long form). */
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

// ---------- ⓘ pop-ups: what it is - why it matters - formula in words - sub-values - source ----------

export interface InfoValue {
  label: string;
  value: string;
}

export interface InfoVM {
  what: string;
  why: string;
  formula: string;
  values: InfoValue[];
  source: string;
}

type InfoCopy = readonly [what: string, why: string, formula: string, source: string];

const L = 'fact_loan (pre-aggregated: loans-month)';
const F = 'fact_application (funnel-month)';
const P = 'fact_loan_month (portfolio-month)';
const R = 'fact_revenue_month';
const S = 'fact_subscription_month';
const T = 'fact_target (BUD)';
const X = 'param_fx (ACTUAL_AVG / BUDGET)';

const INFO: Readonly<Record<string, InfoCopy>> = {
  o1: [
    'Loans disbursed in the window and their principal.',
    'Volume is the first Tier-1 number: did we lend what we planned?',
    'Count of loans with a disbursed date in the window; principal = Σ local principal ÷ actual rate of the month × currency.',
    `${L} - ${T} LOANS - ${X}`,
  ],
  o2: [
    'Clients whose first loan was disbursed in the window.',
    'New clients feed next year’s repeat book; stalling acquisition shows here first.',
    'Σ first loans in the window (not first approval, not first account).',
    `${L} - ${T} NEW_CLIENTS`,
  ],
  o3: [
    'Share of borrowers in the window who had borrowed before.',
    'Returning clients are cheaper to serve and lower risk.',
    'Distinct borrowers with an earlier loan ÷ distinct borrowers (client-weighted). No Budget exists for this ratio.',
    `${L} (window-stats)`,
  ],
  o4: [
    'Balance 30+ days past due at the last month of the window.',
    'The health check on the growth; down is favourable.',
    '(30–59 + 60–89 + 90+ DPD balance) ÷ outstanding at month-end, each market at its own rate.',
    `${P} - ${T} DPD30_RATIO`,
  ],
  o5: [
    'Loans per month for the 13 months to the selected month.',
    'Shows whether a gap to Budget is one month or a trend.',
    'Monthly count of disbursed loans: Actual, Budget and the same month a year earlier. Click a month to select it.',
    `${L} - ${T} LOANS`,
  ],
  o6: [
    'New clients in the window by acquisition channel.',
    'Shows which channel carries acquisition and how it moved against last year.',
    'Σ first loans by channel; the outline is the same window a year earlier.',
    `${L} - dim_channel`,
  ],
  o7: [
    'Share of a first-loan cohort with a second loan within N days.',
    'Early repeat is the leading signal for returning clients.',
    'Clients with a second loan ≤ N days after the first ÷ cohort clients; a month counts at day N once all its clients are N days old.',
    `${L} (cohort-curve) - dim_client`,
  ],
  o8: [
    '30+ DPD by balance per market, month-end, 13 months.',
    'Separates a market problem from a portfolio-wide one.',
    'Per market: 30+ DPD balance ÷ outstanding at each month-end.',
    P,
  ],
  o9: [
    'Loans, principal, new clients, returning % and 30+ DPD per market.',
    'The first drill: which market drives the gap.',
    'Card definitions per market; Δ follows the header comparator. Click filters the page; double-click or Show loans lists the loans.',
    `${L} - ${P} - ${T}`,
  ],
  l1: [
    'Loans disbursed in the window.',
    'The volume half of originations.',
    'Count of loans with a disbursed date in the window.',
    `${L} - ${T} LOANS`,
  ],
  l2: [
    'Disbursed principal in EUR.',
    'The money half of originations; FX can move it with no change in lending.',
    'Σ local principal ÷ actual rate of the month × currency. Constant currency re-translates actuals at the Budget rate.',
    `${L} - ${T} PRINCIPAL_LOCAL - ${X}`,
  ],
  l3: [
    'Average principal per loan.',
    'Context for volume: bigger tickets can hide fewer loans.',
    'Principal ÷ loans. No favourable side.',
    L,
  ],
  l4: [
    'Approved share of submitted applications.',
    'Credit policy and applicant quality both show here.',
    'Approved ÷ submitted, cohorted by submission day. No Budget exists for this ratio.',
    F,
  ],
  l5: [
    'Disbursed share of approved applications.',
    'Approved offers not taken up are lost revenue.',
    'Disbursed ÷ approved.',
    F,
  ],
  l6: [
    'Median hours from submission to cash.',
    'Speed wins repeat clients; down is favourable.',
    'Median (MEDIANX) of hours to cash over the window’s loans.',
    `${L} (window-stats)`,
  ],
  l7: [
    'Loans per month: Actual columns, Budget line, Prior year outline.',
    'Month-by-month view of the volume gap.',
    'Monthly count of disbursed loans; Budget LOANS.',
    `${L} - ${T}`,
  ],
  l8: [
    'Applications by funnel stage in the window.',
    'Shows at which step applicants are lost.',
    'Each stage counts applications that reached it; % = stage ÷ previous stage; Δ in pp vs the same window a year earlier.',
    F,
  ],
  l9: [
    'Principal bridge from Budget to Actual.',
    'Splits the gap into lending (volume, mix, ticket) and FX.',
    'Volume = Δ loans × Budget ticket; mix = product × market share shift at Budget tickets; ticket = actual loans × ticket change; FX = actual at actual rates − actual at Budget rates.',
    `${L} - ${T} - ${X}`,
  ],
  l10: [
    'Loans in the window per market, split by product.',
    'Product mix drives ticket size and risk.',
    'Count of loans by market × product.',
    `${L} - dim_product`,
  ],
  l11: [
    'Loans against a channel target.',
    'Would show which channel misses its plan.',
    'Not available: the dataset has no channel targets (fact_target holds market × product and agent rows only).',
    T,
  ],
  l12: [
    'Median hours of the two timed legs against the stage SLA.',
    'Shows which leg slows cash out.',
    'Submitted → approved and approved → cash medians; SLA = KYC + credit stage SLA hours.',
    `${L} (window-stats) - dim_funnel_stage`,
  ],
  l13: [
    'Agents and partners against their loan quota.',
    'Assisted channels depend on a few people; laggards show early.',
    'Agent loans ÷ AGENT_LOANS quota in the window, sorted by attainment. Click a row for that agent’s loans.',
    `${L} - ${T} AGENT_LOANS - dim_agent`,
  ],
  c1: [
    'Clients whose first loan was disbursed in the window.',
    'Acquisition volume against plan.',
    'Σ first loans in the window.',
    `${L} - ${T} NEW_CLIENTS`,
  ],
  c2: [
    'Borrowers with an earlier loan, share of all borrowers.',
    'Loyalty at client level.',
    'Distinct returning borrowers ÷ distinct borrowers. No Budget exists for this ratio.',
    `${L} (window-stats)`,
  ],
  c3: ['Repeat loans, share of all loans.', 'Loyalty at loan level.', 'Repeat loans ÷ loans.', L],
  c4: [
    'Approval rate of first-time applicants.',
    'The gate for new clients; credit policy changes show here first.',
    'Approved ÷ submitted for new applicants.',
    F,
  ],
  c5: [
    'Share of a cohort with a second loan within 180 days.',
    'The leading indicator of the returning share.',
    'Cohort = first loans 6 months before the selected month; second loan ≤ 180 days after the first ÷ cohort clients. Compared with the same cohort month a year earlier.',
    `${L} (cohort-curve)`,
  ],
  c6: [
    'Median days between a repeat loan and the client’s previous loan.',
    'How quickly clients come back. No favourable side.',
    'Median gap in days over the window’s repeat loans.',
    `${L} (window-stats)`,
  ],
  c7: [
    'New clients per month by channel, Budget total as a line.',
    'Shows which channel moved acquisition.',
    'Σ first loans by month × channel; Budget NEW_CLIENTS.',
    `${L} - ${T}`,
  ],
  c8: [
    'First-time applicants by stage in the window.',
    'Where new clients are lost.',
    'Leads → submitted → approved → disbursed for new applicants; % of the previous stage.',
    F,
  ],
  c9: [
    'Second-loan share by days since first loan, last four quarter cohorts.',
    'Compares how fast recent cohorts come back.',
    'Clients with a second loan ≤ N days ÷ cohort clients, right-censored at the last close.',
    `${L} (cohort-curve)`,
  ],
  c10: [
    'Returning % per market × client segment; repeat share per product.',
    'Shows where loyalty is strong or weak.',
    'Matrix: client-weighted returning %; bars: repeat loans ÷ loans per product, tick = company average.',
    `${L} (window-stats) - dim_client`,
  ],
  c11: [
    'Clients whose first loan falls in the window.',
    'Puts names on the cohort behind the numbers.',
    'Top clients by principal since 2024 (draft sample); loan states are the last-close snapshot. Click a row for the client card.',
    `${L} - dim_client`,
  ],
  p1: [
    'Balance 30+ days past due at the last month of the window.',
    'The headline risk ratio against the planned risk appetite.',
    '30+ DPD balance ÷ outstanding at month-end.',
    `${P} - ${T} DPD30_RATIO`,
  ],
  p2: ['Balance 90+ days past due.', 'The part most likely to be written off.', '90+ DPD balance ÷ outstanding.', P],
  p3: [
    'Loans 30+ days past due, share of active loans.',
    'A count view of the same risk.',
    'Loans 30+ DPD ÷ active loans.',
    P,
  ],
  p4: [
    'Loans that reached 90+ DPD within 6 months on book.',
    'Judges underwriting quality early, before write-off.',
    'First-90+ loans with months on book ≤ 6 ÷ loans disbursed; vintage = 6 months before the selected month.',
    P,
  ],
  p5: [
    'Overdue balance rolling one bucket per month.',
    'High roll rates mean collections are not catching up.',
    '60–89 balance this month ÷ 30–59 balance last month (balances also amortise).',
    P,
  ],
  p6: [
    'Provision charge as an annual rate of the average book.',
    'What the risk costs in money.',
    'Σ provision ÷ months × 12 ÷ average month-end outstanding.',
    P,
  ],
  p7: [
    'Overdue balance per bucket at month-end, 13 months.',
    'Shows whether arrears build up or clear.',
    'Month-end balance in 1–29, 30–59, 60–89 and 90+ DPD, in EUR.',
    P,
  ],
  p8: [
    'Cumulative share of loans that reached 30+ DPD by months on book.',
    'Compares recent vintages at the same age.',
    'First-30+ loans up to month N ÷ loans disbursed, per vintage quarter.',
    P,
  ],
  p9: [
    '30+ DPD by balance per product × market.',
    'Locates the risk.',
    '30+ DPD balance ÷ outstanding at the last month of the window.',
    P,
  ],
  p10: [
    '30+ DPD by balance per market, 13 months.',
    'Tracks a market’s risk story over the year.',
    'Per market: 30+ DPD balance ÷ outstanding at each month-end.',
    P,
  ],
  p11: [
    'Balance rolling one bucket per month.',
    'Early warning for rising arrears.',
    '30→60: 60–89 now ÷ 30–59 last month; 1–29→30+: 30–59 now ÷ 1–29 last month.',
    P,
  ],
  p12: [
    'One bubble per product × market.',
    'Shows whether the risky segments are also the big ones.',
    'x = average ticket, y = 30+ DPD by balance, size = outstanding; worst bubble in yellow.',
    `${P} - ${L}`,
  ],
  p13: [
    'Loans 30+ days past due at the last close, worst first.',
    'The collection list behind the ratios.',
    'Loan-level snapshot at the last closed month (draft sample: top 100 per market by DPD). Click a row for the client card.',
    'fact_loan (detail sample)',
  ],
  r1: [
    'Revenue from interest, fees, interchange and subscriptions.',
    'What the loans and accounts earned.',
    'Σ local revenue ÷ actual rate of the month × currency.',
    `${R} - ${T} REVENUE_LOCAL - ${X}`,
  ],
  r2: [
    'Revenue against Budget.',
    'Are we on the number?',
    'Revenue ÷ Budget revenue; ≥ 100 % good, 95–99.9 % watch, below off (param_thresholds).',
    `${R} - ${T} REVENUE_LOCAL - param_thresholds`,
  ],
  r3: [
    'Interest income plus origination and late fees: the revenue the loans earn.',
    'The lending streams together; the Budget carries them together per loan product.',
    'Σ INTEREST + FEE revenue; Budget = REVENUE_LOCAL of the loan products at the BUDGET rate.',
    `${R} - ${T} REVENUE_LOCAL (loan products)`,
  ],
  r4: [
    'Interchange earned on the debit card.',
    'The card stream grows with account activity, outside lending.',
    'Σ INTERCHANGE revenue; Budget = REVENUE_LOCAL of CARD at the BUDGET rate.',
    `${R} - ${T} REVENUE_LOCAL (CARD)`,
  ],
  r5: [
    'Monthly recurring revenue of paying tiers at month-end.',
    'The recurring part of revenue.',
    'Plus and Pro subscribers at month-end × monthly price, in EUR.',
    S,
  ],
  r6: [
    'Paying subscribers at month-end.',
    'The base that MRR rests on.',
    'Plus + Pro subscribers at the last month of the window.',
    S,
  ],
  r7: [
    'Revenue per month: Actual, Budget, Prior year.',
    'Month-by-month view of the revenue gap.',
    'Monthly revenue in EUR; Budget REVENUE_LOCAL at Budget rates.',
    `${R} - ${T}`,
  ],
  r8: [
    'Revenue per month by stream.',
    'Shows which stream moves the total.',
    'Monthly revenue in EUR by revenue type.',
    R,
  ],
  r9: [
    'Revenue against Budget per market.',
    'Locates the miss.',
    'Revenue ÷ Budget revenue in the window; tick = Budget.',
    `${R} - ${T}`,
  ],
  r10: [
    'Paying subscribers per month by tier; MRR above the columns.',
    'Tier mix and MRR side by side, no dual axis.',
    'Month-end subscribers by tier; label = MRR in EUR.',
    S,
  ],
  r11: [
    'Share of paying subscribers lost in the month.',
    'Churn spikes after price changes.',
    'Churned ÷ subscribers at the start of the month (Plus + Pro).',
    S,
  ],
  r12: [
    'Share of loans per month by channel.',
    'Channel mix moves acquisition cost and risk.',
    'Loans by channel ÷ loans, per month.',
    L,
  ],
  r13: [
    'Revenue per stream × market.',
    'The detail behind the revenue cards.',
    'Budget exists for interchange (card), subscriptions (Plus + Pro) and the total; interest and fees share the loan-product Budget, so their rows show n/a. Click a row for that market’s loans.',
    `${R} - ${T}`,
  ],
};

/** ⓘ content for a card: static copy + the card's computed sub-values. */
export function info(id: string, values: InfoValue[] = []): InfoVM {
  const c = INFO[id];
  if (!c) throw new Error(`copy: no ⓘ text for card ${id}`);
  return { what: c[0], why: c[1], formula: c[2], values, source: c[3] };
}

// ---------- "How to read", one per view ----------

export interface HowToReadVM {
  title: string;
  lines: InfoValue[];
}

const LEGEND = '▲ up / ▼ down - green = favourable, amber = watch, red = off. ⓘ on each card opens its definition.';
const HOW: Readonly<Record<ViewId, readonly [string, readonly InfoValue[]]>> = {
  overview: [
    'Overview',
    [
      { label: 'Top band', value: 'The four Tier-1 numbers with their gap to Budget and to the prior year.' },
      { label: 'Grid', value: 'Why each number moved: trend vs Budget, channels, cohorts, risk by market.' },
      { label: 'Table', value: 'Per market; click filters the page, double-click lists the loans.' },
    ],
  ],
  loans: [
    'Loans issued',
    [
      { label: 'Top band', value: 'Volume, money, ticket, funnel rates and speed.' },
      { label: 'Grid', value: 'Trend, funnel, Budget → Actual bridge, product mix, cycle time.' },
      { label: 'Table', value: 'Agents and partners by quota attainment; click for their loans.' },
    ],
  ],
  clients: [
    'Clients',
    [
      { label: 'Top band', value: 'Acquisition, return and the speed of return.' },
      { label: 'Grid', value: 'Channels, new-client funnel, cohort curves, loyalty by segment.' },
      { label: 'Table', value: 'Clients of the window’s cohort; click for the client card.' },
    ],
  ],
  portfolio: [
    'Portfolio quality',
    [
      {
        label: 'Top band',
        value: 'Arrears by balance and count, vintage quality, roll rate, cost of risk; down is favourable.',
      },
      { label: 'Grid', value: 'Buckets, vintages, risk by product × market, roll rates, size × risk.' },
      { label: 'Table', value: 'Worst overdue loans at the last close; click for the client card.' },
    ],
  ],
  revenue: [
    'Revenue & targets',
    [
      { label: 'Top band', value: 'Revenue, attainment, the two lending streams and subscriptions.' },
      { label: 'Grid', value: 'Trend vs Budget, streams, attainment by market, tiers, churn, channel mix.' },
      { label: 'Table', value: 'Stream × market against Budget and the prior year; click for the market’s loans.' },
    ],
  ],
};

export function howToRead(sel: SalesSelection, lastClosed: number, firstMonth: number): HowToReadVM {
  const [title, lines] = HOW[sel.view];
  return {
    title: `How to read - ${title}`,
    lines: [
      { label: 'Showing', value: periodLine(sel, lastClosed, firstMonth) },
      ...lines,
      { label: 'Legend', value: LEGEND },
    ],
  };
}

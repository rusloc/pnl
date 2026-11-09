// Fixed copy of the ACME Marketing JS flavour, seeded verbatim from the Power BI flavour (pbi-report/ACME Marketing/,
// 2026-11-05 state): card titles and ⓘ texts from the calculated table dim_card (ACME Marketing.SemanticModel/definition/
// tables/dim_card.tmdl, its DATATABLE literal), How to read text from the textboxes howto_<view>_title / howto_<view>_text,
// tab labels from tab_<view>, vitals labels from the measures 'Vital V1 SVG' … 'Vital V6 SVG', the dynamics title from
// dyn_l1 … dyn_l6 and the ⓘ note suffix from the measure 'Card Info Note'. Strings are byte-identical to the source
// ("|" is the text divider since redesign round 1; the "·" inside campaign and segment names comes from the dataset).
// Numbers never live here except where the PBI text itself carries a story number (How to read "This window" lines);
// every computed value comes from the engine (contract pending: docs/ADD/features/marketing-js-flavour.md).

/** The header shows `name` (the hdr_brand text box); `alt` (its alt text) is the document title and the header's
 *  accessible name only. */
export const BRAND = {
  name: 'ACME Marketing',
  /** hdr_brand alt text: document title + aria-label, never drawn (no subtitles since round 1). */
  alt: 'Paid Acquisition Console',
  logoAlt: 'ACME Marketing logo',
} as const;

/** The five view tabs, in tab order. */
export const VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'channels', label: 'Channels' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'journey', label: 'Journey' },
  { key: 'cohorts', label: 'Cohorts' },
] as const;
export type ViewKey = (typeof VIEWS)[number]['key'];

/** One How to read pop-up per view; one string per paragraph. */
export const HOW_TO_READ = {
  title: 'How to read',
  text: {
    overview: [
      "Top band: the six vitals for the window, each with its change against the same period last year (arrow + colour: green = favourable) and last year's value below. The binoculars before each vital's label open that one metric's daily dynamics. Vitals follow the Filters only; a click in a card never re-scopes them.",
      'Read down: the funnel shows the absolute count of each stage, Guardrails whether a good headline hides a bad quarter, and the channel card where the money goes against where the customers come from; Anomalies lists the campaigns whose paid customers moved most and Top movers the largest changes in 90-day ROAS (switch Worst 5 | Top 5 on each); the bottom chart shows when it moved: spend and plan (pale) as bars, paid CAC as a line on the right axis (dotted line = Oct 18).',
      'This window: spend +7 % and CAC up; trial → paid fell on Oct 18 on mobile paid social, mostly Meta Lookalike 2 % (creative fatigue). Decision: rotate the creative, hold the budget.',
      'ⓘ on each card opens its definition.',
    ],
    channels: [
      'One row per channel; + opens the platforms. Click a row (or a bar) to scope the other cards and the Campaigns view: the chips line then shows Selected:. Click again to clear.',
      "CAC = spend ÷ paid customers under the selected model. Web vs app shows each stage's conversion from the previous one; the two cards below count paid customers per channel on web and on mobile, with the channel's CAC beside the count.",
      'Flags: Fatigue, Frequency, View-through heavy, CPA over (only without a root cause), Over-pacing, Underspent, Learning; thresholds from param_target.',
    ],
    campaigns: [
      'The table lists Live and Learning campaigns by spend (pick Paused or Ended under Filters › Campaigns to add them). Click a row to select it: Keywords / placements follows the selection, Churn and Refund by channel scope to its channel.',
      'Without a click Keywords / placements shows the worst mover of the window (largest drop in 90-day ROAS): keywords for search, placements for the others.',
      'Churn by channel: customers lost in the trailing 3 complete months; Refund by channel: refunds of the 12 acquisition months to the window end. Top 5 channels each, absolute counts (DDA credits).',
    ],
    journey: [
      'After the click: landing and store pages (visits, conversion, bounce, LCP; bounce and LCP do not apply to store pages), then the onboarding steps, the time to the first dashboard and the activation rate per platform segment.',
      'This window: App Store CVR is flat (31 %), so the trial → paid drop is not on the landing side; the largest onboarding loss is Connect data source; median time to activation 26 h.',
      'Activation counts are cohorted by sign-up day: the last 7 days (30 for the time chart) are partial by construction.',
    ],
    cohorts: [
      "Cohorts use DDA credits and the scope's campaigns; the window picks which acquisition months show (up to its end month), its start does not.",
      "Payback heatmap: one row per acquisition month (the 12 before the window's end month), one column per month since acquisition; the cell is the cumulative payback of the cohort's CAC, darker = closer, green = paid back. Pick Meta prospecting · Lookalike 2% under Filters › Campaigns (or click it in the Campaigns table) to see its Nov 2025 – Jan 2026 rows turn green at month 9.",
      'Retention grid: share of the cohort active on day N; blank where the day has not been reached yet. Right: LTV:CAC and payback months by channel against their lines (3:1, 12 months), and the size of each of the last 12 acquisition months.',
    ],
  },
} as const satisfies { title: string; text: Record<ViewKey, readonly string[]> };

/** dim_card in sort_order: the six vitals (V1 … V6) and the 23 cards of the five views. `question` is not rendered
 *  (no question lines since round 1); the ⓘ pop-up shows title, what, formula and note (+ infoNote suffix). */
export const CARDS = [
  {
    code: 'V1',
    title: 'Spend',
    question: 'Media spend in the window',
    what: 'Paid media cost of the window. Agency fee and paid-team cost are not in spend.',
    formula:
      'Σ spend_usd (fact_ad_delivery_day). Δ = spend ÷ spend of the same dates last year − 1; the sub-line is the last-year value.',
    note: 'A-20, A-30. Up is unfavourable (red). The tiles always compare with the same period last year, whatever the Filters comparison says.',
  },
  {
    code: 'V2',
    title: 'New clients',
    question: 'Registrations in the window',
    what: 'Sign-ups (registrations) from paid media that happened in the window.',
    formula: 'Σ signups (fact_funnel_day, by sign-up day). Δ vs the same dates last year.',
    note: 'A-20, A-34. Sign-ups never switch attribution model.',
  },
  {
    code: 'V3',
    title: 'Conversion into paid',
    question: 'Share of registrations that pay',
    what: 'Paid customers of the window per sign-up of the window, as a rate.',
    formula:
      'Paid customers (selected model, by conversion day) ÷ sign-ups (by sign-up day), both in the window. Δ in points vs the same dates last year.',
    note: 'A-20. A period rate, not a cohort: the data has no sign-up → payment link per customer, so a customer who signed up before the window and paid in it counts in the numerator.',
  },
  {
    code: 'V4',
    title: 'Time to activation',
    question: 'Days from sign-up to first dashboard',
    what: 'Median days from sign-up to activation (first dashboard) for the sign-ups of the window that activated within 30 days.',
    formula:
      'Median of the seven activation-time bins (fact_funnel_day act_*), linear inside the median bin, ÷ 24. Δ in days vs the same dates last year.',
    note: "A-20, A-47. Stands in for time to paid: the dataset has no sign-up → first-payment timing. Recent sign-ups have not had 30 days, so the window's median reads low against last year's.",
  },
  {
    code: 'V5',
    title: 'CAC',
    question: 'Cost of one new paying customer',
    what: 'Ad spend per paid customer (no team cost).',
    formula: 'Spend ÷ paid customers (selected model) = paid CAC. Δ vs the same dates last year.',
    note: 'A-20, A-38. Up is unfavourable. Blended CAC (with team cost) stays in the ⓘ formula of A-38 and in K2 / K6.',
  },
  {
    code: 'V6',
    title: 'ROAS 90 d',
    question: "Revenue return of the window's spend",
    what: '90-day revenue of the new customers per dollar of spend.',
    formula:
      'New MRR × R90 ÷ spend; R90 = revenue of the first 3 months ÷ revenue of month 1 of the newest complete cohort (campaign → channel → ALL). Δ vs the same dates last year.',
    note: 'A-20, A-42. The same ROAS as the Channel matrix and Top movers.',
  },
  {
    code: 'O1',
    title: 'Acquisition funnel',
    question: 'Where in the journey do we lose or win?',
    what: 'Seven stages from impressions to paid customers; bar widths on a log10 scale, the absolute count of each stage beside its bar.',
    formula:
      'Impressions, clicks, web sessions + installs, sign-ups, activated within 7 days, trials, paid customers (selected model).',
    note: 'A-32 … A-37. Activated counts are cohorted by sign-up day, so the last 7 days of a window are partial by construction.',
  },
  {
    code: 'O2',
    title: 'Guardrails',
    question: 'Can a good headline hide a bad quarter?',
    what: 'Six checks beside the vitals: trial → paid, D7 and D30 retention of paid cohorts, refund rate, brand share of search spend, attribution gap.',
    formula:
      'Meter = value against 2 × target, marker = target (param_target); colour = verdict (OK / WARN within 30 % / CRIT).',
    note: 'A-22. D7 / D30 come from the latest cohort month with a reportable D30 cell (Sep 2026 for the default window).',
  },
  {
    code: 'O3',
    title: 'Spend vs plan and CAC',
    question: 'When did it move?',
    what: "Spend per day as bars next to the day's plan (pale bars), and paid CAC per day as a line on the right axis.",
    formula:
      'Spend and plan per day (or week / month; plan = Σ budget ÷ days in month); paid CAC = spend ÷ paid customers per bucket (selected model). The dotted marker is the CAC step day (Oct 18).',
    note: 'A-52. The CAC line reads on the right axis (secondary axis accepted on 2026-11-04 instead of two stacked charts).',
  },
  {
    code: 'O7',
    title: 'Spend and paid customers by channel',
    question: 'Where the money goes, where customers come from',
    what: "Per channel, the window's spend next to its paid customers, on two aligned columns in the channel colour.",
    formula: 'Spend = Σ spend_usd; paid customers = Σ paid_customers (selected model), per channel of the scope.',
    note: 'A-52 (replaces Spend share vs new-MRR share, redesign round 1). Bars of each column share one scale.',
  },
  {
    code: 'O5',
    title: 'Anomalies and alerts',
    question: 'What needs a decision today?',
    what: 'Campaigns whose paid customers moved most against the comparison period: the five largest losses (Worst 5) or gains (Top 5), with the alert that trips on the campaign.',
    formula:
      "Δ = paid customers (selected model) − the previous period's (the same period last year in LY mode); campaigns with spend in both periods. Alert = the most severe campaign alert that trips (param_alert_rule: creative fatigue, install quality).",
    note: "A-52, A-64. When the comparison would start before the first day of data (e.g. Custom from Jan 1 2025), O5 and O6 compare the window's last 30 days. Channel, ALL and source alerts show in the Channel matrix flags (over plan, underspent), Guardrails (attribution gap) and the freshness dot (stale source).",
  },
  {
    code: 'O6',
    title: 'Top movers by Δ ROAS',
    question: 'Which campaigns changed most vs prior period?',
    what: 'The five best (Top 5) or five worst (Worst 5) campaigns by the change in 90-day ROAS against the previous period, in absolute ROAS points.',
    formula:
      'ROAS 90 d = New MRR × R90 ÷ spend; Δ = window − previous period. Campaigns with a ROAS objective and spend in both periods.',
    note: 'A-52 / A-42. R90 = 3-month revenue multiple of the newest complete cohort (campaign → channel → ALL fallback). When the comparison would start before the first day of data, the last 30 days of the window are compared.',
  },
  {
    code: 'C1',
    title: 'Channel matrix',
    question: 'Which channel earns the result, and where?',
    what: 'One row per channel, expandable to platform: spend, share, paid customers, CAC, ROAS 90 d, click → sign-up, pacing and the flag.',
    formula:
      'CAC = spend ÷ paid customers (selected model; equals CPA at the same scope). Flags (A-24): Fatigue, Frequency, View-through heavy, CPA over (only when no root cause trips), Over-pacing, Underspent; Learning when every spending campaign is learning.',
    note: 'Click a row to scope every card below and the Campaigns view (Selected: in the chips line). The vitals never re-scope.',
  },
  {
    code: 'C2',
    title: 'Web vs app funnel',
    question: 'Where does each platform leak?',
    what: 'Conversion of each stage from the previous one, web and app (iOS + Android) side by side.',
    formula:
      'Web: CTR, sessions ÷ clicks, sign-ups ÷ sessions; app: CTR, store views ÷ clicks, installs ÷ store views, sign-ups ÷ installs; then activated, trial and paid rates.',
    note: 'A-53, data README D-3 (store → install 29.4 %, web landing rate 79.7 %).',
  },
  {
    code: 'C5',
    title: 'Paid customers by channel, web',
    question: 'Who brings web customers, at what cost',
    what: "Paid customers of the web campaigns per channel; the label adds the channel's CAC on web.",
    formula:
      'Σ paid_customers (selected model) and spend ÷ paid customers, campaigns on WEB (visual filter on the platform).',
    note: 'A-53. Each campaign runs on one platform (dim_campaign.platform_code).',
  },
  {
    code: 'C6',
    title: 'Paid customers by channel, mobile',
    question: 'Who brings app customers, at what cost',
    what: "Paid customers of the iOS and Android campaigns per channel; the label adds the channel's CAC on mobile.",
    formula:
      'Σ paid_customers (selected model) and spend ÷ paid customers, campaigns on IOS + ANDROID (visual filter on the platform).',
    note: 'A-53. A Filters pick of one platform empties the other card.',
  },
  {
    code: 'P1',
    title: 'Campaigns',
    question: 'Which campaign is off, and how?',
    what: 'Every campaign in scope, sorted by spend: pacing, CPA, ROAS 90 d, CTR 7-day change, frequency and its flags.',
    formula:
      'Status Live + Learning by default (pick Paused or Ended in Filters › Campaigns to add them). CPA and ROAS show — for Lead and Retention objectives.',
    note: 'A-54. Click a row to select the campaign for the cards below (default: the worst mover of the window).',
  },
  {
    code: 'P5',
    title: 'Keywords / placements',
    question: 'Which terms buy conversions, which buy clicks?',
    what: "The selected campaign's top terms: keywords for search campaigns, placements or audiences for the others.",
    formula: 'CPC = spend ÷ clicks; CVR = sign-ups ÷ clicks; Conv. = sign-ups (fact_term_day).',
    note: "A-45. The eight terms carry 80–90 % of the campaign's delivery.",
  },
  {
    code: 'P6',
    title: 'Churn by channel',
    question: 'Which channel loses the most customers?',
    what: 'Customers lost per channel in the trailing 3 complete months: the five channels with the most.',
    formula:
      'Σ churned (fact_cohort_revenue_month, months since acquisition ≥ 1, calendar months in the trailing 3 complete months to the window end); DDA credits.',
    note: 'A-41, A-48. Counts are DDA credits, so channel values are fractional; the bars round. The rate (churned ÷ customers at start) feeds LTV:CAC.',
  },
  {
    code: 'P7',
    title: 'Refund by channel',
    question: "Which channel's customers refund the most?",
    what: 'Refunds per channel for the 12 acquisition months to the window end: the five channels with the most.',
    formula:
      "Σ refund_count (fact_cohort_revenue_month) of the cohorts acquired in the 12 months ending with the window's end month; DDA credits.",
    note: 'A-22, A-48. The refund rate (refunds ÷ cohort customers) is the Guardrails row.',
  },
  {
    code: 'J1',
    title: 'Landing and store pages',
    question: 'Is the leak after the click?',
    what: 'Web landing pages and the two store pages: visits (sessions or store views), conversion, bounce and LCP.',
    formula:
      'Web: sign-ups ÷ sessions, bounces ÷ sessions, sessions-weighted p75 LCP. Store pages: installs ÷ store views; bounce and LCP do not apply (—).',
    note: 'A-46. A flat store CVR while trial → paid falls means the leak is before the click.',
  },
  {
    code: 'J2',
    title: 'Onboarding steps, paid traffic',
    question: 'Which step loses new sign-ups?',
    what: 'Share of paid sign-ups that reached each onboarding step within 7 days; the largest drop is highlighted.',
    formula: 'Σ step column ÷ Σ sign-ups (fact_funnel_day), in step order; drop = previous step share − share.',
    note: 'A-47. Counts are cohorted by sign-up day, so the last 7 days of the window are partial.',
  },
  {
    code: 'J3',
    title: 'Sign-up → activation time',
    question: 'How fast do paid users reach the aha moment?',
    what: 'Activations within 30 days by hours from sign-up, as shares; the median bin is emphasised.',
    formula: 'Seven bins (< 1 h … 7–30 d) ÷ their sum; median hours by linear interpolation inside the median bin.',
    note: 'A-47, data README D-10: the window is right-censored (recent sign-ups have not had 30 days).',
  },
  {
    code: 'J4',
    title: 'Activation rate by platform and OS',
    question: 'Does the app convert sign-ups as well as web?',
    what: '7-day activation rate per platform segment (web desktop / mobile, iOS 18 / 17, Android 14–15 / ≤ 13) against the 40 % target.',
    formula: 'Σ activated_7d ÷ Σ sign-ups per segment (fact_signup_segment_day); the dashed line is ACTIVATION_7D.',
    note: 'A-47. The dataset carries segments, not single OS versions.',
  },
  {
    code: 'K1',
    title: 'Payback by acquisition month',
    question: 'Will it pay back, and when?',
    what: "Cumulative payback of each acquisition month's CAC by month since acquisition, for the 12 acquisition months before the window's end month: one hue, darker = closer to payback, green = paid back.",
    formula:
      'Σ (revenue − refunds) to month m × gross margin ÷ (cohort-month spend + allocated team cost); paid back at the first month ≥ 100 %. Months 0 to 11 since acquisition.',
    note: 'A-48, A-56. DDA cohorts; scope filters apply, the window start does not. Scoped to Meta Lookalike 2 % the Nov 2025 – Jan 2026 cohorts turn green at month 9.',
  },
  {
    code: 'K2',
    title: 'LTV:CAC by channel',
    question: 'Where does a dollar earn the most?',
    what: 'LTV:CAC of each channel in the window, in the channel colour, against the 3:1 floor.',
    formula: 'LTV = ARPA × gross margin ÷ monthly churn (trailing 3 complete months); ÷ blended CAC of the channel.',
    note: 'A-41, A-56.',
  },
  {
    code: 'K6',
    title: 'Payback months by channel',
    question: 'Which channel repays CAC within a year?',
    what: "Months of gross margin a channel's new customer needs to repay its blended CAC, against the 12-month line.",
    formula:
      'Blended CAC ÷ (ARPA × gross margin 36.3 %), on the window (the window formula of A-40, not the cohort curve of the heatmap).',
    note: 'A-40, A-56. Dashed line = PAYBACK_MONTHS (param_target).',
  },
  {
    code: 'K7',
    title: 'Cohort size by acquisition month',
    question: 'How many paid customers each month brought',
    what: "Paid customers of each of the 12 acquisition months to the window's end month.",
    formula: 'Offset-0 customers_start (fact_cohort_revenue_month, DDA credits).',
    note: "A-48. The denominators of the heatmap and the retention grid; the window's end month is partial.",
  },
  {
    code: 'K3',
    title: 'Retention grid, paid cohorts',
    question: 'Do paid users stay?',
    what: "Share of each acquisition month's users active on day N, for the latest six cohort months; one hue, darker = higher.",
    formula:
      'users_active ÷ users_matured (fact_retention_cohort_month); a cell exists only once the 15th of the month + N has passed.',
    note: 'A-48, A-74. Blank = not reportable yet.',
  },
] as const;
export type CardCode = (typeof CARDS)[number]['code'];

/** Vitals tile labels as the PBI tiles draw them (the dim_card titles in capitals). */
export const VITAL_LABELS = {
  V1: 'SPEND',
  V2: 'NEW CLIENTS',
  V3: 'CONVERSION INTO PAID',
  V4: 'TIME TO ACTIVATION',
  V5: 'CAC',
  V6: 'ROAS 90 D',
} as const;

/** Title of a vital's dynamics pop-up: "<metric> | dynamics" (dyn_l1 … dyn_l6). */
export const dynamicsTitle = (title: string): string => `${title} | dynamics`;

/** ⓘ note with the window and the attribution model in use (measure 'Card Info Note', A-16). */
export const infoNote = (note: string, window: string, model: string): string =>
  `${note}   Window ${window} | model ${model}.`;

// ---------- labels from the PBIP measures and calculated tables (§4 items 3 and 4; verbatim) ----------

/** Flag words (measure 'Flags Text'); CPA_OVER reads "CPA n% over" (cpaOverWord). Joined by FLAG_JOIN. */
export const FLAG_WORDS = {
  FATIGUE: 'Fatigue',
  FREQUENCY: 'Frequency',
  INSTALL_QUALITY: 'Install quality',
  VIEW_THROUGH: 'View-through heavy',
  CPA_OVER: 'CPA over',
  OVER_PACING: 'Over-pacing',
  UNDERSPENT: 'Underspent',
  PIPELINE_LED: 'Pipeline-led',
  LEAD_GOAL: 'Lead goal',
  NO_CPA_GOAL: 'No CPA goal',
  LEARNING: 'Learning',
  ON_TARGET: 'On target',
} as const;
export const FLAG_JOIN = ' | ';
export const cpaOverWord = (pct: string): string => `CPA ${pct} over`;

/** Period pill (measure 'Period Pill Text'): "<start> – <end>[ <year>]  |  <basis>". */
export const PILL = {
  sep: '  |  ',
  prev: (days: number) => `vs prior ${days} d`,
  ly: 'vs same period LY',
  plan: 'vs plan',
  none: 'no comparison',
} as const;
/** Header freshness (measure 'Synced Text'). */
export const syncedText = (hours: number): string => `Synced ${hours < 1 ? 'under 1 h' : `${Math.floor(hours)} h`} ago`;

/** Chips (measure 'Chips Line'): one segment per active non-default facet; "+" joins picks. */
export const CHIPS = {
  platform: 'Platform: ',
  market: 'Market: ',
  tier: 'Tier: ',
  channel: 'Channel: ',
  network: 'Network: ',
  campaign: 'Campaign: ',
  picked: (n: number) => `${n} picked`,
  status: 'Status: ',
  attribution: 'Attribution: ',
  selected: 'Selected: ',
  join: ' + ',
  crossJoin: ' | ',
  /** between segments (house rule of this report: " | ", contract §4 as amended 2026-11-05) */
  segmentJoin: ' | ',
} as const;

/** dim_campaign names derived on load (Power Query, dim_campaign.tmdl). */
export const MARKET_NAMES = { GLOBAL: 'Global', NA: 'North America', EMEA: 'EMEA' } as const;
export const TIER_NAMES = { SELF_SERVE: 'Self-serve', SALES_ASSISTED: 'Sales-assisted' } as const;
export const STATUS_NAMES = { LIVE: 'Live', LEARNING: 'Learning', PAUSED: 'Paused', ENDED: 'Ended' } as const;

/** Filters window (grp_filters): rail entries, labels and buttons; tiles from the picker tables. */
export const FILTERS = {
  title: 'Filters',
  rail: {
    period: 'Period',
    scope: 'Scope',
    channels: 'Channels',
    campaigns: 'Campaigns',
    audience: 'Audience',
    attribution: 'Attribution',
  },
  comparison: 'SAME PERIOD LY',
  resetAll: 'Reset all',
  resetGroup: 'Reset group',
  apply: 'Apply',
  close: 'Close',
  presets: { '7d': '7 d', '30d': '30 d', mtd: 'MTD', qtd: 'QTD', custom: 'Custom' },
  comparators: { prev: 'Previous period', ly: 'Same period last year', plan: 'Plan', none: 'None' },
  grains: { day: 'Day', week: 'Week', month: 'Month' },
} as const;

/** Worst 5 | Top 5 switches (param_o5_rank / param_o6_rank). */
export const RANK_MODES = { worst: 'Worst 5', top: 'Top 5' } as const;

/** O1 stages (dim_funnel_stage), C2 stages (dim_c2_stage), J3 bins (dim_act_bin). */
export const FUNNEL_STAGES = [
  'Impressions',
  'Clicks',
  'Visits + installs',
  'Sign-ups',
  'Activated',
  'Trials',
  'Paid',
] as const;
export const C2_STAGES = ['Click', 'Visit / store', 'Install', 'Sign-up', 'Activated', 'Trial', 'Paid'] as const;
export const ACT_BINS = ['< 1 h', '1–6 h', '6–24 h', '1–2 d', '2–4 d', '4–7 d', '7–30 d'] as const;

/** O2 rows (measure 'O2 Guardrails SVG'): label and the target text prefix. */
export const GUARDRAILS = [
  { label: 'Trial → paid', target: 'target ' },
  { label: 'D7 retention, paid', target: '≥ ' },
  { label: 'D30 retention, paid', target: '≥ ' },
  { label: 'Refund rate', target: '< ' },
  { label: 'Brand share of search spend', target: 'target ' },
  { label: 'Attribution gap, reported vs modelled', target: 'target ' },
] as const;

/** Table headers and series names of the PBIP visuals (displayName / queryRef of each visual, verbatim). */
export const HEADERS = {
  o5: ['#', 'CAMPAIGN', 'CHANNEL', 'PAID', 'BEFORE', 'Δ PAID', 'ALERT'],
  o7: ['SPEND', 'PAID CUSTOMERS'],
  o3: ['Spend', 'Plan', 'Paid CAC'],
  c1: ['CHANNEL', 'SPEND', 'SHARE', 'PAID CUST.', 'CAC', 'ROAS 90 D', 'CLICK → SIGN-UP', 'PACING', 'STATUS'],
  c2: ['Web', 'App (iOS + Android)'],
  p1: ['CAMPAIGN', 'CHANNEL', 'PLATFORM', 'SPEND', 'PACING', 'CPA', 'ROAS 90 D', 'CTR 7 D Δ', 'FREQ.', 'FLAGS'],
  p5: ['TERM', 'CPC', 'CVR', 'CONV.'],
  j1: ['PAGE', 'SESSIONS / VIEWS', 'CVR', 'BOUNCE', 'LCP'],
  k1: ['COHORT', 'MONTH'],
  k3: ['COHORT', 'DAY'],
} as const;

/** P5 table caption (measure 'P5 Caption'; not drawn on the face, the table's accessible name here). */
export const P5_CAPTION = { keywords: 'Keywords of ', placements: 'Placements and audiences of ' } as const;

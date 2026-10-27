# Mirelo Sales & revenue - ⓘ pop-ups and How to read (Track C source)

Generated from `js-report/lib/sales/copy.ts` (INFO, howToRead) and the card builders in `js-report/lib/sales/`
by `npm run export:info-copy`. The TypeScript is the source: change the copy there and re-run the script; do not
edit this file by hand. Track B (Power BI) takes the text as is (ADR-0011, ADR-0012 §2.3). Pop-up shape: what it
is - why it matters - formula in words - sub-values - source. Example values: Sep 2026, Month, All markets, vs
Budget. 59 cards, 5 How to read.

## Overview

### How to read - Overview

- **Showing**: Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026
- **Top band**: The four Tier-1 numbers with their gap to Budget and to the prior year.
- **Grid**: Why each number moved: trend vs Budget, channels, cohorts, risk by market.
- **Table**: Per market; click filters the page, double-click lists the loans.
- **Legend**: ▲ up / ▼ down - green = favourable, amber = watch, red = off. ⓘ on each card opens its definition.

### o1 - Loans issued

**What it is** Loans disbursed in the window and their principal.

**Why it matters** Volume is the first Tier-1 number: did we lend what we planned?

**Formula** Count of loans with a disbursed date in the window; principal = Σ local principal ÷ actual rate of the month × currency.

**Values (example at the default selection)**
- Budget loans: 24.3k
- Budget principal: €9.8m (actual −2.3%)
- Avg ticket: €393 (Budget €404)
- Prior year: 21.2k - €8.0m
- 2026 YTD: 209.9k - €82.1m

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) LOANS - param_fx (ACTUAL_AVG / BUDGET)

### o2 - New clients locked in

**What it is** Clients whose first loan was disbursed in the window.

**Why it matters** New clients feed next year’s repeat book; stalling acquisition shows here first.

**Formula** Σ first loans in the window (not first approval, not first account).

**Values (example at the default selection)**
- Share of loans: 40.1%
- App: 3,620 (37%)
- Partner: 2,846 (29%)
- Paid: 2,509 (26%)
- Agent: 821 (8%)
- Budget: 9,905
- Prior year: 9,281

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) NEW_CLIENTS

### o3 - Returning clients

**What it is** Share of borrowers in the window who had borrowed before.

**Why it matters** Returning clients are cheaper to serve and lower risk.

**Formula** Distinct borrowers with an earlier loan ÷ distinct borrowers (client-weighted). No Budget exists for this ratio.

**Values (example at the default selection)**
- Returning borrowers: 14,614 of 24,410
- Loan-weighted: 59.9%
- 180-day repeat (cohort Mar 2026): 43.5%
- 90-day repeat: 27.6%
- Prior year: 56.2%
- Budget: none for this ratio

**Source** fact_loan (pre-aggregated: loans-month) (window-stats)

### o4 - Bad / overdue loans

**What it is** Balance 30+ days past due at the last month of the window.

**Why it matters** The health check on the growth; down is favourable.

**Formula** (30–59 + 60–89 + 90+ DPD balance) ÷ outstanding at month-end, each market at its own rate.

**Values (example at the default selection)**
- 30+ DPD balance: €1.5m of €32.5m
- 90+ DPD by balance: 2.6%
- 30+ by count: 4.6%
- Vintage 6m bad rate (Mar 2026): 2.9%
- Budget 30+ appetite: 4.2%
- Prior year: 5.6%

**Source** fact_loan_month (portfolio-month) - fact_target (BUD) DPD30_RATIO

### o5 - Loans issued by month vs Budget

**What it is** Loans per month for the 13 months to the selected month.

**Why it matters** Shows whether a gap to Budget is one month or a trend.

**Formula** Monthly count of disbursed loans: Actual, Budget and the same month a year earlier. Click a month to select it.

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) LOANS

### o6 - New clients by acquisition channel

**What it is** New clients in the window by acquisition channel.

**Why it matters** Shows which channel carries acquisition and how it moved against last year.

**Formula** Σ first loans by channel; the outline is the same window a year earlier.

**Source** fact_loan (pre-aggregated: loans-month) - dim_channel

### o7 - Returning clients - cohort repeat curve

**What it is** Share of a first-loan cohort with a second loan within N days.

**Why it matters** Early repeat is the leading signal for returning clients.

**Formula** Clients with a second loan ≤ N days after the first ÷ cohort clients; a month counts at day N once all its clients are N days old.

**Source** fact_loan (pre-aggregated: loans-month) (cohort-curve) - dim_client

### o8 - 30+ DPD by market, 13 months

**What it is** 30+ DPD by balance per market, month-end, 13 months.

**Why it matters** Separates a market problem from a portfolio-wide one.

**Formula** Per market: 30+ DPD balance ÷ outstanding at each month-end.

**Source** fact_loan_month (portfolio-month)

### o9 - Markets - Sep 2026

**What it is** Loans, principal, new clients, returning % and 30+ DPD per market.

**Why it matters** The first drill: which market drives the gap.

**Formula** Card definitions per market; Δ follows the header comparator. Click filters the page; double-click or Show loans lists the loans.

**Source** fact_loan (pre-aggregated: loans-month) - fact_loan_month (portfolio-month) - fact_target (BUD)

## Loans issued

### How to read - Loans issued

- **Showing**: Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026
- **Top band**: Volume, money, ticket, funnel rates and speed.
- **Grid**: Trend, funnel, Budget → Actual bridge, product mix, cycle time.
- **Table**: Agents and partners by quota attainment; click for their loans.
- **Legend**: ▲ up / ▼ down - green = favourable, amber = watch, red = off. ⓘ on each card opens its definition.

### l1 - Loans

**What it is** Loans disbursed in the window.

**Why it matters** The volume half of originations.

**Formula** Count of loans with a disbursed date in the window.

**Values (example at the default selection)**
- Budget: 24.3k
- Prior year: 21.2k

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) LOANS

### l2 - Principal

**What it is** Disbursed principal in EUR.

**Why it matters** The money half of originations; FX can move it with no change in lending.

**Formula** Σ local principal ÷ actual rate of the month × currency. Constant currency re-translates actuals at the Budget rate.

**Values (example at the default selection)**
- Budget: €9.8m
- At Budget FX: €10.0m
- Δ vs Budget at Budget FX: +2.0%
- Prior year: €8.0m

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) PRINCIPAL_LOCAL - param_fx (ACTUAL_AVG / BUDGET)

### l3 - Avg ticket

**What it is** Average principal per loan.

**Why it matters** Context for volume: bigger tickets can hide fewer loans.

**Formula** Principal ÷ loans. No favourable side.

**Values (example at the default selection)**
- Step 12 share of loans: 9.0%
- Budget ticket: €404
- Prior year: €379

**Source** fact_loan (pre-aggregated: loans-month)

### l4 - Approval rate

**What it is** Approved share of submitted applications.

**Why it matters** Credit policy and applicant quality both show here.

**Formula** Approved ÷ submitted, cohorted by submission day. No Budget exists for this ratio.

**Values (example at the default selection)**
- New clients: 36.9%
- Submitted: 51.0k
- Approved: 27.4k

**Source** fact_application (funnel-month)

### l5 - Take-up rate

**What it is** Disbursed share of approved applications.

**Why it matters** Approved offers not taken up are lost revenue.

**Formula** Disbursed ÷ approved.

**Values (example at the default selection)**
- Approved: 27.4k
- Disbursed: 24.4k

**Source** fact_application (funnel-month)

### l6 - Time to cash

**What it is** Median hours from submission to cash.

**Why it matters** Speed wins repeat clients; down is favourable.

**Formula** Median (MEDIANX) of hours to cash over the window’s loans.

**Values (example at the default selection)**
- Prior year: 4.9 h

**Source** fact_loan (pre-aggregated: loans-month) (window-stats)

### l7 - Loans by month vs Budget

**What it is** Loans per month: Actual columns, Budget line, Prior year outline.

**Why it matters** Month-by-month view of the volume gap.

**Formula** Monthly count of disbursed loans; Budget LOANS.

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD)

### l8 - Application funnel

**What it is** Applications by funnel stage in the window.

**Why it matters** Shows at which step applicants are lost.

**Formula** Each stage counts applications that reached it; % = stage ÷ previous stage; Δ in pp vs the same window a year earlier.

**Source** fact_application (funnel-month)

### l9 - Originations bridge Budget → Actual

**What it is** Principal bridge from Budget to Actual.

**Why it matters** Splits the gap into lending (volume, mix, ticket) and FX.

**Formula** Volume = Δ loans × Budget ticket; mix = product × market share shift at Budget tickets; ticket = actual loans × ticket change; FX = actual at actual rates − actual at Budget rates.

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) - param_fx (ACTUAL_AVG / BUDGET)

### l10 - Loans by product × market

**What it is** Loans in the window per market, split by product.

**Why it matters** Product mix drives ticket size and risk.

**Formula** Count of loans by market × product.

**Source** fact_loan (pre-aggregated: loans-month) - dim_product

### l11 - Attainment by channel

**What it is** Loans against a channel target.

**Why it matters** Would show which channel misses its plan.

**Formula** Not available: the dataset has no channel targets (fact_target holds market × product and agent rows only).

**Source** fact_target (BUD)

### l12 - Stage cycle time vs SLA

**What it is** Median hours of the two timed legs against the stage SLA.

**Why it matters** Shows which leg slows cash out.

**Formula** Submitted → approved and approved → cash medians; SLA = KYC + credit stage SLA hours.

**Source** fact_loan (pre-aggregated: loans-month) (window-stats) - dim_funnel_stage

### l13 - Agent & partner leaderboard - Sep 2026

**What it is** Agents and partners against their loan quota.

**Why it matters** Assisted channels depend on a few people; laggards show early.

**Formula** Agent loans ÷ AGENT_LOANS quota in the window, sorted by attainment. Click a row for that agent’s loans.

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) AGENT_LOANS - dim_agent

## Clients

### How to read - Clients

- **Showing**: Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026
- **Top band**: Acquisition, return and the speed of return.
- **Grid**: Channels, new-client funnel, cohort curves, loyalty by segment.
- **Table**: Clients of the window’s cohort; click for the client card.
- **Legend**: ▲ up / ▼ down - green = favourable, amber = watch, red = off. ⓘ on each card opens its definition.

### c1 - New clients

**What it is** Clients whose first loan was disbursed in the window.

**Why it matters** Acquisition volume against plan.

**Formula** Σ first loans in the window.

**Values (example at the default selection)**
- Share of loans: 40.1%
- Budget: 9,905
- Prior year: 9,281

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD) NEW_CLIENTS

### c2 - Returning clients %

**What it is** Borrowers with an earlier loan, share of all borrowers.

**Why it matters** Loyalty at client level.

**Formula** Distinct returning borrowers ÷ distinct borrowers. No Budget exists for this ratio.

**Values (example at the default selection)**
- Borrowers: 24.4k
- Returning borrowers: 14.6k

**Source** fact_loan (pre-aggregated: loans-month) (window-stats)

### c3 - Repeat share (loans)

**What it is** Repeat loans, share of all loans.

**Why it matters** Loyalty at loan level.

**Formula** Repeat loans ÷ loans.

**Values (example at the default selection)**
- Repeat loans: 14.6k
- Loans: 24.4k

**Source** fact_loan (pre-aggregated: loans-month)

### c4 - New-client approval rate

**What it is** Approval rate of first-time applicants.

**Why it matters** The gate for new clients; credit policy changes show here first.

**Formula** Approved ÷ submitted for new applicants.

**Values (example at the default selection)**
- First-time submitted: 31.7k
- First-time approved: 11.7k

**Source** fact_application (funnel-month)

### c5 - 180-day repeat

**What it is** Share of a cohort with a second loan within 180 days.

**Why it matters** The leading indicator of the returning share.

**Formula** Cohort = first loans 6 months before the selected month; second loan ≤ 180 days after the first ÷ cohort clients. Compared with the same cohort month a year earlier.

**Values (example at the default selection)**
- Cohort: Mar 2026
- 90-day repeat: 27.6%
- Mar 2025 cohort (PY): 44.3%

**Source** fact_loan (pre-aggregated: loans-month) (cohort-curve)

### c6 - Days between loans

**What it is** Median days between a repeat loan and the client’s previous loan.

**Why it matters** How quickly clients come back. No favourable side.

**Formula** Median gap in days over the window’s repeat loans.

**Values (example at the default selection)**
- Prior year: 110 d

**Source** fact_loan (pre-aggregated: loans-month) (window-stats)

### c7 - New clients by channel, 13 months

**What it is** New clients per month by channel, Budget total as a line.

**Why it matters** Shows which channel moved acquisition.

**Formula** Σ first loans by month × channel; Budget NEW_CLIENTS.

**Source** fact_loan (pre-aggregated: loans-month) - fact_target (BUD)

### c8 - New-client funnel

**What it is** First-time applicants by stage in the window.

**Why it matters** Where new clients are lost.

**Formula** Leads → submitted → approved → disbursed for new applicants; % of the previous stage.

**Source** fact_application (funnel-month)

### c9 - Cohort repeat curves (quarter cohorts)

**What it is** Second-loan share by days since first loan, last four quarter cohorts.

**Why it matters** Compares how fast recent cohorts come back.

**Formula** Clients with a second loan ≤ N days ÷ cohort clients, right-censored at the last close.

**Source** fact_loan (pre-aggregated: loans-month) (cohort-curve)

### c10 - Returning % by market × segment - repeat share by product

**What it is** Returning % per market × client segment; repeat share per product.

**Why it matters** Shows where loyalty is strong or weak.

**Formula** Matrix: client-weighted returning %; bars: repeat loans ÷ loans per product, tick = company average.

**Source** fact_loan (pre-aggregated: loans-month) (window-stats) - dim_client

### c11 - Clients - Sep 2026 cohort - All markets

**What it is** Clients whose first loan falls in the window.

**Why it matters** Puts names on the cohort behind the numbers.

**Formula** Top clients by principal since 2024 (draft sample); loan states are the last-close snapshot. Click a row for the client card.

**Values (example at the default selection)**
- Rows: top 20 by principal to date (draft sample)
- Loan states: snapshot at Sep 2026

**Source** fact_loan (pre-aggregated: loans-month) - dim_client

## Portfolio quality

### How to read - Portfolio quality

- **Showing**: Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026
- **Top band**: Arrears by balance and count, vintage quality, roll rate, cost of risk; down is favourable.
- **Grid**: Buckets, vintages, risk by product × market, roll rates, size × risk.
- **Table**: Worst overdue loans at the last close; click for the client card.
- **Legend**: ▲ up / ▼ down - green = favourable, amber = watch, red = off. ⓘ on each card opens its definition.

### p1 - 30+ DPD %

**What it is** Balance 30+ days past due at the last month of the window.

**Why it matters** The headline risk ratio against the planned risk appetite.

**Formula** 30+ DPD balance ÷ outstanding at month-end.

**Values (example at the default selection)**
- Month-end: Sep 2026
- 30+ DPD balance: €1.5m
- Outstanding: €32.5m
- Planned (Budget): 4.2%

**Source** fact_loan_month (portfolio-month) - fact_target (BUD) DPD30_RATIO

### p2 - 90+ DPD %

**What it is** Balance 90+ days past due.

**Why it matters** The part most likely to be written off.

**Formula** 90+ DPD balance ÷ outstanding.

**Values (example at the default selection)**
- 90+ DPD balance: €853k

**Source** fact_loan_month (portfolio-month)

### p3 - 30+ by count

**What it is** Loans 30+ days past due, share of active loans.

**Why it matters** A count view of the same risk.

**Formula** Loans 30+ DPD ÷ active loans.

**Values (example at the default selection)**
- Loans 30+ DPD: 4,782
- Active loans: 104.9k

**Source** fact_loan_month (portfolio-month)

### p4 - Vintage 6m bad rate

**What it is** Loans that reached 90+ DPD within 6 months on book.

**Why it matters** Judges underwriting quality early, before write-off.

**Formula** First-90+ loans with months on book ≤ 6 ÷ loans disbursed; vintage = 6 months before the selected month.

**Values (example at the default selection)**
- Vintage: Mar 2026
- Same vintage a year earlier: 3.4%

**Source** fact_loan_month (portfolio-month)

### p5 - Roll rate 30→60

**What it is** Overdue balance rolling one bucket per month.

**Why it matters** High roll rates mean collections are not catching up.

**Formula** 60–89 balance this month ÷ 30–59 balance last month (balances also amortise).

**Values (example at the default selection)**
- 1–29 → 30+: 65.5%

**Source** fact_loan_month (portfolio-month)

### p6 - Cost of risk

**What it is** Provision charge as an annual rate of the average book.

**Why it matters** What the risk costs in money.

**Formula** Σ provision ÷ months × 12 ÷ average month-end outstanding.

**Values (example at the default selection)**
- Basis: annualised over the window

**Source** fact_loan_month (portfolio-month)

### p7 - DPD buckets, 13 months

**What it is** Overdue balance per bucket at month-end, 13 months.

**Why it matters** Shows whether arrears build up or clear.

**Formula** Month-end balance in 1–29, 30–59, 60–89 and 90+ DPD, in EUR.

**Source** fact_loan_month (portfolio-month)

### p8 - Vintage curves

**What it is** Cumulative share of loans that reached 30+ DPD by months on book.

**Why it matters** Compares recent vintages at the same age.

**Formula** First-30+ loans up to month N ÷ loans disbursed, per vintage quarter.

**Source** fact_loan_month (portfolio-month)

### p9 - Bad rate by product × market

**What it is** 30+ DPD by balance per product × market.

**Why it matters** Locates the risk.

**Formula** 30+ DPD balance ÷ outstanding at the last month of the window.

**Source** fact_loan_month (portfolio-month)

### p10 - 30+ DPD by market

**What it is** 30+ DPD by balance per market, 13 months.

**Why it matters** Tracks a market’s risk story over the year.

**Formula** Per market: 30+ DPD balance ÷ outstanding at each month-end.

**Source** fact_loan_month (portfolio-month)

### p11 - Roll rates by month

**What it is** Balance rolling one bucket per month.

**Why it matters** Early warning for rising arrears.

**Formula** 30→60: 60–89 now ÷ 30–59 last month; 1–29→30+: 30–59 now ÷ 1–29 last month.

**Source** fact_loan_month (portfolio-month)

### p12 - Segments: size × DPD

**What it is** One bubble per product × market.

**Why it matters** Shows whether the risky segments are also the big ones.

**Formula** x = average ticket, y = 30+ DPD by balance, size = outstanding; worst bubble in yellow.

**Source** fact_loan_month (portfolio-month) - fact_loan (pre-aggregated: loans-month)

### p13 - Overdue loans - Sep 2026 - All markets

**What it is** Loans 30+ days past due at the last close, worst first.

**Why it matters** The collection list behind the ratios.

**Formula** Loan-level snapshot at the last closed month (draft sample: top 100 per market by DPD). Click a row for the client card.

**Values (example at the default selection)**
- Rows: worst 100 by DPD (draft sample)
- Loan states: Sep 2026 snapshot for every selected month

**Source** fact_loan (detail sample)

## Revenue & targets

### How to read - Revenue & targets

- **Showing**: Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026
- **Top band**: Revenue, attainment, the two lending streams and subscriptions.
- **Grid**: Trend vs Budget, streams, attainment by market, tiers, churn, channel mix.
- **Table**: Stream × market against Budget and the prior year; click for the market’s loans.
- **Legend**: ▲ up / ▼ down - green = favourable, amber = watch, red = off. ⓘ on each card opens its definition.

### r1 - Revenue

**What it is** Revenue from interest, fees, interchange and subscriptions.

**Why it matters** What the loans and accounts earned.

**Formula** Σ local revenue ÷ actual rate of the month × currency.

**Values (example at the default selection)**
- Interest: €787k - 59%
- Fees: €286k - 21%
- Interchange: €122k
- Subscriptions: €146k
- Budget: €1.4m

**Source** fact_revenue_month - fact_target (BUD) REVENUE_LOCAL - param_fx (ACTUAL_AVG / BUDGET)

### r2 - Attainment

**What it is** Revenue against Budget.

**Why it matters** Are we on the number?

**Formula** Revenue ÷ Budget revenue; ≥ 100 % good, 95–99.9 % watch, below off (param_thresholds).

**Values (example at the default selection)**
- Revenue: €1.3m
- Budget: €1.4m

**Source** fact_revenue_month - fact_target (BUD) REVENUE_LOCAL - param_thresholds

### r3 - Interest + fees

**What it is** Interest income plus origination and late fees: the revenue the loans earn.

**Why it matters** The lending streams together; the Budget carries them together per loan product.

**Formula** Σ INTEREST + FEE revenue; Budget = REVENUE_LOCAL of the loan products at the BUDGET rate.

**Values (example at the default selection)**
- Interest: €787k
- Fees: €286k
- Budget: €1.1m
- Prior year: €848k

**Source** fact_revenue_month - fact_target (BUD) REVENUE_LOCAL (loan products)

### r4 - Interchange

**What it is** Interchange earned on the debit card.

**Why it matters** The card stream grows with account activity, outside lending.

**Formula** Σ INTERCHANGE revenue; Budget = REVENUE_LOCAL of CARD at the BUDGET rate.

**Values (example at the default selection)**
- Budget: €117k
- Prior year: €75k

**Source** fact_revenue_month - fact_target (BUD) REVENUE_LOCAL (CARD)

### r5 - MRR

**What it is** Monthly recurring revenue of paying tiers at month-end.

**Why it matters** The recurring part of revenue.

**Formula** Plus and Pro subscribers at month-end × monthly price, in EUR.

**Values (example at the default selection)**
- Plus: €74k
- Pro: €73k

**Source** fact_subscription_month

### r6 - Paying subscribers

**What it is** Paying subscribers at month-end.

**Why it matters** The base that MRR rests on.

**Formula** Plus + Pro subscribers at the last month of the window.

**Values (example at the default selection)**
- Plus: 15.4k
- Pro: 8,032

**Source** fact_subscription_month

### r7 - Revenue by month vs Budget vs PY

**What it is** Revenue per month: Actual, Budget, Prior year.

**Why it matters** Month-by-month view of the revenue gap.

**Formula** Monthly revenue in EUR; Budget REVENUE_LOCAL at Budget rates.

**Source** fact_revenue_month - fact_target (BUD)

### r8 - Revenue by stream, 13 months

**What it is** Revenue per month by stream.

**Why it matters** Shows which stream moves the total.

**Formula** Monthly revenue in EUR by revenue type.

**Source** fact_revenue_month

### r9 - Attainment by market

**What it is** Revenue against Budget per market.

**Why it matters** Locates the miss.

**Formula** Revenue ÷ Budget revenue in the window; tick = Budget.

**Source** fact_revenue_month - fact_target (BUD)

### r10 - MRR and subscribers by tier

**What it is** Paying subscribers per month by tier; MRR above the columns.

**Why it matters** Tier mix and MRR side by side, no dual axis.

**Formula** Month-end subscribers by tier; label = MRR in EUR.

**Source** fact_subscription_month

### r11 - Subscriber churn %

**What it is** Share of paying subscribers lost in the month.

**Why it matters** Churn spikes after price changes.

**Formula** Churned ÷ subscribers at the start of the month (Plus + Pro).

**Source** fact_subscription_month

### r12 - Channel mix, share of loans

**What it is** Share of loans per month by channel.

**Why it matters** Channel mix moves acquisition cost and risk.

**Formula** Loans by channel ÷ loans, per month.

**Source** fact_loan (pre-aggregated: loans-month)

### r13 - Stream × market - Sep 2026

**What it is** Revenue per stream × market.

**Why it matters** The detail behind the revenue cards.

**Formula** Budget exists for interchange (card), subscriptions (Plus + Pro) and the total; interest and fees share the loan-product Budget, so their rows show n/a. Click a row for that market’s loans.

**Source** fact_revenue_month - fact_target (BUD)

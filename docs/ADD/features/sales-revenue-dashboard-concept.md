# Sales & Revenue dashboard — concept (second showcase report, Tracks A + B + C)

**DRAFT — projection state (concept for USER approval; nothing built).**

> Date: 2026-10-24 · Author: design concept agent for the main agent · Input spec: `docs/specs/2026-10-23-sales-revenue-dashboard-spec.md` (generic CRM-style B2B sales spec, adapted here to a lending / neobank business) · House style: `docs/design/design-requirements.md`, `docs/design/kpi-card-v2.md`, `docs/design/period-picker-v2.md`, `docs/design/parity-rules.md`, ADR-0004, ADR-0007 · Mockup: `docs/design/sales-revenue dashboard/mockup.html` (1440 × 810, Overview populated, other views blocked out).
>
> Nothing in this document changes the ACME Unified P&L. Spec IDs of the form **S-nn** below are proposals for a future `docs/specs/sales-revenue-requirements.md`; they are not yet a contract.

---

## 1. Business framing

### 1.1 The company

**Mirelo** is a fictional app-first neobank for consumers and micro-businesses in three EU markets: **Poland (PLN)**, **Romania (RON)** and **Portugal (EUR)**. Reporting currency is **EUR**, so two of three markets translate at monthly rates and FX is a built-in theme, as in the P&L. Mirelo launched in Poland in 2022, Romania in 2023 and Portugal in Jan 2024; the dataset covers **Jan 2024 – Dec 2026**, actuals closed through **Sep 2026** (same cut-off rule as the P&L, C-01 analogue).

Revenue engine, four streams:

| Stream | What it is | Share of FY2026 YTD revenue (story) |
|---|---|---|
| **Interest income** | Interest on microloans (bullet 30 / 90 days, instalment 6 / 12 months, micro-business 12 months) | ≈ 60 % |
| **Fees** | Origination fee on every loan, late-payment fees | ≈ 21 % |
| **Interchange** | Card spend on the Mirelo debit / virtual card | ≈ 8 % |
| **Subscriptions** | Account tiers Free / Plus (€4.99) / Pro (€9.99) per month | ≈ 11 % |

The sales organisation is a **growth team** (app, web, marketplace bidding), a **partnerships team** (embedded loans at e-commerce checkouts, 12 partners) and **branch-less field agents** (40 agents in Poland and Romania, micro-business segment). There are no account executives, no opportunity owners and no quarterly commits; the "pipeline" is a stream of loan applications that turns over in hours.

### 1.2 Mapping the generic spec onto lending

| Generic spec concept | Mirelo equivalent | Notes |
|---|---|---|
| Opportunity stages | **Application funnel:** Lead → Application started → Submitted → KYC passed → Credit approved → Disbursed (loan) / Account opened (account). Terminal outcomes: Declined, Abandoned, Not taken up | Stage dimension carries an approval probability and an SLA in hours |
| Bookings (closed-won) | **Originations** = disbursed principal (€) and loans disbursed (#), at disbursement date | Daily grain |
| Revenue (recognised) | Interest + fees + interchange + subscriptions, accrued monthly | Monthly grain; Actual / Budget / Latest estimate |
| Quota | **Targets** per market × product × channel per month (Budget) and per agent per month | Target = Budget for every measure except agents, which have their own sheet |
| Attainment / pace / gap | Revenue (or originations) ÷ target; pace = attainment of the target elapsed so far in the open month; gap = target − actual | Same formulas as the spec, applied to targets |
| Open / weighted pipeline | **Open applications** (stock at end of window) and **approved-not-yet-disbursed principal**; weighted = open applications × stage approval probability × average ticket | Semi-additive (last day of the window) |
| Coverage × | (approved-not-disbursed principal + weighted open applications) ÷ remaining target of the month | A microlender's coverage is a days-of-run-rate number, not 3× |
| Win rate | **Approval rate** (approved ÷ submitted) and **take-up rate** (disbursed ÷ approved) | Two steps, because the second one is a sales problem (pricing, UX) and the first a credit problem |
| Stage conversion | Same, per funnel stage, cohorted by submission date | |
| Sales cycle | **Time to cash** = median hours from submission to disbursement; per-stage cycle time | Hours, not days |
| Slipped / stale deals | **Abandoned applications** and applications over the stage SLA | |
| New / expansion / renewal | **New vs repeat borrowers** (segment) and **account tier upgrades** | |
| MRR / ARR, NRR / GRR | **MRR** of subscription tiers, subscriber churn %, repeat borrower share | NRR / GRR dropped (see 1.3) |
| Rep leaderboard | **Agent and partner leaderboard** (attainment, originations, approval rate, pace) | 52 rows |
| Forecast vs actual | Latest estimate (forecast 9+3) vs Budget vs Actual, same mechanism as the P&L | No weekly commit snapshots |
| Credit-risk metrics | **Two context KPIs only:** 30+ days-past-due ratio and cost of risk | Kept because they explain the Romania story; they never get a visual of their own |

### 1.3 Spec KPIs dropped, and why

| Dropped | Why |
|---|---|
| Pipeline by forecast category (Commit / Best case / Omitted), commit-to-close %, forecast bias over 8 quarters, forecast accuracy at −30 d | No rep-entered forecast categories and no snapshot history in a microloan funnel; the latest-estimate version carries the forecast theme instead |
| Slip rate, stale deals by days in stage, PushCount | Applications live hours, not quarters; replaced by abandon rate and SLA breaches in hours |
| Activity (calls, meetings, demos), rep ramp, SDR metrics | No reps; agent activity is already "applications submitted per agent" |
| ACV / TCV, average discount %, customer concentration (top-10, HHI) | Retail lending: no contracts, no list prices, no concentration |
| Bookings → billings → revenue → cash reconciliation, gross margin % | Finance-close topics; the P&L showcase owns margins |
| NRR / GRR | Needs a 12-month cohort of recurring revenue per customer; replaced by subscriber churn % and repeat borrower share, which the data can carry at aggregate grain |
| Data-quality page, hygiene score | Synthetic data has no hygiene problems; a page of green ticks says nothing |
| Pipeline velocity | Composite of four numbers the dashboard already shows |
| Weekly snapshot movement bridge (created / pulled in / pushed out) | Replaced by the **originations bridge** Budget → Actual: volume · ticket size · product mix · FX (same shape as the P&L net revenue bridge, T-05 analogue) |

---

## 2. KPI catalogue (30, 8 headline ★)

Direction: ↑ higher is favourable, ↓ lower is favourable, ◦ context (no favourable side, neutral grey rows on the card). Comparator: Budget = the target set, PY = same months a year earlier, LE = latest estimate. pp = percentage points (K-20 analogue). Grain "window" = the selected period (One month · Quarter to date · Year to date · Last 12 months · Full year).

| # | KPI | Definition | Grain | Dir. | Comparator | View |
|---|---|---|---|---|---|---|
| 1 ★ | **Originations** | Disbursed principal, translated per month × currency at monthly average rates (budget at budget rates; constant currency = budget rates of the selected year) | window, sum of days | ↑ | Budget, PY | Overview, Funnel |
| 2 ★ | **Revenue** | Interest + fees + interchange + subscriptions | window, sum of months | ↑ | Budget, PY | Overview, Revenue |
| 3 ★ | **Target attainment %** | Revenue ÷ Budget revenue, same months; sub-line **pace %** = attainment of the target elapsed so far in the open month (days elapsed ÷ days in month) | window | ↑ | vs 100 % (and LE full-year outlook) | Overview, Channels |
| 4 ★ | **Approval rate %** | Credit-approved ÷ applications submitted, cohorted by submission date | window | ↑ (capped by risk policy; card tooltip says so) | Budget, PY (pp) | Overview, Funnel |
| 5 ★ | **Time to cash (h)** | Median hours from submission to disbursement (`fact_cycle_time_monthly.p50_hours`, loan-count weighted across months) | window | ↓ | PY | Overview, Funnel |
| 6 ★ | **MRR** | Month-end paying subscribers × tier price, net of discounts | last month of window (period-end, K-23 analogue) | ↑ | Budget, PY | Overview, Revenue |
| 7 ★ | **Repeat borrower share %** | Loans to repeat customers ÷ loans disbursed | window | ↑ | PY (pp) | Overview, Revenue |
| 8 ★ | **Pipeline coverage ×** | (Approved-not-disbursed principal + open applications × stage approval probability × average ticket) ÷ (month target − month-to-date originations) | end of window, open month only | ↑ with cap (≥ 1.0× reads "covered") | vs 1.0× | Overview (card sub-line), Channels |
| 9 | Loans disbursed # | Count of disbursed loans | window | ↑ | Budget, PY | Funnel |
| 10 | Average ticket | Originations ÷ loans disbursed | window | ◦ | Budget, PY | Funnel |
| 11 | Leads # | Marketing-qualified contacts and app installs that reach the product page | window | ↑ | Budget, PY | Funnel |
| 12 | Applications submitted # | Completed applications | window | ↑ | Budget, PY | Funnel |
| 13 | KYC pass rate % | KYC passed ÷ submitted | window | ↑ | PY (pp) | Funnel |
| 14 | Take-up rate % | Disbursed ÷ approved | window | ↑ | PY (pp) | Funnel |
| 15 | Abandon rate % | Started but not submitted within 7 days ÷ started | window | ↓ | PY (pp) | Funnel |
| 16 | Stage conversion % | Entered stage k+1 ÷ entered stage k, per stage | window × stage | ↑ | PY (pp) | Funnel |
| 17 | Stage cycle time (h) | Median hours spent in each stage | window × stage | ↓ | SLA hours (`dim_stage.sla_hours`) | Funnel |
| 18 | Open applications # | Applications not yet in a terminal stage at the end of the window | end of window | ◦ | — | Funnel, Channels |
| 19 | Revenue by stream | KPI 2 split into interest / fees / interchange / subscriptions | window × stream | ↑ | Budget, PY | Revenue |
| 20 | Portfolio yield % | Interest income annualised ÷ average outstanding principal | window | ◦ | PY (pp) | Revenue |
| 21 | New accounts opened # | Account-opening funnel completions | window | ↑ | Budget, PY | Revenue |
| 22 | Active accounts # | Accounts with a transaction in the month, month-end | last month of window | ↑ | PY | Revenue |
| 23 | Paying subscribers # | Plus + Pro subscribers, month-end, by tier | last month of window | ↑ | Budget, PY | Revenue |
| 24 | Subscriber churn % | Subscribers churned in month ÷ subscribers at start of month | window (average of months) | ↓ | PY (pp) | Revenue |
| 25 | ARPU (€ / month) | Revenue ÷ average active accounts ÷ months in window | window | ↑ | PY | Revenue |
| 26 | New vs repeat originations | KPI 1 split by `dim_segment.is_repeat` | window | ◦ | PY | Revenue |
| 27 | Channel attainment % | Originations ÷ channel originations target | window × channel | ↑ | vs 100 % | Channels |
| 28 | Agent attainment % · agents at target % | Agent originations ÷ agent target; share of active agents at ≥ 100 % | window × agent | ↑ | vs 100 %, PY | Channels |
| 29 | 30+ DPD ratio % (context) | Balance 30+ days past due ÷ outstanding principal, month-end | last month of window | ↓ | PY (pp) | Revenue (operational tile) |
| 30 | Cost of risk % (context) | Provision charge annualised ÷ average outstanding principal | window | ↓ | Budget, PY (pp) | Revenue (operational tile) |

Rules carried from the house: ratio KPIs compare in pp; period-end KPIs (6, 8, 18, 22, 23, 29) take the last month / day of the window, never a sum; every card uses KPI card v2 (label, value, sub-line, two diverging comparison rows; context KPIs draw grey bars to the right); colour never carries meaning alone (▲ / ▼ + sign + colour).

---

## 3. Dimensions

| Dimension | Members | Notes |
|---|---|---|
| **Date** | 1,096 days, Jan 2024 – Dec 2026; `dim_month` (36) alongside, `is_closed` through Sep 2026 | Daily facts join `dim_date`; monthly facts join `dim_month`; `dim_date.month_key` → `dim_month` keeps one period picker for both |
| **Market** | Poland (PLN) · Romania (RON) · Portugal (EUR) · (All markets = no filter) | The "entity" analogue: own functional currency, own launch date, own targets. Switched from the rail brand mark (see §5.1) |
| **Product** | Microloans: Flex 30 (30-day bullet) · Flex 90 · Step 6 (6-month instalment) · **Step 12** (launched Apr 2026 PL, Jul 2026 RO, not in PT) · Biz Boost (micro-business, 12 months) — Accounts: Free · Plus · Pro — Card: Debit card | `product_line` = Microloan / Account / Card; tenor in days; `bridge_product_market` holds the launch month per market |
| **Channel** | App (organic + paid installs) · Web · Partner (embedded checkout, 12 partners) · Agents (branch-less field agents, 40) · Marketplace (comparison sites, lead aggregators) | `is_assisted` = Partner, Agents |
| **Segment** | Consumer new · Consumer repeat · Micro-business new · Micro-business repeat | `customer_type` × `is_repeat` |
| **Agent / partner** | 40 agents (PL 24, RO 16; teams North / South per market; 8 agents start Jan 2026 = ramp cohort) + 12 partners (e-commerce, telco top-up, gig-platform) | One table `dim_agent` with `agent_type`; non-assisted channels carry no agent |
| **Stage** | Lead · Started · Submitted · KYC passed · Approved · Disbursed / Opened · Declined · Abandoned · Not taken up | `sort_order`, `is_open`, `approval_probability` (0.0 … 1.0), `sla_hours` |
| **Version (scenario)** | Actual (Jan 2024 – Sep 2026) · Budget (36 months) · Forecast 9+3 (Oct – Dec 2026, latest) | Same `dim_version` shape as the P&L so the Versions flyout and C-02 latest-estimate splice are reused unchanged |
| **Revenue stream** | Interest · Fees · Interchange · Subscriptions | |
| **Targets** | Budget version of the facts (revenue, originations, loans, leads, new accounts, approval rate) at month × market × product × channel; agent targets at month × agent | No separate "quota" table except for agents |
| **Params** | reporting currency (EUR / PLN / RON) · FX basis (Actual rates / Constant currency) · units (m / k) · version choice · time view · breakdown (Market / Product / Channel / Segment / Agent) · variance format | `param_*` tables, same pattern as D-21 |

---

## 4. Synthetic dataset design — `data/mirelo_sales_dummy_data/`

Conventions carried from `data/acme_pl_dummy_data/`: deterministic seeded generator, CSV UTF-8 comma, `YYYY-MM` month keys, ISO dates, 2-dp signed amounts in local currency, `TRUE` / `FALSE` booleans, `fact_` / `dim_` / `bridge_` / `param_` names, a README with the rules for measures, `checks/` with control totals, `generator/` with the script. Note: the P&L generator is **Node.js** (`generator/gen_data.js`), not Python; the brief asks for Python. Recommendation in §8 Q3.

### 4.1 Star schema

Grain choice: **daily** for the sales process (funnel, originations — they are what a sales team watches day by day and what "pace" needs), **monthly** for revenue, portfolio, targets and FX (how a lender accounts). Facts total ≈ **0.87 M rows**, under the 1.5 M cap.

| Table | Grain (one row per …) | Key columns → measures | ≈ Rows |
|---|---|---|---|
| `fact_funnel_daily` | date × market × product × channel × segment (sparse: Agents = micro-business only, Marketplace = loans only, Step 12 after launch) | `date`, `market_code`, `product_code`, `channel_code`, `segment_code`, `currency_code` → `leads`, `apps_started`, `apps_submitted`, `kyc_passed`, `approved`, `declined`, `disbursed`, `abandoned`, `not_taken_up`, `open_apps_end`, `approved_undisbursed_end`, `approved_undisbursed_principal_local` | 260 k |
| `fact_origination_daily` | date × market × product × channel × segment × agent (agent only for Agents / Partner rows, else empty) | same keys + `agent_code` → `loans`, `principal_local`, `origination_fee_local` | 470 k |
| `fact_revenue_monthly` | month × version × market × product × channel × segment × revenue stream | `month_key`, `version_key`, keys, `revenue_stream_code`, `currency_code` → `amount_local` | 90 k |
| `fact_portfolio_monthly` | month-end × market × product × segment | keys → `loans_active_end`, `principal_outstanding_end_local`, `dpd30_balance_local`, `provision_charge_local`, `accounts_active_end`, `subscribers_end`, `subscribers_new`, `subscribers_churned`, `mrr_local` | 4 k |
| `fact_cycle_time_monthly` | month × market × product × stage | keys → `p50_hours`, `p90_hours`, `count` | 3 k |
| `fact_target_monthly` | month × version (BUD, FC2609) × market × product × channel × metric | keys, `metric_code` (ORIG_AMT, LOANS, LEADS, NEW_ACCOUNTS, APPROVAL_RATE) → `target_value` (local currency for amounts) | 20 k |
| `fact_target_agent_monthly` | month × agent | `month_key`, `agent_code` → `originations_target_local`, `loans_target` | 1.9 k |
| `fact_fx_rate` | currency × month × rate type | `currency_code`, `month_key`, `rate_type` (ACTUAL_AVG, BUDGET) → `local_per_eur` (6 dp) | 216 |
| `dim_date` (1,096) · `dim_month` (36) · `dim_market` (3) · `dim_product` (9) · `bridge_product_market` (27) · `dim_channel` (5) · `dim_segment` (4) · `dim_agent` (52) · `dim_stage` (9) · `dim_version` (3) · `dim_revenue_stream` (4) · `param_*` (7 tables) | | | |

Relationships: every fact → its dims one-way; `fact_funnel_daily.date` → `dim_date` → `dim_month` (the period picker filters `dim_month`, the daily facts follow through `dim_date.month_key`); `fact_origination_daily.agent_code` → `dim_agent` (nullable); `currency_code + month_key` → `fact_fx_rate` for translation at **month × currency grain, never on a total** (D-30 analogue). Revenue budget lives in `fact_revenue_monthly` (version BUD), so "Target attainment" needs no second table.

Medians are not additive: `fact_cycle_time_monthly` stores p50 / p90 per month × market × product × stage, and the window value is the loan-count-weighted median of the monthly medians (documented approximation, identical in all three tracks).

### 4.2 The story baked into the data

| Theme | What the generator does | Where it shows |
|---|---|---|
| **Seasonality** | Consumer loan demand peaks Nov – Dec (+22 %) and Aug – Sep (+10 %), trough Feb (−9 %); micro-business peaks Mar and Sep; subscriptions flat | Trend chart shape; the open-month pace reads differently in Dec |
| **Product launch** | **Step 12** launches Apr 2026 in Poland and Jul 2026 in Romania; it cannibalises ≈ 35 % of Step 6 volume but lifts average ticket (€620 vs €310) and interest income | Originations by product (stacked, launch marker), bridge "ticket size +2.6 m", product breakdown |
| **A market misses its target** | **Romania**: 30+ DPD climbs from 3.8 % to 6.1 % through H2 2025; credit policy tightens in Mar 2026 → approval rate −6 pp, originations −12 % vs Budget, revenue −11.7 % vs Budget, while DPD recovers to 4.9 % by Sep 2026 | Overview "Where the gap is" table (Romania orange), approval-rate small multiples, the two risk context tiles |
| **A market beats** | **Portugal**: youngest market, +11 % vs Budget on revenue, Partner channel takes off from Q4 2025 | Same table (green) |
| **Channel mix shift** | Marketplace bids cut from May 2026 (cost per lead up): Marketplace share of originations 24 % → 12 % YoY; App 31 % → 38 %; Partner 12 % → 19 %; Agents stable | Channel mix bars 2025 vs 2026, channel attainment bullets |
| **FX swing** | PLN strengthens 3 % through 2025, then weakens 6 % vs EUR Jun – Sep 2026; RON drifts −2 % a year. Poland misses Budget by −2.3 % in EUR but beats by +1.9 % in constant currency; bridge step "FX −3.2 m" | Gap table "const. ccy" column, FX basis toggle, bridge |
| **Subscription price rise** | Plus tier €3.99 → €4.99 in Jan 2026: churn spikes to 4.1 % in Feb – Mar, MRR +14 % YoY by Sep | MRR card, churn line, subscribers by tier |
| **Agents** | One star agent in PL North (142 % of target), one PL South agent falling behind after Jun 2026, the Jan 2026 cohort of 8 ramping 40 % → 95 % of target by Sep | Leaderboard, agents-at-target KPI |
| **Funnel friction** | KYC pass rate dips to 84 % in Romania Apr – May 2026 (new document checks) then recovers; time to cash falls from 5.1 h to 3.4 h YoY after an instant-payout rollout in Oct 2025 | Funnel stage bars, cycle-time bars, Time to cash card |

Headline numbers (FY2026 YTD Sep, Actual, EUR, all markets — the figures used in the mockup): Originations **€138.4 m** (Budget 142.8, −3.1 %; PY +18.6 %), 349 k loans, average ticket €397 · Revenue **€41.7 m** (Budget 42.46, −1.8 %; PY 34.07, +22.4 %) · Attainment **98.2 %**, pace 101 % in Sep, LE full year 58.5 vs Budget 59.6 (98.1 %) · Approval rate **41.3 %** (Budget 44.0, −2.7 pp; PY 44.2, −2.9 pp) · Time to cash **3.4 h** (PY 5.1) · MRR **€0.58 m** (+14.0 % YoY, +1.2 % vs Budget) · Repeat share **57.8 %** (+3.2 pp) · Coverage 1.3× on Sep · 30+ DPD 4.6 % (PY 3.9 %). Funnel YTD: leads 2.84 m → started 1.21 m → submitted 974 k → KYC passed 861 k → approved 402 k → disbursed 349 k. Markets: PL 21.4 / RO 9.8 / PT 10.5 (€m revenue) vs Budget 21.9 / 11.1 / 9.46. Bridge: Budget 142.8 → volume −4.9 → ticket +2.6 → mix +1.1 → FX −3.2 → Actual 138.4.

### 4.3 Reconciliation gate

`checks/control_totals_eur.csv` — one row per market (PL, RO, PT, ALL) × window × metric, ≈ 400 rows:

- Windows: Actual FY2024, FY2025, FY2026 YTD Sep · Budget FY2025, FY2026, FY2026 YTD Sep · LE FY2026 (Actual Jan – Sep + Forecast 9+3).
- Metrics: leads, submitted, approved, disbursed, originations_eur, revenue_eur_total and per stream, new_accounts, subscribers_end, mrr_end_eur, dpd30_ratio.
- Computed by the generator as Σ `amount_local / local_per_eur` per row (6-dp rates), rounded to cents at the end — the same rule ADR-0002 §1 relies on, so an engine translating at month × currency reproduces it to the cent.
- Plus `checks/parity_selections.csv` later (hunter), same role as the P&L one.

Track C footprint after pre-aggregation (`scripts/build-sales-data.ts`): funnel and originations daily **without the agent column** (agents roll up monthly in a small file), revenue monthly, portfolio, targets, dims in a manifest → ≈ 0.5 M rows of INT32 dictionary codes + DOUBLE cents ≈ **2 – 3 MB** Parquet; agent monthly ≈ 60 KB.

---

## 5. Views and layout

### 5.1 The one-window frame (identical in all three tracks)

The ADR-0004 / period-picker-v2 Part 2 page top is reused as is: 1440 × 810, never scrolls.

- **Rail** (64 px, Ink 900): brand mark **"M▾"** in the Mirelo identity colour → opens the **Market picker** (All markets · Poland · Romania · Portugal; single select; period, versions, currency and slices carry over — F-31 analogue). Then Period · Versions · Slice · Display, then expand ». The market is the entity analogue (own currency, own targets), so it takes the entity's control; one identity colour for all markets (markets are not brands).
- **Title row:** `Sales & revenue` + applied-filters funnel button; right-aligned status `Mirelo - All markets - Sales & revenue - Closed through Sep 2026 - Refreshed 24 Oct 2026 08:10`. " - " separators (parity rule 6).
- **Tabs:** **Overview · Funnel & originations · Revenue & customers · Channels & agents** (4, each with an 18 px icon; 3 px identity underline).
- **Flyouts** (352 px, same anatomy): **Period** = period picker v2 unchanged (daily facts follow the month window; pace uses days). **Versions** = Base (Actual / Latest estimate / Budget) + Compare A / Compare B (Budget · Prior year · None; default Budget + Prior year). **Slice** = Product chips (grouped by product line) · Channel · Segment · Agent / partner (searchable list, 52). **Display** = Currency (EUR / PLN / RON) · FX basis · Units (€m / €k; "#" KPIs unaffected) · Variance (Amount and % / Amount / %).
- **Applied-filters pop-up** rows: Market, Fiscal year, Period (summary sentence), Time view, Versions, Currency, FX basis, Units, Product, Channel, Segment, Agent, then notice rows (Cut-off, Forecast, Prior year, History, **Launch** — "Step 12 has no prior year before Apr 2026", **Policy** — "Romania credit policy changed Mar 2026: approval rates before and after are not like for like").
- Content area: Ground `#F2F4F7`, padding 14/24/16, gap 12; cards white, Line 200, radius 12.

Colour: neutral frame tokens unchanged; **identity `acc` = Mirelo mulberry `#9B2360`**, `accT` = `#F8E8F0`, `keyRule` = `#E5BBD0`; meaning colours fixed (favourable `#06603F` / `#3BA37B`, unfavourable `#C2410C` / `#E2804A`). Why mulberry: it sits at hue ≈ 340°, far from Products blue (220°), Cloud violet (260°), Group graphite and from both meaning hues (155°, 25°); it passes the dataviz validator next to the two meaning colours (lightness band, chroma floor, normal-vision ΔE 22) and reads 7.5 : 1 as text on white; teal / petrol was rejected (fails the chroma floor, reads grey next to Products blue, and sits 37° from the favourable green). Series roles on trend charts (IBCS-style, same in every view): Actual = `acc` solid · Latest estimate = `acc` dashed outline · Budget = Ink 900 tick marks / outline · Prior year = `#D9A8C2` (identity tint line). Categorical charts (product, channel, stream) use a 5-step single-hue ramp of the identity colour plus direct labels — never a rainbow.

### 5.2 View 1 — Overview ("are we on the number, and where is the gap?")

Primary action: read attainment and the gap by market without a click. 6 cards + 5 visuals (≤ 12).

```
┌ KPI row (150 px) — KPI card v2, 6 across ───────────────────────────────────────────────────────┐
│ Originations €138.4m │ Revenue €41.7m │ Attainment 98.2% │ Approval rate 41.3% │ Time to cash 3.4h │ MRR €0.58m │
│  vs Budget ▼ −3.1%   │ vs Budget ▼−1.8│ pace 101% (Sep)  │ vs Budget ▼ −2.7pp  │ vs PY ▼ −1.7h ✓   │ vs Budget ▲ │
│  vs PY ▲ +18.6%      │ vs PY ▲ +22.4% │ LE FY 98.1%      │ vs PY ▼ −2.9pp      │ (down = good)     │ vs PY ▲ +14%│
├ Row 2 (250 px) ────────────────────────────────────────────────┬────────────────────────────────────┤
│ Revenue by month, 2026 - Actual vs Budget vs Prior year (8/12) │ Originations bridge, Budget → Actual│
│ columns Actual Jan–Sep, dashed LE Oct–Dec, Budget ticks, PY line│ volume · ticket · mix · FX  (4/12)  │
├ Row 3 (230 px) ───────────────────┬────────────────────────────┬────────────────────────────────────┤
│ Application funnel YTD (4/12)     │ Where the gap is - markets │ Channel mix shift, share of         │
│ 6 stage bars, count + conversion %│ revenue · vs Budget · const│ originations YTD 2025 → 2026 (4/12) │
│ + Δpp vs PY                       │ ccy · vs PY, Romania orange│ 5 channels, two bars each           │
└───────────────────────────────────┴────────────────────────────┴────────────────────────────────────┘
```

Interactions: cards filter nothing (reference); clicking a market row in the gap table = same as picking it in the Market picker; the bridge and funnel carry the (i) info pop-up (L-15 analogue); hover on every mark shows a tooltip. Repeat share (★7) and coverage (★8) appear as the sub-lines of the Originations and Attainment cards, so the row stays at six.

### 5.3 View 2 — Funnel & originations ("where do applications leak, and what did we disburse?")

```
┌ Toolbar: "Count by" Applications / Principal  ·  (i) ───────────────────────────────────────────┐
├ Funnel card (7/12, 300 px)                        ┬ Stage cycle time (5/12)                       │
│ bar-style funnel, 6 stages in order, value + % of │ median hours per stage vs SLA marker,         │
│ previous + Δpp vs PY; declined / abandoned /      │ horizontal bars, worst stage first            │
│ not taken up as grey side bars                    │                                               │
├ Originations by product, 13 months (7/12, 300 px) ┼ Approval rate by market (5/12)                │
│ stacked columns (5-step identity ramp), Budget    │ small multiples 3 panels, shared y, PY light  │
│ outline, "Step 12 launch" marker Apr / Jul 2026   │ line, policy-change marker Mar 2026 (RO)      │
└───────────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

Field-parameter style switch "Count by" (applications vs principal) on the funnel and the product chart — native in B, a segmented control in A and C.

### 5.4 View 3 — Revenue & customers ("what is the revenue made of, and are customers staying?")

```
┌ KPI row (4 financial + 2 operational context): Revenue · MRR · ARPU · Paying subscribers │ 30+ DPD · Cost of risk ┐
├ Revenue by stream, 13 months (7/12)                 ┬ Stream × market matrix (5/12)                                │
│ stacked columns + Budget outline + PY line          │ Actual · vs Budget Δ / Δ% · const. ccy Δ% · vs PY Δ%          │
├ Subscriptions (6/12)                                ┼ New vs repeat borrowers (6/12)                                │
│ MRR line + subscribers by tier (stacked) + churn %  │ share bars by product + repeat share trend                    │
│ as a second small panel (no dual axis)              │                                                               │
└─────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────┘
```

### 5.5 View 4 — Channels & agents ("who is on target?")

```
┌ Toolbar: "Break down by" Channel / Agent / Partner · "Measure" Originations / Loans ─────────────┐
├ Attainment by channel (5/12, bullet bars)          ┬ Agent & partner leaderboard (7/12, table)       │
│ actual bar vs target marker, % label, sorted;      │ name · market · originations · target · attain. │
│ callout "N of 40 agents at ≥ 100 % (PY K)"         │ % (bar) · pace · approval rate · loans; ramp    │
│                                                    │ cohort tagged; RLS-ready (own row highlight)    │
├ Channel mix by month, 100 % stacked (6/12)         ┼ Approval rate × average ticket per agent (6/12) │
│ Marketplace share falling from May 2026            │ scatter, bubble = originations - coaching view  │
└────────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### 5.6 Identical across tracks vs accepted platform differences

**Identical:** page top, rail groups and flyout contents, tab names and order, KPI set per view, KPI card v2 anatomy and scales (±20 % / ±5 pp), number formats (tabular, right-aligned, U+2212, "+" on deltas), copy rules (" - ", "Showing …" period sentence, subtitles built from the selection), colour roles, info pop-up texts, the control-total and parity gates.

**Accepted differences** (same spirit as `parity-rules.md`):

- **Track B:** native visuals only — bar-style funnel = horizontal bar chart in stage order (no funnel visual with triangles); bridge = native waterfall (start bar takes the increase colour, known limitation); bullet bars = bar chart + error-bar / line marker or a matrix with data bars and a target icon; small multiples = native small multiples on a column chart; scatter = native scatter; Budget outline columns = clustered column with 0 % fill and identity border where the visual allows, else a line with markers; no per-mark "Step 12 launch" annotation (a text box at a fixed position instead); flyouts via bookmarks; searchable agent list = list slicer. **No custom visuals without an ADR.**
- **Track A:** replicates the mockup 1 : 1 (React + Tailwind tokens); charts as plain SVG, as in the P&L.
- **Track C:** same as A plus "Copy link" on the tabs row (F-37 analogue).

---

## 6. Tri-track implementation outline

### 6.1 Shared pieces (build first)

| Piece | Where | Owner | Notes |
|---|---|---|---|
| Requirements note with S-nn IDs (statement of §2 – §5 as a contract) | `docs/specs/sales-revenue-requirements.md` | main agent + USER | Short; cites this concept |
| ADR — second showcase report (data home, Track A placement, generator language) | `docs/ADR/0010-sales-revenue-dashboard.md` | main agent | Closes §8 Q3, Q9, Q10 |
| Generator + CSVs + README + control totals | `data/mirelo_sales_dummy_data/` | ginee (data-engineer skill) | Seeded, deterministic, ≈ 0.87 M fact rows, ≈ 60 MB CSV |
| Parity rules addendum + `parity_selections.csv` | `docs/design/parity-rules.md`, `checks/` | hunter | Same gate mechanism as the P&L |
| Measure dictionary | `docs/model/sales-measure-dictionary.md` | bip | Name, definition, DAX, spec ID — lockstep with the model |

### 6.2 Track B — Power BI (bip + ginee)

- **Where:** `pbi-report/Mirelo Sales & Revenue/` — new `.pbip`, own `.SemanticModel` (Import from the lakehouse SQL endpoint, same PQ parameter pattern `SqlEndpoint` / `Database`), own `.Report` (one page `sales_one_pager`, bookmarks for views / flyouts / market picker), `tests/control-totals.dax`.
- **Data home:** new schema **`mirelo_sales`** in `lh_raw` (same workspace RAW, same loader pattern `fabric-data/lh_raw/load_mirelo_sales.py`, pre-translated `amount_eur/pln/ron` columns per ADR-0008, derived `fact_funnel_monthly` rollup for the matrix-heavy visuals). Needs ginee's confirmation (Q9).
- **Model notes:** `dim_date` marked as date table, `dim_month` for the picker; targets as the Budget version of the facts; translation measures copied from the P&L pattern; period-end measures with `LASTDATE` on the window; one `_measures` table with folders `01 Originations`, `02 Revenue`, `03 Funnel`, `04 Customers`, `05 Targets`, `06 Risk context`, `Design`.
- **Effort:** semantic model 2 d · report page + bookmarks 3 d · tests + perf 1 d → **≈ 6 days**.

### 6.3 Track A — Rayfin app (fin)

- **Recommendation: the existing app, new route `/sales`** (not a second app). Reasons: the shell (rail, flyouts, tabs, KPI card v2, period picker, status line, info pop-ups) is already built in `packages/frontend/src/pnl/components/` and gets lifted to a shared `packages/frontend/src/shell/`; one Entra app, one `rayfin up`, one URL for vosk.dev to embed (route-per-report); the second semantic-model connector is one more entry in `rayfin/connectors/` and `connectors.ts`. A second app would duplicate auth, CI, deploy and the shell, for the only benefit of a separate item name (the item `acme` can be renamed later; the URL is already brand-neutral).
- **Work:** connector `mirelosm` (semantic-model DAX) → `lib/sales-queries.ts` (≈ 8 query shapes: cards, trend, bridge, funnel, gap table, channel mix, leaderboard, matrix) → `src/sales/` views; client-side deltas derived from base columns as in ADR-0006 §16.
- **Effort:** shell extraction 1 d · connector + queries 1.5 d · four views 3 d · parity tests 0.5 d → **≈ 6 days**.

### 6.4 Track C — Next.js (archi → nerd → hunter)

- **Where:** route `js-report/app/sales/`, engine `js-report/lib/sales-engine/` (own modules: `time-windows` and `fx` reused from `lib/engine/` via a shared `lib/common/`; new `funnel.ts`, `originations.ts`, `targets.ts`, `bridge.ts`, `kpis.ts`, `subscriptions.ts`), data build `scripts/build-sales-data.ts` → `public/data/sales/*.parquet` + `manifest.json` (Zod).
- **Scope in this repo:** skeleton as for the P&L (ADR-0002 steps 0 – 3: scaffold, data build, engine reconciled to the control totals, shell + Overview), hand-off note in `.sync/` for the vosk.dev repo.
- **Effort:** data build 1 d · engine + tests 2 d · shell reuse + Overview 1.5 d · remaining views 1.5 d → **≈ 6 days** (Overview-only skeleton ≈ 4.5 d).

### 6.5 Order of work

1. USER approves this concept (+ answers §8) → requirements note + ADR-0010.
2. Generator, CSVs, README, control totals (ginee) → USER reviews the story numbers.
3. Lakehouse load `mirelo_sales` (ginee, dry run → USER yes) → semantic model (bip) → DAX control-total tests green.
4. Track B report page (bip) → USER first-open checklist.
5. Track A route (fin) → deploy with USER go-ahead → parity check.
6. Track C skeleton + `.sync/` hand-off (archi / nerd / hunter).
7. Parity harness across the three (hunter) → feature marked implemented.

Rough total ≈ 20 agent-days plus review rounds; steps 4 – 6 can overlap once step 3 is green.

---

## 7. Design checks applied

- **Primary action per view** named (§5.2 – §5.5); the squint test on the Overview leaves the six values and the orange Romania row.
- **Form before colour:** magnitudes = bars / columns; polarity = diverging bars and the bridge; identity = ≤ 5 categories per chart with direct labels; single headline numbers = cards, never gauges; no dual axis anywhere (MRR and churn are two panels); funnel is bar-style, not a triangle.
- **Colour computed, not eyeballed:** identity + meaning triad validated (dataviz `validate_palette.js`, light mode, white surface) — all hard gates pass; the unfavourable bar `#E2804A` is below 3 : 1 on white as in the P&L, so every unfavourable mark carries a label or a Δ text (relief rule, already house practice).
- **Accessibility:** text pairs ≥ 4.5 : 1 (identity 7.5 : 1, favourable 7.6 : 1, unfavourable 5.2 : 1); meaning never by colour alone; legend on every ≥ 2-series chart; keyboard-operable controls (A, C), native (B).
- **60-30-10:** neutral frame ≈ 60 %, white cards ≈ 30 %, identity ≈ 10 % (brand mark, tab underline, totals, actual series, selected controls).

---

## 8. Open questions for the USER (recommended default in bold)

| # | Question | Recommended default |
|---|---|---|
| 1 | Company name and identity colour: "Mirelo", mulberry `#9B2360` / tint `#F8E8F0`? | **Accept** (validated; distinct from the three ACME hues and the meaning pair) |
| 2 | Markets Poland (PLN) · Romania (RON) · Portugal (EUR), reporting currency EUR, display options EUR / PLN / RON? | **Accept** — two translated markets keep FX a theme; USD not offered |
| 3 | Generator language: the P&L generator is Node.js (`gen_data.js`), the brief says Python. | **Python** (`generator/gen_data.py`, seeded, pandas-free NumPy + csv) — same language as the lakehouse loader, one venv; port the CSV / rounding conventions from `gen_data.js` |
| 4 | Brand mark opens a **Market picker** (entity analogue) rather than a company picker; one identity colour for all markets? | **Yes**, one colour (markets are not brands; tinting per market would make colour mean geography) |
| 5 | Keep the two credit-risk context KPIs (30+ DPD, cost of risk) as operational tiles on Revenue & customers? | **Yes** — they explain the Romania story; no visual of their own |
| 6 | Four views (Overview · Funnel & originations · Revenue & customers · Channels & agents) instead of the spec's seven pages? | **Yes** — spec pages Forecast, Activity & data quality and Opportunity detail have no lending equivalent; Product & Region folds into Funnel / Revenue breakdowns |
| 7 | Targets = Budget version of the facts for everything, plus a separate agent target sheet? | **Yes** — one target set avoids "which target" questions; agents need their own grain |
| 8 | Daily grain for funnel and originations (≈ 0.73 M rows), monthly for revenue, portfolio, targets? | **Yes** — daily is what makes pace and time-to-cash real; still ≈ 0.87 M rows in total |
| 9 | Data home for Tracks A + B: new schema `mirelo_sales` in the existing `lh_raw`, or a second lakehouse? | **Same lakehouse, new schema** — one loader pattern, one connection; ginee to confirm |
| 10 | Track A: new route in the existing Rayfin app, or a second app? | **Existing app, route `/sales`**, shell lifted to a shared folder; rename the Fabric item later if the ACME name bothers |

Smaller points the main agent may decide: leaderboard shows synthetic agent names (yes); period-end KPIs use the last **closed** month under Actual (yes, as the P&L); "Count by" switch on the funnel defaults to applications (yes).

---

## 9. USER priorities 2026-10-24 (addendum)

The USER named four priority metrics that re-rank §2's headline set; the metric map, lineage graph and reading path are in `docs/design/sales-revenue dashboard/metric-flow.html` (sections a – e). §1 – §8 above are left as written; where they disagree with this addendum, the addendum wins.

- **Tier 1 (top band of the Overview, start of every reading path):** (1) **Loans issued** — count of disbursed loans and disbursed principal; (2) **New clients locked in** — clients whose first loan was disbursed in the window (alternative first approval rejected: does not reconcile to loans); (3) **Returning clients %** — borrowers with ≥ 1 prior repaid / current loan ÷ borrowers (client-weighted on top, loan-weighted 57.8 % as sub-line); (4) **Bad / overdue loans %** — 30+ DPD balance ÷ outstanding at the last closed month (sub-lines 90+ DPD, 30+ by count, vintage 6-month bad rate). Credit quality is no longer a context tile.
- **Re-ranking of the former headline 8:** Originations → merged into (1); Repeat borrower share → promoted and redefined as (3); 30+ DPD → promoted to (4); Approval rate, Time to cash, Coverage → Tier 2 drivers under Loans issued; Revenue, Target attainment, MRR → Tier 3 outcomes (Revenue & targets view and the Δ vs Budget rows).
- **Reading path:** START = four hero cards (value, Δ vs Budget / PY, 13-month trend) → NEXT = the explanation band / view per metric → FINISH = loan-level and client-level detail (drill-through page in B, in-window panel in A / C) with all filters carried.
- **Concept changes:** Overview top band = the four priorities over a 2 × 2 "why" grid; views re-cut to five — Overview · Loans issued (funnel, bridge, attainment, leaderboard) · Clients (acquisition + retention) · Portfolio quality (new) · Revenue & targets; dataset adds `fact_loan` (≈ 1.05 M rows, replaces `fact_origination_daily` as the source), `dim_client` (≈ 480 k) and `fact_portfolio_vintage_monthly` (≈ 90 k); control totals gain loans count, new clients, both returning ratios and the DPD / vintage ratios.
- **Open questions** Q1 – Q6 in `metric-flow.html` §e (denominators, first-disbursed vs first-approved, DPD headline, loan-table size, five tabs, hero-card trend) supersede §8 where they overlap.

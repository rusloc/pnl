from rusloc/pnl (ginee) · to vosk.dev repo agent · 2026-10-30 · status: ready

Verified 2026-10-30 by ginee from this folder: `generator/generate.py --out <empty folder>` reproduced byte for byte the 18 Parquet
files + `manifest.json` and the 2 params the pack shipped until 2026-10-30, the committed `checks/control_totals_eur.csv`, and the
repo's 18 dims / facts CSVs; `checks/verify.py` on the result printed ALL CHECKS GREEN (47 checks).

# Mirelo Sales — data generator and contract

This folder holds the generator, the checks and the README of the repo's `data/mirelo_sales_dummy_data/`. The source of truth stays
in that repo folder: any change is made there first and copied here. The data itself is not in git (USER 2026-10-30):
`generator/generate.py` writes `dims/`, `facts/`, `params/` (CSV) and `parquet/` into this folder, and the Power BI pack in
`../../mirelo-sales/power-bi/` reads `parquet/` through its `DataFolder` parameter on a Desktop refresh. The CSVs are only needed for
`checks/verify.py` and for anyone who wants the source files. Setup, the generate → refresh → publish steps and what git ignores:
`../README.md`.

| Path | What |
|---|---|
| `generator/` | Committed: `generate.py` (Python 3.12, seed 20261026, deterministic) + `requirements.txt` (numpy 2.5.4, pandas 2.3.3, pyarrow 26.0.0) |
| `checks/` | Committed: `control_totals_eur.csv` (2,396 rows) + `verify.py` (47 checks). The generator rewrites the CSV byte for byte |
| `parquet/` | Generated, not in git: the 18 tables, one Parquet file each (22.8 MB), + `manifest.json` (seed, rows, columns and types, file sizes) |
| `dims/`, `facts/`, `params/` | Generated, not in git: the CSV tables (≈ 122 MB; `fact_loan` split by year) |

## Generate and verify (PowerShell, from `.sync\data-gen`; one-time setup in `../README.md`)

```powershell
.venv\Scripts\python.exe mirelo-sales\generator\generate.py     # writes dims\ facts\ params\ parquet\ checks\ into mirelo-sales\ (~20 s)
.venv\Scripts\python.exe mirelo-sales\checks\verify.py          # 47 checks; prints ALL CHECKS GREEN, exit 1 on any failure (~16 s)
```

- The generator's default output is this folder (the parent of `generator\`); `--out <folder>` writes elsewhere and
  `verify.py --data <folder>` checks that folder.
- The same seed gives byte-identical files, so the committed control totals stay unchanged; a diff there means the generator or its
  environment changed.
- One venv serves all three generators: `.sync\data-gen\.venv`, installed from `..\requirements.txt` (the same pins as
  `generator\requirements.txt`). pandas 3.x was blocked by Windows Application Control on the source machine, so the pin stays on
  2.3.3.

The repo's data README follows unchanged. Its paths (`data\mirelo_sales_dummy_data`, `dims/`, `facts/`) are repo paths: here the
folder is `data-gen/mirelo-sales`, and `dims/`, `facts/`, `params/` and `parquet/` exist only after a generate run.

---

# Mirelo Sales & Revenue — dummy dataset

Sample data for the Mirelo Sales & Revenue showcase (concept `docs/ADD/features/sales-revenue-dashboard-concept.md` §4 and §9, metric map `docs/design/sales-revenue dashboard/metric-flow.html`, ADR-0011). All figures are invented. The generator is deterministic: the same seed gives byte-identical files.

- **Company:** Mirelo, a fictional app-first neobank and microlender.
- **Markets and currencies:** Poland (PLN, launched Mar 2022), Romania (RON, Apr 2023), Portugal (EUR, Jan 2024). The reporting currency is EUR.
- **Calendar:** Jan 2024 – Dec 2026 (`dim_date` daily, `dim_month` monthly).
- **Last closed month:** Sep 2026 (`is_closed`). **Actuals run through 2026-10-25**: October 2026 is an open month with partial `fact_loan` and `fact_application` rows only. Every monthly fact stops at Sep 2026.
- **Budget:** the targets in `fact_target` cover all 36 months, through Dec 2026.
- **Scale:** ×0.6 of the concept's cap. The concept's loan-grain design came to ≈ 1.52 M source rows, which is the cap. This dataset has 634 k loans (614 k through Sep 2026 plus 20.6 k in October), 302 k clients and 0.73 M source fact rows.

## How to run

```powershell
cd data\mirelo_sales_dummy_data
py -3.12 -m venv generator\.venv                      # once; .venv is gitignored
generator\.venv\Scripts\python.exe -m pip install -r generator\requirements.txt
generator\.venv\Scripts\python.exe generator\generate.py            # writes into this folder (~30 s)
generator\.venv\Scripts\python.exe checks\verify.py                 # 47 checks, exit 1 on any failure (~16 s)
```

- `--out <folder>` writes the dataset somewhere else. `verify.py --data <folder>` checks that folder.
- Dependencies are pinned to numpy 2.5.4, pandas 2.3.3 and pyarrow 26.0.0. pandas 3.1.0 is blocked on this machine by Windows Application Control (a DLL load error), so stay on 2.3.3.

## Files

| File | Rows | Grain (one row per …) |
| --- | ---: | --- |
| dims/dim_date.csv | 1,096 | day, 2024-01-01 … 2026-12-31 |
| dims/dim_month.csv | 36 | month, 2024-01 … 2026-12 |
| dims/dim_market.csv | 3 | market |
| dims/dim_product.csv | 9 | product: 5 microloans, 3 account tiers, 1 debit card |
| dims/dim_channel.csv | 4 | acquisition or sales channel |
| dims/dim_agent.csv | 52 | field agent (40) or partner (12) |
| dims/dim_client.csv | 302,230 | client with at least one loan disbursed 2024-01-01 … 2026-10-25 |
| dims/dim_loan_status.csv | 8 | loan status at the last closed month |
| dims/dim_funnel_stage.csv | 10 | funnel stage, including the four lost outcomes |
| dims/dim_revenue_type.csv | 4 | revenue stream |
| facts/fact_application.csv | 64,873 | submission day × market × channel × product × new / repeat (funnel counts) |
| facts/fact_loan_2024.csv, _2025.csv, _2026.csv | 634,365 | disbursed loan (the CSV is split by disbursement year; see Assumptions) |
| facts/fact_loan_month.csv | 21,394 | month-end × vintage month × market × product × channel × new / repeat |
| facts/fact_subscription_month.csv | 297 | month × market × tier (Free / Plus / Pro), Jan 2024 – Sep 2026 |
| facts/fact_revenue_month.csv | 1,147 | month × market × product × revenue type, Jan 2024 – Sep 2026 |
| facts/fact_target.csv | 4,672 | Budget: month × market × product × metric, plus month × agent quotas |
| params/param_fx.csv | 210 | currency × month × rate type (local per 1 EUR) |
| params/param_thresholds.csv | 14 | DPD buckets, write-off point, KPI status bands |
| checks/control_totals_eur.csv | 2,396 | market (PL, RO, PT, ALL) × period × metric |
| checks/verify.py | — | Re-reads every table and checks the control totals and the consistency rules |
| parquet/*.parquet + manifest.json | — | The same 18 tables, one Parquet file each (fact_loan is a single file) |
| generator/generate.py | — | The generator (Python 3.12, seed 20261026) |

## Format

- CSV files are UTF-8, comma-separated, with a header row and `.` as the decimal mark.
- `month_key` and `vintage_month` are `YYYY-MM`. Dates are ISO `YYYY-MM-DD`. `submitted_ts` is `YYYY-MM-DDTHH:MM` (local time, no zone).
- Local amounts have 2 decimals. EUR columns (`principal_eur`, `amount_eur`, `revenue_eur`, `mrr_eur`) have **6 decimals**, so their sums match the control totals to the cent (as in ADR-0008). Model them as Decimal Number (double), never Fixed Decimal.
- Booleans are `TRUE` / `FALSE`. An empty cell means null.
- IDs are integers: `loan_id` starts at 1,000,001 in disbursement order, `client_id` starts at 100,001 in first-loan order, and `application_id` starts at 5,000,000 with gaps for applications that were never disbursed.

## Relationships

| Fact column | Dimension | Note |
| --- | --- | --- |
| `fact_loan.disbursed_date`, `fact_application.date` | `dim_date.date` | `dim_date.month_key` → `dim_month` |
| `month_key` (monthly facts, `fact_target`, `param_fx`) | `dim_month.month_key` | |
| `fact_loan_month.vintage_month` | `dim_month.month_key` | Role-playing, inactive. Vintages 2023-01 … 2023-12 are the opening book and have no `dim_month` row |
| `market_code` | `dim_market` | |
| `product_code` | `dim_product` | |
| `channel_code` | `dim_channel` | |
| `agent_code` | `dim_agent` | Filled only for AGENT and PARTNER rows |
| `client_id` | `dim_client` | `fact_loan` only |
| `fact_loan.status_code` | `dim_loan_status` | |
| `fact_revenue_month.revenue_type_code` | `dim_revenue_type` | |
| `currency_code` + `month_key` | `param_fx` (`rate_type`) | Translate at month × currency grain |
| `dim_client.acquisition_channel_code` / `acquisition_agent_code` / `first_product_code` | `dim_channel` / `dim_agent` / `dim_product` | |

`dim_funnel_stage` joins no fact. Its `fact_column` names the `fact_application` column, or the difference of two columns, for each stage. Use it for stage order or a field parameter.

## Columns

**dim_date**: `date` date · `month_key` text · `year` int · `quarter` int 1–4 · `year_quarter` text (`2026-Q3`) · `month_num` int · `month_name` text (`Sep`) · `day_of_month` int · `weekday_num` int (1 = Mon) · `weekday_name` text · `is_weekend` bool · `is_closed` bool (≤ 2026-09-30) · `has_actuals` bool (≤ 2026-10-25)

**dim_month**: `month_key` · `month_start` date · `month_index` int 1–36 · `year` · `quarter` · `month_name` · `days_in_month` · `is_closed` bool · `has_actuals` bool (through Oct 2026)

**dim_market**: `market_code` (PL, RO, PT) · `market_name` · `currency_code` · `launch_date` · `sort_order`

**dim_product**: `product_code` · `product_name` · `product_line` (Microloan / Account / Card) · `segment_code` (CONSUMER / MICRO_BUSINESS, loans only) · `repayment_type` (Bullet / Instalment) · `term_months` int (null for BIZ, whose term is 6, 9 or 12 per loan) · `tenor_days` int · `pl_launch_date` / `ro_launch_date` / `pt_launch_date` date (null = not offered) · `sort_order`

| product_code | Product | Term | Note |
| --- | --- | --- | --- |
| FLEX30 | Flex 30 | 1 month, bullet at day 30 | |
| FLEX90 | Flex 90 | 3 months, bullet at day 90 | |
| STEP6 | Step 6 | 6 monthly instalments | |
| STEP12 | Step 12 | 12 monthly instalments | Launched 2025-06-01 in PL and 2025-09-01 in RO; not offered in PT |
| BIZ | Biz Boost | 6, 9 or 12 monthly instalments | Micro-business loans, sold by agents and in the app |
| FREE, PLUS, PRO | Account tiers | — | Subscriptions |
| CARD | Debit card | — | Interchange |

**dim_channel**: `channel_code` (APP = App organic · PAID = paid acquisition: performance marketing, comparison sites, lead aggregators · PARTNER = embedded checkout · AGENT = field agents) · `channel_name` · `is_assisted` · `sort_order`

**dim_agent**: `agent_code` (A001–A040 agents, P001–P012 partners) · `agent_name` (invented) · `agent_type` (AGENT / PARTNER) · `market_code` · `team` (North / South for agents; E-commerce / Telco top-up / Gig platform for partners) · `start_date` · `is_ramp_cohort` bool (8 agents starting 2026-01-05) · `sort_order`

**dim_client**: `client_id` int · `market_code` · `segment_code` (CONSUMER / MICRO_BUSINESS) · `acquisition_channel_code` · `acquisition_agent_code` (agent or partner, else null) · `first_loan_date` date (can fall before 2024 for the opening base) · `first_product_code` · `cohort_month` text (month of `first_loan_date`) · `birth_year_band` text · `city_tier` int 1–3 · `loans_before_2024` int (loans disbursed before 2024-01-01, none of them in `fact_loan`)

**dim_loan_status**: `status_code` · `status_name` · `status_group` (Active / Closed / Not in snapshot) · `dpd_min` · `dpd_max` · `is_active` · `is_overdue_30` · `is_bad_90` · `sort_order`. The codes are CURRENT, DPD_1_29, DPD_30_59, DPD_60_89, DPD_90P, REPAID, WRITTEN_OFF and AFTER_CLOSE (loan disbursed after 2026-09-30).

**dim_funnel_stage**: `stage_code` (LEAD, STARTED, SUBMITTED, KYC_PASSED, APPROVED, DISBURSED; lost outcomes ABANDONED, DECLINED_KYC, DECLINED_CREDIT, NOT_TAKEN_UP) · `stage_name` · `sort_order` · `is_terminal` · `outcome` (Progress / Won / Lost) · `fact_column` · `sla_hours` int

**dim_revenue_type**: `revenue_type_code` (INTEREST, FEE, INTERCHANGE, SUBSCRIPTION) · `revenue_type_name` · `sort_order`

**fact_application**: `date` (submission day) · `market_code` · `channel_code` · `product_code` · `is_repeat` bool (applicant already had a loan) · `leads` · `apps_started` · `apps_submitted` · `kyc_passed` · `approved` · `disbursed` (all int, cumulative: each stage counts the applications that reached it). Lost outcomes are differences: abandoned = started − submitted, declined at KYC = submitted − kyc_passed, declined by credit = kyc_passed − approved, not taken up = approved − disbursed. For repeat applicants, `leads` = `apps_started`.

**fact_loan**: `loan_id` · `application_id` · `client_id` · `market_code` · `product_code` · `channel_code` · `agent_code` · `currency_code` · `submitted_ts` timestamp · `hours_to_approve` (submitted → approved) · `hours_to_cash` (submitted → disbursed) · `disbursed_date` date · `principal_local` · `principal_eur` (÷ ACTUAL_AVG rate of the disbursement month, 6 dp) · `term_months` int · `apr` (annual, 4 dp, 0.18–0.45) · `origination_fee_local` · `is_first_loan` bool · `is_repeat` bool (= NOT is_first_loan) · `prior_loans` int (all earlier loans of the client, including those before 2024) · `status_code` · `dpd_days_close` int · `outstanding_local_close` · `max_dpd_close` int · `repaid_date` date. The `*_close` columns, `status_code` and `repaid_date` describe the loan **as of 2026-09-30**. They are null (status AFTER_CLOSE) for loans disbursed in October 2026.

**fact_loan_month**: keys `month_key` (snapshot month end) · `vintage_month` (disbursement month) · `market_code` · `product_code` · `channel_code` · `is_repeat` · `currency_code`.
- Counts: `loans_disbursed` (on the row where month = vintage) · `loans_active` (outstanding > 0 at month end) · `loans_dpd_30p` · `loans_first_30p` / `loans_first_90p` (loans that first reached 30+ / 90+ DPD in this month).
- Balances (local, month end): `principal_disbursed_local` · `outstanding_local` = `bal_current_local` + `bal_dpd_1_29_local` + `bal_dpd_30_59_local` + `bal_dpd_60_89_local` + `bal_dpd_90p_local`.
- Flows (local, in the month): `principal_repaid_local` · `written_off_local` · `provision_local` (provision charge) · `interest_local` · `fee_local` (origination + late fees).
- Roll-forward: previous outstanding + disbursed − repaid − written off = outstanding. For the opening book this holds from the second 2024 row of each cell.

**fact_subscription_month**: `month_key` · `market_code` · `product_code` (FREE / PLUS / PRO) · `currency_code` · `subscribers_start` · `subscribers_new` · `subscribers_churned` · `subscribers_end` (= start + new − churned) · `price_local` (monthly) · `revenue_local` (average subscribers × price) · `mrr_local` (end × price) · `revenue_eur` · `mrr_eur`. FREE counts every account holder (borrowers and non-borrowers), at price 0.

**fact_revenue_month**: `month_key` · `market_code` · `product_code` · `revenue_type_code` · `currency_code` · `amount_local` · `amount_eur` (6 dp). INTEREST and FEE are per loan product, INTERCHANGE is on CARD, and SUBSCRIPTION is on PLUS / PRO.

**fact_target**: `version_code` (BUD) · `month_key` · `market_code` · `product_code` · `agent_code` · `metric_code` · `currency_code` (amount metrics only) · `target_value`.

| metric_code | Grain | Unit |
| --- | --- | --- |
| LOANS, NEW_CLIENTS | month × market × loan product (new clients by first product) | count |
| PRINCIPAL_LOCAL | month × market × loan product | local currency |
| REVENUE_LOCAL | month × market × product (loan products, PLUS, PRO, CARD) | local currency |
| DPD30_RATIO | month × market (`product_code` empty) | ratio, planned risk appetite |
| AGENT_LOANS, AGENT_PRINCIPAL_LOCAL | month × agent (`product_code` BIZ), from the agent's start month | count / local currency |

**param_fx**: `currency_code` · `month_key` · `rate_type` · `local_per_eur` (6 dp).
- ACTUAL_AVG covers Jan 2024 – Oct 2026; October is a month-to-date average.
- BUDGET has one rate per year, repeated per month: PLN 4.40 / 4.30 / 4.18 and RON 4.95 / 5.00 / 5.08 for 2024 / 2025 / 2026.
- EUR = 1.

**param_thresholds**: `threshold_set` (DPD_BUCKET, WRITE_OFF, KPI_STATUS) · `metric_code` · `band_code` · `min_value` · `max_value` · `label` · `sort_order`.

## Rules to apply in your measures

**Tier-1 metrics (metric-flow §a, ADR-0011 (g))**

1. **Loans issued.** Count `fact_loan` rows with `disbursed_date` in the window. Principal = Σ `principal_local` ÷ the ACTUAL_AVG rate of the loan's month × currency, which equals Σ `principal_eur`. Budget: `fact_target` LOANS, and PRINCIPAL_LOCAL ÷ the BUDGET rate.
2. **New clients locked in.** Σ `is_first_loan` in the window. This equals the count of `dim_client` rows whose `first_loan_date` is in the window. Budget: NEW_CLIENTS.
3. **Returning clients %**, client-weighted: distinct `client_id` among the window's loans with `is_repeat` = TRUE ÷ distinct `client_id` among the window's loans. The sub-line is loan-weighted: Σ `is_repeat` ÷ loans.
   - A client who takes their first loan in the window and borrows again in the same window counts as both new and returning. Over long windows, new + returning can therefore exceed the number of borrowers.
   - Monthly, the two ratios are almost equal. The generator never lends again to a client after a write-off or after a payment 60+ days late, so "prior repaid or current loan" is the same as "any prior loan".
4. **Bad / overdue loans %.** (`bal_dpd_30_59_local` + `bal_dpd_60_89_local` + `bal_dpd_90p_local`) ÷ `outstanding_local`, from `fact_loan_month` rows whose `month_key` is the last closed month of the window. For All markets, translate each market at that month's rate before summing. Budget: DPD30_RATIO.
   - 90+ % = `bal_dpd_90p_local` ÷ outstanding.
   - 30+ by count = Σ `loans_dpd_30p` ÷ Σ `loans_active`.
   - Vintage 6-month bad rate = Σ `loans_first_90p` over rows with months on book (`month_key` − `vintage_month`) ≤ 6 ÷ Σ `loans_disbursed` of the vintage.

**Other rules**

- **Currency translation.** Translate per month × currency, never on a total. Actual uses ACTUAL_AVG of the row's month. Budget uses BUDGET. Constant currency uses the BUDGET rate of the selected year for every version.
- **Period-end values** (outstanding, DPD buckets, `subscribers_end`, MRR) take the last closed month of the window. Never sum them over months.
- **Open month.** Under Actual, Oct 2026 has loans and funnel rows (use them for pace = month-to-date ÷ the elapsed share of the month target) but no revenue, portfolio or subscription rows.
- **Funnel.** Rows are cohorted by submission day. Approval rate = `approved` ÷ `apps_submitted`. Take-up = `disbursed` ÷ `approved`. KYC pass = `kyc_passed` ÷ `apps_submitted`. Abandon = (`apps_started` − `apps_submitted`) ÷ `apps_started`. New-client rates filter `is_repeat` = FALSE.
  - `fact_application.disbursed` counts loans by submission day, so a month's funnel total can differ by a few loans from that month's loans issued: an application submitted late on the last day is disbursed the next month.
- **Time to cash** = the median `hours_to_cash` of the window's loans (MEDIANX). The approval leg is `hours_to_approve`. There are no other stage timestamps.
- **Revenue** = Σ `fact_revenue_month.amount_local` ÷ rate, or Σ `amount_eur`. INTEREST and FEE tie to Σ `fact_loan_month.interest_local` / `fee_local` at month × market × product. SUBSCRIPTION ties to `fact_subscription_month.revenue_local`.
- **Cost of risk** = Σ `provision_local` ÷ number of months × 12 ÷ average `outstanding_local` (both translated).
- **Roll rate 30→60** = `bal_dpd_60_89_local` this month ÷ `bal_dpd_30_59_local` last month, for the same vintage cells. This is an approximation, because cell balances also amortise.
- **Agent attainment** = the agent's loans (`fact_loan` with `agent_code`) ÷ AGENT_LOANS. "Agents at target" = the share of agents with attainment ≥ 100 %.

## Control totals

`checks/control_totals_eur.csv` (long format: `market_code`, `period`, `metric_code`, `value`) holds 2,396 values. The generator computes them from the tables it writes, and `verify.py` recomputes every one of them independently from the CSVs.

- **Markets:** PL, RO, PT and ALL.
- **Periods:** each month 2024-01 … 2026-10, plus FY2024, FY2025, FY2026_YTD_SEP and TOTAL (Jan 2024 – 25 Oct 2026 for loans; snapshot and revenue end Sep 2026).
- **Metrics:**
  - `loans_count`, `principal_eur`, `new_clients`, `borrowers`, `returning_clients`, `returning_pct_clients`, `returning_pct_loans`;
  - at the period's last closed month: `outstanding_eur`, `dpd30_balance_eur`, `dpd30_pct`, `dpd90_pct`;
  - `revenue_eur` and `revenue_{interest,fee,interchange,subscription}_eur`.
- **Rules:** EUR = Σ local ÷ ACTUAL_AVG rate per month × currency, rounded to cents at the end. Ratios have 6 decimals. Oct 2026 has no snapshot or revenue values.

Headline values (Actual, EUR, all markets):

| Window | Loans | Principal €m | New clients | Returning (clients) | Returning (loans) | 30+ DPD | 90+ DPD | Revenue €m |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FY2024 | 160,286 | 51.04 | 87,303 | 47.5 % | 45.5 % | 4.28 % | 2.28 % | 6.76 |
| FY2025 | 243,554 | 88.87 | 108,252 | 56.9 % | 55.6 % | 4.92 % | 2.62 % | 11.95 |
| FY2026 YTD Sep | 209,898 | 82.10 | 83,633 | 62.1 % | 60.2 % | 4.63 % | 2.63 % | 11.98 |
| Sep 2026 | 24,410 | 9.59 | 9,796 | 59.9 % | 59.9 % | 4.63 % | 2.63 % | 1.34 |
| TOTAL (incl. Oct partial) | 634,365 | 230.08 | 287,574 | 56.5 % | 54.7 % | 4.63 % | 2.63 % | 30.69 |

FY2026 YTD Sep by market:

| Market | Loans | Principal €m | Revenue €m | 30+ DPD at Sep | Loans vs Budget | Principal vs Budget, local / EUR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PL | 100,607 | 29.14 | 4.59 | 4.78 % | +0.3 % | +1.8 % / −2.1 % |
| RO | 51,033 | 22.71 | 3.29 | 4.14 % | −10.5 % | −8.8 % / −11.1 % |
| PT | 58,258 | 30.25 | 4.09 | 4.89 % | +10.7 % | +10.6 % / +10.6 % |

Other FY2026 YTD values:

- **Funnel:** 1.03 m leads → 535 k started → 442 k submitted → 410 k KYC passed → 236 k approved → 210 k disbursed. Approval rate 53.4 % (new clients 36.5 %), take-up 88.9 %.
- **Loans:** time to cash median 3.5 h (4.9 h in H1 2025). Average ticket €391 (€318 in 2024).
- **Risk:** cost of risk 11.2 % annualised. 30+ by count 4.6 % at Sep. Vintage 6-month bad rate 2.9–3.8 % (vintages 2025-01 … 2026-03).
- **Subscriptions:** paying subscribers at Sep 2026: Plus 15.4 k, Pro 8.0 k. MRR €147 k (+18.7 % YoY).
- **Revenue mix:** interest 60 % · fees 21 % · interchange 8 % · subscriptions 11 %.

## Stories built into the data

| When | What | Where it shows |
| --- | --- | --- |
| Every month | **Seasonality.** Consumer demand peaks in Dec (+22 %) and Nov (+12 %), dips in Jul–Aug (−10 / −12 %) and in Feb (−9 %). Micro-business peaks in Mar and Sep. Weekdays are above weekends (agents sell almost nothing at weekends). **Payday peaks** fall on days 6–9 and 20–27 of the month, the trough on days 1–5. Dec 24–26 and Jan 1 run at about half volume. | Daily and monthly loans, funnel |
| Mar 2022 / Apr 2023 / Jan 2024 | Launches in **Poland, Romania and Portugal**. Portugal ramps up through Apr 2025, then grows about 18 % a year. | Market mix, PT has no PY in 2024 |
| 2024 → 2026 | **Repeat borrowers rise.** The loan-weighted share goes from 36 % (Q1 2024) to 62 % (Q3 2026) as the client base matures. One active loan at a time; the next loan follows repayment by about 20–75 days, depending on product. | Returning clients %, cohort curves |
| 2024 → 2026 | **Mix shifts to larger tickets.** Flex 30 loses share, repeat clients upgrade products and borrow more each time, and tickets drift up. Average ticket €318 → €391. | Average ticket, bridge "ticket" and "mix" |
| 2025-06-01 PL, 2025-09-01 RO | **Step 12 launches.** It takes about 35 % of Step 6 and 15 % of Flex 90 among new clients and is 8.8 % of 2026 loans. 2026 Budget: Step 12 +15 %, Step 6 −8 %. | Product mix, product variances |
| 2025-01 … 2025-11 vintages | **Romania's risk rises.** RO 30+ DPD climbs from 4.3 % (Jan 2025) to 7.3 % (Sep 2025). | Portfolio quality, RO line |
| 2026-03-01 | **Romania tightens credit policy.** New-client approval −9 pp of the credit step (overall RO approval about −5 pp) and repeat return rate −7 %. RO loans −10.5 % and principal −11.1 % (EUR) vs Budget for FY2026 YTD (about −12 % from March). Later vintages are better, and RO 30+ DPD recovers to 4.1 % by Sep 2026. | Gap by market, approval-rate trend, DPD |
| 2026-04 … 2026-05 | **Romania KYC friction.** KYC pass for new RO applicants falls from 89 % to 84 % (new document checks). | Funnel KYC step |
| From Q4 2025 | **Portugal beats.** The Partner channel takes off (×2.4 by mid-2026). PT runs +10.6 % vs Budget on principal and +10.2 % on revenue. | Gap by market, channel mix |
| 2026-05-01 | **Paid bids are cut** to 55 % of the previous intensity and App organic rises 6 %. The paid share of loans falls from 21 % (Q1) to 13 % (Q3 2026). | Channel mix |
| 2025-10-01 | **Instant payout rollout.** Median time to cash drops from about 4.9 h to 3.5 h. Repeat clients are faster and agent loans slower. | Time to cash |
| Jun – Sep 2026 | **PLN weakens:** 4.26 (May) → 4.62 (Sep 2026) per EUR, −5.7 % against Jan 2024 (4.36). It strengthened slightly through 2025. The 2026 Budget assumed 4.18, so Poland beats in constant currency (+1.8 %) but misses in EUR (−2.1 %). RON drifts down about 2 % a year (4.97 → 5.24). | FX effect, constant-currency columns |
| Jan 2026 | **Plus price rise:** PLN 17.99 → 21.99, RON 19.99 → 24.99, EUR 3.99 → 4.99. Plus churn spikes from 2.4 % to 3.2 % (Jan) and 4.1 % (Feb–Mar), then returns to 2.4 %. Plus adds −10 %. | Subscriber churn, MRR |
| Agents | **Star:** A001 (PL North) runs at 170 % of quota for FY2026 YTD. **Laggard:** A013 (PL South) falls behind from May 2026: acquisitions drop to 45 % and most returning clients move to the app (92 % of quota YTD, 72 % in Sep). **Ramp cohort:** the 8 agents starting 2026-01-05 have first-year quotas at 62 % of a mature quota and ramp from 39 % of target in Jan to 95 % in Sep. 42 % of agents are at or above target YTD. | Leaderboard, agents at target |
| Hidden drivers | Client risk is latent (channel, age band, city tier), as are market demand shocks (AR(1)), agent skill, and vintage risk by market × month. Repeat loans carry 0.55× the default probability of first loans. | Bad rate by channel / segment / new vs repeat |

## Data contract (Parquet)

Both draft tracks read these files (ADR-0011 (a)). One file per table, snappy compression, written with pyarrow 26. Types:
- `date32` for dates, `timestamp[s]` for `submitted_ts`, `bool` for flags;
- `int32` / `int64` for counts and IDs;
- `double` for amounts, rates and ratios;
- `string` for codes and keys.

`parquet/manifest.json` lists every table with rows, bytes and the column → Arrow type map, plus the seed, last closed month and actuals date.

| File | Rows | Parquet | CSV |
| --- | ---: | ---: | ---: |
| parquet/fact_loan.parquet | 634,365 | 19.60 MB | 96.02 MB (3 files) |
| parquet/dim_client.parquet | 302,230 | 1.89 MB | 20.12 MB |
| parquet/fact_loan_month.parquet | 21,394 | 0.78 MB | 2.77 MB |
| parquet/fact_application.parquet | 64,873 | 0.43 MB | 3.03 MB |
| parquet/fact_target.parquet | 4,672 | 0.02 MB | 0.22 MB |
| parquet/fact_revenue_month.parquet | 1,147 | 0.02 MB | 0.06 MB |
| parquet/fact_subscription_month.parquet | 297 | 0.02 MB | 0.02 MB |
| parquet/dim_date.parquet | 1,096 | 0.01 MB | 0.07 MB |
| 10 small dims and params (dim_month, dim_market, dim_product, dim_channel, dim_agent, dim_loan_status, dim_funnel_stage, dim_revenue_type, param_fx, param_thresholds) | 3–210 each | < 0.01 MB each | < 0.01 MB each |
| **Total** | | **22.8 MB** | **122.3 MB** |

Track C should keep `fact_loan` out of the first load. Load it lazily per disbursement month, or pre-aggregate it (metric-flow §c).

## Assumptions

Choices where the concept or the brief was ambiguous or contradictory. The brief of 2026-10-26 wins over the concept.

1. **Channels.** Four channels, as in the brief: App organic, Paid, Partner, Agent. The concept's Web and Marketplace are folded into App organic and Paid.
2. **Step 12 launch.** The brief says "mid-2025", so Step 12 launches 2025-06-01 in Poland and 2025-09-01 in Romania. It is not offered in Portugal (concept). The concept's Apr / Jul 2026 dates are dropped.
3. **Seasonality.** The brief's summer dip (Jul–Aug) replaces the concept's Aug–Sep peak. December spike and payday peaks as in the stories table.
4. **Data cut.** Actuals run through 2026-10-25. October 2026 is open (`is_closed` = FALSE, `has_actuals` = TRUE through the 25th) and holds loan and funnel rows only.
5. **Seasoned opening book.** The simulation starts on 2023-01-01, plus a 2022 client base in Poland, so the Jan 2024 portfolio is already seasoned. Loans before 2024 are never written to `fact_loan`. Their balances appear in `fact_loan_month` with vintages 2023-01 … 2023-12 until they run off, by mid-2025. `dim_client.loans_before_2024` and `prior_loans` count them.
6. **Loan lifecycle.**
   - Instalments are equal principal, due every 30 days; bullets are due at day 30 or 90.
   - Interest = outstanding × APR ÷ 365 × days, with no accrual from 90 DPD.
   - The late fee is a flat 30 PLN / 35 RON / 8 EUR in each month that ends 1–89 DPD.
   - The origination fee is recognised at disbursement (no EIR amortisation).
   - Write-off at 180 DPD, with no recoveries.
   - Some late payers cure after 3–85 days.
7. **Provisions.** Coverage by bucket is 2 % (current), 10 % (1–29), 35 % (30–59), 55 % (60–89) and 85 % (90+). `provision_local` = change in stock + write-offs.
8. **Re-lending.** One active loan per client. No new loan after a write-off or a 60+ day late payment.
9. **Returning definition.** Per loan: `is_repeat` = the client had any earlier loan, so `is_repeat` = `disbursed_date` > `first_loan_date`. The client-weighted ratio counts a client as returning if any of their loans in the window is a repeat (see the Tier-1 rules).
10. **Revenue mix.** The 60 / 21 / 8 / 11 split is hit exactly for FY2026 YTD, by scaling the origination-fee rate, interchange and the paying-subscriber base. Other periods drift naturally.
11. **Budget.**
    - For months with actuals, Budget = actual ÷ (1 + planned variance). The variance is a smooth market × year story (above) plus ±2 % monthly noise.
    - Oct–Dec 2026 Budget = the same months of 2025 × the market × product growth of the FY2026 YTD Budget.
    - Agent quotas = the median of mature agents in the same market and month, at 62 % in an agent's first 12 months. The star and the laggard are excluded from the median.
    - There is no Latest-estimate or Forecast version.
12. **FX levels.** PLN 4.36 → 4.27 (2024) → 4.23 (Dec 2025) → 4.26 (May 2026) → 4.62 (Sep 2026). RON 4.97 → 5.24, with ±0.3 % monthly noise.
13. **Subscriptions.** Local monthly prices: Plus PLN 17.99 / RON 19.99 / EUR 3.99, rising to 21.99 / 24.99 / 4.99 in Jan 2026; Pro 39.99 / 49.99 / 9.99. Paying tiers start near steady state. FREE = account holders, including non-borrowers.
14. **CSV split.** The `fact_loan` CSV is split by disbursement year (24.5 / 37.1 / 34.4 MB). A single file would be 96 MB, right at GitHub's 100 MB hard limit and above its 50 MB warning. The Parquet file is a single file.
15. **Names.** Agent and partner names are invented, written in ASCII without diacritics.

## Deviations from the concept

- **`fact_loan_month` is a cell-grain snapshot, not one row per loan.** The grain is month × vintage × market × product × channel × new / repeat, 21 k rows. One row per loan per month would be about 3.4 M rows, against a 1.5 M cap. Every loan-level state needed at the last closed month is on `fact_loan` (`status_code`, `dpd_days_close`, `outstanding_local_close`, `max_dpd_close`), and the two tie to the cent.
- **`fact_application` is aggregated** to submission day × market × channel × product × new / repeat (65 k rows), as the brief allowed. Per-application rows would be about 2 M. It is built backwards from the loans, so `disbursed` ties to `fact_loan` exactly.
- **Source fact rows are 0.73 M, not ≈ 0.9 M,** because of the two aggregated grains above.
- **Revenue is €12.0 m for FY2026 YTD**, against about €25 m for the concept's €41.7 m × 0.6. The brief's APR band (18–45 %) caps interest yield. The revenue mix is kept. Paying subscribers (23 k) and MRR (€147 k) are smaller than in the mockup for the same reason.
- **Approval rate is 53 %, not 41 %** (brief 45–55 %). New-client approval is 36.5 %, not 31 %.
- **Returning clients are 62.1 % client-weighted and 60.2 % loan-weighted for FY2026 YTD**, against the concept's 52.4 % / 57.8 %. The share rises from 47.5 % / 45.5 % in FY2024. With the per-loan definition, client-weighted is above loan-weighted for long windows (see Tier-1 rule 3).
- **Credit-risk numbers.**
  - Cost of risk is 11.2 %, not 3.9 %. This is realistic for a 1–3-month microloan book, where write-offs are large against a small average balance.
  - 30+ by count is 4.6 % (concept 5.3 %) and 90+ is 2.6 % (2.1 %).
  - 30+ DPD is 4.63 % at Sep 2026 (concept 4.6 %), but PY was 4.9 %, not 3.9 %: Romania's recovery outweighs the rest.
- **Not built:**
  - the concept's `fact_funnel_daily`, `fact_origination_daily`, `fact_cycle_time_monthly`, `fact_portfolio_monthly` and `fact_portfolio_vintage_monthly` (replaced by the tables above), `bridge_product_market` (launch dates are on `dim_product`), `dim_segment` (`dim_client.segment_code` + `is_repeat`), `dim_version` and the slicer `param_*` tables;
  - open applications and approved-but-not-disbursed principal (pipeline coverage);
  - per-stage timestamps other than approve and disburse.
- **Added:** `dim_month`, `dim_revenue_type`, `hours_to_approve`, `provision_local`, `has_actuals`.

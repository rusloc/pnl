# ACME Unified P&L — dummy dataset

Sample data that feeds the ACME Unified P&L report, built to the data model in section 8 of the requirements doc (D-01 to D-21). All figures are invented. The data is deterministic: regenerating it gives the same numbers.

- **Entities:** P = ACME Consumer Products, S = ACME Commerce Cloud (consolidated as ACME Group)
- **Months:** Jan 2024 – Dec 2026 (36 months, calendar fiscal year)
- **Last closed month:** Sep 2026 (`dim_month.is_closed`)
- **Versions:** Actual (Jan 2024 – Sep 2026), Budget (all 36 months), Forecast 6+6 (Jul – Dec 2026), Forecast 9+3 (Oct – Dec 2026, latest)
- **Regions and functional currencies:** North America USD, Continental Europe EUR, UK & Ireland GBP, Asia-Pacific AUD

## Files

| File | Rows | Spec ID | What it holds |
| --- | ---: | --- | --- |
| facts/fact_pl.csv | 457,896 | D-01 | Every P&L amount, signed, in local currency. Direct lines (revenue to cost-to-serve) at full slice grain; lines from operating expenses down at entity × region with slices = `P_UNASSIGNED` / `S_UNASSIGNED`. |
| facts/fact_pl_allocated.csv | 758,364 | D-02 | The below-contribution-margin lines from fact_pl, spread to slices by net revenue share (rule C-31). Sums back to fact_pl to the cent. |
| facts/fact_operational.csv | 29,016 | D-03 | Units sold (Products); GMV processed and active merchants at month end (Commerce Cloud). |
| facts/fact_fx_rate.csv | 288 | D-04 | Local currency per 1 USD: monthly average actual rates and one budget rate per fiscal year (repeated per month). |
| dims/dim_account.csv | 73 | D-10 | Leaf accounts with block, spine step, natural sign, IFRS 18 category, flags, definitions, published comparables. |
| dims/dim_report_line.csv | 29 | D-11 | The 19-step spine: input blocks, subtotals, ratios, formulas, tags, aliases, sort order. |
| dims/bridge_account_nature.csv | 54 | D-12 | Account → nature weights for the by-nature lens. Weights per account sum to 1. |
| dims/dim_nature.csv | 9 | D-13 | Expense natures. |
| dims/dim_entity.csv | 2 | D-14 | Entities (also used as counterparty). |
| dims/dim_month.csv | 36 | D-15 | Month key, start date, month index, fiscal year, quarter, closed flag. |
| dims/dim_version.csv | 4 | D-16 | Version key, version type, forecast cycle, latest-forecast flag. |
| dims/dim_region.csv | 4 | D-17 | Regions and functional currency. |
| dims/dim_channel.csv, dim_line.csv, dim_segment.csv | 10, 11, 8 | D-18 to D-20 | Slice values for both entities in one table each, plus one `_UNASSIGNED` member per entity. Codes are unique across entities, so each is a single-column key. |
| dims/dim_cost_centre.csv | 19 | — | Cost centres referenced in the facts. |
| params/param_*.csv | 2–5 each | D-21 | Disconnected tables for slicers: reporting currency, FX basis, units, version choice, time view, layout, cost lens, detail level, cost sign, variance format, breakdown. |
| checks/control_totals_usd.csv | 552 | T-06 | Expected subtotals in USD for P, S and GROUP across 8 windows. Use them to test your measures. |
| generator/ | — | — | The Node.js scripts that produced the data. Run `node generator/gen_data.js <output_folder>` to regenerate. |

## Format

- CSV, UTF-8, comma separator, header row, `.` as the decimal mark.
- `month_key` is `YYYY-MM`; dates are ISO `YYYY-MM-DD`.
- Amounts: 2 decimals, **signed** (revenue and income positive, costs negative), in the row's `currency_code`.
- Booleans are `TRUE` / `FALSE`. An empty cell means null (for example no counterparty).

## Relationships

| Fact column | Dimension |
| --- | --- |
| entity_code | dim_entity.entity_code |
| month_key | dim_month.month_key |
| version_key | dim_version.version_key |
| region_code | dim_region.region_code |
| channel_code | dim_channel.channel_code |
| line_code | dim_line.line_code |
| segment_code | dim_segment.segment_code |
| account_code | dim_account.account_code (→ bridge_account_nature → dim_nature; block_code → dim_report_line.block_code) |
| counterparty_entity_code | dim_entity.entity_code (inactive / role-playing relationship) |
| cost_centre_code | dim_cost_centre.cost_centre_code |
| currency_code + month_key | fact_fx_rate (currency_code, month_key, rate_type) |

`dim_report_line` is not joined to the facts; it drives row order and subtotal formulas.

## Rules to apply in your measures

**Direct vs allocated lines.** Read accounts with `dim_account.is_direct = TRUE` from fact_pl and accounts with `is_below_cm = TRUE` from fact_pl_allocated. Never add fact_pl's `_UNASSIGNED` rows to fact_pl_allocated: they are the same money before and after allocation. For an unfiltered entity total, either source gives the same result.

**Currency translation (C-10 to C-13).** `amount_usd = amount_local / local_per_usd`, then `amount_rep = amount_usd × local_per_usd` of the reporting currency, both for the same month.
- Version ACT and FC*: rate type `ACTUAL_AVG` of the row's month.
- Version BUD: rate type `BUDGET` of the row's month (one rate per year).
- Constant currency: rate type `BUDGET` of the **selected** fiscal year for every version, prior year included.
- Translate per row or per month and currency, never on an aggregated total.

**Latest estimate (C-02).** Actual for months where `is_closed = TRUE`, plus the forecast with `is_latest_forecast = TRUE` (FC2609) for open months. FC2606 is an older cycle kept for forecast-vs-forecast comparisons.

**Prior year (C-04).** Same months shifted back 12 (`month_index − 12`), version ACT. FY2024 has no prior year.

**Intercompany (C-35 to C-36).** Commerce Cloud runs the Consumer Products D2C webstore and payments.
- Consumer Products: account `VSC_P4` rows carry `counterparty_entity_code = S`.
- Commerce Cloud: matching revenue rows on `GR_S1` (30%) and `GR_S2` (70%), slice Sales-led / Enterprise, carry `counterparty_entity_code = P`.
- Both sides match exactly per version, month and region. ACME Group = all rows where `counterparty_entity_code` is empty.
- `ELIM_GR`, `ELIM_VSC` and `OOI_4` exist in dim_account for display only; they have no fact rows (`has_fact_rows = FALSE`). Show the elimination rows as minus the counterparty amounts.

**Operational KPIs.** `active_merchants_end` is a month-end count: take the last month of the window, never a sum. Units and GMV are flows and do sum. GMV is in local currency and translates like amounts.

**Signs and natures.** `natural_sign` is +1 for revenue and income, −1 for costs, 0 for lines that can go either way. The by-nature amount of an account is its amount × weight from bridge_account_nature.

## Control totals

`checks/control_totals_usd.csv` lists GR, GTN, NR, COR, GP, VSC, CM, SM, RD, GA, OOI, OPEX, EBITDA, DA, UOP, ADJ, OP, INV, PBFIT, FIN, PBT, TAX and NP in USD (actual rates for ACT and forecast, budget rates for BUD) for these windows:

| Version | Windows |
| --- | --- |
| ACT | FY2024, FY2025, FY2026 YTD Sep |
| BUD | FY2024, FY2025, FY2026, FY2026 YTD Sep |
| LE | FY2026 (actual Jan–Sep + forecast 9+3) |

Headline values (USD millions):

| Entity | Window | Net revenue | Adj. EBITDA | Operating profit | Net profit |
| --- | --- | ---: | ---: | ---: | ---: |
| Consumer Products | Actual FY2025 | 4,575.4 | 896.9 | 690.3 | 495.8 |
| Consumer Products | Actual FY2026 YTD Sep | 3,398.5 | 682.6 | 550.2 | 396.2 |
| Commerce Cloud | Actual FY2025 | 667.4 | 82.8 | 48.6 | 38.1 |
| Commerce Cloud | Actual FY2026 YTD Sep | 596.0 | 77.8 | 46.5 | 36.5 |
| ACME Group | Actual FY2026 YTD Sep | 3,972.7 | 760.4 | 596.7 | 432.7 |
| ACME Group | Latest estimate FY2026 | 5,737.2 | 1,066.7 | 835.5 | 604.8 |

## Stories built into the data

Useful for checking that variances, bridges and the profitability table show something real.

**Consumer Products**
- D2C webstore (+5%) and marketplaces (+2%) run ahead of trend in FY2026; grocery, drugstore and wholesale run behind.
- Toys & leisure (−7%) and electronics accessories (−3%) miss; personal care beats (+2%).
- Tariffs lift cost of revenue in electronics and toys: +1.5 pp of NR in 2025 and +2.8 pp in 2026 actual, against a budget of +0.8 / +1.2 pp.
- Grocery trade promotions run 1 pp of gross sales above budget in 2026.
- Outbound freight rates rise 3% in 2025 and 6% in 2026 versus 2024; the budget assumed 2% a year.
- Working media cut by 6% in 2026 to protect margin.
- Restructuring programme Apr–Jun 2025 (2.5% of NR, budget 1.5%), with a second phase Feb–Mar 2026.
- Impairment of a toy brand in Dec 2025.
- M&A costs May–Jul 2026.

**Commerce Cloud**
- Payments run 5% ahead of trend; subscriptions 2% behind; professional services 8% behind.
- Payment processing costs rise to 60.5% of payments revenue in 2026 actual, and credit losses rise.
- Opex falls as a share of revenue each year (operating leverage); data, AI & security spend steps up in 2026.
- Acquisition costs Jun–Sep 2025, followed by higher amortisation of acquired intangibles from Jul 2025.
- Restructuring Feb–Mar 2026.

**Allocation and intercompany**
- Tax and every line below contribution margin are allocated to slices by net revenue share, so by-slice EBITDA and operating margins are indicative.
- Commerce Cloud books the intercompany billings in its own revenue. Its standalone and group figures are therefore higher than in the interactive prototype by the intercompany amount (21.8m for FY2026 YTD); Consumer Products figures match the prototype exactly.

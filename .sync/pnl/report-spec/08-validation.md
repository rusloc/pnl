# 08 — Validation

The answer key of the web report (`C:\__VOSK__\data\pnl\checks\chat-golden.csv`, 63 rows, computed by plain loops
over the Parquet, not by the report engine), the generator's control totals (`control_totals_usd.csv`, 552 rows), the
web engine's own outputs for the default views (run on 2026-11-16 against the same Parquet), and row counts. A Power BI
build is correct when every check below passes. Tolerances (`src/lib/pnl/chat-metrics.test.ts:146-153`): amounts
± 0.011 currency units (+ 1e-9 relative), counts exact, ratios ± 1e-9. Empty expected value = the measure must return
BLANK ("n/a").

## 1. How to run a check (DAX query view)

Every row of §2 is one query of this shape (replace the bracketed parts; leave out the slice line when there is none):

```dax
EVALUATE
VAR _result =
    CALCULATE (
        [Net Revenue]
        ,TREATAS ( { "P" }, 'P Company'[CompanyCode] )
        ,TREATAS ( { 2025 }, 'P Fiscal Year'[FiscalYear] )
        ,TREATAS ( { 12 }, 'P Month'[MonthNumber] )
        ,TREATAS ( { "FY" }, 'P Time View'[TimeViewCode] )
        ,TREATAS ( { "A" }, 'P Base'[BaseCode] )
        ,TREATAS ( { "EUR" }, 'P Currency'[CurrencyCode] )
        ,TREATAS ( { "ACT" }, 'P FX Basis'[FxBasisCode] )
        ,TREATAS ( { "EU" }, 'Dim Region'[RegionCode] )          // slice, when the row has one
        ,'Comparison Column'[Comparison] = "Budget"              // column, when it is not Base
    )
RETURN
    ROW ( "Value", _result )
```

Compare A / B do not matter for these rows (each comparator is read through the calculation group). The month for a
full-year question is 12 (the anchor does not narrow a full year, but the selection codec keeps it).

## 2. The 63 golden answers

| # | Question | Company | FY | Month | Time view | Base | Ccy | FX | Slice | Column | Measure | Expected (raw) | Expected (as shown, USD m default units) |
|---:|---|---|---:|---:|---|---|---|---|---|---|---|---:|---|
| 1 | What was Consumer Products' net revenue in 2025 in euros? | P Consumer Products | 2025 | 12 Dec | FY (Full year) | A | EUR | ACT | — | Base | `[Net Revenue]` (NR) | 4051545277.04 | €4,051.5 m |
| 2 | Commerce Cloud adjusted EBITDA year to date September 2026 in pounds? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | GBP | ACT | — | Base | `[Adjusted EBITDA]` (EBITDA) | 57235565.76 | £57.2 m |
| 3 | Consumer Products net revenue YTD September 2026 at constant currency? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | CC | — | Base | `[Net Revenue]` (NR) | 3369007232.57 | $3,369.0 m |
| 4 | How much of Consumer Products' year-to-date revenue is FX effect? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FX Effect NR]` (FX_EFFECT_NR) | 29514710.09 | $29.5 m |
| 5 | What is Consumer Products' organic revenue growth year to date? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[NR Growth Organic]` (NR_GROWTH_ORGANIC) | 0.060787 | 6.1% |
| 6 | How fast is Commerce Cloud revenue growing year on year, YTD September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[NR Growth Reported]` (NR_GROWTH) | 0.295154 | 29.5% |
| 7 | Commerce Cloud net revenue in September 2026? | S Commerce Cloud | 2026 | 9 Sep | MTD (One month) | A | USD | ACT | — | Base | `[Net Revenue]` (NR) | 73007299.48 | $73.0 m |
| 8 | Consumer Products operating profit in Q3 2026? | P Consumer Products | 2026 | 9 Sep | QTD (Quarter to date) | A | USD | ACT | — | Base | `[Operating Profit]` (OP) | 190417410.87 | $190.4 m |
| 9 | Consumer Products net revenue over the last twelve months to September 2026? | P Consumer Products | 2026 | 9 Sep | LTM (Last 12 months) | A | USD | ACT | — | Base | `[Net Revenue]` (NR) | 4834347770.58 | $4,834.3 m |
| 10 | Consumer Products trailing twelve-month net revenue to June 2025? | P Consumer Products | 2025 | 6 Jun | LTM (Last 12 months) | A | USD | ACT | — | Base | `[Net Revenue]` (NR) | 4345546544.68 | $4,345.5 m |
| 11 | Commerce Cloud adjusted EBITDA in Q1 2026? | S Commerce Cloud | 2026 | 3 Mar | QTD (Quarter to date) | A | USD | ACT | — | Base | `[Adjusted EBITDA]` (EBITDA) | 24659226.18 | $24.7 m |
| 12 | What was Consumer Products' budgeted net revenue for January to September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Budget | `[Net Revenue]` (NR) | 3464798688.45 | $3,464.8 m |
| 13 | Consumer Products net revenue in the same period of 2025 (January to September)? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Prior Year | `[Net Revenue]` (NR) | 3139602664.46 | $3,139.6 m |
| 14 | What was Commerce Cloud's adjusted EBITDA for January to September 2025? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Prior Year | `[Adjusted EBITDA]` (EBITDA) | 60542986.30 | $60.5 m |
| 15 | What is the latest estimate of Consumer Products' full-year 2026 net revenue? | P Consumer Products | 2026 | 12 Dec | FY (Full year) | LE | USD | ACT | — | Base | `[Net Revenue]` (NR) | 4908087890.13 | $4,908.1 m |
| 16 | Commerce Cloud's budgeted net profit for full year 2026? | S Commerce Cloud | 2026 | 12 Dec | FY (Full year) | B | USD | ACT | — | Base | `[Net Profit]` (NP) | 54391035.24 | $54.4 m |
| 17 | Consumer Products net revenue in 2023? | P Consumer Products | 2024 | 12 Dec | FY (Full year) | A | USD | ACT | — | Prior Year | `[Net Revenue]` (NR) | (blank) | n/a |
| 18 | Consumer Products net revenue in Continental Europe in 2025? | P Consumer Products | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | `'Dim Region'[RegionCode]` = EU | Base | `[Net Revenue]` (NR) | 1268505725.32 | $1,268.5 m |
| 19 | Consumer Products adjusted EBITDA in North America, YTD September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Region'[RegionCode]` = NA | Base | `[Adjusted EBITDA]` (EBITDA) | 299444296.31 | $299.4 m |
| 20 | Gross profit of Consumer Products' own D2C webstore, year to date September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Channel'[ChannelCode]` = D2C | Base | `[Gross Profit]` (GP) | 239403672.20 | $239.4 m |
| 21 | Adjusted EBITDA of the grocery and mass retail channel, YTD September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Channel'[ChannelCode]` = GRO | Base | `[Adjusted EBITDA]` (EBITDA) | 272103774.38 | $272.1 m |
| 22 | Operating profit of Consumer Products' home care category in 2025? | P Consumer Products | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | `'Dim Line'[LineCode]` = HOME | Base | `[Operating Profit]` (OP) | 209573737.79 | $209.6 m |
| 23 | Commerce Cloud contribution margin from enterprise customers, YTD September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Segment'[SegmentCode]` = ENT | Base | `[Contribution Margin]` (CM) | 92446372.53 | $92.4 m |
| 24 | Commerce Cloud platform subscription revenue year to date September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Line'[LineCode]` = SUB | Base | `[Net Revenue]` (NR) | 223368362.84 | $223.4 m |
| 25 | Commerce Cloud net revenue in UK & Ireland year to date, in euros? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | EUR | ACT | `'Dim Region'[RegionCode]` = UK | Base | `[Net Revenue]` (NR) | 53605219.71 | €53.6 m |
| 26 | Consumer Products' budgeted net revenue for Asia-Pacific, January to September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Region'[RegionCode]` = AP | Budget | `[Net Revenue]` (NR) | 533479103.05 | $533.5 m |
| 27 | Net profit of Consumer Products' premium segment, YTD September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Segment'[SegmentCode]` = PREM | Base | `[Net Profit]` (NP) | 161829921.54 | $161.8 m |
| 28 | What was Consumer Products' gross margin in 2025? | P Consumer Products | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | — | Base | `[Gross Margin %]` (GM_PCT) | 0.489479 | 48.9% |
| 29 | Commerce Cloud adjusted EBITDA margin year to date September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Adjusted EBITDA Margin %]` (EBITDA_PCT) | 0.130516 | 13.1% |
| 30 | Consumer Products opex as a percentage of revenue, YTD September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Opex % of NR]` (OPEX_PCT) | 0.192610 | 19.3% |
| 31 | What is Consumer Products' gross-to-net percentage year to date? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Gross-to-Net %]` (GTN_PCT) | 0.213487 | 21.3% |
| 32 | Consumer Products A&P as a share of net revenue, year to date September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[A&P % of NR]` (AP_PCT) | 0.080308 | 8.0% |
| 33 | What was Commerce Cloud's effective tax rate in 2025? | S Commerce Cloud | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | — | Base | `[Effective Tax Rate %]` (ETR_PCT) | 0.220000 | 22.0% |
| 34 | Commerce Cloud sales and marketing as a percentage of revenue, YTD September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[S&M % of NR]` (SM_PCT) | 0.141731 | 14.2% |
| 35 | Consumer Products gross margin in Continental Europe, YTD September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Region'[RegionCode]` = EU | Base | `[Gross Margin %]` (GM_PCT) | 0.494008 | 49.4% |
| 36 | How many units did Consumer Products sell in 2025? | P Consumer Products | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | — | Base | `[Units Sold]` (UNITS) | 569256242 | 569,256,242 |
| 37 | Consumer Products net revenue per unit, year to date September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[NR per Unit]` (NR_PER_UNIT) | 8.09 | $8.09 |
| 38 | Units sold by Consumer Products in North America, YTD September 2026? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Region'[RegionCode]` = NA | Base | `[Units Sold]` (UNITS) | 189017059 | 189,017,059 |
| 39 | GMV processed by Commerce Cloud year to date September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[GMV Processed]` (GMV) | 11284983967.40 | $11,285.0 m |
| 40 | What is Commerce Cloud's payments take rate year to date? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Payments Take Rate]` (TAKE_RATE) | 0.026550 | 2.66% |
| 41 | How many active merchants did Commerce Cloud have at the end of September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Active Merchants]` (ACTIVE_MERCHANTS) | 138726 | 138,726 |
| 42 | How many active merchants did Commerce Cloud have at the end of 2025? | S Commerce Cloud | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | — | Base | `[Active Merchants]` (ACTIVE_MERCHANTS) | 124291 | 124,291 |
| 43 | What is Commerce Cloud's ARR run-rate as of September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[ARR Run-Rate]` (ARR) | 320001855.65 | $320.0 m |
| 44 | What share of Commerce Cloud revenue comes from platform subscriptions, YTD September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Subscriptions Share of NR]` (SUB_SHARE) | 0.374799 | 37.5% |
| 45 | How much did Consumer Products spend on advertising and promotion year to date? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[A&P Spend]` (AP_SPEND) | -272928719.92 | −$272.9 m |
| 46 | GMV processed by Consumer Products? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[GMV Processed]` (GMV) | (blank) | n/a |
| 47 | How many units did Commerce Cloud sell? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Units Sold]` (UNITS) | (blank) | n/a |
| 48 | What is the full-year 2026 revenue outlook for Consumer Products? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FY NR LE]` (FY_NR_LE) | 4908087890.13 | $4,908.1 m |
| 49 | Commerce Cloud full-year revenue attainment vs budget? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FY NR Attainment]` (FY_NR_ATTAINMENT) | 0.987644 | 98.8% |
| 50 | Will Consumer Products reach its 2026 EBITDA budget: what is the attainment? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FY EBITDA Attainment]` (FY_EBITDA_ATTAINMENT) | 0.964182 | 96.4% |
| 51 | Where are we against budget on net revenue and EBITDA? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Net Revenue]` (NR) | 3398521942.66 | $3,398.5 m |
| 52 | Where are we against budget on net revenue and EBITDA? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Budget | `[Net Revenue]` (NR) | 3464798688.45 | $3,464.8 m |
| 53 | Where are we against budget on net revenue and EBITDA? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Adjusted EBITDA]` (EBITDA) | 682594931.64 | $682.6 m |
| 54 | Where are we against budget on net revenue and EBITDA? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Budget | `[Adjusted EBITDA]` (EBITDA) | 701037782.25 | $701.0 m |
| 55 | What is the full-year outlook vs budget? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FY NR LE]` (FY_NR_LE) | 4908087890.13 | $4,908.1 m |
| 56 | What is the full-year outlook vs budget? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FY NR Attainment]` (FY_NR_ATTAINMENT) | 0.975921 | 97.6% |
| 57 | What is the full-year outlook vs budget? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[FY EBITDA Attainment]` (FY_EBITDA_ATTAINMENT) | 0.964182 | 96.4% |
| 58 | What was the Group's consolidated net revenue in 2025? | GROUP ACME Group | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | — | Base | `[Net Revenue]` (NR) | 5216205047.75 | $5,216.2 m |
| 59 | Group adjusted EBITDA year to date September 2026? | GROUP ACME Group | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[Adjusted EBITDA]` (EBITDA) | 760378089.40 | $760.4 m |
| 60 | The Group's budgeted operating profit for January to September 2026? | GROUP ACME Group | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Budget | `[Operating Profit]` (OP) | 624169918.31 | $624.2 m |
| 61 | What share of Consumer Products' 2025 revenue came from North America? | P Consumer Products | 2025 | 12 Dec | FY (Full year) | A | USD | ACT | `'Dim Region'[RegionCode]` = NA | Base | `[NR Share of Company]` (NR_SHARE) | 0.443929 | 44.4% |
| 62 | What share of Commerce Cloud's EBITDA comes from small business customers, YTD September 2026? | S Commerce Cloud | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | `'Dim Segment'[SegmentCode]` = SMB | Base | `[EBITDA Share of Company]` (EBITDA_SHARE) | 0.422296 | 42.2% |
| 63 | Consumer Products' share of net revenue? | P Consumer Products | 2026 | 9 Sep | YTD (Year to date) | A | USD | ACT | — | Base | `[NR Share of Company]` (NR_SHARE) | (blank) | n/a |

Notes. Row 17 (prior year of 2024), 46 (GMV for Consumer Products), 47 (units for Commerce Cloud) and 63 (a share
without a slice) are traps: they must read n/a. Rows 58–60 need the Group: `'P Company'[CompanyCode] = "GROUP"`
(intercompany rows excluded). Rows 48–50 and 55–57 (FY outlook) are base-only metrics: the full fiscal year whatever
the time view.

## 3. Control totals (552 rows)

File `C:\__VOSK__\data\pnl\checks\control_totals_usd.csv` (columns entity_code, version, window, line_code, amount_usd):
23 statement lines (GR … NP, the line measures of `04-measures.md` §4) × 24 windows, USD, **actual rates** (budget rows at
budget rates). Every value must match within 0.01 USD. Selection per window:

| version | window | Base | FY | Month | Time view | Column |
|---|---|---|---:|---:|---|---|
| ACT | FY2024 / FY2025 | A | 2024 / 2025 | 12 | FY | Base |
| ACT | FY2026 YTD Sep | A | 2026 | 9 | YTD | Base |
| BUD | FY2024 / FY2025 / FY2026 | B | 2024 / 2025 / 2026 | 12 | FY | Base |
| BUD | FY2026 YTD Sep | B | 2026 | 9 | YTD | Base |
| LE | FY2026 (actual Jan-Sep + forecast 9+3) | LE | 2026 | 12 | FY | Base |

Companies P, S and GROUP (Group = both companies without the intercompany rows). Load the CSV as a table
`Control Totals` (not related) and run, per window, `SUMMARIZECOLUMNS` over the 23 line measures; or check the headline
lines below.

| Company | Version | Window | Net revenue | Adj. EBITDA | Operating profit | Net profit |
|---|---|---|---:|---:|---:|---:|
| P | ACT | FY2024 | 4,220,750,660.13 | 841,588,293.07 | 689,641,269.23 | 498,131,110.96 |
| P | ACT | FY2025 | 4,575,428,492.38 | 896,884,746.73 | 690,335,320.69 | 495,801,736.03 |
| P | ACT | FY2026 YTD Sep | 3,398,521,942.66 | 682,594,931.64 | 550,227,316.26 | 396,244,971.86 |
| P | BUD | FY2024 | 4,247,368,626.28 | 846,675,045.21 | 693,769,774.69 | 501,118,227.82 |
| P | BUD | FY2025 | 4,546,877,113.52 | 901,010,076.75 | 721,598,516.60 | 519,733,171.93 |
| P | BUD | FY2026 | 5,029,184,785.91 | 996,757,495.27 | 811,183,624.30 | 584,011,020.53 |
| P | BUD | FY2026 YTD Sep | 3,464,798,688.45 | 701,037,782.25 | 571,781,810.78 | 412,171,576.56 |
| P | LE | FY2026 (actual Jan-Sep + forecast 9+3) | 4,908,087,890.13 | 961,055,604.57 | 774,343,615.09 | 556,821,562.91 |
| S | ACT | FY2024 | 513,706,576.96 | 56,056,238.20 | 34,419,151.32 | 27,043,640.69 |
| S | ACT | FY2025 | 667,360,690.84 | 82,827,372.21 | 48,580,071.47 | 38,144,183.91 |
| S | ACT | FY2026 YTD Sep | 595,967,635.73 | 77,783,157.75 | 46,509,620.47 | 36,494,875.32 |
| S | BUD | FY2024 | 516,707,961.43 | 56,414,746.57 | 34,650,310.46 | 27,220,154.14 |
| S | BUD | FY2025 | 658,221,037.27 | 82,872,108.24 | 50,149,801.51 | 39,363,529.03 |
| S | BUD | FY2026 | 871,726,621.96 | 112,997,019.60 | 69,312,048.56 | 54,391,035.24 |
| S | BUD | FY2026 YTD Sep | 602,158,360.33 | 82,581,155.95 | 52,388,107.52 | 41,089,171.72 |
| S | LE | FY2026 (actual Jan-Sep + forecast 9+3) | 860,955,932.19 | 105,692,814.11 | 61,163,009.18 | 48,023,940.52 |
| GROUP | ACT | FY2024 | 4,712,502,634.85 | 897,644,531.27 | 724,060,420.55 | 525,174,751.65 |
| GROUP | ACT | FY2025 | 5,216,205,047.75 | 979,712,118.94 | 738,915,392.16 | 533,945,919.94 |
| GROUP | ACT | FY2026 YTD Sep | 3,972,687,506.52 | 760,378,089.40 | 596,736,936.73 | 432,739,847.18 |
| GROUP | BUD | FY2024 | 4,742,014,900.76 | 903,089,791.78 | 728,420,085.14 | 528,338,381.96 |
| GROUP | BUD | FY2025 | 5,179,399,980.68 | 983,882,184.99 | 771,748,318.11 | 559,096,700.96 |
| GROUP | BUD | FY2026 | 5,869,280,381.20 | 1,109,754,514.86 | 880,495,672.86 | 638,402,055.77 |
| GROUP | BUD | FY2026 YTD Sep | 4,045,434,234.26 | 783,618,938.20 | 624,169,918.31 | 453,260,748.28 |
| GROUP | LE | FY2026 (actual Jan-Sep + forecast 9+3) | 5,737,181,677.23 | 1,066,748,418.68 | 835,506,624.27 | 604,845,503.44 |

## 4. Engine reference outputs for the default views

Selection: company P or S, FY 2026, month Sep, Year to date, base Actual, Compare A Budget, Compare B Prior year, USD,
actual rates, millions, costs negative, all columns, hide empty on. Produced by the web engine
(`createEngine`, `src/lib/pnl/engine/index.ts`) on the same Parquet. Values unrounded (amounts in USD, ratios as
fractions) unless quoted as display text.

### 4.1a Statement, Consumer Products (non-leaf rows; leaves shown on expand: 45)

| Code | Kind | Base | % NR | Budget | Δ vs Budget | Δ % | Prior year | Δ vs PY | Δ % | FY Budget | FY LE | Δ LE vs Bud |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GR | block | 4,321,001,175.05 | 1.271435 | 4,390,283,465.78 | -69,282,290.73 | -0.015781 | 3,987,995,993.96 | 333,005,181.09 | 0.083502 | 6,378,713,515.40 | 6,246,296,300.20 | -132,417,215.20 |
| GTN | block | -922,479,232.39 | -0.271435 | -925,484,777.33 | 3,005,544.94 | 0.003248 | -848,393,329.50 | -74,085,902.89 | -0.087325 | -1,349,528,729.49 | -1,338,208,410.07 | 11,320,319.42 |
| NR | subtotal | 3,398,521,942.66 | 1.000000 | 3,464,798,688.45 | -66,276,745.79 | -0.019129 | 3,139,602,664.46 | 258,919,278.20 | 0.082469 | 5,029,184,785.91 | 4,908,087,890.13 | -121,096,895.78 |
| COR | block | -1,719,311,862.10 | -0.505900 | -1,738,564,919.87 | 19,253,057.77 | 0.011074 | -1,589,283,570.51 | -130,028,291.59 | -0.081816 | -2,544,579,293.02 | -2,507,815,496.25 | 36,763,796.77 |
| GP | subtotal | 1,679,210,080.56 | 0.494100 | 1,726,233,768.58 | -47,023,688.02 | -0.027241 | 1,550,319,093.95 | 128,890,986.61 | 0.083138 | 2,484,605,492.88 | 2,400,272,393.88 | -84,333,099.01 |
| GM_PCT | ratio | 0.494100 |  | 0.498221 | -0.004120 |  | 0.493795 | 0.000305 |  | 0.494037 | 0.489044 | -0.004993 |
| VSC | block | -348,845,128.71 | -0.102646 | -350,210,813.50 | 1,365,684.79 | 0.003900 | -308,412,266.50 | -40,432,862.21 | -0.131100 | -510,376,033.08 | -505,816,220.28 | 4,559,812.80 |
| CM | subtotal | 1,330,364,951.85 | 0.391454 | 1,376,022,955.08 | -45,658,003.23 | -0.033181 | 1,241,906,827.45 | 88,458,124.40 | 0.071228 | 1,974,229,459.80 | 1,894,456,173.60 | -79,773,286.21 |
| CM_PCT | ratio | 0.391454 |  | 0.397144 | -0.005690 |  | 0.395562 | -0.004108 |  | 0.392555 | 0.385987 | -0.006568 |
| OPEX | group_total | -647,770,020.20 | -0.190603 | -674,985,172.83 | 27,215,152.62 | 0.040320 | -613,107,361.10 | -34,662,659.11 | -0.056536 | -977,471,964.54 | -933,400,569.03 | 44,071,395.51 |
| SM | block | -392,296,680.68 | -0.115432 | -414,409,869.11 | 22,113,188.43 | 0.053361 | -376,982,356.04 | -15,314,324.64 | -0.040623 | -598,936,094.42 | -564,116,399.72 | 34,819,694.70 |
| RD | block | -82,211,824.99 | -0.024190 | -83,870,570.58 | 1,658,745.59 | 0.019777 | -75,912,056.98 | -6,299,768.01 | -0.082988 | -122,047,445.98 | -119,034,791.44 | 3,012,654.54 |
| GA | block | -180,079,954.20 | -0.052988 | -183,634,330.50 | 3,554,376.30 | 0.019356 | -166,317,981.46 | -13,761,972.74 | -0.082745 | -266,546,793.68 | -260,086,949.42 | 6,459,844.26 |
| OOI | block | 6,818,439.66 | 0.002006 | 6,929,597.36 | -111,157.70 | -0.016041 | 6,105,033.38 | 713,406.29 | 0.116855 | 10,058,369.55 | 9,837,571.55 | -220,797.99 |
| EBITDA | subtotal | 682,594,931.64 | 0.200851 | 701,037,782.25 | -18,442,850.61 | -0.026308 | 628,799,466.35 | 53,795,465.29 | 0.085553 | 996,757,495.27 | 961,055,604.57 | -35,701,890.70 |
| EBITDA_PCT | ratio | 0.200851 |  | 0.202331 | -0.001481 |  | 0.200280 | 0.000571 |  | 0.198195 | 0.195811 | -0.002384 |
| DA | block | -122,346,789.94 | -0.036000 | -124,732,752.78 | 2,385,962.84 | 0.019129 | -113,025,695.98 | -9,321,093.96 | -0.082469 | -181,050,652.28 | -176,691,164.04 | 4,359,488.25 |
| UOP | memo | 560,248,141.70 | 0.164851 | 576,305,029.47 | -16,056,887.77 | -0.027862 | 515,773,770.37 | 44,474,371.33 | 0.086228 | 815,706,842.98 | 784,364,440.54 | -31,342,402.45 |
| ADJ | block | -10,020,825.44 | -0.002949 | -4,523,218.69 | -5,497,606.75 | -1.215419 | -26,329,906.26 | 16,309,080.82 | 0.619413 | -4,523,218.69 | -10,020,825.44 | -5,497,606.75 |
| OP | subtotal | 550,227,316.26 | 0.161902 | 571,781,810.78 | -21,554,494.52 | -0.037697 | 489,443,864.11 | 60,783,452.15 | 0.124189 | 811,183,624.30 | 774,343,615.09 | -36,840,009.20 |
| OP_PCT | ratio | 0.161902 |  | 0.165026 | -0.003124 |  | 0.155894 | 0.006008 |  | 0.161295 | 0.157769 | -0.003526 |
| INV | block | 12,234,679.01 | 0.003600 | 12,473,275.28 | -238,596.26 | -0.019129 | 11,930,490.13 | 304,188.89 | 0.025497 | 18,105,065.24 | 17,669,116.38 | -435,948.86 |
| PBFIT | subtotal | 562,461,995.27 | 0.165502 | 584,255,086.06 | -21,793,090.79 | -0.037301 | 501,374,354.24 | 61,087,641.04 | 0.121840 | 829,288,689.54 | 792,012,731.48 | -37,275,958.06 |
| FIN | block | -41,087,032.00 | -0.012090 | -41,924,064.14 | 837,032.15 | 0.019965 | -37,968,807.40 | -3,118,224.60 | -0.082126 | -60,853,135.93 | -59,352,779.96 | 1,500,355.96 |
| PBT | subtotal | 521,374,963.28 | 0.153412 | 542,331,021.92 | -20,956,058.64 | -0.038641 | 463,405,546.84 | 57,969,416.44 | 0.125094 | 768,435,553.61 | 732,659,951.51 | -35,775,602.10 |
| TAX | block | -125,129,991.42 | -0.036819 | -130,159,445.36 | 5,029,453.94 | 0.038641 | -111,217,331.40 | -13,912,660.01 | -0.125094 | -184,424,533.09 | -175,838,388.60 | 8,586,144.48 |
| ETR_PCT | ratio | 0.240000 |  | 0.240000 | 0.000000 |  | 0.240000 | 0.000000 |  | 0.240000 | 0.240000 | 0.000000 |
| NP | subtotal | 396,244,971.86 | 0.116593 | 412,171,576.56 | -15,926,604.70 | -0.038641 | 352,188,215.44 | 44,056,756.43 | 0.125094 | 584,011,020.53 | 556,821,562.91 | -27,189,457.62 |
| NP_PCT | ratio | 0.116593 |  | 0.118960 | -0.002366 |  | 0.112176 | 0.004417 |  | 0.116124 | 0.113450 | -0.002675 |

### 4.1b Statement, Commerce Cloud (non-leaf rows; leaves shown on expand: 42)

| Code | Kind | Base | % NR | Budget | Δ vs Budget | Δ % | Prior year | Δ vs PY | Δ % | FY Budget | FY LE | Δ LE vs Bud |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GR | block | 623,259,941.27 | 1.045795 | 630,128,667.81 | -6,868,726.55 | -0.010901 | 481,834,000.45 | 141,425,940.81 | 0.293516 | 910,864,024.54 | 899,074,661.97 | -11,789,362.57 |
| GTN | block | -27,292,305.53 | -0.045795 | -27,970,307.48 | 678,001.95 | 0.024240 | -21,682,000.37 | -5,610,305.16 | -0.258754 | -39,137,402.58 | -38,118,729.78 | 1,018,672.80 |
| NR | subtotal | 595,967,635.73 | 1.000000 | 602,158,360.33 | -6,190,724.60 | -0.010281 | 460,152,000.08 | 135,815,635.65 | 0.295154 | 871,726,621.96 | 860,955,932.19 | -10,770,689.78 |
| COR | block | -263,507,828.98 | -0.442151 | -263,398,584.52 | -109,244.45 | -0.000415 | -199,418,416.29 | -64,089,412.69 | -0.321382 | -388,330,303.03 | -387,661,005.16 | 669,297.87 |
| GP | subtotal | 332,459,806.76 | 0.557849 | 338,759,775.81 | -6,299,969.05 | -0.018597 | 260,733,583.79 | 71,726,222.96 | 0.275094 | 483,396,318.94 | 473,294,927.03 | -10,101,391.90 |
| GM_PCT | ratio | 0.557849 |  | 0.562576 | -0.004727 |  | 0.566625 | -0.008776 |  | 0.554527 | 0.549732 | -0.004796 |
| VSC | block | -28,853,021.65 | -0.048414 | -27,763,623.11 | -1,089,398.54 | -0.039238 | -21,263,145.67 | -7,589,875.99 | -0.356950 | -39,899,129.36 | -41,470,242.02 | -1,571,112.66 |
| CM | subtotal | 303,606,785.11 | 0.509435 | 310,996,152.70 | -7,389,367.59 | -0.023760 | 239,470,438.13 | 64,136,346.98 | 0.267826 | 443,497,189.57 | 431,824,685.01 | -11,672,504.56 |
| CM_PCT | ratio | 0.509435 |  | 0.516469 | -0.007034 |  | 0.520416 | -0.010981 |  | 0.508757 | 0.501564 | -0.007193 |
| OPEX | group_total | -225,823,627.35 | -0.378919 | -228,414,996.75 | 2,591,369.40 | 0.011345 | -178,927,451.83 | -46,896,175.53 | -0.262096 | -330,500,169.98 | -326,131,870.91 | 4,368,299.07 |
| SM | block | -84,466,922.48 | -0.141731 | -85,402,603.81 | 935,681.32 | 0.010956 | -69,577,630.10 | -14,889,292.38 | -0.213995 | -123,581,936.60 | -121,985,528.89 | 1,596,407.71 |
| RD | block | -95,143,367.96 | -0.159645 | -96,215,490.44 | 1,072,122.47 | 0.011143 | -72,529,256.70 | -22,614,111.26 | -0.311793 | -139,209,888.73 | -137,386,810.05 | 1,823,078.68 |
| GA | block | -46,856,962.53 | -0.078623 | -47,377,538.02 | 520,575.49 | 0.010988 | -37,200,872.31 | -9,656,090.21 | -0.259566 | -68,548,440.23 | -67,658,085.82 | 890,354.40 |
| OOI | block | 643,625.62 | 0.001080 | 580,635.51 | 62,990.11 | 0.108485 | 380,307.29 | 263,318.33 | 0.692383 | 840,095.58 | 898,553.86 | 58,458.28 |
| EBITDA | subtotal | 77,783,157.75 | 0.130516 | 82,581,155.95 | -4,797,998.20 | -0.058100 | 60,542,986.30 | 17,240,171.45 | 0.284759 | 112,997,019.60 | 105,692,814.11 | -7,304,205.49 |
| EBITDA_PCT | ratio | 0.130516 |  | 0.137142 | -0.006626 |  | 0.131572 | -0.001056 |  | 0.129624 | 0.122762 | -0.006862 |
| DA | block | -29,856,609.31 | -0.050098 | -30,193,048.43 | 336,439.12 | 0.011143 | -20,740,650.48 | -9,115,958.83 | -0.439521 | -43,684,971.03 | -43,112,876.96 | 572,094.07 |
| UOP | memo | 47,926,548.44 | 0.080418 | 52,388,107.52 | -4,461,559.08 | -0.085164 | 39,802,335.82 | 8,124,212.63 | 0.204114 | 69,312,048.56 | 62,579,937.15 | -6,732,111.42 |
| ADJ | block | -1,416,927.97 | -0.002378 | 0.00 | -1,416,927.97 | n/a | -3,177,743.15 | 1,760,815.18 | 0.554109 | 0.00 | -1,416,927.97 | -1,416,927.97 |
| OP | subtotal | 46,509,620.47 | 0.078041 | 52,388,107.52 | -5,878,487.05 | -0.112210 | 36,624,592.67 | 9,885,027.80 | 0.269901 | 69,312,048.56 | 61,163,009.18 | -8,149,039.39 |
| OP_PCT | ratio | 0.078041 |  | 0.087001 | -0.008960 |  | 0.079592 | -0.001552 |  | 0.079511 | 0.071041 | -0.008470 |
| INV | block | 4,019,158.97 | 0.006744 | 4,064,448.81 | -45,289.84 | -0.011143 | 3,095,006.07 | 924,152.89 | 0.298595 | 5,880,669.18 | 5,803,656.54 | -77,012.63 |
| PBFIT | subtotal | 50,528,779.44 | 0.084784 | 56,452,556.33 | -5,923,776.89 | -0.104934 | 39,719,598.74 | 10,809,180.70 | 0.272137 | 75,192,717.74 | 66,966,665.72 | -8,226,052.02 |
| FIN | block | -3,740,477.62 | -0.006276 | -3,774,131.09 | 33,653.48 | 0.008917 | -2,869,289.21 | -871,188.41 | -0.303625 | -5,460,621.41 | -5,397,511.07 | 63,110.35 |
| PBT | subtotal | 46,788,301.83 | 0.078508 | 52,678,425.24 | -5,890,123.42 | -0.111813 | 36,850,309.54 | 9,937,992.29 | 0.269685 | 69,732,096.33 | 61,569,154.66 | -8,162,941.67 |
| TAX | block | -10,293,426.51 | -0.017272 | -11,589,253.52 | 1,295,827.01 | 0.111813 | -8,107,068.15 | -2,186,358.35 | -0.269685 | -15,341,061.09 | -13,545,214.13 | 1,795,846.96 |
| ETR_PCT | ratio | 0.220000 |  | 0.220000 | 0.000000 |  | 0.220000 | 0.000000 |  | 0.220000 | 0.220000 | 0.000000 |
| NP | subtotal | 36,494,875.32 | 0.061236 | 41,089,171.72 | -4,594,296.40 | -0.111813 | 28,743,241.39 | 7,751,633.93 | 0.269685 | 54,391,035.24 | 48,023,940.52 | -6,367,094.71 |
| NP_PCT | ratio | 0.061236 |  | 0.068236 | -0.007000 |  | 0.062465 | -0.001228 |  | 0.062395 | 0.055780 | -0.006615 |

### 4.2a Vitals, Consumer Products (display text)

| Card | Value | Row 1 | Row 2 | Status chip | ⓘ values |
|---|---|---|---|---|---|
| Net revenue | $3,398.5 m | vs Budget: −66.3 −1.9% (adverse) | vs Prior year: +258.9 +8.2% (neutral) | watch | Organic growth vs PY (constant currency): +6.1%; Reported growth vs PY: +8.2% |
| Adjusted EBITDA | $682.6 m | vs Budget: −18.4 −2.6% (adverse) | vs Prior year: +53.8 +8.6% (neutral) | watch | Margin: 20.1% |
| Operating profit | $550.2 m | vs Budget: −21.6 −3.8% (adverse) | vs Prior year: +60.8 +12.4% (neutral) | off track | Margin: 16.2%; Adj. EBITDA: $682.6 m; D&A: −$122.3 m; Adjusting items: −$10.0 m; Net profit: $396.2 m; Net margin: 11.7% |
| Gross margin % | 49.4% | vs Budget: −0.4 pp (adverse) | vs Prior year: on plan (neutral) | watch | Home care: 51.6%; Personal care & beauty: 59.6% |
| Opex % revenue | 19.3% | vs Budget: −0.4 pp (ahead) | vs Prior year: −0.5 pp (neutral) | ahead | Sales & marketing % NR: 11.5%; R&D % NR: 2.4%; G&A % NR: 5.3%; Opex: $654.6 m; Opex vs Budget (favourable +): +$27.3 m |
| Units sold | 419,838,143 | vs Budget: −7,162,466 −1.7% (adverse) | vs Prior year: +15,618,120 +3.9% (neutral) | watch | Volume vs prior year: +3.9% |
| Net revenue per unit | $8.09 | vs Budget: −0.02 −0.2% (plan) | vs Prior year: +0.33 +4.2% (neutral) | on track | Net revenue: $3,398.5 m; Units sold: 419,838,143 |
| Gross-to-net % | 21.3% | vs Budget: +0.3 pp (plan) | vs Prior year: +0.1 pp (neutral) | on track | Gross-to-net deductions: −$922.5 m |
| A&P % of NR | 8.0% | vs Budget: −0.4 pp (neutral) | vs Prior year: −0.4 pp (neutral) | — | A&P spend: −$272.9 m |
| FY outlook | $4,908.1 m | vs FY Budget: −121.1 −2.4% (adverse) | EBITDA vs FY Bud: −35.7 −3.6% (adverse) | watch | Revenue attainment: 97.6%; Adj. EBITDA, FY LE: $961.1 m; EBITDA attainment: 96.4% |

### 4.2b Vitals, Commerce Cloud (display text)

| Card | Value | Row 1 | Row 2 | Status chip | ⓘ values |
|---|---|---|---|---|---|
| Net revenue | $596.0 m | vs Budget: −6.2 −1.0% (adverse) | vs Prior year: +135.8 +29.5% (neutral) | watch | Organic growth vs PY (constant currency): +27.4%; Reported growth vs PY: +29.5% |
| Adjusted EBITDA | $77.8 m | vs Budget: −4.8 −5.8% (adverse) | vs Prior year: +17.2 +28.5% (neutral) | off track | Margin: 13.1%; Rule of 40 (organic growth + margin): 40.4% |
| Operating profit | $46.5 m | vs Budget: −5.9 −11.2% (adverse) | vs Prior year: +9.9 +27.0% (neutral) | off track | Margin: 7.8%; Adj. EBITDA: $77.8 m; D&A: −$29.9 m; Adjusting items: −$1.4 m; Net profit: $36.5 m; Net margin: 6.1% |
| Gross margin % | 55.8% | vs Budget: −0.5 pp (adverse) | vs Prior year: −0.9 pp (neutral) | watch | Platform subscriptions: 81.2%; Payments: 38.6% |
| Opex % revenue | 38.0% | vs Budget: on plan (plan) | vs Prior year: −1.0 pp (neutral) | on track | Sales & marketing % NR: 14.2%; R&D % NR: 16.0%; G&A % NR: 7.9%; Opex: $226.5 m; Opex vs Budget (favourable +): +$2.5 m |
| GMV processed | $11,285.0 m | vs Budget: +90.9 +0.8% (plan) | vs Prior year: +3,114.8 +38.1% (neutral) | on track | Payments take rate: 2.66%; Take rate vs Budget: 0 bp; Take rate vs Prior year: −2 bp |
| Active merchants | 138,726 | vs Budget: −6,752 −4.6% (adverse) | vs Prior year: +19,452 +16.3% (neutral) | off track | GMV per merchant: $81.3 k |
| ARR (run-rate) | $320.0 m | vs Budget: −10.9 −3.3% (adverse) | vs Prior year: +57.4 +21.9% (neutral) | off track | Net new ARR vs prior-year end: +$57.4 m |
| Revenue mix | 37.5% / 50.3% | Sub / Pay vs PY: −1.5 pp / +2.7 pp (neutral) | — | — | Platform subscriptions: $223.4 m (+24.6% YoY); Payments: $299.6 m (+37.0% YoY) |
| FY outlook | $861.0 m | vs FY Budget: −10.8 −1.2% (adverse) | EBITDA vs FY Bud: −7.3 −6.5% (adverse) | watch | Revenue attainment: 98.8%; Adj. EBITDA, FY LE: $105.7 m; EBITDA attainment: 93.5% |

### 4.3a Analysis, Consumer Products

Net revenue bridge — Net revenue bridge:

| Step | Kind | Value (USD) | Label | Sub label |
|---|---|---:|---|---|
| Budget NR | start | 3,464,798,688.45 | $3,464.8 m |  |
| Volume | down | -64,973,368.08 | −$65.0 m | −1.9% |
| Price / mix | down | -30,818,087.80 | −$30.8 m | −0.9% |
| Constant-currency NR | subtotal | 3,369,007,232.57 | $3,369.0 m | −2.8% |
| FX | fx | 29,514,710.09 | +$29.5 m |  |
| Actual NR | end | 3,398,521,942.66 | $3,398.5 m | −1.9% |

Profit bridge: Budget Adj. EBITDA → Actual → Operating profit:

| Step | Kind | Value (USD) | Label | Sub label |
|---|---|---:|---|---|
| Budget Adj. EBITDA | start | 701,037,782.25 | $701.0 m |  |
| Revenue volume | down | -47,725,267.97 | −$47.7 m |  |
| GM rate | down | -16,667,392.03 | −$16.7 m |  |
| GM mix | up | 2,788,656.03 | +$2.8 m |  |
| Variable selling | up | 4,394,997.51 | +$4.4 m |  |
| S&M | up | 25,519,508.17 | +$25.5 m |  |
| R&D | up | 2,372,765.10 | +$2.4 m |  |
| G&A | up | 5,119,141.68 | +$5.1 m |  |
| Other operating | down | -168,954.54 | −$0.2 m |  |
| FX | fx | 5,923,695.44 | +$5.9 m |  |
| Adj. EBITDA | subtotal | 682,594,931.64 | $682.6 m | Δ −$18.4 m |
| D&A | level | -122,346,789.94 | −$122.3 m | Δ +$2.4 m |
| Adjusting items | level | -10,020,825.44 | −$10.0 m | Δ −$5.5 m |
| Operating profit | end | 550,227,316.26 | $550.2 m | Δ −$21.6 m |

Largest variances — "Largest variances vs Budget", 37 rows; columns Budget / Actual / Δ / Δ % / vs PY / of which FX. Top 10:

| Account | Line | Block | Budget | Actual | Δ | Δ % | vs PY | of which FX | Tone |
|---|---|---|---|---|---|---|---|---|---|
| GR_P1 | Gross product sales | Gross revenue | $4,371.9 m | $4,302.4 m | −$69.5 m | −1.6% | +$329.8 m | +$37.4 m | adverse |
| SM_P1 | Advertising: working media | Sales & marketing | −$240.2 m | −$222.0 m | +$18.3 m | +7.6% | −$4.2 m | −$1.9 m | ahead |
| COR_P2 | Sourced finished goods | Cost of revenue | −$466.8 m | −$452.3 m | +$14.5 m | +3.1% | −$28.4 m | −$3.9 m | ahead |
| COR_P1 | Raw materials & packaging | Cost of revenue | −$680.7 m | −$670.3 m | +$10.4 m | +1.5% | −$47.1 m | −$5.8 m | ahead |
| COR_P5 | Inbound freight, duties & tariffs | Cost of revenue | −$157.4 m | −$166.9 m | −$9.5 m | −6.0% | −$21.2 m | −$1.4 m | adverse |
| GTN_P1 | Trade promotions & retailer allowances | Gross-to-net deductions | −$475.5 m | −$480.1 m | −$4.7 m | −1.0% | −$39.4 m | −$4.2 m | adverse |
| GTN_P2 | Customer rebates, listing & slotting fees | Gross-to-net deductions | −$167.4 m | −$163.6 m | +$3.7 m | +2.2% | −$8.3 m | −$1.4 m | ahead |
| ADJ_3 | M&A, integration & other one-offs | Adjusting items (non-underlying) | −$2.3 m | −$5.7 m | −$3.4 m | n.m. | −$5.7 m | $0.0 m | adverse |
| COR_P4 | Manufacturing overhead (ex-depreciation) | Cost of revenue | −$171.0 m | −$168.1 m | +$2.9 m | +1.7% | −$11.7 m | −$1.5 m | ahead |
| COR_P7 | Inventory write-downs & obsolescence | Cost of revenue | −$51.8 m | −$54.8 m | −$2.9 m | −5.7% | −$7.5 m | −$0.5 m | adverse |
| — | **Total P&L Δ at operating profit** | | $571.8 m | $550.2 m | −$21.6 m | −3.8% | +$60.8 m | +$4.8 m | |

### 4.3b Analysis, Commerce Cloud

Net revenue bridge — Net revenue bridge:

| Step | Kind | Value (USD) | Label | Sub label |
|---|---|---:|---|---|
| Budget NR | start | 602,158,360.33 | $602.2 m |  |
| Platform subscriptions | down | -7,963,090.89 | −$8.0 m | −3.5% |
| Payments | up | 518,475.08 | +$0.5 m | +0.2% |
| Apps, partners & ads | down | -976,129.78 | −$1.0 m | −2.2% |
| Professional services | down | -2,087,717.29 | −$2.1 m | −6.5% |
| Constant-currency NR | subtotal | 591,649,897.44 | $591.6 m | −1.7% |
| FX | fx | 4,317,738.29 | +$4.3 m |  |
| Actual NR | end | 595,967,635.73 | $596.0 m | −1.0% |

Profit bridge: Budget Adj. EBITDA → Actual → Operating profit:

| Step | Kind | Value (USD) | Label | Sub label |
|---|---|---:|---|---|
| Budget Adj. EBITDA | start | 82,581,155.95 | $82.6 m |  |
| Revenue volume | down | -5,911,807.87 | −$5.9 m |  |
| GM rate | down | -1,404,974.35 | −$1.4 m |  |
| GM mix | down | -1,409,979.01 | −$1.4 m |  |
| Variable selling | down | -882,082.38 | −$0.9 m |  |
| S&M | up | 1,542,586.99 | +$1.5 m |  |
| R&D | up | 1,756,280.37 | +$1.8 m |  |
| G&A | up | 857,908.55 | +$0.9 m |  |
| Other operating | up | 58,388.47 | +$0.1 m |  |
| FX | fx | 595,681.04 | +$0.6 m |  |
| Adj. EBITDA | subtotal | 77,783,157.75 | $77.8 m | Δ −$4.8 m |
| D&A | level | -29,856,609.31 | −$29.9 m | Δ +$0.3 m |
| Adjusting items | level | -1,416,927.97 | −$1.4 m | Δ −$1.4 m |
| Operating profit | end | 46,509,620.47 | $46.5 m | Δ −$5.9 m |

Largest variances — "Largest variances vs Budget", 32 rows; columns Budget / Actual / Δ / Δ % / vs PY / of which FX. Top 10:

| Account | Line | Block | Budget | Actual | Δ | Δ % | vs PY | of which FX | Tone |
|---|---|---|---|---|---|---|---|---|---|
| GR_S1 | Subscription platform fees | Gross revenue | $249.9 m | $242.9 m | −$7.0 m | −2.8% | +$48.0 m | +$1.8 m | adverse |
| COR_S2 | Payment processing & interchange | Cost of revenue | −$169.1 m | −$172.0 m | −$2.9 m | −1.7% | −$48.4 m | −$1.2 m | adverse |
| GR_S2 | Payments & transaction fees | Gross revenue | $301.5 m | $304.3 m | +$2.8 m | +0.9% | +$82.2 m | +$2.2 m | ahead |
| GR_S4 | Professional services | Gross revenue | $33.7 m | $31.8 m | −$2.0 m | −5.9% | +$2.7 m | +$0.2 m | adverse |
| VSC_S3 | Transaction & merchant credit losses | Variable selling & cost-to-serve | −$7.9 m | −$9.4 m | −$1.5 m | −19.6% | −$3.7 m | −$0.1 m | adverse |
| COR_S5 | Professional services delivery | Cost of revenue | −$25.5 m | −$24.1 m | +$1.4 m | +5.6% | −$2.1 m | −$0.2 m | ahead |
| ADJ_1 | Restructuring & reorganisation | Adjusting items (non-underlying) | $0.0 m | −$1.4 m | −$1.4 m | n.m. | −$1.4 m | $0.0 m | adverse |
| RD_S1 | Engineering & product management | Research & development | −$80.4 m | −$79.5 m | +$0.9 m | +1.1% | −$13.7 m | −$0.6 m | ahead |
| GR_S3 | Apps, partner revenue share & ads | Gross revenue | $45.0 m | $44.3 m | −$0.7 m | −1.5% | +$8.5 m | +$0.3 m | adverse |
| COR_S1 | Cloud hosting & infrastructure | Cost of revenue | −$25.5 m | −$24.9 m | +$0.6 m | +2.3% | −$4.7 m | −$0.2 m | ahead |
| — | **Total P&L Δ at operating profit** | | $52.4 m | $46.5 m | −$5.9 m | −11.2% | +$6.7 m | +$0.4 m | |

Filtered example (Consumer Products, Channel = Grocery & mass retail; subtitle "Grocery & mass retail"), top 6 by |Δ| and the footer:

| Account | Line | Budget | Actual | Δ | alloc. |
|---|---|---|---|---|---|
| GR_P1 | Gross product sales | $1,582.0 m | $1,542.9 m | −$39.1 m |  |
| GTN_P1 | Trade promotions & retailer allowances | −$268.9 m | −$277.7 m | −$8.7 m |  |
| COR_P2 | Sourced finished goods | −$155.4 m | −$147.5 m | +$7.9 m |  |
| COR_P1 | Raw materials & packaging | −$226.0 m | −$218.4 m | +$7.6 m |  |
| SM_P1 | Advertising: working media | −$79.8 m | −$72.3 m | +$7.5 m | alloc. |
| COR_P5 | Inbound freight, duties & tariffs | −$52.3 m | −$54.4 m | −$2.1 m |  |
| — | **Total P&L Δ at operating profit** | $240.4 m | $229.0 m | −$11.4 m | |

### 4.4a Profitability, Consumer Products — "Profitability by Region", subtitle "Constant currency (FY2026 budget rates) - USD m - vs Budget"

| Region | Net revenue | Δ vs Budget % | GM % | CM % | CM Δ pp (status) | Contribution | Adj. EBITDA |
|---|---|---|---|---|---|---|---|
| North America | $1,488.6 m | −2.7% | 49.4% | 39.2% | −0.5 pp (watch) | $583.1 m | $299.4 m |
| Continental Europe | $944.1 m | −2.8% | 49.4% | 39.1% | −0.6 pp (watch) | $369.4 m | $189.4 m |
| Asia-Pacific | $518.3 m | −2.9% | 49.4% | 39.1% | −0.6 pp (watch) | $202.7 m | $104.0 m |
| UK & Ireland | $418.1 m | −2.7% | 49.4% | 39.1% | −0.6 pp (watch) | $163.6 m | $83.9 m |
| Total | $3,369.0 m | −2.8% | 49.4% | 39.1% | −0.6 pp (watch) | $1,318.8 m | $676.7 m |

Concentration (share of NR / contribution / Adj. EBITDA by region):

- Net revenue: NA 44.2%, EU 28.0%, AP 15.4%, UK 12.4%
- Contribution: NA 44.2%, EU 28.0%, AP 15.4%, UK 12.4%
- Adj. EBITDA: NA 44.3%, EU 28.0%, AP 15.4%, UK 12.4%

Trends: months Jan 2026 … Sep 2026 (9); note: none; last month values:

- North America: growth +6.0%, CM 38.6%
- Continental Europe: growth +5.5%, CM 38.5%
- Asia-Pacific: growth +5.9%, CM 38.5%
- UK & Ireland: growth +6.3%, CM 38.6%
- Company: growth +5.9%, CM 38.6%

Mix heatmap (cell NR at CC and share of the region):

| Region | HOME (GM 51.6%) | PERS (GM 59.6%) | KITC (GM 47.5%) | ELEC (GM 34.7%) | TOYS (GM 41.5%) | Total |
|---|---|---|---|---|---|---|
| NA | $418.3 m (28%) | $401.1 m (27%) | $301.0 m (20%) | $220.9 m (15%) | $147.2 m (10%) | $1,488.6 m |
| EU | $263.9 m (28%) | $254.7 m (27%) | $191.2 m (20%) | $141.3 m (15%) | $93.0 m (10%) | $944.1 m |
| AP | $146.3 m (28%) | $139.6 m (27%) | $104.5 m (20%) | $77.0 m (15%) | $50.9 m (10%) | $518.3 m |
| UK | $117.8 m (28%) | $112.0 m (27%) | $84.9 m (20%) | $62.1 m (15%) | $41.2 m (10%) | $418.1 m |
| Total | $946.3 m | $907.5 m | $681.6 m | $501.3 m | $332.3 m | $3,369.0 m |

### 4.4b Profitability, Commerce Cloud — "Profitability by Region", subtitle "Constant currency (FY2026 budget rates) - USD m - vs Budget"

| Region | Net revenue | Δ vs Budget % | GM % | CM % | CM Δ pp (status) | Contribution | Adj. EBITDA |
|---|---|---|---|---|---|---|---|
| North America | $314.4 m | −1.7% | 55.5% | 50.6% | −0.7 pp (watch) | $159.1 m | $39.2 m |
| Continental Europe | $137.5 m | −2.5% | 56.2% | 51.4% | −0.6 pp (watch) | $70.6 m | $18.9 m |
| Asia-Pacific | $78.3 m | −1.4% | 56.0% | 51.1% | −0.8 pp (watch) | $40.0 m | $10.6 m |
| UK & Ireland | $61.5 m | −1.0% | 56.2% | 51.4% | −0.6 pp (watch) | $31.6 m | $8.5 m |
| Total | $591.6 m | −1.7% | 55.8% | 50.9% | −0.7 pp (watch) | $301.4 m | $77.2 m |

Concentration (share of NR / contribution / Adj. EBITDA by region):

- Net revenue: NA 53.1%, EU 23.2%, AP 13.2%, UK 10.4%
- Contribution: NA 52.8%, EU 23.4%, AP 13.3%, UK 10.5%
- Adj. EBITDA: NA 50.8%, EU 24.5%, AP 13.7%, UK 11.0%

Trends: months Jan 2026 … Sep 2026 (9); note: none; last month values:

- North America: growth +27.3%, CM 50.2%
- Continental Europe: growth +25.5%, CM 50.9%
- Asia-Pacific: growth +31.5%, CM 50.7%
- UK & Ireland: growth +26.0%, CM 51.1%
- Company: growth +27.3%, CM 50.5%

Mix heatmap (cell NR at CC and share of the region):

| Region | SUB (GM 81.2%) | PAY (GM 38.6%) | APP (GM 70.0%) | PS (GM 17.7%) | Total |
|---|---|---|---|---|---|
| NA | $118.0 m (38%) | $157.5 m (50%) | $22.9 m (7%) | $16.0 m (5%) | $314.4 m |
| EU | $51.5 m (37%) | $69.4 m (50%) | $9.8 m (7%) | $6.9 m (5%) | $137.5 m |
| AP | $29.1 m (37%) | $39.7 m (51%) | $5.6 m (7%) | $3.9 m (5%) | $78.3 m |
| UK | $23.2 m (38%) | $30.9 m (50%) | $4.4 m (7%) | $3.1 m (5%) | $61.5 m |
| Total | $221.7 m | $297.5 m | $42.7 m | $29.8 m | $591.6 m |

### 4.5 Header texts, Consumer Products default

- Status: "Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed 28 Oct 2026 15:57" (UTC)
- Applied filter Company: "Consumer Products"
- Applied filter Fiscal year: "2026"
- Applied filter Period: "Showing Jan – Sep 2026 - year to date"
- Applied filter Time view: "Year to date"
- Applied filter Versions: "Actual vs Budget (A) and Prior year (B)"
- Applied filter Currency: "USD"
- Applied filter FX basis: "Actual rates"
- Applied filter Units: "Millions"
- Applied filter Regions: "All regions"
- Applied filter Slices: "All slices"
- Rail: Versions "Actual vs Budget, Prior year", Display "USD m - actual rates"
- Notices: none (the default selection has no notice).

## 5. Row counts and model checks

| Check | Expected |
|---|---:|
| `Fact PL` rows | 1,112,532 |
| — of which direct (IsAllocated = FALSE) | 410,112 |
| — of which allocated (IsAllocated = TRUE) | 702,420 |
| — EntityCode P | 806,820 |
| — EntityCode S | 305,712 |
| Raw `pl-P.parquet` + `pl-S.parquet` rows before allocation | 334,700 + 88,012 = 422,712 |
| Below-CM raw rows replaced by the allocation (P / S) | 6,380 / 6,220 |
| NR slice tuples per entity × version × month × region group (P / S) | 75 / 36 |
| `Fact PL` rows with ChannelCode ending in UNASSIGNED | 0 |
| Σ `Fact PL[AmountLocal]` of below-CM accounts, P (local, mixed currencies) | −7,820,642,197.81 |
| Σ `Fact PL[AmountLocal]` of below-CM accounts, S | −1,893,695,631.82 |
| `Fact Ops` rows | 26,784 |
| `Dim Month` rows / closed | 36 / 33 |
| `Dim Account` rows / with fact rows | 73 / 70 |
| `Dim Version` rows | 4 |
| `FX Factor` rows | 288 |
| `FX CC Factor` rows | 36 |
| `PL Row` rows | 86 |
| `[Last Closed Idx]` | 32 |
| `[Latest Forecast Key]` | FC2609 |

## 6. Behaviour checks (spec §10, `requirements.md`)

- T-05: each bridge reconciles — comparison + steps = end, to the unit (e.g. P: 3,464,798,688.45 − 64,973,368.08 − 30,818,087.80 + 29,514,710.09 = 3,398,521,942.66).
- T-10: FX basis = Constant currency → the NR bridge FX step and every "of which FX" are 0.
- T-11: base Actual, Full year 2026 → months Oct–Dec dropped, comparisons cover Jan–Sep, notice "Cut-off" shows.
- T-12: FY 2024 with a prior-year comparison → prior-year column n/a, notice "Prior year n/a before Jan 2024".
- T-13: a cost below budget gives a positive, green Δ; revenue below budget a negative, orange Δ (statement row GR vs SM in §4.1a).
- T-16: Hide empty lines never hides a block or subtotal; with it off, Commerce Cloud also shows the leaf rows it never books (3 of its 42 accounts have no fact rows at all), every cell 0.0.
- T-17: Active merchants = the last month of the window (Commerce Cloud YTD Sep 2026: 138,726; FY 2025: 124,291), not a sum.
- Period texts (`period.test.ts`): QTD Jul 2026 → "Showing Jul 2026 - quarter to date"; LTM Mar 2024 → "Showing Jan – Mar 2024 - last 12 months" with notices Prior year and History; QTD Nov 2026 under Actual → "Showing no closed month yet".
- Custom range Oct 2025 – Sep 2026 (time view Custom range, range start Oct 2025, FY 2026, month 9): statement title "Oct 2025 – Sep 2026 - Actual", Trends months Oct 2025 … Sep 2026.
- Custom range Jul 2024 – Jun 2025 with Compare B = Prior year: notice "Prior year n/a before Jan 2024: it covers 6 of the range's 12 months".

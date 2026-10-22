# Measure dictionary — ACME Unified P&L (Track B)

> Generated from `pbi-report/ACME Unified PnL.SemanticModel/definition/tables/_measures.tmdl` (draft, updated 2026-10-21, Ledger rebuild). Owner of every measure: **bip**. If you change a measure in Desktop, update this file in the same commit (CLAUDE.md › Track B: dictionary in lockstep with the model).

175 measures in table `_measures`; folder `9 Engine` is hidden from report authors.

| Folder | Measures | Purpose |
|---|---:|---|
| `1 Statement` | 11 | Matrix columns of the income statement (Variance layout), in the selected units |
| `1 Statement\Formatting` | 5 | Conditional-format colours for the matrix (L-12, L-13) |
| `2 Versions` | 7 | Base, comparisons, prior year, full-year outlook (D-31), unscaled |
| `2 Versions\Subtotals` | 10 | Spine subtotals of the base version (step 1-19), unscaled |
| `3 KPIs` | 6 | KPI slot measures used by the tiles and the KPI table (§5) |
| `3 KPIs\Items` | 24 | One measure per KPI formula, unscaled |
| `4 Analysis` | 11 | Net revenue bridge (C-40) and largest variances (C-45) |
| `5 Profitability` | 5 | Profitability by slice (C-46) and slice-member filter |
| `6 Context` | 5 | Header status, context line, notices, panel notes (L-01, L-04, L-05) |
| `9 Engine` | 44 | Hidden: selections, time window, translation, entity view, row logic, unscaled statement values |
| `Design` | 47 | Ledger design helpers: identity colour, header and rail texts, flyout labels, favourability inputs for rules-based colours (no engine calls except Notice Strip, CM Subtitle) |

## How the engine fits together

```text
PL Base / PL Δ A / KPI Value / Bridge Value / LV ... display layer: amounts / _Units Divisor (F-14, N-06); ratios, % and pp unscaled
  └ _PL Base / _PL Compare A ...  unscaled statement values; ratio rows: numerator line / denominator line (dim_pl_row formulas)
      └ Base Amount / Compare A / Compare B Amount   all read _Amt Window (param_eval: BASE, CMP_A, CMP_B)
          └ _Amt Window     version x window as one (version, month) filter; LE = Actual closed months + latest forecast open months
              └ _Amt Row    statement row -> one account filter: block / subtotal / leaf account (D-32)
                  └ _Amt Entity  entity view as filter tables; ACME Group = both entities + eliminations (C-36)
                      └ _Amt Raw     translation per month x currency x version (D-30)
                          └ _Local Sum   fact_pl (direct) + fact_pl_allocated (below CM) | operational metrics
```

Display units: format strings never scale (Power BI does not support trailing-comma scaling). Only measures bound to visuals divide by
`_Units Divisor`; every measure that feeds another measure, a ratio, a Δ % or a test stays unscaled.

## 1 Statement

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `PL Base` | Statement column Base in the selected units (display only; ratios unscaled). | L-07, M-01, M-03, M-22 | dynamic |
| `PL % NR` | Row value / net revenue of the same column (unscaled inputs). Blank on ratio rows. | M-12 | `0.0%;−0.0%;0.0%` |
| `PL Compare A` | Statement column Compare A in the selected units (display only). | M-13, C-03 | dynamic |
| `PL Δ A` | Base - Compare A in the selected units: positive is favourable on every line. Ratio rows in percentage points (M-11). | M-10, M-11 | dynamic |
| `PL Δ A %` | (Base - Compare A) / /Compare A/ on unscaled values. Blank on ratio rows. | M-10 | `+0.0%;−0.0%;0.0%` |
| `PL Compare B` | Statement column Compare B in the selected units (display only). | M-13, C-03 | dynamic |
| `PL Δ B` | Base - Compare B in the selected units; ratio rows in pp. | M-10, M-11 | dynamic |
| `PL Δ B %` | (Base - Compare B) / /Compare B/ on unscaled values. Blank on ratio rows. | M-10 | `+0.0%;−0.0%;0.0%` |
| `PL FY Budget` | Full-year budget column in the selected units (display only). | M-14 | dynamic |
| `PL FY LE` | Full-year latest estimate column in the selected units (display only). | M-14 | dynamic |
| `PL Δ LE vs Budget` | Full-year LE - full-year budget in the selected units; ratio rows in pp. | M-14 | dynamic |

## 1 Statement\Formatting

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `PL Row Back Color` | Row shading (Ledger): key subtotals (net revenue, Adjusted EBITDA, operating profit, net profit) in the company tint [_AccT], subtotals and memo rows Subtle #F6F8FA; leaves, blocks and groups white. | L-13 | — |
| `PL Value Font Color` | Ratio rows in muted grey (italics are not available conditionally). | L-13 | — |
| `PL Δ A Color` | Font colour for the PL Δ A column: green when favourable (positive on signed values), red when unfavourable; the effective tax rate row is never coloured. | L-12, M-11, N-07 | — |
| `PL Δ B Color` | Font colour for the PL Δ B column: green when favourable (positive on signed values), red when unfavourable; the effective tax rate row is never coloured. | L-12, M-11, N-07 | — |
| `PL Δ LE Color` | Font colour for the PL Δ LE vs Budget column: green when favourable (positive on signed values), red when unfavourable; the effective tax rate row is never coloured. | L-12, M-11, N-07 | — |

## 2 Versions

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Base Amount` | Base version amount over the window, in the reporting currency, unscaled. Row-aware on the statement. Re-evaluates as Compare A / B when param_eval is overridden (used for KPI deltas). | D-31, K-20 | `#,0;-#,0;0` |
| `Compare A Amount` | Compare A version over exactly the months the base covers; Prior year shifts them 12 months back (Actual). Blank when Compare A = None or no data (n/a). Unscaled. | F-06, C-03, C-04 | `#,0;-#,0;0` |
| `Compare B Amount` | Compare B version over exactly the months the base covers; Prior year shifts them 12 months back (Actual). Unscaled. | F-07, C-03, C-04 | `#,0;-#,0;0` |
| `PY Amount` | Prior year: Actual over the base months shifted back 12. Blank for the first data year. | C-04 | `#,0;-#,0;0` |
| `FY Budget Amount` | Budget for the whole selected fiscal year, whatever the time view. | M-14, C-05 | `#,0;-#,0;0` |
| `FY LE Amount` | Latest estimate for the whole selected fiscal year. | M-14, C-02 | `#,0;-#,0;0` |
| `Bridge Comparison Amount` | Comparison used by the bridge and largest variances: Compare A, else Compare B, else prior year. One evaluation. Unscaled. | C-40, C-45 | `#,0;-#,0;0` |

## 2 Versions\Subtotals

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Gross Revenue` | Gross revenue (step 1), base version and window. | §3 step 1 | `#,0;-#,0;0` |
| `Gross-to-Net Deductions` | Gross-to-net deductions (step 2, negative). | §3 step 2 | `#,0;-#,0;0` |
| `Net Revenue` | Net revenue = gross revenue + gross-to-net deductions (step 3). | §3 step 3, K-01 | `#,0;-#,0;0` |
| `Gross Profit` | Gross profit = net revenue + cost of revenue (step 5). | §3 step 5 | `#,0;-#,0;0` |
| `Contribution Margin` | Contribution margin = gross profit + variable selling & cost-to-serve (step 7). | §3 step 7 | `#,0;-#,0;0` |
| `Adjusted EBITDA` | Adjusted EBITDA = contribution margin + operating expenses (step 9, MPM). | §3 step 9, K-07 | `#,0;-#,0;0` |
| `Operating Profit` | Operating profit (step 13, IFRS 18 required subtotal). | §3 step 13, K-08 | `#,0;-#,0;0` |
| `Profit Before Tax` | Profit before tax (step 17). | §3 step 17 | `#,0;-#,0;0` |
| `Income Tax` | Income tax expense (step 18, negative). | §3 step 18 | `#,0;-#,0;0` |
| `Net Profit` | Net profit for the period (step 19). | §3 step 19 | `#,0;-#,0;0` |

## 3 KPIs

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `KPI Value` | Value of the KPI tile in the current dim_kpi row, amounts and counts in the selected units (display only). | §5 K-01..K-12 | dynamic |
| `KPI Secondary` | Tile sub-line: reported growth incl. FX for organic growth, margin for the amount tiles. | K-02, K-07, K-08, K-11 | — |
| `KPI Δ A` | KPI vs Compare A: percent KPIs in percentage points, amount KPIs in %. | K-20 | dynamic |
| `KPI Δ B` | KPI vs Compare B: percent KPIs in percentage points, amount KPIs in %. | K-20 | dynamic |
| `KPI Δ A Color` | Colour of KPI Δ A following dim_kpi.better_when; Neutral KPIs are never coloured. | K-21, N-07 | — |
| `KPI Δ B Color` | Colour of KPI Δ B following dim_kpi.better_when; Neutral KPIs are never coloured. | K-21, N-07 | — |

## 3 KPIs\Items

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `KPI Organic Growth` | NR at constant currency / prior-year NR at the same rates, same months - 1. | K-02 | `+0.0%;-0.0%;0.0%` |
| `KPI Reported Growth` | Reported NR growth vs prior year including FX (tile sub-line). | K-02 | `+0.0%;-0.0%;0.0%` |
| `KPI Gross Margin %` | Gross profit / net revenue. | K-03 | `0.0%` |
| `KPI Gross-to-Net %` | - gross-to-net deductions / gross revenue. | K-04 (Products) | `0.0%` |
| `KPI ARR` | Subscription (Platform subscriptions) net revenue of the last month in the window x 12. | K-04 (Services), K-23 | `#,0;-#,0;0` |
| `KPI Services Share` | Commerce Cloud NR after eliminations / group NR (Group view). | K-04 (Group) | `0.0%` |
| `KPI A&P % NR` | - (Advertising: working media + Consumer promotions, sampling & sponsorship) / net revenue. | K-05 (Products) | `0.0%` |
| `KPI GMV` | GMV processed, translated like amounts (local currency at source). | K-09 (Services) | `#,0;-#,0;0` |
| `KPI Payments Take Rate` | Payments net revenue / GMV processed. | K-05 (Services) | `0.00%` |
| `KPI IC Eliminated` | Fees billed by Commerce Cloud to Consumer Products in the window (Group view), positive. | K-05 (Group), C-36 | `#,0;-#,0;0` |
| `KPI CM %` | Contribution margin / net revenue. | K-06 | `0.0%` |
| `KPI Adj EBITDA Margin` | Adjusted EBITDA / net revenue. | K-07 | `0.0%` |
| `KPI Operating Margin` | Operating profit / net revenue. | K-08 | `0.0%` |
| `KPI Net Margin` | Net profit / net revenue. | K-11 (Group) | `0.0%` |
| `KPI Units Sold` | Units sold (a flow: sums over the window). | K-09 (Products) | `#,0` |
| `KPI NR per Unit` | Net revenue / units sold. | K-10 (Products) | `#,0.00` |
| `KPI Active Merchants` | Merchants with an active paid plan at the last month-end of the window (never a sum over months). | K-10 (Services), K-23, T-17 | `#,0` |
| `KPI Effective Tax Rate` | - income tax / profit before tax. | K-12 (Group), §3 step 18 | `0.0%` |
| `KPI Subscription GM %` | Gross profit / NR for the Platform subscriptions service line. | K-11 (Services) | `0.0%` |
| `KPI Rule of 40` | Organic growth % + Adjusted EBITDA margin %. | K-12 (Services) | `0.0%` |
| `KPI CP Operating Margin` | Consumer Products standalone operating margin. | K-09 (Group) | `0.0%` |
| `KPI CC Operating Margin` | Commerce Cloud standalone operating margin. | K-10 (Group) | `0.0%` |
| `KPI Volume Growth` | Bridge volume vs prior year / prior-year NR at constant currency. | K-11 (Products) | `+0.0%;-0.0%;0.0%` |
| `KPI Price Mix` | Bridge price / mix vs prior year / prior-year NR at constant currency. | K-12 (Products) | `+0.0%;-0.0%;0.0%` |

## 4 Analysis

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Bridge Comparison NR` | Net revenue of the bridge comparison (actual rates). | C-40 | `#,0;-#,0;0` |
| `Bridge Volume` | Consumer Products volume step, per lowest slice k (region x channel x category x tier): (U base - U comparison) x NRcc comparison / U comparison. A slice without comparison units counts entirely as volume. | C-40, K-11 | `#,0;-#,0;0` |
| `Bridge Price Mix` | Consumer Products price / mix step = NR change at constant currency - volume (so steps add up exactly). | C-40, K-12 | `#,0;-#,0;0` |
| `Bridge FX` | FX = (NR base - NRcc base) - (NR comparison - NRcc comparison). Zero at constant currency. | C-40, T-10 | `#,0;-#,0;0` |
| `Bridge Value` | Waterfall value per dim_bridge_step in the selected units (display only). | C-40, T-05 | dynamic |
| `LV Base` | Base amount of the leaf line (account) in the current row, in the selected units (display only). | C-45 | dynamic |
| `LV Comparison` | Bridge-comparison amount of the leaf line, in the selected units (display only). | C-45 | dynamic |
| `LV Δ` | Base - comparison on signed values (positive = favourable), in the selected units (display only). | C-45, M-10 | dynamic |
| `LV Δ %` | (Base - comparison) / /comparison/ on unscaled values. | C-45 | `+0.0%;−0.0%;0.0%` |
| `LV Abs Δ` | /base - comparison/, unscaled — ranks the top 8 leaf lines (TopN filter of the variances table). | C-45 | `#,0;-#,0;0` |
| `LV Δ Color` | Green favourable / red unfavourable for the variances table (sign of base - comparison). | L-12, N-07 | — |

## 5 Profitability

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Prof NR Share` | Share of total net revenue across the visible slice values. | C-46 | `0.0%` |
| `Prof NR Δ %` | Net revenue growth vs the bridge comparison. | C-46 | `+0.0%;−0.0%;0.0%` |
| `Prof NR Δ Color` | Green / red for net revenue growth. | L-12, N-07 | — |
| `Slice Member In View` | 1 when the slice value in context belongs to the selected entity (unassigned members excluded). Region always; entity rows only in the Group view; channel / category / segment never in the Group view. Used as visual-level filter on slicers and the profitability table. | F-09..F-11, F-21, F-32 | `0` |
| `Prof Net Revenue` | Net revenue of the slice in the selected units (display only; the profitability table column). | C-46, F-14, N-06 | dynamic |

## 6 Context

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Data Status` | Header data status: last closed month and last refresh time. | L-01, N-02, N-03 | — |
| `Context Line` | Plain-text context: entity, window with actual months, base vs comparisons, currency / units / FX basis, active slices. | L-04, F-36 | — |
| `Notices` | Notices shown only when they apply: past the close, forecast months included, prior year missing, LTM before history, slice allocation on, group eliminations. | L-05, C-50 | — |
| `Slice Panel Note` | Note in the Slice pop-up: why slices are off in the Group view, or the allocation rule. | F-32, C-31 | — |
| `Profitability Note` | Hint above the profitability table. | C-46, F-21 | — |

## 9 Engine

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `_Last Closed Index` | Month index of the last closed month (dim_month.is_closed, set by finance). | N-03, C-01 | — |
| `_Sel Entity` | Selected entity view code: P, S or GROUP (default Consumer Products). | F-01 | — |
| `_Sel FY` | Selected fiscal year; defaults to the fiscal year of the last closed month. | F-02 | — |
| `_Sel Month` | Selected period (month number 1-12); defaults to the last closed month. | F-03 | — |
| `_Sel Time View` | Selected time view code: MTD, QTD, YTD, LTM or FY (default YTD). | F-04 | — |
| `_Sel Base Version` | Selected base version: A (Actual), LE or B (default Actual). | F-05 | — |
| `_Sel Compare A` | Selected Compare A version: B, LE, PY or NONE (default Budget). | F-06 | — |
| `_Sel Compare B` | Selected Compare B version: B, LE, PY or NONE (default Prior year). | F-07 | — |
| `_Sel Currency` | Selected reporting currency (default USD). | F-12 | — |
| `_Sel FX Basis` | Selected FX basis: ACT (actual rates) or CC (constant currency, default ACT). | F-13 | — |
| `_Sel Units` | Selected display units: M or K (default M). Display only: values stay unscaled. | F-14 | — |
| `_Sel Metric` | Hidden switch that lets one engine sum P&L amounts, units, GMV or month-end merchants. Measures override it with TREATAS; never shown on a slicer. | D-03 | — |
| `_Sel Eval` | Hidden switch that re-evaluates any KPI as Compare A or Compare B (Base Amount reads it). Never on a slicer. | K-20 | — |
| `_Anchor Index` | Month index of the selected fiscal year and period (anchor m of year y). | §7 Time windows | — |
| `_Win Start` | First month index of the window: Month m, QTD, YTD, LTM (m-11, may cross years) or Full year. | §7 Time windows | — |
| `_Win End Raw` | Last month index of the window before the close cut-off (Dec for Full year). | §7 Time windows | — |
| `_Win End` | Last month index the base covers: Actual never runs past the last close; comparisons reuse these months. | C-01, C-03 | — |
| `_Local Sum` | Local-currency sum for the current filter context. P&L: direct accounts from fact_pl plus below-CM accounts from fact_pl_allocated (never fact_pl's _UNASSIGNED rows). Other metrics read fact_operational. | D-01, D-02, D-03 | — |
| `_Amt Raw` | Translates month by month and currency by currency before summing: local / local_per_usd x rate of the reporting currency, same month and rate type. Actual and forecast use ACTUAL_AVG, budget uses BUDGET; constant currency uses the BUDGET rate of the selected fiscal year for every version. Units and merchants are not translated. | D-30, C-10, C-11, C-12, C-13 | — |
| `_Elim Amount` | Group eliminations: minus the counterparty-tagged amounts of every block whose elimination account (ELIM_GR, ELIM_VSC) is in the current account filter. A leaf like GR_S1 gets no elimination; block GR, net revenue and every subtotal below do. Contribution margin and below are unchanged (T-02). | C-35, C-36, D-33 | — |
| `_Amt Entity` | Applies the entity view in one evaluation. Consumer Products / Commerce Cloud: that entity only; a slice selection that holds only the other entity's values is ignored (it comes back when you switch back). ACME Group: both entities plus eliminations, channel / category / segment filters off. Entity and slices are passed as filter tables, so no branch evaluates the engine twice. | F-01, C-36, F-30, F-32 | — |
| `_Amt Row` | Statement row logic as one account filter. Without a dim_pl_row filter it passes through. Input block: its accounts. Group total (OPEX): its child blocks. Subtotal / memo: every input block above it (signed sums, M-01), which equals the dim_report_line formula. Leaf: the account. Ratio rows get no accounts (handled one level up in the PL measures). | D-32, M-01, M-03 | — |
| `_Amt Actual` | Version Actual (ACT) for the current months. | C-01, D-31 | — |
| `_Amt Budget` | Version Budget (BUD) for the current months. | C-05, D-31 | — |
| `_Amt LE` | Latest estimate: Actual for closed months plus the latest forecast (is_latest_forecast) for open months. | C-02, D-31 | — |
| `_NR CC Base` | Net revenue of the base at constant currency. | C-12, C-40 | `#,0;-#,0;0` |
| `_PY NR CC` | Prior-year net revenue at the selected year's budget rates. | C-12, K-02 | `#,0;-#,0;0` |
| `_Units Base` | Units sold for the base version and window. | K-09 (Products) | `#,0` |
| `_NR CC Bridge Cmp` | Net revenue of the bridge comparison at constant currency. | C-40 | `#,0;-#,0;0` |
| `_Units Bridge Cmp` | Units of the bridge comparison. | C-40 | `#,0` |
| `_Bridge NR CC Change` | Change in net revenue at constant currency (base - comparison). | C-40 | `#,0;-#,0;0` |
| `_Units Divisor` | Divisor of the selected display units (1,000,000 for Millions, 1,000 for Thousands). Used only by display measures bound to visuals; engine measures, ratios and Δ % stay unscaled. | F-14, N-06 | — |
| `_PL Is Ratio` | TRUE on a statement ratio row (not on leaves). | M-11 | — |
| `_Amt Window` | Version over the window in one evaluation, read from param_eval: BASE = base version over the base window; CMP_A / CMP_B = that comparison over the months the base covers (Prior year: shifted 12 back, Actual). The version is a (version, month) filter: Actual / Prior year = ACT, Budget = BUD, Latest estimate = ACT on closed months + latest forecast on open months. Blank when the comparison is None. | C-01..C-05, D-31 | — |
| `_PL Base` | Statement Base, unscaled. Ratio rows divide their numerator line by net revenue (ETR: -tax / PBT). Blocks and subtotals show 0 instead of blank so they never hide (M-22, T-16). | L-07, M-01, M-03, M-22 | — |
| `_PL Compare A` | Statement Compare A (same months as the base), unscaled. | M-13, C-03 | — |
| `_PL Compare B` | Statement Compare B (same months as the base), unscaled. | M-13, C-03 | — |
| `_PL FY Budget` | Full-year budget of the selected fiscal year, unscaled. | M-14 | — |
| `_PL FY LE` | Full-year latest estimate of the selected fiscal year, unscaled. | M-14 | — |
| `_PL Δ A` | Base - Compare A on signed values, unscaled: positive is favourable on every line. Ratio rows in percentage points. | M-10, M-11 | — |
| `_PL Δ B` | Base - Compare B on signed values, unscaled; ratio rows in pp. | M-10, M-11 | — |
| `_PL Δ LE` | Full-year LE - full-year budget, unscaled; ratio rows in pp. | M-14 | — |
| `_Bridge Value` | Unscaled waterfall value per dim_bridge_step: comparison NR, then the entity's steps. Comparison + steps = base NR (T-05). | C-40, T-05 | — |
| `_KPI Value` | Unscaled value of the KPI tile in the current dim_kpi row (slots swap content by entity). Feeds KPI Δ A / Δ B. | §5 K-01..K-12 | — |

## Design

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `_Acc` | Identity colour of the selected company (acc): Products blue, Cloud violet, Group graphite. Drives fx on brand mark, tabs, selected controls, Done buttons. | L-10, F-01 | — |
| `_AccT` | Identity tint of the selected company (accT): selected controls and key subtotal rows. | L-10, L-13 | — |
| `Ent Card Acc` | Company card accent: each card item's own identity colour (per item of param_entity_view). | F-01 | — |
| `Ent Card Sub` | Company card sub-label (Label role of the company slicer, F-01). | F-01 | — |
| `_Base Name` | Display name of the base version. | L-04 | — |
| `_Cmp A Name` | Display name of Compare A; blank when None. | L-04 | — |
| `_Cmp B Name` | Display name of Compare B; blank when None. | L-04 | — |
| `_Bridge Cmp Name` | Display name of the comparison used by the bridge and largest variances: Compare A, else Compare B, else prior year. | C-40, C-45 | — |
| `_Units Short` | Currency and unit letter, e.g. USD m. | F-14 | — |
| `_Units Long` | Currency and unit word, e.g. USD millions. | F-14 | — |
| `_Window Label` | Time window as text, e.g. YTD Jan–Sep 2026 (months the base covers). | L-04 | — |
| `Hdr Eyebrow` | Header eyebrow with the data status (N-02, N-03): last closed month. | L-01, N-02, N-03 | — |
| `Rail Sum Period` | Rail summary of the Period group, e.g. YTD · Sep 2026. | F-02..F-04 | — |
| `Rail Sum Versions` | Rail summary of the Versions group, e.g. Actual vs Budget, Prior year. | F-05..F-07 | — |
| `Rail Sum Slice` | Rail summary of the Slice group: All slices, filtered regions / slices, or consolidated in the Group view. | F-08..F-11, F-32 | — |
| `Rail Sum Display` | Rail summary of the Display group, e.g. USD m · actual rates. | F-12..F-14 | — |
| `Hdr Context` | Header context line (L-04): window · versions · currency, units and FX basis · slices. | L-04 | — |
| `Notice Strip` | Notice strip text (L-05, C-50): full-year outlook basis, Commerce Cloud intercompany revenue, then the conditional notices. | L-05, C-50 | — |
| `Seg Label` | Short label of a segmented-control item (Label role of the button slicers): versions, FX basis, units, time view, breakdown. | F-03..F-07, F-12..F-14, F-21 | — |
| `Version Desc` | One-line description of each base-version card in the Versions flyout (Label role). | F-05 | — |
| `Month Item Fill` | Month button fill in the Period flyout: open months (after the last close) in Subtle, closed months white. | F-03 | — |
| `Month Item Font` | Month button text colour in the Period flyout: open months Slate 600, closed months Ink 900. | F-03 | — |
| `_Slice Sub` | Slice flyout subtitle: which slices apply to the selected company. | F-08..F-11, F-32 | — |
| `Slice Hdr Region` | Region group label with its count in the Slice flyout, e.g. Region · All 4. | F-08 | — |
| `Slice Hdr Channel` | Channel / sales motion group label with its count; blank in the Group view. | F-09 | — |
| `Slice Hdr Line` | Category / service line group label with its count; blank in the Group view. | F-10 | — |
| `Slice Hdr Segment` | Price tier / customer segment group label with its count; blank in the Group view. | F-11 | — |
| `Slice Group Notice` | Group-view notice in the Slice flyout (F-32, T-15); blank for a single company. | F-32, T-15 | — |
| `Slice Notice Fill` | Fill of the Group-view notice box: notice tint in the Group view, white otherwise. | F-32 | — |
| `Slice Notice Rule` | Border of the Group-view notice box: notice border in the Group view, white otherwise. | F-32 | — |
| `_Breakdown Short` | Short, company-specific name of the profitability breakdown in context (default Channel). | F-21 | — |
| `Breakdown Allowed` | 1 when the breakdown option applies to the selected company: Region or Entity in the Group view, the four slices otherwise. Visual filter of the breakdown slicer. | F-21 | — |
| `PL Notes` | Statement notes column: company-specific secondary label (L-11) and classification tags (L-14) on line rows; blank on leaves. | L-11, L-14 | — |
| `PL Hdr Base` | Statement column-group title over Base and % NR, e.g. YTD Sep 2026 · Actual. | L-07 | — |
| `PL Hdr Cmp A` | Statement column-group title over Compare A (also the KPI tile label), e.g. vs Budget. | L-07, K-20 | — |
| `PL Hdr Cmp B` | Statement column-group title over Compare B (also the KPI tile label), e.g. vs Prior year. | L-07, K-20 | — |
| `PL Hdr FY` | Statement column-group title over the full-year columns, e.g. Full year 2026. | L-07 | — |
| `Kpi Toolbar Caption` | Key figures toolbar caption, e.g. Changes vs Budget and Prior year, same months. | L-06, K-20 | — |
| `Bridge Subtitle` | Net revenue bridge subtitle: comparison to base, units and the company-specific method note. | C-40 | — |
| `Var Title` | Largest variances card title, e.g. Largest variances vs Budget. | C-45 | — |
| `Var Subtitle` | Largest variances card subtitle, e.g. Top 8 lines by size of Δ, USD millions. | C-45 | — |
| `Prof Title` | Profitability table title, e.g. Profitability by channel. | C-46 | — |
| `Prof Subtitle` | Profitability table subtitle, e.g. YTD Jan–Sep 2026, USD millions. | C-46 | — |
| `CM Title` | Contribution margin chart title, e.g. Contribution margin by channel. | C-46 | — |
| `CM Subtitle` | Contribution margin chart subtitle with the company average CM % (the dashed line). | C-46 | — |
| `KPI Fav Sign` | Favourability sign of the KPI tile in context from dim_kpi.better_when: 1 higher is better, -1 lower is better, 0 neutral; blank without a KPI row, so it never adds tiles. No engine call; input of the rules that colour the tile deltas. | K-20, N-07 | — |
| `PL Fav Off` | 1 on the effective tax rate ratio row, whose deltas are never coloured; blank elsewhere. No engine call; input of the rules that colour the statement deltas. | L-12, N-07 | — |

## DAX

### PL Base

Folder `1 Statement` · spec L-07, M-01, M-03, M-22

```dax
PL Base =
VAR _value        = [_PL Base]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"0.0%"
        ,_units = "K"
            ,"#,0;−#,0;0"
        ,"#,0.0;−#,0.0;0.0"
    )
```

### PL % NR

Folder `1 Statement` · spec M-12

```dax
PL % NR =
IF (
    [_PL Is Ratio]
    ,BLANK ()
    ,DIVIDE (
        [_PL Base]
        ,CALCULATE (
            [Base Amount]
            ,REMOVEFILTERS ( dim_pl_row )
            ,dim_pl_row[line_code] = "NR"
        )
    )
)
```

### PL Compare A

Folder `1 Statement` · spec M-13, C-03

```dax
PL Compare A =
VAR _value        = [_PL Compare A]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"0.0%"
        ,_units = "K"
            ,"#,0;−#,0;0"
        ,"#,0.0;−#,0.0;0.0"
    )
```

### PL Δ A

Folder `1 Statement` · spec M-10, M-11

```dax
PL Δ A =
VAR _value        = [_PL Δ A]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"+0.0"" pp"";−0.0"" pp"";0.0"" pp"""
        ,_units = "K"
            ,"+#,0;−#,0;0"
        ,"+#,0.0;−#,0.0;0.0"
    )
```

### PL Δ A %

Folder `1 Statement` · spec M-10

```dax
PL Δ A % =
VAR _compare      = [_PL Compare A]
RETURN
    IF (
        [_PL Is Ratio] || ISBLANK ( _compare )
        ,BLANK ()
        ,DIVIDE ( [_PL Base] - _compare, ABS ( _compare ) )
    )
```

### PL Compare B

Folder `1 Statement` · spec M-13, C-03

```dax
PL Compare B =
VAR _value        = [_PL Compare B]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"0.0%"
        ,_units = "K"
            ,"#,0;−#,0;0"
        ,"#,0.0;−#,0.0;0.0"
    )
```

### PL Δ B

Folder `1 Statement` · spec M-10, M-11

```dax
PL Δ B =
VAR _value        = [_PL Δ B]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"+0.0"" pp"";−0.0"" pp"";0.0"" pp"""
        ,_units = "K"
            ,"+#,0;−#,0;0"
        ,"+#,0.0;−#,0.0;0.0"
    )
```

### PL Δ B %

Folder `1 Statement` · spec M-10

```dax
PL Δ B % =
VAR _compare      = [_PL Compare B]
RETURN
    IF (
        [_PL Is Ratio] || ISBLANK ( _compare )
        ,BLANK ()
        ,DIVIDE ( [_PL Base] - _compare, ABS ( _compare ) )
    )
```

### PL FY Budget

Folder `1 Statement` · spec M-14

```dax
PL FY Budget =
VAR _value        = [_PL FY Budget]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"0.0%"
        ,_units = "K"
            ,"#,0;−#,0;0"
        ,"#,0.0;−#,0.0;0.0"
    )
```

### PL FY LE

Folder `1 Statement` · spec M-14

```dax
PL FY LE =
VAR _value        = [_PL FY LE]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"0.0%"
        ,_units = "K"
            ,"#,0;−#,0;0"
        ,"#,0.0;−#,0.0;0.0"
    )
```

### PL Δ LE vs Budget

Folder `1 Statement` · spec M-14

```dax
PL Δ LE vs Budget =
VAR _value        = [_PL Δ LE]
RETURN
    IF ( [_PL Is Ratio], _value, DIVIDE ( _value, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    SWITCH (
        TRUE ()
        ,[_PL Is Ratio]
            ,"+0.0"" pp"";−0.0"" pp"";0.0"" pp"""
        ,_units = "K"
            ,"+#,0;−#,0;0"
        ,"+#,0.0;−#,0.0;0.0"
    )
```

### PL Row Back Color

Folder `1 Statement\Formatting` · spec L-13

```dax
PL Row Back Color =
VAR _is_leaf      = ISINSCOPE ( dim_pl_row[account_label] )
VAR _type         = SELECTEDVALUE ( dim_pl_row[row_type] )
VAR _is_key       = SELECTEDVALUE ( dim_pl_row[is_key] )
RETURN
    SWITCH (
        TRUE ()
        ,_is_leaf
            ,BLANK ()
        ,_is_key = TRUE ()
            ,[_AccT]
        ,_type IN { "subtotal", "memo" }
            ,"#F6F8FA"
        ,BLANK ()
    )
```

### PL Value Font Color

Folder `1 Statement\Formatting` · spec L-13

```dax
PL Value Font Color =
VAR _is_leaf      = ISINSCOPE ( dim_pl_row[account_label] )
VAR _is_ratio     = NOT _is_leaf && SELECTEDVALUE ( dim_pl_row[row_type] ) = "ratio"
RETURN
    IF ( _is_ratio, "#4F5C6C" )
```

### PL Δ A Color

Folder `1 Statement\Formatting` · spec L-12, M-11, N-07

```dax
PL Δ A Color =
VAR _line         = SELECTEDVALUE ( dim_pl_row[line_code] )
VAR _delta        = [_PL Δ A]
RETURN
    SWITCH (
        TRUE ()
        ,_line = "ETR_PCT"
            ,BLANK ()
        ,_delta > 0
            ,"#06603F"
        ,_delta < 0
            ,"#C2410C"
        ,BLANK ()
    )
```

### PL Δ B Color

Folder `1 Statement\Formatting` · spec L-12, M-11, N-07

```dax
PL Δ B Color =
VAR _line         = SELECTEDVALUE ( dim_pl_row[line_code] )
VAR _delta        = [_PL Δ B]
RETURN
    SWITCH (
        TRUE ()
        ,_line = "ETR_PCT"
            ,BLANK ()
        ,_delta > 0
            ,"#06603F"
        ,_delta < 0
            ,"#C2410C"
        ,BLANK ()
    )
```

### PL Δ LE Color

Folder `1 Statement\Formatting` · spec L-12, M-11, N-07

```dax
PL Δ LE Color =
VAR _line         = SELECTEDVALUE ( dim_pl_row[line_code] )
VAR _delta        = [_PL Δ LE]
RETURN
    SWITCH (
        TRUE ()
        ,_line = "ETR_PCT"
            ,BLANK ()
        ,_delta > 0
            ,"#06603F"
        ,_delta < 0
            ,"#C2410C"
        ,BLANK ()
    )
```

### Base Amount

Folder `2 Versions` · spec D-31, K-20

```dax
Base Amount =
[_Amt Window]
```

### Compare A Amount

Folder `2 Versions` · spec F-06, C-03, C-04

```dax
Compare A Amount =
CALCULATE (
    [_Amt Window]
    ,REMOVEFILTERS ( param_eval )
    ,TREATAS ( { "CMP_A" }, param_eval[eval_code] )
)
```

### Compare B Amount

Folder `2 Versions` · spec F-07, C-03, C-04

```dax
Compare B Amount =
CALCULATE (
    [_Amt Window]
    ,REMOVEFILTERS ( param_eval )
    ,TREATAS ( { "CMP_B" }, param_eval[eval_code] )
)
```

### PY Amount

Folder `2 Versions` · spec C-04

```dax
PY Amount =
VAR _start        = [_Win Start] - 12
VAR _end          = [_Win End] - 12
RETURN
    CALCULATE (
        [_Amt Actual]
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] >= _start && dim_month[month_index] <= _end
    )
```

### FY Budget Amount

Folder `2 Versions` · spec M-14, C-05

```dax
FY Budget Amount =
VAR _fiscal_year  = [_Sel FY]
RETURN
    CALCULATE (
        [_Amt Budget]
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fiscal_year
    )
```

### FY LE Amount

Folder `2 Versions` · spec M-14, C-02

```dax
FY LE Amount =
VAR _fiscal_year  = [_Sel FY]
RETURN
    CALCULATE (
        [_Amt LE]
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fiscal_year
    )
```

### Bridge Comparison Amount

Folder `2 Versions` · spec C-40, C-45

```dax
Bridge Comparison Amount =
VAR _compare_a    = [_Sel Compare A]
VAR _compare_b    = [_Sel Compare B]
VAR _use_b        = _compare_a = "NONE" && _compare_b <> "NONE"
VAR _choice_a     = IF ( _compare_a = "NONE" && _compare_b = "NONE", "PY", _compare_a )
RETURN
    CALCULATE (
        [_Amt Window]
        ,REMOVEFILTERS ( param_eval )
        ,TREATAS ( { IF ( _use_b, "CMP_B", "CMP_A" ) }, param_eval[eval_code] )
        ,REMOVEFILTERS ( param_compare_a )
        ,TREATAS ( { _choice_a }, param_compare_a[choice_code] )
    )
```

### Gross Revenue

Folder `2 Versions\Subtotals` · spec §3 step 1

```dax
Gross Revenue =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "GR"
)
```

### Gross-to-Net Deductions

Folder `2 Versions\Subtotals` · spec §3 step 2

```dax
Gross-to-Net Deductions =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "GTN"
)
```

### Net Revenue

Folder `2 Versions\Subtotals` · spec §3 step 3, K-01

```dax
Net Revenue =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NR"
)
```

### Gross Profit

Folder `2 Versions\Subtotals` · spec §3 step 5

```dax
Gross Profit =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "GP"
)
```

### Contribution Margin

Folder `2 Versions\Subtotals` · spec §3 step 7

```dax
Contribution Margin =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "CM"
)
```

### Adjusted EBITDA

Folder `2 Versions\Subtotals` · spec §3 step 9, K-07

```dax
Adjusted EBITDA =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "EBITDA"
)
```

### Operating Profit

Folder `2 Versions\Subtotals` · spec §3 step 13, K-08

```dax
Operating Profit =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "OP"
)
```

### Profit Before Tax

Folder `2 Versions\Subtotals` · spec §3 step 17

```dax
Profit Before Tax =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "PBT"
)
```

### Income Tax

Folder `2 Versions\Subtotals` · spec §3 step 18

```dax
Income Tax =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "TAX"
)
```

### Net Profit

Folder `2 Versions\Subtotals` · spec §3 step 19

```dax
Net Profit =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NP"
)
```

### KPI Value

Folder `3 KPIs` · spec §5 K-01..K-12

```dax
KPI Value =
VAR _value        = [_KPI Value]
RETURN
    IF (
        SELECTEDVALUE ( dim_kpi[value_type] ) IN { "AMT", "CNT" }
        ,DIVIDE ( _value, [_Units Divisor] )
        ,_value
    )
```

Format string (dynamic):

```dax
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
VAR _symbol       = SELECTEDVALUE ( param_reporting_currency[symbol], "$" )
VAR _units        = [_Sel Units]
VAR _q            = """"
VAR _number       = IF ( _units = "K", "#,0", "#,0.0" )
VAR _suffix       = _q & IF ( _units = "K", " k", " m" ) & _q
RETURN
    SWITCH (
        _type
        ,"AMT"
            ,_q & _symbol & _q & _number & _suffix
        ,"PCT"
            ,"0.0%"
        ,"PCT2"
            ,"0.00%"
        ,"CNT"
            ,_number & _suffix
        ,"INT"
            ,"#,0"
        ,"PRICE"
            ,_q & _symbol & _q & "#,0.00"
        ,"#,0.0"
    )
```

### KPI Secondary

Folder `3 KPIs` · spec K-02, K-07, K-08, K-11

```dax
KPI Secondary =
VAR _kpi          = SELECTEDVALUE ( dim_kpi[kpi_code] )
RETURN
    SWITCH (
        _kpi
        ,"ORG_GROWTH"
            ,"Reported " & FORMAT ( [KPI Reported Growth], "+0.0%;-0.0%" )
        ,"EBITDA"
            ,"Margin " & FORMAT ( [KPI Adj EBITDA Margin], "0.0%" )
        ,"OP"
            ,"Margin " & FORMAT ( [KPI Operating Margin], "0.0%" )
        ,"NP"
            ,"Margin " & FORMAT ( [KPI Net Margin], "0.0%" )
    )
```

### KPI Δ A

Folder `3 KPIs` · spec K-20

```dax
KPI Δ A =
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
VAR _value        = [_KPI Value]
VAR _compare      =
    CALCULATE (
        [_KPI Value]
        ,REMOVEFILTERS ( param_eval )
        ,TREATAS ( { "CMP_A" }, param_eval[eval_code] )
    )
RETURN
    SWITCH (
        TRUE ()
        ,[_Sel Compare A] = "NONE" || ISBLANK ( _compare ) || ISBLANK ( _value )
            ,BLANK ()
        ,_type IN { "PCT", "PCT2" }
            ,( _value - _compare ) * 100
        ,DIVIDE ( _value - _compare, ABS ( _compare ) )
    )
```

Format string (dynamic):

```dax
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
RETURN
    IF ( _type IN { "PCT", "PCT2" }, "▲ +0.0"" pp"";▼ −0.0"" pp"";0.0"" pp""", "▲ +0.0%;▼ −0.0%;0.0%" )
```

### KPI Δ B

Folder `3 KPIs` · spec K-20

```dax
KPI Δ B =
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
VAR _value        = [_KPI Value]
VAR _compare      =
    CALCULATE (
        [_KPI Value]
        ,REMOVEFILTERS ( param_eval )
        ,TREATAS ( { "CMP_B" }, param_eval[eval_code] )
    )
RETURN
    SWITCH (
        TRUE ()
        ,[_Sel Compare B] = "NONE" || ISBLANK ( _compare ) || ISBLANK ( _value )
            ,BLANK ()
        ,_type IN { "PCT", "PCT2" }
            ,( _value - _compare ) * 100
        ,DIVIDE ( _value - _compare, ABS ( _compare ) )
    )
```

Format string (dynamic):

```dax
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
RETURN
    IF ( _type IN { "PCT", "PCT2" }, "▲ +0.0"" pp"";▼ −0.0"" pp"";0.0"" pp""", "▲ +0.0%;▼ −0.0%;0.0%" )
```

### KPI Δ A Color

Folder `3 KPIs` · spec K-21, N-07

```dax
KPI Δ A Color =
VAR _better       = SELECTEDVALUE ( dim_kpi[better_when] )
VAR _delta        = [KPI Δ A]
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _delta ) || _better = "Neutral" || _delta = 0
            ,BLANK ()
        ,( _delta > 0 && _better = "Higher" ) || ( _delta < 0 && _better = "Lower" )
            ,"#06603F"
        ,"#C2410C"
    )
```

### KPI Δ B Color

Folder `3 KPIs` · spec K-21, N-07

```dax
KPI Δ B Color =
VAR _better       = SELECTEDVALUE ( dim_kpi[better_when] )
VAR _delta        = [KPI Δ B]
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _delta ) || _better = "Neutral" || _delta = 0
            ,BLANK ()
        ,( _delta > 0 && _better = "Higher" ) || ( _delta < 0 && _better = "Lower" )
            ,"#06603F"
        ,"#C2410C"
    )
```

### KPI Organic Growth

Folder `3 KPIs\Items` · spec K-02

```dax
KPI Organic Growth =
VAR _nr_cc        = [_NR CC Base]
VAR _py_cc        = [_PY NR CC]
RETURN
    IF ( ISBLANK ( _py_cc ) || ISBLANK ( _nr_cc ), BLANK (), DIVIDE ( _nr_cc, _py_cc ) - 1 )
```

### KPI Reported Growth

Folder `3 KPIs\Items` · spec K-02

```dax
KPI Reported Growth =
VAR _nr           = [Net Revenue]
VAR _py           =
    CALCULATE (
        [PY Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "NR"
    )
RETURN
    IF ( ISBLANK ( _py ) || ISBLANK ( _nr ), BLANK (), DIVIDE ( _nr, _py ) - 1 )
```

### KPI Gross Margin %

Folder `3 KPIs\Items` · spec K-03

```dax
KPI Gross Margin % =
DIVIDE ( [Gross Profit], [Net Revenue] )
```

### KPI Gross-to-Net %

Folder `3 KPIs\Items` · spec K-04 (Products)

```dax
KPI Gross-to-Net % =
DIVIDE ( - [Gross-to-Net Deductions], [Gross Revenue] )
```

### KPI ARR

Folder `3 KPIs\Items` · spec K-04 (Services), K-23

```dax
KPI ARR =
VAR _end          = [_Win End]
VAR _fiscal_year  =
    CALCULATE (
        MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
VAR _month        =
    CALCULATE (
        MAX ( dim_month[month_number] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
VAR _value        =
    CALCULATE (
        [Net Revenue]
        ,REMOVEFILTERS ( dim_line )
        ,TREATAS ( { "SUB" }, dim_line[line_code] )
        ,REMOVEFILTERS ( param_time_view )
        ,TREATAS ( { "MTD" }, param_time_view[time_view_code] )
        ,REMOVEFILTERS ( param_fiscal_year )
        ,TREATAS ( { _fiscal_year }, param_fiscal_year[fiscal_year] )
        ,REMOVEFILTERS ( param_period )
        ,TREATAS ( { _month }, param_period[month_number] )
    )
RETURN
    IF ( ISBLANK ( _end ), BLANK (), _value * 12 )
```

### KPI Services Share

Folder `3 KPIs\Items` · spec K-04 (Group)

```dax
KPI Services Share =
VAR _services_nr  =
    CALCULATE (
        [Net Revenue]
        ,KEEPFILTERS ( TREATAS ( { "S" }, dim_entity[entity_code] ) )
    )
RETURN
    IF ( [_Sel Entity] = "GROUP", DIVIDE ( _services_nr, [Net Revenue] ) )
```

### KPI A&P % NR

Folder `3 KPIs\Items` · spec K-05 (Products)

```dax
KPI A&P % NR =
VAR _ap          =
    CALCULATE (
        [Base Amount]
        ,KEEPFILTERS ( TREATAS ( { "SM_P1", "SM_P2" }, dim_account[account_code] ) )
    )
RETURN
    DIVIDE ( - _ap, [Net Revenue] )
```

### KPI GMV

Folder `3 KPIs\Items` · spec K-09 (Services)

```dax
KPI GMV =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( param_metric )
    ,TREATAS ( { "GMV" }, param_metric[metric_code] )
)
```

### KPI Payments Take Rate

Folder `3 KPIs\Items` · spec K-05 (Services)

```dax
KPI Payments Take Rate =
VAR _payments_nr  =
    CALCULATE (
        [Net Revenue]
        ,REMOVEFILTERS ( dim_line )
        ,TREATAS ( { "PAY" }, dim_line[line_code] )
    )
VAR _gmv          =
    CALCULATE (
        [KPI GMV]
        ,REMOVEFILTERS ( dim_line )
        ,TREATAS ( { "PAY" }, dim_line[line_code] )
    )
RETURN
    DIVIDE ( _payments_nr, _gmv )
```

### KPI IC Eliminated

Folder `3 KPIs\Items` · spec K-05 (Group), C-36

```dax
KPI IC Eliminated =
VAR _elim_revenue =
    CALCULATE (
        [Base Amount]
        ,KEEPFILTERS ( TREATAS ( { "ELIM_GR" }, dim_account[account_code] ) )
    )
RETURN
    IF ( [_Sel Entity] = "GROUP", - _elim_revenue )
```

### KPI CM %

Folder `3 KPIs\Items` · spec K-06

```dax
KPI CM % =
DIVIDE ( [Contribution Margin], [Net Revenue] )
```

### KPI Adj EBITDA Margin

Folder `3 KPIs\Items` · spec K-07

```dax
KPI Adj EBITDA Margin =
DIVIDE ( [Adjusted EBITDA], [Net Revenue] )
```

### KPI Operating Margin

Folder `3 KPIs\Items` · spec K-08

```dax
KPI Operating Margin =
DIVIDE ( [Operating Profit], [Net Revenue] )
```

### KPI Net Margin

Folder `3 KPIs\Items` · spec K-11 (Group)

```dax
KPI Net Margin =
DIVIDE ( [Net Profit], [Net Revenue] )
```

### KPI Units Sold

Folder `3 KPIs\Items` · spec K-09 (Products)

```dax
KPI Units Sold =
[_Units Base]
```

### KPI NR per Unit

Folder `3 KPIs\Items` · spec K-10 (Products)

```dax
KPI NR per Unit =
DIVIDE ( [Net Revenue], [KPI Units Sold] )
```

### KPI Active Merchants

Folder `3 KPIs\Items` · spec K-10 (Services), K-23, T-17

```dax
KPI Active Merchants =
VAR _end          = [_Win End]
VAR _fiscal_year  =
    CALCULATE (
        MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
VAR _month        =
    CALCULATE (
        MAX ( dim_month[month_number] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
VAR _value        =
    CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( param_metric )
        ,TREATAS ( { "MERCHANTS" }, param_metric[metric_code] )
        ,REMOVEFILTERS ( param_time_view )
        ,TREATAS ( { "MTD" }, param_time_view[time_view_code] )
        ,REMOVEFILTERS ( param_fiscal_year )
        ,TREATAS ( { _fiscal_year }, param_fiscal_year[fiscal_year] )
        ,REMOVEFILTERS ( param_period )
        ,TREATAS ( { _month }, param_period[month_number] )
    )
RETURN
    IF ( ISBLANK ( _end ), BLANK (), _value )
```

### KPI Effective Tax Rate

Folder `3 KPIs\Items` · spec K-12 (Group), §3 step 18

```dax
KPI Effective Tax Rate =
DIVIDE ( - [Income Tax], [Profit Before Tax] )
```

### KPI Subscription GM %

Folder `3 KPIs\Items` · spec K-11 (Services)

```dax
KPI Subscription GM % =
CALCULATE (
    DIVIDE ( [Gross Profit], [Net Revenue] )
    ,REMOVEFILTERS ( dim_line )
    ,TREATAS ( { "SUB" }, dim_line[line_code] )
)
```

### KPI Rule of 40

Folder `3 KPIs\Items` · spec K-12 (Services)

```dax
KPI Rule of 40 =
VAR _growth       = [KPI Organic Growth]
RETURN
    IF ( ISBLANK ( _growth ), BLANK (), _growth + [KPI Adj EBITDA Margin] )
```

### KPI CP Operating Margin

Folder `3 KPIs\Items` · spec K-09 (Group)

```dax
KPI CP Operating Margin =
CALCULATE (
    [KPI Operating Margin]
    ,REMOVEFILTERS ( param_entity_view )
    ,TREATAS ( { "P" }, param_entity_view[entity_view_code] )
)
```

### KPI CC Operating Margin

Folder `3 KPIs\Items` · spec K-10 (Group)

```dax
KPI CC Operating Margin =
CALCULATE (
    [KPI Operating Margin]
    ,REMOVEFILTERS ( param_entity_view )
    ,TREATAS ( { "S" }, param_entity_view[entity_view_code] )
)
```

### KPI Volume Growth

Folder `3 KPIs\Items` · spec K-11 (Products)

```dax
KPI Volume Growth =
VAR _volume       =
    CALCULATE (
        [Bridge Volume]
        ,REMOVEFILTERS ( param_compare_a )
        ,TREATAS ( { "PY" }, param_compare_a[choice_code] )
    )
RETURN
    DIVIDE ( _volume, [_PY NR CC] )
```

### KPI Price Mix

Folder `3 KPIs\Items` · spec K-12 (Products)

```dax
KPI Price Mix =
VAR _price_mix    =
    CALCULATE (
        [Bridge Price Mix]
        ,REMOVEFILTERS ( param_compare_a )
        ,TREATAS ( { "PY" }, param_compare_a[choice_code] )
    )
RETURN
    DIVIDE ( _price_mix, [_PY NR CC] )
```

### Bridge Comparison NR

Folder `4 Analysis` · spec C-40

```dax
Bridge Comparison NR =
CALCULATE (
    [Bridge Comparison Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NR"
)
```

### Bridge Volume

Folder `4 Analysis` · spec C-40, K-11

```dax
Bridge Volume =
VAR _slices       =
    CALCULATETABLE (
        SUMMARIZE (
            fact_pl
            ,dim_region[region_code]
            ,dim_channel[channel_code]
            ,dim_line[line_code]
            ,dim_segment[segment_code]
        )
        ,KEEPFILTERS ( TREATAS ( { "P" }, dim_entity[entity_code] ) )
        ,dim_account[is_direct] = TRUE ()
        ,REMOVEFILTERS ( dim_month )
        ,REMOVEFILTERS ( dim_version )
    )
VAR _volume       =
    SUMX (
        _slices
        ,VAR _units_base  = [_Units Base]
         VAR _units_cmp   = [_Units Bridge Cmp]
         VAR _nr_cc_base  = [_NR CC Base]
         VAR _nr_cc_cmp   = [_NR CC Bridge Cmp]
         RETURN
             IF (
                 _units_cmp = 0
                 ,_nr_cc_base - _nr_cc_cmp
                 ,( _units_base - _units_cmp ) * DIVIDE ( _nr_cc_cmp, _units_cmp )
             )
    )
RETURN
    IF ( [_Sel Entity] = "P", _volume )
```

### Bridge Price Mix

Folder `4 Analysis` · spec C-40, K-12

```dax
Bridge Price Mix =
IF ( [_Sel Entity] = "P", [_Bridge NR CC Change] - [Bridge Volume] )
```

### Bridge FX

Folder `4 Analysis` · spec C-40, T-10

```dax
Bridge FX =
VAR _fx_base      = [Net Revenue] - [_NR CC Base]
VAR _fx_cmp       = [Bridge Comparison NR] - [_NR CC Bridge Cmp]
RETURN
    _fx_base - _fx_cmp
```

### Bridge Value

Folder `4 Analysis` · spec C-40, T-05

```dax
Bridge Value =
DIVIDE ( [_Bridge Value], [_Units Divisor] )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### LV Base

Folder `4 Analysis` · spec C-45

```dax
LV Base =
DIVIDE ( [Base Amount], [_Units Divisor] )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### LV Comparison

Folder `4 Analysis` · spec C-45

```dax
LV Comparison =
DIVIDE ( [Bridge Comparison Amount], [_Units Divisor] )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### LV Δ

Folder `4 Analysis` · spec C-45, M-10

```dax
LV Δ =
VAR _base         = [Base Amount]
VAR _compare      = [Bridge Comparison Amount]
RETURN
    IF ( ISBLANK ( _base ) && ISBLANK ( _compare ), BLANK (), DIVIDE ( _base - _compare, [_Units Divisor] ) )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "+#,0;−#,0;0", "+#,0.0;−#,0.0;0.0" )
```

### LV Δ %

Folder `4 Analysis` · spec C-45

```dax
LV Δ % =
VAR _base         = [Base Amount]
VAR _compare      = [Bridge Comparison Amount]
RETURN
    IF ( ISBLANK ( _base ) && ISBLANK ( _compare ), BLANK (), DIVIDE ( _base - _compare, ABS ( _compare ) ) )
```

### LV Abs Δ

Folder `4 Analysis` · spec C-45

```dax
LV Abs Δ =
ABS ( [Base Amount] - [Bridge Comparison Amount] )
```

### LV Δ Color

Folder `4 Analysis` · spec L-12, N-07

```dax
LV Δ Color =
VAR _base         = [Base Amount]
VAR _compare      = [Bridge Comparison Amount]
VAR _delta        = IF ( ISBLANK ( _base ) && ISBLANK ( _compare ), BLANK (), _base - _compare )
RETURN
    SWITCH (
        TRUE ()
        ,_delta > 0
            ,"#06603F"
        ,_delta < 0
            ,"#C2410C"
        ,BLANK ()
    )
```

### Prof NR Share

Folder `5 Profitability` · spec C-46

```dax
Prof NR Share =
VAR _total        =
    CALCULATE (
        [Net Revenue]
        ,ALLSELECTED ( dim_region )
        ,ALLSELECTED ( dim_channel )
        ,ALLSELECTED ( dim_line )
        ,ALLSELECTED ( dim_segment )
        ,ALLSELECTED ( dim_entity )
    )
RETURN
    DIVIDE ( [Net Revenue], _total )
```

### Prof NR Δ %

Folder `5 Profitability` · spec C-46

```dax
Prof NR Δ % =
VAR _compare      = [Bridge Comparison NR]
RETURN
    DIVIDE ( [Net Revenue] - _compare, ABS ( _compare ) )
```

### Prof NR Δ Color

Folder `5 Profitability` · spec L-12, N-07

```dax
Prof NR Δ Color =
VAR _delta        = [Prof NR Δ %]
RETURN
    SWITCH (
        TRUE ()
        ,_delta > 0
            ,"#06603F"
        ,_delta < 0
            ,"#C2410C"
        ,BLANK ()
    )
```

### Slice Member In View

Folder `5 Profitability` · spec F-09..F-11, F-21, F-32

```dax
Slice Member In View =
VAR _view         = [_Sel Entity]
RETURN
    SWITCH (
        TRUE ()
        ,ISINSCOPE ( dim_region[region_name] )
            ,1
        ,ISINSCOPE ( dim_entity[short_name] )
            ,IF ( _view = "GROUP", 1 )
        ,ISINSCOPE ( dim_channel[channel_name] )
            ,IF (
                _view <> "GROUP"
                    && SELECTEDVALUE ( dim_channel[entity_code] ) = _view
                    && SELECTEDVALUE ( dim_channel[is_unassigned] ) = FALSE ()
                ,1
            )
        ,ISINSCOPE ( dim_line[line_name] )
            ,IF (
                _view <> "GROUP"
                    && SELECTEDVALUE ( dim_line[entity_code] ) = _view
                    && SELECTEDVALUE ( dim_line[is_unassigned] ) = FALSE ()
                ,1
            )
        ,ISINSCOPE ( dim_segment[segment_name] )
            ,IF (
                _view <> "GROUP"
                    && SELECTEDVALUE ( dim_segment[entity_code] ) = _view
                    && SELECTEDVALUE ( dim_segment[is_unassigned] ) = FALSE ()
                ,1
            )
    )
```

### Prof Net Revenue

Folder `5 Profitability` · spec C-46, F-14, N-06

```dax
Prof Net Revenue =
DIVIDE ( [Net Revenue], [_Units Divisor] )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### Data Status

Folder `6 Context` · spec L-01, N-02, N-03

```dax
Data Status =
VAR _last_closed  = [_Last Closed Index]
VAR _closed_label =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
VAR _refreshed    = MAX ( _meta_refresh[refreshed_at] )
RETURN
    "Closed through " & _closed_label & "  ·  Refreshed " & FORMAT ( _refreshed, "dd mmm yyyy hh:nn" )
```

### Context Line

Folder `6 Context` · spec L-04, F-36

```dax
Context Line =
VAR _view         = [_Sel Entity]
VAR _entity       =
    CALCULATE (
        MAX ( param_entity_view[entity_view_name] )
        ,REMOVEFILTERS ( param_entity_view )
        ,param_entity_view[entity_view_code] = _view
    )
VAR _time_code    = [_Sel Time View]
VAR _time_view    =
    CALCULATE (
        MAX ( param_time_view[time_view_name] )
        ,REMOVEFILTERS ( param_time_view )
        ,param_time_view[time_view_code] = _time_code
    )
VAR _start        = MAX ( [_Win Start], 0 )
VAR _end          = [_Win End]
VAR _start_label  =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _start
    )
VAR _end_label    =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
VAR _actual_n     =
    CALCULATE (
        COUNTROWS ( dim_month )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] >= _start && dim_month[month_index] <= _end
        ,dim_month[is_closed] = TRUE ()
    )
VAR _window       =
    IF (
        _end < _start
        ,_time_view & ": no closed months in window"
        ,_time_view & " " & _start_label & " – " & _end_label & " (" & FORMAT ( _actual_n + 0, "0" ) & " actual)"
    )
VAR _base         = SWITCH ( [_Sel Base Version], "LE", "Latest estimate", "B", "Budget", "Actual" )
VAR _compare_a    = SWITCH ( [_Sel Compare A], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "none" )
VAR _compare_b    = SWITCH ( [_Sel Compare B], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "none" )
VAR _fx           =
    IF ( [_Sel FX Basis] = "CC", "constant currency (FY" & [_Sel FY] & " budget rates)", "actual rates" )
VAR _units        = IF ( [_Sel Units] = "K", "k", "m" )
VAR _regions      =
    IF (
        ISFILTERED ( dim_region[region_name] )
        ,CONCATENATEX ( VALUES ( dim_region[region_name] ), dim_region[region_name], ", ", dim_region[region_name], ASC )
        ,"All regions"
    )
VAR _slices       =
    IF (
        _view <> "GROUP"
        ,IF (
            ISFILTERED ( dim_channel[channel_name] )
            ,"  ·  " & CONCATENATEX (
                CALCULATETABLE ( VALUES ( dim_channel[channel_name] ), KEEPFILTERS ( dim_channel[entity_code] = _view ) )
                ,dim_channel[channel_name]
                ,", "
            )
        )
            & IF (
                ISFILTERED ( dim_line[line_name] )
                ,"  ·  " & CONCATENATEX (
                    CALCULATETABLE ( VALUES ( dim_line[line_name] ), KEEPFILTERS ( dim_line[entity_code] = _view ) )
                    ,dim_line[line_name]
                    ,", "
                )
            )
            & IF (
                ISFILTERED ( dim_segment[segment_name] )
                ,"  ·  " & CONCATENATEX (
                    CALCULATETABLE ( VALUES ( dim_segment[segment_name] ), KEEPFILTERS ( dim_segment[entity_code] = _view ) )
                    ,dim_segment[segment_name]
                    ,", "
                )
            )
    )
RETURN
    _entity & "  ·  " & _window
        & "  -  " & UNICHAR(10) & _base & " vs " & _compare_a & " (A) / " & _compare_b & " (B)"
        & "  -  " & UNICHAR(10) & [_Sel Currency] & " " & _units & ", " & _fx
        & "  -  " & UNICHAR(10) &_regions & _slices
```

### Notices

Folder `6 Context` · spec L-05, C-50

```dax
Notices =
VAR _last_closed  = [_Last Closed Index]
VAR _base         = [_Sel Base Version]
VAR _start        = [_Win Start]
VAR _end_raw      = [_Win End Raw]
VAR _first_label  =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = 0
    )
VAR _closed_label =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
VAR _open_from    =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = MAX ( _last_closed + 1, _start )
    )
VAR _open_to      =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end_raw
    )
VAR _forecast     =
    CALCULATE (
        MAX ( dim_version[version_name] )
        ,REMOVEFILTERS ( dim_version )
        ,dim_version[is_latest_forecast] = TRUE ()
    )
VAR _uses_py      = [_Sel Compare A] = "PY" || [_Sel Compare B] = "PY"
VAR _slice_on     =
    ISFILTERED ( dim_channel[channel_name] )
        || ISFILTERED ( dim_line[line_name] )
        || ISFILTERED ( dim_segment[segment_name] )
VAR _is_group     = [_Sel Entity] = "GROUP"
VAR _n_close      =
    IF ( _base = "A" && _end_raw > _last_closed, "Actuals closed through " & _closed_label & ": later months excluded; use Latest estimate for the full window" )
VAR _n_forecast   =
    IF ( _base = "LE" && _end_raw > _last_closed, "Forecast months included: " & _open_from & " – " & _open_to & " (" & _forecast & ")" )
VAR _n_py         = IF ( _uses_py && _start - 12 < 0, "Prior year n/a before " & _first_label )
VAR _n_ltm        = IF ( [_Sel Time View] = "LTM" && _start < 0, "LTM starts before the data history (" & _first_label & ")" )
VAR _n_alloc      = IF ( _slice_on && NOT _is_group, "Slice filter on: lines from operating expenses down are allocated by net-revenue share" )
VAR _n_group      = IF ( _is_group, "ACME Group: Commerce Cloud fees billed to Consumer Products are eliminated" )
VAR _list         = { _n_close, _n_forecast, _n_py, _n_ltm, _n_alloc, _n_group }
RETURN
    CONCATENATEX ( FILTER ( _list, LEN ( [Value] ) > 0 ), [Value], "   |   " )
```

### Slice Panel Note

Folder `6 Context` · spec F-32, C-31

```dax
Slice Panel Note =
IF (
    [_Sel Entity] = "GROUP"
    ,"Group view: channel, category and segment read All (consolidated) because their values differ by entity. Region still applies."
    ,"Slices apply to every view. Lines from operating expenses down are allocated to slices by net-revenue share."
)
```

### Profitability Note

Folder `6 Context` · spec C-46, F-21

```dax
Profitability Note =
IF (
    [_Sel Entity] = "GROUP"
    ,"Group view: break down by Region or Entity. Regions and entities include their own eliminations."
    ,"EBITDA and operating margins by slice are indicative: lines below contribution margin are allocated by NR share."
)
```

### _Last Closed Index

Folder `9 Engine` · spec N-03, C-01

```dax
_Last Closed Index =
CALCULATE (
    MAX ( dim_month[month_index] )
    ,REMOVEFILTERS ( dim_month )
    ,dim_month[is_closed] = TRUE ()
)
```

### _Sel Entity

Folder `9 Engine` · spec F-01

```dax
_Sel Entity =
VAR _default      =
    CALCULATE (
        MAX ( param_entity_view[entity_view_code] )
        ,REMOVEFILTERS ( param_entity_view )
        ,param_entity_view[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_entity_view[entity_view_code], _default )
```

### _Sel FY

Folder `9 Engine` · spec F-02

```dax
_Sel FY =
VAR _last_closed  = [_Last Closed Index]
VAR _default      =
    CALCULATE (
        MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
RETURN
    SELECTEDVALUE ( param_fiscal_year[fiscal_year], _default )
```

### _Sel Month

Folder `9 Engine` · spec F-03

```dax
_Sel Month =
VAR _last_closed  = [_Last Closed Index]
VAR _default      =
    CALCULATE (
        MAX ( dim_month[month_number] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
RETURN
    SELECTEDVALUE ( param_period[month_number], _default )
```

### _Sel Time View

Folder `9 Engine` · spec F-04

```dax
_Sel Time View =
VAR _default      =
    CALCULATE (
        MAX ( param_time_view[time_view_code] )
        ,REMOVEFILTERS ( param_time_view )
        ,param_time_view[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_time_view[time_view_code], _default )
```

### _Sel Base Version

Folder `9 Engine` · spec F-05

```dax
_Sel Base Version =
VAR _default      =
    CALCULATE (
        MAX ( param_base_version[choice_code] )
        ,REMOVEFILTERS ( param_base_version )
        ,param_base_version[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_base_version[choice_code], _default )
```

### _Sel Compare A

Folder `9 Engine` · spec F-06

```dax
_Sel Compare A =
VAR _default      =
    CALCULATE (
        MAX ( param_compare_a[choice_code] )
        ,REMOVEFILTERS ( param_compare_a )
        ,param_compare_a[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_compare_a[choice_code], _default )
```

### _Sel Compare B

Folder `9 Engine` · spec F-07

```dax
_Sel Compare B =
VAR _default      =
    CALCULATE (
        MAX ( param_compare_b[choice_code] )
        ,REMOVEFILTERS ( param_compare_b )
        ,param_compare_b[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_compare_b[choice_code], _default )
```

### _Sel Currency

Folder `9 Engine` · spec F-12

```dax
_Sel Currency =
VAR _default      =
    CALCULATE (
        MAX ( param_reporting_currency[currency_code] )
        ,REMOVEFILTERS ( param_reporting_currency )
        ,param_reporting_currency[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_reporting_currency[currency_code], _default )
```

### _Sel FX Basis

Folder `9 Engine` · spec F-13

```dax
_Sel FX Basis =
VAR _default      =
    CALCULATE (
        MAX ( param_fx_basis[fx_basis_code] )
        ,REMOVEFILTERS ( param_fx_basis )
        ,param_fx_basis[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_fx_basis[fx_basis_code], _default )
```

### _Sel Units

Folder `9 Engine` · spec F-14

```dax
_Sel Units =
VAR _default      =
    CALCULATE (
        MAX ( param_units[units_code] )
        ,REMOVEFILTERS ( param_units )
        ,param_units[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_units[units_code], _default )
```

### _Sel Metric

Folder `9 Engine` · spec D-03

```dax
_Sel Metric =
SELECTEDVALUE ( param_metric[metric_code], "AMOUNT" )
```

### _Sel Eval

Folder `9 Engine` · spec K-20

```dax
_Sel Eval =
SELECTEDVALUE ( param_eval[eval_code], "BASE" )
```

### _Anchor Index

Folder `9 Engine` · spec §7 Time windows

```dax
_Anchor Index =
VAR _fiscal_year  = [_Sel FY]
VAR _month        = [_Sel Month]
RETURN
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fiscal_year
        ,dim_month[month_number] = _month
    )
```

### _Win Start

Folder `9 Engine` · spec §7 Time windows

```dax
_Win Start =
VAR _anchor       = [_Anchor Index]
VAR _month        = [_Sel Month]
VAR _time_view    = [_Sel Time View]
RETURN
    SWITCH (
        _time_view
        ,"MTD"
            ,_anchor
        ,"QTD"
            ,_anchor - MOD ( _month - 1, 3 )
        ,"LTM"
            ,_anchor - 11
        ,_anchor - ( _month - 1 )
    )
```

### _Win End Raw

Folder `9 Engine` · spec §7 Time windows

```dax
_Win End Raw =
VAR _anchor       = [_Anchor Index]
VAR _month        = [_Sel Month]
RETURN
    IF ( [_Sel Time View] = "FY", _anchor - _month + 12, _anchor )
```

### _Win End

Folder `9 Engine` · spec C-01, C-03

```dax
_Win End =
VAR _end_raw      = [_Win End Raw]
VAR _last_closed  = [_Last Closed Index]
RETURN
    IF ( [_Sel Base Version] = "A", MIN ( _end_raw, _last_closed ), _end_raw )
```

### _Local Sum

Folder `9 Engine` · spec D-01, D-02, D-03

```dax
_Local Sum =
VAR _metric       = [_Sel Metric]
RETURN
    SWITCH (
        _metric
        ,"AMOUNT"
            ,CALCULATE (
                SUM ( fact_pl[amount_local] )
                ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
            )
                + SUM ( fact_pl_allocated[amount_local] )
        ,"UNITS"
            ,SUM ( fact_operational[units_sold] )
        ,"GMV"
            ,SUM ( fact_operational[gmv_local] )
        ,"MERCHANTS"
            ,SUM ( fact_operational[active_merchants_end] )
    )
```

### _Amt Raw

Folder `9 Engine` · spec D-30, C-10, C-11, C-12, C-13

```dax
_Amt Raw =
VAR _metric       = [_Sel Metric]
VAR _rep_currency = [_Sel Currency]
VAR _is_cc        = [_Sel FX Basis] = "CC"
VAR _cc_month     = FORMAT ( [_Sel FY], "0" ) & "-01"
VAR _groups       =
    CROSSJOIN (
        VALUES ( dim_month[month_key] )
        ,VALUES ( dim_region[functional_currency] )
        ,VALUES ( dim_version[version_key] )
    )
VAR _translated   =
    SUMX (
        _groups
        ,VAR _currency    = dim_region[functional_currency]
         VAR _version     = dim_version[version_key]
         VAR _rate_type   = IF ( _is_cc || _version = "BUD", "BUDGET", "ACTUAL_AVG" )
         VAR _rate_month  = IF ( _is_cc, _cc_month, dim_month[month_key] )
         VAR _local_rate  =
             LOOKUPVALUE (
                 fact_fx_rate[local_per_usd]
                 ,fact_fx_rate[currency_code], _currency
                 ,fact_fx_rate[month_key], _rate_month
                 ,fact_fx_rate[rate_type], _rate_type
             )
         VAR _rep_rate    =
             LOOKUPVALUE (
                 fact_fx_rate[local_per_usd]
                 ,fact_fx_rate[currency_code], _rep_currency
                 ,fact_fx_rate[month_key], _rate_month
                 ,fact_fx_rate[rate_type], _rate_type
             )
         RETURN
             [_Local Sum] * DIVIDE ( _rep_rate, _local_rate )
    )
RETURN
    IF ( _metric IN { "UNITS", "MERCHANTS" }, [_Local Sum], _translated )
```

### _Elim Amount

Folder `9 Engine` · spec C-35, C-36, D-33

```dax
_Elim Amount =
VAR _elim_blocks  =
    CALCULATETABLE (
        VALUES ( dim_account[block_code] )
        ,KEEPFILTERS ( dim_account[is_intercompany] = TRUE () )
        ,KEEPFILTERS ( dim_account[has_fact_rows] = FALSE () )
        ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
    )
VAR _ic_amount    =
    CALCULATE (
        [_Amt Raw]
        ,REMOVEFILTERS ( dim_account )
        ,TREATAS ( _elim_blocks, dim_account[block_code] )
        ,dim_account[is_direct] = TRUE ()
        ,NOT ISBLANK ( fact_pl[counterparty_entity_code] )
    )
RETURN
    - _ic_amount
```

### _Amt Entity

Folder `9 Engine` · spec F-01, C-36, F-30, F-32

```dax
_Amt Entity =
VAR _view         = [_Sel Entity]
VAR _is_group     = _view = "GROUP"
VAR _entities     =
    FILTER (
        ALL ( dim_entity[entity_code] )
        ,_is_group || dim_entity[entity_code] = _view
    )
VAR _ch_sel       = VALUES ( dim_channel[channel_code] )
VAR _ch_stale     =
    NOT ISEMPTY ( _ch_sel )
        && ISEMPTY (
            CALCULATETABLE (
                VALUES ( dim_channel[channel_code] )
                ,KEEPFILTERS ( dim_channel[entity_code] = _view )
            )
        )
VAR _channels     =
    FILTER (
        ALL ( dim_channel[channel_code] )
        ,_is_group || _ch_stale || dim_channel[channel_code] IN _ch_sel
    )
VAR _ln_sel       = VALUES ( dim_line[line_code] )
VAR _ln_stale     =
    NOT ISEMPTY ( _ln_sel )
        && ISEMPTY (
            CALCULATETABLE (
                VALUES ( dim_line[line_code] )
                ,KEEPFILTERS ( dim_line[entity_code] = _view )
            )
        )
VAR _lines        =
    FILTER (
        ALL ( dim_line[line_code] )
        ,_is_group || _ln_stale || dim_line[line_code] IN _ln_sel
    )
VAR _sg_sel       = VALUES ( dim_segment[segment_code] )
VAR _sg_stale     =
    NOT ISEMPTY ( _sg_sel )
        && ISEMPTY (
            CALCULATETABLE (
                VALUES ( dim_segment[segment_code] )
                ,KEEPFILTERS ( dim_segment[entity_code] = _view )
            )
        )
VAR _segments     =
    FILTER (
        ALL ( dim_segment[segment_code] )
        ,_is_group || _sg_stale || dim_segment[segment_code] IN _sg_sel
    )
VAR _value        =
    CALCULATE (
        [_Amt Raw]
        ,KEEPFILTERS ( TREATAS ( _entities, dim_entity[entity_code] ) )
        ,REMOVEFILTERS ( dim_channel )
        ,TREATAS ( _channels, dim_channel[channel_code] )
        ,REMOVEFILTERS ( dim_line )
        ,TREATAS ( _lines, dim_line[line_code] )
        ,REMOVEFILTERS ( dim_segment )
        ,TREATAS ( _segments, dim_segment[segment_code] )
    )
VAR _elim         =
    IF (
        _is_group && [_Sel Metric] = "AMOUNT"
        ,CALCULATE (
            [_Elim Amount]
            ,REMOVEFILTERS ( dim_channel )
            ,REMOVEFILTERS ( dim_line )
            ,REMOVEFILTERS ( dim_segment )
        )
    )
RETURN
    _value + _elim
```

### _Amt Row

Folder `9 Engine` · spec D-32, M-01, M-03

```dax
_Amt Row =
VAR _has_row      = ISCROSSFILTERED ( dim_pl_row[line_code] )
VAR _line         = SELECTEDVALUE ( dim_pl_row[line_code] )
VAR _type         = SELECTEDVALUE ( dim_pl_row[row_type] )
VAR _sort         = SELECTEDVALUE ( dim_pl_row[line_sort] )
VAR _is_leaf      = ISINSCOPE ( dim_pl_row[account_label] )
VAR _account      = SELECTEDVALUE ( dim_pl_row[account_code] )
VAR _visible      = VALUES ( dim_account[account_code] )
VAR _blocks       =
    SELECTCOLUMNS (
        FILTER (
            ALL (
                dim_report_line[line_code]
                ,dim_report_line[row_type]
                ,dim_report_line[parent_line_code]
                ,dim_report_line[sort_order]
                ,dim_report_line[block_code]
            )
            ,dim_report_line[row_type] = "input_block"
                && SWITCH (
                    _type
                    ,"input_block"
                        ,dim_report_line[line_code] = _line
                    ,"group_total"
                        ,dim_report_line[parent_line_code] = _line
                    ,"ratio"
                        ,FALSE ()
                    ,dim_report_line[sort_order] < _sort
                )
        )
        ,"@block_code", dim_report_line[block_code]
    )
VAR _accounts     =
    FILTER (
        ALL ( dim_account[account_code], dim_account[block_code] )
        ,IF (
            NOT _has_row
            ,dim_account[account_code] IN _visible
            ,NOT ISBLANK ( _line )
                && IF (
                    _is_leaf
                    ,LEN ( _account ) > 0 && dim_account[account_code] = _account
                    ,dim_account[block_code] IN _blocks
                )
        )
    )
RETURN
    CALCULATE (
        [_Amt Entity]
        ,TREATAS ( SELECTCOLUMNS ( _accounts, "@account_code", dim_account[account_code] ), dim_account[account_code] )
    )
```

### _Amt Actual

Folder `9 Engine` · spec C-01, D-31

```dax
_Amt Actual =
CALCULATE (
    [_Amt Row]
    ,REMOVEFILTERS ( dim_version )
    ,dim_version[version_key] = "ACT"
)
```

### _Amt Budget

Folder `9 Engine` · spec C-05, D-31

```dax
_Amt Budget =
CALCULATE (
    [_Amt Row]
    ,REMOVEFILTERS ( dim_version )
    ,dim_version[version_key] = "BUD"
)
```

### _Amt LE

Folder `9 Engine` · spec C-02, D-31

```dax
_Amt LE =
VAR _closed       =
    CALCULATE (
        [_Amt Row]
        ,REMOVEFILTERS ( dim_version )
        ,dim_version[version_key] = "ACT"
        ,KEEPFILTERS ( dim_month[is_closed] = TRUE () )
    )
VAR _open         =
    CALCULATE (
        [_Amt Row]
        ,REMOVEFILTERS ( dim_version )
        ,dim_version[is_latest_forecast] = TRUE ()
        ,KEEPFILTERS ( dim_month[is_closed] = FALSE () )
    )
RETURN
    _closed + _open
```

### _NR CC Base

Folder `9 Engine` · spec C-12, C-40

```dax
_NR CC Base =
CALCULATE (
    [Net Revenue]
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### _PY NR CC

Folder `9 Engine` · spec C-12, K-02

```dax
_PY NR CC =
CALCULATE (
    [PY Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NR"
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### _Units Base

Folder `9 Engine` · spec K-09 (Products)

```dax
_Units Base =
CALCULATE (
    [Base Amount]
    ,REMOVEFILTERS ( param_metric )
    ,TREATAS ( { "UNITS" }, param_metric[metric_code] )
)
```

### _NR CC Bridge Cmp

Folder `9 Engine` · spec C-40

```dax
_NR CC Bridge Cmp =
CALCULATE (
    [Bridge Comparison Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NR"
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### _Units Bridge Cmp

Folder `9 Engine` · spec C-40

```dax
_Units Bridge Cmp =
CALCULATE (
    [Bridge Comparison Amount]
    ,REMOVEFILTERS ( param_metric )
    ,TREATAS ( { "UNITS" }, param_metric[metric_code] )
)
```

### _Bridge NR CC Change

Folder `9 Engine` · spec C-40

```dax
_Bridge NR CC Change =
[_NR CC Base] - [_NR CC Bridge Cmp]
```

### _Units Divisor

Folder `9 Engine` · spec F-14, N-06

```dax
_Units Divisor =
VAR _default      =
    CALCULATE (
        MAX ( param_units[divisor] )
        ,REMOVEFILTERS ( param_units )
        ,param_units[is_default] = TRUE ()
    )
RETURN
    SELECTEDVALUE ( param_units[divisor], _default )
```

### _PL Is Ratio

Folder `9 Engine` · spec M-11

```dax
_PL Is Ratio =
NOT ISINSCOPE ( dim_pl_row[account_label] )
    && SELECTEDVALUE ( dim_pl_row[row_type] ) = "ratio"
```

### _Amt Window

Folder `9 Engine` · spec C-01..C-05, D-31

```dax
_Amt Window =
VAR _eval         = [_Sel Eval]
VAR _choice       =
    SWITCH (
        _eval
        ,"CMP_A"
            ,[_Sel Compare A]
        ,"CMP_B"
            ,[_Sel Compare B]
        ,[_Sel Base Version]
    )
VAR _shift        = IF ( _choice = "PY", 12, 0 )
VAR _start        = [_Win Start] - _shift
VAR _end          = [_Win End] - _shift
VAR _months       =
    FILTER (
        ALL ( dim_month[month_key], dim_month[month_index], dim_month[is_closed] )
        ,dim_month[month_index] >= _start
            && dim_month[month_index] <= _end
    )
VAR _pairs        =
    FILTER (
        CROSSJOIN (
            ALL ( dim_version[version_key], dim_version[is_latest_forecast] )
            ,_months
        )
        ,SWITCH (
            _choice
            ,"B"
                ,dim_version[version_key] = "BUD"
            ,"LE"
                ,( dim_version[version_key] = "ACT" && dim_month[is_closed] )
                    || ( dim_version[is_latest_forecast] && NOT dim_month[is_closed] )
            ,dim_version[version_key] = "ACT"
        )
    )
VAR _filter       =
    SELECTCOLUMNS (
        _pairs
        ,"@version_key", dim_version[version_key]
        ,"@month_key", dim_month[month_key]
    )
RETURN
    IF (
        _choice <> "NONE"
        ,CALCULATE (
            [_Amt Row]
            ,REMOVEFILTERS ( dim_version )
            ,REMOVEFILTERS ( dim_month )
            ,TREATAS ( _filter, dim_version[version_key], dim_month[month_key] )
        )
    )
```

### _PL Base

Folder `9 Engine` · spec L-07, M-01, M-03, M-22

```dax
_PL Base =
VAR _is_ratio     = [_PL Is Ratio]
VAR _value        =
    IF (
        [_PL Is Ratio]
        ,DIVIDE (
            SELECTEDVALUE ( dim_pl_row[ratio_sign], 1 )
                * CALCULATE (
                    [Base Amount]
                    ,REMOVEFILTERS ( dim_pl_row )
                    ,TREATAS ( VALUES ( dim_pl_row[ratio_num_line] ), dim_pl_row[line_code] )
                )
            ,CALCULATE (
                [Base Amount]
                ,REMOVEFILTERS ( dim_pl_row )
                ,TREATAS ( VALUES ( dim_pl_row[ratio_den_line] ), dim_pl_row[line_code] )
            )
        )
        ,[Base Amount]
    )
VAR _is_line      = NOT ISINSCOPE ( dim_pl_row[account_label] ) && NOT _is_ratio && HASONEVALUE ( dim_pl_row[line_code] )
RETURN
    IF ( _is_line && ISBLANK ( _value ), 0, _value )
```

### _PL Compare A

Folder `9 Engine` · spec M-13, C-03

```dax
_PL Compare A =
IF (
    [_PL Is Ratio]
    ,DIVIDE (
        SELECTEDVALUE ( dim_pl_row[ratio_sign], 1 )
            * CALCULATE (
                [Compare A Amount]
                ,REMOVEFILTERS ( dim_pl_row )
                ,TREATAS ( VALUES ( dim_pl_row[ratio_num_line] ), dim_pl_row[line_code] )
            )
        ,CALCULATE (
            [Compare A Amount]
            ,REMOVEFILTERS ( dim_pl_row )
            ,TREATAS ( VALUES ( dim_pl_row[ratio_den_line] ), dim_pl_row[line_code] )
        )
    )
    ,[Compare A Amount]
)
```

### _PL Compare B

Folder `9 Engine` · spec M-13, C-03

```dax
_PL Compare B =
IF (
    [_PL Is Ratio]
    ,DIVIDE (
        SELECTEDVALUE ( dim_pl_row[ratio_sign], 1 )
            * CALCULATE (
                [Compare B Amount]
                ,REMOVEFILTERS ( dim_pl_row )
                ,TREATAS ( VALUES ( dim_pl_row[ratio_num_line] ), dim_pl_row[line_code] )
            )
        ,CALCULATE (
            [Compare B Amount]
            ,REMOVEFILTERS ( dim_pl_row )
            ,TREATAS ( VALUES ( dim_pl_row[ratio_den_line] ), dim_pl_row[line_code] )
        )
    )
    ,[Compare B Amount]
)
```

### _PL FY Budget

Folder `9 Engine` · spec M-14

```dax
_PL FY Budget =
IF (
    [_PL Is Ratio]
    ,DIVIDE (
        SELECTEDVALUE ( dim_pl_row[ratio_sign], 1 )
            * CALCULATE (
                [FY Budget Amount]
                ,REMOVEFILTERS ( dim_pl_row )
                ,TREATAS ( VALUES ( dim_pl_row[ratio_num_line] ), dim_pl_row[line_code] )
            )
        ,CALCULATE (
            [FY Budget Amount]
            ,REMOVEFILTERS ( dim_pl_row )
            ,TREATAS ( VALUES ( dim_pl_row[ratio_den_line] ), dim_pl_row[line_code] )
        )
    )
    ,[FY Budget Amount]
)
```

### _PL FY LE

Folder `9 Engine` · spec M-14

```dax
_PL FY LE =
IF (
    [_PL Is Ratio]
    ,DIVIDE (
        SELECTEDVALUE ( dim_pl_row[ratio_sign], 1 )
            * CALCULATE (
                [FY LE Amount]
                ,REMOVEFILTERS ( dim_pl_row )
                ,TREATAS ( VALUES ( dim_pl_row[ratio_num_line] ), dim_pl_row[line_code] )
            )
        ,CALCULATE (
            [FY LE Amount]
            ,REMOVEFILTERS ( dim_pl_row )
            ,TREATAS ( VALUES ( dim_pl_row[ratio_den_line] ), dim_pl_row[line_code] )
        )
    )
    ,[FY LE Amount]
)
```

### _PL Δ A

Folder `9 Engine` · spec M-10, M-11

```dax
_PL Δ A =
VAR _compare      = [_PL Compare A]
VAR _delta        = [_PL Base] - _compare
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _compare )
            ,BLANK ()
        ,[_PL Is Ratio]
            ,_delta * 100
        ,_delta
    )
```

### _PL Δ B

Folder `9 Engine` · spec M-10, M-11

```dax
_PL Δ B =
VAR _compare      = [_PL Compare B]
VAR _delta        = [_PL Base] - _compare
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _compare )
            ,BLANK ()
        ,[_PL Is Ratio]
            ,_delta * 100
        ,_delta
    )
```

### _PL Δ LE

Folder `9 Engine` · spec M-14

```dax
_PL Δ LE =
VAR _compare      = [_PL FY Budget]
VAR _delta        = [_PL FY LE] - _compare
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _compare )
            ,BLANK ()
        ,[_PL Is Ratio]
            ,_delta * 100
        ,_delta
    )
```

### _Bridge Value

Folder `9 Engine` · spec C-40, T-05

```dax
_Bridge Value =
VAR _step         = SELECTEDVALUE ( dim_bridge_step[step_code] )
RETURN
    SWITCH (
        _step
        ,"START"
            ,[Bridge Comparison NR]
        ,"VOL"
            ,[Bridge Volume]
        ,"PRICE"
            ,[Bridge Price Mix]
        ,"FX"
            ,[Bridge FX]
        ,"SVC_SUB"
            ,CALCULATE ( [_Bridge NR CC Change], KEEPFILTERS ( TREATAS ( { "SUB" }, dim_line[line_code] ) ) )
        ,"SVC_PAY"
            ,CALCULATE ( [_Bridge NR CC Change], KEEPFILTERS ( TREATAS ( { "PAY" }, dim_line[line_code] ) ) )
        ,"SVC_APP"
            ,CALCULATE ( [_Bridge NR CC Change], KEEPFILTERS ( TREATAS ( { "APP" }, dim_line[line_code] ) ) )
        ,"SVC_PS"
            ,CALCULATE ( [_Bridge NR CC Change], KEEPFILTERS ( TREATAS ( { "PS" }, dim_line[line_code] ) ) )
        ,"ENT_P"
            ,CALCULATE (
                [_Bridge NR CC Change]
                ,REMOVEFILTERS ( param_entity_view )
                ,TREATAS ( { "P" }, param_entity_view[entity_view_code] )
            )
        ,"ENT_S"
            ,CALCULATE (
                [_Bridge NR CC Change]
                ,REMOVEFILTERS ( param_entity_view )
                ,TREATAS ( { "S" }, param_entity_view[entity_view_code] )
            )
        ,"ELIM"
            ,CALCULATE ( [_Bridge NR CC Change], KEEPFILTERS ( TREATAS ( { "ELIM_GR" }, dim_account[account_code] ) ) )
    )
```

### _KPI Value

Folder `9 Engine` · spec §5 K-01..K-12

```dax
_KPI Value =
VAR _kpi          = SELECTEDVALUE ( dim_kpi[kpi_code] )
RETURN
    SWITCH (
        _kpi
        ,"NR", [Net Revenue]
        ,"ORG_GROWTH", [KPI Organic Growth]
        ,"GM_PCT", [KPI Gross Margin %]
        ,"GTN_PCT", [KPI Gross-to-Net %]
        ,"ARR", [KPI ARR]
        ,"SVC_SHARE", [KPI Services Share]
        ,"AP_PCT", [KPI A&P % NR]
        ,"TAKE_RATE", [KPI Payments Take Rate]
        ,"IC_ELIM", [KPI IC Eliminated]
        ,"CM_PCT", [KPI CM %]
        ,"EBITDA", [Adjusted EBITDA]
        ,"OP", [Operating Profit]
        ,"UNITS", [KPI Units Sold]
        ,"NR_PER_UNIT", [KPI NR per Unit]
        ,"VOL_GROWTH", [KPI Volume Growth]
        ,"PRICE_MIX", [KPI Price Mix]
        ,"GMV", [KPI GMV]
        ,"MERCHANTS", [KPI Active Merchants]
        ,"SUB_GM_PCT", [KPI Subscription GM %]
        ,"RULE40", [KPI Rule of 40]
        ,"CP_OP_MARGIN", [KPI CP Operating Margin]
        ,"CC_OP_MARGIN", [KPI CC Operating Margin]
        ,"NP", [Net Profit]
        ,"ETR", [KPI Effective Tax Rate]
    )
```

### _Acc

Folder `Design` · spec L-10, F-01

```dax
_Acc =
SWITCH (
    [_Sel Entity]
    ,"S"
        ,"#6B48C8"
    ,"GROUP"
        ,"#3B4A5E"
    ,"#2453A6"
)
```

### _AccT

Folder `Design` · spec L-10, L-13

```dax
_AccT =
SWITCH (
    [_Sel Entity]
    ,"S"
        ,"#F0EBFB"
    ,"GROUP"
        ,"#EAEDF1"
    ,"#E8EEF8"
)
```

### Ent Card Acc

Folder `Design` · spec F-01

```dax
Ent Card Acc =
SWITCH (
    SELECTEDVALUE ( param_entity_view[entity_view_code] )
    ,"S"
        ,"#6B48C8"
    ,"GROUP"
        ,"#3B4A5E"
    ,"#2453A6"
)
```

### Ent Card Sub

Folder `Design` · spec F-01

```dax
Ent Card Sub =
SWITCH (
    SELECTEDVALUE ( param_entity_view[entity_view_code] )
    ,"S"
        ,"E-commerce SaaS services"
    ,"GROUP"
        ,"Consolidated"
    ,"Goods · retail, D2C, marketplaces"
)
```

### _Base Name

Folder `Design` · spec L-04

```dax
_Base Name =
SWITCH ( [_Sel Base Version], "LE", "Latest estimate", "B", "Budget", "Actual" )
```

### _Cmp A Name

Folder `Design` · spec L-04

```dax
_Cmp A Name =
SWITCH ( [_Sel Compare A], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year" )
```

### _Cmp B Name

Folder `Design` · spec L-04

```dax
_Cmp B Name =
SWITCH ( [_Sel Compare B], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year" )
```

### _Bridge Cmp Name

Folder `Design` · spec C-40, C-45

```dax
_Bridge Cmp Name =
VAR _compare_a    = [_Cmp A Name]
VAR _compare_b    = [_Cmp B Name]
RETURN
    SWITCH (
        TRUE ()
        ,NOT ISBLANK ( _compare_a )
            ,_compare_a
        ,NOT ISBLANK ( _compare_b )
            ,_compare_b
        ,"Prior year"
    )
```

### _Units Short

Folder `Design` · spec F-14

```dax
_Units Short =
[_Sel Currency] & IF ( [_Sel Units] = "K", " k", " m" )
```

### _Units Long

Folder `Design` · spec F-14

```dax
_Units Long =
[_Sel Currency] & IF ( [_Sel Units] = "K", " thousands", " millions" )
```

### _Window Label

Folder `Design` · spec L-04

```dax
_Window Label =
VAR _time_code    = [_Sel Time View]
VAR _time_label   = SWITCH ( _time_code, "MTD", "Month", "FY", "Full year", _time_code )
VAR _start        = MAX ( [_Win Start], 0 )
VAR _end          = [_Win End]
VAR _start_month  =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _start
    )
VAR _start_year   =
    CALCULATE (
        MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _start
    )
VAR _end_month    =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
VAR _end_year     =
    CALCULATE (
        MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _end
    )
RETURN
    SWITCH (
        TRUE ()
        ,_end < _start
            ,_time_label & ": no closed months"
        ,_start = _end
            ,_time_label & " " & _end_month & " " & _end_year
        ,_start_year = _end_year
            ,_time_label & " " & _start_month & "–" & _end_month & " " & _end_year
        ,_time_label & " " & _start_month & " " & _start_year & "–" & _end_month & " " & _end_year
    )
```

### Hdr Eyebrow

Folder `Design` · spec L-01, N-02, N-03

```dax
Hdr Eyebrow =
VAR _last_closed  = [_Last Closed Index]
VAR _closed_label =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
RETURN
    "ACME GROUP · MANAGEMENT REPORTING · ACTUALS CLOSED THROUGH " & UPPER ( _closed_label )
```

### Rail Sum Period

Folder `Design` · spec F-02..F-04

```dax
Rail Sum Period =
VAR _time_code    = [_Sel Time View]
VAR _time_label   = SWITCH ( _time_code, "MTD", "Month", "FY", "Full year", _time_code )
VAR _anchor       = [_Anchor Index]
VAR _anchor_label =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _anchor
    )
RETURN
    _time_label & " · " & _anchor_label
```

### Rail Sum Versions

Folder `Design` · spec F-05..F-07

```dax
Rail Sum Versions =
VAR _compare_a    = [_Cmp A Name]
VAR _compare_b    = [_Cmp B Name]
VAR _compares     =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _compare_a ) && ISBLANK ( _compare_b )
            ,BLANK ()
        ,ISBLANK ( _compare_b )
            ,_compare_a
        ,ISBLANK ( _compare_a )
            ,_compare_b
        ,_compare_a & ", " & _compare_b
    )
RETURN
    [_Base Name] & IF ( ISBLANK ( _compares ), " only", " vs " & _compares )
```

### Rail Sum Slice

Folder `Design` · spec F-08..F-11, F-32

```dax
Rail Sum Slice =
VAR _view         = [_Sel Entity]
VAR _region_n     = COUNTROWS ( ALL ( dim_region[region_name] ) )
VAR _region_sel   = COUNTROWS ( VALUES ( dim_region[region_name] ) )
VAR _regions      =
    IF (
        ISFILTERED ( dim_region[region_name] ) && _region_sel < _region_n
        ,_region_sel & " of " & _region_n & " regions"
        ,"All regions"
    )
VAR _channel_on   =
    ISFILTERED ( dim_channel[channel_name] )
        && NOT ISEMPTY ( CALCULATETABLE ( VALUES ( dim_channel[channel_name] ), KEEPFILTERS ( dim_channel[entity_code] = _view ) ) )
VAR _line_on      =
    ISFILTERED ( dim_line[line_name] )
        && NOT ISEMPTY ( CALCULATETABLE ( VALUES ( dim_line[line_name] ), KEEPFILTERS ( dim_line[entity_code] = _view ) ) )
VAR _segment_on   =
    ISFILTERED ( dim_segment[segment_name] )
        && NOT ISEMPTY ( CALCULATETABLE ( VALUES ( dim_segment[segment_name] ), KEEPFILTERS ( dim_segment[entity_code] = _view ) ) )
VAR _slices       = INT ( _channel_on ) + INT ( _line_on ) + INT ( _segment_on )
RETURN
    SWITCH (
        TRUE ()
        ,_view = "GROUP"
            ,_regions & ", consolidated"
        ,_regions = "All regions" && _slices = 0
            ,"All slices"
        ,_slices = 0
            ,_regions
        ,_regions & " · " & _slices & IF ( _slices = 1, " slice filtered", " slices filtered" )
    )
```

### Rail Sum Display

Folder `Design` · spec F-12..F-14

```dax
Rail Sum Display =
[_Units Short] & " · " & IF ( [_Sel FX Basis] = "CC", "constant currency", "actual rates" )
```

### Hdr Context

Folder `Design` · spec L-04

```dax
Hdr Context =
VAR _compare_a    = [_Cmp A Name]
VAR _compare_b    = [_Cmp B Name]
VAR _compares     =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _compare_a ) && ISBLANK ( _compare_b )
            ,BLANK ()
        ,ISBLANK ( _compare_b )
            ,_compare_a
        ,ISBLANK ( _compare_a )
            ,_compare_b
        ,_compare_a & " and " & _compare_b
    )
VAR _versions     = [_Base Name] & IF ( ISBLANK ( _compares ), " only", " vs " & _compares )
VAR _fx           = IF ( [_Sel FX Basis] = "CC", "constant currency", "actual rates" )
RETURN
    [_Window Label] & " · " & _versions & " · " & [_Units Short] & ", " & _fx & " · " & [Rail Sum Slice]
```

### Notice Strip

Folder `Design` · spec L-05, C-50

```dax
Notice Strip =
VAR _view         = [_Sel Entity]
VAR _fy           = [_Sel FY]
VAR _last_closed  = [_Last Closed Index]
VAR _fy_last      =
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fy
    )
VAR _closed_month =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
VAR _open_month   =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed + 1
    )
VAR _forecast     =
    CALCULATE (
        MAX ( dim_version[version_name] )
        ,REMOVEFILTERS ( dim_version )
        ,dim_version[is_latest_forecast] = TRUE ()
    )
VAR _n_fy         =
    SWITCH (
        TRUE ()
        ,_last_closed >= _fy_last
            ,"Full year " & _fy & " is closed: the latest estimate equals actuals."
        ,_last_closed < _fy_last - 11
            ,"Full year " & _fy & " compares the budget with the latest estimate (" & _forecast & ")."
        ,"Full year compares the budget with the latest estimate: Jan–" & _closed_month & " actuals plus " & _forecast & " for " & _open_month & "–Dec."
    )
VAR _ic           =
    IF (
        _view = "S"
        ,CALCULATE (
            [KPI IC Eliminated]
            ,REMOVEFILTERS ( param_entity_view )
            ,param_entity_view[entity_view_code] = "GROUP"
        )
    )
VAR _currency     = [_Sel Currency]
VAR _symbol       =
    CALCULATE (
        MAX ( param_reporting_currency[symbol] )
        ,REMOVEFILTERS ( param_reporting_currency )
        ,param_reporting_currency[currency_code] = _currency
    )
VAR _n_ic         =
    IF (
        _ic > 0
        ,"Revenue includes " & _symbol & FORMAT ( DIVIDE ( _ic, [_Units Divisor] ), IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) & IF ( [_Sel Units] = "K", "k", "m" )
            & " billed to Consumer Products; it is eliminated in the Group view."
    )
VAR _list         = { _n_fy, _n_ic, [Notices] }
RETURN
    CONCATENATEX ( FILTER ( _list, LEN ( [Value] ) > 0 ), [Value], "  ·  " )
```

### Seg Label

Folder `Design` · spec F-03..F-07, F-12..F-14, F-21

```dax
Seg Label =
VAR _currency     = [_Sel Currency]
VAR _symbol       =
    CALCULATE (
        MAX ( param_reporting_currency[symbol] )
        ,REMOVEFILTERS ( param_reporting_currency )
        ,param_reporting_currency[currency_code] = _currency
    )
RETURN
    SWITCH (
        TRUE ()
        ,ISINSCOPE ( param_compare_a[choice_name] )
            ,SWITCH ( SELECTEDVALUE ( param_compare_a[choice_code] ), "B", "Budget", "LE", "Latest est.", "PY", "Prior year", "None" )
        ,ISINSCOPE ( param_compare_b[choice_name] )
            ,SWITCH ( SELECTEDVALUE ( param_compare_b[choice_code] ), "B", "Budget", "LE", "Latest est.", "PY", "Prior year", "None" )
        ,ISINSCOPE ( param_fx_basis[fx_basis_name] )
            ,IF ( SELECTEDVALUE ( param_fx_basis[fx_basis_code] ) = "CC", "Constant currency", "Actual rates" )
        ,ISINSCOPE ( param_units[units_name] )
            ,_symbol & IF ( SELECTEDVALUE ( param_units[units_code] ) = "K", "k", "m" )
        ,ISINSCOPE ( param_time_view[time_view_name] )
            ,SWITCH ( SELECTEDVALUE ( param_time_view[time_view_code] ), "MTD", "Month", "FY", "FY", SELECTEDVALUE ( param_time_view[time_view_name] ) )
        ,ISINSCOPE ( param_breakdown_field[Breakdown] )
            ,[_Breakdown Short]
    )
```

### Version Desc

Folder `Design` · spec F-05

```dax
Version Desc =
VAR _code         = SELECTEDVALUE ( param_base_version[choice_code] )
VAR _fy           = [_Sel FY]
VAR _last_closed  = [_Last Closed Index]
VAR _fy_last      =
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fy
    )
VAR _closed_to    = MIN ( _last_closed, _fy_last )
VAR _closed_month =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _closed_to
    )
VAR _open_month   =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _closed_to + 1
    )
VAR _none_closed  = _last_closed < _fy_last - 11
RETURN
    SWITCH (
        _code
        ,"A"
            ,IF ( _none_closed, "Closed months only: none yet in FY" & _fy, "Closed months only, Jan–" & _closed_month & " " & _fy )
        ,"LE"
            ,SWITCH (
                TRUE ()
                ,_last_closed >= _fy_last
                    ,"Equals actuals: FY" & _fy & " is closed"
                ,_none_closed
                    ,"Latest forecast for every month of FY" & _fy
                ,"Actual Jan–" & _closed_month & " plus the latest forecast for " & _open_month & "–Dec"
            )
        ,"Approved FY" & _fy & " budget, phased by month"
    )
```

### Month Item Fill

Folder `Design` · spec F-03

```dax
Month Item Fill =
VAR _fy           = [_Sel FY]
VAR _month        = SELECTEDVALUE ( param_period[month_number] )
VAR _last_closed  = [_Last Closed Index]
VAR _index        =
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fy
        ,dim_month[month_number] = _month
    )
RETURN
    IF ( _index > _last_closed, "#F6F8FA", "#FFFFFF" )
```

### Month Item Font

Folder `Design` · spec F-03

```dax
Month Item Font =
VAR _fy           = [_Sel FY]
VAR _month        = SELECTEDVALUE ( param_period[month_number] )
VAR _last_closed  = [_Last Closed Index]
VAR _index        =
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fy
        ,dim_month[month_number] = _month
    )
RETURN
    IF ( _index > _last_closed, "#4F5C6C", "#101B2B" )
```

### _Slice Sub

Folder `Design` · spec F-08..F-11, F-32

```dax
_Slice Sub =
SWITCH (
    [_Sel Entity]
    ,"S"
        ,"Region, sales motion, service line and segment"
    ,"GROUP"
        ,"Only region applies in the consolidated view"
    ,"Region, channel, category and price tier"
)
```

### Slice Hdr Region

Folder `Design` · spec F-08

```dax
Slice Hdr Region =
VAR _total        = COUNTROWS ( ALL ( dim_region[region_name] ) )
VAR _selected     = COUNTROWS ( VALUES ( dim_region[region_name] ) )
RETURN
    "Region · " & IF ( ISFILTERED ( dim_region[region_name] ) && _selected < _total, _selected & " of " & _total, "All " & _total )
```

### Slice Hdr Channel

Folder `Design` · spec F-09

```dax
Slice Hdr Channel =
VAR _view         = [_Sel Entity]
VAR _total        =
    CALCULATE (
        COUNTROWS ( dim_channel )
        ,REMOVEFILTERS ( dim_channel )
        ,dim_channel[entity_code] = _view
        ,dim_channel[is_unassigned] = FALSE ()
    )
VAR _selected     =
    CALCULATE (
        COUNTROWS ( dim_channel )
        ,KEEPFILTERS ( dim_channel[entity_code] = _view )
        ,KEEPFILTERS ( dim_channel[is_unassigned] = FALSE () )
    )
VAR _count        = IF ( ISFILTERED ( dim_channel[channel_name] ) && _selected > 0 && _selected < _total, _selected & " of " & _total, "All " & _total )
RETURN
    IF ( _view <> "GROUP", IF ( _view = "S", "Sales motion", "Channel" ) & " · " & _count )
```

### Slice Hdr Line

Folder `Design` · spec F-10

```dax
Slice Hdr Line =
VAR _view         = [_Sel Entity]
VAR _total        =
    CALCULATE (
        COUNTROWS ( dim_line )
        ,REMOVEFILTERS ( dim_line )
        ,dim_line[entity_code] = _view
        ,dim_line[is_unassigned] = FALSE ()
    )
VAR _selected     =
    CALCULATE (
        COUNTROWS ( dim_line )
        ,KEEPFILTERS ( dim_line[entity_code] = _view )
        ,KEEPFILTERS ( dim_line[is_unassigned] = FALSE () )
    )
VAR _count        = IF ( ISFILTERED ( dim_line[line_name] ) && _selected > 0 && _selected < _total, _selected & " of " & _total, "All " & _total )
RETURN
    IF ( _view <> "GROUP", IF ( _view = "S", "Service line", "Category" ) & " · " & _count )
```

### Slice Hdr Segment

Folder `Design` · spec F-11

```dax
Slice Hdr Segment =
VAR _view         = [_Sel Entity]
VAR _total        =
    CALCULATE (
        COUNTROWS ( dim_segment )
        ,REMOVEFILTERS ( dim_segment )
        ,dim_segment[entity_code] = _view
        ,dim_segment[is_unassigned] = FALSE ()
    )
VAR _selected     =
    CALCULATE (
        COUNTROWS ( dim_segment )
        ,KEEPFILTERS ( dim_segment[entity_code] = _view )
        ,KEEPFILTERS ( dim_segment[is_unassigned] = FALSE () )
    )
VAR _count        = IF ( ISFILTERED ( dim_segment[segment_name] ) && _selected > 0 && _selected < _total, _selected & " of " & _total, "All " & _total )
RETURN
    IF ( _view <> "GROUP", IF ( _view = "S", "Customer segment", "Price tier" ) & " · " & _count )
```

### Slice Group Notice

Folder `Design` · spec F-32, T-15

```dax
Slice Group Notice =
IF (
    [_Sel Entity] = "GROUP"
    ,"Channel, category and segment values differ by company, so these filters are off in the consolidated view and read All. Pick Consumer Products or Commerce Cloud to slice by them."
)
```

### Slice Notice Fill

Folder `Design` · spec F-32

```dax
Slice Notice Fill =
IF ( [_Sel Entity] = "GROUP", "#FBF4E4", "#FFFFFF" )
```

### Slice Notice Rule

Folder `Design` · spec F-32

```dax
Slice Notice Rule =
IF ( [_Sel Entity] = "GROUP", "#EBD9AE", "#FFFFFF" )
```

### _Breakdown Short

Folder `Design` · spec F-21

```dax
_Breakdown Short =
VAR _order        = SELECTEDVALUE ( param_breakdown_field[Breakdown Order], 1 )
VAR _is_services  = [_Sel Entity] = "S"
RETURN
    SWITCH (
        _order
        ,0
            ,"Region"
        ,1
            ,IF ( _is_services, "Sales motion", "Channel" )
        ,2
            ,IF ( _is_services, "Service line", "Category" )
        ,3
            ,IF ( _is_services, "Segment", "Price tier" )
        ,"Company"
    )
```

### Breakdown Allowed

Folder `Design` · spec F-21

```dax
Breakdown Allowed =
VAR _order        = SELECTEDVALUE ( param_breakdown_field[Breakdown Order] )
VAR _is_group     = [_Sel Entity] = "GROUP"
RETURN
    IF ( IF ( _is_group, _order IN { 0, 4 }, _order IN { 0, 1, 2, 3 } ), 1 )
```

### PL Notes

Folder `Design` · spec L-11, L-14

```dax
PL Notes =
VAR _is_leaf      = ISINSCOPE ( dim_pl_row[account_label] )
VAR _line         = SELECTEDVALUE ( dim_pl_row[line_code] )
VAR _label        = SELECTEDVALUE ( dim_pl_row[line_label] )
VAR _type         = SELECTEDVALUE ( dim_pl_row[row_type] )
VAR _view         = [_Sel Entity]
VAR _alias        =
    SWITCH (
        _view
        ,"P"
            ,LOOKUPVALUE ( dim_report_line[alias_products], dim_report_line[line_code], _line )
        ,"S"
            ,LOOKUPVALUE ( dim_report_line[alias_services], dim_report_line[line_code], _line )
    )
VAR _parent       = LOOKUPVALUE ( dim_report_line[parent_line_code], dim_report_line[line_code], _line )
VAR _category     =
    IF (
        _type IN { "input_block", "group_total" } && _parent = ""
        ,LOOKUPVALUE ( dim_report_line[ifrs18_category], dim_report_line[line_code], _line )
    )
VAR _list         =
    {
        IF ( _alias <> _label, _alias )
        ,SELECTEDVALUE ( dim_pl_row[tag] )
        ,_category
    }
RETURN
    IF ( NOT _is_leaf, CONCATENATEX ( FILTER ( _list, LEN ( [Value] ) > 0 ), [Value], " · " ) )
```

### PL Hdr Base

Folder `Design` · spec L-07

```dax
PL Hdr Base =
VAR _time_code    = [_Sel Time View]
VAR _anchor       = [_Anchor Index]
VAR _anchor_label =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _anchor
    )
VAR _window       =
    SWITCH (
        _time_code
        ,"FY"
            ,"Full year " & [_Sel FY]
        ,"MTD"
            ,_anchor_label
        ,_time_code & " " & _anchor_label
    )
RETURN
    _window & " · " & [_Base Name]
```

### PL Hdr Cmp A

Folder `Design` · spec L-07, K-20

```dax
PL Hdr Cmp A =
IF ( ISBLANK ( [_Cmp A Name] ), "Compare A: none", "vs " & [_Cmp A Name] )
```

### PL Hdr Cmp B

Folder `Design` · spec L-07, K-20

```dax
PL Hdr Cmp B =
IF ( ISBLANK ( [_Cmp B Name] ), "Compare B: none", "vs " & [_Cmp B Name] )
```

### PL Hdr FY

Folder `Design` · spec L-07

```dax
PL Hdr FY =
"Full year " & [_Sel FY]
```

### Kpi Toolbar Caption

Folder `Design` · spec L-06, K-20

```dax
Kpi Toolbar Caption =
VAR _compare_a    = [_Cmp A Name]
VAR _compare_b    = [_Cmp B Name]
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _compare_a ) && ISBLANK ( _compare_b )
            ,"No comparison selected"
        ,ISBLANK ( _compare_b )
            ,"Changes vs " & _compare_a & ", same months"
        ,ISBLANK ( _compare_a )
            ,"Changes vs " & _compare_b & ", same months"
        ,"Changes vs " & _compare_a & " and " & _compare_b & ", same months"
    )
```

### Bridge Subtitle

Folder `Design` · spec C-40

```dax
Bridge Subtitle =
VAR _view         = [_Sel Entity]
VAR _method       =
    SWITCH (
        _view
        ,"S"
            ,"Change by service line at constant currency; FX is the translation effect."
        ,"GROUP"
            ,"Change by company at constant currency; FX is the translation effect."
        ,"Volume and price / mix at constant currency; FX is the translation effect."
    )
RETURN
    [_Bridge Cmp Name] & " to " & [_Base Name] & ", " & [_Units Long] & ". " & _method
```

### Var Title

Folder `Design` · spec C-45

```dax
Var Title =
"Largest variances vs " & [_Bridge Cmp Name]
```

### Var Subtitle

Folder `Design` · spec C-45

```dax
Var Subtitle =
"Top 8 lines by size of Δ, " & [_Units Long]
```

### Prof Title

Folder `Design` · spec C-46

```dax
Prof Title =
"Profitability by " & LOWER ( [_Breakdown Short] )
```

### Prof Subtitle

Folder `Design` · spec C-46

```dax
Prof Subtitle =
[_Window Label] & ", " & [_Units Long]
```

### CM Title

Folder `Design` · spec C-46

```dax
CM Title =
"Contribution margin by " & LOWER ( [_Breakdown Short] )
```

### CM Subtitle

Folder `Design` · spec C-46

```dax
CM Subtitle =
VAR _entity       =
    SWITCH ( [_Sel Entity], "S", "Commerce Cloud", "GROUP", "ACME Group", "Consumer Products" )
RETURN
    "Dashed line: " & _entity & " average " & FORMAT ( [KPI CM %], "0.0%" ) & ". Scale 0–60%."
```

### KPI Fav Sign

Folder `Design` · spec K-20, N-07

```dax
KPI Fav Sign =
SWITCH ( SELECTEDVALUE ( dim_kpi[better_when] ), "Higher", 1, "Lower", -1, "Neutral", 0 )
```

### PL Fav Off

Folder `Design` · spec L-12, N-07

```dax
PL Fav Off =
IF ( NOT ISINSCOPE ( dim_pl_row[account_label] ) && SELECTEDVALUE ( dim_pl_row[line_code] ) = "ETR_PCT", 1 )
```

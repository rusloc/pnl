# Measure dictionary — ACME Unified P&L (Track B)

> Generated from `pbi-report/ACME Unified PnL/ACME Unified PnL.SemanticModel/definition/tables/_measures.tmdl` (draft, updated 2026-10-22: T-05 fix, query-plan performance pass, ADR-0007 KPI trend contract K-24, Key figures trend overlay K-24/K-25, info pop-ups L-15; review batch: KPI card v2 tile body, header status and applied-filters list, notice strip removed, Profitability breakdown hint; 2026-10-23: KPI Trend / _KPI Trend Value dropped, Period flyout v2 measures, notice rows of the applied-filters pop-up; ADR-0008: _Amt Raw / _Rep Sum on pre-translated columns, _Elim Amount on fact_pl_elim; parity rules: Prof Subtitle, Filter Value slice order, expanded-rail period sentence); 2026-10-27: P&L redesign v4 — Vitals, Analysis and Profitability in two pages each, ADR-0012 ⓘ per card and panel: 65 measures added, 15 orphans removed, NR bridge steps gated on Bridge Step In View, mix heatmap per company; parity check B vs C, same day: Vitals status vs Budget only, Profitability at constant currency, heatmap colour = column GM %, Revenue mix card Sub % / Pay %, profit-bridge GM rate over the company's own lines, _Vitals Parts, Track C info copy, 12 measures added). Owner of every measure: **bip**. If you change a measure in Desktop, update this file in the same commit (CLAUDE.md › Track B: dictionary in lockstep with the model).

253 measures in table `_measures`; folder `9 Engine` is hidden from report authors.

| Folder | Measures | Purpose |
|---|---:|---|
| `1 Statement` | 11 | Matrix columns of the income statement (Variance layout), in the selected units |
| `1 Statement\Formatting` | 5 | Conditional-format colours for the matrix (L-12, L-13) |
| `2 Versions` | 7 | Base, comparisons, prior year, full-year outlook (D-31), unscaled |
| `2 Versions\Subtotals` | 10 | Spine subtotals of the base version (step 1-19), unscaled |
| `3 KPIs` | 6 | KPI slot measures used by the tiles (§5) |
| `3 KPIs\Items` | 38 | One measure per KPI formula, unscaled; v4 adds Opex % NR, S&M / R&D / G&A % NR, subscription and payments shares, payments GM %, GMV per merchant, net new ARR, FY outlook vs budget; v4 adds Opex % NR, S&M / R&D / G&A % NR, subscription and payments shares, payments GM %, GMV per merchant, net new ARR, FY outlook vs budget; v4 adds Opex % NR, S&M / R&D / G&A % NR, subscription and payments shares, payments GM %, GMV per merchant, net new ARR, FY outlook vs budget; v4 adds Opex % NR, S&M / R&D / G&A % NR, subscription and payments shares, payments GM %, GMV per merchant, net new ARR, FY outlook vs budget |
| `3 KPIs\Vitals` | 4 | Vitals card body (one SVG per card: value, Δ rows, status chip), status inputs and the ⓘ sub-line (redesign v4, ADR-0012) |
| `4 Analysis` | 15 | Net revenue bridge (C-40) with the constant-currency subtotal bar and in-view gating, largest variances (C-45), pager and bridge titles |
| `4 Analysis\Profit bridge` | 2 | Profit bridge Budget Adj. EBITDA → … → operating profit, D&A and adjusting items as steps (redesign v4) |
| `4 Analysis\Variances` | 9 | Largest variances v4: Δ vs PY, of which FX, n.m. text, alloc. tag, coverage footers (C-45) |
| `5 Profitability` | 18 | Profitability by region (C-46): 8-column table with CM Δ status dot, concentration shares, growth × margin inputs, mix heatmap cells |
| `6 Context` | 5 | Data status, context line, notices, panel notes (L-01, L-04, L-05); Track A reads them, the report does not |
| `9 Engine` | 53 | Hidden: selections, time window, translation, entity view, row logic, unscaled statement values |
| `Design` | 70 | Ledger design helpers: identity colour, header status and applied-filters list, rail texts, flyout labels, favourability inputs for rules-based colours, Key figures tile body (KPI Tile SVG), info pop-up paragraphs, Period flyout v2 (summary sentence, grid label, month labels, covered-months strip, open-month hint), notice rows of the applied-filters pop-up (no engine calls except CM Subtitle, KPI Tile SVG) |

## How the engine fits together

```text
PL Base / PL Δ A / KPI Value / Bridge Value / LV ... display layer: amounts / _Units Divisor (F-14, N-06); ratios, % and pp unscaled
  └ _PL Base / _PL Compare A ...  unscaled statement values; ratio rows: numerator line / denominator line (dim_pl_row formulas)
      └ Base Amount / Compare A / Compare B Amount   all read _Amt Window (param_eval: BASE, CMP_A, CMP_B)
          └ _Amt Window     version x window as one (version, month) filter; LE = Actual closed months + latest forecast open months
              └ _Amt Row    statement row -> one account filter: block / subtotal / leaf account (D-32)
                  └ _Amt Entity  entity view as filter tables; ACME Group = both entities + eliminations (C-36)
                  │   └ _Elim Amount  ACME Group only: SUM over fact_pl_elim under the account filter (ADR-0008 (b))
                      └ _Amt Raw     units / merchants: _Local Sum; constant currency: 4 currencies x FY budget factor; else _Rep Sum
                          ├ _Rep Sum     pre-translated amount_usd / _eur / _gbp (gmv_*) sums (ADR-0008 (a), D-30)
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
| `FY LE Amount` | Latest estimate for the whole selected fiscal year: _Amt Window with base Latest estimate over the full year, so Actual on closed months plus the latest forecast on open months in one evaluation. | M-14, C-02 | `#,0;-#,0;0` |
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
| `KPI Opex % NR` | Opex % of net revenue: -(sales & marketing + R&D + G&A) / NR = -(OPEX - OOI) / NR. Excludes other operating items, D&A and adjusting items (spec KPI §5 1.3). Lower is better. | §5 Vitals, redesign v4 | `0.0%` |
| `KPI S&M % NR` | S&M expense as a share of net revenue (Opex % NR sub-metric). | §5 Vitals, redesign v4 | `0.0%` |
| `KPI R&D % NR` | R&D expense as a share of net revenue (Opex % NR sub-metric). | §5 Vitals, redesign v4 | `0.0%` |
| `KPI G&A % NR` | G&A expense as a share of net revenue (Opex % NR sub-metric). | §5 Vitals, redesign v4 | `0.0%` |
| `KPI Subscription Share` | Platform subscriptions net revenue / net revenue (Commerce Cloud revenue mix). | §5 Vitals, redesign v4 | `0.0%` |
| `KPI Payments Share` | Payments net revenue / net revenue (Commerce Cloud revenue mix). | §5 Vitals, redesign v4 | `0.0%` |
| `KPI Payments GM %` | Gross profit / NR, Payments (same pattern as KPI Subscription GM %). | §5 Vitals, redesign v4 | `0.0%` |
| `KPI GMV per Merchant` | GMV processed / active merchants at the window end, reporting currency per merchant. | §5 Vitals, redesign v4 | `#,0` |
| `KPI Net New ARR` | ARR (run-rate) minus ARR evaluated as Compare B (prior year end by default), unscaled. | §5 Vitals, redesign v4 | `#,0;-#,0;0` |
| `KPI FY Outlook NR` | Latest estimate of net revenue for the whole selected fiscal year (closed months actual + latest forecast, C-02), unscaled. | §5 Vitals, redesign v4 | `#,0;-#,0;0` |
| `KPI FY Budget NR` | Budget net revenue for the whole selected fiscal year, unscaled. | §5 Vitals, redesign v4 | `#,0;-#,0;0` |
| `KPI FY Outlook EBITDA` | Latest estimate of Adjusted EBITDA for the whole fiscal year, unscaled. | §5 Vitals, redesign v4 | `#,0;-#,0;0` |
| `KPI FY Budget EBITDA` | Budget Adjusted EBITDA for the whole fiscal year, unscaled. | §5 Vitals, redesign v4 | `#,0;-#,0;0` |
| `KPI FY Attainment` | FY outlook NR / FY budget NR. | §5 Vitals, redesign v4 | `0.0%` |

## 3 KPIs\Vitals

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `KPI Status` | Status word of the KPI vs Budget (lower case as the v4 HTML chipTxt, parity PV-08): on track, ahead, watch, off track; blank when neutral. | §6, ADR-0012 | — |
| `Vitals Card SVG` | Vitals card (v4, ADR-0012): title, status chip vs Budget (lower-case word, PV-01 / PV-08), value, rows vs Compare A / B; face text from _Vitals Parts. Tier sizes: hero 335 x 320, secondary 292 x 155, driver 257 x 279. | §5, ADR-0012 | — |
| `KPI Info Sub` | Vitals info sub-values as Track C's value lists (js-report/lib/engine/vitals.ts, parity PV-09 / PV-10): label: value pairs joined by ' - '. | §5, ADR-0012 | — |
| `_Vitals Parts` | Vitals card face, PATHITEM-separated: 1 value · 2-5 row 1 (name, Δ amount, Δ % or pp or on plan, ink) · 6-9 row 2 · 10 status (vs Budget, PV-01). Rows: Compare A and Compare B; only the row whose comparison is Budget is coloured (build-brief §0); FY outlook: vs FY Budget and EBITDA vs FY budget. Revenue mix (MIX): Sub % / Pay %, one row Sub / Pay vs PY in pp, neutral (PV-04). Read by Vitals Card SVG and the parity tests. The base, Compare A, Compare B and Budget values come from one 4-row iteration (one query plan; 2.5x faster than four CALCULATEs). | redesign v4 | — |

## 4 Analysis

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Bridge Comparison NR` | Net revenue of the bridge comparison (actual rates). | C-40 | `#,0;-#,0;0` |
| `Bridge Volume` | Consumer Products volume step, per lowest slice k (region x channel x category x tier): (U base - U comparison) x NRcc comparison / U comparison. A slice without comparison units counts entirely as volume. Set-based: one grouped pass over the slices with the base window (_Amt Window rules, read from param_eval) and the bridge comparison window (Bridge Comparison Amount rules), NR at constant currency (budget rate of the selected year, per region currency). Same result as evaluating the engine per slice. | C-40, K-11 | `#,0;-#,0;0` |
| `Bridge Price Mix` | Consumer Products price / mix step = NR change at constant currency - volume (so steps add up exactly). | C-40, K-12 | `#,0;-#,0;0` |
| `Bridge FX` | FX = (NR base - NRcc base) - (NR comparison - NRcc comparison). Zero at constant currency. | C-40, T-10 | `#,0;-#,0;0` |
| `Bridge Value` | Waterfall value per dim_bridge_step in the selected units (display only). | C-40, T-05 | dynamic |
| `LV Base` | Base amount of the leaf line (account) in the current row, in the selected units (display only). | C-45 | dynamic |
| `LV Comparison` | Bridge-comparison amount of the leaf line, in the selected units (display only). | C-45 | dynamic |
| `LV Δ` | Base - comparison on signed values (positive = favourable), in the selected units (display only). | C-45, M-10 | dynamic |
| `LV Δ %` | (Base - comparison) / /comparison/ on unscaled values. | C-45 | `+0.0%;−0.0%;0.0%` |
| `LV Abs Δ` | /base - comparison/, unscaled — ranks the top 8 leaf lines (TopN filter of the variances table). | C-45 | `#,0;-#,0;0` |
| `LV Δ Color` | Green favourable / red unfavourable for the variances table (sign of base - comparison). | L-12, N-07 | — |
| `Bridge Step Delta` | Net revenue bridge chart input: the step's change (START = the comparison level, CC_SUB and END = 0, their bar is the running level); blank for steps of another company. The chart builds the running level with a visual calculation (RUNNINGSUM). | C-40, redesign v4 | dynamic |
| `Bridge Is Total` | 1 for the level bars of the net revenue bridge (comparison, constant-currency subtotal, actual), 0 for change steps, blank for steps of another company (so the chart drops them; the visual calculations would keep a row with any non-blank field). | C-40, redesign v4 | `0` |
| `Bridge Axis Min` | Start of the bridge value axis (truncated, design: the axis does not start at zero): lowest level minus 1.5 x the spread of the levels and /FX/, in the selected units. | C-40, redesign v4 | dynamic |
| `Bridge Step In View` | 1 when the bridge step on the axis belongs to the selected company (Bridge Is Total reads it, so steps of another company drop out of the redesigned NR bridge). | C-40, redesign v4 | `0` |

## 4 Analysis\Profit bridge

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Profit Step Delta` | Profit bridge chart input in the selected units: BUD = comparison Adj. EBITDA, then the changes, ACT and OP = 0 (their bar is the running level), DA and ADJ = actual levels. | C-46, redesign v4 | dynamic |
| `Profit Is Total` | 1 for the level bars of the profit bridge (comparison EBITDA, actual EBITDA, operating profit). | C-46, redesign v4 | `0` |

## 4 Analysis\Variances

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `LV Δ B` | Leaf line vs Compare B (prior year by default), signed (positive = favourable), in the selected units. | C-45, redesign v4 | dynamic |
| `LV FX` | Of which FX: the translation part of the leaf line's Δ = (base - base at CC) - (comparison - comparison at CC), in the selected units (gap analysis P4). Δ - FX is the business change. | C-45, redesign v4 | dynamic |
| `LV Δ % Text` | Δ % of the leaf line as text: n.m. when /comparison/ < 2.0 in the selected units or /Δ %/ > 50 %; blank when the line has no data in either version (both blank or both exactly 0: the line is hidden, parity PV-23). | C-45, redesign v4 | — |
| `LV Alloc Tag` | 'alloc.' on leaf lines below contribution margin when the cut is Sales motion, Service line or Segment: opex and below are booked by region and allocated by NR share to those slices (C-31). | C-45, redesign v4 | — |
| `LV Coverage 8` | Variances footer for Top 8: shown lines, coverage Σ/Δ shown/ / Σ/Δ all/ over the leaf accounts down to operating profit, the Δ of all other lines and the total P&L Δ at operating profit (Σ of every leaf Δ). Line count = every leaf line to OP in scope (PV-12). | C-45, redesign v4 | — |
| `LV Coverage 12` | Variances footer for Top 12: shown lines, coverage Σ/Δ shown/ / Σ/Δ all/ over the leaf accounts down to operating profit, the Δ of all other lines and the total P&L Δ at operating profit (Σ of every leaf Δ). Line count = every leaf line to OP in scope (PV-12). | C-45, redesign v4 | — |
| `LV Coverage All` | Variances footer for Top All: shown lines, coverage Σ/Δ shown/ / Σ/Δ all/ over the leaf accounts down to operating profit, the Δ of all other lines and the total P&L Δ at operating profit (Σ of every leaf Δ). Line count = every leaf line to OP in scope (PV-12). | C-45, redesign v4 | — |
| `LV Coverage Value` | Coverage of the Top 8 lines: Σ/Δ/ of the 8 largest leaf variances / Σ/Δ/ of all leaf lines down to operating profit (test and Track A value). | C-45, redesign v4 | `0.0%` |
| `LV Leaf Count` | Leaf lines of the P&L down to operating profit that are shown: lines with data in the base or the comparison (both blank or both exactly 0 = hidden, Track C's rule); the denominator of the variances footer (parity PV-12 / PV-23). | C-45, redesign v4 | `0` |

## 5 Profitability

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Prof NR Share` | Share of total net revenue across the visible slice values. | C-46 | `0.0%` |
| `Prof NR Δ %` | Net revenue growth vs the bridge comparison. | C-46 | `+0.0%;−0.0%;0.0%` |
| `Prof NR Δ Color` | Green / red for net revenue growth. | L-12, N-07 | — |
| `Slice Member In View` | 1 when the slice value in context belongs to the selected entity (unassigned and blank members excluded). Region always; entity rows only in the Group view; channel / category / segment never in the Group view. Used as visual-level filter on slicers and the profitability table. | F-09..F-11, F-21, F-32 | `0` |
| `Prof Net Revenue` | Net revenue of the slice at constant currency (selected year's budget rates) in the selected units: Profitability is always at CC (parity PV-02, Track C rule). | C-46, F-14, N-06 | — |
| `Prof NR Δ % CC` | Net revenue vs the bridge comparison at constant currency (budget rates of the selected year), the default when comparing to Budget / PY (README decision 7). | C-46, redesign v4 | `+0.0%;−0.0%;0.0%` |
| `Prof CM Δ pp` | CM % minus the comparison's CM %, in pp, at constant currency (PV-02); the only status column of the table. | C-46, redesign v4 | `+0.0" pp";−0.0" pp";0.0" pp` |
| `Prof CM Dot` | Status dot of the CM Δ column (colour from Prof CM Dot Color). | C-46, redesign v4 | — |
| `Prof Contribution` | Contribution margin of the slice at constant currency in the selected units (PV-02). | C-46, redesign v4 | — |
| `Prof Adj EBITDA` | Adjusted EBITDA of the slice at constant currency in the selected units (PV-02; by region opex is booked, C-31). | C-46, redesign v4 | — |
| `Conc Share` | Concentration: the region's share of net revenue, contribution or Adj. EBITDA (dim_conc_level) at constant currency (PV-02). | C-46, redesign v4 | `0.0%` |
| `Prof Company Growth` | Company organic growth (reference line of the growth x margin chart). | C-46, redesign v4 | `+0.0%;−0.0%;0.0%` |
| `Prof Company CM %` | Company CM % at constant currency: the horizontal reference line of the growth x margin chart (PV-02). | C-46, redesign v4 | `0.0%` |
| `_Heat Cell Raw` | Mix heatmap cell text before the company switch: net revenue at constant currency (display units) over its share of the region (PV-02). | C-46, redesign v4 | — |
| `Heat Cell` | Mix heatmap cell: net revenue and share of the region (two lines). Company view: its own service lines / categories. Group view: both companies' lines, each computed in its own company (share = of that company's revenue in the region). | C-46, redesign v4 | — |
| `Prof GM %` | Gross margin % of the slice at constant currency (Profitability table, PV-02). | C-46, redesign v4 | `0.0%` |
| `Prof CM %` | Contribution margin % of the slice at constant currency (Profitability table and growth x margin y axis, PV-02). | C-46, redesign v4 | `0.0%` |
| `_Heat Colour GM` | Mix heatmap colour basis: gross margin % of the column (service line / category) over all regions, at constant currency (parity PV-03, build-brief §3). | C-46, redesign v4 | `0.0%` |

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
| `_Amt Raw` | Amount in the reporting currency (ADR-0008 §4.2). Units and merchants: _Local Sum, not translated. Constant currency (C-12): per functional currency, the local sum x the BUDGET rate of the reporting currency / the BUDGET rate of that currency, both for the selected fiscal year; C-10 gives one BUDGET rate per currency and year, so this equals translating month by month. Otherwise _Rep Sum: plain sums of the loader's pre-translated columns (each row at its version's own rate type: ACTUAL_AVG for actual and forecast, BUDGET for budget; C-11, C-13). The FX basis is read with SELECTEDVALUE on fx_basis_name, the column the report slicer filters: with a literal filter on that column the engine drops the unused branch from the query plan (statement -40 %, profitability -55 %, ADR-0008 §5.2). Nothing selected = actual rates (the default); filters on fx_basis_code (Track A, CC measures) still resolve the name. If param_fx_basis renames the constant-currency row, change the literal here and in _Elim Amount (the ADR-0008 FX paths test fails until then). | D-30, C-10, C-11, C-12, C-13 | — |
| `_Rep Sum` | Sum of the loader's pre-translated columns in the reporting currency (ADR-0008 (a)): amount_usd / amount_eur / amount_gbp on the P&L facts (direct accounts of fact_pl plus fact_pl_allocated, as _Local Sum), gmv_usd / gmv_eur / gmv_gbp on fact_operational. Each row is translated at its version's own rate type, so one column serves every version. The currency is SELECTEDVALUE on param_reporting_currency[currency_code] (the column the slicer and Track A filter, so unused branches leave the plan), USD when nothing is selected (the is_default row). Blank for units, merchants and any other currency. | D-30, C-11, C-13, ADR-0008 | — |
| `_Elim Amount` | Group eliminations, read from fact_pl_elim (ADR-0008 (b)): the loader writes every counterparty-tagged fact_pl row there, negated, on its block's elimination account (ELIM_GR, ELIM_VSC), so the current account filter picks them directly. A block or subtotal includes its ELIM_* account and gets the elimination; a leaf like GR_S1 does not; the ELIM_* leaf shows it. Contribution margin and below are unchanged (T-02). Reporting currency: the pre-translated column; constant currency: per functional currency, the local sum x the selected year's BUDGET factor. FX basis and currency are read as in _Amt Raw / _Rep Sum (SELECTEDVALUE on the filtered columns, for branch pruning). | C-35, C-36, D-33 | — |
| `_Amt Entity` | Applies the entity view in one evaluation. Consumer Products / Commerce Cloud: that entity only; a slice selection that holds only the other entity's values is ignored (it comes back when you switch back). ACME Group: both entities plus eliminations (_Elim Amount; fact_pl_elim has no slice relationships), channel / category / segment filters off. Entity and slices are passed as filter tables, so no branch evaluates the engine twice. | F-01, C-36, F-30, F-32 | — |
| `_Amt Row` | Statement row logic as one account filter. Without a dim_pl_row filter it passes through. Input block: its accounts. Group total (OPEX): its child blocks. Subtotal / memo: every input block above it (signed sums, M-01), which equals the dim_report_line formula. Leaf: the account. Ratio rows get no accounts (handled one level up in the PL measures). | D-32, M-01, M-03 | — |
| `_Amt Actual` | Version Actual (ACT) for the current months. | C-01, D-31 | — |
| `_Amt Budget` | Version Budget (BUD) for the current months. | C-05, D-31 | — |
| `_NR CC Base` | Net revenue of the base at constant currency. | C-12, C-40 | `#,0;-#,0;0` |
| `_PY NR CC` | Prior-year net revenue at the selected year's budget rates. | C-12, K-02 | `#,0;-#,0;0` |
| `_Units Base` | Units sold for the base version and window. | K-09 (Products) | `#,0` |
| `_NR CC Bridge Cmp` | Net revenue of the bridge comparison at constant currency. | C-40 | `#,0;-#,0;0` |
| `_Units Bridge Cmp` | Units of the bridge comparison. | C-40 | `#,0` |
| `_Bridge NR CC Change` | Change in net revenue at constant currency (base - comparison). | C-40 | `#,0;-#,0;0` |
| `_Bridge Elim Change` | Eliminations step of the Group bridge (C-40): change at constant currency of the eliminated intercompany revenue (account ELIM_GR, base - comparison). Consumer Products + Commerce Cloud + this step = the Group NR change at constant currency, so comparison + steps = base NR (T-05). | C-40, C-36, T-05 | `#,0;-#,0;0` |
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
| `_Bridge Value` | Unscaled waterfall value per dim_bridge_step: comparison NR, then the entity's steps; blank for a step of another entity (its dim_bridge_step row is filtered out). Comparison + steps = base NR (T-05). Steps with the same formula share one branch (service lines, entities): every branch adds its measures to the query plan, used or not. | C-40, T-05 | — |
| `_KPI Value` | Unscaled value of the KPI tile in the current dim_kpi row (slots swap content by entity). Feeds KPI Δ A / Δ B. A code first maps to a family: line amounts (NR, EBITDA, OP, NP) and line ratios (GM %, CM %, GTN %, ETR, Products / Cloud operating margin) share one branch each, because every branch adds its measures to the query plan of a grid over dim_kpi; the simple SWITCH on the family keeps a single-code evaluation as cheap as a direct measure. | §5 K-01..K-12 | — |
| `_KPI Status` | Status code of the KPI vs Budget only, whatever Compare A is (build-brief §0, spec §6, parity PV-01): ontrack within the on-track band (param_kpi_threshold, 1 % / 0.3 pp), ahead when favourable beyond it, watch up to the watch band (3 % / 1 pp), off beyond; neutral for Neutral KPIs or without a Budget. | §6, ADR-0012 | — |
| `_Profit Step` | Profit bridge step (unscaled): BUD = comparison Adj. EBITDA; VOL = ΔNR at CC x comparison GM % (CC); GM_RATE = Σ lines NR cc x ΔGM %; GM_MIX = ΔGP cc - VOL - GM_RATE; VSC / SM / RD / GA / OOI = Δ at CC; FX = (EBITDA - EBITDA cc) - (comparison - comparison cc); ACT and OP = 0 (level bars); DA and ADJ = actual levels. BUD + changes = Adj. EBITDA; + DA + ADJ = operating profit. | C-40, redesign v4 | — |
| `_Profit GP CC Change` | Gross profit change at constant currency (base - bridge comparison). | C-40, redesign v4 | `#,0;-#,0;0` |
| `_Profit Volume` | Profit bridge volume: net revenue change at CC x the comparison gross margin % at CC. | C-40, redesign v4 | `#,0;-#,0;0` |
| `_Profit GM Rate` | Profit bridge GM rate: Σ over the selected company's service lines / categories of NRcc x ΔGM %, at constant currency (Group: each company's lines in their own company). Lines of the other company were counted before (parity check 2026-10-27: S FY2025 rate -8.4 m instead of -0.03 m; the GM mix remainder absorbed it, so the bridge total was right). | C-40, redesign v4 | `#,0;-#,0;0` |
| `_Prof CM Status` | Status of CM Δ pp (the only status dot on Profitability): thresholds of param_kpi_threshold PP. | redesign v4 | — |
| `_KPI Budget Value` | The KPI of the current dim_kpi row under Budget over the same months, whatever Compare A is (status basis, build-brief §0, parity PV-01). FY outlook: the FY budget. | redesign v4 | — |
| `_Profit GM Rate Line` | GM rate effect of the service line / category in context: NRcc x (GM % - comparison GM %), at constant currency. | C-40, redesign v4 | `#,0;-#,0;0` |

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
| `Rail Sum Period` | Rail summary of the Period group (expanded rail): the Period flyout's summary sentence, e.g. Showing Jan – Sep 2026 - year to date (parity rule 7: every period summary starts with Showing). | F-02..F-04 | — |
| `Rail Sum Versions` | Rail summary of the Versions group, e.g. Actual vs Budget, Prior year. | F-05..F-07 | — |
| `Rail Sum Slice` | Rail summary of the Slice group: All slices, filtered regions / slices, or consolidated in the Group view. | F-08..F-11, F-32 | — |
| `Rail Sum Display` | Rail summary of the Display group, e.g. USD m - actual rates. | F-12..F-14 | — |
| `Seg Label` | Short label of a segmented-control item (Label role of the button slicers): versions, FX basis, units, time view, breakdown. | F-03..F-07, F-12..F-14, F-21 | — |
| `Version Desc` | One-line description of each base-version card in the Versions flyout (Label role). | F-05 | — |
| `Month Item Fill` | Month button fill in the Period flyout: open months (after the last close) in Subtle, closed months white. | F-03 | — |
| `Month Item Font` | Month button text colour in the Period flyout: open months Slate 600, closed months Ink 900. | F-03 | — |
| `_Time View Name` | Plain name of the selected time view (period picker v2): One month, Quarter to date, Year to date, Last 12 months, Full year. Feeds the time-view buttons (Seg Label), the summary sentence and the applied-filters pop-up. | F-04, period-picker-v2 | — |
| `Period Summary` | Live summary of the Period flyout (period-picker-v2 Part 1): the months the base covers, in plain words, e.g. Showing Jan – Sep 2026 - year to date; Showing Sep 2026 (one month); Showing Oct 2025 – Sep 2026 - last 12 months. Actual stops at the last close (C-01), so the sentence names the effective window (Full year 2026 closed through Sep: Showing Jan – Sep 2026 - full year); a window with no closed month reads Showing no closed month yet. Same wording as Track A. Also the rail tooltip and the Period row of the applied-filters pop-up. No engine calls. | F-02..F-04, C-01, period-picker-v2 | — |
| `Period Grid Label` | Label above the month grid of the Period flyout; it follows the time view (period-picker-v2): Month, Up to (quarter / year to date), Ending (last 12 months); Full year replaces it with one line, because Power BI cannot hide the grid. | F-03, period-picker-v2 | — |
| `Period Open Hint` | Open-month hint of the Period flyout (C-01, period-picker-v2): shown only while the base is Actual and the selected year still has open months; blank otherwise. | C-01, period-picker-v2 | — |
| `Month Item Label` | Second line of a month button in the Period flyout (Label role, C-01): open months read not closed yet (base Actual), forecast (Latest estimate) or budget (Budget); closed months get a no-break space, so every button keeps the same two-line layout and no item drops out of the slicer query. | F-03, C-01, period-picker-v2 | — |
| `Period Strip SVG` | Covered-months strip under the month grid of the Period flyout (period-picker-v2): the 12 months of the selected year as cells J … D; covered months in the company tint, the anchor month solid (outlined when Actual stops before it), open months grey while the base is Actual. One scalar, no engine calls. SVG 321 x 21. | F-02..F-04, period-picker-v2 | — |
| `_Notice Row` | Notice rows of the applied-filters pop-up (C-50, period-picker-v2 Part 2; they replace the removed notice strip): the text of the dim_filter_row notice row in context, blank when its condition does not apply, so the row disappears. Same rules and copy as Notices (Track A): Actual past the close, forecast months included, prior year missing, LTM before the data history, slice allocation on, Group eliminations. | C-50, L-05 | — |
| `_Slice Sub` | Slice flyout subtitle: which slices apply to the selected company. | F-08..F-11, F-32 | — |
| `Slice Hdr Region` | Region group label with its count in the Slice flyout, e.g. Region - All 4. | F-08 | — |
| `Slice Hdr Channel` | Channel / sales motion group label with its count; blank in the Group view. | F-09 | — |
| `Slice Hdr Line` | Category / service line group label with its count; blank in the Group view. | F-10 | — |
| `Slice Hdr Segment` | Price tier / customer segment group label with its count; blank in the Group view. | F-11 | — |
| `Slice Group Notice` | Group-view notice in the Slice flyout (F-32, T-15); blank for a single company. | F-32, T-15 | — |
| `Slice Notice Fill` | Fill of the Group-view notice box: notice tint in the Group view, white otherwise. | F-32 | — |
| `Slice Notice Rule` | Border of the Group-view notice box: notice border in the Group view, white otherwise. | F-32 | — |
| `_Breakdown Short` | Short, company-specific name of the profitability breakdown in context (default Channel). | F-21 | — |
| `Breakdown Allowed` | 1 when the breakdown option applies to the selected company: Region or Entity in the Group view, the four slices otherwise. Visual filter of the breakdown slicer. | F-21 | — |
| `PL Notes` | Statement notes column: company-specific secondary label (L-11) and classification tags (L-14) on line rows; blank on leaves. | L-11, L-14 | — |
| `PL Hdr Base` | Statement column-group title over Base and % NR, e.g. YTD Sep 2026 - Actual. | L-07 | — |
| `PL Hdr Cmp A` | Statement column-group title over Compare A (also the KPI tile label), e.g. vs Budget. | L-07, K-20 | — |
| `PL Hdr Cmp B` | Statement column-group title over Compare B (also the KPI tile label), e.g. vs Prior year. | L-07, K-20 | — |
| `PL Hdr FY` | Statement column-group title over the full-year columns, e.g. Full year 2026. | L-07 | — |
| `Var Title` | Largest variances title from the selection: the comparison of the Δ columns and the Compare B of the second Δ column (column headers are static in Power BI, parity PV-06). | C-45 | — |
| `Prof Title` | Profitability table title (Region only since the breakdown slicer was removed, parity PV-19). | C-46 | — |
| `KPI Tile SVG` | Key figures tile body (kpi-card-v2, K-20, K-21; replaces the K-24 / K-25 overlay): image of the card visual, evaluated in the tile query itself, no extra query. Sub-line (KPI Secondary) and one diverging comparison row per active comparison: name, a bar from a centre line that grows right when favourable and left when unfavourable (neutral KPIs grey, right, by size), Δ text with ▲ / ▼ and sign. Scale ±20 % for amount KPIs, ±5 pp for percent KPIs, capped with a chevron; n/a without data; no rows for growth KPIs. SVG 300 x 64. | K-20, K-21, kpi-card-v2 | — |
| `Hdr Status` | Header status on the title row (N-02, N-03): company - Management reporting - last closed month - last refresh, e.g. ACME Group - Management reporting - Closed through Sep 2026 - Refreshed 22 Oct 2026 13:53. | L-01, N-02, N-03 | — |
| `Filter Value` | Value of a row of the applied-filters pop-up (dim_filter_row): company, fiscal year, period (the period-picker-v2 summary sentence), time view, versions, currency, FX basis, units, regions, slices (values in each dimension's sort_order, parity rule 10), then the notice rows (C-50, via _Notice Row; blank rows drop out). Covers everything the former header context line and notice strip showed (L-04, L-05). | L-04, F-01..F-14 | — |
| `_Breakdown Hint` | Why the Profitability view is empty: blank when the selected breakdown applies to the company, else e.g. Channel does not apply to ACME Group - pick Region or Company. The breakdown slicer keeps its selection when the company changes, and Breakdown Allowed hides the kept item. | F-21, L-09 | — |
| `PL Fav Off` | 1 on the effective tax rate ratio row, whose deltas are never coloured; blank elsewhere. No engine call; input of the rules that colour the statement deltas. | L-12, N-07 | — |
| `Prof CM Dot Color` | Colour of the CM Δ status dot: grey on track, green ahead, amber watch, red off track. | C-46, redesign v4 | — |
| `Prof Subtitle CC` | Profitability table subtitle as Track C: Constant currency (FY2025 budget rates) - USD m - vs Budget (PV-02, PV-06). | C-46, redesign v4 | — |
| `Heat GM Fill` | Mix heatmap cell colour by gross margin %, in the colour of the line's company. | C-46, redesign v4 | — |
| `Heat GM Ink` | Mix heatmap text colour (white on the two dark steps), per the line's company. | C-46, redesign v4 | — |
| `_Heat GM Fill Raw` | Mix heatmap cell colour before the company switch: company tint (accT) to company colour (acc) in 4 steps by the column's gross margin % (< 30 %, < 50 %, < 70 %, >= 70 %; PV-03). | C-46, redesign v4 | — |
| `_Heat GM Ink Raw` | Mix heatmap text colour before the company switch (white on the two dark steps; column GM %, PV-03). | C-46, redesign v4 | — |
| `Info Title` | Info tooltip title: panel (dim_pl_info) or Vitals card (dim_kpi.info_title), Track C copy with {cmp} / {line} filled from the selection. | ADR-0012 | — |
| `Info Text` | Info tooltip: what it is (Track C copy), {cmp} / {line} filled from the selection. | ADR-0012 | — |
| `Info Detail` | Info tooltip sub-values: the Vitals card's values (KPI Info Sub); blank for panels. | ADR-0012 | — |
| `Info Glyph` | Text of the info buttons (each is filtered to its dim_kpi codes or dim_pl_info row; hover opens tt_pl_info). | ADR-0012 | — |
| `Pager Text 1` | Pager counter, page 1. | ADR-0012 | — |
| `Pager Text 2` | Pager counter, page 2. | ADR-0012 | — |
| `NR Bridge Title` | Title of the net revenue bridge. | C-40, redesign v4 | — |
| `Profit Bridge Title` | Profit bridge title as Track C: Profit bridge: Budget Adj. EBITDA → Actual → Operating profit. | C-46, redesign v4 | — |
| `Bubble X Min` | Growth × margin chart: minimum of the growth axis = the regions' minimum - 35 % of their range, so bubbles and the quadrant labels in the plot corners do not collide. | redesign v4 | `0.0%` |
| `Bubble X Max` | Growth × margin chart: maximum of the growth axis = the regions' maximum + 35 % of their range, so bubbles and the quadrant labels in the plot corners do not collide. | redesign v4 | `0.0%` |
| `Bubble Y Min` | Growth × margin chart: minimum of the CM % axis (constant currency) with 35 % of the range as padding, so bubbles and the corner quadrant labels do not collide. | redesign v4 | `0.0%` |
| `Bubble Y Max` | Growth × margin chart: maximum of the CM % axis (constant currency) with 35 % of the range as padding, so bubbles and the corner quadrant labels do not collide. | redesign v4 | `0.0%` |
| `Var Compare B Label` | Label of the second Δ column of the variances (Compare B), none when Compare B = None (parity row var.py_column). | redesign v4 | — |
| `Heat Title` | Mix heatmap title as Track C: Mix - region × service line (Commerce Cloud, Group) or category (Consumer Products). | C-46, redesign v4 | — |
| `How To Read Showing` | How to read, first line (Track C js-report/lib/engine/view-copy.ts): the period summary - currency and units - vs the comparisons, e.g. Showing Jan – Sep 2026 - year to date - USD m - vs Budget and Prior year. | redesign v4 | — |
| `Info Formula` | Info tooltip: the formula (Track C copy). | ADR-0012 | — |
| `Info Source` | Info tooltip: the measures and tables behind it (Track C copy). | ADR-0012 | — |

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
CALCULATE (
    [_Amt Window]
    ,REMOVEFILTERS ( param_eval )
    ,TREATAS ( { "BASE" }, param_eval[eval_code] )
    ,REMOVEFILTERS ( param_base_version )
    ,TREATAS ( { "LE" }, param_base_version[choice_code] )
    ,REMOVEFILTERS ( param_time_view )
    ,TREATAS ( { "FY" }, param_time_view[time_view_code] )
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
VAR _view         = [_Sel Entity]
VAR _eval         = [_Sel Eval]
VAR _compare_a    = [_Sel Compare A]
VAR _compare_b    = [_Sel Compare B]
VAR _base_choice  =
    SWITCH (
        _eval
        ,"CMP_A"
            ,_compare_a
        ,"CMP_B"
            ,_compare_b
        ,[_Sel Base Version]
    )
VAR _cmp_choice   =
    SWITCH (
        TRUE ()
        ,_compare_a = "NONE" && _compare_b <> "NONE"
            ,_compare_b
        ,_compare_a = "NONE"
            ,"PY"
        ,_compare_a
    )
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _base_shift   = IF ( _base_choice = "PY", 12, 0 )
VAR _cmp_shift    = IF ( _cmp_choice = "PY", 12, 0 )
VAR _versions     = ALL ( dim_version[version_key], dim_version[is_latest_forecast] )
VAR _months       = ALL ( dim_month[month_key], dim_month[month_index], dim_month[is_closed] )
VAR _base_pairs   =
    SELECTCOLUMNS (
        FILTER (
            CROSSJOIN ( _versions, _months )
            ,_base_choice <> "NONE"
                && dim_month[month_index] >= _start - _base_shift
                && dim_month[month_index] <= _end - _base_shift
                && SWITCH (
                    _base_choice
                    ,"B"
                        ,dim_version[version_key] = "BUD"
                    ,"LE"
                        ,( dim_version[version_key] = "ACT" && dim_month[is_closed] )
                            || ( dim_version[is_latest_forecast] && NOT dim_month[is_closed] )
                    ,dim_version[version_key] = "ACT"
                )
        )
        ,"@version_key", dim_version[version_key]
        ,"@month_key", dim_month[month_key]
    )
VAR _cmp_pairs    =
    SELECTCOLUMNS (
        FILTER (
            CROSSJOIN ( _versions, _months )
            ,dim_month[month_index] >= _start - _cmp_shift
                && dim_month[month_index] <= _end - _cmp_shift
                && SWITCH (
                    _cmp_choice
                    ,"B"
                        ,dim_version[version_key] = "BUD"
                    ,"LE"
                        ,( dim_version[version_key] = "ACT" && dim_month[is_closed] )
                            || ( dim_version[is_latest_forecast] && NOT dim_month[is_closed] )
                    ,dim_version[version_key] = "ACT"
                )
        )
        ,"@version_key", dim_version[version_key]
        ,"@month_key", dim_month[month_key]
    )
VAR _nr_sort      =
    CALCULATE (
        MAX ( dim_pl_row[line_sort] )
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "NR"
    )
VAR _nr_blocks    =
    CALCULATETABLE (
        VALUES ( dim_report_line[block_code] )
        ,REMOVEFILTERS ( dim_report_line )
        ,dim_report_line[row_type] = "input_block"
        ,dim_report_line[sort_order] < _nr_sort
    )
VAR _nr_accounts  =
    CALCULATETABLE (
        VALUES ( dim_account[account_code] )
        ,REMOVEFILTERS ( dim_account )
        ,TREATAS ( _nr_blocks, dim_account[block_code] )
    )
VAR _rep_currency = [_Sel Currency]
VAR _cc_month     = FORMAT ( [_Sel FY], "0" ) & "-01"
VAR _rep_rate     =
    LOOKUPVALUE (
        fact_fx_rate[local_per_usd]
        ,fact_fx_rate[currency_code], _rep_currency
        ,fact_fx_rate[month_key], _cc_month
        ,fact_fx_rate[rate_type], "BUDGET"
    )
VAR _factors      =
    ADDCOLUMNS (
        ALL ( dim_region[region_code], dim_region[functional_currency] )
        ,"@factor",
            VAR _local_rate  =
                LOOKUPVALUE (
                    fact_fx_rate[local_per_usd]
                    ,fact_fx_rate[currency_code], dim_region[functional_currency]
                    ,fact_fx_rate[month_key], _cc_month
                    ,fact_fx_rate[rate_type], "BUDGET"
                )
            RETURN
                DIVIDE ( _rep_rate, _local_rate )
    )
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
VAR _rows         =
    CALCULATETABLE (
        ADDCOLUMNS (
            _slices
            ,"@units_base",
                CALCULATE (
                    SUM ( fact_operational[units_sold] )
                    ,TREATAS ( _base_pairs, dim_version[version_key], dim_month[month_key] )
                )
            ,"@units_cmp",
                CALCULATE (
                    SUM ( fact_operational[units_sold] )
                    ,TREATAS ( _cmp_pairs, dim_version[version_key], dim_month[month_key] )
                )
            ,"@nr_base",
                CALCULATE (
                    CALCULATE (
                        SUM ( fact_pl[amount_local] )
                        ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
                    )
                        + SUM ( fact_pl_allocated[amount_local] )
                    ,TREATAS ( _base_pairs, dim_version[version_key], dim_month[month_key] )
                    ,TREATAS ( _nr_accounts, dim_account[account_code] )
                )
            ,"@nr_cmp",
                CALCULATE (
                    CALCULATE (
                        SUM ( fact_pl[amount_local] )
                        ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
                    )
                        + SUM ( fact_pl_allocated[amount_local] )
                    ,TREATAS ( _cmp_pairs, dim_version[version_key], dim_month[month_key] )
                    ,TREATAS ( _nr_accounts, dim_account[account_code] )
                )
        )
        ,KEEPFILTERS ( TREATAS ( { "P" }, dim_entity[entity_code] ) )
        ,REMOVEFILTERS ( dim_month )
        ,REMOVEFILTERS ( dim_version )
    )
VAR _volume       =
    SUMX (
        _rows
        ,VAR _region      = dim_region[region_code]
         VAR _factor      = MAXX ( FILTER ( _factors, dim_region[region_code] = _region ), [@factor] )
         VAR _units_base  = [@units_base]
         VAR _units_cmp   = [@units_cmp]
         VAR _nr_cc_base  = CONVERT ( [@nr_base], DOUBLE ) * _factor
         VAR _nr_cc_cmp   = CONVERT ( [@nr_cmp], DOUBLE ) * _factor
         RETURN
             IF (
                 _units_cmp = 0
                 ,_nr_cc_base - _nr_cc_cmp
                 ,( _units_base - _units_cmp ) * DIVIDE ( _nr_cc_cmp, _units_cmp )
             )
    )
RETURN
    IF ( _view = "P", _volume )
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
            ,IF ( NOT ISBLANK ( SELECTEDVALUE ( dim_region[region_name] ) ), 1 )
        ,ISINSCOPE ( dim_entity[short_name] )
            ,IF ( _view = "GROUP" && NOT ISBLANK ( SELECTEDVALUE ( dim_entity[short_name] ) ), 1 )
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
CALCULATE (
    DIVIDE ( [Net Revenue], [_Units Divisor] )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
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
RETURN
    IF (
        _metric IN { "UNITS", "MERCHANTS" }
        ,[_Local Sum]
        ,IF (
            SELECTEDVALUE ( param_fx_basis[fx_basis_name] ) = "Constant currency (budget rates of selected year)"
            ,VAR _cc_month    = FORMAT ( [_Sel FY], "0" ) & "-01"
             VAR _rep_rate    =
                 LOOKUPVALUE (
                     fact_fx_rate[local_per_usd]
                     ,fact_fx_rate[currency_code], [_Sel Currency]
                     ,fact_fx_rate[month_key], _cc_month
                     ,fact_fx_rate[rate_type], "BUDGET"
                 )
             RETURN
                 SUMX (
                     VALUES ( dim_region[functional_currency] )
                     ,VAR _local_rate  =
                          LOOKUPVALUE (
                              fact_fx_rate[local_per_usd]
                              ,fact_fx_rate[currency_code], dim_region[functional_currency]
                              ,fact_fx_rate[month_key], _cc_month
                              ,fact_fx_rate[rate_type], "BUDGET"
                          )
                      RETURN
                          [_Local Sum] * DIVIDE ( _rep_rate, _local_rate )
                 )
            ,[_Rep Sum]
        )
    )
```

### _Rep Sum

Folder `9 Engine` · spec D-30, C-11, C-13, ADR-0008

```dax
_Rep Sum =
VAR _metric       = [_Sel Metric]
VAR _currency     = SELECTEDVALUE ( param_reporting_currency[currency_code], "USD" )
RETURN
    SWITCH (
        _metric
        ,"AMOUNT"
            ,SWITCH (
                _currency
                ,"USD"
                    ,CALCULATE (
                        SUM ( fact_pl[amount_usd] )
                        ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
                    )
                        + SUM ( fact_pl_allocated[amount_usd] )
                ,"EUR"
                    ,CALCULATE (
                        SUM ( fact_pl[amount_eur] )
                        ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
                    )
                        + SUM ( fact_pl_allocated[amount_eur] )
                ,"GBP"
                    ,CALCULATE (
                        SUM ( fact_pl[amount_gbp] )
                        ,KEEPFILTERS ( dim_account[is_direct] = TRUE () )
                    )
                        + SUM ( fact_pl_allocated[amount_gbp] )
            )
        ,"GMV"
            ,SWITCH (
                _currency
                ,"USD"
                    ,SUM ( fact_operational[gmv_usd] )
                ,"EUR"
                    ,SUM ( fact_operational[gmv_eur] )
                ,"GBP"
                    ,SUM ( fact_operational[gmv_gbp] )
            )
    )
```

### _Elim Amount

Folder `9 Engine` · spec C-35, C-36, D-33

```dax
_Elim Amount =
VAR _currency     = SELECTEDVALUE ( param_reporting_currency[currency_code], "USD" )
RETURN
    IF (
        SELECTEDVALUE ( param_fx_basis[fx_basis_name] ) = "Constant currency (budget rates of selected year)"
        ,VAR _cc_month    = FORMAT ( [_Sel FY], "0" ) & "-01"
         VAR _rep_rate    =
             LOOKUPVALUE (
                 fact_fx_rate[local_per_usd]
                 ,fact_fx_rate[currency_code], _currency
                 ,fact_fx_rate[month_key], _cc_month
                 ,fact_fx_rate[rate_type], "BUDGET"
             )
         RETURN
             SUMX (
                 VALUES ( dim_region[functional_currency] )
                 ,VAR _local_rate  =
                      LOOKUPVALUE (
                          fact_fx_rate[local_per_usd]
                          ,fact_fx_rate[currency_code], dim_region[functional_currency]
                          ,fact_fx_rate[month_key], _cc_month
                          ,fact_fx_rate[rate_type], "BUDGET"
                      )
                  RETURN
                      CALCULATE ( SUM ( fact_pl_elim[amount_local] ) ) * DIVIDE ( _rep_rate, _local_rate )
             )
        ,SWITCH (
            _currency
            ,"USD"
                ,SUM ( fact_pl_elim[amount_usd] )
            ,"EUR"
                ,SUM ( fact_pl_elim[amount_eur] )
            ,"GBP"
                ,SUM ( fact_pl_elim[amount_gbp] )
        )
    )
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
VAR _elim         = IF ( _is_group && [_Sel Metric] = "AMOUNT", [_Elim Amount] )
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

### _Bridge Elim Change

Folder `9 Engine` · spec C-40, C-36, T-05

```dax
_Bridge Elim Change =
VAR _elim_base    =
    CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,KEEPFILTERS ( TREATAS ( { "ELIM_GR" }, dim_account[account_code] ) )
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
VAR _elim_cmp     =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,KEEPFILTERS ( TREATAS ( { "ELIM_GR" }, dim_account[account_code] ) )
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
RETURN
    _elim_base - _elim_cmp
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
        TRUE ()
        ,_step = "START"
            ,[Bridge Comparison NR]
        ,_step = "FX"
            ,[Bridge FX]
        ,_step = "VOL"
            ,[Bridge Volume]
        ,_step = "PRICE"
            ,[Bridge Price Mix]
        ,_step IN { "SVC_SUB", "SVC_PAY", "SVC_APP", "SVC_PS" }
            ,CALCULATE (
                [_Bridge NR CC Change]
                ,KEEPFILTERS ( TREATAS ( { MID ( _step, 5, 3 ) }, dim_line[line_code] ) )
            )
        ,_step IN { "ENT_P", "ENT_S" }
            ,CALCULATE (
                [_Bridge NR CC Change]
                ,REMOVEFILTERS ( param_entity_view )
                ,TREATAS ( { RIGHT ( _step, 1 ) }, param_entity_view[entity_view_code] )
            )
        ,_step = "ELIM"
            ,[_Bridge Elim Change]
    )
```

### _KPI Value

Folder `9 Engine` · spec §5 K-01..K-12

```dax
_KPI Value =
VAR _kpi          = SELECTEDVALUE ( dim_kpi[kpi_code] )
VAR _family       =
    SWITCH (
        _kpi
        ,"NR", "LINE"
        ,"EBITDA", "LINE"
        ,"OP", "LINE"
        ,"NP", "LINE"
        ,"GM_PCT", "RATIO"
        ,"CM_PCT", "RATIO"
        ,"GTN_PCT", "RATIO"
        ,"ETR", "RATIO"
        ,"CP_OP_MARGIN", "RATIO"
        ,"CC_OP_MARGIN", "RATIO"
        ,_kpi
    )
RETURN
    SWITCH (
        _family
        ,"LINE"
            ,CALCULATE (
                [Base Amount]
                ,REMOVEFILTERS ( dim_pl_row )
                ,TREATAS ( { _kpi }, dim_pl_row[line_code] )
            )
        ,"RATIO"
            ,VAR _num         = SWITCH ( _kpi, "GM_PCT", "GP", "CM_PCT", "CM", "GTN_PCT", "GTN", "ETR", "TAX", "OP" )
             VAR _den         = SWITCH ( _kpi, "GTN_PCT", "GR", "ETR", "PBT", "NR" )
             VAR _sign        = IF ( _kpi IN { "GTN_PCT", "ETR" }, -1, 1 )
             VAR _entity      = SWITCH ( _kpi, "CP_OP_MARGIN", "P", "CC_OP_MARGIN", "S", [_Sel Entity] )
             RETURN
                 CALCULATE (
                     DIVIDE (
                         _sign
                             * CALCULATE (
                                 [Base Amount]
                                 ,REMOVEFILTERS ( dim_pl_row )
                                 ,TREATAS ( { _num }, dim_pl_row[line_code] )
                             )
                         ,CALCULATE (
                             [Base Amount]
                             ,REMOVEFILTERS ( dim_pl_row )
                             ,TREATAS ( { _den }, dim_pl_row[line_code] )
                         )
                     )
                     ,REMOVEFILTERS ( param_entity_view )
                     ,TREATAS ( { _entity }, param_entity_view[entity_view_code] )
                 )
        ,"ORG_GROWTH", [KPI Organic Growth]
        ,"ARR", [KPI ARR]
        ,"SVC_SHARE", [KPI Services Share]
        ,"AP_PCT", [KPI A&P % NR]
        ,"TAKE_RATE", [KPI Payments Take Rate]
        ,"IC_ELIM", [KPI IC Eliminated]
        ,"UNITS", [KPI Units Sold]
        ,"NR_PER_UNIT", [KPI NR per Unit]
        ,"VOL_GROWTH", [KPI Volume Growth]
        ,"PRICE_MIX", [KPI Price Mix]
        ,"GMV", [KPI GMV]
        ,"MERCHANTS", [KPI Active Merchants]
        ,"SUB_GM_PCT", [KPI Subscription GM %]
        ,"RULE40", [KPI Rule of 40]
        ,"OPEX_PCT", [KPI Opex % NR]
        ,"MIX", [KPI Subscription Share]
        ,"FY_OUTLOOK", [KPI FY Outlook NR]
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
    ,"Goods - retail, D2C, marketplaces"
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

### Rail Sum Period

Folder `Design` · spec F-02..F-04

```dax
Rail Sum Period =
[Period Summary]
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
        ,_regions & " - " & _slices & IF ( _slices = 1, " slice filtered", " slices filtered" )
    )
```

### Rail Sum Display

Folder `Design` · spec F-12..F-14

```dax
Rail Sum Display =
[_Units Short] & " - " & IF ( [_Sel FX Basis] = "CC", "constant currency", "actual rates" )
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
            ,[_Time View Name]
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

### _Time View Name

Folder `Design` · spec F-04, period-picker-v2

```dax
_Time View Name =
SWITCH (
    [_Sel Time View]
    ,"MTD"
        ,"One month"
    ,"QTD"
        ,"Quarter to date"
    ,"LTM"
        ,"Last 12 months"
    ,"FY"
        ,"Full year"
    ,"Year to date"
)
```

### Period Summary

Folder `Design` · spec F-02..F-04, C-01, period-picker-v2

```dax
Period Summary =
VAR _time_view    = [_Sel Time View]
VAR _start        = MAX ( [_Win Start], 0 )
VAR _end          = [_Win End]
VAR _last         = _end
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
VAR _last_month   =
    CALCULATE (
        MAX ( dim_month[month_name] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last
    )
VAR _last_year    =
    CALCULATE (
        MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last
    )
VAR _range        =
    SWITCH (
        TRUE ()
        ,_start = _last
            ,_last_month & " " & _last_year
        ,_start_year = _last_year
            ,_start_month & " – " & _last_month & " " & _last_year
        ,_start_month & " " & _start_year & " – " & _last_month & " " & _last_year
    )
VAR _suffix       = IF ( _time_view <> "MTD", " - " & LOWER ( [_Time View Name] ) )
RETURN
    IF ( _end < _start, "Showing no closed month yet", "Showing " & _range & _suffix )
```

### Period Grid Label

Folder `Design` · spec F-03, period-picker-v2

```dax
Period Grid Label =
SWITCH (
    [_Sel Time View]
    ,"MTD"
        ,"Month"
    ,"LTM"
        ,"Ending"
    ,"FY"
        ,"Full year covers January to December."
    ,"Up to"
)
```

### Period Open Hint

Folder `Design` · spec C-01, period-picker-v2

```dax
Period Open Hint =
VAR _fiscal_year  = [_Sel FY]
VAR _year_last    =
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fiscal_year
    )
RETURN
    IF (
        [_Sel Base Version] = "A" && [_Last Closed Index] < _year_last
        ,"Switch the base to Latest estimate to include forecast months."
    )
```

### Month Item Label

Folder `Design` · spec F-03, C-01, period-picker-v2

```dax
Month Item Label =
VAR _fiscal_year  = [_Sel FY]
VAR _month        = SELECTEDVALUE ( param_period[month_number] )
VAR _index        =
    CALCULATE (
        MAX ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fiscal_year
        ,dim_month[month_number] = _month
    )
RETURN
    IF (
        _index > [_Last Closed Index]
        ,SWITCH ( [_Sel Base Version], "LE", "forecast", "B", "budget", "not closed yet" )
        ,UNICHAR ( 160 )
    )
```

### Period Strip SVG

Folder `Design` · spec F-02..F-04, period-picker-v2

```dax
Period Strip SVG =
VAR _fiscal_year  = [_Sel FY]
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _anchor       = [_Anchor Index]
VAR _last_closed  = [_Last Closed Index]
VAR _is_actual    = [_Sel Base Version] = "A"
VAR _acc          = [_Acc]
VAR _acc_tint     = [_AccT]
VAR _jan          =
    CALCULATE (
        MIN ( dim_month[month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[fiscal_year] = _fiscal_year
    )
VAR _cells        =
    CONCATENATEX (
        GENERATESERIES ( 1, 12 )
        ,VAR _index       = _jan + [Value] - 1
         VAR _x           = ( [Value] - 1 ) * 27 + 1
         VAR _covered     = _index >= _start && _index <= _end
         VAR _is_anchor   = _index = _anchor
         VAR _is_open     = _index > _last_closed
         VAR _fill        =
             SWITCH (
                 TRUE ()
                 ,_covered && _is_anchor
                     ,_acc
                 ,_covered
                     ,_acc_tint
                 ,_is_open && _is_actual
                     ,"#F6F8FA"
                 ,"#FFFFFF"
             )
         VAR _ink         =
             SWITCH (
                 TRUE ()
                 ,_covered && _is_anchor
                     ,"#FFFFFF"
                 ,_covered
                     ,_acc
                 ,_is_open && _is_actual
                     ,"#8592A3"
                 ,"#4F5C6C"
             )
         VAR _stroke      = IF ( _is_anchor, _acc, "#CDD4DC" )
         VAR _width       = IF ( _is_anchor, 2, 1 )
         RETURN
             "<rect x='" & _x & "' y='1' width='23' height='19' rx='4' fill='" & _fill & "' stroke='" & _stroke & "' stroke-width='" & _width & "'/>"
                 & "<text x='" & _x + 12 & "' y='15' text-anchor='middle' font-size='11' fill='" & _ink & "'>" & MID ( "JFMAMJJASOND", [Value], 1 ) & "</text>"
        ,""
        ,[Value], ASC
    )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='321' height='21' viewBox='0 0 321 21' font-family='Segoe UI, sans-serif'>"
        & _cells
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### _Notice Row

Folder `Design` · spec C-50, L-05

```dax
_Notice Row =
VAR _row          = SELECTEDVALUE ( dim_filter_row[filter_code] )
VAR _last_closed  = [_Last Closed Index]
VAR _base         = [_Sel Base Version]
VAR _start        = [_Win Start]
VAR _end_raw      = [_Win End Raw]
VAR _is_group     = [_Sel Entity] = "GROUP"
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
RETURN
    SWITCH (
        _row
        ,"N_CLOSE"
            ,IF ( _base = "A" && _end_raw > _last_closed, "Actuals closed through " & _closed_label & ": later months excluded; use Latest estimate for the full window" )
        ,"N_FORECAST"
            ,IF ( _base = "LE" && _end_raw > _last_closed, "Forecast months included: " & _open_from & " – " & _open_to & " (" & _forecast & ")" )
        ,"N_PY"
            ,IF ( _uses_py && _start - 12 < 0, "Prior year n/a before " & _first_label )
        ,"N_LTM"
            ,IF ( [_Sel Time View] = "LTM" && _start < 0, "LTM starts before the data history (" & _first_label & ")" )
        ,"N_ALLOC"
            ,IF ( _slice_on && NOT _is_group, "Slice filter on: lines from operating expenses down are allocated by net-revenue share" )
        ,"N_ELIM"
            ,IF ( _is_group, "ACME Group: Commerce Cloud fees billed to Consumer Products are eliminated" )
    )
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
    "Region - " & IF ( ISFILTERED ( dim_region[region_name] ) && _selected < _total, _selected & " of " & _total, "All " & _total )
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
    IF ( _view <> "GROUP", IF ( _view = "S", "Sales motion", "Channel" ) & " - " & _count )
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
    IF ( _view <> "GROUP", IF ( _view = "S", "Service line", "Category" ) & " - " & _count )
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
    IF ( _view <> "GROUP", IF ( _view = "S", "Customer segment", "Price tier" ) & " - " & _count )
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
    IF ( NOT _is_leaf, CONCATENATEX ( FILTER ( _list, LEN ( [Value] ) > 0 ), [Value], " - " ) )
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
    _window & " - " & [_Base Name]
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

### Var Title

Folder `Design` · spec C-45

```dax
Var Title =
"Largest variances vs " & [_Bridge Cmp Name] & IF ( [_Sel Compare B] <> "NONE", " - second Δ vs " & [_Cmp B Name] )
```

### Prof Title

Folder `Design` · spec C-46

```dax
Prof Title =
"Profitability by Region"
```

### KPI Tile SVG

Folder `Design` · spec K-20, K-21, kpi-card-v2

```dax
KPI Tile SVG =
VAR _code         = SELECTEDVALUE ( dim_kpi[kpi_code] )
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
VAR _better       = SELECTEDVALUE ( dim_kpi[better_when] )
VAR _is_growth    = _code IN { "ORG_GROWTH", "VOL_GROWTH", "PRICE_MIX" }
VAR _is_pp        = _type IN { "PCT", "PCT2" }
VAR _scale        = IF ( _is_pp, 5, 0.2 )
VAR _sel_a        = [_Sel Compare A]
VAR _sel_b        = [_Sel Compare B]
VAR _value        = IF ( NOT _is_growth, [_KPI Value] )
VAR _cmp_a        =
    IF (
        NOT _is_growth && _sel_a <> "NONE"
        ,CALCULATE (
            [_KPI Value]
            ,REMOVEFILTERS ( param_eval )
            ,TREATAS ( { "CMP_A" }, param_eval[eval_code] )
        )
    )
VAR _cmp_b        =
    IF (
        NOT _is_growth && _sel_b <> "NONE"
        ,CALCULATE (
            [_KPI Value]
            ,REMOVEFILTERS ( param_eval )
            ,TREATAS ( { "CMP_B" }, param_eval[eval_code] )
        )
    )
VAR _sec          = [KPI Secondary]
VAR _rows         =
    FILTER (
        {
            ( 1, _sel_a, IF ( _is_pp, ( _value - _cmp_a ) * 100, DIVIDE ( _value - _cmp_a, ABS ( _cmp_a ) ) ), NOT ISBLANK ( _value ) && NOT ISBLANK ( _cmp_a ) )
            ,( 2, _sel_b, IF ( _is_pp, ( _value - _cmp_b ) * 100, DIVIDE ( _value - _cmp_b, ABS ( _cmp_b ) ) ), NOT ISBLANK ( _value ) && NOT ISBLANK ( _cmp_b ) )
        }
        ,NOT _is_growth && [Value2] <> "NONE"
    )
VAR _body         =
    CONCATENATEX (
        _rows
        ,VAR _y           = 14 + 22 * [Value1]
         VAR _name        = "vs " & SWITCH ( [Value2], "B", "Budget", "LE", "Latest est.", "PY", "Prior year" )
         VAR _has         = [Value4]
         VAR _delta       = ROUND ( [Value3], IF ( _is_pp, 1, 3 ) )
         VAR _fav         =
             SWITCH (
                 TRUE ()
                 ,_better = "Neutral" || _delta = 0
                     ,0
                 ,( _delta > 0 && _better = "Higher" ) || ( _delta < 0 && _better = "Lower" )
                     ,1
                 ,-1
             )
         VAR _len         = MIN ( ABS ( _delta ) / _scale, 1 ) * 50
         VAR _bar_x       = IF ( _fav = -1, 146 - _len, 146 )
         VAR _fill        = SWITCH ( _fav, 1, "#3BA37B", -1, "#E2804A", "#8592A3" )
         VAR _ink         = SWITCH ( _fav, 1, "#06603F", -1, "#C2410C", "#101B2B" )
         VAR _arrow       = IF ( _delta > 0, "▲ +", IF ( _delta < 0, "▼ −", "" ) )
         VAR _number      =
             FORMAT ( ABS ( _delta ), IF ( _is_pp, "0.0", "0.0%" ) ) & IF ( _is_pp, " pp", "" )
         VAR _chevron     =
             IF (
                 ABS ( _delta ) > _scale
                 ,IF (
                     _fav = -1
                     ,"<path d='M99 " & _y - 9 & " l-3 3 l3 3' fill='none' stroke='" & _fill & "' stroke-width='1.4'/>"
                     ,"<path d='M193 " & _y - 9 & " l3 3 l-3 3' fill='none' stroke='" & _fill & "' stroke-width='1.4'/>"
                 )
             )
         RETURN
             "<text x='0' y='" & _y & "' font-size='13' fill='#4F5C6C'>" & _name & "</text>"
                 & IF (
                     _has
                     ,"<rect x='96' y='" & _y - 10 & "' width='100' height='8' rx='2' fill='#EDF0F3'/>"
                         & IF ( _len > 0, "<rect x='" & FORMAT ( _bar_x, "0.0" ) & "' y='" & _y - 10 & "' width='" & FORMAT ( _len, "0.0" ) & "' height='8' rx='2' fill='" & _fill & "'/>" )
                         & "<rect x='145.5' y='" & _y - 13 & "' width='1' height='14' fill='#101B2B' fill-opacity='0.4'/>"
                         & _chevron
                         & "<text x='300' y='" & _y & "' font-size='13' font-weight='600' text-anchor='end' fill='" & _ink & "'>" & _arrow & _number & "</text>"
                     ,"<text x='300' y='" & _y & "' font-size='13' text-anchor='end' fill='#4F5C6C'>n/a</text>"
                 )
        ,""
        ,[Value1], ASC
    )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='64' viewBox='0 0 300 64' font-family='Segoe UI, sans-serif' style='font-variant-numeric:tabular-nums'>"
        & IF ( LEN ( _sec ) > 0, "<text x='0' y='12' font-size='12' fill='#4F5C6C'>" & _sec & "</text>" )
        & _body
        & "</svg>"
RETURN
    IF (
        NOT ISBLANK ( _code )
        ,"data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
    )
```

### Hdr Status

Folder `Design` · spec L-01, N-02, N-03

```dax
Hdr Status =
VAR _company      = SWITCH ( [_Sel Entity], "S", "Commerce Cloud", "GROUP", "ACME Group", "Consumer Products" )
VAR _last_closed  = [_Last Closed Index]
VAR _closed_label =
    CALCULATE (
        MAX ( dim_month[month_name] ) & " " & MAX ( dim_month[fiscal_year] )
        ,REMOVEFILTERS ( dim_month )
        ,dim_month[month_index] = _last_closed
    )
VAR _refreshed    = MAX ( _meta_refresh[refreshed_at] )
RETURN
    _company & " - Management reporting - Closed through " & _closed_label & " - Refreshed " & FORMAT ( _refreshed, "d mmm yyyy hh:nn" )
```

### Filter Value

Folder `Design` · spec L-04, F-01..F-14

```dax
Filter Value =
VAR _row          = SELECTEDVALUE ( dim_filter_row[filter_code] )
VAR _view         = [_Sel Entity]
VAR _compare_a    = [_Cmp A Name]
VAR _compare_b    = [_Cmp B Name]
VAR _versions     =
    [_Base Name]
        & SWITCH (
            TRUE ()
            ,ISBLANK ( _compare_a ) && ISBLANK ( _compare_b )
                ," only"
            ,ISBLANK ( _compare_b )
                ," vs " & _compare_a & " (A)"
            ,ISBLANK ( _compare_a )
                ," vs " & _compare_b & " (B)"
            ," vs " & _compare_a & " (A) and " & _compare_b & " (B)"
        )
VAR _regions      =
    IF (
        ISFILTERED ( dim_region[region_name] ) && COUNTROWS ( VALUES ( dim_region[region_name] ) ) < COUNTROWS ( ALL ( dim_region[region_name] ) )
        ,CONCATENATEX (
            SUMMARIZE ( dim_region, dim_region[region_name], dim_region[sort_order] )
            ,dim_region[region_name]
            ,", "
            ,dim_region[sort_order], ASC
        )
        ,"All regions"
    )
VAR _channels     =
    IF (
        ISFILTERED ( dim_channel[channel_name] )
        ,CONCATENATEX (
            CALCULATETABLE ( SUMMARIZE ( dim_channel, dim_channel[channel_name], dim_channel[sort_order] ), KEEPFILTERS ( dim_channel[entity_code] = _view ) )
            ,dim_channel[channel_name]
            ,", "
            ,dim_channel[sort_order], ASC
        )
    )
VAR _lines        =
    IF (
        ISFILTERED ( dim_line[line_name] )
        ,CONCATENATEX (
            CALCULATETABLE ( SUMMARIZE ( dim_line, dim_line[line_name], dim_line[sort_order] ), KEEPFILTERS ( dim_line[entity_code] = _view ) )
            ,dim_line[line_name]
            ,", "
            ,dim_line[sort_order], ASC
        )
    )
VAR _segments     =
    IF (
        ISFILTERED ( dim_segment[segment_name] )
        ,CONCATENATEX (
            CALCULATETABLE ( SUMMARIZE ( dim_segment, dim_segment[segment_name], dim_segment[sort_order] ), KEEPFILTERS ( dim_segment[entity_code] = _view ) )
            ,dim_segment[segment_name]
            ,", "
            ,dim_segment[sort_order], ASC
        )
    )
VAR _is_services  = _view = "S"
VAR _slices       =
    IF (
        ISBLANK ( _channels ) && ISBLANK ( _lines ) && ISBLANK ( _segments )
        ,"All slices"
        ,IF ( _is_services, "Sales motion: ", "Channel: " ) & IF ( ISBLANK ( _channels ), "All", _channels )
            & " - " & IF ( _is_services, "Service line: ", "Category: " ) & IF ( ISBLANK ( _lines ), "All", _lines )
            & " - " & IF ( _is_services, "Segment: ", "Price tier: " ) & IF ( ISBLANK ( _segments ), "All", _segments )
    )
RETURN
    SWITCH (
        _row
        ,"COMPANY"
            ,SWITCH ( _view, "S", "Commerce Cloud", "GROUP", "ACME Group (consolidated)", "Consumer Products" )
        ,"FY"
            ,FORMAT ( [_Sel FY], "0" )
        ,"PERIOD"
            ,[Period Summary]
        ,"TIME"
            ,[_Time View Name]
        ,"VERSIONS"
            ,_versions
        ,"CURRENCY"
            ,[_Sel Currency]
        ,"FX"
            ,IF ( [_Sel FX Basis] = "CC", "Constant currency (FY" & [_Sel FY] & " budget rates)", "Actual rates" )
        ,"UNITS"
            ,IF ( [_Sel Units] = "K", "Thousands", "Millions" )
        ,"REGIONS"
            ,_regions
        ,"SLICES"
            ,IF ( _view = "GROUP", "Consolidated: channel, category and segment do not apply", _slices )
        ,[_Notice Row]
    )
```

### _Breakdown Hint

Folder `Design` · spec F-21, L-09

```dax
_Breakdown Hint =
VAR _order        = SELECTEDVALUE ( param_breakdown_field[Breakdown Order] )
VAR _view         = [_Sel Entity]
RETURN
    IF (
        NOT ISBLANK ( _order ) && ISBLANK ( [Breakdown Allowed] )
        ,IF (
            _view = "GROUP"
            ,[_Breakdown Short] & " does not apply to ACME Group - pick Region or Company"
            ,"Company applies only to ACME Group - pick another breakdown"
        )
    )
```

### PL Fav Off

Folder `Design` · spec L-12, N-07

```dax
PL Fav Off =
IF ( NOT ISINSCOPE ( dim_pl_row[account_label] ) && SELECTEDVALUE ( dim_pl_row[line_code] ) = "ETR_PCT", 1 )
```

### KPI Opex % NR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI Opex % NR =
VAR _opex         =
    CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "OPEX"
    )
VAR _ooi          =
    CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "OOI"
    )
RETURN
    DIVIDE ( -( _opex - _ooi ), [Net Revenue] )
```

### KPI S&M % NR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI S&M % NR =
DIVIDE (
    -CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "SM"
    )
    ,[Net Revenue]
)
```

### KPI R&D % NR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI R&D % NR =
DIVIDE (
    -CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "RD"
    )
    ,[Net Revenue]
)
```

### KPI G&A % NR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI G&A % NR =
DIVIDE (
    -CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "GA"
    )
    ,[Net Revenue]
)
```

### KPI Subscription Share

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI Subscription Share =
DIVIDE (
    CALCULATE (
        [Net Revenue]
        ,REMOVEFILTERS ( dim_line )
        ,TREATAS ( { "SUB" }, dim_line[line_code] )
    )
    ,[Net Revenue]
)
```

### KPI Payments Share

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI Payments Share =
DIVIDE (
    CALCULATE (
        [Net Revenue]
        ,REMOVEFILTERS ( dim_line )
        ,TREATAS ( { "PAY" }, dim_line[line_code] )
    )
    ,[Net Revenue]
)
```

### KPI Payments GM %

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI Payments GM % =
CALCULATE (
    DIVIDE ( [Gross Profit], [Net Revenue] )
    ,REMOVEFILTERS ( dim_line )
    ,TREATAS ( { "PAY" }, dim_line[line_code] )
)
```

### KPI GMV per Merchant

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI GMV per Merchant =
DIVIDE ( [KPI GMV], [KPI Active Merchants] )
```

### KPI Net New ARR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI Net New ARR =
VAR _arr          = [KPI ARR]
VAR _arr_b        =
    CALCULATE (
        [KPI ARR]
        ,REMOVEFILTERS ( param_eval )
        ,TREATAS ( { "CMP_B" }, param_eval[eval_code] )
    )
RETURN
    IF ( NOT ISBLANK ( _arr_b ), _arr - _arr_b )
```

### KPI FY Outlook NR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI FY Outlook NR =
CALCULATE (
    [FY LE Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NR"
)
```

### KPI FY Budget NR

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI FY Budget NR =
CALCULATE (
    [FY Budget Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "NR"
)
```

### KPI FY Outlook EBITDA

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI FY Outlook EBITDA =
CALCULATE (
    [FY LE Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "EBITDA"
)
```

### KPI FY Budget EBITDA

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI FY Budget EBITDA =
CALCULATE (
    [FY Budget Amount]
    ,REMOVEFILTERS ( dim_pl_row )
    ,dim_pl_row[line_code] = "EBITDA"
)
```

### KPI FY Attainment

Folder `3 KPIs\Items` · spec §5 Vitals, redesign v4

```dax
KPI FY Attainment =
DIVIDE ( [KPI FY Outlook NR], [KPI FY Budget NR] )
```

### _KPI Status

Folder `9 Engine` · spec §6, ADR-0012

```dax
_KPI Status =
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
VAR _better       = SELECTEDVALUE ( dim_kpi[better_when] )
VAR _is_pp        = _type IN { "PCT", "PCT2" }
VAR _value        = [_KPI Value]
VAR _budget       = [_KPI Budget Value]
VAR _delta        = IF ( _is_pp, ( _value - _budget ) * 100, DIVIDE ( _value - _budget, ABS ( _budget ) ) )
VAR _kind         = IF ( _is_pp, "PP", "PCT" )
VAR _on_track     = LOOKUPVALUE ( param_kpi_threshold[on_track], param_kpi_threshold[delta_kind], _kind )
VAR _watch        = LOOKUPVALUE ( param_kpi_threshold[watch], param_kpi_threshold[delta_kind], _kind )
VAR _fav          = IF ( _better = "Lower", -_delta, _delta )
RETURN
    SWITCH (
        TRUE ()
        ,_better = "Neutral" || ISBLANK ( _value ) || ISBLANK ( _budget )
            ,"neutral"
        ,ABS ( _delta ) <= _on_track
            ,"ontrack"
        ,_fav > 0
            ,"ahead"
        ,ABS ( _delta ) <= _watch
            ,"watch"
        ,"off"
    )
```

### KPI Status

Folder `3 KPIs\Vitals` · spec §6, ADR-0012

```dax
KPI Status =
SWITCH (
    [_KPI Status]
    ,"ontrack"
        ,"on track"
    ,"ahead"
        ,"ahead"
    ,"watch"
        ,"watch"
    ,"off"
        ,"off track"
)
```

### Vitals Card SVG

Folder `3 KPIs\Vitals` · spec §5, ADR-0012

```dax
Vitals Card SVG =
VAR _label        = SELECTEDVALUE ( dim_kpi[kpi_label] )
VAR _tier         = SELECTEDVALUE ( dim_kpi[vitals_tier] )
VAR _w            = SWITCH ( _tier, "Hero", 335, "Secondary", 292, 257 )
VAR _h            = SWITCH ( _tier, "Hero", 320, "Secondary", 155, 279 )
VAR _value_size   = SWITCH ( _tier, "Hero", 46, "Secondary", 28, 30 )
VAR _p            = [_Vitals Parts]
VAR _status       = PATHITEM ( _p, 10 )
VAR _rows_svg     =
    CONCATENATEX (
        FILTER ( { 1, 2 }, PATHITEM ( _p, [Value] * 4 - 2 ) <> "" )
        ,VAR _i           = [Value] * 4 - 2
         VAR _y           = _h - 52 + ( [Value] - 1 ) * 22
         VAR _abs_text    = PATHITEM ( _p, _i + 1 )
         VAR _rel_text    = PATHITEM ( _p, _i + 2 )
         VAR _ink         = PATHITEM ( _p, _i + 3 )
         RETURN
             "<text x='16' y='" & _y & "' font-size='13' fill='#4F5C6C'>" & PATHITEM ( _p, _i ) & "</text>"
                 & IF ( LEN ( _abs_text ) > 0, "<text x='" & _w - 88 & "' y='" & _y & "' font-size='13' font-weight='600' text-anchor='end' fill='" & _ink & "'>" & _abs_text & "</text>" )
                 & "<text x='" & _w - 16 & "' y='" & _y & "' font-size='13' font-weight='" & IF ( _rel_text = "on plan", "400", "600" ) & "' text-anchor='end' fill='" & IF ( _rel_text = "on plan", "#4F5C6C", _ink ) & "'>" & _rel_text & "</text>"
        ,""
        ,[Value], ASC
    )
VAR _chip_word    = SWITCH ( _status, "ontrack", "on track", "ahead", "ahead", "watch", "watch", "off", "off track" )
VAR _chip_w       = SWITCH ( _status, "ontrack", 70, "ahead", 54, "watch", 56, "off", 68, 0 )
VAR _chip_fill    = SWITCH ( _status, "ahead", "#E4F3EC", "watch", "#FBF4E4", "off", "#FCEDE5", "#EDF0F3" )
VAR _chip_ink     = SWITCH ( _status, "ahead", "#06603F", "watch", "#8A5A00", "off", "#C2410C", "#101B2B" )
VAR _chip_dot     = SWITCH ( _status, "ahead", "#3BA37B", "watch", "#D9A441", "off", "#C2410C", "#8592A3" )
VAR _chip         =
    IF (
        _chip_w > 0
        ,"<rect x='16' y='40' width='" & _chip_w & "' height='20' rx='10' fill='" & _chip_fill & "'/>"
            & "<circle cx='27' cy='50' r='3.5' fill='" & _chip_dot & "'/>"
            & "<text x='35' y='54' font-size='11' font-weight='500' fill='" & _chip_ink & "'>" & _chip_word & "</text>"
    )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='" & _w & "' height='" & _h & "' viewBox='0 0 " & _w & " " & _h & "' font-family='Segoe UI, sans-serif'>"
        & "<rect x='0.5' y='0.5' width='" & _w - 1 & "' height='" & _h - 1 & "' rx='12' fill='" & IF ( _tier = "Driver", "#F6F8FA", "#FFFFFF" ) & "' stroke='#DEE3E9'/>"
        & "<text x='16' y='28' font-size='14' font-weight='500' fill='#4F5C6C'>" & _label & "</text>"
        & _chip
        & "<text x='16' y='" & _h - 74 & "' font-size='" & _value_size & "' font-weight='600' fill='#101B2B' style='font-variant-numeric:tabular-nums'>" & PATHITEM ( _p, 1 ) & "</text>"
        & _rows_svg
        & "</svg>"
RETURN
    IF (
        _p <> ""
        ,"data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
    )
```

### KPI Info Sub

Folder `3 KPIs\Vitals` · spec §5, ADR-0012

```dax
KPI Info Sub =
VAR _code         = SELECTEDVALUE ( dim_kpi[kpi_code] )
VAR _entity       = [_Sel Entity]
RETURN
    SWITCH (
        _code
        ,"NR"
            ,"Organic growth vs PY (constant currency): " & IF ( ISBLANK ( [KPI Organic Growth] ), "n/a", FORMAT ( [KPI Organic Growth], "+0.0%;−0.0%;0.0%" ) )
        & " - " & "Reported growth vs PY: " & IF ( ISBLANK ( [KPI Reported Growth] ), "n/a", FORMAT ( [KPI Reported Growth], "+0.0%;−0.0%;0.0%" ) )
        ,"EBITDA"
            ,"Margin: " & IF ( ISBLANK ( [KPI Adj EBITDA Margin] ), "n/a", FORMAT ( [KPI Adj EBITDA Margin], "0.0%" ) ) & IF ( _entity = "S", " - Rule of 40 (organic growth + margin): " & IF ( ISBLANK ( [KPI Rule of 40] ), "n/a", FORMAT ( [KPI Rule of 40], "0.0%" ) ) )
        ,"OP"
            ,"Margin: " & IF ( ISBLANK ( [KPI Operating Margin] ), "n/a", FORMAT ( [KPI Operating Margin], "0.0%" ) )
        & " - " & "Adj. EBITDA: " & IF ( ISBLANK ( [Adjusted EBITDA] ), "n/a", VAR _b = FORMAT ( ABS ( [Adjusted EBITDA] ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( [Adjusted EBITDA] < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "D&A: " & IF ( ISBLANK ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "DA" ) ), "n/a", VAR _b = FORMAT ( ABS ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "DA" ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "DA" ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "Adjusting items: " & IF ( ISBLANK ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "ADJ" ) ), "n/a", VAR _b = FORMAT ( ABS ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "ADJ" ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "ADJ" ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "Net profit: " & IF ( ISBLANK ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "NP" ) ), "n/a", VAR _b = FORMAT ( ABS ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "NP" ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "NP" ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "Net margin: " & IF ( ISBLANK ( [KPI Net Margin] ), "n/a", FORMAT ( [KPI Net Margin], "0.0%" ) )
        ,"GM_PCT"
            ,SWITCH (
                _entity
                ,"S"
                    ,"Platform subscriptions: " & IF ( ISBLANK ( [KPI Subscription GM %] ), "n/a", FORMAT ( [KPI Subscription GM %], "0.0%" ) )
        & " - " & "Payments: " & IF ( ISBLANK ( [KPI Payments GM %] ), "n/a", FORMAT ( [KPI Payments GM %], "0.0%" ) )
                ,"P"
                    ,CONCATENATEX (
                        TOPN (
                            2
                            ,FILTER ( ADDCOLUMNS ( VALUES ( dim_line[line_code] ), "@nr", [Net Revenue], "@gm", [KPI Gross Margin %], "@n", CALCULATE ( MAX ( dim_line[line_name] ) ) ), NOT ISBLANK ( [@nr] ) && CALCULATE ( MAX ( dim_line[entity_code] ) ) = "P" && NOT ( dim_line[line_code] IN { "P_UNASSIGNED", "S_UNASSIGNED" } ) )
                            ,[@nr], DESC
                        )
                        ,[@n] & ": " & FORMAT ( [@gm], "0.0%" )
                        ," - "
                        ,[@nr], DESC
                    )
            )
        ,"OPEX_PCT"
            ,"Sales & marketing % NR: " & IF ( ISBLANK ( [KPI S&M % NR] ), "n/a", FORMAT ( [KPI S&M % NR], "0.0%" ) )
        & " - " & "R&D % NR: " & IF ( ISBLANK ( [KPI R&D % NR] ), "n/a", FORMAT ( [KPI R&D % NR], "0.0%" ) )
        & " - " & "G&A % NR: " & IF ( ISBLANK ( [KPI G&A % NR] ), "n/a", FORMAT ( [KPI G&A % NR], "0.0%" ) )
        & " - " & "Opex: " & IF ( ISBLANK ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ) ), "n/a", VAR _b = FORMAT ( ABS ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "Opex vs Budget (favourable +): " & IF ( ISBLANK ( ( CALCULATE ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "B" }, param_compare_a[choice_code] ) ) - ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ) ) ) ), "n/a", VAR _b = FORMAT ( ABS ( ( CALCULATE ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "B" }, param_compare_a[choice_code] ) ) - ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ) ) ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( ( CALCULATE ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "B" }, param_compare_a[choice_code] ) ) - ( - ( CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "SM" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "RD" ) + CALCULATE (     [Base Amount]     ,REMOVEFILTERS ( dim_pl_row )     ,dim_pl_row[line_code] = "GA" ) ) ) ) < 0, "−", "+" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        ,"GMV"
            ,"Payments take rate: " & IF ( ISBLANK ( [KPI Payments Take Rate] ), "n/a", FORMAT ( [KPI Payments Take Rate], "0.00%" ) )
        & " - " & "Take rate vs Budget: " & IF ( ISBLANK ( [KPI Payments Take Rate] - CALCULATE ( [KPI Payments Take Rate], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "B" }, param_compare_a[choice_code] ) ) ), "n/a", IF ( ROUND ( ( [KPI Payments Take Rate] - CALCULATE ( [KPI Payments Take Rate], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "B" }, param_compare_a[choice_code] ) ) ) * 10000, 0 ) = 0, "0 bp", FORMAT ( ROUND ( ( [KPI Payments Take Rate] - CALCULATE ( [KPI Payments Take Rate], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "B" }, param_compare_a[choice_code] ) ) ) * 10000, 0 ), "+0;−0" ) & " bp" ) )
        & " - " & "Take rate vs Prior year: " & IF ( ISBLANK ( [KPI Payments Take Rate] - CALCULATE ( [KPI Payments Take Rate], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ), "n/a", IF ( ROUND ( ( [KPI Payments Take Rate] - CALCULATE ( [KPI Payments Take Rate], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) * 10000, 0 ) = 0, "0 bp", FORMAT ( ROUND ( ( [KPI Payments Take Rate] - CALCULATE ( [KPI Payments Take Rate], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) * 10000, 0 ), "+0;−0" ) & " bp" ) )
        ,"MERCHANTS"
            ,"GMV per merchant: " & IF ( ISBLANK ( [KPI GMV per Merchant] ), "n/a", SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & FORMAT ( [KPI GMV per Merchant] / 1000, "#,0.0" ) & " k" )
        ,"ARR"
            ,"Net new ARR vs prior-year end: " & IF ( ISBLANK ( ( [KPI ARR] - CALCULATE ( [KPI ARR], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) ), "n/a", VAR _b = FORMAT ( ABS ( ( [KPI ARR] - CALCULATE ( [KPI ARR], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( ( [KPI ARR] - CALCULATE ( [KPI ARR], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) < 0, "−", "+" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        ,"MIX"
            ,"Platform subscriptions: " & IF ( ISBLANK ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ) ), "n/a", VAR _b = FORMAT ( ABS ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) ) & " (" & IF ( ISBLANK ( DIVIDE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ), CALCULATE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) - 1 ), "n/a", FORMAT ( DIVIDE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ), CALCULATE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "SUB" }, dim_line[line_code] ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) - 1, "+0.0%;−0.0%;0.0%" ) ) & " YoY)"
        & " - " & "Payments: " & IF ( ISBLANK ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ) ), "n/a", VAR _b = FORMAT ( ABS ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) ) & " (" & IF ( ISBLANK ( DIVIDE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ), CALCULATE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) - 1 ), "n/a", FORMAT ( DIVIDE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ), CALCULATE ( CALCULATE ( [Net Revenue], REMOVEFILTERS ( dim_line ), TREATAS ( { "PAY" }, dim_line[line_code] ) ), REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) - 1, "+0.0%;−0.0%;0.0%" ) ) & " YoY)"
        ,"UNITS"
            ,"Volume vs prior year: " & IF ( ISBLANK ( DIVIDE ( [KPI Units Sold], CALCULATE ( [KPI Units Sold], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) - 1 ), "n/a", FORMAT ( DIVIDE ( [KPI Units Sold], CALCULATE ( [KPI Units Sold], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) ) ) - 1, "+0.0%;−0.0%;0.0%" ) )
        ,"NR_PER_UNIT"
            ,"Net revenue: " & IF ( ISBLANK ( [Net Revenue] ), "n/a", VAR _b = FORMAT ( ABS ( [Net Revenue] ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( [Net Revenue] < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "Units sold: " & IF ( ISBLANK ( [KPI Units Sold] ), "n/a", FORMAT ( [KPI Units Sold], "#,0" ) )
        ,"GTN_PCT"
            ,"Gross-to-net deductions: " & IF ( ISBLANK ( [Gross-to-Net Deductions] ), "n/a", VAR _b = FORMAT ( ABS ( [Gross-to-Net Deductions] ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( [Gross-to-Net Deductions] < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        ,"AP_PCT"
            ,"A&P spend: " & IF ( ISBLANK ( CALCULATE ( [Base Amount], KEEPFILTERS ( TREATAS ( { "SM_P1", "SM_P2" }, dim_account[account_code] ) ) ) ), "n/a", VAR _b = FORMAT ( ABS ( CALCULATE ( [Base Amount], KEEPFILTERS ( TREATAS ( { "SM_P1", "SM_P2" }, dim_account[account_code] ) ) ) ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( CALCULATE ( [Base Amount], KEEPFILTERS ( TREATAS ( { "SM_P1", "SM_P2" }, dim_account[account_code] ) ) ) < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        ,"FY_OUTLOOK"
            ,"Revenue attainment: " & IF ( ISBLANK ( [KPI FY Attainment] ), "n/a", FORMAT ( [KPI FY Attainment], "0.0%" ) )
        & " - " & "Adj. EBITDA, FY LE: " & IF ( ISBLANK ( [KPI FY Outlook EBITDA] ), "n/a", VAR _b = FORMAT ( ABS ( [KPI FY Outlook EBITDA] ) / [_Units Divisor], IF ( [_Sel Units] = "K", "#,0", "#,0.0" ) ) RETURN IF ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _b, "0", "" ), ".", "" ), ",", "" ) = "", "", IF ( [KPI FY Outlook EBITDA] < 0, "−", "" ) ) & SELECTEDVALUE ( param_reporting_currency[symbol], "$" ) & _b & IF ( [_Sel Units] = "K", " k", " m" ) )
        & " - " & "EBITDA attainment: " & IF ( ISBLANK ( DIVIDE ( [KPI FY Outlook EBITDA], [KPI FY Budget EBITDA] ) ), "n/a", FORMAT ( DIVIDE ( [KPI FY Outlook EBITDA], [KPI FY Budget EBITDA] ), "0.0%" ) )
    )
```

### Bridge Step Delta

Folder `4 Analysis` · spec C-40, redesign v4

```dax
Bridge Step Delta =
VAR _step         = SELECTEDVALUE ( dim_bridge_step[step_code] )
RETURN
    IF (
        [Bridge Step In View] = 1
        ,IF (
            _step IN { "CC_SUB", "END" }
            ,0
            ,[Bridge Value]
        )
    )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### Bridge Is Total

Folder `4 Analysis` · spec C-40, redesign v4

```dax
Bridge Is Total =
IF (
    [Bridge Step In View] = 1
    ,IF (
        SELECTEDVALUE ( dim_bridge_step[step_code] ) IN { "START", "CC_SUB", "END" }
        ,1
        ,0
    )
)
```

### Bridge Axis Min

Folder `4 Analysis` · spec C-40, redesign v4

```dax
Bridge Axis Min =
VAR _levels       =
    {
        [Bridge Comparison NR]
        ,[Net Revenue]
        ,[Net Revenue] - [Bridge FX]
    }
VAR _low          = MINX ( _levels, [Value] )
VAR _high         = MAXX ( _levels, [Value] )
RETURN
    DIVIDE ( MAX ( _low - ( _high - _low ) * 1.5 - ABS ( [Bridge FX] ), 0 ), [_Units Divisor] )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### _Profit Step

Folder `9 Engine` · spec C-40, redesign v4

```dax
_Profit Step =
VAR _step         = SELECTEDVALUE ( dim_profit_step[step_code] )
VAR _cmp_ebitda   =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "EBITDA"
    )
RETURN
    SWITCH (
        _step
        ,"BUD"
            ,_cmp_ebitda
        ,"VOL"
            ,[_Profit Volume]
        ,"GM_RATE"
            ,[_Profit GM Rate]
        ,"GM_MIX"
            ,[_Profit GP CC Change] - [_Profit Volume] - [_Profit GM Rate]
        ,"FX"
            ,VAR _ebitda      = [Adjusted EBITDA]
             VAR _ebitda_cc   =
                 CALCULATE (
                     [Adjusted EBITDA]
                     ,REMOVEFILTERS ( param_fx_basis )
                     ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
                 )
             VAR _cmp_cc      =
                 CALCULATE (
                     [Bridge Comparison Amount]
                     ,REMOVEFILTERS ( dim_pl_row )
                     ,dim_pl_row[line_code] = "EBITDA"
                     ,REMOVEFILTERS ( param_fx_basis )
                     ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
                 )
             RETURN
                 ( _ebitda - _ebitda_cc ) - ( _cmp_ebitda - _cmp_cc )
        ,"ACT"
            ,0
        ,"OP"
            ,0
        ,VAR _line        = _step
         VAR _base_cc     =
             CALCULATE (
                 [Base Amount]
                 ,REMOVEFILTERS ( dim_pl_row )
                 ,TREATAS ( { _line }, dim_pl_row[line_code] )
                 ,REMOVEFILTERS ( param_fx_basis )
                 ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
             )
         VAR _cmp_cc      =
             CALCULATE (
                 [Bridge Comparison Amount]
                 ,REMOVEFILTERS ( dim_pl_row )
                 ,TREATAS ( { _line }, dim_pl_row[line_code] )
                 ,REMOVEFILTERS ( param_fx_basis )
                 ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
             )
         VAR _level       =
             CALCULATE (
                 [Base Amount]
                 ,REMOVEFILTERS ( dim_pl_row )
                 ,TREATAS ( { _line }, dim_pl_row[line_code] )
             )
         RETURN
             IF ( _step IN { "DA", "ADJ" }, _level, _base_cc - _cmp_cc )
    )
```

### _Profit GP CC Change

Folder `9 Engine` · spec C-40, redesign v4

```dax
_Profit GP CC Change =
VAR _gp_cc        =
    CALCULATE (
        [Gross Profit]
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
VAR _cmp_gp_cc    =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "GP"
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
RETURN
    _gp_cc - _cmp_gp_cc
```

### _Profit Volume

Folder `9 Engine` · spec C-40, redesign v4

```dax
_Profit Volume =
VAR _cmp_gp_cc    =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "GP"
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
RETURN
    [_Bridge NR CC Change] * DIVIDE ( _cmp_gp_cc, [_NR CC Bridge Cmp] )
```

### _Profit GM Rate

Folder `9 Engine` · spec C-40, redesign v4

```dax
_Profit GM Rate =
VAR _view         = [_Sel Entity]
RETURN
    SUMX (
        FILTER (
            VALUES ( dim_line[line_code] )
            ,_view = "GROUP"
                || CALCULATE ( MAX ( dim_line[entity_code] ) ) = _view
        )
        ,VAR _entity      = CALCULATE ( MAX ( dim_line[entity_code] ) )
         RETURN
             IF (
                 _view = "GROUP"
                 ,CALCULATE (
                     [_Profit GM Rate Line]
                     ,REMOVEFILTERS ( param_entity_view )
                     ,TREATAS ( { _entity }, param_entity_view[entity_view_code] )
                 )
                 ,[_Profit GM Rate Line]
             )
    )
```

### Profit Step Delta

Folder `4 Analysis\Profit bridge` · spec C-46, redesign v4

```dax
Profit Step Delta =
DIVIDE ( [_Profit Step], [_Units Divisor] )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
```

### Profit Is Total

Folder `4 Analysis\Profit bridge` · spec C-46, redesign v4

```dax
Profit Is Total =
IF (
    SELECTEDVALUE ( dim_profit_step[step_code] ) IN { "BUD", "ACT", "OP" }
    ,1
    ,0
)
```

### LV Δ B

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Δ B =
VAR _base         = [Base Amount]
VAR _compare      = [Compare B Amount]
RETURN
    IF (
        [_Sel Compare B] <> "NONE" && NOT ( ISBLANK ( _base ) && ISBLANK ( _compare ) )
        ,DIVIDE ( _base - _compare, [_Units Divisor] )
    )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "+#,0;−#,0;0", "+#,0.0;−#,0.0;0.0" )
```

### LV FX

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV FX =
VAR _base         = [Base Amount]
VAR _compare      = [Bridge Comparison Amount]
VAR _base_cc      =
    CALCULATE (
        [Base Amount]
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
VAR _compare_cc   =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
RETURN
    IF (
        NOT ( ISBLANK ( _base ) && ISBLANK ( _compare ) )
        ,DIVIDE ( ( _base - _base_cc ) - ( _compare - _compare_cc ), [_Units Divisor] )
    )
```

Format string (dynamic):

```dax
VAR _units        = [_Sel Units]
RETURN
    IF ( _units = "K", "+#,0;−#,0;0", "+#,0.0;−#,0.0;0.0" )
```

### LV Δ % Text

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Δ % Text =
VAR _base         = [Base Amount]
VAR _compare      = [Bridge Comparison Amount]
VAR _pct          = DIVIDE ( _base - _compare, ABS ( _compare ) )
RETURN
    SWITCH (
        TRUE ()
        ,( ISBLANK ( _base ) || _base = 0 ) && ( ISBLANK ( _compare ) || _compare = 0 )
            ,BLANK ()
        ,ABS ( DIVIDE ( _compare, [_Units Divisor] ) ) < 2 || ABS ( _pct ) > 0.5
            ,"n.m."
        ,FORMAT ( _pct, "+0.0%;−0.0%;0.0%" )
    )
```

### LV Alloc Tag

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Alloc Tag =
VAR _cut          = SELECTEDVALUE ( param_var_cut[Cut Order], 0 )
VAR _account      = SELECTEDVALUE ( dim_pl_row[account_code] )
VAR _below_cm     = LOOKUPVALUE ( dim_account[is_below_cm], dim_account[account_code], _account )
RETURN
    IF (
        LEN ( _account ) > 0
            && _below_cm = TRUE ()
            && NOT ( _cut IN { 0, 1, 5 } )
        ,"alloc."
    )
```

### LV Coverage 8

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Coverage 8 =
VAR _n            = 8
VAR _accounts     =
    ADDCOLUMNS (
        CALCULATETABLE (
            VALUES ( dim_account[account_code] )
            ,NOT ( dim_account[block_code] IN { "INV", "FIN", "TAX" } )
        )
        ,"@abs", [LV Abs Δ]
        ,"@d", [Base Amount] - [Bridge Comparison Amount]
    )
VAR _lines        = FILTER ( _accounts, NOT ISBLANK ( [@abs] ) && [@abs] <> 0 )
VAR _shown        = TOPN ( _n, _lines, [@abs], DESC )
VAR _shown_abs    = SUMX ( _shown, [@abs] )
VAR _all_abs      = SUMX ( _lines, [@abs] )
VAR _total_d      = SUMX ( _lines, [@d] )
VAR _shown_n      = MIN ( _n, COUNTROWS ( _lines ) )
VAR _units        = IF ( [_Sel Units] = "K", " k", " m" )
VAR _fmt          = IF ( [_Sel Units] = "K", "+#,0;−#,0;0", "+#,0.0;−#,0.0;0.0" )
RETURN
    "Shown " & _shown_n & " of " & [LV Leaf Count] & " lines - coverage "
        & FORMAT ( DIVIDE ( _shown_abs, _all_abs ), "0%" ) & " of |Δ| - all other lines "
        & FORMAT ( DIVIDE ( SUMX ( _shown, [@d] ) - _total_d, -[_Units Divisor] ), _fmt ) & _units
        & " - total P&L Δ at operating profit " & FORMAT ( DIVIDE ( _total_d, [_Units Divisor] ), _fmt ) & _units
```

### LV Coverage 12

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Coverage 12 =
VAR _n            = 12
VAR _accounts     =
    ADDCOLUMNS (
        CALCULATETABLE (
            VALUES ( dim_account[account_code] )
            ,NOT ( dim_account[block_code] IN { "INV", "FIN", "TAX" } )
        )
        ,"@abs", [LV Abs Δ]
        ,"@d", [Base Amount] - [Bridge Comparison Amount]
    )
VAR _lines        = FILTER ( _accounts, NOT ISBLANK ( [@abs] ) && [@abs] <> 0 )
VAR _shown        = TOPN ( _n, _lines, [@abs], DESC )
VAR _shown_abs    = SUMX ( _shown, [@abs] )
VAR _all_abs      = SUMX ( _lines, [@abs] )
VAR _total_d      = SUMX ( _lines, [@d] )
VAR _shown_n      = MIN ( _n, COUNTROWS ( _lines ) )
VAR _units        = IF ( [_Sel Units] = "K", " k", " m" )
VAR _fmt          = IF ( [_Sel Units] = "K", "+#,0;−#,0;0", "+#,0.0;−#,0.0;0.0" )
RETURN
    "Shown " & _shown_n & " of " & [LV Leaf Count] & " lines - coverage "
        & FORMAT ( DIVIDE ( _shown_abs, _all_abs ), "0%" ) & " of |Δ| - all other lines "
        & FORMAT ( DIVIDE ( SUMX ( _shown, [@d] ) - _total_d, -[_Units Divisor] ), _fmt ) & _units
        & " - total P&L Δ at operating profit " & FORMAT ( DIVIDE ( _total_d, [_Units Divisor] ), _fmt ) & _units
```

### LV Coverage All

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Coverage All =
VAR _n            = 1000
VAR _accounts     =
    ADDCOLUMNS (
        CALCULATETABLE (
            VALUES ( dim_account[account_code] )
            ,NOT ( dim_account[block_code] IN { "INV", "FIN", "TAX" } )
        )
        ,"@abs", [LV Abs Δ]
        ,"@d", [Base Amount] - [Bridge Comparison Amount]
    )
VAR _lines        = FILTER ( _accounts, NOT ISBLANK ( [@abs] ) && [@abs] <> 0 )
VAR _shown        = TOPN ( _n, _lines, [@abs], DESC )
VAR _shown_abs    = SUMX ( _shown, [@abs] )
VAR _all_abs      = SUMX ( _lines, [@abs] )
VAR _total_d      = SUMX ( _lines, [@d] )
VAR _shown_n      = MIN ( _n, COUNTROWS ( _lines ) )
VAR _units        = IF ( [_Sel Units] = "K", " k", " m" )
VAR _fmt          = IF ( [_Sel Units] = "K", "+#,0;−#,0;0", "+#,0.0;−#,0.0;0.0" )
RETURN
    "Shown " & _shown_n & " of " & [LV Leaf Count] & " lines - coverage "
        & FORMAT ( DIVIDE ( _shown_abs, _all_abs ), "0%" ) & " of |Δ| - all other lines "
        & FORMAT ( DIVIDE ( SUMX ( _shown, [@d] ) - _total_d, -[_Units Divisor] ), _fmt ) & _units
        & " - total P&L Δ at operating profit " & FORMAT ( DIVIDE ( _total_d, [_Units Divisor] ), _fmt ) & _units
```

### LV Coverage Value

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Coverage Value =
VAR _accounts     =
    ADDCOLUMNS (
        CALCULATETABLE (
            VALUES ( dim_account[account_code] )
            ,NOT ( dim_account[block_code] IN { "INV", "FIN", "TAX" } )
        )
        ,"@abs", [LV Abs Δ]
    )
VAR _lines        = FILTER ( _accounts, NOT ISBLANK ( [@abs] ) && [@abs] <> 0 )
RETURN
    DIVIDE ( SUMX ( TOPN ( 8, _lines, [@abs], DESC ), [@abs] ), SUMX ( _lines, [@abs] ) )
```

### Prof NR Δ % CC

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof NR Δ % CC =
DIVIDE ( [_Bridge NR CC Change], ABS ( [_NR CC Bridge Cmp] ) )
```

### Prof CM Δ pp

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof CM Δ pp =
CALCULATE (
    VAR _cm_pct       = [KPI CM %]
    VAR _cmp_cm       =
        CALCULATE (
            [Bridge Comparison Amount]
            ,REMOVEFILTERS ( dim_pl_row )
            ,dim_pl_row[line_code] = "CM"
        )
    VAR _cmp_pct      = DIVIDE ( _cmp_cm, [Bridge Comparison NR] )
    RETURN
        IF ( NOT ISBLANK ( _cmp_pct ) && NOT ISBLANK ( _cm_pct ), ( _cm_pct - _cmp_pct ) * 100 )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### _Prof CM Status

Folder `9 Engine` · spec redesign v4

```dax
_Prof CM Status =
VAR _d            = [Prof CM Δ pp]
VAR _on_track     = LOOKUPVALUE ( param_kpi_threshold[on_track], param_kpi_threshold[delta_kind], "PP" )
VAR _watch        = LOOKUPVALUE ( param_kpi_threshold[watch], param_kpi_threshold[delta_kind], "PP" )
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _d )
            ,"neutral"
        ,ABS ( _d ) <= _on_track
            ,"ontrack"
        ,_d > 0
            ,"ahead"
        ,ABS ( _d ) <= _watch
            ,"watch"
        ,"off"
    )
```

### Prof CM Dot

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof CM Dot =
IF ( NOT ISBLANK ( [Prof CM Δ pp] ), "●" )
```

### Prof CM Dot Color

Folder `Design` · spec C-46, redesign v4

```dax
Prof CM Dot Color =
SWITCH (
    [_Prof CM Status]
    ,"ahead"
        ,"#3BA37B"
    ,"watch"
        ,"#D9A441"
    ,"off"
        ,"#C2410C"
    ,"#8592A3"
)
```

### Prof Contribution

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof Contribution =
CALCULATE (
    DIVIDE ( [Contribution Margin], [_Units Divisor] )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Prof Adj EBITDA

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof Adj EBITDA =
CALCULATE (
    DIVIDE ( [Adjusted EBITDA], [_Units Divisor] )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Prof Subtitle CC

Folder `Design` · spec C-46, redesign v4

```dax
Prof Subtitle CC =
"Constant currency (FY" & [_Sel FY] & " budget rates) - " & [_Units Short] & " - vs " & [_Bridge Cmp Name]
```

### Conc Share

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Conc Share =
CALCULATE (
    VAR _level        = SELECTEDVALUE ( dim_conc_level[level_code] )
    VAR _value        =
        SWITCH (
            _level
            ,"NR"
                ,[Net Revenue]
            ,"CM"
                ,[Contribution Margin]
            ,"EBITDA"
                ,[Adjusted EBITDA]
        )
    VAR _total        =
        CALCULATE (
            SWITCH (
                _level
                ,"NR"
                    ,[Net Revenue]
                ,"CM"
                    ,[Contribution Margin]
                ,"EBITDA"
                    ,[Adjusted EBITDA]
            )
            ,ALLSELECTED ( dim_region )
        )
    RETURN
        DIVIDE ( _value, _total )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Prof Company Growth

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof Company Growth =
CALCULATE (
    [KPI Organic Growth]
    ,ALLSELECTED ( dim_region )
)
```

### Prof Company CM %

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof Company CM % =
CALCULATE (
    CALCULATE (
        [KPI CM %]
        ,ALLSELECTED ( dim_region )
    )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Heat GM Fill

Folder `Design` · spec C-46, redesign v4

```dax
Heat GM Fill =
VAR _view         = [_Sel Entity]
VAR _line_entity  = SELECTEDVALUE ( dim_line[entity_code] )
RETURN
    SWITCH (
        TRUE ()
        ,NOT ISINSCOPE ( dim_line[line_name] )
            ,[_Heat GM Fill Raw]
        ,SELECTEDVALUE ( dim_line[is_unassigned] ) = TRUE ()
            ,BLANK ()
        ,_view = "GROUP"
            ,CALCULATE (
                [_Heat GM Fill Raw]
                ,REMOVEFILTERS ( param_entity_view )
                ,TREATAS ( { _line_entity }, param_entity_view[entity_view_code] )
            )
        ,_line_entity = _view
            ,[_Heat GM Fill Raw]
    )
```

### Heat GM Ink

Folder `Design` · spec C-46, redesign v4

```dax
Heat GM Ink =
VAR _view         = [_Sel Entity]
VAR _line_entity  = SELECTEDVALUE ( dim_line[entity_code] )
RETURN
    SWITCH (
        TRUE ()
        ,NOT ISINSCOPE ( dim_line[line_name] )
            ,[_Heat GM Ink Raw]
        ,SELECTEDVALUE ( dim_line[is_unassigned] ) = TRUE ()
            ,BLANK ()
        ,_view = "GROUP"
            ,CALCULATE (
                [_Heat GM Ink Raw]
                ,REMOVEFILTERS ( param_entity_view )
                ,TREATAS ( { _line_entity }, param_entity_view[entity_view_code] )
            )
        ,_line_entity = _view
            ,[_Heat GM Ink Raw]
    )
```

### _Heat Cell Raw

Folder `5 Profitability` · spec C-46, redesign v4

```dax
_Heat Cell Raw =
CALCULATE (
    VAR _nr           = [Net Revenue]
    VAR _region_nr    =
        CALCULATE (
            [Net Revenue]
            ,REMOVEFILTERS ( dim_line )
        )
    VAR _format       = IF ( [_Sel Units] = "K", "#,0;−#,0;0", "#,0.0;−#,0.0;0.0" )
    RETURN
        IF (
            NOT ISBLANK ( _nr )
            ,FORMAT ( DIVIDE ( _nr, [_Units Divisor] ), _format ) & UNICHAR ( 10 ) & FORMAT ( DIVIDE ( _nr, _region_nr ), "0%" )
        )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Heat Cell

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Heat Cell =
VAR _view         = [_Sel Entity]
VAR _line_entity  = SELECTEDVALUE ( dim_line[entity_code] )
RETURN
    SWITCH (
        TRUE ()
        ,NOT ISINSCOPE ( dim_line[line_name] )
            ,[_Heat Cell Raw]
        ,SELECTEDVALUE ( dim_line[is_unassigned] ) = TRUE ()
            ,BLANK ()
        ,_view = "GROUP"
            ,CALCULATE (
                [_Heat Cell Raw]
                ,REMOVEFILTERS ( param_entity_view )
                ,TREATAS ( { _line_entity }, param_entity_view[entity_view_code] )
            )
        ,_line_entity = _view
            ,[_Heat Cell Raw]
    )
```

### _Heat GM Fill Raw

Folder `Design` · spec C-46, redesign v4

```dax
_Heat GM Fill Raw =
VAR _gm           = [_Heat Colour GM]
VAR _t            =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _gm )
            ,-1
        ,_gm < 0.3
            ,0.15
        ,_gm < 0.5
            ,0.4
        ,_gm < 0.7
            ,0.65
        ,0.9
    )
VAR _from         = [_AccT]
VAR _to           = [_Acc]
VAR _hex          = "0123456789ABCDEF"
VAR _channel      =
    ADDCOLUMNS (
        { 2, 4, 6 }
        ,"@from", ( SEARCH ( MID ( _from, [Value], 1 ), _hex ) - 1 ) * 16 + SEARCH ( MID ( _from, [Value] + 1, 1 ), _hex ) - 1
        ,"@to", ( SEARCH ( MID ( _to, [Value], 1 ), _hex ) - 1 ) * 16 + SEARCH ( MID ( _to, [Value] + 1, 1 ), _hex ) - 1
    )
VAR _mixed        =
    CONCATENATEX (
        _channel
        ,VAR _c           = ROUND ( [@from] + ( [@to] - [@from] ) * _t, 0 )
         RETURN
             MID ( _hex, INT ( _c / 16 ) + 1, 1 ) & MID ( _hex, MOD ( _c, 16 ) + 1, 1 )
        ,""
        ,[Value], ASC
    )
RETURN
    IF ( _t >= 0, "#" & _mixed, "#FFFFFF" )
```

### _Heat GM Ink Raw

Folder `Design` · spec C-46, redesign v4

```dax
_Heat GM Ink Raw =
VAR _gm           = [_Heat Colour GM]
RETURN
    IF ( _gm >= 0.5, "#FFFFFF", "#101B2B" )
```

### Info Title

Folder `Design` · spec ADR-0012

```dax
Info Title =
SUBSTITUTE ( SUBSTITUTE ( COALESCE ( SELECTEDVALUE ( dim_pl_info[title] ), SELECTEDVALUE ( dim_kpi[info_title] ) ), "{cmp}", [_Bridge Cmp Name] ), "{line}", IF ( [_Sel Entity] = "P", "category", "service line" ) )
```

### Info Text

Folder `Design` · spec ADR-0012

```dax
Info Text =
SUBSTITUTE ( SUBSTITUTE ( COALESCE ( SELECTEDVALUE ( dim_pl_info[what] ), SELECTEDVALUE ( dim_kpi[definition] ) ), "{cmp}", [_Bridge Cmp Name] ), "{line}", IF ( [_Sel Entity] = "P", "category", "service line" ) )
```

### Info Detail

Folder `Design` · spec ADR-0012

```dax
Info Detail =
IF ( NOT ISFILTERED ( dim_pl_info[info_code] ), [KPI Info Sub] )
```

### Info Glyph

Folder `Design` · spec ADR-0012

```dax
Info Glyph =
"i"
```

### Pager Text 1

Folder `Design` · spec ADR-0012

```dax
Pager Text 1 =
"1 / 2"
```

### Pager Text 2

Folder `Design` · spec ADR-0012

```dax
Pager Text 2 =
"2 / 2"
```

### NR Bridge Title

Folder `Design` · spec C-40, redesign v4

```dax
NR Bridge Title =
"Net revenue bridge - " & [_Bridge Cmp Name] & " to Actual - " & [_Units Short]
```

### Profit Bridge Title

Folder `Design` · spec C-46, redesign v4

```dax
Profit Bridge Title =
"Profit bridge: " & [_Bridge Cmp Name] & " Adj. EBITDA → Actual → Operating profit"
```

### Bridge Step In View

Folder `4 Analysis` · spec C-40, redesign v4

```dax
Bridge Step In View =
VAR _view        = [_Sel Entity]
RETURN
    IF (
        NOT ISEMPTY ( FILTER ( VALUES ( dim_bridge_step[entity_view_code] ), dim_bridge_step[entity_view_code] = _view ) )
        ,1
    )
```

### Bubble X Min

Folder `Design` · spec redesign v4

```dax
Bubble X Min =
VAR _points       =
    FILTER (
        ADDCOLUMNS (
            ALLSELECTED ( dim_region[region_name] )
            ,"@v", [KPI Organic Growth]
        )
        ,NOT ISBLANK ( [@v] )
    )
VAR _lo           = MINX ( _points, [@v] )
VAR _hi           = MAXX ( _points, [@v] )
VAR _pad          = MAX ( ( _hi - _lo ) * 0.35, 0.002 )
RETURN
    _lo - _pad
```

### Bubble X Max

Folder `Design` · spec redesign v4

```dax
Bubble X Max =
VAR _points       =
    FILTER (
        ADDCOLUMNS (
            ALLSELECTED ( dim_region[region_name] )
            ,"@v", [KPI Organic Growth]
        )
        ,NOT ISBLANK ( [@v] )
    )
VAR _lo           = MINX ( _points, [@v] )
VAR _hi           = MAXX ( _points, [@v] )
VAR _pad          = MAX ( ( _hi - _lo ) * 0.35, 0.002 )
RETURN
    _hi + _pad
```

### Bubble Y Min

Folder `Design` · spec redesign v4

```dax
Bubble Y Min =
VAR _points       =
    FILTER (
        ADDCOLUMNS (
            ALLSELECTED ( dim_region[region_name] )
            ,"@v", [Prof CM %]
        )
        ,NOT ISBLANK ( [@v] )
    )
VAR _lo           = MINX ( _points, [@v] )
VAR _hi           = MAXX ( _points, [@v] )
VAR _pad          = MAX ( ( _hi - _lo ) * 0.35, 0.002 )
RETURN
    _lo - _pad
```

### Bubble Y Max

Folder `Design` · spec redesign v4

```dax
Bubble Y Max =
VAR _points       =
    FILTER (
        ADDCOLUMNS (
            ALLSELECTED ( dim_region[region_name] )
            ,"@v", [Prof CM %]
        )
        ,NOT ISBLANK ( [@v] )
    )
VAR _lo           = MINX ( _points, [@v] )
VAR _hi           = MAXX ( _points, [@v] )
VAR _pad          = MAX ( ( _hi - _lo ) * 0.35, 0.002 )
RETURN
    _hi + _pad
```

### Var Compare B Label

Folder `Design` · spec redesign v4

```dax
Var Compare B Label =
IF ( [_Sel Compare B] = "NONE", "none", "vs " & SWITCH ( [_Sel Compare B], "B", "Budget", "LE", "LE", "PY", "PY" ) )
```

### _KPI Budget Value

Folder `9 Engine` · spec redesign v4

```dax
_KPI Budget Value =
VAR _code         = SELECTEDVALUE ( dim_kpi[kpi_code] )
RETURN
    IF (
        _code = "FY_OUTLOOK"
        ,[KPI FY Budget NR]
        ,CALCULATE (
            [_KPI Value]
            ,REMOVEFILTERS ( param_eval )
            ,TREATAS ( { "CMP_A" }, param_eval[eval_code] )
            ,REMOVEFILTERS ( param_compare_a )
            ,TREATAS ( { "B" }, param_compare_a[choice_code] )
        )
    )
```

### _Vitals Parts

Folder `3 KPIs\Vitals` · spec redesign v4

```dax
_Vitals Parts =
VAR _code         = SELECTEDVALUE ( dim_kpi[kpi_code] )
VAR _type         = SELECTEDVALUE ( dim_kpi[value_type] )
VAR _divisor      = [_Units Divisor]
VAR _units        = IF ( [_Sel Units] = "K", " k", " m" )
VAR _symbol       = SELECTEDVALUE ( param_reporting_currency[symbol], "$" )
VAR _is_pp        = _type IN { "PCT", "PCT2" }
VAR _is_fy        = _code = "FY_OUTLOOK"
VAR _better       = IF ( _is_fy, "Higher", SELECTEDVALUE ( dim_kpi[better_when] ) )
VAR _on_pct       = LOOKUPVALUE ( param_kpi_threshold[on_track], param_kpi_threshold[delta_kind], "PCT" )
VAR _on_pp        = LOOKUPVALUE ( param_kpi_threshold[on_track], param_kpi_threshold[delta_kind], "PP" )
VAR _watch_pct    = LOOKUPVALUE ( param_kpi_threshold[watch], param_kpi_threshold[delta_kind], "PCT" )
VAR _watch_pp     = LOOKUPVALUE ( param_kpi_threshold[watch], param_kpi_threshold[delta_kind], "PP" )
VAR _sel_a        = [_Sel Compare A]
VAR _evals        =
    ADDCOLUMNS (
        DATATABLE ( "e", STRING, "a", STRING, "k", INTEGER, { { "BASE", "", 0 }, { "CMP_A", "", 1 }, { "CMP_B", "", 2 }, { "CMP_A", "B", 3 } } )
        ,"@v",
            VAR _a            = IF ( [a] = "", _sel_a, [a] )
            RETURN
                CALCULATE (
                    [_KPI Value]
                    ,REMOVEFILTERS ( param_eval )
                    ,TREATAS ( { [e] }, param_eval[eval_code] )
                    ,REMOVEFILTERS ( param_compare_a )
                    ,TREATAS ( { _a }, param_compare_a[choice_code] )
                )
    )
VAR _value        = MAXX ( FILTER ( _evals, [k] = 0 ), [@v] )
VAR _base_1       = _value
VAR _cmp_1        = IF ( _is_fy, [KPI FY Budget NR], MAXX ( FILTER ( _evals, [k] = 1 ), [@v] ) )
VAR _base_2       = IF ( _is_fy, [KPI FY Outlook EBITDA], _value )
VAR _cmp_2        = IF ( _is_fy, [KPI FY Budget EBITDA], MAXX ( FILTER ( _evals, [k] = 2 ), [@v] ) )
VAR _budget       = IF ( _is_fy, [KPI FY Budget NR], MAXX ( FILTER ( _evals, [k] = 3 ), [@v] ) )
VAR _name_1       = IF ( _is_fy, "vs FY Budget", IF ( [_Sel Compare A] <> "NONE", "vs " & [_Cmp A Name] ) )
VAR _name_2       = IF ( _is_fy, "EBITDA vs FY Bud", IF ( [_Sel Compare B] <> "NONE", "vs " & [_Cmp B Name] ) )
VAR _colour_1     = _is_fy || [_Sel Compare A] = "B"
VAR _colour_2     = _is_fy || [_Sel Compare B] = "B"
VAR _value_text   =
    SWITCH (
        _type
        ,"AMT"
            ,_symbol & FORMAT ( DIVIDE ( _value, _divisor ), IF ( _units = " k", "#,0", "#,0.0" ) ) & _units
        ,"PCT"
            ,FORMAT ( _value, "0.0%" )
        ,"PCT2"
            ,FORMAT ( _value, "0.00%" )
        ,"CNT"
            ,FORMAT ( DIVIDE ( _value, _divisor ), "#,0.0" ) & _units
        ,"PRICE"
            ,_symbol & FORMAT ( _value, "#,0.00" )
        ,FORMAT ( _value, "#,0" )
    )
VAR _row1        =
    VAR _d            = _base_1 - _cmp_1
    VAR _d_pct        = DIVIDE ( _d, ABS ( _cmp_1 ) )
    VAR _zero         = IF ( _is_pp, ROUND ( _d * 100, 1 ) = 0, ROUND ( _d_pct, 3 ) = 0 )
    VAR _sign         = IF ( _d > 0, "+", IF ( _d < 0, "−", "" ) )
    VAR _abs_text     =
        SWITCH (
            _type
            ,"AMT"
                ,_sign & FORMAT ( ABS ( DIVIDE ( _d, _divisor ) ), IF ( _units = " k", "#,0", "#,0.0" ) )
            ,"CNT"
                ,_sign & FORMAT ( ABS ( DIVIDE ( _d, _divisor ) ), "#,0.0" )
            ,"INT"
                ,_sign & FORMAT ( ABS ( _d ), "#,0" )
            ,"PRICE"
                ,_sign & FORMAT ( ABS ( _d ), "#,0.00" )
        )
    VAR _rel_text     = IF ( _is_pp, _sign & FORMAT ( ABS ( _d * 100 ), "0.0" ) & " pp", _sign & FORMAT ( ABS ( _d_pct ), "0.0%" ) )
    VAR _status       =
        SWITCH (
            TRUE ()
            ,_better = "Neutral"
                ,"neutral"
            ,ABS ( IF ( _is_pp, _d * 100, _d_pct ) ) <= IF ( _is_pp, _on_pp, _on_pct )
                ,"ontrack"
            ,IF ( _better = "Lower", -_d, _d ) > 0
                ,"ahead"
            ,ABS ( IF ( _is_pp, _d * 100, _d_pct ) ) <= IF ( _is_pp, _watch_pp, _watch_pct )
                ,"watch"
            ,"off"
        )
    VAR _ink          = IF ( _colour_1, SWITCH ( _status, "ahead", "#06603F", "watch", "#8A5A00", "off", "#C2410C", "#101B2B" ), "#101B2B" )
    RETURN
        IF (
            NOT ISBLANK ( _name_1 ) && NOT ISBLANK ( _base_1 ) && NOT ISBLANK ( _cmp_1 )
            ,_name_1 & "|" & IF ( _zero, "", _abs_text ) & "|" & IF ( _zero, "on plan", _rel_text ) & "|" & _ink
            ,IF ( NOT ISBLANK ( _name_1 ), _name_1 & "|" & "" & "|" & "n/a" & "|" & "#101B2B", "|||" )
        )
VAR _row2        =
    VAR _d            = _base_2 - _cmp_2
    VAR _d_pct        = DIVIDE ( _d, ABS ( _cmp_2 ) )
    VAR _zero         = IF ( _is_pp, ROUND ( _d * 100, 1 ) = 0, ROUND ( _d_pct, 3 ) = 0 )
    VAR _sign         = IF ( _d > 0, "+", IF ( _d < 0, "−", "" ) )
    VAR _abs_text     =
        SWITCH (
            _type
            ,"AMT"
                ,_sign & FORMAT ( ABS ( DIVIDE ( _d, _divisor ) ), IF ( _units = " k", "#,0", "#,0.0" ) )
            ,"CNT"
                ,_sign & FORMAT ( ABS ( DIVIDE ( _d, _divisor ) ), "#,0.0" )
            ,"INT"
                ,_sign & FORMAT ( ABS ( _d ), "#,0" )
            ,"PRICE"
                ,_sign & FORMAT ( ABS ( _d ), "#,0.00" )
        )
    VAR _rel_text     = IF ( _is_pp, _sign & FORMAT ( ABS ( _d * 100 ), "0.0" ) & " pp", _sign & FORMAT ( ABS ( _d_pct ), "0.0%" ) )
    VAR _status       =
        SWITCH (
            TRUE ()
            ,_better = "Neutral"
                ,"neutral"
            ,ABS ( IF ( _is_pp, _d * 100, _d_pct ) ) <= IF ( _is_pp, _on_pp, _on_pct )
                ,"ontrack"
            ,IF ( _better = "Lower", -_d, _d ) > 0
                ,"ahead"
            ,ABS ( IF ( _is_pp, _d * 100, _d_pct ) ) <= IF ( _is_pp, _watch_pp, _watch_pct )
                ,"watch"
            ,"off"
        )
    VAR _ink          = IF ( _colour_2, SWITCH ( _status, "ahead", "#06603F", "watch", "#8A5A00", "off", "#C2410C", "#101B2B" ), "#101B2B" )
    RETURN
        IF (
            NOT ISBLANK ( _name_2 ) && NOT ISBLANK ( _base_2 ) && NOT ISBLANK ( _cmp_2 )
            ,_name_2 & "|" & IF ( _zero, "", _abs_text ) & "|" & IF ( _zero, "on plan", _rel_text ) & "|" & _ink
            ,IF ( NOT ISBLANK ( _name_2 ), _name_2 & "|" & "" & "|" & "n/a" & "|" & "#101B2B", "|||" )
        )
VAR _status       =
    VAR _d            = IF ( _is_pp, ( _value - _budget ) * 100, DIVIDE ( _value - _budget, ABS ( _budget ) ) )
    VAR _on           = IF ( _is_pp, _on_pp, _on_pct )
    VAR _watch        = IF ( _is_pp, _watch_pp, _watch_pct )
    RETURN
        SWITCH (
            TRUE ()
            ,_better = "Neutral" || ISBLANK ( _value ) || ISBLANK ( _budget )
                ,"neutral"
            ,ABS ( _d ) <= _on
                ,"ontrack"
            ,IF ( _better = "Lower", -_d, _d ) > 0
                ,"ahead"
            ,ABS ( _d ) <= _watch
                ,"watch"
            ,"off"
        )
VAR _sub          = [KPI Subscription Share]
VAR _pay          = [KPI Payments Share]
VAR _sub_py       = CALCULATE ( [KPI Subscription Share], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) )
VAR _pay_py       = CALCULATE ( [KPI Payments Share], REMOVEFILTERS ( param_eval ) ,TREATAS ( { "CMP_A" }, param_eval[eval_code] ) ,REMOVEFILTERS ( param_compare_a ) ,TREATAS ( { "PY" }, param_compare_a[choice_code] ) )
VAR _mix          =
    IF ( ISBLANK ( _sub ), "n/a", FORMAT ( _sub, "0.0%" ) ) & " / " & IF ( ISBLANK ( _pay ), "n/a", FORMAT ( _pay, "0.0%" ) )
        & "|Sub / Pay vs PY||" & IF ( ISBLANK ( _sub - _sub_py ), "n/a", FORMAT ( ( _sub - _sub_py ) * 100, "+0.0;−0.0;0.0" ) & " pp" ) & " / " & IF ( ISBLANK ( _pay - _pay_py ), "n/a", FORMAT ( ( _pay - _pay_py ) * 100, "+0.0;−0.0;0.0" ) & " pp" ) & "|#101B2B|||||neutral"
RETURN
    IF (
        NOT ISBLANK ( _code )
        ,IF (
            _code = "MIX"
            ,_mix
            ,_value_text & "|" & _row1 & "|" & _row2 & "|" & _status
        )
    )
```

### _Profit GM Rate Line

Folder `9 Engine` · spec C-40, redesign v4

```dax
_Profit GM Rate Line =
VAR _nr_cc       =
    CALCULATE (
        [Net Revenue]
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
VAR _gp_cc       =
    CALCULATE (
        [Gross Profit]
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
VAR _cmp_nr_cc   =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "NR"
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
VAR _cmp_gp_cc   =
    CALCULATE (
        [Bridge Comparison Amount]
        ,REMOVEFILTERS ( dim_pl_row )
        ,dim_pl_row[line_code] = "GP"
        ,REMOVEFILTERS ( param_fx_basis )
        ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
    )
RETURN
    IF (
        NOT ISBLANK ( _cmp_nr_cc ) && _cmp_nr_cc <> 0
        ,_nr_cc * ( DIVIDE ( _gp_cc, _nr_cc ) - DIVIDE ( _cmp_gp_cc, _cmp_nr_cc ) )
    )
```

### LV Leaf Count

Folder `4 Analysis\Variances` · spec C-45, redesign v4

```dax
LV Leaf Count =
VAR _accounts     =
    CALCULATETABLE (
        VALUES ( dim_account[account_code] )
        ,NOT ( dim_account[block_code] IN { "INV", "FIN", "TAX" } )
    )
RETURN
    COUNTROWS (
        FILTER (
            _accounts
            ,VAR _base        = [Base Amount]
             VAR _compare     = [Bridge Comparison Amount]
             RETURN
                 NOT ( ( ISBLANK ( _base ) || _base = 0 ) && ( ISBLANK ( _compare ) || _compare = 0 ) )
        )
    )
```

### Prof GM %

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof GM % =
CALCULATE (
    [KPI Gross Margin %]
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Prof CM %

Folder `5 Profitability` · spec C-46, redesign v4

```dax
Prof CM % =
CALCULATE (
    [KPI CM %]
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Heat Title

Folder `Design` · spec C-46, redesign v4

```dax
Heat Title =
"Mix - region × " & IF ( [_Sel Entity] = "P", "category", "service line" )
```

### How To Read Showing

Folder `Design` · spec redesign v4

```dax
How To Read Showing =
[Period Summary] & " - " & [_Units Short] & " - vs " & IF ( [_Sel Compare A] = "NONE" && [_Sel Compare B] = "NONE", "Prior year", IF ( [_Sel Compare A] <> "NONE", [_Cmp A Name] ) & IF ( [_Sel Compare A] <> "NONE" && [_Sel Compare B] <> "NONE", " and " ) & IF ( [_Sel Compare B] <> "NONE", [_Cmp B Name] ) )
```

### _Heat Colour GM

Folder `5 Profitability` · spec C-46, redesign v4

```dax
_Heat Colour GM =
CALCULATE (
    CALCULATE (
        [KPI Gross Margin %]
        ,REMOVEFILTERS ( dim_region )
    )
    ,REMOVEFILTERS ( param_fx_basis )
    ,TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )
)
```

### Info Formula

Folder `Design` · spec ADR-0012

```dax
Info Formula =
SUBSTITUTE ( SUBSTITUTE ( COALESCE ( SELECTEDVALUE ( dim_pl_info[formula] ), SELECTEDVALUE ( dim_kpi[info_formula] ) ), "{cmp}", [_Bridge Cmp Name] ), "{line}", IF ( [_Sel Entity] = "P", "category", "service line" ) )
```

### Info Source

Folder `Design` · spec ADR-0012

```dax
Info Source =
"Source: " & SUBSTITUTE ( SUBSTITUTE ( COALESCE ( SELECTEDVALUE ( dim_pl_info[source] ), SELECTEDVALUE ( dim_kpi[info_source] ) ), "{cmp}", [_Bridge Cmp Name] ), "{line}", IF ( [_Sel Entity] = "P", "category", "service line" ) )
```

# Cross-track parity check: P&L views redesign v4 and Mirelo Sales & Revenue (B vs C)

> 2026-10-27 · hunter (qa-test-hunter) · read-only on Fabric, no DAX run (Desktop only); Track C run locally.
> **Re-run after both fix rounds: §6** (current state; §1–§5 are the first pass).
> Contracts: `docs/design/P&L views redesign/{build-brief,metric-inventory}.md` + `pnl-views-redesign.html` (v4), ADR-0012, `docs/design/parity-rules.md` (1–21) · `docs/design/sales-revenue dashboard/{design-tokens,layout-spec}.md` + `mockup.html` v4, `data/mirelo_sales_dummy_data/README.md`.
> Tracks: B = `pbi-report/ACME Unified PnL/` and `pbi-report/Mirelo Sales/` (TMDL + PBIR + `tests/control-totals.dax`) · C = `js-report/lib/engine/*`, `js-report/lib/sales/*`. Track A was spot-checked only (it mirrors the B model; see "fin").

## 1. Summary

| | P&L redesign | Mirelo | Contract | Total |
|---|---:|---:|---:|---:|
| **Gap** (one track must change) | 17 | 12 | — | **29** |
| **Accepted** (platform difference or equivalent) | 4 | 1 | — | **5** |
| **Contract** (the spec must change, the tracks agree) | 1 | 2 | 2 | **5** |
| Findings | 22 | 15 | 2 | **39** |

By severity (gaps + contract): high 4 (PV-01, PV-02, MS-01, MS-02) · medium 11 · low 19.

Numbers: Track C reproduces every control total of the quoted view (Commerce Cloud FY2025, USD, actual rates: NR 667,360,690.84 · Adj. EBITDA 82,827,372.21 · OP 48,580,071.47 · NP 38,144,183.91, the same rows Track B asserts in T-06) and every reconciliation Track B asserts in T-R2 … T-R5 (bridge Σ steps, profit bridge to OP, variances total = OP Δ, shares = 100 %). The profit-bridge GM rate / GM mix split is written differently in the two tracks but is algebraically identical (PV-15). The numeric gaps are Profitability (B reads the selected FX basis, C constant currency: PV-02) and the heatmap colour basis (PV-03). The biggest user-visible gap is Mirelo: under the default comparator (Budget) 14 of 24 KPI cards and the Returning-clients hero read "n/a" in Track B where Track C (and the layout spec) fall back to the prior year (MS-01, MS-02).

Test run (`js-report`, `npm test`): **23 files, 360 passed, 36 expected-fail (396)**. The 337 existing tests are unchanged and green; the new parity spec adds 23 passing tests (1,398 `match` rows asserted) and 36 `it.fails` tests, one per known Track C gap row (they flip to failures the day nerd fixes the gap, which forces the row to `match`). `npm run lint`, `tsc --noEmit` and Prettier are clean.

## 2. Findings

Verdict: **gap** = one track must change · **accepted** = keep the difference · **contract** = the tracks agree, the spec is wrong or ambiguous. Owner = who fixes.

### 2.1 P&L views redesign v4

| id | panel | Track B | Track C | verdict | sev | owner | fix |
|---|---|---|---|---|---|---|---|
| PV-01 | Vitals status chip / row colour | `_KPI Status` and `Vitals Card SVG` compare with **Compare A**; Compare A = None → no chip | vs **Budget only** (`thresholds.ts`, `vitals.ts`), whatever Compare A is | gap | high | bip (+ fin) | Status vs Budget (`param_eval` = the Budget plan, not CMP_A), brief §0 and HTML "vs Budget only". Probe row set `S-FY25-cmpPY` (Compare A = PY). Track A mirrors `_KPI Status` vs CMP_A in `model/thresholds.ts` + `pnl-model-queries.ts` → same fix |
| PV-02 | Profitability, all panels | Only `Prof NR Δ % CC` is at constant currency; table NR / GM % / CM % / CM Δ / contribution / EBITDA, `Conc Share`, heat cells, bubble y / size, company refs follow the Display flyout (default actual rates) | Every number at CC (selected year's budget rates), flyout ignored | gap | high | bip; USER to amend brief | Brief §3 says "CC by default … Display flyout still rules"; neither track can do both. Recommend the C rule (always CC on Profitability, stated in the subtitle) and amend brief §4 row "FX basis on Profitability". S FY2025 today: table total NR B 667.4 vs C 655.6, Adj. EBITDA 82.8 vs 81.3, NA share of NR 53.6 % vs 54.6 % |
| PV-03 | Profitability p2 mix heatmap | Colour = GM % of the **cell** (region × line), 4 fixed bins < 30 / < 50 / < 70 / ≥ 70 % (`_Heat GM Fill Raw`); ⓘ says "of the cell" | Colour = GM % of the **service line** (column), continuous ramp | gap | medium | bip | Brief §3 and HTML (`col(H.gm[j])`, ramp 30 → 81 %): column GM %. Evaluate `[KPI Gross Margin %]` with `REMOVEFILTERS ( dim_region )`; fix the HEAT `dim_pl_info.what`. C ramps min–max of the shown columns, HTML fixed 30–81 % (cosmetic, accept) |
| PV-04 | Vitals Revenue mix card | Value = subscription share only (`dim_kpi` MIX "Subscription share of NR"), rows vs Compare A / B in pp | "37.1% / 49.9%" (Sub / Pay), one row "Sub / Pay vs PY" in pp, no chip | gap | medium | bip | Brief §1 + HTML `k-mix`: two shares, Δ vs PY. bip's "MIX card subscription share only" is a gap, not a platform limit (SVG measure) |
| PV-05 | Analysis p2 variances, vs PY column | `LV Δ B` = vs **Compare B**, blank when Compare B = None (header still "VS PY") | Always actual − **prior year**, label "vs PY", never dropped | gap | medium | nerd | Brief §2: "vs PY = `Compare B Amount` per leaf". C: Compare B, header "vs <Compare B>", column dropped on None (rule 17; B keeps the empty column, accepted). nerd's "variances vs PY always" is a gap |
| PV-06 | Analysis p2 + Profitability headers | Hard-coded "BUDGET", "VS PY" (`an_var_m*/t*`) and "Δ VS BUD % (CC)" (`pf_table`) while the values follow `Bridge Comparison Amount` | Built from the selection (`Δ vs {cmp} %`, `columns.comparison`) | gap | medium | bip | Rule 13 (DEF-001 pattern): header text from `_Bridge Cmp Name` (field-parameter display names or a header card) |
| PV-07 | Vitals card titles | `dim_kpi.kpi_label`: "Opex % of NR", "ARR (period end)", "Active merchants (period end)", "Subscription share of NR", "FY outlook (net revenue)" | "Opex % revenue", "ARR (run-rate)", "Active merchants", "Revenue mix", "FY outlook" | gap | low | bip | Brief §1 / HTML titles (C is right) |
| PV-08 | Vitals status chip word | "On track / Ahead / Watch / Off track" | "on track / ahead / watch / off track" | gap | low | bip | HTML `chipTxt` is lower case |
| PV-09 | ⓘ sub-metrics (Vitals) | `KPI Info Sub`: OP = margin + net margin only; GM % blank for Consumer Products; Opex no $ / Δ; GMV take rate without Δ; Rule of 40 "40.2" | OP adds Adj. EBITDA, D&A, adjusting items, net profit; P GM % = top-2 categories; Opex $ and Δ vs Budget; take-rate Δ in bp vs Compare A; Rule of 40 "40.2%" | gap | low | bip (+ nerd: take-rate Δ vs Budget **and** vs PY per HTML) | Brief §1 sub-metric column + HTML `INFO`; root cause PC-01 |
| PV-10 | Vitals Active merchants ⓘ | GMV per merchant "#,0" → "100,337" (no currency) | `money()` in report units → "**$0.1 m**" (unreadable) | gap | low | nerd + bip | HTML: "$100.3 k". Row `vitals.merchants.gmv_per_merchant_text` (it.fails in C) |
| PV-11 | NR / profit bridge labels | "Comparison NR" · "Constant-currency NR" · "Actual NR"; "Comparison Adj. EBITDA" | "Budget" · "Constant currency" · "Actual"; "Budget EBITDA" | gap (C) / accepted (B start) | low | nerd | Brief §2: "<cmp> NR → … → Constant-currency NR → FX → Actual NR". B's start label is a static axis category (title names the comparison): accepted |
| PV-12 | Variances footer | One card sentence; counts only lines with Δ ≠ 0 ("Shown 8 of 32 lines" for S FY2025); no Budget / Actual / vs PY / FX in the footer | Three footer rows (shown · all other · total at OP) with every column; counts all 35 leaves | gap | low | bip | Brief §2: leaf lines to OP = 35 (S), footer with Budget / Actual / vs PY / FX. Row `var.leaf_count` |
| PV-13 | Profitability "Δ vs Budget %" | Plain text | Green / orange text on any non-zero Δ | gap | low | nerd | Brief §3: CM Δ is the only status indicator; drop the tone |
| PV-14 | Copy punctuation (C) | " - " everywhere | "How to read — Vitals", "Concentration — share …", "Mix — region × …" (em dash); " · " in ⓘ formulas / sources and bubble labels "CM 50.9% · +26.9%" | gap | low | nerd (+ main agent) | Rule 6 (DEF-003). The HTML v4 itself uses "—" and " · ": main agent to state which wins |
| PV-15 | Profit bridge GM rate / mix | rate = Σ NRcc,l × ΔGM %l; mix = remainder | mix = Σ (NRl − NR × share cmp,l) × GM %cmp,l; rate = remainder | accepted | — | — | Algebraically identical (new and discontinued lines included); only the ⓘ formula text differs (PC-01) |
| PV-16 | Profit bridge axis | Native waterfall from 0 (NR bridge is truncated via `Bridge Axis Min`) | Truncated | accepted | — | USER | README decision 4 allows it; its "net change" panel was not built — recommend not building it (ADR-0012) |
| PV-17 | ⓘ position | Top-right of card / panel | Top-right | accepted | — | — | Both follow the P&L HTML (`h2 .i{margin-left:auto}`); Mirelo's bottom-left is that report's own spec. nerd's and bip's "ⓘ top-right" notes: compliant |
| PV-18 | Heatmap in the Group view | 9 columns (both companies' lines) | No Group view (Track C build step 4) | accepted | — | nerd later | Follow B when the Group view is built |
| PV-19 | Profitability breakdown | `prof_breakdown` slicer on the page, but `pf_table` rows are `dim_region[region_name]` (no field parameter): the slicer changes nothing; bip reports empty tiles | Region only, no control | gap | medium | bip; USER | Brief §4 still lists Region · Channel · Line · Segment. Recommend: remove the dead slicer (v4 = Region only) and amend brief §3 / §4; otherwise both tracks must build the breakdown |
| PV-20 | Header status line | `<Company> - Management reporting - Closed through … - Refreshed …` | Same | contract | low | main agent | Brief §0 also asks for the period sentence and "<currency> $m": the tracks agree with the period-picker-v2 decision; amend the brief (DEF-002) |
| PV-21 | Vitals Δ amount text | "+9.1" (no symbol / unit, as the HTML `varRow`) | "+$9.1 m"; a Δ that rounds to 0 shows "$0.0 m" | gap | low | nerd | Follow the HTML / B form |
| PV-22 | Units sold value (Consumer Products) | "569.3 m" (CNT ÷ the units divisor) | "569,256,242" | gap | low | bip | " m" reads as $ millions; use the integer (or "569.3m units") |

Known deviations reported by the builders, classified:

| reported by | deviation | verdict |
|---|---|---|
| nerd | ⓘ top-right (Mirelo bottom-left) | accepted (PV-17) |
| nerd | Profitability always CC | the C rule is the recommendation; B must change (PV-02) |
| nerd | variances vs PY always | gap, C changes (PV-05) |
| nerd | status chips vs Budget only | C is right; B changes (PV-01) |
| nerd | heatmap colour = column GM % | C is right; B changes (PV-03) |
| bip | heatmap Group view 9 columns | accepted (PV-18) |
| bip | breakdown slicer empty tiles | gap: the slicer is dead, remove it (PV-19) |
| bip | MIX card subscription share only | gap, B changes (PV-04) |
| bip | profit bridge axis at 0 | accepted (PV-16) |
| bip | ⓘ top-right | accepted (PV-17) |

### 2.2 Mirelo Sales & Revenue

| id | panel | Track B | Track C | verdict | sev | owner | fix |
|---|---|---|---|---|---|---|---|
| MS-01 | KPI cards, views 2–5 (L4–L6, C2–C4, P2–P6, R3–R6) | Comparator = Budget → `_cmp = BLANK()`: "vs Budget n/a", grey "n/a" chip | Falls back to Prior year when the metric has no Budget (`kpis.ts`), status from that row | gap | high | bip | layout-spec rows ("L4 vs PY ▲ +1.3pp (good)") and §6. `_cmp = IF ( comparator = "PY" \|\| no Budget, [X PY], [X Budget] )`, label follows. Rows `*.row_cmp` / `*.row` / `*.chip` marked `gap:MS-01` |
| MS-02 | Overview hero O3 Returning clients | Chip = Budget status = "n/a" under the default comparator | Chip falls back to the PY row → "▲ Good" | gap | high | bip | layout-spec O3: chip ▲ Good. `_s_sel = IF ( cmp = "PY" \|\| _s_bud = "neutral", _s_py, _s_bud )` on all four heroes |
| MS-03 | C6 Days between loans | Placeholder ("needs previous-loan dates") | 115 d median, vs PY +5 d (neutral), from the client's previous `disbursed_date` in `fact_loan` | gap | medium | bip / ginee | The data has it (client_id + disbursed_date). Previous loans before 2024 are not in `fact_loan`: both tracks state that in the ⓘ |
| MS-04 | R3 / R4 | "Interest income" vs PY, "Fees" vs PY | Same | gap (both vs contract) | medium | bip + nerd | layout-spec v4 §5: R3 = Interest + fees vs Budget (€1.07m, −3.8 %), R4 = Interchange vs Budget (€122k, +4.3 %). No match rows for R3 / R4 values (rule 3); label rows `gap:MS-04` |
| MS-05 | C5 180-day repeat comparator | "vs prev. cohort" (previous month's cohort) | Same | gap (both vs contract) | medium | bip + nerd, or USER | layout-spec C5: "vs PY cohort" (Mar 2026 vs Mar 2025: −0.9 pp). Rows `c5.row_cmp`, `c5.row` hold the contract value |
| MS-06 | Status chip text | Word only ("Good") | Glyph + word ("▲ Good") | gap | low | bip | tokens §10 "Same word + glyph"; layout-spec chips "▲ Good" |
| MS-07 | Status banding | Bands the Δ rounded to 0.1 % / 0.1 pp (−0.04 % → good, "0.0%") | Bands the raw Δ (−0.04 % → watch, "▼ −0.0%") | gap | low | nerd | Band the displayed value (B rule). Not hit by the 13 parity selections |
| MS-08 | How to read | No "Showing …" sentence; free paragraphs per view | "Showing Sep 2026 - Month - All markets - Actual vs Budget and Prior year - Closed through Sep 2026" + Top band · Grid · Table · Legend | gap | medium | bip (+ PC-01) | layout-spec §0.1 / tokens §9: the sentence lives **only** in How to read, so Track B shows the selection sentence nowhere |
| MS-09 | Hero comparator bars | 80 px track (±20 % over 40 px), rows at y 136 / 160 | not measured | gap (B) | low | bip | layout-spec v4: 160 × 6 bar, 4 px per 1 %, rows at y 108 / 132 |
| MS-10 | PY on a partly covered window | `X PY` sums whatever months exist (e.g. R12M Sep 2024 → PY = Jan–Sep 2024 only) | n/a unless the whole reference window has data (`cube.available`) | gap | low | bip | Blank a PY whose window starts before Jan 2024; probe: R12M anchored ≤ Nov 2024 |
| MS-11 | KPI comparator label | "vs PY" | "vs Prior year" | contract | low | USER / main agent | layout-spec KPI rows say "vs PY", hero rows and tokens §10 "vs Prior year". The CSV compares the comparator code (`row_cmp` = BUD / PY), not the label |
| MS-12 | KPI titles | C4 "New-client approval", P5 "Roll rate 30 to 60" | "New-client approval rate", "Roll rate 30→60" | gap | low | bip | layout-spec titles |
| MS-13 | L11 Attainment by channel | Placeholder "Placeholder - see How to read" | Placeholder with a one-line reason on the panel | accepted | low | nerd (optional) | No channel targets in the data. C's sentence on the panel is the kind of text ADR-0012 moves into the ⓘ |
| MS-14 | ⓘ sub-values | One-line notes (O1 avg ticket + % of target; O4 90+ and vintage …) | Label / value lists of 2–5 items | gap (both vs contract) | low | bip + nerd | layout-spec lists 4–6 sub-values per hero (Budget, PY, YTD, €1.50m of €32.47m, appetite 4.2 % …); PC-01 |
| MS-15 | Count format | "9,796" | "9,796" | contract | low | main agent | layout-spec O2 says "9.8k"; tokens §8 (counts < 10k with separator) wins; fix the layout spec |

### 2.3 Contract

| id | finding | owner | fix |
|---|---|---|---|
| PC-01 | The shared copy files were never written: `docs/ADD/features/info-popovers.md` has no Vitals / Analysis / Profitability entries (brief: "to be moved on approval"), and `docs/ADD/features/sales-info-popovers.md` does not exist (tokens §10). Every ⓘ and How-to-read string was written twice (PV-09, PV-14, MS-08, MS-14) | main agent | Write both files from the HTML `INFO` / `HOWTO` objects and the mockup; tracks copy verbatim (rule 16); then hunter adds copy rows |
| PC-02 | build-brief §5 and parity-rules "Check" name `data/acme_pl_dummy_data/checks/parity_selections.csv`; the file set lives in `js-report/lib/test-utils/parity/` (routing of this task) | main agent | Amend both docs, or move the CSVs to `data/…/checks/` and point the spec at them (Track A / B should not read from `js-report/`) |

## 3. Parity file set

`js-report/lib/test-utils/parity/`

| file | what |
|---|---|
| `parity_selections.csv` | P&L, 601 rows: 6 selections (`S-FY25` = the quoted view, `S-YTD26`, `P-FY25`, `P-YTD26`, probes `S-FY25-cmpPY` (Compare A = PY, B = Budget) and `S-FY25-noB` (Compare B = None)) × Vitals / bridges / variances / profitability / concentration / bubble / heatmap metrics |
| `parity_selections_mirelo.csv` | Mirelo, 833 rows: Sep 2026, FY2025, FY2026 YTD × ALL / PL / RO / PT (comparator Budget) + Sep 2026 ALL with comparator PY; Budget values, hero cards, KPI cards of views 2–5 (ALL markets + PL Sep 2026) |
| `pnl.ts`, `mirelo.ts` | Track C resolvers: metric id → value from the engine (the Track C side of the contract) |
| `parity.test.ts` | Vitest spec: header check, well-formedness and uniqueness, one test per selection for the `match` rows (soft assertions list every mismatch), one `it.fails` per `gap:` row |

Columns: `sel_id` + the selection (P&L: entity, fy, month, time_view, compare_a, compare_b, currency, fx_basis, units; Mirelo: market, period, anchor, comparator) · `metric` · `kind` (amount · ratio · count · text · status) · `expected` · `tol` · `c_status` · `b_status` · `source`.

- **Units:** amounts in reporting-currency units (not millions); ratios and pp as fractions (0.003 = 0.3 pp); status as Track B codes (P&L `_KPI Status`: ontrack / ahead / watch / off / neutral; Mirelo: good / watch / off / neutral).
- **Tolerances:** control totals 0.01 (as T-06), other amounts 0.05, ratios 1e-6, counts and text exact; Mirelo amounts 0.011 (as T-M1).
- **Status markers:** `match` (`match:T-06` = already asserted there) · `gap:<id>` = the row holds the **contract** value and that track does not show it yet · `accepted:<id>`. `b_status` is from reading the TMDL / PBIR; no DAX was executed.
- **Sources:** `control_totals_usd` · `engine-c 2026-10-27` (Track C output, reviewed against the contract) · `contract: …` (the value comes from the spec).
- **Maintenance:** the CSVs are a reviewed contract, edited by hand. When a gap is fixed, the `it.fails` row fails: flip it to `match`. When a decision changes a value, change the row and cite the decision. Never re-seed from one track's output.

### How bip adds the Track B side

One EVALUATE per selection family in `tests/control-totals.dax` (or a new `tests/parity.dax`), same pattern as T-R1 … T-R5: paste the rows of one `sel_id` as a DATATABLE, set the slicer state with TREATAS, evaluate the metric through a SWITCH, `_pass` within `tol`. Rows marked `gap:` in `b_status` are expected to fail until the fix lands.

```dax
EVALUATE
VAR _rows =
    DATATABLE (
        "metric", STRING
        ,"expected", DOUBLE
        ,"tol", DOUBLE
        ,{
            { "vitals.opex.value", 0.389467893, 0.000001 }
            ,{ "nr_bridge.CC_SUB.value", 655627990.7605, 0.05 }
            ,{ "profit_bridge.GM_RATE.value", -25843.1097, 0.05 }
            ,{ "var.coverage_top8", 0.879622674, 0.000001 }
        }
    )
VAR _actual =
    ADDCOLUMNS (
        _rows
        ,"actual",
            VAR _metric       = [metric]
            RETURN
                CALCULATE (
                    SWITCH (
                        _metric
                        ,"vitals.opex.value"
                            ,[KPI Opex % NR]
                        ,"nr_bridge.CC_SUB.value"
                            ,SUMX ( FILTER ( VALUES ( dim_bridge_step[step_code] ), CALCULATE ( MAX ( dim_bridge_step[step_sort] ) ) < 80 ), [_Bridge Value] )
                        ,"profit_bridge.GM_RATE.value"
                            ,CALCULATE ( [_Profit Step], dim_profit_step[step_code] = "GM_RATE" )
                        ,"var.coverage_top8"
                            ,[LV Coverage Value]
                    )
                    ,TREATAS ( { "S" }, param_entity_view[entity_view_code] )
                    ,TREATAS ( { 2025 }, param_fiscal_year[fiscal_year] )
                    ,TREATAS ( { 12 }, param_period[month_number] )
                    ,TREATAS ( { "FY" }, param_time_view[time_view_code] )
                    ,TREATAS ( { "A" }, param_base_version[choice_code] )
                    ,TREATAS ( { "B" }, param_compare_a[choice_code] )
                    ,TREATAS ( { "PY" }, param_compare_b[choice_code] )
                    ,TREATAS ( { "USD" }, param_reporting_currency[currency_code] )
                    ,TREATAS ( { "ACT" }, param_fx_basis[fx_basis_code] )
                )
    )
RETURN
    ADDCOLUMNS (
        _actual
        ,"_test", "Parity S-FY25"
        ,"_pass", ABS ( [actual] - [expected] ) <= [tol]
    )
```

Text and status rows: a second EVALUATE with `"expected", STRING` and `_pass = [actual] = [expected]`.

Metric map (P&L; ids not listed follow the same prefix):

| metric id | Track B expression |
|---|---|
| `ct.<line>` | `[Base Amount]` with `dim_pl_row[line_code] = <line>` (T-06) |
| `vitals.nr.value` / `ebitda` / `op` | `[Net Revenue]` / `[Adjusted EBITDA]` / `[Operating Profit]` |
| `vitals.gm.value`, `vitals.opex.value` | `[KPI Gross Margin %]`, `[KPI Opex % NR]` |
| `vitals.nr.organic` | `[KPI Organic Growth]` |
| `vitals.fy.value`, `vitals.fy.attainment` | `[KPI FY Outlook NR]`, `[KPI FY Attainment]` |
| `vitals.mix.sub_share` / `pay_share` | `[KPI Subscription Share]` / `[KPI Payments Share]` |
| `vitals.gmv.value`, `merchants.value`, `arr.value` | `[KPI GMV]`, `[KPI Active Merchants]`, `[KPI ARR]` |
| `vitals.<card>.status` | `[_KPI Status]` with `dim_kpi[kpi_code]` = the card's code (after PV-01: vs Budget) |
| `vitals.<card>.value_text`, `.rows` | the value text and row names of `Vitals Card SVG` (expose them as two small text measures) |
| `nr_bridge.<step>.value` | `[_Bridge Value]` per `dim_bridge_step[step_code]`; `CC_SUB` = Σ steps with `step_sort` < 80; `END` = `[Net Revenue]` |
| `profit_bridge.<step>.value` | `[_Profit Step]` per `dim_profit_step[step_code]`; `ACT` = `[Adjusted EBITDA]`, `OP` = `[Operating Profit]` |
| `var.total_delta` | `[Operating Profit]` − `[Bridge Comparison Amount]` on OP (T-R4) |
| `var.total_fx` | Σ `[LV FX]` × `[_Units Divisor]` over the leaf accounts |
| `var.coverage_top8`, `var.leaf_count` | `[LV Coverage Value]`; COUNTROWS of the leaf accounts down to OP |
| `var.top8_codes`, `var.nm_codes` | CONCATENATEX of `TOPN ( 8, … [LV Abs Δ] )` account codes (space separated); account codes where `[LV Δ % Text]` = "n.m." (sorted) |
| `prof.<region>.*`, `prof.TOTAL.*` | `[Net Revenue]`, `[Prof NR Δ % CC]`, `[KPI Gross Margin %]`, `[KPI CM %]`, `[Prof CM Δ pp]` ÷ 100, `[Adjusted EBITDA]` per `dim_region[region_code]` (at CC after PV-02); `cm_status` = `[_Prof CM Status]` |
| `conc.<region>.<NR\|CM\|EBITDA>` | `[Conc Share]` per region × `dim_conc_level[level_code]` |
| `bubble.<region>.growth`, `bubble.company.*` | `[KPI Organic Growth]` per region; `[Prof Company Growth]`, `[Prof Company CM %]` |
| `heat.<line>.colour_gm` | the GM % the fill is computed from, per `dim_line[line_code]` (after PV-03: column GM %) |

Mirelo map: `budget.loans` → `[Loans Budget]`, `budget.principal_eur` → `[Principal Budget EUR]`, `budget.new_clients` → `[New Clients Budget]`, `budget.dpd30_pct` → `[DPD30 Budget %]`, `budget.revenue_eur` → `[Revenue Budget EUR]`, all with the T-M1 TREATAS on `param_anchor_month` / `param_period` / `param_market`; `o<n>.chip` and `<card>.chip` / `.row_cmp` / `.row` need the status code, the comparator used (BUD / PY) and the Δ text of each card as small text measures (today they live inside `Card * SVG`).

## 4. Track C numbers, Commerce Cloud FY2025 vs Budget (USD m, actual rates)

| item | Track C | contract / Track B expectation | |
|---|---:|---|---|
| Net revenue | 667.4 | control_totals 667.4 (T-06) | ✓ |
| Adj. EBITDA / OP / NP | 82.8 / 48.6 / 38.1 | control_totals (T-06) | ✓ |
| NR vs Budget | +9.1 (+1.4 %), chip ahead | spec "+9.2 / +1.4 %" (rounded 9.14) | ✓ |
| NR bridge: Budget → CC subtotal → FX → Actual | 658.2 → 655.6 → +11.7 → 667.4 | inventory "CC NR 655.7" = 667.4 − 11.7 on rounded numbers (exact 655.63) | ✓ (T-R2 identity) |
| Profit bridge | 82.9 → vol −1.5 → rate −0.0 → mix −1.4 → VSC +0.2 → S&M +0.5 → R&D +0.5 → G&A +0.2 → other −0.1 → FX +1.5 → 82.8 → D&A −31.1 → adj. −3.2 → 48.6 | T-R3 identity | ✓ |
| Variances | OP Δ −1.6; top 8 cover 88 %; 35 leaves; n.m. on ADJ_1–3, OOI_1–3 | T-R4 identity; B counts 32 lines (PV-12) | ✓ / gap |
| Profitability (CC) | NR 655.6, Δ vs Budget −0.4 %, CM 51.3 %, CM Δ −0.2 pp; region CM 50.9 – 52.0 % | inventory "region CM % 50.9–51.9" (illustrative); B at actual rates (PV-02) | gap B |
| Concentration | shares sum to 100 % per level | T-R5 | ✓ |

## 5. Fixes per owner (severity order)

**bip (Track B)**
1. MS-01: KPI comparator fallback to PY when the metric has no Budget (14 cards).
2. MS-02: hero chip fallback to the PY row (O1–O4).
3. PV-01: Vitals status vs Budget only (not Compare A).
4. PV-02: Profitability at constant currency in every panel (after the USER confirms the brief amendment).
5. PV-03: heatmap colour = column GM % (fix the HEAT ⓘ text).
6. PV-04: Revenue mix card = Sub % / Pay %, Δ vs PY in pp.
7. PV-06: column headers from the selection (variances, profitability).
8. PV-19: remove the dead breakdown slicer (or wire it, if the USER keeps the breakdown).
9. MS-03: build C6 days between loans (with ginee if a previous-loan column goes upstream).
10. MS-08: "Showing …" sentence in each How to read.
11. MS-04 / MS-05: R3 / R4 card set and the C5 comparator, with nerd, after the USER confirms the layout spec.
12. Low: PV-07, PV-08, PV-09, PV-10, PV-12, PV-22, MS-06, MS-09, MS-10, MS-12, MS-14.
13. Add the DAX parity rows of §3 (start with `S-FY25` and `M-2026-09-ALL`).

**nerd (Track C)**
1. PV-05: variances "vs PY" column = Compare B, label from the selection, dropped on None.
2. MS-04 / MS-05: R3 / R4 and C5 (with bip).
3. PV-10: GMV per merchant "$100.3 k".
4. PV-11: bridge labels "<cmp> NR", "Constant-currency NR", "Actual NR".
5. PV-21: Δ amount text as "+9.1" (HTML / B).
6. PV-13: no tone on the Profitability Δ % column.
7. PV-14: " - " instead of "—" and " · " in view copy (after the main agent rules on HTML vs rule 6).
8. MS-07: band the displayed Δ.
9. MS-13 (optional): L11 reason into the ⓘ.
Each fix flips its `it.fails` rows; set them to `match` in the CSV.

**fin (Track A; spot check only, not audited line by line)**
1. PV-01 applies: `model/thresholds.ts` and `pnl-model-queries.ts` derive the status vs CMP_A (`_KPI Status` mirror); move to Budget with bip.
2. Verify PV-02, PV-03, PV-04, PV-05 after bip's model changes (Track A reads the same measures), then run the A side of `parity_selections.csv`.

**main agent / USER**
1. PC-01: write `info-popovers.md` (views redesign) and `sales-info-popovers.md`.
2. PV-02 / PV-19: amend build-brief §3 / §4 (Profitability FX basis, breakdown).
3. MS-04 / MS-05 / MS-11 / MS-15: confirm the layout-spec rows (R3 / R4, C5 comparator, "vs PY" label, 9,796).
4. PV-14 / PV-20 / PC-02: HTML vs rule 6, header line, parity file location.

## 6. Re-run after both fix rounds (2026-10-27, evening)

Inputs: the Track B P&L model has 253 measures and the Mirelo model 338, both with T-P blocks in `tests/control-totals.dax` (bip: Mirelo 833 rows all TRUE; P&L S-FY25 rows TRUE, full run in progress). Track C: 362 tests, 0 expected-fail. Decisions applied: PV-02 always constant currency, PV-03 column GM %, PV-19 Region only, PV-16 / PV-17 / PV-18 accepted, copy source = `info-popovers.md` + `sales-info-popovers.md`, variance leaves with no data in either version are hidden and n.m. applies only to lines with data. Track B verdicts come from reading the TMDL, PBIR and dim tables, plus bip's T-P run where stated. No DAX was run here.

### 6.1 Counts

| | closed | still open | accepted (unchanged) | total |
|---|---:|---:|---:|---:|
| First-pass findings | 30 | 4 | 5 | 39 |
| New in the re-run | 1 | 2 | — | 3 |
| **All** | **31** | **6** | **5** | **42** |

CSV markers after the re-run:
- P&L, 601 rows: `c_status` all `match`. `b_status`: 572 `match` + 16 `match:T-06`, 4 `gap:PV-12`, 4 `gap:PV-23`, 5 accepted (PV-11 ×4, PV-05 ×1).
- Mirelo, 833 rows: `c_status` and `b_status` all `match`.

`npm test`: 23 files, 362 passed, 0 expected-fail.

### 6.2 Per finding

| id | state | evidence / what is left |
|---|---|---|
| PV-01 | closed | `_KPI Status` and `_Vitals Parts` compare with `_KPI Budget Value` (the CMP_A slot forced to Budget); row ink only on a Budget row. Probe `S-FY25-cmpPY` flipped to match |
| PV-02 | closed | `Prof Net Revenue`, `Prof GM %`, `Prof CM %`, `Prof CM Δ pp`, `Prof Contribution`, `Prof Adj EBITDA`, `Conc Share`, `_Heat Cell Raw`, `Prof Company CM %` and bubble y / size are all wrapped in TREATAS CC. The subtitle "Constant currency (FY… budget rates) - … - vs …" matches Track C. 181 rows flipped |
| PV-03 | closed | `_Heat Colour GM` = `[KPI Gross Margin %]` with REMOVEFILTERS ( dim_region ) at CC (column GM %); the HEAT ⓘ says "of the column". Track B's 4 fixed bins vs Track C's ramp: cosmetic, accepted |
| PV-04 | closed | MIX card = "Sub % / Pay %", one row "Sub / Pay vs PY" in pp, no chip |
| PV-05 | closed (C) | Track C: column = Compare B, label "vs PY" / "vs Budget" / "vs LE", dropped on None. Track B `Var Compare B Label` returns "none" and the matrix keeps the empty column (rule 17, accepted) |
| PV-06 | closed | Variance headers are now "COMPARISON" / "Δ VS COMPARE B" and the Profitability header is "Δ %", so they are no longer wrong under Compare A = LE / PY; the panel title names the comparison. Static generic headers vs Track C's named ones: accepted platform difference |
| PV-07 | closed | `dim_kpi.kpi_label`: Opex % revenue, ARR (run-rate), Active merchants, Revenue mix, FY outlook |
| PV-08 | closed | `KPI Status` and the card chip use the lower-case words |
| PV-09 | closed | `KPI Info Sub` = Track C's label: value lists (OP levels and net profit, top-2 category GM % for Consumer Products, opex $ and Δ, take-rate Δ vs Budget and vs PY in bp, Rule of 40 as %) |
| PV-10 | closed | Both tracks show "$100.3 k" (B: `"$" & FORMAT ( x / 1000, "#,0.0" ) & " k"`) |
| PV-11 | closed (C) | Track C labels: "Budget NR", "Constant-currency NR", "Actual NR". Track B START stays "Comparison NR" (accepted) |
| **PV-12** | **open (bip)** | `LV Leaf Count` counts every leaf to OP in the company's scope (35 S / 38 P) **before** hiding. Decided: both tracks report the lines **shown** after hiding (32 / 32 / 37 / 37). Count only leaves where base or comparison has data |
| PV-13 | closed | Track C NR Δ % tone = neutral |
| PV-14 | closed | No " · " or "—" left in Track C view copy (copy now comes from `info-popovers.md`) |
| PV-15 – PV-18 | accepted | unchanged |
| PV-19 | closed | Decided Region only; the `prof_breakdown` slicer is removed from the PBIR. Brief §4 is not yet amended (PC-03) |
| **PV-20** | **open (main agent)** | build-brief §0 header line still lists the period sentence and the currency; both tracks omit them |
| PV-21 | closed | Track C Δ amount text matches the HTML / Track B ("+9.1") |
| PV-22 | closed | UNITS `value_type` = INT → "569,256,242" in both tracks |
| MS-01 | closed | KPI cards without a Budget use PY as their fixed comparator (`_Card L4 Parts` … `_cmp_code = "PY"`); 144 rows flipped |
| MS-02 | closed | Hero `_use_py` falls back to the PY row when the Budget row is neutral (O1–O4) |
| MS-03 | closed | `_Days Between Loans`: median days since the client's previous loan (join on `prior_loans − 1`), value and PY; B T-P c6 rows TRUE |
| MS-04 | closed | R3 "Interest + fees" vs Budget, R4 "Interchange" vs Budget in both tracks |
| MS-05 | closed | C5 "vs PY cohort" (`180-day Repeat % PY Cohort`) in both tracks |
| MS-06 | closed | Hero chip = glyph + word |
| MS-07 | closed | Track C bands the displayed Δ. The three rows nerd corrected read the same in Track B, and all three are in bip's Mirelo T-P (TRUE):<br>• `_Card O4 Parts` rounds the pp Δ to 0.1 and writes "◦ " for 0, so `M-2026-09-PT` and `M-FY2026_YTD_SEP-PT` `o4.row_py` = "vs Prior year: ◦ 0.0pp".<br>• `_Card P6 Parts` rounds to 0.1 pp and bands ≤ 0.5 as watch, so `M-FY2025-ALL p6.chip` = watch |
| MS-08 | closed | `How To Read Showing` = Track C `periodLine` |
| MS-09 | closed | Hero bars are 160 × 6 at y 108 / 132, ±20 % / ±5 pp over 80 px per side |
| MS-10 | closed | `X PY` measures are blank when the PY window starts before Jan 2024 (`_start >= 1`; month_index 1 = 2024-01) |
| **MS-11** | **open (contract, USER)** | KPI row label: Track B "vs PY", Track C "vs Prior year". The CSV compares the comparator code only |
| MS-12 | closed | C4 "New-client approval rate", P5 "Roll rate 30→60" |
| MS-13 | accepted | Track C placeholder text shortened to "Not available - no channel targets" (the reason is in the ⓘ) |
| MS-14 | closed | Hero notes carry the layout-spec sub-values (O3: returning of borrowers, loan-weighted, 180 / 90-day, PY, no Budget; O4: balance of outstanding, 90+, by count, vintage, Budget appetite, PY) |
| **MS-15** | **open (main agent)** | layout-spec O2 / C1 still say "9.8k"; both tracks show "9,796" (tokens §8) |
| PC-01 | closed | `info-popovers.md` and `sales-info-popovers.md` regenerated; both tracks read them |
| PC-02 | closed | build-brief §5 and parity-rules "Check" point to `js-report/lib/test-utils/parity/` |

New in the re-run:

| id | state | finding |
|---|---|---|
| **PV-23** | **open (bip)** | In Track B, variance leaves with no data in either version (S FY2025: ADJ_1, ADJ_2, OOI_2, which have no `fact_pl` rows) are still evaluated as lines:<br>• The P&L T-P block in `tests/control-totals.dax` still expects the pre-decision values: `var.nm_codes` "ADJ_1 ADJ_2 ADJ_3 OOI_1 OOI_2 OOI_3" and `var.leaf_count` 35 / 38.<br>• bip reports those S-FY25 rows TRUE, so `LV Δ % Text` returns "n.m." on these lines and the matrix shows them.<br>Contract: hidden, with n.m. only on lines with data (S-FY25: "ADJ_3 OOI_1 OOI_3").<br>Fix: blank `LV Base` / `LV Comparison` / `LV Δ` / `LV Δ % Text` when both sides are blank or 0, then regenerate the T-P rows from the current CSV (the 8 `var.*` rows changed) |
| PV-24 | closed | Found by bip: Track B `_Profit GM Rate` summed lines of the other company; it is now per company (in the Group view each line counts in its own company). Track C was already per company; the contract values did not change |
| **PC-03** | **open (main agent)** | Decisions taken today are not in the contract: build-brief §4 still says "CC default … Display flyout still rules" (PV-02) and still lists the Channel / Line / Segment breakdown (PV-19); the §3 table text says the same. Second sighting today of the DEF-002 pattern (spec not edited after a decision) |

### 6.3 Remaining fixes per owner

**bip:**
1. PV-23: hide no-data leaves and show n.m. only on lines with data; regenerate the P&L T-P `var.*` rows from the current CSV.
2. PV-12: `LV Leaf Count` = lines shown after hiding (32 / 32 / 37 / 37), then flip the 4 rows.
3. Finish the P&L T-P full run (5 selections left) and report any FALSE row by metric id.

**nerd:** none open.

**fin:** not re-audited. The first-pass follow-ons still apply once bip's model is republished: status vs Budget, constant-currency Profitability, column GM % heatmap, MIX card, vs Compare B column, hidden no-data leaves. Then run the A side of both CSVs.

**main agent / USER:**
- PV-20: brief §0 header line.
- PC-03: brief §3 / §4 (always CC, Region only).
- MS-15: layout-spec "9.8k" → "9,796".
- MS-11: KPI row label, "vs PY" or "vs Prior year".

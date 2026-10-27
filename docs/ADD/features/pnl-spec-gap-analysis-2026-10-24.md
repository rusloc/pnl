DRAFT — projection state (analysis only, nothing implemented)

# Gap analysis: "P&L Report Spec — SaaS & Consumer Goods" vs ACME Unified P&L

> bip, 2026-10-24. Input: `docs/specs/2026-10-24-pnl-saas-consumer-goods-spec.md` (61 metric lines, 19 dimensions).
> Compared against: `docs/Requirements.md` (§3 spine, §5 KPIs, §7 calc rules, §8 data model, §11 out of scope), `data/acme_pl_dummy_data/` (CSV headers + dims), `docs/model/semantic-model.md`, `docs/model/measure-dictionary.md`, TMDL (`dim_pl_row`, `dim_kpi`, `dim_bridge_step`, `param_*`, `_measures`), `docs/ADD/features/pbi-report-layout.md`, ADR-0004, ADR-0007, ADR-0008, `docs/design/kpi-card-v2.md`, `docs/design/parity-rules.md`.
> Nothing in the report, model, data, tests or code was changed. Timings quoted are the ADR-0008 Desktop walls after the 2026-10-23 changes (statement ≈ 3.3 s, Key figures ≈ 4.1 s with slot 12 the slowest tile, Analysis ≈ 1.3 s, Profitability ≈ 2.4 s); every perf figure for a new item is an estimate, not a measurement.

Conventions: `GR` (01.) = `dim_pl_row[line_code]` and its `line_display` number. K-xx / F-xx / C-xx / M-xx = `docs/Requirements.md` IDs. Tile = Key figures card, `kpi_code` from `dim_kpi`. P = Consumer Products, S = Commerce Cloud, GROUP = ACME Group. Applies: S = SaaS (Commerce Cloud), C = consumer goods (Consumer Products), B = both.

Status rule: **Present** = same concept and arithmetic, visible in the report today. **Partial** = the concept exists under another definition, only as leaves without a line, only in one view without the spec's comparator, or as a proxy. **Missing** = not in the report (data may or may not exist).

## A. Coverage matrix — metrics

| # | Spec line | Applies | Status | Where it lives today | Notes |
|---|---|---|---|---|---|
| 1 | Gross revenue / gross sales | B | Present | `GR` (01. GROSS REVENUE, alias Gross sales / Gross billings, L-11); measure `Gross Revenue`; leaves GR_P1–P2, GR_S1–S4 | Budget / PY / LE via F-05..F-07. Slices: region, channel, category / service line, tier / segment; no customer |
| 2 | Trade spend & promotions | C | Partial | Leaves inside `GTN` (02.): GTN_P1, GTN_P2, GTN_P3, GTN_P5 (S: GTN_S1, GTN_S2) | No own subtotal; shares the block with returns. No brand / promo dimension |
| 3 | Returns & allowances | C | Partial | Leaf GTN_P4 Returns, damages & spoilage (S: GTN_S3 Refunds, SLA credits) inside `GTN` | Leaf only; markdowns / chargebacks not separate |
| 4 | Net revenue (NSV) | B | Present | `NR` (03.), `Net Revenue`, K-01 tile `NR`, Profitability `Prof Net Revenue` | Same arithmetic (GR + signed GTN). The chain gap is lines 2–3, not the total |
| 5 | Gross-to-net % | C | Present | K-04 P tile `GTN_PCT` / `KPI Gross-to-Net %` = −GTN ÷ GR (= 1 − NR ÷ GR) | KPI only, no statement ratio row (M-03 allows ratio rows ÷ NR only) |
| 6 | Subscription revenue | S | Present | Leaf GR_S1 Subscription platform fees; net of credits via service line `SUB` (F-10, Profitability by service line) | Leaf is gross of GTN_S1 / GTN_S2; the net figure exists only through the slice |
| 7 | Services / implementation revenue | S | Present | Leaf GR_S4 Professional services; service line `PS` | — |
| 8 | Usage / overage revenue | S | Partial | GR_S2 Payments & transaction fees (GMV-driven), GR_S3 Apps, partner revenue share & ads | Transaction / share-based, not labelled or modelled as metered usage |
| 9 | Recurring revenue mix % | S | Partial | Profitability, breakdown Category / service line: `Prof NR Share` of Platform subscriptions | No measure or tile; "recurring" = SUB only or SUB + APP is undefined |
| 10 | Ending ARR | S | Partial | K-04 S tile `ARR` / `KPI ARR` = NR of service line SUB in the last window month × 12 (K-23, T-17) | Run-rate proxy, not contract ARR; no cohort |
| 11 | ARR bridge (new / expansion / contraction / churn) | S | Missing | — | Needs an ARR snapshot with movement types (D-1) |
| 12 | Net revenue retention % | S | Missing | — | Requirements §11: out of scope v1; needs cohort / customer ARR (D-1) |
| 13 | Deferred revenue balance | S | Missing | — | Balance sheet out of scope (§11) |
| 14 | Billings | S | Missing | — | Needs line 13. Copy clash: `dim_account.block_alias_services` already labels GR "Gross billings" |
| 15 | Volume (units / cases) | C | Present | K-09 P tile `UNITS` / `KPI Units Sold`; `fact_operational.units_sold` | Units shipped; "net of returns" not modelled; customer = channel only |
| 16 | Net price per unit | C | Present | K-10 P tile `NR_PER_UNIT` / `KPI NR per Unit` | — |
| 17 | Price / volume / mix variance | C | Partial | Analysis bridge `an_bridge`, P steps Volume / Price / mix / FX (`Bridge Volume`, `Bridge Price Mix`, `Bridge FX`, C-40); K-11 `VOL_GROWTH`, K-12 `PRICE_MIX` | Price and mix are one step; comparison = Compare A, else B, else PY (parity rule 1) |
| 18 | COGS — materials | C | Partial | Leaves COR_P1 Raw materials & packaging, COR_P2 Sourced finished goods, COR_P7 Inventory write-downs, in `COR` (04.) | No subtotal, no standard cost × units, no PPV, no plant |
| 19 | COGS — manufacturing & conversion | C | Partial | Leaves COR_P3 Direct labour, COR_P4 Manufacturing overhead (ex-depreciation) | No subtotal, no plant / yield |
| 20 | COGS — logistics & warehousing | C | Partial | Inbound: COR_P5 (with duties & tariffs) in `COR`. Outbound / 3PL: VSC_P1, VSC_P2 in `VSC` (07.) below gross profit | Deliberate (Requirements §11 research basis: distribution moved below GP). The input spec lists freight out in both line 20 and line 29 |
| 21 | Cost of revenue — hosting & infrastructure | S | Present | COR_S1 Cloud hosting & infrastructure (+ COR_S3 Third-party software, data & partner payouts) | AI inference not separate |
| 22 | Cost of revenue — support & success | S | Present | COR_S4 Customer support & merchant onboarding | — |
| 23 | Cost of revenue — services delivery | S | Present | COR_S5 Professional services delivery | — |
| 24 | Total COGS | B | Present | `COR` (04. COST OF REVENUE, alias Cost of goods sold) | C perimeter excludes outbound logistics (line 20); S also holds COR_S2 Payment processing (not in spec 21–23) |
| 25 | Gross profit | B | Present | `GP` (05.), `Gross Profit` | = NR + COR; differs from the spec only by the line-20 perimeter |
| 26 | Gross margin % | B | Present | `GM_PCT` (06.) ratio row with Δ pp (M-11); K-03 tile `GM_PCT`; Profitability GM % | — |
| 27 | Subscription gross margin % | S | Partial | K-11 S tile `SUB_GM_PCT` / `KPI Subscription GM %` = GP ÷ NR of service line SUB | Ours: every COR line booked to SUB; spec: hosting + support only. No Target comparator |
| 28 | Services gross margin % | S | Partial | Profitability by service line, row Professional services, GM % column | No tile / measure of its own; no Target |
| 29 | Contribution margin (after variable selling) | C | Present | `CM` (08.) + `CM_PCT` (09.); K-06 tile; Profitability CM %; chart `cm_bars` | Ours = GP + VSC (freight out, 3PL, marketplace fees, commissions); trade spend is above NR (spec lists it here again) |
| 30 | Margin per unit | C | Missing | — | Data present: GP ÷ `units_sold` (package P1) |
| 31 | Sales & marketing | B | Present | `SM` (11.), leaves SM_P1–P4 / SM_S1–S4; cost centres P-MKT, S-GTM | No campaign; one cost centre per function and entity |
| 32 | Research & development | B | Present | `RD` (12.) incl. RD_S3 Capitalised development costs (credit) | Matches, incl. the capitalised-dev offset |
| 33 | General & administrative | B | Present | `GA` (13.), GA_1–GA_4 | — |
| 34 | Headcount cost | B | Missing | — | Data proxy: `bridge_account_nature` nature N2 Employee benefits (weights); by-nature display dropped by ADR-0007 §2.2. No stock-comp account |
| 35 | Total OpEx | B | Partial | `OPEX` (10.) group total = SM + RD + GA + OOI | Includes other operating income / (expense) (8d); spec = 31–33 only |
| 36 | OpEx % of revenue (S&M, R&D, G&A) | B | Partial | Statement `PL % NR` column (M-12) on the SM / RD / GA rows | Base column only: no Δ pp vs Compare A / B, no benchmark |
| 37 | A&P % of net revenue | C | Present | K-05 P tile `AP_PCT` / `KPI A&P % NR` = −(SM_P1 + SM_P2) ÷ NR | Better when Neutral (spec: context) |
| 38 | EBITDA | B | Partial | Only `EBITDA` (15. ADJUSTED EBITDA, MPM) | No reported (unadjusted) EBITDA |
| 39 | EBITDA margin % | B | Partial | `EBITDA_PCT` (16.); K-07 sub-line "Margin" | Adjusted basis only |
| 40 | Adjusted EBITDA | B | Present | `EBITDA` (15.), `Adjusted EBITDA`, K-07 tile, Profitability Adj. EBITDA % | Excludes the ADJ block (restructuring, impairment, M&A); no SBC add-back (no SBC data) |
| 41 | Depreciation & amortisation | B | Present | `DA` (17.), DA_P1–P3, DA_S1–S3 | — |
| 42 | EBIT / operating income | B | Present | `OP` (20. OPERATING PROFIT, IFRS 18) + `OP_PCT` (21.); memo `UOP` (18.); K-08 tile | OP = Adj. EBITDA + DA + ADJ = reported EBITDA − D&A |
| 43 | Interest, FX & other | B | Present | `INV` (22.), `PBFIT` (23.), `FIN` (24.) | Split by IFRS 18 category; operating FX is OOI_1 above OP |
| 44 | Tax | B | Present | `TAX` (26.) + `ETR_PCT` (27.); K-12 GROUP tile `ETR` | — |
| 45 | Net income | B | Present | `NP` (28.), K-11 GROUP tile `NP` | — |
| 46 | Net margin % | B | Present | `NP_PCT` (29.); `KPI Net Margin` (NP tile sub-line) | — |
| 47 | CAC | S | Missing | — | No gross new-customer count; `active_merchants_end` is a stock (net adds only). §11 out of scope |
| 48 | CAC payback (months) | S | Missing | — | §11 out of scope; needs 47 + new ARR |
| 49 | Magic number | S | Missing | — | Proxy possible on run-rate ARR (package P6) |
| 50 | Rule of 40 | S | Partial | K-12 S tile `RULE40` = organic NR growth % + Adj. EBITDA margin % | Spec: ARR growth % + EBITDA margin % |
| 51 | Burn multiple | S | Missing | — | Needs cash flow (§11); Commerce Cloud is profitable in the data, so the ratio has no meaning |
| 52 | Revenue per FTE | B | Missing | — | No headcount data |
| 53 | Variance vs budget (abs, %) | B | Present | Compare A default Budget: `PL Compare A`, `PL Δ A`, `PL Δ A %` (M-10); KPI comparison rows (K-20); `PL FY Budget` | Signed-value rule = favourable on every line (M-10, T-13) |
| 54 | Variance vs PY (abs, %) | B | Present | Compare B default Prior year: `PL Δ B`, `PL Δ B %` (C-04) | — |
| 55 | Variance vs forecast / latest estimate | B | Partial | LE selectable as Compare A / B; `PL Δ LE vs Budget` (M-14) | LE = Actual on closed months, so Actual vs LE is zero there; a forecast cycle (FC2606) is not selectable (§11) |
| 56 | Full-year outlook | B | Present | `PL FY LE`, `PL FY Budget`, `PL Δ LE vs Budget` (M-14) | LE = actual closed months + latest forecast (C-02) |
| 57 | MTD / QTD / YTD / R12M | B | Present | F-04 time view (Month, QTD, YTD, LTM, Full year) via `_Win Start` / `_Win End` | Slicer-driven, not a calculation group (deliberate, perf) |
| 58 | Run-rate (annualised) | B | Partial | Only `KPI ARR` (subscription NR × 12) | No generic run-rate for NR or other lines |
| 59 | Growth MoM / QoQ / YoY % | B | Partial | YoY: Compare B = PY with Δ % (statement, tiles), K-02 organic growth, `Prof NR Δ %` | No sequential (prior month / quarter) comparison |
| 60 | Constant-currency revenue / EBITDA | B | Partial | F-13 FX basis = Constant currency (C-12): every line at the selected FY's budget rates | A report-wide toggle, never side by side with reported; no PY-rate basis |
| 61 | FX impact | B | Partial | Bridge FX step (`Bridge FX`, C-40, NR only); K-02 sub-line "Reported" vs organic | Not per line, not for EBITDA |

**Totals:** Present 29 · Partial 21 · Missing 11.

Spec inconsistencies found while mapping (affect the matrix, not our model): freight out is in COGS (line 20) and in variable selling (line 29); trade spend is a revenue deduction (line 2) and a variable selling cost (line 29); "Total OpEx" (35) excludes other operating items that line 38 then needs. Our spine (Requirements §3) is internally consistent and is kept as the reference.

## B. Coverage matrix — dimensions

| # | Spec dimension | Status | Our equivalent (table / column) | Gaps |
|---|---|---|---|---|
| 1 | Account (P&L line) | Partial | `dim_account` (73 leaves: `block_code`, `spine_step`, `sort_order`, `natural_sign`, `ifrs18_category`, `is_direct`, `is_below_cm`, `is_intercompany`); `dim_report_line` (29 lines: `row_type`, `formula`, `tag`, `is_key`); `dim_pl_row` (calculated, statement rows) | Two levels (line → account) + IFRS 18 category; no Sub-line level; no Is cash, Is add-back, Variable / Fixed flags; no `Favourable when` (sign rule M-10 makes it unnecessary) |
| 2 | Scenario | Partial | `dim_version` (ACT, BUD, FC2606, FC2609; `forecast_cycle`, `is_latest_forecast`); LE and PY derived in `_Amt Window`; `param_version_choice` | No Stretch, no Is locked, no version date beyond `forecast_cycle`; forecast cycles not selectable (§11) |
| 3 | Date (fiscal) | Partial | `dim_month` (month grain: `fiscal_year`, `quarter`, `month_number`, `month_index`, `is_closed`) | No day / week / half, no 4-4-5, no working days. Month grain is enough for this P&L |
| 4 | Legal entity | Partial | `dim_entity` (P, S; `consolidation_group`) + `param_entity_view` (GROUP); eliminations via `fact_pl_elim` and accounts ELIM_GR / ELIM_VSC / OOI_4 | Eliminations are pseudo-accounts, not a pseudo-entity (ADR-0008 rejected b1); functional currency sits on region; no country / consolidation method |
| 5 | Cost centre / department | Partial | `dim_cost_centre` (19 rows, `function`); `fact_pl.cost_centre_code` | 1 cost centre per function and entity (adds no information over the block); no department / manager; not shown in the report (drill-through M-27 deferred) |
| 6 | Product | Partial | `dim_line` (P category ×5, S service line ×4) + `dim_segment` (P price tier ×3) | No brand / SKU / plan / tier, no billing frequency, no Is recurring (§11: brand, SKU, plan tier out of scope) |
| 7 | Customer / account | Partial | `dim_segment` for S (Small business, Mid-market, Enterprise) | No customer key, no industry, no key account / banner / store for P (§11) |
| 8 | Channel / route to market | Present | `dim_channel` (P: 5 channels; S: 3 sales motions) | S has no Marketplace motion; values differ from the spec's examples |
| 9 | Geography / market | Partial | `dim_region` (4 regions, `functional_currency`) | No country / state, no ship-to vs bill-to |
| 10 | Currency | Present | `param_reporting_currency` (USD, EUR, GBP, symbol); `fact_fx_rate` (ACTUAL_AVG monthly, BUDGET per FY); `param_fx_basis` | No PY rate type (derivable from ACTUAL_AVG shifted 12); switch by measures, not a calc group (deliberate) |
| 11 | Customer cohort | Missing | — | Needs first-contract date per customer (D-1) |
| 12 | ARR movement type | Missing | — | Needs ARR snapshot (D-1) |
| 13 | Promotion / trade event | Missing | — | No TPM data (D-8) |
| 14 | Plant / site / 3PL | Missing | — | No site on COR rows (D-9) |
| 15 | Cost nature | Partial | `dim_nature` (9) + `bridge_account_nature` (weights; N2 = employee benefits); variable = `VSC` block; one-off = `ADJ` block; non-cash = `DA` | No explicit Variable / Fixed, Cash / Non-cash, Recurring / One-off flags; display of natures dropped (ADR-0007 §2.2) |
| 16 | Headcount / employee | Missing | — | No FTE data (D-5) |
| 17 | Comparison selector | Present | `param_compare_a`, `param_compare_b` (Budget, LE, PY, None), `param_base_version` | Ours has two selectors (superset of the spec's one) |
| 18 | Display unit & currency | Partial | `param_units` (M, K), `param_reporting_currency`, `param_fx_basis` (actual / constant) | No "local currency" view; implemented by measures + `_Units Divisor`, not a calc group with dynamic format strings (trailing-comma scaling is not supported; CLAUDE.md) |
| 19 | Period mode | Present | `param_time_view` (Month, QTD, YTD, LTM, Full year) + FY outlook columns (M-14) | FY outlook is a permanent column group, not a mode |

**Totals:** Present 4 · Partial 10 · Missing 5.

## C. Plan — implementable NOW (data available)

All packages use only existing tables / columns. Track impact: **B** = model + report (bip; a CSV / param change in the lakehouse is ginee's load), **A** = Rayfin app (fin), **C** = JS engine (Track C has only the statement view; anything else is a `.sync/` spec note for the vosk.dev agent). Track A picks up new `dim_kpi` codes, `KPI Secondary` text, `dim_pl_row` rows and `dim_bridge_step` rows through its existing queries (`buildKpiMetaQuery`, `kpiAliases().secondary`, `buildStatementQuery`, `buildBridgeQuery`), so most A effort is verification and parity rows.

| ID | Spec lines | What to build | Exact columns used | Tracks | Effort | Risks |
|---|---|---|---|---|---|---|
| P1 | 2, 3, 9, 28, 30, 58 | **Tile sub-lines, no new tiles.** Extend `KPI Secondary` (today only ORG_GROWTH, EBITDA, OP, NP): P `GTN_PCT` → "Trade x% - returns y% of gross" (2, 3); P `NR_PER_UNIT` → "GP per unit $x.xx" (30); S `ARR` → "x% of NR recurring" (9); S `SUB_GM_PCT` → "Services GM x%" (28); `NR` (all) → "Run-rate $x m" (58, last window month × 12, same re-anchoring as `KPI ARR`). Helper measures in `3 KPIs\Items` | `fact_pl` / `fact_pl_allocated` `amount_usd/eur/gbp` on GTN_P1–P5, GR_*, COR_*; `fact_operational.units_sold`; `dim_line[line_code]` SUB, PS; `param_fiscal_year`, `param_period`, `param_time_view` (re-anchor) | B: 5 measures + `KPI Secondary` branches + tests. A: verify sub-line rendering, parity rows. C: spec note | B 0.75 d · A 0.25 d · C 0.1 d | Each sub-line runs in its tile's own query, pruned by the literal `kpi_code` filter (+0.1–0.4 s per tile, est.). Keep slot 12 (`PRICE_MIX` / `RULE40` / `ETR`, the slowest query) untouched. kpi-card-v2 says "sub-line where it exists today": doc amendment, not ADR. Sub-line width ≈ 40 chars at 12 px |
| P2 | 36, 38, 39 (+ 35 as doc note) | **Statement memo block at the bottom** (rows 30+, after `29. NET MARGIN %`, so 01–29 keep their numbers and parity rule 11 holds): `EBITDA (reported)` (Mgmt) = Adj. EBITDA + ADJ_1 + ADJ_3 (default, Q3); `EBITDA margin %`; `S&M % of NR`, `R&D % of NR`, `G&A % of NR` as ratio rows with Δ pp. Engine: `_Amt Row` sums "every block above" for subtotals, which cannot express a bottom memo; add precomputed `block_list` / `account_list` columns to calculated `dim_pl_row` and one filter branch `CONTAINSSTRING` in `_Amt Row` | `dim_report_line` new rows + a new `row_type` (e.g. `memo_formula`); operands `EBITDA`, `ADJ_1`, `ADJ_3`, `SM`, `RD`, `GA`, `NR` | B: `dim_pl_row` columns, `_Amt Row`, `PL Fav Off`-style rule for cost ratios, tests (552 control totals + new rows). ginee: `dim_report_line` CSV + loader column. A: verify statement + client-side Δ for the new row type. C: `spine.ts` grammar (account operands, new row type) + Zod manifest | B 1.5 d · ginee 0.25 d · A 0.25 d · C 0.75 d | +5 rows ≈ +5 × ~19 engine evals → statement +0.3–0.6 s (est., from 3.3 s; stays ≤ 5 s). Cost ratios signed negative (M-01) so Δ > 0 stays favourable. M-03 holds (all ÷ NR). Changes the line structure contract (§3, D-11, D-32): **ADR**. Track C data contract changes |
| P3 | 17 | **Split Price / mix into Price and Mix** (P bridge): `dim_bridge_step` P rows START, VOL, MIX, PRICE, FX. Pure volume = (U_b − U_c) × NRcc_c ÷ U_c at entity total; Mix = Σ_k Volume_k (existing `Bridge Volume`) − pure volume; Price = existing `Bridge Price Mix` − Mix. K-12 `PRICE_MIX` unchanged | `fact_operational.units_sold`; NR cc via `amount_local` × FY BUDGET factor (`fact_fx_rate.local_per_usd`, as `Bridge Volume`); slice keys `region_code`, `channel_code`, `line_code`, `segment_code` | B: 2 measures, `_Bridge Value` branch, `dim_bridge_step` row, T-05 re-run (21 scenarios). A: verify (bridge query is row-driven), info pop-up copy. C: engine later (bridge not built) | B 1 d · A 0.25 d · C 0.5 d (later) | Analysis 1.3 s now; +2 scalar evals (≈ +0.2 s est.). Changes C-40 wording and `info-popovers.md` copy (all tracks): spec edit, ADR-light. Units summed across categories: standard for mix, but say so in the info pop-up |
| P4 | 61 (part of 60) | **FX impact per variance**: column "of which FX" in Largest variances (`an_variances`): `LV FX` = (base − base cc) − (comparison − comparison cc), same as `Bridge FX` per leaf; T-10 extends naturally (zero at constant currency) | `amount_usd/eur/gbp` and `amount_local` × BUDGET factor on the leaf account; `param_fx_basis[fx_basis_name]` | B: 1 measure + 1 column + test. A: drivers query + column. C: n/a (view not built) | B 0.5 d · A 0.5 d | A second FX-basis path in one query costs 0.4–1 s of plan (ADR-0008 §5); Analysis has the headroom (1.3 → ≈ 2.3 s est.). Table width at 1440 px: drop Δ % or narrow Block |
| P5 | 59 | **Prior-period comparison**: add "Prior period" to Compare A / B = Actual over the window shifted back by its own length (Month −1, QTD −3, LTM −12); YTD / Full year → n/a with a notice | `param_version_choice` +1 row (CSV, ginee); `_Amt Window` (version, month) TREATAS; `dim_month[month_index]` | B: `_Amt Window`, names, notices, tests. ginee: param CSV. A: version picker + names. C: `versions.ts` | B 0.75 d · ginee 0.25 d · A 0.5 d · C 0.5 d | Negligible perf (same single TREATAS). Changes F-06 / F-07 values and C-03 / C-04 semantics; KPI card rows read "vs Prior period": spec edit in all tracks |
| P6 | 49, 50 (proxy) | **SaaS ratios on run-rate ARR**: ARR growth % = `KPI ARR` at anchor ÷ at anchor − 12 − 1; Rule of 40 per spec = ARR growth + Adj. EBITDA margin; Magic number proxy = (ARR end of quarter − ARR end of prior quarter) ÷ S&M of the prior quarter | NR of `dim_line` SUB, `SM` block amounts, `dim_month[month_index]` re-anchoring | B: 2–3 measures; a tile only by replacing a slot (E). A: verify | B 0.75 d · A 0.25 d | Labels a proxy as ARR (Q5). Rule of 40 sits in slot 12 (the slowest tile); ARR growth = 2 month-grain evals, likely cheaper than organic growth at CC, must be measured. Recommend waiting for D-1 for magic number |
| P7 | 55 | Actual vs a named forecast cycle (FC2606) as a comparison | `dim_version` FC2606 (Jul–Dec 2026), `param_version_choice` | B, ginee, A, C | ≈ 1.5 d total | Only Jul–Sep 2026 overlaps Actual; §11 lists cycle comparison as out of scope. **Recommend skip** |
| P8 | 34 | People cost memo (employee benefits) = Σ account amount × `weight` for nature N2 | `bridge_account_nature.account_code`, `nature_code`, `weight`; amounts by account | B only (Track A / C later) | B 0.75 d | Weighted sum needs a grouped pass over accounts inside the measure (not a TREATAS filter) → +0.3–0.8 s where shown (est.). Reverses ADR-0007 §2.2 ("no track reads it for display"): **ADR amendment**. **Recommend after D-5** |
| P9 | 60 | Constant currency at PY rates (second CC basis) | `fact_fx_rate` ACTUAL_AVG of month − 12 | B, ginee (param row), A, C | ≈ 2 d total | Brings back a month × currency translation iterator that ADR-0008 removed. **Recommend skip** |
| — | 20, 24, 25, 35 | Documentation only: state in `docs/model/semantic-model.md` / measure dictionary that GP excludes outbound logistics and OPEX includes OOI, with the spec line numbers | — | B docs | 0.1 d | None |

Ranking (value ÷ effort): P1 → P3 → P4 → P2 → P5. P6 only if the USER accepts the run-rate proxy (Q5, Q6). P7, P9 skip; P8 after D-5.

## D. Plan — NOT implementable now (data missing)

| ID | Unlocks (spec lines / dims) | Missing data | Smallest synthetic addition | IFRS 18 spine / ADR conflict | Worth it for the showcase |
|---|---|---|---|---|---|
| D-1 | 10, 11, 12, 47, 48, 49, 50; dims 11, 12 | Contract ARR per customer and month; gross new / churned customers | `fact_arr_snapshot`: S only, `month_key` × `version_key` (ACT, BUD) × `region_code` × `segment_code` × `cohort_month_key` × `movement_type` (NEW, EXPANSION, CONTRACTION, CHURN, REACTIVATION, FX) → `arr_local`, `currency_code`, `customers` (count delta). No customer key needed (cohort grain). ≈ 4 regions × 3 segments × 648 (cohort, month) pairs × 6 movements ≈ 47k rows per version (≈ 93k for ACT + BUD). Generator rule: closing ARR per month ≈ NR of service line SUB × 12 so it ties to the P&L. Cohort dim derived from `dim_month` | None with the spine (memo KPIs, no P&L line). Requirements §11 lists NRR / churn / CAC payback as out of scope: scope change + new fact D-05 → **ADR**. New relationships: entity, month, version, region, segment | **High** — ARR bridge and NRR are the signature SaaS visuals; ≈ 1 d generator + 0.5 d ginee load + 1.5 d B + A / C later |
| D-5 | 52; dim 16; better 34 | FTE by function | `fact_headcount`: `entity_code` × `month_key` × `version_key` (ACT, BUD) × `cost_centre_code` → `fte_end`, `fte_avg`. ≈ 19 × 36 × 2 ≈ 1.4k rows. Optional cross-check: N2 people cost ÷ FTE plausible | None (memo). New fact → ADR (or fold into the D-1 ADR) | Medium — revenue per FTE is a common CFO tile; cheap |
| D-6 | dim 15; 29 alternative, 38, 40 definitions; cash / non-cash | Explicit cost-nature flags | 4 columns on `dim_account` (73 rows): `cost_behaviour` (VARIABLE / FIXED), `is_cash` (FALSE for DA_*, ADJ_2, RD_S3), `is_one_off` (ADJ_*), `is_ebitda_addback` (ADJ_1, ADJ_3). No fact change | None; D-10 gains columns. Replaces literal account lists in P2 / P1 measures by data | Medium — makes definitions data-driven (N-11 spirit); 0.25 d data + 0.25 d B |
| D-7 | 34, 40 | Share-based compensation | Carve SBC out of existing leaves: new accounts `SM_SBC`, `RD_SBC`, `GA_SBC` (or one shared `GA_5`) with fact rows = a share of SM_P4 / SM_S3 / RD_* / GA_1 (sum unchanged per block) + `is_ebitda_addback` | Changes the Adjusted EBITDA definition (an IFRS 18 MPM) and every control total that includes the block leaves → regenerate `control_totals_usd.csv`, re-pass T-06 in A, B, C: **ADR** | Low–medium — realistic for SaaS, but touches every track's reconciliation |
| D-3 | 13, 14 | Deferred revenue balance | `fact_balance`: S × `month_key` × `version_key` × `region_code` × account `DEFREV` → closing `amount_local`. ≈ 4 × 36 × 2 ≈ 300 rows. Billings = revenue + Δ balance | Balance sheet out of scope (§11); semi-additive measure; not on the IFRS 18 P&L face (memo only) → ADR if added | Low — one tile's worth, explanation-heavy for non-finance visitors |
| D-8 | 2 (by promo), dim 13 | Promotion events | `dim_promo` + `promo_code` on GTN_P1–P3 rows of `fact_pl` | Multiplies `fact_pl` grain (D-01) and allocation; perf risk on ADR-0008 | Not worth |
| D-9 | 18, 19 (by plant), dim 14 | Plant / site, standard cost, PPV | `dim_site` + `site_code` on COR_P* rows; PPV account | Changes D-01 grain; new leaf in `COR` changes control totals | Not worth |
| D-10 | dims 6, 7, 9 (SKU, customer, country) | Brand / SKU, key account, country | New slice keys on every fact | §11 out of scope; fact size × n; F-09..F-11 slot design | Not worth |
| D-11 | dim 2 | Stretch version, Is locked, version date | `dim_version` columns `is_locked`, `version_date`; a Stretch version = BUD × factor rows | Stretch adds ~25 % fact rows and a 5th version choice | Low (columns only: trivial; Stretch: not worth) |
| D-12 | 36, 47–50 ("Target", "Benchmark") | KPI targets | `param_kpi_target` (`kpi_code`, `entity_code`, `fiscal_year`, `target`) ≈ 75 rows | KPI card v2 has exactly two comparison rows (Compare A / B); a third reference needs a kpi-card-v2 / ADR-0007 amendment | Low |
| D-13 | 51 | Cash flow | Cash flow statement | §11 out of scope; meaningless for a profitable entity | Not worth |

Top data gaps by showcase value: D-1 ARR snapshot, D-5 headcount, D-6 cost-nature flags, D-7 SBC, D-3 deferred revenue.

## E. Layout attribution (keep the 4 views)

| New / upgraded metric (#) | View | Element | Replaces / adds |
|---|---|---|---|
| Trade spend, returns (2, 3) | Key figures | P `GTN_PCT` tile sub-line | Adds sub-line (P1) |
| Recurring revenue mix (9) | Key figures | S `ARR` tile sub-line | Adds sub-line (P1) |
| Services GM % (28) | Key figures | S `SUB_GM_PCT` tile sub-line | Adds sub-line (P1); Profitability row stays |
| Margin per unit (30) | Key figures | P `NR_PER_UNIT` tile sub-line | Adds sub-line (P1) |
| Run-rate (58) | Key figures | `NR` tile sub-line (all companies) | Adds sub-line (P1) |
| Reported EBITDA, margin (38, 39) | Statement | Memo rows 30–31 | Adds memo rows (P2, ADR) |
| S&M / R&D / G&A % of NR (36) | Statement | Ratio rows 32–34 in the memo block | Adds ratio rows with Δ pp (P2) |
| Price / volume / mix (17) | Analysis | Bridge step Mix (P) | Splits Price / mix into Price + Mix (P3) |
| FX impact (61) | Analysis | Largest variances column "of which FX" | Adds a column (P4) |
| Sequential growth (59) | All views | Compare A / B option "Prior period" | Adds a version choice (P5) |
| ARR growth, Rule of 40 per spec (50) | Key figures | S slot 12 `RULE40` | Redefines the tile (P6, Q6) |
| Ending ARR contract (10) | Key figures | S slot 4 `ARR` | Same slot, new source (D-1) |
| NRR (12) | Key figures | S slot 10 (Active merchants moves to the ARR tile sub-line) | Replaces a tile (D-1; kpi-card-v2 / ADR-0007 amendment) |
| ARR bridge (11) | Analysis | S bridge card: NR bridge stays (T-05); ARR bridge needs a second bridge or a "Bridge of: NR / ARR" switch shown for S only | **ADR** (L-10: no zone differs by entity) |
| CAC, CAC payback, magic number (47–49) | Key figures | Sub-lines of S tiles (`RULE40`, `ARR`) | After D-1 |
| Revenue per FTE (52) | Key figures | Sub-line of the `EBITDA` tile or a GROUP slot | After D-5 |
| Headcount cost (34) | Statement | Memo row "of which people cost" | After D-5 (P8; ADR-0007 amendment) |

A 13th tile is not justified: the 3 × 4 grid fills the 1440 × 810 view (ADR-0004), a 4th row would shrink every tile below kpi-card-v2's anatomy, and slot replacements cover the D-1 needs.

**Statement table (end state).** Unchanged 19-step IFRS 18 spine, rows 01–29 with their numbers, Variance layout only, collapsed by default with Expand all / Collapse all (ADR-0007). A memo block after `29. NET MARGIN %`: `30. EBITDA (REPORTED)`, `31. EBITDA MARGIN %`, `32. S&M % OF NR`, `33. R&D % OF NR`, `34. G&A % OF NR` (later `of which people cost`). Memo rows have no children, so the expansion bookmarks are unaffected; tags Mgmt; cost ratios signed (M-01) so Δ colours stay correct. Needs an ADR because it changes §3 / D-11 / D-32 and the Track C data contract.

**Key figures (end state).** Same 12 slots and kpi-card-v2 cards. New information enters through the sub-line under the value (P1), which today is used only by organic growth and the three margin tiles. After D-1: S slot 4 becomes contract ARR, S slot 10 NRR (merchants move to a sub-line), S slot 12 Rule of 40 on ARR growth. Slot 12 stays the perf watch point (ADR-0008). Any slot swap amends kpi-card-v2 / K-04..K-12 (spec edit; ADR-0007 amendment).

**Analysis (end state).** Two cards as today. Bridge: P gets a Mix step (comparison + steps = base, T-05). Largest variances: an "of which FX" column. The ARR bridge (D-1) is the only item that does not fit without an entity-specific element; it needs an ADR (L-10) or stays out.

**Profitability (end state).** No change. Services GM % (28) and recurring mix (9) are already readable as service-line rows. A "per unit" column (margin per unit, 30) would be blank for S and GROUP, which breaks the same-columns rule (L-10); keep it on the tile.

**ADR-worthy:** (1) statement memo block + new `row_type` (P2); (2) ARR snapshot fact and the §11 scope change (D-1), incl. NRR / ARR bridge placement; (3) any change of the Adjusted EBITDA definition (SBC add-back, D-7); (4) reading natures for display (P8, amends ADR-0007 §2.2). Spec edits without a full ADR: C-40 Price / Mix split (P3), Prior period comparison (P5), tile sub-lines (kpi-card-v2 note, P1).

## F. Open questions for the USER

| # | Question | Recommended default |
|---|---|---|
| Q1 | Is the new spec a target to converge to, or a checklist against our IFRS 18 spine? | Checklist: Requirements §3 stays the contract; only additive memo rows, sub-lines and bridge steps |
| Q2 | Logistics: keep outbound freight and 3PL in variable selling (below GP), as Requirements §11 decided? | Keep; document lines 20 / 24 / 25 as a definitional difference |
| Q3 | Reported EBITDA definition? | Adjusted EBITDA + restructuring (ADJ_1) + M&A one-offs (ADJ_3); impairment (ADJ_2) stays with D&A |
| Q4 | Accept a memo block at the bottom of the statement (rows 30+)? | Yes, via an ADR; rows: reported EBITDA, its margin, S&M / R&D / G&A % of NR |
| Q5 | ARR: keep the run-rate proxy (SUB NR × 12) and its label "ARR (period end)"? | Keep until D-1; the tooltip already states the formula |
| Q6 | Rule of 40: organic NR growth (ours) or ARR growth (spec)? | Keep organic growth until D-1 exists |
| Q7 | Split the bridge's Price / mix into Price and Mix for Consumer Products? | Yes (P3); K-12 tile stays "Price / mix" |
| Q8 | Add a "Prior period" comparison (MoM / QoQ)? | No for now: YTD has no clean prior period and it touches three tracks |
| Q9 | Which synthetic data additions? | D-1 ARR snapshot only; D-5 headcount optional; none for promo, plant, SKU, customer, cash flow |
| Q10 | Track C scope for these items? | Spec note in `.sync/` only; Track C builds them when its Key figures / Analysis views exist |

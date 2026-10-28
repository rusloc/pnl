# Semantic model — ACME Unified P&L (Track B)

> Draft, 2026-10-21 (bip); ADR-0008 physical speed-ups 2026-10-23. Service copy in RAW (dev, Track A's source) republished from this TMDL on 2026-10-28 (ginee): 44 tables, 253 measures, full refresh 42.9 s, all DAX tests green on the service (ADR-0008 §5.2). Source: `pbi-report/ACME Unified PnL/ACME Unified PnL.SemanticModel/` (TMDL). Spec: `docs/Requirements.md` §7–§8; data rules: `data/acme_pl_dummy_data/README.md`; data layer: ADR-0003. Measures: `docs/model/measure-dictionary.md`.

## Storage mode and source

- **Import** from the `lh_raw` SQL analytics endpoint (workspace RAW, schema `acme_pl`), connector `Sql.Database`. Rationale: simplest path for a Desktop draft (about 1.2 M fact rows, a few MB compressed), no service-side model needed while drafting.
- **Direct Lake is not decided here.** The tables are single-file Delta tables inside every guardrail (ADR-0003), so Direct Lake stays an option; storage mode, partitions and refresh are ginee's call (physical layer).
- **Power Query parameters** (CLAUDE.md runtime hook for Track B): `SqlEndpoint` (SQL endpoint host of `lh_raw`, not a credential) and `Database` = `lh_raw`. Every table query starts with `Sql.Database(SqlEndpoint, Database)` and navigates to `acme_pl.<table>`; navigation and the type step fold. No credentials are stored in files: Desktop asks for them on first refresh (Microsoft account / Entra ID).
- Types: local amounts (`amount_local`, `gmv_local`) are **Fixed Decimal** (`Currency.Type`, decimal(18,2) at source, exact cents); `local_per_usd` and the pre-translated amounts (`amount_usd` / `amount_eur` / `amount_gbp`, `gmv_usd` / `gmv_eur` / `gmv_gbp`, decimal(18,6) at source) are **Decimal Number (double)**, never Fixed Decimal (4 dp would fail 43 of the 552 control totals; ADR-0008 §4.1).
- Partitions read an explicit column list (`Table.SelectColumns`, ADR-0008), so a new lakehouse column never reaches the model unannounced. Partitions, Power Query and refresh are ginee's (physical layer).

## Tables

> 2026-10-27: `dim_kpi` gained `vitals_slot`, `vitals_tier`, `in_key_figures` and the rows `OPEX_PCT`, `MIX`, `FY_OUTLOOK` (43 rows); `dim_bridge_step` gained `CC_SUB` (constant-currency NR) and `END` (actual NR) per entity. The new v4 tables are disconnected (no relationships); measures read them with `SELECTEDVALUE` / `TREATAS`.

| Kind | Tables | Notes |
|---|---|---|
| Facts (hidden) | `fact_pl`, `fact_pl_allocated`, `fact_operational`, `fact_pl_elim`, `fact_fx_rate` | Direct accounts read from `fact_pl`, below-CM accounts from `fact_pl_allocated`; `_UNASSIGNED` rows are never added to allocated (data README). The three facts carry the loader's pre-translated amounts next to the local ones (ADR-0008 (a): each row at its version's own rate type, ACTUAL_AVG for actual and forecast, BUDGET for budget). `fact_pl_elim` (ADR-0008 (b), 5,304 rows) = every `fact_pl` row with a counterparty, negated, on its block's elimination account (`ELIM_GR`, `ELIM_VSC`); same 15 columns as `fact_pl`; only `_Elim Amount` reads it. `fact_fx_rate` is disconnected; only constant currency still looks it up (one BUDGET rate per currency and fiscal year). |
| Dimensions | `dim_account`, `dim_entity`, `dim_month`, `dim_version`, `dim_region`, `dim_channel`, `dim_line`, `dim_segment`, `dim_cost_centre`, `dim_nature`, `bridge_account_nature`, `dim_report_line` | Spec §8 names. `dim_report_line` is not joined to facts (D-11). Natures and cost centres are loaded for the deferred by-nature lens and drill-through. |
| Parameters from the lakehouse | `param_reporting_currency`, `param_fx_basis`, `param_units`, `param_time_view`, `param_version_choice` (hidden source) | Disconnected (D-21). `param_layout`, `param_cost_lens`, `param_detail_level`, `param_cost_sign`, `param_variance_format`, `param_breakdown` are not loaded yet: their features are deferred. |
| Check table (hidden) | `control_totals_usd` | Expected values for the DAX tests only (T-06). |
| Calculated, logical layer | `param_entity_view`, `param_fiscal_year`, `param_period`, `param_base_version`, `param_compare_a`, `param_compare_b`, `param_breakdown_field` (field parameter), `dim_pl_row`, `dim_kpi`, `dim_bridge_step`, `param_metric` + `param_eval` (hidden engine switches), `_meta_refresh`, `dim_filter_row`, `_measures`; redesign v4 (2026-10-27): `dim_profit_step`, `dim_conc_level`, `dim_pl_info`, `param_var_cut` (field parameter) + `var_cut_total`, `param_kpi_threshold` (hidden) | `dim_pl_row` = one row per report line plus one per leaf account under its block; the statement matrix uses it. Its report-only column `line_display` (2026-10-22) labels the matrix's top level with the line's number in display order and the name in capitals (`01. GROSS REVENUE` … `29. NET MARGIN %`, ratio rows included; leaves carry their line's label); `line_label` stays the plain name Track A reads. `dim_filter_row` = the ten rows of the header's applied-filters pop-up (value: measure `Filter Value`). Version slicers are three copies of `param_version_choice` so base, Compare A and Compare B select independently. |

## Relationships

All single direction, many-to-one, dimension filters fact. No bidirectional relationships, no snowflake beyond the spec's account → nature bridge.

| From (many) | To (one) | Active |
|---|---|---|
| `fact_pl`, `fact_pl_allocated` · entity, month, version, region, channel, line, segment, account, cost centre | matching `dim_*` key | yes |
| `fact_pl.counterparty_entity_code` | `dim_entity.entity_code` | **no** (role-playing counterparty, C-35, D-33) |
| `fact_operational` · entity, month, version, region, channel, line, segment | matching `dim_*` key | yes |
| `fact_pl_elim` · entity (booking entity), month, version, region, account | matching `dim_*` key | yes (no channel, line, segment, cost-centre or counterparty relationship: the Group view clears the slices, ADR-0008 §4.2) |
| `bridge_account_nature.account_code` / `.nature_code` | `dim_account` / `dim_nature` | yes |
| `dim_kpi.entity_view_code`, `dim_bridge_step.entity_view_code` | `param_entity_view.entity_view_code` | yes (KPI slots and bridge steps follow the entity switch) |

Keys and technical columns are hidden; the field list shows only slicer labels and `_measures`. `discourageImplicitMeasures` is on.

## Calculation rules (where the spec lives in the model)

| Rule | Implementation |
|---|---|
| D-30, C-10..C-13 translation | Done per row by the loader (ADR-0008 (a)): `local ÷ local_per_usd(row currency) × local_per_usd(reporting currency)`, same month and rate type (BUD → BUDGET, ACT/FC → ACTUAL_AVG). `_Amt Raw` → `_Rep Sum` = a currency SWITCH over plain SUMs of `amount_usd` / `_eur` / `_gbp` (`gmv_*` for GMV). Constant currency (C-12) stays in the model: per functional currency, the local sum × BUDGET(reporting currency, FY) ÷ BUDGET(currency, FY) of the selected fiscal year, exact because C-10 gives one BUDGET rate per currency and year. Units and merchants are not translated. `Bridge Volume` always works at constant currency, so it keeps reading `amount_local` × that factor. |
| C-01..C-05 versions, §7 time windows | `_Win Start` / `_Win End` from the fiscal year, period and time view slicers; Actual is cut at the last closed month (`dim_month.is_closed`); comparisons reuse the base months; prior year shifts them back 12. `_Amt Window` applies version × window as one (version, month) filter, so `Base Amount`, `Compare A/B Amount` and `Bridge Comparison Amount` each cost one engine evaluation (no SWITCH over version branches). |
| D-32 subtotals | `_Amt Row`: input block = its accounts; group total = child blocks; subtotal / memo = all input blocks above it (signed sums, M-01 — equal to the `dim_report_line` formulas); ratio rows divide the formula's numerator line by its denominator (parsed from `formula`). |
| C-36, D-33 Group | `_Amt Entity` + `_Elim Amount`: both entities plus a plain SUM over `fact_pl_elim` under the current account filter (ADR-0008 (b)). Blocks and subtotals include their `ELIM_*` account and get the elimination; leaves like `GR_S1` keep the entity amounts; the `ELIM_*` leaf shows it. `KPI IC Eliminated` and `_Bridge Elim Change` read the same rows (account `ELIM_GR`). |
| C-31 allocation | Below-CM lines come from `fact_pl_allocated`, so every slice filter reconciles (T-03). |
| K-23 period-end KPIs | ARR and active merchants re-evaluate the base at the last month of the window. |
| K-24 KPI trend (ADR-0007) | Dropped 2026-10-23 (USER decision: no view or app reads it). `KPI Trend` and `_KPI Trend Value` were removed with their K-24 test blocks; the Key figures tiles show no trend since kpi-card-v2, and the helpers they used (`_Anchor Index`, `_Win Start`, `_Win End`, `_KPI Value`) stay because other measures need them. |
| C-40 bridge, T-05 | `_Bridge Value` per `dim_bridge_step`: comparison NR, then volume and price / mix (Consumer Products; `Bridge Volume` is one grouped pass over the 300 lowest slices), service lines (Commerce Cloud) or entities plus eliminations (ACME Group; `_Bridge Elim Change` = change of the eliminated IC revenue at constant currency), then FX. Comparison + steps = base NR for every entity, test window and comparison (T-05 test, 2026-10-22). |
| F-14, N-06 display units | Format strings never scale (Power BI renders Excel-style trailing commas literally). Measures bound to visuals divide by `_Units Divisor` (`param_units[divisor]`) and use plain formats: millions `#,0.0`, thousands `#,0`, % 1 dp, take rate 2 dp, ratio-row Δ in pp. Engine measures, ratios, Δ % and the DAX tests stay unscaled. |

An offline replica of these rules in Python reconciles all 552 rows of `control_totals_usd.csv` to within 0.01 USD (2026-10-21). The same check runs in the model via `pbi-report/ACME Unified PnL/tests/control-totals.dax`.

## Query performance (measured 2026-10-22, Desktop)

- Every query is formula-engine bound (storage engine < 10 %). A large share is query-plan building: each measure reference is expanded into its full engine chain, and every SWITCH / IF branch adds its chain to the plan whether it runs or not (a grid over `dim_kpi` with an empty result still costs ~5 s; the statement query with an empty result ~5 s). Keep branches few: steps or KPIs with the same formula share one branch.
- Statement measures do not share work: `PL Δ A` re-evaluates `_PL Base` and `_PL Compare A`, so one statement row costs about 19 engine evaluations for the 11 columns.
- A visual or query filtered by a literal list of `dim_kpi[kpi_code]` values is about 3-4x faster than one filtered by `kpi_group` or `slot` (2026-10-22): the engine prunes the `_KPI Value` SWITCH branches the codes cannot reach. The Key figures rows filter on code lists for that reason.
- Per evaluation, the month × currency × version translation iterator in `_Amt Raw` and the Group elimination branch in `_Amt Entity` were the largest costs (2026-10-22). ADR-0008 replaced both with plain sums over pre-translated columns and `fact_pl_elim` (2026-10-23); timings before and after per view: ADR-0008 §5.
- Branch pruning (2026-10-23): the engine leaves an unused IF / SWITCH branch out of the plan only when the condition is `SELECTEDVALUE` of a column the query filters with a literal. `_Amt Raw`, `_Rep Sum` and `_Elim Amount` therefore read `param_fx_basis[fx_basis_name]` and `param_reporting_currency[currency_code]` (the slicer columns) directly, with literal fallbacks (actual rates, USD); reading them through `[_Sel FX Basis]` / `[_Sel Currency]` cost 0.4–1 s per visual query.

- Redesign v4 (2026-10-27, scratch Desktop, visual-equivalent queries run 6 in parallel, cold cache / warm): Vitals 3.0 / 2.8 s (10 cards, slowest `kv_c07` 2.1 s alone), Analysis page 1 2.8 / 2.5 s (profit bridge), Analysis page 2 1.4 / 1.1 s, Profitability page 1 0.9 / 0.7 s, page 2 0.5 / 0.3 s. All within the ADR-0008 budget of 5 s per view; header and rail visuals not included.

## Not in this draft

- RLS by entity and region (N-04): roles not defined yet; needs the user/role mapping first. Role members are ginee's.
- Incremental refresh, aggregations, partitions: not needed at this volume (ADR-worthy if ever added).
- Refresh schedule, gateway / cloud connection, workspace: no deploy target yet (CLAUDE.md › Track B deployment TBD).

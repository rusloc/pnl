# Semantic model — ACME Unified P&L (Track B)

> Draft, 2026-10-21 (bip). Source: `pbi-report/ACME Unified PnL.SemanticModel/` (TMDL). Spec: `docs/Requirements.md` §7–§8; data rules: `data/acme_pl_dummy_data/README.md`; data layer: ADR-0003. Measures: `docs/model/measure-dictionary.md`.

## Storage mode and source

- **Import** from the `lh_raw` SQL analytics endpoint (workspace RAW, schema `acme_pl`), connector `Sql.Database`. Rationale: simplest path for a Desktop draft (about 1.2 M fact rows, a few MB compressed), no service-side model needed while drafting.
- **Direct Lake is not decided here.** The tables are single-file Delta tables inside every guardrail (ADR-0003), so Direct Lake stays an option; storage mode, partitions and refresh are ginee's call (physical layer).
- **Power Query parameters** (CLAUDE.md runtime hook for Track B): `SqlEndpoint` (SQL endpoint host of `lh_raw`, not a credential) and `Database` = `lh_raw`. Every table query starts with `Sql.Database(SqlEndpoint, Database)` and navigates to `acme_pl.<table>`; navigation and the type step fold. No credentials are stored in files: Desktop asks for them on first refresh (Microsoft account / Entra ID).
- Types: amounts (`amount_local`, `gmv_local`, `amount_usd`) are **Fixed Decimal** (`Currency.Type`, decimal(18,2) at source, exact cents); `local_per_usd` is **Decimal Number (double)**, never Fixed Decimal, so rates keep 6 dp (ginee handoff, ADR-0003).

## Tables

| Kind | Tables | Notes |
|---|---|---|
| Facts (hidden) | `fact_pl`, `fact_pl_allocated`, `fact_operational`, `fact_fx_rate` | Direct accounts read from `fact_pl`, below-CM accounts from `fact_pl_allocated`; `_UNASSIGNED` rows are never added to allocated (data README). `fact_fx_rate` is disconnected and looked up per month × currency × rate type. |
| Dimensions | `dim_account`, `dim_entity`, `dim_month`, `dim_version`, `dim_region`, `dim_channel`, `dim_line`, `dim_segment`, `dim_cost_centre`, `dim_nature`, `bridge_account_nature`, `dim_report_line` | Spec §8 names. `dim_report_line` is not joined to facts (D-11). Natures and cost centres are loaded for the deferred by-nature lens and drill-through. |
| Parameters from the lakehouse | `param_reporting_currency`, `param_fx_basis`, `param_units`, `param_time_view`, `param_version_choice` (hidden source) | Disconnected (D-21). `param_layout`, `param_cost_lens`, `param_detail_level`, `param_cost_sign`, `param_variance_format`, `param_breakdown` are not loaded yet: their features are deferred. |
| Check table (hidden) | `control_totals_usd` | Expected values for the DAX tests only (T-06). |
| Calculated, logical layer | `param_entity_view`, `param_fiscal_year`, `param_period`, `param_base_version`, `param_compare_a`, `param_compare_b`, `param_breakdown_field` (field parameter), `dim_pl_row`, `dim_kpi`, `dim_bridge_step`, `param_metric` + `param_eval` (hidden engine switches), `_meta_refresh`, `_measures` | `dim_pl_row` = one row per report line plus one per leaf account under its block; the statement matrix uses it. Version slicers are three copies of `param_version_choice` so base, Compare A and Compare B select independently. |

## Relationships

All single direction, many-to-one, dimension filters fact. No bidirectional relationships, no snowflake beyond the spec's account → nature bridge.

| From (many) | To (one) | Active |
|---|---|---|
| `fact_pl`, `fact_pl_allocated` · entity, month, version, region, channel, line, segment, account, cost centre | matching `dim_*` key | yes |
| `fact_pl.counterparty_entity_code` | `dim_entity.entity_code` | **no** (role-playing counterparty, C-35, D-33) |
| `fact_operational` · entity, month, version, region, channel, line, segment | matching `dim_*` key | yes |
| `bridge_account_nature.account_code` / `.nature_code` | `dim_account` / `dim_nature` | yes |
| `dim_kpi.entity_view_code`, `dim_bridge_step.entity_view_code` | `param_entity_view.entity_view_code` | yes (KPI slots and bridge steps follow the entity switch) |

Keys and technical columns are hidden; the field list shows only slicer labels and `_measures`. `discourageImplicitMeasures` is on.

## Calculation rules (where the spec lives in the model)

| Rule | Implementation |
|---|---|
| D-30, C-10..C-13 translation | `_Amt Raw`: sum local per month × functional currency × version, × reporting rate / local rate of the same month and rate type (BUD → BUDGET, ACT/FC → ACTUAL_AVG; constant currency → BUDGET of the selected FY for every version). |
| C-01..C-05 versions, §7 time windows | `_Win Start` / `_Win End` from the fiscal year, period and time view slicers; Actual is cut at the last closed month (`dim_month.is_closed`); comparisons reuse the base months; prior year shifts them back 12. `_Amt Window` applies version × window as one (version, month) filter, so `Base Amount`, `Compare A/B Amount` and `Bridge Comparison Amount` each cost one engine evaluation (no SWITCH over version branches). |
| D-32 subtotals | `_Amt Row`: input block = its accounts; group total = child blocks; subtotal / memo = all input blocks above it (signed sums, M-01 — equal to the `dim_report_line` formulas); ratio rows divide the formula's numerator line by its denominator (parsed from `formula`). |
| C-36, D-33 Group | `_Amt Entity` + `_Elim Amount`: both entities plus minus the counterparty rows of blocks GR and VSC (only where their `ELIM_*` account is in the filter), so leaves keep entity amounts and eliminations show on their own rows. |
| C-31 allocation | Below-CM lines come from `fact_pl_allocated`, so every slice filter reconciles (T-03). |
| K-23 period-end KPIs | ARR and active merchants re-evaluate the base at the last month of the window. |
| C-40 bridge, T-05 | `_Bridge Value` per `dim_bridge_step`: comparison NR, then volume and price / mix (Consumer Products; `Bridge Volume` is one grouped pass over the 300 lowest slices), service lines (Commerce Cloud) or entities plus eliminations (ACME Group; `_Bridge Elim Change` = change of the eliminated IC revenue at constant currency), then FX. Comparison + steps = base NR for every entity, test window and comparison (T-05 test, 2026-10-22). |
| F-14, N-06 display units | Format strings never scale (Power BI renders Excel-style trailing commas literally). Measures bound to visuals divide by `_Units Divisor` (`param_units[divisor]`) and use plain formats: millions `#,0.0`, thousands `#,0`, % 1 dp, take rate 2 dp, ratio-row Δ in pp. Engine measures, ratios, Δ % and the DAX tests stay unscaled. |

An offline replica of these rules in Python reconciles all 552 rows of `control_totals_usd.csv` to within 0.01 USD (2026-10-21). The same check runs in the model via `pbi-report/tests/control-totals.dax`.

## Query performance (measured 2026-10-22, Desktop)

- Every query is formula-engine bound (storage engine < 10 %). A large share is query-plan building: each measure reference is expanded into its full engine chain, and every SWITCH / IF branch adds its chain to the plan whether it runs or not (a grid over `dim_kpi` with an empty result still costs ~5 s; the statement query with an empty result ~5 s). Keep branches few: steps or KPIs with the same formula share one branch.
- Statement measures do not share work: `PL Δ A` re-evaluates `_PL Base` and `_PL Compare A`, so one statement row costs about 19 engine evaluations for the 11 columns.
- Per evaluation, the month × currency × version translation iterator in `_Amt Raw` and the Group elimination branch in `_Amt Entity` are the largest costs; both only shrink with a physical change (pre-translated amounts, materialised elimination rows), proposed to ginee on 2026-10-22 (physical layer, ADR-worthy).

## Not in this draft

- RLS by entity and region (N-04): roles not defined yet; needs the user/role mapping first. Role members are ginee's.
- Incremental refresh, aggregations, partitions: not needed at this volume (ADR-worthy if ever added).
- Refresh schedule, gateway / cloud connection, workspace: no deploy target yet (CLAUDE.md › Track B deployment TBD).

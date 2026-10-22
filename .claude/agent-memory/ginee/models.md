# Models

## Facts
- [2026-10-21] ACME Trucks local model `pbi-report/ACME Trucks/Trucks.SemanticModel` = faithful rebuild of the live model "Time unitilaztion" (workspace "Showcase", USER's personal tenant; not in CLAUDE.md yet). Import, compat 1567, culture ru-RU, 34 tables, 272 columns (67 calculated), 301 measures, 33 relationships, 7 hierarchies, 0 roles (source: observed)
- [2026-10-21] Original sources were on-prem SQL Server + a UNC Excel file (unreachable). Data came from the live model via executeQueries into `data/*.parquet` (14 tables, 7.6 MB; largest КРВ АС 804,526 rows); every partition reads Parquet through the one M parameter DataFolder (source: observed)
- [2026-10-21] Kept as defined: 7 #table-literal switch/dim tables, Таблица мер (compressed literal), СПИСОК_ЭКС (M ref to Справочник ЭКС), 4 Средневзвеш_* DAX calc tables, 7 auto date tables (source: observed)
- [2026-10-21] The 4 KPI measures (ГМ на авто план/факт, _производительность_авто_ПЛАН/ФАКТ) multiply by RANDBETWEEN(10,100): values change on every query; test their RAND-free unit + multiplier range instead (source: observed)
- [2026-10-21] Weighted measures use DISTINCTCOUNT('Справочник ЭКС'[Название ЭКС в ГД]) as the loader grain: dropping that column breaks 58 measures; a 1:1 value replacement does not (source: observed)
- [2026-10-21] ACME Unified PnL (local PBIP): Import, compat 1702, 36 tables = 22 M partitions (Sql.Database(SqlEndpoint, Database), schema acme_pl) + 14 calculated (DATATABLE params, _meta_refresh = NOW()); params match lh_raw SQL endpoint; 0 roles; cache.abf 14 MB; ~1.25 M fact rows (fact_pl_allocated 758k, fact_pl 458k) (source: observed)
- [2026-10-21] Calendar M used DateTime.LocalNow (refresh-relative); rebuilt from the live snapshot (156 days, 2022-10-29 onward) so values stay frozen (source: observed)
- [2026-10-21] ACME Unified PnL published to RAW (dev) as a model-only item (create via REST from a staged copy, 44 parts, 0 roles). First API refresh failed (no explicit connection); USER then created ShareableCloud connection acme-lh_raw-sql-dev (OAuth2, Organizational) and mapped it (source: observed)
- [2026-10-21] ACME Unified PnL Fixed Decimal columns: fact_pl.amount_local, fact_pl_allocated.amount_local, fact_operational.gmv_local, bridge_account_nature.weight, control_totals_usd.amount_usd (fact_fx_rate.local_per_usd is double). 48 of 175 measures return Currency (all of 2 Versions + Subtotals, KPI Items ARR/Active Merchants/GMV/IC Eliminated/Units Sold, 4 Analysis Bridge*/LV* except LV Δ %, Prof Net Revenue, 9 Engine _Amt*/_Bridge*/_Elim/_Local Sum/_NR CC*/_PY NR CC/_Units*); 1 Statement PL* and KPI ratios return Number (source: observed, INFO.VIEW.MEASURES)
- [2026-10-21] ACME Unified PnL in RAW: refresh baseline 28 s (on-demand, full), 22 imported tables, 1,246,392 rows (fact_pl_allocated 758,364 · fact_pl 457,896 · fact_operational 29,016 · control_totals_usd 552) (source: observed)
- [2026-10-21] Service tests: T-06 headline 24/24 and full 552/552 PASS (max diff 0.0053 USD; 8 ADJ rows BLANK = expected 0); T-01/02, T-03, T-10, T-17, T-07 PASS by value; T-05 FAIL for GROUP only (steps sum 106.30 M short; ELIM step looks like a level, not a delta) → bip (source: observed)
- [2026-10-21] executeQueries returns Currency measures unscaled (Net Revenue raw = CONVERT DOUBLE); PL * measures are already divided by param_units[divisor] (default 1e6, USD m) (source: observed)

- [2026-10-22] ACME Unified PnL in RAW updated in place (updateDefinition, same item, 43 parts, no .platform) to bip's measures change (T-05 GROUP fix): 175 measures = local; rows unchanged 1,246,392; T-06 24/24 + 552/552, T-05/T-10 54/54 PASS; ELIM bridge step -106.39 M -> -0.09 M (source: observed)
- [2026-10-22] Service probe timings (executeQueries wall time, warm, 2 runs) before -> after: q1-statement-sliced 20.5-20.9 -> 22.5-25.2 s; q2-kpi-smoke (all 12 KPIs, unchunked) 161-192 -> 87-99 s; q3-bridge-smoke 8.6-8.7 -> 6.6-7.2 s; q3-bridge-p-py 8.9-9.4 -> 6.2-6.6 s (source: observed)
- [2026-10-22] Translation is row-group SUMX with 2 LOOKUPVALUEs per month x functional currency x version (_Amt Raw); CC uses the selected FY's January BUDGET rate -> pre-translation needs 3 ACT + 9 CC (3 FY x 3 ccy) columns or a default-path-only column (source: observed)
- [2026-10-22] fact_pl has 5,304 counterparty rows (936 at entity x month x version x region x account x ccy); fact_pl_allocated has none; control totals have no ELIM line codes (elims sit in GROUP GR/VSC/NR) (source: observed)

## Decisions
- [2026-10-21] Faithful to source names (no RU→EN in TMDL); bip renames later (source: user)
- [2026-10-21] Parquet for all extracted tables: exact types, null vs empty string, no ru-RU decimal parsing (source: inferred)

## Pending
- bip: T-05 GROUP bridge gap (ELIM step); CLAUDE.md row for the RAW model + connection awaits go-ahead
- USER: open Trucks.pbip in Desktop, refresh, run tests/baseline-live.dax (all _pass TRUE)
- USER: Q-01 sensitive values (data files, _loaderAltName/_officeAltName DAX literals, model.tmdl Tabular Editor metadata)

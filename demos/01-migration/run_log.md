# Run log · Spec 1 · Power BI to Fabric migration demo

Numbers from real runs only (ADR-0018); the video quotes these, never the spec. Demo-only IDs are allowed here; secrets and tokens never.

## Environment

| Field | Value |
|---|---|
| Run date | 2026-11-24 |
| Capacity | `issglobalfabric`, F64, North Europe (`1bb7581b-5ed3-4e71-b22c-4501afea0ba4`), shared with workspace RAW |
| Tenant XMLA setting | "Allow XMLA endpoints and Analyze in Excel with on-premises semantic models": on (read 2026-11-24) |
| Capacity XMLA endpoint mode | not readable through the API; check Admin portal › Capacity settings › `issglobalfabric` › Power BI workloads › XMLA Endpoint = Read Write |

## Items

| Item | Type | ID |
|---|---|---|
| `ws_migration_demo` | Workspace | `cfdc37ca-2415-4e31-82e7-523d7081f298` |
| `lh_sales_demo` | Lakehouse, no schemas | `748292f5-2cbf-486d-b008-38ef5d7cdb43` |
| `lh_sales_demo` | SQL analytics endpoint | `762e01f6-b305-4b65-b8bd-85d9f10f658e` |
| `lh_sales_demo` | SQL analytics endpoint host (`SqlEndpoint` parameter, connection `demo-lh_sales_demo-sql`) | `gbpyeggwhrpurjozyf5wy5acci-zi35ztyveqyu5axhki6xbapsta.datawarehouse.fabric.microsoft.com` (read 2026-11-24 with `fab get`, main agent) |
| `nb_01_build_sales_demo` | Notebook, default lakehouse `lh_sales_demo` | `c7fb44d0-0ab9-4bef-a8d0-7d3db5a7518d` |
| `nb_02_append_day` | Notebook, default lakehouse `lh_sales_demo` | `276abcd5-097e-4c57-b2cd-d7dba8a1d3ed` |
| `Sales Import` | Semantic model, Import (SQL endpoint) | `bec9b500-ccc5-4fb8-afe6-1e6e7bfe5c06` |
| `Sales Import` | Report (PBIR), bound to `Sales Import` | `d77e0173-7898-4afe-b2aa-cac21acaf2ec` |
| `Sales Direct Lake` | Semantic model, Direct Lake on OneLake | `b516e966-e045-4a46-ad29-46c302a90e80` |
| `Sales Direct Lake` | Report (PBIR), bound to `Sales Direct Lake` | `5481bca0-334a-4463-95ce-5c16329468ba` |

Notebook source: `notebooks/<name>.Notebook/` (spec § 5 code verbatim, cell 1 shared; `nb_02_append_day` cell 2 starts with the build cell's V-Order line, per the spec § 5 note). `{{LAKEHOUSE_ID}}` / `{{WORKSPACE_ID}}` in the META block stand for the IDs above.

## Build runs (`nb_01_build_sales_demo`)

| Run | `N_SALES` | Started (UTC) | Ended (UTC) | Duration |
|---|---|---|---|---|
| 1 (smoke) | 300,000 | 2026-11-24 10:56:14 | 11:00:58 | 284 s |
| 2 (spec) | 30,000,000 | 2026-11-24 11:08:28 | 11:11:37 | 190 s |

Durations are job times from the Fabric job scheduler and include the Spark session start.

## Checks

Checked through the SQL analytics endpoint (after a metadata sync) and, for counts, the Delta log.

| Check | Run 1 (300 k) | Run 2 (30 M) |
|---|---|---|
| 9 tables in `lh_sales_demo` | pass | pass |
| `raw_customer` / `dim_customer` | 200,000 / 200,000 | 200,000 / 200,000 |
| `raw_product` / `dim_product` | 2,500 / 2,500 | 2,500 / 2,500 |
| `raw_store` / `dim_store` | 100 / 100 | 100 / 100 |
| `dim_date` | 1,096 (2024-01-01 .. 2026-12-31) | 1,096 (2024-01-01 .. 2026-12-31) |
| `raw_sales` / `fact_sales` | 300,000 / 300,000 | 30,000,000 / 30,000,000 |
| Counts = spec § 4 (§ 10 check 1) | pass (scaled) | **pass** |
| Null keys (raw_sales, fact_sales, dims) | 0 | 0 |
| Null amounts (fact_sales) | 0 | 0 |
| Orphan keys (4 gold FKs, 3 raw FKs) | 0 | 0 |
| Duplicate `sales_id` (raw, gold) | 0 | 0 |
| `sales_id` range | 1 .. 300,000 | 1 .. 30,000,000 |
| `order_date` range | 2024-01-01 .. 2026-10-31 | 2024-01-01 .. 2026-10-31 |
| Gold money columns | decimal(18,2) | decimal(18,2) |

Gold baseline after run 2 (SQL endpoint; the models must match these in § 10 check 2):

| Value | Gold |
|---|---|
| Sales Amount (sum `net_amount`) | 19,476,577,850.61 |
| Cost Amount (sum `cost_amount`) | 13,680,398,573.72 |
| Order Lines | 30,000,000 |
| Last Order Date | 2026-10-31 |
| Data As Of (max `load_ts`, UTC) | 2026-11-24 11:09:43 |
| Sales Amount by Price Band | Budget 637,441,473.99 (12,736,513 lines) · Mid 3,416,125,104.29 (9,489,125) · Premium 15,423,011,272.33 (7,774,362) |

The Import model computes Net Amount from `raw_sales` in Power Query (`quantity * net_price`, Fixed decimal), so its total should equal the gold sum unless rounding differs; § 10 check 2 settles it.

`nb_02_append_day` has not been run: the dataset ends on 2026-10-31 for the first rehearsal.

## Model deploy 2026-11-24

- 11:15 UTC: first attempt refused (measure `Cost Amount` and column `Cost Amount` on `Sales`); nothing created. Fixed by the ADR-0018 amendment: every measure ends in " (fx)" and lives in the measures-only calculated table `_Measures`.
- 11:39–11:40 UTC: both models and both reports created through the Fabric Items API from the PBIPs (placeholders filled in a scratch copy only; reports deployed with a `byConnection` binding to their own model, since the API does not take `byPath`).

| Check | Result |
|---|---|
| `Sales Direct Lake` framing (enhanced refresh) | Completed, 11:41:23–11:41:29 UTC, 5.2 s |
| `_Measures` calculated table processed | yes, 1 row |
| `[Sales Amount (fx)]` | 19,476,577,850.61 = gold |
| `[Order Lines (fx)]` | 30,000,000 = gold |
| `[Cost Amount (fx)]` | 13,680,398,573.72 = gold |
| `[Last Order Date (fx)]` / `[Data As Of (fx)]` | 2026-10-31 / 2026-11-24 11:09:43 UTC |
| Sales Amount by Price Band | Budget 637,441,473.99 · Mid 3,416,125,104.29 · Premium 15,423,011,272.33 = gold |
| "Keep your Direct Lake data up to date" (§ 7 step 6) | not exposed by the API; confirm in the model's settings › Refresh (on by default) |
| `Sales Import` data source | `Sql` · lh_sales_demo endpoint host · `lh_sales_demo`, bound 12:23 UTC to the cloud connection `demo-lh_sales_demo-sql` (`39817d5c-0b05-4b55-a12d-62024a5da24a`, created by the USER: shareable cloud, SQL, OAuth2, Organizational) |

### Import refresh, `Sales Import` (spec § 6 step 8)

| Field | Value |
|---|---|
| Type | Full (enhanced refresh API), first refresh of the model |
| Refresh history | Completed, 2026-11-24 12:23:53.6 – 12:28:48.9 UTC |
| **Duration** | **295 s (4 min 55 s)** |
| § 10 check "Import refresh ≥ 2 min" | **pass**: no 60 M rebuild needed |
| Note | A 6 s Dev → Prod deployment of the CI/CD demo ran on the same capacity during the refresh; nothing else of ours |

| Check (Sales Import after refresh) | Result |
|---|---|
| `[Sales Amount (fx)]` | 19,476,577,850.61 = gold |
| `[Order Lines (fx)]` | 30,000,000 = gold |
| `[Cost Amount (fx)]` | 13,680,398,573.72 = gold |
| `[Last Order Date (fx)]` / `[Data As Of (fx)]` | 2026-10-31 / 2026-11-24 11:09:43 UTC (same as Sales Direct Lake) |
| Sales Amount by Price Band | Budget 637,441,473.99 (12,736,513 lines) · Mid 3,416,125,104.29 (9,489,125) · Premium 15,423,011,272.33 (7,774,362) = gold |
| `_Measures` calculated table | processed, 1 row |

## Pending (later steps)

- Seconds until `Sales Direct Lake` shows the new day after `nb_02_append_day` (§ 9 step 3)

## Acceptance (bip, 2026-11-24 12:30–12:37 UTC)

`tests/acceptance.dax` run against both service models through the executeQueries REST API (read-only; XMLA from this machine failed authentication, so no XMLA). Outputs compared row by row (JSON, same ORDER BY). Data state: build run 2, before any `nb_02_append_day`.

| § 10 check | Query | Sales Import | Sales Direct Lake | Result |
|---|---|---|---|---|
| 2 Totals identical | check 2 | Sales Amount (fx) 19,476,577,850.61 · Order Lines (fx) 30,000,000 · Last Order Date (fx) 2026-10-31 | identical | **pass** (= gold) |
| 3 Country by Year matrix identical | check 3 (36 rows incl. subtotals) | grand total 19,476,577,850.61, Margin % (fx) 29.76 %; years 2024 4,411,334,756.10 · 2025 7,440,618,396.65 · 2026 7,624,624,697.86 | 36 / 36 rows identical | **pass** |
| 4 Price Band totals equal | check 4 (4 rows) | Budget 637,441,473.99 (12,736,513 lines) · Mid 3,416,125,104.29 (9,489,125) · Premium 15,423,011,272.33 (7,774,362) | identical | **pass** (= gold) |
| 4 Slicer offers Budget, Mid, Premium | check 4b | 3 bands, Pass TRUE | **4 values: (Blank), Budget, Mid, Premium; Pass FALSE** | **fail (Direct Lake)** |
| 5 Five Direct Lake tables, no calculated columns / tables | check 5 (INFO.VIEW version) | n/a ("before" state: all Import; Product 1 calculated column; Date and _Measures calculated tables) | Customer, Date, Product, Sales, Store = "Direct Lake", 0 calculated columns, not calculated; `_Measures` = "Import", calculated table, 7 measures | **pass with the ADR-0018 amendment caveat** (`_Measures`) |

**Check 4 failure, cause.** In `Sales Direct Lake` every dimension carries the blank member although no fact key is missing (`Sales` product keys not in `Product` = 0; `COUNTROWS ( ALL ( 'Product' ) )` = 2,501 vs 2,500 rows; Customer[Country] 9 values, Store[Channel] 3, Date[Year] 4). The Import model has none. A slicer query (`SUMMARIZECOLUMNS ( 'Product'[Price Band] )`) returns the blank, so the Direct Lake report's Price Band and Channel slicers show **(Blank)** (confirmed in the PDF export of the live report). Measures and visuals with values are unaffected (checks 2–4 totals identical). Not fixed: the spec says stop on a failed check. Proposed fix (needs a go-ahead): a visual-level filter "is not blank" on both slicers in **both** reports, so the two reports still differ only in the title bar.

**Check 5 mode codes.** `INFO.TABLES` / `INFO.PARTITIONS` (TMSCHEMA, numeric `Mode`) are refused by executeQueries (`DatasetExecuteQueriesError`). `INFO.VIEW.TABLES ()` works and returns text: `[StorageMode]` = "Direct Lake" / "Import"; `INFO.VIEW.COLUMNS ()` `[Type]` = "Data" / "Calculated" / "CalculatedTableColumn" / "RowNumber". Check 5 in `tests/acceptance.dax` now uses these (numeric codes no longer needed; old version in `__backup__`).

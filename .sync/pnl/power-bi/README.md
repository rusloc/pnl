from rusloc/pnl (ginee, bip) · to vosk.dev repo agent · 2026-10-30 · status: ready

**Generate the data, then refresh (USER 2026-10-30).** The pack ships no data and no model cache: the Parquet files and `.pbi/cache.abf` are not in git. Generate the 23 Parquet files with `../../data-gen/` (`pnl\generator\generate.py`, output `data-gen\pnl\parquet`), set `DataFolder` to that folder, refresh in Power BI Desktop, check, then publish (see How to open). The generated files are byte-identical to the `data/` files this pack shipped until 2026-10-30 (checked 2026-10-30 by ginee), so the earlier verification still holds: on 2026-10-30 bip opened the loaded pack (44 tables, 1,251,954 rows), the P&L statement rendered with data and T-06 passed (headline 24 rows TRUE, full reconciliation 552 / 552). `powerbi-report-author validate`: 0 errors, 0 warnings.

**Publish after the Desktop refresh; no refresh in the service.** Do not schedule a refresh: the source is local Parquet, which the service could only read through an on-premises gateway. The published report is a snapshot of the generated data. `DataFolder` ships as a placeholder. No workspace, dataset, tenant or capacity IDs belong in `.sync/`.

Earlier check, 2026-10-28, by bip: opened in Power BI Desktop with `DataFolder` = the pack's Parquet folder (then `data/`); full refresh 18 s, the Parquet DECIMAL columns load unchanged and all 23 tables match the row counts below. `tests/control-totals.dax`: 23 of 23 blocks green, 18 `_pass` blocks / 846 rows TRUE (T-06 552/552, T-P 601/601) and 5 inspection blocks as expected (T-01/T-02, T-03, T-17, T-07 empty). Run one `EVALUATE` at a time: the whole file in one batch ran out of memory, and the T-P blocks took 19 min in total. `powerbi-report-author validate`: 0 errors, 0 warnings.

# ACME Unified P&L — Power BI pack (PBIP + local Parquet)

A clean copy of the repo's Track B report `pbi-report/ACME Unified PnL/`. The only change is the model's data source. The repo
model imports from a Fabric lakehouse SQL endpoint, and this copy imports the same tables from local Parquet files that `../../data-gen/pnl/` generates.
Measures, relationships, report pages, theme and tests are byte-identical to the repo copy. The pack was copied from the repo state
of commit `fcfa19c`, and `pbi-report/` had no uncommitted changes at copy time.

Data, names and numbers are fictional: ACME is an invented company with 3 entities.

## What is here

| Path | What |
|---|---|
| `ACME Unified PnL.pbip` | Open this in Power BI Desktop |
| `ACME Unified PnL.SemanticModel/` | TMDL, Import, 23 tables from Parquet + 20 calculated / disconnected tables + `_measures` (253 measures), 35 relationships, 0 RLS roles, compatibility level 1702 |
| `ACME Unified PnL.Report/` | PBIR: page `pnl_one_pager` (views and side-bar menus as bookmarks) + tooltip page `tt_pl_info`, theme and SVG icons |
| `tests/control-totals.dax` | DAX query view tests (spec §10: T-01 … T-17, T-06 full reconciliation, ADR-0008 rate paths, views v4, B-vs-C parity) |
| `../../data-gen/pnl/` | Not in this folder: the generator. It writes the 23 source tables the model imports to `parquet/` (one file per table, 31.8 MB, not in git); `checks/control_totals_usd.csv` (552 rows, committed) holds the expected USD totals, the same data as the model table `control_totals_usd` |

## How to open

1. Use a current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report. On an older build,
   turn these on under Options > Preview features.
2. Generate the data: in `.sync\data-gen`, `.venv\Scripts\python.exe pnl\generator\generate.py` (setup and requirements in
   `../../data-gen/README.md`; about 10 s). It writes `data-gen\pnl\parquet\` (23 files).
3. Open `ACME Unified PnL.pbip`. There is no data cache, so the tables are empty; if Desktop offers to refresh, cancel. Set the
   parameter first: Transform data > Manage parameters > **DataFolder** = the full local path of `data-gen\pnl\parquet`, without a
   trailing backslash (for example `<repo root>\.sync\data-gen\pnl\parquet`). The shipped value is the placeholder
   `<folder holding the Parquet files>`, so a refresh fails until you change it. Close & Apply, then Home > Refresh (18–23 s on
   the source machine, 1.25 M fact rows).
4. Check (How to verify), then publish from Desktop (Home > Publish).
5. Desktop writes its own `.pbi/localSettings.json` and `.pbi/cache.abf` (both ignored by git), and a save writes your machine path
   into `definition/expressions.tmdl`: put the placeholder back there before committing anything in `.sync/`.

Every imported table reads `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))`. A file source does not fold, so each
file is read whole. The rest of each partition (column selection and explicit types) is unchanged from the repo model.

## How to verify

1. Row counts after the refresh (Model view or a `COUNTROWS` query):

   | Table | Rows | Table | Rows |
   |---|---:|---|---:|
   | `fact_pl` | 457,896 | `dim_account` | 73 |
   | `fact_pl_allocated` | 758,364 | `dim_report_line` | 29 |
   | `fact_operational` | 29,016 | `bridge_account_nature` | 54 |
   | `fact_pl_elim` | 5,304 | `dim_cost_centre` | 19 |
   | `fact_fx_rate` | 288 | `dim_channel` / `dim_line` / `dim_segment` | 10 / 11 / 8 |
   | `control_totals_usd` | 552 | `dim_month` / `dim_nature` | 36 / 9 |
   | `dim_entity` / `dim_version` / `dim_region` | 2 / 4 / 4 | `param_*` (5 tables) | 2–5 each |

2. Open `tests/control-totals.dax` in DAX query view and run it. Every result tab must show `_pass = TRUE` on every row
   (23 `EVALUATE` blocks; tolerance 0.01 USD). T-06 reconciles all 552 rows of `control_totals_usd` (= `../../data-gen/pnl/checks/control_totals_usd.csv`).
   The T-P parity block at the end takes about 6–7 minutes on a clean instance, so run it last.
3. Optional: validate the report definition with `powerbi-report-author validate "ACME Unified PnL.pbip"`.

## What changed vs the repo copy

| Where | Repo (`pbi-report/ACME Unified PnL/`) | This pack |
|---|---|---|
| `definition/expressions.tmdl` | Parameters `SqlEndpoint` (lakehouse SQL endpoint host) and `Database` | One text parameter `DataFolder` (placeholder value, described in a `///` comment that points to `data-gen/pnl/parquet`) |
| `definition/model.tmdl` | `PBI_QueryOrder` starts with `SqlEndpoint`, `Database` | Starts with `DataFolder`; the rest is unchanged |
| 23 table partitions in `definition/tables/` | `Sql.Database(SqlEndpoint, Database)` + navigation to `acme_pl.<table>` | One comment line + `Data = Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))`; the column selection and type steps are unchanged |
| Excluded | `.pbi/localSettings.json` (report and model), `__backup__/` | — |
| Added | — | This README; the data is generated by `../../data-gen/pnl/` (not in git) |

How the Parquet files are produced: `../../data-gen/pnl/generator/generate.py` runs the repo's CSV generator (`gen_data.js`) and
then a copy of the script that loads the lakehouse (`fabric-data/lh_raw/load_acme_pl.py --parquet-out <dir> --tables <23 tables>`). It applies the same strict CSV parse, the same type
spec, the same checks and the same ADR-0008 derivations (`amount_usd/eur/gbp` on `fact_pl` and `fact_pl_allocated`, `gmv_usd/eur/gbp`
on `fact_operational`, and the derived table `fact_pl_elim`) as the lakehouse load. A check on 2026-10-28 compared every imported
table's model columns (`sourceColumn` and `dataType`) with its Parquet schema: names match on all 23 tables and the types are
compatible.

Parquet types: text = `string`; whole numbers = `int32` (the model stores int64, as with the SQL endpoint); flags = `bool`;
`month_start_date` = `date32`; local amounts and `control_totals_usd.amount_usd` = `decimal(18,2)` (model: Fixed Decimal);
`bridge_account_nature.weight` = `decimal(5,4)` (Fixed Decimal); pre-translated amounts and `local_per_usd` = `decimal(18,6)`
(model: Decimal Number, double; never Fixed Decimal). Compression: snappy.

## Known caveats

- **Desktop visual check pending.** bip refreshed this pack from the same Parquet and ran every DAX test on 2026-10-28 (all green, see Verified), and on 2026-10-30 render-checked the P&L statement view of the loaded pack. The USER has not yet done the visual first-open check of the other views.
- **Parquet DECIMAL columns.** The amounts are stored as Parquet DECIMAL, not double, so the values are exact and match the lakehouse.
  Power Query reads DECIMAL as Decimal Number, and the partitions then apply the repo's explicit types. If Desktop rejects a DECIMAL
  column on refresh, report it back. The fix is a regenerated file set, not a model edit.
- **Publishing.** In the Power BI service, a model that reads local files needs an on-premises data gateway for scheduled or manual
  refresh. Publish after the Desktop refresh and do not schedule a refresh. The data is static.
- **Repo drift.** The repo model is maintained in rusloc/pnl. If its measures or report change after `fcfa19c`, this pack has to be
  re-copied: re-run the copy, re-apply the 3 source edits above. The data only changes if the dataset or
  the derivations change.
- `_meta_refresh` shows the time of the last refresh (`NOW()`).
- `.platform` files keep the repo's `logicalId` values. They only matter if a workspace is connected to Git; give them new GUIDs if
  both copies ever share one workspace.
- No RLS roles (deferred in the source repo).

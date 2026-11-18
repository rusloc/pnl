from rusloc/pnl (bip) · to vosk.dev repo agent · 2026-11-18 · status: ready

**Re-packed 2026-11-18 with the Profitability rebuild of 2026-11-17** (vosk.dev Profitability spec; before that the web sync to
`../report-spec/`, USER Option B, and ADR-0017 P0 + P1): four view pages, **all 1280 × 720, fit to page (16:9)**, + two tooltip pages,
55 bookmarks, **321 measures**, four test files. What changed: `../../2026-11-16-pbi-web-sync.md` (section P&L against the 2026-10-30
pack; section "P&L Profitability, 2026-11-17 re-issue" against the 2026-11-17 pack).

**Generate the data, then refresh (USER 2026-10-30).** The pack ships no data and no model cache: the Parquet files and `.pbi/cache.abf`
are not in git. Generate the 23 Parquet files with `../../data-gen/` (`pnl\generator\generate.py`, output `data-gen\pnl\parquet`), set
`DataFolder` to that folder, refresh in Power BI Desktop, check, then publish (How to open).

**Publish after the Desktop refresh; no refresh in the service.** Do not schedule a refresh: the source is local Parquet, which the
service could only read through an on-premises gateway. The published report is a snapshot of the generated data. `DataFolder` ships as a
placeholder. No workspace, dataset, tenant or capacity IDs belong in `.sync/`. Embed size **1280 × 720**.

# ACME Unified P&L — Power BI pack (PBIP + local Parquet)

A clean copy of the repo's Track B report `pbi-report/ACME Unified PnL/` (working tree of 2026-11-18: ADR-0017 P1 + the Profitability rebuild of 2026-11-17). The only
change is the model's data source. The repo model imports from a Fabric lakehouse SQL endpoint, and this copy imports the same tables
from local Parquet files that `../../data-gen/pnl/` generates. Measures, relationships, report pages, bookmarks, theme and tests are
byte-identical to the repo copy.

Data, names and numbers are fictional: ACME is an invented company with 3 entities.

## What is here

| Path | What |
|---|---|
| `ACME Unified PnL.pbip` | Open this in Power BI Desktop |
| `ACME Unified PnL.SemanticModel/` | TMDL, Import, 23 tables from Parquet + 31 calculated / disconnected tables (new: `dim_combo_period`, the months / quarters axis of the Profitability combo chart) + `_measures` (321 measures), 35 relationships, 0 RLS roles, compatibility level 1702 |
| `ACME Unified PnL.Report/` | PBIR: pages `P&L statement`, `Vitals`, `Analysis`, `Profitability` (all four 1280 × 720, fit to page), tooltip pages `TT Vitals card` (320 × 240) and `TT Info` (360 × 280); panels and How to read as bookmarks (55); theme and SVG icons |
| `tests/control-totals.dax` | Spec §10 tests: T-01 … T-17, T-06 full reconciliation, ADR-0008 rate paths, views v4, B-vs-C parity (T-P), ADR-0017 defaults (24 blocks, 867 rows) |
| `tests/web-spec-golden.dax` | The spec's 63 golden answers, the 08 §4 reference rows, R-15 and R-16 (bridge labels) (16 blocks, 1,342 rows) |
| `tests/profitability-spec-2026-11-17.dax` | The Profitability spec of 2026-11-17 (§ 8 reference rows): region table rows, totals and statuses, concentration shares, the revenue and margin combo by month and by quarter (custom range), mix totals / GM row / top-left cell, static region order, partial quarter, measures in error (8 blocks, 117 rows) |
| `tests/web-oracle-2026-11-16.dax` | The web engine's oracle of 2026-11-16 (rusloc/pnl hunter): 21 selections × every view, 4,514 rows + a coverage row (84 blocks, 4,515 rows); texts compare as the visuals render them |
| `../../data-gen/pnl/` | Not in this folder: the generator. It writes the 23 source tables the model imports to `parquet/` (one file per table, 31.8 MB, not in git); `checks/control_totals_usd.csv` (552 rows, committed) holds the expected USD totals, the same data as the model table `control_totals_usd` |

## How to open

1. Use a current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report. On an older build,
   turn these on under Options > Preview features.
2. Generate the data: in `.sync\data-gen`, `.venv\Scripts\python.exe pnl\generator\generate.py` (setup and requirements in
   `../../data-gen/README.md`; about 10 s). It writes `data-gen\pnl\parquet\` (23 files).
3. Open `ACME Unified PnL.pbip`. There is no data cache, so the tables are empty; if Desktop offers to refresh, cancel. Set the
   parameter first: Transform data > Manage parameters > **DataFolder** = the full local path of `data-gen\pnl\parquet`, without a
   trailing backslash (for example `<repo root>\.sync\data-gen\pnl\parquet`). The shipped value is the placeholder
   `<folder holding the Parquet files>`, so a refresh fails until you change it. Close & Apply, then Home > Refresh (7–23 s on
   the source machine, 1.25 M fact rows).
4. Check (How to verify), then publish from Desktop (Home > Publish). Hide the page tabs in the service (report setting, not PBIR):
   the report has its own tabs.
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
   | `dim_entity` / `dim_version` / `dim_region` | 2 / 4 / 4 | `param_*` (5 tables) | 2–6 each |

2. Run the four test files one `EVALUATE` at a time (DAX query view, or ADOMD with the file's `DEFINE` header in front of each block):
   a whole file in one batch runs out of memory. Every row's `_pass` must be TRUE (tolerance 0.01 USD on amounts; texts exact). The
   T-P blocks at the end of `control-totals.dax` take a few minutes each.
3. Optional: validate the report definition with `powerbi-report-author validate "ACME Unified PnL.pbip"`.

Run by bip on this pack (2026-11-18, scratch copy with `DataFolder` = a fresh `generate.py` run, byte-identical to the former pack
data; refresh 21 s, row counts as above, `dim_combo_period` 48 rows): validator 0 / 0; 60 test blocks / 3,536 rows all TRUE:
`profitability-spec-2026-11-17.dax` in full (8 blocks / 117 rows), all 16 golden blocks / 1,342 rows, 17 oracle blocks / 1,666 rows
(seven Profitability selections), control totals 19 blocks / 411 rows incl. one T-P block. The full run of all four files on the repo
PBIP (same model and report, pack data, 2026-11-17): 8 / 117, 84 / 4,515, 16 / 1,342 and 24 / 867 rows TRUE.

## What changed vs the repo copy

| Where | Repo (`pbi-report/ACME Unified PnL/`) | This pack |
|---|---|---|
| `definition/expressions.tmdl` | Parameters `SqlEndpoint` (lakehouse SQL endpoint host) and `Database` | One text parameter `DataFolder` (placeholder value, described in a `///` comment that points to `data-gen/pnl/parquet`) |
| `definition/model.tmdl` | `PBI_QueryOrder` starts with `SqlEndpoint`, `Database` | Starts with `DataFolder`; the rest is unchanged |
| 23 table partitions in `definition/tables/` | `Sql.Database(SqlEndpoint, Database)` + navigation to `acme_pl.<table>` | One comment line + `Data = Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))`; the column selection and type steps are unchanged |
| Excluded | `.pbi/localSettings.json` (report and model), `.pbi/cache.abf`, `tools/` (generators and runners), `__backup__/` | — |
| Added | — | This README; the data is generated by `../../data-gen/pnl/` (not in git) |

`diff -r` against the repo PBIP shows only these files.

How the Parquet files are produced: `../../data-gen/pnl/generator/generate.py` runs the repo's CSV generator (`gen_data.js`) and
then a copy of the script that loads the lakehouse (`fabric-data/lh_raw/load_acme_pl.py --parquet-out <dir> --tables <23 tables>`). It
applies the same strict CSV parse, the same type spec, the same checks and the same ADR-0008 derivations (`amount_usd/eur/gbp` on
`fact_pl` and `fact_pl_allocated`, `gmv_usd/eur/gbp` on `fact_operational`, and the derived table `fact_pl_elim`) as the lakehouse load.

Parquet types: text = `string`; whole numbers = `int32` (the model stores int64, as with the SQL endpoint); flags = `bool`;
`month_start_date` = `date32`; local amounts and `control_totals_usd.amount_usd` = `decimal(18,2)` (model: Fixed Decimal);
`bridge_account_nature.weight` = `decimal(5,4)` (Fixed Decimal); pre-translated amounts and `local_per_usd` = `decimal(18,6)`
(model: Decimal Number, double; never Fixed Decimal). Compression: snappy.

## Known caveats

- **Sync deviations from the spec / web layout.** Listed in rusloc/pnl `docs/ADD/features/pnl-pbi-spec-gap-2026-11-16.md` § 12 / 12.1
  and `docs/design/parity-rules.md`. The ones you will notice: bridge data labels use fixed "$… m" formats (exact in USD millions only;
  USER 2026-11-16: speed), the variances table has no delta bar column (ADR-0017 P0), Group is in the model but hidden in the report,
  page tabs are hidden on publish. Profitability (gap doc § 12.2): the table's "Δ vs …" header is a card drawn over the static header
  cell (resizing that column needs the card moved); status dots are Power BI circle icons, not the web's exact colours; Δ % and
  CM Δ pp keep static formats ("−0.0" possible, empty instead of "n/a"); bar segments and heat rows use the static NA, EU, AP, UK order
  (equal to the net-revenue order in all data); the combo's year sits centred under its months, its markers are filled, its legend is
  drawn with cards, CM % labels every point; the heatmap's line GM % is a bottom "GM %" row; native tooltips instead of the web's
  hover sentences on segments and heat cells; the combo ⓘ shows the period line only.
- **Performance (ADR-0017 § 7).** Desktop page-cold at the default view on the source machine: statement 6.4 s, Vitals 1.6 s, Analysis
  7.6 s, Profitability 2.4 s. The statement and the Analysis page are over the 5 s showcase target; Group + LTM + constant currency
  takes 17–19 s on the statement. A further step (constant-currency amounts precomputed) is open in rusloc/pnl. The Profitability
  rebuild of 2026-11-17 took that page from 5.4 to 3.5 s page-cold in a same-hour comparison on a slower machine state (table 3.2 s,
  heatmap 2.1 s, combo 1.4 s, bars 0.9 s).
- **USER click-test pending.** Page tabs, panels, bookmarks (Period / Versions / Company / Display / Filters / How to read / Reset),
  the variance filter and the two tooltip pages need a click-through in Desktop before publishing. On Profitability: the four ⓘ
  hovers, How to read, the alignment of the Δ header card over the table, Commerce Cloud (service lines in the heatmap), and a custom
  range longer than 12 months (the combo switches to quarters).
- **Parquet DECIMAL columns.** The amounts are stored as Parquet DECIMAL, not double, so the values are exact and match the lakehouse.
  If Desktop rejects a DECIMAL column on refresh, report it back. The fix is a regenerated file set, not a model edit.
- **Publishing.** In the Power BI service, a model that reads local files needs an on-premises data gateway for scheduled or manual
  refresh. Publish after the Desktop refresh and do not schedule a refresh. The data is static.
- **Repo drift.** The repo model is maintained in rusloc/pnl. Any change there means re-copy and reset `DataFolder` to the placeholder.
- `_meta_refresh` shows the time of the last refresh (`NOW()`).
- `.platform` files keep the repo's `logicalId` values. They only matter if a workspace is connected to Git; give them new GUIDs if
  both copies ever share one workspace.
- No RLS roles (deferred in the source repo).

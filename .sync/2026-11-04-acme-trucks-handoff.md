from rusloc/pnl (bip, for the main agent) · to <pickup AI agent> · 2026-11-04 · status: ready

2026-11-09: the JS flavour is built in rusloc/pnl (`js-trucks/`) and issued as `acme-trucks/js-app/` after the parity gate (1,649 rows, 0 gaps). The Power BI pack is unchanged.

# ACME Trucks — hand-off pack (Power BI)

ACME Trucks is the second Power BI showcase report in rusloc/pnl. It sits outside the P&L spec, so no requirement IDs apply. It shows
how haul trucks' total time splits into work and time losses, plan against fact, as a share of total time, plus two volume KPIs
(performance per truck in m³/h, mass loaded per truck in thousand m³). The report has two report pages and a tooltip page:

- **"Time utilization"** (`ReportSectionbdcfb2b87f3167b0ec4f`) is the redesign and opens first. It has 6 dropdown slicers, a Reset
  button (bookmark `bm_reset`), 4 KPI tiles (Plan · Fact · Δ pill) and the "Time structure" waterfall table.
- **"Time util (original)"** (`time_util_original`) is the original design, kept for comparison. Since 2026-11-04 it shows **the
  same numbers** as the redesign under the same filters (the redesign page = the original page). In PBIR it is set to
  `HiddenInViewMode`: Desktop shows the tab, the published report's reading view does not.
- **"Time structure tooltip"** (`tt_time_structure`, hidden) shows the category, Plan %, Fact % and Δ pp when you hover a table row.

This pack is the entry point. It copies the repo's working tree as of 2026-11-04, the USER's final state, which includes the
uncommitted page-parity fix of that day. Nothing here carries a secret, key, connection string, or workspace or tenant ID.

## What the pack holds

| Path | What |
|---|---|
| `acme-trucks/power-bi/` | `Trucks.pbip` + `Trucks.Report/` (PBIR) + `Trucks.SemanticModel/` (TMDL) + `tests/` (6 files) + `README.md` (pack README, with the repo README below it). Only difference from the repo: `DataFolder` = `"<folder holding the Parquet files>"` in `definition/expressions.tmdl` |
| `acme-trucks/js-app/` | Standalone Next.js app of the page "Time utilization" (1440 × 810), with prebuilt `public/data/` (343 kB, pre-aggregated from the live extract, readable on the public page) and the pinned-value fixture. Start at its `README.md` |
| `acme-trucks/data/` | The 14 Parquet files (7.9 MB, Russian file names such as `КРВ АС.parquet`), byte-identical to the repo. **Local only, not in git:** `.gitignore` keeps `.sync/*/data/` out (USER 2026-10-30). The canonical, committed copy is `pbi-report/ACME Trucks/data/` in rusloc/pnl. This is the live extract, the only source of these exact rows; the generator below builds a synthetic twin, not a copy |
| `acme-trucks/docs/` | `trucks-how-it-works.md` (how the page works, data source, speed), `trucks-report-redesign.md` (build record, §0 wins over the older prep), `trucks-kpi-mismatch-2026-11-04.md` (today's fix), `trucks-measure-dictionary.md` (every measure: name, plain words, DAX), `Design guide/` (the HTML mockup `Main.dc.html` + `support.js` + `vendor/` React; serve the folder, e.g. `python -m http.server`, and open `Main.dc.html`) |
| `data-gen/acme-trucks/` | Not in `acme-trucks/`: ginee's generator of the synthetic twin (seed 20261104), `checks/verify.py` (149 checks), `checks/control_totals.csv` (620 rows) and the data README (the contract). Repo home `data/acme_trucks_dummy_data/`. See Data generator below |

The docs are copied as they are, so their paths name files in rusloc/pnl (`pbi-report/ACME Trucks/…`, `docs/…`).

**Two data options for `DataFolder`:**

- **(a) `acme-trucks/data/`** = the live extract. It matches the tests in `tests/*.dax` as they are. Local only (not in git); the
  committed copy is `pbi-report/ACME Trucks/data/` in rusloc/pnl.
- **(b) The generated set** (`data-gen/acme-trucks/`, output `acme-trucks\parquet`) = synthetic, from a committed generator. The
  tests need re-basing (bip) before they can run on it.

## Data generator (synthetic twin)

Data generator: `.sync/data-gen/acme-trucks/` rebuilds the 14 Parquet files the Trucks PBIP reads. In `.sync\data-gen`, run `.venv\Scripts\python.exe -I acme-trucks\generator\generate.py` (seed 20261104, ~20 s; writes `acme-trucks\parquet`), then `acme-trucks\checks\verify.py` (149 checks, exit 1 on failure), and point `DataFolder` at that folder. File names, columns, Arrow types and code domains match the live extract, but every row is synthetic: new loader codes and attributes, clean integrity, exact totals. At the tested grain (week 10 · Month · Weighted · Trucks + On spot) it shows truck loading 43.0 / 45.0 %, effective work 54.0 / 51.5 %, performance 882 / 783 m³/h and mass 7,300 / 7,100 thousand m³ (plan / fact). The extract shows 42.9 / 45.3, 53.7 / 51.6, 847 / 762 and 7,156 / 7,029. The Power BI tests in the pack (`tests/*.dax`) pin the live extract's numbers and need re-basing (bip) before they can run on the synthetic set, for example from the `kpi` rows of `acme-trucks/checks/control_totals.csv`.

Pinned live-extract values at that grain (plan / fact, `tests/page-parity.dax` filter set S1): truck loading 42.92 / 45.35 %,
effective work 53.69 / 51.56 %, performance 847 / 762 m³/h, mass loaded 7,156 / 7,029 thousand m³.

## How to open

1. Use a current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report. On an older build,
   turn on the PBIP, TMDL and PBIR options under Options > Preview features.
2. Open `acme-trucks/power-bi/Trucks.pbip`. The tables are empty because no `cache.abf` ships; cancel any refresh prompt. Set
   Transform data > Manage parameters > **DataFolder** to the full path of a folder that holds the 14 Parquet files, without a
   trailing backslash: `acme-trucks\data` if you have this local copy, or `pbi-report\ACME Trucks\data` from a clone of
   rusloc/pnl. Close & Apply, then Home > Refresh.
3. **Culture.** The model's `culture` and `sourceQueryCulture` are ru-RU, as the source model had them. Keep them as they are. The
   report copy and the object names are English. Filters and slicer values use Russian data codes (`dim_loader[is_included] =
   "да"`, week labels like `9 (25.2-3.3)` = day.month). The DAX tests use `,` as the separator and `.` as the decimal point. If
   Desktop shows locale separators, switch to standard DAX separators under Options > Regional settings.
4. Publish from Desktop after the refresh. The service cannot refresh this source without an on-premises gateway, so the
   published report is a snapshot. A Desktop save writes your machine path into `expressions.tmdl`: put the placeholder back
   before you commit anything in `.sync/`.

## How to verify

1. `powerbi-report-author validate ".sync/acme-trucks/power-bi/Trucks.pbip"` must report 0 errors and 0 warnings (bip, 2026-11-04:
   0 / 0 on both the pack and the repo PBIP).
2. After the refresh, run each test file in DAX query view. Every row of every result tab must show `_pass = TRUE`:

   | File | Tabs | Expected rows, all `_pass` TRUE |
   |---|---|---|
   | `tests/page-parity.dax` | 2 | 40 |
   | `tests/time-util.dax` | 8 | 413 |
   | `tests/time-util-original.dax` | 2 | 194 |
   | `tests/baseline-live-en.dax` | 7 | 536 |

   bip got these counts on 2026-11-04 on a scratch copy of the repo PBIP, fully refreshed from the same Parquet files.
   `baseline-live.dax` and `baseline-live.csv` record the former live model, which used Russian object names. They are not run on
   this PBIP.
3. The data: compare the SHA-256 of every Parquet file with the hash list in `acme-trucks/power-bi/README.md` (§ Parquet hash list).
   The list matches both the pack copy and `pbi-report/ACME Trucks/data/`. In PowerShell, run
   `Get-FileHash -Algorithm SHA256 *.parquet`; in bash, run `sha256sum *.parquet`.

## Model facts

- Import model, TMDL, compatibility level 1606, culture ru-RU. It has 14 data tables: 8 read Parquet (`dim_date`, `dim_loader`,
  `dim_mine`, `fact_time_actual`, `fact_time_plan_week`, `fact_time_plan_month`, `fact_rock_mass`, `fact_interval`), and 6 are built
  in Power Query (`dim_time_category`, `bridge_plan_time_category`, `bridge_fact_time_category`, `dim_loader_work_type`,
  `param_plan_type`, `param_calculation`). On top of those it has 3 Desktop auto date tables and the measure table `_measures`, and
  18 relationships. Six of the 14 Parquet files are source exports that no table reads.
- **78 measures** in `_measures`, in four folders: `1 KPI` (13), `2 Time Structure` (10), `3 Design` (9: header, SVG bars and pills,
  colours), `9 Engine` (46).
- **`_KPI Noise` = 1 (USER decision, 2026-11-04).** The live source model multiplied the two volume KPIs by an inline
  `RANDBETWEEN ( 10, 100 )` placeholder. The redesign had kept it on 2026-10-21 (decision 6) and moved it into `_KPI Noise`. Every
  card and every Δ drew its own random factor (Performance drew it twice, so 100 to 10,000). As a result, the two pages showed
  different numbers for the same measures, and a Δ pill could not equal Fact − Plan. With `1`, both pages agree, the Δ pills
  equal Fact − Plan exactly, and the volumes are the real noise-free values. The `* [_KPI Noise]` references stay, so the fix is
  one line. On the same day the USER also synced the redesign's Week, Office, Plan type, Work type and Loader slicers to the
  original page's groups (Calculation stays ungrouped on both), and added the original page's `dim_loader[contractor]` = blank
  page filter to the redesign. No data changed. Record: `acme-trucks/docs/trucks-kpi-mismatch-2026-11-04.md`.
- Saved state of both pages: week 9 (25.2-3.3) · Month plan · Weighted · Trucks + On spot. Reset filters (on the redesign page) sets
  all weeks · Month · Weighted · Trucks + On spot.

## Design guide

`acme-trucks/docs/Design guide/Main.dc.html` is the reference mockup for the redesign page (a 1440 px artboard; its README calls it a
reference mockup whose colours, sizes and spacing live in the inline styles; serve the folder and open `Main.dc.html`). The build record §0 (`acme-trucks/docs/trucks-report-redesign.md`) lists where the PBIR differs from the
mockup and why, for example native dropdown slicers instead of the popover chips.

## Open / not built

- The USER still has to do the first open in Desktop, click-test Reset filters, hover-check the tooltip page, and save once so
  Desktop rewrites `semanticModelDiagramLayout.json`.
- Not published, no workspace, no embed. Publishing and the embed hand-off are still to come (build record step 12).
- Speed: the redesign page takes 1.2–1.3 s against 0.7 s for the old design on the same local engine, and `wf_table` is the
  bottleneck (`acme-trucks/docs/trucks-how-it-works.md` §6). A `wf_table` performance fix was offered and not applied. The old live version
  was never timed.
- Small items: the original page still shows the display name "Произв-сть", and a divider line can clash with a long caption
  there. The Calculation slicer is not synced between the pages (syncing it would mean editing the original page). The docs say
  "two visible pages" while the original page is `HiddenInViewMode` in PBIR. That is a wording point, and the pack keeps both as
  they are.

## Do not change

- **The data.** Do not edit or re-export the 14 Parquet files of the live extract, and do not overwrite them with the generated
  set (that one goes to its own folder). Do not change their names, or the Power Query and partitions that read them. The hash
  list is the check for the extract.
- **The original page** `time_util_original`, which is the comparison reference. Leave its files, filters and sync groups untouched.
- `_KPI Noise` = 1, the sync groups and the contractor page filter, because `tests/page-parity.dax` depends on them.
- `name`, `lineageTag` and `queryRef` values, and the ru-RU culture settings.
- Any change to the report belongs in `pbi-report/ACME Trucks/` in rusloc/pnl first. The pack is then re-copied; it is never the
  place where the change is made.

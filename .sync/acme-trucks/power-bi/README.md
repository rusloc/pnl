from rusloc/pnl (bip, for the main agent) · to pickup AI agent · 2026-11-04 · status: ready

**The data sits beside this folder, and only on the source machine.** The model reads 8 of the 14 Parquet files in `../data/`.
That copy is local only: `.gitignore` keeps `.sync/*/data/` out of git (USER 2026-10-30). The canonical, committed copy is
`pbi-report/ACME Trucks/data/` in rusloc/pnl. Check either copy against the hash list below. The pack ships no model cache (`.pbi/cache.abf`), so the tables stay empty until the
first refresh.

**Publish after the Desktop refresh; no refresh in the service.** The source is local Parquet, which the service could read only
through an on-premises gateway, so the published report is a snapshot of the data. `DataFolder` ships as a placeholder. No
workspace, dataset, tenant or capacity IDs belong in `.sync/`.

**Data generator:** `../../data-gen/acme-trucks/` (seed 20261104, 149 checks; see `../../2026-11-04-acme-trucks-handoff.md` § Data generator)
builds a synthetic twin. Two data options: (a) `../data/` = the live extract, matches the tests, local only; (b) the generated set =
synthetic, committed generator, the tests need re-basing (bip) before they run on it.

# ACME Trucks — Power BI pack (PBIP + local Parquet)

This is a copy of the repo's working tree `pbi-report/ACME Trucks/` as of 2026-11-04, including the uncommitted page-parity fix of that
day (`_KPI Noise` = 1, synced slicers, contractor = blank page filter). The USER confirmed that state as final. The only change in
this copy is the `DataFolder` value: the repo path is replaced by a placeholder, and a `///` comment is added. Data, names and
numbers are illustrative; the codes inside the data stay Russian, as in the source.

## What is here

| Path | What |
|---|---|
| `Trucks.pbip` | Open this in Power BI Desktop |
| `Trucks.SemanticModel/` | TMDL, Import, compatibility level 1606, culture ru-RU. 14 data tables (8 read Parquet; `dim_time_category`, the two bridges, `dim_loader_work_type`, `param_plan_type` and `param_calculation` are built in Power Query) + 3 Desktop auto date tables + `_measures` (78 measures: 13 in `1 KPI`, 10 in `2 Time Structure`, 9 in `3 Design`, 46 in `9 Engine`), 18 relationships |
| `Trucks.Report/` | PBIR (`definition.pbir` 4.0). Page `ReportSectionbdcfb2b87f3167b0ec4f` "Time utilization", the redesign (1920 × 1080, FitToPage, opens first, 53 visuals). Page `time_util_original` "Time util (original)", the original design kept for comparison (1920 × 1080, 31 visuals, `HiddenInViewMode`). Hidden tooltip page `tt_time_structure` (280 × 124). Bookmark `bm_reset`, theme `acme-trucks-theme.json`, `trucks-logo.svg`, `trucks-axis.svg` |
| `tests/` | DAX query view tests (see How to verify), plus the live-model baseline `baseline-live.dax` / `baseline-live.csv` (Russian object names of the former live model; kept as the record, not run on this PBIP) |
| `../data/` | The 14 Parquet files (7,868,447 bytes; local only, see above) |
| `../docs/` | How the page works, the build record, the 2026-11-04 KPI fix record, the measure dictionary, and `Design guide/` (the HTML mockup the redesign follows) |

## How to open

1. Use a current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report. On an older build,
   turn these on under Options > Preview features (Power BI Project save option, TMDL, PBIR).
2. Open `Trucks.pbip`. The tables are empty; if Desktop offers to refresh, cancel. Go to Transform data > Manage parameters and set
   **DataFolder** to the full local path of the folder that holds the Parquet files, without a trailing backslash (for example
   `<repo root>\.sync\acme-trucks\data` or `<repo root>\pbi-report\ACME Trucks\data`). The shipped value is the placeholder
   `<folder holding the Parquet files>`, so a refresh fails until you change it. Close & Apply, then Home > Refresh.
3. **ru-RU culture.** The model's `culture` and `sourceQueryCulture` are ru-RU, as the source model had them. Keep them. Slicer
   values and filters use Russian data codes: `dim_loader[is_included] = "да"`, and week labels like `9 (25.2-3.3)` (day.month).
   The report copy and the object names are English. The DAX tests use `,` as the argument separator and `.` as the decimal
   point. If your Desktop shows locale separators (`;`), switch DAX separators to standard under Options > Regional settings
   before you paste a test.
4. Check (How to verify), then publish from Desktop (Home > Publish).
5. Desktop writes its own `.pbi/localSettings.json` and `.pbi/cache.abf`, which git ignores. A save also writes your machine path
   into `definition/expressions.tmdl`, so put the placeholder back before you commit anything in `.sync/`.

## How to verify

1. `powerbi-report-author validate "Trucks.pbip"` must report 0 errors and 0 warnings (bip got 0 / 0 on this pack, 2026-11-04).
2. After the refresh, run each file in DAX query view. Every row of every result tab must show `_pass = TRUE`. These are the
   results bip got on 2026-11-04 with the same data and model (a scratch copy of the repo PBIP, full refresh from `data/`):

   | File | Tabs | Rows, all `_pass` TRUE | Checks |
   |---|---|---|---|
   | `tests/page-parity.dax` | 2 | 40 | The redesign page shows the original page's numbers: 12 KPI values under 3 filter sets, the four tiles pinned, Δ = Fact − Plan |
   | `tests/time-util.dax` | 8 | 413 | Redesign page: waterfall (default, week 9, chain), KPI tiles vs table rows, Δ colour rule, `_KPI Noise` = 1, header context and the contractor filter, tooltip page |
   | `tests/time-util-original.dax` | 2 | 194 | The original page in its saved context vs the live baseline |
   | `tests/baseline-live-en.dax` | 7 | 536 | Parity with the former live model: row counts, waterfall, KPI units |

3. Both pages show the same four KPI values under the same filters. `tests/page-parity.dax` filter set S1 (week 10 (4.3-10.3) ·
   Month · Weighted · Trucks + On spot) pins them on the live extract, plan / fact: truck loading 42.92 / 45.35 %, effective work
   53.69 / 51.56 %, performance 847 / 762 m³/h, mass loaded 7,156 / 7,029 thousand m³. The file itself is saved on week 9 (25.2-3.3).
4. Data: hash the Parquet files and compare them with the list below. In PowerShell, run
   `Get-FileHash -Algorithm SHA256 *.parquet` in the data folder; in bash, run `sha256sum *.parquet`.

### Parquet hash list (SHA-256; identical for `../data/` and `pbi-report/ACME Trucks/data/`, checked 2026-11-04)

| File | Bytes | SHA-256 | Read by |
|---|---|---|---|
| `AREA_DIM.parquet` | 1,046 | `adaa3d0060b3350372fa05f23892c29ddedaedb6a5ea26f0e5f25be7ea51cc1a` | — |
| `Calendar.parquet` | 11,048 | `17922142997e624572cb67b442e91981da04235cee6c88a2066754dc616b58e0` | `dim_date` |
| `FIELD_DIM.parquet` | 3,125 | `69eaee647f71dcede09db6939db99336b421adc9d02747c9f3cc1b7bbd69f354` | — |
| `OFFICE_DIM.parquet` | 1,508 | `be9c061b921ada64dcf564ae6b8f551f3acc26b0b2fbff03d30f75cf568e2716` | — |
| `intervals.parquet` | 5,724 | `24027ee4a30f360b8a7e6ed64275c7d85e09d911b9b7aec78e1dad3b9e1f1843` | `fact_interval` |
| `Интервалы.parquet` | 4,601 | `f9c9e23586c205fdb899ca6afd6be7b5fc994b534bc40611a689f092d17d3af8` | — |
| `КРВ АС.parquet` | 4,986,855 | `c932f6f310541c45c7cee88ea318c3cc882e3985bd6fac4a0fc8fb401b64a15f` | — |
| `ПФ КРВ.parquet` | 700,182 | `444badeb9d7d6d47c261c3faf76f147ddcc0d042cb3aa077a9dcf883e6ac39f7` | `fact_time_actual` |
| `ПФ Отчет о рейсах.parquet` | 645,452 | `c928f98ad55b01bba5a2f1cb58534da02432c8e4d630aca396233243a3f9a6ce` | — |
| `ПФ объемы.parquet` | 306,874 | `5151f7b1ae41d90606212d7ea9041f3d730c4f3486a09c860f4d5b3367aef3e5` | `fact_rock_mass` |
| `План_2.parquet` | 794,435 | `726750c051dafe718e8e6ba3d211e40206f2347acc11673312e5da000ed4ec96` | `fact_time_plan_week` |
| `План_2_МЕС.parquet` | 396,002 | `924723caf03b3d11c5217dce161aaa72ecd25d85d78c9df354c7fd7245dfae9f` | `fact_time_plan_month` |
| `Справочник ЭКС.parquet` | 10,575 | `20fe43800a50d995818de3285691865a924503bd9a34e493951e01108f680b79` | `dim_loader` |
| `Справочник разрезов.parquet` | 1,020 | `856a3b6efc2f3e8b7e24e59ddd64a6f42039d554580f5972753df8fbc8cc2503` | `dim_mine` |

The six files marked "—" are exports of the source that no table reads. They ship because the repo's `data/` folder holds them.

## What changed vs the repo copy

| Where | Repo (`pbi-report/ACME Trucks/`) | This pack |
|---|---|---|
| `Trucks.SemanticModel/definition/expressions.tmdl`, `DataFolder` | Absolute repo path of `pbi-report\ACME Trucks\data` | Placeholder `<folder holding the Parquet files>` and a `///` comment that points to `acme-trucks/data` or `pbi-report/ACME Trucks/data` |
| `README.md` | Repo README | This file: the pack sections first, then the repo README below |
| Moved | `data/` → `../data/`, `Design guide/` → `../docs/Design guide/` | Byte-identical copies |
| Excluded | `__backup__/`, `backup/` (the original `.pbix`), `.claude/`, `.pbi/` (local settings and `cache.abf`) | — |

`diff -rq` of the repo folder against this folder, with the excluded and moved items left out, lists only `expressions.tmdl` and
`README.md` (bip 2026-11-04).

---

# Repo README (report notes; paths name files in rusloc/pnl)

# ACME Trucks (Power BI)

The second Power BI showcase report in this repo. It is outside the P&L spec, so no requirement IDs apply. It shows how haul
trucks' total time splits into work and time losses, plan against fact. The model and report are in English; data codes stay
as they are in the source.

## Open

1. Open `Trucks.pbip` in Power BI Desktop (PBIP and TMDL / PBIR preview features on).
2. The Import model reads Parquet files from the Power Query parameter `DataFolder`. The default is
   `C:\__PBI\PNL\pbi-report\ACME Trucks\data`. On another machine, set `DataFolder` (Transform data → Edit parameters) to that
   machine's copy of `data/`.
3. Refresh. `cache.abf` is not in git, so a fresh clone opens with empty tables until the first refresh.

## Pages

| Page | Folder | What it is |
|---|---|---|
| Time utilization | `ReportSectionbdcfb2b87f3167b0ec4f` | The redesign (first tab): 6 dropdown slicers, 4 KPI tiles, the "Time structure" waterfall table |
| Time util (original) | `time_util_original` | The original design, kept for comparison. It shows the same numbers as the redesign |
| Time structure tooltip | `tt_time_structure` | Hidden tooltip page of the waterfall table |

Both visible pages carry the report filter `dim_loader[is_included] = "да"` and the page filter `dim_loader[contractor]` =
blank. Their Week, Office, Plan type, Work type and Loader slicers are synced. Calculation is not synced, so set it on each page.

How the page works: `docs/ADD/features/trucks-how-it-works.md`. Build record: `docs/ADD/features/trucks-report-redesign.md`.
Measures: `docs/model/trucks-measure-dictionary.md`.

## Tests

Run each file in Desktop → DAX query view after a refresh. Every row of every result tab must show `_pass = TRUE`.

| File | Checks |
|---|---|
| `tests/baseline-live-en.dax` | Parity with the live source model (row counts, waterfall, KPI units) |
| `tests/time-util.dax` | The redesign page: waterfall, KPI tiles, Δ colours, noise off, header, tooltip page |
| `tests/time-util-original.dax` | The original page in its saved context |
| `tests/page-parity.dax` | The redesign page = the original page, 12 KPI values under 3 filter sets; the four tiles pinned, Δ = Fact − Plan |

After every PBIR edit, run `powerbi-report-author validate "pbi-report/ACME Trucks/Trucks.pbip"`. The target is 0 errors and
0 warnings.

## Change log

| Date | Change |
|---|---|
| 2026-11-04 | The redesign page now matches "Time util (original)" under the same filters. `_KPI Noise` = 1 (was `RANDBETWEEN ( 10, 100 )`), the 5 slicers are synced with the original page, and the contractor = blank page filter is added. New test `tests/page-parity.dax`. Data unchanged. Record: `docs/ADD/features/trucks-kpi-mismatch-2026-11-04.md` |

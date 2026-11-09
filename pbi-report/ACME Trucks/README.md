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

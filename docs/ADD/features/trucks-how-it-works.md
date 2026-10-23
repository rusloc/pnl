# ACME Trucks — how the "Time utilization" page works

> Report `pbi-report/ACME Trucks/Trucks.pbip` (2026-10-23, bip). One visible page, "Time utilization", plus a hidden tooltip page.
> Measure details and DAX: [trucks-measure-dictionary.md](../../model/trucks-measure-dictionary.md). Build record and design
> decisions: [trucks-report-redesign.md](trucks-report-redesign.md) §0.

## 1. What the page answers

How the haul trucks' total time splits into work and time losses, plan against fact, as a share of total time. The page reads
top to bottom: filters, four KPI tiles, the "Time structure" waterfall table, a footnote on the colours.

## 2. Visuals

| Block | Visual(s) | Shows | Fed by |
|---|---|---|---|
| Header | `hdr_band` shape, `hdr_logo` image, `hdr_title` text box, `hdr_ctx` card | Title and the current context, e.g. "Week 5 (2023) · Linear calculation · Month plan" | `_Header Context` (reads the selected weeks, calculation and plan type) |
| Filter bar | 6 dropdown slicers + `btn_reset` button | See §4 | slicer columns, bookmark `bm_reset` |
| KPI tile "Truck loading" | `kpi_tl_*`: frame, title, unit, Plan card, Fact card, Δ pill card | Truck-loading share of total time | `KPI Truck Loading Plan %`, `… Fact %`, `… Δ pp` |
| KPI tile "Effective work time" | `kpi_ew_*` | Effective-work share of total time | `KPI Effective Work Plan %`, `… Fact %`, `… Δ pp` |
| KPI tile "Performance per truck" | `kpi_pf_*` | m³ per truck-loading hour | `Performance per Truck Plan`, `… Fact`, `KPI Performance per Truck Δ` |
| KPI tile "Mass loaded per truck" | `kpi_rm_*` | thousand m³ loaded into trucks | `Rock Mass by Truck Plan`, `… Fact`, `KPI Rock Mass by Truck Δ` |
| Time structure | `wf_table` (one table), `wf_axis_plan` / `wf_axis_fact` images (0 / 50 / 100 % axis), `wf_legend`, `wf_title`, card shapes | One row per time category, from Total time down to Truck loading: plan bar, plan %, fact bar, fact %, Δ pill | `dim_time_category[category_name]`, `WF Plan Bar`, `WF Plan %`, `WF Fact Bar`, `WF Fact %`, `WF Δ Pill` |
| Footnote | `footnote` text box | Colour rule of the Δ pills | — |

The Δ pill colour on each KPI tile comes from rules on its Δ measure (blue = favourable, orange = unfavourable).

## 3. Key measures in plain words

- **Time Share Plan % / Time Share Fact %**: hours of a category divided by total hours, plan or fact. "Linear" sums the hours;
  "Weighted" averages per loader, weighted by bucket volume. Plan comes from the week or the month plan (plan type switch).
- **Time Share Δ**: fact share minus plan share. `WF Δ pp` and the KPI `… Δ pp` measures show it × 100, in percentage points.
- **Subtotals and losses**: four rows are subtotals (Total time, Ready for work, Effective work time, Truck loading,
  `_WF Is Subtotal` = 1). Every other row is a time loss that floats between two subtotals, which gives the waterfall shape.
  `_WF Plan/Fact Subtotal` is a subtotal bar's length, `_WF Plan/Fact Loss` a loss bar's length and `_WF Plan/Fact Base` where the
  loss bar starts.
- **Where SVG comes in**: `WF Plan Bar`, `WF Fact Bar` and `WF Δ Pill` build a small SVG picture as text
  (`data:image/svg+xml;utf8,<svg …>`). Their data category is Image URL, so the table draws the picture instead of the text. All
  three are 594 × 24 px, the table's image box, so Power BI does not centre or shrink them.
- **KPI noise**: the two volume tiles multiply by `_KPI Noise` (`RANDBETWEEN ( 10, 100 )`), a placeholder kept on USER request. The
  numbers change on every refresh of a visual; change the body to `1` to remove it.

## 4. Slicers and filters

| Filter | Column | Selection | Effect |
|---|---|---|---|
| Week | `dim_date[week_label]` | single week or Select all | Period for every visual |
| Office | `dim_loader[office_name]` | multi | Loaders of the chosen offices |
| Plan type | `param_plan_type[plan_type_name]` | exactly one: Month / Week | Which plan the plan measures read |
| Calculation | `param_calculation[calculation_name]` | exactly one: Linear / Weighted | How hours are added up (§3) |
| Work type | `dim_loader_work_type[work_type_name]` | multi, no Select all | Loader work schemes (default Trucks + On spot) |
| Loader | `dim_loader[loader_name]` | multi, with search | Single loaders |

- Fixed filters: report filter `dim_loader[is_included] = "да"`; on the table only, `is_shown = "1"`, `is_included = "да"` and
  category code not blank (the rows of the waterfall).
- **Reset filters** runs bookmark `bm_reset` (data only, the 6 slicers): all weeks, all offices and loaders, Month plan, Weighted,
  Trucks + On spot. The file itself currently opens with Week 5 and Linear, the state it was last saved in.
- Hovering a table row shows the tooltip page `tt_time_structure` ("Time structure tooltip", 280 × 124, hidden): category name,
  Plan share, Fact share and Δ fact − plan in pp (`_TT Category`, `WF Plan %`, `WF Fact %`, `WF Δ pp`). It replaced the default
  tooltip, which printed the raw SVG text of the bar and pill columns.

## 5. Data source

- Import model `Trucks.SemanticModel`. Power Query reads local Parquet files from the folder in parameter `DataFolder`
  (`C:\__PBI\PNL\pbi-report\ACME Trucks\data`): `Calendar` → `dim_date`, `Справочник ЭКС` → `dim_loader`, `Справочник разрезов` →
  `dim_mine`, `ПФ КРВ` → `fact_time_actual`, `План_2` / `План_2_МЕС` → `fact_time_plan_week` / `_month`, `ПФ объемы` →
  `fact_rock_mass`, `intervals` → `fact_interval`.
- `dim_time_category`, `param_plan_type`, `param_calculation` and the two bridge tables are built in the model (M tables and DAX).
- On another machine, point `DataFolder` at that machine's copy of `data/` and refresh. Partitions and `DataFolder` are ginee's lane.

## 6. Speed: old vs new

Measured 2026-10-23 by bip on this machine (Power BI Desktop, own instances, the USER's instance untouched).

**What was compared.** "Old" = the original "Time util" page (two bar-chart waterfalls, three label tables, four cards,
six list slicers: the design in `backup/Trucks.pbix`) on the exported Import model before the rename; that model returns the live model's numbers
(`tests/baseline-live.dax` 591/591). "New" = `Trucks.pbip`. Both models ran locally, refreshed from the same Parquet files, so
this compares the page designs on the same engine. The live old version (`backup/Trucks.pbix` against the "Showcase" service
model) was **not** timed: see the caveat below.

**How.** For each filter state, the slicers were set in the PBIR, the engine cache was cleared and Desktop re-rendered the page
while a server trace recorded every visual query. "Desktop" = first query start to last query end in that render (one run).
"Replay" = the same queries sent again at once after a cache clear, median of 5 runs. Times are server (DAX) time; Performance
Analyzer would add the visual display time on top.

| Scenario | Old: Desktop | Old: replay | New: Desktop | New: replay | Slowest visual, old → new |
|---|---|---|---|---|---|
| S1 default (Week 5, Month, Linear, Trucks + On spot) | 0.87 s | 0.73 s | 1.47 s | 1.23 s | Plan waterfall 0.62 s → table 1.21 s |
| S2 + office K3 | 0.99 s | 0.66 s | 1.77 s | 1.35 s | 0.52 s → 1.08 s |
| S3 all weeks | 0.77 s | 0.66 s | 1.44 s | 1.16 s | 0.59 s → 1.08 s |
| S4 week 9, Weighted | 1.00 s | 0.85 s | 1.85 s | 1.29 s | 0.61 s → 1.22 s |

Per visual, S1 (cold, each query alone, median of 5; Desktop run in brackets):

| Old page | ms | New page | ms |
|---|---|---|---|
| Plan waterfall (bar chart) | 618 (851) | Time structure table | 1,213 (1,238) |
| Fact waterfall (bar chart) | 464 (408) | 12 KPI value cards, slowest | 654 (266) |
| Plan % labels (table) | 365 (202) | 12 KPI value cards, sum | 2,629 |
| Fact % labels (table) | 311 (122) | Header context card | 133 (50) |
| Δ labels (table) | 397 (255) | | |
| 4 KPI cards, slowest / sum | 261 / 954 | | |
| 6 slicer lists, slowest | 245 (96) | | |

**Reading.** The new page needs about 1.2–1.3 s of server time per filter change, the old one about 0.7 s. The whole gap is the
time-structure table: one query computes plan and fact for every row (plan bar + % 0.63 s, fact bar + % 0.43 s, pill 0.32 s,
1.1 s together), while the old page split the same work over five visuals whose queries ran in parallel. A tooltip hover adds
four small queries, 0.13–0.30 s each the first time, cached after. Ways to win the time back (not done): reuse the share
calculations across the bar, % and pill measures, or split the table into a plan table and a fact table.

**Caveats.** Old live = a service model (network, shared capacity) and new = local Import, so the USER's real old numbers will be
higher than the old column here. The old page also kept the contractor = blank page filter (less data) and shows 6 slicer lists
that re-query on every change; the new page has 12 KPI cards instead of 4. Single machine, single day.

**Old live version, still to measure (USER).** Desktop's live connection sends its queries straight to the service, so no local
trace exists, and Performance Analyzer needs the Desktop window in front (bip does not take focus from the USER). The `.pbix` opened
and connected without a sign-in prompt. Steps: open `backup/Trucks.pbix` → View → Performance analyzer → Start recording → set S1
to S4 in turn (the old Week slicer lists weeks under a hierarchy; Plan type MONTH; Calculation Linear / Weighted; Office K3) and
press Refresh visuals after each → Export → put the JSON in `pbi-report/ACME Trucks/tests/` for bip to add to this table. Do the
same on `Trucks.pbip` for the visual display times.

# ACME Trucks — JS flavour (`js-trucks/`): contract for the "Time utilization" web app

> **DRAFT — projection state.** Written 2026-11-09 by archi (ADR-0016). This is the one document nerd builds from and hunter tests against. Nothing here changes the Power BI flavour, its data or its tests.
>
> **Precedence (highest first):** the PBIP as built on 2026-11-04 (`pbi-report/ACME Trucks/` — TMDL measures, page `ReportSectionbdcfb2b87f3167b0ec4f`, tooltip page `tt_time_structure`, bookmark `bm_reset`) for **numbers, filter semantics, blank handling and Reset** → `pbi-report/ACME Trucks/Design guide/Main.dc.html` for the **look** wherever the PBIR deviated from it only because of a Power BI limit (§5.4 lists each) → `docs/ADD/features/trucks-report-redesign.md` §0 (build record) → `trucks-how-it-works.md`, `trucks-kpi-mismatch-2026-11-04.md`, `docs/model/trucks-measure-dictionary.md` (a guide; **the TMDL is the truth**). The tests `pbi-report/ACME Trucks/tests/` are the oracle (§7).
>
> **Precedents:** `docs/ADD/features/marketing-js-flavour.md` (template), `js-marketing/` (toolchain, layout, engine shape, URL state, CSP), ADR-0002, ADR-0012, ADR-0014, ADR-0015 as amended, `docs/design/parity-rules.md`.
>
> **Verified before writing:** the rules of §3 were recomputed by archi from the raw Parquet (`scratch`, read-only) and reproduce the pinned S1 tiles of `tests/page-parity.dax` (42.92 / 45.35 %, 53.69 / 51.56 %, 847.05 / 762.47 m³/h, 7,155.96 / 7,028.80 thousand m³) and the default-context rows 2 and 3 of `tests/time-util.dax` tab 1 to 1e-15.

## 1. App, toolchain, gate

| Item | Decision |
|---|---|
| Folder | `js-trucks/` at the repo root (DEC-005: one standalone Next.js app per showcase; no cross-app imports; `lib/data/parquet-columns.ts` and `scripts/csv.ts` vendored with a source header, as `js-marketing/`). |
| Toolchain | Pinned exactly as `js-marketing/package.json`: Next 16.4.2 (App Router, `cacheComponents`), React 19.3.1, TypeScript 5.9.3 strict (`noUncheckedIndexedAccess`), hyparquet 1.31.5, hyparquet-writer 0.17.0, Zod 4.6.7, Vitest 5.0.5, ESLint 9.39.5 + eslint-config-next 16.4.2, Prettier 3.9.10, Node ≥ 24 (native type stripping for `scripts/`). No new dependency without the main agent's yes. |
| Scripts | `build:data` (`node scripts/build-trucks-data.ts`: `../pbi-report/ACME Trucks/data/` → `public/data/`), `prebuild` = `build:data`, `build` = `next build`, `typecheck` = `next typegen && tsc --noEmit`, `lint` = `eslint`, `test` = `vitest run` (reads `public/data`, so `build:data` first), `format`. |
| Gate (every hand-back) | `npm run typecheck && npm run lint && npm test && npm run build` green; the pinned-value suite (§7.1) 100 % of rows; the byte budgets of §2.3 met (the build script fails otherwise). |
| Runtime | Static shell (`○ /`), everything in the browser: `public/data` + the engine. No API route, no server state, no backend, no DuckDB-wasm. Runtime hooks as `js-marketing/next.config.ts` (copied as is, including the fail-the-build check on a malformed origin): `EMBED_ALLOWED_ORIGINS` (server-side, comma-separated https origins → CSP `frame-ancestors`), `NEXT_PUBLIC_SITE_URL` (`metadataBase`, optional). No secrets, no IDs, no hard-coded domain. |
| Embed target | vosk.dev board **1440 × 810**, fixed (the PBI page is 1920 × 1080 FitToPage, so at the same board both flavours render the PBIR geometry × 0.75 — §5.2). Below 1200 px not optimised (horizontal scroll). |
| Theme | **Light only** (the PBIP and the mockup have none other). No `theme` URL key. |
| Culture | Source data is ru-RU: week labels `44 (29.10-4.11)` (d.m), category codes and the fixed-filter literals stay Cyrillic **inside the build and the manifest codes**; every string on the page is English (the model's `category_name`, `office_name`, `loader_name`, `work_type_name`, `plan_type_name`, `calculation_name`). Number formatting en-US (`1,234`, `.` decimal), minus U+2212. |
| A11y / motion | Every control keyboard-reachable; the pills always print the sign, so colour never carries the meaning alone (footnote); popovers: one open at a time, Esc / click outside / Done close, focus returns to the chip; `prefers-reduced-motion` honoured. |
| Performance | A filter change recomputes every number of the page in < 50 ms on the shipped data (≤ 2,756 loader-weeks per table; the weighted means are one pass over ≤ 131 loaders). First paint ≤ 900 kB of data (§2.3). |

## 2. Data plan

### 2.1 Rule

Every shown number is one of three things over the **window** (one business week or all weeks) and a **loader mask** (office · loader · work type · the fixed `is_included = "да"` and `contractor = blank`): a **sum** (hours of a category, rock mass), a **ratio of sums** (Linear shares, the KPI 3 share), or a **bucket-volume-weighted mean of per-loader ratios** (Weighted shares). Nothing reads below loader × week × time category, and the Week filter is "one week or all" (`s_week` is single-select with Select all). So `scripts/build-trucks-data.ts` pre-aggregates each fact to **loader × business week × time category** (wide: one column per category) and the engine only masks, sums per loader, takes ratios and weighted means. That is exact: sums commute with the week grouping; the weighted mean needs per-loader window sums, which are sums of the loader's week rows. Day grain would be needed only for a daily visual (none on the page) — ×7 rows, a build-script flag, reversal cost low.

**Bridges and derived columns are rebuilt in the build, not shipped:** `dim_time_category` (the M `#table`), `bridge_fact_time_category`, `bridge_plan_time_category`, `fact_time_actual[idle_name_for_op_2]`, `fact_time_plan_*[indicator_name_2]`, `dim_loader_work_type[work_type_code / work_type_name]`, `dim_loader[office_name / loader_name]`, `param_plan_type`, `param_calculation`. §2.2 and §3.2 give each rule; the build copies the literal tables **verbatim from the TMDL** (`Trucks.SemanticModel/definition/tables/*.tmdl`), never retypes them.

**Cyrillic stays inside the build.** Source file names (`ПФ КРВ.parquet`, `План_2.parquet`, `План_2_МЕС.parquet`, `ПФ объемы.parquet`, `Справочник ЭКС.parquet`, `Calendar.parquet`, `intervals.parquet`) and source column names appear only in `scripts/build-trucks-data.ts` (one `SOURCE` map, each entry `{ file, columns }` next to the model's English name from the TMDL `sourceColumn`). Shipped files, the manifest and the engine use the model's English names; the only Cyrillic that ships is **data values the page needs as codes** (`category_code`, the `is_included` literal `"да"`), as in the model.

### 2.2 Source table → shipped form

| Source (model table ← file, rows) | Ships as | Rule |
|---|---|---|
| `dim_date` ← `Calendar.parquet` (156 days, 2022-10-29 … 2023-04-02) | `manifest.weeks[23]` | One row per `_dateSpanBiz` (= `week_label`): `week_ix` (0 … 22 in `_sortSpan` order), `week_label`, `sort_span`, `week_num` (`_weekNumBiz`), `week_start` / `week_end` (`_weekStartBiz` / `_weekEndBiz`, business week Saturday → Friday), `year` = year of `week_end` (so week 1 `31.12-6.1` is 2023 — `_Header Context` rule), `days` (dates in the calendar; week 14 has 2). Dates themselves are not shipped: the build maps every fact date to its week through this table and **fails if a fact / plan / rock date is outside the calendar** (none is today) |
| `dim_loader` ← `Справочник ЭКС.parquet` (168) | `manifest.loaders[131]` | Only loaders passing the **fixed filters** ship: `is_included = "да"` (report filter) **and** `contractor` blank (page filter) — 133 − 2. Per loader: `loader_ix`, `loader_name` (the TMDL `loader_name` SWITCH on `loader_name_dispatch`, copied verbatim — 168 rows, every included loader has one), `office_name` (the TMDL `office_name` SWITCH on `branch_name`: Кедровский K1 · Моховский M2 · Бачатский B1 · Калтанский K2 · Талдинский T1 · Краснобродский K3), `bucket_volume_m3` (`Объем ковша`, INT; 0 occurs), `work_type` (below). **Not shipped:** `loader_name_dispatch`, `branch_name`, `name`, `loader_number`, `comment`, `field_name`, the two trip / time-system names, `objrem_id` (the index replaces it) — nothing the page does not show |
| `dim_loader_work_type` ← `intervals.parquet` (891) | `loaders[*].work_type` | TMDL rule: `g = MAX(vehicle_group_code)` over the loader's `fact_interval` rows (`vehicle_export_code = objrem_id`); no rows → `"Undefined"`; `FORMAT(g, "###") = "1"` → `"On spot"`; `= "2"` → `"Trucks"`; otherwise (`g = 0`, `FORMAT` gives `""`) → **blank** (`null`). Today: 0 blank among the 131; 1 Undefined; the two contractor loaders are Undefined and already excluded. Work type is **per loader, not per month** (the calculated column has no date context) |
| `dim_time_category` (M `#table`, 31 rows) | `manifest.categories[31]` | `sort_order`, `category_code` (Cyrillic, as is), `category_name` (the TMDL SWITCH, English), `is_shown` (`"1"` / `"0"`), `is_included` (`"да"` / `"нет"`), `row_kind` = `subtotal` for `sort_order ∈ {1, 6, 24, 27}` else `loss` (`_WF Is Subtotal`). The waterfall shows the **19 rows** with `is_shown = "1"`, `is_included = "да"`, code not blank (visual filters of `wf_table`): 1 2 3 4 5 6 7 8 9 10 11 12 14 15 21 22 24 25 27 |
| `param_plan_type`, `param_calculation` | engine constants | `Month` ↔ `"Месяц"` (`plan_type_id` 1), `Week` ↔ `"Неделя"` (2); `Linear` ↔ `"Линейно"`, `Weighted` ↔ `"Взвешенно"`. The codes never reach the UI or the URL |
| `fact_time_actual` ← `ПФ КРВ.parquet` (203,867 rows = loader × day × idle name; 134 loaders, 2022-11-01 … 2023-03-26; `_active = 1` on every row) | **`time-week.parquet`** (loader × week) | Per row: `idle_name_for_op` → `idle_name_for_op_2` (TMDL SWITCH: `ktg` → КТГ, `kio` → КИО, `kfv` → КФВ, `Пересменка` → Пересменок, `Ожидание а/с` → Ожидание АС, `Авар. Прост.` unchanged) → `bridge_fact_time_category[fact_category → chart_category]` (22 rows; `Основная работа` → **Погрузка самосвалов**; `kio_adv`, `NULL` → `Не учитывать`) → `dim_time_category[category_code]`, **all three joins case-insensitive** (§3.2 rule R1). Σ `duration` (seconds) per loader × week × category into `sec_NN`; rows whose chart category is `Не учитывать` or has no `dim_time_category` row are **not summed but counted** in `n_rows` |
| `fact_time_plan_week` ← `План_2.parquet` (394,056 = loader × day × indicator; 133 loaders, 2022-11-01 … 2023-03-31) | **`plan-week.parquet`** (loader × week; lazy) | `indicator_name` → `indicatior_name_2` (TMDL: `КТГ план` → КТГ, `Проверка` → КФВ, else unchanged) → `bridge_plan_time_category[plan_category → chart_category]` (25 rows; `Переключение`, `Работа на другом поле`, `Орошение забоя` → **Прочие простои**; `Основная работа` → **Вспомогательная работа**; `КИО без ожид. АС`, `Орг. простои план`, `ТО, ППР и КР` → `Не учитывать`) → `category_code`, case-insensitive. Σ `indicator_amount` **as stored, regardless of `measure_name`** (the DAX is `SUM(indicator_amount)`; the bridged indicators are all hours `ч.` / `ч` except `КТГ план` = `%` and `Проверка` = `Проверка`, and the measures never read КТГ's own row) into `hrs_NN`; unmapped indicators (`Объем ГМ план`, `Метеоусловия`, …) counted in `n_rows` only |
| `fact_time_plan_month` ← `План_2_МЕС.parquet` (249,080; 129 loaders, **2023-01-01 … 2023-03-31 only**, `period_id = 2`) | **`plan-month.parquet`** (loader × week) | Same rule as the week plan (`indicator_name_2` is the same SWITCH). The month plan is stored **daily**, so the week grouping is exact. There is **no month-plan row before 2023-01-01** (rule R7) |
| `fact_rock_mass` ← `ПФ объемы.parquet` (18,684 = loader × day; 134 loaders, 2022-10-29 … 2023-03-31) | **`rock-week.parquet`** (loader × week) | Σ `rock_mass_truck_plan` (← `Объем ГМ на авто план`), `rock_mass_truck_fact` (← `Объем ГМ на авто факт`), `rock_mass_truck_plan_month` (← `Объем ГМ на авто план месяц`; **0 before 2023**), `n_rows`. The other 29 columns do not ship (no measure reads them) |
| `dim_mine`, `fact_interval` beyond the work type, the 6 unread files (`КРВ АС`, `ПФ Отчет о рейсах`, `Интервалы`, `AREA_DIM`, `FIELD_DIM`, `OFFICE_DIM`) | **not shipped** | No measure on the page reads them |

Loaders outside the 131 (not included, or contractor) are dropped from every shipped fact at build time — the fixed filters are applied once, in the build, and the engine never sees those rows. The fixed filters stay **replayable for the tests** through a build flag (§7.1: `--keep-excluded` writes a second set under `fixtures/data-unfiltered/` so the `waterfall_switches` / `kpi_total` / `model_total` contexts of `baseline-live.csv`, which have no `is_included` or contractor filter, can be reproduced).

### 2.3 Shipped files (`public/data/`), estimated size, load

All keys INT32, every amount DOUBLE **summed in Float64 from the source values, never fixed-point** (DEC-001 lesson). Category columns are named by `sort_order`: `sec_01 sec_02 sec_03 sec_04 sec_05 sec_06 sec_07 sec_08 sec_09 sec_10 sec_11 sec_12 sec_14 sec_15 sec_21 sec_22 sec_24 sec_25 sec_27` (fact seconds) and `hrs_01 … hrs_27` (plan hours, the same 19 sorts — the only sorts a bridge can produce; 13, 16, 17 fold into 21 and 26 into 25 on the plan side, 26 into 27 on the fact side). A cell is **null when the loader-week has no row of that category** and a number (possibly 0) when it has — the engine needs the distinction for rule R5. Byte estimates: ≈ 4–6 B per cell with hyparquet-writer on sparse doubles; the build prints the actuals and **fails over the hard caps**; this table is replaced with the actuals after step 1 (as the Marketing contract was).

| File | Grain | Rows | Columns | Est. bytes | Loaded |
|---|---|---|---|---|---|
| `manifest.json` | — | — | meta + weeks + loaders + categories + files | 22,910 B | first paint |
| `time-week.parquet` | loader × week | 2,688 | `loader_ix, week_ix, n_rows` + 19 `sec_*` | 157,917 B | first paint |
| `plan-month.parquet` | loader × week | 1,533 | `loader_ix, week_ix, n_rows` + 19 `hrs_*` | 51,635 B | first paint (Month is the default plan type) |
| `rock-week.parquet` | loader × week | 2,671 | `loader_ix, week_ix, n_rows, rock_mass_truck_plan, rock_mass_truck_fact, rock_mass_truck_plan_month` | 32,262 B | first paint (**first paint 264,724 B**) |
| `plan-week.parquet` | loader × week | 2,522 | as `plan-month` | 78,372 B | **lazy**: first pick of Plan type = Week, or at load when the URL carries `pt=week` (**total 343,096 B**) |

Budgets: **first paint ≤ 900 kB** (hard fail 1.2 MB), **total ≤ 1.3 MB** (hard fail 1.8 MB). Agreed fallback if a cap is hit: drop `sec_06`, `sec_24`, `hrs_06`, `hrs_24` (the subtotal rows' own hours — no shown number reads them, §3.3) and re-measure; no other change without updating this table.

### 2.4 Build-time checks (`scripts/build-trucks-data.ts`; every failure throws → `npm run build` fails)

1. Source footers: row counts 203,867 / 394,056 / 249,080 / 18,684 / 168 / 156 / 891 and the expected column names per file (a renamed or moved source file fails loudly, never silently ships zeros).
2. **Lossless aggregation:** Σ `sec_*` over `time-week` = Σ `duration` of the mapped source rows; the same for both plan tables and the three rock columns; Σ `n_rows` = source rows of the 131 loaders.
3. **Calendar coverage:** every fact / plan / rock date is in `Calendar.parquet` (true today: 0 outside); the 23 weeks have 7 days except week 14 (2 days).
4. **Bridge audit:** the set of chart categories produced equals the 19 shipped sorts plus `Не учитывать`; the list of source values that matched **only through case folding** is printed and must be exactly `Авар. Прост.` (fact → bridge) and `Консервация/резерв` (bridge → dim), both fact side (R1); any other case-only match fails the build (a new variant needs a look, not a silent fold).
5. **Totals present:** every `time-week` row has `sec_01` (КФВ) > 0 (true: 2,756 / 2,756; min day value 43,200 s); every plan row with any `hrs_*` has `hrs_01` > 0 (true: week plan 2,572 / 2,572, month plan 1,533 / 1,533). The rows with `n_rows > 0` but no `hrs_*` at all (week plan 1, month plan 28 loader-weeks) are kept — rule R5 needs them.
6. Work types: counts per `work_type` printed and asserted: **130 Trucks + On spot, 1 Undefined, 0 blank** among the 131 (verified 2026-11-09 from `intervals.parquet` with the TMDL rule; the Trucks / On spot split is pinned by the test after step 1).
7. Byte caps of §2.3; `manifest.files[*].rows / bytes` written from the actual output.

### 2.5 Shipped manifest contract (`lib/data/manifest.ts`, Zod 4, `.strict()` everywhere)

```ts
// schema 'acme-trucks/1'. English names = the TMDL column names of Trucks.SemanticModel; codes are data values (Cyrillic, as is).
meta: { extract_date: '2026-10-21', calendar_first: '2022-10-29', calendar_last: '2023-04-02',
        fact_first: '2022-11-01', fact_last: '2023-03-26', month_plan_first: '2023-01-01', culture: 'ru-RU' }
weeks[23]      { week_ix, week_label /* '44 (29.10-4.11)' */, sort_span, week_num, week_start, week_end, year, days }
loaders[131]   { loader_ix, loader_name /* 'LDR-12-09' */, office_name /* 'K1' */, bucket_volume_m3, work_type: 'Trucks'|'On spot'|'Undefined'|null }
categories[31] { sort_order, category_code, category_name, is_shown: '1'|'0', is_included: 'да'|'нет', row_kind: 'subtotal'|'loss' }
offices[6]     { office_name, sort_order }           // distinct of loaders, A–Z: B1 K1 K2 K3 M2 T1 (the PBI dropdown's default sort)
work_types[3]  'On spot' | 'Trucks' | 'Undefined'    // A–Z as the PBI dropdown (blank is never listed: f_work_type_not_blank)
files: { timeWeek, planMonth, planWeek, rockWeek }: { name, rows, bytes }
```

`FILES` (column specs per file, as `js-marketing/lib/data/manifest.ts`) is the single place the loader and the build share; the engine never names a Parquet column outside it.

## 3. Engine rules (`lib/engine/`, framework-free, mirrored from the TMDL)

Module layout (names final; components render strings and compute nothing): `data.ts` (typed arrays per file; `Dataset` behind which the format hides), `selection.ts` (state type, defaults, Reset), `scope.ts` (loader mask, week mask, the cross-filtered lists), `hours.ts` (per-loader window sums for fact / plan by category; the category lists), `shares.ts` (Linear / Weighted shares, bases, subtotals — the control-total surface), `kpi.ts` (the four tiles), `waterfall.ts` (the 19 rows: bar geometry, Δ, colours), `format.ts` (display rounding, signs, `–` / blank), `copy.ts` (§4), `view.ts` (faces), `url-state.ts` (§6).

### 3.1 Selection and masks

- **Window `W`:** `week = null` (all 23 weeks) or one `week_ix`. **A week mask never touches the loader lists** (no bidirectional filter: `dim_date` filters facts only).
- **Loader mask `M`:** the 131 shipped loaders ∩ `office_name ∈ offices` (or all) ∩ `loader_name ∈ loaders` (or all) ∩ `work_type ∈ work_types` (default `{Trucks, On spot}`; a loader with `work_type = null` passes only when no work type is picked — the JS never reaches that state, §3.1 last bullet). Fixed filters already applied in the build.
- **Lists cross-filter inside `dim_loader`** as Power BI slicers on one table do: the Office list = offices of loaders passing the loader + work-type picks; the Loader list = loaders passing the office + work-type picks; the Work type list is static (3 names). The Week, Plan type and Calculation lists are static. A pick that the other picks make empty **stays picked** (Power BI keeps the slicer state) and the page shows the empty-state values of R8.
- **Plan type `P`** ∈ {Month (default), Week}; **Calculation `C`** ∈ {Weighted (default), Linear}. Both single-select, never empty.
- **Work type keeps ≥ 1 pick** in the JS (deselecting the last is a no-op); Power BI lets the dropdown go empty (= no filter, blank-work-type loaders included). Accepted difference §7.3 (15); unreachable with today's data anyway (0 blank among the 131).

### 3.2 Categories, bridges, lists — the rules nerd must not re-derive

- **R1 — case-insensitive matching.** VertiPaq compares strings case-insensitively; the fact carries `Авар. Прост.` and the fact bridge `Консервация/резерв` where `dim_time_category` has `Авар. прост.` and `Консервация/Резерв`, and the DAX `IN { … }` lists spell them a third way. The build joins with `toLowerCase()` on both sides at every step (idle → bridge → dim; indicator → bridge → dim); the engine compares codes only through `sort_order` after that.
- **R2 — category lists by `sort_order`** (from the `IN {…}` lists of `_Fact Loss % Linear` / `_Fact Share % *` / `_Plan * %`; identical in every variant):
  - `L_KTG = {2, 3, 4, 5}` — the losses above "Ready for work" (6)
  - `L_KIO = L_KTG ∪ {7, 8, 9, 10, 11, 12, 14, 15, 21, 22}` — above "Effective work time" (24)
  - `L_TL = L_KIO ∪ {25, 26}` — above "Truck loading" (27); 26 has no fact hours (bridged into 27) and no plan hours (bridged into 25), so it contributes 0 — keep it in the list anyway
  - `LOSSES = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 21, 22, 25]` in this order — the 15 shown loss rows; the **cumulative list of a loss row r** = `LOSSES` up to and including r (`_*_Base % *`)
- **R3 — "own hours" of a row** = the row's category column (`sec_NN` / `hrs_NN`): used for loss rows and for the КФВ total; a **subtotal row never reads its own column** (КТГ, КИО, Погрузка rows are `1 − Σ list`), except the Погрузка row's own column in R6 (the KPI 3 share).
- **R4 — fact = seconds ÷ 3600 after summing; plan = hours as stored.** `_Fact Hours Linear = SUM(duration) / 3600`.

### 3.3 Per-loader window sums and the two calculations

For loader ℓ in `M` and a fact table F ∈ {fact (`time-week`), plan (`plan-month` or `plan-week` by `P`)} over `W`:

- `h_F(ℓ, c)` = Σ over ℓ's week rows in `W` of column c; **null when no week row has the column** (DAX `SUMX` over no rows = BLANK), else the Float64 sum (a sum of zeros is 0, not null).
- `T_F(ℓ)` = `h_F(ℓ, 1)` (КФВ: fact `kfv` rows; plan `Проверка` rows).
- `active_F(ℓ)` ⇔ Σ `n_rows` of ℓ over `W` > 0 — **any source row, mapped or not** (`@active = MAXX(fact[_active]) with ALL(dim_time_category)`; `_active` is 1 on every row). `n_rows` exists for this; `active` ≠ "has hours" (R5).
- `vol(ℓ)` = `bucket_volume_m3` (`MAXX(dim_loader, bucket_volume_m3)` over one loader = itself; `loader_name_dispatch` is unique per loader).
- `ratio(h, T)` follows DAX blank arithmetic: `h null & T null → null`; `h null & T number → 0`; `h number & T null → +∞`; otherwise `h / T` (T is never 0 with rows — check 5). `1 − null = 1`; `null × vol = null` (ignored by sums); a null term adds nothing to a sum.

**Share of a waterfall row r** (`Time Share Plan % / Fact %` → `_*_Share % *`):

| Row kind | Linear (`_*_Share % * Linear`) | Weighted (`_*_Share % * Weighted`) |
|---|---|---|
| КФВ (1) | `Σ_{ℓ∈M} T(ℓ)` null → **0**, else **1** | fact: the same 0 / 1. Plan: `COALESCE(DIVIDE(Σ_{A} h(ℓ,1), Σ_{A} T(ℓ)), 0)` = 1 when any active loader has a Проверка row, else 0 |
| loss r | `DIVIDE(Σ_{ℓ∈M} h(ℓ, r), Σ_{ℓ∈M} T(ℓ))` — **null** when the denominator is null (no rows) | `DIVIDE(Σ_{ℓ∈A} vol·p_ℓ, Σ_{ℓ∈A} vol)` with `p_ℓ = ratio(h(ℓ, r), T(ℓ))`; `A = {ℓ ∈ M : active(ℓ)}`; null when `A` is empty or every `p_ℓ` null |
| subtotal s ∈ {6, 24, 27} | fact: `IF(ISBLANK(Σ T), 0, 1 − DIVIDE(Σ h(ℓ, L_s), Σ T))`; plan: `1 − COALESCE(DIVIDE(Σ h(ℓ, L_s), Σ T), 1)` → **0 when no rows** (both variants never null) | `IF(ISBLANK(Σ_{A} T) [fact] / ISBLANK(Σ_{A} h(ℓ, L_s)) [plan], 0, DIVIDE(Σ_{A} vol·p_ℓ, Σ_{A} vol))` with `p_ℓ = 1 − ratio(h(ℓ, L_s), T(ℓ))` where `h(ℓ, L_s)` = Σ of the list's columns, null when none of them has a row |

`h(ℓ, L)` for a list = sum of the present columns, null when none is present. **Consequence (R5):** an active loader with no hour row in the window (a loader-week with only unmapped plan indicators — 1 week-plan and 28 month-plan loader-weeks exist) has `p_ℓ = null` on loss rows (adds nothing, **but its `vol` is in the denominator**) and `p_ℓ = 1 − null = 1` on subtotal rows (adds `vol`): the weighted subtotal is diluted toward 1 and the losses toward 0 by exactly that loader's volume, and the chain `subtotal = 1 − Σ losses` still holds. This is what Power BI shows; mirror it, do not "fix" it. The fact table has no such loader-week (every loader-week has `kfv`).

**Bars** (`_WF Plan/Fact Subtotal`, `Loss`, `Base`): `Subtotal(s)` = the subtotal share above for s, **0 on loss rows**; `Loss(r)` = the loss share above for r, **0 on subtotal rows**; `Base(r)` = `1 − share(cumulative list up to r)` computed with the subtotal formula (`1 − ratio` per loader, weighted; `1 − DIVIDE(Σ, Σ)` linear) — **0 on subtotal rows and on КФВ**. Test: `base(r) + loss(r) = base(previous loss) [or the subtotal above]` within 1e-9 (`time-util.dax` tab 3). The `SELECTEDVALUE(param_*)` fall-through to 0 / BLANK never triggers from the UI (single-select; see §7.1 for the fixture-only unselected contexts).

*Amended 2026-11-09 (hunter's extraction of the pinned rows):* the model returns **BLANK, not 0**, for `_WF Plan/Fact Subtotal` on loss rows and for `_WF Plan Base` on subtotal rows (the `time-util` tabs 1–2 pin `BLANK ()` there); `_WF Plan/Fact Loss` on **row 1 (КФВ) carries the share** (`_WF Fact Loss` at sort 1 = 1, `_WF Plan Loss` at sort 1 = the plan КФВ share), not 0. The engine's bar measures return null / the share exactly as pinned; the **faces are unaffected** (`WF Plan/Fact Bar` coalesce every input to 0 and a subtotal row never reads `Loss` or `Base`).

*Corrected 2026-11-09, later (hunter's parity run, `js-trucks/lib/test-utils/parity/parity-notes.md` › Open items):* `_WF Plan Loss` at sort 1 pins **0** (not the plan КФВ share — the fact side alone carries 1 at row 1), and `_WF Plan Base` on subtotal rows pins **0** under Weighted (not BLANK; only `_WF Plan/Fact Subtotal` on loss rows is BLANK). The engine follows the pins; the amendment above is superseded on those two points.

### 3.4 KPI tiles (`kpi.ts`)

| Tile | Plan | Fact | Δ | Format (Plan, Fact / Δ) |
|---|---|---|---|---|
| **Truck loading** (`% of total time`) | `Time Share Plan %` at row 27 (`KPI Truck Loading Plan %`) | at row 27 | `IF(both non-null, (fact − plan) × 100)` pp | `0.0%` / `+0.00 "pp";−0.00 "pp";0.00 "pp"` |
| **Effective work time** (`% of total time`) | row 24 | row 24 | same | same |
| **Performance per truck** (`m³/h`) | `Rock Mass by Truck Plan ÷ _Plan Truck Loading Hours × 1000` | `Rock Mass by Truck Fact ÷ _Fact Truck Loading Hours × 1000` | `IF(both non-null, fact − plan)` | `#,0` / `+#,0;−#,0;0` |
| **Mass loaded per truck** (`thousand m³`) | `Σ rock_mass_truck_plan` (P = Week) or `Σ rock_mass_truck_plan_month` (Month) over `M × W` | `Σ rock_mass_truck_fact` | same | `#,0` / `+#,0;−#,0;0` |

`_KPI Noise = 1` since 2026-11-04: **drop it** (no multiplier anywhere). "Per truck" means "loaded into trucks"; nothing divides by a truck count (`trucks-kpi-mismatch` §3).

**R6 — the truck-loading hours of KPI 3** (`_Plan/_Fact Truck Loading Hours = Total Time Hours × Truck Loading Share`):
- `TotalTimeHours_F` = **Linear always**: fact Σ_{ℓ∈M} T_fact(ℓ) (`_Fact Hours Linear` at КФВ); plan Σ_{ℓ∈M} T_plan(ℓ) of the chosen plan table (`CALCULATE([_Plan Hours Linear], indicator_name = "Проверка")` = the КФВ column, since only `Проверка` maps to КФВ). Null when no rows.
- `Share_F` = `DIVIDE(H_F(27), H_F(1))` where `H_F(c)` follows **C**: Linear `Σ_{ℓ∈M} h_F(ℓ, c)`; Weighted `Σ_{ℓ∈M} vol·h_F(ℓ, c) ÷ Σ_{ℓ∈M} vol` (`_Plan Hours Weighted`, `_Fact Hours Weighted`: **all masked loaders, no `active` filter** — the Σ vol cancels in the ratio, so `Share` = `Σ vol·h(ℓ,27) ÷ Σ vol·T(ℓ)`; null terms add nothing). The fact column 27 holds `Погрузка самосвалов` **and** `Основная работа` rows (fact bridge); the plan column 27 only `Погрузка самосвалов` (plan bridge sends Основная into 25).
- `Hours_F = TotalTimeHours_F × Share_F`; `Performance = DIVIDE(RockMass, Hours) × 1000` → **null** when `Hours` is null or 0.

### 3.5 Blank, zero and the Month plan before 2023 (DEF-007 rules; nothing shows 0 where DAX is BLANK)

| Where | DAX | JS shows |
|---|---|---|
| Table `WF Plan %` / `WF Fact %` | `COALESCE(share, 0)` with format `0.00%;-0.00%;"–"` → **`–` for 0 and for blank** (the zero section) | `–` (U+2013) when the share is null **or exactly 0**; otherwise `12.34%` (2 dp) |
| Table bars | `COALESCE(…, 0)`; width `MAX(value × track, 2)` → a 2 px sliver at 0 | the same 2 px sliver (scaled: 1.5 px at 1440; use 2 px) |
| Table Δ pill (`WF Δ Pill`) | `_pp = COALESCE(Fact − Plan, 0) × 100`; `|_pp| < 0.005` → neutral `0.00`; else `+n.nn` / `−n.nn` (`FORMAT(ABS, "0.00")`) | identical; the sign test uses the **unrounded** `_pp` |
| Tooltip `WF Δ pp` | `ROUND(COALESCE(Δ, 0) × 100, 2)`, format `+0.00 "pp";−0.00 "pp";0.00 "pp"` | identical (`0.00 pp` for the neutral case) |
| KPI tiles 1–2 (rows 27 / 24 are subtotals) | plan / fact **never null** (0 when no rows, §3.3); Δ pp = (fact − plan) × 100 | `0.0%` for 0; Δ always printed |
| KPI tiles 3–4 | `Σ rock` null when no row → card shows `(Blank)`; `Performance` null when hours null → `(Blank)`; Δ null when either side null → empty pill | **`–`** in the value slot and an **empty neutral pill** (accepted difference §7.3 (16): Power BI prints `(Blank)`) |
| KPI Δ pill colour (`kpi_*_delta` rules) | pp tiles: `> 0.005` blue, `< −0.005` orange, else neutral; volume tiles: `> 0.5` / `< −0.5` (one display unit ÷ 2) | identical thresholds on the unrounded Δ; `null` → neutral |
| **R7 — Month plan before 2023** | `plan-month` has rows only for weeks 1 … 13 of 2023; `rock_mass_truck_plan_month` is 0 (not null) on every 2022 row | Week 44 … 52 under Month: table plan loss rows `–` (null), plan subtotals `–` (0), plan bars slivers, Δ pills = fact share (favourable on subtotals, unfavourable on losses); tile 1–2 Plan `0.0%`, Δ = fact × 100 pp; tile 4 Plan `0` (sum of zeros), Δ = fact; tile 3 Plan `–`, Δ empty. **All weeks** under Month compares a Nov–Mar fact with a Jan–Mar plan (the page default does this) — a rule, not a bug |
| **R8 — empty mask** (every loader filtered out, or a week with no rows for the mask) | as above with no rows: КФВ 0, losses null, subtotals 0 | table all `–`, slivers, neutral `0.00` pills; tiles 1–2 `0.0%` / `0.0%` / `0.00 pp`; tiles 3–4 `–` / empty pill; header still shows the week text |

Rounding **only at display**; engine values are full precision. `format.ts`: percent `0.00%` (table) / `0.0%` (tiles), pp with 2 dp and the sign, integers `#,0` with the sign on Δ, **round half away from zero** (DAX `FORMAT` / `ROUND` semantics; implement on the decimal string, not `toFixed`), minus **U+2212**, `–` U+2013 for the zero / blank cells (the format string's literal), `(Blank)` never printed.

### 3.6 Header context (`_Header Context`) and the chip texts

- Header: `first` / `last` = the **calendar** dates of the selected weeks (`MIN / MAX(dim_date[date])` under the week filter only — not the fact dates): one week → `Week 9 (2023)`; all weeks, same year → `Weeks n–m (yyyy)` (cannot occur with this calendar); all weeks → `Weeks 44 (2022) – 14 (2023)` (`week_num` of the first and last week, `year` of each). Then `  ·  ` (two spaces, middle dot, two spaces) + `Weighted calculation` / `Linear calculation` + `  ·  ` + `Month plan` / `Week plan`. Default: `Weeks 44 (2022) – 14 (2023)  ·  Weighted calculation  ·  Month plan` (pinned, `time-util.dax` tab 7). `Mixed` never occurs (single-select).
- Chips (mockup; the PBI dropdowns show their native "All" / value / "Multiple selections"): `Week  All` or the label (`9 (25.2-3.3)`); `Office  All` / one name / `n selected`; `Plan type  Month`; `Calculation  Weighted`; `Work type  On spot, Trucks` (picked names in list order, A–Z) or `All` when all three; `Loader  All (n)` (n = loaders in the current Loader list) / one name / `n selected`. Two-tone: label muted, value ink semibold (mockup).

### 3.7 DAX behaviours written down as rules (so nerd meets none as a surprise)

1. **Weighted ≠ "weighted linear":** Linear is a ratio of sums over the masked loaders; Weighted is a volume-weighted mean of **per-loader** ratios over the **active** loaders — a loader with a huge total and a tiny bucket barely moves the weighted share and dominates the linear one. Both are shown with the same two decimals.
2. **Active ≠ has hours (R5):** `active` counts any source row in the window, mapped or not; with the Month plan 28 loader-weeks are active without an hour row and dilute the weighted plan shares by their bucket volume. The Week plan has 1 such loader-week.
3. **The plan КФВ is `Проверка`, not a sum of categories:** plan shares divide by the `Проверка` rows; the plan loss rows do not add up to `1 − Погрузка` unless the extract says so (they do, within the chain test, because the subtotals are defined as `1 − Σ list`).
4. **Main work goes two ways:** fact `Основная работа` → Truck loading (27); plan `Основная работа` → Auxiliary work (25). The row "Auxiliary work" therefore compares a plan that includes main work with a fact that does not; the Truck loading fact includes it. As is.
5. **The КТГ plan row is a percent, not hours** (`КТГ план`, `measure_name = "%"`), but no shown number reads a subtotal's own column (R3), so it never surfaces. Do not divide by 100 anywhere.
6. **Linear plan subtotal with no rows is 0, the fact one too, but through different branches** (`1 − COALESCE(…, 1)` vs `IF(ISBLANK(…), 0, …)`); loss rows are null in both. The table's `–` hides the difference; the tiles show `0.0%`.
7. **Week 14 has 2 calendar days** (2023-04-01 … 04-02) and no fact rows (fact ends 03-26; plan-week and rock end 03-31): picking week 14 is R8 for the fact and a real plan / rock for the plan side (week-plan rows on 04-01 only) — a legitimate state, pinned by nothing; hunter captures it if bip has time, else JS-only. *Corrected 2026-11-09 (hunter's differential run):* **week 14 has no fact, plan-week, plan-month or rock row at all** (the shipped cubes carry no loader-week for it), so it is **R8 on both sides**; "a real plan / rock for the plan side" does not hold for this extract. No other week lacks a plan-week row.
8. **KPI 3 uses Linear total hours under both calculations** and a share whose weighted form has no `active` filter (R6) — unlike the waterfall. Both Performance tiles move when Calculation flips; the Mass tiles do not.
9. **The Reset state is not the saved state.** `bm_reset` restores all weeks · Month · Weighted · Trucks + On spot · all offices · all loaders. The PBIP opens on whatever Desktop last saved (today week 9 · Month · Weighted; it was week 5 / Linear on 10-23 and week 10 on 11-04). The JS opens on the **Reset state** (§6, §10 q A).
10. **Format strings print ASCII `-` in Power BI where the string has `-`** (`0.00%;-0.00%` on the table shares — never shown, shares are ≥ 0) and `−` where the string has `"−"` (the Δ pp formats) or the SVG has `&#8722;` (the pill). The JS prints U+2212 everywhere; the parity harness normalises both glyphs (Marketing precedent).

## 4. Copy source (`js-trucks/lib/engine/copy.ts`)

Seeded **verbatim** from the PBIR text boxes of page `ReportSectionbdcfb2b87f3167b0ec4f`: `hdr_title` (`Truck time utilization` · `Haul fleet · Plan vs Fact · share of total time`), the KPI titles and units (`TRUCK LOADING` · `% of total time`, `EFFECTIVE WORK TIME` · `% of total time`, `PERFORMANCE PER TRUCK` · `m³/h`, `MASS LOADED PER TRUCK` · `thousand m³`), `Plan` / `Fact`, `wf_title` (`Time structure` · `Waterfall from total time to truck loading, % of total`), `wf_legend` (`Subtotal` · `Time loss` · `Better than plan` · `Worse than plan`), the column headers (`CATEGORY`, `PLAN`, `%`, `FACT`, `%`, `Δ FACT − PLAN, PP` — mockup wording, §5.4 (3)), `btn_reset` (`↺  Reset filters`), the slicer headers (`Week`, `Office`, `Plan type`, `Calculation`, `Work type`, `Loader`), the footnote (`Δ is favorable (blue) when a subtotal grows or a time loss shrinks against plan; unfavorable (orange) otherwise.`), the tooltip labels of `tt_time_structure` (**`Plan share`, `Fact share`, `Δ fact − plan`** — `tt_plan_lbl`, `tt_fact_lbl`, `tt_delta_lbl` as built; *corrected 2026-11-09 after sync point 1, was `Plan` / `Fact`*), the document title `Truck time utilization — Plan vs Fact` (mockup `<title>`). Category names come from `manifest.categories` (data), never from `copy.ts`. Numbers never live in `copy.ts`. Deviations from the PBIP strings are deliberate and listed in `js-trucks/README.md › Deviations`. No ⓘ or How-to-read exists on the PBI page; **none is added** (ADR-0012 asks for them on cards that carry formulas; this page has a footnote and a tooltip only — §10 q D).

## 5. Visual contract

### 5.1 Tokens (`acme-trucks-theme.json` + mockup `:root`; `trucks-report-redesign.md` §1.2)

ink `#1C2B3A` · muted `#5B6B7D` · steel `#A3AFC4` · link `#1D6FA5` · ground `#F3F5F8` · surface `#FFFFFF` · line `#E1E6ED` · control `#D6DCE5` · divider `#EEF1F5` · grid `#E6EAF0` · field `#F8F9FB` · favourable bg / fg / edge `#E3EEF7` / `#155A88` / `#9CC0DF` · unfavourable `#FBEADF` / `#9A4511` / `#E8B08B` · neutral pill `#EEF1F5` / `#5B6B7D` · popover shadow `0 12px 32px rgba(28,43,58,0.14)`. Fonts **Manrope 600 / 700 / 800** (display, numbers, tabular) and **Inter 400 / 500 / 600** (UI), self-hosted via `next/font` (CSP `font-src 'self'`). Radii: cards and popovers 12, chips and buttons 8, bars 3 (PBI 4 at 1920 = 3 at 1440), legend swatch 3, pills 999.

### 5.2 Frame geometry at 1440 × 810 = PBIR × 0.75 (positions from the `visual.json` files)

| Block | x, y, w, h (px) |
|---|---|
| Header band (ink) | 0, 0, 1440, 54 · logo `trucks-logo.svg` 24 × 24 at 24, 15 · title + subtitle from 57, 4.5 · context line right-aligned, right edge 1416, y 18–36 |
| Filter bar (surface) | 0, 54, 1440, 67.5 · 1 px line at y 121.5 · chips y 59, h 57 → **h 36 centred** (mockup chip height) at x / w: Week 24 / 195 · Office 231 / 150 · Plan type 393 / 150 · Calculation 555 / 165 · Work type 732 / 195 · Loader 939 / 225 · Reset 1275 / 141 (link colour, ↺) |
| KPI tiles | y 133.5, h 99, w 324 at x 48 · 387.75 · 727.5 · 1067.25 (gaps 15.75) · inside (relative): title 15, 9 · unit right-aligned to w − 15 · `Plan` label 15, 39 · Plan value 15, 61.5 (w 99) · `Fact` label 118.5, 39 · Fact value 118.5, 58.5 (w 118.5) · Δ pill 240, 63 (w 72, h 22.5) |
| Waterfall card | 48, 244.5, 1344, 529.5 · title 63, 252 · legend right-aligned, right edge 1377, y 259.5 · divider y 300 · table 63, 304.5, 1314, 468 · header row + 19 rows ≈ 23.4 px each |
| Table columns | CATEGORY 176.25 · PLAN bar 411.75 · % 81.75 · FACT bar 445.5 · % 81.75 · Δ 105 (= PBI 235 / 549 / 109 / 594 / 109 / 140 × 0.75) |
| Bars (from `WF Plan Bar` / `WF Fact Bar`) | plan: pad 6, track 399.75, h 18; fact: pad 39.75 (gap + spacer), track 399.75; grid line at 50 % and 100 % (`#E6EAF0`, 1 px); subtotal fill ink with the in-bar white label `77%` (whole percent, 11.25 px semibold) when the bar is wider than 36 px; loss fill steel; min width 2 px; `x = pad + base × track` |
| Δ pill (`WF Δ Pill`) | right-aligned in the first 96 px of the Δ column; h 16.5, radius 8.25, min width 56.25, text 12 px semibold, colours §3.5 |
| Axis strips | `0%  50%  100%` under each bar column: 245.25, 756 and 772.5, 756; w 399.75, h 15 (native text, not the `trucks-axis.svg` image) |
| Footnote | 48, 778.5, 1344, 27 · 9 px muted |

Type scale (mockup px at 1440; the PBI pt values at 1920 equal px at 1440 and are the fallback where a mockup size does not fit the compressed height): app title 17 / 700 · subtitle 11 steel · context 11 steel · card title 16 / 700 · KPI title 12 / 600 uppercase, letter-spacing .06em · KPI Fact **28 / 800** · KPI Plan **22 / 600 muted** (the PBI reduced them to 22 / 18 pt for the noisy 8-digit numbers; the noise is off, so the mockup sizes return) · chips / table rows 13 · pills / legend / footnote 12 · column headers / units / axis 11 / 600 uppercase. Tabular numerals everywhere (`font-variant-numeric: tabular-nums`).

### 5.3 Interactions

- **Chips → popovers** (mockup; PBI: dropdown slicers): click opens the popover under the chip (y 121.5 + 4), widths Week 260 · Office 220 · Plan type 200 · Calculation 200 · Work type 200 · Loader 280 (mockup); heading uppercase 11 px muted; Week / Office / Work type / Loader = checkbox lists (Week and Office with **Select all**, Work type without — as the PBI slicers), Loader with a search box (`selfFilterEnabled`); Plan type / Calculation = radios that apply on click and close. **Multi-select popovers apply on Done** (mockup `Apply` relabelled as the PBI build did), **Clear** restores that filter's Reset value (the `bm_clear_*` semantics), Esc / click outside discard the pending picks. Week is **single-select** (one week or Select all), as `s_week`.
- **Reset filters** → the Reset state (§6 defaults), URL rewritten; nothing else on the page changes.
- **Row tooltip**: hover / focus on a table row shows a 210 × 93 (280 × 124 × 0.75) white tooltip with the row's category name, `Plan share 12.34%`, `Fact share 10.12%`, `Δ fact − plan −2.22 pp` (the `tt_time_structure` content; labels as built, *corrected 2026-11-09*), opened after 200 ms, closed on leave / Esc.
- Hover on a bar: native `<title>` with the exact engine share (JS only).
- Keyboard: Tab through chips → tiles → table rows; Enter / Space opens a chip; arrows inside lists; Esc closes.

### 5.4 Mockup vs PBIR: every deviation and the side the JS takes

| # | Mockup | PBIR (reason) | JS |
|---|---|---|---|
| 1 | Chips with popovers (label + value two-tone, chevron, search, Clear / Apply) | 6 dropdown slicers (no popover slicer in Power BI) | **Mockup** (Apply = Done; Clear = the filter's Reset value) |
| 2 | Subtotal rows bold, losses regular | colour only (a table cannot bold one row) | **Mockup**: bold ink subtotals, regular muted losses |
| 3 | Column headers `%` / `%` | `PLAN %` / `FACT %` (two columns cannot share a title) | **Mockup** `%` / `%` with `aria-label` "Plan %" / "Fact %" |
| 4 | Legend swatches with radius and a border on the pale ones | `■` runs in a text box | **Mockup** |
| 5 | Axis `0% 50% 100%` text | static SVG image strip | native text (**mockup**) |
| 6 | Manrope / Inter, letter-spacing, text-transform | Segoe UI (renderer fonts) | **Mockup** fonts, self-hosted |
| 7 | 1440 × 1091 artboard | 1920 × 1080 FitToPage (vertical compression) | **1440 × 810**, PBIR geometry × 0.75 (§5.2) — the embed size of both flavours |
| 8 | Δ pill = HTML pill | SVG image in a 594 px box | native pill (**mockup**) |
| 9 | KPI title left, unit right on one line | title text box + separate unit text box | one row (**mockup**) |
| 10 | Chip value `All (44–52)`, `All (32)` | Power BI's native "All" / "Multiple selections" | chip texts of §3.6 (**mockup** form; `All` without the range for Week, `All (n)` for Loader) |
| 11 | — | tooltip page on row hover (added 2026-10-23) | **PBIR**: the same content as a JS tooltip |
| 12 | — | header context card | **PBIR** string, exact |
| 13 | Apply footer (batch) | immediate apply | **Mockup** semantics on multi-select lists (pending until Done) — accepted difference §7.3 (1) |
| 14 | — | the saved opening week | **Reset state** on open (§3.7 (9)) |

## 6. URL state (validated with Zod at the boundary; `parseSelection(URLSearchParams, manifest)`; canonical rewrite as `js-marketing/lib/engine/url-state.ts`)

No hash routes (one view). Defaults omitted; unknown keys ignored; an invalid value → that key's default, never a broken page; `max(256)` per value, except `l` (amended 2026-11-09: capped at the length of the full comma-joined shipped loader list, so every selection the page can make round-trips).

| Key | Values | Default |
|---|---|---|
| `w` | `yyyy-ww` = `year` + zero-padded `week_num` of a manifest week (`2022-44` … `2023-14`; `2023-09` = `9 (25.2-3.3)`) | absent = all weeks |
| `o` | comma list of `office_name`, lower case in the URL (`k1,k3`), deduplicated, manifest order | all |
| `l` | comma list of `loader_name` (`LDR-12-09`; case-insensitive parse, canonical case out) | all |
| `wt` | comma list of `trucks,onspot,undefined` (≥ 1; an empty or all-invalid list → default) | `trucks,onspot` (absent) |
| `pt` | `month` · `week` | `month` |
| `calc` | `weighted` · `linear` | `weighted` |

Reset state = every key absent. A pick outside the manifest (a loader name that does not exist) is dropped with the rest kept. Components never read `location`; a **Copy link** button in the header writes the canonical URL (Track C precedent). Deep-link examples hunter uses: `/?w=2023-10` (PT-03), `/?pt=week&calc=linear` (PT-04), `/?w=2023-05&calc=linear&o=k3&wt=trucks,onspot,undefined` (PT-05), `/?w=2022-44` (PT-08).

## 7. Parity

### 7.1 Engine tests (Vitest) — the DAX files are the oracle, converted once into fixtures

hunter extracts the `DATATABLE` / `ROW` expectations of `pbi-report/ACME Trucks/tests/time-util.dax` (tabs 1–8), `tests/page-parity.dax` (tabs 1–2) and `tests/baseline-live.csv` (scopes `waterfall_saved`, `waterfall_switches`, `kpi_saved`, `kpi_switches`, `kpi_total`, `model_total`) into `js-trucks/fixtures/checks/trucks-pinned.csv` (`context, category_sort, measure, expected, tol, source`; the `source` names the file and tab). The DAX files are **not edited**. The engine test `lib/engine/pinned.test.ts` reproduces **every row** at relative 1e-9 (strings exact), and asserts the engine returns null exactly where the CSV says `BLANK ()`. *Amended 2026-11-09 (hunter):* the tolerance is **`tol × max(1, |expected|)`** (the DAX blocks compare `ABS(actual − expected) <= tol × MAX(1, ABS(expected))`, so near-zero shares get an absolute 1e-9, not a relative one); row and tab counts below corrected to what the files hold:

| Pinned block | Context | Rows | Engine surface |
|---|---|---|---|
| `time-util.dax` tab 1 | Reset state (all weeks · Month · Weighted · Trucks + On spot) | 19 × 9 (`WF Plan %`, `WF Fact %`, `Time Share Δ`, `_WF Plan Base / Loss / Subtotal`, `_WF Fact Base / Loss / Subtotal`) | `shares.ts` + `waterfall.ts` |
| tab 2 | week 9 (`9 (25.2-3.3)`) · Month · Weighted · Trucks + On spot | 19 × 9 | same |
| tab 3 | **Reset state only** (*amended 2026-11-09*; was "both contexts"): chain (base + loss = previous level; subtotal = level after the losses above) | 36 = 18 × plan / fact | `waterfall.ts` (the JS runs the same chain on PT-02 as well — JS-only there) |
| tab 4 | tiles 1–2 = table rows 27 / 24; Δ pp = (fact − plan) × 100 | 6 | `kpi.ts` |
| tab 5 | Δ colour rule on every row (subtotal up / loss down = favourable; `< 0.005` neutral) | 19 | `waterfall.ts` colours |
| tab 6 | noise off: tiles 3–4 = their unit; volume Δ = Fact − Plan | 5 (*amended 2026-11-09*; was 6) | `kpi.ts` |
| tab 7 | header text; the contractor filter changes no KPI under Trucks + On spot | 4 | `copy` / `view.ts`; the contractor check runs on the unfiltered fixture set |
| tab 8 | tooltip: title = category name; `WF Δ pp` = round((fact − plan) × 100, 2); the pill prints the same number | 19 | `format.ts` |
| `page-parity.dax` tab 1 | S1 week 10 · Month · Weighted · Trucks + On spot; S2 all weeks · Week · Linear · Trucks + On spot; S3 week 5 (`5 (28.1-3.2)`) · Month · Linear · office K3 · Trucks + On spot + **Undefined** | 36 comparisons, **no literals** (*amended 2026-11-09*: the tab compares the new page's measures with the original page's live, so it pins nothing; its S2 / S3 values enter the gate through bip's `parity-expected.csv`, §7.2) | `kpi.ts` (S3's contractor-filter claim withdrawn, see PT-05 / PT-05b in §7.2) |
| tab 2 | S1 four tiles pinned (42.92 / 45.35 / +2.42 · 53.69 / 51.56 / −2.13 · 847 / 762 / −85 · 7,156 / 7,029 / −127) — **the only pinned block of this file** | 12 | `kpi.ts` + `format.ts` |
| `baseline-live.csv` `waterfall_saved` | week 9 · Month · Weighted · Trucks + On spot (+ the original page's context = the same fixed filters) | 266 (19 × 14 incl. `_planHours`, `_factHours`, `_factHours_LIN` per row) | `shares.ts` + `hours.ts` (`_Plan Hours` / `_Fact Hours` = the per-row hours under **C**: Linear Σ, Weighted `Σ vol·h ÷ Σ vol` over the masked loaders without the `active` filter — `_Plan Hours Weighted`, `_Fact Hours Weighted`) |
| `waterfall_switches` | Month · Weighted, **no other filter** (every loader incl. not-included and contractor; all work types) | 266 | same, on the **unfiltered fixture set** (§2.2 last paragraph) |
| `kpi_saved` / `kpi_switches` | the four volume units at week 9 saved · switches only | 8 | `kpi.ts` (unfiltered set for `kpi_switches`) |
| `kpi_total`, `model_total` | no filter at all — **Plan type and Calculation unselected** | 4 + 14 | **engine-level only, outside the parity gate** (*amended 2026-11-09*): the JS selection cannot express an unselected switch (§3.1: both are single-select, never empty), so these rows are reproduced by a test-only `compute()` call with `planType: null` / `calculation: null`, where the engine mirrors the DAX fall-throughs of §3.3's last sentence — `SELECTEDVALUE` → BLANK, so `_Plan Hours` / `_Fact Hours` are BLANK and `kpi_total` **Performance is BLANK** (as pinned), Rock Mass Plan falls to the month column (`FIRSTNONBLANK` ≠ "Неделя"); the `Time Share *` switches fall to 0. "Never triggers" in §3.3 means never from the UI; the engine must still implement the fall-through for these fixture rows |

**The capture gap — closed 2026-11-09 (bip, Desktop capture):** `pbi-report/ACME Trucks/tests/parity-expected.csv` (232 rows, `b_status = captured`) holds the Reset-state **volume tiles** (PT-01), PT-04, PT-05 and PT-08. The captured values match archi's recomputation — Performance **886.46 / 763.83** m³/h (Δ −123), Mass loaded **87,006.43 / 143,178.57** thousand m³ (Δ +56,172); S2 897.44 / 812.75, 142,816.28 / 143,178.57 — and the R7 / §3.5 rules for week 44. *(Was: "pinned nowhere; archi recompute as `pending` until bip adds two DAX rows".)*

Additional tests: the `ratio` blank table (§3.3) unit-tested on all four cases; R5 on a synthetic loader-week with `n_rows > 0` and no hours (weighted subtotal diluted, chain holds); R7 on week 44 (plan nulls / zeros exactly as §3.5); R8 on an empty mask; URL round-trips (parse → serialize → parse idempotent; unknown keys dropped; `wt=` empty → default); chip texts; header texts for one week / all weeks; performance (full recompute < 50 ms in Node on the shipped files).

### 7.2 Parity selections (hunter; both flavours; 0 `gap` rows = the gate)

File `js-trucks/lib/test-utils/parity/parity_selections_trucks.csv`, columns `sel_id, week, offices, loaders, work_types, plan_type, calculation, element, kind, expected, tol, c_status, b_status, source` (the Marketing pattern; `element` = `KPI.tl.plan`, `KPI.tl.delta`, `WF.27.plan_pct`, `WF.02.delta_text`, `WF.02.plan_base`, `HDR.context`, `CHIP.week`, `TT.02.delta_pp` …; `kind` = `text | number`). Every expected value comes from the pinned DAX blocks named below or, *since 2026-11-09*, from bip's `pbi-report/ACME Trucks/tests/parity-expected.csv` (232 rows: PT-01 volume tiles, PT-04, PT-05, PT-08 — `b_status = captured`; the `source` column names the block or the CSV). PT-07 is JS-only. *(Was: "no new Desktop capture for PT-01 … PT-06; PT-08 pending".)*

| sel_id | Selection (URL) | Elements ← pinned source |
|---|---|---|
| PT-01 | Reset state `/` | 19 table rows (plan %, fact %, Δ text, bar base / loss / subtotal, colours) ← `time-util` tabs 1, 3, 5, 8; tiles 1–2 ← tab 4; tiles 3–4 ← `parity-expected.csv` (*2026-11-09*, was a gap); header ← tab 7; chips `Week  All`, `Office  All`, `Plan type  Month`, `Calculation  Weighted`, `Work type  On spot, Trucks`, `Loader  All (130)` (JS-only) |
| PT-02 | `/?w=2023-09` (week 9) | 19 rows ← `time-util` tab 2 + `baseline` `waterfall_saved` (incl. the hours of the tooltip measures); tiles 3–4 ← `kpi_saved`; header `Week 9 (2023)  ·  Weighted calculation  ·  Month plan` |
| PT-03 | `/?w=2023-10` (the USER's screenshot week) | the 12 KPI values and the 4 tile faces ← `page-parity` S1 + tab 2 (`42.9%` / `45.3%` / `+2.42 pp` blue; `53.7%` / `51.6%` / `−2.13 pp` orange; `847` / `762` / `−85` orange; `7,156` / `7,029` / `−127` orange) |
| PT-04 | `/?pt=week&calc=linear` (all weeks · Week · Linear) | 12 KPI values ← `parity-expected.csv` (*2026-11-09*; `page-parity` S2 pins no literal — §7.1) |
| PT-05 | `/?w=2023-05&calc=linear&o=k3&wt=trucks,onspot,undefined` | 12 KPI values ← `parity-expected.csv` (*2026-11-09*); chips `Office  K3`, `Work type  All` (all three picked). **Does not prove the contractor filter** (*amended 2026-11-09*; was "the contractor filter case"): the two contractor loaders are in K1 and T1, so office K3 never meets them |
| PT-05b *(added 2026-11-09, bip capturing)* | a week · Linear · office **K1** (or T1) · `wt=trucks,onspot,undefined` | 12 KPI values — the contractor-filter case: without the page filter the Undefined contractor loaders move every KPI (`trucks-kpi-mismatch` §4); `b_status = pending` until bip's rows land in `parity-expected.csv` |
| PT-06 | fixture-only: Month · Weighted with **no** fixed filters | 19 rows ← `baseline` `waterfall_switches`; tiles ← `kpi_switches` (engine test on the unfiltered set, not a UI state). `kpi_total` / `model_total` are **engine-level, outside the gate** (unselected switches, §7.1) |
| PT-07 | JS-only: Reset round-trip from PT-05; Loader popover search `LDR-18` lists the matching names; Work type cannot go empty; Copy link = canonical URL | `b_status = n/a` |
| PT-08 | `/?w=2022-44` (a 2022 week under the Month plan, R7) | table plan column all `–`, plan bars slivers, Δ pills = fact; tile 1–2 Plan `0.0%`, Δ = fact × 100; tile 3 Plan `–` + empty pill; tile 4 Plan `0`, Δ = `+fact` ← `parity-expected.csv` (*2026-11-09*, `b_status = captured`; matches R7 / §3.5) |

Text normalisation before comparing (Marketing precedent): ASCII `-` and U+2212 map to one glyph; runs of spaces around `  ·  ` collapse.

**Gate result (hunter, 2026-11-09, `js-trucks/lib/engine/parity.test.ts`; evidence in `js-trucks/lib/test-utils/parity/parity-notes.md`):** **1,649 rows, 1,647 match, 2 accepted (difference 16: PT-08 Performance Plan `(Blank)` vs `–` + empty pill), 0 gap.** PT-05b (K1 + T1 · + Undefined, 30 rows) captured and green — the contractor-filter case is proved there. Left outside the gate on purpose: the **14 `model_total` / `kpi_total` rows** (unselected switches, §7.1 — engine-level, unreachable from the UI), plus `_Zero` and the removed `_factHours_%%`. A differential oracle over 3,360 selections (551,040 values) found 0 differences. Open from the run (no gap): whether a Power BI table prints `0.00%` or `–` for a nonzero share that rounds to zero (`?wt=onspot`, Refueling fact 0.0017 %) — one bip capture settles it; the JS prints `0.00%` per §3.5.

### 7.3 Accepted differences and shared readings (draft rows for `docs/design/parity-rules.md › Accepted platform differences › ACME Trucks`)

**Shared readings (identical in both flavours; the PBIP as built wins):** every number of §3 incl. R1–R8; `_KPI Noise` gone; the fixed filters `is_included = "да"` and contractor blank; the Work type default Trucks + On spot; the Reset state; the 19 waterfall rows in `sort_order`; `–` for a zero or blank share in the table; the Δ colour rule and its 0.005 pp / 0.5 unit neutral bands; the header context string; the tooltip content; the footnote; light theme; 1440 × 810 at the embed.

**Accepted differences (the JS builds the mockup's version where Power BI could not, or Power BI shows an artefact):** (1) chips + popovers with pending picks until Done and Clear = the filter's Reset value — Power BI: dropdown slicers that apply at once; (2) Esc / click outside close — Power BI: click outside only; (3) bold subtotal rows — colour only; (4) `%` / `%` headers — `PLAN %` / `FACT %`; (5) legend swatches with radius and border — `■` text; (6) native axis text — image strip; (7) Manrope / Inter — Segoe UI; (8) native Δ pill — SVG image; (9) KPI title and unit on one row; (10) chip texts `All`, `n selected`, `All (n)` — native slicer captions; (11) the JS opens on the Reset state — the PBIP on its saved slicer state; (12) URL state + Copy link — none; (13) keyboard reach and focus return — none; (14) minus glyph U+2212 everywhere — Power BI's native cards print `−` here too (the formats carry the literal), so no normalisation is expected to trigger; harness keeps the rule; (15) Work type keeps ≥ 1 pick — a Power BI dropdown can be emptied (= no filter); (16) a blank KPI value prints `–` with an empty neutral pill — Power BI prints `(Blank)`; (17) bar hover shows the exact share — none.

## 8. Build order (verification per step; sync points with bip)

| # | Step (owner) | Verify |
|---|---|---|
| 0 | Scaffold `js-trucks/` (nerd): pins, `next.config.ts` and `parquet-columns.ts` / `csv.ts` vendored from `js-marketing/`, icons (`trucks-logo.svg` copied from `Trucks.Report/StaticResources/RegisteredResources/`), empty page | `typecheck`, `lint`, `test`, `build` green on the empty app |
| 1 | `scripts/build-trucks-data.ts` → `public/data/` per §2 (+ `--keep-excluded` fixture set, the shipped `manifest.ts`, `FILES`) | the §2.4 checks pass; printed sizes inside §2.3 (table replaced with actuals); `manifest.test.ts` strict-parses the output |
| 2 | Engine: `data`, `scope`, `hours`, `shares`, `kpi`, `waterfall`, `format` (+ hunter's `trucks-pinned.csv`) | `pinned.test.ts` 100 % of the §7.1 rows both ways; the additional tests of §7.1 |
| 3 | `copy.ts` verbatim from the PBIR text boxes (nerd); **sync point 1:** bip diffs it against the PBIR | `copy.test.ts`: every string of §4 present, no digits |
| 4 | Page: header, chips + popovers, tiles, waterfall table, legend, axis, footnote, tooltip (`view.ts` + components) at 1440 × 810 against the PBIR and the mockup | `next build` green; render check (screenshots in the hand-back) at the Reset state and PT-03; **sync point 2:** nothing on the face that the PBIR does not show, except the §5.4 mockup items |
| 5 | URL state + Copy link | round-trips; the deep links of §6 |
| 6 | Parity (hunter): `parity_selections_trucks.csv` PT-01 … PT-08; bip confirms the pinned-block mapping and captures PT-08 (and the two Reset-state volume tiles) if time allows | 0 `gap` rows; §7.3 rows confirmed or amended in `parity-rules.md` |
| 7 | Pack (nerd; §9) | pack builds from a clean clone: `npm ci && npm run typecheck && npm run lint && npm test && npm run build` |

Step 2 may start on a temporary Node reader of the source Parquet before step 1 is final, but the pinned suite is green only on the shipped files. Expect a first-open round after step 4 (LSN-002): faces live in `view.ts`, the engine stays untouched by it.

## 9. Pack (`.sync/acme-trucks/js-app/`; ADR-0014 items 2, 6, 8)

- Contents = the `js-trucks/` tree **without** `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, `.env*`; **with** `public/data/` prebuilt (≈ 1 MB) and `fixtures/checks/trucks-pinned.csv` (+ `fixtures/data-unfiltered/` if small, else the tests that need it `skip` in the pack as the Marketing pack does). The pack copy drops `prebuild` from `package.json` (no `../pbi-report/` there). README with the `.sync` header (from rusloc/pnl (nerd) · to vosk.dev repo agent · date · status), the gate, the runtime hooks (names only), the 1440 × 810 embed note, the URL keys, the deviations list, the data note (**live extract, pre-aggregated to loader × week; readable on the public page — accepted by the USER 2026-11-08**), and "source of truth = `js-trucks/` in rusloc/pnl; a pack is a copy".
- `.sync/2026-11-04-acme-trucks-handoff.md` gains a dated status line and a `js-app/` row in its "What the pack holds" table; `.sync/README.md › Report packs` gains the row `acme-trucks/js-app/` — from rusloc/pnl (nerd) → vosk.dev repo agent — status — "ACME Trucks standalone Next.js app (one page: six filters, four tiles, waterfall table), 1440 × 810, prebuilt data ≈ 1 MB + pinned-value fixture; N tests, build green; parity 0 gaps (hunter yyyy-mm-dd)". Both edits at pack time, by the packer; not now.
- Issued after step 6, never before. No IDs, no secrets (CLAUDE.md › `.sync/`).

## 10. Assumptions and open USER questions

Assumptions taken (overturn any by a one-line ruling): A1 the live extract as the PBIP reads it is the data, pre-aggregated to loader × week (ADR-0016 (a)); A2 the page "Time util (original)" is not built; A3 light only; A4 the mockup wins over the PBIR on every §5.4 row that was a Power BI limit; A5 the DAX test files are the oracle and are not edited; A6 the fixed filters are applied in the build (replayable for the tests).

| # | Question | Default until answered |
|---|---|---|
| A | **Opening state:** the Reset state (all weeks · Month · Weighted · Trucks + On spot) or the PBIP's saved week 9? | Reset state — the saved week moved three times in three weeks; the mockup header shows a range |
| B | **Board height:** fixed 810 (PBIR × 0.75, 23 px table rows) or let the board grow (the mockup's 28 + 4 px rows need ≈ 1,000 px)? | Fixed 810 — the Power BI embed renders at exactly this density; growth is one CSS variable later |
| C | **Popover apply semantics:** pending until Done (mockup) or apply on each tick (Power BI)? | Done — a six-item checkbox list recomputing on every tick is the Power BI artefact the mockup avoided |
| D | **ⓘ / How to read:** add one How-to-read pop-up (ADR-0012 §2.3) to the JS although the PBI page has none? | No — both flavours stay without; the footnote and the row tooltip are the page's explanation. Revisit at the first-open round |
| E | **Pack timing:** issue the JS pack with the Power BI pack re-issued (the hand-off note gains the `js-app/` row) or alone? | Together with a note update only; the Power BI pack is unchanged |
| F | ~~**Volume tiles at the Reset state** (the one capture gap): accept archi's recomputation or wait for bip's rows?~~ | **Resolved 2026-11-09:** bip captured them in `tests/parity-expected.csv` (232 rows, incl. PT-04 / PT-05 / PT-08); the values equal the recompute |

## 11. The three riskiest rules to mirror

1. **Weighted shares (§3.3, R5):** per-loader ratios over the **active** loaders with DAX blank arithmetic — `null/null = null` but `1 − null = 1`, so an active loader without hour rows dilutes subtotals toward 1 and losses toward 0 by its bucket volume; the fact set never has such a loader-week, the month plan has 28. Getting the active set from "has hours" instead of "has rows" reproduces every pinned row of the fact side and silently misses the plan side on some weeks. Tests: `waterfall_saved` / `waterfall_switches` (266 rows each), the R5 synthetic test.
2. **KPI 3 (§3.4, R6):** Linear total hours under both calculations, times a share whose weighted form has **no** active filter and whose fact numerator includes `Основная работа` through the fact bridge. Using the waterfall's row-27 share instead reproduces nothing. Test: `page-parity` S1–S3 (847 / 762 at S1).
3. **Case folding and the two bridges (§3.2 R1, §2.2):** `Авар. Прост.`, `Консервация/резерв`, `Основная работа → Погрузка` (fact) vs `→ Вспомогательная` (plan), `Переключение / Работа на другом поле / Орошение забоя → Прочие простои`, `Проверка → КФВ`, `КТГ план → КТГ`. One missed fold drops 6,776 fact rows (Авар.) or 527 (Консервация) and moves every fact share. Test: build check 4 (exactly two case-only matches) and tab 1 rows 4 and 15.

from rusloc/pnl (ginee) · to pickup AI agent · 2026-11-04 · status: ready

# ACME Trucks — data generator (pack copy)

Unchanged copies of `data/acme_trucks_dummy_data/generator/` (`generate.py`, `requirements.txt`) and `checks/`
(`verify.py`, `control_totals.csv`, 620 rows) in rusloc/pnl, plus the data README below (the data contract). The generated
Parquet is not in git. The data is a synthetic twin of the live extract the Trucks PBIP was built on: same 14 file names,
column names and Arrow types, synthetic rows.

Run (PowerShell, in `.sync\data-gen`, after the one-time setup in `../README.md`; the pins are the same numpy 2.5.4 / pandas 2.3.3 /
pyarrow 26.0.0 as the other generators):

```powershell
.venv\Scripts\python.exe -I acme-trucks\generator\generate.py   # 14 Parquet + manifest.json into acme-trucks\parquet (~20 s)
.venv\Scripts\python.exe -I acme-trucks\checks\verify.py        # 149 checks incl. a byte-identical rerun; rewrites acme-trucks\checks\control_totals.csv (~30 s)
```

`generate.py` writes into this folder by default (`--out <folder>` elsewhere; `verify.py --data <folder>` checks that folder,
`--no-rerun` skips the rerun). Seed 20261104: the same inputs give the same bytes, so a changed `checks/control_totals.csv` in
`git status` means the generator or its environment changed. Set the Trucks PBIP's `DataFolder` parameter to the full path of
`acme-trucks\parquet`. The Power BI tests that ship with the Trucks report pin the live extract's numbers and need re-basing
before they can be run against this data (see "Power BI tests" below). The "How to run" section of the README below names the
repo layout (`generator\.venv`); in this folder use the shared `..\.venv`.


---

# ACME Trucks — synthetic twin of the live extract

Sample data for the ACME Trucks showcase report (`pbi-report/ACME Trucks/Trucks.pbip`, Import model, Power Query parameter
`DataFolder`). The report reads 14 Parquet files; until now they were an extract of the live source model
(`pbi-report/ACME Trucks/data/`). This folder generates a **synthetic twin**: the same 14 files with the same file names,
column names and Arrow types, the same code domains and relationships, rows of similar volume, and KPI magnitudes in the
same range. **Every row is generated; no row is copied from the extract.** All figures are invented and illustrative.

This README is the data contract. File, column and code names are Russian, exactly as the model's Power Query and DAX read
them. The model's English names (`fact_time_actual`, `dim_loader`, …) are given next to each file.

- **Generator:** `generator/generate.py`, seed **20261104**, numpy / pandas / pyarrow pinned in `generator/requirements.txt`.
  The same inputs give the same bytes.
- **Checks:** `checks/verify.py` recomputes everything from the Parquet files with its own code (149 checks, exit 1 on any
  failure) and writes `checks/control_totals.csv` (620 rows).
- **Calendar span:** 29 Oct 2022 – 2 Apr 2023, as the extract. Fact data 1 Nov 2022 – 26 Mar 2023 (146 days), week plan
  1 Nov 2022 – 31 Mar 2023, month plan 1 Jan – 31 Mar 2023.
- **Size:** 14 files, **1,698,294 rows**, **5.2 MB** of Parquet (extract: 1,690,288 rows, 7.9 MB). No CSV copies.

## How to run

```powershell
cd data\acme_trucks_dummy_data
py -3.12 -m venv generator\.venv                                   # once; .venv is gitignored
generator\.venv\Scripts\python.exe -m pip install -r generator\requirements.txt
generator\.venv\Scripts\python.exe -I generator\generate.py        # writes parquet\ (about 20 s)
generator\.venv\Scripts\python.exe -I checks\verify.py             # 149 checks incl. a byte-identical rerun; writes checks\control_totals.csv (about 30 s)
```

- `generate.py --out <folder>` writes `<folder>\parquet\<file>.parquet` (14 files) and `<folder>\parquet\manifest.json`.
  The default is this folder. `verify.py --data <folder>` checks that folder and writes `<folder>\checks\control_totals.csv`;
  `--no-rerun` skips the determinism rerun (TV-19).
- `requirements.txt` pins numpy 2.5.4, pandas 2.3.3 and pyarrow 26.0.0 plus their transitive dependencies (as the Mirelo,
  Nordmark and ACME Marketing generators). Byte identity depends on these versions.
- Power BI: set the PBIP parameter `DataFolder` to the full path of the `parquet` folder (no trailing backslash) and refresh.
  `manifest.json` in that folder is ignored by the model.

## Files

| File | Model table | Read by the model | Rows (synthetic) | Rows (extract) | Grain (one row per …) |
|---|---|---|---:|---:|---|
| `Calendar.parquet` | `dim_date` | yes | 156 | 156 | day, 29 Oct 2022 – 2 Apr 2023 |
| `Справочник ЭКС.parquet` | `dim_loader` (+ `dim_loader_work_type` built from it in M) | yes | 168 | 168 | loader (excavator) |
| `Справочник разрезов.parquet` | `dim_mine` | yes | 7 | 7 | enterprise (6 mines + 999 КРУ) |
| `ПФ КРВ.parquet` | `fact_time_actual` | yes | 201,392 | 203,867 | loader × day × idle code |
| `План_2.parquet` | `fact_time_plan_week` | yes | 408,218 | 394,056 | loader × day × indicator (week plan) |
| `План_2_МЕС.parquet` | `fact_time_plan_month` | yes | 234,413 | 249,080 | loader × day × indicator (month plan) |
| `ПФ объемы.parquet` | `fact_rock_mass` | yes | 18,922 | 18,684 | loader × day |
| `intervals.parquet` | `fact_interval` | yes | 766 | 891 | loader × month (work scheme) |
| `КРВ АС.parquet` | — | no | 817,687 | 804,526 | haul truck × day × idle code |
| `ПФ Отчет о рейсах.parquet` | — | no | 16,396 | 18,677 | day × excavator (trip report) |
| `Интервалы.parquet` | — | no | 129 | 136 | loader work-scheme interval |
| `AREA_DIM.parquet` | — | no | 13 | 13 | mining area |
| `FIELD_DIM.parquet` | — | no | 21 | 21 | field (block × area) |
| `OFFICE_DIM.parquet` | — | no | 6 | 6 | office (mine) |
| `manifest.json` | — | no | — | — | seed, spans, targets, calibration factors; rows, bytes, sha256, columns per file |

`dim_time_category`, `bridge_fact_time_category`, `bridge_plan_time_category`, `param_plan_type` and `param_calculation`
are M tables inside the model; this dataset feeds them nothing.

## The tested grain

The report's tests pin four KPI tiles at **week "10 (4.3-10.3)" (Sat 4 – Fri 10 Mar 2023) · plan type Month · calculation
Weighted · work type Trucks + On spot**, with the report filter `dim_loader[is_included] = "да"` and the page filter
`dim_loader[contractor]` = blank. The generator scales a few global factors so that this grain lands on its targets;
every other week varies freely around them.

| Tile (measure) | Synthetic plan | Synthetic fact | Target plan / fact | Live extract plan / fact |
|---|---:|---:|---:|---:|
| Truck loading (`KPI Truck Loading Plan / Fact %`) | 43.00 % | 45.00 % | 43.0 / 45.0 % | 42.92 / 45.35 % |
| Effective work time (`KPI Effective Work Plan / Fact %`) | 54.00 % | 51.50 % | 54.0 / 51.5 % | 53.69 / 51.56 % |
| Performance per truck (`Performance per Truck Plan / Fact`, m³/h) | 881.6 | 783.2 | not pinned | 847.0 / 762.5 |
| Mass loaded per truck (`Rock Mass by Truck Plan / Fact`, thousand m³) | 7,299.96 | 7,100.07 | 7,300 / 7,100 | 7,155.96 / 7,028.80 |

The live column is the extract's value of the model's measures (the `_expected_plan` / `_expected_fact` pair of
`tests/page-parity.dax`, tab 2): in the extract, plan truck loading is 42.92 % and fact 45.35 %. Performance follows from
mass and truck-loading hours and is not pinned. All 8 values per week, plan type and calculation are in
`checks/control_totals.csv` (section `kpi`).

## Relationships (the model's, `Trucks.SemanticModel/definition/relationships.tmdl`)

| From (many) | To (one) | Key in the files |
|---|---|---|
| `fact_time_actual`, `fact_time_plan_week`, `fact_time_plan_month` `vehicle_export_code` | `dim_loader.objrem_id` | `ПФ КРВ` / `План_2` / `План_2_МЕС`.`vehicle_export_code` → `Справочник ЭКС.objrem_id` |
| `fact_rock_mass.export_code` | `dim_loader.objrem_id` | `ПФ объемы.Экспортный код` → `objrem_id` |
| `fact_*.dat`, `fact_rock_mass.date` | `dim_date.date` | `dat` / `Дата` → `Calendar.Date` |
| `fact_time_plan_month.enterprise_id` | `dim_mine.enterprise_id` | `План_2_МЕС.enterprise_id` → `Справочник разрезов.enterprise_id` |
| `fact_interval.vehicle_export_code`, `dim_loader.objrem_id` | `dim_loader_work_type.ID` | `intervals.vehicle_export_code` → `objrem_id` (as text) |
| `fact_time_actual.idle_name_for_op_2` (DAX) | `bridge_fact_time_category` → `dim_time_category` | `ПФ КРВ.idle_name_for_op` |
| `fact_time_plan_*.indicat(i)or_name_2` (DAX) | `bridge_plan_time_category` → `dim_time_category` | `План_2` / `План_2_МЕС`.`indicator_name` |

Integrity in the synthetic set: every vehicle code of every file is an `objrem_id` (the haul trucks of `КРВ АС` have
their own codes, never a loader code), every date is a `Calendar.Date`, every enterprise id is in `Справочник разрезов`,
every `area` / `block` / `_id` is a `FIELD_DIM` row.

## Codes the model relies on

**Loader inclusion and scope** (`Справочник ЭКС` → `dim_loader`)

| Column | Model column | Domain | Used by |
|---|---|---|---|
| `Учитывать` | `is_included` | `да` / `нет` (134 / 34) | report filter `is_included = "да"` |
| `Подрядчик` | `contractor` | blank / `да` (165 / 3) | page filter contractor = blank |
| `Филиал` | `branch_name` → `office_name` | Кедровский K1, Моховский M2, Бачатский B1, Калтанский K2, Талдинский T1, Краснобродский K3 | Office slicer (DAX `SWITCH`) |
| `Название ЭКС в ГД` | `loader_name_dispatch` → `loader_name` | 168 names, each one of the model's `loader_name` `SWITCH` list | Loader slicer; the Weighted calculation groups by it |
| `Объем ковша` | `bucket_volume_m3` | 0 – 56 m³; > 0 for every in-scope loader | weight of the Weighted calculation |
| `Комментарий` | `comment` | `автосхема`, `бестранспортная`, `перевалка`, `ЖД схема`, `КР`, `отс. з/част.`, `подряд`, `списание`, blank | — |

**Work type** (`dim_loader_work_type`, a DAX column): the maximum `intervals.vehicle_group_code` of the loader over all its
interval rows: `2` → `автосхема` → **Trucks**, `1` → `Б/Т` → **On spot**, no interval row → **Undefined**, `0` → blank.
In the synthetic set the in-scope loaders (`да`, contractor blank) are 115 Trucks, 14 On spot and 2 Undefined; a month
with group `0` never comes first for a loader, so no loader ends up blank. One contractor loader (`да`, contractor `да`)
has fact rows and work type Undefined, so with Undefined ticked the contractor filter changes the numbers (the S3 case of
`tests/page-parity.dax`).

**Plan type and calculation** (M tables in the model): `param_plan_type` `Месяц` (Month, reads `План_2_МЕС` and the
`… план месяц` columns of `ПФ объемы`) / `Неделя` (Week, reads `План_2` and the `… план` columns); `param_calculation`
`Линейно` (Linear: sums hours) / `Взвешенно` (Weighted: one share per loader, averaged with bucket volume as weight).

**Fact idle codes** (`ПФ КРВ.idle_name_for_op`), with the model's translation `idle_name_for_op_2` and the waterfall row
(`dim_time_category`, sort order) they land on through `bridge_fact_time_category`:

| Code in the file | Waterfall row (sort) | Meaning |
|---|---|---|
| `kfv` | КФВ Total time (1) | calendar time of the loader-day, seconds (86,400; a few 86,387 – 86,399 and 43,200) |
| `ktg` | КТГ Ready for work (6) | `kfv` − (`ТО, ППР` + `КР` + `Авар. Прост.` + `Ожид з/ч`) |
| `kio` | КИО Effective work time (24) | `Основная работа` + `Вспомогательная работа` + `Погрузка самосвалов` |
| `kio_adv` | not counted | max(`kio` − `Ожидание а/с`, 0) |
| `ТО, ППР`, `КР`, `Авар. Прост.`, `Ожид з/ч` | 2, 3, 4, 5 | repairs |
| `Пересменка`, `Обед`, `Личные нужды`, `Заправка`, `Взрывные работы`, `Перегоны`, `Ожидание а/с`, `Консервация/резерв`, `Прочие простои`, `Без классификации` | 7 – 22 | other time losses |
| `Вспомогательная работа` | Auxiliary work (25) | |
| `Основная работа`, `Погрузка самосвалов` | Truck loading (27) | main work of on-spot loaders counts as truck loading in the fact |

On every loader-day the idle codes other than `kfv`, `ktg`, `kio`, `kio_adv` sum exactly to `kfv`. The bridges match
case-insensitively, as VertiPaq does (`Авар. Прост.` = `Авар. прост.`, `Консервация/резерв` = `Консервация/Резерв`).

**Plan indicators** (`План_2` / `План_2_МЕС`.`indicator_name`, `indicator_amount` in hours for time indicators). Time
indicators: `ТО, ППР`, `КР`, `Авар. прост.`, `Ожид з/ч`, `Пересменок`, `Обед`, `Личные нужды`, `Заправка`,
`Взрывные работы`, `Перегоны`, `Переключение`, `Ожидание АС`, `Консервация/Резерв`, `Отсутствие экипажа`,
`Работа на другом поле`, `Прочие простои`, `Орошение забоя`, `Основная работа`, `Вспомогательная работа`,
`Погрузка самосвалов`. Their sum is **24.00 h on every plan day**, and `Проверка` (= КФВ, Total time) carries that sum.
`Переключение`, `Работа на другом поле` and `Орошение забоя` land on Other idles; plan `Основная работа` lands on Auxiliary
work (not Truck loading, unlike the fact); `Отсутствие экипажа` has no bridge row. Derived indicators: `КТГ план`
(24 − repairs, maps to КТГ), `КИО` (work hours), `КИО без ожид. АС`, `Орг. простои план`, `ТО, ППР и КР`,
`Проверка КТГ` (24). Volume and haulage indicators (no bridge row): `Объем ГМ план`, `Объем ГМ на авто план`,
`Вскрыша авто`, `Навалы авто`, `ПГР авто`, `Добыча`, `Вскрыша б/т`, `ПГР`, `Переэкскавация`, `Объем добычи план`,
`Производительность` (= `Объем ГМ на авто план` / `Погрузка самосвалов` × 1000), `Объемный вес`, `Плечо план` /
`порода` / `добыча`, `Техническая скорость план пород.` / `углев.`, `Час. пр-ть ед. АС пород.` / `углев.`, `Грузооборот`,
`АС: Кол-во МС породов.` / `углев.`. `measure_name` has the extract's 13 units (`ч.`, `ч` for `КИО`, `%` for `КТГ план`
and `КИО без ожид. АС`, `Проверка`, `Проверка КТГ`, `тыс. м3`, `тыс. т`, `т/м3`, `км`, `км/ч`, `м3/ч`, `тыс. ткм`, `МС`).
`План_2.Сортировка` is the time indicator's sort code (`1` `ТО, ППР` … `26` `Погрузка самосвалов`) and blank for all
other indicators; `План_2_МЕС.period_id` is always `2`; `_active` is always `1` in all three time facts.

## Columns

Types are Arrow types; `timestamp[us]` columns hold dates at midnight. Nullable means the file has blanks.

- **`Calendar`** — `Date` (key), `Год`, `Месяц`, `Число`, `День недели` (`понедельник` …), `Номер дня недели` (Mon = 1),
  `Номер недели` (Excel `WEEKNUM(d, 2)`), `Начало_недели` / `Конец_недели` (Mon – Sun), `Номер_диапазон`
  (`"1 (26.12-1.1)"`), `День_Месяц` (`"4-мар"`), business week `_weekStartBiz` / `_weekEndBiz` (Sat – Fri),
  `_weekNumBiz` (week 1 ends on the year's first Friday), `_dateSpanBiz` (`"10 (4.3-10.3)"`, the Week slicer),
  `_sortSpan` (Excel serial of `_weekStartBiz`), `_weekDayNum` (Sat = 1), `_dateBiz` (`"Сб-04.03.23"`), `curPeriod`
  (`текущий период` up to 27 Mar 2023, blank after; nullable). Computed from these rules; equal to the extract's calendar.
- **`Справочник ЭКС`** — `objrem_id` int64 (key, synthetic codes), `Филиал`, `Название ЭКС в ГД` (unique), `Название ЭКС в
  АСД КРВ` and `Название ЭКС в АСД Рейсы` (unique, derived from the dispatch name; numeric strings for retired rows),
  `name` / `номер` (model family and number; nullable), `Комментарий` (nullable), `Объем ковша` int64, `Учитывать`,
  `Поле` (`area` of the loader's field, `na` for excluded loaders), `Подрядчик` (nullable).
- **`Справочник разрезов`** — `enterprise_id` int64 (1 – 6, 999), `enterprise_name_short`. **`OFFICE_DIM`** — `_id`,
  `_longName` (`… угольный разрез`), `_shortName`. **`AREA_DIM`** — `_area`, `enterprise_id`. **`FIELD_DIM`** —
  `_field_id` (= `block-area`), `dir_for_plan`, `enterprise_name`, `enterprise_id`, `area`, `block`. These four reference
  tables are the source's code domain and equal the extract.
- **`ПФ КРВ`** — `vehicle_export_code` int64, `vehicle_name` (the loader's `АСД Рейсы` name), `dat`, `idle_name_for_op`,
  `duration` double (whole seconds), `ent_id` (the loader's enterprise), `_active` (1), `area`, `block`, `_id` (the
  loader's field). 133 loaders, 18,221 loader-days, about 11 rows each.
- **`План_2`** / **`План_2_МЕС`** — `enterprise_id`, `dat`, `vehicle_export_code`, `vehicle_name` (dispatch name; blank on
  the month plan of one loader), `indicator_name`, `measure_name`, `indicator_amount` double (2 dp), `Сортировка` (week
  plan only, nullable) or `period_id` (month plan only), `_active`, `area`, `block`, `_id`. Week plan: 130 loaders,
  18,460 loader-days; month plan: 119 loaders, 10,442 loader-days; about 22 indicators per loader-day.
- **`ПФ объемы`** — `Дата`, `Разрез` (the mine's long name), `КФВ` int64 (24), `Экспортный код` int64, and 29 double
  columns in thousand m³ (`Объем добычи …` in thousand t): fact (`… факт`), week plan (`… план`, = the `План_2` volume
  indicators of that day) and month plan (`… план месяц`, = `План_2_МЕС`, 0 before 2023). `Объем ГМ на авто факт` =
  `Вскрыша авто факт` + `Навалы авто факт` + `ПГР авто факт` + `Объем добычи факт` / 1.38; `Объем ГМ …` adds the
  no-truck volumes (`Вскрыша б/т`, `ПГР`, `Переэкскавация`). Fact columns are 0 after 26 Mar 2023. 133 loaders.
- **`intervals`** — `interval_id`, `vehicle_export_code`, `vehicle_group_code` (0 / 1 / 2), `reserve_l` bool,
  `start_dat` / `end_dat` (month start / end, Oct 2022 – Mar 2023). 133 loaders.
- **`КРВ АС`** — haul trucks: `enterprise_id`, `dat`, `vehicle_export_code`, `vehicle_name` (`Б-1nnn`), `idle_name_for_op`
  (loading, hauling loaded / empty, unloading, waiting for loading and the loss codes), `duration` int64 seconds (sum to
  `kfv` per truck-day), `kfv` int64, `ktg` / `kio` (% of `kfv`, 2 dp), `kio_adv` (= `kio`), `vehicle_model_name` (БелАЗ
  models). Totals blank on 5 % of rows, model name on 6 %. 621 trucks, about 550 a day.
- **`ПФ Отчет о рейсах`** — `Дата`, `Экскаватор` (`АСД Рейсы` name, or `Прочие`), `Разрез`, `Грузооборот факт`,
  `Техническая скорость`, `Машиносмены`, `Машиносмены_исходные` (rounded to 0.1), `Плечо_добыча`, `Плечо_Ва_На`,
  `Экспортный код` (int64, blank for `Прочие`).
- **`Интервалы`** — `interval_pf_id`, `vehicle_export_code`, `vehicle_group_code` (1 / 2), `start_dat`, `end_dat`,
  `suser_name` (`dispatcher`), `modi_date`, `area`, `block`. One row per in-scope loader.

## How the data is made

1. **Loaders.** 168 dispatch names (the model's list) get a role (truck loader, on-spot loader, excluded, contractor,
   retired …) with the extract's role counts, a branch, a field, a bucket volume from the model family (ЭКГ-12 → 12 m³,
   Р&Н-2800 → 33 m³, …) and new random codes.
2. **Fact time per loader-day.** Full-day spells (capital repair, waiting for parts, conservation, a day of maintenance
   or accident) run as a state machine with a 60-day run-in; other days draw each loss code with its presence rate and a
   lognormal duration, times a loader factor and a branch × week factor. Auxiliary work is a share of the remaining work
   time; the rest is truck loading (and some main work) for truck loaders, main work for on-spot loaders.
3. **Plans per loader-day.** Fixed norms (shift change, lunch, personal needs), scalable losses and planned events
   (capital repair, …, known to both plans) per loader and plan period (month for `План_2_МЕС`, business week for
   `План_2`); planned truck loading is what is left of 24 h.
4. **Calibration.** Six factors are solved so that the tested grain hits the targets: the fact loss factor (1.12) and
   aux factor, the plan loss factor (1.24) and aux factor (solved on the month plan, reused for the week plan), and one
   mass factor each for fact and plan (1.02 / 0.96). They apply to every loader and day, not only to week 10.
   `manifest.json › calibration` has the values.
5. **Volumes.** Mass = loader rate (≈ 95 × bucket^0.85 m³/h, on-spot loaders 45 % of it) × truck-loading hours (fact) or
   planned truck-loading hours (plan), split into overburden, stockpiles, prep, coal and the no-truck columns.
6. **The other files.** Intervals from the loaders' work schemes; the trip report from fact mass; 621 haul trucks with
   ~10 idle codes a day for `КРВ АС`.

## What differs from the live extract

| # | Difference |
|---|---|
| D-1 | Every fact, plan and volume row is synthetic. Kept as code domains: branch and mine names, areas and fields (the four reference tables equal the extract), the 168 loader dispatch names (the model's `loader_name` `SWITCH`), idle and indicator codes, measure units, truck model names. These names come from the source domain; replacing them needs a model change (the `office_name` and `loader_name` `SWITCH` lists, bip's lane). |
| D-2 | Loader attributes are re-drawn: new `objrem_id` codes (none shared with the extract), branch, field, comment, inclusion flag; bucket volume follows a model-family rule. |
| D-3 | Clean integrity: no orphan vehicle codes (extract: 1 code in facts not in `Справочник ЭКС`, 69 non-loader vehicles in `intervals`, 135 trip-report codes), no duplicate keys (extract: 112 in `План_2_МЕС`, some in `КРВ АС`). |
| D-4 | Exact identities: idle codes sum to `kfv`, `ktg` / `kio` derived from them, `Проверка` = 24.00 h on every plan day (extract: 2.3 – 34.4), `ПФ объемы` plan columns equal the plan indicators, `КРВ АС` durations sum to `kfv` (extract: single durations up to 6 days). |
| D-5 | Fact durations are whole seconds (extract: 17 % with decimals); no negative plan amounts (extract minimum −6.95); no `Метеоусловия` indicator (extract: 3 rows); `Отсутствие экипажа` only as whole plan days. |
| D-6 | `intervals` holds loaders only and whole months (766 rows; extract 891 with 69 other vehicles and one mid-month split). `ПФ Отчет о рейсах` lists the fleet's loaders and `Прочие` only (120 names; extract 268). |
| D-7 | `Интервалы.suser_name` is the placeholder `dispatcher` and `modi_date` a synthetic stamp (extract: a personal login). |
| D-8 | Week plan and month plan are generated, not derived from each other; the week plan is not calibrated on its own (week 10 Week / Weighted: truck loading plan 41.5 %, effective work plan 53.6 %). |
| D-9 | Smaller files (5.2 MB vs 7.9 MB): fewer distinct values. |

## Checks (`checks/verify.py`)

TV-01 files and manifest · TV-02 columns and Arrow types = contract, no schema metadata · TV-03 rows (= manifest and inside a
band around the extract's count), bytes and sha256 · TV-04 calendar rules · TV-05 reference tables · TV-06 loader dim and
its code domains (dispatch names and branches in the model's `SWITCH` lists) · TV-07 work types by the model's rule ·
TV-08 referential integrity · TV-09 idle and indicator codes through the model's bridges, units, sort codes · TV-10 unique
keys · TV-11 date spans · TV-12 `ПФ КРВ` identities · TV-13 plan identities · TV-14 `ПФ объемы` vs the plans · TV-15
`КРВ АС` identities · TV-16 the tested grain (targets ±0.05 pp, mass ±0.1 %, performance 700 – 950 m³/h with plan above
fact, believable plan-fact gaps) · TV-17 the contractor filter matters with Undefined ticked · TV-18 control totals written ·
TV-19 a rerun of `generate.py` into a temp folder is byte-identical.

The KPI engine in `verify.py` re-implements the model's DAX (dim filters, both bridges, Linear and Weighted shares with
DAX's blank rules, truck-loading hours, performance, mass) with pandas and imports nothing from `generator/`. Run on the
live extract it reproduces the model's pinned values exactly: week 10 (`tests/page-parity.dax` tab 2), week 9 and all
data (`tests/baseline-live.csv`, scopes `kpi_saved`, `waterfall_saved`, `waterfall_switches`). The Week-plan and Linear
paths follow the same DAX but have no pinned live value to compare with.

`checks/control_totals.csv` columns: `section` (`rows`, `checksum` = sha256 of the file's rows sorted and written as CSV,
`kpi`), `scope` (file name, business-week label or `ALL`), `plan_type`, `calculation`, `work_types` (`Trucks+On spot`,
with the report and page filters), `metric` (`truck_loading_plan` / `_fact`, `effective_work_…`, `mass_…`,
`performance_…`), `value`. Month-plan rows exist only for weeks with month-plan data (from 31 Dec 2022).

## Power BI tests

The DAX tests in `pbi-report/ACME Trucks/tests/` (`baseline-live*.dax`, `time-util*.dax`, `page-parity.dax` tab 2) pin the
live extract's numbers. On the synthetic set they fail by design; they need re-basing (bip) before they can guard a
report that reads this data, for example from the `kpi` rows of `checks/control_totals.csv`. Row counts change as listed
in the Files table.

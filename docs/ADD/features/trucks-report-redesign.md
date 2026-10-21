# ACME Trucks — "Time util" redesign and English rename (prep)

> **Status 2026-10-21 (bip): BUILT.** "Time util" is rebuilt as "Time utilization" (see §0, the build record). §0 is the record. §1–§6 below are the original prep (DRAFT, projection state); where §0 differs, §0 wins. Superseded parts: hidden pages, Q-01, Q-02, Q-03, Q-06 and Q-14 (decided by the USER), and the popover / chip design (replaced by native dropdown slicers, §0.3).
> Scope: `pbi-report/ACME Trucks/` is a second Power BI showcase report. It sits outside the P&L spec, so no requirement IDs apply. The CLAUDE.md Track B structure lists only the P&L project, so that needs a row (main agent / USER). Adding a second report to Track B looks ADR-worthy.
> Inputs: `Trucks.Report/` (PBIR v4, live connection to "Time unitilaztion" in workspace "Showcase"), mockup `pbi-report/ACME Trucks/Design guide/Main.dc.html` (a reference mockup per its README), USER decisions (all English; only "Time util" is redesigned; hidden pages keep their layout but get English refs; the PBIP goes into git and is embedded on vosk.dev).
> Next: ginee exports the model (`fab export`) and rebuilds it locally in Import mode as `Trucks.SemanticModel`, applying §3 to the TMDL. bip then applies §3 to the PBIR refs and runs §5.

---

## 0. Build record (2026-10-21, bip)

### 0.1 USER decisions applied

| # | Decision | Applied as |
|---|---|---|
| 1 | Data stays as is | No data value, M partition or Parquet file changed. Model column names are English; `sourceColumn` still binds to the Parquet names |
| 2 | Only "Time util" remains | 11 pages, 2 bookmarks and the tooltip-page bindings deleted |
| 3 | All English | Tables, columns, measures, folders, page, captions. Captions fixed in the calculated columns: sort 3 `КР` "Capital repairs" (was "Сonservation" with a Cyrillic С), 14 "Awaiting trucks" (was "Awating"), 15 "Conservation / reserve" (was "Reserved"), 16 "Awaiting operator", plan type "Month" / "Week" (was MONTH / WEEK). M `#table` codes and DAX literals untouched (main agent default) |
| 4 | 1920 × 1080 | Horizontal mockup px × 4/3; vertical compressed (header 72, filter bar 90, KPI tiles 132, waterfall card 706, footnote). Font pt = mockup px, except KPI Plan 18 pt Semibold and Fact 22 pt Bold (mockup 22 / 28), so the 8-digit noisy numbers fit beside the Δ pill |
| 5 | Contractor = blank filter dropped | Page drillthrough binding and its filter removed. New expected values in `tests/time-util.dax` |
| 6 | KPI `RANDBETWEEN` kept | Isolated in `_KPI Noise`; removing it is a one-line change (body → `1`) |

### 0.2 Model (rename map)

| Was | Now |
|---|---|
| `Calendar` · `Справочник ЭКС` · `СПИСОК_ЭКС` · `Справочник простоев` · `Справочник разрезов` | `dim_date` · `dim_loader` · `dim_loader_work_type` · `dim_time_category` · `dim_mine` |
| `PLAN_SWITCHER` · `METRIC_SWITCH` · `Таблица мер` | `param_plan_type` · `param_calculation` · `_measures` |
| `ПФ КРВ` · `План_2` · `План_2_МЕС` · `ПФ объемы` · `intervals` | `fact_time_actual` · `fact_time_plan_week` · `fact_time_plan_month` · `fact_rock_mass` · `fact_interval` |
| `Факт_справочник_прост` · `План_справочник_прост` | `bridge_fact_time_category` · `bridge_plan_time_category` |

Columns: Cyrillic names became snake_case English (each column keeps `sourceColumn` = the Parquet name, so the TMDL shows the old name beside the new one); Latin names stay unless the page uses them. Measures: old → new in `docs/model/trucks-measure-dictionary.md`. Key UI columns: `dim_date[week_label]`, `dim_loader[office_name]`, `dim_loader[loader_name]`, `dim_loader[contractor]`, `dim_loader[is_included]`, `dim_loader_work_type[work_type_name]`, `dim_time_category[category_name]` (sorted by `sort_order`), `param_plan_type[plan_type_name]`, `param_calculation[calculation_name]`.

Removed as orphans once only this page remains (dependency check: `INFO.CALCDEPENDENCY` plus PBIR refs plus relationship paths):
- 241 of 301 measures (none referenced by a kept object);
- tables `Средневзвеш_план`, `Средневзвеш_план_д2`, `Средневзвеш_факт`, `Средневзвеш_факт_Д2` (calculated), `КРВ АС`, `Интервалы`, `ПФ Отчет о рейсах`, `waterfall_DIM`, `D4_METRICS_SWITCH`, `OFFICE_DIM`, `FIELD_DIM`, `AREA_DIM`, and the 4 auto date tables of the removed date columns, with their 15 relationships. Their Parquet files stay in `data/`;
- the 4 custom visuals (none was used).

Kept although no visual reads them: `dim_mine` (on a relationship), the bridge tables (filter path from `dim_time_category` to the facts), every column of the kept tables, auto date/time and its 3 tables.

### 0.3 Page "Time utilization"

| Block | Built with | Deviation from the mockup |
|---|---|---|
| Header | `shape` band, `image` logo (`trucks-logo.svg`), `textbox` title, `cardVisual` with `_Header Context` | none |
| Filter bar | 6 native **dropdown** slicers (Week, Office, Plan type, Calculation, Work type, Loader with search) + `actionButton` "Reset filters" → bookmark `bm_reset` (data only, the 6 slicers) | Chips with popovers are replaced by dropdown slicers: the label sits above the value, the list is Power BI's own, and there is no Clear / Apply footer. Slicer widths are wider than the chips so "Multiple selections" fits |
| KPI tiles | per tile: rounded `shape`, 4 `textbox` labels, 2 `cardVisual` values, 1 `cardVisual` Δ pill (background and text colour by rules on the Δ measure) | Unit sits in its own textbox. Values 20 / 26 pt (see 0.1) |
| Waterfall | one `tableEx`: category, `WF Plan Bar` (SVG), `WF Plan %`, `WF Fact Bar` (SVG), `WF Fact %`, `WF Δ Pill` (SVG); visual filters `is_shown = "1"`, `is_included = "да"`, code not blank; 2 `image` axis strips; legend `textbox` | Subtotal rows use ink text and losses muted text instead of a bolder weight (a table cannot bold one row). Headers are `PLAN %` / `FACT %` instead of `%` / `%` |
| Footnote | `textbox` | none |
| Polish (2026-10-21, round 2) | Fonts in visual expressions use Power BI's font stacks (`'Segoe UI Bold', wf_segoe-ui_bold, helvetica, arial, sans-serif`); filters pane hidden (`outspacePane.visible = false`, affects reading view and the service, Desktop edit view still shows the strip); table uses its default sort (no sort arrow); header reads "Weeks 44 (2022) – 14 (2023)" | — |
| Theme | `acme-trucks-theme.json` (tokens of §1.2; `name` equals the file name, so the old theme-name error is gone) | Segoe UI only (Q-09 default) |

All table SVGs are 594 × 24, the table's image box. Power BI centres a smaller image in that box, which pushed the Δ pill out of its column.

### 0.4 Verification (2026-10-21)

- Desktop gate: `baseline-live.dax` 591/591 TRUE on the USER's refreshed local model, before any edit.
- After the cleanup and rename (own Desktop instance, scratch copy, full refresh): `baseline-live-en.dax` 536/536 TRUE. It has 55 rows fewer: removed tables' row counts and the tooltip-only `_factHours_%%`.
- After the rebuild: `baseline-live-en.dax` 536/536, `time-util.dax` 390/390 TRUE. All 76 measures without error.
- `powerbi-report-author validate`: 0 errors, 0 warnings (baseline 256 / 77).
- Query timings: see the hand-back; every visual query is under 0.6 s cold.

---

## 1. Design brief (from the mockup)

### 1.1 Canvas

The mockup is a 1440 px artboard (`$preview` 1440 × 1080). Its content is about 1091 px tall: header 64, filter bar 57, KPI row 20 + 108, gap 16, waterfall card ≈ 761, footnote 16 + 17, bottom padding 32.

| Option | Page size | Mapping | Fit | Verdict |
|---|---|---|---|---|
| **A (recommended)** | **1440 × 1080** (4:3, the mockup's own artboard) | Every mockup px is used 1:1 for positions. Fonts: pt = px × 0.75, rounded | Fits once the bottom padding drops from 32 to 21 px | Same rule as the P&L Ledger page (1440 × 810, 1:1). Fewest conversions. The embed uses Fit to width |
| B | 1920 × 1440 (4:3) | Every px × 4/3. Fonts: **pt = mockup px exactly** (13 px → 13 pt) | Fits once the bottom padding drops to 28 px | Keeps today's 1920 width and gives whole-number fonts, but the page is taller than today's 1080 |
| C | 1920 × 1080 (today) | × 4/3 across, compressed vertically | Waterfall rows shrink to ≈ 23 px, below the 28 px row plus 4 px gap | Not recommended: 19 rows do not fit at mockup density |

The rest of this brief uses **option A** coordinates (USER decides, Q-03). Page background is `#F3F5F8`, Fit to width.

### 1.2 Tokens

**Colour**

| Token | Hex | Used for |
|---|---|---|
| ink | `#1C2B3A` | header band, primary text, subtotal bars, Apply button, checkbox accent, link hover |
| muted | `#5B6B7D` | labels, units, column headers, chip labels, Plan values, neutral pill text. 5.5:1 on white |
| steel | `#A3AFC4` | header subtitle and context, logo tile, time-loss bars. 6.5:1 on ink |
| link | `#1D6FA5` | Reset filters (text + icon). 5.4:1 on white |
| ground | `#F3F5F8` | page background |
| surface | `#FFFFFF` | cards, filter bar, popovers, chips |
| line | `#E1E6ED` | card borders, filter-bar bottom rule |
| control | `#D6DCE5` | chip, popover and search-box borders |
| divider | `#EEF1F5` | in-card rules (header, table header, popover footer); neutral pill background |
| grid | `#E6EAF0` | bar-track 50 % line and 100 % right edge |
| field | `#F8F9FB` | search input background |
| fav bg / fg / edge | `#E3EEF7` / `#155A88` / `#9CC0DF` | favourable pill (6.3:1); legend swatch border |
| unfav bg / fg / edge | `#FBEADF` / `#9A4511` / `#E8B08B` | unfavourable pill (5.6:1); legend swatch border |
| shadow | `0 12px 32px rgba(28,43,58,0.14)` | popovers only |

The mockup also offers alternates as props: subtotal `#2B3F55` / `#333333`, loss `#8E9BB3` / `#C3CBD9`. Defaults are used. Blue and orange is a colour-blind-safe pair, and the sign is always printed, so colour never carries the meaning alone.

**Type.** The mockup uses Manrope 600/700/800 for display text and numbers, and Inter 400/500/600 (fallback `'Segoe UI', system-ui`) for UI text. Neither font ships with Windows. Power BI renders with fonts installed on the viewer's machine, and SVG images inside visuals can only use system fonts, so the safe set is Segoe UI. This follows the P&L report precedent; Q-09 asks about putting Manrope/Inter first in the theme stacks.

| Role | Mockup | Power BI font | pt (A) | pt (B) |
|---|---|---|---|---|
| App title | Manrope 700, 17 px, −0.01em | Segoe UI Bold | 13 | 17 |
| Card title "Time structure" | Manrope 700, 16 px | Segoe UI Bold | 12 | 16 |
| KPI Fact value | Manrope 800, 28 px, lh 1 | Segoe UI Bold | 21 | 28 |
| KPI Plan value | Manrope 600, 22 px, muted | Segoe UI Semibold | 16 | 22 |
| Body base | Inter 400, 14 px | Segoe UI | 10.5 → 10 | 14 |
| Chips, table rows, popover items | Inter 400/600, 13 px | Segoe UI / Segoe UI Semibold | 10 | 13 |
| KPI title, subtitles, legend, pills, footnote | Inter 600/400, 12 px | Segoe UI Semibold / Segoe UI | 9 | 12 |
| Value labels, units, column headers, popover headings, axis | Inter 400/600, 11 px | Segoe UI / Segoe UI Semibold | 8 | 11 |

Uppercase labels (KPI titles, column headers, popover headings) are typed in capitals, because Power BI has no text-transform. Letter-spacing (0.06–0.08em) is lost. Segoe UI digits are tabular by default, which stands in for `tabular-nums`; confirm in Desktop.

**Spacing, radii, sizes (px, option A)**

| Item | Value |
|---|---|
| Page gutter | header and filter bar 24; main content 48 (the mockup nests a padded `main` inside a 1392 max-width, Q-13) |
| Gaps | KPI grid 16, main column 16, filter chips 8, popover inner 10 / 14, waterfall grid column gap 12, row gap 4 |
| Heights | header 64, filter bar 56 + 1 rule, chip 36, popover button 32, search 34, KPI tile ≈ 108, table row 28, bar 20 |
| Radii | cards and popovers 12, chips and buttons 8, bars 3, legend swatch 3, pills 999 |
| Card padding | KPI 16 / 18, waterfall header 16 / 20, waterfall body 12 / 20 / 16 |
| Logo | 28 × 28 SVG: steel tile `rx 6`, three ink strokes 2.4 px |

**Number formats** (minus sign `−` U+2212, as in the P&L report)

| Value | Format |
|---|---|
| Shares (table) | `0.00%;−0.00%;"–"` (the mockup prints `–` for a zero plan) |
| KPI shares | `0.0%` |
| Δ share (pp, value × 100) | table `+0.00;−0.00;0.00`, KPI pill `+0.00 "pp";−0.00 "pp";0.00 "pp"` |
| Performance, mass | `#,0`, Δ `+#,0;−#,0;0` |
| In-bar subtotal label | whole percent (`77%`) |

No trailing-comma scaling (CLAUDE.md Track B rule).

### 1.3 Page map (option A, 1440 × 1080)

```text
y    0 ┌───────────────────────────────────────────────────────────────────────────────┐
       │ [logo] Truck time utilization                 Weeks 44–52 · Weighted · Month plan│ header 0–64 (ink)
       │        Haul fleet · Plan vs Fact · share of total time                          │
y   64 ├───────────────────────────────────────────────────────────────────────────────┤
       │ [Week All (44–52)▾][Office All▾][Plan type Month▾][Calculation Weighted▾]       │ filter bar 64–120
       │ [Work type On spot, Trucks▾][Loader All (32)▾]                ↺ Reset filters   │ + rule at 120
y  141 │   ┌ KPI 1 ──────┐ ┌ KPI 2 ──────┐ ┌ KPI 3 ──────┐ ┌ KPI 4 ──────┐             │ tiles 141–249
       │   │ x48  w324   │ │ x388        │ │ x728        │ │ x1068       │             │
y  265 │   ┌ Time structure ─────────────────────────── legend ┐                        │ card 265–1026
       │   │ CATEGORY | PLAN bar | % |  | FACT bar | % | Δ pp   │ header band 74, rule
       │   │ 19 rows × (28 + 4)                                 │
       │   │ axis 0% 50% 100% under each bar column             │
y 1042 │   Δ is favorable (blue) when …                         │ footnote 1042–1059
y 1080 └───────────────────────────────────────────────────────────────────────────────┘
```

Waterfall grid inside the card (body x 69 → 1371): Category 69–239 (170) · gap 12 · Plan bar 251–651 (400) · Plan % 663–733 (70) · spacer 745–773 (28) · Fact bar 785–1185 (400) · Fact % 1197–1267 (70) · Δ 1279–1371 (92). In a table visual the 12 px gaps and the 28 px spacer are folded into column widths and SVG widths: the Fact bar SVG is 440 wide, with 40 px of left padding.

Chips (y 74, h 36): Week x24 w168 · Office x200 w112 · Plan type x320 w140 · Calculation x468 w164 · Work type x640 w208 · Loader x856 w136 · Reset x1306 w110 (right edge 1416). These are fixed widths sized for the longest expected text, because a Power BI button does not hug its content. Popovers open at chip x, y 116. Widths: Week 260, Office 220, Plan type 200, Calculation 200, Work type 200, Loader 280. Heights are about 386, 284, 105, 105, 185 and 428.

### 1.4 Blocks: mockup → Power BI

#### Header (0–64, ink band)

| Mockup | Power BI | Substitute |
|---|---|---|
| Ink band, full width | `shape` rectangle 1440 × 64, fill ink, no border | — |
| Logo SVG | `image` visual, static SVG in `RegisteredResources` | — |
| Title + subtitle | one `textbox`, two paragraphs: 13 pt Bold white, then 9 pt steel | −0.01em tracking lost |
| Context "Weeks 44–52 · Weighted calculation · Month plan" | `cardVisual` bound to a new measure `_Header Context` that reads the week range, calculation and plan type. 9 pt steel, right-aligned, transparent, padding 0 (small-card rule) | dot separators become ` · ` characters |

#### Filter bar (64–121) and 6 popover filters + Reset

Power BI has no popover slicer, so each filter is built as a chip, a popover group and bookmarks.

| Part | Power BI | Substitute |
|---|---|---|
| White band + bottom rule | `shape` 1440 × 56 white, plus a `shape` 1440 × 1 `#E1E6ED` | — |
| Chip (label + value + chevron) | `actionButton`, 36 px, radius 8, border `#D6DCE5`. **Text via fx** from a chip measure per filter (`_Chip Week` …): e.g. `Week  All (44–52)`. Chevron as the button icon (custom SVG, right). Action: bookmark `bm_open_<filter>` | The two-tone label (muted "Week" + Semibold value) becomes one weight and one colour (Q-12). Pixel-exact alternative: an SVG chip measure in a `cardVisual` under a transparent button, confirmed in Desktop first |
| Popover panel | group per filter: `shape` (white, border `#D6DCE5`, radius 12, shadow ink at 86 % transparency, blur 32, distance 12, angle 90) + heading `textbox` (`WEEK`, 8 pt Semibold muted) + slicer + footer | — |
| Week, Office, Work type, Loader (checkbox lists) | classic `slicer`, Basic (list) mode, multi-select, **Select all** on (Office has none in the mockup), 10 pt items. Loader: search on (property name from the `powerbi-report-author` catalog) and keep inverted selection mode so "All (32)" survives new loaders. Week: a flat week list (`dim_date[week_label]`), replacing today's week → day hierarchy slicer | Max-height scroll is native. Item row height follows font and padding, not exactly 34 px |
| Plan type, Calculation (radios) | classic `slicer`, single select (renders as radios), `strictSingleSelect` as today | — |
| Clear (multi-select popovers) | `actionButton` → bookmark `bm_clear_<filter>`, which has **Data only**, applies to the selected visual only (that slicer) and restores its default | — |
| Apply | slicers apply immediately, so the button is relabelled **Done** and runs `bm_close` | The batch-apply semantics are lost. Alternative: query-reduction Apply buttons per slicer, but they cannot be styled (Q-10) |
| Backdrop click closes | full-page transparent `actionButton` placed just under the popovers, shown only by the `bm_open_*` bookmarks, action `bm_close` | — |
| Reset filters | `actionButton` (link colour, ↺ icon) → `bm_reset`: Data only, all 6 slicers, default state (Q-17) | "Clear all slicers" would empty the single-select switches, so a bookmark is used instead |

Bookmarks (12): `bm_open_week`, `bm_open_office`, `bm_open_plan_type`, `bm_open_calculation`, `bm_open_work_type`, `bm_open_loader`, `bm_close` (all Display only, selected visuals = the 6 popover groups + backdrop, data off), `bm_clear_week`, `bm_clear_office`, `bm_clear_work_type`, `bm_clear_loader`, `bm_reset` (Data only). Hidden slicers keep filtering. Bookmarks and buttons work in embedded reports.

Chip text measure (pattern; final column names after the export):

```dax
_Chip Office =
VAR _selected     = DISTINCTCOUNT ( dim_loader[office_name] )
VAR _total        =
    CALCULATE (
        DISTINCTCOUNT ( dim_loader[office_name] )
        ,ALL ( dim_loader[office_name] )
    )
VAR _value        =
    SWITCH (
        TRUE ()
        ,NOT ISFILTERED ( dim_loader[office_name] ) || _selected = _total
            ,"All"
        ,_selected = 1
            ,SELECTEDVALUE ( dim_loader[office_name] )
        ,_selected & " selected"
    )
RETURN
    "Office  " & _value
```

`ISFILTERED` reads the slicer's own column, so a Loader selection on the same table does not turn the Office chip into "2 selected".

#### KPI tiles (4 × 324 × 108)

Tiles: **Truck loading** (% of total time) · **Effective work time** (% of total time) · **Performance per truck** (m³/h) · **Mass loaded per truck** (thousand m³). Each tile shows Plan (muted, 16 pt Semibold), Fact (ink, 21 pt Bold) and a Δ pill.

| Part | Power BI | Substitute |
|---|---|---|
| Tile frame | the container of the main `cardVisual`: white, border `#E1E6ED`, radius 12, padding 16 / 18 | — |
| Title + unit | card title `TRUCK LOADING` (9 pt Semibold muted, left), with a small `textbox` for the unit (8 pt muted, right) | the unit sits in its own textbox, because a visual title cannot split left and right |
| Plan + Fact | one `cardVisual` with two values, laid out horizontally. Per-value callout styling: Plan 16 pt Semibold muted, Fact 21 pt Bold ink. Labels "Plan" / "Fact" 8 pt muted above | — |
| Δ pill | a separate small `cardVisual`. Its **container background fx** comes from `_KPI Δ Bg`, its value colour fx from `_KPI Δ Fg`, radius 12, padding 0 (memory: cards ≤ 22 px render empty without zero padding) | none: this is a true pill |
| Data | tiles 1–2: `Time Share Plan %` / `Time Share Fact %` at the "Truck loading" and "Effective work time" rows (new measures, Q-07). Tiles 3–4: today's `_производительность_авто_ПЛАН/ФАКТ` and `ГМ на авто план/факт` (renamed, §3). Values look implausible (Q-04) | — |

Favourable rule for the tiles: higher Fact is favourable for all four. In the mockup, Effective work −0.57 pp is orange and the other three are blue.

The alternative is one `tableEx` holding four SVG tile measures: one query, pixel-exact, but the numbers become images with no accessibility, so it is not recommended.

#### Waterfall table "Time structure" (card 265–1026)

None of the native options fit. The native waterfall has no intermediate subtotals and no Plan | Fact pairing. The current fake (stacked bars with an invisible base series, plus three label tables) cannot keep rows aligned. **Recommended: one `tableEx`** with 19 rows from `dim_time_category`, sorted by `category_name` with sort-by-column `sort_order`. Columns:

| Column | Content | Built with |
|---|---|---|
| CATEGORY | `dim_time_category[category_name]`, 10 pt | font colour fx: subtotal ink, loss muted. **Bold weight per row is not possible in a table**, so colour stands in for weight (Q-16 covers the alternatives) |
| PLAN | `_WF Plan Bar SVG` (data category **ImageUrl**), image 400 × 20 | SVG measure: 50 % grid line, 100 % edge, a floating bar at `left` with width = share, radius 3, ink for subtotals and steel for losses, white in-bar `77%` label on subtotals, min width 2 px |
| % | `Time Share Plan %`, right-aligned | format `0.00%;−0.00%;"–"` |
| FACT | `_WF Fact Bar SVG`, image 440 × 20 (40 px leading pad = gap + spacer) | same SVG pattern |
| % | `Time Share Fact %` | same format |
| Δ FACT − PLAN, PP | `_WF Δ Pill SVG` (ImageUrl): pill min-width 56, padding 3 / 8, colours from the rule below | fallback: `Time Share Δ pp` as text with background and font colour fx. That is native and exportable, but a square cell tint instead of a pill (Q-16) |

- **Grid styling.** No gridlines or banding (white values background, theme `tableAccent` grey). Header row 8 pt Semibold muted in capitals, with a bottom rule `#EEF1F5`. Row padding is tuned to a 32 px pitch. Two columns cannot both be titled `%`, so they are renamed `PLAN %` and `FACT %`.
- **Card chrome.** Comes from the `tableEx` container: title "Time structure" 12 pt Bold, subtitle "Waterfall from total time to truck loading, % of total" 9 pt muted, divider on `#EEF1F5`, border `#E1E6ED`, radius 12.
- **Legend.** One `textbox` over the header band, right-aligned: coloured `■` runs (ink, steel, `#9CC0DF`, `#E8B08B`) + 9 pt muted labels. The swatch radius and the border on the pale swatches are lost. The alternative is a static SVG image.
- **Axis.** `0% 50% 100%` under each bar column, as one static SVG image strip in `RegisteredResources`. A table has no axis row.
- **Visual calculations.** Not used for the bars: a visual calculation cannot be given the ImageUrl data category, and the running offset needs model order. They remain an option for presentation-only text, e.g. a Δ column `[FACT %] - [PLAN %]` in the fallback.
- **Accessibility.** Shares stay as text columns, so Export data and screen readers get the numbers; the bars and pills are decoration. Set alt text on the table.

Waterfall arithmetic (holds in the mockup: 100 − 23.10 = 76.90 ≈ 76.91; 76.91 − 24.01 = 52.90; 52.90 − 11.02 = 41.88). A subtotal bar starts at 0. A loss bar starts at `1 − (cumulative losses up to and including this row)`. This holds only if every subtotal equals 100 % minus the losses above it, and a DAX test pins that (§5 step 6).

```dax
_WF Plan Bar SVG =
VAR _w            = 400
VAR _h            = 20
VAR _kind         = SELECTEDVALUE ( dim_time_category[row_kind] )
VAR _order        = SELECTEDVALUE ( dim_time_category[sort_order] )
VAR _value        = [Time Share Plan %]
VAR _cum_loss     =
    CALCULATE (
        [Time Share Plan %]
        ,ALLSELECTED ( dim_time_category )
        ,dim_time_category[row_kind] = "loss"
        ,dim_time_category[sort_order] <= _order
    )
VAR _left         = IF ( _kind = "subtotal", 0, MAX ( 0, 1 - _cum_loss ) )
VAR _x            = _left * _w
VAR _bar_w        = MAX ( _value * _w, 2 )
VAR _fill         = IF ( _kind = "subtotal", "%231C2B3A", "%23A3AFC4" )
VAR _label        =
    IF (
        _kind = "subtotal"
        ,"<text x='" & FORMAT ( _x + 6, "0", "en-US" )
            & "' y='14' font-family='Segoe UI' font-size='11' font-weight='600' fill='%23FFFFFF'>"
            & FORMAT ( _value * 100, "0", "en-US" ) & "%25</text>"
    )
VAR _svg          =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='" & _w & "' height='" & _h & "'>"
        & "<rect x='" & _w / 2 - 1 & "' width='1' height='" & _h & "' fill='%23E6EAF0'/>"
        & "<rect x='" & _w - 1 & "' width='1' height='" & _h & "' fill='%23E6EAF0'/>"
        & "<rect x='" & FORMAT ( _x, "0.0", "en-US" ) & "' width='" & FORMAT ( _bar_w, "0.0", "en-US" )
        & "' height='" & _h & "' rx='3' fill='" & _fill & "'/>"
        & _label
        & "</svg>"
RETURN
    IF ( NOT ISBLANK ( _value ), _svg )
```

This is a sketch: the final DAX waits for the export and is proven at row grain. In `utf8` data URIs, `#` must be written `%23` and `%` must be written `%25`. `ALLSELECTED` keeps the visual-level filters (`is_shown`, `is_included`) in the running sum.

#### Favourable / unfavourable rule (table Δ and legend)

From the mockup logic: `delta = fact − plan` in pp. If `|delta| < 0.005` the pill is **neutral** (`#EEF1F5` / `#5B6B7D`, text `0.00`). On a subtotal row, delta > 0 is **favourable**; on a loss row, delta < 0 is favourable. Favourable is `#E3EEF7` / `#155A88`, otherwise `#FBEADF` / `#9A4511`. The sign is always printed (`+` / `−`). The rule is also the footnote: "Δ is favorable (blue) when a subtotal grows or a time loss shrinks against plan; unfavorable (orange) otherwise."

```dax
_WF Δ Bg =
VAR _delta        = [Time Share Δ pp]
VAR _kind         = SELECTEDVALUE ( dim_time_category[row_kind] )
VAR _favourable   = IF ( _kind = "subtotal", _delta > 0, _delta < 0 )
VAR _result       =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _delta ) || ABS ( _delta ) < 0.005
            ,"#EEF1F5"
        ,_favourable
            ,"#E3EEF7"
        ,"#FBEADF"
    )
RETURN
    _result
```

`_WF Δ Fg` is the same with `#5B6B7D` / `#155A88` / `#9A4511`. `_KPI Δ Bg/Fg` use `_delta > 0` for all four tiles.

#### Footnote (1042–1059)

A `textbox`, 9 pt muted, x48, width 1344.

### 1.5 Theme

The current `Custom46521764837987445.json` holds only 8 data colours, and its `name` ("Custom") does not match `report.json` (validator ERROR `PBIR_THEME_FILE_NAME_MISMATCH`). The plan is a new theme file whose `name` equals the file name referenced in `report.json`, containing:
- data colours in token order (ink, steel, link, fav fg, unfav fg, muted)
- `background` white, `foreground` ink, `tableAccent` `#EEF1F5`
- text classes: callout Segoe UI Bold 21 ink, title Segoe UI Bold 12, header Segoe UI Semibold 8 muted, label Segoe UI 10 ink
- `visualStyles`: page background ground, visual border `#E1E6ED` radius 12, shadows off, slicer item font 10

### 1.6 Custom visuals: not needed

`Trucks.Report/CustomVisuals` and `report.json` register four: private `SLICER94A562…` ("_SLICER, empty container with matt glass effect", the USER's own) and public `ultimateWaterfall9712…`, `waterfall6C9ED82…` and `ZoomChartsAdvancedWaterfallE77E…`. **No visual on any page uses them**: the only references are in `report.json`. The redesign uses core visuals only.

The plan: remove them from `publicCustomVisuals` and `resourcePackages`, and delete `CustomVisuals/SLICER…`. That is a deletion, so it waits for consent (Q-14). Dropping them also removes the ZoomCharts licence and AppSource load from the embed.

### 1.7 Embedding notes (vosk.dev)

- Fit to width.
- Hidden pages are not navigable in view mode, but they are in the PBIP in git (Q-01).
- Fonts fall back to Segoe UI on viewers' machines.
- Performance target: filter change under 2 s, the same budget as N-01 although this report is outside the spec.
- Expected query visuals on the page: about 22 (6 slicers, 6 chips, header card, 8 KPI cards, 1 table). Today there are 15.

---

## 2. Current state of "Time util"

Page `ReportSectionbdcfb2b87f3167b0ec4f`, 1920 × 1080, the only visible page, and the active page.

- **Page level:**
  - It is a **drillthrough target** on `Справочник ЭКС[Подрядчик]` (requireSingleSelect), with the bound filter saved as `In (null)`. The page therefore shows only rows with a blank contractor (Q-06). The validator warns that the filter is not marked `howCreated: Drillthrough` and that there is no Back button.
  - A **report-level filter** applies `Справочник ЭКС[Учитывать] = 'да'`.
  - The Office and Loader slicers sit in **sync groups** named `Филиал` and `Название ЭКС в ГД` (shared with D1d, D3 and D4).
- **31 objects:** 27 visuals and 4 groups. Positions below are page px; children of groups show their group-relative position.

| Visual (name) | Type | Position | Fields (table.field) | Becomes |
|---|---|---|---|---|
| `ba3ecc7c92d93ed4f8ff` | slicer, list, Select all | 17,59 220×357 | `Calendar._dateSpanBiz` → `Calendar._dateBiz` (hierarchy); saved `9 (25.2-3.3)`; vfilters `Calendar.Date`, `_dateBiz` | **Week** popover (flat week list) |
| `5b6c20122558dcee79c4` | slicer, list | 17,422 220×227 | `Справочник ЭКС._officeAltName` (sync group `Филиал`) | **Office** popover |
| `cf5d6418e692523ce61e` | slicer, strict single | 18,656 219×108 | `PLAN_SWITCHER._typeAltName` = `MONTH`; vfilter `СПИСОК_ЭКС._schema` not blank | **Plan type** popover |
| `8246e4de67f2acf678a3` | slicer, strict single | 17,774 217×116 | `METRIC_SWITCH._metricAltName` = `Weighted`; vfilter `Calendar.Date` | **Calculation** popover |
| `6abcf63da7660d7cc54c` | slicer, multi, no Select all | 17,897 216×165 | `СПИСОК_ЭКС._schemaAltName` = `Trucks`, `On spot`; vfilter `_schema` not blank | **Work type** popover |
| `f8139461d2375e0b4e44` | slicer, inverted selection, Select all | 1627,57 280×1002 | `Справочник ЭКС._loaderAltName` (sync group `Название ЭКС в ГД`) | **Loader** popover with search |
| `ae0a70146b093254d3e2` | group `PLAN` | 244,58 601×845 | — | drop |
| ↳ `e33161b3363acbae9014` | barChart (stacked) | 0,8 540×835 | Category `Справочник простоев._idleCategoryAltName`; Y `_zero`, `_plan_KTG_KIO_WRK_SWITCH` (subtotal), `_plan_LIN_AVGW_BLANK_SWITCH` (invisible base), `_plan_SWTICH_NEW` (loss `#ADB9CA`); vfilters `idle_model_category` not blank, `show = '1'`, `Учитывать = 'да'`; tooltip page **PLAN_TIPS**, tooltips **off** | waterfall **PLAN** column |
| ↳ `8623f3ab1dcc0e24e703` | shape "frame" | 6,0 595×845 | — | drop (card container) |
| ↳ `1262eaedca55019d893b` | shape | 148,66 29×713 | — | drop |
| `08e1ac358ea30ecac08d` | pivotTable "_diff" | 763,72 89×805 | rows `Справочник простоев.idle_model_category`; values `_zero`, `_plan_AVGW_LIN_LABEL_SWITCH`; same 2 vfilters | waterfall **PLAN %** column |
| `a0d7d5e76800c76a9767` | group `FACT` | 869,56 607×845 | — | drop |
| ↳ `df0c3a6560419ddebeb0` | barChart (stacked) | 0,8 541×833 | Category `_idleCategoryAltName`; Y `_zero`, `_fact_BLANK_SWITCH`, `_fact_KTG_KIO_WRK_SWITCH`, `_fact_LIN_AVGW_SWITCH`; same 3 vfilters; tooltip page **FACT_TIPS**, tooltips **off** | waterfall **FACT** column |
| ↳ `d43432b11c77d70633eb` | shape "frame" | 12,0 595×845 | — | drop |
| ↳ `159b59495d950e9c177b` | shape | 146,65 31×713 | — | drop |
| `05747d634b2ed1e723b7` | pivotTable "_diff" | 1388,74 91×805 | rows `idle_model_category`; values `_zero`, `_fact_AVGW_LIN_LABEL_SWITCH` | waterfall **FACT %** column |
| `05c81f450bd5001bcc0c` | pivotTable "_diff" | 1499,72 91×805 | rows `idle_model_category`; values `_zero`, `_plan_fact_DIFF_LABEL` (stale queryRef `AREA._plan_fact_diff_LABEL`) | waterfall **Δ** column |
| `4c1006a894969c68afea` | shape | 1489,57 128×846 | — | drop |
| `43cef6dc1fbbfaa52176` | shape | 0,37 1920×12 | — | drop (header band replaces it) |
| `44f05374881d5eda766a` | group `PlanBottomGroup` | 254,932 596×129 | — | drop |
| ↳ `6b6d153fbbd68a51b59c` | shape "bottomPlanFrame" | 0,0 596×129 | — | drop |
| ↳ `ddd7340eec15ead55800` | textbox | 30,4 307×59 | "Performance per truck / m3/h" | KPI 3 title |
| ↳ `aa1d4bd4a401e786d6b9` | card | 347,9 193×51 | `_производительность_авто_ПЛАН` (display name `Произв-сть`) | **KPI 3 Plan** |
| ↳ `b42a480dc42beeb6f0ce` | textbox | 30,63 309×59 | "Mass loaded per truck / thousands m3" | KPI 4 title |
| ↳ `5198525ac260d5d4791a` | card | 349,60 193×51 | `ГМ на авто план` | **KPI 4 Plan** |
| `c731034919c0f8f5e8ef` | group `FactBottomGroup` | 877,932 596×128 | — | drop |
| ↳ `82a857fc5809658f2401` | shape "bottomPlanFrame" | 0,0 596×129 | — | drop |
| ↳ `bf48fbf946a228f78608` | textbox | 30,4 307×59 | "Performance per truck / m3/h" | drop (duplicate title) |
| ↳ `06d563e98513f436bd21` | card | 347,9 193×51 | `_производительность_авто_ФАКТ` | **KPI 3 Fact** |
| ↳ `e23079984d076c53ce47` | textbox | 30,63 309×59 | "Mass loaded per truck / thousands  m3" | drop (duplicate) |
| ↳ `136d6c62bb0e0f28fb9c` | card | 349,60 193×51 | `ГМ на авто факт` | **KPI 4 Fact** |
| — | — | — | — | new: header, filter bar, chips, popovers, backdrop, Reset, KPI 1–2, Δ pills, table, legend, axis, footnote |

**Tooltip pages referenced** (both are 315 × 75, `type: Tooltip`, and both are switched off on the bars, so they never show today):
- `PLAN_TIPS` (`ReportSection4b740969d3cb26e37a46`): pivotTable `79c5e97a5b8161a8cb87`, rows `Справочник простоев.idle_model_category` (display name `кат.`), value `_planHours` (`часы`).
- `FACT_TIPS` (`ReportSection0315dacfb6a20549ce28`): pivotTable `fa47bf2729084d09c728`, rows `idle_model_category` (`кат.`), values `_factHours_LIN` (queryRef `_factHours`, `часы`) and `_factHours_%%` (`%%`).
- Both pivots are 761 px tall on a 75 px page (validator warning). Re-enabling them on the new table is Q-11.

**Hidden pages: there are 11, not 7.**

| Page | Name | Size |
|---|---|---|
| `Д1_дни` | | 1920 × 1080 |
| `Д3` | also a drillthrough target on `Подрядчик` | 1920 × 1080 |
| `Д4` | target of both bookmarks | 1920 × 1080 |
| `metric test` | | 1920 × 1080 |
| `PLAN_TIPS` | tooltip | 315 × 75 |
| `Д1_месяц` | one clusteredColumnChart with no Y (validator ERROR) | 1920 × 1080 |
| `FACT_TIPS` | tooltip | 315 × 75 |
| `Page 2` | | 1280 × 720 |
| `AVG_W_PLAN` | | 1280 × 720 |
| `AVG_W_FACT` | | 1280 × 720 |
| `ГМ_АВТО` | one card with no query (validator ERROR) | 1280 × 720 |

Bookmarks `items` and `grouped` exist and target D4 only.

**Validator baseline** (`powerbi-report-author validate`, before any edit): 256 errors and 77 warnings.
- Errors: 253 × `PBIR_PROJECTION_MISSING_NATIVE_QUERY_REF` (older Desktop serialisation, which Desktop tolerates), 1 × theme name mismatch, and the 2 broken visuals above.
- Warnings: 63 × duplicate filter names, 6 × textbox height floor, 2 × out-of-bounds tooltip pivots, 6 × drillthrough.

This baseline is what "no new errors" is measured against.

---

## 3. RU → EN glossary

### 3.1 Rules and the split of work

- **Tables:** `dim_` / `fact_` / `param_` snake_case per CLAUDE.md. Measure table `_measures`.
- **Columns:** snake_case (as in the P&L model).
- **Measures:** human-readable Title Case, with `_` prefix for hidden helpers. Δ for deviations, as the P&L model already does (`PL Δ A`).
- **Display folders:** `1 KPI`, `2 Time Structure`, `3 Mining KPIs`, `4 Daily (D1)`, `5 Loader Downtime`, `8 Icons`, `9 Engine`, plus `Design` for the new presentation measures.
- **Source:** every reference was extracted from the PBIR (fields in `queryState`, filters, bookmarks, conditional-format objects, sort) across all 12 pages, the bookmarks and `report.json`. That gives 132 distinct refs: **26 columns and 106 measures** on **8 model tables**, plus 3 entity names that occur only in stale queryRefs.
- **Who applies what** (the boundary in `bip.md` §9 is narrower than the brief):

| Who | Applies |
|---|---|
| ginee, in Power Query / TMDL | table names, column names (as rename steps in M so source names stay mapped), data-value translations (§3.6), dropping or anonymising the sensitive columns (Q-01), `sort_order` and `row_kind` on `dim_time_category` |
| bip, in TMDL, right after | measure renames, display folders, DAX bodies that reference renamed objects, `sortByColumn`, `dataCategory`, formats, descriptions |
| bip, in PBIR | the PBIR pass (§3.8) |

  If the USER prefers ginee to rename the measures as well, bip reviews that diff before the PBIR pass. In either case the PBIR pass waits until the TMDL is final.
- The page codes used in "Used on":

| Code | Page | Code | Page |
|---|---|---|---|
| TU | Time util | D1d | Д1_дни |
| D1m | Д1_месяц | D3 | Д3 |
| D4 | Д4 | MT | metric test |
| PT | PLAN_TIPS | FT | FACT_TIPS |
| P2 | Page 2 | AWP | AVG_W_PLAN |
| AWF | AVG_W_FACT | GMA | ГМ_АВТО |
| BM | bookmarks | RF | report-level filter |

### 3.2 Tables

| # | Current table | Proposed | Kind | Note |
|---|---|---|---|---|
| T01 | `Calendar` | `dim_date` | date dimension (marked date table) | week filter, day and month axes |
| T02 | `Справочник ЭКС` | `dim_loader` | loader (excavator / shovel) dimension | ЭКС = экскаватор; holds sensitive name columns, Q-01 |
| T03 | `Справочник простоев` | `dim_time_category` | time / downtime category dimension (waterfall rows) | needs `sort_order` and `row_kind` (subtotal / loss), §6 |
| T04 | `СПИСОК_ЭКС` | `dim_work_type` | work type (haul scheme): On spot / Trucks / Undefined | name means 'loader list': verify grain after export; if it is loader x work type it becomes `bridge_loader_work_type` |
| T05 | `PLAN_SWITCHER` | `param_plan_type` | disconnected switch: Month / Week plan |  |
| T06 | `METRIC_SWITCH` | `param_calculation` | disconnected switch: Linear / Weighted | `metric` holds RU values, §3.6 |
| T07 | `D4_METRICS_SWITCH` | `param_d4_breakdown` | disconnected switch for page D4 | RU values, §3.6 |
| T08 | `Таблица мер` | `_measures` | measure table | repo convention (the P&L model uses `_measures`) |
| T09 | `AREA` | `_measures` | appears only in stale queryRefs (§3.4) | no field references it: nothing to rename in TMDL |
| T10 | `CalendarPQ` | `dim_date` | appears only in stale queryRefs (§3.4) | no field references it |
| T11 | `D2_METRICS_SWITCH` | `param_d4_breakdown` | appears only in one stale queryRef (§3.4) | no field references it |

### 3.3 Columns (26)

| # | Current `table[column]` | Proposed | Used for | Used on | Note |
|---|---|---|---|---|---|
| C01 | `Calendar[Date]` | `dim_date[date]` | date key; visual-level filter on most pages | TU, D1d, D3, D4, MT, P2, AWP, AWF, BM |  |
| C02 | `Calendar[_dateBiz]` | `dim_date[business_date]` | second level of the TU week slicer | TU, GMA |  |
| C03 | `Calendar[_dateSpanBiz]` | `dim_date[week_label]` | week filter label, e.g. `9 (25.2-3.3)` | TU, D1d, GMA | mockup format `44 (29.10–4.11)`; sort by a week start date |
| C04 | `Calendar[День_Месяц]` | `dim_date[day_month_label]` | day axis on D1d | D1d |  |
| C05 | `Calendar[Месяц]` | `dim_date[month_name]` | month axis on D1m | D1m |  |
| C06 | `Calendar[Номер недели]` | `dim_date[week_number]` | week axis on D1m; header text 'Weeks 44–52' | D1m | year boundary: week 1 follows 52 |
| C07 | `D4_METRICS_SWITCH[metric]` | `param_d4_breakdown[breakdown_code]` | D4 switch | D4, BM | RU values |
| C08 | `METRIC_SWITCH[_metricAltName]` | `param_calculation[calculation_name]` | Calculation filter (Linear / Weighted) | TU | English values already |
| C09 | `METRIC_SWITCH[metric]` | `param_calculation[calculation_code]` | switch key in filters (and measures?) | D1d, MT, AWP, AWF, GMA | RU values `Линейно` / `Взвешенно` |
| C10 | `PLAN_SWITCHER[_typeAltName]` | `param_plan_type[plan_type_name]` | Plan type filter | TU, D1d, D3, D4 | values `MONTH` / `WEEK`; mockup shows `Month` / `Week` |
| C11 | `PLAN_SWITCHER[type]` | `param_plan_type[plan_type_code]` | switch key | MT, BM |  |
| C12 | `СПИСОК_ЭКС[_schema]` | `dim_work_type[work_type_code]` | not-blank filter on slicers | TU, D1d, D3, D4, MT, BM |  |
| C13 | `СПИСОК_ЭКС[_schemaAltName]` | `dim_work_type[work_type_name]` | Work type filter | TU, D1d, D3, D4 | English already (On spot / Trucks / Undefined) |
| C14 | `Справочник ЭКС[_loaderAltName]` | `dim_loader[loader_name]` | Loader filter | TU, D1d, D4 | anonymised (`LDR-…`) |
| C15 | `Справочник ЭКС[_officeAltName]` | `dim_loader[office_name]` | Office filter | TU, D1d, D3, D4 | anonymised (`B1`, `K1` …) |
| C16 | `Справочник ЭКС[enterprise_name]` | `dim_loader[enterprise_name]` | D1m | D1m | **sensitive**: real mine name in literals; drop or anonymise, Q-01 |
| C17 | `Справочник ЭКС[shovel_name_from_indicator]` | `dim_loader[loader_name_indicator]` | D1m, D3, D4 | D1m, D3, D4, MT, BM | **sensitive**: real machine names; drop or anonymise, Q-01 |
| C18 | `Справочник ЭКС[Название ЭКС в ГД]` | `dim_loader[loader_name_dispatch]` | rows and filters on hidden pages; sync group name on TU | D3, D4, MT, P2, AWP, AWF, GMA, BM | **sensitive**: models + serial numbers; drop or anonymise, Q-01 |
| C19 | `Справочник ЭКС[Объем ковша]` | `dim_loader[bucket_volume_m3]` | implicit Sum on P2 | P2 | implicit measure: explicit `Bucket Volume m³` or drop with P2 |
| C20 | `Справочник ЭКС[Подрядчик]` | `dim_loader[contractor]` | drillthrough parameter on TU and D3; filters on D1d | TU, D1d, D3 | TU saves value blank, Q-06 |
| C21 | `Справочник ЭКС[Учитывать]` | `dim_loader[is_included]` | report-level filter `= 'да'` | D3, BM, RF | `да` becomes boolean `true`, §3.6 |
| C22 | `Справочник ЭКС[Филиал]` | `dim_loader[branch_name]` | filters on hidden pages; sync group name on TU | MT, GMA, BM | **sensitive**: real branch names; drop or anonymise, Q-01 |
| C23 | `Справочник простоев[_idleCategoryAltName]` | `dim_time_category[category_name]` | waterfall row label on TU | TU | English already; sort by `sort_order` |
| C24 | `Справочник простоев[idle_model_category]` | `dim_time_category[category_code]` | rows of tooltip and label tables; not-blank filter | TU, D1d, D3, MT, PT, FT, P2, AWP, AWF | values unknown until export |
| C25 | `Справочник простоев[show]` | `dim_time_category[is_shown]` | visual filter `= '1'` | TU, MT | text `'1'` becomes boolean, §3.6 |
| C26 | `Справочник простоев[Учитывать]` | `dim_time_category[is_included]` | visual filter `= 'да'` | TU, D3, D4, MT, P2, AWP, AWF, BM | `да` becomes boolean, §3.6 |

### 3.4 Measures (106, all on `Таблица мер` → `_measures`)

Proposed names are working names. The two `_погрузка_*` pairs collide and are resolved after reading their DAX.

| # | Current `[measure]` | Proposed | Display folder | Used on | Note |
|---|---|---|---|---|---|
| M001 | `_производительность_авто_ФАКТ` | `Performance per Truck Fact` | 1 KPI | TU, D1d, GMA | KPI tile 3 |
| M002 | `_производительность_авто_ПЛАН` | `Performance per Truck Plan` | 1 KPI | TU, D1d, GMA | KPI tile 3; values implausible, Q-04 |
| M003 | `ГМ на авто факт` | `Rock Mass by Truck Fact` | 1 KPI | TU, D1d, D1m, GMA | KPI tile 4 |
| M004 | `ГМ на авто план` | `Rock Mass by Truck Plan` | 1 KPI | TU, D1d, D1m, GMA | KPI tile 4 (mockup: 'Mass loaded per truck'); unit and grain, Q-04 |
| M005 | `ГМ на авто_откл` | `Rock Mass by Truck Δ` | 1 KPI | D1d |  |
| M006 | `_погрузка_ФАКТ_calc` | `Truck Loading Fact` | 1 KPI | GMA | **collision** with `_погрузка_факт_расчет` |
| M007 | `_погрузка_факт_расчет` | `Truck Loading Fact (alt)` | 1 KPI | GMA | see collision note |
| M008 | `_погрузка_ПЛАН_calc` | `Truck Loading Plan` | 1 KPI | GMA | **collision** with `_погрузка_план_расчет`: final names after reading both DAX |
| M009 | `_погрузка_план_расчет` | `Truck Loading Plan (alt)` | 1 KPI | GMA | see collision note; may be hours, not % |
| M010 | `_factHours` | `Fact Hours` | 2 Time Structure | GMA |  |
| M011 | `_factHours_%%` | `Fact Hours %` | 2 Time Structure | FT |  |
| M012 | `_factHours_LIN` | `Fact Hours Linear` | 2 Time Structure | FT |  |
| M013 | `_factHours_AVG_W` | `Fact Hours Weighted` | 2 Time Structure | AWF |  |
| M014 | `_factHours_AVG_W_%%` | `Fact Hours Weighted %` | 2 Time Structure | AWF |  |
| M015 | `_planHours` | `Plan Hours` | 2 Time Structure | PT, P2, AWP, GMA |  |
| M016 | `_planHours_AVG` | `Plan Hours Average` | 2 Time Structure | P2 |  |
| M017 | `_planHours_LIN` | `Plan Hours Linear` | 2 Time Structure | P2 |  |
| M018 | `_planHours_AVG_W` | `Plan Hours Weighted` | 2 Time Structure | AWP |  |
| M019 | `_planHours_AVG_W_%%` | `Plan Hours Weighted %` | 2 Time Structure | AWP |  |
| M020 | `Фактический_процент` | `Time Share Fact %` | 2 Time Structure | D3, D4, MT, BM |  |
| M021 | `Фактический_процент_AVG_W` | `Time Share Fact % Weighted` | 2 Time Structure | D3, MT |  |
| M022 | `Плановое_процент` | `Time Share Plan %` | 2 Time Structure | D3, D4, MT, BM |  |
| M023 | `Плановый_процент_AVG_W` | `Time Share Plan % Weighted` | 2 Time Structure | D3, MT |  |
| M024 | `Отклонение_процент` | `Time Share Δ pp` | 2 Time Structure | D3, D4, MT, BM | share of total time (КФВ); confirm pp vs % |
| M025 | `Отклонение_процент_AVGW` | `Time Share Δ pp Weighted` | 2 Time Structure | D3 |  |
| M026 | `_КФВ_факт_расчет_АБС` | `Total Time Hours Fact` | 2 Time Structure | GMA |  |
| M027 | `_КФВ_план_расчет_АБС` | `Total Time Hours Plan` | 2 Time Structure | GMA | КФВ = calendar time fund, АБС = absolute |
| M028 | `Авар_и_ожид_зч_факт` | `Breakdowns and Parts Wait Fact` | 3 Mining KPIs | D1m |  |
| M029 | `Авар_и_ожид_зч_план` | `Breakdowns and Parts Wait Plan` | 3 Mining KPIs | D1m |  |
| M030 | `КИО_факт` | `Effective Work % Fact` | 3 Mining KPIs | D1m |  |
| M031 | `КИО_план` | `Effective Work % Plan` | 3 Mining KPIs | D1m | КИО = equipment utilisation ratio |
| M032 | `Грузооборот_факт` | `Freight Turnover Fact` | 3 Mining KPIs | D1d, D1m |  |
| M033 | `Грузооборот_план` | `Freight Turnover Plan` | 3 Mining KPIs | D1d, D1m |  |
| M034 | `Грузооборот_откл` | `Freight Turnover Δ` | 3 Mining KPIs | D1d | thousand t·km |
| M035 | `Плечо_Ва_На_факт` | `Haul Distance Overburden Fact` | 3 Mining KPIs | D1d, D1m |  |
| M036 | `Плечо_Ва_На_план` | `Haul Distance Overburden Plan` | 3 Mining KPIs | D1d, D1m |  |
| M037 | `Плечо_Ва_На_откл` | `Haul Distance Overburden Δ` | 3 Mining KPIs | D1d | 'Ва+На' meaning to confirm, Q-12 |
| M038 | `Плечо_добыча_факт` | `Haul Distance Production Fact` | 3 Mining KPIs | D1d, D1m |  |
| M039 | `Плечо_добыча_план` | `Haul Distance Production Plan` | 3 Mining KPIs | D1d, D1m |  |
| M040 | `Плечо_добыча_откл` | `Haul Distance Production Δ` | 3 Mining KPIs | D1d | km |
| M041 | `Пр-ть_ЭКС_факт` | `Loader Productivity Fact` | 3 Mining KPIs | D1m |  |
| M042 | `Пр-ть_ЭКС_план` | `Loader Productivity Plan` | 3 Mining KPIs | D1m | m³/h |
| M043 | `ТО_ППР_КР_факт` | `Maintenance and Repairs Fact` | 3 Mining KPIs | D1m |  |
| M044 | `ТО_ППР_КР_план` | `Maintenance and Repairs Plan` | 3 Mining KPIs | D1m |  |
| M045 | `Добыча_факт` | `Production Fact` | 3 Mining KPIs | D1d, D1m |  |
| M046 | `Добыча_план` | `Production Plan` | 3 Mining KPIs | D1d, D1m |  |
| M047 | `Добыча_откл` | `Production Δ` | 3 Mining KPIs | D1d | thousand t |
| M048 | `КТГ_факт` | `Ready for Work % Fact` | 3 Mining KPIs | D1m |  |
| M049 | `КТГ_план` | `Ready for Work % Plan` | 3 Mining KPIs | D1m | КТГ = technical readiness ratio |
| M050 | `ГМ_факт` | `Rock Mass Fact` | 3 Mining KPIs | D1d, D1m |  |
| M051 | `ГМ_план` | `Rock Mass Plan` | 3 Mining KPIs | D1d, D1m |  |
| M052 | `ГМ_откл` | `Rock Mass Δ` | 3 Mining KPIs | D1d | ГМ = горная масса (rock mass) |
| M053 | `Техн_скор_факт` | `Technical Speed Fact` | 3 Mining KPIs | D1d, D1m |  |
| M054 | `Техн_скор_план` | `Technical Speed Plan` | 3 Mining KPIs | D1d, D1m |  |
| M055 | `Техн_скор_откл` | `Technical Speed Δ` | 3 Mining KPIs | D1d | km/h |
| M056 | `Производительность_АС_факт` | `Truck Productivity per Shift Fact` | 3 Mining KPIs | D1d, D1m |  |
| M057 | `Производительность_АС_план` | `Truck Productivity per Shift Plan` | 3 Mining KPIs | D1d, D1m |  |
| M058 | `Производительность_АС_откл` | `Truck Productivity per Shift Δ` | 3 Mining KPIs | D1d | thousand m³ per truck shift; not `Performance per Truck` |
| M059 | `МС_факт` | `Truck Shifts Fact` | 3 Mining KPIs | D1d, D1m |  |
| M060 | `МС_план` | `Truck Shifts Plan` | 3 Mining KPIs | D1d, D1m |  |
| M061 | `МС_откл` | `Truck Shifts Δ` | 3 Mining KPIs | D1d | МС = машино-смены |
| M062 | `_fact_АВАР_ПРОСТОЙ_ОЖИД_AVGW_D1` | `D1 Breakdowns and Parts Wait % Fact` | 4 Daily (D1) | D1d | аварийный простой + ожидание з/ч |
| M063 | `_plan_АВАР_ПРОСТОЙ_ОЖИД_AVGW_D1` | `D1 Breakdowns and Parts Wait % Plan` | 4 Daily (D1) | D1d |  |
| M064 | `_plan_fact_АВАР_ПРОСТОЙ_ОЖИД_DIFF_D1` | `D1 Breakdowns and Parts Wait Δ pp` | 4 Daily (D1) | D1d |  |
| M065 | `_fact_KIO_AVGW_D1` | `D1 Effective Work % Fact` | 4 Daily (D1) | D1d | КИО = equipment utilisation ratio |
| M066 | `_plan_KIO_AVGW_D1` | `D1 Effective Work % Plan` | 4 Daily (D1) | D1d |  |
| M067 | `_plan_fact_KIO_D1_DIFF` | `D1 Effective Work Δ pp` | 4 Daily (D1) | D1d |  |
| M068 | `_fact_ТО_ППР_КР_AVGW_D1` | `D1 Maintenance and Repairs % Fact` | 4 Daily (D1) | D1d | ТО, ППР, КР |
| M069 | `_plan_ТО_ППР_КР_AVGW_D1` | `D1 Maintenance and Repairs % Plan` | 4 Daily (D1) | D1d |  |
| M070 | `_plan_fact_ТО_ППР_D1_DIFF` | `D1 Maintenance and Repairs Δ pp` | 4 Daily (D1) | D1d |  |
| M071 | `_ПРОИЗВОДИТЕЛЬНОСТЬ_ОТКЛОН_Д1` | `D1 Performance per Truck Δ` | 4 Daily (D1) | D1d |  |
| M072 | `_fact_KTG_AVGW_D1` | `D1 Ready for Work % Fact` | 4 Daily (D1) | D1d |  |
| M073 | `_plan_KTG_AVGW_D1` | `D1 Ready for Work % Plan` | 4 Daily (D1) | D1d |  |
| M074 | `_fact_ОЖИДАС_AVGW_D1` | `D1 Waiting for Trucks % Fact` | 4 Daily (D1) | D1d | ожидание АС |
| M075 | `_plan_ОЖИДАС_AVGW_D1` | `D1 Waiting for Trucks % Plan` | 4 Daily (D1) | D1d |  |
| M076 | `_plan_fact_ОЖИДАС_DIFF_D1` | `D1 Waiting for Trucks Δ pp` | 4 Daily (D1) | D1d |  |
| M077 | `_factSwitcher_D4` | `D4 Fact` | 5 Loader Downtime | D4, BM |  |
| M078 | `_planSwitcher_D4` | `D4 Plan` | 5 Loader Downtime | D4, BM |  |
| M079 | `_planFact_D4_dif` | `D4 Δ` | 5 Loader Downtime | D4, BM |  |
| M080 | `Простой_ЭКС_факт` | `Loader Downtime Fact` | 5 Loader Downtime | D3, D4, MT, BM |  |
| M081 | `Простой_ЭКС_план` | `Loader Downtime Plan` | 5 Loader Downtime | D3, D4, MT, BM |  |
| M082 | `Простой_ЭКС_отклонение` | `Loader Downtime Δ` | 5 Loader Downtime | D3, D4, MT, BM |  |
| M083 | `Грузооборот_план_ICON` | `_Freight Turnover Icon` | 8 Icons | D1d |  |
| M084 | `Плечо_Ва_На_план_ICON` | `_Haul Distance Overburden Icon` | 8 Icons | D1d |  |
| M085 | `Плечо_добыча_план_ICON` | `_Haul Distance Production Icon` | 8 Icons | D1d |  |
| M086 | `Добыча_план_ICON` | `_Production Icon` | 8 Icons | D1d |  |
| M087 | `ГМ_план_ICON` | `_Rock Mass Icon` | 8 Icons | D1d |  |
| M088 | `ГМ на авто план ICON` | `_Rock Mass by Truck Icon` | 8 Icons | D1d |  |
| M089 | `Техн_скор_план_ICON` | `_Technical Speed Icon` | 8 Icons | D1d |  |
| M090 | `Производительность_АС_план_ICON` | `_Truck Productivity per Shift Icon` | 8 Icons | D1d |  |
| M091 | `МС_план_ICON` | `_Truck Shifts Icon` | 8 Icons | D1d |  |
| M092 | `_05_КТГ_ФАКТ` | `_D1 Ready for Work Fact (05)` | 9 Engine | D1d | КТГ = technical readiness ratio; compare with `D1 Ready for Work % Fact` |
| M093 | `_D4_caption` | `_D4 Caption` | 9 Engine | D4, BM |  |
| M094 | `_baseLinePlan_AVG_W` | `_Plan Baseline Weighted` | 9 Engine | AWP |  |
| M095 | `_planHoursBTM` | `_Plan Hours Bottom` | 9 Engine | P2 |  |
| M096 | `_planHoursTOP` | `_Plan Hours Top` | 9 Engine | P2 |  |
| M097 | `_fact_AVGW_LIN_LABEL_SWITCH` | `_WF Fact % Label` | 9 Engine | TU | legacy waterfall label (text?) |
| M098 | `_fact_LIN_AVGW_SWITCH` | `_WF Fact Loss` | 9 Engine | TU, MT | legacy waterfall loss series |
| M099 | `_fact_BLANK_SWITCH` | `_WF Fact Spacer` | 9 Engine | TU, MT | legacy waterfall invisible base |
| M100 | `_fact_KTG_KIO_WRK_SWITCH` | `_WF Fact Subtotal` | 9 Engine | TU | legacy waterfall subtotal series |
| M101 | `_plan_AVGW_LIN_LABEL_SWITCH` | `_WF Plan % Label` | 9 Engine | TU | legacy waterfall label (text?) |
| M102 | `_plan_SWTICH_NEW` | `_WF Plan Loss` | 9 Engine | TU, MT | legacy waterfall loss series |
| M103 | `_plan_LIN_AVGW_BLANK_SWITCH` | `_WF Plan Spacer` | 9 Engine | TU | legacy waterfall invisible base |
| M104 | `_plan_KTG_KIO_WRK_SWITCH` | `_WF Plan Subtotal` | 9 Engine | TU | legacy waterfall subtotal series |
| M105 | `_plan_fact_DIFF_LABEL` | `_WF Δ pp Label` | 9 Engine | TU, D1d | legacy Δ label (text?) |
| M106 | `_zero` | `_Zero` | 9 Engine | TU, MT, P2, AWP, AWF | legacy chart helper |

**Stale queryRefs.** 29 of 273 projections carry a `queryRef` that no longer matches their field, because Desktop keeps the queryRef from when the field was first added. The pass rewrites each one to its field's new name, together with every `selector.metadata` in that visual that equals it.

| Stale queryRef / selector string | Files | Its field's new name | Action |
|---|---|---|---|
| `AREA._plan_SWTICH_NEW` | 1 | `_measures._WF Plan Loss` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `AREA._plan_fact_diff_LABEL` | 2 | `_measures._WF Δ pp Label` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `AREA.plan_fact_ОЖИДАС_DIFF_D1` | 1 | `_measures.D1 Waiting for Trucks Δ pp` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `CalendarPQ._dateSpanBiz` | 1 | `dim_date.week_label` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `CalendarPQ.День_Месяц` | 3 | `dim_date.day_month_label` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `D2_METRICS_SWITCH.metric` | 1 | `param_d4_breakdown.breakdown_code` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Sum(Справочник ЭКС.Объем ковша)` | 1 | `Sum(dim_loader.bucket_volume_m3)` | implicit aggregation, not stale: rename the inner column only |
| `Таблица мер._19_ПОГРУЗКА_*BLANK*` | 3 | none | orphan `dataPoint` selector with no projection: drop it (TU visuals are rebuilt anyway) |
| `Таблица мер._D4_planFact_dif` | 1 | `_measures.D4 Δ` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._fact_percent_AVGW_D1` | 2 | `_measures.D1 Ready for Work % Fact` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._planHoursAVG` | 1 | `_measures._Plan Hours Top` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._planHoursAVG1` | 1 | `_measures.Plan Hours Average` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._planHoursAVG_L` | 1 | `_measures.Plan Hours Linear` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._plan_fact_KIO_d1_DIFF` | 1 | `_measures.D1 Effective Work Δ pp` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._plan_percent_AVGW_D1` | 2 | `_measures.D1 Ready for Work % Plan` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер._xxx` | 1 | `_measures.Truck Loading Plan` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер.ГМ на авто_факт` | 4 | `_measures.Rock Mass by Truck Fact` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер.ГМ_на_авто_план` | 3 | `_measures.Rock Mass by Truck Plan` | rewrite to the field's new `table.name`; same string in every selector of that visual |
| `Таблица мер.Плановое_процент_AVG_W` | 2 | `_measures.Time Share Plan % Weighted` | rewrite to the field's new `table.name`; same string in every selector of that visual |

### 3.5 Pages

| Current | Proposed | Note |
|---|---|---|
| Time util | Time utilization | the only visible page; Q-15 |
| Д1_дни | D1 Daily | |
| Д1_месяц | D1 Monthly | |
| Д3 | D3 Downtime Detail | drillthrough on `contractor` |
| Д4 | D4 Rock Mass Detail | bookmark target |
| metric test | Metric Test | candidate to delete, Q-02 |
| PLAN_TIPS | Tooltip Plan Hours | |
| FACT_TIPS | Tooltip Fact Hours | |
| Page 2 | Plan Hours Lab | candidate to delete, Q-02 |
| AVG_W_PLAN | Weighted Plan | |
| AVG_W_FACT | Weighted Fact | |
| ГМ_АВТО | Rock Mass by Truck | |

Page `name`s (`ReportSection…`) are IDs and stay unchanged.

### 3.6 Strings that are not field names

**Projection display names (visual-level renames)**

| Current | EN | Where |
|---|---|---|
| `Произв-сть` | Performance | TU, GMA |
| `ГМ на авто` | Rock mass by truck | GMA |
| `кат.` / `часы` / `%%` | Category / Hours / % | PT, FT |
| `План` / `Факт` / `Отклонение` / `Метрика` | Plan / Fact / Δ / Metric | D4 |
| `План. процент` / `Факт. процент` / `Отклонение процент` | Plan % / Fact % / Δ pp | D3 |
| `план` / `факт` / `экс` | Plan / Fact / Loader | MT |
| `' '` (single space) | keep (deliberately blank headers) | TU |

**Sync group names:** `Филиал` → `office`, `Название ЭКС в ГД` → `loader`. Alternatively drop the sync, because only one page is visible (Q-15).

**UI text on hidden pages** (titles and textboxes; translated in the PBIR pass)

| RU | EN |
|---|---|
| Горно-технические показатели | Mining KPIs |
| Автосамосвалы / Экскаваторы / Экскаватор | Haul trucks / Loaders / Loader |
| План / План: / Факт / Факт: / Откл: | Plan / Plan: / Fact / Fact: / Δ: |
| Горная масса, тыс. м3 · ГМ на авто, тыс. м3 · Горная масса на авто, тыс. м3 · Объем ВГМ, тыс. м3 | Rock mass, thousand m³ · Rock mass by truck, thousand m³ · (same) · Overburden volume, thousand m³ |
| Добыча, тыс. т · Грузооборот, тыс. ткм | Production, thousand t · Freight turnover, thousand t·km |
| Машино-смены · Пр-ть АС, тыс. м3/МС · Пр-ть ЭКС, м3/ч · Техн. скорость, км/ч | Truck shifts · Truck productivity, thousand m³/shift · Loader productivity, m³/h · Technical speed, km/h |
| Плечо добыча, км · Плечо Ва+На, км | Haul distance production, km · Haul distance overburden, km (Q-12) |
| КТГ, % · КИО, % · ТО, ППР и КР, % · Авар. прост. + ожид. з/ч, % · Ожидание АС, % | Ready for work, % · Effective work, % · Maintenance and repairs, % · Breakdowns + parts wait, % · Waiting for trucks, % |
| Дата · Разрез · Схема · Категория времени · Метрика · План факт · По категориям ГМ · По экскаваторам | Date · Mine · Work type · Time category · Metric · Plan vs fact · By rock mass category · By loader |
| Итого процент от КФВ: | Total, % of calendar time: |
| Детализация план-факта по категориям времени и экскаваторам | Plan vs fact by time category and loader |
| План-факт КРУ · План-факт КРУ - детализация простоев · … - детализация горной массы · План-факт по Калтанскому УР | **contain a real company and mine name**: replace with neutral titles ("Plan vs fact", "Plan vs fact — downtime detail", "— rock mass detail", "Plan vs fact — mine") (Q-01) |

**Data values used as literals** (filters, slicer selections). These change only if ginee changes the data. The PBIR literals then follow.

| Literal | Column (new) | Where | Proposal |
|---|---|---|---|
| `'да'` | `is_included` (both dims) | RF, TU, D3, D4, MT, P2, AWP, AWF, BM | M: `да` → boolean `true`; literal becomes `true` |
| `'1'` | `dim_time_category[is_shown]` | TU, MT | M: text → boolean |
| `'Взвешенно'` / `'Линейно'` | `param_calculation[calculation_code]` | D1d, MT, GMA, AWP, AWF | M: → `weighted` / `linear` (or filter on `calculation_name`) |
| `'MONTH'` (and `WEEK`) | `param_plan_type[plan_type_name]` | TU | M: → `Month` / `Week` (the mockup's wording) |
| `'ГМ на авто'` / `'Добыча'` | `param_d4_breakdown[breakdown_code]` | D4, BM | M: English codes |
| `'КТГ'`, `'КИО'`, `'КР'`, `'ТО, ППР'`, `'Авар. прост.'`, `'Ожид з/ч'` | `dim_time_category[category_code]` (?) | D1d, D3, MT | depends on the exported values |
| `'Неделя'` | a switch column (D1d / MT bookmarks) | BM, MT | M: `Week` |
| `'Сб-11.02.23'` | unknown (GMA) | GMA | meaning unknown, Q-12 |
| `'9 (25.2-3.3)'` | `dim_date[week_label]` | TU saved selection | reset to the new default (Q-05) |
| Loader names with serial numbers (`ЭКГ-10 №293`, `HITACHI ЕХ1200-6ВН №HCM18J00L00001826`, `КОМАТSU …`, `Р&Н-4100ХРС …`), `'Калтанский угольный разрез'`, `'Калтанский'`, `'Кедровский'` | `loader_name_dispatch`, `loader_name_indicator`, `enterprise_name`, `branch_name` | D1m, P2, AWP, AWF, MT, GMA | **remove or anonymise** (Q-01): these are real enterprise and machine identifiers |

### 3.7 Reserved: model objects the report does not reference

To be filled after ginee's export. That covers measures, columns and tables that exist in "Time unitilaztion" but are not referenced by any page, including the fact tables (no visual references a fact column directly). For each one: current name → proposed name, kind, keep, hide or drop (with a `pbi-profiler object_usage` or `INFO.CALCDEPENDENCY()` check before any drop), and its display folder. DAX string literals that name objects (`USERELATIONSHIP` arguments, field-parameter tables) are listed here too (rename protocol, three edits).

| Current | Proposed | Kind | Keep / hide / drop | Folder | Note |
|---|---|---|---|---|---|
| _(after export)_ | | | | | |

### 3.8 PBIR application protocol (bip, after the TMDL is final)

1. Backup: copy `Trucks.Report/` to `pbi-report/ACME Trucks/__backup__/` with the `.yyyy-MM-dd-HHmm.bak` suffix. Keep bytes as they are: UTF-8 without BOM, CRLF.
2. Run one scripted pass over the 289 JSON files, driven by a mapping file generated from §3.2–3.6. It rewrites:
   - `SourceRef.Entity`, `From[].Entity`, `Property`
   - `queryRef` and `nativeQueryRef`
   - `selector.metadata`
   - `sortDefinition` and filter fields
   - drillthrough `fieldExpr`
   - sync `groupName`
   - projection `displayName`, page `displayName`, title and textbox text
   - mapped literals

   It never touches `name`, `$schema`, `mobileState.json` or `.platform`. The dry run prints counts per rule before anything is written.
3. Checks:
   - JSON parses.
   - No Cyrillic remains, apart from approved exceptions.
   - Every field ref resolves to an object in the new TMDL.
   - The validator shows no new error types against the §2 baseline.
4. The USER opens the report in Desktop. "Time util" must show the same numbers as the step-0 baseline (§5) before the redesign starts.

---

## 4. Open questions for the USER

| # | Question | Why it matters | Proposal |
|---|---|---|---|
| Q-01 | **Real names in a public repo.** The hidden pages hold literal filter values and titles with real enterprise names (`Калтанский угольный разрез`, `Кедровский`, `КРУ`) and loader serial numbers (`HCM18J00L00001826`, `HCMKAA9060007156`, `№20761`, `№41214`). The model columns behind them (`Филиал`, `enterprise_name`, `Название ЭКС в ГД`, `shovel_name_from_indicator`) are probably not anonymised, unlike the `_…AltName` columns. | The PBIP is committed and the model is embedded on vosk.dev. "The data is anonymised" holds for the `AltName` columns, not for these. | ginee drops or anonymises those columns in the rebuild. bip removes the literals and replaces the titles. Alternatively, delete the hidden pages that depend on them. |
| Q-02 | There are **11 hidden pages, not 7.** Keep all of them? `metric test`, `Page 2` and `ГМ_АВТО` (one broken card) and `Д1_месяц` (one broken chart) look like lab pages. | Each kept page has to be renamed and its strings translated, and each carries Q-01 literals. | Delete `metric test` and `Page 2`; keep the rest. |
| Q-03 | Page size: 1440 × 1080 (A), 1920 × 1440 (B), or keep 1920 × 1080 (C)? | The mockup does not fit 1920 × 1080 at its own density. | A |
| Q-04 | **KPI values look implausible.** "Performance per truck, m³/h" shows Plan 1,115,022 / Fact 5,967,540 (Δ +4,852,518), but a haul truck moves roughly 10²–10³ m³/h. "Mass loaded per truck, thousand m³" shows 140,454 / 240,390, which would be 140 million m³ per truck. `ГМ на авто` reads as rock mass hauled by trucks (a total), not per truck. | Wrong unit, divisor or label; possibly a missing per-truck or per-hour division. | Get definitions, units and grain from the USER; test with DAX after the export; relabel the tiles to what the measures really are. |
| Q-05 | Are the mockup numbers sample values or real ones? Which selection should they match: weeks 44–52 (the mockup header) or week `9 (25.2-3.3)` (saved today)? The mockup's week list also includes `1 (31.12–6.1)`, which conflicts with "Weeks 44–52". | Needed to pick the default state and the DAX test grain. | Treat the mockup numbers as illustrative; the default is "all weeks in the data". |
| Q-06 | "Time util" is a drillthrough target with contractor = blank saved, so today it shows only rows without a contractor. Is that intended (own fleet only)? | It changes every number on the page. | Replace it with an explicit, locked page filter `contractor is blank` and drop the drillthrough binding (fixes 3 validator warnings), or drop it completely. |
| Q-07 | Are KPI tiles 1–2 (Truck loading %, Effective work time %) equal to the Fact and Plan shares of the "Truck loading" and "Effective work time" waterfall rows? | No visual shows them today, so they need new measures. | Yes; measures filter `dim_time_category` to those rows. |
| Q-08 | Translate data values in M (`да`, `Взвешенно`, `MONTH`, the D4 switch values, category codes)? | "All English" includes slicer items and filter literals. | Yes, via ginee in M; the PBIR literals follow (§3.6). |
| Q-09 | Fonts: Segoe UI only, or Manrope/Inter first in the theme stack? | Viewers without the fonts get a different look. | Segoe UI only. |
| Q-10 | Popover footer: instant apply plus "Done" instead of "Apply"? Per-filter "Clear" via 4 bookmarks? | Power BI slicers apply immediately. | Yes to both. |
| Q-11 | Bring back hover tooltips (Plan / Fact hours per category) on the new table, in English? | They exist but are switched off today. | Optional; default no. |
| Q-12 | Domain terms: `Ва+На` (haul distance; overburden?), `ГД` (dispatch?), `Сб-11.02.23` (a saved filter value on GMA), the two `_погрузка_*` measure pairs, and the chip's two-tone label (one weight acceptable?). | Correct English names. | USER confirms. |
| Q-13 | Gutter: the mockup puts header content at x 24 and main content at x 48. Intentional? | Visible misalignment at 1440. | Keep as in the mockup unless told otherwise. |
| Q-14 | Delete the 4 unused custom visuals (folder + `report.json` entries)? | Deletion needs consent. | Yes. |
| Q-15 | Page display name "Time utilization"? Remove the slicer sync groups? | — | Yes / yes. |
| Q-16 | Waterfall table: Δ as an SVG pill (exact look, not exportable) or as a text cell with colour fx (native, square tint)? Category weight replaced by colour? | Fidelity vs accessibility. | SVG pill; colour for category weight. |
| Q-17 | Defaults for Reset: Week all, Office all, Plan type Month, Calculation Weighted, Work type On spot + Trucks (Undefined excluded, as saved today), Loader all? | Defines `bm_reset`. | As listed. |

---

## 5. Execution order (proposed)

| Step | When | Who | What | Verify |
|---|---|---|---|---|
| 0 | **now, before the rebind** | USER (bip prepares the queries) | Record the "Time util" baseline from the live model at today's saved selection: the waterfall shares per category (Plan, Fact, Δ) and the 4 KPI numbers (Desktop: Performance Analyzer → copy query, or export data per visual) | saved as `pbi-report/ACME Trucks/tests/baseline-live.md` |
| 1 | after the export | ginee | `fab export`; rebuild `Trucks.SemanticModel` (Import); tables, columns and values per §3.2, §3.3 and §3.6; Q-01 columns dropped; `sort_order` and `row_kind` added; refresh green; readiness note | TMDL on disk, refresh OK |
| 2 | after step 1 | bip | Read the TMDL, fill §3.7, resolve collisions, rename measures and folders in TMDL, fix the DAX references; USER approves glossary v2 | Desktop opens the model; DAX test set v0 runs |
| 3 | after step 2 | bip | Back up `Trucks.Report/`; rebind `definition.pbir` from `byConnection` to `byPath` → `../Trucks.SemanticModel` | `Get-Process PBIDesktop` empty before the edit |
| 4 | after step 3 | bip | PBIR rename pass (§3.8) on all 12 pages, the bookmarks and `report.json`, including the hidden-page UI strings and page names | JSON parse, Cyrillic grep, validator vs baseline; USER render check, numbers equal step 0 |
| 5 | after step 4 | bip | DAX test set `pbi-report/ACME Trucks/tests/time-util.dax`: shares per category at the default selection, subtotal reconciliation (subtotal = 1 − cumulative losses), KPI values, Δ sign rule | every `_pass` TRUE (USER runs it in DAX query view) |
| 6 | after step 5 | bip | New `Design` measures: `_Header Context`, 6 `_Chip *`, KPI 1–2, `_KPI Δ Bg/Fg`, `_WF Plan/Fact Bar SVG`, `_WF Δ Pill SVG`, `_WF Δ Bg/Fg`, `Time Share Δ pp`; data category ImageUrl on the SVGs; measure dictionary `docs/model/trucks-measure-dictionary.md` | tests still green |
| 7 | after step 6 | bip | Theme file (§1.5); page size and background | validator: theme error gone |
| 8 | after step 7 | bip | Build "Time util" in batches: (a) header, (b) filter bar, chips, popovers, 12 bookmarks, backdrop, (c) KPI tiles, (d) waterfall table, legend, axis, footnote, (e) remove the superseded objects marked "drop" in §2 | validate after each batch; USER Desktop screenshot vs mockup |
| 9 | after step 8 | bip (consent) | Remove the unused custom visuals (§1.6); drop or replace the drillthrough binding (Q-06) | validator |
| 10 | after step 9 | bip | Performance Analyzer (filter change < 2 s), tab order, alt text | timings recorded as the baseline |
| 11 | after step 10 | bip → USER | Git block (one report per commit; `backup/Trucks.pbix` is already ignored by `*.pbix`, `.pbi/localSettings.json` by its rule); CLAUDE.md Track B row and registry entry (main agent) | — |
| 12 | after step 11 | ginee | Publish to the showcase workspace and hand over the embed details; the vosk.dev repo owns the wrapper | refresh, readback |

## 6. Handoff notes for ginee (model needs from the redesign)

- **`dim_time_category`.** Needs:
  - `category_code`, `category_name` (English, from `_idleCategoryAltName`)
  - an integer `sort_order` in waterfall order: Total time → … → Truck loading, 19 rows
  - `row_kind` (`subtotal` for Total time, Ready for work, Effective work time and Truck loading; `loss` for the rest)
  - `is_shown` and `is_included` as booleans

  `category_name` sorts by `sort_order` (bip sets `sortByColumn`).
- **`dim_date`.** `week_label` in the form `44 (29.10–4.11)`, sorted by the week start date so week 1 sorts after week 52. Keep `week_number`.
- **Sensitive columns (Q-01).** Do not load real names; keep the `AltName` columns as the only name columns.
- **Data values.** §3.6 (`да` → boolean, English switch codes).
- **Freshness and latency.** Showcase data is static: one refresh after the rebuild, no schedule needed unless the USER asks.

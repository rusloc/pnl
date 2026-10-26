# Mirelo Sales & Revenue — design tokens ("Flat Ledger" system)

> **DRAFT — projection state.** Design contract for the draft build of the Mirelo Sales & Revenue dashboard in two tracks: Power BI (PBIR, `pbi-report/Mirelo Sales/`) and JS/React (Next.js route `/sales` in `js-report/`). Both builders follow this file and `layout-spec.md`; the mockup `mockup.html` is the visual reference. Governed by ADR-0011 (Proposed). Concept: `docs/ADD/features/sales-revenue-dashboard-concept.md` (§9 addendum) · metric definitions: `metric-flow.html`.
>
> This system is **separate from the P&L "Ledger" system** (`docs/design/design-requirements.md`). Nothing here applies to the ACME Unified P&L. Copy rules that are platform-neutral (parity-rules.md rules 6, 7, 13, 15) are reused as stated in §9.

Date: 2026-10-26 · Author: design agent for the main agent · Reference image: flat "Monthly Sales Summary" sheet supplied by the USER (light-grey panels, dark corner markers, yellow wedge, black display numbers, black + teal lines).

---

## 1. Style Brief (5 lines)

1. **Style:** flat, blocky, print-like data sheet — no shadows, no gradients, no rounded corners above 2 px, no borders on cards; panels are tonal blocks on a warm light-grey ground.
2. **Palette:** warm light greys for ground and panels, black ink for every number and title, **one accent (yellow)** for the header wedge, the active tab and highlight callouts, **one series colour (teal)** next to black on charts; status colours (green / amber / red) appear only as text and small chips.
3. **Type:** one family — **Inter** on the web, **Segoe UI** in Power BI — very large, very bold black display numbers (44 px) over small grey captions (12 px); everything else 11–14 px.
4. **Composition:** 1440 × 810, 12 columns × 100 px, 16 px gutters, 32 px margins, 8-pt vertical rhythm; each card carries a 16 × 16 dark square marker flush in its top-left corner; the header carries a yellow right-angled wedge.
5. **Mirelo mulberry `#9B2360`: dropped from the frame.** Decision: it clashes with the yellow accent (two accents in a one-accent system) and reads as a third series next to black and teal. The brand mark is a black 24 × 24 square with a white "M". Mulberry is reserved for the vosk.dev showcase thumbnail only (outside the frame); if the USER wants it inside, the only allowed place is the 24 × 24 brand square (fill `#9B2360`, white "M"), nowhere else.

---

## 2. Colour tokens

Contrast is computed against the panel colour `#E9E8E4` (relative luminance 0.807) unless stated. Text ≥ 4.5 : 1, graphics (lines, bars) ≥ 3 : 1; a fill below 3 : 1 must always carry a label (relief rule).

### 2.1 Neutral frame

| Token | Hex | Role | Usage | Contrast on panel |
|---|---|---|---|---|
| `ground` | `#F3F2EF` | page background | the 1440 × 810 frame, tabs row, header body | — |
| `panel` | `#E9E8E4` | card surface | every card, the slide-over's body rows | — |
| `panel-2` | `#DEDDD8` | inset surface | table header row, bar tracks, inactive segmented-control cells, chart baseline area | — |
| `line` | `#CFCDC6` | rule | table row rules, chart baseline / axis line, segmented-control borders | — |
| `marker` | `#2F2F2D` | corner marker | the 16 × 16 square in every card's top-left corner; tab underline when the active tab is not yellow (not used) | 12.1 : 1 |
| `ink` | `#111111` | primary ink | titles, display numbers, table values, Actual series, bars | 15.4 : 1 |
| `grey-600` | `#5C5C58` | secondary text | captions, sub-lines, axis labels, table header text, comparator names | 5.2 : 1 |
| `grey-400` | `#7F7E79` | tertiary graphic | Prior-year series line, PY ghost bars (hatched / outlined), disabled text (non-essential) | 3.3 : 1 |
| `grey-300` | `#BDBBB5` | decorative | bubble fills (mid), bar tracks on white, placeholder shapes in wireframes | 1.5 : 1 (decorative only) |
| `white` | `#FFFFFF` | surface-2 | callout box border, slide-over header, picker pop-ups, tooltip surface | — |

### 2.2 Accent and series

| Token | Hex | Role | Usage | Note |
|---|---|---|---|---|
| `accent` | `#FFD54A` | yellow accent | header wedge, active view tab, selected row / selected month fill, callout box fill, highlighted bubble, "selected" state of pickers | black text on it = 14.9 : 1; yellow is never used alone to carry meaning |
| `accent-2` | `#FFE58A` | yellow tint | hover state of tabs and rows, selected-cell tint in matrices | always with ink text |
| `teal` | `#128C94` | series 2 | Budget / comparator series on line charts, second series on bars, "returning" split, markers | 3.3 : 1 on panel; text use only at ≥ 14 px bold (legend labels use `ink` instead) |
| `teal-2` | `#9ED9DD` | series 2 tint | area fill under the teal line (10 % opacity), stacked segment 2, bubble fill (teal variant, unused by default) | decorative |
| `ink` | `#111111` | series 1 | Actual series, main bars, funnel bars | — |
| `grey-400` | `#7F7E79` | series 3 | Prior year (dashed 1.5 px), third market on multi-line charts | — |

Series roles (fixed in every view, both tracks): **Actual = ink solid 2 px with 6 px dot markers · Budget / target = teal solid 2 px with dots · Prior year = grey-400 dashed 1.5 px, no dots · selected / highlighted mark = accent fill with ink 1 px outline.** Categorical charts use at most 4 classes: ink, teal, grey-400, grey-300 — in that order, always with direct labels.

### 2.3 Status (good / watch / off)

| Token | Text hex | Chip fill | Text on chip | Text on panel | Used for |
|---|---|---|---|---|---|
| `good` | `#176B3D` | `#D6EBDC` | 5.2 : 1 | 5.4 : 1 | favourable Δ, "on target" chip, ▲ for ↑ metrics / ▼ for ↓ metrics |
| `watch` | `#8A5A00` | `#FFEBA8` | 5.0 : 1 | 4.8 : 1 | within the watch band (§6), "watch" chip |
| `off` | `#B3261E` | `#F4D4D1` | 4.7 : 1 | 5.3 : 1 | unfavourable Δ beyond the band, "off target" chip |
| `neutral` | `#5C5C58` | `#DEDDD8` | 5.0 : 1 | 5.2 : 1 | context KPIs with no favourable side (◦), "n/a" |

Rules: colour never carries meaning alone — every status value has a glyph (▲ / ▼ / ◦) and a signed number; chips carry a word (Good / Watch / Off). Status colours never fill chart marks; charts use ink / teal / grey only, and the status reads in the label.

### 2.4 Mulberry

`#9B2360` — **not a token of this system.** Reserved for the showcase thumbnail on vosk.dev. See §1 line 5.

---

## 3. Typography

**Web (Track C):** `Inter` from Google Fonts (`wght@400;500;600;700;800`), `font-feature-settings: "tnum" 1, "cv11" 1` on every number. Fallback stack: `Inter, "Segoe UI", system-ui, sans-serif`.
**Power BI (Track B):** `Segoe UI` / `Segoe UI Semibold` / `Segoe UI Bold` (theme `textClasses`), no custom font installs. Inter and Segoe UI share x-height (≈ 0.73 em vs 0.70 em) and tabular digit widths within 3 %, so values land on the same pixels; a 44 px Inter 800 number is ≈ 2 % wider than Segoe UI Bold 33 pt — accepted.

Type scale (px / weight / line-height; Power BI pt = px × 0.75, rounded to the nearest pt Power BI offers):

| Role | Web | Power BI | Colour | Where |
|---|---|---|---|---|
| Display XL | 44 / 800 / 48, letter-spacing −0.02 em | Segoe UI Bold 33 pt | `ink` | hero card value (Overview only) |
| Display L | 28 / 700 / 32, −0.01 em | Segoe UI Bold 21 pt | `ink` | KPI band value (views 2–5), slide-over header value |
| Display S | 18 / 700 / 24 | Segoe UI Bold 14 pt | `ink` | hero card second value (e.g. "€10.2m" next to the count), table totals |
| Page title | 22 / 800 / 28 | Segoe UI Bold 16 pt | `ink` | "Mirelo - Sales & revenue" |
| Card title | 13 / 600 / 16 | Segoe UI Semibold 10 pt | `ink` | every card title (sentence case, no colon) |
| Tab | 14 / 600 / 20 | Segoe UI Semibold 11 pt | `ink` | view tabs |
| Body | 13 / 400 / 20 | Segoe UI 10 pt | `ink` | table cells, picker options |
| Label | 12 / 500 / 16 | Segoe UI Semibold 9 pt | `grey-600` | hero / KPI label above the value, comparator names ("vs Budget") |
| Caption | 12 / 400 / 16 | Segoe UI 9 pt | `grey-600` | sub-lines under values, footnotes, period line in the header |
| Delta | 13 / 700 / 16 | Segoe UI Bold 10 pt | status colour | "▼ −2.4%", "▲ +2.9pp" |
| Axis / legend | 11 / 400 / 14 | Segoe UI 8 pt | `grey-600` | axis ticks, legend text, bubble labels |
| Table header | 11 / 600 / 14, uppercase, +0.04 em | Segoe UI Semibold 8 pt | `grey-600` | column headers |
| Chip | 11 / 600 / 14 | Segoe UI Semibold 8 pt | status text | status chips, filter chips in the slide-over |

Numbers are always tabular and right-aligned in tables; left-aligned in cards.

---

## 4. Spacing, grid, shape

- **Frame:** 1440 × 810 px, never scrolls (16 : 9). Power BI page size = 1440 × 810, `displayOption: FitToPage`; React: a fixed 1440 × 810 board scaled to the embed width with `transform: scale()` (the vosk.dev wrapper owns the scale).
- **Grid:** margin 32 px left / right · 12 columns × 100 px · gutters 16 px → content width 1376 px. Span width `w(n) = 116·n − 16`: 1 → 100, 2 → 216, 3 → 332, 4 → 448, 5 → 564, 6 → 680, 8 → 912, 12 → 1376.
- **Vertical rhythm:** 8-pt. Header 0–64, tabs 64–100, content from y = 116, bottom margin 16 (content ends at y = 794). Row gaps 16 px. Exact y per view in `layout-spec.md`.
- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32.
- **Card padding:** 16 px all sides; title sits at y = 24 from the card top (below the marker's 16 px), chart / content area starts at y = 44.
- **Radius:** 0 on cards, markers, wedge, tabs, bars; 2 px on chips and segmented-control cells; 0 on the slide-over. (Flat = square.)
- **Elevation:** none. No `box-shadow`, no gradients, no card borders. The slide-over uses a 1 px `line` left rule and a 40 % `ink` scrim over the content.

---

## 5. Card anatomy

```
┌■───────────────────────────────┐   ■ = marker 16 × 16, fill #2F2F2D, flush at (0,0)
│  Card title                 ⓘ ↗│   title 13/600 ink at (16, 24); ⓘ info + ↗ "Open …" at the right, 16 px icons
│  Label                         │   hero / KPI only: 12/500 grey-600
│  25.6k  €10.2m                 │   value 44/800 (hero) or 28/700 (KPI band); second value 18/700 after 12 px
│  avg ticket €398 - 97.6 % plan │   sub-line 12/400 grey-600
│  vs Budget   ▼ −2.4%  ▭▭▭▭     │   comparator rows 12/500 label, 13/700 Δ, 80 px diverging bar
│  vs PY       ▲ +16.4% ▭▭▭▭     │
│  ╭ sparkline 13 months ╮       │   hero only: 120 × 44 at the card's right, Actual ink + PY grey-400
└────────────────────────────────┘
```

- **Marker:** 16 × 16, `marker`, no gap to the card edge (it is *part of* the card's corner, as in the reference). It is purely identifying — every card has one, including table cards and wireframe placeholders. Power BI: a 16 × 16 rectangle shape placed at the card's (x, y); React: `::before` pseudo-element on `.card`.
- **Card background:** `panel`, no border, no radius.
- **Title row:** title left; right side holds up to two 16 px glyph buttons: ⓘ (info pop-up, same copy in both tracks) and ↗ ("Open <view>", only on Overview "why" panels). 24 px hit area.
- **Hero card (Overview, 332 × 192):** label → value (+ second value) → sub-line → two comparator rows → sparkline on the right (x 196–316, y 48–92). Comparator rows: name (fixed 84 px, no wrap), Δ text (fixed 64 px, right-aligned), 8 px gap, diverging bar 80 × 6 px with centre tick (`marker` 1 px), fill `good` / `off` bar (= status text colour at 100 %), scale ±20 % (Δ %) and ±5 pp (Δ pp), capped with a 4 px chevron; `watch` band uses the `watch` fill.
- **KPI card (views 2–5, 216 × 120):** label → value → one comparator row (the comparator chosen in the header; the other on hover / tooltip) → sub-line. No sparkline.
- **Chart card:** title row → chart area with 8 px inner inset; legend bottom-left in 11 px when ≥ 2 series.
- **Table card:** title row → table header row on `panel-2` (24 px) → rows 24 px, rules 1 px `line`; selected row `accent`; hover `accent-2`.
- **Callout box:** `accent` fill, 2 px `white` border, 12/600 ink text, 8 px padding, square corners; placed inside a chart card over an empty region; max 2 lines.

---

## 6. Status rules

Thresholds come from `param_thresholds` (one row per metric: `watch_band`, `off_band`, `direction`). Defaults for the draft:

| Metric type | Direction | Good | Watch | Off |
|---|---|---|---|---|
| Counts / amounts vs Budget (loans, principal, new clients, revenue) | ↑ | Δ ≥ 0 % | −5 % ≤ Δ < 0 % | Δ < −5 % |
| Ratios vs Budget or PY (returning %, approval %, attainment %) | ↑ | Δ ≥ 0 pp | −2 pp ≤ Δ < 0 pp | Δ < −2 pp |
| Risk ratios (30+ DPD, 90+, vintage, cost of risk) | ↓ | Δ ≤ 0 pp | 0 pp < Δ ≤ +0.5 pp | Δ > +0.5 pp |
| Time to cash (h) | ↓ | Δ ≤ 0 | 0 < Δ ≤ +0.5 h | Δ > +0.5 h |
| Attainment % (absolute) | ↑ | ≥ 100 % | 95–99.9 % | < 95 % |

Glyphs: ▲ = value went up, ▼ = value went down (direction, never meaning); colour + chip word = meaning (parity rule 15). `n/a` in `neutral` when no comparator exists (e.g. Returning % vs Budget).

---

## 7. Chart styling

Common: no gridlines; one baseline (`line`, 1 px) at zero; y-axis labels 11 px `grey-600` left, max 4 ticks, nice numbers; x-axis labels 11 px `grey-600` with month abbreviations (`Sep`, `Oct`, … ; the year appears once, under January, as `Jan 26`); no axis titles (the card title and unit carry them); plot inset 8 px; tooltip = `white` box, 1 px `line`, 12 px text, values in the number formats of §8; legend bottom-left, 11 px, swatches 12 × 3 (lines) or 12 × 12 (bars).

| Chart | Marks | Power BI | React |
|---|---|---|---|
| **Line** (trend, vs Budget, vs PY) | Actual `ink` 2 px + dots r 3; Budget `teal` 2 px + dots r 3; PY `grey-400` 1.5 px dashed 4-3, no dots; selected month: dot r 4 `accent` fill, `ink` stroke; open months blank | Line chart: `lineStyles` solid / solid / dashed, `markerShape` circle size 3, `showMarker` on Actual + Budget only, `strokeWidth` 2 / 2 / 1; data colours per series; gridlines off; axis font 8 pt | `<svg>` `polyline` + `circle`; `stroke-dasharray="4 3"` for PY |
| **Column / bar** (by channel, by product, stacked) | Actual `ink`; comparator `teal`; PY ghost = `grey-400` 1 px outline, no fill; stacked: ink / teal / grey-400 / grey-300 with direct labels; selected bar `accent` + ink outline; bar gap 40 % | Clustered / stacked column or bar chart; `innerPadding` 40; data labels 8 pt `grey-600` outside end; PY as a second series with `fillOpacity` 0 and border (where unsupported: dashed line series) | `<rect>`; ghost = `fill="none" stroke="#7F7E79"` |
| **Bullet** (attainment by channel / market) | track `panel-2` 8 px; value bar `ink`; target tick 2 × 14 `teal`; % label right | Bar chart + error-bar target marker (or matrix data bars with a target column) | `<rect>` + `<line>` |
| **Bridge / waterfall** (Budget → Actual) | start / end bars `ink`; increases `teal`; decreases `grey-400`; connectors 1 px `line`; labels on every step | Waterfall visual: `increase` teal, `decrease` grey-400, `total` ink; known limitation: the start bar takes the increase colour — accepted, labelled "Budget" | `<rect>` per step |
| **Bubble / scatter** | fills `grey-300` / `grey-400` / `ink` by class, highlighted bubble `accent`; all bubbles 1 px `ink` outline at 60 %; sizes 8–48 px; labels on the 3 largest | Scatter chart: `bubbles` on, `size` field, marker border on, legend bottom; data colours by category | `<circle>` with `stroke="#111" stroke-opacity=".6"` |
| **Funnel** (bar-style, stage order) | horizontal bars `ink`, full-width track `panel-2`; value + "% of previous" labels; drop-offs (declined / abandoned) as `grey-400` thin side bars | Horizontal bar chart in stage sort order (no native funnel visual); conversion % as a second measure in the data label | `<rect>` rows |
| **Heat matrix** (bad rate by product × market) | cells `panel-2` → `grey-300` → `grey-400` → `ink` 4-step scale by value; text ink / white; no colour for the headline (the number is the message) | Matrix with conditional background (4-step rule, same hexes) | `<table>` with class per bin |
| **Sparkline** (hero only) | 120 × 44; Actual `ink` 1.5 px; PY `grey-400` 1 px dashed; last point dot r 3 `ink`; no axes; open months blank | Line chart with every axis / legend / title off, 120 × 44, placed inside the card | `<svg viewBox="0 0 120 44">` |
| **Diverging comparator bar** | 80 × 6, centre tick, fill = status colour | Card (new) reference label + a 80 × 6 bar chart with axis off, or a matrix data bar in the table variant | `<div>` two spans |

Open months under Actual are never plotted (blank), never interpolated.

---

## 8. Number formats

Reporting currency EUR; units chosen per metric, never per card (no "€m / €k" switch in the draft — the Display flyout is out of scope).

| Kind | Format | Examples | Power BI format string (value already divided in DAX) | React `Intl` / helper |
|---|---|---|---|---|
| EUR amounts ≥ 1 m | `€` + 1 dp + `m` | `€10.2m`, `€138.4m` | `"€"#,0.0"m"` on `[Principal EUR m]` (= amount ÷ 1e6) | `fmtEurM(v)` → `€${(v/1e6).toFixed(1)}m` |
| EUR amounts < 1 m | `€` + 0 dp + `k` | `€580k` | `"€"#,0"k"` on `[… EUR k]` | `fmtEurK` |
| EUR unit amounts (ticket, ARPU) | `€` + 0 dp | `€398`, `€4.99` (2 dp only for prices) | `"€"#,0` | `fmtEur0` |
| Counts ≥ 10 k | 1 dp + `k` | `25.6k`, `209.4k` | `#,0.0"k"` on `[… k]` (= count ÷ 1e3) | `fmtK` |
| Counts < 10 k | thousands separator | `1,296`, `40` | `#,0` | `toLocaleString('en-GB')` |
| Percent (ratios) | 1 dp, no space before `%` | `52.4%`, `4.6%` | `0.0%` | `fmtPct` |
| Percent delta (Δ %) | signed, 1 dp, U+2212 for minus | `+16.4%`, `−2.4%` | `+0.0%;−0.0%;0.0%` | `fmtDeltaPct` |
| pp delta | signed, 1 dp + `pp` | `+2.9pp`, `−0.6pp` | `+0.0"pp";−0.0"pp";0.0"pp"` (value in pp units) | `fmtPp` |
| Hours | 1 dp + ` h` | `3.4 h` | `0.0" h"` | `fmtH` |
| Multiples | 1 dp + `×` | `1.3×` | `0.0"×"` | `fmtX` |
| Months | `Sep 2026`; axis `Sep`, `Jan 26` | | `dim_date[month_label]` | `fmtMonth` |
| Blank / n/a | `n/a` in `neutral`; never `0` for missing | | `BLANK()` → "n/a" via `COALESCE` text measure in cards | `'n/a'` |

Rules: minus is always U+2212 (`−`), never a hyphen; `+` always on positive deltas; no trailing-comma scaling in format strings (Power BI renders the commas literally — CLAUDE.md Track B rule); thousands separator `,`, decimal `.`; no space between number and `%` / `k` / `m`, one space before `h`.

---

## 9. Copy rules (shared with the house, reused)

- Separator in header, status and picker text is `" - "` (parity rule 6): `Mirelo - All markets - Sales & revenue - Closed through Sep 2026`.
- Period sentence starts with `Showing` (rule 7): `Showing Sep 2026 - Month - Actual vs Budget and Prior year`.
- Subtitles are built from the selection, never hard-coded (rule 13).
- Arrow = direction, colour = meaning; legend text `▲ up / ▼ down - green = favourable, amber = watch, red = off` (rule 15, adapted to three states).
- Card titles in sentence case, no trailing colon, no units in the title when the value carries them.

---

## 10. Power BI ↔ React parity table

| Element | Power BI (native visual + key properties) | React (component + rendering) | Parity rule |
|---|---|---|---|
| Frame | Page 1440 × 810, background `ground`, no wallpaper, `FitToPage` | `<Board>` fixed 1440 × 810, `ground`, scaled by the host | Same px, same scale rule |
| Header wedge | Shape: right triangle, fill `accent`, no border, at (760, 0) 680 × 64, rotated so the hypotenuse runs top-left → bottom-right | `<svg>` polygon `760,0 1440,0 1440,64` | Same three points |
| Brand mark | Shape: rectangle 24 × 24 `ink` + text box "M" white 14 pt bold (grouped) | `<BrandMark>` div | Same position (32, 20) |
| Page title / period line | Text boxes (title 16 pt bold, period line 9 pt grey-600) | `<Header>` | Copy per §9 |
| Market picker | Slicer, horizontal "tile" style, single select (All · PL · RO · PT); selected cell `ink` with `white` text, others `panel` with 1 px `line` borders (the pickers sit on the yellow wedge, so `accent` cannot mark the selection there) | `<Segmented>` radiogroup | Order and labels identical; All = no filter |
| Period picker | Slicer (Month · QTD · YTD · R12M) + month slicer (dropdown, closed months) feeding `param_period` | `<Segmented>` + `<MonthSelect>` | Same options; default Month · Sep 2026 |
| Comparator | Slicer (Budget · PY) single select | `<Segmented>` | Drives chart series 2 and table Δ column; cards always show both rows |
| View tabs | 5 buttons (fill `accent` when active via bookmark state, else transparent), bookmarks `view_overview … view_revenue` that toggle visual groups | `<Tabs>` with `aria-selected`, state in URL `?view=` | Same names, order, widths (§layout) |
| Card surface | Shape rectangle `panel`, 0 radius, no border | `.card` div | Same x, y, w, h |
| Corner marker | Shape rectangle 16 × 16 `marker` at card origin | `.card::before` | Flush at (0, 0) of the card |
| Card title | Text box 10 pt semibold | `<CardTitle>` | Same string |
| Hero card | Group: shape + Card (new) visual (callout value 33 pt bold, 2 reference labels "vs Budget" / "vs Prior year" with Δ measures and conditional colour) + Line chart 120 × 44 (sparkline, axes off) + 2 small bar charts 80 × 6 (diverging bars) | `<HeroCard>` with inline SVG sparkline and bars | Values from the same measure definitions; formats §8 |
| KPI card | Group: shape + Card (new) (value 21 pt bold, 1 reference label) | `<KpiCard>` | Comparator row = header comparator |
| Line chart | Line chart, §7 row 1 | `<LineChart>` SVG | Same series colours, dash, markers |
| Bar / column | Clustered or stacked bar / column, §7 | `<BarChart>` SVG | 40 % gap, labels outside end |
| Bullet | Bar + error bar (target) | `<Bullet>` SVG | Target tick teal 2 × 14 |
| Bridge | Waterfall visual | `<Waterfall>` SVG | Start-bar colour limitation accepted in B |
| Bubble | Scatter with bubbles | `<Bubble>` SVG | Same size scale 8–48 px |
| Funnel | Horizontal bar chart, stage sort | `<Funnel>` SVG | Same label text "value · % of previous" |
| Heat matrix | Matrix with conditional background | `<HeatTable>` | Same 4-step bins |
| Detail table | Table visual, header `panel-2`, row 24 px, selected row `accent` (conditional), "Show rows" drill-through button | `<DataTable>` row click → slide-over | Same columns, order, formats |
| Slide-over | Hidden drill-through pages `loan_detail` / `client_detail` (720 × 810 page, Back button); row click = drill-through | `<SlideOver>` 720 px from the right, scrim, Esc closes | Same columns; B navigates, C overlays (accepted difference) |
| Info pop-up ⓘ | Button with tooltip page (same text) | `<InfoPopover>` | Copy identical (one source file, `docs/ADD/features/sales-info-popovers.md`, to be written by the builders) |
| Callout box | Text box `accent` fill, `white` 2 px border | `<Callout>` | Same position and text |
| Tooltip | Default tooltip, `white`, 9 pt | `<Tooltip>` | Same measures |
| Status chip | Text measure with conditional font / background colour | `<Chip>` | Same word + glyph |

Accepted platform differences: Power BI drill-through navigates to a page instead of overlaying; Power BI slicer hit areas are native; no keyboard radiogroup in B; Power BI line markers are rendered at visual-level size 3 (≈ 6 px), React r = 3.

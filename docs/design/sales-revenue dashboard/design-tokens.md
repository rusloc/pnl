# Mirelo Sales & Revenue — design tokens ("Flat Ledger" system)

> **DRAFT — projection state.** Design contract for the draft build of the Mirelo Sales & Revenue dashboard in two tracks: Power BI (PBIR, `pbi-report/Mirelo Sales/`) and JS/React (Next.js route `/sales` in `js-report/`). Both builders follow this file and `layout-spec.md`; the mockup `mockup.html` is the visual reference. Governed by ADR-0011 (Proposed). Concept: `docs/ADD/features/sales-revenue-dashboard-concept.md` (§9 addendum) · metric definitions: `metric-flow.html`.
>
> This system is **separate from the P&L "Ledger" system** (`docs/design/design-requirements.md`). Nothing here applies to the ACME Unified P&L. Copy rules that are platform-neutral (parity-rules.md rules 6, 7, 13, 15) are reused as stated in §9.

Date: 2026-10-26 · Author: design agent for the main agent · Reference image: flat "Monthly Sales Summary" sheet supplied by the USER (light-grey panels, dark corner markers, yellow wedge, black display numbers, black + teal lines). The corner markers were taken over at first and removed on 2026-10-27 (§11).

---

## 1. Style Brief (5 lines)

1. **Style:** flat, blocky, print-like data sheet — no shadows, no gradients, no rounded corners above 2 px, no borders on cards; panels are tonal blocks on a warm light-grey ground.
2. **Palette:** warm light greys for ground and panels, black ink for every number and title, **one accent (yellow)** for the header wedge, the active tab and highlight callouts, **one series colour (teal)** next to black on charts; status colours (green / amber / red) appear only as text and small chips.
3. **Type:** one family — **Inter** on the web, **Segoe UI** in Power BI — very large, very bold black display numbers (44 px) over small grey captions (12 px); everything else 11–14 px.
4. **Composition:** 1440 × 810, 12 columns × 100 px, 16 px gutters, 32 px margins, 8-pt vertical rhythm; cards are plain tonal blocks (no marker, no border); the header carries a yellow right-angled wedge. **Visual first, minimum text** (`docs/design/design-requirements.md` §1, USER 2026-10-27): a card face is title · value · delta · status; no sparklines inside cards; explanations only behind ⓘ and one "How to read" per view, in glass pop-ups.
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
| `marker` | `#2F2F2D` | strong neutral | centre tick of the diverging comparator bar, dashed event markers on charts (e.g. the Mar 2026 policy line). _The 16 × 16 corner marker on cards was removed 2026-10-27 (USER review: not actionable)._ | 12.1 : 1 |
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
| Caption | 12 / 400 / 16 | Segoe UI 9 pt | `grey-600` | secondary values line under card values, pop-up body text (no footnotes or period line on the page) |
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
- **Card padding:** 16 px all sides; title / label sits at y = 16 from the card top; chart / content area starts at y = 44.
- **Radius:** 0 on cards, wedge, tabs, bars; 2 px on chips and segmented-control cells; 16 px on glass pop-ups (§5a, house rule); the slide-over is square on its page edges. (Flat = square, glass = soft.)
- **Elevation:** none on the page. No `box-shadow`, no gradients, no card borders. Overlays (pop-ups, slide-over) use the glass style of §5a and a 40 % `ink` scrim where they cover content.

---

## 5. Card anatomy

```
┌────────────────────────────────────┐
│  Card title                      ↗ │   title 13/600 ink at (16, 16); ↗ "Open …" at the right (Overview "why" panels only)
│  Label                   ▼ Watch   │   hero / KPI: label 12/500 grey-600 at (16, 16); hero: status chip top-right
│  24.4k  €9.6m                      │   value 44/800 (hero, y 40) or 28/700 (KPI band, y 40); second value 18/700 after 12 px
│  vs Budget   ▲ +0.4%  ▭▭▭▭▭▭▭▭▭▭   │   comparator rows: 12/500 name (84), 13/700 Δ (64), diverging bar 160 × 6 (hero only)
│  vs PY       ▲ +15.2% ▭▭▭▭▭▭▭▭▭▭   │
│  ⓘ                                 │   one plain upright ⓘ SVG button, 16 × 16, bottom-left of EVERY card and panel
└────────────────────────────────────┘
```

- **Card face = title · value · delta row(s) · status chip. Nothing else** (ADR-0012 §2.3). No marker, no sparkline, no secondary-values line, no sub-line, no footnote, no caption: every sub-metric, definition, formula, caveat and source sits behind the card's ⓘ. The 13-month trend of each Tier-1 metric lives in its "why" panel, not in the card.
- **ⓘ button:** a plain upright "i" in a 1.5 px circle (inline SVG, `currentColor` = `grey-600`, `ink` on hover), 16 × 16, at x 16 and 8 px from the bottom on hero / KPI cards, 10 px on chart panels (the legend starts at x 40), 2 px on table cards (under the last row). Every card and panel has one; the ⓘ never sits in the title row.
- **Status chip** (§2.3, word + glyph) in the top-right corner of hero cards (right 16, top 16); table rows carry a chip in their Status column.
- **Card background:** `panel`, no border, no radius.
- **Title row:** title left; right side holds at most one ↗ "Open <view>" button (Overview "why" panels) or "Show …" (table cards). 24 px hit area.
- **Hero card (Overview, 332 × 192):** label (16, 16) → value baseline y 80 → two comparator rows at y 108 and y 132: name x 16 (w 84, no wrap), Δ text x 100 (w 64, right-aligned), 8 px gap, diverging bar x 172, **160 × 6** with centre tick at x 252 (`marker` 1 px), fill = status colour, scale ±20 % (Δ %) → 4 px per 1 %, ±5 pp (Δ pp) → 16 px per pp, capped at the track end with a 4 px chevron → ⓘ at (16, 168).
- **KPI card (views 2–5, 216 × 120):** label (16, 16) → value (16, 40) → one comparator row at y 80 with name (84) and Δ text (64) only — **no bar** (216 px cannot hold name + Δ + bar; the hero bars carry the scale) → ⓘ at (16, 96). The other comparator is in the ⓘ sub-values.
- **Chart card:** title row → chart area from y 44 (8 px inner inset; height = card − 70 so the x-axis labels clear the ⓘ) → legend bottom-left at x 40, 11 px, when ≥ 2 series → ⓘ.
- **Table card:** title row → table header row on `panel-2` at y 36 (22 px) → rows 22 px (Overview market table: 20 px), rules 1 px `line`; 5 rows visible in views 2–5, 3 in the Overview; selected row `accent`; hover `accent-2`; ⓘ under the last row. No footnote or caption under a table — counts and notes go into the table's ⓘ.
- **Callout box:** `accent` fill, 2 px `white` border, 12/600 ink text, 8 px padding, square corners; placed inside a chart card over an empty region; max 2 lines; carries an event label, never an explanation.

## 5a. Pop-up / glass tokens (explanations and overlays)

House rule (`design-requirements.md` §1): explanations, formulas, sources and caveats live in pop-ups; pop-ups and overlaying windows use the matte / frosted-glass style.

| Token | Value | Usage |
|---|---|---|
| `glass-bg` | `rgba(255, 255, 255, 0.64)` | background of every pop-up and of the slide-over (ADR-0012 §2.5: 60–65 %) |
| `glass-blur` | `backdrop-filter: blur(20px)` | behind the pop-up; Power BI has no blur → see fallback |
| `glass-border` | `1px solid rgba(255, 255, 255, 0.70)` + inner highlight `inset 0 1px 0 rgba(255, 255, 255, 0.6)` | light border and subtle inner highlight |
| `glass-radius` | `16px` | pop-ups; the slide-over keeps square page edges (its left edge gets the 1 px `line` rule) |
| `glass-fallback` | `rgba(255, 255, 255, 0.92)` (≈ `#FAFAF8` on the ground) | `@supports not (backdrop-filter)`, and **Power BI** (tooltip pages / pop-up bookmarks use a solid white 92 % shape with the same border and 16 px corners) |
| `glass-text` | `ink` body 12/400 18 lh; headings 13/700; labels 12/600; secondary `grey-600` | contrast on the glass over `panel` ≥ 12 : 1 for ink |
| `glass-shadow` | none | flat system; the blur and the scrim give the depth |
| Pop-up size | 360 px wide, padding 14 / 20 / 16, max height 440 (scrolls inside when the content is longer) | ⓘ card pop-up: anchored to the ⓘ button, left edge = card x − 4 (clamped to the frame), below the button when it fits (bottom ≤ 802), else above it; "How to read": anchored under its header-right button at x 1048–1408, y 100 |
| ⓘ content | **What it is** (one sentence) · **Why it matters** (one sentence) · **Formula** (in words, with the column names) · **Sub-values** (every number that used to sit on the card face: Budget / PY values, shares, the other comparator, counts) · **Source** (table names) | one shared copy file: `docs/ADD/features/sales-info-popovers.md` (builders); the mockup's `INFO` registry is the first draft of that file |
| How to read content | one per **view**, opened from the header-right button: **Showing** (period - market - currency - comparators - cut-off) · **Cards / Top band** (what the cards compare with, direction rules) · **Panels / Grid** (how the charts read, what clicks do) · **Table** (grain, status rule, drill) · **ⓘ** (where the definitions are) | per view: Overview · Loans issued · Clients · Portfolio quality · Revenue & targets |
| Behaviour | opens on click; one layer open at a time (opening one closes the other and the slide-over); closes on ✕, Escape, outside click, and on a second click of its opener; `role="dialog"`, `aria-haspopup` / `aria-expanded` on the opener; **focus moves into the pop-up on open, Tab is trapped inside, focus returns to the opener on close**; Power BI: tooltip page on hover of ⓘ, bookmark pop-up for How to read (no focus trap, accepted) | |

Filters: the header holds four controls (market, period, month, comparator) — "a handful", so they stay in the header. If a later version adds Display / Versions / Slice, they collapse into one side-bar menu with a glass pop-up (house rule), not into more header pickers.

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
| **Sparkline** | **Not used** (removed 2026-10-27, house rule "no tiny sparkline / mini-line charts inside cards"); trends are full charts in the "why" panels | — | — |
| **Diverging comparator bar** | 160 × 6 (hero) / 80 × 6 (KPI), centre tick, fill = status colour | Card (new) reference label + a bar chart with axis off, or a matrix data bar in the table variant | `<div>` two spans |

Open months under Actual are never plotted (blank), never interpolated.

---

## 8. Number formats

Reporting currency EUR; units chosen per metric, never per card (no "€m / €k" switch in the draft — the Display flyout is out of scope).

| Kind | Format | Examples | Power BI format string (value already divided in DAX) | React `Intl` / helper |
|---|---|---|---|---|
| EUR amounts ≥ 1 m | `€` + 1 dp + `m` | `€10.2m`, `€138.4m` | `"€"#,0.0"m"` on `[Principal EUR m]` (= amount ÷ 1e6) | `fmtEurM(v)` → `€${(v/1e6).toFixed(1)}m` |
| EUR amounts < 1 m | `€` + 0 dp + `k` | `€580k` | `"€"#,0"k"` on `[… EUR k]` | `fmtEurK` |
| EUR unit amounts (ticket, ARPU) | `€` + 0 dp | `€398`, `€4.99` (2 dp only for prices) | `"€"#,0` | `fmtEur0` |
| Counts (loans, clients, subscribers, agents) — **MS-15** | always exact, thousands separator, never abbreviated on card faces, in tables and in pop-ups | `24,410`, `9,796`, `23,408`, `40` | `#,0` | `toLocaleString('en-GB')` |
| Counts as chart data labels | may abbreviate to 1 dp + `k` when the bar / column label would not fit | `3.6k - 37 %` | `#,0.0"k"` on a label measure (= count ÷ 1e3) | `fmtK` (labels only) |
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
- Period sentence starts with `Showing` (rule 7): `Showing Sep 2026 - Month - All markets - EUR - Actual vs Budget and Prior year - closed through Sep 2026`. Since 2026-10-27 it appears **only** in the "How to read" pop-up and as the slide-over title context, never as a line on the page (the applied-filters line under the title was removed).
- Subtitles are built from the selection, never hard-coded (rule 13).
- Arrow = direction, colour = meaning; legend text `▲ up / ▼ down - green = favourable, amber = watch, red = off` (rule 15, adapted to three states).
- Card titles in sentence case, no trailing colon, no units in the title when the value carries them.
- **Comparator row labels (MS-11):** exactly `vs Budget` and `vs PY` on every card (hero and KPI), in both tracks; `vs 100 %`, `vs PY cohort`, `vs PY vintage` where the comparator is not the plain prior year. Chart legends and pop-up text may spell out "Prior year".

---

## 10. Power BI ↔ React parity table

| Element | Power BI (native visual + key properties) | React (component + rendering) | Parity rule |
|---|---|---|---|
| Frame | Page 1440 × 810, background `ground`, no wallpaper, `FitToPage` | `<Board>` fixed 1440 × 810, `ground`, scaled by the host | Same px, same scale rule |
| Header wedge | Shape: right triangle, fill `accent`, no border, at (760, 0) 680 × 64, rotated so the hypotenuse runs top-left → bottom-right | `<svg>` polygon `760,0 1440,0 1440,64` | Same three points |
| Brand mark | Shape: rectangle 24 × 24 `ink` + text box "M" white 14 pt bold (grouped) | `<BrandMark>` div | Same position (32, 20) |
| Page title | Text box, title 16 pt bold at (64, 18); no period / applied-filters line (removed 2026-10-27) | `<Header>` | Copy per §9 |
| Market picker | Slicer, horizontal "tile" style, single select (All · PL · RO · PT); selected cell `ink` with `white` text, others `panel` with 1 px `line` borders (the pickers sit on the yellow wedge, so `accent` cannot mark the selection there) | `<Segmented>` radiogroup | Order and labels identical; All = no filter |
| Period picker | Slicer (Month · QTD · YTD · R12M) + month slicer (dropdown, closed months) feeding `param_period` | `<Segmented>` + `<MonthSelect>` | Same options; default Month · Sep 2026 |
| Comparator | Slicer (Budget · PY) single select | `<Segmented>` | Drives chart series 2 and table Δ column; cards always show both rows |
| View tabs | 5 buttons (fill `accent` when active via bookmark state, else transparent), bookmarks `view_overview … view_revenue` that toggle visual groups | `<Tabs>` with `aria-selected`, state in URL `?view=` | Same names, order, widths (§layout) |
| Card surface | Shape rectangle `panel`, 0 radius, no border, no marker | `.card` div | Same x, y, w, h |
| Card title | Text box 10 pt semibold at (16, 16) | `<CardTitle>` | Same string |
| Hero card | Group: shape + Card (new) visual (callout value 33 pt bold, 2 reference labels "vs Budget" / "vs Prior year" with Δ measures and conditional colour) + 2 bar charts 160 × 6 (diverging bars, axes off) + status chip (text measure with conditional fill) top-right + ⓘ image button bottom-left (tooltip page). No sparkline, no secondary line. | `<HeroCard>` with inline SVG bars, `<Chip>` and `<InfoButton>` | Values from the same measure definitions; formats §8 |
| KPI card | Group: shape + Card (new) (value 21 pt bold, 1 reference label = Δ text only) + ⓘ image button | `<KpiCard>` + `<InfoButton>` | Comparator row = header comparator; no bar |
| ⓘ button | Image (the same SVG exported as PNG @2x, 16 × 16) with action = tooltip page / bookmark, at card x + 16, bottom-left | inline SVG `<button>` | Same glyph, same position on every card |
| Line chart | Line chart, §7 row 1 | `<LineChart>` SVG | Same series colours, dash, markers |
| Bar / column | Clustered or stacked bar / column, §7 | `<BarChart>` SVG | 40 % gap, labels outside end |
| Bullet | Bar + error bar (target) | `<Bullet>` SVG | Target tick teal 2 × 14 |
| Bridge | Waterfall visual | `<Waterfall>` SVG | Start-bar colour limitation accepted in B |
| Bubble | Scatter with bubbles | `<Bubble>` SVG | Same size scale 8–48 px |
| Funnel | Horizontal bar chart, stage sort | `<Funnel>` SVG | Same label text "value · % of previous" |
| Heat matrix | Matrix with conditional background | `<HeatTable>` | Same 4-step bins |
| Detail table | Table visual, header `panel-2`, row 24 px, selected row `accent` (conditional), "Show rows" drill-through button | `<DataTable>` row click → slide-over | Same columns, order, formats |
| Slide-over | Hidden drill-through pages `loan_detail` / `client_detail` (720 × 810 page, Back button), surface = glass fallback (§5a) | `<SlideOver>` 720 px from the right, glass surface, scrim, Esc closes | Same columns; B navigates, C overlays (accepted difference) |
| Info pop-up ⓘ | Tooltip page per card (360 × ≤ 440) styled as the glass fallback (white 92 %, 16 px radius shape, light border); sections What it is · Why it matters · Formula · Sub-values · Source | `<InfoPopover>` glass (§5a), focus-trapped | Copy identical (one source file, `docs/ADD/features/sales-info-popovers.md`, to be written by the builders) |
| "How to read" (per view) | Button header-right on the tabs row → bookmark per view showing a glass-fallback pop-up group at (1048, 100) 360 wide; ✕ bookmark hides it | `<HowToRead view={…}>` glass pop-up, same position, content keyed by view | Same sections per view (Showing · Cards · Panels · Table · ⓘ) |
| Callout box | Text box `accent` fill, `white` 2 px border | `<Callout>` | Same position and text |
| Tooltip | Default tooltip, `white`, 9 pt | `<Tooltip>` | Same measures |
| Status chip | Text measure with conditional font / background colour | `<Chip>` | Same word + glyph |

Accepted platform differences: Power BI drill-through navigates to a page instead of overlaying; Power BI slicer hit areas are native; no keyboard radiogroup in B; Power BI line markers are rendered at visual-level size 3 (≈ 6 px), React r = 3; Power BI has no backdrop blur (solid glass fallback).

---

## 11. Change log

| Date | Change | Source |
|---|---|---|
| 2026-10-26 | First version: Style Brief, tokens, type scale, grid, card anatomy with corner marker and hero sparkline, chart styling, status rules, number formats, parity table | USER directives 2026-10-26 (flat design after the reference sheet) |
| 2026-10-27 | Removed the applied-filters line under the title (§9, §10); removed the 16 × 16 corner marker from every card (§1, §2.1, §4, §5, §10); removed the hero sparkline — comparator bars widened to 160 px, status chip added to hero cards (§5, §7, §10); added §5a pop-up / glass tokens and the "How to read" row; folded in the house rule "Visual first, minimum text" (`design-requirements.md` §1) | USER review of the Mirelo drafts, 2026-10-27 |
| 2026-10-27 (v4) | ADR-0012 applied in full: card face = title · value · delta row(s) · status chip only — the hero secondary-values line and every KPI sub-line moved into the card's ⓘ; one plain upright ⓘ SVG button bottom-left of every card and panel (never in the title row); ⓘ content = what it is · why it matters · formula · sub-values · source; KPI cards show the Δ text without a bar; one "How to read" per view (header-right, content keyed by view); table footnotes into the table's ⓘ; glass values per ADR-0012 §2.5 (64 % white, blur 20, inner highlight, 92 % fallback), one layer at a time, Esc / outside / ✕, focus trapped and returned (§5, §5a, §10). Mockup v3 kept as `mockup-v3-2026-10-27.html`; `mockup.html` is v4 with dataset values | USER "update with all the rules", ADR-0012, 2026-10-27 |
| 2026-10-27 (MS-11, MS-15) | §8: counts always exact with a thousands separator on card faces, tables and pop-ups (abbreviation only for chart data labels); §9: comparator row labels fixed to `vs Budget` / `vs PY` on every card in both tracks | Contract maintenance MS-11 / MS-15, 2026-10-27 |

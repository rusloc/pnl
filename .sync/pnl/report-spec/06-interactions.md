# 06 — Interactions, slicers, bookmarks

## 1. Controls: web → Power BI

Every report control of the web is a disconnected parameter table (`03-model.md` §6) on a slicer that lives in a
bookmark panel. Measures read the selection; nothing is cross-filtered through relationships except the four
variance-filter slicers on the Analysis page.

| Web control (spec id; source) | Values (default **bold**) | Power BI control | Field | Selection | Panel / page |
|---|---|---|---|---|---|
| Company (F-01; brand mark → company picker, `company-picker.tsx`) | **Consumer Products**, Commerce Cloud, ACME Group (disabled: "Not built yet (ADR-0002 build step 4): Group view with intercompany eliminations") | Button slicer (2 tiles; Group as a greyed text tile, not clickable) | `P Company[CompanyName]`, filter `IsBuilt = TRUE` | single, forced | Company panel, all pages, synced |
| Show / time view (F-04; `flyout.tsx:188-203`) | One month, Quarter to date, **Year to date**, Last 12 months, Full year, Custom range | Button slicer, 2 columns | `P Time View[TimeViewLabel]` | single, forced | Period |
| Year (F-02) | 2024, 2025, **2026** | Button slicer, 3 columns | `P Fiscal Year[FiscalYear]` | single, forced | Period |
| Month (F-03; grid labelled "Month" / "Up to" / "Ending" / "To") | Jan … Dec, **Sep** (= last closed) | Button slicer, 4 × 3 grid | `P Month[MonthName]` | single, forced | Period |
| Custom range "From" (2026-11-15) | any month; default Jan of the selected year | Dropdown slicer (36 months, newest last) | `P Range Start[RangeStartLabel]` (sort by `RangeStartIdx`) | single | Period, visible only with Custom range (§3.3) |
| Base version (F-05) | **Actual**, Latest estimate, Budget | Button slicer, 1 column, 3 rows (radio cards) | `P Base[BaseLabel]` | single, forced | Versions |
| Compare A (F-06) | **Budget**, Latest est., Prior year, None | Button slicer, 4 columns | `P Compare A[CompareALabel]` | single, forced | Versions |
| Compare B (F-07) | Budget, Latest est., **Prior year**, None | Button slicer, 4 columns | `P Compare B[CompareBLabel]` | single, forced | Versions |
| Slice: Region, Channel, Category, Price tier (F-08 … F-11) | not built: "All" | static shapes (§3.5) | — | — | Slice |
| Currency (F-12) | **USD**, EUR, GBP | Button slicer, 3 columns | `P Currency[CurrencyCode]` | single, forced | Display |
| FX basis (F-13) | **Actual rates**, Constant currency | Button slicer, 2 columns | `P FX Basis[FxBasisLabel]` | single, forced | Display |
| Units (F-14) | **$m**, $k (symbol follows the currency) | Button slicer, 2 columns | `P Units[UnitsLabel]` (labels "m" / "k"; a card above shows the symbol: `[Sel Currency Symbol] & "m"`) | single, forced | Display |
| Costs shown (F-15) | **−** (as negatives), + (as positives) | Button slicer, 2 columns | `P Cost Sign[CostSignLabel]` | single, forced | Display |
| Variance format (F-16), % of net revenue column, Full-year outlook columns (F-17) | Amount and % · Amount · %; on / off | **"Statement columns"** list slicer (checkboxes) | `Statement Columns[Statement Columns]` (field parameter) | multi, all selected by default | Display |
| Classification tags (F-17) | **On** / Off | Button slicer, 2 columns | `P Show Tags[ShowTags]` | single, forced | Display |
| Hide empty lines (F-17, M-22) | **On** / Off | Button slicer | `P Hide Empty[HideEmpty]` | single, forced | Display |
| Expand all / Collapse all (F-20, M-20) | default collapsed | 2 buttons → bookmarks | — | — | statement page |
| Variances filter funnel (2026-10-31; `analysis-view.tsx:75-150`) | per dimension: All or one member | 4 tile slicers | `Dim Region[RegionName]`, `Dim Channel[ChannelName]`, `Dim Line[LineName]`, `Dim Segment[SegmentName]` | multi (Ctrl), "Select all" on; no selection = All | Variance filter panel, Analysis only, not synced |
| View tabs | P&L statement · Vitals · Analysis · Profitability | page navigator | — | — | header |
| How to read | per view | button → bookmark panel | — | — | Vitals, Analysis, Profitability |
| Copy link (F-37) | — | not reproducible; replaced by "Reset" (all defaults) | — | — | header |
| Ask AI | — | out of scope | — | — | — |

"Single, forced" = slicer Selection → Single select **on** (one value always selected). Save the report with the
defaults selected.

Mapping of "Statement columns" to the web switches: Variance "Amount" = untick "Δ % A" and "Δ % B"; "%" = untick "Δ A",
"Δ B", "Δ LE vs Budget"; "% of net revenue column" off = untick "% NR"; "Full-year outlook columns" off = untick
"FY Budget", "FY Latest est.", "Δ LE vs Budget". Hide-empty follows the ticked columns (`04-measures.md` §7.3).

## 2. Behaviour rules carried from the web

| Rule | Web | Power BI |
|---|---|---|
| F-31 | Switching company keeps period, versions, currency and region | Automatic: only the company slicer changes |
| M-21 | Statement expansion persists across filter changes, resets to collapsed on company change | Expansion persists (matrix state). The reset on company change is not automatic: the company tiles' "Done" step applies bookmark `Rows – Collapsed` only if the company buttons are built as two buttons with actions (optional; otherwise the user clicks Collapse all) |
| C-01 under Actual | Open months (Oct–Dec 2026) shown dashed with "not closed yet", not selectable | Month tiles cannot be disabled: an open month can be picked; the measures cut it (C-01) and the Cut-off notice appears. Show the hint text "Switch the base to Latest estimate to include forecast months." under the grid (`period.ts:43-44`) and a card listing the open months: "Oct, Nov, Dec 2026: not closed yet" (base A), "forecast" (LE), "budget" (B) |
| Full year | Grid hidden, line "Full year covers January to December." | Grid stays (the month does not narrow a full year); a card shows `IF ( [Sel Time View] = "FY", "Full year covers January to December." )` |
| Custom range | "Custom range" starts as the months on screen; Whole-years shortcuts; From / To switch | "From" slicer appears with Custom range (bookmark `Period – Range on`, §4) and the Year + Month slicers set "To". The engine swaps a start after the end; so do the measures (`[Win From Raw]` / `[Win To]` use min / max). Optional: six "Whole years" buttons (2024, 2024 – 2025, 2024 – 2026, 2025, 2025 – 2026, 2026) as bookmarks with Data on and selected visuals = the four period slicers |
| Compare = None | The comparison's columns and card row disappear | Measures return blank; untick the columns in "Statement columns" to remove the width |
| Reset this group / Back to default (F-35) | Restores the group's defaults, keeps the company and the view | Bookmarks `Reset – Period`, `Reset – Versions`, `Reset – Display` (Data on, selected visuals = that panel's slicers only) |
| One pop-over at a time | Flyout, company picker or applied filters | Every panel bookmark shows its panel and hides the others (§4) |
| Variance filter, member of the other company | Dropped from the link | Ignored by `[LV Amt]` (`04-measures.md` §9.1); the slicers list only the company's members |
| Profitability breakdown | Region only (F-21 default; `restrictToBuilt`) | Region only |

## 3. Panels (bookmark-driven groups; one copy per page, all synced)

Common panel style (design guide §5.2): card white, border 1 px `#DEE3E9`, radius 12, shadow
`0 14px 36px rgba(16,27,43,0.20)`; header: title 16 / 600 + subtitle 12 `#4F5C6C`, close button 40 × 40 (fill
`#F2F4F7`, radius 8, "✕" `#4F5C6C`) → bookmark `Panel – None`; header rule `#EDF0F3`; body padding 14 / 16, 18 px
between groups; group label 12 / 600 `#4F5C6C`; footer rule `#EDF0F3`, left link (14, underlined, colour fx
`[Theme Acc]`) "Reset this group" (Period: "Back to default"), right primary button "Done" 40 high, fill fx
`[Theme Acc]`, white 14 / 600, radius 8 → `Panel – None`. A 12 × 12 pointer (rotated square) at the rail item is
optional.

Slicer tile style (segmented control, §5.2): 40 high (36 in the period grid), border 1 px `#CDD4DC`, radius 8, text 13
`#101B2B`; selected: border fx `[Theme Acc]`, fill fx `[Theme Acc Tint]`, text fx `[Theme Acc]` 600. Month tiles 44 high.

### 3.1 Company panel (x 74, y 12, w 320, h 200)

Title "Company", subtitle "Period, versions, currency and region carry across". Tiles (button slicer, 1 column, min
height 52, radius 10, padding 6 / 16 / 6 / 12): a 12 px dot in the company colour (`#2453A6`, `#6B48C8`), name 15 / 600,
sub-line 12 `#4F5C6C` ("Goods - retail, D2C, marketplaces" / "E-commerce SaaS services"). Selected tile: border and
1 px ring in the company colour, fill its tint. Third tile "ACME Group — Coming in build step 4" as a static shape at 60 %
opacity with tooltip "Not built yet (ADR-0002 build step 4): Group view with intercompany eliminations". Choosing a
company applies at once; "Done" or ✕ closes.

### 3.2 Period panel (x 74, y 92, w 352, h up to 612)

1. Header: "Period"; under it the live sentence `[Period Summary]` 18 / 600 (e.g. "Showing Jan – Sep 2026 - year to
   date").
2. "Show": time-view slicer, 2 columns × 3 rows.
3. (Custom range only, bookmark `Period – Range on`) "From": range-start slicer; caption "To = Year and month below".
4. "Year": 3 tiles.
5. Grid label card: `SWITCH ( [Sel Time View], "MTD", "Month", "QTD", "Up to", "YTD", "Up to", "LTM", "Ending", "RANGE", "To", "" )`;
   month slicer 4 × 3; open-months card (§2) and hint.
6. Footer: "Back to default" (`Reset – Period`), "Done".

### 3.3 Versions panel (x 74, y 92, w 352)

Title "Versions", subtitle "Base and two comparisons". "Base version": 3 radio cards (button slicer, 1 column) with a
description line each (static text boxes aligned under the tiles): Actual — "Closed months only, through Sep 2026";
Latest estimate — "Actual for closed months plus Forecast 9+3 (Sep 2026)"; Budget — `"Approved FY" & [Sel FY] & " budget, phased by month"`.
"Compare A", "Compare B": 4 tiles each; caption "Comparisons always cover the same months as the base."
Footer: "Reset this group" (`Reset – Versions`), "Done".

### 3.4 Display panel (x 74, y 92, w 352)

Title "Display", subtitle "Currency, units and table options". Groups: Currency · FX basis · Units and Costs shown side
by side · "Statement columns" (field-parameter list, 13 entries with checkboxes) · Classification tags · Hide empty lines.
Footer: "Reset this group" (`Reset – Display`), "Done".

### 3.5 Slice panel (x 74, y 92, w 352)

Title "Slice", subtitle "Region, channel, category and tier". A notice box (fill `#FBF4E4`, border `#EBD9AE`, text 13
`#3D3216`, info icon `#8A5A00`): "Slice filters are not built yet. They arrive with the allocation of lines below
contribution margin (C-31); the figures show every slice." Then four disabled rows, each a label + a dashed box (border
1 px dashed `#CDD4DC`, fill `#F6F8FA`, text "All" `#4F5C6C`, 40 high): "Region", `[Slot Label Channel]`,
`[Slot Label Line]`, `[Slot Label Segment]` (`flyout.tsx:386-414`). Footer as the others (the reset does nothing).

### 3.6 Applied-filters panel (x 236, y 56, w 440)

Title "Applied filters", close button. A table visual: `Applied Row[RowLabel]` (112 px, 13 `#4F5C6C`) and
`[Applied Row Value]` (13, font fx `[Applied Row Colour]`), sorted by `RowSort`, column headers off, rows with a blank
value hidden (notice rows appear only when they apply), horizontal rules `#EDF0F3`, row padding 6.

### 3.7 How-to-read panels (one per page except the statement; x 736, y 106, w 520)

Title "How to read - Vitals" / "- Analysis" / "- Profitability" 16 / 600; rows label (12 / 600 `#4F5C6C`, 96 px) +
text (13): "Showing" `[HowTo Showing]`, then the page's lines (`05-pages.md` §4.3, §5.5), then "Legend". Close ✕.

### 3.8 Variance-filter panel (Analysis only; x 736, y 150, w 520)

Title "Filter the variances". Text: "One member per dimension; the chosen members combine. Opex and below are allocated by
net-revenue share to channel, category and tier (alloc.)." Four groups, each a label card (11.5 / 600 uppercase
`#4F5C6C`: "REGION", `UPPER ( [Slot Label Channel] )`, …) over a tile slicer (chips: 3 / 10 padding, radius 14, 12 / 500;
selected border / fill / text in the company colour). Slicer visual-level filters: `IsUnassigned = FALSE` and the
company's members (`[Slicer Member Visible] = 1`, `… Line`, `… Segment`). Footer: "Clear filters" →
`Reset – Variance filter`; "Done" → `Panel – None (Analysis)`.

## 4. Bookmarks

Create in the Bookmarks pane, grouped. "Display" = show / hide state of visuals; "Data" = filters, slicers, sort,
drill / expand state; "Selected visuals" = the bookmark touches only the visuals selected when it was created.

| Group | Bookmark | Page | Data | Display | Current page | Selected visuals | Shows |
|---|---|---|---|---|---|---|---|
| Panels | `Panel – None (<page>)` ×4 | each | off | on | on | all panel groups | no panel |
| Panels | `Panel – Company (<page>)` ×4 | each | off | on | on | all panel groups | Company panel |
| Panels | `Panel – Period (<page>)` ×4 | each | off | on | on | all panel groups | Period panel (range part hidden unless `Period – Range on`) |
| Panels | `Period – Range on (<page>)` ×4 | each | off | on | on | all panel groups | Period panel with the "From" slicer |
| Panels | `Panel – Versions`, `Panel – Slice`, `Panel – Display`, `Panel – Applied filters` (×4 pages each) | each | off | on | on | all panel groups | that panel |
| Panels | `Panel – How to read (Vitals / Analysis / Profitability)` | that page | off | on | on | all panel groups | How-to-read panel |
| Panels | `Panel – Variance filter` | Analysis | off | on | on | all panel groups | variance-filter panel |
| Statement | `Rows – Collapsed` | P&L statement | **on** | off | off | the matrix only | matrix collapsed to report lines |
| Statement | `Rows – Expanded` | P&L statement | **on** | off | off | the matrix only | matrix expanded to accounts ("Expand all down one level in the hierarchy" before capturing) |
| Reset | `Reset – All` | each (4) | on | on | on | all slicers + panels | every slicer at its default, no panel |
| Reset | `Reset – Period` | each | on | off | off | period slicers | defaults of Year, Month, Show, From |
| Reset | `Reset – Versions` | each | on | off | off | base, compare A, compare B slicers | Actual, Budget, Prior year |
| Reset | `Reset – Display` | each | on | off | off | display slicers | USD, Actual rates, m, −, all columns, tags On, hide empty On |
| Reset | `Reset – Variance filter` | Analysis | on | off | off | the four variance slicers | no member selected |

Selection pane: name every panel group `Panel <name>` and keep panels hidden in `Panel – None`. Because slicers are
synced across pages, a reset on one page holds on every page.

Time view "Custom range" ⇒ the user opens `Period – Range on` with a small button "Set range start" shown in the Period
panel when `[Sel Time View] = "RANGE"` (button visible always; its text fx `IF ( [Sel Time View] = "RANGE", "Set the first month", "" )`).

## 5. Sync slicers

View → Sync slicers. One sync group per parameter (`Company`, `Show`, `Year`, `Month`, `RangeStart`, `Base`, `CompareA`,
`CompareB`, `Currency`, `FxBasis`, `Units`, `CostSign`, `StatementColumns`, `ShowTags`, `HideEmpty`), synced on all four
report pages, visible only inside the panels (the panels exist on each page). The four variance-filter slicers are not
synced (Analysis only). Tooltip pages are not synced (they inherit the hovered context).

## 6. Cross-filtering and interactions

- **Parameter slicers must keep their default "Filter" interaction on every visual** — the measures read them through the
  filter context. Never set them to "None".
- **Variance-filter slicers** (`Dim Region`, `Dim Channel`, `Dim Line`, `Dim Segment` on Analysis): Format → Edit
  interactions → Filter on the variances table A5 and its title / count cards (A1, A3); **None** on the two bridges
  (A7, A9) and on every frame visual. (The web's bridges ignore the variances filter.)
- **Visual-to-visual cross-filtering**: off everywhere (each visual → Edit interactions → None on the others). The web
  has no click-to-filter; clicking a bar, cell or row changes nothing.
- **Drill-through**: none (M-27 drill to journals is deferred in the web).
- **Tooltips**: report-page tooltips on the Vitals cards and the ⓘ buttons (`05-pages.md` §6); default tooltips on the
  charts.
- **Keyboard and accessibility (N-08)**: set the tab order (View → Selection → Tab order): rail mark, rail items,
  applied-filters button, tabs, How to read, Reset, then the page's visuals top-left to bottom-right; alt text on every
  visual (e.g. statement: "Income statement, rows = P&L lines, columns = actual vs comparisons"; bridges:
  `[Br Profit Title]`); colour never carries meaning alone — every Δ has a sign, statuses a word.

## 7. Not reproducible 1:1 (and what replaces it)

| Web | Power BI replacement |
|---|---|
| URL state and "Copy link" (F-37) | Personal bookmarks in the Service; "Reset" bookmark |
| Disabled open months in the month grid | Hint + notice; the measures enforce C-01 |
| Statement expansion reset on company change | "Collapse all" button / optional bookmark chain |
| Dynamic column headers and group titles | Static headers + `[Stmt Group Titles]` card |
| Row-label styling (bold key rows, italic ratios, tag pills, grey alias) | Row background / font colour on value cells; alias and tags in the "Line note" column |
| Glass pop-ups (blur) | White cards with the flyout shadow |
| Hatched FX bar | Light-grey bar with a dark border |
| Region colours by rank | Fixed colours matching the default rank |
| Trends: label only the last value; company dashed behind each region | Data labels per series if "last" is available; dashed company series in every small multiple |
| Ask AI chat | — |

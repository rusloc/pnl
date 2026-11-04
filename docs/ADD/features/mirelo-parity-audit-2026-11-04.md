# Mirelo Sales: Power BI vs the vosk.dev JS report (parity audit 2026-11-04)

> 2026-11-04 · bip · reference: `.sync/mirelo-sales/js-app/.vosk-dev-2026-11-04/` (vosk.dev `a4acf69`, report files `cec64dd`), read-only.
> Power BI: `pbi-report/Mirelo Sales/` (page `sales_one_pager`, bookmarks, groups, theme, `loan_detail`, `client_detail`, `tt_card_info`).
> Precedent: `docs/ADD/features/parity-check-2026-10-27.md`. Recorded platform differences: `docs/design/parity-rules.md`, Mirelo section.

## Scope and method

- The vosk.dev engine (`src/lib/mirelo/*.ts`) equals the PNL `js-report/lib/sales/` after normalising imports and Prettier
  style; its UI (`src/components/mirelo/*`) equals `js-report/components/sales/` except round 5. Numbers, titles and ⓘ copy were
  matched on 2026-11-02 (tests T-M9, T-P), so this audit is about the look: geometry, type, colour, corners, glass, controls.
- Round 5 (`cec64dd`, "Details →" with 6 px corners): Power BI already draws the label with 6 px corners
  (`ov_o*_details`, `rectangleRoundedByPixel` 6). No change.
- The "(draft sample)" wording in vosk.dev `copy.ts` (C11 / P13 ⓘ) is not taken over; the PNL wording stays.
- The data move to Supabase (`c4d90a0`) is not visual and is out of scope.
- The USER's Desktop edits of 2026-11-03 23:46 are kept: `filters_close` (an icon-only close tile, 30 × 27, grey `#DEDDD8`,
  the Power BI "back" arrow, no text) was a close button without the JS × glyph; it is finished to the JS × (row 10). The
  P12 role order, the O9 toggle, the culture and the TMDL newlines are untouched.
- Geometry in board px (1440 × 810); a card's own coordinates are given as (x, y) from its top-left.

## Differences

Fixable: **yes** = fixed in this pass · **partly** = fixed as far as Power BI allows, the rest recorded · **no** = platform limit,
recorded in `docs/design/parity-rules.md`.

| # | Element | JS reference | PBI before this pass | Fixable in PBI | Action |
|---|---|---|---|---|---|
| 1 | Font family | Inter (next/font) everywhere | Segoe UI family | no | Recorded: Power BI renders only its built-in fonts; Segoe UI kept |
| 2 | Brand mark | 24 × 24 at y 18, 4 px corners, "M" 14 px weight 800 | square, weight 700, y 20 | yes | `mirelo-brand.svg` rx 4 + weight 800; brand y 18, title y 12 (the render-checked centre line moves to the JS y 30) |
| 3 | Title | 22 px (16.5 pt), weight 800, letter-spacing -0.01em | 16 pt Segoe UI Bold | partly | 16.5 pt; weight 800 and letter spacing do not exist in a text box (Bold is the heaviest face) |
| 4 | Filters button | top 18, funnel icon + "Filters", ~86 px | top 17, no icon, 80 px | partly | y 18 (and its open-state twin); no funnel glyph among the button icons (recorded 11-01) |
| 5 | Applied-filters line | plain text, top 18; hover shows the Showing sentence | a button that opens the panel, top 17 | partly | y 18, link off (plain text); a dynamic hover text is not possible on a button |
| 6 | Tabs | 14 px (10.5 pt) weight 600; hover `#FFE58A` + ink text | 11 pt; hover fill only | yes | 10.5 pt on tabs and selected tabs; hover text ink |
| 7 | How to read link | 12 px weight 500, 16 px ⓘ, hover ink | Semibold 9 pt, 14 px icon, no hover | yes | Segoe UI 9 pt, hover ink on text and icon; icon kept at 14 px (16 px overlaps the text in a 20 px button, render-checked) |
| 8 | Copy link | "⧉ Copy link" right of How to read | none | no | Recorded: no clipboard or URL state in a report; the service's own Share does it |
| 9 | Filters pop-up width | 420 × 514 at x 988 (content 380) | 440 × 514 at x 968 | yes | Group and panel 420 wide at x 988; calendar, Region, hint, rule, Showing 380 wide |
| 10 | Filters header | "Filters" 13.5 px bold `#111827` at (20, 14); × 26 × 26 at (384, 10), no fill, round, `#4F5C6C`, 6 % tint on hover | title 11 pt Semibold at (20, 12); USER's close tile (grey, back arrow, no glyph) at (392, 12) | yes | Title 10 pt Bold `#111827` at (20, 14); `filters_close` finished to the JS ×: glyph ×, 26 × 26 at (384, 10), 13 px corners, `#4F5C6C`, hover `#101B2B` at 6 % |
| 11 | Filters rhythm | labels at 54 / 290 / 350, rows 310 / 370, Reset 412, rule 452, Showing 462 | 44 / 300 / 362, 324 / 386, 426, 464, 470 | yes | Moved to the JS rows; calendar 74-258, hint 260 |
| 12 | Calendar | mode row + year stepper + tile grid | hierarchy slicer Year > Quarter > Month | no | Recorded 11-02 (one slicer does the four modes) |
| 13 | Radio tiles | sized to the label (Budget 70, Prior year 86), 6 px gaps | equal tiles, 4 px gaps, Comparison 206 wide | partly | 6 px gaps, Comparison 178 wide; equal tile widths stay (button-slicer grid) |
| 14 | Selected tile | ink fill, white text | Power BI's dark default | no | Recorded 11-01 |
| 15 | Reset | ~56 px, white, no hover change | 96 px, yellow hover | yes | 56 px, hover white; the always-clickable Reset stays recorded |
| 16 | Pop-up dismissal | Escape, click outside, focus trap | buttons only | no | Recorded 11-01 / 11-03 |
| 17 | Glass | `rgba(244,243,240,.32)` + 28 px blur | `#F4F3F0` at 90 % | no | Recorded 11-01 (no backdrop blur; lower opacity lets numbers read through) |
| 18 | Glass shadow | `0 18px 44px` 26 % + `0 2px 6px` 14 % (`#111111`) | 0 / 12 px, blur 30, 25 % black | partly | All 11 glass panels: `#111111`, distance 18, blur 44, 26 %; the second, tight shadow layer does not exist |
| 19 | How to read close | × at the top right, no bottom button | "Close" tile bottom right | yes | The five `info_*_close` become the × at (324, 10) |
| 20 | How to read title | 13.5 px bold `#111827` at (20, 14) | 11 pt Semibold `#111111` at (16, 12) | yes | 10 pt Bold `#111827` at (20, 14) |
| 21 | How to read lines | label line (600) then its text, `#111827`, 320 wide; first item "Showing" + sentence | label inline before the text, text `#5C5C58`, 328 wide; sentence without its "Showing" label | partly | Label and text in separate paragraphs, `#111827`, x 20, 320 wide; the "Showing" label line above the sentence needs a new visual per view (not added) |
| 22 | How to read height | content height, max 420 (scrolls) | 360 for every view | partly | 392-410 per view from the measured text; fixed per view (no auto height) |
| 23 | ⓘ pop-up | 360 wide, title 13.5 px bold, What / "Why it matters" / "Formula" labels, one value row per item | 340 wide, title 11 pt Semibold, no block labels, one paragraph of values | partly | 360 wide, padding 20, title 10 pt Bold, text `#111827`, page 432 × 360 for the shadow; block labels and value rows recorded (tooltip text = one measure-bound button per block) |
| 24 | ⓘ glyph | 16 px, `#4F5C6C`, darker on hover; hero / KPI at card (12, 16), chart / table at (14, 16) | `#5C5C58`; hero (8, 16), KPI (8, 24), chart (12, 14), table (16, 16) | partly | Colour on all 59, positions on 56 (the three heat matrices L10 / C9 / P9 keep x 12: their table title starts closer, render-checked); no hover state on a card visual |
| 25 | Hero hover | card darkens to `#E4E3DF` | no change | yes | `ov_o*_btn` hover fill black at 98 % transparency (= `#E4E3DF` over the panel) |
| 26 | Hero face | title x 34; rows at y 108 / 132 (row box); "vs Budget" / "vs PY" weight 500; bar 144 × 6, centre 244, drawn on the favourable side; no chip when neutral; second value weight 700 | title x 30; rows ~12 px higher; "vs Prior year", weight 600; bar 160, centre 252, side = sign of Δ; grey "n/a" chip; second value 800 | yes | `Card O1..O4 SVG` measures redrawn to the JS geometry (Parts measures unchanged) |
| 27 | KPI face | title (34, top 16) 12 px 500; value top 40; chip right 12, top 48 (beside the value); rows top 78 / 98, Δ after an 84 px name column; one-line titles | title y 36 (C4 10 px, C5 two lines); value 6 px lower; chip top right on the title row; rows at 92 / 110, Δ right-aligned at x 200 | yes | 24 `Card L/C/P/R SVG` measures redrawn; no chip when neutral |
| 28 | Chart "Open … ↗" | 16 px from the card's right edge; hover ink + underline | 40 px from the edge, no hover | yes | O5-O8 moved, hover ink + underline |
| 29 | Table action | text link "Show loans ↗" / "Show clients ↗" / "Show overdue loans ↗", 12 px 600 `#5C5C58`, hover ink + underline, centred on the title row | grey pills, yellow hover, "Show loans" without ↗, 3 px high | yes | All five as text links (no fill, right-aligned, hover ink + underline, grey when disabled), on the title row; L13 / R13 keep their Power BI-only "Show loans ↗" (the JS opens on a row click) |
| 30 | Table title | x 38 in the card | x 40 | yes | Moved |
| 31 | Table box | O9 top 34, 84 high; band tables top 36, bottom 8 (142) | O9 36 / 78; band tables 146 | yes | Resized |
| 32 | Table rows | hover `#FFE58A`, selected `#FFD54A`, row click acts | native selection, Show buttons | no | Recorded (11-02, change 28) |
| 33 | Legends | 12 × 3 line / 10 × 10 square swatches, labels from the selection | native markers; slot names (Anchor quarter …) | no | Recorded 11-02 |
| 34 | Story callouts, O6, L8, P12, R9 | dashed event marker; bars; labels on L8 / C8; P12 labels three + worst | see parity-rules | no | Recorded 11-01 / 11-02 (unchanged) |
| 35 | Detail close | ✕ 32 × 32 at the top right (right 16, top 16), white, 1 px `#CFCDC6`, 6 px corners | "Close" / "Back" grey tile with the back arrow at the top left | yes | `lc_close`, `lo_close` and both `dt_back` restyled and moved (the drill pages keep the native Back action) |
| 36 | Detail header | title 16 px bold at (24, 12), sub-line 12 px `#5C5C58` below, rule at y 64 over a 30 % white band | title 12 pt Semibold at y 56, note right-aligned at the top, rule at y 88 | partly | Title 12 pt Bold at (24, 10), note as the left sub-line at (24, 34), rule at y 64; the white header band needs a new visual (not added) |
| 37 | Detail table + footer | table 108 to 48 from the bottom; footer: ← Back, Export CSV, "1-50 of N", pager | table from y 96; "Show client ↗" pill at the top right | partly | Tables at 108 (client card: facts at 104, loans at 196); "Show client ↗" moved to the footer (bottom 12, left 24) in the footer-button style; pager / CSV recorded 11-02 |
| 38 | Mask | 20 % `#404040` + 6 px blur | 32 % `#404040` | no | Recorded 11-02 |
| 39 | Canvas | board grows taller to fill the popup | fixed 1440 × 810, Fit to page | no | Recorded 11-02 |
| 40 | Dimension names | App, Interest, 30–59 DPD | App organic, Interest income, 30-59 days past due | no (here) | Open, data layer: display-name columns in Power Query (#handoff ginee, unchanged) |

## Count

40 differences: 17 yes, 11 partly, 12 no. All 28 yes and partly rows were changed in this pass.

| Fixable | Rows | Count |
|---|---|---:|
| yes | 2, 6, 7, 9, 10, 11, 15, 19, 20, 25, 26, 27, 28, 29, 30, 31, 35 | 17 |
| partly | 3, 4, 5, 13, 18, 21, 22, 23, 24, 36, 37 | 11 |
| no | 1, 8, 12, 14, 16, 17, 32, 33, 34, 38, 39, 40 | 12 |

What the 11 partly rows leave and the 12 no rows are recorded in `docs/design/parity-rules.md` (Mirelo, 2026-11-01 / 11-02 / 11-04).

## Verification

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings.
- `tests/control-totals.dax` on a scratch copy of the pack (its own cache, opened Ready, 0 measures in an error state): 40 blocks,
  4,361 rows, all TRUE. T-M7a asserted the old title position (`x='30' y='36'`); it now asserts the JS position (`x='34' y='28'`).
- Render-checked in Desktop (scratch copy): Overview, Loans issued, the Filters panel, How to read, `loan_detail`. Not automated: clicks and hover.

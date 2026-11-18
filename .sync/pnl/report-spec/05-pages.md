# 05 — Pages and visuals

Canvas: **1280 × 720** (Page format: Custom 1280 × 720, vertical alignment Top) for pages 1–3; Profitability is
**1280 × 900** (the web page scrolls at 1280 × 720; `views.module.css:62-65`). Page background `#F2F4F7` (Ground),
wallpaper `#F2F4F7`. Coordinates below are x, y, width, height in pixels on that canvas; they are a grid to follow, ±4 px.
Every visual: title off unless stated, background off unless stated, border off unless stated, visual header off
(except where the ⓘ "help tooltip" is used), drop shadow off (design guide §4: only flyouts have a shadow).

Pages (in this order, names exact): `P&L statement`, `Vitals`, `Analysis`, `Profitability`; hidden tooltip pages
`TT Vitals card`, `TT Info` (§6). Page navigation = buttons in the header (§1); hide the page tabs in the Service
(Settings → Pages pane → hide).

## 1. Common frame (identical on the four pages; copy-paste, group as `Frame`)

| Id | Visual | x, y, w, h | Content and formatting |
|---|---|---|---|
| F1 | Shape: rectangle | 0, 0, 64, 720 | Filter rail. Fill `#101B2B`, no border |
| F2 | Button (blank) | 14, 16, 36, 36 | Brand mark: fill = fx `[Theme Acc]`, corner radius 8, text "A ▾" white 16 / 700 (▾ = U+25BE, 10 px). Tooltip "Switch company". Action: bookmark `Panel – Company` (06 §3) |
| F3 | Shape: line | 20, 68, 24, 1 | Divider `#3A475A` |
| F4–F7 | Buttons (blank, icon) | 10, 84 / 136 / 188 / 240, 44, 48 | Rail items Period · Versions · Slice · Display. Icon 20 px, stroke `#8592A3` 1.6 px (calendar, bar chart, funnel, sliders; use Power BI's built-in button icons or the SVG images in `07-theme.md` §5). Corner radius 8; default fill transparent; "on press / selected" fill `#2B3748`. Tooltip (fx): F4 `[Period Summary]`, F5 `[Rail Sum Versions]`, F6 "All slices", F7 `[Rail Sum Display]`. Action: bookmarks `Panel – Period` / `Panel – Versions` / `Panel – Slice` / `Panel – Display` |
| F8 | Shape: rectangle | 64, 0, 1216, 104 | Header bar: fill `#FFFFFF`, bottom border 1 px `#DEE3E9` (draw a 1 px line shape at y 103 if the shape border can't be bottom-only) |
| F9 | Text box | 88, 12, 150, 34 | "Profit & loss", 22 / 600, `#101B2B` |
| F10 | Button (blank, icon) | 236, 15, 32, 32 | Applied-filters button: funnel icon `#4F5C6C`, border 1 px `#CDD4DC`, radius 8. Tooltip "Applied filters". Action: bookmark `Panel – Applied filters` |
| F11 | Card (new) | 258, 8, 18, 18 | Notice count badge: callout `[Notice Count]`, 10 / 600 white, background `#8A5A00`, radius 8; shows nothing when there is no notice (measure blank → set "Show blank as" empty and background transparent via fx: `IF ( ISBLANK ( [Notice Count] ), "#FFFFFF00", "#8A5A00" )`) |
| F12 | Card (new) | 620, 16, 636, 24 | Status line: callout `[Hdr Status]`, 13 / 400 `#4F5C6C`, right-aligned, no label |
| F13 | Page navigator (or 4 buttons) | 88, 56, 560, 48 | Tabs: "P&L statement", "Vitals", "Analysis", "Profitability"; 15 px; default text `#4F5C6C` 500, no fill, no border; selected text `#101B2B` 600 with a 3 px bottom border fx `[Theme Acc]` (page navigator: Style → Selected → Border bottom 3). Spacing 4 |
| F14 | Button (blank) | 1040, 62, 104, 36 | "How to read" (not on the statement page): text 13 `#101B2B`, border 1 px `#CDD4DC`, radius 8. Action: bookmark `Panel – How to read (<page>)` |
| F15 | Button (blank) | 1152, 62, 104, 36 | "Reset" (replaces the web's "Copy link"; restores the defaults, F-35): same style. Action: bookmark `Reset – All` |

Content area for the pages: x 88 … 1256 (w 1168), y 118 … 704 (h 586). Gap between panels 10 (web `views.module.css`
uses 10 px; design guide says 12–16; follow the code).

Panels / flyouts (company picker, Period, Versions, Slice, Display, Applied filters, How to read, the variance filter)
are bookmark-driven groups; their layouts are in `06-interactions.md` §3.

## 2. Page `P&L statement` (L-07, §4 of the spec; `components/pnl/statement-table.tsx`)

| Id | Visual | x, y, w, h | Content |
|---|---|---|---|
| S0 | Shape: rectangle | 88, 118, 1168, 586 | Card: fill `#FFFFFF`, border 1 px `#DEE3E9`, radius 12 |
| S1 | Button | 100, 126, 92, 32 | "Expand all": 13 `#2B3748`, border `#CDD4DC`, radius 8. Action: bookmark `Rows – Expanded` |
| S2 | Button | 200, 126, 100, 32 | "Collapse all": same. Action: bookmark `Rows – Collapsed` |
| S3 | Card (new) | 320, 126, 924, 32 | Group titles: callout `[Stmt Group Titles]`, 12 / 600 `#101B2B`, left-aligned (the web's group header row: "YTD Sep 2026 - Actual │ vs Budget │ vs Prior year │ Full year 2026") |
| S4 | Matrix | 96, 164, 1152, 510 | The statement (below) |
| S5 | Card (new) | 96, 678, 1152, 22 | Footnote: callout `[Stmt Footnote]`, 12 `#4F5C6C`, top rule 1 px `#EDF0F3` |

### 2.1 Matrix S4

- **Rows**: `PL Row[LineDisplay]` (level 1), `PL Row[AccountName]` (level 2). Row header label (rename in the visual):
  first level "Line", second level "Account". The dynamic "Line - USD m" goes in a text box over the row-header column:
  card (new) at 100, 164, 300, 24 with `[Stmt Line Header]` 12 / 600 `#4F5C6C` (set the matrix column-header font
  colour of the row-header column to white so the static title does not show through).
- **Values**: the field parameter `Statement Columns[Statement Columns]` (13 columns, §9 of `03-model.md`).
- **Columns**: none.
- **Layout**: Stepped layout **off** (outline: two row-header columns would waste width — use stepped layout **on** with
  indent 22 px if the account rows should sit under the line, as on the web; recommended: on, indent 22). Row subtotals
  off. Column subtotals off. "Show items with no data" off (rows whose every value is blank disappear — that is how
  out-of-scope accounts and hidden empty lines vanish).
- **Default expansion**: collapsed to level 1 (every report line, no account; M-20 "Collapse all"; `expansion.ts:12-14`).
- **Sizes**: row-header width 300; columns (field-parameter order): Line note 120 · Base 84 · % NR 60 · Compare A 84 ·
  Δ A 72 · Δ % A 62 · ±15% A 84 · Compare B 84 · Δ B 72 · Δ % B 62 · FY Budget 84 · FY Latest est. 84 ·
  Δ LE vs Budget 72 (`statement-table.tsx:69-107`). Total ≈ 1,424 + 300: the matrix scrolls horizontally; the row
  headers stay frozen (M-26). Row padding so a row is 28 px high (font 14 + padding 5).
- **Fonts**: IBM Plex Sans Condensed (fallback Segoe UI) 14 values, 14 row headers; column headers 12 / 600 `#4F5C6C`,
  "Base" header `#101B2B`; column-header bottom border 1 px `#CDD4DC`; gridlines horizontal 1 px `#EDF0F3`, vertical
  off; values right-aligned, tabular figures (Plex has them by default).
- **Column header names** (rename in the visual): "", "Actual" (rename to the base — static; the group title above
  says Actual / Latest estimate / Budget), "% NR", "Compare A", "Δ", "Δ %", "±15%", "Compare B", "Δ", "Δ %",
  "Budget", "Latest est.", "Δ". (The web shows the comparison name, e.g. "Budget", "Prior year"; Power BI headers are
  static, the group title S3 names them.)
- **Conditional formatting** (Cell elements, apply to "Values only"):

| Column | Background | Font colour | Other |
|---|---|---|---|
| every value column | fx field `[Stmt Row Background]` | fx field `[Stmt Row Font Colour]` | — |
| % NR | as above | `#4F5C6C` (static) | — |
| Δ A, Δ % A | as above | fx field `[Stmt Delta A Colour]` | — |
| Δ B, Δ % B | as above | fx field `[Stmt Delta B Colour]` | — |
| Δ LE vs Budget | as above | fx field `[Stmt FY Delta Colour]` | — |
| ±15% A | as above | — | **Data bars**: show bar only; minimum Number −0.15, maximum Number 0.15; positive bar `#3BA37B`, negative bar `#E2804A`, axis `#CDD4DC`, bar direction left-to-right |
| Line note | as above | `#4F5C6C`, 12 px | — |

  Row headers: Power BI cannot colour or bold a row header per row. Set row headers 14 / 400 `#101B2B`; the shaded
  value cells mark the subtotal and key rows (design guide §6.1 bold / italic on the label is not reproducible).
- **Number formats**: from the measures' dynamic format strings (amounts `#,##0.0` in millions, `#,##0` in thousands,
  ratios `0.0%`, Δ signed, ratio Δ in "pp", n/a shown as `n/a`).
- **Tooltips**: default off for the matrix (keep it light).
- **Empty state**: an Actual base whose window is entirely open (e.g. QTD Nov 2026) shows every cell "n/a"; the header
  notice "Cut-off" explains it (the web shows the same "n/a"s).

### 2.2 What the default view must show (Consumer Products, YTD Sep 2026, Actual vs Budget vs Prior year, USD m)

First rows (exact values in `08-validation.md` §4.1): `01. GROSS REVENUE` 4,321.0 · 127.1% · Budget 4,390.3 · Δ −69.3 ·
Δ % −1.6% (orange) · Prior year 3,988.0 · Δ +333.0 · +8.4% (green) · FY Budget 6,378.7 · FY LE 6,246.3 · Δ −132.4;
`03. NET REVENUE` 3,398.5 (key row, tinted `#E8EEF8`); `06. GROSS MARGIN %` 49.4% · 49.8% · −0.4 pp.

## 3. Page `Vitals` (formerly Key figures; `components/pnl/views/vitals-view.tsx`, `engine/vitals.ts`)

Layout: "RESULTS" eyebrow, then 3 hero cards + a column of 2 ratio cards; "DRIVERS & HEALTH" eyebrow, then 5 driver
cards on the Subtle fill. All cards are rows of `Vitals Card`.

| Id | Visual | x, y, w, h | Content |
|---|---|---|---|
| K1 | Text box | 88, 120, 300, 14 | "RESULTS": 11.5 / 600, letter-spacing 0.06 em, uppercase, `#4F5C6C` |
| K2 | Card (new) | 88, 138, 866, 300 | Hero cards: Categories `Vitals Card[CardTitle]`; visual filter `Vitals Card[Size] = "hero"` and `[Vit Card Visible] = 1`; layout 3 columns × 1 row, spacing 10; sort by `CardSort` |
| K3 | Card (new) | 964, 138, 292, 300 | Ratio cards: same with `Size = "secondary"`; layout 1 column × 2 rows, spacing 10 |
| K4 | Text box | 88, 448, 300, 14 | "DRIVERS & HEALTH" (same style as K1) |
| K5 | Card (new) | 88, 466, 1168, 238 | Driver cards: `Size = "driver"`, `[Vit Card Visible] = 1`; 5 columns × 1 row; card background `#F6F8FA` |

### 3.1 Card (new) settings, all three visuals

- Callout value: `[Vit Value Text]`; font 46 / 600 (K2), 28 / 600 (K3, K5); `#101B2B`; left-aligned; label (category)
  = the card title, 14 / 500 `#4F5C6C`, **above** the value.
- Reference labels (three, layout "below the callout", one per line):
  1. Title `[Vit Row A Label]` (13 `#4F5C6C`) · Value `[Vit Row A Abs]` · Detail `[Vit Row A Rel]`; value and detail
     colour fx `[Vit Row A Colour]`, 13 / 600 (14 on heroes).
  2. Title `[Vit Row B Label]` · Value `[Vit Row B Abs]` · Detail `[Vit Row B Rel]`; colour fx `[Vit Row B Colour]`.
  3. Status chip: Title "" · Value `[Vit Status Text]` 11 / 500, colour fx `[Vit Status Colour]`, background fx
     `[Vit Status Background]`, radius 12. Place it at the top-right of the card if the visual supports reference-label
     position "Right of callout"; otherwise last line.
- Card shape: fill `#FFFFFF` (K5 `#F6F8FA`), border 1 px `#DEE3E9`, radius 12, padding 12 / 16.
- Tooltip: report page `TT Vitals card` (§6) — hovering a card shows its ⓘ content.

### 3.2 Cards per company (content swaps by company, L-10; `vitals.ts:165-271, 282-533`)

| Slot | Consumer Products | Commerce Cloud | Value format | Δ rows |
|---|---|---|---|---|
| hero 1 | Net revenue | Net revenue | money "$3,398.5 m" | vs Compare A, vs Compare B: abs number ("−66.3") + % ("−1.9%") |
| hero 2 | Adjusted EBITDA | Adjusted EBITDA | money | same |
| hero 3 | Operating profit | Operating profit | money | same |
| secondary 1 | Gross margin % | Gross margin % | "49.4%" | pp only ("−0.4 pp", "on plan") |
| secondary 2 | Opex % revenue (lower is better) | Opex % revenue | "19.3%" | pp |
| driver 1 | Units sold | GMV processed | "419,838,143" / "$11,285.0 m" | count / money abs + % |
| driver 2 | Net revenue per unit | Active merchants | "$8.09" / "138,726" | per-unit abs 2 dp / count |
| driver 3 | Gross-to-net % (lower better) | ARR (run-rate) | "21.3%" / "$320.0 m" | pp / money |
| driver 4 | A&P % of NR (neutral: never coloured, no chip) | Revenue mix (neutral) | "8.0%" / "37.5% / 50.3%" | pp / one row "Sub / Pay vs PY: −1.5 pp / +2.7 pp" |
| driver 5 | FY outlook | FY outlook | money (FY LE NR) | "vs FY Budget" and "EBITDA vs FY Bud" (abs + %) — always coloured |

Colour rules: only a **Budget** row is coloured (green ahead, grey on track, orange watch / off track); prior-year and
latest-estimate rows are ink; a Δ that shows as 0.0 % / 0.0 pp reads "on plan" (`vitals.ts:44-74`). Status chip: vs
Budget always (on track ±1 % / ±0.3 pp; watch to 3 % / 1 pp; off track beyond; ahead when better) — `thresholds.ts`.

### 3.3 Empty states

A metric without data reads "n/a" (value and rows); a company-specific card never shows for the other company. With
Compare A or B = None the row is blank (the web drops the row and moves the other one up).

### 3.4 ⓘ content per card (tooltip page `TT Vitals card`; `vitals.ts`)

Tooltip page lists: title (`CardTitle`), "What" (`[Vit Info What]`), "Formula" (`[Vit Info Formula]`), the values
(`[Vit Info Values]`), "Source" (`[Vit Info Source]`). The three text measures are `SWITCH ( SELECTEDVALUE ( 'Vitals Card'[CardId] ), … )`
over these exact strings:

| Card | What | Formula | Values (measure each one reads) | Source |
|---|---|---|---|---|
| nr | Gross revenue less gross-to-net deductions (spine step 3). The chip compares with Budget only; other rows are text. | NR = GR + GTN; Δ = actual − comparison, % of \|comparison\| | Organic growth vs PY (constant currency) `[NR Growth Organic]` signed %; Reported growth vs PY `[NR Growth Reported]` | KPI Value K-01 - KPI Δ A / Δ B - KPI Organic Growth - KPI Reported Growth |
| ebitda | Contribution margin plus operating expenses (spine step 9, management performance measure). Excludes D&A and adjusting items; the data has no share-based compensation. | Adj. EBITDA = CM + OPEX | Margin `[Adjusted EBITDA Margin %]`; S only: Rule of 40 (organic growth + margin) = organic growth + EBITDA margin | KPI Value K-07 - KPI Adj EBITDA Margin (S: - KPI Rule of 40 (K-12 S)) |
| op | IFRS 18 required subtotal (spine step 13). | OP = Adj. EBITDA + D&A + adjusting items (signed) | Margin `[Operating Margin %]`; Adj. EBITDA money; D&A money; Adjusting items money; Net profit money; Net margin `[Net Margin %]` | KPI Value K-08 - KPI Operating Margin - Net Profit - KPI Net Margin |
| gm | Gross profit as a share of net revenue. A ratio: variances in percentage points. | GM % = GP ÷ NR | P: the two categories with the largest NR, each "name: GM %" (`[Gross Margin %]` filtered by `Dim Line`, top 2 by NR, unassigned excluded); S: Platform subscriptions GM %, Payments GM % | KPI Gross Margin % K-03 - GM % by category (dim_line) / KPI Subscription GM % - Payments GM % (same pattern on PAY) |
| opex | Sales & marketing, R&D and G&A as a share of net revenue. Lower is better, so the colour logic is inverted. Excludes other operating items, D&A and adjusting items. | Opex % = −(SM + RD + GA) ÷ NR | Sales & marketing % NR `[S&M % of NR]`; R&D % NR; G&A % NR; Opex = −(SM + RD + GA) money (positive); Opex vs Budget (favourable +) = Opex(Budget) − Opex(base), signed money | new: Opex % NR = blocks SM + RD + GA ÷ NR (PL % NR rows) - spec KPI §5 1.3 |
| units | Units shipped in the window (a flow: sums over the months). | units = Σ units_sold | Volume vs prior year = units ÷ PY units − 1, signed % | KPI Units Sold K-09 P |
| nrPerUnit | Net revenue divided by units sold: the price / mix lever. | NR per unit = NR ÷ units sold | Net revenue money; Units sold count | KPI NR per Unit K-10 P |
| gtn | Deductions from gross revenue (trade spend, rebates, returns) as a share of gross revenue. Lower is better. | GTN % = − GTN ÷ GR | Gross-to-net deductions money | KPI Gross-to-Net % K-04 P |
| ap | Advertising (working media) and consumer promotions as a share of net revenue. Neutral: no colour. | A&P % = − (SM_P1 + SM_P2) ÷ NR | A&P spend `[A&P Spend]` money | KPI A&P % NR K-05 P |
| gmv | Transaction value processed in the window, translated like amounts. | GMV = Σ gmv_local → reporting currency, per month × currency | Payments take rate `[Payments Take Rate]` 0.00%; Take rate vs Budget in bp (`ROUND ( Δ × 10000, 0 )`, "0 bp" without sign); Take rate vs Prior year in bp | KPI GMV K-09 S - KPI Payments Take Rate K-05 S |
| merchants | Merchants with an active paid plan at the last month-end of the window; never a sum over months. | merchants = active_merchants_end at the window end (K-23) | GMV per merchant = `[GMV per Merchant]` as "$81.3 k" (÷ 1,000, 1 dp) | KPI Active Merchants K-10 S - new: KPI GMV ÷ KPI Active Merchants |
| arr | Platform-subscription net revenue of the last month in the window × 12. A run-rate proxy, not contract ARR. | ARR = SUB NR (last month) × 12 | Net new ARR vs prior-year end = ARR − ARR under "Prior Year", signed money | KPI ARR K-04 S - new: KPI ARR − KPI ARR as Compare B |
| mix | Platform subscriptions and Payments as shares of net revenue; the rest is apps, partners & ads and professional services. Neutral: no colour. | share = NR of the service line ÷ NR | Platform subscriptions: NR money + "(+x% YoY)"; Payments: same | Prof NR Share by dim_line (SUB, PAY) - gap analysis P1 |
| fy | Latest estimate of net revenue for the whole fiscal year: actual closed months plus the latest forecast for open months (C-02). Same card for every company. | attainment = FY LE ÷ FY Budget | Revenue attainment `[FY NR Attainment]`; Adj. EBITDA, FY LE `[FY EBITDA LE]` money; EBITDA attainment | FY LE Amount - FY Budget Amount - PL Δ LE vs Budget (M-14) |

Reference values for the default views: `08-validation.md` §4.2.

## 4. Page `Analysis` (one page: variances on top, the two bridges underneath; `views/analysis-view.tsx`)

| Id | Visual | x, y, w, h | Content |
|---|---|---|---|
| A0 | Shape | 88, 118, 1168, 288 | Panel: white, border `#DEE3E9`, radius 12 |
| A1 | Card (new) | 100, 122, 600, 30 | Title `[LV Title]` 15 / 600 `#101B2B`, followed by `[LV Filter Text]` 12 `#4F5C6C` (two callouts side by side or one text measure `[LV Title] & "   " & [LV Filter Text]`) |
| A2 | Button (blank, funnel icon) | 1188, 124, 24, 24 | Funnel: icon `#4F5C6C`; action bookmark `Panel – Variance filter`; tooltip "Filter the variances" |
| A3 | Card (new) | 1204, 118, 16, 16 | Applied count badge `[LV Filter Count]`, 10 / 600 white on fx `[Theme Acc]` (transparent when blank) |
| A4 | Button (blank, "i" icon) | 1224, 124, 24, 24 | ⓘ: tooltip page `TT Info` filtered to `Variances` (§6) |
| A5 | Table | 96, 154, 1152, 246 | Largest variances (below) |
| A6 | Shape | 88, 416, 579, 288 | Panel (NR bridge) |
| A7 | Stacked column chart | 96, 420, 563, 280 | Net revenue bridge (§4.2); title "Net revenue bridge" 15 / 600 |
| A8 | Shape | 677, 416, 579, 288 | Panel (profit bridge) |
| A9 | Stacked column chart | 685, 420, 563, 280 | Profit bridge; title fx `[Br Profit Title]` |

### 4.1 Table A5 — largest variances (C-45)

- Columns in order: `Dim Account[AccountName]` (header "Line", left) · `Dim Account[BlockName]` (header "", 11 px
  `#4F5C6C`, the grey block suffix) · `[LV Alloc]` (header "", 10 px, dashed-border pill look not available: plain
  `#4F5C6C` italic) · `[LV Money Cmp]` (header = static "Comparison"; the web header is the comparison's name, shown in
  the panel title) · `[LV Money Base]` ("Actual" — the web says "Actual" whatever the base) · `[LV Delta Bar]`
  (header "", data bar) · `[LV Money Delta]` ("Δ") · `[LV Delta Pct Text]` ("Δ %") · `[LV Money Cmp B Delta]`
  (header static "vs Compare B"; web "vs PY") · `[LV Money FX]` ("of which FX") · `[LV Abs Delta]` (header "|Δ|",
  width 1 px, font white — present only to sort by).
- Sort: `[LV Abs Delta]` descending (web tie-break by account order is not reproducible).
- Visual-level filter: `[LV Show] = 1`.
- Totals: on; label "Total P&L Δ at operating profit" (Format → Totals → label, if available; else "Total"); totals row
  background `#F6F8FA`, 600, top border `#CDD4DC`. Totals of the text measures are computed by the measures at total
  level (Σ of the shown leaves = operating-profit Δ; `analysis.ts:469-491`).
- Conditional formatting: `[LV Money Delta]` font fx `[LV Tone Colour]`; `[LV Delta Pct Text]` font fx `[LV Pct Colour]`;
  `AccountName`, `[LV Money Cmp]`, `[LV Money Base]` font fx `[LV Row Font Colour]` (grey on allocated rows);
  `[LV Delta Bar]` data bars show bar only, min −1, max 1, positive `#3BA37B`, negative `#E2804A`, axis
  `rgba(16,27,43,.45)` ≈ `#8A919B`, background track not available (web track `#EDF0F3`).
- Fonts: Plex Sans Condensed 12.5, headers 11.5 / 600 `#4F5C6C`, row padding 3 (web `.vtable`), horizontal gridlines
  `#EDF0F3`. Numbers right-aligned.
- Empty state: no row → the table shows nothing; add a card (new) on top at 96, 190, 1152, 24 with
  `IF ( COUNTROWS ( FILTER ( VALUES ( 'Dim Account'[AccountCode] ), [LV Show] = 1 ) ) = 0, "Nothing is booked for this combination." )`
  as a measure (`LV Empty Text`), 13 `#4F5C6C`.
- When Compare B = None the "vs Compare B" column is blank (web drops it).

Reference (Consumer Products default): 37 rows; top 3 GR_P1 Gross product sales −$69.5 m, SM_P1 Advertising: working
media +$18.3 m, COR_P2 Sourced finished goods +$14.5 m; footer Budget $571.8 m, Actual $550.2 m, Δ −$21.6 m, −3.8 %,
vs PY +$60.8 m, FX +$4.8 m (`08-validation.md` §4.3).

### 4.2 Bridges A7 / A9 (C-40)

Stacked column chart, one per bridge.

- X axis: `Bridge Step[StepLabel]` (sorted by `StepSort`), type categorical, labels 11 px `#4F5C6C` (9.5 px for the
  14-step profit bridge if it is crowded; wrap on).
- Y axis values, in this order: `[Br Invisible]` (colour: transparent / fill `#FFFFFF` with 100 % transparency),
  `[Br Total]` (fx `[Theme Acc]`; fallback `#2453A6`), `[Br Subtotal]` `#2B3748`, `[Br Up]` `#3BA37B`,
  `[Br Down]` `#E2804A`, `[Br FX Bar]` `#CDD4DC` with border 1 px `#4F5C6C` (the web hatches it), `[Br Level Bar]`
  `#8592A3`.
- Visual-level filters: `Bridge Step[Bridge]` = "NR" (A7) / "PROFIT" (A9); `[Br Visible] = 1`.
- Y axis: start fx `[Br Axis Min]`, end fx `[Br Axis Max]`; gridlines `#EDF0F3`; axis labels 10 px `#8592A3` in display
  units (format `#,##0,,` for millions); axis title off. The axis does **not** start at zero (README decision 4); the
  ⓘ says so.
- Data labels: on for the visible series only (off for `[Br Invisible]`); label value = `[Br Label Text]` (Data labels →
  Value → field), detail = `[Br Sub Text]` (9.5 px `#4F5C6C`); value colour fx `[Br Label Colour]`; position "Outside end".
- Column width: gap 38 % (web bar ≈ 62 % of the step). Legend off. Tooltips: `[Br Label Text]`, `[Br Sub Text]`.
- Steps:
  - NR, Consumer Products: `{cmp} NR` → Volume → Price / mix → Constant-currency NR → FX → Actual NR.
  - NR, Commerce Cloud: `{cmp} NR` → Platform subscriptions → Payments → Apps, partners & ads → Professional services →
    Constant-currency NR → FX → Actual NR.
  - Profit (both): `{cmp} Adj. EBITDA` → Revenue volume → GM rate → GM mix → Variable selling → S&M → R&D → G&A →
    Other operating → FX → Adj. EBITDA → D&A → Adjusting items → Operating profit.
  - `{cmp}` = Budget / Latest estimate / Prior year (the bridge comparison). "Actual NR" stays "Actual NR" whatever the
    base (`analysis.ts:155`).
- Checks: comparison + steps = actual to the unit (T-05); FX = 0 at constant currency (T-10).

### 4.3 ⓘ texts (tooltip page `TT Info`, §6)

| Visual | What | Formula | Values |
|---|---|---|---|
| Largest variances vs {cmp} | Every leaf line of the P&L down to operating profit, ranked by \|Δ\|. Δ = actual − comparison on signed values, so a positive Δ always helps profit and a negative one hurts it; bars share one scale. The filter narrows the figures to one region, channel, category or price tier, or any combination of them; opex and below are booked by region only and allocated by NR share to the other slices (marked alloc.). | Δ = actual − comparison; Δ % = Δ ÷ \|comparison\|, n.m. when \|comparison\| < 2.0 or \|Δ %\| > 50 %; FX = (actual − actual cc) − (comparison − comparison cc); filtered line = Σ fact rows of the chosen members, below CM × NR share | Lines to operating profit: count of shown rows; Filter: `[LV Filter Text]` or "none (whole company)"; Second comparison: "actual − {Compare B name}, same months" / "n/a (no … data)" / "none (Compare B off)" |
| Net revenue bridge | {cmp} to actual: driver steps at constant currency, a constant-currency subtotal, then FX (translation, not controllable). The axis does not start at zero; read the labels. | P: volume = Σ slices (U − Ucmp) × NRcc cmp ÷ Ucmp; price / mix = ΔNRcc − volume. S: service-line step = NRcc actual − NRcc comparison per line. CC subtotal = comparison + Σ steps; FX = (NR − NRcc) actual − (NR − NRcc) comparison | Reported Δ vs {cmp}: money (signed %); Constant-currency Δ: money (signed %); FX: money |
| Profit bridge | {cmp} Adj. EBITDA to actual: revenue volume at the comparison's gross margin, GM rate and mix by category (S: service line), variable selling, the opex blocks (all at constant currency), then FX. D&A and adjusting items are actual levels (their Δ is the small label) so the bridge reconciles to operating profit. No share-based compensation step: not in the data. | volume = ΔNRcc × GM %cmp; mix = Σ lines (NR − NR × share cmp) × GM %cmp,line; rate = ΔGPcc − volume − mix; FX = (E − Ecc) − (Ecmp − Ecc,cmp) | Adj. EBITDA Δ vs {cmp}; of which FX; Δ at constant currency; Operating profit Δ vs {cmp} |

"How to read - Analysis" panel lines (`view-copy.ts:39-58`): Showing `[HowTo Showing]` · Top: "Every line to operating
profit ranked by |Δ|, prior-year Δ and of which FX. The funnel filters by region, channel, category and price tier, alone
or combined." · Bottom: "Net revenue bridge (drivers at constant currency → CC subtotal → FX → actual) and profit bridge
(comparison Adj. EBITDA → actual → operating profit)." · Colours: "Bridges: increase green, decrease orange, totals
company colour, subtotals dark, FX hatched; axes do not start at zero. Variance bars: right helps profit, left hurts, one
scale." · Legend (§5.3).

## 5. Page `Profitability` (one scrolling page, 1280 × 900; `views/profitability-view.tsx`, `engine/profitability.ts`)

| Id | Visual | x, y, w, h | Content |
|---|---|---|---|
| P0 | Shape | 88, 118, 688, 300 | Panel |
| P1 | Card (new) | 100, 122, 664, 30 | "Profitability by Region" 15 / 600 + `[Prof Subtitle]` 12 `#4F5C6C` ("Constant currency (FY2026 budget rates) - USD m - vs Budget") |
| P2 | Table | 96, 156, 672, 256 | Region table (§5.1) |
| P3 | Shape | 786, 118, 470, 300 | Panel |
| P4 | 100 % stacked bar chart | 794, 122, 454, 292 | "Concentration - share by profit level" (§5.2) |
| P5 | Shape | 88, 428, 579, 460 | Panel |
| P6 | Card (new) | 100, 432, 555, 30 | "Growth and margin by region" 15 / 600 + `[Trend Note]` 12 `#4F5C6C` |
| P7 | Line chart (small multiples) | 96, 464, 280, 420 | Net revenue growth vs prior year (§5.3) |
| P8 | Line chart (small multiples) | 380, 464, 280, 420 | Contribution margin % (§5.3) |
| P9 | Shape | 677, 428, 579, 460 | Panel |
| P10 | Card (new) | 689, 432, 555, 30 | Title `[Heat Title]` ("Mix - region × category" / "… × service line") |
| P11 | Matrix | 685, 464, 563, 30 | Header strip: Columns `Dim Line[LineName]`, Values `[Heat Line GM Text]`, no rows, column headers off — prints "GM 51.6%" above each line column |
| P12 | Matrix | 685, 494, 563, 390 | The heatmap (§5.4) |

ⓘ buttons at the right end of each panel title (P1, P4, P6, P10) open `TT Info` filtered to the visual.

### 5.1 Table P2

- Rows `Dim Region[RegionName]`; columns: "Net revenue" `[Prof NR]` · "Δ vs {cmp} %" `[Prof NR Delta Pct]` (header
  static "Δ vs comparison %") · "GM %" `[Prof GM %]` · "CM %" `[Prof CM %]` · "CM Δ pp" `[Prof CM Delta pp]` ·
  "Contribution" `[Prof Contribution]` · "Adj. EBITDA" `[Prof EBITDA]`.
- Sort by `[Prof NR]` descending (regions by net revenue; web tie-break by region sort order).
- Totals on, label "Total", row background `#F6F8FA`, 600, top rule `#D5DCE3`.
- Conditional formatting: `[Prof CM Delta pp]` icon = field value `[Prof CM Status Icon]` (left of the value), the only
  status indicator on the table; `[Prof NR Delta Pct]` plain ink (PV-13).
- Fonts: Plex Sans Condensed 13.5, headers 11.5 / 600 `#4F5C6C`, padding 7 / 6, gridlines `#EDF0F3`.
- Region filter: none (all four regions). Not allocated (opex is booked by region, C-31).

Reference (Consumer Products default): North America $1,488.6 m −2.7% 49.4% 39.2% −0.5 pp (watch) $583.1 m $299.4 m …
Total $3,369.0 m −2.8% 49.4% 39.1% −0.6 pp $1,318.8 m $676.7 m (`08-validation.md` §4.4).

### 5.2 Concentration P4

- Y axis: `Conc Level[LevelLabel]` (Net revenue, Contribution, Adj. EBITDA; sorted); Legend: `Dim Region[RegionName]`;
  X: `[Conc Share]`.
- Region colours (fixed; the web colours by NR rank, which is NA, EU, AP, UK for both companies): North America
  `#6B48C8`, Continental Europe `#2453A6`, Asia-Pacific `#3BA37B`, UK & Ireland `#E2804A`.
- Data labels inside, 11 / 600 white, format `0.0%`; legend off (web: no legend; hover shows the region); bar height
  60 % of the band; category labels 12 / 500 `#101B2B`; X axis off; gridlines off.
- Tooltip: region, level, share.

### 5.3 Growth and margin by region P7 / P8

- Small multiples: `Trend Row[RowLabel]` (sorted by `RowSort`: North America, Continental Europe, Asia-Pacific,
  UK & Ireland, Company), layout 1 column × 5 rows, shared Y axis on ("one scale for every row"), small-multiple title
  inside left, 12.5 / 500.
- X axis: `Dim Month[MonthLabel]` (sorted by `MonthIdx`), categorical; only the base window's months have values
  (others are blank and drop off); show first and last label only if possible (concatenate labels off; font 10.5
  `#4F5C6C`).
- Values: P7 `[Trend Growth]` (solid 2 px, colour per row: use "Series colour by small multiple" if available; else one
  accent `#2453A6`) and `[Trend Growth Company]` (dashed 1.2 px `#8592A3`); P8 `[Trend CM %]` and `[Trend CM % Company]`.
  In the Company row both series coincide.
- Markers: last point only (not available natively: markers on, size 3, for the main series). Data labels: last value
  only — Power BI cannot label only the last point; use "Data labels → Series → main series → Show for: Last" if the
  version offers it, else off (the tooltip carries every value).
- Y axis: format `+0%;−0%;0%` (P7), `0%` (P8); gridlines `#EDF0F3`; zero line `#CDD4DC`.
- Title of each chart: "Net revenue growth vs prior year" / "Contribution margin %", 12 / 600.
- Empty state: months without a prior year (2024) are gaps; the panel subtitle `[Trend Note]` says how many.

### 5.4 Heatmap P12

- Rows `Dim Region[RegionName]` (sort by `[Heat NR]` descending: matrix → sort by the value column), columns
  `Dim Line[LineName]` (visual filter `Dim Line[EntityCode]` = company via measure filter
  `[Slicer Member Visible Line] = 1` and `IsUnassigned = FALSE`; sorted by `LineSort`), values `[Heat NR]` and
  `[Heat Share]` with "Switch values to rows" **on** (NR bold over the share, 11 px).
- Row and column totals on ("Total"); grand total = company NR at CC (equals the table total in P2).
- Conditional formatting: background fx `[Heat Cell Background]`, font fx `[Heat Cell Font]` on both values; totals
  `#F6F8FA` 600. Cell borders 2 px white (gridlines white 2 px).
- Tooltip: region × line, NR, share of the region, GM % (`DIVIDE ( [Prof Raw GP], [Prof Raw NR] )`).

### 5.5 ⓘ texts (`profitability.ts`)

| Visual | What | Formula | Values |
|---|---|---|---|
| Profitability by Region | Constant currency, rows by net revenue. Δ vs {cmp} % on net revenue; GM % and CM % of the region's revenue; CM Δ = contribution margin % minus {cmp} in pp, the only column with a status dot. Adj. EBITDA is booked by region (C-31): nothing here is allocated. | GM % = GP ÷ NR; CM % = contribution ÷ NR; CM Δ = CM % − comparison CM % | Comparison: {cmp}; Status dot: "on track ±0.3 pp, watch to 1.0 pp, off track beyond, ahead = green" |
| Concentration - share by profit level | Three 100 % bars: each region's share of net revenue, of contribution and of Adj. EBITDA (booked by region), regions in the table's order and coloured as in Growth and margin below; hover a segment for its region. A region whose share shrinks from revenue to contribution dilutes the margin; one whose share grows is accretive. | share = region value ÷ company value, per level; drift = EBITDA share − NR share (pp) | per region: "NR share / CM share / EBITDA share (drift ±x.x pp)" |
| Growth and margin by region | Month by month over the period: on the left each region's net revenue growth against the same month a year earlier, on the right its contribution margin %. One row per region in the table's order, then the company; the faint dashed line in each region's row is the company. Both columns keep one scale for every row, the last month is labelled at the line's end. Constant currency, so growth is organic. | growth = NRcc(month) ÷ NRcc(same month a year earlier, actual) − 1; CM % = contribution ÷ NR of the month | per row: "growth +x.x%, CM y.y% in {last month}" |
| Mix - region × {category / service line} | Cells: net revenue at constant currency and its share of the region; colour = the cell's net revenue (dark = large). Column headers carry the line's gross margin %. Row and column totals reconcile to the table. | cell = NR(region, line); share = cell ÷ region NR; colour = cell ÷ largest cell; header GM = GP ÷ NR of the line | per line: "NR $x m, GM y%" |

"How to read - Profitability": Showing … · Top: "Table by region at constant currency (status dot on CM Δ only) and
concentration bars (share of revenue, contribution and Adj. EBITDA; region colours as in the rows below, hover a segment
for its region)." · Below: "Growth and margin by region month by month (net revenue growth vs prior year, contribution
margin %; the company dashed behind each region), and the mix of region × {category / service line}. Scroll for it." ·
Basis: "Constant currency by default when comparing; by region nothing is allocated (opex is booked by region, C-31)." ·
Legend.

"How to read - Vitals": Results: "Net revenue, Adj. EBITDA and Operating profit, then Gross margin % and Opex % revenue."
· Drivers & health: "Five cards whose content follows the company (L-10); FY outlook for every company." · Card face:
"Value, Δ vs Compare A and Compare B ($ and %, pp for ratios), “on plan” for a zero Δ, status chip vs Budget." · Legend.

Legend line (every How to read): 'Status vs Budget only: grey on track (±1 % / ±0.3 pp), amber watch (to 3 % / 1 pp),
red off track beyond, green ahead; "lower is better" inverts on Opex %. ⓘ on each card holds its definition and
sources.'

## 6. Tooltip pages

| Page | Size | Content |
|---|---|---|
| `TT Vitals card` | 320 × 240, Page information → Tooltip on | Text: `Vitals Card[CardTitle]` 15 / 600; cards (new) with `[Vit Info What]` (13), "Formula" + `[Vit Info Formula]` (12, `#4F5C6C`), `[Vit Info Values]` (13, line breaks), `[Vit Info Source]` (11, `#8592A3`). Fields well: `Vitals Card[CardId]` |
| `TT Info` | 360 × 280 | One page per visual is simplest (`TT Info variances`, `TT Info NR bridge`, `TT Info profit bridge`, `TT Info profitability`, `TT Info concentration`, `TT Info trends`, `TT Info heat`): static texts from the tables above with `{cmp}` replaced by `[Bridge Cmp Name]` and the values as measures. Assign each as the tooltip of its ⓘ button's visual, or use the visual header "Help tooltip" with the static "What" text when a button cannot carry a report-page tooltip |

Glass pop-up styling of the web (white 88 % with blur) is not reproducible; use a white card, border `#DEE3E9`, radius
12, shadow `0 14px 36px rgba(16,27,43,0.20)` (the flyout shadow).

## 7. Notices (L-05, C-50)

The web shows notices only as the last rows of the applied-filters pop-up, with a count badge on its button
(`components/pnl/header.tsx:86-115`). Power BI: badge F11 + table rows in the applied-filters panel (06 §3.6). Exact
texts (measures in `04-measures.md` §11):

| Label | When | Text |
|---|---|---|
| Cut-off | base Actual and the window ends after the last close | "Actuals closed through Sep 2026: later months excluded; use Latest estimate for the full window" |
| Forecast | base Latest estimate and the window ends after the last close | "Forecast months included: Oct 2026 – Dec 2026 (Forecast 9+3 (Sep 2026))" (first open month or window start … window end) |
| Prior year | Compare A or B = Prior year and the window starts before Jan 2025 | "Prior year n/a before Jan 2024"; custom range adds ": it covers 6 of the range's 12 months" |
| History | LTM starting before Jan 2024 | "LTM starts before the data history (Jan 2024)" |
| Eliminations | Group view | "ACME Group: Commerce Cloud fees billed to Consumer Products are eliminated" |

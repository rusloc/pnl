# 03 · Views and interactions

from rusloc/pnl (archi) · to vosk.dev repo agent · 2026-11-26 · status: ready

Open `mockup/mockup-v2-2026-11-26.html` beside this file. Sizes are CSS pixels on the 1440 × 810 board; colours are token names from `04` § 1. Where a later USER decision replaced an earlier one, only the final state is a requirement (the trace is in `05` § 4).

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [period]  ACME Cash Flow                    Statement › Activities › Transactions  [menu] │  56
│           company · dates · unit · as of                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Closing cash [▮] │ Net change │ Operating CF │ Free cash flow │ Cash conversion │ DSO     │  84
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ one panel, full remaining height: Statement  |  Activities  |  Transactions               │
│ (scrolls inside; pop-ups and tooltips float above)                                        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## 1. Shell and path

| ID | Requirement | Src |
| --- | --- | --- |
| CF-NAV-01 | Fixed board 1440 × 810, padding 16, three rows: top bar 56, KPI row 84, panel = the rest, 12 between rows. The board itself never scrolls and never grows. | c1 |
| CF-NAV-02 | Top left: a rounded square (56 × 56, radius 16, `--sec` fill, `--bg` text) that shows the period and opens the calendar + settings pop-up. Top right: the same square with a four-tile icon (the fourth tile round) that opens the menu. While its pop-up is open a square turns `--hl` with `--ink` content. | c1 |
| CF-NAV-03 | Period badge, three lines: mode in small caps (`Month`, `Quarter`, `Year`, or the quick handle `YTD` / `QTD` / `MTD`), the value in bold (`Oct`, `Q3`, `2025`), then the year, or for Year the month range (`Jan–Oct`). Accessible name: `Period <label>[ to date]; open calendar and settings`. | c1, c14 |
| CF-NAV-04 | Title `ACME Cash Flow` and one context line: `<company> · <first day> – <last day> · USD` or `USD thousands` `· as of <as-of date>`. No other text bar on the page. | ADR-0012 |
| CF-NAV-05 | The path `Statement › Activities › Transactions` is always visible, on every level, right-aligned in the top bar. It never shows a fourth step, an `Esc` chip or a Diagram pill. | c4, c8, c11 |
| CF-NAV-06 | The current step is a `--hl` pill (radius 999, padding 3 × 12) with a 13 px weight-600 `--ink` label and `aria-current="page"`; the other steps are `--muted` text buttons. Each step reserves its bold width, so nothing shifts when the level changes. No underline. | c17 |
| CF-NAV-07 | Every step is a link. `Statement` resets the stack to the statement. `Activities` opens the activity already on the stack, else the last one used (Operating at first). `Transactions` opens that activity with all lines and no day. Scroll position resets to the top. | c4 |
| CF-NAV-08 | The top bar and the KPI row sit outside the scrolling area on every view: always visible. | c3 |
| CF-NAV-09 | The panel fills the remaining height down to the bottom margin on every view, whatever its content; only the content changes between views. No blank page background below a short panel. | c9 |
| CF-NAV-10 | After a view change keyboard focus moves to the panel container (`tabindex="-1"`, no visible ring). | mock |

## 2. KPI row

| ID | Requirement | Src |
| --- | --- | --- |
| CF-KPI-01 | Six equal cards in this order: Closing cash · Net change · Operating cash flow · Free cash flow · Cash conversion · `DSO · days`. | c1 |
| CF-KPI-02 | Card face = title (12 px, `--muted`), value (21 px mono, weight 600), one delta line (`▲ 4.5 vs Sep 2026`), ⓘ in the top-right corner. No sparkline, no mini chart, no status chip. | ADR-0012, c1 |
| CF-KPI-03 | All six cards are plain: same fill (`--surf`), same 1 px `--line` border, no highlight, no coloured cap, no hero card. | c3 |
| CF-KPI-04 | The Closing cash card carries a small `--hl` button (22 × 22, radius 7, bar-chart icon in `--ink`) in its **bottom-right** corner, on the delta row, that opens the Cash pop-up. The ⓘ stays top right; the card's height and the other cards do not change; the button never overlaps the delta text in any period or unit (the mock keeps at least 47 px clear). | c4, c17 |
| CF-KPI-05 | Values: money cards with the money format and `k` suffix in USD k; Cash conversion `1.04×` or `n/m`; DSO `46.4`. Delta line per CF-ENG-19. The delta is `--ink`, never red or green. | c1 |
| CF-KPI-06 | The row follows the period and the unit and shows on all three views. | c2 |

## 3. View 1 · Statement

| ID | Requirement | Src |
| --- | --- | --- |
| CF-STM-01 | Landing view. One card titled `Statement of cash flows` holding one table: the classic statement on the left, one horizontal bar per row on the right, aligned to its row. | c1 |
| CF-STM-02 | Column widths: label 38 %, amount 12 % (label + amount = half the table), a 20 px gap, the bar track (the rest), and an 84 px `% of NI` column at the far right. | c3 |
| CF-STM-03 | Column header row, sticky at the top of the scroll area: period label (`Oct 2026`, plus ` · to date` for a partial period) · unit (`USD` / `USD k`) · the bar axis ticks · `% of NI` with its own ⓘ. | c3 |
| CF-STM-04 | Rows and their order per `02` § 3.3. Indent 18 px per level. Row heights: lines 26, section totals 30, net change and balances 32, section rows and pinned balance rows 38. | c1 |
| CF-STM-05 | **Opening and closing cash are always visible.** "Cash at beginning of period" pins directly under the column header, "Cash at end of period" pins at the bottom of the panel; each pins only when its own place has scrolled out of view, with a soft shadow on the inner edge, and no row is ever hidden under a pinned row. | c2, c6 |
| CF-STM-06 | The three activities are expandable sections. A click anywhere on a section row (or Enter / Space on it) toggles all its sub-rows. A chevron shows the state (`aria-expanded`). **All three are expanded when the report opens.** | c4, c5 |
| CF-STM-07 | A collapsed section row shows the section total, its bar and its % of NI. An expanded section row shows the label only; the total moves to the "Net cash from …" row. | c4 |
| CF-STM-08 | Each section row carries a small `--hl` button with an arrow (22 × 22, after the label) that opens the Activities view for that activity. Clicking the rest of the row still toggles. | c4 |
| CF-STM-09 | Bars: length = the row's absolute amount on one shared axis (CF-ENG-10), starting at the left edge of the track; 4 gridlines at 25 / 50 / 75 / 100 %. `sub` rows and expanded section rows have no bar; a zero value has no bar. | c1 |
| CF-STM-10 | Bar colours: every line, subtotal and total bar is `--lineBar` (#8A8986); the two balance bars are `--sec`. No border, no hatch, no dash, no stripe on any bar. | c2, c3 |
| CF-STM-11 | **Every bar has the same thickness (12 px)**: balance, line, subtotal and total rows. | c16 |
| CF-STM-12 | A balance bar longer than the axis is cut at the axis end and marked with a solid zigzag notch in the card colour, 44 px before the end. | c2 |
| CF-STM-13 | Card header: a two-item legend (`Line amount, absolute` grey swatch, `Balance` navy swatch) and an ⓘ. | c1 |
| CF-STM-14 | The row moved by the mapping override carries a small `S01` chip (`--hl` fill, `--ink` 10 px bold). Hover or focus shows: **Override S01** · "Line of credit is typed Other Current Liability in QBO (operating); the mapping override moves it to financing. Net change does not move." | c1 |
| CF-STM-15 | Rules: a 1 px `--ink` line above the amount of each total row (Total adjustments, section totals, net change); a 3 px double line under the closing-cash amount. No vertical rules. | Tab 1 § 11.2 |
| CF-STM-16 | Toggling a section keeps the scroll position and leaves focus on the section row. Changing the period keeps the expanded state. | mock |
| CF-STM-17 | No per-row sparkline, trend or comparison column. | ADR-0012 |

## 4. View 2 · Activities

```
┌ Operating ┬ Investing ┬ Financing ┐
│           └───────────┴───────────┴───────────────────────────────────────────────┐
│ Operating activities   Oct 2026                                                    │
│ [Name ⇅]            1  2  3  4 … one square per calendar date … 31     [Total ⇅]  │
│ Receipts from customers →  ■ ■   ■ ■ ■     ■                           ■  110,958  │
│ …                                                                                  │
│ Net cash from operating activities                                        (18,781) │
│                                                              ▢ ■ ■ ■ ■ ■ (legend) ⓘ│
└────────────────────────────────────────────────────────────────────────────────────┘
```

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ACT-01 | One activity at a time. Rows = its direct-method lines (Operating 8, Investing 4, Financing 4), columns = calendar dates of the period, each cell one line on one date. Lines with no cash in the period stay listed (faint). | c1 |
| CF-ACT-02 | Activity switch = **folder tabs above the title**: `Operating`, `Investing`, `Financing`. All tabs have the same width = the widest label plus padding (124 × 41 today), the strip is left-aligned, outer corners 14 px. The active tab has the panel fill, bold `--ink` text and no bottom edge, so it joins the box; inactive tabs have the page fill, `--muted` text and a bottom rule; the rest of the strip line continues the box's top edge. No orange underline. | c14, c15, c16, c17 |
| CF-ACT-03 | At least 22 px between the tab strip and the title line below it. Title: `<Activity> activities`, then the period label (` to date` when partial). | c16 |
| CF-ACT-04 | Tabs are a `tablist`; switching replaces the content in place: same period, same sort, heat cursor cleared, focus stays on the chosen tab. | c14 |
| CF-ACT-05 | Layout: a 256 px label column, the cell grid, a 120 px totals column; 10 px between them. The label and totals columns never scroll sideways. | c5 |
| CF-ACT-06 | **Cells are squares.** Cell size = clamp(grid width ÷ min(days, 31), 16, 40); row height = cell size; 2 px between cells, radius 2. On the board the grid is 959 px wide: 30.9 px for a 31-day month and for every longer period, a little larger for shorter months (30 days 32.0, 28 days 34.3) so the month fills the width. | c4, c5 |
| CF-ACT-07 | A period longer than one month keeps that cell size and scrolls sideways inside the grid under an **always-visible** styled scrollbar (12 px, `--sec` thumb on a `--sub` track). **One column is one calendar date; several days or months are never merged into one column.** | c5 |
| CF-ACT-08 | X axis. Up to 31 days: one tier with the day of month under every column (every second day when cells are under 18 px). Longer: two tiers, a month band (`Oct 2026`, alternating `--sub` / `--sub2` fill) above every date, and a vertical separator through the grid at each month start. | c5 |
| CF-ACT-09 | Colours: a row-wide empty strip (`--sub`) behind each line; a cell with cash moved takes the colour of its block (CF-ENG-13): blocks 1–4 = `--q1` … `--q4` (single-hue navy, light to dark), **block 5 = `--hl` (orange, the top 20 %)**. No diverging scale, no in / out hue. | c9 |
| CF-ACT-10 | Totals column: per line, a square of the heat-cell size (cell − 2 px) in the colour of the total's block (CF-ENG-14), left of the net total in `--ink` mono. A zero total has an empty (`--sub`) square and prints `–`. The activity's net total at the bottom has no square and a full-width 1 px rule above it. No background colouring of the numbers. | c9, c10 |
| CF-ACT-11 | Legend: six swatches (empty + five blocks) **without labels**, anchored in the bottom-right corner of the panel under the totals column, followed by an ⓘ. Each swatch's tooltip gives its bounds: `Block 3 (40–60 %): 2.7k – 5.3k`, or `Block 3: no days`. | c10 |
| CF-ACT-12 | Two sort toggles in the axis row: `Name` above the line titles, `Total` above the totals. First click: Name → A–Z, Total → high–low (by absolute total). A further click flips the direction. Switching to the other toggle clears the first: one sort at a time. The active toggle shows its direction (`Name A–Z`, `Total High–low`), an `--hl` border and `aria-pressed="true"`. The sort survives a period or activity change. Default: line order. | c10 |
| CF-ACT-13 | A line label is a button (arrow mark) that opens Transactions for that line and the period; a line with no cash is disabled. The bottom row `Net cash from <activity> activities` opens Transactions for all lines. | c1 |
| CF-ACT-14 | A coloured cell is a button: click opens Transactions for that line on that date. Empty cells do nothing. | c1 |
| CF-ACT-15 | Hover or keyboard cursor on a cell shows a tooltip: long date · line label · In · Out · Transactions (count). Amounts exact in USD, one decimal in USD k. | c1 |
| CF-ACT-16 | An activity with no cash in the period shows its lines with empty strips, `–` totals and a legend whose block tooltips read "no days". | mock |

## 5. View 3 · Transactions

| ID | Requirement | Src |
| --- | --- | --- |
| CF-TXN-01 | One card. Title `<Activity> › all lines` or `<Activity> › <line label>`; beside it the long date when a day is selected, else the period label; an ⓘ. | c1 |
| CF-TXN-02 | Four summary tiles: Cash in · Cash out · Net · Transactions (count). The Cash in and Cash out tiles carry a 3 px top edge in `--in` / `--out`. | c1 |
| CF-TXN-03 | Table columns: Date (`5 Oct 26`) · Party (counterparty name, `(no name)` for id 0) · Memo (`–` when empty) · `Type · No.` (`Bill Payment #1042`) · Line (only when all lines are shown) · Amount (right, mono, signed with parentheses) · Clr. Long cells cut with an ellipsis and keep the full text as a title. | c1 |
| CF-TXN-04 | Order: date, then transaction id, then amount. No user sort, no search, no row click. | mock |
| CF-TXN-05 | The table scrolls inside the card, with a sticky header and a sticky total row (`Total · 90 transactions`, net amount); the top bar, KPI row and summary tiles stay in view. | c3 |
| CF-TXN-06 | **Clear marks**: `R` reconciled and `C` cleared = flat 18 px `--hl` discs with the letter in `--ink` (9.5 px bold); `U` uncleared = the same disc with no letter; not applicable (Undeposited Funds) = a small `--hl` dot. No border, ring, hatch or dash. Each mark has its state as a text title / accessible name. | c14, c15, c17 |
| CF-TXN-07 | No rows: the card shows `No cash moved` instead of the table; the tiles show `–` and `0`. | Tab 1 § 11.5 |
| CF-TXN-08 | A period change keeps the activity and the line; a selected day outside the new period is dropped. | mock |

## 6. Pop-ups

### 6.1 Common behaviour

| ID | Requirement | Src |
| --- | --- | --- |
| CF-POP-01 | Matte frosted glass: `--bg` at 60 % alpha, backdrop blur 22 px + saturate 140 %, about 4 % grain, 1 px light border, radius 16, soft shadow. Without `backdrop-filter`: 95 % solid. Tooltips use the same glass (blur 20 px). | c7, ADR-0012 |
| CF-POP-02 | One layer at a time: opening a pop-up closes the open one. Esc, a click outside and the × close it. Focus moves into the pop-up, Tab is trapped, and focus returns to the opener on close. `role="dialog"`, `aria-modal="true"`, labelled by its heading. | ADR-0012 |
| CF-POP-03 | Every close button is the same: 30 × 30, radius 9, `--hl` fill, `--ink` ×, no border; focus ring in `--ink`. | c15, c17 |
| CF-POP-04 | The page behind stays visible and unblurred, except behind the two management pop-ups (Diagram, Reconciliation): there the page is blurred 7 px and tinted with `--bg` at 25 %. | c7, c10, c12 |
| CF-POP-05 | Placement: calendar under the period square (left 16, top 80); menu under the menu square (right 16, top 80, 300 wide); ⓘ next to its button (360 wide, flipped to stay on the board); Cash (1160 wide), How to read (760 wide), Diagram and Reconciliation centred over the visible part of the board. | mock |
| CF-POP-06 | Text on glass is `--ink` only (no muted tones): worst case 4.90:1. | c8 |

### 6.2 Calendar and settings

| ID | Requirement | Src |
| --- | --- | --- |
| CF-CAL-01 | **Static box 400 × 432** in every span and quick state (the size of the Month view); Year and Quarter content sits at the top of a fixed 164 px slot, so "To date" and "Units" never move. | c16 |
| CF-CAL-02 | Top to bottom: heading `Period` · span tabs `Year` `Quarter` `Month` · the elements of the chosen span · `To date · <last month>` with `YTD` `QTD` `MTD` · `Units` with `USD` `USD k`. | c14 |
| CF-CAL-03 | Year span: one button per data year (three per row). Quarter span: a year stepper `‹ 2026 ›` and `Q1`–`Q4`. Month span: the stepper and `Jan`–`Dec` (four per row). The stepper stops at the first and last data year. | c14 |
| CF-CAL-04 | An element with no data is disabled (Nov, Dec 2026). A partial one (2026; Q4 2026) has a dashed edge and a tooltip / description naming its months (`Jan–Oct only`, `Oct only`). | c14 |
| CF-CAL-05 | A pick applies at once (the page behind re-renders) and the pop-up stays open with focus on the picked control. Year → mode `A`, Quarter → `Q`, Month → `M`. | c14 |
| CF-CAL-06 | `YTD`, `QTD`, `MTD` are separate quick buttons for the current period (the last data month). A quick pick overrides the span selection: while it is active no span tab and no element shows as selected, and the badge shows the quick name. Picking an element clears the quick handle. | c14 |
| CF-CAL-07 | Opening the calendar shows the span of the current selection (YTD → Year, QTD → Quarter, MTD → Month) and the selected year in the stepper. | c14 |
| CF-CAL-08 | **Every selection has the same dark style as the Units chip**: selected year / quarter / month cell, active quick button and selected unit = `--sec` fill, `--bg` text, weight 600. The selected span tab is bold with a `--sec` underline (not orange). Hover and focus stay distinguishable from selected. | c16 |
| CF-CAL-09 | Units: `USD` (whole dollars) and `USD k` (thousands, one decimal). The choice applies to every money figure except where CF-ENG-20 says exact. | c1 |

### 6.3 Menu

| ID | Requirement | Src |
| --- | --- | --- |
| CF-MNU-01 | Three blocks: **Drill path** (`1 Statement`, `2 Activities`, `3 Transactions`, numbered circles joined by a thin line) · a boxed **Management view** (`Diagram`, `Reconciliation`) · below a separator, alone, `How to read`. | c1, c2, c11 |
| CF-MNU-02 | The current drill step is marked: `--sec` fill, `--bg` text, its number in `--hl`, `aria-current`. Diagram and Reconciliation are never "current" (they are pop-ups). | c2, c12 |
| CF-MNU-03 | Drill items close the menu and **reset the stack**: Statement; Activities (the current activity, else Operating); Transactions (keeps the line and day when already on Transactions, else all lines). Diagram, Reconciliation and How to read replace the menu with their pop-up. | c2 |

### 6.4 ⓘ and How to read

| ID | Requirement | Src |
| --- | --- | --- |
| CF-INF-01 | An ⓘ button (20 px circle) on each KPI card (6), the `% of NI` header, the Statement card, the Activities legend, the Transactions card and the Diagram header: 11 definitions. Explanations appear nowhere else on the page. | ADR-0012 |
| CF-INF-02 | ⓘ pop-up = title · one short paragraph · the formula in a mono box · a source line. Texts verbatim from `INFO` in `mockup/mockup-v2-pops.js`. The Diagram's ⓘ opens as an inline note at the top of the Diagram pop-up (toggle), never a pop-up over a pop-up. | ADR-0012, c12 |
| CF-INF-03 | One `How to read` for the report (menu). Two columns: **Path** (the three steps, a paragraph on how to move, **Keys**) and **Marks** (signs, bar colours, activity-card bars, rules, the S01 chip, the five heat blocks, clear marks, the accent). Text and swatches per `howHtml()`; it names the Esc key and both management pop-ups. It has no line about thicker total bars. | ADR-0012, c8, c16 |

### 6.5 Cash pop-up

| ID | Requirement | Src |
| --- | --- | --- |
| CF-CSH-01 | Opened only from the Closing cash card's button. Heading `Cash · <period>`. Four cards in one row: **Cash balance**, then **Operating**, **Investing**, **Financing**. | c4 |
| CF-CSH-02 | Cash balance card (not clickable): header value = closing cash; rows Opening · In · Out · Closing, where In = M09 and Out = M10, so Opening + In + Out = Closing. | c4 |
| CF-CSH-03 | Activity cards: header = name, direct net, arrow; rows In · Out · Net from the **direct** section flows. When the statement's section total differs from the direct net, a note under the rows: `statement adds <gap> non-cash`. | c1 (open: Q-12) |
| CF-CSH-04 | All four cards share one row grid: a 30 px header and four 24 px rows, label column 60 px, value column 96 px, the same bar x-offset. **In and Out sit on the same line across all four cards; Closing aligns with Net.** The activity cards leave the first row (Opening's line) empty. | c9 |
| CF-CSH-05 | Bars (12 px): **Opening and Closing `--hl`, no border**; In `--in`; Out `--out`; Net `--hl`. Cash balance bars share one scale (largest of opening, closing, in, |out|); the activity bars share another (largest in or |out| of the three). A zero has no bar. | c3, c15, c17 |
| CF-CSH-06 | An activity card is a button: it closes the pop-up and opens the Activities view of that activity (pushed on the stack). | c4 |

### 6.6 Diagram (management view)

| ID | Requirement | Src |
| --- | --- | --- |
| CF-DIA-01 | The Diagram is a pop-up opened from the menu, like Reconciliation. There is no Diagram view, route, path step or header state; the page underneath keeps its view. | c2, c11, c12 |
| CF-DIA-02 | **Fixed box 1200 × 600** (clamped to the board and the viewport), the same size collapsed, expanded and in any period; the header stays and the body scrolls. | c14 |
| CF-DIA-03 | Tree, left to right: root **Net change in cash** → three activity nodes (Operating, Investing, Financing, joined with `+` marks) → four KPI groups → three metrics per expanded group. Root value = net change; activity values = the **statement's** section totals. | c1 |
| CF-DIA-04 | Groups, lead values and metrics exactly as the table below. A click on a group expands or collapses its metrics (`aria-expanded`); metric nodes are not interactive. | c1 |
| CF-DIA-05 | Header: `Diagram · <period>`, an ⓘ, and two chips **Expand all** / **Collapse all**; each is disabled when it would change nothing. Redrawing keeps the scroll position and the focus on the control used. | c14 |
| CF-DIA-06 | Background of the tree: a grid of semi-transparent orange dots (`--hl` at 30 % alpha, 1.6 px dots, 22 px pitch). Nodes are solid. | c7 |
| CF-DIA-07 | An activity node closes the pop-up and opens that activity's Activities view on top of whatever view was open; Esc then returns to that view. The root node is not clickable. | c12 |
| CF-DIA-08 | Node sizes: root 240 × 104 (`--sec` fill, `--bg` text, 4 px halo of `--hl` at 55 %), activity 210 × 78 (2 px `--ink` border), group 240 × 70 (`--sub` fill; `--hl` border when open; `+` / `−` mark), metric 260 × 56; 52 px between columns; the tree is centred in an 1120 px canvas and positions animate on expand (not with reduced motion). | mock |

| Activity | Group · lead value (caption) | Metrics: value · caption |
| --- | --- | --- |
| Operating | **Cash quality** · cash conversion (`cash conversion`) | CFO margin `15.9%` · `CFO ÷ revenue` — Cash conversion `1.04×` / `n/m` · `CFO ÷ net income` — Accruals (money) · `net income − CFO` |
| Operating | **Working capital** · cash conversion cycle `43.0 d` (`cash conversion cycle`) | DSO `48.0 d` · `A/R ÷ revenue × days` — DPO `5.0 d` · `A/P ÷ bills spend × days` — Cash conversion cycle · `DSO − DPO (no inventory)` |
| Investing | **FCF and investment** · free cash flow (`free cash flow`) | Free cash flow (money) · `CFO − capex + proceeds` — Capex intensity `2.2%` · `capex ÷ revenue` — Capex coverage `7.11×` / `no capex` · `CFO ÷ capex` |
| Financing | **Leverage and coverage** · DSCR (`debt service coverage`) | DSCR `6.59×` · `CFO ÷ (interest + term principal)` — Net debt ÷ EBITDA `−0.64×` / `n/m` · `net cash · EBITDA annualised` when net debt is negative, else `EBITDA annualised` — Payout cover `1.01×` / `no draws` · `CFO ÷ owner draws` |

Root caption: `closing less opening · <period>`. Activity caption: `net cash · opens heatmap`. Example values are YTD Oct 2026.

### 6.7 Reconciliation (management view)

| ID | Requirement | Src |
| --- | --- | --- |
| CF-REC-01 | Opened from the menu's Management view block. **Fixed box 1200 × 600**, content centred; the widest state (a year) fits without wrapping or sideways scroll. | c10, c11, c14 |
| CF-REC-02 | What it shows: every figure the page prints for the selected period beside its control total, with a ✓ or ✗ per row. Left table `Statement · KPI` (the 12 head checks of CF-ENG-24: Page, Control); right table `Direct line` (16 lines: Heatmap row, Ledger, Control). Amounts exact to the cent; M16 to four decimals. | c1, c11 |
| CF-REC-03 | Heading: `Reconciliation · <period>` and the count `44 / 44 tie ✓`. Footer: `checks/control_totals_usd.csv · <key> · M06–M08 with overrides on · DIRECT_LINE = overrides on`. | c11 |
| CF-REC-04 | A period without a control key (any quarter; a YTD that ends neither in December nor in the last data month) shows only: `Control totals exist per month and per year. Pick a month, a year or YTD.` | mock (open: Q-09) |

## 7. Keyboard

| Where | Keys |
| --- | --- |
| Anywhere | `Tab` / `Shift+Tab` in DOM order (top bar, KPI row, panel); `Esc` closes the open pop-up, else steps back one view (CF-KEY-02) |
| Statement section rows | `Enter` / `Space` toggle · `↑` `↓` move between the three section rows |
| Activities tabs | `←` `→` (wrapping), `Home`, `End`: move and select at once |
| Heat grid (one tab stop) | `←` `→` `↑` `↓` move the cursor, `Home` / `End` first / last day of the row, `Enter` opens the day when it has transactions |
| Pop-ups | `Tab` trapped; `Esc` closes |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-KEY-01 | Everything a mouse can do, the keyboard can do: the table above is the minimum. | Tab 1 § 12.1 |
| CF-KEY-02 | **Esc and the view stack** (D-7). The stack starts as [Statement]. Pushing: a section's arrow button, a Cash pop-up activity card, a Diagram activity node, a line label, the activity total row, a heat cell. Replacing the top: an Activities tab. Resetting: a path step or a menu drill item (they rebuild Statement → Activities → Transactions as far as the chosen step). Esc pops one entry and does nothing on [Statement]. | c1, c12 |
| CF-KEY-03 | The heat cursor is an `--hl` outline on the cell; it scrolls its column into view in a long period and shows the cell's tooltip. The grid has an accessible name `<Activity> cash moved per day; arrow keys move, Enter opens the day`. | c1 |

## 8. URL state

The query string is the whole shareable state. Parsed and validated in `lib/engine/url-state.ts` (Zod) before anything reaches the engine.

| Key | Values | Default (omitted from the URL) |
| --- | --- | --- |
| `p` | `m-YYYY-MM` · `q-YYYY-N` · `y-YYYY` · `ytd` · `qtd` · `mtd` | `m-<last data month>` (`m-2026-10`) |
| `u` | `k` | USD |
| `v` | `activities` · `transactions` | statement |
| `a` | `inv` · `fin` (only with `v`) | `op` |
| `l` | a direct line code in lower case, e.g. `d_rec_cust` (only with `v=transactions`) | all lines |
| `d` | ISO date, e.g. `2026-10-15` (only with `l`) | the whole period |
| `c` | comma list of collapsed sections: `op`, `inv`, `fin` | none collapsed |
| `s` | `name` · `name-desc` · `total` · `total-asc` | line order |
| `pop` | `cash` · `diagram` · `rec` · `how` | closed |
| `g` | comma list of open Diagram groups: `quality`, `wc`, `fcf`, `lev` | none open |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-URL-01 | Every key is validated at the boundary. An invalid value falls back to its default; an unknown key is dropped; a key that needs another (`a`, `l`, `d`) is dropped without it. Nothing unvalidated reaches the engine or the DOM. | ADR-0002 |
| CF-URL-02 | Cross-checks: `p` must be a period with data (else default); `l` must belong to activity `a` (else dropped); `d` must lie inside the period (else dropped); lists are de-duplicated and written in a fixed order. | archi |
| CF-URL-03 | After every state change the URL is rewritten in canonical form with `history.replaceState`: fixed key order as in the table, defaults omitted. `parse(serialize(state)) = state` for every reachable state. No `pushState`. | D-6 |
| CF-URL-04 | Loading a URL builds the canonical stack: `v=activities` → [Statement, Activities]; `v=transactions` → [Statement, Activities, Transactions]; then opens `pop`, if any, over that view. `pop=diagram` therefore opens the Diagram over the Statement unless `v` says otherwise. | c12 |
| CF-URL-05 | Not in the URL: calendar, menu and ⓘ pop-ups, the heat cursor, scroll positions, the calendar's span tab and stepper year. | archi |
| CF-URL-06 | No `localStorage`, `sessionStorage`, cookie or IndexedDB read or write. The unit persists through the URL only. | D-6 |

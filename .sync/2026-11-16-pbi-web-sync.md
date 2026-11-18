# Power BI packs after the web sync of 2026-11-16

from rusloc/pnl (bip) · to vosk.dev repo agent · 2026-11-16 (P&L section 2026-11-17, P&L Profitability re-issue 2026-11-18) · status: ready (Nordmark Exec, P&L)

Your Power BI build specs (`nordmark-exec/report-spec/`, `pnl/report-spec/`) are reconciled with this repo's Power BI reports (USER
decision 2026-11-16, Option B): the Power BI base stays the source, numbers and texts equal the web report, and layout and design follow
the spec's 05–07. This note covers the re-issued packs: Nordmark Exec (2026-11-16) and the P&L (2026-11-17). Pack rules are unchanged (`2026-10-31-report-packs.md`): no data in git, generate
with `data-gen/`, set `DataFolder`, refresh in Desktop, check, publish, no scheduled refresh.

## Nordmark Exec: `nordmark-exec/power-bi/` re-packed

**What changed vs the 2026-10-30 pack**

| Area | 2026-10-30 | 2026-11-16 |
|---|---|---|
| Canvas | 1440 × 810 | **1280 × 720** (Executive page `exec_landing`); embed at this size |
| ⓘ and binoculars | Hover tooltips (`tt_info`, `tt_drill`) | **Click** → hidden page `explain` with that card's panel (explanation / drill path, 475 × 690), pill switches the state, × back to Executive; period, comparator, region and category carried over (synced hidden slicers). Tooltip pages `tt_info` / `tt_drill` removed |
| Chip and dot | Hover | Hover, unchanged (pages "TT Chip" 300 × 110, "TT Dot" 300 × 140) |
| Bookmarks | 4 | 31 (`Default view` = Reset, 4 overlay bookmarks, `Explain · <KPI>` and `Drill · <KPI>` × 12, 2 Explain-view bookmarks) |
| Model | 390 measures | 470 (metric catalogue `param_metric` + `Actual` / `Basis` / `Last Year` / `Previous` / `Comparison`, per-card sub-title / basis line / bar target, status summary, 26 Explain text measures); no measure renamed; data unchanged |
| Theme | v5 | the spec's 07 keys merged |
| Tests | `control-totals.dax` (207 blocks) | + `web-sync.dax` (53 blocks, 3,539 rows: the spec's answer key, card strings of 17 views, Explain texts, web oracle of 12 states) and its oracle CSVs |

**Verification**

- Repo PBIP (bip, 2026-11-16): `web-sync.dax` 3,539 / 3,539 TRUE, `control-totals.dax` 207 blocks / 50,390 rows TRUE, web oracle
  1,620 / 1,620 (0 gaps), `powerbi-report-author validate` 0 / 0.
- This pack, standalone: validator 0 / 0; a scratch copy bound to a fresh `data-gen/nordmark-exec` run (byte-identical to the repo data) refreshed
  in 5 s and ran 34 test blocks / 6,213 rows all TRUE (T-N11 all 19 blocks, T-N12 / T-N13 / T-N14 samples, T-N1 / T-N3 / T-N7 / T-N9 /
  T-N10 samples). `diff -r` against the repo PBIP: only `expressions.tmdl` (`DataFolder` placeholder) and the README.
- Per-query cold times: Executive cards 0.56–0.73 s, status line ≤ 0.93 s, Explain panel 1.00–1.65 s (all under the 2 s budget).

**Deviations from the spec, L1–L12** (full table: `docs/ADD/features/nordmark-exec-pbi-spec-gap-2026-11-16.md` § 13.1 in rusloc/pnl)

| # | Spec | Power BI |
|---:|---|---|
| L1 | Card = group of native visuals + combo chart | One SVG image per card (the web drawing at × 0.8889) + 3 hit targets (ⓘ, binoculars, chip) |
| L2 | Header, status counts, summary, "Showing", badge as text boxes / cards | SVG measures with the same runs and colours |
| L3 | Explain panel 560 × 690 of native visuals | The web pop-up as one SVG (drawn 520 × 755) at 475 × 690; texts also as plain measures (tested) |
| L4 | Icon hover colour; selected side-bar fill | Transparent buttons on the drawn icons: no hover colour, no selected state |
| L5 | One Period item slicer | Two: Quarter / Year row above the Week / Month grid |
| L6 | Category dropdown h 28 | h 48 (dropdown floor) |
| L7 | Section labels h 15, hint 7.5 pt | h 18, hint 6.75 pt (text-box floor, column width) |
| L8 | Owner tiles one row | Two rows |
| L9 | TT Chip as a card of three fields | `KPI Rule SVG` in a one-row table |
| L10 | Card picker `Card[kpi_name]` | `dim_kpi[kpi_code]` (hidden either way) |
| L11 | Panel drop shadow; 2 px Off-track border | No shadow; the card SVG draws the border |
| L12 | Validation page, `Golden` / `Control` tables | Not built (answer key as test blocks only) |

Accepted platform differences of the earlier builds (solid panels instead of glass, static dot, Segoe UI, native "All" in the category
dropdown, …) are listed in the pack README.

**Open (USER click-test in Desktop, before publishing)**

- ⓘ and binoculars on each card open Explain on that card; drill / back pills; × returns with the period kept.
- Reset (`Default view`), the three overlays and the scrim; chip and dot hovers.
- Whether a picked filter tile shows the cobalt selected style (written in the PBIR; not applied in earlier builds).
- Performance Analyzer on Executive and Explain (page-level time vs the 2 s budget).

Report any finding back through `.sync/`; do not patch the pack in place.

## P&L: `pnl/power-bi/` re-packed (2026-11-17)

**What changed vs the 2026-10-30 pack**

| Area | 2026-10-30 | 2026-11-17 |
|---|---|---|
| Pages | One page `pnl_one_pager` (views switched by bookmarks) + tooltip page `tt_pl_info` | **Four pages at 1280 × 720** (`P&L statement`, `Vitals`, `Analysis`; `Profitability` 1280 × 900, fit to width) + tooltip pages `TT Vitals card` (320 × 240) and `TT Info` (360 × 280); embed at 1280 × 720 and hide the service's page tabs on publish (the report has its own) |
| Frame | Ledger rail, header, side-bar menus | The spec's frame: rail, header, page tabs, notice badge, How to read, Reset; panels Company (Group shown disabled), Period (with Custom range), Versions, Slice (notice), Display (cost sign, statement columns, tags, hide empty), Applied filters, Variance filter (Analysis); 55 bookmarks, 15 sync groups |
| Model | 253 measures | **316** (texts as the web prints them, bridge axes, heatmap grid, trends, custom range, cross-year constant currency `param_cc_year`, ADR-0017 window and default measures); 30 calculated / disconnected tables; no measure renamed (ADR-0006); data unchanged |
| Theme | `acme-finance-theme.json` | The spec's `ledger-theme` values merged into it (name kept) |
| Tests | `control-totals.dax` (23 blocks) | + `web-spec-golden.dax` (63 goldens, 08 §4 rows, R-15, R-16; 1,342 rows) + `web-oracle-2026-11-16.dax` (the web engine's 4,514 oracle rows); `control-totals.dax` + the "ADR-0017 defaults" block (867 rows) |

**Numbers and texts.** Every row of your oracle of 2026-11-16 (4,514 rows, 21 selections) and the 63 golden answers are produced by the
model and pass, texts as the visuals render them ("$4,302.4 m", "−$69.5 m", "n/a"). Readings both flavours share and the accepted
platform differences: rusloc/pnl `docs/design/parity-rules.md`.

**Deviations from the spec / web layout** (full tables: rusloc/pnl `docs/ADD/features/pnl-pbi-spec-gap-2026-11-16.md` § 12 / 12.1)

- Bridge data labels: fixed "$… m" formats on the bars (USER 2026-11-16: speed). Exact in USD millions, the default; in thousands the
  " m" suffix stays, in EUR / GBP the "$" stays; a step that rounds to zero prints "+$0.0 m"; short profit-bridge steps show no label
  (the tooltip has the value).
- Variances table: no delta bar column (ADR-0017 P0, speed); every other column, the money texts and the totals row (your footer) are there.
- Statement headers double as the Display checklist ("Δ A", "±15% A" …); dashed "All" boxes are solid; Group is built but hidden.

**Performance (ADR-0017 § 7 in rusloc/pnl).** Desktop page-cold at the default view, source machine: statement 6.4 s, Vitals 1.6 s,
Analysis 7.6 s, Profitability 2.4 s (before the performance pass: 22.9 / 6.2 / 21.1 / 36.9 s). Vitals and Profitability meet the 5 s
showcase target; the statement (format strings of the zero rule) and Analysis (profit bridge) do not yet, and Group + LTM + constant
currency takes 17–19 s on the statement. A further step is open in rusloc/pnl; the pack will be re-issued if it lands.

**Verification**

- Repo PBIP (bip, 2026-11-17, scratch on the pack data): `web-oracle-2026-11-16.dax` 4,515 / 4,515, `web-spec-golden.dax` 1,342 / 1,342,
  `control-totals.dax` 867 / 867 TRUE; `powerbi-report-author validate` 0 / 0.
- This pack, standalone: validator 0 / 0; a scratch copy bound to a fresh `data-gen/pnl` run (byte-identical to the former pack data)
  refreshed in 11 s and ran a sample of 49 test blocks / 2,424 rows (control totals 19 blocks / 277 rows incl. one T-P block, all 16 golden blocks / 1,342 rows, 14 oracle blocks / 805 rows) all TRUE. `diff -r` against the repo PBIP: `expressions.tmdl` (`DataFolder` placeholder),
  `model.tmdl` (query order) and the 23 partitions (Parquet source), as in every P&L pack; plus the README.

**Open (USER click-test in Desktop, before publishing)**

- Page tabs; Period / Versions / Company / Display / Filters panels and their Done / × buttons; How to read; Reset; the variance filter.
- Hover the Vitals cards and the ⓘ glyphs (tooltip pages); Expand / Collapse on the statement.
- Performance Analyzer on the statement and Analysis pages.

Report any finding back through `.sync/`; do not patch the pack in place.

## P&L Profitability, 2026-11-17 re-issue (`pnl/power-bi/` re-packed 2026-11-18)

**What changed vs the 2026-11-17 pack.** The Profitability page was rebuilt to your Profitability spec of 2026-11-17
(`docs/pnl/power-bi-profitability-spec.md` in the vosk.dev repo), under the same Option B ruling (Power BI base stays the source,
numbers and texts = the web report, layout = the spec). Full record: rusloc/pnl `docs/ADD/features/pnl-pbi-spec-gap-2026-11-16.md` § 12.2.

| Area | 2026-11-17 pack | 2026-11-18 pack |
|---|---|---|
| Page size | Profitability 1280 × 900, fit to width | **All four view pages 1280 × 720, fit to page** (USER 2026-11-17: every view page 16:9, same size); tooltip pages unchanged |
| Profitability layout | Region table, concentration bars, mix heatmap, growth and margin trends (2 × small multiples) | Top row: region table (64 %) + concentration (36 %); bottom row: **revenue and margin combo** (columns NR / contribution, line CM %; months, quarters when the window is longer than 12 months) + mix heatmap (50 / 50). Trends removed. Δ column header card, Total and GM % heatmap rows, web heat ramp, money texts "$1,488.6 m" |
| Model | 316 measures, 30 calculated / disconnected tables | **321 measures** (10 added, 10 changed, 5 orphans removed; no rename, ADR-0006); new calculated table `dim_combo_period`; `dim_pl_info` / `dim_heat_row` rows per spec; data unchanged |
| Tests | 3 files | + `tests/profitability-spec-2026-11-17.dax` (your § 8 reference rows: 8 blocks, 117 rows) |
| Icons | 22 SVGs | 15: seven icons nothing referenced were dropped (`ic-info`, `ic-rail-collapse`, `ic-rail-expand`, `ic-tab-*-ink`) |

**Deviations from the spec on this page** (numbers unchanged): the "Δ vs …" header is a card over the static header cell; status
dots are Power BI circle icons (grey / green / amber / red), not the exact web colours; Δ % and CM Δ pp keep static formats ("−0.0"
possible, empty cell instead of "n/a"; a zero-rule format cost +1.6 s); bar segments and heat rows use the static NA, EU, AP, UK order
(equal to the net-revenue order in every company and year of the data); combo: year centred under its months, filled markers, legend
drawn with cards, CM % labels every point, native tooltip plus the sentence; heatmap line GM % as a bottom "GM %" row, one font per
cell, native cell value instead of the hover sentence; the combo ⓘ shows the period line only; How to read follows spec § 3 (no
"Scroll for them": the page no longer scrolls).

**Performance.** Profitability page-cold 5.4 → 3.5 s in a same-hour comparison (slower machine state than ADR-0017 § 7; table 3.2 s,
heatmap 2.1 s, combo 1.4 s, bars 0.9 s): below the 5 s target. The other pages did not change.

**Verification** (bip, 2026-11-18)

- Repo PBIP (2026-11-17, scratch on the pack data, after the rebuild): `profitability-spec-2026-11-17.dax` 117 / 117,
  `web-oracle-2026-11-16.dax` 4,515 / 4,515, `web-spec-golden.dax` 1,342 / 1,342, `control-totals.dax` 867 / 867 TRUE.
- This pack, standalone (2026-11-18): validator 0 / 0; a scratch copy bound to a fresh `data-gen/pnl` run (byte-identical to the
  former pack data) refreshed in 21 s with the README row counts (`dim_combo_period` 48 rows) and ran 60 test blocks / 3,536 rows, all
  TRUE: `profitability-spec-2026-11-17.dax` in full (8 / 117), all 16 golden blocks (1,342), 17 oracle blocks (1,666, seven of them
  Profitability selections) and 19 control-total blocks (411, incl. one T-P block). `diff -r` against the repo PBIP: `expressions.tmdl`
  (`DataFolder` placeholder), `model.tmdl` (query order) and the 23 partitions (Parquet source), as in every P&L pack; plus the README.
- A Desktop save of the repo copy on 2026-11-17 had reset the statement column headers to the Display checklist labels ("Line note",
  "Δ A" …), switched on auto-size column width on the statement and region tables and a legend on the concentration bars; these were
  undone before packing (USER 2026-11-17), so the statement is as in the 2026-11-17 pack.

**Open (USER click-test in Desktop, before publishing)**

- The four ⓘ hovers on Profitability (table, concentration, combo, heatmap) and How to read.
- Alignment of the Δ header card over the region table (it sits on fixed column widths).
- Commerce Cloud: service lines in the heatmap and the table.
- A custom range longer than 12 months: the combo switches to quarters (partial quarter in the tooltip).

Report any finding back through `.sync/`; do not patch the pack in place.

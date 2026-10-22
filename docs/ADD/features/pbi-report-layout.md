# Track B — Power BI report layout (one-window P&L, Ledger design)

> **Status: draft (bip, 2026-10-21, Ledger rebuild; 2026-10-22 ADR-0007: toolbar removed, company picker on the brand mark, Key figures trends, info pop-ups).** Local PBIP in `pbi-report/`, not published. Layout reference: the **Ledger design guide** (`docs/design/design-requirements.md`, mockup `docs/design/P&L statement view/Main.dc.html`). The one-window layout departs from spec §2; the decision is **ADR-0004 (proposed)**, the USER decides.
> Spec: `docs/Requirements.md` §2, §4–§7, §10 · data rules: `data/acme_pl_dummy_data/README.md` · model: `docs/model/semantic-model.md` · measures: `docs/model/measure-dictionary.md` (folder `Design` holds the layout helpers).
> Restore point for the pre-Ledger draft: `pbi-report/__backup__/v1-draft-2026-10-21/`. Per-file backups of this rebuild: `pbi-report/__backup__/**/*.2026-10-21-1617.bak`.

## Design brief

| Item | Choice |
|---|---|
| Audience | CFO, group finance, entity GMs, FP&A, controllers (spec §1) |
| Canvas | One page, **1440 × 810** (16:9, the mockup's artboard, so every mockup pixel value is used 1:1), Fit to page |
| Principle | One window fits all: the page never scrolls; the view tabs swap the content area, the company cards decide whose numbers |
| Colour | Ledger tokens. Neutral frame (Ink 900 `#101B2B`, Slate 600 `#4F5C6C`, Line 200/300, Ground `#F2F4F7`, Subtle `#F6F8FA`, white surfaces). One identity colour per company via fx measures `_Acc` / `_AccT` (Products blue `#2453A6` / `#E8EEF8`, Cloud violet `#6B48C8` / `#F0EBFB`, Group graphite `#3B4A5E` / `#EAEDF1`). Fixed meaning colours: favourable `#06603F` (bar `#3BA37B`), unfavourable `#C2410C` (bar `#E2804A`), notice `#FBF4E4` / `#EBD9AE` / `#3D3216` |
| Typography | **Segoe UI / Segoe UI Semibold / Segoe UI Bold** (the design's own fallback; IBM Plex is not guaranteed on viewers' machines). Mockup px converted to pt and rounded: title 16 pt, card titles 13, flyout title 12, tabs and company names 11, body and table 10, labels 9, rail section label 8, KPI values 26 (financial) / 21 (operational) |
| Numbers | Right-aligned, minus sign `−` (U+2212) in every display format, `+` on deltas; KPI deltas carry ▲ / ▼; % KPIs in pp (L-12, N-06, K-20) |
| Variance meaning | Colour never alone: sign + (KPIs) arrow + colour (N-07). Colours come from rules on the delta measure itself plus cheap inputs (`PL Fav Off`, `KPI Fav Sign`), not from colour measures (perf) |

## Page map (1440 × 810)

```text
x: 0  64 88                                                                              1416 1440
   ┌──┬─────────────────────────────────────────────────────────────────────────────────────┐
   │A▾│ ACME GROUP · MANAGEMENT REPORTING · ACTUALS CLOSED THROUGH SEP 2026                    (company cards removed, ADR-0007)
   │──│ Profit & loss  Consumer Products · YTD Jan–Sep 2026 · Actual vs Budget and Prior year · USD m, …                                  │ header 0–122
   │▣ │ [▤ P&L statement][▦ Key figures][▥ Analysis][◔ Profitability]          [view toolbar]                        │
   │▥ ├─────────────────────────────────────────────────────────────────────────────────────┤ rule 122
   │⏷ │ ⓘ notice strip (137–181)                                                                                       │
   │⚟ │ active view (193–794)                                                                                          │
   │» │                                                                                                                │
   └──┴─────────────────────────────────────────────────────────────────────────────────────┘
 rail 64 px (Ink 900): brand "A▾" (acc, opens the company picker), divider, Period · Versions · Slice · Display, expand »; expanded rail 248 px overlays the content
 flyouts: x 74, y 92, width 352, pointer at the open item
```

## View map

| View (group) | Visuals | Spec | Notes |
|---|---|---|---|
| **P&L statement** (`grp_view_pl`, default) | Card shape · 4 column-group titles (`PL Hdr Base`, `PL Hdr Cmp A`, `PL Hdr Cmp B`, `PL Hdr FY`) with 2 px Ink rules · units caption · Expand all / Collapse all buttons above the line column (`pl_btn_expand`, `pl_btn_collapse` → data bookmarks `bm_pl_expand`, `bm_pl_collapse` on `pl_matrix`) · matrix `pl_matrix` · footnote · selected-tab overlay + 3 px `_Acc` underline. No toolbar: Layout, Cost lens and Detail were removed by ADR-0007 | L-07, M-10..M-14, M-20, M-21, M-22, L-11..L-14 | Matrix columns: Line · Notes (`PL Notes`: company alias + tags) · Amount · % NR · **vs A:** Amount · Δ · Δ % (data bars ±, green/orange) · **vs B:** Amount · Δ · Δ % · **Full year:** Budget · Latest est. · Δ. Fixed column widths so the group titles line up. Row kinds: key subtotals tinted `_AccT`, subtotals and memo `#F6F8FA`, ratio rows Slate 600. Default collapsed: blocks and subtotals only (M-20); every block still opens with its own +; the company picker's Done / close puts it back to collapsed (M-21) |
| **Key figures** (`grp_view_kpi`) | "FINANCIAL" / "OPERATIONAL" labels · three rows of 4 tiles: `kpi_fin` (slots 1–4), `kpi_fin2` (5–8), `kpi_ops` (9–12, Subtle fill), each a card visual with small multiples on `kpi_label` and a visual filter on the row's literal `kpi_code` list (about 4x faster than a filter on `kpi_group`) · over each row an image visual (`kpi_fin_trend`, `kpi_fin2_trend`, `kpi_ops_trend`) showing `KPI Row SVG` · toolbar caption (`Kpi Toolbar Caption`) + ▲ favourable / ▼ unfavourable legend pills | L-06, K-01..K-25 | Each tile: KPI name, value, deltas `KPI Δ A` / `KPI Δ B` on the right (titles `PL Hdr Cmp A/B`, coloured by rules with `KPI Fav Sign`). The overlay draws in the tile's left column the 13-month sparkline (K-24, selected month marked), the sub-line (`KPI Secondary`) and the target bar with Compare A / B ticks (K-25; none on growth KPIs). The overlays run their own queries, so the tile values never wait for them |
| **Analysis** (`grp_view_analysis`) | Bridge card: title, `Bridge Subtitle`, waterfall `an_bridge` · Variances card: `Var Title`, `Var Subtitle`, table `an_variances` (Line, Block, Δ with diverging data bars, Δ %) · (i) buttons `info_btn_bridge`, `info_btn_var` → info pop-ups · toolbar "Compared with" + `_Bridge Cmp Name` | L-08, L-15, C-40, C-45, T-05 | Totals Ink 700, increases `#3BA37B`, decreases `#E2804A`. Base / comparison columns removed from the variances table (fewer evaluations) |
| **Profitability** (`grp_view_prof`) | Table card: `Prof Title`, `Prof Subtitle`, "margin, % of net revenue" caption, `prof_table` (share as data bars), `Profitability Note` · Chart card: `CM Title`, `CM Subtitle`, `cm_bars` (CM % bars in `_Acc`, dashed Ink line at the company average = `KPI CM %` at the visual total, scale 0–60 %) · (i) buttons `info_btn_prof`, `info_btn_cm` → info pop-ups · toolbar "Break down by" button slicer | L-09, L-15, C-46, F-21 | Breakdown options filtered by `Breakdown Allowed` (company: Region + 3 slices; Group: Region, Company) |

Visual budget for N-01: hidden groups do not query. Visible on open: header (eyebrow, context), notice strip, the P&L group (matrix + 5 title cards + fx shapes / buttons that read `_Acc` / `_AccT`) and the rail. The fx shapes and buttons run one tiny scalar query each.

## Rail, flyouts and switchers — how they are built

| Control | Built with | Why |
|---|---|---|
| Company picker (F-01, L-01) | Rail brand mark `rc_brand` / `re_brand` ("A▾", fill `_Acc`, tooltip and alt text "Switch company") → `bm_fly_entity` opens `grp_fly_entity`: the button slicer `hdr_entity` (`advancedSlicerVisual` on `param_entity_view`, single select, 3 stacked cards, label role `Ent Card Sub`, accent bar `Ent Card Acc`). Done / ✕ / the mark → `bm_fly_close_entity` (hides every flyout, statement back to collapsed). The header context line names the company (`Hdr Context`) | A real filter: period, versions, currency and region carry over (F-31); slices per company as before (F-30) |
| View tabs | 4 action buttons → display-only bookmarks `bm_view_*`; each view group holds its own selected-tab overlay and `_Acc` underline | Bookmarks are the only native way to swap visual sets; Data off, so filters never reset |
| Rail | `grp_rail_c` (64 px, default) and `grp_rail_e` (248 px, labels + `Rail Sum *` summaries) toggled by `bm_rail_expand` / `bm_rail_collapse` (» / « Collapse; the brand mark opens the company picker) | Opening a flyout collapses the rail, so flyouts always sit at x 74 |
| Flyouts | 4 groups `grp_fly_period / versions / slice / display`: open-item highlight (click = close), pointer, 352 px panel (radius 12, Line 200, shadow), title + subtitle, 40 × 40 close, rules, body, footer "Reset this group" + "Done". `bm_fly_*` open one and hide the others; `bm_fly_close` hides all | One flyout at a time (F-35) |
| Reset this group | Data bookmarks `bm_reset_*` (suppressDisplay) that remove the selection of the group's slicers, so the measure defaults apply (FY of the last close, last closed month, YTD, Actual vs Budget / Prior year, USD, actual rates, millions) | Keeps visibility; defaults stay dynamic |
| Segmented controls, chips, month grid | Button slicers: Table style for segmented controls, Cards style for chips (check icon) and the month grid; short labels via the Label role `Seg Label`, base-version cards via `Version Desc`, open months shaded via `Month Item Fill` / `Month Item Font` | Native, keyboard-operable, selections persist |
| Deferred controls | Action buttons of type Drillthrough without a destination = native **disabled** state with a tooltip (Costs shown +, Variance format, Statement-shows switches) | Shown, not hidden (brief) |
| Info pop-ups (L-15) | (i) buttons → `bm_info_bridge` / `_var` / `_prof` / `_cm` show one group `grp_info_*` (panel, title, ✕ → `bm_info_close`, text from `docs/ADD/features/info-popovers.md`). Static paragraphs are text boxes; a paragraph with {comparison} / {breakdown} is a button whose text is a measure (`Info Bridge 1` …). Switching views closes them | A card clamps long text and a button ignores line breaks (render-tested 2026-10-22) |
| Breakdown (F-21) | Field parameter `param_breakdown_field` + button slicer + `Breakdown Allowed` visual filter | Native field switching |
| Slices per company (F-09..F-11, F-32) | `Slice Member In View` visual filter on the slice slicers, the profitability table and the CM chart; Group view: slicers empty, `Slice Group Notice` box underneath | Each slicer lists only the current company's values |

Bookmark groups in the selection pane: **Views**, **Statement** (expand / collapse), **Filter flyouts** (incl. the company picker), **Rail**, **Reset groups**, **Info pop-ups**. Children of a group store positions relative to the group. Rename visuals only together with the bookmarks that target them (the build script asserts every target exists).

## Filters by flyout

| Flyout | Contents | Spec |
|---|---|---|
| Period | Fiscal year (3 segments) · Month (4 × 3 grid, open months shaded) + note · Time view (Month, QTD, YTD, LTM, FY) | F-02..F-04 |
| Versions | Base version (3 cards with descriptions) · Compare A (Budget, Latest est., Prior year, None) · Compare B (same) + note | F-05..F-07 |
| Slice | Region chips · Channel / Sales motion · Category / Service line · Price tier / Customer segment chips with counts (`Slice Hdr *`) · Group-view notice · allocation note | F-08..F-11, F-32 |
| Display | Currency (USD, EUR, GBP) · FX basis · Units ($m / $k) · Costs shown (− fixed, + disabled) · Variance (Amount and % fixed, others disabled) · Statement shows: % of NR column, Full-year outlook columns, Classification tags, Hide empty lines (always on, disabled switches) | F-12..F-17 |

## What matches the mockup, and the closest substitutes

| Mockup | Power BI |
|---|---|
| IBM Plex Sans / Condensed | Segoe UI family (viewer-safe) |
| Selected segment / chip / card: `accT` fill, `acc` text and ring | Selected-state styling is written to the files, but Desktop showed its own default selected style (dark fill, white text) in the render test; confirm in Desktop (checklist) |
| Row kinds: weight, italics, top rules per kind | Matrix fx can set only colours: key rows `_AccT`, subtotals `#F6F8FA`, ratio rows Slate; no per-row bold, italics or rules; the row-header cells stay white |
| Two header rows | Group titles are cards above a fixed-width matrix (they line up only while the column widths are not changed) |
| ±15 % bar column | Data bars inside the Δ % vs Compare A column (auto scale, no separate column, no extra query cost) |
| Tags as outlined pills, alias after the name | Notes column with alias · tag · IFRS 18 category as text |
| KPI delta pills (tinted) | Reference labels with coloured text, sign and arrow; no tint |
| Bridge total bars in `acc`, truncated axis | Waterfall colours are not fx-able: totals Ink 700; axis starts at zero (no "axis starts at" note) |
| Share bars in `acc` | Data bars (not fx-able): Group graphite |
| CM bars on a grey track | Bar chart in `_Acc` with the dashed average line; no track |
| Dashed open-month buttons, dashed "All" rows in Group view | Shaded open months; one notice box |
| Analysis "Compared with" switch | Shows the comparison the bridge uses (Compare A, else B, else Prior year); change it in Versions |
| Rail expands and pushes the content | Expanded rail overlays the content |

## Deferred (summary)

Costs as positives (M-25), variance format and Statement-shows switches (F-16, F-17), entity nodes in the Group statement (M-05), "n/a" text, drill-through (M-27), reference pages (L-02, N-12), RLS (N-04), mobile layout (N-09), export header (N-10), share link (F-37), Performance Analyzer baseline (N-01, T-18).

## First open in Power BI Desktop (USER checklist)

1. Open `pbi-report/ACME Unified PnL.pbip`. A blocking error names the file: send it back to bip.
2. No refresh is needed: only measures were added and changed (no table or column changes).
3. Page: 1440 × 810, Ground background, dark rail on the left, white header.
4. **Company picker:** Ctrl+click the "A▾" mark at the top of the rail and pick each company; the mark, tab underline, key subtotal rows, Done buttons and CM bars switch colour and the header context line names the company. Done / ✕ close it.
4a. **Expand all / Collapse all:** Ctrl+click Expand all. If the blocks do not open, expand every block in the matrix (+ on each block, or the matrix header's "Expand all down one level"), then View › Bookmarks › `bm_pl_expand` › Update; collapse everything and do the same for `bm_pl_collapse`. The hand-written expanded state could not be render-tested from the files; the collapsed one is.
4b. **Info pop-ups:** Ctrl+click the (i) on the bridge, largest variances, profitability table and CM chart; each opens its text, ✕ closes it.
5. **Tabs:** Ctrl+click each tab; the content swaps and the underline moves.
6. **Rail:** Ctrl+click Period, Versions, Slice, Display (flyout opens next to the item), ✕ / Done / the open item close it, » expands and « collapses the rail.
7. **Flyouts:** segmented controls show short labels (no long version names); the month grid shades open months; Base version cards show the descriptions; in the ACME Group view the Slice flyout shows the notice; "Reset this group" clears the group's selections (if it does nothing, set the defaults and use Bookmarks › `bm_reset_*` › Update).
8. **Disabled controls:** Costs +, Variance Amount / % and the four switches show a tooltip and do nothing.
9. **P&L statement:** group titles line up over Amount / Δ / Δ %; Δ and Δ % green or orange; ETR row uncoloured; bars inside Δ % vs Compare A; Notes column filled; every block collapsed on open.
10. **Key figures:** three rows of 4 tiles; each tile shows its value and two delta lines ("vs Budget", "vs Prior year") with ▲ / ▼ and colour on the right; a moment later the sparkline (13 months, last point marked), the sub-line (margin / reported growth) and the target bar with Bud / PY ticks appear on the left (no bar on growth KPIs).
11. **Analysis / Profitability:** waterfall colours, diverging bars in the variances table, share bars, CM bars with the dashed average line.
12. Run `pbi-report/tests/control-totals.dax` in DAX query view: every `_pass` TRUE.
13. Save in Desktop, then tell bip before any further file edits.

DRAFT — projection state (assessment only; nothing implemented in any track)

# P&L views redesign — KPI · Analysis · Profitability

> v4, 2026-10-27 (v1 2026-10-26, v2 and v3 2026-10-27 kept as `pnl-views-redesign-v1.html` / `-v2.html` / `-v3.html`). **Vitals** is the former Key figures view (renamed at USER review v4; spec IDs K-xx unchanged). One static page that restructures the three non-statement views of the ACME Unified P&L so the USER can judge the redesign before anything is built in Track A (Rayfin), Track B (Power BI) or Track C (JS). Method (USER): merge the metrics → list what is possible to build → redesign layout and metric list for maximum readability. No file under `fabric-app/`, `pbi-report/`, `js-report/`, `fabric-data/` or `data/` was touched.

## Files

| File | What it is |
|---|---|
| `pnl-views-redesign.html` | **v4.** One 1440 × 810 window in the Ledger design (rail, header, view tabs); switcher **Vitals · Analysis · Profitability** (P&L statement tab greyed, unchanged); Analysis and Profitability have two sub-pages each (‹ › pager, "n / 2", ← → keys). Self-contained: inline CSS/JS, inline SVG charts, Google Fonts only. `?view=ana` / `?view=prof` deep-link a view; the last view is remembered per browser. |
| `pnl-views-redesign-v3.html` | v3: "Key figures" name, Profitability page 2 stacked (bubble over heatmap) with a level switcher (Region → × sales motion → × service line) and a trails toggle. |
| `build-brief.md` | Build brief for fin / bip / the vosk.dev agent: panels, metric → measure lists (exists / buildable now only), controls, pop-up copy source, parity rules (ADR-0012, `parity-rules.md`), order of work. |
| `pnl-views-redesign-v2.html` | v2: banner, headline strips, 3 sub-pages per view, service-line table, lollipop, waterfall, trend, FY outlook, quarterly trend, allocation view. |
| `pnl-views-redesign-v1.html` | v1: sparklines on cards, explanations and source tags on the faces, no pager. |
| `metric-inventory.md` | The merge: one table per view (metric · source · status · priority · placement · note), the vocabulary map spec → model, the dropped list and the open decisions. Placements updated to v3 ("left off (v3)" rows stay buildable). |
| `README.md` | This file. |

## What v4 changed (USER review of v3)

1. **"Key figures" → "Vitals"** everywhere (tab, How-to-read title, ⓘ texts, README, inventory). Spec IDs K-xx, `dim_kpi` codes and the measure names are unchanged.
2. **Profitability page 2 is a vertical split:** growth × margin on the left half, the mix heatmap on the right half, both full height (two 659 × 685 px panels). The heatmap was re-oriented for a tall panel: 4 × 4 matrix, value and share of region in each cell, row and column totals, hover detail.
3. **Growth × margin is Region only:** the level switcher, the trails toggle and every other control on the panel are gone; 4 region bubbles with full names, quadrant labels inside the plot, company reference lines with values, "CM % · growth" labels and hover detail stay. **Trails stay drawn** (prior-year hollow dot → arrow → actual), without a toggle: they were the one actionable addition the USER asked for in v3, and the ⓘ states the data limit (blank for a window whose prior year has no prior year, i.e. the quoted FY2025 view; available from FY2026 windows). Sub-region levels are listed under "left off".
4. Visible words (content area, ⓘ excluded): Vitals 144 · Analysis 277 · Profitability 255 (the heatmap now carries row / column totals).

## What v3 changed (USER review of v2)

**Global.** The banner strip under the header is gone on every view. Period, currency and data date moved into the header status line (small grey: "Commerce Cloud · Management reporting · FY Jan – Dec 2025 · USD $m · Closed through Dec 2025 · Refreshed …"). The generated headline sentence left the page; it survives only as an example inside the Vitals "How to read" pop-up. Visible words (content area, ⓘ glyphs excluded; v1 → v2 → v3): Vitals 503 → 187 → **144** · Analysis 1,016 → 372 → **277** (2 pages) · Profitability 943 → 462 → **240** (2 pages).

**Analysis → 2 pages.**
- Page 1 = the two bridges only (net revenue bridge with CC subtotal; profit bridge Budget Adj. EBITDA → Actual → Operating profit), enlarged to the full height. The four headline-strip tiles are gone; their numbers live in the bridges' ⓘ (reported vs constant-currency Δ for NR and EBITDA).
- Page 2 = **Largest variances vs Budget** alone, expanded (see the granularity section below). Service-line economics, monthly trend and full-year outlook were removed.

**Profitability → 2 pages.**
- Page 1 = a concise **8-column table** (Region · Net revenue · Δ vs Budget % (CC) · GM % · CM % · CM Δ pp with the only status dot · Contribution $ · Adj. EBITDA $, total row) and the **concentration visual**: three 100 % stacked bars — each region's share of net revenue, of contribution and of Adj. EBITDA (booked by region) — with the drift vs revenue share in pp per region. Chosen over a treemap because the question is "which region dilutes or accretes as costs are taken off", which reads as a colour band narrowing or widening down the three bars. Margin dispersion, profit-driver and FX tiles and the CM deviation lollipop were removed.
- Page 2 = **Growth × margin** made actionable: quadrant labels inside the plot, company reference lines with their values (+27.5 % growth, 51.3 % CM), bubble labels with CM % and growth, prior-year → actual trails on by default (hollow dot → arrow), hover detail on every bubble, and a **level switcher** Region → Region × sales motion (12 bubbles) → Region × service line (16 bubbles), coloured by parent region with a legend; axes re-fit per level. The mix heatmap (region × service line) moved up under it. The contribution waterfall was removed; page 3 (quarterly CM %, allocation view) was dropped.

Kept from v2: visual-first faces (title · value · deltas · status chip), ⓘ and "How to read" frosted-glass pop-ups (one open at a time, Esc / outside click / × close, focus trapped and returned), source codes only inside pop-ups, no sparklines.

## Largest variances — granularity

Implemented in v3, all from data the model holds today (sources in the panel's ⓘ):

| Option | How it works on the page | Model basis |
|---|---|---|
| Top-N control 8 / 12 / All | Toolbar segment; All starts with every block collapsed so the page still fits; an opened block scrolls inside the panel | TopN visual filter on `LV Abs Δ`, N from a parameter table |
| Block grouping with collapsible subtotals | "By block" (default): shown lines sit under their P&L block in spine order; the block row carries the **full** block subtotal (all lines, not only the shown ones) and "n of m lines"; click a block row to collapse / expand. "By |Δ|" = one flat ranking with the block as a grey suffix | `dim_account.block_code` / `block_name`; block subtotals = `_Amt Row` block rows |
| Slice cut Region · Sales motion · Service line · Segment (Entity: Group view only, disabled here) | Every bar splits into stacked member segments (legend above the table); ▸ on a line lists the members with their own bars. Revenue, gross-to-net, cost of revenue and variable selling are booked at slice grain; opex and below are booked by region only and allocated by NR share to the other slices — those rows are marked "alloc." and italic when the cut is not Region | `_Amt Entity` slice filters on `fact_pl` (direct lines, C-30) and `fact_pl_allocated` (below CM, C-31); Region is a booking dimension for every line |
| Diverging bar per row on one shared scale | Scale = the largest |Δ| across all leaf lines; block, footer and member bars use the same scale | `LV Δ` |
| vs PY Δ column, always visible | Second comparator next to the Budget Δ | `Compare B Amount` per leaf (same pattern as `LV Comparison`) |
| "of which FX" column | Translation portion of each line's Δ; Δ − FX is the business change; block and total rows sum it | `LV FX` = (base − base cc) − (comparison − comparison cc) per leaf (gap analysis P4; second FX-basis path, +0.4–1 s estimated) |
| n.m. rule | Δ % blank-out when |Budget| < 2.0 or |Δ %| > 50 % | display rule in `LV Δ %` |
| Coverage footer | Shown lines (count, Σ|Δ shown| ÷ Σ|Δ all|), all other lines, total P&L Δ at operating profit with Budget / Actual / vs PY / FX | Σ over leaves of `LV Abs Δ` |
| Sign convention | Δ = Actual − Budget on signed values: positive always helps profit (M-10); stated in the ⓘ, not on the face | `LV Δ` |

Options that need data the model does not have (left for later): Nature / Run-rate FY / Owner / Comment columns (`VarianceNature` table); pass-through and controllable splits (`PassThroughMap`, `NonControllable`); a "Prior forecast" comparator (FC2606 exists but is not selectable, Requirements §11); cost-centre or FTE drivers behind opex lines (no headcount data); a cut by Entity outside the Group view (single-entity views have one entity by definition).

## Left off at USER review (still buildable, see `metric-inventory.md`)

- Analysis: headline strip (reported / constant-currency Δ tiles), service-line economics table with pass-through ratio, monthly trend with cumulative variance, full-year outlook bridge.
- Profitability: margin-dispersion, profit-driver and FX tiles; CM % deviation lollipop; contribution variance waterfall by region; quarterly CM % trend; allocation view (pool × NR share); the bubble chart's sub-region levels (Region × sales motion, Region × service line) and its trails toggle (v4).
- Vitals: the generated headline (example only in the How-to pop-up) and the banner.

## Design decisions still standing (v1 → v3)

1. **Vitals: 3 heroes + 2 secondary + 5 drivers (10 metrics, spec §2), not 12 equal tiles.** Driver cards swap content by company like today's slots 4–5 and 9–12 (L-10). Removed tiles (organic growth, subscription GM %, take rate, Rule of 40) and the sub-metrics live in the ⓘ pop-ups; Contribution margin % moves to Profitability. All 24 existing `KPI *` item measures stay reachable.
2. **Card anatomy:** value, Δ vs Budget and Δ vs Prior year ($ and %, pp for ratios), "on plan" for a zero variance, status chip; colour only on a breach (spec KPI §6 thresholds as a parameter table). No sparklines, no bars.
3. **Bridges:** CC subtotal bar before FX; profit bridge from existing lines with a VSC step and D&A / adjusting items as levels so it reconciles; no SBC step (no SBC in the data).
4. **Profitability table in the model's booking reality:** opex is booked at entity × region (C-31), so Adj. EBITDA by region is measured, not allocated; allocated columns exist only for Channel / Line / Segment breakdowns and stay collapsed and badged there. Constant currency by default when comparing to Budget / PY.
5. **Entity rule:** the specs are Commerce Cloud-centric; the layout is the same for every company and only the driver row, pop-up sub-metrics and slice members swap (inventory §0 and §1).

## Status counts (from `metric-inventory.md`)

| View | exists | buildable now | later: needs data | dropped |
|---|---:|---:|---:|---:|
| Vitals | 22 | 8 | 1 | 3 |
| Analysis | 14 | 18 | 7 | 0 |
| Profitability | 13 | 17 | 5 | 0 |

(v3 adds the variances granularity rows — Top-N, block grouping, slice cut, FX column — as buildable now; "left off (v3)" rows keep their status.)

## Open decisions for the USER (each with a default)

| # | Decision | Default |
|---|---|---|
| 1 | **Sparklines / bars on KPI cards.** Spec (10-23) wanted a sparkline; kpi-card-v2 (10-22) wanted diverging bars; v2/v3 show neither. | Neither; amend kpi-card-v2 / ADR-0007 §3a and the spec's §4 sparkline rule. `KPI Trend` stays dropped. |
| 2 | **Hero set.** Net revenue, Adj. EBITDA and a third hero. | Operating profit (IFRS 18 required subtotal, the one tile that breaches on the quoted data). |
| 3 | **One-window rule (ADR-0004).** Two sub-pages inside Analysis and Profitability. | Accept the in-view pager as the ADR-0004 mechanism (Track B: bookmarks). |
| 4 | **Bridge axis in Track B.** Native waterfall starts at zero; the design truncates. | Keep the native waterfall for totals and add a small "net change" panel in Track B; A / C truncate. |
| 5 | **Variances table cost.** Budget / Actual / vs PY / FX columns, block subtotals and the slice cut add evaluations (the current table dropped base / comparison columns for query time). | Build; measure before merging (N-01); the FX column is the one to drop first if the budget is missed. |
| 6 | **Pass-through without a table.** The only pass-through pair in the data is Payments → `COR_S2`. | Do not hard-code; Underlying / Controllable Δ wait for a `PassThroughMap` table. |
| 7 | **Profitability FX default.** Spec: constant currency when comparing to Budget / PY; report default is actual rates. | **Decided 2026-10-27 (PV-02 / PC-03, parity round): always constant currency; the Display flyout does not change it; breakdown Region only (PV-19).** See `build-brief.md` §7 Decisions log. |
| 8 | **Allocated columns.** Show NR-share-allocated EBITDA / OP for Channel / Line / Segment? | Yes, collapsed and badged; never in a headline column. |
| 9 | **Rule of 40 PY comparison.** Cannot be built for the first data year (no FY2023). | Value in the Adj. EBITDA pop-up, no PY comparison. |
| 10 | **Prior-year trails on the bubble chart.** Need two earlier years; blank for the FY2025 view in the real model. | Keep trails drawn (no toggle, v4); they appear from FY2026 windows; the ⓘ says so. |
| 11 | **Concentration visual.** Stacked share bars (chosen) vs a treemap of contribution $ coloured by CM %. | Stacked bars (reads dilution directly); treemap as a later option for the Channel / Line breakdowns with many members. |
| 12 | **Sub-metrics off the faces.** Margin, organic growth, take rate, GMV per merchant, net new ARR live in the ⓘ pop-ups. | Keep faces minimal. |

## Once approved

All three tracks implement **the same layout, metric list, paging and design**: Track A (Rayfin app, fin), Track B (Power BI PBIP, bip — model measures first, then PBIR with bookmarks for the sub-pages, pop-ups and the level / cut switches), Track C (JS report, spec note via `.sync/` for the vosk.dev agent). The inventory's "buildable now" rows become bip's measure list (new `dim_kpi` rows, a `param_kpi_threshold` table, `dim_profit_step`, the CC-subtotal bridge step, `LV FX`, a TopN parameter, slice-cut evaluation of `LV Δ`, sub-region growth / CM % measures); parity rules (`docs/design/parity-rules.md`) and the spec §10 tests gate each track. Changes to ADR-0007 §3a (kpi-card-v2), ADR-0004 (one window → in-view pager) and the Requirements §5 tile table are ADR-worthy and need the USER's confirmation before any build.

## Verification done (v4, 2026-10-27, headless Chromium via Playwright)

- Rename: 0 occurrences of "Key figures" left in the page, README and inventory (except the "formerly" notes); the pager stays hidden on Vitals.
- Profitability page 2: two panels side by side, 659 × 685 px each, same top edge; bubble chart renders 4 bubbles, 4 trails, 0 controls; heatmap 16 cells; no overflow.
- Everything below re-run unchanged on v4 (all pages fit, no console errors, `node --check` clean, variances controls and pop-ups pass).

## Verification done (v3, 2026-10-27, headless Chromium via Playwright)

- Every view and sub-page rendered at 1440 × 810 in its default state: content overflow 0 px, no element overflowing its panel, no console or page errors; the extracted script passes `node --check`.
- Pager: "n / 2" with ‹ › on Analysis and Profitability, hidden on Vitals; ← → keys page back to 1 / 2.
- Variances table: Top 8 / 12 / All (All: 10 collapsed block rows + footer; one block opened), By block / By |Δ|, cut by Region (8 lines × 4 member segments, ▸ shows 4 member rows), cut by Service line (allocated rows tagged), all without page scroll; Top 12 and an expanded member list fit after the v3 row tightening (re-check below).
- Bubble chart: 4 → 12 → 16 bubbles across the three levels, trails on (16 arrows) / off (0), legend at sub-region levels; heatmap fits beneath on the same page.
- Pop-ups on every view: ⓘ opens with focus inside, Esc closes; How to read opens, click outside closes. `.spark` elements: 0.
- Not verified: appearance without IBM Plex installed (falls back to Segoe UI); the `@supports` solid fallback in a browser without backdrop-filter; hover tooltips on bubbles are native `<title>` elements (not exercised headless); the numbers are illustrative — leaf lines were built to sum exactly to the quoted NR 667.4 / 658.2 and OP 48.6 / 50.2.

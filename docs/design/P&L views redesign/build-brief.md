DRAFT — projection state (build brief for the three tracks; nothing implemented yet)

# Build brief — P&L views redesign v4 (Vitals · Analysis · Profitability)

> 2026-10-27 · For fin (Track A, Rayfin), bip (Track B, Power BI) and the vosk.dev agent (Track C, JS, via `.sync/`). Reference implementation: `docs/design/P&L views redesign/pnl-views-redesign.html` (v4). Metric audit trail: `metric-inventory.md`. Presentation rule: **ADR-0012** (visual first, minimum text). Layout rule: ADR-0004 (one 1440 × 810 window) with an in-view pager. Only metrics with status **exists** or **buildable now** are listed; "later: needs data" items stay out of the build.
> Vitals = the former Key figures view; spec IDs K-01 … K-23 are unchanged.

## 0. Shared

| Item | Specification | Source / basis |
|---|---|---|
| Window | 1440 × 810, rail 64 px, white header, content on Ground; nothing scrolls | ADR-0004, `design-requirements.md` §5 |
| Header status line | `<Company> - Management reporting - Closed through <month> - Refreshed <timestamp>`; small grey, bold company. **No period sentence and no currency banner anywhere in the header** (PV-20, Decisions log 2026-10-27): period · currency · as-of appear only as the small grey tokens of this status line as both tracks already render them; the full selection stays in the applied-filters pop-up | `Hdr Status` (parity rules 6, 13); period sentence only in the applied-filters pop-up (`Period Summary`, rule 7) |
| View tabs | P&L statement · **Vitals** · Analysis · Profitability (icons as today; selected = 3 px `acc` underline) | `pbi-report-layout.md` view map; Track B bookmarks `bm_view_*` |
| Pager | ‹ › buttons + "n / 2" next to the tabs, shown only on Analysis and Profitability; ← → keys page (A, C); Track B: two bookmarks per view + the counter as a text button | ADR-0004 mechanism (README decision 3) |
| "How to read" | One button per view in the header → glass window (≈ 780 px): reading guide, status legend, pager map, what is left off and why, illustrative-values note, source list | copy source = **`docs/ADD/features/info-popovers.md`** (PC-01, both tracks read it; parity rule 16). The HTML `HOWTO` object is the design draft only |
| ⓘ pop-ups | One per card / panel → glass pop-up (≈ 420 px): explanation, formula, sub-metrics, source code in grey Condensed; on P&L cards the ⓘ sits top-right (PV-16, accepted) | copy source = **`docs/ADD/features/info-popovers.md`**; the HTML `INFO` object is the design draft only |
| Status chips (Vitals) | Compare with **Budget only**, whatever Compare A is set to (PV-01); prior-year row text only | `_KPI Budget Value` (Compare A slot forced to Budget), `KPI Status` |
| Separators | " - " between items in header, status and pop-up copy (rule 6); "; " between clauses inside formulas (PV-14) | `info-popovers.md` conventions |
| Glass style | rgba white ≈ 0.74, backdrop blur 18 px, 1 px light border, 16 px radius, `@supports not (backdrop-filter)` → solid white; one open at a time; Esc / outside click / × close; focus into the pop-up and back to the opener; Tab trapped. Track B: solid panel, same border / radius (accepted difference) | ADR-0012 §2.5 |
| Status colouring | Chip / dot vs **Budget only**: grey on track (±1 % amounts, ±0.3 pp ratios), amber watch (to 3 % / 1 pp), red off track beyond, green when ahead; "lower is better" inverted on Opex %; prior-year Δ text only | spec KPI §6 → new table `param_kpi_threshold` (4 values) + one status measure |
| Numbers | Tabular, minus U+2212, `+` on deltas, "on plan" for a zero Δ, pp for ratio Δ, n.m. rule where stated | L-12, N-06, K-20 |
| Comparator | Compare A, else Compare B, else Prior year (Budget on the page) | parity rule 1 (`Bridge Comparison Amount`) |
| Company swap | Same layout for every company; only card content / slice members swap (L-10) | inventory §0–§1 mapping |

## 1. Vitals (one page, no pager)

Layout: eyebrow "Results" → 3 hero cards + a column of 2 secondary cards; eyebrow "Drivers & health" → 5 driver cards (Subtle fill). Card face = title · ⓘ · status chip · value · "vs Budget" row ($ and %, or pp) · "vs Prior year" row. No sparklines, no bars, no sub-lines on the face (sub-metrics go to the ⓘ).

| Card | Value | Δ rows | Measures (status) | ⓘ sub-metrics |
|---|---|---|---|---|
| Net revenue (hero) | `KPI Value` K-01 | `KPI Δ A` / `KPI Δ B` + $ Δ (new, trivial) | exists | `KPI Organic Growth`, `KPI Reported Growth` |
| Adjusted EBITDA (hero) | K-07 | same | exists | `KPI Adj EBITDA Margin`, `KPI Rule of 40` (no PY comparison) |
| Operating profit (hero) | K-08 | same | exists | `KPI Operating Margin`, `Net Profit`, `KPI Net Margin`, D&A / ADJ levels (`PL Base` rows) |
| Gross margin % (secondary) | `KPI Gross Margin %` K-03 | pp | exists | `KPI Subscription GM %`, Payments GM % (same pattern on PAY — buildable now) |
| Opex % revenue (secondary, lower is better) | −(SM + RD + GA) ÷ NR | pp; "on plan" | **buildable now** (`PL % NR` rows) | S&M / R&D / G&A % NR, opex $ Δ |
| GMV processed (driver; P: Units sold · Group: CP operating margin) | `KPI GMV` K-09 S | $ and % | exists | `KPI Payments Take Rate` (bp) |
| Active merchants (driver; P: NR per unit · Group: CC operating margin) | `KPI Active Merchants` K-10 S | # and % | exists | GMV ÷ merchants (buildable now) |
| ARR (run-rate) (driver; P: Gross-to-net % · Group: Services share) | `KPI ARR` K-04 S | $ and % | exists | net new ARR = ARR − ARR as Compare B (buildable now) |
| Revenue mix (driver, neutral; P: A&P % NR · Group: IC eliminated) | card = "Sub % / Pay %" (PV-04) | one row "Sub / Pay vs PY" in pp, no chip | **buildable now** (`Prof NR Share` by `dim_line`) | $ and YoY per stream |
| FY outlook (driver, every company) | `FY LE Amount` on NR | vs FY Budget $ and %; EBITDA row | exists (`FY Budget Amount`, `PL Δ LE vs Budget`) | attainment % (buildable now) |

Model additions for Vitals: `param_kpi_threshold`, status measure, Opex % NR, Payments GM %, GMV per merchant, net new ARR, revenue mix shares, attainment %; `dim_kpi` rows for the new codes (`better_when` = Lower for Opex %, Neutral for mix). Track A reads the new codes through `buildKpiMetaQuery` / `kpiAliases()`.

## 2. Analysis (2 pages)

**Page 1 — two bridges, side by side, full height.**

| Panel | Steps / content | Measures (status) |
|---|---|---|
| Net revenue bridge | Budget NR → service-line steps at CC (P: Volume, Price / mix; Group: entities, eliminations) → **Constant-currency NR** subtotal (new `dim_bridge_step` row) → FX → Actual NR; step labels $ and % of the stream's budget; axis truncated (A, C; B: native zero axis + "net change" panel, README decision 4) | `Bridge Value`, `Bridge Comparison NR`, `_NR CC Base`, `Bridge FX` (exist); CC subtotal branch in `_Bridge Value` (buildable now) |
| Profit bridge | Budget Adj. EBITDA → revenue volume (ΔNRcc × budget GM %) → GM rate → GM mix (GP by `dim_line`) → VSC Δ → S&M Δ → R&D Δ → G&A Δ → Other operating Δ → FX on EBITDA → Actual Adj. EBITDA (subtotal) → D&A (level) → Adjusting items (level) → Operating profit; level bars carry "vs bud" Δ labels; end toggle EBITDA / OP / Net profit optional | `PL Δ A` rows SM RD GA OOI DA ADJ, `PL Base` rows DA ADJ (exist); rate / mix / volume effects, FX on EBITDA via the CC branch of `_Amt Raw`, new `dim_profit_step` (buildable now; measure the second FX path, ADR-0008 §5) |

**Page 2 — Largest variances vs Budget, full page.**

| Element | Behaviour | Measures / basis (status) |
|---|---|---|
| Rows | Leaf lines down to operating profit; **lines with no data in either version are hidden** (PV-23: S FY2025 shows 32 of 35, P 37 of 38); columns Line · Comparison · Actual · diverging bar · Δ · Δ % · Δ vs Compare B · of which FX. The **second comparator column follows Compare B** ("vs PY" / "vs Budget" / "vs LE") and is **dropped when Compare B = None** (PV-05; Track B keeps the empty column, rule 17) | `LV Base`, `LV Comparison`, `LV Δ`, `LV Δ %`, `LV Abs Δ` (exist); Compare B column = `Compare B Amount` per leaf, FX = `LV FX` (buildable now, gap analysis P4) |
| Top-N | Toolbar segment Top 8 / 12 / All; All starts with blocks collapsed | TopN visual filter on `LV Abs Δ`, N from a parameter table (buildable now) |
| By block / By |Δ| | Block mode: P&L-order block rows carrying the **full** block subtotal and "n of m lines", click to collapse; flat mode: ranking with the block as grey suffix | `dim_account.block_code` / `block_name`; block subtotal = `_Amt Row` block rows (exist) |
| Slice cut | Total · Region · Sales motion / Channel · Service line / Category · Segment (Entity: Group view only); bars become stacked member segments with a legend; ▸ on a line lists members; opex-and-below rows tagged "alloc." unless cut by Region | `_Amt Entity` slice filters on `fact_pl` (direct lines, C-30) and `fact_pl_allocated` (C-31); members from `dim_region` / `dim_channel` / `dim_line` / `dim_segment` filtered by `Slice Member In View` (exist) |
| Bars | Diverging, one shared scale = max |Δ| of all leaves; block, member and footer bars on the same scale | `LV Δ` |
| n.m. | Δ % reads n.m. when |Comparison| < 2.0 or |Δ %| > 50 %, **only on lines that have data** (hidden lines never show n.m.; PV-23) | display rule in `LV Δ %` (buildable now) |
| Footer | Shown lines (**count = lines shown after hiding**, PV-12; coverage Σ|Δ shown| ÷ Σ|Δ all|), All other lines, Total P&L Δ at operating profit with Comparison / Actual / Compare B / FX | `LV Leaf Count` on lines with data, Σ over leaves (buildable now) |
| Sign convention | Δ = Actual − Budget on signed values, positive always helps profit; stated in the ⓘ only | M-10 |

Track B note: the cut and grouping are a matrix on `dim_account` with the slice dimension on a field parameter; the stacked member bar is a per-row SVG measure (perf budget N-01: measure before merging, drop the FX column first if missed — README decision 5). Track C: the view is new for Track C (skeleton has the statement only) — spec note in `.sync/`.

## 3. Profitability (2 pages; **always constant currency** and **Region only** — PC-03, Decisions log 2026-10-27; supersedes README decision 7 and the earlier breakdown list)

**Page 1 — table (left, ~2/3) + concentration bars (right).**

| Panel | Content | Measures (status) |
|---|---|---|
| Profitability by Region (8 columns) | Region · Net revenue · Δ % · GM % · CM % · CM Δ pp (**only status dot**) · Contribution $ · Adj. EBITDA $; total row; rows sorted by NR; **breakdown = Region only** (PV-19: no Channel / Line / Segment breakdown, the `prof_breakdown` slicer is removed); every figure at **constant currency**, stated in the subtitle "Constant currency (FY… budget rates) - … - vs …" (PV-02; the Display flyout does not change it); the Δ % header is generic, the panel title names the comparison (PV-06) | `Prof Net Revenue`, `Prof NR Δ %`, `Prof GM %`, `Prof CM %`, `Prof CM Δ pp`, `Prof Contribution`, `Prof Adj EBITDA` wrapped in TREATAS CC (exist in Track B since the parity round). Adj. EBITDA is booked by region (C-31), so nothing on this page is allocated |
| Concentration — share by profit level | Three 100 % stacked bars (Net revenue · Contribution · Adj. EBITDA) by region at constant currency, segment labels, 2 × 2 legend with drift vs revenue share (pp) | `Conc Share` at CC (exists in Track B since the parity round; `Prof NR Share` pattern) |

**Page 2 — growth × margin (left half) + mix heatmap (right half), both full height.**

| Panel | Content | Measures (status) |
|---|---|---|
| Growth × margin by region | 4 bubbles (x = NR growth YoY at CC, y = CM %, size = NR), labels "name / CM % · growth", quadrant labels inside the plot, company reference lines with values, prior-year → actual trail (hollow dot → arrow), native hover detail; **no controls** (Region only, v4) | `KPI Organic Growth` per slice (K-22), `KPI CM %` per slice and total, `Prof Net Revenue` (exist); PY point = `Compare B Amount` based growth / CM % (buildable now; blank where the window's prior year has no prior year, C-04 — FY2025 view) |
| Mix — region × service line | 4 × 4 matrix: cell = NR at CC + share of the region, **colour = the column's GM %** (the service line's GM % across all regions, at CC; PV-03 — Track C ramp accT → acc, Track B 4 fixed bins, accepted), row and column totals, hover detail; the ⓘ says "of the column" | `_Heat Cell Raw`, `_Heat Colour GM` = `KPI Gross Margin %` with REMOVEFILTERS ( dim_region ) at CC (exist in Track B since the parity round) |

## 4. Controls summary

| Control | Where | Values | Default |
|---|---|---|---|
| View tabs | header | P&L statement · Vitals · Analysis · Profitability | Vitals opens on the showcase; statement stays the report default (ADR-0004) — USER to confirm |
| Pager | header, Analysis / Profitability | 1 / 2 · 2 / 2 | 1 |
| Variances Top-N | Analysis p2 toolbar | 8 · 12 · All | 8 |
| Variances mode | Analysis p2 toolbar | By block · By |Δ| | By block |
| Variances cut | Analysis p2 toolbar | Total · Region · Sales motion · Service line · Segment · Entity (Group only) | Total |
| Block collapse / member expand | table rows | click | expanded / collapsed |
| FX basis on Profitability | none — **always constant currency** (PV-02 / PC-03); the Display flyout does not change the view; the subtitle states it | — | CC, fixed |
| Breakdown | none — **Region only** (PV-19 / PC-03); no breakdown slicer on the view | — | Region, fixed |
| ⓘ / How to read | every card, panel, header | open / close | closed |

## 5. Parity rules that apply (all three tracks)

From **ADR-0012**: card face = title · value · Δ rows · status chip; no text bars / banners / footers; no sparklines; one ⓘ per card and panel, one "How to read" per view; glass pop-ups with fallback (B: solid panel); card size follows importance; review checklist = visible words per view, ⓘ on every card, pop-ups verified.
From `docs/design/parity-rules.md`: 1 (comparison = Compare A, else B, else PY, also for Profitability "vs …"), 4 (Profitability breakdown = Region; since PV-19 Region only, no breakdown control), 6 (" - " separators in header and pop-ups), 7 (period sentence from `Period Summary`), 13 (subtitles / captions built from the selection — here the header status line and pop-up titles), 15 (status by colour **and** sign; chips carry a word), 16 (pop-up copy verbatim from the shared file once moved), 17 (Compare = None drops the Δ row in A / C; B keeps "none").
Gate: hunter's parity check rows for every selection in `js-report/lib/test-utils/parity/` (`parity_selections.csv` for the P&L, `parity_selections_mirelo.csv` for Mirelo, run by `parity.test.ts`; Track B runs the same rows as DAX, see `docs/ADD/features/parity-check-2026-10-27.md`) must pass in every track that has the view; spec §10 T-05 (bridge reconciles), T-06 (control totals) and the new reconciliations (profit bridge Σ steps, variances footer total = OP Δ, concentration shares sum to 100 %) are the acceptance tests.

## 6. Order of work

1. bip: model measures and tables listed above (thresholds, Vitals items, CC subtotal step, profit-bridge steps, `LV FX`, TopN parameter, CM Δ pp, shares), dictionary in lockstep, tests in `control-totals.dax`; ginee republishes.
2. bip: PBIR — Vitals cards, Analysis p1/p2 with bookmarks for the pager, variances matrix + SVG bars, Profitability p1/p2; pop-ups as bookmark groups with the shared copy.
3. fin: Track A views on the same measures / codes; pager, glass pop-ups, keyboard handling native.
4. vosk.dev agent: `.sync/` note with the data contract additions (new KPI codes, variances leaf set, slice cut members); Track C builds when its views exist.
5. hunter: parity rows + reconciliation tests before any view is marked implemented.

## 7. Decisions log

Dated amendments to this contract. Sections above were edited in place only where they contradicted a decision, each edit citing the decision id; the log is the history. Source of record: `docs/ADD/features/parity-check-2026-10-27.md` §6 (B-vs-C parity round).

| Date | Id | Decision | Where in this brief |
|---|---|---|---|
| 2026-10-27 | PV-20 | The header carries **no** period sentence and no currency banner; period · currency · as-of sit only as small grey tokens on the header status line; both tracks already do this | §0 header status line |
| 2026-10-27 | PV-02 / PC-03 | Profitability is **always constant currency**; the Display flyout does not change it; the subtitle states it ("Constant currency (FY… budget rates) - … - vs …") | §3 heading and table, §4 FX basis |
| 2026-10-27 | PV-19 / PC-03 | Profitability breakdown is **Region only**; the Channel / Line / Segment breakdown and the `prof_breakdown` slicer are removed | §3 heading and table, §4 breakdown, §5 rule 4 |
| 2026-10-27 | PV-01 | Vitals status chips compare with **Budget only**, whatever Compare A is set to | §0 status chips |
| 2026-10-27 | PV-03 | Heatmap colour = the **column's GM %** (the service line across regions, CC); Track B 4 bins vs Track C ramp accepted | §3 page 2 |
| 2026-10-27 | PV-04 | Revenue mix card = "Sub % / Pay %", one "Sub / Pay vs PY" row in pp, no chip | §1 table |
| 2026-10-27 | PV-05 | Variances second comparator column follows **Compare B** ("vs PY" / "vs Budget" / "vs LE") and is dropped on None (Track B keeps the empty column, rule 17) | §2 page 2 rows |
| 2026-10-27 | PV-23 / PV-12 | Leaf lines with no data in either version are **hidden**; n.m. only on lines with data; the footer counts the lines **shown** after hiding (S FY2025 32 / 32, P 37 / 37) | §2 page 2 rows, n.m., footer |
| 2026-10-27 | PV-16 | ⓘ top-right on P&L cards (accepted) | §0 ⓘ pop-ups |
| 2026-10-27 | PV-14 / rule 6 | Separators: " - " between items; "; " between clauses inside formulas | §0 separators |
| 2026-10-27 | PC-01 | Pop-up and How-to-read copy source = `docs/ADD/features/info-popovers.md` (both tracks read it); the HTML `INFO` / `HOWTO` objects are the design draft | §0 How to read, ⓘ |
| 2026-10-27 | PC-02 | Parity harness = `js-report/lib/test-utils/parity/` | §5 gate |

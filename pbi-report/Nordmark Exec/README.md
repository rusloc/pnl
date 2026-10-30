# Nordmark Exec — Power BI flavour (PBIP)

> **DRAFT.** PBI flavour of ADR-0013 (Accepted 2026-10-28) incl. the period model of ADR-0013 (k) (2026-10-29, three rounds). Local
> PBIP only: nothing is published, no Fabric item exists. Built by bip on 2026-10-28 against prototype v5
> (`docs/design/executive dashboard (reseller)/prototype.html`), `docs/Requirements-exec.md` and the dataset contract
> `data/nordmark_retail_dummy_data/README.md` (its open-point resolutions win); brought to parity with `js-exec/` on 2026-10-30
> (`docs/ADD/features/exec-period-model.md`; where it and `js-exec/` differ, the JS code was followed, see Deviations). All data is
> generated and fictional (Nordmark Retail is an invented reseller). Both flavours reconcile to the same control totals and share the
> copy of `js-exec/lib/engine/copy.ts`.

## What is here

| Path | What |
|---|---|
| `Nordmark Exec.pbip` | Open this in Power BI Desktop |
| `Nordmark Exec.SemanticModel/` | TMDL, Import, 17 Parquet tables + `meta_dataset` (manifest.json) + `dim_item` (calculated, the period-model items) + 6 picker tables + `_measures` (388 measures), 26 relationships, compatibility level 1702 |
| `Nordmark Exec.Report/` | PBIR: page `exec_landing` (1440 x 810, FitToPage) + hidden tooltip pages `tt_info`, `tt_drill`, `tt_rule`, `tt_dot`; 4 bookmarks; custom theme and 3 SVG resources |
| `tests/control-totals.dax` | DAX tests against `data/nordmark_retail_dummy_data/checks/control_totals_eur.csv` (172 blocks, 34,118 rows) |
| `docs/model/nordmark-measure-dictionary.md` (repo) | Every measure: definition, spec IDs, folder, format, DAX |

## How to open

1. Close any other Power BI Desktop window that has this PBIP open.
2. Open `Nordmark Exec.pbip`. The repo holds no data cache, so the tables are empty until you refresh.
3. **DataFolder.** The parameter holds an absolute path: `C:\__PBI\PNL\data\nordmark_retail_dummy_data\parquet`. If the repo lives elsewhere, change it first:
   Transform data > Manage parameters > **DataFolder** = the full path of `data\nordmark_retail_dummy_data\parquet` (the folder also
   holds `manifest.json`, which the model reads for the as-of week and the refresh stamp). Nothing else is machine-specific (E-80, ET-18).
4. Home > Refresh (about 8 s on this machine, 0.88 M rows). `dim_item`, `param_granularity` and the other picker tables are calculated
   and need no refresh.

## Data source

- Every table reads `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` with explicit column types (the Trucks / Mirelo
  pattern). A file source does not fold. Derived on load: `dim_kpi[domain_order]`, `dim_kpi[owner_cadence]` (More KPIs drawer).
- `meta_dataset` = one row from `manifest.json`: `current_week_key` (the as-of week, FY2026-W43), `refreshed` (the header stamp, E-05).
- `dim_date` is not loaded: no fact joins it and every label comes from `dim_week`. The lakehouse switch of ADR-0013 (b) "Later" only
  replaces the partition sources; the Power Query and partitions belong to ginee from here on.

## Model in one paragraph

Star schema, single-direction relationships: every fact joins `dim_week` on `week_key`, site facts join `dim_store`, category facts
`dim_category`, supplier facts `dim_supplier`, OpEx `dim_cost_type`. Base measures evaluate over the `dim_week` rows in context (the
window) and the region in `param_region` (leaf sums filter `dim_store[scope_code]`; All = no filter, so DCs, wholesale and central costs
appear only in All, as the data README says). **Period model (ADR-0013 (k)):** `dim_item` is a calculated table from `dim_week` with one
row per item — 95 weeks, 22 months (4-5-4 retail periods), 8 quarters, 2 years at the shipped as-of week; partial items
(`FY2026-Q4`, `FY2026`) are "to date" — and every window as `sort_index` bounds: the item (weeks within actuals), LY (`ly_week_key`,
blank in FY2025), the previous item (`lw_week_key` at Week; else the item before, cut to the picked item's weeks when it is partial) and
the EBITDA Previous window at Week (the previous month's first k weeks; none for week 5 of a 5-week month). `param_granularity`
(Week / Month / Quarter / Year) filters `dim_item` (one relationship, single direction). `[_Item Key]` reads the picker and every card
measure reads its window from `dim_item`. Status, counts and the dot are window-context measures with the thresholds of
`param_status_rule`; status is N/A where the value or its basis is blank (FY2025 has no budget). Details:
`docs/model/nordmark-measure-dictionary.md`.

## The page (v5 map)

| Zone | Power BI |
|---|---|
| Side bar 56 px | Static SVG (mark, 3 icons) + transparent buttons: Filters, How to read, More KPIs (bookmarks `bm_filters`, `bm_how`, `bm_more`; one layer at a time, `bm_close` from × and the scrim). Badge = image measure (active attribute picks) |
| Header | One SVG image measure: brand, the picked item's period line (`Week 43 · 19–25 Oct 2026`, `Quarter 4 to date · 28 Sep–25 Oct 2026`, `Month 10 FY2025 · …`, bold up to " to date"), comparator line (`vs Budget`, `vs Last year (same retail week / weeks)`, `vs Previous week / month / quarter`), region, refresh stamp |
| Status line | SVG: dot (literal v5 rule over the rated cards, grey with "no rated card" when none, static), three count pills, "n of 12 metrics · picks". Hover target on the dot → `tt_dot` |
| Cards | 12 image visuals at the v5 rectangles (3 hero 437 x 236, 3 medium 437 x 176, 6 small 213 x 168), one `Card SVG <KPI>` measure each: wash, title + sub-title (`week 43, all channels` / `month 10` / `quarter 4 to date`; EBITDA `month 10 to date` at Week; LFL `vs LY week / month / quarter / year`; + prov.), chip (– N/A grey where the card has no status), value, Δ vs the comparator in the status colour (`vs prev. wk / mth / qtr` for Previous; any `n/a vs …` in muted ink #5F6878), bars of the picked type (13 weeks / 12 months / 8 quarters / 2 years ending at the item, picked one in the status colour, dotted target = the item's basis, blank before the data starts), ⓘ and binoculars |
| Layer scrim | One shared `layer_scrim` (ink at 78 % transparency, full page incl. the side bar, below every layer group) shown by `bm_filters` / `bm_how` / `bm_more`, hidden by `bm_close`; a click on it runs `bm_close` |
| Hover targets per card | ⓘ → `tt_info` (548 x 701): value 48 px, the status basis **big and bold** right under it (dotted 20 px swatch, `Budget` / `Target` / `Plan` 16 px / 600 #374151, value 32 px / 700 ink, unit 16 px / 600; any comparator), Δ (EBITDA at Week vs Previous names the weeks: `vs P9 weeks 1–4`), labelled bars, 3 stats by type, What it is / Why it matters / Formula / Worked example / Status rule (no owner note), tags Group · Lever · Owner closed by the refresh / provisional note, no footer row; binoculars → `tt_drill`; chip → `tt_rule` |
| Filters menu | Solid panel with button slicers. **Period:** type `menu_param_granularity` (Week · Month · Quarter · Year; single, force selection) → FY `menu_item_fy` (FY2025 · FY2026) → item: `menu_item_wide` (Quarter / Year chips incl. `Q4 · to date`, `FY2026 · to date`) and `menu_item` (Week / Month chips W1 … W52 / P1 … P12, 8 x 7 grid), then `menu_showing` = "Showing" + the header period line. Comparator (Budget · Last year · Previous; the Previous row is hidden at Year by a visual filter on `[_Comparator Row Visible]`), Region / format, then Group, Lever, Owner (multi select; Horizon and Statement removed, `dim_kpi.horizon` / `statement` stay in the data). Reset = *Clear all slicers*: type back to Week (force selection), FY and item empty → Week 43 FY2026 · Budget · All |
| How to read · More KPIs | SVG panels (How to read is a measure: eyebrow `Nordmark · <item title>`, comparator name, the bars bullet names the four lengths); More KPIs = a table of the 20 bench KPIs from `dim_kpi` |

## Tests

`tests/control-totals.dax` holds 172 blocks; run each `// ==== BLOCK` as its own query (one ADOMD batch of all blocks runs out of
memory; one large UNION of card or SVG measures also explodes the plan (13 GB), so T-N2, T-N3, T-N4 and T-N7 are one scenario per block). Every row returns `_pass`.
On 2026-10-30, scratch copy of the USER-saved PBIP (its data cache, no refresh needed), ADOMD: **34,118 rows, 0 not TRUE** (about 2 h 10 min serially; one T-N3 row re-run after a test-string fix).

| Block | Checks |
|---|---|
| T-N1 (20) | every row of the 87 item keys of the CSV (27,231 rows: W / P / Q / FY keys and the `@k` like-length and EBITDA-Previous keys) through the base layer, per scope; N/A rows (absent in the CSV = blank). The 6 legacy `PTD-` / `YTD-` keys are retired here: their mix rows carried the W43 exit mix, the model now reads window shares (ET-24) |
| T-N2 (100) | card layer through the picker slicers, per scope x {W43, P10, Q4 to date, FY2026 to date, FY2025 P10 / P12 / Q1 / FY2025} x {Budget, Last year, Previous}: value, comparator, Δ, status, mix deviation, counts + dot; EBITDA vs Previous at W39 / W31 / W35 (ET-22 … ET-26, ET-31) |
| T-N3 (30) | texts: the v5 card faces at Reset and in the saved state (ET-02, ET-22); headers, titles and phrases per item; comparator lines and short Δ suffixes per type; Year offers Budget · Last year and reads LY for Previous (ET-23); EBITDA ⓘ `vs P9 weeks 1–4`, W35 `n/a vs prev. mth` muted (ET-31); FY2025 N/A cards and rated counts 4 / 3 (ET-26); picker fallbacks W43 → P10 → Q4 → FY2026 (ET-28); Online N/A |
| T-N4 (16) | bars per type per scope: count 13 / 12 / 8 / 2 and every bar = the item-key value (ET-25) |
| T-N5 | back margin = supplier income (ET-07); NL + BE + Online + Wholesale = All (ET-12); no measure in an error state |
| T-N6 | conceal in place with the three attribute groups (ET-13) |
| T-N7 (3) | ⓘ target line per card under Budget, Last year and Previous; the ⓘ SVG has the 48 / 32 px sizes, Owner tag, no Horizon, Statement, owner note or footer target (ET-30, ET-32) |
| T-N8 | item lists 95 / 22 / 8 / 2, partial `FY2026-Q4` and `FY2026`, `FY2026-P10` complete, no P11 FY2026 (ET-21) |

## Timings (E-84)

One DAX query per visual (header, status line, 12 cards) and the EBITDA ⓘ, after an XMLA ClearCache, on a fresh scratch
instance of this machine (Desktop 2.157.1354.0), ADOMD client time incl. about 0.1 s overhead per query; the picker state is passed as
slicer filters. Desktop sends the visual queries in parallel, so a selection change costs about the slowest visual (ADR-0008 per-view
budget ≈ 3 s query time).

| Selection | Slowest visual (ms) | All visuals, one after another (ms) | ⓘ EBITDA (ms) |
|---|---:|---:|---:|
| Week 43 · Budget · All | 2,500 (EBITDA card) | 11,100 | 9,000 |
| Month 10 · Last year · All | 2,000 (EBITDA card) | 11,800 | 8,900 |
| Quarter 4 to date · Previous · Netherlands | 2,300 (EBITDA card) | 12,400 | 10,700 |
| FY2026 to date · Budget · All | 2,500 (EBITDA card) | 11,300 | 10,100 |

Same method on the pre-period-model model (2026-10-29, restored from `__backup__`): EBITDA card 600–700 ms, ⓘ EBITDA 5,000 ms (the
2026-10-28 README figures, 700 ms slowest / ⓘ 0.4–0.6 s, came from captured visual queries and are not comparable).
The cost is formula-engine work, not scans (warm ≈ cold): the region slicer's filter alone roughly triples every SVG measure (scoped
leaf sums, unchanged design), and the picker filters on `dim_item` / `param_granularity` add about 1 s to a card. Clearing the picker
filters inside the window `CALCULATE`s did not help (tried, reverted). Open: a performance pass on the EBITDA card and the ⓘ measures
(USER decision; the hover pop-ups are the slow part).

## Platform differences and deviations

Platform rows for `docs/design/parity-rules.md` (E-87): solid panels instead of frosted glass; static dot (no pulse ring); FitToPage
instead of the responsive breakpoints; Segoe UI instead of Inter; filters conceal by a faded card face, not CSS.

| # | v5 / js-exec | Power BI | Why |
|---|---|---|---|
| 1 | Frosted glass pop-ups, menu and drawer (E-59) | Solid white panels with the same 1 px border and 16 px radius; a 22 % ink scrim | No backdrop blur in Power BI (ADR-0012 §2.5, accepted platform difference) |
| 2 | Pulse ring on the overall dot | Static dot, same colour and tooltip | No CSS animation (E-26, accepted) |
| 3 | Responsive breakpoints 1200 / 720 px | FitToPage at 1440 x 810 | Accepted (E-61, E-87) |
| 4 | Inter | Segoe UI (inside the SVGs and the native visuals) | Accepted (E-60) |
| 5 | ⓘ, binoculars and chip open on click; focus trap, Esc, pills between explanation and drill path | Hover (and keyboard focus) report-page tooltips `tt_info`, `tt_drill`, `tt_rule`; no pills inside the pop-ups | Tooltips are not interactive; click pop-ups per card would need 24 bookmarked groups |
| 6 | Side bar layers close with Esc; active side-bar button tinted | × and a click on the dark scrim close (bookmark `bm_close`); no active tint | Bookmarks cannot react to keys; one layer at a time is kept |
| 7 | Filter chips: cobalt-tinted selected chip | Native button slicers (pill tiles); the picked chip shows Desktop's default dark style | Selected-state formatting written in PBIR is not applied; the USER's 2026-10-29 saves (21:25, 22:49) carry no chip restyle, so there is nothing to copy yet |
| 8 | Concealed card: opacity 0.08 + greyscale, `inert`, out of the tab order | Same look inside the card SVG; its hover targets return blank (no tooltip) | Visuals cannot be made inert |
| 9 | More KPIs drawer grouped under domain headings | A scrolling table: Domain · KPI · Formula · Owner, catalogue order | Native table; matrix expand states cannot be authored reliably in PBIR |
| 10 | Worked-example and Δ line breaks by browser layout | Static copy wrapped with Segoe UI metrics; worked examples and small-card Δ rows wrapped by character count (52 / 14) | SVG text does not wrap |
| 11 | ⓘ pop-up sized to its content | Fixed tooltip page 548 x 701 (SVG 520 x 683, sized to the tallest card with a 6-line example; white space under shorter cards; no scrolling) | Tooltip page size is fixed |
| 12 | `dim_date` (ADR-0013 (d)) | Not loaded | No fact joins it; every label comes from dim_week |
| 13 | Picker: switching the type selects the item that holds the last pick (W43 → P10 → Q4 → FY2026), and that chip is shown selected; the FY row is hidden at Year | The cards, header and "Showing" line switch the same way (`[_Item Key]` fallback), but no chip of the new type is highlighted until one is clicked; the FY row stays at Year (it then drives the single Year chip) | A slicer cannot select a value on behalf of another slicer |
| 14 | One item row | Two item rows: a wide Quarter / Year row (so `Q4 · to date` fits) and an 8 x 7 Week / Month grid; the row of the other types stays empty | Button-slicer tiles have one fixed size per visual; `autoGrid` gave three huge tiles per row |
| 15 | At Year the comparator menu renders two options and a user on Previous snaps to Last year | The Previous row of the comparator slicer is filtered out at Year; a Previous pick made before switching to Year stays selected underneath but reads Last year (header, Δ) | Slicers cannot be re-selected by a measure |
| 16 | Dot tooltip grey state | Same text (`Overall: grey · no rated card.`); not reachable with the shipped data (OTIF and Weeks of cover are always rated) | Same guard as js-exec |

## Parity notes (for hunter)

- Default open = Reset = Week 43 FY2026 · Budget · All: 7 / 3 / 2, orange dot, v5 card faces (T-N3-01, T-N3-02).
- Picker state is three slicers: `param_granularity[granularity_name]`, `dim_item[fy_label]`, then `dim_item[label]` (Week / Month) or
  `dim_item[label_wide]` (Quarter / Year). In DAX tests set the codes: `TREATAS ( { "Q" }, param_granularity[granularity_code] )`,
  `TREATAS ( { "FY2026" }, dim_item[fy_label] )`, `TREATAS ( { "Q4 · to date" }, dim_item[label_wide] )`; `[_Item Key]` returns the
  item (`FY2026-Q4`).
- Comparator codes stay `BUD` / `LY` / `LW` (`LW` = Previous, label "Previous"); at Year `[_Comparator Code]` returns `LY` for `LW`.
- EBITDA at Week reads month to date (`[EBITDA Flash]`); Previous = the `P-…@k` key; W35 / W9 / W22 / W48 → `n/a vs prev. mth`.
- Non-default week pick for ET-25 parity: any W chip in FY2025 / FY2026 (e.g. `W20`); the bars are the 13 W items ending there.
- Copy: `js-exec/lib/engine/copy.ts` exported at build time; the view.ts sentences (stats, worked examples, How to read, dot tip) are
  mirrored in the generator (`tokens.py`, `measures_svg.py`).

## First-open checklist (USER)

1. Open (the model computes `dim_item` and `param_granularity` on open; no refresh needed with your cache). The page should read
   Week 43 · vs Budget · All, 7 / 3 / 2, orange dot. The 22:49 save had all four Group chips picked (badge 4): kept as saved; Reset
   clears them.
2. Filters › Period: Week → Month → Quarter → Year. The header, sub-titles, bars (13 / 12 / 8 / 2) and the "Showing" line follow
   (W43 → Month 10 → Quarter 4 to date → FY2026 to date). Click a Month / Quarter chip to see it selected (see deviation 13).
   At Year the comparator row offers Budget · Last year only.
3. Pick FY2025 and Month P10: seven cards show the grey "– N/A" chip with a muted `n/a vs budget`, four are rated (Weeks of cover,
   Availability, Sell-through, OTIF); the dot runs over those four.
4. Week 43 + Previous: EBITDA reads `−€0.0m (−0.0%) vs prev. mth`; hover its ⓘ: the Δ line reads `… vs P9 weeks 1–4`. Week 35 +
   Previous: EBITDA `n/a vs prev. mth` in grey.
5. Hover each ⓘ on 2-3 cards: the basis line sits right under the value, big and bold (Net sales "Budget €62.9m"); no "Target …"
   footer; tags Group · Lever · Owner with the refresh or provisional note at the right; the pop-up does not scroll.
6. Reset → Week 43 · Budget · All. Save once in Desktop so it writes its own serialization; after that, edit surgically.

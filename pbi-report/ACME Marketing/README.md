# ACME Marketing — Paid Acquisition Console (Power BI flavour)

> **Draft — ADR-0015 (Proposed), phases 2 and 3 built, redesign round 1 (pass 1) applied.** Built 2026-11-04 by bip on the ADR's bold
> defaults: all five views, the Filters window, tests and the `.sync/` pack; the USER's round-1 review re-laid out four views on the same day
> (passes 1 and 2 applied; pass 2 filled the five slots and rebuilt the vitals). 2026-11-05: one binoculars per vital (single-metric
> dynamics) and the O5 / O6 movers window. All figures are generated and illustrative.

One page, five views, for the paid online acquisition of ACME's SaaS product (web, iOS, Android; six channels, eight networks,
19 campaigns). The data, its rules and the control totals are the contract in `data/acme_marketing_dummy_data/README.md`; the requirement
IDs (A-nn, AT-nn) are in `docs/Requirements-marketing.md`; the spec bundle stays untouched beside this file in `paid-acquisition-dashboard/`.

| Item | Where |
|---|---|
| PBIP | `ACME Marketing.pbip` + `ACME Marketing.SemanticModel` (TMDL, Import) + `ACME Marketing.Report` (PBIR) |
| DAX tests | `tests/control-totals.dax` (29 blocks, 29,387 rows; every `_pass` TRUE on 2026-11-05; every row of `control_totals_usd.csv` is covered; T-K10 / T-K11 = redesign round 1 passes 1 / 2; T-K12 = O5 / O6 at the saved state Custom + Month) |
| Measure dictionary | `docs/model/marketing-measure-dictionary.md` (generated) |
| Theme | `ACME Marketing.Report/StaticResources/RegisteredResources/acme-marketing-theme.json` (+ `acme-wallpaper.png`, `acme-marketing-logo.svg`, `acme-binoculars.svg`) |
| Generator | `tools/` (local only, gitignored like Nordmark's: `gen/` writes model, report, tests and dictionary; `run/` holds the scratch runners and the timing tool) |

## Open it

1. `DataFolder` (Transform data › Manage parameters) defaults to `C:\__PBI\PNL\data\acme_marketing_dummy_data\parquet`. On another
   machine point it at the `parquet` folder of the generated dataset (A-80, AT-19). Nothing else is machine-specific.
2. **Refresh** (5–25 s; 27 Parquet tables + `manifest.json`, 0.26 M rows). The PBIP ships without `cache.abf`: the first open shows
   empty visuals until the refresh finishes.
3. Optional: run the DAX tests (DAX query view, one block at a time, or `tools/run/run-tests.ps1 -Port <port>` against a refreshed copy;
   the full file takes about 10 minutes on the source machine).

### First-open checklist (USER)

- [ ] Refresh succeeds; the vitals read **$188.4k ▲ +32.7 % | 6,980 ▲ +19.4 % | 6.5 % ▼ −0.5 pt | 1.1 d ▼ −0.3 d | $412 ▲ +19.0 % | 1.02× ▼ −0.14**,
      sub-lines LY $142.0k | LY 5,847 | LY 7.0 % | LY 1.4 d | LY $346 | LY 1.16× (A-21 amended 2026-11-04: Δ always vs the same dates last year).
- [ ] Each vital has a binoculars before its label: a click opens **<metric> | dynamics** with that one metric only (daily line, last
      year dashed, the last day labelled; e.g. Spend | dynamics, CAC | dynamics); × closes it; a view tab also closes it. Check all six.
- [ ] The five tabs swap the body under the same vitals.
- [ ] Period pill opens Filters on Period; Filters button opens it on Scope; the rail swaps the six panes; Close, × and a second click on
      the Filters button close it; Reset all clears every slicer (30 d | previous period | all | DDA).
- [ ] A pick in Filters updates the badge, the chips line and the applied-state rail at once (no Apply, platform limit 1).
- [ ] Overview: Anomalies and Top movers each flip with their own **Worst 5 | Top 5** switch, and switching the view tab keeps the pick.
      Default window, Worst 5: anomalies = Google UAC · Android growth −9.1 (Install quality), Meta prospecting · Lookalike 2% −5.9
      (Creative fatigue), YouTube · Product demo −5.7, LinkedIn · Data teams ABM −0.3 (only four campaigns lost paid customers); movers =
      Lookalike 2% −0.41, YouTube −0.18, TikTok −0.09, Google UAC −0.04, Meta Interests −0.03.
- [ ] In the saved state (Custom Jan 1 2025 – Nov 3 2026, Month) Anomalies and Top movers are filled: they compare the window's last
      30 days (the previous period of the whole range has no data), so Worst 5 lists the same four / five campaigns as the 30 d window.
- [ ] Click a channel row in the C1 matrix: the chips line shows `Selected: Paid social`, the cards below and the Campaigns / Journey /
      Cohorts views scope to it, the vitals do not move. Click again to clear.
- [ ] Campaigns: with no click Keywords / placements shows **Meta prospecting · Lookalike 2%** (the worst mover); a click on another
      row re-targets it and scopes Churn / Refund by channel to that campaign's channel.
- [ ] Cohorts: pick Meta prospecting · Lookalike 2% (Filters › Campaigns): its Nov 2025 – Jan 2026 heatmap rows turn green at month 9.
- [ ] Hover every ⓘ (29: 6 vitals + 23 cards): the tooltip page shows title, what, formula, note with the window and model.
- [ ] Granularity Week / Month re-buckets O3; Same period last year / Plan / None change every Δ and no verdict colour.
- [ ] Save once in Desktop (the generated PBIR then becomes Desktop serialization; further edits go surgically).

## The page

`paid_acquisition`, 1440 × 810, FitToPage. Frame: top bar 56 px (brand, five tabs, period pill, Filters button with the active-count
badge, freshness dot + `Synced n h ago`), chips line (text, A-14), vitals ribbon (six glass tiles: Spend | New clients | Conversion into paid | Time to activation | CAC |
ROAS 90 d, each value, Δ vs the same period last year with arrow and direction-aware colour, `LY <value>` sub-line; no target, no verdict
dot, no sparkline, ADR-0012 §2.4; a 16 px binoculars button before each label opens that vital's dynamics), body on a
12-column grid of three rows (y 196 / 394 / 592, 186 px each, 12 px gaps). No page footer since round 1. Glass = white 90 % + 1 px edge + 14 px radius + soft shadow; the
blooms are baked into `acme-wallpaper.png`; Segoe UI / Semibold for Manrope / Inter.

| View | Layout (columns of 12; rows) | Visual |
|---|---|---|
| Overview | row 1: O1 Acquisition funnel (4) \| O2 Guardrails (4) \| O7 Spend and paid customers by channel (4); row 2: O5 Anomalies and alerts (6) \| O6 Top movers by Δ ROAS (6); row 3: O3 Spend vs plan and CAC (12) | O1 SVG: log10 bars + absolute count per stage; O2 SVG; O5 table: # \| campaign \| channel \| paid \| before \| Δ paid \| alert, Worst 5 / Top 5 switch; O6 columns of \|Δ ROAS\| with the signed label, Worst 5 / Top 5 switch; O7 SVG: two aligned bar columns (spend $k, paid customers) per channel in the channel colour; O3 combo: spend + plan (pale) columns, paid CAC line on the right axis, Oct 18 line |
| Channels | left: C1 Channel matrix (6, rows 1–3); right: C2 Web vs app funnel (6, row 1) \| C5 Paid customers by channel, web (6, row 2) \| C6 Paid customers by channel, mobile (6, row 3) | C1 matrix channel › platform with CAC (no CPA column); C2 clustered columns; C5 / C6 channel-coloured columns, platform as a visual filter (WEB / IOS + ANDROID), label `count \| $CAC` from a dynamic format string |
| Campaigns | P1 Campaigns (12, rows 1–2); row 3: P5 Keywords / placements (4) \| P6 Churn by channel (4) \| P7 Refund by channel (4) | P1 / P5 tables; P6 / P7 channel-coloured columns, top 5, absolute counts |
| Journey | J1 Landing and store pages (6) \| J2 Onboarding steps, paid traffic (6) \| J3 Sign-up → activation time (6) \| J4 Activation rate by platform and OS (6); two rows of 287 px (row 3, session recordings, not built: A-04) | J1 table (— for bounce / LCP on store pages); J2 columns with the largest drop in crit; J3 bins with the median bin emphasised; J4 segments against the dashed 40 % target |
| Cohorts | left two thirds: K1 Payback by acquisition month (8, 1.5 rows) over K3 Retention grid, paid cohorts (8, 1.5 rows); right third: K2 LTV:CAC by channel (4, row 1) \| K6 Payback months by channel (4, row 2) \| K7 Cohort size by acquisition month (4, row 3) | K1 heatmap: the 12 acquisition months before the window's end month × months 0–11 since acquisition, cumulative payback %, one hue darker = closer, green = paid back; K2 channel-coloured columns + dashed 3:1; K3 matrix, one hue darker = higher; K6 channel-coloured columns + dashed 12 mo (`Payback Target`); K7 columns of `K5 Customers`, the 12 acquisition months to the window end |

Every card: title, ⓘ (tooltip page `tt_card_info`, copy from `dim_card`), the visual; no question line and no caption since round 1.
One How to read pop-up per view. Text dividers are `|` (round 1); the `·` inside campaign and segment names comes from the dataset.

**Vitals dynamics** (2026-11-05: one metric per pop-up). Each tile carries a binoculars (`vit_v1_dyn_icon` … `vit_v6_dyn_icon` 16 × 16
at tile x + 12, y + 10, the label moved to x 34; transparent button `vit_vN_dyn_btn` 20 × 20 on top) that runs `bm_dyn_v1` … `bm_dyn_v6`.
Each bookmark shows the shared window `grp_dynamics` (880 × 560 over the 32 % scrim, × = `bm_dyn_close`) plus that vital's pane group
`grp_dyn_vN` (title `<metric> | dynamics` + one 846 × 480 line chart) and hides the other five pane groups and the How to read pop-ups:
the Filters-pane pattern (display state only, no data state), so only the one visible chart queries. Every view bookmark hides the window
and the six panes. The chart: the metric by day over the window, or its **last 30 days when the window is longer than 90 days**; the
same day last year dashed; the last day as a marker with its value. Measures `Dyn <metric>`, `Dyn <metric> LY`, `Dyn <metric> Last`
(unchanged). Icon `acme-binoculars.svg` = svg-designer's `docs/design/icons/binoculars.svg` glyph (stroke ink-2) scaled to 11 px in the
ⓘ's 16 px circle (1 px ink-3). The ribbon-level button (`vit_dyn_btn` / `vit_dyn_icon`), `bm_dyn_open` and the six-chart grid are gone;
the tiles take the full row width again (224 px). Daily time to activation falls towards 0 at the window end: recent sign-ups have not
had 30 days.

The five placeholder slots of pass 1 (`ov_slot1`, `ch_slot1/2`, `co_slot1/2`) are filled and removed.

**Filters window** (`grp_filters`, 880 × 560 over a 32 % scrim): left rail of six bookmarks (Period | Scope | Channels | Campaigns |
Audience | Attribution), main area with the group's slicers, right rail = applied state + campaigns / channels / platforms in scope
(instead of a live preview), Reset all (Clear all slicers) + Close. Period: preset tiles, From / To (`param_date`, used by Custom), the
comparison picker under the label **SAME PERIOD LY** (round 1 rename of "Compare with"; still four options: Previous period, Same period
last year, Plan, None; nothing picked = Previous period), granularity. Scope: platform, tier. Channels: channel › network tree.
Campaigns: status tiles + searchable list. Audience: market dropdown. Attribution: model tiles. Saved views were removed in round 1 (rail
item, pane and the five `bm_saved_*` bookmarks).

## Model

27 Parquet tables through `DataFolder` (one partition each, explicit `Table.TransformColumnTypes` from `manifest.json`; derived columns in
M: `dim_date.month_index / month_start`, campaign names for the Filters tree, `campaign_label` / `platform_label` copies for the
cross-filter sources, cohort month indexes) + `meta_dataset` (manifest) + calculated tables: pickers `param_period_preset`,
`param_comparator`, `param_granularity`, `param_date`; slot tables `dim_funnel_stage`, `dim_c2_stage`, `dim_alert_slot`, `dim_offset`
(K1 heatmap columns), `dim_day_n` (K3 columns), `dim_act_bin` (J3 bins with hour edges), the Worst 5 / Top 5 switches `param_o5_rank` /
`param_o6_rank` (round 1); the copy table `dim_card`; `_measures` (469 measures, 327 visible). Facts → `dim_campaign` → outriggers `dim_channel` / `dim_network` / `dim_platform` (single direction, ADR-0015 (c));
`fact_*_month` → `dim_month`; keys hidden. 42 tables, 29 relationships. See the dictionary for every measure.

## Platform limits

The 17 of ADR-0015 (e) apply (Apply semantics, keys, saved views, one theme, fixed canvas, no blur, two stacked charts, log funnel,
ⓘ instead of ⋯, creatives as a table, no shortcuts, no recordings, cross-filter chip as text, no sparklines, anomalies as a table, no URL
state, Segoe UI). Met in this build in addition:

| # | Spec / ADR | Power BI here | Why |
|---|---|---|---|
| 18 | Horizontal bars for O4, O6, C2–C4, P3 | Column charts (O6, C2, P6, P7 since round 1); O1 funnel as an SVG image measure | Horizontal bar charts keep ~30 px per category and scroll in a 110 px plot |
| 19 | Channel colours on paired bars (O4, C3) | O4 drawn as SVG with the channel colour + tint; C3 reported grey / modelled accent | Field-value colours (fx) do not reach a multi-series bar; single-series charts (O6, C4, K2, J2–J4) take them |
| 20 | Oct 18 marker "where CAC stepped" | A fixed story annotation (`Story Step Date`, constant line) | The largest 7-day step of the noisy daily CAC falls on Oct 17; the day is not detectable from the data |
| 21 | Status default Live + Learning | Default applies to the campaign list (P1, Campaigns pane); window totals keep every campaign until a status is picked | The paused retention campaign spends in the previous period; filtering it would break the ALL control totals (+7.0 % spend) |
| 22 | O6 click opens Campaigns scoped to the campaign | A click cross-filters; the reader switches the tab | No navigation from a data point |
| 23 | Saved views store filters and tab | Removed in redesign round 1 (USER, 2026-11-04) | — |
| 24 | P3 ad-set CPA under the selected model | DDA always | `paid_customers_dda` is the only ad-set credit (data README D-4) |
| 25 | Freshness hover per source | Header freshness dot + `Synced n h ago` (oldest hourly source) only; the per-source footer was removed in round 1 | No hover per source on a native visual |
| 26 | J4 by OS version | By platform segment (web desktop / mobile, iOS 18 / 17, Android 14–15 / ≤ 13) | The dataset carries segments, not single OS versions |
| 27 | K1 cohort lines selectable | K1 is a heatmap since round 1: the 12 acquisition months before the window's end month, months 0–11 | — |
| 28 | One value axis per chart (ADR-0015 platform limit 7: two stacked charts, never a secondary axis) | O3 is one combo chart: spend columns on the left axis, paid CAC line on the right axis | **Deviation accepted by the USER** (redesign round 1, 2026-11-04) |
| 29 | O5 lists the alert rules that trip (A-52, A-64, AT-10: five rows in the default window) | O5 lists campaigns by the change in paid customers vs the comparison window (Worst 5 / Top 5) with the campaign alert that trips on each; channel / ALL / source alerts show in C1 flags, Guardrails and the freshness dot | USER: absolute numbers, top 5 and worst 5 with a switch (round 1). The Alert measures and their tests are unchanged |
| 31 | A-20 vitals with Δ vs the comparison mode and a target sub-line | Six tiles with Δ always vs the same period last year and an `LY` sub-line; "Time to activation" (median days sign-up → first dashboard) stands in for the requested time to paid | USER, round 1 pass 2. The dataset has no sign-up → first-payment timing; conversion into paid is a period rate (paid ÷ sign-ups in the window), not a cohort |
| 30 | O6 three best and three worst campaigns, bars about zero | Worst 5 or Top 5 by Δ ROAS (switch), bars = the size of the change, label signed | USER, round 1 |

## Readings of the spec in this build

- The window is resolved from `meta_dataset[as_of_date]`; Custom uses a disconnected day list (`param_date`), so the trend axis
  (`dim_date[date]`) is never filtered by the From / To slicer.
- Week / Month granularity draws one point per bucket on the day axis (bucket start clipped to the window), so the Oct 18 line stays.
- The attribution gap and the modelled CPA use the selected first-party model (DDA when Platform-reported is picked).
- Movers compare with the previous period, or with the same period last year in LY mode. A visual grouping by `campaign_label` also
  groups by its sort column, so the rank clears `dim_campaign[sort_order]` too (tested).
- Movers window (O5, O6; 2026-11-05): when the comparison window would start before the first day of data and the window is longer
  than 30 days, both cards compare the window's **last 30 days** with their comparison (`_Mv Start`; the deltas and the O5 now / before
  cells use explicit date windows from `_Mv Start`; the O5 alert column re-reads the window as a Custom range `_Mv Start` .. window
  end, so a row's numbers and its alert describe the same days). Cause found: the USER's saved state Custom Jan 1 2025 – Nov 3
  2026 (672 days) has its previous period in Mar 2023 – Dec 2024, before the data starts, so `Spend Prev` was blank for every campaign
  and both cards were empty; the same range in LY mode compared 672 days with 307 days of data. Granularity plays no part. Every
  shorter or covered window is unchanged (T-K12 + the existing O5 / O6 rows).
- Default selection of the Campaigns view = the worst mover of the scope (fallback: the top spender).
- Cohorts: DDA, the scope's campaigns; the window only picks the months shown (K1 the 12 acquisition months before the end month,
  K3 the latest six months with a cell). Cohort cost = spend of the acquisition month + the month's team cost × its spend share.
- Worst 5 / Top 5 (O5, O6): one disconnected table per card (`param_o5_rank`, `param_o6_rank`), strict single select, saved pick Worst 5;
  nothing picked (e.g. after Reset all) = Worst 5. A button slicer keeps its data state across the view bookmarks (display state only),
  which a bookmark pair inside the view groups would not. Ranks count only campaigns whose change has the mode's sign, so a list can hold
  fewer than five rows (default window, anomalies Worst 5: four).
- Churn / Refund by channel (P6, P7): churned customers of the trailing 3 complete months and refunds of the 12 acquisition months to the
  window end (the numerators of monthly churn and the refund rate), DDA credits, the five channels with the most.

## Performance (A-83, AT-21)

Cold timings on the source machine, 2026-11-04: one DAX query per visual built from the PBIR (`tools/run/timing_queries.py`), XMLA
ClearCache before every run, median of 3 (`tools/run/time.ps1`), default state (R30 | previous period | all | DDA). Desktop runs the
visuals of a view in parallel, so a view's first paint is bounded by its slowest visual; the serial sum is the worst case. The floor of a
cold query on this machine is ~80 ms. Field-value colour measures run in the same visual query in Desktop and are not timed separately.

| View | Visuals timed | Slowest visual | Serial sum (view) | + frame (vitals, header, chips, footer: 17 queries, 1.6 s serial, slowest 0.14 s) |
|---|---|---|---|---|
| Overview | 13 | O5 alerts table 0.97 s (O6 movers 0.30 s) | 2.4 s | 4.0 s |
| Channels | 9 | C1 matrix 0.15 s | 0.9 s | 2.5 s |
| Campaigns | 12 | P4 creatives 0.51 s (P5 0.22 s, P1 0.21 s) | 1.9 s | 3.5 s |
| Journey | 8 | J1 table 0.10 s | 0.7 s | 2.3 s |
| Cohorts | 10 | K5 table 0.16 s | 1.0 s | 2.6 s |

Every visual returns in under 1 s cold, inside the spec's N-01 filter-change budget (< 2 s p95). The O5 alerts table is the hot spot
(it evaluates every rule slot); a precomputed slot flag would halve it if needed.

Round 1 (2026-11-04, same method, new and changed visuals): O6 movers 0.32 s, O5 anomalies 0.19 s, O1 funnel 0.13 s, O3 combo
0.10 s, C1 matrix with CAC 0.16 s, P1 0.21 s, P6 churn 0.11 s, P7 refunds 0.14 s, K1 heatmap 0.13 s. The Overview's slowest visual
is now 0.32 s (was the O5 alerts table, 0.97 s, removed).

2026-11-05 (same method, median of 3–5, on a busier machine: three other Desktop instances open, so absolute numbers run 2–3× the
11-04 ones; compare within the run): dynamics charts, one per pop-up, 0.26–0.38 s at 30 d and 0.31–0.56 s at the saved state (only the
open pane queries). O5 / O6 at 30 d: 0.56 / 0.92 s against 0.93 / 1.19 s for the pre-change model in the same run; at the saved state
1.0 / 1.5 s (before the change they returned no rows in 1.2 / 1.4 s). A first cut that re-read the window through the parameter tables
inside every campaign's delta took 4.5 / 3.0 s there and was replaced by explicit date windows.

## Change log

- **2026-11-05 (vitals binoculars, O5 / O6 blank)** — USER: (1) a binoculars before every vital's label, each opening the dynamics of
  that one metric (`<metric> | dynamics`): six pane groups `grp_dyn_v1` … `v6` over the shared `grp_dynamics` window, bookmarks
  `bm_dyn_v1` … `v6` (display state only), the one-chart pane 846 × 480; removed `vit_dyn_btn`, `vit_dyn_icon`, `dyn_title`,
  `bm_dyn_open`; tiles back to 224 px; icon redrawn at 16 px. (2) O5 / O6 were empty in the USER's saved state (Custom from Jan 1 2025,
  previous period before the data): new `_Mv Start`; `Anomaly Delta`, `ROAS Delta`, `O5 Paid Now`, `O5 Paid Before`, `O5 Alert` read
  the movers window; ⓘ notes for O5 / O6 say so. T-K12 (122 rows). Applied to the USER's 2026-11-05 01:10 Desktop save by a three-way
  merge that keeps Desktop's z order, tab order and slicer picks; `_measures.tmdl` patched block by block (Desktop had reordered it).
  Validator 0 / 0; tests 29 blocks / 29,387 rows TRUE on a scratch copy. (bip)

- **2026-11-04 (brand logo)** — the header's brand mark (`acme-mark.svg`, 26 px) is replaced by svg-designer's
  `docs/design/icons/acme-marketing-logo.svg` (registered as `acme-marketing-logo.svg`, image visual `hdr_logo`, 28 × 28 at x 16, y 14);
  the title stays at x 50. (bip)

- **2026-11-04 (redesign round 1, pass 2)** — USER-approved proposals: Overview slot = O7 spend and paid customers by channel (SVG, two
  aligned columns); vitals v2 (Spend | New clients | Conversion into paid | Time to activation | CAC | ROAS 90 d, Δ vs the same period LY)
  + the Vitals | dynamics pop-up behind a binoculars button; Channels slots = C5 / C6 paid customers by channel on web / mobile with CAC in
  the label; Cohorts slots = K6 payback months by channel vs 12 + K7 cohort size by month. Defaults: O3 plan as pale columns, C1 without
  CPA. 27 new measures; T-K11 (101 rows); validator 0 / 0; tests 28 blocks / 29,265 rows TRUE. A-20 / A-21 / AT-02 amended. (bip)
- **2026-11-04 (redesign round 1, pass 1)** — USER review items 1–17 except the four pending approval: Overview = funnel (absolute counts) |
  guardrails | slot; anomalies | movers (Worst 5 / Top 5 switches); spend + CAC combo full width (secondary axis accepted). Channels = C1
  with CAC | C2 + two slots (C3, C4 dropped). Campaigns = P1 over two rows; P5 | churn by channel | refund by channel (P2, P3, P4 dropped;
  K4 moved here as P6 / P7). Cohorts = K1 heatmap over K3 | K2 + two slots (K4 moved, K5 dropped). Filters: "Compare with" → "Same period
  LY", Saved views removed. Everywhere: `·` → `|`, no question lines, no captions, no page footer. 30 new measures, two switch tables,
  T-K10 test block (271 rows); validator 0 / 0; tests 27 blocks / 29,164 rows TRUE. Applied to the Desktop-saved PBIR by a three-way merge
  (the USER's 21:28 save kept: C1 expansion, slicer states). (bip)
- **2026-11-04 (USER first-open bug)** — the Load dialog reported `dim_campaign` / `dim_attribution_model`: "A cyclic reference was
  encountered during evaluation" (26 queries blocked). Not reproducible: the same files loaded all 28 queries cleanly in four fresh
  Desktop opens the same evening (three scratch copies and the repo copy, not saved). The Desktop trace of the failing open shows the
  error in the schema-preview pass (both queries ran once in one mashup container, every other query twice). No file change for it;
  if it recurs: Refresh again, and copy the error details from Transform data › the query. (bip)
- **2026-11-04 (USER first-open: ⓘ glyph centred)** — the 30 ⓘ buttons (6 vitals, 24 cards) drew the U+24D8 glyph inside the
  card's own 16 px border circle, so a second, smaller circle sat on the bottom edge. Now `Info Glyph` = "i" (the border is the
  circle) and each ⓘ card has a 3 px bottom container padding, which centres the letter (render check: within 0.5 px). The Filters
  window has no ⓘ. Validator 0 / 0; tests 26 blocks / 28,893 rows TRUE on a fresh scratch load. (bip)
- **2026-11-04 (phase 3)** — Journey (J1–J4) and Cohorts (K1–K5) built; tabs, How to read and ⓘ for both; five saved views as
  data-state bookmarks; tests extended with every Journey and cohort key and the daily card keys (26 blocks / 28,893 rows TRUE);
  timing pass recorded above; platform limits 26–27 added; `.sync/acme-marketing/` pack issued. Validator 0 / 0. (bip)
- **2026-11-04 (phase 2)** — model, Overview / Channels / Campaigns, Filters window, ⓘ tooltip page, How to read pop-ups, tests
  (24 blocks / 23,614 rows TRUE), dictionary. Validator 0 / 0. (bip)

# ACME Marketing — Paid Acquisition Console (Power BI flavour)

> **Draft — ADR-0015 (Proposed), phases 2 and 3 built.** Built 2026-11-04 by bip on the ADR's bold defaults: all five views, the
> Filters window with the five saved views, tests and the `.sync/` pack. All figures are generated and illustrative.

One page, five views, for the paid online acquisition of ACME's SaaS product (web, iOS, Android; six channels, eight networks,
19 campaigns). The data, its rules and the control totals are the contract in `data/acme_marketing_dummy_data/README.md`; the requirement
IDs (A-nn, AT-nn) are in `docs/Requirements-marketing.md`; the spec bundle stays untouched beside this file in `paid-acquisition-dashboard/`.

| Item | Where |
|---|---|
| PBIP | `ACME Marketing.pbip` + `ACME Marketing.SemanticModel` (TMDL, Import) + `ACME Marketing.Report` (PBIR) |
| DAX tests | `tests/control-totals.dax` (26 blocks, 28,893 rows; every `_pass` TRUE on 2026-11-04; every row of `control_totals_usd.csv` is covered) |
| Measure dictionary | `docs/model/marketing-measure-dictionary.md` (generated) |
| Theme | `ACME Marketing.Report/StaticResources/RegisteredResources/acme-marketing-theme.json` (+ `acme-wallpaper.png`, `acme-mark.svg`) |
| Generator | `tools/` (local only, gitignored like Nordmark's: `gen/` writes model, report, tests and dictionary; `run/` holds the scratch runners and the timing tool) |

## Open it

1. `DataFolder` (Transform data › Manage parameters) defaults to `C:\__PBI\PNL\data\acme_marketing_dummy_data\parquet`. On another
   machine point it at the `parquet` folder of the generated dataset (A-80, AT-19). Nothing else is machine-specific.
2. **Refresh** (5–25 s; 27 Parquet tables + `manifest.json`, 0.26 M rows). The PBIP ships without `cache.abf`: the first open shows
   empty visuals until the refresh finishes.
3. Optional: run the DAX tests (DAX query view, one block at a time, or `tools/run/run-tests.ps1 -Port <port>` against a refreshed copy;
   the full file takes about 10 minutes on the source machine).

### First-open checklist (USER)

- [ ] Refresh succeeds; the vitals read **$188.4k +7.0 % · 457 +2.9 % · $531 +6.4 % · $61.9k +3.4 % · 10.8 mo +0.6 · 3.4× −0.2** (A-21).
- [ ] The five tabs swap the body under the same vitals.
- [ ] Period pill opens Filters on Period; Filters button opens it on Scope; the rail swaps the seven panes; Close, × and a second click on
      the Filters button close it; Reset all clears every slicer (30 d · previous period · all · DDA).
- [ ] A pick in Filters updates the badge, the chips line and the applied-state rail at once (no Apply, platform limit 1).
- [ ] Saved views: each of the five sets its tab and filters and closes the window (Exec weekly · Daily pacing · Mobile only · Brand vs
      non-brand · Finance month-end). These are data-state bookmarks written by hand: please click each once and save if they land right.
- [ ] Click a channel row in the C1 matrix: the chips line shows `Selected: Paid social`, the cards below and the Campaigns / Journey /
      Cohorts views scope to it, the vitals do not move. Click again to clear.
- [ ] Campaigns: with no click P2–P5 show **Meta prospecting · Lookalike 2%** (the worst mover); a click on another row re-targets them.
- [ ] Cohorts: pick Meta prospecting · Lookalike 2% (Filters › Campaigns): its Oct 2025 and Dec 2025 lines cross 100 % at month 9.
- [ ] Hover every ⓘ (30 cards incl. the vitals): the tooltip page shows title, what, formula, note with the window and model.
- [ ] Granularity Week / Month re-buckets O3 and P2; Same period last year / Plan / None change every Δ and no verdict colour.
- [ ] Save once in Desktop (the generated PBIR then becomes Desktop serialization; further edits go surgically).

## The page

`paid_acquisition`, 1440 × 810, FitToPage. Frame: top bar 56 px (brand, five tabs, period pill, Filters button with the active-count
badge, freshness dot + `Synced n h ago`), chips line (text, A-14), vitals ribbon (six glass tiles: value, Δ vs the comparison mode with
arrow and direction-aware colour, target sub-line with the verdict dot, comparison value; no sparkline, ADR-0012 §2.4), body on a
12-column grid, footer strip (model, currency, last sync per source). Glass = white 90 % + 1 px edge + 14 px radius + soft shadow; the
blooms are baked into `acme-wallpaper.png`; Segoe UI / Semibold for Manrope / Inter.

| View | Cards (spec span) | Visual |
|---|---|---|
| Overview | O1 Acquisition funnel (7) · O2 Guardrails (5) · O3 Spend vs plan and CAC, daily (8) · O4 Spend share vs new-MRR share (4) · O5 Anomalies and alerts (6) · O6 Top movers by Δ ROAS (6) | O1 / O2 / O4 SVG image measures; O3 two stacked line charts with the Oct 18 constant line; O5 table of `dim_alert_slot`; O6 column chart about zero |
| Channels | C1 Channel matrix (12) · C2 Web vs app funnel (6) · C3 Platform-reported vs modelled CPA (6) · C4 Budget pacing by channel (12) | C1 matrix channel › platform; C2 / C3 clustered columns; C4 pacing columns coloured by band + dashed 100 % line |
| Campaigns | P1 Campaigns (12) · P2 Selected campaign (8) · P3 Ad sets by CPA (4) · P4 Creatives (8) · P5 Keywords / placements (4) | P1 / P4 / P5 tables; P2 two stacked line charts; P3 columns + dashed target |
| Journey | J1 Landing and store pages (6) · J2 Onboarding steps, paid traffic (6) · J3 Sign-up → activation time (6) · J4 Activation rate by platform and OS (6); two rows of 287 px (row 3, session recordings, not built: A-04) | J1 table (— for bounce / LCP on store pages); J2 columns with the largest drop in crit; J3 bins with the median bin emphasised; J4 segments against the dashed 40 % target |
| Cohorts | K1 Payback curves (8) · K2 LTV:CAC by channel (4) · K3 Retention grid (8) · K4 Refund and churn by channel (4) · K5 Cohort size and ARPA (12) | K1 lines by month since acquisition for six cohorts + dashed 100 %; K2 channel-coloured columns + dashed 3:1; K3 matrix, one hue darker = higher; K4 paired columns; K5 table of the 12 acquisition months |

Every card: title + one-line question, the visual, a caption with the key number(s), an ⓘ (tooltip page `tt_card_info`, copy from
`dim_card`). One How to read pop-up per view.

**Filters window** (`grp_filters`, 880 × 560 over a 32 % scrim): left rail of seven bookmarks (Period · Scope · Channels · Campaigns ·
Audience · Attribution · Saved views), main area with the group's slicers, right rail = applied state + campaigns / channels / platforms in
scope (instead of a live preview), Reset all (Clear all slicers) + Close. Period: preset tiles, From / To (`param_date`, used by Custom),
comparator, granularity. Scope: platform, tier. Channels: channel › network tree. Campaigns: status tiles + searchable list. Audience:
market dropdown. Attribution: model tiles. **Saved views** (`bm_saved_*`, bookmarks with display and data state; every other slicer is
reset):

| Saved view | Tab | Filters set |
|---|---|---|
| Exec weekly | Overview | all defaults (30 d · previous period · all · DDA) |
| Daily pacing | Campaigns | preset MTD, comparison Plan |
| Mobile only | Channels | platform iOS + Android |
| Brand vs non-brand | Campaigns | channel Paid search |
| Finance month-end | Cohorts | attribution Last click |

## Model

27 Parquet tables through `DataFolder` (one partition each, explicit `Table.TransformColumnTypes` from `manifest.json`; derived columns in
M: `dim_date.month_index / month_start`, campaign names for the Filters tree, `campaign_label` / `platform_label` copies for the
cross-filter sources, cohort month indexes) + `meta_dataset` (manifest) + calculated tables: pickers `param_period_preset`,
`param_comparator`, `param_granularity`, `param_date`; slot tables `dim_funnel_stage`, `dim_c2_stage`, `dim_alert_slot`, `dim_offset`
(K1 axis), `dim_day_n` (K3 columns), `dim_act_bin` (J3 bins with hour edges); the copy table `dim_card`; `_measures` (411 measures,
275 visible). Facts → `dim_campaign` → outriggers `dim_channel` / `dim_network` / `dim_platform` (single direction, ADR-0015 (c));
`fact_*_month` → `dim_month`; keys hidden. 40 tables, 29 relationships. See the dictionary for every measure.

## Platform limits

The 17 of ADR-0015 (e) apply (Apply semantics, keys, saved views, one theme, fixed canvas, no blur, two stacked charts, log funnel,
ⓘ instead of ⋯, creatives as a table, no shortcuts, no recordings, cross-filter chip as text, no sparklines, anomalies as a table, no URL
state, Segoe UI). Met in this build in addition:

| # | Spec / ADR | Power BI here | Why |
|---|---|---|---|
| 18 | Horizontal bars for O4, O6, C2–C4, P3 | Column charts; O1 funnel and O4 shares as SVG image measures | Horizontal bar charts keep ~30 px per category and scroll in a 110 px plot |
| 19 | Channel colours on paired bars (O4, C3) | O4 drawn as SVG with the channel colour + tint; C3 reported grey / modelled accent | Field-value colours (fx) do not reach a multi-series bar; single-series charts (O6, C4, K2, J2–J4) take them |
| 20 | Oct 18 marker "where CAC stepped" | A fixed story annotation (`Story Step Date`, constant line) | The largest 7-day step of the noisy daily CAC falls on Oct 17; the day is not detectable from the data |
| 21 | Status default Live + Learning | Default applies to the campaign list (P1, Campaigns pane); window totals keep every campaign until a status is picked | The paused retention campaign spends in the previous period; filtering it would break the ALL control totals (+7.0 % spend) |
| 22 | O6 click opens Campaigns scoped to the campaign | A click cross-filters; the reader switches the tab | No navigation from a data point |
| 23 | Saved views store filters and tab | Five data-state bookmarks; a Custom date range is not part of any (Finance month-end = Last click + Cohorts, no month-end range) | Between-slicer state is not hand-written; users cannot add views (limit 3) |
| 24 | P3 ad-set CPA under the selected model | DDA always | `paid_customers_dda` is the only ad-set credit (data README D-4) |
| 25 | Freshness hover per source | Footer lists every source's last sync | — |
| 26 | J4 by OS version | By platform segment (web desktop / mobile, iOS 18 / 17, Android 14–15 / ≤ 13) | The dataset carries segments, not single OS versions |
| 27 | K1 cohort lines selectable | Six fixed cohorts: every other month back from the window's end month − 3 (ADR-0015 §5 q 12) | No per-line toggle in a native line chart |

## Readings of the spec in this build

- The window is resolved from `meta_dataset[as_of_date]`; Custom uses a disconnected day list (`param_date`), so the trend axis
  (`dim_date[date]`) is never filtered by the From / To slicer.
- Week / Month granularity draws one point per bucket on the day axis (bucket start clipped to the window), so the Oct 18 line stays.
- The attribution gap and the modelled CPA use the selected first-party model (DDA when Platform-reported is picked).
- Movers compare with the previous period, or with the same period last year in LY mode. A visual grouping by `campaign_label` also
  groups by its sort column, so the rank clears `dim_campaign[sort_order]` too (tested).
- Default selection of the Campaigns view = the worst mover of the scope (fallback: the top spender).
- Cohorts: DDA, the scope's campaigns; the window only picks the months shown (K1 six cohorts, K3 the latest six months with a cell,
  K5 the 12 months to the end month). Cohort cost = spend of the acquisition month + the month's team cost × its spend share.

## Performance (A-83, AT-21)

Cold timings on the source machine, 2026-11-04: one DAX query per visual built from the PBIR (`tools/run/timing_queries.py`), XMLA
ClearCache before every run, median of 3 (`tools/run/time.ps1`), default state (R30 · previous period · all · DDA). Desktop runs the
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

## Change log

- **2026-11-04 (phase 3)** — Journey (J1–J4) and Cohorts (K1–K5) built; tabs, How to read and ⓘ for both; five saved views as
  data-state bookmarks; tests extended with every Journey and cohort key and the daily card keys (26 blocks / 28,893 rows TRUE);
  timing pass recorded above; platform limits 26–27 added; `.sync/acme-marketing/` pack issued. Validator 0 / 0. (bip)
- **2026-11-04 (phase 2)** — model, Overview / Channels / Campaigns, Filters window, ⓘ tooltip page, How to read pop-ups, tests
  (24 blocks / 23,614 rows TRUE), dictionary. Validator 0 / 0. (bip)

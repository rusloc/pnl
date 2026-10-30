# js-exec — Nordmark Retail executive dashboard (JS flavour)

Standalone Next.js 16 app (ADR-0013 (h)) for the Nordmark Retail executive dashboard: one landing page at 1440 × 810, built
from prototype v5 (`docs/design/executive dashboard (reseller)/prototype.html` + `README.md`). Requirements:
`docs/Requirements-exec.md` (E-nn, ET-nn). Data contract: `data/nordmark_retail_dummy_data/README.md`, which wins over
layout names (ADR-0013 (j)). The Power BI flavour is `pbi-report/Nordmark Exec/` (separate build, no shared files).

## Run

```powershell
cd js-exec
npm ci
npm run build:data   # ../data/nordmark_retail_dummy_data/parquet → public/data (also runs as prebuild)
npm test             # Vitest; reads public/data, so build the data first
npm run build        # prebuild (data) + next build
npm start            # http://localhost:3000
```

Gate: `npm run typecheck && npm run lint && npm test && npm run build`. Node ≥ 24 (the data build runs on Node's native
type stripping). No env var is needed for a local build. Runtime hooks: `NEXT_PUBLIC_SITE_URL` (optional, metadata base)
and `EMBED_ALLOWED_ORIGINS` (server-side, comma-separated origins for CSP `frame-ancestors`).

Dependencies are pinned to the `js-report/` versions (Next 16.4.2, React 19.3.1, hyparquet 1.31.5, hyparquet-writer 0.17.0,
Zod 4.6.7, Vitest 5.0.5, ESLint 9.39.5, TypeScript 5.9.3); `package-lock.json` differs from js-report's only in the name.

## Layout

```
app/              layout.tsx (Inter via next/font), page.tsx (static shell + Suspense), globals.css (the v5 stylesheet)
components/       ExecApp.tsx (client root: data load, URL state, layers, tooltip), Card.tsx, Layers.tsx, ui.tsx, bars.ts
lib/data/         manifest.ts (Zod contract of public/data), loader.ts, parquet-columns.ts (vendored from js-report)
lib/engine/       cube.ts, calendar.ts, items.ts, metrics.ts, status.ts, format.ts, copy.ts, view.ts, url-state.ts (+ tests)
lib/test-utils/   exec-data.ts (Node loader + control totals reader)
scripts/          build-exec-data.ts, csv.ts (vendored from js-report)
public/data/      build output, gitignored here (as js-report/public/data); the .sync pack ships it prebuilt
```

- **Engine** (`lib/engine/`, framework-free): `items.ts` derives the period model's items from `dim_week` (95 weeks,
  22 periods, 8 quarters, 2 years; ADR-0013 (k), E-90 … E-99) with their windows, the Last-year and Previous windows and
  the bar series; `metrics.ts` computes every control-total metric for a scope × window;
  `status.ts` holds the status bands and the literal v5 dot rule, reading the thresholds from `param_status_rule` only
  (E-75); `view.ts` turns metrics into card faces, Δ texts, bars, ⓘ worked examples and mini stats. Components render
  strings; they compute nothing.
- **Rendering:** the route is a static shell (`○ /`); the client reads the query string and loads `public/data` (no server,
  no API). URL keys: `i` (item key `FY2026-P10` · `FY2026-Q4` · `FY2026` · `FY2025-W12` …; the as-of week `FY2026-W43`
  is the default and is omitted), `c` (budget · ly · prev), `r` (all · nl · be · online), `group`, `lever`, `owner`
  (comma lists). Each key is validated with Zod and `i` must be a listed item; unknown keys and bad values are dropped and
  the URL is rewritten to the canonical form. `c=prev` with a Year item becomes `c=ly`. Retired keys still parse:
  `p=week|ptd|ytd` → the default item · `FY2026-P10` · `FY2026` (ignored when `i` is present, never written), `c=lw` →
  `prev`; `statement` and `horizon` (USER 2026-10-29) parse as unknown: an old link opens with no pick.
- **Period model** (E-90 … E-98, USER 2026-10-29): Filters → Period = three radio groups (granularity Week · Month ·
  Quarter · Year → fiscal year, hidden at Year → one item; one tab stop each, arrows move and select) and a live
  "Showing …" line. Month = the 4-5-4 retail period (items P1 … P12; every UI word is "Month": header "Month 10",
  "vs LY month", "month 10 to date" — "Period" stays only as a column / key name, USER 2026-10-30); partial items read
  "to date".
  Switching the granularity keeps the item that holds the current item's last week. Comparator Budget · Last year ·
  Previous (previous week / month / quarter; a partial item vs the previous item cut to the same week count); Previous
  is not offered at Year. Bars follow the granularity (13 · 12 · 8 · 2) ending at the picked item. Per-KPI rules as
  built: `exec-period-model.md` §4, with Channel mix = window shares (plan = budget shares over the same weeks) at
  Month / Quarter / Year. FY2025 items: budget-based cards N/A, target-based cards rated (GMROI from FY2025 W52), the
  counts and dot over the rated cards; no rated card → grey dot. **EBITDA at Week vs Previous** (USER 2026-10-30):
  month to date through the week vs the previous month's first k weeks (W43 = P10 weeks 1–4 vs P9 weeks 1–4; P1 crosses
  to the previous FY's P12; `items.ts` prevMonthToDate); the card Δ stays short ("vs prev. mth"), the ⓘ Δ names the
  window ("vs P9 weeks 1–4", "vs P12 FY2025 week 1"); every other card compares with the previous week.
- **Period-neutral ⓘ copy** (USER 2026-10-30): What / Why / Formula / worked examples read right at Week, Month, Quarter
  and Year ("in the picked period"); the worked examples quote the selection's own numbers (Availability at Month /
  Quarter / Year says "Last week of the month: …"); the Week-43-specific "Owner note" row is gone from every ⓘ.
- **Layers** (E-52): Filters, How to read, More KPIs and the card ⓘ / drill pop-ups all open through `LayerFrame`
  (`components/Layers.tsx`), so every one sits on the same scrim: ink `#111827` at 22 % (`rgba(17, 24, 39, 0.22)`,
  Power BI: transparency 78 %), full viewport, z-index 40 (side bar 30, panels 50, tooltip 60), a click on it, Esc or ×
  closes and returns focus to the opener.
- **ⓘ figure block** (USER 2026-10-30, spec shared with the PBI flavour; replaces the 2026-10-29 inline target line):
  stacked, left of the bars: label "Actual" (`ACTUAL_LABEL`, `lib/engine/copy.ts`) at 16 px / 600 `#374151`, 4 px, the
  value at 48 px / 700 ink (unit as on the card); 12 px; a 20 px dotted swatch (the bars' target line, `#9ca3af`) and the
  basis label from `dim_kpi.basis` (Budget · Target · Plan) at 16 px / 600 `#374151`, 4 px, the status-basis value at
  40 px / 700 ink with its unit at 16 px / 600 `#374151`, formatted exactly like the card value ("€62.9m", "9.5 wks",
  "70.0% store"); then the Δ line right below. Each label and its number are one `dt` / `dd` pair in a `dl.fig`, so a
  screen reader reads them together. The basis never follows the comparator (E-24); a blank basis (`card.target.value`
  "n/a": FY2025 budget cards, LFL Online) keeps its label and shows a muted "–" (`NO_BASIS_VALUE`). The old footer line
  "Target budget …" is gone; the refresh / provisional note closes the tags row instead of a footer of its own.
- **Category filter** (USER 2026-10-30, ADR-0013 (l), E-100 … E-104, `docs/ADD/features/exec-category-filter.md`): a
  **Category** dropdown in the Filters menu under Region / format. Closed, a field with the pick ("All categories", one
  name, "Electronics & Toys & leisure", "3 categories" with the names as `title`); open, an inline list of checkboxes
  (`role="checkbox"` buttons): "All categories" (clears the pick), then the 9 `category_name`s in `sort_order`, codes never
  on screen. Enter / Space opens and ticks, Esc closes the list and leaves the menu open (the layer's Esc listener skips
  a `defaultPrevented` Esc); Reset clears it; ticking the 9th = All. The pick is a **data scope** with Region (region ×
  category): `metrics.ts computeMetrics(d, scope, window, cats)` sums the cube on the picked category cells
  (`cube.ts categoryMask`, null = All); **EBITDA flash and Supplier OTIF are N/A under any pick** (no category key on
  OpEx / PO lines; `primary_category_code` not used), **Sell-through** runs on the seasonal part of the pick and is N/A
  without one. N/A face: value "–", Δ `n/a by category` (muted), chip "–", blank bars, ⓘ mini stats n/a, the Worked
  example row holds the one-line note. Targets under a pick: cover forecast-weighted (existing rule), GMROI weighted by
  average on-hand cost over `dim_category.gmroi_target`, sell-through by opening + receipts (0.62), availability 0.97;
  at All every number and string is as before. Counts and dot run over the rated cards and follow the pick; the badge
  and the "n of 12 metrics · picks" summary count attribute picks only. Header: the region segment gains ` · <name>`,
  ` · <name> & <name>` or ` · <n> categories`. ⓘ GMROI / sell-through mini stats show the picked categories. URL key
  `cat` (`url-state.ts`): comma-separated codes, sort_order, deduplicated, unknown / wrong-case dropped, nothing valid or
  all 9 = absent, written after `r`. No data change: the cube already carries category (E-83).
- **Security headers** (`next.config.ts`, ADR-0002 §2.6, E-82): CSP `default-src 'self'`, `frame-ancestors` from
  `EMBED_ALLOWED_ORIGINS`, no `X-Frame-Options`, nosniff, referrer and permissions policies. `script-src 'unsafe-inline'` is
  the same day-one compromise as the P&L and Mirelo apps (nonces deferred).

## Data provenance and size

Source: `data/nordmark_retail_dummy_data/parquet/` (generator seed 20261028, as-of FY2026 W43 = 19–25 Oct 2026, refresh
stamp from its `manifest.json`). `scripts/build-exec-data.ts` folds the facts into four pre-aggregated files; stores,
suppliers and SKUs never ship (E-83). Every fold is reconciled to the source totals before writing; the build fails over
4 MB.

| File            |  Rows |       Bytes | Grain                                                                                                                                                                           |
| --------------- | ----: | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cube.parquet`  | 4,599 |     384,427 | week × site group (NL stores, BE stores, ONLINE, WHOLESALE, DC, central) × category: sales, LFL sales (current and as-LY), budget, stock, forecast COGS, availability, receipts |
| `opex.parquet`  | 1,029 |       8,932 | scenario × week × cost type × site group                                                                                                                                        |
| `po.parquet`    |    95 |       1,685 | week: PO lines due / OTIF, suppliers below 85 %                                                                                                                                 |
| `sites.parquet` |   190 |       1,355 | week × site group: trading stores, LFL stores                                                                                                                                   |
| `manifest.json` |     — |      55,380 | calendar (104 weeks), categories, the 32 KPIs, status rules, targets, file index (strict Zod)                                                                                   |
| **Total**       |       | **451,779** | all of it loads at first paint (E-83 budget 600 kB)                                                                                                                             |

## Tests (Vitest, 458 tests in 13 files)

| File                                         | Tests | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/engine/control-totals.test.ts`          |    94 | **ET-01**: every one of the 26,143 rows of `checks/control_totals_eur.csv` (4 scopes × 62 period-model keys `W-` · `P-` · `Q-` · `FY-` · `@k`, E-99, + 25 EBITDA previous-month keys `P-…@k`, present for every W key) within verify.py's tolerances, and no engine value the CSV leaves out; the 6 retired `PTD-` / `YTD-` keys still reconcile on their as-built reading (exit-week mix and the EBITDA PTD pair at the last week; their statuses are not compared)                       |
| `lib/engine/period-model.test.ts`            |    55 | **ET-21** item lists, partial flags, key grammar, windows to date; **ET-22** default Week · FY2026 · W43; **ET-23** LY / Previous windows per granularity (= the control keys), FY2025 N/A, Year without Previous; ET-09 amended (flow, point in time, window mix); **ET-25** bars 13 · 12 · 8 · 2 vs the control rows, blank bars; **ET-26** N/A cards and the grey dot; **ET-27** EBITDA per granularity; E-98 labels; **ET-28** URL state and picker moves                              |
| `lib/engine/story.test.ts`                   |    30 | **ET-02** Week 43 · ALL · Budget = the v5 story on all 12 cards (value, Δ text, chip), the ⓘ worked examples and mini stats; the ⓘ target line on all 12 cards and its label from `dim_kpi.basis`; **ET-03** 7 / 3 / 2, orange, unchanged under every attribute pick                                                                                                                                                                                                                       |
| `lib/engine/calendar.test.ts`                |     6 | **ET-04** calendar keys and windows to date (P10 = W40–W43, FY2026 from 29 Dec 2025, LY / LW keys); **ET-05** LY by key (FY2025 W43), not by date (FY2025 W42)                                                                                                                                                                                                                                                                                                                             |
| `lib/engine/status.test.ts`                  |    13 | **ET-10** every rule at its edges, float noise at −3 %, Markdown ↓, cover and mix bands, N/A; the dot rule (7/3/2 orange, 11/0/1 green, N/A excluded)                                                                                                                                                                                                                                                                                                                                      |
| `lib/engine/view.test.ts`                    |    13 | **ET-11** comparator changes Δ rows only; ⓘ target line ignores the comparator, n/a when blank; **ET-12** NL + BE + Online + Wholesale = ALL, Online only; **ET-13** B3 conceals 8, (B1 or B4) and Sales → 3; bars; no Statement / Horizon attribute, no Notes; ⓘ note without "Target …"                                                                                                                                                                                                  |
| `lib/engine/url-state.test.ts`               |     5 | E-62 parse / serialise / fallback / unknown keys; retired `statement` and `horizon` keys ignored                                                                                                                                                                                                                                                                                                                                                                                           |
| `components/bars.test.ts`                    |     3 | v5 bar geometry; labels counted back from the picked bar (every 3rd of 12–13, every 2nd of 8, both of 2)                                                                                                                                                                                                                                                                                                                                                                                   |
| `components/layers.test.tsx`                 |    12 | One scrim under every layer (Filters, How to read, More KPIs, ⓘ, drill), scrim click closes, panel shells, scrim colour and z-order in `globals.css`                                                                                                                                                                                                                                                                                                                                       |
| `components/explain-pop.test.tsx`            |    17 | ⓘ figure block: Actual → value → basis → value in order on all 12 cards, label + number one `dt` / `dd` group, Δ right below the `dl`; FY2025 P10 blank basis = label + muted "–"; the CSS spec in `globals.css`                                                                                                                                                                                                                                                                           |
| `lib/engine/category.test.ts`                |    26 | **ET-33** Σ of the 9 singles = All (13 additive inputs, 6 keys × 4 regions), seasonal mix = All sell-through, single / mix targets, All targets = `param_target` ALL, all 9 = All; **ET-34** no OpEx / EBITDA / PO / OTIF value under any pick, non-seasonal pick → no sell-through, rated counts, ONLINE N/A, picked mini stats only, the N/A card face and ⓘ note; **ET-35** header segment forms, dropdown names / summary / toggles, badge untouched, How to read; **ET-36** URL `cat` |
| `lib/engine/control-totals-category.test.ts` |   181 | **E-104**: every row of `checks/control_totals_category_eur.csv` (18 scopes `ALL#…` / `NL                                                                                                                                                                                                                                                                                                                                                                                                  | BE  | ONLINE#ELEC[+TOYS]` × 12 / 6 keys = 180 cells, 10,514 rows) within verify.py's tolerances, and no engine value the CSV leaves out; skipped by name while the file is absent |
| `components/filters-menu.test.tsx`           |     3 | Category dropdown between Region and the attributes, closed with the pick as its label, "All categories" + 9 names as checkboxes, checked states and the "n categories" title                                                                                                                                                                                                                                                                                                              |

A headless Chromium check (Playwright, run outside the repo on 2026-10-28) passed 32 / 32 against `next start`: fold
761 px and no scroll at 1440 × 810, card rectangles equal to prototype.html's, washes and the 2 px red border, bar sizes
92 / 62 / 58 bottom- and right-aligned with the dotted target, ⓘ → drill → back, Esc / scrim / × with focus return, Tab
trap, Notes / More KPIs / How to read, B3 conceals 8 in place with identical rectangles, switchers re-label and re-compute,
Online N/A cards, invalid query canonicalised, two columns and no horizontal scroll at 1000 px, reduced motion, no console
errors. `buildView` takes about 1.4 ms per selection in Node (E-84 budget 100 ms).

Re-check on 2026-10-29 after the USER's first-open feedback (same set-up): three side-bar buttons, the same scrim
(`rgba(17, 24, 39, 0.22)`, z 40, 1440 × 810, covering the side bar) under Filters, How to read and More KPIs, a scrim
click closes each with focus back on its button; Filters lists Group · Lever · Horizon · Owner; `?statement=pl&owner=finance`
canonicalises to `?owner=finance` (badge 1); the ⓘ target line on all 12 cards at 1440, 1000 and 390 px, never clipped;
no console errors. The EBITDA flash ⓘ now scrolls 15 px inside the pop-up at 1440 × 810 (the other 11 fit).

Period-model check on 2026-10-29 (same set-up, 32 / 32): default W43 story 7 / 3 / 2, orange, 13 bars, no page scroll;
Filters shows three radio groups (Week · FY2026 · W43 checked), no Horizon group, the live "Showing" line; ArrowRight on
the granularity moves to Month (`?i=FY2026-P10`, focus follows); P9 renders with 12 bars; `?i=FY2026-Q3` renders with 8
bar slots (Q4 FY24 blank) and no page scroll; `?i=FY2026&c=prev` canonicalises to `c=ly`, the comparator row has no
Previous and the FY row is hidden, 2 bars, 4 / 6 / 2; legacy `?p=ptd`, `?p=ytd&c=lw`, `?c=lw`, `?horizon=week` rewrite
as specified; FY2025 P10 shows 8 N/A cards; the target line measures 16 / 600 #374151 label, 32 / 700 value, 20 px swatch,
4 px under the value; **no ⓘ scrolls** for any of the 12 cards at W43, P9, Q3, FY2026 and FY2025 P10; no console errors.

ⓘ figure-block check on 2026-10-30 (same set-up, 21 / 30): order Actual → value → basis → value and gaps 4 / 12 / 4 /
4 px on all 12 cards at W43 (Budget, Previous, LY), P9, Q3, FY2026, FY2025 P10, FY2025 and Online; styles 16 / 600
#374151 labels, 48 / 700 and 40 / 700 ink values, 16 / 600 unit, 20 px dotted #9ca3af swatch; FY2025 P10 blank bases
show the muted "–"; no console errors. With the pop-up box at `max-height: min(86vh, 820px)` the taller block scrolled
(EBITDA flash 26 px, six cards 7 px); the box is now `min(calc(100vh - 32px), 820px)` (778 px at 810 px, main agent
2026-10-30) → **30 / 30, no ⓘ scrolls**, tallest EBITDA flash 723 px.

Category-filter check on 2026-10-30 (same set-up, 29 / 29): the dropdown by keyboard (Enter opens, Tab to Electronics,
Space ticks → `?cat=ELEC`, the list stays open, Esc closes the list and keeps the menu, a second Esc closes the menu);
10 options, names only; header "All regions & formats · Electronics", 3 N/A cards (EBITDA flash, Supplier OTIF,
Sell-through) with `n/a by category`, the badge stays hidden, the EBITDA ⓘ reads Actual – / Budget – and the OpEx note;
`?i=FY2026-P10&c=prev&r=nl&cat=ELEC%2CTOYS` canonical, header "Netherlands · all formats · Electronics & Toys & leisure",
2 N/A cards; `?i=FY2026-Q4&cat=HB,FRESH,AMBIENT` → `cat=FRESH%2CAMBIENT%2CHB`, "· 3 categories" with the names as title;
Reset, the 9th tick and "All categories" each return to the bare URL; **no ⓘ scrolls** at W43 ELEC, NL × ELEC + TOYS P10,
Q4 × 3 categories, Online × ELEC, FY2025 P10 × Apparel, FY2026 × ELEC + TOYS; no console errors.

## Deviations from v5 (deliberate)

1. **Status sentence** ("Off track: Availability …") not shown: ADR-0013 §3 makes it an option, off by default.
2. **"Draft v5"** side-bar label not shown (prototype marker).
3. **Switchers are real** (v5 re-labels only). Comparators Budget · Last year · Previous (was Last week, ADR-0013 (k));
   Forecast dropped (ADR-0013 OQ 6). The period switcher is the granularity picker of ADR-0013 (k).
   The menu hint now reads "Status is always vs budget or target; the comparator changes the Δ line."
4. **YTD label** "FY2026 to date · 29 Dec 2025–25 Oct 2026" (ADR-0013 (e), E-11; v5 said 2 Feb): now the Year item.
5. **Bars come from the data**: Net sales W31–W39 lower than v5 (data README open point 14), Sell-through W31 is N/A and the
   bars run 12 → 63 % (open point 13), GMROI 2.67 → 2.70, EBITDA weekly bars from the data.
6. **ⓘ copy**: worked examples, mini stats and footers are computed for the current selection. GMROI reads €862m ÷ €319m
   and the formula / stat say front margin over 52 weeks (open point 12). Stats with no data behind them are replaced:
   Availability "Lost sales est." and "Fresh top-50" → "Netherlands · Belgium" (93.5 % · 94.9 %) and "Lowest category";
   EBITDA "Payroll vs plan" → "Store costs vs plan" (store OpEx % of sales vs budget).
7. **How to read**: "↗" → "binoculars", the comparator name follows the switcher, footer "Illustrative data · Refreshed …"
   instead of "Draft v3 · nothing built".
8. **Notes pop-up removed** (USER 2026-10-29), with its side-bar button and copy; How to read no longer names it. The
   per-card "Owner note" row in the ⓘ is removed too (USER 2026-10-30: Week-43-specific text).
9. **N/A status** (new): grey "–" chip and muted Δ, for Availability and LFL under Online only (E-21).
10. **Header** keeps v5's brand block ("Nordmark Retail · Executive dashboard"); E-51's "Nordmark · Week 43" title is not
    applied, the week sits in the context line as in v5.
11. **Base cube grain** week × site group × category, LFL as measure columns, not E-83's week × country × format × channel ×
    category × is_lfl: no landing card reads format, and the file is smaller.
12. **Engine folder** `lib/engine/` (CLAUDE.md Track C convention and the build brief), not ADR-0013 (h)'s `lib/exec/`.
13. **Statement attribute removed** from the Filters menu (USER 2026-10-29): no menu block, no URL key, no badge count, no
    filter logic, and no "Statement" tag in the ⓘ tags row (the tags mirror the menu attributes). `dim_kpi.statement`
    stays in the data contract and the manifest.
14. **ⓘ target line** (USER 2026-10-29), not in v5: see Rendering above. The ⓘ footer is gone (note in the tags row).
15. **Horizon attribute removed** (USER 2026-10-29), like Statement; `dim_kpi.horizon` stays in the manifest.
16. **Period model** (ADR-0013 (k)): granularity picker, item-driven header and How-to-read title ("Nordmark · Month 10"),
    bars per granularity, Previous comparator; see Rendering above.

## Open items

- **Shared copy file (ADR-0013 (j) sync point 1):** `lib/engine/copy.ts` + `view.ts` are the TS source; the export to
  `docs/ADD/features/exec-info-popovers.md` is not written yet (this build kept to no shared files). The Power BI flavour
  must take the data-driven examples and the replaced stats of deviation 6, or parity will show them as gaps.
- **Parity rows** (`lib/test-utils/parity/`, `parity_selections_nordmark.csv`): phase 4, hunter.
- **Δ colour under LY / Previous**: the Δ text keeps the status colour (v5 CSS), so "+€2.2m vs LY" can read red on an Off-track
  card. Keep, or switch the Δ to muted ink when the comparator is not Budget?
- **Data README story text** says NL 93.4 % vs BE 95.0 % availability; the control totals give 93.5 % / 94.9 %.
- **Scoped EBITDA** is a contribution before central costs with no copy note (data README open point 15).
- **Not verified:** screen-reader behaviour of `inert`, backdrop-filter outside Chromium, a real 1440 × 810 window with
  browser chrome. No CI job for `js-exec/` yet. No `.sync` pack yet (ADR-0014; the pack ships `public/data` prebuilt and the
  control totals under `fixtures/checks/`, which `lib/test-utils/exec-data.ts` already reads as a fallback).

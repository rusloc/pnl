# Nordmark Retail — Executive dashboard: Requirements (E-nn) and acceptance tests (ET-nn)

> **DRAFT — projection state.** Written 2026-10-28 by archi with ADR-0013 (Accepted 2026-10-28: every **[OQ n]** resolved to its bold default; calendar Jan-anchored 4-5-4, grain week × store × category, literal v5 dot rule). Derived from the USER spec `docs/specs/2026-10-24-executive-dashboard-consumer-goods-reseller-spec.md` and the approved design target, prototype v5 (`docs/design/executive dashboard (reseller)/prototype.html` + `README.md`). Where the spec and the house rules differ, ADR-0012 (visual first) and v5 win; the spec stays the KPI catalogue. Items marked **[OQ n]** depend on ADR-0013 §5 open question *n*. Nothing in this note touches the ACME Unified P&L or Mirelo.

Requirement IDs `E-nn` are the contract for the generator, the PBI flavour and the JS flavour; cite them in code comments, tests and commit messages. Acceptance tests `ET-nn` are the shared gauntlet: a card is "implemented" only when both flavours pass every ET that names it.

## 1. Scope and company

- E-01 One landing page for **Nordmark Retail**, a fictional reseller: 142 stores in three formats (hyper, super, convenience) in NL and BE, one online site, one wholesale desk; 9 categories; ≈ 1,100 suppliers; EUR only, no FX layer; all data generated and illustrative.
- E-02 Two flavours, same page: a **Power BI report** (PBIP in `pbi-report/Nordmark Exec/`) and a **standalone Next.js app** (`js-exec/`, [OQ 4] for the name). No Rayfin flavour. Both read the same generated Parquet (E-70) and reconcile to the same control totals (ET-01).
- E-03 Twelve landing cards (spec ★ rows 1, 2, 5, 8, 9, 10, 14, 15, 16, 17, 20, 25), fixed positions and sizes (E-50); the 20 bench KPIs appear by name and definition only, in the More-KPIs drawer (E-58).
- E-04 Out of scope for this build: drill pages, board-export page, SKU grain, Forecast comparator [OQ 6], RLS / OLS and audiences, refresh scheduling, mobile beyond E-61, AI chat.
- E-05 As-of: actuals complete through **Sunday 25 Oct 2026** (FY2026 Week 43); the header stamp reads "Refreshed Mon 26 Oct 05:12" and is data (manifest / parameter row), not a literal in the UI.

## 2. Retail calendar and windows

- E-10 4-5-4 retail calendar, weeks Mon–Sun, 13-week quarters, periods 4-5-4; **FY = 52 weeks starting on the Monday of the week that contains 1 January** [OQ 2]: FY2025 = 30 Dec 2024 – 28 Dec 2025, FY2026 = 29 Dec 2025 – 27 Dec 2026.
- E-11 **Week 43 of FY2026 = 19–25 Oct 2026 = Period 10 week 4 of 4; Period 10 = 28 Sep – 25 Oct 2026; YTD FY2026 = 29 Dec 2025 – 25 Oct 2026** (43 weeks). The v5 YTD label "2 Feb–25 Oct" is to be corrected in the prototype [OQ 2].
- E-12 Every last-year comparison joins on `dim_week.ly_week_key` (FY2026 Wn ↔ FY2025 Wn), never on calendar dates; FY2026 W43 ↔ FY2025 W43 = 20–26 Oct 2025. Last-week comparisons use `lw_week_key`.
- E-13 Period switcher: **Week** (W43) · **Period to date** (P10 = W40–W43) · **Year to date** (W1–W43). Flow metrics sum over the window; point-in-time metrics (Weeks of cover, Availability, GMROI, Sell-through, Channel mix shares) take the window's last week; the header line names the window with its dates.
- E-14 Comparator switcher: **Budget** (default) · **Last year** (same retail week, E-12) · **Last week** [OQ 6 for Forecast]. The Δ row of every card follows the comparator; the status chip does not (E-24).
- E-15 Region / format switcher: **All** · **Netherlands** · **Belgium** · **Online only** — single-select, filters every card's numbers and the header label; the overall dot ignores it (E-26).
- E-16 Season for Sell-through: `AW26` = FY2026 W32–W51 (20 weeks); Week 43 = season week 12 of 20.

## 3. Cards and status model

- E-20 Card face = title · basis sub-title (hero and medium only) · value · one Δ row vs the comparator · status chip (word + glyph; glyph-only on small cards with the word in tooltip / `aria-label`) · 13-week bars with a dotted target line (none on Channel mix) · ⓘ button · drill-path button. Nothing else on the face (ADR-0012 §2.3).
- E-21 Status ∈ {On track, Watch, Off track, N/A}; glyph ▲ / ● / ▼ always with the colour (N-07 analogue: never colour alone).
- E-22 Status rules per card, from `param_status_rule` (one table / module per flavour, E-75), exactly v5:

| Card | Basis | On track | Watch | Off track | Direction |
|---|---|---|---|---|---|
| Net sales | vs Budget | ≥ 0 % | −3 % … < 0 % | < −3 % | ↑ |
| Total margin % | vs Budget | ≥ 0 pp | −1.0 … < 0 pp | < −1.0 pp | ↑ |
| Weeks of cover | vs target 9.5 wks | within ±1 wk | 1–2 wks away | beyond 2 wks | band |
| Markdown % of gross | vs Budget | ≤ 0 pp | > 0 … +1.0 pp | > +1.0 pp | ↓ |
| Availability % | vs target 97 % | ≥ 97 % | 95 … < 97 % | < 95 % | ↑ |
| EBITDA flash | vs Budget | ≥ 0 % | −5 % … < 0 % | < −5 % | ↑ |
| LFL growth % | vs Budget LFL | ≥ 0 pp | −2 … < 0 pp | < −2 pp | ↑ |
| Front GM % | vs Budget | ≥ 0 pp | −1.0 … < 0 pp | < −1.0 pp | ↑ |
| Sell-through % | vs season target 62 % | ≥ 0 pp | −5 … < 0 pp | < −5 pp | ↑ |
| GMROI | vs target 2.5× | ≥ 2.5× | 2.0 … < 2.5× | < 2.0× | ↑ |
| Supplier OTIF % | vs target 95 % | ≥ 95 % | 92 … < 95 % | < 92 % | ↑ |
| Channel mix | vs plan mix per channel | every channel within ±2 pp | 2–3 pp away (worst channel) | beyond 3 pp | band |

- E-23 Boundary convention: "Watch when −3 % to 0 %" means `−3 % ≤ Δ < 0`; a Δ of exactly 0 is On track; a Δ of exactly the off-track edge is Off track. Band rules take the absolute distance.
- E-24 **Status is always evaluated vs Budget / target** [OQ 9], whatever the comparator switcher shows in the Δ row; N/A when the input is blank.
- E-25 Status line: three count pills "▲ n on track · ● n watch · ▼ n off track" over the 12 cards; the counts ignore the attribute filters (E-56) but follow the period and region switchers.
- E-26 **Overall-status dot** (14 px, pulse ring; static under `prefers-reduced-motion`; static in Power BI): over all 12 cards, attribute filters ignored, constants `redOff = 1/3`, `orangeWatchOff = 0.5`, `greenGood = 2/3`: red if off ≥ 1/3; else orange if (watch + off) > 50 %; else green if on-track ≥ 2/3; else orange. **Week 43 story 7 / 3 / 2 → orange** (USER 2026-10-28). Tooltip states the rule and the shares. [OQ 5: whether one off-track card may ever read green.]
- E-27 Provisional: Total margin % and EBITDA flash carry "prov." in the title and "Provisional · true-up 10 Nov" / "Provisional · weekly flash" in their ⓘ footer; `dim_kpi.is_provisional` drives it, not copy.
- E-28 Card wash: On track plain white (1 px `#E5E7EB` border); Watch `linear-gradient(90deg, #FFFFFF, rgba(255,211,160,.5))`; Off track `rgba(243,201,197,.5)` wash + 2 px `#C0272D` border, same outer size as siblings. Status text good `#136C3A` · watch `#9A5B00` · off `#C0272D`; dot green `#2E9E5B` · orange `#E3A52A` · red `#B3261E`. Power BI: solid equivalents of the composites (#FFE9D0, #F9E4E2).
- E-29 13-week bars: weeks W31–W43 (window's last 13 weeks), current week in the status colour, dotted target at the Budget / target value, bottom-aligned at the right, hero 260 × 92 px, medium 180 × 62, small 88 × 58 (SVG image measures in Power BI).

## 4. Metric definitions (binding for the generator and both flavours)

All amounts EUR, ex-VAT. "Window" = the selected period (E-13); "scope" = the selected region / format (E-15). Week-43 ALL values in brackets are the v5 story and the control-total anchors (ET-02).

- E-30 **Net sales** = Σ gross sales at ticket − Σ markdown value − Σ returns (`fact_sales_week`). [€61.4 m; Budget €62.9 m; Δ −€1.5 m / −2.4 %; Watch]
- E-31 **Like-for-like growth %** = Net sales of LFL stores in the window ÷ the same stores' Net sales in the LY window (E-12) − 1. LFL store = `open_date` ≥ 13 months before the window's first day, not closed, not refitted in the last 13 months; evaluated per period (monthly in the spec; per retail period here). Budget LFL from `fact_budget_week.lfl_growth_bud`. [+3.4 %; 131 of 142 stores; Budget 3.0 %; On track]
- E-32 **Front gross margin %** = (Net sales − Σ COGS at standard landed cost) ÷ Net sales. [30.1 %; COGS €42.9 m; front margin €18.5 m; Budget 30.0 %; On track]
- E-33 **Back margin €** = Σ `fact_sales_week.back_margin_alloc` over the window and scope. The generator accrues back margin per week × supplier (`fact_supplier_income_week`: `rebate_accrual` + `promo_funding` + `listing_fees`, contract-rate × qualifying purchases, provisional until the 10 Nov true-up) and allocates it to store × category by COGS share (residual to the largest cell), so every scope reconciles and Σ ALL equals Σ supplier accruals (ET-07). **Total margin %** = (front margin € + back margin €) ÷ Net sales. [back €3.8 m = 6.2 %; total 36.3 %; Budget 36.2 %; On track, prov.]
- E-34 **Markdown % of gross sales** = Σ markdown value ÷ Σ gross sales at ticket; markdown never enters the margin twice. [9.8 %; €6.7 m ÷ €68.4 m; Budget 8.5 %; Off track]
- E-35 **Weeks of cover (forward)** = (Σ on-hand cost + Σ on-order cost at the window's last week-end, scope's locations) ÷ forecast weekly COGS (`fact_forecast_week`, fallback: R4W average COGS when the forecast is blank). Target = cost-weighted average of `dim_category.cover_target_wks` = 9.5. [11.4 wks; €402 m + €88 m = €490 m ÷ €43.0 m; Watch]
- E-36 **Availability %** = Σ `in_stock_sku_days` ÷ Σ `ranged_sku_days` over the window's last week (top-500 sellers, sales-weighted counts pre-computed by the generator). [94.1 %; 467,700 ÷ 497,000; target 97 %; Off track]
- E-37 **Sell-through %** = units sold season-to-date ÷ (season opening stock units + receipts season-to-date), season per E-16. [63.1 %; target 62 %; On track]
- E-38 **GMROI** = front gross margin € over the trailing 52 weeks ÷ average on-hand cost over the 52 week-end snapshots (on-order and in-transit excluded) [OQ 11]. [2.7×; €1,016 m ÷ €376 m; target 2.5×; On track]
- E-39 **Supplier OTIF %** = Σ `po_lines_otif` ÷ Σ `po_lines_due` over the window. [95.4 %; target 95 %; On track]
- E-40 **EBITDA flash** = Total margin € − Σ shrink − Σ store OpEx − Σ central OpEx − Σ fulfilment (`fact_opex_week`, scenario ACT; Budget = scenario BUD); margin % = ÷ Net sales. Shown for the **period to date** on the card whatever the period switcher says (basis sub-title "period 10 to date"); the bars are weekly EBITDA. [€15.3 m = 6.3 %; €87.7 − 2.2 − 52.4 − 11.6 − 6.2; Budget €16.1 m = 6.6 %; Watch, prov.]
- E-41 **Channel mix** = Net sales share by channel (Store / Online / Wholesale) in the window; plan mix = Budget Net sales shares; value shows the store share, the Δ row the largest absolute channel deviation. [68.4 / 19.9 / 11.7 vs plan 70.0 / 18.0 / 12.0; online +1.9 pp; On track]
- E-42 Rounding only at display: values as in v5 (`€61.4m`, `36.3%`, `11.4 wks`, `2.7×`, `+3.4%`); Δ rows signed, pp for ratio metrics, % for amounts; engine and measures carry full precision.

## 5. Layout and interaction (v5 is the reference implementation)

- E-50 Canvas 1440 × 810 (Power BI page size; JS app design width); 56 px side bar + 1336 px content, 6-column grid, 12 px gaps; 3 hero cards (span 2, 437 × 236), 3 medium (span 2, 437 × 176), 6 small (span 1, 213 × 168); card order exactly the v5 size map (Net sales · Total margin % · Weeks of cover / Markdown · Availability · EBITDA flash / LFL · Front GM · Sell-through · GMROI · OTIF · Channel mix); grid bottom ≤ 761 px, no page scroll at 1440 × 810. Cards never re-sort by severity (ADR-0012 §2.7; spec sentence not applied).
- E-51 Header: title "Nordmark · Week 43" (period-driven), one grey context line "period · comparator · region", refresh stamp (E-05). No banner, no intro, no footer (ADR-0012 §2.2).
- E-52 Side bar buttons: Filters (funnel, badge = active attribute picks), How to read (?), More KPIs (grid +), Notes (document); each `aria-expanded`; one layer open at a time; Esc, scrim click and × close; focus trapped and returned.
- E-53 Filters menu: 360 px frosted panel from the left with the three switchers (E-13…E-15, single-select) and five multi-select attribute groups — Group (B1 base-crucial · B2 margin & cost · B3 stock & supply · B4 channel & customer), Lever (sales · margin · stock · supply · cash), Horizon (week · month · quarter), Owner (commercial · supply chain · finance · digital), Statement (P&L · balance sheet · operational) — attribute values per card from `dim_kpi` (v5 metric table); Reset; Close.
- E-54 Attribute semantics: within one attribute OR, across attributes AND; a card stays revealed only if, for every attribute with a selection, its value is selected.
- E-55 Conceal in place: a filtered-out card keeps its slot (opacity 0.08, grayscale, `pointer-events: none`, `inert`, `aria-hidden`); card rectangles identical before / after / after Reset. Power BI: the same slots with a "concealed" visual state (bookmark per attribute group) — accepted platform approximation, documented in parity-rules.md.
- E-56 Status line summary "n of 12 metrics · picks" updates with the attribute filters; counts (E-25) and the dot (E-26) do not.
- E-57 ⓘ pop-up per card (frosted, centred): value, Δ, labelled 13-week chart, 3 mini stats, What it is / Why it matters / Formula / Worked example / Status rule / Owner note, tags, footer (target, refresh or provisional note), a pill to the drill path. Copy from one shared source (`docs/ADD/features/exec-info-popovers.md`, exported from the JS source), identical in both flavours.
- E-58 Drill-path pop-up per card (binoculars button, tooltip "Drill path"): the drill page name and 3–4 steps to the lowest grain, text only (no drill pages built); pill back to the ⓘ. More-KPIs drawer (460 px, right): the 20 bench KPIs by domain with formula and owner · cadence. Notes pop-up: status-rule table, margin logic, data contract. How-to-read pop-up: the six v5 bullets.
- E-59 Pop-up style per ADR-0012 §2.5 (≈ 60–65 % white, blur 18–22 px, 16 px radius, `@supports not (backdrop-filter)` → 92 % white); Power BI: solid panels with the same border / radius.
- E-60 Typography: Inter (JS, self-hosted via `next/font`; Segoe UI in Power BI); hero value 44 px / medium 30 / small 26, tabular figures; ink `#111827`, muted `#5F6878`; cobalt accent only on active chips and focus rings; every text ≥ 4.5 : 1 on its wash (v5 contrast table).
- E-61 JS app responsive: below 1200 px two columns, every card span 1, bars at 38 % width; below 720 px one column; no horizontal scroll at 1000 px. Power BI: `FitToPage` only (accepted difference).
- E-62 JS app URL state: period, comparator, region and attribute picks in the query string, validated with Zod at the boundary before reaching the engine (F-37 analogue); unknown keys ignored, invalid values fall back to defaults.

## 6. Data and generator

- E-70 `data/nordmark_retail_dummy_data/`: `generator/generate.py` (Python 3.12, numpy / pandas / pyarrow pinned as Mirelo, **seed 20261028**, byte-identical output per seed, `--out`), `dims/`, `facts/`, `params/` CSV, `parquet/` (one file per table + `manifest.json`), `checks/control_totals_eur.csv`, `checks/verify.py` (independent recomputation, exit 1 on failure), `README.md` (columns, relationships, rules — the contract both flavours build against).
- E-71 Tables and grains as ADR-0013 (d): `dim_week`, `dim_date`, `dim_store`, `dim_category`, `dim_supplier`, `dim_cost_type`, `dim_kpi`; `fact_sales_week` (week × store × category) [OQ 3], `fact_budget_week`, `fact_supplier_income_week` (week × supplier), `fact_inventory_week` (week-end × location × category), `fact_forecast_week`, `fact_availability_week`, `fact_receipts_week`, `fact_po_week`, `fact_opex_week` (× scenario); `param_status_rule`, `param_target`. Naming: `snake_case`, spec §8 prefixes (`fact_`, `dim_`, `param_`), singular.
- E-72 Span: actuals FY2025 W1 … FY2026 W43 (95 weeks, `dim_week.is_actual`); Budget FY2026 W1–W52; `dim_week` through FY2026 W52.
- E-73 Story-first generation: ALL-scope weekly totals of every card input are fixed from the story series and allocated to store × category cells by stable shares + seeded noise; each week's rounding residual goes to the largest cell. Week-43 ALL values equal E-30…E-41 at display precision by construction; W31–W42 follow the v5 bar shapes.
- E-74 Three store closures in FY2026 and ≥ 11 non-LFL stores at Week 43 (131 LFL of 142); one Electronics category with GMROI < target (1.9×) and two Electronics suppliers below 85 % OTIF, so the ⓘ owner notes are true of the data.
- E-75 `param_status_rule` holds every E-22 rule and the three dot constants (E-26); neither flavour hard-codes a threshold outside its single status module / measure set.
- E-76 Control totals (`checks/control_totals_eur.csv`, columns `scope, period_key, metric_code, value`): scopes ALL / NL / BE / ONLINE; periods every week W-FY2026-31 … 43, P-FY2026-10, YTD-FY2026, plus the LY and LW keys of each; metrics = the 12 card values, every input quoted in E-30…E-41, every Budget value, each card's status code, the three counts and `overall.dot`.
- E-77 Amount columns: 2 decimals in CSV; Parquet DOUBLE; model as Decimal Number (double), never Fixed Decimal. Booleans `TRUE` / `FALSE`; dates ISO; `week_key` text `FY2026-W43`.
- E-78 No SKU dimension, no receipt / PO-line / GL-line facts in this build; the generator README states which drill-path steps have no data behind them.

## 7. Flavours, portability, non-functional

- E-80 **No Fabric / workspace / tenant dependency at runtime** in either flavour: PBI model imports `parquet/` through a `DataFolder` parameter (absolute repo path as default, documented in the PBIP README); the JS app reads static files under its own `public/data/` built from the same folder. No IDs, connections or tokens in the pack.
- E-81 JS app = standalone Next.js 16 (App Router), TypeScript strict, Zod, Vitest, `hyparquet`; engine in `lib/exec/` framework-free and the single source of every number; components carry no business logic; dependency versions pinned identically to `js-report/`; new dependencies only with USER consent.
- E-82 JS app headers and threat model per ADR-0002 §2.6 (CSP with `frame-ancestors` from `EMBED_ALLOWED_ORIGINS`, no `X-Frame-Options`, no third-party scripts / fonts / analytics, query string the only untrusted input, `NEXT_PUBLIC_SITE_URL` as the runtime hook, no hard-coded domain).
- E-83 JS data budget: first paint ≤ 600 kB, total ≤ 3 MB (build fails above 4 MB), one base cube (week × country × format × channel × category × is_lfl) plus small tables; stores never ship.
- E-84 Performance: JS — a switcher change re-renders all 12 cards in < 100 ms on the shipped data, LCP within the P&L's N-01 budget; PBI — page cold load and each switcher change within the ADR-0008 per-view budget, measured and recorded in the PBIP README on the first build.
- E-85 Accessibility: keyboard reaches every button, chip and pop-up; focus visible; tooltips on focus; status never by colour alone (E-21); `aria-label` on glyph-only chips; reduced-motion respected.
- E-86 Pack for the vosk.dev repo: `.sync/{date}-nordmark-handoff.md` (from / to / date / status header, index, embed notes 1440 × 810, env-var names without values) + copies of `pbi-report/Nordmark Exec/`, `data/nordmark_retail_dummy_data/parquet/` and `js-exec/` (without `node_modules`, with the built `public/data/`); `.sync/README.md` row.
- E-87 Platform differences allowed and listed in `docs/design/parity-rules.md`: solid vs frosted panels, static vs pulsing dot, `FitToPage` vs responsive, Segoe UI vs Inter, bookmark-state vs CSS concealment. Any other visible difference is a parity gap.
- E-88 Copy: card titles, sub-titles, chip words, Δ texts, ⓘ / drill / How-to-read / Notes / drawer copy identical across flavours, sourced from E-57's shared file; ≤ 6-word card notes only; no explanatory bars, strips or footers.

## 8. Acceptance tests (ET-nn)

Shared gauntlet; "both flavours" = the PBI DAX tests in `pbi-report/Nordmark Exec/tests/control-totals.dax` and the JS Vitest suite in `js-exec/`, plus the cross-flavour parity rows `parity_selections_nordmark.csv` (hunter). Checks run on the generated data of E-70.

- [ ] ET-01 **Control-total reconciliation:** for every row of `checks/control_totals_eur.csv` (scope × period × metric) both flavours return the value within 0.005 for amounts and 1e-6 for ratios; `verify.py` exits 0 on the written CSV / Parquet.
- [ ] ET-02 Week 43 · ALL · Budget reads exactly the v5 story on every card: values, Δ texts and chips of E-30…E-41; counts 7 / 3 / 2.
- [ ] ET-03 Overall dot = **orange** for Week 43 (E-26); the control-total `overall.dot` matches in both flavours for every period × region selection; the dot and counts do not change under any attribute filter.
- [ ] ET-04 Calendar: `dim_week` has 104 rows FY2025 W1 … FY2026 W52; FY2026 W43 = 19–25 Oct 2026, P10 = W40–W43, `ly_week_key(FY2026-W43) = FY2025-W43` (20–26 Oct 2025), `lw_week_key = FY2026-W42`; no 53-week year; `verify.py` recomputes every key from dates.
- [ ] ET-05 LY comparison uses the week key: for a week whose LY calendar dates fall in a different retail week, the LY value equals the key-joined week, not the date-joined one (one such week asserted explicitly).
- [ ] ET-06 LFL: the LFL store set at Week 43 has 131 stores; LFL growth filters both current and LY sides to that set; LFL + non-LFL effect reconciles to total growth within rounding (ⓘ "Non-LFL effect −1.2 pp").
- [ ] ET-07 Margin arithmetic: front margin + back margin = total margin €; markdown is excluded from the margin sum; Total margin % and Front GM % ⓘ worked examples equal the data at display precision.
- [ ] ET-08 Weeks of cover = (on-hand + on-order) ÷ forecast COGS with the R4W fallback when the forecast is blank (one category blanked in a test fixture); the target equals the cost-weighted category average 9.5.
- [ ] ET-09 Point-in-time vs flow: under Period to date and Year to date, Net sales / Markdown / OTIF / LFL sum over the window while Weeks of cover / Availability / GMROI / Sell-through / Channel mix equal the last week's value; EBITDA flash shows period-to-date whatever the switcher.
- [ ] ET-10 Status rules: a fixture per card at the Watch edge, inside Watch and at the Off-track edge yields On track / Watch / Off track per E-22 / E-23 in both flavours; Markdown (↓) inverts; band rules (cover, mix) use absolute distance.
- [ ] ET-11 Status basis: switching the comparator to Last year or Last week changes every Δ row and no status chip [OQ 9].
- [ ] ET-12 Region / format switcher: NL + BE Net sales + Online + Wholesale = ALL for every week; "Online only" shows Channel mix 100 / 0 / 0 (or N/A per E-21) and conceals nothing.
- [ ] ET-13 Conceal in place: with Group = B3 selected, exactly the 8 non-B3 cards are concealed, card rectangles are identical before / after / after Reset, and the summary reads "4 of 12 metrics · 1 pick"; filters OR within an attribute and AND across (one two-attribute fixture).
- [ ] ET-14 Fold and layout: JS at 1440 × 810 — grid bottom ≤ 761 px, no page scroll, card sizes per E-50, bars per E-29, Off-track cards the same outer height as siblings; PBI — validator 0 / 0 and the same card rectangles in the PBIR.
- [ ] ET-15 Pop-ups: for every card the ⓘ and drill pop-ups open, one layer at a time, Esc / scrim / × close with focus returned, Tab trapped; How to read, Notes and More KPIs likewise; the 20 bench KPIs are listed by domain.
- [ ] ET-16 Copy parity: every card title, sub-title, chip word, Δ text and ⓘ paragraph is byte-identical between the shared copy file and both flavours (export test fails when stale).
- [ ] ET-17 Contrast and a11y: ink, muted and status text ≥ 4.5 : 1 on each wash (E-28); every interactive element keyboard-reachable with a visible focus ring; chips carry `aria-label`; `prefers-reduced-motion` stops the pulse.
- [ ] ET-18 Portability: the JS app builds from a clean clone with `npm ci && npm run build` using only `data/nordmark_retail_dummy_data/parquet/` (or the shipped `public/data/`), no env var required for a local build; the PBIP refreshes after changing only the `DataFolder` parameter on another machine; the pack contains no IDs, keys or connection strings.
- [ ] ET-19 Data budget and timing: shipped JS data within E-83; PBI and JS timings within E-84, recorded.
- [ ] ET-20 Determinism: running `generate.py` twice with seed 20261028 produces byte-identical CSV and Parquet; `verify.py` passes; row counts match `manifest.json`.

# ADR-0011 — Mirelo Sales & Revenue dashboard: draft build in two tracks (Power BI + JS)

- **Status:** **Accepted** 2026-10-27 — the USER accepted every default in §2 and §5 ("all decision forks: accept defaults"); drafts built 2026-10-26/27 in both tracks. Amended by ADR-0012 (visual first: no applied-filters banner, no card corner marker, no in-card sparklines). Originally proposed 2026-10-26 by the design agent for the main agent.
- **Date:** 2026-10-26
- **Decider:** USER
- **Inputs:** concept `docs/ADD/features/sales-revenue-dashboard-concept.md` (§1–§8 and the §9 addendum of 2026-10-24) · metric map `docs/design/sales-revenue dashboard/metric-flow.html` (accepted by the USER for a draft build) · USER directives of 2026-10-26 (flat design after the supplied reference sheet, one page = many views, two tracks that look identical) · precedents ADR-0002 (Track C architecture), ADR-0003 / ADR-0008 (lakehouse loader), the `pbi-report/ACME Trucks/` report (PBIP importing Parquet files through a `DataFolder` parameter).
- **Design contract produced with this ADR:** `docs/design/sales-revenue dashboard/design-tokens.md` · `layout-spec.md` · `mockup.html` (the previous mockup kept as `mockup-v1-2026-10-24.html`).
- **Spec:** none yet. The S-nn requirement note proposed in the concept (§6.1) follows acceptance of this ADR. Nothing here touches the ACME Unified P&L, its spec, data, model or tracks.

## 1. Context

"Mirelo" is a fictional app-first neobank and microlender (Poland, Romania, Portugal; EUR reporting). The concept and its addendum fix four Tier-1 metrics — **Loans issued**, **New clients locked in**, **Returning clients %**, **Bad / overdue loans %** — and five views (Overview · Loans issued · Clients · Portfolio quality · Revenue & targets). The USER accepted the metric map for a **draft build** and asked for:

- a **flat design** after a reference sheet (warm light greys, dark corner markers on cards, a yellow header wedge, very large black numbers, black + teal line series) — explicitly *not* the P&L's "Ledger" look;
- **one page with a view switcher**: header (title, period, market, comparator) stays, tabs swap the content;
- **two tracks that look identical**: a Power BI report (PBIR) and a custom JS/React app (Next.js);
- a data generator, built in parallel by another agent at `data/mirelo_sales_dummy_data/` (tables `dim_date`, `dim_market`, `dim_product`, `dim_channel`, `dim_agent`, `dim_client`, `fact_application`, `fact_loan`, `fact_loan_month`, `fact_subscription_month`, `fact_revenue_month`, `fact_target`, `param_fx`, `param_thresholds`).

The concept's §6 outline assumed three tracks, a lakehouse schema, and the P&L's design system. Seven decisions below replace those assumptions for the draft. Each records the **default** and the alternatives; the USER may overturn any of them.

## 2. Decisions

### (a) Data home for the draft = local Parquet files, read by both tracks

**Default:** the generator writes CSVs and a Parquet copy of every table to `data/mirelo_sales_dummy_data/parquet/<table>.parquet` (one file per table, same names). Track B imports those files through Power Query; Track C's build step reads them (pre-aggregating where ADR-0002 would). No Fabric item is created for the draft.

**Later (not part of the draft):** schema `mirelo_sales` in `lh_raw`, loaded by a `fabric-data/lh_raw/load_mirelo_sales.py` that follows `load_acme_pl.py` (ADR-0003 types, ADR-0008 pre-translated `amount_eur/pln/ron` columns); the Power BI model then switches its source from the Parquet folder to the SQL endpoint by changing the Power Query parameters only.

**Alternatives:** (1) lakehouse first, as the concept proposed — rejected for the draft: it needs ginee's load, a cloud connection and a refresh cycle before the first pixel; the draft is about layout and parity. (2) CSV straight into Power Query — Parquet is typed, smaller (≈ 1 M `fact_loan` rows) and already what Track C loads; the Trucks report proves the PBIP-Parquet path.

### (b) Power BI draft = its own PBIP in `pbi-report/Mirelo Sales/`

**Default:** `pbi-report/Mirelo Sales/Mirelo Sales.pbip` with `Mirelo Sales.SemanticModel` (TMDL, Import) and `Mirelo Sales.Report` (PBIR, one page `sales_one_pager` 1440 × 810, bookmarks per view, two hidden drill-through pages `loan_detail` / `client_detail`), `tests/control-totals.dax`. Source pattern copied from `pbi-report/ACME Trucks/Trucks.SemanticModel`: a `DataFolder` text parameter (`expressions.tmdl`) and per-table partitions `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` with explicit `Table.TransformColumnTypes`. `DataFolder` defaults to the repo path of `data/mirelo_sales_dummy_data/parquet`; the lakehouse switch of (a) later replaces the partition sources with the `SqlEndpoint` / `Database` parameter pattern of the P&L model.

**Alternatives:** (1) a second page inside the P&L PBIP — rejected: different model, different design system, different refresh; it would also put the Mirelo tables into the P&L model. (2) Direct Lake on a lakehouse — needs (a)'s later step first.

### (c) JS draft = route `/sales` inside `js-report/`

**Default:** `js-report/app/sales/` (App Router route) with its own engine `js-report/lib/sales/` (modules `windows.ts`, `fx.ts`, `loans.ts`, `clients.ts`, `portfolio.ts`, `revenue.ts`, `kpis.ts`; Zod manifest), its own data build `js-report/scripts/build-sales-data.ts` → `public/data/sales/*.parquet` + `manifest.json`, reusing the Next.js tooling, the `hyparquet` loader (`lib/data/parquet-loader.ts`), Vitest and ESLint config. Loan-level files are loaded lazily per disbursement month on first drill (metric-flow §c). The P&L engine in `lib/engine/` is not imported by the sales engine (no shared business logic; time-window helpers may be copied, not linked, until a shared `lib/common/` is justified by a third consumer).

**Alternative:** a separate `js-sales/` app — one more Next.js install, CI job, lint config and hand-off; the only benefit is a separate deploy unit, which the vosk.dev repo does not need (it vendors routes). Rejected for the draft; revisit if the sales engine's bundle hurts the P&L route's LCP.

### (d) No Track A (Rayfin) for the draft

**Default:** the Fabric app is not extended for Mirelo. Reasons: the draft has no Fabric data item (a), the USER asked for two tracks, and the Rayfin shell is tied to the P&L's design system. The concept's §6.3 (route `/sales` in the existing app) stays on file as the later option, together with the lakehouse step of (a).

**Alternative:** build A in parallel on the semantic model of (b) — three tracks to keep identical while the design is still a draft; rejected.

### (e) Flat design system, separate from the P&L "Ledger" system

**Default:** the Mirelo report uses the **"Flat Ledger"** system defined in `design-tokens.md`: ground `#F3F2EF`, panel `#E9E8E4`, marker `#2F2F2D`, ink `#111111`, accent yellow `#FFD54A`, series teal `#128C94`, grey-400 `#7F7E79` for prior year, status good / watch / off `#176B3D` / `#8A5A00` / `#B3261E` (all ≥ 4.5 : 1 on the panel), **Inter** on the web with **Segoe UI** as the Power BI equivalent, 44 px / 800 display numbers, square corners, no shadows, no borders, 16 × 16 corner markers, a yellow header wedge. **Mirelo mulberry `#9B2360` is dropped from the frame** — it would be a second accent next to the yellow and a fourth series colour next to black / teal / grey; it is reserved for the vosk.dev showcase thumbnail. If the USER wants it inside, the only allowed place is the 24 × 24 brand square.

Copy rules shared with the house stay (parity-rules.md rules 6, 7, 13, 15). `docs/design/design-requirements.md`, `kpi-card-v2.md`, `period-picker-v2.md` do **not** apply to Mirelo.

**Alternative:** reuse the Ledger system with the mulberry identity (the 2026-10-24 mockup) — rejected by the USER's directive.

### (f) Business scale ×0.6 of the concept cap

**Default:** the generator targets ≈ 0.6 × the concept's volumes: ≈ 630 k loans in `fact_loan` (Jan 2024 – Sep 2026), ≈ 290 k clients, ≈ 25 k loans a month in 2026, so the loan-grain table stays well under the 1.5 M-row cap with the monthly snapshot `fact_loan_month` beside it, the Parquet for Track C stays small, and a future Import refresh stays under the P&L's 28 s baseline. The story ratios (returning 52.4 %, 30+ DPD 4.6 %, Romania −12 % vs Budget, Portugal +11 %) are unchanged; absolute numbers scale (mockup: Sep 2026 = 25.6 k loans, €10.2 m principal, 10.8 k new clients).

**Alternative:** accept 1.05 M loans (metric-flow Q4 default) — fine for Power BI Import, heavier for the lazy loan files of Track C and for the generator's run time; the USER chose ×0.6.

### (g) Tier-1 definitions as in metric-flow §a

**Default, binding for both tracks and the generator's control totals:**
1. **Loans issued** = count of `fact_loan` rows with `disbursed_date` in the window; principal = Σ `principal_local` ÷ `param_fx` rate of the loan's month × currency (actual rates).
2. **New clients locked in** = clients whose **first loan was disbursed** in the window (Σ `fact_loan.is_first_loan`; `dim_client.first_loan_date`). Not first approval, not first account.
3. **Returning clients %** = **client-weighted**: distinct borrowers in the window with ≥ 1 prior repaid or current loan ÷ distinct borrowers; loan-weighted repeat share (57.8 %) is the sub-line. A prior written-off loan does not count as "returning".
4. **Bad / overdue loans %** = **30+ DPD by balance** at the last closed month of the window (`fact_loan_month`); sub-lines 90+ DPD %, 30+ by count, vintage 6-month bad rate; direction ↓.

Window rules: sums over days / months in the window for flow metrics; period-end metrics take the anchor month; ratios compare in pp; translation at month × currency grain, never on totals (ADR-0002 §1 analogue).

**Alternatives** (recorded in metric-flow §e Q1–Q3): loan-weighted returning % on top; first approval as "locked in"; 90+ DPD or vintage bad rate as the headline. All rejected for the reasons stated there.

### Layout and interaction (recorded, not a numbered decision)

One page, header fixed, five tabs; Overview = four hero cards (332 × 192, the largest cards) over a 2 × 2 "why" grid and a market table; views 2–5 = six KPI cards (216 × 120) over a 2 × 3 or 2 × 2 grid and a detail table; row click opens a 720 px slide-over at loan / client grain (Track B: drill-through pages). Defaults: All markets · Month · Sep 2026 · Budget · Overview. Exact px in `layout-spec.md`.

## 3. Consequences

- **New artefacts:** `pbi-report/Mirelo Sales/` (PBIP), `js-report/app/sales/` + `lib/sales/` + `scripts/build-sales-data.ts` + `public/data/sales/`, `docs/model/sales-measure-dictionary.md` (bip), `docs/ADD/features/sales-info-popovers.md` (shared ⓘ copy), `.sync/` hand-off note for the vosk.dev repo (route `/sales`, embed size 1440 × 810, scale rule).
- **Parity gate:** both tracks reconcile the four Tier-1 values and the KPI-band values to `data/mirelo_sales_dummy_data/checks/` for every market × window; hunter extends the parity-selection harness with a Mirelo file. A view is "implemented" only when both tracks pass.
- **Not done in the draft:** lakehouse schema, Rayfin route, Display flyout (currency / units / FX basis), Versions flyout (Latest estimate), Slice flyout; the header carries market, period, comparator only. Copilot / chat: none.
- **Risk:** the generator is being built in parallel — column names in `layout-spec.md` (`is_first_loan`, `prior_loans`, `dpd_bucket`, `outstanding_local`, `vintage_month`, …) are the concept's names and must be checked against the generator's README before the models are written; the builders take the generator as the source of truth.
- **Power BI limitations accepted:** waterfall start bar colour, no native funnel, drill-through instead of overlay, `FitToPage` scaling, Segoe UI instead of Inter.

## 4. Alternatives considered (summary)

| Alternative | Why not |
|---|---|
| Lakehouse-first data home | Cloud load + connection + refresh before any layout work; the draft is a design and parity exercise |
| Mirelo as a page in the P&L PBIP | Mixes models and design systems; refresh and tests entangled |
| Separate `js-sales/` app | Duplicated tooling for no deploy benefit |
| Three tracks from the start | Three surfaces to keep identical while the design is still moving |
| Keep the Ledger system + mulberry | Contradicts the USER's flat-design directive |
| 1.05 M loans | Heavier generator and lazy loan files; ×0.6 keeps the story and halves the cost |

## 5. Open questions for the USER (default in bold)

1. Mulberry: **drop from the frame** (brand square is black), or keep it as the 24 × 24 brand square fill only?
2. Default window on open: **Month · Sep 2026** (the mockup), or YTD Sep 2026?
3. Web font: **Inter** (Segoe UI in Power BI), or a geometric alternative such as Manrope (wider digits, worse parity with Segoe UI)?
4. Pickers in the header show **market, period, comparator only**; the Display / Versions / Slice flyouts of the concept are out of the draft. Accept?
5. Slide-over: **720 px panel in the JS track, drill-through pages in Power BI** (accepted platform difference), or a 720 px "detail" bookmark state in Power BI as well (heavier page, same look)?
6. Parquet folder `data/mirelo_sales_dummy_data/parquet/` as the shared draft source: **yes** — confirm with the generator agent that it writes Parquet next to the CSVs (or Track C's build script converts).
7. Power BI `DataFolder` parameter default = **absolute repo path, as in Trucks** (Desktop needs an absolute path), documented in the PBIP README; builders on another machine change the parameter.
8. Scale ×0.6: **apply to volumes only** (loans, clients, revenue) and keep every ratio and the story milestones (Step 12 launch, RO policy change, PLN FX swing) unchanged?

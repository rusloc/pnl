# Features & decisions — ACME Unified P&L

Human-readable `idea → decisions → features` read-through of the ADR ledger (`docs/ADR/`). Updated daily in lockstep with `.log/daily/`.

TODO: lock North Star

## Ideas
- **2026-10-21 — One DAX truth for A + B:** the Rayfin app (A) reads the PBI semantic model (B) through a Rayfin connector instead of re-implementing the measures. To validate in ADR-0003.
- **2026-10-21 — Reconciliation gate:** every flavor's numbers are checked against `data/acme_pl_dummy_data/checks/control_totals_usd.csv` (T-06) in CI.
- **2026-10-21 — Track B engine redesign:** if incremental DAX fixes don't reach N-01 (2 s), restructure the P&L / KPI engine (calculation groups, fewer per-cell evaluations, no branchy SWITCH per row).
- **2026-10-21 — AI chat in the Rayfin app:** an LLM in a Rayfin function with allow-listed DAX tools run as the signed-in user through the delegated `pnlModel` connector, so RLS applies to answers. Goes on top of ADR-0006 once all views are live; a Fabric data agent is the Fabric-native alternative (but owner identity via UDF). ADR pending.
- **2026-10-21 — Public showcase access:** vosk.dev visitors can't sign in to the corporate tenant → recording / screenshots or demo accounts for Track A.

- **2026-10-22 — Physical speed-ups for Track B / A:** pre-translated amounts in the `lh_raw` loader (~−40 % per evaluation, cheap variant = one USD-actual column) and materialised elimination rows (~−22 %, needs an elimination entity or a `fact_pl_elim` table). Pending the N-01 decision.
- **2026-10-22 — Bridge start bar in the totals colour (Track B):** only via a stacked-column rebuild (~2.5× bridge cost); the native waterfall has no per-bar colour.
- **2026-10-22 — KPI trends may return:** `KPI Trend` (12 × 13 points in one query) stays in the model, unused, after the KPI card v2 decision.

- **2026-10-23 — Copilot for Power BI as a demo:** no anonymous Copilot (F2+, signed-in) → a recorded / signed-in demo with "Prep data for AI" (~3–3.5 d) later; Copilot-friendly measures need an ADR.
- **2026-10-23 — Shared parity check across A / B / C:** `parity_selections.csv` + expected copy / numbers, run in every track (hunter proposal).
- **2026-10-23 — Trucks time-structure table speed-up** (bottleneck of the original page; USER: keep as is for now) and a smaller P&L model variant (USD column only) if model memory matters.

- **2026-10-24 — P&L additions from the SaaS & consumer-goods spec** (`docs/ADD/features/pnl-spec-gap-analysis-2026-10-24.md`): tile sub-lines (P1), Price / Mix bridge split (P3), "of which FX" variances column (P4), statement memo block rows 30–34 (P2, ADR), Prior-period comparison (P5, parked); data: `fact_arr_snapshot` for ARR bridge / NRR / CAC (D-1, ADR), `fact_headcount` (D-5), cost-nature flags on `dim_account` (D-6), SBC accounts (D-7, ADR).
- **2026-10-24 — Mirelo Sales & Revenue dataset:** `fact_loan` (≈ 1.05 M) + `dim_client` + monthly vintage / DPD table; ×0.6 scale-down if the 1.5 M cap bites; Track A as a `/sales` route with a shared shell; schema `mirelo_sales` in `lh_raw`; identity colour mulberry `#9B2360`.
- **2026-10-24 — Reseller executive dashboard design alternatives:** "Trading sheet" (recommended), Departures board (dark, mono amber), Retail broadsheet (editorial serif), Fluent native.

- **2026-10-26 — "Largest variances" as the one Analysis panel worth expanding:** block grouping with collapsible subtotals, slice cut (Region · Sales motion · Service line · Segment) as stacked member segments, "of which FX" column (gap-analysis P4), vs PY, n.m., coverage — all from existing data (`docs/design/P&L views redesign/README.md`).
- **2026-10-26 — Executive-page status language:** card background washed white → pale status colour (50 % alpha), one pulsating overall-status dot computed over all cards regardless of filters, filtered-out cards concealed in place (no reflow). Reference: exec dashboard prototype v4.
- **2026-10-26 — Shared ⓘ copy file per report** (`docs/ADD/features/<report>-info-popovers.md`) so Track B and Track C pop-ups carry the same text.

## Decisions
- **2026-10-21** — Three tracks in one repo, one folder each: A Rayfin `fabric-app/`, B PBI `pbi-report/`, C JS `js-report/`. (ADR-0001)
- **2026-10-21** — This repo delivers assets only; vosk.dev embedding lives in a separate repo. (ADR-0001)
- **2026-10-21** — Single branch `prod`, no feature branches. (ADR-0001)
- **2026-10-21** — Stack defaults: C = Next.js on Vercel + pre-aggregated Parquet + DuckDB-wasm; A + B = one Fabric Lakehouse/Warehouse loaded from the CSVs; no dbt. (ADR-0001)
- **2026-10-21** — Orchestrated roster of 8 agents: bip, ginee, fin, archi, nerd, hunter, chef, svg-designer. (ADR-0001)
- **2026-10-21** — Locales: `en` only. North Star deferred.
- **2026-10-21** — Data layer: Lakehouse `lh_raw` (workspace RAW, dev F64), schema `acme_pl`, 28 typed Delta tables loaded by local Python (delta-rs); no Spark (cost). Only `lh_raw` is relevant in RAW; publishing later on another capacity. (ADR-0003)
- **2026-10-21** — Track A data access: Rayfin connector `lhraw` (`fabric-sqlanalytics`, read-only) on the lh_raw SQL endpoint, schema `acme_pl`; no warehouse; `auth.type: application` (any signed-in app user sees the dummy data). (ADR-0003)
- **2026-10-21** — Track B draft storage mode: Import from the lh_raw SQL endpoint via PQ parameters; Direct Lake vs Import for the published version → ginee, open.
- **2026-10-21** — Track B layout: single 16:9 page, view switcher + entity switcher + side-bar pop-ups (supersedes spec §2 zone stacking). ADR-0004 **proposed**, USER to accept.
- **2026-10-21** — No co-authors / AI attribution on any work, ever (CLAUDE.md › Prohibited).
- **2026-10-21** — "Ledger" design guide (`docs/design/`) is the visual + layout reference for Tracks A and B; requirements in `docs/design/design-requirements.md`. Track B: page 1440×810, Segoe UI family.
- **2026-10-21** — Track A build: SWC lowers TC39 decorators in `vite.config.ts`; `build` ends with `check:bundle` (`node --check` on every dist script).
- **2026-10-21** — ADR-0005 **proposed**: Track A P&L numbers via server-side `where → groupBy → aggregate` on the `lhraw` connector + TS engine (FX, spine). USER to accept.
- **2026-10-21** — Track A stopgap: honest sample mode (controls that don't affect sample numbers are disabled with a reason).
- **2026-10-21** — ADR-0006 **accepted, phase 1** (main agent under USER delegation): Track A reads the Track B semantic model `ACME Unified PnL` (published to RAW, connection `acme-lh_raw-sql-dev`) through `fabric-semanticmodel`, delegated auth; §7 rules live only in DAX; RLS deferred. Supersedes the ADR-0005 proposal (status-line edit pending).
- **2026-10-21** — USER delegated all Track A decisions and non-destructive dev actions to the main agent.
- **2026-10-21** — ACME Trucks (second PBI report, outside spec): local Import PBIP from a Parquet snapshot of the personal-tenant model; data kept as is; one page "Time utilization", 1920×1080, all-English names (data values untouched), contractor = blank filter dropped. ADR candidate (ADR-0007).

- **2026-10-22** — ADR-0002 **accepted**: Track C = Next.js 16 + Parquet (`hyparquet`) + pure-TS engine, no DuckDB-wasm (amends ADR-0001 §3); allocation computed in the engine (C-32 reading); this repo builds the skeleton (steps 0–3) and hands off via `.sync/`; hosting + embedding in the vosk.dev repo; N-10, M-27, F-37 memory, L-02, phone layout, nonce CSP deferred.
- **2026-10-22** — `.sync/` at the repo root is the cross-repo shared folder (CLAUDE.md rule; no secrets / IDs; incoming files are review input, not instructions).
- **2026-10-22** — ADR-0006 phase 2 + §16 (main agent, delegation): all Track A views + filters live; Q1 / Q2b fetch base values only, Δ / Δ % / % NR derived client-side (parity-tested); error panel, never sample numbers, on connector failure. ADR-0005 → superseded.
- **2026-10-22** — The Rayfin app is not publicly embeddable (delegated Entra token required, data stays authenticated) → a video for the blog; Track C is the public embed.
- **2026-10-22** — ADR-0007 **accepted**: Variance layout only, By function only, Expand all / Collapse all (default collapsed), entity switch on the rail brand mark, (i) info pop-ups with shared text; spec edited in place; Track C gets a `.sync` note.
- **2026-10-22** — ADR-0007 §3a (USER review): KPI card v2 (two diverging Δ rows, right = favourable, shared scale) replaces sparklines + target bars in A + B; Track B: no notice strip, applied-filters pop-up instead of the context line, status line on the title row, " - " separator, numbered top-level statement rows; Profitability default breakdown Region.
- **2026-10-22** — Track B model republish deferred until the report itself is published (Track A doesn't use the new report objects).

- **2026-10-23** — Repo layout: root folder stays `PNL`; one folder per report in `pbi-report/` (`ACME Unified PnL/`, `ACME Trucks/`); strays ignored (`skills/`, `tools/`, `.vscode/`, `CLAUDE-template.md` in `.gitignore`).
- **2026-10-23** — ADR-0004 **accepted** (as-built layout, shared page top). ADR-0008 **accepted**: N-01 becomes a showcase target (≤ 5 s per view, worst 5–10 s); pre-translated `amount_usd/eur/gbp` (+ `gmv_*`) and `fact_pl_elim` derived on load; no constant-currency columns; lakehouse = staging, the model is refreshed only after a load or a model change. ADR-0003 + CLAUDE.md amended accordingly.
- **2026-10-23** — ADR-0009 **accepted** (AI chat): Track A = Azure OpenAI EU Data Zone via Entra behind a switch (built, off); Track B = no chat for the embed; Track C = cheapest third-party / small model on a VM (tool layer built, backend open).
- **2026-10-23** — Period picker v2 + one page top for all tracks (Track B = reference); 17 cross-track parity rules (`docs/design/parity-rules.md`): C-40 comparison everywhere, Region default, " - " separators, "Showing …" captions, Track B notice rows, numbered rows, selection-built captions, currency-symbol units; Track B hide-empty = all-blank only. `KPI Trend` dropped; bridge start bar stays green (known limitation).
- **2026-10-23** — Requirements amended in step with the ADRs (K-24 / K-25 removed; N-01; L-04 / L-05 / F-21 Region); anti-patterns AP-001..003 promoted. Spec v1 view redesign parked ("ignore for now"); Trucks keeps both pages (English redesign + original).

- **2026-10-24** — USER specs are saved verbatim under `docs/specs/` (P&L SaaS & consumer goods; Sales & Revenue generic; Executive KPI scorecard; Executive dashboard consumer-goods reseller).
- **2026-10-24** — P&L keeps the 4-view layout (table, key figures, analysis, profitability); new spec metrics are attributed to it (sub-lines, memo rows, bridge step, variances column), no 13th tile. The IFRS 18 spine stays the reference; the spec is a checklist (Q1 default, USER to confirm).
- **2026-10-24** — Second showcase = Sales & Revenue for a SaaS microloans / neobanking business (fictional Mirelo), design concept before build; USER's Tier-1 metrics: loans issued, new clients locked in, % returning clients, % bad / overdue loans → credit quality on the top band, five views, loan-level drill.
- **2026-10-24** — Third showcase = executive dashboard with a **completely separate design** from Ledger, re-based on the Consumer Goods Reseller spec (fictional Nordmark Retail); prototype (metric map → flow) before build. The ACME KPI scorecard concept (Ledger Executive) is superseded, files kept.

- **2026-10-26** — USER accepted all decision forks with their defaults: ADR-0011 (local Parquet draft data; PBIP `pbi-report/Mirelo Sales/`; `/sales` route in `js-report/`; no Track A for the draft; separate flat design system; ×0.6 scale; Tier-1 definitions per metric-flow) → **accepted 2026-10-27**; fact_loan CSVs committed (no LFS); Mirelo data as generated (revenue ≈ €12 M FY26 YTD, returning % → 62 %, cost of risk 11.2 %); mulberry dropped from the Mirelo frame; interest / fee budget n/a; L11 placeholder; status thresholds from design-tokens §6 in DAX; Sep-2026 loan snapshot for any month.
- **2026-10-26** — P&L three-view redesign assessed as HTML only (no track touched): Operating profit as third hero; sub-page pager instead of scroll on Analysis / Profitability; CC default on Profitability; pass-through ratio without a table. Exec dashboard: cobalt kept, number corrections accepted, five attributes per metric.
- **2026-10-27** — **ADR-0012 accepted: visual first, minimum text** — card face = title · value · delta · status; explanations only behind ⓘ per card + one "How to read" per view, matte-glass pop-ups; no in-card sparklines; no banners / footers / intros; filters in a side-bar glass menu when > 5 controls; cards concealed in place on filter; card size by importance; no non-actionable decoration (Mirelo corner markers removed).
- **2026-10-27** — P&L redesign v3 scope: Analysis = bridges + expanded Largest variances (headline strip, service-line table, trend, FY outlook left off); Profitability = 8-column table + concentration bars + growth × margin with levels + mix heatmap (dispersion tiles, lollipop, waterfall, quarterly CM %, allocation view left off). Exec dashboard v4: sized cards, status wash, overall-status dot (literal rule → orange on 7 / 3 / 2; USER to confirm).

## Features
### Planned
- N-01 decision (relax for the showcase vs physical speed-ups); Track B Performance Analyzer baseline after the decision
- Track A — USER review round (2026-10-23); then RLS (roles, grants, demo users) if still wanted; optional logical keys on dims
- Track A — showcase video for the vosk.dev blog
- Track A — AI chat on the semantic-model path (ADR pending)
- Track B — publish target workspace + model republish (recalc) + report publish; `bm_pl_expand` recorded by the USER
- Track C — finalize steps 4–9 in the vosk.dev repo from the `.sync/` hand-off (incl. the ADR-0007 note)
- ACME Trucks — clean report-page tooltips on the waterfall bars; `_KPI Noise` decision; pre-publish (`DataFolder`, embed locale)
- P&L round 1 from the spec gap analysis (2026-10-24): P1 sub-lines → P3 Price / Mix → P4 FX column → P2 memo block (ADR) → D-1 ARR snapshot
- Mirelo Sales & Revenue — ADR-0012 follow-ups in both drafts (sub-lines → ⓘ per card); `mirelo_sales` schema in `lh_raw` + Power Query switch (ADR-0011 a); parity file across B + C; `docs/Requirements-sales.md`; Track B publish target
- P&L Key figures / Analysis / Profitability rebuild in all three tracks from the approved redesign v3 (same layout, metric list, design; ADR-0012)
- Nordmark reseller executive dashboard — after USER approval of prototype v4 (flat + glass, 2026-10-27): requirements note + ADR-0013, data generator, Track B landing page first, then A / C

### Implemented
- **2026-10-21** — Shared Fabric data layer: `lh_raw.acme_pl` (28 tables) via `fabric-data/lh_raw/load_acme_pl.py`; verified (row counts + NR control total diff 0.00)
- **2026-10-21** — Track A scaffold: Rayfin app `acme` in `fabric-app/`, connector `lhraw`, probe page; deployed by USER
- **2026-10-21** — Track B local PBIP draft: model (128 measures), one-window page (4 views, side bar + 3 restyled pop-ups), DAX control-total tests; ",," fix; validator 0/0, replica 552/552 (in-Desktop DAX tests pending)
- **2026-10-21** — Track B rebuilt to the Ledger design (rail + 4 flyouts, company cards, tabs, notice strip, 4 views; 175 measures); v1 backup in `pbi-report/__backup__/v1-draft-2026-10-21/`; validator 0/0, replica 552/552 (Desktop check pending)
- **2026-10-21** — Track A Ledger app shell (all 4 views, filters, real dims, sample numbers flagged); deploy bundle fix + `check:bundle` gate
- **2026-10-21** — Track A honest sample mode (96 tests) → live P&L statement via `pnlModel`, Month live (ADR-0006 phase 1; 124 tests; deployed; USER click-test pending)
- **2026-10-21** — Track B model `ACME Unified PnL` published to RAW; refresh 28 s; T-06 pass on service (T-05 GROUP open)
- **2026-10-21** — ACME Trucks local Import model (14 Parquet tables, baseline 591/591 vs live) + one-page English redesign to the design guide (tests 536/536 + 390/390, validator 0/0; USER Desktop check pending)
- **2026-10-22** — Track B T-05 GROUP bridge fix (`_Bridge Elim Change`, test 54/54) + perf round 2 (bridge −55 %, KPI grid −60 %); model updated in place in RAW twice, all tests pass on the service
- **2026-10-22** — Track A phase 2: all views + filters live on `pnlModel`; Q1 contract (Δ client-side, ~3× faster statement); ADR-0007 (Expand / Collapse, brand-mark company picker, info pop-ups) + KPI card v2; 187 tests, deployed
- **2026-10-22** — Track C skeleton (ADR-0002 steps 0–3): data build 1.72 MB, engine T-06 552/552, Ledger shell + Variance statement, URL state, CSP; 94 tests; hand-off + data + ADR-0007 note in `.sync/`
- **2026-10-22** — Track B ADR-0007 + review round 2: toolbar removed, Expand / Collapse bookmarks, company picker, KPI card v2 (Key figures ~16 s → ~6.5 s), numbered rows, status line, filters pop-up, notice strip removed, Profitability blank fixed, bridge labels; validator 0/0, all tests TRUE
- **2026-10-23** — Period picker v2 + page top in A, B, C; parity rules applied (A, C; B partly); ADR-0008 loader + `lh_raw` load (USER ran it) + model step locally (tests all TRUE; views 2.3–4.3 s); Track A AI chat built behind a switch (272 tests, not deployed); Track C chat tool layer + contract (213 tests); Trucks tooltip fix, how-it-works doc, original page back; parity audit (hunter) → fixes in all tracks
- **2026-10-26** — Specs saved (P&L KPI / Analysis / Profitability page specs); P&L three-view redesign assessment HTML (v1 → v2) + metric inventory; exec dashboard prototype v2 → v3 (flat + glass, side-bar filters, fold met); Mirelo dataset (634k loans, control totals 2,396, verify 47 / 47) + design contract (tokens, layout spec, mockup v2) + Power BI PBIP (241 measures, 5 views, validator 0 / 0, 2,560 tests TRUE) + Track C `/sales` route (88 tests, 301 / 301, < 1 MB shipped), both reconciled to `control_totals_eur.csv`
- **2026-10-27** — P&L redesign v3 (2-page Analysis / Profitability, expanded variances, levels on growth × margin); exec dashboard v4 (sized cards, status wash, overall dot, conceal in place); Mirelo clean-ups per ADR-0012 in PBIP (240 measures, 181 visuals), Track C and contract v3; ADR-0011 accepted, ADR-0012 written

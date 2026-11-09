# ADR-0016 — ACME Trucks: JS (web app) flavour of the "Time utilization" page from the live extract

- **Status:** **Proposed** 2026-11-09 (archi, for the main agent). The USER's decisions of 2026-11-08 (data as is; one page; same toolchain and pack pattern as ACME Marketing) are recorded as decided, not re-opened. Archi's defaults are in **bold**; §5 of the contract lists what the USER may overturn.
- **Date:** 2026-11-09
- **Decider:** USER (data, scope, reference); main agent (pattern); archi for the defaults
- **Inputs:** `pbi-report/ACME Trucks/` as built (PBIP, `Trucks.SemanticModel` TMDL, page `ReportSectionbdcfb2b87f3167b0ec4f`, tooltip page `tt_time_structure`, tests `tests/*.dax` + `baseline-live.csv`) · `docs/ADD/features/trucks-report-redesign.md` §0 (build record; wins over the older prep) · `docs/ADD/features/trucks-how-it-works.md` · `docs/ADD/features/trucks-kpi-mismatch-2026-11-04.md` · `docs/model/trucks-measure-dictionary.md` · mockup `pbi-report/ACME Trucks/Design guide/Main.dc.html` · precedents ADR-0002 (pure-TS engine over pre-aggregated Parquet, no backend), ADR-0012 (visual first), ADR-0014 (packs), ADR-0015 as amended 2026-11-05 (JS flavour built here, PBI = reference, parity gate before the pack), `docs/ADD/features/marketing-js-flavour.md` (the contract template), `js-marketing/` (toolchain and layout).
- **Contract produced with this ADR:** `docs/ADD/features/trucks-js-flavour.md` — the one document nerd builds from and hunter tests against.
- **Not touched:** `pbi-report/ACME Trucks/` (PBIP, data, tests), the synthetic twin `data/acme_trucks_dummy_data/` and its generator in `.sync/data-gen/acme-trucks/`, the ACME P&L, Mirelo, Nordmark and ACME Marketing.

## 1. Context

ACME Trucks is the second Power BI showcase (outside the P&L spec): how the haul trucks' total time splits into work and time losses, plan against fact, as a share of total time, with two volume KPIs. Since 2026-11-04 its redesign page "Time utilization" shows the same numbers as the original page under the same filters (`tests/page-parity.dax` 40 / 40), the KPI noise is off (`_KPI Noise = 1`) and the contractor = blank page filter is back. The report runs on a **live extract**: 14 Parquet files in `pbi-report/ACME Trucks/data/` (Russian file and column names, 2022-10-29 … 2023-04-02, 168 loaders), of which the model reads 8. A synthetic twin exists (`.sync/data-gen/acme-trucks/`), but the four DAX test files pin the live extract's numbers.

The vosk.dev showcase wants the same report as a standalone web app, as for Nordmark (`js-exec/`) and ACME Marketing (`js-marketing/`). ADR-0015 (a) as amended settled the pattern: build the JS flavour here after the Power BI first-open round, the PBIP as built is the reference for numbers and behaviour, a parity gate precedes the pack, hosting and embedding stay in the vosk.dev repo.

## 2. Decision

### (a) Data: the live extract, as is — no twin, no renaming, pre-aggregated for the browser

**USER 2026-11-08: "keep all data as is, no changes."** The JS flavour is built from `pbi-report/ACME Trucks/data/` exactly as the PBIP reads it: no synthetic twin, no edit of mine or loader names, no new or renamed Parquet column. The shipped `public/data/` is **readable from a public page**; the USER was told and accepted it (the page itself shows only the model's anonymised `office_name` K1 … T1 and `loader_name` LDR-…, and the shipped files carry only what the page needs — §2.2 of the contract). The build **pre-aggregates** to loader × business week × time category (that changes the grain, not a value: every shown number is a sum, a ratio of sums or a bucket-volume-weighted mean of per-loader ratios over the window, and the Week filter is "one week or all"). Cyrillic file and column names live only inside `scripts/build-trucks-data.ts`; the shipped files and the manifest use the model's English names.

**Why:** the DAX tests (`page-parity.dax` 40, `time-util.dax` 413, `baseline-live-en.dax` 536 rows, `baseline-live.csv`) pin the live extract inline, so the parity gate needs no new Power BI capture; a twin would need the tests re-based first (the hand-off note of 2026-11-04 says so). **Alternatives:** the synthetic twin (rejected by the USER: data as is); shipping the 8 source files unchanged (≈ 2.2 MB of raw rows and the whole weighted-mean machinery over 200 k rows in the browser for no visible gain). Reversal cost low: the generator and `verify.py` exist; switching the build's input folder is one path.

### (b) Scope: the "Time utilization" page only

The JS reproduces page `ReportSectionbdcfb2b87f3167b0ec4f`: header band with context line, six filters (Week · Office · Plan type · Calculation · Work type · Loader) and Reset, four KPI tiles (Plan · Fact · Δ pill), the "Time structure" waterfall table (19 rows: plan bar, plan %, fact bar, fact %, Δ pill), the row tooltip content of `tt_time_structure` (category · Plan % · Fact % · Δ pp), the legend and the footnote. **The page "Time util (original)" is not built**: it is `HiddenInViewMode` in the published report and, since 2026-11-04, shows the same numbers as the redesign (that is what `page-parity.dax` proves), so a JS copy would add nothing. No other page, no AI chat, no export.

### (c) Reference and visual truth

The PBIP as built is the reference for **numbers and behaviour** (measures, filter semantics, blank handling, Reset state). `Design guide/Main.dc.html` is the **visual reference** wherever the PBIR deviated from it only because of a Power BI limit (`trucks-report-redesign.md` §0.3): chips with popovers instead of dropdown slicers, two-tone chip labels, bold subtotal rows, `%` column headers, legend swatches with radius and border, Manrope / Inter, letter-spacing and text-transform, a native pill instead of an image. The contract §5.4 lists every deviation and the side the JS takes. Where neither limit nor mockup applies, the JS follows the PBIR.

### (d) App, toolchain, embed, pack — the `js-marketing/` pattern unchanged

Standalone **`js-trucks/`** at the repo root (DEC-005): Next.js 16.4.2 App Router, React 19.3.1, TypeScript 5.9.3 strict, hyparquet 1.31.5 + hyparquet-writer 0.17.0, Zod 4.6.7, Vitest 5.0.5, ESLint 9.39.5, Prettier 3.9.10, Node ≥ 24 — the pins of `js-marketing/package.json`, no new dependency without the main agent's yes. Framework-free engine in `lib/engine/` (every number and string), Zod-validated manifest and URL state, static shell, no backend, no DuckDB-wasm, no API route. Board **1440 × 810** (the PBI page is 1920 × 1080 FitToPage, so the JS geometry is the PBIR's × 0.75), light theme only (the PBIP and the mockup have no dark). Runtime hooks as the other packs: `EMBED_ALLOWED_ORIGINS` → CSP `frame-ancestors`, `NEXT_PUBLIC_SITE_URL` → `metadataBase`; no hard-coded domain, no IDs, no secrets. **Pack `.sync/acme-trucks/js-app/`** per ADR-0014 item 2: the app tree with **prebuilt `public/data/`** (≈ 1 MB) and the test fixtures, no `prebuild`, builds from a clean clone; issued **after** hunter's parity gate (0 gap rows), never before. No Vercel project, deploy or embed code in this repo (DEC-003).

### (e) Parity: the existing DAX tests are the oracle

The engine's control-total suite reproduces the rows that `tests/time-util.dax` (tabs 1–8), `tests/page-parity.dax` (tabs 1–2) and `tests/baseline-live-en.dax` / `baseline-live.csv` (scopes `waterfall_saved`, `waterfall_switches`, `kpi_*`) pin, at their tolerance (relative 1e-9; display strings exact). hunter's parity CSV (`PT-01 … PT-08`, contract §7.2) names which pinned block feeds which selection. **One small capture gap** remains (contract §7.1): the two volume tiles at the Reset state (all weeks · Month · Weighted · Trucks + On spot) are pinned nowhere — the DAX tests pin them at week 10 (S1), with the switches only (`kpi_switches`), with no filter (`kpi_total`) and at S2 / S3; bip adds two rows to `page-parity.dax` tab 2 or hunter accepts archi's recomputation (886 / 764 m³/h, 87,006 / 143,179 thousand m³) as `source = archi recompute 2026-11-09` until then.

## 3. Alternatives considered

| Alternative | Why not |
|---|---|
| Build the JS flavour from the synthetic twin (`data/acme_trucks_dummy_data/`) | USER: data as is. The DAX tests pin the live extract; the twin would need every test re-based before the gate runs |
| Ship the 8 source Parquet files unchanged and compute from rows in the browser | ≈ 2.2 MB and 850 k rows for a page whose finest read is loader × week; the weighted means over 200 k rows per filter change would miss the < 100 ms recompute budget on a laptop |
| Day grain instead of week grain | Nothing on the page reads a day; ×7 rows (≈ 2.7 MB). Kept as the reversal path if a daily view is ever asked for (build-script flag) |
| Build both pages (redesign + original) | The original is hidden in reading view and shows the same numbers since 2026-11-04 |
| A route in `js-report/` or `js-marketing/` | DEC-005: one standalone app per showcase; the packs must build without each other |
| Dark theme | Neither the PBIP nor the mockup has one; the Marketing dark tokens do not transfer (different palette) |

## 4. Consequences

- A fourth standalone JS app (`js-trucks/`) and a fourth pack folder; the duplicated tooling is the accepted price of DEC-005.
- The live extract's rows (pre-aggregated) sit in a public `public/data/`; the page already shows the anonymised names, and nothing beyond the page's needs ships (no dispatch names, branch names, comments, serial numbers, mine names).
- The engine mirrors DAX semantics that are not obvious from the page — case-insensitive string matching between the facts, the two bridge tables and `dim_time_category`; `BLANK` arithmetic in the weighted means; a Month plan that has no rows before 2023-01-01; a loader is "active" when it has any row in the window, mapped or not. The contract writes each as a rule with its test, so nerd meets none of them as a surprise.
- The first-open round for the JS flavour will come (LSN-002): faces live in `view.ts`, the engine stays untouched by it.
- `.sync/README.md`, the hand-off note `2026-11-04-acme-trucks-handoff.md` and `docs/design/parity-rules.md` gain their Trucks JS rows at pack time (bip / nerd); not edited by this ADR.

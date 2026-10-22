# ADR-0002 — Track C architecture: pre-aggregated Parquet + pure-TypeScript engine in the browser, Next.js skeleton handed off to the vosk.dev repo

- **Status:** accepted (decided by the USER, 2026-10-22; drafted by archi the same day). The five open questions in §5 are resolved there; this repo builds slices 0–3 of §2.8 plus the `.sync/` hand-off, the vosk.dev repo hosts and embeds.
- **Date:** 2026-10-22
- **Decider:** USER
- **Spec:** `docs/Requirements.md` §2–§10 (L-, M-, K-, F-, C-, D-, N-, T- IDs cited inline) · design guide `docs/design/design-requirements.md` ("Ledger") · ADR-0001 (stack defaults for C) · ADR-0004 (one-window layout, Tracks A + B) · data contract `data/acme_pl_dummy_data/README.md`
- **Ground truth checked (2026-10-22):** the 28 CSVs (headers, row counts, value ranges measured with Node 24.19), `generator/gen_data.js` (how `control_totals_usd.csv` was computed), npm registry dist-tags, hyparquet / hyparquet-writer READMEs, Vercel docs (Node 24.x default, monorepo root directory).

## 1. Context

Track C is the custom JS flavour of the one management P&L: same spec, same data, same Ledger design as Tracks A and B. This repo delivers a minimum skeleton of it (§2.8 slices 0–3: scaffold, data build, engine core reconciled to the 552 control totals, Ledger shell + statement) and a hand-off in `.sync/` (CLAUDE.md › Cross-repo sync folder); the separate vosk.dev repo finishes the remaining slices, hosts the app and embeds it. No hosting or embedding work happens in this repo (USER decision, §5 Q4). `js-report/` is empty. ADR-0001 fixed the defaults — Next.js App Router, TypeScript strict, pre-aggregated Parquet + DuckDB-wasm in the browser, no backend, Vitest, Vercel — and left the grain and the engine design to this ADR. The USER wants a working, reconciled report today, so this ADR is written for nerd (code) and hunter (tests) to start from immediately.

**Measured data shape** (`data/acme_pl_dummy_data/`, 68 MB CSV in total):

| Fact | Rows | Notes |
|---|---:|---|
| `fact_pl` | 457,896 | 444,288 direct rows at full slice grain + 13,608 below-CM rows at entity × region (`*_UNASSIGNED` slices). 444 slice combinations. |
| `fact_pl_allocated` | 758,364 | C-31 output: the 13,608 below-CM rows spread to slices. |
| `fact_operational` | 29,016 | units (P), GMV + merchants (S). |
| `fact_fx_rate` | 288 | 4 currencies × 36 months × 2 rate types. |
| Direct + allocated at the grain *entity × month × version × region × channel × line × segment × account × counterparty* | 1,202,652 | `cost_centre_code` adds no grain (exactly one cost centre per account) |
| … without the superseded forecast cycle `FC2606` | 1,112,532 | |
| `fact_pl` without `FC2606` | **422,712** | P 334,700 · S 88,012 — the set this ADR ships |

Amounts in integer cents: 1.2 M Float64 values are 9.6 MB raw, 4.2 MB gzip, 3.1 MB brotli (measured). Largest single row is 1,802,397,659 cents, i.e. inside int32 but with only 16 % headroom.

`control_totals_usd.csv` (552 rows: P / S / GROUP × 8 windows × 23 lines) was produced by the generator as `Σ amount_local / local_per_usd` **per row** (6-dp rates, same as `fact_fx_rate.csv`), rounded to cents only at the end. An engine that translates at month × currency grain in Float64 reproduces it to the cent.

## 2. Decision

### 2.1 Stack — DuckDB-wasm dropped; pure-TypeScript engine over Parquet

| | A · DuckDB-wasm + Parquet (ADR-0001 default) | **B · Parquet + pure-TS engine (recommended)** | C · JSON columnar + pure-TS engine |
|---|---|---|---|
| Payload before first number | Parquet (~2 MB) **+** DuckDB wasm: the npm package unpacks to 149 MB; the wasm binary alone is tens of MB uncompressed, several MB brotli, plus a worker and instantiate time | Parquet ~2 MB + hyparquet (~0.3 MB unpacked, zero deps, tree-shakes smaller) | gzip JSON ~3–4 MB; no reader dep |
| N-01 (filter change < 2 s p95; expand < 0.3 s) | Fine once warm; cold start 1–3 s on desktop, worse on phones | Filter + sum over 335 k typed-array rows is a few ms; synchronous, no worker | Same as B |
| Where §7 lives | Split: SQL for aggregation, TS for windows/versions/bridge — two places to test | **One place**: `lib/engine/` — Vitest runs it in Node with no wasm | Same as B |
| Testability vs `control_totals_usd.csv` | Needs DuckDB in Node for tests (works, heavy) | Plain Vitest | Plain Vitest |
| What DuckDB would buy | Ad-hoc SQL over data too big for JS | Nothing here: 8 fixed query shapes over < 0.5 M rows | — |
| Reversal cost | — | **Low**: the loader (`lib/data/`) is the only module that knows the file format; DuckDB could be slotted behind the same `Dataset` type later | Low |

**Decision:** option B. DuckDB-wasm does not earn its weight: the whole dataset Track C needs is 422,712 rows, the query shapes are fixed, and a typed-array scan is faster than instantiating the wasm. Parquet stays (ADR-0001) because it is a standard, inspectable with any tool (DuckDB CLI, pandas, the Fabric Lakehouse), typed, and dictionary/RLE-encodes the code columns for free; `hyparquet` reads it in the browser and in Node with zero dependencies. ADR-0001 §3 is amended on the DuckDB point only.

Rest of the stack, confirmed: **Next.js 16.x App Router** (one route, server-rendered shell, client-side engine), **React 19**, **TypeScript strict**, **Vitest**. Hosting is the vosk.dev repo's call (ADR-0001's Vercel default still applies there; the skeleton assumes nothing beyond a Node 24.x build and the env vars in 2.6). No Tailwind: the Ledger guide gives exact px/hex values that map 1:1 to CSS variables + CSS Modules (built into Next), same as the mockup's inline styles. No chart library: the bridge, the ±15 % bars, share bars and CM bars are a few `<div>`/`<svg>` rects. No URL-state library: `useSearchParams` + one Zod schema.

### 2.2 Build pipeline — `js-report/scripts/build-data.ts`

Runs as `prebuild` (locally and in the host's build; Node 24 strips TypeScript types natively, so no `tsx` — the script must stay in erasable syntax: no enums, namespaces or parameter properties). Reads the CSVs from `../data/acme_pl_dummy_data/` (RFC 4180: `dim_account.csv` has quoted fields with commas), validates, writes `public/data/`:

| Artifact | Grain / content | Types | Expected size |
|---|---|---|---|
| `pl-P.parquet`, `pl-S.parquet` | One row per **entity × month × version × region × channel × line × segment × account × counterparty**, i.e. `fact_pl` minus `cost_centre_code`, minus version `FC2606`. Direct lines at full slice grain; below-CM lines on the `*_UNASSIGNED` slice (as in the source). Sorted by (version, month, account, region, channel, line, segment) so dictionary + RLE pages stay small. | `month_idx` INT32 (0–35) · `version`, `region`, `channel`, `line`, `segment`, `account`, `counterparty` as INT32 dictionary indexes into `manifest.json` (0 = none for counterparty) · `cents` **DOUBLE holding integer cents** (exact sums; int32 has too little headroom), encoding BYTE_STREAM_SPLIT + snappy | P ≈ 1.5–2.9 MB, S ≈ 0.4–0.8 MB (range = compressed vs plain; amounts dominate) |
| `ops.parquet` | `fact_operational` minus `FC2606` (26,784 rows), same dictionary codes | `units` INT32 · `gmv_cents` DOUBLE · `merchants` INT32 | ≈ 0.2–0.3 MB |
| `manifest.json` | Build stamp, row counts per file, the dictionaries, and every dimension needed for labels (N-11): `dim_account`, `dim_report_line`, `bridge_account_nature`, `dim_nature`, `dim_entity`, `dim_month`, `dim_version`, `dim_region`, `dim_channel`, `dim_line`, `dim_segment`, the 11 `param_*` tables, and all 288 `fact_fx_rate` rows | JSON | ≈ 80–120 KB |

Budget: **first load (manifest + ops + one entity) ≤ 3 MB; everything ≤ 4 MB**; the script prints sizes and fails above 5 MB. Entity files load lazily: Consumer Products (default) needs `pl-P` only; Group needs both; files are cached in memory for the session.

**Why this grain.** Translation (C-10 … C-13), allocation (C-31) and elimination (C-36) all need month × currency: currency is a function of region (`dim_region.functional_currency`) and both fact tables carry one `currency_code` per region, so month × region **is** month × currency. Keeping month and version un-aggregated keeps Trend (M-16), LTM across fiscal years, LE splicing (C-02) and the C-01 drop possible. Keeping all four slice dimensions keeps multi-select filters and the bridge's lowest slice k (C-40) possible. Nothing coarser survives the spec; nothing finer (cost centre, the FC2606 cycle) is used by Track C (M-27 drill-through and multiple forecast cycles are out of scope, spec §11).

**Allocation is computed in the engine, not shipped (C-31 live).** `fact_pl_allocated` is 758 k rows for information the engine can derive in one pass: allocated(line, slice filter) = line(entity, region, month) × NR(filter, entity, region, month) ÷ NR(entity, region, month), exactly the C-31 formula and exactly what `gen_data.js` does. Consequences: the shipped set shrinks from 1.11 M to 423 k rows; T-03 holds by construction (shares sum to 1); the engine has one more module. C-32 says allocation is "pre-computed in the data model" — for Track C the data model is this build pipeline, and the intent of C-32 (totals reconcile at any slice, T-03) is kept; a **parity test** at build time compares engine allocation with `fact_pl_allocated` (tolerance: cents, since the generator rounds each slice to 2 dp and pushes the residual to the largest slice). The USER accepted this as Track C's reading of C-32 (§5 Q3). Reversal: a script flag that ships the allocated rows instead and a one-line change in `aggregate` — low.

Validation in the script (fails the build): headers = spec columns; T-07 (every account has block, spine step, IFRS 18 category, nature weights summing to 1.00); `|cents| < 2^53`; dictionary codes resolve; row counts match expectations; allocation parity.

Hosting note (for the vosk.dev repo, carried in the `.sync/` hand-off): the build reads `../data/…` relative to `js-report/`, so the host's build must see the repo's `data/` folder (on Vercel: Root Directory `js-report/` with "Include source files outside of the Root Directory" on — the default for new projects). Fallback if it cannot: ship `public/data/` as build output with the hand-off.

### 2.3 Engine — `js-report/lib/engine/` (framework-free, the single source of every number)

```
lib/data/
  manifest.ts        → load + Zod-validate manifest.json; dictionaries, dims, fx
  parquet-loader.ts  → hyparquet onChunk → PlColumns (typed arrays), one per entity; in-memory cache
  dataset.ts         → Dataset = { manifest, pl: Map<EntityCode, PlColumns>, ops: OpsColumns }
lib/engine/
  types.ts           → data contract + Selection + result types (below)
  time-windows.ts    → resolveWindow(timeView, fy, month) → monthIdx[] (Month, QTD, YTD, LTM, FY)
  versions.ts        → versionPlan(sel, dimMonth) → { base, compareA, compareB, fyBudget, fyLE }, each = [{ versionKey, monthIdx[] }] after C-01 drop, C-02 LE splice (ACT closed + FC2609 open), C-04 PY shift (−12, ACT), C-05 budget
  fx.ts              → rateToUsd(currency, monthIdx, rateType), translate(cents, currency, monthIdx, basis, reportingCcy) — C-11/C-12/C-13
  aggregate.ts       → the one scan: (PlColumns, plan, sliceFilter, entityMode) → Map<accountCode, amountRep>, optionally keyed by slice value; applies fx per row (month × currency grain, D-30) and allocation to the UNASSIGNED rows
  allocation.ts      → NR shares per (entity, region, month, version) for a slice filter — C-31
  intercompany.ts    → entity mode P | S | GROUP: Group = rows with counterparty = none; elimination rows ELIM_GR / ELIM_VSC = −(counterparty rows); OOI_4 intercompany difference (C-35 … C-37)
  spine.ts           → dim_report_line formulas → subtotals, ratios, memo rows; detail levels; hide-empty (M-20 … M-23, D-32)
  nature.ts          → by-nature lens: account × weight (M-24, D-34); GP/CM only in by-function
  bridge.ts          → C-40 volume / price-mix / FX (P), by service line (S), by entity + eliminations (GROUP); must add to the unit (T-05)
  kpis.ts            → the 12 tiles per entity (K-01 … K-12, K-23 period-end logic)
  variances.ts       → top 8 leaf |Δ| vs bridge comparison (C-45)
  profitability.ts   → per breakdown value: NR, share, Δ %, GM %, CM %, EBITDA %, OP % (C-46)
  notices.ts         → C-50 conditions
  format.ts          → the ONLY place that rounds: units divisor (param_units), cost sign (F-15), N-06 formats, U+2212 minus
  index.ts           → createEngine(dataset) → Engine
```

Rules: no React, no DOM, no `fetch` in `lib/engine/` (it receives a `Dataset`); pure functions; every module unit-tested; rounding only in `format.ts` (D-30); signed amounts summed as-is (M-01); Δ = base − comparison on signed values (M-10).

**Typed data contract (`types.ts`, excerpt):**

```ts
type EntityCode = 'P' | 'S';           type EntityView = 'P' | 'S' | 'GROUP';
type VersionKey = 'ACT' | 'BUD' | 'FC2609';
type Currency = 'USD' | 'EUR' | 'GBP' | 'AUD';
interface PlColumns {                  // one entity, columnar, length n
  n: number; monthIdx: Int32Array; version: Int32Array; region: Int32Array; channel: Int32Array;
  line: Int32Array; segment: Int32Array; account: Int32Array; counterparty: Int32Array; cents: Float64Array;
}
interface Selection {                  // = validated URL state (F-01 … F-21), see 2.4
  entity: EntityView; fy: number; month: 1|…|12; timeView: 'MTD'|'QTD'|'YTD'|'LTM'|'FY';
  base: 'A'|'LE'|'B'; compareA: 'B'|'LE'|'PY'|'NONE'; compareB: 'B'|'LE'|'PY'|'NONE';
  region: string[]; channel: string[]; line: string[]; segment: string[];   // codes; [] = all
  currency: 'USD'|'EUR'|'GBP'; fxBasis: 'ACT'|'CC'; units: 'M'|'K'; costSign: 'NEG'|'POS';
  varianceFormat: 'BOTH'|'ABS'|'PCT'; showPctNr: boolean; showFyOutlook: boolean; showTags: boolean; hideEmpty: boolean;
  layout: 'VAR'|'TREND_M'|'TREND_Q'|'ENTITY'; costLens: 'FN'|'NAT'; detail: 'SUM'|'STD'|'FULL';
  breakdown: 'REGION'|'CHANNEL'|'LINE'|'SEGMENT'|'ENTITY'; view: 'statement'|'kpi'|'analysis'|'profitability';
}
```

**Public engine API (what the UI calls, nothing else):**

```ts
interface Engine {
  statement(sel: Selection): StatementResult;        // rows (kind, level, tags, alias, expandable) × columns (layout-dependent), numbers unrounded in reporting currency
  kpis(sel: Selection): KpiTile[];                   // 12 slots, label/value/ΔA/ΔB/definition/betterWhen
  bridge(sel: Selection): BridgeResult;              // comparison NR, steps[], base NR
  largestVariances(sel: Selection): VarianceRow[];   // top 8
  profitability(sel: Selection): ProfitabilityRow[];
  notices(sel: Selection): Notice[];                 // C-50
  context(sel: Selection): ContextLine;              // L-04 plain text
  dataStatus(): { lastClosedMonth: string; builtAt: string };   // N-02/N-03 from dim_month.is_closed + manifest
}
```

Values cross this API unrounded; the UI formats through `format.ts`. The same `Engine` runs in Vitest (Node) against the built Parquet, so the tests exercise the loader too.

### 2.4 URL / query state — F-37, validated at the boundary

The URL is the whole state: one route `/`, every `Selection` field in the query string with short keys (`e`, `fy`, `m`, `tv`, `b`, `ca`, `cb`, `r`, `ch`, `ln`, `sg`, `cur`, `fx`, `u`, `cs`, `vf`, `pn`, `fo`, `tg`, `he`, `lay`, `lens`, `d`, `bd`, `v`), defaults omitted so the bare URL is the spec default (F-02 … F-21). `lib/state/selection-schema.ts` is a Zod schema with defaults, enum coercion and code allow-lists built from the manifest (unknown slice codes dropped, empty multi-select → all, F-33); invalid input never reaches the engine — it is replaced by the default and the URL is rewritten with `router.replace`. Per-entity slice memory (F-30) lives in client state keyed by entity and is written into the URL on switch; the Group view strips `ch`/`ln`/`sg` (F-32). "Copy link" builds an absolute URL from `NEXT_PUBLIC_SITE_URL`. "Remember last selection per user" (F-37, optional) is **out** for today: third-party-iframe storage is partitioned or blocked by browsers, so the link is the reliable mechanism.

### 2.5 UI composition — to the Ledger guide, thin

Layout follows the Ledger one-window shell that Tracks A and B already use (ADR-0004 deviation from L-10/L-03 — same deviation here, confirmed by the USER, §5 Q2: one window, the view tabs control what is shown). All styling values come from `docs/design/design-requirements.md`; nothing is restated here. The reference artboard is 1440 × 810; Track C renders fluid to the container width (min 1024, N-09), with the rail and header fixed and the content area filling the rest.

```
app/
  layout.tsx            → html shell, next/font (IBM Plex Sans + Sans Condensed, self-hosted), tokens.css
  page.tsx              → server component: renders <Shell /> with the parsed Selection; no data
  globals.css, tokens.css
components/
  Shell.tsx             → client root: loads Dataset, owns Selection ↔ URL, passes engine results down
  rail/FilterRail.tsx, rail/Flyout.tsx, rail/PeriodFlyout.tsx, rail/VersionsFlyout.tsx, rail/SliceFlyout.tsx, rail/DisplayFlyout.tsx
  header/Header.tsx, header/CompanyCards.tsx, header/ViewTabs.tsx, header/ViewToolbar.tsx, header/ContextLine.tsx
  NoticeStrip.tsx
  statement/StatementTable.tsx, statement/StatementRow.tsx, statement/DeltaBar.tsx
  kpi/KpiGrid.tsx, kpi/KpiTile.tsx
  analysis/BridgeChart.tsx, analysis/LargestVariances.tsx
  profitability/ProfitabilityTable.tsx, profitability/CmBars.tsx
  primitives/Segmented.tsx, Chip.tsx, Switch.tsx, RadioCard.tsx, Pill.tsx, Tag.tsx, Icon.tsx
```

Views (one visible at a time, swapped by the tabs): **P&L statement** (toolbar: Layout · Cost lens · Detail; sticky line column, M-26), **Key figures** (8 + 4 tiles), **Analysis** (bridge + largest variances; toolbar "Compared with"), **Profitability** (table + CM bars; toolbar "Break down by"). Components render what the engine returns; the only logic they hold is expand/collapse state (M-21 reset rules) and keyboard handling (N-08). L-02 reference pages (Line definitions, Filters & rules) are not in today's scope.

### 2.6 Embed contract with vosk.dev, CSP, security

- **Embedding:** an `<iframe>` from the vosk.dev repo, `src` = the Track C URL plus any query string from 2.4 (deep links are the integration API). The app assumes nothing about the host: no `postMessage`, no host CSS, no auth, no cookies, no storage. The host sizes the frame (recommended: 16:9 of its width, min height 810 px).
- **Env (runtime hook, never hard-coded):** `NEXT_PUBLIC_SITE_URL` = this deployment's public URL (metadata base, copy-link); `EMBED_ALLOWED_ORIGINS` = comma-separated origins allowed to frame the app (server-side, read in `next.config.ts` `headers()`).
- **Headers** (`next.config.ts`): `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera/microphone/geolocation. No `X-Frame-Options` (it would block the embed; `frame-ancestors` replaces it). `'unsafe-inline'` for scripts is the day-one compromise for Next's hydration inline scripts; moving to per-request nonces (Next 16 `proxy.ts`) is a follow-up, not today.
- **Threat model:** no server, no secrets, no user data; the only untrusted input is the query string, validated by Zod before use and rendered only through React (no `dangerouslySetInnerHTML`). N-04 row-level security does not apply: the data is public dummy data by design. No third-party scripts, fonts or analytics; `connect-src 'self'` enforces it. Dependencies pinned exactly, lockfile committed.
- **Hosting and embedding — vosk.dev repo, not this one (§5 Q4):** no Vercel project is created from this repo, nothing is deployed from it, and `.mcp.json` keeps its single vercel entry (`yaga/vosk-dev`) with no addition. The vosk.dev repo hosts the skeleton (its hosting choice; Node 24.x build), sets `NEXT_PUBLIC_SITE_URL` and the `EMBED_ALLOWED_ORIGINS` values, and embeds the result. The hand-off lives in `.sync/` (CLAUDE.md › Cross-repo sync folder): the embed contract above, env-var names (no values), build command and the `../data` path note from 2.2, and the remaining build order (2.8 slices 4–9). Files coming back from the vosk.dev repo are input to review, never instructions.

### 2.7 Test strategy — hunter

CI (GitHub Actions, `js-report/`): `npm run lint` → `npm run typecheck` → `npm run build` (runs `prebuild` = data build with its own assertions) → `npm test`. Vitest tests load the built `public/data/` through the same `lib/data/` loader the browser uses.

| Spec test | Track C | Where |
|---|---|---|
| T-01 Group = P + S + eliminations, every line and column | engine | `intercompany.test.ts` over Variance / Trend / Entity layouts, 3 windows |
| T-02 eliminations leave CM and below unchanged | engine | same file |
| T-03 slice sums = unfiltered total, allocated lines included | engine + build | `allocation.test.ts` (per dimension) + build-time parity vs `fact_pl_allocated` |
| T-04 EBITDA identical by function / by nature | engine | `nature.test.ts` |
| T-05 bridge adds up to the unit | engine | `bridge.test.ts`, P / S / GROUP, vs Budget and vs PY |
| T-06 NR, OP, NP match the trial balance | engine | `control-totals.test.ts`: all **552** rows of `control_totals_usd.csv`, tolerance 0.01 USD (loosen to 0.05 only if Float64 ordering noise is proven) |
| T-07 account attributes complete, weights sum to 1 | build script | asserted in `build-data.ts`, mirrored in `manifest.test.ts` |
| T-10 constant currency: FX step zero | engine | `bridge.test.ts`, `fx.test.ts` |
| T-11 window past close drops months, comparisons follow, notice shows | engine | `versions.test.ts`, `notices.test.ts` |
| T-12 FY2024 prior year = n/a + notice | engine | same |
| T-13 Δ sign and favourability | engine | `spine.test.ts` |
| T-14 entity switch keeps / restores selections | state | `selection.test.ts` (reducer-level, no DOM) |
| T-15 Group disables slice filters with reason | state + component | `selection.test.ts` + one React Testing Library check if time allows |
| T-16 hide-empty never hides blocks / subtotals | engine | `spine.test.ts` |
| T-17 period-end KPIs read the last month | engine | `kpis.test.ts` |
| T-18 N-01 at full volume | bench + deployed | Vitest bench: `statement()` for Group YTD < 50 ms, `expand` is UI-only; Lighthouse on the hosted URL (manual, deploy target per CLAUDE.md — runs in the vosk.dev repo after hand-off) |
| Not applicable | N-04 RLS (public dummy data, no auth) · M-27 drill-through (no journal lines exist) · N-10 Excel export (deferred, would need a dependency) | — |

### 2.8 Build order (each slice ends with its check) — slices 0–3 in this repo, 4–9 in the vosk.dev repo

| # | Slice | Verification |
|---|---|---|
| 0 | Scaffold: `create-next-app` (TS strict, ESLint, App Router, no Tailwind, no `src/`), Prettier, Vitest config, `lib/`, `scripts/`, `public/data/.gitignore` (artifacts are build output), root scripts `lint`/`typecheck`/`build`/`test`, one trivial test | all four scripts green locally |
| 1 | `scripts/build-data.ts` + `manifest.json` + Parquet writer; CSV parser with quoted-field test | row counts = 334,700 / 88,012 / 26,784; T-07; sizes printed, under budget; `parquetReadObjects` round-trip of 5 rows |
| 2 | Engine core: loader, `time-windows`, `versions`, `fx`, `aggregate`, `spine` → `statement()` Variance layout, no slices, P and S | **T-06 all 552 control totals pass**; T-11, T-12, T-13 |
| 3 | Shell to the Ledger guide: header, company cards, rail (collapsed), view tabs, notice strip, StatementTable (Variance layout), URL state schema, headers in `next.config.ts`; write the **`.sync/` hand-off** (2.6) and update `.sync/README.md` | `npm run build` green locally (reads `../data`); local run shows Consumer Products YTD Sep 2026 NR 3,398.5 / Adj. EBITDA 682.6; Commerce Cloud 596.0; CSP + frame-ancestors in the response headers (local `curl -I` — no deploy exists yet, the CLAUDE.md local-testing exception applies); hand-off file present, status `ready` |
| — | **Hand-off.** Everything below is finished, hosted and embedded by the vosk.dev repo from the `.sync/` package. | — |
| 4 | Group view + `intercompany`, Entity-columns and Trend layouts, detail levels, expand/collapse, hide-empty | T-01, T-02, T-16; Group YTD Sep 2026 NR 3,972.7 |
| 5 | Slices + `allocation`, the four flyouts, context line, notices, F-30 memory, Reset | T-03 + parity; T-14, T-15; C-50 notices appear |
| 6 | Key figures view + `kpis` over `ops.parquet` | T-17; tile NR / margins equal the statement |
| 7 | Analysis view: `bridge` + `variances` | T-05, T-10 |
| 8 | Profitability view + by-nature lens | T-04; shares sum to 100 %, NR column sums to total NR |
| 9 | Hardening: keyboard + focus pass (N-08), engine bench (T-18), Lighthouse on the hosted URL, embed smoke test from an allowed origin; final deploy (vosk.dev repo) | CI green; LCP and N-01 recorded |

Slices 0–3 are this repo's deliverable: a reconciled statement (T-06 552/552) running locally, plus the `.sync/` hand-off. Slices 4–9 layer on in the vosk.dev repo without touching the engine API.

### 2.9 New dependencies — approved by the USER (2026-10-22, §5 Q1)

| Package | Version (registry, 2026-10-22) | Role | Why this one |
|---|---|---|---|
| `next` | 16.4.2 | framework | ADR-0001 |
| `react`, `react-dom` | 19.3.1 | UI | Next 16 peer |
| `zod` | 4.6.7 | URL-state and manifest validation at the boundary | schema-first contract shared by state and tests |
| `hyparquet` | 1.31.5 | Parquet reader (browser + Node), zero deps, snappy built in | replaces DuckDB-wasm |
| `hyparquet-writer` | 0.17.0 (dev) | Parquet writer in the build script; snappy default, per-column encoding | same author/format as the reader; **0.x maturity risk** — fallback is `pyarrow` from the existing `fabric-data/.venv` writing the same files, or gzip JSON columns |
| `typescript` | 5.9.3 | | TS 7.0 (native port) is out but untested with Next 16 here; stay on 5.x |
| `vitest` | 5.0.5 (dev) | tests | ADR-0001. `vite` arrives as a required peer of vitest — accepted, not a direct dependency |
| `eslint` 9, `eslint-config-next`, `prettier`, `@types/node`, `@types/react`, `@types/react-dom` | create-next-app defaults (dev) | lint / types | standard; eslint stays on 9 |

Explicitly **not** added: `@duckdb/duckdb-wasm`, `apache-arrow`, `tailwindcss`, any chart library, `nuqs`, `tsx`, `csv-parse`, `exceljs`/`xlsx`, `@vercel/analytics`.

## 3. Alternatives considered

| Option | Verdict |
|---|---|
| DuckDB-wasm + Parquet (ADR-0001 default) | Rejected (2.1): several MB of wasm and a worker for 8 fixed queries over 0.4 M rows; splits §7 across SQL and TS |
| Ship `fact_pl_allocated` (1.11 M rows) instead of allocating in the engine | Kept as the fallback flag; not default: 2.6× the payload for a one-line formula the engine needs to understand anyway (alloc. tags, notices) |
| Pre-translate to the 3 reporting currencies × 2 FX bases at build | Rejected: 6× the amount columns; translating per row in the browser is a multiply and is exactly D-30 |
| Pre-aggregate months into windows | Rejected: breaks Trend, LTM across years, LE splicing |
| JSON columnar + gzip (no Parquet) | Viable; kept as the fallback if `hyparquet-writer` fails within an hour |
| Static export (`output: 'export'`) | Rejected: `headers()` (CSP, frame-ancestors) is not supported in export mode; the default Next build pre-renders the single page anyway |
| Tailwind 4 (as Track A) | Not needed: the guide is px/hex values; CSS variables + Modules add no dependency |
| Spec §2 nine-zone scrolling layout | Not chosen: Tracks A and B follow the Ledger one-window layout; parity across flavours matters for the showcase (USER confirmed, §5 Q2) |
| Host and embed Track C from this repo (Vercel project `pnl-js-report` in team `yaga`) | Rejected by the USER (§5 Q4): this repo ships the three assets only (ADR-0001 §2); the vosk.dev repo owns hosting and embedding, so the skeleton plus a `.sync/` hand-off is the deliverable here |

## 4. Consequences

- One implementation of §7 in TypeScript, tested in Node against the 552 control totals; the UI never computes a number.
- The browser downloads ≈ 2–3 MB for the default view and nothing else; no backend, no cold start, no per-query cost.
- Track C's numbers come from the repo CSVs, not from `lh_raw`; the three flavours reconcile through `control_totals_usd.csv` (T-06), not through a shared store. A later switch to a shared source would replace `scripts/build-data.ts` only.
- `hyparquet-writer` 0.x is the one immature dependency; it is build-time only and has two documented fallbacks.
- This repo stops at slice 3 plus the `.sync/` hand-off. No Vercel project, no deploy, no `.mcp.json` change here; hosting, embedding and slices 4–9 belong to the vosk.dev repo. The data contract (2.3), URL state (2.4) and embed contract (2.6) are the interfaces the hand-off freezes; changing them later means a new `.sync/` file with status `superseded` on the old one.
- Deferred (confirmed by the USER, §5 Q5), with reasons: N-10 Excel export (dependency), M-27 drill-through (no journal data), F-37 per-user memory (iframe storage), L-02 reference pages (scope), nonce-based CSP (time), phone layout (N-09 — summary detail on narrow screens is a follow-up).
- ADR-0001 §3 is amended for C (DuckDB-wasm removed; hosting moved to the vosk.dev repo); `docs/ADD/tech-stack.md` Track C rows updated 2026-10-22.

## 5. Open questions — resolved by the USER, 2026-10-22

1. **Dependencies (2.9)** — *Resolved: approved as listed.* Implementation notes from nerd, accepted: `vite` comes in as a required peer of `vitest` (not a direct dependency); `eslint` stays on 9; `typescript` 5.9.3.
2. **Layout** — *Resolved: Ledger one-window layout.* The page switchers (view tabs) control what is shown; same ADR-0004 deviation from L-10/L-03 as Tracks A and B.
3. **Allocation in the engine** — *Resolved: accepted* as Track C's reading of C-32 (C-31 computed live, parity-tested against `fact_pl_allocated`).
4. **Hosting / Vercel / embedding** — *Resolved: no Vercel project, no deploy and no embedding work in this repo.* This repo builds the minimum skeleton (2.8 slices 0–3) plus the `.sync/` hand-off; an agent in the vosk.dev repo picks it up, finishes slices 4–9, hosts and embeds it. `EMBED_ALLOWED_ORIGINS` values and any `.mcp.json` entry are the vosk.dev repo's to decide.
5. **Scope cut** — *Resolved: everything on the deferred list stays deferred* (N-10, M-27, F-37 per-user memory, L-02, phone layout, nonce-based CSP).

# Track C hand-off — custom JS P&L report (minimum skeleton)

- **From:** rusloc/pnl (Track C, nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-22
- **Status:** ready

This file is the shared copy. The sources of truth stay in rusloc/pnl: `docs/ADR/0002-track-c-architecture.md` (blueprint, build order), `docs/Requirements.md` (spec IDs), `docs/design/design-requirements.md` (Ledger design) and the code in `js-report/`. If they disagree, those win.

## 1. What Track C is

Track C is the custom JavaScript version of the ACME Unified P&L: one management P&L (IFRS 18 spine) for ACME Consumer Products (P), ACME Commerce Cloud (S) and ACME Group, built from the same spec and dummy data as the Rayfin app (Track A) and the Power BI report (Track B). It is a Next.js App Router app with **no backend**. A build script turns the repo CSVs into small Parquet files; the browser loads them and a framework-free TypeScript engine (`lib/engine/`) computes every number. The page is meant to be embedded on vosk.dev in an iframe.

## 2. USER decisions on ADR-0002 (2026-10-22)

| # | Question | Decision |
|---|---|---|
| Q1 | Dependencies | Approved exactly as listed: `next` 16.4.2, `react` / `react-dom` 19.3.1, `zod` 4.6.7, `hyparquet` 1.31.5; dev: `hyparquet-writer` 0.17.0, `typescript` 5.9.3, `vitest` 5.0.5, `eslint` 9 (stay on 9, no upgrade), `eslint-config-next` 16.4.2, `prettier`, `@types/*`. `vite` 8 comes in only as vitest's required peer (accepted). Add nothing else without asking. |
| Q2 | Layout | Ledger one-window layout; the view tabs switch what the content area shows. |
| Q3 | Allocation | **Accepted: allocation computed in the engine** (C-31 live), not shipped as pre-allocated rows. Step 5 is unblocked. |
| Q4 | Hosting | No Vercel in rusloc/pnl. **The vosk.dev agent hosts and embeds Track C.** |
| Q5 | Scope cut | All deferred (see §9). |

ADR-0002 is accepted in rusloc/pnl (2026-10-22) with these decisions recorded in its §5; slices 4–9 of its §2.8 build order are the vosk.dev repo's.

## 3. Where the source lives and how to build it

- Repo `rusloc/pnl`, branch `prod`, folder **`js-report/`** (Node ≥ 24; the build script uses Node's native TypeScript type stripping).
- Build: `cd js-report && npm ci && npm run build`. `prebuild` runs `scripts/build-data.ts`, which reads **`../data/acme_pl_dummy_data/`** (CSV, RFC 4180) and writes `public/data/` (gitignored build output). So the `data/acme_pl_dummy_data/` folder must sit next to `js-report/`.
- **Without the CSVs:** `.sync/track-c/data/` holds a copy of the built `public/data/` (`pl-P.parquet`, `pl-S.parquet`, `ops.parquet`, `manifest.json`, built 2026-10-22). Copy the four files into `js-report/public/data/` and run `npx next build` (not `npm run build`, whose `prebuild` needs the CSVs). Tests read the same files.
- Scripts: `npm run lint` · `npm run typecheck` (`next typegen && tsc --noEmit`) · `npm run build` · `npm test` (Vitest; needs `public/data/` first) · `npm run build:data` · `npm run format`.
- Gate, in CI order: lint → typecheck → build → test. All four are green at hand-off.

## 4. Engine API (`js-report/lib/engine/index.ts`)

The UI calls this and nothing else. Values are unrounded, in whole units of the reporting currency, with ratios as fractions; `lib/engine/format.ts` is the only place that rounds (D-30).

```ts
const loader = createDatasetLoader((name) => fetch(`/data/${name}`).then((r) => r.arrayBuffer())); // lib/data/dataset.ts
const dataset = await loader.load(['P']);          // ['P', 'S'] for the Group view; cached per session
const engine = createEngine(dataset);

engine.statement(sel)  // → { rows: StatementRow[], plan: VersionPlan }
engine.notices(sel)    // → Notice[]  C-50 period / version conditions (PAST_CLOSE, FORECAST_MONTHS, PY_MISSING, PY_PARTIAL, LTM_BEFORE_HISTORY)
engine.context(sel)    // → "YTD Sep 2026 · Actual vs Budget and Prior year · USD m, actual rates · All slices" (L-04)
engine.dataStatus()    // → { lastClosedMonth: '2026-09', builtAt }  (N-02 / N-03)
```

- `StatementRow` holds `code`, `kind` (block · leaf · subtotal · ratio · memo · group_total), `label`, `alias`, `parent`, `level`, `tag` (IFRS 18 · MPM · Mgmt · IC), `isKey`, `isCost`, then `base`, `pctNr`, `compareA` / `compareB` (each `{ value, delta, deltaPct, favourable }`; `null` = column off; `value: null` = "n/a"), `fyBudget`, and `fyLE` (with Δ vs FY Budget).
- Δ = base − comparison on signed values; positive = favourable on every line (M-10, T-13). The effective tax rate is never coloured (M-11).
- Still to come per ADR-0002 §2.3 (not built): `kpis`, `bridge`, `largestVariances`, `profitability`. The engine **throws** on unbuilt selections (other layouts, the By-nature lens, slice filters) instead of ignoring them.

## 5. Selection and URL state (`js-report/lib/state/selection-schema.ts`)

- The URL query string is the whole state (F-37 link). `createSelectionCodec(manifest)` gives `parse(URLSearchParams)`, `serialize(sel)` and `defaults(entity)`. Every key is Zod-validated: an invalid value falls back to its default, unknown keys are dropped, and the URL is rewritten. Defaults are omitted, so the bare URL is the spec default: Consumer Products, FY2026, Sep, YTD, Actual vs Budget and Prior year, USD m, actual rates.
- Short keys (ADR-0002 §2.4):

| Key | Field | Values |
|---|---|---|
| `e` | entity | P · S · GROUP |
| `fy` | fiscal year | 2024 … 2026 |
| `m` | month | 1 … 12 |
| `tv` | time view | MTD · QTD · YTD · LTM · FY |
| `b` | base | A · LE · B |
| `ca`, `cb` | compare A / B | B · LE · PY · NONE |
| `r`, `ch`, `ln`, `sg` | region, channel, line, segment | comma-separated codes; empty = all |
| `cur` | currency | USD · EUR · GBP |
| `fx` | FX basis | ACT · CC |
| `u` | units | M · K |
| `cs` | costs shown | NEG · POS |
| `vf` | variance format | BOTH · ABS · PCT |
| `pn`, `fo`, `tg`, `he` | % NR, FY outlook, tags, hide empty | 0 · 1 |
| `lay` | layout | VAR · TREND_M · TREND_Q · ENTITY |
| `lens` | cost lens | FN · NAT |
| `d` | detail | SUM · STD · FULL |
| `bd` | breakdown | REGION · CHANNEL · LINE · SEGMENT · ENTITY |
| `v` | view | statement · kpi · analysis · profitability |

- `restrictToBuilt()` in the same file maps unbuilt choices back to built ones, so a link made for a later build still opens on real numbers: Group → P, layout → VAR, detail → STD, slices → all, lens → FN, view → statement. **Remove each line of it as its step lands.**
- Deep links are the integration API for the embed: iframe `src` = the Track C URL plus any query string above.

## 6. Embed contract (ADR-0002 §2.6)

- Embed with an **`<iframe>`**. The app assumes nothing about the host: no `postMessage`, no host CSS, no auth, no cookies, no storage. The host sizes the frame (recommended 16:9 of its width, min height 810 px; the app is usable from 1024 px wide, N-09).
- Headers (`js-report/next.config.ts`, verified by `curl -I` on `next start`):
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - No `X-Frame-Options` (it would block the embed; `frame-ancestors` replaces it), and no `X-Powered-By`.
- Fonts (IBM Plex Sans + Sans Condensed) are self-hosted by `next/font` at build time; the build needs network access to Google Fonts once. There are no third-party requests at runtime.
- "Copy link" builds the absolute URL from `NEXT_PUBLIC_SITE_URL` (falls back to the page's own origin). If the clipboard is blocked inside the host iframe, it shows the link in a read-only field. An iframe needs `allow="clipboard-write"` for the clipboard to work.

## 7. Environment variables

| Name | Where read | Meaning |
|---|---|---|
| `EMBED_ALLOWED_ORIGINS` | `next.config.ts`, **at build time** (headers are compiled into the build) | Comma-separated bare origins allowed to frame the app, e.g. `https://vosk.dev,https://www.vosk.dev`. Must be https (`http://localhost` / `http://127.0.0.1` allowed for local testing). A malformed entry fails the build. Empty = same-origin framing only. |
| `NEXT_PUBLIC_SITE_URL` | client (inlined at build) | Public URL of the Track C deployment: copy-link base and `metadataBase`. Client-safe by design. |

No secrets exist in Track C.

## 8. Status at hand-off

**Artifacts** (`public/data/`; fails above 5 MB):

| File | Rows | Size |
|---|---:|---:|
| `pl-P.parquet` | 334,700 | 1,155.0 kB |
| `pl-S.parquet` | 88,012 | 331.0 kB |
| `ops.parquet` | 26,784 | 130.5 kB |
| `manifest.json` | — | 104.0 kB |

- First load (manifest + ops + pl-P) is 1.39 MB against a 3 MB budget; the total is 1.72 MB against 4 MB.
- Page JS is about 239 kB gzip.
- The superseded forecast cycle FC2606 is not shipped.

**Tests: 94 passing in 11 Vitest files.**
- **T-06: 552/552** rows of `control_totals_usd.csv` (P, S, GROUP × 8 windows × 23 lines) within 0.01 USD; the largest difference is 0.005 USD.
- T-07, read round-trip and allocation parity (702,420 rows vs `fact_pl_allocated`, within cents) are asserted in the data build.
- T-11, T-12, T-13; C-50 notices; L-04 context line.
- URL codec: defaults, round-trip, invalid → default, unknown keys dropped, F-32 / F-33.
- F-15 cost sign; N-06 formats.
- Server render of the statement with real numbers: P YTD Sep 2026 NR 3,398.5, Adj. EBITDA 682.6.

**Built (ADR-0002 steps 0–3):**
- Scaffold, data build, and engine core (time windows, versions C-01…C-05, FX C-11…C-13, per-row translation D-30, spine formulas D-32, format).
- The Ledger shell to the design guide:
  - Rail with the four flyouts. Period, Versions and Display work. Slice shows a notice and disabled rows.
  - Company cards P and S. Group is disabled with its reason.
  - View tabs: only P&L statement is live; Key figures, Analysis and Profitability are disabled with their reasons.
  - Toolbar: only Variance / By function / Standard are live; the rest are disabled with reasons.
  - Notice strip, context line, and Copy link.
- StatementTable in the Variance layout: sticky line column and header, row kinds, expand/collapse with the Standard default open set, tags, the ±15 % bar, cost sign, variance format, the % NR and FY outlook toggles, and the footnote.
- Zod URL state and the CSP headers.
- Local smoke check: `next build` + `next start`; `curl` shows the shell HTML, the exact headers above, `/data/*` served (200) and a 404 for missing files.
- **Not verified in a real browser** (no browser in that session): client rendering, flyout focus handling and URL sync through `history.replaceState` (the pattern Next documents for `useSearchParams`). Click-test it first.

**Left to finalize (ADR-0002 §2.8):**

| Step | Content | Proof required |
|---|---|---|
| 4 | Group view: elimination rows `ELIM_GR` / `ELIM_VSC` (and `OOI_4` intercompany difference, C-37), entity nodes (M-05), Entity-columns and Trend layouts, detail levels, hide-empty | T-01, T-02, T-16; Group YTD Sep 2026 NR 3,972.7. The consolidation itself (rows without a counterparty) already passes T-06. |
| 5 | Slice filters + allocation in the engine (**unblocked, Q3 accepted**), F-30 per-entity slice memory, slice notices | T-03; parity vs `fact_pl_allocated` (formula already proven in `scripts/build-data.ts` §4); T-14, T-15 |
| 6 | Key figures over `ops.parquet` | T-17; tiles equal the statement |
| 7 | Analysis: bridge (C-40) + largest variances (C-45) | T-05, T-10 — **GROUP included: the elimination step must be a delta (base − comparison), not a level.** Tracks A and B have that bug (gap 106.3 M); START + steps must equal END. |
| 8 | Profitability (C-46) + By-nature lens (M-23/M-24) | T-04; shares sum to 100 % |
| 9 | Hardening: N-08 keyboard/focus pass, engine bench T-18 (N-01), Lighthouse on the deployed URL, embed smoke test from an allowed origin | CI green; LCP and N-01 recorded |

## 9. Deferred (Q5 — all deferred)

- N-10 Excel export / PDF snapshot (would need a dependency).
- M-27 drill-through (no journal data).
- F-37 "remember the last selection per user" (iframe storage is partitioned; the link is the mechanism).
- L-02 reference pages.
- Phone layout (N-09 summary detail on narrow screens).
- Nonce-based CSP (Next 16 `proxy.ts`), which would replace `'unsafe-inline'`.

## 10. Known gotchas

- **Windows Smart App Control** blocks unsigned native binaries: `next` falls back to `@next/swc-wasm-nodejs` by itself (slower, works); the first `vitest run` can fail with "Cannot find native binding" from rolldown, and a retry passes. Don't "fix" it by deleting the lockfile or adding wasm packages.
- **`cacheComponents: true`** (create-next-app 16.4.2 default) is on: any client component that reads `useSearchParams` must sit under a `<Suspense>` boundary (`app/page.tsx` does this), or the static prerender fails.
- **`typecheck` runs `next typegen` first**: the gitignored `next-env.d.ts` imports generated route types, so `tsc` alone fails on a fresh checkout.
- `EMBED_ALLOWED_ORIGINS` is read at **build** time; changing it needs a rebuild.
- `npm test` reads `public/data/`; run `npm run build:data` (or copy `.sync/track-c/data/`) first.
- Build-time code (`scripts/`, and everything it imports from `lib/`) must stay erasable TypeScript (no enums, namespaces or parameter properties) with explicit `.ts` import extensions, because Node runs it with type stripping.

# ACME Trucks: Time utilization (JS flavour)

Standalone Next.js app of the Power BI page "Time utilization" (ADR-0016; contract `docs/ADD/features/trucks-js-flavour.md`). Static shell, everything in the browser: pre-aggregated Parquet in `public/data/` + the pure-TS engine in `lib/engine/`. No backend, no API route.

## Commands

| Command                                                          | What it does                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run build:data`                                             | `../pbi-report/ACME Trucks/data/` → `public/data/` (runs the §2.4 checks; also `prebuild`) |
| `npm run build:fixtures`                                         | `build:data` + `fixtures/data-unfiltered/` (every `dim_loader` row, tests only)            |
| `npm run typecheck && npm run lint && npm test && npm run build` | The gate. `npm test` reads `public/data`, so run `build:data` first                        |

Runtime hooks: `EMBED_ALLOWED_ORIGINS` (server-side, comma-separated https origins → CSP `frame-ancestors`), `NEXT_PUBLIC_SITE_URL` (`metadataBase`, optional). Board: 1440 × 810, light only. Node ≥ 24 (type stripping, built-in zstd for the source Parquet).

URL keys: `w` (`yyyy-ww`) · `o` · `l` · `wt` (`trucks,onspot,undefined`) · `pt` (`month`, `week`) · `calc` (`weighted`, `linear`). Defaults are omitted.

## Deviations

From the contract, each settled by the TMDL or the pinned rows (the TMDL wins, contract precedence):

- §3.3 `ratio`: BLANK ÷ a number is BLANK, not 0 (pinned rows of sort 22).
- §3.3 bars: `_WF * Subtotal` is BLANK on loss rows (plan Linear: 0); `_WF Fact Loss` is 1 on Total time under Weighted; `_WF * Base` on subtotal rows follows each DAX branch (fact Linear BLANK, plan Linear 1). None of these reach a bar, which reads the subtotal on subtotal rows and the loss on the others.
- §2.3 row counts: actuals are 2,688 / 1,533 / 2,522 / 2,671; the estimates counted every loader, before the fixed filters.
- §5.2 row height: 22.5 px, not ≈ 23.4 (20 rows must end above the axis strip at y 756).
- §5.2 chips: 12 px with tighter padding, not the mockup's 13 (the text does not fit the PBIR widths at 13; §5.2's fallback clause).
- §5.3 tooltip labels: `Plan share` / `Fact share`, from `tt_plan_lbl` / `tt_fact_lbl`.

From the PBIP strings: column headers `%` / `%` (mockup, §5.4 (3)); Done for the mockup's Apply (§5.4 (1)); `Copy link` (§6) has no PBIP counterpart.

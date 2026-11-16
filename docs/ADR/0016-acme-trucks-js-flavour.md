# ADR-0016 — ACME Trucks: web app flavour of the "Time utilization" page

- **Status:** Accepted (USER, 2026-11-09). Hand-over status of the report: draft (USER, 2026-11-09).
- **Date:** 2026-11-09
- **Decider:** USER (data, scope); main agent and archi (pattern, defaults)

## Context
ACME Trucks exists as a Power BI report only. vosk.dev needs it as a standalone web app, as for Nordmark and ACME Marketing.

## Decisions
| | Decision |
|---|---|
| Data | The report's live extract as is (USER 2026-11-08: "keep all data as is, no changes"). No synthetic twin. Rolled up to loader × business week × time category. |
| Public exposure | The shipped data is readable from the public page: real figures, mines and loaders under the model's aliases (`K1`, `LDR-…`). Original names do not ship. |
| Scope | The "Time utilization" page and its row tooltip. "Time util (original)" is not built: hidden in reading view, same numbers. |
| Reference | Power BI as built for numbers and behaviour. `Design guide/Main.dc.html` for the look where Power BI's limits forced a compromise. |
| App | Standalone `js-trucks/`: Next.js 16, pure-TS engine, pre-aggregated Parquet, no backend; toolchain and pins of `js-marketing/`. Board 1440 × 810. Hosted and embedded by the vosk.dev repo. |
| Gate | The bundle is issued only after PBI = JS parity shows 0 gaps. The oracle is the pinned values in `pbi-report/ACME Trucks/tests/`. |

**Defaults in force** (contract §10 A–E): opens at the Reset state; board fixed at 810 px; popovers apply on Done; no ⓘ or How-to-read; pack issued with a note update only.

## Rejected
- Synthetic twin: USER decision; the Power BI tests pin the live extract.
- Shipping the 8 source Parquet files: about 2.2 MB and 850 k rows, for a page whose finest read is loader × week.
- Day grain: nothing on the page reads a day.
- Building both pages; a route inside another app; dark theme.

## Result (2026-11-09)
- Data: first paint 264,724 B, total 343,096 B.
- Parity: 1,649 rows, 0 gaps, 2 accepted (difference 16 in `docs/design/parity-rules.md`). Independent recomputation from the model: 551,040 values, 0 differences.
- Tests: 68 in the repo; 62 + 6 skipped in the bundle.

## Consequences
- A fourth standalone JS app and pack; duplicated tooling is accepted.
- Switching to the synthetic twin later means changing the build's input folder and re-basing the oracle.

## Pointers
- Contract (engine rules, visual contract, URL state, parity): `docs/ADD/features/trucks-js-flavour.md`
- App: `js-trucks/` · Bundle: `.sync/acme-trucks/js-app/` · Hand-off: `.sync/2026-11-04-acme-trucks-handoff.md`
- Pack rules: ADR-0014 · Pattern: ADR-0015 · Parity evidence: `js-trucks/lib/test-utils/parity/parity-notes.md`

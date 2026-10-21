# Features & decisions — ACME Unified P&L

Human-readable `idea → decisions → features` read-through of the ADR ledger (`docs/ADR/`). Updated daily in lockstep with `.log/daily/`.

TODO: lock North Star

## Ideas
- **2026-10-21 — One DAX truth for A + B:** the Rayfin app (A) reads the PBI semantic model (B) through a Rayfin connector instead of re-implementing the measures. To validate in ADR-0003.
- **2026-10-21 — Reconciliation gate:** every flavor's numbers are checked against `data/acme_pl_dummy_data/checks/control_totals_usd.csv` (T-06) in CI.

## Decisions
- **2026-10-21** — Three tracks in one repo, one folder each: A Rayfin `fabric-app/`, B PBI `pbi-report/`, C JS `js-report/`. (ADR-0001)
- **2026-10-21** — This repo delivers assets only; vosk.dev embedding lives in a separate repo. (ADR-0001)
- **2026-10-21** — Single branch `prod`, no feature branches. (ADR-0001)
- **2026-10-21** — Stack defaults: C = Next.js on Vercel + pre-aggregated Parquet + DuckDB-wasm; A + B = one Fabric Lakehouse/Warehouse loaded from the CSVs; no dbt. (ADR-0001)
- **2026-10-21** — Orchestrated roster of 8 agents: bip, ginee, fin, archi, nerd, hunter, chef, svg-designer. (ADR-0001)
- **2026-10-21** — Locales: `en` only. North Star deferred.

## Features
### Planned
- Shared Fabric data layer (CSV → Lakehouse/Warehouse) — feeds A + B
- Track A — Rayfin (Fabric) app
- Track B — Power BI report (PBIP)
- Track C — custom JS report (Next.js)

### Implemented
_(none yet)_

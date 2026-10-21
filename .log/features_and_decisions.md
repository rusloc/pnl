# Features & decisions — ACME Unified P&L

Human-readable `idea → decisions → features` read-through of the ADR ledger (`docs/ADR/`). Updated daily in lockstep with `.log/daily/`.

TODO: lock North Star

## Ideas
- **2026-10-21 — One DAX truth for A + B:** the Rayfin app (A) reads the PBI semantic model (B) through a Rayfin connector instead of re-implementing the measures. To validate in ADR-0003.
- **2026-10-21 — Reconciliation gate:** every flavor's numbers are checked against `data/acme_pl_dummy_data/checks/control_totals_usd.csv` (T-06) in CI.
- **2026-10-21 — Track B engine redesign:** if incremental DAX fixes don't reach N-01 (2 s), restructure the P&L / KPI engine (calculation groups, fewer per-cell evaluations, no branchy SWITCH per row).
- **2026-10-21 — AI chat in the Rayfin app:** an LLM in a Rayfin function with allow-listed DAX tools run as the signed-in user through the delegated `pnlModel` connector, so RLS applies to answers. Goes on top of ADR-0006 once all views are live; a Fabric data agent is the Fabric-native alternative (but owner identity via UDF). ADR pending.
- **2026-10-21 — Public showcase access:** vosk.dev visitors can't sign in to the corporate tenant → recording / screenshots or demo accounts for Track A.

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

## Features
### Planned
- Track B — performance round 2 (target N-01 2 s; matrix ~7.7 s, Key figures ~45 s) + ADR-0004 decision
- Track A — phase 2: all views + filters live on `pnlModel`, then RLS (roles, grants, demo users); optional logical keys on dims + FactFxRate
- Track A — AI chat on the semantic-model path (ADR pending)
- Track B — T-05 GROUP bridge fix
- ACME Trucks — clean report-page tooltips on the waterfall bars; `_KPI Noise` decision; pre-publish (`DataFolder`, embed locale)
- Track C — custom JS report (Next.js)

### Implemented
- **2026-10-21** — Shared Fabric data layer: `lh_raw.acme_pl` (28 tables) via `fabric-data/lh_raw/load_acme_pl.py`; verified (row counts + NR control total diff 0.00)
- **2026-10-21** — Track A scaffold: Rayfin app `acme` in `fabric-app/`, connector `lhraw`, probe page; deployed by USER
- **2026-10-21** — Track B local PBIP draft: model (128 measures), one-window page (4 views, side bar + 3 restyled pop-ups), DAX control-total tests; ",," fix; validator 0/0, replica 552/552 (in-Desktop DAX tests pending)
- **2026-10-21** — Track B rebuilt to the Ledger design (rail + 4 flyouts, company cards, tabs, notice strip, 4 views; 175 measures); v1 backup in `pbi-report/__backup__/v1-draft-2026-10-21/`; validator 0/0, replica 552/552 (Desktop check pending)
- **2026-10-21** — Track A Ledger app shell (all 4 views, filters, real dims, sample numbers flagged); deploy bundle fix + `check:bundle` gate
- **2026-10-21** — Track A honest sample mode (96 tests) → live P&L statement via `pnlModel`, Month live (ADR-0006 phase 1; 124 tests; deployed; USER click-test pending)
- **2026-10-21** — Track B model `ACME Unified PnL` published to RAW; refresh 28 s; T-06 pass on service (T-05 GROUP open)
- **2026-10-21** — ACME Trucks local Import model (14 Parquet tables, baseline 591/591 vs live) + one-page English redesign to the design guide (tests 536/536 + 390/390, validator 0/0; USER Desktop check pending)

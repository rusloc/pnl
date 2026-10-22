# ADR-0001 — Project init

- **Status:** accepted
- **Date:** 2026-10-21
- **Decider:** USER (via init proc interview)

## Context
New repo for the ACME Unified P&L: one spec (`docs/Requirements.md`), one dummy dataset, three delivered flavors, showcased on vosk.dev.

## Decisions
1. **Tracks:** three tracks in one repo, one folder each — **A** Rayfin app `fabric-app/`, **B** Power BI report `pbi-report/`, **C** custom JS report `js-report/`. This departs from the CLAUDE template's one-track rule on purpose.
2. **Delivery:** this repo ships the three assets only. The vosk.dev site wrapper and embedding live in a separate repo.
3. **Stack:** C = Next.js on Vercel + pre-aggregated Parquet + DuckDB-wasm; A + B = one Fabric Lakehouse/Warehouse loaded from the CSVs; no dbt. Details in `docs/ADD/tech-stack.md`.
   *Amended 2026-10-22 by ADR-0002:* Track C drops DuckDB-wasm for a pure-TypeScript engine over Parquet (`hyparquet`), and hosting/embedding move to the vosk.dev repo via `.sync/`; the rest of this item stands.
4. **Branching:** single branch `prod`; no `dev`, no feature branches.
5. **Agents:** orchestrated. Main agent: Claude Opus 5.5. Sub-agents: bip, ginee, fin (fabric-app-builder), archi (web-app-architect), nerd (nextjs-react-nerd-reviewer), hunter (qa-test-hunter), chef (db-chef), svg-designer. Dropped: papa (product-manager), ferry (data-engineer-ferry) and 19 skills (list in `.log/coms/coms-2026-10-21.md`), quarantined in `_removed/2026-10-21/`.
6. **North Star:** deferred.
7. **Locales:** `en` only.

## Consequences
- CLAUDE.md carries three track blocks instead of one.
- Every push lands on `prod`; Vercel builds production from it. Manual tests run on deployed targets.
- Open follow-ups: Fabric workspaces/capacity, PBI deploy method, spec coverage per flavor, ADR-0002 (Track C data architecture), ADR-0003 (Fabric data layer for A + B).

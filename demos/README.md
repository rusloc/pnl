# Fabric demo cases

Assets for three short videos. Decisions: `docs/ADR/0018-fabric-demo-cases.md`. Build plan: `docs/ADD/features/fabric-demos-sdd.md`. Specs (the contract): `.log/reports/Spec 1 · …`, `Spec 2 · …`, `Spec 3 · …`.

| Folder | Case | Fabric | Status |
|---|---|---|---|
| `01-migration/` | Power BI → Fabric migration: Import vs Direct Lake, new data in seconds | `ws_migration_demo` · `lh_sales_demo` | data 30 M built; `Sales Direct Lake` live = gold; `Sales Import` waits on the USER's connection; guide written (2026-11-24) |
| `02-slow-report/` | Slow report, live fix: one `FILTER ( Sales, … )` → column filter, ≥ 10× faster | reuses `lh_sales_demo` | PBIP + `measures.dax` / `perf_test.dax` + guide written; benchmark waits on the `Sales Import` refresh (2026-11-24) |
| `03-cicd/` | CI/CD: measure fix pushed from a local clone to GitHub, pulled into Dev, one Deploy click to Prod (Git is the source, ADR-0018 amendment 4) | `ws_cicd_demo_{dev,prod}` · GitHub `rusloc/fabric-cicd-demo` (clone `C:\__PBI\fabric-cicd-demo`) | Dev + Prod seeded, `Sales CICD` live; pipeline Dev → Prod with Production rules (Test dropped); Dev Git-connected, items at the repo root (2026-11-24); guide rewritten for the Git-first loop; rehearsal pending |

Rules: names exactly as in the specs · PBIP is the source, `.pbix` stays local · synthetic data only · numbers in the videos come from `run_log.md` / `perf_log.md`, never from the specs · no secrets anywhere.

Each case folder: `guide.md` (USER click guide: prerequisites, rehearsal, recording run, § 10 checklist) · `run_log.md` (IDs, timings, checks).

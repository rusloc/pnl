# SDD — Fabric demo cases (migration, slow report, CI/CD)

- **Status:** draft v1.1, 2026-11-24 (main agent). Decisions: ADR-0018 (+ amendments: (fx) measures in `_Measures`; Spec 3 Dev → Prod only).
- **Specs (contract, read first):** `.log/reports/Spec 1 · …`, `Spec 2 · …`, `Spec 3 · …` (2026-11-23). This SDD adds only *how we build*; names, data, DAX, steps and acceptance checks are the specs'. Where the SDD and a spec disagree, the spec wins unless ADR-0018 says otherwise.
- **Goal:** every acceptance check of the three specs ticked, so the USER can rehearse and record three ~2.5-minute videos.

## 1. Overview

| Case | Story | Fabric items | Built by | USER does |
|---|---|---|---|---|
| 1 Migration | New data in Direct Lake in seconds; Import waits for a refresh | `ws_migration_demo`: `lh_sales_demo`, `nb_01_build_sales_demo`, `nb_02_append_day`, models + reports `Sales Import`, `Sales Direct Lake` | ginee (workspace, lakehouse, notebooks, deploys, refresh), bip (both models' logical layer, report, DAX checks) | data-source OAuth for the Import model; Desktop click-through of the Direct Lake creation (rehearsal); recording |
| 2 Slow report | One `FILTER ( Sales, … )` measure; fixed live, ≥ 10× faster | reuses `lh_sales_demo`; local `Slow Report Demo` PBIP / PBIX | bip (model, measures, page, `measures.dax`, `perf_test.dax`, first timings) | opens the PBIP in Desktop, saves the PBIX, DAX Studio run, recording |
| 3 CI/CD | Measure fix Dev → Prod via Git commit + Deploy (no Test stage, USER 2026-11-24) | `ws_cicd_demo_{dev,prod}`, `lh_cicd_demo` × 3, `nb_seed_sales`, `Sales CICD` model + report, pipeline `dp_cicd_demo`; GitHub `rusloc/fabric-cicd-demo` | ginee (workspaces, lakehouse, notebook, deploy, pipeline, Git wiring), bip (model with M parameters, report) | creates the GitHub repo + connects Git (PAT / OAuth); deployment rules (owner only); recording |

## 2. Repo layout

```
demos/
  README.md                         → index, status per case, links to specs, ADR-0018, this SDD
  01-migration/
    notebooks/                      → nb_01_build_sales_demo, nb_02_append_day (Fabric notebook source, spec code verbatim)
    pbi/Sales Import/               → PBIP: Import from the SQL endpoint, PQ shaping, calc column, calc table (the "legacy" pieces, on purpose)
    pbi/Sales Direct Lake/          → PBIP: Direct Lake on OneLake, gold tables, same contract; report = rebound copy
    tests/acceptance.dax            → Spec 1 § 10 DAX checks
    guide.md                        → USER click guide (Desktop steps, rehearsal, recording run § 9)
    run_log.md                      → spec § 10 numbers from real runs
  02-slow-report/
    pbi/Slow Report Demo/           → PBIP with the slow body; the fixed copy differs in one measure
    measures.dax · perf_test.dax    → spec § 6 / § 7
    guide.md · perf_log.md
  03-cicd/
    notebooks/nb_seed_sales         → spec § 5
    pbi/Sales CICD/                 → PBIP: Direct Lake on OneLake with M parameters WorkspaceId / LakehouseId
    guide.md                        → parts A, B (+ part C recipe, not built)
    run_log.md
```

Rules: names exactly as in the specs; PBIP is the source, `.pbix` stays local (ADR-0018 e); no workspace / item / tenant IDs in committed files except `run_log.md`. Those are demo-only IDs, and the specs require them there. Credentials never.

## 3. Build sequence and checks

### Case 1 (first)
1. ginee: find the dev F64 capacity (RAW's), check XMLA read-write (read-only) → create `ws_migration_demo` + `lh_sales_demo` (no schemas) → verify: items listed.
2. ginee: notebooks from spec § 5 verbatim (cell 1 shared; V-Order config also in `nb_02`) → run `nb_01` at `N_SALES = 300_000` → verify: 9 tables, counts as § 4 scaled, no nulls / orphans / duplicate `sales_id` → run at 30 M → verify: § 10 check 1 (counts = § 4).
3. bip: `Sales Import` PBIP (spec § 6 steps 1–5, the three legacy pieces kept) + report page "Sales overview" (§ 6 step 6) → `Sales Direct Lake` PBIP (§ 7 steps 3–5; five tables, no calc columns / tables) + report copy rebound, title "· DIRECT LAKE", green bar → validator 0 / 0.
4. ginee: deploy both models + reports to `ws_migration_demo` (API) → USER signs in to the Import model's data source (OAuth2) → Import refresh, duration in `run_log.md` → verify: Direct Lake "Keep your Direct Lake data up to date" on.
5. bip: `tests/acceptance.dax` against both service models → verify: § 10 checks 2–5 (identical totals, matrix, Price Band, 5 DL tables).
6. ginee: rehearsal of `nb_02_append_day` → seconds until the DL model shows the new day; Import refresh ≥ 2 min, else `N_SALES = 60_000_000` and rebuild (spec rule) → verify: § 10 checks 6–8.

### Case 2 (after case 1 step 2)
1. bip: `Slow Report Demo` PBIP (spec § 5: five tables, PQ only removes / renames, two measures, slow body, page "Sales by brand") on `lh_sales_demo`; `measures.dax`, `perf_test.dax`.
2. bip: benchmark `[Slow]` / `[Fast]` + difference query against the deployed `Sales Import` model through XMLA (same Sales / Product / Date columns, query-scoped measures; no extra item in `ws_migration_demo`), after its refresh; first read of the gap → verify: § 8 checks 1–3. If outside 3–20 s or < 10×: § 8 tuning table, report side first, logged in `perf_log.md`; fallback pair only if the gap stays under 10×.
3. USER: open the PBIP in Desktop, refresh locally, save `Slow Report Demo.pbix` + `- fixed.pbix`, DAX Studio Server Timings on the PBIX → `perf_log.md` (§ 8 checks 4–6, machine CPU / RAM).

### Case 3 (in parallel with case 1)
1. ginee: create the three workspaces + `lh_cicd_demo` in Dev, `nb_seed_sales` (spec § 5), run → verify: counts 1 / 365 / 50 / 50,000, `dim_environment` = `ws_cicd_demo_dev`.
2. bip: `Sales CICD` PBIP: Direct Lake on OneLake with `WorkspaceId` / `LakehouseId` M parameters (spec § 6 step 5), four tables, five measures (Margin % wrong on purpose), report page (§ 5) → ginee deploys to Dev → verify: Margin % ≈ 66.7 %, Environment = dev.
3. USER: create `rusloc/fabric-cicd-demo` (README, `main`), connect Dev to GitHub (folder `workspace`), first commit → verify: four item folders, model as TMDL.
4. ginee: create `dp_cicd_demo` with two stages (Development, Production), assign Dev + Prod, deploy Dev → Prod → verify: spec § 7 step 3 checkpoint (PBIR report deploys?) — **stop and ask the USER if not**.
5. ginee + USER: seed Prod, parameter rules on Production (USER, no API), redeploy, reframe → Environment = prod → verify: § 10 checks 2, 3, 6, 7 (stages = Dev, Prod).
6. Rehearsal of the change-and-revert loop twice → § 10 checks 4, 5, 8, 9, 10.

## 4. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| F64 too fast: Import refresh < 2 min | weak contrast in video 1 | spec rule: 60 M rows and rebuild |
| Spec 2 on 30 M / 31 levels exceeds 20 s or runs out of memory locally | demo unusable in Desktop | § 8 tuning (Year on columns, fewer levels); machine needs ≥ 16 GB RAM |
| Deployment pipeline rejects PBIR reports (Spec 3 § 7.3) | Part B breaks | spec fallback `fabric-cicd`; USER decides |
| SQL endpoint sync lag | Import refresh misses the new day on camera | spec § 9: wait a minute, refresh the endpoint |
| Spark / big refresh on the shared F64 | CU contention with RAW (P&L model) | run big jobs off-hours; one at a time |
| Direct Lake via API vs via Desktop | the video shows a Desktop flow never rehearsed | `guide.md` click-through rehearsal by the USER before recording |

## 5. USER inputs needed

1. OAuth sign-in on the `Sales Import` (and `Slow Report Demo` service copy, if used) data source.
2. GitHub repo `rusloc/fabric-cicd-demo` + Fabric Git connection.
3. Deployment rules in Test / Prod if the API cannot create them.
4. The 30 M run after green 300 k checks is covered by "start building" (ADR-0018 c). Consent is still needed for the 60 M rebuild and before any delete or overwrite of an existing item.
5. Recording: rehearsal per `guide.md`, timings into the run logs.

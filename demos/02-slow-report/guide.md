# Guide · Case 2 · Slow report, live fix

USER click guide for rehearsal and recording. Spec: `.log/reports/Spec 2 · Slow report, live fix demo.md`. Decisions: ADR-0018 (f: shared data; amendment 2026-11-24: measure names). Timings go to `perf_log.md` in this folder (create it at the first run; the video quotes it, never the spec).

## 1. Prerequisites still open

- [ ] Case 1 data in place: `lh_sales_demo` gold tables (30 M rows, `../01-migration/run_log.md` › Checks). Nothing else to set up in the service: this case runs in Power BI Desktop only.
- [ ] The SQL endpoint host of `lh_sales_demo` for the `SqlEndpoint` parameter: lakehouse `lh_sales_demo` › SQL analytics endpoint › Settings › **SQL connection string** (the endpoint ID is in `../01-migration/run_log.md`; the host itself is not logged there yet).
- [ ] A machine with ≥ 16 GB RAM, Power BI Desktop, [DAX Studio](https://daxstudio.org).

## 2. What is already built

| Item | State | Differs from the spec |
|---|---|---|
| `pbi/Slow Report Demo/` PBIP | built, validator clean; page "Sales by brand"; `Big Line Sales (fx)` has the **slow** body | measures in `_Measures`, names `Sales Amount (fx)` and `Big Line Sales (fx)` (ADR-0018 amendment) |
| Data | shared `lh_sales_demo` gold tables | 30 M rows and 31 discount levels, not 20 M / 7 (ADR-0018 f); the slow query will be slower, see § 8 gate |
| `measures.dax` | both bodies, ready to paste | " (fx)" names |
| `perf_test.dax` | benchmark [Slow], benchmark [Fast], difference query, search query | query-only measures are `_Measures[Slow]` / `_Measures[Fast]` and call `[Sales Amount (fx)]` |
| `Slow Report Demo.pbix`, `Slow Report Demo - fixed.pbix` | **not yet**: you save them (section 3) | local only, `*.pbix` is gitignored |
| `perf_log.md` | not yet | — |

## 3. Desktop steps (build the two PBIX files, then measure)

**A. `Slow Report Demo.pbix`**
1. Desktop › File › Open › `demos/02-slow-report/pbi/Slow Report Demo/Slow Report Demo.pbip`. Visuals show errors until the data loads.
2. Home › Transform data ▾ › **Edit parameters** › `SqlEndpoint` = the host from section 1 (`Database` stays `lh_sales_demo`) › OK › **Apply changes** › sign in with your organizational account › Connect. Five tables load (30 M order lines; several minutes).
3. **Do not Ctrl+S the PBIP.** File › Save as › Browse this device › type *Power BI file (.pbix)* › `Slow Report Demo.pbix`. Keep this file clean: it is the "before" state.

**B. `Slow Report Demo - fixed.pbix`**
1. In `Slow Report Demo.pbix`: Data pane › `_Measures` › **Big Line Sales (fx)**.
2. Formula bar: replace the body with the optimized version from `measures.dax`:
   ```dax
   Big Line Sales (fx) =
   CALCULATE (
       [Sales Amount (fx)]
       ,KEEPFILTERS ( Sales[Quantity] * Sales[Net Price] >= 500 )
   )
   ```
   › Enter.
3. File › Save as › `Slow Report Demo - fixed.pbix`. Close it; reopen `Slow Report Demo.pbix` for the "before" shots.

**C. Measure it (spec § 7), with `Slow Report Demo.pbix` open** — write every number into `perf_log.md`:
1. Optimize › **Performance analyzer** › Start recording › **Refresh visuals** › expand the matrix "Big Line Sales by Brand and Year Month" › log the **DAX query** ms.
2. Same row › **Copy query**.
3. External tools › **DAX Studio** (or start DAX Studio › Power BI / SSDT model › `Slow Report Demo`) › paste › Home › **Server Timings** on › Run ▾ **Clear Cache then Run**, twice › log the second run: Total, FE, SE, SE query count, largest Rows.
4. Paste `perf_test.dax` block 1 (benchmark, `[Slow]`) › Clear Cache then Run › log. Block 2 (`[Fast]`) › same › log.
5. Block 3 (difference query) › Run › must return **no rows**.
6. Block 4 (search query) › lists `Big Line Sales (fx)` (the one measure with `FILTER`).
7. Apply the fix as in B (or open the fixed PBIX) › Performance analyzer again › log the new DAX query ms. Card **Big Line Sales (fx)** shows the same value as before.
8. Machine CPU and RAM into `perf_log.md` (Settings › System › About).

**Gate (spec § 8).** `[Slow]` cold between 3 and 20 s, `[Fast]` under 0.5 s and ≥ 10× faster. If not: tune the data or the matrix as the spec § 8 table says (never the measure), log the change in `perf_log.md`, and tell the team before recording. On 30 M / 31 levels the likely issue is "too slow / out of memory": first try Date[Year] on the matrix columns.

## 4. Recording run (spec § 1 storyline with the real names)

**Off camera:** open `Slow Report Demo.pbix` (slow body), click every visual once, keep `measures.dax` and DAX Studio (connected, Server Timings on, the copied query pasted) ready. Have `Slow Report Demo - fixed.pbix` closed as a fallback for the after shots.

**On camera**
1. Page "Sales by brand": click a **Country** in the dropdown slicer › the matrix spins (seconds; fill from `perf_log.md`).
2. Optimize › Performance analyzer › Start recording › click the slicer again › expand the matrix › DAX query time.
3. Copy query › DAX Studio › Clear Cache then Run › Server Timings: Total, FE share, the SE query with far more rows than the 850 cells.
4. Data pane › `_Measures` › **Big Line Sales (fx)**: highlight `FILTER ( Sales, ... )`.
5. DAX Studio: `perf_test.dax` block 1 (`[Slow]`) vs block 2 (`[Fast]`), each Clear Cache then Run; new timing.
6. Block 3: no rows. Paste the optimized body (section 3 B step 2) into Big Line Sales (fx) › Enter.
7. Click the same Country again: the matrix redraws at once; the **Big Line Sales (fx)** card is unchanged.
8. Closing card.

Reset for another take: close without saving and reopen `Slow Report Demo.pbix`.

## 5. Acceptance checklist (spec § 8)

| # | Check | State | Evidence |
|---|---|---|---|
| 1 | Benchmark `[Slow]`, cold cache: 3–20 s | pending | `perf_log.md` |
| 2 | Benchmark `[Fast]`, cold: < 0.5 s and ≥ 10× faster | pending | `perf_log.md` |
| 3 | Difference query returns no rows | pending | `perf_test.dax` block 3, `perf_log.md` |
| 4 | Big Line Sales (fx) card identical before and after | pending | screenshots / `perf_log.md` |
| 5 | After the fix, a Country click redraws the matrix in < 1 s | pending | Performance analyzer, `perf_log.md` |
| 6 | `perf_log.md` holds both versions' PA ms, DAX Studio Total / FE / SE / SE queries / largest rows, CPU and RAM | pending | `perf_log.md` |

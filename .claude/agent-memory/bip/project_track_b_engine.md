---
name: project-track-b-engine
description: Track B (ACME Unified PnL PBIP) engine chain, measured perf bottlenecks 2026-10-21, display-units layer, DAX test locations
metadata:
  type: project
---

- One PBIP `pbi-report/ACME Unified PnL` (PBIR, one page, views switched by bookmarks). Hidden visuals do not query: only the active view + header cards run.
- Engine chain (since 2026-10-21): display measures (PL Base, KPI Value, Bridge Value, LV *, Prof Net Revenue = engine / `_Units Divisor`) → `_PL *` / `_KPI Value` / `_Bridge Value` (unscaled) → `Base Amount` / `Compare A/B Amount` / `Bridge Comparison Amount` → `_Amt Window` (version × window as one (version, month) TREATAS) → `_Amt Row` (one account filter) → `_Amt Entity` (entity + slices as filter tables) → `_Amt Raw` → `_Local Sum`.
- Baselines 2026-10-21 before the rewrite (Desktop, default P/ACT/FY2026 YTD Sep): P&L matrix 27 s (30 s with CF), Group 19 s, KPI table 473 s then out of memory, bridge waterfall 63 s, profitability 7.5 s, top-8 variances 3.3 s. N-01 target 2 s.
- Measured (DEFINE overrides, matrix 29 rows): removing translation → no change; removing fact scans → no change; constant slicer/window scalars → no change. Cost = formula-engine work × evaluation count (~25-55 engine evaluations per row; eager IF/SWITCH branches; ratio-row IF in PL measures). v2+v3 rewrite: −18 % with exact parity. Query-scoped DEFINE measures run ~2× slower than model measures — compare candidates against a DEFINE control, not the model baseline.
- Every fact row's channel/line/segment belongs to its own entity → stale-slice logic only matters when a selection has no member of the view.
- Trailing-comma format scaling (`#,0.0,,`) renders ",," in Power BI → scale in DAX by param_units[divisor], display layer only.
- Tests: `pbi-report/tests/control-totals.dax` (T-05 now sums `_Bridge Value`); offline replica in a session scratchpad (`perf/replica.py`), not the repo.

- [2026-10-21 Ledger rebuild, DAX against Desktop, read-only] Matrix lines (29 rows, P default, FY2025 on disk): USER's 7-column matrix 4.1 s; Ledger 12 columns (Δ / Δ % restored) 7.7 s; 4 default-open blocks add ~2 s (1 s with 7 columns). Identical measure twice in one query costs nothing (dedup) → rules-based CF on the displayed measure is free. KPI tiles: values only 5.7 s; + Δ A/Δ B 45 s; + `KPI Δ A/B Color` 88 s (colour measures double the cost) → replaced by rules with `KPI Fav Sign`. Next candidates: Δ / Δ % as visual calculations over the displayed columns (−3.6 s), KPI deltas (Bridge-based growth KPIs dominate). (observed)

**Why:** user reported "visuals hardly load" and ",," after numbers on first Desktop open (2026-10-21).
**How to apply:** next perf step needs Desktop open: Performance Analyzer + server timings (FE/SE split) on the P&L and KPI views; candidates: drop the ratio-row IF branches in `_PL *`, Bridge Volume (300 slices × 4 engine calls, ×3 in KPI Δ). A second bip owns the pop-up group visuals (Slice, Period & version, Presentation) — coordinate before editing them.

---
name: project-acme-cash-flow
description: ACME Cash Flow PBIP (ADR-0019 am. 1) built 2026-11-26 from mock v2 - generator in tools/gen (gitignored), model shape, tests 23 blocks TRUE, render findings, deviations, open items
metadata:
  type: project
---

- [2026-11-26] BUILT `pbi-report/ACME Cash Flow/` pass 1 (model + all pages + pop-ups). Generator `tools/gen/` (common, periods, measures, measures2, build_model, build_report, build_tests, mockcalc, build_docs; CF_ROOT redirects output) + `tools/run/` (run-dax / run-tmsl now use Reflection LoadFrom: Add-Type on AdomdClient threw ReflectionTypeLoadException; run-tests needs -TestFile, $PSScriptRoot is empty in param defaults). Python = data/acme_cash_flow_dummy_data/generator/.venv (pandas + pyarrow). (observed)
- Model: 7 Parquet tables + ctl_control_total (CSV via DataFolder\..\checks) + DAX calc tables (param_span/year/month/quarter/units, param_period 53 rows incl. test-only ALL, dim_shift CUR/PRIOR, dim_one, dim_stmt_row from dim_account, dim_bal_row, dim_info, dim_dgroup, dim_recon_check); 143 measures. Window = `_A`/`_B` month indexes; dim_shift PRIOR = KPI deltas. Calc columns: fact_txn[type_no], fact_cash_posting[ledger_memo] (move upstream: ginee/generator). M derived: line_name, direction, month_index. (observed)
- Gotcha: REMOVEFILTERS ( fact table ) removes its expanded table (all related dim filters) - line filters vanished; only remove dims. ISINSCOPE must name the column the visual groups by (line_name, not line_label). (observed)
- Tests `tests/control-totals.dax` 23 blocks / 6,537 rows TRUE (CSV + mock replica mockcalc.py for KPIs, heat blocks, ledger memos). Reconciliation page 44/44 for Oct 2026. (observed)
- Render (fresh open, scratch): Desktop-saved expansion form (levels isCollapsed + root.children isToggled) opens the statement EXPANDED; tableEx SVG hosts work (1 px header); heatmap matrix + SVG totals panel aligned at pitch 31.2 px; button-slicer calendar selected navy via selection:selected + measures. S01 icon CF on Stmt Amount not yet seen in a render. (observed)
- [2026-11-26 18:40] Round 2 on the USER's 18:24 save (no content edits, only Desktop re-serialization): PBIR regenerated, TMDL patched (swap _measures.tmdl, drop dim_dgroup + its model ref + 2 stale linguistic entries (9 lines each), add dim_cf_line[activity] calc column) - the saved cache.abf stayed valid (data Ready, no refresh). Matrix cells show raw SVG on hover even with visualTooltip show false: bind a report-page tooltip (tt_row, tt_ledger) and make SVG-host blockers cover the whole table visual. Balance bars on their own scale (Bal Bar Ratio, T-13). Diagram = decompositionTreeVisual + KPI-card SVG in a bookmark pop-up per view page (root only; user picks splits). Tests 25 blocks / 6,726 TRUE. Measure names clash case-insensitively ('Net change in cash' vs 'Net Change in Cash'): build_model now asserts it. (observed)
- USER changed plan 2026-11-26: no `.sync/acme cash flow/power-bi/` pack this pass. (source: coordinator)

**Why:** ADR-0019 amendment 1 (Power BI + Next.js deliveries).
**How to apply:** regenerate into a scratch CF_ROOT, open fresh, TMSL refresh, run-tests; once the USER saves in Desktop, patch surgically (Marketing merge3 pattern) instead of regenerating PBIR.

Related: [[project-acme-marketing]] [[pbir-authoring-notes]]

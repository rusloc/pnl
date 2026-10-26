---
name: project-mirelo-report
description: Mirelo Sales & Revenue PBIP draft (ADR-0011 Track B) - model shape, generator location, test status, placeholders and open questions as of 2026-10-27
metadata:
  type: project
---

- [2026-10-27] BUILT `pbi-report/Mirelo Sales/` (third showcase report, fictional neobank, outside the P&L spec, ADR-0011 Proposed). Model: 18 Parquet tables via `DataFolder` (Trucks pattern) + 8 calc tables + `_measures` 241 measures, 28 rels, compat 1702. Report: `sales_one_pager` 1440x810, 5 view groups + bookmarks `bm_view_*`, How-to-read pop-up `grp_info`, drill-through `loan_detail` / `client_detail`. Validator 0/0. (source: observed)
- Tests `tests/control-totals.dax` 2,560 rows all TRUE over ADOMD on a refreshed scratch copy (T-M1 requested windows, T-M2 every month, T-M3 QTD/YTD/R12M, T-M4 bridge identity + README rule 2, T-M5 card smoke). Refresh ~30 s. (observed)
- Design choices: no dim_date->dim_month snowflake (month_key added in M to fact_loan / fact_application); pickers are disconnected param tables, window = month_index range (P&L engine pattern); EUR pre-translated in M (ADR-0008 analogue: fact_loan_month *_eur, fact_target target_eur, fact_loan principal_eur_bud); cards = panel + marker shapes + SVG image measure (hero 332x192 with sparkline, KPI 216x120). (observed)
- Placeholders / deviations: L11 attainment by channel (no channel targets), C6 days between loans (no previous-loan date), roll 60->90 dropped (90+ bucket is a 90-179 day stock -> >200 %), horizontal bars drawn as columns (bars scroll in 162 px cards), market tile label "All", month dropdown 48 px (validator floor), DPD budget for All markets = outstanding-weighted (my rule). (observed)
- Generator (not in repo): session scratchpad `f51b2de5-.../scratchpad/bip_mirelo/gen/` (build_model.py, build_report.py, build_tests.py, build_docs.py, show_view.py, shots.py). Re-runnable on a clean folder; build_report wipes `definition/`. After the USER saves in Desktop, edit surgically instead. (observed)
- ADR-0011 names the dictionary `docs/model/sales-measure-dictionary.md`; the main agent's brief said `mirelo-measure-dictionary.md` (used). (observed)

**Why:** first build of a two-track parity draft; Track C (JS) reconciles to the same control totals.
**How to apply:** before editing, check whether the USER has saved the PBIP in Desktop (then Desktop serialization wins). Open questions are in the hand-back of 2026-10-27 (DPD budget weighting, channel targets, status source, card chrome).

Related: [[pbir-authoring-notes]] [[project-trucks-report]]

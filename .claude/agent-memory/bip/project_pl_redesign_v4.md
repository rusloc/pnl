---
name: project-pl-redesign-v4
description: P&L views redesign v4 built into the ACME Unified PnL PBIP on 2026-10-27 (Vitals, Analysis 2 pages, Profitability 2 pages, ADR-0012 info) - state, numbers, open points
metadata:
  type: project
---

Built 2026-10-27 into `pbi-report/ACME Unified PnL/` from `docs/design/P&L views redesign/` (v4 html, build-brief.md, metric-inventory.md). Backups `__backup__/*.2026-10-27-1603.bak`. (source: observed)

- Model: 241 measures (191 + 65 new - 15 orphans). New tables dim_profit_step, dim_conc_level, dim_pl_info, param_var_cut (+ var_cut_total), param_kpi_threshold; dim_kpi +vitals_slot/tier/in_key_figures +rows OPEX_PCT/MIX/FY_OUTLOOK; dim_bridge_step +CC_SUB/END.
- Report: Key figures renamed Vitals (10 image cards `Vitals Card SVG`), Analysis p1 bridges (stacked + visual calcs), p2 variances (Top 8/12/All x block/flat, cut field parameter), Profitability p1 table + concentration, p2 scatter + mix heatmap (`Heat Cell`, Group view = both companies' lines via TREATAS on param_entity_view). ⓘ = tiny card -> tooltip page tt_pl_info; How to read per view.
- Tests: control-totals.dax 17 sets / 257 rows all TRUE (T-R1..R5 added). Validator 0/0. Timings (6-parallel replay, cold): Vitals 3.0 s, Ana p1 2.8 s, others <= 1.4 s.
- Generator scripts are scratch-only and one-shot (pl_model.py / pl_report.py not re-runnable); later fixes were direct edits + bip_pl_redesign/fix/tmdl_edit.py + upsert.ps1.
- Service model not republished: Track A (fin) cannot verify the new measures until ginee / USER republishes.

**Why:** the coordinator relayed the USER-approved v4 design; Track A reads the same measures.
**How to apply:** before touching these views, re-read the layout doc view map and run the tests; open points: USER first open + bookmark click-test, heatmap Group header wrap, breakdown slicer empty tiles in Group. [[project-track-b-draft]] [[pbir-authoring-notes]]

- [2026-10-27] Parity check B vs C applied (parity-check-2026-10-27.md): PV-01/02/03/04/06/08/09/10/12/19/22 + profit-bridge GM rate bug (SUMX over all dim_line rows counted the other company's lines; rate now over the company's own lines; mix remainder had hidden it, totals were right). 253 measures. `_Vitals Parts` = one 4-row iteration (base/A/B/Budget) because four CALCULATEs over _KPI Value tripled Vitals time (31 s sum -> 10 s). T-P parity sets appended to tests (601 rows, ~10-15 min). var.nm_codes dispute decided for B by the coordinator: lines with no data in either version stay hidden; Track C aligns. (source: main agent)
- [2026-10-27] PV-23 / PV-12 (after hunter's re-sync): LV Leaf Count and LV Δ % Text treat a line with base and comparison both blank or both 0 as hidden (32 S / 37 P lines). T-P regenerated from the re-synced CSV. Timing lesson: per-card Vitals queries must carry an entity filter (TREATAS param_entity_view), or the driver cards evaluate blank and the view looks fast; the 6.1 s / 10.7 s Vitals figures were contaminated: leftover test runners were still querying the same instance. Clean, repeated 3x: Vitals 2.5-2.6 s cold for Group and Commerce Cloud (all 10 cards render), Profitability p1 1.3-1.6 s, p2 0.4 s, within ADR-0008. Before timing, check no run-dax.ps1 process is alive (Get-CimInstance Win32_Process). (observed)
- [2026-10-27] Final: T-P regenerated from the re-synced CSV, 6 selections / 601 rows all TRUE (6.5 min on a clean instance); 17 existing sets 257/257 TRUE. P&L parity round closed. (observed)

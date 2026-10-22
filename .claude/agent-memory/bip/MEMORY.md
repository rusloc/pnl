- [Track B PBIP draft](project_track_b_draft.md) — one-window layout, Ledger rebuild applied 2026-10-21 16:17, open checks after the rebuild
- [PBIR authoring notes](pbir-authoring-notes.md) — validator rules, Desktop render findings (show flags, card padding, button slicer states), DAX query tips
- [Track B engine](project_track_b_engine.md) — engine chain, measured bottlenecks incl. Ledger timings, display-units layer, DAX tests
- [Desktop open rule](feedback_desktop_open.md) — no PBIP edits while Desktop has it open; prove plans with DEFINE MEASURE
- [ACME Trucks report](project_trucks_report.md) — 2nd showcase report: Time util redesign + RU→EN rename plan, waits for ginee export; real-name risk Q-01

## Open threads
- 2026-10-22 20:36 review batch applied (notice strip out, numbered statement, KPI card v2, header status + filters pop-up, Profitability Region default + hint, ' - '). Open: USER records bm_pl_expand (line_display), first-open checklist in pbi-report-layout.md; ginee republish; ADR-0007 / design guide §5.3-5.4 still describe sparklines / notice strip (main agent)
- 2026-10-22 ADR-0007 built (tests green, validator 0/0, render-checked). Open: USER records bm_pl_expand in Desktop; ginee republish (KPI Trend contract live for fin); ops row Key figures still ~16 s
- 2026-10-21 Trucks redesign BUILT (tests green, validator 0/0). Open: USER first open + Refresh, click-test Reset bookmark, confirm main-agent defaults, re-save to refresh diagram layout
- 2026-10-22 perf pass applied (T-05 fix, Bridge Volume set-based, merged SWITCH branches, FY LE one window). Open: ginee republish; physical asks (pre-translated amounts, elimination rows); fin option Q1 = 5 base columns; N-01 not reachable on this design
- 2026-10-21 USER first open after the Ledger rebuild: checklist in `docs/ADD/features/pbi-report-layout.md`; button-slicer selected style unresolved
- `tests/control-totals.dax` all TRUE on 2026-10-22 (T-06 552/552, T-05 54/54) via ADOMD; USER re-run in Desktop optional

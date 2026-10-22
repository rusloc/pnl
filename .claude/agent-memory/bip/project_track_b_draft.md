---
name: project-track-b-draft
description: State of the Track B PBIP draft of the ACME Unified P&L (one-window layout, measure engine, tests, open decisions) as of 2026-10-21
metadata:
  type: project
---

Track B local PBIP draft built 2026-10-21 in `pbi-report/` ("ACME Unified PnL" .pbip / .Report / .SemanticModel), not opened in Desktop yet, not published. (source: observed)

- Layout = USER direction, not spec §2: one 1280x720 page, view switcher (P&L table / Key figures / Analysis / Profitability) via display-only selected-visuals bookmarks, entity switch = tile slicer on calc table param_entity_view, filters in a collapsible left side bar with 3 pop-ups (Period & version, Slice, Presentation). ADR-0004 drafted as **proposed** — USER decides. [[pbir-authoring-notes]]
- Model: Import from the lh_raw SQL endpoint via PQ parameters SqlEndpoint / Database (Direct Lake left to ginee). 22 import + 14 calc tables, 115 measures in `_measures`. Engine chain: PL measures → Base Amount (param_eval can swap to Compare A/B) → _Amt Actual/Budget/LE → _Amt Row (dim_pl_row → blocks) → _Amt Entity (P/S/GROUP + elims) → _Amt Raw (translation per month × currency × version) → _Local Sum.
- Group logic: leaves keep entity amounts; _Elim Amount subtracts counterparty rows only for blocks whose ELIM_* account is in the filter, so CM and below are unchanged.
- Offline Python replica of the engine reconciled all 552 control totals (≤ 0.01 USD). In-model tests: `pbi-report/tests/control-totals.dax` (T-01/02/03/05/06/07/10/17) — not yet run in Desktop.
- Files were produced by a one-shot generator in the session scratchpad (not in the repo). After the USER saves in Desktop, Desktop's serialization is the source; edit surgically from then on.

- [2026-10-21] USER opened and saved the report in Desktop (13:19–13:36) and restyled "Pop-up Presentation" as the pop-up reference (spec in `docs/ADD/features/pbi-report-layout.md` § Pop-up design). Restyle of Slice / Period planned, not applied (Desktop was open); apply with the scratchpad script `popup_restyle.py` re-created from the plan, after Desktop is closed. (source: observed)

- [2026-10-21 16:17] **Ledger rebuild applied** (Desktop was closed at the check): 1440 × 810 page, dark rail 64/248 with four flyouts (Period, Versions, Slice, Display), company button slicer, 4 tabs + per-view toolbars, notice strip; 213 visuals in 10 groups, 15 bookmarks (views, flyouts, rail, reset). 47 measures in folder `Design`; colour constants and `−` / ▲▼ format strings updated in existing display measures. Generator (not in repo): session scratchpad `ledger/build.py` + `pbir.py` + `design_measures.dax`; it re-reads disk and is re-runnable only on the pre-rebuild state. Layout reference = Ledger design guide (`docs/design/design-requirements.md`), noted in ADR-0004 (still proposed). (source: observed)
- Open after the rebuild: selected-state styling of button slicers (Desktop default dark/white seen), KPI reference labels / Analysis / Profitability not render-tested, `bm_reset_*` may need Update in Desktop. Unused after the rebuild (kept): `PL Δ A/B/LE Color`, `KPI Δ A/B Color`, `LV Δ Color`, `Prof NR Δ Color`, `Context Line`, `Data Status`. (observed)

**Why:** USER wanted a one-window finance one-pager; spec §2 stacks 9 zones on a long page.
**How to apply:** before touching PBIR, read the view/pop-up group membership and bookmark targets; any new visual must join a group and the bookmarks that target it. Open items: ADR-0004 decision, compat level 1702 (kit rule) confirmation, RLS (N-04), deferred features list in `docs/ADD/features/pbi-report-layout.md`.
- [2026-10-22 ADR-0007 applied to PBIR] toolbar (16 tb_* visuals) removed; statement collapsed by default with Expand all / Collapse all buttons -> data bookmarks bm_pl_expand / bm_pl_collapse on pl_matrix (bm_pl_expand needs a one-time USER Update in Desktop); company cards moved into flyout grp_fly_entity opened by the rail mark (bm_fly_entity / bm_fly_close_entity, which also collapses the statement, M-21); Key figures = 3 rows of 4 tiles (kpi_fin, kpi_fin2, kpi_ops; code-list filters) + image overlays kpi_*_trend with KPI Row SVG; 4 info pop-ups grp_info_* with (i) buttons. Generator: session scratchpad k24/build_adr7.py (asserts the pre-ADR-0007 state, not re-runnable). (observed)


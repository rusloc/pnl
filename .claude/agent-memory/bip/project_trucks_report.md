---
name: project-trucks-report
description: ACME Trucks showcase report (second PBI report, outside the P&L spec) - one-page "Time util" redesign, RU->EN rename, USER decisions v2, gate result, dependency closure facts
metadata:
  type: project
---

- [2026-10-21] "ACME Trucks" is a second Track B showcase report outside the P&L spec. It is thin, live-connected to the USER's personal-tenant model "Time unitilaztion" (workspace "Showcase"). ginee is to export it and rebuild it locally in Import mode; bip then applies the PBIR rename and rebuilds the one visible page from the mockup. Plan: `docs/ADD/features/trucks-report-redesign.md` (DRAFT). (source: user via main agent)
- [2026-10-21] USER decisions: all English (model + report); only page "Time util" is redesigned; hidden pages keep their layout but get English refs; the PBIP goes into git and is embedded on vosk.dev. (source: user)
- [2026-10-21] The hidden pages carry real enterprise and machine identifiers in filter literals and titles (mine names, company abbreviation, excavator serial numbers), although the data is said to be anonymised (that is true only for the `_…AltName` columns). Raised as Q-01: check it before any commit or publish. (source: observed)
- [2026-10-21] There are 11 hidden pages, not the 7 the brief listed. The 4 registered custom visuals are unused. The validator baseline before any edit is 256 errors (253 missing nativeQueryRef, which Desktop tolerates) and 77 warnings. (source: observed)

- [2026-10-21] USER decisions v2 (via main agent, binding): data stays as is (Q-01 closed, keep); delete every page except "Time util"; all English in model + report (UI switch items and category display labels too, data values untouched); page 1920 x 1080; drop the contractor = blank drillthrough filter; KPI `RANDBETWEEN` kept for now, isolate it. (source: user via main agent)
- [2026-10-21 20:0x] Gate run read-only against the USER's own Desktop (opened from Explorer, full refresh at 20:01:30 local, saved 20:01:50): `tests/baseline-live.dax` 591/591 TRUE. All build steps blocked while that window is open. (source: observed)
- [2026-10-21] Time util dependency closure (INFO.CALCDEPENDENCY + PBIR refs): 60 of 301 measures needed, 12 tables in the DAX closure. Filter paths also need the bridges `Факт_справочник_прост` and `План_справочник_прост` (relationships on calculated columns `ПФ КРВ[idle_name_for_op_2]` and `План_2[indicatior_name_2]`), which CALCDEPENDENCY does not show. All relationships are single direction. (source: observed)
- [2026-10-21] The English labels are DAX calculated columns (`_idleCategoryAltName`, `_typeAltName`, `_metricAltName`, `_schemaAltName`, `_loaderAltName`, `_officeAltName`), so they are mine. The switch codes (`Месяц`/`Неделя`, `Линейно`/`Взвешенно`) are M `#table` rows, and measures compare against them as DAX string literals. Translating them means changing M (ginee's lane) and DAX together. (source: observed)

- [2026-10-21 21:15] BUILT: one page "Time utilization" at 1920 x 1080. Model renamed to English (dim_/fact_/bridge_/param_, `_measures`), 241 orphan measures and 16 tables removed, 16 new measures (KPI, `_WF Is Subtotal`, SVG `WF Plan Bar` / `WF Fact Bar` / `WF Δ Pill`, `_Header Context`, `_KPI Noise`). Tests `tests/baseline-live-en.dax` 536/536 and `tests/time-util.dax` 390/390; validator 0/0. Record: `docs/ADD/features/trucks-report-redesign.md` §0; dictionary `docs/model/trucks-measure-dictionary.md`. (source: observed)
- [2026-10-21] Main-agent defaults (revertible, the USER has not confirmed): captions only (M `#table` codes and DAX literals stay Russian data codes), category wording "Capital repairs" / "Awaiting trucks" / "Conservation / reserve", auto date/time kept, `_KPI Noise` = RANDBETWEEN kept. (source: main agent)
- [2026-10-21] The repo `cache.abf` is still the pre-rename cache, so the USER's first open needs a Refresh. `semanticModelDiagramLayout.json` still holds the old table names (not editable); it is left out of the commit until Desktop re-saves it. The Reset bookmark (`bm_reset`) is untested by a click. (source: observed)

**Why:** The work waits on ginee's export, and the risk (real names in a public repo) is easy to miss.
**How to apply:** Before touching Trucks PBIR, read the plan doc §5 and the open questions (Q-01 first). Never start the PBIR rename pass before the TMDL names are final.

Related: [[pbir-authoring-notes]] [[feedback-desktop-open]]

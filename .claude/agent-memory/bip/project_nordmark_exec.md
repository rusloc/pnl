---
name: project-nordmark-exec
description: Nordmark Exec PBI flavour (ADR-0013) - model/report shape, generator in scratch, copy source js-exec copy.ts, tooltip/image-visual findings, test status as of 2026-10-28
metadata:
  type: project
---

- [2026-10-28] BUILT `pbi-report/Nordmark Exec/` (PBI flavour of ADR-0013, Accepted). Model: 17 Parquet tables + `meta_dataset` (manifest.json: as-of week, refresh stamp) via `DataFolder`, 8 disconnected pickers (`param_period/comparator/region`, `param_attr_group/lever/horizon/owner/statement`), `_measures` 361. Report: `exec_landing` 1440x810 + tooltip pages `tt_info/tt_drill/tt_rule/tt_dot`, bookmarks `bm_filters/how/more/notes/close`. (source: observed)
- Design: base measures = window is the dim_week rows in context; region via leaf sums reading `param_region` (ALL = no filter); card layer sets the window from the period switcher + manifest as-of; LY by TREATAS of ly_week_key; LW = same window as of week-1. Cards = one SVG image measure per card (`Card SVG <KPI>`); hover targets = invisible cardVisuals filtered to dim_kpi with report-page tooltips. (observed)
- Copy source = `js-exec/lib/engine/copy.ts` (coordinator 2026-10-28): the generator exports it with `node --experimental-strip-types` to JSON at build time; view.ts sentences / format.ts number rules mirrored in DAX (fmt.py, tokens.py). (source: user via coordinator)
- Generator (not in repo): session scratchpad `336bd115-.../scratchpad/bip_nordmark/gen/` (build_model, build_report, build_tests, build_docs, build_readme, measures, measures_svg, tokens, fmt, copy_v5). `NORDMARK_ROOT` redirects output; scratch tools sync.sh (regen + TOM push), run-blocks.sh, show.py (scratch layer/tooltip toggles), timing.sh. (observed)

- [2026-10-28] Verified: validator 0/0; tests 23 blocks / 13,273 rows all TRUE (every CSV row + card layer 3 periods x 3 comparators x 4 scopes + v5 texts + bars + identities + 0 measures in error); slowest visual ~0.7 s cold, status line was 2.1 s until counts + dot became one packed measure. Renders checked: landing, 4 layers, tt_info / tt_drill / tt_rule / tt_dot (tooltip pages via scratch visual filter; real hover not automatable). (observed)

**Why:** two-flavour parity build; JS flavour reconciles to the same 9,328 control totals.
**How to apply:** after the USER saves in Desktop, edit surgically instead of regenerating. Hover pop-ups still need a USER hover check.

Related: [[pbir-authoring-notes]] [[project-mirelo-report]]

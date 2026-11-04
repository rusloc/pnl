---
name: project-acme-marketing
description: ACME Marketing paid-acquisition PBIP (ADR-0015 phase 2) - model/report shape, generator in repo tools/ (gitignored), test status, deviations and open items as of 2026-11-04
metadata:
  type: project
---

- [2026-11-04] BUILT `pbi-report/ACME Marketing/` phase 2 (model + Overview / Channels / Campaigns; Journey / Cohorts = empty-state tabs). Generator in `pbi-report/ACME Marketing/tools/gen/` (build_model, measures, svg, cards, build_report, build_tests, build_docs; MKT_ROOT redirects output) + `tools/run/` (run-dax, run-tests, run-tmsl, tom-sync, tmdl-check, find-port). `tools/` is gitignored (Nordmark precedent): git add needs -f if the USER wants it. (source: observed)
- Model: 27 Parquet tables + meta_dataset + pickers (param_period_preset / comparator / granularity / date) + dim_funnel_stage / dim_c2_stage / dim_alert_slot / dim_card + _measures (~340). Window = `_Win Start/_Win End` from preset or Custom param_date; base `_b` + derived `_x` in the date context, wrappers per window (W / Prev / LY / Cmp). (observed)
- Status default Live + Learning only on P1 + the Campaigns list (ALL totals keep the paused retention campaign: it spends in the previous period). Oct 18 = fixed story annotation (largest daily-CAC step falls on Oct 17). Saved views deferred to phase 3. (observed)
- Tests: 24 blocks / 23,610 rows from control_totals_usd.csv (R-keys at ALL/CH/PF/combos/CP, M-keys, daily, alerts/movers/story, creatives/terms, comparisons, smoke). Journey (step/act/segment/page) and cohort C- keys are phase 3. (observed)

- [2026-11-04] Phase 3 built: Journey J1-J4 (journey rows 2 x 287 px), Cohorts K1-K5 (dim_offset / dim_day_n / dim_act_bin calc tables; cohort measures read the dim_month row, DDA, window only picks the months), five saved views = hand-written data-state bookmarks (slicer objects merge/remove, Trucks bm_reset format; USER click-test pending), tests 26 blocks / 28,893 rows TRUE (every CSV row covered), cold timings per visual (tools/run/timing_queries.py + time.ps1; slowest O5 0.97 s), pack `.sync/acme-marketing/{power-bi,spec}/` + `.sync/data-gen/acme-marketing/` (tools/run/make_pack.py) + hand-off `.sync/2026-11-04-acme-marketing-handoff.md`. 411 measures, 40 tables. (observed)

**Why:** ADR-0015 phase 2; phase 3 (J1-J4, K1-K5, saved views, pack) builds on this generator.
**How to apply:** regenerate into a scratch MKT_ROOT, tom-sync measures into a scratch Desktop, run tests there; after the USER saves in Desktop, patch surgically instead of regenerating PBIR.

Related: [[pbir-authoring-notes]] [[project-mirelo-report]] [[project-nordmark-exec]]

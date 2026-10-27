<!-- next-id: DEF-006 -->

# Defect Patterns

### DEF-001 · Hardcoded UI copy that the reference track computes from filters · 2026-10-23
**Symptom:** text is right under default filters, wrong after a change (Compare A = LE, costs as positives, EUR, constant currency)
**Cause:** a string literal in a React view where Track B uses a measure that reads the selection
**Fix / test:** RTL test that flips Compare A to LE / currency to EUR / costSign to pos and asserts the caption changes; better: derive copy from one shared function
**Seen:** fabric-app statement-view.tsx footnote ("vs Budget", "costs negative"); app-header.tsx KPI caption "Changes vs Budget and Prior year"; display-panel.tsx units "$m/$k" (B: currency symbol); 2026-10-27 Track B PBIR headers "BUDGET" / "VS PY" (an_var_m*/t*) and "Δ VS BUD % (CC)" (pf_table) while values follow Bridge Comparison Amount (PV-06): the reference track has it too
**Hits:** 4
**Tags:** copy, parity, track-a, hardcoded, filter-dependent
**Confidence:** medium
**Last-verified:** 2026-10-27
**Related:** DEF-003, DEF-004
**Status:** active

### DEF-002 · Spec table not edited after an ADR / design-note amendment · 2026-10-23
**Symptom:** tracks disagree because one follows the spec table and one follows the amendment
**Cause:** amendments recorded in ADR / design note; `docs/Requirements.md` row left as before
**Fix / test:** on every ADR amendment grep Requirements.md for the IDs it touches; parity audit compares spec defaults vs each track's defaults
**Seen:** F-21 default breakdown (spec: Channel / Entity; ADR-0007 §3a: Region; B = Region, A and C = Channel); L-04 / L-05 rows still "context line always visible" / notices zone (amended by period-picker-v2 Part 2); 2026-10-27 build-brief §0 header line still has period + currency (both tracks dropped them), §4 Profitability breakdown + "Display flyout still rules" vs Region-only / CC builds, Mirelo layout-spec "9.8k" vs tokens "9,796" (PV-20, PV-19, MS-15); re-run 2026-10-27 evening: PV-02 / PV-19 decided but build-brief §3 / §4 not edited (PC-03)
**Hits:** 4
**Tags:** spec-drift, adr, defaults, parity
**Confidence:** medium
**Last-verified:** 2026-10-27
**Related:** DEF-005
**Status:** active

### DEF-003 · Separator drift " · " vs " - " in header-adjacent copy · 2026-10-23
**Symptom:** Track B shows "USD m - actual rates", A / C show "USD m · actual rates"
**Cause:** the 2026-10-23 " - " decision was applied to the title row and pop-up, not to rail summaries, picker subtitles, statement column-group titles
**Fix / test:** grep `' · '` in fabric-app/packages/frontend/src/pnl and js-report/components|lib; assert rail summaries in unit tests
**Seen:** A filters.ts railSummaries display, summary.ts slice join, theme/company.ts picker sub, statement-view.tsx group title; C Shell.tsx display summary, theme.ts, StatementTable.tsx group title; 2026-10-27 C lib/engine view copy ("How to read — Vitals", "Mix — region × …" em dash, " · " in ⓘ formulas and bubble labels): the v4 HTML reference itself uses "—" / " · ", so the design file re-seeds the drift (PV-14)
**Hits:** 8
**Tags:** copy, separator, parity, track-a, track-c
**Confidence:** medium
**Last-verified:** 2026-10-27
**Related:** DEF-001
**Status:** active

### DEF-004 · Comparator-selection rule drifts between tracks · 2026-10-27
**Symptom:** same selection, different comparator behind a status chip / Δ column: right under defaults (Compare A = Budget, comparator = Budget), wrong once the user switches
**Cause:** each track encodes "which comparator" locally (Compare A vs Budget only; Compare B vs always PY; Budget vs Budget-else-PY fallback) instead of one shared rule
**Fix / test:** parity rows on probe selections that break the defaults (Compare A = PY, Compare B = None, metric without Budget): js-report/lib/test-utils/parity selections S-FY25-cmpPY, S-FY25-noB, Mirelo L4 / C2 / O3 rows
**Seen:** B _KPI Status / Vitals Card SVG vs Compare A, C vs Budget (PV-01); C variances vs PY always, B vs Compare B (PV-05); B Mirelo Card L4..R6 SVG `_cmp = BLANK()` under Budget, C falls back to PY (MS-01); B hero `_s_sel` without fallback (MS-02); all 2026-10-27
**Hits:** 4
**Tags:** comparator, status, fallback, parity, track-b, track-c, budget, prior-year
**Confidence:** medium
**Last-verified:** 2026-10-27
**Related:** DEF-001
**Status:** active

### DEF-005 · Shared copy file promised by a brief never written → per-track copy drift · 2026-10-27
**Symptom:** every ⓘ / How-to-read string differs between tracks (titles, sub-values, sections, punctuation) although each "follows the HTML"
**Cause:** the brief says copy moves to one file "on approval"; nobody writes it, builders transcribe the HTML independently
**Fix / test:** gate the build on the copy file existing; then copy rows (titles, sub-value labels) in the parity CSV
**Seen:** docs/ADD/features/info-popovers.md has no Vitals / Analysis / Profitability entries (build-brief §0); docs/ADD/features/sales-info-popovers.md missing (Mirelo design-tokens §10); PC-01, 2026-10-27
**Hits:** 2
**Tags:** copy, popover, info, how-to-read, parity, spec-drift
**Confidence:** medium
**Last-verified:** 2026-10-27
**Related:** DEF-002
**Status:** active

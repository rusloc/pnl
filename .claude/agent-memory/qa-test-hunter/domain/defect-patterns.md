<!-- next-id: DEF-004 -->

# Defect Patterns

### DEF-001 · Hardcoded UI copy that the reference track computes from filters · 2026-10-23
**Symptom:** text is right under default filters, wrong after a change (Compare A = LE, costs as positives, EUR, constant currency)
**Cause:** a string literal in a React view where Track B uses a measure that reads the selection
**Fix / test:** RTL test that flips Compare A to LE / currency to EUR / costSign to pos and asserts the caption changes; better: derive copy from one shared function
**Seen:** fabric-app statement-view.tsx footnote ("vs Budget", "costs negative"); app-header.tsx KPI caption "Changes vs Budget and Prior year"; display-panel.tsx units "$m/$k" (B: currency symbol)
**Hits:** 3
**Tags:** copy, parity, track-a, hardcoded, filter-dependent
**Confidence:** medium
**Last-verified:** 2026-10-23
**Related:** DEF-003
**Status:** active

### DEF-002 · Spec table not edited after an ADR / design-note amendment · 2026-10-23
**Symptom:** tracks disagree because one follows the spec table and one follows the amendment
**Cause:** amendments recorded in ADR / design note; `docs/Requirements.md` row left as before
**Fix / test:** on every ADR amendment grep Requirements.md for the IDs it touches; parity audit compares spec defaults vs each track's defaults
**Seen:** F-21 default breakdown (spec: Channel / Entity; ADR-0007 §3a: Region; B = Region, A and C = Channel); L-04 / L-05 rows still "context line always visible" / notices zone (amended by period-picker-v2 Part 2)
**Hits:** 2
**Tags:** spec-drift, adr, defaults, parity
**Confidence:** medium
**Last-verified:** 2026-10-23
**Related:** —
**Status:** active

### DEF-003 · Separator drift " · " vs " - " in header-adjacent copy · 2026-10-23
**Symptom:** Track B shows "USD m - actual rates", A / C show "USD m · actual rates"
**Cause:** the 2026-10-23 " - " decision was applied to the title row and pop-up, not to rail summaries, picker subtitles, statement column-group titles
**Fix / test:** grep `' · '` in fabric-app/packages/frontend/src/pnl and js-report/components|lib; assert rail summaries in unit tests
**Seen:** A filters.ts railSummaries display, summary.ts slice join, theme/company.ts picker sub, statement-view.tsx group title; C Shell.tsx display summary, theme.ts, StatementTable.tsx group title
**Hits:** 7
**Tags:** copy, separator, parity, track-a, track-c
**Confidence:** medium
**Last-verified:** 2026-10-23
**Related:** DEF-001
**Status:** active

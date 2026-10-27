<!-- next-id: CONV-002 -->

# Conventions (repo-inferred, ≥3 examples)

### CONV-001 · Track C UI copy is built in lib/engine, not in components · 2026-10-23
**Symptom:** a component string-builds a summary/label from the selection (e.g. rail summaries in Shell.tsx before 2026-10-23).
**Cause:** copy that must match Track B word-for-word (parity rules) drifts when each component formats its own.
**Fix:** pure function in lib/engine (`period.ts` periodSummary, `header.ts` headerStatus / appliedFilters / railSummaries, `notices.ts` notices + windowLabel), unit-tested against Track B's measure text in `_measures.tmdl`; components render the strings.
**Seen:** js-report/lib/engine/period.ts, header.ts, notices.ts (uncommitted, 2026-10-23); js-report/lib/sales/copy.ts + view-model.ts (2026-10-27: engine returns final strings incl. ⓘ copy and story callouts); js-report/lib/engine/view-copy.ts, vitals.ts, analysis.ts (P&L redesign: ⓘ InfoVM + How to read per view built in the engine)
**Confidence:** high
**Last-verified:** 2026-10-27
**Related:** —
**Status:** active

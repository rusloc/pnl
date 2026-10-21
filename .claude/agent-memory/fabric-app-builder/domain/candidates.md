# Candidates (single inductive sightings)
<!-- next-id: CAND-003 -->

### CAND-001 · Views behind one `PnlDataSource`; reference from lhraw with an offline sample fallback, figures sample-flagged with a chip · 2026-10-21
**What:** `packages/frontend/src/pnl/model/types.ts` defines `PnlDataSource { loadReference(): {reference, fallbackReason?}; loadFigures(filter, reference): Figures }`; `Figures.sample: true` drives a visible "Sample data" chip in every view; the lhraw reference loader throws → `appDataSource` falls back to `sample-reference.ts` and reports the reason in the notice strip. Lets `rayfin dev` (connectors not wired) and offline tests run the full shell, while a deployed app shows real dims.
**Why:** CLAUDE.md "connectors work only in the deployed app" + the USER's "clearly flagged as sample data" instruction.
**Where:** `pnl/data/data-source.ts`, `pnl/components/sample-chip.tsx`, `pnl/pnl-app.spec.tsx` (tests inject an offline source).
**Expires:** 2027-01-19 · **Tags:** data-source, fallback, sample, testing · **Promote-to:** conventions.md on a second track/feature using the same seam.

### CAND-002 · Fixed Decimal measures through `fabric-semanticmodel` can arrive as scaled integers → wrap amounts in `CONVERT ( [M], DOUBLE )` · 2026-10-21
**What:** The installed `.agents/skills/dax-authoring/SKILL.md` (1.36.2) mandates `CONVERT([Measure], DOUBLE)` for currency/decimal measures: "a total of 2,613,203.85 renders as 26,132,038,531 … This has now shipped twice." Track B's amounts are Fixed Decimal (`docs/model/semantic-model.md`), so every amount column in ADR-0006 §8 is wrapped. Not reproduced here yet; the `fabric-apps-rayfin` skill's `connectors.md` is silent on it.
**Why:** skill text only (vendor evidence, no local repro). Promote to QRK on the first probe that shows a scaled integer, or archive if 1.36.2's Arrow decoder returns decimals correctly.
**Evidence 2026-10-21:** phase 1 reads the `1 Statement` `PL *` measures, which are **Number** (`INFO.VIEW.MEASURES` probe): `[PL Base]` NR = 3398.5219426605 through the connector, no ×10⁴. The Currency path (`9 Engine` / `2 Versions` measures) is still untested through the Arrow decoder; ginee saw them unscaled via REST JSON (`[Base Amount]` = 3398521942.6605). Keep as candidate until a Currency measure is read through the connector (phase 2 bridge/KPI zones).
**Where:** ADR-0006 §3.18, §8.2; probes `rayfin/probes/q1-measures.query.json`, `q1-statement-smoke.query.json`.
**Expires:** 2027-01-19 · **Tags:** semantic-model, dax, decimal, skill-gap · **Promote-to:** quirks.md (QRK) on first reproduction.

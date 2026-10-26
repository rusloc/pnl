# Nerd — Memory Index

## Hot findings (last 30 days)
- 2026-10-27 · Mirelo /sales draft built (ADR-0011 (c)); README js-report/app/sales/README.md, .sync note 2026-10-26-mirelo-sales-track-c-draft.md
- 2026-10-27 · PG-004: stopped `next start` keeps the port on Windows (stale server = fake test failures); kill by port
- 2026-10-27 · CAND-004: modal content swap drops focus to body; refocus close button on content change
- 2026-10-23 · Track C chat layer: lib/chat (tools, runner, prompt, limits) + .sync contract; prefix budget test (≈887/1,200 tok)
- 2026-10-23 · CAND-003: substitute names after operator rewrites (formula "/" bug)
- 2026-10-23 · CONV-001: Track C copy (summaries, notices, titles) lives in lib/engine, tested against Track B measure text
- 2026-10-23 · CAND-001: Track B matrix is 2-level; Track C "collapsed" must keep OPEX open to show all 29 lines
- 2026-10-23 · PG-003: CSS-module class lookups are string | undefined (noUncheckedIndexedAccess); make className props optional
- 2026-10-22 · PG-001: Windows Smart App Control blocks swc / rolldown native binaries; first vitest run can fail, retry passes
- 2026-10-22 · PG-002: Zod 4 union of number literals breaks kind-driven CSV coercion; use bounded z.number()

## Topic files
- platform-gotchas.md — 4 entries · stalest 2026-10-22 · PG-NNN
- conventions.md       — 1 entry   · stalest 2026-10-27 · CONV-NNN
- candidates.md        — 6 awaiting second hit

## Track C facts (verify before citing)
- 2026-10-22: Track C finalisation moved to the vosk.dev repo agent; hand-off in `.sync/2026-10-22-track-c-handoff.md` (steps 0–3 built here).
- Engine reproduces control_totals_usd.csv to ≤ 0.005 USD by translating per row (cents × factor); GROUP = P + S rows with counterparty empty.
- `npm test` reads public/data (build output, gitignored): run `npm run build:data` first.
- 2026-10-23: page top = Track B (period-picker-v2.md Part 2); engine.period() / engine.header() own all header + picker copy; .sync note 2026-10-23.
- Selection serialize bug class: entity-dependent defaults must not swallow the entity key itself (caught by round-trip test).
- 2026-10-23: parity fixes per docs/design/parity-rules.md; .sync note 2026-10-23-track-c-parity-fixes.md. Retired URL keys lay/lens/d parse as unknown (ignored); notices = Track B `_Notice Row` codes N_*; Track B text source: pbi-report/ACME Unified PnL/…SemanticModel/definition/tables/_measures.tmdl.

- 2026-10-23: chat (ADR-0009 §4) in js-report/lib/chat; contract .sync/2026-10-23-track-c-chat-contract.md + machine copy .sync/track-c/chat-tools.json (`npm run export:chat-tools`, stale file fails a test). Backend = small CPU model (archi note): keep schemas terse, codes checked in code not as enums, results ≤ 1,600 chars.
- Chat tool args = patch over current Selection, strict reject (not codec fallback), then codec round trip; unbuilt = restrictToBuilt() diff.

## Mirelo /sales facts (verify before citing)
- Engine lib/sales (framework-free), build scripts/build-sales-data.ts reads data/mirelo_sales_dummy_data/parquet → public/data/sales (197 kB first paint, 915 kB total). `npm run build:sales-data` before `npm test`.
- Distinct-client returning % and MEDIANX are per-window precomputed in the build (window-stats.parquet: tv × anchor × market × segment); everything else is additive monthly cubes translated per month × market in cube.ts.
- Detail sample is exact for its caps (top-N per month × market / agent × month / overdue per market / cohort clients + full client histories); tested against raw fact_loan.
- Control totals (control_totals_eur.csv) reconcile for ALL/PL/RO/PT × Sep 2026, FY2024, FY2025, FY2026 YTD + every closed month.

## Open questions
- 2026-10-27: Mirelo: Budget for interest vs fees (set per product only); leaderboard Approval % / Pace (no agent funnel); loan states are a Sep 2026 snapshot for every anchor — deferred to USER.
- (resolved 2026-10-22) ADR-0002 Q3: USER accepted allocation in the engine; Q5 all deferred.

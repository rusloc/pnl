# Nerd — Memory Index

## Hot findings (last 30 days)
- 2026-10-22 · PG-001: Windows Smart App Control blocks swc / rolldown native binaries; first vitest run can fail, retry passes
- 2026-10-22 · PG-002: Zod 4 union of number literals breaks kind-driven CSV coercion; use bounded z.number()

## Topic files
- platform-gotchas.md — 2 entries · stalest 2026-10-22 · PG-NNN

## Track C facts (verify before citing)
- 2026-10-22: Track C finalisation moved to the vosk.dev repo agent; hand-off in `.sync/2026-10-22-track-c-handoff.md` (steps 0–3 built here).
- Engine reproduces control_totals_usd.csv to ≤ 0.005 USD by translating per row (cents × factor); GROUP = P + S rows with counterparty empty.
- `npm test` reads public/data (build output, gitignored): run `npm run build:data` first.
- Selection serialize bug class: entity-dependent defaults must not swallow the entity key itself (caught by round-trip test).

## Open questions
- (resolved 2026-10-22) ADR-0002 Q3: USER accepted allocation in the engine; Q5 all deferred.

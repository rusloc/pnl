# Nerd — Memory Index

## Hot findings (last 30 days)
- 2026-10-22 · PG-001: Windows Smart App Control blocks swc / rolldown native binaries; first vitest run can fail, retry passes
- 2026-10-22 · PG-002: Zod 4 union of number literals breaks kind-driven CSV coercion; use bounded z.number()

## Topic files
- platform-gotchas.md — 2 entries · stalest 2026-10-22 · PG-NNN

## Track C facts (verify before citing)
- Engine reproduces control_totals_usd.csv to ≤ 0.005 USD by translating per row (cents × factor), GROUP = P + S rows with counterparty empty.
- `npm test` reads public/data (build output, gitignored): run `npm run build:data` first.

## Open questions
- 2026-10-22: ADR-0002 Q3 (allocation in engine vs ship fact_pl_allocated) and Q5 (scope cut) open with USER — step 5+ blocked.

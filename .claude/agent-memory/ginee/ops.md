# Ops

## Facts
- [2026-10-21] ACME Unified PnL created in RAW via REST (create-only); first refresh 28 s after the USER bound acme-lh_raw-sql-dev (source: observed)
- [2026-10-22] ACME Unified PnL measures update via updateDefinition; rollback copy = pbi-report/__backup__/service-2026-10-22/ (service export, 43 parts); no refresh run (source: observed)

- [2026-10-22] Second measures update (2 additions); rollback copy = pbi-report/__backup__/service-2026-10-22b/; staged from one snapshot, removal guard checked (0 removed) (source: observed)

## Decisions

## Pending
- ADR (USER): bip's physical proposals (a) pre-translated amounts, (b) materialised ELIM rows; feasibility notes handed back 2026-10-22

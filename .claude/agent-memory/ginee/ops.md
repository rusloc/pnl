# Ops

## Facts
- [2026-10-21] ACME Unified PnL created in RAW via REST (create-only); first refresh 28 s after the USER bound acme-lh_raw-sql-dev (source: observed)
- [2026-10-22] ACME Unified PnL measures update via updateDefinition; rollback copy = pbi-report/ACME Unified PnL/__backup__/service-2026-10-22/ (service export, 43 parts); no refresh run (source: observed)

- [2026-10-22] Second measures update (2 additions); rollback copy = pbi-report/ACME Unified PnL/__backup__/service-2026-10-22b/; staged from one snapshot, removal guard checked (0 removed) (source: observed)

## Decisions

## Pending
- [2026-10-23] ADR-0008 accepted by USER; ginee wrote §4.1 + §5 service baseline. lh_raw write done + verified (ADR §5 "Load verification"). Pending: PBIP free (USER had Desktop open) -> PQ change (SelectColumns + type number on 3 facts, fact_pl_elim partition to bip) + bip's measures, local tests, service backup + updateDefinition + one refresh, re-time with fabric-data/perf
- [2026-10-23] Do not refresh the current service model before the model change: it would succeed but pull the 3 new cols per fact for nothing (no SelectColumns yet) (source: inferred)
- [2026-10-23] PBIP physical change applied (3 fact TMDLs) + local refresh OK; waiting on bip: fact_pl_elim table + 5 rels + §4.2 measure rewrites, local tests. Then my round: service backup, updateDefinition in place, one refresh (expect > 28 s baseline; model +~130 MB in memory), T-06/T-05/T-10 + Track A parity, re-time with fabric-data/perf (source: observed)
- [2026-10-28] Republish of ACME Unified PnL (ADR-0008 rollout + redesign v4): rollback copy = pbi-report/ACME Unified PnL/__backup__/service-2026-10-28/ (43 parts + raw _getDefinition.json, 177 measures); updateDefinition 16:05 UTC, refresh 16:06:43-16:07:26 UTC (source: observed)

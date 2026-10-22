# Fabric App Builder (fin) — Memory Index

## Collaboration
- [Reference: Track A Fabric items (acme AppBackend id, lh_raw SQL endpoint id, re-link on fresh clone)](reference_track_a.md)

## Domain
<!-- <file> — N entries · class or buckets · hot: top IDs by score -->
- [decisions.md](domain/decisions.md) — 10 (3 DEC + 7 LSN; DEC-002 superseded) · durable · hot: LSN-007 (Q7 KPI Trend: fin8 + ops4 in parallel, explicit `_kpis`, selected-month point = Month tile value; service ≈ 3.5× bip's local timings), DEC-003 (active, phase 2 + §16: every zone + filter live from pnlModel, per-zone status, cache, units pinned M, no RLS yet), LSN-006 (Q1/Q2b fetch level columns only; Δ / Δ % / % NR / KPI Δ derived in `pnl/model/derive.ts` with the DAX rules — blank base counts as 0, blank comparison → blank; parity fixtures from live captures; Q1 −76 %; check `resultSetRowCountLimit` before comparing row sets), LSN-005 (query shapes: scalar CALCULATE per kpi_code not SUMMARIZECOLUMNS over dim_kpi; FILTER NOT ISBLANK on bridge/profitability; slice filters on *_name columns; engine ≈ 1 s per `_Amt Window`, N-01 open for bip), LSN-004 (statement = lines ∪ leaves, 2 hits), LSN-002 (inert controls on sample data → honest sample mode, 2 hits)
- [quirks.md](domain/quirks.md) — 4 · cli 1.36.2 · hot: QRK-004 (ApiClient 30 s default timeout on browser + CLI paths; `timeout` in client config fixes the app, invoke has none — split long probes into halves; 2 hits), QRK-001 (`inspect --name` ignores `${VAR}`; `invoke --name` interpolates, 2 hits), QRK-003 (connector entities have groupBy/aggregate; skill silent)
- [conventions.md](domain/conventions.md) — 1 · 1/0/0 · hot: CNV-001 (every data need = injectable loader on the `PnlDataSource` seam, progressive snapshots, typed non-numeric state until real; failed results not cached)
- [candidates.md](domain/candidates.md) — 0 open · CAND-001 promoted to CNV-001 2026-10-22 · CAND-002 archived 2026-10-22 (Currency measures arrive as plain doubles; CONVERT kept as guard)
- [templates/](domain/templates/) — LSN-005.kpi-scalar.dax (KPI values without the SWITCH fan-out)

## Open questions
- 2026-10-22: N-01 (< 2 s) still open after §16: Q1 ≈ 3.5–7 s engine time (was 20–27 s), KPI chunk ≈ 5 s, P bridge 12–27 s per call (LSN-005 d, LSN-006). bip's measure speed-ups being republished by ginee — re-time Q1/Q3 afterwards; the app shows per-zone loading states meanwhile.
- 2026-10-22: T-05 GROUP bridge gap (ELIM step is a level, 106.3 M) is visible in the app's Group bridge (steps end short of the Actual bar); bip fixing.
- 2026-10-21: ADR-0006 phases 3+: RLS roles + 3 demo Viewer accounts (item-level sharing, Build); §3.14 (OBO + RLS) still [I]; Q0 gate is in the app. `lhraw` retirement after reference reads move to the model.
- 2026-10-21: AI chat for Track A — sits on the ADR-0006 path (data agent or LLM tools over the same model, per-user identity); ADR still needed (LSN-003).
- 2026-10-21: ADR-0003 says "which connector stays open (fin)" — propose ADR update: fabric-sqlanalytics for dims now; `lhraw` retired after reference reads move to the model.
- 2026-10-21: Statement gaps vs the mockup: no alias (dim_pl_row has none), no ifrs18_category tag, no `ent` rows in the Group statement; Trend / Entity-columns layouts and By-nature lens still "not built" — bip/model question if the Ledger needs them.
- 2026-10-22: a stray empty `fabric-app/.claude/agent-memory/` directory exists (an earlier run wrote memory under the track folder); safe to delete — USER's call.

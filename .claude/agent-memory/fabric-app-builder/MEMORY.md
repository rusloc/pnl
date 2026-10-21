# Fabric App Builder (fin) — Memory Index

## Collaboration
- [Reference: Track A Fabric items (acme AppBackend id, lh_raw SQL endpoint id, re-link on fresh clone)](reference_track_a.md)

## Domain
<!-- <file> — N entries · class or buckets · hot: top IDs by score -->
- [decisions.md](domain/decisions.md) — 7 (3 DEC + 4 LSN; DEC-002 superseded) · durable · hot: DEC-003 (active: Track A statement via Track B model, `PL *` Number measures, units pinned M, Month un-gated, no RLS yet; ADR-0006 phase 1), LSN-004 (Statement measures gate on ISINSCOPE(account_label) → Q1 = lines ∪ leaves, never one flat SUMMARIZECOLUMNS), LSN-002 (inert controls on sample data → honest sample/mixed mode, 2 hits)
- [quirks.md](domain/quirks.md) — 3 · cli 1.36.2 · hot: QRK-001 (`inspect --name` ignores `${VAR}`; `invoke --name` interpolates fine, 2 hits), QRK-003 (connector entities have groupBy/aggregate; skill silent), QRK-002 (add/scaffold vs skill)
- [candidates.md](domain/candidates.md) — 2 awaiting second hit (CAND-001 PnlDataSource seam + sample fallback — now also used by the model path; CAND-002 CONVERT(…, DOUBLE) on Currency measures: Number measures proved clean, Currency path untested)

## Open questions
- 2026-10-21: ADR-0006 phases 2+: RLS roles + 3 demo Viewer accounts (item-level sharing, Build), KPI/analysis/profitability zones and the remaining filters to the model, `lhraw` retirement after reference reads move to the model. Phase 1 deployed; §3.14 (OBO + RLS) still [I].
- 2026-10-21: AI chat for Track A — sits on the ADR-0006 path (data agent or LLM tools over the same model, per-user identity); ADR still needed (LSN-003).
- 2026-10-21: ADR-0005 status line edit (superseded by ADR-0006) proposed in ADR-0006 §12, not applied; ADR-0005 prototype code (`pnl-aggregate.prototype.ts`, `fx.ts`, `FactPl`/`FactFxRate`, `#probe`) removal awaits the USER.
- 2026-10-21: ADR-0003 says "which connector stays open (fin)" — propose ADR update: fabric-sqlanalytics for dims now; `lhraw` retired after ADR-0006 phase 2.
- 2026-10-21: Phase-1 statement gaps vs the sample rows: no alias (dim_pl_row has none), no ifrs18_category tag, no `ent` rows in the Group statement (model has none) — bip/model question if the Ledger needs them.

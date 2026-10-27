# Conventions (inductive) — repo norms; refuse-list entries carry `kind: refuse`
<!-- next-id: CNV-003 -->

### CNV-001 · Views sit behind one `PnlDataSource`; every new data need is an injectable loader on that seam, emitted progressively, with an honest non-numeric state until it is real · 2026-10-22
**What:** `packages/frontend/src/pnl/model/types.ts` `PnlDataSource { loadReference(); loadFigures(filter, reference, onUpdate?) }` is the only interface the views know. `createAppDataSource(deps)` takes injectable loaders (`loaders: ZoneLoaders`, `trendLoader: KpiTrendLoader`), caches raw results per query key (`zoneQueryKey`, `trendQueryKey`; a failed result is not cached and is retried on the next load), and emits a fresh `Figures` snapshot each time anything settles. A zone or series that has no data yet carries a typed state (`ZoneStatus`, `KpiTrendState`: loading / live-ready / error-unavailable with the reason / sample) and the view renders that state — never placeholder numbers (LSN-002). Tests inject fake loaders through the same `deps`.
**Why / Evidence:** 3 sightings: (1) 2026-10-21 sample fallback + chip (CAND-001); (2) 2026-10-22 per-zone model path with `onUpdate` snapshots; (3) 2026-10-22 ADR-0007 KPI trends: `KpiTrendLoader` per `dim_kpi` code, started only after the KPI zone settles (tile values first, K-25), `pendingTrendLoader` returns `unavailable` with `TREND_PENDING_MODEL_REASON` until bip's monthly-series contract lands — the views, tests and deploy did not wait for the DAX.
**Where:** `pnl/data/data-source.ts` (`createAppDataSource`, `ZoneCache<T>`, `pendingTrendLoader`), `pnl/data/data-source.spec.ts`, `pnl/model/types.ts`, `pnl/components/zone-state.tsx`, `pnl/components/kpi-trend.tsx`.
**Hits:** 3 · **Confidence:** high · **Tags:** data-source, seam, progressive, loading-state, honesty, testing, adr-0006, adr-0007
**Last-verified:** 2026-10-22 · **Related:** LSN-002, DEC-003, CAND-001
**Status:** active (promoted from CAND-001 on 2026-10-22)

### CNV-002 · A view control that changes a model query lives in `FilterState` (reducer action + allow-list + query key); a display-only control is view state · 2026-10-27
**What:** `breakdown` (F-21, 2026-10-22) and `varCut` (variances cut, 2026-10-27) are `FilterState` keys with their own reducer action, an allow-list per entity (`breakdownKeys`, `varCutsFor`), a fallback on the entity switch, and a per-zone `zoneQueryKey` extra; Top-N / mode / page / collapsed blocks are `useState` in `pnl-app.tsx` or the view and never re-query. Keeps the honest sample gate (`sampleGate`) and the cache keys uniform.
**Why / Evidence:** second sighting; both controls needed the same four pieces (action, allow-list, reset on entity change, key extra) and the chat's tool validator already reads `FilterState`.
**Where:** `model/filters.ts` (`breakdownKeys`, `varCutsFor`, reducer cases `breakdown`, `varCut`), `data/data-source.ts` (`zoneQueryKey`), `pnl-app.tsx` (`pages`, `varTop`, `varMode`)
**Hits:** 2 · **Confidence:** medium · **Tags:** filter-state, view-state, query-key, controls
**Last-verified:** 2026-10-27 · **Related:** CNV-001, DEC-007
**Status:** active


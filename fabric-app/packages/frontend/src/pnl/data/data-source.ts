// The app's `PnlDataSource` (ADR-0006 phase 2): reference data (dims) from lh_raw
// through the lhraw connector plus the model's visible entities (Q0); every
// figure zone from the Track B semantic model through the pnlModel connector,
// one query per zone, read in parallel and reported as each one settles. A zone
// the model cannot answer shows its reason, never numbers that ignore the
// filters (LSN-002). The sample figures are used only when no backend can be
// reached at all (rayfin dev, tests). The views never know which is behind the
// interface.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { type AppClient, getRayfinClient } from '@/lib/rayfin-client';

import type { Figures, FilterState, OperatingEntity, PnlDataSource, ReferenceData, ReferenceLoadResult, ZoneKey, ZoneStatus } from '../model/types';
import { loadLhrawReference } from './lhraw-reference';
import { cellString, type ModelQueryRunner, PnlModelError, runModelQuery } from './pnl-model-client';
import {
  type ContextZone,
  type KpiMeta,
  mapBridge,
  mapContext,
  mapDrivers,
  mapKpiMeta,
  mapKpiTiles,
  mapProfitability,
} from './pnl-model-figures';
import {
  BRIDGE_LIMIT,
  buildBridgeQuery,
  buildContextQuery,
  buildDriversQuery,
  buildKpiMetaQuery,
  buildKpiValuesQuery,
  buildProfitabilityQuery,
  buildStatementQuery,
  CONTEXT_LIMIT,
  DRIVER_LIMIT,
  KPI_CHUNK,
  KPI_META_LIMIT,
  KPI_VALUES_LIMIT,
  PROFITABILITY_LIMIT,
  STATEMENT_LIMIT,
  VISIBLE_ENTITIES_LIMIT,
  VISIBLE_ENTITIES_QUERY,
} from './pnl-model-queries';
import { mapStatementRows } from './pnl-model-statement';
import { sampleReference } from './sample-reference';
import { emptyProfitability, sampleFigures } from './sample-source';

export const ZONES: readonly ZoneKey[] = ['statement', 'kpi', 'bridge', 'drivers', 'profitability', 'context'];

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function requestIdOf(err: unknown): string | undefined {
  return err instanceof PnlModelError ? err.requestId : undefined;
}

// ---------------------------------------------------------------------------
// Query keys: the part of the filter state a zone's query depends on. Display
// settings (units, cost sign, variance format, toggles, layout, detail) are
// applied in TypeScript on the cached result tables and never re-query.

function commonKey(filter: FilterState): unknown[] {
  return [
    filter.entity,
    filter.fiscalYear,
    filter.month,
    filter.timeView,
    filter.baseVersion,
    filter.compareA,
    filter.compareB,
    filter.currency,
    filter.fxBasis,
    filter.regions,
    filter.entity === 'G' ? null : filter.slices[filter.entity],
  ];
}

export function zoneQueryKey(zone: ZoneKey, filter: FilterState): string {
  const extra = zone === 'bridge' || zone === 'drivers' ? [filter.analysisCompare] : zone === 'profitability' ? [filter.breakdown[filter.entity]] : [];
  return JSON.stringify([zone, ...commonKey(filter), ...extra]);
}

/** Raw results per zone, cached by query key; mapping to view shapes happens on every load. */
type ZoneResult =
  | { zone: 'statement' | 'bridge' | 'drivers' | 'profitability' | 'context'; table: QueryTable; requestId: string }
  | { zone: 'kpi'; meta: KpiMeta[]; values: QueryTable[]; requestId: string };

const CACHE_ENTRIES = 60;

/** Session-memory cache of raw zone results (per browser session, per principal: it lives in this tab only). */
class ZoneCache {
  private readonly entries = new Map<string, Promise<ZoneResult>>();

  get(key: string, load: () => Promise<ZoneResult>): Promise<ZoneResult> {
    const hit = this.entries.get(key);
    if (hit) return hit;
    const pending = load().catch((err: unknown) => {
      this.entries.delete(key);
      throw err;
    });
    this.entries.set(key, pending);
    if (this.entries.size > CACHE_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return pending;
  }

  clear(): void {
    this.entries.clear();
  }
}

// ---------------------------------------------------------------------------
// Zone loaders: build the DAX, run it, keep the raw table.

export interface ZoneLoaders {
  statement(runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
  kpi(runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
  bridge(runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
  drivers(runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
  profitability(runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
  context(runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
}

const tableZone =
  (zone: 'statement' | 'bridge' | 'drivers' | 'profitability' | 'context', build: (f: FilterState, r: ReferenceData) => string, limit: number) =>
  async (runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData): Promise<ZoneResult> => {
    const { table, requestId } = await runModelQuery(runner, build(filter, reference), limit);
    return { zone, table, requestId };
  };

export const modelZoneLoaders: ZoneLoaders = {
  statement: tableZone('statement', buildStatementQuery, STATEMENT_LIMIT),
  bridge: tableZone('bridge', buildBridgeQuery, BRIDGE_LIMIT),
  drivers: tableZone('drivers', buildDriversQuery, DRIVER_LIMIT),
  profitability: tableZone('profitability', buildProfitabilityQuery, PROFITABILITY_LIMIT),
  context: tableZone('context', buildContextQuery, CONTEXT_LIMIT),
  async kpi(runner, filter, reference) {
    const metaResult = await runModelQuery(runner, buildKpiMetaQuery(filter.entity), KPI_META_LIMIT);
    const meta = mapKpiMeta(metaResult.table);
    const codes = meta.map((m) => m.code);
    const chunks: string[][] = [];
    for (let i = 0; i < codes.length; i += KPI_CHUNK) chunks.push(codes.slice(i, i + KPI_CHUNK));
    const results = await Promise.all(chunks.map((chunk) => runModelQuery(runner, buildKpiValuesQuery(filter, reference, chunk), KPI_VALUES_LIMIT)));
    return { zone: 'kpi', meta, values: results.map((r) => r.table), requestId: [metaResult.requestId, ...results.map((r) => r.requestId)].join(' ') };
  },
};

// ---------------------------------------------------------------------------
// Assembling figures from zone results.

function emptyLiveFigures(statuses: Record<ZoneKey, ZoneStatus>): Figures {
  return {
    sample: false,
    zones: statuses,
    notices: [],
    dataStatus: null,
    statement: [],
    financial: [],
    operational: [],
    bridge: { subtitle: '', steps: [], axisText: '' },
    drivers: [],
    profitability: emptyProfitability(),
  };
}

type Settled = { status: 'ok'; result: ZoneResult } | { status: 'error'; reason: string; requestId?: string };

/** Pure: whatever has settled so far → one `Figures` snapshot (zones not settled are `loading`). */
export function assembleFigures(settled: Partial<Record<ZoneKey, Settled>>, filter: FilterState, reference: ReferenceData): Figures {
  const zones = Object.fromEntries(ZONES.map((z) => [z, { kind: 'loading' } as ZoneStatus])) as Record<ZoneKey, ZoneStatus>;
  const figures = emptyLiveFigures(zones);
  let context: ContextZone | null = null;
  for (const zone of ZONES) {
    const s = settled[zone];
    if (!s) continue;
    if (s.status === 'error') {
      zones[zone] = { kind: 'error', reason: s.reason, requestId: s.requestId };
      continue;
    }
    try {
      const r = s.result;
      switch (r.zone) {
        case 'statement':
          figures.statement = mapStatementRows(r.table);
          break;
        case 'kpi': {
          const tiles = mapKpiTiles(r.meta, r.values, filter);
          figures.financial = tiles.financial;
          figures.operational = tiles.operational;
          break;
        }
        case 'bridge':
          figures.bridge = mapBridge(r.table, filter);
          break;
        case 'drivers':
          figures.drivers = mapDrivers(r.table, filter);
          break;
        case 'context':
          context = mapContext(r.table);
          figures.notices = context.notices;
          figures.dataStatus = context.dataStatus;
          break;
        case 'profitability':
          // Mapped below: it needs the context zone's CM average and note.
          break;
      }
      zones[zone] = { kind: 'live', requestId: r.requestId };
    } catch (err) {
      zones[zone] = { kind: 'error', reason: reason(err), requestId: requestIdOf(err) ?? s.result.requestId };
    }
  }
  const prof = settled.profitability;
  if (prof?.status === 'ok' && prof.result.zone === 'profitability') {
    try {
      figures.profitability = mapProfitability(prof.result.table, context?.cmAverage ?? null, context?.profitabilityNote ?? '', filter, reference);
    } catch (err) {
      zones.profitability = { kind: 'error', reason: reason(err), requestId: prof.result.requestId };
    }
  }
  return figures;
}

// ---------------------------------------------------------------------------
// The data source.

export interface AppDataSourceDeps {
  getClient: () => Promise<AppClient>;
  loaders?: ZoneLoaders;
}

export function createAppDataSource(deps: AppDataSourceDeps): PnlDataSource {
  const loaders = deps.loaders ?? modelZoneLoaders;
  const cache = new ZoneCache();
  return {
    async loadReference(): Promise<ReferenceLoadResult> {
      let client: AppClient;
      try {
        client = await deps.getClient();
      } catch (err) {
        return { reference: sampleReference(), fallbackReason: reason(err) };
      }
      const [dims, visible] = await Promise.allSettled([loadLhrawReference(client), loadVisibleEntities(client.connectors.pnlModel)]);
      if (dims.status === 'rejected') {
        return { reference: sampleReference(), fallbackReason: reason(dims.reason) };
      }
      // Q0 is a gate on the Group option only; when the model cannot be asked, nothing is gated.
      const reference: ReferenceData = visible.status === 'fulfilled' ? { ...dims.value, visibleEntities: visible.value } : dims.value;
      return { reference };
    },

    async loadFigures(filter, reference, onUpdate): Promise<Figures> {
      let client: AppClient;
      try {
        client = await deps.getClient();
      } catch {
        // No backend at all (rayfin dev, tests): the mockup figures, flagged and gated.
        const figures = sampleFigures(filter);
        onUpdate?.(figures);
        return figures;
      }
      const runner = client.connectors.pnlModel;
      const settled: Partial<Record<ZoneKey, Settled>> = {};
      const emit = () => {
        const snapshot = assembleFigures(settled, filter, reference);
        onUpdate?.(snapshot);
        return snapshot;
      };
      emit();
      await Promise.all(
        ZONES.map(async (zone) => {
          try {
            const result = await cache.get(zoneQueryKey(zone, filter), () => loaders[zone](runner, filter, reference));
            settled[zone] = { status: 'ok', result };
          } catch (err) {
            settled[zone] = { status: 'error', reason: reason(err), requestId: requestIdOf(err) };
          }
          emit();
        })
      );
      return assembleFigures(settled, filter, reference);
    },
  };
}

/** Q0: the operating entities the signed-in user can see (RLS-filtered when roles exist). */
export async function loadVisibleEntities(runner: ModelQueryRunner): Promise<OperatingEntity[]> {
  const { table } = await runModelQuery(runner, VISIBLE_ENTITIES_QUERY, VISIBLE_ENTITIES_LIMIT);
  const codes = table.rows.map((row) => cellString(row[0]));
  return codes.filter((c): c is OperatingEntity => c === 'P' || c === 'S');
}

export const appDataSource: PnlDataSource = createAppDataSource({ getClient: getRayfinClient });

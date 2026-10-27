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
  driversFromVariances,
  mapBridge,
  mapBubble,
  mapConcentration,
  mapContext,
  mapHeat,
  mapProfitability,
  mapProfitBridge,
  mapVarianceLeaves,
  mapVarianceMembers,
  mapVitals,
  mapVitalsInfo,
  mapVitalsMeta,
  type VitalsMeta,
} from './pnl-model-figures';
import {
  BRIDGE_LIMIT,
  BUBBLE_LIMIT,
  buildBridgeQuery,
  buildBubbleQuery,
  buildConcentrationQuery,
  buildContextQuery,
  buildHeatQuery,
  buildProfitabilityQuery,
  buildProfitBridgeQuery,
  buildStatementQuery,
  buildVariancesCutQuery,
  buildVariancesQuery,
  buildVitalsInfoQuery,
  buildVitalsMetaQuery,
  buildVitalsValuesQuery,
  CONCENTRATION_LIMIT,
  CONTEXT_LIMIT,
  CUT_LIMIT,
  HEAT_LIMIT,
  PROFIT_LIMIT,
  PROFITABILITY_LIMIT,
  STATEMENT_LIMIT,
  VARIANCE_LIMIT,
  VISIBLE_ENTITIES_LIMIT,
  VISIBLE_ENTITIES_QUERY,
  VITALS_META_LIMIT,
  VITALS_VALUES_LIMIT,
} from './pnl-model-queries';
import { mapStatementRows } from './pnl-model-statement';
import { sampleReference } from './sample-reference';
import { emptyFigures, sampleFigures } from './sample-source';

/** Every zone, in the order the status record lists them. */
export const ZONES: readonly ZoneKey[] = [
  'statement',
  'vitals',
  'vitalsInfo',
  'bridge',
  'profit',
  'variances',
  'variancesCut',
  'profitability',
  'concentration',
  'bubble',
  'heat',
  'context',
];


function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function requestIdOf(err: unknown): string | undefined {
  return err instanceof PnlModelError ? err.requestId : undefined;
}

// ---------------------------------------------------------------------------
// Query keys: the part of the filter state a zone's query depends on. Display
// settings (units, cost sign, variance format, toggles) are applied in
// TypeScript on the cached result tables and never re-query.

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

/** Every Profitability panel is at constant currency whatever the Display flyout says (PV-02). */
export const CC_ZONES: readonly ZoneKey[] = ['profitability', 'concentration', 'bubble', 'heat'];

export function zoneQueryKey(zone: ZoneKey, filter: FilterState): string {
  const extra = zone === 'profitability' ? [filter.breakdown[filter.entity]] : zone === 'variancesCut' ? [filter.varCut] : [];
  return JSON.stringify([zone, ...commonKey(CC_ZONES.includes(zone) ? { ...filter, fxBasis: 'constant' } : filter), ...extra]);
}

/** Raw results per zone, cached by query key; mapping to view shapes happens on every load. */
export type ZoneResult =
  | { zone: 'statement' | 'bridge' | 'profit' | 'variances' | 'profitability' | 'concentration' | 'bubble' | 'heat' | 'context'; table: QueryTable; requestId: string }
  | { zone: 'vitals'; meta: VitalsMeta[]; values: QueryTable[]; requestId: string }
  | { zone: 'vitalsInfo'; codes: string[]; tables: QueryTable[]; requestId: string }
  /** `table` is null when no cut is selected (nothing was asked). */
  | { zone: 'variancesCut'; table: QueryTable | null; requestId: string };

const CACHE_ENTRIES = 80;

/** Session-memory cache of raw results (per browser session, per principal: it lives in this tab only). */
class ZoneCache<T> {
  private readonly entries = new Map<string, Promise<T>>();

  get(key: string, load: () => Promise<T>): Promise<T> {
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

export type ZoneLoader = (runner: ModelQueryRunner, filter: FilterState, reference: ReferenceData) => Promise<ZoneResult>;
export type ZoneLoaders = Record<ZoneKey, ZoneLoader>;

const tableZone =
  (zone: Extract<ZoneResult, { table: QueryTable }>['zone'], build: (f: FilterState, r: ReferenceData) => string, limit: number): ZoneLoader =>
  async (runner, filter, reference) => {
    const sent = CC_ZONES.includes(zone) ? { ...filter, fxBasis: 'constant' as const } : filter;
    const { table, requestId } = await runModelQuery(runner, build(sent, reference), limit);
    return { zone, table, requestId };
  };

function chunks(codes: readonly string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < codes.length; i += size) out.push(codes.slice(i, i + size));
  return out;
}

/** Vitals codes per values call: 3 keeps each call near the KPI chunk timing (LSN-005). */
export const VITALS_CHUNK = 3;

export const modelZoneLoaders: ZoneLoaders = {
  statement: tableZone('statement', buildStatementQuery, STATEMENT_LIMIT),
  bridge: tableZone('bridge', buildBridgeQuery, BRIDGE_LIMIT),
  profit: tableZone('profit', buildProfitBridgeQuery, PROFIT_LIMIT),
  variances: tableZone('variances', buildVariancesQuery, VARIANCE_LIMIT),
  profitability: tableZone('profitability', buildProfitabilityQuery, PROFITABILITY_LIMIT),
  concentration: tableZone('concentration', buildConcentrationQuery, CONCENTRATION_LIMIT),
  bubble: tableZone('bubble', buildBubbleQuery, BUBBLE_LIMIT),
  heat: tableZone('heat', buildHeatQuery, HEAT_LIMIT),
  context: tableZone('context', buildContextQuery, CONTEXT_LIMIT),
  async variancesCut(runner, filter, reference) {
    if (filter.varCut === 'none') return { zone: 'variancesCut', table: null, requestId: '' };
    const { table, requestId } = await runModelQuery(runner, buildVariancesCutQuery(filter, reference), CUT_LIMIT);
    return { zone: 'variancesCut', table, requestId };
  },
  async vitals(runner, filter, reference) {
    const metaResult = await runModelQuery(runner, buildVitalsMetaQuery(filter.entity), VITALS_META_LIMIT);
    const meta = mapVitalsMeta(metaResult.table);
    const results = await Promise.all(
      chunks(
        meta.map((m) => m.code),
        VITALS_CHUNK
      ).map((chunk) => runModelQuery(runner, buildVitalsValuesQuery(filter, reference, chunk), VITALS_VALUES_LIMIT))
    );
    return { zone: 'vitals', meta, values: results.map((r) => r.table), requestId: [metaResult.requestId, ...results.map((r) => r.requestId)].join(' ') };
  },
  async vitalsInfo(runner, filter, reference) {
    const metaResult = await runModelQuery(runner, buildVitalsMetaQuery(filter.entity), VITALS_META_LIMIT);
    const codes = mapVitalsMeta(metaResult.table).map((m) => m.code);
    const results = await Promise.all(chunks(codes, VITALS_CHUNK).map((chunk) => runModelQuery(runner, buildVitalsInfoQuery(filter, reference, chunk), VITALS_VALUES_LIMIT)));
    return { zone: 'vitalsInfo', codes, tables: results.map((r) => r.table), requestId: [metaResult.requestId, ...results.map((r) => r.requestId)].join(' ') };
  },
};

// ---------------------------------------------------------------------------
// Assembling figures from zone results.

type Settled = { status: 'ok'; result: ZoneResult } | { status: 'error'; reason: string; requestId?: string };

/** Pure: whatever has settled so far → one `Figures` snapshot (zones not settled are `loading`). */
export function assembleFigures(settled: Partial<Record<ZoneKey, Settled>>, filter: FilterState, reference: ReferenceData): Figures {
  const zones = Object.fromEntries(ZONES.map((z) => [z, { kind: 'loading' } as ZoneStatus])) as Record<ZoneKey, ZoneStatus>;
  const figures = emptyFigures(zones);
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
        case 'vitals':
          figures.vitals = mapVitals(r.meta, r.values, filter);
          break;
        case 'vitalsInfo':
          figures.vitalsInfo = mapVitalsInfo(r.codes, r.tables);
          break;
        case 'bridge':
          figures.bridge = mapBridge(r.table, filter);
          break;
        case 'profit':
          figures.profit = mapProfitBridge(r.table, filter);
          break;
        case 'variances':
          figures.variances = mapVarianceLeaves(r.table);
          figures.drivers = driversFromVariances(figures.variances, filter);
          break;
        case 'variancesCut':
          figures.variancesCut = r.table === null ? null : mapVarianceMembers(r.table, filter, reference);
          break;
        case 'profitability':
          figures.profitability = mapProfitability(r.table, filter, reference);
          break;
        case 'concentration':
          figures.concentration = mapConcentration(r.table, filter);
          break;
        case 'bubble':
          figures.bubble = mapBubble(r.table, filter);
          break;
        case 'heat':
          figures.heat = mapHeat(r.table, filter);
          break;
        case 'context':
          context = mapContext(r.table);
          figures.notices = context.notices;
          figures.dataStatus = context.dataStatus;
          figures.refreshedAt = context.refreshedAt;
          break;
      }
      zones[zone] = { kind: 'live', requestId: r.requestId };
    } catch (err) {
      zones[zone] = { kind: 'error', reason: reason(err), requestId: requestIdOf(err) ?? s.result.requestId };
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

/**
 * One zone on demand, through the same cache as the views (ADR-0009 §2): the AI
 * chat's tools read a zone for a validated filter state (`get_kpis` / `explain_kpi`
 * read `vitals`); on the current filters every call is a cache hit, elsewhere it
 * costs one view query.
 */
export interface ZoneReader {
  loadZone(zone: ZoneKey, filter: FilterState, reference: ReferenceData): Promise<ZoneResult>;
}

export function createAppDataSource(deps: AppDataSourceDeps): PnlDataSource & ZoneReader {
  const loaders = deps.loaders ?? modelZoneLoaders;
  const cache = new ZoneCache<ZoneResult>();
  return {
    async loadZone(zone, filter, reference): Promise<ZoneResult> {
      const client = await deps.getClient();
      return cache.get(zoneQueryKey(zone, filter), () => loaders[zone](client.connectors.pnlModel, filter, reference));
    },

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

export const appDataSource: PnlDataSource & ZoneReader = createAppDataSource({ getClient: getRayfinClient });

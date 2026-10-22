// The app data source (ADR-0006 phase 2): every zone from the model, read in
// parallel and reported as it settles; a failed zone carries its reason and no
// numbers; raw results are cached per query key so display settings never
// re-query; without a backend at all the sample figures come back, flagged.
import type { ExecuteQueryInput, SemanticModelQueryResult } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it, vi } from 'vitest';

import type { AppClient } from '@/lib/rayfin-client';

import { defaultFilters } from '../model/filters';
import type { Figures, ZoneKey } from '../model/types';
import { assembleFigures, createAppDataSource, loadVisibleEntities, modelZoneLoaders, zoneQueryKey, ZONES, type ZoneLoaders } from './data-source';
import type { ModelQueryRunner } from './pnl-model-client';
import { sampleReference } from './sample-reference';
import { sampleFigures } from './sample-source';

const reference = sampleReference();
const filter = defaultFilters(reference);
const fakeClient = { connectors: { pnlModel: {} } } as unknown as AppClient;

const statementTable = {
  columns: [
    'dim_pl_row[row_key]', 'dim_pl_row[line_code]', 'dim_pl_row[line_label]', 'dim_pl_row[row_type]', 'dim_pl_row[is_key]',
    'dim_pl_row[tag]', 'dim_pl_row[account_code]', 'dim_pl_row[account_label]', 'dim_pl_row[is_leaf]', 'dim_pl_row[line_sort]',
    'dim_pl_row[account_sort]', '[@base]', '[@pct_nr]', '[@cmp_a]', '[@d_a]', '[@d_a_pct]', '[@cmp_b]', '[@d_b]', '[@d_b_pct]',
    '[@fy_bud]', '[@fy_le]', '[@fy_d]',
  ].map((name) => ({ name, dataType: 'String' })),
  rows: [['NR', 'NR', 'Net revenue', 'subtotal', true, '', '', '', false, 30, 0, 3398.52, 1, 3464.8, -66.28, -0.019, null, null, null, null, null, null]],
};
const contextTable = {
  columns: ['[@status]', '[@notices]', '[@prof_note]', '[@cm_pct]'].map((name) => ({ name, dataType: 'String' })),
  rows: [['Closed through Sep 2026  ·  Refreshed 21 Oct 2026 18:00', 'Group notice', 'prof note', 0.39]],
};

/** Loaders that resolve in a controlled order; unlisted zones fail with a reason. */
function fakeLoaders(overrides: Partial<Record<ZoneKey, () => Promise<unknown>>>): ZoneLoaders & { calls: Record<ZoneKey, number> } {
  const calls = Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<ZoneKey, number>;
  const make = (zone: ZoneKey) => async () => {
    calls[zone] += 1;
    const o = overrides[zone];
    if (!o) throw new Error(`${zone} unavailable`);
    return (await o()) as never;
  };
  return { calls, statement: make('statement'), kpi: make('kpi'), bridge: make('bridge'), drivers: make('drivers'), profitability: make('profitability'), context: make('context') };
}

describe('createAppDataSource().loadFigures', () => {
  it('reports every zone as loading first, then each one as it settles, live or with its reason', async () => {
    const loaders = fakeLoaders({
      statement: async () => ({ zone: 'statement', table: statementTable, requestId: 'req-s' }),
      context: async () => ({ zone: 'context', table: contextTable, requestId: 'req-c' }),
    });
    const source = createAppDataSource({ getClient: async () => fakeClient, loaders });
    const snapshots: Figures[] = [];
    const final = await source.loadFigures(filter, reference, (f) => snapshots.push(f));

    expect(snapshots[0].sample).toBe(false);
    expect(Object.values(snapshots[0].zones).every((z) => z.kind === 'loading')).toBe(true);
    expect(snapshots.length).toBe(1 + ZONES.length);

    expect(final.zones.statement).toEqual({ kind: 'live', requestId: 'req-s' });
    expect(final.statement[0].code).toBe('NR');
    expect(final.zones.context).toEqual({ kind: 'live', requestId: 'req-c' });
    expect(final.notices).toEqual(['Group notice']);
    expect(final.dataStatus).toBe('Closed through Sep 2026  ·  Refreshed 21 Oct 2026 18:00');
    expect(final.zones.kpi).toEqual({ kind: 'error', reason: 'kpi unavailable', requestId: undefined });
    expect(final.financial).toEqual([]);
    expect(final.zones.bridge.kind).toBe('error');
    expect(final.bridge.steps).toEqual([]);
    // The profitability zone failed on its own; the context note is not enough to show a table.
    expect(final.zones.profitability.kind).toBe('error');
    expect(final.profitability.rows).toEqual([]);
  });

  it('caches raw results per query key: the same filter again, or a display-only change, re-queries nothing', async () => {
    const loaders = fakeLoaders({ statement: async () => ({ zone: 'statement', table: statementTable, requestId: 'req-s' }) });
    const source = createAppDataSource({ getClient: async () => fakeClient, loaders });
    await source.loadFigures(filter, reference);
    await source.loadFigures(filter, reference);
    await source.loadFigures({ ...filter, units: 'k', costSign: 'pos', showPctNr: false, detail: 'full' }, reference);
    expect(loaders.calls.statement).toBe(1);
    // A failed zone is not cached: it is retried on the next load.
    expect(loaders.calls.kpi).toBe(3);
    // A query-relevant change loads again.
    await source.loadFigures({ ...filter, month: 6 }, reference);
    expect(loaders.calls.statement).toBe(2);
  });

  it('falls back to the sample figures, flagged and gated, only when there is no client at all (rayfin dev, offline)', async () => {
    const loaders = fakeLoaders({});
    const source = createAppDataSource({
      getClient: async () => {
        throw new Error('Missing required Rayfin configuration: apiUrl');
      },
      loaders,
    });
    const snapshots: Figures[] = [];
    const figures = await source.loadFigures(filter, reference, (f) => snapshots.push(f));
    expect(figures).toEqual(sampleFigures(filter));
    expect(figures.sample).toBe(true);
    expect(snapshots).toHaveLength(1);
    expect(loaders.calls.statement).toBe(0);
    const ref = await source.loadReference();
    expect(ref.reference.source).toBe('sample');
    expect(ref.fallbackReason).toMatch(/Missing required Rayfin configuration/);
  });
});

describe('zoneQueryKey', () => {
  it('depends on the filters a zone’s query reads and nothing else', () => {
    const base = zoneQueryKey('statement', filter);
    expect(zoneQueryKey('statement', { ...filter, units: 'k', layout: 'trend', hideEmpty: false })).toBe(base);
    expect(zoneQueryKey('statement', { ...filter, analysisCompare: 'PY' })).toBe(base);
    expect(zoneQueryKey('bridge', { ...filter, analysisCompare: 'PY' })).not.toBe(zoneQueryKey('bridge', filter));
    expect(zoneQueryKey('profitability', { ...filter, breakdown: { ...filter.breakdown, P: 0 } })).not.toBe(zoneQueryKey('profitability', filter));
    expect(zoneQueryKey('statement', { ...filter, fxBasis: 'constant' })).not.toBe(base);
    // Another entity's slices do not matter for this entity (F-30).
    expect(zoneQueryKey('statement', { ...filter, slices: { ...filter.slices, S: { channel: ['SELF'], line: null, segment: null } } })).toBe(base);
  });
});

describe('modelZoneLoaders.kpi', () => {
  it('reads dim_kpi once, then the values in chunks of three codes', async () => {
    const metaTable = {
      columns: ['dim_kpi[slot]', 'dim_kpi[kpi_code]', 'dim_kpi[kpi_label]', 'dim_kpi[kpi_group]', 'dim_kpi[better_when]', 'dim_kpi[value_type]', 'dim_kpi[definition]'].map((name) => ({ name, dataType: 'String' })),
      rows: ['NR', 'ORG_GROWTH', 'GM_PCT', 'GTN_PCT', 'AP_PCT'].map((code, i) => [i + 1, code, code, 'Financial', 'Higher', 'PCT', '']),
    };
    let n = 0;
    const executeQuery = vi.fn<(input: ExecuteQueryInput) => Promise<SemanticModelQueryResult>>(async ({ query }) => ({
      status: 'success',
      table: query.includes('FILTER ( dim_kpi') ? metaTable : { columns: [], rows: [[]] },
      requestId: `req-${(n += 1)}`,
    }));
    const result = await modelZoneLoaders.kpi({ executeQuery }, filter, reference);
    expect(result.zone).toBe('kpi');
    expect(executeQuery).toHaveBeenCalledTimes(3);
    expect(executeQuery.mock.calls[1][0].query).toContain('"@NR"');
    expect(executeQuery.mock.calls[1][0].query).toContain('"@GM_PCT_s"');
    expect(executeQuery.mock.calls[2][0].query).toContain('"@AP_PCT"');
    expect(executeQuery.mock.calls[1][0].resultSetRowCountLimit).toBe(5);
    expect(result.requestId.split(' ')).toHaveLength(3);
  });
});

describe('assembleFigures', () => {
  it('turns a mapper failure into a zone error rather than dropping the snapshot', () => {
    const settled = { statement: { status: 'ok' as const, result: { zone: 'statement' as const, table: { columns: [], rows: [] }, requestId: 'req-x' } } };
    const figures = assembleFigures(settled, filter, reference);
    expect(figures.zones.statement).toMatchObject({ kind: 'error', requestId: 'req-x' });
    expect((figures.zones.statement as { reason: string }).reason).toMatch(/missing column/);
    expect(figures.zones.kpi).toEqual({ kind: 'loading' });
  });
});

describe('loadReference with the model’s visible entities (Q0)', () => {
  const runner = (codes: string[]): ModelQueryRunner => ({
    executeQuery: async () => ({ status: 'success', table: { columns: [{ name: 'dim_entity[entity_code]', dataType: 'String' }], rows: codes.map((c) => [c]) }, requestId: 'req-0' }),
  });

  it('keeps the operating entity codes the model returns', async () => {
    await expect(loadVisibleEntities(runner(['P', 'S']))).resolves.toEqual(['P', 'S']);
    await expect(loadVisibleEntities(runner(['S']))).resolves.toEqual(['S']);
    await expect(loadVisibleEntities(runner([]))).resolves.toEqual([]);
  });

  it('surfaces a failed Q0 as an error for loadReference to ignore (the gate is UX; RLS is the model’s)', async () => {
    const failing: ModelQueryRunner = { executeQuery: async () => ({ status: 'error', error: { category: 'api', message: 'FEATURE_NOT_ENABLED' }, requestId: 'req-e' }) };
    await expect(loadVisibleEntities(failing)).rejects.toThrow(/FEATURE_NOT_ENABLED/);
  });
});

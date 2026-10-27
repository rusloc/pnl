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
import type { VitalsMeta } from './pnl-model-figures';
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
  return { calls, ...(Object.fromEntries(ZONES.map((z) => [z, make(z)])) as unknown as ZoneLoaders) };
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
    expect(final.zones.vitals).toEqual({ kind: 'error', reason: 'vitals unavailable', requestId: undefined });
    expect(final.vitals.results).toEqual([]);
    expect(final.zones.bridge.kind).toBe('error');
    expect(final.bridge.steps).toEqual([]);
    expect(final.zones.profitability.kind).toBe('error');
    expect(final.profitability.rows).toEqual([]);
    expect(final.zones.heat.kind).toBe('error');
  });

  it('caches raw results per query key: the same filter again, or a display-only change, re-queries nothing', async () => {
    const loaders = fakeLoaders({ statement: async () => ({ zone: 'statement', table: statementTable, requestId: 'req-s' }) });
    const source = createAppDataSource({ getClient: async () => fakeClient, loaders });
    await source.loadFigures(filter, reference);
    await source.loadFigures(filter, reference);
    await source.loadFigures({ ...filter, units: 'k', costSign: 'pos', showPctNr: false, showFyOutlook: false }, reference);
    expect(loaders.calls.statement).toBe(1);
    // A failed zone is not cached: it is retried on the next load.
    expect(loaders.calls.vitals).toBe(3);
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
    expect(zoneQueryKey('statement', { ...filter, units: 'k', costSign: 'pos', hideEmpty: false })).toBe(base);
    // Parity rule 1: the analysis zones read Compare A / B like every other zone; no toggle of their own.
    expect(zoneQueryKey('bridge', { ...filter, compareA: 'PY' })).not.toBe(zoneQueryKey('bridge', filter));
    expect(zoneQueryKey('variances', { ...filter, compareB: 'NONE' })).not.toBe(zoneQueryKey('variances', filter));
    expect(zoneQueryKey('profitability', { ...filter, breakdown: { ...filter.breakdown, P: 1 } })).not.toBe(zoneQueryKey('profitability', filter));
    expect(zoneQueryKey('statement', { ...filter, fxBasis: 'constant' })).not.toBe(base);
    // The cut is a query input of its own zone only; every Profitability zone is at constant currency whatever the flyout says (PV-02).
    expect(zoneQueryKey('variancesCut', { ...filter, varCut: 'region' })).not.toBe(zoneQueryKey('variancesCut', filter));
    expect(zoneQueryKey('variances', { ...filter, varCut: 'region' })).toBe(zoneQueryKey('variances', filter));
    for (const zone of ['profitability', 'concentration', 'bubble', 'heat'] as const) {
      expect(zoneQueryKey(zone, { ...filter, fxBasis: 'constant' })).toBe(zoneQueryKey(zone, filter));
    }
    // Another entity's slices do not matter for this entity (F-30).
    expect(zoneQueryKey('statement', { ...filter, slices: { ...filter.slices, S: { channel: ['SELF'], line: null, segment: null } } })).toBe(base);
  });
});

describe('assembleFigures', () => {
  it('turns a mapper failure into a zone error rather than dropping the snapshot', () => {
    const settled = { statement: { status: 'ok' as const, result: { zone: 'statement' as const, table: { columns: [], rows: [] }, requestId: 'req-x' } } };
    const figures = assembleFigures(settled, filter, reference);
    expect(figures.zones.statement).toMatchObject({ kind: 'error', requestId: 'req-x' });
    expect((figures.zones.statement as { reason: string }).reason).toMatch(/missing column/);
    expect(figures.zones.vitals).toEqual({ kind: 'loading' });
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

// The AI assistant's `get_kpis` reads the Vitals zone on demand through the same cache (ADR-0009 §2).
describe('createAppDataSource().loadZone — Vitals for the AI assistant', () => {
  const META: VitalsMeta[] = [
    { slot: 1, tier: 'hero', code: 'NR', label: 'Net revenue', betterWhen: 'Higher', valueType: 'AMT', definition: 'Gross revenue + GTN' },
    { slot: 6, tier: 'driver', code: 'UNITS', label: 'Units sold', betterWhen: 'Higher', valueType: 'CNT', definition: '' },
  ];
  const valuesTable = {
    columns: ['[@NR]', '[@NR_cmp_a]', '[@NR_cmp_b]', '[@UNITS]', '[@UNITS_cmp_a]', '[@UNITS_cmp_b]'].map((name) => ({ name, dataType: 'Double' })),
    rows: [[3398.5, 3464.8, 3250.1, 419.8, 427.1, 404.1]],
  };
  const vitalsResult = async () => ({ zone: 'vitals', meta: META, values: [valuesTable], requestId: 'req-k' });

  it('maps the cards from the QV2 values and sends no further query', async () => {
    const executeQuery = vi.fn<(input: ExecuteQueryInput) => Promise<SemanticModelQueryResult>>();
    const client = { connectors: { pnlModel: { executeQuery } } } as unknown as AppClient;
    const source = createAppDataSource({ getClient: async () => client, loaders: fakeLoaders({ vitals: vitalsResult }) });
    const result = await source.loadZone('vitals', filter, reference);
    const final = assembleFigures({ vitals: { status: 'ok', result } }, filter, reference);
    expect(executeQuery).not.toHaveBeenCalled();
    expect(final.zones.vitals).toEqual({ kind: 'live', requestId: 'req-k' });
    expect(final.vitals.results[0]).toMatchObject({
      code: 'NR',
      value: '$3,398.5 m',
      status: { kind: 'watch' },
      rows: [
        { name: 'vs Budget', abs: '−66.3', rel: '−1.9%', tone: 'watch' },
        { name: 'vs Prior year', abs: '+148.4', rel: '+4.6%', tone: 'neutral' },
      ],
    });
    expect(final.vitals.drivers[0].rows.map((r) => r.rel)).toEqual(['−1.7%', '+3.9%']);
  });
});

describe('modelZoneLoaders — redesign v4 zones', () => {
  const metaTable = {
    columns: ['dim_kpi[vitals_slot]', 'dim_kpi[vitals_tier]', 'dim_kpi[kpi_code]', 'dim_kpi[kpi_label]', 'dim_kpi[better_when]', 'dim_kpi[value_type]', 'dim_kpi[definition]'].map((name) => ({ name, dataType: 'String' })),
    rows: ['NR', 'EBITDA', 'OP', 'GM_PCT'].map((code, i) => [i + 1, i < 3 ? 'Hero' : 'Secondary', code, code, 'Higher', 'AMT', '']),
  };
  const runner = () => {
    let n = 0;
    const executeQuery = vi.fn<(input: ExecuteQueryInput) => Promise<SemanticModelQueryResult>>(async ({ query }) => ({
      status: 'success',
      table: query.includes('FILTER ( dim_kpi') ? metaTable : { columns: [], rows: [[]] },
      requestId: `req-${(n += 1)}`,
    }));
    return executeQuery;
  };

  it('vitals: reads the Vitals rows once, then the values in chunks of three codes; vitalsInfo the same with KPI Info Sub', async () => {
    const executeQuery = runner();
    const result = await modelZoneLoaders.vitals({ executeQuery }, filter, reference);
    expect(result.zone).toBe('vitals');
    expect(executeQuery).toHaveBeenCalledTimes(3);
    expect(executeQuery.mock.calls[0][0].query).toContain('dim_kpi[vitals_slot] > 0');
    expect(executeQuery.mock.calls[1][0].query).toContain('"@NR"');
    expect(executeQuery.mock.calls[2][0].query).toContain('"@GM_PCT"');
    const info = await modelZoneLoaders.vitalsInfo({ executeQuery: runner() }, filter, reference);
    expect(info.zone).toBe('vitalsInfo');
    expect(info.zone === 'vitalsInfo' && info.codes).toEqual(['NR', 'EBITDA', 'OP', 'GM_PCT']);
  });

  it('variancesCut: no query without a cut; one query with the cut; the Profitability zones are sent at constant currency', async () => {
    const executeQuery = runner();
    const none = await modelZoneLoaders.variancesCut({ executeQuery }, filter, reference);
    expect(none).toEqual({ zone: 'variancesCut', table: null, requestId: '' });
    expect(executeQuery).not.toHaveBeenCalled();
    await modelZoneLoaders.variancesCut({ executeQuery }, { ...filter, varCut: 'region' }, reference);
    expect(executeQuery.mock.calls[0][0].query).toContain('dim_region[region_code]');
    expect(executeQuery.mock.calls[0][0].resultSetRowCountLimit).toBe(600);
    await modelZoneLoaders.profitability({ executeQuery }, { ...filter, fxBasis: 'actual' }, reference);
    expect(executeQuery.mock.calls[1][0].query).toContain('TREATAS ( { "CC" }, param_fx_basis[fx_basis_code] )');
    await modelZoneLoaders.statement({ executeQuery }, { ...filter, fxBasis: 'actual' }, reference);
    expect(executeQuery.mock.calls[2][0].query).toContain('TREATAS ( { "ACT" }, param_fx_basis[fx_basis_code] )');
  });
});

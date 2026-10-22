// The app data source (ADR-0006 phase 2): every zone from the model, read in
// parallel and reported as it settles; a failed zone carries its reason and no
// numbers; raw results are cached per query key so display settings never
// re-query; without a backend at all the sample figures come back, flagged.
import type { ExecuteQueryInput, SemanticModelQueryResult } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it, vi } from 'vitest';

import type { AppClient } from '@/lib/rayfin-client';

import { defaultFilters } from '../model/filters';
import type { Figures, ZoneKey } from '../model/types';
import { assembleFigures, createAppDataSource, loadVisibleEntities, modelTrendLoader, modelZoneLoaders, trendBatches, trendQueryKey, zoneQueryKey, ZONES, type KpiTrendLoader, type ZoneLoaders } from './data-source';
import { Q7_FIN_OPS } from './fixtures/q7-kpi-trend.fixture';
import type { KpiMeta } from './pnl-model-figures';
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
    await source.loadFigures({ ...filter, units: 'k', costSign: 'pos', showPctNr: false, showFyOutlook: false }, reference);
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
    expect(zoneQueryKey('statement', { ...filter, units: 'k', costSign: 'pos', hideEmpty: false })).toBe(base);
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

// K-24, K-25 (ADR-0007): the trends start after the KPI zone settles, in two batches (financial /
// operational) reported on their own, and the tile values are never held back by them.
describe('createAppDataSource().loadFigures — KPI trends (Q7)', () => {
  const META: KpiMeta[] = [
    { slot: 1, code: 'NR', label: 'Net revenue', group: 'Financial', betterWhen: 'Higher', valueType: 'AMT', definition: '' },
    { slot: 2, code: 'ORG_GROWTH', label: 'Organic growth', group: 'Financial', betterWhen: 'Higher', valueType: 'PCT', definition: '' },
    { slot: 9, code: 'UNITS', label: 'Units sold', group: 'Operational', betterWhen: 'Higher', valueType: 'CNT', definition: '' },
  ];
  const valuesTable = {
    columns: ['[@NR]', '[@NR_cmp_a]', '[@NR_cmp_b]', '[@NR_s]', '[@ORG_GROWTH]', '[@ORG_GROWTH_cmp_a]', '[@ORG_GROWTH_cmp_b]', '[@ORG_GROWTH_s]', '[@UNITS]', '[@UNITS_cmp_a]', '[@UNITS_cmp_b]', '[@UNITS_s]'].map((name) => ({ name, dataType: 'Double' })),
    rows: [[3398.5, 3464.8, 3250.1, '', 0.06, 0.09, 0, 'Reported +8.2%', 419.8, 427.1, 404.1, '']],
  };
  const kpiResult = async () => ({ zone: 'kpi', meta: META, values: [valuesTable], requestId: 'req-k' });

  it('splits the batches by kpi_group: financial tiles, then operational tiles', () => {
    expect(trendBatches(META).map((b) => b.map((m) => m.code))).toEqual([['NR', 'ORG_GROWTH'], ['UNITS']]);
    expect(trendBatches(META.filter((m) => m.group === 'Financial'))).toHaveLength(1);
  });

  it('runs Q7 per batch through the connector after the values are on screen, and maps the series as ready', async () => {
    const executeQuery = vi.fn<(input: ExecuteQueryInput) => Promise<SemanticModelQueryResult>>(async ({ query }) => ({
      status: 'success',
      table: query.includes('[KPI Trend]') ? Q7_FIN_OPS : { columns: [], rows: [] },
      requestId: 'req-t',
    }));
    const client = { connectors: { pnlModel: { executeQuery } } } as unknown as AppClient;
    const source = createAppDataSource({ getClient: async () => client, loaders: fakeLoaders({ kpi: kpiResult }) });
    const snapshots: Figures[] = [];
    const final = await source.loadFigures(filter, reference, (f) => snapshots.push(f));
    const firstWithValues = snapshots.find((f) => f.financial.length > 0);
    // Values first (trends empty), with the target bar inputs on the tile.
    expect(firstWithValues?.trends).toEqual({});
    expect(firstWithValues?.financial[0]).toMatchObject({ code: 'NR', target: { base: 3398.5, marks: [{ name: 'Budget', value: 3464.8, text: '$3,464.8m' }, { name: 'Prior year', value: 3250.1 }] } });
    expect(firstWithValues?.financial[1].target).toBeNull();
    // Two Q7 calls, one per batch, each with its own _kpis list and the 200-row cap.
    const trendCalls = executeQuery.mock.calls.filter(([i]) => i.query.includes('[KPI Trend]'));
    expect(trendCalls).toHaveLength(2);
    expect(trendCalls[0][0].query).toContain('TREATAS ( { "NR", "ORG_GROWTH" }, dim_kpi[kpi_code] )');
    expect(trendCalls[1][0].query).toContain('TREATAS ( { "UNITS" }, dim_kpi[kpi_code] )');
    expect(trendCalls[0][0].resultSetRowCountLimit).toBe(200);
    expect(final.trends.NR.kind).toBe('ready');
    expect(final.trends.ORG_GROWTH.kind).toBe('ready');
    expect(final.trends.UNITS.kind).toBe('ready');
    if (final.trends.NR.kind === 'ready') expect(final.trends.NR.trend.points.at(-1)).toMatchObject({ month: '2026-09', value: 419.9 });
  });

  it('settles each batch on its own, marks a failed batch unavailable with the reason, caches successes and retries failures', async () => {
    const gate: Record<string, () => void> = {};
    const trendLoader = vi.fn<KpiTrendLoader>(async (_r, _f, _ref, meta) => {
      const key = meta.map((m) => m.code).join(',');
      if (!gate[key]) {
        await new Promise<void>((resolve) => {
          gate[key] = resolve;
        });
      }
      if (key === 'UNITS') throw new Error('series timed out');
      return Object.fromEntries(meta.map((m) => [m.code, { kind: 'ready' as const, trend: { code: m.code, points: [] } }]));
    });
    const source = createAppDataSource({ getClient: async () => fakeClient, loaders: fakeLoaders({ kpi: kpiResult }), trendLoader });
    const snapshots: Figures[] = [];
    const pending = source.loadFigures(filter, reference, (f) => snapshots.push(f));
    await vi.waitFor(() => expect(Object.keys(gate).sort()).toEqual(['NR,ORG_GROWTH', 'UNITS']));
    gate['NR,ORG_GROWTH']();
    await vi.waitFor(() => expect(snapshots.at(-1)?.trends.NR?.kind).toBe('ready'));
    expect(snapshots.at(-1)?.trends.ORG_GROWTH?.kind).toBe('ready');
    expect(snapshots.at(-1)?.trends.UNITS).toBeUndefined();
    gate.UNITS();
    const final = await pending;
    expect(final.trends.UNITS).toEqual({ kind: 'unavailable', reason: 'series timed out' });
    expect(final.trends.NR.kind).toBe('ready');
    // Display-only change: only the failed batch is read again (a failed result is not cached, like a zone).
    await source.loadFigures({ ...filter, units: 'k' }, reference);
    expect(trendLoader).toHaveBeenCalledTimes(3);
    expect(trendLoader.mock.calls[2][3].map((m) => m.code)).toEqual(['UNITS']);
    // A query-relevant change reads both batches again.
    await source.loadFigures({ ...filter, month: 6 }, reference);
    expect(trendLoader).toHaveBeenCalledTimes(5);
  });

  it('modelTrendLoader surfaces a failed Q7 as an error (the data source turns it into the batch’s reason)', async () => {
    const failing: ModelQueryRunner = { executeQuery: async () => ({ status: 'error', error: { category: 'api', message: 'Row limit of 200 exceeded' }, requestId: 'req-e' }) };
    await expect(modelTrendLoader(failing, filter, reference, META)).rejects.toThrow(/Row limit/);
  });

  it('trendQueryKey follows the KPI zone’s filters plus the batch codes', () => {
    expect(trendQueryKey(['NR'], filter)).toBe(trendQueryKey(['NR'], { ...filter, units: 'k', analysisCompare: 'PY' }));
    expect(trendQueryKey(['NR'], filter)).not.toBe(trendQueryKey(['NR', 'GM_PCT'], filter));
    expect(trendQueryKey(['NR'], filter)).not.toBe(trendQueryKey(['NR'], { ...filter, compareA: 'LE' }));
  });
});

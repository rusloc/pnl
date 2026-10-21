// The app data source in ADR-0006 phase 1: the statement comes from the model and
// is flagged live; every other zone stays sample; any failure on the model path
// falls back to the sample statement with the reason, never to a blank view.
import { describe, expect, it, vi } from 'vitest';

import type { AppClient } from '@/lib/rayfin-client';

import { defaultFilters } from '../model/filters';
import type { StatementRow } from '../model/types';
import { createAppDataSource } from './data-source';
import { sampleReference } from './sample-reference';
import { sampleFigures } from './sample-source';

const reference = sampleReference();
const filter = defaultFilters(reference);
const fakeClient = {} as AppClient;

const liveRow: StatementRow = {
  code: 'NR',
  parent: null,
  kind: 'key',
  label: 'Net revenue',
  alias: '',
  tags: [],
  values: { base: 1, pctNr: 100, cmpA: 1, dA: 0, dApct: 0, cmpB: null, dB: null, dBpct: null, fyBud: null, fyLe: null, fyD: null },
  barFraction: 0,
  neutralDelta: false,
};

describe('createAppDataSource().loadFigures', () => {
  it('swaps in the live statement, keeps the other zones sample and flags both', async () => {
    const loadStatement = vi.fn(async () => ({ rows: [liveRow], requestId: 'req-1' }));
    const source = createAppDataSource({ getClient: async () => fakeClient, loadStatement });
    const figures = await source.loadFigures(filter, reference);
    expect(figures.statement).toEqual([liveRow]);
    expect(figures.liveStatement).toEqual({ source: 'semantic model', requestId: 'req-1' });
    expect(figures.liveFallbackReason).toBeUndefined();
    expect(figures.sample).toBe(true);
    expect(figures.financial).toEqual(sampleFigures(filter).financial);
    expect(loadStatement).toHaveBeenCalledWith(fakeClient, filter, reference);
  });

  it('falls back to the sample statement with the reason when the model read fails', async () => {
    const source = createAppDataSource({
      getClient: async () => fakeClient,
      loadStatement: async () => {
        throw new Error('Row limit of 1000 exceeded');
      },
    });
    const figures = await source.loadFigures(filter, reference);
    expect(figures.statement).toEqual(sampleFigures(filter).statement);
    expect(figures.liveStatement).toBeUndefined();
    expect(figures.liveFallbackReason).toBe('Row limit of 1000 exceeded');
    expect(figures.sample).toBe(true);
  });

  it('falls back the same way when there is no client at all (rayfin dev, offline)', async () => {
    const source = createAppDataSource({
      getClient: async () => {
        throw new Error('Missing required Rayfin configuration: apiUrl');
      },
      loadStatement: vi.fn(),
    });
    const figures = await source.loadFigures(filter, reference);
    expect(figures.liveStatement).toBeUndefined();
    expect(figures.liveFallbackReason).toMatch(/Missing required Rayfin configuration/);
    const ref = await source.loadReference();
    expect(ref.reference.source).toBe('sample');
    expect(ref.fallbackReason).toMatch(/Missing required Rayfin configuration/);
  });
});

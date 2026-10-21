// The app's `PnlDataSource`: reference data (dims) from lh_raw through the
// lhraw connector, with the sample reference as an offline fallback; the P&L
// statement from the Track B semantic model through the pnlModel connector
// (ADR-0006 phase 1), falling back to the sample rows with a reason; every
// other zone still from the sample source. The views never know which one is
// behind the interface.
import { PNL_MODEL_ROW_LIMIT } from '@/lib/connectors';
import { type AppClient, getRayfinClient } from '@/lib/rayfin-client';

import type { FilterState, Figures, PnlDataSource, ReferenceData, ReferenceLoadResult } from '../model/types';
import { loadLhrawReference } from './lhraw-reference';
import { type LiveStatementResult, loadModelStatement } from './pnl-model-statement';
import { sampleReference } from './sample-reference';
import { loadSampleFigures } from './sample-source';

export interface AppDataSourceDeps {
  getClient: () => Promise<AppClient>;
  loadStatement: (client: AppClient, filter: FilterState, reference: ReferenceData) => Promise<LiveStatementResult>;
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createAppDataSource(deps: AppDataSourceDeps): PnlDataSource {
  return {
    async loadReference(): Promise<ReferenceLoadResult> {
      try {
        const client = await deps.getClient();
        return { reference: await loadLhrawReference(client) };
      } catch (err) {
        return { reference: sampleReference(), fallbackReason: reason(err) };
      }
    },
    async loadFigures(filter: FilterState, reference: ReferenceData): Promise<Figures> {
      const figures = await loadSampleFigures(filter, reference);
      try {
        const client = await deps.getClient();
        const { rows, requestId } = await deps.loadStatement(client, filter, reference);
        return { ...figures, statement: rows, liveStatement: { source: 'semantic model', requestId } };
      } catch (err) {
        return { ...figures, liveFallbackReason: reason(err) };
      }
    },
  };
}

export const appDataSource: PnlDataSource = createAppDataSource({
  getClient: getRayfinClient,
  loadStatement: (client, filter, reference) =>
    loadModelStatement(client.connectors.pnlModel, filter, reference, PNL_MODEL_ROW_LIMIT),
});

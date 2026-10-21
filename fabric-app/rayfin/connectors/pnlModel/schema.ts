// Connector: pnlModel (fabric-semanticmodel) → semantic model "ACME Unified PnL"
// (Track B, workspace RAW). ADR-0006 phase 1. Category B (function bridge):
// no entities, no metadata.json; the only operation is `executeQuery` (DAX),
// run on behalf of the signed-in user. The workspace/item ids live in
// rayfin/rayfin.yml (`${PNL_MODEL_*}` from rayfin/.env) and never reach the bundle.
import type { FabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

export type PnlModelSchema = FabricSemanticModel<'executeQuery'>;

export const connectorConfig = {
  connector: 'fabric-semanticmodel',
} as const satisfies ConnectorConfig;

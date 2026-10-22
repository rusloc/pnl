// Connector: lhraw (fabric-sqlanalytics) → Lakehouse lh_raw, schema acme_pl.
// Aggregate schema: one import + export + TSchema key per generated entity.
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

import { DimAccount } from './DimAccount.js';
import { DimChannel } from './DimChannel.js';
import { DimEntity } from './DimEntity.js';
import { DimLine } from './DimLine.js';
import { DimMonth } from './DimMonth.js';
import { DimRegion } from './DimRegion.js';
import { DimReportLine } from './DimReportLine.js';
import { DimSegment } from './DimSegment.js';
import { DimVersion } from './DimVersion.js';

export { DimAccount } from './DimAccount.js';
export { DimChannel } from './DimChannel.js';
export { DimEntity } from './DimEntity.js';
export { DimLine } from './DimLine.js';
export { DimMonth } from './DimMonth.js';
export { DimRegion } from './DimRegion.js';
export { DimReportLine } from './DimReportLine.js';
export { DimSegment } from './DimSegment.js';
export { DimVersion } from './DimVersion.js';

// Dimensions only: the facts are read through the semantic model (ADR-0006).
const entities = {
  DimAccount,
  DimChannel,
  DimEntity,
  DimLine,
  DimMonth,
  DimRegion,
  DimReportLine,
  DimSegment,
  DimVersion,
};

// `as const satisfies` keeps the connector and operations literals; `operations`
// mirrors the `operations:` ceiling in rayfin/rayfin.yml (read-only endpoint).
export const connectorConfig = {
  connector: 'fabric-sqlanalytics',
  operations: ['read'],
  entities,
} as const satisfies ConnectorConfig;

export type LhrawSchema = GraphQLBackedConnector<
  typeof entities,
  typeof connectorConfig
>;

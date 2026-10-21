// #region rayfin:app-owned — copied verbatim by the Rayfin CLI; edit freely.
//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type {
  ConnectorConfig,
  ConnectorsRuntime,
} from '@microsoft/rayfin-connectors';
// #endregion rayfin:app-owned

// App-owned wiring (the CLI's generated marker was removed on purpose; the CLI
// now prints wiring instructions instead of rewriting this file).
// The connector key `lhraw` must match `connectors[].name` in rayfin/rayfin.yml.
import { fabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import {
  connectorConfig as lhrawConfig,
  type LhrawSchema,
} from '../../../../rayfin/connectors/lhraw/schema';
import {
  connectorConfig as pnlModelConfig,
  type PnlModelSchema,
} from '../../../../rayfin/connectors/pnlModel/schema';

export type AppConnectorsSchema = { lhraw: LhrawSchema; pnlModel: PnlModelSchema };

export const connectorConfigs: Record<
  keyof AppConnectorsSchema,
  ConnectorConfig
> = { lhraw: lhrawConfig, pnlModel: pnlModelConfig };

/** Rows any one DAX query may return; the statement needs ≈ 110 (ADR-0006 §3.8). */
export const PNL_MODEL_ROW_LIMIT = 1000;

// Category A (GraphQL entity) connectors take no runtime; the semantic-model
// runtime decodes the Arrow response and applies the row cap to every query.
export const connectorRuntimes: ConnectorsRuntime = {
  pnlModel: fabricSemanticModel({ resultSetRowCountLimit: PNL_MODEL_ROW_LIMIT }),
};

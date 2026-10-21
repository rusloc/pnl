# pipeline-content.json: authoring Fabric pipelines as code

The decoded body of the `pipeline-content.json` definition part. Official reference: Microsoft Learn "DataPipeline definition" (`/rest/api/fabric/articles/item-management/definitions/datapipeline-definition`). There is no published JSON Schema file; that page's property tables plus ADF's "Pipelines and activities" doc are the de-facto schema. The Fabric UI shows the same JSON under **View → View JSON code**; when a field below is marked *verify*, copy the exact shape from there.

## Contents
1. [Envelope](#1-envelope)
2. [Activity envelope: dependsOn, policy, state](#2-activity-envelope)
3. [Fabric vs ADF/Synapse: what changed](#3-fabric-vs-adfsynapse)
4. [Binding data stores: externalReferences vs linkedService](#4-binding-data-stores)
5. [Activity catalog with examples](#5-activity-catalog)
6. [Parameters, variables, expressions, system variables](#6-parameters-variables-expressions)
7. [Variable Library references](#7-variable-library-references)
8. [Limits](#8-limits)
9. [Converting a UI "Export template" zip](#9-converting-a-ui-export)

---

## 1. Envelope

```json
{
  "properties": {
    "description": "optional",
    "activities": [ ... ],
    "parameters": { "<name>": { "type": "string|int|float|bool|array|object|secureString", "defaultValue": ... } },
    "variables":  { "<name>": { "type": "String|Boolean|Array|Integer", "defaultValue": ... } },
    "libraryVariables": { "<alias>": { "type": "String", "variableName": "...", "libraryName": "..." } },
    "annotations": []
  }
}
```
`getDefinition` also returns `lastModifiedByObjectId` and `lastPublishTime`; drop them before re-sending. An older Learn sample puts `"name"` beside `"properties"`; it is tolerated but not emitted. Max 120 activities (including nested) and 50 parameters per pipeline.

---

## 2. Activity envelope

```json
{
  "name": "Copy Data",                      // unique in the pipeline; keep to letters/digits/space/_ ; ≤55 chars
  "description": "optional",
  "type": "Copy",
  "state": "Active",                        // or "Inactive" (+ "onInactiveMarkAs": "Succeeded"|"Failed"|"Skipped")
  "dependsOn": [ { "activity": "Lookup Config", "dependencyConditions": ["Succeeded"] } ],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureInput": false, "secureOutput": false },
  "userProperties": [],
  "typeProperties": { ... },
  "externalReferences": { "connection": "<connection GUID>" }   // only where the activity binds a connection at activity level
}
```
- `dependsOn` conditions: `Succeeded`, `Failed`, `Skipped`, `Completed`. Several conditions in one entry are OR'ed; several entries are AND'ed. Root activities use `[]`.
- `policy.timeout` is `D.HH:MM:SS`; the UI writes `0.12:00:00`; the hard cap on an activity run is 24 h. `retry` 0–n, `retryIntervalInSeconds` 30–86400.
- Control-flow activities (ForEach, IfCondition, Switch, Until, Filter, Fail, Wait, AppendVariable) take **no** `policy`; SetVariable takes only `secureInput`/`secureOutput`.
- `state: "Inactive"` deactivates an activity (excluded from validation, shown as Inactive in monitoring); `onInactiveMarkAs` decides which dependency branch fires.

---

## 3. Fabric vs ADF/Synapse

| ADF / Synapse | Fabric |
|---|---|
| `linkedServiceName` + Linked Service items | `externalReferences: {"connection": "<guid>"}` for external stores; inline `linkedService` block for Fabric items (Lakehouse, Warehouse, KQL DB) |
| `inputs/outputs` + Dataset items | `datasetSettings` embedded in `source`/`sink`/Lookup/GetMetadata/Delete |
| Trigger resources | None in JSON. Schedules = Job Scheduler API / `.schedules` part; events = Activator (Reflex) items |
| `connectVia` integration runtime | Absent; gateways live on the connection |
| `ExecutePipeline` with `PipelineReference` | `InvokePipeline` with `pipelineId` + `workspaceId` + connection (legacy `ExecutePipeline` still accepted, same workspace only) |
| `SynapseNotebook` | `TridentNotebook` |
| `ExecuteDataFlow` / mapping data flows | `RefreshDataflow` (Dataflow Gen2); no mapping data flows |
| Web `url` + `authentication` | `relativeUrl` + connection (base URL and auth live in the connection) |
| `@pipeline().DataFactory` = factory name | = **workspace ID**; `@pipeline().Pipeline` = pipeline ID; `@pipeline().PipelineName` added |
| Publish step | Save only |
Fabric-only: `PBISemanticModelRefresh`, `InvokeCopyJob`, `Office365Outlook`, `Teams`, `libraryVariables`, `dataflowType`.

---

## 4. Binding data stores

**External store / service** (SQL, Blob, REST, Databricks, Power BI, another pipeline…):
```json
"externalReferences": { "connection": "c517e095-ed87-4665-95fa-8cdb1e751fba" }
```
Placed on the activity for Web, WebHook, AzureFunction, InvokePipeline, PBISemanticModelRefresh, Script, SqlServerStoredProcedure, KustoQueryLanguage, Teams/Outlook, DatabricksNotebook, InvokeCopyJob; placed **inside `datasetSettings`** for Copy source/sink, Lookup, GetMetadata, Delete. The GUID comes from Settings → Manage connections and gateways → connection → Connection ID, from `GET /v1/connections`, or from the `201` of `POST /v1/connections`. It can be dynamic: `"connection": { "value": "@pipeline().parameters.ConnId", "type": "Expression" }`.

**Fabric item** (Lakehouse / Warehouse / KQL database) — inline `linkedService` inside `datasetSettings` (Copy/Lookup/GetMetadata/Delete) or at activity level (Script/StoredProcedure/KQL):
```json
"linkedService": {
  "name": "bronze_lh",
  "properties": {
    "annotations": [],
    "type": "Lakehouse",                                   // "DataWarehouse" | "KustoDatabase"
    "typeProperties": {
      "workspaceId": "00000000-0000-0000-0000-000000000000",   // all-zero GUID = "this workspace" (Git/CI-CD friendly)
      "artifactId": "<lakehouse item id, or its logicalId>",
      "rootFolder": "Tables"                                 // Lakehouse only: "Tables" | "Files"
      // Warehouse / KQL add: "endpoint": "<guid>.datawarehouse.fabric.microsoft.com" / "https://<cluster>.kusto.fabric.microsoft.com"
    }
  }
}
```
The all-zero `workspaceId` plus the item's `logicalId` as `artifactId` lets Fabric rebind automatically on Git "Update from workspace/Git" and lets fabric-cicd replace it with the target workspace id at deploy time. Newer UI output may spell this block `connectionSettings` instead of `linkedService`; author with `linkedService` (what every Microsoft sample emits) and accept either when reading.

---

## 5. Activity catalog

All examples are complete `activities[]` entries. GUIDs are placeholders. `policy` shown once per shape; it is identical elsewhere.

### Copy — external SQL table → Lakehouse table
```json
{
  "name": "Copy DIM_Calendar", "type": "Copy", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": {
    "source": {
      "type": "AzureSqlSource", "queryTimeout": "02:00:00", "partitionOption": "None",
      "datasetSettings": {
        "annotations": [], "type": "AzureSqlTable", "schema": [],
        "typeProperties": { "schema": "dbo", "table": "DIM_Calendar", "database": "unified" },
        "externalReferences": { "connection": "c517e095-ed87-4665-95fa-8cdb1e751fba" }
      }
    },
    "sink": {
      "type": "LakehouseTableSink", "tableActionOption": "Append",
      "datasetSettings": {
        "annotations": [],
        "linkedService": { "name": "bronze_lh", "properties": { "annotations": [], "type": "Lakehouse",
          "typeProperties": { "workspaceId": "00000000-0000-0000-0000-000000000000", "artifactId": "<lakehouse-id>", "rootFolder": "Tables" } } },
        "type": "LakehouseTable", "schema": [],
        "typeProperties": { "schema": "dbo", "table": "DIM_Calendar" }
      }
    },
    "enableStaging": false,
    "translator": { "type": "TabularTranslator", "typeConversion": true,
                    "typeConversionSettings": { "allowDataTruncation": true, "treatBooleanAsNumber": false } }
  }
}
```
- Source variants: `AzureSqlSource` / `SqlServerSource` with `sqlReaderQuery` or `sqlReaderStoredProcedureName`+`storedProcedureParameters`; `AzurePostgreSqlSource` with `query`; `LakehouseTableSource` (optional `timestampAsOf`, `versionAsOf`, `sqlReaderQuery`); `DataWarehouseSource`; `BinarySource`/`DelimitedTextSource`/`ParquetSource`/`JsonSource` with `storeSettings` (`AzureBlobStorageReadSettings`, `AzureBlobFSReadSettings`, `LakehouseReadSettings`, `recursive`, `wildcardFileName`) and `formatSettings`.
- Lakehouse table sink options: `tableActionOption` `Append` | `OverwriteSchema` | `Upsert` (+`keyColumns`), `partitionOption` `None` | `PartitionByKey` (+`partitionNameList`), `applyVOrder`. Lakehouse-with-schemas tables need both `schema` and `table`.
- Warehouse sink: `type: "DataWarehouseSink"`, `tableOption: "autoCreate"`, `writeBehavior: "Insert"|"Upsert"` (+`upsertSettings.keys`), `preCopyScript`, `allowCopyCommand`; dataset `type: "DataWarehouseTable"`, linkedService `type: "DataWarehouse"` with `endpoint` + `artifactId` + `workspaceId`. (*verify* exact `DataWarehouse*` spelling via View JSON.) Warehouse sinks often need `"enableStaging": true, "stagingSettings": { "externalReferences": { "connection": "<blob/adls connection>" }, "path": "staging" }`.
- Explicit column mapping: `"translator": { "type": "TabularTranslator", "mappings": [ { "source": { "name": "CustomerID", "type": "Int32" }, "sink": { "name": "customer_id", "type": "Int32" } } ] }`.
- Files sink (CSV into Lakehouse Files):
```json
"sink": { "type": "DelimitedTextSink", "storeSettings": { "type": "LakehouseWriteSettings" },
  "formatSettings": { "type": "DelimitedTextWriteSettings", "quoteAllText": true, "fileExtension": ".csv" },
  "datasetSettings": { "annotations": [],
    "linkedService": { "name": "bronze_lh", "properties": { "annotations": [], "type": "Lakehouse",
      "typeProperties": { "workspaceId": "00000000-0000-0000-0000-000000000000", "artifactId": "<lakehouse-id>", "rootFolder": "Files" } } },
    "type": "DelimitedText",
    "typeProperties": { "location": { "type": "LakehouseLocation",
        "folderPath": { "value": "@concat('raw/', item().table)", "type": "Expression" },
        "fileName":   { "value": "@concat(item().table, '.csv')", "type": "Expression" } },
      "columnDelimiter": ",", "escapeChar": "\\", "firstRowAsHeader": true, "quoteChar": "\"" },
    "schema": [] } }
```
- Other `CopyActivityTypeProperties`: `parallelCopies`, `dataIntegrationUnits`, `enableSkipIncompatibleRow`, `redirectIncompatibleRowSettings`, `logSettings`, `validateDataConsistency`, `preserve[]`.

### Notebook — `TridentNotebook`
```json
{
  "name": "Run Transform", "type": "TridentNotebook", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 1, "retryIntervalInSeconds": 60, "secureOutput": false, "secureInput": false },
  "typeProperties": {
    "notebookId": "<notebook item id>",
    "workspaceId": "00000000-0000-0000-0000-000000000000",
    "parameters": {
      "run_date": { "value": { "value": "@pipeline().parameters.RunDate", "type": "Expression" }, "type": "string" },
      "full_load": { "value": "true", "type": "bool" }
    },
    "sessionTag": "etl"
  }
}
```
Notebook parameters support `string|int|float|bool` only (pass JSON as a string and `json.loads` it in the notebook). `sessionTag` needs the workspace's high-concurrency-for-pipelines setting. The UI may also write a `configuration` block (default lakehouse, environment); copy from View JSON (*verify*). Notebook output: `@activity('Run Transform').output.result.exitValue`.

### Dataflow Gen2 — `RefreshDataflow`
```json
{
  "name": "Refresh Staging DF", "type": "RefreshDataflow", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": {
    "dataflowId": "<dataflow item id>", "workspaceId": "<workspace id>",
    "notifyOption": "NoNotification",
    "dataflowType": "DataflowFabric",
    "parameters": { "Region": { "value": "EU", "type": "String" } }
  }
}
```
`dataflowType: "DataflowFabric"` is required for Dataflow Gen2 (CI/CD) items; without it the run uses the legacy engine and fails. The enumeration spells the type `RefreshDataFlow`; exports contain `RefreshDataflow` — use the export spelling. Dataflow references are **not** remapped by Git/deployment pipelines; parameterize `dataflowId`/`workspaceId` (fabric-cicd `key_value_replace`) or use library variables.

### Lookup
```json
{
  "name": "Lookup Config", "type": "Lookup", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": {
    "source": { "type": "SqlServerSource", "sqlReaderQuery": "SELECT * FROM etl.control WHERE enabled = 1", "queryTimeout": "02:00:00", "partitionOption": "None" },
    "firstRowOnly": false,
    "datasetSettings": { "annotations": [], "type": "SqlServerTable", "schema": [], "typeProperties": { "database": "metadatadb" },
                         "externalReferences": { "connection": "<sql-connection-guid>" } }
  }
}
```
Lakehouse-table Lookup: `source: { "type": "LakehouseTableSource" }` + `datasetSettings` with `linkedService` and `type: "LakehouseTable"`, `typeProperties: { "table": "control" }`. Output: `@activity('Lookup Config').output.value` (array, ≤ 5,000 rows) or `.output.firstRow.<col>` when `firstRowOnly: true`.

### ForEach / If / Switch / Until / Filter (control flow, no `policy`)
```json
{
  "name": "For Each Table", "type": "ForEach",
  "dependsOn": [ { "activity": "Lookup Config", "dependencyConditions": ["Succeeded"] } ],
  "typeProperties": {
    "items": { "value": "@activity('Lookup Config').output.value", "type": "Expression" },
    "isSequential": false, "batchCount": 20,
    "activities": [ /* child activities referencing @item().column; dependsOn only among siblings */ ]
  }
}
```
```json
{ "name": "If Full Load", "type": "IfCondition", "dependsOn": [],
  "typeProperties": { "expression": { "value": "@pipeline().parameters.FullLoad", "type": "Expression" },
                      "ifTrueActivities": [ ... ], "ifFalseActivities": [ ... ] } }
```
```json
{ "name": "Route", "type": "Switch", "dependsOn": [],
  "typeProperties": { "on": { "value": "@toLower(pipeline().parameters.Mode)", "type": "Expression" },
                      "cases": [ { "value": "full", "activities": [ ... ] }, { "value": "delta", "activities": [ ... ] } ],
                      "defaultActivities": [ { "name": "Fail Unknown", "type": "Fail", "dependsOn": [],
                                               "typeProperties": { "message": "Unknown Mode", "errorCode": "400" } } ] } }
```
```json
{ "name": "Poll Until Done", "type": "Until", "dependsOn": [],
  "typeProperties": { "expression": { "value": "@equals(activity('Check').output.status, 'Succeeded')", "type": "Expression" },
                      "timeout": "0.01:00:00", "activities": [ ... ] } }
```
```json
{ "name": "Only Files", "type": "Filter", "dependsOn": [ { "activity": "Get Metadata1", "dependencyConditions": ["Succeeded"] } ],
  "typeProperties": { "items": { "value": "@activity('Get Metadata1').output.childItems", "type": "Expression" },
                      "condition": { "value": "@equals(item().type, 'File')", "type": "Expression" } } }
```
ForEach cannot nest ForEach/Until (invoke a child pipeline instead); `batchCount` max 50; variables are pipeline-global, so SetVariable inside a parallel ForEach is a race.

### Set Variable / Append Variable / pipeline return value
```json
{ "name": "Set Status", "type": "SetVariable", "dependsOn": [], "policy": { "secureOutput": false, "secureInput": false },
  "typeProperties": { "variableName": "status", "value": { "value": "@activity('Copy DIM_Calendar').output.executionDetails[0].status", "type": "Expression" } } }
```
```json
{ "name": "Append Failed", "type": "AppendVariable", "dependsOn": [ { "activity": "Copy DIM_Calendar", "dependencyConditions": ["Failed"] } ],
  "typeProperties": { "variableName": "failedTables", "value": { "value": "@item().table", "type": "Expression" } } }
```
```json
{ "name": "Set Return Value", "type": "SetVariable", "dependsOn": [], "policy": { "secureOutput": false, "secureInput": false },
  "typeProperties": { "variableName": "pipelineReturnValue", "setSystemVariable": true,
    "value": [ { "key": "rowsCopied", "value": { "type": "Expression", "content": "@activity('Copy DIM_Calendar').output.rowsCopied" } },
               { "key": "status",     "value": { "type": "String", "content": "ok" } } ] } }
```
Return-value `type`: `String|Expression|Array|Boolean|Null|Int|Float|Object`. Parent reads `@activity('Invoke child').output.pipelineReturnValue.rowsCopied`.

### Invoke Pipeline (new)
```json
{
  "name": "Invoke Audit", "type": "InvokePipeline",
  "dependsOn": [ { "activity": "Copy DIM_Calendar", "dependencyConditions": ["Completed"] } ],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": {
    "operationType": "InvokeFabricPipeline", "waitOnCompletion": true,
    "workspaceId": "<target workspace id>", "pipelineId": "<target pipeline id>",
    "parameters": { "parent_run_id": { "value": "@pipeline().RunId", "type": "Expression" }, "rows": 0 }
  },
  "externalReferences": { "connection": "<Fabric Data Pipelines connection guid>" }
}
```
The connection (auth: organizational account, service principal, or workspace identity) is required. Legacy `ExecutePipeline` (same workspace, no connection): `"typeProperties": { "pipeline": { "referenceName": "<name>", "type": "PipelineReference" }, "parameters": {...}, "waitOnCompletion": true }`.

### Web / WebHook / Azure Function
```json
{ "name": "Call API", "type": "WebActivity", "dependsOn": [],
  "policy": { "timeout": "0.00:10:00", "retry": 2, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": { "method": "POST", "headers": { "Content-Type": "application/json" },
                      "relativeUrl": { "value": "@concat('/v1/workspaces/', pipeline().DataFactory, '/items')", "type": "Expression" },
                      "body": { "displayName": "x" }, "httpRequestTimeout": "00:01:40" },
  "externalReferences": { "connection": "<web connection guid; base URL + auth live there>" } }
```
WebHook adds `timeout` (default `00:10:00`), `reportStatusOnCallBack`; the service injects `callBackUri` into the body. AzureFunction: `typeProperties: { functionName, method, headers, body }` + function connection. The Fabric user-data-functions flavour uses `functionSetId` + `workspaceId` + `functionName` + `parameters` (*verify* `operationType`).

### Script / Stored procedure / KQL
```json
{ "name": "Run SQL", "type": "Script", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": { "scripts": [ { "type": "Query", "text": { "value": "SELECT COUNT(*) AS n FROM dbo.t WHERE d = @d", "type": "Expression" },
                                      "parameters": [ { "name": "d", "type": "String", "value": { "value": "@pipeline().parameters.RunDate", "type": "Expression" }, "direction": "Input" } ] } ],
                      "scriptBlockExecutionTimeout": "02:00:00", "logSettings": { "logDestination": "ActivityOutput" } },
  "externalReferences": { "connection": "<sql connection guid>" } }
```
Against a Fabric Warehouse replace `externalReferences` with an activity-level `linkedService` (`type: "DataWarehouse"`, `endpoint`/`artifactId`/`workspaceId`) and add `"database": "<warehouse name>"`. Script output: `{"resultSetCount", "recordsAffected", "resultSets": [{"rowCount", "rows": [...]}], "outputParameters": {...}}` → `@activity('Run SQL').output.resultSets[0].rows[0].n`.

```json
{ "name": "Audit", "type": "SqlServerStoredProcedure", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": { "storedProcedureName": "[etl].[log_run]", "database": "metadatadb",
                      "storedProcedureParameters": { "run_id": { "value": { "value": "@pipeline().RunId", "type": "Expression" }, "type": "String" },
                                                     "rows":   { "value": { "value": "@activity('Copy DIM_Calendar').output.rowsCopied", "type": "Expression" }, "type": "Int64" } } },
  "externalReferences": { "connection": "<sql connection guid>" } }
```
KQL: `type: "KustoQueryLanguage"`, `typeProperties: { command, commandTimeout: "00:20:00", database }`, bound via `externalReferences` (ADX) or activity-level `linkedService` `type: "KustoDatabase"` with `endpoint` (query URI) + `artifactId` + `workspaceId`.

### Get Metadata / Delete (Lakehouse Files)
```json
{ "name": "Get Metadata1", "type": "GetMetadata", "dependsOn": [],
  "policy": { "timeout": "0.12:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureOutput": false, "secureInput": false },
  "typeProperties": { "fieldList": ["childItems"],
    "datasetSettings": { "annotations": [],
      "linkedService": { "name": "bronze_lh", "properties": { "annotations": [], "type": "Lakehouse",
        "typeProperties": { "workspaceId": "00000000-0000-0000-0000-000000000000", "artifactId": "<lakehouse-id>", "rootFolder": "Files" } } },
      "type": "Binary", "typeProperties": { "location": { "type": "LakehouseLocation", "folderPath": "raw/2026" } } },
    "storeSettings": { "type": "LakehouseReadSettings", "recursive": true }, "formatSettings": { "type": "BinaryReadSettings" } } }
```
`fieldList` values: `childItems`, `exists`, `itemName`, `itemType`, `size`, `lastModified`, `created`, `columnCount`, `structure`. For a table use `type: "LakehouseTable"` + `rootFolder: "Tables"`. Delete: `type: "Delete"`, same `datasetSettings`, `typeProperties.storeSettings: { "type": "LakehouseReadSettings", "recursive": true, "wildcardFileName": "*.csv" }`, `enableLogging`.

### Wait / Fail
```json
{ "name": "Wait 30s", "type": "Wait", "dependsOn": [], "typeProperties": { "waitTimeInSeconds": 30 } }
```
```json
{ "name": "Fail Empty", "type": "Fail", "dependsOn": [ { "activity": "Lookup Config", "dependencyConditions": ["Succeeded"] } ],
  "typeProperties": { "message": { "value": "@concat('No rows for ', pipeline().parameters.RunDate)", "type": "Expression" }, "errorCode": "404" } }
```

### Semantic model refresh — `PBISemanticModelRefresh`
```json
{ "name": "Refresh Sales Model", "type": "PBISemanticModelRefresh", "dependsOn": [], "userProperties": [],
  "typeProperties": { "method": "POST", "groupId": "<workspace id>", "datasetId": "<semantic model id>", "type": "Full",
                      "commitMode": "transactional", "maxParallelism": 2, "retryCount": 1, "waitOnCompletion": true, "operationType": "RefreshDataset",
                      "objects": [ { "table": "DimDate" }, { "table": "FactSales", "partition": "FactSales-2026" } ] },
  "externalReferences": { "connection": "<Power BI semantic model connection guid>" },
  "policy": { "timeout": "7.00:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureInput": false, "secureOutput": false } }
```
`type`: `Full|Automatic|DataOnly|Calculate|ClearValues|Defragment`; `commitMode`: `transactional|partialBatch`. Not remapped across workspaces by Git/deployment pipelines → parameterize `groupId`/`datasetId`.

### Outlook / Teams
```json
{ "name": "Email Failure", "type": "Office365Outlook", "dependsOn": [ { "activity": "Copy DIM_Calendar", "dependencyConditions": ["Failed"] } ],
  "typeProperties": { "inputs": { "method": "post", "path": "/v2/Mail",
    "body": { "To": "team@contoso.com", "Subject": "Pipeline @{pipeline().PipelineName} failed",
              "Body": "<p>@{activity('Copy DIM_Calendar').Error.message}</p>", "Importance": "High" } } } }
```
Teams: `type: "Teams"`, `inputs.path: "/v1.0/teams/conversation/message/poster/Flow bot/location/Channel"`, `body: { recipient: { groupId, channelId }, messageBody, subject }`, + Teams connection. Both use the signed-in user's OAuth token: after CI/CD deployment someone must open the pipeline and re-authenticate; they are not SPN-runnable.

### Other official types
`InvokeCopyJob` (`copyJobId`, `workspaceId`, + Copy job connection), `SparkJobDefinition` (`sparkJobDefinitionId`, `workspaceId`, `executableFile`, `commandLineArguments`, `defaultLakehouse`, `environmentId`), `DatabricksNotebook` (`notebookPath`, `baseParameters`, `existingClusterId`|`newClusterSettings`, + Databricks connection), `AzureHDInsight`, `Custom` (Azure Batch), `AzureMLExecutePipeline`, `ExecuteSSISPackage`, `DataLakeAnalyticsScope`. Newer UI activities without a published table (Fabric Actions, Business action, Approval, Lakehouse maintenance, Refresh SQL analytics endpoint, Refresh materialized lake view): build once in the UI, copy from View JSON.

---

## 6. Parameters, variables, expressions

```json
"parameters": {
  "RunDate":  { "type": "string", "defaultValue": "2026-01-01" },
  "BatchSize":{ "type": "int",    "defaultValue": 1000 },
  "FullLoad": { "type": "bool",   "defaultValue": false },
  "Tables":   { "type": "array",  "defaultValue": ["a", "b"] },
  "Config":   { "type": "object", "defaultValue": { "k": "v" } },
  "ApiKey":   { "type": "secureString" }
},
"variables": { "status": { "type": "String" }, "failedTables": { "type": "Array" }, "i": { "type": "Integer", "defaultValue": 0 } }
```
Parameter types are case-insensitive (`string`/`String`); variable types are `String|Boolean|Array|Integer`.

Dynamic content is always the object form `{ "value": "@...", "type": "Expression" }`. Inside a literal string use interpolation `"@{pipeline().parameters.x}"`. Escape a literal `@` as `@@`; double single quotes inside strings. Max 8,192 characters per expression.

| Expression | Meaning |
|---|---|
| `@pipeline().parameters.RunDate` / `@variables('status')` / `@item()` | parameter / variable / ForEach item |
| `@activity('Copy').output.rowsCopied`, `.Error.message`, `.ExecutionStartTime`, `.Status`, `.Duration` | activity run properties |
| `@pipeline().DataFactory` | **workspace ID** |
| `@pipeline().Pipeline` / `@pipeline().PipelineName` / `@pipeline().RunId` / `@pipeline().GroupId` | pipeline id / name / run id |
| `@pipeline().TriggerId`, `TriggerName`, `TriggerTime`, `TriggerType` | trigger info (UTC) |
| `@pipeline()?.TriggeredByPipelineName`, `@pipeline()?.TriggeredByPipelineRunId` | parent pipeline (null-safe) |
| `@pipeline()?.TriggerEvent?.FileName`, `?.FolderPath` | file-event trigger fields |
| `@pipeline().libraryVariables.<alias>` | Variable Library value |
Function families (full list: Learn "Expression language" for Fabric pipelines): date (`utcNow`, `addDays`, `formatDateTime`, `convertFromUtc`, `startOfDay`), string (`concat`, `replace`, `split`, `substring`, `toLower`, `guid`), collection (`contains`, `empty`, `first`, `last`, `length`, `join`, `union`), logical (`and`, `or`, `not`, `equals`, `greater`, `if`, `coalesce`), conversion (`string`, `int`, `json`, `array`, `createArray`, `base64`), math (`add`, `sub`, `mul`, `div`, `mod`, `rand`, `range`).

---

## 7. Variable Library references

```json
"libraryVariables": {
  "SourceLH": { "type": "String", "variableName": "SourceLakehouseId", "libraryName": "EnvConfig" }
}
```
Then `@pipeline().libraryVariables.SourceLH` anywhere dynamic content is allowed (references must be static names). Supported library types in pipelines: String, Integer, Boolean, DateTime, Guid (Number is not). Connection-reference and item-reference library variables expose `.connectionId`, `.itemId`, `.workspaceId`. The *active value set* is a workspace-level setting, not part of the pipeline; fabric-cicd activates the set named after the target environment.

---

## 8. Limits

| Resource | Limit |
|---|---|
| Activities per pipeline (incl. nested) | 120 |
| Parameters per pipeline | 50 |
| Schedules per pipeline | 20 |
| ForEach items / `batchCount` | 100,000 / 50 (default 20) |
| Lookup rows | 5,000 |
| Characters per expression | 8,192 |
| Max activity run | 24 h |
| Pipeline object / per-activity payload | 200 KB / 896 KB |
| Web activity response / pipeline return value | 4 MB |
| Pipelines per workspace / concurrent runs per workspace | 1,000 / 10,000 |
| Queued runs per pipeline | 100 |
ForEach cannot nest ForEach or Until; GetMetadata and Script cannot source from KQL databases; Outlook/Teams activities need re-auth after deployment.

---

## 9. Converting a UI export

**Export** from the pipeline UI produces a zip with `<Name>/<Name>.json` in ARM deployment-template form: `resources[0].properties` is exactly the `pipeline-content.json` `properties` object, but every connection GUID and Lakehouse `artifactId` is replaced with `"[parameters('<connection display name>')]"` placeholders, and `lastModifiedByObjectId`/`lastPublishTime` are present. Convert with `scripts/pipeline_json_tools.py from-export <file.json> --map "<placeholder name>=<guid>" ...`, which lifts `resources[0].properties`, substitutes the placeholders, drops the system fields and wraps the result as `{ "properties": ... }`. The Git-synced `pipeline-content.json` (Git integration / `fab export`) is already in the right shape.

# Fabric REST API for Data Pipelines: CRUD, definitions, LRO, errors

Verified against Microsoft Learn on 2026-10-14. Base URL for everything: `https://api.fabric.microsoft.com/v1`.
Header on every call: `Authorization: Bearer <token>` (+ `Content-Type: application/json` when sending a body).

## Contents
1. [Quick reference card](#1-quick-reference-card)
2. [Pipeline item endpoints](#2-pipeline-item-endpoints)
3. [Definition payloads (base64 parts, .platform, .schedules)](#3-definition-payloads)
4. [Long-running operations (202 handling)](#4-long-running-operations)
5. [Errors, throttling, retries](#5-errors-throttling-retries)
6. [Resolving workspaces, folders, items by name](#6-resolving-workspaces-folders-items-by-name)
7. [Connections and gateways API](#7-connections-and-gateways-api)
8. [Limits](#8-limits)

---

## 1. Quick reference card

| Concern | Value |
|---|---|
| Typed collection | `/workspaces/{ws}/dataPipelines` (generic alternative: `/workspaces/{ws}/items` with `"type": "DataPipeline"`) |
| Item type enum | `DataPipeline` (exact casing; the UI just says "Pipeline") |
| Definition parts | `pipeline-content.json` (required), `.platform` (optional), `.schedules` (appears in getDefinition when schedules exist) |
| Payload encoding | `"payloadType": "InlineBase64"`, payload = base64(UTF-8 JSON) |
| Job type (Job Scheduler) | `Pipeline` (case-sensitive) |
| SPN / client-credentials scope | `https://api.fabric.microsoft.com/.default` |
| Delegated scopes (CRUD) | `DataPipeline.ReadWrite.All` or `Item.ReadWrite.All`; list needs `Workspace.Read.All` |
| Delegated scopes (run) | `Item.Execute.All` or `DataPipeline.Execute.All` |
| Workspace role to create/run | Contributor or higher; workspace must be on a Fabric capacity (not Pro/PPU-only) |
| Success codes | 201 (create, sync) / 200 (get, patch, getDefinition, updateDefinition sync) / 202 (async → see LRO) |
| LRO polling | `GET /v1/operations/{operationId}` → when `Succeeded`, `GET /v1/operations/{operationId}/result` |
| Description max | 256 chars |

---

## 2. Pipeline item endpoints

All seven operations support users, service principals and managed identities.

### Create
```http
POST /v1/workspaces/{workspaceId}/dataPipelines
{
  "displayName": "Nightly Load",           // required, unique per workspace+type
  "description": "optional, <=256 chars",
  "folderId": "<folder uuid, optional>",
  "definition": { "parts": [ ... ] }       // optional; omit to create an empty pipeline
}
```
Responses: `201` with the item (`id`, `displayName`, `type: "DataPipeline"`, `workspaceId`, ...), or `202` + LRO headers.
Errors: `ItemDisplayNameAlreadyInUse` (409), `CorruptedPayload` (bad base64/JSON), `WorkspaceItemsLimitExceeded`, `FolderNotFound`.

Generic equivalent: `POST /v1/workspaces/{ws}/items` with the same body plus `"type": "DataPipeline"`. Use `definition` OR `creationPayload`, never both (pipelines have no `creationPayload`).

### Get (metadata only)
```http
GET /v1/workspaces/{workspaceId}/dataPipelines/{pipelineId}
```
Returns the same metadata as the generic Get Item. The pipeline body is NOT here; use getDefinition.

### Update metadata (rename / description)
```http
PATCH /v1/workspaces/{workspaceId}/dataPipelines/{pipelineId}
{ "displayName": "New name", "description": "New description" }
```
Side effect worth knowing: any PATCH performed by a service principal makes that SPN the pipeline's **LastModifiedBy**, which is the identity the pipeline *runs as*. This is the documented way to make an SPN the effective run identity ("Set a service principal as a pipeline owner" tutorial).

### Delete
```http
DELETE /v1/workspaces/{workspaceId}/dataPipelines/{pipelineId}            # soft delete
DELETE /v1/workspaces/{workspaceId}/dataPipelines/{pipelineId}?hardDelete=true   # permanent
```

### List
```http
GET /v1/workspaces/{workspaceId}/dataPipelines?recursive=true&rootFolderId=<uuid>&continuationToken=<token>
```
Viewer role suffices. Paginated: follow `continuationUri` / `continuationToken` until absent. Generic: `GET /items?type=DataPipeline`.

### Get definition (it is a POST)
```http
POST /v1/workspaces/{workspaceId}/dataPipelines/{pipelineId}/getDefinition
```
Empty body (`{}` is fine). Requires read **and write** permission. Returns `200 {"definition": {"parts": [...]}}` or `202` (LRO). Decode each part's `payload` from base64.

### Update definition (full replacement)
```http
POST /v1/workspaces/{workspaceId}/dataPipelines/{pipelineId}/updateDefinition?updateMetadata=true
{ "definition": { "parts": [ { "path": "pipeline-content.json", "payload": "<b64>", "payloadType": "InlineBase64" } ] } }
```
"Overrides" means replace, not merge: always send the complete `pipeline-content.json`. `.platform` and `.schedules` parts are optional. `?updateMetadata=true` is only needed when you include `.platform` and want its `displayName`/`description` applied. `200` empty body on success, or `202` (LRO).

Read-modify-write pattern: `getDefinition` → base64-decode `pipeline-content.json` → edit the dict → base64-encode → `updateDefinition` with just that part.

---

## 3. Definition payloads

### The parts array
```json
{
  "definition": {
    "parts": [
      { "path": "pipeline-content.json", "payload": "<base64 JSON>", "payloadType": "InlineBase64" },
      { "path": ".platform",             "payload": "<base64 JSON>", "payloadType": "InlineBase64" }
    ]
  }
}
```
Encoding in Python: `base64.b64encode(json.dumps(obj).encode("utf-8")).decode("ascii")`. Decoding: `json.loads(base64.b64decode(payload))`.
Shell: `base64 -w 0 pipeline-content.json` (GNU) / `base64 -i file | tr -d '\n'` (macOS).

### pipeline-content.json (minimal)
```json
{
  "properties": {
    "description": "optional",
    "activities": [
      { "name": "Wait1", "type": "Wait", "dependsOn": [], "typeProperties": { "waitTimeInSeconds": 10 } }
    ],
    "parameters": { "RunDate": { "type": "string", "defaultValue": "2026-01-01" } },
    "variables":  { "status":  { "type": "String" } }
  }
}
```
Full schema and every activity type: see `pipeline-json.md`. Fields like `lastModifiedByObjectId` / `lastPublishTime` come back from getDefinition; strip them before re-sending (harmless but noisy).

### .platform (v2 format)
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
  "metadata": { "type": "DataPipeline", "displayName": "Nightly Load", "description": "optional" },
  "config":   { "version": "2.0", "logicalId": "<stable GUID>" }
}
```
- `metadata.type` is case-sensitive.
- `logicalId` is the cross-workspace identity used by Git integration and deployment pipelines. Keep it stable; generate a fresh one only when cloning a pipeline into a new item.
- On create the platform file is honored if provided; on getDefinition it is always returned; on updateDefinition it is applied only with `?updateMetadata=true`.
- Official REST samples use the placeholder `ZG90UGxhdGZvcm1CYXNlNjRTdHJpbmc=` (= "dotPlatformBase64String"); that is not a real platform file.

### .schedules (returned by getDefinition when schedules exist; also the Git format)
```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/schedules/1.0.0/schema.json",
  "schedules": [
    { "enabled": true, "jobType": "Pipeline",
      "configuration": { "type": "Cron", "startDateTime": "2026-01-01T00:00:00", "endDateTime": "2099-01-01T00:00:00",
                         "localTimeZoneId": "UTC", "interval": 15 } }
  ]
}
```
Managing schedules through the Job Scheduler API (see `jobs-and-schedules.md`) is simpler than editing this part.

---

## 4. Long-running operations

Any create/getDefinition/updateDefinition may answer `202 Accepted` with an empty body and three headers:

```
Location: https://api.fabric.microsoft.com/v1/operations/<operationId>
x-ms-operation-id: <operationId>
Retry-After: 30
```

Flow:
1. Sleep `Retry-After` seconds (don't poll faster; LRO polling has its own 500 calls/min quota).
2. `GET /v1/operations/{operationId}` → `{ "status": "NotStarted"|"Running"|"Succeeded"|"Failed", "percentComplete": n, "error": {...} }`. The 200 response also carries `Retry-After` for the next poll.
3. While `NotStarted`/`Running`: sleep and repeat.
4. `Failed`: read `error.errorCode`, `error.message`, `error.requestId`.
5. `Succeeded`: `GET /v1/operations/{operationId}/result` returns the created item (for create) or `{"definition": {...}}` (for getDefinition). updateDefinition has no result body; skip the result call.

Build the polling URL from `x-ms-operation-id` rather than trusting `Location` verbatim: one Learn sample omits `/v1/`, and some item types' Location points at a Power BI cluster URL that needs a different token audience. Pipelines poll on `api.fabric.microsoft.com`.

Edge cases seen in Microsoft's own tutorials: 200 with `status: "Running"` (keep polling), 200 `Succeeded` with no `id` (list by displayName and match; new items can lag in list results for a few seconds).

Python helper (what `scripts/fabric_pipelines.py` implements):
```python
def follow_lro(session, resp):
    if resp.status_code in (200, 201):
        return resp.json() if resp.content else None
    op_id = resp.headers.get("x-ms-operation-id")
    url = f"https://api.fabric.microsoft.com/v1/operations/{op_id}"
    delay = int(resp.headers.get("Retry-After", "5"))
    while True:
        time.sleep(delay)
        poll = session.get(url)
        delay = int(poll.headers.get("Retry-After", str(delay)))
        body = poll.json() if poll.content else {}
        status = body.get("status")
        if status in ("NotStarted", "Running"):
            continue
        if status == "Failed":
            raise RuntimeError(body.get("error"))
        result = session.get(url + "/result")
        return result.json() if result.content else None
```

---

## 5. Errors, throttling, retries

### Error body (every endpoint)
```json
{ "errorCode": "ItemDisplayNameAlreadyInUse", "message": "...", "requestId": "<uuid>",
  "isRetriable": false, "moreDetails": [ { "errorCode": "...", "message": "..." } ],
  "relatedResource": { "resourceId": "...", "resourceType": "..." } }
```
`errorCode` is a stable contract; `message` text is not. Always log `requestId` (also in the response headers) when asking Microsoft for help.

### Codes you will actually hit
| HTTP | errorCode | What to do |
|---|---|---|
| 401 | `TokenExpired` | Re-acquire token (tokens last ~1 h). |
| 401 | `InsufficientScopes` | Delegated token lacks the scope; for SPN use `/.default`. |
| 403 | `InsufficientPrivileges` | Identity is not Contributor+ on the workspace, or the tenant setting "Service principals can use Fabric APIs" is off / doesn't include this SPN's security group. |
| 404 | `WorkspaceNotFound`, `ItemNotFound`, `EntityNotFound`, `FolderNotFound` | Wrong GUID; `relatedResource` names the missing thing. |
| 409 | `ItemDisplayNameAlreadyInUse` | Idempotent path: list, match `displayName`, call updateDefinition instead. |
| 400 | `CorruptedPayload` | Payload is not valid base64, not valid JSON, or violates the definition schema. Decode and validate locally first (`scripts/pipeline_json_tools.py validate`). |
| 400 | `InvalidItemType`, `InvalidRequest`, `OperationNotSupportedForItem` | Check type string / body / endpoint. |
| 400 | `WorkspaceItemsLimitExceeded` | 1,000 items per workspace. |
| 429 | `RequestBlocked` | Per-identity rate limit. Sleep exactly `Retry-After` seconds, then retry. |
| 429 | `CapacityLimitExceeded` | Capacity CU throttling. No `Retry-After`; bounded exponential backoff with jitter, don't hammer. |
| Jobs | `InvalidJobType`, `TooManyRequestsForJobs`, `JobAlreadyCompleted`, `ScheduleExceedsLimit`, `FeatureNotAvailable` | See `jobs-and-schedules.md`. |

### Quotas (per user or per service principal, fixed 60-second windows, refilled all at once)
| Bucket | Limit |
|---|---|
| Platform APIs (items, workspaces, definitions) | 500 calls/min |
| Job Scheduler APIs (run, get job, schedules) | 200 calls/min (plus 100 job submissions + 100 get-job per user per minute) |
| LRO polling | 500 calls/min |
| Create Item API specifically | 200 calls/min |
Both the bucket and any endpoint-specific limit are evaluated; most restrictive wins. Spread calls across the minute, prefer list endpoints over N single gets, cache workspace/item ids.

---

## 6. Resolving workspaces, folders, items by name

There is **no server-side name filter** on list endpoints. Page and match `displayName` client-side.

```http
GET /v1/workspaces?roles=Admin,Member,Contributor      # optional role filter; paginated
GET /v1/workspaces/{workspaceId}                        # capacityId, capacityAssignmentProgress, workspaceIdentity
GET /v1/workspaces/{workspaceId}/folders?recursive=true  # Preview; Folder: id, displayName, parentFolderId
GET /v1/workspaces/{workspaceId}/items?type=DataPipeline
```
Preflight before creating: the workspace must have a `capacityId` (Fabric capacity) and `capacityAssignmentProgress == "Completed"`. Skip `type == "Personal"` workspaces unless intended. Workspace display names are not guaranteed unique tenant-wide; match exactly and fail loudly on duplicates.

Pagination contract: responses carry `continuationToken` + `continuationUri`; when they are absent/null you have everything. Either GET `continuationUri` or append `?continuationToken=...`.

Add an SPN to a workspace programmatically:
```http
POST /v1/workspaces/{workspaceId}/roleAssignments
{ "principal": { "id": "<SPN object id>", "type": "ServicePrincipal" }, "role": "Contributor" }
```

---

## 7. Connections and gateways API

Pipelines reference connections by GUID (`externalReferences.connection`). The pipeline API never creates connections; use the Connections API (SPNs need the tenant setting "Service principals can create workspaces, connections, and deployment pipelines").

```http
GET  /v1/connections                                     # scope Connection.Read.All; paginated
GET  /v1/connections/supportedConnectionTypes            # authoritative list of type + creationMethod + parameters
GET  /v1/workspaces/{ws}/items/{pipelineId}/connections  # which connections a pipeline uses
POST /v1/connections                                     # scope Connection.ReadWrite.All
GET|PATCH|DELETE /v1/connections/{connectionId}
POST /v1/connections/{connectionId}/roleAssignments      # {"principal":{"id","type":"ServicePrincipal"},"role":"User"|"UserWithReshare"|"Owner"}
GET  /v1/gateways                                        # OnPremises (publicKey for credential encryption), VirtualNetwork, ...
```

Create a cloud SQL connection with basic auth (Key Vault-referenced password):
```json
{
  "connectivityType": "ShareableCloud",
  "displayName": "sales-sql-prod",
  "connectionDetails": {
    "type": "SQL", "creationMethod": "SQL",
    "parameters": [ { "dataType": "Text", "name": "server", "value": "contoso.database.windows.net" },
                    { "dataType": "Text", "name": "database", "value": "sales" } ]
  },
  "privacyLevel": "Organizational",
  "credentialDetails": {
    "singleSignOnType": "None", "connectionEncryption": "NotEncrypted", "skipTestConnection": false,
    "credentials": { "credentialType": "Basic", "username": "svc_reader",
                     "passwordReference": { "connectionId": "<akv-connection-id>", "secretName": "sales-sql-pwd" } }
  },
  "allowUsageInUserControlledCode": true
}
```
Service-principal credentials: `{"credentialType": "ServicePrincipal", "tenantId": "...", "servicePrincipalClientId": "...", "servicePrincipalSecret": "..."}`. Other `credentialType` values: `Anonymous`, `Key`, `OAuth2`, `Windows`, `SharedAccessSignature`, `WorkspaceIdentity`, `KeyPair`. `connectivityType`: `ShareableCloud`, `PersonalCloud`, `OnPremisesGateway` (+`gatewayId`, credentials RSA-encrypted with the gateway public key), `VirtualNetworkGateway` (+`gatewayId`).

The `201` response `id` is the GUID you put in the pipeline JSON. The identity that will *run* the pipeline must have at least `User` role on every connection it references, otherwise the run (or a fabric-cicd deployment) fails.

---

## 8. Limits

- `description` ≤ 256 chars; `displayName` must be unique per workspace+type (no published charset rule; avoid leading/trailing spaces and `. + ? / < > * % & : \` to stay Git-friendly).
- 1,000 items per workspace; 1,000 pipelines per workspace; 20 schedules per pipeline.
- No documented byte cap on the definition payload, but the pipeline object itself is capped at 200 KB and per-activity-run payload at 896 KB; base64 inflates by ~33%.
- Activity policy defaults: `timeout` 7 days (UI writes `0.12:00:00`), `retry` 0, `retryIntervalInSeconds` 30 (30–86400).
- Job scheduler run-parameter names: unique (case-insensitive), ≤ 256 chars.

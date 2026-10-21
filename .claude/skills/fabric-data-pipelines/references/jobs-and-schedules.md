# Running, scheduling, monitoring and cancelling Fabric Data Pipelines

Verified against Microsoft Learn + Microsoft's open-source Fabric CLI on 2026-10-14.
Base URL `https://api.fabric.microsoft.com/v1`, `Authorization: Bearer <token>`.

## Contents
1. [Cheat sheet](#1-cheat-sheet)
2. [Run on demand (with parameters)](#2-run-on-demand)
3. [Poll a run, status semantics](#3-poll-a-run)
4. [List runs, cancel a run](#4-list-and-cancel)
5. [Schedules (Cron / Daily / Weekly / Monthly)](#5-schedules)
6. [Activity-level run details (queryactivityruns)](#6-activity-level-run-details)
7. [Event triggers (Activator / Reflex)](#7-event-triggers)
8. [Chaining pipelines (Invoke Pipeline, return values)](#8-chaining-pipelines)
9. [Triggering from outside: ADF, Logic Apps, Airflow, notebooks, CLI](#9-triggering-from-outside-fabric)
10. [Cross-item monitoring](#10-cross-item-monitoring)
11. [Gotchas](#11-gotchas)

---

## 1. Cheat sheet

| Operation | Call | Success |
|---|---|---|
| Run now | `POST /workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/instances` (legacy `…/jobs/instances?jobType=Pipeline` still accepted) | `202`, **empty body**, `Location` = job instance URL, `Retry-After` |
| Get run | `GET /workspaces/{ws}/items/{pipelineId}/jobs/instances/{jobInstanceId}` | `200` ItemJobInstance (+ `Retry-After`) |
| List runs | `GET /workspaces/{ws}/items/{pipelineId}/jobs/instances` | `200 {value:[…], continuationToken?}` (~100 most recent completed + all active) |
| Cancel run | `POST /workspaces/{ws}/items/{pipelineId}/jobs/instances/{jobInstanceId}/cancel` | `202` + `Location` (poll until `Cancelled`) |
| Create schedule | `POST /workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/schedules` | `201` ItemSchedule |
| List / get / update / delete schedule | `GET …/jobs/Pipeline/schedules[/{scheduleId}]`, `PATCH`, `DELETE` | `200` |
| Activity runs for one run | `POST /workspaces/{ws}/datapipelines/pipelineruns/{jobInstanceId}/queryactivityruns` | `200` bare JSON array |

`jobType` for a DataPipeline is exactly **`Pipeline`** (Microsoft's Fabric CLI maps `DataPipeline → "Pipeline"` for both runs and schedules). Some docs/community answers show `DefaultJob` in schedule URLs; if a schedule list comes back empty under one job type, try the other, but author with `Pipeline`.

Scopes: run/cancel `Item.Execute.All` (or `DataPipeline.Execute.All`); get/list `Item.Read.All`; create/update schedule `Item.Execute.All` + `Item.ReadWrite.All`. SPN and managed identity are supported on all of these.

---

## 2. Run on demand

```http
POST https://api.fabric.microsoft.com/v1/workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/instances
Content-Type: application/json

{ "executionData": { "parameters": { "RunDate": "2026-10-14", "BatchSize": 500, "FullLoad": false,
                                     "Tables": ["dim_customer", "fact_sales"], "Config": { "k": "v" } } } }
```

- Parameter names must match `properties.parameters` keys in the definition exactly; unknown names are ignored, missing ones take `defaultValue`. Values are raw JSON (string / number / bool / array / object).
- No parameters: send `{}` or no body at all.
- The top-level typed `parameters: [{name,type,value}]` array documented on the generic Job Scheduler page is for other item types; for pipelines it returns `FeatureNotAvailable`. Use `executionData.parameters`.
- The Learn sample body with `pipelineName` / `OwnerUserPrincipalName` / `OwnerUserObjectId` is optional metadata, not a required schema.

Response:
```
HTTP/1.1 202 Accepted
Location: https://api.fabric.microsoft.com/v1/workspaces/<ws>/items/<pipelineId>/jobs/instances/<jobInstanceId>
Retry-After: 60
```
The body is empty. Job instance id = last path segment of `Location`. Wait at least `Retry-After` seconds before the first status poll.

Errors: `InsufficientPrivileges` (403), `InvalidJobType`, `TooManyRequestsForJobs` (429; 100 submissions/user/min; 100 concurrent jobs per item), `ItemNotFound`.

Record the parameters you submitted yourself: the job instance object never echoes them back.

---

## 3. Poll a run

```http
GET /v1/workspaces/{ws}/items/{pipelineId}/jobs/instances/{jobInstanceId}
```
```json
{ "id": "…", "itemId": "…", "jobType": "Pipeline", "invokeType": "Manual",
  "status": "InProgress", "rootActivityId": "…",
  "startTimeUtc": "2026-10-14T06:00:03.1234567", "endTimeUtc": null, "failureReason": null }
```

| `status` | Meaning | Terminal? |
|---|---|---|
| `NotStarted` | queued (startTimeUtc may be null) | no |
| `InProgress` | running | no |
| `Completed` | succeeded | yes |
| `Failed` | failed; `failureReason` = `{errorCode, message, moreDetails…}` (coarse) | yes |
| `Cancelled` | cancelled | yes |
| `Deduped` | skipped because an identical job was already running | yes |

`invokeType` is `Manual` or `Scheduled`. Timestamps are UTC with 7 fractional digits and no `Z`. The enum may grow; treat unknown values as non-terminal for a bounded time, then bail. Use the `Retry-After` header on the 200 as the next poll interval (floor it at ~10–30 s; jobs can run up to 24 days, so always set a max wait).

For *why* a run failed, the job object is rarely enough; query activity runs (section 6).

---

## 4. List and cancel

List (per item only; no workspace-wide listing):
```http
GET /v1/workspaces/{ws}/items/{pipelineId}/jobs/instances[?continuationToken=…]
```
No server-side status/date filter; filter client-side. Loop while `continuationToken` is present.

Cancel:
```http
POST /v1/workspaces/{ws}/items/{pipelineId}/jobs/instances/{jobInstanceId}/cancel
```
`202` + `Location` (the job instance URL) + `Retry-After`. Cancellation is asynchronous: poll until `Cancelled`. `JobAlreadyCompleted` if it had already finished. Check status first and skip if not `NotStarted`/`InProgress`.

---

## 5. Schedules

```http
POST /v1/workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/schedules
{ "enabled": true, "configuration": { …one of the four shapes below… },
  "executionData": { "parameters": { "FullLoad": false } } }   // optional; verify with GET after create
```
`201` returns the `ItemSchedule`: `id`, `enabled`, `createdDateTime`, `configuration`, `owner {id, type}`, `executionData`.

### Configuration shapes
All four require `type`, `startDateTime`, `endDateTime`, `localTimeZoneId`. Date-times are `YYYY-MM-DDTHH:mm:ss` interpreted in `localTimeZoneId` (samples omit `Z`). A start in the past **triggers a run immediately**. There is no open-ended schedule; use a far-future end such as `2099-01-01T00:00:00`.

```json
{ "type": "Cron",   "startDateTime": "2026-10-15T00:00:00", "endDateTime": "2099-01-01T00:00:00",
  "localTimeZoneId": "UTC", "interval": 15 }                                   // every N minutes, 1..5270400
```
```json
{ "type": "Daily",  "startDateTime": "2026-10-15T00:00:00", "endDateTime": "2099-01-01T00:00:00",
  "localTimeZoneId": "Russian Standard Time", "times": ["06:00", "18:00"] }    // hh:mm, ≤100 slots
```
```json
{ "type": "Weekly", "startDateTime": "2026-10-15T00:00:00", "endDateTime": "2099-01-01T00:00:00",
  "localTimeZoneId": "W. Europe Standard Time", "times": ["06:00"],
  "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }
```
```json
{ "type": "Monthly", "startDateTime": "2026-11-01T00:00:00", "endDateTime": "2099-01-01T00:00:00",
  "localTimeZoneId": "UTC", "recurrence": 1, "times": ["02:00"],
  "occurrence": { "occurrenceType": "DayOfMonth", "dayOfMonth": 1 } }
  // or "occurrence": { "occurrenceType": "OrdinalWeekday", "weekIndex": "First"|"Second"|"Third"|"Fourth"|"Fifth", "weekday": "Monday" }
```

### `localTimeZoneId` is a Windows time-zone ID
| IANA | Windows id |
|---|---|
| UTC | `UTC` |
| Europe/London | `GMT Standard Time` |
| Europe/Berlin, Paris, Amsterdam | `W. Europe Standard Time` |
| Europe/Warsaw, Prague | `Central Europe Standard Time` |
| Europe/Moscow | `Russian Standard Time` |
| Europe/Istanbul, Antalya | `Turkey Standard Time` |
| Asia/Dubai | `Arabian Standard Time` |
| Asia/Kolkata | `India Standard Time` |
| Asia/Singapore | `Singapore Standard Time` |
| Asia/Tokyo | `Tokyo Standard Time` |
| Australia/Sydney | `AUS Eastern Standard Time` |
| America/New_York | `Eastern Standard Time` |
| America/Chicago | `Central Standard Time` |
| America/Denver | `Mountain Standard Time` |
| America/Los_Angeles | `Pacific Standard Time` |
| America/Sao_Paulo | `E. South America Standard Time` |
Full list: `tzutil /l` on Windows, or the `TimeZoneInfo` ids (`Get-TimeZone -ListAvailable` in PowerShell). DST is handled automatically.

### Update / disable / delete
```http
PATCH  /v1/workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/schedules/{scheduleId}   // body: full {enabled, configuration[, executionData]} — both fields required despite PATCH
DELETE /v1/workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/schedules/{scheduleId}
GET    /v1/workspaces/{ws}/items/{pipelineId}/jobs/Pipeline/schedules
```
To disable: GET the schedule, re-send its `configuration` with `"enabled": false`.

### Operational facts
- Max 20 schedules per pipeline (`ScheduleExceedsLimit`).
- A scheduled run executes under the identity of whoever created/last updated the schedule. Schedules expire if that user does not sign in to Fabric for 90 days. Create production schedules as the SPN.
- After ~10 consecutive failures the platform auto-disables the schedule; re-enable via PATCH `"enabled": true`.
- Schedules are serialized into the pipeline's `.schedules` definition part and travel with Git/deployment pipelines; fabric-cicd can flip `enabled` per environment with `key_value_replace` on `$.schedules[?(@.jobType=="Pipeline")].enabled`.
- Failure e-mail notifications apply to scheduled runs only and are configured in the UI.
- Interval-based (tumbling-window style) schedules exist in the UI (preview) and expose `WindowStartTime` / `WindowEndTime`, but are not a REST `configuration.type`.

---

## 6. Activity-level run details

```http
POST /v1/workspaces/{ws}/datapipelines/pipelineruns/{jobInstanceId}/queryactivityruns
{
  "filters": [],
  "orderBy": [ { "orderBy": "ActivityRunStart", "order": "DESC" } ],
  "lastUpdatedAfter":  "2026-10-13T00:00:00Z",
  "lastUpdatedBefore": "2026-10-15T00:00:00Z"
}
```
The pipeline run id **is** the Job Scheduler job instance id. Response is a bare JSON array:
```json
[ { "pipelineName": "<pipeline item GUID>", "pipelineRunId": "…", "activityName": "Copy Data", "activityType": "Copy",
    "activityRunId": "…", "status": "Failed", "activityRunStart": "…Z", "activityRunEnd": "…Z", "durationInMs": 27750,
    "input": { … }, "output": { … },
    "error": { "errorCode": "2200", "message": "…", "failureType": "UserError", "target": "Copy Data", "details": "" },
    "retryAttempt": null, "iterationHash": "", "userProperties": {}, "recoveryStatus": "None" } ]
```
- `status` values follow ADF: `Queued`, `InProgress`, `Succeeded`, `Failed`, `Cancelled`, `Skipped`.
- Filters: `{"operand": "ActivityName"|"ActivityType"|"Status"|"ActivityRunStart"|"ActivityRunEnd", "operator": "Equals"|"NotEquals"|"In"|"NotIn", "values": [...]}`.
- Make the `lastUpdatedAfter/Before` window generous (run start − 1 day .. now + 1 day); an empty `[]` almost always means the window missed the run.
- Paging gotcha (official troubleshooting guide): the response may include a `continuationToken` that is a JSON *string* like `{"token":null,"range":{...}}`. Pass the whole string back in the body as `continuationToken` and keep going while it is non-null **even if a page is an empty array**.
- Copy activity `output` carries `rowsRead`, `rowsCopied`, `dataRead`, `dataWritten`, `copyDuration`, `executionDetails[0].status`; Lookup `output.value` / `output.firstRow`; Invoke Pipeline `output.pipelineReturnValue`.
- Child pipelines invoked via Invoke Pipeline have their own job instance id; find it in the parent's Invoke activity `output`.

---

## 7. Event triggers

There is no "trigger" endpoint. Event-based pipeline runs (file arrival in OneLake/Azure Blob, Fabric job events, workspace item events) are **Activator (Reflex) items** that the pipeline UI's **Trigger** button creates for you. Programmatically, create a Reflex item with a `ReflexEntities.json` definition:

```http
POST /v1/workspaces/{ws}/items     // or /v1/workspaces/{ws}/reflexes
{ "displayName": "On new file run NightlyLoad", "type": "Reflex",
  "definition": { "parts": [ { "path": "ReflexEntities.json", "payload": "<b64>", "payloadType": "InlineBase64" } ] } }
```
Do not include `definition.format`. Expect 202 (LRO).

`ReflexEntities.json` is an array of five linked entities (the Learn "Consume events with Activator via REST API" page has the full verbatim example):
1. `container-v1` — `{ "name": "...", "type": "rthSubscriptions" }`
2. `realTimeHubSource-v1` — the event subscription. `connection.eventGroupType` selects the source:
   - `Microsoft.Fabric.OneLakeEvents` (`scope: "Artifact"`, `artifactId` = lakehouse id; types `Microsoft.Fabric.OneLake.FileCreated|FileDeleted|FileRenamed|FolderCreated|…`)
   - `Microsoft.Storage.StorageAccounts` (`scope: "SubArtifact"`, stable GUIDs for `artifactId`/`subArtifactId`, storage account ARM id in `subArtifactDisplayName`; types `Microsoft.Storage.BlobCreated|BlobDeleted`)
   - `Microsoft.Fabric.JobEvents` (`scope: "Artifact"`, `artifactId` = the item whose jobs you watch; types `Microsoft.Fabric.JobEvents.ItemJobSucceeded|ItemJobFailed|ItemJobCreated|ItemJobStatusChanged`) — this is how you chain "run B after A succeeds" without a parent pipeline
   - `Microsoft.Fabric.WorkspaceEvents` (`scope: "Workspace"`; types `Microsoft.Fabric.ItemCreateSucceeded|…`)
   `filterSettings.eventTypes[]` and `filters[]` (subject contains/begins-with etc.) narrow it.
3. `timeSeriesView-v1` of type `Event` — `SourceEvent` template whose `SourceReference` argument points at entity 2's `uniqueIdentifier`.
4. `timeSeriesView-v1` of type `Rule` — `EventTrigger` template with steps `FieldsDefaultsStep` (EventSelector → entity 3), `EventDetectStep` (`OnEveryValue`), `ActStep` row `FabricItemBinding` kind `FabricItemInvocation` with arguments `workspaceId`, `itemId`, `itemType: "Pipeline"`, `jobType: "Pipeline"`, `fabricJobConnectionDocumentId` (= entity 5's uniqueIdentifier), `additionalInformation: []`, `parameters: []` (one `FabricItemParameter` per pipeline parameter: string/boolean/number, static or bound to event fields). `settings: { "shouldRun": true, "shouldApplyRuleOnUpdate": false }`.
5. `fabricItemAction-v1` — `{ "name": "...", "fabricItem": { "itemId", "workspaceId", "itemType": "Pipeline" }, "jobType": "Pipeline", "parentContainer": {...} }`.

Inside the triggered pipeline, file-event fields arrive as `@pipeline()?.TriggerEvent?.FileName` and `@pipeline()?.TriggerEvent?.FolderPath` (null on manual runs; note the `?`). Trigger source and Activator must be in the same region; cross-workspace event consumption needs the "Real-Time Events" connector allowed by workspace outbound access protection. A 2xx on the definition only proves the rule was accepted, not that it fired: test with a real event and check `GET …/jobs/instances` (`invokeType` will be `Scheduled`).

---

## 8. Chaining pipelines

Two activity types:
- `InvokePipeline` (new; what the UI emits): cross-workspace and ADF/Synapse capable, needs a **Fabric Data Pipelines connection** (`externalReferences.connection`; auth = org account, SPN, or workspace identity), `typeProperties: { operationType: "InvokeFabricPipeline", workspaceId, pipelineId, parameters, waitOnCompletion (default false) }`.
- `ExecutePipeline` (legacy): same-workspace only, `typeProperties.pipeline: { referenceName, type: "PipelineReference" }`, `waitOnCompletion` default true, no connection.

Return values: the child sets them with a Set Variable activity using `variableName: "pipelineReturnValue"`, `setSystemVariable: true`, `value: [ { "key": "rowsCopied", "value": { "type": "Expression", "content": "@activity('Copy').output.rowsCopied" } } ]`; the parent reads `@activity('Invoke child').output.pipelineReturnValue.rowsCopied` (requires `waitOnCompletion: true`; ≤ 4 MB). Inside the child: `@pipeline()?.TriggeredByPipelineName`, `@pipeline()?.TriggeredByPipelineRunId`. Arrays passed to a child can arrive as strings — wrap with `@json(...)` or `createArray(...)`.

Alternatives: Fabric **Job events → Activator** (section 7) for loose coupling; the **Fabric Actions** activity (preview) or a **Web** activity against the Job Scheduler endpoint (connection base URL `https://api.fabric.microsoft.com`) for ad-hoc REST calls from inside a pipeline.

---

## 9. Triggering from outside Fabric

**Azure Data Factory / Synapse**: no native activity; use a Web activity → `POST …/jobs/Pipeline/instances` with the factory's system-assigned managed identity (resource `https://api.fabric.microsoft.com`). Add that MI to the SPN-allowed security group and as workspace Contributor. Leave the Web activity's async pattern enabled so it follows `Location`/`Retry-After` to completion; if you disable it, add an Until loop that GETs the job instance, otherwise ADF reports success regardless of the Fabric outcome.

**Power Automate / Logic Apps**: HTTP action with Microsoft Entra ID auth, audience `https://api.fabric.microsoft.com`, POST the run endpoint. The 202 body is empty, so read `outputs('HTTP')?['headers']?['Location']` for the job id; with a custom connector turn asynchronous mode off and declare the `location` response header.

**Apache Airflow** (Fabric Airflow Job or self-hosted), package `apache-airflow-microsoft-fabric-plugin`:
```python
from apache_airflow_microsoft_fabric_plugin.operators.fabric import FabricRunItemOperator
run = FabricRunItemOperator(task_id="run_nightly", fabric_conn_id="fabric_conn",
    workspace_id="<ws>", item_id="<pipelineId>", job_type="Pipeline",           # case-sensitive
    job_params={"RunDate": "{{ ds }}"}, wait_for_termination=True, deferrable=True,
    timeout=3600, check_interval=60)
```
Connection extra: `{"tenantId": "...", "clientSecret": "...", "scopes": "https://api.fabric.microsoft.com/Item.Execute.All https://api.fabric.microsoft.com/Item.Read.All offline_access"}`; XComs `run_id`, `run_status`, `run_location`.

**Fabric notebook** (semantic-link is preinstalled; auth is the notebook's user or the pipeline's LastModifiedBy):
```python
import sempy.fabric as fabric, time
client = fabric.FabricRestClient()            # retries 429/502/503/504 automatically
ws = fabric.get_workspace_id()
r = client.post(f"v1/workspaces/{ws}/items/{pipeline_id}/jobs/Pipeline/instances",
                json={"executionData": {"parameters": {"RunDate": "2026-10-14"}}})
job_url = r.headers["Location"]; time.sleep(int(r.headers.get("Retry-After", 60)))
while (job := client.get(job_url).json())["status"] in ("NotStarted", "InProgress"):
    time.sleep(30)
print(job["status"], job.get("failureReason"))
```
`semantic-link-labs`: `labs.run_on_demand_item_job(item="Nightly Load", type="DataPipeline", job_type="Pipeline", workspace="Dev")` (cannot pass parameters), `labs.list_item_job_instances(...)`, `labs.create_item_schedule_cron/daily/weekly(..., job_type="Pipeline")`, `labs.cancel_item_job_instance(...)`. There is no `labs.run_data_pipeline`; the `job_type` default `DefaultJob` is wrong for pipelines.

**Fabric CLI** (`pip install ms-fabric-cli`):
```bash
fab job run   "Dev.Workspace/Nightly Load.DataPipeline" -P RunDate:string=2026-10-14,BatchSize:int=500 --timeout 3600   # sync, exit 1 on failure
fab job start "Dev.Workspace/Nightly Load.DataPipeline" -i '{"parameters": {"RunDate": "2026-10-14"}}'                  # async, prints job id
fab job run-status "Dev.Workspace/Nightly Load.DataPipeline" --id <jobId>
fab job run-list   "Dev.Workspace/Nightly Load.DataPipeline"            # add --schedule to list schedules
fab job run-cancel "Dev.Workspace/Nightly Load.DataPipeline" --id <jobId> --wait
fab job run-sch    "Dev.Workspace/Nightly Load.DataPipeline" --type weekly --interval 06:00 --days Monday,Tuesday,Wednesday,Thursday,Friday --start 2026-10-15T00:00:00 --end 2099-01-01T00:00:00 --enable
fab job run-update "Dev.Workspace/Nightly Load.DataPipeline" --id <scheduleId> --disable
```
`-P` types for pipelines: `string,int,float,bool,object,array,secureString`.

---

## 10. Cross-item monitoring

No REST endpoint lists runs across items or workspaces. Options, durable to ephemeral:
- **Workspace monitoring** (Eventhouse) table `ItemJobEventLogs` — KQL over `JobInstanceId`, `JobType` (`Data Pipeline`), `JobStatus`, `JobInvokeType`, `JobStartTime`, `JobEndTime`, `ExecutingPrincipalId`.
- **Fabric Job events** streamed via Eventstream/Activator to Eventhouse or to alerts (section 7).
- Per item: `GET …/jobs/instances` (section 4) + `queryactivityruns` (section 6).
- UI only: Monitor hub (rerun from failed activity has no REST equivalent).

---

## 11. Gotchas

1. `jobType` is `Pipeline`. Not `DefaultJob`, not `DataPipeline`, not `Refresh`, not `Execute`.
2. The run call returns **202 with an empty body**; the job id lives in `Location`. Honor `Retry-After` (observed 60 s) before the first poll.
3. Pipeline parameters go under `executionData.parameters` as a name→value map, not the generic typed `parameters[]` array.
4. `Deduped` is a terminal status; `NotStarted` can persist for minutes under capacity pressure.
5. The job object has no parameters and no activity outputs; use `queryactivityruns` with a wide time window and follow its string continuation token even across empty pages.
6. Schedules: start **and** end required (use 2099 for "forever"), Windows time-zone ids, `interval` is minutes, PATCH needs the full body, max 20, owner identity runs the job and expires after 90 days without sign-in, auto-disable after ~10 failures.
7. Per identity: 100 submissions/min, 100 get-job/min, 200 Job Scheduler calls/min, 100 concurrent jobs per item, 24-day max run.
8. A pipeline runs as its **LastModifiedBy** identity; a scheduled run as the schedule's owner. For unattended production, make both the SPN (PATCH the pipeline as the SPN; create schedules as the SPN).
9. Event triggers are Reflex items; "run A then B" without a parent pipeline is a Job-events Activator rule.
10. The Learn page's "Current limitations" line "Run APIs can be invoked, but the actual run never succeeds" is stale text copied from Dataflow Gen2; pipeline runs via API work.

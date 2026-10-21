---
name: fabric-data-pipelines
description: >
  Create, update, run/trigger, schedule, monitor, cancel and deploy Microsoft Fabric (Data Factory) data
  pipelines programmatically: Fabric REST API (DataPipeline items + Job Scheduler), bundled Python client,
  Fabric CLI (fab), sempy/semantic-link-labs in notebooks, fabric-cicd, Terraform, Airflow, PowerShell,
  ADF/Logic Apps callers. Use whenever Fabric pipelines meet automation in any form: service principals,
  "run a pipeline from code", polling a run, activity-level errors, pipeline-content.json / item definitions /
  base64 payloads, jobType, schedules via API, event triggers, chaining pipelines, CI/CD or Git deployment,
  or authoring pipeline JSON as code - even if the user never says "programmatically" or "REST". Also for
  debugging Fabric API errors on pipelines (429, ItemDisplayNameAlreadyInUse, CorruptedPayload,
  InsufficientPrivileges). Not for non-Fabric ADF/Synapse, Dataflow Gen2 authoring, or notebook code itself.
---

# Fabric Data Pipelines, programmatically

Fabric pipelines (Data Factory in Fabric) are workspace **items** of type `DataPipeline`. Everything you can do
to them from code decomposes into five API surfaces; keep this map in mind and most questions answer themselves:

| Surface | What it does | Key endpoints |
|---|---|---|
| **Items API** | create / rename / delete the pipeline, read & replace its JSON body | `POST /v1/workspaces/{ws}/dataPipelines`, `POST …/{id}/getDefinition`, `POST …/{id}/updateDefinition` |
| **Job Scheduler API** | run now, poll, list, cancel, schedules | `POST …/items/{id}/jobs/Pipeline/instances`, `GET …/jobs/instances/{jobId}`, `…/jobs/Pipeline/schedules` |
| **Activity runs** | per-activity status/inputs/outputs/errors of one run | `POST /v1/workspaces/{ws}/datapipelines/pipelineruns/{jobId}/queryactivityruns` |
| **Connections API** | the GUIDs pipelines reference for external stores | `GET/POST /v1/connections` |
| **CI/CD** | Git format, fabric-cicd, deployment pipelines, Terraform | see `references/cicd.md` |

Base URL `https://api.fabric.microsoft.com/v1`; `Authorization: Bearer <token>`; the pipeline body travels as a
base64-encoded `pipeline-content.json` definition part; the job type for pipelines is the literal string
**`Pipeline`**. Everything below was verified against Microsoft Learn and Microsoft's open-source Fabric CLI
(October 2026); when a detail is marked *verify*, confirm it in the UI's **View → View JSON code** before relying on it.

## 1. Pick the tool

| Situation | Reach for |
|---|---|
| Script / CI job / automation from anywhere | `scripts/fabric_pipelines.py` (requests + optional azure-identity) or raw REST below |
| Interactive shell work, humans + CI | Fabric CLI: `pip install ms-fabric-cli`, `fab job run "WS.Workspace/Pipe.DataPipeline"` |
| Inside a Fabric notebook | `sempy.fabric.FabricRestClient()` (auto-auth, retries, `lro_wait=True`); `sempy_labs` helpers |
| Promote a whole workspace dev→test→prod from Git | **fabric-cicd** (`deploy_with_config`) or `fab deploy`; deployment pipelines API |
| Declarative infra (workspace + pipelines + connections) | Terraform `microsoft/fabric` → `fabric_data_pipeline` |
| Orchestrate from Airflow / ADF / Logic Apps / Power Automate | `FabricRunItemOperator(job_type="Pipeline")` / Web-HTTP activity with managed identity |
| PowerShell shop | `FabricTools` cmdlets + `Invoke-FabricRestMethod` for jobs |
Details, install commands and verbatim examples: `references/auth-and-tooling.md`.

## 2. Prerequisites (do these once, or the first API call will 403)

1. **Identity**: for unattended work create an Entra app + service principal (SPN). No API permissions/scopes are
   needed for app-only access; a client secret or certificate is.
2. **Tenant setting** "Service principals can use Fabric APIs" must be on and must include the SPN's security
   group (and "Service principals can create workspaces, connections, and deployment pipelines" if you will
   create those). Propagation takes a few minutes.
3. **Workspace role**: SPN as **Contributor** (Admin for Git APIs). Programmatically:
   `POST /v1/workspaces/{ws}/roleAssignments {"principal":{"id":"<sp object id>","type":"ServicePrincipal"},"role":"Contributor"}`.
4. **Capacity**: the workspace must be on a Fabric capacity (`GET /v1/workspaces/{ws}` → `capacityId` set).
5. **Connections**: create them per environment first (UI or `POST /v1/connections`) and grant the running identity
   at least `User` on each. Pipelines only reference connections by GUID; they never create them.
6. **Run identity**: a pipeline runs as its **LastModifiedBy**; a schedule runs as its creator. For production,
   make both the SPN (any PATCH as the SPN takes ownership: `fabric_pipelines.py takeover`).

Token: `scope=https://api.fabric.microsoft.com/.default` (SPN) or delegated scopes `Item.ReadWrite.All Item.Execute.All Workspace.ReadWrite.All`.
Quick local token: `az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv`.

## 3. Fastest path: the bundled client

`scripts/fabric_pipelines.py` wraps the whole lifecycle with the right headers, 429 handling, LRO polling,
pagination, name→GUID resolution and idempotent create-or-update. Use it as a CLI or `from fabric_pipelines import FabricPipelines`.
Auth order: `FABRIC_TOKEN` → `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET` → `DefaultAzureCredential` → `az` CLI.
`pip install requests azure-identity`.

```bash
S=scripts/fabric_pipelines.py
python $S workspaces                                                   # ids, capacity
python $S pipelines      -w Dev
python $S upsert         -w Dev -p "Nightly Load" --content pipeline-content.json --description "Loads dims"   # create or replace
python $S get-definition -w Dev -p "Nightly Load" --out pipeline-content.json                                   # decoded JSON
python $S run            -w Dev -p "Nightly Load" --param RunDate=2026-10-14 --param BatchSize=500 --wait --timeout 3600
python $S activity-runs  -w Dev -p "Nightly Load" --job <jobInstanceId> --failed-only                           # why it failed
python $S schedule-create -w Dev -p "Nightly Load" --weekly 06:00 --days Mon,Tue,Wed,Thu,Fri --tz "W. Europe Standard Time"
python $S schedule-update -w Dev -p "Nightly Load" --schedule <id> --enabled false
python $S cancel         -w Dev -p "Nightly Load" --job <jobInstanceId> --wait
python $S takeover       -w Dev -p "Nightly Load"      # make the calling SPN the run identity
python $S delete         -w Dev -p "Nightly Load" [--hard]
```
`run --wait` exits 1 on `Failed`/`Cancelled`/`Deduped` and prints the failed activities, so it drops straight into CI.
Workspace/pipeline arguments take a display name or a GUID. `--param` values are parsed as JSON when possible.

Keep deliverables proportional to the ask: when a task needs "run the pipeline and fail on error", ship
`fabric_pipelines.py run --wait` (copy the file alongside) rather than writing a new client; one workflow file unless
more were requested; no bespoke validators, the skill has one. Spend the saved effort on correctness of the GUIDs,
tenant settings and run identity, which is where real deployments break.

Before sending any hand-written JSON, run `python scripts/pipeline_json_tools.py validate pipeline-content.json`
(catches the things the service rejects with an opaque `CorruptedPayload`: duplicate names, bad `dependsOn`, ADF-only
fields, nested ForEach, missing `datasetSettings`, unwrapped `@` expressions, placeholder GUIDs…). `refs` lists every
environment-bound GUID for CI/CD parameterization; `from-export` converts a UI "Export template" zip into `pipeline-content.json`.

## 4. Core workflows in raw REST (when the script is not an option)

### 4.1 Resolve ids
No name filters exist. `GET /v1/workspaces` (paginate via `continuationToken`), match `displayName` exactly, skip
`type == "Personal"`; then `GET /v1/workspaces/{ws}/dataPipelines` and match again. Cache the GUIDs.

### 4.2 Create (or update) a pipeline from JSON
```python
import base64, json, requests, time
API = "https://api.fabric.microsoft.com/v1"
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
content = {"properties": {"activities": [{"name": "Wait1", "type": "Wait", "dependsOn": [], "typeProperties": {"waitTimeInSeconds": 10}}]}}
part = {"path": "pipeline-content.json", "payload": base64.b64encode(json.dumps(content).encode()).decode(), "payloadType": "InlineBase64"}
r = requests.post(f"{API}/workspaces/{ws}/dataPipelines", headers=H,
                  json={"displayName": "Nightly Load", "description": "Loads dims", "definition": {"parts": [part]}})
if r.status_code == 409 and r.json().get("errorCode") == "ItemDisplayNameAlreadyInUse":   # idempotent path
    pid = next(p["id"] for p in requests.get(f"{API}/workspaces/{ws}/dataPipelines", headers=H).json()["value"] if p["displayName"] == "Nightly Load")
    r = requests.post(f"{API}/workspaces/{ws}/dataPipelines/{pid}/updateDefinition", headers=H, json={"definition": {"parts": [part]}})
if r.status_code == 202:                                   # long-running operation
    op = r.headers["x-ms-operation-id"]
    while True:
        time.sleep(int(r.headers.get("Retry-After", 5)))
        st = requests.get(f"{API}/operations/{op}", headers=H).json()["status"]
        if st in ("Succeeded", "Failed"): break
    item = requests.get(f"{API}/operations/{op}/result", headers=H).json() if st == "Succeeded" else None
```
Optional body fields: `folderId`, and a `.platform` part (stable `logicalId` for Git pairing; see `references/rest-api.md` §3).
`updateDefinition` **replaces** the whole definition: always send the complete `pipeline-content.json`; add
`?updateMetadata=true` only when you also send `.platform` and want its displayName/description applied.

### 4.3 Read → modify → write
`POST …/dataPipelines/{id}/getDefinition` (yes, POST; body `{}`) → base64-decode the `pipeline-content.json` part →
edit the dict → drop `lastModifiedByObjectId`/`lastPublishTime` → `updateDefinition`. A pipeline with schedules also
returns a `.schedules` part; you may omit it on update.

### 4.4 Run with parameters, wait, diagnose
```python
r = requests.post(f"{API}/workspaces/{ws}/items/{pid}/jobs/Pipeline/instances", headers=H,
                  json={"executionData": {"parameters": {"RunDate": "2026-10-14", "BatchSize": 500}}})   # 202, EMPTY body
job_url = r.headers["Location"]; job_id = job_url.rstrip("/").split("/")[-1]
time.sleep(int(r.headers.get("Retry-After", 60)))
while (job := requests.get(job_url, headers=H).json())["status"] in ("NotStarted", "InProgress"):
    time.sleep(30)                                           # terminal: Completed | Failed | Cancelled | Deduped
if job["status"] != "Completed":
    runs = requests.post(f"{API}/workspaces/{ws}/datapipelines/pipelineruns/{job_id}/queryactivityruns", headers=H,
        json={"filters": [], "orderBy": [{"orderBy": "ActivityRunStart", "order": "DESC"}],
              "lastUpdatedAfter": "2026-10-13T00:00:00Z", "lastUpdatedBefore": "2026-10-15T00:00:00Z"}).json()
    failed = [(a["activityName"], a["error"]["message"]) for a in runs if a["status"] == "Failed"]
```
Parameter names must match `properties.parameters` exactly (others are silently ignored). The job object never
echoes parameters or activity output; `queryactivityruns` does (bare JSON array; widen the time window if you get `[]`;
keep following its string `continuationToken` even across empty pages). Legacy `…/jobs/instances?jobType=Pipeline` still works.

### 4.5 Schedule
```http
POST /v1/workspaces/{ws}/items/{pid}/jobs/Pipeline/schedules
{ "enabled": true,
  "configuration": { "type": "Weekly", "startDateTime": "2026-10-15T00:00:00", "endDateTime": "2099-01-01T00:00:00",
                     "localTimeZoneId": "W. Europe Standard Time", "times": ["06:00"], "weekdays": ["Monday","Tuesday","Wednesday","Thursday","Friday"] },
  "executionData": { "parameters": { "FullLoad": false } } }
```
Types `Cron` (`interval` minutes), `Daily`/`Weekly` (`times` hh:mm), `Monthly` (`occurrence` DayOfMonth / OrdinalWeekday).
Start **and** end are required (use 2099 for "forever"); a start in the past fires immediately; `localTimeZoneId` is a
**Windows** id (`UTC`, `Russian Standard Time`, `Pacific Standard Time`…); max 20 per pipeline; `PATCH` needs the full
body; list/get/delete under the same path. All shapes + time-zone table: `references/jobs-and-schedules.md` §5;
ready bodies: `assets/templates/schedules.json`.

### 4.6 Cancel / list
`POST …/jobs/instances/{jobId}/cancel` → 202, then poll until `Cancelled` (`JobAlreadyCompleted` if too late).
`GET …/items/{pid}/jobs/instances` lists ~100 recent + all active runs (per item only; no cross-item endpoint).

### 4.7 Event triggers and chaining
File-arrival / job-succeeded / workspace-event triggers are **Activator (Reflex) items**, not a pipeline property:
`POST /v1/workspaces/{ws}/items` with `"type": "Reflex"` and a `ReflexEntities.json` definition whose rule action is
`FabricItemInvocation` with `itemType: "Pipeline"`, `jobType: "Pipeline"`. Chain pipelines in-graph with the
`InvokePipeline` activity (needs a Fabric Data Pipelines connection) or loosely via Job events → Activator.
Entity graph and source payloads: `references/jobs-and-schedules.md` §7–8.

### 4.8 Delete
`DELETE …/dataPipelines/{id}` soft-deletes; `?hardDelete=true` is permanent.

## 5. Authoring `pipeline-content.json`

```json
{ "properties": {
    "parameters": { "RunDate": { "type": "string", "defaultValue": "2026-01-01" } },
    "variables":  { "status":  { "type": "String" } },
    "activities": [
      { "name": "Copy Data", "type": "Copy", "dependsOn": [],
        "policy": { "timeout": "0.12:00:00", "retry": 1, "retryIntervalInSeconds": 60, "secureInput": false, "secureOutput": false },
        "typeProperties": {
          "source": { "type": "AzureSqlSource", "sqlReaderQuery": { "value": "@concat('SELECT * FROM dbo.t WHERE d = ''', pipeline().parameters.RunDate, '''')", "type": "Expression" },
                      "datasetSettings": { "annotations": [], "type": "AzureSqlTable", "schema": [], "typeProperties": {},
                                           "externalReferences": { "connection": "<sql connection GUID>" } } },
          "sink":   { "type": "LakehouseTableSink", "tableActionOption": "Append",
                      "datasetSettings": { "annotations": [], "type": "LakehouseTable", "schema": [], "typeProperties": { "table": "t" },
                                           "linkedService": { "name": "lh", "properties": { "annotations": [], "type": "Lakehouse",
                                             "typeProperties": { "workspaceId": "00000000-0000-0000-0000-000000000000", "artifactId": "<lakehouse id>", "rootFolder": "Tables" } } } } },
          "enableStaging": false,
          "translator": { "type": "TabularTranslator", "typeConversion": true, "typeConversionSettings": { "allowDataTruncation": true, "treatBooleanAsNumber": false } } } },
      { "name": "Run Notebook", "type": "TridentNotebook", "dependsOn": [ { "activity": "Copy Data", "dependencyConditions": ["Succeeded"] } ],
        "policy": { "timeout": "0.02:00:00", "retry": 0, "retryIntervalInSeconds": 30, "secureInput": false, "secureOutput": false },
        "typeProperties": { "notebookId": "<notebook id>", "workspaceId": "00000000-0000-0000-0000-000000000000",
                            "parameters": { "run_date": { "value": { "value": "@pipeline().parameters.RunDate", "type": "Expression" }, "type": "string" } } } } ] } }
```
The rules that matter when writing this by hand:
- It is ADF's activity model **minus** linked services, datasets, triggers and integration runtimes. External stores bind
  with `externalReferences: {"connection": "<GUID>"}` (inside `datasetSettings` for Copy/Lookup/GetMetadata/Delete, at
  activity level for Web/Script/StoredProc/InvokePipeline/…); Fabric items bind with an inline `linkedService`
  (`type: Lakehouse|DataWarehouse|KustoDatabase`, `workspaceId`, `artifactId`, `rootFolder`/`endpoint`).
- `workspaceId: "00000000-0000-0000-0000-000000000000"` means "this workspace" and is what makes Git/CI-CD rebind items.
- Dynamic content is always `{ "value": "@...", "type": "Expression" }`; a bare `"@..."` string is a literal.
- Control-flow activities (ForEach, IfCondition, Switch, Until, Filter, Fail, Wait, AppendVariable) take no `policy`;
  ForEach can't nest ForEach/Until; `batchCount` ≤ 50; 120 activities and 50 parameters max.
- `@pipeline().DataFactory` is the **workspace ID** in Fabric; `@pipeline().RunId`, `@pipeline().PipelineName`,
  `@activity('X').output…`, `@item()`, `@pipeline().libraryVariables.<alias>` work as in ADF.
- Dataflow Gen2 activity (`RefreshDataflow`) needs `"dataflowType": "DataflowFabric"`; Outlook/Teams activities need a
  human re-sign-in after deployment; Semantic-model / dataflow references are not auto-rebound across workspaces.
Full catalog with verbatim JSON for every activity type, expressions, limits and the UI-export converter:
`references/pipeline-json.md`. Starter files: `assets/templates/`.

## 6. Promoting across environments

Pipelines are GUID-bound (lakehouses, notebooks, dataflows, connections, workspaces), so promotion is GUID rewriting.
Preferred order: **Variable Library** (`@pipeline().libraryVariables.X`, value set per environment) → **fabric-cicd**
`parameter.yml` (`find_replace` / `key_value_replace` with `$workspace.$id`, `$items.Lakehouse.Bronze.$id`) → pipeline
parameters. Deployment pipelines have **no** deployment rules for DataPipeline items. Deploy as the SPN so it becomes
`LastModifiedBy`, create schedules as the SPN, then smoke-run. Git folder format (`Name.DataPipeline/pipeline-content.json`
+ `.platform` + `.schedules`), Git/deployment-pipeline REST calls, Terraform resource schema and ready-to-paste GitHub
Actions / Azure DevOps workflows: `references/cicd.md`.

## 7. Gotchas that cost people days

1. `jobType` is **`Pipeline`** - not `DefaultJob`, `DataPipeline`, `Execute` or `Refresh`. (Some docs show `DefaultJob` in schedule URLs; Microsoft's own CLI uses `Pipeline` for runs *and* schedules.)
2. Run returns **202 with an empty body**; the job id is the last segment of `Location`. Honor `Retry-After` (60 s) before polling.
3. Pipeline parameters go in `executionData.parameters` (name → raw value). The typed top-level `parameters[]` array is for other item types and returns `FeatureNotAvailable`.
4. `getDefinition` is a **POST** and needs read+write permission; `updateDefinition` **replaces** everything.
5. `409 ItemDisplayNameAlreadyInUse` is your idempotency hook: look up by name, then `updateDefinition`.
6. `CorruptedPayload` = bad base64, invalid JSON, or schema violation. Validate locally first (`pipeline_json_tools.py validate`).
7. `429`: `RequestBlocked` → sleep `Retry-After`; `CapacityLimitExceeded` → exponential backoff (no Retry-After). Quotas per identity: 500 platform / 200 job-scheduler / 500 LRO calls per minute, 100 job submissions per minute, 100 concurrent jobs per item.
8. `403 InsufficientPrivileges` with a valid token almost always means the tenant setting / security group / workspace role from §2.
9. The pipeline runs as **LastModifiedBy**; a user editing it in the UI silently changes the run identity away from the SPN. Re-take ownership after edits. Rotating the SPN secret also needs a re-save (no background token refresh).
10. Schedules: both dates required, Windows time zones, 20 max, PATCH = full body, owner must sign in every 90 days (use the SPN), auto-disabled after ~10 consecutive failures.
11. `Deduped` is terminal (an identical job was already running). `NotStarted` can linger under capacity pressure.
12. No cross-item run listing API; use per-item lists, `queryactivityruns`, or workspace monitoring (`ItemJobEventLogs` KQL).
13. Connections are never created by the pipeline API and are not source-controlled; the run identity needs `User` on each.
14. Timestamps in job objects are UTC without a `Z`; parse accordingly.
15. The Learn page line "Run APIs can be invoked, but the actual run never succeeds" is stale Dataflow text; pipeline runs via API work.

## 8. Reference index (read on demand)

| File | Read when |
|---|---|
| `references/rest-api.md` | exact request/response bodies for CRUD & definitions, LRO flow, every error code, throttling quotas, workspace/folder lookup, Connections API |
| `references/jobs-and-schedules.md` | run/poll/cancel semantics, all four schedule shapes + Windows time-zone table, `queryactivityruns` paging, Activator (Reflex) trigger definition, Invoke Pipeline & return values, Airflow/ADF/Logic Apps/notebook/CLI invocation |
| `references/pipeline-json.md` | writing or editing `pipeline-content.json`: envelope, every activity type with JSON, expressions, limits, UI-export conversion |
| `references/auth-and-tooling.md` | SPN/tenant setup, token acquisition in Python/CLI/PowerShell, Fabric CLI commands, sempy/sempy_labs/msfabricpysdkcore usage, SPN limitations |
| `references/cicd.md` | Git format, fabric-cicd + `parameter.yml`, Git & deployment-pipeline APIs, Variable Library, Terraform, GitHub Actions / Azure DevOps YAML |
| `scripts/fabric_pipelines.py` | the client/CLI (import `FabricPipelines` for programmatic use) |
| `scripts/pipeline_json_tools.py` | `validate`, `refs`, `from-export`, `encode`, `decode` |
| `assets/templates/` | minimal, copy-SQL-to-Lakehouse, metadata-driven (Lookup→ForEach→Notebook→Invoke) pipelines; schedule bodies; `.platform` |

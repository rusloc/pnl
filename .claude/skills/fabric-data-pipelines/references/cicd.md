# CI/CD for Fabric Data Pipelines: Git, fabric-cicd, deployment pipelines, Terraform

Verified 2026-10-14. Pipelines reference other things by GUID (lakehouses, notebooks, dataflows, connections, workspaces), so every promotion strategy is really a strategy for rewriting GUIDs per environment.

## Contents
1. [Git source format](#1-git-source-format)
2. [How references get rebound (and which don't)](#2-how-references-get-rebound)
3. [fabric-cicd](#3-fabric-cicd)
4. [Git integration REST APIs](#4-git-integration-rest-apis)
5. [Deployment pipelines API](#5-deployment-pipelines-api)
6. [Variable Library](#6-variable-library)
7. [Terraform provider](#7-terraform-provider)
8. [Workflow templates: Azure DevOps and GitHub Actions](#8-workflow-templates)
9. [Recommended layout](#9-recommended-layout)

---

## 1. Git source format

One folder per item, named `<DisplayName>.<Type>`:
```
workspace/
├── Nightly Load.DataPipeline/
│   ├── pipeline-content.json     # required definition part (see pipeline-json.md)
│   ├── .platform                 # {"$schema": ".../gitIntegration/platformProperties/2.0.0/schema.json",
│   │                             #  "metadata": {"type": "DataPipeline", "displayName": "Nightly Load", "description": "..."},
│   │                             #  "config": {"version": "2.0", "logicalId": "<guid>"}}
│   └── .schedules                # only when schedules exist: {"$schema": ".../gitIntegration/schedules/1.0.0/schema.json",
│                                 #  "schedules": [{"enabled": true, "jobType": "Pipeline", "configuration": {...}}]}
├── Bronze.Lakehouse/
├── Transform.Notebook/
└── parameter.yml                 # fabric-cicd only
```
- Invalid filename characters are HTML-number-escaped; a colliding name falls back to the logicalId.
- `logicalId` pairs the same item across workspaces/branches. Never edit it. When cloning a folder to make a *new* item, generate a new logicalId and a new displayName.
- `fab export <item> -o <dir>` and Git integration both emit this layout, and `fab import` / fabric-cicd / Bulk Import Item Definitions consume it.

---

## 2. How references get rebound

| Reference in pipeline JSON | Same workspace, via Git/deployment pipelines/fabric-cicd | Different workspace |
|---|---|---|
| `linkedService.typeProperties.workspaceId` = `00000000-0000-0000-0000-000000000000` + `artifactId` = logicalId (Lakehouse/Warehouse) | rebound automatically | parameterize |
| `TridentNotebook.notebookId` / `workspaceId` | rebound automatically (logicalId-based) | parameterize |
| `RefreshDataflow.dataflowId`, `PBISemanticModelRefresh.datasetId/groupId`, KQL `endpoint` | **not** rebound — parameterize | parameterize |
| `externalReferences.connection` GUIDs | never rebound; connections are not source-controlled | create connection per env, parameterize GUID |
| `InvokePipeline.pipelineId/workspaceId` | fabric-cicd detects pipeline→pipeline dependencies and orders deployment; ids rebound when same workspace | parameterize |
Parameterization options, in order of preference: **Variable Library** (`@pipeline().libraryVariables.X`, value set per environment), **fabric-cicd `parameter.yml`** (find/replace at deploy time), pipeline parameters with environment-specific schedules/triggers. Deployment pipelines have **no deployment rules for DataPipeline items**.

---

## 3. fabric-cicd

Microsoft-backed open-source library (`pip install fabric-cicd`, 1.4.x). Deploys a Git checkout into a workspace; items absent from the repo can be unpublished. Supported types include DataPipeline, Notebook, Lakehouse, Warehouse, Dataflow, VariableLibrary, SemanticModel, Report, Reflex, CopyJob, Environment, SparkJobDefinition, KQL*, Eventstream, Eventhouse, UserDataFunction, MirroredDatabase, etc.

```python
from azure.identity import ClientSecretCredential, AzureCliCredential
from fabric_cicd import FabricWorkspace, publish_all_items, unpublish_all_orphan_items, deploy_with_config

cred = ClientSecretCredential(tenant_id, client_id, client_secret)   # token_credential is REQUIRED (no DefaultAzureCredential fallback)
ws = FabricWorkspace(
    workspace_id="<target workspace id>",          # or workspace="<display name>"
    environment="test",                            # selects parameter.yml / variable-library value set
    repository_directory="./workspace",
    item_type_in_scope=["VariableLibrary", "Lakehouse", "Notebook", "DataPipeline"],
    token_credential=cred,
)
publish_all_items(ws)                 # lakehouses → notebooks → pipelines (pipeline→pipeline deps detected); variable libraries first
unpublish_all_orphan_items(ws, item_name_exclude_regex=r"^DEBUG.*")   # only on full deployments
```
Config-driven (`deploy.yml`):
```yaml
core:
  workspace_id: { test: "<guid>", prod: "<guid>" }
  repository_directory: "./workspace"
  item_types_in_scope: [VariableLibrary, Lakehouse, Notebook, DataPipeline]
  parameter: "parameter.yml"
publish:   { exclude_regex: "^(TEMP|DEBUG).*" }
unpublish: { skip: { prod: true } }
```
```python
deploy_with_config(token_credential=cred, config_file_path="cicd/deploy.yml", environment="test")
```
Or from the shell: `fab deploy --config deploy.yml --target_env test [--bulk_publish]`.

### parameter.yml
```yaml
find_replace:
  - find_value: "bfddf0b6-5b74-461a-a963-e89ddc32f852"       # DEV workspace id
    replace_value: { test: "$workspace.$id", prod: "$workspace.$id" }
  - find_value: "981f2f9a-0436-4942-b158-019bd73cdf1c"       # DEV lakehouse id
    replace_value: { test: "$items.Lakehouse.Bronze.$id", prod: "$items.Lakehouse.Bronze.$id" }
    item_type: "DataPipeline"
key_value_replace:
  - find_key: $.properties.activities[?(@.name=="Copy Data")].typeProperties.source.datasetSettings.externalReferences.connection
    replace_value: { test: "<test sql connection guid>", prod: "<prod sql connection guid>" }
    item_type: "DataPipeline"
    item_name: "Nightly Load"
  - find_key: $.properties.activities[?(@.name=="Refresh Staging DF")].typeProperties.dataflowId
    replace_value: { test: "$items.Dataflow.Staging.$id", prod: "$items.Dataflow.Staging.$id" }
    item_type: "DataPipeline"
  - find_key: $.schedules[?(@.jobType=="Pipeline")].enabled
    replace_value: { test: false, prod: true }
    item_type: "DataPipeline"
```
Dynamic tokens: `$workspace.$id`, `$workspace.<name>.$id`, `$items.<Type>.<Name>.$id`, `.$sqlendpoint`, `.$sqlendpointid`, `.$queryserviceuri`, `$ENV:<VAR>` (feature flag `enable_environment_variable_replacement`). Entry filters: `item_type`, `item_name`, `file_path`, `is_regex`, `ignore_case`; `_ALL_` applies to every environment. `.platform` files are never parameterized.

Rules: the deploying identity needs access to every referenced connection; connections themselves must pre-exist in each environment; Outlook/Teams activities need manual re-auth after deployment; deploying Dataflows with an SPN is unsupported.

---

## 4. Git integration REST APIs

`https://api.fabric.microsoft.com/v1/workspaces/{ws}/git/...` (SPN needs workspace **Admin**):

| Step | Call |
|---|---|
| Connect | `POST …/git/connect` `{ "gitProviderDetails": { "gitProviderType": "AzureDevOps", "organizationName", "projectName", "repositoryName", "branchName", "directoryName": "/workspace" }, "myGitCredentials": { "source": "ConfiguredConnection", "connectionId": "<id>" } }` |
| Credentials | `PATCH …/git/myGitCredentials` `{ "source": "ConfiguredConnection", "connectionId": "<id>" }` (or `{"source":"Automatic"}` for users) |
| Initialize | `POST …/git/initializeConnection` `{ "initializationStrategy": "PreferRemote" }` → `requiredAction`, `remoteCommitHash`, `workspaceHead` |
| Status | `GET …/git/status` |
| Commit | `POST …/git/commitToGit` `{ "mode": "All"|"Selective", "workspaceHead", "comment", "items": [...] }` → LRO |
| Update from Git | `POST …/git/updateFromGit` `{ "remoteCommitHash", "workspaceHead", "conflictResolution": { "conflictResolutionType": "Workspace", "conflictResolutionPolicy": "PreferRemote" }, "options": { "allowOverrideItems": true } }` → LRO |
| Disconnect | `POST …/git/disconnect` |
The Azure DevOps connection for an SPN: `POST /v1/connections` with `connectionDetails.type: "AzureDevOpsSourceControl"`, `creationMethod: "AzureDevOpsSourceControl.Contents"`, parameter `url`, and `credentialDetails.credentials.credentialType: "ServicePrincipal"` (+ `tenantId`, `servicePrincipalClientId`, `servicePrincipalSecret`). The SPN must be added to the ADO organization/project. GitHub connections use `GitHubSourceControl` + `credentialType: "Key"` (PAT). LRO polling: `GET /v1/operations/{id}`.

---

## 5. Deployment pipelines API

`https://api.fabric.microsoft.com/v1/deploymentPipelines`:
```http
POST /deploymentPipelines                                   # SPN needs the "create workspaces, connections, and deployment pipelines" tenant setting
POST /deploymentPipelines/{id}/stages/{stageId}/assignWorkspace   {"workspaceId": "..."}
POST /deploymentPipelines/{id}/roleAssignments               {"principal": {"id": "<spn>", "type": "ServicePrincipal"}, "role": "Admin"}
POST /deploymentPipelines/{id}/deploy
{ "sourceStageId": "...", "targetStageId": "...", "note": "release 2026.10",
  "items": [ { "sourceItemId": "<pipeline id>", "itemType": "DataPipeline" } ],   // optional: selective deploy
  "options": { "allowCreateArtifact": true, "allowOverwriteArtifact": true } }
→ 202, x-ms-operation-id, Retry-After → GET /v1/operations/{id} → /result (kept 24 h)
GET  /deploymentPipelines/{id}/operations[/{operationId}]
```
Limits: max 300 items per deployment; Dataflows unsupported; no deployment rules exist for DataPipeline items (use Variable Library or fabric-cicd for env-specific values); an SPN cannot configure OAuth credentials.

---

## 6. Variable Library

A `VariableLibrary` item holds variables with one value per **value set** (dev/test/prod). Pipelines reference them via `libraryVariables` + `@pipeline().libraryVariables.<alias>` (pipeline-json.md §7). The *active* value set is a workspace setting:
```http
PATCH /v1/workspaces/{ws}/variableLibraries/{id}
{ "properties": { "activeValueSetName": "prod" } }
```
fabric-cicd activates the set named after `environment` automatically; deployment pipelines copy the library but you set the active set per stage. Supported pipeline types: String, Integer, Boolean, DateTime, Guid; connection-reference and item-reference variables expose `.connectionId` / `.itemId` / `.workspaceId`. Microsoft's guidance: variable libraries first, parameter.yml second.

---

## 7. Terraform provider

`microsoft/fabric` (≥ 1.8; needs Terraform ≥ 1.8; Fabric trial capacity unsupported). Auth via `FABRIC_TENANT_ID`/`FABRIC_CLIENT_ID`/`FABRIC_CLIENT_SECRET`, or `FABRIC_USE_OIDC=true` (GitHub/ADO federated), `FABRIC_USE_MSI`, `FABRIC_USE_CLI`.
```terraform
terraform {
  required_providers { fabric = { source = "microsoft/fabric", version = "~> 1.8" } }
}
provider "fabric" {}   # reads FABRIC_* env vars

resource "fabric_data_pipeline" "nightly" {
  display_name = "Nightly Load"
  description  = "Loads dims nightly"
  workspace_id = fabric_workspace.dev.id
  folder_id    = null
  format       = "Default"
  definition = {
    "pipeline-content.json" = {
      source = "${path.module}/pipelines/nightly/pipeline-content.json.tmpl"
      tokens = { LakehouseId = fabric_lakehouse.bronze.id, SqlConnectionId = var.sql_connection_id }   # {{LakehouseId}} in the file
      # tokens_delimiter = "<<>>"   # alternatives: "@{}@", "____"
      # processing_mode = "Parameters"; parameters = [{ type = "JsonPathReplace", find = "$.properties.activities[0].name", value = "X" }]
    }
  }
  definition_update_enabled = true   # false = bootstrap once, then ignore drift
}
```
Import: `terraform import fabric_data_pipeline.nightly "<workspaceId>/<pipelineId>"`. Companion resources: `fabric_workspace`, `fabric_workspace_role_assignment`, `fabric_workspace_git`, `fabric_connection`, `fabric_lakehouse`, `fabric_notebook`, `fabric_variable_library`, `fabric_deployment_pipeline`. Terraform does not run pipelines or manage schedules; pair it with `fab job` / the REST script.

---

## 8. Workflow templates

### GitHub Actions — deploy with fabric-cicd (OIDC, no secret)
```yaml
name: deploy-fabric
on:
  push: { branches: [test, prod], paths: ["workspace/**"] }
  workflow_dispatch:
permissions: { id-token: write, contents: read }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name }}          # approvals per env
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - uses: azure/login@v2
        with: { client-id: ${{ secrets.AZURE_CLIENT_ID }}, tenant-id: ${{ secrets.AZURE_TENANT_ID }}, allow-no-subscriptions: true }
      - run: pip install fabric-cicd ms-fabric-cli
      - name: Deploy
        env: { TARGET_ENV: ${{ github.ref_name }} }
        run: |
          python - <<'EOF'
          import os
          from azure.identity import AzureCliCredential
          from fabric_cicd import deploy_with_config
          deploy_with_config(token_credential=AzureCliCredential(), config_file_path="cicd/deploy.yml", environment=os.environ["TARGET_ENV"])
          EOF
      - name: Smoke run
        run: |
          export FABRIC_TOKEN=$(az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv)
          python scripts/fabric_pipelines.py run --workspace "Sales-${{ github.ref_name }}" --pipeline "Nightly Load" --param RunDate=2026-10-14 --wait --timeout 1800
```
Federated credential on the app registration: issuer `https://token.actions.githubusercontent.com`, subject `repo:<org>/<repo>:environment:<env>` (or `:ref:refs/heads/<branch>`), audience `api://AzureADTokenExchange`. For `fab`: `fab auth login -u $CLIENT_ID --tenant $TENANT_ID --federated-token "$(curl -sH "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=api://AzureADTokenExchange" | jq -r .value)"` after `fab config set encryption_fallback_enabled true`.

### Azure DevOps — fabric-cicd with Key Vault-backed SPN
```yaml
trigger: { branches: { include: [test, prod] }, paths: { include: [workspace/**] } }
variables:
  - name: target_env
    value: ${{ replace(variables['Build.SourceBranch'], 'refs/heads/', '') }}
  - group: fabric-spn            # Key Vault-linked: aztenantid, azclientid, azspnsecret
stages:
  - stage: Deploy
    jobs:
      - deployment: DeployFabric
        environment: $(target_env)      # approval gate
        pool: { vmImage: ubuntu-latest }
        strategy:
          runOnce:
            deploy:
              steps:
                - checkout: self
                - task: UsePythonVersion@0
                  inputs: { versionSpec: "3.12" }
                - script: pip install fabric-cicd
                - task: PythonScript@0
                  inputs:
                    scriptSource: inline
                    script: |
                      import os
                      from azure.identity import ClientSecretCredential
                      from fabric_cicd import deploy_with_config
                      cred = ClientSecretCredential(os.environ["AZTENANTID"], os.environ["AZCLIENTID"], os.environ["AZSPNSECRET"])
                      deploy_with_config(token_credential=cred, config_file_path="cicd/deploy.yml", environment=os.environ["TARGET_ENV"])
                  env: { AZTENANTID: $(aztenantid), AZCLIENTID: $(azclientid), AZSPNSECRET: $(azspnsecret), TARGET_ENV: $(target_env) }
```
Secret-less alternative: `AzureCLI@2` with `addSpnToEnvironment: true` exposes `$idToken`; then `fab auth login -u $servicePrincipalId --tenant $tenantId --federated-token $idToken` or Terraform with `FABRIC_USE_OIDC`.

---

## 9. Recommended layout

- One workspace per environment; only **dev** is Git-connected; test/prod are deployment targets (fabric-cicd or deployment pipelines), so their state is whatever the last deployment put there.
- Keep pipelines environment-agnostic: all-zero `workspaceId` + logicalId `artifactId` for same-workspace Fabric items; Variable Library for everything else (connection ids, external workspace ids, dataflow ids, semantic model ids).
- Create connections per environment up front (REST `POST /v1/connections` or Terraform `fabric_connection`), grant the deploying/running SPN `User` on them.
- Deploy as the SPN so `LastModifiedBy` = SPN (run identity) and create schedules as the SPN (schedule owner), e.g. with `scripts/fabric_pipelines.py schedule-create` after deployment, or ship them in `.schedules` and flip `enabled` per environment.
- Add a post-deploy smoke run (`run --wait`) and fail the job on `Failed`/`Cancelled`/`Deduped`.
- Bulk promotions: `POST /v1/workspaces/{ws}/items/bulkImportDefinitions?beta=true` (and bulk export) with `definitionParts` paths like `/Nightly Load.DataPipeline/pipeline-content.json`; fabric-cicd `--bulk_publish` wraps this.

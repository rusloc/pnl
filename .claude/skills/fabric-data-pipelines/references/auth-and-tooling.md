# Authentication and tooling for Fabric Data Pipeline automation

Verified 2026-10-14 against Microsoft Learn, PyPI and the official GitHub repos.

## Contents
1. [Identity setup (service principal, tenant settings, workspace role)](#1-identity-setup)
2. [Getting a token: Python, Azure CLI, PowerShell, curl](#2-getting-a-token)
3. [Which tool when](#3-which-tool-when)
4. [Fabric CLI (`fab`)](#4-fabric-cli-fab)
5. [Python inside Fabric notebooks: sempy, sempy_labs, notebookutils](#5-python-inside-fabric-notebooks)
6. [Python outside Fabric: requests, msfabricpysdkcore, fabric-cicd](#6-python-outside-fabric)
7. [PowerShell: FabricTools and raw Invoke-RestMethod](#7-powershell)
8. [Service-principal limitations that bite pipelines](#8-service-principal-limitations)

---

## 1. Identity setup

The Fabric REST API accepts three identity kinds: **user** (delegated token with scopes), **service principal** (app-only token, `/.default`), **managed identity** (same as SPN). Unattended automation = SPN or MI.

### One-time setup for an SPN
1. **Entra app registration**: create an app (`az ad app create --display-name fabric-pipelines-bot`), create its service principal (`az ad sp create --id <appObjectId>`), add a client secret or certificate. Do **not** add API permissions/scopes and do **not** configure redirect URIs; app-only access is governed by Fabric, not by Entra consent.
2. **Fabric tenant settings** (Admin portal → Tenant settings → Developer settings):
   - **"Service principals can use Fabric APIs"** (a.k.a. "call Fabric public APIs") — required for all item/job APIs. On by default for new tenants, but usually scoped to a security group: put the SPN in that group. Allow a few minutes to propagate.
   - **"Service principals can create workspaces, connections, and deployment pipelines"** — off by default; needed only for `POST /workspaces`, `POST /connections`, `POST /deploymentPipelines`.
   - For Git automation also: "Users can sync workspace items with their Git repositories" (+ GitHub variant).
3. **Workspace role**: add the SPN as **Contributor** (create/update/run pipelines) or **Admin** (Git connect, role management). `POST /v1/workspaces/{ws}/roleAssignments {"principal":{"id":"<sp object id>","type":"ServicePrincipal"},"role":"Contributor"}`.
4. **Capacity**: the workspace must sit on a Fabric capacity (F/P SKU, not trial for Terraform; trial works for REST).
5. **Connections**: grant the SPN `User` (or higher) on every connection the pipelines reference (`POST /v1/connections/{id}/roleAssignments`).
6. **Make the SPN the run identity** of each pipeline: PATCH its description (or updateDefinition) as the SPN so `LastModifiedBy` = SPN; create schedules as the SPN.

Capture: tenant id, client (app) id, secret/cert. Store the secret in Key Vault / CI secret store.

---

## 2. Getting a token

| Flow | Scope / resource |
|---|---|
| SPN / MI (client credentials) | `https://api.fabric.microsoft.com/.default` |
| Delegated (user) | `https://api.fabric.microsoft.com/Item.ReadWrite.All https://api.fabric.microsoft.com/Item.Execute.All https://api.fabric.microsoft.com/Workspace.ReadWrite.All` |
| Azure CLI / Az PowerShell | resource `https://api.fabric.microsoft.com` |
| Legacy Power BI audience (also accepted) | `https://analysis.windows.net/powerbi/api/.default` |
Tokens last ~1 hour; refresh for long jobs.

### Python (`azure-identity`, recommended)
```python
from azure.identity import ClientSecretCredential, DefaultAzureCredential, AzureCliCredential, ManagedIdentityCredential, InteractiveBrowserCredential, DeviceCodeCredential
SCOPE = "https://api.fabric.microsoft.com/.default"
cred = ClientSecretCredential(tenant_id, client_id, client_secret)   # CI/CD
# cred = AzureCliCredential()               # local dev after `az login`
# cred = ManagedIdentityCredential()        # Azure VM / Function / self-hosted agent
# cred = DefaultAzureCredential()           # env vars AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET → MI → CLI → …
# cred = DeviceCodeCredential(tenant_id=tenant_id)   # headless delegated
token = cred.get_token(SCOPE).token
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
```
`scripts/fabric_pipelines.py` does exactly this (env `FABRIC_TOKEN` → `AZURE_*` SPN vars → `DefaultAzureCredential` → `az account get-access-token` fallback).

### Python (MSAL)
```python
import msal
app = msal.ConfidentialClientApplication(client_id, authority=f"https://login.microsoftonline.com/{tenant_id}", client_credential=client_secret)
res = app.acquire_token_for_client(scopes=["https://api.fabric.microsoft.com/.default"])
token = res["access_token"]   # else res["error_description"]
```
Interactive: `msal.PublicClientApplication(client_id, authority="https://login.microsoftonline.com/organizations").acquire_token_interactive(scopes=[...])`.

### curl (raw OAuth2)
```bash
curl -s -X POST "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
  -d grant_type=client_credentials -d client_id="$CLIENT_ID" -d client_secret="$CLIENT_SECRET" \
  -d scope=https://api.fabric.microsoft.com/.default | jq -r .access_token
```

### Azure CLI
```bash
az login                                                    # user, or:
az login --service-principal -u "$CLIENT_ID" -p "$CLIENT_SECRET" --tenant "$TENANT_ID" --allow-no-subscriptions
export FABRIC_TOKEN=$(az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv)
az rest --method get --resource https://api.fabric.microsoft.com --url https://api.fabric.microsoft.com/v1/workspaces   # az rest attaches the token itself
```

### PowerShell (Az.Accounts)
```powershell
Connect-AzAccount -ServicePrincipal -TenantId $tenantId -Credential (New-Object PSCredential($clientId, (ConvertTo-SecureString $secret -AsPlainText -Force)))
$secure = (Get-AzAccessToken -AsSecureString -ResourceUrl "https://api.fabric.microsoft.com").Token
$token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
```

---

## 3. Which tool when

| Situation | Use |
|---|---|
| Script from any machine / CI runner, full control | `requests` + `azure-identity` (`scripts/fabric_pipelines.py`) |
| One-off ops from a shell, humans + CI | **Fabric CLI** `fab` (GA, Microsoft-supported, open source) |
| Inside a Fabric notebook | `sempy.fabric.FabricRestClient` (auto-auth, retries, `lro_wait=True`); `sempy_labs` helpers |
| Deploy a whole workspace from Git to dev/test/prod | **fabric-cicd** (Microsoft-backed) or `fab deploy` |
| Declarative infra (workspaces, pipelines, connections, Git binding) | **Terraform provider `microsoft/fabric`** (`fabric_data_pipeline`) |
| Orchestrate from Airflow | `apache-airflow-microsoft-fabric-plugin` `FabricRunItemOperator(job_type="Pipeline")` |
| PowerShell shops | `FabricTools` for item CRUD + `Invoke-FabricRestMethod` / raw `Invoke-RestMethod` for jobs |
| From ADF / Logic Apps / Power Automate | HTTP/Web activity with managed identity against the Job Scheduler endpoint |
There is **no official Microsoft data-plane Python SDK** for workspaces/items/jobs (`azure-mgmt-fabric` only manages capacities; `microsoft-fabric-api` on PyPI is pre-release). `msfabricpysdkcore` is a solid community SDK.

---

## 4. Fabric CLI (`fab`)

```bash
pip install ms-fabric-cli            # 1.7.x GA; Python 3.10–3.13
fab auth login                                                       # interactive browser
fab auth login -u "$CLIENT_ID" -p "$CLIENT_SECRET" --tenant "$TENANT_ID"   # SPN secret
fab auth login -u "$CLIENT_ID" --certificate ./cert.pem --tenant "$TENANT_ID"
fab auth login -u "$CLIENT_ID" --federated-token "$ID_TOKEN" --tenant "$TENANT_ID"   # OIDC in GitHub/ADO
fab auth login --identity [-u <user-assigned-mi-client-id>]           # managed identity (Azure VM)
fab config set encryption_fallback_enabled true                       # headless agents without a keyring
fab auth status
```
Non-interactive env vars (use exactly one method): `FAB_TENANT_ID` + `FAB_SPN_CLIENT_ID` + (`FAB_SPN_CLIENT_SECRET` | `FAB_SPN_CERT_PATH`[+`FAB_SPN_CERT_PASSWORD`] | `FAB_SPN_FEDERATED_TOKEN`), or `FAB_MANAGED_IDENTITY=true`, or pre-acquired `FAB_TOKEN`.

Paths are `<workspace>.Workspace/<item>.<Type>`:
```bash
fab ls                                        # workspaces
fab ls "Dev.Workspace" -l                     # items, long listing
fab exists "Dev.Workspace/Nightly Load.DataPipeline"
fab get   "Dev.Workspace/Nightly Load.DataPipeline" -q definition        # definition (decoded)
fab set   "Dev.Workspace/Nightly Load.DataPipeline" -q description -i "Loads dims nightly"
fab mkdir "Dev.Workspace/New Pipe.DataPipeline"                          # empty pipeline
fab export "Dev.Workspace/Nightly Load.DataPipeline" -o ./out            # → ./out/Nightly Load.DataPipeline/{pipeline-content.json,.platform}
fab import "Test.Workspace/Nightly Load.DataPipeline" -i "./out/Nightly Load.DataPipeline"
fab cp "Dev.Workspace/Nightly Load.DataPipeline" "Test.Workspace"        # copy; fab mv to move
fab rm "Dev.Workspace/Old Pipe.DataPipeline" -f
fab job run / start / run-status / run-list / run-cancel / run-sch / run-update / run-rm   # see jobs-and-schedules.md §9
fab api workspaces/<ws>/items/<id>/jobs/Pipeline/instances -X post -i '{"executionData":{"parameters":{"RunDate":"2026-10-14"}}}' --show_headers
fab api workspaces/<ws>/dataPipelines/<id>/getDefinition -X post
fab deploy --config deploy.yml --target_env test   # fabric-cicd under the hood (v1.5+); --bulk_publish in 1.7
```
`--output_format json` (or `fab config set output_format json`) wraps results as `{"status","command","result":{"data":...}}`. Azure DevOps has a marketplace task `FabricCLITask@0` that installs `fab` on the agent.

---

## 5. Python inside Fabric notebooks

```python
import sempy.fabric as fabric
client = fabric.FabricRestClient()          # notebook identity; retries 429/502/503/504 (total=10, backoff=1)
ws = fabric.get_workspace_id()
r = client.post(f"v1/workspaces/{ws}/dataPipelines", json=payload, lro_wait=True)   # lro_wait follows 202 for you
pipeline_id = r.json()["id"]
```
Paths are relative to `https://api.fabric.microsoft.com/`. For SPN auth inside a notebook: `fabric.FabricRestClient(credential=ClientSecretCredential(...))` or `with sempy.fabric.set_service_principal(tenant_id, client_id, client_secret=...): ...` (sempy ≥ 0.12). `notebookutils.credentials.getToken("pbi")` also yields a usable bearer token for `requests`, but with reduced scopes when the notebook itself runs under an SPN.

`semantic-link-labs` (`%pip install semantic-link-labs`; Fabric-only):
```python
import sempy_labs as labs
labs.list_data_pipelines(workspace="Dev")
labs.create_data_pipeline("Nightly Load", description="...", workspace="Dev")   # empty pipeline only
labs.get_data_pipeline_definition("Nightly Load", workspace="Dev", decode=True)  # → dict
labs.delete_data_pipeline("Nightly Load", workspace="Dev")
labs.run_on_demand_item_job(item="Nightly Load", type="DataPipeline", job_type="Pipeline", workspace="Dev")   # no parameters support
labs.list_item_job_instances("Nightly Load", type="DataPipeline", workspace="Dev")
labs.create_item_schedule_daily("Nightly Load", type="DataPipeline", job_type="Pipeline", start_date_time="2026-10-15T00:00:00",
                                end_date_time="2099-01-01T00:00:00", local_time_zone="UTC", times=["06:00"], workspace="Dev")
labs.cancel_item_job_instance("Nightly Load", job_instance_id=..., type="DataPipeline", workspace="Dev")
```
Always pass `job_type="Pipeline"`; the default `DefaultJob` is wrong for pipelines. No `update_data_pipeline_definition` helper: use `FabricRestClient` for that.

---

## 6. Python outside Fabric

### `requests` + `azure-identity`
Use `scripts/fabric_pipelines.py` (CLI + importable class). It handles token acquisition, 429 (`RequestBlocked` vs `CapacityLimitExceeded`), LRO polling, pagination, name→id resolution, idempotent create-or-update, run/wait/cancel, schedules and activity-run queries. `pip install requests azure-identity`.

### `msfabricpysdkcore` (community, actively maintained)
```python
from msfabricpysdkcore import FabricClientCore
fc = FabricClientCore(tenant_id=..., client_id=..., client_secret=...)   # or env FABRIC_TENANT_ID/FABRIC_CLIENT_ID/FABRIC_CLIENT_SECRET, or az login
fc.list_data_pipelines(workspace_id=ws)
item = fc.create_data_pipeline(workspace_id=ws, display_name="Nightly Load", definition=definition)   # definition = {"parts": [...]}
fc.get_data_pipeline_definition(workspace_id=ws, data_pipeline_id=item.id)
fc.update_data_pipeline_definition(workspace_id=ws, data_pipeline_id=item.id, definition=definition)
fc.run_on_demand_item_job(workspace_id=ws, item_id=item.id, job_type="Pipeline", execution_data={"parameters": {"RunDate": "2026-10-14"}})
fc.get_item_job_instance(workspace_id=ws, item_id=item.id, job_instance_id=job_id)
fc.create_item_schedule(workspace_id=ws, item_id=item.id, job_type="Pipeline", configuration={...}, enabled=True)
```

### `fabric-cicd` (deployment only; see `cicd.md`)
`token_credential` is **required** (the `DefaultAzureCredential` fallback was removed in 1.x). Deploys `*.DataPipeline/` folders from a Git checkout into a target workspace with per-environment find/replace.

---

## 7. PowerShell

**FabricTools** (`Install-Module FabricTools`; community, preview): `Connect-FabricAccount -TenantId … -ServicePrincipalId … -ServicePrincipalSecret (SecureString)`, `Get-/New-/Update-/Remove-FabricDataPipeline`, `Get-FabricItem`, `Export-FabricItem`, `Import-FabricItem`, deployment-pipeline cmdlets, and the generic `Invoke-FabricRestMethod -Uri "workspaces/$ws/items/$id/jobs/Pipeline/instances" -Method POST -Body @{ executionData = @{ parameters = @{ RunDate = "2026-10-14" } } }` (handles pagination, LRO and 429). No definition / job / schedule cmdlets as of 0.32 — use `Invoke-FabricRestMethod`.

Raw pattern:
```powershell
$base = "https://api.fabric.microsoft.com/v1"
$body = @{ executionData = @{ parameters = @{ RunDate = "2026-10-14" } } } | ConvertTo-Json -Depth 5
$resp = Invoke-WebRequest -Headers $headers -Uri "$base/workspaces/$ws/items/$pipe/jobs/Pipeline/instances" -Method POST -Body $body
$statusUrl = $resp.Headers['Location']; $wait = [int]($resp.Headers['Retry-After'] | Select-Object -First 1)
do { Start-Sleep -Seconds $wait; $job = Invoke-RestMethod -Headers $headers -Uri $statusUrl } while ($job.status -in 'NotStarted','InProgress')
if ($job.status -ne 'Completed') { throw "Run $($job.id) ended $($job.status): $($job.failureReason | ConvertTo-Json -Depth 5)" }
```

---

## 8. Service-principal limitations

- A pipeline **runs as its LastModifiedBy** identity; a scheduled run as the schedule's creator/last updater. Notebook activities inside run as the pipeline's LastModifiedBy, not the notebook owner. PATCH the pipeline as the SPN to take ownership after every user edit (or make the SPN the only writer in prod).
- No background token refresh for pipelines: after rotating the SPN secret, re-save the pipeline (a description PATCH suffices) so a fresh token is cached.
- OAuth connectors (Outlook, Teams, some SaaS) cannot be authenticated by an SPN; those activities need a user to sign in after deployment.
- Deploying Dataflow Gen2 items with an SPN is unsupported; pipelines that refresh dataflows keep pointing at the source workspace's dataflow unless parameterized.
- SPN as *data-source* credential inside a connection is supported for ADLS Gen2, Blob, Azure SQL, Synapse, Dataverse, Web, Databricks and similar; not for everything.
- Git APIs: Azure DevOps works with an SPN via a configured connection (`credentialType: ServicePrincipal`); GitHub needs a PAT-based connection.
- Job Scheduler per-identity limits: 100 submissions/min, 100 get-job/min; 100 concurrent jobs per item.
- Semantic-link under SPN cannot touch "My workspace"; `notebookutils.credentials.getToken("pbi")` under SPN returns a reduced-scope token (use MSAL instead).
- Trial capacity is not supported by the Terraform provider.

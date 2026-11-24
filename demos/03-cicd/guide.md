# Guide · Case 3 · Fabric CI/CD: manual publish to one-click deployment

USER click guide for rehearsal and recording. Spec: `.log/reports/Spec 3 · Fabric CI CD demo manual publish to one-click deployment.md`. Decisions: ADR-0018 (g: GitHub instead of Azure DevOps; h: Part C not built; amendment 2026-11-24: measure names; amendment 2: Dev → Prod only, no Test stage). IDs and measured numbers: `run_log.md` in this folder.

## 1. Prerequisites still open

- [ ] **GitHub repo `rusloc/fabric-cicd-demo`** with a README, so branch `main` exists (github.com › New repository › name `fabric-cicd-demo` › tick *Add a README file* › Create).
- [ ] **Tenant setting** "Users can export items to Git repositories in other geographical locations": currently **off** (`run_log.md` › Environment). Fabric can refuse the GitHub connection while it is off; if it does: Admin portal › Tenant settings › Git integration › turn it on (tenant admin), then retry.
- [ ] A GitHub credential for Fabric: a fine-grained personal access token on `rusloc/fabric-cicd-demo` with **Contents: Read and write**.
- [x] Deployment pipeline `dp_cicd_demo` with two stages, Development and Production, both assigned; Prod deployed and seeded (`run_log.md`).
- [ ] **Parameter rules on the Production stage** (spec § 7 step 5): no API exists, the model owner (you) sets them: Deployment pipelines › `dp_cicd_demo` › **Production** stage › **Deployment rules** › `Sales CICD` (semantic model) › **Parameter rules** › **+ Add rule** `WorkspaceId` and **+ Add rule** `LakehouseId`, values in `run_log.md` › Deployment pipeline › Production rules › **Save**. Then ginee redeploys, reframes and checks Environment Name (fx) = `ws_cicd_demo_prod`.

## 2. What is already built

| Item | State | Differs from the spec |
|---|---|---|
| `ws_cicd_demo_dev`, `ws_cicd_demo_prod` | created | no Test workspace (amendment 2) |
| `lh_cicd_demo` + `nb_seed_sales` in Dev | seeded: 1 / 365 / 50 / 50,000 rows, environment `ws_cicd_demo_dev` | — |
| `Sales CICD` model (Dev) | Direct Lake on OneLake, `WorkspaceId` / `LakehouseId` M parameters, framed | measures in `_Measures`, names end in " (fx)" (ADR-0018 amendment) |
| `Sales CICD` report (Dev) | **published by API** (bound by connection), not from Desktop: spec § 6 step 6 is done | no manual publish needed |
| `dp_cicd_demo` | stages Development → Production; Prod holds the 4 items (paired with Dev), Prod lakehouse seeded with environment `ws_cicd_demo_prod` | two stages, not three (amendment 2) |
| PBIP source | `pbi/Sales CICD/` in this repo | GitHub `rusloc/fabric-cicd-demo` holds what Fabric commits, separately |

Today's Dev values: **Margin % (fx)** 66.7 % (0.66667), **Environment Name (fx)** `ws_cicd_demo_dev`, **Sales Amount (fx)** $39,693,347 (`run_log.md` › Model and report in Dev).

Measures: `Sales Amount (fx)`, `Cost Amount (fx)`, `Margin (fx)`, `Margin % (fx)` (wrong on purpose: divides by cost), `Environment Name (fx)`.

## 3. Steps the video relies on that you do once (spec § 6 steps 7–9, before § 9)

1. `ws_cicd_demo_dev` › Workspace settings › **Git integration** › **GitHub** › Add account: display name, the token from section 1, repository URL `https://github.com/rusloc/fabric-cicd-demo` › Add › **Connect**.
2. Branch `main`, Git folder `workspace` › **Connect and sync**.
3. Workspace › **Source control** › Changes › select all four items (`lh_cicd_demo`, `nb_seed_sales`, `Sales CICD` semantic model, `Sales CICD` report) › message `Initial commit: lakehouse, notebook, model, report` › **Commit**.
4. GitHub › `workspace/` holds four item folders; `Sales CICD.SemanticModel/definition/` holds TMDL text files (the measures in `tables/_Measures.tmdl`). Tell ginee: the pipeline checks (§ 7) start after this.

Desktop live edit of the model (spec § 2 step 1) needs XMLA Read Write on capacity `issglobalfabric` (Admin portal › Capacity settings › Power BI workloads › XMLA Endpoint). The recording uses the browser (**Open data model**), which does not.

## 4. Recording run (spec § 9 with the real names)

**Off camera**
1. Four browser tabs: Dev and Prod reports `Sales CICD`; Deployment pipelines › `dp_cicd_demo`; `https://github.com/rusloc/fabric-cicd-demo/commits/main`.
2. Both reports: **Margin % (fx)** 66.7 % and their own **Environment Name (fx)** (`ws_cicd_demo_dev` / `ws_cicd_demo_prod`).
3. For the opening shot, Desktop with a local PBIX open, e.g. `Sales Import.pbix` from Case 1.

**On camera**
1. Desktop › Home › **Publish** › pick `ws_migration_demo` › the "Replace this semantic model?" prompt appears › **Cancel**. Nothing is published. (Never press Replace: it overwrites the Case 1 model.)
2. `ws_cicd_demo_dev` › `Sales CICD` (semantic model) › **Open data model** › switch Viewing → **Editing** › Data pane › `_Measures` › **Margin % (fx)** › formula bar:
   ```dax
   Margin % (fx) = DIVIDE ( [Margin (fx)], [Sales Amount (fx)] )
   ```
   › Enter. The Dev report card drops to **40.0 %** (0.40000 on the seed data).
3. Workspace › **Source control** › one changed item: `Sales CICD` (semantic model) › message `Fix Margin %: divide by sales, not cost` › **Commit**.
4. GitHub › the new commit › diff: one changed line in `workspace/Sales CICD.SemanticModel/definition/tables/_Measures.tmdl`.
5. Deployment pipelines › `dp_cicd_demo` › Production stage: `Sales CICD` marked different from source › select it › **Deploy** › note `Margin % fix` › Deploy.
6. Prod report › Refresh: Margin % (fx) 40.0 %, Environment Name (fx) `ws_cicd_demo_prod`.
7. Pipeline › **Deployment history** next to the GitHub commit list.

**Reset for another take** (spec § 9): Dev › Open data model › Editing › `Margin % (fx)`:
```dax
Margin % (fx) = DIVIDE ( [Margin (fx)], [Cost Amount (fx)] )
```
› Source control › commit `Revert Margin % for demo` › Deploy to Production. A measure-only change needs no model refresh in Prod.

Log the seconds each deployment took in `run_log.md`.

## 5. Acceptance checklist (spec § 10)

| # | Check | State | Evidence |
|---|---|---|---|
| 1 | Repo `workspace/` holds four item folders, model as TMDL | pending (section 3) | GitHub, `run_log.md` |
| 2 | Each stage's Environment card shows its own workspace (Dev and Prod) | Dev **done**; Prod pending (Production rules) | `run_log.md` |
| 3 | § 7 step 3 checkpoint: the report deploys through the pipeline | **done**: the PBIR report deployed and bound to the target model | `run_log.md` |
| 4 | Editing Margin % (fx) gives one changed item in Source control and one "different" item in the pipeline | pending | rehearsal |
| 5 | Commit diff shows the measure change and nothing else | pending | GitHub commit |
| 6 | After each Deploy the target report shows the new Margin % (fx) with no republish and no manual edit | pending | rehearsal |
| 7 | Prod Environment card unchanged after deployment (parameter rules held) | pending | rehearsal |
| 8 | Deployment history lists every deployment with its note | pending | pipeline history |
| 9 | Change-and-revert loop ran twice with no manual fix-up | pending | `run_log.md` |
| 10 | `run_log.md` holds workspace, lakehouse and pipeline IDs, run date, seconds per deployment | partial: IDs, run date and the first deployments done; recording-run seconds pending | `run_log.md` |
| 11 | Part C: a run Development → Production succeeds and shows in Deployment history | not built (ADR-0018 h) | — |

## 6. Part C recipe: deploy from GitHub Actions (untested recipe, not built)

Replaces the Deploy click with a GitHub Actions run that calls the same deployment pipeline through the Fabric REST API. Nothing here was run against Fabric or GitHub; ADR-0018 h keeps it as a recipe.

**Prerequisites**
1. Microsoft Entra app registration with a client secret.
2. Tenant setting **Service principals can use Fabric APIs** enabled for it (tenant admin).
3. The service principal as Contributor or higher on the two workspaces and as admin on `dp_cicd_demo`.
4. In `rusloc/fabric-cicd-demo` › Settings › Secrets and variables › Actions: secrets `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET`; variable `DEPLOYMENT_PIPELINE_ID` (from `run_log.md`).
5. For an approval on Production: Settings › Environments › `Production` › Required reviewers (needs a public repo or a paid GitHub plan).
6. Do the first deployment to each stage by hand (part B), so you own the models and their rules.

**Files** at the repo root, outside `workspace/` so Fabric's Git sync ignores them.

`.github/workflows/deploy-stage.yml`
```yaml
name: Deploy Fabric stage
on:
  workflow_dispatch:
    inputs:
      source:
        description: Source stage display name
        default: Development
        required: true
      target:
        description: Target stage display name
        default: Production
        required: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.target }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install requests azure-identity
      - name: Deploy ${{ inputs.source }} to ${{ inputs.target }}
        run: >
          python scripts/deploy_stage.py
          --source "${{ inputs.source }}"
          --target "${{ inputs.target }}"
          --note "GitHub Actions run ${{ github.run_number }}"
        env:
          FABRIC_TENANT_ID: ${{ secrets.FABRIC_TENANT_ID }}
          FABRIC_CLIENT_ID: ${{ secrets.FABRIC_CLIENT_ID }}
          FABRIC_CLIENT_SECRET: ${{ secrets.FABRIC_CLIENT_SECRET }}
          DEPLOYMENT_PIPELINE_ID: ${{ vars.DEPLOYMENT_PIPELINE_ID }}
```

`scripts/deploy_stage.py` (spec § 8, unchanged)
```python
"""Deploy one stage of a Fabric deployment pipeline to the next stage and wait for the result."""
import argparse
import os
import sys
import time

import requests
from azure.identity import ClientSecretCredential

API = "https://api.fabric.microsoft.com/v1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Source stage display name, for example Development")
    parser.add_argument("--target", required=True, help="Target stage display name, for example Test")
    parser.add_argument("--note", default="Deployed from Azure DevOps")
    args = parser.parse_args()

    credential = ClientSecretCredential(
        os.environ["FABRIC_TENANT_ID"], os.environ["FABRIC_CLIENT_ID"], os.environ["FABRIC_CLIENT_SECRET"]
    )
    token = credential.get_token("https://api.fabric.microsoft.com/.default").token
    headers = {"Authorization": f"Bearer {token}"}
    pipeline_id = os.environ["DEPLOYMENT_PIPELINE_ID"]

    stages = requests.get(f"{API}/deploymentPipelines/{pipeline_id}/stages", headers=headers, timeout=60)
    stages.raise_for_status()
    stage_ids = {stage["displayName"]: stage["id"] for stage in stages.json()["value"]}

    body = {
        "sourceStageId": stage_ids[args.source],
        "targetStageId": stage_ids[args.target],
        "note": args.note[:1024],
    }
    response = requests.post(f"{API}/deploymentPipelines/{pipeline_id}/deploy", headers=headers, json=body, timeout=60)
    response.raise_for_status()
    if response.status_code == 200:
        print("Deployment finished:", response.json().get("status"))
        return

    operation_url = response.headers["Location"]
    wait_seconds = int(response.headers.get("Retry-After", 30))
    while True:
        time.sleep(wait_seconds)
        state = requests.get(operation_url, headers=headers, timeout=60)
        state.raise_for_status()
        status = state.json().get("status")
        print("Deployment status:", status)
        if status == "Succeeded":
            return
        if status == "Failed":
            print(state.json().get("error"))
            sys.exit(1)


if __name__ == "__main__":
    main()
```

**Run:** GitHub › Actions › Deploy Fabric stage › Run workflow › Development → Production.

**Caveats (spec § 8):** the API takes a service principal only when every item in the deployment supports one (`PrincipalTypeNotSupported` → run the script as a user); at most 300 items per deployment. The alternative without a deployment pipeline is Microsoft's `fabric-cicd` library (Git-based deployment, `parameter.yml` for workspace IDs).

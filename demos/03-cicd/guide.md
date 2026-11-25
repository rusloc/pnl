# Guide · Case 3 · Fabric CI/CD: manual publish to one-click deployment

USER click guide for rehearsal and recording. Spec: `.log/reports/Spec 3 · Fabric CI CD demo manual publish to one-click deployment.md`. Decisions: ADR-0018 (g: GitHub instead of Azure DevOps; h: Part C not built; amendment 2026-11-24: measure names; amendment 2: Dev → Prod only, no Test stage; amendment 4: Git is the source, item folders at the repo root). IDs and measured numbers: `run_log.md` in this folder.

The change starts in Git, not in Fabric (amendment 4): local edit in VS Code → commit + push to GitHub → Fabric Dev pulls it (Source control › Updates) → pipeline Dev → Prod.

## 1. Prerequisites

- [x] **GitHub repo `rusloc/fabric-cicd-demo`**, public, branch `main` (commit `readme`, 2026-11-24 16:45 UTC).
- [x] **Token for Fabric**: fine-grained personal access token, this repo only, **Contents: Read and write** (+ Metadata: Read). It lives in Fabric's GitHub connection only, never in a repo file.
- [x] **Dev connected to Git** (USER, 2026-11-24): `ws_cicd_demo_dev` › Workspace settings › Git integration › GitHub › branch `main`, **Git folder left blank**, so the item folders sit at the repo root. Fabric made the first commit itself on connect (16:46 UTC, `run_log.md` › Git integration); no manual Source control commit.
- [x] Tenant setting "Users can export items to Git repositories in other geographical locations": not needed, the connect succeeded with the setting last read **off** (`run_log.md` › Environment).
- [x] Deployment pipeline `dp_cicd_demo` with two stages, Development and Production, both assigned; Prod deployed and seeded (`run_log.md`).
- [x] **Parameter rules on the Production stage** (USER, 2026-11-24; applied by deployment 2, `run_log.md`): `WorkspaceId` and `LakehouseId` = the Prod IDs. Prod Environment Name (fx) = `ws_cicd_demo_prod`.
- [x] XMLA Read Write on capacity `issglobalfabric` (USER, 2026-11-24). This case's flow does not need it any more (no Desktop live edit).
- [x] **Local clone** at `C:\__PBI\fabric-cicd-demo` (USER, 2026-11-24): a sibling of `C:\__PBI\PNL`, its own git repo. This repo manages its files from the session; you run its git commands.

## 2. What is already built

| Item | State | Differs from the spec |
|---|---|---|
| `ws_cicd_demo_dev`, `ws_cicd_demo_prod` | created | no Test workspace (amendment 2) |
| `lh_cicd_demo` + `nb_seed_sales` in Dev | seeded: 1 / 365 / 50 / 50,000 rows, environment `ws_cicd_demo_dev` | — |
| `Sales CICD` model (Dev) | Direct Lake on OneLake, `WorkspaceId` / `LakehouseId` M parameters, framed | measures in `_Measures`, names end in " (fx)" (ADR-0018 amendment) |
| `Sales CICD` report (Dev) | **published by API** (bound by connection), not from Desktop: spec § 6 step 6 is done | no manual publish needed |
| `dp_cicd_demo` | stages Development → Production; Prod holds the 4 items (paired with Dev), Prod lakehouse seeded with environment `ws_cicd_demo_prod` | two stages, not three (amendment 2) |
| GitHub `rusloc/fabric-cicd-demo` | Dev connected; repo root holds `Sales CICD.SemanticModel`, `Sales CICD.Report`, `lh_cicd_demo.Lakehouse`, `nb_seed_sales.Notebook`, `README.md` | GitHub, not Azure DevOps (g); no `workspace` folder, first commit by Fabric (amendment 4) |
| Live demo repo | local clone `C:\__PBI\fabric-cicd-demo`, sibling of this repo, its own git repo; you run its git commands | edit happens here, not in the browser (amendment 4) |
| PBIP source | `pbi/Sales CICD/` in this repo: build source and backup | not synced with the live demo repo; a change in one is not in the other |

Today's Dev values: **Margin % (fx)** 66.7 % (0.66667), **Environment Name (fx)** `ws_cicd_demo_dev`, **Sales Amount (fx)** $39,693,347 (`run_log.md` › Model and report in Dev).

Measures: `Sales Amount (fx)`, `Cost Amount (fx)`, `Margin (fx)`, `Margin % (fx)` (wrong on purpose: divides by cost), `Environment Name (fx)`.

## 3. Set-up you do once (before the first rehearsal)

The clone exists (`C:\__PBI\fabric-cicd-demo`, section 1). The git commands below run from any folder: `git -C` names the clone.

1. Open it in VS Code as its own window, so the Source Control panel shows the demo repo only: `code "C:\__PBI\fabric-cicd-demo"` (or File › Open Folder).
2. Check the clone:
   ```bash
   git -C "C:/__PBI/fabric-cicd-demo" log --oneline
   ```
   Two commits: `Committing 4 items from workspace …` (Fabric, `8f05927`) and `readme`. The root holds the four item folders and `README.md`.
3. Open `Sales CICD.SemanticModel/definition/tables/_Measures.tmdl`. The line to edit:
   ```dax
   measure 'Margin % (fx)' = DIVIDE ( [Margin (fx)], [Cost Amount (fx)] )
   ```
   Format string `0.0%;-0.0%;0.0%` stays as is.
4. Push sign-in: `git push` uses your own GitHub sign-in (Git Credential Manager pops up once), not Fabric's token.

Why Fabric made the first commit: on connect it writes a `.platform` file with a `logicalId` into every item folder. Pushing the local PBIP first would have created items that clash with the existing workspace items. Never edit the `.platform` files.

On camera, blur: the commit message `Committing 4 items from workspace <Dev workspace ID>`, the tenant and account names. The model's `definition/expressions.tmdl` in the public repo carries the Dev workspace and lakehouse IDs as `WorkspaceId` / `LakehouseId` values: do not open it on camera.

## 4. Recording run (spec § 9 with the real names, amendment 4 flow)

**Off camera**
1. Windows and tabs: VS Code on the live repo with `_Measures.tmdl` open at the Margin % line; `https://github.com/rusloc/fabric-cicd-demo/commits/main`; `ws_cicd_demo_dev` › **Source control** pane; Deployment pipelines › `dp_cicd_demo`; the Dev and Prod reports `Sales CICD`.
2. Both reports: **Margin % (fx)** 66.7 % and their own **Environment Name (fx)** (`ws_cicd_demo_dev` / `ws_cicd_demo_prod`).
3. Clean start: Dev Source control shows nothing under Changes or Updates; `git -C "C:/__PBI/fabric-cicd-demo" status` is clean and `git -C "C:/__PBI/fabric-cicd-demo" pull` says up to date.
4. For the opening shot, Desktop with a local PBIX open, e.g. `Sales Import.pbix` from Case 1.

**On camera**
1. Desktop › Home › **Publish** › pick `ws_migration_demo` › the "Replace this semantic model?" prompt appears › **Cancel**. Nothing is published. (Never press Replace: it overwrites the Case 1 model.)
2. VS Code › `_Measures.tmdl` › Margin % line: `[Cost Amount (fx)]` → `[Sales Amount (fx)]` › Ctrl+S.
   ```dax
   measure 'Margin % (fx)' = DIVIDE ( [Margin (fx)], [Sales Amount (fx)] )
   ```
3. Commit `Margin % fix` and push (VS Code Source Control: message › Commit › Sync Changes, or the terminal):
   ```bash
   git -C "C:/__PBI/fabric-cicd-demo" diff --stat
   git -C "C:/__PBI/fabric-cicd-demo" add "Sales CICD.SemanticModel/definition/tables/_Measures.tmdl"
   git -C "C:/__PBI/fabric-cicd-demo" commit -m "Margin % fix"
   git -C "C:/__PBI/fabric-cicd-demo" push
   ```
   `diff --stat` must read `1 file changed, 1 insertion(+), 1 deletion(-)`; anything more (line endings, a final newline added by the editor) breaks check 5: undo it before the commit. The clone's files are CRLF; keep VS Code on CRLF for them (status bar).
4. GitHub › commits › `Margin % fix` › diff: one changed line in `Sales CICD.SemanticModel/definition/tables/_Measures.tmdl`.
5. `ws_cicd_demo_dev` › **Source control** › **Updates**: one incoming item, `Sales CICD` (semantic model) › **Update all**. Wait until it reports done.
6. Dev report › Refresh: Margin % (fx) **40.0 %** (0.40000 on the seed data), Environment Name (fx) `ws_cicd_demo_dev`.
7. Deployment pipelines › `dp_cicd_demo` › Production stage: `Sales CICD` marked different from source › select it › **Deploy** › note `Margin % fix` › Deploy.
8. Prod report › Refresh: Margin % (fx) 40.0 %, Environment Name (fx) `ws_cicd_demo_prod`.
9. Pipeline › **Deployment history** next to the GitHub commit list.

**Reset for another take** (spec § 9, the same path backwards): VS Code › Margin % line back to
```dax
measure 'Margin % (fx)' = DIVIDE ( [Margin (fx)], [Cost Amount (fx)] )
```
› Ctrl+S, then
```bash
git -C "C:/__PBI/fabric-cicd-demo" diff --stat
git -C "C:/__PBI/fabric-cicd-demo" add "Sales CICD.SemanticModel/definition/tables/_Measures.tmdl"
git -C "C:/__PBI/fabric-cicd-demo" commit -m "Revert Margin % for demo"
git -C "C:/__PBI/fabric-cicd-demo" push
```
› Dev Source control › Updates › **Update all** › pipeline **Deploy** to Production, note `Revert Margin % for demo`. Both reports back to 66.7 %.

**Rules**
- Never edit the model in Fabric (Open data model, Desktop live edit) between takes: Dev then holds an uncommitted change, and Update all runs into a conflict. Every change goes local edit → push → Update all.
- Update all before Deploy: the pipeline deploys what Dev holds, not what GitHub holds.
- A measure-only change needs no reframe, neither in Dev after Update all nor in Prod after Deploy.
- A take ends clean: Dev Source control empty, local `git status` clean. If a push is rejected, something else wrote to `main`: `git -C "C:/__PBI/fabric-cicd-demo" pull`, then push again.

**Optional variant: feature branch + pull request** (spec § 2 leaves it out of the 2-minute cut). Dev follows `main`, so it sees the change only after the merge:
```bash
git -C "C:/__PBI/fabric-cicd-demo" switch -c fix/margin-pct
git -C "C:/__PBI/fabric-cicd-demo" add "Sales CICD.SemanticModel/definition/tables/_Measures.tmdl"
git -C "C:/__PBI/fabric-cicd-demo" commit -m "Margin % fix"
git -C "C:/__PBI/fabric-cicd-demo" push -u origin fix/margin-pct
```
(edit and save before the `add`) › GitHub › **Compare & pull request** › Files changed: the one line › **Merge pull request** › then steps 5–9 above. Afterwards:
```bash
git -C "C:/__PBI/fabric-cicd-demo" switch main
git -C "C:/__PBI/fabric-cicd-demo" pull
git -C "C:/__PBI/fabric-cicd-demo" branch -d fix/margin-pct
```

Log the seconds of each Update all and each deployment in `run_log.md`.

## 5. Acceptance checklist (spec § 10, amendment 4 wording)

| # | Check | State | Evidence |
|---|---|---|---|
| 1 | Repo root holds four item folders, model as TMDL | **done** (Fabric commit `8f05927`, 2026-11-24 16:46 UTC) | GitHub, `run_log.md` › Git integration |
| 2 | Each stage's Environment card shows its own workspace (Dev and Prod) | **done** (Dev `ws_cicd_demo_dev`, Prod `ws_cicd_demo_prod`, 2026-11-24) | `run_log.md` › After deployment 2 |
| 3 | § 7 step 3 checkpoint: the report deploys through the pipeline | **done**: the PBIR report deployed and bound to the target model | `run_log.md` |
| 4 | A pushed Margin % (fx) edit gives one incoming change under Source control › Updates in Dev and one "different" item in the pipeline | pending | rehearsal |
| 5 | GitHub commit diff = the local one-line change, nothing else | pending | GitHub commit |
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
5. For an approval on Production: Settings › Environments › `Production` › Required reviewers (available: the repo is public).
6. Do the first deployment to each stage by hand (part B), so you own the models and their rules.

**Files** at the repo root beside the item folders: `.github/workflows/deploy-stage.yml` and `scripts/deploy_stage.py`. Fabric's Git sync only picks up item folders (those with a `.platform` file) and ignores the rest, so these never show under Updates. Add them in the clone and push them like any other change.

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

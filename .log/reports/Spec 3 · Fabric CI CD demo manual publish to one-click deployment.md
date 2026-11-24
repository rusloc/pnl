# Spec 3 · Fabric CI/CD demo: manual publish to one-click deployment

Nov 23, 2026 · @KIRILL

Set up three workspaces, one Git repo and one deployment pipeline so that a measure change made in Power BI Desktop reaches Prod through a commit and one Deploy click, with no manual Publish.

## 1. Storyline

The video follows one small fix, a wrong Margin % formula, from the Dev workspace to Prod. Nobody presses Publish, every step leaves a record, and each environment keeps reading its own data.

| Time | On screen | Voice-over point |
| --- | --- | --- |
| 0:00 | Power BI Desktop, Publish, "Replace this semantic model?" on a production workspace | How most teams ship today: one click, no test, no history |
| 0:15 | Dev workspace. Open the model, fix Margin %. Source control shows 1 change | The change is tracked the moment it is made |
| 0:35 | Commit with a message. Azure DevOps shows the diff: one line of DAX | Readable history, and a way back |
| 0:55 | Deployment pipeline: Test is marked different from Dev. Select Deploy | One click moves it to Test |
| 1:15 | Test report: Margin % changed, Environment card says test | Test reads test data, not dev data |
| 1:30 | Deploy to Production. Prod report updates | Same click, same result |
| 1:50 | Deployment history and the Git log, side by side | Who changed what, when, and where it went |
| 2:05 | Closing card | CI/CD setup, 1 week, $1,200 |

## 2. Target setup

A change takes four steps to reach Prod, and only the first one involves editing anything.

1. **Edit in Dev.** The developer changes the model in `ws_cicd_demo_dev`, in Power BI Desktop live edit or in the browser.
2. **Commit.** The Dev workspace is connected to the `main` branch of an Azure DevOps repo. Source control in the workspace commits the change; the repo keeps the history and the diff.
3. **Deploy to Test.** The deployment pipeline `dp_cicd_demo` compares Dev with Test and copies what changed. Deployment rules point the Test model at the Test lakehouse.
4. **Deploy to Prod.** Same action, next stage.

Only the Dev workspace is connected to Git. Test and Prod are written by the pipeline and by nothing else.

Left out of the 2-minute demo on purpose, and covered as notes in the guide: feature branches with pull requests, and triggering the deploy from Azure DevOps (part C).

## 3. Assets to build

Use these names exactly.

| Asset | Type | Name | Notes |
| --- | --- | --- | --- |
| Dev workspace | Fabric workspace | `ws_cicd_demo_dev` | Connected to Git |
| Test workspace | Fabric workspace | `ws_cicd_demo_test` | Starts empty |
| Prod workspace | Fabric workspace | `ws_cicd_demo_prod` | Starts empty |
| Repo | Azure DevOps project and repo | `fabric-cicd-demo` | Branch `main`, Git folder `workspace` |
| Deployment pipeline | Fabric deployment pipeline | `dp_cicd_demo` | Stages Development, Test, Production |
| Lakehouse | Lakehouse, no schemas | `lh_cicd_demo` | One per workspace, same name |
| Seed notebook | PySpark notebook | `nb_seed_sales` | Section 5 |
| Semantic model | Direct Lake on OneLake | `Sales CICD` | With M parameters `WorkspaceId` and `LakehouseId` |
| Report | Report | `Sales CICD` | Live-connected to the model |
| Deploy script, optional | Python file in the repo | `scripts/deploy_stage.py` | Part C |
| Azure pipeline, optional | YAML file in the repo | `azure-pipelines.yml` | Part C |
| Run log | Markdown file | `run_log.md` | IDs, checks and timings |

## 4. Prerequisites

**Fabric**

- A Fabric capacity for all three workspaces. Git integration and deployment pipelines both need one; the 60-day trial qualifies ([Git integration prerequisites](https://learn.microsoft.com/fabric/cicd/git-integration/git-get-started), [Fabric trial](https://learn.microsoft.com/fabric/fundamentals/fabric-trial)).
- Tenant settings on: **Users can create Fabric items** and **Users can synchronize workspace items with their Git repositories**. The second is on by default ([Git integration tenant settings](https://learn.microsoft.com/fabric/admin/git-integration-admin-settings)).
- If the capacity and the Azure DevOps organization are in different regions, a tenant admin must also allow exporting items to Git repositories in other locations.
- Admin role on all three workspaces. To deploy you must be a pipeline admin and at least Contributor on the source and target workspaces ([permissions](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/understand-the-deployment-process#permissions)).

**Azure DevOps**

- An Azure DevOps organization where the same Microsoft Entra user that signs in to Fabric has access.
- A repo with at least one commit, so that `main` exists.

**Desktop**

- A current Power BI Desktop. Live editing a Direct Lake model from Desktop needs the XMLA endpoint enabled on the tenant and set to read-write on the capacity ([requirements](https://learn.microsoft.com/fabric/fundamentals/direct-lake-power-bi-desktop#requirements-and-permissions)). Editing in the browser with **Open data model** is the alternative when Desktop live edit is not available.

**Part C only**

- A Microsoft Entra app registration with a client secret, and the tenant setting **Service principals can use Fabric APIs** enabled for it ([identity support](https://learn.microsoft.com/rest/api/fabric/articles/identity-support)).

**Assumptions taken in this spec**

- Azure DevOps is the Git provider. GitHub works the same way with a different connection dialog.
- The model is Direct Lake on OneLake, because that is what a Fabric client will have. It needs extra setup that an Import model would not: section 6 step 5 and section 7 step 5.
- Synthetic data only.

## 5. Seed content

Four small items travel through the pipeline: a lakehouse, a notebook that fills it, a Direct Lake model and a report. The data is tiny on purpose; this demo is about the release path, not volume.

**Notebook `nb_seed_sales`.** Default lakehouse `lh_cicd_demo`. It writes four tables, including a one-row table holding the name of the workspace it ran in. That row is how the report proves which environment it reads. The code ran on local Spark 3.5 writing Parquet with `notebookutils` stubbed; the Delta writes and the Fabric context call were not tested here.

```python
from pyspark.sql import functions as F

SEED_ROWS = 50_000
CATEGORIES = ["Audio", "Computers", "Phones", "Cameras", "Home"]

spark.conf.set("spark.sql.parquet.vorder.default", "true")
env_name = notebookutils.runtime.context.get("currentWorkspaceName", "unknown")


def u(col, salt):
    """Repeatable uniform number in [0, 1) per row."""
    return F.pmod(F.xxhash64(F.col(col), F.lit(salt)), F.lit(1_000_000)) / F.lit(1_000_000.0)


def save(df, name):
    df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(name)


dim_environment = spark.createDataFrame([(env_name,)], "environment string").withColumn("seeded_at", F.current_timestamp())

dim_date = (
    spark.sql("select explode(sequence(date'2026-01-01', date'2026-12-31', interval 1 day)) as date")
    .withColumn("month_no", F.month("date"))
    .withColumn("month_name", F.date_format("date", "MMM"))
)

cat_arr = F.array(*[F.lit(c) for c in CATEGORIES])
dim_product = (
    spark.range(1, 51).withColumnRenamed("id", "product_key")
    .withColumn("category", F.element_at(cat_arr, (F.col("product_key") % len(CATEGORIES)).cast("int") + 1))
    .withColumn("product_name", F.concat_ws(" ", "category", F.lpad(F.col("product_key").cast("string"), 2, "0")))
    .withColumn("unit_price", F.round(F.lit(10.0) + u("product_key", 1) * 490, 2).cast("decimal(18,2)"))
    .withColumn("unit_cost", F.round(F.col("unit_price") * 0.6, 2).cast("decimal(18,2)"))
)

fact_sales = (
    spark.range(1, SEED_ROWS + 1).withColumnRenamed("id", "sales_id")
    .withColumn("order_date", F.date_add(F.lit("2026-01-01").cast("date"), (u("sales_id", 2) * 300).cast("int")))
    .withColumn("product_key", (u("sales_id", 3) * 50).cast("long") + 1)
    .withColumn("quantity", (u("sales_id", 4) * 5).cast("int") + 1)
    .join(F.broadcast(dim_product.select("product_key", "unit_price", "unit_cost")), "product_key")
    .select(
        "sales_id", "order_date", "product_key", "quantity",
        F.round(F.col("quantity") * F.col("unit_price"), 2).cast("decimal(18,2)").alias("net_amount"),
        F.round(F.col("quantity") * F.col("unit_cost"), 2).cast("decimal(18,2)").alias("cost_amount"),
    )
)

for name, df in [("dim_environment", dim_environment), ("dim_date", dim_date),
                 ("dim_product", dim_product), ("fact_sales", fact_sales)]:
    save(df, name)
    print(name, spark.table(name).count())
```

Expected counts: `dim_environment` 1, `dim_date` 365, `dim_product` 50, `fact_sales` 50,000. If the Environment card later shows "unknown", the context key has a different name in your runtime; print `notebookutils.runtime.context` and adjust.

**Semantic model `Sales CICD`**

| Model table | From | Columns, friendly names |
| --- | --- | --- |
| Sales | `fact_sales` | Order Date, Product Key, Quantity, Net Amount, Cost Amount |
| Product | `dim_product` | Product Key, Product Name, Category, Unit Price |
| Date | `dim_date` | Date, Month No, Month Name |
| Environment | `dim_environment` | Environment, Seeded At |

Relationships: Sales\[Product Key\] to Product\[Product Key\], Sales\[Order Date\] to Date\[Date\]. Environment stands alone. Sort Month Name by Month No.

Measures on Sales. Margin % is wrong on purpose: it divides by cost, which is markup, not margin. That is the bug the video fixes.

```dax
Sales Amount = SUM ( Sales[Net Amount] )

Cost Amount = SUM ( Sales[Cost Amount] )

Margin = [Sales Amount] - [Cost Amount]

Margin % = DIVIDE ( [Margin], [Cost Amount] )

Environment Name = SELECTEDVALUE ( Environment[Environment] )
```

The fix shown on camera:

```dax
Margin % = DIVIDE ( [Margin], [Sales Amount] )
```

With the seed data, cost is 60% of price, so Margin % reads about 66.7% before the fix and about 40.0% after. The jump is easy to see on a card.

**Report `Sales CICD`, one page, 1280 x 720**

| Visual | Fields |
| --- | --- |
| Card, large | Margin % |
| Card | Sales Amount |
| Card, coloured border | Environment Name |
| Bar chart | Y: Product\[Category\], X: Sales Amount |
| Line chart | X: Date\[Month Name\], Y: Sales Amount |

## 6. Setup guide, part A: content, repo and Git integration

Part A ends with the Dev workspace holding all four items and every one of them committed to `main`.

1. **Azure DevOps.** Create project `fabric-cicd-demo` with a Git repo of the same name. Initialize it with a README so `main` exists.
2. **Workspaces.** Create `ws_cicd_demo_dev`, `ws_cicd_demo_test` and `ws_cicd_demo_prod` on the Fabric capacity. Write the three workspace IDs from their URLs into `run_log.md`.
3. **Lakehouse and data.** In Dev, create lakehouse `lh_cicd_demo` without schemas. Create notebook `nb_seed_sales` with the code from section 5, attach the lakehouse as default, run it. Note the lakehouse ID from its URL.
4. **Model.** In Power BI Desktop open **OneLake catalog**, pick `lh_cicd_demo`, select **Connect**, name the model `Sales CICD`, choose the Dev workspace and all four tables. Rename tables and columns, add relationships and the five measures from section 5.
5. **Make the model's source a parameter.** A Direct Lake model stores the workspace and lakehouse IDs in its connection, and deployment does not rebind them. Microsoft's documented fix is two text parameters ([M parameters with deployment pipelines](https://learn.microsoft.com/fabric/fundamentals/direct-lake-develop#use-m-parameters-with-deployment-pipelines)). In **TMDL view**, drag the **Expressions** node into the editor, then change it to this shape and select **Apply**:

   ```tmdl
   createOrReplace
   
   	expression WorkspaceId = "<dev-workspace-id>" meta [IsParameterQuery = true, IsParameterQueryRequired = true, Type = "Text"]
   
   	expression LakehouseId = "<dev-lakehouse-id>" meta [IsParameterQuery = true, IsParameterQueryRequired = true, Type = "Text"]
   
   	expression 'DirectLake - lh_cicd_demo' =
   			let
   			    Source = AzureStorage.DataLake("https://onelake.dfs.fabric.microsoft.com/" & WorkspaceId & "/" & LakehouseId, [HierarchicalNavigation = true])
   			in
   			    Source
   ```

   Keep the connection expression's existing name and annotations; the name above is an example. Use the lakehouse ID, not the SQL analytics endpoint ID. TMDL indents with tabs, so edit the scripted text in place instead of pasting this block over it. Refresh the model and confirm a measure still returns a value in DAX query view.
6. **Report.** In a new Desktop window, connect live to `Sales CICD` from the OneLake catalog, build the page from section 5, and publish to the Dev workspace as `Sales CICD`. This is the last manual publish in the project.
7. **Connect Dev to Git.** In the Dev workspace open **Workspace settings**, then **Git integration**. Choose Azure DevOps, then the organization, project `fabric-cicd-demo`, repository `fabric-cicd-demo`, branch `main`, and folder `workspace`. Select **Connect and sync** ([Get started with Git integration](https://learn.microsoft.com/fabric/cicd/git-integration/git-get-started)).
8. **First commit.** Open **Source control**, select all four items, enter "Initial commit: lakehouse, notebook, model, report", and select **Commit**.
9. **Check the repo.** The `workspace` folder now holds one folder per item. The model folder contains TMDL text files, which is what makes the DAX diff in the video readable.

Notes:

- Git stores lakehouse metadata only. Tables and files are never versioned and never overwritten by Git or by deployment ([lakehouse Git and deployment](https://learn.microsoft.com/fabric/data-engineering/lakehouse-git-deployment-pipelines)).
- Later, for feature branches: use **Branch out to new workspace** from Source control, and switch on **Lakehouse Auto-Binding in Git** in the notebook's settings so a branched notebook attaches to the lakehouse in its own workspace. That setting is off by default ([notebook source control](https://learn.microsoft.com/fabric/data-engineering/notebook-source-control-deployment#notebook-git-settings)).

## 7. Setup guide, part B: deployment pipeline and rules

Part B ends with three stages that hold the same items, each model reading its own stage's lakehouse.

1. **Create the pipeline.** From the workspace list open **Deployment pipelines**, select **New pipeline**, name it `dp_cicd_demo`, and keep the default stages Development, Test, Production. Assign `ws_cicd_demo_dev`, `ws_cicd_demo_test` and `ws_cicd_demo_prod` to them ([Get started with deployment pipelines](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/get-started-with-deployment-pipelines)).
2. **First deployment to Test.** On the Test stage select all four items and **Deploy**. Add the note "Initial deployment".
3. **Checkpoint: did the report deploy?** Microsoft's limitations list for deployment pipelines still says PBIR reports are not supported, while PBIR is now the default report format ([limitations](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/understand-the-deployment-process#considerations-and-limitations), [PBIR](https://learn.microsoft.com/power-bi/developer/projects/projects-report#pbir-format)). The two pages disagree, so test it here. If the report fails to deploy, stop and switch the release step to Git-based deployment with the `fabric-cicd` library (see part C); the rest of this spec still applies.
4. **Seed Test.** Deployment created an empty `lh_cicd_demo` in Test; data is never copied. Open `nb_seed_sales` in Test, confirm its default lakehouse is the Test one, and run it. Deployment pipelines rebind a notebook's default lakehouse to the matching item in the target workspace; if yours did not, add a default lakehouse rule for the notebook ([notebook in deployment pipelines](https://learn.microsoft.com/fabric/data-engineering/notebook-source-control-deployment#notebook-in-deployment-pipelines)).
5. **Point the Test model at the Test lakehouse.** On the Test stage open **Deployment rules**, select `Sales CICD`, and add two **parameter rules**: `WorkspaceId` = the Test workspace ID, `LakehouseId` = the Test lakehouse ID. You must be the owner of the model to create rules, and rules cannot be set on the first stage ([Create deployment rules](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/create-rules)).
6. **Apply the rules.** Rules take effect on the next deployment. Deploy `Sales CICD` from Development to Test again, then refresh the Test model.
7. **Verify Test.** Open the Test report. The Environment card must read `ws_cicd_demo_test`. The lineage view must show the Test model connected to the Test lakehouse.
8. **Repeat for Production.** Run steps 2 to 7 from Test to Production with the Prod IDs. The card must read `ws_cicd_demo_prod`.
9. **Baseline.** All three reports now show Margin % of about 66.7% and their own environment name. Write the pipeline ID from its URL into `run_log.md`.

Why step 5 exists: a deployed Direct Lake model keeps pointing at the source stage's lakehouse. For Direct Lake on OneLake, data source rules are not available, and parameter rules on M parameters are the supported way to rebind ([deployment process limitations](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/understand-the-deployment-process#considerations-and-limitations)). Skipping it gives a Test report that quietly shows Dev data, which is exactly what the Environment card is there to catch.

## 8. Setup guide, part C (optional): deploy from Azure DevOps

Part C replaces the Deploy click with an Azure DevOps pipeline run that calls the same deployment pipeline through the Fabric REST API. Skip it for the video. Build it when a client wants approvals and an audit trail in Azure DevOps.

**What was tested.** The script ran against mocked API responses for the success and the failure path, and the YAML parsed. Neither has run against Fabric or Azure DevOps.

1. **Service principal.** Register an app in Microsoft Entra, create a client secret, and enable **Service principals can use Fabric APIs** for it in the tenant settings.
2. **Access.** Add the service principal as Contributor or higher on all three workspaces and as admin on `dp_cicd_demo`. The API requires the pipeline admin role and at least Contributor on both workspaces of a deployment ([Deploy Stage Content](https://learn.microsoft.com/rest/api/fabric/core/deployment-pipelines/deploy-stage-content)).
3. **Variables.** In Azure DevOps create variable group `fabric-cicd-demo` with `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET` (marked secret) and `DEPLOYMENT_PIPELINE_ID`.
4. **Files.** Add both files below at the repo root, outside the `workspace` folder, so Fabric's Git sync ignores them.
5. **Run.** Create a pipeline from `azure-pipelines.yml`, allow it to use the variable group, and run it with Development to Test. Run it again with Test to Production.
6. **Approval.** For Production, run the step inside an Azure DevOps environment that has an approval check.

`scripts/deploy_stage.py`

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

`azure-pipelines.yml`

```yaml
trigger: none          # run by hand; switch to a branch trigger on main once it is trusted

parameters:
  - name: sourceStage
    type: string
    default: Development
  - name: targetStage
    type: string
    default: Test

pool:
  vmImage: ubuntu-latest

variables:
  - group: fabric-cicd-demo

steps:
  - task: UsePythonVersion@0
    inputs:
      versionSpec: "3.12"
  - script: pip install requests azure-identity
    displayName: Install dependencies
  - script: >
      python scripts/deploy_stage.py
      --source "${{ parameters.sourceStage }}"
      --target "${{ parameters.targetStage }}"
      --note "Azure DevOps build $(Build.BuildNumber)"
    displayName: Deploy ${{ parameters.sourceStage }} to ${{ parameters.targetStage }}
    env:
      FABRIC_TENANT_ID: $(FABRIC_TENANT_ID)
      FABRIC_CLIENT_ID: $(FABRIC_CLIENT_ID)
      FABRIC_CLIENT_SECRET: $(FABRIC_CLIENT_SECRET)
      DEPLOYMENT_PIPELINE_ID: $(DEPLOYMENT_PIPELINE_ID)
```

**Caveats**

- The API accepts a service principal only when every item in the deployment supports service principals. If the call returns `PrincipalTypeNotSupported`, run the same script under a user identity.
- Do the first deployment to each stage by hand, as in part B, so that you own the models and their rules.
- One deployment carries at most 300 items.

**The alternative: Git-based deployment with `fabric-cicd`.** Microsoft's `fabric-cicd` Python library publishes item definitions from the repo straight into a workspace and swaps workspace-specific IDs through a `parameter.yml` file. It needs no deployment pipeline. Use it when a client wants a branch per environment, or when an item will not go through a deployment pipeline. Microsoft has a full walkthrough for Azure DevOps ([tutorial](https://learn.microsoft.com/fabric/cicd/tutorial-fabric-cicd-azure-devops)).

## 9. Demo run

Rehearse the full loop twice before recording: change, commit, deploy, deploy, then revert the same way.

**Off camera, before recording**

- Open five browser tabs: the Dev, Test and Prod reports, the deployment pipeline, and the repo's commit list in Azure DevOps.
- Confirm all three reports show Margin % of about 66.7% and their own environment name.
- Have any local PBIX open in Power BI Desktop for the opening shot.

**On camera**

1. In Desktop, select **Publish**, pick a workspace, and stop at the "Replace" prompt. Cancel. Nothing is published.
2. In the Dev workspace, open `Sales CICD` with **Open data model**, switch to editing, and change Margin % to the fixed formula from section 5. The Dev report card drops to about 40.0%.
3. Back in the workspace, open **Source control**. One changed item: `Sales CICD`. Enter "Fix Margin %: divide by sales, not cost" and commit.
4. In Azure DevOps, open the new commit. The diff shows one changed line in the model's TMDL.
5. In the deployment pipeline, the Test stage marks `Sales CICD` as different from source. Select it and **Deploy** with the note "Margin % fix".
6. Refresh the Test report. Margin % is about 40.0%. The Environment card still reads `ws_cicd_demo_test`.
7. Deploy to Production the same way. The Prod report shows about 40.0% and `ws_cicd_demo_prod`.
8. Show **Deployment history** next to the commit list.

**Reset for another take:** put the old formula back in Dev, commit "Revert Margin % for demo", and deploy twice. A measure-only change needs no model refresh in the target stages.

## 10. Acceptance checks

The setup is ready to record when every box is ticked.

- [ ] The repo's `workspace` folder holds four item folders, and the model is stored as TMDL text.
- [ ] Each stage's Environment card shows its own workspace name.
- [ ] The section 7 step 3 checkpoint passed: the report deploys through the pipeline. The result is written in `run_log.md`.
- [ ] Editing Margin % in Dev produces exactly one changed item in Source control and one item marked different in the pipeline.
- [ ] The commit diff in Azure DevOps shows the measure change and nothing else.
- [ ] After each Deploy, the target report shows the new Margin % with no republish and no manual model edit.
- [ ] The Environment cards in Test and Prod are unchanged after deployment, which shows the parameter rules held.
- [ ] Deployment history lists every deployment with its note.
- [ ] The change-and-revert loop ran twice with no manual fix-up between steps.
- [ ] `run_log.md` holds: workspace, lakehouse and pipeline IDs, run date, and the seconds each deployment took.
- [ ] Part C only: a pipeline run from Development to Test ends as Succeeded and appears in Deployment history.

## 11. Sources

Microsoft Learn pages, read on 23 November 2026. Several features named here carry preview labels and change often; recheck before recording.

- [Get started with Git integration](https://learn.microsoft.com/fabric/cicd/git-integration/git-get-started): prerequisites, connect, commit
- [What is Microsoft Fabric Git integration?](https://learn.microsoft.com/fabric/cicd/git-integration/intro-to-git-integration): supported providers and items
- [Get started with deployment pipelines](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/get-started-with-deployment-pipelines): create a pipeline, assign workspaces
- [The deployment pipelines process](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/understand-the-deployment-process): permissions, limitations, Direct Lake binding, the PBIR line
- [Create deployment rules](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/create-rules): parameter rules and default lakehouse rules
- [Develop Direct Lake semantic models](https://learn.microsoft.com/fabric/fundamentals/direct-lake-develop#use-m-parameters-with-deployment-pipelines): M parameters for rebinding
- [Lakehouse Git integration and deployment pipelines](https://learn.microsoft.com/fabric/data-engineering/lakehouse-git-deployment-pipelines): what is and is not tracked
- [Notebook source control and deployment](https://learn.microsoft.com/fabric/data-engineering/notebook-source-control-deployment): default lakehouse binding
- [Power BI Desktop project report folder](https://learn.microsoft.com/power-bi/developer/projects/projects-report#pbir-format): PBIR as the default report format
- [Deployment Pipelines, Deploy Stage Content](https://learn.microsoft.com/rest/api/fabric/core/deployment-pipelines/deploy-stage-content): request body, permissions, identities
- [Automate your deployment pipeline with Fabric APIs](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/pipeline-automation-fabric): API overview and PowerShell samples
- [CI/CD for Microsoft Fabric using Azure DevOps and fabric-cicd](https://learn.microsoft.com/fabric/cicd/tutorial-fabric-cicd-azure-devops): the Git-based alternative

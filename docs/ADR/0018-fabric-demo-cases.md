# ADR-0018 — Three Fabric demo cases for video (migration, slow report, CI/CD)

- **Status:** Accepted (USER, 2026-11-24, grill rounds 1–3 in chat; written by the main agent)
- **Date:** 2026-11-24
- **Decider:** USER
- **Spec (input, the contract):** `.log/reports/Spec 1 · Power BI to Fabric migration demo (Import vs Direct Lake).md`, `.log/reports/Spec 2 · Slow report, live fix demo.md`, `.log/reports/Spec 3 · Fabric CI CD demo manual publish to one-click deployment.md` (all 2026-11-23)
- **Design:** `docs/ADD/features/fabric-demos-sdd.md`
- **Related:** ADR-0003 (no Spark for the P&L data layer: this ADR makes a scoped exception), ADR-0006 (cloud connection pattern for Import from a SQL endpoint)

## 1. Context

The USER needs all assets of three demo cases built so that the videos can be recorded. The specs are outside the ACME P&L spec (`docs/Requirements.md`) and use synthetic sales data of their own. They name exact items (workspaces, lakehouses, notebooks, models, reports) and acceptance checks, and they rely on PySpark notebooks. Three of their choices clash with standing rules: Spark (ADR-0003, `CLAUDE.md`), binary `.pbix` (Track B rule) and Azure DevOps (no account in use).

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| a | Home | New top-level folder `demos/` in this repo: `01-migration/`, `02-slow-report/`, `03-cicd/`. Same agents, logs and USER-only git flow. |
| b | Capacity | All demo workspaces on the dev F64 (North Europe) capacity that RAW uses: `ws_migration_demo` (Specs 1 + 2), `ws_cicd_demo_dev`, `ws_cicd_demo_prod` (Spec 3; `ws_cicd_demo_test` dropped, see amendment). |
| c | Spark | The spec notebooks run as written (PySpark, V-Order). **Exception to the no-Spark rule, scoped to `demos/` only**; the P&L data layer stays plain Python (ADR-0003 unchanged). First run of every generator at `N_SALES = 300_000`, then full size. |
| d | Build mode | Hybrid. Agents build everything that is code (notebooks, TMDL, PBIR, DAX tests, guides) and deploy / verify through Fabric APIs and `fab`. The USER does sign-ins (data source OAuth, GitHub connection), consents and the on-camera clicks. Desktop-only spec steps get a click guide. |
| e | Files | PBIP (TMDL + PBIR) is the source of truth in `demos/`. The spec-named `.pbix` files are saved by the USER locally from the PBIP and stay out of git (`*.pbix` is already ignored). |
| f | Specs 1 + 2 data | One shared `lh_sales_demo` built to Spec 1 (30 M rows, 31 discount levels). Spec 2 runs on it; if its slow query is outside 3–20 s, tune per Spec 2 § 8 (report side first), and log it in `perf_log.md`. |
| g | Spec 3 Git | GitHub instead of Azure DevOps: repo `rusloc/fabric-cicd-demo`, branch `main`, folder `workspace`. Separate from this repo (Fabric commits into it). Flow, folder and first commit changed: see amendment 4. |
| h | Spec 3 Part C | Not built. Kept as a written recipe in the guide (GitHub Actions instead of `azure-pipelines.yml`); no service principal, secret or tenant change now. |
| i | Order | Spec 1 → Spec 2; Spec 3 in parallel. |

### Amendment 2026-11-24 (USER): measure names
Specs 1 § 4 and 3 § 5 put a column `Cost Amount` and a measure `Cost Amount` on `Sales`. The engine refuses this (`Dataset_Import_FailedToImportDataset`, first deploy of `Sales Import`; nothing created). **USER ruling:** every measure in all four demo models takes the suffix ` (fx)` (e.g. `Cost Amount (fx)`, `Margin % (fx)`, `Big Line Sales (fx)`), and all measures live in a separate measures table `_Measures` instead of `Sales`. The DAX is otherwise as written. Measure references take the new names; column references are unchanged. Guides and on-camera steps follow: Spec 1 § 7 step 5 scripts the whole `_Measures` table (`createOrReplace`) into a freshly created Direct Lake model, which has no `_Measures` yet; `ref table _Measures` applies only when the table exists, and the Spec 3 fix is `Margin % (fx) = DIVIDE ( [Margin (fx)], [Sales Amount (fx)] )`. Consequence for Spec 1 § 10 check 5: `_Measures` is a measures-only calculated table (`ROW ( … )`, no reference to Direct Lake tables, which Learn allows), so the check reads "five data tables in Direct Lake mode, no calculated columns, plus `_Measures`" (main-agent call; the USER may overrule with a Delta-backed `_Measures` table).

### Amendment 2026-11-24 (USER): Spec 3 with two stages
Spec 3 runs **Dev → Prod only, no Test**. `dp_cicd_demo` is recreated with two stages (Development, Production), because the stage count of a deployment pipeline is fixed at creation. `ws_cicd_demo_test` and the 3-stage pipeline are deleted (USER runs the deletes). Parameter rules only on Production. The storyline drops the "Test report" shot (Spec 3 § 1 1:15): commit → Deploy to Production → Prod report + Environment card. Spec 3 § 7 steps 2–7 apply to Production directly; § 10 checks read "each stage" = Dev and Prod.

### Amendment 2026-11-24 (USER): accepted results after the first real-data tests
- Spec 1 § 10 check 4b: the Direct Lake report's Price Band and Channel slicers show "(Blank)" (Direct Lake blank member on every dimension; values identical). **Accepted as is**, no slicer filter.
- Spec 2 § 8: Slow 25–33 s on the service F64 (gate 3–20 s), Fast ~0.8 s net, 31–42× net, difference query 0 rows. **Accepted with the current tests**; no tuning, page stays Brand × Year Month.
- Spec 1 layout: line-chart month labels truncated and the Country × Year matrix clipped (scrollbars). **Accepted as is**, no layout change.

### Amendment 4 2026-11-24 (USER): Spec 3, Git is the source
Spec 3's flow is reversed. A change starts in Git: local edit of the TMDL → commit + push to GitHub `rusloc/fabric-cicd-demo` (public, `main`) → `ws_cicd_demo_dev` › Source control › **Updates** › Update all → `dp_cicd_demo` Deploy Dev → Prod. This replaces the spec's edit in the browser (Open data model) and commit from workspace Source control (§ 2 steps 1–2, § 9 steps 2–4).
- Git folder blank: item folders sit at the repo root, not in `workspace/` (replaces decision g's folder).
- Fabric made the first commit itself on connect (it writes `.platform` files with logicalIds; pushing the local PBIP first would clash with the existing workspace items). Spec § 6 step 8 is not run.
- Live demo repo: local clone `C:\__PBI\fabric-cicd-demo`, a sibling of this repo and its own git repo, managed from this repo's sessions as files; the USER runs its git. `demos/03-cicd/pbi/Sales CICD/` stays the build source and backup; the two are not synced.
- Rules: never edit the model in Fabric between takes (Git conflict); reset = the reverse edit, pushed the same way; measure-only deploys need no reframe. Feature branch + pull request is an optional variant (guide).
- Spec § 10 wording: check 1 "repo root holds four item folders"; check 4 "one incoming change under Updates"; check 5 "GitHub commit diff = the local one-line change, nothing else".
- Done (USER): fine-grained token on this repo only (Contents Read and write), Dev Git connect, Production parameter rules, XMLA Read Write on the capacity (§ 4 first item, capacity side). Blur in post: Fabric's first commit message (Dev workspace ID), tenant and account names.

## 3. Consequences

- `CLAUDE.md`: quick-navigation row for `demos/`, a Spark exception note, and the four workspaces in the Workspaces table once they exist (IDs from the build).
- Cost: Spark sessions and a 30 M-row Import refresh on the shared dev F64. No new money; possible CU contention with RAW during big runs.
- Spec deviations allowed by this ADR only: GitHub for ADO (Spec 3), shared data for Spec 2, PBIP beside the PBIX. Any other deviation is logged in the case's run log and raised with the USER (the specs say: stop on a failed acceptance check, never adjust the check).
- Numbers shown in the videos come from the recorded runs (`run_log.md`, `perf_log.md`), never from the specs.

## 4. Open

- Desktop live edit of a Direct Lake model needs XMLA read-write on the capacity and the tenant XMLA setting (ginee checks, read-only).
- Spec 3 § 7 step 3: whether the deployment pipeline deploys a PBIR report. If not, switch the release step to `fabric-cicd` (spec fallback) — a USER call at that point.

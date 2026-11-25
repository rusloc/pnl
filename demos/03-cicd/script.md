# Video script · Case 3 · Fabric CI/CD: from Publish to one-click deployment

Status: **draft v0.1** (2026-11-24) · target **3:15** (hard cap 5:00) · voice-over about 225 words (about 1:45 spoken); the rest is on-screen action and cut waits.
Click path, git blocks and reset: `guide.md` § 4 (ADR-0018 amendment 4: Git is the source). Numbers in `{braces}` come from the recorded run (`run_log.md`).

**The one claim:** a change goes from a commit to production with one click, every step leaves a record, and each environment keeps its own data.

## Before you press record

- Guide § 4 "Off camera": VS Code on `C:\__PBI\fabric-cicd-demo` at the Margin % line; tabs for GitHub commits, Dev Source control, `dp_cicd_demo`, the Dev and Prod reports; Desktop with a local PBIX for scene 1.
- Clean start: both reports at 66.7 %, Dev Source control empty, `git status` clean.
- After the take: reset (guide § 4) so the next take starts at 66.7 %.

## Scenes

| # | Time | On screen | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:20 | Desktop › Publish › pick a workspace › "Replace this semantic model?" › Cancel. | "This is how most teams ship Power BI. One click on Publish, straight into production. No review, no test, no history, and no way back." |
| 2 | 0:20–0:40 | Simple overlay: VS Code → GitHub → Dev workspace → pipeline → Prod. Then the Dev and Prod reports side by side: Margin % (fx) 66.7 %, Environment cards `ws_cicd_demo_dev` / `ws_cicd_demo_prod`. | "Here's the same kind of change, done properly. The model lives in GitHub. The Dev workspace syncs from it, and a deployment pipeline moves it to Production. Both show a margin of 66.7 percent. That's a bug: it divides by cost instead of sales." |
| 3 | 0:40–1:05 | VS Code › `_Measures.tmdl`: `[Cost Amount (fx)]` → `[Sales Amount (fx)]` › Ctrl+S › Source Control: message `Margin % fix` › Commit › Sync. | "The model is plain text. I change one reference, cost to sales, save, commit with a message, and push." |
| 4 | 1:05–1:20 | GitHub › commits › `Margin % fix` › diff: one changed line. | "GitHub shows exactly one changed line. Anyone can review it, and anyone can roll it back." |
| 5 | 1:20–1:50 | `ws_cicd_demo_dev` › Source control › Updates (1) › Update all. Dev report › Refresh: **40.0 %**. | "In the Dev workspace, Source control sees one incoming change. Update all pulls it in, and the Dev report shows 40 percent. Nobody pressed Publish." |
| 6 | 1:50–2:30 | `dp_cicd_demo`: Production marks `Sales CICD` as different › select › Deploy, note `Margin % fix`. Prod report › Refresh: **40.0 %**, Environment `ws_cicd_demo_prod`. Caption: **Deploy: {n} s**. | "The pipeline marks the model as different in Production. Select it, add a note, deploy. Seconds later, Production shows 40 percent too. And look at the environment card: Production still reads its own lakehouse. A deployment rule swaps the connection on the way in, so nobody edits anything by hand." |
| 7 | 2:30–3:00 | Deployment history next to the GitHub commit list. | "Every step left a record. GitHub knows who changed what, and why. The pipeline knows when it went where. And if something breaks, the way back is the same path: revert the commit, deploy again." |
| 8 | 3:00–3:15 | Closing card: **CI/CD setup · 1 week · $1,200**. | "Want this for your own workspaces? A CI/CD setup takes one week." |

## Edit notes

- **Scene 3:** use the VS Code Source Control panel on camera (cleaner than the terminal), but run `git diff --stat` off camera first: it must show 1 insertion, 1 deletion (guide § 4 step 3).
- **Scenes 5 and 6:** cut the waits for Update all and the deploy; keep the real seconds as a caption.
- Room to spare (about 1:45): if wanted, add the feature-branch + pull-request variant between scenes 3 and 4 (guide § 4, about 30 s), or a 15 s revert montage after scene 7.

## Blur in post

Tenant and account name; workspace IDs in the address bar; your GitHub username; Fabric's first commit message in the commit list (`Committing 4 items from workspace <Dev ID>`); never open `expressions.tmdl` (Dev IDs, public repo).

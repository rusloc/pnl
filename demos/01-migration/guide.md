# Guide · Case 1 · Power BI to Fabric migration (Import vs Direct Lake)

USER click guide for rehearsal and recording. Spec: `.log/reports/Spec 1 · Power BI to Fabric migration demo (Import vs Direct Lake).md`. Decisions: ADR-0018 (+ amendment 2026-11-24). IDs and measured numbers: `run_log.md` in this folder (never copy them into the video from the spec).

## 1. Prerequisites still open

- [ ] **XMLA Read Write on the capacity** (needed for Desktop live edit and for creating a Direct Lake model from Desktop). Admin portal › Capacity settings › Fabric capacity › `issglobalfabric` › Power BI workloads › XMLA Endpoint = **Read Write** › Apply. The tenant XMLA setting is already on (`run_log.md` › Environment).
- [ ] **Automatic updates on `Sales Direct Lake`** (spec § 7 step 6; the API cannot read it). `ws_migration_demo` › `Sales Direct Lake` (semantic model) › … › Settings › Refresh › **Keep your Direct Lake data up to date** = On › Apply.
- [ ] **Cloud connection `demo-lh_sales_demo-sql`** for `Sales Import` (spec § 6 step 8):
  1. `ws_migration_demo` › `Sales Import` (semantic model) › … › Settings › **Gateway and cloud connections**.
  2. Under Cloud connections, row of the SQL data source › Maps to › **Create a connection**.
  3. Connection name `demo-lh_sales_demo-sql` · type SQL Server · server and database are prefilled (`lh_sales_demo`) · Authentication **OAuth 2.0** › Edit credentials › sign in › **Create**.
  4. Back in Settings, pick `demo-lh_sales_demo-sql` in Maps to › **Apply**.
  5. `Sales Import` › **Refresh now**. Note the duration from Refresh history into `run_log.md` (spec § 6 step 8). Spec § 10: at least 2 minutes, otherwise stop and tell the team (60 M rebuild needs your consent).

## 2. What is already built

| Item | State | Differs from the spec |
|---|---|---|
| `lh_sales_demo`, `nb_01_build_sales_demo`, `nb_02_append_day` | built, 30 M rows, checks green (`run_log.md` › Checks) | none |
| `Sales Import` model | deployed, not refreshed (waits on the connection above) | measures in `_Measures`, names end in " (fx)" |
| `Sales Direct Lake` model | deployed and framed, totals = gold | same as above; `_Measures` is a measures-only calculated table |
| `Sales Import` / `Sales Direct Lake` reports | deployed by API, page "Sales overview" | bound by connection (API), not published from Desktop; cloned from the PBIP, not by Semantic Link Labs |
| PBIP source | `pbi/Sales Import/`, `pbi/Sales Direct Lake/` in the repo | `Sales Import.pbix` is saved by you, locally only (`*.pbix` is gitignored) |

Measure names on every card and in every DAX query: `Sales Amount (fx)`, `Cost Amount (fx)`, `Margin (fx)`, `Margin % (fx)`, `Order Lines (fx)`, `Last Order Date (fx)`, `Data As Of (fx)` (ADR-0018 amendment: a measure may not share its name with the `Cost Amount` column).

## 3. Desktop steps the video shows but the build skipped (rehearsal / B-roll only)

The live items already exist. **Never Publish and never create items named `Sales Import` or `Sales Direct Lake`**: that would replace or duplicate the recorded ones.

**A. Import build, spec § 6 steps 1–5 (B-roll of the "legacy" pieces).** Easiest: open `pbi/Sales Import/Sales Import.pbip` instead of rebuilding by hand.
1. Desktop › File › Open › `Sales Import.pbip`. Do not Ctrl+S the PBIP (it would write the endpoint host into the repo).
2. Home › Transform data ▾ › **Edit parameters** › `SqlEndpoint` = the SQL endpoint host of `lh_sales_demo` (lakehouse › SQL analytics endpoint › Settings › SQL connection string; the endpoint ID is in `run_log.md`) › OK › Apply changes › sign in with your organizational account. 30 M rows load locally (minutes, ≥ 16 GB RAM).
3. File › Save as › `Sales Import.pbix` (outside git, or in this folder: ignored).
4. Shots: Transform data › query **Customer** (steps Merged Columns, Removed Columns, Renamed Columns) and **Sales** (Added Net Amount, Added Cost Amount); Table view › Product › column **Price Band** (formula bar); Table view › **Date** (formula bar: the calculated table).
5. For the § 7 step 1 shot: Fabric › `nb_01_build_sales_demo` › cell 3.

If you want the click-by-click build instead (§ 6 steps 1–5): OneLake catalog › `lh_sales_demo` › Connect ▾ › **Connect to SQL endpoint** › Import › the four `raw_*` tables › Transform data, then follow spec § 6. Measures go into a table `_Measures` with the " (fx)" names; never Publish.

**B. Direct Lake creation, spec § 7 steps 2–5.** Desktop creates the model in the workspace the moment you press OK.
- On camera: new Desktop window › OneLake catalog › `lh_sales_demo` › **Connect** › name, workspace, tick `dim_customer`, `dim_product`, `dim_store`, `dim_date`, `fact_sales` › **Cancel** (cut the take before OK).
- Full rehearsal (optional): same path, name `Sales Direct Lake rehearsal`, then steps 3–5 below; delete that model afterwards (Workspace › … › Delete).
  3. Rename tables and columns to spec § 4, delete the "do not load" columns.
  4. Relationships, Mark as date table on Date[Date], Month Name › Sort by column › Month No.
  5. **Copy the measures** (spec § 7 step 5, amended): in `Sales Import.pbix` › TMDL view › drag the table **`_Measures`** from the Data pane into the editor (scripts `createOrReplace` › `table _Measures` with its seven measures and its `ROW ( "measure_table", 0 )` partition) › copy. In the Direct Lake model › TMDL view › paste › **Apply**. If `_Measures` already exists in the target, script only the measures instead: the script then starts with `ref table _Measures` and the seven `measure '… (fx)'` blocks. Seven measures, same names, same formats.
- Report rebind (§ 7 step 7): already done by API; nothing to rehearse.
- Title "Sales overview · DIRECT LAKE" and the green title bar (§ 7 step 8): already in the report.

## 4. Recording run (spec § 9 with the real names)

**Off camera**
1. Both prerequisites in § 1 done; `Sales Import` refreshed after the last data change.
2. Browser window 1: `ws_migration_demo` › report `Sales Import`. Window 2: report `Sales Direct Lake`. Side by side; click through both once (warm).
3. Open `nb_02_append_day`, start its Spark session (Connect), wait until it is ready. Stopwatch on screen.

**On camera**
1. Both reports: cards **Sales Amount (fx)**, **Order Lines (fx)**, **Last Order Date (fx)**, **Data As Of (fx)** identical. Today's values (fill from `run_log.md` if the data was rebuilt): $19,476,577,851 · 30,000,000 · 31 Oct 2026 · 24 Nov 11:09 (UTC, as stored).
2. `nb_02_append_day` › **Run all**. Expected output on the first run: `Appended 50,000 lines for 2026-11-01`.
3. Report B (`Sales Direct Lake`) › **Refresh** (report toolbar). Expected: Last Order Date (fx) = 01 Nov 2026, Order Lines (fx) = 30,050,000, Data As Of (fx) = the run time, Sales Amount (fx) up (fill from `run_log.md`). Log the seconds from notebook end to new numbers.
4. Report A (`Sales Import`) › Refresh. Expected: nothing changes.
5. Wait about a minute (SQL endpoint sync), then `Sales Import` (semantic model) › **Refresh now**; start the stopwatch.
6. B-roll while it runs (section 3 A, step 4 and 5).
7. When it finishes: Settings › Refresh history › duration on screen; refresh Report A; both reports match again.

If Report B has not changed after a minute: check the automatic-updates toggle (section 1), then `Sales Direct Lake` › Refresh now once. If the Import refresh misses the new day: lakehouse › SQL analytics endpoint › Refresh, then refresh the model again.

Reset for another take: rerun `nb_01_build_sales_demo` (overwrites every table; about 3 minutes, `run_log.md`), then refresh `Sales Import`.

## 5. Acceptance checklist (spec § 10)

| # | Check | State | Evidence |
|---|---|---|---|
| 1 | Notebook row counts = § 4 | **done** | `run_log.md` › Checks, run 2 |
| 2 | Totals ROW identical in both models | pending (Direct Lake = gold; Import not refreshed) | `tests/acceptance.dax` check 2, both models; gold baseline in `run_log.md` |
| 3 | Country by Year matrix identical | pending | `tests/acceptance.dax` check 3 |
| 4 | Price Band offers Budget, Mid, Premium, equal totals | pending (Direct Lake = gold) | `tests/acceptance.dax` checks 4 / 4b; `run_log.md` › Model deploy |
| 5 | `Sales Direct Lake`: five tables, Direct Lake, no calculated columns or tables | pending run; **caveat**: the model has a 6th table `_Measures`, a measures-only calculated table (ADR-0018 amendment). Read the check as "five data tables in Direct Lake mode, no calculated columns, plus `_Measures`" | `tests/acceptance.dax` check 5 |
| 6 | Report B shows the new day within 60 s, Report A does not | pending (`nb_02_append_day` not run yet) | `run_log.md` › Pending |
| 7 | Import refresh ≥ 2 minutes | pending | `run_log.md` › Model deploy (`Sales Import` refresh duration) |
| 8 | `run_log.md` holds date, SKU, counts, Import duration, Direct Lake seconds | partial: date, SKU, counts done | `run_log.md` |

Run `tests/acceptance.dax`: Desktop live-connected to each model (new window › OneLake catalog › model › **Connect**; or DAX Studio) › DAX query view › paste the file › Run › export each result; the two models pass checks 2–4 when the exports match.

# fabric-data/perf — service query timings (ADR-0008 §5)

Read-only tools that time Track A's DAX against the service model `ACME Unified PnL` (CLAUDE.md › Workspaces).

| File | What it is |
|---|---|
| `gen-queries.ts` | Builds the query set with the app's own builders (`fabric-app/.../pnl-model-queries.ts`): Q1 statement, Q2a KPI meta, Q2b KPI values in chunks of 3, Q3 bridge, Q4 drivers, Q5 profitability, Q6 context; for `def` (P, FY2026 YTD Sep, ACT vs BUD / PY, USD, actual rates) and `worst` (ACME Group, LTM Sep 2026) |
| `run-queries.py` | Sends each `.dax` file through `executeQueries` (`fab api`), sequentially, N runs each; prints wall time and rows |
| `queries-2026-10-23/` | The frozen set used for the §5.1 baseline (20 queries + `cc-g-fy2025-q1` = Group FY2025 constant currency + `zz-trivial` = CLI/API overhead probe) |
| `baseline-2026-10-23.txt` | §5.1 baseline output (before ADR-0008 (a)+(b)) |

Re-time with the frozen set, so before and after compare like for like (repo root, signed in with `fab`):

```powershell
$env:FABRIC_WORKSPACE = "<RAW workspace id>"; $env:PBI_DATASET = "<ACME Unified PnL model id>"
python fabric-data/perf/run-queries.py --runs 2 (Get-ChildItem fabric-data/perf/queries-2026-10-23/*.dax | ForEach-Object FullName)
```

Regenerate the set from the current builders (only when Track A's queries change; compare with the frozen set first):

```powershell
fabric-app/node_modules/.bin/tsx fabric-data/perf/gen-queries.ts <outDir> NR,ORG_GROWTH,GM_PCT,GTN_PCT,AP_PCT,CM_PCT,EBITDA,OP,UNITS,NR_PER_UNIT,VOL_GROWTH,PRICE_MIX NR,ORG_GROWTH,GM_PCT,SVC_SHARE,IC_ELIM,CM_PCT,EBITDA,OP,CP_OP_MARGIN,CC_OP_MARGIN,NP,ETR
```

The KPI codes are the 12 `dim_kpi` slots of the P and GROUP views, in slot order. On 2026-10-23 the regenerated set was byte-identical to `queries-2026-10-23/`.

How a view's time is read (ADR-0008 §5.1): the app fires its zones in parallel, so a view ≈ its slowest call (Key figures ≈ KPI meta + slowest chunk). Every figure includes ~1.5 s of CLI + API overhead (`zz-trivial`). Cache is not cleared: run 1 is the first run of that query, not a guaranteed cold cache.

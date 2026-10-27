"""Times DAX queries against a service semantic model with executeQueries via `fab api` (read-only).

Usage (repo root):
    python fabric-data/perf/run-queries.py --runs 2 --workspace <ws id> --dataset <model id> <file.dax>...
<ws id> / <model id>: CLAUDE.md > Workspaces; defaults from the env vars FABRIC_WORKSPACE and PBI_DATASET.
Output: one line per run: query name, run, seconds (wall time, ~1.5 s fab CLI + API overhead included), rows or error.
"""
import argparse
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
ap.add_argument("--runs", type=int, default=2)
ap.add_argument("--workspace", default=os.environ.get("FABRIC_WORKSPACE"), help="workspace id (env FABRIC_WORKSPACE)")
ap.add_argument("--dataset", default=os.environ.get("PBI_DATASET"), help="semantic model id (env PBI_DATASET)")
ap.add_argument("queries", nargs="+", type=Path)
args = ap.parse_args()
if not (args.workspace and args.dataset):
    ap.error("--workspace and --dataset (or FABRIC_WORKSPACE / PBI_DATASET) are required")

with tempfile.TemporaryDirectory() as tmp:
    for path in args.queries:
        body = Path(tmp) / f"{path.stem}.body.json"
        body.write_text(json.dumps({"queries": [{"query": path.read_text(encoding="utf-8")}],
                                    "serializerSettings": {"includeNulls": True}}, ensure_ascii=True),
                        encoding="ascii")  # ASCII-escaped: fab api reads the body in the console code page
        for r in range(1, args.runs + 1):
            t0 = time.perf_counter()
            p = subprocess.run(["fab", "api", "-A", "powerbi", "-X", "post",
                                f"groups/{args.workspace}/datasets/{args.dataset}/executeQueries", "-i", str(body)],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            dt = time.perf_counter() - t0
            out = p.stdout
            try:
                j = json.loads(out)
                res = j.get("text", j)["results"][0]
                note = ("ERROR " + json.dumps(res["error"])[:200]) if "error" in res \
                    else f"rows {len(res['tables'][0]['rows'])}"
                note += f" status {j.get('status_code', '')}"
            except Exception as e:  # noqa: BLE001
                note = f"unparsed ({e}): {out[:200]} {p.stderr[:200]}"
            print(f"{path.stem:28} run {r}  {dt:6.1f} s  {note}", flush=True)

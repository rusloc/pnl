#!/usr/bin/env python3
"""ACME Unified P&L dummy dataset: CSV (Node generator) -> the 23 Parquet files the Power BI pack imports.

Usage:  python generate.py [--out <folder>]      (default: the dataset folder, one level up)
Writes  facts/ dims/ params/ checks/ (CSV, by gen_data.js) and parquet/ (23 tables, by load_acme_pl.py --parquet-out).
Needs   node on PATH and pyarrow 26.0.0 (../../requirements.txt).

gen_data.js + engine.js are copies of rusloc/pnl data/acme_pl_dummy_data/generator/ (deterministic: same files every run).
load_acme_pl.py is a copy of rusloc/pnl fabric-data/lh_raw/load_acme_pl.py. Only its --parquet-out path runs here (strict CSV
parse, type spec, row-count / key / null checks, ADR-0008 derivations), reading the CSVs from --out instead of the repo folder.
Nothing is written to Parquet if any check fails.
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# The tables the model imports (the 6 params it does not use are checked but not written).
TABLES = [
    "bridge_account_nature", "control_totals_usd", "dim_account", "dim_channel", "dim_cost_centre", "dim_entity", "dim_line",
    "dim_month", "dim_nature", "dim_region", "dim_report_line", "dim_segment", "dim_version", "fact_fx_rate", "fact_operational",
    "fact_pl", "fact_pl_allocated", "fact_pl_elim", "param_fx_basis", "param_reporting_currency", "param_time_view", "param_units",
    "param_version_choice",
]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=str(HERE.parent), help="dataset folder (default: the folder above generator/)")
    out = Path(ap.parse_args().out).resolve()
    if subprocess.run(["node", str(HERE / "gen_data.js"), str(out)]).returncode:
        print("gen_data.js failed. No Parquet written.")
        return 1
    print(f"CSV written to {out} (facts/ dims/ params/ checks/)")
    sys.path.insert(0, str(HERE))
    import load_acme_pl as loader

    loader.DATA_DIR = out
    sys.argv = [str(HERE / "load_acme_pl.py"), "--parquet-out", str(out / "parquet"), "--tables", ",".join(TABLES)]
    return loader.main()


if __name__ == "__main__":
    sys.exit(main())

"""Load data/acme_pl_dummy_data/*.csv into Lakehouse lh_raw, schema acme_pl, as typed Delta tables (ADR-0003).

Full overwrite per table (idempotent re-run). Every CSV is parsed strictly against the TABLES spec below
(the only place column types are declared) and checked before anything is written:
header = spec columns (names and order), row count = expected, 0 duplicate keys, no nulls in not-null columns.
If any table fails a check, nothing is written.

Usage (from the repo root, venv in fabric-data/.venv):
    fabric-data/.venv/Scripts/python fabric-data/lh_raw/load_acme_pl.py --dry-run
    fabric-data/.venv/Scripts/python fabric-data/lh_raw/load_acme_pl.py --workspace <ws> --lakehouse <lh>

<ws> / <lh>: workspace and lakehouse IDs (CLAUDE.md > Workspaces), or names in OneLake form
("RAW", "lh_raw.Lakehouse"). Defaults come from the env vars FABRIC_WORKSPACE and FABRIC_LAKEHOUSE.
Auth: the signed-in Azure CLI account (`az login`); the token is never printed.

Spec: docs/Requirements.md section 8 (D-01 ... D-21), section 10 T-06; data contract data/acme_pl_dummy_data/README.md.
"""
import argparse
import csv
import os
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.csv as pacsv

SCHEMA = "acme_pl"
DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "acme_pl_dummy_data"

S = pa.string()
I = pa.int32()
B = pa.bool_()
DT = pa.date32()
AMT = pa.decimal128(18, 2)  # amounts: exactly 2 dp in the source, exact cent sums
FX = pa.decimal128(18, 6)  # local_per_usd: exactly 6 dp in the source, lossless
W = pa.decimal128(5, 4)  # bridge weight: 2 dp, max 1.00
N = True  # nullable; everything else is not null

PL = [
    ("entity_code", S), ("month_key", S), ("version_key", S), ("region_code", S), ("channel_code", S),
    ("line_code", S), ("segment_code", S), ("account_code", S), ("counterparty_entity_code", S, N),
    ("currency_code", S), ("cost_centre_code", S), ("amount_local", AMT),
]
PL_KEY = ["entity_code", "month_key", "version_key", "region_code", "channel_code", "line_code",
          "segment_code", "account_code", "counterparty_entity_code"]


def slice_dim(code, name):
    return [(code, S), (name, S), ("entity_code", S), ("slot_label", S), ("sort_order", I), ("is_unassigned", B)]


def flagged(code, name):
    return [(code, S), (name, S), ("sort_order", I), ("is_default", B)]


# table -> (source folder, expected rows per the data README / CSVs, unique key, columns in CSV order)
# column = (name, arrow type[, N if nullable]); month_key and other YYYY-MM keys stay strings.
TABLES = {
    "dim_entity": ("dims", 2, ["entity_code"], [
        ("entity_code", S), ("entity_name", S), ("short_name", S), ("description", S, N), ("consolidation_group", S)]),
    "dim_month": ("dims", 36, ["month_key"], [
        ("month_key", S), ("month_start_date", DT), ("month_index", I), ("fiscal_year", I), ("quarter", S),
        ("month_number", I), ("month_name", S), ("is_closed", B)]),
    "dim_version": ("dims", 4, ["version_key"], [
        ("version_key", S), ("version_code", S), ("version_name", S), ("forecast_cycle", S, N),
        ("is_latest_forecast", B), ("first_month_key", S), ("last_month_key", S)]),
    "dim_region": ("dims", 4, ["region_code"], [
        ("region_code", S), ("region_name", S), ("functional_currency", S), ("sort_order", I)]),
    "dim_channel": ("dims", 10, ["channel_code"], slice_dim("channel_code", "channel_name")),
    "dim_line": ("dims", 11, ["line_code"], slice_dim("line_code", "line_name")),
    "dim_segment": ("dims", 8, ["segment_code"], slice_dim("segment_code", "segment_name")),
    "dim_cost_centre": ("dims", 19, ["cost_centre_code"], [
        ("cost_centre_code", S), ("cost_centre_name", S), ("entity_code", S), ("function", S)]),
    "dim_account": ("dims", 73, ["account_code"], [
        ("account_code", S), ("account_name", S), ("entity_scope", S), ("entity_scope_name", S), ("block_code", S),
        ("block_name", S), ("block_alias_products", S), ("block_alias_services", S),
        ("spine_step", S),  # text: 8a-8d exist
        ("sort_order", I), ("natural_sign", I), ("ifrs18_category", S), ("is_direct", B), ("is_below_cm", B),
        ("is_intercompany", B), ("has_fact_rows", B), ("definition", S, N), ("published_comparable", S, N),
        ("default_cost_centre_products", S, N), ("default_cost_centre_services", S, N)]),
    "dim_report_line": ("dims", 29, ["line_code"], [
        ("line_code", S), ("line_name", S), ("row_type", S), ("formula", S, N), ("block_code", S, N),
        ("spine_step", S), ("tag", S, N), ("parent_line_code", S, N), ("is_key", B), ("alias_products", S, N),
        ("alias_services", S, N), ("ifrs18_category", S, N), ("sort_order", I)]),
    "dim_nature": ("dims", 9, ["nature_code"], [
        ("nature_code", S), ("nature_name", S), ("sort_order", I), ("natural_sign", I)]),
    "bridge_account_nature": ("dims", 54, ["account_code", "nature_code"], [
        ("account_code", S), ("nature_code", S), ("weight", W)]),
    "param_breakdown": ("params", 5, ["breakdown_code"], [
        ("breakdown_code", S), ("breakdown_name", S), ("available_for", S), ("sort_order", I)]),
    "param_cost_lens": ("params", 2, ["lens_code"], flagged("lens_code", "lens_name")),
    "param_cost_sign": ("params", 2, ["cost_sign_code"], [
        ("cost_sign_code", S), ("cost_sign_name", S), ("display_multiplier_for_costs", I), ("sort_order", I),
        ("is_default", B)]),
    "param_detail_level": ("params", 3, ["detail_code"], flagged("detail_code", "detail_name")),
    "param_fx_basis": ("params", 2, ["fx_basis_code"], flagged("fx_basis_code", "fx_basis_name")),
    "param_layout": ("params", 3, ["layout_code"], [
        ("layout_code", S), ("layout_name", S), ("available_for", S), ("sort_order", I)]),
    "param_reporting_currency": ("params", 3, ["currency_code"], [
        ("currency_code", S), ("currency_name", S), ("symbol", S), ("sort_order", I), ("is_default", B)]),
    "param_time_view": ("params", 5, ["time_view_code"], flagged("time_view_code", "time_view_name")),
    "param_units": ("params", 2, ["units_code"], [
        ("units_code", S), ("units_name", S), ("divisor", I), ("decimals", I), ("sort_order", I), ("is_default", B)]),
    "param_variance_format": ("params", 3, ["variance_format_code"],
                              flagged("variance_format_code", "variance_format_name")),
    "param_version_choice": ("params", 5, ["choice_code"], [
        ("choice_code", S), ("choice_name", S), ("allowed_as_base", B), ("allowed_as_compare", B), ("sort_order", I),
        ("default_for", S, N)]),
    "control_totals_usd": ("checks", 552, ["entity_code", "version", "window", "line_code"], [
        ("entity_code", S), ("version", S), ("window", S), ("line_code", S), ("amount_usd", AMT)]),
    "fact_fx_rate": ("facts", 288, ["currency_code", "month_key", "rate_type"], [
        ("currency_code", S), ("month_key", S), ("rate_type", S), ("local_per_usd", FX)]),
    "fact_operational": ("facts", 29016, PL_KEY[:7], [
        ("entity_code", S), ("month_key", S), ("version_key", S), ("region_code", S), ("channel_code", S),
        ("line_code", S), ("segment_code", S), ("currency_code", S), ("units_sold", I, N), ("gmv_local", AMT, N),
        ("active_merchants_end", I, N)]),
    "fact_pl": ("facts", 457896, PL_KEY, PL),
    "fact_pl_allocated": ("facts", 758364, PL_KEY, PL),
}


def arrow_schema(columns):
    return pa.schema([pa.field(c[0], c[1], nullable=len(c) > 2 and c[2]) for c in columns])


def read_and_check(table):
    """Strict parse of one CSV (any unparsable value raises) plus the checks. Returns (arrow table, problems)."""
    folder, expected_rows, key, columns = TABLES[table]
    path = DATA_DIR / folder / f"{table}.csv"
    schema = arrow_schema(columns)
    problems = []

    with open(path, encoding="utf-8", newline="") as fh:
        header = next(csv.reader(fh))
    if header != schema.names:
        return None, [f"header {header} != spec {schema.names}"]

    data = pacsv.read_csv(
        path,
        read_options=pacsv.ReadOptions(encoding="utf8"),
        parse_options=pacsv.ParseOptions(delimiter=",", quote_char='"', double_quote=True, newlines_in_values=False),
        convert_options=pacsv.ConvertOptions(
            column_types={f.name: f.type for f in schema},
            include_columns=schema.names,
            null_values=[""],
            strings_can_be_null=True,
            quoted_strings_can_be_null=False,
            true_values=["TRUE"],
            false_values=["FALSE"],
        ),
    )

    for f in schema:
        nulls = data.column(f.name).null_count
        if not f.nullable and nulls:
            problems.append(f"{nulls} empty value(s) in not-null column {f.name}")
    if data.num_rows != expected_rows:
        problems.append(f"rows {data.num_rows} != expected {expected_rows}")
    counts = data.group_by(key, use_threads=False).aggregate([([], "count_all")])
    dup_keys = pc.sum(pc.greater(counts.column("count_all"), 1).cast(pa.int64())).as_py() or 0
    if dup_keys:
        problems.append(f"{dup_keys} duplicate key(s) on {key}")

    if not problems:
        data = data.cast(schema)  # applies not-null flags; values are already typed
    return data, problems


def storage_options():
    from azure.identity import AzureCliCredential

    token = AzureCliCredential().get_token("https://storage.azure.com/.default").token
    return {"bearer_token": token, "use_fabric_endpoint": "true"}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--workspace", default=os.environ.get("FABRIC_WORKSPACE"), help="workspace id or name (env FABRIC_WORKSPACE)")
    ap.add_argument("--lakehouse", default=os.environ.get("FABRIC_LAKEHOUSE"), help="lakehouse id or <name>.Lakehouse (env FABRIC_LAKEHOUSE)")
    ap.add_argument("--dry-run", action="store_true", help="parse and check every table, write nothing")
    args = ap.parse_args()
    if not args.dry_run and not (args.workspace and args.lakehouse):
        ap.error("--workspace and --lakehouse (or FABRIC_WORKSPACE / FABRIC_LAKEHOUSE) are required unless --dry-run")

    loaded, failed = {}, 0
    for table in TABLES:
        data, problems = read_and_check(table)
        failed += bool(problems)
        print(f"{'FAIL' if problems else 'OK':4}  check  {table:26} rows {0 if data is None else data.num_rows:>9,}"
              + (f"  -> {'; '.join(problems)}" if problems else ""))
        loaded[table] = data
    if failed:
        print(f"{failed} table(s) failed the checks. Nothing written.")
        return 1
    if args.dry_run:
        print(f"Dry run: all {len(TABLES)} tables pass the checks. Nothing written.")
        return 0

    from deltalake import DeltaTable, write_deltalake

    base = f"abfss://{args.workspace}@onelake.dfs.fabric.microsoft.com/{args.lakehouse}/Tables/{SCHEMA}"
    opts = storage_options()
    for table, data in loaded.items():
        uri = f"{base}/{table}"
        write_deltalake(uri, data, mode="overwrite", schema_mode="overwrite", storage_options=opts)
        dt = DeltaTable(uri, storage_options=opts)
        rows = dt.count()
        ok = rows == data.num_rows
        failed += not ok
        print(f"{'OK' if ok else 'FAIL':4}  write  {SCHEMA}.{table:26} rows {rows:>9,}  version {dt.version()}")
    print(f"{len(TABLES) - failed} of {len(TABLES)} tables written and read back.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

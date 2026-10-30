"""Load data/acme_pl_dummy_data/*.csv into Lakehouse lh_raw, schema acme_pl, as typed Delta tables (ADR-0003).

Full overwrite per table (idempotent re-run). Every CSV is parsed strictly against the TABLES spec below
(the only place column types are declared) and checked before anything is written:
header = spec columns (names and order), row count = expected, 0 duplicate keys, no nulls in not-null columns.
If any table fails a check, nothing is written.

ADR-0008 step (a)+(b), derived in this script and checked before any write (spec section 7, C-10..C-13, C-36):
- pre-translated amounts appended to fact_pl, fact_pl_allocated (amount_*) and fact_operational (gmv_*):
  one column per reporting currency at the row version's own rate type (ACT/FC at the month's ACTUAL_AVG, BUD at
  BUDGET); translated per row, so the sum of any slice equals the month x currency translation the model does
  today (to within 0.5e-6 per row: rows are kept at 6 dp). Constant currency (C-12) gets no columns: the model
  iterates the 4 functional currencies x one BUDGET factor per currency and FY (ADR-0008 4.2 / 4.3).
- fact_pl_elim: one elimination row per intercompany row of fact_pl (account = the block's ELIM_* account,
  amounts negated). ACME Group = P + S + fact_pl_elim.

Usage (from the repo root, venv in fabric-data/.venv):
    fabric-data/.venv/Scripts/python fabric-data/lh_raw/load_acme_pl.py --dry-run
    fabric-data/.venv/Scripts/python fabric-data/lh_raw/load_acme_pl.py --workspace <ws> --lakehouse <lh>
    fabric-data/.venv/Scripts/python fabric-data/lh_raw/load_acme_pl.py --parquet-out <dir> [--tables t1,t2,...]

--parquet-out writes the same checked, typed tables as local Parquet files (<dir>/<table>.parquet) instead of the
lakehouse; --tables limits which tables are written (all tables are still checked and derived).

<ws> / <lh>: workspace and lakehouse IDs (CLAUDE.md > Workspaces), or names in OneLake form
("RAW", "lh_raw.Lakehouse"). Defaults come from the env vars FABRIC_WORKSPACE and FABRIC_LAKEHOUSE.
Auth: the signed-in Azure CLI account (`az login`); the token is never printed.

Spec: docs/Requirements.md section 8 (D-01 ... D-21), section 10 T-06; data contract data/acme_pl_dummy_data/README.md.
"""
import argparse
import csv
import decimal
import os
import sys
from collections import defaultdict
from decimal import Decimal
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

# ADR-0008: derived columns and tables. Same rule as TABLES: types are declared here and nowhere else.
XA = pa.decimal128(18, 6)  # pre-translated amount: per-row value rounded half-even to 6 dp (max ~2e7, sums exact to 1e-6/row)
REP_CCYS = ("USD", "EUR", "GBP")  # = param_reporting_currency (checked)


def translated(prefix, nullable=False):
    """One column per reporting currency (<prefix>_usd, _eur, _gbp) at the row version's own rate type."""
    tail = (N,) if nullable else ()
    return [(f"{prefix}_{c.lower()}", XA) + tail for c in REP_CCYS]


# table -> (local amount column it translates, derived columns appended after the CSV columns)
DERIVED_COLUMNS = {
    "fact_pl": ("amount_local", translated("amount")),
    "fact_pl_allocated": ("amount_local", translated("amount")),
    "fact_operational": ("gmv_local", translated("gmv", nullable=True)),
}
# fact_pl_elim (C-36): same key and columns as fact_pl; rows = fact_pl rows with a counterparty (expected 5,304)
ELIM_TABLE, ELIM_ROWS = "fact_pl_elim", 5304


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


CTX = decimal.Context(prec=40, rounding=decimal.ROUND_HALF_EVEN)
Q6 = Decimal("0.000001")
TOLERANCE = Decimal("0.01")  # pre-translated sums vs translation per month x currency (rounding of 6-dp rows only)


def rate_book(loaded):
    """FX lookups for the derivation, plus spec-vs-data problems: reporting currencies, and one BUDGET rate per
    currency and FY (C-10; the model's constant-currency path relies on it)."""
    problems = []
    reps = loaded["param_reporting_currency"].column("currency_code").to_pylist()
    if sorted(reps) != sorted(REP_CCYS):
        problems.append(f"param_reporting_currency {reps} != REP_CCYS {list(REP_CCYS)}")
    month = loaded["dim_month"]
    month_fy = dict(zip(month.column("month_key").to_pylist(), month.column("fiscal_year").to_pylist()))
    fx = loaded["fact_fx_rate"]
    rate = dict(zip(zip(*(fx.column(c).to_pylist() for c in ("currency_code", "month_key", "rate_type"))),
                    fx.column("local_per_usd").to_pylist()))
    budget = defaultdict(set)
    for (ccy, mk, rt), r in rate.items():
        if rt == "BUDGET":
            budget[(ccy, month_fy[mk])].add(r)
    multi = sorted(k for k, v in budget.items() if len(v) != 1)
    if multi:
        problems.append(f"more than one BUDGET rate per currency and FY (C-10): {multi}")
    return rate, month_fy, problems


def factors_for(rate, ccy, mk, version):
    """One multiplier per reporting currency for one (currency, month, version): C-11 (ACT / FC at ACTUAL_AVG of
    the month, BUD at BUDGET), cross rate local -> USD -> reporting currency (C-13)."""
    rt = "BUDGET" if version == "BUD" else "ACTUAL_AVG"
    return [CTX.divide(rate[(rep, mk, rt)], rate[(ccy, mk, rt)]) for rep in REP_CCYS]


def add_translations(table, data, rate, month_fy):
    """Appends the pre-translated columns (rounded half-even to 6 dp per row). Checks, per version x fiscal year and
    column: sum of the rows = sum over (currency, month) of the local sum x the same multiplier, within TOLERANCE."""
    local_col, columns = DERIVED_COLUMNS[table]
    keys = zip(*(data.column(c).to_pylist() for c in ("currency_code", "month_key", "version_key")))
    local = data.column(local_col).to_pylist()
    cache, problems = {}, []
    out = [[] for _ in columns]
    row_sums = defaultdict(lambda: [Decimal(0)] * len(columns))  # (version, fy) -> per-column sum of rows
    local_sums = defaultdict(Decimal)  # (currency, month, version) -> local sum
    for key, x in zip(keys, local):
        f = cache.get(key)
        if f is None:
            try:
                f = cache[key] = factors_for(rate, *key)
            except KeyError as e:
                return data, [f"no FX rate for {e.args[0]} (row key {key})"], Decimal(0)
        if x is None:
            for o in out:
                o.append(None)
            continue
        local_sums[key] += x
        acc = row_sums[(key[2], month_fy[key[1]])]
        for i, (o, fi) in enumerate(zip(out, f)):
            v = CTX.multiply(x, fi).quantize(Q6, context=CTX)
            o.append(v)
            acc[i] += v
    expected = defaultdict(lambda: [Decimal(0)] * len(columns))
    for key, s in local_sums.items():
        acc = expected[(key[2], month_fy[key[1]])]
        for i, fi in enumerate(cache[key]):
            acc[i] += CTX.multiply(s, fi)
    worst = max((abs(row_sums[k][i] - expected[k][i]) for k in expected for i in range(len(columns))), default=Decimal(0))
    if worst > TOLERANCE:
        problems.append(f"pre-translated sums differ from translation per month x currency by {worst}")
    for (name, typ, *nullable), values in zip(columns, out):
        data = data.append_column(pa.field(name, typ, nullable=bool(nullable)), pa.array(values, type=typ))
    return data, problems, worst


def build_elim(loaded):
    """fact_pl_elim (C-36, D-33): every fact_pl row with a counterparty, account replaced by its block's elimination
    account (dim_account: is_intercompany, not has_fact_rows, is_direct: ELIM_GR / ELIM_VSC), every amount negated.
    Checks: expected rows, unique key, and per version x month x region the eliminations net to 0 in local currency
    (both intercompany sides match, so contribution margin is unchanged and the C-37 difference is 0)."""
    acc = loaded["dim_account"]
    cols = {c: acc.column(c).to_pylist() for c in ("account_code", "block_code", "is_intercompany", "has_fact_rows",
                                                    "is_direct")}
    block_of = dict(zip(cols["account_code"], cols["block_code"]))
    elim_of = defaultdict(list)
    for code, blk, ic, has_rows, direct in zip(*cols.values()):
        if ic and not has_rows and direct:
            elim_of[blk].append(code)
    pl = loaded["fact_pl"]
    ic_rows = pl.filter(pc.is_valid(pl.column("counterparty_entity_code")))
    problems, mapped = [], []
    for code in ic_rows.column("account_code").to_pylist():
        target = elim_of.get(block_of[code], [])
        if len(target) != 1:
            return None, [f"block {block_of[code]} of {code} has {len(target)} elimination accounts, expected 1"]
        mapped.append(target[0])
    elim = ic_rows.set_column(ic_rows.schema.get_field_index("account_code"),
                              pl.schema.field("account_code"), pa.array(mapped, type=S))
    for name in ["amount_local"] + [c[0] for c in DERIVED_COLUMNS["fact_pl"][1]]:
        i = elim.schema.get_field_index(name)
        elim = elim.set_column(i, elim.schema.field(name), pc.negate_checked(elim.column(name)))
    if elim.num_rows != ELIM_ROWS:
        problems.append(f"rows {elim.num_rows} != expected {ELIM_ROWS}")
    counts = elim.group_by(PL_KEY, use_threads=False).aggregate([([], "count_all")])
    if counts.num_rows != elim.num_rows:
        problems.append(f"{elim.num_rows - counts.num_rows} duplicate key(s) on {PL_KEY}")
    net = elim.group_by(["version_key", "month_key", "region_code"], use_threads=False).aggregate(
        [("amount_local", "sum")])
    off = sum(1 for v in net.column("amount_local_sum").to_pylist() if v != 0)
    if off:
        problems.append(f"{off} version x month x region group(s) where eliminations do not net to 0 (C-37)")
    return elim, problems


def derive(loaded):
    """ADR-0008 (a) + (b) in place on `loaded`. Returns [(table, rows, note, problems)] for the report lines."""
    rate, month_fy, problems = rate_book(loaded)
    if problems:
        return [("fact_fx_rate", 0, "", problems)]
    report = []
    for table in DERIVED_COLUMNS:
        data, probs, worst = add_translations(table, loaded[table], rate, month_fy)
        loaded[table] = data
        report.append((table, data.num_rows, f"+{len(DERIVED_COLUMNS[table][1])} cols, max sum diff {worst:.6f}",
                       probs))
    elim, probs = build_elim(loaded)
    if elim is not None:
        loaded[ELIM_TABLE] = elim
    report.append((ELIM_TABLE, 0 if elim is None else elim.num_rows, "derived from fact_pl", probs))
    return report


def storage_options():
    from azure.identity import AzureCliCredential

    token = AzureCliCredential().get_token("https://storage.azure.com/.default").token
    return {"bearer_token": token, "use_fabric_endpoint": "true"}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--workspace", default=os.environ.get("FABRIC_WORKSPACE"), help="workspace id or name (env FABRIC_WORKSPACE)")
    ap.add_argument("--lakehouse", default=os.environ.get("FABRIC_LAKEHOUSE"), help="lakehouse id or <name>.Lakehouse (env FABRIC_LAKEHOUSE)")
    ap.add_argument("--dry-run", action="store_true", help="parse and check every table, write nothing")
    ap.add_argument("--parquet-out", help="write local Parquet files to this folder instead of the lakehouse")
    ap.add_argument("--tables", help="with --parquet-out: comma-separated tables to write (default: all)")
    args = ap.parse_args()
    if not args.dry_run and not args.parquet_out and not (args.workspace and args.lakehouse):
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
    for table, rows, note, problems in derive(loaded):
        failed += bool(problems)
        print(f"{'FAIL' if problems else 'OK':4}  derive {table:26} rows {rows:>9,}  {note}"
              + (f"  -> {'; '.join(problems)}" if problems else ""))
    if failed:
        print(f"{failed} derived table(s) failed the checks. Nothing written.")
        return 1
    if args.dry_run:
        print(f"Dry run: all {len(loaded)} tables pass the checks. Nothing written.")
        return 0
    if args.parquet_out:
        import pyarrow.parquet as pq

        names = args.tables.split(",") if args.tables else list(loaded)
        unknown = [t for t in names if t not in loaded]
        if unknown:
            print(f"Unknown table(s) {unknown}. Nothing written.")
            return 1
        out = Path(args.parquet_out)
        out.mkdir(parents=True, exist_ok=True)
        for table in names:
            path = out / f"{table}.parquet"
            pq.write_table(loaded[table], path, compression="snappy")
            rows = pq.read_metadata(path).num_rows
            ok = rows == loaded[table].num_rows
            failed += not ok
            print(f"{'OK' if ok else 'FAIL':4}  parquet {table:26} rows {rows:>9,}  {path.stat().st_size:>10,} bytes")
        print(f"{len(names) - failed} of {len(names)} tables written to Parquet and read back.")
        return 1 if failed else 0

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
    print(f"{len(loaded) - failed} of {len(loaded)} tables written and read back.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

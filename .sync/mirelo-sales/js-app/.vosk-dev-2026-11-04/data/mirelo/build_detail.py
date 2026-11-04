"""Full loan / client detail for the Mirelo JS report's detail window (2026-11-01).

The pack shipped a capped sample (detail-loans / detail-clients). The owner wants every list complete, so this script
cuts the generator's full output into small Parquet files the browser loads on demand:

  detail/loans-YYYY-MM.parquet     every loan disbursed in that closed month (Show loans, agent lists)
  detail/cohort-YYYY-MM.parquet    every client whose first loan is in that month, with its to-date summary (client lists)
  detail/overdue.parquet           every loan 30+ DPD with a balance at the last close (overdue lists)
  detail/client-NN.parquet         every loan of the clients with client_id % 64 == NN (client card)
  detail/client-dim-NN.parquet     those clients' dim rows (client card)
  detail/index.json                rows and bytes per file, the last close, the bucket count

Input: the `parquet/` folder of `data-gen/mirelo-sales/generator/generate.py` (seed 20261026; the same data as the
report's aggregates, checked by its control totals). Usage, with the generator's pinned venv:

  python -I data/mirelo/build_detail.py <generator out>/parquet public/data/mirelo/detail

Column names and types follow the pack's detail-loans / detail-clients (src/lib/mirelo/manifest.ts FILES).
"""

import json
import sys
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

BUCKETS = 64
LAST_CLOSE = "2026-09-30"

LOAN_SCHEMA = pa.schema(
    [
        pa.field("loan_id", pa.int32(), nullable=False),
        pa.field("client_id", pa.int32(), nullable=False),
        pa.field("disbursed", pa.string(), nullable=False),
        pa.field("market", pa.string(), nullable=False),
        pa.field("product", pa.string(), nullable=False),
        pa.field("channel", pa.string(), nullable=False),
        pa.field("agent", pa.string()),
        pa.field("repeat", pa.bool_(), nullable=False),
        pa.field("principal_local", pa.float64(), nullable=False),
        pa.field("hours_to_cash", pa.float64(), nullable=False),
        pa.field("status", pa.string(), nullable=False),
        pa.field("dpd_close", pa.int32(), nullable=False),
        pa.field("outstanding_close_local", pa.float64(), nullable=False),
    ]
)
DIM_SCHEMA = pa.schema(
    [
        pa.field("client_id", pa.int32(), nullable=False),
        pa.field("market", pa.string(), nullable=False),
        pa.field("segment", pa.string(), nullable=False),
        pa.field("acquisition_channel", pa.string(), nullable=False),
        pa.field("acquisition_agent", pa.string()),
        pa.field("first_loan_date", pa.string(), nullable=False),
        pa.field("first_product", pa.string(), nullable=False),
        pa.field("cohort_month", pa.string(), nullable=False),
        pa.field("birth_year_band", pa.string(), nullable=False),
        pa.field("city_tier", pa.int32(), nullable=False),
        pa.field("loans_before_2024", pa.int32(), nullable=False),
    ]
)
COHORT_SCHEMA = pa.schema(
    [
        *DIM_SCHEMA,
        pa.field("loans_to_date", pa.int32(), nullable=False),  # fact loans through the close + loans before 2024
        pa.field("principal_eur_to_date", pa.float64(), nullable=False),  # since 2024, at each month's actual rate
        pa.field("last_disbursed", pa.string(), nullable=False),
        pa.field("last_status", pa.string(), nullable=False),
    ]
)


def write(df: pd.DataFrame, schema: pa.Schema, path: Path, index: dict) -> None:
    table = pa.Table.from_pandas(df[schema.names], schema=schema, preserve_index=False)
    pq.write_table(table, path, compression="snappy", row_group_size=1 << 20)
    index["files"][path.name] = {"rows": table.num_rows, "bytes": path.stat().st_size}


def main(src: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.parquet"):
        old.unlink()

    fl = pq.read_table(src / "fact_loan.parquet").to_pandas()
    fl["disbursed"] = fl["disbursed_date"].astype(str)
    fl = fl[fl["disbursed"] <= LAST_CLOSE]  # October 2026 is open: no states at the close
    loans = pd.DataFrame(
        {
            "loan_id": fl["loan_id"],
            "client_id": fl["client_id"],
            "disbursed": fl["disbursed"],
            "market": fl["market_code"],
            "product": fl["product_code"],
            "channel": fl["channel_code"],
            "agent": fl["agent_code"],
            "repeat": fl["is_repeat"],
            "principal_local": fl["principal_local"],
            "hours_to_cash": fl["hours_to_cash"],
            "status": fl["status_code"],
            "dpd_close": fl["dpd_days_close"].astype("int32"),
            "outstanding_close_local": fl["outstanding_local_close"],
            "principal_eur": fl["principal_eur"],
        }
    ).sort_values(["client_id", "disbursed", "loan_id"], kind="stable")

    dc = pq.read_table(src / "dim_client.parquet").to_pandas()
    dims = pd.DataFrame(
        {
            "client_id": dc["client_id"],
            "market": dc["market_code"],
            "segment": dc["segment_code"],
            "acquisition_channel": dc["acquisition_channel_code"],
            "acquisition_agent": dc["acquisition_agent_code"],
            "first_loan_date": dc["first_loan_date"].astype(str),
            "first_product": dc["first_product_code"],
            "cohort_month": dc["cohort_month"],
            "birth_year_band": dc["birth_year_band"],
            "city_tier": dc["city_tier"],
            "loans_before_2024": dc["loans_before_2024"],
        }
    )

    index = {"lastClose": LAST_CLOSE, "buckets": BUCKETS, "files": {}}

    # every loan per disbursement month
    loans["month"] = loans["disbursed"].str.slice(0, 7)
    by_loan = loans.sort_values("loan_id", kind="stable")
    for month, part in by_loan.groupby("month", sort=True):
        write(part, LOAN_SCHEMA, out / f"loans-{month}.parquet", index)

    # client summaries per cohort month (the cohort lists); last loan = file order client, disbursed, loan id
    agg = loans.groupby("client_id", sort=False).agg(
        n=("loan_id", "size"),
        principal_eur_to_date=("principal_eur", "sum"),
        last_disbursed=("disbursed", "last"),
        last_status=("status", "last"),
    )
    cohort = dims.merge(agg, left_on="client_id", right_index=True, how="inner")
    cohort["loans_to_date"] = (cohort["n"] + cohort["loans_before_2024"]).astype("int32")
    cohort = cohort[(cohort["cohort_month"] >= "2024-01") & (cohort["cohort_month"] <= LAST_CLOSE[:7])]
    for month, part in cohort.sort_values("client_id").groupby("cohort_month", sort=True):
        write(part, COHORT_SCHEMA, out / f"cohort-{month}.parquet", index)

    # every overdue loan at the last close
    overdue = by_loan[(by_loan["dpd_close"] >= 30) & (by_loan["outstanding_close_local"] > 0)]
    write(overdue, LOAN_SCHEMA, out / "overdue.parquet", index)

    # client card buckets
    loans["bucket"] = loans["client_id"] % BUCKETS
    dims["bucket"] = dims["client_id"] % BUCKETS
    for b in range(BUCKETS):
        write(loans[loans["bucket"] == b], LOAN_SCHEMA, out / f"client-{b:02d}.parquet", index)
        write(dims[dims["bucket"] == b].sort_values("client_id"), DIM_SCHEMA, out / f"client-dim-{b:02d}.parquet", index)

    (out / "index.json").write_text(json.dumps(index, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    total = sum(f["bytes"] for f in index["files"].values())
    print(f"{len(index['files'])} files, {total / 1e6:.1f} MB, loans {len(loans)}, cohort clients {len(cohort)}, overdue {len(overdue)}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))

# Fabric notebook source

# METADATA ********************

# META {
# META   "kernel_info": {
# META     "name": "synapse_pyspark"
# META   },
# META   "dependencies": {
# META     "lakehouse": {
# META       "default_lakehouse": "{{LAKEHOUSE_ID}}",
# META       "default_lakehouse_name": "lh_sales_demo",
# META       "default_lakehouse_workspace_id": "{{WORKSPACE_ID}}"
# META     }
# META   }
# META }

# CELL ********************

from datetime import date
from pyspark.sql import functions as F

SEED_SALT       = 42            # change to get a different but still repeatable dataset
N_CUSTOMERS     = 200_000
N_PRODUCTS      = 2_500
N_STORES        = 100
N_SALES         = 30_000_000    # order lines in raw_sales / fact_sales
START_DATE      = "2024-01-01"
END_DATE        = "2026-10-31"
DISCOUNT_LEVELS = 31            # 0%..30% in 1% steps; more levels = more distinct net prices
TABLE_FORMAT    = "delta"

N_DAYS = (date.fromisoformat(END_DATE) - date.fromisoformat(START_DATE)).days + 1

FIRST_NAMES = ["Alex", "Sam", "Maria", "Chen", "Priya", "Omar", "Elena", "Jonas",
               "Aiko", "Lucas", "Nora", "Ivan", "Sofia", "Tariq", "Mia", "Noah"]
LAST_NAMES  = ["Novak", "Silva", "Kim", "Meyer", "Rossi", "Haddad", "Jensen", "Tanaka",
               "Okafor", "Dubois", "Kowalski", "Singh", "Larsen", "Costa", "Yilmaz", "Brown"]
COUNTRIES   = ["Germany", "United Kingdom", "France", "Netherlands",
               "Spain", "Italy", "Sweden", "Poland"]
SEGMENTS    = ["Consumer", "Consumer", "Consumer", "Business"]          # 75 / 25
BRANDS      = ["Alder", "Birch", "Cedar", "Dune", "Ember", "Fjord", "Grove", "Harbor", "Iris",
               "Juno", "Kite", "Lumen", "Mesa", "Nimbus", "Orchid", "Pike", "Quartz", "Ridge",
               "Sable", "Terra", "Umber", "Vale", "Willow", "Xenon", "Yarrow"]
CATEGORIES  = ["Audio", "Computers", "Phones", "Cameras", "Home", "Gaming"]


def u(col, salt):
    """Repeatable uniform number in [0, 1) per row, independent of partitioning."""
    h = F.xxhash64(F.col(col), F.lit(salt), F.lit(SEED_SALT))
    return F.pmod(h, F.lit(1_000_000)) / F.lit(1_000_000.0)


def pick(values, col, salt):
    """Repeatable choice from a Python list per row."""
    arr = F.array(*[F.lit(v) for v in values])
    idx = (u(col, salt) * len(values)).cast("int") + 1
    return F.element_at(arr, idx)


def save(df, name, mode="overwrite"):
    writer = df.write.format(TABLE_FORMAT).mode(mode)
    if mode == "overwrite":
        writer = writer.option("overwriteSchema", "true")
    writer.saveAsTable(name)


def gen_raw_sales(first_id, n_rows, product_df, fixed_date=None):
    """Order lines sales_id = first_id .. first_id + n_rows - 1. About 3 lines per order."""
    df = (
        spark.range(first_id, first_id + n_rows).withColumnRenamed("id", "sales_id")
        .withColumn("order_id", F.floor((F.col("sales_id") - 1) / 3) + 1)
        .withColumn("customer_id", (F.pow(u("order_id", 32), 2) * N_CUSTOMERS).cast("long") + 1)
        .withColumn("store_id", (u("order_id", 33) * N_STORES).cast("long") + 1)
        .withColumn("product_id", (F.pow(u("sales_id", 34), 1.5) * N_PRODUCTS).cast("long") + 1)
        .withColumn("quantity", (F.pow(u("sales_id", 35), 3) * 10).cast("int") + 1)
        .withColumn("discount_pct", F.floor(u("sales_id", 36) * DISCOUNT_LEVELS) / F.lit(100.0))
    )
    if fixed_date is None:   # pow < 1 pushes more orders to recent dates, so the trend rises
        df = df.withColumn(
            "order_date",
            F.date_add(F.lit(START_DATE).cast("date"), (F.pow(u("order_id", 31), 0.7) * N_DAYS).cast("int")),
        )
    else:
        df = df.withColumn("order_date", F.lit(str(fixed_date)).cast("date"))
    return (
        df.join(F.broadcast(product_df.select("product_id", "unit_price", "unit_cost")), "product_id")
        .withColumn("net_price", F.round(F.col("unit_price") * (F.lit(1.0) - F.col("discount_pct")), 2))
        .withColumn("load_ts", F.current_timestamp())
        .select("sales_id", "order_id", "order_date", "customer_id", "product_id", "store_id",
                "quantity", "unit_price", "discount_pct", "net_price", "unit_cost", "load_ts")
    )


def to_fact_sales(raw_sales_df):
    """Gold shape: keys renamed, amounts materialized, money as decimal(18,2)."""
    money = "decimal(18,2)"
    return raw_sales_df.select(
        "sales_id",
        "order_id",
        "order_date",
        F.col("customer_id").alias("customer_key"),
        F.col("product_id").alias("product_key"),
        F.col("store_id").alias("store_key"),
        "quantity",
        F.col("net_price").cast(money).alias("net_price"),
        F.col("unit_cost").cast(money).alias("unit_cost"),
        F.round(F.col("quantity") * F.col("net_price"), 2).cast(money).alias("net_amount"),
        F.round(F.col("quantity") * F.col("unit_cost"), 2).cast(money).alias("cost_amount"),
        "load_ts",
    )

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

# CELL ********************

spark.conf.set("spark.sql.parquet.vorder.default", "true")   # V-Order: faster Direct Lake reads

N_NEW = 50_000

last = spark.table("raw_sales").agg(F.max("sales_id").alias("id"), F.max("order_date").alias("d")).first()
new_day = spark.sql(f"select date_add(date'{last['d']}', 1) as d").first()["d"]

new_raw = gen_raw_sales(last["id"] + 1, N_NEW, spark.table("raw_product"), fixed_date=new_day).cache()
save(new_raw, "raw_sales", mode="append")
save(to_fact_sales(new_raw), "fact_sales", mode="append")

print(f"Appended {new_raw.count():,} lines for {new_day}")

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

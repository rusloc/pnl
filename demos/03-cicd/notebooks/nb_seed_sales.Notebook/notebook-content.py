# Fabric notebook source

# METADATA ********************

# META {
# META   "kernel_info": {
# META     "name": "synapse_pyspark"
# META   },
# META   "dependencies": {
# META     "lakehouse": {
# META       "default_lakehouse": "{{LAKEHOUSE_ID}}",
# META       "default_lakehouse_name": "lh_cicd_demo",
# META       "default_lakehouse_workspace_id": "{{WORKSPACE_ID}}"
# META     }
# META   }
# META }

# CELL ********************

from pyspark.sql import functions as F

SEED_ROWS = 50_000
CATEGORIES = ["Audio", "Computers", "Phones", "Cameras", "Home"]

spark.conf.set("spark.sql.parquet.vorder.default", "true")
env_name = notebookutils.runtime.context.get("currentWorkspaceName", "unknown")


def u(col, salt):
    """Repeatable uniform number in [0, 1) per row."""
    return F.pmod(F.xxhash64(F.col(col), F.lit(salt)), F.lit(1_000_000)) / F.lit(1_000_000.0)


def save(df, name):
    df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(name)


dim_environment = spark.createDataFrame([(env_name,)], "environment string").withColumn("seeded_at", F.current_timestamp())

dim_date = (
    spark.sql("select explode(sequence(date'2026-01-01', date'2026-12-31', interval 1 day)) as date")
    .withColumn("month_no", F.month("date"))
    .withColumn("month_name", F.date_format("date", "MMM"))
)

cat_arr = F.array(*[F.lit(c) for c in CATEGORIES])
dim_product = (
    spark.range(1, 51).withColumnRenamed("id", "product_key")
    .withColumn("category", F.element_at(cat_arr, (F.col("product_key") % len(CATEGORIES)).cast("int") + 1))
    .withColumn("product_name", F.concat_ws(" ", "category", F.lpad(F.col("product_key").cast("string"), 2, "0")))
    .withColumn("unit_price", F.round(F.lit(10.0) + u("product_key", 1) * 490, 2).cast("decimal(18,2)"))
    .withColumn("unit_cost", F.round(F.col("unit_price") * 0.6, 2).cast("decimal(18,2)"))
)

fact_sales = (
    spark.range(1, SEED_ROWS + 1).withColumnRenamed("id", "sales_id")
    .withColumn("order_date", F.date_add(F.lit("2026-01-01").cast("date"), (u("sales_id", 2) * 300).cast("int")))
    .withColumn("product_key", (u("sales_id", 3) * 50).cast("long") + 1)
    .withColumn("quantity", (u("sales_id", 4) * 5).cast("int") + 1)
    .join(F.broadcast(dim_product.select("product_key", "unit_price", "unit_cost")), "product_key")
    .select(
        "sales_id", "order_date", "product_key", "quantity",
        F.round(F.col("quantity") * F.col("unit_price"), 2).cast("decimal(18,2)").alias("net_amount"),
        F.round(F.col("quantity") * F.col("unit_cost"), 2).cast("decimal(18,2)").alias("cost_amount"),
    )
)

for name, df in [("dim_environment", dim_environment), ("dim_date", dim_date),
                 ("dim_product", dim_product), ("fact_sales", fact_sales)]:
    save(df, name)
    print(name, spark.table(name).count())

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

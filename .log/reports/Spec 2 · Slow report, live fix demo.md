# Spec 2 · Slow report, live fix demo

Nov 23, 2026 · @KIRILL

Build a sample Import report where one matrix takes seconds to render because of a single badly written measure, then fix that measure on screen and show the same numbers arriving at least 10 times faster.

## 1. Storyline

The video shows one slow visual, finds the single measure behind it, rewrites one argument, and shows the same numbers arriving fast. The viewer should leave thinking "my slow report might be one line of DAX".

| Time | On screen | Voice-over point |
| --- | --- | --- |
| 0:00 | The brand-by-month matrix spins for several seconds after a slicer click | Every click costs this much |
| 0:15 | Performance analyzer: the matrix's DAX query time | It is the query, not the visual |
| 0:35 | DAX Studio, Server Timings: total time, formula engine share, rows materialized | The engine is hauling millions of rows it does not need |
| 1:00 | The measure, with `FILTER ( Sales, ...)` highlighted | The filter is on the whole table |
| 1:20 | Rewrite to a column filter; run again; new timing | Filter the columns, not the table |
| 1:50 | Check query returns no differences; paste the fix into the model | Same numbers |
| 2:10 | Matrix responds at once to the same slicer click | Before and after, in milliseconds |
| 2:25 | Closing card | Model tune-up, 3 to 5 days, $900 |

All timings on screen come from the recorded run. This spec gives expected ranges only.

## 2. Assets to build

| Asset | Type | Name | Notes |
| --- | --- | --- | --- |
| Workspace | Fabric workspace | `ws_migration_demo` | Shared with Spec 1 if it exists |
| Lakehouse | Lakehouse, no schemas | `lh_sales_demo` | If Spec 1 already built it, reuse it and skip section 4's notebook |
| Build notebook | PySpark notebook | `nb_01_build_sales_demo` | Section 4 |
| Slow report | Power BI Desktop file, Import | `Slow Report Demo.pbix` | The "before" state; keep a clean copy |
| Fixed report | Power BI Desktop file | `Slow Report Demo - fixed.pbix` | Copy with the optimized measure, for the after shots |
| Measure text | Text file | `measures.dax` | Both measure bodies from section 6, ready to paste |
| Test queries | Text file | `perf_test.dax` | The queries from section 7 |
| Results | Markdown file | `perf_log.md` | Timings from section 8 |

## 3. Prerequisites and assumptions

**Tools**

- A current Power BI Desktop. Performance analyzer sits on the **Optimize** ribbon and can copy a visual's DAX query or run it in DAX query view ([Performance analyzer](https://learn.microsoft.com/power-bi/create-reports/performance-analyzer)).
- [DAX Studio](https://daxstudio.org), free, for Server Timings. Power BI Desktop shows total query time only; DAX Studio splits it into formula engine and storage engine time.
- A Fabric workspace for the lakehouse that holds the sample data. A trial capacity is enough.
- A machine with 16 GB of RAM or more. The model holds 20 million rows and the slow query builds a large intermediate result.

**Assumptions taken in this spec**

- The model is Import mode, loaded from the lakehouse's SQL analytics endpoint. Microsoft's guidance on this pattern is aimed at Import tables ([Avoid using FILTER as a filter argument](https://learn.microsoft.com/dax/best-practices/dax-avoid-avoid-filter-as-filter-argument)).
- Timings depend on the machine. The spec sets a target gap, not fixed numbers.
- No DAX was executed while writing this spec. The measures follow a documented pattern, but the speed gap on this dataset is expected, not measured. Section 8 has the gate and a fallback.

**Rules for whoever builds this**

- Use the names in sections 2, 4 and 5 exactly.
- Do not change a measure to make a check pass. Change the data volume as section 8 describes, and say so in `perf_log.md`.
- Synthetic data only.

## 4. Data model and generator

The report runs on a small star schema: one 20-million-row fact table and four dimensions. The fact table's Net Price column has many distinct values on purpose; that is what makes the slow measure slow.

**Lakehouse tables used by the model**

| Table | Rows | Columns loaded | Model table |
| --- | --- | --- | --- |
| `fact_sales` | 20,000,000 | order\_date, customer\_key, product\_key, store\_key, quantity, net\_price, net\_amount | Sales |
| `dim_product` | 2,500 | product\_key, product\_name, brand, category, price\_band | Product |
| `dim_customer` | 200,000 | customer\_key, customer\_name, country, segment | Customer |
| `dim_store` | 100 | store\_key, store\_name, channel | Store |
| `dim_date` | 1,096 | date, year, month\_no, month\_name, year\_month, quarter | Date |

Friendly names in the model: Sales\[Order Date\], Sales\[Customer Key\], Sales\[Product Key\], Sales\[Store Key\], Sales\[Quantity\], Sales\[Net Price\], Sales\[Net Amount\]; Product\[Brand\], Product\[Category\]; Customer\[Country\]; Date\[Date\], Date\[Year\], Date\[Year Month\]; and so on in the same style. Do not load `sales_id`, `order_id`, `unit_cost`, `cost_amount` or `load_ts`.

Relationships, all many-to-one, single direction: Sales\[Customer Key\] to Customer, Sales\[Product Key\] to Product, Sales\[Store Key\] to Store, Sales\[Order Date\] to Date\[Date\]. Mark Date as the date table. Hide the key columns.

**Generator.** One PySpark notebook, `nb_01_build_sales_demo`, with `lh_sales_demo` as its default lakehouse. It writes raw tables first, then the gold tables above. This code ran end to end on local Spark 3.5 at 600,000 rows writing Parquet, with clean row counts, no nulls and no orphan keys. The Delta writes and the full-size run in Fabric were not tested here; do a first run with `N_SALES = 300_000`.

Cell 1, config and helpers:

```python
from datetime import date
from pyspark.sql import functions as F

SEED_SALT       = 42            # change to get a different but still repeatable dataset
N_CUSTOMERS     = 200_000
N_PRODUCTS      = 2_500
N_STORES        = 100
N_SALES         = 20_000_000    # order lines in raw_sales / fact_sales
START_DATE      = "2024-01-01"
END_DATE        = "2026-10-31"
DISCOUNT_LEVELS = 7             # 0%..6% in 1% steps; more levels = more distinct net prices
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
```

Cells 2 and 3, raw layer then gold layer:

```python
# ---- cell 2: raw layer ----
spark.conf.set("spark.sql.parquet.vorder.default", "true")

raw_customer = (
    spark.range(1, N_CUSTOMERS + 1).withColumnRenamed("id", "customer_id")
    .withColumn("first_name", pick(FIRST_NAMES, "customer_id", 1))
    .withColumn("last_name", pick(LAST_NAMES, "customer_id", 2))
    .withColumn("country", pick(COUNTRIES, "customer_id", 3))
    .withColumn("segment", pick(SEGMENTS, "customer_id", 4))
    .withColumn("signup_date", F.date_add(F.lit("2019-01-01").cast("date"), (u("customer_id", 5) * 1800).cast("int")))
)

raw_product = (
    spark.range(1, N_PRODUCTS + 1).withColumnRenamed("id", "product_id")
    .withColumn("brand", pick(BRANDS, "product_id", 11))
    .withColumn("category", pick(CATEGORIES, "product_id", 12))
    .withColumn("product_name", F.concat_ws(" ", "brand", "category", F.lpad(F.col("product_id").cast("string"), 4, "0")))
    .withColumn("unit_price", F.round(F.lit(5.0) * F.pow(F.lit(300.0), u("product_id", 13)), 2))   # 5 .. 1500
    .withColumn("unit_cost", F.round(F.col("unit_price") * (F.lit(0.45) + u("product_id", 14) * 0.30), 2))
)

raw_store = (
    spark.range(1, N_STORES + 1).withColumnRenamed("id", "store_id")
    .withColumn("country", pick(COUNTRIES, "store_id", 21))
    .withColumn("channel", F.when(F.col("store_id") <= 10, F.lit("Online")).otherwise(F.lit("Retail")))
    .withColumn("store_name", F.concat_ws(" ", "channel", "country", F.col("store_id").cast("string")))
)

save(raw_customer, "raw_customer")
save(raw_product, "raw_product")
save(raw_store, "raw_store")
save(gen_raw_sales(1, N_SALES, spark.table("raw_product")), "raw_sales")

# ---- cell 3: gold layer ----
dim_customer = spark.table("raw_customer").select(
    F.col("customer_id").alias("customer_key"),
    F.concat_ws(" ", "first_name", "last_name").alias("customer_name"),
    "country",
    "segment",
    "signup_date",
)

dim_product = spark.table("raw_product").select(
    F.col("product_id").alias("product_key"),
    "product_name",
    "brand",
    "category",
    F.col("unit_price").cast("decimal(18,2)").alias("unit_price"),
    F.when(F.col("unit_price") < 50, F.lit("Budget"))
     .when(F.col("unit_price") < 300, F.lit("Mid"))
     .otherwise(F.lit("Premium")).alias("price_band"),
)

dim_store = spark.table("raw_store").select(
    F.col("store_id").alias("store_key"), "store_name", "country", "channel"
)

dim_date = (
    spark.sql(f"select explode(sequence(date'{START_DATE[:4]}-01-01', date'{END_DATE[:4]}-12-31', interval 1 day)) as date")
    .withColumn("year", F.year("date"))
    .withColumn("month_no", F.month("date"))
    .withColumn("month_name", F.date_format("date", "MMM"))
    .withColumn("year_month", F.date_format("date", "yyyy-MM"))
    .withColumn("quarter", F.concat(F.lit("Q"), F.quarter("date").cast("string")))
)

save(dim_customer, "dim_customer")
save(dim_product, "dim_product")
save(dim_store, "dim_store")
save(dim_date, "dim_date")
save(to_fact_sales(spark.table("raw_sales")), "fact_sales")

for t in ["raw_customer", "raw_product", "raw_store", "raw_sales",
          "dim_customer", "dim_product", "dim_store", "dim_date", "fact_sales"]:
    print(t, spark.table(t).count())
```

If `lh_sales_demo` already exists from Spec 1, it has 30 million rows and 31 discount levels. That is fine; the slow measure will simply be slower. Check it against the ceiling in section 8.

## 5. Report spec

One page, one slow visual, and two slicers that make the viewer feel the wait on every click.

**Build steps**

1. In Power BI Desktop, open **OneLake catalog**, pick `lh_sales_demo`, choose **Connect to SQL endpoint**, select **Import**, and load the five tables from section 4.
2. In Power Query, only remove the unused columns and rename to friendly names. No other steps.
3. Add the relationships from section 4.
4. Create the two measures from section 6 on the Sales table: Sales Amount, and Big Line Sales with the **slow** body.
5. Build the page below and save as `Slow Report Demo.pbix`.

**Page "Sales by brand", 1280 x 720**

| Visual | Fields | Role in the video |
| --- | --- | --- |
| Text box | "Sales from big order lines (line value 500 or more)" | Title |
| Matrix | Rows: Product\[Brand\]. Columns: Date\[Year Month\]. Values: Big Line Sales | The slow visual: 25 brands by 34 months |
| Card | Big Line Sales | Total; must not change after the fix |
| Card | Sales Amount | A fast measure on the same page, for contrast |
| Slicer, dropdown | Customer\[Country\] | The click that triggers the wait |
| Slicer, tiles | Product\[Category\] | Second trigger |

Keep row and column subtotals on in the matrix. Do not add other visuals that use Big Line Sales; the analyzer output should point at one culprit.

## 6. The two measures

Both versions answer the same question: sales from order lines worth 500 or more. They differ in one argument.

**Base measure**

```dax
Sales Amount = SUM ( Sales[Net Amount] )
```

**Slow version.** This is the body Big Line Sales starts with.

```dax
Big Line Sales =
CALCULATE (
    [Sales Amount]
    ,FILTER (
        Sales
        ,Sales[Quantity] * Sales[Net Price] >= 500
    )
)
```

**Optimized version.** This is what the live fix pastes in.

```dax
Big Line Sales =
CALCULATE (
    [Sales Amount]
    ,KEEPFILTERS ( Sales[Quantity] * Sales[Net Price] >= 500 )
)
```

**Why the first one is slow.** `FILTER ( Sales, ...)` hands CALCULATE a filter made of whole rows of Sales, including every column of the tables related to it. To apply it, the engine first builds a large intermediate table of matching combinations and then works through it in the single-threaded formula engine. The second version names only two columns, so the storage engine applies the condition while it scans the table, in parallel, and returns a handful of rows.

**Why KEEPFILTERS.** `FILTER ( Sales, ...)` respects whatever filters are already on Sales. KEEPFILTERS gives the column version the same behaviour, so both return identical numbers in this report.

**How big a gap to expect.** SQLBI benchmarked the same threshold and the same fix on a 10-million-row model and reported 6,232 ms for the table filter against 53 ms for the column filter, about 117 times faster ([Filter columns, not tables, in DAX](https://www.sqlbi.com/articles/filter-columns-not-tables-in-dax/)). Their test used two fact tables, which makes the table filter worse than it will be here. Microsoft documents the same rule ([Avoid using FILTER as a filter argument](https://learn.microsoft.com/dax/best-practices/dax-avoid-avoid-filter-as-filter-argument)). On this single-fact model the gap should be smaller but still large; section 8 sets the bar at 10 times.

## 7. Check-and-optimize flow

This is the path the video follows, and the same path works on a client's report: find the slow visual, measure its query, read where the time goes, fix, prove the numbers did not change.

1. **Find the slow visual.** On the **Optimize** ribbon open **Performance analyzer**, select **Start recording**, then **Refresh visuals**. Expand the matrix. The "DAX query" line is model time; "Visual display" is rendering. Log the DAX query milliseconds.
2. **Take the query out of the report.** Select **Copy query** on the matrix. That is the exact DAX the visual sends.
3. **Measure it properly.** Open DAX Studio, connect to the open PBIX, paste the query, switch on **Server Timings**, and run with **Clear Cache then Run**. Run it twice and log the second result: Total, FE (formula engine), SE (storage engine), number of SE queries, and the largest "Rows" value among them.
4. **Read the result.** Two signs point at the measure and not at the data volume: FE takes most of the total, and one storage engine query returns far more rows than the matrix has cells (850 here).
5. **Find the cause.** Open the measure used by the visual. Look for a whole table used as a filter: `FILTER ( Sales, ...)` inside CALCULATE.
6. **Test the fix without touching the model.** Run the benchmark query below with `[Slow]`, then with `[Fast]`, each with a cleared cache. Log both.
7. **Prove the numbers match.** Run the difference query. It must return no rows.
8. **Apply.** Replace the body of Big Line Sales with the optimized version. Rerun Performance analyzer and log the new DAX query time. Save a copy as `Slow Report Demo - fixed.pbix`.
9. **Sweep the model.** Run the search query to list other measures with the same pattern. On a client model this list is the tune-up backlog.

**Benchmark query.** Change the last line to `[Fast]` for the second run.

```dax
DEFINE
    MEASURE Sales[Slow] =
        CALCULATE (
            [Sales Amount]
            ,FILTER (
                Sales
                ,Sales[Quantity] * Sales[Net Price] >= 500
            )
        )
    MEASURE Sales[Fast] =
        CALCULATE (
            [Sales Amount]
            ,KEEPFILTERS ( Sales[Quantity] * Sales[Net Price] >= 500 )
        )
EVALUATE
SUMMARIZECOLUMNS (
    'Product'[Brand]
    ,'Date'[Year Month]
    ,"Big Line Sales", [Slow]
)
```

**Difference query.** Keep the same DEFINE block above it and replace the EVALUATE part with this.

```dax
EVALUATE
FILTER (
    SUMMARIZECOLUMNS (
        'Product'[Brand]
        ,'Date'[Year Month]
        ,"Slow", [Slow]
        ,"Fast", [Fast]
    )
    ,[Slow] <> [Fast]
)
```

**Search query.** Lists measures whose formula contains FILTER, for manual review.

```dax
EVALUATE
FILTER (
    INFO.VIEW.MEASURES ()
    ,CONTAINSSTRING ( [Expression], "FILTER" )
)
```

## 8. Acceptance checks and fallback

The demo is ready when the slow query is slow enough to feel, the fixed query is at least 10 times faster, and the numbers are identical.

- [ ] Benchmark query with `[Slow]`, cold cache: between 3 and 20 seconds.
- [ ] Benchmark query with `[Fast]`, cold cache: under 0.5 seconds, and at least 10 times faster than `[Slow]`.
- [ ] Difference query returns no rows.
- [ ] The Big Line Sales card shows the same value before and after the fix.
- [ ] After the fix, a click on the Country slicer redraws the matrix in under a second.
- [ ] `perf_log.md` holds, for both versions: Performance analyzer DAX query ms, and DAX Studio Total, FE, SE, SE query count, largest row count; plus machine CPU and RAM.

**If the gap is too small or the slow query is too heavy, tune the data, not the measure**

| Symptom | Change | Why it works |
| --- | --- | --- |
| `[Slow]` under 3 seconds | Set `DISCOUNT_LEVELS = 31` and rebuild, or add Customer\[Country\] to the matrix rows | More distinct price and grouping combinations make the intermediate table bigger |
| Still under 3 seconds | Raise `N_SALES` to 40,000,000 | More rows to scan and match |
| `[Slow]` over 30 seconds, or out of memory | Set `DISCOUNT_LEVELS = 3`, or use Date\[Year\] on columns | Fewer combinations |

**Fallback pair, if the gap stays under 10 times after tuning.** It uses a different and heavier mistake: looping over millions of orders and running a measure for each one. The fix moves the order total into the lakehouse.

1. Add the order total to the fact table and load the new table as Sales, including Order ID and Order Amount. This snippet ran on local Spark at 600,000 rows.

   ```python
   from pyspark.sql import Window
   
   fact_orders = spark.table("fact_sales").withColumn(
       "order_amount",
       F.sum("net_amount").over(Window.partitionBy("order_id")).cast("decimal(18,2)"),
   )
   save(fact_orders, "fact_sales_orders")
   ```
2. Use this matrix: rows Customer\[Country\], columns Date\[Year Month\].
3. Slow version:

   ```dax
   Big Order Sales =
   SUMX (
       VALUES ( Sales[Order ID] )
       ,IF ( [Sales Amount] >= 5000, [Sales Amount] )
   )
   ```
4. Optimized version:

   ```dax
   Big Order Sales =
   CALCULATE (
       [Sales Amount]
       ,KEEPFILTERS ( Sales[Order Amount] >= 5000 )
   )
   ```
5. The two match only while the visual slices by things that belong to a whole order: date, customer, store. Sliced by product or brand they differ, because the slow version then totals only part of each order. Keep product fields off this page. The same logic at a 500 threshold matched on all 280 country-by-month cells in the local Spark check.

## 9. Sources

Read on 23 November 2026.

- [Filter columns, not tables, in DAX](https://www.sqlbi.com/articles/filter-columns-not-tables-in-dax/), SQLBI: the pattern, the explanation, and the 6,232 ms against 53 ms benchmark
- [Avoid using FILTER as a filter argument](https://learn.microsoft.com/dax/best-practices/dax-avoid-avoid-filter-as-filter-argument), Microsoft Learn: the rule and the KEEPFILTERS form
- [Use Performance analyzer to examine report performance](https://learn.microsoft.com/power-bi/create-reports/performance-analyzer), Microsoft Learn: where the pane is, copy query, run in DAX query view
- [Work with DAX query view](https://learn.microsoft.com/power-bi/transform-model/dax-query-view), Microsoft Learn: running visual queries and DEFINE MEASURE
- [DAX Studio](https://daxstudio.org): Server Timings

# Spec 1 · Power BI to Fabric migration demo (Import vs Direct Lake)

Nov 23, 2026 · @KIRILL

Build one lakehouse, one Import model and one Direct Lake model on the same data, with two identical reports, so the video can show new data landing in one report in seconds while the other waits for a refresh.

## 1. Storyline

The video proves one claim: after migration, new data shows up in the report in seconds, with no refresh to wait for. Everything else is built to support that one split-screen shot.

| Time | On screen | Voice-over point |
| --- | --- | --- |
| 0:00 | Report A (Import) and Report B (Direct Lake) side by side, same numbers | Same data, same visuals, two storage modes |
| 0:15 | Run `nb_02_append_day`; one new day of sales lands in the lakehouse | This is your nightly load |
| 0:30 | Report B shows the new total and a newer "Data as of" time. Report A is unchanged | Direct Lake reads the lake; Import still holds yesterday's copy |
| 0:45 | Start the Import refresh; timer on screen | Import must copy every row again |
| 1:00 | B-roll of the Import model: Power Query steps, a calculated column, a calculated table | What moves during a migration (section 8) |
| 1:45 | The notebook cell that now does the same shaping once, in the lakehouse | Logic moves upstream and is reused |
| 2:10 | Import refresh finishes; show its duration next to the Direct Lake update time | Minutes versus seconds |
| 2:25 | Both reports match again | What stays: measures, relationships, visuals |
| 2:40 | Closing card | Migration Assessment, 1 week, $1,200 |

Numbers shown on screen must come from the recorded run, not from this spec.

## 2. Assets to build

Use these names exactly. Later steps and the other specs refer to them.

| Asset | Type | Name | Notes |
| --- | --- | --- | --- |
| Workspace | Fabric workspace on a Fabric capacity | `ws_migration_demo` | Trial capacity is enough |
| Lakehouse | Lakehouse, no schemas | `lh_sales_demo` | Holds raw and gold tables |
| Build notebook | PySpark notebook | `nb_01_build_sales_demo` | Section 5, cells 1 to 3 |
| Append notebook | PySpark notebook | `nb_02_append_day` | Section 5, cell 1 plus the append cell |
| Before model | Semantic model, Import | `Sales Import` | Reads `raw_*` tables through the SQL analytics endpoint |
| Before report | Report | `Sales Import` | Published from `Sales Import.pbix` |
| After model | Semantic model, Direct Lake on OneLake | `Sales Direct Lake` | Reads `dim_*` and `fact_sales` |
| After report | Report | `Sales Direct Lake` | Clone of the before report, rebound |
| Run log | Markdown file | `run_log.md` | Row counts and measured timings from section 10 |

## 3. Prerequisites and assumptions

**Needed before the build starts**

- A Fabric capacity. Direct Lake models need one; Import works on any licence ([storage mode comparison](https://learn.microsoft.com/fabric/fundamentals/direct-lake-overview#comparison-of-storage-modes)). The free trial lasts 60 days and is sized F4 or F64 ([Fabric trial](https://learn.microsoft.com/fabric/fundamentals/fabric-trial)).
- Workspace Admin or Member role on `ws_migration_demo`.
- A current Power BI Desktop. Creating a Direct Lake model from Desktop also needs the XMLA endpoint enabled on the tenant, XMLA read-write on the capacity, and a paid or trial user licence ([requirements](https://learn.microsoft.com/fabric/fundamentals/direct-lake-power-bi-desktop#requirements-and-permissions)).
- Optional: Microsoft's [Power BI authoring MCP server](https://learn.microsoft.com/power-bi/developer/mcp/power-bi-authoring-mcp), which lets an AI assistant create and edit semantic models directly. Without it, the assistant prepares scripts and click-by-click steps for a person to run.

**Assumptions taken in this spec**

- The after model uses Direct Lake on OneLake. It is what Desktop creates and what Microsoft recommends for new models ([How Direct Lake works](https://learn.microsoft.com/fabric/fundamentals/direct-lake-how-it-works#directquery-fallback)).
- 30 million sales lines. That is far below the 300 million rows per table guardrail on F2 to F32 ([capacity requirements](https://learn.microsoft.com/fabric/fundamentals/direct-lake-overview#fabric-capacity-requirements)), and large enough that an Import refresh takes visible time.
- All data is synthetic. No client data, no real company names.

**Rules for whoever builds this**

- Table, column and measure names must match section 4 in both models. The second report is a rebound copy of the first and breaks on any name difference.
- Stop and report when an acceptance check in section 10 fails. Do not adjust the check.
- Record every measured duration in `run_log.md`. The video quotes those numbers.

## 4. Data model

The lakehouse holds two layers. Raw tables look like a source system export. Gold tables are the same data, shaped for reporting.

**Raw layer (read by the Import model)**

| Table | Rows | Columns |
| --- | --- | --- |
| `raw_customer` | 200,000 | customer\_id, first\_name, last\_name, country, segment, signup\_date |
| `raw_product` | 2,500 | product\_id, brand, category, product\_name, unit\_price, unit\_cost |
| `raw_store` | 100 | store\_id, country, channel, store\_name |
| `raw_sales` | 30,000,000 | sales\_id, order\_id, order\_date, customer\_id, product\_id, store\_id, quantity, unit\_price, discount\_pct, net\_price, unit\_cost, load\_ts |

**Gold layer (read by the Direct Lake model)**

| Table | Rows | Columns |
| --- | --- | --- |
| `dim_customer` | 200,000 | customer\_key, customer\_name, country, segment, signup\_date |
| `dim_product` | 2,500 | product\_key, product\_name, brand, category, unit\_price, price\_band |
| `dim_store` | 100 | store\_key, store\_name, country, channel |
| `dim_date` | 1,096 | date, year, month\_no, month\_name, year\_month, quarter |
| `fact_sales` | 30,000,000 | sales\_id, order\_id, order\_date, customer\_key, product\_key, store\_key, quantity, net\_price, unit\_cost, net\_amount, cost\_amount, load\_ts |

Sales dates run from 2024-01-01 to 2026-10-31. `dim_date` covers 2024-01-01 to 2026-12-31. Money columns in gold are `decimal(18,2)`. `load_ts` is UTC.

**Semantic model contract (identical in both models)**

| Model table | Columns, in friendly names | Do not load |
| --- | --- | --- |
| Sales | Order Date, Customer Key, Product Key, Store Key, Quantity, Net Price, Unit Cost, Net Amount, Cost Amount, Load Timestamp | sales\_id, order\_id, unit\_price, discount\_pct |
| Customer | Customer Key, Customer Name, Country, Segment | first\_name, last\_name, signup\_date |
| Product | Product Key, Product Name, Brand, Category, Unit Price, Price Band | unit\_cost |
| Store | Store Key, Store Name, Store Country, Channel |  |
| Date | Date, Year, Month No, Month Name, Year Month, Quarter |  |

Relationships, all many-to-one, single direction: Sales\[Customer Key\] to Customer\[Customer Key\], Sales\[Product Key\] to Product\[Product Key\], Sales\[Store Key\] to Store\[Store Key\], Sales\[Order Date\] to Date\[Date\]. Hide the key columns. Mark Date as the date table. Sort Month Name by Month No.

Measures, all on the Sales table:

```dax
Sales Amount = SUM ( Sales[Net Amount] )

Cost Amount = SUM ( Sales[Cost Amount] )

Margin = [Sales Amount] - [Cost Amount]

Margin % = DIVIDE ( [Margin], [Sales Amount] )

Order Lines = COUNTROWS ( Sales )

Last Order Date = MAX ( Sales[Order Date] )

Data As Of = MAX ( Sales[Load Timestamp] )
```

Formats: Sales Amount, Cost Amount and Margin as whole-number currency; Margin % as percentage with one decimal; Order Lines as whole number with thousands separator; Data As Of as `dd MMM HH:mm`.

## 5. Data generator

Two PySpark notebooks build all tables. Attach `lh_sales_demo` as the default lakehouse in both. The same config always produces the same rows.

**What was tested.** This code ran end to end on local Spark 3.5 at 600,000 rows, writing Parquet. Checks passed: row counts, no nulls, no orphan keys, no duplicate `sales_id`, identical output across different partitionings, and a clean append. The Delta writes, the V-Order setting and the 30-million-row run in Fabric were not tested here. Do a first run with `N_SALES = 300_000`.

**Cell 1: config and helpers.** Paste the same cell into both notebooks.

```python
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
```

**`nb_01_build_sales_demo`, cells 2 and 3: raw layer, then gold layer.**

```python
# ---- cell 2: raw layer (what the source system hands over) ----
spark.conf.set("spark.sql.parquet.vorder.default", "true")   # V-Order: faster Direct Lake reads

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

# ---- cell 3: gold layer (the shaping Power BI used to do, now done once in the lakehouse) ----
dim_customer = spark.table("raw_customer").select(
    F.col("customer_id").alias("customer_key"),
    F.concat_ws(" ", "first_name", "last_name").alias("customer_name"),   # was a Power Query merge
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
    F.when(F.col("unit_price") < 50, F.lit("Budget"))                     # was a DAX calculated column
     .when(F.col("unit_price") < 300, F.lit("Mid"))
     .otherwise(F.lit("Premium")).alias("price_band"),
)

dim_store = spark.table("raw_store").select(
    F.col("store_id").alias("store_key"), "store_name", "country", "channel"
)

dim_date = (                                                              # was a DAX calculated table
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

**`nb_02_append_day`, cell 2: one new day of sales, appended to raw and gold.**

```python
N_NEW = 50_000

last = spark.table("raw_sales").agg(F.max("sales_id").alias("id"), F.max("order_date").alias("d")).first()
new_day = spark.sql(f"select date_add(date'{last['d']}', 1) as d").first()["d"]

new_raw = gen_raw_sales(last["id"] + 1, N_NEW, spark.table("raw_product"), fixed_date=new_day).cache()
save(new_raw, "raw_sales", mode="append")
save(to_fact_sales(new_raw), "fact_sales", mode="append")

print(f"Appended {new_raw.count():,} lines for {new_day}")
```

Notes:

- V-Order is off by default in new Fabric workspaces. The build cell turns it on for the session because Microsoft recommends it for tables read by Direct Lake ([V-Order](https://learn.microsoft.com/fabric/data-engineering/delta-optimization-and-v-order#control-v-order-writes)). `nb_02_append_day` should set the same config before writing.
- Each run of `nb_02_append_day` adds the next calendar day. Rehearse as often as needed; `dim_date` covers dates up to 2026-12-31.
- To reset, rerun `nb_01_build_sales_demo`. It overwrites every table.

## 6. Report A (before): the Import model

This model is built the way most Power BI models are built today. It deliberately contains three things that do not carry over to Direct Lake unchanged.

1. In Power BI Desktop, open **OneLake catalog**, pick `lh_sales_demo`, choose **Connect to SQL endpoint**, select **Import**, and load `raw_customer`, `raw_product`, `raw_store`, `raw_sales` into Power Query.
2. **Legacy piece 1, Power Query shaping.**
   - `raw_customer`: rename the query to Customer. Merge `first_name` and `last_name` with a space into Customer Name. Remove the two source columns and `signup_date`.
   - `raw_sales`: rename to Sales. Add custom column Net Amount = `[quantity] * [net_price]` and Cost Amount = `[quantity] * [unit_cost]`, both Fixed decimal. Remove `sales_id`, `order_id`, `unit_price`, `discount_pct`.
   - `raw_product`: rename to Product. Remove `unit_cost`.
   - `raw_store`: rename to Store. Rename `country` to Store Country.
   - Rename every remaining column to the friendly names in section 4, then load.
3. **Legacy piece 2, a DAX calculated column** on Product:

   ```dax
   Price Band =
   SWITCH (
       TRUE ()
       ,'Product'[Unit Price] < 50
           ,"Budget"
       ,'Product'[Unit Price] < 300
           ,"Mid"
       ,"Premium"
   )
   ```
4. **Legacy piece 3, a DAX calculated table** named Date:

   ```dax
   Date =
   VAR _first_year   = YEAR ( MIN ( Sales[Order Date] ) )
   VAR _last_year    = YEAR ( MAX ( Sales[Order Date] ) )
   RETURN
       ADDCOLUMNS (
           CALENDAR ( DATE ( _first_year, 1, 1 ), DATE ( _last_year, 12, 31 ) )
           ,"Year", YEAR ( [Date] )
           ,"Month No", MONTH ( [Date] )
           ,"Month Name", FORMAT ( [Date], "MMM" )
           ,"Year Month", FORMAT ( [Date], "yyyy-MM" )
           ,"Quarter", "Q" & QUARTER ( [Date] )
       )
   ```
5. Add the relationships, measures and formats from section 4.
6. Build one report page named Sales overview, 1280 x 720:

   | Visual | Fields |
   | --- | --- |
   | Text box, top left | "Sales overview · IMPORT" on a grey title bar |
   | Card | Sales Amount |
   | Card | Order Lines |
   | Card | Last Order Date |
   | Card | Data As Of |
   | Line chart | X: Date\[Year Month\], Y: Sales Amount |
   | Bar chart | Y: Product\[Category\], X: Sales Amount |
   | Matrix | Rows: Customer\[Country\], Columns: Date\[Year\], Values: Sales Amount, Margin % |
   | Slicer | Product\[Price Band\] |
   | Slicer | Store\[Channel\] |
7. Save as `Sales Import.pbix` and publish to `ws_migration_demo`.
8. In the service, open the model's settings, sign in to the data source with OAuth2, and run one refresh. Write the duration from **Refresh history** into `run_log.md`.

## 7. Migration steps to Report B (after): Direct Lake

The migration is three moves: push the shaping into the lakehouse, rebuild the model on the gold tables, and point a copy of the report at it.

1. **Shaping is already upstream.** Cell 3 of `nb_01_build_sales_demo` replaced the three legacy pieces:

   | In the Import model | In the lakehouse |
   | --- | --- |
   | Power Query merge for Customer Name | `dim_customer.customer_name` |
   | Power Query custom columns Net Amount, Cost Amount | `fact_sales.net_amount`, `fact_sales.cost_amount` |
   | Calculated column Price Band | `dim_product.price_band` |
   | Calculated table Date | `dim_date` |
2. **Create the model.** In a new Power BI Desktop window, open **OneLake catalog**, pick `lh_sales_demo`, select **Connect**, name the model `Sales Direct Lake`, choose `ws_migration_demo`, and tick `dim_customer`, `dim_product`, `dim_store`, `dim_date`, `fact_sales`. Desktop creates a Direct Lake on OneLake model in the workspace and opens it for live editing; there is no local file and no Publish step ([Direct Lake in Power BI Desktop](https://learn.microsoft.com/fabric/fundamentals/direct-lake-power-bi-desktop)).
3. **Match the contract.** Rename tables and columns to the friendly names in section 4 and delete the columns marked "do not load". Renames made in the model survive later schema refreshes.
4. Add the relationships, mark Date as the date table, set Month Name to sort by Month No.
5. **Copy the measures.** In `Sales Import.pbix`, open **TMDL view** and script the measures of the Sales table. In the Direct Lake model's TMDL view, paste them in a createOrReplace script under "ref table Sales" and select **Apply**. Seven measures, same names, same formats.
6. In the service, open the model's settings and confirm **Keep your Direct Lake data up to date** is on under Refresh. It is on by default and reframes the model whenever the Delta tables change ([automatic updates](https://learn.microsoft.com/fabric/fundamentals/direct-lake-how-it-works#automatic-updates)).
7. **Clone and rebind the report.** Pick one route:
   - Fabric notebook with Semantic Link Labs. Check both function signatures in the [library docs](https://semantic-link-labs.readthedocs.io/) first; this snippet was not run here.

     ```python
     %pip install semantic-link-labs
     import sempy_labs.report as rep
     
     rep.clone_report(report="Sales Import", cloned_report="Sales Direct Lake")
     rep.report_rebind(report="Sales Direct Lake", dataset="Sales Direct Lake")
     ```
   - Power BI REST API: Reports, Clone Report In Group, with `targetModelId` set to the Direct Lake model's ID.
   - By hand: save `Sales Import.pbix` as a PBIP project, copy the report folder, point its `definition.pbir` at `Sales Direct Lake` by connection, open it and publish.
8. In the cloned report, change the title text to "Sales overview · DIRECT LAKE" and the title bar to a green fill, so the two reports are easy to tell apart on a split screen.

For real client models, Semantic Link Labs ships a scripted Import-to-Direct-Lake migration, including an interactive `migrate_to_direct_lake` wizard ([reference](https://semantic-link-labs.readthedocs.io/en/0.17.0/sempy_labs.semantic_model.html)). It is worth one line in the voice-over; this demo builds the model by hand so every step is visible.

## 8. What changes and what stays

This table is the script for the middle of the video. Each row is one sentence of voice-over. Facts are from Microsoft's [Direct Lake overview](https://learn.microsoft.com/fabric/fundamentals/direct-lake-overview) and [How Direct Lake works](https://learn.microsoft.com/fabric/fundamentals/direct-lake-how-it-works), read on 23 November 2026.

| Topic | Import (before) | Direct Lake (after) |
| --- | --- | --- |
| Refresh | Copies every row into the model. Takes time and capacity. | Reads only Delta table metadata ("framing"). Usually a few seconds. |
| Freshness | Data as of the last finished refresh | Data as of the last framing; with automatic updates on, that follows each write to the lake |
| Data preparation | Power Query inside the model | No Power Query on Direct Lake tables. Shaping moves to the lakehouse: notebooks, Dataflows Gen2, pipelines. |
| Calculated columns and tables | Fully supported | On Direct Lake on OneLake, those that reference Direct Lake tables are in preview. On Direct Lake on SQL they are not supported. Safest is to materialize them in Delta. |
| Editing | Local PBIX with the data in it, then Publish | Live edit of the model in the workspace. No PBIX; a PBIP project holds metadata only. |
| First query | Everything is in memory after refresh | Columns load from OneLake on first use, so the first query after a change is slower |
| Licence | Any Power BI licence | Needs a Fabric capacity |
| Size limits | Model memory limit of the licence or SKU | Per-SKU guardrails, for example 300 million rows per table on F2 to F32 |
| Row-level security | Defined in the model | Model RLS still works; Microsoft recommends a fixed-identity connection. RLS set on the SQL endpoint is not applied by Direct Lake on OneLake. |

**What stays the same:** DAX measures, relationships, report pages and visuals, model roles, and the VertiPaq engine that answers the queries. That is why Report B is a rebound copy of Report A with no visual rebuilt.

One honest caveat for the voice-over: Import is still the right choice for some models, and one model can now mix Direct Lake and Import tables.

## 9. Demo run

Rehearse this sequence at least once before recording and log the timings.

**Off camera, before recording**

- Open Report A and Report B in two browser windows, side by side. Click through both once so they are warm.
- Open `nb_02_append_day` and start its Spark session. Session start can take a while and should not be in the take.
- Put a visible stopwatch on screen.

**On camera**

1. Show both reports. Sales Amount, Order Lines and Last Order Date are identical.
2. Run `nb_02_append_day`. Expected output: `Appended 50,000 lines for 2026-11-01` on the first run.
3. In Report B, press the report's refresh button. Expected: Last Order Date moves to the new day, Order Lines rises by 50,000, Data As Of shows the new time. Log the seconds between the notebook finishing and the new numbers appearing.
4. In Report A, press refresh. Expected: nothing changes.
5. Open `Sales Import` in the workspace and select **Refresh now**. Start the stopwatch.
6. While it runs, record the B-roll: the Power Query steps on Customer and Sales, the Price Band column, the Date table formula, then cell 3 of the build notebook.
7. When the refresh finishes, show its duration in **Refresh history**, then refresh Report A. Both reports match again.

**Two things that can spoil the take**

- The Import model reads through the SQL analytics endpoint, which picks up lakehouse changes with a lag that is normally under a minute ([metadata sync](https://learn.microsoft.com/fabric/data-engineering/sql-analytics-endpoint-performance)). If the Import refresh finishes without the new day, press **Refresh** on the endpoint and refresh the model again. To avoid it on camera, leave a minute between steps 2 and 5.
- If Report B has not changed after a minute, check the automatic-updates setting from section 7 step 6, then refresh the Direct Lake model once by hand.

## 10. Acceptance checks

The build is ready to record when every box is ticked.

- [ ] Notebook row counts equal the counts in section 4.
- [ ] This query returns identical values in both models (run it in DAX query view):

  ```dax
  EVALUATE
  ROW (
      "Sales Amount", [Sales Amount]
      ,"Order Lines", [Order Lines]
      ,"Last Order Date", [Last Order Date]
  )
  ```
- [ ] The Country by Year matrix shows the same numbers in both reports.
- [ ] The Price Band slicer offers Budget, Mid and Premium in both reports, with equal totals.
- [ ] `Sales Direct Lake` has five tables, all in Direct Lake storage mode, with no calculated columns and no calculated tables.
- [ ] After `nb_02_append_day`, Report B shows the new day within 60 seconds without a manual model refresh. Report A does not.
- [ ] The Import refresh takes at least 2 minutes. If it is faster, raise `N_SALES` to 60,000,000 and rebuild, so the contrast is visible.
- [ ] `run_log.md` holds: run date, capacity SKU, row counts, Import refresh duration, and seconds until Report B showed the new day.

## 11. Sources

Microsoft Learn pages, read on 23 November 2026. Fabric changes monthly, so recheck the limitation rows in section 8 before recording.

- [Direct Lake overview](https://learn.microsoft.com/fabric/fundamentals/direct-lake-overview): storage mode comparison, capacity guardrails, limitations
- [How Direct Lake works](https://learn.microsoft.com/fabric/fundamentals/direct-lake-how-it-works): framing, automatic updates, column loading
- [Direct Lake in Power BI Desktop](https://learn.microsoft.com/fabric/fundamentals/direct-lake-power-bi-desktop): creating and live editing the model, requirements
- [Develop Direct Lake semantic models](https://learn.microsoft.com/fabric/fundamentals/direct-lake-develop): choosing between Direct Lake on OneLake and on SQL
- [Optimize Delta Lake tables with V-Order](https://learn.microsoft.com/fabric/data-engineering/delta-optimization-and-v-order): V-Order default and session setting
- [SQL analytics endpoint performance considerations](https://learn.microsoft.com/fabric/data-engineering/sql-analytics-endpoint-performance): sync lag between lakehouse and endpoint
- [Try Microsoft Fabric for free](https://learn.microsoft.com/fabric/fundamentals/fabric-trial): trial length and size
- [Semantic Link Labs documentation](https://semantic-link-labs.readthedocs.io/): report clone and rebind, migration helpers

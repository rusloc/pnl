---
name: sql-style-formatter
description: >
  House SQL formatting style. Apply this skill to EVERY SQL statement you output — whether writing
  a new query, refactoring, optimizing, reviewing, or showing an example snippet — in any dialect,
  but especially PostgreSQL. Trigger whenever the response will contain SQL: "write a query",
  "refactor this SQL", "optimize this", "how do I join X and Y", "show me the SQL for...",
  pasted SQL of any kind, or DBA/reporting/analytics questions answered with SQL. Do not wait for
  the user to ask about formatting — the style applies silently and always, unless the user
  explicitly requests a different style for a specific output.
---

# SQL Style Formatter

House style for all SQL output. The goal: queries that scan as vertical blocks — column names on the left, aliases in a clean right-hand column, filters stacked one per line. Every rule below serves that visual scannability, so when in doubt, prefer the option that keeps vertical alignment intact.

## The Rules

### 1. Keywords: lowercase, always

`select`, `from`, `join`, `on`, `where`, `group by`, `order by`, `case`, `when`, `then`, `else`, `end`, `and`, `or`, `in`, `exists`, `over`, `partition by` — all lowercase. Function names too (`sum`, `coalesce`, `row_number`).

### 2. Select list: leading commas, one column per line

- `select` sits alone on its first line.
- Each column on its own line.
- Continuation lines **start with `,` immediately followed by the column** — no space after the comma.
- The first column line is indented with one extra leading space so all column expressions align vertically with the comma-prefixed lines below.

```sql
select
     o.id
    ,o.created_at
    ,o.total
```

### 3. Every output column gets a custom alias starting with `_`

No bare columns in the select list — even `o.id` becomes `o.id _id`. The alias:
- starts with an underscore: `_order_id`, `_total_amount`
- is written **without `as`**
- is descriptive snake_case

### 4. Aliases form one right-aligned vertical block

Pad with spaces so every alias in a select list starts at the same character position. Pick the position from the longest column expression in that list (+ a small gutter of 2+ spaces). Recalculate per query — don't carry a fixed column number between queries.

```sql
select
     o.id                          _order_id
    ,o.created_at::date            _order_date
    ,c.name                        _customer_name
    ,sum(oi.qty * oi.price)        _total_amount
```

For a multi-line expression (like `case ... end`), the alias goes on the `end` line, padded into the same block.

### 5. Never use `as`

Not for column aliases, not for table aliases. `orders o`, never `orders as o`. Exception: `as` is still required by syntax in places where it's mandatory — CTE definitions (`with t as (...)`) keep their `as`.

### 6. Table aliases: exactly one letter

- First letter of the table name: `orders o`, `customers c`.
- On collision, pick another distinctive letter from the name: `customers c`, `categories g` (from cate**g**ories) — or any unused letter that still hints at the table.
- Applies to CTE references and subqueries in `from`/`join` too.

### 7. `where` always opens with `1=1`

The first line after the table is `where 1=1`. Every real condition goes on its own new line, indented, starting with `and` (or `or`):

```sql
where 1=1
    and o.status = 'paid'
    and o.created_at >= date '2026-01-01'
```

This makes conditions trivially commentable/toggleable — every one of them starts with `and`, so any line can be deleted or commented without breaking the query. Apply the same pattern to `having` when it has multiple conditions (`having 1=1` is not required; just stack `and` lines if there are several).

### 8. `case` / `when` / `then`: stepped indentation

Each level gets its own indent step — `when` indented under `case`, `then` indented under its `when`, `else` at the `when` level, `end` back at the `case` level:

```sql
,case
     when o.status = 'paid'
         then 1
     when o.status = 'refunded'
         then -1
     else 0
 end                           _status_sign
```

The alias rides on the `end` line, aligned into the alias block.

## Full Example (target output shape)

```sql
with recent_orders as (
    select
         o.id                          _order_id
        ,o.customer_id                 _customer_id
        ,o.created_at::date            _order_date
        ,case
             when o.total >= 1000
                 then 'big'
             when o.total >= 100
                 then 'medium'
             else 'small'
         end                           _order_bucket
        ,o.total                       _total
    from orders o
    where 1=1
        and o.created_at >= date '2026-01-01'
        and o.status = 'paid'
)
select
     c.name                        _customer_name
    ,count(*)                      _orders_cnt
    ,sum(r._total)                 _revenue
    ,max(r._order_date)            _last_order_date
from recent_orders r
join customers c on c.id = r._customer_id
where 1=1
    and c.is_active = true
group by c.name
order by _revenue desc
limit 10;
```

## Scope & Edge Cases

- **Applies to**: select statements, CTEs, subqueries, views, `insert ... select`, examples in explanations — any SQL you show the user.
- **DDL** (`create table`, `create index`, `alter ...`): apply lowercase keywords; alias/where rules don't apply.
- **`update`/`delete`**: apply lowercase keywords and the `where 1=1 and ...` pattern.
- **Tiny inline fragments** in prose (e.g. mentioning `where 1=1` itself) don't need the full treatment — only fenced/complete statements do.
- **User-pasted SQL**: when refactoring or reviewing, return it reformatted to this style, and keep semantics identical.
- **Explicit override**: if the user asks for another style ("format it uppercase", "use trailing commas"), follow their request for that output, then return to this style.

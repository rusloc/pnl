# Perf log · Spec 2 · Slow report, live fix

Numbers from real runs only (ADR-0018); the video quotes the recording-machine runs, never the spec.

## Run 1 · service F64, XMLA/executeQueries, first read, not the recording machine

- **Who / when:** bip, 2026-11-24 12:34–12:37 UTC.
- **Model:** deployed `Sales Import` in `ws_migration_demo` (Import, 30,000,000 order lines, 31 discount levels; ADR-0018 f). It has the same Sales[Quantity], Sales[Net Price], Product[Brand] and Date[Year Month] columns as `Slow Report Demo`. `Slow Report Demo` itself is not deployed.
- **Capacity:** `issglobalfabric` F64, shared with RAW.
- **Transport:** executeQueries REST API, run from this repo's machine. XMLA was not available (authentication failed from this machine).
- **Queries:** `perf_test.dax` blocks 1–4 unchanged. `[Slow]` / `[Fast]` are query-scoped (`DEFINE MEASURE _Measures[...]`) and call `[Sales Amount (fx)]`.
- **Times are client wall clock per HTTP call**, so they include the API overhead.
  - Overhead measured with `EVALUATE ROW ( "x", 1 )`: 819 / 886 / 749 / 687 ms, about 0.79 s.
  - "Net" below means wall clock minus 0.79 s. It is an estimate, not engine time.
- **Cache:** executeQueries cannot clear the cache, and XMLA ClearCache was not possible. **No cold-cache run.**
  - The model had served the acceptance queries a few minutes earlier (the same columns were already in memory).
  - Run 1 of each query is its first execution. Run 2 is a repeat.

| Query | Run | Wall clock | Net (est.) | Rows |
|---|---|---|---|---|
| Benchmark `[Slow]` (Brand × Year Month) | 1 | 33,021 ms | ~32.2 s | 850 |
| Benchmark `[Fast]` | 1 | 1,551 ms | ~0.76 s | 850 |
| Benchmark `[Slow]` | 2 | 25,697 ms | ~24.9 s | 850 |
| Benchmark `[Fast]` | 2 | 1,581 ms | ~0.79 s | 850 |
| Difference query | 1 | 24,151 ms | — | **0 rows** |
| Search query (on `Sales Import`) | 1 | 925 ms | — | 0 rows (expected: `Sales Import` has no measure with `FILTER`; on `Slow Report Demo` it lists `Big Line Sales (fx)`) |

**Ratio Slow / Fast:** 21.3× and 16.3× on wall clock; about 42× and 31× net.

### Gate (Spec 2 § 8)

| Check | Target | This run | Verdict |
|---|---|---|---|
| `[Slow]`, cold | 3–20 s | 25–33 s (warm-ish; cold would be slower or equal) | **out of range (too slow)** |
| `[Fast]`, cold | < 0.5 s | ~0.8 s net (1.55 s wall clock, 850 rows over HTTP) | **not shown**: cannot be measured below the API overhead here; to be measured in DAX Studio |
| `[Fast]` vs `[Slow]` | ≥ 10× | 16–21× wall clock, ~31–42× net | pass |
| Difference query | 0 rows | 0 rows | **pass** |

No measure was changed (spec § 3 rule).

### Proposed tuning (spec § 8), not applied: needs a USER decision

The spec's row for "`[Slow]` over 30 seconds" is: set `DISCOUNT_LEVELS = 3`, or use Date[Year] on the matrix columns. ADR-0018 f says report side first, so the first option is Date[Year].

A read-only probe of the Date[Year] variant was run on the same model. It is the same two queries with `'Date'[Year Month]` replaced by `'Date'[Year]`, 75 rows each:

| Query | Run 1 | Run 2 |
|---|---|---|
| `[Slow]` Brand × Year | 6,898 ms (~6.1 s net) | 4,428 ms (~3.6 s net) |
| `[Fast]` Brand × Year | 1,154 ms (~0.36 s net) | 1,096 ms (~0.31 s net) |

The probe lands inside 3–20 s with roughly 10–17× net. Taking it changes the page ("25 brands by 34 months" becomes 25 × 3) and the benchmark query, so the USER decides.

Alternatively, measure first in Desktop + DAX Studio on the recording machine. The § 8 gate is defined there, and a laptop may land differently from this F64 service read.

## Run 2 · recording machine (Desktop + DAX Studio)

Pending (`guide.md` section 3 C): Performance analyzer DAX query ms; DAX Studio Total, FE, SE, SE query count and largest Rows for both versions; CPU and RAM.

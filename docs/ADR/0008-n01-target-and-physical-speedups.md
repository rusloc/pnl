# ADR-0008 — N-01 showcase target and physical speed-ups of the P&L model

- **Status:** accepted (USER, 2026-10-23). The physical design (§4) is filled in by ginee + bip and reviewed by the main agent before any write to `lh_raw`.
- **Date:** 2026-10-23
- **Decider:** USER
- **Spec:** `docs/Requirements.md` N-01 · §7 (C-10..C-13, C-35..C-37) · §8 (D-01, D-14) · T-06, T-05, T-10
- **Related:** ADR-0003 (data layer, plain Python loader), ADR-0006 (Track A reads the same model), ADR-0007 (views)

## 1. Context

N-01 asks for a filter change < 2 s p95 and a row expand < 0.3 s. On 2026-10-22 bip measured the Track B model as formula-engine bound and dominated by plan size: every SWITCH branch adds its chain, and statement columns share nothing (~19 evaluations per statement row). After perf round 2, local timings were: matrix ~4.7 s, Key figures ~6.5 s; on the service, Track A takes ~4–10 s per zone. bip's conclusion: N-01 can't be reached on this design (aggregations and Direct Lake don't help). ginee's feasibility notes (2026-10-22):

- (a) **Pre-translated amounts** in the loader: a cheap option (one USD-at-actual-rates column) or a full one (one column per rate basis), +60–100 MB, refresh 35–45 s, 1.5–2 days, bip's estimate ~−40 % query time.
- (b) **Materialised elimination rows:** an elimination entity in `dim_entity` (a D-14 contract change), or a separate `fact_pl_elim` appended in Power Query; +5,304 rows; 1–1.5 days; ~−22 %.

## 2. Decision

1. **Target (showcase):** every one of the 4 views (P&L statement, Key figures, Analysis, Profitability) renders in **≤ 5 s** after a filter change; **5–10 s is the accepted worst case** (cold cache, heaviest selection: Group, LTM, slices on). It applies to Track B (Desktop and service) and is the goal for Track A on the same model. N-01's original numbers stay the long-term target.
2. **Model optimisation goes ahead**, physical changes included: (a) pre-translated amounts and (b) materialised eliminations, in that order. Measure after each step and stop when the target is met.
3. Every number stays the same: T-06 552/552, T-05/T-10 54/54 and every `_pass` in `tests/control-totals.dax` are TRUE before and after, locally and on the service; Track A's parity specs still pass.

## 3. Rules

- Spec §7 semantics don't change: translation still happens at month × currency grain before aggregation (C-10..C-13); a pre-translated column is the same arithmetic done earlier, per row.
- Writes to `lh_raw` follow CLAUDE.md: `--dry-run` first, then the USER's yes, then `sql/verify-acme-pl.sql`.
- The service model is updated in place (same item id, so Track A's connector keeps working), with a fresh backup and the measure-removal guard.

## 4. Physical design (ginee + bip; to be filled in before implementation)

_(columns, rate bases covered, elimination-row shape, Power Query / partition changes, measure rewrites, expected sizes and refresh time, rollback)_

### 4.1 Data layer (ginee, 2026-10-23; revised after §4.3 to the 3-column design)

**Where it is done.** In `fabric-data/lh_raw/load_acme_pl.py`, after the CSV checks and before any write. The derived columns and the derived table are declared in the script's spec block (`XA`, `REP_CCYS`, `DERIVED_COLUMNS`, `fact_pl_elim`), which stays the only place where column types are declared. This amends ADR-0003 decision 2 ("table names = CSV file names, columns = CSV headers"): CSV columns come first and are unchanged, derived columns are appended after them, and there is one derived table.

**(a) Pre-translated amounts.** Each row is translated with the arithmetic `_Amt Raw` uses today: `local ÷ local_per_usd(row currency) × local_per_usd(reporting currency)`, for the same month and rate type (C-11, C-13). That is the same arithmetic done earlier, per row, before aggregation (§3).

| Rate basis | How the model gets it | Materialised columns |
|---|---|---|
| Row version's own rate type (ACT / FC at the month's `ACTUAL_AVG`, BUD at `BUDGET`), USD | plain `SUM` | `amount_usd` |
| Same, EUR / GBP | plain `SUM`. Must be materialised: the reporting-currency rate changes by month and rate type, so deriving it means iterating month × version again | `amount_eur`, `amount_gbp` |
| Constant currency (C-12), any reporting currency, selected FY | **derived cheaply in the model (§4.2, §4.3):** `SUMX` over the 4 functional currencies of the local sum × one factor `BUDGET(rep, FY) ÷ BUDGET(ccy, FY)`. This is exact, because C-10 gives one BUDGET rate per currency and FY (checked by the loader) | none |

- **Columns:** the same three on `fact_pl`, `fact_pl_allocated` and `fact_pl_elim` (`amount_*`), and on `fact_operational` (`gmv_*`, null where `gmv_local` is null, so GMV loses its translation path too). Units and merchants are not translated.
- **Constant currency, checked offline:**
  - The 4-currency × factor arithmetic equals today's DAX arithmetic (month × currency × version groups at the CC rate) on all 4,968 cells (552 control-total cells × FY 2024–2026 × USD / EUR / GBP), with a max difference of 0.0000000000.
  - The service model's ACME Group net revenue for FY2025, constant currency, USD (`5,109.4689692634` m) equals the offline 5,109,468,969.26.
- **Type:** `decimal(18,6)` in Delta and on the SQL endpoint. Each row is rounded half-even to 6 dp (largest value: 18.0 M for amounts, 371 M for GMV).
- **In the model, Decimal Number (double), never Fixed Decimal.** Simulated on all 552 control totals with the test rule (`ABS ( model − expected ) < 0.01`):

  | Row precision | Worst gap vs control totals | Control totals failing |
  |---|---|---|
  | 6 dp | 0.004986 | 0 of 552 |
  | 4 dp (Fixed Decimal) | 0.0267 | 43 of 552 |
  | 2 dp | 2.66 | 537 of 552 |

  This is the same rule as for `local_per_usd`.
- **Fiscal years:** no column depends on a fiscal year, so a new year needs no schema change. The loader still fails if a currency has more than one BUDGET rate in a FY, because the model's constant-currency factor relies on exactly one.

**(b) Materialised eliminations: a separate `fact_pl_elim` table, with no D-14 change.**
- **What the table holds:** one row per `fact_pl` row with a counterparty (5,304 rows: VSC_P4 × 4,680, GR_S1 × 312, GR_S2 × 312).
- **Columns:** the same columns and key as `fact_pl`, with:
  - `account_code` replaced by the block's elimination account: the one `dim_account` row with `is_intercompany`, not `has_fact_rows` and `is_direct` (`ELIM_GR`, `ELIM_VSC`);
  - `amount_local` and the three pre-translated columns negated;
  - entity (the booking entity), counterparty, region, slices, cost centre and currency kept from the source row.
- **Key:** unique after the account swap. GR_S1 and GR_S2 rows differ by slice.
- **Why this shape reproduces `_Elim Amount` exactly:**
  - A block row or a subtotal includes the `ELIM_*` account, so it gets the elimination.
  - A leaf such as GR_S1 doesn't.
  - The `ELIM_*` leaf shows the elimination.
  - A per-entity breakdown in the Group view gets the eliminations booked by that entity, as today.
- **How the model uses it:** the table is added only in the Group branch, so P and S never see it.
- **Why not change D-14:** an elimination entity in `dim_entity` would change D-14 and every track's entity handling. The separate table needs none of that and is the same size.
- **Contract:** `dim_account.has_fact_rows = FALSE` stays true for `fact_pl`.

**Checks.**

Before any write, in the loader (`--dry-run` runs them too):
- per table × version × FY and per column, the sum of the pre-translated rows equals the translation per month × currency within 0.01 (observed: at most 0.000195);
- reporting currencies = `param_reporting_currency`;
- one BUDGET rate per currency and FY;
- every fact row has its rates;
- `fact_pl_elim`: 5,304 rows, unique key, and eliminations net to 0 per version × month × region (contribution margin unchanged, C-37 difference = 0).

After the write, in `sql/verify-acme-pl.sql`:
- check 1: row counts, now including `fact_pl_elim`;
- check 3: pre-translated sums vs translation on the fly, per table × version × FY;
- check 4: `fact_pl_elim` = minus the counterparty rows, per version × month × region × block, and the eliminations net to 0;
- check 5: T-06 net revenue from `amount_usd` for P ACT FY2025 and for ACME Group ACT FY2026 YTD Sep (P + S + `fact_pl_elim`).

Offline, from the CSVs (dry-run data): all 552 control totals (P, S and ACME Group) are rebuilt from `amount_usd` (+ `fact_pl_elim` for the Group), **552 of 552 exact to the cent**.

**Sizes and times.**

| Table | Parquet before | Parquet after | Distinct values per new column |
|---|---|---|---|
| `fact_pl` | 2.8 MB | 12.7 MB | ~0.40 M |
| `fact_pl_allocated` | 4.0 MB | 18.7 MB | ~0.64–0.65 M |
| `fact_operational` | 0.17 MB | 0.25 MB | 2,808 |
| `fact_pl_elim` | — | 0.18 MB (new) | — |

- **OneLake:** about +25 MB in total.
- **Model memory:** estimated **+35–60 MB** (6 high-cardinality double columns on the two P&L facts), so the model goes from about 14 MB on disk to about 50–75 MB. That is far inside F64 and inside every F SKU's per-model memory limit. Large storage format isn't needed. To be measured with `pbi-profiler` after the first refresh.
- **Refresh:** estimated **35–45 s**, against a 28 s baseline (+6 decimal columns over 1.2 M rows read through the SQL endpoint). To be measured.
- **Loader:** about 16 s (dry run), plus the upload.
- **If memory or refresh time ever matters**, a smaller variant exists. Keep only `amount_usd` (the default path) and let the model iterate month × version for EUR / GBP. That cuts the added size by about two thirds, but the EUR / GBP paths stay iterative.

**Model physical layer (ginee, next round; nothing under `pbi-report/` changed in this round).**
- `fact_pl`, `fact_pl_allocated`, `fact_operational`:
  - add `Table.SelectColumns` with an explicit list to each partition, so the model reads only what it declares;
  - type the new columns as `type number` (Decimal Number);
  - leave `amount_local` / `gmv_local` as they are (Currency).
- New import table `fact_pl_elim`: ginee writes the partition M (`Source{[Schema = "acme_pl", Item = "fact_pl_elim"]}[Data]` + `SelectColumns` + types) and hands it to bip. bip creates the table and its relationships: `dim_entity` (booking entity), `dim_month`, `dim_version`, `dim_region`, `dim_account`. Slice relationships aren't needed, because the Group view clears the slices.
- Dropping `amount_local` / `gmv_local` once no measure reads them is bip's decision. It would save a few MB.
- Then a full refresh, measured against the 28 s baseline, plus peak memory and a `pbi-profiler` before / after.

**Rollout order.**
1. The USER's yes.
2. Loader write.
3. `verify-acme-pl.sql` checks 1–5, retrying while the SQL endpoint metadata sync lags (about 15 min).
4. Model change (§4.1 Power Query + §4.2 measures) in the PBIP.
5. Local tests.
6. Service backup, `updateDefinition` in place (same item), refresh.
7. T-06 / T-05 / T-10 and Track A parity on the service.
8. Timings (§5).

The service model isn't refreshed between steps 2 and 6, so it keeps its current processed data. The new columns are additive, and Track A's `lhraw` connector reads only dimension tables.

**Rollback.**
- **Data:**
  - option 1: re-run the previous loader (`__backup__/fabric-data/lh_raw/load_acme_pl.py.2026-10-23-1508.bak`), which overwrites the three facts without the derived columns;
  - option 2: restore Delta version 0 of those tables (the log keeps it until a VACUUM).
  - Either way, then drop `fact_pl_elim`. All of these are writes or deletes that the USER runs.
- **Model:** `updateDefinition` with the service backup taken in step 6, then a refresh.

### 4.2 Model (bip)

- **Columns the measures need:** `amount_usd`, `amount_eur`, `amount_gbp` on `fact_pl`, `fact_pl_allocated` and `fact_pl_elim`, and `gmv_usd`, `gmv_eur`, `gmv_gbp` on `fact_operational`. Each is at the row version's own rate type (BUDGET for BUD, ACTUAL_AVG for actual and forecast), so one column serves every version. Double (Decimal Number), never Fixed Decimal. `amount_local` / `gmv_local` stay (Track A, Track C, tests).
- **Constant currency (C-12) needs no columns:** it uses one BUDGET rate per currency and selected year, so it is a 4-currency iteration over local sums × one factor per (currency, year), as `Bridge Volume` already does.
- **`_Amt Raw`** becomes three branches: units / merchants → `[_Local Sum]`; constant currency → `SUMX` over the 4 functional currencies of `[_Local Sum]` × the year's factor; otherwise → `[_Rep Sum]`, a currency SWITCH over plain SUM columns. The month × currency × version CROSSJOIN with two `LOOKUPVALUE` calls per group (about 40 % of every evaluation today) disappears.
- **`_Elim Amount`** becomes a plain SUM over `fact_pl_elim` under the current account filter (block / subtotal filters include the `ELIM_*` accounts, leaf filters don't). `_Bridge Elim Change` and the IC_ELIM KPI become sums of the same table. The Group branch of `_Amt Entity` stays but is cheap.
- **`fact_pl_elim` in the model:** relationships to `dim_month`, `dim_version`, `dim_region`, `dim_account`, plus `dim_entity` (booking entity) for the Group-by-company breakdown; no slice relationships (the Group view clears slices).
- **Measured gain** (bip prototype, cold cache, 2 runs; (a) simulated by summing `amount_local`, (b2) by a filtered sum on `fact_pl`, an upper bound):

  | Query | Control | (a) | (b2) alone | (a)+(b2) |
  |---|---|---|---|---|
  | Statement, P sliced | 10.9 s | −37 % | −15 % | −39 % |
  | Key figures tile, Group LTM | 8.1 s | −39 % | −21 % | −40 % |
  | Key figures tile, P default (Price / mix) | 3.5 s | −28 % | — | −40 % |
  | Analysis bridge, Group LTM | 2.85 s | −26 % | −14 % | −31 % |
  | Profitability, Group LTM / P sliced | 10.7 / 10.2 s | −55 % | −28 % | −58 / −56 % |

- **Projected Desktop renders after (a)+(b2):** statement ~3.4 s, Key figures ~3.1–4.7 s, Analysis ~1.0 s, Profitability ~2.2 s: every view under 5 s. An elimination entity in `dim_entity` (b1) gains only 2–5 points more and changes D-14 → rejected.

### 4.3 Main agent review (2026-10-23)

- **Constant-currency columns dropped:** §4.1's `amount_usd_cc2024/25/26` (and the `gmv_*` CC equivalents) are not built. bip's §4.2 shows constant currency is a cheap 4-currency iteration with one factor per (currency, year); the columns would add 3 high-cardinality doubles per fact (≈ half of the projected model growth and refresh time) and one new column per future fiscal year, for no measured benefit. If CC queries turn out slow after (a), they can be added later.
- **Result:** 3 new columns per fact (`amount_usd`, `amount_eur`, `amount_gbp`; `gmv_*` likewise) + `fact_pl_elim`. ginee updates the loader, the verification SQL and §4.1 before the `lh_raw` write.

## 5. Measurements

_(baseline per view, local and service; after step (a); after step (b))_

### 5.0 Desktop baseline (bip, 2026-10-23, before (a))

First query start → last query end inside Desktop, cache cleared before each render; drawing adds ~0.1–0.3 s. S0 = Consumer Products, FY2026 YTD Sep, Actual vs Budget / PY · S1 = ACME Group, LTM · S2 = Consumer Products sliced (North America + Online marketplaces) · S3 = Commerce Cloud, LTM + Continental Europe.

| View | S0 | S1 | S2 | S3 | Slowest query | SE / FE |
|---|---|---|---|---|---|---|
| P&L statement | 5.1 s | 5.6 s | 4.6 s | 5.0 s | statement matrix | 4–8 % / 92–96 % |
| Key figures | 7.8 s | 5.1 s | 4.6 s | 5.3 s | 12th tile (ETR, Price/mix or Rule of 40) | 1–3 % / 97–99 % |
| Analysis | 1.4 s | 1.3 s | 1.3 s | 1.3 s | bridge 1.3 s | 7–8 % / 92–93 % |
| Profitability | 4.0 s | 5.2 s | 3.9 s | 4.9 s | profitability table | 4–7 % / 93–96 % |

Instance-to-instance drift is about ±50 % (the same Key figures query took 3.1–3.9 s in a fresh instance). Script replays run ~2× slower than Desktop renders.

### 5.1 Service baseline (ginee, 2026-10-23, before (a))

**What was run.**
- **Model:** `ACME Unified PnL` in RAW, as published on 2026-10-22, 177 measures. The service model is behind the PBIP only by report-only objects.
- **Queries:** Track A's own DAX, generated with the app's builders in `pnl-model-queries.ts`: Q1, Q2a + Q2b in 4 chunks of 3 KPIs, Q3, Q4, Q5, Q6.
- **Call path:** sent one at a time through `executeQueries` (`fab api`), two runs each.
- **Overhead included:** every figure includes about 1.5 s of CLI + API overhead (a trivial `EVALUATE ROW` takes 1.5 s warm).
- **Cache:** not cleared (read-only round), so run 1 is "first run of this query", not a guaranteed cold cache. Runs 1 and 2 agree, so the formula engine dominates.

**How a view's time is counted.** The app fires every zone in parallel, and the Key figures zone first waits for its KPI-meta call. So a view's time ≈ its slowest call, or meta + slowest chunk for Key figures. Concurrency between the parallel calls isn't included, and neither is the Rayfin UDF / BaaS hop. Both make the app slower than these numbers.

| View (calls) | Default: P, FY2026 YTD Sep, ACT vs BUD / PY, USD, actual rates | Worst case: ACME Group, LTM Sep 2026, same versions |
|---|---|---|
| P&L statement (Q1 + Q6) | Q1 6.5–6.8 s (73 rows) · Q6 2.4–2.5 s → **≈ 6.8 s** | Q1 7.1–7.4 s (101 rows) · Q6 2.3–2.4 s → **≈ 7.4 s** |
| Key figures (Q2a, then 4 × Q2b) | meta 1.7–1.8 s · chunks 5.5–7.8 s → **≈ 9.6 s** | meta 1.7–1.8 s · chunks 6.3–10.5 s (one outlier; otherwise ≤ 7.8 s) → **≈ 9.5–12.3 s** |
| Analysis (Q3 + Q4) | bridge 5.9–6.1 s · drivers 3.1 s → **≈ 6.1 s** | bridge 6.1–6.3 s · drivers 3.6 s → **≈ 6.3 s** |
| Profitability (Q5 + Q6) | 3.9–4.0 s → **≈ 4.0 s** | 3.4–4.3 s → **≈ 4.3 s** |

**Against the target (≤ 5 s, worst case 5–10 s):**
- **Met:** Profitability only.
- **In the 5–10 s band:** Statement and Analysis.
- **Over 10 s in the worst case:** Key figures.

Net of the 1.5 s overhead, the default views are about 5.3 / 8.1 / 4.6 / 2.5 s. The heaviest single calls are the KPI chunks (every KPI value evaluates `_Amt Window` for base + Compare A + Compare B) and Q1. Steps (a) and (b) target exactly that chain (`_Amt Raw`, `_Elim Amount`).

Constant currency is a slow path today. The statement query (Q1) for ACME Group, FY2025 full year, constant currency, USD took **19.7 s** (one run, taken while checking §4.1). It is a candidate for the after-(a) re-timing, because §4.3 keeps constant currency iterative.

### Load verification (2026-10-23)

- **Write:** the USER ran `load_acme_pl.py` on 2026-10-23. The last Delta commit landed at 13:14 UTC: version 1 of the three facts and version 0 of the new `fact_pl_elim`.
- **Metadata sync:** the SQL endpoint showed the new columns and `fact_pl_elim` at 13:38 UTC, about 24 min after the write. That is longer than the ~15 min seen on the first load. No metadata refresh was triggered.
- **`sql/verify-acme-pl.sql`, run read-only at 13:38 UTC:**

  | Check | Result |
  |---|---|
  | 1 Row counts | 29 of 29 tables OK; `fact_pl_elim` has 5,304 rows |
  | 2 T-06 on the fly, P ACT FY2025 NR | 4,575,428,492.38, diff 0.00 |
  | 3 Pre-translated sums vs translation on the fly | 32 of 32 table × version × FY groups OK; the largest difference is 0.000195 |
  | 4 `fact_pl_elim` vs the counterparty rows | 624 block groups; IC rows 5,304 = elimination rows 5,304; 0 groups not negated; 0 regions that don't net to 0; OK |
  | 5 T-06 from `amount_usd` | P FY2025 4,575,428,492.38 and ACME Group FY2026 YTD Sep 3,972,687,506.52, both with diff 0.00 |

- **Endpoint types:** the new columns are `decimal(18,6)`. The columns are not null on the P&L facts and nullable on `fact_operational`, as declared.
- **Service model:** not refreshed, so it still holds the data it processed before this load (rollout step 6 is pending).

### 5.2 After (a) / after (b)

#### Local, after (a)+(b) (bip, 2026-10-23)

**Method.** Same as §5.0: cold Desktop render per view (ClearCache, QueryEnd trace, PBIR reload with the scenario's slicers), first query start → last query end, scenarios S0–S3. To take instance drift out, "before" was re-run in the same session on a scratch copy of the PBIP with the old measures and the new lakehouse data, then "after" in a fresh instance of the rewritten PBIP (no other Desktop running).

| View | Before S0 / S1 / S2 / S3 | After S0 / S1 / S2 / S3 | Change |
|---|---|---|---|
| P&L statement | 4.8 / 5.4 / 5.1 / 5.3 s | 3.3 / 3.3 / 3.4 / 3.4 s | −31…−39 % |
| Key figures | 5.4 / 5.2 / 5.1 / 5.1 s | 4.3 / 4.1 / 4.2 / 4.0 s | −18…−22 % |
| Analysis | 1.5 / 1.8 / 1.4 / 1.5 s | 1.6 / 1.2 / 1.4 / 1.2 s | ±0…−36 % (noise level) |
| Profitability | 4.5 / 4.9 / 4.6 / 4.9 s | 2.4 / 2.3 / 2.5 / 2.3 s | −45…−54 % |

**Target met locally:** every view ≤ 5 s in every scenario (worst 4.3 s, Key figures S0). The slowest query is still the statement matrix, the 12th KPI tile and the profitability table; FE share unchanged (≈ 90–95 %). Constant currency (Group LTM, script replay, ≈ 2× slower than a Desktop render): statement 4.7 s, KPI tile 3.7 s, profitability 4.2 s.

**What made the difference (measured with query-scoped overrides, cold, ×2).** The first rewrite, exactly as §4.2 (`_Amt Raw` = IF units / IF constant currency / `_Rep Sum`), was *not* faster than before: statement 4.9–5.6 s, Key figures 5.6–6.3 s, profitability 4.9–5.5 s. Plan building dominates, and the constant-currency branch (any second fact-scan branch, even a plain `SUM ( amount_local )`) added ≈ 0.4–1.0 s to every visual query whether or not it ran. The engine drops an unused branch only when the condition is `SELECTEDVALUE` of a column the query filters with a literal. The report's slicers filter `param_fx_basis[fx_basis_name]` and `param_reporting_currency[currency_code]`, so `_Amt Raw`, `_Rep Sum` and `_Elim Amount` now read exactly those columns (not `[_Sel FX Basis]` / `[_Sel Currency]`): statement −40 %, profitability −55 %, KPI tile −25 % against the first rewrite. Fallbacks: nothing selected = actual rates / USD (the `is_default` rows); a filter on `fx_basis_code` (Track A, the constant-currency helper measures) still resolves the name, only without the pruning. A `SELECTEDVALUE ( …, [_Sel Currency] )` fallback or an OR over code and name loses most of the gain, so the literals stay; the ADR-0008 FX paths test fails if `param_fx_basis` ever renames its constant-currency row.

**Not done, measured:** `KPI IC Eliminated` / `_Bridge Elim Change` as direct sums of `fact_pl_elim` with their own copy of the window logic: same values, Group LTM bridge 1.24 → 1.11 s (−10 %, within noise of the view). They keep going through `Base Amount` / `Bridge Comparison Amount`, which now end in the plain `fact_pl_elim` sum of `_Elim Amount`; a second copy of the version × window rules was not worth 0.1 s. `Bridge Volume` has no non-constant-currency path (volume is always at constant currency), so it stays on `amount_local` × the year's factor.

**Numbers:** `tests/control-totals.dax` all `_pass` TRUE after the rewrite (T-06 552/552, worst gap 0.004986 as §4.1 predicted; T-05/T-10 54/54; new ADR-0008 blocks: 450/450 rate-path cells, worst gap 0.0006, and 48/48 elimination leaves). All 168 captured visual queries (16 renders) and Track A's 21 probe queries return the same values before and after (worst gap 0.0004), apart from the refresh timestamp and the parity-rule Profitability subtitle.

**Model:** local full refresh 23.7–23.9 s with `fact_pl_elim` (ginee's 14–16 s was without it). Track A: its queries filter the code columns, so the currency SWITCH is pruned there but the FX-basis branch is not; adding a `TREATAS` on `param_fx_basis[fx_basis_name]` to its filter block would give it the same pruning (fin's call). Service timings: ginee's round (§4.1 rollout steps 6–8).

#### Service, after (a)+(b) (ginee, 2026-10-28)

**What changed on the service.** `ACME Unified PnL` in RAW was updated in place from the PBIP TMDL (ADR-0008 (a)+(b) plus the redesign v4 measures and tables: 44 tables, 253 measures), then fully refreshed once. The binding to the existing cloud connection was kept. Rollback copy: `pbi-report/ACME Unified PnL/__backup__/service-2026-10-28/` (gitignored).

**Refresh.** Full refresh 42.9 s, against the 28 s baseline. All 44 objects completed, with 1,251,696 imported rows (+5,304 from `fact_pl_elim`). This is inside §4.1's 35–45 s estimate.

**Tests on the service** (`tests/control-totals.dax`, run through `executeQueries`):
- All `_pass` values are TRUE: T-06 24/24 and 552/552, T-05/T-10 54/54, T-07 empty, L-07, L-09/F-21 15/15, K-20 43/43, the ADR-0008 FX and elimination blocks (48/48), and T-R1…T-R5.
- T-01/T-02, T-03 and T-17 pass by value.
- The T-P parity block passes 601/601. As written (one UNION of 145 rows per selection), it exceeds the capacity's 10,240 MB per-query memory limit on the service, so it was run in chunks of 10 rows with the same filters and the same `_pass` rule.

**Query timings.** The frozen 2026-10-23 set (`fabric-data/perf/queries-2026-10-23/`, Track A's pre-redesign builders) was re-run with the same method as §5.1: sequential, 2 runs, cache not cleared. The CLI and API overhead was 1.9–2.0 s this time, against 1.5 s on 2026-10-23.

| View (calls) | Default, before → after | Worst case (Group LTM), before → after |
|---|---|---|
| P&L statement (Q1 + Q6) | ≈ 6.8 → ≈ 6.7 s | ≈ 7.4 → ≈ 6.6 s |
| Key figures (Q2a + 4 × Q2b) | ≈ 9.6 → ≈ 11.9 s (chunk 4 at 9.6–9.7 s) | ≈ 9.5–12.3 → ≈ 8.5 s |
| Analysis (Q3 + Q4) | ≈ 6.1 → ≈ 7.4 s | ≈ 6.3 → ≈ 6.8 s |
| Profitability (Q5 + Q6) | ≈ 4.0 → ≈ 4.0 s | ≈ 4.3 → ≈ 4.7 s |
| Constant currency: Group FY2025 statement (Q1) | 19.7 → 6.7–7.2 s | |

**Reading.**
- Constant currency is the clear gain: the statement call is 3× faster.
- The other views are flat on the service (±1 s, against an overhead that rose by 0.5 s), unlike the −30…−55 % measured locally. Track A's queries filter `param_fx_basis[fx_basis_code]` / `param_reporting_currency[currency_code]`, so the branch pruning that produced the local gain does not apply to them (see **Model** above).
- These are the old builders. The redesign's own queries (fin's 16 probes) have not been timed yet, so their numbers decide whether Track A meets N-01.

## 6. Consequences

- Loader, lakehouse tables and the model change together; the `TABLES` spec in `load_acme_pl.py` remains the only place column types are declared.
- If (b) changes `dim_entity`, the D-14 contract and every track's entity handling change; prefer the separate-table variant unless bip shows a clear gain.
- Track C is unaffected (its own engine and Parquet build, ADR-0002).

# ADR-0017 — P&L Power BI performance after the web sync

- **Status:** Accepted (USER, 2026-11-16; drafted by ginee). Target 5 s showcase; P0 + P1 now, P2 / P3 only if a page is still over target. **P0 + P1 done 2026-11-17 (§ 7): target met on Vitals and Profitability, not on the statement and Analysis; P2 not started.**
- **Date:** 2026-11-16
- **Decider:** USER
- **Spec:** `docs/Requirements.md` N-01, T-18 · §7 (C-10..C-13) · §10 T-05, T-06
- **Related:** ADR-0003 (plain Python loader, no Spark), ADR-0006 (Track A reads the model, names fixed), ADR-0008 (5 s showcase target, pre-translated amounts, `fact_pl_elim`), ADR-0014 (sync packs)
- **Evidence:** `docs/ADD/features/pnl-pbi-spec-gap-2026-11-16.md` §12, §12.1

## 1. Context

USER, 2026-11-16: "need a snappy report". Speed comes before spec-exact frills, but every number must still match the web.

After ADR-0008 (a)+(b), every view rendered in 2.3–4.3 s cold in Desktop (ADR-0008 §5.2). The web sync (§12, §12.1) added several features: 13 statement columns, bridge labels, a variance totals row, custom range, cross-year constant currency (`param_cc_year`) and text measures. Since then, every Analysis and statement query is far over the 5 s target.

**Measured on 2026-11-16 (bip).** Method: cold script replay, Compare A = Prior year, Consumer Products, YTD Sep 2026, on a shared machine (±50 % drift). A replay runs about 2× slower than a Desktop render (ADR-0008 §5.0).

| Query | Cold | Note |
|---|---|---|
| Statement matrix | 16–23 s | was 31–33 s before §12.1 |
| NR bridge | 5.4–8.8 s (median 6.5) without labels · **11.8–12.6 s with labels** | label text evaluates every step again |
| Profit bridge | 10.5–13.4 s (median 12.2) · **18.5–18.8 s with labels** | labels: 7.1–7.6 → 18.5–18.8 s |
| Variances | 5.4–10.3 s + 2.7 s for the totals row | `LV Delta Bar` adds about 1.3 s |
| Vitals cards | 2.0–6.9 s | drift, no measure change |
| **Analysis page, Desktop, cold, all visuals together** | variances 32 s · NR bridge 53 s · profit bridge 59 s | |

**What these timings show:**
- **The formula engine does the work.** On every slow query the storage engine takes ≤ 1.4 s (formula engine ≥ 90 %). Faster scans alone can save at most about 10 %.
- **Physical changes help only where they remove formula-engine work.** In ADR-0008 the gain did not come from scanning less. It came from removing the per-group `LOOKUPVALUE` chain (about 40 % of each evaluation) and from branch pruning.
- **Where the remaining formula-engine work is:**
  - the constant-currency path: `SUMX` over 4 currencies with 2 `LOOKUPVALUE` calls each. It is used by the bridges, the volume step, the FX column and the trends.
  - the grouped pass over slices in `Bridge Volume`;
  - the filter tables that `FILTER` builds in `_Amt Window` (a version × month CROSSJOIN of up to 144 rows) and `_Amt Row` (all report lines and accounts, for each row and column);
  - the label and text measures, which evaluate every step a second time.
- **The statement and bridges are unsliced since D3.** The web keeps slice filters off, so most queries never need slice grain. Only the variance table (its own 4 slicers), Profitability (region) and the volume step (lowest slice) do. This weakens bip's 2026-10-22 conclusion that "aggregations don't help".

**Grain, from the pack Parquet (read today):**

| Table | Rows | entity × account × month × version | + region | slice × month × version |
|---|---|---|---|---|
| `fact_pl` | 457,896 | 6,054 | 24,216 | 35,256 |
| `fact_pl_allocated` | 758,364 | 3,402 | 13,608 | 34,632 |
| `fact_operational` | 29,016 | — | — | 29,016 (already this grain) |

- BUDGET rates exist for FY 2024–2026, so there are 3 constant-currency years.
- In the model, a 6-dp double on a big fact costs about 20 MB (hash encoded, observed 2026-10-23).
- The pack's `data/` folder is 32 MB today.

## 2. Options

| | What | Who | Effort | Expected gain (reasoning) | Main risks |
|---|---|---|---|---|---|
| **A** | Physical precompute only (detail below) | ginee: loader, verify SQL, pack generator, M; bip: measure routing | 3–4 d | Bridges −20…−40 %, FX column and constant-currency views −10…−40 %. Statement at actual rates ≈ 0 %: it already sums plain columns. **Misses the target on the statement and variances.** | Routing errors (parity), a second `lh_raw` reload, pack growth if the constant-currency columns go on the detail facts |
| **B** | A + bip logical redesign (detail below) | bip (logical), ginee (physical) | 6–8 d | Statement and variances: estimate −40…−70 % (filters become storage-engine joins, cached and shared across columns). Bridges: as A, on top. **Unproven**: bip's set-based rewrites of 3 measures gained nothing, so a prototype decides. | Larger measure change (parity, Track A internals), effort |
| **C** | Change the storage mode to Direct Lake, or something else of that kind | ginee | 3–5 d | **≈ 0 or worse.** Direct Lake runs the same formula engine, and the first query after a refresh or an eviction is slower (transcoding). | The pack (ADR-0014) is Desktop Import from Parquet and cannot be Direct Lake, so the model would split in two. Calculated and param tables and the M typing need rework. Decimal mapping is still unverified. **Not worth it.** |
| **D** | Do nothing | — | 0 | — | Analysis page 32–59 s cold; the showcase fails ADR-0008 |
| **E** | Drop or move frills only (detail below) | bip | 0.5 d | Measured: NR bridge 12 → about 3.7 s, profit bridge 18.6 → about 7.3 s, variances −1.3 s. Statement unchanged. | Spec / web layout deviations (listed in `docs/design/parity-rules.md`). The numbers don't move, because the label measures stay and are tested. |

**Option A, what is precomputed:**
- a small aggregate at entity × account × month × version × region, about 38 k rows (this serves the statement and the bridges);
- a volume driver table at slice × month × version, about 35 k rows: units, NR, and NR at constant currency;
- constant-currency amounts **in long form**: one row per budget-rate FY, in USD only. EUR and GBP are the USD value × the FY's BUDGET rate, which is one scalar per FY and exact, because C-10 gives one BUDGET rate per currency and FY. A new FY therefore adds rows, not columns.
- Aggregations at this level need explicit DAX routing: the built-in aggregation feature needs DirectQuery detail tables, and this model is all Import.

**Option B, the logical redesign (bip):**
- window × version pairs become a `bridge_window`-style mapping table instead of the FILTER-built tables in `_Amt Window`;
- statement row → account sets become a `bridge_row_account`-style table instead of `_Amt Row`;
- check that the 2026-11-16 additions (`param_cc_year`, custom range, label measures) kept ADR-0008's branch pruning.

**Option E, the frills:**
- bridge label text moves from bar labels to the tooltip, where it is evaluated on hover only;
- `LV Delta Bar` is dropped;
- the variance totals row is optional (USER picks).
- Static label formats are rejected: they are right only in USD millions. **Overruled by the USER (2026-11-16): static "$… m" bar labels, see § 6.**

Precompute location (A, B): **loader** (`fabric-data/lh_raw/load_acme_pl.py` + its pack copy) or **Power Query in the model**.

| | Loader | Power Query |
|---|---|---|
| Pros | One place for derived data, as ADR-0008 does. It already has the rate logic and offline checks (4,968 constant-currency cells). `verify-acme-pl.sql` covers it. | No `lh_raw` reload, no pack regeneration, no ADR-0003 amendment |
| Cons | `lh_raw` reload (USER yes, 15–24 min endpoint sync) and pack regeneration | Rate joins in M, with a folding risk on the SQL endpoint; on the Parquet pack the work runs in the mashup engine; checks to rewrite |

**Recommendation:** prototype in M (scratch copy, no writes), ship in the loader.

## 3. Recommendation

**E first, then B in gated phases.** Stop at the first phase that meets the target, as ADR-0008 did. Reasons:
- A alone cannot fix the statement: it already sums plain pre-translated columns, and scans are ≤ 10 % of the time.
- E is the cheapest gain that has been measured, and the USER has ruled that speed beats frills.

**Target: the ADR-0008 showcase target, not the 2 s of N-01.**
- Every page renders in ≤ 5 s after a filter change at the default view, with ≤ 10 s accepted in the worst case (Group, LTM, constant currency). This is measured as a cold Desktop render (ClearCache, trace from the first query start to the last query end, as in ADR-0008 §5.2) and confirmed once on the service.
- Why not 2 s: even before the sync, the best views took 2.3–3.4 s on this formula-engine-bound design, and the sync added work to every view. 2 s stays N-01's long-term number. T-18 stays open.

| Phase | Work | Who | Effort | Verify (all must pass before the next phase) |
|---|---|---|---|---|
| P0 | Frills (E): static "$… m" bar labels (USER), `LV Delta Bar` off, totals row kept (USER). Deviations listed in `parity-rules.md` | bip | 0.5 d | `web-oracle-2026-11-16.dax` 4,515, `web-spec-golden.dax` 1,344, `control-totals.dax` 858: all TRUE; `powerbi-report-author validate` 0 / 0; re-time per the method below |
| P1 | Logical redesign (B): window and row-account mapping tables, branch-pruning check; prototype as query-scoped overrides first, then the PBIP | bip (ginee writes M for any imported mapping table) | 2–3 d | Same 3 test files TRUE; Track A probe queries return the same values (fin's parity specs); re-time. **Stop here if the target is met** |
| P2a | Precompute prototype (A) in M on a scratch copy: aggregate, volume driver table, constant currency in long form; bip routes the measures | ginee + bip | 1–1.5 d | Same values (tests TRUE on the scratch copy); keep a table only if it cuts a page that is over the target by ≥ 20 % |
| P2b | Move the kept tables into the loader + `verify-acme-pl.sql` + pack generator; `--dry-run`, USER yes, `lh_raw` write; model M points at the new tables; pack regeneration | ginee | 1.5–2 d | Loader offline checks (aggregate = detail per group within 0.01; constant currency vs on the fly on the 4,968 cells); `verify-acme-pl.sql` after the endpoint sync; 3 test files TRUE on the repo PBIP and on the pack PBIP; refresh time vs 42.9 s; `pbi-profiler` before / after |
| P3 | Service: backup, `updateDefinition` in place (same item, ADR-0006), refresh; check query caching for the landing view (Fabric capacity setting; verify on MS Learn first) | ginee (USER yes for each write) | 0.5 d | Service tests TRUE (T-P in chunks); Track A probes; the page timings against the target |

**Re-timing method (every phase):**
- unshared machine;
- heaviest query of each page, cold script replay, median of 3 runs interleaved with the previous state;
- then a Desktop cold render of the 4 pages at the default view and at the worst view.

**Total:** about 6–8 days if every phase is needed; 2.5–3.5 days if P1 meets the target.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Parity with the web (target 1 of the sync) | Every phase is gated on the 3 test files. Each precomputed table is checked against the detail before the write. Constant currency is computed from unrounded local amounts. Rounding stays at display (D-30). |
| Aggregate routing picks the wrong table under a detail filter (variance slicers, Profitability region, cost centre) | Route to the aggregate only when no detail column is filtered. The oracle's sliced selections cover the fallback. |
| Track A (ADR-0006) | Additive tables and columns only, and no measure renamed. Track A filters the code columns (`fx_basis_code`, `currency_code`), so routing and pruning must also work on those columns; fin's probes re-run in P1 and P3. |
| Pack size (ADR-0014) | The small tables add an estimated < 3 MB. Constant-currency columns on the detail facts (+~25 MB pack, +~130 MB model memory) are **not** proposed; they are a later step only if sliced constant-currency views still miss the target after P2. |
| A second `lh_raw` reload | The pending D6 (unrounded allocation) reload goes ahead on its own and is not held for this ADR. P2b is a separate, additive reload. Rollback: drop the new tables (the USER runs it); the existing tables are unchanged. |
| bip is editing the report and model in parallel now | P0 starts only after that work lands; this ADR changes nothing until then |
| Measurement noise (±50 % on a shared machine) | Unshared machine, interleaved runs, medians |

## 5. Consequences

- ADR-0003 decision 2 is amended a second time if P2b ships: more derived tables after `fact_pl_elim`. The loader's `TABLES` spec stays the only place where types are declared.
- The model gains a few small tables. The measure dictionary and `docs/model/semantic-model.md` change with P1 and P2.
- The P0 deviations from the spec / web layout are listed as sync deviations, not as amendments (§11 D1).
- Track C is unaffected.

## 6. Decision (USER, 2026-11-16)

| Question | Decision |
|---|---|
| Plan and target | Accepted: E, then B in gated phases; target = ADR-0008 showcase (every page ≤ 5 s after a filter change at the default view, ≤ 10 s worst case). P0 + P1 run now; P2 / P3 only if a page is still over target after P1. 2 s stays N-01's long-term number, T-18 open. |
| Bridge labels | Static "$… m" label formats on the bars (no query cost), not tooltip-only. Correct in USD millions; other units / currencies show the format's fixed text; listed as a sync deviation. |
| Variance totals row | Kept (mirrors the web footer, ~2.7 s cold today). |

## 7. Results (bip, 2026-11-16 / 17)

**Verdict: P0 and P1 done; target not met on two pages.** Vitals and Profitability meet ≤ 5 s / ≤ 10 s. The P&L statement is just over 5 s at the default view and about 18 s in the worst case; Analysis is about 7.6 s (Desktop) at the default view and about 16 s in the worst case. Stopped at P1 as decided (§ 6); P2 is not started.

**Method.** Scratch copies of the repo PBIP on the pack Parquet, one Desktop instance at a time where possible.
- *Desktop page-cold*: ClearCache, open the page, trace from the first query start to the last query end (ADR-0008 § 5.2), default view.
- *Replay*: every query the page sent in Desktop (captured from the trace), run at once after ClearCache, wall from the first start to the last end, 2 runs. D = default view (Consumer Products, YTD Sep 2026, Actual vs Budget / Prior year, USD, actual rates); F = the filter change Compare A Budget → Prior year; W = worst case ACME Group + LTM + constant currency.
- Conditions: a laptop. The baseline and the P1 replays ran on battery; the machine went into Modern Standby between runs (screen off, throttled CPU), and part of the P1 Desktop capture fell in a standby window. Spread between repeat runs ±10 %, between sessions up to ±50 % (ADR-0008 § 5.0). Replays of the Analysis page run its 11 queries at once and come out about 2× the Desktop page time; the statement and the other pages match Desktop within ±15 %.

**Timings, seconds** (Desktop = page-cold default view; D / F / W = replay ranges of 2 runs)

| Page | Baseline Desktop | Baseline D / F / W | P0 | P1 Desktop | P1 D / F / W | Target met |
|---|---|---|---|---|---|---|
| P&L statement | 22.9 | 23.0–23.4 / 23.2–24.0 / 31.2–38.7 | unchanged | 6.4 | 5.5 / 5.8–5.9 / 17.6–19.2 | **no** (default +0.5…1.4 s, worst +8…9 s) |
| Vitals | 6.2 | 5.9–6.7 / 5.8–5.9 / 7.5–7.7 | unchanged | 1.6 | 3.4–3.5 / 3.3–3.4 / 4.6–4.7 | yes |
| Analysis | 21.1 (variances 8.9, NR bridge 16.5, profit bridge 20.7) | 23.0–23.3 / 23.4–23.7 / 23.0–23.3 | Desktop 19.5 (variances 8.1); D 22.6–23.2 (variances 8.5–8.9) / F 23.6–24.3 / W 25.0–25.5 | 7.6 (profit bridge 7.2, NR bridge 2.8, variances 2.5) | 14.3–15.1 / 15.0–15.3 / 16.3–16.4 (profit bridge 14–16, NR bridge 6.2–6.8, variances 4.8–8.1) | **no** (default +2.6 s Desktop, worst +6 s replay) |
| Profitability | 36.9 | 36.6–38.7 / 36.6–36.7 / 37.0–37.5 | unchanged | 2.4 | 4.7–4.8 / 4.6–4.8 / 5.2–5.3 | yes |

**What P0 changed.** `LV Delta Bar` dropped from the variances table (its 164 px went to the line name column); `LV Delta Bar` and `_LV Scale` removed (no test, no Track A query used them). Totals row and static bridge labels kept (USER). Variances query −0.8 s (Desktop) to −2.7 s (replay, worst case) cold; the page time is set by the bridges, so the Analysis page did not move. Deviation listed in `docs/design/parity-rules.md`.

**What P1 changed** (316 measures: −2 in P0, +1 in P1; no rename, no Track A measure removed; ADR-0006):

| Change | Why (measured on the statement query unless noted) |
|---|---|
| `_Win` (new, hidden): the base window in one evaluation, start and end packed in one number; `_Win Start` / `_Win End` decode it; `_Amt Window`, `PY Amount`, `Bridge Volume`, `Prof Trend Growth`, `Prof Trend CM %` read it once | Every engine call rebuilt `_Anchor Index`, `_Sel FY`, `_Sel Month` and `_Last Closed Index` several times (constant scalars as a bound: −60 %). −30 % |
| Selection measures (`_Sel Entity`, `_Sel Base Version`, `_Sel Compare A/B`, `_Sel Time View`, `_Sel Currency`, `_Sel FX Basis`, `_Sel Units`, `_Units Divisor`) fall back to a literal instead of a lookup of `is_default`; test block "ADR-0017 defaults" pins each literal to the data | −12 % |
| `_Amt Entity`: without a channel / category / segment filter only the entity filter is set (the stale-slice logic runs only when a slice is filtered) | −15 % |
| `_PL Compare A/B`, `_PL FY Budget`, `_PL FY LE`: the "comparison has data" check runs only for a blank line | −7 % |
| `Bridge Axis Delta` / `Bridge Axis Is Total`: blank on the chart's total row (the visual calculations never show it; it evaluated a whole step); `Bridge Axis Min` evaluates comparison NR, NR and FX once | NR bridge query 15–16 s → 4.8–8.7 s |
| Profitability table: visual-level filter `Slice Member In View = 1` removed (every row is a region; no fact row lacks one, so it removed nothing) | Table query 36.5 s → 10.5 s (before the measure changes) |

All on top of each other: statement query 23 s → 5.5 s; Track A sends the same measures, so its queries get the same gain.

**Option B as written was measured and not adopted.** Mapping tables as model calculated tables (the same rows as `_Amt Row` / `_Amt Window` build): row → account map 0 %, window map −4 % on the statement query (as query-scoped tables: +146 % / +70 %). The FILTER-built tables are not the cost; the cost is the formula engine evaluating the selection and window measures again on every engine call. Branch pruning of the 2026-11-16 additions holds: with actual rates the constant-currency branch (`param_cc_year`, `_CC FY`) costs nothing (removing it: 0 %); the custom range is evaluated only when selected.

**Gates (P1 = final state, fresh scratch on the pack data).** `web-oracle-2026-11-16.dax` 84 blocks / 4,515 rows TRUE; `web-spec-golden.dax` 16 / 1,342 TRUE; `control-totals.dax` 24 / 867 TRUE (858 + 9 rows of the new "ADR-0017 defaults" block). P0 state: control totals 858 / 0, goldens 1,342 / 0, oracle 84 / 4,515 TRUE (fresh scratch of the P0 state). Track A probe: 60 app queries (statement, KPI, Vitals values and info, both bridges, variances and cut, profitability, concentration, heatmap, context; 5 filter states incl. Group / LTM / constant currency, Commerce Cloud FY, LE in EUR) built by `fabric-app`'s own query builders, run on the P0 and P1 scratches: 2,606 rows identical (only the refresh stamp of the context query differs). `powerbi-report-author validate` 0 / 0.

**What is left, and what P2 would need**

| Page / visual | Now | Over by | Cause | P2 / other lever |
|---|---|---|---|---|
| Statement, default | 5.5–6.4 s | 0.5–1.4 s | Dynamic format strings re-evaluate every cell for the zero rule (no sign on a value that rounds to zero, "n/a" on Δ % when the comparison is 0): about 2.5–3 s of the query | Not P2 (formula engine). USER decision: static formats on the statement would bring it to about 3 s, with "−0.0" instead of "0.0" on values that round to zero (a text deviation from the web; numbers unchanged) |
| Statement, worst (Group, LTM, constant currency) | 17.6–19.2 s | 8–9 s | Constant-currency path: per functional currency `_Local Sum` × two `LOOKUPVALUE`s on every engine call (+35…50 % on the same query) | P2: constant-currency amounts in long form (one row per budget-rate FY, USD; EUR / GBP = × one scalar), so the CC branch becomes a plain sum like actual rates; ADR-0008 § 4 measured −26…−55 % for the same change at actual rates |
| Analysis, profit bridge | 7.2 s Desktop (14–16 s in the page replay) | 2.6 s (default) | Constant-currency chains on every step (GM rate: 4 CC chains per service line or category; GM mix repeats volume and GM rate; FX: 4 chains), and the visual calculations evaluate the chart's measure core about 3× (core 2.1–2.4 s, whole query 6.2 s alone) | P2: CC long form (as above) for every step; a volume driver table (units and NR at CC by slice × month × version) for `Bridge Volume`. Design option outside P2: fewer visual-calculation columns, or the waterfall built from model measures |
| Analysis, NR bridge | 2.8 s Desktop (6.2–6.8 s replay) | — at default | Volume step (grouped pass over ~300 slices) and FX / CC steps | P2: the driver table and CC long form |
| Analysis, variances | 2.5 s Desktop (4.8–8.1 s replay, W 8.1) | — | Money texts evaluate base and comparison per column | — |

Remaining work is formula-engine work on constant-currency and per-cell text formatting, not scans (storage engine ≤ 1.3 s on every query).

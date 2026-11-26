# 02 · Data contract, pre-aggregation build and engine rules

from rusloc/pnl (archi) · to vosk.dev repo agent · 2026-11-26 · status: ready

Reference implementation: `mockup/build-mock-v2-data.py` (build) and `mockup/mockup-v2-core.js` (engine). Amounts below are USD; in code they are integer cents (D-2). "Non-zero" means at least one cent in absolute value (the mock's `≥ 0.005`).

## 1. Input

The generator pack `.sync/data-gen/acme-cash-flow/` writes `parquet/` (15 tables + `manifest.json`) and `checks/control_totals_usd.csv`. Its README is the contract. Signs: ledger balances are **debit positive**; cash postings and control totals are **cash in +, cash out −**.

| ID | Requirement | Src |
| --- | --- | --- |
| CF-DAT-01 | The build reads exactly six tables and two files: `dim_account`, `dim_cf_line`, `dim_counterparty`, `fact_account_balance`, `fact_cash_posting`, `fact_txn`, `parquet/manifest.json`, `checks/control_totals_usd.csv`. The input folder is an argument (`--data <folder>`) or `CF_DATA_DIR`; no path literal. | archi |
| CF-DAT-02 | The source manifest must say `seed 42`, `preset typical`, `currency USD`, span `2024-01-01 … 2026-10-31`; the build prints them and fails on a table whose row count or column types differ from the source manifest. A different span is allowed only if every assert of § 2.3 still passes. | archi |

Columns used:

| Table | Columns |
| --- | --- |
| `dim_account` (60) | `account_id`, `account_name`, `fully_qualified_name`, `parent_account_id`, `account_type`, `account_subtype`, `is_pl`, `is_cash`, `default_section`, `override_section`, `sort_order` |
| `dim_cf_line` (40) | `view`, `line_code`, `section_code`, `line_label`, `line_kind`, `sort_order`, `usual_direction` |
| `dim_counterparty` (114) | `counterparty_id`, `counterparty_name` |
| `fact_account_balance` (2,100) | `account_id`, `month_key`, `opening_balance`, `net_change`, `closing_balance` |
| `fact_cash_posting` (4,424) | `posting_id`, `txn_id`, `txn_date`, `counterparty_id`, `amount`, `is_internal_transfer`, `direct_line_code`, `offset_account_id`, `settled_txn_id`, `cleared_status`, `memo` |
| `fact_txn` (5,128) | `txn_id`, `txn_type`, `doc_number`, `private_note` |

## 2. Pre-aggregation build

`scripts/build-cash-flow-data.ts` (Node, `hyparquet` to read, `hyparquet-writer` to write). It is run by the author, not by `next build`; its output is committed.

### 2.1 Output files (`public/data/`)

| File | Rows | Grain | Columns |
| --- | ---: | --- | --- |
| `manifest.json` | — | — | see CF-DAT-12 |
| `month.parquet` | 34 | month | `month_key` string; int32 cents: `cash_open`, `cash_close`, `net_income`, `revenue`, `interest_expense`, `depreciation_expense`, `ar_close`, `ap_close`, `spend`, `debt_close`, `term_principal` |
| `statement-month.parquet` | 578 | statement account × month (dense, 17 × 34) | `account_id` int32, `month_key` string, `adjustment_cents` int32 |
| `ledger.parquet` | 2,838 | transaction × direct line × counterparty × sign | `txn_date` date32, `line_code` string, `counterparty_id` int32, `txn_id` int32, `txn_type` string, `doc_number` string (`''` when none), `amount_cents` int32 (in +, out −), `cleared` string (`R` `C` `U` `N`), `memo` string |
| `control.parquet` | 777 | period × metric × scope | `period_key`, `metric_code`, `scope` strings, `value` double |

Measured on a trial write of the mock's data (pyarrow, snappy, dictionary encoding): `ledger` 52.1 kB, `control` 7.0 kB, `month` 6.3 kB, `statement-month` 2.8 kB = 68.2 kB, plus a manifest of about 6 kB.

| ID | Requirement | Src |
| --- | --- | --- |
| CF-DAT-03 | Output = the five files above, nothing else. Parquet uncompressed or snappy (what `hyparquet` reads without add-ons). Deterministic: a rerun on the same input is byte-identical (fixed row order, sorted keys, no timestamps). | ADR-0002 |
| CF-DAT-04 | **Size budget: `public/data/` ≤ 150 kB in total** (expected about 75 kB), all of it loaded at first paint. The build prints the sizes and fails above the budget. No raw fact table, no `qbo/` JSON and no full control CSV reaches the browser. | ADR-0002, D-3 |
| CF-DAT-05 | Money → cents with `Math.round(x * 100)`; fail if `|x × 100 − round| > 1e-6` or the value does not fit int32. | D-2 |
| CF-DAT-06 | `public/data/` and `fixtures/checks/control_totals_usd.csv` are committed, so `npm run build` and `npm test` need neither Python nor the generator pack. A data change = regenerate the pack, rerun the build script, commit. | ADR-0014 |

### 2.2 Derivations

Months = every `month_key` from the source `start_date` to `end_date` (34). `fact_account_balance` also holds `2023-12` (the opening position); it is not a month of the app.

| ID | Requirement | Src |
| --- | --- | --- |
| CF-DAT-07 | **Account roles by attribute, each with an assert on the expected count today** (D-8): cash set = `is_cash` (4 accounts); P&L = `is_pl`; revenue = `account_type = 'Income'`; A/R = `account_type = 'Accounts Receivable'` (1); A/P = `'Accounts Payable'` (1); interest expense = `account_subtype = 'InterestPaid'` (1); depreciation expense = `account_subtype = 'Depreciation'` (1); debt = `account_subtype = 'LineOfCredit'` (1) + `account_type = 'Long Term Liability'` (2); spend = `account_type` in (`Cost of Goods Sold`, `Expense`) except sub-types `PayrollExpenses`, `BadDebts`, `InterestPaid` (19 accounts). | D-8 |
| CF-DAT-08 | `month.parquet`, per month: `cash_open` = Σ `opening_balance` of the cash set; `cash_close` = Σ `closing_balance` of the cash set; `net_income` = −Σ `net_change` of P&L accounts; `revenue` = −Σ `net_change` of revenue accounts; `interest_expense`, `depreciation_expense` = `net_change` of that account; `ar_close` = A/R `closing_balance`; `ap_close` = −A/P `closing_balance`; `spend` = Σ `net_change` of spend accounts; `debt_close` = −Σ `closing_balance` of debt accounts. A missing balance row counts as 0. | mock |
| CF-DAT-09 | **Statement accounts** (indirect view, S01 override on): every account that is neither P&L nor cash, whose section `override_section ?? default_section` is `OPERATING`, `INVESTING` or `FINANCING`, and that has a non-zero monthly adjustment in at least one month. `adjustment = −net_change` (so an asset increase is a cash outflow). Group: `DEP` when `account_subtype = 'AccumulatedDepreciation'`, else `OP` / `INV` / `FIN` from the section. Label: `fully_qualified_name` with `:` → ` · `; for `DEP`: `Depreciation · <parent account_name>`. Order: `sort_order`. `override` = `override_section` is set (today: Line of Credit only). Today 17 accounts: 2 DEP, 8 OP, 2 INV, 5 FIN. | c1, mock |
| CF-DAT-10 | **Direct lines**: `dim_cf_line` rows with `view = 'DIRECT'` and `line_kind = 'data'`, by `sort_order` (16: 8 Operating, 4 Investing, 4 Financing). Section codes shorten to `OP`, `INV`, `FIN`. | c1 |
| CF-DAT-11 | **Ledger rows**: take `fact_cash_posting` with `is_internal_transfer = false` (3,204 of 4,424); a posting whose `direct_line_code` is not a direct data line fails the build. Group by (`txn_id`, `direct_line_code`, `counterparty_id`, sign of `amount`); `amount_cents` = Σ; `txn_date`, `cleared` (`Reconciled` → `R`, `Cleared` → `C`, `Uncleared` → `U`, `NotApplicable` → `N`) from the group's first posting; `txn_type`, `doc_number` from `fact_txn`. **Memo**: the first non-empty posting `memo` in the group, else the transaction's `private_note`, else, when the group settles documents, `"<txn_type> <doc_number or txn_id>"` of the first settled document plus `" + n more"`, else `''`. Row order: `txn_date`, `txn_id`, line order, sign (− before +). Today 2,838 rows; no group mixes cleared states or memos (assert both). | c1, mock |
| CF-DAT-12 | `term_principal` per month = −Σ `amount_cents` of ledger groups on `D_FIN_REPAID` whose postings' `offset_account_id` are all Long Term Liability accounts. A group that mixes those with another account fails the build. Line-of-credit repayments are excluded by this rule. | mock |
| CF-DAT-13 | `control.parquet` = the control rows with `period_key` like `M-…` or `Y-…` (37 periods; not `ALL`), `metric_code` in M01, M02, M03, M04, M06, M07, M08, M09, M10, M15, M16 (scope `ALL` or `OVERRIDES_ON`) or `DIRECT_LINE` (scope = line code). 777 rows. | D-4 |
| CF-DAT-14 | `manifest.json` (strict Zod; unknown keys fail): `dataset`, `source` (`engine_version`, `seed`, `preset`), `as_of`, `start_date`, `end_date`, `currency`, `company` (`"ACME Advisory Services LLC"`, a build constant), `months[]`, `lines[]` (`code`, `section`, `label`, `direction`), `accounts[]` (`id`, `label`, `group`, `override`), `counterparties[]` (`id`, `name`; only the 98 ids the ledger uses), `files[]` (`name`, `rows`, `bytes`, `sha256`, `columns`), `asserts` (`control_values`, `periods`). | ADR-0002 |

### 2.3 Build asserts (acceptance test AT-01)

The build recomputes, **from its own output tables**, every value below for 38 periods (34 months, `Y-2024`, `Y-2025`, `Y-2026`, `ALL`) and compares with the control CSV. Tolerance 0.005 USD; M16 at 1e-6 relative. Any failure: exit code 1, no files written.

| Metric (scope) | Recomputed as |
| --- | --- |
| M01, M02, M03 (`ALL`) | `cash_open[a]`, `cash_close[b]`, their difference |
| M04, REVENUE (`ALL`) | Σ `net_income`, Σ `revenue` |
| M05 (account id) | Σ `adjustment` per statement account; **both ways**: every control row reproduced and no non-zero recomputed row without a control row |
| M06, M07, M08 (`OVERRIDES_ON`) | NI + Σ DEP + Σ OP; Σ INV; Σ FIN |
| M09, M10 (`ALL`) | Σ positive, Σ negative ledger amounts |
| M15 (`ALL`) | M06 + ledger `D_INV_PURCHASE` + `D_INV_PROCEEDS` |
| M16 (`ALL`) | M06 ÷ M04 when M04 is non-zero |
| DIRECT_LINE (line code) | Σ ledger amount per line; both ways |
| roll-forward (no control row) | `cash_open[a]` + M09 + M10 = `cash_close[b]` |

Expected today: **1,554 control values over 38 periods, all pass**, and the roll-forward holds in all 38.

## 3. Engine rules

### 3.1 Signs and precision

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-01 | Cash in is positive, cash out negative, on every level. Sums run on integer cents; ratios are unrounded doubles; rounding happens only in `format.ts`. | Tab 1 § 5, D-2 |

### 3.2 Periods (`calendar.ts`)

Months are indexed 0 … N−1 from the manifest; "last" = the last data month (Oct 2026).

| Mode | Window `a … b` | Label | Control key | Prior window (same length) | Prior label |
| --- | --- | --- | --- | --- | --- |
| `M` month | the month | `Oct 2026` | `M-2026-10` | the month before | `Sep 2026` |
| `Q` quarter | quarter start … min(quarter end, last) | `Q3 2026` | none | starts 3 months earlier | `Q2 2026` |
| `A` calendar year | Jan … min(Dec, last) | `2025` | `Y-2025` | starts 12 months earlier | `2024`, or `Jan–Oct 2025` when the year is partial |
| `Y` year to date | Jan … the month | `YTD Oct 2026` | `Y-2026` only when the month is Dec or last; else none | starts 12 months earlier | `YTD 2025` |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-02 | `period(mode, year, month)` returns `a`, `b`, `label`, `key`, `prior`, `priorLabel`, first and last calendar day, `days` (calendar days in the window) and `partial` as in the table. `partial` = a quarter with fewer than 3 months or a year with fewer than 12. | c14 |
| CF-ENG-03 | `prior` is null when it would start before the first data month; the page then says "no prior period". The prior window always has the length of the current one (a one-month Q4 compares with the first month of Q3). | mock |
| CF-ENG-04 | Quick handles resolve against the last data month: `YTD` = mode `Y`, `QTD` = mode `Q`, `MTD` = mode `M`, each at (last year, last month). The selection remembers that a quick handle set it. | c14 |
| CF-ENG-05 | Reachable periods today: 34 months + 12 quarters (Q4 2026 partial) + 3 years (2026 partial) = **49**; 37 of them carry a control key. The engine also accepts `Y` at any month (used by the self-check, not by the UI). | c14 |

### 3.3 Statement (`statement.ts`)

For a window `a … b`, with `v(x)` = Σ of account x's monthly adjustments:

```
open  = cash_open[a]              close = cash_close[b]            net = close − open
ni    = Σ net_income
dep[] = DEP accounts, wc[] = OP accounts, inv[] = INV accounts, fin[] = FIN accounts   (each with v ≠ 0)
adj   = Σ dep + Σ wc              op = ni + adj                    iv = Σ inv         fn = Σ fin
tie:    op + iv + fn = net
```

Row list (`k` = kind, `d` = indent level):

| # | k | Label | Value | d |
| --- | --- | --- | --- | --- |
| 1 | bal | Cash at beginning of period | open | 0 |
| 2 | secx | Operating activities | op when collapsed, blank when expanded | 0 |
| 3 | data | Net income | ni | 1 |
| 4 | sub | Adjustments to reconcile net income | — | 1 |
| 5 | data | each DEP account | v | 2 |
| 6 | sub | Changes in operating assets and liabilities (only when wc has rows) | — | 2 |
| 7 | data | each OP account | v | 3 |
| 8 | tot | Total adjustments | adj | 1 |
| 9 | sect | Net cash from operating activities | op | 0 |
| 10 | secx | Investing activities | iv when collapsed | 0 |
| 11 | data | each INV account | v | 1 |
| 12 | sect | Net cash from investing activities | iv | 0 |
| 13 | secx | Financing activities | fn when collapsed | 0 |
| 14 | data | each FIN account (flag `override` → S01 chip) | v | 1 |
| 15 | sect | Net cash from financing activities | fn | 0 |
| 16 | grand | Net increase (decrease) in cash | net | 0 |
| 17 | bal | Cash at end of period | close | 0 |

A collapsed section shows its `secx` row only; rows 3–9, 11–12 or 14–15 appear when it is expanded. A 10 px gap row sits after row 1 and before row 16.

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-06 | The statement is the indirect view with the S01 override on: the line of credit sits in Financing. `op`, `iv`, `fn` equal M06, M07, M08 `OVERRIDES_ON`. | c1 |
| CF-ENG-07 | First row = cash at the beginning of the period, last row = cash at the end, in the order of the classic statement (table above). | c1 |
| CF-ENG-08 | An account row whose value is zero for the window is hidden. A section with no rows still shows its header and its "Net cash from …" row (value `–`). | c1 (open: Q-12) |
| CF-ENG-09 | **% of net income** per row = value ÷ ni × 100. Shown on every row with a value except `bal` and `sub` rows. When ni is not positive (zero or a loss): `n/m` on every such row. Format: 0 decimals, 1 decimal when the absolute value is under 10; negatives in parentheses; `%` without a space; never `(0.0%)`. | c3 |
| CF-ENG-10 | **Bar axis**: `max = niceMax(largest |value| among the rows on screen that are not bal rows)`, `niceMax(v)` = the smallest of {1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10} × 10^⌊log10 v⌋ that is ≥ v (1 when v ≤ 0). Bar length = |value| ÷ max. Ticks at 0, 25, 50, 75, 100 % of max, printed with the money format and the `k` suffix in USD k; zero prints `0`. A `bal` bar longer than the axis is cut at 100 % and flagged `clipped`. | c1, c2 |

### 3.4 Direct lines, heat grid, ledger (`direct.ts`, `quintile.ts`)

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-11 | Line totals for a window = over ledger rows dated in its months: `in` = Σ positive, `out` = Σ negative, `net`, `n` = row count. Section flows = the same summed over the section's lines. M09 = Σ in, M10 = Σ out over all lines; `open + M09 + M10 = close`. | c4 |
| CF-ENG-12 | **Heat grid** for one activity and window: rows = that activity's direct lines in line order, columns = every calendar date of the window, **one column per date, never aggregated**. Cell = `in`, `out`, `n` of the ledger rows of that line and date. Cell value = `in − out` (cash moved, absolute). | c1, c5 |
| CF-ENG-13 | **Five equal-count blocks.** Take the non-zero cell values of the activity in the window, sorted ascending (n values). Block of a value = `clamp(ceil((index of its last occurrence + 1) × 5 ÷ n), 1, 5)`: equal values share a block and ties go up. Block 5 is the top 20 %. Also return per block the smallest and largest value in it (legend tooltips). n = 0 → no blocks. | c9 |
| CF-ENG-14 | **Totals column blocks**: the same function over the activity's non-zero `|net|` row totals in the window. With few rows gaps appear (3 rows → blocks 2, 4, 5); the largest total is always block 5. A zero total has no block. | c9, c10 |
| CF-ENG-15 | **Row sort**: none (line order, default), by label (A–Z or Z–A, `localeCompare` `en`), or by `|net|` total (high–low or low–high; ties keep line order). A sort moves whole rows: label, cells, total. | c10 |
| CF-ENG-16 | **Ledger filter**: rows of one activity (all its lines) or one line, dated within the window or on one date. Order: date, transaction id, amount ascending. Summary: cash in, cash out, net, count. The net of a line over the window equals its heat row total and its `DIRECT_LINE` control value. | c1 |

### 3.5 KPIs and Diagram metrics (`metrics.ts`)

For a window `a … b` with `months = b − a + 1`, `days` = calendar days, `L(code)` = that direct line's net, and month-table sums / end values:

| Metric | Formula | Null when |
| --- | --- | --- |
| Closing cash (M02) | `close` | — |
| Net change (M03) | `net` | — |
| Operating cash flow, CFO (M06) | `op` | — |
| Capex | `−L(D_INV_PURCHASE)` | — |
| Free cash flow (M15) | `CFO − capex + L(D_INV_PROCEEDS)` | — |
| Cash conversion (M16) | `CFO ÷ ni` | ni is zero. **Displayed** `n/m` whenever ni is not positive |
| CFO margin (M17) | `CFO ÷ revenue` | revenue ≤ 0 |
| Accruals | `ni − CFO` | — |
| DSO | `ar_close[b] ÷ revenue × days` | revenue ≤ 0 |
| DPO | `ap_close[b] ÷ spend × days` | spend ≤ 0 |
| Cash conversion cycle | `DSO − DPO` (no inventory) | either is null |
| Capex intensity | `capex ÷ revenue` | revenue ≤ 0 |
| Capex coverage | `CFO ÷ capex` | capex is zero → text `no capex` |
| Debt service | `−L(D_PAY_INT) + Σ term_principal` | — |
| DSCR | `CFO ÷ debt service` | debt service is zero |
| EBITDA | `ni + Σ interest_expense + Σ depreciation_expense` | — |
| Net debt | `debt_close[b] − close` | — |
| Net debt ÷ EBITDA | `net debt ÷ (EBITDA × 12 ÷ months)` | annualised EBITDA ≤ 0 |
| Owner draws | `−L(D_FIN_DRAWS)` | — |
| Payout cover | `CFO ÷ draws` | draws is zero → text `no draws` |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-17 | `metrics(period)` returns every row of the table, unrounded, with `null` where the table says so. Negative ratios are legitimate and shown (DSCR −6.27× in Oct 2026). | c1 |
| CF-ENG-18 | Cash conversion keeps its raw value for the control tie (Oct 2026: 28.328446) and carries a flag `meaningful = ni > 0`; every face shows `n/m` when the flag is false. | c1, c3 |
| CF-ENG-19 | **KPI delta** = value − the same metric on the prior window. Null value or null prior value → `vs <prior label>: n/m`; no prior window → `no prior period`. Arrow `▲` when the delta is positive, `▼` when negative, none when zero; the delta prints as an absolute value in the card's unit. The arrow states direction only, never good or bad. | c1, c2 |

### 3.6 Formats (`format.ts`)

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-20 | **Money**: `en-US` thousands separators, no currency symbol. USD: 0 decimals. USD k: value ÷ 1,000, 1 decimal. Negative in parentheses. A value that prints as zero, and null, print `–` (en dash). Option `suffix` appends `k` in USD k (KPI cards, Diagram, axis ticks). Option `exact`: 2 decimals in USD regardless of the unit (Reconciliation always; ledger amounts, ledger tiles and heat tooltips when the unit is USD). | c1, Tab 1 § 11.1 |
| CF-ENG-21 | **Ratios** `1.04×` (2 decimals), **days** `46.4` on the card and `46.4 d` in the Diagram (1 decimal), **percent** `15.9%` (1 decimal, Diagram). Negatives of these three use the minus sign U+2212. Null → `n/m`. | mock |
| CF-ENG-22 | **Compact** (legend tooltips): under 1,000 → 0 decimals; under 100,000 → `12.6k`; else `126k`. | mock |
| CF-ENG-23 | **Dates** (UTC arithmetic only): `5 Oct` · ledger `5 Oct 26` · long `Mon 5 Oct 2026` · context line `1 Oct – 31 Oct 2026` · as-of `5 Nov 2026` from the manifest. Transaction types print with spaces (`BillPayment` → `Bill Payment`). | mock |

### 3.7 Self-check (`self-check.ts`)

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ENG-24 | `selfCheck(key?)` compares the engine's output with `control.parquet` and returns rows `{period, metric, page, control, ok}`. Per control period, 44 checks: the 12 below and, for each of the 16 direct lines, heat row sum and ledger sum against `DIRECT_LINE` (0 when the control has no row). Tolerance 0.005 USD; M16 1e-6 relative. | c1, c11 |
| CF-ENG-25 | Without a key it adds 2 × 19 structural checks for Q3 2026 and YTD Oct 2026: heat column count = calendar days per activity (3) and heat row sum = line total per line (16). Total today: 37 × 44 + 38 = **1,666 checks, all pass**. | c5 |

The 12 head checks: M01 opening · M02 closing · M03 net change · M06 operating · M07 investing · M08 financing (statement) · `op + iv + fn` = M03 · M09 cash in · M10 cash out · `open + in + out` = M02 (Cash balance card) · M15 free cash flow · M16 cash conversion (raw).

## 4. Reference values (seed 42)

For unit tests and a first visual check. USD, to the cent.

| | Oct 2026 (default) | YTD Oct 2026 | 2025 | Q3 2026 | Jan 2024 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Opening cash | 351,232.32 | 299,118.89 | 268,734.16 | 302,988.00 | 110,650.00 |
| Net income | −662.97 | 193,818.52 | 269,257.71 | 57,031.24 | 7,423.32 |
| Total adjustments | −18,117.94 | 8,204.35 | −36,531.96 | 18,097.01 | 2,138.93 |
| Operating (indirect) | −18,780.91 | 202,022.87 | 232,725.75 | 75,128.25 | 9,562.25 |
| Investing (indirect) | 0.00 | −28,400.00 | −9,500.00 | 0.00 | 0.00 |
| Financing (indirect) | −17,321.95 | −157,612.30 | −192,841.02 | −26,883.93 | 12,000.00 |
| Net change | −36,102.86 | 16,010.57 | 30,384.73 | 48,244.32 | 21,562.25 |
| Closing cash | 315,129.46 | 315,129.46 | 299,118.89 | 351,232.32 | 132,212.25 |
| Cash in (M09) | 175,915.04 | 1,616,433.28 | 1,623,589.07 | 467,339.20 | 151,550.07 |
| Cash out (M10) | −212,017.90 | −1,600,422.71 | −1,593,204.34 | −419,094.88 | −129,987.82 |
| Operating / Investing / Financing (direct net) | −18,780.91 / 0 / −17,321.95 | 202,022.87 / −28,400.00 / −157,612.30 | 251,225.75 / 13,500.00 / −234,341.02 | 75,128.25 / 0 / −26,883.93 | 9,562.25 / 0 / 12,000.00 |
| Free cash flow | −18,780.91 | 173,622.87 | 246,225.75 | 75,128.25 | 9,562.25 |
| Cash conversion | n/m (raw 28.3284) | 1.04× | 0.86× | 1.32× | 1.29× |
| DSO | 46.4 | 48.0 | 49.9 | 45.1 | 46.4 |
| DPO / cycle | 4.7 / 41.7 | 5.0 / 43.0 | 5.9 / 44.0 | 9.9 / 35.2 | 12.9 / 33.5 |
| DSCR | −6.27× | 6.59× | 7.47× | 8.42× | n/m |
| Net debt ÷ EBITDA | −5.46× | −0.64× | −0.67× | −0.91× | −1.07× |
| Prior window | Sep 2026 | Jan–Oct 2025 (`YTD 2025`) | 2024 | Q2 2026 | none |

Default landing, KPI faces: Closing cash `315,129` `▼ 36,103 vs Sep 2026` · Net change `(36,103)` `▼ 50,491` · Operating cash flow `(18,781)` `▼ 35,477` · Free cash flow `(18,781)` `▼ 35,477` · Cash conversion `n/m` `vs Sep 2026: n/m` · DSO `46.4` `▲ 4.5`.

Default landing, statement rows (Oct 2026): Depreciation · Office Equipment 1,968.89 · Depreciation · Vehicles 691.67 · Accounts Receivable (A/R) (22,826.92) · Prepaid Expenses 1,010.00 · Accounts Payable (A/P) (6,415.10) · Harborline Visa Business (22.70) · Payroll Liabilities · Federal Payroll Taxes 7,639.61 · Payroll Liabilities · State Payroll Taxes 1,486.21 · Sales Tax Payable (1,649.60) · no investing rows · Line of Credit - Larkspur Bank 35,000.00 [S01] · Term Loan - Larkspur Bank (1,496.37) · Vehicle Loan - Crestline Auto Finance (825.58) · Owner's Equity · Owner Draws (50,000.00). The % of NI column reads `n/m`. Cash balance card: 351,232 + 175,915 + (212,018) = 315,129.

Activities, Operating, Oct 2026: 37 non-zero cells; block sizes 7 / 7 / 8 / 7 / 8; block bounds 55.40–296.37 · 410.85–2,666.41 · 2,682.50–5,299.34 · 6,431.25–10,930.00 · 12,602.57–37,698.01. Row totals: Receipts from customers 110,957.79 (30 rows) · Other operating receipts 653.49 (1) · Payments to suppliers (39,035.34) (14) · Payroll and contractor payments (76,208.75) (34) · Taxes paid (1,817.91) (6) · Interest paid (672.22) (3) · Credit card settlements (12,602.57) (1) · Other operating payments (55.40) (1); totals-column blocks in that order 5, 2, 4, 5, 3, 2, 4, 1. Financing, Oct 2026: 4 cells → blocks 2, 3, 4, 5; totals Loan proceeds 35,000.00 (block 4), Loan principal repaid (2,321.95) (2), Owner contributions – (none), Owner draws and dividends (50,000.00) (5). Investing, Oct 2026: no cells. Transactions, Operating, all lines, Oct 2026: 90 rows.

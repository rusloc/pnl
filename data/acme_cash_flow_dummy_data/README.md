# ACME Cash Flow — synthetic QuickBooks Online company

Sample data for the ACME Cash Flow showcase report, a replacement for the QuickBooks Online (QBO) Statement of Cash Flows: ADR-0019 and the spec pair in `.sync/acme cash flow/spec/` (`Tab 1.md` = report spec, `Data generator spec.md` = generator spec). **All names and figures are invented and illustrative.** The generator is deterministic: seed 42 gives byte-identical Parquet and JSON.

This README is the data contract for the report, whichever delivery tool ADR-0019 settles on. Table, column and code names here take precedence over any name in the specs.

- **Company:** ACME Advisory Services LLC, an established IT and analytics services firm (profile `services`, size S) that moved its books to QBO at the end of 2023. It has three revenue streams: consulting (hourly and milestones), managed-services retainers (fixed monthly fees) and training workshops (the only stream with sales tax). There are 66 customers (46 existing, 20 new over the span, 14 lost), 38 vendors and 9 employees (6 at the start, 3 hires, 1 leaver).
- **Span:** transactions from **1 Jan 2024 to 31 Oct 2026** (34 months). Before that, an opening-balance journal entry is dated 31 Dec 2023, and the Nov–Dec 2023 invoices and bills that are still open on that date carry the opening A/R and A/P.
- **As of:** **2026-11-05 09:00** (US Pacific). This is the "now" for `MetaData` times, report headers and cleared status.
- **Currency:** USD only. The fiscal year is the calendar year, and the basis is accrual.
- **Cash set:** QBO cash, meaning the Bank accounts plus Undeposited Funds (`dim_account.is_cash`). The bank-only view stays derivable (see "Bank-only view").
- **Size:** 15 tables, **28,269 rows, 0.68 MB of Parquet**. The `qbo/` folder holds **96 files and 9.1 MB of JSON** with 5,128 transactions. Generation takes about 2 s and `verify.py` about 28 s.

## How to run

```powershell
cd data\acme_cash_flow_dummy_data
py -3.12 -m venv generator\.venv                                    # once; .venv is gitignored
generator\.venv\Scripts\python.exe -m pip install -r generator\requirements.txt
generator\.venv\Scripts\python.exe generator\generate.py            # writes parquet\, qbo\ and checks\control_totals_usd.csv (about 2 s)
generator\.venv\Scripts\python.exe checks\verify.py                 # 74 checks incl. a byte-identical rerun; exit 1 on any failure (about 28 s)
```

- `generate.py --out <folder>` writes `<folder>\parquet\…`, `<folder>\qbo\…` and `<folder>\checks\control_totals_usd.csv`; the default is this folder. `verify.py --data <folder>` checks that folder, and `--no-rerun` skips the determinism rerun (I13).
- `requirements.txt` pins numpy 2.5.4, pandas 2.3.3 and pyarrow 26.0.0 plus their transitive dependencies, the same pins as the Marketing, Mirelo and Nordmark generators.
- The engine stops the run on a breach of I09, C01, C06, C09 or C10 (generator spec section 2, "Validator").
- `checks\verify.py` imports nothing from `generator\`. It does three things with its own code:
  - re-posts every QBO transaction from the JSON with its own posting rules;
  - rebuilds every cash posting with its own look-through and mapping;
  - recomputes every control total from the ledger.

### Generator modules (`generator/`)

| Module | Pipeline stage (generator spec section 2) |
| --- | --- |
| `config.py` | Configuration (section 3), chart-of-accounts template, name pools |
| `company.py` | Company builder: accounts, customers, vendors, employees, classes, items, terms, payment methods |
| `sim_sales.py`, `sim_spend.py`, `sim_capital.py`, `cashpass.py` | Event simulator: P01–P14 and the cash constraint |
| `scenarios.py` | Scenario planting (S03, S06, S07, S08, S18; S02, S04, S13 sit in `sim_capital.py`, S01 in `cashpass.py` and `classify.py`) |
| `book.py`, `emit.py` | QBO emitter: object shapes, Ids, numbers, MetaData, SyncToken, links, Balance |
| `ledger.py` | Ledger poster (section 6.1) |
| `classify.py`, `derive_core.py`, `derive_more.py` | Cash set, mapping, cash postings, non-cash items, exceptions, dimensions |
| `reports.py`, `reports_gl.py` | Report builder (section 6.2) |
| `oracle.py`, `metrics.py`, `writers.py`, `generate.py` | Oracle, control totals, writers, entry point |

## Files

| File | Rows | Grain (one row per …) |
| --- | ---: | --- |
| parquet/dim_account.parquet | 60 | QBO account (40–80 required; 18 sub-accounts on two levels) |
| parquet/dim_cf_line.parquet | 40 | statement line × view (INDIRECT, DIRECT) |
| parquet/dim_counterparty.parquet | 114 | customer, vendor or employee, plus id 0 "(no name)" |
| parquet/dim_class.parquet | 4 | class *(addition)* |
| parquet/dim_date.parquet | 1,157 | day, 2023-11-01 … 2026-12-31 *(addition)* |
| parquet/map_account_line.parquet | 138 | mapping or override row |
| parquet/fact_txn.parquet | 5,128 | transaction (Level 4 header) *(addition)* |
| parquet/fact_ledger_line.parquet | 11,789 | ledger line of a transaction *(addition: the full ledger)* |
| parquet/fact_cash_posting.parquet | 4,424 | cash transaction × offsetting split line (× settled document line after look-through) |
| parquet/fact_account_balance.parquet | 2,100 | account × month end, 2023-12 … 2026-10 |
| parquet/fact_settlement_link.parquet | 2,301 | payment line × settled document line (and deposit line × swept payment) |
| parquet/fact_noncash_item.parquet | 8 | transaction × section with a gap between the direct and indirect views *(addition: the C07 items)* |
| parquet/fact_exception.parquet | 90 | exception of report spec 10.2 *(addition)* |
| parquet/ctl_qbo_cashflow.parquet | 904 | month × QBO CashFlow row, parsed back from `qbo/reports/CashFlow/*_Month.json` |
| parquet/ctl_scenario.parquet | 12 | scenario instance: the oracle as a table *(addition)* |
| parquet/manifest.json | — | seed, engine version, as-of, span, scenarios; rows, bytes and column → Arrow type per table |
| qbo/entities/&lt;Entity&gt;.jsonl | 5,323 lines | one QBO entity object per line, in Id order; 23 entity types |
| qbo/query/&lt;Entity&gt;.json | 23 | a `QueryResponse` envelope sample per entity (first 3 objects) |
| qbo/reports/&lt;Report&gt;/&lt;start&gt;_&lt;end&gt;_&lt;Month\|Total&gt;.json | 48 | QBO report objects, six-month windows (see "QBO files") |
| qbo/expected/scenarios.jsonl | 12 | oracle records (generator spec section 7) |
| qbo/expected/chains.jsonl | 2,059 | process chains: the transactions of one business event |
| qbo/manifest.json | — | configuration, seed, engine version, counts per entity, SHA-256 and bytes per file |
| checks/control_totals_usd.csv | 2,662 | period × metric × scope |
| checks/verify.py | — | the independent checks |
| generator/*.py, generator/requirements.txt | — | the generator and its pins |

The additions are what levels 0–4 and checks C01–C10 need beyond the eight tables of report spec 9.2:

- `fact_ledger_line` gives net income, balances and the Level 4 split lines.
- `fact_txn` gives the Level 4 header: type, number, method, cleared status and audit times.
- `fact_noncash_item` and `fact_exception` hold the C07 items and the exceptions panel.
- `dim_class` and `dim_date` serve the filters and time intelligence.
- `ctl_scenario` lets a BI tool test against the oracle.

There is no `dim_location` because the `locations` feature is off (generator spec section 3 default).

## Format

- Parquet, snappy, one file per table, no pandas metadata.
- Arrow types:
  - `date32` for dates;
  - `timestamp[ms]` for `created_at`, `updated_at` and `pulled_at` (local US Pacific time, no zone);
  - `int32` for ids, sequences and orders;
  - `double` for every amount (USD, rounded to the cent; model as Decimal Number (double), never Fixed Decimal) and ratio;
  - `bool` for flags and `string` for codes.
- Ids are the QBO Ids as integers. Transactions share one sequence, numbered in creation order. Customers, vendors and employees share a second sequence, and accounts, classes, items, terms and payment methods have their own.
- **Ledger sign:** `amount` in `fact_ledger_line` and the balances in `fact_account_balance` are **debit positive** for every account.
- **Cash sign:** every amount in `fact_cash_posting`, `fact_noncash_item`, `ctl_qbo_cashflow` and the control totals follows the report's sign rule: **cash in positive, cash out negative**.
- `month_key` is text in the form `2026-10`.

## Relationships

- `fact_ledger_line`, `fact_cash_posting`, `fact_noncash_item` and `fact_exception`: `[txn_id]` → `fact_txn[txn_id]`. Every fact `txn_date` → `dim_date[date]`.
- `fact_ledger_line[account_id]`, `fact_cash_posting[cash_account_id]`, `fact_account_balance[account_id]` and `map_account_line[account_id]` → `dim_account[account_id]`.
- `fact_cash_posting[offset_account_id]` is a second account role. Keep that relationship inactive, or use a role-playing copy of `dim_account`.
- `[counterparty_id]` → `dim_counterparty` (0 = no name) and `[class_id]` → `dim_class` (null where QBO had none).
- `fact_cash_posting[direct_line_code]` → `dim_cf_line[line_code]` with `view = 'DIRECT'`.
- `fact_settlement_link[payment_txn_id]` and `[document_txn_id]` → `fact_txn`. These are label columns for the drill (Level 4 "linked documents").
- `fact_cash_posting[settled_txn_id]` and `[settled_ledger_seq]` → `fact_ledger_line[txn_id, ledger_seq]`: the document line a payment was looked through to.

## Columns

**dim_account:**
- Identity: `account_id`, `account_name`, `fully_qualified_name` (`Parent:Child`), `parent_account_id`, `account_level` (0 / 1).
- QBO type: `account_type` (the 15 QBO AccountType values), `account_subtype` (detail type), `classification`.
- Flags: `is_pl`, `is_cash` (Bank + Undeposited Funds), `is_bank`, `cash_kind` (BANK / UF / null).
- Sections: `default_section` is QBO's placement by account type (report spec 2.2): NET_INCOME, OPERATING, INVESTING, FINANCING, or CASH. Accumulated-depreciation sub-accounts are OPERATING. `override_section` and `override_line_label` hold the S01 override (null otherwise).
- Direct lines: `direct_line_in` and `direct_line_out` (default direct line by direction).
- Other: `sort_order` (QBO type order, parent before child), `active`, `current_balance` (debit positive at 2026-10-31; null for P&L accounts), `last_reconciled_date` (banks: 2026-09-30), `cash_floor` (banks).

**dim_cf_line:** `view`, `line_code`, `section_code` (OPERATING / INVESTING / FINANCING / TOTAL / MEMO), `line_label` (QBO labels in the indirect view), `line_kind` (section_header, subsection_header, data, account_rows, subtotal, section_total, grand_total, rollforward, memo), `sort_order`, `usual_direction` (IN / OUT / NET / BALANCE), `sign_rule` (CASH_IN_POSITIVE, BALANCE, NONE), `qbo_group` (the QBO API group, indirect view). The indirect view's account rows come from `dim_account`: one row per account in its section, nested by parent, which is how QBO shows them. The direct lines are those of report spec 6.2, plus three memo rows.

**dim_counterparty:** `counterparty_id`, `counterparty_kind` (Customer / Vendor / Employee / None), `counterparty_name`, `active` (the leaver is inactive), `created_date`.
**dim_class:** `class_id`, `class_name` (Consulting, Managed Services, Training, Overhead).
**dim_date:** `date`, `month_key`, `year`, `quarter`, `month_num`, `month_name`, `fiscal_year`, `is_month_end`, `is_working_day` (US federal holidays off), `is_actual` (within the span).

**map_account_line:** `map_id`, `account_id`, `view`, `direction` (ANY / IN / OUT), `section_code`, `line_code`, `line_label`, `effective_from`, `is_override`, `reason`, `author`, `created_at`.
- Each account has one INDIRECT default row and one or two DIRECT default rows, with author "QBO default".
- The S01 override adds three rows for the line of credit, effective from 2024-01-01: INDIRECT → FINANCING, DIRECT IN → D_FIN_PROCEEDS, DIRECT OUT → D_FIN_REPAID.
- Rule: use the override row when `effective_from` ≤ the transaction date.

**fact_txn:**
- Identity: `txn_id`, `txn_type` (QBO entity), `txn_date`, `month_key`, `doc_number`, `counterparty_id` (the transaction's own customer, vendor or payee; 0 when absent).
- Accounts and payment: `header_account_id` (deposit-to, paying or control account), `bank_account_id` (first bank account touched), `payment_type` (Purchase PaymentType or BillPayment PayType), `payment_method`.
- Amounts: `total_amount` (TotalAmt or Amount), `open_balance` (Balance for invoices, bills, credit memos and vendor credits), `cash_amount` (net movement of the cash set).
- Audit: `private_note`, `created_at`, `updated_at`, `sync_token`, `is_edited`.
- Generator metadata: `process_id` (P01–P14, OPENING), `chain_id` (first chain), `scenario_id`.
- Clearing: `cleared_status` (Reconciled / Cleared / Uncleared / NotApplicable), `cleared_date`.
- `qbo_link`: an "Open in QuickBooks" URL built from type and Id. The pattern is a guess (report spec 9.3 says it must be tested).

**fact_ledger_line:** `txn_id`, `ledger_seq`, `txn_date`, `month_key`, `txn_type`, `account_id`, `amount` (debit positive), `line_kind`, `line_seq`, `qbo_line_id` (the QBO `Line.Id`, where QBO gives one), `counterparty_id` (line entity, else the transaction's), `class_id`, `description`, `link_txn_id`, `link_txn_type` (the document a payment, bill-payment or deposit line settles or sweeps).
- `line_kind` is `header` (the transaction's own account), `line` or `tax`.
- `line_seq` is the position in `Line[]`; 0 for the header and −1 for tax.

**fact_cash_posting:**
- Keys: `posting_id`, `txn_id`, `txn_date`, `month_key`, `source_type`.
- Accounts: `cash_account_id`, `cash_kind` (BANK / UF), `offset_ledger_seq` (the offsetting ledger line), `posting_account_id` (that line's account), `offset_account_id` (the account that classifies the row after look-through).
- Look-through: `settled_txn_id`, `settled_ledger_seq`.
- Counterparty: `counterparty_id`, `counterparty_source` (HEADER, LINE, LINKED, CASH_LINE or NONE).
- `class_id`, `amount` (cash in +, out −), `is_internal_transfer` (both sides in the cash set).
- Lines: `direct_line_code` (overrides on), `default_direct_line_code` (overrides off, QBO behaviour).
- Bank-only view: `in_bank_view`, `bank_view_line_code`.
- Clearing: `cleared_status`, `cleared_date`.
- `is_journal_entry`, `memo` (note or first line description, truncated to 60 characters).
- Under QBO cash, the "Cash in / Cash out" columns of Level 3 are `amount > 0` and `amount < 0` with `is_internal_transfer = false`.

**fact_account_balance:** `account_id`, `month_key`, `month_end`, `opening_balance`, `net_change`, `closing_balance`.
- Balance-sheet accounts: cumulative since the file began.
- P&L accounts: fiscal year to date.
- Values are debit positive. The 2023-12 row holds the opening position, including all pre-span activity.

**fact_settlement_link:** `link_id`, `payment_txn_id`, `payment_txn_type` (Payment / BillPayment / Deposit), `payment_line_seq`, `document_txn_id`, `document_txn_type` (Invoice, CreditMemo, Bill, VendorCredit, Payment, SalesReceipt), `document_ledger_seq`, `document_account_id`, `applied_amount` (what the payment line applies to the document), `allocated_amount` (that amount split over the document's lines). Deposit rows link a swept payment and carry no document line.

**fact_noncash_item:** `txn_id`, `txn_date`, `month_key`, `section_code`, `indirect_amount`, `direct_amount`, `noncash_amount` (indirect − direct, overrides on), `noncash_amount_default` (overrides off). It holds one row per transaction and section with a gap. The rows of a transaction sum to 0 across sections.

**fact_exception:** `exception_id`, `exception_code`, `txn_id` (null for period-level ones), `account_id`, `month_key`, `amount`, `detail`, `is_routine`, `scenario_id`.

**ctl_qbo_cashflow:**
- Columns: `month_key`, `row_group` (QBO group: OperatingActivities, OperatingAdjustments, InvestingActivities, FinancingActivities, NetIncome, CashIncrease, BeginningCash, EndingCash), `row_label`, `account_id`, `row_kind` (Data / Summary), `amount`, `report_file`, `pulled_at`.
- Rows are matched by group and label, never by position (report spec 9.3).

**ctl_scenario:** `scenario_id`, `instance`, `period`, `txn_ids` (comma list), `checks`, `exception_codes`, `expected_json` (the oracle's expected outcome, keys sorted).

## QBO files (generator spec 10.1)

- **Entities:** 13 transaction types (Invoice 1,243, Payment 1,028, SalesReceipt 86, RefundReceipt 11, CreditMemo 22, Deposit 329, Bill 318, VendorCredit 11, BillPayment 314, Purchase 1,471, CreditCardPayment 34, Transfer 111, JournalEntry 150) and 10 list or settings entities (Account, Customer, Vendor, Employee, Class, Item, Term, PaymentMethod, CompanyInfo, Preferences).
- **Conventions (section 4.1):**
  - `domain` "QBO", `sparse` false.
  - `SyncToken` "0" at creation, +1 on every update. That covers the 6 % later edits, plus each settlement that changes an invoice's or bill's Balance.
  - `MetaData.CreateTime` is on or after `TxnDate` (median lag 2 days, catch-up batches, month-end journals keyed 3–6 days later), and `LastUpdatedTime` is never before it.
  - References are `{value, name}`. `LinkedTxn` sits on Payment and BillPayment lines, on Deposit lines (`TxnLineId` "0") and on the Invoice or Bill header (back links).
  - `TotalAmt` on every transaction (`Amount` on CreditCardPayment and Transfer, as QBO has it), `Balance` on invoices, bills, credit memos and vendor credits, `UnappliedAmt` on payments.
  - Sales forms share one number sequence from 1001, and cheques are numbered per bank account.
- **Envelopes:** `qbo/query/<Entity>.json` shows the query envelope (`QueryResponse.<Entity>[]`, `startPosition`, `maxResults`, `time`) with the first three objects. The full data is in the JSONL files.
- **Reports**, per six-month window (2024 H1, 2024 H2, 2025 H1, 2025 H2, 2026 H1, Jul–Oct 2026):
  - `CashFlow`, `ProfitAndLoss` and `BalanceSheet`, each `_Month` (one column per month, plus Total for CashFlow and ProfitAndLoss) and `_Total`;
  - `GeneralLedger` and `TransactionList`, `_Total` only.

  The CashFlow report applies QBO's default placement (no overrides). Accounts nest under their parent inside each section, empty data cells are `""`, summaries always carry a value, and sections are kept even when empty.
- **Field names are unconfirmed.** As the generator spec says (Sources, last bullet), entity and report field names come from working knowledge of the QBO API and still need checking against sandbox payloads. Specifically unconfirmed:
  - `CreditCardPayment.VendorRef`;
  - the `Entity` object on Deposit lines;
  - the GeneralLedger `is_cleared` (Clr) column and the TransactionList column keys;
  - detail types such as `PartnerDistributions`, `LineOfCredit` and `OtherMiscellaneousIncome`;
  - the sign of `Account.CurrentBalance` (normal-balance positive here);
  - the `qbo_link` URL pattern.

## Classification rules applied (report spec 7)

- **Cash set (7.1):** Bank accounts plus Undeposited Funds. A posting whose offset is also in the cash set is an internal transfer (memo row, nets to zero). That covers payroll funding, savings sweeps and Undeposited Funds sweeps.
- **Indirect view (7.2):** account type → section as in report spec 2.2. The one override is S01's, with its rows in `map_account_line` and on `dim_account`.
- **Direct view (7.3):** a cash posting is classified by the account on the other side of the entry. `map_account_line` (view DIRECT) holds the rule table of 7.3, including direction-dependent lines for fixed assets, other assets, long-term loans and equity. Rules applied:
  1. A multi-line transaction gets one row per offsetting line, at that line's amount.
  2. **Look-through.** A Payment or BillPayment line that settles a document is split over the document's lines (income and tax lines of an invoice; expense or asset lines of a bill) in proportion to their absolute amounts, in integer cents. The remainder goes to the largest fractional parts, ties to the earlier ledger line. An unapplied amount stays on A/R.
  3. Loan instalments are split when the Purchase carries a principal line and an interest line.
  4. Undeposited Funds: under QBO cash, the cash event is the payment on its own date, and the deposit that sweeps it is an internal transfer. Each deposit line carries its swept payment's customer.
  5. A journal entry touching cash is classified by its other lines and flagged.
  6. Counterparty, in this order (`counterparty_source`): the transaction's customer, vendor or payee (HEADER); the line entity (LINE); the linked payment's customer for sweeps (LINKED); the entity on the cash line (CASH_LINE, for example the payroll provider on the net-pay line); else 0 "(no name)" (NONE).
  7. Class comes from the offsetting line.
- **Bank-only view:** keep `in_bank_view = true` (Bank accounts only).
  - `bank_view_line_code` is the direct line. Rows that sweep Undeposited Funds become "Receipts from customers" on the deposit date, with the payer from the linked payment. Bank-to-bank transfers stay memo.
  - Closing cash in this view = Σ bank ledger balances (acceptance criterion in 12.2). The bank bridge = QBO cash − bank-only = the Undeposited Funds balance.
- **Cleared status:** each bank-side transaction clears after a type-dependent lag: cheques a median of 4 days, deposits 1–2, ACH 0–1, transfers and journals 0. Status is computed on the as-of day:
  - Reconciled: cleared on or before 2026-09-30, the last reconciled statement.
  - Cleared: cleared by 2026-11-05.
  - Uncleared: not cleared by then.
  - Undeposited Funds rows are NotApplicable.

## Control totals (`checks/control_totals_usd.csv`)

Columns: `period_key` (`M-2026-10`, `Y-2026`, `ALL`), `metric_code`, `scope`, `value` (USD, ratios unrounded to 1e-6).

| Metric | Scope | Definition |
| --- | --- | --- |
| M01 / M02 / M03 | ALL | Opening cash, closing cash, net change, QBO cash set (report spec 8.1) |
| M04, REVENUE | ALL | Accrual net income; Income-type accounts |
| M05 | account_id | Operating adjustment per non-cash balance-sheet account (−Δ debit balance) |
| M06 / M07 / M08 | QBO_DEFAULT, OVERRIDES_ON | Section totals, without and with the S01 override |
| M09 / M10 / M11 / M12 / M14 | ALL | Cash in, cash out, net direct, internal transfers, unclassified |
| M13 | section | Non-cash movements (= Σ `fact_noncash_item.noncash_amount`) |
| DIRECT_LINE, DIRECT_LINE_DEFAULT | line_code | Direct line totals, overrides on and off |
| M15 / M16 / M17 | ALL | Free cash flow (M06 with overrides + fixed-asset purchases and proceeds); cash conversion M06 ÷ M04; operating cash margin M06 ÷ revenue |
| M18 | ALL | Runway in months, monthly rows only, written only when the trailing 3-month average is an outflow |
| M19 | ALL | Receipts concentration: top 5 customers' share of receipts from customers |
| M20 | IN, OUT | Uncleared bank postings dated in the period (bank-to-bank transfers excluded) |
| M01_BANK / M02_BANK / M03_BANK, BANK_VIEW_LINE | ALL, line_code | The bank-only view |

## Checks (`checks/verify.py`, 74 checks)

| Group | What is asserted |
| --- | --- |
| Load | Every table's rows and Arrow types = manifest; QBO files' SHA-256 and sizes = `qbo/manifest.json`; entity counts; 48 report files |
| One source of truth | All 5,128 QBO transactions re-posted from the JSON with verify's own rules = `fact_ledger_line`, per transaction and account; `fact_txn` = QBO headers |
| I01–I11 | Balanced transactions; trial balance 0 and A = L + E at all 35 month ends (and every BalanceSheet column); A/R and A/P controls = open documents (and Customer / Vendor `Balance`); Balance = total − links, never negative; Undeposited Funds = unswept payments − the S06 direct credit; every reference and link resolves both ways; chronology along links, chains and MetaData; unique Ids, SyncToken 0 exactly when never updated; ledger = monthly net change; every bank account ≥ its floor every day |
| I09, C01–C05 | Every CashFlow column: sections sum to the increase, beginning + increase = ending; it ties to the ledger, to the BalanceSheet cash and to the P&L net income; QBO section totals = default mapping; the override moves only the line of credit and sums to 0 |
| C06–C10 | Direct = indirect each month; non-cash items recomputed per transaction = `fact_noncash_item`, and they explain every section gap; all 4,424 cash postings rebuilt independently (split, look-through, mapping); transfers net to 0; nothing unclassified |
| Bank-only view | Bank postings = change in bank balances each month |
| Exceptions | All 90 recomputed = `fact_exception` |
| I14 | Each scenario's expected outcome reproduced; every non-routine exception belongs to a scenario or to the documented natural list |
| Control totals | Every row of `control_totals_usd.csv` recomputed from the ledger (no missing or extra rows) |
| Story | Revenue, growth, concentration, card share, Undeposited Funds share; the line of credit in use |
| I13 | Byte-identical rerun of all 114 files |

**I12 is a structural shape check only.** Invariant I12 asks for JSON schemas captured from a real Intuit sandbox. There is no sandbox here, so verify checks common fields, required fields per entity, refs, line ids and the enumerations instead (deviation D-1).

## Headline (USD)

| Year | Revenue | Net income | Operating (QBO) | Investing | Financing (QBO) | Operating / financing (override on) | Opening cash | Closing cash | Bank only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2024 | 1,199,810.85 | 211,000.88 | 253,400.61 | −46,800.00 | −48,516.45 | 218,400.61 / −13,516.45 | 110,650.00 | 268,734.16 | 246,467.65 |
| 2025 | 1,308,857.60 | 269,257.71 | 197,725.75 | −9,500.00 | −157,841.02 | 232,725.75 / −192,841.02 | 268,734.16 | 299,118.89 | 297,657.51 |
| 2026 (Jan–Oct) | 1,268,033.25 | 193,818.52 | 267,022.87 | −28,400.00 | −222,612.30 | 202,022.87 / −157,612.30 | 299,118.89 | 315,129.46 | 301,079.46 |

**Story:**
- **Revenue:** consulting grows about 9 % into 2025; Q1 and summer are softer, and September–November is the high season.
- **Customers:** the top fifth bring about 69 % of receipts. 41 % of customer payments are cheques routed through Undeposited Funds.
- **Card:** the card carries about 31 % of non-payroll expenses and is settled on the 12th of each month.
- **Payroll and tax:** payroll runs every second Friday with federal deposits five days later and state taxes monthly. Sales tax is remitted quarterly.
- **Financing:** a $90k term loan is drawn on 2024-03-15. The line of credit is drawn 13 times around the quarterly owner draws and repaid 14 times. Its balance is $65k at 31 Oct 2026, and Operating Checking never ends a day below $25.8k.
- **Investing:** two capex purchases (S13's servers, then laptops in Feb 2026), one van sold in May 2025 at a gain, and one van bought on finance (S02).

## Scenarios ("typical" preset)

Each instance has a record in `qbo/expected/scenarios.jsonl` and `ctl_scenario` and is tagged `fact_txn.scenario_id`.

| Id | Planted | Transactions | Where it lands |
| --- | --- | --- | --- |
| S01 | Line of credit typed Other Current Liability (P12) | 27 draws (Deposit) and repayments (Purchase), 2024-01 … 2026-10; account 20 | QBO default: operating adjustments (C04 ties). Override rows move it to financing in both views: $615k gross over 21 months, sum across sections 0 (C05), net change untouched. Direct: Loan proceeds / Loan principal repaid |
| S02 | Service van bought on finance, 2025-05-12, $41,500 | JournalEntry 2493 | Indirect: investing −41,500 and financing +41,500 in May 2025; direct: nothing; listed in `fact_noncash_item`; exception NONCASH_CROSS_SECTION |
| S03 | Branch withdrawal booked by journal to Operating Checking, 2025-11-14 | JournalEntry 3422 | Split by its other lines: Owner draws −1,200.00, Other operating payments −50.00; exception JE_CASH (not routine) |
| S04 | Term-loan instalment posted whole, 2025-08-15 | Purchase 2968 | All −1,792.74 in Loan principal repaid; $417.39 of interest hidden; exception LOAN_WHOLE |
| S06 | Undeposited Funds left stale; one receipt deposited again to income; one cheque deposited (coded to Undeposited Funds) before its payment was entered | Payments 4617, 4701, 4687, 4085; Deposits 4706 (to income, $6,470) and 4035 (to UF, 2026-03-31) | Four UF_STALE exceptions ($17,430); UF_NEGATIVE at 2026-03 (−3,380.00); bank bridge holds $14,050.00 at 2026-10-31; income overstated by $6,470 |
| S07 | The same $2,340 cheque deposit entered twice, 2026-02-09 and 02-11 | Deposits 3806, 3814 | DUP_DEPOSIT on 3814, and on nothing else |
| S08 | Cash with no counterparty | Purchase 1362 (2024-09-17, $186.40), Deposit 2253 (2025-03-21, $640 refund) | Listed under "(no name)"; NO_NAME on both, and on nothing else |
| S13 | One bill payment for the June support bill and the equipment bill, 2024-07-02 | BillPayment 977 (bills 832 and 876) | Look-through: Payments to suppliers −1,850.00, Purchase of fixed assets −46,800.00. The bill itself is a non-cash cross-section item (June) |
| S18 | Two cheques and one deposit never clear | BillPayments 4758 (2026-08-20), 5049 (2026-10-15); Deposit 5099 (2026-10-28) | Uncleared at the as-of date; M20 Aug 2026 OUT −1,970.00; Oct 2026 IN 11,340.85, OUT −4,441.37 (incl. one natural float cheque) |

**Exceptions (90):**
- **Planted:** 12 (S02 1, S03 1, S04 1, S06 5 incl. UF_NEGATIVE, S07 1, S08 2, S13 1).
- **Routine:** 74 JE_CASH on the payroll journals. Rule 7.3.5 flags every journal touching cash, so payroll is flagged too, with `is_routine = true`.
- **Natural:** 4:
  - NONCASH_CROSS_SECTION on the van disposal journal (P10: the gain sits in operating, the cost in investing);
  - BANK_UNRECONCILED for the three bank accounts (reconciled through 2026-09-30, the period ends 2026-10-31).
- **Not raised:** DEPR_NO_CONTRA (S05 is off) and "changed after close" (S10 needs incremental mode).

## Determinism

- Every component draws from its own `numpy` stream, seeded from the base seed and the stream's name (`[42, crc32(name)]`). Adding a component therefore does not reshuffle the others.
- Integer cents are used throughout, with largest-remainder allocations. No wall-clock time reaches the files; all times derive from the as-of date.
- `verify.py` reruns the generator into a temporary folder and byte-compares all 114 outputs: 15 Parquet files, two manifests, 96 QBO files and the control totals.
- The claim holds for the pinned `requirements.txt` on CPython 3.12.

## Deviations from the specs

- **D-1 I12** is structural only, and entity and report field names are unconfirmed (see "QBO files"). The sandbox calibration (generator spec 10.4) is out per ADR-0019.
- **D-2 Reports.** Five points:
  - GeneralLedger and TransactionList are written as `_Total` only (they are lists, not period columns).
  - TrialBalance is not written; `fact_account_balance` carries the same balances.
  - The sibling-row shuffle switch and the oversized-request failure are not built (they belong to the mock API, which is out).
  - Row order is deterministic, so a loader must still match rows by group and label.
  - Query envelopes are samples of three objects; the full data is in the JSONL files.
- **D-3 Line of credit as Deposit / Purchase**, not Transfer. Draws are Deposits with a line to the credit-line account, and repayments are Purchases. This lets them carry the bank as counterparty (a QBO Transfer has no name) and avoids the unconfirmed question of whether QBO allows a Transfer to an Other Current Liability account.
- **D-4 Cash constraint:** the simulator draws on the line of credit and never delays supplier payments. Owner draws stay fixed; excess cash goes to savings at quarter end.
- **D-5 Undeposited Funds share 0.4** is met on payment counts: cheque payers are assigned until they hold about 40 % of invoices. All card-paid workshop sales receipts also pass through Undeposited Funds (merchant batches).
- **D-6 Duplicate-deposit rule** applies only to deposits with an unlinked line. An Undeposited Funds sweep links each payment once and cannot double count. Without this refinement, three natural single-receipt sweeps of the same seat price were flagged.
- **D-7 "Loan payment posted whole"** applies to Long Term Liability accounts only. Line-of-credit repayments are principal by nature; their interest is a separate monthly charge.
- **D-8 Counterparty fallback:** the "cash line entity" step (CASH_LINE) sits before "no name", so the payroll journal's liability lines resolve to the payroll provider and not to an exception.
- **D-9 Sales tax in the direct view.** The rule table maps tax liability accounts to "Taxes paid". Settlement look-through therefore puts the tax collected on training invoices into "Taxes paid" as an inflow, and the line shows collected net of remitted: −297 in 2024, −767 in 2025, −2,756 in 2026. *USER decision below.*
- **D-10 Payroll journals are flagged.** Rule 7.3.5 says "always flagged", so all 74 are flagged and marked `is_routine`.
- **D-11 Opening position.** The opening journal (2023-12-31, Retained Earnings as plug) holds cash, fixed assets, deposits, card, payroll and sales-tax liabilities and owner equity. Open A/R and A/P come from real Nov–Dec 2023 invoices and bills, so the January collections look through to income. `fact_cash_posting` starts on 2024-01-01. An opening owner contribution is also booked as a dated deposit on 2024-01-03 ($25k).
- **D-12 `fact_account_balance`** keeps P&L accounts fiscal year to date and balance-sheet accounts cumulative, all debit positive.
- **D-13 Realism within tolerance:** 2025 revenue is +9.1 % (12 % growth plus ±8 % monthly noise), and the top fifth of customers bring 69 % of receipts (target about 75 %).
- **D-14 Report spec 9.2 dim_cf_line** holds the indirect view's structural rows; its per-account rows come from `dim_account` (QBO shows one row per account).
- **D-15 Payment lines carry no `Id`** (the QBO shape). `fact_ledger_line.line_seq` gives their position. Credit memos are applied through Payment lines, as QBO does.

## Not in the data

- Generator spec 10.2 (mock API), 10.3 (incremental mode, so no S10 / S17 and no CDC stubs) and 10.4 (sandbox loader): out per ADR-0019.
- Locations, multicurrency, inventory, per-paycheck payroll (the Payroll API) and budgets.
- Scenarios S05, S09, S11, S12, S14, S15, S16, S19 and S20 (not in the "typical" preset).
- The open questions of report spec 12.3 keep the spec's defaults: Undeposited Funds counts as cash, ledger-level payroll, classes used consistently.

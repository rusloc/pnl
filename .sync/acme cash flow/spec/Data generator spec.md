# Data generator engine — spec

Nov 25, 2026 · @KIRILL

## 1. Purpose and fidelity

The engine produces a complete, internally consistent synthetic company in the shape the QuickBooks Online Accounting API returns it, so the cash flow report can be built, tested and demonstrated without a client's books.

It simulates a business over time, emits the QBO transactions that business would record, posts them to a ledger, and derives the QBO reports from that ledger. Nothing is generated twice: every report figure is computed from the same transactions the report under test will read.

**What "mimics QBO" means here**

| Level | The generator matches | Why the report needs it |
| --- | --- | --- |
| Shape | Entity names, field names, nesting, reference objects, response envelopes of the QBO API | The report's loader runs unchanged against generated or real data |
| Links | The relations between transactions: a payment to its invoices, a deposit to its payments, a bill payment to its bills | Drill path and settlement look-through (report spec 7.3) |
| Accounting | Double entry per transaction type, and the account-type logic of QBO's Statement of Cash Flows | Tie-out checks C01 to C10 have something true to tie to |
| Behaviour | Pagination, change tracking, deletions, late edits | Refresh and reopen-period logic can be tested |

**Out of scope**

- Writing to a production QBO company. Loading into an Intuit sandbox company is an optional mode (section 10).
- Inventory quantity tracking, sales tax engines, payroll calculations and multicurrency revaluation. Each appears only as the ledger postings it leaves behind.
- Entities the cash flow report never reads: estimates, purchase orders, time activities, attachments, budgets.

## 2. Architecture

The engine is a one-way pipeline with a single source of truth: the emitted QBO transactions. The ledger, every report and every output mode are computed from them, and nothing downstream may add or alter a transaction.

&#91;embedded content: generator pipeline · 8 stages and the optional sandbox calibration loop\]

The dashed box is the only part outside the engine: an optional round trip through a real QBO sandbox that checks the engine's reports against Intuit's own.

| Component | Responsibility | Produces |
| --- | --- | --- |
| Config and seed | Validate the configuration; create the random streams, one per component so adding a feature does not reshuffle the rest | Run context |
| Company builder | Chart of accounts from the profile template; customers, vendors, employees, items, classes; opening position | List entities |
| Event simulator | Run the business processes day by day under the cash constraint; apply scenarios | Business events with causal chains |
| QBO emitter | Turn each event into QBO transactions with Ids, references, links, sync tokens and metadata | Transaction entities |
| Ledger poster | Apply the posting rule for each transaction type | Balanced ledger lines |
| Report builder | Compute balances and assemble QBO report objects | Report payloads |
| Validator | Run invariants and schema checks; stop the run on any breach | Pass or fail, with a findings list |
| Writers | Serialise to files, serve the mock API, drive increments, load a sandbox | Deliverables and manifest |

## 3. Configuration inputs

One configuration file fully determines a dataset: the same file, seed and engine version must reproduce the output byte for byte. Defaults below are proposals to tune.

| Group | Parameter | Values | Default |
| --- | --- | --- | --- |
| Run | `seed` | Integer | 42 |
| Run | `start_date`, `end_date` | Dates | Three fiscal years ending last month end |
| Run | `as_of` | Timestamp used as "now" for metadata | End date + 5 days |
| Company | `profile` | services, retail, wholesale, agency, construction | services |
| Company | `fiscal_year_start_month` | 1 to 12 | 1 |
| Company | `home_currency` | ISO code | USD |
| Company | `features` | classes, locations, account numbers: on or off | classes on, others off |
| Scale | `size` | S, M, L or explicit counts of customers, vendors, monthly invoices and bills | S |
| Cash | `bank_accounts` | 1 to 5 checking and savings accounts, optional petty cash | 2 checking, 1 savings |
| Cash | `undeposited_funds_share` | Share of customer payments routed through Undeposited Funds | 0.4 |
| Cash | `credit_cards` | Count of card accounts and share of expenses paid by card | 1 card, 0.3 |
| Behaviour | `terms_mix`, `days_late` | Payment terms and lateness distribution, customers and own payments separately | Section 8 |
| Financing | `loans[]` | Principal, rate, term, start date, account type | One term loan in year 1 |
| Financing | `line_of_credit` | Limit, draw and repay rules, account type | Off |
| Investing | `capex[]` | Asset purchases and disposals: date, amount, paid by cash, bill or loan | Two purchases, one disposal |
| Owner | `contributions[]`, `draws` | Dated contributions; monthly or quarterly draws | Opening contribution, quarterly draws |
| Scenarios | `scenarios[]` | Scenario ids from section 7, each with count and period | All off (clean books) |
| Output | `modes[]` | files, mock\_api, incremental, sandbox | files |

**Presets.** Three ready configurations ship with the engine: *clean* (no scenarios; every report check passes), *typical* (a realistic sprinkle of bookkeeping flaws), and *torture* (every scenario on, at least once per quarter).

## 4. Output contract

The generator emits the same JSON a client receives from the QBO Accounting API: entity objects inside query envelopes, plus report objects. A loader written against this output must work against a real company without change.

### 4.1 Conventions on every entity

| Field | Rule |
| --- | --- |
| `Id` | Numeric string, unique per company. Transactions draw from one shared sequence; customers, vendors and employees share another (observed QBO behaviour; confirm in calibration) |
| `SyncToken` | String counter, `"0"` at creation, +1 on every modification |
| `MetaData` | `CreateTime` and `LastUpdatedTime`, ISO 8601 with offset. Create time falls on or after the transaction date, by a configurable bookkeeping lag |
| `domain`, `sparse` | `"QBO"`, `false` |
| References | Objects of `value` (the Id) and `name`, for example `CustomerRef`, `AccountRef`, `DepositToAccountRef` |
| Dates | `TxnDate`, `DueDate` as `YYYY-MM-DD` |
| Lines | `Line[]` with `Id`, `LineNum`, `Amount`, `Description`, `DetailType` and the matching detail object |
| Links | `LinkedTxn[]` of `TxnId` and `TxnType`, at header or line level as QBO places them ([Intuit: linked transactions](https://developer.intuit.com/app/developer/qbo/docs/workflows/manage-linked-transactions)) |
| Totals | `TotalAmt` on every transaction; `Balance` on invoices and bills; `UnappliedAmt` on payments |

### 4.2 Entities to generate

| Entity | Role | Fields that carry cash flow meaning |
| --- | --- | --- |
| CompanyInfo, Preferences | Settings | Fiscal year start, report basis, home currency, class and location tracking flags |
| Account | Chart of accounts | `AccountType`, `AccountSubType`, `Classification`, `ParentRef`, `SubAccount`, `FullyQualifiedName`, `Active`, `CurrentBalance` |
| Customer, Vendor, Employee | Counterparties | `DisplayName`, `Active`, `Balance` |
| Class, Department | Dimensions | `Name`, `ParentRef` |
| Item, PaymentMethod, Term | Supporting lists | Income and expense account refs on items; due days on terms |
| Invoice | Credit sale | `CustomerRef`, lines with item or account, `DueDate`, `Balance`, `LinkedTxn` to payments |
| Payment | Customer payment | `CustomerRef`, `DepositToAccountRef`, `PaymentMethodRef`, lines linked to invoices, `UnappliedAmt` |
| SalesReceipt, RefundReceipt, CreditMemo | Cash sale, refund, credit | `DepositToAccountRef`, lines |
| Deposit | Bank deposit | `DepositToAccountRef`; lines either linked to payments held in Undeposited Funds or direct lines with `DepositLineDetail.AccountRef` and entity |
| Bill, VendorCredit | Credit purchase | `VendorRef`, `APAccountRef`, account-based or item-based lines, `DueDate`, `Balance` |
| BillPayment | Supplier payment | `PayType` Check or CreditCard with `CheckPayment.BankAccountRef` or `CreditCardPayment.CCAccountRef`; lines linked to bills |
| Purchase | Expense, cheque or card charge | `PaymentType` Cash, Check or CreditCard; `AccountRef` (the paying account); `EntityRef`; lines; `Credit` flag for refunds |
| CreditCardPayment | Card settlement | `CreditCardAccountRef`, `BankAccountRef`, `Amount` |
| Transfer | Between own accounts | `FromAccountRef`, `ToAccountRef`, `Amount` |
| JournalEntry | Adjustments, payroll, depreciation | Lines with `PostingType` Debit or Credit, `AccountRef`, optional entity; `Adjustment` flag |

### 4.3 Account vocabulary

- `AccountType` takes exactly these values: Bank, Accounts Receivable, Other Current Asset, Fixed Asset, Other Asset, Accounts Payable, Credit Card, Other Current Liability, Long Term Liability, Equity, Income, Cost of Goods Sold, Expense, Other Income, Other Expense. ([type list](https://pkg.go.dev/github.com/hdcola/quickbooks-go))
- `Classification` is one of Asset, Liability, Equity, Revenue, Expense. ([CData reference](https://cdn.cdata.com/help/RNM/ado/pg_table-accounts.htm))
- `AccountSubType` (the detail type) must be valid for its type. The ones the report depends on: Checking, Savings, CashOnHand, UndepositedFunds, AccumulatedDepreciation, and the loan and equity detail types.
- The chart of accounts is built from a profile template of 40 to 80 accounts with two levels of sub-accounts, so nesting is exercised.

### 4.4 Envelopes

| Call | Shape to reproduce |
| --- | --- |
| Query | `QueryResponse` holding one array named after the entity, with `startPosition` and `maxResults`, plus a top-level `time`. At most 1,000 entities per page. ([Intuit: query operations](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries)) |
| Change data capture | `CDCResponse` holding `QueryResponse` arrays per entity with `startPosition`, `maxResults`, `totalCount`. A deleted entity appears as a stub with `status` Deleted, its `Id` and `MetaData.LastUpdatedTime`. ([Intuit: change data capture](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture)) |
| Report | `Header`, `Columns`, `Rows`, as specified in section 6.2 |

## 5. Business processes

The simulator does not invent transactions one by one; it runs fourteen business processes over a calendar, and each process emits its QBO transactions in order with the links between them. This is what makes the data behave like books rather than like random rows.

| # | Process | Emits, in order | Cash moves on | Report section |
| --- | --- | --- | --- | --- |
| P01 | Credit sale | Invoice → Payment (to bank or to Undeposited Funds) → Deposit when held | Payment, or Deposit under the bank-only cash view | Operating, receipts from customers |
| P02 | Cash sale | SalesReceipt → Deposit when held | SalesReceipt or Deposit | Operating |
| P03 | Customer credit and refund | CreditMemo; RefundReceipt | RefundReceipt | Operating, reduces receipts |
| P04 | Credit purchase | Bill → BillPayment by cheque or by card; VendorCredit | BillPayment by cheque | Operating, payments to suppliers |
| P05 | Direct expense | Purchase, type Cash or Check | Purchase | Operating |
| P06 | Card spending | Purchase, type CreditCard, through the month → CreditCardPayment | CreditCardPayment | Operating, credit card settlements |
| P07 | Payroll | JournalEntry per pay run: wages and employer taxes to expense, withholdings to liabilities, net pay from bank → remittance Purchase | Pay date; remittance date | Operating, payroll and taxes |
| P08 | Sales tax | Tax liability accrues on invoices → remittance Purchase | Remittance | Operating, taxes paid |
| P09 | Asset purchase | Bill or Purchase coded to a Fixed Asset account → monthly depreciation JournalEntry | Payment of the bill or the Purchase | Investing; depreciation is non-cash |
| P10 | Asset disposal | Deposit with a Fixed Asset line → JournalEntry for accumulated depreciation and gain or loss | Deposit | Investing |
| P11 | Term loan | Deposit of proceeds against a Long Term Liability account → monthly Purchase split into principal and interest | Proceeds; each instalment | Financing; interest in operating |
| P12 | Line of credit | Draws and repayments between bank and the credit line account | Each draw and repayment | Financing by nature; operating under QBO's default if typed as current |
| P13 | Owner activity | Deposit against an Equity account; Purchase against a draws account | Each | Financing |
| P14 | Internal moves and adjustments | Transfer between own bank accounts; period-end accrual and prepaid JournalEntries | Never, on net | Memo only |

**Process rules**

1. Each process instance carries one counterparty and one causal chain. The chain is kept as generator metadata so tests can ask "which payment settled this bill" and compare with what the report shows.
2. Later steps depend on earlier ones: a payment cannot predate its invoice, a deposit cannot predate the payments it sweeps, a card settlement follows the statement period it pays.
3. Partial and combined settlements are normal: one payment covering several invoices, several payments against one invoice, one deposit sweeping many payments.
4. Cash is a constraint, not an outcome. The simulator tracks the bank balance and delays supplier payments or draws on the credit line when cash runs low, as a real business would. A floor is configurable; overdrafts appear only if a scenario asks for them.

## 6. Posting rules and derived reports

Every emitted transaction is posted to an internal double-entry ledger by a fixed rule for its type, and all reports are computed from that ledger. This is the step that guarantees the generated statement and the generated transactions agree.

### 6.1 Posting rules

| Transaction | Debit | Credit | Hits cash |
| --- | --- | --- | --- |
| Invoice | Accounts Receivable | Income account of each line; tax liability | No |
| Payment | Deposit-to account (bank or Undeposited Funds) | Accounts Receivable | Yes |
| SalesReceipt | Deposit-to account | Income account of each line | Yes |
| CreditMemo | Income | Accounts Receivable | No |
| RefundReceipt | Income | Bank | Yes |
| Deposit, lines linked to payments | Bank | Undeposited Funds | Internal under QBO cash |
| Deposit, direct lines | Bank | Account on each line (loan, equity, asset, other income) | Yes |
| Bill | Expense, asset or COGS account of each line | Accounts Payable | No |
| VendorCredit | Accounts Payable | Account of each line | No |
| BillPayment, by cheque | Accounts Payable | Bank | Yes |
| BillPayment, by card | Accounts Payable | Credit Card account | No |
| Purchase, Cash or Check | Account of each line | Paying bank account | Yes |
| Purchase, CreditCard | Account of each line | Credit Card account | No |
| CreditCardPayment | Credit Card account | Bank | Yes |
| Transfer | To account | From account | Internal |
| JournalEntry | As posted on its lines | As posted on its lines | Only if a line names a cash account |

A Purchase with the `Credit` flag reverses its rule. Every transaction must balance to zero before it is written.

### 6.2 Reports derived from the ledger

| Report | Columns | Used by the report under test for |
| --- | --- | --- |
| `CashFlow` | Total, and by month | Control totals, checks C01, C02, C04 |
| `ProfitAndLoss` | Total, and by month, accrual | Net income check C03 |
| `BalanceSheet`, `TrialBalance` | Month ends | Opening and closing balances |
| `GeneralLedger` | Transaction lines with splits | Cash postings and drill levels |
| `TransactionList` | One row per transaction | Completeness counts |

**Report object rules**

- `Header` carries report name, basis, start and end period, currency, summarize-by setting and an options list including the no-data flag.
- `Columns` lists a title and type per column: one Account column, then Money columns.
- `Rows` nests sections. A section has a `group`, a `Header`, child `Rows` and a `Summary`; a data row has `ColData` cells with `value`, and `id` on the account cell.
- Cash flow groups and labels are those in the report spec, section 3. Accounts are placed by the account-type table in the report spec, section 2.2.
- Behaviours of the current reports service are reproduced: empty cells as `""`, sub-accounts nested under parents, sections kept even when empty, start and end period always present, and row order not guaranteed. A switch shuffles sibling rows to prove the loader does not depend on position. ([Intuit Developer](https://medium.com/intuitdev/upcoming-changes-to-reports-apis-5083ec9aadce))
- Requests wider than six months, or above the cell limit, can be made to fail the way the API does, to test the loader's date chunking. ([Intuit Developer](https://medium.com/intuitdev/quickbooks-online-reports-api-best-practices-and-troubleshooting-31edc9934b4c))

### 6.3 What the derived statement is, and is not

The generated `CashFlow` report is this engine's implementation of QBO's documented behaviour, not Intuit's code. It is exact with respect to the generated ledger, and only as faithful to QBO as the rules in the report spec. The sandbox calibration in section 10 measures that gap on real QBO output.

## 7. Scenario library

Clean books prove the report adds up; flawed books prove it catches what it claims to catch. Each scenario plants one specific bookkeeping situation and records what the report should do with it.

| ID | Scenario | What is generated | Exercises in the report spec | Expected in the report |
| --- | --- | --- | --- | --- |
| S01 | Credit line typed as current liability | P12 with the account as Other Current Liability | Gap G2, mapping 7.2, check C05 | Sits in operating by default; an override moves it to financing with net change untouched |
| S02 | Asset bought on finance | JournalEntry: debit Fixed Asset, credit loan; no cash | Gap G5, measure M13, check C07 | Indirect view shows an investing outflow and a financing inflow; direct view shows nothing; listed as non-cash |
| S03 | Journal entry to a bank account | JournalEntry with a bank line against expense or equity | Exceptions 10.2 | Classified by its other lines and flagged |
| S04 | Loan payment posted whole | P11 instalment with a single line to the loan account | Gap G8, rule 7.3.3 | Flagged; all of it lands in financing |
| S05 | Depreciation without a contra account | Depreciation credited straight to the asset account | Gap G7 | Flagged; shows as an investing inflow until overridden |
| S06 | Stale and negative Undeposited Funds | Payments never deposited; a deposit also booked directly to income | Gap G6, bank bridge | Bank bridge shows the held amount; both exceptions raised |
| S07 | Duplicate deposit | Same amount, same account, within three days | Exceptions 10.2 | Flagged as possible duplicate |
| S08 | Cash with no counterparty | Purchase and Deposit lines with no entity | Rule 7.3.6 | Listed under "no name" and flagged |
| S09 | Transfer booked as expense and income | Outflow from one own account coded to expense; matching inflow to another coded to income | Measures M09, M10 | Inflates cash in and out equally; candidate for a new exception type |
| S10 | Edit after close | A transaction in a signed-off month is modified or deleted later | Sign-off 10.3 | Period reopens visibly; no silent restatement |
| S11 | Prepayment before invoice | Payment dated ahead of the invoice it settles | Time rules 8.4 | Timing difference against QBO listed per month |
| S12 | One cheque, three sections | Purchase with expense, asset and loan lines | Rule 7.3.1 | Split across operating, investing and financing |
| S13 | Bill payment covering an equipment bill | BillPayment linked to an expense bill and a fixed-asset bill | Rule 7.3.2 | Allocated between payments to suppliers and investing |
| S14 | Refunds both ways | RefundReceipt to a customer; Purchase with the credit flag from a vendor | Sign rule | Reduce receipts and payments respectively |
| S15 | Account outside the mapping | An account added mid-year with no mapping row | Check C10, measure M14 | Lands in unclassified; sign-off blocked |
| S16 | Mixed-class payment | Lines with different classes on one payment | Rule 7.3.7 | Split by class in filtered views |
| S17 | Account retyped | An account's type changes in a later increment | Controls 10.1 | History restates in QBO-style reports; stored periods detect the change |
| S18 | Uncleared items at period end | Cheques and deposits not cleared in the ledger reports | Measure M20 | Counted as uncleared cash |
| S19 | Empty month | No transactions in one month | Empty states | Report shows a clean "no activity" state; no-data flag set |
| S20 | Inactive names and accounts | Counterparties and accounts made inactive after use | Loader robustness | History still resolves names |

**The oracle.** For every scenario instance the engine writes an expectation record: scenario id, the transaction ids involved, the period, and the expected outcome in machine-readable form (section amounts, the exception type, the check that should pass or fail). Report tests compare against these records instead of hand-computed figures.

## 8. Realism rules

The data must look like a real small business when charted: uneven months, a few large customers, payments that arrive late, and fixed costs that land on the same day each month. All values are configurable defaults, not facts about any company.

| Aspect | Rule | Default |
| --- | --- | --- |
| Revenue level | Annual revenue target by size, with a yearly growth rate | S: 1.2 million; M: 8 million; L: 40 million; growth 12% |
| Seasonality | Monthly weights per company profile, plus random noise | Profile curve, noise ±8% |
| Calendar | Business transactions on working days; recurring costs on fixed days of the month; month-end entries on the last day | On |
| Customer concentration | Revenue share follows a long-tail distribution | Top fifth of customers bring about 75% of revenue |
| Customer life cycle | New customers arrive, some stop buying | 15% new, 10% lost per year |
| Amounts | Skewed distribution per item around list prices; cents present | Log-normal |
| Payment terms | Mix of terms on invoices and bills | Net 15, 30, 45, 60 at 20, 50, 20, 10% |
| Lateness | Days past due with a long tail; a few chronic late payers; a small share never pays | Median 6 days late; 5% chronic; 0.5% written off |
| Own payment habit | Bills paid in weekly runs, stretched when cash is tight | Weekly run, 3 days before due |
| Cost structure | Cost of sales follows revenue with a lag; payroll steps with headcount; rent, software and utilities recur | By profile |
| Card spending | Many small purchases, settled monthly | 30% of non-payroll expenses |
| Numbering and memos | Sequential invoice numbers; cheque numbers per bank account; memos from templates, some blank | 15% blank memos |
| Bookkeeping lag | Create time trails the transaction date; catch-up days produce batches; some records are edited later | Median 2 days; 6% edited |
| Opening position | Either a new company funded by the owner, or an established one with an opening-balance journal entry the day before the start | Established |
| Names | Counterparties are invented and plainly fictional; no real companies or people | On |

## 9. Invariants and self-tests

The engine refuses to write a dataset that breaks any rule below, except where an enabled scenario breaks it on purpose and says so in its expectation record.

| ID | Invariant |
| --- | --- |
| I01 | Every transaction's debits equal its credits |
| I02 | The trial balance sums to zero at every month end; assets equal liabilities plus equity |
| I03 | The receivable control account equals open invoice balances less unapplied payments and credits; the payable account likewise |
| I04 | An invoice or bill balance equals its total less what is linked to it, and is never negative |
| I05 | Undeposited Funds equals payments received and not yet swept by a deposit |
| I06 | Every reference resolves to an existing entity; every link has both ends |
| I07 | Chronology holds along each process chain; last-updated time is never before create time |
| I08 | Ids are unique; sync tokens only rise |
| I09 | On the cash flow report, sections sum to the net increase; beginning plus increase equals ending; ending equals the balance sheet cash accounts; net income equals the P&L |
| I10 | General ledger lines per account sum to that account's balance change |
| I11 | Bank balances stay above the configured floor |
| I12 | Every entity validates against its JSON schema; schemas are taken from real sandbox payloads and versioned with the engine |
| I13 | A second run with the same configuration produces identical file hashes |
| I14 | Each enabled scenario exists in the output and breaks only the rule it targets; the clean preset breaks none |

## 10. Delivery modes

The same generated company can be delivered four ways, from a folder of files to a real QBO sandbox. Files come first; the others reuse them.

### 10.1 Files

| Path | Content |
| --- | --- |
| `entities/<Entity>.jsonl` | One QBO entity object per line, in Id order |
| `reports/<Report>/<period>_<columns>.json` | One QBO report object per file |
| `expected/scenarios.jsonl` | The oracle records of section 7 |
| `expected/chains.jsonl` | Process chains: which transactions belong to one business event |
| `flat/*.parquet` or `.csv` | Optional flattened lines for BI tools; a convenience, not the contract |
| `manifest.json` | Configuration, seed, engine version, counts per entity, file hashes |

### 10.2 Mock API

A local HTTP service that answers like the QBO Accounting API, so the report's loader is tested end to end.

- `GET /v3/company/{realmId}/query` with the subset of the query language a loader uses: select all or count, filters on Id, transaction date, last-updated time and active flag, ordering, start position and max results capped at 1,000.
- `GET /v3/company/{realmId}/{entity}/{id}` for single reads.
- `GET /v3/company/{realmId}/reports/{name}` with date range, date macro and summarize-by parameters.
- `GET /v3/company/{realmId}/cdc` with entity list and changed-since time.
- Bearer token required; an expired-token response can be forced.
- Fault switches: throttling at the published 500 requests a minute per company, server errors, oversized report refusal, slow responses. ([Intuit limits page](https://developer.intuit.com/app/developer/qbo/docs/learn/limits-and-throttles))

### 10.3 Incremental mode

Advancing the clock by a number of days produces what a live company would: new transactions, edits to a share of existing ones with raised sync tokens and update times, deletions returned as deleted stubs, and occasional changes inside closed periods. Reports are recomputed, and the change-capture endpoint answers from the change log. The look-back limit of QBO's change capture should be mirrored; Intuit documents 30 days, to be confirmed against current docs.

### 10.4 Sandbox loader and calibration

An optional mode pushes the generated lists and transactions into an Intuit sandbox company through the real API, in dependency order, and keeps a map from generated Ids to sandbox Ids. It then pulls the real `CashFlow`, `ProfitAndLoss` and `BalanceSheet` reports and compares them with the generated ones, section by section and month by month.

- The result is a calibration report: where the engine's reading of QBO's rules matches Intuit's own output and where it does not.
- Every mismatch becomes either a fix to the posting or mapping rules, or a documented difference.
- Known limits: the sandbox sets its own Ids and metadata times, payroll cannot be created through the Accounting API, and write calls count against rate limits.
- This mode needs an Intuit developer account and writes only to a sandbox company.

## 11. Acceptance criteria and open questions

The engine is done when the report cannot tell its output from a real company's, and when every flaw it plants is one the report is expected to find.

### 11.1 Acceptance criteria

- [ ] The clean preset passes invariants I01 to I14, and the report under test passes checks C01 to C10 against the generated control totals.
- [ ] The torture preset contains every scenario S01 to S20, each with an expectation record, and the report's behaviour matches each record.
- [ ] Two runs of the same configuration give identical file hashes.
- [ ] All entities validate against JSON schemas captured from real sandbox payloads.
- [ ] The report's loader runs against the mock API and against a real sandbox with only the base address and token changed.
- [ ] For the clean preset loaded into a sandbox, the generated cash flow statement equals the sandbox's own, per section and per month, or each difference is documented.
- [ ] After a clock advance that edits a closed month, the report reopens that period.
- [ ] A medium dataset (three years) generates in under one minute on a laptop.

### 11.2 Build order

1. Chart of accounts templates, master data and the ledger with posting rules (sections 4 and 6.1).
2. Processes P01, P04, P05 and P14, then the derived reports and invariants. This already feeds the report's top three levels.
3. Remaining processes, then the scenario library with its oracle.
4. Mock API, then incremental mode.
5. Sandbox loader and calibration.

### 11.3 Open questions

- [ ] **Language and runtime.** Python is the natural fit for the simulator and file output; confirm before the build.
- [ ] **Where the data lands.** Files only, the mock API, or loaded straight into the report's warehouse?
- [ ] **Calibration.** Is an Intuit developer account with a sandbox company available?
- [ ] **Profiles.** Which company profile is needed first, and does demo data need to resemble a particular industry?
- [ ] **Several companies.** One company per run, or a portfolio of realms for multi-client demos?
- [ ] **Multicurrency.** Home currency only, or foreign-currency customers and vendors as well?
- [ ] **Scale ceiling.** What is the largest dataset the report must be shown to handle?

### Sources

- [Intuit Developer: query operations and pagination](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries) (read from the search listing; the page itself does not load without a browser)
- [Intuit Developer: change data capture](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture) (search listing)
- [Intuit Developer: manage linked transactions](https://developer.intuit.com/app/developer/qbo/docs/workflows/manage-linked-transactions) (search listing)
- [Intuit Developer: upcoming changes to Reports APIs](https://medium.com/intuitdev/upcoming-changes-to-reports-apis-5083ec9aadce)
- [Intuit Developer: Reports API best practices](https://medium.com/intuitdev/quickbooks-online-reports-api-best-practices-and-troubleshooting-31edc9934b4c)
- [Account type values, quickbooks-go library](https://pkg.go.dev/github.com/hdcola/quickbooks-go) (search listing)
- [Account classification values, CData reference](https://cdn.cdata.com/help/RNM/ado/pg_table-accounts.htm) (search listing)
- Entity field names in section 4.2 come from working knowledge of the QBO API and are to be confirmed against sandbox payloads, which is what invariant I12 enforces.

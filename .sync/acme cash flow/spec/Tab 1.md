# Cash Flow Statement — Spec Sheet (QBO replacement)

Nov 25, 2026 · @KIRILL

## 1. Purpose and scope

This spec defines a cash flow report that replaces the QuickBooks Online (QBO) Statement of Cash Flows and lets a reader go from the net change in cash down to every individual payment behind it.

The report keeps QBO's numbers and section logic as its baseline, so the top level always ties to QBO. It then adds what QBO does not give: a direct view of receipts and payments, a drill path that ends at the transaction, and a layout built for reading.

**In scope**

- One company file in QBO as the only source of record.
- Both presentations of the same cash movement: indirect (QBO-compatible) and direct (receipts and payments).
- Five drill levels: headline, section, line, account or counterparty, transaction.
- Period comparison, trend, and reconciliation to QBO and to the bank balances.

**Out of scope**

- Cash forecasting and budgeting (the QBO Cash Flow Planner covers a different question).
- Changing bookkeeping in QBO. The report reads; it never writes back.
- Multi-entity consolidation and currency translation beyond what one QBO file holds.

**Reading of the brief.** The delivery tool is not fixed by the request, so requirements are written tool-neutral. Section 9 names the QBO data each one needs, which is enough to build it in Power BI, a web app, or a spreadsheet.

**Test data.** The engine that generates QBO-shaped data for this report is specified in Data generator spec.

## 2. QBO baseline: how QuickBooks Online builds the statement

QBO derives the statement from account balances, not from payments: it takes accrual net income and adds the period change of every non-cash balance sheet account, placed in a section by the account's type. Everything the replacement must match, and everything it must fix, follows from that.

### 2.1 Method and settings

| Aspect | What QBO does | Source |
| --- | --- | --- |
| Method | Indirect only. The calculation preference cannot be changed; Intuit's workaround is an Excel export or a manual template. | [Intuit Community, Oct 2023](https://quickbooks.intuit.com/learn-support/global/other-questions/can-i-do-the-cash-flow-in-both-ways-direct-and-indirect-methods/00/1326542) |
| Basis | Accrual. Net income is the accrual P&L result for the same dates. | [AIStatements](https://aistatements.com/blog/quickbooks-cash-flow-statement-indirect-method) |
| Section logic | Account type decides the section. There is no separate cash flow mapping. | [Intuit Community, Dec 2023](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-report/00/1356396) |
| Reclassification | Not available in QBO (it exists in QuickBooks Desktop as Classify Cash). The only lever is changing the account's type in the chart of accounts. | [Intuit Community, Jan 2023](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-classification/00/1200722) |
| Columns | One total column by default. Display columns by days, weeks, months or quarters, or by customer, vendor, class, location, product. | [Fit Small Business](https://fitsmallbusiness.com/statement-cash-flows-example-quickbooks-online/) |
| Filters | Customer, vendor, class, location, product or service. | [Fit Small Business](https://fitsmallbusiness.com/statement-cash-flows-example-quickbooks-online/) |
| Formatting | Number format, thousands, negative style, header and footer text, logo. Export to PDF or Excel. | [Fit Small Business](https://fitsmallbusiness.com/statement-cash-flows-example-quickbooks-online/) |

### 2.2 Account type to section

This is the default mapping the replacement reproduces. Rows marked *confirm* are standard QBO behaviour that the cited Intuit replies do not spell out; the build verifies them against the live file (section 10).

| QBO account type | Lands in | Basis |
| --- | --- | --- |
| Income, Cost of Goods Sold, Expense, Other Income, Other Expense | Net Income (first operating line) | By construction |
| Bank | Cash. No line of its own; forms opening and closing cash. | By construction |
| Undeposited Funds (an Other Current Asset) | Cash | [Community thread](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/undeposited-funds-and-statement-of-cash-flow/00/197164), [BankQBO](https://bankqbo.com/blog/quickbooks-statement-of-cash-flows); *confirm* |
| Accounts Receivable, Other Current Assets | Operating adjustments | [Intuit reply](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-report/00/1356396) |
| Accounts Payable, Credit Card, Other Current Liabilities | Operating adjustments | [Intuit reply](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-report/00/1356396) |
| Fixed Assets, accumulated depreciation accounts | Operating adjustments (the depreciation add-back) | [Intuit reply, May 2024](https://quickbooks.intuit.com/learn-support/en-us/account-management/one-of-five-property-s-principal-showing-on-statement-of-cash/00/1445862) |
| Fixed Assets, all other | Investing | [Intuit reply, May 2024](https://quickbooks.intuit.com/learn-support/en-us/account-management/one-of-five-property-s-principal-showing-on-statement-of-cash/00/1445862) |
| Other Assets | Investing | *confirm* |
| Long Term Liabilities, Equity | Financing | [Intuit reply](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-report/00/1356396) |

### 2.3 The same report over the API

The statement is available as `GET /v3/company/{realmId}/reports/CashFlow`.

- **Parameters:** `start_date`, `end_date` or `date_macro`; `summarize_column_by` (Total, Days, Week, Month, Quarter, Year, Customers, Vendors, Classes, Departments, Employees, ProductsAndServices); filters `customer`, `vendor`, `class`, `department`, `item`; `sort_order`. ([parameter list](https://www.withone.ai/knowledge/quickbooks/conn_mod_def%3A%3AGJ6McxRIPDU%3A%3Ax1WZXbZuQPStbDwCmlDDqA/md))
- **Response:** `Header`, `Columns`, and nested `Rows`. Each section row carries a `group`, a `Header`, child rows and a `Summary`.
- **Since 30 June 2026** all Reports API calls are served by the modernized reports service. Row order can change, empty values come back as `""`, child accounts always nest under the parent, and `qzurl` deep links are no longer supported. ([Intuit Developer, Mar 2026](https://medium.com/intuitdev/upcoming-changes-to-reports-apis-5083ec9aadce))
- **Limits:** 400,000 cells per response; Intuit advises date ranges of six months or less per call. ([Intuit Developer, Feb 2026](https://medium.com/intuitdev/quickbooks-online-reports-api-best-practices-and-troubleshooting-31edc9934b4c))

## 3. QBO layout reference

The QBO statement is a single indented column of account names with one amount each, in three sections, closed by a three-line cash roll-forward. The replacement's indirect view reproduces these rows in this order so the two can be laid side by side.

| # | Row as QBO labels it | Row kind | API group | What the number is |
| --- | --- | --- | --- | --- |
| 1 | Operating Activities | Section header | `OperatingActivities` |  |
| 2 | Net Income | Data | `NetIncome` | Accrual profit for the period; ties to the P&L |
| 3 | Adjustments to reconcile Net Income to Net Cash provided by operations | Sub-section header | `OperatingAdjustments` |  |
| 4 | One row per account (A/R, inventory, A/P, credit cards, accumulated depreciation, other current items) | Data, nested by parent account |  | Period change in the account balance, signed for its effect on cash |
| 5 | Total adjustments | Sub-total |  | Sum of row 4 |
| 6 | Net cash provided by operating activities | Section total |  | Rows 2 + 5 |
| 7 | Investing Activities | Section header | `InvestingActivities` |  |
| 8 | One row per fixed or other asset account | Data |  | Period change in the balance, sign reversed |
| 9 | Net cash provided by investing activities | Section total |  | Sum of row 8 |
| 10 | Financing Activities | Section header | `FinancingActivities` |  |
| 11 | One row per long-term liability or equity account | Data |  | Period change in the balance |
| 12 | Net cash provided by financing activities | Section total |  | Sum of row 11 |
| 13 | Net cash increase for period | Grand total | `CashIncrease` | Rows 6 + 9 + 12 |
| 14 | Cash at beginning of period | Roll-forward | `BeginningCash` | Opening balance of all cash accounts |
| 15 | Cash at end of period | Roll-forward | `EndingCash` | Rows 13 + 14; ties to the balance sheet |

Labels and group names are as exposed by the report API ([field list](https://windsor.ai/data-field/quickbooks/)). The modernized report service may change capitalization and row order, so the build matches rows by group and label, never by position.

Three things this layout never shows, whatever the settings: gross money in and money out, who was paid or who paid, and which bank account moved.

## 4. Where the QBO statement falls short

Every weakness below comes from the same root: the statement explains cash by balance changes and never looks at the payments themselves. Each gap names the part of this spec that closes it.

| # | Gap in QBO | What the reader loses | Closed by |
| --- | --- | --- | --- |
| G1 | Indirect method only | An owner cannot read "received from customers, paid to suppliers" anywhere. Users have asked Intuit for a direct view for years. ([thread](https://quickbooks.intuit.com/learn-support/global/other-questions/can-i-do-the-cash-flow-in-both-ways-direct-and-indirect-methods/00/1326542)) | 6.2 direct view |
| G2 | Section fixed by account type, no override | A line of credit typed Other Current Liability sits in operating; a lease liability typed long-term sits in financing. ([example](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/quickbooks-support-is-terrible-2-open-questions-on-chart-of/00/895971), [example](https://aistatements.com/quickbooks-cash-flow-statement)) | 7.2 mapping table |
| G3 | A line is a net balance change | Purchases and disposals of assets, or borrowings and repayments, collapse into one number. | 6.3 gross in and out per line |
| G4 | No counterparty | The statement cannot answer "who did the money go to". | 6.4, 6.5 |
| G5 | Non-cash entries read as cash | An asset bought on a loan shows as an investing outflow and a financing inflow though no money moved. Journal entries posted to a bank account count as cash. ([BankQBO](https://bankqbo.com/blog/quickbooks-statement-of-cash-flows)) | 7.3 rules, 8 measure M13, 10 exceptions |
| G6 | Undeposited Funds counted as cash | Closing cash on the statement differs from money in the bank, with no line explaining the gap. | 7.1 cash set, 6.1 bank bridge |
| G7 | Depreciation add-back depends on setup | It appears only when accumulated depreciation is its own account; otherwise operating cash is understated. ([AIStatements](https://aistatements.com/blog/quickbooks-cash-flow-statement-indirect-method)) | 10 exceptions |
| G8 | Loan payments booked whole | Interest hides inside principal, distorting operating and financing. ([AIStatements](https://aistatements.com/blog/quickbooks-cash-flow-statement-indirect-method)) | 7.3 split rule, 10 exceptions |
| G9 | No tie-out on the page | The reader has to open the balance sheet and P&L to trust the totals. | 6.1 status strip, 10 checks |
| G10 | Plain column of numbers | No trend, no bridge from opening to closing cash, no comparison beyond extra columns, no visual weight on what matters. | 6.1, 11 |
| G11 | Dashboard cash chart disagrees with the statement | The home page chart reads connected bank feeds, not the ledger, so two QBO screens give two answers. ([Intuit Community](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/why-does-my-cashflow-graphic-not-match-my-cash-flow-statement/00/716927)) | One source: the ledger |

## 5. Design principles and drill path

The report is one number, net change in cash, opened up five times until the reader is looking at a single payment. Six principles govern every screen.

1. **Tie first.** The top level equals QBO to the cent for the same dates. Any departure from QBO's sections is a named reclassification, shown as such.
2. **One movement, two readings.** The indirect view (why profit differs from cash) and the direct view (who paid and who was paid) describe the same net change and are one toggle apart.
3. **Every number opens.** No total is a dead end. A click on any amount shows the rows that make it, down to the transaction and its link back to QBO.
4. **Classification is data.** Which section and line an account or payment belongs to lives in a mapping table an accountant edits, not in report logic.
5. **Signs follow cash.** Money in is positive, money out is negative, on every level and in every chart.
6. **Quiet page.** One typeface, one accent colour, aligned figures. Colour marks meaning, never decoration.

The five levels and what each one answers:

&#91;embedded content: drill path · 5 levels from net change in cash to one payment\]

A reader never needs more than four clicks from the headline to a payment, and can stop at any level with a complete answer to that level's question.

## 6. Report layout spec

The report is one page that expands in place: a headline strip, the statement, and a detail panel that slides in for lines and transactions. Global controls sit above everything and apply to all levels.

**Global controls:** period (month, quarter, year, custom), comparison (prior period, same period last year, none), columns (total or by month), view (indirect or direct), cash definition (QBO cash or bank only), and filters for bank account, class, location, customer and vendor.

&#91;embedded content: page wireframe · controls, headline, statement, detail panel\]

The statement never leaves the screen: drilling opens the panel on the right, and the headline strip above keeps the totals in sight.

### 6.1 Level 0: headline strip

| Element | Content | Behaviour |
| --- | --- | --- |
| Cash roll-forward tiles | Opening cash, operating, investing, financing, net change, closing cash | Each tile shows value, change against the comparison period, and a 12-month sparkline. Click scrolls to its section. |
| Cash bridge | Waterfall from opening to closing cash through the three sections | Hover shows value and share of net change. Click opens the section. |
| Monthly rhythm | Bars for cash in and cash out by month, line for net | Trailing 12 months regardless of the selected period. |
| Bank bridge | Closing cash by bank account, then Undeposited Funds, then total | Explains the gap between statement cash and money in the bank (G6). |
| Status strip | "Tied to QBO" or the difference, data-as-of time, count of open exceptions, count of reclassifications | Click opens the reconciliation panel (section 10). |

### 6.2 Level 1: the statement

One table, two layouts on a toggle. Both end in the same three roll-forward rows as QBO (net cash increase, cash at beginning, cash at end).

**Indirect layout** reproduces section 3 row for row. Additions: a comparison column, a change column, a per-row sparkline, and a marker on any row moved by a mapping override.

**Direct layout** lists receipts and payments:

| Section | Lines |
| --- | --- |
| Operating | Receipts from customers; other operating receipts; payments to suppliers; payroll and contractor payments; taxes paid; interest paid; credit card settlements; other operating payments |
| Investing | Purchase of fixed assets; proceeds from asset sales; loans and deposits made; loans and deposits returned |
| Financing | Loan proceeds; loan principal repaid; owner contributions; owner draws and dividends |
| Memo rows | Internal transfers between own accounts (nets to zero); non-cash movements (reconciles direct to indirect by section); unclassified (must be zero to sign off) |

**Columns in both layouts:** line label, current period, comparison period, change, change %, share of section, trend. With columns by month: one column per month plus total.

### 6.3 Level 2: line detail

Opens beside the statement when a line is clicked.

- Gross cash in, gross cash out and net for the line, so netted items are visible (G3).
- Breakdown by account (indirect) or by counterparty (direct), sorted by absolute amount, top 10 plus "all others".
- Monthly bars for the line over the trailing 12 months.
- For an indirect working-capital line: opening balance, closing balance and change of the account, with the cash transactions that touched it.

### 6.4 Level 3: counterparty or account ledger

A transaction list scoped to one counterparty or account within the line.

| Column | Note |
| --- | --- |
| Date | Transaction date |
| Type and number | Payment, bill payment, expense, cheque, deposit, transfer, journal entry, refund; with document number |
| Counterparty | Customer, vendor or employee name |
| Bank account | The cash account that moved |
| Memo | First line, truncated |
| Cash in / Cash out | Two columns, never one signed column at this level |
| Status | Cleared, reconciled or uncleared |

Sortable on every column, searchable by text and amount, exportable. A running total row stays pinned and equals the Level 2 figure.

### 6.5 Level 4: the payment

One transaction, shown whole.

- **Header:** type, number, date, counterparty, bank account, payment method, amount, cleared status.
- **Split lines:** each offsetting account with its amount, class, location and description, and the cash flow line each split was assigned to.
- **Linked documents:** invoices settled by a customer payment, bills settled by a bill payment, the deposit that swept a payment out of Undeposited Funds.
- **Audit:** created and last modified times, and whether it changed after the period was closed.
- **Open in QuickBooks:** a link to the source transaction.

## 7. Classification rules

Three rule sets decide where every amount lands: what counts as cash, which section an account belongs to (indirect view), and which line a payment belongs to (direct view). All three are stored as editable mapping data with QBO's behaviour as the default.

### 7.1 The cash set

- **Default (QBO cash):** every account of type Bank plus Undeposited Funds. This is the setting that ties to QBO.
- **Bank only:** Bank-type accounts alone. Undeposited Funds then appears as an operating line, "receipts not yet deposited", and closing cash equals the sum of bank ledger balances.
- Each account carries an `is_cash` flag. Petty cash, clearing and payment-processor accounts follow their QBO account type unless flagged otherwise.
- A transfer between two cash-set accounts is an internal transfer and never reaches a section.

### 7.2 Indirect view: account to section

- The default is the account-type table in section 2.2.
- An override row moves one account to another section or line: account, target section, target line label, effective-from date, reason, author, timestamp.
- Overrides never change the net change in cash. The statement shows a "reclassified against QBO" marker on affected rows, and the reconciliation panel lists each override with its amount.
- Starter overrides to propose at setup: lines of credit and short-term loans to financing; accumulated depreciation booked inside the asset account to an operating add-back; owner or shareholder loan accounts typed as current to financing.

### 7.3 Direct view: payment to line

A cash transaction is any posting to a cash-set account. It is classified by the accounts on the other side of the entry.

| Other side of the entry | Direct line | Note |
| --- | --- | --- |
| Accounts Receivable, Income | Receipts from customers | Customer refunds reduce this line |
| Accounts Payable, COGS, Expense | Payments to suppliers | Split further by mapping: payroll, taxes, interest |
| Payroll liability and wage accounts | Payroll and contractor payments |  |
| Tax liability accounts | Taxes paid | Sales tax, VAT, income tax by mapping |
| Interest expense | Interest paid |  |
| Credit Card account | Credit card settlements | The card is a liability in QBO, so cash moves when the card is paid, not when it is charged |
| Fixed Assets, Other Assets | Investing lines | Purchase when cash out, proceeds when cash in |
| Long Term Liabilities, loan accounts | Loan proceeds or principal repaid |  |
| Equity | Owner contributions or draws |  |
| Another cash-set account | Internal transfer | Memo row only |
| Anything unmapped | Unclassified | Blocks sign-off until resolved |

**Handling rules**

1. **Multi-line transactions** are split: each offsetting line gets its own share of the cash amount and its own classification.
2. **Settlements look through.** A bill payment or customer payment is allocated across the lines of the bills or invoices it settles, so a payment for an equipment bill lands in investing, not in payments to suppliers. Where no link exists, it stays on the settlement line.
3. **Loan payments** are split into principal (financing) and interest (operating) when the transaction carries both lines. A payment posted whole to the loan account is flagged as an exception (G8).
4. **Undeposited Funds.** Under QBO cash, the cash event is the customer payment on its own date. Under bank only, the cash event is the deposit, and the linked payments supply the payer names.
5. **Journal entries** that touch a cash account are classified by their other lines and always flagged for review (G5).
6. **Counterparty** comes from the transaction's customer, vendor or employee; if absent, from the split line; if still absent, "no name", which is itself an exception.
7. **Dimensions.** Class and location come from the offsetting lines, since bank lines rarely carry them. A payment with mixed classes is split by line.
8. **Credit card look-through** is informational: Level 3 of a card settlement lists the card charges of the statement period, without counting them as cash.

## 8. Measures and calculations

Twenty measures cover the statement, the direct view and the health indicators. All are in the company's home currency and all follow the sign rule: cash in positive, cash out negative.

### 8.1 Core statement measures

| ID | Measure | Definition |
| --- | --- | --- |
| M01 | Opening cash | Sum of cash-set account balances at the close of the day before the period starts |
| M02 | Closing cash | Sum of cash-set account balances at the close of the period end date |
| M03 | Net change in cash | M02 − M01. Must equal M06 + M07 + M08 |
| M04 | Net income | Accrual profit for the period, same dates as the P&L |
| M05 | Operating adjustment, per account | Asset account: opening balance − closing balance. Liability or equity account: closing balance − opening balance |
| M06 | Net cash from operating activities | M04 + sum of M05 over operating accounts |
| M07 | Net cash from investing activities | Sum of M05 over investing accounts |
| M08 | Net cash from financing activities | Sum of M05 over financing accounts |

### 8.2 Direct view measures

| ID | Measure | Definition |
| --- | --- | --- |
| M09 | Cash in | Sum of positive postings to cash-set accounts, internal transfers excluded |
| M10 | Cash out | Sum of negative postings to cash-set accounts, internal transfers excluded |
| M11 | Net cash flow, direct | M09 + M10. Must equal M03 |
| M12 | Internal transfers | Postings between cash-set accounts. Must net to zero |
| M13 | Non-cash movements, per section | Indirect section total − direct section total. Sums to zero across the three sections; each item is listed |
| M14 | Unclassified cash | Cash postings with no direct line. Target zero |

### 8.3 Health indicators

| ID | Measure | Definition | Reads as |
| --- | --- | --- | --- |
| M15 | Free cash flow | M06 + net cash on fixed asset purchases and sales | Cash left after keeping the asset base |
| M16 | Cash conversion | M06 ÷ M04 | Below 1: profit is not turning into cash |
| M17 | Operating cash margin | M06 ÷ revenue | Cash earned per unit of sales |
| M18 | Runway, months | M02 ÷ average monthly net cash outflow over the trailing 3 months | Shown only when the trailing average is an outflow |
| M19 | Receipts concentration | Share of receipts from customers that comes from the top 5 customers | Dependence on few payers |
| M20 | Uncleared cash | Cash postings in the period not yet cleared or reconciled, in and out | How firm the closing figure is |

### 8.4 Comparison and time rules

- Change = current − comparison. Change % is blank when the comparison is zero or the two values differ in sign.
- Year to date runs from the fiscal year start in QBO's company preferences.
- Monthly columns use calendar months; a custom period that cuts a month shows a partial-month marker.
- Transactions are dated by transaction date. QBO's own reports can date a prepayment by its invoice date, so period totals are tied to QBO per month and any timing difference is listed, not absorbed. ([Intuit Developer](https://medium.com/intuitdev/quickbooks-online-reports-api-best-practices-and-troubleshooting-31edc9934b4c))

## 9. Data model and QBO data sources

The report needs four things from QBO: the official statement as a control total, the chart of accounts, account balances by period, and every cash transaction with its split lines. All are available read-only through the QuickBooks Online Accounting API.

### 9.1 What to pull

| Need | QBO source | Used for |
| --- | --- | --- |
| Control totals | `CashFlow` report, by month | Tie-out of every section and the roll-forward (section 10) |
| Net income check | `ProfitAndLoss` report, accrual, by month | M04 |
| Balances by account and month | `TrialBalance` or `BalanceSheet` report by month, or balances built from `GeneralLedger` | M01, M02, M05 |
| Chart of accounts | `Account` entity: type, detail type, parent, active flag | Sections 7.1, 7.2 |
| Cash transactions with splits | `GeneralLedger` or `TransactionListWithSplits` report filtered to cash-set accounts | Levels 2 to 4, section 7.3 |
| Transaction detail and links | Entities: Payment, SalesReceipt, RefundReceipt, Deposit, Purchase, BillPayment, Bill, Invoice, VendorCredit, Transfer, JournalEntry, CreditCardPayment | Level 4, settlement look-through |
| Counterparties and dimensions | Customer, Vendor, Employee, Class, Department | Filters, Level 3 |
| Company settings | `Preferences`, `CompanyInfo` | Fiscal year start, report basis, multicurrency, home currency |
| Changes | Change data capture endpoint; webhooks | Incremental refresh, late-change detection |

Payroll run through QuickBooks Payroll reaches the Accounting API only as ledger postings, not as individual paychecks, so payroll lines stop at Level 3 unless the separate Payroll API is added. ([AuditFriendly](https://auditfriendly.co/answers/quickbooks-payroll-data-via-api))

### 9.2 Tables

| Table | Grain | Key fields |
| --- | --- | --- |
| `fact_cash_posting` | One row per cash transaction per offsetting split line | transaction id, line id, date, cash account, offset account, counterparty, class, location, amount (signed), cleared status, direct line, is internal transfer, source type |
| `fact_account_balance` | Account × month end | account, month, closing balance |
| `fact_settlement_link` | Payment × settled document line | payment id, document id, document line, allocated amount |
| `dim_account` | Account | QBO type, detail type, parent, `is_cash`, default section, override section |
| `dim_cf_line` | Statement line | view (indirect or direct), section, line label, sort order, sign rule |
| `dim_counterparty` | Customer, vendor or employee | name, kind, active flag |
| `map_account_line` | Mapping and override rows | account, view, line, effective from, reason, author, timestamp |
| `ctl_qbo_cashflow` | Period × QBO row | group, label, amount as QBO reported it, pulled at |

### 9.3 Refresh and API limits

- Nightly refresh of the open period, plus change data capture during the day. Closed periods are frozen and re-read only when a change is detected.
- Reports are requested in windows of six months or less and stitched, to stay under the 400,000-cell response limit. ([Intuit Developer](https://medium.com/intuitdev/quickbooks-online-reports-api-best-practices-and-troubleshooting-31edc9934b4c))
- Report rows are parsed by group and label. Position is unreliable since the reports service changed on 30 June 2026. ([Intuit Developer](https://medium.com/intuitdev/upcoming-changes-to-reports-apis-5083ec9aadce))
- Throttle to the published limits: 500 requests a minute per company and 10 a second per company and app. ([Intuit limits page](https://developer.intuit.com/app/developer/qbo/docs/learn/limits-and-throttles))
- The "Open in QuickBooks" link is built from the transaction type and id, because the report API no longer returns deep links. The URL pattern is not documented by Intuit and must be tested per transaction type.
- Access is OAuth 2.0 with the accounting scope. The integration issues no write calls.

## 10. Reconciliation and controls

The report earns trust by proving, on every refresh, that it equals QBO at the top and equals its own transactions at the bottom. Ten checks run automatically; their results feed the status strip.

### 10.1 Checks

| ID | Check | Rule | Tolerance | On failure |
| --- | --- | --- | --- | --- |
| C01 | Net change ties to QBO | M03 = QBO net cash increase, per month and for the period | 0.00 | Status strip shows the difference; statement marked provisional |
| C02 | Closing cash ties to the balance sheet | M02 = sum of cash-set accounts on the QBO balance sheet at period end | 0.00 | Same |
| C03 | Net income ties to the P&L | M04 = QBO accrual net income | 0.00 | Same |
| C04 | Sections tie before overrides | Each section total, with overrides switched off, = QBO section total | 0.00 | Flags a wrong default mapping (the *confirm* rows in 2.2) |
| C05 | Overrides are neutral | Sum of override amounts across sections = 0 | 0.00 | Blocks publishing the override |
| C06 | Direct equals indirect | M11 = M03 | 0.00 | Lists cash postings missing from one side |
| C07 | Non-cash items explain section gaps | Sum of M13 = 0, and every item is a listed entry | 0.00 | Lists unexplained difference by section |
| C08 | Lines equal their transactions | Each direct line = sum of its Level 4 rows | 0.00 | Line marked; drill shows the gap |
| C09 | Transfers net to zero | M12 = 0 | 0.00 | Lists one-sided transfers |
| C10 | Nothing unclassified | M14 = 0 | Configurable, default 0.00 | Blocks sign-off, not viewing |

### 10.2 Exceptions list

A standing list of entries that distort a cash flow statement, each linked to its transaction:

- Journal entries posted to a cash account.
- Non-cash entries between non-cash accounts in different sections, such as an asset bought on finance.
- Loan payments posted whole, with no interest line.
- Fixed asset accounts with depreciation expense in the P&L but no accumulated depreciation movement.
- Undeposited Funds items older than a set number of days, and any negative Undeposited Funds balance.
- Cash postings with no counterparty.
- Possible duplicate deposits: same amount, same account, within three days.
- Transactions changed after their period was closed.
- Bank accounts not reconciled through the period end.

### 10.3 Sign-off

A period can be marked final when C01 to C10 pass. Marking it final stores the figures, the mapping version and the control totals. A later change in QBO reopens the period visibly instead of silently restating it.

## 11. Visual and UX spec

The page should read like a well-set financial statement first and a dashboard second: figures aligned, hierarchy carried by weight and indent, and colour reserved for direction and status.

### 11.1 Type and figures

| Element | Spec |
| --- | --- |
| Typeface | One sans-serif family with tabular lining figures, for both text and numbers |
| Sizes | Section headers 13 px semibold caps with letter-spacing; lines 14 px regular; section totals 14 px semibold; grand total and closing cash 16 px semibold |
| Figures | Right-aligned, tabular, thousands separator, no currency symbol in cells (currency stated once in the header) |
| Negatives | Parentheses, in the same ink as positives. Colour is not the only sign carrier |
| Zero and blank | An en dash for zero; empty for not applicable |
| Scale | Whole units by default; a toggle for thousands. Level 4 always shows cents |

### 11.2 Table structure

- Indent 16 px per hierarchy level. No vertical rules; a hairline above section totals and a double hairline above closing cash.
- Row height 32 px; 40 px for totals. Sticky header and sticky first column with monthly columns.
- Expand and collapse per section; state is remembered per user.
- Hover highlights the row and reveals the drill affordance; the whole amount cell is the click target.
- Rows moved by an override carry a small marker with the reason on hover.

### 11.3 Colour

| Use | Rule |
| --- | --- |
| Ink | One near-black for text and figures, one grey for secondary labels |
| Accent | A single brand hue for the selected row, active controls and the closing cash tile |
| Direction | One hue for cash in and one for cash out, used only in charts and the Level 3 in and out columns; distinguishable for colour-blind readers and paired with position or sign |
| Status | Green, amber, red for tie-out and exceptions only |
| Themes | Light and dark, both meeting 4.5:1 text contrast |

### 11.4 Charts

| Chart | Where | Rule |
| --- | --- | --- |
| Cash bridge (waterfall) | Level 0 | Opening and closing as full bars, sections as floating steps, labelled directly with values; no legend |
| Monthly in, out and net | Level 0 | In above zero and out below on a shared axis, net as a line; 12 months; current period shaded |
| Sparkline | Tiles and statement rows | 12 points, no axis, last point marked |
| Top counterparties | Level 2 | Horizontal bars sorted by amount, top 10 plus all others |

Every chart mark is clickable and opens the same detail as the matching table cell.

### 11.5 Interaction

- Drill opens a side panel, so the statement stays in view. A breadcrumb shows the path: section, line, counterparty, transaction.
- The URL carries period, view, filters and the open drill path, so any view can be shared as a link.
- Search across counterparties, memos, document numbers and amounts from any level.
- Keyboard: arrows move between rows, Enter drills, Escape steps back.
- Export: statement to PDF (print layout, A4 and Letter) and Excel; any Level 3 list to CSV with the applied filters named in the file.
- Empty and loading states name what is missing: no transactions in the period, refresh in progress, or period not yet tied.

## 12. Non-functional requirements, acceptance and open questions

The build is accepted when it ties to QBO for twelve consecutive months of a real file and every figure can be followed to its transactions.

### 12.1 Non-functional requirements

| Area | Requirement |
| --- | --- |
| Freshness | Data-as-of time on every page. Open period no older than 24 hours; on-demand refresh available |
| Speed | Levels 0 and 1 render in under 2 seconds; a drill to Level 3 or 4 in under 1 second from stored data |
| History | At least the current and two prior fiscal years |
| Access | Read-only connection to QBO. Viewer, accountant (edits mappings) and admin roles |
| Audit | Every mapping change logged with author, time, reason and the amount it moved |
| Currency | Home currency throughout. Level 4 also shows the transaction currency and rate where multicurrency is on |
| Accessibility | WCAG 2.1 AA: contrast, keyboard operation, table semantics for screen readers |
| Resilience | A failed refresh keeps the last good data and says so; it never shows a partial period as complete |

### 12.2 Acceptance criteria

- [ ] For each of 12 consecutive months, checks C01 to C04 pass against the live QBO statement.
- [ ] The indirect view, overrides off, matches a QBO export row for row for three sampled periods.
- [ ] Direct and indirect net change agree (C06) and every section difference is itemised (C07).
- [ ] From Level 0, a tester reaches any chosen payment in four clicks or fewer and opens it in QuickBooks.
- [ ] Twenty sampled payments match QBO on date, counterparty, bank account, amount and split lines.
- [ ] An override moves an amount between sections, leaves net change untouched, and appears in the reconciliation panel.
- [ ] Switching the cash definition to bank only makes closing cash equal the sum of bank ledger balances.
- [ ] Each exception type in 10.2 is raised by a seeded test transaction.
- [ ] PDF export of the statement fits one page for a single-period view and prints legibly in greyscale.

### 12.3 Open questions

- [ ] **Delivery tool.** Power BI, a web app or a spreadsheet? This decides how sections 9 and 11 are implemented, not what they require.
- [ ] **Default cash definition.** QBO cash (ties out of the box) or bank only (matches the bank)?
- [ ] **Undeposited Funds as cash.** Confirm on the target file with C02 and C04 before fixing the default.
- [ ] **QBO edition and region.** An Intuit UK reply mentions direct and indirect versions of the statement in Spreadsheet Sync; confirm what the target file's region offers. ([thread](https://quickbooks.intuit.com/learn-support/en-uk/reports-and-accounting/in-spreadsheet-sync-why-can-i-not-select-a-statement-of-cash/00/1584985))
- [ ] **Payroll depth.** Is ledger-level payroll enough, or is per-paycheck detail needed through the Payroll API?
- [ ] **Mapping owner.** Who approves overrides and signs off periods?
- [ ] **Classes and locations.** Are they used consistently enough to offer as filters on day one?
- [ ] **Starting history.** Which fiscal year is the first to be tied?

### Sources

- [Intuit Community: direct and indirect methods in QBO](https://quickbooks.intuit.com/learn-support/global/other-questions/can-i-do-the-cash-flow-in-both-ways-direct-and-indirect-methods/00/1326542)
- [Intuit Community: Statement of Cash Flows report and account type](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-report/00/1356396)
- [Intuit Community: fixed assets, depreciation and financing placement](https://quickbooks.intuit.com/learn-support/en-us/account-management/one-of-five-property-s-principal-showing-on-statement-of-cash/00/1445862)
- [Intuit Community: classification cannot be changed in QBO](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/statement-of-cash-flows-classification/00/1200722)
- [Intuit Community: Undeposited Funds and the statement](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/undeposited-funds-and-statement-of-cash-flow/00/197164)
- [Intuit Developer: Reports API best practices and troubleshooting](https://medium.com/intuitdev/quickbooks-online-reports-api-best-practices-and-troubleshooting-31edc9934b4c)
- [Intuit Developer: upcoming changes to Reports APIs](https://medium.com/intuitdev/upcoming-changes-to-reports-apis-5083ec9aadce)
- [Intuit Developer: API call limits and throttles](https://developer.intuit.com/app/developer/qbo/docs/learn/limits-and-throttles) (read from the search listing; the page itself did not load)
- [CashFlow report endpoint parameters, third-party reference](https://www.withone.ai/knowledge/quickbooks/conn_mod_def%3A%3AGJ6McxRIPDU%3A%3Ax1WZXbZuQPStbDwCmlDDqA/md)
- [CashFlow report field names and labels, third-party reference](https://windsor.ai/data-field/quickbooks/)
- [Fit Small Business: running the statement in QBO](https://fitsmallbusiness.com/statement-cash-flows-example-quickbooks-online/)
- [AIStatements: the indirect method in QuickBooks and common errors](https://aistatements.com/blog/quickbooks-cash-flow-statement-indirect-method)
- [BankQBO: QuickBooks statement of cash flows](https://bankqbo.com/blog/quickbooks-statement-of-cash-flows)
- [AuditFriendly: payroll data through the QBO API](https://auditfriendly.co/answers/quickbooks-payroll-data-via-api) (read from the search listing)

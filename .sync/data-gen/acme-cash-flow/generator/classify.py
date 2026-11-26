"""Classification data (report spec 2.2, 7.1-7.3): cash set, account -> section (indirect), account -> direct line,
the S01 override, and the statement line catalogue (dim_cf_line)."""
import datetime as dt

import config as C

PL = set(C.PL_TYPES)
OVERRIDE_FROM = dt.date(2024, 1, 1)
OVERRIDE_AT = dt.datetime(2024, 1, 8, 11, 20, 0)
OVERRIDE_AUTHOR = 'Casey Merriweather (accountant)'
OVERRIDE_REASON = 'Line of credit is financing by nature; QBO types it Other Current Liability (report spec 7.2 starter override)'

# view, line_code, section, label, kind, sort, usual direction, QBO group (indirect)
LINES = [
    ('INDIRECT', 'I_OPERATING', 'OPERATING', 'Operating Activities', 'section_header', 100, '', 'OperatingActivities'),
    ('INDIRECT', 'I_NET_INCOME', 'OPERATING', 'Net Income', 'data', 110, 'NET', 'NetIncome'),
    ('INDIRECT', 'I_ADJ', 'OPERATING', 'Adjustments to reconcile Net Income to Net Cash provided by operations:', 'subsection_header', 120, '',
     'OperatingAdjustments'),
    ('INDIRECT', 'I_ACCOUNT_OP', 'OPERATING', '(one row per account)', 'account_rows', 130, 'NET', ''),
    ('INDIRECT', 'I_TOTAL_ADJ', 'OPERATING', 'Total Adjustments to reconcile Net Income to Net Cash provided by operations:', 'subtotal', 140,
     'NET', 'OperatingAdjustments'),
    ('INDIRECT', 'I_NET_OPERATING', 'OPERATING', 'Net cash provided by operating activities', 'section_total', 150, 'NET', 'OperatingActivities'),
    ('INDIRECT', 'I_INVESTING', 'INVESTING', 'Investing Activities', 'section_header', 200, '', 'InvestingActivities'),
    ('INDIRECT', 'I_ACCOUNT_INV', 'INVESTING', '(one row per account)', 'account_rows', 210, 'NET', ''),
    ('INDIRECT', 'I_NET_INVESTING', 'INVESTING', 'Net cash provided by investing activities', 'section_total', 220, 'NET', 'InvestingActivities'),
    ('INDIRECT', 'I_FINANCING', 'FINANCING', 'Financing Activities', 'section_header', 300, '', 'FinancingActivities'),
    ('INDIRECT', 'I_ACCOUNT_FIN', 'FINANCING', '(one row per account)', 'account_rows', 310, 'NET', ''),
    ('INDIRECT', 'I_NET_FINANCING', 'FINANCING', 'Net cash provided by financing activities', 'section_total', 320, 'NET', 'FinancingActivities'),
    ('INDIRECT', 'I_CASH_INCREASE', 'TOTAL', 'Net cash increase for period', 'grand_total', 400, 'NET', 'CashIncrease'),
    ('INDIRECT', 'I_BEGIN_CASH', 'TOTAL', 'Cash at beginning of period', 'rollforward', 410, 'BALANCE', 'BeginningCash'),
    ('INDIRECT', 'I_END_CASH', 'TOTAL', 'Cash at end of period', 'rollforward', 420, 'BALANCE', 'EndingCash'),
    ('DIRECT', 'D_REC_CUST', 'OPERATING', 'Receipts from customers', 'data', 110, 'IN', ''),
    ('DIRECT', 'D_REC_OTHER', 'OPERATING', 'Other operating receipts', 'data', 120, 'IN', ''),
    ('DIRECT', 'D_PAY_SUPP', 'OPERATING', 'Payments to suppliers', 'data', 130, 'OUT', ''),
    ('DIRECT', 'D_PAY_PAYROLL', 'OPERATING', 'Payroll and contractor payments', 'data', 140, 'OUT', ''),
    ('DIRECT', 'D_PAY_TAX', 'OPERATING', 'Taxes paid', 'data', 150, 'OUT', ''),
    ('DIRECT', 'D_PAY_INT', 'OPERATING', 'Interest paid', 'data', 160, 'OUT', ''),
    ('DIRECT', 'D_PAY_CC', 'OPERATING', 'Credit card settlements', 'data', 170, 'OUT', ''),
    ('DIRECT', 'D_PAY_OTHER', 'OPERATING', 'Other operating payments', 'data', 180, 'OUT', ''),
    ('DIRECT', 'D_NET_OPERATING', 'OPERATING', 'Net cash from operating activities', 'section_total', 190, 'NET', ''),
    ('DIRECT', 'D_INV_PURCHASE', 'INVESTING', 'Purchase of fixed assets', 'data', 210, 'OUT', ''),
    ('DIRECT', 'D_INV_PROCEEDS', 'INVESTING', 'Proceeds from asset sales', 'data', 220, 'IN', ''),
    ('DIRECT', 'D_INV_LOANS_MADE', 'INVESTING', 'Loans and deposits made', 'data', 230, 'OUT', ''),
    ('DIRECT', 'D_INV_LOANS_RETURNED', 'INVESTING', 'Loans and deposits returned', 'data', 240, 'IN', ''),
    ('DIRECT', 'D_NET_INVESTING', 'INVESTING', 'Net cash from investing activities', 'section_total', 290, 'NET', ''),
    ('DIRECT', 'D_FIN_PROCEEDS', 'FINANCING', 'Loan proceeds', 'data', 310, 'IN', ''),
    ('DIRECT', 'D_FIN_REPAID', 'FINANCING', 'Loan principal repaid', 'data', 320, 'OUT', ''),
    ('DIRECT', 'D_FIN_CONTRIB', 'FINANCING', 'Owner contributions', 'data', 330, 'IN', ''),
    ('DIRECT', 'D_FIN_DRAWS', 'FINANCING', 'Owner draws and dividends', 'data', 340, 'OUT', ''),
    ('DIRECT', 'D_NET_FINANCING', 'FINANCING', 'Net cash from financing activities', 'section_total', 390, 'NET', ''),
    ('DIRECT', 'D_CASH_INCREASE', 'TOTAL', 'Net cash increase for period', 'grand_total', 400, 'NET', ''),
    ('DIRECT', 'D_BEGIN_CASH', 'TOTAL', 'Cash at beginning of period', 'rollforward', 410, 'BALANCE', ''),
    ('DIRECT', 'D_END_CASH', 'TOTAL', 'Cash at end of period', 'rollforward', 420, 'BALANCE', ''),
    ('DIRECT', 'D_MEMO_TRANSFER', 'MEMO', 'Internal transfers between own accounts', 'memo', 510, 'NET', ''),
    ('DIRECT', 'D_MEMO_NONCASH', 'MEMO', 'Non-cash movements (direct to indirect, by section)', 'memo', 520, 'NET', ''),
    ('DIRECT', 'D_MEMO_UNCLASS', 'MEMO', 'Unclassified', 'memo', 530, 'NET', ''),
]
LINE_SECTION = {l[1]: l[2] for l in LINES}


def is_cash(a, bank_only=False):
    return a['AccountType'] == 'Bank' or (not bank_only and a['AccountSubType'] == 'UndepositedFunds')


def default_section(a):
    """Indirect view, QBO behaviour (report spec 2.2)."""
    t, s = a['AccountType'], a['AccountSubType']
    if t in PL: return 'NET_INCOME'
    if is_cash(a): return 'CASH'
    if t in ('Accounts Receivable', 'Other Current Asset', 'Accounts Payable', 'Credit Card', 'Other Current Liability'): return 'OPERATING'
    if t == 'Fixed Asset': return 'OPERATING' if s == 'AccumulatedDepreciation' else 'INVESTING'
    if t == 'Other Asset': return 'INVESTING'
    if t in ('Long Term Liability', 'Equity'): return 'FINANCING'
    return 'UNCLASSIFIED'


def default_direct(a):
    """Direct view, rule table of report spec 7.3: {direction: line} with direction ANY / IN / OUT."""
    t, s = a['AccountType'], a['AccountSubType']
    if t == 'Bank' or s == 'UndepositedFunds': return {'ANY': 'D_MEMO_TRANSFER'}
    if t in ('Income', 'Accounts Receivable'): return {'ANY': 'D_REC_CUST'}
    if t == 'Other Income': return {'ANY': 'D_REC_OTHER'}
    if t in ('Expense', 'Cost of Goods Sold', 'Accounts Payable'):
        return {'ANY': {'PayrollExpenses': 'D_PAY_PAYROLL', 'InterestPaid': 'D_PAY_INT', 'TaxesPaid': 'D_PAY_TAX',
                        'BankCharges': 'D_PAY_OTHER'}.get(s, 'D_PAY_SUPP')}
    if t == 'Other Expense': return {'ANY': 'D_PAY_OTHER'}
    if t == 'Credit Card': return {'ANY': 'D_PAY_CC'}
    if t == 'Other Current Liability':
        if s == 'PayrollTaxPayable': return {'ANY': 'D_PAY_PAYROLL'}
        if s == 'SalesTaxPayable': return {'ANY': 'D_PAY_TAX'}
        if s == 'AccruedLiabilities': return {'ANY': 'D_PAY_SUPP'}
        return {'IN': 'D_REC_OTHER', 'OUT': 'D_PAY_OTHER'}          # QBO places current liabilities in operating
    if t == 'Other Current Asset': return {'ANY': 'D_PAY_SUPP'}
    if t == 'Fixed Asset': return {'IN': 'D_INV_PROCEEDS', 'OUT': 'D_INV_PURCHASE'}
    if t == 'Other Asset': return {'IN': 'D_INV_LOANS_RETURNED', 'OUT': 'D_INV_LOANS_MADE'}
    if t == 'Long Term Liability': return {'IN': 'D_FIN_PROCEEDS', 'OUT': 'D_FIN_REPAID'}
    if t == 'Equity': return {'IN': 'D_FIN_CONTRIB', 'OUT': 'D_FIN_DRAWS'}
    return {'ANY': 'D_MEMO_UNCLASS'}


def overrides(co):
    """S01: the line of credit moves to financing in both views, from the start of the data."""
    loc = co.acc['LOC']
    return {loc['Id']: dict(section='FINANCING', label='Line of credit', direct={'IN': 'D_FIN_PROCEEDS', 'OUT': 'D_FIN_REPAID'},
                            effective_from=OVERRIDE_FROM, reason=OVERRIDE_REASON, author=OVERRIDE_AUTHOR, created_at=OVERRIDE_AT)}


class Classifier:
    def __init__(self, co):
        self.co = co
        self.ov = overrides(co)

    def section(self, acct_id, date=None, use_overrides=True):
        o = self.ov.get(acct_id)
        if use_overrides and o and (date is None or date >= o['effective_from']): return o['section']
        return default_section(self.co.acc_by_id[acct_id])

    def direct(self, acct_id, amount, date, use_overrides=True):
        o = self.ov.get(acct_id)
        m = o['direct'] if (use_overrides and o and date >= o['effective_from']) else default_direct(self.co.acc_by_id[acct_id])
        return m.get('ANY') or m['IN' if amount > 0 else 'OUT']

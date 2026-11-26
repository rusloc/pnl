"""QBO report objects derived from the ledger (generator spec 6.2): Header / Columns / Rows with nested sections.
CashFlow uses QBO's default account-type placement (no overrides). Empty data cells are "", summaries always carry a value."""
import datetime as dt
from collections import defaultdict

import config as C
from util import mstr, iso, month_end
from classify import default_section, is_cash

WINDOWS = [(dt.date(2024, 1, 1), dt.date(2024, 6, 30)), (dt.date(2024, 7, 1), dt.date(2024, 12, 31)), (dt.date(2025, 1, 1), dt.date(2025, 6, 30)),
           (dt.date(2025, 7, 1), dt.date(2025, 12, 31)), (dt.date(2026, 1, 1), dt.date(2026, 6, 30)), (dt.date(2026, 7, 1), dt.date(2026, 10, 31))]


def mk(d): return f'{d.year}-{d.month:02d}'


def _months(a, b):
    out, y, m = [], a.year, a.month
    while (y, m) <= (b.year, b.month):
        out.append((dt.date(y, m, 1), month_end(y, m))); y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def header(name, a, b, by, basis=None):
    h = {'Time': iso(C.AS_OF), 'ReportName': name, 'DateMacro': '', 'StartPeriod': a.isoformat(), 'EndPeriod': b.isoformat(),
         'SummarizeColumnsBy': by, 'Currency': C.HOME_CURRENCY, 'Option': [{'Name': 'NoReportData', 'Value': 'false'}]}
    if basis: h['ReportBasis'] = basis
    return h


def money_columns(cols, total, by='Month'):
    out = [{'ColTitle': '', 'ColType': 'Account', 'MetaData': [{'Name': 'ColKey', 'Value': 'account'}]}]
    for a, b in cols:
        t = f'{a:%b %Y}' if by == 'Month' else 'Total'
        out.append({'ColTitle': t, 'ColType': 'Money', 'MetaData': [{'Name': 'StartDate', 'Value': a.isoformat()},
                                                                       {'Name': 'EndDate', 'Value': b.isoformat()}, {'Name': 'ColKey', 'Value': t}]})
    if total: out.append({'ColTitle': 'Total', 'ColType': 'Money', 'MetaData': [{'Name': 'ColKey', 'Value': 'total'}]})
    return {'Column': out}


class Builder:
    def __init__(self, R, D):
        self.co = R['co']; self.acc = self.co.acc_by_id
        self.chg = defaultdict(int)                 # (account_id str, month_key) -> net change
        for x in D['led']:
            k = mk(x['txn_date']) if x['txn_date'] >= dt.date(2023, 12, 1) else '2023-12'
            self.chg[(str(x['account_id']), k)] += x['amount']
        self.led = D['led']
        self.order = {a['Id']: (C.TYPE_ORDER.index(a['AccountType']), int(self.co.acc[a['parent']]['Id']) if a['parent'] else int(a['Id']),
                                1 if a['parent'] else 0, int(a['Id'])) for a in self.acc.values()}
        self.all_months = ['2023-12'] + [mk(a) for a, _ in _months(C.START, C.END)]

    def change(self, aid, a, b):
        return sum(self.chg.get((aid, mk(m0)), 0) for m0, _ in _months(a, b))

    def balance(self, aid, d):
        """Closing balance at month end d (debit positive); P&L accounts fiscal year to date."""
        acct = self.acc[aid]; key = mk(d)
        if acct['AccountType'] in C.PL_TYPES:
            return sum(v for m_ in self.all_months if m_.startswith(str(d.year)) and m_ <= key for v in [self.chg.get((aid, m_), 0)])
        return sum(self.chg.get((aid, m_), 0) for m_ in self.all_months if m_ <= key)

    def cols(self, a, b, by):
        return _months(a, b) if by == 'Month' else [(a, b)]

    # ---- nested account rows ---------------------------------------------------------------------------------------------
    def nest(self, items, ncol, keep_zero=False):
        """items: {account_id: [cents per column]} -> rows nested by parent; returns (rows, totals)."""
        rows, tot = [], [0] * ncol
        kids = defaultdict(list); tops = []
        for aid in sorted(items, key=lambda i: self.order[i]):
            p = self.acc[aid]['parent']
            if p: kids[self.co.acc[p]['Id']].append(aid)
            else: tops.append(aid)
        for pid in kids:
            if pid not in tops: tops.append(pid)
        for aid in sorted(tops, key=lambda i: self.order[i]):
            a = self.acc[aid]
            own = items.get(aid)
            if kids.get(aid):
                sub, st = [], [0] * ncol
                if own is not None: sub.append(self.data_row(a['Name'], aid, own)); st = [x + y for x, y in zip(st, own)]
                for c in kids[aid]:
                    sub.append(self.data_row(self.acc[c]['Name'], c, items[c])); st = [x + y for x, y in zip(st, items[c])]
                rows.append({'Header': {'ColData': [{'value': a['Name'], 'id': aid}] + [{'value': ''}] * ncol}, 'Rows': {'Row': sub},
                             'Summary': {'ColData': [{'value': f'Total {a["Name"]}'}] + [{'value': mstr(v)} for v in st]}, 'type': 'Section'})
                tot = [x + y for x, y in zip(tot, st)]
            elif own is not None:
                rows.append(self.data_row(a['Name'], aid, own)); tot = [x + y for x, y in zip(tot, own)]
        return rows, tot

    @staticmethod
    def data_row(label, aid, vals):
        return {'ColData': [{'value': label, 'id': aid}] + [{'value': mstr(v) if v else ''} for v in vals], 'type': 'Data'}

    @staticmethod
    def section(label, group, rows, tot, ncol, summary=None):
        s = {'Header': {'ColData': [{'value': label}] + [{'value': ''}] * ncol}, 'Rows': {'Row': rows}, 'type': 'Section', 'group': group}
        if summary is not None: s['Summary'] = {'ColData': [{'value': summary}] + [{'value': mstr(v)} for v in tot]}
        return s

    @staticmethod
    def total_row(label, group, vals):
        return {'Summary': {'ColData': [{'value': label}] + [{'value': mstr(v)} for v in vals]}, 'type': 'Section', 'group': group}

    # ---- CashFlow -----------------------------------------------------------------------------------------------------------
    def cashflow(self, a, b, by):
        cols = self.cols(a, b, by); total = by == 'Month'
        span = cols + ([(a, b)] if total else []); n = len(span)
        ni = [-sum(self.change(aid, x, y) for aid, ac in self.acc.items() if ac['AccountType'] in C.PL_TYPES) for x, y in span]
        sec = {'OPERATING': {}, 'INVESTING': {}, 'FINANCING': {}}
        for aid, ac in self.acc.items():
            s = default_section(ac)
            if s not in sec: continue
            v = [-self.change(aid, x, y) for x, y in span]
            if any(v): sec[s][aid] = v
        adj_rows, adj = self.nest(sec['OPERATING'], n)
        op = [x + y for x, y in zip(ni, adj)]
        inv_rows, inv = self.nest(sec['INVESTING'], n)
        fin_rows, fin = self.nest(sec['FINANCING'], n)
        cash = [aid for aid, ac in self.acc.items() if is_cash(ac)]
        beg = [sum(self.balance(aid, x - dt.timedelta(days=1)) for aid in cash) for x, _ in span]
        inc = [o + i + f for o, i, f in zip(op, inv, fin)]
        adj_sec = self.section('Adjustments to reconcile Net Income to Net Cash provided by operations:', 'OperatingAdjustments', adj_rows, adj, n,
                               'Total Adjustments to reconcile Net Income to Net Cash provided by operations:')
        rows = [self.section('OPERATING ACTIVITIES', 'OperatingActivities',
                             [{'ColData': [{'value': 'Net Income'}] + [{'value': mstr(v)} for v in ni], 'type': 'Data', 'group': 'NetIncome'}, adj_sec],
                             op, n, 'Net cash provided by operating activities'),
                self.section('INVESTING ACTIVITIES', 'InvestingActivities', inv_rows, inv, n, 'Net cash provided by investing activities'),
                self.section('FINANCING ACTIVITIES', 'FinancingActivities', fin_rows, fin, n, 'Net cash provided by financing activities'),
                self.total_row('NET CASH INCREASE FOR PERIOD', 'CashIncrease', inc),
                self.total_row('Cash at beginning of period', 'BeginningCash', beg),
                self.total_row('CASH AT END OF PERIOD', 'EndingCash', [x + y for x, y in zip(beg, inc)])]
        return {'Header': header('CashFlow', a, b, by), 'Columns': money_columns(cols, total, by), 'Rows': {'Row': rows}}

    # ---- ProfitAndLoss ------------------------------------------------------------------------------------------------------
    def profit_and_loss(self, a, b, by):
        cols = self.cols(a, b, by); total = by == 'Month'
        span = cols + ([(a, b)] if total else []); n = len(span)
        grp = {}
        for t, sign in (('Income', -1), ('Cost of Goods Sold', 1), ('Expense', 1), ('Other Income', -1), ('Other Expense', 1)):
            items = {}
            for aid, ac in self.acc.items():
                if ac['AccountType'] != t: continue
                v = [sign * self.change(aid, x, y) for x, y in span]
                if any(v): items[aid] = v
            grp[t] = self.nest(items, n)
        sub = lambda x, y: [p - q for p, q in zip(x, y)]
        gp = sub(grp['Income'][1], grp['Cost of Goods Sold'][1]); noi = sub(gp, grp['Expense'][1])
        noth = sub(grp['Other Income'][1], grp['Other Expense'][1]); ni = [p + q for p, q in zip(noi, noth)]
        rows = [self.section('Income', 'Income', *grp['Income'], n, 'Total Income'),
                self.section('Cost of Goods Sold', 'COGS', *grp['Cost of Goods Sold'], n, 'Total Cost of Goods Sold'),
                self.total_row('GROSS PROFIT', 'GrossProfit', gp),
                self.section('Expenses', 'Expenses', *grp['Expense'], n, 'Total Expenses'),
                self.total_row('NET OPERATING INCOME', 'NetOperatingIncome', noi),
                self.section('Other Income', 'OtherIncome', *grp['Other Income'], n, 'Total Other Income'),
                self.section('Other Expenses', 'OtherExpenses', *grp['Other Expense'], n, 'Total Other Expenses'),
                self.total_row('NET OTHER INCOME', 'NetOtherIncome', noth),
                self.total_row('NET INCOME', 'NetIncome', ni)]
        return {'Header': header('ProfitAndLoss', a, b, by, 'Accrual'), 'Columns': money_columns(cols, total, by), 'Rows': {'Row': rows}}

    # ---- BalanceSheet -------------------------------------------------------------------------------------------------------
    def balance_sheet(self, a, b, by):
        ends = [y for _, y in self.cols(a, b, by)] if by == 'Month' else [b]
        n = len(ends)
        cols = [(dt.date(e.year, e.month, 1), e) for e in ends] if by == 'Month' else [(a, b)]

        def items(types, sign, sub=None):
            out = {}
            for aid, ac in self.acc.items():
                if ac['AccountType'] not in types or (sub and not sub(ac)): continue
                v = [sign * self.balance(aid, e) for e in ends]
                if any(v): out[aid] = v
            return out
        S = lambda lab, g, it, summ: self.section(lab, g, *self.nest(it, n), n, summ)
        bank = items(['Bank'], 1); ar = items(['Accounts Receivable'], 1); oca = items(['Other Current Asset'], 1)
        fa = items(['Fixed Asset'], 1); oa = items(['Other Asset'], 1)
        ap = items(['Accounts Payable'], -1); cc = items(['Credit Card'], -1); ocl = items(['Other Current Liability'], -1)
        ltl = items(['Long Term Liability'], -1)
        eq = items(['Equity'], -1)
        re_id = self.co.acc['EQ_RE']['Id']
        prior = [-sum(self.chg.get((aid, m_), 0) for aid, ac in self.acc.items() if ac['AccountType'] in C.PL_TYPES
                      for m_ in self.all_months if m_ < f'{e.year}-01') for e in ends]
        ni = [-sum(self.balance(aid, e) for aid, ac in self.acc.items() if ac['AccountType'] in C.PL_TYPES) for e in ends]
        eq[re_id] = [x + y for x, y in zip(eq.get(re_id, [0] * n), prior)]
        tsum = lambda *xs: [sum(v) for v in zip(*xs)]
        tot = lambda it: tsum(*it.values()) if it else [0] * n
        cur_a = tsum(tot(bank), tot(ar), tot(oca)); assets = tsum(cur_a, tot(fa), tot(oa))
        cur_l = tsum(tot(ap), tot(cc), tot(ocl)); liab = tsum(cur_l, tot(ltl))
        eq_rows, eq_t = self.nest(eq, n)
        eq_rows.append({'ColData': [{'value': 'Net Income'}] + [{'value': mstr(v) if v else ''} for v in ni], 'type': 'Data'})
        eq_t = tsum(eq_t, ni)
        rows = [self.section('ASSETS', 'TotalAssets', [
                    self.section('Current Assets', 'CurrentAssets', [S('Bank Accounts', 'BankAccounts', bank, 'Total Bank Accounts'),
                                                                      S('Accounts Receivable', 'AR', ar, 'Total Accounts Receivable'),
                                                                      S('Other Current Assets', 'OtherCurrentAssets', oca, 'Total Other Current Assets')],
                                 cur_a, n, 'Total Current Assets'),
                    S('Fixed Assets', 'FixedAssets', fa, 'Total Fixed Assets'), S('Other Assets', 'OtherAssets', oa, 'Total Other Assets')],
                    assets, n, 'TOTAL ASSETS'),
                self.section('LIABILITIES AND EQUITY', 'TotalLiabilitiesAndEquity', [
                    self.section('Liabilities', 'Liabilities', [
                        self.section('Current Liabilities', 'CurrentLiabilities', [S('Accounts Payable', 'AP', ap, 'Total Accounts Payable'),
                                                                                   S('Credit Cards', 'CreditCards', cc, 'Total Credit Cards'),
                                                                                   S('Other Current Liabilities', 'OtherCurrentLiabilities', ocl,
                                                                                     'Total Other Current Liabilities')], cur_l, n, 'Total Current Liabilities'),
                        S('Long-Term Liabilities', 'LongTermLiabilities', ltl, 'Total Long-Term Liabilities')], liab, n, 'Total Liabilities'),
                    self.section('Equity', 'Equity', eq_rows, eq_t, n, 'Total Equity')], tsum(liab, eq_t), n, 'TOTAL LIABILITIES AND EQUITY')]
        return {'Header': header('BalanceSheet', a, b, by, 'Accrual'), 'Columns': money_columns(cols, False, by), 'Rows': {'Row': rows}}

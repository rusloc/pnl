"""Non-cash items (M13 / C07), exceptions (report spec 10.2), mapping rows (map_account_line), dimensions, and the QBO
control table parsed back from the generated CashFlow reports (ctl_qbo_cashflow)."""
import datetime as dt
from collections import defaultdict

import config as C
from util import days, is_working
from classify import LINES, LINE_SECTION, default_section, default_direct, is_cash
from company import SETUP

SECTIONS = ('OPERATING', 'INVESTING', 'FINANCING')


def ind_section(cl, aid, date, ov):
    s = cl.section(str(aid), date, ov)
    return 'OPERATING' if s == 'NET_INCOME' else s


def noncash_items(R, D):
    cl = D['cl']; cash = {int(x) for x in D['cash_ids']}
    ind = defaultdict(lambda: defaultdict(int)); dirr = defaultdict(lambda: defaultdict(int))
    meta = {}
    for x in D['led']:
        if x['txn_date'] < C.START or x['account_id'] in cash: continue
        meta[x['txn_id']] = x['txn_date']
        for ov in (True, False):
            ind[(x['txn_id'], ov)][ind_section(cl, x['account_id'], x['txn_date'], ov)] -= x['amount']
    for r in D['rows']:
        if r['is_internal_transfer']: continue
        meta[r['txn_id']] = r['txn_date']
        dirr[(r['txn_id'], True)][LINE_SECTION[r['direct_line_code']]] += r['amount']
        dirr[(r['txn_id'], False)][LINE_SECTION[r['default_direct_line_code']]] += r['amount']
    out = []
    for tid in sorted(meta):
        for s in SECTIONS:
            a1, b1 = ind[(tid, True)].get(s, 0), dirr[(tid, True)].get(s, 0)
            a0, b0 = ind[(tid, False)].get(s, 0), dirr[(tid, False)].get(s, 0)
            if a1 - b1 or a0 - b0:
                d = meta[tid]
                out.append(dict(txn_id=tid, txn_date=d, month_key=f'{d.year}-{d.month:02d}', section_code=s, indirect_amount=a1, direct_amount=b1,
                                noncash_amount=a1 - b1, noncash_amount_default=a0 - b0))
    return out


def exceptions(R, D, ncash):
    co = R['co']; acc = co.acc_by_id; cl = D['cl']
    cash = {int(x) for x in D['cash_ids']}; banks = {int(x) for x in D['bank_ids']}
    txn = {x['txn_id']: x for x in D['txn']}
    by_txn = defaultdict(list)
    for x in D['led']: by_txn[x['txn_id']].append(x)
    ex = []

    def add(code, tid, aid, mkey, amount, detail, routine=False):
        t = txn.get(tid)
        ex.append(dict(exception_code=code, txn_id=tid, account_id=aid, month_key=mkey, amount=amount, detail=detail, is_routine=routine,
                       scenario_id=t['scenario_id'] if t else None))
    uf_id = int(co.acc['UF']['Id'])
    for tid, L in sorted(by_txn.items()):
        t = txn[tid]
        if t['txn_date'] < C.START: continue
        cl_ = [x for x in L if x['account_id'] in cash]
        if t['txn_type'] == 'JournalEntry' and cl_:
            add('JE_CASH', tid, cl_[0]['account_id'], t['month_key'], abs(sum(x['amount'] for x in cl_)),
                'Journal entry posted to a cash account; classified by its other lines', routine=t['process_id'] == 'P07')
        if not cl_:
            eff = defaultdict(int)
            for x in L: eff[ind_section(cl, x['account_id'], x['txn_date'], False)] -= x['amount']
            nz = {s: v for s, v in eff.items() if v}
            if len(nz) >= 2:
                add('NONCASH_CROSS_SECTION', tid, None, t['month_key'], sum(v for v in nz.values() if v > 0),
                    'Non-cash entry between sections: ' + ', '.join(f'{s} {v / 100:,.2f}' for s, v in sorted(nz.items())))
        cash_out = -sum(x['amount'] for x in cl_)
        if cash_out > 0 and any(acc[str(x['account_id'])]['AccountType'] == 'Long Term Liability' for x in L) and \
                not any(acc[str(x['account_id'])]['AccountSubType'] == 'InterestPaid' for x in L):
            add('LOAN_WHOLE', tid, next(x['account_id'] for x in L if acc[str(x['account_id'])]['AccountType'] == 'Long Term Liability'),
                t['month_key'], cash_out, 'Loan payment posted whole to the loan account, no interest line')
    # depreciation expense without an accumulated-depreciation credit of the same size, per month
    dep, ad = defaultdict(int), defaultdict(int)
    for x in D['led']:
        a = acc[str(x['account_id'])]
        if x['txn_date'] < C.START: continue
        if a['AccountSubType'] == 'Depreciation': dep[x['month_key']] += x['amount']
        if a['AccountSubType'] == 'AccumulatedDepreciation' and x['amount'] < 0: ad[x['month_key']] -= x['amount']
    for m in sorted(dep):
        if dep[m] > ad.get(m, 0): add('DEPR_NO_CONTRA', None, None, m, dep[m] - ad.get(m, 0), 'Depreciation without accumulated depreciation')
    # Undeposited Funds: stale items at the last period end, negative balance at any month end
    swept = {l['document_txn_id'] for l in D['links'] if l['payment_txn_type'] == 'Deposit'}
    cutoff = C.END - dt.timedelta(days=C.UF_STALE_DAYS)
    for x in D['led']:
        if x['account_id'] == uf_id and x['line_kind'] == 'header' and x['amount'] > 0 and x['txn_id'] not in swept and x['txn_date'] <= cutoff:
            add('UF_STALE', x['txn_id'], uf_id, '2026-10', x['amount'], f'In Undeposited Funds since {x["txn_date"]}, not deposited by {C.END}')
    for b in D['bal']:
        if b['account_id'] == uf_id and b['closing_balance'] < 0 and b['month_key'] >= '2024-01':
            add('UF_NEGATIVE', None, uf_id, b['month_key'], b['closing_balance'], 'Undeposited Funds balance below zero at month end')
    # cash postings with no counterparty (internal transfers excluded), one exception per transaction
    nn = defaultdict(int)
    for r in D['rows']:
        if not r['is_internal_transfer'] and r['counterparty_id'] == 0: nn[r['txn_id']] += abs(r['amount'])
    for tid in sorted(nn): add('NO_NAME', tid, None, txn[tid]['month_key'], nn[tid], 'Cash posting with no customer, vendor or employee')
    # possible duplicate deposits: same amount, same account, within three days (the later one is flagged). Only deposits with
    # an unlinked line qualify: a sweep of Undeposited Funds links each payment once and cannot double count (README D-6)
    deps = sorted((t for t in D['txn'] if t['txn_type'] == 'Deposit' and t['txn_date'] >= C.START and
                   any(x['line_kind'] == 'line' and x['link_txn_id'] is None for x in by_txn[t['txn_id']])), key=lambda t: (t['txn_date'], t['txn_id']))
    for i, t in enumerate(deps):
        for u in deps[:i]:
            if u['header_account_id'] == t['header_account_id'] and u['total_amount'] == t['total_amount'] and \
                    0 <= (t['txn_date'] - u['txn_date']).days <= C.DUP_WINDOW_DAYS:
                add('DUP_DEPOSIT', t['txn_id'], t['header_account_id'], t['month_key'], t['total_amount'], f'Same amount and account as deposit {u["txn_id"]}')
    # bank accounts not reconciled through the last period end
    for aid in sorted(banks):
        add('BANK_UNRECONCILED', None, aid, '2026-10', 0, 'Reconciled through 2026-09-30, period ends 2026-10-31')
    for i, e in enumerate(ex, start=1): e['exception_id'] = i
    return ex


def mapping(R, cl):
    co = R['co']; out = []
    ov = cl.ov
    line_of = {'NET_INCOME': 'I_NET_INCOME', 'OPERATING': 'I_ACCOUNT_OP', 'INVESTING': 'I_ACCOUNT_INV', 'FINANCING': 'I_ACCOUNT_FIN', 'CASH': 'I_END_CASH'}
    for a in sorted(co.acc_by_id.values(), key=lambda a: int(a['Id'])):
        s = default_section(a)
        base = dict(account_id=int(a['Id']), effective_from=C.PRESPAN_START, is_override=False, reason='QBO default by account type',
                    author='QBO default', created_at=SETUP)
        out.append(dict(base, view='INDIRECT', direction='ANY', section_code=s, line_code=line_of.get(s), line_label=a['FullyQualifiedName']))
        for k, v in default_direct(a).items():
            out.append(dict(base, view='DIRECT', direction=k, section_code=LINE_SECTION[v], line_code=v, line_label=None))
        o = ov.get(a['Id'])
        if o:
            ob = dict(account_id=int(a['Id']), effective_from=o['effective_from'], is_override=True, reason=o['reason'], author=o['author'],
                      created_at=o['created_at'])
            out.append(dict(ob, view='INDIRECT', direction='ANY', section_code=o['section'], line_code='I_ACCOUNT_FIN', line_label=o['label']))
            for k, v in o['direct'].items():
                out.append(dict(ob, view='DIRECT', direction=k, section_code=LINE_SECTION[v], line_code=v, line_label=None))
    for i, r in enumerate(out, start=1): r['map_id'] = i
    return out


def dims(R, D):
    co = R['co']; cl = D['cl']
    cur = defaultdict(int)
    for x in D['led']: cur[x['account_id']] += x['amount']
    order = sorted(co.acc_by_id.values(), key=lambda a: (C.TYPE_ORDER.index(a['AccountType']),
                                                         int(co.acc[a['parent']]['Id']) if a['parent'] else int(a['Id']), bool(a['parent']), int(a['Id'])))
    acct = []
    for n, a in enumerate(order, start=1):
        o = cl.ov.get(a['Id']); dd = default_direct(a)
        acct.append(dict(account_id=int(a['Id']), account_name=a['Name'], fully_qualified_name=a['FullyQualifiedName'],
                         parent_account_id=int(co.acc[a['parent']]['Id']) if a['parent'] else None, account_level=1 if a['parent'] else 0,
                         account_type=a['AccountType'], account_subtype=a['AccountSubType'], classification=a['Classification'],
                         is_pl=a['AccountType'] in C.PL_TYPES, is_cash=is_cash(a), is_bank=a['AccountType'] == 'Bank',
                         cash_kind='BANK' if a['AccountType'] == 'Bank' else 'UF' if is_cash(a) else None,
                         default_section=default_section(a), override_section=o['section'] if o else None,
                         override_line_label=o['label'] if o else None, direct_line_in=dd.get('ANY') or dd['IN'],
                         direct_line_out=dd.get('ANY') or dd['OUT'], sort_order=n, active=True,
                         current_balance=cur[int(a['Id'])] if a['AccountType'] not in C.PL_TYPES else None,
                         last_reconciled_date=dt.date(2026, 9, 30) if a['AccountType'] == 'Bank' else None,
                         cash_floor=C.CASH_FLOOR.get(a['code']) if a['AccountType'] == 'Bank' else None))
    cfl = [dict(view=v, line_code=c, section_code=s, line_label=l, line_kind=k, sort_order=o, usual_direction=u, qbo_group=g or None,
                sign_rule='BALANCE' if u == 'BALANCE' else 'CASH_IN_POSITIVE' if k not in ('section_header', 'subsection_header') else 'NONE')
           for v, c, s, l, k, o, u, g in LINES]
    cp = [dict(counterparty_id=0, counterparty_kind='None', counterparty_name='(no name)', active=True, created_date=None)]
    for c in co.cust: cp.append(dict(counterparty_id=int(c['Id']), counterparty_kind='Customer', counterparty_name=c['name'], active=True,
                                     created_date=c['created'].date()))
    for v in co.vend.values(): cp.append(dict(counterparty_id=int(v['Id']), counterparty_kind='Vendor', counterparty_name=v['name'], active=True,
                                              created_date=v['created'].date()))
    for e in co.emp: cp.append(dict(counterparty_id=int(e['Id']), counterparty_kind='Employee', counterparty_name=e['name'],
                                    active=e['term'] is None, created_date=e['created'].date()))
    cp.sort(key=lambda r: r['counterparty_id'])
    klass = [dict(class_id=int(v['Id']), class_name=v['Name']) for v in co.cls.values()]
    dates = []
    for d in days(C.PRESPAN_START, dt.date(2026, 12, 31)):
        dates.append(dict(date=d, month_key=f'{d.year}-{d.month:02d}', year=d.year, quarter=(d.month - 1) // 3 + 1, month_num=d.month,
                          month_name=d.strftime('%b'), fiscal_year=d.year, is_month_end=(d + dt.timedelta(days=1)).day == 1,
                          is_working_day=is_working(d), is_actual=C.START <= d <= C.END))
    return acct, cfl, cp, klass, dates


def ctl_from_cashflow(reports):
    """Parse the monthly CashFlow report objects back into rows (by group and label, never by position)."""
    out = []
    for fname, rep in reports:
        cols = rep['Columns']['Column'][1:]

        def walk(rows, group):
            for r in rows:
                g = r.get('group', group)
                if 'ColData' in r:
                    cd = r['ColData']
                    for c, cell in zip(cols, cd[1:]):
                        if c['ColTitle'] == 'Total': continue
                        out.append(dict(month_key=_mk(c), row_group=g, row_label=cd[0]['value'], account_id=int(cd[0]['id']) if 'id' in cd[0] else None,
                                        row_kind='Data', amount=int(round(float(cell['value']) * 100)) if cell['value'] else 0, report_file=fname))
                if 'Rows' in r: walk(r['Rows']['Row'], g)
                if 'Summary' in r:
                    cd = r['Summary']['ColData']
                    for c, cell in zip(cols, cd[1:]):
                        if c['ColTitle'] == 'Total': continue
                        out.append(dict(month_key=_mk(c), row_group=g, row_label=cd[0]['value'], account_id=None, row_kind='Summary',
                                        amount=int(round(float(cell['value']) * 100)) if cell['value'] else 0, report_file=fname))
        walk(rep['Rows']['Row'], None)
    for r in out: r['pulled_at'] = C.AS_OF
    return out


def _mk(c):
    v = next(m['Value'] for m in c['MetaData'] if m['Name'] == 'StartDate')
    return v[:7]

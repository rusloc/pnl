"""GeneralLedger and TransactionList report objects (generator spec 6.2), one file per six-month window, Total columns.
Amounts are debit positive in the account's home currency; P&L accounts start the fiscal year at zero."""
import datetime as dt
from collections import defaultdict

import config as C
from util import mstr
from reports import header


def _names(co):
    n = {}
    for c in co.cust: n[int(c['Id'])] = c['name']
    for v in co.vend.values(): n[int(v['Id'])] = v['name']
    for e in co.emp: n[int(e['Id'])] = e['name']
    return n


def build(R, D, B, a, b):
    """Returns (GeneralLedger, TransactionList) for the window a..b."""
    co = R['co']; acc = co.acc_by_id; names = _names(co)
    txn = {x['txn_id']: x for x in D['txn']}
    by_txn = defaultdict(list)
    for x in D['led']: by_txn[x['txn_id']].append(x)
    cleared = {x['txn_id']: x['cleared_status'] for x in D['txn']}
    clr = {'Reconciled': 'R', 'Cleared': 'C'}

    def split(x):
        others = {y['account_id'] for y in by_txn[x['txn_id']] if y['account_id'] != x['account_id']}
        return (acc[str(next(iter(others)))]['FullyQualifiedName'], str(next(iter(others)))) if len(others) == 1 else ('-Split-', None)

    gl_cols = [('tx_date', 'Date', 'Date'), ('txn_type', 'Transaction Type', 'String'), ('doc_num', 'Num', 'String'), ('name', 'Name', 'String'),
               ('memo', 'Memo/Description', 'String'), ('split_acc', 'Split', 'String'), ('is_cleared', 'Clr', 'String'),
               ('subt_nat_amount', 'Amount', 'Money'), ('rbal_nat_amount', 'Balance', 'Money')]
    rows = []
    per_acct = defaultdict(list)
    for x in D['led']:
        if a <= x['txn_date'] <= b: per_acct[x['account_id']].append(x)
    for aid in sorted(acc, key=lambda i: B.order[i]):
        A = acc[aid]; lines = sorted(per_acct.get(int(aid), []), key=lambda x: (x['txn_date'], x['txn_id'], x['ledger_seq']))
        pl = A['AccountType'] in C.PL_TYPES
        beg = 0 if (pl and a.month == C.FISCAL_YEAR_START_MONTH) else B.balance(aid, a - dt.timedelta(days=1))
        if not lines and beg == 0: continue
        r, run_ = [], beg
        r.append({'ColData': [{'value': 'Beginning Balance'}] + [{'value': ''}] * 6 + [{'value': ''}, {'value': mstr(beg)}], 'type': 'Data'})
        for x in lines:
            t = txn[x['txn_id']]; run_ += x['amount']
            sp, sid = split(x)
            nm = names.get(x['counterparty_id']) if x['counterparty_id'] else None
            cell = lambda v, i=None: ({'value': v, 'id': i} if i else {'value': v})
            r.append({'ColData': [cell(x['txn_date'].isoformat()), cell(t['txn_type'], str(t['txn_id'])), cell(t['doc_number'] or ''),
                                  cell(nm or '', str(x['counterparty_id']) if nm else None), cell(x['description'] or t['private_note'] or ''),
                                  cell(sp, sid), cell(clr.get(cleared[x['txn_id']], '') if A['AccountType'] == 'Bank' else ''),
                                  cell(mstr(x['amount'])), cell(mstr(run_))], 'type': 'Data'})
        rows.append({'Header': {'ColData': [{'value': A['FullyQualifiedName'], 'id': aid}] + [{'value': ''}] * 8}, 'Rows': {'Row': r},
                     'Summary': {'ColData': [{'value': f'Total for {A["FullyQualifiedName"]}'}] + [{'value': ''}] * 6 +
                                            [{'value': mstr(sum(x['amount'] for x in lines))}, {'value': mstr(run_)}]}, 'type': 'Section'})
    gl = {'Header': header('GeneralLedger', a, b, 'Total', 'Accrual'),
          'Columns': {'Column': [{'ColTitle': t, 'ColType': ty, 'MetaData': [{'Name': 'ColKey', 'Value': k}]} for k, t, ty in gl_cols]},
          'Rows': {'Row': rows}}
    tl_cols = [('tx_date', 'Date', 'Date'), ('txn_type', 'Transaction Type', 'String'), ('doc_num', 'Num', 'String'), ('is_no_post', 'Posting', 'String'),
               ('name', 'Name', 'String'), ('memo', 'Memo/Description', 'String'), ('account_name', 'Account', 'String'),
               ('other_account', 'Split', 'String'), ('subt_nat_amount', 'Amount', 'Money')]
    tr = []
    for t in sorted((x for x in D['txn'] if a <= x['txn_date'] <= b), key=lambda x: (x['txn_date'], x['txn_id'])):
        L = by_txn[t['txn_id']]
        h = t['header_account_id']
        others = {y['account_id'] for y in L if y['account_id'] != h}
        other = acc[str(next(iter(others)))]['FullyQualifiedName'] if len(others) == 1 else '-Split-'
        nm = names.get(t['counterparty_id']) if t['counterparty_id'] else ''
        tr.append({'ColData': [{'value': t['txn_date'].isoformat()}, {'value': t['txn_type'], 'id': str(t['txn_id'])}, {'value': t['doc_number'] or ''},
                               {'value': 'Yes'}, {'value': nm or ''}, {'value': t['private_note'] or ''},
                               {'value': acc[str(h)]['FullyQualifiedName'] if h else ''}, {'value': other},
                               {'value': mstr(t['total_amount'])}], 'type': 'Data'})
    tl = {'Header': header('TransactionList', a, b, 'Total', 'Accrual'),
          'Columns': {'Column': [{'ColTitle': t, 'ColType': ty, 'MetaData': [{'Name': 'ColKey', 'Value': k}]} for k, t, ty in tl_cols]},
          'Rows': {'Row': tr}}
    return gl, tl

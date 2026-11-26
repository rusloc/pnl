"""Ledger poster: one fixed posting rule per QBO transaction type (generator spec 6.1), applied to the QBO object itself.

post() returns ledger lines as dicts, amounts in integer cents, debit positive. Line kinds:
  header  the transaction's own account (deposit-to, paying account, A/R or A/P control); JE has none
  line    a Line[] entry (line_seq = position in Line[], 1-based; qbo_line_id = its Id when QBO gives one)
  tax     the sales tax of TxnTaxDetail
Every transaction balances to zero before it is written (I01); zero-amount lines are not posted.
"""
from util import cents


def _c(x): return cents(x)


def _ent_hdr(obj):
    for k, kind in (('CustomerRef', 'Customer'), ('VendorRef', 'Vendor')):
        if k in obj: return (kind, obj[k]['value'])
    if 'EntityRef' in obj: return (obj['EntityRef'].get('type', 'Vendor'), obj['EntityRef']['value'])
    return None


def _link(ln):
    lt = ln.get('LinkedTxn') or []
    if not lt: return None, None
    v = lt[0]['TxnId']
    return lt[0]['TxnType'], (v.k if hasattr(v, 'k') else v)


def post(typ, obj, co):
    L = []
    hdr_ent = _ent_hdr(obj)

    def add(acct_id, amt, kind, seq=0, qid=None, ent=None, cls=None, desc=None, link_type=None, link=None):
        if amt == 0: return
        L.append(dict(account_id=acct_id, amount=amt, kind=kind, line_seq=seq, qbo_line_id=qid, entity=ent if ent else hdr_ent,
                      class_id=cls, description=desc, link_type=link_type, link=link))

    AR, AP, UF, STP = co.aid['AR'], co.aid['AP'], co.aid['UF'], co.aid['STP']
    lines = obj.get('Line', [])
    if typ in ('Invoice', 'CreditMemo', 'SalesReceipt', 'RefundReceipt'):
        sign = 1 if typ in ('Invoice', 'SalesReceipt') else -1           # +1: header debit, revenue credit
        hdr_acct = AR if typ in ('Invoice', 'CreditMemo') else obj['DepositToAccountRef']['value']
        add(hdr_acct, sign * _c(obj['TotalAmt']), 'header')
        for i, ln in enumerate(lines, start=1):
            if ln['DetailType'] != 'SalesItemLineDetail': continue
            det = ln['SalesItemLineDetail']
            it = co.items_by_id[det['ItemRef']['value']]
            add(co.aid[it['income']], -sign * _c(ln['Amount']), 'line', i, ln.get('Id'), cls=det.get('ClassRef', {}).get('value'),
                desc=ln.get('Description'))
        add(STP, -sign * _c(obj['TxnTaxDetail']['TotalTax']), 'tax', -1)
    elif typ == 'Payment':
        add(obj['DepositToAccountRef']['value'], _c(obj['TotalAmt']), 'header')
        for i, ln in enumerate(lines, start=1):
            lt, lk = _link(ln)
            add(AR, (-1 if lt == 'Invoice' else 1) * _c(ln['Amount']), 'line', i, None, link_type=lt, link=lk)
        add(AR, -_c(obj.get('UnappliedAmt', 0)), 'line', len(lines) + 1)
    elif typ == 'Deposit':
        add(obj['DepositToAccountRef']['value'], _c(obj['TotalAmt']), 'header', ent=None)
        for i, ln in enumerate(lines, start=1):
            lt, lk = _link(ln)
            if lt:
                add(UF, -_c(ln['Amount']), 'line', i, ln.get('Id'), link_type=lt, link=lk)
            else:
                det = ln['DepositLineDetail']
                ent = (det['Entity']['type'].capitalize(), det['Entity']['value']) if 'Entity' in det else None
                add(det['AccountRef']['value'], -_c(ln['Amount']), 'line', i, ln.get('Id'), ent=ent or ('none', None),
                    cls=det.get('ClassRef', {}).get('value'), desc=ln.get('Description'))
    elif typ in ('Bill', 'VendorCredit', 'Purchase'):
        sign = 1 if typ in ('Bill', 'Purchase') else -1                   # +1: lines debit, header credit
        if typ == 'Purchase' and obj.get('Credit'): sign = -1
        hdr_acct = obj['AccountRef']['value'] if typ == 'Purchase' else AP
        add(hdr_acct, -sign * _c(obj['TotalAmt']), 'header', ent=hdr_ent or ('none', None))
        for i, ln in enumerate(lines, start=1):
            det = ln['AccountBasedExpenseLineDetail']
            add(det['AccountRef']['value'], sign * _c(ln['Amount']), 'line', i, ln.get('Id'), ent=hdr_ent or ('none', None),
                cls=det.get('ClassRef', {}).get('value'), desc=ln.get('Description'))
    elif typ == 'BillPayment':
        pay = obj['CheckPayment']['BankAccountRef'] if obj['PayType'] == 'Check' else obj['CreditCardPayment']['CCAccountRef']
        add(pay['value'], -_c(obj['TotalAmt']), 'header')
        for i, ln in enumerate(lines, start=1):
            lt, lk = _link(ln)
            add(AP, (1 if lt == 'Bill' else -1) * _c(ln['Amount']), 'line', i, None, link_type=lt, link=lk)
    elif typ == 'CreditCardPayment':
        add(obj['BankAccountRef']['value'], -_c(obj['Amount']), 'header')
        add(obj['CreditCardAccountRef']['value'], _c(obj['Amount']), 'line', 1)
    elif typ == 'Transfer':
        add(obj['FromAccountRef']['value'], -_c(obj['Amount']), 'header', ent=('none', None))
        add(obj['ToAccountRef']['value'], _c(obj['Amount']), 'line', 1, ent=('none', None))
    elif typ == 'JournalEntry':
        for i, ln in enumerate(lines, start=1):
            det = ln['JournalEntryLineDetail']
            ent = (det['Entity']['Type'], det['Entity']['EntityRef']['value']) if 'Entity' in det else ('none', None)
            amt = _c(ln['Amount']) * (1 if det['PostingType'] == 'Debit' else -1)
            add(det['AccountRef']['value'], amt, 'line', i, ln.get('Id'), ent=ent, cls=det.get('ClassRef', {}).get('value'),
                desc=ln.get('Description'))
    else:
        raise ValueError(typ)
    s = sum(x['amount'] for x in L)
    assert s == 0, (typ, obj.get('TxnDate'), s)
    for x in L:
        if x['entity'] == ('none', None): x['entity'] = None
    return L

"""QBO emitter (generator spec 4.1): Ids, document and cheque numbers, MetaData (bookkeeping lag, edits), SyncToken,
resolved links, Balance / LinkedTxn on settled documents. Transactions draw from one shared Id sequence in creation order."""
import datetime as dt
import numpy as np

import config as C
from util import stream, money, iso
from book import K

TD = dt.timedelta
SALES_DOCS = ('Invoice', 'SalesReceipt', 'CreditMemo', 'RefundReceipt')


def _resolve(x, kmap):
    if isinstance(x, K): return kmap[x.k]
    if isinstance(x, dict): return {k: _resolve(v, kmap) for k, v in x.items()}
    if isinstance(x, list): return [_resolve(v, kmap) for v in x]
    return x


def _links(t):
    return [ln['LinkedTxn'][0]['TxnId'].k for ln in t['obj'].get('Line', []) if ln.get('LinkedTxn')]


def emit(book, co):
    rng = stream('metadata')
    T = book.txns
    asof = C.AS_OF
    # ---- creation times: bookkeeping lag, month-end entries keyed in early next month, linked docs never created first ---
    for t in sorted(T, key=lambda t: (t['date'], t['k'])):
        base = dt.datetime.combine(t['date'], dt.time(0))
        if t['proc'] == 'OPENING':
            ct = dt.datetime(2024, 1, 2, 10, 12)
        elif t['type'] == 'JournalEntry' and t['obj'].get('Adjustment'):
            ct = base + TD(days=int(rng.integers(3, 7)), hours=int(rng.integers(9, 17)), minutes=int(rng.integers(0, 60)))
        elif t['type'] == 'Transfer' or (t['type'] == 'Purchase' and t['obj']['PaymentType'] == 'Cash'):
            ct = base + TD(days=int(rng.integers(0, 2)), hours=int(rng.integers(8, 18)), minutes=int(rng.integers(0, 60)))
        else:
            lag = min(20, int(round(np.exp(rng.normal(np.log(C.LAG_MEDIAN_DAYS), 0.7)))))
            if rng.random() < 0.08: lag += int(rng.integers(3, 9))           # catch-up batch
            ct = base + TD(days=lag, hours=int(rng.integers(8, 18)), minutes=int(rng.integers(0, 60)), seconds=int(rng.integers(0, 60)))
        lk = _links(t)
        if lk: ct = max([ct] + [book.by_k[k]['create'] + TD(minutes=int(rng.integers(2, 90))) for k in lk])
        if ct > asof - TD(minutes=30): ct = max(base + TD(hours=9), asof - TD(minutes=int(rng.integers(30, 600))))
        t['create'] = ct.replace(microsecond=0)
    # ---- Ids in creation order ----------------------------------------------------------------------------------------------
    order = sorted(T, key=lambda t: (t['create'], t['k']))
    kmap = {}
    for n, t in enumerate(order, start=1):
        t['Id'] = str(n); kmap[t['k']] = t['Id']
    # ---- numbers: shared sales-form sequence by creation, cheque numbers per bank account by date ----------------------------
    num = 1001
    for t in order:
        if t['type'] in SALES_DOCS:
            t['obj']['DocNumber'] = str(num); num += 1
    chq = {}
    for t in sorted(T, key=lambda t: (t['date'], t['k'])):
        acct = None
        if t['type'] == 'Purchase' and t['obj']['PaymentType'] == 'Check': acct = t['obj']['AccountRef']['value']
        if t['type'] == 'BillPayment' and t['obj']['PayType'] == 'Check': acct = t['obj']['CheckPayment']['BankAccountRef']['value']
        if acct:
            chq[acct] = chq.get(acct, 2100 + 400 * (int(acct) - 1)) + 1
            t['obj']['DocNumber'] = str(chq[acct])
    # ---- settlements: Balance, RemainingCredit, LinkedTxn and the updates they cause ---------------------------------------
    for t in T:
        t['sync'] = 0; t['updated'] = t['create']
    applied = {}
    for t in order:
        if t['type'] not in ('Payment', 'BillPayment'): continue
        for ln in t['obj']['Line']:
            lk = ln['LinkedTxn'][0]['TxnId'].k; doc = book.by_k[lk]
            applied[lk] = applied.get(lk, 0) + int(round(ln['Amount'] * 100))
            back = {'Payment': 'Payment', 'BillPayment': 'BillPayment'}[t['type']]
            if doc['type'] in ('Invoice', 'Bill'):
                doc['obj']['LinkedTxn'].append({'TxnId': t['Id'], 'TxnType': back})
            doc['sync'] += 1; doc['updated'] = max(doc['updated'], t['create'])
    for t in T:
        tot = t['extra'].get('total', 0)
        if t['type'] in ('Invoice', 'Bill', 'VendorCredit', 'CreditMemo'):
            left = tot - applied.get(t['k'], 0)
            assert left >= 0, ('over-applied', t['type'], t['date'])
            t['obj']['Balance'] = money(left)
            if t['type'] == 'CreditMemo': t['obj']['RemainingCredit'] = money(left)
            t['open'] = left
    # ---- later edits (6 %): memo or line description touched after creation --------------------------------------------------
    for t in order:
        if t['proc'] != 'OPENING' and rng.random() < C.EDITED_SHARE:
            n = 1 + int(rng.random() < 0.25)
            up = t['create'] + TD(hours=int(rng.integers(1, 240)))
            t['sync'] += n; t['updated'] = max(t['updated'], min(up, asof - TD(minutes=5)))
    # ---- blank memos: card and bill lines get template descriptions except about 15 % ----------------------------------------
    for t in order:
        if t['type'] in ('Purchase', 'Bill'):
            for ln in t['obj']['Line']:
                if 'Description' not in ln and rng.random() >= C.BLANK_MEMO_SHARE:
                    ln['Description'] = t['obj']['EntityRef']['name'] if 'EntityRef' in t['obj'] else 'Expense'
    # ---- final objects --------------------------------------------------------------------------------------------------------
    for t in T:
        body = _resolve(t['obj'], kmap)
        t['qbo'] = {'domain': 'QBO', 'sparse': False, 'Id': t['Id'], 'SyncToken': str(t['sync']),
                    'MetaData': {'CreateTime': iso(t['create']), 'LastUpdatedTime': iso(t['updated'])}, **body}
    return order

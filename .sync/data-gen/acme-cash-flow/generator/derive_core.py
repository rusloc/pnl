"""Report tables derived from the ledger (report spec 9.2): transactions, ledger lines, cash postings with settlement
look-through (rule 7.3.2), settlement links, cleared status, account balances by month end."""
import datetime as dt
from collections import defaultdict
import numpy as np

import config as C
from util import stream, alloc, months, month_end, next_working
from classify import Classifier, is_cash

TD = dt.timedelta
LAST_RECONCILED = dt.date(2026, 9, 30)


def mkey(d): return f'{d.year}-{d.month:02d}'


def hdr_entity(q):
    for k in ('CustomerRef', 'VendorRef'):
        if k in q: return int(q[k]['value'])
    if 'EntityRef' in q: return int(q['EntityRef']['value'])
    return None


def build(R):
    co, book = R['co'], R['book']
    cl = Classifier(co)
    acc = co.acc_by_id
    T = sorted(book.txns, key=lambda t: int(t['Id']))
    byk = book.by_k
    byid = {t['Id']: t for t in T}
    lines_by_k = defaultdict(list)
    for ln in R['ledger']: lines_by_k[ln['txn_k']].append(ln)
    cash_ids = {a['Id'] for a in acc.values() if is_cash(a)}
    bank_ids = {a['Id'] for a in acc.values() if a['AccountType'] == 'Bank'}
    # ---- cleared status per transaction and bank account ---------------------------------------------------------------
    rng = stream('clearing')
    cleared = {}
    for t in T:
        banks = sorted({ln['account_id'] for ln in lines_by_k[t['k']] if ln['account_id'] in bank_ids})
        if not banks or t['date'] < C.START: continue
        q = t['qbo']
        if (t['type'] == 'Purchase' and q['PaymentType'] == 'Check') or (t['type'] == 'BillPayment' and q.get('PayType') == 'Check'):
            lag = int(round(np.exp(rng.normal(np.log(4), 0.5))))
        elif t['type'] in ('Deposit', 'CreditCardPayment', 'RefundReceipt'):
            lag = int(rng.integers(1, 3))
        elif t['type'] in ('Transfer', 'JournalEntry'):
            lag = 0
        else:
            lag = int(rng.integers(0, 2))
        cd = None if t['extra'].get('never_clear') else next_working(t['date'] + TD(days=lag))
        st = 'Uncleared' if cd is None or cd > C.AS_OF.date() else 'Reconciled' if cd <= LAST_RECONCILED else 'Cleared'
        for b in banks: cleared[(t['k'], b)] = (st, cd)
    # ---- ledger table ------------------------------------------------------------------------------------------------------
    led = []
    for t in T:
        for ln in lines_by_k[t['k']]:
            link = byid[ln['link']]['Id'] if ln['link'] is not None else None
            led.append(dict(txn_id=int(t['Id']), ledger_seq=ln['ledger_seq'], txn_date=t['date'], month_key=mkey(t['date']), txn_type=t['type'],
                            account_id=int(ln['account_id']), amount=ln['amount'], line_kind=ln['kind'], line_seq=ln['line_seq'],
                            qbo_line_id=ln['qbo_line_id'], counterparty_id=int(ln['entity'][1]) if ln['entity'] else 0,
                            class_id=int(ln['class_id']) if ln['class_id'] else None, description=ln['description'],
                            link_txn_id=int(link) if link else None, link_txn_type=ln['link_type']))
    # ---- settlement allocation: applied amount split over the document's lines, largest remainder ----------------------------
    def doc_parts(doc_k, applied):
        dl = [x for x in lines_by_k[doc_k] if x['kind'] != 'header']
        return dl, alloc(applied, [abs(x['amount']) for x in dl])

    links, rows = [], []
    for t in T:
        q = t['qbo']
        if t['type'] in ('Payment', 'BillPayment', 'Deposit'):
            for ln in lines_by_k[t['k']]:
                if ln['link'] is None: continue
                doc = byid[ln['link']]
                applied = abs(ln['amount'])
                if t['type'] == 'Deposit':
                    links.append(dict(payment_txn_id=int(t['Id']), payment_txn_type=t['type'], payment_line_seq=ln['line_seq'],
                                      document_txn_id=int(doc['Id']), document_txn_type=doc['type'], document_ledger_seq=None,
                                      document_account_id=None, applied_amount=applied, allocated_amount=applied))
                    continue
                dl, parts = doc_parts(doc['k'], applied)
                for x, p in zip(dl, parts):
                    links.append(dict(payment_txn_id=int(t['Id']), payment_txn_type=t['type'], payment_line_seq=ln['line_seq'],
                                      document_txn_id=int(doc['Id']), document_txn_type=doc['type'], document_ledger_seq=x['ledger_seq'],
                                      document_account_id=int(x['account_id']), applied_amount=applied, allocated_amount=p))
        if t['date'] < C.START: continue
        L = lines_by_k[t['k']]
        cl_lines = [x for x in L if x['account_id'] in cash_ids]
        if not cl_lines: continue
        H = [x for x in L if x['kind'] == 'header' and x['account_id'] in cash_ids]
        if not H:
            assert len(cl_lines) == 1, ('ambiguous cash line', t['type'], t['date'])
            H = cl_lines
        H = H[0]
        he = hdr_entity(q)
        cash_ent = int(H['entity'][1]) if H['entity'] else None

        def cp(line_ent, linked_ent=None):
            if linked_ent is not None: return linked_ent, 'LINKED'
            if he is not None: return he, 'HEADER'
            if line_ent is not None: return line_ent, 'LINE'
            if cash_ent is not None: return cash_ent, 'CASH_LINE'
            return 0, 'NONE'

        memo = (q.get('PrivateNote') or next((x.get('Description') for x in q.get('Line', []) if x.get('Description')), '') or '')[:60]

        def add(cash_acct, offset_acct, posting_acct, amount, ln, settled=None, line_ent=None, linked_ent=None):
            c, src = cp(line_ent, linked_ent)
            internal = offset_acct in cash_ids
            st, cd = cleared.get((t['k'], cash_acct), ('NotApplicable', None)) if cash_acct in bank_ids else ('NotApplicable', None)
            rows.append(dict(txn_id=int(t['Id']), txn_date=t['date'], month_key=mkey(t['date']), source_type=t['type'],
                             cash_account_id=int(cash_acct), cash_kind='BANK' if cash_acct in bank_ids else 'UF', offset_ledger_seq=ln['ledger_seq'],
                             posting_account_id=int(posting_acct), offset_account_id=int(offset_acct),
                             settled_txn_id=int(settled[0]) if settled else None, settled_ledger_seq=settled[1] if settled else None,
                             counterparty_id=c, counterparty_source=src, class_id=int(ln['class_id']) if ln['class_id'] else None,
                             amount=amount, is_internal_transfer=internal,
                             direct_line_code='D_MEMO_TRANSFER' if internal else cl.direct(offset_acct, amount, t['date']),
                             default_direct_line_code='D_MEMO_TRANSFER' if internal else cl.direct(offset_acct, amount, t['date'], False),
                             in_bank_view=cash_acct in bank_ids, cleared_status=st, cleared_date=cd, is_journal_entry=t['type'] == 'JournalEntry',
                             memo=memo))
            r = rows[-1]
            if r['in_bank_view']:
                r['bank_view_line_code'] = ('D_MEMO_TRANSFER' if offset_acct in bank_ids else 'D_REC_CUST' if offset_acct in cash_ids
                                            else r['direct_line_code'])
            else:
                r['bank_view_line_code'] = None

        for ln in L:
            if ln is H: continue
            amt = -ln['amount']
            le = int(ln['entity'][1]) if ln['entity'] else None
            if ln['link'] is not None and t['type'] in ('Payment', 'BillPayment'):
                doc = byid[ln['link']]
                dl, parts = doc_parts(doc['k'], abs(amt))
                sgn = 1 if amt > 0 else -1
                for x, p in zip(dl, parts):
                    add(H['account_id'], x['account_id'], ln['account_id'], sgn * p, ln, settled=(doc['Id'], x['ledger_seq']), line_ent=le)
            elif ln['link'] is not None and t['type'] == 'Deposit':
                doc = byid[ln['link']]
                add(H['account_id'], ln['account_id'], ln['account_id'], amt, ln, settled=(doc['Id'], None),
                    linked_ent=hdr_entity(doc['qbo']))
            else:
                add(H['account_id'], ln['account_id'], ln['account_id'], amt, ln, line_ent=le)
            if ln['account_id'] in cash_ids:                    # mirror side of an internal transfer
                add(ln['account_id'], H['account_id'], H['account_id'], ln['amount'], ln, line_ent=le,
                    linked_ent=hdr_entity(byid[ln['link']]['qbo']) if ln['link'] is not None else None)
    # ---- transactions (Level 4 header) ---------------------------------------------------------------------------------------
    txn = []
    for t in T:
        q = t['qbo']; L = lines_by_k[t['k']]
        H = next((x for x in L if x['kind'] == 'header'), None)
        cash_amt = sum(x['amount'] for x in L if x['account_id'] in cash_ids)
        bk = next((x['account_id'] for x in L if x['account_id'] in bank_ids), None)
        st, cd = cleared.get((t['k'], bk), ('NotApplicable', None)) if bk else ('NotApplicable', None)
        txn.append(dict(txn_id=int(t['Id']), txn_type=t['type'], txn_date=t['date'], month_key=mkey(t['date']), doc_number=q.get('DocNumber'),
                        counterparty_id=hdr_entity(q) or 0, header_account_id=int(H['account_id']) if H else None,
                        bank_account_id=int(bk) if bk else None,
                        payment_type=q.get('PaymentType') or q.get('PayType'), payment_method=(q.get('PaymentMethodRef') or {}).get('name'),
                        total_amount=t['extra'].get('total', 0), open_balance=t.get('open'),
                        cash_amount=cash_amt, private_note=q.get('PrivateNote'), created_at=t['create'], updated_at=t['updated'],
                        sync_token=t['sync'], is_edited=t['sync'] > 0 and t['updated'] > t['create'], process_id=t['proc'],
                        chain_id=t['chains'][0] if t['chains'] else None, scenario_id=t['scen'], cleared_status=st, cleared_date=cd,
                        qbo_link=f'https://app.qbo.intuit.com/app/{t["type"].lower()}?txnId={t["Id"]}'))
    # ---- balances by month end: balance-sheet accounts cumulative, P&L accounts fiscal year to date ------------------------
    mon = [(2023, 12)] + months(C.START, C.END)
    by = defaultdict(int)
    for x in led:
        k = (x['account_id'], mkey(x['txn_date']) if x['txn_date'] >= dt.date(2023, 12, 1) else '2023-12')
        by[k] += x['amount']
    bal = []
    for a in sorted(acc.values(), key=lambda a: int(a['Id'])):
        aid = int(a['Id']); run_ = 0; pl = a['AccountType'] in C.PL_TYPES
        for y, m in mon:
            mk = f'{y}-{m:02d}'
            if pl and m == 1: run_ = 0
            op = run_; ch = by.get((aid, mk), 0); run_ += ch
            bal.append(dict(account_id=aid, month_key=mk, month_end=month_end(y, m), opening_balance=op, net_change=ch, closing_balance=run_))
    return dict(cl=cl, led=led, rows=rows, links=links, txn=txn, bal=bal, cash_ids=cash_ids, bank_ids=bank_ids, lines_by_k=lines_by_k)

"""Scenario planting for the 'typical' preset (generator spec section 7). Each instance is tagged on its transactions;
derive.py writes the oracle record from the planted facts and the expected outcome.

S01 line of credit typed Other Current Liability (draws and repayments in cashpass.py; override rows in derive.py)
S02 asset bought on finance, S04 loan payment posted whole, S13 bill payment covering an equipment bill: sim_capital.py
S03 journal entry to a bank account, S06 stale and negative Undeposited Funds, S07 duplicate deposit,
S08 cash with no counterparty, S18 uncleared items at period end: here.
"""
import datetime as dt

from util import cents, add_working, stream

TD = dt.timedelta


def plant(book, co, uf_items):
    V = co.vend
    rng = stream('scenarios')
    out = {}
    # ---- S03: owner cash withdrawal and its fee posted by journal entry straight to the bank account ---------------------------
    out['S03'] = book.journal(dt.date(2025, 11, 14), [('EQ_DRAW', cents(1_200), V['V_OWNER'], None, 'Owner cash withdrawal at branch'),
                                                     ('EX_BANK', cents(50), V['V_BANK'], 'CL_OH', 'Counter withdrawal fee'),
                                                     ('BANK_OP', -cents(1_250), None, None, 'Branch withdrawal')],
                              'P14', book.chain('P14', V['V_OWNER']['Id']), doc='JE-1114', memo='Branch withdrawal booked by journal', scen='S03')
    # ---- S06: cheque payments left in Undeposited Funds; one of them deposited a second time straight to income;
    #           one cheque deposited (coded to Undeposited Funds) before its payment was entered -> negative balance at month end
    pays = [t for t in uf_items if t['type'] == 'Payment' and t['extra']['total'] > 0]
    q3 = [t for t in pays if dt.date(2026, 7, 1) <= t['date'] <= dt.date(2026, 9, 30) and 100_000 <= t['extra']['total'] <= 900_000]
    stale = [q3[int(i)] for i in sorted(rng.choice(len(q3), size=3, replace=False))]
    apr = [t for t in pays if dt.date(2026, 4, 1) <= t['date'] <= dt.date(2026, 4, 10) and t['extra']['total'] <= 900_000]
    early = apr[0]
    for t in stale + [early]: t['scen'] = 'S06'; t['extra']['no_sweep'] = True
    big = max(stale, key=lambda t: t['extra']['total'])
    cust = big['extra']['cust']
    dep_inc = book.deposit(add_working(big['date'], 2), 'BANK_OP', direct=[('INC_CONS', big['extra']['total'], cust, 'CL_CONS',
                           'Customer cheque deposit')], proc='P01', chains=big['chains'], scen='S06')
    c2 = early['extra']['cust']
    dep_uf = book.deposit(dt.date(2026, 3, 31), 'BANK_OP', direct=[('UF', early['extra']['total'], c2, None, 'Cheque deposit')],
                          proc='P01', chains=[book.chain('P01', c2['Id'])], scen='S06')
    out['S06'] = dict(stale=stale + [early], dep_income=dep_inc, dep_uf=dep_uf, double_counted=big)
    # ---- S07: the same cheque deposit entered twice, two days apart ----------------------------------------------------------
    trn = [c for c in co.cust if c['start'] <= dt.date(2026, 1, 1) and c['retainer'] is None]
    c7 = trn[int(rng.integers(0, len(trn)))]
    ch = book.chain('P02', c7['Id'])
    d1 = book.deposit(dt.date(2026, 2, 9), 'BANK_OP', direct=[('INC_TRN', cents(2_340), c7, 'CL_TRN', 'Workshop fees - cheque')], proc='P02', chains=[ch])
    d2 = book.deposit(dt.date(2026, 2, 11), 'BANK_OP', direct=[('INC_TRN', cents(2_340), c7, 'CL_TRN', 'Workshop fees - cheque')], proc='P02',
                      chains=[ch], scen='S07')
    d1['scen'] = 'S07'
    out['S07'] = dict(first=d1, second=d2)
    # ---- S08: cash out and cash in with no counterparty -----------------------------------------------------------------------
    p8 = book.purchase(dt.date(2024, 9, 17), 'Cash', 'BANK_OP', None, [('EX_OFF', cents(186.40), 'CL_OH', 'Office supplies - paid in cash')],
                       'P05', book.chain('P05'), scen='S08')
    dp8 = book.deposit(dt.date(2025, 3, 21), 'BANK_OP', direct=[('EX_TRV', cents(640), None, 'CL_OH', 'Refund - cancelled conference')],
                       proc='P05', chains=[book.chain('P05')], scen='S08')
    out['S08'] = [p8, dp8]
    return out, {dt.date(2026, 3, 31)}


def mark_uncleared(book):
    """S18: two cheques and one deposit never clear (in addition to the natural float at period end)."""
    cheques = [t for t in book.txns if (t['type'] == 'Purchase' and t['obj']['PaymentType'] == 'Check' and t['obj']['AccountRef']['name'] ==
                                        'Operating Checking') or (t['type'] == 'BillPayment' and t['obj']['PayType'] == 'Check')]
    aug = sorted([t for t in cheques if dt.date(2026, 8, 10) <= t['date'] <= dt.date(2026, 8, 21) and t['scen'] is None],
                 key=lambda t: (t['date'], t['k']))[0]
    octo = sorted([t for t in cheques if dt.date(2026, 10, 1) <= t['date'] <= dt.date(2026, 10, 16) and t['scen'] is None
                   and t['obj'].get('EntityRef', t['obj'].get('VendorRef', {})).get('name') != 'Jordan Avery (Owner)'],
                  key=lambda t: (t['date'], t['k']))[-1]
    deps = sorted([t for t in book.txns if t['type'] == 'Deposit' and t['extra'].get('linked') and dt.date(2026, 10, 26) <= t['date'] <=
                   dt.date(2026, 10, 30) and t['scen'] is None], key=lambda t: (t['date'], t['k']))
    dep = deps[0]
    for t in (aug, octo, dep):
        t['scen'] = 'S18'; t['extra']['never_clear'] = True
    return [aug, octo, dep]

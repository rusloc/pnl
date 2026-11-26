"""Opening position, P09 asset purchase + depreciation, P10 disposal, P11 term loans, P13 owner activity.
Scenarios planted here: S02 (asset bought on finance), S04 (loan payment posted whole), S13 (bill payment covering an
equipment bill and an expense bill)."""
import datetime as dt

import config as C
from util import cents, months, next_working, month_end

TD = dt.timedelta


def amortise(principal_c, rate, n, first):
    """[(date, payment, interest, principal)] in cents, monthly on the day of `first`."""
    r = rate / 12
    pay = int(round(principal_c * r / (1 - (1 + r) ** -n)))
    bal, out = principal_c, []
    for k in range(n):
        y, m = first.year + (first.month - 1 + k) // 12, (first.month - 1 + k) % 12 + 1
        i = int(round(bal * r)); p = min(pay - i, bal)
        out.append((dt.date(y, m, first.day), p + i, i, p)); bal -= p
    return out


def opening(book, co):
    O = C.OPENING
    lines = [(code, cents(v), None, None, 'Opening balance') for code, v in O.items() if v != 0]
    lines.append(('EQ_RE', -sum(x[1] for x in lines), None, None, 'Opening balance'))
    return book.journal(C.OPENING_DATE, lines, 'OPENING', doc='OB-2023', memo='Opening balances as of 2023-12-31 (conversion)')


def run(book, co):
    V = co.vend
    out = {}
    # ---- S13: equipment bill + the month's IT support bill, settled by one bill payment ---------------------------------
    cb = C.CAPEX_BILL
    ch1 = book.chain('P04', V['V_ITS']['Id']); ch2 = book.chain('P09', V['V_ITS']['Id'])
    sup = book.bill(dt.date(2024, 6, 3), V['V_ITS'], [('EX_ITS', cents(cb['support']), 'CL_OH', 'Managed IT support')], dt.date(2024, 7, 3),
                    'P04', ch1, doc='CR-202406')
    eq = book.bill(cb['date'], V['V_ITS'], [('FA_EQ_COST', cents(cb['equipment']), 'CL_OH', 'Server, storage and network refresh')],
                   cb['date'] + TD(days=30), 'P09', ch2, doc='CR-EQ-2406', scen='S13')
    bp = book.bill_payment(dt.date(2024, 7, 2), V['V_ITS'], 'BANK_OP', [(sup, sup['extra']['total']), (eq, eq['extra']['total'])], 'P09',
                           [ch1, ch2], memo='June support and equipment', scen='S13')
    out['S13'] = dict(bills=[sup, eq], payment=bp)
    # ---- capex 2: laptop refresh paid by cheque --------------------------------------------------------------------------
    cc = C.CAPEX_CHECK
    out['capex2'] = book.purchase(cc['date'], 'Check', 'BANK_OP', V['V_ITS'], [('FA_EQ_COST', cents(cc['amount']), 'CL_OH',
                                  'Laptop refresh, 12 units')], 'P09', book.chain('P09', V['V_ITS']['Id']))
    # ---- S02: van bought on finance (no cash), then monthly loan payments -----------------------------------------------
    fv = C.FINANCED_VEHICLE
    ch = book.chain('P09', V['V_VEHFIN']['Id'])
    out['S02'] = book.journal(fv['date'], [('FA_VH_COST', cents(fv['amount']), V['V_VEHFIN'], 'CL_OH', '2025 service van'),
                                           ('LTL_VEH', -cents(fv['amount']), V['V_VEHFIN'], None, 'Vehicle loan drawn at purchase')],
                              'P09', ch, doc='VEH-2025', memo='Service van financed by the dealer lender', scen='S02')
    for d, pay, i, p in amortise(cents(fv['amount']), fv['rate'], fv['months'], dt.date(2025, 6, 12)):
        d = next_working(d)
        if d > C.END: break
        book.purchase(d, 'Cash', 'BANK_OP', V['V_VEHFIN'], [('LTL_VEH', p, None, 'Principal'), ('EX_INT', i, 'CL_OH', 'Interest')], 'P11', ch)
    # ---- depreciation (P09), month end -----------------------------------------------------------------------------------
    assets = [  # account group, cost cents, monthly cents, first month, last month
        ('EQ', cents(24_000), 40_000, (2024, 1), (2026, 12)), ('EQ', cents(cb['equipment']), 78_000, (2024, 7), (2029, 6)),
        ('EQ', cents(cc['amount']), 78_889, (2026, 3), (2029, 2)), ('VH', cents(32_000), 53_333, (2024, 1), (2025, 4)),
        ('VH', cents(fv['amount']), 69_167, (2025, 6), (2030, 5))]
    old_van_ad = cents(-C.OPENING['FA_VH_AD'])
    for y, m in months(C.START, C.END):
        eqd = sum(a[2] for a in assets if a[0] == 'EQ' and a[3] <= (y, m) <= a[4])
        vhd = sum(a[2] for a in assets if a[0] == 'VH' and a[3] <= (y, m) <= a[4])
        if (2024, 1) <= (y, m) <= (2025, 4): old_van_ad += 53_333
        book.journal(month_end(y, m), [('OX_DEPR', eqd + vhd, None, 'CL_OH', 'Depreciation'),
                                       ('FA_EQ_AD', -eqd, None, None, 'Office equipment'), ('FA_VH_AD', -vhd, None, None, 'Vehicles')],
                     'P09', doc=f'DEP-{y}{m:02d}', memo=f'Depreciation {dt.date(y, m, 1):%b %Y}', adjustment=True)
    # ---- disposal of the old van (P10) -------------------------------------------------------------------------------------
    ds = C.DISPOSAL
    ch = book.chain('P10', V['V_AUTO']['Id'])
    out['disposal_dep'] = book.deposit(ds['date'], 'BANK_OP', direct=[('FA_VH_COST', cents(ds['proceeds']), V['V_AUTO'], 'CL_OH',
                                       'Sale of 2019 cargo van')], proc='P10', chains=[ch])
    cost = cents(32_000); proceeds = cents(ds['proceeds'])
    gain = proceeds - (cost - old_van_ad)
    out['disposal_je'] = book.journal(ds['date'], [('FA_VH_AD', old_van_ad, None, None, 'Remove accumulated depreciation, 2019 van'),
                                                   ('FA_VH_COST', -(cost - proceeds), None, None, 'Remove remaining cost, 2019 van'),
                                                   ('OI_GAIN', -gain, None, 'CL_OH', 'Gain on sale of 2019 van')],
                                      'P10', ch, doc='DISP-2025', memo='Disposal of the 2019 cargo van')
    # ---- term loan (P11): proceeds, then monthly principal + interest; S04 posts one instalment whole -----------------------
    tl = C.TERM_LOAN
    ch = book.chain('P11', V['V_BANK']['Id'])
    book.deposit(tl['start'], 'BANK_OP', direct=[('LTL_TERM', cents(tl['principal']), V['V_BANK'], None, 'Term loan proceeds')],
                 proc='P11', chains=[ch], memo='Term loan funded')
    for d, pay, i, p in amortise(cents(tl['principal']), tl['rate'], tl['months'], tl['first_payment']):
        d = next_working(d)
        if d > C.END: break
        if d.year == 2025 and d.month == 8:
            out['S04'] = book.purchase(d, 'Cash', 'BANK_OP', V['V_BANK'], [('LTL_TERM', pay, None, 'Loan payment')], 'P11', ch, scen='S04',
                                       memo='Term loan instalment')
            out['S04_split'] = (pay, i, p)
        else:
            book.purchase(d, 'Cash', 'BANK_OP', V['V_BANK'], [('LTL_TERM', p, None, 'Principal'), ('EX_INT', i, 'CL_OH', 'Interest')], 'P11', ch,
                          memo='Term loan instalment')
    # ---- owner (P13): one contribution, quarterly draws -------------------------------------------------------------------
    ow = C.OWNER_CONTRIBUTION
    book.deposit(ow['date'], 'BANK_OP', direct=[('EQ_INV', cents(ow['amount']), V['V_OWNER'], None, 'Owner capital contribution')],
                 proc='P13', chains=[book.chain('P13', V['V_OWNER']['Id'])])
    for y, m in months(C.START, C.END):
        if m not in (1, 4, 7, 10): continue
        d = next_working(dt.date(y, m, 10))
        if d > C.END: break
        book.purchase(d, 'Check', 'BANK_OP', V['V_OWNER'], [('EQ_DRAW', cents(C.OWNER_DRAW_QUARTERLY[y]), None, 'Quarterly owner draw')],
                      'P13', book.chain('P13', V['V_OWNER']['Id']))
    return out

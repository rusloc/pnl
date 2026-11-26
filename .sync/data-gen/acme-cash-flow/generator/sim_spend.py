"""P04 credit purchase, P05 direct expense, P06 card spending, P07 payroll, P08 sales tax, plus the payroll-funding
transfers and prepaid / accrual JEs of P14 (generator spec section 5, realism rules section 8)."""
import datetime as dt
import numpy as np

import config as C
from util import stream, cents, months, working_days, next_working, prev_working, month_end, is_working, days

TD = dt.timedelta
CARD_SCALE = 1.15           # card spend grows with revenue; tuned to about 30 % of non-payroll expenses (config CARD_SHARE)
CARD_VENDOR = 'V_SUB4'      # one small subcontractor is always paid by card (BillPayment PayType CreditCard)


def thursday_run(bill_date, due):
    """Weekly pay run on Thursdays, 3 days before due; never before the day after the bill."""
    d = prev_working(due - TD(days=3))
    while d.weekday() != 3 or not is_working(d):
        d -= TD(days=1)
    lo = bill_date + TD(days=1)
    if d < lo:
        d = lo
        while d.weekday() != 3 or not is_working(d): d += TD(days=1)
    return d


def bills(book, co, plan, skip_its=()):
    rng = stream('bills')
    V = co.vend; out = []
    share = rng.dirichlet(np.ones(len(co.sub_codes)) * 2.0)
    for y, m in months(dt.date(2023, 12, 1), C.END):
        wd = working_days(y, m)
        prev = plan.get((y, m - 1) if m > 1 else (y - 1, 12), plan[(2023, 11)])
        for j, code in enumerate(co.sub_codes):
            if rng.random() > 0.85: continue
            amt = cents(prev * 0.17 * share[j] * np.exp(rng.normal(0, 0.12)))
            d = wd[int(rng.integers(2, 7))]
            cl = 'CL_CONS' if rng.random() < 0.8 else 'CL_MS'
            out.append(dict(vend=code, date=d, lines=[('COGS_SUB', amt, cl, f'Subcontracted delivery - {dt.date(y, m, 1) - TD(days=1):%b %Y}')],
                            doc=f'INV-{int(rng.integers(10000, 99999))}'))
        if (y, m) not in skip_its:
            out.append(dict(vend='V_ITS', date=wd[0], lines=[('EX_ITS', cents(1_850 if y < 2026 else 1_950), 'CL_OH', 'Managed IT support')],
                            doc=f'CR-{y}{m:02d}'))
        out.append(dict(vend='V_TELCO', date=wd[1], lines=[('EX_UTIL_PH', cents(640 * np.exp(rng.normal(0, 0.03))), 'CL_OH', 'Fiber and phone lines')],
                        doc=f'CF{y}{m:02d}{int(rng.integers(100, 999))}'))
        out.append(dict(vend='V_MKTG', date=wd[-3], lines=[('EX_MKT', cents(float(np.round(rng.uniform(1_200, 2_600), -1))), 'CL_OH',
                                                             'Content and campaign support')], doc=f'BSC-{y}{m:02d}'))
        if m in (1, 4, 7, 10):
            out.append(dict(vend='V_CPA', date=wd[4], lines=[('EX_PRO', cents(2_400), 'CL_OH', 'Quarterly bookkeeping review')], doc=f'MP-{y}Q{(m + 2) // 3}'))
        if m == 3:
            out.append(dict(vend='V_CPA', date=wd[8], lines=[('EX_PRO', cents(6_500), 'CL_OH', f'{y - 1} tax return and year-end close')],
                            doc=f'MP-{y}-TAX'))
    keep = []
    for b in sorted(out, key=lambda b: (b['date'], b['vend'])):
        v = V[b['vend']]
        b['due'] = b['date'] + TD(days=v['terms'] or 15)
        b['run'] = thursday_run(b['date'], b['due'])
        if b['date'] < C.START and b['run'] < C.START: continue      # paid before the opening date: not in the data
        ch = book.chain('P04', v['Id'])
        b['t'] = book.bill(b['date'], v, b['lines'], b['due'], 'P04', ch, doc=b['doc'])
        keep.append(b)
    # vendor credits: a few rework credits from subcontractors, applied on the next payment run
    vcs = []
    for y in (2024, 2025, 2026):
        subs = [b for b in keep if b['vend'].startswith('V_SUB') and b['date'].year == y and b['date'].month <= 9]
        for b in rng.choice(len(subs), size=4 if y < 2026 else 3, replace=False):
            b = subs[int(b)]; v = V[b['vend']]
            amt = cents(b['t']['extra']['total'] / 100 * float(rng.uniform(0.05, 0.1)))
            d = next_working(b['date'] + TD(days=int(rng.integers(8, 20))))
            vc = book.vendor_credit(d, v, [('COGS_SUB', amt, 'CL_CONS', 'Rework credit')], 'P04', b['t']['chains'][0], doc=f'CR-{b["doc"]}')
            vcs.append(dict(vend=b['vend'], date=d, t=vc, left=amt))
    # payment runs: one BillPayment per vendor per run; the card vendor is paid by card
    runs = {}
    for b in keep:
        if b['run'] <= C.END and not b.get('manual'): runs.setdefault((b['run'], b['vend']), []).append(b)
    for (d, vc_), bs in sorted(runs.items()):
        v = V[vc_]
        applied = [(b['t'], b['t']['extra']['total']) for b in bs]
        tot = sum(a for _, a in applied)
        for c in vcs:
            if c['vend'] == vc_ and c['left'] > 0 and c['date'] <= d and c['left'] < tot:
                applied.append((c['t'], c['left'])); tot -= c['left']; c['left'] = 0
        card = vc_ == CARD_VENDOR
        chains = sorted({ch for t, _ in applied for ch in t['chains']})
        book.bill_payment(d, v, 'CC' if card else 'BANK_OP', applied, 'P04', chains, card=card)
    return keep


def direct_and_card(book, co):
    rng = stream('expenses')
    V = co.vend
    for y, m in months(C.START, C.END):
        wd = working_days(y, m); first = dt.date(y, m, 1)
        ch = book.chain('P05', V['V_LANDLORD']['Id'])
        book.purchase(first, 'Check', 'BANK_OP', V['V_LANDLORD'], [('EX_RENT', cents({2024: 6_500, 2025: 6_800, 2026: 7_100}[y]), 'CL_OH',
                      f'Office rent {first:%B %Y}')], 'P05', ch)
        el = 470 * (1 + 0.18 * np.cos((m - 7) / 12 * 2 * np.pi)) * np.exp(rng.normal(0, 0.05))
        book.purchase(next_working(dt.date(y, m, 5)), 'Cash', 'BANK_OP', V['V_POWER'], [('EX_UTIL_EL', cents(el), 'CL_OH', 'Electricity')],
                      'P05', book.chain('P05', V['V_POWER']['Id']))
        nemp = sum(1 for e in co.emp if e['hire'] <= first and (e['term'] is None or e['term'] >= first))
        book.purchase(wd[1], 'Cash', 'BANK_OP', V['V_PAYROLL'], [('EX_PFEE', cents(95 + 12 * nemp), 'CL_OH', 'Payroll service fee')],
                      'P05', book.chain('P05', V['V_PAYROLL']['Id']))
        book.purchase(wd[-1], 'Cash', 'BANK_OP', V['V_BANK'], [('EX_BANK', cents(float(rng.uniform(28, 65))), 'CL_OH', 'Monthly service charge')],
                      'P05', book.chain('P05', V['V_BANK']['Id']))
        if m == 1:
            prem = {2024: 10_800, 2025: 11_400, 2026: 12_120}[y]
            book.purchase(wd[6], 'Check', 'BANK_OP', V['V_INSURE'], [('PREPAID', cents(prem), 'CL_OH', 'Annual business insurance premium')],
                          'P05', book.chain('P05', V['V_INSURE']['Id']))
        if y >= 2024:     # prepaid amortisation (P14), month end
            prem = {2024: 10_800, 2025: 11_400, 2026: 12_120}[y]
            book.journal(month_end(y, m), [('EX_INS', cents(prem / 12), None, 'CL_OH', 'Insurance expense'),
                                           ('PREPAID', -cents(prem / 12), None, 'CL_OH', 'Release of prepaid insurance')],
                         'P14', doc=f'ADJ-{y}{m:02d}-INS', memo='Monthly prepaid insurance release', adjustment=True)
        if m == 4:
            book.purchase(wd[10], 'Cash', 'BANK_OP', V['V_STATEFEE'], [('EX_TAXLIC', cents(800), 'CL_OH', 'Annual LLC report fee')],
                          'P05', book.chain('P05', V['V_STATEFEE']['Id']))
        if rng.random() < 0.25:
            book.purchase(wd[int(rng.integers(0, len(wd)))], 'Check', 'BANK_OP', V['M_FIX'], [('EX_RM', cents(float(rng.uniform(180, 900))),
                          'CL_OH', 'Office repairs')], 'P05', book.chain('P05', V['M_FIX']['Id']))
    # year-end accrual of the tax-return fee and its reversal (P14)
    for y in (2024, 2025):
        ch = book.chain('P14')
        book.journal(dt.date(y, 12, 31), [('EX_PRO', cents(6_500), None, 'CL_OH', 'Accrued tax return fee'),
                                         ('ACCR', -cents(6_500), None, 'CL_OH', 'Accrued tax return fee')], 'P14', ch, doc=f'ACC-{y}12', adjustment=True)
        book.journal(dt.date(y + 1, 1, 1), [('ACCR', cents(6_500), None, 'CL_OH', 'Reverse accrual'),
                                           ('EX_PRO', -cents(6_500), None, 'CL_OH', 'Reverse accrual')], 'P14', ch, doc=f'REV-{y}12', adjustment=True)
    # ---- card spending (P06): many small purchases; statement closes on the 25th, paid on the 12th --------------------------
    stmts = {}
    for y, m in months(C.START, C.END):
        close = dt.date(y, m, 25)
        stmts[(y, m)] = book.chain('P06', V['V_CARDISS']['Id'])
        for code, (_nm, acct, n, med) in C.CARD_MERCHANTS.items():
            k = n if n <= 1 else int(rng.poisson(n))
            for _ in range(k):
                dd = dt.date(y, m, int(rng.integers(1, month_end(y, m).day + 1)))
                amt = med * CARD_SCALE * (1 + C.GROWTH) ** (y - 2024) * (np.exp(rng.normal(0, 0.06)) if n <= 1 else np.exp(rng.normal(0, 0.55)))
                key = (y, m) if dd <= close else ((y, m + 1) if m < 12 else (y + 1, 1))
                ch = stmts.get(key) or stmts.setdefault(key, book.chain('P06', V['V_CARDISS']['Id']))
                cl = 'CL_CONS' if acct == 'COGS_SW' else 'CL_OH'
                book.purchase(dd, 'CreditCard', 'CC', V[code], [(acct, cents(amt), cl, None)], 'P06', ch)
        if rng.random() < 0.07:
            dd = dt.date(y, m, int(rng.integers(1, 26)))
            book.purchase(dd, 'CreditCard', 'CC', V['M_AIR'], [('EX_TRV', cents(float(rng.uniform(180, 520))), 'CL_OH', 'Fare refund')],
                          'P06', stmts[(y, m)], credit=True)
    return stmts


def card_payments(book, co, stmts, postings):
    """Pay each statement on the 12th of the next month (autopay of the statement balance).
    postings: [(date, cents debit-positive)] on the card account, opening balance included, card payments excluded."""
    V = co.vend
    paid, first = 0, True
    for y, m in months(dt.date(2023, 12, 1), C.END):
        close = C.OPENING_DATE if first else dt.date(y, m, 25)
        first = False
        pay = next_working(dt.date(y + (m == 12), m % 12 + 1, 12))
        if pay > C.END: break
        owed = -sum(a for d, a in postings if d <= close) - paid
        ch = stmts.get((y, m)) or book.chain('P06', V['V_CARDISS']['Id'])
        if owed > 0:
            book.cc_payment(pay, 'CC', 'BANK_OP', owed, V['V_CARDISS'], 'P06', ch, memo=f'Card statement {close:%d %b %Y}')
            paid += owed


def payroll(book, co):
    rng = stream('payroll')
    V = co.vend
    cls = ['CL_CONS', 'CL_CONS', 'CL_CONS', 'CL_CONS', 'CL_MS', 'CL_TRN', 'CL_CONS', 'CL_MS', 'CL_CONS']
    pay = dt.date(2024, 1, 12)
    st_acc = {}                                         # month -> state liability accrued
    fed_open, st_open = cents(-C.OPENING['PL_FED']), cents(-C.OPENING['PL_ST'])
    ch0 = book.chain('P07', V['V_FEDTAX']['Id'])
    d0 = dt.date(2024, 1, 3)
    book.transfer(d0, 'BANK_OP', 'BANK_PR', fed_open, 'P14', ch0, memo='Fund payroll tax deposit')
    book.purchase(d0, 'Cash', 'BANK_PR', V['V_FEDTAX'], [('PL_FED', fed_open, None, 'Federal payroll tax deposit, Dec 2023')], 'P07', ch0)
    st_acc[(2023, 12)] = st_open
    while pay <= C.END:
        pd_ = prev_working(pay)
        lines, net, fed, st, er = [], 0, 0, 0, 0
        for i, e in enumerate(co.emp):
            if e['hire'] > pd_ or (e['term'] is not None and pd_ > e['term'] + TD(days=13)): continue
            g = cents(e['salary'] * 1.03 ** max(0, pd_.year - 2024) / 26)
            fw, ss, sw = int(round(g * 0.14)), int(round(g * 0.0765)), int(round(g * 0.045))
            ef, es = int(round(g * 0.0765)), int(round(g * 0.012))
            lines.append(('EX_WAGES', g, e, cls[i], 'Gross wages'))
            net += g - fw - ss - sw; fed += fw + ss + ef; st += sw + es; er += ef + es
        ch = book.chain('P07', V['V_PAYROLL']['Id'])
        lines += [('EX_PTAX', er, None, 'CL_OH', 'Employer payroll taxes'), ('PL_FED', -fed, None, None, 'Federal withholding and FICA'),
                  ('PL_ST', -st, None, None, 'State withholding and unemployment'), ('BANK_PR', -net, V['V_PAYROLL'], None, 'Net pay')]
        fund = prev_working(pd_ - TD(days=1))
        book.transfer(fund, 'BANK_OP', 'BANK_PR', net + fed, 'P14', ch, memo='Fund payroll')
        book.journal(pd_, lines, 'P07', ch, doc=f'PR-{pd_:%Y%m%d}', memo=f'Payroll run, pay date {pd_:%Y-%m-%d}')
        fd = next_working(pd_ + TD(days=5))
        if fd <= C.END:
            book.purchase(fd, 'Cash', 'BANK_PR', V['V_FEDTAX'], [('PL_FED', fed, None, 'Federal payroll tax deposit')], 'P07', ch)
        st_acc[(pd_.year, pd_.month)] = st_acc.get((pd_.year, pd_.month), 0) + st
        pay += TD(days=14)
    for y, m in months(C.START, C.END):
        prev = (y, m - 1) if m > 1 else (y - 1, 12)
        amt = st_acc.get(prev, 0)
        if amt <= 0: continue
        d = next_working(dt.date(y, m, 15))
        ch = book.chain('P07', V['V_STTAX']['Id'])
        book.transfer(d, 'BANK_OP', 'BANK_PR', amt, 'P14', ch, memo='Fund state payroll tax')
        book.purchase(d, 'Cash', 'BANK_PR', V['V_STTAX'], [('PL_ST', amt, None, f'State payroll taxes {dt.date(*prev, 1):%b %Y}')], 'P07', ch)


def sales_tax(book, co):
    """Quarterly remittance of the tax accrued on sales (P08), on the 20th of the month after the quarter."""
    V = co.vend
    sign = {'Invoice': 1, 'SalesReceipt': 1, 'CreditMemo': -1, 'RefundReceipt': -1}
    acc = cents(-C.OPENING['STP'])
    events = sorted(((t['date'], sign[t['type']] * t['extra'].get('tax', 0)) for t in book.txns if t['type'] in sign), key=lambda x: x[0])
    for y, m in months(C.START, C.END):
        if m not in (1, 4, 7, 10): continue
        qend = dt.date(y, m, 1) - TD(days=1)
        due = acc + sum(a for dd, a in events if dd <= qend)
        d = next_working(dt.date(y, m, 20))
        if d > C.END: break
        ch = book.chain('P08', V['V_SALESTAX']['Id'])
        book.purchase(d, 'Cash', 'BANK_OP', V['V_SALESTAX'], [('STP', due, None, f'Sales tax return Q{(qend.month + 2) // 3} {qend.year}')], 'P08', ch)
        acc -= due

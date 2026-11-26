"""P01 credit sale, P02 cash sale, P03 customer credit and refund (generator spec section 5, realism rules section 8).

Invoices of Nov-Dec 2023 that are still open on 2023-12-31 form the opening A/R (they stay in the data; earlier, already
paid ones are not generated). Payments go to Operating Checking (ACH payers) or to Undeposited Funds (cheque payers);
Undeposited Funds is swept later by sim_capital.sweep_deposits().
"""
import datetime as dt
import numpy as np

import config as C
from util import stream, cents, months, working_days, next_working, month_end

TD = dt.timedelta


def revenue_plan():
    rng = stream('revenue_plan')
    ws = sum(C.SEASON)
    plan = {}
    for y, m in months(C.PRESPAN_START, C.END):
        annual = C.REVENUE_Y1 * (1 + C.GROWTH) ** (y - 2024)
        plan[(y, m)] = annual * C.SEASON[m - 1] / ws * (1 + rng.uniform(-C.NOISE, C.NOISE))
    return plan


def active(c, d):
    return c['start'] <= d and (c['end'] is None or d < c['end'])


def _late_days(rng, chronic):
    if chronic: return int(round(np.exp(rng.normal(np.log(28), 0.5))))
    if rng.random() < 0.15: return -int(rng.integers(0, 6))
    return int(round(np.exp(rng.normal(np.log(C.LATE_MEDIAN_DAYS), 0.8))))


def run(book, co, plan):
    rng = stream('sales')
    custs = co.cust
    rate = {i: float(rng.choice([150, 165, 175, 185, 195])) for i in range(len(custs))}
    specs = []                                     # invoice specs before emission
    ret_total = {}
    for y, m in months(C.PRESPAN_START, C.END):
        wd = working_days(y, m); m0 = dt.date(y, m, 1)
        tot = plan[(y, m)]
        # retainers on the first working day; fee rises 5 % each January
        ret = 0.0
        for i, c in enumerate(custs):
            if c['retainer'] and (c['start'] <= C.PRESPAN_START or c['start'] < m0) and (c['end'] is None or m0 < c['end']):
                fee = round(c['retainer'] * 1.05 ** max(0, y - 2024), -1)
                specs.append(dict(cust=i, date=wd[0], lines=[('IT_RET', cents(fee), 1, f'Managed services - {m0:%b %Y}')], kind='retainer'))
                ret += fee
        ret_total[(y, m)] = ret
        trn = tot * C.STREAM_SHARE['training']
        cons = max(tot - ret - trn, tot * 0.3)
        # training: corporate invoices (65 %) and card-paid seats as sales receipts (35 %)
        small = [i for i, c in enumerate(custs) if active(c, m0) and c['weight'] < np.quantile([x['weight'] for x in custs], 0.6)]
        for share, kind in ((0.65, 'training'), (0.35, 'receipt')):
            target = trn * share; price = float(rng.choice([395, 425, 450, 495]))
            n = max(1, int(rng.poisson(4 if kind == 'training' else 3)))
            raw = np.exp(rng.normal(0, 0.5, n)); raw = raw / raw.sum() * target
            for a in raw:
                seats = max(1, int(round(a / price)))
                lines = [('IT_SEAT', cents(seats * price), seats, 'Workshop seats')]
                if kind == 'training' and rng.random() < 0.4: lines.append(('IT_MAT', cents(seats * 35), seats, 'Course materials'))
                specs.append(dict(cust=int(rng.choice(small)), date=wd[int(rng.integers(0, len(wd)))], lines=lines, kind=kind))
        # consulting: long-tail customers, skewed amounts, 1-3 lines
        act = [i for i, c in enumerate(custs) if active(c, m0)]
        w = np.array([custs[i]['weight'] for i in act]); w = w / w.sum()
        n = int(rng.poisson(20 * (1 + C.GROWTH) ** max(0, y - 2024)))
        raw = np.exp(rng.normal(0, 0.8, n)); raw = raw / raw.sum() * cons
        for a in raw:
            i = int(act[int(rng.choice(len(act), p=w))])
            d = wd[int(rng.integers(0, len(wd)))]
            if not active(custs[i], d): d = max(d, custs[i]['start'])
            if d > month_end(y, m) or not active(custs[i], d): continue
            lines, left = [], a
            if a > 4_000 and rng.random() < 0.45:
                ms = round(a * rng.uniform(0.4, 0.7) / 50) * 50
                lines.append(('IT_MILE', cents(ms), 1, 'Project milestone')); left -= ms
            hrs = max(1.0, round(left / rate[i] * 4) / 4)
            lines.insert(0, ('IT_HOURS', cents(hrs * rate[i]), hrs, f'Consulting hours, {d:%b %Y}'))
            specs.append(dict(cust=i, date=d, lines=lines, kind='consulting'))
    specs.sort(key=lambda s: (s['date'], s['cust'], s['kind']))
    # cheque payers (their payments land in Undeposited Funds): customers in random order until they hold about 40 % of invoices
    n_inv = np.bincount([s['cust'] for s in specs if s['kind'] != 'receipt' and s['date'] >= C.START], minlength=len(custs))
    for c in custs: c['pays_check'] = False
    acc_ = 0
    for i in rng.permutation(len(custs)):
        if acc_ >= C.UF_SHARE * n_inv.sum(): break
        custs[int(i)]['pays_check'] = True; acc_ += n_inv[int(i)]
    # ---- settlement plan per invoice ---------------------------------------------------------------------------------
    events = []                                    # (cust, date, spec idx, kind, share)
    for j, s in enumerate(specs):
        c = custs[s['cust']]
        if s['kind'] == 'receipt': continue
        tdays = co.terms[c['terms']]['DueDays']
        s['due'] = s['date'] + TD(days=tdays); s['terms'] = c['terms']
        gross = sum(x[1] for x in s['lines'])
        s['gross'] = gross
        r = rng.random()
        if r < C.WRITE_OFF_SHARE and s['kind'] == 'consulting':
            s['writeoff'] = s['due'] + TD(days=120); continue
        if r > 0.98:
            s['credit'] = dict(date=s['date'] + TD(days=int(rng.integers(5, 21))), pct=float(rng.uniform(0.1, 0.2)))
        pay = next_working(s['due'] + TD(days=_late_days(rng, c['chronic'])))
        pay = max(pay, s['date'] + TD(days=1))
        if gross > 600_000 and rng.random() < 0.06:
            p1 = float(rng.uniform(0.5, 0.7))
            events.append((s['cust'], pay, j, 'part', p1))
            events.append((s['cust'], next_working(pay + TD(days=int(rng.integers(14, 36)))), j, 'rest', 1 - p1))
        else:
            events.append((s['cust'], pay, j, 'full', 1.0))
    # pre-span invoices exist only if still open on the opening date
    first_pay = {}
    for cu, dte, j, k, sh in events: first_pay[j] = min(first_pay.get(j, dte), dte)
    keep = [j for j, s in enumerate(specs) if s['date'] >= C.START or (s['kind'] != 'receipt' and first_pay.get(j, C.END) >= C.START
                                                                     and 'writeoff' not in s and 'credit' not in s)]
    keep_set = set(keep)
    # ---- emit invoices, credit memos, sales receipts --------------------------------------------------------------------
    inv = {}
    uf_items = []
    tr = C.SALES_TAX_RATE
    for j in keep:
        s = specs[j]; c = custs[s['cust']]
        if s['kind'] == 'receipt':
            ch = book.chain('P02', c['Id'])
            t = book.sales_receipt(s['date'], c, s['lines'], 'UF', 'P02', ch, tax_rate=tr)
            uf_items.append(t); continue
        ch = book.chain('P01', c['Id'])
        t = book.invoice(s['date'], c, s['lines'], s['due'], s['terms'], 'P01', ch, tax_rate=tr if s['kind'] == 'training' else 0.0)
        inv[j] = t
        if 'credit' in s and s['credit']['date'] <= C.END:
            amt = cents(s['gross'] / 100 * s['credit']['pct'] / 5) * 5
            it = s['lines'][0][0]
            cm = book.credit_memo(s['credit']['date'], c, [(it, amt, 1, 'Service credit - scope adjustment')], 'P03', ch,
                                  tax_rate=tr if s['kind'] == 'training' else 0.0)
            s['cm'] = cm
        if 'writeoff' in s and s['writeoff'] <= C.END:
            d = next_working(s['writeoff'])
            cm = book.credit_memo(d, c, [('IT_BAD', t['extra']['total'], 1, 'Write-off of uncollectible balance')], 'P03', ch,
                                  memo='Bad debt write-off')
            book.payment(d, c, 'UF', [(t, t['extra']['total']), (cm, t['extra']['total'])], 'P03', [ch], method='PM_CHECK',
                         memo='Apply write-off credit')
    # ---- payments: combine a customer's events (cheque payers within 6 days, ACH on the same day) -----------------------
    ev = sorted([e for e in events if e[2] in keep_set and e[1] <= C.END], key=lambda e: (e[0], e[1], e[2]))
    groups, cur = [], []
    for e in ev:
        win = 6 if custs[e[0]]['pays_check'] else 0
        if cur and cur[-1][0] == e[0] and (e[1] - cur[0][1]).days <= win:
            cur.append(e)
        else:
            if cur: groups.append(cur)
            cur = [e]
    if cur: groups.append(cur)
    paid = {}
    for g in sorted(groups, key=lambda g: (max(x[1] for x in g), g[0][0])):
        cu = g[0][0]; c = custs[cu]; d = max(x[1] for x in g)
        applied, chains = [], []
        for _, _, j, k, sh in g:
            t = inv[j]; tot = t['extra']['total']
            cm = specs[j].get('cm')
            a = tot - paid.get(j, 0) if k == 'rest' else tot if k == 'full' else int(round(tot * sh))
            applied.append((t, a)); paid[j] = paid.get(j, 0) + a; chains.extend(t['chains'])
            if cm is not None and k in ('full', 'part') and cm['date'] <= d:
                applied.append((cm, cm['extra']['total']))
                specs[j]['cm_applied'] = True
        to = 'UF' if c['pays_check'] else 'BANK_OP'
        method = 'PM_CHECK' if c['pays_check'] else 'PM_ACH'
        ref_num = str(int(rng.integers(1000, 9999))) if c['pays_check'] else None
        p = book.payment(d, c, to, applied, 'P01', sorted(set(chains)), method=method, ref_num=ref_num)
        if to == 'UF': uf_items.append(p)
    # ---- refunds of workshop seats (P03) ---------------------------------------------------------------------------------
    small = [c for c in custs if c['weight'] < np.quantile([x['weight'] for x in custs], 0.6)]
    for y in (2024, 2025, 2026):
        for _ in range(4 if y < 2026 else 3):
            m = int(rng.integers(1, 11)); wd = working_days(y, m)
            c = small[int(rng.integers(0, len(small)))]
            ch = book.chain('P03', c['Id'])
            book.refund_receipt(wd[int(rng.integers(0, len(wd)))], c, [('IT_SEAT', cents(float(rng.choice([395, 425, 450]))), 1,
                                'Refund - cancelled workshop seat')], 'BANK_OP', 'P03', ch, tax_rate=tr)
    return uf_items, ret_total

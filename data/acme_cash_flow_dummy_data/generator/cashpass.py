"""Undeposited Funds sweeps (P01/P02 deposits) and the cash constraint (process rule 4): the simulator walks the
Operating Checking balance day by day, draws on the line of credit (P12) when it runs low, repays when it is flush,
sweeps excess cash to savings at quarter end, and books line-of-credit interest and savings interest."""
import datetime as dt
from collections import defaultdict

import config as C
from util import cents, days, is_working, next_working, month_end
from ledger import post

TD = dt.timedelta


def sweep_deposits(book, co, uf_items, forced):
    """Bank runs on Mon / Wed / Fri: every Undeposited Funds item is swept on the first run at least one day after it."""
    pending = sorted([t for t in uf_items if not t['extra'].get('no_sweep')], key=lambda t: (t['date'], t['k']))
    runs = [d for d in days(C.START, C.END) if (is_working(d) and d.weekday() in (0, 2, 4)) or d in forced]
    i, n = 0, 0
    for r in runs:
        batch = []
        while i < len(pending) and (pending[i]['date'] < r or (r in forced and pending[i]['date'] <= r)):
            batch.append(pending[i]); i += 1
        if not batch: continue
        chains = sorted({c for t in batch for c in t['chains']})
        book.deposit(r, 'BANK_OP', linked=batch, proc='P01' if any(t['type'] == 'Payment' for t in batch) else 'P02', chains=chains,
                     memo='Bank deposit')
        n += 1
    return n


def run(book, co):
    V = co.vend
    OP, SV, LOC = co.aid['BANK_OP'], co.aid['BANK_SV'], co.aid['LOC']
    delta = {OP: defaultdict(int), SV: defaultdict(int)}
    for t in book.txns:
        if t['date'] < C.START: continue
        for ln in post(t['type'], t['obj'], co):
            if ln['account_id'] in delta: delta[ln['account_id']][t['date']] += ln['amount']
    bal_op, bal_sv, loc = cents(C.OPENING['BANK_OP']), cents(C.OPENING['BANK_SV']), 0
    loc_days, sv_days = 0, 0
    log = dict(draws=[], repays=[], sweeps=[], min_op=None)
    ch_loc = book.chain('P12', V['V_BANK']['Id'])
    for d in days(C.START, C.END):
        bal_op += delta[OP][d]; bal_sv += delta[SV][d]
        if d.day == 1:
            loc_days = sv_days = 0
        if d == next_working(dt.date(d.year, d.month, 5)) and log.get('loc_int_due'):
            amt = log.pop('loc_int_due')
            book.purchase(d, 'Cash', 'BANK_OP', V['V_BANK'], [('EX_INT', amt, 'CL_OH', 'Line of credit interest')], 'P12', ch_loc,
                          memo='Line of credit interest')
            bal_op -= amt
        if bal_op < cents(C.LOC_DRAW_BELOW):
            draw = -(-(cents(C.LOC_DRAW_TO) - bal_op) // 500_000) * 500_000
            assert loc + draw <= cents(C.LOC_LIMIT), ('line of credit limit', d)
            book.deposit(d, 'BANK_OP', direct=[('LOC', draw, V['V_BANK'], None, 'Line of credit draw')], proc='P12', chains=[ch_loc],
                         memo='Line of credit draw', scen='S01')
            loc += draw; bal_op += draw; log['draws'].append((d, draw))
        elif is_working(d) and loc > 0 and bal_op > cents(C.LOC_REPAY_ABOVE):
            rep = min(loc, (bal_op - cents(C.LOC_REPAY_KEEP)) // 500_000 * 500_000)
            if rep > 0:
                book.purchase(d, 'Cash', 'BANK_OP', V['V_BANK'], [('LOC', rep, None, 'Line of credit repayment')], 'P12', ch_loc,
                              memo='Line of credit repayment', scen='S01')
                loc -= rep; bal_op -= rep; log['repays'].append((d, rep))
        last_wd = max(x for x in days(dt.date(d.year, d.month, 1), month_end(d.year, d.month)) if is_working(x))
        if d.month in (3, 6, 9, 12) and d == last_wd and loc == 0 and bal_op > cents(C.SAVINGS_SWEEP_ABOVE):
            amt = (bal_op - cents(C.SAVINGS_SWEEP_KEEP)) // 500_000 * 500_000
            book.transfer(d, 'BANK_OP', 'BANK_SV', amt, 'P14', memo='Quarter-end transfer to savings')
            bal_op -= amt; bal_sv += amt; log['sweeps'].append((d, amt))
        loc_days += loc; sv_days += bal_sv
        if d == month_end(d.year, d.month):
            n = d.day
            if loc_days:
                log['loc_int_due'] = int(round(loc_days / n * C.LOC_RATE * n / 365))
            si = int(round(sv_days / n * C.SAVINGS_RATE / 12))
            if si > 0:
                book.deposit(d, 'BANK_SV', direct=[('OI_INT', si, V['V_BANK'], None, 'Interest earned')], proc='P14',
                             chains=[book.chain('P14', V['V_BANK']['Id'])], memo='Savings interest')
                bal_sv += si
        log['min_op'] = bal_op if log['min_op'] is None else min(log['min_op'], bal_op)
    log['loc_end'] = loc
    return log

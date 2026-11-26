"""Scenario oracle (generator spec section 7): one expectation record per planted instance - scenario id, the transaction
ids involved, the period and the expected outcome in machine-readable form. Amounts in the records are USD with cents."""
from collections import defaultdict

from util import money


def _ids(ts): return [int(t['Id']) for t in ts]


def records(R, D, ex):
    co, S, cap = R['co'], R['scen'], R['cap']
    txn = {x['txn_id']: x for x in D['txn']}
    rows_by = defaultdict(list)
    for r in D['rows']: rows_by[r['txn_id']].append(r)
    exc = defaultdict(list)
    for e in ex:
        if e['txn_id'] is not None: exc[e['txn_id']].append(e['exception_code'])

    def direct(tid):
        out = defaultdict(int)
        for r in rows_by[tid]:
            if not r['is_internal_transfer']: out[r['direct_line_code']] += r['amount']
        return {k: money(v) for k, v in sorted(out.items())}
    recs = []
    # S01 ----------------------------------------------------------------------------------------------------------------------
    loc = int(co.acc['LOC']['Id'])
    s01 = [t for t in sorted(R['book'].txns, key=lambda t: int(t['Id'])) if t['scen'] == 'S01']
    by_m = defaultdict(int)
    for x in D['led']:
        if x['account_id'] == loc and x['txn_date'].year >= 2024: by_m[x['month_key']] -= x['amount']
    draws = sum(t['extra']['total'] for t in s01 if t['type'] == 'Deposit'); reps = sum(t['extra']['total'] for t in s01 if t['type'] == 'Purchase')
    recs.append(dict(scenario_id='S01', instance=1, period='2024-01..2026-10', txn_ids=_ids(s01), checks=['C04', 'C05'], exception_codes=[],
                     expected=dict(account_id=loc, account_type='Other Current Liability', default_section='OPERATING', override_section='FINANCING',
                                   draws_total=money(draws), repayments_total=money(reps), net_change_total=money(draws - reps),
                                   moved_by_month={k: money(v) for k, v in sorted(by_m.items()) if v},
                                   override_sum_across_sections=0.0, net_change_in_cash_untouched=True,
                                   direct_default_lines=['D_REC_OTHER', 'D_PAY_OTHER'], direct_override_lines=['D_FIN_PROCEEDS', 'D_FIN_REPAID'])))
    # S02 ----------------------------------------------------------------------------------------------------------------------
    t = cap['S02']; tid = int(t['Id']); amt = t['extra']['total']
    recs.append(dict(scenario_id='S02', instance=1, period=txn[tid]['month_key'], txn_ids=[tid], checks=['C07'], exception_codes=['NONCASH_CROSS_SECTION'],
                     expected=dict(indirect={'INVESTING': -money(amt), 'FINANCING': money(amt)}, direct={}, noncash_items={'INVESTING': -money(amt),
                                   'FINANCING': money(amt)}, cash_postings=0)))
    # S03 ----------------------------------------------------------------------------------------------------------------------
    tid = int(S['S03']['Id'])
    recs.append(dict(scenario_id='S03', instance=1, period=txn[tid]['month_key'], txn_ids=[tid], checks=['C08'], exception_codes=['JE_CASH'],
                     expected=dict(direct={'D_FIN_DRAWS': -1200.0, 'D_PAY_OTHER': -50.0}, cash_amount=-1250.0, is_routine=False,
                                   classified_by='other lines of the journal entry')))
    # S04 ----------------------------------------------------------------------------------------------------------------------
    t = cap['S04']; tid = int(t['Id']); pay, i, p = cap['S04_split']
    recs.append(dict(scenario_id='S04', instance=1, period=txn[tid]['month_key'], txn_ids=[tid], checks=[], exception_codes=['LOAN_WHOLE'],
                     expected=dict(direct={'D_FIN_REPAID': -money(pay)}, interest_hidden_in_principal=money(i), schedule_principal=money(p),
                                   operating_understated_by=money(i))))
    # S06 ----------------------------------------------------------------------------------------------------------------------
    s6 = S['S06']; uf = int(co.acc['UF']['Id'])
    neg = [b for b in D['bal'] if b['account_id'] == uf and b['closing_balance'] < 0 and b['month_key'] >= '2024-01']
    held = next(b['closing_balance'] for b in D['bal'] if b['account_id'] == uf and b['month_key'] == '2026-10')
    recs.append(dict(scenario_id='S06', instance=1, period='2026-03..2026-10', txn_ids=_ids(s6['stale']) + _ids([s6['dep_income'], s6['dep_uf']]),
                     checks=['C02'], exception_codes=['UF_STALE', 'UF_NEGATIVE'],
                     expected=dict(stale_payment_ids=_ids(s6['stale']), stale_total=money(sum(t['extra']['total'] for t in s6['stale'])),
                                   negative_month_ends={b['month_key']: money(b['closing_balance']) for b in neg},
                                   deposit_coded_to_uf_id=int(s6['dep_uf']['Id']), deposit_to_income_id=int(s6['dep_income']['Id']),
                                   income_double_counted=money(s6['double_counted']['extra']['total']),
                                   bank_bridge_uf_at_2026_10=money(held))))
    # S07 ----------------------------------------------------------------------------------------------------------------------
    a, b = S['S07']['first'], S['S07']['second']
    recs.append(dict(scenario_id='S07', instance=1, period=txn[int(b['Id'])]['month_key'], txn_ids=_ids([a, b]), checks=[], exception_codes=['DUP_DEPOSIT'],
                     expected=dict(flagged_txn_id=int(b['Id']), matches_txn_id=int(a['Id']), amount=money(b['extra']['total']), days_apart=(b['date'] - a['date']).days)))
    # S08 ----------------------------------------------------------------------------------------------------------------------
    for n, t in enumerate(S['S08'], start=1):
        tid = int(t['Id'])
        recs.append(dict(scenario_id='S08', instance=n, period=txn[tid]['month_key'], txn_ids=[tid], checks=[], exception_codes=['NO_NAME'],
                         expected=dict(counterparty_id=0, counterparty_name='(no name)', direct=direct(tid))))
    # S13 ----------------------------------------------------------------------------------------------------------------------
    s13 = cap['S13']; bp = int(s13['payment']['Id'])
    recs.append(dict(scenario_id='S13', instance=1, period=txn[bp]['month_key'], txn_ids=[bp] + _ids(s13['bills']), checks=['C07', 'C08'],
                     exception_codes=['NONCASH_CROSS_SECTION'],
                     expected=dict(direct=direct(bp), payment_total=-money(s13['payment']['extra']['total']),
                                   settled_bills={int(t['Id']): money(t['extra']['total']) for t in s13['bills']},
                                   bill_exception_txn_id=int(s13['bills'][1]['Id']))))
    # S18 ----------------------------------------------------------------------------------------------------------------------
    for n, t in enumerate(R['s18'], start=1):
        tid = int(t['Id']); r = txn[tid]
        recs.append(dict(scenario_id='S18', instance=n, period=r['month_key'], txn_ids=[tid], checks=[], exception_codes=[],
                         expected=dict(cleared_status='Uncleared', cash_amount=money(r['cash_amount']),
                                       counted_in_m20=('IN' if r['cash_amount'] > 0 else 'OUT'))))
    for r in recs:
        for tid in r['txn_ids']:
            assert tid in txn, (r['scenario_id'], tid)
    return recs

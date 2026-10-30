#!/usr/bin/env python3
"""Re-read the Mirelo dataset (CSV + Parquet) and assert the control totals and internal consistency.

Usage:  python checks/verify.py [--data <dataset folder>]     (default: the folder above checks/)
Independent of the generator: every control total is recomputed here from the written CSVs.
Exit code 0 = all checks green, 1 = at least one failure.
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
import pandas as pd

ap = argparse.ArgumentParser(); ap.add_argument('--data', default=str(Path(__file__).resolve().parent.parent))
D = Path(ap.parse_args().data); fails = []

def check(name, ok, detail=''):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  - ' + detail if detail and not ok else ''}")
    if not ok: fails.append(name)

def csv(folder, name): return pd.read_csv(D / folder / f'{name}.csv', low_memory=False)

# ---- load -----------------------------------------------------------------------------------------------------
man = json.loads((D / 'parquet' / 'manifest.json').read_text())
tabs = {}
for t in man['tables']:
    parts = [pd.read_csv(D / t['folder'] / f, low_memory=False) for f in t['csv_files']]
    tabs[t['table']] = df = pd.concat(parts, ignore_index=True)
    n_pq = len(pd.read_parquet(D / 'parquet' / f"{t['table']}.parquet"))
    check(f"rows {t['table']}: csv = parquet = manifest", len(df) == n_pq == t['rows'], f'{len(df)} / {n_pq} / {t["rows"]}')
loan, cl, lm, rev, sub = tabs['fact_loan'], tabs['dim_client'], tabs['fact_loan_month'], tabs['fact_revenue_month'], tabs['fact_subscription_month']
app, tgt, fx = tabs['fact_application'], tabs['fact_target'], tabs['param_fx']
for df, cols in [(loan, ['disbursed_date', 'repaid_date']), (cl, ['first_loan_date']), (app, ['date'])]:
    for c in cols: df[c] = pd.to_datetime(df[c])
loan['submitted_ts'] = pd.to_datetime(loan.submitted_ts)
rate = fx[fx.rate_type == 'ACTUAL_AVG'].set_index(['currency_code', 'month_key']).local_per_eur
loan['m'] = loan.disbursed_date.dt.strftime('%Y-%m')
loan['eur'] = loan.principal_local / rate.reindex(pd.MultiIndex.from_frame(loan[['currency_code', 'm']])).values
for df in (lm, rev): df['r'] = rate.reindex(pd.MultiIndex.from_frame(df[['currency_code', 'month_key']])).values
lm['d30'] = lm.bal_dpd_30_59_local + lm.bal_dpd_60_89_local + lm.bal_dpd_90p_local

# ---- control totals -------------------------------------------------------------------------------------------
months = pd.period_range('2024-01', '2026-10', freq='M').astype(str)
P = [(m, [m], m if m <= '2026-09' else None, m <= '2026-09') for m in months]
P += [('FY2024', [m for m in months if m[:4] == '2024'], '2024-12', True), ('FY2025', [m for m in months if m[:4] == '2025'], '2025-12', True),
      ('FY2026_YTD_SEP', [m for m in months if '2026-01' <= m <= '2026-09'], '2026-09', True), ('TOTAL', list(months), '2026-09', True)]
exp = {}
for name, ms, snap, has_rev in P:
    for mk in ['PL', 'RO', 'PT', 'ALL']:
        f = (lambda df: df) if mk == 'ALL' else (lambda df, mk=mk: df[df.market_code == mk])
        x = f(loan[loan.m.isin(ms)]); b = x.client_id.nunique(); r = x[x.is_repeat].client_id.nunique()
        v = dict(loans_count=len(x), principal_eur=x.eur.sum(), new_clients=x.is_first_loan.sum(), borrowers=b, returning_clients=r,
                 returning_pct_clients=r / b, returning_pct_loans=x.is_repeat.sum() / len(x))
        if snap:
            y = f(lm[lm.month_key == snap]); o, d30, d90 = (y.outstanding_local / y.r).sum(), (y.d30 / y.r).sum(), (y.bal_dpd_90p_local / y.r).sum()
            v.update(outstanding_eur=o, dpd30_balance_eur=d30, dpd30_pct=d30 / o, dpd90_pct=d90 / o)
        if has_rev:
            z = f(rev[rev.month_key.isin(ms)]); e = z.amount_local / z.r; v['revenue_eur'] = e.sum()
            for t in ['INTEREST', 'FEE', 'INTERCHANGE', 'SUBSCRIPTION']: v[f'revenue_{t.lower()}_eur'] = e[z.revenue_type_code == t].sum()
        for k, val in v.items(): exp[(mk, name, k)] = val
ct = pd.read_csv(D / 'checks' / 'control_totals_eur.csv', dtype={'value': str})
got = {(r.market_code, r.period, r.metric_code): float(r.value) for r in ct.itertuples() if isinstance(r.value, str)}
bad = []
for k, e in exp.items():
    tol = 1e-6 if k[2].endswith('_pct') or 'pct_' in k[2] else (0.006 if k[2].endswith('_eur') else 0)
    if k not in got or abs(got[k] - e) > tol: bad.append((k, got.get(k), e))
check(f'control totals: {len(exp)} values recomputed from the CSVs', not bad and len(got) == len(exp), f'{len(bad)} mismatches, e.g. {bad[:3]}')

# ---- clients and loans ----------------------------------------------------------------------------------------
check('every loan has a client; every client has a loan', set(loan.client_id) == set(cl.client_id) and cl.client_id.is_unique)
check('loan_id and application_id unique', loan.loan_id.is_unique and loan.application_id.is_unique)
j = loan.merge(cl[['client_id', 'first_loan_date', 'loans_before_2024', 'market_code']], on='client_id', suffixes=('', '_c'))
check('is_repeat = disbursed_date > dim_client.first_loan_date', (j.is_repeat == (j.disbursed_date > j.first_loan_date)).all())
check('is_first_loan = not is_repeat', (loan.is_first_loan == ~loan.is_repeat).all())
fl = j[j.is_first_loan]
check('clients first loan in window: exactly one first loan, on first_loan_date',
      fl.client_id.is_unique and (fl.disbursed_date == fl.first_loan_date).all() and len(fl) == (cl.first_loan_date >= '2024-01-01').sum())
j = j.sort_values(['client_id', 'disbursed_date', 'loan_id']); j['k'] = j.groupby('client_id').cumcount()
check('prior_loans = loans_before_2024 + earlier loans in window', (j.prior_loans == j.loans_before_2024 + j.k).all())
check('loan market = client market', (j.market_code == j.market_code_c).all())
rng = {'PL': (400, 3000), 'RO': (500, 6000), 'PT': (150, 1500)}
check('principal within market ranges', all(loan[loan.market_code == m].principal_local.between(*r).all() for m, r in rng.items()))
check('term 1-12 months, APR 18-45 %', loan.term_months.between(1, 12).all() and loan.apr.between(.18, .45).all())
check('principal_eur = principal_local / rate (6 dp)', (loan.principal_eur - loan.eur).abs().max() < 1e-6)
check('submitted before disbursed; hours_to_approve <= hours_to_cash', (loan.submitted_ts.dt.normalize() <= loan.disbursed_date).all()
      and (loan.hours_to_approve <= loan.hours_to_cash).all())
after = loan.disbursed_date > '2026-09-30'
check('AFTER_CLOSE exactly for loans disbursed after 2026-09-30', ((loan.status_code == 'AFTER_CLOSE') == after).all()
      and loan.loc[after, ['dpd_days_close', 'outstanding_local_close']].isna().all().all())
s = loan[~after]; d = s.dpd_days_close
bucket = np.select([d == 0, d < 30, d < 60, d < 90], ['CURRENT', 'DPD_1_29', 'DPD_30_59', 'DPD_60_89'], 'DPD_90P')
act = ~s.status_code.isin(['REPAID', 'WRITTEN_OFF'])
check('status bucket matches dpd_days_close; closed loans have 0 outstanding',
      (s.status_code[act] == bucket[act.values]).all() and (s.outstanding_local_close[~act] == 0).all() and (s.outstanding_local_close >= 0).all())
check('repaid_date only on REPAID loans, after disbursement', loan.repaid_date.notna().eq(loan.status_code == 'REPAID').all()
      and (loan.repaid_date.dropna() > loan.disbursed_date[loan.repaid_date.notna()]).all())

# ---- portfolio snapshot ---------------------------------------------------------------------------------------
bal = ['outstanding_local', 'bal_current_local', 'bal_dpd_1_29_local', 'bal_dpd_30_59_local', 'bal_dpd_60_89_local', 'bal_dpd_90p_local',
       'principal_repaid_local', 'written_off_local', 'interest_local', 'fee_local']
check('fact_loan_month balances and flows never negative', (lm[bal] >= -0.005).all().all())
check('DPD buckets sum to outstanding', (lm[bal[1:6]].sum(axis=1) - lm.outstanding_local).abs().max() < 0.01)
check('loans_dpd_30p <= loans_active', (lm.loans_dpd_30p <= lm.loans_active).all())
cellk = ['market_code', 'product_code', 'channel_code', 'is_repeat', 'vintage_month']
z = lm.sort_values(cellk + ['month_key']); prev = z.groupby(cellk).outstanding_local.shift()
first = prev.isna(); prev = prev.fillna(0)
roll = (prev + z.principal_disbursed_local - z.principal_repaid_local - z.written_off_local - z.outstanding_local).abs()
check('balance roll-forward per vintage cell (opening book rows excepted)', roll[~(first & (z.vintage_month < '2024-01'))].max() < 0.006)
a = s.groupby('market_code').outstanding_local_close.sum(); b = lm[lm.month_key == '2026-09'].groupby('market_code').outstanding_local.sum()
check('sum of fact_loan.outstanding_local_close = fact_loan_month Sep 2026 outstanding', (a - b).abs().max() < 0.01, f'{(a - b).to_dict()}')
g = s.assign(vintage_month=s.m).groupby(cellk).agg(n=('loan_id', 'size'), p=('principal_local', 'sum'))
h = lm[lm.vintage_month == lm.month_key].set_index(cellk)[['loans_disbursed', 'principal_disbursed_local']]
x = g.join(h, how='outer').fillna(0)
check('fact_loan disbursements = fact_loan_month vintage rows (to the loan and cent)', (x.n == x.loans_disbursed).all() and (x.p - x.principal_disbursed_local).abs().max() < 0.01)

# ---- revenue, subscriptions, funnel, targets --------------------------------------------------------------------
lr = lm.groupby(['month_key', 'market_code', 'product_code'])[['interest_local', 'fee_local']].sum()
rr = rev[rev.revenue_type_code.isin(['INTEREST', 'FEE'])].pivot_table(index=['month_key', 'market_code', 'product_code'], columns='revenue_type_code', values='amount_local', aggfunc='sum')
x = lr.join(rr, how='outer').fillna(0)
check('revenue INTEREST / FEE = sum of fact_loan_month', (x.interest_local - x.INTEREST).abs().max() < 0.01 and (x.fee_local - x.FEE).abs().max() < 0.01)
of = s.groupby(['m', 'market_code']).origination_fee_local.sum(); fr = rev[rev.revenue_type_code == 'FEE'].groupby(['month_key', 'market_code']).amount_local.sum()
check('origination fees of the month <= FEE revenue of the month', (of.values <= fr.reindex(of.index).values + 0.01).all())
sr = sub[sub.product_code != 'FREE'].set_index(['month_key', 'market_code', 'product_code']).revenue_local
rs = rev[rev.revenue_type_code == 'SUBSCRIPTION'].set_index(['month_key', 'market_code', 'product_code']).amount_local
check('revenue SUBSCRIPTION = fact_subscription_month.revenue_local', (sr - rs.reindex(sr.index)).abs().max() < 0.005)
check('subscribers_end = start + new - churned; MRR = end x price', (sub.subscribers_end == sub.subscribers_start + sub.subscribers_new - sub.subscribers_churned).all()
      and (sub.mrr_local - (sub.subscribers_end * sub.price_local).round(2)).abs().max() < 0.005)
check('amount_eur = amount_local / rate (6 dp)', (rev.amount_eur - rev.amount_local / rev.r).abs().max() < 1e-6)
st = ['leads', 'apps_started', 'apps_submitted', 'kyc_passed', 'approved', 'disbursed']
check('funnel stages monotone (leads >= started >= ... >= disbursed)', all((app[a_] >= app[b_]).all() for a_, b_ in zip(st, st[1:])))
ls = loan.assign(date=loan.submitted_ts.dt.normalize()); ls = ls[ls.date >= '2024-01-01']
x = ls.groupby(['date', 'market_code', 'channel_code', 'product_code', 'is_repeat']).size().rename('n').to_frame().join(
    app.set_index(['date', 'market_code', 'channel_code', 'product_code', 'is_repeat']).disbursed, how='outer').fillna(0)
check('fact_application.disbursed = fact_loan by submission day x grain', (x.n == x.disbursed).all())
lt = tgt[tgt.metric_code.isin(['LOANS', 'PRINCIPAL_LOCAL', 'NEW_CLIENTS', 'REVENUE_LOCAL'])]
check('targets non-negative and cover Jan 2024 - Dec 2026', (tgt.target_value >= 0).all() and lt.month_key.min() == '2024-01' and lt.month_key.max() == '2026-12'
      and lt.groupby('metric_code').month_key.nunique().eq(36).all())
print(f'\n{len(fails)} failure(s)' if fails else '\nALL CHECKS GREEN')
sys.exit(1 if fails else 0)

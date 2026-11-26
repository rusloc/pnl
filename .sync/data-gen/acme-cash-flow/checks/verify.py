#!/usr/bin/env python3
"""Re-read the ACME Cash Flow dataset (Parquet + QBO files) and assert the contract: generator spec invariants I01-I11,
I13, I14 (I12 as a structural shape check only) and report spec checks C01-C10, plus every row of
checks/control_totals_usd.csv.

Usage:  python checks/verify.py [--data <dataset folder>] [--no-rerun]     (default: the folder above checks/)
Independent of the generator: nothing is imported from generator/. The QBO transactions are re-posted here with this
file's own posting rules, cash postings are re-classified with this file's own look-through, and every control total
is recomputed from the ledger with pandas. Exit code 0 = all checks green, 1 = at least one failure.
"""
import argparse, datetime as dt, filecmp, hashlib, json, subprocess, sys, tempfile, warnings
from collections import defaultdict
from pathlib import Path
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore', category=DeprecationWarning)
ap = argparse.ArgumentParser(); ap.add_argument('--data', default=str(Path(__file__).resolve().parent.parent)); ap.add_argument('--no-rerun', action='store_true')
args = ap.parse_args(); DATA = Path(args.data); fails = []; npass = 0
START, END = dt.date(2024, 1, 1), dt.date(2026, 10, 31)


def check(name, ok, detail=''):
    global npass
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  - ' + str(detail)[:400] if detail and not ok else ''}")
    if ok: npass += 1
    else: fails.append(name)


def c(x): return int(round(float(x) * 100))


# ---- load: Parquet against its manifest, QBO files against theirs --------------------------------------------------------------
man = json.loads((DATA / 'parquet' / 'manifest.json').read_text(encoding='utf-8'))
T = {}
for t in man['tables']:
    p = DATA / 'parquet' / f"{t['table']}.parquet"
    T[t['table']] = df = pd.read_parquet(p)
    check(f"{t['table']}: rows and column types = manifest", len(df) == t['rows'] and {f.name: str(f.type) for f in pq.read_schema(p)} == t['columns'])
check('15 tables, seed 42, preset typical, span 2024-01-01 .. 2026-10-31, as-of 2026-11-05 09:00',
      len(T) == 15 and man['seed'] == 42 and man['preset'] == 'typical' and man['start_date'] == '2024-01-01' and man['end_date'] == '2026-10-31'
      and man['as_of'] == '2026-11-05T09:00:00')
qman = json.loads((DATA / 'qbo' / 'manifest.json').read_text(encoding='utf-8'))
check(f"qbo manifest: {len(qman['files'])} files present with matching SHA-256 and size",
      all((DATA / 'qbo' / f['path']).stat().st_size == f['bytes'] and hashlib.sha256((DATA / 'qbo' / f['path']).read_bytes()).hexdigest() == f['sha256']
          for f in qman['files']))
check('qbo manifest: engine version, seed, config, counts per entity', qman['seed'] == 42 and qman['engine_version'] and qman['config']['profile'] == 'services'
      and qman['config']['size'] == 'S' and qman['config']['home_currency'] == 'USD' and set(qman['counts']) >= {'Account', 'Invoice', 'Payment', 'Deposit'})
E = {}
for p in sorted((DATA / 'qbo' / 'entities').glob('*.jsonl')):
    E[p.stem] = [json.loads(l) for l in p.read_text(encoding='utf-8').splitlines()]
check('entities: one file per entity, counts = qbo manifest, objects in Id order',
      {k: len(v) for k, v in E.items()} == qman['counts'] and all([int(o['Id']) for o in v] == sorted(int(o['Id']) for o in v) for v in E.values()))
TXN_TYPES = ['Invoice', 'Payment', 'SalesReceipt', 'RefundReceipt', 'CreditMemo', 'Deposit', 'Bill', 'VendorCredit', 'BillPayment', 'Purchase',
             'CreditCardPayment', 'Transfer', 'JournalEntry']
LISTS = ['Account', 'Customer', 'Vendor', 'Employee', 'Class', 'Item', 'Term', 'PaymentMethod', 'CompanyInfo', 'Preferences']
check('entities: the 13 transaction types and 10 list / settings entities of generator spec 4.2', set(E) == set(TXN_TYPES) | set(LISTS))
REP = {}
for p in sorted((DATA / 'qbo' / 'reports').rglob('*.json')):
    REP[p.relative_to(DATA / 'qbo' / 'reports').as_posix()] = json.loads(p.read_text(encoding='utf-8'))
check('reports: CashFlow, ProfitAndLoss, BalanceSheet x 6 windows x (Month, Total) + GeneralLedger, TransactionList x 6 (Total) = 48 files',
      len(REP) == 48 and {k.split('/')[0] for k in REP} == {'CashFlow', 'ProfitAndLoss', 'BalanceSheet', 'GeneralLedger', 'TransactionList'})

# ---- I12 (structural only): QBO shape of entities, envelopes and reports -------------------------------------------------------
ACCOUNT_TYPES = {'Bank', 'Accounts Receivable', 'Other Current Asset', 'Fixed Asset', 'Other Asset', 'Accounts Payable', 'Credit Card',
                 'Other Current Liability', 'Long Term Liability', 'Equity', 'Income', 'Cost of Goods Sold', 'Expense', 'Other Income', 'Other Expense'}
CLASSIF = {'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'}
REQ = {'Invoice': ['TxnDate', 'CustomerRef', 'Line', 'TotalAmt', 'Balance', 'DueDate', 'LinkedTxn'], 'Payment': ['TxnDate', 'CustomerRef', 'TotalAmt',
       'UnappliedAmt', 'Line', 'DepositToAccountRef'], 'SalesReceipt': ['TxnDate', 'CustomerRef', 'Line', 'TotalAmt', 'DepositToAccountRef'],
       'RefundReceipt': ['TxnDate', 'CustomerRef', 'Line', 'TotalAmt', 'DepositToAccountRef'], 'CreditMemo': ['TxnDate', 'CustomerRef', 'Line',
       'TotalAmt', 'Balance', 'RemainingCredit'], 'Deposit': ['TxnDate', 'DepositToAccountRef', 'Line', 'TotalAmt'], 'Bill': ['TxnDate', 'VendorRef',
       'APAccountRef', 'Line', 'TotalAmt', 'Balance', 'DueDate', 'LinkedTxn'], 'VendorCredit': ['TxnDate', 'VendorRef', 'Line', 'TotalAmt'],
       'BillPayment': ['TxnDate', 'VendorRef', 'PayType', 'TotalAmt', 'Line'], 'Purchase': ['TxnDate', 'PaymentType', 'AccountRef', 'Line', 'TotalAmt'],
       'CreditCardPayment': ['TxnDate', 'CreditCardAccountRef', 'BankAccountRef', 'Amount'], 'Transfer': ['TxnDate', 'FromAccountRef', 'ToAccountRef', 'Amount'],
       'JournalEntry': ['TxnDate', 'Line', 'TotalAmt']}
bad = []
for k, objs in E.items():
    for o in objs:
        if not (o.get('domain') == 'QBO' and o.get('sparse') is False and o['Id'].isdigit() and o['SyncToken'].isdigit()
                and set(o['MetaData']) == {'CreateTime', 'LastUpdatedTime'}):
            bad.append((k, o['Id'], 'common')); continue
        for f in REQ.get(k, []):
            if f not in o: bad.append((k, o['Id'], f))
        for ref in [v for kk, v in o.items() if kk.endswith('Ref') and isinstance(v, dict)]:
            if 'value' not in ref: bad.append((k, o['Id'], 'ref'))
        if k in TXN_TYPES:
            for ln in o.get('Line', []):
                dtp = ln.get('DetailType')
                if dtp and dtp not in ln: bad.append((k, o['Id'], 'detail'))
                if k in ('Invoice', 'SalesReceipt', 'CreditMemo', 'RefundReceipt', 'Bill', 'Purchase', 'VendorCredit', 'JournalEntry', 'Deposit') and dtp \
                        and dtp != 'SubTotalLineDetail' and not ('Id' in ln and 'LineNum' in ln): bad.append((k, o['Id'], 'line id'))
        if k == 'Purchase' and o['PaymentType'] not in ('Cash', 'Check', 'CreditCard'): bad.append((k, o['Id'], 'PaymentType'))
        if k == 'BillPayment' and not ((o['PayType'] == 'Check' and 'CheckPayment' in o) or (o['PayType'] == 'CreditCard' and 'CreditCardPayment' in o)):
            bad.append((k, o['Id'], 'PayType'))
        if k == 'JournalEntry' and any(l['JournalEntryLineDetail']['PostingType'] not in ('Debit', 'Credit') for l in o['Line']): bad.append((k, o['Id'], 'post'))
        if k == 'Account' and (o['AccountType'] not in ACCOUNT_TYPES or o['Classification'] not in CLASSIF): bad.append((k, o['Id'], 'type'))
check('I12 (structural, no sandbox schema): common fields, required fields per entity, refs carry value, lines Id + LineNum + detail object, '
      'enumerations (AccountType, Classification, PaymentType, PayType, PostingType)', not bad, bad[:5])
nacct = len(E['Account']); sub = sum(1 for a in E['Account'] if a['SubAccount'])
check(f'chart of accounts: 40-80 accounts ({nacct}), sub-accounts present ({sub}), detail types Checking, Savings, UndepositedFunds, AccumulatedDepreciation',
      40 <= nacct <= 80 and sub >= 5 and {'Checking', 'Savings', 'UndepositedFunds', 'AccumulatedDepreciation'} <= {a['AccountSubType'] for a in E['Account']})
envs = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((DATA / 'qbo' / 'query').glob('*.json'))]
check(f'query envelopes ({len(envs)}): QueryResponse[<Entity>], startPosition, maxResults, time',
      len(envs) == len(E) and all('time' in v and {'startPosition', 'maxResults'} <= set(v['QueryResponse']) and len(v['QueryResponse']) == 3 for v in envs))
rep_ok = all({'Header', 'Columns', 'Rows'} <= set(r) and {'ReportName', 'StartPeriod', 'EndPeriod', 'SummarizeColumnsBy', 'Currency', 'Option'} <= set(r['Header'])
             and r['Columns']['Column'][0]['ColType'] in ('Account', 'Date') for r in REP.values())
cf_groups = all({x.get('group') for x in r['Rows']['Row']} == {'OperatingActivities', 'InvestingActivities', 'FinancingActivities', 'CashIncrease', 'BeginningCash',
                                                              'EndingCash'} for k, r in REP.items() if k.startswith('CashFlow'))
check('reports: Header (name, periods, summarize-by, currency, options), Columns, Rows; CashFlow top-level groups as report spec 3', rep_ok and cf_groups)

# ---- tables -------------------------------------------------------------------------------------------------------------------
A = T['dim_account'].set_index('account_id'); led = T['fact_ledger_line']; tx = T['fact_txn'].set_index('txn_id'); cp = T['fact_cash_posting']
bal = T['fact_account_balance']; lk = T['fact_settlement_link']; nci = T['fact_noncash_item']; exc = T['fact_exception']; mp = T['map_account_line']
ctl = T['ctl_qbo_cashflow']; scen = T['ctl_scenario']
led['amt'] = (led.amount * 100).round().astype('int64'); cp['amt'] = (cp.amount * 100).round().astype('int64')
for d_ in (led, cp, nci): d_['d'] = pd.to_datetime(d_.txn_date).dt.date
CASH = set(A.index[A.is_cash]); BANK = set(A.index[A.is_bank]); PL = set(A.index[A.is_pl])
by_sub = {s: int(A.index[A.account_subtype == s][0]) for s in ('AccountsReceivable', 'AccountsPayable', 'UndepositedFunds', 'SalesTaxPayable')}
AR, AP, UF, STP = (by_sub[s] for s in ('AccountsReceivable', 'AccountsPayable', 'UndepositedFunds', 'SalesTaxPayable'))
ITEM_INC = {o['Id']: int(o['IncomeAccountRef']['value']) for o in E['Item']}
TX = {}
for k in TXN_TYPES:
    for o in E[k]: TX[int(o['Id'])] = (k, o)
MONTHS = sorted(m for m in bal.month_key.unique() if m >= '2024-01')


# ---- independent re-posting of the QBO transactions (generator spec 6.1, this file's own code) ------------------------------------
def repost(k, o):
    out = defaultdict(int)

    def a(acct, v): out[int(acct)] += v
    if k in ('Invoice', 'CreditMemo', 'SalesReceipt', 'RefundReceipt'):
        s = 1 if k in ('Invoice', 'SalesReceipt') else -1
        a(AR if k in ('Invoice', 'CreditMemo') else o['DepositToAccountRef']['value'], s * c(o['TotalAmt']))
        for ln in o['Line']:
            if ln['DetailType'] == 'SalesItemLineDetail': a(ITEM_INC[ln['SalesItemLineDetail']['ItemRef']['value']], -s * c(ln['Amount']))
        a(STP, -s * c(o['TxnTaxDetail']['TotalTax']))
    elif k == 'Payment':
        a(o['DepositToAccountRef']['value'], c(o['TotalAmt'])); a(AR, -c(o['UnappliedAmt']))
        for ln in o['Line']: a(AR, (-1 if ln['LinkedTxn'][0]['TxnType'] == 'Invoice' else 1) * c(ln['Amount']))
    elif k == 'Deposit':
        a(o['DepositToAccountRef']['value'], c(o['TotalAmt']))
        for ln in o['Line']: a(UF if ln.get('LinkedTxn') else ln['DepositLineDetail']['AccountRef']['value'], -c(ln['Amount']))
    elif k in ('Bill', 'VendorCredit', 'Purchase'):
        s = (-1 if o.get('Credit') else 1) if k == 'Purchase' else (1 if k == 'Bill' else -1)
        a(o['AccountRef']['value'] if k == 'Purchase' else AP, -s * c(o['TotalAmt']))
        for ln in o['Line']: a(ln['AccountBasedExpenseLineDetail']['AccountRef']['value'], s * c(ln['Amount']))
    elif k == 'BillPayment':
        a((o['CheckPayment']['BankAccountRef'] if o['PayType'] == 'Check' else o['CreditCardPayment']['CCAccountRef'])['value'], -c(o['TotalAmt']))
        for ln in o['Line']: a(AP, (1 if ln['LinkedTxn'][0]['TxnType'] == 'Bill' else -1) * c(ln['Amount']))
    elif k == 'CreditCardPayment':
        a(o['BankAccountRef']['value'], -c(o['Amount'])); a(o['CreditCardAccountRef']['value'], c(o['Amount']))
    elif k == 'Transfer':
        a(o['FromAccountRef']['value'], -c(o['Amount'])); a(o['ToAccountRef']['value'], c(o['Amount']))
    elif k == 'JournalEntry':
        for ln in o['Line']:
            d = ln['JournalEntryLineDetail']; a(d['AccountRef']['value'], (1 if d['PostingType'] == 'Debit' else -1) * c(ln['Amount']))
    return {x: v for x, v in out.items() if v}


RP = {tid: repost(k, o) for tid, (k, o) in TX.items()}
LG = {tid: {int(a_): int(v) for a_, v in g.groupby('account_id').amt.sum().items() if v} for tid, g in led.groupby('txn_id')}
check(f'one source of truth: re-posting all {len(TX):,} QBO transactions here gives fact_ledger_line exactly (per transaction and account)',
      RP == {t_: LG.get(t_, {}) for t_ in RP} and set(LG) <= set(RP))
check('I01 every transaction balances (QBO re-post and fact_ledger_line)', all(sum(v.values()) == 0 for v in RP.values())
      and (led.groupby('txn_id').amt.sum() == 0).all())
hdr = []
for tid, (k, o) in TX.items():
    r = tx.loc[tid]
    tot = c(o.get('TotalAmt', o.get('Amount', 0)))
    ok = (r.txn_type == k and str(r.txn_date) == o['TxnDate'] and (r.doc_number or None) == o.get('DocNumber') and c(r.total_amount) == tot
          and str(r.sync_token) == o['SyncToken'] and r.created_at.strftime('%Y-%m-%dT%H:%M:%S') == o['MetaData']['CreateTime'][:19]
          and r.updated_at.strftime('%Y-%m-%dT%H:%M:%S') == o['MetaData']['LastUpdatedTime'][:19])
    if k in ('Invoice', 'Bill', 'CreditMemo', 'VendorCredit'): ok = ok and c(r.open_balance) == c(o['Balance'])
    if not ok: hdr.append(tid)
check('fact_txn = QBO header per transaction (type, date, number, total, balance, SyncToken, MetaData times)', not hdr and len(tx) == len(TX), hdr[:5])

# ---- I02 trial balance and A = L + E, at every month end ------------------------------------------------------------------------
led['mk'] = led.month_key.where(led.month_key >= '2023-12', '2023-12')
cum = led.pivot_table(index='mk', columns='account_id', values='amt', aggfunc='sum', fill_value=0).sort_index().cumsum()
tb = cum.sum(axis=1)
assets = cum[[a_ for a_ in cum.columns if A.loc[a_, 'classification'] == 'Asset']].sum(axis=1)
le = -cum[[a_ for a_ in cum.columns if A.loc[a_, 'classification'] != 'Asset']].sum(axis=1)
check('I02 trial balance sums to zero at every month end 2023-12 .. 2026-10; assets = liabilities + equity (incl. P&L to date)',
      (tb == 0).all() and (assets == le).all() and len(cum) == 35)
bs_ok = []
for k, r in REP.items():
    if not k.startswith('BalanceSheet'): continue
    top = {x['group']: [c(v['value']) for v in x['Summary']['ColData'][1:]] for x in r['Rows']['Row']}
    bs_ok.append(top['TotalAssets'] == top['TotalLiabilitiesAndEquity'])
check('I02 BalanceSheet reports: TOTAL ASSETS = TOTAL LIABILITIES AND EQUITY in every column (12 files)', all(bs_ok) and len(bs_ok) == 12)
bk = bal.set_index(['account_id', 'month_key'])
own_bs = {(a_, m): int(cum.loc[m, a_]) for m in cum.index for a_ in cum.columns if a_ not in PL}
check('fact_account_balance closing balances (balance-sheet accounts) = cumulative ledger',
      all(c(bk.loc[(a_, m), 'closing_balance']) == v for (a_, m), v in own_bs.items()))
plm = led.pivot_table(index='mk', columns='account_id', values='amt', aggfunc='sum', fill_value=0)
check('I10 ledger lines per account and month = fact_account_balance net_change', all(
    c(r.net_change) == (int(plm.loc[r.month_key, r.account_id]) if r.account_id in plm.columns and r.month_key in plm.index else 0) for r in bal.itertuples()))

# ---- I03 / I04 control accounts and settled documents ------------------------------------------------------------------------------
applied = defaultdict(int)
for k in ('Payment', 'BillPayment'):
    for o in E[k]:
        for ln in o['Line']: applied[int(ln['LinkedTxn'][0]['TxnId'])] += c(ln['Amount'])
i04 = [tid for tid, (k, o) in TX.items() if k in ('Invoice', 'Bill', 'CreditMemo', 'VendorCredit')
       and not (c(o['TotalAmt']) - applied.get(tid, 0) == c(o['Balance']) >= 0)]
check('I04 every invoice, bill, credit memo and vendor credit: Balance = total - linked settlements, never negative', not i04, i04[:5])
lkp = lk[lk.payment_txn_type != 'Deposit']
lk_app = lkp.drop_duplicates(['payment_txn_id', 'payment_line_seq']).groupby('document_txn_id').applied_amount.sum()
lk_all = lkp.groupby(['payment_txn_id', 'payment_line_seq', 'document_txn_id']).agg(a=('applied_amount', 'first'), s=('allocated_amount', 'sum'))
check('fact_settlement_link: applied per document = QBO links; allocations over document lines sum to the applied amount',
      all(c(v) == applied[int(d_)] for d_, v in lk_app.items()) and ((lk_all.a * 100).round() == (lk_all.s * 100).round()).all())
end = '2026-10'
open_inv = sum(c(o['Balance']) for o in E['Invoice']) - sum(c(o['RemainingCredit']) for o in E['CreditMemo']) - sum(c(o['UnappliedAmt']) for o in E['Payment'])
open_bill = sum(c(o['Balance']) for o in E['Bill']) - sum(c(o['Balance']) for o in E['VendorCredit'])
check(f'I03 A/R control {cum.loc[end, AR] / 100:,.2f} = open invoices - open credits - unapplied payments; A/P control {-cum.loc[end, AP] / 100:,.2f} = '
      'open bills - open vendor credits', int(cum.loc[end, AR]) == open_inv and -int(cum.loc[end, AP]) == open_bill)
check('Customer.Balance and Vendor.Balance sum to the A/R and A/P controls',
      sum(c(o['Balance']) for o in E['Customer']) == open_inv and sum(c(o['Balance']) for o in E['Vendor']) == open_bill)

# ---- I05 Undeposited Funds ------------------------------------------------------------------------------------------------------
swept = {int(ln['LinkedTxn'][0]['TxnId']) for o in E['Deposit'] for ln in o['Line'] if ln.get('LinkedTxn')}
held = [int(o['Id']) for k in ('Payment', 'SalesReceipt') for o in E[k] if int(o['DepositToAccountRef']['value']) == UF and c(o['TotalAmt']) > 0
        and int(o['Id']) not in swept]
direct_uf = [(int(o['Id']), c(ln['Amount'])) for o in E['Deposit'] for ln in o['Line'] if not ln.get('LinkedTxn')
             and int(ln['DepositLineDetail']['AccountRef']['value']) == UF]
s06 = json.loads(scen[scen.scenario_id == 'S06'].expected_json.iloc[0])
check(f'I05 Undeposited Funds {cum.loc[end, UF] / 100:,.2f} = payments not yet swept ({len(held)}) - deposits coded straight to it; '
      'the only such deposit is the S06 one (its planted break)',
      int(cum.loc[end, UF]) == sum(c(TX[t_][1]['TotalAmt']) for t_ in held) - sum(v for _, v in direct_uf)
      and [t_ for t_, _ in direct_uf] == [s06['deposit_coded_to_uf_id']])

# ---- I06 references --------------------------------------------------------------------------------------------------------------
IDS = {k: {o['Id'] for o in E[k]} for k in E}
NAMES = IDS['Customer'] | IDS['Vendor'] | IDS['Employee']
REFMAP = {'CustomerRef': 'Customer', 'VendorRef': 'Vendor', 'ItemRef': 'Item', 'ClassRef': 'Class', 'SalesTermRef': 'Term', 'PaymentMethodRef': 'PaymentMethod',
          'ParentRef': 'Account'}
miss = []


def walk(o, where):
    if isinstance(o, dict):
        for kk, v in o.items():
            if isinstance(v, dict) and kk.endswith('Ref') and 'value' in v and kk not in ('CurrencyRef', 'TaxCodeRef', 'HomeCurrency'):
                pool = IDS[REFMAP[kk]] if kk in REFMAP else NAMES if kk == 'EntityRef' else IDS['Account']
                if v['value'] not in pool: miss.append((where, kk, v['value']))
            elif kk == 'Entity' and isinstance(v, dict) and 'value' in v:
                if v['value'] not in NAMES: miss.append((where, kk, v['value']))
            elif kk == 'LinkedTxn':
                for l_ in v:
                    t_ = TX.get(int(l_['TxnId']))
                    if not t_ or t_[0] != l_['TxnType']: miss.append((where, 'LinkedTxn', l_['TxnId']))
            else:
                walk(v, where)
    elif isinstance(o, list):
        for v in o: walk(v, where)


for k, objs in E.items():
    for o in objs: walk(o, (k, o['Id']))
both = [(t_, l_['TxnId']) for t_, (k, o) in TX.items() if k in ('Invoice', 'Bill') for l_ in o['LinkedTxn']
        if not any(int(x['LinkedTxn'][0]['TxnId']) == t_ for x in TX[int(l_['TxnId'])][1]['Line'])]
check('I06 every reference resolves (accounts, names, items, classes, terms, methods, linked transactions with matching type); every link has both ends',
      not miss and not both, (miss + both)[:5])
CPID = set(T['dim_counterparty'].counterparty_id)
fk = [('fact_ledger_line', 'account_id', set(A.index)), ('fact_ledger_line', 'counterparty_id', CPID), ('fact_cash_posting', 'cash_account_id', set(A.index)),
      ('fact_cash_posting', 'offset_account_id', set(A.index)), ('fact_cash_posting', 'counterparty_id', CPID), ('fact_cash_posting', 'txn_id', set(tx.index)),
      ('fact_settlement_link', 'document_txn_id', set(tx.index)), ('fact_account_balance', 'account_id', set(A.index)),
      ('map_account_line', 'account_id', set(A.index)), ('fact_noncash_item', 'txn_id', set(tx.index)), ('fact_txn', 'counterparty_id', CPID)]
check('Parquet keys resolve (accounts, counterparties, transactions, classes, statement lines)', all(T[t_][col].dropna().isin(ref).all() for t_, col, ref in fk)
      and led.class_id.dropna().isin(set(T['dim_class'].class_id)).all() and cp.direct_line_code.isin(set(T['dim_cf_line'].line_code)).all())


# ---- I07 chronology, I08 ids and sync tokens -----------------------------------------------------------------------------------
def ts(s): return dt.datetime.fromisoformat(s[:19])


chron = []
for tid, (k, o) in TX.items():
    ct, ut = ts(o['MetaData']['CreateTime']), ts(o['MetaData']['LastUpdatedTime'])
    if ct.date() < dt.date.fromisoformat(o['TxnDate']) or ut < ct: chron.append((tid, 'meta'))
    for ln in o.get('Line', []):
        for l_ in ln.get('LinkedTxn', []):
            d_ = TX[int(l_['TxnId'])][1]
            if d_['TxnDate'] > o['TxnDate'] or ts(d_['MetaData']['CreateTime']) > ct: chron.append((tid, l_['TxnId']))
chains = [json.loads(l) for l in (DATA / 'qbo' / 'expected' / 'chains.jsonl').read_text(encoding='utf-8').splitlines()]
for ch in chains:
    docs = [TX[t_][1]['TxnDate'] for t_ in ch['txn_ids'] if TX[t_][0] in ('Invoice', 'Bill', 'SalesReceipt')]
    if docs and any(TX[t_][1]['TxnDate'] < min(docs) for t_ in ch['txn_ids'] if TX[t_][0] in ('Payment', 'BillPayment')): chron.append(('chain', ch['chain_id']))
check(f'I07 chronology: create time on or after the transaction date, last update never before create, linked documents dated and created first, '
      f'payments never before the documents of their chain ({len(chains):,} chains)', not chron, chron[:5])
tid_all = [o['Id'] for k in TXN_TYPES for o in E[k]]
name_all = [o['Id'] for k in ('Customer', 'Vendor', 'Employee') for o in E[k]]
st_ = [(k, o['Id']) for k in E for o in E[k] if (o['SyncToken'] == '0') != (o['MetaData']['CreateTime'] == o['MetaData']['LastUpdatedTime'])]
check(f'I08 transaction Ids unique on one sequence ({len(tid_all):,}), name Ids unique across customers, vendors, employees; '
      'SyncToken "0" exactly when never updated', len(set(tid_all)) == len(tid_all) and len(set(name_all)) == len(name_all) and not st_, st_[:5])
lag = np.median([(ts(o['MetaData']['CreateTime']).date() - dt.date.fromisoformat(o['TxnDate'])).days for _, o in TX.values()])
edited = (tx.sync_token > 0).mean()
check(f'bookkeeping realism: updated share {edited:.1%} (about 6 % edits plus settlement updates of invoices and bills), median create lag {lag:.0f} d',
      0.05 <= edited <= 0.6 and 1 <= lag <= 4)

# ---- I11 bank balances above the floor ------------------------------------------------------------------------------------------
daily = led[led.account_id.isin(BANK)].groupby(['account_id', 'd']).amt.sum()
low = []
for b in sorted(BANK):
    s_ = daily.loc[b].sort_index().cumsum()
    s_ = s_[[d_ >= START for d_ in s_.index]]
    if (s_ < c(A.loc[b, 'cash_floor'])).any(): low.append((b, s_.min() / 100))
check('I11 every bank account ends every day at or above its floor (Operating Checking 15,000.00; others 0.00)', not low, low)

# ---- own statement figures from the ledger --------------------------------------------------------------------------------------
SEC_DEF = A.default_section.replace({'NET_INCOME': 'OPERATING'}); SEC_OV = A.override_section.fillna(SEC_DEF).replace({'NET_INCOME': 'OPERATING'})
prevm = {m: (MONTHS[i - 1] if i else '2023-12') for i, m in enumerate(MONTHS)}
cashbal = lambda m, pool=CASH: int(sum(cum.loc[m, a_] for a_ in pool if a_ in cum.columns))
chg = lambda ms, a_: int(plm.loc[[m for m in ms if m in plm.index], a_].sum()) if a_ in plm.columns else 0


def sections(ms, smap):
    s = defaultdict(int); s['OPERATING'] = -sum(chg(ms, a_) for a_ in PL)
    for a_ in A.index:
        if a_ in CASH or a_ in PL: continue
        s[smap[a_]] -= chg(ms, a_)
    return s


M03 = {m: cashbal(m) - cashbal(prevm[m]) for m in MONTHS}
NI = {m: -sum(chg([m], a_) for a_ in PL) for m in MONTHS}
SD = {m: sections([m], SEC_DEF) for m in MONTHS}; SO = {m: sections([m], SEC_OV) for m in MONTHS}

# ---- I09 on every CashFlow report, C01 - C03 against the QBO-shaped reports ---------------------------------------------------------
def top(r):
    out = {}
    for x in r['Rows']['Row']:
        if 'Summary' in x: out[x['group']] = [c(v['value']) for v in x['Summary']['ColData'][1:]]
    for x in r['Rows']['Row']:
        if x.get('group') == 'OperatingActivities':
            out['NetIncome'] = [c(v['value']) for v in x['Rows']['Row'][0]['ColData'][1:]]
    return out


def find(rows, group):
    for x in rows:
        if x.get('group') == group: return x
        if 'Rows' in x:
            f = find(x['Rows']['Row'], group)
            if f: return f
    return None


def find_acct(rows, aid):
    for x in rows:
        if 'ColData' in x and x['ColData'][0].get('id') == str(aid): return [c(v['value']) if v['value'] else 0 for v in x['ColData'][1:]]
        if 'Rows' in x:
            f = find_acct(x['Rows']['Row'], aid)
            if f: return f
    return None


i09, c01, c02, c03 = [], [], [], []
for k, r in REP.items():
    if not k.startswith('CashFlow'): continue
    t_ = top(r)
    for i in range(len(t_['CashIncrease'])):
        if t_['OperatingActivities'][i] + t_['InvestingActivities'][i] + t_['FinancingActivities'][i] != t_['CashIncrease'][i] or \
                t_['BeginningCash'][i] + t_['CashIncrease'][i] != t_['EndingCash'][i]: i09.append((k, i))
    bs = REP[k.replace('CashFlow', 'BalanceSheet')]
    pl_ = REP[k.replace('CashFlow', 'ProfitAndLoss')]
    bank = [c(v['value']) for v in find(bs['Rows']['Row'], 'BankAccounts')['Summary']['ColData'][1:]]
    ufv = find_acct(bs['Rows']['Row'], UF) or [0] * len(bank)
    ni_r = [c(v['value']) for v in find(pl_['Rows']['Row'], 'NetIncome')['Summary']['ColData'][1:]]
    cols = r['Columns']['Column'][1:]
    for i, col in enumerate(cols):
        if col['ColTitle'] == 'Total':
            ms = [m for m in MONTHS if k.split('/')[1][:7] <= m <= k.split('/')[1][11:18]]
        else:
            ms = [next(m['Value'] for m in col['MetaData'] if m['Name'] == 'StartDate')[:7]]
        bi = len(bank) - 1 if (col['ColTitle'] == 'Total' or len(bank) == 1) else i
        if t_['EndingCash'][i] != bank[bi] + ufv[bi]: c02.append((k, i))
        if t_['NetIncome'][i] != ni_r[i] or t_['NetIncome'][i] != sum(NI[m] for m in ms): c03.append((k, i))
        if t_['CashIncrease'][i] != sum(M03[m] for m in ms): c01.append((k, i))
        sd = sections(ms, SEC_DEF)
        if [t_['OperatingActivities'][i], t_['InvestingActivities'][i], t_['FinancingActivities'][i]] != [sd['OPERATING'], sd['INVESTING'], sd['FINANCING']]:
            c01.append((k, i, 'sections'))
check('I09 every CashFlow column (12 reports): sections sum to the net increase; beginning + increase = ending', not i09, i09[:3])
check('C01 net change ties to QBO: ledger M03 = CashFlow CashIncrease for every month and every six-month total (overrides off: sections too)', not c01, c01[:3])
check('C02 closing cash ties to the balance sheet: CashFlow EndingCash = BalanceSheet bank accounts + Undeposited Funds, every column', not c02, c02[:3])
check('C03 net income ties to the P&L: CashFlow Net Income = ProfitAndLoss NET INCOME = ledger, every column', not c03, c03[:3])
ctl_inc = ctl[ctl.row_group == 'CashIncrease'].set_index('month_key').amount
LBL = {'OPERATING': 'Net cash provided by operating activities', 'INVESTING': 'Net cash provided by investing activities',
       'FINANCING': 'Net cash provided by financing activities'}
ctl_sec = {(r.month_key, s): c(r.amount) for r in ctl.itertuples() for s, l_ in LBL.items() if r.row_label == l_ and r.row_kind == 'Summary'}
check('ctl_qbo_cashflow: one CashIncrease row per month (34), = ledger M03', len(ctl_inc) == 34 and all(c(v) == M03[m] for m, v in ctl_inc.items()))
check('C04 sections tie before overrides: own default-mapping section totals = QBO section totals (ctl_qbo_cashflow), every month',
      len(ctl_sec) == 3 * 34 and all(ctl_sec[(m, s)] == SD[m][s] for m in MONTHS for s in LBL))
ov_acc = list(A.index[A.override_section.notna()])
moved = {m: -sum(chg([m], a_) for a_ in ov_acc) for m in MONTHS}
c05 = all(sum(SO[m][s] - SD[m][s] for s in LBL) == 0 and SO[m]['FINANCING'] - SD[m]['FINANCING'] == moved[m] for m in MONTHS)
check(f'C05 overrides are neutral: per month the override moves the line of credit change ({sum(abs(v) for v in moved.values()) / 100:,.2f} gross) '
      'from operating to financing and the sum across sections is 0', c05 and len(ov_acc) == 1)

# ---- C06 - C10 on the cash postings ----------------------------------------------------------------------------------------------
q = cp[~cp.is_internal_transfer]
dir_m = q.groupby('month_key').amt.sum()
check('C06 direct equals indirect: M11 (non-internal cash postings) = M03 every month', all(int(dir_m.get(m, 0)) == M03[m] for m in MONTHS))
LSEC = T['dim_cf_line'].set_index(['view', 'line_code']).section_code.loc['DIRECT']
ind_t = defaultdict(lambda: defaultdict(int)); ind_t0 = defaultdict(lambda: defaultdict(int)); txd = {}
for r in led[(led.d >= START) & ~led.account_id.isin(CASH)].itertuples():
    ind_t[r.txn_id][SEC_OV[r.account_id]] -= r.amt; ind_t0[r.txn_id][SEC_DEF[r.account_id]] -= r.amt; txd[r.txn_id] = r.month_key
dir_t = defaultdict(lambda: defaultdict(int)); dir_t0 = defaultdict(lambda: defaultdict(int))
for r in q.itertuples():
    dir_t[r.txn_id][LSEC[r.direct_line_code]] += r.amt; dir_t0[r.txn_id][LSEC[r.default_direct_line_code]] += r.amt; txd[r.txn_id] = r.month_key
own_nci = {}
for t_ in txd:
    for s in LBL:
        a1 = ind_t[t_][s] - dir_t[t_][s]; a0 = ind_t0[t_][s] - dir_t0[t_][s]
        if a1 or a0: own_nci[(t_, s)] = (a1, a0)
tab_nci = {(r.txn_id, r.section_code): (c(r.noncash_amount), c(r.noncash_amount_default)) for r in nci.itertuples()}
m13 = defaultdict(int)
for (t_, s), (a1, _) in own_nci.items(): m13[(txd[t_], s)] += a1
gap = all(SO[m][s] - int(q[(q.month_key == m)].amt[q[q.month_key == m].direct_line_code.map(LSEC) == s].sum()) == m13[(m, s)] for m in MONTHS for s in LBL)
check(f'C07 non-cash items explain every section gap: own per-transaction items = fact_noncash_item ({len(tab_nci)} rows), '
      'indirect - direct = sum of items per section and month, items sum to 0 across sections',
      own_nci == tab_nci and gap and all(sum(m13[(m, s)] for s in LBL) == 0 for m in MONTHS))

# own classification: look-through allocation (largest remainder, ties to the lower line) and the mapping table
def lr(total, w):
    sw = sum(w); raw = [total * x / sw for x in w] if sw else [total / len(w)] * len(w)
    base = [int(np.floor(x)) for x in raw]; rem = total - sum(base)
    for i in sorted(range(len(w)), key=lambda i: (-(raw[i] - base[i]), i))[:rem]: base[i] += 1
    return base


MAPD = defaultdict(list)
for r in mp[mp.view == 'DIRECT'].itertuples(): MAPD[r.account_id].append(r)


def line_for(acct, amt, d):
    rs = [r for r in MAPD[acct] if r.effective_from <= d and r.direction in ('ANY', 'IN' if amt > 0 else 'OUT')]
    rs.sort(key=lambda r: (r.is_override, r.effective_from))
    return rs[-1].line_code if rs else 'D_MEMO_UNCLASS'


LL = {t_: g.sort_values('ledger_seq') for t_, g in led.groupby('txn_id')}
own_rows = []
for t_, g in LL.items():
    if g.d.iloc[0] < START: continue
    cl_ = g[g.account_id.isin(CASH)]
    if cl_.empty: continue
    h = g[(g.line_kind == 'header') & g.account_id.isin(CASH)]
    H = h.iloc[0] if len(h) else cl_.iloc[0]
    ttype = g.txn_type.iloc[0]
    for r in g.itertuples():
        if r.ledger_seq == H.ledger_seq: continue
        amt = -r.amt
        if pd.notna(r.link_txn_id) and ttype in ('Payment', 'BillPayment'):
            dl = LL[int(r.link_txn_id)]; dl = dl[dl.line_kind != 'header']
            parts = lr(abs(amt), [abs(x) for x in dl.amt])
            for (_, x), p in zip(dl.iterrows(), parts):
                v = p if amt > 0 else -p
                own_rows.append((t_, int(H.account_id), int(x.account_id), v, line_for(int(x.account_id), v, r.d)))
        else:
            internal = r.account_id in CASH
            own_rows.append((t_, int(H.account_id), int(r.account_id), amt, 'D_MEMO_TRANSFER' if internal else line_for(int(r.account_id), amt, r.d)))
        if r.account_id in CASH:
            own_rows.append((t_, int(r.account_id), int(H.account_id), r.amt, 'D_MEMO_TRANSFER'))
tab_rows = sorted(zip(cp.txn_id, cp.cash_account_id, cp.offset_account_id, cp.amt, cp.direct_line_code))
check(f'C08 lines equal their transactions: own split + settlement look-through + mapping rebuilds all {len(cp):,} cash postings exactly '
      '(transaction, cash account, offset account, amount, direct line)', sorted(own_rows) == tab_rows)
per_txn = q.groupby('txn_id').amt.sum()
check('C08 every transaction: its cash postings (internal excluded) sum to its cash movement; each direct line per month = sum of its transactions',
      all(int(v) == c(tx.loc[t_, 'cash_amount']) - int(cp[(cp.txn_id == t_) & cp.is_internal_transfer].amt.sum()) for t_, v in per_txn.items())
      and q.groupby(['month_key', 'direct_line_code']).amt.sum().equals(q.groupby(['month_key', 'direct_line_code', 'txn_id']).amt.sum().groupby(level=[0, 1]).sum()))
it = cp[cp.is_internal_transfer]
check(f'C09 internal transfers net to zero per transaction and per month ({len(it):,} rows: savings and payroll funding, Undeposited Funds sweeps)',
      (it.groupby('txn_id').amt.sum() == 0).all() and (it.groupby('month_key').amt.sum() == 0).all())
dmap = mp[mp.view == 'DIRECT']
check('C10 nothing unclassified: no D_MEMO_UNCLASS posting; every account has a direct mapping for both directions',
      not (cp.direct_line_code == 'D_MEMO_UNCLASS').any() and all(line_for(a_, 1, END) != 'D_MEMO_UNCLASS' and line_for(a_, -1, END) != 'D_MEMO_UNCLASS'
                                                                 for a_ in A.index))
bv = cp[cp.in_bank_view & ~cp.offset_account_id.isin(BANK)].groupby('month_key').amt.sum()
check('bank-only view derivable: bank-account postings (bank-to-bank transfers excluded) = change in bank balances every month; every bank row has a '
      'bank-view line; Undeposited Funds postings are outside it', all(int(bv.get(m, 0)) == cashbal(m, BANK) - cashbal(prevm[m], BANK) for m in MONTHS)
      and cp[cp.in_bank_view].bank_view_line_code.notna().all() and not cp[cp.cash_kind == 'UF'].in_bank_view.any())

# ---- exceptions recomputed (report spec 10.2) ------------------------------------------------------------------------------------
own_ex = set()
for t_, g in LL.items():
    if g.d.iloc[0] < START: continue
    tt = g.txn_type.iloc[0]; cl_ = g[g.account_id.isin(CASH)]
    if tt == 'JournalEntry' and len(cl_): own_ex.add(('JE_CASH', t_, bool(tx.loc[t_, 'process_id'] == 'P07')))
    if cl_.empty:
        eff = defaultdict(int)
        for r in g.itertuples(): eff[SEC_DEF[r.account_id]] -= r.amt
        if sum(1 for v in eff.values() if v) >= 2: own_ex.add(('NONCASH_CROSS_SECTION', t_, False))
    if -cl_.amt.sum() > 0 and (A.loc[g.account_id, 'account_type'] == 'Long Term Liability').any() and \
            not (A.loc[g.account_id, 'account_subtype'] == 'InterestPaid').any(): own_ex.add(('LOAN_WHOLE', t_, False))
for t_ in held:
    if dt.date.fromisoformat(TX[t_][1]['TxnDate']) <= END - dt.timedelta(days=30): own_ex.add(('UF_STALE', t_, False))
neg_m = [m for m in MONTHS if cum.loc[m, UF] < 0]
for m in neg_m: own_ex.add(('UF_NEGATIVE', m, False))
for t_ in sorted(set(q[q.counterparty_id == 0].txn_id)): own_ex.add(('NO_NAME', int(t_), False))
deps = sorted([(dt.date.fromisoformat(o['TxnDate']), int(o['Id']), o['DepositToAccountRef']['value'], c(o['TotalAmt'])) for o in E['Deposit']
               if o['TxnDate'] >= '2024-01-01' and any(not ln.get('LinkedTxn') for ln in o['Line'])])
for i, (d1, t1, a1, v1) in enumerate(deps):
    if any(a0 == a1 and v0 == v1 and 0 <= (d1 - d0).days <= 3 for d0, t0, a0, v0 in deps[:i]): own_ex.add(('DUP_DEPOSIT', t1, False))
for b in sorted(BANK):
    if A.loc[b, 'last_reconciled_date'] < END: own_ex.add(('BANK_UNRECONCILED', int(b), False))
dep_ = defaultdict(int); adc = defaultdict(int)
for r in led[led.d >= START].itertuples():
    s_ = A.loc[r.account_id, 'account_subtype']
    if s_ == 'Depreciation': dep_[r.month_key] += r.amt
    if s_ == 'AccumulatedDepreciation' and r.amt < 0: adc[r.month_key] -= r.amt
for m in dep_:
    if dep_[m] > adc[m]: own_ex.add(('DEPR_NO_CONTRA', m, False))
tab_ex = set()
for r in exc.itertuples():
    key = (int(r.txn_id) if pd.notna(r.txn_id) else r.month_key if r.exception_code in ('UF_NEGATIVE', 'DEPR_NO_CONTRA') else int(r.account_id))
    tab_ex.add((r.exception_code, key, bool(r.is_routine)))
cnt = exc.groupby('exception_code').size().to_dict()
check(f'exceptions recomputed here = fact_exception ({len(exc)}: {cnt})', own_ex == tab_ex, sorted(own_ex ^ tab_ex)[:6])

# ---- I14 scenarios: present, expected outcome reproduced, nothing else broken ---------------------------------------------------
recs = [json.loads(l) for l in (DATA / 'qbo' / 'expected' / 'scenarios.jsonl').read_text(encoding='utf-8').splitlines()]
check('oracle: expected/scenarios.jsonl = ctl_scenario (12 records); every enabled scenario S01 S02 S03 S04 S06 S07 S08 S13 S18 has a record',
      len(recs) == len(scen) == 12 and {r['scenario_id'] for r in recs} == {'S01', 'S02', 'S03', 'S04', 'S06', 'S07', 'S08', 'S13', 'S18'}
      and all(json.loads(s.expected_json) == r['expected'] and s.txn_ids == ','.join(map(str, r['txn_ids'])) for s, r in zip(scen.itertuples(), recs)))
R_ = {(r['scenario_id'], r['instance']): r for r in recs}
dirl = lambda t_: {k: v / 100 for k, v in q[q.txn_id == t_].groupby('direct_line_code').amt.sum().items()}
exk = lambda t_: {e[0] for e in own_ex if e[1] == t_}
r = R_[('S01', 1)]; e = r['expected']; loc = e['account_id']
mv = {m: v / 100 for m, v in moved.items() if v}
locrows = q[q.offset_account_id == loc]
check(f"I14 S01 line of credit (Other Current Liability) in operating by QBO default, financing by override: {len(r['txn_ids'])} draws and repayments, "
      f"moved {sum(abs(v) for v in mv.values()):,.2f} gross over {len(mv)} months; direct lines follow the override",
      A.loc[loc, 'account_subtype'] == 'LineOfCredit' and A.loc[loc, 'default_section'] == 'OPERATING' and A.loc[loc, 'override_section'] == 'FINANCING'
      and e['moved_by_month'] == mv and c(e['draws_total']) == int(locrows.amt[locrows.amt > 0].sum())
      and set(locrows.direct_line_code) == set(e['direct_override_lines']) and set(locrows.default_direct_line_code) == set(e['direct_default_lines'])
      and sorted(r['txn_ids']) == sorted(set(locrows.txn_id)))
r = R_[('S02', 1)]; t_ = r['txn_ids'][0]
check('I14 S02 asset bought on finance: journal entry fixed asset vs long-term loan, no cash posting, listed as a non-cash item '
      '(investing -41,500.00, financing +41,500.00), flagged', TX[t_][0] == 'JournalEntry' and not (cp.txn_id == t_).any()
      and {s: a1 / 100 for (tt, s), (a1, _) in own_nci.items() if tt == t_} == r['expected']['noncash_items'] and 'NONCASH_CROSS_SECTION' in exk(t_))
r = R_[('S03', 1)]; t_ = r['txn_ids'][0]
check('I14 S03 journal entry to a bank account: classified by its other lines (draws -1,200.00, other operating -50.00) and flagged, not routine',
      dirl(t_) == r['expected']['direct'] and ('JE_CASH', t_, False) in own_ex)
r = R_[('S04', 1)]; t_ = r['txn_ids'][0]; o = TX[t_][1]
check(f"I14 S04 loan payment posted whole: one line to the term loan, all of it financing ({r['expected']['direct']['D_FIN_REPAID']:,.2f}), "
      f"interest {r['expected']['interest_hidden_in_principal']:,.2f} hidden, flagged", len(o['Line']) == 1 and dirl(t_) == r['expected']['direct']
      and exk(t_) == {'LOAN_WHOLE'})
r = R_[('S06', 1)]; e = r['expected']
dep_inc = TX[e['deposit_to_income_id']][1]['Line'][0]
check(f"I14 S06 stale and negative Undeposited Funds: {len(e['stale_payment_ids'])} stale payments ({e['stale_total']:,.2f}), negative at "
      f"{list(e['negative_month_ends'])} ({list(e['negative_month_ends'].values())}), bank bridge holds {e['bank_bridge_uf_at_2026_10']:,.2f}, "
      f"one receipt deposited again straight to income ({e['income_double_counted']:,.2f})",
      sorted(e['stale_payment_ids']) == sorted(x[1] for x in own_ex if x[0] == 'UF_STALE') and list(e['negative_month_ends']) == neg_m
      and {m: c(v) for m, v in e['negative_month_ends'].items()} == {m: int(cum.loc[m, UF]) for m in neg_m}
      and c(e['bank_bridge_uf_at_2026_10']) == int(cum.loc[end, UF]) and A.loc[int(dep_inc['DepositLineDetail']['AccountRef']['value']), 'account_type'] == 'Income'
      and c(dep_inc['Amount']) == c(e['income_double_counted']))
r = R_[('S07', 1)]; e = r['expected']
check(f"I14 S07 duplicate deposit: {e['amount']:,.2f} twice, {e['days_apart']} days apart, the later one flagged and nothing else",
      {x[1] for x in own_ex if x[0] == 'DUP_DEPOSIT'} == {e['flagged_txn_id']} and c(TX[e['matches_txn_id']][1]['TotalAmt']) == c(e['amount']))
s08 = sorted(R_[k]['txn_ids'][0] for k in R_ if k[0] == 'S08')
check('I14 S08 cash with no counterparty: a cash purchase and a deposit line listed under "(no name)" and flagged; no other cash posting lacks a name',
      sorted(x[1] for x in own_ex if x[0] == 'NO_NAME') == s08 and all(dirl(R_[k]['txn_ids'][0]) == R_[k]['expected']['direct'] for k in R_ if k[0] == 'S08'))
r = R_[('S13', 1)]; t_ = r['txn_ids'][0]
fa = [b for b in r['txn_ids'][1:] if any(A.loc[int(l_['AccountBasedExpenseLineDetail']['AccountRef']['value']), 'account_type'] == 'Fixed Asset'
                                          for l_ in TX[b][1]['Line'])]
check(f"I14 S13 one bill payment for an expense bill and an equipment bill: allocated {r['expected']['direct']} (look-through)",
      dirl(t_) == r['expected']['direct'] and len(fa) == 1 and dirl(t_).get('D_INV_PURCHASE', 0) < 0 and dirl(t_).get('D_PAY_SUPP', 0) < 0
      and ('NONCASH_CROSS_SECTION', fa[0], False) in own_ex)
s18 = [R_[k] for k in sorted(R_) if k[0] == 'S18']
u = cp[cp.in_bank_view & (cp.cleared_status == 'Uncleared') & ~cp.offset_account_id.isin(BANK)]
planted = {x['txn_ids'][0] for x in s18}
floatx = set(u.txn_id) - planted
check(f"I14 S18 uncleared items at period end: {len(s18)} planted transactions (two cheques, one deposit) never clear and count in M20; "
      f"the other {len(floatx)} uncleared item(s) are end-of-October float that clears after the as-of date",
      all(tx.loc[x['txn_ids'][0], 'cleared_status'] == 'Uncleared' and pd.isna(tx.loc[x['txn_ids'][0], 'cleared_date']) for x in s18)
      and planted <= set(u.txn_id) and all(str(tx.loc[t_, 'txn_date']) >= '2026-10-20' and str(tx.loc[t_, 'cleared_date']) > '2026-11-05' for t_ in floatx))
scen_tx = set(tx.index[tx.scenario_id.notna()])
natural = {('NONCASH_CROSS_SECTION', t_) for t_ in tx.index[tx.process_id == 'P10']}
stray = [x for x in own_ex if not x[2] and x[0] not in ('BANK_UNRECONCILED', 'UF_NEGATIVE', 'DEPR_NO_CONTRA')
         and x[1] not in scen_tx and (x[0], x[1]) not in natural]
check('I14 nothing else broken: every non-routine exception belongs to a planted scenario, except the documented natural ones '
      '(asset disposal journal, bank accounts not yet reconciled for October); routine ones are the payroll journal entries only',
      not stray and not any(x[0] == 'DEPR_NO_CONTRA' for x in own_ex)
      and {x[1] for x in own_ex if x[2]} == {t_ for t_ in LL if tx.loc[t_, 'process_id'] == 'P07' and tx.loc[t_, 'txn_type'] == 'JournalEntry'}, stray[:5])

# ---- control totals: every row of checks/control_totals_usd.csv recomputed from the ledger here -------------------------------------
INC = set(A.index[A.account_type == 'Income'])
own = {}
periods = [(f'M-{m}', [m]) for m in MONTHS] + [(f'Y-{y}', [m for m in MONTHS if m.startswith(y)]) for y in ('2024', '2025', '2026')] + [('ALL', MONTHS)]
for pk, ms in periods:
    f, l_ = ms[0], ms[-1]
    m01, m02 = cashbal(prevm[f]), cashbal(l_)
    ni = -sum(chg(ms, a_) for a_ in PL); rev = -sum(chg(ms, a_) for a_ in INC)
    own[(pk, 'M01', 'ALL')] = m01; own[(pk, 'M02', 'ALL')] = m02; own[(pk, 'M03', 'ALL')] = m02 - m01; own[(pk, 'M04', 'ALL')] = ni
    own[(pk, 'REVENUE', 'ALL')] = rev
    own[(pk, 'M01_BANK', 'ALL')] = cashbal(prevm[f], BANK); own[(pk, 'M02_BANK', 'ALL')] = cashbal(l_, BANK)
    own[(pk, 'M03_BANK', 'ALL')] = cashbal(l_, BANK) - cashbal(prevm[f], BANK)
    sd, so = sections(ms, SEC_DEF), sections(ms, SEC_OV)
    for s, mc in (('OPERATING', 'M06'), ('INVESTING', 'M07'), ('FINANCING', 'M08')):
        own[(pk, mc, 'QBO_DEFAULT')] = sd[s]; own[(pk, mc, 'OVERRIDES_ON')] = so[s]
    for a_ in A.index:
        if a_ in CASH or a_ in PL: continue
        v = chg(ms, a_)
        if v: own[(pk, 'M05', str(a_))] = -v
    cc_ = cp[cp.month_key.isin(ms)]; qq = cc_[~cc_.is_internal_transfer]
    own[(pk, 'M09', 'ALL')] = int(qq.amt.clip(lower=0).sum()); own[(pk, 'M10', 'ALL')] = int(qq.amt.clip(upper=0).sum())
    own[(pk, 'M11', 'ALL')] = int(qq.amt.sum()); own[(pk, 'M12', 'ALL')] = int(cc_[cc_.is_internal_transfer].amt.sum())
    own[(pk, 'M14', 'ALL')] = int(qq[qq.direct_line_code == 'D_MEMO_UNCLASS'].amt.sum())
    for col, mc in (('direct_line_code', 'DIRECT_LINE'), ('default_direct_line_code', 'DIRECT_LINE_DEFAULT')):
        for k, v in qq.groupby(col).amt.sum().items(): own[(pk, mc, k)] = int(v)
    for s in LBL: own[(pk, 'M13', s)] = sum(m13[(m, s)] for m in ms)
    dl = qq.groupby('direct_line_code').amt.sum()
    own[(pk, 'M15', 'ALL')] = so['OPERATING'] + int(dl.get('D_INV_PURCHASE', 0)) + int(dl.get('D_INV_PROCEEDS', 0))
    if ni: own[(pk, 'M16', 'ALL')] = so['OPERATING'] / ni
    if rev: own[(pk, 'M17', 'ALL')] = so['OPERATING'] / rev
    rc = qq[qq.direct_line_code == 'D_REC_CUST'].groupby('counterparty_id').amt.sum()
    if rc.sum() > 0: own[(pk, 'M19', 'ALL')] = float(np.sort(rc.values)[::-1][:5].sum()) / float(rc.sum())
    uu = cc_[cc_.in_bank_view & (cc_.cleared_status == 'Uncleared') & ~cc_.offset_account_id.isin(BANK)]
    own[(pk, 'M20', 'IN')] = int(uu.amt.clip(lower=0).sum()); own[(pk, 'M20', 'OUT')] = int(uu.amt.clip(upper=0).sum())
    for k, v in cc_[cc_.in_bank_view].groupby('bank_view_line_code').amt.sum().items(): own[(pk, 'BANK_VIEW_LINE', k)] = int(v)
for i, m in enumerate(MONTHS[2:], start=2):
    avg = sum(M03[x] for x in MONTHS[i - 2:i + 1]) / 3
    if avg < 0: own[(f'M-{m}', 'M18', 'ALL')] = cashbal(m) / -avg
RATIO = {'M16', 'M17', 'M18', 'M19'}
ctv = pd.read_csv(DATA / 'checks' / 'control_totals_usd.csv', keep_default_na=False)
got = {(r.period_key, r.metric_code, str(r.scope)): r.value for r in ctv.itertuples()}
diff = [k for k in set(own) | set(got) if k not in own or k not in got or
        (abs(own[k] - got[k]) > 1e-6 if k[1] in RATIO else abs(own[k] / 100 - got[k]) > 0.005)]
check(f'control_totals_usd.csv: all {len(ctv):,} rows reproduced here from the ledger and cash postings (amounts 0.005, ratios 1e-6), no row missing or extra',
      not diff, sorted(diff)[:6])
check('M12 internal transfers = 0 and M14 unclassified = 0 in every period; M11 = M03 (C06) in every period',
      all(own[(pk, 'M12', 'ALL')] == 0 and own[(pk, 'M14', 'ALL')] == 0 and own[(pk, 'M11', 'ALL')] == own[(pk, 'M03', 'ALL')] for pk, _ in periods))

# ---- story and realism (generator spec 8) -----------------------------------------------------------------------------------------
y1 = own[('Y-2024', 'REVENUE', 'ALL')] / 100; y2 = own[('Y-2025', 'REVENUE', 'ALL')] / 100
rc = q[(q.direct_line_code == 'D_REC_CUST') & (q.month_key < '2025-01')].groupby('counterparty_id').amt.sum().sort_values(ascending=False)
top5th = rc.iloc[:max(1, len(rc) // 5)].sum() / rc.sum()
card = led[(led.account_id == int(A.index[A.account_type == 'Credit Card'][0])) & (led.txn_type != 'CreditCardPayment') & (led.d >= START)].amt.sum()
npe = led[(led.d >= START) & led.account_id.isin(A.index[A.account_type.isin(['Expense', 'Cost of Goods Sold'])
          & ~A.account_subtype.isin(['PayrollExpenses', 'InterestPaid', 'BadDebts'])])].amt.sum()
ufsh = len([o for o in E['Payment'] if int(o['DepositToAccountRef']['value']) == UF and c(o['TotalAmt']) > 0]) / len([o for o in E['Payment'] if c(o['TotalAmt']) > 0])
check(f'size S story: revenue 2024 {y1:,.0f} (target 1.2 M +-5 %), 2025 {y2:,.0f} (+{y2 / y1 - 1:.1%}); top fifth of customers {top5th:.0%} of 2024 receipts; '
      f'card {-card / npe:.0%} of non-payroll expenses; {ufsh:.0%} of customer payments via Undeposited Funds',
      abs(y1 / 1.2e6 - 1) <= 0.05 and 0.02 <= y2 / y1 - 1 <= 0.2 and 0.6 <= top5th <= 0.9 and 0.25 <= -card / npe <= 0.35 and 0.3 <= ufsh <= 0.5)
ndraw = len(R_[('S01', 1)]['txn_ids'])
check(f'cash constraint visible: the line of credit is drawn and repaid ({ndraw} transactions), every month has activity, no month without postings',
      ndraw >= 6 and all(m in set(cp.month_key) for m in MONTHS))
print('\nheadline (USD, QBO default sections)')
print(f"{'period':<8}{'revenue':>14}{'net income':>14}{'operating':>14}{'investing':>14}{'financing':>14}{'opening cash':>14}{'closing cash':>14}{'bank only':>14}")
for pk in ('Y-2024', 'Y-2025', 'Y-2026', 'ALL'):
    g = lambda m, s='ALL': own[(pk, m, s)] / 100
    print(f"{pk:<8}{g('REVENUE'):>14,.2f}{g('M04'):>14,.2f}{g('M06', 'QBO_DEFAULT'):>14,.2f}{g('M07', 'QBO_DEFAULT'):>14,.2f}{g('M08', 'QBO_DEFAULT'):>14,.2f}"
          f"{g('M01'):>14,.2f}{g('M02'):>14,.2f}{g('M02_BANK'):>14,.2f}")
print()

# ---- I13 determinism --------------------------------------------------------------------------------------------------------------
if not args.no_rerun:
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run([sys.executable, str(DATA / 'generator' / 'generate.py'), '--out', tmp], capture_output=True, text=True)
        files = [p.relative_to(DATA).as_posix() for sub in ('parquet', 'qbo') for p in sorted((DATA / sub).rglob('*')) if p.is_file()]
        files.append('checks/control_totals_usd.csv')
        same = r.returncode == 0 and all(filecmp.cmp(DATA / f, Path(tmp) / f, shallow=False) for f in files)
        extra = r.returncode == 0 and sorted(p.relative_to(tmp).as_posix() for sub in ('parquet', 'qbo') for p in (Path(tmp) / sub).rglob('*') if p.is_file()) \
            == sorted(f for f in files if not f.startswith('checks'))
        check(f'I13 rerun with seed 42 is byte-identical ({len(files)} files: Parquet, QBO JSON, manifests, control totals)', same and extra, r.stderr[-400:])
print(f'\n{npass} passed, {len(fails)} failed')
print(f'{len(fails)} failure(s): ' + '; '.join(fails) if fails else 'ALL CHECKS GREEN')
sys.exit(1 if fails else 0)

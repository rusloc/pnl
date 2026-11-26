"""Serialisers: Parquet tables (explicit Arrow types, snappy, no pandas metadata) and the QBO-shaped files of generator
spec 10.1 (entities JSONL in Id order, report objects, expected records, manifest with hashes)."""
import datetime as dt
import hashlib
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

import config as C
from util import money, iso
from company import SETUP

MONEY = {'amount', 'opening_balance', 'net_change', 'closing_balance', 'applied_amount', 'allocated_amount', 'indirect_amount', 'direct_amount',
         'noncash_amount', 'noncash_amount_default', 'total_amount', 'open_balance', 'cash_amount', 'current_balance'}
DATES = {'txn_date', 'cleared_date', 'month_end', 'effective_from', 'created_date', 'date', 'last_reconciled_date'}
STAMPS = {'created_at', 'updated_at', 'pulled_at'}
STRS = {'process_id', 'scenario_id', 'qbo_line_id'}
INTS = ('_id', '_seq', 'sort_order', 'year', 'quarter', 'month_num', 'sync_token', 'account_level', 'instance', 'fiscal_year')


def _type(col, vals):
    if col in MONEY: return pa.float64()
    if col in DATES: return pa.date32()
    if col in STAMPS: return pa.timestamp('ms')
    if col in STRS: return pa.string()
    if col.endswith(INTS) or col in INTS: return pa.int32()
    v = next((x for x in vals if x is not None), None)
    if isinstance(v, bool): return pa.bool_()
    if isinstance(v, float): return pa.float64()
    if isinstance(v, int): return pa.int32()
    return pa.string()


def write_table(out, name, rows, cols):
    arrays = []
    for c in cols:
        vals = [r.get(c) for r in rows]
        t = _type(c, vals)
        if c in MONEY: vals = [None if v is None else money(v) for v in vals]
        if t == pa.string(): vals = [None if v is None else str(v) for v in vals]
        arrays.append(pa.array(vals, type=t))
    tbl = pa.table(arrays, names=cols)
    p = Path(out) / 'parquet' / f'{name}.parquet'
    pq.write_table(tbl, p, compression='snappy')
    return dict(table=name, rows=tbl.num_rows, parquet_bytes=p.stat().st_size, columns={f.name: str(f.type) for f in pq.read_schema(p)})


def dumps(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f: f.write(text)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def list_entities(R, D):
    co = R['co']
    ent = {}

    def base(id_, created, updated=None, sync=0):
        return {'domain': 'QBO', 'sparse': False, 'Id': str(id_), 'SyncToken': str(sync),
                'MetaData': {'CreateTime': iso(created), 'LastUpdatedTime': iso(updated or created)}}
    setup = SETUP
    ent['CompanyInfo'] = [dict(base(1, setup), CompanyName=C.COMPANY_NAME, LegalName=C.COMPANY_NAME, Country='US',
                               CompanyAddr={'Line1': '410 Larch Avenue, Suite 3', 'City': 'Port Calder', 'CountrySubDivisionCode': 'OR',
                                            'PostalCode': '97000'},
                               FiscalYearStartMonth='January', CompanyStartDate='2019-03-01', SupportedLanguages='en',
                               NameValue=[{'Name': 'IndustryType', 'Value': 'Professional services'}, {'Name': 'OfferingSku', 'Value': 'QuickBooks Online Plus'}])]
    ent['Preferences'] = [dict(base(1, setup), AccountingInfoPrefs={'FirstMonthOfFiscalYear': 'January', 'UseAccountNumbers': False,
                                                                    'TrackDepartments': False, 'ClassTrackingPerTxnLine': True, 'ClassTrackingPerTxn': False,
                                                                    'TaxYearMonth': 'January'},
                               CurrencyPrefs={'MultiCurrencyEnabled': False, 'HomeCurrency': {'value': C.HOME_CURRENCY}},
                               ReportPrefs={'ReportBasis': 'Accrual', 'CalcAgingReportFromTxnDate': False},
                               SalesFormsPrefs={'CustomTxnNumbers': False, 'AllowDeposit': False}, TaxPrefs={'UsingSalesTax': True})]
    bal = {}
    for x in D['led']: bal[x['account_id']] = bal.get(x['account_id'], 0) + x['amount']
    acc = []
    for a in sorted(co.acc_by_id.values(), key=lambda a: int(a['Id'])):
        cb = bal.get(int(a['Id']), 0)
        nat = 0 if a['AccountType'] in C.PL_TYPES else (cb if a['Classification'] == 'Asset' else -cb)
        o = dict(base(a['Id'], setup), Name=a['Name'], SubAccount=bool(a['parent']), FullyQualifiedName=a['FullyQualifiedName'], Active=True,
                 Classification=a['Classification'], AccountType=a['AccountType'], AccountSubType=a['AccountSubType'], CurrentBalance=money(nat),
                 CurrentBalanceWithSubAccounts=money(nat), CurrencyRef={'value': 'USD', 'name': 'United States Dollar'})
        if a['parent']: o['ParentRef'] = {'value': co.acc[a['parent']]['Id']}
        acc.append(o)
    ent['Account'] = acc
    open_c, open_v = {}, {}
    for t in D['txn']:
        if t['open_balance']:
            s = 1 if t['txn_type'] in ('Invoice', 'Bill') else -1
            d = open_c if t['txn_type'] in ('Invoice', 'CreditMemo') else open_v
            d[t['counterparty_id']] = d.get(t['counterparty_id'], 0) + s * t['open_balance']
    ent['Customer'] = [dict(base(c['Id'], c['created']), DisplayName=c['name'], CompanyName=c['name'], PrintOnCheckName=c['name'], Active=True,
                            Balance=money(open_c.get(int(c['Id']), 0)), BalanceWithJobs=money(open_c.get(int(c['Id']), 0)),
                            SalesTermRef={'value': co.terms[c['terms']]['Id']}, PreferredDeliveryMethod='Email', Taxable=False,
                            CurrencyRef={'value': 'USD', 'name': 'United States Dollar'}) for c in co.cust]
    ent['Vendor'] = [dict(base(v['Id'], v['created']), DisplayName=v['name'], CompanyName=v['name'], PrintOnCheckName=v['name'], Active=True,
                          Balance=money(open_v.get(int(v['Id']), 0)), Vendor1099=v['code'].startswith('V_SUB'),
                          CurrencyRef={'value': 'USD', 'name': 'United States Dollar'}) for v in co.vend.values()]
    emps = []
    for e in co.emp:
        gn, fn = e['name'].split(' ', 1)
        o = dict(base(e['Id'], e['created']), DisplayName=e['name'], GivenName=gn, FamilyName=fn, Active=e['term'] is None,
                 HiredDate=e['hire'].isoformat())
        if e['term']:
            o['ReleasedDate'] = e['term'].isoformat(); o['SyncToken'] = '1'
            o['MetaData']['LastUpdatedTime'] = iso(dt.datetime.combine(e['term'], dt.time(16, 40)))
        emps.append(o)
    ent['Employee'] = emps
    ent['Class'] = [dict(base(v['Id'], setup), Name=v['Name'], SubClass=False, FullyQualifiedName=v['Name'], Active=True) for v in co.cls.values()]
    ent['Item'] = [dict(base(v['Id'], setup), Name=v['Name'], FullyQualifiedName=v['Name'], Type='Service', Active=True, Taxable=v['taxable'],
                        UnitPrice=0, IncomeAccountRef={'value': co.acc[v['income']]['Id'], 'name': co.acc[v['income']]['FullyQualifiedName']})
                   for v in co.items.values()]
    ent['Term'] = [dict(base(v['Id'], setup), Name=v['Name'], Active=True, Type='STANDARD', DueDays=v['DueDays']) for v in co.terms.values()]
    ent['PaymentMethod'] = [dict(base(v['Id'], setup), Name=v['Name'], Active=True, Type=v['Type']) for v in co.pm.values()]
    return ent


def write_qbo(out, R, D, reports, recs, chains):
    q = Path(out) / 'qbo'
    files = []
    ents = list_entities(R, D)
    tx = {}
    for t in R['book'].txns: tx.setdefault(t['type'], []).append(t['qbo'])
    ents.update(tx)
    counts = {}
    for name in sorted(ents):
        objs = sorted(ents[name], key=lambda o: int(o['Id']))
        counts[name] = len(objs)
        p = q / 'entities' / f'{name}.jsonl'
        write_text(p, ''.join(dumps(o) + '\n' for o in objs)); files.append(p)
        env = {'QueryResponse': {name: objs[:3], 'startPosition': 1, 'maxResults': min(3, len(objs))}, 'time': iso(C.AS_OF)}
        p = q / 'query' / f'{name}.json'
        write_text(p, json.dumps(env, ensure_ascii=False, indent=1) + '\n'); files.append(p)
    for rel, obj in reports:
        p = q / 'reports' / rel
        write_text(p, dumps(obj) + '\n'); files.append(p)
    p = q / 'expected' / 'scenarios.jsonl'
    write_text(p, ''.join(dumps(r) + '\n' for r in recs)); files.append(p)
    p = q / 'expected' / 'chains.jsonl'
    write_text(p, ''.join(dumps(c) + '\n' for c in chains)); files.append(p)
    man = dict(dataset='acme_cash_flow_dummy_data', engine_version=C.ENGINE_VERSION, seed=C.SEED, preset=C.PRESET,
               config=dict(profile=C.PROFILE, size=C.SIZE, home_currency=C.HOME_CURRENCY, fiscal_year_start_month=C.FISCAL_YEAR_START_MONTH,
                           start_date=C.START.isoformat(), end_date=C.END.isoformat(), as_of=iso(C.AS_OF), features=C.FEATURES,
                           bank_accounts=['Operating Checking', 'Payroll Checking', 'Business Savings'], undeposited_funds_share=C.UF_SHARE,
                           credit_cards=dict(count=1, share_target=C.CARD_SHARE), scenarios=C.SCENARIOS, modes=['files'],
                           opening_position='established', revenue_y1=C.REVENUE_Y1, growth=C.GROWTH),
               counts=counts,
               files=[dict(path=p.relative_to(q).as_posix(), bytes=p.stat().st_size, sha256=sha(p)) for p in files])
    write_text(q / 'manifest.json', json.dumps(man, ensure_ascii=False, indent=1) + '\n')
    return counts, sum(p.stat().st_size for p in files) + (q / 'manifest.json').stat().st_size, len(files) + 1

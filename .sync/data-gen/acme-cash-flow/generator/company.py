"""Company builder: chart of accounts, lists (customers, vendors, employees, classes, items, terms, payment methods)."""
import datetime as dt
import numpy as np

import config as C
from util import stream, next_working

SETUP = dt.datetime(2023, 12, 28, 10, 15, 0)     # QBO file set up the week before the start (conversion)


class Company:
    pass


def build():
    rng = stream('company')
    co = Company()
    # ---- accounts: own Id sequence, COA order ----------------------------------------------------------------------
    co.acc = {}
    for i, (code, name, typ, sub, parent) in enumerate(C.COA, start=1):
        co.acc[code] = dict(Id=str(i), code=code, Name=name, AccountType=typ, AccountSubType=sub, parent=parent)
    for a in co.acc.values():
        a['FullyQualifiedName'] = (co.acc[a['parent']]['Name'] + ':' + a['Name']) if a['parent'] else a['Name']
        a['Classification'] = C.CLASSIFICATION[a['AccountType']]
    co.acc_by_id = {a['Id']: a for a in co.acc.values()}
    co.aid = {code: a['Id'] for code, a in co.acc.items()}
    # ---- small lists: own sequences ------------------------------------------------------------------------------------
    co.cls = {code: dict(Id=str(i), Name=n) for i, (code, n) in enumerate(C.CLASSES, start=1)}
    co.terms = {n: dict(Id=str(i), Name=n, DueDays=d) for i, (n, d) in enumerate(C.TERMS, start=1)}
    co.pm = {code: dict(Id=str(i), Name=n, Type=t) for i, (code, n, t) in enumerate(C.PAYMENT_METHODS, start=1)}
    co.items = {code: dict(Id=str(i), Name=n, income=inc, taxable=tx, cls=cl) for i, (code, n, inc, tx, cl) in enumerate(C.ITEMS, start=1)}
    co.items_by_id = {v['Id']: dict(v, code=k) for k, v in co.items.items()}
    # ---- customers ---------------------------------------------------------------------------------------------------
    names = [f'{a} {b}' for a in C.CUST_A for b in C.CUST_B]
    pick = rng.choice(len(names), size=66, replace=False)
    first = [w.split()[0] for w in C.CUST_A]
    used, cust_names = set(), []
    for p in pick:                                   # one customer per first word keeps names distinct at a glance
        n = names[p]
        if n.split()[0] in used and len(used) < len(first):
            continue
        used.add(n.split()[0]); cust_names.append(n)
    for p in pick:
        if len(cust_names) >= 66: break
        if names[p] not in cust_names: cust_names.append(names[p])
    custs = []
    n_exist = 46
    new_dates = []
    for y, k in ((2024, 7), (2025, 7), (2026, 6)):
        last_m = 10 if y == 2026 else 12
        for m in sorted(rng.integers(1, last_m + 1, size=k)):
            new_dates.append(next_working(dt.date(y, int(m), int(rng.integers(1, 28)))))
    term_p = [t[2] for t in C.TERMS_MIX]
    for i, nm in enumerate(cust_names[:n_exist + len(new_dates)]):
        start = C.PRESPAN_START if i < n_exist else new_dates[i - n_exist]
        custs.append(dict(name=nm, start=start, end=None, created=SETUP if i < n_exist else
                          dt.datetime.combine(start, dt.time(9, 0)) + dt.timedelta(minutes=int(rng.integers(0, 420))),
                          terms=C.TERMS_MIX[int(rng.choice(len(term_p), p=term_p))][0],
                          chronic=bool(rng.random() < C.CHRONIC_SHARE), pays_check=bool(rng.random() < C.UF_SHARE), retainer=None))
    # long-tail weights: Zipf 1.2 over a random rank, with noise (top fifth ~75 % of revenue)
    rank = rng.permutation(len(custs)) + 1
    for c, r in zip(custs, rank):
        c['weight'] = float(r ** -1.2 * np.exp(rng.normal(0, 0.15)))
    # lost customers: about 10 % a year, never the five largest
    big = set(np.argsort([-c['weight'] for c in custs])[:5])
    for y in (2024, 2025, 2026):
        cand = [i for i, c in enumerate(custs) if c['end'] is None and c['start'] < dt.date(y, 1, 1) and i not in big]
        for i in rng.choice(cand, size=5 if y < 2026 else 4, replace=False):
            custs[int(i)]['end'] = next_working(dt.date(y, int(rng.integers(2, 11)), int(rng.integers(1, 28))))
    # retainers: 10 of the larger existing customers, plus 2 new ones in 2025 and 2 in 2026
    order = [i for i in np.argsort([-c['weight'] for c in custs]) if i < n_exist]
    ret = [int(i) for i in order[1:20:2]]
    newc = [i for i in range(n_exist, len(custs))]
    ret += [i for i in newc if custs[i]['start'].year == 2025][:2] + [i for i in newc if custs[i]['start'].year == 2026][:2]
    for i in ret:
        custs[i]['retainer'] = float(np.round(np.exp(rng.normal(np.log(3_600), 0.35)), -1))
    co.cust = custs
    # ---- employees ---------------------------------------------------------------------------------------------------
    fn = rng.permutation(C.FIRST_NAMES); ln = rng.permutation(C.LAST_NAMES)
    hires = [None] * 6 + [dt.date(2025, 3, 3), dt.date(2025, 10, 6), dt.date(2026, 2, 2)]
    emps = []
    for i, h in enumerate(hires):
        emps.append(dict(name=f'{fn[i]} {ln[i]}', hire=h or dt.date(2021, 1, 4), term=None,
                         salary=float(np.round(rng.uniform(58_000, 98_000), -2)),
                         created=SETUP if h is None else dt.datetime.combine(h, dt.time(8, 30)) - dt.timedelta(days=7)))
    emps[3]['term'] = dt.date(2025, 9, 19)           # one leaver, replaced in October 2025
    co.emp = emps
    # ---- vendors -----------------------------------------------------------------------------------------------------
    vend = []
    for code, (nm, td) in C.VENDORS.items():
        vend.append(dict(code=code, name=nm, terms=td, created=SETUP))
    for j, nm in enumerate(C.SUBCONTRACTORS):
        vend.append(dict(code=f'V_SUB{j + 1}', name=nm, terms=[15, 30, 30, 45, 30, 60, 30][j], created=SETUP))
    for code, (nm, _acct, _n, _med) in C.CARD_MERCHANTS.items():
        vend.append(dict(code=code, name=nm, terms=0, created=SETUP))
    co.vend = {v['code']: v for v in vend}
    # ---- one shared Id sequence for customers, vendors and employees, in creation order --------------------------------
    names_all = [('Vendor', v['code'], v['created']) for v in vend] + [('Employee', i, e['created']) for i, e in enumerate(emps)] + \
                [('Customer', i, c['created']) for i, c in enumerate(custs)]
    kind_rank = {'Vendor': 0, 'Employee': 1, 'Customer': 2}
    names_all.sort(key=lambda t: (t[2], kind_rank[t[0]], str(t[1])))
    for n, (kind, key, _t) in enumerate(names_all, start=1):
        obj = co.vend[key] if kind == 'Vendor' else emps[key] if kind == 'Employee' else custs[key]
        obj['Id'] = str(n); obj['kind'] = kind
    co.sub_codes = [f'V_SUB{j + 1}' for j in range(len(C.SUBCONTRACTORS))]
    return co


def ref(obj, name_key='name'):
    return {'value': obj['Id'], 'name': obj[name_key]}


def aref(co, code):
    a = co.acc[code]
    return {'value': a['Id'], 'name': a['FullyQualifiedName']}

"""Build mockup-v2-data.js for the ACME Cash Flow layout mock v2 (ADR-0019).

Reads data/acme_cash_flow_dummy_data/parquet, writes window.CF_DATA (compact arrays) next to this file,
and asserts the ties to checks/control_totals_usd.csv for every period key it can recompute.
Run:  fabric-data\\.venv\\Scripts\\python.exe "docs\\design\\cash flow statement\\build-mock-v2-data.py"
Exit 1 on any failed tie.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import sys
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as pq

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = ROOT / 'data' / 'acme_cash_flow_dummy_data'
OUT = HERE / 'mockup-v2-data.js'
DAY0 = dt.date(2024, 1, 1)
TOL = 0.005  # USD; ratios compared at 1e-6 relative


def rows(name: str) -> list[dict]:
    return pq.read_table(DATA / 'parquet' / f'{name}.parquet').to_pylist()


def cents(x: float) -> int:
    return int(round(x * 100))


acc = {a['account_id']: a for a in rows('dim_account')}
lines = [r for r in rows('dim_cf_line') if r['view'] == 'DIRECT' and r['line_kind'] == 'data']
lines.sort(key=lambda r: r['sort_order'])
line_ix = {r['line_code']: i for i, r in enumerate(lines)}
SEC = {'OPERATING': 'OP', 'INVESTING': 'INV', 'FINANCING': 'FIN'}

months: list[str] = []
y, m = 2024, 1
while (y, m) <= (2026, 10):
    months.append(f'{y}-{m:02d}')
    y, m = (y + 1, 1) if m == 12 else (y, m + 1)
mix = {k: i for i, k in enumerate(months)}
N = len(months)

# ---------- balances (debit positive) ----------
bal: dict[int, dict[str, dict]] = defaultdict(dict)
for r in rows('fact_account_balance'):
    bal[r['account_id']][r['month_key']] = r


def net(aid: int, mk: str) -> float:
    r = bal[aid].get(mk)
    return r['net_change'] if r else 0.0


def close(aid: int, mk: str) -> float:
    r = bal[aid].get(mk)
    return r['closing_balance'] if r else 0.0


def opening(aid: int, mk: str) -> float:
    r = bal[aid].get(mk)
    return r['opening_balance'] if r else 0.0


cash_ids = [a for a, r in acc.items() if r['is_cash']]
pl_ids = [a for a, r in acc.items() if r['is_pl']]
income_ids = [a for a, r in acc.items() if r['account_type'] == 'Income']

cash_open = [round(sum(opening(a, mk) for a in cash_ids), 2) for mk in months]
cash_close = [round(sum(close(a, mk) for a in cash_ids), 2) for mk in months]
ni = [round(-sum(net(a, mk) for a in pl_ids), 2) for mk in months]
rev = [round(-sum(net(a, mk) for a in income_ids), 2) for mk in months]

# ---------- indirect statement, S01 override on ----------
def section(a: dict) -> str | None:
    s = a['override_section'] or a['default_section']
    if s not in SEC:
        return None
    if a['account_subtype'] == 'AccumulatedDepreciation':
        return 'DEP'
    return SEC[s]


stmt_acc = []  # [id, label, group, sort]
adj: dict[int, list[float]] = {}
for aid, a in sorted(acc.items(), key=lambda kv: kv[1]['sort_order']):
    if a['is_pl'] or a['is_cash']:
        continue
    g = section(a)
    if g is None:
        continue
    vals = [round(-net(aid, mk), 2) for mk in months]
    if not any(abs(v) >= 0.005 for v in vals):
        continue
    fq = a['fully_qualified_name'].replace(':', ' · ')
    if g == 'DEP':
        fq = 'Depreciation · ' + acc[a['parent_account_id']]['account_name']
    stmt_acc.append([aid, fq, g, a['sort_order'], 1 if a['override_section'] else 0])
    adj[aid] = vals

# ---------- direct view: cash postings → ledger rows ----------
txn = {t['txn_id']: t for t in rows('fact_txn')}
cps = {c['counterparty_id']: c['counterparty_name'] for c in rows('dim_counterparty')}
types: list[str] = []
memos: list[str] = []
memo_ix: dict[str, int] = {}
CLR = {'Reconciled': 'R', 'Cleared': 'C', 'Uncleared': 'U', 'NotApplicable': 'N'}

groups: dict[tuple, dict] = {}
for p in rows('fact_cash_posting'):
    if p['is_internal_transfer']:
        continue
    code = p['direct_line_code']
    if code not in line_ix:
        raise SystemExit(f'posting {p["posting_id"]}: line {code} not a direct data line')
    sign = 1 if p['amount'] > 0 else -1
    k = (p['txn_id'], code, p['counterparty_id'], sign)
    g = groups.get(k)
    if g is None:
        g = groups[k] = {'d': (p['txn_date'] - DAY0).days, 'c': 0, 'memo': p['memo'], 'cl': p['cleared_status'], 'n': 0,
                         'offs': set(), 'docs': []}
    g['c'] += cents(p['amount'])
    g['n'] += 1
    g['offs'].add(p['offset_account_id'])
    if p['settled_txn_id'] is not None and p['settled_txn_id'] not in g['docs']:
        g['docs'].append(p['settled_txn_id'])
    if not g['memo'] and p['memo']:
        g['memo'] = p['memo']

ledger = []
term_prin = [0] * N  # cents, principal repaid on term + vehicle loans (accounts 22, 23)
for (tid, code, cp, sign), g in sorted(groups.items(), key=lambda kv: (kv[1]['d'], kv[0][0], line_ix[kv[0][1]], kv[0][3])):
    t = txn[tid]
    if t['txn_type'] not in types:
        types.append(t['txn_type'])
    memo = g['memo'] or t['private_note'] or ''
    if not memo and g['docs']:  # no note on the payment: name the settled document(s), as QBO's "Linked" column does
        d0 = txn[g['docs'][0]]
        memo = f"{d0['txn_type']} {d0['doc_number'] or d0['txn_id']}" + (f" + {len(g['docs']) - 1} more" if len(g['docs']) > 1 else '')
    if memo not in memo_ix:
        memo_ix[memo] = len(memos)
        memos.append(memo)
    ledger.append([g['d'], line_ix[code], cp, tid, types.index(t['txn_type']), t['doc_number'] or '', g['c'],
                   CLR[g['cl']], memo_ix[memo]])
    if code == 'D_FIN_REPAID' and g['offs'] <= {22, 23}:
        mk = (DAY0 + dt.timedelta(days=g['d'])).strftime('%Y-%m')
        term_prin[mix[mk]] += -g['c']
    elif code == 'D_FIN_REPAID' and g['offs'] & {22, 23}:
        raise SystemExit(f'txn {tid}: mixed loan accounts in one repayment group {g["offs"]}')

used_cp = sorted({r[2] for r in ledger})

# ---------- KPI inputs (monthly) ----------
PAYROLL = {38, 39, 40, 41}
spend_ids = [a for a, r in acc.items() if r['account_type'] in ('Cost of Goods Sold', 'Expense')
             and a not in PAYROLL and a not in (58, 59)]
kpi = {
    'rev': rev,
    'ni': ni,
    'int': [round(net(59, mk), 2) for mk in months],         # interest expense (P&L)
    'dep': [round(net(60, mk), 2) for mk in months],         # depreciation expense (P&L)
    'ar': [round(close(4, mk), 2) for mk in months],         # A/R closing, debit +
    'ap': [round(-close(14, mk), 2) for mk in months],       # A/P closing, credit as +
    'spend': [round(sum(net(a, mk) for a in spend_ids), 2) for mk in months],  # DPO base
    'debt': [round(-(close(20, mk) + close(22, mk) + close(23, mk)), 2) for mk in months],
    'termPrin': [c / 100 for c in term_prin],
}

# ---------- control totals ----------
ctl: dict[tuple[str, str, str], float] = {}
with open(DATA / 'checks' / 'control_totals_usd.csv', newline='') as f:
    for r in csv.DictReader(f):
        ctl[(r['period_key'], r['metric_code'], r['scope'])] = float(r['value'])

periods = {f'M-{mk}': [i] for i, mk in enumerate(months)}
for yr in (2024, 2025, 2026):
    periods[f'Y-{yr}'] = [i for i, mk in enumerate(months) if mk.startswith(str(yr))]
periods['ALL'] = list(range(N))


def recompute(ix: list[int]) -> dict[tuple[str, str], float]:
    a, b = ix[0], ix[-1]
    sec = {'OP': sum(ni[i] for i in ix), 'INV': 0.0, 'FIN': 0.0}
    for row in stmt_acc:
        g = 'OP' if row[2] == 'DEP' else row[2]
        sec[g] += sum(adj[row[0]][i] for i in ix)
    dl = defaultdict(int)
    cin = cout = 0
    for r in ledger:
        mk = (DAY0 + dt.timedelta(days=r[0])).strftime('%Y-%m')
        if mix[mk] in ix:
            dl[lines[r[1]]['line_code']] += r[6]
            cin += max(r[6], 0)
            cout += min(r[6], 0)
    out = {
        ('M01', 'ALL'): cash_open[a], ('M02', 'ALL'): cash_close[b], ('M03', 'ALL'): cash_close[b] - cash_open[a],
        ('M04', 'ALL'): sum(ni[i] for i in ix), ('REVENUE', 'ALL'): sum(rev[i] for i in ix),
        ('M06', 'OVERRIDES_ON'): sec['OP'], ('M07', 'OVERRIDES_ON'): sec['INV'], ('M08', 'OVERRIDES_ON'): sec['FIN'],
        ('M09', 'ALL'): cin / 100, ('M10', 'ALL'): cout / 100,
        ('M15', 'ALL'): sec['OP'] + (dl['D_INV_PURCHASE'] + dl['D_INV_PROCEEDS']) / 100,
    }
    # Cash balance card: opening + cash in + cash out (internal transfers excluded) = closing
    if abs(cash_open[a] + (cin + cout) / 100 - cash_close[b]) > TOL:
        raise SystemExit(f'cash roll-forward breaks for months {a}..{b}')
    nis = out[('M04', 'ALL')]
    if abs(nis) > 0.005:
        out[('M16', 'ALL')] = sec['OP'] / nis
    for row in stmt_acc:
        out[('M05', str(row[0]))] = sum(adj[row[0]][i] for i in ix)
    for code, v in dl.items():
        out[('DIRECT_LINE', code)] = v / 100
    return out


fails: list[str] = []
checked = 0
show: dict[str, list] = {'M-2026-10': [], 'Y-2026': []}
for pk, ix in periods.items():
    got = recompute(ix)
    # every control row of these metrics must be reproduced (no missing, no extra non-zero)
    want = {(mc, sc): v for (p, mc, sc), v in ctl.items()
            if p == pk and ((mc, sc) in got or mc in ('DIRECT_LINE', 'M05'))}
    keys = set(want) | {k for k in got if k[0] in ('DIRECT_LINE', 'M05')}
    for k in sorted(keys):
        w = want.get(k, 0.0)
        g = got.get(k, 0.0)
        rel = k[0] == 'M16'
        ok = abs(g - w) <= (1e-6 * max(1, abs(w)) if rel else TOL)
        checked += 1
        if not ok:
            fails.append(f'{pk} {k[0]} {k[1]}: page {g:,.6f} vs control {w:,.6f}')
        if pk in show and k[0] != 'M05':
            show[pk].append((k[0], k[1], w, g, ok))

for pk, items in show.items():
    print(f'\n{pk}')
    print(f'  {"metric":<12}{"scope":<16}{"control":>16}{"recomputed":>16}  ok')
    for mc, sc, w, g, ok in items:
        print(f'  {mc:<12}{sc:<16}{w:>16,.2f}{g:>16,.2f}  {"PASS" if ok else "FAIL"}')

# ---------- page self-check targets: every month and year (the page checks them all on load) ----------
CTL_KEYS = {'M01', 'M02', 'M03', 'M04', 'M06', 'M07', 'M08', 'M09', 'M10', 'M15', 'M16', 'DIRECT_LINE'}
ctl_out = {}
for pk in [k for k in periods if k != 'ALL']:
    ctl_out[pk] = {f'{mc}|{sc}': v for (p, mc, sc), v in ctl.items()
                   if p == pk and mc in CTL_KEYS and (sc in ('ALL', 'OVERRIDES_ON') or mc == 'DIRECT_LINE')}

data = {
    'meta': {'asOf': '2026-11-05', 'day0': DAY0.isoformat(), 'months': months, 'company': 'ACME Advisory Services LLC'},
    'cash': {'open': cash_open, 'close': cash_close},
    'stmt': {'acc': [[r[0], r[1], r[2], r[4]] for r in stmt_acc], 'adj': {str(k): v for k, v in adj.items()}},
    'lines': [[r['line_code'], SEC[r['section_code']], r['line_label'], r['usual_direction']] for r in lines],
    'types': types,
    'memos': memos,
    'cps': {str(c): cps[c] for c in used_cp},
    # ledger row: [day since day0, line ix, counterparty id, txn id, type ix, doc no, cents (in +, out −), cleared R/C/U/N, memo ix]
    'ledger': ledger,
    'kpi': kpi,
    'ctl': ctl_out,
}
js = '/* generated by build-mock-v2-data.py from data/acme_cash_flow_dummy_data (seed 42); do not edit */\n' \
     'window.CF_DATA=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n'
OUT.write_text(js, encoding='utf-8')

print(f'\nchecked {checked} control values over {len(periods)} periods; ledger rows {len(ledger)}; '
      f'statement accounts {len(stmt_acc)}; {OUT.name} {len(js.encode()) / 1024:,.0f} kB')
if fails:
    print(f'\n{len(fails)} FAILED:')
    for x in fails[:60]:
        print('  ' + x)
    sys.exit(1)
print('ALL PASS')

"""Control totals (report spec measures M01-M20, direct lines, bank-only view) computed from the Parquet tables as
written. Integer cents inside, USD with cents (ratios to 1e-6) in checks/control_totals_usd.csv."""
from collections import defaultdict
import pandas as pd


def _c(s): return (s * 100).round().astype('int64')


def control_totals(T):
    acct = T['dim_account'].set_index('account_id')
    bal = T['fact_account_balance'].copy(); bal['chg'] = _c(bal.net_change); bal['clo'] = _c(bal.closing_balance)
    cp = T['fact_cash_posting'].copy(); cp['amt'] = _c(cp.amount)
    nci = T['fact_noncash_item'].copy(); nci['amt'] = _c(nci.noncash_amount)
    months = sorted(m for m in bal.month_key.unique() if m >= '2024-01')
    periods = [(f'M-{m}', [m]) for m in months] + [(f'Y-{y}', [m for m in months if m.startswith(y)]) for y in ('2024', '2025', '2026')] + \
              [('ALL', months)]
    prev = {m: (months[i - 1] if i else '2023-12') for i, m in enumerate(months)}
    cash = set(acct.index[acct.is_cash]); bank = set(acct.index[acct.is_bank]); pl = set(acct.index[acct.is_pl])
    inc = set(acct.index[acct.account_type == 'Income'])
    sec_def = acct.default_section.replace({'NET_INCOME': 'OPERATING'})
    sec_ov = acct.override_section.fillna(sec_def).replace({'NET_INCOME': 'OPERATING'})
    clo = bal.set_index(['account_id', 'month_key']).clo
    chg_m = bal.groupby(['month_key', 'account_id']).chg.sum()
    out = []

    def put(pk, metric, scope, v, ratio=False):
        out.append((pk, metric, scope, round(v, 6) if ratio else round(v / 100, 2)))
    m03_by_month = {}
    for pk, ms in periods:
        first, last = ms[0], ms[-1]
        m01 = sum(clo[(a, prev[first])] for a in cash); m02 = sum(clo[(a, last)] for a in cash)
        b01 = sum(clo[(a, prev[first])] for a in bank); b02 = sum(clo[(a, last)] for a in bank)
        ch = chg_m[chg_m.index.get_level_values(0).isin(ms)].groupby(level=1).sum()
        ni = -int(ch[ch.index.isin(pl)].sum()); rev = -int(ch[ch.index.isin(inc)].sum())
        put(pk, 'M01', 'ALL', m01); put(pk, 'M02', 'ALL', m02); put(pk, 'M03', 'ALL', m02 - m01); put(pk, 'M04', 'ALL', ni)
        put(pk, 'REVENUE', 'ALL', rev)
        put(pk, 'M01_BANK', 'ALL', b01); put(pk, 'M02_BANK', 'ALL', b02); put(pk, 'M03_BANK', 'ALL', b02 - b01)
        if len(ms) == 1: m03_by_month[first] = m02 - m01
        secs = {}
        for scope, smap in (('QBO_DEFAULT', sec_def), ('OVERRIDES_ON', sec_ov)):
            s = defaultdict(int); s['OPERATING'] = ni
            for a, v in ch.items():
                if a in cash or a in pl or not v: continue
                s[smap[a]] -= int(v)
            for k, m in (('OPERATING', 'M06'), ('INVESTING', 'M07'), ('FINANCING', 'M08')): put(pk, m, scope, s[k])
            secs[scope] = s
        for a, v in ch.items():
            if a in cash or a in pl or not v: continue
            put(pk, 'M05', str(a), -int(v))
        c = cp[cp.month_key.isin(ms)]
        q = c[~c.is_internal_transfer]
        m09, m10 = int(q.amt[q.amt > 0].sum()), int(q.amt[q.amt < 0].sum())
        put(pk, 'M09', 'ALL', m09); put(pk, 'M10', 'ALL', m10); put(pk, 'M11', 'ALL', m09 + m10)
        put(pk, 'M12', 'ALL', int(c.amt[c.is_internal_transfer].sum()))
        put(pk, 'M14', 'ALL', int(q.amt[q.direct_line_code == 'D_MEMO_UNCLASS'].sum()))
        dl = q.groupby('direct_line_code').amt.sum()
        for k, v in dl.items(): put(pk, 'DIRECT_LINE', k, int(v))
        for k, v in q.groupby('default_direct_line_code').amt.sum().items(): put(pk, 'DIRECT_LINE_DEFAULT', k, int(v))
        n = nci[nci.month_key.isin(ms)].groupby('section_code').amt.sum()
        for s in ('OPERATING', 'INVESTING', 'FINANCING'): put(pk, 'M13', s, int(n.get(s, 0)))
        m06 = secs['OVERRIDES_ON']['OPERATING']
        put(pk, 'M15', 'ALL', m06 + int(dl.get('D_INV_PURCHASE', 0)) + int(dl.get('D_INV_PROCEEDS', 0)))
        if ni: put(pk, 'M16', 'ALL', m06 / ni, True)
        if rev: put(pk, 'M17', 'ALL', m06 / rev, True)
        rc = q[q.direct_line_code == 'D_REC_CUST'].groupby('counterparty_id').amt.sum().sort_values(ascending=False, kind='mergesort')
        if rc.sum() > 0: put(pk, 'M19', 'ALL', float(rc.iloc[:5].sum()) / float(rc.sum()), True)
        u = c[c.in_bank_view & (c.cleared_status == 'Uncleared') & ~c.offset_account_id.isin(bank)]
        put(pk, 'M20', 'IN', int(u.amt[u.amt > 0].sum())); put(pk, 'M20', 'OUT', int(u.amt[u.amt < 0].sum()))
        b = c[c.in_bank_view]
        for k, v in b.groupby('bank_view_line_code').amt.sum().items(): put(pk, 'BANK_VIEW_LINE', k, int(v))
    for i, m in enumerate(months):
        if i < 2: continue
        avg = sum(m03_by_month[x] for x in months[i - 2:i + 1]) / 3
        if avg < 0:
            m02 = next(v for p, k, s, v in out if p == f'M-{m}' and k == 'M02')
            out.append((f'M-{m}', 'M18', 'ALL', round(m02 * 100 / -avg, 6)))
    df = pd.DataFrame(out, columns=['period_key', 'metric_code', 'scope', 'value'])
    return df.sort_values(['period_key', 'metric_code', 'scope'], kind='mergesort').reset_index(drop=True)

#!/usr/bin/env python3
"""Re-read the Nordmark Retail dataset (Parquet) and assert the contract of docs/Requirements-exec.md.

Usage:  python checks/verify.py [--data <dataset folder>] [--no-rerun]     (default: the folder above checks/)
Independent of the generator: every control total is recomputed here from the Parquet files with its own code.
  ET-01  control totals per scope x period x metric (amounts 0.005, ratios 1e-6, counts and codes exact)
  ET-02  the v5 Week-43 story at display precision (values, deltas, chips, counts 7 / 3 / 2)
  ET-03  overall dot orange at Week 43; a dot for every FY2026 period x scope
  ET-04  retail calendar recomputed from dates (4-5-4, Jan anchor, LY / LW keys, no 53-week year)
  ET-05  LY by week key, not by date (FY2026 W43 vs the date-shifted week)
  ET-20  byte-identical rerun of generate.py with the same seed (skipped with --no-rerun)
Exit code 0 = all checks green, 1 = at least one failure.
"""
import argparse, filecmp, json, subprocess, sys, tempfile
from datetime import date, timedelta
from pathlib import Path
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
ap = argparse.ArgumentParser(); ap.add_argument('--data', default=str(Path(__file__).resolve().parent.parent)); ap.add_argument('--no-rerun', action='store_true')
args = ap.parse_args(); D = Path(args.data); fails = []
MINUS = '−'

def check(name, ok, detail=''):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  - ' + str(detail) if detail and not ok else ''}")
    if not ok: fails.append(name)

# ---- load + manifest ------------------------------------------------------------------------------------------------------
man = json.loads((D / 'parquet' / 'manifest.json').read_text())
T = {}
for t in man['tables']:
    T[t['table']] = df = pd.read_parquet(D / 'parquet' / f"{t['table']}.parquet")
    import pyarrow.parquet as pq
    sch = pq.read_schema(D / 'parquet' / f"{t['table']}.parquet")
    check(f"{t['table']}: rows and column types = manifest", len(df) == t['rows'] and {f.name: str(f.type) for f in sch} == t['columns'], f"{len(df)} vs {t['rows']}")
check('18 tables, seed 20261028, as-of 2026-10-25, current week FY2026-W43',
      len(T) == 18 and man['seed'] == 20261028 and man['as_of'] == '2026-10-25' and man['current_week_key'] == 'FY2026-W43')
check('Parquet total under 25 MB', sum(t['parquet_bytes'] for t in man['tables']) < 25e6)
wk, dd, st, cat = T['dim_week'], T['dim_date'], T['dim_store'], T['dim_category']
fs, fb, fi, ff = T['fact_sales_week'], T['fact_budget_week'], T['fact_inventory_week'], T['fact_forecast_week']
fa, fr, fo, fp, fsi = T['fact_availability_week'], T['fact_receipts_week'], T['fact_opex_week'], T['fact_po_week'], T['fact_supplier_income_week']
sup, kpi, rule, tgt = T['dim_supplier'], T['dim_kpi'], T['param_status_rule'].set_index('rule_code'), T['param_target']

# ---- ET-04 calendar ----------------------------------------------------------------------------------------------------------
def fy_start(y): d = date(y, 1, 1); return d - timedelta(days=d.weekday())
rows = []
for y in (2025, 2026):
    s0 = fy_start(y); assert (fy_start(y + 1) - s0).days == 364
    for n in range(52):
        ws = s0 + timedelta(7 * n); w = n + 1; p = 1 + sum(w > c for c in np.cumsum([4, 5, 4] * 4)[:-1])
        pw = [k for k in range(1, 53) if 1 + sum(k > c for c in np.cumsum([4, 5, 4] * 4)[:-1]) == p]
        rows.append(dict(week_key=f'FY{y}-W{w:02d}', week_start=ws, week_end=ws + timedelta(6), fy=y, week_of_fy=w, quarter=(w - 1) // 13 + 1,
                         period=p, week_of_period=w - pw[0] + 1, period_start=s0 + timedelta(7 * (pw[0] - 1)), period_end=s0 + timedelta(7 * pw[-1] - 1),
                         ly_week_key=f'FY{y - 1}-W{w:02d}' if y == 2026 else None, season_week=w - 31 if 32 <= w <= 51 else None))
cal = pd.DataFrame(rows)
w2 = wk.copy()
for c in ['week_start', 'week_end', 'period_start', 'period_end']: w2[c] = pd.to_datetime(w2[c]).dt.date
ok = (len(wk) == 104 and (w2.week_key.values == cal.week_key.values).all()
      and all((w2[c].values == cal[c].values).all() for c in ['week_start', 'week_end', 'fy', 'week_of_fy', 'quarter', 'period', 'week_of_period', 'period_start', 'period_end'])
      and (w2.ly_week_key.fillna('').values == cal.ly_week_key.fillna('').values).all()
      and (w2.lw_week_key.fillna('').values == np.r_[[''], w2.week_key.values[:-1]]).all()
      and (w2.season_week.fillna(0).astype(int).values == cal.season_week.fillna(0).astype(int).values).all())
check('ET-04 dim_week: 104 weeks recomputed from dates (Jan-anchored 4-5-4, LY / LW keys, seasons), no 53-week year', ok)
r43 = w2.set_index('week_key').loc['FY2026-W43']
check('ET-04 FY2026 W43 = 19-25 Oct 2026, P10 week 4 of 4, P10 = 28 Sep - 25 Oct, LY = FY2025-W43 (20-26 Oct 2025), LW = FY2026-W42, season week 12',
      str(r43.week_start) == '2026-10-19' and str(r43.week_end) == '2026-10-25' and r43.period == 10 and r43.week_of_period == 4
      and str(r43.period_start) == '2026-09-28' and r43.ly_week_key == 'FY2025-W43' and r43.lw_week_key == 'FY2026-W42' and r43.season_week == 12
      and str(w2.set_index('week_key').loc['FY2025-W43'].week_start) == '2025-10-20')
check('ET-04 FY2026 = 29 Dec 2025 - 27 Dec 2026; YTD = 43 weeks from 29 Dec 2025', str(w2.week_start[52]) == '2025-12-29' and str(w2.week_end[103]) == '2026-12-27')
check('ET-04 is_actual = through FY2026-W43 (95 weeks)', wk.is_actual.sum() == 95 and wk.is_actual.values[:95].all())
dmap = dict(zip(pd.to_datetime(dd.date).dt.date, dd.week_key))
check('dim_date: 728 days, each mapped to the week that contains it', len(dd) == 728
      and all(dmap[r.week_start + timedelta(k)] == r.week_key for r in cal.itertuples() for k in (0, 6)))

# ---- integrity -----------------------------------------------------------------------------------------------------------------
keys = set(wk.week_key); sites = set(st.store_code); cats = set(cat.category_code); sups = set(sup.supplier_code)
fk = all(set(df.week_key) <= keys for df in [fs, fb, fi, ff, fa, fr, fo, fp, fsi]) and all(set(df.store_code.dropna()) <= sites for df in [fs, fb, fi, ff, fa, fr, fo]) \
     and all(set(df.category_code) <= cats for df in [fs, fb, fi, ff, fa, fr]) and set(fp.supplier_code) <= sups and set(fsi.supplier_code) <= sups \
     and set(fo.cost_type_code) <= set(T['dim_cost_type'].cost_type_code)
check('foreign keys: every fact key exists in its dimension', fk)
uq = all(not df.duplicated(k).any() for df, k in [(fs, ['week_key', 'store_code', 'category_code']), (fb, ['week_key', 'store_code', 'category_code']),
         (fi, ['week_key', 'store_code', 'category_code']), (ff, ['week_key', 'store_code', 'category_code']), (fa, ['week_key', 'store_code', 'category_code']),
         (fr, ['week_key', 'store_code', 'category_code']), (fp, ['week_key', 'supplier_code']), (fsi, ['week_key', 'supplier_code']),
         (fo, ['scenario_code', 'week_key', 'cost_type_code', 'store_code'])])
check('fact grains unique (week x site x category, week x supplier, scenario x week x cost type x site)', uq)
scope = st.set_index('store_code').scope_code; chan = st.set_index('store_code').channel_code
stores = st[st.channel_code == 'STORE']
check('dim_store: 145 stores (NL 84, BE 61), 3 closed in FY2026, ONLINE, WHOLESALE, 2 DCs; scope_code = country for stores, ONLINE for online, null otherwise',
      len(stores) == 145 and (stores.country == 'NL').sum() == 84 and stores.close_date.notna().sum() == 3
      and pd.to_datetime(stores.close_date.dropna()).between('2025-12-29', '2026-10-25').all()
      and (stores.scope_code == stores.country).all() and list(st[st.channel_code != 'STORE'].scope_code.fillna('-')) == ['ONLINE', '-', '-', '-'])
check('sales rows: gross = net + markdown + returns (to the cent); amounts >= 0', ((fs.gross_sales - fs.net_sales - fs.markdown_value - fs.returns).abs() < .005).all()
      and (fs[['gross_sales', 'net_sales', 'markdown_value', 'returns', 'cogs_landed', 'back_margin_alloc']] >= 0).all().all())
check('budget rows: FY2026 W1-W52 only; gross = net + markdown + implied returns >= 0', set(fb.week_key) == set(wk.week_key[52:])
      and ((fb.gross_sales_bud - fb.net_sales_bud - fb.markdown_bud) >= -.005).all())
check('sales only in actual weeks; DCs never sell; wholesale and DCs carry no LFL flag', set(fs.week_key) == set(wk.week_key[:95])
      and not fs.store_code.isin(['DC_TIL', 'DC_WIL']).any() and not fs[fs.store_code.map(chan) != 'STORE'][['is_lfl', 'is_lfl_as_ly']].any().any())
check('ET-12 NL + BE + ONLINE + WHOLESALE = ALL net sales, every week', (fs.groupby('week_key').net_sales.sum()
      - fs.assign(s=fs.store_code.map(scope).fillna('WHS')).groupby(['week_key', 's']).net_sales.sum().groupby('week_key').sum()).abs().max() < .01
      and set(fs.store_code.map(scope).fillna('WHS')) == {'NL', 'BE', 'ONLINE', 'WHS'})
x = fsi.assign(c=fsi.supplier_code.map(sup.set_index('supplier_code').primary_category_code), v=fsi.rebate_accrual + fsi.promo_funding + fsi.listing_fees)
d_ = x.groupby(['week_key', 'c']).v.sum() - fs.groupby(['week_key', 'category_code']).back_margin_alloc.sum().rename_axis(['week_key', 'c'])
check('ET-07 back margin: supplier accruals = sum of back_margin_alloc per week x category (and ALL)', d_.abs().max() < .01 and len(d_) == 95 * 9)
check('supplier income provisional exactly in P10 FY2026 (W40-W43, true-up 10 Nov)', set(fsi[fsi.is_provisional].week_key) == {f'FY2026-W{w}' for w in range(40, 44)}
      and not fsi[~fsi.is_provisional].week_key.isin([f'FY2026-W{w}' for w in range(40, 44)]).any())
check('availability: in-stock <= ranged; ranged = top-500 SKUs x 7 days per open store', (fa.in_stock_sku_days <= fa.ranged_sku_days).all()
      and (fa.groupby(['week_key', 'store_code']).ranged_sku_days.sum() == 3500).all() and fa.store_code.map(chan).eq('STORE').all())
check('PO lines: 0 <= OTIF <= due', ((fp.po_lines_otif >= 0) & (fp.po_lines_otif <= fp.po_lines_due) & (fp.po_lines_due > 0)).all())
ctg = cat.set_index('category_code').cover_target_wks
cw = ff.assign(x=ff.forecast_cogs * ff.category_code.map(ctg)).groupby('week_key')[['x', 'forecast_cogs']].sum()
check('ET-08 cover target = forecast-COGS-weighted category targets = 9.5 at ALL in every week', ((cw.x / cw.forecast_cogs) - 9.5).abs().max() < 1e-6)
pt = tgt.set_index(['kpi_code', 'category_code']).target_value
check('param_target = dim_category targets; ALL rows 97 % / 95 % / 2.5x / 9.5 wks / 62 %',
      all(abs(pt[('GMROI', c)] - g) < 1e-9 and abs(pt[('WEEKS_OF_COVER', c)] - w) < 1e-9 for c, g, w in zip(cat.category_code, cat.gmroi_target, cat.cover_target_wks))
      and [pt[(k, 'ALL')] for k in ['AVAILABILITY', 'SUPPLIER_OTIF', 'GMROI', 'WEEKS_OF_COVER', 'SELL_THROUGH']] == [.97, .95, 2.5, 9.5, .62])
check('param_status_rule: 12 card rules + DOT_RED_OFF 1/3, DOT_ORANGE_WATCH_OFF 0.5, DOT_GREEN_GOOD 2/3 (E-75, E-26)',
      rule.kpi_code.notna().sum() == 12 and abs(rule.loc['DOT_RED_OFF'].threshold - 1 / 3) < 1e-12
      and rule.loc['DOT_ORANGE_WATCH_OFF'].threshold == .5 and abs(rule.loc['DOT_GREEN_GOOD'].threshold - 2 / 3) < 1e-12)
check('dim_kpi: 32 catalogue KPIs, 12 landing (3 hero, 3 medium, 6 small; 2 provisional), 20 bench',
      len(kpi) == 32 and kpi.is_landing.sum() == 12 and kpi[kpi.is_landing]['size'].value_counts().to_dict() == {'small': 6, 'hero': 3, 'medium': 3}
      and set(kpi[kpi.is_provisional & kpi.is_landing].kpi_code) == {'TOTAL_MARGIN', 'EBITDA'} and sorted(kpi.catalogue_no) == list(range(1, 33)))

# LFL flags recomputed from the store dates (E-31, per retail period)
def lfl_flag(r, ps, pe):
    cut = (pd.Timestamp(ps) - pd.DateOffset(months=13)).date()
    od, cd, rd = [None if pd.isna(v) else pd.Timestamp(v).date() for v in (r.open_date, r.close_date, r.refit_date)]
    return od <= cut and (cd is None or cd > pe) and not (rd is not None and cut < rd <= pe)
pw = w2.set_index('week_key')
lf = {}
for r in stores.itertuples():
    for k_, p in pw.iterrows():
        lf[(r.store_code, k_)] = (lfl_flag(r, p.period_start, p.period_end), lfl_flag(r, p.period_start + timedelta(364), p.period_end + timedelta(364)))
s_ = fs[fs.store_code.map(chan) == 'STORE']
exp_l = np.array([lf[(a, b)] for a, b in zip(s_.store_code, s_.week_key)])
bs_ = fb[fb.store_code.map(chan) == 'STORE']
check('is_lfl / is_lfl_as_ly recomputed from open / close / refit dates per retail period (sales and budget rows)',
      (s_.is_lfl.values == exp_l[:, 0]).all() and (s_.is_lfl_as_ly.values == exp_l[:, 1]).all()
      and (bs_.is_lfl.values == np.array([lf[(a, b)][0] for a, b in zip(bs_.store_code, bs_.week_key)])).all())
open43 = s_[s_.week_key == 'FY2026-W43'].store_code.unique()
check('ET-06 / E-74 Week 43: 142 stores trading, 131 LFL, 11 non-LFL', len(open43) == 142 and s_[(s_.week_key == 'FY2026-W43') & s_.is_lfl].store_code.nunique() == 131)

# ---- ET-01 control totals, recomputed -------------------------------------------------------------------------------------
SC = ['ALL', 'NL', 'BE', 'ONLINE']
def cube(df, cols, mask=None):
    df = df if mask is None else df[mask]
    s = df.store_code.map(scope) if 'store_code' in df else pd.Series(None, index=df.index)
    parts = [df.assign(_s='ALL')] + [df[s.eq(x)].assign(_s=x) for x in SC[1:]]
    return pd.concat(parts).groupby(['_s', 'week_key'])[cols].sum()
seasonal = set(cat[cat.is_seasonal].category_code)
sell_s = fs.store_code.map(chan).isin(['STORE', 'ONLINE']); sell_i = fi.store_code.map(chan).isin(['STORE', 'ONLINE'])
Q = dict(
    s=cube(fs.assign(fm=fs.net_sales - fs.cogs_landed), ['gross_sales', 'markdown_value', 'returns', 'net_sales', 'cogs_landed', 'back_margin_alloc', 'fm']),
    lfl=cube(fs, ['net_sales'], fs.is_lfl), lly=cube(fs, ['net_sales'], fs.is_lfl_as_ly),
    ch={c: cube(fs, ['net_sales'], fs.store_code.map(chan) == c) for c in ['STORE', 'ONLINE', 'WHOLESALE']},
    chb={c: cube(fb, ['net_sales_bud'], fb.store_code.map(chan) == c) for c in ['STORE', 'ONLINE', 'WHOLESALE']},
    sold=cube(fs, ['units'], sell_s & fs.category_code.isin(seasonal)),
    b=cube(fb, ['net_sales_bud', 'gross_sales_bud', 'markdown_bud', 'cogs_bud', 'back_margin_bud']), lb=cube(fb, ['net_sales_bud'], fb.is_lfl),
    inv=cube(fi, ['on_hand_cost', 'on_order_cost']), ou=cube(fi, ['on_hand_units'], sell_i & fi.category_code.isin(seasonal)),
    f=cube(ff.assign(ft=ff.forecast_cogs * ff.category_code.map(ctg)), ['forecast_cogs', 'ft']),
    av=cube(fa, ['ranged_sku_days', 'in_stock_sku_days']), rc=cube(fr, ['receipt_units'], fr.category_code.isin(seasonal)),
    ox={(sc_, ct_): cube(fo, ['amount'], (fo.scenario_code == sc_) & (fo.cost_type_code == ct_)) for sc_ in ['ACT', 'BUD']
        for ct_ in ['SHRINK', 'STORE_OPEX', 'CENTRAL_OPEX', 'FULFILMENT']},
    po=fp.groupby('week_key')[['po_lines_due', 'po_lines_otif']].sum(),
    nlfl=s_[s_.is_lfl].assign(_s=s_[s_.is_lfl].store_code.map(scope)).groupby(['_s', 'week_key']).store_code.nunique())
nl_all = s_[s_.is_lfl].groupby('week_key').store_code.nunique()
WK = list(wk.week_key); IX = {k: i for i, k in enumerate(WK)}

def val(t, s, ws, col):
    t = t.reindex(pd.MultiIndex.from_product([[s], ws]), fill_value=0); return float(t[col].sum())

def win(kind, fy, w):
    i = IX[f'FY{fy}-W{w:02d}']
    if kind == 'W': return [WK[i]]
    if kind == 'PTD': p = wk.period_key[i]; return [k for k, pk in zip(WK[:i + 1], wk.period_key[:i + 1]) if pk == p]
    return WK[IX[f'FY{fy}-W01']:i + 1]

def metrics(s, kind, fy, w):
    ws = win(kind, fy, w); L = ws[-1]; m = {}
    S = lambda col, t=Q['s'], ws=ws: val(t, s, ws, col)
    m.update(gross_sales=S('gross_sales'), markdown=S('markdown_value'), returns=S('returns'), net_sales=S('net_sales'), cogs=S('cogs_landed'), back_margin=S('back_margin_alloc'))
    m['front_margin'] = m['net_sales'] - m['cogs']; m['total_margin'] = m['front_margin'] + m['back_margin']
    if m['net_sales']:
        m.update(front_gm_pct=m['front_margin'] / m['net_sales'], back_margin_pct=m['back_margin'] / m['net_sales'], total_margin_pct=m['total_margin'] / m['net_sales'])
    if m['gross_sales']: m['markdown_pct'] = m['markdown'] / m['gross_sales']
    for k_, ct_ in [('shrink', 'SHRINK'), ('store', 'STORE_OPEX'), ('central', 'CENTRAL_OPEX'), ('fulfilment', 'FULFILMENT')]: m[f'opex_{k_}'] = val(Q['ox'][('ACT', ct_)], s, ws, 'amount')
    m['ebitda'] = m['total_margin'] - m['opex_shrink'] - m['opex_store'] - m['opex_central'] - m['opex_fulfilment']
    if m['net_sales']: m['ebitda_margin_pct'] = m['ebitda'] / m['net_sales']
    po = Q['po'].reindex(ws).sum(); m.update(po_lines_due=po.po_lines_due, po_lines_otif=po.po_lines_otif, otif_pct=po.po_lines_otif / po.po_lines_due, otif_target=.95)
    if fy == 2026:
        ly = [wk.ly_week_key[IX[k]] for k in ws]
        lyv = val(Q['lly'], s, ly, 'net_sales')
        m['store_net_sales'] = val(Q['ch']['STORE'], s, ws, 'net_sales'); m['store_net_sales_ly'] = val(Q['ch']['STORE'], s, ly, 'net_sales')
        if lyv:
            m.update(lfl_net_sales=val(Q['lfl'], s, ws, 'net_sales'), lfl_net_sales_ly=lyv,
                     lfl_store_count=float(nl_all.get(L, 0) if s == 'ALL' else Q['nlfl'].get((s, L), 0)))
            m['lfl_growth_pct'] = m['lfl_net_sales'] / lyv - 1
            m['nonlfl_effect_pp'] = m['store_net_sales'] / m['store_net_sales_ly'] - 1 - m['lfl_growth_pct']
    m.update(on_hand_cost=val(Q['inv'], s, [L], 'on_hand_cost'), on_order_cost=val(Q['inv'], s, [L], 'on_order_cost'), forecast_cogs=val(Q['f'], s, [L], 'forecast_cogs'))
    m['stock_incl_on_order'] = m['on_hand_cost'] + m['on_order_cost']
    if m['forecast_cogs']: m['weeks_of_cover'] = m['stock_incl_on_order'] / m['forecast_cogs']; m['cover_target_wks'] = val(Q['f'], s, [L], 'ft') / m['forecast_cogs']
    rg = val(Q['av'], s, [L], 'ranged_sku_days')
    if rg: m.update(ranged_sku_days=rg, in_stock_sku_days=val(Q['av'], s, [L], 'in_stock_sku_days')); m['availability_pct'] = m['in_stock_sku_days'] / rg
    m['availability_target'] = .97
    sw = wk.season_week[IX[L]]
    if pd.notna(sw):
        sws = WK[IX[L] - int(sw) + 1:IX[L] + 1]; o = val(Q['ou'], s, [WK[IX[L] - int(sw)]], 'on_hand_units')
        m.update(season_opening_units=o, season_receipt_units=val(Q['rc'], s, sws, 'receipt_units'), season_units_sold=val(Q['sold'], s, sws, 'units'))
        m['sell_through_pct'] = m['season_units_sold'] / (o + m['season_receipt_units']); m['sell_through_target'] = .62
    if IX[L] >= 51:
        r52 = WK[IX[L] - 51:IX[L] + 1]; fm = val(Q['s'], s, r52, 'fm')
        av = Q['inv'].reindex(pd.MultiIndex.from_product([[s], r52]), fill_value=0).on_hand_cost.mean()
        m.update(gmroi_front_margin_r52w=fm, gmroi_avg_on_hand_cost=av, gmroi=fm / av, gmroi_target=2.5)
    nl = val(Q['s'], s, [L], 'net_sales')
    names = [('STORE', 'store'), ('ONLINE', 'online'), ('WHOLESALE', 'wholesale')]
    for c, n in names: m[f'mix_{n}_net_sales'] = val(Q['ch'][c], s, [L], 'net_sales'); m[f'mix_{n}_pct'] = m[f'mix_{n}_net_sales'] / nl
    if fy == 2026:
        B = lambda col, ws=ws: val(Q['b'], s, ws, col)
        m.update(net_sales_bud=B('net_sales_bud'), gross_sales_bud=B('gross_sales_bud'), markdown_bud=B('markdown_bud'), cogs_bud=B('cogs_bud'), back_margin_bud=B('back_margin_bud'))
        m['markdown_pct_bud'] = m['markdown_bud'] / m['gross_sales_bud']; m['front_gm_pct_bud'] = 1 - m['cogs_bud'] / m['net_sales_bud']
        m['total_margin_pct_bud'] = (m['net_sales_bud'] - m['cogs_bud'] + m['back_margin_bud']) / m['net_sales_bud']
        for k_, ct_ in [('shrink', 'SHRINK'), ('store', 'STORE_OPEX'), ('central', 'CENTRAL_OPEX'), ('fulfilment', 'FULFILMENT')]:
            m[f'opex_{k_}_bud'] = val(Q['ox'][('BUD', ct_)], s, ws, 'amount')
        m['ebitda_bud'] = m['net_sales_bud'] - m['cogs_bud'] + m['back_margin_bud'] - sum(m[f'opex_{k_}_bud'] for k_ in ['shrink', 'store', 'central', 'fulfilment'])
        m['ebitda_margin_pct_bud'] = m['ebitda_bud'] / m['net_sales_bud']
        if 'lfl_net_sales_ly' in m: m['lfl_net_sales_bud'] = val(Q['lb'], s, ws, 'net_sales_bud'); m['lfl_growth_pct_bud'] = m['lfl_net_sales_bud'] / m['lfl_net_sales_ly'] - 1
        nb = val(Q['b'], s, [L], 'net_sales_bud')
        for c, n in names: m[f'mix_{n}_pct_bud'] = val(Q['chb'][c], s, [L], 'net_sales_bud') / nb
        dv = [m[f'mix_{n}_pct'] - m[f'mix_{n}_pct_bud'] for _, n in names]; j = int(np.argmax(np.abs(dv)))
        m['mix_max_dev_pp'] = dv[j]; m['mix_max_dev_channel'] = j + 1
    return m

def badness(k, m, p):
    """Direction-adjusted shortfall vs basis (E-22); None = N/A."""
    g = m.get
    return {'NET_SALES': (1 - g('net_sales') / g('net_sales_bud')) if g('net_sales_bud') else None,
            'TOTAL_MARGIN': g('total_margin_pct_bud') - g('total_margin_pct') if 'total_margin_pct' in m else None,
            'WEEKS_OF_COVER': abs(g('weeks_of_cover') - g('cover_target_wks')) if 'weeks_of_cover' in m else None,
            'MARKDOWN': g('markdown_pct') - g('markdown_pct_bud') if 'markdown_pct' in m else None,
            'AVAILABILITY': .97 - g('availability_pct') if 'availability_pct' in m else None,
            'EBITDA': 1 - p['ebitda'] / p['ebitda_bud'], 'LFL_GROWTH': g('lfl_growth_pct_bud') - g('lfl_growth_pct') if 'lfl_growth_pct' in m else None,
            'FRONT_GM': g('front_gm_pct_bud') - g('front_gm_pct') if 'front_gm_pct' in m else None,
            'SELL_THROUGH': .62 - g('sell_through_pct') if 'sell_through_pct' in m else None, 'GMROI': 2.5 - g('gmroi') if 'gmroi' in m else None,
            'SUPPLIER_OTIF': .95 - g('otif_pct'), 'CHANNEL_MIX': abs(g('mix_max_dev_pp')) if 'mix_max_dev_pp' in m else None}[k]

CARDS = list(kpi[kpi.is_landing].sort_values('card_order').kpi_code)
exp = {}
periods = [('W', 2026, w) for w in range(30, 44)] + [('W', 2025, w) for w in range(31, 44)] + [(k, y, w) for k in ('PTD', 'YTD') for y, w in ((2026, 43), (2026, 42), (2025, 43))]
for kind, fy, w in periods:
    pk = f'{kind}-FY{fy}-{w:02d}'
    for s in SC:
        m = metrics(s, kind, fy, w)
        if fy == 2026:
            p = m if kind == 'PTD' else metrics(s, 'PTD', fy, w)
            m['ebitda_ptd'] = p['ebitda']; m['ebitda_bud_ptd'] = p['ebitda_bud']
            stt = {}
            for k_ in CARDS:
                b = badness(k_, m, p)
                if b is not None:
                    b = round(b, 10); r_ = rule.loc[k_]; stt[k_] = 1 if b <= r_.watch_from else 2 if b <= r_.off_from else 3
            for k_, v_ in stt.items(): m[f'status.{k_.lower()}'] = v_
            n = len(stt); c = [list(stt.values()).count(x) for x in (1, 2, 3)]
            m.update({'status.count_on': c[0], 'status.count_watch': c[1], 'status.count_off': c[2], 'status.count_na': 12 - n})
            m['status.dot'] = 3 if c[2] / n >= rule.loc['DOT_RED_OFF'].threshold else 2 if (c[1] + c[2]) / n > rule.loc['DOT_ORANGE_WATCH_OFF'].threshold \
                else 1 if c[0] / n >= rule.loc['DOT_GREEN_GOOD'].threshold else 2
        if s == 'ALL':
            L = win(kind, fy, w)[-1]; i = IX[L]
            if i >= 51:
                r52 = WK[i - 51:i + 1]
                fmc = fs[fs.week_key.isin(r52)].assign(fm=fs.net_sales - fs.cogs_landed).groupby('category_code').fm.sum()
                ohc = fi[fi.week_key.isin(r52)].groupby('category_code').on_hand_cost.sum() / 52
                for c_ in cats: m[f'gmroi.{c_}'] = fmc[c_] / ohc[c_]
            sw = wk.season_week[i]
            if pd.notna(sw):
                sws = WK[i - int(sw) + 1:i + 1]
                for c_ in seasonal:
                    sold = fs[fs.week_key.isin(sws) & (fs.category_code == c_) & sell_s].units.sum()
                    op = fi[(fi.week_key == WK[i - int(sw)]) & (fi.category_code == c_) & sell_i].on_hand_units.sum()
                    m[f'sell_through_pct.{c_}'] = sold / (op + fr[fr.week_key.isin(sws) & (fr.category_code == c_)].receipt_units.sum())
            if kind == 'W': x = fp[fp.week_key == L]; m['otif_suppliers_below_85'] = int((x.po_lines_otif < .85 * x.po_lines_due).sum())
        for k_, v_ in m.items():
            if v_ is not None and not (isinstance(v_, float) and np.isnan(v_)): exp[(s, pk, k_)] = float(v_)
ct = pd.read_csv(D / 'checks' / 'control_totals_eur.csv', dtype={'value': str})
got = {(a, b, c): float(v) for a, b, c, v in zip(ct.scope, ct.period_key, ct.metric_code, ct.value)}
def tol(k):
    if k.startswith('status.') or k in ('lfl_store_count', 'po_lines_due', 'po_lines_otif', 'mix_max_dev_channel', 'otif_suppliers_below_85'): return 0
    if 'pct' in k or k.endswith(('_pp', '_target', '_target_wks')) or k in ('gmroi', 'weeks_of_cover') or k.startswith('gmroi.'): return 1e-6
    return .06 if k.endswith(('_units', '_sku_days')) else .0051
bad = [(k, got.get(k), e) for k, e in exp.items() if k not in got or abs(got[k] - e) > tol(k[2])]
extra = set(got) - set(exp)
check(f'ET-01 control totals: {len(exp):,} values recomputed from the Parquet files (4 scopes x {len(periods)} periods)', not bad and not extra,
      f'{len(bad)} mismatches, {len(extra)} unexpected, e.g. {bad[:3]} {list(extra)[:3]}')

# ---- ET-02 / ET-03 the v5 Week-43 story ------------------------------------------------------------------------------------
g = lambda m, p='W-FY2026-43': exp[('ALL', p, m)]
def eur(x, d=1): return (MINUS if x < 0 else '') + f'€{abs(x) / 1e6:,.{d}f}m'
def pct(x, d=1): return f'{100 * x:.{d}f}%'
def sgn(x, d=1, u=' pp', k=100): return ('+' if x >= 0 else MINUS) + f'{abs(x) * k:.{d}f}{u}'
STAT = {1: 'On track', 2: 'Watch', 3: 'Off track'}
cards = {  # card: (value, delta vs comparator Budget / target, chip) exactly as v5 shows them
    'NET_SALES': (eur(g('net_sales')), f"{eur(g('net_sales') - g('net_sales_bud'))} ({sgn(g('net_sales') / g('net_sales_bud') - 1, u='%')})"),
    'TOTAL_MARGIN': (pct(g('total_margin_pct')), f"{sgn(g('total_margin_pct') - g('total_margin_pct_bud'))} vs budget {pct(g('total_margin_pct_bud'))}"),
    'WEEKS_OF_COVER': (f"{g('weeks_of_cover'):.1f} wks", f"{sgn(g('weeks_of_cover') - g('cover_target_wks'), u=' wks', k=1)} vs target {g('cover_target_wks'):.1f}"),
    'MARKDOWN': (pct(g('markdown_pct')), f"{sgn(g('markdown_pct') - g('markdown_pct_bud'))} vs budget {pct(g('markdown_pct_bud'))}"),
    'AVAILABILITY': (pct(g('availability_pct')), f"{sgn(g('availability_pct') - .97)} vs target 97%"),
    'EBITDA': (eur(g('ebitda_ptd')), f"{eur(g('ebitda_ptd') - g('ebitda_bud_ptd'))} ({sgn(g('ebitda_ptd') / g('ebitda_bud_ptd') - 1, u='%')})"),
    'LFL_GROWTH': (sgn(g('lfl_growth_pct'), u='%'), f"{sgn(g('lfl_growth_pct') - g('lfl_growth_pct_bud'))} vs budget LFL {pct(g('lfl_growth_pct_bud'))}"),
    'FRONT_GM': (pct(g('front_gm_pct')), f"{sgn(g('front_gm_pct') - g('front_gm_pct_bud'))} vs budget {pct(g('front_gm_pct_bud'))}"),
    'SELL_THROUGH': (pct(g('sell_through_pct')), f"{sgn(g('sell_through_pct') - .62)} vs target 62%"),
    'GMROI': (f"{g('gmroi'):.1f}×", f"{sgn(g('gmroi') - 2.5, u='×', k=1)} vs target 2.5×"),
    'SUPPLIER_OTIF': (pct(g('otif_pct')), f"{sgn(g('otif_pct') - .95)} vs target 95%"),
    'CHANNEL_MIX': (' / '.join(f"{100 * g(f'mix_{n}_pct'):.1f}" for n in ['store', 'online', 'wholesale']),
                    f"{['store', 'online', 'wholesale'][int(g('mix_max_dev_channel')) - 1]} {sgn(g('mix_max_dev_pp'))} vs plan")}
v5 = {'NET_SALES': ('€61.4m', f'{MINUS}€1.5m ({MINUS}2.4%)', 'Watch'), 'TOTAL_MARGIN': ('36.3%', '+0.1 pp vs budget 36.2%', 'On track'),
      'WEEKS_OF_COVER': ('11.4 wks', '+1.9 wks vs target 9.5', 'Watch'), 'MARKDOWN': ('9.8%', '+1.3 pp vs budget 8.5%', 'Off track'),
      'AVAILABILITY': ('94.1%', f'{MINUS}2.9 pp vs target 97%', 'Off track'), 'EBITDA': ('€15.3m', f'{MINUS}€0.8m ({MINUS}5.0%)', 'Watch'),
      'LFL_GROWTH': ('+3.4%', '+0.4 pp vs budget LFL 3.0%', 'On track'), 'FRONT_GM': ('30.1%', '+0.1 pp vs budget 30.0%', 'On track'),
      'SELL_THROUGH': ('63.1%', '+1.1 pp vs target 62%', 'On track'), 'GMROI': ('2.7×', '+0.2× vs target 2.5×', 'On track'),
      'SUPPLIER_OTIF': ('95.4%', '+0.4 pp vs target 95%', 'On track'), 'CHANNEL_MIX': ('68.4 / 19.9 / 11.7', 'online +1.9 pp vs plan', 'On track')}
for k_ in CARDS:
    have = cards[k_] + (STAT[int(g(f'status.{k_.lower()}'))],)
    check(f'ET-02 {k_:<15} {" | ".join(v5[k_])}', have == v5[k_], have)
P = 'PTD-FY2026-43'
info = {  # inputs quoted in the v5 (i) worked examples and mini stats
    '€68.4m gross, €6.7m markdown, €0.3m returns, budget €62.9m': [eur(g('gross_sales')), eur(g('markdown')), eur(g('returns')), eur(g('net_sales_bud'))] == ['€68.4m', '€6.7m', '€0.3m', '€62.9m'],
    'front €18.5m + back €3.8m (6.2%) = €22.3m; COGS €42.9m': [eur(g('front_margin')), eur(g('back_margin')), pct(g('back_margin_pct')), eur(g('total_margin')), eur(g('cogs'))]
        == ['€18.5m', '€3.8m', '6.2%', '€22.3m', '€42.9m'],
    'stock €402m + on order €88m = €490m; forecast weekly COGS €43.0m': [eur(g('on_hand_cost'), 0), eur(g('on_order_cost'), 0), eur(g('stock_incl_on_order'), 0), eur(g('forecast_cogs'))]
        == ['€402m', '€88m', '€490m', '€43.0m'],
    '497,000 ranged, 467,700 in stock': (g('ranged_sku_days'), g('in_stock_sku_days')) == (497000, 467700),
    'P10: margin €87.7m − shrink €2.2m − store €52.4m − central €11.6m − fulfilment €6.2m; 6.3% of €241.7m; budget €16.1m = 6.6%':
        [eur(g(k, P)) for k in ['total_margin', 'opex_shrink', 'opex_store', 'opex_central', 'opex_fulfilment', 'net_sales', 'ebitda_bud']]
        + [pct(g('ebitda_margin_pct', P)), pct(g('ebitda_margin_pct_bud', P))] == ['€87.7m', '€2.2m', '€52.4m', '€11.6m', '€6.2m', '€241.7m', '€16.1m', '6.3%', '6.6%'],
    '131 LFL stores: €39.0m ÷ €37.7m; non-LFL effect −1.2 pp; online LFL +12.1%':
        [g('lfl_store_count'), eur(g('lfl_net_sales')), eur(g('lfl_net_sales_ly')), sgn(g('nonlfl_effect_pp')),
         sgn(g('mix_online_net_sales') / g('mix_online_net_sales', 'W-FY2025-43') - 1, u='%')] == [131, '€39.0m', '€37.7m', f'{MINUS}1.2 pp', '+12.1%'],
    'sell-through: 8.4m sold ÷ (4.2m opening + 9.1m received); Apparel 58%, Home & kitchen 69%; vs LY season +2.4 pp':
        [f"{g(k) / 1e6:.1f}m" for k in ['season_units_sold', 'season_opening_units', 'season_receipt_units']]
        + [pct(g('sell_through_pct.APPAREL'), 0), pct(g('sell_through_pct.HOME'), 0), sgn(g('sell_through_pct') - g('sell_through_pct', 'W-FY2025-43'))]
        == ['8.4m', '4.2m', '9.1m', '58%', '69%', '+2.4 pp'],
    'OTIF 4,591 ÷ 4,812; vs last week +0.4 pp; 2 suppliers below 85%': (g('po_lines_otif'), g('po_lines_due'), sgn(g('otif_pct') - g('otif_pct', 'W-FY2026-42')),
        g('otif_suppliers_below_85')) == (4591, 4812, '+0.4 pp', 2),
    'channels €42.0m / €12.2m / €7.2m': [eur(g(f'mix_{n}_net_sales')) for n in ['store', 'online', 'wholesale']] == ['€42.0m', '€12.2m', '€7.2m'],
    'stats: vs LY +3.8%, P10 €241.7m, YTD €2,318m': [sgn(g('net_sales') / g('net_sales', 'W-FY2025-43') - 1, u='%'), eur(g('net_sales', P)), eur(g('net_sales', 'YTD-FY2026-43'), 0)]
        == ['+3.8%', '€241.7m', '€2,318m'],
    'stats vs LY: markdown +1.9 pp, total margin −0.2 pp, front margin −0.3 pp':
        [sgn(g(k) - g(k, 'W-FY2025-43')) for k in ['markdown_pct', 'total_margin_pct', 'front_gm_pct']] == ['+1.9 pp', f'{MINUS}0.2 pp', f'{MINUS}0.3 pp'],
    'stats vs last week: cover +0.3 wks, availability −0.2 pp': [sgn(g('weeks_of_cover') - g('weeks_of_cover', 'W-FY2026-42'), u='', k=1),
        sgn(g('availability_pct') - g('availability_pct', 'W-FY2026-42'))] == ['+0.3', f'{MINUS}0.2 pp'],
    'GMROI by category: H&B 4.1×, Electronics 1.9× (below its target)': [f"{g('gmroi.HB'):.1f}×", f"{g('gmroi.ELEC'):.1f}×"] == ['4.1×', '1.9×']
        and g('gmroi.ELEC') < cat.set_index('category_code').gmroi_target['ELEC']}
for k_, ok_ in info.items(): check(f'ET-02 (i) {k_}', ok_)
x = fp[fp.week_key == 'FY2026-W43']; low = x[x.po_lines_otif < .85 * x.po_lines_due].supplier_code
check('E-74 the two suppliers below 85 % OTIF at Week 43 are Electronics suppliers', len(low) == 2 and set(low.map(sup.set_index('supplier_code').primary_category_code)) == {'ELEC'})
cnt = tuple(int(g(f'status.count_{k}')) for k in ['on', 'watch', 'off', 'na'])
check('ET-02 / ET-03 Week 43 ALL: 7 on track / 3 watch / 2 off track, overall dot orange (literal v5 rule)', cnt == (7, 3, 2, 0) and g('status.dot') == 2, cnt)
check('ET-03 a dot and three counts for every FY2026 period x scope', all((s, f'{k}-FY{y}-{w:02d}', m) in got for s in SC for k, y, w in periods if y == 2026
      for m in ['status.dot', 'status.count_on', 'status.count_watch', 'status.count_off']))
check('ET-07 front + back = total margin (EUR) for every scope x period', all(abs(exp[(s, p, 'front_margin')] + exp[(s, p, 'back_margin')] - exp[(s, p, 'total_margin')]) < .01
      for (s, p, m) in exp if m == 'total_margin'))
check('ET-06 LFL + non-LFL effect = store-channel growth (W43: 3.39 % − 1.20 pp = 2.19 %)',
      abs(g('lfl_growth_pct') + g('nonlfl_effect_pp') - (g('store_net_sales') / g('store_net_sales_ly') - 1)) < 1e-12)

# ---- ET-05 LY by week key, not by date ----------------------------------------------------------------------------------
d0 = date(2026, 10, 19); shifted = date(d0.year - 1, d0.month, d0.day)
date_week = dmap[shifted]
check('ET-05 FY2026 W43 LY = FY2025-W43 by key; DATEADD(-1 year) of 19 Oct 2026 = 19 Oct 2025 falls in FY2025-W42 (a different week)',
      date_week == 'FY2025-W42' and wk.set_index('week_key').ly_week_key['FY2026-W43'] == 'FY2025-W43'
      and abs(got[('ALL', 'W-FY2025-43', 'net_sales')] - fs[fs.week_key == 'FY2025-W43'].net_sales.sum()) < .01
      and abs(got[('ALL', 'W-FY2025-43', 'net_sales')] - fs[fs.week_key == 'FY2025-W42'].net_sales.sum()) > 1e5)
check('ET-05 every FY2026 week: LY week starts exactly 364 days earlier (key join = same weekday, same week number)',
      all((pd.Timestamp(w2.week_start[i]) - pd.Timestamp(w2.week_start[i - 52])).days == 364 for i in range(52, 104)))

# ---- ET-20 determinism ---------------------------------------------------------------------------------------------------------
if not args.no_rerun:
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run([sys.executable, str(D / 'generator' / 'generate.py'), '--out', tmp], capture_output=True, text=True)
        files = [f'parquet/{t["table"]}.parquet' for t in man['tables']] + ['parquet/manifest.json', 'checks/control_totals_eur.csv']
        same = r.returncode == 0 and all(filecmp.cmp(D / f, Path(tmp) / f, shallow=False) for f in files)
        check(f'ET-20 rerun with seed 20261028 is byte-identical ({len(files)} files)', same, r.stderr[-300:])
print(f'\n{len(fails)} failure(s)' if fails else '\nALL CHECKS GREEN')
sys.exit(1 if fails else 0)

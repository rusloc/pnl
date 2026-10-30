#!/usr/bin/env python3
"""Nordmark Retail executive-dashboard dummy dataset - deterministic generator (seed 20261028).

Usage:  python generate.py [--out <folder>]      (default: the dataset folder, one level up)
Writes  parquet/ (one file per table + manifest.json), checks/control_totals_eur.csv and checks/control_totals_category_eur.csv.
Contract: ADR-0013, docs/Requirements-exec.md (E-nn, ET-nn) and the README.md of the dataset folder.

Story-first (ADR-0013 (c), E-73): the ALL-scope weekly totals of every card input are fixed in a story table
(the v5 Week-43 values are pinned as anchors, W31-W42 follow the v5 bar shapes), then allocated to
site x category cells by stable shares plus seeded noise, in integer cents, with each group's rounding
residual pushed to its largest cell. The control totals are recomputed from the written tables.
"""
import argparse, json, sys, time
from datetime import date, timedelta
from pathlib import Path
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SEED = 20261028
FY0 = date(2024, 12, 30)              # FY2025 W1 (Monday). E-10: FY = 52 Mon-Sun weeks from the Monday of the week holding 1 Jan
NWK, NACT, CUR = 104, 95, 94          # dim_week FY2025 W1 .. FY2026 W52; actuals FY2025 W1 .. FY2026 W43; index of FY2026 W43
AS_OF, REFRESHED = '2026-10-25', '2026-10-26T05:12'
PLEN = [4, 5, 4] * 4                  # 4-5-4 periods
M = '−'                          # typographic minus, as in v5

def fy_start(y):
    d = date(y, 1, 1); return d - timedelta(days=d.weekday())

def C(x): return int(round(x * 100))  # euro -> integer cents

def alloc(g, w, tot):
    """Split integer totals tot[g] over the rows of each group g by weight w, rounded to the unit.
    Each group's rounding residual goes to its largest-weight row (DEC-002 / C-31 rule, E-73)."""
    g = np.asarray(g, np.int64); w = np.asarray(w, float); tot = np.asarray(tot, np.int64)
    assert np.isin(np.nonzero(tot)[0], g).all(), 'a non-zero total has no rows'
    sw = np.bincount(g, w, minlength=len(tot)); assert (sw[np.unique(g)] > 0).all()
    x = np.rint(tot[g] * (w / sw[g])).astype(np.int64)
    res = tot - np.rint(np.bincount(g, x.astype(float), minlength=len(tot))).astype(np.int64)
    o = np.lexsort((w, g)); gs = g[o]; last = o[np.r_[gs[1:] != gs[:-1], True]]
    x[last] += res[g[last]]
    assert (x[tot[g] >= 0] >= 0).all()
    return x

def interp(k, knots): return np.interp(k, [a for a, _ in knots], [b for _, b in knots])

# ---- calendar ----------------------------------------------------------------------------------------------------
WI = np.arange(NWK); FYA = 2025 + WI // 52; WKA = WI % 52 + 1
WS = np.datetime64(FY0, 'D') + (7 * WI).astype('timedelta64[D]'); WE = WS + np.timedelta64(6, 'D')
CUMP = np.cumsum([0] + PLEN); PER = np.searchsorted(CUMP, WKA); WOP = WKA - CUMP[PER - 1]; WIP = np.array(PLEN)[PER - 1]
PSI = WI - (WOP - 1); PEI = PSI + WIP - 1; PS, PE = WS[PSI], WE[PEI]
KEY = np.array([f'FY{a}-W{b:02d}' for a, b in zip(FYA, WKA)])
SEAS = np.array([f'AW{a % 100}' if 32 <= b <= 51 else None for a, b in zip(FYA, WKA)], dtype=object)
SWK = np.where((WKA >= 32) & (WKA <= 51), WKA - 31, 0)

def pseason(wk):                      # weekly net-sales seasonality (Black Friday W48, Christmas W51-W52)
    return interp(wk, [(1, .86), (4, .88), (8, .90), (13, .93), (16, .97), (22, .96), (26, .97), (30, .96), (35, .99), (39, 1.02),
                       (43, 1.06), (46, 1.08), (48, 1.18), (49, 1.12), (50, 1.20), (51, 1.32), (52, 1.28)])

def lfl_matrix(od, cd, rd, ps, pe):
    """E-31, per retail period: open >= 13 months before the period start, not closed by the period end,
    no refit in the 13 months before the period start or during the period."""
    cut = (pd.DatetimeIndex(ps) - pd.DateOffset(months=13)).values.astype('datetime64[D]')
    o = od[:, None] <= cut[None, :]
    c = np.isnat(cd)[:, None] | (cd[:, None] > pe[None, :])
    r = ~((rd[:, None] > cut[None, :]) & (rd[:, None] <= pe[None, :]))
    return o & c & r

# ---- categories ----------------------------------------------------------------------------------------------------
#        code        name                    division               store  online whs   fgm   md    price seas  cover gmroi_t top500 dc   fcst  back  items
CATS = [('FRESH',     'Fresh food',           'Food',                 .26, .10, .20, .28, .05,  3.2, False,  1.5, 7.0, 120, .15, .25, .04, 2.4),
        ('AMBIENT',   'Ambient grocery',      'Food',                 .23, .14, .30, .24, .06,  2.6, False,  7.0, 2.8, 140, .35, .24, .10, 3.0),
        ('HB',        'Health & beauty',      'Non-food FMCG',        .10, .12, .10, .36, .08,  6.5, False, 11.0, 3.5,  60, .35, .09, .12, 1.6),
        ('HOUSEHOLD', 'Household & cleaning', 'Non-food FMCG',        .08, .07, .12, .30, .07,  4.8, False, 10.0, 2.8,  50, .35, .08, .11, 1.8),
        ('ELEC',      'Electronics',          'General merchandise',  .07, .20, .10, .18, .09, 85.0, False, 15.0, 2.2,  30, .40, .11, .09, 1.05),
        ('APPAREL',   'Apparel',              'General merchandise',  .08, .14, .05, .48, .17, 19.0, True,  18.0, 2.4,  25, .30, .06, .05, 1.5),
        ('HOME',      'Home & kitchen',       'General merchandise',  .08, .12, .07, .38, .11, 18.5, True,  18.0, 2.3,  30, .40, .07, .07, 1.4),
        ('GARDEN',    'Garden & DIY',         'General merchandise',  .05, .04, .03, .34, .10, 24.0, True,  17.0, 2.0,  20, .40, .05, .06, 1.5),
        ('TOYS',      'Toys & leisure',       'General merchandise',  .05, .07, .03, .33, .10, 24.0, True,  16.3, 2.3,  25, .45, .05, .08, 1.3)]
NC = len(CATS); CC = np.array([c[0] for c in CATS])
CA = {k: np.array([c[i] for c in CATS]) for i, k in enumerate(
      ['code', 'name', 'div', 'st', 'on', 'wh', 'fgm', 'md', 'price', 'seas', 'cover', 'gmroi', 'top', 'dc', 'fsh', 'br', 'items'])}
SEASONAL = CA['seas'].astype(bool)
assert abs(CA['st'].sum() - 1) < 1e-9 and abs(CA['on'].sum() - 1) < 1e-9 and abs(CA['wh'].sum() - 1) < 1e-9 and abs(CA['fsh'].sum() - 1) < 1e-9
assert abs((CA['fsh'] * CA['cover']).sum() - 9.5) < 1e-9 and CA['top'].sum() == 500       # E-35 target 9.5; top-500 sellers

def csea(wk):                         # category share seasonality (rows = categories)
    one = np.ones_like(wk, float)
    return np.vstack([interp(wk, [(1, 1), (50, 1.05), (52, 1.12)]), one, one, one,
                      interp(wk, [(1, .9), (40, .95), (46, 1.2), (48, 1.7), (50, 1.5), (52, 1.0)]),
                      interp(wk, [(1, .9), (6, .8), (12, 1.1), (20, 1.1), (26, 1.0), (30, .85), (36, 1.1), (44, 1.15), (50, 1.25), (52, .9)]),
                      interp(wk, [(1, .9), (20, .95), (40, 1.05), (48, 1.3), (52, 1.1)]),
                      interp(wk, [(1, .4), (8, .6), (12, 1.6), (18, 2.0), (24, 1.7), (30, 1.1), (36, .7), (44, .4), (52, .35)]),
                      interp(wk, [(1, .6), (10, .7), (30, .7), (40, .9), (44, 1.4), (48, 2.2), (51, 2.8), (52, 1.2)])])

def mdsea(wk):                        # markdown intensity by category: Jan sale, early autumn clearance (Apparel), Garden end of season
    one = np.ones_like(wk, float); jan = interp(wk, [(1, 1.6), (4, 1.3), (6, 1.0), (52, 1.0)])
    return np.vstack([one, one, one, one, interp(wk, [(1, 1.2), (6, 1), (47, 1), (48, 1.8), (49, 1), (52, 1)]),
                      jan * interp(wk, [(1, 1), (25, 1), (28, 1.5), (31, 1.1), (36, 1.6), (43, 1.9), (52, 1.4)]), jan,
                      interp(wk, [(1, 1), (28, 1), (32, 1.4), (40, 1.7), (52, 1.5)]), one])

# ---- story anchors (v5 Week 43, ALL scope; ADR-0013 (f), E-30..E-41) ------------------------------------------------
A = dict(
    net43=C(61_407_862.34), md43=C(6_694_215.07), ret43=C(312_048.66), cogs43=C(42_914_970.12), back43=C(3_806_233.41),
    store43=C(42_006_118.90), online43=C(12_196_734.55), lfl43=C(38_990_412.77),
    net43ly=C(59_160_248.18), store43ly=C(41_105_331.62), online43ly=C(10_880_917.25), lfl43ly=C(37_712_186.04),
    p10net=C(241_690_417.83), p10tm=C(87_711_634.27), ytdnet=C(2_318_203_551.40),
    p10cost=dict(SHRINK=C(2_204_318.40), STORE_OPEX=C(52_380_912.55), CENTRAL_OPEX=C(11_611_207.10), FULFILMENT=C(6_215_980.33)),
    bud43=C(62_912_987.45), budp10=C(244_097_812.66), ebbudp10=C(16_096_880.12),
    oh43=C(401_962_415.30), oo43=C(88_118_604.12), f43=C(43_012_377.85),
    ranged43=497_000, instock43=467_700, due43=4_812, otif43=4_591, gmroi=2.7031)
SEASON = {  # sell-through pins at season week 12 (FY W43), selling locations, units (E-37): opening, receipts wk 1-12, sold wk 1-12
    'AW26': dict(O=[1_550_000, 1_250_000, 650_000, 764_000], R=[3_116_000, 2_750_000, 1_350_000, 1_902_000]),
    'AW25': dict(O=[1_500_000, 1_200_000, 620_000, 730_000], R=[2_980_000, 2_650_000, 1_310_000, 2_010_000])}
SEASON['AW26']['U'] = [2_706_280, 2_760_000, 1_320_000, 8_413_000 - 2_706_280 - 2_760_000 - 1_320_000]   # Apparel 58 %, Home 69 %, total 63.1 %
SEASON['AW25']['U'] = [2_508_800, 2_579_500, 1_235_200, 7_891_000 - 2_508_800 - 2_579_500 - 1_235_200]   # total 60.7 %
PTS = dict(  # v5 13-week bar series, W31..W43
    ns=[57.8, 58.4, 59.1, 60.3, 58.9, 59.6, 61.2, 60.4, 59.8, 60.9, 61.7, 60.2, 61.4],
    tm=[35.9, 36.0, 36.2, 36.1, 35.8, 36.0, 36.4, 36.2, 36.1, 36.3, 36.5, 36.0, 36.3],
    wc=[9.2, 9.4, 9.6, 9.9, 10.1, 10.3, 10.6, 10.4, 10.8, 11.0, 11.2, 11.1, 11.4],
    md=[7.9, 8.1, 8.4, 8.2, 8.6, 8.9, 8.7, 9.1, 9.4, 9.0, 9.3, 9.6, 9.8],
    av=[96.8, 96.5, 96.9, 96.2, 95.9, 96.1, 95.4, 95.0, 95.2, 94.8, 94.6, 94.3, 94.1],
    eb=[3.6, 3.7, 3.8, 3.9, 3.6, 3.8, 4.0, 3.8, 3.7, 3.9, 4.0, 3.7, 3.7],
    lf=[2.1, 2.4, 2.8, 3.1, 2.6, 2.9, 3.5, 3.0, 2.7, 3.2, 3.6, 3.1, 3.4],
    fg=[29.6, 29.8, 30.2, 30.0, 29.7, 30.1, 30.3, 29.9, 30.0, 30.2, 30.4, 29.8, 30.1],
    ot=[94.0, 94.6, 95.1, 94.8, 95.3, 95.0, 94.7, 95.2, 95.6, 95.1, 95.4, 95.0, 95.4])
B31 = 82                              # week index of FY2026 W31
CHM = np.array([1.0, 1.03, 1.25])     # COGS-ratio factor by channel: store, online, wholesale (wholesale ~ 12 % front margin)


def build_stores(rng):
    nl = [('Amsterdam', 'Randstad'), ('Rotterdam', 'Randstad'), ('Den Haag', 'Randstad'), ('Utrecht', 'Randstad'), ('Leiden', 'Randstad'),
          ('Haarlem', 'Randstad'), ('Delft', 'Randstad'), ('Dordrecht', 'Randstad'), ('Zoetermeer', 'Randstad'), ('Amersfoort', 'Randstad'),
          ('Almere', 'Randstad'), ('Gouda', 'Randstad'), ('Alphen aan den Rijn', 'Randstad'), ('Hilversum', 'Randstad'), ('Schiedam', 'Randstad'),
          ('Groningen', 'North & East'), ('Leeuwarden', 'North & East'), ('Zwolle', 'North & East'), ('Enschede', 'North & East'),
          ('Apeldoorn', 'North & East'), ('Deventer', 'North & East'), ('Arnhem', 'North & East'), ('Nijmegen', 'North & East'),
          ('Assen', 'North & East'), ('Emmen', 'North & East'), ('Hengelo', 'North & East'), ('Ede', 'North & East'),
          ('Eindhoven', 'South'), ('Tilburg', 'South'), ('Breda', 'South'), ('Den Bosch', 'South'), ('Maastricht', 'South'), ('Venlo', 'South'),
          ('Helmond', 'South'), ('Roosendaal', 'South'), ('Bergen op Zoom', 'South'), ('Heerlen', 'South'), ('Sittard', 'South'), ('Oss', 'South'),
          ('Middelburg', 'South')]
    be = [('Antwerpen', 'Flanders'), ('Gent', 'Flanders'), ('Brugge', 'Flanders'), ('Leuven', 'Flanders'), ('Mechelen', 'Flanders'),
          ('Aalst', 'Flanders'), ('Kortrijk', 'Flanders'), ('Hasselt', 'Flanders'), ('Sint-Niklaas', 'Flanders'), ('Genk', 'Flanders'),
          ('Oostende', 'Flanders'), ('Roeselare', 'Flanders'), ('Turnhout', 'Flanders'), ('Lier', 'Flanders'), ('Dendermonde', 'Flanders'),
          ('Brussel', 'Brussels'), ('Anderlecht', 'Brussels'), ('Schaerbeek', 'Brussels'), ('Ixelles', 'Brussels'), ('Uccle', 'Brussels'),
          ('Liege', 'Wallonia'), ('Charleroi', 'Wallonia'), ('Namur', 'Wallonia'), ('Mons', 'Wallonia'), ('La Louviere', 'Wallonia'),
          ('Tournai', 'Wallonia'), ('Verviers', 'Wallonia'), ('Wavre', 'Wallonia'), ('Arlon', 'Wallonia'), ('Nivelles', 'Wallonia')]
    rows, names = [], set()
    for country, cities, mix in [('NL', nl, [('hyper', 11), ('super', 41), ('convenience', 32)]), ('BE', be, [('hyper', 9), ('super', 29), ('convenience', 23)])]:
        pool = [cities[k] for k in rng.permutation(len(cities))]
        big = [cities[k] for k in range(len(cities))]               # list order puts the big cities first: hypers go there
        n = 0
        for fmt, cnt in mix:
            for k in range(cnt):
                city, region = big[k % 12] if fmt == 'hyper' else pool[n % len(pool)]
                n += fmt != 'hyper'
                base = {'hyper': f'Nordmark Hyper {city}', 'super': f'Nordmark {city}', 'convenience': f'Nordmark Express {city}'}[fmt]
                name, s = base, 2
                while name in names: name, s = f'{base} {s}', s + 1
                names.add(name); rows.append((country, region, city, fmt, name))
    st = pd.DataFrame(rows, columns=['country', 'region', 'city', 'format', 'store_name'])
    S = len(st); assert S == 145
    st['store_code'] = [f'S{k + 1:03d}' for k in range(S)]
    od = np.datetime64('1996-01-01') + rng.integers(0, (np.datetime64('2023-06-30') - np.datetime64('1996-01-01')).astype(int), S)
    od = od - ((od.astype('datetime64[D]').view('int64') - 4) % 7)                                       # align to Monday
    cd = np.full(S, np.datetime64('NaT', 'D')); rd = cd.copy()
    p = rng.permutation(S)
    new = np.array(['2025-10-06', '2025-11-17', '2026-02-02', '2026-04-13', '2026-06-01', '2026-09-07'], 'datetime64[D]')
    od[p[:6]] = new; od[p[6:8]] = np.array(['2025-02-03', '2025-05-12'], 'datetime64[D]')
    cd[p[8:11]] = np.array(['2026-03-01', '2026-06-14', '2026-08-30'], 'datetime64[D]')                   # three closures in FY2026 (E-74)
    rd[p[11:16]] = np.array(['2025-11-03', '2026-01-12', '2026-03-16', '2026-05-11', '2026-08-03'], 'datetime64[D]')
    rd[p[16:20]] = np.array(['2023-04-03', '2023-09-11', '2024-02-05', '2024-06-17'], 'datetime64[D]')
    st['open_date'], st['close_date'], st['refit_date'] = od, cd, rd
    size = {'hyper': 700_000, 'super': 300_000, 'convenience': 110_000}
    st['size'] = st.format.map(size).values * np.exp(rng.normal(0, .22, S))
    st['sales_area_sqm'] = np.rint(st['size'] / st.format.map({'hyper': 78, 'super': 150, 'convenience': 270}).values / 50).astype(np.int64) * 50
    st['cluster'] = np.where(st.region.isin(['Randstad', 'Brussels']), 'Urban', np.where(rng.random(S) < .55, 'Suburban', 'Regional'))
    return st


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent)); out = Path(ap.parse_args().out)
    t0 = time.time(); rng = np.random.default_rng(SEED)
    (out / 'parquet').mkdir(parents=True, exist_ok=True); (out / 'checks').mkdir(exist_ok=True)
    assert fy_start(2025) == FY0 and fy_start(2026) == FY0 + timedelta(364) and fy_start(2027) == FY0 + timedelta(728)   # no 53-week year
    assert str(WS[CUR]) == '2026-10-19' and str(WE[CUR]) == '2026-10-25' and str(PS[CUR]) == '2026-09-28' and PER[CUR] == 10 and WOP[CUR] == 4

    # ---- sites ------------------------------------------------------------------------------------------------------
    st = build_stores(rng); S = len(st)
    od, cd, rd = st.open_date.values.astype('datetime64[D]'), st.close_date.values.astype('datetime64[D]'), st.refit_date.values.astype('datetime64[D]')
    OPEN = (od[:, None] <= WE[None, :]) & (np.isnat(cd)[:, None] | (cd[:, None] >= WS[None, :]))      # store x week, actual estate
    BOPEN = od[:, None] <= WE[None, :]                                                                 # budget estate (closures unplanned)
    LFL = lfl_matrix(od, cd, rd, PS, PE)                                                               # store x week (period rule)
    LFL_NY = lfl_matrix(od, cd, rd, PS + np.timedelta64(364, 'D'), PE + np.timedelta64(364, 'D'))                                                # same week one year later (LY side)
    assert OPEN[:, CUR].sum() == 142 and LFL[:, CUR].sum() == 131                                      # E-74 / ET-06
    J_ON, J_WH, J_DCN, J_DCB = S, S + 1, S + 2, S + 3                                                  # site index of the non-store sites

    # ---- story: ALL net sales by week (cents) -------------------------------------------------------------------------
    ns = np.zeros(NACT); k9 = np.arange(9); pn = np.array(PTS['ns'])
    wig = pn[:9] - np.polyval(np.polyfit(k9, pn[:9], 1), k9)
    ns[B31:B31 + 9] = (54.8 + .55 * k9 + wig) * 1e6
    ns[91:94] = pn[9:12] * 1e6 * ((A['p10net'] - A['net43']) / 100) / (pn[9:12].sum() * 1e6); ns[CUR] = A['net43'] / 100
    base = pseason(WKA[52:B31]) * (1 + .0015 * np.arange(30)) * np.exp(rng.normal(0, .012, 30))
    ns[52:B31] = base * (A['ytdnet'] / 100 - ns[B31:NACT].sum()) / base.sum()
    # FY2025 totals follow from the channel growths (two passes; every noise array is drawn once, before the loop)
    e_lvl, e_st, e_on = rng.normal(0, .01, 9), rng.normal(0, .0015, 52), rng.normal(0, .0012, 52)
    e_og, e_w25, e_w26 = rng.normal(0, .004, 43), rng.normal(0, .04, (S, 52)), rng.normal(0, .03, (S, 43))
    e_lf, e_wh = rng.normal(0, .002, 30), rng.normal(0, .004, 43)
    gs = rng.normal(.032, .02, S)
    fe = st.format.map({'hyper': 1.25, 'super': 1.0, 'convenience': .6}).values
    wso = ((WS[None, :] - od[:, None]).astype(int) // 7)
    ramp = np.clip(.7 + .3 * wso / 8, 0, 1)
    refit = np.where(WS[None, :] > rd[:, None], 1.07, 1.0) * np.where((WS[None, :] <= rd[:, None]) & (rd[:, None] <= WE[None, :]), .6, 1.0)
    struct = st['size'].values[:, None] * 100 * pseason(WKA)[None, :] ** fe[:, None] * ramp * refit
    lflr = np.r_[.026 + .004 * np.sin(2 * np.pi * np.arange(30) / 26) + e_lf, np.array(PTS['lf'][:12]) / 100]
    i25 = np.arange(52)
    sh_st = .722 + (.695 - .722) * i25 / 42 + e_st; sh_on = .158 + (.184 - .158) * i25 / 42 + e_on
    g25 = np.full(43, .038)
    for it in range(3):
        ns[:43] = ns[52:95] / (1 + g25); ns[42] = A['net43ly'] / 100
        lvl = np.median(ns[:43] / pseason(WKA[:43])); ns[43:52] = lvl * pseason(WKA[43:52]) * np.exp(e_lvl)
        NS = np.rint(ns * 100).astype(np.int64); NS[CUR], NS[42] = A['net43'], A['net43ly']
        NS[93] = A['p10net'] - NS[CUR] - NS[91] - NS[92]; NS[81] = A['ytdnet'] - NS[52:81].sum() - NS[B31:NACT].sum()
        # channel split: FY2025 by share; FY2026 stores bottom-up (LFL target + organic non-LFL stores), online from LY growth, wholesale = rest
        STORE = np.zeros(NACT, np.int64); ONL = np.zeros(NACT, np.int64)
        STORE[:52] = np.rint(NS[:52] * sh_st); ONL[:52] = np.rint(NS[:52] * sh_on)
        STORE[42], ONL[42] = A['store43ly'], A['online43ly']
        ONL[52:] = np.rint(ONL[:43] * (1.112 + .009 * np.arange(43) / 42 + e_og)); ONL[CUR] = A['online43']
        # store-level net sales (LFL pins)
        V = np.zeros((S, NACT), np.int64)
        for i in range(52):
            w = struct[:, i] * np.exp(e_w25[:, i])
            s_ = np.nonzero(OPEN[:, i])[0]
            if i == 42:                                                                                # FY2025 W43: LY side of the W43 LFL set
                gi = (~LFL[s_, CUR]).astype(int)
                V[s_, i] = alloc(gi, w[s_], np.array([A['lfl43ly'], STORE[i] - A['lfl43ly']]))
            else: V[s_, i] = alloc(np.zeros(len(s_), int), w[s_], np.array([STORE[i]]))
        for i in range(52, NACT):
            s_ = np.nonzero(OPEN[:, i])[0]
            both = OPEN[s_, i - 52]
            w = np.where(both, V[s_, i - 52] * (struct[s_, i] / np.maximum(struct[s_, i - 52], 1)) * (1 + gs[s_]), struct[s_, i]) * np.exp(e_w26[s_, i - 52])
            gi = (~LFL[s_, i]).astype(int)
            lfl_t = A['lfl43'] if i == CUR else int(round(V[s_[LFL[s_, i]], i - 52].sum() * (1 + lflr[i - 52])))
            STORE[i] = A['store43'] if i == CUR else lfl_t + int(round(w[gi == 1].sum()))
            V[s_, i] = alloc(gi, w, np.array([lfl_t, STORE[i] - lfl_t]))
        WHS = NS - STORE - ONL
        # implied total growth with wholesale at +1 % (+ noise): sets the FY2025 weekly totals of the next pass
        g25 = (STORE[52:] + ONL[52:] + (NS[:43] - STORE[:43] - ONL[:43]) * (1.01 + e_wh)) / NS[:43] - 1
    nonlfl = [(STORE[i] - V[LFL[:, i], i].sum()) / max(1, (OPEN[:, i] & ~LFL[:, i]).sum()) / 1e5 for i in range(52, NACT)]
    assert min(nonlfl) > 50 and max(nonlfl) < 700, nonlfl                                                # non-LFL store average k EUR / week stays plausible
    whs_g = WHS[52:] / WHS[:43] - 1
    print('wholesale growth vs LY: min %.3f max %.3f' % (whs_g.min(), whs_g.max()), ' store growth: min %.3f max %.3f' % ((STORE[52:] / STORE[:43] - 1).min(), (STORE[52:] / STORE[:43] - 1).max()))
    assert ((WHS / NS > .10) & (WHS / NS < .14)).all(), (WHS / NS).round(3)


    # ratios -> amounts (cents)
    mdr = np.zeros(NACT); fgm = np.zeros(NACT); bk = np.zeros(NACT)
    md26 = np.r_[[.105, .100, .093, .088], .078 + rng.normal(0, .002, 20), [.088, .092, .094, .090, .085, .081], np.array(PTS['md']) / 100]
    mdr[52:95] = md26; mdr[:43] = np.r_[md26[:30] - .003, md26[30:] - .016]; mdr[42] = .0788
    mdr[43:52] = [.084, .086, .088, .087, .105, .090, .088, .091, .110]
    rr = .0046 + rng.normal(0, .0002, NACT)
    fgm[52:95] = np.r_[.298, .297, .300 + rng.normal(0, .0015, 28), np.array(PTS['fg']) / 100]
    fgm[:52] = .303 + rng.normal(0, .0015, 52); fgm[42] = .304; fgm[43:52] = .298 + rng.normal(0, .001, 9)
    bk[52:95] = np.r_[.061 + rng.normal(0, .0008, 30), (np.array(PTS['tm']) - np.array(PTS['fg'])) / 100]
    bk[:52] = .060 + rng.normal(0, .0008, 52); bk[42] = .061
    GROSS_F = NS / (1 - mdr - rr)
    MD = np.rint(GROSS_F * mdr).astype(np.int64); RET = np.rint(GROSS_F * rr).astype(np.int64)
    COGS = np.rint(NS * (1 - fgm)).astype(np.int64); BACK = np.rint(NS * bk).astype(np.int64)
    MD[CUR], RET[CUR], COGS[CUR], BACK[CUR] = A['md43'], A['ret43'], A['cogs43'], A['back43']
    d = A['p10tm'] - (NS[91:95] - COGS[91:95] + BACK[91:95]).sum()                                     # pin P10 total margin
    BACK[91:94] += alloc(np.zeros(3, int), np.ones(3), np.array([d]))
    TM = NS - COGS + BACK

    # EBITDA (cents) and opex by type
    eb = np.zeros(NACT)
    er26 = np.r_[[.035, .040, .045, .050], .058 + rng.normal(0, .003, 26)]
    eb[52:B31] = NS[52:B31] * er26; eb[B31:91] = np.array(PTS['eb'][:9]) * 1e8 * np.exp(rng.normal(0, .003, 9))
    eb[:43] = NS[:43] * np.r_[er26 - .002, (eb[B31:91] / NS[B31:91]) - .002, [.060] * 4]
    eb[43:52] = NS[43:52] * np.array([.066, .068, .070, .072, .082, .078, .085, .092, .060])
    EB = np.rint(eb).astype(np.int64)
    EB[91:95] = alloc(np.zeros(4, int), np.array(PTS['eb'][9:]) * np.exp(rng.normal(0, .002, 4)),
                      np.array([A['p10tm'] - sum(A['p10cost'].values())]))
    COST = TM - EB
    CT = ['SHRINK', 'STORE_OPEX', 'CENTRAL_OPEX', 'FULFILMENT']
    shr = NS * .0091 * np.exp(rng.normal(0, .02, NACT)); ful = .115 * ONL + .02 * WHS
    cen = 2.90e8 * np.where((WKA[:NACT] >= 49), 1.06, 1.0) * np.exp(rng.normal(0, .01, NACT))
    OPEX = np.zeros((NACT, 4), np.int64)
    OPEX[:, 0], OPEX[:, 3], OPEX[:, 2] = np.rint(shr), np.rint(ful), np.rint(cen)
    m = np.vstack([shr[91:95], (COST[91:95] - shr[91:95] - cen[91:95] - ful[91:95]), cen[91:95], ful[91:95]]).T
    colt = np.array([A['p10cost'][c] for c in CT], float)
    for _ in range(500):                                                                               # rake W40-W43 to rows (cost) x cols (P10 pins)
        m *= (COST[91:95] / m.sum(1))[:, None]; m *= (colt / m.sum(0))[None, :]
    for c in [0, 2, 3]: OPEX[91:95, c] = alloc(np.zeros(4, int), m[:, c], np.array([A['p10cost'][CT[c]]]))
    OPEX[:, 1] = COST - OPEX[:, 0] - OPEX[:, 2] - OPEX[:, 3]
    assert (OPEX > 0).all() and OPEX[91:95, 1].sum() == A['p10cost']['STORE_OPEX']

    # ---- sales cells ------------------------------------------------------------------------------------------------
    SN = np.zeros((S + 2, NACT), np.int64); SN[:S] = V; SN[J_ON], SN[J_WH] = ONL, WHS
    bs = np.tile(CA['st'], (S, 1))
    adj = {'convenience': [1.15, 1.15, 1.0, 1.0, .5, .6, .6, .5, .6], 'hyper': [.9, .95, 1.0, 1.0, 1.3, 1.3, 1.3, 1.3, 1.3], 'super': [1] * 9}
    bs = bs * np.array([adj[f] for f in st.format]) * np.exp(rng.normal(0, .08, (S, NC)))
    BS = np.vstack([bs, CA['on'], CA['wh']]); BS = BS / BS.sum(1, keepdims=True)
    act = np.vstack([OPEN[:, :NACT], np.ones((2, NACT), bool)])
    jj, ii = np.nonzero(act); order = np.lexsort((jj, ii)); jj, ii = jj[order], ii[order]               # site-week rows, week-major
    nsw = len(jj)
    w = BS[jj] * csea(WKA[ii]).T * np.exp(rng.normal(0, .03, (nsw, NC)))
    sw_id = np.repeat(np.arange(nsw), NC)
    net = alloc(sw_id, w.ravel(), SN[jj, ii])
    fs = pd.DataFrame(dict(i=np.repeat(ii, NC), j=np.repeat(jj, NC), c=np.tile(np.arange(NC), nsw), net=net))
    I, Jx, Cx = fs.i.values, fs.j.values, fs.c.values; wkc = WKA[I]
    nf = fs.net.values.astype(float)
    on = Jx == J_ON
    wh = Jx == J_WH
    fs['md'] = alloc(I, nf * CA['md'][Cx] * mdsea(wkc)[Cx, np.arange(len(fs))] * np.where(wh, .15, 1) * np.exp(rng.normal(0, .1, len(fs))) + 1e-6, MD)
    fs['ret'] = alloc(I, nf * np.where(on, 3.5, np.where(wh, .3, 1)) * np.where(np.isin(Cx, [4, 5]), 2, 1) * np.exp(rng.normal(0, .1, len(fs))) + 1e-6, RET)
    fs['cogs'] = alloc(I, nf * (1 - CA['fgm'][Cx]) * CHM[np.minimum(Jx - S, 1).clip(-1) + 1] * np.exp(rng.normal(0, .015, len(fs))) + 1e-6, COGS)
    fs['gross'] = fs.net + fs.md + fs.ret
    # back margin: week x category from supplier accruals, then to cells by COGS share (E-33)
    ic = I * NC + Cx
    cogs_ic = np.bincount(ic, fs.cogs.values.astype(float), minlength=NACT * NC)
    BACK_IC = alloc(np.repeat(np.arange(NACT), NC), cogs_ic * np.tile(CA['br'], NACT) * np.exp(rng.normal(0, .03, NACT * NC)) + 1e-6, BACK)
    fs['back'] = alloc(ic, fs.cogs.values.astype(float) + 1e-6, BACK_IC)
    fs['lfl'] = np.where(Jx < S, LFL[np.minimum(Jx, S - 1), I], False)
    fs['lfl_ny'] = np.where(Jx < S, LFL_NY[np.minimum(Jx, S - 1), I], False)

    # units (seasonal pins at selling locations, E-37) and transactions
    sell = (Jx < S) | on
    units = np.zeros(len(fs), np.int64); pinned = np.zeros(len(fs), bool); price = CA['price'].astype(float).copy()
    for code, fy in [('AW26', 2026), ('AW25', 2025)]:
        for q, c in enumerate(np.nonzero(SEASONAL)[0]):
            msk = sell & (Cx == c) & (FYA[I] == fy) & (SWK[I] >= 1) & (SWK[I] <= 12)
            units[msk] = alloc(np.zeros(msk.sum(), int), nf[msk], np.array([SEASON[code]['U'][q]])); pinned |= msk
            if fy == 2026: price[c] = nf[msk].sum() / 100 / SEASON[code]['U'][q]
    free = ~pinned
    units[free] = np.rint(nf[free] / 100 / price[Cx[free]] * np.exp(rng.normal(0, .03, free.sum())))
    fs['units'] = units
    fs['transactions'] = np.rint(np.where(Jx == J_WH, units / 400, units / CA['items'][Cx])).astype(np.int64)

    # ---- budget (bottom-up per channel: LFL stores LY x 1.03, planned non-LFL stores, online LY x 1.15, wholesale LY x 1.02;
    #      W43 pinned to EUR 62.9 m at exactly 70 / 18 / 12, P10 pinned to EUR 244.1 m) -------------------------------------------
    BI = np.arange(52, NWK)                                                                            # budget week index
    lflb = .030 + rng.normal(0, .0007, 52); lflb[42] = .03
    e_b = rng.normal(0, .02, (S, 52)); e_bo, e_bw = rng.normal(0, .004, 52), rng.normal(0, .006, 52)
    WB, TG, NL_ = [], np.zeros(52), np.zeros(52)
    for b in range(52):
        i = 52 + b; s_ = np.nonzero(BOPEN[:, i])[0]; ly = OPEN[s_, b]
        w = np.where(ly, V[s_, b] * 1.03, struct[s_, i]) * np.exp(e_b[s_, b]); lflset = LFL[s_, i]
        TG[b] = (A['lfl43ly'] if i == CUR else V[s_[lflset], b].sum()) * (1 + lflb[b]); NL_[b] = w[~lflset].sum(); WB.append((s_, w, lflset))
    BON = np.rint(ONL[:52] * (1.10 + e_bo)).astype(np.int64); BWH = np.rint(WHS[:52] * (1.01 + e_bw)).astype(np.int64)
    BST = np.rint(TG + NL_).astype(np.int64)
    k = (A['budp10'] - A['bud43'] - TG[39:42].sum()) / (NL_[39:42] + BON[39:42] + BWH[39:42]).sum()      # P10 pin, LFL plan kept
    assert .95 < k < 1.03, k
    NL_[39:42] *= k
    BON[39:42] = np.rint(BON[39:42] * k); BWH[39:42] = np.rint(BWH[39:42] * k); BST[39:42] = np.rint(TG[39:42] + NL_[39:42])
    BST[41] = A['budp10'] - A['bud43'] - BON[39:42].sum() - BWH[39:42].sum() - BST[39:41].sum()
    BST[42] = np.rint(A['bud43'] * .70); BON[42] = np.rint(A['bud43'] * .18); BWH[42] = A['bud43'] - BST[42] - BON[42]
    TG[42] = round(A['lfl43ly'] * 1.03)
    NB = BST + BON + BWH; assert NB[42] == A['bud43'] and NB[39:43].sum() == A['budp10']
    VB = np.zeros((S, 52), np.int64)
    for b, (s_, w, lflset) in enumerate(WB):
        tg = int(round(TG[b])); VB[s_, b] = alloc((~lflset).astype(int), w, np.array([tg, BST[b] - tg]))
    assert VB[BOPEN[:, 52:]].min() > 0
    SB = np.zeros((S + 2, 52), np.int64); SB[:S] = VB; SB[J_ON], SB[J_WH] = BON, BWH
    bact = np.vstack([BOPEN[:, 52:], np.ones((2, 52), bool)])
    bj, bb = np.nonzero(bact); o_ = np.lexsort((bj, bb)); bj, bb = bj[o_], bb[o_]
    lyshare = np.zeros((S + 2, 52, NC))
    np.add.at(lyshare, (fs.j.values[fs.i.values < 52], fs.i.values[fs.i.values < 52], fs.c.values[fs.i.values < 52]), fs.net.values[fs.i.values < 52].astype(float))
    bw = lyshare[bj, bb] + 1e-3 * BS[bj] * csea(WKA[bb + 52]).T * np.maximum(SB[bj, bb], 1)[:, None]
    bnet = alloc(np.repeat(np.arange(len(bj)), NC), bw.ravel(), SB[bj, bb])
    fb = pd.DataFrame(dict(b=np.repeat(bb, NC), j=np.repeat(bj, NC), c=np.tile(np.arange(NC), len(bj)), net=bnet))
    mdb = .085 + rng.normal(0, .0015, 52); mdb[[0, 1, 2]] = [.100, .095, .090]; mdb[30:43] = .085 + rng.normal(0, .0005, 13); mdb[42] = .085
    fgb = .300 + rng.normal(0, .0008, 52); fgb[42] = .30; bkb = .062 + rng.normal(0, .0005, 52); bkb[42] = .062
    GB = np.rint(NB / (1 - mdb - .0045)).astype(np.int64)
    MDB = np.rint(GB * mdb).astype(np.int64); CB = np.rint(NB * (1 - fgb)).astype(np.int64); BKB = np.rint(NB * bkb).astype(np.int64)
    RB = GB - NB - MDB
    bnf = fb.net.values.astype(float); bc = fb.c.values
    bwh = fb.j.values == J_WH
    fb['md'] = alloc(fb.b.values, bnf * CA['md'][bc] * np.where(bwh, .15, 1) + 1e-6, MDB)
    fb['ret'] = alloc(fb.b.values, bnf * np.where(fb.j.values == J_ON, 3.5, np.where(bwh, .3, 1)) + 1e-6, RB)
    fb['cogs'] = alloc(fb.b.values, bnf * (1 - CA['fgm'][bc]) * CHM[np.minimum(fb.j.values - S, 1).clip(-1) + 1] + 1e-6, CB)
    fb['back'] = alloc(fb.b.values, fb.cogs.values * CA['br'][bc] + 1e-6, BKB)
    fb['gross'] = fb.net + fb.md + fb.ret
    fb['lfl'] = np.where(fb.j.values < S, LFL[np.minimum(fb.j.values, S - 1), fb.b.values + 52], False)
    TMB = NB - CB + BKB
    ebb = NB * (.066 + rng.normal(0, .002, 52)); ebb[:4] = NB[:4] * .045; ebb[47:52] = NB[47:52] * .085
    EBB = np.rint(ebb).astype(np.int64); EBB[39:43] = alloc(np.zeros(4, int), ebb[39:43], np.array([A['ebbudp10']]))
    COSTB = TMB - EBB
    OPEXB = np.zeros((52, 4), np.int64)
    OPEXB[:, 0] = np.rint(NB * .0088); OPEXB[:, 3] = np.rint(.112 * BON + .02 * BWH); OPEXB[:, 2] = np.rint(2.88e8 * np.where(WKA[BI] >= 49, 1.05, 1.0))
    OPEXB[:, 1] = COSTB - OPEXB[:, 0] - OPEXB[:, 2] - OPEXB[:, 3]; assert (OPEXB > 0).all()

    # ---- opex rows (ACT + BUD) -----------------------------------------------------------------------------------------
    ox = []
    def opex_rows(scen, wk_idx, OP, sales_by_store, open_m, onl, whs):
        for n, i in enumerate(wk_idx):
            s_ = np.nonzero(open_m[:, n])[0]
            ox.append((scen, i, 0, s_, alloc(np.zeros(len(s_), int), sales_by_store[s_, n].astype(float) * np.exp(rng.normal(0, .15, len(s_))) + 1, OP[n, 0:1])))
            ox.append((scen, i, 1, s_, alloc(np.zeros(len(s_), int), st['size'].values[s_] ** .7 * np.exp(rng.normal(0, .05, len(s_))), OP[n, 1:2])))
            ox.append((scen, i, 2, np.array([-1]), OP[n, 2:3]))
            ox.append((scen, i, 3, np.array([J_ON, J_WH]), alloc(np.zeros(2, int), np.array([.115 * onl[n], .02 * whs[n]]), OP[n, 3:4])))
    opex_rows('ACT', range(NACT), OPEX, V, OPEN[:, :NACT], ONL, WHS)
    opex_rows('BUD', BI, OPEXB, VB, BOPEN[:, 52:], BON, BWH)

    # ---- forecast (forward weekly COGS) ---------------------------------------------------------------------------------
    fut = np.r_[COGS.astype(float), CB[43:52] * (COGS[CUR] / CB[42])]
    F = np.rint(np.array([fut[i + 1:i + 5].mean() for i in range(NACT)]) * np.exp(rng.normal(0, .008, NACT))).astype(np.int64)
    F[CUR] = A['f43']
    F_IC = alloc(np.repeat(np.arange(NACT), NC), np.tile(CA['fsh'], NACT), F)                       # fixed category shares -> ALL target 9.5
    cog_cell = fs.cogs.values.astype(float)
    fs_f = fs[['i', 'j', 'c']].copy()
    fs_f['f'] = alloc(ic, cog_cell * np.exp(rng.normal(0, .05, len(fs))) + 1, F_IC)

    # ---- inventory: ALL on-hand path (GMROI 2.70 and W43 EUR 402 m), on-order (cover pins) ---------------------------------
    fm = NS - COGS
    FM52 = fm[43:95].sum(); AV = FM52 / A['gmroi']
    knots = [(0, .93), (7, .93), (8, .96), (30, .96), (44, 1.40), (51, 1.06), (52, .90), (59, .90), (60, .92), (81, .92), (82, .95)]
    hfix = interp(np.arange(82), knots) * np.exp(np.convolve(rng.normal(0, .02, 86), np.ones(5) / 5, 'valid')[:82]); rho = A['oh43'] / AV
    Cw = hfix[43:82].sum()                                                    # h(94) = R, mean over i=43..94 of h = (Cw + sum ramp)/52
    R = rho * (Cw + 13 * .95 - 6.5 * .95) / (52 - 6.5 * rho)
    h = np.r_[hfix, .95 + (R - .95) * np.arange(13) / 12]
    OH = np.rint(AV * h / h[43:95].mean()).astype(np.int64); OH[CUR] = A['oh43']
    fm_c = np.bincount(Cx[I >= 43], (fs.net.values - fs.cogs.values)[I >= 43].astype(float), minlength=NC)
    gfix = {0: 9.0, 2: 4.1, 4: 1.9}; gvar = {1: 2.9, 3: 2.8, 5: 2.6, 6: 2.3, 7: 1.9, 8: 2.4}
    kap = sum(fm_c[c] / g for c, g in gvar.items()) / (AV - sum(fm_c[c] / g for c, g in gfix.items()))
    gtar = {**gfix, **{c: g * kap for c, g in gvar.items()}}
    q = np.array([fm_c[c] / gtar[c] / AV for c in range(NC)]); assert abs(q.sum() - 1) < 1e-9
    OH_IC = alloc(np.repeat(np.arange(NACT), NC), np.tile(q, NACT) * np.exp(rng.normal(0, .004, NACT * NC)), OH)
    cov = np.r_[np.zeros(B31), np.array(PTS['wc'])]
    oor = np.where((WKA[:NACT] >= 32) & (WKA[:NACT] <= 46), .22, np.where(WKA[:NACT] >= 47, .15, .20)) * np.exp(rng.normal(0, .02, NACT))
    OO = np.rint(np.where(cov > 0, cov * F - OH, oor * OH)).astype(np.int64); OO[CUR] = A['oo43']
    assert (OO > 0).all()
    OO_IC = alloc(np.repeat(np.arange(NACT), NC), OH_IC.astype(float) * np.exp(rng.normal(0, .05, NACT * NC)), OO)
    # locations: stores open, ONLINE fulfilment centre, two DCs
    sn_ic = np.zeros((S + 2, NACT, NC)); np.add.at(sn_ic, (Jx, I, Cx), nf)
    tot_ic = sn_ic.sum(0); fc_sh = .4 * sn_ic[J_ON] / np.maximum(tot_ic, 1)
    loc_rows = []
    for i in range(NACT):
        s_ = np.nonzero(OPEN[:, i])[0]
        locs = np.r_[s_, J_ON, J_DCN, J_DCB]
        for c in range(NC):
            stw = sn_ic[s_, i, c] / max(sn_ic[s_, i, c].sum(), 1) * (1 - CA['dc'][c] - fc_sh[i, c])
            loc_rows.append((i, c, locs, np.r_[stw, fc_sh[i, c], CA['dc'][c] * .6, CA['dc'][c] * .4]))
    li = np.concatenate([np.full(len(r[2]), r[0]) for r in loc_rows]); lc = np.concatenate([np.full(len(r[2]), r[1]) for r in loc_rows])
    lj = np.concatenate([r[2] for r in loc_rows]); lw = np.concatenate([r[3] for r in loc_rows]) * np.exp(rng.normal(0, .08, len(li))) + 1e-9
    gic = li * NC + lc
    fi = pd.DataFrame(dict(i=li, j=lj, c=lc))
    fi['oh'] = alloc(gic, lw, OH_IC)
    oow = lw * np.where(lj >= J_DCN, 3.0, np.where(lj == J_ON, 1.0, .25))
    fi['oo'] = alloc(gic, oow, OO_IC)
    fi['transit'] = np.rint(fi.oo * .12 * np.exp(rng.normal(0, .2, len(fi)))).astype(np.int64)
    agr = np.array([.01, .06, .09, .08, .16, .15, .17, .20, .12])[lc] * np.where((lc == 7) & (WKA[li] >= 32), 1.4, 1.0)
    fi['aged'] = np.rint(fi.oh * agr * np.exp(rng.normal(0, .1, len(fi)))).astype(np.int64)
    ucost = price * (1 - CA['fgm'])
    ohu = np.rint(fi.oh.values / 100 / ucost[lc] * np.exp(rng.normal(0, .03, len(fi)))).astype(np.int64)
    sel_loc = lj <= J_ON
    for code, i0 in [('AW26', 52 + 30), ('AW25', 30)]:                                              # season opening stock at the W31 week-end
        for q_, c in enumerate(np.nonzero(SEASONAL)[0]):
            msk = sel_loc & (li == i0) & (lc == c)
            ohu[msk] = alloc(np.zeros(msk.sum(), int), fi.oh.values[msk].astype(float) + 1, np.array([SEASON[code]['O'][q_]]))
    fi['ohu'] = ohu

    # receipts into selling locations (stores, ONLINE)
    rc = fs[sell][['i', 'j', 'c', 'units']].copy()
    ru = np.rint(rc.units.values * np.exp(rng.normal(0, .08, len(rc)))).astype(np.int64)
    rprof = np.array([.14, .13, .12, .11, .10, .09, .08, .07, .06, .045, .0315, .0235])
    for code, fy in [('AW26', 2026), ('AW25', 2025)]:
        for q_, c in enumerate(np.nonzero(SEASONAL)[0]):
            msk = (rc.c.values == c) & (FYA[rc.i.values] == fy) & (SWK[rc.i.values] >= 1) & (SWK[rc.i.values] <= 12)
            wk_ = SWK[rc.i.values[msk]] - 1
            ru[msk] = alloc(np.zeros(msk.sum(), int), rprof[wk_] * (rc.units.values[msk] + 1), np.array([SEASON[code]['R'][q_]]))
        late = SEASONAL[rc.c.values] & (FYA[rc.i.values] == 2025) & (SWK[rc.i.values] >= 13)
        ru[late] = np.rint(ru[late] * .5)
    rc['receipt_units'] = ru

    # ---- availability (stores; top-500 sellers, sales-weighted SKU-days) ------------------------------------------------------
    avr = np.r_[.971 + rng.normal(0, .0015, 52), .969 + rng.normal(0, .0015, 30), np.array(PTS['av']) / 100]
    ai, aj = np.nonzero(OPEN[:, :NACT].T); o_ = np.lexsort((aj, ai)); ai, aj = ai[o_], aj[o_]
    fa = pd.DataFrame(dict(i=np.repeat(ai, NC), j=np.repeat(aj, NC), c=np.tile(np.arange(NC), len(ai))))
    fa['ranged'] = CA['top'][fa.c.values] * 7
    rg_w = np.bincount(fa.i.values, fa.ranged.values.astype(float), minlength=NACT)
    short = np.rint(rg_w * (1 - avr) * 10).astype(np.int64); short[CUR] = (A['ranged43'] - A['instock43']) * 10
    assert rg_w[CUR] == A['ranged43']
    swt = fa.ranged.values * np.where(fa.c.values == 0, 2.2, 1.0) * np.exp(rng.normal(0, .25, len(fa)))
    swt *= np.where((fa.i.values == CUR) & (st.country.values[fa.j.values] == 'NL'), 1.3, 1.0)        # DC Tilburg WMS outage, Week 43
    sh = alloc(fa.i.values, swt, short)
    assert (sh <= fa.ranged.values * 10).all()
    fa['in_stock'] = (fa.ranged.values * 10 - sh) / 10

    # ---- suppliers, supplier income, PO lines ----------------------------------------------------------------------------------
    ns_by_cat = [140, 220, 130, 80, 90, 150, 130, 70, 90]
    sup = []
    syl = ['ber', 'van', 'tor', 'lin', 'mar', 'del', 'kro', 'fen', 'sal', 'dor', 'vel', 'ham', 'ost', 'rin', 'bel', 'nor', 'gal', 'tre', 'mon', 'ste']
    suf = {'NL': 'B.V.', 'BE': 'NV', 'DE': 'GmbH', 'FR': 'SA', 'IT': 'SpA', 'ES': 'SL', 'PL': 'Sp. z o.o.', 'CN': 'Ltd', 'GB': 'Ltd', 'DK': 'A/S'}
    ctry = np.array(list(suf)); cp = np.array([.30, .20, .15, .07, .05, .04, .04, .09, .04, .02])
    for c, n in enumerate(ns_by_cat):
        vol = (np.arange(1, n + 1) ** -1.0) * np.exp(rng.normal(0, .3, n)); vol = vol / vol.sum() * (CA['st'][c] * (1 - CA['fgm'][c]))
        cc = rng.choice(ctry, n, p=cp)
        sch = np.where(np.arange(n) < n * .15, rng.choice(['VOLUME', 'GROWTH', 'PROMO'], n, p=[.5, .25, .25]),
                       rng.choice(['VOLUME', 'GROWTH', 'PROMO', 'NONE'], n, p=[.33, .14, .15, .38]))
        for k in range(n):
            nm = (syl[rng.integers(20)] + syl[rng.integers(20)] + syl[rng.integers(20)]).capitalize()
            sup.append((c, nm, cc[k], sch[k], vol[k]))
    sp = pd.DataFrame(sup, columns=['c', 'name', 'country', 'scheme', 'vol'])
    sp['supplier_code'] = [f'SUP{k + 1:04d}' for k in range(len(sp))]
    seen, nm_ = set(), []
    for k, (n, c) in enumerate(zip(sp.name, sp.country)):
        nm_.append(f'{n} {suf[c]}' if n not in seen else f'{n} {k + 1} {suf[c]}'); seen.add(n)
    sp['supplier_name'] = nm_
    in_grp = rng.random(len(sp)) < .25; gno = rng.integers(1, 31, len(sp))
    sp['supplier_group'] = [f'Group {g:02d}' if f else n for f, g, n in zip(in_grp, gno, sp.supplier_name)]
    story_sup = np.nonzero(sp.c.values == 4)[0][[2, 4]]                                              # two Electronics suppliers below 85 % OTIF
    # supplier income: per week x category back margin -> suppliers with a scheme
    sch = sp[sp.scheme != 'NONE'].reset_index()
    si_i = np.repeat(np.arange(NACT), len(sch)); si_s = np.tile(np.arange(len(sch)), NACT)
    si_c = sch.c.values[si_s]
    si_amt = alloc(si_i * NC + si_c, sch.vol.values[si_s] * np.exp(rng.normal(0, .15, len(si_i))), BACK_IC)
    comp = {'VOLUME': (.75, .15), 'GROWTH': (.65, .25), 'PROMO': (.30, .62)}
    r1 = np.array([comp[s][0] for s in sch.scheme.values])[si_s] * np.exp(rng.normal(0, .05, len(si_i)))
    r2 = np.array([comp[s][1] for s in sch.scheme.values])[si_s] * np.exp(rng.normal(0, .05, len(si_i)))
    sc_ = np.minimum(1, .97 / (r1 + r2)); assert (si_amt >= 0).all()
    reb = np.floor(si_amt * r1 * sc_).astype(np.int64); pro = np.floor(si_amt * r2 * sc_).astype(np.int64); lis = si_amt - reb - pro
    assert (lis >= 0).all()
    fsi = pd.DataFrame(dict(i=si_i, s=sch['index'].values[si_s], reb=reb, pro=pro, lis=lis))
    fsi = fsi[si_amt != 0]
    # PO lines due and OTIF
    due_t = np.rint(4800 * pseason(WKA[:NACT]) ** .5 / .98 * np.exp(rng.normal(0, .02, NACT))).astype(np.int64)
    otr = np.r_[.945 + rng.normal(0, .004, 52), .948 + rng.normal(0, .004, 30), np.array(PTS['ot']) / 100]
    due_t[CUR] = A['due43']; due_t[93] = 4706
    ok_t = np.rint(due_t * otr).astype(np.int64); ok_t[CUR] = A['otif43']
    pvol = sp.vol.values ** .8; pvol[story_sup] = 0; pvol = pvol / pvol.sum()
    po = []
    for i in range(NACT):
        due = np.zeros(len(sp), np.int64)
        story = i >= 52 + 35                                                                             # from FY2026 W36
        sdue = np.array([58, 47]) + rng.integers(-4, 5, 2)
        due[story_sup] = sdue
        due += rng.multinomial(due_t[i] - sdue.sum(), pvol)
        fail = due_t[i] - ok_t[i]; f = np.zeros(len(sp), np.int64)
        if story:
            f[story_sup] = np.rint(sdue * np.array([.21, .17]) * np.exp(rng.normal(0, .05, 2))).astype(np.int64); fail -= f.sum()
        cap = due - np.ceil(.85 * due - 1e-9).astype(np.int64); cap[story_sup] = f[story_sup] if story else cap[story_sup]
        while fail > 0:
            pr = cap - f; pr = np.clip(pr, 0, None).astype(float); assert pr.sum() > 0
            add = rng.multinomial(fail, pr / pr.sum()); add = np.minimum(add, cap - f); f += add; fail -= add.sum()
        keep = due > 0
        po.append(pd.DataFrame(dict(i=i, s=np.nonzero(keep)[0], due=due[keep], ok=(due - f)[keep])))
    fpo = pd.concat(po, ignore_index=True)
    w43 = fpo[fpo.i == CUR]; below = w43[w43.ok / w43.due < .85].s.values
    assert sorted(below) == sorted(story_sup), below

    # ---- assemble tables ------------------------------------------------------------------------------------------------
    scode = np.r_[st.store_code.values, ['ONLINE', 'WHOLESALE', 'DC_TIL', 'DC_WIL']]
    def money(x): return np.asarray(x, np.int64) / 100
    dim_week = pd.DataFrame(dict(
        week_key=KEY, fy=FYA.astype(np.int32), week_of_fy=WKA.astype(np.int32), quarter=((WKA - 1) // 13 + 1).astype(np.int32),
        period=PER.astype(np.int32), period_key=[f'FY{a}-P{p:02d}' for a, p in zip(FYA, PER)], week_of_period=WOP.astype(np.int32),
        weeks_in_period=WIP.astype(np.int32), week_start=WS, week_end=WE, period_start=PS, period_end=PE,
        ly_week_key=[KEY[i - 52] if i >= 52 else None for i in WI], lw_week_key=[KEY[i - 1] if i >= 1 else None for i in WI],
        is_actual=WI <= CUR, season_code=SEAS, season_week=pd.array(np.where(SWK > 0, SWK, None), dtype='Int32'),
        week_label=[f'Week {w}' for w in WKA], sort_index=(WI + 1).astype(np.int32)))
    days = np.datetime64(FY0, 'D') + np.arange(NWK * 7).astype('timedelta64[D]'); dts = pd.DatetimeIndex(days)
    dim_date = pd.DataFrame(dict(date=days, week_key=np.repeat(KEY, 7), fy=np.repeat(FYA, 7).astype(np.int32),
                                 period=np.repeat(PER, 7).astype(np.int32), week_of_fy=np.repeat(WKA, 7).astype(np.int32),
                                 day_of_week=(dts.dayofweek + 1).astype(np.int32), day_name=dts.strftime('%a'),
                                 is_trading_day=~(((dts.month == 12) & (dts.day == 25)) | ((dts.month == 1) & (dts.day == 1))),
                                 is_actual=days <= np.datetime64(AS_OF)))
    nonst = pd.DataFrame(dict(store_code=['ONLINE', 'WHOLESALE', 'DC_TIL', 'DC_WIL'],
                              store_name=['Nordmark online', 'Nordmark wholesale', 'DC Tilburg', 'DC Willebroek'],
                              channel_code=['ONLINE', 'WHOLESALE', 'DC', 'DC'], format=['online', 'wholesale', 'dc', 'dc'],
                              country=['NL', 'NL', 'NL', 'BE'], region=[None, None, 'South', 'Flanders'], scope_code=['ONLINE', None, None, None],
                              cluster=[None] * 4, sales_area_sqm=pd.array([None] * 4, dtype='Int64'),
                              open_date=np.array(['2016-03-07', '2009-01-05', '2012-05-07', '2014-09-01'], 'datetime64[D]'),
                              close_date=np.full(4, np.datetime64('NaT', 'D')), refit_date=np.full(4, np.datetime64('NaT', 'D'))))
    dim_store = pd.concat([pd.DataFrame(dict(store_code=st.store_code, store_name=st.store_name, channel_code='STORE', format=st.format, country=st.country,
                                             region=st.region, scope_code=st.country, cluster=st.cluster,
                                             sales_area_sqm=pd.array(st.sales_area_sqm.values, dtype='Int64'),
                                             open_date=od, close_date=cd, refit_date=rd)), nonst], ignore_index=True)
    dim_store['sort_order'] = np.arange(1, len(dim_store) + 1, dtype=np.int32)
    dim_category = pd.DataFrame(dict(category_code=CC, category_name=CA['name'], division=CA['div'], is_seasonal=SEASONAL,
                                     cover_target_wks=CA['cover'].astype(float), gmroi_target=CA['gmroi'].astype(float),
                                     sellthrough_target=np.where(SEASONAL, .62, np.nan), top500_skus=CA['top'].astype(np.int32),
                                     sort_order=np.arange(1, NC + 1, dtype=np.int32)))
    dim_supplier = pd.DataFrame(dict(supplier_code=sp.supplier_code, supplier_name=sp.supplier_name, supplier_group=sp.supplier_group,
                                     country=sp.country, primary_category_code=CC[sp.c.values], rebate_scheme=sp.scheme))
    dim_cost_type = pd.DataFrame(dict(cost_type_code=CT, cost_type_name=['Shrink', 'Store operating cost', 'Central operating cost', 'Fulfilment'],
                                      site_level=['store', 'store', 'central (no site)', 'online + wholesale'], sort_order=np.arange(1, 5, dtype=np.int32)))
    dim_kpi = kpi_table()
    fact_sales_week = pd.DataFrame(dict(week_key=KEY[fs.i], store_code=scode[fs.j], category_code=CC[fs.c], gross_sales=money(fs.gross),
                                        markdown_value=money(fs.md), returns=money(fs.ret), net_sales=money(fs.net), units=fs.units.values,
                                        cogs_landed=money(fs.cogs), back_margin_alloc=money(fs.back), transactions=fs.transactions.values,
                                        is_lfl=fs.lfl.values, is_lfl_as_ly=fs.lfl_ny.values))
    fact_budget_week = pd.DataFrame(dict(week_key=KEY[fb.b + 52], store_code=scode[fb.j], category_code=CC[fb.c], net_sales_bud=money(fb.net),
                                         gross_sales_bud=money(fb.gross), markdown_bud=money(fb.md), cogs_bud=money(fb.cogs),
                                         back_margin_bud=money(fb.back), is_lfl=fb.lfl.values))
    fact_supplier_income_week = pd.DataFrame(dict(week_key=KEY[fsi.i], supplier_code=sp.supplier_code.values[fsi.s], rebate_accrual=money(fsi.reb),
                                                  promo_funding=money(fsi.pro), listing_fees=money(fsi.lis),
                                                  is_provisional=fsi.i.values >= 91))
    fi = fi.sort_values(['i', 'j', 'c'], kind='stable').reset_index(drop=True)
    fact_inventory_week = pd.DataFrame(dict(week_key=KEY[fi.i], store_code=scode[fi.j], category_code=CC[fi.c], on_hand_units=fi.ohu.values,
                                            on_hand_cost=money(fi.oh), on_order_cost=money(fi.oo), in_transit_cost=money(fi.transit),
                                            aged_90_cost=money(fi.aged)))
    fact_forecast_week = pd.DataFrame(dict(week_key=KEY[fs_f.i], store_code=scode[fs_f.j], category_code=CC[fs_f.c], forecast_cogs=money(fs_f.f)))
    fact_availability_week = pd.DataFrame(dict(week_key=KEY[fa.i], store_code=scode[fa.j], category_code=CC[fa.c],
                                               ranged_sku_days=fa.ranged.values.astype(float), in_stock_sku_days=fa.in_stock.values))
    fact_receipts_week = pd.DataFrame(dict(week_key=KEY[rc.i], store_code=scode[rc.j], category_code=CC[rc.c], receipt_units=rc.receipt_units.values))
    fact_po_week = pd.DataFrame(dict(week_key=KEY[fpo.i], supplier_code=sp.supplier_code.values[fpo.s], po_lines_due=fpo.due.values.astype(np.int32),
                                     po_lines_otif=fpo.ok.values.astype(np.int32)))
    orows = []
    for scen, i, c, js, amt in ox:
        orows.append(pd.DataFrame(dict(week_key=KEY[i], scenario_code=scen, cost_type_code=CT[c],
                                       store_code=[None] if js[0] == -1 else scode[js], amount=money(amt))))
    fact_opex_week = pd.concat(orows, ignore_index=True)
    fact_opex_week = fact_opex_week.sort_values(['scenario_code', 'week_key', 'cost_type_code', 'store_code'], kind='stable', na_position='first').reset_index(drop=True)
    param_status_rule, param_target = params(dim_category)

    T = dict(dim_week=dim_week, dim_date=dim_date, dim_store=dim_store, dim_category=dim_category, dim_supplier=dim_supplier,
             dim_cost_type=dim_cost_type, dim_kpi=dim_kpi, fact_sales_week=fact_sales_week, fact_budget_week=fact_budget_week,
             fact_supplier_income_week=fact_supplier_income_week, fact_inventory_week=fact_inventory_week, fact_forecast_week=fact_forecast_week,
             fact_availability_week=fact_availability_week, fact_receipts_week=fact_receipts_week, fact_po_week=fact_po_week,
             fact_opex_week=fact_opex_week, param_status_rule=param_status_rule, param_target=param_target)
    man = [write(out, n, df) for n, df in T.items()]
    ct = control_totals(T); ct.to_csv(out / 'checks' / 'control_totals_eur.csv', index=False, lineterminator='\n')
    story_check(ct)
    cc = control_totals(T, CAT_CELLS); cc.to_csv(out / 'checks' / 'control_totals_category_eur.csv', index=False, lineterminator='\n')
    print(f'category control totals: {len(cc):,} rows, {cc.groupby(["scope", "period_key"]).ngroups} cells')
    (out / 'parquet' / 'manifest.json').write_text(json.dumps(dict(
        dataset='nordmark_retail_dummy_data', seed=SEED, as_of=AS_OF, current_week_key=KEY[CUR], refreshed=REFRESHED,
        calendar=dict(rule='4-5-4; FY = 52 Mon-Sun weeks starting on the Monday of the week that contains 1 January', fy2025_start=str(WS[0]),
                      fy2026_start=str(WS[52]), fy2026_end=str(WE[103]), actual_weeks=f'{KEY[0]} .. {KEY[CUR]}'),
        currency='EUR', tables=man), indent=1) + '\n')
    tot = 0
    for m_ in man: tot += m_['parquet_bytes']; print(f"{m_['table']:<28}{m_['rows']:>9,} rows  {m_['parquet_bytes'] / 1e6:6.2f} MB")
    print(f"{'total':<28}{sum(m_['rows'] for m_ in man):>9,} rows  {tot / 1e6:6.2f} MB")
    print('GMROI by category (R52W at W43):', {CC[c]: round(gtar[c], 2) for c in range(NC)}, f' runtime {time.time() - t0:.1f} s')


# ---- metadata tables ------------------------------------------------------------------------------------------------------
LANDING = [  # kpi_code, catalogue no, title, size, card order, group, lever, horizon, owner, statement, drill, provisional, direction, unit, period basis, value metric, basis metric, basis
    ('NET_SALES', 1, 'Net sales', 'hero', 1, 'B1', 'sales', 'week', 'commercial', 'pl', 'Sales', False, 'UP', 'EUR', 'FLOW', 'net_sales', 'net_sales_bud', 'BUDGET'),
    ('TOTAL_MARGIN', 9, 'Total margin', 'hero', 2, 'B1', 'margin', 'month', 'finance', 'pl', 'Margin', True, 'UP', 'PCT', 'FLOW', 'total_margin_pct', 'total_margin_pct_bud', 'BUDGET'),
    ('WEEKS_OF_COVER', 14, 'Weeks of cover', 'hero', 3, 'B1', 'stock', 'week', 'supply', 'bs', 'Inventory', False, 'BAND', 'WKS', 'POINT_IN_TIME', 'weeks_of_cover', 'cover_target_wks', 'TARGET'),
    ('MARKDOWN', 10, 'Markdown', 'medium', 4, 'B2', 'margin', 'week', 'commercial', 'pl', 'Margin', False, 'DOWN', 'PCT', 'FLOW', 'markdown_pct', 'markdown_pct_bud', 'BUDGET'),
    ('AVAILABILITY', 17, 'Availability', 'medium', 5, 'B3', 'supply', 'week', 'supply', 'ops', 'Inventory', False, 'UP', 'PCT', 'POINT_IN_TIME', 'availability_pct', 'availability_target', 'TARGET'),
    ('EBITDA', 25, 'EBITDA flash', 'medium', 6, 'B2', 'margin', 'month', 'finance', 'pl', 'Margin', True, 'UP', 'EUR', 'PERIOD_TO_DATE', 'ebitda', 'ebitda_bud', 'BUDGET'),
    ('LFL_GROWTH', 2, 'Like-for-like growth', 'small', 7, 'B4', 'sales', 'week', 'commercial', 'pl', 'Sales', False, 'UP', 'PCT', 'FLOW', 'lfl_growth_pct', 'lfl_growth_pct_bud', 'BUDGET'),
    ('FRONT_GM', 8, 'Front gross margin', 'small', 8, 'B2', 'margin', 'week', 'finance', 'pl', 'Margin', False, 'UP', 'PCT', 'FLOW', 'front_gm_pct', 'front_gm_pct_bud', 'BUDGET'),
    ('SELL_THROUGH', 15, 'Sell-through', 'small', 9, 'B3', 'stock', 'quarter', 'commercial', 'ops', 'Inventory', False, 'UP', 'PCT', 'SEASON_TO_DATE', 'sell_through_pct', 'sell_through_target', 'TARGET'),
    ('GMROI', 16, 'GMROI', 'small', 10, 'B3', 'cash', 'quarter', 'finance', 'bs', 'Inventory', False, 'UP', 'X', 'R52W', 'gmroi', 'gmroi_target', 'TARGET'),
    ('SUPPLIER_OTIF', 20, 'Supplier OTIF', 'small', 11, 'B3', 'supply', 'week', 'supply', 'ops', 'Supplier', False, 'UP', 'PCT', 'FLOW', 'otif_pct', 'otif_target', 'TARGET'),
    ('CHANNEL_MIX', 5, 'Channel mix', 'small', 12, 'B4', 'sales', 'month', 'digital', 'pl', 'Channel', False, 'BAND', 'MIX', 'POINT_IN_TIME', 'mix_store_pct', 'mix_store_pct_bud', 'PLAN')]
BENCH = [  # kpi_code, catalogue no, name, domain (v5 drawer), formula, owner initials, cadence, direction
    ('SALES_PACE', 3, 'Sales pace vs budget %', 'Sales', 'Net sales to date ÷ (budget × elapsed trading-day share)', 'CM', 'daily', 'UP'),
    ('UNITS_ASP', 4, 'Units & average selling price', 'Sales', 'Σ units; Net sales ÷ units', 'CM', 'daily', 'UP'),
    ('ONLINE_CONVERSION', 6, 'Online conversion % & AOV', 'Sales', 'Orders ÷ sessions; Net sales ÷ orders', 'EC', 'daily', 'UP'),
    ('TRAFFIC_BASKET', 7, 'Store traffic & basket', 'Sales', 'Footfall; items ÷ transactions; Net sales ÷ transactions', 'RO', 'daily', 'UP'),
    ('PROMO_SHARE', 11, 'Promo share % & uplift', 'Margin', 'Promo sales ÷ Net sales; promo units ÷ baseline − 1', 'CM', 'weekly', 'CONTEXT'),
    ('SHRINK', 12, 'Shrink %', 'Margin', '(Book stock − counted stock) at cost ÷ Net sales', 'RO', 'monthly', 'DOWN'),
    ('CATEGORY_MARGIN_MIX', 13, 'Category margin mix', 'Margin', 'Margin % by category vs plan; contribution to total margin', 'CM', 'weekly', 'UP'),
    ('AGED_STOCK', 18, 'Aged / excess stock %', 'Inventory', 'Stock at cost older than 90 days or > 26 wks cover ÷ total', 'SC', 'weekly', 'DOWN'),
    ('INVENTORY_TURNS', 19, 'Inventory turns', 'Inventory', 'R12M COGS ÷ average inventory at cost', 'SC', 'monthly', 'UP'),
    ('TOP10_CONCENTRATION', 21, 'Top-10 supplier concentration %', 'Supplier', 'Top-10 suppliers’ COGS ÷ total COGS', 'CM', 'monthly', 'DOWN'),
    ('PURCHASE_PRICE_VARIANCE', 22, 'Purchase price variance %', 'Supplier', '(Actual landed − standard) ÷ standard × units', 'CF', 'weekly', 'DOWN'),
    ('STORE_OPEX_PCT', 23, 'Store operating cost % of sales', 'Cost', 'Store OpEx ÷ Net sales', 'RO', 'monthly', 'DOWN'),
    ('COST_TO_SERVE_ONLINE', 24, 'Cost to serve online per order', 'Cost', 'Fulfilment + delivery + returns ÷ orders', 'EC', 'weekly', 'DOWN'),
    ('CASH_CONVERSION_CYCLE', 26, 'Cash conversion cycle (days)', 'Cash', 'DIO + DSO (wholesale) − DPO', 'CF', 'monthly', 'DOWN'),
    ('CASH_HEADROOM', 27, 'Cash balance & headroom', 'Cash', 'Period-end balances vs covenant / policy', 'CF', 'weekly', 'UP'),
    ('RETURNS_RATE_ONLINE', 28, 'Returns rate % (online)', 'Customer', 'Returned units ÷ sold units, lagged 30 days', 'EC', 'weekly', 'DOWN'),
    ('LOYALTY_ACTIVE', 29, 'Active loyalty customers & repeat rate', 'Customer', 'Members with ≥ 1 purchase R12M; ≥ 2 purchases ÷ active', 'MK', 'monthly', 'UP'),
    ('NPS', 30, 'NPS / review score', 'Customer', 'Survey or review-platform export, latest wave', 'MK', 'monthly', 'UP'),
    ('PAYROLL_HOURS', 31, 'Store payroll hours vs plan & sales per labour hour', 'People & risk', 'Hours worked ÷ planned; Net sales ÷ hours', 'RO', 'weekly', 'CONTEXT'),
    ('DATA_QUALITY', 32, 'Data-quality score', 'People & risk', '% sources refreshed on schedule and reconciled', 'BI', 'daily', 'UP')]
CADENCE = {'NET_SALES': 'daily', 'TOTAL_MARGIN': 'weekly', 'WEEKS_OF_COVER': 'daily', 'MARKDOWN': 'daily', 'AVAILABILITY': 'daily', 'EBITDA': 'weekly',
           'LFL_GROWTH': 'daily', 'FRONT_GM': 'daily', 'SELL_THROUGH': 'weekly', 'GMROI': 'weekly', 'SUPPLIER_OTIF': 'daily', 'CHANNEL_MIX': 'daily'}
OWNER = {'CM': 'commercial', 'RO': 'commercial', 'CE': 'commercial', 'SC': 'supply', 'CF': 'finance', 'EC': 'digital', 'MK': 'digital', 'BI': 'finance'}
DOMAIN = {'NET_SALES': 'Sales', 'LFL_GROWTH': 'Sales', 'CHANNEL_MIX': 'Sales', 'FRONT_GM': 'Margin', 'TOTAL_MARGIN': 'Margin', 'MARKDOWN': 'Margin',
          'WEEKS_OF_COVER': 'Inventory', 'SELL_THROUGH': 'Inventory', 'GMROI': 'Inventory', 'AVAILABILITY': 'Inventory', 'SUPPLIER_OTIF': 'Supplier', 'EBITDA': 'Profit'}
DRILL = {'Sales': 'Sales', 'Margin': 'Margin', 'Inventory': 'Inventory', 'Supplier': 'Supplier', 'Cost': 'Margin', 'Cash': 'Margin', 'Customer': 'Channel', 'People & risk': 'Sales'}


def kpi_table():
    rows = []
    for (k, no, title, size, order, g, lev, hor, own, stm, drill, prov, dirn, unit, basis_p, vm, bm, basis) in LANDING:
        rows.append(dict(kpi_code=k, catalogue_no=no, kpi_name=title, domain=DOMAIN[k], is_landing=True, size=size, card_order=order,
                         group=g, lever=lev, horizon=hor, owner=own, statement=stm, drill_page=drill, is_provisional=prov,
                         is_stock=k in ('WEEKS_OF_COVER', 'SELL_THROUGH', 'GMROI', 'AVAILABILITY'), direction=dirn, unit=unit,
                         period_basis=basis_p, basis=basis, value_metric=vm, basis_metric=bm, status_metric=f'status.{k.lower()}',
                         formula=None, owner_initials=None, cadence=CADENCE[k]))
    for (k, no, name, dom, f, ini, cad, dirn) in BENCH:
        rows.append(dict(kpi_code=k, catalogue_no=no, kpi_name=name, domain=dom, is_landing=False, size=None, card_order=None,
                         group=None, lever=None, horizon=None, owner=OWNER[ini], statement=None, drill_page=DRILL[dom], is_provisional=k == 'SHRINK',
                         is_stock=k in ('AGED_STOCK', 'INVENTORY_TURNS'), direction=dirn, unit=None, period_basis=None, basis=None,
                         value_metric=None, basis_metric=None, status_metric=None, formula=f, owner_initials=ini, cadence=cad))
    d = pd.DataFrame(rows).sort_values('catalogue_no', kind='stable').reset_index(drop=True)
    d['catalogue_no'] = d.catalogue_no.astype(np.int32); d['card_order'] = pd.array(d.card_order, dtype='Int32')
    return d


def params(dim_category):
    r = [  # rule_code, kpi_code, basis, direction, unit, watch_from, off_from, threshold  (badness b: Watch if b > watch_from, Off if b > off_from)
        ('NET_SALES', 'NET_SALES', 'BUDGET', 'UP', 'pct_of_basis', 0.0, .03, None),
        ('TOTAL_MARGIN', 'TOTAL_MARGIN', 'BUDGET', 'UP', 'pp', 0.0, .01, None),
        ('WEEKS_OF_COVER', 'WEEKS_OF_COVER', 'TARGET', 'BAND', 'wks', 1.0, 2.0, None),
        ('MARKDOWN', 'MARKDOWN', 'BUDGET', 'DOWN', 'pp', 0.0, .01, None),
        ('AVAILABILITY', 'AVAILABILITY', 'TARGET', 'UP', 'pp', 0.0, .02, None),
        ('EBITDA', 'EBITDA', 'BUDGET', 'UP', 'pct_of_basis', 0.0, .05, None),
        ('LFL_GROWTH', 'LFL_GROWTH', 'BUDGET', 'UP', 'pp', 0.0, .02, None),
        ('FRONT_GM', 'FRONT_GM', 'BUDGET', 'UP', 'pp', 0.0, .01, None),
        ('SELL_THROUGH', 'SELL_THROUGH', 'TARGET', 'UP', 'pp', 0.0, .05, None),
        ('GMROI', 'GMROI', 'TARGET', 'UP', 'x', 0.0, .5, None),
        ('SUPPLIER_OTIF', 'SUPPLIER_OTIF', 'TARGET', 'UP', 'pp', 0.0, .03, None),
        ('CHANNEL_MIX', 'CHANNEL_MIX', 'PLAN', 'BAND', 'pp', .02, .03, None),
        ('DOT_RED_OFF', None, None, None, 'share', None, None, 1 / 3),
        ('DOT_ORANGE_WATCH_OFF', None, None, None, 'share', None, None, .5),
        ('DOT_GREEN_GOOD', None, None, None, 'share', None, None, 2 / 3)]
    psr = pd.DataFrame(r, columns=['rule_code', 'kpi_code', 'basis', 'direction', 'unit', 'watch_from', 'off_from', 'threshold'])
    for k in ['watch_from', 'off_from', 'threshold']: psr[k] = psr[k].astype(float)
    psr['sort_order'] = np.arange(1, len(psr) + 1, dtype=np.int32)
    t = [('AVAILABILITY', 'ALL', .97), ('SUPPLIER_OTIF', 'ALL', .95), ('GMROI', 'ALL', 2.5), ('WEEKS_OF_COVER', 'ALL', 9.5), ('SELL_THROUGH', 'ALL', .62)]
    t += [('GMROI', c, g) for c, g in zip(dim_category.category_code, dim_category.gmroi_target)]
    t += [('WEEKS_OF_COVER', c, w) for c, w in zip(dim_category.category_code, dim_category.cover_target_wks)]
    t += [('SELL_THROUGH', c, s) for c, s in zip(dim_category.category_code, dim_category.sellthrough_target) if s == s]
    return psr, pd.DataFrame(t, columns=['kpi_code', 'category_code', 'target_value'])


# ---- writing ----------------------------------------------------------------------------------------------------------------
def write(out, name, df):
    t = pa.Table.from_pandas(df.reset_index(drop=True), preserve_index=False)
    cols = []
    for f in t.schema:
        col = t[f.name]
        if f.name == 'date' or f.name.endswith(('_date', '_start', '_end')): col = col.cast(pa.date32())
        elif pa.types.is_null(f.type): col = col.cast(pa.string())
        cols.append(col)
    t = pa.table(cols, names=t.schema.names).replace_schema_metadata(None)
    p = out / 'parquet' / f'{name}.parquet'
    pq.write_table(t, p, compression='snappy')
    return dict(table=name, rows=t.num_rows, parquet_bytes=p.stat().st_size, columns={f.name: str(f.type) for f in t.schema})


# ---- control totals (E-76): scope x period x metric, computed from the tables as written ---------------------------------------
SCOPES = ['ALL', 'NL', 'BE', 'ONLINE']
# Category scopes (E-104, docs/ADD/features/exec-category-filter.md §6): scope = {region}#{code}[+{code}...], codes in dim_category.sort_order
CAT_PICKS = ['FRESH', 'AMBIENT', 'HB', 'HOUSEHOLD', 'ELEC', 'APPAREL', 'HOME', 'GARDEN', 'TOYS', 'ELEC+TOYS', 'FRESH+AMBIENT+HB', 'APPAREL+HOME+GARDEN+TOYS']
K12 = [('W', 2026, 43, None), ('W', 2025, 43, None), ('W', 2026, 42, None), ('P', 2026, 10, None), ('P', 2025, 10, None), ('P', 2026, 9, None),
       ('Q', 2026, 4, None), ('Q', 2025, 4, 4), ('Q', 2026, 3, 4), ('FY', 2026, None, None), ('FY', 2025, None, 43), ('FY', 2025, None, None)]
CAT_CELLS = [([f'ALL#{p}' for p in CAT_PICKS], K12),                                                   # Block A: every pick at ALL x K12
             ([f'{r}#{p}' for r in ('NL', 'BE', 'ONLINE') for p in ('ELEC', 'ELEC+TOYS')], K12[:6])]  # Block B: region x pick x K6 (W and P keys)
assert all(sorted(p.split('+'), key=list(CC).index) == p.split('+') for p in CAT_PICKS)

def control_totals(T, cells=None):
    """cells = None: the scope x period-key file (E-76). cells = [(scope labels, keys), ...]: the category file (E-104); under a pick
    EBITDA and Supplier OTIF have no rows (their facts carry no category key), sell-through runs on the pick's seasonal part."""
    wk = T['dim_week'].reset_index(drop=True); key2i = {k: i for i, k in enumerate(wk.week_key)}
    st = T['dim_store'].set_index('store_code'); cat = T['dim_category'].set_index('category_code')
    seasonal = set(cat.index[cat.is_seasonal])
    def W(df): return df.week_key.map(key2i).values
    def sc(df, s):
        if s == 'ALL': return np.ones(len(df), bool)
        return df.store_code.map(st.scope_code).eq(s).values
    def agg(df, cols, mask, n=NWK):
        x = df[mask]; i = W(x); return {c: np.bincount(i, x[c].values.astype(float), minlength=n) for c in cols}
    fs, fb = T['fact_sales_week'], T['fact_budget_week']
    ch_s = fs.store_code.map(st.channel_code).values; ch_b = fb.store_code.map(st.channel_code).values
    seas_s = fs.category_code.isin(seasonal).values
    fi, ff, fa, fr, fo = T['fact_inventory_week'], T['fact_forecast_week'], T['fact_availability_week'], T['fact_receipts_week'], T['fact_opex_week']
    seas_i = fi.category_code.isin(seasonal).values; ch_i = fi.store_code.map(st.channel_code).values
    po = agg(T['fact_po_week'], ['po_lines_due', 'po_lines_otif'], np.ones(len(T['fact_po_week']), bool))
    ctgt = cat.cover_target_wks
    def build(s, cats=None):
        """Weekly cubes of one scope; cats = a category pick: every category-keyed fact is masked to it (opex and PO lines are not)."""
        k = (lambda df: np.ones(len(df), bool)) if cats is None else (lambda df: df.category_code.isin(cats).values)
        m = sc(fs, s) & k(fs); g = agg(fs, ['gross_sales', 'markdown_value', 'returns', 'net_sales', 'cogs_landed', 'back_margin_alloc'], m)
        g['lfl'] = agg(fs, ['net_sales'], m & fs.is_lfl.values)['net_sales']; g['lfl_as_ly'] = agg(fs, ['net_sales'], m & fs.is_lfl_as_ly.values)['net_sales']
        g['lfl_n'] = np.bincount(W(fs[m & fs.is_lfl.values].drop_duplicates(['week_key', 'store_code'])), minlength=NWK).astype(float)
        for chn in ['STORE', 'ONLINE', 'WHOLESALE']:
            g[f'ch_{chn}'] = agg(fs, ['net_sales'], m & (ch_s == chn))['net_sales']; g[f'chb_{chn}'] = agg(fb, ['net_sales_bud'], sc(fb, s) & k(fb) & (ch_b == chn))['net_sales_bud']
        g['sold'] = agg(fs, ['units'], m & seas_s & np.isin(ch_s, ['STORE', 'ONLINE']))['units']
        g.update(agg(fb, ['net_sales_bud', 'gross_sales_bud', 'markdown_bud', 'cogs_bud', 'back_margin_bud'], sc(fb, s) & k(fb)))
        g['lfl_bud'] = agg(fb, ['net_sales_bud'], sc(fb, s) & k(fb) & fb.is_lfl.values)['net_sales_bud']
        mi = sc(fi, s) & k(fi); g.update(agg(fi, ['on_hand_cost', 'on_order_cost'], mi))
        g['open_u'] = agg(fi, ['on_hand_units'], mi & seas_i & np.isin(ch_i, ['STORE', 'ONLINE']))['on_hand_units']
        mf = sc(ff, s) & k(ff); g['f'] = agg(ff, ['forecast_cogs'], mf)['forecast_cogs']
        g['ft'] = agg(ff.assign(x=ff.forecast_cogs * ff.category_code.map(ctgt)), ['x'], mf)['x']
        g.update(agg(fa, ['ranged_sku_days', 'in_stock_sku_days'], sc(fa, s) & k(fa)))
        g['rcv'] = agg(fr, ['receipt_units'], sc(fr, s) & k(fr) & fr.category_code.isin(seasonal).values)['receipt_units']
        for scen in ['ACT', 'BUD']:
            for c in ['SHRINK', 'STORE_OPEX', 'CENTRAL_OPEX', 'FULFILMENT']:
                mo = (fo.scenario_code.values == scen) & (fo.cost_type_code.values == c) & (sc(fo, s) if s != 'ALL' else True)
                g[f'{scen}_{c}'] = agg(fo, ['amount'], mo)['amount']
        g.update(po)
        if cats is not None: g['oh_c'] = {c: agg(fi, ['on_hand_cost'], mi & (fi.category_code.values == c))['on_hand_cost'] for c in cats}   # GMROI target weights (E-102)
        return g
    if cells is None: G = {s: build(s) for s in SCOPES}
    else: G = {lab: build(lab.split('#')[0], lab.split('#')[1].split('+')) for labs, _ in cells for lab in labs}
    GC = {}                                                                     # ALL scope by category, for the category GMROI / sell-through rows
    for c in cat.index:
        m = fs.category_code.values == c
        GC[c] = dict(fm=agg(fs.assign(fm=fs.net_sales - fs.cogs_landed), ['fm'], m)['fm'], oh=agg(fi, ['on_hand_cost'], fi.category_code.values == c)['on_hand_cost'],
                     sold=agg(fs, ['units'], m & np.isin(ch_s, ['STORE', 'ONLINE']))['units'],
                     open_u=agg(fi, ['on_hand_units'], (fi.category_code.values == c) & np.isin(ch_i, ['STORE', 'ONLINE']))['on_hand_units'],
                     rcv=agg(fr, ['receipt_units'], fr.category_code.values == c)['receipt_units'])
    rule = T['param_status_rule'].set_index('rule_code')
    swk = wk.season_week.fillna(0).astype(int).values

    per, qtr = wk.period.values, wk.quarter.values

    def window(t, fy, w, k=None):
        """Key grammar {W|P|Q|FY}-FY{yyyy}[-{n}][@{k}] (exec-period-model.md §6, E-99): item weeks ∩ actuals, @k = first k weeks.
        PTD / YTD = legacy keys (w = as-of week), frozen as written on 2026-10-28 until both flavours have migrated."""
        base = (fy - 2025) * 52
        if t == 'W': return [base + w - 1]
        if t == 'PTD': i = base + w - 1; return list(range(PSI[i], i + 1))
        if t == 'YTD': return list(range(base, base + w))
        ix = [i for i in range(base, min(base + 52, NACT)) if t == 'FY' or (per if t == 'P' else qtr)[i] == w]
        return ix[:k] if k else ix

    def evaluate(s, t, fy, w, k=None):
        g = G[s]; ix = window(t, fy, w, k); L = ix[-1]; S_ = lambda k: g[k][ix].sum()
        MX = (lambda c: g[c][ix].sum()) if t in ('P', 'Q', 'FY') else (lambda c: g[c][L])   # channel mix: window shares at P / Q / FY (USER 2026-10-29), last week at W
        v = {}
        v.update(gross_sales=S_('gross_sales'), markdown=S_('markdown_value'), returns=S_('returns'), net_sales=S_('net_sales'), cogs=S_('cogs_landed'),
                 back_margin=S_('back_margin_alloc'))
        v['front_margin'] = v['net_sales'] - v['cogs']; v['total_margin'] = v['front_margin'] + v['back_margin']
        if v['net_sales']: v.update(front_gm_pct=v['front_margin'] / v['net_sales'], back_margin_pct=v['back_margin'] / v['net_sales'], total_margin_pct=v['total_margin'] / v['net_sales'])
        if v['gross_sales']: v['markdown_pct'] = v['markdown'] / v['gross_sales']
        v.update(opex_shrink=S_('ACT_SHRINK'), opex_store=S_('ACT_STORE_OPEX'), opex_central=S_('ACT_CENTRAL_OPEX'), opex_fulfilment=S_('ACT_FULFILMENT'))
        v['ebitda'] = v['total_margin'] - v['opex_shrink'] - v['opex_store'] - v['opex_central'] - v['opex_fulfilment']
        if v['net_sales']: v['ebitda_margin_pct'] = v['ebitda'] / v['net_sales']
        v.update(po_lines_due=S_('po_lines_due'), po_lines_otif=S_('po_lines_otif')); v['otif_pct'] = v['po_lines_otif'] / v['po_lines_due']
        v['otif_target'] = .95
        ly = [i - 52 for i in ix]
        if ly[0] >= 0:
            v['lfl_net_sales'] = S_('lfl'); v['lfl_net_sales_ly'] = g['lfl_as_ly'][ly].sum(); v['lfl_store_count'] = g['lfl_n'][L]
            v['store_net_sales_ly'] = g['ch_STORE'][ly].sum(); v['store_net_sales'] = S_('ch_STORE')
            if v['lfl_net_sales_ly'] > 0:
                v['lfl_growth_pct'] = v['lfl_net_sales'] / v['lfl_net_sales_ly'] - 1
                v['nonlfl_effect_pp'] = (v['store_net_sales'] / v['store_net_sales_ly'] - 1) - v['lfl_growth_pct']
            else:
                for k in ['lfl_net_sales', 'lfl_net_sales_ly', 'lfl_store_count']: v.pop(k)
        # point in time: the window's last week
        v.update(on_hand_cost=g['on_hand_cost'][L], on_order_cost=g['on_order_cost'][L], forecast_cogs=g['f'][L])
        v['stock_incl_on_order'] = v['on_hand_cost'] + v['on_order_cost']
        if v['forecast_cogs']: v['weeks_of_cover'] = v['stock_incl_on_order'] / v['forecast_cogs']; v['cover_target_wks'] = g['ft'][L] / g['f'][L]
        if g['ranged_sku_days'][L]:
            v.update(ranged_sku_days=g['ranged_sku_days'][L], in_stock_sku_days=g['in_stock_sku_days'][L]); v['availability_pct'] = v['in_stock_sku_days'] / v['ranged_sku_days']
        v['availability_target'] = .97
        if swk[L]:
            sw_ix = list(range(L - swk[L] + 1, L + 1)); o = g['open_u'][L - swk[L]]
            if o + g['rcv'][sw_ix].sum():                                     # 0 = a category pick without a seasonal category: N/A (E-101)
                v.update(season_opening_units=o, season_receipt_units=g['rcv'][sw_ix].sum(), season_units_sold=g['sold'][sw_ix].sum())
                v['sell_through_pct'] = v['season_units_sold'] / (o + v['season_receipt_units']); v['sell_through_target'] = .62
        if L >= 51:
            r = list(range(L - 51, L + 1)); fm52 = (g['net_sales'][r] - g['cogs_landed'][r]).sum(); av = g['on_hand_cost'][r].mean()
            gt = 2.5 if 'oh_c' not in g else sum(cat.gmroi_target[c] * x[r].mean() for c, x in g['oh_c'].items()) / av   # pick: AOH-weighted (E-102)
            if av: v.update(gmroi_front_margin_r52w=fm52, gmroi_avg_on_hand_cost=av, gmroi=fm52 / av, gmroi_target=gt)
        nl = MX('net_sales')
        if nl:
            for chn, k in [('STORE', 'store'), ('ONLINE', 'online'), ('WHOLESALE', 'wholesale')]:
                v[f'mix_{k}_net_sales'] = MX(f'ch_{chn}'); v[f'mix_{k}_pct'] = MX(f'ch_{chn}') / nl
        if fy == 2026:
            v.update(net_sales_bud=S_('net_sales_bud'), gross_sales_bud=S_('gross_sales_bud'), markdown_bud=S_('markdown_bud'), cogs_bud=S_('cogs_bud'),
                     back_margin_bud=S_('back_margin_bud'))
            v['markdown_pct_bud'] = v['markdown_bud'] / v['gross_sales_bud']; v['front_gm_pct_bud'] = 1 - v['cogs_bud'] / v['net_sales_bud']
            v['total_margin_pct_bud'] = (v['net_sales_bud'] - v['cogs_bud'] + v['back_margin_bud']) / v['net_sales_bud']
            v.update(opex_shrink_bud=S_('BUD_SHRINK'), opex_store_bud=S_('BUD_STORE_OPEX'), opex_central_bud=S_('BUD_CENTRAL_OPEX'), opex_fulfilment_bud=S_('BUD_FULFILMENT'))
            v['ebitda_bud'] = (v['net_sales_bud'] - v['cogs_bud'] + v['back_margin_bud'] - v['opex_shrink_bud'] - v['opex_store_bud']
                               - v['opex_central_bud'] - v['opex_fulfilment_bud'])
            v['ebitda_margin_pct_bud'] = v['ebitda_bud'] / v['net_sales_bud']
            if 'lfl_net_sales_ly' in v:
                v['lfl_net_sales_bud'] = S_('lfl_bud'); v['lfl_growth_pct_bud'] = v['lfl_net_sales_bud'] / v['lfl_net_sales_ly'] - 1
            nb = MX('net_sales_bud')
            if nb and nl:
                for chn, k in [('STORE', 'store'), ('ONLINE', 'online'), ('WHOLESALE', 'wholesale')]: v[f'mix_{k}_pct_bud'] = MX(f'chb_{chn}') / nb
                devs = [v[f'mix_{k}_pct'] - v[f'mix_{k}_pct_bud'] for k in ['store', 'online', 'wholesale']]
                j_ = int(np.argmax(np.abs(devs))); v['mix_max_dev_pp'] = devs[j_]; v['mix_max_dev_channel'] = j_ + 1     # first channel on a tie
        return v

    def status(kpi, b):
        r_ = rule.loc[kpi]; b = round(b, 10)
        return 1 if b <= r_.watch_from else (2 if b <= r_.off_from else 3)

    def card_status(s, t, fy, w, v):
        if t in ('PTD', 'YTD') and fy != 2026: return {}                       # legacy keys: as written on 2026-10-28 (no status before FY2026)
        cat_ = '#' in s                                                          # category pick: EBITDA N/A (no ebitda rows in v), no ebitda_ptd
        p = v if cat_ or t in ('PTD', 'P', 'Q', 'FY') else evaluate(s, 'PTD', fy, w)    # EBITDA: period to date at W (and legacy YTD), own window at P / Q / FY
        out = {}
        def put(k, cond, b):
            out[f'status.{k.lower()}'] = status(k, b) if cond else None
        put('NET_SALES', v.get('net_sales_bud'), -(v['net_sales'] / v['net_sales_bud'] - 1) if v.get('net_sales_bud') else 0)
        put('TOTAL_MARGIN', 'total_margin_pct' in v and 'total_margin_pct_bud' in v, v.get('total_margin_pct_bud', 0) - v.get('total_margin_pct', 0))
        put('WEEKS_OF_COVER', 'weeks_of_cover' in v, abs(v.get('weeks_of_cover', 0) - v.get('cover_target_wks', 0)))
        put('MARKDOWN', 'markdown_pct' in v and 'markdown_pct_bud' in v, v.get('markdown_pct', 0) - v.get('markdown_pct_bud', 0))
        put('AVAILABILITY', 'availability_pct' in v, .97 - v.get('availability_pct', 0))
        put('EBITDA', bool(p.get('ebitda_bud')), -(p['ebitda'] / p['ebitda_bud'] - 1) if p.get('ebitda_bud') else 0)
        put('LFL_GROWTH', 'lfl_growth_pct_bud' in v, v.get('lfl_growth_pct_bud', 0) - v.get('lfl_growth_pct', 0))
        put('FRONT_GM', 'front_gm_pct' in v and 'front_gm_pct_bud' in v, v.get('front_gm_pct_bud', 0) - v.get('front_gm_pct', 0))
        put('SELL_THROUGH', 'sell_through_pct' in v, .62 - v.get('sell_through_pct', 0))
        put('GMROI', 'gmroi' in v, v.get('gmroi_target', 2.5) - v.get('gmroi', 0))
        put('SUPPLIER_OTIF', 'otif_pct' in v, .95 - v.get('otif_pct', 0))
        put('CHANNEL_MIX', 'mix_max_dev_pp' in v, abs(v.get('mix_max_dev_pp', 0)))
        st_ = [x for x in out.values() if x is not None]
        n = len(st_); on, wa, of = st_.count(1), st_.count(2), st_.count(3)
        dot = None if not n else 3 if of / n >= rule.loc['DOT_RED_OFF'].threshold else (2 if (wa + of) / n > rule.loc['DOT_ORANGE_WATCH_OFF'].threshold
              else (1 if on / n >= rule.loc['DOT_GREEN_GOOD'].threshold else 2))       # n = 0: no dot row (grey dot, E-95)
        out.update({'status.count_on': on, 'status.count_watch': wa, 'status.count_off': of, 'status.count_na': 12 - n, 'status.dot': dot})
        if t in ('W', 'PTD', 'YTD') and not cat_: out.update({'ebitda_ptd': p['ebitda'], 'ebitda_bud_ptd': p.get('ebitda_bud')})   # W keys only (+ legacy)
        return out

    keys = [('W', 2026, w, None) for w in range(30, 44)] + [('W', 2025, w, None) for w in range(31, 44)]
    keys += [('P', y, n, None) for y in (2025, 2026) for n in range(1, 13) if window('P', y, n)]       # every Month item (22)
    keys += [('Q', y, n, None) for y in (2025, 2026) for n in range(1, 5) if window('Q', y, n)]        # every Quarter item (8)
    keys += [('FY', 2025, None, None), ('FY', 2026, None, None), ('Q', 2026, 3, 4), ('Q', 2025, 4, 4), ('FY', 2025, None, 43)]
    def ebitda_prev(fy, w):     # EBITDA card, Previous at Week (USER 2026-10-29): the previous period's first k weeks, k = week of period;
        i = (fy - 2025) * 52 + w - 1; fy_, p_ = (fy, per[i] - 1) if per[i] > 1 else (fy - 1, 12)     # None = N/A when the previous period is shorter than k
        k_ = i - PSI[i] + 1; return ('P', fy_, p_, k_) if k_ <= len(window('P', fy_, p_)) else None  # (week 5 of a 5-week period; main agent 2026-10-30)
    for (_, fy, w, _) in [x for x in keys if x[0] == 'W']:                                         # the covered W keys
        if ebitda_prev(fy, w) and ebitda_prev(fy, w) not in keys: keys.append(ebitda_prev(fy, w))
    keys += [('PTD', 2026, 43, None), ('PTD', 2026, 42, None), ('PTD', 2025, 43, None),               # legacy, removed once both flavours
             ('YTD', 2026, 43, None), ('YTD', 2026, 42, None), ('YTD', 2025, 43, None)]               # read the item keys (README)
    pairs = [(x, s) for x in keys for s in SCOPES] if cells is None else [(x, lab) for labs, ks in cells for x in ks for lab in labs]
    rows = []
    for (t, fy, w, kw), s in pairs:
        pk = (f'FY-FY{fy}' if t == 'FY' else f'Q-FY{fy}-{w}' if t == 'Q' else f'{t}-FY{fy}-{w:02d}') + (f'@{kw}' if kw else '')
        v = evaluate(s, t, fy, w, kw)
        if '#' in s: v = {k: x for k, x in v.items() if not k.startswith(('opex_', 'ebitda', 'po_lines_', 'otif_'))}   # no category key (E-101)
        v.update(card_status(s, t, fy, w, v))
        if s == 'ALL' or s.startswith('ALL#'):
            ix = window(t, fy, w, kw); L = ix[-1]; picked = s.split('#')[1].split('+') if '#' in s else list(GC)
            for c, gc in GC.items():
                if c not in picked: continue                                 # (i) mini stats list the picked categories only (E-101)
                if L >= 51: v[f'gmroi.{c}'] = gc['fm'][L - 51:L + 1].sum() / gc['oh'][L - 51:L + 1].mean()
                if swk[L] and c in seasonal:
                    sw_ix = list(range(L - swk[L] + 1, L + 1))
                    v[f'sell_through_pct.{c}'] = gc['sold'][sw_ix].sum() / (gc['open_u'][L - swk[L]] + gc['rcv'][sw_ix].sum())
            if t == 'W' and '#' not in s:
                x = T['fact_po_week']; x = x[x.week_key == KEY[L]]
                v['otif_suppliers_below_85'] = int((x.po_lines_otif / x.po_lines_due < .85).sum())
        for k, val in v.items():
            if val is None or (isinstance(val, float) and np.isnan(val)): continue
            rows.append((s, pk, k, fmt(k, val)))
    return pd.DataFrame(rows, columns=['scope', 'period_key', 'metric_code', 'value'])

COUNTS = ('lfl_store_count', 'po_lines_due', 'po_lines_otif', 'mix_max_dev_channel', 'otif_suppliers_below_85')
def is_ratio(k):
    return ('pct' in k or k.endswith(('_pp', '_target', '_target_wks')) or k in ('gmroi', 'weeks_of_cover') or k.startswith('gmroi.'))
def fmt(k, val):
    if k.startswith('status.') or k in COUNTS: return f'{val:.0f}'
    if k.endswith(('_units', '_sku_days')): return f'{val:.1f}'
    return f'{val:.6f}' if is_ratio(k) else f'{val:.2f}'


# ---- ET-02: the v5 Week-43 story at display precision ------------------------------------------------------------------------
def story_expect():
    return {  # metric -> expected display string, from the v5 cards and their (i) worked examples
        'net_sales': '€61.4m', 'net_sales_bud': '€62.9m', 'gross_sales': '€68.4m', 'markdown': '€6.7m', 'returns': '€0.3m',
        'cogs': '€42.9m', 'front_margin': '€18.5m', 'back_margin': '€3.8m', 'total_margin': '€22.3m',
        'front_gm_pct': '30.1%', 'front_gm_pct_bud': '30.0%', 'back_margin_pct': '6.2%', 'total_margin_pct': '36.3%', 'total_margin_pct_bud': '36.2%',
        'markdown_pct': '9.8%', 'markdown_pct_bud': '8.5%', 'weeks_of_cover': '11.4', 'cover_target_wks': '9.5',
        'on_hand_cost': '€402m', 'on_order_cost': '€88m', 'stock_incl_on_order': '€490m', 'forecast_cogs': '€43.0m',
        'availability_pct': '94.1%', 'ranged_sku_days': '497,000', 'in_stock_sku_days': '467,700',
        'lfl_growth_pct': '+3.4%', 'lfl_growth_pct_bud': '3.0%', 'lfl_store_count': '131', 'lfl_net_sales': '€39.0m', 'lfl_net_sales_ly': '€37.7m',
        'nonlfl_effect_pp': f'{M}1.2 pp', 'sell_through_pct': '63.1%', 'season_units_sold': '8.4m', 'season_opening_units': '4.2m',
        'season_receipt_units': '9.1m', 'gmroi': '2.7×', 'otif_pct': '95.4%', 'po_lines_due': '4,812', 'po_lines_otif': '4,591',
        'mix': '68.4 / 19.9 / 11.7', 'mix_store_net_sales': '€42.0m', 'mix_online_net_sales': '€12.2m', 'mix_wholesale_net_sales': '€7.2m',
        'mix_dev': 'online +1.9 pp', 'd_net_sales': f'{M}€1.5m ({M}2.4%)', 'd_total_margin': '+0.1 pp', 'd_cover': '+1.9', 'd_markdown': '+1.3 pp',
        'd_availability': f'{M}2.9 pp', 'd_lfl': '+0.4 pp', 'd_front_gm': '+0.1 pp', 'd_sell_through': '+1.1 pp', 'd_gmroi': '+0.2×', 'd_otif': '+0.4 pp',
        'ebitda_ptd': '€15.3m', 'd_ebitda': f'{M}€0.8m ({M}5.0%)', 'ebitda_bud_ptd': '€16.1m', 'p10_total_margin': '€87.7m', 'p10_shrink': '€2.2m',
        'p10_store': '€52.4m', 'p10_central': '€11.6m', 'p10_fulfilment': '€6.2m', 'p10_net_sales': '€241.7m', 'p10_ebitda_margin': '6.3%',
        'p10_ebitda_margin_bud': '6.6%', 'ytd_net_sales': '€2,318m', 'vs_ly_net_sales': '+3.8%', 'online_lfl': '+12.1%',
        'vs_ly_markdown': '+1.9 pp', 'vs_ly_total_margin': f'{M}0.2 pp', 'vs_ly_front_gm': f'{M}0.3 pp', 'vs_lw_cover': '+0.3',
        'vs_lw_availability': f'{M}0.2 pp', 'vs_lw_otif': '+0.4 pp', 'vs_ly_sell_through': '+2.4 pp', 'st_apparel': '58%', 'st_home': '69%',
        'gmroi_hb': '4.1×', 'gmroi_elec': '1.9×', 'suppliers_below_85': '2',
        'status': [2, 1, 2, 3, 3, 2, 1, 1, 1, 1, 1, 1], 'counts': (7, 3, 2, 0), 'dot': 2}

def story_actual(get):
    """Render the Week-43 ALL story from control-total values; get(period_key, metric) -> float."""
    W, P, Y = 'W-FY2026-43', 'P-FY2026-10', 'FY-FY2026'
    g = lambda k, p=W: get(p, k)
    def eur(x, d=1): return (M if x < 0 else '') + f'€{abs(x) / 1e6:,.{d}f}m'
    def pc(x, d=1): return f'{x * 100:.{d}f}%'
    def sg(x, d=1, u=' pp', mult=100): s = f'{abs(x) * mult:.{d}f}'; return ('+' if x >= 0 else M) + s + u
    n, nb = g('net_sales'), g('net_sales_bud')
    keys = ['NET_SALES', 'TOTAL_MARGIN', 'WEEKS_OF_COVER', 'MARKDOWN', 'AVAILABILITY', 'EBITDA', 'LFL_GROWTH', 'FRONT_GM', 'SELL_THROUGH', 'GMROI', 'SUPPLIER_OTIF', 'CHANNEL_MIX']
    mx = [g('mix_store_pct'), g('mix_online_pct'), g('mix_wholesale_pct')]; ch = int(g('mix_max_dev_channel'))
    e, eb = g('ebitda', P), g('ebitda_bud', P)
    return {
        'net_sales': eur(n), 'net_sales_bud': eur(nb), 'gross_sales': eur(g('gross_sales')), 'markdown': eur(g('markdown')), 'returns': eur(g('returns')),
        'cogs': eur(g('cogs')), 'front_margin': eur(g('front_margin')), 'back_margin': eur(g('back_margin')), 'total_margin': eur(g('total_margin')),
        'front_gm_pct': pc(g('front_gm_pct')), 'front_gm_pct_bud': pc(g('front_gm_pct_bud')), 'back_margin_pct': pc(g('back_margin_pct')),
        'total_margin_pct': pc(g('total_margin_pct')), 'total_margin_pct_bud': pc(g('total_margin_pct_bud')), 'markdown_pct': pc(g('markdown_pct')),
        'markdown_pct_bud': pc(g('markdown_pct_bud')), 'weeks_of_cover': f"{g('weeks_of_cover'):.1f}", 'cover_target_wks': f"{g('cover_target_wks'):.1f}",
        'on_hand_cost': eur(g('on_hand_cost'), 0), 'on_order_cost': eur(g('on_order_cost'), 0), 'stock_incl_on_order': eur(g('stock_incl_on_order'), 0),
        'forecast_cogs': eur(g('forecast_cogs')), 'availability_pct': pc(g('availability_pct')), 'ranged_sku_days': f"{g('ranged_sku_days'):,.0f}",
        'in_stock_sku_days': f"{g('in_stock_sku_days'):,.0f}", 'lfl_growth_pct': sg(g('lfl_growth_pct'), u='%'), 'lfl_growth_pct_bud': pc(g('lfl_growth_pct_bud')),
        'lfl_store_count': f"{g('lfl_store_count'):.0f}", 'lfl_net_sales': eur(g('lfl_net_sales')), 'lfl_net_sales_ly': eur(g('lfl_net_sales_ly')),
        'nonlfl_effect_pp': sg(g('nonlfl_effect_pp')), 'sell_through_pct': pc(g('sell_through_pct')),
        'season_units_sold': f"{g('season_units_sold') / 1e6:.1f}m", 'season_opening_units': f"{g('season_opening_units') / 1e6:.1f}m",
        'season_receipt_units': f"{g('season_receipt_units') / 1e6:.1f}m", 'gmroi': f"{g('gmroi'):.1f}×", 'otif_pct': pc(g('otif_pct')),
        'po_lines_due': f"{g('po_lines_due'):,.0f}", 'po_lines_otif': f"{g('po_lines_otif'):,.0f}",
        'mix': ' / '.join(f'{x * 100:.1f}' for x in mx), 'mix_store_net_sales': eur(g('mix_store_net_sales')),
        'mix_online_net_sales': eur(g('mix_online_net_sales')), 'mix_wholesale_net_sales': eur(g('mix_wholesale_net_sales')),
        'mix_dev': ['store', 'online', 'wholesale'][ch - 1] + ' ' + sg(g('mix_max_dev_pp')),
        'd_net_sales': f'{eur(n - nb)} ({sg(n / nb - 1, u="%")})', 'd_total_margin': sg(g('total_margin_pct') - g('total_margin_pct_bud')),
        'd_cover': sg(g('weeks_of_cover') - g('cover_target_wks'), u='', mult=1), 'd_markdown': sg(g('markdown_pct') - g('markdown_pct_bud')),
        'd_availability': sg(g('availability_pct') - .97), 'd_lfl': sg(g('lfl_growth_pct') - g('lfl_growth_pct_bud')),
        'd_front_gm': sg(g('front_gm_pct') - g('front_gm_pct_bud')), 'd_sell_through': sg(g('sell_through_pct') - .62),
        'd_gmroi': sg(g('gmroi') - 2.5, u='×', mult=1), 'd_otif': sg(g('otif_pct') - .95),
        'ebitda_ptd': eur(e), 'd_ebitda': f'{eur(e - eb)} ({sg(e / eb - 1, u="%")})', 'ebitda_bud_ptd': eur(eb),
        'p10_total_margin': eur(g('total_margin', P)), 'p10_shrink': eur(g('opex_shrink', P)), 'p10_store': eur(g('opex_store', P)),
        'p10_central': eur(g('opex_central', P)), 'p10_fulfilment': eur(g('opex_fulfilment', P)), 'p10_net_sales': eur(g('net_sales', P)),
        'p10_ebitda_margin': pc(g('ebitda_margin_pct', P)), 'p10_ebitda_margin_bud': pc(g('ebitda_margin_pct_bud', P)),
        'ytd_net_sales': eur(g('net_sales', Y), 0), 'vs_ly_net_sales': sg(n / g('net_sales', 'W-FY2025-43') - 1, u='%'),
        'online_lfl': sg(g('mix_online_net_sales') / g('mix_online_net_sales', 'W-FY2025-43') - 1, u='%'),
        'vs_ly_markdown': sg(g('markdown_pct') - g('markdown_pct', 'W-FY2025-43')),
        'vs_ly_total_margin': sg(g('total_margin_pct') - g('total_margin_pct', 'W-FY2025-43')),
        'vs_ly_front_gm': sg(g('front_gm_pct') - g('front_gm_pct', 'W-FY2025-43')),
        'vs_lw_cover': sg(g('weeks_of_cover') - g('weeks_of_cover', 'W-FY2026-42'), u='', mult=1),
        'vs_lw_availability': sg(g('availability_pct') - g('availability_pct', 'W-FY2026-42')),
        'vs_lw_otif': sg(g('otif_pct') - g('otif_pct', 'W-FY2026-42')),
        'vs_ly_sell_through': sg(g('sell_through_pct') - g('sell_through_pct', 'W-FY2025-43')),
        'st_apparel': pc(g('sell_through_pct.APPAREL'), 0), 'st_home': pc(g('sell_through_pct.HOME'), 0),
        'gmroi_hb': f"{g('gmroi.HB'):.1f}×", 'gmroi_elec': f"{g('gmroi.ELEC'):.1f}×", 'suppliers_below_85': f"{g('otif_suppliers_below_85'):.0f}",
        'status': [int(g(f'status.{k.lower()}')) for k in keys],
        'counts': tuple(int(g(f'status.count_{x}')) for x in ['on', 'watch', 'off', 'na']), 'dot': int(g('status.dot'))}

def story_check(ct):
    a = ct[ct.scope == 'ALL']; d = {(p, m): float(v) for p, m, v in zip(a.period_key, a.metric_code, a.value)}
    got, exp = story_actual(lambda p, m: d[(p, m)]), story_expect()
    bad = {k: (got[k], e) for k, e in exp.items() if got[k] != e}
    assert not bad, f'v5 story not met: {bad}'
    print(f'ET-02 story: {len(exp)} display values match v5 (7 / 3 / 2, dot orange)')


if __name__ == '__main__':
    main()

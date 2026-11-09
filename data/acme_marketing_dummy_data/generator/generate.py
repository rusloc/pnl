#!/usr/bin/env python3
"""ACME paid acquisition (digital marketing) dummy dataset - deterministic generator (seed 20261104).

Usage:  python generate.py [--out <folder>]      (default: the dataset folder, one level up)
Writes  <out>/parquet/<table>.parquet (27 tables) + <out>/parquet/manifest.json and <out>/checks/control_totals_usd.csv.
Contract: ADR-0015 (c)/(d), docs/Requirements-marketing.md (A-nn, AT-nn) and the README.md of the dataset folder.

Story-first (ADR-0015 (d), A-70): the default window (R30 = 2026-10-05 .. 2026-11-03) and the previous period
(2026-09-05 .. 2026-10-04) are fixed per campaign and per story group (spend, plan, paid customers, New MRR, ROAS,
trials before / after the 2026-10-18 step, store CVRs, ...). Those totals are allocated to days, creatives, terms, pages
and segments by stable shares plus seeded noise, in integer units (counts, cents, 1e-4 paid-customer credits) with
largest-remainder rounding inside every group. History from 2025-01-01 follows the same rates with trends and
seasonality and ramps into the previous period. The control totals are recomputed from the written tables and the
story table is asserted at display precision before the run ends. All figures are illustrative.
"""
import argparse, json, sys, time
from pathlib import Path
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SEED, VERSION = 20261104, '1.0.0'
AS_OF, REFRESHED = '2026-11-03', '2026-11-04T14:55:00'
GM = 0.363
TEAM = [('2025-01-01', 45_500.0), ('2026-10-05', 55_730.0)]   # README "Deviations" D-2: step on the window start
MINUS = '−'

# ---- calendar ------------------------------------------------------------------------------------------------------
DAY = np.arange(np.datetime64('2025-01-01'), np.datetime64('2026-11-04'), dtype='datetime64[D]')
ND = DAY.size
DN = DAY.astype(np.int64)
WDAY = (DN + 3) % 7                                   # Monday = 0
YR = DAY.astype('datetime64[Y]').astype(np.int64) + 1970
MO = DAY.astype('datetime64[M]').astype(np.int64) % 12 + 1
MI = (YR - 2025) * 12 + MO - 1                        # 0 = 2025-01 .. 22 = 2026-11
MST = np.array([np.datetime64(f'{2025 + m // 12}-{m % 12 + 1:02d}-01') for m in range(25)], dtype='datetime64[D]')
DIM = np.diff(MST).astype(np.int64)                   # days in month, 24 months 2025-01 .. 2026-12
DOM = (DAY - MST[MI]).astype(np.int64) + 1
PROG = np.arange(ND) / (ND - 1)


def ix(s): return int((np.datetime64(s, 'D') - DAY[0]).astype(np.int64))


iP0, iW0, iB, iC, iD, iE = ix('2026-09-05'), ix('2026-10-05'), ix('2026-10-18'), ix('2026-10-21'), ix('2026-10-22'), ix('2026-10-28')
BLK = np.where(DAY < np.datetime64('2026-09-01'), MI, 20)     # 0..19 = months Jan 2025 .. Aug 2026, 20 = Sep 1-4 2026
BLK[iP0:iW0] = 21                                              # P = previous period
BLK[iW0:iB] = 22; BLK[iB:iC] = 23; BLK[iC:iD] = 24; BLK[iD:iE] = 25; BLK[iE:] = 26   # W = A | B | C | D | E
NBK, PB, WBL = 27, 21, [22, 23, 24, 25, 26]
BM = [BLK == b for b in range(NBK)]
WD = np.zeros(ND, bool); WD[iW0:] = True
PD = np.zeros(ND, bool); PD[iP0:iW0] = True
AGE_H = (ND - 1 - np.arange(ND)) * 24.0 + 12.0           # hours from a mid-day sign-up to the end of the as-of day
EDGES = np.array([0, 1, 6, 24, 48, 96, 168, 720], float)
S7 = np.array([.135, .19, .162, .16, .123, .095, .135])  # shares of activations within 30 days by hours from sign-up
OBS = np.clip((AGE_H[None, :] - EDGES[:-1, None]) / np.diff(EDGES)[:, None], 0, 1)    # 7 x ND observed share of each bin
COMP7 = (S7[:6, None] * OBS[:6]).sum(0) / S7[:6].sum()                                 # observed share of 7-day activations

# ---- reference data ----------------------------------------------------------------------------------------------------
CHANNELS = [('PAID_SEARCH', 'Paid search', 1, '#4A57E8', '#7F88F5'), ('PAID_SOCIAL', 'Paid social', 2, '#C26A10', '#C9822A'),
            ('APP_INSTALL', 'App install', 3, '#0F9A8E', '#259E90'), ('DISPLAY_VIDEO', 'Display & video', 4, '#8E52D9', '#9B7FE0'),
            ('RETARGETING', 'Retargeting', 5, '#6E7A1E', '#86983F'), ('AFFILIATES', 'Affiliates', 6, '#9B2A4E', '#D2688C')]
NETWORKS = [('GOOGLE_ADS', 'Google Ads'), ('MICROSOFT_ADS', 'Microsoft Ads'), ('META', 'Meta'), ('LINKEDIN', 'LinkedIn'), ('TIKTOK', 'TikTok'),
            ('APPLE_SEARCH_ADS', 'Apple Search Ads'), ('DV360', 'Display & Video 360'), ('AFFILIATE_NET', 'Affiliate network')]
CH_CPA = dict(PAID_SEARCH=340, PAID_SOCIAL=420, APP_INSTALL=380, DISPLAY_VIDEO=550, RETARGETING=260, AFFILIATES=350)
CH_CTR = dict(PAID_SEARCH=(.03, .06), PAID_SOCIAL=(.008, .015), APP_INSTALL=(.01, .03), DISPLAY_VIDEO=(.004, .012), RETARGETING=(.005, .015), AFFILIATES=(.01, .04))
CH_PAID = dict(PAID_SEARCH=187.82, PAID_SOCIAL=112.06, APP_INSTALL=71.00, DISPLAY_VIDEO=33.00, RETARGETING=38.12, AFFILIATES=15.00)   # W, DDA
CH_ROAS = dict(PAID_SEARCH=1.31, PAID_SOCIAL=0.74, APP_INSTALL=0.98, DISPLAY_VIDEO=0.62, RETARGETING=1.90, AFFILIATES=1.22)
CH_PLAN = dict(PAID_SEARCH=57_500, PAID_SOCIAL=54_000, APP_INSTALL=28_300, DISPLAY_VIDEO=18_500, RETARGETING=11_200, AFFILIATES=6_500)
CH_GAP_W = dict(PAID_SEARCH=.18, PAID_SOCIAL=.72, APP_INSTALL=.29, DISPLAY_VIDEO=.95, RETARGETING=.17, AFFILIATES=0.0)
CH_LC = dict(PAID_SEARCH=1.35, PAID_SOCIAL=.80, APP_INSTALL=1.10, DISPLAY_VIDEO=.50, RETARGETING=1.30, AFFILIATES=1.20)
CH_FT = dict(PAID_SEARCH=.80, PAID_SOCIAL=1.30, APP_INSTALL=1.00, DISPLAY_VIDEO=1.40, RETARGETING=.50, AFFILIATES=.90)
CH_FREE = dict(PAID_SEARCH='SRCH_NONBRAND_ANALYTICS', PAID_SOCIAL='SOC_LINKEDIN_ABM', APP_INSTALL='APP_UAC_ANDROID',
               DISPLAY_VIDEO='DV_DV360_DISPLAY', RETARGETING='RT_APP_REENGAGE', AFFILIATES='AFF_REVIEW_SITES')   # absorbs the channel ROAS
MOVERS = {'RT_TRIAL_ABANDON': .32, 'SRCH_BRAND_GLOBAL': .11, 'APP_ASA_CORE': .06, 'SOC_TIKTOK_CREATOR': -.09, 'DV_YOUTUBE_DEMO': -.18, 'SOC_META_LAL2': -.41}

#   campaign_key               campaign_name                       channel          network             platform   market    tier              objective    status      brand  start         end           learning_end
CAMPS = [
    ('SRCH_BRAND_GLOBAL',       'Brand search · Global',            'PAID_SEARCH',   'GOOGLE_ADS',       'WEB',     'GLOBAL', 'SELF_SERVE',     'PAID',      'LIVE',     True,  '2024-03-01', None,         '2024-03-15'),
    ('SRCH_NONBRAND_ANALYTICS', 'Non-brand · Analytics terms',      'PAID_SEARCH',   'GOOGLE_ADS',       'WEB',     'NA',     'SELF_SERVE',     'PAID',      'LIVE',     False, '2024-03-01', None,         '2024-03-15'),
    ('SOC_META_LAL2',           'Meta prospecting · Lookalike 2%',  'PAID_SOCIAL',   'META',             'IOS',     'NA',     'SELF_SERVE',     'PAID',      'LIVE',     False, '2025-07-01', None,         '2026-10-05'),
    ('SOC_META_INTERESTS',      'Meta prospecting · Interests',     'PAID_SOCIAL',   'META',             'ANDROID', 'GLOBAL', 'SELF_SERVE',     'PAID',      'LIVE',     False, '2024-11-01', None,         '2024-11-15'),
    ('SOC_LINKEDIN_ABM',        'LinkedIn · Data teams ABM',        'PAID_SOCIAL',   'LINKEDIN',         'WEB',     'NA',     'SALES_ASSISTED', 'PIPELINE',  'LIVE',     False, '2024-10-01', None,         '2024-10-15'),
    ('APP_ASA_CORE',            'Apple Search Ads · Core',          'APP_INSTALL',   'APPLE_SEARCH_ADS', 'IOS',     'GLOBAL', 'SELF_SERVE',     'INSTALL',   'LIVE',     False, '2024-05-01', None,         '2024-05-15'),
    ('APP_UAC_ANDROID',         'Google UAC · Android growth',      'APP_INSTALL',   'GOOGLE_ADS',       'ANDROID', 'GLOBAL', 'SELF_SERVE',     'INSTALL',   'LIVE',     False, '2024-08-01', None,         '2024-08-15'),
    ('DV_YOUTUBE_DEMO',         'YouTube · Product demo',           'DISPLAY_VIDEO', 'GOOGLE_ADS',       'WEB',     'GLOBAL', 'SELF_SERVE',     'PAID',      'LIVE',     False, '2025-02-01', None,         '2025-02-15'),
    ('DV_DV360_DISPLAY',        'DV360 · Programmatic display',     'DISPLAY_VIDEO', 'DV360',            'WEB',     'NA',     'SELF_SERVE',     'PAID',      'LIVE',     False, '2024-09-01', None,         '2024-09-15'),
    ('SOC_TIKTOK_CREATOR',      'TikTok · Creator cuts',            'PAID_SOCIAL',   'TIKTOK',           'ANDROID', 'GLOBAL', 'SELF_SERVE',     'PAID',      'LEARNING', False, '2026-06-01', None,         '2026-11-09'),
    ('RT_TRIAL_ABANDON',        'Retarget · Trial abandon',         'RETARGETING',   'GOOGLE_ADS',       'WEB',     'GLOBAL', 'SELF_SERVE',     'PAID',      'LIVE',     False, '2024-04-01', None,         '2024-04-15'),
    ('RT_APP_REENGAGE',         'Retarget · App re-engage',         'RETARGETING',   'META',             'IOS',     'GLOBAL', 'SELF_SERVE',     'PAID',      'LIVE',     False, '2025-05-01', None,         '2025-05-15'),
    ('SRCH_MSFT_NONBRAND',      'Microsoft Ads · Non-brand',        'PAID_SEARCH',   'MICROSOFT_ADS',    'WEB',     'NA',     'SELF_SERVE',     'PAID',      'LIVE',     False, '2024-06-01', None,         '2024-06-15'),
    ('AFF_REVIEW_SITES',        'Affiliate · Review sites',         'AFFILIATES',    'AFFILIATE_NET',    'WEB',     'NA',     'SELF_SERVE',     'PAID',      'LEARNING', False, '2025-03-01', None,         '2026-11-12'),
    ('RT_META_RETENTION',       'Meta retention · Churn-risk',      'RETARGETING',   'META',             'ANDROID', 'GLOBAL', 'SELF_SERVE',     'RETENTION', 'PAUSED',   False, '2025-01-15', None,         '2025-01-29'),
    ('SOC_LINKEDIN_WEBINAR',    'LinkedIn · Webinar Nov',           'PAID_SOCIAL',   'LINKEDIN',         'WEB',     'EMEA',   'SALES_ASSISTED', 'LEAD',      'LIVE',     False, '2026-10-01', '2026-11-30', '2026-10-15'),
    ('SRCH_BRAND_DEFR',         'Brand search · DE/FR',             'PAID_SEARCH',   'GOOGLE_ADS',       'WEB',     'EMEA',   'SELF_SERVE',     'PAID',      'LIVE',     True,  '2025-04-01', None,         '2025-04-15'),
    ('SOC_META_LAL1',           'Meta prospecting · Lookalike 1%',  'PAID_SOCIAL',   'META',             'IOS',     'NA',     'SELF_SERVE',     'PAID',      'ENDED',    False, '2024-09-01', '2025-12-31', '2024-09-15'),
    ('SRCH_SUMMER_PROMO',       'Summer promo · Search',            'PAID_SEARCH',   'GOOGLE_ADS',       'WEB',     'NA',     'SELF_SERVE',     'PAID',      'ENDED',    False, '2026-06-01', '2026-08-31', '2026-06-15')]
PAUSED_LAST = {'RT_META_RETENTION': '2026-09-30'}
KEYS = [r[0] for r in CAMPS]; NC = len(KEYS); K = {k: i for i, k in enumerate(KEYS)}
CHN = np.array([r[2] for r in CAMPS]); PLAT = np.array([r[4] for r in CAMPS]); OBJ = np.array([r[7] for r in CAMPS])
BRAND = np.array([r[9] for r in CAMPS])
L, INT, ABM, ASA, UAC, YT, DVC, TT, TA, RA, MS, AFF, RET, WEB, BG, NB, DEFR = (K[k] for k in (
    'SOC_META_LAL2', 'SOC_META_INTERESTS', 'SOC_LINKEDIN_ABM', 'APP_ASA_CORE', 'APP_UAC_ANDROID', 'DV_YOUTUBE_DEMO', 'DV_DV360_DISPLAY',
    'SOC_TIKTOK_CREATOR', 'RT_TRIAL_ABANDON', 'RT_APP_REENGAGE', 'SRCH_MSFT_NONBRAND', 'AFF_REVIEW_SITES', 'RT_META_RETENTION',
    'SOC_LINKEDIN_WEBINAR', 'SRCH_BRAND_GLOBAL', 'SRCH_NONBRAND_ANALYTICS', 'SRCH_BRAND_DEFR'))

# W / P design per campaign (ADR-0015 (d); campaign rows other than the story campaign are indicative):
#   spW / spP window and previous-period spend (USD), pace W (fixed for the story rows, else scaled to the channel plan), cpa W (paid split
#   inside the channel), roas W / P, CTR 7-day slope W, frequency, CPM, CTR, c1 (web landing rate or mobile click -> store view rate),
#   c2 (web session -> sign-up or install -> sign-up), trial rate, activation factor, platform gap W / P, churn factor, ARPA
DES_TXT = '''
SRCH_BRAND_GLOBAL        19100 18800 1.01 270  1.62 1.51  .02 1.20  30   .065  .82 .033 .55 1.00  .16  .14  .90 141
SRCH_NONBRAND_ANALYTICS  26300 25900 1.04 353  1.16 1.15 -.03 1.40  45   .038  .76 .036 .58 1.00  .20  .16  .95 132
SOC_META_LAL2            19800 14000 1.22 641   .58  .99 -.46 3.40  19   .030  .86 .110 .30 1.00  .60  .45 1.10 120
SOC_META_INTERESTS       12400 12400 1.08 470   .81  .84 -.12 2.60  10.3 .011  .97 .160 .33 1.00  .60  .50 1.15 125
SOC_LINKEDIN_ABM         17100 16400 1.00 690   .91  .89  .04 2.10  32   .0055 .80 .070 .60 1.05 1.00  .85  .85 210
APP_ASA_CORE             16200 16000  .98 330  1.05  .99  .01 1.00  77   .069  .99 .185 .46 1.00  .25  .22 1.00 125
APP_UAC_ANDROID          12400 12100  .95 560   .89  .93 -.08 1.70  7.5  .0055 .98 .140 .46 1.00  .35  .30 1.05 115
DV_YOUTUBE_DEMO          11600 11600 1.07 690   .55  .73 -.05 2.90  6    .009  .55 .025 .50  .95 1.25 1.05 1.20 120
DV_DV360_DISPLAY          8300  8100 1.05 514   .72  .73 -.02 4.25  3.5  .0055 .55 .020 .45  .95  .70  .55 1.20 118
SOC_TIKTOK_CREATOR        8300  7400 1.15 400   .86  .95  .18 1.90  6.9  .0085 .98 .150 .32 1.00 1.20 1.00 1.15 110
RT_TRIAL_ABANDON          6100  6300  .84 227  2.10 1.78  .06 2.40  7    .015  .85 .040 .55 1.05  .15  .14  .80 150
RT_APP_REENGAGE           3300  3300  .85 275  1.53 1.50  .02 2.20  8.5  .008  .97 .220 .50 1.00  .22  .18  .90 135
SRCH_MSFT_NONBRAND        9200  9000  .99 360  1.02 1.04 -.01 1.30  35   .035  .76 .030 .55 1.00  .18  .15  .95 130
AFF_REVIEW_SITES          5200  5100  .80 347  1.22 1.25  .00 1.00  20   .035  .85 .040 .40 1.00  .00  .00 1.00 136
RT_META_RETENTION            0  2500 1.00   0  0    0     .03 1.80  9    .008  .97 .100 .40 1.00  .20  .20 1.00 120
SOC_LINKEDIN_WEBINAR      6500   800 1.03 700   .49  .50  .07 1.60  28   .006  .82 .090 .45 1.00  .90  .80 1.00 110
SRCH_BRAND_DEFR           6600  6400 1.02 338  1.41 1.38  .01 1.10  28   .060  .80 .028 .52 1.00  .16  .14  .90 150
SOC_META_LAL1                0     0 1.00   0  0    0     .00 2.40  14   .028  .86 .140 .40 1.00  .60  .45 1.05 118
SRCH_SUMMER_PROMO            0     0 1.00   0  0    0     .00 1.20  32   .050  .80 .034 .55 1.00  .18  .16  .95 125
'''
DCOLS = ['spW', 'spP', 'pace', 'cpa', 'roasW', 'roasP', 'slope', 'fq', 'cpm', 'ctr', 'c1', 'c2', 'trial', 'actf', 'gapW', 'gapP', 'churn', 'arpa']
DES = {r.split()[0]: dict(zip(DCOLS, map(float, r.split()[1:]))) for r in DES_TXT.strip().splitlines()}
D = {c: np.array([DES[k][c] for k in KEYS]) for c in DCOLS}
FIXED_PACE = {L, INT, TA, AFF}
ACT_BASE = dict(WEB=.43, IOS=.48, ANDROID=.36)
SEASON = np.array([.97, 1.0, 1.02, 1.0, 1.0, .97, .90, .90, 1.02, 1.05, 1.06, .92])
WKF = np.array([1.07, 1.08, 1.08, 1.06, 1.0, .86, .85])
RET_N = [1, 3, 7, 14, 30, 60, 90]
RET_BASE = dict(zip(RET_N, [.60, .43, .295, .225, .148, .105, .088]))
EXP_K = np.r_[1.0, 1.06, 1.10, 1.10 * 1.004 ** np.arange(1, 22)]       # revenue expansion index by month offset

# story anchors (ADR-0015 (d); the figures the default window must show)
IMP_W, CLICKS_W, CLICKS_P = 14_203_417, 223_014, 221_003
SESS_W, INST_W, SU_W, SU_P, ACT_W, TRIALS_W, TRIALS_P = 114_812, 21_704, 6_980, 6_452, 2_860, 3_220, 2_757
MRR_W, MRR_P, PAID_P = 61_900.00, 59_850.00, 444
LAL2_PAID_W, LAL2_T_A, LAL2_T_Z = 30.89, 125, 171
MPS_BEFORE, MPS_AFTER, EPS_FLAT = .165, .098, .0100
APP_CVR = dict(W=.3112, P=.3098, H=.3100); PLAY_CVR = dict(W=.2716, P=.2794, H=.2810)
UAC_RATE = dict(before=.140, after=.115)


def LN(rng, sd, size): return np.exp(rng.normal(0, sd, size))


# ---- integer allocation (largest remainder inside each group) --------------------------------------------------------------
def alloc(g, w, tot):
    g = np.asarray(g, np.int64); w = np.asarray(w, float); tot = np.asarray(tot, np.int64); n = len(tot)
    sw = np.bincount(g, w, minlength=n)
    assert (tot >= 0).all() and not ((tot > 0) & (sw <= 0)).any(), 'a positive total has no weight'
    q = np.zeros(len(g)); ok = sw[g] > 0
    q[ok] = tot[g][ok] * (w[ok] / sw[g][ok])
    x = np.floor(q).astype(np.int64)
    k = tot - np.rint(np.bincount(g, x, minlength=n)).astype(np.int64)
    rem = np.where(w > 0, q - x, -1.0)
    o = np.lexsort((np.arange(len(g)), -rem, g)); gs = g[o]
    first = np.r_[True, gs[1:] != gs[:-1]] if len(g) else np.zeros(0, bool)
    rank = np.arange(len(g)) - np.maximum.accumulate(np.where(first, np.arange(len(g)), 0))
    x[o[rank < k[gs]]] += 1
    assert (x >= 0).all() and (np.rint(np.bincount(g, x, minlength=n)).astype(np.int64) == tot).all()
    return x


def alloc_capped(g, w, tot, cap):
    x = alloc(g, w, tot)
    if cap is None: return x
    cap = np.asarray(cap, np.int64); n = len(tot)
    assert (np.rint(np.bincount(g, cap, minlength=n)) >= tot).all(), 'a group total is above its cap'
    for _ in range(200):
        over = np.maximum(x - cap, 0)
        if not over.any(): return x
        x = x - over
        ex = np.rint(np.bincount(g, over, minlength=n)).astype(np.int64)
        x = x + alloc(g, np.where(cap - x > 0, np.maximum(w, 1e-9), 0.0), ex)
    raise RuntimeError('alloc_capped did not converge')


def fix_lower(x, lo, g, n):
    """raise x to lo per cell, taking the deficit from cells of the same group that sit above lo (totals kept)"""
    for _ in range(200):
        d = np.maximum(lo - x, 0)
        if not d.any(): return x
        x = x + d
        need = np.rint(np.bincount(g, d, minlength=n)).astype(np.int64)
        x = x - alloc(g, np.maximum(x - lo, 0).astype(float), need)
    raise RuntimeError('fix_lower did not converge')


def bsum(E): return np.stack([E[:, m].sum(1) for m in BM], 1)


def gm(cs, blocks):
    m = np.zeros((NC, NBK), bool); m[np.ix_(list(cs), list(blocks))] = True; return m


def stage(E, groups=(), cap=None, ramp=True):
    """Integer campaign x day values from expected E: campaign-block totals = rint(E) unless a group fixes them
    (group total split over its campaign-blocks by E); history ramps into the previous-period level over 75 days."""
    E = np.where(ACT, np.maximum(E, 0.0), 0.0)
    if cap is not None: E = np.where(cap > 0, E, 0.0)
    EB = bsum(E); T = np.rint(EB).astype(np.int64)
    capB = None if cap is None else bsum(cap.astype(float)).astype(np.int64)
    if capB is not None: T = np.minimum(T, capB)
    for m, tot in groups:
        T[m] = alloc_capped(np.zeros(int(m.sum()), np.int64), EB[m], [int(tot)], None if capB is None else capB[m])
    if ramp:
        f = np.clip(np.divide(T[:, PB], EB[:, PB], out=np.ones(NC), where=EB[:, PB] > 0), .6, 1.6)
        r = np.clip((np.arange(ND) - (iP0 - 75)) / 75, 0, 1); r[iP0:] = 0
        E = E * f[:, None] ** r[None, :]
        T[:, :PB] = np.rint(bsum(E)[:, :PB])
    if cap is not None: T[:, :PB] = np.minimum(T[:, :PB], capB[:, :PB])
    g = (np.arange(NC)[:, None] * NBK + BLK[None, :]).ravel()
    return alloc_capped(g, E.ravel(), T.ravel(), None if cap is None else cap.ravel()).reshape(NC, ND)


def ras(E, r, c, it=3000):
    X = E.astype(float).copy()
    for _ in range(it):
        rs = X.sum(1); X *= np.divide(r, rs, out=np.zeros_like(r), where=rs > 0)[:, None]
        cs = X.sum(0); X *= np.divide(c, cs, out=np.zeros_like(c), where=cs > 0)[None, :]
    assert np.abs(X.sum(1) - r).max() < 1e-6 and np.abs(X.sum(0) - c).max() < 1e-6, 'RAS did not converge'
    return X


def day_split(D_t, W, unit=10_000):
    """split integer day totals D_t (ALL) over campaigns by weights W (NC x nd) in 1e-4 credits; day sums stay exact"""
    nd = W.shape[1]; g = np.repeat(np.arange(nd)[None, :], NC, 0).ravel()
    return alloc(g, W.ravel(), np.rint(np.asarray(D_t) * unit).astype(np.int64)).reshape(NC, nd)


def bisect(fn, lo, hi, n=80):
    """root of a monotone fn on [lo, hi] (either direction); fails if the bracket holds no sign change"""
    flo, fhi = fn(lo), fn(hi)
    assert (flo > 0) != (fhi > 0), f'no root in [{lo}, {hi}]: {flo}, {fhi}'
    for _ in range(n):
        mid = (lo + hi) / 2
        if (fn(mid) > 0) == (flo > 0): lo = mid
        else: hi = mid
    return (lo + hi) / 2


# ---- campaigns, creatives, ad sets, terms -------------------------------------------------------------------------------------
def active():
    A = np.zeros((NC, ND), bool)
    for c, r in enumerate(CAMPS):
        e = PAUSED_LAST.get(r[0], r[11] or AS_OF)
        A[c] = (DAY >= np.datetime64(r[10])) & (DAY <= np.datetime64(e))
    return A


ACT = active()
WEBC = [c for c in range(NC) if PLAT[c] == 'WEB']; MOBC = [c for c in range(NC) if PLAT[c] != 'WEB']
IOSC = [c for c in range(NC) if PLAT[c] == 'IOS']; ANDC = [c for c in range(NC) if PLAT[c] == 'ANDROID']
ALLC = list(range(NC))

LAL2_CR = [('Dashboard in 60s · v1', 'VIDEO', '2025-07-01', '2026-01-31', None), ('Dashboard in 60s · v2', 'VIDEO', '2025-12-15', '2026-09-30', None),
           ('Dashboard in 60s · v3', 'VIDEO', '2026-09-15', None, (.0182, -.464, 3.40)), ('Spreadsheet pain · v2', 'VIDEO', '2026-03-02', None, (.0121, -.12, 2.6)),
           ('Customer quote · Nova', 'STATIC', '2026-05-11', None, (.0231, .08, 1.9)), ('Founder talking head', 'UGC', '2026-02-02', None, (.0097, -.31, 3.1)),
           ('Before / after chart', 'STATIC', '2026-06-15', None, (.0164, .02, 2.2)), ('Static · pricing', 'STATIC', '2025-10-06', None, (.0088, -.05, 2.8)),
           ('UGC · onboarding', 'UGC', '2026-08-03', None, (.0205, .19, 1.4)), ('Carousel · integrations', 'CAROUSEL', '2026-04-06', None, (.0142, -.09, 2.5))]
CR_POOL = dict(
    PAID_SEARCH=['RSA · brand core', 'RSA · pricing', 'RSA · free trial', 'RSA · integrations', 'RSA · security', 'RSA · templates', 'RSA · teams',
                 'RSA · reviews', 'RSA · speed', 'RSA · comparison', 'RSA · promo', 'RSA · SMB'],
    PAID_SOCIAL=['Spreadsheet pain · v1', 'Customer quote · Orbit', 'Dashboard in 60s · cut', 'Founder Q&A', 'Before / after report', 'Static · free trial',
                 'UGC · first dashboard', 'Carousel · templates', 'Demo walk-through', 'Team rollout story', 'Static · integrations', 'UGC · analyst day'],
    APP_INSTALL=['App preview · 30s', 'Screens · KPI widgets', 'Static · rating 4.8', 'App preview · 15s', 'Screens · alerts', 'Static · offline mode',
                 'Video · onboarding', 'Screens · dark mode', 'Static · widgets', 'Video · teams', 'Static · free', 'Screens · iPad'],
    DISPLAY_VIDEO=['Product demo · 60s', 'Product demo · 15s', 'Bumper · 6s', 'Customer story · 30s', 'Banner · trial', 'Banner · integrations',
                   'Native · guide', 'Banner · pricing', 'Video · templates', 'Banner · reviews', 'Native · webinar', 'Video · security'],
    RETARGETING=['Come back · trial', 'Finish setup', 'Your dashboard is waiting', 'Static · discount', 'Carousel · features', 'Testimonial',
                 'Static · templates', 'Video · tips', 'Static · support', 'Carousel · integrations', 'Static · teams', 'Video · quick win'],
    AFFILIATES=['Review badge', 'Comparison table', 'Deal · 20% off', 'Listing · screenshots', 'Text · editor pick', 'Banner · trial', 'Text · top 10',
                'Banner · reviews', 'Text · alternatives', 'Listing · video', 'Banner · free', 'Text · pricing'])
ADSETS = dict(
    SRCH_NONBRAND_ANALYTICS=(['Exact · analytics', 'Phrase · dashboards', 'Exact · BI tools', 'Broad · reporting', 'Competitor terms'], 'KEYWORD'),
    SOC_META_LAL2=(['LAL 2% · US', 'LAL 2% · CA + UK', 'LAL 2% · trial starters', 'LAL 2% · engaged visitors', 'LAL 2% · Advantage+'], 'LOOKALIKE'),
    SRCH_BRAND_GLOBAL=(['Exact · brand', 'Phrase · brand', 'Brand + product', 'Brand · competitors'], 'KEYWORD'),
    SRCH_BRAND_DEFR=(['Exact · brand DE', 'Exact · brand FR', 'Brand + product', 'Phrase · brand'], 'KEYWORD'),
    SRCH_MSFT_NONBRAND=(['Exact · core', 'Phrase · dashboards', 'Broad · analytics', 'Competitor terms'], 'KEYWORD'),
    SRCH_SUMMER_PROMO=(['Exact · promo', 'Phrase · deal', 'Broad · discount', 'Competitor terms'], 'KEYWORD'),
    SOC_META_INTERESTS=(['Interests · data', 'Interests · SaaS tools', 'Interests · spreadsheets', 'Broad · Advantage+'], 'INTEREST'),
    SOC_META_LAL1=(['LAL 1% · US', 'LAL 1% · trial starters', 'LAL 1% · payers', 'LAL 1% · Advantage+'], 'LOOKALIKE'),
    SOC_LINKEDIN_ABM=(['ABM · tier 1 accounts', 'ABM · tier 2 accounts', 'Job titles · data', 'Company size 200-1000'], 'AUDIENCE'),
    SOC_LINKEDIN_WEBINAR=(['Registrants LAL', 'Data leaders EMEA', 'Company list', 'Retarget site'], 'AUDIENCE'),
    SOC_TIKTOK_CREATOR=(['Creators · how-to', 'Creators · reviews', 'Broad · 25-44', 'Interests · business'], 'INTEREST'),
    APP_ASA_CORE=(['Exact · brand', 'Category · analytics', 'Discovery · broad', 'Competitor'], 'KEYWORD'),
    APP_UAC_ANDROID=(['Installs · tCPI', 'Installs · tCPA sign-up', 'Re-engagement', 'New markets'], 'PLACEMENT'),
    DV_YOUTUBE_DEMO=(['In-market · BI software', 'Custom intent · dashboards', 'Affinity · tech', 'Shorts · broad'], 'CONTEXTUAL'),
    DV_DV360_DISPLAY=(['In-market · BI', 'Contextual · business', 'Programmatic guaranteed', 'Open exchange'], 'CONTEXTUAL'),
    RT_TRIAL_ABANDON=(['Trial abandon · 7 d', 'Trial abandon · 30 d', 'Pricing visitors', 'Signup started'], 'AUDIENCE'),
    RT_APP_REENGAGE=(['Dormant installs · 14 d', 'Dormant installs · 30 d', 'No dashboard yet', 'Lapsed trials'], 'AUDIENCE'),
    RT_META_RETENTION=(['Churn-risk · low usage', 'Churn-risk · seat drop', 'Win-back · 30 d', 'Win-back · 60 d'], 'AUDIENCE'),
    AFF_REVIEW_SITES=(['Review sites · tier 1', 'Review sites · tier 2', 'Comparison blogs', 'Newsletters'], 'PLACEMENT'))
META_PL = ['Instagram Reels', 'Instagram Feed', 'Instagram Stories', 'Facebook Feed', 'Facebook Reels', 'Audience Network', 'Messenger', 'Threads']
TERMS = dict(  # (type, [(text, match), ...]); NB carries the mockup keyword CPC / CVR shape
    SRCH_BRAND_GLOBAL=('KEYWORD', [('acme', 'EXACT'), ('acme analytics', 'EXACT'), ('acme login', 'EXACT'), ('acme pricing', 'PHRASE'), ('acme dashboard', 'PHRASE'),
                                   ('acme bi', 'EXACT'), ('acme reviews', 'PHRASE'), ('acme app', 'BROAD')]),
    SRCH_NONBRAND_ANALYTICS=('KEYWORD', [('analytics dashboard', 'EXACT'), ('bi tool for startups', 'PHRASE'), ('looker alternative', 'EXACT'),
                                         ('excel reports automate', 'BROAD'), ('data visualization software', 'PHRASE'), ('kpi dashboard tool', 'PHRASE'),
                                         ('saas reporting tool', 'BROAD'), ('self-serve bi', 'EXACT')]),
    SRCH_MSFT_NONBRAND=('KEYWORD', [('business intelligence software', 'PHRASE'), ('dashboard tool', 'BROAD'), ('analytics for small business', 'PHRASE'),
                                    ('power bi alternative', 'EXACT'), ('reporting dashboard', 'PHRASE'), ('kpi software', 'BROAD'), ('data dashboard online', 'BROAD'),
                                    ('tableau alternative', 'EXACT')]),
    SRCH_BRAND_DEFR=('KEYWORD', [('acme de', 'EXACT'), ('acme fr', 'EXACT'), ('acme analytics deutsch', 'PHRASE'), ('acme tableau de bord', 'PHRASE'),
                                 ('acme preise', 'EXACT'), ('acme tarifs', 'EXACT'), ('acme login', 'EXACT'), ('acme bi', 'EXACT')]),
    SRCH_SUMMER_PROMO=('KEYWORD', [('summer analytics deal', 'PHRASE'), ('dashboard discount', 'BROAD'), ('bi tool sale', 'BROAD'), ('analytics trial', 'PHRASE'),
                                   ('acme promo', 'EXACT'), ('reporting tool offer', 'BROAD'), ('kpi dashboard free', 'PHRASE'), ('dashboard template', 'BROAD')]),
    APP_ASA_CORE=('KEYWORD', [('acme', 'EXACT'), ('analytics app', 'EXACT'), ('dashboard app', 'EXACT'), ('kpi tracker', 'BROAD'), ('business dashboard', 'BROAD'),
                              ('data app', 'BROAD'), ('bi app', 'EXACT'), ('metrics app', 'BROAD')]),
    SOC_META_LAL2=('PLACEMENT', META_PL), SOC_META_LAL1=('PLACEMENT', META_PL), SOC_META_INTERESTS=('PLACEMENT', META_PL),
    RT_APP_REENGAGE=('PLACEMENT', META_PL), RT_META_RETENTION=('PLACEMENT', META_PL),
    SOC_TIKTOK_CREATOR=('PLACEMENT', ['For You feed', 'TikTok Search', 'Pangle', 'Following feed', 'Creator Marketplace', 'TopView', 'Spark Ads', 'Lemon8']),
    SOC_LINKEDIN_ABM=('AUDIENCE', ['Data analysts · US', 'Analytics managers', 'Heads of data', 'BI developers', 'Finance ops', 'RevOps leads', 'Product analysts', 'CTO · SMB']),
    SOC_LINKEDIN_WEBINAR=('AUDIENCE', ['Registrants lookalike', 'Data leaders · EMEA', 'BI managers · DACH', 'Analytics · France', 'Finance · UK', 'Ops · Nordics',
                                       'Event followers', 'Company list · ABM']),
    APP_UAC_ANDROID=('PLACEMENT', ['Google Play', 'YouTube', 'Google Search', 'Discover', 'Display network', 'Gmail', 'AdMob apps', 'Play games']),
    DV_YOUTUBE_DEMO=('PLACEMENT', ['YouTube in-stream', 'YouTube in-feed', 'YouTube Shorts', 'Google video partners', 'YouTube masthead', 'YouTube bumper',
                                   'YouTube on TV', 'Discover video']),
    DV_DV360_DISPLAY=('PLACEMENT', ['News sites', 'Tech blogs', 'Business publishers', 'Finance portals', 'CTV apps', 'Native placements', 'App inventory', 'Sports sites']),
    RT_TRIAL_ABANDON=('AUDIENCE', ['Trial abandon · 7 d', 'Trial abandon · 14 d', 'Pricing visitors', 'Signup started', 'Demo no-show', 'Docs readers', 'Blog readers',
                                   'Past trial']),
    AFF_REVIEW_SITES=('PLACEMENT', ['G2 listing', 'Capterra', 'TrustRadius', 'Software Advice', 'GetApp', 'Comparison blogs', 'YouTube reviewers', 'Newsletter partners']))
NB_TERM = dict(cpc=[1.42, 2.10, 3.85, .96, 2.30, 1.80, 1.50, 1.60], cvr=[.061, .048, .072, .019, .011, .040, .030, .035])
PAGES = [('LP_PRICING', '/pricing', 'WEB', 'WEB', .41, 1900, 1.6), ('LP_HOME', '/ (home)', 'WEB', 'WEB', .55, 2400, .85),
         ('LP_ANALYTICS', '/analytics-dashboard', 'WEB', 'WEB', .38, 1700, 1.4), ('LP_VS_LOOKER', '/vs/looker', 'WEB', 'WEB', .33, 2100, 1.9),
         ('LP_SIGNUP', '/signup', 'WEB', 'WEB', .25, 1500, 2.5), ('LP_DEMO', '/demo', 'WEB', 'WEB', .35, 1800, 1.5),
         ('LP_APP_STORE', 'App Store page', 'APP_STORE', 'IOS', None, None, None), ('LP_PLAY_STORE', 'Google Play page', 'PLAY_STORE', 'ANDROID', None, None, None)]
PAGE_MIX = dict(SRCH_BRAND_GLOBAL={'LP_HOME': .55, 'LP_PRICING': .30, 'LP_SIGNUP': .15}, SRCH_NONBRAND_ANALYTICS={'LP_ANALYTICS': .45, 'LP_PRICING': .30, 'LP_VS_LOOKER': .15, 'LP_HOME': .10},
                SRCH_MSFT_NONBRAND={'LP_ANALYTICS': .5, 'LP_PRICING': .3, 'LP_HOME': .2}, SRCH_BRAND_DEFR={'LP_HOME': .7, 'LP_PRICING': .3},
                SRCH_SUMMER_PROMO={'LP_PRICING': .6, 'LP_HOME': .4}, SOC_LINKEDIN_ABM={'LP_DEMO': .7, 'LP_PRICING': .3},
                SOC_LINKEDIN_WEBINAR={'LP_DEMO': .6, 'LP_HOME': .4}, DV_YOUTUBE_DEMO={'LP_HOME': .5, 'LP_ANALYTICS': .5},
                DV_DV360_DISPLAY={'LP_HOME': .6, 'LP_PRICING': .4}, RT_TRIAL_ABANDON={'LP_SIGNUP': .6, 'LP_PRICING': .4},
                AFF_REVIEW_SITES={'LP_VS_LOOKER': .5, 'LP_PRICING': .5})


def fmt_of(name, ch):
    if ch == 'PAID_SEARCH': return 'TEXT'
    for key, f in (('UGC', 'UGC'), ('Carousel', 'CAROUSEL'), ('Static', 'STATIC'), ('Banner', 'STATIC'), ('Screens', 'STATIC'), ('Listing', 'STATIC'),
                   ('Review badge', 'STATIC'), ('Text', 'TEXT'), ('Comparison table', 'TEXT'), ('Deal', 'TEXT')):
        if key in name: return f
    return 'VIDEO'


def build_creatives(rng):
    rows = []                                     # creative_key, c, name, format, launch, retire (inclusive, actual days), ad set idx, strength, ctr factor, story
    for c, r in enumerate(CAMPS):
        k, ch = r[0], r[2]
        e0 = np.datetime64(PAUSED_LAST.get(k, r[11] or AS_OF))
        s0 = np.datetime64(r[10]); s_eff = max(s0, DAY[0])
        if k == 'SOC_META_LAL2':
            for j, (nm, f, a, b, st) in enumerate(LAL2_CR):
                rows.append((f'{k}-CR{j + 1:02d}', c, nm, f, np.datetime64(a), np.datetime64(b) if b else e0, j % 5, 1.0, 1.0, st))
            continue
        n = dict(SOC_META_LAL1=10, SRCH_SUMMER_PROMO=6, SOC_LINKEDIN_WEBINAR=5, RT_META_RETENTION=6).get(k, 12)
        s = min(n - 3, 9) if n > 6 else n - 1
        pool = CR_POOL[ch]; off = rng.integers(0, 12)
        nas = len(ADSETS[k][0])
        launch = [s0 + np.timedelta64(int(10 * j), 'D') if s0 >= DAY[0] else s0 + np.timedelta64(int(rng.integers(0, 120)), 'D') for j in range(s)]
        retire = [e0] * s
        span = int((e0 - s_eff).astype(int))
        for j in range(s, n):
            t = s_eff + np.timedelta64(int(span * (j - s + 1) / (n - s + 1)), 'D')
            launch.append(t); retire.append(e0); retire[j - s] = t - np.timedelta64(1, 'D')
        for j in range(n):
            nm = pool[(j + off) % len(pool)]
            rows.append((f'{k}-CR{j + 1:02d}', c, nm, fmt_of(nm, ch), launch[j], retire[j], j % nas, float(LN(rng, .35, 1)[0]), float(LN(rng, .15, 1)[0]), None))
    return rows


# ---- the build -----------------------------------------------------------------------------------------------------------------
def build(rng):
    G = {}
    # spend (cents) --------------------------------------------------------------------------------------------------------------
    lvl = np.exp(np.log(1.62) * np.arange(ND) / ix('2026-09-20'))
    s_all = lvl * SEASON[MO - 1] * np.where((MO == 12) & (DOM >= 20), .80, 1.0) * WKF[WDAY] * LN(rng, .035, ND)
    w = np.zeros((NC, ND)); t_ = np.arange(ND)
    for c in range(NC):
        k = KEYS[c]
        base = np.full(ND, D['spP'][c] / 176_100)
        if k == 'SOC_META_LAL2': base = np.interp(t_, [ix('2025-07-01'), ix('2026-09-27')], [.045, .070]); base[ix('2026-09-28'):] *= 1.40
        elif k == 'SOC_META_LAL1': base = np.interp(t_, [0, ix('2025-09-30'), ix('2025-12-31')], [.075, .075, .030])
        elif k == 'SRCH_SUMMER_PROMO': base[:] = .055
        elif k == 'SOC_TIKTOK_CREATOR': base = np.interp(t_, [ix('2026-06-01'), ix('2026-09-30')], [.030, .042])
        elif k == 'RT_META_RETENTION': base[:] = 2_500 / 176_100 * 30 / 26
        elif k == 'SOC_LINKEDIN_WEBINAR': base[:] = .035
        s0 = np.datetime64(CAMPS[c][10])
        ramp_in = np.clip(.35 + .65 * (t_ - ix(CAMPS[c][10])) / 21, 0, 1) if s0 >= DAY[0] else 1.0
        per, ph = rng.uniform(120, 300), rng.uniform(0, 300)
        w[c] = np.where(ACT[c], base * ramp_in * np.exp(.09 * np.sin(2 * np.pi * (t_ + ph) / per)), 0.0)
    S = s_all * w / w.sum(0)
    S *= 176_100 / S[:, PD].sum()
    S[:, iB:] *= np.where(CHN == 'PAID_SOCIAL', 1.12, 1.06)[:, None]          # spend step from Oct 18 (shape inside the window only)
    spW = np.rint(D['spW'] * 100).astype(np.int64); spP = np.rint(D['spP'] * 100).astype(np.int64)
    off = rng.integers(-3500, 3501, NC); off[L] = 0
    for ch, *_ in CHANNELS:                          # zero-sum per channel x platform: channel, platform and brand totals stay exact
        for p in ('WEB', 'IOS', 'ANDROID'):
            idx = [c for c in range(NC) if CHN[c] == ch and PLAT[c] == p and spW[c] > 0 and c != L]
            if len(idx) < 2: off[idx] = 0
            else: off[idx[-1]] -= off[idx].sum()
    spW = np.where(spW > 0, spW + off, 0)
    offp = rng.integers(-3000, 3001, NC); idx = [c for c in range(NC) if spP[c] > 0 and c != L]; offp[[c for c in range(NC) if c not in idx]] = 0
    offp[idx[0]] -= offp[idx].sum(); spP = np.where(spP > 0, spP + offp, 0)
    groups = [(gm([c], WBL), spW[c]) for c in range(NC) if spW[c] > 0] + [(gm([c], [PB]), spP[c]) for c in range(NC) if spP[c] > 0]
    spend = stage(S * 100, groups)
    G['spend'] = spend
    assert spend[:, WD].sum() == 18_840_000 and spend[:, PD].sum() == 17_610_000

    # creatives and impressions ------------------------------------------------------------------------------------------------------
    CR = build_creatives(rng); G['CR'] = CR
    cpm = D['cpm'][:, None] * (.86 + .14 * PROG)[None, :] * np.where(MO >= 10, 1.07, 1.0)[None, :] * LN(rng, .06, (NC, ND))
    cpm[L, iB:] *= 1.12
    imp = stage(spend / 100 / cpm * 1000, [(gm(ALLC, WBL), IMP_W)])
    rc, rt, rj = [], [], []
    for j, cr in enumerate(CR):
        c = cr[1]; a, b = max(0, ix(str(cr[4]))) if cr[4] >= DAY[0] else 0, min(ND - 1, ix(str(cr[5])))
        tt = np.arange(a, b + 1); tt = tt[ACT[c, tt]]
        rc.append(np.full(tt.size, c)); rt.append(tt); rj.append(np.full(tt.size, j))
    rc, rt, rj = np.concatenate(rc), np.concatenate(rt), np.concatenate(rj)
    o = np.lexsort((rt, rj)); rc, rt, rj = rc[o], rt[o], rj[o]
    cell = rc * ND + rt
    assert np.isin(np.flatnonzero(ACT.ravel()), cell).all(), 'an active campaign-day has no creative'
    launch_i = np.array([ix(str(cr[4])) if cr[4] >= DAY[0] else -400 for cr in CR])
    strength = np.array([cr[7] for cr in CR]); ctrf = np.array([cr[8] for cr in CR])
    age = rt - launch_i[rj]
    wimp = strength[rj] * np.clip(.4 + .6 * age / 10, .4, 1) * LN(rng, .06, rj.size)
    lal2_j = [j for j, cr in enumerate(CR) if cr[1] == L]; v3 = lal2_j[2]
    inW = (rc == L) & (rt >= iW0)
    s3 = np.where(rt < iB, .90, np.where(rt < iC, .93, .975))
    oth = inW & (rj != v3)
    osum = np.bincount(rt[oth], strength[rj[oth]], minlength=ND)
    wimp = np.where(inW & (rj == v3), s3, wimp)
    wimp = np.where(oth, (1 - s3) * strength[rj] / np.maximum(osum[rt], 1e-9), wimp)
    ucell, cinv = np.unique(cell, return_inverse=True)
    imp_r = alloc(cinv, wimp, imp.ravel()[ucell])
    # LAL2 creative-level clicks in the window: v3 CTR 1.82 % in the last 7 days, slope -46.4 % vs the 7 days before (A-44)
    clk_r = np.zeros(rj.size, np.int64)
    blocks = [(iW0, iC), (iC, iE), (iE, ND)]
    for j in lal2_j:
        st = CR[j][9]
        if st is None: continue
        ctr7, slope, _ = st
        ctr_cd = ctr7 / (1 + slope)
        ctrs = [.0352 if j == v3 else ctr_cd * 1.01, ctr_cd, ctr7]
        for (a, b), ct in zip(blocks, ctrs):
            m = (rj == j) & (rt >= a) & (rt < b)
            if not m.any(): continue
            tot = int(round(ct * imp_r[m].sum()))
            clk_r[m] = alloc_capped(np.zeros(m.sum(), np.int64), imp_r[m].astype(float), [tot], imp_r[m])
    clkL = np.bincount(rt[inW], clk_r[inW], minlength=ND).astype(np.int64)

    # clicks ------------------------------------------------------------------------------------------------------------------------
    ctr = D['ctr'][:, None] * (1.05 - .05 * PROG)[None, :] * LN(rng, .05, (NC, ND))
    ctr[:, iE:] *= (1 + D['slope'])[:, None]
    E_clk = imp * ctr
    sv_rate = D['c1']; cvr_W = np.where(PLAT == 'IOS', APP_CVR['W'], PLAY_CVR['W'])
    inst_L = (clkL[WD] * sv_rate[L] * APP_CVR['W']).sum()
    mo = [c for c in MOBC if c != L]
    e_mo = E_clk[mo][:, WD].sum(1); q_mo = sv_rate[mo] * cvr_W[mo]
    M_o = int(round((INST_W - inst_L) / ((e_mo * q_mo).sum() / e_mo.sum())))
    LW = int(clkL[WD].sum())
    groups = [(gm([L], [b]), int(clkL[BLK == b].sum())) for b in WBL] + [(gm(mo, WBL), M_o), (gm(WEBC, WBL), CLICKS_W - LW - M_o),
                                                                           (gm(ALLC, [PB]), CLICKS_P)]
    clk = stage(E_clk, groups, cap=imp)
    clk[L, WD] = clkL[WD]
    assert clk[:, WD].sum() == CLICKS_W and (clk <= imp).all()
    rest = ~inW
    ur, gr = np.unique(cinv[rest], return_inverse=True)
    clk_r[rest] = alloc_capped(gr, (imp_r * ctrf[rj])[rest] + 1e-9, clk.ravel()[ucell[ur]], imp_r[rest])
    spend_r = alloc(cinv, imp_r + 1e-6, spend.ravel()[ucell])
    G.update(imp=imp, clk=clk, rc=rc, rt=rt, rj=rj, imp_r=imp_r, clk_r=clk_r, spend_r=spend_r, cinv=cinv, ucell=ucell)

    # web and mobile middle of the funnel ----------------------------------------------------------------------------------------------
    isweb = (PLAT == 'WEB')[:, None]
    sess = stage(np.where(isweb, clk * D['c1'][:, None] * LN(rng, .03, (NC, ND)), 0), [(gm(WEBC, WBL), SESS_W)], cap=clk)
    E_sv = np.where(~isweb, clk * D['c1'][:, None] * np.minimum(LN(rng, .01, (NC, ND)), 1.01), 0)
    e_i, e_a = E_sv[IOSC][:, WD].sum(), E_sv[ANDC][:, WD].sum()
    k_sv = INST_W / (APP_CVR['W'] * e_i + PLAY_CVR['W'] * e_a)
    sv = stage(E_sv, [(gm(IOSC, WBL), int(round(k_sv * e_i))), (gm(ANDC, WBL), int(round(k_sv * e_a)))], cap=clk)
    cvr = np.where((PLAT == 'IOS')[:, None], APP_CVR['H'], PLAY_CVR['H']) * np.ones((1, ND))
    cvr[:, PD] = np.where(PLAT == 'IOS', APP_CVR['P'], PLAY_CVR['P'])[:, None]; cvr[:, WD] = cvr_W[:, None]
    svi_W, sva_W = sv[IOSC][:, WD].sum(), sv[ANDC][:, WD].sum(); svi_P, sva_P = sv[IOSC][:, PD].sum(), sv[ANDC][:, PD].sum()
    ii_W = int(round(APP_CVR['W'] * svi_W))
    inst = stage(np.where(~isweb, sv * cvr * LN(rng, .03, (NC, ND)), 0),
                 [(gm(IOSC, WBL), ii_W), (gm(ANDC, WBL), INST_W - ii_W), (gm(IOSC, [PB]), int(round(APP_CVR['P'] * svi_P))),
                  (gm(ANDC, [PB]), int(round(PLAY_CVR['P'] * sva_P)))], cap=sv)
    fo = stage(np.where(~isweb, inst * .93 * np.minimum(LN(rng, .02, (NC, ND)), 1.07), 0), cap=inst)
    # sign-ups: UAC 14.0 % -> 11.5 % from Oct 22 (A-64), searched so every display of the thread holds at 1 dp
    i_abc, i_d, i_e, i_p = (int(inst[UAC, m].sum()) for m in (np.isin(BLK, [22, 23, 24]), BLK == 25, BLK == 26, PD))
    best = None
    b0 = [round(.140 * i_abc), round(.115 * i_d), round(.115 * i_e), round(.140 * i_p)]
    for da in range(-3, 4):
        for dd in range(-3, 4):
            for de in range(-3, 4):
                for dp in range(-3, 4):
                    sa, sd, se, sp = b0[0] + da, b0[1] + dd, b0[2] + de, b0[3] + dp
                    rb, ra, r7, rp = sa / i_abc, (sd + se) / (i_d + i_e), se / i_e, sp / i_p
                    ok = (f'{rb * 100:.1f}' == '14.0' and f'{ra * 100:.1f}' == '11.5' and f'{rp * 100:.1f}' == '14.0' and f'{(r7 - rp) * 100:.1f}' == '-2.5')
                    sc = abs(rb - .14) + abs(ra - .115) + abs(rp - .14) + abs(r7 - rp + .025) + abs(r7 - .115)
                    if ok and (best is None or sc < best[0]): best = (sc, sa, sd, se, sp)
    assert best, 'no UAC sign-up split satisfies the 14.0 % -> 11.5 % thread'
    _, uA, uD, uE, uP = best
    isu = D['c2'][:, None] * np.ones((1, ND)); isu[UAC, iD:] *= UAC_RATE['after'] / UAC_RATE['before']
    E_su = np.where(isweb, sess * D['c2'][:, None] * (1.03 - .03 * PROG)[None, :], inst * isu) * LN(rng, .07, (NC, ND))
    mob_su = int(round(.158 * INST_W)); mo_u = [c for c in MOBC if c != UAC]; ac = [c for c in ALLC if c != UAC]
    su = stage(E_su, [(gm([UAC], [22, 23, 24]), uA), (gm([UAC], [25]), uD), (gm([UAC], [26]), uE), (gm(mo_u, WBL), mob_su - uA - uD - uE),
                      (gm(WEBC, WBL), SU_W - mob_su), (gm([UAC], [PB]), uP), (gm(ac, [PB]), SU_P - uP)],
               cap=np.where(isweb, sess, fo))
    G.update(sess=sess, sv=sv, inst=inst, fo=fo, su=su)

    # activated (7 days, observed as of the as-of day) + segment design (A-47) ---------------------------------------------------------------
    S_w, S_i, S_a = (int(su[cs][:, WD].sum()) for cs in (WEBC, IOSC, ANDC))
    si18 = int(round(.52 * S_i)); sa15 = int(round(.55 * S_a))
    A_i = int(round(.47 * si18) + round(.44 * (S_i - si18))); A_a = int(round(.39 * sa15) + round(.29 * (S_a - sa15)))
    A_w = ACT_W - A_i - A_a
    swd = int(round((A_w - .38 * S_w) / .08)); assert .25 < swd / S_w < .75, swd / S_w
    SEG = dict(WEB=(swd, int(round(.46 * swd)), A_w), IOS=(si18, int(round(.47 * si18)), A_i), ANDROID=(sa15, int(round(.39 * sa15)), A_a))
    act_rate = np.array([ACT_BASE[p] for p in PLAT])[:, None] * D['actf'][:, None] * (1.02 - .02 * PROG)[None, :]
    act = stage(su * act_rate * COMP7[None, :] * LN(rng, .05, (NC, ND)), [(gm(WEBC, WBL), A_w), (gm(IOSC, WBL), A_i), (gm(ANDC, WBL), A_a)], cap=su)
    VER, WSP, CON, INV = (int(round(p * SU_W)) for p in (.88, .81, .52, .23))
    e1 = stage(su * .16 * COMP7[None, :], [(gm(ALLC, WBL), CON - ACT_W)], cap=su - act)
    e2 = stage(su * .29, [(gm(ALLC, WBL), WSP - CON)], cap=su - act - e1)
    e3 = stage(su * .07, [(gm(ALLC, WBL), VER - WSP)], cap=su - act - e1 - e2)
    inv = stage(act * .56 * LN(rng, .05, (NC, ND)), [(gm(ALLC, WBL), INV)], cap=act)
    G.update(act=act, con=act + e1, wsp=act + e1 + e2, ver=act + e1 + e2 + e3, inv=inv, SEG=SEG)

    # activation timing bins (J3), 6-24 h vs 1-2 d share tuned so the window median is 26 h ---------------------------------------------------
    nz = np.flatnonzero(act.ravel()); tt = nz % ND
    g6 = np.repeat(np.arange(nz.size), 6)
    n7 = LN(rng, .05, nz.size); noise6 = LN(rng, .05, (nz.size, 6))
    mids = np.array([.5, 2.45, 12.0, 33.9, 67.9, 129.6, 347.0])

    def bins_for(lam):                                # shares tilted toward later bins by mids ** lam
        s = S7 * mids ** lam; s /= s.sum()
        x = alloc(g6, (s[:6][None, :] * OBS[:6, tt].T * noise6).ravel(), act.ravel()[nz]).reshape(-1, 6)
        a7 = np.rint(act.ravel()[nz] / np.maximum(COMP7[tt], .05) * s[6] / s[:6].sum() * OBS[6, tt] * n7).astype(np.int64)
        return x, a7

    def med_w(xa):
        x, a7 = xa; m = tt >= iW0; tot = np.r_[x[m].sum(0), a7[m].sum()].astype(float); cum = np.cumsum(tot) / tot.sum()
        i = int(np.searchsorted(cum, .5)); lo = cum[i - 1] if i else 0.0
        return EDGES[i] + (.5 - lo) / (cum[i] - lo) * (EDGES[i + 1] - EDGES[i])
    lam = bisect(lambda v: med_w(bins_for(v)) - 26.0, -.5, 1.5, 40)
    xb, a7 = bins_for(lam)
    BINS = np.zeros((7, NC * ND), np.int64); BINS[:6, nz] = xb.T; BINS[6, nz] = a7
    G['bins'] = BINS.reshape(7, NC, ND); G['median_w'] = med_w((xb, a7)); G['bin_tilt'] = lam

    # finance block: cohort draws, R90 of the Jul / Aug 2026 cohorts, MRR and paid targets of W and P ---------------------------------------
    NM = 23
    churn = .0285 * D['churn'][:, None, None] * np.r_[0, 1.2, 1.08, np.ones(NM - 3)][None, None, :] * LN(rng, .12, (NC, NM, NM))
    rho0 = .016 * LN(rng, .2, (NC, NM)); rho1 = .006 * LN(rng, .2, (NC, NM))
    cpa_h = np.where(D['cpa'] > 0, D['cpa'], 360) * .9
    sp_m = np.stack([spend[:, MI == m].sum(1) / 100 for m in range(NM)], 1)
    N0e = sp_m / cpa_h[:, None]; N0e[RET] = 0

    def counts(N0, ch):
        st = np.zeros((NC, NM, NM)); cu = np.zeros((NC, NM, NM)); en = np.zeros((NC, NM, NM))
        for m in range(NM):
            kmax = 21 - m if m <= 21 else 0
            st[:, m, 0] = N0[:, m]; en[:, m, 0] = N0[:, m]
            for k in range(1, kmax + 1):
                st[:, m, k] = en[:, m, k - 1]; cu[:, m, k] = st[:, m, k] * ch[:, m, k]; en[:, m, k] = st[:, m, k] - cu[:, m, k]
        return st, cu, en
    calm = np.arange(NM)[:, None] + np.arange(NM)[None, :]

    def q_churn(st, cu, cal):
        m = np.isin(calm, cal) & (np.arange(NM)[None, :] >= 1)
        return cu[:, m].sum() / st[:, m].sum()

    def scaled(f, cal):
        ch = churn.copy(); ch[:, np.isin(calm, cal)] *= f; return ch
    f1 = bisect(lambda f: q_churn(*counts(N0e, scaled(f, [18, 19, 20]))[:2], [18, 19, 20]) - .0272, .5, 1.5)
    churn = scaled(f1, [18, 19, 20])
    u = EXP_K[1] + (1 - churn[:, :, 1]) * EXP_K[2]                        # (rev1 + rev2) / rev0 per campaign x cohort month before scaling
    rev0e = N0e * D['arpa'][:, None]

    def r90eff(m, kk):
        has = rev0e[:, m] > 0; out = np.zeros(NC)
        allv = 1 + kk * (rev0e[has, m] * u[has, m]).sum() / rev0e[has, m].sum()
        for c in range(NC):
            if has[c]: out[c] = 1 + kk * u[c, m]; continue
            peers = [x for x in range(NC) if CHN[x] == CHN[c] and has[x]]
            out[c] = 1 + kk * (rev0e[peers, m] * u[peers, m]).sum() / rev0e[peers, m].sum() if peers else allv
        return out
    spWd, spPd = spW / 100, spP / 100
    mrr_web_W, paid_web_W, mrr_web_P, paid_web_P = 9.25 * 110, 9.25, 1.0 * 110, 1.0

    def mrr_w(kk):
        R = r90eff(19, kk); M = np.zeros(NC)
        for ch, *_ in CHANNELS:
            cs = [c for c in range(NC) if CHN[c] == ch and spW[c] > 0]
            free = K[CH_FREE[ch]]
            for c in cs:
                if c == WEB: M[c] = mrr_web_W
                elif c != free: M[c] = D['roasW'][c] * spWd[c] / R[c]
            M[free] = (CH_ROAS[ch] * spWd[cs].sum() - sum(M[c] * R[c] for c in cs if c != free)) / R[free]
        return M, R
    kW = bisect(lambda kk: mrr_w(kk)[0].sum() - MRR_W, .5, 1.5)
    MW, RW = mrr_w(kW)
    MWc = np.rint(MW * 100).astype(np.int64); MWc[NB] += int(round(MRR_W * 100)) - MWc.sum()
    roasW = MWc / 100 * RW / np.maximum(spWd, 1e-9)
    roasP = D['roasP'].copy()
    for k_, dlt in MOVERS.items(): roasP[K[k_]] = roasW[K[k_]] - dlt

    def mrr_p(kk):
        R = r90eff(18, kk); M = np.where(spP > 0, roasP * spPd / R, 0.0); M[WEB] = mrr_web_P; M[RET] = 0.0; return M, R
    kP = bisect(lambda kk: mrr_p(kk)[0].sum() - MRR_P, .5, 1.5)
    MP, RP = mrr_p(kP)
    MPc = np.rint(MP * 100).astype(np.int64); MPc[NB] += int(round(MRR_P * 100)) - MPc.sum()
    ap = [c for c in range(NC) if spP[c] > 0 and c not in (WEB, RET)]
    a_ = (MPc[ap] / 100 / D['arpa'][ap]).sum() / (PAID_P - paid_web_P)
    paidP = np.zeros(NC); paidP[ap] = MPc[ap] / 100 / (D['arpa'][ap] * a_); paidP[WEB] = paid_web_P
    TLP = int(round(paidP[L] / .25)); paidP[L] = .25 * TLP; paidP[BG] += PAID_P - paidP.sum()
    G.update(churn=churn, rho0=rho0, rho1=rho1, kW=kW, kP=kP, f1=f1, MWc=MWc, MPc=MPc, roasW=roasW, roasP_t=roasP, paidP=paidP, RW=RW, RP=RP)

    # trials --------------------------------------------------------------------------------------------------------------------------
    nl = [c for c in ALLC if c != L]
    trials = stage(su * D['trial'][:, None] * LN(rng, .05, (NC, ND)),
                   [(gm([L], [22]), LAL2_T_A), (gm([L], [23, 24, 25, 26]), LAL2_T_Z), (gm(nl, WBL), TRIALS_W - LAL2_T_A - LAL2_T_Z),
                    (gm([L], [PB]), TLP), (gm(nl, [PB]), TRIALS_P - TLP)], cap=su)
    G['trials'] = trials

    # paid customers, DDA credits ---------------------------------------------------------------------------------------------------------
    A_ = BLK == 22; Z_ = np.isin(BLK, [23, 24, 25, 26])
    tA, tZ = trials[:, A_].sum(1).astype(float), trials[:, Z_].sum(1).astype(float)
    pW = np.zeros(NC); pA = np.zeros(NC); pZ = np.zeros(NC)
    for ch, *_ in CHANNELS:
        cs = [c for c in range(NC) if CHN[c] == ch and spW[c] > 0]
        if ch == 'PAID_SOCIAL': continue
        base = spWd[cs] / D['cpa'][cs]
        pW[cs] = base * CH_PAID[ch] / base.sum()
    mps_o = [INT, TT]
    pA[L] = MPS_BEFORE * tA[L]; pZ[L] = LAL2_PAID_W - pA[L]
    pA[mps_o] = MPS_BEFORE * tA[mps_o]
    pZ[mps_o] = (MPS_AFTER * (tZ[L] + tZ[mps_o].sum()) - pZ[L]) * tZ[mps_o] / tZ[mps_o].sum()
    pW[[L] + mps_o] = pA[[L] + mps_o] + pZ[[L] + mps_o]
    pW[WEB] = paid_web_W
    pW[ABM] = CH_PAID['PAID_SOCIAL'] - pW[[L, INT, TT, WEB]].sum()
    assert pW[ABM] > 15
    def split(cs, e):
        wa = tA[cs] * (1 + e); wz = tZ[cs] * (1 - e); return pW[cs] * wa / (wa + wz)
    for ch, *_ in CHANNELS:                        # every other channel: trial -> paid after Oct 18 = before - 0.2 pt (A-63 "flat +-0.5 pt")
        cs = [c for c in range(NC) if CHN[c] == ch and spW[c] > 0 and c not in (L, INT, TT)]
        if ch == 'PAID_SOCIAL': e = EPS_FLAT
        else:
            def shift(e):
                a_ = split(cs, e); return (pW[cs].sum() - a_.sum()) / tZ[cs].sum() - a_.sum() / tA[cs].sum() + .002
            e = bisect(shift, -.2, .2)
        pA[cs] = split(cs, e); pZ[cs] = pW[cs] - pA[cs]
    dA = round(pA.sum()) - pA.sum(); pA[NB] += dA; pZ[NB] -= dA
    assert abs(pW.sum() - 457) < 1e-9 and abs(pA.sum() - round(pA.sum())) < 1e-9
    G['paid_parts'] = (pA.copy(), pZ.copy())
    # day totals (ALL, integer) for A, after and P; CAC step tuned on the two 7-day windows around Oct 18 (A-63, AT-08)
    rateA = np.divide(pA, tA, out=np.zeros(NC), where=tA > 0); rateZ = np.divide(pZ, tZ, out=np.zeros(NC), where=tZ > 0)
    tP = trials[:, PD].sum(1).astype(float); rateP = np.divide(paidP, tP, out=np.zeros(NC), where=tP > 0)
    E_pay = np.zeros((NC, ND))
    E_pay[:, A_] = trials[:, A_] * rateA[:, None]; E_pay[:, Z_] = trials[:, Z_] * rateZ[:, None]; E_pay[:, PD] = trials[:, PD] * rateP[:, None]
    Dd = np.zeros(ND, np.int64)
    for m, tot in ((A_, round(pA.sum())), (Z_, round(pZ.sum())), (PD, PAID_P)):
        Dd[m] = alloc(np.zeros(m.sum(), np.int64), E_pay[:, m].sum(0) + 1e-6, [int(tot)])
    sp_all = spend.sum(0) / 100
    a1, a2, b1, b2 = ix('2026-10-11'), iB, iB, ix('2026-10-25')

    def step_of(Dx): return (sp_all[b1:b2] / Dx[b1:b2]).mean() / (sp_all[a1:a2] / Dx[a1:a2]).mean() - 1
    for _ in range(80):
        s_ = step_of(Dd)
        if .197 <= s_ <= .203: break
        if s_ < .197:   # move one conversion out of Oct 18-24 into Oct 25 - Nov 3, or into Oct 11-17 from Oct 5-10
            i = b1 + int(np.argmax(Dd[b1:b2])); j = b2 + int(np.argmin(Dd[b2:]))
        else:
            i = b2 + int(np.argmax(Dd[b2:])); j = b1 + int(np.argmin(Dd[b1:b2]))
        Dd[i] -= 1; Dd[j] += 1
    G['cac_step'] = step_of(Dd)
    assert .195 <= G['cac_step'] <= .205, G['cac_step']
    cred = np.zeros((NC, ND))
    for m, rows in ((A_, pA), (Z_, pZ), (PD, paidP)):
        X = ras(np.where(ACT[:, m], E_pay[:, m] + 1e-6, 0), rows, Dd[m].astype(float))
        cred[:, m] = day_split(Dd[m], X) / 10_000
    # history: trials x the previous-period trial -> paid rate of the campaign, ramped; LAL1 / summer promo own rates
    t2p = np.where(tP > 0, rateP, np.where(np.isin(np.arange(NC), [K['SOC_META_LAL1']]), .21, .15))
    t2p[L] = .25
    E_h = trials * t2p[:, None] * (.80 + .20 * np.clip(np.arange(ND) / iP0, 0, 1))[None, :] * LN(rng, .06, (NC, ND))   # conversion improved into 2026
    E_h[:, iP0:] = 0
    r = np.clip((np.arange(ND) - (iP0 - 75)) / 75, 0, 1)
    den = (trials[:, PD] * t2p[:, None]).sum(1)
    fP = np.clip(np.divide(paidP, den, out=np.ones(NC), where=den > 0), .6, 1.6)
    E_h = E_h * fP[:, None] ** r[None, :]
    for b in range(PB):
        m = BM[b]
        Dd[m] = alloc(np.zeros(m.sum(), np.int64), E_h[:, m].sum(0) + 1e-9, [int(round(E_h[:, m].sum()))])
        cred[:, m] = day_split(Dd[m], np.where(ACT[:, m], E_h[:, m] + 1e-9, 0)) / 10_000
    cred[RET] = 0
    assert np.allclose(cred.sum(0), Dd) and abs(cred[:, WD].sum() - 457) < 1e-6 and abs(cred[:, PD].sum() - 444) < 1e-6
    G.update(cred=cred, Dd=Dd)

    # New MRR (DDA) -----------------------------------------------------------------------------------------------------------------------
    arpaP = np.divide(MPc / 100, paidP, out=D['arpa'].copy(), where=paidP > 0)
    arpaH = arpaP[:, None] * (.94 + .06 * np.clip(np.arange(ND) / iP0, 0, 1))[None, :]
    E_m = cred * arpaH * 100 * LN(rng, .06, (NC, ND))
    grp = [(gm([c], WBL), MWc[c]) for c in range(NC) if MWc[c] > 0] + [(gm([c], [PB]), MPc[c]) for c in range(NC) if MPc[c] > 0]
    E_m[:, WD] = cred[:, WD] * LN(rng, .06, (NC, int(WD.sum()))) * 1e4
    mrr = stage(np.where(cred > 0, E_m, 0), grp)
    assert mrr[:, WD].sum() == round(MRR_W * 100) and mrr[:, PD].sum() == round(MRR_P * 100)
    G['mrr'] = mrr

    # other attribution models ------------------------------------------------------------------------------------------------------------------
    lc_f = np.array([CH_LC[c] for c in CHN]); ft_f = np.array([CH_FT[c] for c in CHN])
    cred_lc = day_split(Dd, cred * lc_f[:, None] * LN(rng, .15, (NC, ND)), 1).astype(float)
    cred_ft = day_split(Dd, cred * ft_f[:, None] * LN(rng, .15, (NC, ND))) / 10_000
    mrr_lc = np.zeros((NC, ND), np.int64); mrr_ft = np.zeros((NC, ND), np.int64)
    arpa_ct = np.divide(mrr / 100, cred, out=np.repeat(arpaP[:, None], ND, 1), where=cred > 0)
    for X, out in ((cred_lc, mrr_lc), (cred_ft, mrr_ft)):
        out[:] = day_split(mrr.sum(0), X * arpa_ct + 1e-12 * (X > 0), 1)
    gap = D['gapP'][:, None] * (.85 + .15 * np.clip(np.arange(ND) / iP0, 0, 1))[None, :]
    gap[:, WD] = D['gapW'][:, None]
    plat_f = (1 + gap) * LN(rng, .05, (NC, ND))
    for ch, *_ in CHANNELS:                                            # W: each channel's gap exact (A-43)
        cs = [c for c in range(NC) if CHN[c] == ch]
        cur = (cred[cs][:, WD] * plat_f[cs][:, WD]).sum(); want = (1 + CH_GAP_W[ch]) * cred[cs][:, WD].sum()
        plat_f[np.ix_(cs, np.flatnonzero(WD))] *= want / cur
    cur = (cred[:, PD] * plat_f[:, PD]).sum(); plat_f[:, PD] *= 1.30 * PAID_P / cur   # P: ALL gap exactly +30 %
    cred_pl = np.rint(cred * plat_f * 10_000) / 10_000
    mrr_pl = np.rint(mrr * np.divide(cred_pl, cred, out=np.zeros_like(cred), where=cred > 0)).astype(np.int64)
    G.update(cred_lc=cred_lc, cred_ft=cred_ft, cred_pl=cred_pl, mrr_lc=mrr_lc, mrr_ft=mrr_ft, mrr_pl=mrr_pl)

    # cohorts (DDA): counts, churn, refunds, revenue, payback --------------------------------------------------------------------------------------
    N0 = np.stack([cred[:, MI == m].sum(1) for m in range(NM)], 1)
    R0 = np.stack([mrr[:, MI == m].sum(1) / 100 for m in range(NM)], 1)
    def sc_cal(f, cal, base):
        ch = base.copy(); ch[:, calm == cal] *= f; return ch
    # realized counts: Jul 2026 churn sets the Jul-Sep quarter (previous period), Oct 2026 the Aug-Oct quarter (window); neither month
    # touches the offset-1 churn of the Jul / Aug cohorts, so the R90 of the finance block is unchanged
    f1b = bisect(lambda f: q_churn(*counts(N0, sc_cal(f, 18, churn))[:2], [18, 19, 20]) - .0272, .3, 2.0)
    churn = sc_cal(f1b, 18, churn)
    f2 = bisect(lambda f: q_churn(*counts(N0, sc_cal(f, 21, churn))[:2], [19, 20, 21]) - .0272, .3, 2.0)
    churn = sc_cal(f2, 21, churn)
    st, cu, en = counts(N0, churn)
    G['churn_q'] = (q_churn(st, cu, [18, 19, 20]), q_churn(st, cu, [19, 20, 21]))
    ref = np.zeros((NC, NM, NM)); ref[:, :, 0] = N0 * rho0; ref[:, :, 1] = st[:, :, 1] * rho1
    m12 = (np.arange(NM) >= 11)[None, :, None] * np.ones((NC, 1, NM), bool)
    f_ref = .021 * N0[:, 11:].sum() / ref[m12.astype(bool)].sum(); ref[m12.astype(bool)] *= f_ref
    kmax = np.array([21 - m if m <= 21 else 0 for m in range(NM)])
    valid = np.arange(NM)[None, :] <= kmax[:, None]
    rev = np.zeros((NC, NM, NM))
    with np.errstate(divide='ignore', invalid='ignore'):
        surv = np.where(N0[:, :, None] > 0, st / N0[:, :, None], 0)
    rev[:] = R0[:, :, None] * surv * EXP_K[None, None, :NM]
    rev[:, 19, 1:] *= kW; rev[:, 18, 1:] *= kP
    arpa_c = np.divide(R0, N0, out=np.zeros_like(R0), where=N0 > 0)
    refu = ref * arpa_c[:, :, None] * EXP_K[None, None, :NM]
    # payback: ALL cohorts Oct-Dec 2025 cross at month 10, Jan 2026 not by 9; SOC_META_LAL2 Oct 2025-Jan 2026 cross at month 9 (A-63, AT-14)
    team_m = np.array([TEAM[0][1] if MST[m] < np.datetime64(TEAM[1][0]) else TEAM[1][1] for m in range(NM)])
    team_m[21] = (TEAM[0][1] * 4 + TEAM[1][1] * 27) / 31
    cost = sp_m * (1 + team_m / sp_m.sum(0))[None, :]
    pay_f = {}
    for m, tgt_all, kk, tgt_l in ((9, 1.025, 10, 1.02), (10, 1.025, 10, 1.02), (11, 1.025, 10, 1.02), (12, .955, 9, 1.02)):
        net = rev[:, m] - refu[:, m]
        a_l = (tgt_l * cost[L, m] / GM - net[L, 0]) / net[L, 1:10].sum()
        rev[L, m, 1:] *= a_l; refu[L, m, 1:] *= a_l
        net = rev[:, m] - refu[:, m]; oth = [c for c in range(NC) if c != L]
        b_o = (tgt_all * cost[:, m].sum() / GM - net[:, 0].sum() - net[L, 1:kk + 1].sum()) / net[oth, 1:kk + 1].sum()
        rev[oth, m, 1:] *= b_o; refu[oth, m, 1:] *= b_o
        pay_f[m] = (round(float(a_l), 4), round(float(b_o), 4))
        assert .88 < a_l < 1.12 and .88 < b_o < 1.12, ('payback factor far from 1', m, a_l, b_o)
    G.update(st=st, cu=cu, en=en, ref=ref, rev=rev, refu=refu, valid=valid, N0=N0, R0=R0, f2=f2, f1b=f1b, pay_f=pay_f, f_ref=f_ref)

    # retention cohorts (sign-ups) -------------------------------------------------------------------------------------------------------------------
    pf = dict(WEB=1.0, IOS=1.04, ANDROID=.93)
    rows = []
    rnoise = LN(rng, .06, (NC, NM)); mdrift = LN(rng, .03, NM)
    for N in RET_N:
        mat_cells = np.zeros((NC, NM)); written = np.zeros(NM, bool)
        for m in range(NM):
            if MST[m] + np.timedelta64(14 + N, 'D') <= np.datetime64(AS_OF):
                written[m] = True
                dm = (MI == m) & (DAY + np.timedelta64(N, 'D') <= np.datetime64(AS_OF))
                mat_cells[:, m] = su[:, dm].sum(1)
        rate = RET_BASE[N] * np.array([pf[p] for p in PLAT])[:, None] * rnoise * mdrift[None, :]
        actv = np.rint(mat_cells * rate)
        if N in (7, 30):
            tgt = int(round((.27 if N == 7 else .13) * mat_cells[:, 20].sum()))
            actv[:, 20] = alloc(np.zeros(NC, np.int64), mat_cells[:, 20] * rate[:, 20] + 1e-9 * (mat_cells[:, 20] > 0), [tgt])
        actv = np.minimum(actv, mat_cells)
        for m in np.flatnonzero(written):
            for c in range(NC):
                if mat_cells[c, m] > 0: rows.append((m, c, N, int(mat_cells[c, m]), int(actv[c, m])))
    G['ret_rows'] = rows

    # sign-up segments (J4) ------------------------------------------------------------------------------------------------------------------------------
    sh_def = dict(WEB=.45, IOS=.52, ANDROID=.55); r1 = dict(WEB=.46, IOS=.47, ANDROID=.39); r2 = dict(WEB=.38, IOS=.44, ANDROID=.29)
    su1 = np.zeros((NC, ND), np.int64); a1 = np.zeros((NC, ND), np.int64)
    for p, cs in (('WEB', WEBC), ('IOS', IOSC), ('ANDROID', ANDC)):
        shp = np.where(WD, SEG[p][0] / max(1, su[cs][:, WD].sum()), sh_def[p])
        Em = np.zeros((NC, ND)); Em[cs] = su[cs] * shp[None, :] * LN(rng, .05, (len(cs), ND))
        x = stage(Em, [(gm(cs, WBL), SEG[p][0])], cap=np.where(np.isin(np.arange(NC), cs)[:, None], su, 0), ramp=False)
        su1[cs] = x[cs]
        Ea = np.zeros((NC, ND))
        den = x * r1[p] + (su - x) * r2[p]
        Ea[cs] = np.divide(act * x * r1[p], den, out=np.zeros((NC, ND)), where=den > 0)[cs]
        y = stage(Ea, [(gm(cs, WBL), SEG[p][1])], cap=np.where(np.isin(np.arange(NC), cs)[:, None], np.minimum(act, x), 0), ramp=False)
        lo = np.maximum(act - (su - x), 0); g = (np.arange(NC)[:, None] * NBK + BLK[None, :]).ravel()
        yy = fix_lower(y.ravel(), np.where(np.isin(np.arange(NC), cs)[:, None], lo, 0).ravel(), g, NC * NBK).reshape(NC, ND)
        a1[cs] = yy[cs]
    assert (a1 <= su1).all() and (act - a1 <= su - su1).all() and (a1 >= 0).all()
    G.update(su1=su1, a1=a1)
    return G


# ---- table assembly -------------------------------------------------------------------------------------------------------------
def money(cents): return np.round(np.asarray(cents, np.int64) / 100.0, 2)


def tables(G, rng):
    T = {}
    dd = np.arange(np.datetime64('2025-01-01'), np.datetime64('2027-01-01'), dtype='datetime64[D]')
    ser = pd.to_datetime(dd)
    iso = ser.isocalendar()
    T['dim_date'] = pd.DataFrame(dict(
        date=dd, month_key=ser.strftime('%Y-%m'), year=ser.year.astype(np.int32), quarter=ser.quarter.astype(np.int32), month_num=ser.month.astype(np.int32),
        month_name=ser.strftime('%b'), day_of_month=ser.day.astype(np.int32), iso_week=iso.week.astype(np.int32).values,
        week_start=(dd - ((dd.astype(np.int64) + 3) % 7).astype('timedelta64[D]')), weekday_num=(((dd.astype(np.int64) + 3) % 7) + 1).astype(np.int32),
        weekday_name=ser.strftime('%a'), is_weekend=((dd.astype(np.int64) + 3) % 7) >= 5, is_actual=dd <= np.datetime64(AS_OF),
        ly_date=(ser - pd.DateOffset(years=1)).values.astype('datetime64[D]')))
    ms = MST[:24]
    T['dim_month'] = pd.DataFrame(dict(month_key=[str(m)[:7] for m in ms], month_start=ms, month_index=np.arange(24, dtype=np.int32),
                                       year=np.array([2025 + m // 12 for m in range(24)], np.int32), month_name=pd.to_datetime(ms).strftime('%b %Y'),
                                       days_in_month=DIM.astype(np.int32), is_actual=ms <= np.datetime64(AS_OF),
                                       is_complete=(ms + DIM.astype('timedelta64[D]')) <= np.datetime64(AS_OF) + np.timedelta64(1, 'D')))
    T['dim_platform'] = pd.DataFrame(dict(platform_code=['WEB', 'IOS', 'ANDROID'], platform_name=['Web', 'iOS', 'Android'], is_mobile=[False, True, True],
                                          sort_order=np.arange(1, 4, dtype=np.int32)))
    T['dim_platform_segment'] = pd.DataFrame(dict(
        segment_code=['WEB_DESKTOP', 'WEB_MOBILE', 'IOS_18', 'IOS_17', 'ANDROID_14_15', 'ANDROID_LE13'],
        segment_name=['Web · desktop', 'Web · mobile', 'iOS 18', 'iOS 17', 'Android 14–15', 'Android ≤13'],
        platform_code=['WEB', 'WEB', 'IOS', 'IOS', 'ANDROID', 'ANDROID'], sort_order=np.arange(1, 7, dtype=np.int32)))
    T['dim_channel'] = pd.DataFrame(dict(channel_code=[c[0] for c in CHANNELS], channel_name=[c[1] for c in CHANNELS],
                                         color_slot=np.array([c[2] for c in CHANNELS], np.int32), color_light=[c[3] for c in CHANNELS],
                                         color_dark=[c[4] for c in CHANNELS], sort_order=np.arange(1, 7, dtype=np.int32)))
    T['dim_network'] = pd.DataFrame(dict(network_code=[n[0] for n in NETWORKS], network_name=[n[1] for n in NETWORKS], sort_order=np.arange(1, 9, dtype=np.int32)))
    T['dim_campaign'] = pd.DataFrame(dict(
        campaign_key=KEYS, campaign_name=[r[1] for r in CAMPS], channel_code=CHN, network_code=[r[3] for r in CAMPS], platform_code=PLAT,
        market_code=[r[5] for r in CAMPS], tier_code=[r[6] for r in CAMPS], objective_code=OBJ, status_code=[r[8] for r in CAMPS], is_brand=BRAND,
        start_date=np.array([r[10] for r in CAMPS], 'datetime64[D]'), end_date=np.array([r[11] or 'NaT' for r in CAMPS], 'datetime64[D]'),
        learning_end_date=np.array([r[12] for r in CAMPS], 'datetime64[D]'),
        cpa_target_usd=[None if o in ('LEAD', 'RETENTION') else float(CH_CPA[ch]) for o, ch in zip(OBJ, CHN)],
        sort_order=np.arange(1, NC + 1, dtype=np.int32)))
    asr = []
    for k in KEYS:
        names, tt = ADSETS[k]
        for a, nm in enumerate(names): asr.append((f'{k}-AS{a + 1}', k, nm, tt))
    T['dim_ad_set'] = pd.DataFrame(asr, columns=['ad_set_key', 'campaign_key', 'ad_set_name', 'targeting_type']).assign(sort_order=np.arange(1, len(asr) + 1, dtype=np.int32))
    CR = G['CR']
    T['dim_creative'] = pd.DataFrame(dict(creative_key=[c[0] for c in CR], campaign_key=[KEYS[c[1]] for c in CR], creative_name=[c[2] for c in CR],
                                          format_code=[c[3] for c in CR], launch_date=np.array([c[4] for c in CR], 'datetime64[D]'),
                                          sort_order=np.arange(1, len(CR) + 1, dtype=np.int32)))
    tr = []
    for k in KEYS:
        ty, lst = TERMS[k]
        for i, it in enumerate(lst):
            txt, mt = (it, None) if isinstance(it, str) else it
            tr.append((f'{k}-T{i + 1}', k, txt, ty, mt))
    T['dim_term'] = pd.DataFrame(tr, columns=['term_key', 'campaign_key', 'term_text', 'term_type', 'match_type']).assign(sort_order=np.arange(1, len(tr) + 1, dtype=np.int32))
    T['dim_landing_page'] = pd.DataFrame(dict(page_key=[p[0] for p in PAGES], page_name=[p[1] for p in PAGES], page_type=[p[2] for p in PAGES],
                                              platform_code=[p[3] for p in PAGES], sort_order=np.arange(1, 9, dtype=np.int32)))
    T['dim_onboarding_step'] = pd.DataFrame(dict(
        step_code=['SIGNUP', 'VERIFY_EMAIL', 'CREATE_WORKSPACE', 'CONNECT_SOURCE', 'FIRST_DASHBOARD', 'INVITE'],
        step_name=['Sign-up', 'Verify email', 'Create workspace', 'Connect data source', 'First dashboard (activated)', 'Invite teammate'],
        fact_column=['signups', 'step_verified', 'step_workspace', 'step_connected', 'step_first_dashboard', 'step_invited'],
        is_activation=[False, False, False, False, True, False], sort_order=np.arange(1, 7, dtype=np.int32)))
    T['dim_attribution_model'] = pd.DataFrame(dict(
        model_code=['DDA', 'LAST_CLICK', 'FIRST_TOUCH', 'PLATFORM'], model_name=['Data-driven', 'Last click', 'First touch', 'Platform-reported'],
        lookback_click_days=np.full(4, 30, np.int32), lookback_view_days=np.full(4, 1, np.int32), is_default=[True, False, False, False],
        is_first_party=[True, True, True, False],
        description=['First-party paid conversions credited across touches by the data-driven model (default)',
                     'First-party paid conversions credited in full to the last paid click',
                     'First-party paid conversions credited to the first paid touch',
                     'Conversions claimed by the ad networks (over-claims; not first-party)'],
        sort_order=np.arange(1, 5, dtype=np.int32)))

    # facts --------------------------------------------------------------------------------------------------------------------------
    c_ix, t_ix = np.nonzero(ACT & (G['spend'] > 0))
    dayv = DAY[t_ix]; ck = np.array(KEYS)[c_ix]
    rc, rt, rj = G['rc'], G['rt'], G['rj']
    # delivery: reach_7d from the creative's trailing-7-day impressions and its frequency; LAL2 frequencies per the mockup list in the window
    imp_r, clk_r, spend_r = G['imp_r'], G['clk_r'], G['spend_r']
    cs_ = np.cumsum(imp_r); first = np.r_[True, rj[1:] != rj[:-1]]
    grp_start = np.maximum.accumulate(np.where(first, np.arange(rj.size), 0))
    pos = np.arange(rj.size) - grp_start
    lag = np.where(pos >= 7, np.r_[np.zeros(7), cs_][:rj.size], cs_[np.maximum(grp_start - 1, 0)] * (grp_start > 0))
    trail = cs_ - lag
    launch_i = np.array([ix(str(c[4])) if c[4] >= DAY[0] else -400 for c in CR])
    age = rt - launch_i[rj]
    fq_j = np.array([D['fq'][c[1]] for c in CR]) * LN(rng, .05, len(CR))
    freq = fq_j[rj] * np.clip(.75 + .25 * age / 30, .75, 1.0)
    v3 = [j for j, c in enumerate(CR) if c[2] == 'Dashboard in 60s · v3'][0]
    for j, c in enumerate(CR):
        if c[1] == L and c[9] is not None:
            m = (rj == j) & (rt >= iW0 - 7); freq[m] = c[9][2]
    m = rj == v3; freq[m] = np.interp(rt[m], [ix('2026-09-15'), ND - 1], [1.8, 3.40])
    reach = np.maximum(1, np.rint(trail / freq)).astype(np.int64); reach = np.minimum(reach, np.maximum(trail, 1).astype(np.int64))
    fmt = np.array([c[3] for c in CR])
    vv = np.where(fmt[rj] == 'VIDEO', np.minimum(imp_r, np.rint(imp_r * .22 * LN(rng, .1, rj.size))), -1).astype(np.int64)
    cred = G['cred']
    ucell, cinv = G['ucell'], G['cinv']
    pc = alloc(cinv, clk_r + 1e-6 * imp_r + 1e-9, np.rint(cred.ravel()[ucell] * 10_000).astype(np.int64)) / 10_000
    adset_key = [f'{KEYS[c[1]]}-AS{c[6] + 1}' for c in CR]
    keep = imp_r > 0
    T['fact_ad_delivery_day'] = pd.DataFrame(dict(
        date=DAY[rt], campaign_key=np.array(KEYS)[rc], ad_set_key=np.array(adset_key)[rj], creative_key=np.array([c[0] for c in CR])[rj],
        impressions=imp_r, clicks=clk_r, spend_usd=money(spend_r), reach_7d=reach, video_views=pd.array(np.where(vv >= 0, vv, 0), 'Int64'),
        paid_customers_dda=pc))[keep].reset_index(drop=True)
    T['fact_ad_delivery_day'].loc[(fmt[rj] != 'VIDEO')[keep], 'video_views'] = pd.NA
    G['reach_r'] = reach; G['pc_r'] = pc

    # terms: top-8 terms per campaign-day carry 80 % (keywords) / 90 % (others) of the campaign-day delivery
    tr_rows = []
    for c, k in enumerate(KEYS):
        ty = TERMS[k][0]; cov = .80 if ty == 'KEYWORD' else .90
        a = np.array([.28, .2, .14, .1, .09, .08, .06, .05]); bctr = LN(rng, .25, 8); pcpc = LN(rng, .3, 8); vcvr = LN(rng, .35, 8)
        if k == 'SRCH_NONBRAND_ANALYTICS':
            a = np.array([.22, .12, .06, .26, .12, .09, .07, .06]); pcpc = np.array(NB_TERM['cpc']) / 1.6; vcvr = np.array(NB_TERM['cvr']) / .04
        tt = np.flatnonzero(G['imp'][c] > 0)
        if not tt.size: continue
        noise = LN(rng, .08, (tt.size, 8)); g = np.repeat(np.arange(tt.size), 8)
        ti = alloc(g, (a[None, :] * noise).ravel(), np.rint(cov * G['imp'][c, tt]).astype(np.int64))
        tc = alloc_capped(g, (ti.reshape(-1, 8) * bctr[None, :]).ravel() + 1e-9, np.rint(cov * G['clk'][c, tt]).astype(np.int64), ti)
        ts = alloc(g, (tc.reshape(-1, 8) * pcpc[None, :]).ravel() + 1e-6 * ti + 1e-9, np.rint(cov * G['spend'][c, tt]).astype(np.int64))
        tu = alloc_capped(g, (tc.reshape(-1, 8) * vcvr[None, :]).ravel() + 1e-9, np.rint(cov * G['su'][c, tt]).astype(np.int64), tc)
        tr_rows.append(pd.DataFrame(dict(date=np.repeat(DAY[tt], 8), campaign_key=k, term_key=np.tile([f'{k}-T{i + 1}' for i in range(8)], tt.size),
                                         impressions=ti, clicks=tc, spend_usd=money(ts), signups=tu)))
    T['fact_term_day'] = pd.concat(tr_rows, ignore_index=True).sort_values(['date', 'campaign_key', 'term_key'], kind='stable').reset_index(drop=True)

    # traffic: web pages (sessions split by the campaign's page mix) and one store page per mobile campaign-day
    pinfo = {p[0]: p for p in PAGES}; rows = []
    for c, k in enumerate(KEYS):
        tt = np.flatnonzero((G['clk'][c] > 0) & ACT[c])
        if PLAT[c] == 'WEB':
            pk = list(PAGE_MIX[k]); mix = np.array([PAGE_MIX[k][p] for p in pk]); n = len(pk); g = np.repeat(np.arange(tt.size), n)
            ss = alloc(g, (mix[None, :] * LN(rng, .1, (tt.size, n))).ravel() + 1e-9, G['sess'][c, tt])
            cf = np.array([pinfo[p][6] for p in pk])
            uu = alloc_capped(g, (ss.reshape(-1, n) * cf[None, :]).ravel() + 1e-9, G['su'][c, tt], ss)
            bb = np.minimum(ss, np.rint(ss * np.tile([pinfo[p][4] for p in pk], tt.size) * LN(rng, .05, ss.size))).astype(np.int64)
            lcp = np.rint(np.tile([pinfo[p][5] for p in pk], tt.size) * LN(rng, .07, ss.size)).astype(np.int64)
            keep = ss > 0
            rows.append(pd.DataFrame(dict(date=np.repeat(DAY[tt], n)[keep], campaign_key=k, page_key=np.tile(pk, tt.size)[keep],
                                          sessions=ss[keep], bounces=bb[keep], lcp_ms_p75=lcp[keep], store_views=-1, installs=-1, first_opens=-1, signups=uu[keep])))
        else:
            tt = tt[G['sv'][c, tt] > 0]
            rows.append(pd.DataFrame(dict(date=DAY[tt], campaign_key=k, page_key='LP_APP_STORE' if PLAT[c] == 'IOS' else 'LP_PLAY_STORE', sessions=-1, bounces=-1,
                                          lcp_ms_p75=-1, store_views=G['sv'][c, tt], installs=G['inst'][c, tt], first_opens=G['fo'][c, tt], signups=G['su'][c, tt])))
    tf = pd.concat(rows, ignore_index=True).sort_values(['date', 'campaign_key', 'page_key'], kind='stable').reset_index(drop=True)
    for col, dt in (('sessions', 'Int64'), ('bounces', 'Int64'), ('lcp_ms_p75', 'Int32'), ('store_views', 'Int64'), ('installs', 'Int64'), ('first_opens', 'Int64')):
        v = tf[col].to_numpy(); tf[col] = pd.array(np.where(v >= 0, v, 0), dt); tf.loc[v < 0, col] = pd.NA
    tf['signups'] = tf['signups'].astype(np.int64)
    T['fact_traffic_day'] = tf

    # funnel, segments, attribution
    su, b = G['su'], G['bins']
    T['fact_funnel_day'] = pd.DataFrame(dict(
        date=dayv, campaign_key=ck, signups=su[c_ix, t_ix], step_verified=G['ver'][c_ix, t_ix], step_workspace=G['wsp'][c_ix, t_ix],
        step_connected=G['con'][c_ix, t_ix], step_first_dashboard=G['act'][c_ix, t_ix], step_invited=G['inv'][c_ix, t_ix],
        act_lt1h=b[0][c_ix, t_ix], act_1_6h=b[1][c_ix, t_ix], act_6_24h=b[2][c_ix, t_ix], act_1_2d=b[3][c_ix, t_ix], act_2_4d=b[4][c_ix, t_ix],
        act_4_7d=b[5][c_ix, t_ix], act_7_30d=b[6][c_ix, t_ix], trials=G['trials'][c_ix, t_ix]))
    seg1 = dict(WEB='WEB_DESKTOP', IOS='IOS_18', ANDROID='ANDROID_14_15'); seg2 = dict(WEB='WEB_MOBILE', IOS='IOS_17', ANDROID='ANDROID_LE13')
    s1, a1 = G['su1'][c_ix, t_ix], G['a1'][c_ix, t_ix]; sa, aa = su[c_ix, t_ix], G['act'][c_ix, t_ix]
    segdf = pd.DataFrame(dict(date=np.r_[dayv, dayv], campaign_key=np.r_[ck, ck], segment_code=np.r_[[seg1[PLAT[c]] for c in c_ix], [seg2[PLAT[c]] for c in c_ix]],
                              signups=np.r_[s1, sa - s1], activated_7d=np.r_[a1, aa - a1]))
    T['fact_signup_segment_day'] = segdf[segdf.signups > 0].sort_values(['date', 'campaign_key', 'segment_code'], kind='stable').reset_index(drop=True)
    at = []
    for code, cr_, mr_ in (('DDA', G['cred'], G['mrr']), ('LAST_CLICK', G['cred_lc'], G['mrr_lc']), ('FIRST_TOUCH', G['cred_ft'], G['mrr_ft']),
                           ('PLATFORM', G['cred_pl'], G['mrr_pl'])):
        cc, tt = np.nonzero((cr_ > 0) | (mr_ > 0))
        at.append(pd.DataFrame(dict(date=DAY[tt], campaign_key=np.array(KEYS)[cc], model_code=code, paid_customers=np.round(cr_[cc, tt], 4),
                                    new_mrr_usd=money(mr_[cc, tt]))))
    T['fact_attribution_day'] = pd.concat(at, ignore_index=True).sort_values(['date', 'campaign_key', 'model_code'], kind='stable').reset_index(drop=True)

    # cohorts
    st, cu, en, ref, rev, refu, valid = G['st'], G['cu'], G['en'], G['ref'], G['rev'], G['refu'], G['valid']
    mk = [str(m)[:7] for m in MST[:23]]; cr_rows = []
    for c in range(NC):
        for m in range(23):
            if G['N0'][c, m] <= 0: continue
            for k in np.flatnonzero(valid[m]):
                cr_rows.append((mk[m], KEYS[c], int(k), round(st[c, m, k], 4), round(cu[c, m, k], 4), round(en[c, m, k], 4),
                                round(rev[c, m, k], 2), round(refu[c, m, k], 2), round(ref[c, m, k], 4)))
    T['fact_cohort_revenue_month'] = pd.DataFrame(cr_rows, columns=['cohort_month', 'campaign_key', 'month_offset', 'customers_start', 'churned', 'customers_end',
                                                                    'revenue_usd', 'refunds_usd', 'refund_count']).astype({'month_offset': np.int32})
    T['fact_retention_cohort_month'] = pd.DataFrame([(mk[m], KEYS[c], N, a, b_) for m, c, N, a, b_ in G['ret_rows']],
                                                    columns=['cohort_month', 'campaign_key', 'day_n', 'users_matured', 'users_active']).astype({'day_n': np.int32}) \
        .sort_values(['cohort_month', 'campaign_key', 'day_n'], kind='stable').reset_index(drop=True)

    # budget: history = monthly spend / an on-plan pace (+-3 %); Sep 2026 on plan; Oct / Nov at the window's daily plan; Dec = Nov x 31/30 x 0.92
    sp = G['spend']; spWd = np.array([sp[c, WD].sum() for c in range(NC)]) / 100
    plan = np.zeros(NC)
    for ch, *_ in CHANNELS:
        cs = [c for c in range(NC) if CHN[c] == ch and spWd[c] > 0]
        fx = [c for c in cs if c in FIXED_PACE]; fr = [c for c in cs if c not in FIXED_PACE]
        plan[fx] = spWd[fx] / D['pace'][fx]
        if fr:
            w_ = spWd[fr] / D['pace'][fr]; plan[fr] = w_ * (CH_PLAN[ch] - plan[fx].sum()) / w_.sum()
    pnoise = LN(rng, .025, (NC, 24)); bud = np.zeros((NC, 24))
    for m in range(24):
        for c in range(NC):
            if m <= 20:
                s_m = sp[c, MI == m].sum() / 100
                bud[c, m] = s_m / DOM[MI == m].max() * DIM[m] * pnoise[c, m] if s_m > 0 else 0
            elif plan[c] > 0:
                d_ = plan[c] / 30
                bud[c, m] = d_ * (31 if m == 21 else 30) if m in (21, 22) else d_ * 31 * .92
                if KEYS[c] == 'SOC_LINKEDIN_WEBINAR' and m == 23: bud[c, m] = 0
    bud = np.round(bud / 10) * 10
    bud[:, 21] = np.round(np.where(plan > 0, plan / 30 * 31, 0), 2); bud[:, 22] = np.round(np.where(plan > 0, plan, 0), 2)
    G['plan_W'] = plan
    T['fact_budget_month'] = pd.DataFrame(dict(month_key=np.repeat([str(m)[:7] for m in MST[:24]], NC), campaign_key=np.tile(KEYS, 24),
                                               budget_usd=bud.T.ravel()))
    # pipeline (PIPELINE / LEAD campaigns): opportunities from sign-ups, value, won
    pr = []
    for c in (ABM, WEB):
        for m in range(23):
            s_m = su[c, MI == m].sum()
            if s_m <= 0: continue
            opps = int(round(s_m * .30)); pv = round(opps * 16_500 * float(LN(rng, .1, 1)[0]), 2)
            won = round(pv * .21 * float(LN(rng, .15, 1)[0]) * (1.0 if m <= 19 else .4 if m <= 21 else 0), 2)
            pr.append((str(MST[m])[:7], KEYS[c], opps, pv, won))
    T['fact_pipeline_month'] = pd.DataFrame(pr, columns=['month_key', 'campaign_key', 'opps_created', 'pipeline_usd', 'won_usd']).astype({'opps_created': np.int64})

    # parameters, sync log
    pt = [('CHANNEL', ch, 'CPA', float(v), 'DOWN') for ch, v in CH_CPA.items()]
    pt += [('CHANNEL', ch, f'CTR_{s}', v, 'BAND') for ch, (lo, hi) in CH_CTR.items() for s, v in (('LO', lo), ('HI', hi))]
    pt += [('ALL', 'ALL', m, v, d) for m, v, d in (
        ('ROAS', 1.0, 'UP'), ('ROAS_SCALE', 1.5, 'UP'), ('PAID_CUSTOMERS_30D', 480, 'UP'), ('BLENDED_CAC', 480, 'DOWN'), ('PAYBACK_MONTHS', 12, 'DOWN'),
        ('LTV_CAC', 3.0, 'UP'), ('TRIAL_TO_PAID', .16, 'UP'), ('ACTIVATION_7D', .40, 'UP'), ('D7_RETENTION', .25, 'UP'), ('D30_RETENTION', .12, 'UP'),
        ('REFUND_RATE', .03, 'DOWN'), ('BRAND_SHARE', .40, 'DOWN'), ('ATTR_GAP', .30, 'DOWN'), ('ATTR_GAP_WIDEN_PT', .05, 'DOWN'),
        ('PACING_LO', .85, 'BAND'), ('PACING_HI', 1.10, 'BAND'), ('SPEND_PLAN_TOL', .05, 'BAND'), ('CPA_OVER_TOL', 1.10, 'DOWN'),
        ('FATIGUE_SLOPE', -.20, 'UP'), ('FATIGUE_FREQ', 3.0, 'DOWN'), ('FREQ_HIGH', 4.0, 'DOWN'), ('WATCH_FREQ', 2.5, 'DOWN'),
        ('VIEW_THROUGH_RATIO', 1.8, 'DOWN'), ('INSTALL_QUALITY_PT', -.02, 'UP'), ('WARN_BAND_REL', .30, 'BAND'))]
    T['param_target'] = pd.DataFrame(pt, columns=['scope_type', 'scope_code', 'metric_code', 'target_value', 'direction']) \
        .astype({'target_value': float}).assign(sort_order=np.arange(1, len(pt) + 1, dtype=np.int32))
    T['param_finance'] = pd.DataFrame(dict(metric_code=['GROSS_MARGIN_PCT', 'PAID_TEAM_COST_MONTH_USD', 'PAID_TEAM_COST_MONTH_USD'],
                                           valid_from=np.array(['2025-01-01', TEAM[0][0], TEAM[1][0]], 'datetime64[D]'), value=[GM, TEAM[0][1], TEAM[1][1]]))
    T['param_alert_rule'] = pd.DataFrame([
        ('FATIGUE', 'CRIT', 'Creative fatigue', 'CAMPAIGN', 'CTR_SLOPE_7D', 'ctr_slope_7d < FATIGUE_SLOPE and frequency_7d > FATIGUE_FREQ', 1),
        ('PACING_OVER', 'WARN', 'Channel over plan', 'CHANNEL', 'PACING', 'pacing > PACING_HI; value = spend - plan', 2),
        ('INSTALL_QUALITY', 'WARN', 'Install quality', 'CAMPAIGN', 'INSTALL_SIGNUP', 'objective INSTALL and install -> sign-up of the last 7 days - previous period < INSTALL_QUALITY_PT', 3),
        ('ATTR_GAP_WIDEN', 'INFO', 'Attribution gap widened', 'ALL', 'ATTR_GAP', 'attribution gap - previous-period gap >= ATTR_GAP_WIDEN_PT', 4),
        ('UNDERSPENT_SCALE', 'OK', 'Underspent with room to scale', 'CHANNEL', 'PACING', 'pacing < PACING_LO and roas_90d >= ROAS_SCALE; value = plan - spend', 5),
        ('DATA_STALE', 'CRIT', 'Data source stale', 'SOURCE', 'FRESHNESS', 'any source age >= red_after_h', 6)],
        columns=['rule_code', 'severity', 'title', 'scope_type', 'metric_code', 'condition', 'sort_order']).astype({'sort_order': np.int32})
    T['sync_log'] = pd.DataFrame(dict(
        source_code=['AD_PLATFORMS', 'WEB_ANALYTICS', 'MMP', 'PRODUCT_EVENTS', 'BILLING', 'CRM', 'ATTRIBUTION'],
        source_name=['Ad platforms (Google, Microsoft, Meta, LinkedIn, TikTok, Apple, DV360)', 'Web analytics (GA4)', 'Mobile measurement partner',
                     'Product analytics', 'Billing (Stripe)', 'CRM', 'Attribution job'],
        cadence=['HOURLY', 'HOURLY', 'HOURLY', 'HOURLY', 'DAILY', 'DAILY', 'DAILY'],
        last_sync_ts=pd.to_datetime(['2026-11-04 12:40', '2026-11-04 12:50', '2026-11-04 12:45', '2026-11-04 12:55', '2026-11-04 06:00', '2026-11-04 06:00',
                                     '2026-11-04 06:00']).values.astype('datetime64[s]'),
        stale_after_h=np.array([6, 6, 6, 6, 30, 30, 30], np.int32), red_after_h=np.array([24, 24, 24, 24, 72, 72, 72], np.int32), status=['OK'] * 7))
    order = ['dim_date', 'dim_month', 'dim_platform', 'dim_platform_segment', 'dim_channel', 'dim_network', 'dim_campaign', 'dim_ad_set', 'dim_creative', 'dim_term',
             'dim_landing_page', 'dim_onboarding_step', 'dim_attribution_model', 'fact_ad_delivery_day', 'fact_term_day', 'fact_traffic_day', 'fact_funnel_day',
             'fact_signup_segment_day', 'fact_attribution_day', 'fact_cohort_revenue_month', 'fact_retention_cohort_month', 'fact_budget_month',
             'fact_pipeline_month', 'param_target', 'param_finance', 'param_alert_rule', 'sync_log']
    return {n: T[n] for n in order}


# ---- writing ------------------------------------------------------------------------------------------------------------------
DATE_COLS = {'date', 'week_start', 'ly_date', 'month_start', 'start_date', 'end_date', 'learning_end_date', 'launch_date', 'valid_from'}


def write(out, name, df):
    t = pa.Table.from_pandas(df.reset_index(drop=True), preserve_index=False)
    cols = []
    for f in t.schema:
        col = t[f.name]
        if f.name in DATE_COLS: col = col.cast(pa.date32())
        elif f.name == 'last_sync_ts': col = col.cast(pa.timestamp('ms'))      # Parquet has no seconds unit (README deviation D-8)
        elif pa.types.is_null(f.type): col = col.cast(pa.string())
        elif pa.types.is_large_string(f.type): col = col.cast(pa.string())
        cols.append(col)
    t = pa.table(cols, names=t.schema.names).replace_schema_metadata(None)
    p = out / 'parquet' / f'{name}.parquet'
    pq.write_table(t, p, compression='snappy')
    return dict(table=name, rows=t.num_rows, parquet_bytes=p.stat().st_size, columns={f.name: str(f.type) for f in pq.read_schema(p)})


# ---- control totals (A-76), computed from the tables as written ------------------------------------------------------------------
from metrics import control_totals, story_check   # noqa: E402  (the metric engine lives next to this file)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent)); out = Path(ap.parse_args().out)
    t0 = time.time(); rng = np.random.default_rng(SEED)
    (out / 'parquet').mkdir(parents=True, exist_ok=True); (out / 'checks').mkdir(parents=True, exist_ok=True)
    G = build(rng)
    T = tables(G, rng)
    man = [write(out, n, df) for n, df in T.items()]
    T = {n: pd.read_parquet(out / 'parquet' / f'{n}.parquet') for n in T}          # control totals read the files as written
    ct = control_totals(T)
    ct.to_csv(out / 'checks' / 'control_totals_usd.csv', index=False, lineterminator='\n')
    story_check(ct)
    (out / 'parquet' / 'manifest.json').write_text(json.dumps(dict(
        dataset='acme_marketing_dummy_data', generator_version=VERSION, seed=SEED, as_of_date=AS_OF, refreshed=REFRESHED,
        default_window_start='2026-10-05', default_window_end='2026-11-03', previous_window_start='2026-09-05', previous_window_end='2026-10-04',
        currency='USD', tables=man), indent=1) + '\n', encoding='utf-8')
    tot = 0
    for m_ in man: tot += m_['parquet_bytes']; print(f"{m_['table']:<30}{m_['rows']:>9,} rows  {m_['parquet_bytes'] / 1e6:6.2f} MB")
    print(f"{'total':<30}{sum(m_['rows'] for m_ in man):>9,} rows  {tot / 1e6:6.2f} MB")
    print(f"control totals: {len(ct):,} rows; CAC step {G['cac_step'] * 100:.2f} %; median {G['median_w']:.2f} h; churn Jul-Sep {G['churn_q'][0] * 100:.3f} %, "
          f"Aug-Oct {G['churn_q'][1] * 100:.3f} %; k Aug {G['kW']:.4f}, k Jul {G['kP']:.4f}; payback factors {G['pay_f']}; runtime {time.time() - t0:.1f} s")


if __name__ == '__main__':
    main()

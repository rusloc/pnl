#!/usr/bin/env python3
"""Mirelo sales & revenue dummy dataset - deterministic generator (seed 20261026).

Usage:  python generate.py [--out <folder>]      (default: the dataset folder, one level up)
Writes  dims/ facts/ params/ (CSV) + parquet/ (same tables) + checks/control_totals_eur.csv.
Design: docs/ADD/features/sales-revenue-dashboard-concept.md (§4, §9) and
        docs/design/sales-revenue dashboard/metric-flow.html (Tier-1 metrics, dataset additions).
Volumes come from a few latent drivers (market demand, seasonality, channel and product shares,
client risk, agent skill and ramp, credit policy), then Poisson draws; loans are simulated per
client as repayment chains, and every monthly fact is aggregated from the simulated loans.
"""
import argparse, json, time
from pathlib import Path
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SEED = 20261026
M0 = np.datetime64('2024-01', 'M')
def dnum(s): return int(np.datetime64(s, 'D').astype(np.int64))
D0, CLOSE, CUT = dnum('2024-01-01'), dnum('2026-09-30'), dnum('2026-10-25')   # CUT = last day with actuals
BURN = dnum('2023-01-01')         # simulation starts 12 months early so the Jan 2024 book is seasoned; 2023 loans are never written
NM, NC = 36, 33                                    # months in the calendar / closed months (Jan 2024 - Sep 2026)
_ms = (M0 + np.arange(-12, NM + 1).astype('timedelta64[M]')).astype('datetime64[D]').astype(np.int64)
MSX, MEX = _ms[:-1], _ms[1:] - 1                   # month start / end for t = -12 .. 35 (index t + 12)
MSTART, MEND = MSX[12:], MEX[12:]
MKX = np.array([str(m) for m in M0 + np.arange(-12, NM).astype('timedelta64[M]')]); MKEY = MKX[12:]
def mi(d): return (np.asarray(d).astype('datetime64[D]').astype('datetime64[M]') - M0).astype(np.int64)

MK, CCY = ['PL', 'RO', 'PT'], ['PLN', 'RON', 'EUR']
PR = ['FLEX30', 'FLEX90', 'STEP6', 'STEP12', 'BIZ']
CH = ['APP', 'PAID', 'PARTNER', 'AGENT']
# ---- latent drivers (calibrated so the totals land on the ×0.6 scale of the concept) -------------------
SCALE_NEW, SCALE_RET, SCALE_PD = 1.38, 1.07, 1.0
SEAS_C = np.array([.95, .91, 1.0, 1.02, 1.0, .97, .90, .88, 1.02, 1.04, 1.12, 1.22])   # consumer demand by month
SEAS_B = np.array([.92, .98, 1.10, 1.04, 1.02, .98, .88, .85, 1.10, 1.06, 1.02, .95])  # micro-business
WD = np.array([1.08, 1.05, 1.03, 1.02, 1.05, .88, .80]); WD_AG = np.array([1.1, 1.1, 1.1, 1.1, 1.05, .35, 0])
CHS = np.array([[.35, .45, .20], [.30, .52, .18], [.38, .40, .22]])           # new-client channel shares (APP, PAID, PARTNER)
PS = np.array([[.40, .28, .24, 0, .08], [.46, .30, .24, 0, 0], [.62, .28, .10, 0, 0]])  # first product by channel
L12 = [dnum('2025-06-01'), dnum('2025-09-01'), None]                           # STEP12 launch PL / RO; not in PT
TR = np.array([[.55, .25, .15, .05, 0], [.15, .45, .30, .10, 0], [.05, .15, .50, .30, 0], [0, .05, .30, .65, 0], [0, 0, 0, 0, 1]])
LO, HI, STEP = np.array([400, 500, 150]), np.array([3000, 6000, 1500]), np.array([50, 50, 10])
POS = np.array([.10, .24, .40, .55, .50])                                      # ticket position in the market range
APR_LO, APR_HI = np.array([.36, .32, .26, .20, .18]), np.array([.45, .42, .36, .29, .27])
INTERVAL, NPAY = np.array([30, 90, 30, 30, 30]), np.array([1, 1, 6, 12, 0])  # BIZ term drawn per loan
FEE_BASE = np.array([.04, .03, .025, .02, .015]); LATE_FEE = np.array([30., 35., 8.])
PD_BASE = np.array([.030, .045, .060, .070, .055]); CHF = np.array([.9, 1.25, 1.1, .85])
PRET = np.array([.70, .66, .60, .50, .66]); GAP = np.array([20, 35, 50, 75, 45])
VF = np.ones((3, NM)); VF[0, 12:24] = .95; VF[0, 24:] = 1.10                 # vintage risk factor by market x month
VF[1, :12] = .85; VF[1, 12:23] = 1.6; VF[1, 23:26] = 1.2; VF[1, 26:] = .85; VF[2] = np.linspace(.85, .95, NM)   # RO bad 2025 vintages
TIGHT = dnum('2026-03-01')                                                    # Romania credit-policy tightening
COV = np.array([.02, .10, .35, .55, .85])        # provision coverage by bucket: current, 1-29, 30-59, 60-89, 90+ DPD

def domf(dom): return np.select([dom <= 5, dom <= 9, dom <= 19, dom <= 27], [.90, 1.08, 1.0, 1.12], .98)
def cal(days):
    dt = pd.DatetimeIndex(np.asarray(days).astype('datetime64[D]'))
    return dt.month.values - 1, dt.day.values, dt.dayofweek.values
def pick(rng, probs):                                   # one categorical draw per row of a prob matrix
    return (rng.random(len(probs))[:, None] > np.cumsum(probs, 1)[:, :-1]).sum(1)

# ---- dimensions ----------------------------------------------------------------------------------------------
def build_agents(rng):
    fn = {'PL': ['Anna', 'Piotr', 'Katarzyna', 'Tomasz', 'Magdalena', 'Pawel', 'Agnieszka', 'Michal', 'Joanna', 'Krzysztof', 'Ewa', 'Marcin'],
          'RO': ['Andrei', 'Elena', 'Mihai', 'Ioana', 'Alexandru', 'Maria', 'Cristian', 'Ana']}
    ln = {'PL': ['Nowak', 'Kowalski', 'Wisniewska', 'Wojcik', 'Kaminska', 'Lewandowski', 'Zielinska', 'Szymanski', 'Dabrowska', 'Kozlowski', 'Jankowska', 'Mazur'],
          'RO': ['Popescu', 'Ionescu', 'Dumitru', 'Stan', 'Stoica', 'Gheorghe', 'Rusu', 'Munteanu']}
    rows = []
    for i in range(40):
        m = 'PL' if i < 24 else 'RO'; j = i if i < 24 else i - 24; n = 24 if m == 'PL' else 16
        cohort = (19 <= i <= 23) or i >= 37
        span = (1180 if m == 'PL' else 800) if j % 4 else 400
        start = '2026-01-05' if cohort else str(np.datetime64('2022-03-01' if m == 'PL' else '2023-04-01') + np.timedelta64(int(rng.integers(0, span)), 'D'))
        rows.append(dict(agent_code=f'A{i + 1:03d}', agent_name=f"{fn[m][j % len(fn[m])]} {ln[m][(j * 5 + 3) % len(ln[m])]}",
                         agent_type='AGENT', market_code=m, team='North' if j < n // 2 else 'South', start_date=start, is_ramp_cohort=cohort))
    partners = [('PL', 'Kramik Online', 'E-commerce'), ('PL', 'TopUp24 PL', 'Telco top-up'), ('PL', 'Jazdo Gig', 'Gig platform'),
                ('PL', 'Domek Store', 'E-commerce'), ('PL', 'Szybki Koszyk', 'E-commerce'), ('RO', 'Taraba Online', 'E-commerce'),
                ('RO', 'Reincarca Rapid', 'Telco top-up'), ('RO', 'Curier Gig', 'Gig platform'), ('PT', 'Mercadinho Online', 'E-commerce'),
                ('PT', 'Recarga Ja', 'Telco top-up'), ('PT', 'Boleia Gig', 'Gig platform'), ('PT', 'Casa Facil Loja', 'E-commerce')]
    for k, (m, name, team) in enumerate(partners):
        rows.append(dict(agent_code=f'P{k + 1:03d}', agent_name=name, agent_type='PARTNER', market_code=m, team=team,
                         start_date={'PL': '2023-01-01', 'RO': '2023-04-01', 'PT': '2024-01-01'}[m], is_ramp_cohort=False))
    a = pd.DataFrame(rows); a['start_date'] = pd.to_datetime(a['start_date']); return a

def acquisition(rng, agents):
    """New clients per day x market x channel x first product (+ per agent), Poisson on latent intensity."""
    days = np.arange(BURN, CUT + 1); nd = len(days); moy, dom, dow = cal(days); tt = (days - D0) / 30.44; dmi = mi(days)
    shock, e = np.zeros((3, NM + 12)), np.zeros(3)
    for t in range(NM + 12): e = .6 * e + rng.normal(0, .03, 3); shock[:, t] = e
    hol = np.where(((moy == 11) & np.isin(dom, [24, 25, 26])) | ((moy == 0) & (dom == 1)), .45, 1.)
    dayf = WD[dow] * domf(dom) * hol
    A = np.vstack([2500 * 1.12 ** (tt / 12), 1350 * 1.15 ** (tt / 12) * np.where(days >= TIGHT, .86, 1.) * (days >= dnum('2023-04-01')),
                   1500 * (.25 + .75 * np.clip(tt / 16, 0, 1)) * 1.18 ** (np.maximum(0, tt - 16) / 12) * (days >= D0)])   # RO launch Apr 2023, PT Jan 2024
    A = A * np.where(days < D0, .55, 1.) * SCALE_NEW / 30.44 * np.exp(shock[:, dmi + 12]) * rng.gamma(150, 1 / 150, (3, nd)) * dayf
    chm = np.repeat(CHS[:, :, None], nd, 2)
    may = days >= dnum('2026-05-01'); chm[:, 1, may] *= .55; chm[:, 0, may] *= 1.06     # paid bids cut May 2026
    chm[2, 2] *= 1 + 1.4 * np.clip((tt - 21) / 8, 0, 1)                                # Portugal partners take off Q4 2025
    ps = np.repeat(np.repeat(PS[None, :, :, None], 3, 0), nd, 3)
    f30 = ps[:, :, 0] * (1 - .08 * np.clip(tt, 0, None) / 33); ps[:, :, 2] += ps[:, :, 0] - f30; ps[:, :, 0] = f30   # mix drifts to larger tickets
    w = np.vstack([np.clip((days - l) / 90, 0, 1) if l else np.zeros(nd) for l in L12])[:, None, :]
    ps[:, :, 3] = .35 * w * ps[:, :, 2] + .15 * w * ps[:, :, 1]; ps[:, :, 2] *= 1 - .35 * w; ps[:, :, 1] *= 1 - .15 * w
    seas = np.where(np.arange(5)[:, None] == 4, SEAS_B[moy], SEAS_C[moy])
    cnt = rng.poisson(A[:, None, None, :] * chm[:, :, None, :] * ps * seas[None, None])
    m, c, p, di = np.nonzero(cnt); k = cnt[m, c, p, di]
    out = dict(mk=np.repeat(m, k), ch=np.repeat(c, k), pr=np.repeat(p, k), day=np.repeat(days[di], k))
    part = agents.index[agents.agent_type == 'PARTNER'].values; pw = rng.lognormal(0, .5, len(part))
    out['ag'] = np.full(len(out['mk']), -1)
    for mm in range(3):
        sel = (out['mk'] == mm) & (out['ch'] == 2); pp = part[agents.market_code.values[part] == MK[mm]]
        out['ag'][sel] = rng.choice(pp, sel.sum(), p=pw[pp - 40] / pw[pp - 40].sum())
    # field agents: micro-business clients only, ramp 40 % -> 95 % over 9 months, skill latent, star and laggard
    ag = agents[agents.agent_type == 'AGENT']; st = ag.start_date.values.astype('datetime64[D]').astype(np.int64)
    ten = (days[None, :] - st[:, None]) / 30.44
    skill = rng.lognormal(0, .12, len(ag)); skill[0] = 1.6
    skill = np.repeat(skill[:, None], nd, 1); skill[12, days >= dnum('2026-05-01')] = .45
    tight = np.where((ag.market_code.values == 'RO')[:, None] & (days >= TIGHT)[None, :], .86, 1.)
    lam = (.55 * SCALE_NEW * np.where(ten >= 0, np.minimum(1, .40 + .60 * ten / 9), 0) * skill * tight
           * (SEAS_B[moy] * WD_AG[dow] * hol)[None, :])
    ca = rng.poisson(lam); a, di = np.nonzero(ca); k = ca[a, di]
    out = {key: np.concatenate([out[key], v]) for key, v in dict(
        mk=np.repeat(np.where(ag.market_code.values[a] == 'PL', 0, 1), k), ch=np.full(k.sum(), 3), pr=np.full(k.sum(), 4),
        day=np.repeat(days[di], k), ag=np.repeat(a, k)).items()}
    return out

def clients(rng, acq, agents):
    """Client table: acquisitions from 2023 (burn-in) plus the 2022 base of Poland (launched Mar 2022)."""
    n_pre = np.round(np.array([4000, 0, 0]) * SCALE_NEW).astype(int)
    pm = np.repeat([0, 1, 2], n_pre); npre = len(pm)
    pch = pick(rng, np.c_[CHS[pm] * .92, np.where(pm < 2, .08, 0)]); ppr = np.where(pch == 3, 4, pick(rng, PS[np.minimum(pch, 2)]))
    pday = dnum('2022-03-01') + (rng.random(npre) * (dnum('2022-12-15') - dnum('2022-03-01'))).astype(int)
    pag = np.full(npre, -1); legacy = agents.index[(agents.agent_type == 'AGENT') & (agents.start_date < '2022-12-01')].values
    for mm in range(2):
        sel = (pm == mm) & (pch == 3); pool = legacy[agents.market_code.values[legacy] == MK[mm]]
        pool = pool if len(pool) else agents.index[(agents.agent_type == 'AGENT') & (agents.market_code == MK[mm])].values; pag[sel] = rng.choice(pool, sel.sum())
        sel = (pm == mm) & (pch == 2); pool = agents.index[(agents.agent_type == 'PARTNER') & (agents.market_code == MK[mm])].values
        pag[sel] = rng.choice(pool, sel.sum())
    c = pd.DataFrame(dict(mk=np.r_[pm, acq['mk']], ch=np.r_[pch, acq['ch']], ag=np.r_[pag, acq['ag']], pr=np.r_[ppr, acq['pr']],
                          day=np.r_[pday, acq['day']], before=np.r_[1 + rng.poisson((BURN - pday) / 120), np.zeros(len(acq['mk']), int)]))
    n = len(c)
    age_p = np.array([[.34, .30, .20, .11, .05], [.24, .28, .25, .15, .08], [.30, .30, .22, .12, .06], [.10, .26, .32, .22, .10]])
    c['age'] = pick(rng, age_p[c.ch]); c['tier'] = pick(rng, np.where((c.ch == 3).values[:, None], [.20, .35, .45], [.42, .35, .23]))
    c['r'] = rng.normal(0, 1, n) + np.array([-.1, .25, .1, -.1])[c.ch] + np.array([.3, .1, 0, -.1, -.15])[c.age] + .1 * (c.tier == 2)
    return c

# ---- loans -------------------------------------------------------------------------------------------------
def loan_attrs(rng, pr, mk, day, seq, rep, r, ch):
    n = len(pr); t = mi(day).clip(0, NM - 1)
    npay = np.where(pr == 4, rng.choice([6, 9, 12], n, p=[.3, .3, .4]), NPAY[pr]); term = np.where(pr == 0, 1, np.where(pr == 1, 3, npay))
    pos = rng.beta(POS[pr] * 6, (1 - POS[pr]) * 6) * (1 + .02 * (day - D0) / 365.25) * (1 + .06 * np.minimum(seq, 3))
    prin = np.round((LO[mk] + (HI[mk] - LO[mk]) * np.clip(pos, 0, 1)) / STEP[mk]) * STEP[mk]
    apr = np.clip(rng.uniform(APR_LO[pr], APR_HI[pr]) - .02 * rep + .015 * r, .18, .45).round(4)
    pd_ = np.clip(PD_BASE[pr] * VF[mk, t] * CHF[ch] * np.where(rep, .55, 1) * np.exp(.55 * r - .15) * SCALE_PD, 0, .5)
    u = rng.random(n); kind = np.where(u < pd_, 2, np.where(u < 2.6 * pd_, 1, 0))     # 0 performing, 1 late then cures, 2 default
    s = 1 + (npay * rng.random(n) ** 1.6).astype(int)                                   # first missed instalment
    late = np.select([u < 2 * pd_, u < 2.4 * pd_], [rng.integers(3, 30, n), rng.integers(30, 60, n)], rng.integers(60, 86, n))
    due_s = day + s * INTERVAL[pr]; last_due = day + npay * INTERVAL[pr]
    end = np.where(kind == 2, due_s + 180, np.where(kind == 1, np.maximum(last_due, due_s + late), last_due))
    tod = rng.choice(1440, n, p=np.repeat(HOURS / HOURS.sum() / 60, 60))
    med = np.where(day < dnum('2025-10-01'), 6.4, 4.6) * np.where(rep, .6, 1) * np.where(ch == 3, 1.6, 1)
    h2c = np.clip(rng.lognormal(np.log(med), .65), .2, 96).round(1)
    return dict(npay=npay, term=term, prin=prin, apr=apr, kind=kind, s=s, late=late, end=end,
                dts=day * 1440 + tod, h2c=h2c, h2a=np.round(h2c * rng.beta(6, 3, n), 1))
HOURS = np.array([.2, .1, .05, .05, .05, .1, .3, .8, 1.5, 2, 2.2, 2.2, 2.1, 2, 2, 2, 2.1, 2.2, 2.2, 2, 1.6, 1.1, .7, .4])

def next_channel(rng, acq_ch, pr):
    u = rng.random(len(pr)); ch = np.zeros(len(pr), int)
    ch = np.where((acq_ch == 1) & (u < .15), 1, ch); ch = np.where((acq_ch == 2) & (u < .40), 2, ch)
    ch = np.where((acq_ch == 3) & (u < .75), 3, ch)
    return np.where(((ch == 2) & (pr > 2)) | ((ch == 3) & (pr != 4)) | ((ch == 1) & (pr == 4)), 0, ch)

def next_product(rng, pr, mk, day):
    p = TR[pr].copy()
    off = np.array([day < l if l else np.ones(len(day), bool) for l in L12])[mk, np.arange(len(day))] if len(day) else np.zeros(0, bool)
    p[off, 2] += p[off, 3]; p[off, 3] = 0
    return pick(rng, p)

def thin_day(rng, base, pr):
    """Repeat-loan date = end + gap, reshaped by weekday / payday / season through rejection (4 tries)."""
    day = base + 1 + rng.exponential(GAP[pr]).astype(int); todo = np.ones(len(base), bool)
    for _ in range(4):
        moy, dom, dow = cal(day); seas = np.where(pr == 4, SEAS_B[moy], SEAS_C[moy])
        acc = rng.random(len(day)) < WD[dow] / 1.08 * domf(dom) / 1.12 * seas / 1.22
        todo &= ~acc
        if not todo.any(): break
        day = np.where(todo, base + 1 + rng.exponential(GAP[pr]).astype(int), day)
    return day

def simulate_loans(rng, c):
    pre = (c.day < BURN).values; ccx = np.arange(len(c))
    day = np.where(pre, BURN + rng.exponential(40, len(c)).astype(int), c.day.values)
    pr = np.where(pre, next_product(rng, c.pr.values, c.mk.values, day), c.pr.values)
    ch = np.where(pre, next_channel(rng, c.ch.values, pr), c.ch.values)
    cur = dict(cl=ccx, pr=pr, ch=ch, day=day, seq=c.before.values, rep=pre)
    cur = {k: v[day <= CUT] for k, v in cur.items()}; gens = []
    cm, cr, cch, cag = c.mk.values, c.r.values, c.ch.values, c.ag.values
    while len(cur['cl']):
        mk = cm[cur['cl']]; a = loan_attrs(rng, cur['pr'], mk, cur['day'], cur['seq'], cur['rep'], cr[cur['cl']], cur['ch'])
        gens.append({**cur, **a, 'mk': mk})
        tt = (cur['day'] - D0) / 1004
        p = PRET[cur['pr']] * (.92 + .13 * tt) * np.where((mk == 1) & (cur['day'] >= TIGHT), .93, 1) \
            * np.where((a['kind'] == 1) & (a['late'] >= 30), .6, 1) * SCALE_RET
        go = (a['kind'] != 2) & ~((a['kind'] == 1) & (a['late'] >= 60)) & (rng.random(len(p)) < p)
        nday = thin_day(rng, a['end'], cur['pr']); go &= nday <= CUT
        cl = cur['cl'][go]; npr = next_product(rng, cur['pr'][go], cm[cl], nday[go])
        nch = next_channel(rng, cch[cl], npr)   # laggard agent (A013) loses most returning clients to the app from May 2026
        nch = np.where((nch == 3) & (cag[cl] == 12) & (nday[go] >= dnum('2026-05-01')) & (rng.random(len(cl)) < .6), 0, nch)
        cur = dict(cl=cl, pr=npr, ch=nch, day=nday[go], seq=cur['seq'][go] + 1, rep=np.ones(go.sum(), bool))
    L = pd.DataFrame({k: np.concatenate([g[k] for g in gens]) for k in gens[0]})
    L['ag'] = np.where(L.ch.isin([2, 3]), cag[L.cl], -1)
    L = L.sort_values(['dts', 'cl'], kind='stable').reset_index(drop=True)
    L['sts'] = L.dts - np.round(L.h2c * 60).astype(np.int64); L['sday'] = L.sts // 1440
    return L

def portfolio(L):
    """Month-end snapshots per loan (in memory, from Jan 2023) -> fact_loan_month cells; close state per loan (Sep 2026)."""
    n = len(L); day, P, apr = L.day.values, L.prin.values, L.apr.values
    iv, npay, kind, s, late, end = INTERVAL[L.pr.values], L.npay.values, L.kind.values, L.s.values, L.late.values, L.end.values
    due_s = day + s * iv; vm = mi(day) + 12
    key = ((((vm * 3 + L.mk.values) * 5 + L.pr.values) * 4 + L.ch.values) * 2 + L.rep.values.astype(int))
    Oprev, dprev, maxd = P.copy(), np.zeros(n, int), np.zeros(n, int)
    close = dict(dpd=np.zeros(n, int), out=np.zeros(n)); cells = []
    for t in range(-12, NC):
        E, Ep = MEX[t + 12], MSX[t + 12] - 1
        i = np.nonzero((day <= E) & (end > Ep))[0]
        nd_ = np.clip((E - day[i]) // iv[i], 0, npay[i])
        stuck = ((kind[i] == 1) & (nd_ >= s[i]) & (E < due_s[i] + late[i])) | ((kind[i] == 2) & (nd_ >= s[i]))
        paid = np.where(stuck, s[i] - 1, nd_); dpd_raw = np.where(stuck, E - due_s[i], 0)
        wo = (kind[i] == 2) & (E >= end[i]); gone = E >= end[i]
        O = np.where(gone, 0., np.round(P[i] * (1 - paid / npay[i]), 2))
        dpd = np.where(gone, 0, dpd_raw)
        new = day[i] > Ep; base = np.where(new, P[i], Oprev[i])
        days_alive = np.clip(np.minimum(E, end[i]) - np.maximum(Ep, day[i]), 0, None)
        interest = np.where(dprev[i] >= 90, 0., np.round(base * apr[i] / 365 * days_alive, 2))
        fee = np.where((dpd >= 1) & (dpd <= 89), LATE_FEE[L.mk.values[i]], 0.)
        woamt = np.where(wo, base, 0.)
        f30 = (dpd_raw >= 30) & (maxd[i] < 30); f90 = (dpd_raw >= 90) & (maxd[i] < 90)
        maxd[i] = np.maximum(maxd[i], dpd_raw); Oprev[i] = O; dprev[i] = dpd
        if t == NC - 1: close['dpd'][i] = dpd; close['out'][i] = O
        vals = dict(loans_disbursed=new * 1., principal_disbursed_local=np.where(new, P[i], 0.), loans_active=(O > 0) * 1.,
                    outstanding_local=O, bal_current_local=np.where(dpd == 0, O, 0.), bal_dpd_1_29_local=np.where((dpd >= 1) & (dpd < 30), O, 0.),
                    bal_dpd_30_59_local=np.where((dpd >= 30) & (dpd < 60), O, 0.), bal_dpd_60_89_local=np.where((dpd >= 60) & (dpd < 90), O, 0.),
                    bal_dpd_90p_local=np.where(dpd >= 90, O, 0.), loans_dpd_30p=((dpd >= 30) & (O > 0)) * 1., loans_first_30p=f30 * 1.,
                    loans_first_90p=f90 * 1., written_off_local=woamt, interest_local=interest, late_fee_local=fee,
                    provision_stock_local=np.round(O * COV[np.select([dpd == 0, dpd < 30, dpd < 60, dpd < 90], [0, 1, 2, 3], 4)], 2))
        uk, inv = np.unique(key[i], return_inverse=True)
        df = pd.DataFrame({k: np.bincount(inv, v, len(uk)) for k, v in vals.items()}); df['key'] = uk; df['t'] = t; cells.append(df)
    lm = pd.concat(cells, ignore_index=True)
    k = lm.pop('key').values; lm['rep'] = k % 2; k //= 2; lm['ch'] = k % 4; k //= 4; lm['pr'] = k % 5; k //= 5; lm['mk'] = k % 3; lm['vm'] = k // 3 - 12
    return lm, close, maxd

# ---- revenue streams outside the loan book -----------------------------------------------------------------
def subscriptions(rng, newc, pre_base, target_eur, RATE, scale=None):
    """Plus / Pro / Free subscribers per market x month; Plus price rise Jan 2026 -> churn spike Q1 2026."""
    t = np.arange(NC); rows = []
    price = {'PLUS': np.array([[17.99, 21.99], [19.99, 24.99], [3.99, 4.99]]), 'PRO': np.array([[39.99, 39.99], [49.99, 49.99], [9.99, 9.99]])}
    churn = {'PLUS': np.where(t == 24, .032, np.where((t == 25) | (t == 26), .041, .024)), 'PRO': np.where((t >= 24) & (t <= 26), .02, .016)}
    adds = {'PLUS': .10 * (1 + .1 * t / 33) * np.where(t >= 24, .9, 1), 'PRO': .035 * (1 + .2 * t / 33)}
    k = 1. if scale is None else scale
    for m in range(3):
        for tier in ['FREE', 'PLUS', 'PRO']:
            if tier == 'FREE': s0, a, ch = pre_base[m] * 1.6, 1.5 * newc[m], np.full(NC, .01); pr = np.zeros((NC,))
            else:   # paying tiers start near steady state (adds / churn)
                s0, a, ch = .8 * k * adds[tier][0] * newc[m][0] / churn[tier][0], k * adds[tier] * newc[m], churn[tier]; pr = price[tier][m][(t >= 24).astype(int)]
            st = int(round(s0))
            for i in range(NC):
                nw = int(round(a[i] * rng.gamma(200, 1 / 200))); cu = int(round(st * ch[i])); en = st + nw - cu
                rows.append((MKEY[i], MK[m], tier, CCY[m], st, nw, cu, en, pr[i])); st = en
    s = pd.DataFrame(rows, columns=['month_key', 'market_code', 'product_code', 'currency_code', 'subscribers_start', 'subscribers_new',
                                    'subscribers_churned', 'subscribers_end', 'price_local'])
    s['revenue_local'] = ((s.subscribers_start + s.subscribers_end) / 2 * s.price_local).round(2)
    s['mrr_local'] = (s.subscribers_end * s.price_local).round(2)
    if scale is None:   # calibrate the paying base so subscriptions are 11 % of FY2026 YTD revenue
        r26 = (s.revenue_local / RATE[s.market_code.map(MK.index), s.month_key.map(list(MKEY).index)])[s.month_key >= '2026-01'].sum()
        return subscriptions(np.random.default_rng(SEED + 7), newc, pre_base, target_eur, RATE, target_eur / r26)
    return s

# ---- targets (Budget) ----------------------------------------------------------------------------------------
def variance(mk, t, pr, metric, rng):
    """Actual vs Budget story (local currency): RO misses after Mar 2026, PT beats, PL slightly ahead."""
    y = t // 12; v = np.select([y == 0, y == 1], [np.array([.02, .01, -.03])[mk], np.array([.03, .0, .06])[mk]], np.array([.015, 0, .14])[mk])
    v = np.where((mk == 1) & (y == 1), np.where(t < 18, .04, -.02), v); v = np.where((mk == 1) & (y == 2), np.where(t < 26, .01, -.12), v)
    v = v + np.where(y == 2, np.select([pr == 3, pr == 2], [.15, -.08], 0), 0) + {'LOANS': -.01, 'NEW_CLIENTS': -.02}.get(metric, 0)
    return v + rng.normal(0, .02, len(mk))

def budget(rng, act, keys, metric, dec):
    """Budget = actual / (1 + variance) for months with actuals (<= Sep 2026); Oct - Dec 2026 = PY x FY2026 YTD growth."""
    a = act.copy(); a = a[a.t < NC]
    a['target_value'] = a.value / (1 + variance(a.mk.values, a.t.values, a.pr.values, metric, rng))
    py = a[(a.t >= 21) & (a.t < 24)].copy(); g = a[a.t >= 24].groupby(keys).target_value.sum() / a[(a.t >= 12) & (a.t < 21)].groupby(keys).value.sum()
    py = py.merge(g.rename('g').reset_index(), on=keys, how='left')
    py['target_value'] = py.value * py.g.fillna(1.1).clip(.5, 2); py['t'] += 12; py = py.drop(columns='g')
    b = pd.concat([a, py]); b['target_value'] = b.target_value.round(dec); b['metric_code'] = metric; return b

# ---- control totals --------------------------------------------------------------------------------------------
def periods():
    p = [(MKEY[t], [t], t if t < NC else None, t < NC) for t in range(NC + 1)]
    return p + [('FY2024', list(range(12)), 11, True), ('FY2025', list(range(12, 24)), 23, True),
                ('FY2026_YTD_SEP', list(range(24, 33)), 32, True), ('TOTAL', list(range(34)), 32, True)]

def control_totals(loan, lm, rev, RATE):
    lt = mi(loan.disbursed_date.values.astype('datetime64[D]')); lmk = loan.market_code.map(MK.index).values
    loan = loan.assign(t=lt, m=lmk, eur=loan.principal_local / RATE[lmk, lt])
    lm = lm.assign(t=lm.month_key.map(list(MKEY).index), m=lm.market_code.map(MK.index))
    lm = lm.assign(o=lm.outstanding_local / RATE[lm.m, lm.t], d30=(lm.bal_dpd_30_59_local + lm.bal_dpd_60_89_local + lm.bal_dpd_90p_local) / RATE[lm.m, lm.t],
                   d90=lm.bal_dpd_90p_local / RATE[lm.m, lm.t])
    rev = rev.assign(t=rev.month_key.map(list(MKEY).index), m=rev.market_code.map(MK.index)); rev = rev.assign(e=rev.amount_local / RATE[rev.m, rev.t])
    rows = []
    for name, ts, snap, has_rev in periods():
        for m in [0, 1, 2, None]:
            x = loan[loan.t.isin(ts) & ((loan.m == m) if m is not None else True)]
            b, rc = x.client_id.nunique(), x.loc[x.is_repeat, 'client_id'].nunique()
            v = dict(loans_count=len(x), principal_eur=x.eur.sum(), new_clients=int(x.is_first_loan.sum()), borrowers=b, returning_clients=rc,
                     returning_pct_clients=rc / b if b else np.nan, returning_pct_loans=x.is_repeat.mean() if len(x) else np.nan)
            if snap is not None:
                y = lm[(lm.t == snap) & ((lm.m == m) if m is not None else True)]
                v.update(outstanding_eur=y.o.sum(), dpd30_balance_eur=y.d30.sum(), dpd30_pct=y.d30.sum() / y.o.sum(), dpd90_pct=y.d90.sum() / y.o.sum())
            if has_rev:
                z = rev[rev.t.isin(ts) & ((rev.m == m) if m is not None else True)]; v['revenue_eur'] = z.e.sum()
                for rt in ['INTEREST', 'FEE', 'INTERCHANGE', 'SUBSCRIPTION']: v[f'revenue_{rt.lower()}_eur'] = z.loc[z.revenue_type_code == rt, 'e'].sum()
            for k_, val in v.items():
                dec = 6 if k_.endswith('_pct') or 'pct_' in k_ else (2 if k_.endswith('_eur') else 0)
                rows.append((MK[m] if m is not None else 'ALL', name, k_, f'{val:.{dec}f}' if pd.notna(val) else ''))
    return pd.DataFrame(rows, columns=['market_code', 'period', 'metric_code', 'value'])

# ---- writing --------------------------------------------------------------------------------------------------
DEC = dict(hours_to_approve=1, principal_local=2, outstanding_local_close=2, origination_fee_local=2, apr=4, hours_to_cash=1, local_per_eur=6,
           target_value=None, price_local=2, min_value=None, max_value=None)
def write(out, folder, name, df, manifest, split=None):
    pa_t = pa.Table.from_pandas(df, preserve_index=False)
    cols = []
    for f in pa_t.schema:
        col = pa_t[f.name]
        if f.name.endswith('_date') or f.name in ('date', 'month_start'): col = col.cast(pa.date32())
        elif f.name.endswith('_ts'): col = col.cast(pa.timestamp('s'))
        cols.append(col)
    pa_t = pa.table(cols, names=pa_t.schema.names)
    pq.write_table(pa_t, out / 'parquet' / f'{name}.parquet', compression='snappy')
    c = df.copy()
    for k in c.columns:
        if c[k].dtype == bool: c[k] = np.where(c[k], 'TRUE', 'FALSE')
        elif k.endswith('_ts'): c[k] = pd.to_datetime(c[k]).dt.strftime('%Y-%m-%dT%H:%M')
        elif k.endswith('_date') or k in ('date', 'month_start'): c[k] = pd.to_datetime(c[k]).dt.strftime('%Y-%m-%d').fillna('')
        elif c[k].dtype.kind == 'f':
            d = DEC.get(k, 6 if k.endswith('_eur') else 2)
            v = c[k].values; s = np.char.mod(f'%.{d}f', np.nan_to_num(v)) if d is not None else c[k].map(lambda x: np.format_float_positional(x, trim='-')).values
            c[k] = np.where(np.isnan(v), '', s)
    (out / folder).mkdir(parents=True, exist_ok=True)
    parts = {f'{name}.csv': c} if split is None else {f'{name}_{y}.csv': c[c[split].str[:4] == y] for y in sorted(c[split].str[:4].unique())}
    for fn, part in parts.items(): part.to_csv(out / folder / fn, index=False, lineterminator='\n')
    manifest.append(dict(table=name, folder=folder, rows=len(df), csv_files=list(parts), csv_bytes=sum((out / folder / f).stat().st_size for f in parts),
                         parquet_bytes=(out / 'parquet' / f'{name}.parquet').stat().st_size,
                         columns={f.name: str(f.type) for f in pa_t.schema}))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent)); out = Path(ap.parse_args().out)
    t0 = time.time(); rng = np.random.default_rng(SEED); (out / 'parquet').mkdir(parents=True, exist_ok=True); (out / 'checks').mkdir(exist_ok=True)
    # FX: local per EUR, monthly average actual (Oct 2026 = month to date) and one budget rate per year
    tm = np.arange(NM)
    pln = np.interp(tm, [0, 5, 11, 17, 23, 28, 32, 33, 35], [4.36, 4.31, 4.27, 4.25, 4.22, 4.25, 4.63, 4.64, 4.64]) * (1 + rng.normal(0, .003, NM))
    RATE = np.vstack([pln, 4.972 * 1.02 ** (tm / 12) * (1 + rng.normal(0, .002, NM)), np.ones(NM)]).round(6)
    BRATE = np.array([[4.40, 4.30, 4.18], [4.95, 5.00, 5.08], [1., 1., 1.]])[:, tm // 12]   # 2026 budget assumed a stronger PLN
    agents = build_agents(rng); acq = acquisition(rng, agents); c = clients(rng, acq, agents)
    L = simulate_loans(rng, c)
    lmc, close, maxd = portfolio(L)
    cell = ['mk', 'pr', 'ch', 'rep', 'vm']; lmc = lmc.sort_values(cell + ['t']).reset_index(drop=True)
    for k in lmc.columns[lmc.columns.str.endswith('_local')]: lmc[k] = lmc[k].round(2)
    g = lmc.groupby(cell); prev_o, prev_p = g.outstanding_local.shift().fillna(0), g.provision_stock_local.shift().fillna(0)
    lmc['principal_repaid_local'] = (prev_o + lmc.principal_disbursed_local - lmc.outstanding_local - lmc.written_off_local).round(2)
    lmc['provision_local'] = (lmc.provision_stock_local - prev_p + lmc.written_off_local).round(2)   # charge = change in stock + write-offs
    lmc = lmc[lmc.t >= 0].reset_index(drop=True)
    # origination fee calibrated so fees = 21 % and interest = 60 % of FY2026 YTD revenue (concept §1.1)
    i26 = (lmc.interest_local / RATE[lmc.mk, lmc.t])[lmc.t >= 24].sum(); late26 = (lmc.late_fee_local / RATE[lmc.mk, lmc.t])[lmc.t >= 24].sum()
    lt = mi(L.day.values); base = FEE_BASE[L.pr] * L.prin / RATE[L.mk, lt.clip(0)]
    kfee = (.35 * i26 - late26) / base[(lt >= 24) & (lt < NC)].sum(); L['fee'] = np.round(FEE_BASE[L.pr] * kfee * L.prin, 2)
    inw = (lt >= 0) & (lt < NC)
    fees = L[inw].assign(t=lt[inw], vm=lt[inw], rep=L.rep.astype(int)).groupby(['t', 'vm', 'mk', 'pr', 'ch', 'rep']).fee.sum().rename('orig')
    lmc = lmc.merge(fees.reset_index(), on=['t', 'vm', 'mk', 'pr', 'ch', 'rep'], how='left').fillna({'orig': 0})
    lmc['fee_local'] = (lmc.orig + lmc.late_fee_local).round(2)
    lmc['currency_code'] = np.array(CCY)[lmc.mk]
    # window = loans disbursed 2024-01-01 .. 2026-10-25; client ids by first loan date; loan ids by disbursement time
    W = L.day.values >= D0; nb = L[~W].groupby('cl').size()
    c = c.loc[c.index.isin(L.cl[W].unique())].copy(); c['before'] += nb.reindex(c.index).fillna(0).astype(int).values
    c = c.sort_values(['day', 'mk'], kind='stable'); c['client_id'] = np.arange(1, len(c) + 1) + 100000
    cid = pd.Series(c.client_id.values, index=c.index)
    st = np.where(L.day > CLOSE, 'AFTER_CLOSE', np.where(L.end <= CLOSE, np.where(L.kind == 2, 'WRITTEN_OFF', 'REPAID'),
                  np.select([close['dpd'] == 0, close['dpd'] < 30, close['dpd'] < 60, close['dpd'] < 90], ['CURRENT', 'DPD_1_29', 'DPD_30_59', 'DPD_60_89'], 'DPD_90P')))
    after = L.day.values > CLOSE
    loan = pd.DataFrame(dict(
        loan_id=0, application_id=0, client_id=cid.reindex(L.cl).values,
        market_code=np.array(MK)[L.mk], product_code=np.array(PR)[L.pr], channel_code=np.array(CH)[L.ch],
        agent_code=np.where(L.ag >= 0, agents.agent_code.values[L.ag.clip(0)], None), currency_code=np.array(CCY)[L.mk],
        submitted_ts=(L.sts.values * 60).astype('datetime64[s]'), hours_to_approve=L.h2a, hours_to_cash=L.h2c,
        disbursed_date=L.day.values.astype('datetime64[D]'), principal_local=L.prin, principal_eur=(L.prin / RATE[L.mk, lt.clip(0)]).round(6),
        term_months=L.term.astype(np.int32), apr=L.apr, origination_fee_local=L.fee, is_first_loan=~L.rep.values, is_repeat=L.rep.values,
        prior_loans=L.seq.astype(np.int32), status_code=st, dpd_days_close=np.where(after, np.nan, close['dpd']),
        outstanding_local_close=np.where(after, np.nan, close['out']), max_dpd_close=np.where(after, np.nan, maxd),
        repaid_date=np.where((L.end.values <= CLOSE) & (L.kind.values != 2), L.end.values, np.iinfo(np.int64).min).astype('datetime64[D]')))[W].reset_index(drop=True)
    loan['loan_id'] = np.arange(1, len(loan) + 1) + 1000000; loan['client_id'] = loan.client_id.astype(np.int64)
    loan['application_id'] = 5000000 + np.cumsum(1 + rng.geometric(.45, len(loan)))[np.argsort(np.argsort(L.sts.values[W], kind='stable'), kind='stable')]
    for k in ['dpd_days_close', 'max_dpd_close']: loan[k] = loan[k].astype('Int32')
    # fact_application: funnel per submission day x market x channel x product x new / repeat, built back from the loans
    sday = L.sday.values; ok = W & (sday >= D0); nd = CUT - D0 + 1
    gk = (((sday - D0) * 3 + L.mk.values) * 4 + L.ch.values) * 5 + L.pr.values
    disb = np.bincount((gk * 2 + L.rep.values)[ok], minlength=nd * 120).reshape(nd, 3, 4, 5, 2)
    days = np.arange(D0, CUT + 1); moy, dom, dow = cal(days)
    valid = np.zeros((3, 4, 5, 2), bool); valid[:, 0] = True; valid[:, 1, :4] = True; valid[:, 2, :3] = True; valid[:2, 3, 4] = True
    valid[2, :, 3] = False
    v12 = np.ones((nd, 3, 1, 5, 1), bool); v12[:, 0, 0, 3, 0] = days >= L12[0]; v12[:, 1, 0, 3, 0] = days >= L12[1]; v12[:, 2, 0, 3, 0] = False
    grid = np.broadcast_to(valid[None], disb.shape) & v12 | (disb > 0)
    rep = np.arange(2)[None, None, None, None, :] == 1; d = disb.astype(float); de = d + .15
    tu = np.where(rep, .93, np.where(np.arange(4)[None, None, :, None, None] == 1, .82, .845))
    tt = ((days - D0) / 1004)[:, None, None, None, None]; ro = (np.arange(3) == 1)[None, :, None, None, None]
    car = np.where(rep, .82, np.array([.415, .395, .455])[None, :, None, None, None] + .027 * tt - np.where(ro & (days >= TIGHT)[:, None, None, None, None], .09, 0)
                   + np.array([0, -.04, .02, .08])[None, None, :, None, None])
    kp = np.where(rep, .995, np.where(ro & ((days >= dnum('2026-04-01')) & (days <= dnum('2026-05-31')))[:, None, None, None, None], .84, .89))
    approved = d + rng.poisson(de * (1 / tu - 1)); kyc = approved + rng.poisson((approved + .15) * (1 / car - 1))
    submitted = kyc + rng.poisson((kyc + .15) * (1 / kp - 1)); started = submitted + rng.poisson((submitted + .15) * (1 / np.where(rep, .92, .78) - 1))
    leads = started + np.where(rep, 0, rng.poisson((started + .3) * (1 / .42 - 1)))
    keep = grid & (started > 0); ix = np.nonzero(keep)
    app = pd.DataFrame(dict(date=days[ix[0]].astype('datetime64[D]'), market_code=np.array(MK)[ix[1]], channel_code=np.array(CH)[ix[2]],
                            product_code=np.array(PR)[ix[3]], is_repeat=ix[4] == 1, leads=leads[keep], apps_started=started[keep],
                            apps_submitted=submitted[keep], kyc_passed=kyc[keep], approved=approved[keep], disbursed=disb[keep]))
    for k in ['leads', 'apps_started', 'apps_submitted', 'kyc_passed', 'approved', 'disbursed']: app[k] = app[k].astype(np.int32)
    # fact_loan_month (vintages before 2024-01 = the opening book; they have no fact_loan rows)
    lm = pd.DataFrame(dict(month_key=MKEY[lmc.t], vintage_month=MKX[lmc.vm + 12], market_code=np.array(MK)[lmc.mk], product_code=np.array(PR)[lmc.pr],
                           channel_code=np.array(CH)[lmc.ch], is_repeat=lmc.rep.values == 1, currency_code=lmc.currency_code))
    for k in ['loans_disbursed', 'loans_active', 'loans_dpd_30p', 'loans_first_30p', 'loans_first_90p']: lm[k] = lmc[k].round().astype(np.int32)
    for k in ['principal_disbursed_local', 'outstanding_local', 'bal_current_local', 'bal_dpd_1_29_local', 'bal_dpd_30_59_local', 'bal_dpd_60_89_local',
              'bal_dpd_90p_local', 'principal_repaid_local', 'written_off_local', 'provision_local', 'interest_local', 'fee_local']: lm[k] = lmc[k]
    lm = lm.sort_values(['month_key', 'vintage_month', 'market_code', 'product_code', 'channel_code', 'is_repeat']).reset_index(drop=True)
    # revenue: interest + fees from the loan book; interchange and subscriptions calibrated to 8 % / 11 % of FY2026 YTD
    r_eur = i26 / .60
    nm = W & ~L.rep.values & (lt < NC); newc = np.zeros((3, NC)); np.add.at(newc, (L.mk.values[nm], lt[nm]), 1)
    pre_base = np.bincount(c.mk[c.day < D0], minlength=3) * 1.
    sub = subscriptions(rng, newc, pre_base, .11 * r_eur, RATE)
    acc = sub.groupby(['market_code', 'month_key'], sort=False).subscribers_end.sum().unstack().loc[MK, MKEY[:NC]].values
    card = acc * np.array([.9, .9, 1, 1, 1, 1, 1.08, 1.08, 1, 1, 1.08, 1.25])[np.arange(NC) % 12] * rng.gamma(200, 1 / 200, (3, NC))
    card *= .08 * r_eur / (card / RATE[:, :NC])[:, 24:].sum()
    loanrev = lm.groupby(['month_key', 'market_code', 'product_code']).agg(INTEREST=('interest_local', 'sum'), FEE=('fee_local', 'sum'))
    loanrev = loanrev.stack().rename('amount_local').reset_index().rename(columns={'level_3': 'revenue_type_code'})
    cardrev = pd.DataFrame(dict(month_key=np.tile(MKEY[:NC], 3), market_code=np.repeat(MK, NC), product_code='CARD', revenue_type_code='INTERCHANGE', amount_local=card.ravel()))
    subrev = sub[sub.product_code != 'FREE'][['month_key', 'market_code', 'product_code', 'revenue_local']].rename(columns={'revenue_local': 'amount_local'}).assign(revenue_type_code='SUBSCRIPTION')
    rev = pd.concat([loanrev, cardrev, subrev], ignore_index=True)
    rev['amount_local'] = rev.amount_local.round(2); rev['currency_code'] = rev.market_code.map(dict(zip(MK, CCY)))
    rt = rev.month_key.map(list(MKEY).index); rm = rev.market_code.map(MK.index); rev['amount_eur'] = (rev.amount_local / RATE[rm, rt]).round(6)
    rev = rev[['month_key', 'market_code', 'product_code', 'revenue_type_code', 'currency_code', 'amount_local', 'amount_eur']].sort_values(['month_key', 'market_code', 'product_code', 'revenue_type_code'])
    for k in ['revenue_local', 'mrr_local']: sub[k.replace('local', 'eur')] = (sub[k] / RATE[sub.market_code.map(MK.index), sub.month_key.map(list(MKEY).index)]).round(6)
    # targets
    keys = ['mk', 'pr']; tg = []
    la = L[W].assign(t=lt[W]).groupby(['t', 'mk', 'pr']).agg(LOANS=('prin', 'size'), PRINCIPAL_LOCAL=('prin', 'sum'), NEW_CLIENTS=('rep', lambda x: (~x).sum())).reset_index()
    for met, dec in [('LOANS', 0), ('PRINCIPAL_LOCAL', 2), ('NEW_CLIENTS', 0)]:
        tg.append(budget(rng, la.rename(columns={met: 'value'})[['t', 'mk', 'pr', 'value']], keys, met, dec))
    ra = rev.assign(t=rt, mk=rm, pr=rev.product_code).groupby(['t', 'mk', 'pr']).amount_local.sum().rename('value').reset_index()
    ra['pr'] = ra.pr.map({p: i for i, p in enumerate(PR + ['PLUS', 'PRO', 'CARD'])})
    tg.append(budget(rng, ra, keys, 'REVENUE_LOCAL', 2))
    tg = pd.concat(tg, ignore_index=True)
    tgt = pd.DataFrame(dict(version_code='BUD', month_key=MKEY[tg.t], market_code=np.array(MK)[tg.mk], product_code=np.array(PR + ['PLUS', 'PRO', 'CARD'])[tg.pr],
                            agent_code=None, metric_code=tg.metric_code, currency_code=np.where(tg.metric_code.str.endswith('LOCAL'), np.array(CCY)[tg.mk], None),
                            target_value=tg.target_value))
    appetite = np.array([[.038, .038, .040], [.040, .040, .045], [.040, .038, .042]])   # planned 30+ DPD ratio (risk appetite)
    dp = pd.DataFrame(dict(version_code='BUD', month_key=np.tile(MKEY, 3), market_code=np.repeat(MK, NM), product_code=None, agent_code=None,
                           metric_code='DPD30_RATIO', currency_code=None, target_value=appetite[np.repeat([0, 1, 2], NM), np.tile(tm // 12, 3)]))
    al = L[W & (L.ch.values == 3)].assign(t=lt[W & (L.ch.values == 3)]).groupby(['ag', 't']).agg(n=('prin', 'size'), p=('prin', 'sum')).reset_index()
    al['mk'] = np.where(agents.market_code.values[al.ag] == 'PL', 0, 1)
    mature = ~agents.is_ramp_cohort.values[al.ag] & ~np.isin(al.ag, [0, 12]) & (al.t - mi(agents.start_date.values[al.ag].astype('datetime64[D]')) >= 9)
    med = al[mature & (al.t < NC)].groupby(['mk', 't'])[['n', 'p']].median()
    py = med.reset_index(); py = py[(py.t >= 21) & (py.t < 24)].assign(t=lambda x: x.t + 12).set_index(['mk', 't'])
    med = pd.concat([med, py * 1.08]).reindex(pd.MultiIndex.from_product([[0, 1], range(NM)], names=['mk', 't']))
    med = med.groupby(level=0).ffill().groupby(level=0).bfill()
    ag = agents[agents.agent_type == 'AGENT'].reset_index(drop=True); qrows = []
    for a, r_ in ag.iterrows():
        for t in range(max(0, int(mi(np.datetime64(r_.start_date, 'D')))), NM):
            n_, p_ = med.loc[(MK.index(r_.market_code), t)] * (.62 if t - mi(np.datetime64(r_.start_date, 'D')) < 12 else 1.)   # first-year quota: no repeat book yet
            qrows += [('BUD', MKEY[t], r_.market_code, 'BIZ', r_.agent_code, 'AGENT_LOANS', None, round(n_)),
                      ('BUD', MKEY[t], r_.market_code, 'BIZ', r_.agent_code, 'AGENT_PRINCIPAL_LOCAL', CCY[MK.index(r_.market_code)], round(p_ / 50) * 50.)]
    tgt = pd.concat([tgt, dp, pd.DataFrame(qrows, columns=tgt.columns)], ignore_index=True)
    tgt['target_value'] = tgt.target_value.astype(float)
    # dimensions and params
    dts = pd.date_range('2024-01-01', '2026-12-31'); dd = np.arange(dnum('2024-01-01'), dnum('2026-12-31') + 1)
    dim_date = pd.DataFrame(dict(date=dts, month_key=dts.strftime('%Y-%m'), year=dts.year, quarter=dts.quarter, year_quarter=dts.strftime('%Y-Q') + dts.quarter.astype(str),
                                 month_num=dts.month, month_name=dts.strftime('%b'), day_of_month=dts.day, weekday_num=dts.dayofweek + 1, weekday_name=dts.strftime('%a'),
                                 is_weekend=dts.dayofweek >= 5, is_closed=dd <= CLOSE, has_actuals=dd <= CUT))
    ms = pd.to_datetime(MSTART.astype('datetime64[D]'))
    dim_month = pd.DataFrame(dict(month_key=MKEY, month_start=ms, month_index=tm + 1, year=ms.year, quarter=ms.quarter, month_name=ms.strftime('%b'),
                                  days_in_month=ms.days_in_month, is_closed=tm < NC, has_actuals=tm <= NC))
    dim_market = pd.DataFrame(dict(market_code=MK, market_name=['Poland', 'Romania', 'Portugal'], currency_code=CCY,
                                   launch_date=pd.to_datetime(['2022-03-01', '2023-04-01', '2024-01-01']), sort_order=[1, 2, 3]))
    dim_product = pd.DataFrame(dict(product_code=PR + ['FREE', 'PLUS', 'PRO', 'CARD'], product_name=['Flex 30', 'Flex 90', 'Step 6', 'Step 12', 'Biz Boost', 'Free', 'Plus', 'Pro', 'Debit card'],
                                    product_line=['Microloan'] * 5 + ['Account'] * 3 + ['Card'], segment_code=['CONSUMER'] * 4 + ['MICRO_BUSINESS'] + [None] * 4,
                                    repayment_type=['Bullet', 'Bullet', 'Instalment', 'Instalment', 'Instalment'] + [None] * 4,
                                    term_months=pd.array([1, 3, 6, 12, None] + [None] * 4, dtype='Int32'), tenor_days=pd.array([30, 90, 180, 360, None] + [None] * 4, dtype='Int32'),
                                    pl_launch_date=pd.to_datetime(['2022-03-01'] * 3 + ['2025-06-01', '2022-03-01'] + ['2022-03-01'] * 4),
                                    ro_launch_date=pd.to_datetime(['2023-04-01'] * 3 + ['2025-09-01', '2023-04-01'] + ['2023-04-01'] * 4),
                                    pt_launch_date=pd.to_datetime(['2024-01-01'] * 3 + [None, '2024-01-01'] + ['2024-01-01'] * 4), sort_order=range(1, 10)))
    dim_channel = pd.DataFrame(dict(channel_code=CH, channel_name=['App organic', 'Paid', 'Partner', 'Agent'], is_assisted=[False, False, True, True], sort_order=[1, 2, 3, 4]))
    dim_agent = agents.assign(sort_order=range(1, len(agents) + 1))
    bands = np.array(['1995-2006', '1985-1994', '1975-1984', '1965-1974', '1955-1964'])
    dim_client = pd.DataFrame(dict(client_id=c.client_id.values, market_code=np.array(MK)[c.mk], segment_code=np.where(c.pr == 4, 'MICRO_BUSINESS', 'CONSUMER'),
                                   acquisition_channel_code=np.array(CH)[c.ch], acquisition_agent_code=np.where(c.ag >= 0, agents.agent_code.values[c.ag.clip(0)], None),
                                   first_loan_date=c.day.values.astype('datetime64[D]'), first_product_code=np.array(PR)[c.pr], cohort_month=pd.to_datetime(c.day.values.astype('datetime64[D]')).strftime('%Y-%m'), birth_year_band=bands[c.age], city_tier=(c.tier + 1).astype(np.int32),
                                   loans_before_2024=c.before.astype(np.int32)))
    dim_loan_status = pd.DataFrame([('CURRENT', 'Current', 'Active', 0, 0, True, False, False, 1), ('DPD_1_29', '1-29 days past due', 'Active', 1, 29, True, False, False, 2),
                                    ('DPD_30_59', '30-59 days past due', 'Active', 30, 59, True, True, False, 3), ('DPD_60_89', '60-89 days past due', 'Active', 60, 89, True, True, False, 4),
                                    ('DPD_90P', '90+ days past due', 'Active', 90, 179, True, True, True, 5), ('REPAID', 'Repaid', 'Closed', None, None, False, False, False, 6),
                                    ('WRITTEN_OFF', 'Written off (180 DPD)', 'Closed', None, None, False, False, True, 7),
                                    ('AFTER_CLOSE', 'Disbursed after the last closed month', 'Not in snapshot', None, None, False, False, False, 8)],
                                   columns=['status_code', 'status_name', 'status_group', 'dpd_min', 'dpd_max', 'is_active', 'is_overdue_30', 'is_bad_90', 'sort_order'])
    for k in ['dpd_min', 'dpd_max']: dim_loan_status[k] = dim_loan_status[k].astype('Int32')
    dim_funnel_stage = pd.DataFrame([('LEAD', 'Lead', 1, False, 'Progress', 'leads', None), ('STARTED', 'Application started', 2, False, 'Progress', 'apps_started', 168),
                                     ('SUBMITTED', 'Submitted', 3, False, 'Progress', 'apps_submitted', 2), ('KYC_PASSED', 'KYC passed', 4, False, 'Progress', 'kyc_passed', 1),
                                     ('APPROVED', 'Credit approved', 5, False, 'Progress', 'approved', 24), ('DISBURSED', 'Disbursed', 6, True, 'Won', 'disbursed', None),
                                     ('ABANDONED', 'Abandoned', 7, True, 'Lost', 'apps_started - apps_submitted', None), ('DECLINED_KYC', 'Declined at KYC', 8, True, 'Lost', 'apps_submitted - kyc_passed', None),
                                     ('DECLINED_CREDIT', 'Declined by credit', 9, True, 'Lost', 'kyc_passed - approved', None), ('NOT_TAKEN_UP', 'Not taken up', 10, True, 'Lost', 'approved - disbursed', None)],
                                    columns=['stage_code', 'stage_name', 'sort_order', 'is_terminal', 'outcome', 'fact_column', 'sla_hours'])
    dim_funnel_stage['sla_hours'] = dim_funnel_stage.sla_hours.astype('Int32')
    dim_revenue_type = pd.DataFrame(dict(revenue_type_code=['INTEREST', 'FEE', 'INTERCHANGE', 'SUBSCRIPTION'], revenue_type_name=['Interest income', 'Fees', 'Interchange', 'Subscriptions'], sort_order=[1, 2, 3, 4]))
    param_fx = pd.concat([pd.DataFrame(dict(currency_code=np.repeat(CCY, NC + 1), month_key=np.tile(MKEY[:NC + 1], 3), rate_type='ACTUAL_AVG', local_per_eur=RATE[:, :NC + 1].ravel())),
                          pd.DataFrame(dict(currency_code=np.repeat(CCY, NM), month_key=np.tile(MKEY, 3), rate_type='BUDGET', local_per_eur=BRATE.ravel()))], ignore_index=True)
    param_thresholds = pd.DataFrame([('DPD_BUCKET', 'dpd_days', 'CURRENT', 0, 0, 'Current'), ('DPD_BUCKET', 'dpd_days', 'DPD_1_29', 1, 29, '1-29'), ('DPD_BUCKET', 'dpd_days', 'DPD_30_59', 30, 59, '30-59'),
                                     ('DPD_BUCKET', 'dpd_days', 'DPD_60_89', 60, 89, '60-89'), ('DPD_BUCKET', 'dpd_days', 'DPD_90P', 90, 179, '90+'), ('WRITE_OFF', 'dpd_days', 'WRITTEN_OFF', 180, None, 'Written off at 180 DPD'),
                                     ('KPI_STATUS', 'dpd30_pct', 'GREEN', 0, .045, 'Within appetite'), ('KPI_STATUS', 'dpd30_pct', 'AMBER', .045, .06, 'Watch'), ('KPI_STATUS', 'dpd30_pct', 'RED', .06, None, 'Above appetite'),
                                     ('KPI_STATUS', 'approval_rate', 'RED', 0, .40, 'Below plan range'), ('KPI_STATUS', 'approval_rate', 'GREEN', .40, .60, 'In range'),
                                     ('KPI_STATUS', 'attainment_pct', 'RED', 0, .95, 'Behind'), ('KPI_STATUS', 'attainment_pct', 'AMBER', .95, 1.0, 'Close'), ('KPI_STATUS', 'attainment_pct', 'GREEN', 1.0, None, 'On / above target')],
                                    columns=['threshold_set', 'metric_code', 'band_code', 'min_value', 'max_value', 'label']).assign(sort_order=lambda x: range(1, len(x) + 1))
    for k in ['min_value', 'max_value']: param_thresholds[k] = param_thresholds[k].astype(float)
    man = []
    for folder, name, df in [('dims', 'dim_date', dim_date), ('dims', 'dim_month', dim_month), ('dims', 'dim_market', dim_market), ('dims', 'dim_product', dim_product),
                             ('dims', 'dim_channel', dim_channel), ('dims', 'dim_agent', dim_agent), ('dims', 'dim_client', dim_client), ('dims', 'dim_loan_status', dim_loan_status),
                             ('dims', 'dim_funnel_stage', dim_funnel_stage), ('dims', 'dim_revenue_type', dim_revenue_type),
                             ('facts', 'fact_application', app), ('facts', 'fact_loan', loan), ('facts', 'fact_loan_month', lm), ('facts', 'fact_subscription_month', sub),
                             ('facts', 'fact_revenue_month', rev), ('facts', 'fact_target', tgt), ('params', 'param_fx', param_fx), ('params', 'param_thresholds', param_thresholds)]:
        write(out, folder, name, df.reset_index(drop=True), man, 'disbursed_date' if name == 'fact_loan' else None)
    ct = control_totals(loan, lm, rev, RATE); ct.to_csv(out / 'checks' / 'control_totals_eur.csv', index=False, lineterminator='\n')
    (out / 'parquet' / 'manifest.json').write_text(json.dumps(dict(seed=SEED, last_closed_month='2026-09', actuals_through='2026-10-25', tables=man), indent=1))
    for m in man: print(f"{m['table']:<26}{m['rows']:>9,} rows  csv {m['csv_bytes'] / 1e6:7.2f} MB  parquet {m['parquet_bytes'] / 1e6:6.2f} MB")
    g = ct[ct.market_code == 'ALL'].pivot(index='period', columns='metric_code', values='value')
    print(g.loc[['FY2024', 'FY2025', 'FY2026_YTD_SEP', 'TOTAL'], ['loans_count', 'principal_eur', 'new_clients', 'returning_pct_clients', 'returning_pct_loans', 'dpd30_pct', 'revenue_eur']].to_string())
    print(f'clients {len(dim_client):,}  fee multiplier {kfee:.3f}  runtime {time.time() - t0:.1f} s')

if __name__ == '__main__':
    main()

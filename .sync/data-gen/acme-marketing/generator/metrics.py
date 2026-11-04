"""Control totals of the ACME paid-acquisition dataset (A-76), computed from the Parquet tables as written, and the story check
(ADR-0015 (d), AT-02) that generate.py runs before it finishes. The metric rules are the README's "Rules to apply in your measures";
checks/verify.py recomputes every row with its own code.
"""
import numpy as np
import pandas as pd

AS_OF = np.datetime64('2026-11-03'); D0 = np.datetime64('2025-01-01')
ND = int((AS_OF - D0).astype(np.int64)) + 1
MODELS = [('DDA', 'dda'), ('LAST_CLICK', 'last_click'), ('FIRST_TOUCH', 'first_touch'), ('PLATFORM', 'platform')]
BIN_COLS = ['act_lt1h', 'act_1_6h', 'act_6_24h', 'act_1_2d', 'act_2_4d', 'act_4_7d', 'act_7_30d']
EDGES = [0, 1, 6, 24, 48, 96, 168, 720]
STEPS = [('verified', 'step_verified'), ('workspace', 'step_workspace'), ('connected', 'step_connected'), ('first_dashboard', 'step_first_dashboard'),
         ('invited', 'step_invited')]
SEGS = ['WEB_DESKTOP', 'WEB_MOBILE', 'IOS_18', 'IOS_17', 'ANDROID_14_15', 'ANDROID_LE13']
PAGES = ['LP_PRICING', 'LP_HOME', 'LP_ANALYTICS', 'LP_VS_LOOKER', 'LP_SIGNUP', 'LP_DEMO', 'LP_APP_STORE', 'LP_PLAY_STORE']
FLAGS = ['FATIGUE', 'FREQUENCY', 'INSTALL_QUALITY', 'VIEW_THROUGH', 'CPA_OVER', 'OVER_PACING', 'UNDERSPENT', 'LEARNING', 'PIPELINE_LED', 'LEAD_GOAL',
         'NO_CPA_GOAL', 'ON_TARGET']
MOVER_OBJ = ('PAID', 'INSTALL', 'PIPELINE')


def dix(d): return int((np.datetime64(d, 'D') - D0).astype(np.int64))


def ddays(s): return ((pd.to_datetime(s).to_numpy().astype('datetime64[D]') - D0).astype(np.int64))


def mindex(mk): return (pd.Series(mk).str[:4].astype(int).to_numpy() - 2025) * 12 + pd.Series(mk).str[5:7].astype(int).to_numpy() - 1


class Engine:
    def __init__(self, T):
        cp = T['dim_campaign']
        self.keys = list(cp.campaign_key); self.K = {k: i for i, k in enumerate(self.keys)}; self.NC = NC = len(self.keys)
        self.chn = cp.channel_code.to_numpy(); self.plat = cp.platform_code.to_numpy(); self.obj = cp.objective_code.to_numpy()
        self.status = cp.status_code.to_numpy(); self.brand = cp.is_brand.to_numpy(bool); self.cpa_t = cp.cpa_target_usd.to_numpy(float)
        self.T = T
        tg = T['param_target']
        self.P = {(r.scope_code, r.metric_code): r.target_value for r in tg.itertuples()}
        fin = T['param_finance']
        self.gm = float(fin[fin.metric_code == 'GROSS_MARGIN_PCT'].value.iloc[0])
        team = fin[fin.metric_code == 'PAID_TEAM_COST_MONTH_USD'].sort_values('valid_from')
        dd = np.arange(D0, AS_OF + np.timedelta64(1, 'D'))
        mi = (dd.astype('datetime64[Y]').astype(np.int64) - 55) * 12 + dd.astype('datetime64[M]').astype(np.int64) % 12
        self.mi = mi; self.dd = dd
        dm = T['dim_month']; self.dim = dm.days_in_month.to_numpy(int); self.mkeys = list(dm.month_key)
        vf = ddays(team.valid_from); val = team.value.to_numpy(float)
        self.team_day = np.array([val[np.searchsorted(vf, t, 'right') - 1] for t in range(ND)]) / self.dim[mi]

        def M(df, col, cond=None):
            m = np.zeros((NC, ND)); d = df if cond is None else df[cond]
            np.add.at(m, (d.campaign_key.map(self.K).to_numpy(), ddays(d.date)), d[col].fillna(0).to_numpy(float)); return m
        dl = T['fact_ad_delivery_day']
        self.spend, self.imp, self.clk, self.reach = (M(dl, c) for c in ('spend_usd', 'impressions', 'clicks', 'reach_7d'))
        tf = T['fact_traffic_day']
        self.sess, self.sv, self.inst, self.fo = (M(tf, c) for c in ('sessions', 'store_views', 'installs', 'first_opens'))
        self.page = {p: dict(sessions=M(tf, 'sessions', tf.page_key == p), signups=M(tf, 'signups', tf.page_key == p), bounces=M(tf, 'bounces', tf.page_key == p),
                             lcpw=M(tf.assign(x=tf.lcp_ms_p75.astype(float) * tf.sessions.astype(float)), 'x', tf.page_key == p),
                             store_views=M(tf, 'store_views', tf.page_key == p), installs=M(tf, 'installs', tf.page_key == p)) for p in PAGES}
        fu = T['fact_funnel_day']
        self.su = M(fu, 'signups'); self.trials = M(fu, 'trials'); self.step = {n: M(fu, c) for n, c in STEPS}; self.bins = [M(fu, c) for c in BIN_COLS]
        sg = T['fact_signup_segment_day']
        self.seg = {s: (M(sg, 'signups', sg.segment_code == s), M(sg, 'activated_7d', sg.segment_code == s)) for s in SEGS}
        at = T['fact_attribution_day']
        self.paid = {m: M(at, 'paid_customers', at.model_code == code) for code, m in MODELS}
        self.mrr = {m: M(at, 'new_mrr_usd', at.model_code == code) for code, m in MODELS}
        bd = T['fact_budget_month']; bm = np.zeros((NC, 24)); np.add.at(bm, (bd.campaign_key.map(self.K).to_numpy(), mindex(bd.month_key)), bd.budget_usd.to_numpy(float))
        self.plan = bm[:, mi] / self.dim[mi][None, :]
        co = T['fact_cohort_revenue_month']
        self.co = {}
        shape = (NC, 24, 24)
        for col in ('customers_start', 'churned', 'revenue_usd', 'refunds_usd', 'refund_count'):
            a = np.full(shape, np.nan); a[co.campaign_key.map(self.K).to_numpy(), mindex(co.cohort_month), co.month_offset.to_numpy()] = co[col].to_numpy(float)
            self.co[col] = a
        rt = T['fact_retention_cohort_month']; self.ret = {}
        for n in (1, 3, 7, 14, 30, 60, 90):
            r = rt[rt.day_n == n]; mm = np.zeros((NC, 24)); aa = np.zeros((NC, 24)); w = np.zeros(24, bool)
            np.add.at(mm, (r.campaign_key.map(self.K).to_numpy(), mindex(r.cohort_month)), r.users_matured.to_numpy(float))
            np.add.at(aa, (r.campaign_key.map(self.K).to_numpy(), mindex(r.cohort_month)), r.users_active.to_numpy(float))
            w[np.unique(mindex(r.cohort_month))] = True; self.ret[n] = (mm, aa, w)
        sl = T['sync_log']
        ref = np.datetime64('2026-11-04T14:55:00')
        self.age = {r.source_code: (ref - np.datetime64(pd.Timestamp(r.last_sync_ts).to_datetime64(), 's')).astype(np.int64) / 3600 for r in sl.itertuples()}
        self.sync = sl

    # ---- windows ----
    def S(self, M, cs, a, b): return float(M[np.ix_(cs, np.arange(a, b + 1))].sum())

    def lcm(self, b):                      # last complete calendar month at or before day b
        t = self.dd[b]; nxt = t + np.timedelta64(1, 'D')
        return int(self.mi[b]) if nxt.astype('datetime64[M]') != t.astype('datetime64[M]') else int(self.mi[b]) - 1

    def r90(self, cs, b, single=None):
        m = self.lcm(b) - 2
        if m < 0: return None
        rev = self.co['revenue_usd']

        def calc(cc):
            cc = [c for c in cc if rev[c, m, 0] > 0 and not np.isnan(rev[c, m, 2])]
            if not cc: return None
            return float(np.nansum(rev[cc, m, :3]) / rev[cc, m, 0].sum())
        v = calc(cs)
        if v is None and single is not None: v = calc([c for c in range(self.NC) if self.chn[c] == self.chn[single]])
        if v is None: v = calc(range(self.NC))
        return v

    def churn(self, cs, b):
        e = self.lcm(b); cal = [e - 2, e - 1, e]
        st, cu = self.co['customers_start'], self.co['churned']; num = den = 0.0
        for m in range(24):
            for k in range(1, 24):
                if m + k in cal:
                    den += np.nansum(st[cs, m, k]); num += np.nansum(cu[cs, m, k])
        return num / den if den > 0 else None

    def refund_rate(self, cs, b):
        e = int(self.mi[b]); ms = [m for m in range(e - 11, e + 1) if m >= 0]
        n = np.nansum(self.co['refund_count'][np.ix_(cs, ms)]); d = np.nansum(self.co['customers_start'][np.ix_(cs, ms, [0])])
        return n / d if d > 0 else None

    def retention(self, cs, b):
        t = self.dd[b]; best = None
        for m in range(24):
            ms = np.datetime64(f'{2025 + m // 12}-{m % 12 + 1:02d}-01')
            if ms + np.timedelta64(44, 'D') <= t and self.ret[30][2][m]: best = m
        if best is None: return None
        out = {'retention_cohort_month': (2025 + best // 12) * 100 + best % 12 + 1}
        for n in (7, 30):
            mm, aa, _ = self.ret[n]; d = mm[cs, best].sum()
            if d > 0: out[f'd{n}_retention'] = aa[cs, best].sum() / d
        return out

    def metrics(self, cs, a, b, rich=True, single=None):
        S = lambda M: self.S(M, cs, a, b)
        r = {}
        sp = S(self.spend); r['spend'] = sp
        pl = S(self.plan); r['plan'] = pl
        if pl > 0: r['pacing'] = sp / pl
        im, ck = S(self.imp), S(self.clk); r['impressions'] = im; r['clicks'] = ck
        if im > 0: r['ctr'] = ck / im; r['cpm'] = sp / im * 1000
        if ck > 0: r['cpc'] = sp / ck
        web = [c for c in cs if self.plat[c] == 'WEB']; mob = [c for c in cs if self.plat[c] != 'WEB']
        se = S(self.sess); r['sessions'] = se
        wck = self.S(self.clk, web, a, b) if web else 0.0
        if wck > 0: r['web_land_rate'] = se / wck
        svv, ins, fo = S(self.sv), S(self.inst), S(self.fo); r['store_views'] = svv; r['installs'] = ins; r['first_opens'] = fo
        if svv > 0: r['store_cvr'] = ins / svv
        msu = self.S(self.su, mob, a, b) if mob else 0.0; wsu = self.S(self.su, web, a, b) if web else 0.0
        if ins > 0: r['install_signup_rate'] = msu / ins
        if se > 0: r['landing_signup_rate'] = wsu / se
        r['landed'] = se + ins
        su = S(self.su); r['signups'] = su
        if ck > 0: r['click_signup_rate'] = su / ck
        if su > 0: r['cpl'] = sp / su
        ac = S(self.step['first_dashboard']); r['activated'] = ac
        if su > 0: r['activation_rate'] = ac / su
        if ac > 0: r['cost_per_activated'] = sp / ac
        tr = S(self.trials); r['trials'] = tr
        if su > 0: r['trial_rate'] = tr / su
        for mname in ('dda', 'last_click', 'first_touch', 'platform'):
            p = S(self.paid[mname]); m_ = S(self.mrr[mname]); r[f'paid_customers.{mname}'] = p; r[f'new_mrr.{mname}'] = m_
            if p > 0: r[f'cpa.{mname}'] = sp / p
        p = r['paid_customers.dda']; mr = r['new_mrr.dda']
        if tr > 0: r['trial_to_paid'] = p / tr
        sp_all = self.S(self.spend, list(range(self.NC)), a, b)
        team = float(self.team_day[a:b + 1].sum()) * (sp / sp_all if sp_all > 0 else 0)
        r['team_cost'] = team
        if p > 0:
            r['paid_cac'] = sp / p; r['blended_cac'] = (sp + team) / p; r['arpa'] = mr / p
            if mr > 0: r['payback_months'] = r['blended_cac'] / (r['arpa'] * self.gm)
        ch = self.churn(cs, b)
        if ch is not None:
            r['churn_monthly'] = ch
            if p > 0 and mr > 0 and ch > 0: r['ltv'] = r['arpa'] * self.gm / ch; r['ltv_cac'] = r['ltv'] / r['blended_cac']
        r9 = self.r90(cs, b, single)
        if r9 is not None and sp > 0: r['r90'] = r9; r['roas_90d'] = mr * r9 / sp
        if p > 0 and r['paid_customers.platform'] > 0: r['attribution_gap'] = r['paid_customers.platform'] / p - 1
        srch = [c for c in cs if self.chn[c] == 'PAID_SEARCH']
        if srch:
            ss = self.S(self.spend, srch, a, b)
            if ss > 0: r['brand_share'] = self.S(self.spend, [c for c in srch if self.brand[c]], a, b) / ss if any(self.brand[c] for c in srch) else 0.0
        rr = self.refund_rate(cs, b)
        if rr is not None: r['refund_rate'] = rr
        rt = self.retention(cs, b)
        if rt: r.update(rt)
        if not rich: return r
        if su > 0:
            for n, _ in STEPS: r[f'step_{n}_pct'] = S(self.step[n]) / su
        bt = np.array([S(x) for x in self.bins])
        if bt.sum() > 0:
            sh = bt / bt.sum(); cum = np.cumsum(sh)
            for i, c in enumerate(BIN_COLS): r[f'{c}_share'] = sh[i]
            i = int(np.searchsorted(cum, .5)); lo = cum[i - 1] if i else 0.0
            r['act_median_hours'] = EDGES[i] + (.5 - lo) / (cum[i] - lo) * (EDGES[i + 1] - EDGES[i])
        for s in SEGS:
            ssu, sac = S(self.seg[s][0]), S(self.seg[s][1])
            if ssu > 0: r[f'segment.{s}.signups'] = ssu; r[f'segment.{s}.activation_rate'] = sac / ssu
        for pk in PAGES:
            P = self.page[pk]; ses = S(P['sessions']); svp = S(P['store_views'])
            if ses > 0:
                r[f'page.{pk}.sessions'] = ses; r[f'page.{pk}.cvr'] = S(P['signups']) / ses; r[f'page.{pk}.bounce_rate'] = S(P['bounces']) / ses
                r[f'page.{pk}.lcp_ms'] = S(P['lcpw']) / ses
            if svp > 0: r[f'page.{pk}.store_views'] = svp; r[f'page.{pk}.cvr'] = S(P['installs']) / svp
        if b - a >= 13:
            i7, c7 = self.S(self.imp, cs, b - 6, b), self.S(self.clk, cs, b - 6, b)
            ip, cp = self.S(self.imp, cs, b - 13, b - 7), self.S(self.clk, cs, b - 13, b - 7)
            rch = float(self.reach[cs, b].sum())
            if rch > 0: r['frequency_7d'] = i7 / rch
            if i7 > 0 and ip > 0 and cp > 0: r['ctr_slope_7d'] = (c7 / i7) / (cp / ip) - 1
        return r

    def install_quality(self, cs, a, b):
        n = b - a + 1
        i7, s7 = self.S(self.inst, cs, b - 6, b), self.S(self.su, cs, b - 6, b)
        ip, spv = self.S(self.inst, cs, a - n, a - 1), self.S(self.su, cs, a - n, a - 1)
        if i7 > 0 and ip > 0: return s7 / i7 - spv / ip
        return None


def scopes(E):
    out = [('ALL', list(range(E.NC)), None)]
    out += [(f'CH:{ch}', [c for c in range(E.NC) if E.chn[c] == ch], None) for ch in
            ['PAID_SEARCH', 'PAID_SOCIAL', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES']]
    out += [(f'PF:{p}', [c for c in range(E.NC) if E.plat[c] == p], None) for p in ['WEB', 'IOS', 'ANDROID']]
    out += [('PF:IOS+ANDROID', [c for c in range(E.NC) if E.plat[c] != 'WEB'], None)]
    out += [(f'CP:{k}', [i], i) for i, k in enumerate(E.keys)]
    for s, p, ch in (('PF:IOS+CH:PAID_SOCIAL', ['IOS'], 'PAID_SOCIAL'), ('PF:ANDROID+CH:PAID_SOCIAL', ['ANDROID'], 'PAID_SOCIAL'),
                     ('PF:IOS+ANDROID+CH:PAID_SOCIAL', ['IOS', 'ANDROID'], 'PAID_SOCIAL'), ('PF:WEB+CH:PAID_SEARCH', ['WEB'], 'PAID_SEARCH')):
        out.append((s, [c for c in range(E.NC) if E.plat[c] in p and E.chn[c] == ch], None))
    return out


def periods():
    R = [('R30-2026-11-03', '2026-10-05', '2026-11-03'), ('R30-2026-10-04', '2026-09-05', '2026-10-04'), ('R30-2025-11-03', '2025-10-05', '2025-11-03'),
         ('R7-2026-11-03', '2026-10-28', '2026-11-03'), ('MTD-2026-11-03', '2026-11-01', '2026-11-03'), ('QTD-2026-11-03', '2026-10-01', '2026-11-03')]
    M = []
    for m in range(22):
        s = np.datetime64(f'{2025 + m // 12}-{m % 12 + 1:02d}-01'); e = (s.astype('datetime64[M]') + 1).astype('datetime64[D]') - np.timedelta64(1, 'D')
        M.append((f'M-{str(s)[:7]}', str(s), str(e)))
    return [(k, dix(a), dix(b)) for k, a, b in R], [(k, dix(a), dix(b)) for k, a, b in M]


def flags_for(E, r, rp, cs, single, iq):
    """A-24 flag set (README › Flags): objective / learning gates are exclusive; root-cause flags suppress CPA over"""
    P = E.P; f = dict.fromkeys(FLAGS, 0)
    if single is not None:
        o, st = E.obj[single], E.status[single]
        gate = {'PIPELINE': 'PIPELINE_LED', 'LEAD': 'LEAD_GOAL', 'RETENTION': 'NO_CPA_GOAL'}.get(o) or ('LEARNING' if st == 'LEARNING' else None)
        tgt = E.cpa_t[single]
    else:
        gate = 'LEARNING' if cs and all(E.status[c] == 'LEARNING' for c in cs if E.spend[c].sum() > 0) else None
        tgt = P.get((E.chn[cs[0]], 'CPA'))
    if gate: f[gate] = 1; return f
    fat = r.get('ctr_slope_7d', 0) < P[('ALL', 'FATIGUE_SLOPE')] and r.get('frequency_7d', 0) > P[('ALL', 'FATIGUE_FREQ')]
    frq = r.get('frequency_7d', 0) > P[('ALL', 'FREQ_HIGH')]
    iqf = single is not None and E.obj[single] == 'INSTALL' and iq is not None and iq < P[('ALL', 'INSTALL_QUALITY_PT')]
    vt = r.get('attribution_gap', 0) + 1 > P[('ALL', 'VIEW_THROUGH_RATIO')]
    cpa = not (fat or frq or iqf or vt) and tgt == tgt and tgt is not None and r.get('cpa.dda', 0) > tgt * P[('ALL', 'CPA_OVER_TOL')]
    op = r.get('pacing', 1) > P[('ALL', 'PACING_HI')]; us = r.get('pacing', 1) < P[('ALL', 'PACING_LO')]
    for k, v in (('FATIGUE', fat), ('FREQUENCY', frq), ('INSTALL_QUALITY', iqf), ('VIEW_THROUGH', vt), ('CPA_OVER', cpa), ('OVER_PACING', op), ('UNDERSPENT', us)):
        f[k] = int(bool(v))
    if not any(f.values()): f['ON_TARGET'] = 1
    return f


def verdict(E, metric, v, days):
    P = E.P; w = P[('ALL', 'WARN_BAND_REL')]
    if metric == 'pacing':
        if abs(v - 1) <= P[('ALL', 'SPEND_PLAN_TOL')]: return 1
        return 3 if v > P[('ALL', 'PACING_HI')] or v < P[('ALL', 'PACING_LO')] else 2
    t, d = dict(paid_customers=(P[('ALL', 'PAID_CUSTOMERS_30D')] * days / 30, 'UP'), blended_cac=(P[('ALL', 'BLENDED_CAC')], 'DOWN'),
                payback_months=(P[('ALL', 'PAYBACK_MONTHS')], 'DOWN'), ltv_cac=(P[('ALL', 'LTV_CAC')], 'UP'), trial_to_paid=(P[('ALL', 'TRIAL_TO_PAID')], 'UP'),
                d7_retention=(P[('ALL', 'D7_RETENTION')], 'UP'), d30_retention=(P[('ALL', 'D30_RETENTION')], 'UP'), refund_rate=(P[('ALL', 'REFUND_RATE')], 'DOWN'),
                brand_share=(P[('ALL', 'BRAND_SHARE')], 'DOWN'), attribution_gap=(P[('ALL', 'ATTR_GAP')], 'DOWN'))[metric]
    if d == 'UP': return 1 if v >= t else 2 if v >= t * (1 - w) else 3
    return 1 if v <= t else 2 if v <= t * (1 + w) else 3


VERDICT_SRC = dict(pacing='pacing', paid_customers='paid_customers.dda', blended_cac='blended_cac', payback_months='payback_months', ltv_cac='ltv_cac',
                   trial_to_paid='trial_to_paid', d7_retention='d7_retention', d30_retention='d30_retention', refund_rate='refund_rate',
                   brand_share='brand_share', attribution_gap='attribution_gap')
TARGET_ROWS = dict(paid_customers_target=('PAID_CUSTOMERS_30D', True), blended_cac_target=('BLENDED_CAC', False), payback_target=('PAYBACK_MONTHS', False),
                   ltv_cac_target=('LTV_CAC', False), trial_to_paid_target=('TRIAL_TO_PAID', False), activation_target=('ACTIVATION_7D', False),
                   d7_target=('D7_RETENTION', False), d30_target=('D30_RETENTION', False), refund_target=('REFUND_RATE', False),
                   brand_share_target=('BRAND_SHARE', False), attribution_gap_target=('ATTR_GAP', False), roas_target=('ROAS', False))


def control_totals(T):
    E = Engine(T); rows = []
    add = lambda s, p, m, v: rows.append((s, p, m, v))
    SC = scopes(E); RK, MK = periods()
    cache = {}
    for pk, a, b in RK + MK:
        rich = pk[0] != 'M'
        n = b - a + 1
        for sname, cs, single in SC:
            if not rich and not (sname in ('ALL', 'PF:WEB', 'PF:IOS', 'PF:ANDROID') or sname.startswith('CH:') or sname == 'CP:SOC_META_LAL2'): continue
            r = E.metrics(cs, a, b, rich, single)
            if r.get('spend', 0) <= 0 and r.get('paid_customers.dda', 0) <= 0 and r.get('signups', 0) <= 0: continue
            cache[(sname, pk)] = r
            for k, v in r.items(): add(sname, pk, k, v)
            if sname == 'ALL':
                for tk, (code, scaled) in TARGET_ROWS.items(): add(sname, pk, tk, E.P[('ALL', code)] * (n / 30 if scaled else 1))
            if sname.startswith('CH:'): add(sname, pk, 'cpa_target', E.P[(sname[3:], 'CPA')])
            if single is not None and E.cpa_t[single] == E.cpa_t[single]: add(sname, pk, 'cpa_target', E.cpa_t[single])
    # previous period, flags, verdicts, alerts, movers, story (R-keys)
    for pk, a, b in RK:
        n = b - a + 1
        for sname, cs, single in SC:
            r = cache.get((sname, pk))
            if r is None: continue
            rp = E.metrics(cs, a - n, a - 1, False, single)
            if sname == 'ALL':
                for vk, src in VERDICT_SRC.items():
                    if src in r: add(sname, pk, f'verdict.{vk}', verdict(E, vk, r[src], n))
            if (sname.startswith('CP:') or sname.startswith('CH:')) and r.get('spend', 0) > 0:
                iq = E.install_quality(cs, a, b) if single is not None and E.obj[single] == 'INSTALL' else None
                if iq is not None: add(sname, pk, 'install_quality_delta', iq)
                for k, v in flags_for(E, r, rp, cs, single, iq).items(): add(sname, pk, f'flag.{k}', v)
            if pk.startswith('R30') and single is not None and r.get('trials', 0) > 0 and rp.get('trials', 0) > 0:
                add(sname, pk, 'trial_shortfall', r['trials'] * rp['paid_customers.dda'] / rp['trials'] - r['paid_customers.dda'])
            if pk.startswith('R30') and sname == 'ALL' and rp.get('trials', 0) > 0:
                add(sname, pk, 'trial_shortfall', r['trials'] * rp['paid_customers.dda'] / rp['trials'] - r['paid_customers.dda'])
    # default window only: alerts, movers, freshness, story events, creatives, terms
    W, (a, b) = 'R30-2026-11-03', (dix('2026-10-05'), dix('2026-11-03'))
    allc = list(range(E.NC)); n = 30; P = E.P
    tripped = 0
    for i, k in enumerate(E.keys):
        r = cache.get((f'CP:{k}', W))
        if r is None or r.get('spend', 0) <= 0: continue
        fat = int(r.get('ctr_slope_7d', 0) < P[('ALL', 'FATIGUE_SLOPE')] and r.get('frequency_7d', 0) > P[('ALL', 'FATIGUE_FREQ')])
        add(f'CP:{k}', W, 'alert.FATIGUE', fat); tripped += fat
        if fat: add(f'CP:{k}', W, 'alert_value.FATIGUE', r['ctr_slope_7d'])
        if E.obj[i] == 'INSTALL':
            iq = E.install_quality([i], a, b); t_ = int(iq < P[('ALL', 'INSTALL_QUALITY_PT')]); add(f'CP:{k}', W, 'alert.INSTALL_QUALITY', t_); tripped += t_
            if t_: add(f'CP:{k}', W, 'alert_value.INSTALL_QUALITY', iq)
    for ch in ['PAID_SEARCH', 'PAID_SOCIAL', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES']:
        r = cache[(f'CH:{ch}', W)]
        po = int(r['pacing'] > P[('ALL', 'PACING_HI')]); add(f'CH:{ch}', W, 'alert.PACING_OVER', po); tripped += po
        if po: add(f'CH:{ch}', W, 'alert_value.PACING_OVER', r['spend'] - r['plan'])
        us = int(r['pacing'] < P[('ALL', 'PACING_LO')] and r.get('roas_90d', 0) >= P[('ALL', 'ROAS_SCALE')]); add(f'CH:{ch}', W, 'alert.UNDERSPENT_SCALE', us); tripped += us
        if us: add(f'CH:{ch}', W, 'alert_value.UNDERSPENT_SCALE', r['plan'] - r['spend'])
    rA = cache[('ALL', W)]; rpA = E.metrics(allc, a - n, a - 1, False)
    gw = int(rA['attribution_gap'] - rpA['attribution_gap'] >= P[('ALL', 'ATTR_GAP_WIDEN_PT')]); add('ALL', W, 'alert.ATTR_GAP_WIDEN', gw); tripped += gw
    add('ALL', W, 'alert_value.ATTR_GAP_WIDEN', rA['attribution_gap'] - rpA['attribution_gap'])
    stale = int(any(E.age[s.source_code] >= s.red_after_h for s in E.sync.itertuples())); add('ALL', W, 'alert.DATA_STALE', stale); tripped += stale
    add('ALL', W, 'alerts_tripped', tripped)
    # freshness (A-17)
    amber = any(E.age[s.source_code] >= s.stale_after_h for s in E.sync.itertuples())
    add('ALL', W, 'freshness_dot', 3 if stale else 2 if amber else 1)
    add('ALL', W, 'synced_hours_ago', max(E.age[s.source_code] for s in E.sync.itertuples() if s.cadence == 'HOURLY'))
    for s in E.sync.itertuples(): add('ALL', W, f'source_age_h.{s.source_code}', E.age[s.source_code])
    # movers (O6): delta ROAS vs the previous period, campaigns with a ROAS objective and spend in both windows
    dl = {}
    for i, k in enumerate(E.keys):
        r = cache.get((f'CP:{k}', W))
        if r is None or E.obj[i] not in MOVER_OBJ or r.get('spend', 0) <= 0: continue
        rp = E.metrics([i], a - n, a - 1, False, i)
        if rp.get('spend', 0) > 0 and 'roas_90d' in rp and 'roas_90d' in r: dl[k] = r['roas_90d'] - rp['roas_90d']; add(f'CP:{k}', W, 'roas_delta', dl[k])
    order = sorted(dl, key=lambda k: -dl[k])
    for j, k in enumerate(order[:3]): add(f'CP:{k}', W, 'mover_rank', j + 1)
    for j, k in enumerate(order[::-1][:3]): add(f'CP:{k}', W, 'mover_rank', -(j + 1))
    # story events (A-63, A-64)
    st = {}
    sp = E.spend.sum(0); pdda = E.paid['dda'].sum(0)
    w1, w2 = np.arange(dix('2026-10-11'), dix('2026-10-18')), np.arange(dix('2026-10-18'), dix('2026-10-25'))
    st['story.step_date'] = 20261018
    st['story.cac_step_7d'] = (sp[w2] / pdda[w2]).mean() / (sp[w1] / pdda[w1]).mean() - 1
    A0, A1, Z0 = dix('2026-10-05'), dix('2026-10-17'), dix('2026-10-18')
    for nm, cs in (('mps', [c for c in allc if E.plat[c] != 'WEB' and E.chn[c] == 'PAID_SOCIAL']),
                   ('web_search', [c for c in allc if E.plat[c] == 'WEB' and E.chn[c] == 'PAID_SEARCH'])):
        for part, (x0, x1) in (('before', (A0, A1)), ('after', (Z0, b))):
            st[f'story.{nm}_trial_to_paid_{part}'] = E.S(E.paid['dda'], cs, x0, x1) / E.S(E.trials, cs, x0, x1)
    for ch in ['PAID_SEARCH', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES']:
        cs = [c for c in allc if E.chn[c] == ch]
        st[f'story.trial_to_paid_shift.{ch}'] = E.S(E.paid['dda'], cs, Z0, b) / E.S(E.trials, cs, Z0, b) - E.S(E.paid['dda'], cs, A0, A1) / E.S(E.trials, cs, A0, A1)
    shortfall = {rw[0]: rw[3] for rw in rows if rw[1] == W and rw[2] == 'trial_shortfall'}
    st['story.loss_share_lookalike'] = shortfall['CP:SOC_META_LAL2'] / shortfall['ALL']
    u = [E.K['APP_UAC_ANDROID']]
    ir = lambda x0, x1: E.S(E.su, u, x0, x1) / E.S(E.inst, u, x0, x1)
    st['story.uac_install_signup_before'] = ir(A0, dix('2026-10-21')); st['story.uac_install_signup_after'] = ir(dix('2026-10-22'), b)
    st['story.uac_install_signup_last7'] = ir(b - 6, b); st['story.uac_install_signup_prev'] = ir(a - n, a - 1)
    st['story.attr_gap_delta'] = rA['attribution_gap'] - rpA['attribution_gap']
    for k, v in st.items(): add('ALL', W, k, v)
    # cohorts (A-48) at ALL and CP:SOC_META_LAL2: customers, ARPA, cohort CAC, refund rate, payback curve, payback month, retention cells
    co = E.co; spm = np.zeros((E.NC, 24))
    for m in range(23): spm[:, m] = E.spend[:, E.mi == m].sum(1)
    teamm = np.array([E.team_day[E.mi == m].sum() for m in range(23)])
    for sname, cs in (('ALL', allc), ('CP:SOC_META_LAL2', [E.K['SOC_META_LAL2']])):
        for m in range(23):
            n0 = np.nansum(co['customers_start'][cs, m, 0])
            if n0 <= 0: continue
            pk = f'C-{E.mkeys[m]}'
            rev0 = np.nansum(co['revenue_usd'][cs, m, 0]); cost = spm[cs, m].sum() * (1 + teamm[m] / spm[:, m].sum())
            add(sname, pk, 'customers', n0); add(sname, pk, 'arpa', rev0 / n0); add(sname, pk, 'cohort_cac', cost / n0)
            add(sname, pk, 'refund_rate', np.nansum(co['refund_count'][cs, m]) / n0)
            net = np.nansum(co['revenue_usd'][cs, m], 0) - np.nansum(co['refunds_usd'][cs, m], 0)
            ks = [k for k in range(24) if not np.isnan(co['revenue_usd'][cs, m, k]).all()]
            cum = np.cumsum(net[ks]) * E.gm / cost
            for k, v in zip(ks, cum): add(sname, pk, f'payback.m{k}', v)
            hit = [k for k, v in zip(ks, cum) if v >= 1]
            if hit: add(sname, pk, 'payback_month', hit[0])
            for N in (1, 3, 7, 14, 30, 60, 90):
                mm, aa, w = E.ret[N]
                if w[m] and mm[cs, m].sum() > 0: add(sname, pk, f'retention.d{N}', aa[cs, m].sum() / mm[cs, m].sum())
    # creatives of SOC_META_LAL2 active on the as-of day (P4), terms of SOC_META_LAL2 and SRCH_NONBRAND_ANALYTICS (P5)
    dlv = T['fact_ad_delivery_day']; dl_t = ddays(dlv.date)
    for ckey in dlv[(dlv.campaign_key == 'SOC_META_LAL2') & (dl_t == b)].creative_key.unique():
        x = dlv[dlv.creative_key == ckey]; xt = ddays(x.date)
        l7 = x[(xt >= b - 6) & (xt <= b)]; p7 = x[(xt >= b - 13) & (xt <= b - 7)]
        ctr7 = l7.clicks.sum() / l7.impressions.sum(); slope = ctr7 / (p7.clicks.sum() / p7.impressions.sum()) - 1
        fq = l7.impressions.sum() / x[xt == b].reach_7d.sum()
        status = 3 if slope < P[('ALL', 'FATIGUE_SLOPE')] and fq > P[('ALL', 'FATIGUE_FREQ')] else 2 if slope < 0 and fq > P[('ALL', 'WATCH_FREQ')] else 1
        for k_, v in (('ctr_7d', ctr7), ('ctr_slope_7d', slope), ('frequency_7d', fq), ('creative_status', status)): add(f'CR:{ckey}', W, k_, v)
    tm = T['fact_term_day']; tm_t = ddays(tm.date); tw = tm[(tm_t >= a) & (tm_t <= b) & tm.campaign_key.isin(['SOC_META_LAL2', 'SRCH_NONBRAND_ANALYTICS'])]
    for tkey, x in tw.groupby('term_key', sort=True):
        cl = x.clicks.sum()
        for k_, v in (('impressions', x.impressions.sum()), ('clicks', cl), ('spend', x.spend_usd.sum()), ('signups', x.signups.sum())): add(f'TM:{tkey}', W, k_, v)
        if cl > 0: add(f'TM:{tkey}', W, 'cpc', x.spend_usd.sum() / cl); add(f'TM:{tkey}', W, 'cvr', x.signups.sum() / cl)
    # daily keys (O3 / P2) at ALL and CP:SOC_META_LAL2
    for sname, cs in (('ALL', allc), ('CP:SOC_META_LAL2', [E.K['SOC_META_LAL2']])):
        for t in range(a, b + 1):
            pk = f'D-{str(E.dd[t])}'; spv = E.S(E.spend, cs, t, t); pv = E.S(E.paid['dda'], cs, t, t)
            for k_, v in (('spend', spv), ('plan', E.S(E.plan, cs, t, t)), ('impressions', E.S(E.imp, cs, t, t)), ('clicks', E.S(E.clk, cs, t, t)),
                          ('signups', E.S(E.su, cs, t, t)), ('trials', E.S(E.trials, cs, t, t)), ('paid_customers.dda', pv),
                          ('new_mrr.dda', E.S(E.mrr['dda'], cs, t, t))):
                add(sname, pk, k_, v)
            if pv > 0: add(sname, pk, 'paid_cac', spv / pv)
    df = pd.DataFrame(rows, columns=['scope', 'period_key', 'metric_code', 'value'])
    df['value'] = df['value'].astype(float).round(10)
    return df.drop_duplicates(['scope', 'period_key', 'metric_code'], keep='last').reset_index(drop=True)


# ---- story check (AT-02): the binding values of ADR-0015 (d) at display precision -------------------------------------------------------
def story_check(ct):
    V = {(r.scope, r.period_key, r.metric_code): r.value for r in ct.itertuples()}
    W, P = 'R30-2026-11-03', 'R30-2026-10-04'
    g = lambda s, m, p=W: V[(s, p, m)]
    k1 = lambda x: f'{x / 1e3:.1f}'; p1 = lambda x: f'{x * 100:.1f}'; p0 = lambda x: f'{round(x * 100) + 0:.0f}'; i0 = lambda x: f'{x:.0f}'
    d1 = lambda x, y: f'{(x / y - 1) * 100:+.1f}'
    bad = []

    def eq(name, got, want):
        if got != want: bad.append(f'{name}: {got} != {want}')
    eq('spend W', k1(g('ALL', 'spend')), '188.4'); eq('spend P', k1(g('ALL', 'spend', P)), '176.1'); eq('spend delta', d1(g('ALL', 'spend'), g('ALL', 'spend', P)), '+7.0')
    eq('plan', k1(g('ALL', 'plan')), '176.0'); eq('pacing', p0(g('ALL', 'pacing')), '107'); eq('spend vs plan', d1(g('ALL', 'spend'), g('ALL', 'plan')), '+7.0')
    eq('paid W', f"{g('ALL', 'paid_customers.dda'):.4f}", '457.0000'); eq('paid P', f"{g('ALL', 'paid_customers.dda', P):.4f}", '444.0000')
    eq('paid delta', d1(g('ALL', 'paid_customers.dda'), g('ALL', 'paid_customers.dda', P)), '+2.9')
    eq('blended CAC', i0(g('ALL', 'blended_cac')), '531'); eq('blended CAC P', i0(g('ALL', 'blended_cac', P)), '499')
    eq('blended delta', d1(g('ALL', 'blended_cac'), g('ALL', 'blended_cac', P)), '+6.4'); eq('paid CAC', i0(g('ALL', 'paid_cac')), '412')
    eq('paid CAC P', i0(g('ALL', 'paid_cac', P)), '397'); eq('team cost W', k1(g('ALL', 'team_cost')), '54.1')
    eq('New MRR', k1(g('ALL', 'new_mrr.dda')), '61.9'); eq('New MRR P', f"{g('ALL', 'new_mrr.dda', P) / 1e3:.2f}", '59.85')
    eq('MRR delta', d1(g('ALL', 'new_mrr.dda'), g('ALL', 'new_mrr.dda', P)), '+3.4'); eq('ARPA', i0(g('ALL', 'arpa')), '135'); eq('ARPA P', i0(g('ALL', 'arpa', P)), '135')
    eq('payback', f"{g('ALL', 'payback_months'):.1f}", '10.8'); eq('payback P', f"{g('ALL', 'payback_months', P):.1f}", '10.2')
    eq('payback delta', f"{g('ALL', 'payback_months') - g('ALL', 'payback_months', P):+.1f}", '+0.6')
    eq('LTV:CAC', f"{g('ALL', 'ltv_cac'):.1f}", '3.4'); eq('LTV:CAC P', f"{g('ALL', 'ltv_cac', P):.1f}", '3.6')
    eq('LTV:CAC delta', f"{g('ALL', 'ltv_cac') - g('ALL', 'ltv_cac', P):+.1f}", '-0.2'); eq('churn', f"{g('ALL', 'churn_monthly') * 100:.2f}", '2.72')
    eq('impressions', f"{g('ALL', 'impressions') / 1e6:.1f}", '14.2'); eq('clicks', k1(g('ALL', 'clicks')), '223.0'); eq('clicks P', k1(g('ALL', 'clicks', P)), '221.0')
    eq('clicks delta', d1(g('ALL', 'clicks'), g('ALL', 'clicks', P)), '+0.9'); eq('CTR', f"{g('ALL', 'ctr') * 100:.2f}", '1.57')
    eq('CPC', f"{g('ALL', 'cpc'):.2f}", '0.84'); eq('CPM', f"{g('ALL', 'cpm'):.1f}", '13.3'); eq('sessions', k1(g('ALL', 'sessions')), '114.8')
    eq('installs', k1(g('ALL', 'installs')), '21.7'); eq('signups', i0(g('ALL', 'signups')), '6980'); eq('CPL', i0(g('ALL', 'cpl')), '27')
    eq('activated', i0(g('ALL', 'activated')), '2860'); eq('activation', p0(g('ALL', 'activation_rate')), '41'); eq('cost/activated', i0(g('ALL', 'cost_per_activated')), '66')
    eq('trials', i0(g('ALL', 'trials')), '3220'); eq('trial rate', p0(g('ALL', 'trial_rate')), '46'); eq('CPA', i0(g('ALL', 'cpa.dda')), '412')
    eq('click->signup', p1(g('ALL', 'click_signup_rate')), '3.1'); eq('click->signup P', p1(g('ALL', 'click_signup_rate', P)), '2.9')
    eq('click->signup delta', f"{(g('ALL', 'click_signup_rate') - g('ALL', 'click_signup_rate', P)) * 100:+.1f}", '+0.2')
    eq('trial->paid', p1(g('ALL', 'trial_to_paid')), '14.2'); eq('trial->paid P', p1(g('ALL', 'trial_to_paid', P)), '16.1')
    eq('trial->paid delta', f"{(g('ALL', 'trial_to_paid') - g('ALL', 'trial_to_paid', P)) * 100:+.1f}", '-1.9')
    eq('D7', p0(g('ALL', 'd7_retention')), '27'); eq('D30', p0(g('ALL', 'd30_retention')), '13'); eq('retention cohort', i0(g('ALL', 'retention_cohort_month')), '202609')
    eq('refund', p1(g('ALL', 'refund_rate')), '2.1'); eq('brand share', p0(g('ALL', 'brand_share')), '42')
    eq('gap', p0(g('ALL', 'attribution_gap')), '38'); eq('gap P', p0(g('ALL', 'attribution_gap', P)), '30')
    CH = [('PAID_SEARCH', '61.2', '188', '326', '1.31', '106', '57.5', '18'), ('PAID_SOCIAL', '64.1', '112', '572', '0.74', '119', '54.0', '72'),
          ('APP_INSTALL', '28.6', '71', '403', '0.98', '101', '28.3', '29'), ('DISPLAY_VIDEO', '19.9', '33', '603', '0.62', '108', '18.5', '95'),
          ('RETARGETING', '9.4', '38', '247', '1.90', '84', '11.2', '17'), ('AFFILIATES', '5.2', '15', '347', '1.22', '80', '6.5', '0')]
    for ch, s_, pd_, cpa, roas, pace, plan, gap in CH:
        s = f'CH:{ch}'
        for nm, got, want in (('spend', k1(g(s, 'spend')), s_), ('paid', i0(g(s, 'paid_customers.dda')), pd_), ('CPA', i0(g(s, 'cpa.dda')), cpa),
                              ('ROAS', f"{g(s, 'roas_90d'):.2f}", roas), ('pacing', p0(g(s, 'pacing')), pace), ('plan', k1(g(s, 'plan')), plan),
                              ('gap', p0(g(s, 'attribution_gap')), gap)):
            eq(f'{ch} {nm}', got, want)
    for s, want in (('PF:WEB', '116.0'), ('PF:IOS', '39.3'), ('PF:ANDROID', '33.1'), ('PF:IOS+ANDROID', '72.4')): eq(f'{s} spend', k1(g(s, 'spend')), want)
    L = 'CP:SOC_META_LAL2'
    for nm, got, want in (('spend', k1(g(L, 'spend')), '19.8'), ('pacing', p0(g(L, 'pacing')), '122'), ('CPA', i0(g(L, 'cpa.dda')), '641'),
                          ('ROAS', f"{g(L, 'roas_90d'):.2f}", '0.58'), ('dROAS', f"{g(L, 'roas_delta'):+.2f}", '-0.41'), ('slope', p0(g(L, 'ctr_slope_7d')), '-46'),
                          ('freq', f"{g(L, 'frequency_7d'):.1f}", '3.4'), ('cpa target', i0(g(L, 'cpa_target')), '420')):
        eq(f'LAL2 {nm}', got, want)
    flags = [f for f in FLAGS if V.get((L, W, f'flag.{f}')) == 1]
    eq('LAL2 flags', ','.join(flags), 'FATIGUE,OVER_PACING')
    v3 = [s for (s, p, m) in V if s.startswith('CR:') and p == W and m == 'ctr_7d' and abs(V[(s, p, m)] - .0182) < .0001]
    eq('v3 found', len(v3), 1)
    if v3:
        c = v3[0]
        eq('v3 CTR', f"{g(c, 'ctr_7d') * 100:.2f}", '1.82'); eq('v3 slope', p0(g(c, 'ctr_slope_7d')), '-46'); eq('v3 freq', f"{g(c, 'frequency_7d'):.1f}", '3.4')
        eq('v3 status', i0(g(c, 'creative_status')), '3')
    s_ = g('ALL', 'story.cac_step_7d')
    if not .19 <= s_ <= .21: bad.append(f'CAC step {s_}')
    eq('MPS before', p1(g('ALL', 'story.mps_trial_to_paid_before')), '16.5'); eq('MPS after', p1(g('ALL', 'story.mps_trial_to_paid_after')), '9.8')
    ws = g('ALL', 'story.web_search_trial_to_paid_after') - g('ALL', 'story.web_search_trial_to_paid_before')
    if abs(ws) > .005: bad.append(f'web search shift {ws}')
    for ch in ['PAID_SEARCH', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES']:
        if abs(g('ALL', f'story.trial_to_paid_shift.{ch}')) > .005: bad.append(f'{ch} shift')
    ls = g('ALL', 'story.loss_share_lookalike')
    if abs(ls - .70) > .02: bad.append(f'loss share {ls}')
    eq('App Store CVR', p0(g('ALL', 'page.LP_APP_STORE.cvr')), '31'); eq('App Store CVR P', p0(g('ALL', 'page.LP_APP_STORE.cvr', P)), '31')
    eq('Google Play CVR', p0(g('ALL', 'page.LP_PLAY_STORE.cvr')), '27'); eq('Google Play CVR P', p0(g('ALL', 'page.LP_PLAY_STORE.cvr', P)), '28')
    eq('landing->signup', p1(g('ALL', 'landing_signup_rate')), '3.1'); eq('install->signup', p1(g('ALL', 'install_signup_rate')), '15.8')
    for n, want in (('verified', '88'), ('workspace', '81'), ('connected', '52'), ('first_dashboard', '41'), ('invited', '23')):
        eq(f'step {n}', p0(g('ALL', f'step_{n}_pct')), want)
    eq('median', i0(g('ALL', 'act_median_hours')), '26')
    for s, want in (('WEB_DESKTOP', '46'), ('WEB_MOBILE', '38'), ('IOS_18', '47'), ('IOS_17', '44'), ('ANDROID_14_15', '39'), ('ANDROID_LE13', '29')):
        eq(f'segment {s}', p0(g('ALL', f'segment.{s}.activation_rate')), want)
    eq('UAC before', p1(g('ALL', 'story.uac_install_signup_before')), '14.0'); eq('UAC after', p1(g('ALL', 'story.uac_install_signup_after')), '11.5')
    eq('UAC quality', f"{g('CP:APP_UAC_ANDROID', 'install_quality_delta') * 100:.1f}", '-2.5')
    for m in ('2025-10', '2025-11', '2025-12', '2026-01'): eq(f'LAL2 payback {m}', i0(V.get((L, f'C-{m}', 'payback_month'), -1)), '9')
    for m in ('2025-10', '2025-11', '2025-12'):
        pm = V.get(('ALL', f'C-{m}', 'payback_month'), -1)
        if not 10 <= pm <= 12: bad.append(f'ALL payback {m} = {pm}')
    if ('ALL', 'C-2026-01', 'payback_month') in V: bad.append('ALL Jan 2026 cohort paid back before month 10')
    for k, want in (('RT_TRIAL_ABANDON', '+0.32'), ('SRCH_BRAND_GLOBAL', '+0.11'), ('APP_ASA_CORE', '+0.06'), ('SOC_TIKTOK_CREATOR', '-0.09'),
                    ('DV_YOUTUBE_DEMO', '-0.18'), ('SOC_META_LAL2', '-0.41')):
        eq(f'mover {k}', f"{g('CP:' + k, 'roas_delta'):+.2f}", want)
        if ('CP:' + k, W, 'mover_rank') not in V: bad.append(f'{k} not a mover')
    eq('alerts', i0(g('ALL', 'alerts_tripped')), '5')
    for s, m in (('CP:SOC_META_LAL2', 'alert.FATIGUE'), ('CH:PAID_SOCIAL', 'alert.PACING_OVER'), ('CP:APP_UAC_ANDROID', 'alert.INSTALL_QUALITY'),
                 ('ALL', 'alert.ATTR_GAP_WIDEN'), ('CH:RETARGETING', 'alert.UNDERSPENT_SCALE')):
        eq(f'{s} {m}', V.get((s, W, m)), 1)
    eq('pacing over value', k1(g('CH:PAID_SOCIAL', 'alert_value.PACING_OVER')), '10.1')
    eq('gap widen', f"{g('ALL', 'alert_value.ATTR_GAP_WIDEN') * 100:+.0f}", '+8')
    eq('TA ROAS', f"{g('CP:RT_TRIAL_ABANDON', 'roas_90d'):.1f}", '2.1'); eq('TA pacing', p0(g('CP:RT_TRIAL_ABANDON', 'pacing')), '84')
    eq('synced', i0(g('ALL', 'synced_hours_ago') // 1), '2'); eq('dot', i0(g('ALL', 'freshness_dot')), '1')
    eq('brand global', k1(g('CP:SRCH_BRAND_GLOBAL', 'spend')), '19.1'); eq('brand DE/FR', k1(g('CP:SRCH_BRAND_DEFR', 'spend')), '6.6')
    if bad:
        print('STORY CHECK FAILED:\n  ' + '\n  '.join(bad)); raise SystemExit(1)
    print('story check: every binding value of ADR-0015 (d) holds at display precision')

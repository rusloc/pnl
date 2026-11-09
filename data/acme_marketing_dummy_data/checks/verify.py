#!/usr/bin/env python3
"""Re-read the ACME paid-acquisition dataset (Parquet) and assert the contract of docs/Requirements-marketing.md and ADR-0015.

Usage:  python checks/verify.py [--data <dataset folder>] [--no-rerun]     (default: the folder above checks/)
Independent of the generator: every control total is recomputed here from the Parquet files with pandas group-bys (the generator
uses numpy matrices in generator/metrics.py); nothing is imported from generator/.
  AT-01  every row of checks/control_totals_usd.csv reproduced (amounts 0.005, ratios 1e-6, counts and codes exact)
  AT-02  the default-window story of ADR-0015 (d) at display precision (vitals, deltas, funnel, guardrails, channels, story campaign,
         its top creative, step, journey, cohorts, five alerts, six movers)
  AT-04  mobile spend, status roster (Live + Learning = 16 campaigns with spend in the window)
  AT-05  ties per campaign-day (traffic / segments / funnel sign-ups, activation bins, delivery credits), monotone stages, cohort offset 0
  AT-06  attribution: first-party models equal per day and integer at ALL; New MRR equal per day; channel gaps
  AT-11  channel plans and pacing; AT-14 retention cells per A-74; AT-15 freshness; AT-20 size, manifest, byte-identical rerun;
  AT-22  Ended / Paused history; plus key integrity, types, no negative values, CTR per channel 0.2-12 %, spend > 0 on live days
Exit code 0 = all checks green, 1 = at least one failure.
"""
import argparse, filecmp, json, subprocess, sys, tempfile, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore', category=DeprecationWarning)
ap = argparse.ArgumentParser(); ap.add_argument('--data', default=str(Path(__file__).resolve().parent.parent)); ap.add_argument('--no-rerun', action='store_true')
args = ap.parse_args(); DATA = Path(args.data); fails = []; npass = 0


def check(name, ok, detail=''):
    global npass
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  - ' + str(detail)[:400] if detail and not ok else ''}")
    if ok: npass += 1
    else: fails.append(name)


# ---- load + manifest ----------------------------------------------------------------------------------------------------------
man = json.loads((DATA / 'parquet' / 'manifest.json').read_text(encoding='utf-8'))
T = {}
for t in man['tables']:
    p = DATA / 'parquet' / f"{t['table']}.parquet"
    T[t['table']] = df = pd.read_parquet(p)
    sch = pq.read_schema(p)
    check(f"{t['table']}: rows and column types = manifest", len(df) == t['rows'] and {f.name: str(f.type) for f in sch} == t['columns'], f"{len(df)} vs {t['rows']}")
check('27 tables, seed 20261104, as-of 2026-11-03, refreshed 2026-11-04 14:55, window Oct 5 - Nov 3 2026',
      len(T) == 27 and man['seed'] == 20261104 and man['as_of_date'] == '2026-11-03' and man['refreshed'] == '2026-11-04T14:55:00'
      and man['default_window_start'] == '2026-10-05' and man['default_window_end'] == '2026-11-03')
rows_total = sum(t['rows'] for t in man['tables']); bytes_total = sum(t['parquet_bytes'] for t in man['tables'])
check(f'AT-20 total rows <= 0.4 M ({rows_total:,}) and Parquet <= 15 MB ({bytes_total / 1e6:.2f} MB)', rows_total <= 400_000 and bytes_total <= 15e6)
for name, df in T.items():
    for c in df.columns:
        if 'date' in c or c in ('week_start', 'month_start', 'valid_from'): df[c] = pd.to_datetime(df[c])

cp = T['dim_campaign'].set_index('campaign_key'); KEYS = list(cp.index)
fin = T['param_finance']; tgt = T['param_target']
P = {(r.scope_code, r.metric_code): r.target_value for r in tgt.itertuples()}
GM = float(fin.loc[fin.metric_code == 'GROSS_MARGIN_PCT', 'value'].iloc[0])
AS_OF = pd.Timestamp('2026-11-03')
dl, tm, tf, fu, sg, at = (T[n] for n in ('fact_ad_delivery_day', 'fact_term_day', 'fact_traffic_day', 'fact_funnel_day', 'fact_signup_segment_day',
                                          'fact_attribution_day'))
co, rt, bd = T['fact_cohort_revenue_month'], T['fact_retention_cohort_month'], T['fact_budget_month']
dm = T['dim_month'].set_index('month_key')

# ---- calendar + dimensions ------------------------------------------------------------------------------------------------------
dd = T['dim_date']
ok = (len(dd) == 730 and dd.date.min() == pd.Timestamp('2025-01-01') and dd.date.max() == pd.Timestamp('2026-12-31')
      and (dd.ly_date == dd.date - pd.DateOffset(years=1)).all() and (dd.is_actual == (dd.date <= AS_OF)).all()
      and (dd.week_start == dd.date - pd.to_timedelta(dd.date.dt.weekday, 'D')).all() and (dd.month_key == dd.date.dt.strftime('%Y-%m')).all()
      and (dd.is_weekend == (dd.date.dt.weekday >= 5)).all() and (dd.iso_week == dd.date.dt.isocalendar().week.astype(int)).all())
check('dim_date: 730 days 2025-01-01 .. 2026-12-31, ly_date one year back, Monday week_start, is_actual <= 2026-11-03', ok)
check('dim_month: 24 months, days_in_month, is_complete through 2026-10, is_actual through 2026-11',
      len(dm) == 24 and (dm.days_in_month == dm.month_start.dt.days_in_month).all() and list(dm.index[dm.is_complete]) == list(dm.index[:22])
      and list(dm.index[dm.is_actual]) == list(dm.index[:23]))
stc = cp.status_code.value_counts().to_dict()
check('A-65 roster: 19 campaigns = 14 Live, 2 Learning, 1 Paused, 2 Ended (README deviation D-1: "13 Live" in A-65)',
      len(cp) == 19 and stc == {'LIVE': 14, 'LEARNING': 2, 'PAUSED': 1, 'ENDED': 2})
check('dims: 3 platforms, 6 segments, 6 channels (colour slots 1-6), 8 networks, 4 models (DDA default), 6 onboarding steps, 8 pages',
      len(T['dim_platform']) == 3 and len(T['dim_platform_segment']) == 6 and list(T['dim_channel'].color_slot) == [1, 2, 3, 4, 5, 6]
      and len(T['dim_network']) == 8 and T['dim_attribution_model'].set_index('model_code').is_default.to_dict() == {'DDA': True, 'LAST_CLICK': False, 'FIRST_TOUCH': False, 'PLATFORM': False}
      and len(T['dim_onboarding_step']) == 6 and len(T['dim_landing_page']) == 8)
check('dims: ad sets ~75, creatives ~220, terms 8 per campaign (152)', 70 <= len(T['dim_ad_set']) <= 80 and 190 <= len(T['dim_creative']) <= 240
      and len(T['dim_term']) == 152 and (T['dim_term'].groupby('campaign_key').size() == 8).all())
for name, key in (('dim_campaign', 'campaign_key'), ('dim_ad_set', 'ad_set_key'), ('dim_creative', 'creative_key'), ('dim_term', 'term_key'),
                  ('dim_landing_page', 'page_key'), ('dim_channel', 'channel_code'), ('dim_network', 'network_code'), ('dim_platform', 'platform_code'),
                  ('dim_platform_segment', 'segment_code'), ('dim_attribution_model', 'model_code'), ('dim_onboarding_step', 'step_code')):
    check(f'{name}.{key} unique', T[name][key].is_unique)
fk = [('fact_ad_delivery_day', 'campaign_key', 'dim_campaign'), ('fact_ad_delivery_day', 'ad_set_key', 'dim_ad_set'), ('fact_ad_delivery_day', 'creative_key', 'dim_creative'),
      ('fact_term_day', 'term_key', 'dim_term'), ('fact_traffic_day', 'page_key', 'dim_landing_page'), ('fact_signup_segment_day', 'segment_code', 'dim_platform_segment'),
      ('fact_attribution_day', 'model_code', 'dim_attribution_model'), ('fact_funnel_day', 'campaign_key', 'dim_campaign'), ('fact_budget_month', 'month_key', 'dim_month'),
      ('fact_cohort_revenue_month', 'cohort_month', 'dim_month'), ('fact_retention_cohort_month', 'cohort_month', 'dim_month'),
      ('fact_pipeline_month', 'campaign_key', 'dim_campaign'), ('dim_campaign', 'channel_code', 'dim_channel'), ('dim_campaign', 'network_code', 'dim_network'),
      ('dim_campaign', 'platform_code', 'dim_platform')]
dimkey = {'dim_campaign': 'campaign_key', 'dim_ad_set': 'ad_set_key', 'dim_creative': 'creative_key', 'dim_term': 'term_key', 'dim_landing_page': 'page_key',
          'dim_platform_segment': 'segment_code', 'dim_attribution_model': 'model_code', 'dim_month': 'month_key', 'dim_channel': 'channel_code',
          'dim_network': 'network_code', 'dim_platform': 'platform_code'}
for f, col, d in fk:
    check(f'key integrity {f}.{col} -> {d}', T[f][col].isin(T[d][dimkey[d]] if d != 'dim_month' else dm.index).all())
for f, cols in (('fact_ad_delivery_day', ['date', 'creative_key']), ('fact_term_day', ['date', 'term_key']), ('fact_traffic_day', ['date', 'campaign_key', 'page_key']),
                ('fact_funnel_day', ['date', 'campaign_key']), ('fact_signup_segment_day', ['date', 'campaign_key', 'segment_code']),
                ('fact_attribution_day', ['date', 'campaign_key', 'model_code']), ('fact_cohort_revenue_month', ['cohort_month', 'campaign_key', 'month_offset']),
                ('fact_retention_cohort_month', ['cohort_month', 'campaign_key', 'day_n']), ('fact_budget_month', ['month_key', 'campaign_key'])):
    check(f'{f}: one row per {" x ".join(cols)}', not T[f].duplicated(cols).any())
cr = T['dim_creative'].set_index('creative_key'); asd = T['dim_ad_set'].set_index('ad_set_key')
check('delivery: creative and ad set belong to the row campaign', (cr.loc[dl.creative_key, 'campaign_key'].values == dl.campaign_key.values).all()
      and (asd.loc[dl.ad_set_key, 'campaign_key'].values == dl.campaign_key.values).all())
neg = {n: [c for c in df.select_dtypes('number').columns if c not in ('target_value', 'sort_order', 'value') and (df[c].fillna(0) < 0).any()] for n, df in T.items()}
check('no negative counts or amounts in any table', not any(neg.values()), {k: v for k, v in neg.items() if v})
check('every fact date is an actual day (<= 2026-11-03)', all((T[n].date <= AS_OF).all() and (T[n].date >= pd.Timestamp('2025-01-01')).all()
                                                               for n in ('fact_ad_delivery_day', 'fact_term_day', 'fact_traffic_day', 'fact_funnel_day', 'fact_signup_segment_day', 'fact_attribution_day')))

# ---- AT-05 ties per campaign-day ---------------------------------------------------------------------------------------------------
k2 = ['date', 'campaign_key']
fu_i = fu.set_index(k2)
tsu = tf.groupby(k2).signups.sum(); ssu = sg.groupby(k2).signups.sum(); sac = sg.groupby(k2).activated_7d.sum()
check('AT-05 sum of traffic sign-ups per campaign-day = funnel sign-ups', tsu.reindex(fu_i.index, fill_value=0).eq(fu_i.signups).all() and tsu.index.isin(fu_i.index).all())
check('AT-05 sum of segment sign-ups / activated_7d per campaign-day = funnel sign-ups / step_first_dashboard',
      ssu.reindex(fu_i.index, fill_value=0).eq(fu_i.signups).all() and sac.reindex(fu_i.index, fill_value=0).eq(fu_i.step_first_dashboard).all())
b6 = fu[['act_lt1h', 'act_1_6h', 'act_6_24h', 'act_1_2d', 'act_2_4d', 'act_4_7d']].sum(1)
check('AT-05 first six act_* bins = step_first_dashboard (activated within 7 days)', (b6 == fu.step_first_dashboard).all())
check('AT-05 funnel steps monotone: sign-ups >= verified >= workspace >= connected >= first dashboard >= invited; trials <= sign-ups',
      ((fu.signups >= fu.step_verified) & (fu.step_verified >= fu.step_workspace) & (fu.step_workspace >= fu.step_connected)
       & (fu.step_connected >= fu.step_first_dashboard) & (fu.step_first_dashboard >= fu.step_invited) & (fu.trials <= fu.signups)).all())
dsum = dl.groupby(k2)[['impressions', 'clicks', 'spend_usd', 'paid_customers_dda']].sum()
check('AT-05 delivery: impressions >= clicks per row; reach_7d <= trailing impressions; video views only on VIDEO creatives',
      (dl.impressions >= dl.clicks).all() and (dl.reach_7d >= 1).all()
      and (dl.video_views.notna() == (cr.loc[dl.creative_key, 'format_code'].values == 'VIDEO')).all() and (dl.video_views.fillna(0) <= dl.impressions).all())
tsum = tm.groupby(k2)[['impressions', 'clicks', 'spend_usd', 'signups']].sum()
j = tsum.join(dsum, rsuffix='_c').join(fu_i.signups.rename('su_c'))
check('AT-05 terms: per campaign-day impressions / clicks / spend / sign-ups <= the campaign-day; term sign-ups <= term clicks',
      (j.impressions <= j.impressions_c).all() and (j.clicks <= j.clicks_c).all() and (j.spend_usd <= j.spend_usd_c + 1e-6).all() and (j.signups <= j.su_c).all()
      and (tm.signups <= tm.clicks).all() and (tm.clicks <= tm.impressions).all())
web = tf[tf.sessions.notna()]; mob = tf[tf.store_views.notna()]
tw = web.groupby(k2)[['sessions', 'bounces', 'signups']].sum().join(dsum.clicks)
check('AT-05 web: sessions <= clicks per campaign-day, bounces <= sessions, sign-ups <= sessions per page row, LCP set',
      (tw.sessions <= tw.clicks).all() and (web.bounces <= web.sessions).all() and (web.signups <= web.sessions).all() and web.lcp_ms_p75.notna().all())
mj = mob.set_index(k2).join(dsum.clicks)
check('AT-05 mobile: store views <= clicks, installs <= store views, first opens <= installs, sign-ups <= first opens; one store page per platform',
      (mj.store_views <= mj.clicks).all() and (mob.installs <= mob.store_views).all() and (mob.first_opens <= mob.installs).all() and (mob.signups <= mob.first_opens).all()
      and (cp.loc[mob.campaign_key, 'platform_code'].values == np.where(mob.page_key == 'LP_APP_STORE', 'IOS', 'ANDROID')).all()
      and mob.sessions.isna().all() and web.store_views.isna().all())
dda = at[at.model_code == 'DDA'].set_index(k2)
check('AT-05 delivery paid_customers_dda per campaign-day = fact_attribution_day DDA', np.allclose(dsum.paid_customers_dda.reindex(dda.index, fill_value=0), dda.paid_customers, atol=1e-6)
      and np.allclose(dsum.paid_customers_dda.sum(), dda.paid_customers.sum(), atol=1e-6))
seg_plat = T['dim_platform_segment'].set_index('segment_code').platform_code
check('AT-05 segments belong to the campaign platform; activated_7d <= sign-ups', (seg_plat.loc[sg.segment_code].values == cp.loc[sg.campaign_key, 'platform_code'].values).all()
      and (sg.activated_7d <= sg.signups).all())

# ---- AT-06 attribution ---------------------------------------------------------------------------------------------------------
pd_ = at.pivot_table(index='date', columns='model_code', values='paid_customers', aggfunc='sum').fillna(0)
md_ = at.pivot_table(index='date', columns='model_code', values='new_mrr_usd', aggfunc='sum').fillna(0)
check('AT-06 per day: sum of paid customers equal for DDA, LAST_CLICK, FIRST_TOUCH and an integer at ALL',
      np.allclose(pd_.DDA, pd_.LAST_CLICK, atol=1e-6) and np.allclose(pd_.DDA, pd_.FIRST_TOUCH, atol=1e-6) and np.allclose(pd_.DDA, pd_.DDA.round(), atol=1e-6))
check('AT-06 per day: New MRR equal for DDA, LAST_CLICK, FIRST_TOUCH (A-73); LAST_CLICK credits are whole conversions',
      np.allclose(md_.DDA, md_.LAST_CLICK, atol=.005) and np.allclose(md_.DDA, md_.FIRST_TOUCH, atol=.005)
      and np.allclose(at[at.model_code == 'LAST_CLICK'].paid_customers, at[at.model_code == 'LAST_CLICK'].paid_customers.round()))
check('A-73 no paid credits for the RETENTION campaign; cohort facts carry no model column (DDA only)',
      not (at.campaign_key == 'RT_META_RETENTION').any() and 'model_code' not in co.columns)

# ---- plausibility (A-77), AT-22, budgets ------------------------------------------------------------------------------------------
act = []
for k, r in cp.iterrows():
    last = pd.Timestamp('2026-09-30') if k == 'RT_META_RETENTION' else min(AS_OF, r.end_date) if pd.notna(r.end_date) else AS_OF
    days = pd.date_range(max(r.start_date, pd.Timestamp('2025-01-01')), last)
    act.append(pd.DataFrame(dict(date=days, campaign_key=k)))
act = pd.concat(act).set_index(k2)
sp_cd = dsum.spend_usd
check('A-77 daily spend > 0 on every live day of every campaign, and no spend outside its live days',
      sp_cd.reindex(act.index, fill_value=0).gt(0).all() and sp_cd.index.isin(act.index).all())
dl['month'] = dl.date.dt.strftime('%Y-%m'); dl['channel_code'] = cp.loc[dl.campaign_key, 'channel_code'].values
chm = dl.groupby(['channel_code', 'month'])[['clicks', 'impressions']].sum(); ctrm = chm.clicks / chm.impressions
check(f'A-77 CTR per channel and month inside 0.2-12 % (min {ctrm.min() * 100:.2f} %, max {ctrm.max() * 100:.2f} %)', ctrm.between(.002, .12).all())
sp_k = dl.groupby('campaign_key').date.agg(['min', 'max'])
check('AT-22 Ended: SOC_META_LAL1 spends in the LY window, none in the default window; summer promo Jun - Aug 2026 only',
      dl[(dl.campaign_key == 'SOC_META_LAL1') & dl.date.between('2025-10-05', '2025-11-03')].spend_usd.sum() > 0
      and sp_k.loc['SOC_META_LAL1', 'max'] == pd.Timestamp('2025-12-31') and sp_k.loc['SRCH_SUMMER_PROMO', 'min'] == pd.Timestamp('2026-06-01')
      and sp_k.loc['SRCH_SUMMER_PROMO', 'max'] == pd.Timestamp('2026-08-31'))
check('AT-22 Paused: RT_META_RETENTION spends through 2026-09-30 and not after, objective RETENTION (CPA / ROAS "—")',
      sp_k.loc['RT_META_RETENTION', 'max'] == pd.Timestamp('2026-09-30') and cp.loc['RT_META_RETENTION', 'objective_code'] == 'RETENTION'
      and pd.isna(cp.loc['RT_META_RETENTION', 'cpa_target_usd']))
check('fact_budget_month: 19 campaigns x 24 months (456 rows), Nov / Dec 2026 budgets present for live campaigns, none for Paused / Ended after their end',
      len(bd) == 456 and bd[(bd.month_key == '2026-12') & bd.campaign_key.isin(['SRCH_BRAND_GLOBAL', 'SOC_META_LAL2'])].budget_usd.gt(0).all()
      and bd[(bd.month_key >= '2026-10') & bd.campaign_key.isin(['RT_META_RETENTION', 'SOC_META_LAL1', 'SRCH_SUMMER_PROMO'])].budget_usd.eq(0).all())
check('A-74 retention cells only where the 15th of the cohort month + N <= as-of; users_active <= users_matured',
      ((pd.to_datetime(rt.cohort_month + '-15') + pd.to_timedelta(rt.day_n, 'D')) <= AS_OF).all() and (rt.users_active <= rt.users_matured).all())
wr = rt.groupby('cohort_month').day_n.max()
check('AT-14 blank pattern: Oct 2026 up to D14, Sep up to D30, Aug up to D60, Jul up to D90',
      wr['2026-10'] == 14 and wr['2026-09'] == 30 and wr['2026-08'] == 60 and wr['2026-07'] == 90)
mindex = lambda mk: (pd.Series(mk).str[:4].astype(int) - 2025) * 12 + pd.Series(mk).str[5:7].astype(int) - 1
co['m'] = mindex(co.cohort_month).values; co['cal'] = co.m + co.month_offset
check('cohort rows: calendar month (cohort + offset) <= 2026-10, plus offset 0 of the partial Nov 2026 cohort; customers_end = start - churned',
      ((co.cal <= 21) | ((co.m == 22) & (co.month_offset == 0))).all() and np.allclose(co.customers_end, co.customers_start - co.churned, atol=2e-4))
fm = at[at.model_code == 'DDA'].assign(cm=lambda x: x.date.dt.strftime('%Y-%m')).groupby(['cm', 'campaign_key'])[['new_mrr_usd', 'paid_customers']].sum()
c0 = co[co.month_offset == 0].set_index(['cohort_month', 'campaign_key'])
fm.index.names = ['cohort_month', 'campaign_key']; jj = c0.join(fm, how='outer')
check('AT-05 cohort offset 0: revenue = sum of DDA New MRR of the month, customers_start = sum of DDA paid customers (every campaign-month)',
      np.allclose(jj.revenue_usd.fillna(0), jj.new_mrr_usd.fillna(0), atol=.011) and np.allclose(jj.customers_start.fillna(0), jj.paid_customers.fillna(0), atol=2e-3))

# ---- the metric engine (independent re-implementation of README › Rules) ---------------------------------------------------------
DIMS = dm.days_in_month.to_dict()
team = fin[fin.metric_code == 'PAID_TEAM_COST_MONTH_USD'].sort_values('valid_from')
alld = pd.date_range('2025-01-01', AS_OF)
team_day = pd.Series([team[team.valid_from <= d].value.iloc[-1] / DIMS[d.strftime('%Y-%m')] for d in alld], index=alld)
bud = bd.set_index(['campaign_key', 'month_key']).budget_usd
CH = ['PAID_SEARCH', 'PAID_SOCIAL', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES']
co_m = co.set_index(['campaign_key', 'm', 'month_offset'])
tf['plat'] = cp.loc[tf.campaign_key, 'platform_code'].values; fu['plat'] = cp.loc[fu.campaign_key, 'platform_code'].values
dl_day = dl.groupby(['campaign_key', 'date'])[['impressions', 'clicks', 'reach_7d']].sum()


def per_campaign(a, b):
    """campaign-level sums of every fact over the days a..b (Timestamps)"""
    f = lambda df: df[(df.date >= a) & (df.date <= b)]
    out = f(dl).groupby('campaign_key')[['spend_usd', 'impressions', 'clicks']].sum()
    x = f(tf).groupby('campaign_key')[['sessions', 'store_views', 'installs', 'first_opens']].sum(); out = out.join(x, how='outer')
    x = f(fu).groupby('campaign_key')[['signups', 'trials', 'step_verified', 'step_workspace', 'step_connected', 'step_first_dashboard', 'step_invited',
                                        'act_lt1h', 'act_1_6h', 'act_6_24h', 'act_1_2d', 'act_2_4d', 'act_4_7d', 'act_7_30d']].sum(); out = out.join(x, how='outer')
    x = f(at).pivot_table(index='campaign_key', columns='model_code', values=['paid_customers', 'new_mrr_usd'], aggfunc='sum')
    x.columns = [f'{a_}|{b_}' for a_, b_ in x.columns]; out = out.join(x, how='outer')
    days = pd.date_range(a, b); mk = pd.Series(days.strftime('%Y-%m')).value_counts()
    pl = pd.Series({k: sum(bud.get((k, m), 0) * n / DIMS[m] for m, n in mk.items()) for k in KEYS}, name='plan')
    return out.join(pl, how='outer').reindex(KEYS).fillna(0)


def lcm(b):
    m = (b.year - 2025) * 12 + b.month - 1
    return m if (b + pd.Timedelta(days=1)).month != b.month else m - 1


def scope_metrics(cs, a, b, pc, single=None, rich=True):
    s = pc.loc[cs].sum(); r = {}
    sp = s.spend_usd; r['spend'] = sp; r['plan'] = s.plan
    if s.plan > 0: r['pacing'] = sp / s.plan
    r['impressions'] = s.impressions; r['clicks'] = s.clicks
    if s.impressions > 0: r['ctr'] = s.clicks / s.impressions; r['cpm'] = sp / s.impressions * 1000
    if s.clicks > 0: r['cpc'] = sp / s.clicks
    plat = cp.loc[cs, 'platform_code']; webc = list(plat.index[plat == 'WEB']); mobc = list(plat.index[plat != 'WEB'])
    r['sessions'] = s.sessions
    wck = pc.loc[webc, 'clicks'].sum()
    if wck > 0: r['web_land_rate'] = s.sessions / wck
    r['store_views'] = s.store_views; r['installs'] = s.installs; r['first_opens'] = s.first_opens
    if s.store_views > 0: r['store_cvr'] = s.installs / s.store_views
    if s.installs > 0: r['install_signup_rate'] = pc.loc[mobc, 'signups'].sum() / s.installs
    if s.sessions > 0: r['landing_signup_rate'] = pc.loc[webc, 'signups'].sum() / s.sessions
    r['landed'] = s.sessions + s.installs; r['signups'] = s.signups
    if s.clicks > 0: r['click_signup_rate'] = s.signups / s.clicks
    if s.signups > 0: r['cpl'] = sp / s.signups; r['activation_rate'] = s.step_first_dashboard / s.signups; r['trial_rate'] = s.trials / s.signups
    r['activated'] = s.step_first_dashboard
    if s.step_first_dashboard > 0: r['cost_per_activated'] = sp / s.step_first_dashboard
    r['trials'] = s.trials
    for code, nm in (('DDA', 'dda'), ('LAST_CLICK', 'last_click'), ('FIRST_TOUCH', 'first_touch'), ('PLATFORM', 'platform')):
        p_, m_ = s.get(f'paid_customers|{code}', 0.0), s.get(f'new_mrr_usd|{code}', 0.0)
        r[f'paid_customers.{nm}'] = p_; r[f'new_mrr.{nm}'] = m_
        if p_ > 0: r[f'cpa.{nm}'] = sp / p_
    p_, m_ = r['paid_customers.dda'], r['new_mrr.dda']
    if s.trials > 0: r['trial_to_paid'] = p_ / s.trials
    sp_all = pc.spend_usd.sum()
    team_c = team_day[a:b].sum() * (sp / sp_all if sp_all > 0 else 0); r['team_cost'] = team_c
    if p_ > 0:
        r['paid_cac'] = sp / p_; r['blended_cac'] = (sp + team_c) / p_; r['arpa'] = m_ / p_
        if m_ > 0: r['payback_months'] = r['blended_cac'] / (r['arpa'] * GM)
    e = lcm(b); x = co[co.campaign_key.isin(cs) & (co.month_offset >= 1) & co.cal.between(e - 2, e)]
    if x.customers_start.sum() > 0:
        r['churn_monthly'] = x.churned.sum() / x.customers_start.sum()
        if p_ > 0 and m_ > 0 and r['churn_monthly'] > 0:
            r['ltv'] = r['arpa'] * GM / r['churn_monthly']; r['ltv_cac'] = r['ltv'] / r['blended_cac']
    m90 = e - 2
    if m90 >= 0:
        def r90_of(cc):
            y = co[co.campaign_key.isin(cc) & (co.m == m90)]
            ok_c = [c for c in cc if ((y.campaign_key == c) & (y.month_offset == 0) & (y.revenue_usd > 0)).any() and ((y.campaign_key == c) & (y.month_offset == 2)).any()]
            y = y[y.campaign_key.isin(ok_c)]
            return y[y.month_offset <= 2].revenue_usd.sum() / y[y.month_offset == 0].revenue_usd.sum() if ok_c else None
        v = r90_of(cs)
        if v is None and single is not None: v = r90_of(list(cp.index[cp.channel_code == cp.loc[single, 'channel_code']]))
        if v is None: v = r90_of(KEYS)
        if v is not None and sp > 0: r['r90'] = v; r['roas_90d'] = m_ * v / sp
    if p_ > 0 and r['paid_customers.platform'] > 0: r['attribution_gap'] = r['paid_customers.platform'] / p_ - 1
    srch = [c for c in cs if cp.loc[c, 'channel_code'] == 'PAID_SEARCH']
    if srch and pc.loc[srch, 'spend_usd'].sum() > 0:
        r['brand_share'] = pc.loc[[c for c in srch if cp.loc[c, 'is_brand']], 'spend_usd'].sum() / pc.loc[srch, 'spend_usd'].sum()
    em = (b.year - 2025) * 12 + b.month - 1
    y = co[co.campaign_key.isin(cs) & co.m.between(em - 11, em)]
    if y[y.month_offset == 0].customers_start.sum() > 0: r['refund_rate'] = y.refund_count.sum() / y[y.month_offset == 0].customers_start.sum()
    rtm = rt.assign(start=pd.to_datetime(rt.cohort_month + '-01'))
    cand = sorted(set(rtm[(rtm.day_n == 30) & (rtm.start + pd.Timedelta(days=44) <= b)].cohort_month))
    if cand:
        mstar = cand[-1]; r['retention_cohort_month'] = int(mstar.replace('-', ''))
        for n_ in (7, 30):
            z = rt[(rt.cohort_month == mstar) & (rt.day_n == n_) & rt.campaign_key.isin(cs)]
            if z.users_matured.sum() > 0: r[f'd{n_}_retention'] = z.users_active.sum() / z.users_matured.sum()
    if not rich: return r
    if s.signups > 0:
        for nm, col in (('verified', 'step_verified'), ('workspace', 'step_workspace'), ('connected', 'step_connected'), ('first_dashboard', 'step_first_dashboard'), ('invited', 'step_invited')):
            r[f'step_{nm}_pct'] = s[col] / s.signups
    bins = ['act_lt1h', 'act_1_6h', 'act_6_24h', 'act_1_2d', 'act_2_4d', 'act_4_7d', 'act_7_30d']; bt = s[bins].astype(float)
    if bt.sum() > 0:
        sh = bt / bt.sum(); cum = sh.cumsum().values; edges = [0, 1, 6, 24, 48, 96, 168, 720]
        for c in bins: r[f'{c}_share'] = sh[c]
        i = next(i for i, v in enumerate(cum) if v >= .5); lo = cum[i - 1] if i else 0.0
        r['act_median_hours'] = edges[i] + (.5 - lo) / (cum[i] - lo) * (edges[i + 1] - edges[i])
    z = sg[(sg.date >= a) & (sg.date <= b) & sg.campaign_key.isin(cs)].groupby('segment_code')[['signups', 'activated_7d']].sum()
    for sc_, rw in z.iterrows():
        if rw.signups > 0: r[f'segment.{sc_}.signups'] = rw.signups; r[f'segment.{sc_}.activation_rate'] = rw.activated_7d / rw.signups
    z = tf[(tf.date >= a) & (tf.date <= b) & tf.campaign_key.isin(cs)].assign(lw=lambda d: d.lcp_ms_p75.astype(float) * d.sessions.astype(float)) \
        .groupby('page_key')[['sessions', 'signups', 'bounces', 'lw', 'store_views', 'installs']].sum()
    for pk, rw in z.iterrows():
        if rw.sessions > 0:
            r[f'page.{pk}.sessions'] = rw.sessions; r[f'page.{pk}.cvr'] = rw.signups / rw.sessions; r[f'page.{pk}.bounce_rate'] = rw.bounces / rw.sessions
            r[f'page.{pk}.lcp_ms'] = rw.lw / rw.sessions
        if rw.store_views > 0: r[f'page.{pk}.store_views'] = rw.store_views; r[f'page.{pk}.cvr'] = rw.installs / rw.store_views
    if (b - a).days >= 13:
        x = dl_day.loc[dl_day.index.get_level_values(0).isin(cs)]; xd = x.index.get_level_values(1)
        l7 = x[(xd > b - pd.Timedelta(days=7)) & (xd <= b)].sum(); p7 = x[(xd > b - pd.Timedelta(days=14)) & (xd <= b - pd.Timedelta(days=7))].sum()
        rch = x[xd == b].reach_7d.sum()
        if rch > 0: r['frequency_7d'] = l7.impressions / rch
        if l7.impressions > 0 and p7.impressions > 0 and p7.clicks > 0: r['ctr_slope_7d'] = (l7.clicks / l7.impressions) / (p7.clicks / p7.impressions) - 1
    return r


def install_quality(c, a, b):
    n = (b - a).days + 1; x = fu[fu.campaign_key == c].set_index('date').signups; y = tf[tf.campaign_key == c].groupby('date').installs.sum()
    l7 = slice(b - pd.Timedelta(days=6), b); pv = slice(a - pd.Timedelta(days=n), a - pd.Timedelta(days=1))
    return x[l7].sum() / y[l7].sum() - x[pv].sum() / y[pv].sum()


SCOPES = [('ALL', KEYS, None)] + [(f'CH:{c}', list(cp.index[cp.channel_code == c]), None) for c in CH] + \
         [(f'PF:{p}', list(cp.index[cp.platform_code == p]), None) for p in ('WEB', 'IOS', 'ANDROID')] + [('PF:IOS+ANDROID', list(cp.index[cp.platform_code != 'WEB']), None)] + \
         [(f'CP:{k}', [k], k) for k in KEYS] + \
         [('PF:IOS+CH:PAID_SOCIAL', list(cp.index[(cp.platform_code == 'IOS') & (cp.channel_code == 'PAID_SOCIAL')]), None),
          ('PF:ANDROID+CH:PAID_SOCIAL', list(cp.index[(cp.platform_code == 'ANDROID') & (cp.channel_code == 'PAID_SOCIAL')]), None),
          ('PF:IOS+ANDROID+CH:PAID_SOCIAL', list(cp.index[(cp.platform_code != 'WEB') & (cp.channel_code == 'PAID_SOCIAL')]), None),
          ('PF:WEB+CH:PAID_SEARCH', list(cp.index[(cp.platform_code == 'WEB') & (cp.channel_code == 'PAID_SEARCH')]), None)]
RKEYS = {'R30-2026-11-03': ('2026-10-05', '2026-11-03'), 'R30-2026-10-04': ('2026-09-05', '2026-10-04'), 'R30-2025-11-03': ('2025-10-05', '2025-11-03'),
         'R7-2026-11-03': ('2026-10-28', '2026-11-03'), 'MTD-2026-11-03': ('2026-11-01', '2026-11-03'), 'QTD-2026-11-03': ('2026-10-01', '2026-11-03')}
MKEYS = {f'M-{m}': (f'{m}-01', str((pd.Period(m) .end_time).date())) for m in dm.index[:22]}
MONTHLY_SCOPES = {'ALL', 'PF:WEB', 'PF:IOS', 'PF:ANDROID', 'CP:SOC_META_LAL2'} | {f'CH:{c}' for c in CH}
FLAGS = ['FATIGUE', 'FREQUENCY', 'INSTALL_QUALITY', 'VIEW_THROUGH', 'CPA_OVER', 'OVER_PACING', 'UNDERSPENT', 'LEARNING', 'PIPELINE_LED', 'LEAD_GOAL', 'NO_CPA_GOAL', 'ON_TARGET']
V = {}
for pk, (a, b) in {**RKEYS, **MKEYS}.items():
    a, b = pd.Timestamp(a), pd.Timestamp(b); pc = per_campaign(a, b); n = (b - a).days + 1
    rich = not pk.startswith('M-')
    pcp = per_campaign(a - pd.Timedelta(days=n), a - pd.Timedelta(days=1)) if rich else None
    for sname, cs, single in SCOPES:
        if not rich and sname not in MONTHLY_SCOPES: continue
        r = scope_metrics(cs, a, b, pc, single, rich)
        if r['spend'] <= 0 and r['paid_customers.dda'] <= 0 and r['signups'] <= 0: continue
        for k, v in r.items(): V[(sname, pk, k)] = v
        if sname == 'ALL':
            for tk, code, sc_ in (('paid_customers_target', 'PAID_CUSTOMERS_30D', True), ('blended_cac_target', 'BLENDED_CAC', False), ('payback_target', 'PAYBACK_MONTHS', False),
                                  ('ltv_cac_target', 'LTV_CAC', False), ('trial_to_paid_target', 'TRIAL_TO_PAID', False), ('activation_target', 'ACTIVATION_7D', False),
                                  ('d7_target', 'D7_RETENTION', False), ('d30_target', 'D30_RETENTION', False), ('refund_target', 'REFUND_RATE', False),
                                  ('brand_share_target', 'BRAND_SHARE', False), ('attribution_gap_target', 'ATTR_GAP', False), ('roas_target', 'ROAS', False)):
                V[(sname, pk, tk)] = P[('ALL', code)] * (n / 30 if sc_ else 1)
        if sname.startswith('CH:'): V[(sname, pk, 'cpa_target')] = P[(sname[3:], 'CPA')]
        if single is not None and pd.notna(cp.loc[single, 'cpa_target_usd']): V[(sname, pk, 'cpa_target')] = cp.loc[single, 'cpa_target_usd']
        if not rich: continue
        rp = scope_metrics(cs, a - pd.Timedelta(days=n), a - pd.Timedelta(days=1), pcp, single, False)
        w_ = P[('ALL', 'WARN_BAND_REL')]
        if sname == 'ALL':
            for vk, src, t_, d_ in (('pacing', 'pacing', None, 'BAND'), ('paid_customers', 'paid_customers.dda', P[('ALL', 'PAID_CUSTOMERS_30D')] * n / 30, 'UP'),
                                    ('blended_cac', 'blended_cac', P[('ALL', 'BLENDED_CAC')], 'DOWN'), ('payback_months', 'payback_months', P[('ALL', 'PAYBACK_MONTHS')], 'DOWN'),
                                    ('ltv_cac', 'ltv_cac', P[('ALL', 'LTV_CAC')], 'UP'), ('trial_to_paid', 'trial_to_paid', P[('ALL', 'TRIAL_TO_PAID')], 'UP'),
                                    ('d7_retention', 'd7_retention', P[('ALL', 'D7_RETENTION')], 'UP'), ('d30_retention', 'd30_retention', P[('ALL', 'D30_RETENTION')], 'UP'),
                                    ('refund_rate', 'refund_rate', P[('ALL', 'REFUND_RATE')], 'DOWN'), ('brand_share', 'brand_share', P[('ALL', 'BRAND_SHARE')], 'DOWN'),
                                    ('attribution_gap', 'attribution_gap', P[('ALL', 'ATTR_GAP')], 'DOWN')):
                if src not in r: continue
                v = r[src]
                if d_ == 'BAND': code = 1 if abs(v - 1) <= P[('ALL', 'SPEND_PLAN_TOL')] else 3 if (v > P[('ALL', 'PACING_HI')] or v < P[('ALL', 'PACING_LO')]) else 2
                elif d_ == 'UP': code = 1 if v >= t_ else 2 if v >= t_ * (1 - w_) else 3
                else: code = 1 if v <= t_ else 2 if v <= t_ * (1 + w_) else 3
                V[(sname, pk, f'verdict.{vk}')] = code
        if (sname.startswith('CP:') or sname.startswith('CH:')) and r['spend'] > 0:
            iq = install_quality(single, a, b) if single is not None and cp.loc[single, 'objective_code'] == 'INSTALL' else None
            if iq is not None: V[(sname, pk, 'install_quality_delta')] = iq
            f = dict.fromkeys(FLAGS, 0)
            if single is not None:
                gate = {'PIPELINE': 'PIPELINE_LED', 'LEAD': 'LEAD_GOAL', 'RETENTION': 'NO_CPA_GOAL'}.get(cp.loc[single, 'objective_code'])
                gate = gate or ('LEARNING' if cp.loc[single, 'status_code'] == 'LEARNING' else None); tg_ = cp.loc[single, 'cpa_target_usd']
            else:
                spending = [c for c in cs if dl[dl.campaign_key == c].spend_usd.sum() > 0]
                gate = 'LEARNING' if spending and all(cp.loc[c, 'status_code'] == 'LEARNING' for c in spending) else None; tg_ = P[(sname[3:], 'CPA')]
            if gate: f[gate] = 1
            else:
                fat = r.get('ctr_slope_7d', 0) < P[('ALL', 'FATIGUE_SLOPE')] and r.get('frequency_7d', 0) > P[('ALL', 'FATIGUE_FREQ')]
                frq = r.get('frequency_7d', 0) > P[('ALL', 'FREQ_HIGH')]
                iqf = iq is not None and iq < P[('ALL', 'INSTALL_QUALITY_PT')]
                vt = r.get('attribution_gap', 0) + 1 > P[('ALL', 'VIEW_THROUGH_RATIO')]
                cpo = not (fat or frq or iqf or vt) and pd.notna(tg_) and r.get('cpa.dda', 0) > tg_ * P[('ALL', 'CPA_OVER_TOL')]
                for k_, v_ in (('FATIGUE', fat), ('FREQUENCY', frq), ('INSTALL_QUALITY', iqf), ('VIEW_THROUGH', vt), ('CPA_OVER', cpo),
                               ('OVER_PACING', r.get('pacing', 1) > P[('ALL', 'PACING_HI')]), ('UNDERSPENT', r.get('pacing', 1) < P[('ALL', 'PACING_LO')])):
                    f[k_] = int(bool(v_))
                if not any(f.values()): f['ON_TARGET'] = 1
            for k_, v_ in f.items(): V[(sname, pk, f'flag.{k_}')] = v_
        if pk.startswith('R30') and (single is not None or sname == 'ALL') and r['trials'] > 0 and rp.get('trials', 0) > 0:
            V[(sname, pk, 'trial_shortfall')] = r['trials'] * rp['paid_customers.dda'] / rp['trials'] - r['paid_customers.dda']

# default window: alerts, movers, freshness, story, cohorts, creatives, terms, days
W = 'R30-2026-11-03'; a, b = pd.Timestamp('2026-10-05'), AS_OF
g = lambda s, m, p=W: V[(s, p, m)]
trip = 0
for k in KEYS:
    if (f'CP:{k}', W, 'spend') not in V or g(f'CP:{k}', 'spend') <= 0: continue
    r = {m: V[(f'CP:{k}', W, m)] for m in ('ctr_slope_7d', 'frequency_7d') if (f'CP:{k}', W, m) in V}
    ft = int(r.get('ctr_slope_7d', 0) < P[('ALL', 'FATIGUE_SLOPE')] and r.get('frequency_7d', 0) > P[('ALL', 'FATIGUE_FREQ')]); V[(f'CP:{k}', W, 'alert.FATIGUE')] = ft; trip += ft
    if ft: V[(f'CP:{k}', W, 'alert_value.FATIGUE')] = r['ctr_slope_7d']
    if cp.loc[k, 'objective_code'] == 'INSTALL':
        iq = install_quality(k, a, b); t_ = int(iq < P[('ALL', 'INSTALL_QUALITY_PT')]); V[(f'CP:{k}', W, 'alert.INSTALL_QUALITY')] = t_; trip += t_
        if t_: V[(f'CP:{k}', W, 'alert_value.INSTALL_QUALITY')] = iq
for c in CH:
    s = f'CH:{c}'; po = int(g(s, 'pacing') > P[('ALL', 'PACING_HI')]); V[(s, W, 'alert.PACING_OVER')] = po; trip += po
    if po: V[(s, W, 'alert_value.PACING_OVER')] = g(s, 'spend') - g(s, 'plan')
    us = int(g(s, 'pacing') < P[('ALL', 'PACING_LO')] and V.get((s, W, 'roas_90d'), 0) >= P[('ALL', 'ROAS_SCALE')]); V[(s, W, 'alert.UNDERSPENT_SCALE')] = us; trip += us
    if us: V[(s, W, 'alert_value.UNDERSPENT_SCALE')] = g(s, 'plan') - g(s, 'spend')
gap_prev = g('ALL', 'attribution_gap', 'R30-2026-10-04')
gw = int(g('ALL', 'attribution_gap') - gap_prev >= P[('ALL', 'ATTR_GAP_WIDEN_PT')]); V[('ALL', W, 'alert.ATTR_GAP_WIDEN')] = gw; trip += gw
V[('ALL', W, 'alert_value.ATTR_GAP_WIDEN')] = g('ALL', 'attribution_gap') - gap_prev
sl = T['sync_log']; age = ((pd.Timestamp('2026-11-04 14:55') - sl.last_sync_ts).dt.total_seconds() / 3600).values
st_ = int((age >= sl.red_after_h).any()); V[('ALL', W, 'alert.DATA_STALE')] = st_; trip += st_; V[('ALL', W, 'alerts_tripped')] = trip
V[('ALL', W, 'freshness_dot')] = 3 if st_ else 2 if (age >= sl.stale_after_h).any() else 1
V[('ALL', W, 'synced_hours_ago')] = age[(sl.cadence == 'HOURLY').values].max()
for sc_, ag in zip(sl.source_code, age): V[('ALL', W, f'source_age_h.{sc_}')] = ag
dlt = {}
for k in KEYS:
    if cp.loc[k, 'objective_code'] not in ('PAID', 'INSTALL', 'PIPELINE') or V.get((f'CP:{k}', W, 'spend'), 0) <= 0: continue
    pr = V.get((f'CP:{k}', 'R30-2026-10-04', 'roas_90d')); cu = V.get((f'CP:{k}', W, 'roas_90d'))
    if V.get((f'CP:{k}', 'R30-2026-10-04', 'spend'), 0) > 0 and pr is not None and cu is not None: dlt[k] = cu - pr; V[(f'CP:{k}', W, 'roas_delta')] = dlt[k]
rank = sorted(dlt, key=lambda k: dlt[k], reverse=True)
for i, k in enumerate(rank[:3]): V[(f'CP:{k}', W, 'mover_rank')] = i + 1
for i, k in enumerate(rank[::-1][:3]): V[(f'CP:{k}', W, 'mover_rank')] = -(i + 1)
alld_sp = dl.groupby('date').spend_usd.sum(); alld_p = at[at.model_code == 'DDA'].groupby('date').paid_customers.sum()
cac = alld_sp / alld_p
V[('ALL', W, 'story.step_date')] = 20261018
V[('ALL', W, 'story.cac_step_7d')] = cac['2026-10-18':'2026-10-24'].mean() / cac['2026-10-11':'2026-10-17'].mean() - 1
fu_day = fu.groupby(['campaign_key', 'date']).trials.sum(); at_day = at[at.model_code == 'DDA'].groupby(['campaign_key', 'date']).paid_customers.sum()


def t2p(cs, x0, x1):
    tt = fu_day[fu_day.index.get_level_values(0).isin(cs)]; pp = at_day[at_day.index.get_level_values(0).isin(cs)]
    sl_ = lambda s: s[(s.index.get_level_values(1) >= x0) & (s.index.get_level_values(1) <= x1)].sum()
    return sl_(pp) / sl_(tt)


before, after = (pd.Timestamp('2026-10-05'), pd.Timestamp('2026-10-17')), (pd.Timestamp('2026-10-18'), AS_OF)
for nm, cs in (('mps', list(cp.index[(cp.platform_code != 'WEB') & (cp.channel_code == 'PAID_SOCIAL')])),
               ('web_search', list(cp.index[(cp.platform_code == 'WEB') & (cp.channel_code == 'PAID_SEARCH')]))):
    V[('ALL', W, f'story.{nm}_trial_to_paid_before')] = t2p(cs, *before); V[('ALL', W, f'story.{nm}_trial_to_paid_after')] = t2p(cs, *after)
for c in ['PAID_SEARCH', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES']:
    cs = list(cp.index[cp.channel_code == c]); V[('ALL', W, f'story.trial_to_paid_shift.{c}')] = t2p(cs, *after) - t2p(cs, *before)
V[('ALL', W, 'story.loss_share_lookalike')] = g('CP:SOC_META_LAL2', 'trial_shortfall') / g('ALL', 'trial_shortfall')
uf = fu[fu.campaign_key == 'APP_UAC_ANDROID'].set_index('date').signups; ui = tf[tf.campaign_key == 'APP_UAC_ANDROID'].groupby('date').installs.sum()
ur = lambda x0, x1: uf[x0:x1].sum() / ui[x0:x1].sum()
V[('ALL', W, 'story.uac_install_signup_before')] = ur('2026-10-05', '2026-10-21'); V[('ALL', W, 'story.uac_install_signup_after')] = ur('2026-10-22', '2026-11-03')
V[('ALL', W, 'story.uac_install_signup_last7')] = ur('2026-10-28', '2026-11-03'); V[('ALL', W, 'story.uac_install_signup_prev')] = ur('2026-09-05', '2026-10-04')
V[('ALL', W, 'story.attr_gap_delta')] = g('ALL', 'attribution_gap') - gap_prev
# cohort keys
spm = dl.groupby(['campaign_key', 'month']).spend_usd.sum(); spm_all = dl.groupby('month').spend_usd.sum()
teamm = team_day.groupby(team_day.index.strftime('%Y-%m')).sum()
for sname, cs in (('ALL', KEYS), ('CP:SOC_META_LAL2', ['SOC_META_LAL2'])):
    for mk in dm.index[:23]:
        x = co[(co.cohort_month == mk) & co.campaign_key.isin(cs)]; n0 = x[x.month_offset == 0].customers_start.sum()
        if n0 <= 0: continue
        pk = f'C-{mk}'; cost = spm[spm.index.get_level_values(0).isin(cs) & (spm.index.get_level_values(1) == mk)].sum() * (1 + teamm[mk] / spm_all[mk])
        V[(sname, pk, 'customers')] = n0; V[(sname, pk, 'arpa')] = x[x.month_offset == 0].revenue_usd.sum() / n0; V[(sname, pk, 'cohort_cac')] = cost / n0
        V[(sname, pk, 'refund_rate')] = x.refund_count.sum() / n0
        net = (x.revenue_usd - x.refunds_usd).groupby(x.month_offset).sum().sort_index().cumsum() * GM / cost
        for k_, v_ in net.items(): V[(sname, pk, f'payback.m{k_}')] = v_
        hit = net[net >= 1]
        if len(hit): V[(sname, pk, 'payback_month')] = int(hit.index[0])
        for N in (1, 3, 7, 14, 30, 60, 90):
            z = rt[(rt.cohort_month == mk) & (rt.day_n == N) & rt.campaign_key.isin(cs)]
            if len(z) and z.users_matured.sum() > 0: V[(sname, pk, f'retention.d{N}')] = z.users_active.sum() / z.users_matured.sum()
# creatives of SOC_META_LAL2 on the as-of day, terms of SOC_META_LAL2 and SRCH_NONBRAND_ANALYTICS, daily keys
for ck in sorted(dl[(dl.campaign_key == 'SOC_META_LAL2') & (dl.date == AS_OF)].creative_key.unique()):
    x = dl[dl.creative_key == ck].set_index('date')
    l7, p7 = x['2026-10-28':'2026-11-03'], x['2026-10-21':'2026-10-27']
    c7 = l7.clicks.sum() / l7.impressions.sum(); sl_ = c7 / (p7.clicks.sum() / p7.impressions.sum()) - 1; fq = l7.impressions.sum() / x.loc[AS_OF].reach_7d.sum()
    stt = 3 if (sl_ < P[('ALL', 'FATIGUE_SLOPE')] and fq > P[('ALL', 'FATIGUE_FREQ')]) else 2 if (sl_ < 0 and fq > P[('ALL', 'WATCH_FREQ')]) else 1
    for k_, v_ in (('ctr_7d', c7), ('ctr_slope_7d', sl_), ('frequency_7d', fq), ('creative_status', stt)): V[(f'CR:{ck}', W, k_)] = v_
tw_ = tm[(tm.date >= a) & (tm.date <= b) & tm.campaign_key.isin(['SOC_META_LAL2', 'SRCH_NONBRAND_ANALYTICS'])].groupby('term_key')[['impressions', 'clicks', 'spend_usd', 'signups']].sum()
for tk, rw in tw_.iterrows():
    for k_, v_ in (('impressions', rw.impressions), ('clicks', rw.clicks), ('spend', rw.spend_usd), ('signups', rw.signups)): V[(f'TM:{tk}', W, k_)] = v_
    if rw.clicks > 0: V[(f'TM:{tk}', W, 'cpc')] = rw.spend_usd / rw.clicks; V[(f'TM:{tk}', W, 'cvr')] = rw.signups / rw.clicks
for sname, cs in (('ALL', KEYS), ('CP:SOC_META_LAL2', ['SOC_META_LAL2'])):
    for d in pd.date_range(a, b):
        pc1 = per_campaign(d, d).loc[cs].sum(); pk = f'D-{d.date()}'
        vals = dict(spend=pc1.spend_usd, plan=pc1.plan, impressions=pc1.impressions, clicks=pc1.clicks, signups=pc1.signups, trials=pc1.trials,
                    **{'paid_customers.dda': pc1['paid_customers|DDA'], 'new_mrr.dda': pc1['new_mrr_usd|DDA']})
        for k_, v_ in vals.items(): V[(sname, pk, k_)] = v_
        if pc1['paid_customers|DDA'] > 0: V[(sname, pk, 'paid_cac')] = pc1.spend_usd / pc1['paid_customers|DDA']

# ---- AT-01: every control-total row reproduced --------------------------------------------------------------------------------------
ct = pd.read_csv(DATA / 'checks' / 'control_totals_usd.csv')
MONEY = ('spend', 'plan', 'new_mrr', 'cpa', 'cpc', 'cpm', 'cpl', 'cost_per_activated', 'team_cost', 'paid_cac', 'blended_cac', 'arpa', 'ltv', 'cohort_cac', 'cpa_target',
         'alert_value.PACING_OVER', 'alert_value.UNDERSPENT_SCALE', 'blended_cac_target', 'trial_shortfall')
COUNT = ('impressions', 'clicks', 'sessions', 'store_views', 'installs', 'first_opens', 'landed', 'signups', 'activated', 'trials', 'flag.', 'verdict.', 'alert.',
         'alerts_tripped', 'mover_rank', 'freshness_dot', 'creative_status', 'payback_month', 'retention_cohort_month', 'story.step_date')


def tol(m):
    if m.startswith(COUNT) or '.signups' in m or '.sessions' in m or '.store_views' in m: return 1e-6
    if m.startswith(MONEY) or m.endswith('.lcp_ms'): return .005
    return 1e-6


miss, bad = [], []
for r in ct.itertuples():
    v = V.get((r.scope, r.period_key, r.metric_code))
    if v is None: miss.append((r.scope, r.period_key, r.metric_code)); continue
    if not abs(float(v) - r.value) <= tol(r.metric_code) + 1e-9 * abs(r.value): bad.append((r.scope, r.period_key, r.metric_code, r.value, v))
check(f'AT-01 every control-total row recomputed from Parquet ({len(ct):,} rows)', not miss and not bad, (miss[:5], bad[:5], len(miss), len(bad)))
core = [m for m in ('spend', 'plan', 'pacing', 'impressions', 'clicks', 'signups', 'trials', 'paid_customers.dda', 'new_mrr.dda', 'blended_cac', 'payback_months', 'ltv_cac',
                    'roas_90d', 'attribution_gap', 'frequency_7d', 'ctr_slope_7d')]
have = set(zip(ct.scope, ct.period_key, ct.metric_code))
extra = [k for k in V if k[1] == W and k[2] in core and k not in have and V[('ALL', W, 'spend')] > 0 and not (k[0].startswith('CP:') and V.get((k[0], W, 'spend'), 0) <= 0)]
check('AT-01 the default window carries every core metric for every scope with activity', not extra, extra[:8])
check('A-76 period keys present: R30 x3, R7, MTD, QTD, M-2025-01 .. M-2026-10, D-2026-10-05 .. D-2026-11-03, cohort keys C-',
      {'R30-2026-11-03', 'R30-2026-10-04', 'R30-2025-11-03', 'R7-2026-11-03', 'MTD-2026-11-03', 'QTD-2026-11-03'} <= set(ct.period_key)
      and all(f'M-{m}' in set(ct.period_key) for m in dm.index[:22]) and ct.period_key.str.startswith('D-').sum() > 0 and ct.period_key.str.startswith('C-').sum() > 0)

# ---- AT-02 the story at display precision (recomputed values, not the CSV) -------------------------------------------------------------
Pk = 'R30-2026-10-04'
k1 = lambda x: f'{x / 1e3:.1f}'; p1 = lambda x: f'{x * 100:.1f}'; p0 = lambda x: f'{round(x * 100) + 0:.0f}'; i0 = lambda x: f'{x:.0f}'
dpc = lambda x, y: f'{(x / y - 1) * 100:+.1f}'
story = [
    ('Spend $188.4k (+7.0 % vs $176.1k), plan $176.0k, pacing 107 %, +7.0 % vs plan',
     (k1(g('ALL', 'spend')), dpc(g('ALL', 'spend'), g('ALL', 'spend', Pk)), k1(g('ALL', 'spend', Pk)), k1(g('ALL', 'plan')), p0(g('ALL', 'pacing')), dpc(g('ALL', 'spend'), g('ALL', 'plan'))),
     ('188.4', '+7.0', '176.1', '176.0', '107', '+7.0')),
    ('New paying customers 457 (+2.9 % vs 444), target 480', (i0(g('ALL', 'paid_customers.dda')), dpc(g('ALL', 'paid_customers.dda'), g('ALL', 'paid_customers.dda', Pk)),
                                                               i0(g('ALL', 'paid_customers.dda', Pk)), i0(g('ALL', 'paid_customers_target'))), ('457', '+2.9', '444', '480')),
    ('Blended CAC $531 (+6.4 % vs $499), paid CAC $412 (prev $397)', (i0(g('ALL', 'blended_cac')), dpc(g('ALL', 'blended_cac'), g('ALL', 'blended_cac', Pk)), i0(g('ALL', 'blended_cac', Pk)),
                                                                     i0(g('ALL', 'paid_cac')), i0(g('ALL', 'paid_cac', Pk))), ('531', '+6.4', '499', '412', '397')),
    ('New MRR $61.9k (+3.4 % vs $59.85k), ARPA $135 (prev $135)', (k1(g('ALL', 'new_mrr.dda')), dpc(g('ALL', 'new_mrr.dda'), g('ALL', 'new_mrr.dda', Pk)),
                                                                  f"{g('ALL', 'new_mrr.dda', Pk) / 1e3:.2f}", i0(g('ALL', 'arpa')), i0(g('ALL', 'arpa', Pk))), ('61.9', '+3.4', '59.85', '135', '135')),
    ('CAC payback 10.8 mo (+0.6 vs 10.2), LTV:CAC 3.4x (-0.2 vs 3.6x), churn 2.72 %',
     (f"{g('ALL', 'payback_months'):.1f}", f"{g('ALL', 'payback_months') - g('ALL', 'payback_months', Pk):+.1f}", f"{g('ALL', 'payback_months', Pk):.1f}",
      f"{g('ALL', 'ltv_cac'):.1f}", f"{g('ALL', 'ltv_cac') - g('ALL', 'ltv_cac', Pk):+.1f}", f"{g('ALL', 'ltv_cac', Pk):.1f}", f"{g('ALL', 'churn_monthly') * 100:.2f}"),
     ('10.8', '+0.6', '10.2', '3.4', '-0.2', '3.6', '2.72')),
    ('Funnel: 14.2 M impressions, 223.0k clicks (+0.9 % vs 221.0k), CTR 1.57 %, CPC $0.84, CPM $13.3',
     (f"{g('ALL', 'impressions') / 1e6:.1f}", k1(g('ALL', 'clicks')), dpc(g('ALL', 'clicks'), g('ALL', 'clicks', Pk)), k1(g('ALL', 'clicks', Pk)), f"{g('ALL', 'ctr') * 100:.2f}",
      f"{g('ALL', 'cpc'):.2f}", f"{g('ALL', 'cpm'):.1f}"), ('14.2', '223.0', '+0.9', '221.0', '1.57', '0.84', '13.3')),
    ('Funnel: sessions 114.8k + installs 21.7k, sign-ups 6,980 (CPL $27), activated 2,860 (41 %, $66), trials 3,220 (46 %), paid 457 (CPA $412)',
     (k1(g('ALL', 'sessions')), k1(g('ALL', 'installs')), i0(g('ALL', 'signups')), i0(g('ALL', 'cpl')), i0(g('ALL', 'activated')), p0(g('ALL', 'activation_rate')),
      i0(g('ALL', 'cost_per_activated')), i0(g('ALL', 'trials')), p0(g('ALL', 'trial_rate')), i0(g('ALL', 'cpa.dda'))),
     ('114.8', '21.7', '6980', '27', '2860', '41', '66', '3220', '46', '412')),
    ('click -> sign-up 3.1 % (+0.2 pt vs 2.9 %); trial -> paid 14.2 % (-1.9 pt vs 16.1 %)',
     (p1(g('ALL', 'click_signup_rate')), f"{(g('ALL', 'click_signup_rate') - g('ALL', 'click_signup_rate', Pk)) * 100:+.1f}", p1(g('ALL', 'click_signup_rate', Pk)),
      p1(g('ALL', 'trial_to_paid')), f"{(g('ALL', 'trial_to_paid') - g('ALL', 'trial_to_paid', Pk)) * 100:+.1f}", p1(g('ALL', 'trial_to_paid', Pk))),
     ('3.1', '+0.2', '2.9', '14.2', '-1.9', '16.1')),
    ('Guardrails: D7 27 % / D30 13 % (Sep 2026 cohort), refund 2.1 %, brand share 42 %, attribution gap +38 % (prev +30 %), synced 2 h, dot green',
     (p0(g('ALL', 'd7_retention')), p0(g('ALL', 'd30_retention')), i0(g('ALL', 'retention_cohort_month')), p1(g('ALL', 'refund_rate')), p0(g('ALL', 'brand_share')),
      p0(g('ALL', 'attribution_gap')), p0(g('ALL', 'attribution_gap', Pk)), i0(g('ALL', 'synced_hours_ago') // 1), i0(g('ALL', 'freshness_dot'))),
     ('27', '13', '202609', '2.1', '42', '38', '30', '2', '1'))]
for ch, vals in (('PAID_SEARCH', ('61.2', '188', '326', '1.31', '106', '57.5', '18')), ('PAID_SOCIAL', ('64.1', '112', '572', '0.74', '119', '54.0', '72')),
                 ('APP_INSTALL', ('28.6', '71', '403', '0.98', '101', '28.3', '29')), ('DISPLAY_VIDEO', ('19.9', '33', '603', '0.62', '108', '18.5', '95')),
                 ('RETARGETING', ('9.4', '38', '247', '1.90', '84', '11.2', '17')), ('AFFILIATES', ('5.2', '15', '347', '1.22', '80', '6.5', '0'))):
    s = f'CH:{ch}'
    story.append((f'Channel {ch}: spend, paid, CPA, ROAS 90 d, pacing, plan, platform gap = {vals}',
                  (k1(g(s, 'spend')), i0(g(s, 'paid_customers.dda')), i0(g(s, 'cpa.dda')), f"{g(s, 'roas_90d'):.2f}", p0(g(s, 'pacing')), k1(g(s, 'plan')), p0(g(s, 'attribution_gap'))), vals))
story.append(('Platform spend web 116.0k / iOS 39.3k / Android 33.1k; iOS + Android 72.4k (AT-04)',
              tuple(k1(g(s, 'spend')) for s in ('PF:WEB', 'PF:IOS', 'PF:ANDROID', 'PF:IOS+ANDROID')), ('116.0', '39.3', '33.1', '72.4')))
Ls = 'CP:SOC_META_LAL2'
story.append(('SOC_META_LAL2: spend $19.8k, pacing 122 %, CPA $641 (target $420), ROAS 0.58, dROAS -0.41, CTR slope -46 %, frequency 3.4',
              (k1(g(Ls, 'spend')), p0(g(Ls, 'pacing')), i0(g(Ls, 'cpa.dda')), i0(g(Ls, 'cpa_target')), f"{g(Ls, 'roas_90d'):.2f}", f"{g(Ls, 'roas_delta'):+.2f}",
               p0(g(Ls, 'ctr_slope_7d')), f"{g(Ls, 'frequency_7d'):.1f}"), ('19.8', '122', '641', '420', '0.58', '-0.41', '-46', '3.4')))
story.append(('SOC_META_LAL2 flags = Fatigue + Over-pacing, learning ended 2026-10-05',
              (','.join(f for f in FLAGS if V.get((Ls, W, f'flag.{f}')) == 1), str(cp.loc['SOC_META_LAL2', 'learning_end_date'].date())), ('FATIGUE,OVER_PACING', '2026-10-05')))
v3 = cr.index[(cr.campaign_key == 'SOC_META_LAL2') & (cr.creative_name == 'Dashboard in 60s · v3')][0]
story.append(("Top creative 'Dashboard in 60s · v3': CTR (7 d) 1.82 %, slope -46 %, frequency 3.4, Fatigued",
              (f"{g('CR:' + v3, 'ctr_7d') * 100:.2f}", p0(g('CR:' + v3, 'ctr_slope_7d')), f"{g('CR:' + v3, 'frequency_7d'):.1f}", i0(g('CR:' + v3, 'creative_status'))),
              ('1.82', '-46', '3.4', '3')))
story.append(('Step: paid CAC 7-day mean Oct 18-24 vs Oct 11-17 +20 % (+-1 pt); mobile paid social trial -> paid 16.5 % -> 9.8 %; web search and every other channel within +-0.5 pt',
              (abs(g('ALL', 'story.cac_step_7d') - .20) <= .01, p1(g('ALL', 'story.mps_trial_to_paid_before')), p1(g('ALL', 'story.mps_trial_to_paid_after')),
               abs(g('ALL', 'story.web_search_trial_to_paid_after') - g('ALL', 'story.web_search_trial_to_paid_before')) <= .005,
               all(abs(g('ALL', f'story.trial_to_paid_shift.{c}')) <= .005 for c in ['PAID_SEARCH', 'APP_INSTALL', 'DISPLAY_VIDEO', 'RETARGETING', 'AFFILIATES'])),
              (True, '16.5', '9.8', True, True)))
story.append(('SOC_META_LAL2 carries 70 % (+-2 pt) of the trial -> paid shortfall', (abs(g('ALL', 'story.loss_share_lookalike') - .70) <= .02,), (True,)))
story.append(('Journey: App Store CVR 31 % (prev 31 %), Google Play 27 % (prev 28 %), web landing -> sign-up 3.1 %, install -> sign-up 15.8 %',
              (p0(g('ALL', 'page.LP_APP_STORE.cvr')), p0(g('ALL', 'page.LP_APP_STORE.cvr', Pk)), p0(g('ALL', 'page.LP_PLAY_STORE.cvr')), p0(g('ALL', 'page.LP_PLAY_STORE.cvr', Pk)),
               p1(g('ALL', 'landing_signup_rate')), p1(g('ALL', 'install_signup_rate'))), ('31', '31', '27', '28', '3.1', '15.8')))
steps = [100] + [round(g('ALL', f'step_{n}_pct') * 100) for n in ('verified', 'workspace', 'connected', 'first_dashboard', 'invited')]
drops = [steps[i] - steps[i + 1] for i in range(5)]
story.append(('Onboarding 100 / 88 / 81 / 52 / 41 / 23 %, largest drop Connect data source -29 pt; median sign-up -> activation 26 h',
              (tuple(steps), drops.index(max(drops)), max(drops), i0(g('ALL', 'act_median_hours'))), ((100, 88, 81, 52, 41, 23), 2, 29, '26')))
story.append(('Activation by segment 46 / 38 / 47 / 44 / 39 / 29 %',
              tuple(p0(g('ALL', f'segment.{s}.activation_rate')) for s in ('WEB_DESKTOP', 'WEB_MOBILE', 'IOS_18', 'IOS_17', 'ANDROID_14_15', 'ANDROID_LE13')),
              ('46', '38', '47', '44', '39', '29')))
story.append(('UAC install -> sign-up 14.0 % -> 11.5 % from Oct 22; last 7 days vs previous period -2.5 pt',
              (p1(g('ALL', 'story.uac_install_signup_before')), p1(g('ALL', 'story.uac_install_signup_after')), f"{g('CP:APP_UAC_ANDROID', 'install_quality_delta') * 100:.1f}"),
              ('14.0', '11.5', '-2.5')))
story.append(('Cohorts: SOC_META_LAL2 Oct 2025 - Jan 2026 pay back in month 9; ALL Oct - Dec 2025 between month 10 and 12, Jan 2026 not by its last month (9)',
              (tuple(V.get((Ls, f'C-{m}', 'payback_month')) for m in ('2025-10', '2025-11', '2025-12', '2026-01')),
               all(10 <= V.get(('ALL', f'C-{m}', 'payback_month'), 0) <= 12 for m in ('2025-10', '2025-11', '2025-12')), ('ALL', 'C-2026-01', 'payback_month') in V),
              ((9, 9, 9, 9), True, False)))
story.append(('Top movers: Trial abandon +0.32, Brand search Global +0.11, Apple Search Ads +0.06 / TikTok -0.09, YouTube -0.18, Lookalike 2 % -0.41',
              tuple((k, f"{g('CP:' + k, 'roas_delta'):+.2f}", V.get(('CP:' + k, W, 'mover_rank'))) for k in
                    ('RT_TRIAL_ABANDON', 'SRCH_BRAND_GLOBAL', 'APP_ASA_CORE', 'SOC_META_LAL2', 'DV_YOUTUBE_DEMO', 'SOC_TIKTOK_CREATOR')),
              (('RT_TRIAL_ABANDON', '+0.32', 1), ('SRCH_BRAND_GLOBAL', '+0.11', 2), ('APP_ASA_CORE', '+0.06', 3), ('SOC_META_LAL2', '-0.41', -1),
               ('DV_YOUTUBE_DEMO', '-0.18', -2), ('SOC_TIKTOK_CREATOR', '-0.09', -3))))
story.append(('Exactly five alerts: CRIT Lookalike fatigue, WARN paid social 119 % (+$10.1k), WARN UAC install quality (-2.5 pt), INFO gap +8 pt, OK retargeting 84 % with ROAS 2.1',
              (i0(g('ALL', 'alerts_tripped')), V.get((Ls, W, 'alert.FATIGUE')), k1(g('CH:PAID_SOCIAL', 'alert_value.PACING_OVER')),
               f"{g('CP:APP_UAC_ANDROID', 'alert_value.INSTALL_QUALITY') * 100:.1f}", f"{g('ALL', 'alert_value.ATTR_GAP_WIDEN') * 100:+.0f}", V.get(('CH:RETARGETING', W, 'alert.UNDERSPENT_SCALE')),
               p0(g('CP:RT_TRIAL_ABANDON', 'pacing')), f"{g('CP:RT_TRIAL_ABANDON', 'roas_90d'):.1f}"),
              ('5', 1, '10.1', '-2.5', '+8', 1, '84', '2.1')))
story.append(('Brand campaigns: Brand search Global $19.1k, DE/FR $6.6k', (k1(g('CP:SRCH_BRAND_GLOBAL', 'spend')), k1(g('CP:SRCH_BRAND_DEFR', 'spend'))), ('19.1', '6.6')))
story.append(('Gross margin 36.3 %; team cost $45.5k a month to 2026-10-04, $55.73k from 2026-10-05 (deviation D-2)', (GM, tuple(team.value)), (0.363, (45500.0, 55730.0))))
for name, got, want in story: check(f'AT-02 {name}', got == want, f'{got} != {want}')
live_w = [k for k in KEYS if cp.loc[k, 'status_code'] in ('LIVE', 'LEARNING') and V.get((f'CP:{k}', W, 'spend'), 0) > 0]
check('AT-04 Status Live + Learning = 16 campaigns, all with spend in the default window', len(live_w) == 16 and len([k for k in KEYS if V.get((f'CP:{k}', W, 'spend'), 0) > 0]) == 16)
check('AT-11 plan Σ = $176.0k; R30 = 30 days of plan, MTD = Nov 1-3 at the November daily plan',
      k1(sum(g(f'CH:{c}', 'plan') for c in CH)) == '176.0' and abs(g('ALL', 'plan', 'MTD-2026-11-03') - sum(bud.get((k, '2026-11'), 0) for k in KEYS) / 10) < .01)
check('AT-15 freshness: every hourly source < 6 h, every daily source < 30 h, oldest hourly 2.25 h (ad platforms 12:40)',
      abs(g('ALL', 'synced_hours_ago') - 2.25) < 1e-9 and g('ALL', 'freshness_dot') == 1)
check('AT-03 previous period of R30 = Sep 5 - Oct 4; LY = Oct 5 - Nov 3 2025; R7 = Oct 28 - Nov 3; QTD from Oct 1',
      abs(g('ALL', 'spend', 'R30-2026-10-04') - 176_100) < .005 and g('ALL', 'spend', 'R30-2025-11-03') > 0 and abs(sum(g('ALL', 'spend', f'D-2026-{d}') for d in
          ('10-28', '10-29', '10-30', '10-31', '11-01', '11-02', '11-03')) - g('ALL', 'spend', 'R7-2026-11-03')) < .01)

# ---- AT-20 determinism ------------------------------------------------------------------------------------------------------------------
if not args.no_rerun:
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run([sys.executable, str(DATA / 'generator' / 'generate.py'), '--out', tmp], capture_output=True, text=True)
        files = [f'parquet/{t["table"]}.parquet' for t in man['tables']] + ['parquet/manifest.json', 'checks/control_totals_usd.csv']
        same = r.returncode == 0 and all(filecmp.cmp(DATA / f, Path(tmp) / f, shallow=False) for f in files)
        check(f'AT-20 rerun with seed 20261104 is byte-identical ({len(files)} files)', same, r.stderr[-400:])
print(f'\n{npass} passed, {len(fails)} failed')
print(f'{len(fails)} failure(s): ' + '; '.join(fails) if fails else 'ALL CHECKS GREEN')
sys.exit(1 if fails else 0)

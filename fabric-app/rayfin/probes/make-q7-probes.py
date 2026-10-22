# Writes the Q7 `KPI Trend` probe payloads (ADR-0007 K-24) for `rayfin connector invoke`,
# mirroring packages/frontend/src/pnl/data/pnl-model-queries.ts buildKpiTrendQuery with the
# default filters (FY2026 · Sep · YTD · Actual vs Budget / Prior year · USD · actual FX · M).
# usage (from fabric-app/): python -I rayfin/probes/make-q7-probes.py
# Shapes per entity: all12 (one query), fin8 (slots 1-8), ops4 (slots 9-12).
import json, os

CODES = {
    'P': (['NR', 'ORG_GROWTH', 'GM_PCT', 'GTN_PCT', 'AP_PCT', 'CM_PCT', 'EBITDA', 'OP'], ['UNITS', 'NR_PER_UNIT', 'VOL_GROWTH', 'PRICE_MIX']),
    'S': (['NR', 'ORG_GROWTH', 'GM_PCT', 'ARR', 'TAKE_RATE', 'CM_PCT', 'EBITDA', 'OP'], ['GMV', 'MERCHANTS', 'SUB_GM_PCT', 'RULE40']),
    # GROUP codes from the live Q2a of 2026-10-22 (q2a-meta-g.out)
    'GROUP': (['NR', 'ORG_GROWTH', 'GM_PCT', 'SVC_SHARE', 'IC_ELIM', 'CM_PCT', 'EBITDA', 'OP'], ['CP_OP_MARGIN', 'CC_OP_MARGIN', 'NP', 'ETR']),
}

VARS = [
    ('_entity', 'TREATAS ( {{ "{e}" }}, param_entity_view[entity_view_code] )'),
    ('_fy', 'TREATAS ( { 2026 }, param_fiscal_year[fiscal_year] )'),
    ('_month', 'TREATAS ( { 9 }, param_period[month_number] )'),
    ('_tv', 'TREATAS ( { "YTD" }, param_time_view[time_view_code] )'),
    ('_base', 'TREATAS ( { "A" }, param_base_version[choice_code] )'),
    ('_cmp_a', 'TREATAS ( { "B" }, param_compare_a[choice_code] )'),
    ('_cmp_b', 'TREATAS ( { "PY" }, param_compare_b[choice_code] )'),
    ('_ccy', 'TREATAS ( { "USD" }, param_reporting_currency[currency_code] )'),
    ('_fx', 'TREATAS ( { "ACT" }, param_fx_basis[fx_basis_code] )'),
    ('_units', 'TREATAS ( { "M" }, param_units[units_code] )'),
]


def query(entity, codes, tv='YTD'):
    vars_ = [(n, e.replace('{e}', entity) if '{e}' in e else e) for n, e in VARS]
    vars_ = [(n, e.replace('"YTD"', f'"{tv}"') if n == '_tv' else e) for n, e in vars_]
    vars_.append(('_kpis', 'TREATAS ( { ' + ', '.join(f'"{c}"' for c in codes) + ' }, dim_kpi[kpi_code] )'))
    pad = max(len(n) for n, _ in vars_) + 1
    lines = ['DEFINE'] + [f'    VAR {n.ljust(pad)}= {e}' for n, e in vars_]
    lines += [
        'EVALUATE',
        'SUMMARIZECOLUMNS (',
        '    dim_kpi[kpi_code]',
        '    ,dim_month[month_index]',
        '    ,dim_month[month_key]',
        '    ,' + ', '.join(n for n, _ in vars_),
        '    ,"@v", CONVERT ( [KPI Trend], DOUBLE )',
        ')',
        'ORDER BY dim_kpi[kpi_code], dim_month[month_index]',
    ]
    return '\n'.join(lines)


out = os.path.join(os.path.dirname(__file__), '..', '.temp')
os.makedirs(out, exist_ok=True)
for entity, (fin, ops) in CODES.items():
    tag = entity.lower()
    for shape, codes in (('all12', fin + ops), ('fin8', fin), ('ops4', ops)):
        with open(os.path.join(out, f'q7-{tag}-{shape}.query.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'query': query(entity, codes), 'resultSetRowCountLimit': 200}, f, indent=2)
        print('wrote', f'q7-{tag}-{shape}.query.json')
# The committed smoke probe: P, both batches as the app sends them.
probes = os.path.dirname(__file__)
with open(os.path.join(probes, 'q7-kpi-trend-smoke.query.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump({'query': query('P', CODES['P'][0]), 'resultSetRowCountLimit': 200}, f, indent=2)
print('wrote probes/q7-kpi-trend-smoke.query.json (P fin8)')

#!/usr/bin/env python3
"""ACME Cash Flow - deterministic synthetic QuickBooks Online company (ADR-0019; generator spec, report spec 9.2).

Usage:  python generate.py [--out <folder>]      (default: the dataset folder, one level up)
Writes  <out>/parquet/<table>.parquet + <out>/parquet/manifest.json, <out>/qbo/... (generator spec 10.1 files) and
        <out>/checks/control_totals_usd.csv.

One source of truth: the processes emit QBO transactions; the ledger, every report object and every table are computed
from them. Preset 'typical' (S01, S02, S03, S04, S06, S07, S08, S13, S18), profile services, size S, seed 42.
All names are invented and plainly fictional; all figures are illustrative.
"""
import argparse, json, sys, time
from pathlib import Path

import pandas as pd

import config as C
import engine, derive_core, derive_more, oracle, reports, reports_gl, writers
from metrics import control_totals

COLS = {
    'dim_account': ['account_id', 'account_name', 'fully_qualified_name', 'parent_account_id', 'account_level', 'account_type', 'account_subtype',
                    'classification', 'is_pl', 'is_cash', 'is_bank', 'cash_kind', 'default_section', 'override_section', 'override_line_label',
                    'direct_line_in', 'direct_line_out', 'sort_order', 'active', 'current_balance', 'last_reconciled_date', 'cash_floor'],
    'dim_cf_line': ['view', 'line_code', 'section_code', 'line_label', 'line_kind', 'sort_order', 'usual_direction', 'sign_rule', 'qbo_group'],
    'dim_counterparty': ['counterparty_id', 'counterparty_kind', 'counterparty_name', 'active', 'created_date'],
    'dim_class': ['class_id', 'class_name'],
    'dim_date': ['date', 'month_key', 'year', 'quarter', 'month_num', 'month_name', 'fiscal_year', 'is_month_end', 'is_working_day', 'is_actual'],
    'map_account_line': ['map_id', 'account_id', 'view', 'direction', 'section_code', 'line_code', 'line_label', 'effective_from', 'is_override',
                         'reason', 'author', 'created_at'],
    'fact_txn': ['txn_id', 'txn_type', 'txn_date', 'month_key', 'doc_number', 'counterparty_id', 'header_account_id', 'bank_account_id', 'payment_type',
                 'payment_method', 'total_amount', 'open_balance', 'cash_amount', 'private_note', 'created_at', 'updated_at', 'sync_token', 'is_edited',
                 'process_id', 'chain_id', 'scenario_id', 'cleared_status', 'cleared_date', 'qbo_link'],
    'fact_ledger_line': ['txn_id', 'ledger_seq', 'txn_date', 'month_key', 'txn_type', 'account_id', 'amount', 'line_kind', 'line_seq', 'qbo_line_id',
                         'counterparty_id', 'class_id', 'description', 'link_txn_id', 'link_txn_type'],
    'fact_cash_posting': ['posting_id', 'txn_id', 'txn_date', 'month_key', 'source_type', 'cash_account_id', 'cash_kind', 'offset_ledger_seq',
                          'posting_account_id', 'offset_account_id', 'settled_txn_id', 'settled_ledger_seq', 'counterparty_id', 'counterparty_source',
                          'class_id', 'amount', 'is_internal_transfer', 'direct_line_code', 'default_direct_line_code', 'in_bank_view',
                          'bank_view_line_code', 'cleared_status', 'cleared_date', 'is_journal_entry', 'memo'],
    'fact_account_balance': ['account_id', 'month_key', 'month_end', 'opening_balance', 'net_change', 'closing_balance'],
    'fact_settlement_link': ['link_id', 'payment_txn_id', 'payment_txn_type', 'payment_line_seq', 'document_txn_id', 'document_txn_type',
                             'document_ledger_seq', 'document_account_id', 'applied_amount', 'allocated_amount'],
    'fact_noncash_item': ['txn_id', 'txn_date', 'month_key', 'section_code', 'indirect_amount', 'direct_amount', 'noncash_amount', 'noncash_amount_default'],
    'fact_exception': ['exception_id', 'exception_code', 'txn_id', 'account_id', 'month_key', 'amount', 'detail', 'is_routine', 'scenario_id'],
    'ctl_qbo_cashflow': ['month_key', 'row_group', 'row_label', 'account_id', 'row_kind', 'amount', 'report_file', 'pulled_at'],
    'ctl_scenario': ['scenario_id', 'instance', 'period', 'txn_ids', 'checks', 'exception_codes', 'expected_json'],
}


def build_reports(R, D):
    B = reports.Builder(R, D)
    out, cf_month = [], []
    for a, b in reports.WINDOWS:
        per = f'{a.isoformat()}_{b.isoformat()}'
        for by in ('Month', 'Total'):
            cf = B.cashflow(a, b, by)
            out.append((f'CashFlow/{per}_{by}.json', cf))
            if by == 'Month': cf_month.append((f'CashFlow/{per}_Month.json', cf))
            out.append((f'ProfitAndLoss/{per}_{by}.json', B.profit_and_loss(a, b, by)))
            out.append((f'BalanceSheet/{per}_{by}.json', B.balance_sheet(a, b, by)))
        gl, tl = reports_gl.build(R, D, B, a, b)
        out.append((f'GeneralLedger/{per}_Total.json', gl)); out.append((f'TransactionList/{per}_Total.json', tl))
    return out, cf_month


def validate(ct, T):
    """Engine self-test (generator spec 2, Validator): stop the run on any breach of I09 / C06 / C09 / C10."""
    v = {(r.period_key, r.metric_code, r.scope): r.value for r in ct.itertuples()}
    bad = []
    for pk in sorted({k[0] for k in v}):
        m03 = v[(pk, 'M03', 'ALL')]
        for sc in ('QBO_DEFAULT', 'OVERRIDES_ON'):
            if abs(v[(pk, 'M06', sc)] + v[(pk, 'M07', sc)] + v[(pk, 'M08', sc)] - m03) > 0.004: bad.append(('I09', pk, sc))
        if abs(v[(pk, 'M11', 'ALL')] - m03) > 0.004: bad.append(('C06', pk))
        if abs(v[(pk, 'M12', 'ALL')]) > 0.004: bad.append(('C09', pk))
        if abs(v[(pk, 'M14', 'ALL')]) > 0.004: bad.append(('C10', pk))
    ctl = T['ctl_qbo_cashflow']
    inc = ctl[ctl.row_group == 'CashIncrease'].set_index('month_key').amount
    for m, a in inc.items():
        if abs(a - v[(f'M-{m}', 'M03', 'ALL')]) > 0.004: bad.append(('C01', m))
    if bad: sys.exit(f'validator: {len(bad)} breach(es): {bad[:10]}')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent)); out = Path(ap.parse_args().out)
    t0 = time.time()
    (out / 'parquet').mkdir(parents=True, exist_ok=True); (out / 'checks').mkdir(parents=True, exist_ok=True)
    R = engine.simulate()
    D = derive_core.build(R)
    reps, cf_month = build_reports(R, D)
    nci = derive_more.noncash_items(R, D)
    ex = derive_more.exceptions(R, D, nci)
    acct, cfl, cp, klass, dates = derive_more.dims(R, D)
    recs = oracle.records(R, D, ex)
    chains = [dict(chain_id=c['chain_id'], process=c['process'], counterparty_id=int(c['counterparty']) if c['counterparty'] else None,
                   txn_ids=sorted(int(R['book'].by_k[k]['Id']) for k in c['keys']),
                   txn_types=[R['book'].by_k[k]['type'] for k in sorted(c['keys'], key=lambda k: int(R['book'].by_k[k]['Id']))])
              for c in R['book'].chains.values() if c['keys']]
    rows = D['rows']
    for i, r in enumerate(rows, start=1): r['posting_id'] = i
    for i, r in enumerate(D['links'], start=1): r['link_id'] = i
    tables = {
        'dim_account': acct, 'dim_cf_line': cfl, 'dim_counterparty': cp, 'dim_class': klass, 'dim_date': dates,
        'map_account_line': derive_more.mapping(R, D['cl']), 'fact_txn': D['txn'], 'fact_ledger_line': D['led'], 'fact_cash_posting': rows,
        'fact_account_balance': D['bal'], 'fact_settlement_link': D['links'], 'fact_noncash_item': nci, 'fact_exception': ex,
        'ctl_qbo_cashflow': derive_more.ctl_from_cashflow(cf_month),
        'ctl_scenario': [dict(scenario_id=r['scenario_id'], instance=r['instance'], period=r['period'], txn_ids=','.join(map(str, r['txn_ids'])),
                              checks=','.join(r['checks']), exception_codes=','.join(r['exception_codes']),
                              expected_json=json.dumps(r['expected'], sort_keys=True)) for r in recs],
    }
    man = [writers.write_table(out, n, tables[n], COLS[n]) for n in COLS]
    T = {n: pd.read_parquet(out / 'parquet' / f'{n}.parquet') for n in COLS}
    ct = control_totals(T)
    validate(ct, T)
    ct.to_csv(out / 'checks' / 'control_totals_usd.csv', index=False, lineterminator='\n', float_format='%.6f')
    counts, qbo_bytes, qbo_files = writers.write_qbo(out, R, D, reps, recs, chains)
    (out / 'parquet' / 'manifest.json').write_text(json.dumps(dict(
        dataset='acme_cash_flow_dummy_data', engine_version=C.ENGINE_VERSION, seed=C.SEED, preset=C.PRESET, as_of=C.AS_OF.isoformat(),
        start_date=C.START.isoformat(), end_date=C.END.isoformat(), currency=C.HOME_CURRENCY, scenarios=C.SCENARIOS, tables=man), indent=1) + '\n',
        encoding='utf-8', newline='\n')
    tot = 0
    for m_ in man: tot += m_['parquet_bytes']; print(f"{m_['table']:<24}{m_['rows']:>8,} rows  {m_['parquet_bytes'] / 1e3:8.1f} kB")
    print(f"{'parquet total':<24}{sum(m_['rows'] for m_ in man):>8,} rows  {tot / 1e6:8.2f} MB")
    print(f"qbo: {qbo_files} files, {qbo_bytes / 1e6:.2f} MB; transactions {sum(v for k, v in counts.items() if k not in ('Account', 'Customer', 'Vendor', 'Employee', 'Class', 'Item', 'Term', 'PaymentMethod', 'CompanyInfo', 'Preferences')):,}")
    print(f"control totals: {len(ct):,} rows; exceptions {len(ex)}; scenario records {len(recs)}; LoC draws {len(R['cash_log']['draws'])}, "
          f"repayments {len(R['cash_log']['repays'])}, min operating balance {R['cash_log']['min_op'] / 100:,.2f}; runtime {time.time() - t0:.1f} s")


if __name__ == '__main__':
    main()

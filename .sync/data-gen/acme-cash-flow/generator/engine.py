"""Pipeline: company -> processes -> scenarios -> cash constraint -> QBO emitter -> ledger (generator spec section 2)."""
import datetime as dt

import config as C
import company, sim_sales, sim_spend, sim_capital, scenarios, cashpass, emit
from book import Book
from ledger import post


def simulate():
    co = company.build()
    book = Book(co)
    plan = sim_sales.revenue_plan()
    uf_items, ret_total = sim_sales.run(book, co, plan)
    sim_spend.bills(book, co, plan, skip_its={(2024, 6)})
    stmts = sim_spend.direct_and_card(book, co)
    sim_spend.payroll(book, co)
    sim_spend.sales_tax(book, co)
    sim_capital.opening(book, co)
    cap = sim_capital.run(book, co)
    scen, forced = scenarios.plant(book, co, uf_items)
    card_post = []
    for t in book.txns:
        for ln in post(t['type'], t['obj'], co):
            if ln['account_id'] == co.aid['CC']: card_post.append((t['date'], ln['amount']))
    sim_spend.card_payments(book, co, stmts, card_post)
    n_dep = cashpass.sweep_deposits(book, co, uf_items, forced)
    cash_log = cashpass.run(book, co)
    s18 = scenarios.mark_uncleared(book)
    emit.emit(book, co)
    ledger = []
    for t in book.txns:
        for i, ln in enumerate(post(t['type'], t['qbo'], co), start=1):
            ln['txn_k'] = t['k']; ln['ledger_seq'] = i
            ledger.append(ln)
    return dict(co=co, book=book, plan=plan, cap=cap, scen=scen, s18=s18, cash_log=cash_log, ledger=ledger, n_dep=n_dep)

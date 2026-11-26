"""Book: collects the emitted QBO transactions (generator spec 4.2) with internal keys, chains and scenario tags.

Builders take amounts in integer cents and write QBO-shaped bodies. Links to other transactions hold a `K(key)`
placeholder that emit.py resolves to the final Id. Nothing downstream adds or alters a transaction.
"""
from util import money
from company import ref, aref

USD = {'value': 'USD', 'name': 'United States Dollar'}


class K:
    __slots__ = ('k',)

    def __init__(self, k): self.k = k


def d(x): return x.isoformat()


class Book:
    def __init__(self, co):
        self.co = co
        self.txns = []          # dicts: k, type, date, proc, chains, scen, obj, entity, extra
        self.by_k = {}
        self.chains = {}        # chain id -> dict(process, counterparty, keys)
        self._k = 0

    # ---- bookkeeping ---------------------------------------------------------------------------------------------------
    def chain(self, proc, cp=None):
        cid = len(self.chains) + 1
        self.chains[cid] = dict(chain_id=cid, process=proc, counterparty=cp, keys=[])
        return cid

    def add(self, typ, date, obj, proc, chains=(), scen=None, **extra):
        self._k += 1
        t = dict(k=self._k, type=typ, date=date, proc=proc, chains=list(chains), scen=scen, obj=obj, extra=extra)
        self.txns.append(t); self.by_k[self._k] = t
        for c in chains: self.chains[c]['keys'].append(self._k)
        return t

    def link(self, t, chain_id):
        t['chains'].append(chain_id); self.chains[chain_id]['keys'].append(t['k'])

    # ---- line helpers --------------------------------------------------------------------------------------------------
    def _sales_lines(self, lines):
        """lines: [(item_code, cents, qty, desc)] -> QBO sales lines + subtotal line; returns (Line, subtotal, taxable)."""
        out, sub, taxable = [], 0, 0
        for i, (item, c, qty, desc) in enumerate(lines, start=1):
            it = self.co.items[item]
            qty = qty or 1
            det = {'ItemRef': {'value': it['Id'], 'name': it['Name']}, 'ClassRef': ref(self.co.cls[it['cls']], 'Name'),
                   'Qty': qty, 'UnitPrice': round(c / 100.0 / qty, 6), 'TaxCodeRef': {'value': 'TAX' if it['taxable'] else 'NON'}}
            ln = {'Id': str(i), 'LineNum': i, 'Amount': money(c), 'DetailType': 'SalesItemLineDetail', 'SalesItemLineDetail': det}
            if desc: ln['Description'] = desc
            out.append(ln); sub += c; taxable += c if it['taxable'] else 0
        out.append({'Amount': money(sub), 'DetailType': 'SubTotalLineDetail', 'SubTotalLineDetail': {}})
        return out, sub, taxable

    def _exp_lines(self, lines):
        """lines: [(account_code, cents, class_code, desc)] -> AccountBasedExpenseLineDetail lines; returns (Line, total)."""
        out, tot = [], 0
        for i, (acct, c, cl, desc) in enumerate(lines, start=1):
            det = {'AccountRef': aref(self.co, acct), 'BillableStatus': 'NotBillable', 'TaxCodeRef': {'value': 'NON'}}
            if cl: det['ClassRef'] = ref(self.co.cls[cl], 'Name')
            ln = {'Id': str(i), 'LineNum': i, 'Amount': money(c), 'DetailType': 'AccountBasedExpenseLineDetail',
                  'AccountBasedExpenseLineDetail': det}
            if desc: ln['Description'] = desc
            out.append(ln); tot += c
        return out, tot

    @staticmethod
    def _tax(taxable, rate):
        return int(round(taxable * rate))

    # ---- customer side -------------------------------------------------------------------------------------------------
    def invoice(self, date, cust, lines, due, terms, proc, chain, memo=None, tax_rate=0.0, scen=None):
        L, sub, taxable = self._sales_lines(lines)
        tax = self._tax(taxable, tax_rate)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'CustomerRef': ref(cust), 'SalesTermRef': ref(self.co.terms[terms], 'Name'),
               'DueDate': d(due), 'Line': L, 'TxnTaxDetail': {'TotalTax': money(tax)}, 'TotalAmt': money(sub + tax),
               'Balance': money(sub + tax), 'LinkedTxn': [], 'EmailStatus': 'EmailSent', 'PrintStatus': 'NotSet'}
        if memo: obj['CustomerMemo'] = {'value': memo}
        return self.add('Invoice', date, obj, proc, [chain], scen, cust=cust, total=sub + tax, tax=tax)

    def credit_memo(self, date, cust, lines, proc, chain, memo=None, tax_rate=0.0, scen=None):
        L, sub, taxable = self._sales_lines(lines)
        tax = self._tax(taxable, tax_rate)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'CustomerRef': ref(cust), 'Line': L, 'TxnTaxDetail': {'TotalTax': money(tax)},
               'TotalAmt': money(sub + tax), 'RemainingCredit': money(sub + tax), 'Balance': money(sub + tax)}
        if memo: obj['PrivateNote'] = memo
        return self.add('CreditMemo', date, obj, proc, [chain], scen, cust=cust, total=sub + tax, tax=tax)

    def payment(self, date, cust, deposit_to, applied, proc, chains, method='PM_ACH', ref_num=None, memo=None, scen=None):
        """applied: [(txn, cents)] - invoices positive, credit memos as credits (positive amounts)."""
        L, tot = [], 0
        for t, c in applied:
            L.append({'Amount': money(c), 'LinkedTxn': [{'TxnId': K(t['k']), 'TxnType': t['type']}]})
            tot += c if t['type'] == 'Invoice' else -c
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'CustomerRef': ref(cust), 'DepositToAccountRef': aref(self.co, deposit_to),
               'PaymentMethodRef': ref(self.co.pm[method], 'Name'), 'TotalAmt': money(tot), 'UnappliedAmt': 0.0,
               'ProcessPayment': False, 'Line': L}
        if ref_num: obj['PaymentRefNum'] = ref_num
        if memo: obj['PrivateNote'] = memo
        return self.add('Payment', date, obj, proc, chains, scen, cust=cust, total=tot, applied=applied, deposit_to=deposit_to)

    def sales_receipt(self, date, cust, lines, deposit_to, proc, chain, method='PM_CARD', tax_rate=0.0, memo=None, scen=None):
        L, sub, taxable = self._sales_lines(lines)
        tax = self._tax(taxable, tax_rate)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'CustomerRef': ref(cust), 'DepositToAccountRef': aref(self.co, deposit_to),
               'PaymentMethodRef': ref(self.co.pm[method], 'Name'), 'Line': L, 'TxnTaxDetail': {'TotalTax': money(tax)},
               'TotalAmt': money(sub + tax), 'Balance': 0.0}
        if memo: obj['PrivateNote'] = memo
        return self.add('SalesReceipt', date, obj, proc, [chain], scen, cust=cust, total=sub + tax, tax=tax, deposit_to=deposit_to)

    def refund_receipt(self, date, cust, lines, bank, proc, chain, method='PM_CARD', tax_rate=0.0, memo=None, scen=None):
        L, sub, taxable = self._sales_lines(lines)
        tax = self._tax(taxable, tax_rate)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'CustomerRef': ref(cust), 'DepositToAccountRef': aref(self.co, bank),
               'PaymentMethodRef': ref(self.co.pm[method], 'Name'), 'Line': L, 'TxnTaxDetail': {'TotalTax': money(tax)},
               'TotalAmt': money(sub + tax), 'Balance': 0.0}
        if memo: obj['PrivateNote'] = memo
        return self.add('RefundReceipt', date, obj, proc, [chain], scen, cust=cust, total=sub + tax, tax=tax)

    def deposit(self, date, bank, linked=(), direct=(), proc='P01', chains=(), memo=None, scen=None):
        """linked: [txn] swept from Undeposited Funds; direct: [(account_code, cents, entity|None, class_code, desc)]."""
        L, tot, n = [], 0, 0
        for t in linked:
            n += 1; c = t['extra']['total']
            L.append({'Id': str(n), 'LineNum': n, 'Amount': money(c), 'LinkedTxn': [{'TxnId': K(t['k']), 'TxnType': t['type'], 'TxnLineId': '0'}]})
            tot += c
        for acct, c, ent, cl, desc in direct:
            n += 1
            det = {'AccountRef': aref(self.co, acct)}
            if ent is not None: det['Entity'] = {'value': ent['Id'], 'name': ent['name'], 'type': ent['kind'].upper()}
            if cl: det['ClassRef'] = ref(self.co.cls[cl], 'Name')
            ln = {'Id': str(n), 'LineNum': n, 'Amount': money(c), 'DetailType': 'DepositLineDetail', 'DepositLineDetail': det}
            if desc: ln['Description'] = desc
            L.append(ln); tot += c
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'DepositToAccountRef': aref(self.co, bank), 'TotalAmt': money(tot), 'Line': L}
        if memo: obj['PrivateNote'] = memo
        return self.add('Deposit', date, obj, proc, chains, scen, total=tot, linked=list(linked), bank=bank)

    # ---- supplier side -------------------------------------------------------------------------------------------------
    def bill(self, date, vend, lines, due, proc, chain, doc=None, memo=None, scen=None):
        L, tot = self._exp_lines(lines)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'VendorRef': ref(vend), 'APAccountRef': aref(self.co, 'AP'), 'DueDate': d(due),
               'Line': L, 'TotalAmt': money(tot), 'Balance': money(tot), 'LinkedTxn': []}
        if doc: obj['DocNumber'] = doc
        if memo: obj['PrivateNote'] = memo
        return self.add('Bill', date, obj, proc, [chain], scen, vend=vend, total=tot)

    def vendor_credit(self, date, vend, lines, proc, chain, doc=None, memo=None, scen=None):
        L, tot = self._exp_lines(lines)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'VendorRef': ref(vend), 'APAccountRef': aref(self.co, 'AP'), 'Line': L,
               'TotalAmt': money(tot), 'Balance': money(tot)}
        if doc: obj['DocNumber'] = doc
        if memo: obj['PrivateNote'] = memo
        return self.add('VendorCredit', date, obj, proc, [chain], scen, vend=vend, total=tot)

    def bill_payment(self, date, vend, pay_from, applied, proc, chains, card=False, memo=None, scen=None):
        L, tot = [], 0
        for t, c in applied:
            L.append({'Amount': money(c), 'LinkedTxn': [{'TxnId': K(t['k']), 'TxnType': t['type']}]})
            tot += c if t['type'] == 'Bill' else -c
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'VendorRef': ref(vend), 'APAccountRef': aref(self.co, 'AP'), 'TotalAmt': money(tot), 'Line': L}
        if card:
            obj['PayType'] = 'CreditCard'; obj['CreditCardPayment'] = {'CCAccountRef': aref(self.co, pay_from)}
        else:
            obj['PayType'] = 'Check'; obj['CheckPayment'] = {'BankAccountRef': aref(self.co, pay_from), 'PrintStatus': 'NotSet'}
        if memo: obj['PrivateNote'] = memo
        return self.add('BillPayment', date, obj, proc, chains, scen, vend=vend, total=tot, applied=applied, pay_from=pay_from, card=card)

    def purchase(self, date, pay_type, account, ent, lines, proc, chain, credit=False, memo=None, scen=None, method=None):
        """pay_type Cash | Check | CreditCard; ent = vendor/customer/employee dict or None (no payee)."""
        L, tot = self._exp_lines(lines)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'PaymentType': pay_type, 'AccountRef': aref(self.co, account), 'TotalAmt': money(tot), 'Line': L}
        if ent is not None: obj['EntityRef'] = {'value': ent['Id'], 'name': ent['name'], 'type': ent['kind']}
        if credit: obj['Credit'] = True
        if method: obj['PaymentMethodRef'] = ref(self.co.pm[method], 'Name')
        if memo: obj['PrivateNote'] = memo
        return self.add('Purchase', date, obj, proc, [chain] if chain else [], scen, ent=ent, total=tot, account=account, credit=credit)

    def cc_payment(self, date, card, bank, cents_, vend, proc, chain, memo=None, scen=None):
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'CreditCardAccountRef': aref(self.co, card), 'BankAccountRef': aref(self.co, bank),
               'Amount': money(cents_), 'VendorRef': ref(vend)}
        if memo: obj['PrivateNote'] = memo
        return self.add('CreditCardPayment', date, obj, proc, [chain], scen, total=cents_, vend=vend)

    def transfer(self, date, frm, to, cents_, proc, chain=None, memo=None, scen=None):
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'FromAccountRef': aref(self.co, frm), 'ToAccountRef': aref(self.co, to), 'Amount': money(cents_)}
        if memo: obj['PrivateNote'] = memo
        return self.add('Transfer', date, obj, proc, [chain] if chain else [], scen, total=cents_, frm=frm, to=to)

    def journal(self, date, lines, proc, chain=None, doc=None, memo=None, scen=None, adjustment=False):
        """lines: [(account_code, cents_signed (+ debit / - credit), entity|None, class_code|None, desc)]."""
        L, dr = [], 0
        for i, (acct, c, ent, cl, desc) in enumerate(lines, start=1):
            det = {'PostingType': 'Debit' if c > 0 else 'Credit', 'AccountRef': aref(self.co, acct)}
            if ent is not None: det['Entity'] = {'Type': ent['kind'], 'EntityRef': {'value': ent['Id'], 'name': ent['name']}}
            if cl: det['ClassRef'] = ref(self.co.cls[cl], 'Name')
            ln = {'Id': str(i - 1), 'LineNum': i, 'Amount': money(abs(c)), 'DetailType': 'JournalEntryLineDetail', 'JournalEntryLineDetail': det}
            if desc: ln['Description'] = desc
            L.append(ln); dr += c if c > 0 else 0
        assert sum(x[1] for x in lines) == 0, ('unbalanced JE', date, lines)
        obj = {'TxnDate': d(date), 'CurrencyRef': USD, 'Adjustment': adjustment, 'TotalAmt': money(dr), 'Line': L}
        if doc: obj['DocNumber'] = doc
        if memo: obj['PrivateNote'] = memo
        return self.add('JournalEntry', date, obj, proc, [chain] if chain else [], scen, total=dr)

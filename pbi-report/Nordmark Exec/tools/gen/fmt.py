"""DAX twins of js-exec/lib/engine/format.ts (E-42): minus U+2212, fixed separators, eurM auto digits, n/a for blanks.
Every helper returns a self-contained DAX expression ( VAR _fN = x RETURN ... ) so an argument is evaluated once."""
import itertools

_n = itertools.count(1)
MINUS = "−"


def _v():
    return f"_f{next(_n)}"


class side_counter:
    """Own VAR numbers (_f900001 ..) for the inline texts of the SVG measures (perf pass 2026-10-30), so the global numbering of
    every other measure stays as it was."""

    def __enter__(self):
        global _n
        self.saved, _n = _n, itertools.count(900001)

    def __exit__(self, *a):
        global _n
        _n = self.saved


def _wrap(x, body, na=True):
    v = _v()
    b = body(v)
    if na:
        b = f'IF ( ISBLANK ( {v} ), "n/a", {b} )'
    return f"( VAR {v} = {x} RETURN {b} )"


def _fixed(v, d):
    return f'FORMAT ( ABS ( {v} ), "#,0{"." + "0" * d if d else ""}" )'


def _sign(v):
    return f'IF ( {v} >= 0, "+", "{MINUS}" )'


def _neg(v):
    return f'IF ( {v} < 0, "{MINUS}", "" )'


def eurM(x, digits=None, na=True):
    """€61.4m; €2,318m from €1 bn up."""
    def body(v):
        if digits is None:
            num = f'IF ( ABS ( {v} ) / 1000000 >= 1000, {_fixed(v + " / 1000000", 0)}, {_fixed(v + " / 1000000", 1)} )'
        else:
            num = _fixed(v + " / 1000000", digits)
        return f'{_neg(v)} & "€" & {num} & "m"'
    return _wrap(x, body, na)


def eurMNum(x, na=True):
    """eurM without the trailing m (card value)."""
    def body(v):
        num = f'IF ( ABS ( {v} ) / 1000000 >= 1000, {_fixed(v + " / 1000000", 0)}, {_fixed(v + " / 1000000", 1)} )'
        return f'{_neg(v)} & "€" & {num}'
    return _wrap(x, body, na)


def eurDelta(x, na=True):
    def body(v):
        num = f'IF ( ABS ( {v} ) / 1000000 >= 1000, {_fixed(v + " / 1000000", 0)}, {_fixed(v + " / 1000000", 1)} )'
        return f'{_sign(v)} & "€" & {num} & "m"'
    return _wrap(x, body, na)


def pct(x, digits=1, na=True):
    return _wrap(x, lambda v: f'{_neg(v)} & {_fixed(v + " * 100", digits)} & "%"', na)


def pctNum(x, digits=1, na=True):
    return _wrap(x, lambda v: f'{_neg(v)} & {_fixed(v + " * 100", digits)}', na)


def pctSigned(x, digits=1, na=True):
    return _wrap(x, lambda v: f'{_sign(v)} & {_fixed(v + " * 100", digits)} & "%"', na)


def pp(x, digits=1, na=True):
    return _wrap(x, lambda v: f'{_sign(v)} & {_fixed(v + " * 100", digits)} & " pp"', na)


def _trim(v):
    s = _v()
    return f'( VAR {s} = FORMAT ( ABS ( {v} * 100 ), "#,0.0" ) RETURN IF ( RIGHT ( {s}, 2 ) = ".0", LEFT ( {s}, LEN ( {s} ) - 2 ), {s} ) )'


def pctTarget(x, na=True):
    return _wrap(x, lambda v: f'{_trim(v)} & "%"', na)


def share(x, na=True):
    return _wrap(x, lambda v: _trim(v), na)


def signed(x, unit, digits=1, na=True):
    return _wrap(x, lambda v: f'{_sign(v)} & {_fixed(v, digits)} & "{unit}"', na)


def num(x, digits=1, na=True):
    return _wrap(x, lambda v: f'{_neg(v)} & {_fixed(v, digits)}', na)


def int_(x, na=True):
    return _wrap(x, lambda v: f'{_neg(v)} & {_fixed(v, 0)}', na)


def unitsM(x, na=True):
    return _wrap(x, lambda v: f'FORMAT ( {v} / 1000000, "#,0.0" ) & "m"', na)

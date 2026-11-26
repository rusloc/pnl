"""Shared helpers: random streams, cents, calendar, timestamps, largest-remainder allocation."""
import datetime as dt
import zlib
import numpy as np

from config import SEED


def stream(name):
    """One random stream per component (generator spec section 2): adding a stream never reshuffles another one."""
    return np.random.default_rng([SEED, zlib.crc32(name.encode('utf-8'))])


def cents(x):
    return int(round(float(x) * 100))


def money(c):
    """Cents -> float with two decimals (QBO JSON amount)."""
    return round(c / 100.0, 2)


def mstr(c):
    """Cents -> report cell string ("1234.50", "-12.00")."""
    s = '-' if c < 0 else ''
    c = abs(int(c))
    return f'{s}{c // 100}.{c % 100:02d}'


def alloc(total, weights):
    """Split integer `total` over `weights` pro rata; largest remainder, ties to the lower index. Sum is exact."""
    w = [abs(float(x)) for x in weights]
    sw = sum(w)
    n = len(w)
    if n == 0:
        return []
    if sw == 0:
        w, sw = [1.0] * n, float(n)
    sign = -1 if total < 0 else 1
    t = abs(int(total))
    raw = [t * x / sw for x in w]
    base = [int(np.floor(r)) for r in raw]
    rem = t - sum(base)
    order = sorted(range(n), key=lambda i: (-(raw[i] - base[i]), i))
    for i in order[:rem]:
        base[i] += 1
    return [sign * b for b in base]


def alloc_signed(total, amounts):
    """Allocate `total` pro rata to signed `amounts` (document lines may carry credits). Exact sum, deterministic."""
    s = sum(amounts)
    if s == 0:
        return alloc(total, [1] * len(amounts))
    raw = [total * a / s for a in amounts]
    base = [int(np.floor(r)) for r in raw]
    rem = total - sum(base)
    order = sorted(range(len(raw)), key=lambda i: (-(raw[i] - base[i]), i))
    for i in order[:rem]:
        base[i] += 1
    return base


# ---- calendar --------------------------------------------------------------------------------------------------------
def _nth_weekday(y, m, wd, n):
    d = dt.date(y, m, 1)
    d += dt.timedelta(days=(wd - d.weekday()) % 7)
    return d + dt.timedelta(weeks=n - 1)


def _last_weekday(y, m, wd):
    d = dt.date(y, m + 1, 1) - dt.timedelta(days=1) if m < 12 else dt.date(y, 12, 31)
    return d - dt.timedelta(days=(d.weekday() - wd) % 7)


def holidays(y):
    h = {dt.date(y, 1, 1), dt.date(y, 7, 4), dt.date(y, 12, 25), _nth_weekday(y, 1, 0, 3), _last_weekday(y, 5, 0),
         _nth_weekday(y, 9, 0, 1), _nth_weekday(y, 11, 3, 4)}
    out = set()
    for d in h:   # observed: Saturday -> Friday, Sunday -> Monday
        out.add(d - dt.timedelta(days=1) if d.weekday() == 5 else d + dt.timedelta(days=1) if d.weekday() == 6 else d)
    return out


_HOL = set().union(*(holidays(y) for y in range(2023, 2028)))


def is_working(d):
    return d.weekday() < 5 and d not in _HOL


def next_working(d):
    while not is_working(d):
        d += dt.timedelta(days=1)
    return d


def prev_working(d):
    while not is_working(d):
        d -= dt.timedelta(days=1)
    return d


def add_working(d, n):
    d = next_working(d)
    while n > 0:
        d += dt.timedelta(days=1)
        if is_working(d):
            n -= 1
    return d


def month_end(y, m):
    return (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1))


def months(start, end):
    """[(y, m)] for every month from start to end inclusive."""
    y, m, out = start.year, start.month, []
    while (y, m) <= (end.year, end.month):
        out.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def days(start, end):
    return [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]


def working_days(y, m):
    return [d for d in days(dt.date(y, m, 1), month_end(y, m)) if is_working(d)]


# ---- timestamps (company time zone: US Pacific, with DST) ---------------------------------------------------------------
def _pacific_offset(t):
    y = t.year
    dst_start = dt.datetime.combine(_nth_weekday(y, 3, 6, 2), dt.time(2))
    dst_end = dt.datetime.combine(_nth_weekday(y, 11, 6, 1), dt.time(2))
    return '-07:00' if dst_start <= t < dst_end else '-08:00'


def iso(t):
    return t.strftime('%Y-%m-%dT%H:%M:%S') + _pacific_offset(t)

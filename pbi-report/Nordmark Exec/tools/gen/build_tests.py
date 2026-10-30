"""Writes tests/control-totals.dax for the period model (ADR-0013 (k), E-90 .. E-99, ET-21 .. ET-32): every item-key row of
data/nordmark_retail_dummy_data/checks/control_totals_eur.csv through the base layer (the 6 legacy PTD- / YTD- keys are retired),
the card layer per type x comparator x scope through the picker slicers, texts, bars per type, identities, conceal in place,
the i target line and the item lists. One EVALUATE per block; run them one at a time."""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, CHECKS, CAT_CHECKS, write_text  # noqa: E402
from measures import KPIS  # noqa: E402

rows = list(csv.DictReader(open(CHECKS, encoding="utf-8")))
CT = {(r["scope"], r["period_key"], r["metric_code"]): r["value"] for r in rows}
SCOPES = ["ALL", "NL", "BE", "ONLINE"]
LEGACY = ("PTD-", "YTD-")
KEYS = sorted({r["period_key"] for r in rows if not r["period_key"].startswith(LEGACY)})
ITEM_ROWS = sum(1 for r in rows if not r["period_key"].startswith(LEGACY))
METRICS = sorted({r["metric_code"] for r in rows})
ASOF = 95
PERIOD_WEEKS = [4, 5, 4] * 4


def idx(fy, w):
    return (fy - 2025) * 52 + w


def period_range(p):
    s = 1 + sum(PERIOD_WEEKS[:p - 1])
    return s, s + PERIOD_WEEKS[p - 1] - 1


def window(pk):
    """Control key -> (first, last) sort_index (E-99): whole item within actuals, @k = its first k weeks."""
    k = None
    if "@" in pk:
        pk, k = pk.split("@")
        k = int(k)
    parts = pk.split("-")
    kind, fy = parts[0], int(parts[1][2:])
    if kind == "W":
        a = e = idx(fy, int(parts[2]))
    elif kind == "P":
        s, t = period_range(int(parts[2]))
        a, e = idx(fy, s), idx(fy, t)
    elif kind == "Q":
        q = int(parts[2])
        a, e = idx(fy, period_range(3 * q - 2)[0]), idx(fy, period_range(3 * q)[1])
    else:
        a, e = idx(fy, 1), idx(fy, 52)
    e = min(e, ASOF)
    if k is not None:
        e = a + k - 1
    return a, e


def tol(k):
    if k.startswith("status.") or k in ("lfl_store_count", "po_lines_due", "po_lines_otif", "mix_max_dev_channel", "otif_suppliers_below_85"):
        return 0
    if "pct" in k or k.endswith(("_pp", "_target", "_target_wks")) or k in ("gmroi", "weeks_of_cover") or k.startswith("gmroi."):
        return 1e-6
    return 0.06 if k.endswith(("_units", "_sku_days")) else 0.0051


M = {
    "gross_sales": "[Gross Sales]", "markdown": "[Markdown]", "returns": "[Returns]", "net_sales": "[Net Sales]", "cogs": "[COGS]",
    "back_margin": "[Back Margin]", "front_margin": "[Front Margin]", "total_margin": "[Total Margin]", "front_gm_pct": "[Front GM %]",
    "back_margin_pct": "[Back Margin %]", "total_margin_pct": "[Total Margin %]", "markdown_pct": "[Markdown %]",
    "opex_shrink": "[Opex Shrink]", "opex_store": "[Opex Store]", "opex_central": "[Opex Central]", "opex_fulfilment": "[Opex Fulfilment]",
    "ebitda": "[EBITDA]", "ebitda_margin_pct": "[EBITDA Margin %]", "po_lines_due": "[PO Lines Due]", "po_lines_otif": "[PO Lines OTIF]",
    "otif_pct": "[OTIF %]", "otif_target": "[OTIF Target]", "lfl_net_sales": "[LFL Net Sales]", "lfl_net_sales_ly": "[LFL Net Sales LY]",
    "lfl_store_count": "[LFL Store Count]", "store_net_sales": "[Store Net Sales]", "store_net_sales_ly": "[Store Net Sales LY]",
    "lfl_growth_pct": "[LFL Growth %]", "nonlfl_effect_pp": "[Non-LFL Effect pp]", "on_hand_cost": "[On Hand Cost]",
    "on_order_cost": "[On Order Cost]", "forecast_cogs": "[Forecast COGS]", "stock_incl_on_order": "[Stock incl On Order]",
    "weeks_of_cover": "[Weeks of Cover]", "cover_target_wks": "[Cover Target Wks]", "ranged_sku_days": "[Ranged SKU Days]",
    "in_stock_sku_days": "[In Stock SKU Days]", "availability_pct": "[Availability %]", "availability_target": "[Availability Target]",
    "season_opening_units": "[Season Opening Units]", "season_receipt_units": "[Season Receipt Units]", "season_units_sold": "[Season Units Sold]",
    "sell_through_pct": "[Sell-through %]", "sell_through_target": "[Sell-through Target]",
    "gmroi_front_margin_r52w": "[GMROI Front Margin R52W]", "gmroi_avg_on_hand_cost": "[GMROI Avg On Hand Cost]", "gmroi": "[GMROI]",
    "gmroi_target": "[GMROI Target]", "net_sales_bud": "[Net Sales Bud]", "gross_sales_bud": "[Gross Sales Bud]", "markdown_bud": "[Markdown Bud]",
    "cogs_bud": "[COGS Bud]", "back_margin_bud": "[Back Margin Bud]", "markdown_pct_bud": "[Markdown % Bud]", "front_gm_pct_bud": "[Front GM % Bud]",
    "total_margin_pct_bud": "[Total Margin % Bud]", "opex_shrink_bud": "[Opex Shrink Bud]", "opex_store_bud": "[Opex Store Bud]",
    "opex_central_bud": "[Opex Central Bud]", "opex_fulfilment_bud": "[Opex Fulfilment Bud]", "ebitda_bud": "[EBITDA Bud]",
    "ebitda_margin_pct_bud": "[EBITDA Margin % Bud]", "lfl_net_sales_bud": "[LFL Net Sales Bud]", "lfl_growth_pct_bud": "[LFL Growth % Bud]",
    "mix_max_dev_pp": "[Mix Max Dev pp]", "mix_max_dev_channel": "[Mix Max Dev Channel]", "ebitda_ptd": "[EBITDA PTD]",
    "ebitda_bud_ptd": "[EBITDA Bud PTD]", "otif_suppliers_below_85": "[OTIF Suppliers Below 85]",
    "status.count_on": "[Status Count On]", "status.count_watch": "[Status Count Watch]", "status.count_off": "[Status Count Off]",
    "status.count_na": "[Status Count NA]", "status.dot": "[Status Dot]",
}
for ch in ["store", "online", "wholesale"]:
    lab = ch.capitalize()
    M[f"mix_{ch}_net_sales"] = f"[Mix {lab} Net Sales]"
    M[f"mix_{ch}_pct"] = f"[Mix {lab} %]"
    M[f"mix_{ch}_pct_bud"] = f"[Mix {lab} % Bud]"
for k in KPIS:
    M[f"status.{k.lower()}"] = f"[Status {k}]"
for m in METRICS:
    if m.startswith("gmroi.") or m.startswith("sell_through_pct."):
        base, c = m.split(".")
        M[m] = f'CALCULATE ( [{"GMROI" if base == "gmroi" else "Sell-through %"}], dim_category[category_code] = "{c}" )'
missing = [m for m in METRICS if m not in M]
assert not missing, missing
# absent in the CSV = N/A: these must then be BLANK in the model (E-21, E-95)
ABSENT = ["lfl_growth_pct", "lfl_store_count", "availability_pct", "ranged_sku_days", "sell_through_pct", "gmroi", "weeks_of_cover",
          "net_sales_bud", "ebitda_bud", "status.dot"] + [f"status.{k.lower()}" for k in KPIS]


def num(v):
    return "BLANK ()" if v is None else repr(float(v))


def row(block, pk, metric, expr, exp, t):
    return f'ROW ( "block", "{block}", "key", "{pk}", "metric", "{metric}", "actual", {expr}, "expected", {num(exp)}, "tol", {t} )'


def evaluate(name, parts, note):
    body = "\n        ,".join(parts)
    u = f"UNION (\n        {body}\n    )" if len(parts) > 1 else body
    return f"""// ==== BLOCK {name}: {note}
EVALUATE
VAR _t =
    {u}
RETURN
    SELECTCOLUMNS (
        _t
        ,"block", [block]
        ,"key", [key]
        ,"metric", [metric]
        ,"actual", [actual]
        ,"expected", [expected]
        ,"_pass", IF ( ISBLANK ( [expected] ), ISBLANK ( [actual] ), NOT ISBLANK ( [actual] ) && ABS ( [actual] - [expected] ) <= [tol] )
    )
"""


def calc(filters, inner):
    f = "\n            ,".join(filters)
    if "\n                ," not in inner:
        return f"CALCULATETABLE (\n            {inner}\n            ,{f}\n        )"
    return f"CALCULATETABLE (\n            UNION (\n                {inner}\n            )\n            ,{f}\n        )"


def scope_f(s):
    return f'TREATAS ( {{ "{s}" }}, param_region[scope_code] )'


CAT_NAME = {"FRESH": "Fresh food", "AMBIENT": "Ambient grocery", "HB": "Health & beauty", "HOUSEHOLD": "Household & cleaning",
            "ELEC": "Electronics", "APPAREL": "Apparel", "HOME": "Home & kitchen", "GARDEN": "Garden & DIY", "TOYS": "Toys & leisure"}


def cat_f(codes):
    """The Category slicer (dim_category[category_name], E-100)."""
    return "TREATAS ( { " + ", ".join(f'"{CAT_NAME[c]}"' for c in codes) + " }, dim_category[category_name] )"


blocks = []
GROUPS = [("W26", [k for k in KEYS if k.startswith("W-FY2026")]), ("W25", [k for k in KEYS if k.startswith("W-FY2025")]),
          ("P26", [k for k in KEYS if k.startswith("P-FY2026")]), ("P25", [k for k in KEYS if k.startswith("P-FY2025")]),
          ("QY", [k for k in KEYS if k.startswith(("Q-", "FY-"))])]
assert sum(len(g) for _n, g in GROUPS) == len(KEYS) == 87, len(KEYS)
T1_ROWS = 0
# ---- T-N1 base layer: every item-key control total + N/A rows (ET-01, ET-24, ET-29, ET-31 values)
for s in SCOPES:
    for g, keys in GROUPS:
        parts = []
        for pk in keys:
            a, e = window(pk)
            rs = []
            for m in METRICS:
                v = CT.get((s, pk, m))
                if v is not None:
                    rs.append(row(f"T-N1 {s} {g}", pk, m, M[m], v, tol(m)))
                elif m in ABSENT:
                    rs.append(row(f"T-N1 {s} {g}", pk, m, M[m], None, -1))
            if rs:
                T1_ROWS += len(rs)
                inner = "\n                ,".join(rs)
                parts.append(calc([f"dim_week[sort_index] >= {a}", f"dim_week[sort_index] <= {e}", scope_f(s)], inner))
        blocks.append(evaluate(f"T-N1-{s}-{g}", parts, f"base layer, scope {s}, keys {keys[0]} .. {keys[-1]} (ET-01)"))

# ---- T-N2 card layer through the picker: type x item x comparator x scope
VALUE_M = {"NET_SALES": "net_sales", "TOTAL_MARGIN": "total_margin_pct", "WEEKS_OF_COVER": "weeks_of_cover", "MARKDOWN": "markdown_pct",
           "AVAILABILITY": "availability_pct", "EBITDA": "ebitda", "LFL_GROWTH": "lfl_growth_pct", "FRONT_GM": "front_gm_pct",
           "SELL_THROUGH": "sell_through_pct", "GMROI": "gmroi", "SUPPLIER_OTIF": "otif_pct", "CHANNEL_MIX": "mix_store_pct"}
BASIS_M = {"NET_SALES": "net_sales_bud", "TOTAL_MARGIN": "total_margin_pct_bud", "WEEKS_OF_COVER": "cover_target_wks",
           "MARKDOWN": "markdown_pct_bud", "AVAILABILITY": "availability_target", "EBITDA": "ebitda_bud",
           "LFL_GROWTH": "lfl_growth_pct_bud", "FRONT_GM": "front_gm_pct_bud", "SELL_THROUGH": "sell_through_target",
           "GMROI": "gmroi_target", "SUPPLIER_OTIF": "otif_target", "CHANNEL_MIX": "mix_store_pct_bud"}
CH = ["store", "online", "wholesale"]
# (type, FY, chip, item key, LY key, previous key, EBITDA previous key at Week)
ITEMS = [
    ("W", "FY2026", "W43", "W-FY2026-43", "W-FY2025-43", "W-FY2026-42", "P-FY2026-09@4"),
    ("P", "FY2026", "P10", "P-FY2026-10", "P-FY2025-10", "P-FY2026-09", None),
    ("Q", "FY2026", "Q4 · to date", "Q-FY2026-4", "Q-FY2025-4@4", "Q-FY2026-3@4", None),
    ("FY", "FY2026", "FY2026 · to date", "FY-FY2026", "FY-FY2025@43", "FY-FY2025@43", None),  # Previous reads LY at Year (E-94)
    ("P", "FY2025", "P10", "P-FY2025-10", None, "P-FY2025-09", None),
    ("P", "FY2025", "P12", "P-FY2025-12", None, "P-FY2025-11", None),
    ("Q", "FY2025", "Q1", "Q-FY2025-1", None, None, None),
    ("FY", "FY2025", "FY2025", "FY-FY2025", None, None, None),
]


def ctv(s, pk, m):
    v = CT.get((s, pk, m)) if pk else None
    return None if v is None else float(v)


def vkey(k, gran):
    return "ebitda_ptd" if k == "EBITDA" and gran == "W" else VALUE_M[k]


def bkey(k, gran):
    return "ebitda_bud_ptd" if k == "EBITDA" and gran == "W" else BASIS_M[k]


def pick(gran, fy, chip):
    col = "label_wide" if gran in ("Q", "FY") else "label"
    return [f'TREATAS ( {{ "{gran}" }}, param_granularity[granularity_code] )', f'TREATAS ( {{ "{fy}" }}, dim_item[fy_label] )',
            f'TREATAS ( {{ "{chip}" }}, dim_item[{col}] )']


def mix_dev(s, key, cmp, ckey):
    cur = [ctv(s, key, f"mix_{c}_pct") for c in CH]
    base = [ctv(s, key, f"mix_{c}_pct_bud") for c in CH] if cmp == "BUD" else [ctv(s, ckey, f"mix_{c}_pct") for c in CH]
    if None in base or None in cur:
        return None, None
    d = [a - b for a, b in zip(cur, base)]
    j = 0
    for i in range(3):
        if abs(d[i]) > abs(d[j]):
            j = i
    return j + 1, d[j]


T2_ROWS = 0
for s in SCOPES:
    parts = []
    for gran, fy, chip, key, lyk, pvk, ebp in ITEMS:
        for cmp in ["BUD", "LY", "LW"]:
            b = f"T-N2 {s} {gran} {fy} {chip} {cmp}"
            rs = []
            ckey = lyk if cmp == "LY" else pvk
            for k in KPIS:
                v = ctv(s, key, vkey(k, gran))
                if cmp == "BUD":
                    c = ctv(s, key, bkey(k, gran))
                elif k == "EBITDA" and gran == "W" and cmp == "LW":
                    c = ctv(s, ebp, "ebitda")
                elif k == "EBITDA" and gran == "W":
                    c = ctv(s, ckey, "ebitda_ptd")
                else:
                    c = ctv(s, ckey, VALUE_M[k])
                st = ctv(s, key, f"status.{k.lower()}")
                tv = tol(VALUE_M[k])
                rs.append(row(b, key, f"card.value.{k}", f"[Card Value {k}]", v, tv))
                rs.append(row(b, key, f"card.compare.{k}", f"[Card Compare {k}]", c, tol(BASIS_M[k] if cmp == "BUD" else VALUE_M[k])))
                rs.append(row(b, key, f"card.delta.{k}", f"[Card Delta {k}]", None if v is None or c is None else v - c, max(tv * 2, 1e-6)))
                rs.append(row(b, key, f"card.status.{k}", f"[Card Status {k}]", st, 0))
            j, d = mix_dev(s, key, cmp, ckey)
            rs.append(row(b, key, "card.mix_dev_channel", "[Card Mix Dev Channel No]", j, 0))
            rs.append(row(b, key, "card.mix_dev_pp", "[Card Mix Dev pp]", d, 2e-6))
            pk = ctv(s, key, "status.count_on") * 1000 + ctv(s, key, "status.count_watch") * 100 + ctv(s, key, "status.count_off") * 10 + (ctv(s, key, "status.dot") or 0)
            rs.append(row(b, key, "status.pack", "[Window Status Pack]", pk, 0))
            T2_ROWS += len(rs)
            parts.append(calc([scope_f(s), f'TREATAS ( {{ "{cmp}" }}, param_comparator[comparator_code] )'] + pick(gran, fy, chip),
                              "\n                ,".join(rs)))
    # EBITDA vs Previous at Week edges (ET-31): W39 -> P8 weeks 1-4, W31 -> P7 week 1, W35 (week 5 of P8) -> N/A
    rs = []
    for w, ebp in [(39, "P-FY2026-08@4"), (31, "P-FY2026-07@1"), (35, None)]:
        key = f"W-FY2026-{w}"
        v, c = ctv(s, key, "ebitda_ptd"), ctv(s, ebp, "ebitda")
        inner = "\n                ,".join([row(f"T-N2 {s} W{w} LW", key, "card.value.EBITDA", "[Card Value EBITDA]", v, 0.0051),
                                            row(f"T-N2 {s} W{w} LW", key, "card.compare.EBITDA", "[Card Compare EBITDA]", c, 0.0051),
                                            row(f"T-N2 {s} W{w} LW", key, "card.delta.EBITDA", "[Card Delta EBITDA]", None if c is None else v - c, 0.0102)])
        T2_ROWS += 3
        rs.append(calc([scope_f(s), 'TREATAS ( { "LW" }, param_comparator[comparator_code] )'] + pick("W", "FY2026", f"W{w}"), inner))
    # one EVALUATE per item x comparator: a UNION of all 27 scenarios grows the plan past 13 GB
    names = [f"{g} {fy} {chip} {c}" for g, fy, chip, *_r in ITEMS for c in ["BUD", "LY", "LW"]] + ["EBITDA Previous at W39 / W31 / W35"]
    for i, prt in enumerate(parts[:len(names) - 1] + [None], 1):
        if prt is None:
            blocks.append(evaluate(f"T-N2-{s}-{i:02d}", rs, f"card layer, scope {s}: EBITDA Previous at W39 / W31 / W35 (ET-31)"))
        else:
            blocks.append(evaluate(f"T-N2-{s}-{i:02d}", [prt], f"card layer, scope {s}: {names[i - 1]} (ET-22 .. ET-26)"))


# ---- string blocks
def srow(block, metric, expr, exp):
    e = exp.replace('"', '""')
    return f'ROW ( "block", "{block}", "metric", "{metric}", "actual", {expr}, "expected", "{e}" )'


def sevaluate(name, parts, note):
    body = "\n        ,".join(parts)
    u = f"UNION (\n        {body}\n    )" if len(parts) > 1 else body
    return f"""// ==== BLOCK {name}: {note}
EVALUATE
VAR _t =
    {u}
RETURN
    SELECTCOLUMNS ( _t, "block", [block], "metric", [metric], "actual", [actual], "expected", [expected], "_pass", [actual] == [expected] )
"""


S_ROWS = 0


def sblock(filters, rs):
    global S_ROWS
    S_ROWS += len(rs)
    return calc(filters, "\n                ,".join(rs))


V5 = {  # prototype v5 card face, Week 43 / All / Budget (ET-02, ET-22)
    "NET_SALES": ("€61.4", "m", "−€1.5m (−2.4%) vs budget", "Watch"),
    "TOTAL_MARGIN": ("36.3", "%", "+0.1 pp vs budget 36.2%", "On track"),
    "WEEKS_OF_COVER": ("11.4", "wks", "+1.9 wks vs target 9.5", "Watch"),
    "MARKDOWN": ("9.8", "%", "+1.3 pp vs budget 8.5%", "Off track"),
    "AVAILABILITY": ("94.1", "%", "−2.9 pp vs target 97%", "Off track"),
    "EBITDA": ("€15.3", "m", "−€0.8m (−5.0%) vs budget", "Watch"),
    "LFL_GROWTH": ("+3.4", "%", "+0.4 pp vs budget LFL 3.0%", "On track"),
    "FRONT_GM": ("30.1", "%", "+0.1 pp vs budget 30.0%", "On track"),
    "SELL_THROUGH": ("63.1", "%", "+1.1 pp vs target 62%", "On track"),
    "GMROI": ("2.7", "×", "+0.2× vs target 2.5×", "On track"),
    "SUPPLIER_OTIF": ("95.4", "%", "+0.4 pp vs target 95%", "On track"),
    "CHANNEL_MIX": ("68.4", "% store", "online +1.9 pp vs plan", "On track"),
}
ALL = scope_f("ALL")
BUD = 'TREATAS ( { "BUD" }, param_comparator[comparator_code] )'
LW = 'TREATAS ( { "LW" }, param_comparator[comparator_code] )'
LYC = 'TREATAS ( { "LY" }, param_comparator[comparator_code] )'
parts = []
# default = no picker state at all (Reset): Week 43 FY2026, the v5 story (ET-02, ET-22, ET-28)
rs = []
for k, (v, u, d, w) in V5.items():
    rs += [srow("T-N3 reset", f"value.{k}", f"[Card Value Text {k}]", v), srow("T-N3 reset", f"unit.{k}", f"[Card Unit Text {k}]", u),
           srow("T-N3 reset", f"delta.{k}", f"[Card Delta Text {k}]", d), srow("T-N3 reset", f"word.{k}", f"[Card Status Word {k}]", w)]
rs += [srow("T-N3 reset", "item", "[_Item Key]", "FY2026-W43"),
       srow("T-N3 reset", "counts", '[Window Status Count On] & "/" & [Window Status Count Watch] & "/" & [Window Status Count Off]', "7/3/2"),
       srow("T-N3 reset", "dot", 'SWITCH ( [Window Status Dot], 1, "green", 2, "orange", 3, "red" )', "orange"),
       srow("T-N3 reset", "header.period", "[Header Period Text]", "**Week 43** · 19–25 Oct 2026"),
       srow("T-N3 reset", "header.comparator", "[Header Comparator Text]", "vs **Budget**"),
       srow("T-N3 reset", "phrase", "[Period Phrase]", "week 43"),
       srow("T-N3 reset", "title", "[Item Title]", "Week 43"),
       srow("T-N3 reset", "ebitda.sub", 'IF ( CONTAINSSTRING ( [Card SVG EBITDA], "EBITDA flash<tspan font-weight=\'400\' fill=\'%235F6878\'> · month 10 to date · prov.</tspan>" ), "ok", "missing" )', "ok"),
       srow("T-N3 reset", "net_sales.sub", 'IF ( CONTAINSSTRING ( [Card SVG NET_SALES], "> · week 43, all channels</tspan>" ), "ok", "missing" )', "ok"),
       srow("T-N3 reset", "showing", 'IF ( CONTAINSSTRING ( [Menu Showing SVG], ">Showing <tspan font-weight=\'600\' fill=\'%23111827\'>Week 43</tspan> · 19–25 Oct 2026<" ), "ok", "missing" )', "ok"),
       srow("T-N3 reset", "refreshed", "[Refreshed Text]", "Refreshed Mon 26 Oct 05:12")]
parts.append(sblock([ALL], rs))
# the saved state of the picker reads the same (W / FY2026 / W43)
parts.append(sblock([ALL, BUD] + pick("W", "FY2026", "W43"),
                    [srow("T-N3 saved", "item", "[_Item Key]", "FY2026-W43"),
                     srow("T-N3 saved", "counts", '[Window Status Count On] & "/" & [Window Status Count Watch] & "/" & [Window Status Count Off]', "7/3/2")]))
# headers, titles, phrases per item (E-92, E-98)
HDR = [("W", "FY2025", "W43", "**Week 43 FY2025** · 20–26 Oct 2025", "Week 43 FY2025", "week 43 FY2025"),
       ("P", "FY2026", "P10", "**Month 10** · 28 Sep–25 Oct 2026", "Month 10", "month 10"),
       ("P", "FY2025", "P10", "**Month 10 FY2025** · 29 Sep–26 Oct 2025", "Month 10 FY2025", "month 10 FY2025"),
       ("Q", "FY2026", "Q4 · to date", "**Quarter 4** to date · 28 Sep–25 Oct 2026", "Quarter 4", "quarter 4 to date"),
       ("Q", "FY2026", "Q3", "**Quarter 3** · 29 Jun–27 Sep 2026", "Quarter 3", "quarter 3"),
       ("FY", "FY2026", "FY2026 · to date", "**FY2026** to date · 29 Dec 2025–25 Oct 2026", "FY2026", "FY2026 to date"),
       ("FY", "FY2025", "FY2025", "**FY2025** · 30 Dec 2024–28 Dec 2025", "FY2025", "FY2025")]
for g, fy, chip, h, t, ph in HDR:
    n = f"T-N3 {g} {fy} {chip}"
    parts.append(sblock([ALL] + pick(g, fy, chip), [srow(n, "header.period", "[Header Period Text]", h), srow(n, "title", "[Item Title]", t),
                                                     srow(n, "phrase", "[Period Phrase]", ph)]))
# comparator line and short delta suffix per type (E-94, E-98); Previous at Year reads LY and its row is hidden (ET-23)
CMP = [("W", "FY2026", "W43", LW, "vs **Previous week**", "vs prev. wk", "vs prev. mth"),
       ("P", "FY2026", "P10", LW, "vs **Previous month**", "vs prev. mth", "vs prev. mth"),
       ("Q", "FY2026", "Q4 · to date", LW, "vs **Previous quarter**", "vs prev. qtr", "vs prev. qtr"),
       ("FY", "FY2026", "FY2026 · to date", LW, "vs **Last year** (same retail weeks)", "vs LY", "vs LY"),
       ("W", "FY2026", "W43", LYC, "vs **Last year** (same retail week)", "vs LY", "vs LY"),
       ("P", "FY2026", "P10", LYC, "vs **Last year** (same retail weeks)", "vs LY", "vs LY")]
for g, fy, chip, c, hdr, suf, ebsuf in CMP:
    n = f"T-N3 {g} {chip} {c.split(chr(34))[1]}"
    parts.append(sblock([ALL, c] + pick(g, fy, chip),
                        [srow(n, "header.comparator", "[Header Comparator Text]", hdr),
                         srow(n, "suffix.NET_SALES", f'IF ( RIGHT ( [Card Delta Text NET_SALES], {len(suf)} ) = "{suf}", "{suf}", [Card Delta Text NET_SALES] )', suf),
                         srow(n, "suffix.WEEKS_OF_COVER", f'IF ( CONTAINSSTRING ( [Card Delta Text WEEKS_OF_COVER], " {suf} " ), "{suf}", [Card Delta Text WEEKS_OF_COVER] )', suf),
                         srow(n, "suffix.EBITDA", f'IF ( RIGHT ( [Card Delta Text EBITDA], {len(ebsuf)} ) = "{ebsuf}", "{ebsuf}", [Card Delta Text EBITDA] )', ebsuf),
                         srow(n, "suffix.CHANNEL_MIX", f'IF ( RIGHT ( [Card Delta Text CHANNEL_MIX], {len(suf)} ) = "{suf}", "{suf}", [Card Delta Text CHANNEL_MIX] )', suf)]))
parts.append(sblock([ALL] + pick("FY", "FY2026", "FY2026 · to date"),
                    [srow("T-N3 FY rows", "comparator rows offered", 'CONCATENATEX ( FILTER ( VALUES ( param_comparator[comparator_name] ), [_Comparator Row Visible] = 1 ), param_comparator[comparator_name], ", ", param_comparator[comparator_name], ASC )', "Budget, Last year"),
                     srow("T-N3 FY rows", "code LW -> LY", 'CALCULATE ( [_Comparator Code], TREATAS ( { "LW" }, param_comparator[comparator_code] ) )', "LY")]))
parts.append(sblock([ALL] + pick("P", "FY2026", "P10"),
                    [srow("T-N3 P rows", "comparator rows offered", 'CONCATENATEX ( FILTER ( VALUES ( param_comparator[comparator_name] ), [_Comparator Row Visible] = 1 ), param_comparator[comparator_name], ", ", param_comparator[comparator_name], ASC )', "Budget, Last year, Previous")]))
# EBITDA vs Previous at Week: the i delta names the weeks; W35 is N/A (ET-31)
d43 = ctv("ALL", "W-FY2026-43", "ebitda_ptd") - ctv("ALL", "P-FY2026-09@4", "ebitda")
r43 = ctv("ALL", "W-FY2026-43", "ebitda_ptd") / ctv("ALL", "P-FY2026-09@4", "ebitda") - 1
txt43 = f"{'+' if d43 >= 0 else '−'}€{abs(d43) / 1e6:,.1f}m ({'+' if r43 >= 0 else '−'}{abs(r43) * 100:,.1f}%)"
parts.append(sblock([ALL, LW] + pick("W", "FY2026", "W43"),
                    [srow("T-N3 W43 prev", "ebitda.delta", "[Card Delta Text EBITDA]", f"{txt43} vs prev. mth"),
                     srow("T-N3 W43 prev", "ebitda.delta.long", "[Card Delta Long Text EBITDA]", f"{txt43} vs P9 weeks 1–4"),
                     srow("T-N3 W43 prev", "net_sales.delta suffix", 'RIGHT ( [Card Delta Text NET_SALES], 11 )', "vs prev. wk")]))
parts.append(sblock([ALL, LW] + pick("W", "FY2026", "W35"),
                    [srow("T-N3 W35 prev", "ebitda.delta", "[Card Delta Text EBITDA]", "n/a vs prev. mth"),
                     srow("T-N3 W35 prev", "ebitda.delta.long", "[Card Delta Long Text EBITDA]", "n/a vs prev. mth"),
                     srow("T-N3 W35 prev", "ebitda.muted", 'IF ( CONTAINSSTRING ( [Card SVG EBITDA], "fill=\'%235F6878\'>n/a vs prev. mth</text>" ), "muted", "not muted" )', "muted")]))
parts.append(sblock([ALL, LW] + pick("W", "FY2026", "W31"),
                    [srow("T-N3 W31 prev", "ebitda.delta.long ends", 'RIGHT ( [Card Delta Long Text EBITDA], 12 )', "vs P7 week 1")]))
parts.append(sblock([ALL, LW] + pick("W", "FY2026", "W2"),
                    [srow("T-N3 W2 prev", "ebitda.delta.long ends", 'RIGHT ( [Card Delta Long Text EBITDA], 23 )', "vs P12 FY2025 weeks 1–2")]))
# FY2025: budget cards N/A with muted n/a vs budget; target cards rated (ET-26)
fy25 = [srow("T-N3 FY2025 P10", f"word.{k}", f"[Card Status Word {k}]", "N/A") for k in ["NET_SALES", "TOTAL_MARGIN", "MARKDOWN", "EBITDA", "LFL_GROWTH", "FRONT_GM", "CHANNEL_MIX"]]
fy25 += [srow("T-N3 FY2025 P10", "delta.NET_SALES", "[Card Delta Text NET_SALES]", "n/a vs budget"),
         srow("T-N3 FY2025 P10", "delta.CHANNEL_MIX", "[Card Delta Text CHANNEL_MIX]", "n/a vs plan"),
         srow("T-N3 FY2025 P10", "net_sales.muted", 'IF ( CONTAINSSTRING ( [Card SVG NET_SALES], "fill=\'%235F6878\'>n/a vs budget</text>" ), "muted", "not muted" )', "muted"),
         srow("T-N3 FY2025 P10", "rated", 'FORMAT ( [Window Status Count On] + [Window Status Count Watch] + [Window Status Count Off], "0" )', "4"),
         srow("T-N3 FY2025 P10", "gmroi", "[Card Status Word GMROI]", "N/A")]
parts.append(sblock([ALL, BUD] + pick("P", "FY2025", "P10"), fy25))
parts.append(sblock([ALL, BUD] + pick("Q", "FY2025", "Q1"),
                    [srow("T-N3 FY2025 Q1", "rated", 'FORMAT ( [Window Status Count On] + [Window Status Count Watch] + [Window Status Count Off], "0" )', "3"),
                     srow("T-N3 FY2025 Q1", "sell-through example", 'IF ( CONTAINSSTRING ( [Info SVG SELL_THROUGH], "No season is open in the last week of the quarter." ), "ok", "missing" )', "ok")]))
# picker fallbacks (E-90, ET-28): a type change keeps the item holding the last pick; an unknown chip in the FY -> its last item
FB = [(["W", "FY2026", "W43"], "P", "FY2026-P10"), (["W", "FY2026", "W43"], "Q", "FY2026-Q4"), (["W", "FY2026", "W43"], "FY", "FY2026"),
      (["W", "FY2025", "W43"], "P", "FY2025-P10"), (["W", "FY2026", "W50"], "W", "FY2026-W43"), (["W", "FY2025", "W50"], "W", "FY2025-W50")]
fb = []
for (g0, fy, chip), g, exp in FB:
    fb.append(sblock([f'TREATAS ( {{ "{g}" }}, param_granularity[granularity_code] )', f'TREATAS ( {{ "{fy}" }}, dim_item[fy_label] )',
                      f'TREATAS ( {{ "{chip}" }}, dim_item[label] )'], [srow(f"T-N3 fallback {chip} {fy} -> {g}", "item", "[_Item Key]", exp)]))
parts += fb
# ONLINE N/A cards
on = [srow("T-N3 ONLINE", "word.AVAILABILITY", "[Card Status Word AVAILABILITY]", "N/A"),
      srow("T-N3 ONLINE", "value.AVAILABILITY", "[Card Value Text AVAILABILITY]", "n/a"),
      srow("T-N3 ONLINE", "delta.AVAILABILITY", "[Card Delta Text AVAILABILITY]", "n/a vs target"),
      srow("T-N3 ONLINE", "word.LFL_GROWTH", "[Card Status Word LFL_GROWTH]", "N/A"),
      srow("T-N3 ONLINE", "delta.LFL_GROWTH", "[Card Delta Text LFL_GROWTH]", "n/a vs budget LFL")]
parts.append(sblock(['TREATAS ( { "ONLINE" }, param_region[scope_code] )'], on))
for i, prt in enumerate(parts, 1):
    blocks.append(sevaluate(f"T-N3-{i:02d}", [prt], f"texts, scenario {i} of {len(parts)}: see the T-N3 note"))
TS_CAT = __import__("copy_v5").TS["CATEGORY_COPY"]
T3_NOTE = ("texts: v5 at Reset and the saved state (ET-02, ET-22); headers, titles, phrases per item; comparator lines and short suffixes; "
                                        "Year hides Previous (ET-23); EBITDA Previous at Week (ET-31); FY2025 N/A (ET-26); picker fallbacks (ET-28); Online N/A")

# ---- T-N4 bars per type (E-96, ET-25): N bars ending at the picked item = the item-key values
BAR_M = dict(VALUE_M, EBITDA="ebitda")
BARS = [("W", "FY2026", "W43", [f"W-FY2026-{w}" for w in range(31, 44)]),
        ("P", "FY2026", "P10", [f"P-FY2025-{p:02d}" for p in (11, 12)] + [f"P-FY2026-{p:02d}" for p in range(1, 11)]),
        ("Q", "FY2026", "Q4 · to date", [f"Q-FY2025-{q}" for q in range(1, 5)] + [f"Q-FY2026-{q}" for q in range(1, 5)]),
        ("FY", "FY2026", "FY2026 · to date", ["FY-FY2025", "FY-FY2026"])]
for s in SCOPES:
    parts = []
    for g, fy, chip, keys in BARS:
        rs = []
        for k in KPIS:
            if k == "CHANNEL_MIX":
                continue
            rs.append(row(f"T-N4 {s} {g}", g, f"bars.count.{k}", f"PATHLENGTH ( [Card Bar Points {k}] )", len(keys), 0))
            for i, pk in enumerate(keys):
                v = ctv(s, pk, BAR_M[k])
                expr = f'VAR _p = PATHITEM ( [Card Bar Points {k}], {i + 1} ) RETURN IF ( _p = "", BLANK (), VALUE ( _p ) )'
                rs.append(row(f"T-N4 {s} {g}", pk, f"bar.{k}", f"( {expr} )", v, 1e-6 if tol(BAR_M[k]) < 0.001 else 0.0051))
        T2_ROWS += len(rs)
        parts.append(calc([scope_f(s)] + pick(g, fy, chip), "\n                ,".join(rs)))
    for (g, _fy, _chip, keys), prt in zip(BARS, parts):
        blocks.append(evaluate(f"T-N4-{s}-{g}", [prt], f"bar points, scope {s}, type {g}: {len(keys)} bars ending at the item (E-96, ET-25)"))

# ---- T-N5 identities: ET-07 back margin = supplier income (ALL), ET-12 NL + BE + ONLINE + WHOLESALE = ALL; 0 measures in error
rs = []
for w in range(31, 44):
    i = idx(2026, w)
    pk = f"W-FY2026-{w}"
    rs.append(f"""CALCULATETABLE (
                ROW ( "block", "T-N5", "key", "{pk}", "metric", "ET-07 back margin - supplier income", "actual",
                      [Back Margin] - [Supplier Income], "expected", 0.0, "tol", 0.01 )
                ,dim_week[sort_index] = {i}
            )""")
    rs.append(f"""CALCULATETABLE (
                ROW ( "block", "T-N5", "key", "{pk}", "metric", "ET-12 NL + BE + ONLINE + WHOLESALE - ALL", "actual",
                      CALCULATE ( [Net Sales], TREATAS ( {{ "NL" }}, param_region[scope_code] ) )
                      + CALCULATE ( [Net Sales], TREATAS ( {{ "BE" }}, param_region[scope_code] ) )
                      + CALCULATE ( [Net Sales], TREATAS ( {{ "ONLINE" }}, param_region[scope_code] ) )
                      + CALCULATE ( [Net Sales], dim_store[channel_code] = "WHOLESALE" )
                      - [Net Sales] + 0, "expected", 0.0, "tol", 0.01 )
                ,dim_week[sort_index] = {i}
                ,TREATAS ( {{ "ALL" }}, param_region[scope_code] )
            )""")
rs.append('ROW ( "block", "T-N5", "key", "model", "metric", "measures in an error state", "actual", COUNTROWS ( FILTER ( INFO.MEASURES (), [State] <> 1 ) ) + 0, "expected", 0.0, "tol", 0 )')
T5_ROWS = len(rs)
blocks.append(evaluate("T-N5", rs, "identities: back margin = supplier income (ET-07), scopes add up to ALL (ET-12); no measure in an error state"))

# ---- T-N6 conceal in place (ET-13)
ce = [srow("T-N6 B3", "revealed", 'FORMAT ( [Revealed Count], "0" )', "4"),
      srow("T-N6 B3", "summary", "[Filter Picks Text]", "B3 stock & supply"),
      srow("T-N6 B3", "badge", 'FORMAT ( [Filter Pick Count], "0" )', "1"),
      srow("T-N6 B3", "counts", '[Window Status Count On] & "/" & [Window Status Count Watch] & "/" & [Window Status Count Off] & "/" & [Window Status Dot]', "7/3/2/2"),
      srow("T-N6 B3", "net sales concealed", 'IF ( [Card Revealed NET_SALES], "shown", "concealed" )', "concealed"),
      srow("T-N6 B3", "availability shown", 'IF ( [Card Revealed AVAILABILITY], "shown", "concealed" )', "shown")]
parts = [sblock(['TREATAS ( { "B3" }, param_attr_group[attr_code] )'], ce)]
two = [srow("T-N6 B1|B4 & sales", "revealed", 'FORMAT ( [Revealed Count], "0" )', "3"),
       srow("T-N6 B1|B4 & sales", "summary", "[Filter Picks Text]", "B1 base-crucial, B4 channel & customer, Sales")]
parts.append(sblock(['TREATAS ( { "B1", "B4" }, param_attr_group[attr_code] )', 'TREATAS ( { "sales" }, param_attr_lever[attr_code] )'], two))
parts.append(sblock(['TREATAS ( { "finance" }, param_attr_owner[attr_code] )'],
                    [srow("T-N6 finance", "summary", "[Filter Picks Text]", "Finance"), srow("T-N6 finance", "revealed", 'FORMAT ( [Revealed Count], "0" )', "4")]))
parts.append(sblock([ALL], [srow("T-N6 none", "summary", "[Filter Picks Text]", "All")]))
blocks.append(sevaluate("T-N6", parts, "conceal in place: B3 shows 4 of 12, counts and dot unchanged; OR within, AND across; three attribute groups (ET-13, E-53)"))

# ---- T-N7 i pop-up (E-57, ET-30, ET-32; stacked block, USER 2026-10-30): Actual label -> value -> swatch + basis label -> target
#      value -> delta, whatever the comparator; no basis = label + muted dash; no footer target, no owner note, tags Group · Lever · Owner
import measures_svg as MS  # noqa: E402

TGT = {"NET_SALES": ("Budget", "€62.9"), "TOTAL_MARGIN": ("Budget", "36.2"), "WEEKS_OF_COVER": ("Target", "9.5"), "MARKDOWN": ("Budget", "8.5"),
       "AVAILABILITY": ("Target", "97.0"), "EBITDA": ("Budget", "€16.1"), "LFL_GROWTH": ("Budget", "+3.0"), "FRONT_GM": ("Budget", "30.0"),
       "SELL_THROUGH": ("Target", "62.0"), "GMROI": ("Target", "2.5"), "SUPPLIER_OTIF": ("Target", "95.0"), "CHANNEL_MIX": ("Plan", "70.0")}
IB, INK, MUTED, TINK, TGTC = MS.IB, "#111827", "#5F6878", MS.TGT_INK, "#9CA3AF"


def enc(t):
    """As the SVG data URL: % and # escaped."""
    return t.replace("%", "%25").replace("#", "%23").replace('"', '""')


def actual_txt(val):
    return enc(f"<text x='24' y='{IB['lab_a']}' font-size='16' font-weight='600' fill='{TINK}'>Actual</text>"
               f"<text x='24' y='{IB['val_a']}' font-size='48' font-weight='700' fill='{INK}' letter-spacing='-1.4'>{val}<tspan")


def basis_txt(lab, val, unit):
    head = (f"<line x1='24' y1='{IB['sw']}' x2='44' y2='{IB['sw']}' stroke='{TGTC}' stroke-width='2' stroke-dasharray='2 2'/>"
            f"<text x='52' y='{IB['lab_b']}' font-size='16' font-weight='600' fill='{TINK}'>{lab}</text>")
    if val is None:
        return enc(head + f"<text x='24' y='{IB['val_b']}' font-size='40' font-weight='700' fill='{MUTED}'>–</text>")
    return enc(head + f"<text x='24' y='{IB['val_b']}' font-size='40' font-weight='700' fill='{INK}' letter-spacing='-1'>{val}"
                      f"<tspan dx='4' font-size='16' font-weight='600' fill='{TINK}' letter-spacing='0'>{unit}</tspan></text>"
                      f"<text x='24' y='{IB['delta']}' font-size='13.5' font-weight='600' fill='")


def order_chk(k, val, lab, tval, delta=None):
    """'ok' when Actual + value, then basis label + target value (+ the delta line) appear in this order."""
    unit = MS.UNIT_TXT[MS.UNIT[k]]
    a = f'SEARCH ( "{actual_txt(val)}", _v, 1, 0 )'
    b = f'SEARCH ( "{basis_txt(lab, tval, unit)}", _v, 1, 0 )'
    d = f'SEARCH ( "{enc(">" + delta + "</text>")}", _v, 1, 0 )' if delta else "_pb + 1"
    extra = (f'&& CONTAINSSTRING ( _v, ">Owner <tspan" ) && NOT CONTAINSSTRING ( _v, "Horizon" ) && NOT CONTAINSSTRING ( _v, "Statement" ) '
             f'&& NOT CONTAINSSTRING ( _v, "OWNER NOTE" ) && NOT CONTAINSSTRING ( _v, "Target budget" ) '
             f'&& CONTAINSSTRING ( _v, "height=\'{MS.INFO_H}\' viewBox=\'0 0 {MS.IW} {MS.INFO_H}\'" )')
    return (f'( VAR _v = [Info SVG {k}] VAR _pa = {a} VAR _pb = {b} VAR _pd = {d} '
            f'RETURN IF ( _pa > 0 && _pb > _pa && _pd > _pb {extra}, "ok", "missing" ) )')


parts = []
for c in ["BUD", "LY", "LW"]:
    rs = []
    for k, (lab, val) in TGT.items():
        rs.append(srow(f"T-N7 {c}", f"target.{k}", f"[Card Basis Text {k}]", val))
        delta = V5[k][2] if c == "BUD" else None
        rs.append(srow(f"T-N7 {c}", f"svg.{k}", order_chk(k, V5[k][0], lab, val, delta), "ok"))
    parts.append(sblock([ALL, f'TREATAS ( {{ "{c}" }}, param_comparator[comparator_code] )'], rs))
# no basis: FY2025 has no budget and GMROI no 52-week history; the other target cards keep their target
rs = []
for k, (lab, val) in TGT.items():
    nob = k in ("NET_SALES", "TOTAL_MARGIN", "MARKDOWN", "EBITDA", "LFL_GROWTH", "FRONT_GM", "CHANNEL_MIX", "GMROI")  # GMROI: no 52-week history
    unit = MS.UNIT_TXT[MS.UNIT[k]]
    chk = (f'IF ( CONTAINSSTRING ( [Info SVG {k}], "{basis_txt(lab, None, unit)}" ), "dash", "no dash" )' if nob else
           f'IF ( CONTAINSSTRING ( [Info SVG {k}], "{enc(">" + lab + "</text>")}" ) && NOT CONTAINSSTRING ( [Info SVG {k}], "{enc("fill=" + chr(39) + MUTED + chr(39) + ">–</text>")}" ), "value", "dash" )')
    rs.append(srow("T-N7 FY2025 P10", f"no-basis.{k}", chk, "dash" if nob else "value"))
parts.append(sblock([ALL, BUD] + pick("P", "FY2025", "P10"), rs))
for i, prt in enumerate(parts, 1):
    blocks.append(sevaluate(f"T-N7-{i}", [prt], "i pop-up, " + ["Budget", "Last year", "Previous", "FY2025 P10 (no budget)"][i - 1] + ": see the T-N7 note"))
T7_NOTE = ("i pop-up stacked block (USER 2026-10-30): Actual label, value, swatch + basis label, target value, delta, in this order, whatever the "
           "comparator; no basis = label + muted dash; no footer target, owner note, Horizon or Statement (E-57, ET-30, ET-32)")

# ---- T-N9 frame parity (perf pass 2026-10-30): the card faces and i pop-ups, built in one frame, show the same texts as the card-layer
#      measures (value, delta, chip / glyph, basis, status word) in 7 picker states
ENC = 'SUBSTITUTE ( SUBSTITUTE ( {x}, "%", "%25" ), "#", "%23" )'


def e(x):
    return ENC.format(x=x)


def card_chk(k):
    glyph = f'SWITCH ( [Card Status {k}], 1, "▲", 2, "●", 3, "▼", "–" )'
    word = f"[Card Status Word {k}]"
    chip = f'">" & {glyph} & IF ( {chr(34)}{MS.SIZE.get(k, "small")}{chr(34)} = "small", "", " " & {word} ) & "</text>"'
    parts_ = [f'IF ( CONTAINSSTRING ( _v, ">" & {e(f"[Card Value Text {k}]")} & "<tspan" ), "", " value" )',
              f'IF ( CONTAINSSTRING ( _v, {chip} ), "", " chip" )']
    if MS.SIZE.get(k, "small") != "small":
        parts_.append(f'IF ( CONTAINSSTRING ( _v, ">" & {e(f"[Card Delta Text {k}]")} & "</text>" ), "", " delta" )')
    return f'( VAR _v = [Card SVG {k}] VAR _m = {" & ".join(parts_)} RETURN IF ( _m = "", "ok", "missing" & _m ) )'


def info_chk(k):
    dl = "[Card Delta Long Text EBITDA]" if k == "EBITDA" else f"[Card Delta Text {k}]"
    tv = (f'IF ( ISBLANK ( [Card Basis {k}] ), "font-weight=\'700\' fill=\'%235F6878\'>–</text>", '
          f'"letter-spacing=\'-1\'>" & {e(f"[Card Basis Text {k}]")} & "<tspan dx=\'4\'" )')
    parts_ = [f'IF ( CONTAINSSTRING ( _v, "letter-spacing=\'-1.4\'>" & {e(f"[Card Value Text {k}]")} & "<tspan" ), "", " value" )',
              f'IF ( CONTAINSSTRING ( _v, {tv} ), "", " basis" )',
              f'IF ( CONTAINSSTRING ( _v, ">" & {e(dl)} & "</text>" ), "", " delta" )',
              f'IF ( CONTAINSSTRING ( _v, ">" & [Card Status Word {k}] & "</text>" ), "", " word" )']
    return f'( VAR _v = [Info SVG {k}] VAR _m = {" & ".join(parts_)} RETURN IF ( _m = "", "ok", "missing" & _m ) )'


STATUS_CHK = ('( VAR _pk = [Window Status Pack] VAR _v = [Status Line SVG] VAR _w = [Dot SVG] '
              'VAR _on = INT ( _pk / 1000 ) VAR _wa = INT ( MOD ( _pk, 1000 ) / 100 ) VAR _of = INT ( MOD ( _pk, 100 ) / 10 ) '
              'VAR _dc = SWITCH ( MOD ( _pk, 10 ), 1, "%232E9E5B", 2, "%23E3A52A", 3, "%23B3261E", "%23D1D5DB" ) '
              'RETURN IF ( CONTAINSSTRING ( _v, ">▲ " & _on & " on track<" ) && CONTAINSSTRING ( _v, ">● " & _wa & " watch<" ) '
              '&& CONTAINSSTRING ( _v, ">▼ " & _of & " off track<" ) && CONTAINSSTRING ( _v, "' + "r='7' fill='" + '" & _dc ) '
              '&& CONTAINSSTRING ( _w, SWITCH ( MOD ( _pk, 10 ), 1, "green", 2, "orange", 3, "red", "grey" ) ), "ok", "missing" ) )')
STATES = [("reset", []), ("P10 LY ALL", [ALL, LYC] + pick("P", "FY2026", "P10")),
          ("Q4 Prev NL", [scope_f("NL"), LW] + pick("Q", "FY2026", "Q4 · to date")),
          ("FY2026 Bud BE", [scope_f("BE"), BUD] + pick("FY", "FY2026", "FY2026 · to date")),
          ("FY2025 P10 Bud ONLINE", [scope_f("ONLINE"), BUD] + pick("P", "FY2025", "P10")),
          ("W43 Prev ALL", [ALL, LW] + pick("W", "FY2026", "W43")), ("W35 Prev BE", [scope_f("BE"), LW] + pick("W", "FY2026", "W35")),
          ("ALL#ELEC W43 Bud", [ALL, BUD, cat_f(["ELEC"])] + pick("W", "FY2026", "W43")),
          ("NL#ELEC+TOYS P10 Prev", [scope_f("NL"), LW, cat_f(["ELEC", "TOYS"])] + pick("P", "FY2026", "P10"))]
T9 = []
for i, (nm, flt) in enumerate(STATES, 1):
    rs = []
    for k in KPIS:
        rs.append(srow(f"T-N9 {nm}", f"card.{k}", card_chk(k), "ok"))
        rs.append(srow(f"T-N9 {nm}", f"info.{k}", info_chk(k), "ok"))
    rs.append(srow(f"T-N9 {nm}", "status line", STATUS_CHK, "ok"))
    prt = sblock(flt, rs) if flt else calc(["REMOVEFILTERS ( param_region )"], "\n                ,".join(rs))
    if not flt:
        S_ROWS += len(rs)
    T9.append(sevaluate(f"T-N9-{i}", [prt], f"frame parity, {nm}: card faces and i pop-ups show the card-layer texts"))
T9_NOTE = "frame parity: every card face and i pop-up shows the card-layer value, delta, chip, basis and status word; status line and dot tip show the window status pack (9 picker states, 2 with a category pick)"

# ---- T-N10 category scopes (ADR-0013 (l), E-100 .. E-104, ET-33 .. ET-35): every row of checks/control_totals_category_eur.csv through
#      the base layer with the Category slicer on top of the region; absent rows = N/A (EBITDA / OTIF families, sell-through without a
#      seasonal category, mini stats of categories outside the pick)
CROWS = list(csv.DictReader(open(CAT_CHECKS, encoding="utf-8")))
CCT = {(x["scope"], x["period_key"], x["metric_code"]): x["value"] for x in CROWS}
CAT_FAMILY = ("ebitda", "opex_", "po_lines_", "otif_", "season_", "sell_through_", "gmroi.", "status.ebitda", "status.supplier_otif",
              "status.sell_through")
T10_ROWS = 0
T10 = []
for sc in list(dict.fromkeys(x["scope"] for x in CROWS)):
    reg, codes = sc.split("#")
    codes = codes.split("+")
    keys = list(dict.fromkeys(x["period_key"] for x in CROWS if x["scope"] == sc))
    parts = []
    for pk in keys:
        a, e = window(pk)
        rs = []
        for m in METRICS:
            v = CCT.get((sc, pk, m))
            if v is not None:
                rs.append(row(f"T-N10 {sc}", pk, m, M[m], v, tol(m)))
            elif m in ABSENT or (m.startswith(CAT_FAMILY) and CT.get((reg, pk, m)) is not None):
                rs.append(row(f"T-N10 {sc}", pk, m, M[m], None, -1))
        T10_ROWS += len(rs)
        parts.append(calc([f"dim_week[sort_index] >= {a}", f"dim_week[sort_index] <= {e}", scope_f(reg), cat_f(codes)], "\n                ,".join(rs)))
    T10.append(evaluate(f"T-N10-{sc.replace('#', '-').replace('+', '_')}", parts, f"category scope {sc}: base layer per key, absent = N/A (ET-33, ET-34)"))
assert sum(1 for x in CROWS) <= T10_ROWS, T10_ROWS
T10_NOTE = (f"category scopes: all {len(CROWS):,} rows of control_totals_category_eur.csv + the N/A rows of the EBITDA / OTIF families, "
            "sell-through without a seasonal category and the mini stats outside the pick (ET-33, ET-34)")

# category texts (E-101, E-103): header segment, N/A faces, targets under a pick, all 9 = All, the i notes
CN = TS_CAT["note"]
W43 = pick("W", "FY2026", "W43")
ALL9 = list(CAT_NAME)
ct = [srow("T-N3 cat ELEC", "header.region", "[Header Region Text]", "All regions & formats · Electronics"),
      srow("T-N3 cat ELEC", "value.EBITDA", "[Card Value Text EBITDA]", "–"),
      srow("T-N3 cat ELEC", "delta.EBITDA", "[Card Delta Text EBITDA]", "n/a by category"),
      srow("T-N3 cat ELEC", "word.EBITDA", "[Card Status Word EBITDA]", "N/A"),
      srow("T-N3 cat ELEC", "value.SUPPLIER_OTIF", "[Card Value Text SUPPLIER_OTIF]", "–"),
      srow("T-N3 cat ELEC", "delta.SUPPLIER_OTIF", "[Card Delta Text SUPPLIER_OTIF]", "n/a by category"),
      srow("T-N3 cat ELEC", "value.SELL_THROUGH", "[Card Value Text SELL_THROUGH]", "–"),
      srow("T-N3 cat ELEC", "delta.SELL_THROUGH", "[Card Delta Text SELL_THROUGH]", "n/a by category"),
      srow("T-N3 cat ELEC", "rated", 'FORMAT ( [Window Status Count On] + [Window Status Count Watch] + [Window Status Count Off], "0" )', "9"),
      srow("T-N3 cat ELEC", "target.GMROI", "[Card Basis Text GMROI]", "2.2"),
      srow("T-N3 cat ELEC", "target.WEEKS_OF_COVER", "[Card Basis Text WEEKS_OF_COVER]", "15.0"),
      srow("T-N3 cat ELEC", "target.AVAILABILITY", "[Card Basis Text AVAILABILITY]", "97.0"),
      srow("T-N3 cat ELEC", "ebitda.face muted", 'IF ( CONTAINSSTRING ( [Card SVG EBITDA], "fill=\'%235F6878\'>n/a by category</text>" ), "muted", "not muted" )', "muted"),
      srow("T-N3 cat ELEC", "gmroi.stat", 'IF ( CONTAINSSTRING ( [Info SVG GMROI], ">Electronics</text>" ), "ok", "missing" )', "ok"),
      srow("T-N3 cat ELEC", "badge", 'FORMAT ( [Filter Pick Count], "0" )', "0")]
parts = [sblock([ALL, BUD, cat_f(["ELEC"])] + W43, ct)]
parts.append(sblock([ALL, BUD, cat_f(["ELEC", "TOYS"])] + W43,
                    [srow("T-N3 cat ELEC+TOYS", "header.region", "[Header Region Text]", "All regions & formats · Electronics & Toys & leisure"),
                     srow("T-N3 cat ELEC+TOYS", "value.SELL_THROUGH not N/A", 'IF ( [Card Value Text SELL_THROUGH] IN { "–", "n/a" }, "n/a", "value" )', "value"),
                     srow("T-N3 cat ELEC+TOYS", "seasonal only", f'IF ( FIND ( "Seasonal", [Info SVG SELL_THROUGH], 1, 0 ) > 0, "ok", "missing" )', "ok"),
                     srow("T-N3 cat ELEC+TOYS", "sell-through stat", 'IF ( CONTAINSSTRING ( [Info SVG SELL_THROUGH], ">Toys &amp; leisure</text>" ), "ok", "missing" )', "ok"),
                     srow("T-N3 cat ELEC+TOYS", "gmroi.stat", 'IF ( CONTAINSSTRING ( [Info SVG GMROI], ">Electronics · Toys &amp; leisure</text>" ), "ok", "missing" )', "ok"),
                     srow("T-N3 cat ELEC+TOYS", "rated", 'FORMAT ( [Window Status Count On] + [Window Status Count Watch] + [Window Status Count Off], "0" )', "10")]))
parts.append(sblock([ALL, BUD, cat_f(["FRESH", "AMBIENT", "HB"])] + pick("Q", "FY2026", "Q4 · to date"),
                    [srow("T-N3 cat 3", "header.region", "[Header Region Text]", "All regions & formats · 3 categories"),
                     srow("T-N3 cat 3", "value.SELL_THROUGH", "[Card Value Text SELL_THROUGH]", "–")]))
parts.append(sblock([ALL, BUD, cat_f(ALL9)] + W43,
                    [srow("T-N3 cat all 9", "header.region", "[Header Region Text]", "All regions & formats"),
                     srow("T-N3 cat all 9", "active", 'IF ( [_Category Active], "active", "all" )', "all"),
                     srow("T-N3 cat all 9", "value.EBITDA", "[Card Value Text EBITDA]", "€15.3"),
                     srow("T-N3 cat all 9", "target.GMROI", "[Card Basis Text GMROI]", "2.5"),
                     srow("T-N3 cat all 9", "counts", '[Window Status Count On] & "/" & [Window Status Count Watch] & "/" & [Window Status Count Off]', "7/3/2")]))
parts.append(sblock([scope_f("NL"), BUD, cat_f(["ELEC"])] + W43,
                    [srow("T-N3 cat NL ELEC", "header.region", "[Header Region Text]", "**Netherlands** · all formats · Electronics"),
                     srow("T-N3 cat NL ELEC", "sub-title unchanged", 'IF ( CONTAINSSTRING ( [Card SVG NET_SALES], "> · week 43, Netherlands</tspan>" ), "ok", "missing" )', "ok")]))
parts.append(sblock([ALL],
                    [srow("T-N3 how", "filters bullet", 'IF ( CONTAINSSTRING ( [How To Read SVG], "region, category and the metric" ), "ok", "missing" )', "ok")]))
for i, prt in enumerate(parts, 1):
    blocks.append(sevaluate(f"T-N3-c{i}", [prt], "category texts (E-101, E-103): see the T-N3 note"))
nt = [srow("T-N7 cat", "note.EBITDA", f'IF ( CONTAINSSTRING ( [Info SVG EBITDA], "{CN["EBITDA"][:38]}" ), "ok", "missing" )', "ok"),
      srow("T-N7 cat", "note.SUPPLIER_OTIF", f'IF ( CONTAINSSTRING ( [Info SVG SUPPLIER_OTIF], "{CN["SUPPLIER_OTIF"]}" ), "ok", "missing" )', "ok"),
      srow("T-N7 cat", "note.SELL_THROUGH", f'IF ( CONTAINSSTRING ( [Info SVG SELL_THROUGH], "{CN["SELL_THROUGH"]}" ), "ok", "missing" )', "ok"),
      srow("T-N7 cat", "basis dash.EBITDA", 'IF ( CONTAINSSTRING ( [Info SVG EBITDA], "font-weight=\'700\' fill=\'%235F6878\'>–</text>" ), "dash", "value" )', "dash"),
      srow("T-N7 cat", "actual dash.SUPPLIER_OTIF", 'IF ( CONTAINSSTRING ( [Info SVG SUPPLIER_OTIF], "letter-spacing=\'-1.4\'>–<tspan" ), "dash", "value" )', "dash"),
      srow("T-N7 cat", "stats n/a.SUPPLIER_OTIF", 'IF ( CONTAINSSTRING ( [Info SVG SUPPLIER_OTIF], ">PO lines due</text><text x=\'24.0\' y=\'262\' font-size=\'15\' font-weight=\'600\' fill=\'%23111827\'>n/a</text>" ), "ok", "missing" )', "ok")]
blocks.append(sevaluate("T-N7-5", [sblock([ALL, BUD, cat_f(["ELEC"])] + W43, nt)], "i pop-up under a category pick: the one-line N/A notes, '–' value and basis, n/a stats (E-101)"))

# ---- T-N8 item lists (ET-21)
il = [srow("T-N8", "counts", 'CONCATENATEX ( VALUES ( dim_item[granularity_code] ), dim_item[granularity_code] & " " & CALCULATE ( COUNTROWS ( dim_item ) ), ", ", dim_item[granularity_code], ASC )',
           "FY 2, P 22, Q 8, W 95"),
      srow("T-N8", "partial", 'CONCATENATEX ( FILTER ( dim_item, dim_item[is_partial] ), dim_item[item_key], ", ", dim_item[item_key], ASC )', "FY2026, FY2026-Q4"),
      srow("T-N8", "first / last week", 'MINX ( FILTER ( dim_item, dim_item[granularity_code] = "W" ), dim_item[item_key] ) & " .. " & MAXX ( FILTER ( dim_item, dim_item[granularity_code] = "W" ), dim_item[item_key] )',
           "FY2025-W01 .. FY2026-W43"),
      srow("T-N8", "P10 complete", 'IF ( LOOKUPVALUE ( dim_item[is_partial], dim_item[item_key], "FY2026-P10" ), "partial", "complete" )', "complete"),
      srow("T-N8", "no P11 FY2026", 'IF ( ISBLANK ( LOOKUPVALUE ( dim_item[item_key], dim_item[item_key], "FY2026-P11" ) ), "absent", "listed" )', "absent")]
blocks += T9
blocks.append(sevaluate("T-N8", [sblock([], il)] if False else [calc(["REMOVEFILTERS ( dim_item )"], "\n                ,".join(il))],
                        "item lists: 95 weeks, 22 months, 8 quarters, 2 years; partial Q4 FY2026 and FY2026 (ET-21)"))
S_ROWS += len(il)

blocks += T10
total = T1_ROWS + T2_ROWS + T5_ROWS + S_ROWS + T10_ROWS
head = f"""// Nordmark Exec - DAX control-total tests (ADR-0013 incl. (k) period model; docs/Requirements-exec.md ET-01 .. ET-32).
// Generated from data/nordmark_retail_dummy_data/checks/control_totals_eur.csv ({len(rows):,} rows, 93 keys, seed 20261028): the {ITEM_ROWS:,} rows
// of the 87 item keys are all in T-N1; the 6 legacy PTD- / YTD- keys are retired here (their values live on as P-FY2026-10, FY-FY2026, ...).
// Run each '// ==== BLOCK' as its own query (DAX query view or ADOMD; a whole-file run runs out of memory); every row must return _pass = TRUE.
// Tolerances as checks/verify.py: amounts 0.0051, units / SKU-days 0.06, ratios 1e-6, counts and status codes exact; expected BLANK = absent (N/A).
// T-N1 base layer per scope x key (window = dim_week rows) | T-N2 card layer through the picker slicers (type x item x comparator x scope)
// T-N3 texts ({T3_NOTE}) | T-N4 bars per type | T-N5 identities (ET-07, ET-12) | T-N6 conceal in place (ET-13) | T-N7 {T7_NOTE} | T-N8 item lists
// T-N9 {T9_NOTE}
// T-N10 {T10_NOTE}
// Rows: {total:,} (T-N1 {T1_ROWS:,}; T-N2 + T-N4 {T2_ROWS:,}; T-N5 {T5_ROWS}; T-N10 {T10_ROWS:,}; string rows {S_ROWS}).

"""
order = []
for tag in ["T-N1", "T-N2", "T-N3", "T-N4", "T-N5", "T-N6", "T-N7", "T-N8", "T-N9", "T-N10"]:
    order += [b for b in blocks if f"BLOCK {tag}" in b]
write_text(os.path.join(ROOT, "tests", "control-totals.dax"), head + "\n".join(order))
print(f"tests: {len(order)} blocks, {total:,} rows (T-N1 {T1_ROWS:,}, T-N2/4 {T2_ROWS:,}, T-N5 {T5_ROWS}, T-N10 {T10_ROWS:,}, strings {S_ROWS})")

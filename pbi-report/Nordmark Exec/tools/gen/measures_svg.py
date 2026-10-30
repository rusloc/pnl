"""SVG image measures: 12 cards, card pop-ups (tooltip pages), header, status line, badge, How to read (ADR-0012, E-20 .. E-29, E-57, E-58).
Static copy is pre-wrapped here with Segoe UI metrics (PIL); {tokens} are filled by DAX. Power BI draws the v5 glass as solid panels."""
from measures import (add, dq, xml, KPIS, VALUE, BASIS, BAR, BAR_BASIS, UNIT, SIZE, COPY, W, LY, LW, AT, WV, LYV, LWV, EBV,
                      f_eur, f_sgn_eur, f_pct, f_sgn_pct, f_sgn_pp, f_sgn, f_tgt_pct, f_int)
from copy_v5 import ATTRS, PAGE, HOW, CARDS, BASIS_LABEL
import json
import os as _os
from common import C, text_width, wrap
from frame import frame, core, localize, wrap_body, CAT_NOTE  # noqa: E402
from measures import Hoist  # noqa: E402

GLYPH = {1: "▲", 2: "●", 3: "▼"}
INFO_ICON = ("<path d='M10 8.6v5.2' stroke='#5F6878' stroke-width='1.8' stroke-linecap='round' fill='none'/>"
             "<circle cx='10' cy='5.6' r='1' fill='#5F6878'/>")
DRILL_ICON = ("<g fill='none' stroke='#5F6878' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'>"
              "<circle cx='5.8' cy='13' r='3'/><circle cx='14.2' cy='13' r='3'/>"
              "<path d='M8.8 12.3h2.4M6.6 10.1 7.4 5.6h2.1l.4 2.6M13.4 10.1 12.6 5.6h-2.1l-.4 2.6'/></g>")
FONT = "font-family='Segoe UI, sans-serif'"


def chip_w(word, glyph=True):
    return round(text_width(word, 11.5, True) + (12 if glyph else 0) + 18, 1)


CHIP = {1: ("▲ On track", chip_w("On track")), 2: ("● Watch", chip_w("Watch")), 3: ("▼ Off track", chip_w("Off track")),
        0: ("– N/A", chip_w("N/A"))}
STATUS_VARS = f"""VAR _ink        = SWITCH ( _st, 1, "{C['good']}", 2, "{C['watch']}", 3, "{C['off']}", "{C['muted']}" )
VAR _cur        = SWITCH ( _st, 1, "{C['good']}", 2, "{C['watch']}", 3, "{C['off']}", "{C['ink']}" )
VAR _tint       = SWITCH ( _st, 1, "{C['goodT']}", 2, "{C['watchT']}", 3, "{C['offT']}", "{C['naT']}" )
VAR _chip       = SWITCH ( _st, 1, "{CHIP[1][0]}", 2, "{CHIP[2][0]}", 3, "{CHIP[3][0]}", "{CHIP[0][0]}" )
VAR _glyph      = SWITCH ( _st, 1, "▲", 2, "●", 3, "▼", "–" )
VAR _word       = SWITCH ( _st, 1, "On track", 2, "Watch", 3, "Off track", "N/A" )
VAR _cw         = SWITCH ( _st, 1, {CHIP[1][1]}, 2, {CHIP[2][1]}, 3, {CHIP[3][1]}, {CHIP[0][1]} )"""
ENC = 'RETURN\n    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )'


BAR_ITEMS = """VAR _bgr        = [_Granularity Code]
VAR _bo         = [_Item Sort]
VAR _bn         = SWITCH ( _bgr, "P", 12, "Q", 8, "FY", 2, 13 )"""


def bar_pts(metric):
    """The N items of the picked type ending at the picked item (E-96): @i = bar position 0 .. N-1, @v = the card metric
    over that item's window. Items before the data starts are absent (blank bars)."""
    return f"""VAR _pts        =
    ADDCOLUMNS (
        CALCULATETABLE (
            SELECTCOLUMNS ( dim_item, "@o", dim_item[sort_order] + 0, "@bs", dim_item[start_index] + 0, "@be", dim_item[end_index] + 0 )
            ,REMOVEFILTERS ( dim_item )
            ,dim_item[granularity_code] = _bgr
            ,dim_item[sort_order] > _bo - _bn
            ,dim_item[sort_order] <= _bo
        )
        ,"@i", [@o] - _bo + _bn - 1
        ,"@v", VAR _x1 = [@bs] VAR _x2 = [@be] RETURN CALCULATE ( [{metric}], REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _x1, dim_week[sort_index] <= _x2 )
    )"""


def bars_dax(metric, basis, x0, y0, bw, bh, labels=False, lab_y=None, local=False):
    """N bottom-aligned bars ending at the picked item (13 weeks / 12 months / 8 quarters / 2 years, E-96, js-exec
    components/bars.ts), the picked one in _cur, dotted target = the picked item's basis. Needs _s / _e (window)."""
    lab = '\nVAR _labels     = ""'
    if labels:
        # labels counted back from the last bar: every 3rd of 12-13, every 2nd of 8, each of 2; arithmetic before the data
        lab = f"""
VAR _fy0        = CALCULATE ( MIN ( dim_item[fy] ), REMOVEFILTERS ( dim_item ) )
VAR _per        = SWITCH ( _bgr, "P", 12, "Q", 4, 52 )
VAR _stride     = IF ( _bn >= 12, 3, IF ( _bn >= 8, 2, 1 ) )
VAR _labels     =
    CONCATENATEX (
        FILTER ( GENERATESERIES ( 0, _bn - 1, 1 ), MOD ( _bn - 1 - [Value], _stride ) = 0 )
        ,VAR _i = [Value]
         VAR _pos = _bo - _bn + _i
         VAR _lfy = IF ( _bgr = "FY", _fy0 + _pos, _fy0 + INT ( _pos / _per ) )
         VAR _ln = MOD ( _pos, _per ) + 1
         VAR _lt = SWITCH ( _bgr, "FY", "FY" & RIGHT ( _lfy, 2 ), "Q", "Q" & _ln & " FY" & RIGHT ( _lfy, 2 ), "P", "P" & _ln, "W" & _ln )
         RETURN
            "<text x='" & FORMAT ( {x0} + _i * ( _bw + 2 ) + _bw / 2, "0.0" ) & "' y='{lab_y}' text-anchor='middle' font-size='9' fill='"
                & IF ( _i = _bn - 1, "{C['ink']}' font-weight='600", "{C['muted']}" ) & "'>" & _lt & "</text>"
        ,""
        ,[Value], ASC
    )"""
    items = BAR_ITEMS.replace("[_Granularity Code]", "_gr").replace("[_Item Sort]", "_iso") if local else BAR_ITEMS
    tgt = W(f"[{basis}]") if local else f"CALCULATE ( [{basis}], REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _s, dim_week[sort_index] <= _e )"
    return f"""{items}
{bar_pts(metric)}
VAR _nb         = FILTER ( _pts, NOT ISBLANK ( [@v] ) )
VAR _tgt        = {tgt}
VAR _mn         = MINX ( _nb, [@v] )
VAR _mx         = MAXX ( _nb, [@v] )
VAR _lo0        = IF ( NOT ISBLANK ( _tgt ) && _tgt < _mn, _tgt, _mn )
VAR _hi0        = IF ( NOT ISBLANK ( _tgt ) && _tgt > _mx, _tgt, _mx )
VAR _rng        = IF ( _hi0 - _lo0 = 0, 1, _hi0 - _lo0 )
VAR _lo         = _lo0 - _rng * 0.6
VAR _hi         = _hi0 + _rng * 0.15
VAR _bw         = ( {bw} - 2 * ( _bn - 1 ) ) / _bn
VAR _rects      =
    CONCATENATEX (
        _nb
        ,VAR _h = ( [@v] - _lo ) / ( _hi - _lo ) * {bh}
         RETURN
            "<rect x='" & FORMAT ( {x0} + [@i] * ( _bw + 2 ), "0.0" ) & "' y='" & FORMAT ( {y0} + {bh} - _h, "0.0" )
                & "' width='" & FORMAT ( _bw, "0.0" ) & "' height='" & FORMAT ( _h, "0.0" ) & "' rx='1' fill='"
                & IF ( [@i] = _bn - 1, _cur, "{C['col']}" ) & "'/>"
        ,""
        ,[@i], ASC
    )
VAR _tline      =
    IF (
        NOT ISBLANK ( _tgt ) && COUNTROWS ( _nb ) > 0
        ,"<path d='M{x0} " & FORMAT ( {y0} + {bh} - ( _tgt - _lo ) / ( _hi - _lo ) * {bh}, "0.0" )
            & " H{x0 + bw}' stroke='{C['tgt']}' stroke-width='1' stroke-dasharray='2 2' fill='none'/>"
    ){lab}
VAR _bars       = IF ( COUNTROWS ( _nb ) > 0, _rects, "" ) & _tline & _labels"""


def rich(text, bold_state=False, bold_weight="600"):
    """xml-escape and turn **..** into tspans; returns (svg, bold_state_after)."""
    out = []
    parts = text.split("**")
    for i, p in enumerate(parts):
        if i > 0:
            bold_state = not bold_state
            out.append(f"<tspan font-weight='{bold_weight}'>" if bold_state else "</tspan>")
        out.append(xml(p))
    if bold_state:
        out.append("</tspan>")
    return "".join(out), bold_state


def text_lines(lines, x, y0, lh, size, fill, weight="400", extra=""):
    """lines -> list of <text> elements; bold state carries across lines."""
    out, state = [], False
    for j, ln in enumerate(lines):
        open_ = f"<tspan font-weight='600'>" if state else ""
        body, state = rich(ln, state)
        out.append(f"<text x='{x}' y='{round(y0 + j * lh, 1)}' font-size='{size}' font-weight='{weight}' fill='{fill}'{extra}>{open_}{body}</text>")
    return out


def concat_static(parts):
    """Join static SVG fragments into a DAX string expression (chunks of ~3 kB)."""
    s = "".join(parts)
    chunks = [s[i:i + 3000] for i in range(0, len(s), 3000)] or [""]
    return "\n        & ".join(dq(c) for c in chunks)


def subst(expr, tokens):
    """Nested SUBSTITUTE for {token} -> DAX expression."""
    for t, e in tokens.items():
        expr = f"SUBSTITUTE ( {expr}, \"{{{t}}}\", {e} )"
    return expr


# ---------------------------------------------------------------- card geometry (v5 size map, E-50, E-29)
GEO = {
    "hero": dict(W=437, H=236, tfs=14.5, vfs=44, vb=76, dfs=13.5, db=102, bw=260, bh=92),
    "medium": dict(W=437, H=176, tfs=13.5, vfs=30, vb=67, dfs=12.5, db=90, bw=180, bh=62),
    "small": dict(W=213, H=168, tfs=13.5, vfs=26, vb=64, dfs=12, db=85, bw=88, bh=58),
}


def sub_expr(k):
    c = COPY[k]
    prov = f'IF ( LOOKUPVALUE ( dim_kpi[is_provisional], dim_kpi[kpi_code], "{k}" ), " · prov.", "" )'
    if k == "NET_SALES":
        base = '[Period Phrase] & ", " & [Region Phrase]'
    elif k == "EBITDA":
        # month to date at Week ("month 10 to date"), the item's own window phrase otherwise (E-40, E-93)
        base = 'IF ( [_Granularity Code] = "W", "month " & [Period No] & " " & ' + dq(c["sub"]) + ', [Period Phrase] )'
    elif k == "LFL_GROWTH":
        base = dq(c["sub"]) + ' & " " & [Window Noun]'
    else:
        base = dq(c["sub"])
    return f"{base} & {prov}"


def wrap_dax(var, maxc, nwords, p):
    """Greedy word wrap of a dynamic text into '|'-separated lines of <= maxc characters; returns (DAX VAR block, acc var)."""
    L = [f"VAR {p}w         = SUBSTITUTE ( SUBSTITUTE ( {var}, \"|\", \"/\" ), \" \", \"|\" )"]
    for i in range(1, nwords + 1):
        L.append(f"VAR {p}w{i}        = PATHITEM ( {p}w, {i} )")
    L.append(f"VAR {p}a1        = {p}w1")
    L.append(f"VAR {p}c1        = {p}w1")
    for i in range(2, nwords + 1):
        L.append(f"VAR {p}f{i}        = LEN ( {p}c{i-1} ) + 1 + LEN ( {p}w{i} ) <= {maxc}")
        L.append(f"VAR {p}a{i}        = IF ( {p}w{i} = \"\", {p}a{i-1}, IF ( {p}f{i}, {p}a{i-1} & \" \" & {p}w{i}, {p}a{i-1} & \"|\" & {p}w{i} ) )")
        L.append(f"VAR {p}c{i}        = IF ( {p}w{i} = \"\", {p}c{i-1}, IF ( {p}f{i}, {p}c{i-1} & \" \" & {p}w{i}, {p}w{i} ) )")
    return "\n".join(L), f"{p}a{nwords}"


def wrap_delta_dax(var, maxc=14):
    """Small cards: the delta row wraps in the 83 px text column (v5 .sm .delta)."""
    block, acc = wrap_dax(var, maxc, 8, "_d")
    return block + f"\nVAR _dl1        = PATHITEM ( {acc}, 1 )\nVAR _dl2        = PATHITEM ( {acc}, 2 )\nVAR _dl3        = PATHITEM ( {acc}, 3 )"


def rich_line_dax(x):
    """One wrapped line: escape &, then the first ** pair becomes a bold tspan."""
    return (f"SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( {x}, \"&\", \"&amp;\" ), \"**\", \"<tspan font-weight='600'>\", 1 ), "
            f"\"**\", \"</tspan>\", 1 )")


def icons(H):
    cy = H - 25
    out = []
    for cx, ico in [(30, INFO_ICON), (62, DRILL_ICON)]:
        out.append(f"<circle cx='{cx}' cy='{cy}' r='13.5' fill='#FFFFFF' fill-opacity='0.6' stroke='{C['line']}'/>"
                   f"<g transform='translate({cx - 8} {cy - 8}) scale(0.8)'>{ico}</g>")
    return "".join(out)


def card_svg(k):
    size = SIZE.get(k, "small")
    g = GEO[size]
    Wd, H = g["W"], g["H"]
    c = COPY[k]
    small = size == "small"
    x0, y0 = Wd - 16 - g["bw"], H - 11 - g["bh"]
    defs = ("<defs><linearGradient id='wW' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#FFFFFF'/>"
            "<stop offset='1' stop-color='#FFD3A0' stop-opacity='0.5'/></linearGradient>"
            "<linearGradient id='wO' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#FFFFFF'/>"
            "<stop offset='1' stop-color='#F3C9C5' stop-opacity='0.5'/></linearGradient>"
            "<filter id='gs'><feColorMatrix type='saturate' values='0'/></filter></defs>")
    bg_on = f"<rect x='0.5' y='0.5' width='{Wd - 1}' height='{H - 1}' rx='15.5' fill='#FFFFFF' stroke='{C['line']}'/>"
    bg_w = f"<rect x='0.5' y='0.5' width='{Wd - 1}' height='{H - 1}' rx='15.5' fill='url(#wW)' stroke='{C['line']}'/>"
    bg_o = f"<rect x='1' y='1' width='{Wd - 2}' height='{H - 2}' rx='15' fill='url(#wO)' stroke='{C['off']}' stroke-width='2'/>"
    head = f"<svg xmlns='http://www.w3.org/2000/svg' width='{Wd}' height='{H}' viewBox='0 0 {Wd} {H}' {FONT}>"
    if small:
        title = f'"<text x=\'16\' y=\'27\' font-size=\'{g["tfs"]}\' font-weight=\'600\' fill=\'{C["ink"]}\'>{xml(c["title"])}</text>"'
        chip = (f'"<circle cx=\'{Wd - 27}\' cy=\'22\' r=\'11\' fill=\'" & _tint & "\'/><text x=\'{Wd - 27}\' y=\'26\' text-anchor=\'middle\' '
                f'font-size=\'11\' font-weight=\'600\' fill=\'" & _ink & "\'>" & _glyph & "</text>"')
        delta = (f'"<text x=\'16\' y=\'{g["db"]}\' font-size=\'12\' font-weight=\'600\' fill=\'" & _dink & "\'>" & _dl1 & "</text>"\n'
                 f'        & "<text x=\'16\' y=\'{g["db"] + 16}\' font-size=\'12\' font-weight=\'600\' fill=\'" & _dink & "\'>" & _dl2 & "</text>"\n'
                 f'        & "<text x=\'16\' y=\'{g["db"] + 32}\' font-size=\'12\' font-weight=\'600\' fill=\'" & _dink & "\'>" & _dl3 & "</text>"')
        wrapv = "\n" + wrap_delta_dax("_dt")
    else:
        title = (f'"<text x=\'16\' y=\'27\' font-size=\'{g["tfs"]}\' font-weight=\'600\' fill=\'{C["ink"]}\'>{xml(c["title"])}'
                 f'<tspan font-weight=\'400\' fill=\'{C["muted"]}\'> · " & _sub & "</tspan></text>"')
        chip = (f'"<rect x=\'" & FORMAT ( {Wd - 16} - _cw, "0.0" ) & "\' y=\'11\' width=\'" & FORMAT ( _cw, "0.0" ) & "\' height=\'22\' rx=\'11\' fill=\'" & _tint & "\'/>"\n'
                f'        & "<text x=\'" & FORMAT ( {Wd - 16} - _cw / 2, "0.0" ) & "\' y=\'26\' text-anchor=\'middle\' font-size=\'11.5\' font-weight=\'600\' fill=\'" & _ink & "\'>" & _chip & "</text>"')
        delta = f'"<text x=\'16\' y=\'{g["db"]}\' font-size=\'{g["dfs"]}\' font-weight=\'600\' fill=\'" & _dink & "\'>" & _dt & "</text>"'
        wrapv = ""
    value = (f'"<text x=\'16\' y=\'{g["vb"]}\' font-size=\'{g["vfs"]}\' font-weight=\'600\' fill=\'{C["ink"]}\' letter-spacing=\'-0.5\'>" & _val\n'
             f'        & "<tspan font-size=\'13\' font-weight=\'500\' fill=\'{C["muted"]}\' letter-spacing=\'0\' dx=\'4\'>" & _unit & "</tspan></text>"')
    with Hoist() as hs:
        cl = core(k)
        bars = bars_dax(BAR[k], BAR_BASIS[k], x0, y0, g["bw"], g["bh"], local=True) if k != "CHANNEL_MIX" else 'VAR _bars       = ""'
    body = f"""{hs.block()}
{chr(10).join(cl)}
VAR _sub        = {localize(sub_expr(k))}
{STATUS_VARS}
VAR _dink       = IF ( LEFT ( _dt, 3 ) = "n/a", "{C['muted']}", _ink ){wrapv}
VAR _bg         = SWITCH ( _st, 2, {dq(bg_w)}, 3, {dq(bg_o)}, {dq(bg_on)} )
{bars}
VAR _svg        =
    {dq(head + defs)}
        & "<g" & IF ( _rev, "", " opacity='0.08' filter='url(#gs)'" ) & ">" & _bg
        & {title}
        & {chip}
        & {value}
        & {delta}
        & {dq(icons(H))}
        & _bars
        & "</g></svg>\"""".split("\n")
    expr = "\n" + wrap_body(f"Card SVG {k}", frame(k), body, ENC.split("RETURN\n    ", 1)[1])
    add(f"Card SVG {k}", expr, None, "8 Cards SVG", desc=f"{k} card face (E-20): wash, title, chip, value, delta (muted when n/a), bars of the picked type (E-96), i and binoculars; faded in place when concealed (E-55). "
        "Built in one frame: slicers read once, face computed with the slicer tables cleared and the region as a dim_store filter (perf pass 2026-10-30).",
        cat="ImageUrl")


for k in KPIS:
    card_svg(k)

# bar points for parity rows (hunter) and the DAX tests
for k in KPIS:
    if k == "CHANNEL_MIX":
        continue
    add(f"Card Bar Points {k}", f"""
{BAR_ITEMS}
{bar_pts(BAR[k])}
RETURN
    CONCATENATEX (
        GENERATESERIES ( 0, _bn - 1, 1 )
        ,VAR _i = [Value] VAR _v = MAXX ( FILTER ( _pts, [@i] = _i ), [@v] )
         RETURN
            IF ( ISBLANK ( _v ), "", FORMAT ( _v, "0.000000" ) )
        ,"|"
        ,[Value], ASC
    )""", None, "8 Cards SVG", True,
        desc=f"{k}: the N bar values of the picked type ending at the picked item (13 / 12 / 8 / 2, E-96), '|'-separated, 6 decimals; blank = no bar.")

# ---------------------------------------------------------------- dispatchers (dim_kpi, ADR-0013 (g))
add("KPI Code", "SELECTEDVALUE ( dim_kpi[kpi_code] )", None, "8 Cards", desc="The KPI in context (card and pop-up visuals filter dim_kpi).")


def dispatch(name, pattern, desc, cat=None, fmt=None, kpis=KPIS):
    branches = "\n    ".join(f',"{k}"\n        ,[{pattern.format(k=k)}]' for k in kpis)
    add(name, f"""
SWITCH (
    [KPI Code]
    {branches}
)""", fmt, "8 Cards", desc=desc, cat=cat)


dispatch("KPI Value", "Card Value {k}", "Card value of the KPI in context.")
dispatch("KPI Compare", "Card Compare {k}", "Comparator value of the KPI in context.")
dispatch("KPI Status", "Card Status {k}", "Status code of the KPI in context.", fmt="0")
dispatch("KPI Revealed", "Card Revealed {k}", "Attribute-filter state of the KPI in context.")
dispatch("KPI Card SVG", "Card SVG {k}", "Card face of the KPI in context.", cat="ImageUrl")
add("KPI Hit", 'IF ( [KPI Revealed], UNICHAR ( 160 ) )', None, "8 Cards",
    desc="Invisible value of the i / binoculars / chip hover targets; blank when the card is concealed (E-55).")

# ---------------------------------------------------------------- pop-ups: i (tt_info), drill (tt_drill), rule (tt_rule)
IW = 520
DD_X, DD_W = 156, 340


from tokens import card_numbers, mix_chart  # noqa: E402
import fmt as F  # noqa: E402

EX_LINES, EX_CHARS, EX_WORDS = 6, 52, 48
KPI_ATTR = json.load(open(_os.path.join(_os.path.dirname(__file__), "dim_kpi_cards.json"), encoding="utf-8"))
UNIT_TXT = {"EUR": "m", "PCT": "%", "LFL": "%", "WKS": "wks", "X": "×", "MIX": "% store"}
Y_BODY = 278          # first body row: stats values (262) + 16
# stacked value block (USER 2026-10-30, js-exec twin): Actual 16/600 -> value 48/700 -> 12 px -> swatch + basis 16/600 -> target
# 40/700 -> delta. Gaps are visible gaps: baseline of the upper text to the cap top (0.7 em) of the lower one.
IB = dict(lab_a=87, val_a=125, sw=142.5, lab_b=148, val_b=180, delta=201, sep=222, st_l=242, st_v=262, bar_y=126, bar_lab=199)
TGT_INK = "#374151"   # target line label / unit (USER 2026-10-29, E-57)


def info_static(c):
    """What / Why / Formula rows (before the example) and the Status rule row (after it, relative to the example row top).
    The owner note row is gone (round 3, E-57, ET-32)."""
    before, y = [], Y_BODY
    for lab, key in [("What it is", "what"), ("Why it matters", "why"), ("Formula", "formula")]:
        lines = wrap(c[key], DD_W, 13)
        before.append(f"<text x='24' y='{y + 12}' font-size='10.5' font-weight='600' fill='{C['muted']}' letter-spacing='0.6'>{xml(lab.upper())}</text>")
        before += text_lines(lines, DD_X, y + 13, 19, 13, C["ink"])
        y += 19 * len(lines) + 7
    y_ex = y
    after, ya = [], y_ex
    for lab, key in [("Status rule", "rule")]:
        lines = wrap(c[key], DD_W, 13)
        after.append(f"<text x='24' y='{ya + 12}' font-size='10.5' font-weight='600' fill='{C['muted']}' letter-spacing='0.6'>{xml(lab.upper())}</text>")
        after += text_lines(lines, DD_X, ya + 13, 19, 13, C["ink"])
        ya += 19 * len(lines) + 7
    return before, y_ex, after, ya


TAGW = {}
for a, alab, vals in ATTRS:
    for code, vlab in vals:
        TAGW[(a, vlab)] = round(text_width(alab + " ", 11) + text_width(vlab, 11, True) + 18, 1)


def notes_of(k):
    c = COPY[k]
    out = ["Updated weekly" if c["cadence"] == "weekly" else "Updated Mon 05:12"]
    if c["prov"] is not None:
        out.append(c["prov"])
    return out


def tags_layout(k):
    """Group · Lever · Owner tags of the card (dim_kpi, E-53 / E-57), closed on the right by the refresh / provisional note;
    the note drops to a second row when it does not fit (js-exec .tags flex-wrap)."""
    x, parts = 24.0, []
    for a, alab, vals in ATTRS:
        vlab = dict(vals)[KPI_ATTR[k][a]]
        w = TAGW[(a, vlab)]
        parts.append((round(x, 1), w, alab, vlab))
        x += w + 6
    end = x - 6
    nw = max(text_width(n, 12.5, True) for n in notes_of(k))
    return parts, end + 12 + nw > IW - 24


def info_bottom(k):
    """Height of the pop-up for a card without its dynamic example lines."""
    _b, _y, _a, ya = info_static(COPY[k])
    return ya + 12 + 20 + (26 if tags_layout(k)[1] else 0) + 22


INFO_H = int(max(info_bottom(c["k"]) for c in CARDS) + EX_LINES * 19 + 7)


def info_svg(k):
    c = COPY[k]
    hs = Hoist().__enter__()
    ex, stats = card_numbers(k, word="_word", pno="_pno")
    ex, stats = localize(ex), [(localize(lab), localize(val)) for lab, val in stats]
    before, y_ex, after, ya = info_static(c)
    ty = ya + 12
    parts, wraps = tags_layout(k)
    tags = "".join(
        f"<rect x='{x}' y='{ty}' width='{w}' height='20' rx='10' fill='#FFFFFF' stroke='{C['chip_line']}'/>"
        f"<text x='{round(x + 9, 1)}' y='{ty + 14}' font-size='11' fill='{C['muted']}'>{alab} "
        f"<tspan font-weight='600' fill='{C['ink']}'>{xml(vlab)}</tspan></text>" for x, w, alab, vlab in parts)
    note_y = ty + 14 + (26 if wraps else 0)
    bottom = info_bottom(k)
    eyebrow_pre = "Tier 1 · " if SIZE.get(k) == "hero" else "Explains Tier 1 · "
    stat_vars, stat_svg = [], []
    for i, (lab, val) in enumerate(stats):
        x = round(24 + i * (448 + 12) / 3, 1)
        stat_vars.append(f"VAR _sl{i}        = SUBSTITUTE ( {lab}, \"&\", \"&amp;\" )")
        stat_vars.append(f"VAR _sv{i}        = SUBSTITUTE ( IF ( _cna && _sl{i} <> \"\", \"n/a\", {val} ), \"&\", \"&amp;\" )")
        stat_svg.append(f"\"<text x='{x}' y='{IB['st_l']}' font-size='12' fill='{C['muted']}'>\" & _sl{i} & \"</text>"
                        f"<text x='{x}' y='{IB['st_v']}' font-size='15' font-weight='600' fill='{C['ink']}'>\" & _sv{i} & \"</text>\"")
    if c["prov"] is not None:
        foot_r = f'IF ( LOOKUPVALUE ( dim_kpi[is_provisional], dim_kpi[kpi_code], "{k}" ), {dq(c["prov"])}, [Updated Text] )'
    elif c["cadence"] == "weekly":
        foot_r = '"Updated weekly"'
    else:
        foot_r = "[Updated Text]"
    wblock, acc = wrap_dax("_ex", EX_CHARS, EX_WORDS, "_x")
    ex_lines = "\n        & ".join(
        f"IF ( PATHLENGTH ( {acc} ) >= {j}, \"<text x='{DD_X}' y='{y_ex + 13 + (j - 1) * 19}' font-size='13' fill='{C['ink']}'>\" & "
        f"{rich_line_dax(f'PATHITEM ( {acc}, {j} )')} & \"</text>\" )" for j in range(1, EX_LINES + 1))
    chart = mix_chart() if k == "CHANNEL_MIX" else bars_dax(BAR[k], BAR_BASIS[k], 256, IB["bar_y"], 240, 60, labels=True, lab_y=IB["bar_lab"], local=True)
    cl = core(k, info=True)
    hs.__exit__(None, None, None)
    tlab = BASIS_LABEL[KPI_ATTR[k]["basis"]]
    unit = UNIT_TXT[UNIT[k]]
    tval = (f"\"<text x='24' y='{IB['val_b']}' font-size='40' font-weight='700' fill='{C['ink']}' letter-spacing='-1'>\" & _bt"
            f" & \"<tspan dx='4' font-size='16' font-weight='600' fill='{TGT_INK}' letter-spacing='0'>{unit}</tspan></text>\"")
    tnone = f"<text x='24' y='{IB['val_b']}' font-size='40' font-weight='700' fill='{C['muted']}'>–</text>"
    body = f"""{hs.block()}
{chr(10).join(cl)}
VAR _sub        = {localize(sub_expr(k))}
{STATUS_VARS}
VAR _dink       = IF ( LEFT ( _dlong, 3 ) = "n/a", "{C['muted']}", _ink )
VAR _tval       = IF ( ISBLANK ( _b ), {dq(tnone)}, {tval} )
{chart}
{chr(10).join(stat_vars)}
VAR _ex         = {f'IF ( _cna, {dq(CAT_NOTE[k])}, {ex} )' if k in CAT_NOTE else ex}
{wblock}
VAR _n          = MIN ( PATHLENGTH ( {acc} ), {EX_LINES} )
VAR _dy         = _n * 19 + 7
VAR _h          = {bottom} + _dy
VAR _footr      = {foot_r}
VAR _head       =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{IW}' height='{INFO_H}' viewBox='0 0 {IW} {INFO_H}' {FONT}>"
        & "<rect x='0.5' y='0.5' width='{IW - 1}' height='" & FORMAT ( _h - 1, "0" ) & "' rx='15.5' fill='#FFFFFF' stroke='{C['line']}'/>"
        & "<text x='24' y='34' font-size='10.5' font-weight='600' fill='{C['muted']}' letter-spacing='0.6'>" & UPPER ( "{eyebrow_pre}" & _sub ) & "</text>"
        & "<text x='24' y='58' font-size='18' font-weight='600' fill='{C['ink']}'>{xml(c['title'])}</text>"
        & "<text x='{IW - 24}' y='58' text-anchor='end' font-size='14' font-weight='600' fill='" & _ink & "'>" & _word & "</text>"
        & "<text x='24' y='{IB['lab_a']}' font-size='16' font-weight='600' fill='{TGT_INK}'>Actual</text>"
        & "<text x='24' y='{IB['val_a']}' font-size='48' font-weight='700' fill='{C['ink']}' letter-spacing='-1.4'>" & _val
        & "<tspan font-size='16' font-weight='500' fill='{C['muted']}' letter-spacing='0' dx='6'>" & _unit & "</tspan></text>"
        & "<line x1='24' y1='{IB['sw']}' x2='44' y2='{IB['sw']}' stroke='{C['tgt']}' stroke-width='2' stroke-dasharray='2 2'/>"
        & "<text x='52' y='{IB['lab_b']}' font-size='16' font-weight='600' fill='{TGT_INK}'>{tlab}</text>"
        & _tval
        & "<text x='24' y='{IB['delta']}' font-size='13.5' font-weight='600' fill='" & _dink & "'>" & _dlong & "</text>"
        & "<line x1='24' y1='{IB['sep']}' x2='{IW - 24}' y2='{IB['sep']}' stroke='#EDEEF0'/>"
        & {chr(10).join(stat_svg).replace(chr(10), chr(10) + "        & ")}
VAR _body       =
    {concat_static(before)}
        & "<text x='24' y='{y_ex + 12}' font-size='10.5' font-weight='600' fill='{C['muted']}' letter-spacing='0.6'>WORKED EXAMPLE</text>"
        & {ex_lines}
        & "<g transform='translate(0 " & _dy & ")'>"
        & {concat_static(after + [tags])}
        & "<text x='{IW - 24}' y='{note_y}' text-anchor='end' font-size='12.5' font-weight='500' fill='{C['ink']}'>" & _footr & "</text>"
        & "</g>"
VAR _svg        = _head & _bars & _body & "</svg>\"""".split("\n")
    expr = "\n" + wrap_body(f"Info SVG {k}", frame(k, info=True), body, ENC.split("RETURN\n    ", 1)[1])
    add(f"Info SVG {k}", expr, None, "8 Cards SVG", True, desc=f"{k} i pop-up (tooltip page tt_info, E-57, ET-30, ET-32): stacked block Actual / value / basis / target (USER 2026-10-30), "
                                                                 "delta, labelled bars of the picked type, 3 stats, what / why / formula / worked example / rule, "
                                                                 "tags closed by the refresh or provisional note (js-exec view.ts, Layers.tsx). One frame (perf pass 2026-10-30).", cat="ImageUrl")


# EBITDA at Week vs Previous: the i delta names the compared weeks (USER 2026-10-30; js-exec view.ts deltaLong)
add("Card Delta Long Text EBITDA", f"""
VAR _nm         = [_EB Prev Name]
VAR _v          = [Card Value EBITDA]
VAR _c          = [Card Compare EBITDA]
VAR _d          = _v - _c
VAR _lab        = "vs " & _nm
RETURN
    IF (
        [_Comparator Code] = "LW" && [_Granularity Code] = "W" && _nm <> "" && NOT [_Category Active]
        ,IF (
            ISBLANK ( _v ) || ISBLANK ( _c )
            ,"n/a " & _lab
            ,{F.eurDelta("_d", na=False)} & " (" & {F.pctSigned("DIVIDE ( _v, _c ) - 1", na=False)} & ") " & _lab
        )
        ,[Card Delta Text EBITDA]
    )""", None, "8 Cards", desc="EBITDA delta line of the i pop-up: at Week vs Previous it names the compared weeks (vs P9 weeks 1-4, vs P12 FY2025 week 1); else the card delta (E-93, ET-31).")

for k in KPIS:
    info_svg(k)
dispatch("KPI Info SVG", "Info SVG {k}", "i pop-up of the KPI in context (tt_info).", cat="ImageUrl")

# drill path pop-up (E-58)
DW = 440
drill_h = {}


def drill_layout(c):
    frags, y = [], 78
    for i, (t, d) in enumerate(c["steps"]):
        last = i == len(c["steps"]) - 1
        lines = wrap(d, DW - 24 - 62, 13)
        frags.append(f"<circle cx='37' cy='{y + 9}' r='13' fill='{C['mix2'] if last else C['acc']}'/>"
                     f"<text x='37' y='{y + 13}' text-anchor='middle' font-size='12' font-weight='600' fill='#FFFFFF'>{i + 1}</text>"
                     f"<text x='62' y='{y + 13}' font-size='13' font-weight='600' fill='{C['ink']}'>{xml(t)}</text>")
        frags += text_lines(lines, 62, y + 32, 19, 13, C["ink"])
        y += 19 * (1 + len(lines)) + 12
    foot = wrap("Carried on every click: period · region / format · comparator · the metric", DW - 48, 12.5)
    frags.append(f"<line x1='24' y1='{y}' x2='{DW - 24}' y2='{y}' stroke='#EDEEF0'/>")
    frags += text_lines(foot, 24, y + 20, 18, 12.5, C["muted"])
    return frags, y + 20 + 18 * (len(foot) - 1) + 14


for c in CARDS:
    drill_h[c["k"]] = drill_layout(c)[1]
DRILL_H = max(drill_h.values())
for c in CARDS:
    k = c["k"]
    frags, _h = drill_layout(c)
    eb = f"Drill path · {PAGE[c['page']]}".upper()
    add(f"Drill SVG {k}", f"""
VAR _st         = [Card Status {k}]
{STATUS_VARS}
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{DW}' height='{DRILL_H}' viewBox='0 0 {DW} {DRILL_H}' {FONT}>"
        & "<rect x='0.5' y='0.5' width='{DW - 1}' height='{DRILL_H - 1}' rx='15.5' fill='#FFFFFF' stroke='{C['line']}'/>"
        & "<text x='24' y='34' font-size='10.5' font-weight='600' fill='{C['muted']}' letter-spacing='0.6'>{xml(eb)}</text>"
        & "<text x='24' y='58' font-size='18' font-weight='600' fill='{C['ink']}'>{xml(c['title'])}</text>"
        & "<text x='{DW - 24}' y='58' text-anchor='end' font-size='14' font-weight='600' fill='" & _ink & "'>" & _word & "</text>"
        & {concat_static(frags)}
        & "</svg>"
{ENC}""", None, "8 Cards SVG", True, desc=f"{k} drill path pop-up (tooltip page tt_drill): drill page and 4 steps, text only (E-58).", cat="ImageUrl")
dispatch("KPI Drill SVG", "Drill SVG {k}", "Drill path pop-up of the KPI in context (tt_drill).", cat="ImageUrl")

# status-chip rule tooltip (v5 data-tip on .st)
RW = 300
rule_lines = {c["k"]: wrap(c["rule"], RW - 24, 12.5) for c in CARDS}
RULE_H = 12 + 18 + 18 * max(len(v) for v in rule_lines.values()) + 10
for c in CARDS:
    k = c["k"]
    frags = text_lines(rule_lines[k], 12, 48, 18, 12.5, C["ink"])
    add(f"Rule SVG {k}", f"""
VAR _st         = [Card Status {k}]
{STATUS_VARS}
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{RW}' height='{RULE_H}' viewBox='0 0 {RW} {RULE_H}' {FONT}>"
        & "<rect x='0.5' y='0.5' width='{RW - 1}' height='{RULE_H - 1}' rx='11.5' fill='#FFFFFF' stroke='{C['line']}'/>"
        & "<text x='12' y='28' font-size='12.5' font-weight='600' fill='{C['ink']}'>{xml(c['title'])} · <tspan fill='" & _ink & "'>" & _glyph & " " & _word & "</tspan></text>"
        & {concat_static(frags)}
        & "</svg>"
{ENC}""", None, "8 Cards SVG", True, desc=f"{k} status-chip tooltip: status word and the rule (E-21, E-22).", cat="ImageUrl")
dispatch("KPI Rule SVG", "Rule SVG {k}", "Status-chip tooltip of the KPI in context (tt_rule).", cat="ImageUrl")

# ---------------------------------------------------------------- header (E-51)
HW, HH = 1336, 52
brand_w = max(text_width("Nordmark Retail", 18, True), text_width("Executive dashboard", 12))
MX = round(brand_w + 18, 1)


def bold_runs_dax(var):
    """'**x**' markers in a dynamic text -> tspans (alternate)."""
    return (f"SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( {var}, \"&\", \"&amp;\" ), \"**\", \"<tspan font-weight='600' fill='{C['ink']}'>\", 1 ), "
            f"\"**\", \"</tspan>\", 1 )")


add("Header SVG", f"""
VAR _p          = [Header Period Text]
VAR _c          = [Header Comparator Text]
VAR _r          = [Header Region Text]
VAR _p1         = {bold_runs_dax("_p")}
VAR _c1         = {bold_runs_dax("_c")}
VAR _r1         = {bold_runs_dax("_r")}
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{HW}' height='{HH}' viewBox='0 0 {HW} {HH}' {FONT}>"
        & "<text x='0' y='21' font-size='18' font-weight='600' fill='{C['ink']}' letter-spacing='-0.2'>Nordmark Retail</text>"
        & "<text x='0' y='38' font-size='12' fill='{C['muted']}'>Executive dashboard</text>"
        & "<line x1='{MX}' y1='14' x2='{MX}' y2='34' stroke='{C['line']}'/>"
        & "<text x='{MX + 18}' y='29' font-size='13' fill='{C['muted']}'>" & _p1 & "<tspan dx='18'>" & _c1 & "</tspan><tspan dx='18'>" & _r1 & "</tspan></text>"
        & "<text x='{HW}' y='29' text-anchor='end' font-size='12' fill='{C['muted']}'>" & [Refreshed Text] & "</text>"
        & "<line x1='0' y1='{HH - 0.5}' x2='{HW}' y2='{HH - 0.5}' stroke='{C['line']}'/>"
        & "</svg>"
{ENC}""", None, "8 Cards SVG", desc="Header (E-51): brand, period · comparator · region line, refresh stamp, bottom rule.", cat="ImageUrl")

# ---------------------------------------------------------------- status line (E-25, E-26, E-56)
# window status pack in one frame (perf pass 2026-10-30): item window and region read once, the 12 statuses computed with the
# slicer tables cleared and the region as a dim_store filter (twin of [Window Status Pack])
from frame import CLEAR  # noqa: E402
PACK = ("VAR _k          = [_Item Key]\n"
        "VAR _it         = CALCULATETABLE ( dim_item, REMOVEFILTERS ( dim_item ), dim_item[item_key] = _k )\n"
        "VAR _s          = MAXX ( _it, dim_item[start_index] )\n"
        "VAR _e          = MAXX ( _it, dim_item[end_index] )\n"
        "VAR _sc         = [_Scope Code]\n"
        "VAR _pk        =\n"
        "    CALCULATE (\n"
        "        CALCULATE ( [Status Pack], REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _s, dim_week[sort_index] <= _e )"
        + CLEAR + "\n    ) + 0")
SW, SH = 1336, 32


def pill_w(fmt):
    return ", ".join(f"{n}, {round(text_width(fmt.format(n=n), 12, True) + 20 + 6, 1)}" for n in range(0, 13))


add("Status Line SVG", f"""
{PACK}
VAR _on         = INT ( _pk / 1000 )
VAR _watch      = INT ( MOD ( _pk, 1000 ) / 100 )
VAR _offc       = INT ( MOD ( _pk, 100 ) / 10 )
VAR _dot        = MOD ( _pk, 10 )
VAR _dc         = SWITCH ( _dot, 1, "{C['dot_green']}", 2, "{C['dot_orange']}", 3, "{C['dot_red']}", "{C['col']}" )
VAR _w1         = SWITCH ( _on, {pill_w("▲ {n} on track")}, 110 )
VAR _w2         = SWITCH ( _watch, {pill_w("● {n} watch")}, 90 )
VAR _w3         = SWITCH ( _offc, {pill_w("▼ {n} off track")}, 110 )
VAR _x2         = 24 + _w1 + 6
VAR _x3         = _x2 + _w2 + 6
VAR _rev        = [Revealed Count]
VAR _picks      = SUBSTITUTE ( [Filter Picks Text], "&", "&amp;" )
VAR _pill       = "' y='4' height='24' rx='12' fill='"
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{SW}' height='{SH}' viewBox='0 0 {SW} {SH}' {FONT}>"
        & "<circle cx='7' cy='16' r='7' fill='" & _dc & "'/>"
        & "<rect x='24' width='" & FORMAT ( _w1, "0.0" ) & _pill & "{C['goodT']}'/>"
        & "<text x='" & FORMAT ( 24 + _w1 / 2, "0.0" ) & "' y='20.5' text-anchor='middle' font-size='12' font-weight='600' fill='{C['good']}'>▲ " & _on & " on track</text>"
        & "<rect x='" & FORMAT ( _x2, "0.0" ) & "' width='" & FORMAT ( _w2, "0.0" ) & _pill & "{C['watchT']}'/>"
        & "<text x='" & FORMAT ( _x2 + _w2 / 2, "0.0" ) & "' y='20.5' text-anchor='middle' font-size='12' font-weight='600' fill='{C['watch']}'>● " & _watch & " watch</text>"
        & "<rect x='" & FORMAT ( _x3, "0.0" ) & "' width='" & FORMAT ( _w3, "0.0" ) & _pill & "{C['offT']}'/>"
        & "<text x='" & FORMAT ( _x3 + _w3 / 2, "0.0" ) & "' y='20.5' text-anchor='middle' font-size='12' font-weight='600' fill='{C['off']}'>▼ " & _offc & " off track</text>"
        & "<text x='{SW}' y='20.5' text-anchor='end' font-size='12' fill='{C['muted']}'><tspan font-weight='500' fill='{C['ink']}'>" & _rev & " of 12 metrics</tspan> · " & _picks & "</text>"
        & "</svg>"
{ENC}""", None, "8 Cards SVG", desc="Status line: overall dot (static, E-26), three count pills (E-25), n of 12 metrics · picks (E-56).", cat="ImageUrl")

add("Filter Badge SVG", f"""
VAR _n          = [Filter Pick Count]
VAR _svg        =
    IF (
        _n > 0
        ,"<svg xmlns='http://www.w3.org/2000/svg' width='18' height='16' viewBox='0 0 18 16' {FONT}><rect x='0' y='0' width='18' height='16' rx='8' fill='{C['acc']}'/>"
            & "<text x='9' y='12' text-anchor='middle' font-size='10' font-weight='600' fill='#FFFFFF'>" & _n & "</text></svg>"
        ,"<svg xmlns='http://www.w3.org/2000/svg' width='18' height='16' viewBox='0 0 18 16'></svg>"
    )
{ENC}""", None, "8 Cards SVG", desc="Side-bar badge: active attribute picks; empty when none (E-52).", cat="ImageUrl")

# dot tooltip (view.ts status.dotTip): static text pre-wrapped with {tokens}
DTW = 320
DOT_TEXT = ("**Overall: {word}** · computed over {over}, filters ignored. Red if off track ≥ 1/3 · else orange if watch + off track > 50% · "
            "else green if on track ≥ 2/3 · else orange. Now: off track {off} ({offp}), watch + off {wo} ({wop}), on track {on} ({onp}).")
dot_lines = wrap(DOT_TEXT, DTW - 24, 12.5, token_px={"{word}": 40, "{over}": 72, "{off}": 8, "{offp}": 26, "{wo}": 8, "{wop}": 26,
                                                     "{on}": 8, "{onp}": 26})
DOT_H = 12 + 18 * len(dot_lines) + 12 + 18
dot_frags = text_lines(dot_lines, 12, 12 + 13, 18, 12.5, C["ink"])
grey_lines = wrap("**Overall: grey** · no rated card.", DTW - 24, 12.5)
grey_frags = text_lines(grey_lines, 12, 12 + 13, 18, 12.5, C["ink"])
add("Dot SVG", f"""
{PACK}
VAR _on         = INT ( _pk / 1000 )
VAR _watch      = INT ( MOD ( _pk, 1000 ) / 100 )
VAR _offc       = INT ( MOD ( _pk, 100 ) / 10 )
VAR _n          = _on + _watch + _offc
VAR _dot        = MOD ( _pk, 10 )
VAR _word       = SWITCH ( _dot, 1, "green", 2, "orange", 3, "red", "orange" )
VAR _over       = IF ( _n = 12, "all 12 cards", "the " & _n & " cards with a status (N/A excluded)" )
VAR _body       = {concat_static(dot_frags)}
VAR _grey       = {concat_static(grey_frags)}
VAR _txt        =
    SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _body
        ,"{{word}}", _word ), "{{over}}", _over ), "{{offp}}", FORMAT ( DIVIDE ( 100 * _offc, _n ), "0" ) & "%" )
        ,"{{wop}}", FORMAT ( DIVIDE ( 100 * ( _watch + _offc ), _n ), "0" ) & "%" ), "{{onp}}", FORMAT ( DIVIDE ( 100 * _on, _n ), "0" ) & "%" )
        ,"{{off}}", _offc ), "{{wo}}", _watch + _offc ), "{{on}}", _on )
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{DTW}' height='{DOT_H}' viewBox='0 0 {DTW} {DOT_H}' {FONT}>"
        & IF (
            _n = 0
            ,"<rect x='0.5' y='0.5' width='{DTW - 1}' height='{12 + 18 * len(grey_lines) + 11}' rx='11.5' fill='#FFFFFF' stroke='{C['line']}'/>" & _grey
            ,"<rect x='0.5' y='0.5' width='{DTW - 1}' height='{12 + 18 * len(dot_lines) + 11}' rx='11.5' fill='#FFFFFF' stroke='{C['line']}'/>" & _txt
        )
        & "</svg>"
{ENC}""", None, "8 Cards SVG", desc="Overall-dot tooltip (tt_dot): rule and current shares over the rated cards; grey, no rated card, when none has a status (E-26, E-95; js-exec view.ts dotView).", cat="ImageUrl")

# ---------------------------------------------------------------- How to read (view.ts how())
PW = 580
how_frags, y = [], 92
for bl in HOW:
    lines = wrap(bl, PW - 48 - 18, 13, token_px={"{cmp}": 62})
    how_frags.append(f"<circle cx='30' cy='{y - 4}' r='2.2' fill='{C['ink']}'/>")
    how_frags += text_lines(lines, 42, y, 19.5, 13, C["ink"])
    y += 19.5 * len(lines) + 6
HOW_H = int(y + 6 + 40)
how_frags.append(f"<line x1='24' y1='{y + 6}' x2='{PW - 24}' y2='{y + 6}' stroke='#EDEEF0'/>")
how_frags.append(f"<text x='24' y='{y + 30}' font-size='12.5' fill='{C['muted']}'>Illustrative data</text>")
add("How To Read SVG", f"""
VAR _cmp        = SWITCH ( [_Comparator Code], "LY", "Last year", "LW", "Previous", "Budget" )
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='{PW}' height='{HOW_H}' viewBox='0 0 {PW} {HOW_H}' {FONT}>"
        & "<rect x='0.5' y='0.5' width='{PW - 1}' height='{HOW_H - 1}' rx='15.5' fill='#FFFFFF' stroke='{C['line']}'/>"
        & "<text x='24' y='36' font-size='10.5' font-weight='600' fill='{C['muted']}' letter-spacing='0.6'>" & UPPER ( "Nordmark · " & [Item Title] ) & "</text>"
        & "<text x='24' y='60' font-size='18' font-weight='600' fill='{C['ink']}'>How to read this page</text>"
        & "<circle cx='{PW - 40}' cy='36' r='15.5' fill='#FFFFFF' stroke='{C['chip_line']}'/>"
        & SUBSTITUTE ( {concat_static(how_frags)}, "{{cmp}}", _cmp )
        & "<text x='{PW - 24}' y='{y + 30}' text-anchor='end' font-size='12.5' font-weight='500' fill='{C['ink']}'>" & [Refreshed Text] & "</text>"
        & "</svg>"
{ENC}""", None, "8 Cards SVG", desc="How to read pop-up: the six bullets of js-exec view.ts how() (E-58).", cat="ImageUrl")

SIZES = dict(INFO_H=INFO_H, DRILL_H=DRILL_H, RULE_H=RULE_H, DOT_H=DOT_H, HOW_H=HOW_H, IW=IW, DW=DW, RW=RW, DTW=DTW, PW=PW)

add("Dot Hit", "UNICHAR ( 160 )", None, "8 Cards", desc="Invisible value of the overall-dot hover target (tt_dot).")

for nm, col, d in [("_Chip Fill Selected", C["accSel"], "fill"), ("_Chip Line Selected", C["accLine"], "outline"), ("_Chip Font Selected", C["acc"], "text")]:
    add(nm, f'"{col}"', None, "9 Engine", True, desc=f"Filters menu chip {d} colour of a picked item (selected state of the button slicers, cobalt accent).")

# Filters menu: live summary under the period picker (E-90; js-exec Layers.tsx "Showing" + header period line)
add("Menu Showing SVG", f"""
VAR _p          = [Header Period Text]
VAR _p1         = {bold_runs_dax("_p")}
VAR _svg        =
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='18' viewBox='0 0 320 18' {FONT}>"
        & "<text x='0' y='13' font-size='12' fill='{C['muted']}'>Showing " & _p1 & "</text>"
        & "</svg>"
{ENC}""", None, "8 Cards SVG", desc="Filters menu: live summary under the period picker = the header period line (E-90; js-exec menu showing).", cat="ImageUrl")

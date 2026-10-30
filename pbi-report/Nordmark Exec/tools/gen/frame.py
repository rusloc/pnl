"""Perf pass 2026-10-30 (USER targets: card <= 1.0 s, i pop-up <= 3.0 s cold): one frame per SVG measure.

The slicers are read once (picked item row, type, comparator, region, attribute state). The face is then built inside one
CALCULATE that clears every slicer table and turns the region into a dim_store filter, so the scoped leaf sums run their plain
branch and the plan carries no disconnected-table filters. Every window CALCULATE is hoisted into one VAR (measures.Hoist),
so the plan holds each subtree once. A real dimension filter (dim_category, next round) passes through untouched."""
import re

import fmt as F
from copy_v5 import ATTRS
from measures import KPIS, VALUE, BASIS, UNIT, W, LY, LW, value_text, delta_text, CAT_NA, CAT_NA_DELTA
from copy_v5 import TS

CAT_NOTE = TS["CATEGORY_COPY"]["note"]  # js-exec CATEGORY_COPY.note: one-line i note of a card the pick cannot split

LOCAL = {"[_Granularity Code]": "_gr", "[_Comparator Code]": "_cmp", "[_Prev Short]": "_pshort", "[Window Noun]": "_noun",
         "[Period Phrase]": "_phrase", "[Region Phrase]": "_rph", "[Period No]": "_pno", "[_EB Prev Name]": "_nm"}
# measures that read a slicer table (directly or through the picked item): never referenced inside the cleared body
SLICER_READERS = {"_Item Key", "_Granularity Code", "_Comparator Code", "_Scope Code", "_Prev Short", "Window Noun", "Period Phrase",
                  "Region Phrase", "Period No", "_EB Prev Name", "Item Title", "Header Period Text", "Header Comparator Text",
                  "Header Region Text", "_Window Start", "_Window End", "_LY Window Start", "_LY Window End", "_Prev Window Start",
                  "_Prev Window End", "_EB Prev Start", "_EB Prev End", "_Item Sort", "Revealed Count", "Filter Picks Text"}


def localize(expr):
    for a, b in LOCAL.items():
        expr = expr.replace(a, b)
    return expr


def assert_clean(name, body):
    """No slicer-reading measure and no card-layer measure (they re-resolve the item) inside the cleared body."""
    refs = set(re.findall(r"\[([^\]@]+)\]", body))
    bad = sorted(r for r in refs if r in SLICER_READERS or r.startswith(("Card ", "KPI ")))
    assert not bad, (name, bad)


def frame(k, info=False):
    eb = k == "EBITDA"
    ps, pe = ("eb_prev_start", "eb_prev_end") if eb else ("prev_start", "prev_end")
    L = ["VAR _k          = [_Item Key]",
         "VAR _it         = CALCULATETABLE ( dim_item, REMOVEFILTERS ( dim_item ), dim_item[item_key] = _k )",
         "VAR _s          = MAXX ( _it, dim_item[start_index] )",
         "VAR _e          = MAXX ( _it, dim_item[end_index] )",
         "VAR _ls         = MAXX ( _it, dim_item[ly_start] )",
         "VAR _le         = MAXX ( _it, dim_item[ly_end] )",
         f"VAR _s2         = MAXX ( _it, dim_item[{ps}] )",
         f"VAR _e2         = MAXX ( _it, dim_item[{pe}] )",
         "VAR _iso        = MAXX ( _it, dim_item[sort_order] )",
         "VAR _phrase     = MAXX ( _it, dim_item[phrase] )",
         "VAR _gr         = [_Granularity Code]",
         "VAR _cmp        = [_Comparator Code]",
         "VAR _sc         = [_Scope Code]",
         "VAR _pshort     = [_Prev Short]",
         "VAR _noun       = [Window Noun]",
         "VAR _rph        = [Region Phrase]",
         f"VAR _rev        = [Card Revealed {k}]",
         "VAR _pno        = CALCULATE ( MAX ( dim_week[period] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )",
         "VAR _cact       = [_Category Active]",
         f"VAR _cna        = {CAT_NA[k].replace('[_Category Active]', '_cact') if k in CAT_NA else 'FALSE ()'}"]
    if info and k in ("GMROI", "SELL_THROUGH"):
        # the first two categories of the pick in menu order (the seasonal ones for sell-through; js-exec gmroiStat / seasonalStats)
        sf = ", dim_category[is_seasonal] = TRUE ()" if k == "SELL_THROUGH" else ""
        L += [f"VAR _so1        = CALCULATE ( MIN ( dim_category[sort_order] ){sf} )",
              f"VAR _so2        = CALCULATE ( MIN ( dim_category[sort_order] ){sf}, dim_category[sort_order] > _so1 )",
              "VAR _pc1        = CALCULATE ( MAX ( dim_category[category_code] ), dim_category[sort_order] = _so1 )",
              "VAR _pc2        = CALCULATE ( MAX ( dim_category[category_code] ), dim_category[sort_order] = _so2 )",
              "VAR _pn1        = CALCULATE ( MAX ( dim_category[category_name] ), dim_category[sort_order] = _so1 )",
              "VAR _pn2        = CALCULATE ( MAX ( dim_category[category_name] ), dim_category[sort_order] = _so2 )",
              "VAR _pk         = IF ( ISBLANK ( _so1 ), 0, IF ( ISBLANK ( _so2 ), 1, 2 ) )"]
    if eb:
        L.append("VAR _nm         = MAXX ( _it, dim_item[eb_prev_name] )")
    if info:
        L += ["VAR _wpk        = CALCULATE ( MAX ( dim_week[period_key] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )",
              "VAR _wq         = CALCULATE ( MAX ( dim_week[quarter] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )",
              "VAR _wfy        = CALCULATE ( MAX ( dim_week[fy] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )",
              "VAR _wps        = CALCULATE ( MIN ( dim_week[sort_index] ), REMOVEFILTERS ( dim_week ), dim_week[period_key] = _wpk )",
              "VAR _wqs        = CALCULATE ( MIN ( dim_week[sort_index] ), REMOVEFILTERS ( dim_week ), dim_week[fy] = _wfy, dim_week[quarter] = _wq )",
              "VAR _wys        = CALCULATE ( MIN ( dim_week[sort_index] ), REMOVEFILTERS ( dim_week ), dim_week[fy] = _wfy )",
              'VAR _ps         = IF ( _gr = "W", _wps, _s )']
    return "\n".join(L)


CLEAR = ("".join(f"\n        ,REMOVEFILTERS ( {t} )" for t in ["param_region", "param_granularity", "dim_item", "param_comparator"]
                 + [f"param_attr_{a}" for a, _l, _v in ATTRS])
         + '\n        ,FILTER ( ALL ( dim_store[scope_code] ), _sc = "ALL" || dim_store[scope_code] = _sc )')


def wrap_body(name, frame_txt, body_lines, ret):
    """frame VARs, then RETURN CALCULATE ( VAR <body> RETURN <ret>, <clear the slicers, region as a dim_store filter> )."""
    body = "\n".join(body_lines) + "\nRETURN\n    " + ret
    assert_clean(name, body)
    ind = "\n".join(("        " + l) if l.strip() else l for l in body.split("\n"))
    return f"{frame_txt}\nRETURN\n    CALCULATE (\n{ind}{CLEAR}\n    )"


# status badness over the frame values (twins of BADNESS in measures.py: _v = card value, _b = status basis)
BAD_VB = {"NET_SALES": "IF ( _b <> 0, 1 - DIVIDE ( _v, _b ) )", "EBITDA": "IF ( _b <> 0, 1 - DIVIDE ( _v, _b ) )",
          "TOTAL_MARGIN": "IF ( NOT ISBLANK ( _v ) && NOT ISBLANK ( _b ), _b - _v )",
          "LFL_GROWTH": "IF ( NOT ISBLANK ( _v ) && NOT ISBLANK ( _b ), _b - _v )",
          "FRONT_GM": "IF ( NOT ISBLANK ( _v ) && NOT ISBLANK ( _b ), _b - _v )",
          "MARKDOWN": "IF ( NOT ISBLANK ( _v ) && NOT ISBLANK ( _b ), _v - _b )",
          "WEEKS_OF_COVER": "IF ( NOT ISBLANK ( _v ), ABS ( _v - _b ) )",
          "AVAILABILITY": "IF ( NOT ISBLANK ( _v ), _b - _v )", "SELL_THROUGH": "IF ( NOT ISBLANK ( _v ), _b - _v )",
          "GMROI": "IF ( NOT ISBLANK ( _v ), _b - _v )", "SUPPLIER_OTIF": "IF ( NOT ISBLANK ( _v ), _b - _v )",
          "CHANNEL_MIX": "IF ( NOT ISBLANK ( _mp1 ), ABS ( _mpp ) )"}
MIX = [("1", "Store"), ("2", "Online"), ("3", "Wholesale")]


def core(k, info=False):
    """Value, basis, comparator, status and the card texts once per measure: twins of Card Value / Basis / Compare / Status /
    Value Text / Unit Text / Delta Text (/ Basis Text, Delta Long Text EBITDA) {k}, same DAX formats. Returns VAR lines."""
    v, b = VALUE[k], BASIS[k]
    L = [f"VAR _v          = {W(f'[{v}]')}", f"VAR _b          = {W(f'[{b}]')}"]
    with F.side_counter():
        vt, ut = value_text(UNIT[k])
        bt, _u = value_text(UNIT[k], "_b")
        if k == "CHANNEL_MIX":
            for i, c in MIX:
                L.append(f"VAR _mv{i}        = {W(f'[Mix {c} %]')}")
                L.append(f"VAR _mp{i}        = {W(f'[Mix {c} % Bud]')}")
            for i, c in MIX:
                L.append(f"VAR _mc{i}        = SWITCH ( _cmp, \"LY\", {LY(f'[Mix {c} %]')}, \"LW\", {LW(f'[Mix {c} %]')}, _mp{i} )")
            for i, _c in MIX:
                L.append(f"VAR _mq{i}        = _mv{i} - _mc{i}")
                L.append(f"VAR _mr{i}        = _mv{i} - _mp{i}")
            pick = lambda x: (f"SWITCH ( TRUE (), ABS ( _{x}1 ) >= ABS ( _{x}2 ) && ABS ( _{x}1 ) >= ABS ( _{x}3 ), 1, "
                              f"ABS ( _{x}2 ) >= ABS ( _{x}3 ), 2, 3 )")
            L += [f"VAR _j          = {pick('mq')}",
                  "VAR _dpp        = SWITCH ( _j, 1, _mq1, 2, _mq2, _mq3 )",
                  f"VAR _jp         = {pick('mr')}",
                  "VAR _mpp        = SWITCH ( _jp, 1, _mr1, 2, _mr2, _mr3 )",
                  'VAR _lab        = SWITCH ( _cmp, "LY", "vs LY", "LW", _pshort, "vs plan" )',
                  f'VAR _dt         = IF ( ISBLANK ( _mc1 ) || ISBLANK ( _mv1 ), "n/a " & _lab, '
                  f'SWITCH ( _j, 1, "store", 2, "online", "wholesale" ) & " " & {F.pp("_dpp", na=False)} & " " & _lab )']
        else:
            lab, body = delta_text(k, "_cmp", "_gr", "_pshort")
            L += [f"VAR _c          = SWITCH ( _cmp, \"LY\", {LY(f'[{v}]')}, \"LW\", {LW(f'[{v}]')}, _b )",
                  "VAR _d          = _v - _c",
                  f"VAR _lab        = {lab}",
                  f'VAR {"_dtn" if k in CAT_NA else "_dt "}        = IF ( ISBLANK ( _v ) || ISBLANK ( _c ), "n/a " & _lab, {body} )']
            if k in CAT_NA:
                L.append(f'VAR _dt         = IF ( _cna, "{CAT_NA_DELTA}", _dtn )')
        L += [f"VAR _bad        = {BAD_VB[k]}",
              f'VAR _sw         = LOOKUPVALUE ( param_status_rule[watch_from], param_status_rule[rule_code], "{k}" )',
              f'VAR _so         = LOOKUPVALUE ( param_status_rule[off_from], param_status_rule[rule_code], "{k}" )',
              "VAR _rb         = ROUND ( _bad, 10 )",
              "VAR _st         = IF ( NOT ISBLANK ( _bad ), SWITCH ( TRUE (), _rb <= _sw, 1, _rb <= _so, 2, 3 ) )",
              f'VAR _val        = IF ( _cna, "–", IF ( ISBLANK ( _v ), "n/a", {vt} ) )',
              f'VAR _unit       = IF ( ISBLANK ( _v ), "", {ut} )']

        if info:
            L.append(f'VAR _bt         = IF ( ISBLANK ( _b ), "n/a", {bt} )')
            if k == "EBITDA":
                L.append(f'VAR _dlong      = IF ( _cmp = "LW" && _gr = "W" && _nm <> "" && NOT _cna, IF ( ISBLANK ( _v ) || ISBLANK ( _c ), "n/a vs " & _nm, '
                         f'{F.eurDelta("_d", na=False)} & " (" & {F.pctSigned("DIVIDE ( _v, _c ) - 1", na=False)} & ") vs " & _nm ), _dt )')
            else:
                L.append("VAR _dlong      = _dt")
    return L

"""dim_item: the period-model items as a calculated table from dim_week (ADR-0013 (k), exec-period-model.md §2, §7; E-91, E-92).

One row per item of Week (95), Month (22), Quarter (8) and Year (2) at the shipped data: item weeks within actuals (<= the as-of
week of manifest.json), labels, the header line, and every comparator window as sort_index bounds."""

COLS = [  # name, dataType, hidden, description
    ("item_key", "string", True, "FY2026-W43 (= week_key) · FY2026-P10 (= period_key) · FY2026-Q4 · FY2026."),
    ("granularity_code", "string", True, "W, P (Month), Q or FY; joins param_granularity."),
    ("fy", "int64", True, "Fiscal year."),
    ("fy_label", "string", False, "FY2025 / FY2026: the fiscal-year row of the period picker."),
    ("n", "int64", True, "Week / month (period) / quarter number in the FY; 0 for a year."),
    ("label", "string", False, "Picker chip: W43 · P10 · Q4 · Q4 · to date · FY2025 · FY2026 · to date (E-91, E-92)."),
    ("label_wide", "string", False, "Copy of label for the wide Quarter / Year chip row (menu_item_wide), so its selection is independent of the Week / Month grid."),
    ("label_order", "int64", True, "Sort order of label (n, or the FY at Year)."),
    ("title", "string", True, "Week 43 · Month 10 · Quarter 4 · FY2026, + FY2025 when not the as-of FY (E-98)."),
    ("phrase", "string", True, "Sub-title phrase: week 43 · month 10 · quarter 4 to date · FY2026 to date (E-92)."),
    ("header", "string", True, "Header period line, ** = bold: **Week 43** · 19–25 Oct 2026, **Quarter 4** to date · 28 Sep–25 Oct 2026 (E-51, E-98)."),
    ("start_index", "int64", True, "First dim_week sort_index of the window."),
    ("end_index", "int64", True, "Last sort_index of the window (item end, capped at the as-of week)."),
    ("weeks", "int64", True, "Weeks in the window (k)."),
    ("size", "int64", True, "Weeks of the complete item (1 / 4-5 / 13 / 52)."),
    ("is_partial", "boolean", True, "The item's last week is after the as-of week: named to date (E-92)."),
    ("sort_order", "int64", True, "Position among the items of the type, 1 = the first item of the data (bars, previous item)."),
    ("ly_start", "int64", True, "LY window start: the start week one year back by ly_week_key (E-12); blank in FY2025."),
    ("ly_end", "int64", True, "LY window end; blank in FY2025."),
    ("prev_start", "int64", True, "Previous item (E-94): lw_week_key at Week; else the item before, cut to this item's weeks when partial; blank for the first item."),
    ("prev_end", "int64", True, "Previous-item window end."),
    ("eb_prev_start", "int64", True, "EBITDA flash vs Previous (E-93, ET-31): at Week the previous month's first k weeks (k = week of the month); blank for week 5 of a 5-week month and the first month; else = prev_start."),
    ("eb_prev_end", "int64", True, "EBITDA Previous window end."),
    ("eb_prev_name", "string", True, "At Week: P9 weeks 1–4 / P12 FY2025 week 1 (the i delta line); else empty."),
]

DAX = """VAR _asof =
    MAXX ( FILTER ( dim_week, dim_week[week_key] = MAX ( meta_dataset[current_week_key] ) ), dim_week[sort_index] )
VAR _afy        = MAXX ( FILTER ( dim_week, dim_week[sort_index] = _asof ), dim_week[fy] )
VAR _act        = FILTER ( dim_week, dim_week[is_actual] && dim_week[sort_index] <= _asof )
VAR _wk =
    SELECTCOLUMNS (
        _act
        ,"item_key", dim_week[week_key]
        ,"granularity_code", "W"
        ,"fy", dim_week[fy]
        ,"n", dim_week[week_of_fy]
        ,"start_index", dim_week[sort_index]
        ,"end_index", dim_week[sort_index]
        ,"size", 1
    )
VAR _pe =
    SELECTCOLUMNS (
        SUMMARIZE ( _act, dim_week[period_key], dim_week[fy], dim_week[period] )
        ,"item_key", dim_week[period_key]
        ,"granularity_code", "P"
        ,"fy", dim_week[fy]
        ,"n", dim_week[period]
        ,"start_index", CALCULATE ( MIN ( dim_week[sort_index] ) )
        ,"end_index", MIN ( CALCULATE ( MAX ( dim_week[sort_index] ) ), _asof )
        ,"size", CALCULATE ( COUNTROWS ( dim_week ) )
    )
VAR _qu =
    SELECTCOLUMNS (
        SUMMARIZE ( _act, dim_week[fy], dim_week[quarter] )
        ,"item_key", "FY" & dim_week[fy] & "-Q" & dim_week[quarter]
        ,"granularity_code", "Q"
        ,"fy", dim_week[fy]
        ,"n", dim_week[quarter]
        ,"start_index", CALCULATE ( MIN ( dim_week[sort_index] ) )
        ,"end_index", MIN ( CALCULATE ( MAX ( dim_week[sort_index] ) ), _asof )
        ,"size", CALCULATE ( COUNTROWS ( dim_week ) )
    )
VAR _yr =
    SELECTCOLUMNS (
        SUMMARIZE ( _act, dim_week[fy] )
        ,"item_key", "FY" & dim_week[fy]
        ,"granularity_code", "FY"
        ,"fy", dim_week[fy]
        ,"n", 0
        ,"start_index", CALCULATE ( MIN ( dim_week[sort_index] ) )
        ,"end_index", MIN ( CALCULATE ( MAX ( dim_week[sort_index] ) ), _asof )
        ,"size", CALCULATE ( COUNTROWS ( dim_week ) )
    )
VAR _base       = UNION ( _wk, _pe, _qu, _yr )
VAR _r1 =
    ADDCOLUMNS (
        _base
        ,"weeks", [end_index] - [start_index] + 1
        ,"is_partial", [end_index] - [start_index] + 1 < [size]
        ,"sort_order", VAR _g = [granularity_code] VAR _st = [start_index] RETURN COUNTROWS ( FILTER ( _base, [granularity_code] = _g && [start_index] <= _st ) )
    )
VAR _r2 =
    ADDCOLUMNS (
        _r1
        ,"@d0", VAR _i = [start_index] RETURN MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[week_start] )
        ,"@d1", VAR _i = [end_index] RETURN MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[week_end] )
        ,"ly_start", VAR _i = [start_index] VAR _k = MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[ly_week_key] )
            RETURN MAXX ( FILTER ( dim_week, dim_week[week_key] = _k ), dim_week[sort_index] )
        ,"ly_end", VAR _i = [end_index] VAR _k = MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[ly_week_key] )
            RETURN MAXX ( FILTER ( dim_week, dim_week[week_key] = _k ), dim_week[sort_index] )
        ,"@lw", VAR _i = [start_index] VAR _k = MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[lw_week_key] )
            RETURN MAXX ( FILTER ( dim_week, dim_week[week_key] = _k ), dim_week[sort_index] )
        ,"@pk", VAR _i = [start_index] RETURN MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[period_key] )
        ,"@wop", VAR _i = [start_index] RETURN MAXX ( FILTER ( dim_week, dim_week[sort_index] = _i ), dim_week[week_of_period] )
    )
VAR _r3 =
    ADDCOLUMNS (
        _r2
        ,"@ps", VAR _g = [granularity_code] VAR _o = [sort_order]
            RETURN IF ( _g = "W", [@lw], MAXX ( FILTER ( _r1, [granularity_code] = _g && [sort_order] = _o - 1 ), [start_index] ) )
        ,"@pe", VAR _g = [granularity_code] VAR _o = [sort_order]
            RETURN IF ( _g = "W", [@lw], MAXX ( FILTER ( _r1, [granularity_code] = _g && [sort_order] = _o - 1 ), [end_index] ) )
        ,"@mo", VAR _pk = [@pk] RETURN MAXX ( FILTER ( _r1, [granularity_code] = "P" && [item_key] = _pk ), [sort_order] )
    )
VAR _r4 =
    ADDCOLUMNS (
        _r3
        ,"prev_start", [@ps]
        ,"prev_end", IF ( ISBLANK ( [@ps] ), BLANK (), IF ( [is_partial], [@ps] + [weeks] - 1, [@pe] ) )
        ,"@ms", VAR _o = [@mo] - 1 RETURN MAXX ( FILTER ( _r1, [granularity_code] = "P" && [sort_order] = _o ), [start_index] )
        ,"@mw", VAR _o = [@mo] - 1 RETURN MAXX ( FILTER ( _r1, [granularity_code] = "P" && [sort_order] = _o ), [weeks] )
        ,"@mn", VAR _o = [@mo] - 1 RETURN MAXX ( FILTER ( _r1, [granularity_code] = "P" && [sort_order] = _o ), [n] )
        ,"@mf", VAR _o = [@mo] - 1 RETURN MAXX ( FILTER ( _r1, [granularity_code] = "P" && [sort_order] = _o ), [fy] )
    )
VAR _r5 =
    ADDCOLUMNS (
        _r4
        ,"@ok", [granularity_code] = "W" && NOT ISBLANK ( [@ms] ) && [@mw] >= [@wop]
        ,"@title", IF ( [granularity_code] = "FY", "FY" & [fy], SWITCH ( [granularity_code], "W", "Week ", "P", "Month ", "Quarter " ) & [n] & IF ( [fy] <> _afy, " FY" & [fy], "" ) )
        ,"@dates",
            IF (
                YEAR ( [@d0] ) <> YEAR ( [@d1] )
                ,FORMAT ( [@d0], "d mmm yyyy" )
                ,IF ( MONTH ( [@d0] ) <> MONTH ( [@d1] ), FORMAT ( [@d0], "d mmm" ), FORMAT ( [@d0], "d" ) )
            ) & "–" & FORMAT ( [@d1], "d mmm yyyy" )
    )
RETURN
    SELECTCOLUMNS (
        _r5
        ,"item_key", [item_key]
        ,"granularity_code", [granularity_code]
        ,"fy", [fy]
        ,"fy_label", "FY" & [fy]
        ,"n", [n]
        ,"label", IF ( [granularity_code] = "FY", "FY" & [fy], [granularity_code] & [n] ) & IF ( [is_partial], " · to date", "" )
        ,"label_wide", IF ( [granularity_code] = "FY", "FY" & [fy], [granularity_code] & [n] ) & IF ( [is_partial], " · to date", "" )
        ,"label_order", IF ( [granularity_code] = "FY", [fy], [n] )
        ,"title", [@title]
        ,"phrase",
            IF (
                [granularity_code] = "FY"
                ,"FY" & [fy]
                ,SWITCH ( [granularity_code], "W", "week ", "P", "month ", "quarter " ) & [n] & IF ( [fy] <> _afy, " FY" & [fy], "" )
            ) & IF ( [is_partial], " to date", "" )
        ,"header", "**" & [@title] & "**" & IF ( [is_partial], " to date", "" ) & " · " & [@dates]
        ,"start_index", [start_index]
        ,"end_index", [end_index]
        ,"weeks", [weeks]
        ,"size", [size]
        ,"is_partial", [is_partial]
        ,"sort_order", [sort_order]
        ,"ly_start", [ly_start]
        ,"ly_end", [ly_end]
        ,"prev_start", [prev_start]
        ,"prev_end", [prev_end]
        ,"eb_prev_start", IF ( [granularity_code] = "W", IF ( [@ok], [@ms] ), [prev_start] )
        ,"eb_prev_end", IF ( [granularity_code] = "W", IF ( [@ok], [@ms] + [@wop] - 1 ), [prev_end] )
        ,"eb_prev_name",
            IF (
                [@ok]
                ,"P" & [@mn] & IF ( [@mf] <> [fy], " FY" & [@mf], "" ) & IF ( [@wop] = 1, " week 1", " weeks 1–" & [@wop] )
                ,""
            )
    )"""


def tmdl(tag, col_block):
    out = ["/// Period-model items (ADR-0013 (k), E-91, E-92): Week 95 · Month 22 · Quarter 8 · Year 2 at the shipped data, derived from dim_week "
           "(weeks within actuals, as-of week from manifest.json) with every comparator window as sort_index bounds. Joins param_granularity; no fact.",
           "table dim_item", f"\tlineageTag: {tag('dim_item')}", ""]
    for c, dtype, hidden, desc in COLS:
        blk = col_block("dim_item", c, dtype, hidden, c, "label_order" if c in ("label", "label_wide") else None, calc=True)
        out += [f"\t/// {desc}"] + blk if desc else blk
    out += ["\tpartition dim_item = calculated", "\t\tmode: import", "\t\tsource ="]
    out += ["\t\t\t\t" + l if l.strip() else "" for l in DAX.split("\n")]
    out += ["", "\tannotation PBI_ResultType = Table", ""]
    return "\n".join(out)

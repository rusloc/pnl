"""Engine measures of the period model (ADR-0013 (k), docs/ADD/features/exec-period-model.md §7; E-90 .. E-99).

The picked item comes from three button slicers: param_granularity (type) -> dim_item[fy_label] (FY) -> dim_item[label] (item).
Every window boundary is a dim_item column (calculated table from dim_week), read for the item in context."""
from copy_v5 import PERIOD_WORDS

INT = "#,0"


def engine(add):
    add("_Scope Code", 'SELECTEDVALUE ( param_region[scope_code], "ALL" )', hidden=True,
        desc="Region / format switcher (E-15): ALL, NL, BE or ONLINE; ALL when nothing is picked.")
    add("_Category Active", """
ISFILTERED ( dim_category[category_name] )
    && COUNTROWS ( VALUES ( dim_category[category_code] ) ) < COUNTROWS ( ALL ( dim_category[category_code] ) )""", hidden=True,
        desc="Category pick active (E-100, E-101): the Category slicer filters dim_category and leaves fewer than all 9 categories. "
             "All 9 ticked behaves like no pick (ruling 2026-10-30), so ISFILTERED alone is not the guard.")
    add("_Category Label", """
VAR _n          = COUNTROWS ( VALUES ( dim_category[category_code] ) )
RETURN
    SWITCH (
        TRUE ()
        ,NOT [_Category Active]
            ,""
        ,_n = 1
            ," · " & SELECTEDVALUE ( dim_category[category_name] )
        ,_n = 2
            ," · " & CONCATENATEX ( VALUES ( dim_category[category_name] ), dim_category[category_name], " & ", CALCULATE ( MAX ( dim_category[sort_order] ) ), ASC )
        ," · " & _n & " categories"
    )""", hidden=True,
        desc="Header segment of the category pick (E-103, js-exec CATEGORY_COPY): ' · Electronics', ' · Electronics & Toys & leisure' (menu order), "
             "' · 3 categories' from 3 up; empty at All (nothing or all 9 picked).")
    add("_Granularity Code", 'SELECTEDVALUE ( param_granularity[granularity_code], "W" )', hidden=True,
        desc="Period type (E-90): W (Week), P (Month = 4-5-4 retail period), Q (Quarter) or FY (Year); W when nothing is picked.")
    add("_Comparator Code", """
VAR _c          = SELECTEDVALUE ( param_comparator[comparator_code], "BUD" )
RETURN
    IF ( _c = "LW" && [_Granularity Code] = "FY", "LY", _c )""", hidden=True,
        desc="Comparator switcher (E-14, E-94): BUD, LY or LW (= Previous item); BUD when nothing is picked. Previous is not offered at Year and reads LY there. Drives the delta row only (E-24).")
    add("_Comparator Row Visible", """
IF ( SELECTEDVALUE ( param_comparator[comparator_code] ) = "LW" && [_Granularity Code] = "FY", 0, 1 )""", "0", hidden=True,
        desc="1 when a comparator row is offered; 0 for Previous at Year (E-94). Visual-level filter of menu_param_comparator.")
    add("_AsOf Index", """
VAR _key        = MAX ( meta_dataset[current_week_key] )
RETURN
    CALCULATE (
        MAX ( dim_week[sort_index] )
        ,REMOVEFILTERS ( dim_week )
        ,dim_week[week_key] = _key
    )""", INT, hidden=True,
        desc="dim_week sort_index of the as-of week (manifest.json current_week_key, FY2026-W43 = 95, E-05).")
    add("_Item Key", """
VAR _g          = [_Granularity Code]
VAR _one        = HASONEVALUE ( dim_item[item_key] )
VAR _hitk       = IF ( _one, SELECTEDVALUE ( dim_item[item_key] ) )
VAR _hitg       = IF ( _one, SELECTEDVALUE ( dim_item[granularity_code] ) )
VAR _a          = [_AsOf Index]
VAR _afy        = CALCULATE ( MAX ( dim_week[fy] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _a )
VAR _fyf        = IF ( ISFILTERED ( dim_item[fy_label] ), MAXX ( FILTERS ( dim_item[fy_label] ), dim_item[fy_label] ) )
VAR _fy         = IF ( ISBLANK ( _fyf ), _afy, VALUE ( RIGHT ( _fyf, 4 ) ) )
VAR _lab        =
    IF (
        _g IN { "Q", "FY" }
        ,IF ( ISFILTERED ( dim_item[label_wide] ), MAXX ( FILTERS ( dim_item[label_wide] ), dim_item[label_wide] ) )
        ,IF ( ISFILTERED ( dim_item[label] ), MAXX ( FILTERS ( dim_item[label] ), dim_item[label] ) )
    )
VAR _anchor0    =
    CALCULATE (
        MAX ( dim_item[end_index] )
        ,REMOVEFILTERS ( dim_item )
        ,dim_item[fy] = _fy
        ,dim_item[label] = _lab
    )
VAR _fyend      = CALCULATE ( MAX ( dim_item[end_index] ), REMOVEFILTERS ( dim_item ), dim_item[fy] = _fy )
VAR _anchor     = IF ( ISBLANK ( _anchor0 ), _fyend, _anchor0 )
VAR _fallback   =
    CALCULATE (
        MAX ( dim_item[item_key] )
        ,REMOVEFILTERS ( dim_item )
        ,dim_item[granularity_code] = _g
        ,dim_item[start_index] <= _anchor
        ,dim_item[end_index] >= _anchor
    )
RETURN
    IF ( _hitg = _g, _hitk, _fallback )""", hidden=True,
        desc="The picked item (E-91): the one dim_item row left by the type, FY and item slicers (Week / Month grid on label, Quarter / Year row on label_wide); otherwise the item of the picked type "
             "that holds the last week of the item last picked in the picked FY (or of that FY's last item, the as-of week in the as-of FY), "
             "so W43 -> P10 -> Q4 -> FY2026 and Reset lands on Week 43 FY2026 (js-exec menu(), E-90).")

    def col(name, column, desc, fmt=INT, expr=None):
        add(name, expr or f"""
VAR _k          = [_Item Key]
RETURN
    CALCULATE ( MAX ( dim_item[{column}] ), REMOVEFILTERS ( dim_item ), dim_item[item_key] = _k )""", fmt, hidden=True, desc=desc)

    col("_Window Start", "start_index", "First sort_index of the picked item's window (item weeks within actuals, E-92).")
    col("_Window End", "end_index", "Last sort_index of the picked item's window = L, the week point-in-time cards read (E-92, E-93).")
    col("_LY Window Start", "ly_start", "First sort_index of the LY window: the window's weeks one year back by ly_week_key (E-12, E-94); blank in FY2025.")
    col("_LY Window End", "ly_end", "Last sort_index of the LY window; blank in FY2025.")
    col("_Prev Window Start", "prev_start",
        "First sort_index of the previous-item window (E-94): lw_week_key at Week; the item before at Month / Quarter / Year, cut to the picked item's week count when it is partial; blank for the first item.")
    col("_Prev Window End", "prev_end", "Last sort_index of the previous-item window.")
    col("_EB Prev Start", "eb_prev_start",
        "EBITDA flash, comparator Previous (E-93, ET-31): at Week the previous month's first k weeks (k = the week's position in its month; P1 -> previous FY P12; blank for week 5 of a 5-week month); else = _Prev Window Start.")
    col("_EB Prev End", "eb_prev_end", "Last sort_index of the EBITDA Previous window.")
    col("_EB Prev Name", "eb_prev_name", "Name of the EBITDA Previous window at Week for the i delta line, e.g. P9 weeks 1-4 (USER 2026-10-30).", fmt=None)
    col("_Item Sort", "sort_order", "Position of the picked item among the items of its type (1 = FY2025 W1 / P1 / Q1 / FY2025).")
    w = PERIOD_WORDS
    add("_Prev Short", f'SWITCH ( [_Granularity Code], "P", "{w["P"]["short"]}", "Q", "{w["Q"]["short"]}", "FY", "{w["FY"]["short"]}", "{w["W"]["short"]}" )',
        hidden=True, desc="Delta suffix of the Previous comparator, always short (E-98): vs prev. wk / mth / qtr (vs LY at Year).")
    add("Window Noun", f'SWITCH ( [_Granularity Code], "P", "{w["P"]["noun"]}", "Q", "{w["Q"]["noun"]}", "FY", "{w["FY"]["noun"]}", "{w["W"]["noun"]}" )',
        None, "8 Cards", desc="Noun of the picked type for stat labels and sub-titles: week, month, quarter or year (E-98).")

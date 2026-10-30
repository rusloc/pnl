"""DAX measures for the Nordmark Exec model (ADR-0013 PBI flavour; requirement IDs E-nn from docs/Requirements-exec.md).

Layers
- 1-6 Base (context-driven): every base measure evaluates over the dim_week rows in the filter context (the window)
  and the region picked in param_region (scope, E-15, read by the leaf sums only). Flow metrics sum over the window,
  point-in-time metrics take the window's last week (E-13). This is the layer the control-total tests hit.
- 7 Status: per-card status codes, counts and the overall dot in the same window context (E-22 .. E-26).
- 8 Cards: the header pickers turn into a window (period switcher, as-of week from the manifest), comparators
  (Budget / LY by ly_week_key / LW, E-14) and display texts; one SVG image measure per card.
- 9 Engine: helpers (hidden).
"""
from copy_v5 import CARDS, ATTRS, PAGE, HOW
from common import C, text_width, wrap
import fmt as F

M = []


def add(name, expr, fmt=None, folder="9 Engine", hidden=False, desc="", cat=None):
    M.append(dict(name=name, expr=expr.strip("\n"), fmt=fmt, folder=folder, hidden=hidden, desc=desc, cat=cat))


def dq(s):
    """DAX string literal."""
    return '"' + s.replace('"', '""') + '"'


def xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def ind(text, n=1):
    pad = "    " * n
    return "\n".join(pad + l if l.strip() else l for l in text.split("\n"))


PCT = "0.0%;-0.0%;0.0%"
EUR = "#,0.00"
NUM1 = "0.0"
INT = "#,0"

# ------------------------------------------------------------------ engine: pickers, as-of, picked item, windows (ADR-0013 (k))
from engine_k import engine  # noqa: E402

engine(add)


def scoped(expr, name, desc, fmt=EUR, folder="9 Engine", hidden=True):
    add(name, f"""
VAR _scope      = [_Scope Code]
RETURN
    IF (
        _scope = "ALL"
        ,{expr}
        ,CALCULATE ( {expr}, dim_store[scope_code] = _scope )
    )""", fmt, folder, hidden, desc + " Scoped by the region switcher (dim_store.scope_code; ALL = no filter).")


# ------------------------------------------------------------------ 1 Sales & margin (flow)
F1 = "1 Sales & margin"
for nm, col, d in [("Gross Sales", "gross_sales", "Gross sales at ticket, ex-VAT."),
                   ("Markdown", "markdown_value", "Markdown value, permanent + promo (E-34)."),
                   ("Returns", "returns", "Returns."),
                   ("Net Sales", "net_sales", "Net sales = gross - markdown - returns (E-30)."),
                   ("COGS", "cogs_landed", "Cost of goods at standard landed cost (E-32)."),
                   ("Back Margin", "back_margin_alloc", "Back margin: supplier income allocated to site x category by COGS share (E-33).")]:
    scoped(f"SUM ( fact_sales_week[{col}] )", nm, d + " Flow: sums over the weeks in context.", EUR, F1, False)
scoped("SUM ( fact_sales_week[units] )", "_Units", "Units sold.", INT)
add("Front Margin", "[Net Sales] - [COGS]", EUR, F1, desc="Front margin EUR = Net sales - COGS (E-32).")
add("Total Margin", "[Front Margin] + [Back Margin]", EUR, F1, desc="Total margin EUR = front + back (E-33, ET-07).")
add("Front GM %", "DIVIDE ( [Front Margin], [Net Sales] )", PCT, F1, desc="Front gross margin % of net sales (E-32).")
add("Back Margin %", "DIVIDE ( [Back Margin], [Net Sales] )", PCT, F1, desc="Back margin % of net sales.")
add("Total Margin %", "DIVIDE ( [Total Margin], [Net Sales] )", PCT, F1, desc="Total margin % = (front + back) / net sales (E-33).")
add("Markdown %", "DIVIDE ( [Markdown], [Gross Sales] )", PCT, F1, desc="Markdown % of gross sales (E-34).")

# ------------------------------------------------------------------ 2 Profit (opex, EBITDA)
F2 = "2 Profit"
scoped("SUM ( fact_opex_week[amount] )", "_Opex", "OpEx amount, every scenario and cost type (filter on top).")
for nm, ct in [("Opex Shrink", "SHRINK"), ("Opex Store", "STORE_OPEX"), ("Opex Central", "CENTRAL_OPEX"), ("Opex Fulfilment", "FULFILMENT")]:
    for scen, suf in [("ACT", ""), ("BUD", " Bud")]:
        add(nm + suf, f"""
IF (
    [_Category Active]
    ,BLANK ()
    ,CALCULATE (
        [_Opex]
        ,fact_opex_week[scenario_code] = "{scen}"
        ,fact_opex_week[cost_type_code] = "{ct}"
    ) + 0
)""", EUR, F2 if not suf else "6 Budget",
            desc=f"OpEx {ct}, scenario {scen}. Central costs carry no site and appear in ALL only (data README open point 15). "
                 "BLANK under a category pick: OpEx has no category key (E-101).")
add("EBITDA", """
IF (
    [_Category Active]
    ,BLANK ()
    ,[Total Margin] - [Opex Shrink] - [Opex Store] - [Opex Central] - [Opex Fulfilment]
)""", EUR, F2,
    desc="EBITDA = total margin - shrink - store OpEx - central OpEx - fulfilment (E-40). In NL / BE / ONLINE a contribution before central costs. "
         "N/A under a category pick (E-101): Total margin - BLANK () would be Total margin, so the whole measure is blanked.")
add("EBITDA Margin %", "DIVIDE ( [EBITDA], [Net Sales] )", PCT, F2, desc="EBITDA % of net sales (E-40).")
for nm, base in [("EBITDA PTD", "[EBITDA]"), ("EBITDA Bud PTD", "[EBITDA Bud]")]:
    add(nm, f"""
VAR _last       = MAX ( dim_week[sort_index] )
VAR _period     =
    CALCULATE (
        SELECTEDVALUE ( dim_week[period_key] )
        ,REMOVEFILTERS ( dim_week )
        ,dim_week[sort_index] = _last
    )
RETURN
    CALCULATE (
        {base}
        ,REMOVEFILTERS ( dim_week )
        ,dim_week[period_key] = _period
        ,dim_week[sort_index] <= _last
    )""", EUR, F2, desc=f"{base} for the period to date of the window's last week (the EBITDA card at Week, E-40, E-93).")
for nm, ptd, win in [("EBITDA Flash", "EBITDA PTD", "EBITDA"), ("EBITDA Flash Bud", "EBITDA Bud PTD", "EBITDA Bud")]:
    add(nm, f"""
VAR _one        = COUNTROWS ( VALUES ( dim_week[sort_index] ) ) = 1
RETURN
    IF ( _one, [{ptd}], [{win}] )""", EUR, F2 if nm == "EBITDA Flash" else "6 Budget",
        desc=f"EBITDA card reading (E-40, E-93): [{ptd}] (month to date through the week) when the window is one week (Week items, their LY "
             f"week, the first week of a month), else [{win}] of the window (Month / Quarter / Year items and their comparators).")

# ------------------------------------------------------------------ 6 Budget
F6 = "6 Budget"
for nm, col in [("Net Sales Bud", "net_sales_bud"), ("Gross Sales Bud", "gross_sales_bud"), ("Markdown Bud", "markdown_bud"),
                ("COGS Bud", "cogs_bud"), ("Back Margin Bud", "back_margin_bud")]:
    scoped(f"SUM ( fact_budget_week[{col}] )", nm, f"Budget {col} (FY2026 W1-W52).", EUR, F6, False)
add("Markdown % Bud", "DIVIDE ( [Markdown Bud], [Gross Sales Bud] )", PCT, F6, desc="Budget markdown % of gross.")
add("Front GM % Bud", """
VAR _ns         = [Net Sales Bud]
RETURN
    IF ( NOT ISBLANK ( _ns ), 1 - DIVIDE ( [COGS Bud], _ns ) )""", PCT, F6, desc="Budget front GM % = 1 - COGS bud / net sales bud.")
add("Total Margin % Bud", "DIVIDE ( [Net Sales Bud] - [COGS Bud] + [Back Margin Bud], [Net Sales Bud] )", PCT, F6, desc="Budget total margin %.")
add("EBITDA Bud", """
VAR _ns         = [Net Sales Bud]
RETURN
    IF (
        NOT ISBLANK ( _ns ) && NOT [_Category Active]
        ,_ns - [COGS Bud] + [Back Margin Bud] - [Opex Shrink Bud] - [Opex Store Bud] - [Opex Central Bud] - [Opex Fulfilment Bud]
    )""", EUR, F6, desc="Budget EBITDA = budget total margin - budget OpEx (scenario BUD); N/A under a category pick (E-101).")
add("EBITDA Margin % Bud", "DIVIDE ( [EBITDA Bud], [Net Sales Bud] )", PCT, F6, desc="Budget EBITDA % of budget net sales.")

# ------------------------------------------------------------------ 3 LFL
F3 = "3 LFL"
add("LFL Net Sales", "CALCULATE ( [Net Sales], fact_sales_week[is_lfl] = TRUE () )", EUR, F3,
    desc="Net sales of rows whose store is LFL in that row's period (is_lfl, E-31).")
add("LFL Net Sales LY", """
VAR _ly         = VALUES ( dim_week[ly_week_key] )
RETURN
    CALCULATE (
        [Net Sales]
        ,REMOVEFILTERS ( dim_week )
        ,TREATAS ( _ly, dim_week[week_key] )
        ,fact_sales_week[is_lfl_as_ly] = TRUE ()
    )""", EUR, F3, desc="LY net sales of the stores that are LFL one year later, joined by ly_week_key, never by date (E-12, ET-05).")
add("LFL Growth %", """
VAR _ly         = [LFL Net Sales LY]
RETURN
    IF ( _ly <> 0, DIVIDE ( [LFL Net Sales], _ly ) - 1 )""", PCT, F3,
    desc="LFL growth = LFL net sales / LY LFL net sales - 1; N/A without LY history (E-31).")
add("LFL Net Sales Bud", """
IF (
    [LFL Net Sales LY] <> 0
    ,CALCULATE ( [Net Sales Bud], fact_budget_week[is_lfl] = TRUE () )
)""", EUR, F3, desc="Budget net sales of the LFL stores.")
add("LFL Growth % Bud", """
VAR _ly         = [LFL Net Sales LY]
VAR _bud        = [LFL Net Sales Bud]
RETURN
    IF ( _ly <> 0 && NOT ISBLANK ( _bud ), DIVIDE ( _bud, _ly ) - 1 )""", PCT, F3,
    desc="Budget LFL = LFL budget net sales / the same LY actual - 1 (data README LFL).")
scoped("DISTINCTCOUNT ( fact_sales_week[store_code] )", "_Store Count", "Distinct sites with sales rows.", INT)
add("LFL Store Count", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    IF (
        NOT ISBLANK ( [LFL Growth %] )
        ,CALCULATE (
            [_Store Count]
            ,REMOVEFILTERS ( dim_week )
            ,dim_week[sort_index] = _last
            ,fact_sales_week[is_lfl] = TRUE ()
            ,dim_store[channel_code] = "STORE"
        ) + 0
    )""", INT, F3, desc="Stores with is_lfl rows in the window's last week (131 at Week 43, ET-06).")
add("Trading Store Count", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    CALCULATE (
        [_Store Count]
        ,REMOVEFILTERS ( dim_week )
        ,dim_week[sort_index] = _last
        ,dim_store[channel_code] = "STORE"
    )""", INT, F3, desc="Stores with sales rows in the window's last week (142 at Week 43).")
add("Store Net Sales", 'CALCULATE ( [Net Sales], dim_store[channel_code] = "STORE" ) + 0', EUR, F3, desc="Net sales of the store channel.")
add("Store Net Sales LY", """
VAR _ly         = VALUES ( dim_week[ly_week_key] )
RETURN
    CALCULATE (
        [Net Sales]
        ,REMOVEFILTERS ( dim_week )
        ,TREATAS ( _ly, dim_week[week_key] )
        ,dim_store[channel_code] = "STORE"
    ) + 0""", EUR, F3, desc="LY net sales of the store channel by ly_week_key.")
add("Non-LFL Effect pp", """
VAR _lfl        = [LFL Growth %]
RETURN
    IF ( NOT ISBLANK ( _lfl ), DIVIDE ( [Store Net Sales], [Store Net Sales LY] ) - 1 - _lfl )""", PCT, F3,
    desc="Store-channel growth vs LY - LFL growth (ET-06).")
add("Online Growth vs LY", """
VAR _ly         = VALUES ( dim_week[ly_week_key] )
VAR _cur        = CALCULATE ( [Net Sales], dim_store[channel_code] = "ONLINE" )
VAR _prev       =
    CALCULATE (
        [Net Sales]
        ,REMOVEFILTERS ( dim_week )
        ,TREATAS ( _ly, dim_week[week_key] )
        ,dim_store[channel_code] = "ONLINE"
    )
RETURN
    IF ( _prev <> 0, DIVIDE ( _cur, _prev ) - 1 )""", PCT, F3, desc="Online net sales vs LY by week key (LFL card stat).")

# ------------------------------------------------------------------ 4 Stock & supply (point in time unless noted)
F4 = "4 Stock & supply"
scoped("SUM ( fact_inventory_week[on_hand_cost] )", "_Inv On Hand Cost", "On-hand cost, summed over the weeks in context (never use over a window).")
scoped("SUM ( fact_inventory_week[on_order_cost] )", "_Inv On Order Cost", "On-order cost.")
scoped("SUM ( fact_inventory_week[on_hand_units] )", "_Inv On Hand Units", "On-hand units.", INT)
scoped("SUM ( fact_forecast_week[forecast_cogs] )", "_Forecast COGS", "Forecast weekly COGS.")
scoped("SUMX ( fact_forecast_week, fact_forecast_week[forecast_cogs] * RELATED ( dim_category[cover_target_wks] ) )",
       "_Forecast x Cover Target", "Forecast COGS weighted by the category cover target.")
scoped("SUM ( fact_availability_week[ranged_sku_days] )", "_Ranged SKU Days", "Ranged top-500 SKU-days.", INT)
scoped("SUM ( fact_availability_week[in_stock_sku_days] )", "_In Stock SKU Days", "In-stock SKU-days (sales-weighted).", "#,0.0")
scoped("SUM ( fact_receipts_week[receipt_units] )", "_Receipt Units", "Receipt units into selling locations.", INT)


def pit(name, leaf, desc, fmt=EUR):
    add(name, f"""
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    CALCULATE (
        [{leaf}]
        ,REMOVEFILTERS ( dim_week )
        ,dim_week[sort_index] = _last
    )""", fmt, F4, desc=desc + " Point in time: the window's last week-end (E-13).")


pit("On Hand Cost", "_Inv On Hand Cost", "Stock on hand at cost.")
pit("On Order Cost", "_Inv On Order Cost", "Stock on order at cost.")
add("Stock incl On Order", "[On Hand Cost] + [On Order Cost]", EUR, F4, desc="On hand + on order at cost (E-35).")
pit("Forecast COGS", "_Forecast COGS", "Forecast weekly COGS of the window's last week.")
add("Weeks of Cover", """
VAR _last       = MAX ( dim_week[sort_index] )
VAR _forecast   = [Forecast COGS]
VAR _stock      = [Stock incl On Order]
VAR _r4w        =
    DIVIDE (
        CALCULATE (
            [COGS]
            ,REMOVEFILTERS ( dim_week )
            ,dim_week[sort_index] > _last - 4
            ,dim_week[sort_index] <= _last
        )
        ,4
    )
RETURN
    IF ( _forecast <> 0, DIVIDE ( _stock, _forecast ), DIVIDE ( _stock, _r4w ) )""", NUM1, F4,
    desc="(On hand + on order) / forecast weekly COGS at the last week-end; fallback R4W average COGS when the forecast is blank (E-35, ET-08).")
add("Cover Target Wks", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    DIVIDE (
        CALCULATE ( [_Forecast x Cover Target], REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _last )
        ,CALCULATE ( [_Forecast COGS], REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _last )
    )""", NUM1, F4, desc="Forecast-COGS-weighted category cover target, same week and scope (9.5 at ALL, ET-08).")
pit("Ranged SKU Days", "_Ranged SKU Days", "Ranged top-500 SKU-days (stores only).", INT)
pit("In Stock SKU Days", "_In Stock SKU Days", "In-stock SKU-days.", "#,0.0")
add("Availability %", """
VAR _ranged     = [Ranged SKU Days]
RETURN
    IF ( _ranged <> 0, DIVIDE ( [In Stock SKU Days], _ranged ) )""", PCT, F4, desc="In-stock / ranged SKU-days, last week; N/A for ONLINE (E-36).")


def target(kpi):
    return f'LOOKUPVALUE ( param_target[target_value], param_target[kpi_code], "{kpi}", param_target[category_code], "ALL" )'


add("Availability Target", target("AVAILABILITY"), PCT, F4, desc="Availability target, param_target ALL (97 %).")
add("Season Week", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    CALCULATE ( MAX ( dim_week[season_week] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _last )""", "0", F4,
    desc="Season week of the window's last week (AW26 = W32-W51; blank outside a season, E-16).")
add("Season Opening Units", """
VAR _last       = MAX ( dim_week[sort_index] )
VAR _sw         = [Season Week]
RETURN
    IF (
        NOT ISBLANK ( _sw ) && TRUE () IN VALUES ( dim_category[is_seasonal] )
        ,CALCULATE (
            [_Inv On Hand Units]
            ,REMOVEFILTERS ( dim_week )
            ,dim_week[sort_index] = _last - _sw
            ,dim_store[channel_code] IN { "STORE", "ONLINE" }
            ,dim_category[is_seasonal] = TRUE ()
        ) + 0
    )""", INT, F4, desc="Seasonal on-hand units at the week-end before season week 1, selling locations (E-37); the seasonal part of a category pick, BLANK without one (E-101).")
add("Season Receipt Units", """
VAR _last       = MAX ( dim_week[sort_index] )
VAR _sw         = [Season Week]
RETURN
    IF (
        NOT ISBLANK ( _sw ) && TRUE () IN VALUES ( dim_category[is_seasonal] )
        ,CALCULATE (
            [_Receipt Units]
            ,REMOVEFILTERS ( dim_week )
            ,dim_week[sort_index] > _last - _sw
            ,dim_week[sort_index] <= _last
            ,dim_category[is_seasonal] = TRUE ()
        ) + 0
    )""", INT, F4, desc="Seasonal receipts season to date (E-37); the seasonal part of a category pick, BLANK without one (E-101).")
add("Season Units Sold", """
VAR _last       = MAX ( dim_week[sort_index] )
VAR _sw         = [Season Week]
RETURN
    IF (
        NOT ISBLANK ( _sw ) && TRUE () IN VALUES ( dim_category[is_seasonal] )
        ,CALCULATE (
            [_Units]
            ,REMOVEFILTERS ( dim_week )
            ,dim_week[sort_index] > _last - _sw
            ,dim_week[sort_index] <= _last
            ,dim_store[channel_code] IN { "STORE", "ONLINE" }
            ,dim_category[is_seasonal] = TRUE ()
        ) + 0
    )""", INT, F4, desc="Seasonal units sold season to date, stores and ONLINE (wholesale excluded, E-37); the seasonal part of a category pick, BLANK without one (E-101).")
add("Sell-through %", """
VAR _sw         = [Season Week]
RETURN
    IF (
        NOT ISBLANK ( _sw )
        ,DIVIDE ( [Season Units Sold], [Season Opening Units] + [Season Receipt Units] )
    )""", PCT, F4, desc="Sold / (opening + receipts), season to date; N/A outside a season (E-37; bars 12 -> 63 %, data README open point 13).")
add("Sell-through Target", f"""
IF ( NOT ISBLANK ( [Season Week] ) && TRUE () IN VALUES ( dim_category[is_seasonal] ), {target("SELL_THROUGH")} )""", PCT, F4,
    desc="Season sell-through target (62 %; every seasonal category row is 0.62, so the (opening + receipts)-weighted mean over a pick is 0.62 too); "
         "BLANK without a seasonal category in context (E-101, E-102).")
add("GMROI Front Margin R52W", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    IF (
        _last >= 52
        ,CALCULATE (
            [Front Margin]
            ,REMOVEFILTERS ( dim_week )
            ,dim_week[sort_index] > _last - 52
            ,dim_week[sort_index] <= _last
        )
    )""", EUR, F4, desc="Front margin over the 52 weeks ending with the window's last week (E-38, OQ 11).")
add("GMROI Avg On Hand Cost", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    IF (
        _last >= 52
        ,DIVIDE (
            CALCULATE (
                [_Inv On Hand Cost]
                ,REMOVEFILTERS ( dim_week )
                ,dim_week[sort_index] > _last - 52
                ,dim_week[sort_index] <= _last
            )
            ,52
        )
    )""", EUR, F4, desc="Average on-hand cost over the 52 week-ends (on-order and in-transit excluded, E-38).")
add("GMROI", "DIVIDE ( [GMROI Front Margin R52W], [GMROI Avg On Hand Cost] )", "0.00", F4, desc="GMROI = R52W front margin / average on-hand cost (E-38).")
add("GMROI Target", f"""
IF (
    MAX ( dim_week[sort_index] ) >= 52
    ,IF (
        [_Category Active]
        ,DIVIDE (
            SUMX (
                VALUES ( dim_category[category_code] )
                ,[GMROI Avg On Hand Cost] * CALCULATE ( MAX ( dim_category[gmroi_target] ) )
            )
            ,[GMROI Avg On Hand Cost]
        )
        ,{target("GMROI")}
    )
)""", "0.0", F4, desc="GMROI target: 2.5x at All (param_target ALL); under a category pick the average-on-hand-cost-weighted mean of "
                     "dim_category.gmroi_target over the pick, i.e. the category's own row for a single pick (E-102, ruling 2026-10-30).")
F4b = "4 Stock & supply"
add("PO Lines Due", "IF ( [_Category Active], BLANK (), SUM ( fact_po_week[po_lines_due] ) )", INT, F4b,
    desc="PO lines due. No site key: the same in every scope. No category key: BLANK under a category pick (E-101).")
add("PO Lines OTIF", "IF ( [_Category Active], BLANK (), SUM ( fact_po_week[po_lines_otif] ) )", INT, F4b,
    desc="PO lines on time in full; BLANK under a category pick (E-101).")
add("OTIF %", "DIVIDE ( [PO Lines OTIF], [PO Lines Due] )", PCT, F4b, desc="Supplier OTIF % over the window (E-39).")
add("OTIF Target", f"IF ( [_Category Active], BLANK (), {target('SUPPLIER_OTIF')} )", PCT, F4b, desc="OTIF target 95 %; BLANK under a category pick (E-101).")
add("OTIF Suppliers Below 85", """
VAR _last       = MAX ( dim_week[sort_index] )
RETURN
    IF (
        NOT [_Category Active]
        ,COUNTROWS (
            FILTER (
                CALCULATETABLE ( fact_po_week, REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _last )
                ,fact_po_week[po_lines_otif] < 0.85 * fact_po_week[po_lines_due]
            )
        ) + 0
    )""", INT, F4b, desc="Suppliers below 85 % OTIF in the window's last week (OTIF card stat); BLANK under a category pick (E-101).")

# ------------------------------------------------------------------ 5 Channel mix (window shares, E-41 / E-93, USER 2026-10-29)
F5 = "5 Channel mix"
CH = [("Store", "STORE"), ("Online", "ONLINE"), ("Wholesale", "WHOLESALE")]
for lab, code in CH:
    add(f"Mix {lab} Net Sales", f'CALCULATE ( [Net Sales], dim_store[channel_code] = "{code}" ) + 0', EUR, F5,
        desc=f"{lab} channel net sales over the window (E-41).")
    add(f"Mix {lab} %", f"DIVIDE ( [Mix {lab} Net Sales], [Net Sales] )", PCT, F5,
        desc=f"{lab} share of net sales over the whole window (E-41; at Week the week itself).")
    add(f"Mix {lab} % Bud", f"""
VAR _total      = [Net Sales Bud]
RETURN
    IF (
        NOT ISBLANK ( _total )
        ,DIVIDE ( CALCULATE ( [Net Sales Bud], dim_store[channel_code] = "{code}" ) + 0, _total )
    )""", PCT, F5, desc=f"Plan {lab.lower()} share = budget net-sales share over the same window (E-41); blank without budget (FY2025).")
for nm, pick, fmt in [("Mix Max Dev pp", "SWITCH ( _j, 1, _d1, 2, _d2, _d3 )", PCT), ("Mix Max Dev Channel", "_j", "0")]:
    add(nm, f"""
VAR _b1         = [Mix Store % Bud]
VAR _d1         = [Mix Store %] - _b1
VAR _d2         = [Mix Online %] - [Mix Online % Bud]
VAR _d3         = [Mix Wholesale %] - [Mix Wholesale % Bud]
VAR _j          =
    SWITCH (
        TRUE ()
        ,ABS ( _d1 ) >= ABS ( _d2 ) && ABS ( _d1 ) >= ABS ( _d3 )
            ,1
        ,ABS ( _d2 ) >= ABS ( _d3 )
            ,2
        ,3
    )
RETURN
    IF ( NOT ISBLANK ( _b1 ), {pick} )""", fmt, F5,
        desc="Channel with the largest absolute deviation from the plan mix (1 store, 2 online, 3 wholesale; first on a tie). pp is signed.")

# ------------------------------------------------------------------ 7 Status (window context)
F7 = "7 Status"
VALUE = {"NET_SALES": "Net Sales", "TOTAL_MARGIN": "Total Margin %", "WEEKS_OF_COVER": "Weeks of Cover", "MARKDOWN": "Markdown %",
         "AVAILABILITY": "Availability %", "EBITDA": "EBITDA Flash", "LFL_GROWTH": "LFL Growth %", "FRONT_GM": "Front GM %",
         "SELL_THROUGH": "Sell-through %", "GMROI": "GMROI", "SUPPLIER_OTIF": "OTIF %", "CHANNEL_MIX": "Mix Store %"}
BASIS = {"NET_SALES": "Net Sales Bud", "TOTAL_MARGIN": "Total Margin % Bud", "WEEKS_OF_COVER": "Cover Target Wks", "MARKDOWN": "Markdown % Bud",
         "AVAILABILITY": "Availability Target", "EBITDA": "EBITDA Flash Bud", "LFL_GROWTH": "LFL Growth % Bud", "FRONT_GM": "Front GM % Bud",
         "SELL_THROUGH": "Sell-through Target", "GMROI": "GMROI Target", "SUPPLIER_OTIF": "OTIF Target", "CHANNEL_MIX": "Mix Store % Bud"}
BAR = dict(VALUE, EBITDA="EBITDA")
BAR_BASIS = dict(BASIS, EBITDA="EBITDA Bud")
UNIT = {"NET_SALES": "EUR", "TOTAL_MARGIN": "PCT", "WEEKS_OF_COVER": "WKS", "MARKDOWN": "PCT", "AVAILABILITY": "PCT", "EBITDA": "EUR",
        "LFL_GROWTH": "LFL", "FRONT_GM": "PCT", "SELL_THROUGH": "PCT", "GMROI": "X", "SUPPLIER_OTIF": "PCT", "CHANNEL_MIX": "MIX"}
BADNESS = {
    "NET_SALES": ("VAR _bud        = [Net Sales Bud]", "IF ( _bud <> 0, 1 - DIVIDE ( [Net Sales], _bud ) )"),
    "TOTAL_MARGIN": ("VAR _act        = [Total Margin %]\nVAR _bas        = [Total Margin % Bud]", "IF ( NOT ISBLANK ( _act ) && NOT ISBLANK ( _bas ), _bas - _act )"),
    "WEEKS_OF_COVER": ("VAR _act        = [Weeks of Cover]", "IF ( NOT ISBLANK ( _act ), ABS ( _act - [Cover Target Wks] ) )"),
    "MARKDOWN": ("VAR _act        = [Markdown %]\nVAR _bas        = [Markdown % Bud]", "IF ( NOT ISBLANK ( _act ) && NOT ISBLANK ( _bas ), _act - _bas )"),
    "AVAILABILITY": ("VAR _act        = [Availability %]", "IF ( NOT ISBLANK ( _act ), [Availability Target] - _act )"),
    "EBITDA": ("VAR _bud        = [EBITDA Flash Bud]", "IF ( _bud <> 0, 1 - DIVIDE ( [EBITDA Flash], _bud ) )"),
    "LFL_GROWTH": ("VAR _act        = [LFL Growth %]\nVAR _bas        = [LFL Growth % Bud]", "IF ( NOT ISBLANK ( _act ) && NOT ISBLANK ( _bas ), _bas - _act )"),
    "FRONT_GM": ("VAR _act        = [Front GM %]\nVAR _bas        = [Front GM % Bud]", "IF ( NOT ISBLANK ( _act ) && NOT ISBLANK ( _bas ), _bas - _act )"),
    "SELL_THROUGH": ("VAR _act        = [Sell-through %]", "IF ( NOT ISBLANK ( _act ), [Sell-through Target] - _act )"),
    "GMROI": ("VAR _act        = [GMROI]", "IF ( NOT ISBLANK ( _act ), [GMROI Target] - _act )"),
    "SUPPLIER_OTIF": ("VAR _act        = [OTIF %]", "IF ( NOT ISBLANK ( _act ), [OTIF Target] - _act )"),
    "CHANNEL_MIX": ("VAR _act        = [Mix Max Dev pp]", "IF ( NOT ISBLANK ( _act ), ABS ( _act ) )"),
}
KPIS = [c["k"] for c in CARDS]
for k in KPIS:
    pre, bad = BADNESS[k]
    add(f"Status {k}", f"""
{pre}
VAR _bad        = {bad}
VAR _watch      = LOOKUPVALUE ( param_status_rule[watch_from], param_status_rule[rule_code], "{k}" )
VAR _off        = LOOKUPVALUE ( param_status_rule[off_from], param_status_rule[rule_code], "{k}" )
VAR _r          = ROUND ( _bad, 10 )
RETURN
    IF (
        NOT ISBLANK ( _bad )
        ,SWITCH (
            TRUE ()
            ,_r <= _watch
                ,1
            ,_r <= _off
                ,2
            ,3
        )
    )""", "0", F7, desc=f"Status of {k}: 1 On track, 2 Watch, 3 Off track, blank N/A. Always vs budget / target (E-22, E-24); "
                         "N/A where the value or its basis is blank (FY2025 has no budget, E-95); badness rounded to 10 decimals, the Watch edge is Watch (data README Status, open point 9).")
STAT_LIST = "\n        ,".join(f"[Status {k}]" for k in KPIS)
for nm, code, d in [("Status Count On", "1", "On track"), ("Status Count Watch", "2", "Watch"), ("Status Count Off", "3", "Off track")]:
    add(nm, f"""
VAR _t          =
    {{
        {STAT_LIST}
    }}
RETURN
    COUNTROWS ( FILTER ( _t, [Value] = {code} ) ) + 0""", "0", F7, desc=f"Cards {d} (E-25), over the cards with a status (E-95).")
add("Status Count NA", f"""
VAR _t          =
    {{
        {STAT_LIST}
    }}
RETURN
    12 - COUNTROWS ( FILTER ( _t, NOT ISBLANK ( [Value] ) ) )""", "0", F7, desc="Cards without a status (N/A).")
add("Status Dot", f"""
VAR _t          =
    {{
        {STAT_LIST}
    }}
VAR _on         = COUNTROWS ( FILTER ( _t, [Value] = 1 ) ) + 0
VAR _watch      = COUNTROWS ( FILTER ( _t, [Value] = 2 ) ) + 0
VAR _offc       = COUNTROWS ( FILTER ( _t, [Value] = 3 ) ) + 0
VAR _n          = _on + _watch + _offc
VAR _red        = LOOKUPVALUE ( param_status_rule[threshold], param_status_rule[rule_code], "DOT_RED_OFF" )
VAR _orange     = LOOKUPVALUE ( param_status_rule[threshold], param_status_rule[rule_code], "DOT_ORANGE_WATCH_OFF" )
VAR _green      = LOOKUPVALUE ( param_status_rule[threshold], param_status_rule[rule_code], "DOT_GREEN_GOOD" )
RETURN
    IF (
        _n > 0
        ,SWITCH (
            TRUE ()
            ,DIVIDE ( _offc, _n ) >= _red
                ,3
            ,DIVIDE ( _watch + _offc, _n ) > _orange
                ,2
            ,DIVIDE ( _on, _n ) >= _green
                ,1
            ,2
        )
    )""", "0", F7, desc="Overall dot: 1 green, 2 orange, 3 red. Literal v5 rule over the cards with a status (N/A excluded), "
                       "constants from param_status_rule (E-26, ADR-0013 (i)); follows period and region, ignores attribute filters.")

# ------------------------------------------------------------------ 8 Cards: window wrappers
F8 = "8 Cards"
WV = """VAR _s          = [_Window Start]
VAR _e          = [_Window End]"""
# LY window = the window's weeks one year back by ly_week_key (contiguous), blank in FY2025 (E-12, E-94)
LYV = """VAR _ls         = [_LY Window Start]
VAR _le         = [_LY Window End]"""
# previous-item window (E-94); EBITDA reads its own (month cut to the same weeks at Week, E-93)
LWV = """VAR _s2         = [_Prev Window Start]
VAR _e2         = [_Prev Window End]"""
EBV = """VAR _s2         = [_EB Prev Start]
VAR _e2         = [_EB Prev End]"""


class Hoist:
    """Inside an SVG measure (perf pass 2026-10-30): every distinct window CALCULATE becomes one VAR (_h1, _h2, ...), so the
    query plan holds each subtree once. Outside a Hoist block the wrappers return the expression itself."""
    stack = []

    def __enter__(self):
        Hoist.stack.append({})
        return self

    def __exit__(self, *a):
        self.vars = Hoist.stack.pop()

    def block(self):
        return "\n".join(f"VAR {n:<10} = {e}" for e, n in self.vars.items())


def H(expr):
    if not Hoist.stack:
        return expr
    d = Hoist.stack[-1]
    if expr not in d:
        d[expr] = f"_h{len(d) + 1}"
    return d[expr]


def W(x):
    return H(f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _s, dim_week[sort_index] <= _e )")


def LY(x):
    return H(f"IF ( NOT ISBLANK ( _ls ), CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _ls, dim_week[sort_index] <= _le ) )")


def LW(x):
    return H(f"IF ( NOT ISBLANK ( _s2 ), CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _s2, dim_week[sort_index] <= _e2 ) )")


def AT(x, idx):
    return f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] = {idx} )"


add("Window Status Count On", f"{WV}\nRETURN\n    {W('[Status Count On]')}", "0", F8, desc="On-track count in the card window (status line).")
add("Window Status Count Watch", f"{WV}\nRETURN\n    {W('[Status Count Watch]')}", "0", F8, desc="Watch count in the card window.")
add("Window Status Count Off", f"{WV}\nRETURN\n    {W('[Status Count Off]')}", "0", F8, desc="Off-track count in the card window.")
add("Window Status Count NA", f"{WV}\nRETURN\n    {W('[Status Count NA]')}", "0", F8, desc="N/A count in the card window.")
add("Window Status Dot", f"{WV}\nRETURN\n    {W('[Status Dot]')}", "0", F8, desc="Overall dot in the card window (ET-03).")


# ---------- DAX text helpers (return DAX expressions) ----------
def f_eur(x, dec=1):
    fmt = "#,0" + ("." + "0" * dec if dec else "")
    return f'IF ( {x} < 0, "−", "" ) & "€" & FORMAT ( ABS ( {x} ) / 1000000, "{fmt}" ) & "m"'


def f_sgn_eur(x):
    return f'IF ( {x} < 0, "−", "+" ) & "€" & FORMAT ( ABS ( {x} ) / 1000000, "#,0.0" ) & "m"'


def f_pct(x, fmt="0.0"):
    return f'FORMAT ( {x} * 100, "{fmt}" ) & "%"'


def f_sgn_pct(x):
    return f'IF ( {x} < 0, "−", "+" ) & FORMAT ( ABS ( {x} ) * 100, "0.0" ) & "%"'


def f_sgn_pp(x):
    return f'IF ( {x} < 0, "−", "+" ) & FORMAT ( ABS ( {x} ) * 100, "0.0" ) & " pp"'


def f_sgn(x, fmt="0.0"):
    return f'IF ( {x} < 0, "−", "+" ) & FORMAT ( ABS ( {x} ), "{fmt}" )'


def f_tgt_pct(x):
    return f'IF ( ABS ( {x} * 100 - ROUND ( {x} * 100, 0 ) ) < 0.000001, FORMAT ( {x} * 100, "0" ), FORMAT ( {x} * 100, "0.0" ) ) & "%"'


def f_int(x):
    return f'FORMAT ( {x}, "#,0" )'


CMP_LABEL = {"NET_SALES": "budget", "TOTAL_MARGIN": "budget", "WEEKS_OF_COVER": "target", "MARKDOWN": "budget", "AVAILABILITY": "target",
             "EBITDA": "budget", "LFL_GROWTH": "budget LFL", "FRONT_GM": "budget", "SELL_THROUGH": "target", "GMROI": "target",
             "SUPPLIER_OTIF": "target", "CHANNEL_MIX": "plan"}
SIZE = {"NET_SALES": "hero", "TOTAL_MARGIN": "hero", "WEEKS_OF_COVER": "hero", "MARKDOWN": "medium", "AVAILABILITY": "medium",
        "EBITDA": "medium"}  # the rest small; dim_kpi.size holds the same map (card_order 1-12)
COPY = {c["k"]: c for c in CARDS}
# cards a category pick cannot split (E-101): N/A face = value "–", delta "n/a by category" (js-exec CATEGORY_COPY.deltaNa)
CAT_NA = {"EBITDA": "[_Category Active]", "SUPPLIER_OTIF": "[_Category Active]",
          "SELL_THROUGH": "[_Category Active] && NOT ( TRUE () IN VALUES ( dim_category[is_seasonal] ) )"}
CAT_NA_DELTA = "n/a by category"


def value_text(u, x="_v"):
    """Card value text without the unit + the unit (view.ts numbers(): eurMParts / pctNum / num / pctSigned without %)."""
    if u == "EUR":
        vt, ut = F.eurMNum(x, na=False), '"m"'
    elif u == "PCT":
        vt, ut = F.pctNum(x, na=False), '"%"'
    elif u == "LFL":
        vt, ut = F.pctSigned(x, na=False) + ' & ""', '"%"'
        vt = f'SUBSTITUTE ( {F.pctSigned(x, na=False)}, "%", "" )'
    elif u == "WKS":
        vt, ut = F.num(x, na=False), '"wks"'
    elif u == "X":
        vt, ut = F.num(x, na=False), '"×"'
    else:
        vt, ut = F.pctNum(x, na=False), '"% store"'
    return vt, ut


def delta_text(k, cmp="[_Comparator Code]", gr="[_Granularity Code]", pshort="[_Prev Short]"):
    """Delta row label and body over _v _c _d _lab (labels as js-exec view.ts); body None for CHANNEL_MIX."""
    u, lbl = UNIT[k], CMP_LABEL[k]
    prev_lab = f'IF ( {gr} = "W", "vs prev. mth", {pshort} )' if k == "EBITDA" else pshort
    lab = f'SWITCH ( {cmp}, "LY", "vs LY", "LW", {prev_lab}, "vs {lbl}" )'
    if u == "EUR":
        body = f'{F.eurDelta("_d", na=False)} & " (" & {F.pctSigned("DIVIDE ( _v, _c ) - 1", na=False)} & ") " & _lab'
    elif u in ("PCT", "LFL"):
        cfmt = F.pctTarget("_c", na=False) if lbl == "target" else F.pct("_c", na=False)
        body = f'{F.pp("_d", na=False)} & " " & _lab & " " & IF ( {cmp} = "BUD", {cfmt}, {F.pct("_c", na=False)} )'
    elif u == "WKS":
        body = f'{F.signed("_d", " wks", na=False)} & " " & _lab & " " & {F.num("_c", na=False)}'
    elif u == "X":
        body = f'{F.signed("_d", "×", na=False)} & " " & _lab & " " & {F.num("_c", na=False)} & "×"'
    else:
        body = None
    return lab, body


for k in KPIS:
    v, b, u = VALUE[k], BASIS[k], UNIT[k]
    add(f"Card Value {k}", f"{WV}\nRETURN\n    {W(f'[{v}]')}", None, F8, desc=f"{k} card value: [{v}] in the card window.")
    add(f"Card Basis {k}", f"{WV}\nRETURN\n    {W(f'[{b}]')}", None, F8, desc=f"{k} status basis: [{b}] in the card window.")
    add(f"Card LY {k}", f"{LYV}\nRETURN\n    {LY(f'[{v}]')}", None, F8, desc=f"{k} value in the LY window (ly_week_key of every window week, E-12).")
    if k == "EBITDA":
        add(f"Card Prev {k}", f"{EBV}\nRETURN\n    {LW(f'[{v}]')}", None, F8,
            desc=f"{k} value in the previous window: at Week the previous month cut to the same number of weeks (E-93, ET-31), else the previous item (E-94).")
    else:
        add(f"Card Prev {k}", f"{LWV}\nRETURN\n    {LW(f'[{v}]')}", None, F8,
            desc=f"{k} value in the previous-item window (previous week / month / quarter, like-length when the item is partial, E-94).")
    add(f"Card Compare {k}", f"""
SWITCH (
    [_Comparator Code]
    ,"LY"
        ,[Card LY {k}]
    ,"LW"
        ,[Card Prev {k}]
    ,[Card Basis {k}]
)""", None, F8, desc=f"{k} comparator value: Budget / target, LY or the previous item (E-14, E-94).")
    add(f"Card Status {k}", f"{WV}\nRETURN\n    {W(f'[Status {k}]')}", "0", F8, desc=f"{k} status in the card window (always vs budget / target, E-24).")
    add(f"Card Delta {k}", f"""
VAR _v          = [Card Value {k}]
VAR _c          = [Card Compare {k}]
RETURN
    IF ( NOT ISBLANK ( _v ) && NOT ISBLANK ( _c ), _v - _c )""", None, F8, desc=f"{k} value - comparator.")
    vt, ut = value_text(u)
    vtx = f'IF ( ISBLANK ( _v ), "n/a", {vt} )'
    if k in CAT_NA:
        vtx = f'IF ( {CAT_NA[k]}, "–", {vtx} )'
    add(f"Card Value Text {k}", f"""
VAR _v          = [Card Value {k}]
RETURN
    {vtx}""", None, F8, desc=f"{k} value as displayed (E-42, js-exec format.ts), without the unit" + ("; '–' when a category pick cannot split the card (E-101)." if k in CAT_NA else "."))
    add(f"Card Unit Text {k}", f"""
IF ( ISBLANK ( [Card Value {k}] ), "", {ut} )""", None, F8, desc=f"{k} unit as displayed.")
    add(f"Card Basis Text {k}", f"""
VAR _v          = [Card Basis {k}]
RETURN
    IF ( ISBLANK ( _v ), "n/a", {vt} )""", None, F8,
        desc=f"{k} status basis as displayed on the i pop-up target line (E-57; same format as the card value), without the unit; n/a when blank.")
    lab, body = delta_text(k)
    if body:
        add(f"Card Delta Text {k}", f"""
VAR _v          = [Card Value {k}]
VAR _c          = [Card Compare {k}]
VAR _d          = _v - _c
VAR _lab        = {lab}
RETURN
    {(f'IF ( {CAT_NA[k]}, "{CAT_NA_DELTA}", ' if k in CAT_NA else "")}IF (
        ISBLANK ( _v ) || ISBLANK ( _c )
        ,"n/a " & _lab
        ,{body}
    ){(" )" if k in CAT_NA else "")}""", None, F8, desc=f"{k} delta row vs the comparator (E-14, E-42; labels as js-exec view.ts)"
        + ("; 'n/a by category' when a category pick cannot split the card (E-101)." if k in CAT_NA else "."))

# channel mix: comparator mix vector and the largest deviation
add("Card Mix Dev Channel", f"""
{WV}
{LYV}
{LWV}
VAR _cmp        = [_Comparator Code]
VAR _v1         = {W('[Mix Store %]')}
VAR _v2         = {W('[Mix Online %]')}
VAR _v3         = {W('[Mix Wholesale %]')}
VAR _c1         = SWITCH ( _cmp, "LY", {LY('[Mix Store %]')}, "LW", {LW('[Mix Store %]')}, {W('[Mix Store % Bud]')} )
VAR _c2         = SWITCH ( _cmp, "LY", {LY('[Mix Online %]')}, "LW", {LW('[Mix Online %]')}, {W('[Mix Online % Bud]')} )
VAR _c3         = SWITCH ( _cmp, "LY", {LY('[Mix Wholesale %]')}, "LW", {LW('[Mix Wholesale %]')}, {W('[Mix Wholesale % Bud]')} )
VAR _d1         = _v1 - _c1
VAR _d2         = _v2 - _c2
VAR _d3         = _v3 - _c3
VAR _j          =
    SWITCH (
        TRUE ()
        ,ABS ( _d1 ) >= ABS ( _d2 ) && ABS ( _d1 ) >= ABS ( _d3 )
            ,1
        ,ABS ( _d2 ) >= ABS ( _d3 )
            ,2
        ,3
    )
RETURN
    IF ( NOT ISBLANK ( _c1 ) && NOT ISBLANK ( _v1 ), _j * 1000 + SWITCH ( _j, 1, _d1, 2, _d2, _d3 ) )""", None, "9 Engine", True,
    desc="Channel mix delta vs the comparator mix, packed: channel x 1000 + signed share deviation (1 store, 2 online, 3 wholesale; first on a tie).")
add("Card Mix Dev pp", """
VAR _x          = [Card Mix Dev Channel]
RETURN
    IF ( NOT ISBLANK ( _x ), _x - ROUND ( _x / 1000, 0 ) * 1000 )""", PCT, F8, desc="Signed deviation of the largest-deviating channel vs the comparator mix.")
add("Card Mix Dev Channel No", """
VAR _x          = [Card Mix Dev Channel]
RETURN
    IF ( NOT ISBLANK ( _x ), ROUND ( _x / 1000, 0 ) )""", "0", F8, desc="Largest-deviating channel vs the comparator mix: 1 store, 2 online, 3 wholesale.")
add("Card Delta Text CHANNEL_MIX", f"""
VAR _j          = [Card Mix Dev Channel No]
VAR _d          = [Card Mix Dev pp]
VAR _lab        = SWITCH ( [_Comparator Code], "LY", "vs LY", "LW", [_Prev Short], "vs plan" )
RETURN
    IF (
        ISBLANK ( _j )
        ,"n/a " & _lab
        ,SWITCH ( _j, 1, "store", 2, "online", "wholesale" ) & " " & {F.pp("_d", na=False)} & " " & _lab
    )""", None, F8, desc="Channel mix delta row: the channel with the largest absolute deviation (data README Card formulas).")

for k in KPIS:
    add(f"Card Status Word {k}", f'SWITCH ( [Card Status {k}], 1, "On track", 2, "Watch", 3, "Off track", "N/A" )', None, F8,
        desc=f"{k} status word (E-21).")

# attribute filters: conceal in place (E-53 .. E-56)
for k in KPIS:
    parts = []
    for a, _lab, _vals in ATTRS:
        parts.append(f"( NOT ISFILTERED ( param_attr_{a} ) || LOOKUPVALUE ( dim_kpi[{a}], dim_kpi[kpi_code], \"{k}\" ) IN VALUES ( param_attr_{a}[attr_code] ) )")
    add(f"Card Revealed {k}", "\n    && ".join(parts), None, F8, desc=f"{k} stays revealed when, for every attribute with picks, its dim_kpi value is picked (OR within, AND across; E-54).")
add("Revealed Count", " + ".join(f"INT ( [Card Revealed {k}] )" for k in KPIS), "0", F8, desc="Cards revealed by the attribute filters (status-line summary, E-56).")
pick_parts = []
for a, _lab, _vals in ATTRS:
    pick_parts.append(f"VAR _{a:<10} = IF ( ISFILTERED ( param_attr_{a} ), CONCATENATEX ( VALUES ( param_attr_{a} ), param_attr_{a}[attr_label], \", \", param_attr_{a}[sort_order], ASC ) )")
PICK_TUPLES = ", ".join(f"( {i + 1}, _{a} )" for i, (a, _l, _v) in enumerate(ATTRS))
add("Filter Picks Text", "\n".join(pick_parts) + """
VAR _all        =
    CONCATENATEX (
        FILTER ( { {PICK_TUPLES} }, [Value2] <> "" )
        ,[Value2]
        ,", "
        ,[Value1], ASC
    )
RETURN
    IF ( _all = "", "All", _all )""".replace("{PICK_TUPLES}", PICK_TUPLES), None, F8, desc="Picked attribute labels in menu order, or All.")
add("Filter Pick Count", " + ".join(f"IF ( ISFILTERED ( param_attr_{a} ), COUNTROWS ( VALUES ( param_attr_{a}[attr_code] ) ), 0 )" for a, _l, _v in ATTRS),
    "0", F8, desc="Active attribute picks (side-bar badge, E-52).")

# header texts
add("Header Period Text", """
VAR _k          = [_Item Key]
RETURN
    CALCULATE ( MAX ( dim_item[header] ), REMOVEFILTERS ( dim_item ), dim_item[item_key] = _k )""", None, F8,
    desc="Header period line of the picked item (E-51, E-98): Week 43 · 19-25 Oct 2026, Quarter 4 to date · ..., FY2025 · ...; ** marks bold (up to ' to date').")
add("Header Comparator Text", """
SWITCH (
    [_Comparator Code]
    ,"LY"
        ,"vs **Last year** " & IF ( [_Granularity Code] = "W", "(same retail week)", "(same retail weeks)" )
    ,"LW"
        ,"vs **" & SWITCH ( [_Granularity Code], "P", "Previous month", "Q", "Previous quarter", "Previous week" ) & "**"
    ,"vs **Budget**"
)""", None, F8, desc="Header comparator phrase (E-14, E-94; js-exec view.ts header()).")
add("Header Region Text", """
SWITCH (
    [_Scope Code]
    ,"NL"
        ,"**Netherlands** · all formats"
    ,"BE"
        ,"**Belgium** · all formats"
    ,"ONLINE"
        ,"**Online** only"
    ,"All regions & formats"
) & [_Category Label]""", None, F8, desc="Header region phrase + the category segment of a pick (E-103).")
add("Refreshed Text", """
VAR _r          = MAX ( meta_dataset[refreshed] )
RETURN
    "Refreshed " & FORMAT ( _r, "ddd d mmm hh:nn" )""", None, F8, desc="Refresh stamp from manifest.json (E-05).")
add("Updated Text", """
VAR _r          = MAX ( meta_dataset[refreshed] )
RETURN
    "Updated " & FORMAT ( _r, "ddd hh:nn" )""", None, F8, desc="Pop-up footer stamp.")
add("Period Phrase", """
VAR _k          = [_Item Key]
RETURN
    CALCULATE ( MAX ( dim_item[phrase] ), REMOVEFILTERS ( dim_item ), dim_item[item_key] = _k )""", None, F8,
    desc="Window phrase for card sub-titles (E-92): week 43, month 10, quarter 4 to date, FY2026 to date (+ FY2025 when not the as-of FY).")
add("Item Title", """
VAR _k          = [_Item Key]
RETURN
    CALCULATE ( MAX ( dim_item[title] ), REMOVEFILTERS ( dim_item ), dim_item[item_key] = _k )""", None, F8,
    desc="Title of the picked item (E-51, E-98): Week 43, Month 10, Quarter 4, FY2026 (+ FY2025 when not the as-of FY); How-to-read eyebrow Nordmark · <title>.")
add("Period No", """
VAR _e          = [_Window End]
RETURN
    CALCULATE ( MAX ( dim_week[period] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )""", "0", F8,
    desc="Retail month (dim_week.period) of the window's last week: the EBITDA sub-title at Week, month 10 to date (E-40).")
add("Region Phrase", 'SWITCH ( [_Scope Code], "NL", "Netherlands", "BE", "Belgium", "ONLINE", "online", "all channels" )', None, F8,
    desc="Lower-case region phrase for card sub-titles.")

add("Supplier Income", """
SUMX (
    fact_supplier_income_week
    ,fact_supplier_income_week[rebate_accrual] + fact_supplier_income_week[promo_funding] + fact_supplier_income_week[listing_fees]
)""", EUR, F1, desc="Supplier income accrued (rebates + promo funding + listing fees). Equals Back Margin at ALL (ET-07). No site key.")

add("Status Pack", f"""
VAR _t          =
    {{
        {STAT_LIST}
    }}
VAR _on         = COUNTROWS ( FILTER ( _t, [Value] = 1 ) ) + 0
VAR _watch      = COUNTROWS ( FILTER ( _t, [Value] = 2 ) ) + 0
VAR _offc       = COUNTROWS ( FILTER ( _t, [Value] = 3 ) ) + 0
VAR _n          = _on + _watch + _offc
VAR _red        = LOOKUPVALUE ( param_status_rule[threshold], param_status_rule[rule_code], "DOT_RED_OFF" )
VAR _orange     = LOOKUPVALUE ( param_status_rule[threshold], param_status_rule[rule_code], "DOT_ORANGE_WATCH_OFF" )
VAR _green      = LOOKUPVALUE ( param_status_rule[threshold], param_status_rule[rule_code], "DOT_GREEN_GOOD" )
VAR _dot        =
    SWITCH (
        TRUE ()
        ,_n = 0
            ,0
        ,DIVIDE ( _offc, _n ) >= _red
            ,3
        ,DIVIDE ( _watch + _offc, _n ) > _orange
            ,2
        ,DIVIDE ( _on, _n ) >= _green
            ,1
        ,2
    )
RETURN
    _on * 1000 + _watch * 100 + _offc * 10 + _dot""", "0", F7, True,
    desc="On / watch / off counts and the dot in one pass over the 12 statuses (on x 1000 + watch x 100 + off x 10 + dot; dot 0 = no rated card, grey, E-95); the status line and the dot tooltip read it.")
add("Window Status Pack", f"{WV}\nRETURN\n    {W('[Status Pack]')}", "0", F8, True, desc="Status Pack in the card window.")

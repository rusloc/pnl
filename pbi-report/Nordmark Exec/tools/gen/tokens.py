"""DAX twins of js-exec/lib/engine/view.ts numbers(): worked example (rich, ** = bold) and the three mini stats of every
card, item / region / comparator aware (period model, ADR-0013 (k); E-93, E-98). The footer-left "Target ..." text is gone
(USER 2026-10-29). Variables expected in the measure: _s _e (window), _ls _le (LY), _s2 _e2 (previous item), _gr (type),
_wps _wqs _wys (month / quarter / FY start of the window's last week), _wq _wfy, _ps (EBITDA window start)."""
import fmt as F
from measures import W, LY, LW, H

NA = '"n/a"'


def P(x):
    """EBITDA flash window: month to date at Week, the item's own window otherwise (E-93)."""
    return H(f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _ps, dim_week[sort_index] <= _e )")


def MT(x):
    """Month to date through the window's last week."""
    return H(f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _wps, dim_week[sort_index] <= _e )")


def QT(x):
    """Quarter to date through the window's last week."""
    return H(f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _wqs, dim_week[sort_index] <= _e )")


def Y(x):
    """FY to date through the window's last week."""
    return H(f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] >= _wys, dim_week[sort_index] <= _e )")


def WK(x, raw=False):
    """The window's last week (point-in-time mini stats); raw = not hoisted (nested in another context or a row context)."""
    e = f"CALCULATE ( {x}, REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )"
    return e if raw else H(e)


def z(x):
    return f"( {x} + 0 )"


def bold(x):
    """Bold run kept on one line: spaces become no-break spaces."""
    return f'"**" & SUBSTITUTE ( {x}, " ", UNICHAR ( 160 ) ) & "**"'


def blank_any(*xs):
    return " || ".join(f"ISBLANK ( {x} )" for x in xs)


from copy_v5 import TS  # noqa: E402

SEASONAL_ONLY = TS["CATEGORY_COPY"]["seasonalOnly"]
VS_LY = '"vs LY " & [Window Noun]'
# stat vs the previous item: "vs last week" at Week (v5), else the short Δ suffix (vs prev. mth / qtr; vs LY at Year)
PREV_LAB = 'IF ( _gr = "W", "vs last week", [_Prev Short] )'


def ly_pp(m):
    cur, prev = W(f"[{m}]"), LY(f"[{m}]")
    return f"IF ( {blank_any(cur, prev)}, {NA}, {F.pp(cur + ' - ' + prev, na=False)} )"


def lw_pp(m):
    cur, prev = W(f"[{m}]"), LW(f"[{m}]")
    return f"IF ( {blank_any(cur, prev)}, {NA}, {F.pp(cur + ' - ' + prev, na=False)} )"


def budget_pp(a, b):
    return f'IF ( {blank_any(a, b)}, ".", ". Budget " & {F.pct(b, na=False)} & ", so " & {F.pp(a + " - " + b, na=False)} & "." )'


def cat(m, c):
    return W(f'CALCULATE ( [{m}], dim_category[category_code] = "{c}" )')


def catv(m, var):
    """Mini stat of the category held in a frame VAR (the pick's first / second category)."""
    return W(f'CALCULATE ( [{m}], dim_category[category_code] = {var} )')


def cat_name(c):
    return f'LOOKUPVALUE ( dim_category[category_name], dim_category[category_code], "{c}" )'


def card_numbers(k, word=None, pno="[Period No]"):
    """-> (example expr, [(label expr, value expr)] x 3). word / pno = DAX of the status word / retail month (defaults: the measures)."""
    word = word or f"[Card Status Word {k}]"
    if k == "NET_SALES":
        ns, bud, nly = W("[Net Sales]"), W("[Net Sales Bud]"), LY("[Net Sales]")
        ex = (f'{F.eurM(z(W("[Gross Sales]")))} & " at ticket − " & {F.eurM(z(W("[Markdown]")))} & " markdowns and discounts − " & '
              f'{F.eurM(z(W("[Returns]")))} & " returns = " & {bold(F.eurM(z(ns)))} & IF ( ISBLANK ( {bud} ), ".", ". Budget was " & '
              f'{F.eurM(bud, na=False)} & ", so " & {F.eurDelta(ns + " - " + bud, na=False)} & " (" & {F.pctSigned(f"DIVIDE ( {ns}, {bud} ) - 1", na=False)} & ")." )')
        fyb = "CALCULATE ( [Net Sales Bud], REMOVEFILTERS ( dim_week ), dim_week[fy] = _wfy )"
        # stats 2 and 3 by type (exec-period-model.md §4; js-exec view.ts netSalesStats)
        lab2 = '''SWITCH ( _gr, "W", "Month " & ''' + pno + ''' & " to date", "P", "Quarter " & _wq & " to date", "Q", "FY to date", "Budget full year" )'''
        val2 = (f'SWITCH ( _gr, "W", {F.eurM(z(MT("[Net Sales]")))}, "P", {F.eurM(z(QT("[Net Sales]")))}, "Q", {F.eurM(z(Y("[Net Sales]")))}, '
                f'{F.eurM(fyb)} )')
        lab3 = 'SWITCH ( _gr, "Q", "Previous quarter", "FY", "Last year", "Year to date" )'
        val3 = f'SWITCH ( _gr, "Q", {F.eurM(LW("[Net Sales]"))}, "FY", {F.eurM(nly)}, {F.eurM(z(Y("[Net Sales]")))} )'
        stats = [(VS_LY, f'IF ( {nly} = 0, {NA}, {F.pctSigned(f"DIVIDE ( {ns}, {nly} ) - 1", na=False)} )'), (lab2, val2), (lab3, val3)]
    elif k == "TOTAL_MARGIN":
        a, b = W("[Total Margin %]"), W("[Total Margin % Bud]")
        ex = (f'"Front " & {F.eurM(z(W("[Front Margin]")))} & " + back " & {F.eurM(z(W("[Back Margin]")))} & " = " & '
              f'{F.eurM(z(W("[Total Margin]")))} & "; ÷ " & {F.eurM(z(W("[Net Sales]")))} & " = " & {bold(F.pct(a))} & {budget_pp(a, b)}')
        stats = [('"Front margin"', F.pct(W("[Front GM %]"))), ('"Back margin"', F.pct(W("[Back Margin %]"))), (VS_LY, ly_pp("Total Margin %"))]
    elif k == "WEEKS_OF_COVER":
        wc, tgt = W("[Weeks of Cover]"), W("[Cover Target Wks]")
        ex = (f'{F.eurM(z(W("[Stock incl On Order]")), 0)} & " stock incl. on-order ÷ " & {F.eurM(z(W("[Forecast COGS]")))} & '
              f'" forecast weekly cost of goods = " & {bold(f"IF ( ISBLANK ( {wc} ), {NA}, {F.num(wc, na=False)} & {chr(34)} weeks{chr(34)} )")} & '
              f'IF ( {blank_any(wc, tgt)}, ".", ". Target " & {F.num(tgt, na=False)} & ", so " & {F.signed(wc + " - " + tgt, "", na=False)} & " → " & {word} & "." )')
        lw = LW("[Weeks of Cover]")
        stats = [('"On hand at cost"', F.eurM(z(W("[On Hand Cost]")), 0)), ('"On order"', F.eurM(z(W("[On Order Cost]")), 0)),
                 (PREV_LAB, f"IF ( {blank_any(wc, lw)}, {NA}, {F.signed(wc + ' - ' + lw, ' wks', na=False)} )")]
    elif k == "MARKDOWN":
        a, b = W("[Markdown %]"), W("[Markdown % Bud]")
        ex = (f'{F.eurM(z(W("[Markdown]")))} & " markdown ÷ " & {F.eurM(z(W("[Gross Sales]")))} & " gross sales = " & {bold(F.pct(a))} & '
              f'IF ( {blank_any(a, b)}, ".", ". Budget " & {F.pct(b, na=False)} & ", so " & {F.pp(a + " - " + b, na=False)} & "; lower is better → " & {word} & "." )')
        stats = [('"Markdown value"', F.eurM(z(W("[Markdown]")))), (VS_LY, ly_pp("Markdown %")), ('"Budget"', F.pct(b))]
    elif k == "AVAILABILITY":
        av, tgt = W("[Availability %]"), z(W("[Availability Target]"))
        ex = (f'IF ( ISBLANK ( {av} ), "Availability counts stores only; this selection has none.", '
              f'IF ( _gr = "W", "", "Last week of the " & [Window Noun] & ": " ) & "500 SKUs × " & {F.int_(z(W("[Trading Store Count]")))} & '
              f'" stores × 7 days = " & {F.int_(z(W("[Ranged SKU Days]")))} & " ranged; " & {F.int_(z(W("[In Stock SKU Days]")))} & " in stock → " & '
              f'{bold(F.pct(av, na=False))} & ". Target " & {F.pctTarget(tgt, na=False)} & ", so " & {F.pp(av + " - " + tgt, na=False)} & " → " & {word} & "." )')
        nl = H(f'CALCULATE ( {WK("[Availability %]", True)}, TREATAS ( {{ "NL" }}, param_region[scope_code] ) )')
        be = H(f'CALCULATE ( {WK("[Availability %]", True)}, TREATAS ( {{ "BE" }}, param_region[scope_code] ) )')
        low = """( VAR _low = TOPN ( 1, FILTER ( ADDCOLUMNS ( VALUES ( dim_category[category_name] ), "@av", """ + WK("[Availability %]", True) + \
              """ ), NOT ISBLANK ( [@av] ) ), [@av], ASC ) RETURN IF ( ISEMPTY ( _low ), "n/a", MAXX ( _low, dim_category[category_name] ) & " " & """ + \
              F.pct("MAXX ( _low, [@av] )", na=False) + " ) )"
        stats = [(PREV_LAB, f"IF ( ISBLANK ( {av} ), {NA}, {lw_pp('Availability %')} )"),
                 ('"Netherlands · Belgium"', f'{F.pct(nl)} & " · " & {F.pct(be)}'), ('"Lowest category"', low)]
    elif k == "EBITDA":
        e, b = z(P("[EBITDA]")), P("[EBITDA Bud]")
        ex = (f'{F.eurM(z(P("[Total Margin]")))} & " margin − " & {F.eurM(z(P("[Opex Shrink]")))} & " shrink − " & {F.eurM(z(P("[Opex Store]")))} & '
              f'" store − " & {F.eurM(z(P("[Opex Central]")))} & " central − " & {F.eurM(z(P("[Opex Fulfilment]")))} & " fulfilment = " & {bold(F.eurM(e, na=False))} & '
              f'" (" & {F.pct(P("[EBITDA Margin %]"))} & " of " & {F.eurM(z(P("[Net Sales]")))} & ")." & '
              f'IF ( ISBLANK ( {b} ), "", " Budget " & {F.eurM(b, na=False)} & ", so " & {F.eurDelta(e + " - " + b, na=False)} & " (" & {F.pctSigned(f"DIVIDE ( {e}, {b} ) - 1", na=False)} & ")." )')
        os_, ns_, osb, nsb = P("[Opex Store]"), P("[Net Sales]"), P("[Opex Store Bud]"), P("[Net Sales Bud]")
        stats = [('"EBITDA margin"', F.pct(P("[EBITDA Margin %]"))), ('"Budget margin"', F.pct(P("[EBITDA Margin % Bud]"))),
                 ('"Store costs vs plan"', f"IF ( {blank_any(os_, ns_, osb, nsb)} || {ns_} = 0 || {nsb} = 0, {NA}, "
                                           f"{F.pp(f'DIVIDE ( {os_}, {ns_} ) - DIVIDE ( {osb}, {nsb} )', na=False)} )")]
    elif k == "LFL_GROWTH":
        g, b = W("[LFL Growth %]"), W("[LFL Growth % Bud]")
        cnt = F.int_(z(W("[LFL Store Count]")))
        ex = (f'IF ( ISBLANK ( {g} ), "Like-for-like counts stores only; this selection has none.", {cnt} & " LFL stores: " & '
              f'{F.eurM(z(W("[LFL Net Sales]")))} & " ÷ " & {F.eurM(z(W("[LFL Net Sales LY]")))} & " − 1 = " & {bold(F.pctSigned(g, na=False))} & '
              f'IF ( ISBLANK ( {b} ), ".", ". Budget LFL " & {F.pct(b, na=False)} & ", so " & {F.pp(g + " - " + b, na=False)} & "." ) )')
        on, only = W("[Mix Online Net Sales]"), LY("[Mix Online Net Sales]")
        stats = [('"LFL stores"', f'IF ( ISBLANK ( {g} ), {NA}, {cnt} & " of " & {F.int_(z(W("[Trading Store Count]")))} )'),
                 ('"Non-LFL effect"', F.pp(W("[Non-LFL Effect pp]"))),
                 ('"Online LFL"', f'IF ( ISBLANK ( {only} ) || {only} = 0, {NA}, {F.pctSigned(f"DIVIDE ( {on}, {only} ) - 1", na=False)} )')]
    elif k == "FRONT_GM":
        a, b = W("[Front GM %]"), W("[Front GM % Bud]")
        ns = F.eurM(z(W("[Net Sales]")))
        ex = (f'{ns} & " − " & {F.eurM(z(W("[COGS]")))} & " cost of goods = " & {F.eurM(z(W("[Front Margin]")))} & "; ÷ " & {ns} & " = " & '
              f'{bold(F.pct(a))} & {budget_pp(a, b)}')
        stats = [('"Cost of goods"', F.eurM(z(W("[COGS]")))), ('"Front margin"', F.eurM(z(W("[Front Margin]")))), (VS_LY, ly_pp("Front GM %"))]
    elif k == "SELL_THROUGH":
        st, tgt = W("[Sell-through %]"), W("[Sell-through Target]")
        op, rc = z(W("[Season Opening Units]")), z(W("[Season Receipt Units]"))
        sw = "CALCULATE ( MAX ( dim_week[season_week] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e )"
        ln = ("( VAR _sc = CALCULATE ( MAX ( dim_week[season_code] ), REMOVEFILTERS ( dim_week ), dim_week[sort_index] = _e ) "
              "RETURN CALCULATE ( COUNTROWS ( dim_week ), REMOVEFILTERS ( dim_week ), dim_week[season_code] = _sc ) )")
        swt = f'IF ( ISBLANK ( {sw} ), {NA}, FORMAT ( {sw}, "0" ) )'
        nos = 'IF ( _gr = "W", "No season is open in the selected week.", "No season is open in the last week of the " & [Window Noun] & "." )'
        ex = (f'IF ( {blank_any(st, tgt)}, {nos}, {F.unitsM(z(W("[Season Units Sold]")))} & " units sold ÷ (" & '
              f'{F.unitsM(op)} & " opening + " & {F.unitsM(rc)} & " received = " & {F.unitsM(op + " + " + rc)} & ") = " & {bold(F.pct(st, na=False))} & '
              f'". Target " & {F.pctTarget(tgt, na=False)} & " at week " & {swt} & " of " & FORMAT ( {ln}, "0" ) & ", so " & {F.pp(st + " - " + tgt, na=False)} & "." '
              f'& IF ( _cact, "{SEASONAL_ONLY}", "" ) )')
        # the first two seasonal categories in context (Apparel, Home & kitchen at All), then vs LY season (js-exec seasonalStats)
        v1, v2 = F.pct(catv("Sell-through %", "_pc1"), 0), F.pct(catv("Sell-through %", "_pc2"), 0)
        vly = f"IF ( ISBLANK ( {st} ), {NA}, {ly_pp('Sell-through %')} )"
        stats = [('IF ( _pk >= 1, _pn1, "vs LY season" )', f"IF ( _pk >= 1, {v1}, {vly} )"),
                 ('IF ( _pk >= 2, _pn2, IF ( _pk = 1, "vs LY season", "" ) )', f'IF ( _pk >= 2, {v2}, IF ( _pk = 1, {vly}, "" ) )'),
                 ('IF ( _pk >= 2, "vs LY season", "" )', f'IF ( _pk >= 2, {vly}, "" )')]
    elif k == "GMROI":
        g, tgt = W("[GMROI]"), W("[GMROI Target]")
        fm, inv = z(W("[GMROI Front Margin R52W]")), z(W("[GMROI Avg On Hand Cost]"))
        ex = (f'IF ( {blank_any(g, tgt)}, "GMROI needs 52 weeks of history.", {F.eurM(fm, 0)} & " front margin ÷ " & {F.eurM(inv, 0)} & '
              f'" average stock = " & {bold(F.num(g, na=False) + chr(32) + "& " + chr(34) + "×" + chr(34))} & ". Target " & {F.num(tgt, na=False)} & '
              f'"×, so " & {F.signed(g + " - " + tgt, "×", na=False)} & "." )')
        catx = lambda c: f'{F.num(cat("GMROI", c))} & "×"'
        catvx = lambda var: f'{F.num(catv("GMROI", var))} & "×"'
        # H&B · Electronics at All; under a pick the first two picked categories (js-exec gmroiStat)
        glab = 'IF ( _cact, _pn1 & IF ( _pk >= 2, " · " & _pn2, "" ), "H&B · Electronics" )'
        gval = f'IF ( _cact, {catvx("_pc1")} & IF ( _pk >= 2, " · " & {catvx("_pc2")}, "" ), {catx("HB")} & " · " & {catx("ELEC")} )'
        stats = [('"R52W front margin"', F.eurM(fm, 0)), ('"Average stock at cost"', F.eurM(inv, 0)), (glab, gval)]
    elif k == "SUPPLIER_OTIF":
        o, tgt = z(W("[OTIF %]")), z(W("[OTIF Target]"))
        ex = (f'{F.int_(z(W("[PO Lines OTIF]")))} & " lines on time and in full ÷ " & {F.int_(z(W("[PO Lines Due]")))} & " lines due = " & '
              f'{bold(F.pct(o, na=False))} & ". Target " & {F.pctTarget(tgt, na=False)} & ", so " & {F.pp(o + " - " + tgt, na=False)} & "."')
        stats = [('"PO lines due"', F.int_(z(W("[PO Lines Due]")))), (PREV_LAB, lw_pp("OTIF %")),
                 ('"Suppliers below 85%"', F.int_(z(WK("[OTIF Suppliers Below 85]"))))]
    elif k == "CHANNEL_MIX":
        s1, s2, s3 = z(W("[Mix Store %]")), z(W("[Mix Online %]")), z(W("[Mix Wholesale %]"))
        b1, b2, b3 = W("[Mix Store % Bud]"), W("[Mix Online % Bud]"), W("[Mix Wholesale % Bud]")
        plan = f'{F.share(b1, na=False)} & " / " & {F.share(b2, na=False)} & " / " & {F.share(b3, na=False)}'
        dev = (f'SWITCH ( {W("[Mix Max Dev Channel]")}, 1, "store", 2, "online", "wholesale" ) & " " & {F.pp(W("[Mix Max Dev pp]"), na=False)}')
        ex = (f'"Store " & {F.eurM(z(W("[Mix Store Net Sales]")))} & ", online " & {F.eurM(z(W("[Mix Online Net Sales]")))} & ", wholesale " & '
              f'{F.eurM(z(W("[Mix Wholesale Net Sales]")))} & " of " & {F.eurM(z(W("[Net Sales]")))} & " → " & '
              f'{bold(F.pct(s1, na=False) + " & " + chr(34) + " / " + chr(34) + " & " + F.pct(s2, na=False) + " & " + chr(34) + " / " + chr(34) + " & " + F.pct(s3, na=False))} & '
              f'IF ( {blank_any(b1)}, ".", ". Plan " & {plan} & ", so " & {dev} & "." )')
        st = lambda s, b: f'{F.pct(s, na=False)} & " · " & IF ( ISBLANK ( {b} ), {NA}, {F.pp(s + " - " + b, na=False)} )'
        stats = [('"Store"', st(s1, b1)), ('"Online"', st(s2, b2)), ('"Wholesale"', st(s3, b3))]
    return ex, stats


def mix_chart():
    from common import C
    m1, m2, m3 = W("[Mix Store %]"), W("[Mix Online %]"), W("[Mix Wholesale %]")
    r = "' height='16' rx='3' fill='"
    return f"""VAR _m1         = {m1} + 0
VAR _m2         = {m2} + 0
VAR _m3         = {m3} + 0
VAR _bars       =
    "<rect x='256' y='170' width='" & FORMAT ( 236 * _m1, "0.0" ) & "{r}{C['mix1']}'/>"
        & "<rect x='" & FORMAT ( 258 + 236 * _m1, "0.0" ) & "' y='170' width='" & FORMAT ( 236 * _m2, "0.0" ) & "{r}{C['mix2']}'/>"
        & "<rect x='" & FORMAT ( 260 + 236 * ( _m1 + _m2 ), "0.0" ) & "' y='170' width='" & FORMAT ( 236 * _m3, "0.0" ) & "{r}{C['mix3']}'/>\""""

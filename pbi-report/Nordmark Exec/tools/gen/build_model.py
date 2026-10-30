"""Writes Nordmark Exec.SemanticModel (TMDL): 17 Parquet tables + meta_dataset (manifest.json) via DataFolder,
8 disconnected picker tables, _measures. Import mode, compatibility level 1702 (as Mirelo, ADR-0013 (g))."""
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import MODEL, NAME, DATA_FOLDER, tag, write_text, write_json  # noqa: E402
import measures  # noqa: E402
import measures_svg  # noqa: E402,F401
from copy_v5 import ATTRS  # noqa: E402

M = measures.M
DEF = os.path.join(MODEL, "definition")
MANIFEST = json.load(open(os.path.join(DATA_FOLDER, "manifest.json"), encoding="utf-8"))
COLS = {t["table"]: t["columns"] for t in MANIFEST["tables"]}
ARROW = {"string": ("string", "type text"), "int32": ("int64", "Int64.Type"), "int64": ("int64", "Int64.Type"),
         "double": ("double", "type number"), "bool": ("boolean", "type logical"), "date32[day]": ("dateTime", "type date")}
KEYWORDS = {"group", "table", "column", "measure", "partition", "model", "relationship", "expression", "annotation", "ref"}

T = {}
T["dim_week"] = dict(desc="Retail week, 4-5-4 calendar, FY2025 W1 .. FY2026 W52 (104 rows). sort_index 1-104 drives every window; ly_week_key / lw_week_key are the LY / LW keys (E-10 .. E-12).",
                     hidden=["sort_index", "ly_week_key", "lw_week_key", "week_key"], sort={"week_label": "sort_index", "period_key": "sort_index"})
T["dim_store"] = dict(desc="Site: 145 stores (142 trading at W43), ONLINE, WHOLESALE, DC_TIL, DC_WIL. scope_code = region switcher value (NL / BE / ONLINE; null for WHOLESALE and DCs).",
                      hidden=["sort_order", "store_code"], sort={"store_name": "sort_order"})
T["dim_category"] = dict(desc="Category (9) with cover, GMROI and sell-through targets.", hidden=["sort_order", "category_code"],
                         sort={"category_name": "sort_order"})
T["dim_supplier"] = dict(desc="Supplier (1,100); joins supplier income and PO lines.", hidden=["supplier_code"])
T["dim_cost_type"] = dict(desc="Cost type of the EBITDA bridge.", hidden=["sort_order", "cost_type_code"], sort={"cost_type_name": "sort_order"})
T["dim_kpi"] = dict(
    desc="The 32 KPIs of the spec catalogue: 12 landing cards (card_order 1-12) + 20 bench KPIs (More KPIs drawer). Attributes group / lever / horizon / owner / statement drive the Filters menu (E-53). Joins no fact. Derived on load: domain_order, owner_cadence.",
    steps=[("dom", 'Table.Group({prev}, {{"domain"}}, {{{{"domain_order", each List.Min([catalogue_no]), Int64.Type}}}})'),
           ("joined", 'Table.NestedJoin({prev_typed}, {{"domain"}}, dom, {{"domain"}}, "d", JoinKind.LeftOuter)'),
           ("expanded", 'Table.ExpandTableColumn(joined, "d", {{"domain_order"}})'),
           ("oc", 'Table.AddColumn(expanded, "owner_cadence", each if [owner_initials] = null then null else [owner_initials] & " · " & [cadence], type text)')],
    derived=[("domain_order", "int64", "Lowest catalogue_no of the domain (sorts the More KPIs drawer by domain)."),
             ("owner_cadence", "string", "Owner initials · cadence for the bench KPIs (e.g. CM · daily).")],
    hidden=["catalogue_no", "card_order", "domain_order", "value_metric", "basis_metric", "status_metric"],
    sort={"kpi_name": "catalogue_no", "domain": "domain_order"})


def fact(desc):
    return dict(desc=desc, hidden="*")


T["fact_sales_week"] = fact("Sales actuals, week x selling site x category (E-30 .. E-34, E-41). is_lfl / is_lfl_as_ly per row (E-31).")
T["fact_budget_week"] = fact("Budget FY2026 W1-W52, week x selling site x category.")
T["fact_supplier_income_week"] = fact("Supplier income accruals, week x supplier (source of back_margin_alloc, ET-07).")
T["fact_inventory_week"] = fact("Week-end stock snapshot, week x location x category. Never sum over weeks.")
T["fact_forecast_week"] = fact("Forward weekly COGS forecast, week x selling site x category (weeks of cover).")
T["fact_availability_week"] = fact("Top-500 SKU-days ranged / in stock, week x store x category.")
T["fact_receipts_week"] = fact("Receipt units into selling locations, week x site x category (sell-through).")
T["fact_po_week"] = fact("PO lines due / OTIF, week x supplier. No site key.")
T["fact_opex_week"] = fact("OpEx, scenario (ACT / BUD) x week x cost type x site (null = central).")
T["param_status_rule"] = dict(desc="Status rule per landing card (watch_from / off_from) + the 3 dot constants (E-22, E-26, E-75). Joins nothing.", table_hidden=True)
T["param_target"] = dict(desc="KPI x category (or ALL) targets. Joins nothing.", table_hidden=True)
IMPORT_ORDER = ["dim_week", "dim_store", "dim_category", "dim_supplier", "dim_cost_type", "dim_kpi", "fact_sales_week", "fact_budget_week",
                "fact_supplier_income_week", "fact_inventory_week", "fact_forecast_week", "fact_availability_week", "fact_receipts_week",
                "fact_po_week", "fact_opex_week", "param_status_rule", "param_target"]

REL = []
for f in IMPORT_ORDER:
    cols = COLS[f]
    if not f.startswith("fact_"):
        continue
    for col, dim in [("week_key", "dim_week"), ("store_code", "dim_store"), ("category_code", "dim_category"),
                     ("supplier_code", "dim_supplier"), ("cost_type_code", "dim_cost_type")]:
        if col in cols:
            REL.append((f, col, dim, col))


def q(name):
    if name in KEYWORDS or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        return "'" + name.replace("'", "''") + "'"
    return name


def col_block(table, name, dtype, hidden, src, sort=None, desc=None, calc=False, fmt=None):
    out = []
    if desc:
        out.append(f"\t/// {desc}")
    out.append(f"\tcolumn {q(name)}")
    out.append(f"\t\tdataType: {dtype}")
    if hidden:
        out.append("\t\tisHidden")
    if fmt:
        out.append(f"\t\tformatString: {fmt}")
    elif dtype == "dateTime":
        out.append("\t\tformatString: yyyy-mm-dd")
    elif dtype == "int64":
        out.append("\t\tformatString: 0")
    elif dtype == "double":
        out.append("\t\tformatString: #,0.00")
    out.append(f"\t\tlineageTag: {tag(table, name)}")
    out.append("\t\tsummarizeBy: none")
    if calc:
        out.append("\t\tisNameInferred")
        out.append(f"\t\tsourceColumn: [{src}]")
    else:
        out.append(f"\t\tsourceColumn: {src}")
    if sort:
        out.append(f"\t\tsortByColumn: {q(sort)}")
    out.append("")
    if dtype == "dateTime":
        out.append("\t\tannotation UnderlyingDateTimeDataType = Date")
        out.append("")
    out.append("\t\tannotation SummarizationSetBy = User")
    out.append("")
    return out


def m_partition(name, spec):
    cols = list(COLS[name].items())
    typed = ",\n".join(f'            {{"{c}", {ARROW[t][1]}}}' for c, t in cols)
    steps = [f'src = Parquet.Document(File.Contents(DataFolder & "\\{name}.parquet"))',
             f"typed = Table.TransformColumnTypes(\n        src,\n        {{\n{typed}\n        }}\n    )"]
    prev = "typed"
    for sname, sexpr in spec.get("steps", []):
        steps.append(f"{sname} = " + sexpr.format(prev=prev, prev_typed="typed"))
        prev = sname
    comment = ["// Portable source (ADR-0013 (b), E-80): one Parquet file per table in DataFolder. A file source does not fold:",
               "// the file is read whole; types are set explicitly (the data README Format section)."]
    body = "let\n" + "\n".join("    " + c for c in comment) + "\n" + ",\n".join("    " + s for s in steps) + f"\nin\n    {prev}"
    lines = [f"\tpartition {name} = m", "\t\tmode: import", "\t\tsource ="]
    lines += ["\t\t\t\t" + l if l else "" for l in body.split("\n")]
    return lines


def import_table(name):
    spec = T[name]
    out = [f"/// {spec['desc']}", f"table {name}", f"\tlineageTag: {tag(name)}"]
    if spec.get("table_hidden"):
        out.append("\tisHidden")
    out.append("")
    hidden = spec.get("hidden", [])
    derived = {d[0]: d for d in spec.get("derived", [])}
    allcols = [(c, ARROW[t][0]) for c, t in COLS[name].items()] + [(d[0], d[1]) for d in spec.get("derived", [])]
    for c, dtype in allcols:
        is_hidden = hidden == "*" or c in hidden or spec.get("table_hidden", False)
        out += col_block(name, c, dtype, is_hidden, c, spec.get("sort", {}).get(c), derived[c][2] if c in derived else None)
    out += m_partition(name, spec)
    out += ["", "\tannotation PBI_ResultType = Table", ""]
    return "\n".join(out)


def meta_table():
    out = ["/// Dataset metadata from parquet/manifest.json: as-of week (drives every window, E-05) and the refresh stamp.",
           "table meta_dataset", f"\tlineageTag: {tag('meta_dataset')}", "\tisHidden", ""]
    for c, dt, fmt in [("current_week_key", "string", None), ("as_of", "dateTime", None), ("refreshed", "dateTime", "yyyy-mm-dd hh:nn"),
                       ("seed", "int64", None)]:
        out += col_block("meta_dataset", c, dt, True, c, fmt=fmt)
    body = """let
    // manifest.json is written by the generator next to the Parquet files (data README Files).
    src = Json.Document(File.Contents(DataFolder & "\\manifest.json")),
    tbl = #table(
        type table [current_week_key = text, as_of = date, refreshed = datetime, seed = Int64.Type],
        {{src[current_week_key], Date.FromText(src[as_of]), DateTime.FromText(src[refreshed]), src[seed]}}
    )
in
    tbl"""
    out += ["\tpartition meta_dataset = m", "\t\tmode: import", "\t\tsource ="]
    out += ["\t\t\t\t" + l if l else "" for l in body.split("\n")]
    out += ["", "\tannotation PBI_ResultType = Table", ""]
    return "\n".join(out)


CALC = {}
CALC["param_granularity"] = dict(desc="Period type of the picker (E-90): Week, Month (4-5-4 retail period), Quarter, Year. Filters dim_item.",
                                 cols=[("granularity_code", "string", True), ("granularity_name", "string", False), ("sort_order", "int64", True)],
                                 sort={"granularity_name": "sort_order"},
                                 rows=[("W", "Week", 1), ("P", "Month", 2), ("Q", "Quarter", 3), ("FY", "Year", 4)])
CALC["param_comparator"] = dict(desc="Comparator switcher (E-14, E-94): Budget, Last year, Previous (week / month / quarter; hidden at Year). No Forecast (ADR-0013 OQ 6). Disconnected.",
                                cols=[("comparator_code", "string", True), ("comparator_name", "string", False), ("sort_order", "int64", True)],
                                sort={"comparator_name": "sort_order"},
                                rows=[("BUD", "Budget", 1), ("LY", "Last year", 2), ("LW", "Previous", 3)])
CALC["param_region"] = dict(desc="Region / format switcher (E-15): All, Netherlands, Belgium, Online only. Disconnected; leaf measures read scope_code.",
                            cols=[("scope_code", "string", True), ("region_name", "string", False), ("sort_order", "int64", True)],
                            sort={"region_name": "sort_order"},
                            rows=[("ALL", "All", 1), ("NL", "Netherlands", 2), ("BE", "Belgium", 3), ("ONLINE", "Online only", 4)])
for a, lab, vals in ATTRS:
    CALC[f"param_attr_{a}"] = dict(desc=f"Filters menu attribute {lab} (E-53): multi-select, OR within, AND across. Disconnected; matched to dim_kpi[{a}].",
                                    cols=[("attr_code", "string", True), ("attr_label", "string", False), ("sort_order", "int64", True)],
                                    sort={"attr_label": "sort_order"},
                                    rows=[(c, l, i + 1) for i, (c, l) in enumerate(vals)])


import dim_item  # noqa: E402
REL.append(("dim_item", "granularity_code", "param_granularity", "granularity_code"))


def calc_table(name):
    spec = CALC[name]
    out = [f"/// {spec['desc']}", f"table {name}", f"\tlineageTag: {tag(name)}", ""]
    for c, dtype, hidden in spec["cols"]:
        out += col_block(name, c, dtype, hidden, c, spec.get("sort", {}).get(c), calc=True)
    types = {"string": "STRING", "int64": "INTEGER"}
    hdr = "\n    ,".join(f'"{c}", {types[t]}' for c, t, _h in spec["cols"])
    rows = "\n        ,".join("{ " + ", ".join(f'"{v}"' if isinstance(v, str) else str(v) for v in r) + " }" for r in spec["rows"])
    dax = f"DATATABLE (\n    {hdr}\n    ,{{\n        {rows}\n    }}\n)"
    out += [f"\tpartition {name} = calculated", "\t\tmode: import", "\t\tsource ="]
    out += ["\t\t\t\t" + l for l in dax.split("\n")]
    out += ["", "\tannotation PBI_ResultType = Table", ""]
    return "\n".join(out)


def measures_table():
    out = ["/// Measure table. All report measures live here (CLAUDE.md Track B). Folders: 1-6 base metrics (window = dim_week rows in context),",
           "/// 7 Status, 8 Cards (card window, comparators, texts), 8 Cards SVG (image measures), 9 Engine (hidden helpers).",
           "table _measures", f"\tlineageTag: {tag('_measures')}", ""]
    seen = set()
    for m in M:
        assert m["name"] not in seen, m["name"]
        seen.add(m["name"])
        out.append(f"\t/// {m['desc']}")
        expr = m["expr"]
        if "\n" in expr:
            out.append(f"\tmeasure {q(m['name'])} =")
            out += ["\t\t\t" + l if l.strip() else "" for l in expr.split("\n")]
        else:
            out.append(f"\tmeasure {q(m['name'])} = {expr}")
        if m["fmt"]:
            out.append(f"\t\tformatString: {m['fmt']}")
        if m["hidden"]:
            out.append("\t\tisHidden")
        out.append(f"\t\tdisplayFolder: {m['folder']}")
        out.append(f"\t\tlineageTag: {tag('_measures', m['name'])}")
        if m["cat"]:
            out.append(f"\t\tdataCategory: {m['cat']}")
        out.append("")
    out += col_block("_measures", "measure_table", "int64", True, "measure_table", calc=True)
    out += ["\tpartition _measures = calculated", "\t\tmode: import", '\t\tsource = ROW ( "measure_table", 0 )', "",
            "\tannotation PBI_ResultType = Table", ""]
    return "\n".join(out)


def expressions():
    return f"""/// Folder that holds the Parquet files of data/nordmark_retail_dummy_data/parquet + manifest.json (absolute path; change it on another machine, E-80).
expression DataFolder = "{DATA_FOLDER}" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]
	lineageTag: {tag('expr', 'DataFolder')}
	queryGroup: Parameters

	annotation PBI_ResultType = Text
"""


def model_tmdl(tables):
    order = ["DataFolder", "meta_dataset"] + IMPORT_ORDER
    lines = ["model Model", "\tculture: en-US", "\tdefaultPowerBIDataSourceVersion: powerBI_V3",
             "\tdiscourageImplicitMeasures", "\tsourceQueryCulture: en-US", "\tdataAccessOptions",
             "\t\tlegacyRedirects", "\t\treturnErrorValuesAsNull", "",
             "queryGroup Parameters", "", "\tannotation PBI_QueryGroupOrder = 0", "",
             "annotation __PBI_TimeIntelligenceEnabled = 0", "",
             "annotation PBI_QueryOrder = [" + ", ".join(f'"{o}"' for o in order) + "]", "",
             'annotation PBI_ProTooling = ["DevMode"]', ""]
    lines += [f"ref table {q(t)}" for t in tables]
    lines.append("")
    return "\n".join(lines)


def relationships():
    out = []
    for f, fc, t, tc in REL:
        out += [f"relationship {tag('rel', f, fc, t, tc)}", f"\tfromColumn: {f}.{fc}", f"\ttoColumn: {t}.{tc}", ""]
    return "\n".join(out)


def main():
    if os.path.isdir(DEF):
        shutil.rmtree(DEF)
    tables = IMPORT_ORDER + ["meta_dataset"] + list(CALC) + ["_measures"]
    for name in IMPORT_ORDER:
        write_text(os.path.join(DEF, "tables", f"{name}.tmdl"), import_table(name))
    write_text(os.path.join(DEF, "tables", "meta_dataset.tmdl"), meta_table())
    for name in CALC:
        write_text(os.path.join(DEF, "tables", f"{name}.tmdl"), calc_table(name))
    write_text(os.path.join(DEF, "tables", "dim_item.tmdl"), dim_item.tmdl(tag, col_block))
    tables.insert(tables.index("_measures"), "dim_item")
    write_text(os.path.join(DEF, "tables", "_measures.tmdl"), measures_table())
    write_text(os.path.join(DEF, "expressions.tmdl"), expressions())
    write_text(os.path.join(DEF, "relationships.tmdl"), relationships())
    write_text(os.path.join(DEF, "model.tmdl"), model_tmdl(tables))
    write_text(os.path.join(DEF, "database.tmdl"), "database\n\tcompatibilityLevel: 1702\n\n")
    write_json(os.path.join(MODEL, "definition.pbism"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
        "version": "4.2", "settings": {}})
    write_json(os.path.join(MODEL, ".platform"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "SemanticModel", "displayName": NAME},
        "config": {"version": "2.0", "logicalId": tag("logical", "semanticmodel")}})
    print(f"model: {len(tables)} tables, {len(M)} measures, {len(REL)} relationships")


if __name__ == "__main__":
    main()

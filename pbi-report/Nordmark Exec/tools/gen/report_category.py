"""One-off report patch of the category round (ADR-0013 (l), exec-category-filter.md §5, E-100): the Category dropdown slicer
`menu_param_category` in the Filters menu under Region, the menu below it re-stacked, the panel SVG relabelled, the slicer added to
the four layer bookmarks (shown by bm_filters, hidden by the others). Idempotent: a second run changes nothing.
Usage: python report_category.py [ROOT]   (ROOT = folder holding 'Nordmark Exec.Report'; default: the report folder above tools/)"""
import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import wrap  # noqa: E402


def read(p):
    b = open(p, "rb").read()
    bom = b.startswith(b"\xef\xbb\xbf")
    t = b.decode("utf-8-sig")
    return json.loads(t), dict(bom=bom, crlf="\r\n" in t, tail=t[len(t.rstrip("\r\n")):])


def write(p, d, f):
    s = json.dumps(d, indent=2, ensure_ascii=False)
    if f["crlf"]:
        s = s.replace("\n", "\r\n")
    b = (s + f["tail"]).encode("utf-8")
    open(p, "wb").write((b"\xef\xbb\xbf" + b) if f["bom"] else b)


def lit(v):
    return {"expr": {"Literal": {"Value": v}}}

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(HERE, "..", ".."))
D = os.path.join(ROOT, "Nordmark Exec.Report", "definition")
V = os.path.join(D, "pages", "exec_landing", "visuals")
RR = os.path.join(ROOT, "Nordmark Exec.Report", "StaticResources", "RegisteredResources", "filters-panel.svg")
NAME = "menu_param_category"
PANEL_H = 790  # unchanged: the rows below the period block are re-stacked tighter

# page y of the slicers below the period block (svg y + 10); category = the new row
MOVE = {"menu_param_comparator": 422, "menu_param_region": 470, "menu_param_attr_group": 596, "menu_param_attr_lever": 678,
        "menu_param_attr_owner": 726}
CAT_Y, CAT_H = 510, 48  # a dropdown slicer needs 48 px (selector 32 + its own 8 / 8 padding; validator floor)
# section labels in the panel SVG: old baseline -> new baseline
LABELS = {"COMPARATOR": (412, 406), "REGION / FORMAT": (466, 454), "GROUP": (558, 580), "LEVER": (646, 662), "OWNER": (700, 710)}


def font():
    return lit("'''Segoe UI'', wf_segoe-ui_normal, helvetica, arial, sans-serif'")


def color(c):
    return {"solid": {"color": lit(f"'{c}'")}}


# ---------------------------------------------------------------- 1. the slicer
p = os.path.join(V, "menu_param_region", "visual.json")
region, fmt = read(p)
os.makedirs(os.path.join(V, NAME), exist_ok=True)
vis = {
    "$schema": region["$schema"],
    "name": NAME,
    "position": {"x": 86, "y": CAT_Y, "z": 9500, "height": CAT_H, "width": 320, "tabOrder": 5500},
    "visual": {
        "visualType": "slicer",
        "query": {"queryState": {"Values": {"projections": [{
            "field": {"Column": {"Expression": {"SourceRef": {"Entity": "dim_category"}}, "Property": "category_name"}},
            "queryRef": "dim_category.category_name", "nativeQueryRef": "category_name", "active": True}]}}},
        "objects": {
            "data": [{"properties": {"mode": lit("'Dropdown'")}}],
            "selection": [{"properties": {"selectAllCheckboxEnabled": lit("false"), "singleSelect": lit("false"),
                                          "strictSingleSelect": lit("false")}}],
            "header": [{"properties": {"show": lit("false")}}],
            "items": [{"properties": {"fontFamily": font(), "textSize": lit("11D"), "fontColor": color("#111827"),
                                      "background": color("#FFFFFF")}}],
        },
        "visualContainerObjects": {
            "title": [{"properties": {"show": lit("false")}}],
            "background": [{"properties": {"show": lit("false")}}],
            "border": [{"properties": {"show": lit("false")}}],
            "visualHeader": [{"properties": {"show": lit("false")}}],
            "dropShadow": [{"properties": {"show": lit("false")}}],
            "general": [{"properties": {"altText": lit("'Category picker'")}}],
            "padding": [{"properties": {k: lit("8D") for k in ("top", "bottom")} | {k: lit("0D") for k in ("left", "right")}}],
        },
        "drillFilterOtherVisuals": True,
    },
    "parentGroupName": "grp_filters",
    "isHidden": True,
}
write(os.path.join(V, NAME, "visual.json"), vis, fmt)

# ---------------------------------------------------------------- 2. the rows below Region move; the panel grows to 796
for name, y in MOVE.items():
    p = os.path.join(V, name, "visual.json")
    d, f = read(p)
    if d["position"]["y"] != y:
        d["position"]["y"] = y
        write(p, d, f)
p = os.path.join(V, "menu_panel", "visual.json")
d, f = read(p)
if d["position"]["height"] != PANEL_H:
    d["position"]["height"] = PANEL_H
    write(p, d, f)

# ---------------------------------------------------------------- 3. panel SVG: labels re-stacked, CATEGORY, no divider, hint names the category
b = open(RR, "rb").read()
s = b.decode("utf-8")
if ">CATEGORY<" not in s:
    s = s.replace("width='360' height='790' viewBox='0 0 360 790'", f"width='360' height='{PANEL_H}' viewBox='0 0 360 {PANEL_H}'")
    s = s.replace("height='789' rx='15.5'", f"height='{PANEL_H - 1}' rx='15.5'")
    for lab, (a, z) in LABELS.items():
        old = f"<text x='20' y='{a}' font-size='11' font-weight='600' fill='#5F6878' letter-spacing='0.66'>{lab.replace('/', '/')}</text>"
        assert s.count(old) == 1, lab
        s = s.replace(old, old.replace(f"y='{a}'", f"y='{z}'"))
    reg = "<text x='20' y='454' font-size='11' font-weight='600' fill='#5F6878' letter-spacing='0.66'>REGION / FORMAT</text>"
    s = s.replace(reg, reg + "<text x='20' y='502' font-size='11' font-weight='600' fill='#5F6878' letter-spacing='0.66'>CATEGORY</text>")
    div = "<line x1='20' y1='512' x2='340' y2='512' stroke='#EDEEF0'/>"
    assert s.count(div) == 1
    s = s.replace(div, "")
    s = s.replace("<text x='20' y='534' font-size='11' font-weight='600' fill='#5F6878' letter-spacing='0.66'>METRIC ATTRIBUTES",
                  "<text x='20' y='560' font-size='11' font-weight='600' fill='#5F6878' letter-spacing='0.66'>METRIC ATTRIBUTES")
    old_hint = ("<text x='20' y='56' font-size='11.5' fill='#5F6878'>Period, comparator and region change every number; the</text>"
                "<text x='20' y='72' font-size='11.5' fill='#5F6878'>status chip stays vs budget / target.</text>")
    assert s.count(old_hint) == 1
    lines = wrap("Period, comparator, region and category change every number; the status chip stays vs budget / target.", 320, 11.5)
    assert len(lines) == 2, lines
    s = s.replace(old_hint, "".join(f"<text x='20' y='{56 + 16 * i}' font-size='11.5' fill='#5F6878'>{t}</text>" for i, t in enumerate(lines)))
    open(RR, "wb").write(s.encode("utf-8"))

# ---------------------------------------------------------------- 4. bookmarks: the slicer is a target of every layer bookmark
for bm in ["bm_filters", "bm_how", "bm_more", "bm_close"]:
    p = os.path.join(D, "bookmarks", f"{bm}.bookmark.json")
    d, f = read(p)
    names = d["options"]["targetVisualNames"]
    if NAME in names:
        continue
    names.insert(names.index("menu_param_region") + 1, NAME)
    vc = d["explorationState"]["sections"]["exec_landing"]["visualContainers"]
    ref = copy.deepcopy(vc["menu_param_region"])
    ref["singleVisual"]["visualType"] = "slicer"
    items = list(vc.items())
    i = [k for k, _v in items].index("menu_param_region") + 1
    items.insert(i, (NAME, ref))
    d["explorationState"]["sections"]["exec_landing"]["visualContainers"] = dict(items)
    write(p, d, f)
print(f"category slicer {NAME} at y {CAT_Y} (h {CAT_H}); menu re-stacked; panel {PANEL_H}; 4 bookmarks")

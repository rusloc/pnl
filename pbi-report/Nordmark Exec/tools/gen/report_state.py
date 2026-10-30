"""Report-side patch of the Nordmark Exec PBIP (surgical; every other byte kept): tt_info follows the i pop-up height, and the
saved slicer state is reset to the documented default (Week / FY2026 / W43 / Budget / All, no attribute picks; README first-open).
Usage: python report_state.py [ROOT]   (ROOT = folder holding 'Nordmark Exec.Report'; default: the report folder above tools/)"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(HERE, "..", ".."))
D = os.path.join(ROOT, "Nordmark Exec.Report", "definition")
V = os.path.join(D, "pages", "exec_landing", "visuals")


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


def info_h():
    import measures  # noqa: F401
    import measures_svg
    return measures_svg.INFO_H


# 1. tt_info: page and visual = pop-up + 18, image = pop-up height
H = info_h()
p = os.path.join(D, "pages", "tt_info", "page.json")
d, f = read(p)
d["height"] = H + 18
write(p, d, f)
p = os.path.join(D, "pages", "tt_info", "visuals", "tt_info_svg", "visual.json")
d, f = read(p)
d["position"]["height"] = H + 18
d["visual"]["objects"]["grid"][0]["properties"]["imageHeight"] = lit(f"{H}D")
write(p, d, f)

# 2. saved slicer state = the documented default
DEFAULT = {"menu_param_granularity": "'Week'", "menu_item_fy": "'FY2026'", "menu_item": "'W43'", "menu_param_comparator": "'Budget'",
           "menu_param_region": "'All'"}
for name, val in DEFAULT.items():
    p = os.path.join(V, name, "visual.json")
    d, f = read(p)
    cond = d["visual"]["objects"]["general"][0]["properties"]["filter"]["filter"]["Where"][0]["Condition"]["In"]
    cond["Values"] = [[{"Literal": {"Value": val}}]]
    write(p, d, f)
for a in ["group", "lever", "owner"]:
    p = os.path.join(V, f"menu_param_attr_{a}", "visual.json")
    d, f = read(p)
    g = d["visual"].get("objects", {}).get("general")
    if g and "filter" in g[0].get("properties", {}):
        g[0]["properties"].pop("filter")
        write(p, d, f)
print(f"tt_info {548} x {H + 18} (image {H}); saved state Week / FY2026 / W43 / Budget / All, no attribute picks")

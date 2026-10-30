"""Export the rendered card faces, i pop-ups, header line and dot / counts of a set of picker states to a CSV for the
cross-flavour parity check (hunter; no Desktop needed on that side). Reads the SVG measures of a local Desktop instance through
run-dax.ps1 and parses them as XML, so the CSV holds exactly what the visuals draw.
Usage: python export_faces.py PORT OUT_CSV"""
import csv
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "gen"))
from measures import KPIS  # noqa: E402

PORT, OUT = sys.argv[1], sys.argv[2]
NS = "{http://www.w3.org/2000/svg}"


def pick(gran, fy, chip, cmp, region, cats=()):
    col = "label_wide" if gran in ("Q", "FY") else "label"
    f = [f'TREATAS ( {{ "{gran}" }}, param_granularity[granularity_code] )', f'TREATAS ( {{ "{fy}" }}, dim_item[fy_label] )',
         f'TREATAS ( {{ "{chip}" }}, dim_item[{col}] )', f'TREATAS ( {{ "{cmp}" }}, param_comparator[comparator_code] )',
         f'TREATAS ( {{ "{region}" }}, param_region[scope_code] )']
    if cats:
        f.append("TREATAS ( { " + ", ".join(f'"{c}"' for c in cats) + " }, dim_category[category_name] )")
    return f


STATES = [
    ("W43 · Budget · All", pick("W", "FY2026", "W43", "BUD", "ALL")),
    ("FY2026-W20 · Budget · All", pick("W", "FY2026", "W20", "BUD", "ALL")),
    ("FY2025-P10 · Last year · All", pick("P", "FY2025", "P10", "LY", "ALL")),
    ("FY2026-Q4 · Previous · NL", pick("Q", "FY2026", "Q4 · to date", "LW", "NL")),
    ("ALL#ELEC · W43 · Budget", pick("W", "FY2026", "W43", "BUD", "ALL", ["Electronics"])),
    ("NL#ELEC+TOYS · FY2026-P10 · Previous", pick("P", "FY2026", "P10", "LW", "NL", ["Electronics", "Toys & leisure"])),
    ("FY2026 · Budget · All", pick("FY", "FY2026", "FY2026 · to date", "BUD", "ALL")),
]
MEASURES = ["Header SVG", "Window Status Pack"] + [f"Card SVG {k}" for k in KPIS] + [f"Info SVG {k}" for k in KPIS]


def query(filters):
    rows = "\n        ,".join(f'ROW ( "m", "{m}", "s", [{m}] & "" )' for m in MEASURES)
    dax = f"EVALUATE\nCALCULATETABLE (\n    UNION (\n        {rows}\n    )\n    ,{chr(10).join(',' + x if i else x for i, x in enumerate(filters))}\n)\n"
    with tempfile.TemporaryDirectory() as d:
        q, o = os.path.join(d, "q.dax"), os.path.join(d, "o.csv")
        open(q, "w", encoding="utf-8").write(dax)
        subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", os.path.join(HERE, "run-dax.ps1"),
                        "-DaxFile", q, "-Port", str(PORT), "-OutCsv", o], check=True, capture_output=True)
        out = {}
        for line in open(o, encoding="utf-8"):
            _set, m, s = line.rstrip("\n").split("\t", 2)
            out[m] = s
        return out


def svg(url):
    return ET.fromstring(urllib.parse.unquote(url.split(",", 1)[1]))


def texts(root):
    """(x, y, full text) of every top-level text element, tspans included."""
    return [(float(t.get("x", 0)), float(t.get("y", 0)), "".join(t.itertext())) for t in root.iter(NS + "text")]


def at(ts, y, x=None):
    hits = [t for t in ts if abs(t[1] - y) < 0.01 and (x is None or abs(t[0] - x) < 0.01)]
    return hits[0][2] if hits else ""


def card_fields(k, root):
    t = root.find(NS + "g")
    ts = texts(t)
    tl = [x for x in ts if x[1] == 27 and x[0] == 16][0][2]
    title, _, sub = tl.partition(" · ")
    vel = [e for e in t.iter(NS + "text") if e.find(NS + "tspan") is not None and e.get("letter-spacing") == "-0.5"][0]
    value, unit = (vel.text or ""), "".join(vel.find(NS + "tspan").itertext())
    chip = [x[2] for x in ts if x[2][:1] in "▲●▼–" and x[1] in (26.0,)]
    big = root.get("width") == "437"
    if big:
        delta = [x[2] for x in ts if x[0] == 16 and x[1] in (102.0, 90.0)][0]
    else:
        delta = " ".join(x[2] for x in ts if x[0] == 16 and x[1] in (85.0, 101.0, 117.0) and x[2])
    word = {"▲": "On track", "●": "Watch", "▼": "Off track", "–": "N/A"}[chip[0][:1]] if chip else ""
    return [("title", title), ("sub-title", sub), ("value", value), ("unit", unit), ("delta", delta), ("status", word)]


def info_fields(k, root):
    ts = texts(root)
    big = [e for e in root.iter(NS + "text") if e.get("font-size") == "48"][0]
    actual = (big.text or "") + "".join(big.find(NS + "tspan").itertext())
    blab = at(ts, 148, 52)
    bval = at(ts, 180, 24)
    delta = at(ts, 201, 24)
    ex = " ".join(x[2] for x in ts if x[0] == 156 and x[2]).replace("  ", " ")
    note = next((n for n in NOTES if n in ex), "")
    return [("i actual", actual), ("i basis label", blab), ("i basis value", bval), ("i delta", delta), ("i note", note)]


NOTES = ["Not split by category — OpEx is booked per site and centrally.", "Not split by category — PO lines are per supplier.",
         "No seasonal category in the selection."]

rows = []
for name, flt in STATES:
    r = query(flt)
    head = svg(r["Header SVG"])
    line = [e for e in head.iter(NS + "text") if e.get("y") == "29" and e.get("text-anchor") != "end"][0]
    segs, cur = [], [line.text or ""]
    for s in line:
        if s.get("dx") == "18":  # comparator and region segments
            segs.append("".join(cur)); cur = ["".join(s.itertext())]
        else:
            cur.append("".join(s.itertext()))
        cur.append(s.tail or "")
    segs.append("".join(cur))
    rows.append((name, "header", "line", "   ".join(re.sub(r"\s+", " ", x).strip() for x in segs)))
    pk = int(float(r["Window Status Pack"] or 0))
    rows.append((name, "status line", "counts on / watch / off", f"{pk // 1000} / {pk % 1000 // 100} / {pk % 100 // 10}"))
    rows.append((name, "status line", "dot", {1: "green", 2: "orange", 3: "red"}.get(pk % 10, "grey")))
    for k in KPIS:
        for f, v in card_fields(k, svg(r[f"Card SVG {k}"])):
            rows.append((name, k, f, v))
        for f, v in info_fields(k, svg(r[f"Info SVG {k}"])):
            rows.append((name, k, f, v))
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, lineterminator="\n")
    w.writerow(["state", "card", "field", "text"])
    w.writerows(rows)
print(f"{len(rows)} rows -> {OUT}")

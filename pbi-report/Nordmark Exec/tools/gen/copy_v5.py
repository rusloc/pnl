"""Card and pop-up copy for the Nordmark Exec PBI flavour.

Single source (ADR-0013 (j) sync point 1, coordinator 2026-10-28): js-exec/lib/engine/copy.ts, exported to JSON with
node at build time (export_copy()); the sentences built in js-exec/lib/engine/view.ts (worked examples, stats, How to
read, dot tip, Notes footer) are mirrored in tokens.py / measures_svg.py. Card titles = dim_kpi.kpi_name.
"""
import json
import os
import subprocess

from common import REPO  # noqa: E402
JS_EXEC = os.environ.get("NORDMARK_JS_EXEC", os.path.join(REPO, "js-exec"))
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "copy_ts.json")


def export_copy():
    js = "import('./lib/engine/copy.ts').then(m => process.stdout.write(JSON.stringify(m)))"
    r = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", js], cwd=JS_EXEC,
                       capture_output=True, text=True, encoding="utf-8", check=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(r.stdout)


if not os.path.exists(OUT) or os.environ.get("NORDMARK_COPY_REFRESH"):
    export_copy()
TS = json.load(open(OUT, encoding="utf-8"))

TITLES = {"NET_SALES": "Net sales", "TOTAL_MARGIN": "Total margin", "WEEKS_OF_COVER": "Weeks of cover", "MARKDOWN": "Markdown",
          "AVAILABILITY": "Availability", "EBITDA": "EBITDA flash", "LFL_GROWTH": "Like-for-like growth", "FRONT_GM": "Front gross margin",
          "SELL_THROUGH": "Sell-through", "GMROI": "GMROI", "SUPPLIER_OTIF": "Supplier OTIF", "CHANNEL_MIX": "Channel mix"}
PAGE_OF = {"NET_SALES": "Sales", "TOTAL_MARGIN": "Margin", "WEEKS_OF_COVER": "Inventory", "MARKDOWN": "Margin", "AVAILABILITY": "Inventory",
           "EBITDA": "Margin", "LFL_GROWTH": "Sales", "FRONT_GM": "Margin", "SELL_THROUGH": "Inventory", "GMROI": "Inventory",
           "SUPPLIER_OTIF": "Supplier", "CHANNEL_MIX": "Channel"}  # = dim_kpi.drill_page

CARDS = []
for k, title in TITLES.items():
    c = TS["CARD_COPY"][k]
    CARDS.append(dict(k=k, title=title, sub=c["sub"], what=c["what"], why=c["why"], formula=c["formula"], rule=c["rule"],
                      cadence=c["cadence"], prov=c.get("provisional"), page=PAGE_OF[k],
                      steps=[tuple(s) for s in c["drill"]]))

PAGE = TS["DRILL_PAGES"]
ATTRS = [(a["key"], a["label"], [tuple(o) for o in a["options"]]) for a in TS["ATTRIBUTES"]]
SIDEBAR_TIPS = {k: "".join(v) for k, v in TS["SIDEBAR_TIPS"].items()}
PERIOD_WORDS = TS["PERIOD_WORDS"]
SWITCH_LABELS = TS["SWITCH_LABELS"]
BASIS_LABEL = TS["BASIS_LABEL"]

# view.ts how(): bullets as rich text (** = bold); {cmp} = comparator name (CMP_LABEL)
HOW = [
    "**Three numbers** carry the page: Net sales (sell more), Total margin % (keep more), Weeks of cover (turn stock faster). The nine tiles below explain them: card size follows importance, worst first.",
    "**Status** is vs the metric’s target: ▲ On track · ● Watch · ▼ Off track; the card is washed in the status colour; hover a chip for the rule. The **Δ line** is vs the comparator in the header ({cmp}). The **dot** before the counts is the overall status over the cards with a status; hover it for the rule.",
    "**Bars** = the last 13 weeks, 12 months, 8 quarters or 2 years up to the picked period; the picked one is in the status colour, the dotted line is the target.",
    "**ⓘ** opens the plain-English explanation and a worked example; the **binoculars** open the drill path to the drill page and its lowest grain.",
    "**Side bar**: Filters (period, comparator, region, category and the metric attributes; inside one attribute a choice is OR, across attributes AND; filtered-out cards fade in place so nothing moves; the badge counts active choices; Reset clears), How to read, More KPIs (the 20 bench metrics, inactive).",
    "**prov.** in a title = provisional until close (true-up 10 Nov). Illustrative data · EUR · NL + BE · LY = same retail week.",
]

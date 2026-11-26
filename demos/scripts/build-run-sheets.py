"""Build one HTML run sheet per demo case: timeline + click order + script.

Scene times, on-screen text and voice-over are parsed from demos/0N-*/script.md
(single source); click sequences are defined here from each guide.md § 4.

Run (stdlib only): python demos/scripts/build-run-sheets.py [repo-root]
Rerun after every script.md or guide.md § 4 change. ADR-0018.
"""
import html, json, re, sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]

# kind: do = click/type, wait = wait for result, show = point at / hold, post = added in edit, if = fallback
C = {
"01-migration": {
  "title": "Case 1 · Power BI to Fabric migration",
  "pre": [
    ("do", "Fabric › `ws_migration_demo` › open report **Sales Import** (browser window 1)"),
    ("do", "Open report **Sales Direct Lake** (window 2) › snap both side by side"),
    ("do", "Click through both reports once (warm cache)"),
    ("do", "Open `nb_02_append_day` › **Connect** › wait until the Spark session is ready"),
    ("do", "Desktop: open `Sales Import.pbix` (B-roll) · Fabric tab: `nb_01_build_sales_demo` at cell 3"),
    ("show", "Check: both reports match; `Sales Import` refreshed after the last data change"),
    ("do", "Stopwatch overlay on › start recording"),
  ],
  "scenes": {
    1: [("show", "Hold the split screen 3–4 s"), ("show", "Hover the four cards left, then right")],
    2: [("do", "Switch to the `nb_02_append_day` tab › **Run all**"),
        ("wait", "Output: `Appended 50,000 lines for 2026-11-01`"),
        ("show", "Note the finish time (start of the Direct Lake clock)")],
    3: [("do", "Window 2 (**Sales Direct Lake**) › report toolbar **Refresh**"),
        ("show", "Point: Last Order Date (fx) › Order Lines (fx) › Data As Of (fx)"),
        ("if", "No change after 60 s: `Sales Direct Lake` (model) › **Refresh now** once")],
    4: [("do", "Window 1 (**Sales Import**) › **Refresh**"), ("show", "Point at the unchanged cards")],
    5: [("wait", "About 1 min after the notebook finished (SQL endpoint sync)"),
        ("do", "Workspace › `Sales Import` (semantic model) › **…** › **Refresh now**"),
        ("do", "Start the stopwatch")],
    6: [("do", "Desktop › **Transform data** › query **Customer** › step *Merged Columns*"),
        ("do", "Query **Sales** › steps *Added Net Amount*, *Added Cost Amount* › Close"),
        ("do", "Table view › **Product** › column **Price Band** (formula bar)"),
        ("do", "Table view › **Date** (formula bar: calculated table)"),
        ("do", "Fabric › `nb_01_build_sales_demo` › scroll to **cell 3**"),
        ("post", "Time-lapse the refresh; stopwatch stays in the corner; tag “sped up”")],
    7: [("post", "Overlay card: Refresh · Editing · First query · Licence")],
    8: [("wait", "Refresh finishes"),
        ("do", "`Sales Import` › **Settings** › **Refresh history** › point at the duration"),
        ("do", "Window 1 › **Refresh** › cards match window 2"),
        ("if", "New day missing: lakehouse › SQL analytics endpoint › **Refresh**, then model **Refresh now** again")],
    9: [("show", "Split screen; optional: open the Data pane on both reports (same measures)")],
    10: [("post", "Closing card")],
  },
  "reset": [("do", "Rerun `nb_01_build_sales_demo` (overwrites every table, about 3 min)"),
            ("do", "`Sales Import` › **Refresh now** (about 5 min)")],
},
"02-slow-report": {
  "title": "Case 2 · Slow report, live fix",
  "pre": [
    ("do", "Desktop › open `Slow Report Demo.pbix` (slow body) › click every visual once"),
    ("do", "DAX Studio › connect to `Slow Report Demo` › **Server Timings** on › open `perf_test.dax`"),
    ("do", "Editor: `measures.dax` open at the optimized body (for the paste)"),
    ("show", "Check: `perf_log.md` holds the rehearsal numbers for every `{…}`"),
    ("do", "Timer overlay on › start recording"),
  ],
  "scenes": {
    1: [("do", "Page **Sales by brand** › **Country** slicer › pick a country not clicked yet"),
        ("wait", "Matrix spins (keep 2 s, cut the rest)")],
    2: [("do", "**Optimize** ribbon › **Performance analyzer** › **Start recording**"),
        ("do", "Country slicer › another fresh country"),
        ("wait", "Matrix redraws"),
        ("do", "Performance analyzer › expand the matrix row"),
        ("show", "Point: **DAX query** vs **Visual display**")],
    3: [("do", "Matrix row › **Copy query**"),
        ("do", "DAX Studio › new query › paste › Run ▾ **Clear Cache then Run**"),
        ("wait", "Query finishes (cut the wait)"),
        ("do", "**Server Timings** tab"),
        ("show", "Point: Total › FE share › the SE line with the big Rows value")],
    4: [("do", "Power BI › Data pane › `_Measures` › **Big Line Sales (fx)**"),
        ("show", "Formula bar: select `FILTER ( Sales, ... )`")],
    5: [("show", "Show the optimized body (`measures.dax`) next to the slow one"),
        ("do", "DAX Studio › `perf_test.dax` block 1 `[Slow]` › **Clear Cache then Run**"),
        ("do", "Block 2 `[Fast]` › **Clear Cache then Run**"),
        ("post", "Caption: {slow} s → {fast} s")],
    6: [("do", "Block 3 (difference query) › **Run**"), ("show", "Results pane: no rows")],
    7: [("do", "Power BI › Big Line Sales (fx) formula bar › paste the optimized body › **Enter**"),
        ("do", "Country slicer › the **same** country as in scene 2 (the measure edit clears the cache)"),
        ("show", "Matrix redraws at once; **Big Line Sales (fx)** card unchanged")],
    8: [("do", "DAX Studio › block 4 (search query) › **Run**"), ("show", "Point at the measure list")],
    9: [("post", "Closing card")],
  },
  "reset": [("do", "Close Power BI **without saving** › reopen `Slow Report Demo.pbix`")],
},
"03-cicd": {
  "title": "Case 3 · Fabric CI/CD: from Publish to one-click deployment",
  "pre": [
    ("do", "VS Code › `C:\\__PBI\\fabric-cicd-demo` › `_Measures.tmdl` at the Margin % line"),
    ("do", "Browser tabs: GitHub commits · Dev **Source control** · `dp_cicd_demo` · Dev report · Prod report"),
    ("do", "Desktop with a local PBIX (e.g. `Sales Import.pbix`) for scene 1"),
    ("show", "Check: both reports 66.7 % · Dev Source control empty · `git status` clean"),
    ("do", "Start recording"),
  ],
  "scenes": {
    1: [("do", "Desktop › Home › **Publish** › pick `ws_migration_demo`"),
        ("show", "Prompt “Replace this semantic model?”"),
        ("do", "**Cancel** (never Replace: it overwrites the Case 1 model)")],
    2: [("post", "Overlay: VS Code → GitHub → Dev → pipeline → Prod"),
        ("do", "Dev report tab and Prod report tab side by side"),
        ("show", "Point: Margin % (fx) 66.7 % · Environment cards dev / prod")],
    3: [("do", "VS Code › Margin % line: `[Cost Amount (fx)]` → `[Sales Amount (fx)]` › **Ctrl+S**"),
        ("if", "Off camera: `git diff --stat` = 1 insertion, 1 deletion"),
        ("do", "Source Control panel › message `Margin % fix` › **Commit** › **Sync Changes**")],
    4: [("do", "GitHub tab › reload commits › **Margin % fix**"), ("show", "Diff: one changed line")],
    5: [("do", "Dev workspace tab › **Source control** › **Updates** (1) › **Update all**"),
        ("wait", "Update done (cut the wait; note seconds)"),
        ("do", "Dev report tab › **Refresh**"), ("show", "Margin % (fx) 40.0 %")],
    6: [("do", "Pipeline tab › Production: `Sales CICD` marked different › tick it"),
        ("do", "**Deploy** › note `Margin % fix` › **Deploy**"),
        ("wait", "Succeeded (cut the wait; caption the seconds)"),
        ("do", "Prod report tab › **Refresh**"),
        ("show", "Margin % (fx) 40.0 % · Environment `ws_cicd_demo_prod`")],
    7: [("do", "Pipeline › **Deployment history**"), ("do", "GitHub commits tab side by side")],
    8: [("post", "Closing card")],
  },
  "reset": [("do", "VS Code: Margin % line back to `[Cost Amount (fx)]` › Ctrl+S › commit `Revert Margin % for demo` › push"),
            ("do", "Dev › Source control › Updates › **Update all**"),
            ("do", "Pipeline › **Deploy** to Production, note `Revert Margin % for demo` › both reports 66.7 %")],
},
}

def md_inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![*\w])\*([^*]+)\*(?!\*)", r"<em>\1</em>", t)
    t = re.sub(r"(\{[^}]+\})", r'<span class="ph">\1</span>', t)
    return t

def secs(m):
    a, b = m.split(":"); return int(a) * 60 + int(b)

def section(md, name):
    m = re.search(r"^## " + re.escape(name) + r"\n(.*?)(?=^## |\Z)", md, re.S | re.M)
    return m.group(1).strip() if m else ""

def bullets(txt):
    out = []
    for line in txt.splitlines():
        line = line.strip()
        if line.startswith("- "):
            out.append(line[2:])
        elif out and line:
            out[-1] += " " + line
    return out or ([txt] if txt else [])

def parse(md):
    rows = []
    for line in md.splitlines():
        m = re.match(r'^\| (\d+) \| (\d+:\d+)–(\d+:\d+) \| (.*) \| "(.*)" \|$', line)
        if m:
            n, a, b, screen, vo = m.groups()
            rows.append(dict(n=int(n), start=secs(a), end=secs(b), t=f"{a}–{b}", screen=screen, vo=vo))
    head = md.splitlines()
    status = next((l for l in head if l.startswith("Status:")), "")
    claim = re.search(r"\*\*The one claim:\*\* (.*)", md).group(1)
    return rows, status, claim

KIND = {"do": "Click", "wait": "Wait", "show": "Show", "post": "Edit", "if": "If"}

def steps_html(items, counter):
    out = []
    for kind, txt in items:
        num = ""
        if kind == "do":
            counter[0] += 1
            num = f'<span class="num">{counter[0]}</span>'
        out.append(f'<li class="k-{kind}">{num}<span class="kind">{KIND[kind]}</span><span class="txt">{md_inline(txt)}</span></li>')
    return "\n".join(out)

CSS = """
:root{--bg:#f7f7f5;--panel:#ffffff;--ink:#1d1d1f;--muted:#6b6b70;--line:#e3e3e0;--accent:#2f6fde;
--do:#2f6fde;--wait:#b7791f;--show:#2f855a;--post:#805ad5;--if:#c53030;--ph:#fff4d6;--phink:#7a5200;
--s1:#3b82f6;--s2:#10b981;--s3:#f59e0b;--s4:#ef4444;--s5:#8b5cf6;--s6:#06b6d4;--s7:#ec4899;--s8:#84cc16;--s9:#f97316;--s10:#64748b}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121214;--panel:#1c1c1f;--ink:#ececef;--muted:#9a9aa2;--line:#2c2c31;--accent:#7aa7ff;
--do:#7aa7ff;--wait:#e0b04f;--show:#5fcf93;--post:#b597f5;--if:#f08080;--ph:#3a3020;--phink:#f3d28a}}
:root[data-theme="dark"]{--bg:#121214;--panel:#1c1c1f;--ink:#ececef;--muted:#9a9aa2;--line:#2c2c31;--accent:#7aa7ff;
--do:#7aa7ff;--wait:#e0b04f;--show:#5fcf93;--post:#b597f5;--if:#f08080;--ph:#3a3020;--phink:#f3d28a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.sub{color:var(--muted);margin:0 0 4px}.claim{font-size:17px;margin:12px 0 0}
code{font:13px/1.3 ui-monospace,Consolas,monospace;background:color-mix(in srgb,var(--ink) 8%,transparent);padding:1px 4px;border-radius:4px}
.ph{background:var(--ph);color:var(--phink);border-radius:4px;padding:0 3px;font-weight:600}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 14px}
.stat b{display:block;font-size:20px}.stat span{color:var(--muted);font-size:12px}
.timeline{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0 6px;border-bottom:1px solid var(--line)}
.bar{display:flex;height:42px;border-radius:8px;overflow:hidden;border:1px solid var(--line)}
.seg{display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;text-decoration:none;min-width:0;border-right:1px solid rgba(255,255,255,.35)}
.seg:hover{filter:brightness(1.1)}.seg span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px}
.ticks{position:relative;height:18px;font-size:11px;color:var(--muted)}.ticks span{position:absolute;transform:translateX(-50%)}
.ticks span:first-child{transform:none}.ticks span.cap{color:var(--if);font-weight:700}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:4px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
ol.steps{list-style:none;margin:0;padding:0}ol.steps li{display:flex;gap:8px;align-items:baseline;padding:5px 0;border-bottom:1px dashed var(--line)}
ol.steps li:last-child{border-bottom:0}
.num{flex:0 0 26px;height:22px;border-radius:11px;background:var(--do);color:var(--panel);font-weight:700;font-size:12px;display:inline-flex;align-items:center;justify-content:center}
li:not(.k-do) .kind{margin-left:34px}
.kind{flex:0 0 44px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.k-do .kind{color:var(--do)}.k-wait .kind{color:var(--wait)}.k-show .kind{color:var(--show)}.k-post .kind{color:var(--post)}.k-if .kind{color:var(--if)}
.k-if .txt,.k-post .txt{color:var(--muted)}
.scene{display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:14px 0;overflow:hidden;scroll-margin-top:90px}
.scene header{grid-column:1/-1;display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)}
.badge{color:#fff;font-weight:800;border-radius:8px;padding:3px 10px}.time{font-variant-numeric:tabular-nums;font-weight:700}
.dur{color:var(--muted);font-size:13px}.screen{color:var(--muted);font-size:13px;flex:1;min-width:0}
.col{padding:12px 16px}.col+.col{border-left:1px solid var(--line)}
.col h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.vo{font-size:17px;line-height:1.55;margin:0}.vo::before{content:"“"}.vo::after{content:"”"}
.wc{color:var(--muted);font-size:12px;margin-top:8px}
ul.plain{margin:0;padding-left:18px}ul.plain li{margin:4px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.toggle{float:right;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:4px 10px;cursor:pointer;font:inherit;font-size:13px}
@media (max-width:760px){.scene{grid-template-columns:1fr}.col+.col{border-left:0;border-top:1px solid var(--line)}.grid2{grid-template-columns:1fr}.seg span{display:none}.vo{font-size:16px}}
@media print{.timeline{position:static}.toggle{display:none}}
"""

def build(case):
    cfg = C[case]
    md = (ROOT / "demos" / case / "script.md").read_text(encoding="utf-8")
    rows, status, claim = parse(md)
    assert set(r["n"] for r in rows) == set(cfg["scenes"]), (case, "scene mismatch")
    total = rows[-1]["end"]
    span = max(total, 300)
    words = sum(len(r["vo"].split()) for r in rows)
    counter = [0]
    pre = steps_html(cfg["pre"], [0])
    segs, cards = [], []
    for r in rows:
        col = f"var(--s{r['n']})"
        w = (r["end"] - r["start"]) / span * 100
        segs.append(f'<a class="seg" href="#s{r["n"]}" style="width:{w:.3f}%;background:{col}" title="Scene {r["n"]} · {r["t"]}"><span>{r["n"]}</span></a>')
        first = counter[0] + 1
        st = steps_html(cfg["scenes"][r["n"]], counter)
        rng = ("no clicks" if counter[0] < first else
               f"click {first}" if counter[0] == first else f"clicks {first}–{counter[0]}")
        dur = r["end"] - r["start"]
        cards.append(f'''<section class="scene" id="s{r["n"]}">
<header><span class="badge" style="background:{col}">{r["n"]}</span><span class="time">{r["t"]}</span><span class="dur">{dur} s · {rng}</span><span class="screen">{md_inline(r["screen"])}</span></header>
<div class="col"><h3>Click order</h3><ol class="steps">{st}</ol></div>
<div class="col"><h3>Voice-over</h3><p class="vo">{md_inline(r["vo"])}</p><div class="wc">{len(r["vo"].split())} words · about {round(len(r["vo"].split())/2.25)} s spoken</div></div>
</section>''')
    if total < span:
        segs.append(f'<div style="width:{(span-total)/span*100:.3f}%;background:repeating-linear-gradient(45deg,transparent 0 6px,var(--line) 6px 8px)" title="spare until the 5:00 cap"></div>')
    ticks = []
    for t in range(0, span + 1, 30):
        cls = ' class="cap"' if t == 300 else ""
        lbl = "5:00 cap" if t == 300 else f"{t//60}:{t%60:02d}"
        style = f"left:{t/span*100:.3f}%" if t else "left:0"
        if t == span: style = "right:0;transform:none"
        ticks.append(f'<span{cls} style="{style}">{lbl}</span>')
    edit = "".join(f"<li>{md_inline(b)}</li>" for b in bullets(section(md, "Edit notes")))
    blur = "".join(f"<li>{md_inline(b)}</li>" for b in bullets(section(md, "Blur in post")))
    reset = steps_html(cfg["reset"], [0])
    clicks = counter[0]
    legend = "".join(f'<span><i style="background:var(--{k})"></i>{v}</span>' for k, v in KIND.items())
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(cfg["title"].split(" · ")[0])} run sheet</title><style>{CSS}</style></head><body><main>
<button class="toggle" onclick="var r=document.documentElement;r.dataset.theme=(r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches))?'light':'dark'">Theme</button>
<h1>{html.escape(cfg["title"])}</h1>
<p class="sub">Run sheet · built from <code>demos/{case}/script.md</code> and <code>guide.md</code> § 4 · {md_inline(status.replace("Status: ", ""))}</p>
<p class="claim"><strong>The one claim:</strong> {md_inline(claim)}</p>
<div class="stats"><div class="stat"><b>{total//60}:{total%60:02d}</b><span>target length</span></div>
<div class="stat"><b>{len(rows)}</b><span>scenes</span></div><div class="stat"><b>{clicks}</b><span>on-camera clicks</span></div>
<div class="stat"><b>{words}</b><span>voice-over words (~{words//135}:{round(words/135%1*60):02d} spoken)</span></div>
<div class="stat"><b>{(300-total)//60}:{(300-total)%60:02d}</b><span>spare to the 5:00 cap</span></div></div>
<div class="timeline"><div class="bar">{"".join(segs)}</div><div class="ticks">{"".join(ticks)}</div><div class="legend">{legend}<span><span class="ph">{{…}}</span> fill from the recorded run</span></div></div>
<h2>Before you press record (off camera)</h2><div class="box"><ol class="steps">{pre}</ol></div>
<h2>Scenes</h2>{"".join(cards)}
<h2>After the take</h2><div class="grid2"><div class="box"><h3 style="margin:0 0 6px;font-size:13px">Reset for another take</h3><ol class="steps">{reset}</ol></div>
<div class="box"><h3 style="margin:0 0 6px;font-size:13px">Blur in post</h3><ul class="plain">{blur}</ul></div></div>
<h2>Edit notes</h2><div class="box"><ul class="plain">{edit}</ul></div>
</main></body></html>'''
    out = ROOT / "demos" / case / "run-sheet.html"
    out.write_text(page, encoding="utf-8")
    print(out, len(rows), "scenes", clicks, "clicks", words, "words", f"{total//60}:{total%60:02d}")

for case in C:
    build(case)

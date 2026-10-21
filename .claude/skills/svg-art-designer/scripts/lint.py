#!/usr/bin/env python3
"""
lint.py — static checks for STANDALONE SVG artwork (files opened in browsers, Inkscape,
Illustrator, Figma, image viewers, thumbnailers, print pipelines).

  python lint.py art.svg            # report; exit 1 if any ERROR
  python lint.py art.svg --strict   # also exit 1 on WARN

ERROR = will look broken somewhere / invalid. WARN = likely problem. INFO = worth knowing.
"""
import argparse
import gzip
import math
import os
import re
import sys
from collections import Counter

try:
    from lxml import etree
except ImportError:  # stdlib fallback
    etree = None
    import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
EDITOR_NS = ("inkscape.org", "sodipodi", "adobe.com", "sketch", "figma", "serif.com", "corel")
GENERIC_FONTS = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"}
FILTER_SPREADERS = {"feGaussianBlur", "feDropShadow", "feOffset", "feMorphology",
                    "feDisplacementMap", "feConvolveMatrix", "feTile"}
COLOR_MATH = {"feColorMatrix", "feComponentTransfer", "feDiffuseLighting", "feSpecularLighting",
              "feBlend", "feComposite", "feFlood"}
NUM_RE = re.compile(r"-?\d*\.\d+(?:[eE][-+]?\d+)?")


def local(tag):
    return tag.split("}", 1)[1] if isinstance(tag, str) and "}" in tag else tag


class Report:
    def __init__(self):
        self.items = []

    def add(self, level, msg):
        if (level, msg) not in self.items:
            self.items.append((level, msg))

    def count(self, level):
        return sum(1 for lv, _ in self.items if lv == level)


def parse(path):
    data = open(path, "rb").read()
    if path.endswith(".svgz") or data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    if etree is not None:
        parser = etree.XMLParser(huge_tree=True, remove_blank_text=False, resolve_entities=False)
        return data, etree.fromstring(data, parser)
    return data, ET.fromstring(data)


def iter_all(root):
    return root.iter()


def lint(path):
    R = Report()
    try:
        raw, root = parse(path)
    except Exception as e:
        R.add("ERROR", f"XML does not parse: {e}  (unescaped & or <, unbound prefix like xlink: "
                       f"without xmlns:xlink, or mismatched tags)")
        return R, {}
    text = raw.decode("utf-8", errors="replace")
    size = len(raw)
    gz = len(gzip.compress(raw, 9))
    stats = {"bytes": size, "gzip": gz}

    # ---- root -------------------------------------------------------------
    if root.tag != f"{{{SVG_NS}}}svg":
        R.add("ERROR", 'root is not <svg> in the SVG namespace — add xmlns="http://www.w3.org/2000/svg" '
                       "(without it, browsers show XML text and image viewers fail)")
    vb = root.get("viewBox")
    W, H = root.get("width"), root.get("height")
    vbw = vbh = None
    if not vb:
        R.add("WARN", "no viewBox — the art will not scale; add viewBox=\"0 0 W H\"")
    else:
        try:
            _, _, vbw, vbh = [float(v) for v in re.split(r"[\s,]+", vb.strip())]
            stats["viewBox"] = (vbw, vbh)
        except Exception:
            R.add("ERROR", f"malformed viewBox {vb!r}")
    if not (W and H):
        R.add("WARN", "missing width/height — image viewers, Office and many converters fall back to "
                      "300x150 or 100%; set them to the intended size (px, or mm for print)")
    elif vbw and vbh:
        def num(v):
            m = re.match(r"[\d.]+", v)
            return float(m.group()) if m else None
        w, h = num(W), num(H)
        if w and h and "%" not in W + H and abs(w / h - vbw / vbh) > 0.01:
            R.add("WARN", f"width/height aspect {w/h:.3f} != viewBox aspect {vbw/vbh:.3f} -> letterboxing")

    # ---- ids & references -------------------------------------------------
    ids = Counter()
    id_tags = {}
    for e in iter_all(root):
        i = e.get("id")
        if i:
            ids[i] += 1
            id_tags[i] = local(e.tag)
    for i, n in ids.items():
        if n > 1:
            R.add("ERROR", f'duplicate id "{i}" ({n}x) — url(#{i}) resolves differently per renderer')
    refs = Counter()
    for e in iter_all(root):
        for k, v in e.attrib.items():
            for m in re.finditer(r"url\(\s*['\"]?#([^'\")\s]+)", v):
                refs[m.group(1)] += 1
            if local(k) == "href" and v.startswith("#"):
                refs[v[1:]] += 1
            if local(k) == "href" and re.match(r"(https?:|file:|//)", v):
                R.add("ERROR", f"external reference {v[:80]} — standalone files must be self-contained")
            if local(k) == "href" and v.startswith("data:image/") and local(e.tag) == "image":
                R.add("INFO", f"embedded raster image ({len(v)//1024} KB) — fine for textures, but the art is no longer pure vector")
            if k.startswith("on"):
                R.add("ERROR", f"event handler attribute {k} — static art must not contain script")
        if local(e.tag) == "style" and e.text:
            for m in re.finditer(r"url\(\s*['\"]?#([^'\")\s]+)", e.text):
                refs[m.group(1)] += 1
            if re.search(r"@import|url\(\s*['\"]?(https?:|//)", e.text):
                R.add("ERROR", "<style> loads external resources (@import / remote url) — inline everything")
            if "var(" in e.text or "calc(" in e.text:
                R.add("WARN", "CSS var()/calc() — unsupported by Illustrator, older Inkscape, librsvg; use literal values")
            if re.search(r"transform-(origin|box)", e.text):
                R.add("WARN", "CSS transform-origin/transform-box — inconsistent outside browsers; bake pivots into rotate(a cx cy)")
            if "@keyframes" in e.text or "animation" in e.text:
                R.add("INFO", "CSS animation — static viewers/printers show only the first frame")
        st = e.get("style") or ""
        for m in re.finditer(r"url\(\s*['\"]?#([^'\")\s]+)", st):
            refs[m.group(1)] += 1
        if "var(" in st:
            R.add("WARN", f"CSS var() in style attribute on <{local(e.tag)}> — not portable")
    for r_, n in refs.items():
        if r_ not in ids:
            R.add("ERROR", f'reference to missing id "#{r_}" ({n}x) — fill/filter/clip silently fails '
                           f"(fill falls back to none/black)")
    defs_ids = []
    for d in root.iter(f"{{{SVG_NS}}}defs"):
        for ch in d:
            if ch.get("id"):
                defs_ids.append(ch.get("id"))
    unused = [i for i in defs_ids if i not in refs]
    if unused:
        R.add("INFO", f"{len(unused)} unused def(s): {', '.join(unused[:8])}{'…' if len(unused) > 8 else ''}")

    # ---- forbidden / non-portable elements ---------------------------------
    tags = Counter(local(e.tag) for e in iter_all(root) if isinstance(e.tag, str))
    stats["elements"] = sum(tags.values())
    if tags["script"]:
        R.add("ERROR", "<script> — static artwork must not contain script (stripped/blocked by most viewers)")
    if tags["foreignObject"]:
        R.add("ERROR", "<foreignObject> (HTML inside SVG) — renders only in browsers; draw it in SVG")
    for t in ("meshgradient", "meshGradient", "hatch", "solidcolor"):
        if tags[t]:
            R.add("ERROR", f"<{t}> — SVG2 draft feature only Inkscape renders; fake mesh gradients with blurred shapes")
    if tags["animate"] or tags["animateTransform"] or tags["animateMotion"] or tags["set"]:
        R.add("INFO", "SMIL animation present — static renderers show the initial state")
    if tags["feDropShadow"]:
        R.add("INFO", "feDropShadow — not supported by Illustrator & older tools; the "
                      "feGaussianBlur+feOffset+feFlood+feComposite chain is fully portable")
    if tags["switch"]:
        R.add("INFO", "<switch> — behaviour varies by renderer")

    # ---- attributes & features -------------------------------------------
    plain_href = xlink_href = 0
    blend = paint_order = vector_eff = mask_type = 0
    fonts = Counter()
    for e in iter_all(root):
        if not isinstance(e.tag, str):
            continue
        for k in e.attrib:
            if k == "href":
                plain_href += 1
            elif k == f"{{{XLINK}}}href":
                xlink_href += 1
        st = (e.get("style") or "") + " " + " ".join(f"{local(k)}:{v};" for k, v in e.attrib.items())
        if "mix-blend-mode" in st or "isolation" in st:
            blend += 1
        if "paint-order" in st:
            paint_order += 1
        if "vector-effect" in st:
            vector_eff += 1
        if "mask-type" in st:
            mask_type += 1
        fam = e.get("font-family") or (re.search(r"font-family\s*:\s*([^;]+)", e.get("style") or "") or [None, None])[1]
        if fam and local(e.tag) in ("text", "tspan", "g", "textPath", "svg"):
            fonts[fam.strip()] += 1
    for st_el in root.iter(f"{{{SVG_NS}}}style"):
        for m in re.finditer(r"font-family\s*:\s*([^;}]+)", st_el.text or ""):
            fonts[m.group(1).strip()] += 1
        txt = st_el.text or ""
        blend += txt.count("mix-blend-mode")
    if plain_href and not xlink_href:
        R.add("INFO", f"{plain_href} plain href= (SVG2). Illustrator & Inkscape <1.0 need xlink:href — "
                      "use xlink:href (with xmlns:xlink) for maximum compatibility")
    if blend:
        R.add("INFO", f"mix-blend-mode/isolation used {blend}x — fine in browsers/resvg/new librsvg; "
                      "ignored by Illustrator import & old librsvg (looks like normal blending)")
    if paint_order:
        R.add("INFO", "paint-order used — unsupported in Illustrator; outline-behind-text needs a duplicate stroke layer there")
    if vector_eff:
        R.add("INFO", "vector-effect used — rarely meaningful in static art; unsupported by resvg/Illustrator")
    if mask_type:
        R.add("WARN", "mask-type — not portable; build luminance masks (white = visible) instead")

    if tags["text"] or tags["textPath"]:
        nonportable = [f for f in fonts if not all(p.strip().strip("'\"").lower() in GENERIC_FONTS
                                                    for p in f.split(",")[-1:])]
        named = [f for f in fonts]
        if named:
            R.add("WARN", f"live <text> in font(s) {', '.join(list(named)[:4])} — recipients without "
                          "the font get a substitute. For final art outline text "
                          "(svgkit.text_to_path) or end each stack with a generic family")
        else:
            R.add("WARN", "live <text> without font-family — renders in each viewer's default font")
        if any("dominant-baseline" in (e.get("style") or "") or e.get("dominant-baseline")
               for e in iter_all(root) if isinstance(e.tag, str)):
            R.add("INFO", "dominant-baseline varies across renderers; prefer explicit y / dy offsets")

    # ---- filters -----------------------------------------------------------
    for f in root.iter(f"{{{SVG_NS}}}filter"):
        fid = f.get("id", "?")
        prims = [local(p.tag) for p in f if isinstance(p.tag, str)]
        spreads = FILTER_SPREADERS & set(prims)
        explicit = all(f.get(a) is not None for a in ("x", "y", "width", "height"))
        if spreads and not explicit:
            R.add("WARN", f'filter "#{fid}" uses {", ".join(sorted(spreads))} with the default region '
                          "(only 10% padding) — glows/shadows/displacement get cut off square. "
                          'Set x/y/width/height (e.g. -30%/-30%/160%/160%) or filterUnits="userSpaceOnUse"')
        if COLOR_MATH & set(prims) and f.get("color-interpolation-filters") is None and \
                "color-interpolation-filters" not in (f.get("style") or ""):
            R.add("INFO", f'filter "#{fid}" does color math in the default linearRGB space — add '
                          'color-interpolation-filters="sRGB" so colors match the hex values you chose')
        for p in f:
            if not isinstance(p.tag, str):
                continue
            if local(p.tag) == "feTurbulence":
                try:
                    if int(p.get("numOctaves", "1")) > 5:
                        R.add("WARN", f'filter "#{fid}": numOctaves>{5} costs render time with no visible gain')
                except ValueError:
                    pass
            if local(p.tag) == "feDisplacementMap":
                src = p.get("in2")
                prev = {q.get("result"): local(q.tag) for q in f if isinstance(q.tag, str)}
                if prev.get(src) == "feTurbulence":
                    R.add("WARN", f'filter "#{fid}": feDisplacementMap reads raw feTurbulence. Its alpha '
                                  "is also noise, and engines disagree on premultiplication (resvg shifts "
                                  "the shape). Insert feColorMatrix values=\"1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1\" first")
            if local(p.tag) == "feGaussianBlur":
                try:
                    sd = max(float(v) for v in re.split(r"[\s,]+", p.get("stdDeviation", "0").strip()) if v)
                    if vbw and sd > max(vbw, vbh) * 0.08:
                        R.add("INFO", f'filter "#{fid}": blur {sd:g} is large — slow on big areas; '
                                      "a radial gradient with transparent edge is often cheaper")
                except ValueError:
                    pass
    used_filters = sum(1 for e in iter_all(root) if isinstance(e.tag, str) and "url(#" in (e.get("filter") or ""))
    stats["filtered_elements"] = used_filters
    if used_filters > 60:
        R.add("WARN", f"{used_filters} elements carry their own filter — put one filter on a parent <g> instead (much faster)")

    # ---- mask / clip / filter on a transformed element ------------------------
    for e in iter_all(root):
        tf = e.get("transform") if isinstance(e.tag, str) else None
        # pure translate moves content + clip together (often intended, e.g. misregistration);
        # flips/scales/rotations are the trap
        if not tf or not re.search(r"scale|rotate|matrix|skew", tf):
            continue
        for attr in ("mask", "clip-path", "filter"):
            ref = e.get(attr) or ""
            m = re.search(r"#([^)'\"]+)", ref)
            if not m:
                continue
            for d in iter_all(root):
                if isinstance(d.tag, str) and d.get("id") == m.group(1):
                    units = d.get("maskUnits") or d.get("filterUnits") or d.get("clipPathUnits") or ""
                    if units == "userSpaceOnUse" or (attr == "clip-path" and units != "objectBoundingBox"):
                        R.add("WARN", f'<{local(e.tag)}> has transform="{e.get("transform")[:40]}" AND {attr}="{ref}" '
                                      f"with user-space coordinates — the {attr} is interpreted in the TRANSFORMED "
                                      "system (a flipped reflection gets its mask flipped away). Put the transform "
                                      f"on an inner <g> and the {attr} on the outer one")

    # ---- overlays that degrade badly ------------------------------------------
    for e in iter_all(root):
        if not isinstance(e.tag, str) or local(e.tag) != "rect" or not e.get("filter"):
            continue
        full = (e.get("width") in ("100%",) or (vbw and e.get("width") and _f(e.get("width")) >= vbw * 0.98))
        fill = (e.get("fill") or "").lower()
        if full and fill not in ("", "none", "transparent") and e.get("fill-opacity") not in ("0", "0.0"):
            fid = re.search(r"#([^)'\"]+)", e.get("filter")).group(1)
            ftags = []
            for f in root.iter(f"{{{SVG_NS}}}filter"):
                if f.get("id") == fid:
                    ftags = [local(p.tag) for p in f if isinstance(p.tag, str)]
            if ftags and ftags[0] == "feTurbulence" and "feFlood" not in ftags and "feDiffuseLighting" not in ftags:
                R.add("WARN", f'full-canvas rect with filter "#{fid}" has a visible fill — renderers without '
                              "filter support (cairosvg, some editors) paint an opaque sheet over the art. "
                              'Use fill="#000" fill-opacity="0" (not fill="none": resvg drops it)')

    # ---- background --------------------------------------------------------
    first_paint = None
    for e in iter_all(root):
        if isinstance(e.tag, str) and local(e.tag) in ("rect", "path", "circle", "polygon", "ellipse", "use", "image"):
            if any(local(a.tag) in ("defs", "clipPath", "mask", "pattern", "symbol", "marker", "linearGradient", "radialGradient", "filter")
                   for a in e.iterancestors()) if etree else False:
                continue
            first_paint = e
            break
    if first_paint is not None and local(first_paint.tag) == "rect" and vbw:
        w = first_paint.get("width", "")
        if not (w == "100%" or _f(w) >= vbw * 0.98):
            R.add("INFO", "no full-canvas background — transparent areas show black in some viewers and "
                          "checkerboard in editors; intended?")

    # ---- precision & size ----------------------------------------------------
    nums = NUM_RE.findall(text)
    if nums and vbw:
        rec = max(1, 4 - int(math.floor(math.log10(max(vbw, vbh)))))
        over = sum(1 for n in nums if len(n.split(".")[1].split("e")[0].split("E")[0]) > rec + 1)
        frac = over / len(nums)
        stats["recommended_precision"] = rec
        if frac > 0.05:
            R.add("WARN", f"{frac:.0%} of numbers have >{rec + 1} decimals (recommended {rec} for this viewBox) "
                          "— run optimize.py")
    if size > 1_500_000:
        R.add("WARN", f"{size/1e6:.1f} MB — heavy for an illustration. Reduce precision, reuse with <use>, "
                      "merge same-style paths, simplify point counts")
    elif size > 500_000:
        R.add("INFO", f"{size/1e3:.0f} KB — check optimize.py; gzip ({gz/1e3:.0f} KB) or .svgz if serving")
    editor = [k for k in set(re.findall(r'xmlns:(\w+)="([^"]+)"', text)) if any(s in k[1] for s in EDITOR_NS)]
    if editor and not all(p == "inkscape" for p, _ in editor):
        R.add("INFO", f"editor namespaces present ({', '.join(p for p, _ in editor)}) — optimize.py strips them")
    if text.count("<!--") > 5:
        R.add("INFO", f"{text.count('<!--')} comments — stripped by optimize.py")
    stats["tags"] = dict(tags.most_common(8))
    return R, stats


def _f(v):
    try:
        return float(re.match(r"-?[\d.]+", v).group())
    except Exception:
        return 0.0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    R, stats = lint(a.svg)
    print(f"lint {os.path.basename(a.svg)}")
    if stats:
        print(f"  {stats['bytes']/1024:.1f} KB ({stats['gzip']/1024:.1f} KB gz), "
              f"{stats.get('elements', '?')} elements, top tags {stats.get('tags', {})}")
    order = {"ERROR": 0, "WARN": 1, "INFO": 2}
    for lv, msg in sorted(R.items, key=lambda x: order[x[0]]):
        print(f"  {lv:5s} {msg}")
    if not R.items:
        print("  clean")
    print(f"  => {R.count('ERROR')} error(s), {R.count('WARN')} warning(s), {R.count('INFO')} info")
    sys.exit(1 if R.count("ERROR") or (a.strict and R.count("WARN")) else 0)


if __name__ == "__main__":
    main()

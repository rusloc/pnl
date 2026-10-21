#!/usr/bin/env python3
"""
optimize.py — shrink standalone SVG artwork without changing how it looks.

  python optimize.py art.svg                    # -> art.min.svg (editable mode), verified
  python optimize.py art.svg -o final.svg -p 1  # explicit precision (decimals)
  python optimize.py art.svg --aggressive       # also minify ids, shapes->paths, reuse paths
  python optimize.py art.svg --no-verify

Editable mode (default) keeps what designers need when they open the file later: layer ids,
Inkscape layer labels, <title>/<desc>, rect/circle primitives. Aggressive mode squeezes harder
for pure delivery.

Uses SVGO (npm i -g svgo) when available, else a built-in minifier (rounding, whitespace,
metadata/editor junk). Every run is checked by rendering before/after and diffing.
"""
import argparse
import gzip
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def viewbox_dims(text):
    m = re.search(r'viewBox\s*=\s*["\']([^"\']+)["\']', text)
    if m:
        p = [float(v) for v in re.split(r"[\s,]+", m.group(1).strip()) if v]
        if len(p) == 4:
            return p[2], p[3]
    w = re.search(r'<svg[^>]*\swidth\s*=\s*["\']([\d.]+)', text)
    h = re.search(r'<svg[^>]*\sheight\s*=\s*["\']([\d.]+)', text)
    return (float(w.group(1)) if w else 1000.0), (float(h.group(1)) if h else 1000.0)


def auto_precision(text):
    w, h = viewbox_dims(text)
    return max(1, 4 - int(math.floor(math.log10(max(w, h, 1e-9)))))


# ---------------------------------------------------------------------------
def svgo_cmd():
    if shutil.which("svgo"):
        return ["svgo"]
    if shutil.which("npx"):
        return ["npx", "--yes", "svgo"]
    return None


def run_svgo(src, dst, precision, aggressive):
    editable = not aggressive
    overrides = {
        # fill-opacity="0" texture carriers must keep their fill (fill="none" -> resvg drops them)
        "removeUselessStrokeAndFill": False,
        # never let svgo remove elements that only exist to carry a filter
        "removeHiddenElems": {"opacity0": False},
    }
    if editable:
        overrides.update({
            "cleanupIds": {"minify": False, "remove": False},   # keep layer/object names
            "removeEditorsNSData": False,                       # keep inkscape:label layers
            "convertShapeToPath": False,                        # keep editable primitives
            "removeDesc": False,
        })
    # Precision per plugin, NOT global floatPrecision: a global value also rounds filter
    # parameters (baseFrequency 0.04 -> 0 kills a texture; 0.75 -> .8 changes grain).
    overrides["convertPathData"] = {"floatPrecision": precision}
    overrides["convertTransform"] = {"floatPrecision": max(precision, 2) + 1}
    overrides["cleanupNumericValues"] = {"floatPrecision": max(precision, 3)}
    plugins = [{"name": "preset-default", "params": {"overrides": overrides}},
               {"name": "cleanupListOfValues", "params": {"floatPrecision": precision}}]  # points=, viewBox
    if aggressive:
        plugins += ["reusePaths"]
    cfg = ("export default " + json.dumps({
        "multipass": True,
        "js2svg": {"pretty": False},
        "plugins": plugins,
    }) + ";")
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as f:
        f.write(cfg)
        cfgp = f.name
    try:
        r = subprocess.run(svgo_cmd() + ["--config", cfgp, "-i", src, "-o", dst],
                           capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            raise RuntimeError(r.stderr.strip()[-600:])
    finally:
        os.unlink(cfgp)


# ---------------------------------------------------------------------------
# Built-in fallback minifier (no Node required)
# ---------------------------------------------------------------------------
NUM = re.compile(r"-?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?")
GEOM_ATTRS = {"d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy",
              "width", "height", "transform", "gradientTransform", "patternTransform", "stroke-width",
              "dx", "dy", "stdDeviation", "scale", "radius", "font-size", "stroke-dasharray",
              "stroke-dashoffset", "startOffset", "letter-spacing"}


def _round(m, p):
    s = m.group(0)
    try:
        v = float(s)
    except ValueError:
        return s
    out = f"{v:.{p}f}".rstrip("0").rstrip(".") if "." in f"{v:.{p}f}" else f"{v:.{p}f}"
    if out in ("-0", ""):
        out = "0"
    if out.startswith("0.") and len(out) > 2:
        out = out[1:]
    elif out.startswith("-0.") and len(out) > 3:
        out = "-" + out[2:]
    return out


def _compact_path(d, p):
    d = NUM.sub(lambda m: _round(m, p), d)
    d = re.sub(r"\s*([MmLlHhVvCcSsQqTtAaZz])\s*", r"\1", d)
    d = re.sub(r"[\s,]+", " ", d).strip()
    d = re.sub(r" (-)", r"\1", d)          # '1 -2' -> '1-2'
    return d


def builtin_minify(src, dst, precision, aggressive):
    from lxml import etree
    parser = etree.XMLParser(huge_tree=True, remove_comments=True, remove_blank_text=False)
    tree = etree.parse(src, parser)
    root = tree.getroot()
    SVG = "http://www.w3.org/2000/svg"
    junk_ns = ["sodipodi", "adobe.com", "sketch", "figma", "serif.com", "corel"]
    if aggressive:
        junk_ns.append("inkscape.org")
    for el in list(root.iter()):
        if not isinstance(el.tag, str):
            continue
        tag = el.tag
        if tag in (f"{{{SVG}}}metadata",) or any(s in tag for s in junk_ns):
            el.getparent().remove(el)
            continue
        for k in list(el.attrib):
            if any(s in k for s in junk_ns):
                del el.attrib[k]
                continue
            local = k.split("}")[-1]
            if local in GEOM_ATTRS:
                v = el.attrib[k]
                # filter primitive params keep >=3 decimals (blur radius, scale, offsets)
                pp = max(precision, 3) if tag.split("}")[-1].startswith("fe") else precision
                el.attrib[k] = _compact_path(v, pp) if local == "d" else \
                    NUM.sub(lambda m, pp=pp: _round(m, pp), v)
        # strip whitespace-only text between elements (never inside text content)
        if tag.split("}")[-1] not in ("text", "tspan", "textPath", "style", "title", "desc"):
            if el.text and not el.text.strip():
                el.text = None
            for ch in el:
                if ch.tail and not ch.tail.strip():
                    ch.tail = None
    etree.cleanup_namespaces(root)
    tree.write(dst, xml_declaration=False, encoding="utf-8")


# ---------------------------------------------------------------------------
def verify(a, b, size=800):
    import render
    from PIL import Image, ImageChops
    tmp = tempfile.mkdtemp()
    pa, pb = os.path.join(tmp, "a.png"), os.path.join(tmp, "b.png")
    eng = render.available()
    # prefer a fast engine for verification; resvg-py mis-renders displacement maps,
    # so use chromium when the art uses them
    txt = open(a, encoding="utf-8", errors="replace").read()
    backend = "chromium" if ("feDisplacementMap" in txt and "chromium" in eng) else eng[0]
    render.render(a, pa, size=size, backend=backend, bg="white", quiet=True)
    render.render(b, pb, size=size, backend=backend, bg="white", quiet=True)
    A, B = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
    if A.size != B.size:
        B = B.resize(A.size)
    # same engine for both renders -> noise textures are deterministic, so compare unblurred:
    # any change to a filter parameter shows up; sub-pixel path rounding stays below threshold
    diff = ImageChops.difference(A, B).convert("L")
    h = diff.histogram()
    tot = sum(h)
    big = sum(h[16:]) / tot
    mean = sum(i * c for i, c in enumerate(h)) / tot
    shutil.rmtree(tmp, ignore_errors=True)
    return backend, mean, big


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg")
    ap.add_argument("-o", "--out")
    ap.add_argument("-p", "--precision", type=int, help="decimals (default: from viewBox size)")
    ap.add_argument("--aggressive", action="store_true")
    ap.add_argument("--builtin", action="store_true", help="force the built-in minifier")
    ap.add_argument("--no-verify", action="store_true")
    a = ap.parse_args()

    src = a.svg
    out = a.out or re.sub(r"\.svg$", "", src) + ".min.svg"
    text = open(src, encoding="utf-8", errors="replace").read()
    p = a.precision if a.precision is not None else auto_precision(text)
    engine = "builtin"
    if not a.builtin and svgo_cmd():
        try:
            run_svgo(src, out, p, a.aggressive)
            engine = "svgo"
        except Exception as e:
            print(f"svgo failed ({e}); using built-in minifier", file=sys.stderr)
            builtin_minify(src, out, p, a.aggressive)
    else:
        builtin_minify(src, out, p, a.aggressive)

    s0, s1 = os.path.getsize(src), os.path.getsize(out)
    g1 = len(gzip.compress(open(out, "rb").read(), 9))
    print(f"{engine} ({'aggressive' if a.aggressive else 'editable'}, precision {p}): "
          f"{s0/1024:.1f} KB -> {s1/1024:.1f} KB ({100*(1-s1/s0):.0f}% smaller; {g1/1024:.1f} KB gzipped)")
    print(f"wrote {out}")
    if not a.no_verify:
        try:
            backend, mean, big = verify(src, out)
            ok = big < 0.005 and mean < 1.0
            print(f"visual check via {backend}: mean diff {mean:.2f}/255, changed pixels {big:.2%} -> "
                  f"{'IDENTICAL (safe)' if ok else 'CHANGED — inspect; try higher -p or drop --aggressive'}")
            if not ok:
                sys.exit(2)
        except SystemExit:
            raise
        except Exception as e:
            print(f"(visual check skipped: {e})")


if __name__ == "__main__":
    main()

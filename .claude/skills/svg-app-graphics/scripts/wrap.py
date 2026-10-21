#!/usr/bin/env python3
"""
wrap.py — audit and package small SVG graphics for web and mobile apps.

  python wrap.py icons/*.svg --sheet                         # real-size light/dark sheet + 8x pixel zoom
  python wrap.py icons/*.svg --audit --targets android,flutter
  python wrap.py icons/*.svg -o dist --targets web,react,rn,android,ios --current-color --png 1,2,3
  python wrap.py logo.svg -o dist --favicon --bg "#0b1020"

Targets
  web      optimized .svg (ids prefixed per file) + sprite.svg (<symbol>) + icons.css (data URIs)
  react    <Name>.tsx  (size/title props, currentColor kept, aria handled)
  rn       <Name>.native.tsx for react-native-svg (size/color/title props)
  android  <name>.xml VectorDrawable (via svg2vectordrawable: npm i -g svg2vectordrawable)
  ios      <Name>.imageset/ (vector SVG + Contents.json, template mode when monochrome)
  flutter  asset .svg, audited for flutter_svg
Audit rules come from conversions tested with svg2vectordrawable and documented platform limits
(see references/platforms.md). Rendering reuses the svg-art-designer skill's render.py.
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

from lxml import etree

SVG_NS = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"


# ---------------------------------------------------------------------------
# toolkit discovery (svg-art-designer/scripts/render.py)
# ---------------------------------------------------------------------------
def _toolkit():
    here = Path(__file__).resolve().parent
    for p in (os.environ.get("SVG_ART_DESIGNER_SCRIPTS"), here.parent.parent / "svg-art-designer" / "scripts",
              Path.home() / ".claude/skills/svg-art-designer/scripts", Path(".claude/skills/svg-art-designer/scripts"),
              Path("/mnt/skills/user/svg-art-designer/scripts")):
        if p and (Path(p) / "render.py").exists():
            sys.path.insert(0, str(p))
            import render  # noqa
            return render
    return None


RENDER = _toolkit()


def rasterize(svg_path, png_path, long_side, bg="none"):
    if RENDER is None:
        raise SystemExit("render.py not found: install the svg-art-designer skill or set SVG_ART_DESIGNER_SCRIPTS")
    eng = RENDER.available()
    backend = "resvg" if "resvg" in eng else (eng[0] if eng else "auto")
    RENDER.render(str(svg_path), str(png_path), size=long_side, backend=backend, bg=bg, quiet=True)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def local(tag):
    return tag.split("}", 1)[1] if isinstance(tag, str) and "}" in tag else tag


def pascal(name):
    return "".join(p[:1].upper() + p[1:] for p in re.split(r"[^A-Za-z0-9]+", name) if p) or "Graphic"


def snake(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "graphic"


def viewbox(root):
    vb = root.get("viewBox")
    if vb:
        x, y, w, h = [float(v) for v in re.split(r"[\s,]+", vb.strip())]
        return x, y, w, h
    return 0, 0, float(root.get("width", 24)), float(root.get("height", 24))


def paints(text):
    found = set()
    for m in re.finditer(r'(?:fill|stroke|stop-color)\s*[=:]\s*"?\s*([#a-zA-Z][^";\s)]*)', text):
        v = m.group(1)
        if v.lower() not in ("none", "transparent") and not v.startswith("url"):
            found.add(v.lower())
    return found


# ---------------------------------------------------------------------------
# audit
# ---------------------------------------------------------------------------
def features(root, text):
    f = {}
    tags = [local(e.tag) for e in root.iter() if isinstance(e.tag, str)]
    attrs = lambda name: [e for e in root.iter() if isinstance(e.tag, str) and (e.get(name) or name + ":" in (e.get("style") or ""))]
    f["style_el"] = "style" in tags
    f["style_attr"] = any(e.get("style") for e in root.iter() if isinstance(e.tag, str))
    f["filter"] = "filter" in tags or bool(attrs("filter"))
    f["mask"] = "mask" in tags or bool(attrs("mask"))
    f["clip"] = bool(attrs("clip-path"))
    f["text"] = "text" in tags
    f["dash"] = bool(attrs("stroke-dasharray"))
    f["group_opacity"] = any(local(e.tag) == "g" and e.get("opacity") not in (None, "1") for e in root.iter() if isinstance(e.tag, str))
    f["current_color"] = "currentcolor" in text.lower()
    f["bbox_gradient"] = any(local(e.tag) in ("linearGradient", "radialGradient") and e.get("gradientUnits") != "userSpaceOnUse"
                             and e.get("href") is None and e.get(f"{{{XLINK}}}href") is None for e in root.iter() if isinstance(e.tag, str))
    f["pattern"] = "pattern" in tags
    f["image"] = "image" in tags
    f["use"] = "use" in tags
    f["css_var"] = "var(" in text
    f["script"] = "script" in tags or bool(re.search(r"\son\w+=", text))
    f["foreign"] = "foreignObject" in tags
    f["external"] = bool(re.search(r'href="(https?:|//)', text))
    f["blend"] = "mix-blend-mode" in text
    f["animation"] = any(t in tags for t in ("animate", "animateTransform", "animateMotion")) or "@keyframes" in text
    return f


RULES = {  # feature -> {target: (level, message)}
    "script": {"*": ("ERROR", "script / event handlers: stripped or blocked everywhere")},
    "foreign": {"*": ("ERROR", "<foreignObject>: browser-only HTML; draw it in SVG")},
    "external": {"*": ("ERROR", "external href: app assets must be self-contained")},
    "css_var": {"android": ("ERROR", "CSS var(): unsupported"), "flutter": ("ERROR", "CSS var(): unsupported"),
                "rn": ("ERROR", "CSS var(): unsupported"), "ios": ("ERROR", "CSS var(): unsupported"),
                "web": ("INFO", "CSS var() works only when the SVG is inlined in the page")},
    "style_el": {"flutter": ("ERROR", "<style> is not implemented by flutter_svg: inline as attributes"),
                 "rn": ("WARN", "<style> needs SvgCss in react-native-svg: inline as attributes"),
                 "android": ("WARN", "<style>: inline as attributes before conversion")},
    "filter": {"android": ("ERROR", "filtered element is DROPPED by the VectorDrawable conversion"),
               "flutter": ("ERROR", "filters are not rendered by flutter_svg"),
               "rn": ("WARN", "filters: partial support in react-native-svg; avoid"),
               "ios": ("WARN", "filters: not expected in Xcode vector assets; avoid")},
    "mask": {"android": ("ERROR", "mask silently dropped: flatten into geometry"),
             "ios": ("WARN", "mask: unverified in Xcode vector assets; prefer geometry")},
    "clip": {"android": ("ERROR", "clip-path ignored by the conversion: flatten into geometry")},
    "group_opacity": {"android": ("ERROR", "<g opacity> makes the group's content DISAPPEAR: use fill-opacity per shape")},
    "dash": {"android": ("ERROR", "stroke-dasharray dropped (renders a solid line): draw dashes as segments")},
    "text": {"*": ("WARN", "live <text>: font-dependent, partial on mobile; outline it (svgkit.text_to_path)"),
             "android": ("ERROR", "<text> dropped by the conversion: outline it")},
    "bbox_gradient": {"android": ("ERROR", "objectBoundingBox gradient converts to wrong coordinates: use gradientUnits=\"userSpaceOnUse\"")},
    "current_color": {"android": ("INFO", "currentColor becomes black: tint the drawable (android:tint) instead"),
                      "flutter": ("INFO", "currentColor: set SvgTheme(currentColor: ...) or a colorFilter")},
    "pattern": {"android": ("ERROR", "<pattern> unsupported"), "ios": ("WARN", "<pattern>: avoid")},
    "image": {"*": ("WARN", "embedded raster: not a pure vector asset")},
    "blend": {"android": ("WARN", "blend modes unsupported"), "flutter": ("WARN", "blend modes: avoid"),
              "rn": ("WARN", "blend modes: avoid"), "ios": ("WARN", "blend modes: avoid")},
    "animation": {"*": ("INFO", "animation: web only (inline/img); mobile shows frame 0 — use Lottie/Rive/native")},
}


def audit(path, targets):
    text = Path(path).read_text(encoding="utf-8")
    root = etree.fromstring(text.encode())
    out = []
    if root.get("viewBox") is None:
        out.append(("ERROR", "*", "no viewBox: the graphic cannot scale"))
    f = features(root, text)
    for feat, present in f.items():
        if not present or feat not in RULES:
            continue
        for t in targets:
            r = RULES[feat].get(t, RULES[feat].get("*"))           # target rule, else the universal one
            if r:
                out.append((r[0], t, r[1]))
    seen, uniq = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            uniq.append(item)
    return uniq


# ---------------------------------------------------------------------------
# optimize (svgo, app config)
# ---------------------------------------------------------------------------
def svgo_cmd():
    if shutil.which("svgo"):
        return ["svgo"]
    if shutil.which("npx"):
        return ["npx", "--yes", "svgo"]
    return None


def optimize(src, dst, prefix, keep_size=False):
    text = Path(src).read_text(encoding="utf-8")
    root = etree.fromstring(text.encode())
    w = max(viewbox(root)[2:])
    p = max(1, 4 - len(str(int(w))))                      # 24 -> 2 decimals, 343 -> 1
    if svgo_cmd() is None:
        shutil.copy(src, dst)
        return "copied (svgo missing: npm i -g svgo)"
    plugins = [{"name": "preset-default", "params": {"overrides": {
                   "convertPathData": {"floatPrecision": p}, "cleanupNumericValues": {"floatPrecision": max(p, 3)},
                   "convertTransform": {"floatPrecision": p + 1}, "removeUselessStrokeAndFill": False}}},
               "convertStyleToAttrs",                               # mobile renderers ignore <style>/style
               {"name": "prefixIds", "params": {"prefix": prefix, "delim": "-"}}]   # unique ids when inlined
    if not keep_size:
        plugins.append("removeDimensions")                        # CSS / props control the size
    cfg = "export default " + json.dumps({"multipass": True, "js2svg": {"pretty": False}, "plugins": plugins}) + ";"
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as fh:
        fh.write(cfg)
    try:
        r = subprocess.run(svgo_cmd() + ["--config", fh.name, "-i", str(src), "-o", str(dst)],
                           capture_output=True, text=True, timeout=300)
        if r.returncode:
            raise SystemExit(r.stderr[-500:])
    finally:
        os.unlink(fh.name)
    return f"svgo p{p}"


def to_current_color(text):
    cols = paints(text) - {"currentcolor"}
    if not cols and "currentcolor" in text.lower():
        return text, "already currentColor"
    if len(cols) != 1:
        return text, f"not monochrome ({len(cols)} colors): currentColor skipped"
    c = next(iter(cols))
    return re.sub(re.escape(c), "currentColor", text, flags=re.I), f"{c} -> currentColor"


# ---------------------------------------------------------------------------
# React / React Native
# ---------------------------------------------------------------------------
RN_TAGS = {"path": "Path", "circle": "Circle", "rect": "Rect", "ellipse": "Ellipse", "line": "Line",
           "polyline": "Polyline", "polygon": "Polygon", "g": "G", "defs": "Defs", "linearGradient": "LinearGradient",
           "radialGradient": "RadialGradient", "stop": "Stop", "clipPath": "ClipPath", "mask": "Mask", "use": "Use",
           "symbol": "Symbol", "text": "Text", "tspan": "TSpan", "pattern": "Pattern"}
KEEP = re.compile(r"^(aria|data)-")


def jsx_attr(k, v):
    if k == f"{{{XLINK}}}href":
        k = "xlinkHref"
    elif k.startswith("{http://www.w3.org/XML/1998/namespace}"):
        k = "xml" + local(k).capitalize()                          # xml:space -> xmlSpace
    elif "}" in k:
        return ""                                                  # editor namespaces: drop
    elif k == "class":
        k = "className"
    elif not KEEP.match(k):
        k = re.sub(r"[-:]([a-z])", lambda m: m.group(1).upper(), k)  # stroke-width -> strokeWidth
    return f"{k}={json.dumps(v)}"


def jsx(el, rn, depth, used):
    tag = local(el.tag)
    if tag in ("title", "desc", "metadata", "style") or not isinstance(el.tag, str):
        return ""
    if rn:
        if tag not in RN_TAGS:
            return f"{'  ' * depth}{{/* <{tag}> unsupported in react-native-svg: removed */}}\n"
        used.add(RN_TAGS[tag])
        tag = RN_TAGS[tag]
    attrs = " ".join(a for a in (jsx_attr(k, v) for k, v in el.attrib.items()) if a)
    kids = "".join(jsx(c, rn, depth + 1, used) for c in el if isinstance(c.tag, str))
    pad = "  " * depth
    if kids:
        return f"{pad}<{tag} {attrs}>\n{kids}{pad}</{tag}>\n"
    return f"{pad}<{tag} {attrs} />\n"


def root_attrs(root):
    skip = {"width", "height", "viewBox", "class", "style"}
    return " ".join(a for a in (jsx_attr(k, v) for k, v in root.attrib.items() if local(k) not in skip) if a)


def react(name, text, rn=False):
    root = etree.fromstring(text.encode())
    x, y, w, h = viewbox(root)
    vb = f"{x:g} {y:g} {w:g} {h:g}"
    used = set()
    body = "".join(jsx(c, rn, 3, used) for c in root if isinstance(c.tag, str))
    comp = pascal(name)
    ratio = "" if abs(w - h) < 1e-9 else f" * {h / w:.4f}"
    extra = root_attrs(root)
    if rn:
        imports = ", ".join(sorted(used))
        return f'''import * as React from "react";
import Svg{", { " + imports + " }" if imports else ""} from "react-native-svg";
import type {{ SvgProps }} from "react-native-svg";

type Props = SvgProps & {{ size?: number; color?: string; title?: string }};

export function {comp}({{ size = {w:g}, color = "#000", title, ...props }}: Props) {{
  return (
    <Svg width={{size}} height={{size{ratio}}} viewBox="{vb}" color={{color}} {extra}
      accessible={{!!title}} accessibilityLabel={{title}} {{...props}}>
{body}    </Svg>
  );
}}

export default {comp};
'''
    return f'''import * as React from "react";
import type {{ SVGProps }} from "react";

type Props = SVGProps<SVGSVGElement> & {{ size?: number; title?: string }};

export function {comp}({{ size = {w:g}, title, ...props }}: Props) {{
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={{size}} height={{size{ratio}}} viewBox="{vb}" {extra}
      role={{title ? "img" : undefined}} aria-hidden={{title ? undefined : true}} {{...props}}>
      {{title ? <title>{{title}}</title> : null}}
{body}    </svg>
  );
}}

export default {comp};
'''


# ---------------------------------------------------------------------------
# Android / iOS / web extras
# ---------------------------------------------------------------------------
def android(src, dst, monochrome):
    cmd = shutil.which("s2v") or shutil.which("svg2vectordrawable")
    if not cmd:
        return "skipped (npm i -g svg2vectordrawable)"
    r = subprocess.run([cmd, "-i", str(src), "-o", str(dst)], capture_output=True, text=True, timeout=120)
    if r.returncode or not Path(dst).exists():
        return f"failed: {r.stderr[-300:]}"
    if monochrome:  # tint follows the theme like currentColor would
        x = Path(dst).read_text()
        x = x.replace("<vector ", '<vector android:tint="?attr/colorControlNormal" ', 1)
        Path(dst).write_text(x)
    return "ok" + (" (+android:tint)" if monochrome else "")


def ios(name, svg_text, outdir, monochrome):
    d = Path(outdir) / f"{pascal(name)}.imageset"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{snake(name)}.svg").write_text(svg_text)
    contents = {"images": [{"filename": f"{snake(name)}.svg", "idiom": "universal"}],
                "info": {"author": "xcode", "version": 1},
                "properties": {"preserves-vector-representation": True,
                               "template-rendering-intent": "template" if monochrome else "original"}}
    (d / "Contents.json").write_text(json.dumps(contents, indent=2))
    return str(d)


def sprite(items):
    syms = []
    for name, text in items:
        root = etree.fromstring(text.encode())
        x, y, w, h = viewbox(root)
        inner = "".join(etree.tostring(c, encoding="unicode") for c in root if isinstance(c.tag, str))
        inner = re.sub(r'\sxmlns(:\w+)?="[^"]+"', "", inner)
        syms.append(f'<symbol id="{snake(name)}" viewBox="{x:g} {y:g} {w:g} {h:g}">{inner}</symbol>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" style="display:none">{"".join(syms)}</svg>\n'


def data_uri(text):
    """URL-encoded (smaller than base64 for SVG); quotes switched to single."""
    t = re.sub(r"\s+", " ", text.replace('"', "'")).strip()
    return "data:image/svg+xml," + urllib.parse.quote(t, safe=" '/:=;,#()@-.")


# ---------------------------------------------------------------------------
# favicon / app icon set
# ---------------------------------------------------------------------------
def favicon(src, outdir, bg):
    from PIL import Image
    out = Path(outdir)
    tmp = Path(tempfile.mkdtemp())
    big = tmp / "big.png"
    rasterize(src, big, 1024, bg="none")
    art = Image.open(big).convert("RGBA")

    def on_bg(size, scale):
        canvas = Image.new("RGBA", (size, size), bg)
        a = art.resize((int(size * scale), int(size * scale)), Image.LANCZOS)
        canvas.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2))
        return canvas

    art.resize((48, 48), Image.LANCZOS).save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    on_bg(180, 0.84).convert("RGB").save(out / "apple-touch-icon.png")     # opaque: iOS shows alpha as black
    art.resize((192, 192), Image.LANCZOS).save(out / "icon-192.png")
    art.resize((512, 512), Image.LANCZOS).save(out / "icon-512.png")
    on_bg(512, 0.80).save(out / "icon-maskable-512.png")                   # art inside the 80% safe zone
    shutil.copy(src, out / "favicon.svg")
    (out / "head.html").write_text(
        '<link rel="icon" href="/favicon.ico" sizes="32x32">\n'
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
        '<link rel="manifest" href="/manifest.webmanifest">\n')
    (out / "manifest.webmanifest").write_text(json.dumps({"icons": [
        {"src": "/icon-192.png", "type": "image/png", "sizes": "192x192"},
        {"src": "/icon-512.png", "type": "image/png", "sizes": "512x512"},
        {"src": "/icon-maskable-512.png", "type": "image/png", "sizes": "512x512", "purpose": "maskable"}]}, indent=2))
    shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# contact sheet: real sizes on light + dark, plus 8x nearest-neighbour pixel zoom
# ---------------------------------------------------------------------------
def sheet(paths, out, sizes, zoom_size):
    from PIL import Image, ImageDraw
    tmp = Path(tempfile.mkdtemp())
    themes = (("#ffffff", "#16181d"), ("#121318", "#f1f2f5"))
    rows = []
    for p in paths:
        text = Path(p).read_text(encoding="utf-8")
        cells = []
        for bg, fg in themes:
            themed = tmp / f"{Path(p).stem}-{fg[1:]}.svg"
            themed.write_text(re.sub("currentColor", fg, text, flags=re.I))
            for s in sizes:
                png = tmp / f"{Path(p).stem}-{fg[1:]}-{s}.png"
                rasterize(themed, png, s, bg=bg)
                cells.append((bg, Image.open(png).convert("RGB")))
        z = tmp / f"{Path(p).stem}-zoom.png"
        rasterize(tmp / f"{Path(p).stem}-{themes[0][1][1:]}.svg", z, zoom_size, bg="#ffffff")
        zi = Image.open(z).convert("RGB")
        k = max(1, 192 // max(zi.size))
        zi = zi.resize((zi.width * k, zi.height * k), Image.NEAREST)
        d = ImageDraw.Draw(zi)
        for i in range(0, zi.width, k):
            d.line([(i, 0), (i, zi.height)], fill=(225, 225, 230))
        for j in range(0, zi.height, k):
            d.line([(0, j), (zi.width, j)], fill=(225, 225, 230))
        rows.append((Path(p).stem, cells, zi))
    pad = 12
    row_h = max(max(c.height for _, c in cells) for _, cells, _ in rows)
    row_h = max(row_h, max(z.height for *_, z in rows)) + 2 * pad
    width = max(sum(c.width + 2 * pad for _, c in cells) + z.width + 3 * pad for _, cells, z in rows) + 140
    img = Image.new("RGB", (width, row_h * len(rows)), "#f6f6f8")
    dr = ImageDraw.Draw(img)
    for r, (name, cells, z) in enumerate(rows):
        y0, x = r * row_h, 140
        dr.text((pad, y0 + row_h // 2 - 6), name[:18], fill="#333")
        for bg, c in cells:
            dr.rectangle([x, y0 + pad // 2, x + c.width + 2 * pad, y0 + row_h - pad // 2], fill=bg)
            img.paste(c, (x + pad, y0 + (row_h - c.height) // 2))
            x += c.width + 2 * pad
        img.paste(z, (x + pad, y0 + (row_h - z.height) // 2))
    img.save(out)
    shutil.rmtree(tmp, ignore_errors=True)
    return out


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svgs", nargs="+")
    ap.add_argument("-o", "--out", help="output folder; wrapping happens only when given")
    ap.add_argument("--targets", default="web", help="web,react,rn,android,ios,flutter")
    ap.add_argument("--audit", action="store_true", help="audit only")
    ap.add_argument("--current-color", action="store_true", help="monochrome art -> currentColor (themeable)")
    ap.add_argument("--keep-size", action="store_true", help="keep width/height (cards, fixed-size art)")
    ap.add_argument("--png", default="", help="scales, e.g. 1,2,3 -> name.png name@2x.png name@3x.png")
    ap.add_argument("--favicon", action="store_true")
    ap.add_argument("--bg", default="#ffffff", help="background for apple-touch / maskable icons")
    ap.add_argument("--sheet", action="store_true", help="light/dark real-size sheet + pixel zoom")
    ap.add_argument("--sizes", default="16,20,24,32,48", help="sheet sizes (long side px)")
    ap.add_argument("--zoom", type=int, help="size shown in the 8x pixel zoom (default: 3rd sheet size)")
    a = ap.parse_args()
    targets = [t.strip() for t in a.targets.split(",") if t.strip()]
    paths = [Path(p) for p in a.svgs]

    worst = 0
    for p in paths:
        issues = audit(p, targets)
        print(f"audit {p.name} [{', '.join(targets)}]: " + ("clean" if not issues else ""))
        for lv, t, msg in sorted(issues, key=lambda i: ("ERROR", "WARN", "INFO").index(i[0])):
            print(f"  {lv:5s} {t:8s} {msg}")
            worst = max(worst, {"ERROR": 2, "WARN": 1, "INFO": 0}[lv])
    if a.sheet:
        sizes = [int(v) for v in a.sizes.split(",")]
        dest = Path(a.out or paths[0].parent) / "sheet.png"
        dest.parent.mkdir(parents=True, exist_ok=True)
        print("sheet:", sheet(paths, dest, sizes, a.zoom or sizes[min(2, len(sizes) - 1)]))
    if a.audit or not a.out:                                     # wrapping only when -o is given
        sys.exit(1 if worst == 2 else 0)

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    web_items, css = [], []
    for p in paths:
        name = p.stem
        opt = out / f"{snake(name)}.svg"
        note = optimize(p, opt, snake(name), keep_size=a.keep_size)
        text = opt.read_text(encoding="utf-8")
        mono = False
        if a.current_color:
            text, cnote = to_current_color(text)
            mono = "currentColor" in text
            opt.write_text(text)
            note += f"; {cnote}"
        else:
            mono = paints(text) <= {"currentcolor"} and "currentcolor" in text.lower()
        made = [opt.name]
        if "web" in targets:
            web_items.append((name, text))
            uri = data_uri(text)
            if mono:   # mask + currentColor: the icon follows the text color (a background image cannot)
                css.append(f".i-{snake(name)}{{display:inline-block;width:1em;height:1em;background-color:currentColor;"
                           f"-webkit-mask:url(\"{uri}\") center/contain no-repeat;mask:url(\"{uri}\") center/contain no-repeat}}")
            else:
                css.append(f".i-{snake(name)}{{background:url(\"{uri}\") center/contain no-repeat}}")
        if "react" in targets:
            (out / f"{pascal(name)}.tsx").write_text(react(name, text))
            made.append(f"{pascal(name)}.tsx")
        if "rn" in targets:
            (out / f"{pascal(name)}.native.tsx").write_text(react(name, text, rn=True))
            made.append(f"{pascal(name)}.native.tsx")
        if "android" in targets:
            ad = out / "android"
            ad.mkdir(exist_ok=True)
            # android needs a concrete color: give the converter black, tint at runtime
            src = out / f".{snake(name)}.android.svg"
            src.write_text(re.sub("currentColor", "#000000", text, flags=re.I))
            made.append("android/" + snake(name) + ".xml " + android(src, ad / f"{snake(name)}.xml", mono))
            src.unlink()
        if "ios" in targets:
            ios(name, text, out / "ios", mono)
            made.append(f"ios/{pascal(name)}.imageset")
        if a.png:
            (out / "png").mkdir(exist_ok=True)
            w, h = viewbox(etree.fromstring(text.encode()))[2:]
            for k in [float(v) for v in a.png.split(",")]:
                suffix = "" if k == 1 else f"@{k:g}x"            # iOS naming; Android uses the VectorDrawable
                rasterize(opt, out / "png" / f"{snake(name)}{suffix}.png", round(max(w, h) * k), bg="none")
            made.append(f"png/{snake(name)}[{a.png}]")
        if a.favicon:
            favicon(opt, out, a.bg)
            made.append("favicon set + head.html + manifest")
        print(f"wrapped {name}: {note} -> {', '.join(made)}")
    if web_items:
        (out / "sprite.svg").write_text(sprite(web_items))
        (out / "icons.css").write_text("\n".join(css) + "\n")
        print(f"web: sprite.svg ({len(web_items)} symbols, use <svg><use href=\"sprite.svg#id\"/></svg>), icons.css")
    sys.exit(1 if worst == 2 else 0)


if __name__ == "__main__":
    main()

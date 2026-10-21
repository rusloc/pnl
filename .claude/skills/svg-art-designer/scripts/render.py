#!/usr/bin/env python3
"""
render.py — rasterize SVG artwork for visual review, export, and portability checks.

  python render.py art.svg                    # -> art.png (long side 1200px), best engine
  python render.py art.svg -o out.png -s 3000 # high-res export
  python render.py art.svg --gray             # also art.gray.png: small grayscale value-check
  python render.py art.svg --compare          # render in every available engine, diff them,
                                              #   write art.compare.png side-by-side sheet
  python render.py --engines                  # list engines available here

Engines (auto order): chromium (browser truth: how most people will view the file) >
resvg (fast, strict; Figma/Typst-class engine) > rsvg (librsvg: GNOME, Wikipedia, thumbnailers,
sharp/ImageMagick) > cairosvg (NO filter support — last resort).
Note: the resvg-py 0.5 wheel mis-renders feDisplacementMap; resvg-js is preferred when present.
Install any one:  pip install resvg-py   |   npm i -g @resvg/resvg-js   |   pip install playwright && playwright install chromium
"""
import argparse
import base64
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

ORDER = ["chromium", "resvg", "rsvg", "cairosvg"]


# ---------------------------------------------------------------------------
def _npm_root():
    if not shutil.which("npm"):
        return None
    try:
        return subprocess.run(["npm", "root", "-g"], capture_output=True, text=True,
                              timeout=20).stdout.strip() or None
    except Exception:
        return None


_NODE_ROOT = None


def _node_has(mod):
    global _NODE_ROOT
    if not shutil.which("node"):
        return False
    if _NODE_ROOT is None:
        _NODE_ROOT = _npm_root() or ""
    return bool(_NODE_ROOT) and os.path.isdir(os.path.join(_NODE_ROOT, mod))


def _node(script, *args):
    env = dict(os.environ, NODE_PATH=_NODE_ROOT or "")
    r = subprocess.run(["node", "-e", script, *args], capture_output=True, text=True, env=env,
                       timeout=300)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[-800:])


def intrinsic_size(svg_text):
    """(width, height) in px from width/height attributes, else the viewBox."""
    head = svg_text[: svg_text.find(">", svg_text.find("<svg")) + 1]
    unit_px = {"px": 1, "": 1, "mm": 96 / 25.4, "cm": 96 / 2.54, "in": 96, "pt": 96 / 72, "pc": 16}

    def attr(name):
        m = re.search(r'\s%s\s*=\s*["\']([^"\']+)["\']' % name, head)
        return m.group(1).strip() if m else None

    vb = attr("viewBox")
    vbw = vbh = None
    if vb:
        parts = [float(v) for v in re.split(r"[\s,]+", vb) if v]
        if len(parts) == 4:
            vbw, vbh = parts[2], parts[3]
    w, h = attr("width"), attr("height")

    def px(v, ref):
        if v is None:
            return None
        m = re.match(r"([0-9.eE+-]+)\s*([a-z%]*)", v)
        if not m:
            return None
        num, u = float(m.group(1)), m.group(2)
        if u == "%":
            return ref * num / 100 if ref else None
        return num * unit_px.get(u, 1)

    W, H = px(w, vbw), px(h, vbh)
    if W and H:
        return W, H
    if vbw and vbh:
        if W:
            return W, W * vbh / vbw
        if H:
            return H * vbw / vbh, H
        return vbw, vbh
    return W or 300.0, H or 150.0


def target_size(svg_text, size):
    w, h = intrinsic_size(svg_text)
    k = size / max(w, h)
    return max(1, round(w * k)), max(1, round(h * k))


# ---------------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------------
def _has_resvg():
    if _node_has("@resvg/resvg-js"):
        return "node"
    if shutil.which("resvg"):
        return "cli"
    try:
        import resvg_py  # noqa: F401
        return "py"
    except Exception:
        return None


def _render_resvg(svg_path, png_path, W, H):
    kind = _has_resvg()
    if kind == "py":
        import resvg_py
        data = resvg_py.svg_to_bytes(svg_path=svg_path, width=W)
        with open(png_path, "wb") as f:
            f.write(bytes(data))
    elif kind == "cli":
        subprocess.run(["resvg", "-w", str(W), svg_path, png_path], check=True,
                       capture_output=True, timeout=300)
    elif kind == "node":
        _node("const {Resvg}=require('@resvg/resvg-js');const fs=require('fs');"
              "const [i,o,w]=process.argv.slice(1);"
              "const r=new Resvg(fs.readFileSync(i),{fitTo:{mode:'width',value:+w},"
              "font:{loadSystemFonts:true}});fs.writeFileSync(o,r.render().asPng());",
              svg_path, png_path, str(W))
    else:
        raise RuntimeError("resvg not available")


def _has_chromium():
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except Exception:
        return False
    return True


def _render_chromium(svg_path, png_path, W, H):
    from playwright.sync_api import sync_playwright
    with open(svg_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    # <img> = secure static mode, like any image viewer: no scripts, no external loads.
    html = (f"<html><body style='margin:0;background:transparent'>"
            f"<img src='data:image/svg+xml;base64,{b64}' style='display:block;width:{W}px;height:{H}px'>"
            f"</body></html>")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H})
        pg.set_content(html)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(100)
        pg.screenshot(path=png_path, omit_background=True, clip={"x": 0, "y": 0, "width": W, "height": H})
        b.close()


def _has_rsvg():
    if shutil.which("rsvg-convert"):
        return "cli"
    if _node_has("sharp"):
        return "sharp"
    return None


def _render_rsvg(svg_path, png_path, W, H):
    kind = _has_rsvg()
    if kind == "cli":
        subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), "-o", png_path, svg_path],
                       check=True, capture_output=True, timeout=300)
    elif kind == "sharp":
        with open(svg_path, encoding="utf-8", errors="replace") as f:
            iw, _ = intrinsic_size(f.read())
        density = max(1, min(2400, 72 * W / iw))
        _node("const sharp=require('sharp');const [i,o,w,h,d]=process.argv.slice(1);"
              "sharp(i,{density:+d,limitInputPixels:false}).resize(+w,+h,{fit:'fill'}).png().toFile(o)"
              ".catch(e=>{console.error(e);process.exit(1)});",
              svg_path, png_path, str(W), str(H), f"{density:.3f}")
    else:
        raise RuntimeError("librsvg not available")


def _has_cairosvg():
    try:
        import cairosvg  # noqa: F401
        return True
    except Exception:
        return False


def _render_cairosvg(svg_path, png_path, W, H):
    import cairosvg
    cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=W, output_height=H)


ENGINES = {
    "resvg": (_has_resvg, _render_resvg),
    "chromium": (_has_chromium, _render_chromium),
    "rsvg": (_has_rsvg, _render_rsvg),
    "cairosvg": (_has_cairosvg, _render_cairosvg),
}


def available():
    return [n for n in ORDER if ENGINES[n][0]()]


# ---------------------------------------------------------------------------
def _checker(size, cell=16):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", size, (236, 236, 236))
    d = ImageDraw.Draw(im)
    for y in range(0, size[1], cell):
        for x in range((y // cell % 2) * cell, size[0], cell * 2):
            d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(205, 205, 205))
    return im


def _finish(png_path, bg):
    """Flatten transparency: bg='auto' -> checkerboard only if transparent; 'none' keeps alpha."""
    try:
        from PIL import Image
    except Exception:
        return False
    im = Image.open(png_path).convert("RGBA")
    hist = im.getchannel("A").histogram()
    # ignore sub-pixel letterbox edges from rounding the output size
    transparent = sum(hist[:250]) > 0.005 * im.width * im.height
    if bg == "none" or (bg == "auto" and not transparent):
        return transparent
    base = _checker(im.size) if bg in ("auto", "checker") else Image.new("RGB", im.size, bg)
    base.paste(im, (0, 0), im)
    base.save(png_path)
    return transparent


def render(svg_path, png_path=None, size=1200, backend="auto", bg="auto", quiet=False):
    svg_path = os.path.abspath(svg_path)
    png_path = png_path or os.path.splitext(svg_path)[0] + ".png"
    with open(svg_path, encoding="utf-8", errors="replace") as f:
        W, H = target_size(f.read(), size)
    engines = available() if backend == "auto" else [backend]
    if not engines:
        raise SystemExit("No SVG renderer found. Install one:  pip install resvg-py")
    last = None
    for name in engines:
        t0 = time.time()
        try:
            ENGINES[name][1](svg_path, png_path, W, H)
        except Exception as e:  # try the next engine
            last = e
            if not quiet:
                print(f"[{name}] failed: {e}", file=sys.stderr)
            continue
        dt = time.time() - t0
        transparent = _finish(png_path, bg)
        if not quiet:
            note = "  (transparent areas shown as checkerboard)" if transparent and bg == "auto" else ""
            slow = "  <- slow: heavy filters/blur/octaves?" if dt > 3 else ""
            warn = "  WARNING: cairosvg ignores filters" if name == "cairosvg" else ""
            print(f"rendered {os.path.basename(png_path)} {W}x{H} via {name} in {dt:.2f}s{slow}{note}{warn}")
        return name
    raise SystemExit(f"All renderers failed: {last}")


def gray_thumb(png_path, out_path, size=320):
    """Small grayscale version = the painter's 'squint test' for value structure."""
    from PIL import Image
    im = Image.open(png_path).convert("L")
    im.thumbnail((size, size))
    im.save(out_path)
    hist = im.histogram()
    total = sum(hist)
    dark = sum(hist[:85]) / total
    mid = sum(hist[85:170]) / total
    light = sum(hist[170:]) / total
    print(f"value check {os.path.basename(out_path)}: dark {dark:.0%} / mid {mid:.0%} / light {light:.0%}")


def compare(svg_path, size=900):
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
    base = os.path.splitext(os.path.abspath(svg_path))[0]
    names = available()
    outs = {}
    for n in names:
        p = f"{base}.{n}.png"
        try:
            render(svg_path, p, size=size, backend=n, bg="white", quiet=True)
            outs[n] = Image.open(p).convert("RGB")
        except SystemExit as e:
            print(f"[{n}] failed: {e}")
    if not outs:
        raise SystemExit("nothing rendered")
    ref_name = "chromium" if "chromium" in outs else next(iter(outs))
    ref = outs[ref_name]
    print(f"reference: {ref_name}")
    for n, im in outs.items():
        if n == ref_name:
            continue
        if im.size != ref.size:
            im = im.resize(ref.size)
        # blur both first: compares structure/colour, not per-pixel noise (turbulence grain
        # legitimately differs between engines)
        diff = ImageChops.difference(ref.filter(ImageFilter.GaussianBlur(3)),
                                     im.filter(ImageFilter.GaussianBlur(3))).convert("L")
        hist = diff.histogram()
        total = sum(hist)
        mean = sum(i * c for i, c in enumerate(hist)) / total
        big = sum(hist[24:]) / total
        verdict = "consistent" if big < 0.01 else ("minor differences" if big < 0.05 else "DIFFERENT — inspect")
        # small elements vanishing or moving (text without fonts, pathLength dashes, clipped
        # filters) barely move the global averages: check the worst local cell too
        cell = max(4, min(ref.size) // 30)
        worst = max(i for i, c in enumerate(diff.reduce(cell).histogram()) if c)
        if worst > 40:
            verdict += (f"; LOCAL difference {worst}/255 — something small renders differently or is "
                        f"missing (text, pathLength dashes, clipped filter). Look at the contact sheet")
        if n == "cairosvg":
            verdict += " (cairosvg lacks filters; ignore if filters used)"
        print(f"  {n:9s} vs {ref_name}: mean diff {mean:5.2f}/255, pixels off >24: {big:6.2%}  -> {verdict}")
    # contact sheet
    w, h = ref.size
    pad, lab = 12, 28
    sheet = Image.new("RGB", (len(outs) * (w + pad) + pad, h + lab + pad * 2), (250, 250, 250))
    d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(outs.items()):
        x = pad + i * (w + pad)
        d.text((x, pad), n, fill=(20, 20, 20))
        sheet.paste(im.resize((w, h)), (x, pad + lab))
    out = f"{base}.compare.png"
    sheet.save(out)
    print(f"contact sheet: {out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg", nargs="?")
    ap.add_argument("-o", "--out")
    ap.add_argument("-s", "--size", type=int, default=1200, help="long side in px (default 1200)")
    ap.add_argument("-b", "--backend", default="auto", choices=["auto"] + ORDER)
    ap.add_argument("--bg", default="auto", help="auto | none | checker | <css color>")
    ap.add_argument("--gray", action="store_true", help="also write a grayscale value-check thumbnail")
    ap.add_argument("--compare", action="store_true", help="render with every engine and diff")
    ap.add_argument("--engines", action="store_true", help="list available engines")
    a = ap.parse_args()
    if a.engines or not a.svg:
        print("available engines:", ", ".join(available()) or "none")
        return
    if a.compare:
        compare(a.svg, size=min(a.size, 900))
        return
    out = a.out or os.path.splitext(a.svg)[0] + ".png"
    render(a.svg, out, size=a.size, backend=a.backend, bg=a.bg)
    if a.gray:
        gray_thumb(out, os.path.splitext(out)[0] + ".gray.png")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
svgkit — a small toolkit for building standalone SVG artwork from Python.

Usage from a generator script:

    import sys; sys.path.insert(0, "<skill-dir>/scripts")
    from svgkit import *

    c = Canvas(1600, 1000, bg="#101827", title="Harbour at night")
    c.defs(linear_gradient("sky-grad", ["#0b1026", "#2b2f77", "#e08a6b"], x2=0, y2=1))
    c.layer("sky", rect(0, 0, 1600, 1000, fill="url(#sky-grad)"))
    c.save("harbour.svg", preview=True)

Pure standard library for everything except:
  voronoi_polygons() / delaunay_triangles()  -> numpy + scipy
  text_to_path()                              -> fontTools
Sections: numbers & elements | Canvas | geometry | noise & randomness |
sampling & layout | color (OKLab/OKLCH) | gradients | filters | text | preview
"""
import math
import os
import random
import re
import shutil
import subprocess
from xml.sax.saxutils import escape as _esc, quoteattr as _quoteattr

__all__ = [
    # numbers / elements
    "PRECISION", "set_precision", "auto_precision", "fmt", "pt", "pts", "el", "esc",
    "g", "rect", "circle", "ellipse", "line", "path", "polygon", "polyline", "text", "use",
    "translate", "rotate", "scale", "Canvas",
    # geometry
    "polar", "lerp", "dist", "poly_d", "smooth_d", "circle_d", "arc_d", "ring_sector_d",
    "rounded_poly_d", "ribbon_d", "dot_paths", "regular_polygon", "star_points", "blob_points", "superellipse_points",
    "spiral_points", "wave_points", "parametric_points", "hypotrochoid_points", "polygon_area",
    "point_in_polygon", "bbox",
    # noise / random
    "Noise", "rng",
    # sampling & layout
    "poisson_disk", "circle_pack", "voronoi_polygons", "delaunay_triangles", "flow_lines",
    "contour_lines",
    # color
    "hex_to_rgb", "rgb_to_hex", "to_oklab", "from_oklab", "to_oklch", "oklch", "mix", "ramp",
    "lighten", "darken", "saturate", "hue_shift", "tone_ramp", "harmony", "relative_luminance", "contrast_ratio",
    "multiply", "screen", "ramp_scalar",
    # gradients
    "linear_gradient", "radial_gradient", "smooth_stops",
    # filters
    "filter_region", "grain_filter", "shadow_filter", "glow_filter", "rough_filter",
    "watercolor_filter", "paper_filter", "inner_shadow_filter", "gooey_filter", "blur_filter",
    # text / preview
    "find_font", "text_to_path", "text_on_circle", "preview",
]

# ---------------------------------------------------------------------------
# Numbers & elements
# ---------------------------------------------------------------------------
PRECISION = 2


def set_precision(p):
    """Set the global number of decimals used by fmt() (and therefore every helper)."""
    global PRECISION
    PRECISION = int(p)


def auto_precision(max_dim):
    """Decimals that keep rounding error well below visibility for a canvas of this size.
    1000-unit canvas -> 1, 100 -> 2, 24 -> 3."""
    if max_dim <= 0:
        return 2
    return max(1, 4 - int(math.floor(math.log10(max_dim))))


def fmt(v, p=None):
    """Format a number compactly: fixed decimals, trailing zeros stripped, no '-0'."""
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    p = PRECISION if p is None else p
    s = f"{float(v):.{p}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s in ("-0", "", "-"):
        s = "0"
    return s


def pt(p):
    return f"{fmt(p[0])},{fmt(p[1])}"


def pts(points):
    """Points list -> 'x,y x,y ...' for polygon/polyline."""
    return " ".join(pt(p) for p in points)


_ATTR_SPECIAL = {"xlink_href": "xlink:href", "xml_space": "xml:space",
                 "inkscape_label": "inkscape:label", "inkscape_groupmode": "inkscape:groupmode"}


def _attr_name(k):
    if k in _ATTR_SPECIAL:
        return _ATTR_SPECIAL[k]
    if k.endswith("_"):          # class_ -> class, in_ -> in
        k = k[:-1]
    return k.replace("_", "-")   # stroke_width -> stroke-width; camelCase passes through


def _flatten(items):
    for it in items:
        if it is None:
            continue
        if isinstance(it, (list, tuple)):
            yield from _flatten(it)
        else:
            yield str(it)


def esc(s):
    """Escape text content for XML."""
    return _esc(str(s))


# Only coordinates get the canvas precision. Everything else (opacity, offsets, filter params
# like baseFrequency=0.04, matrix values, k1..k4) keeps up to 4 decimals — rounding those to the
# coordinate precision silently destroys textures and shifts opacities.
_GEOM = {"x", "y", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "width", "height",
         "fx", "fy", "stroke-width", "font-size", "startOffset", "letter-spacing"}


def _attr_val(tag, name, v):
    if isinstance(v, float) and (tag.startswith("fe") or name not in _GEOM):
        return fmt(v, max(PRECISION, 4))
    return fmt(v)


def el(tag, *children, **attrs):
    """Generic element. Children: strings / nested lists. kwargs -> attributes
    (underscores become hyphens, trailing underscore stripped: class_='x', in_='SourceGraphic')."""
    a = "".join(f" {n}={_quoteattr(_attr_val(tag, n, v))}"
                for n, v in ((_attr_name(k), v) for k, v in attrs.items()) if v is not None)
    kids = "".join(_flatten(children))
    return f"<{tag}{a}>{kids}</{tag}>" if kids else f"<{tag}{a}/>"


def g(*children, **a):
    return el("g", *children, **a)


def rect(x, y, w, h, **a):
    return el("rect", x=x, y=y, width=w, height=h, **a)


def circle(cx, cy, r, **a):
    return el("circle", cx=cx, cy=cy, r=r, **a)


def ellipse(cx, cy, rx, ry, **a):
    return el("ellipse", cx=cx, cy=cy, rx=rx, ry=ry, **a)


def line(x1, y1, x2, y2, **a):
    return el("line", x1=x1, y1=y1, x2=x2, y2=y2, **a)


def path(d, **a):
    return el("path", d=d, **a)


def polygon(points, **a):
    return el("polygon", points=pts(points), **a)


def polyline(points, **a):
    return el("polyline", points=pts(points), **a)


def text(s, x, y, **a):
    return el("text", esc(s), x=x, y=y, **a)


def use(ref_id, x=None, y=None, **a):
    """<use> with xlink:href (most portable across Illustrator / older Inkscape / librsvg)."""
    return el("use", xlink_href=f"#{ref_id}", x=x, y=y, **a)


def translate(x, y=0):
    return f"translate({fmt(x)} {fmt(y)})"


def rotate(deg, cx=None, cy=None):
    return f"rotate({fmt(deg)} {fmt(cx)} {fmt(cy)})" if cx is not None else f"rotate({fmt(deg)})"


def scale(sx, sy=None):
    return f"scale({fmt(sx)})" if sy is None else f"scale({fmt(sx)} {fmt(sy)})"


class Canvas:
    """Document builder. Layers are named <g> groups (ids show up as layer/object names in
    Illustrator & Figma; with inkscape=True they also become real Inkscape layers)."""

    def __init__(self, width, height, viewbox=None, bg=None, title=None, desc=None,
                 units="", precision=None, inkscape_layers=True):
        self.width, self.height = width, height
        self.viewbox = tuple(viewbox) if viewbox else (0, 0, width, height)
        set_precision(precision if precision is not None
                      else auto_precision(max(self.viewbox[2], self.viewbox[3])))
        self.units = units
        self.bg = bg
        self.title, self.desc = title, desc
        self.inkscape_layers = inkscape_layers
        self.style = None
        self._defs, self._body, self._ids = [], [], {}

    # geometry shortcuts
    @property
    def cx(self):
        return self.viewbox[0] + self.viewbox[2] / 2

    @property
    def cy(self):
        return self.viewbox[1] + self.viewbox[3] / 2

    @property
    def w(self):
        return self.viewbox[2]

    @property
    def h(self):
        return self.viewbox[3]

    def uid(self, prefix="id"):
        n = self._ids.get(prefix, 0) + 1
        self._ids[prefix] = n
        return prefix if n == 1 else f"{prefix}-{n}"

    def defs(self, *items):
        self._defs.extend(_flatten(items))
        return self

    def add(self, *items):
        self._body.extend(_flatten(items))
        return self

    def layer(self, name, *items, **attrs):
        """Append a named top-level group (painted above previous layers)."""
        taken = set(re.findall(r'\sid="([^"]+)"', "".join(self._defs) + "".join(self._body)))
        if name in taken:
            raise ValueError(f"layer name {name!r} is already an id (gradient/filter/layer). Use e.g. "
                             f"'{name}-grad' for defs and plain names for layers.")
        if self.inkscape_layers:
            attrs.setdefault("inkscape_groupmode", "layer")
            attrs.setdefault("inkscape_label", name)
        self._body.append(g(*items, id=name, **attrs))
        return self

    def texture(self, filter_id, name=None, opacity=None):
        """Overlay a texture filter (grain etc.) on everything painted so far, as its own layer.
        Uses an invisible rect (fill-opacity 0): filters still run in Chromium/resvg/librsvg,
        and renderers without filter support show nothing instead of a solid sheet.
        (fill="none" would NOT work: resvg drops unpainted elements and the effect vanishes.)"""
        return self.layer(name or f"{filter_id}-texture",
                          self.full_rect(fill="#000", fill_opacity=0, filter=f"url(#{filter_id})"),
                          opacity=opacity)

    def full_rect(self, **a):
        """A rect covering the whole viewBox (backgrounds, overlays, grain)."""
        x, y, w, h = self.viewbox
        return rect(x, y, w, h, **a)

    def to_string(self):
        x, y, w, h = self.viewbox
        ns = ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
        if self.inkscape_layers:
            ns += ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'
        out = [f'<svg{ns} width="{fmt(self.width)}{self.units}" height="{fmt(self.height)}{self.units}" '
               f'viewBox="{fmt(x)} {fmt(y)} {fmt(w)} {fmt(h)}">']
        if self.title:
            out.append(f"<title>{esc(self.title)}</title>")
        if self.desc:
            out.append(f"<desc>{esc(self.desc)}</desc>")
        if self.style:
            out.append(f"<style>{self.style}</style>")
        if self._defs:
            out.append("<defs>" + "\n".join(self._defs) + "</defs>")
        if self.bg:
            out.append(self.full_rect(id="background", fill=self.bg))
        out.extend(self._body)
        out.append("</svg>")
        doc = "\n".join(out)
        ids = re.findall(r'\sid="([^"]+)"', doc)
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            raise ValueError(f"duplicate id(s) {dupes}: url(#id)/href would resolve unpredictably "
                             f"across renderers. Rename the layer or the def.")
        return doc

    def save(self, filepath, preview=False, size=1200):
        d = os.path.dirname(os.path.abspath(filepath))
        os.makedirs(d, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.to_string())
        kb = os.path.getsize(filepath) / 1024
        print(f"saved {filepath} ({kb:.1f} KB)")
        if preview:
            globals()["preview"](filepath, size=size)
        return filepath


# ---------------------------------------------------------------------------
# Geometry  (angles in degrees; 0 = 3 o'clock, positive = clockwise because SVG y points down)
# ---------------------------------------------------------------------------
def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def lerp(a, b, t):
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * t for x, y in zip(a, b))
    return a + (b - a) * t


def dist(p, q):
    return math.hypot(p[0] - q[0], p[1] - q[1])


def poly_d(points, closed=True):
    points = list(points)
    d = "M" + " L".join(pt(p) for p in points)
    return d + ("Z" if closed else "")


def smooth_d(points, closed=False, k=1.0):
    """Smooth curve THROUGH the points (Catmull-Rom -> cubic Bezier).
    k: tension (1.0 classic, <1 tighter/straighter, >1 loopier)."""
    p = list(points)
    n = len(p)
    if n < 3:
        return poly_d(p, closed)

    def P(i):
        return p[i % n] if closed else p[max(0, min(n - 1, i))]

    d = [f"M{pt(p[0])}"]
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) * k / 6, p1[1] + (p2[1] - p0[1]) * k / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) * k / 6, p2[1] - (p3[1] - p1[1]) * k / 6)
        d.append(f"C{pt(c1)} {pt(c2)} {pt(p2)}")
    if closed:
        d.append("Z")
    return " ".join(d)


def circle_d(cx, cy, r):
    """Circle as a path (two arcs) — usable in compound paths, textPath, clip shapes."""
    return (f"M{fmt(cx - r)},{fmt(cy)} a{fmt(r)},{fmt(r)} 0 1,0 {fmt(2 * r)},0 "
            f"a{fmt(r)},{fmt(r)} 0 1,0 {fmt(-2 * r)},0Z")


def arc_d(cx, cy, r, a0, a1):
    """Open circular arc from angle a0 to a1 (degrees, clockwise if a1 > a0)."""
    if abs(a1 - a0) >= 360:
        return circle_d(cx, cy, r)
    x0, y0 = polar(cx, cy, r, a0)
    x1, y1 = polar(cx, cy, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return f"M{fmt(x0)},{fmt(y0)} A{fmt(r)},{fmt(r)} 0 {large},{sweep} {fmt(x1)},{fmt(y1)}"


def ring_sector_d(cx, cy, r_in, r_out, a0, a1):
    """Annular wedge (donut slice). r_in=0 gives a pie slice. Building block for sunbursts,
    fake conic gradients, radial charts-as-art, mandalas."""
    large = 1 if abs(a1 - a0) > 180 else 0
    o0, o1 = polar(cx, cy, r_out, a0), polar(cx, cy, r_out, a1)
    d = f"M{pt(o0)} A{fmt(r_out)},{fmt(r_out)} 0 {large},1 {pt(o1)}"
    if r_in <= 0:
        return d + f" L{fmt(cx)},{fmt(cy)}Z"
    i1, i0 = polar(cx, cy, r_in, a1), polar(cx, cy, r_in, a0)
    return d + f" L{pt(i1)} A{fmt(r_in)},{fmt(r_in)} 0 {large},0 {pt(i0)}Z"


def rounded_poly_d(points, radius):
    """Polygon with rounded corners (quadratic corners; radius clamped to half each edge)."""
    p = list(points)
    n = len(p)
    d = []
    for i in range(n):
        p0, p1, p2 = p[i - 1], p[i], p[(i + 1) % n]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1) or 1e-9, math.hypot(*v2) or 1e-9
        r = min(radius, l1 / 2, l2 / 2)
        a = (p1[0] + v1[0] / l1 * r, p1[1] + v1[1] / l1 * r)
        b = (p1[0] + v2[0] / l2 * r, p1[1] + v2[1] / l2 * r)
        d.append(("M" if i == 0 else "L") + pt(a))
        d.append(f"Q{pt(p1)} {pt(b)}")
    return " ".join(d) + "Z"


def ribbon_d(points, width, taper=0.25, profile=None, k=1.0):
    """Filled outline of a variable-width stroke along `points` (brush strokes, leaves, hair,
    calligraphic line art). Real strokes have constant width; this tapers.
    width: max width. taper: fraction of length over which each end thins (0 = blunt).
    profile: optional f(t in 0..1) -> 0..1 width multiplier (overrides taper),
             e.g. lambda t: math.sin(math.pi * t) ** 0.7 for a leaf/petal."""
    p = list(points)
    n = len(p)
    if n < 2:
        return ""
    # cumulative length for t
    L = [0.0]
    for a, b in zip(p, p[1:]):
        L.append(L[-1] + dist(a, b))
    total = L[-1] or 1.0
    left, right = [], []
    for i in range(n):
        a, b = p[max(0, i - 1)], p[min(n - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tx, ty) or 1e-9
        nx, ny = -ty / ln, tx / ln
        t = L[i] / total
        if profile:
            m = profile(t)
        elif taper > 0:
            m = min(1.0, t / taper, (1 - t) / taper) ** 0.6
        else:
            m = 1.0
        w = max(width * m, width * 0.02) / 2
        left.append((p[i][0] + nx * w, p[i][1] + ny * w))
        right.append((p[i][0] - nx * w, p[i][1] - ny * w))
    return smooth_d(left + right[::-1], closed=True, k=k)


def dot_paths(dots, quantum=0.5, **attrs):
    """Thousands of round dots, ~4x smaller than circles: each dot is a zero-length subpath
    ('M x y h0') drawn with a round cap, grouped into one path per radius bucket
    (stroke-width = diameter). Verified identical in Chromium, resvg, librsvg, cairosvg.
    dots: iterable of (x, y, r). quantum: radius bucket size. attrs: e.g. stroke='#ff48b0'.
    Returns a list of <path> strings (wrap them in a g)."""
    buckets = {}
    for x, y, r in dots:
        if r <= 0:
            continue
        q = max(quantum, round(r / quantum) * quantum)
        buckets.setdefault(q, []).append(f"M{fmt(x)} {fmt(y)}h0")
    attrs.setdefault("fill", "none")
    attrs.setdefault("stroke_linecap", "round")
    return [el("path", d="".join(v), stroke_width=2 * q, **attrs) for q, v in sorted(buckets.items())]


def regular_polygon(cx, cy, r, n, rotation=-90):
    return [polar(cx, cy, r, rotation + 360 * i / n) for i in range(n)]


def star_points(cx, cy, r_out, r_in, n=5, rotation=-90):
    out = []
    for i in range(2 * n):
        out.append(polar(cx, cy, r_out if i % 2 == 0 else r_in, rotation + 180 * i / n))
    return out


def blob_points(cx, cy, r, n=8, variance=0.25, seed=None, rand=None):
    """Organic blob outline points; feed to smooth_d(points, closed=True)."""
    R = rand or random.Random(seed)
    off = R.uniform(0, 360)
    return [polar(cx, cy, r * (1 + R.uniform(-variance, variance)),
                  off + 360 * i / n + R.uniform(-90 / n, 90 / n)) for i in range(n)]


def superellipse_points(cx, cy, rx, ry, exponent=4.0, samples=120):
    """Squircle family: exponent 2 = ellipse, 4 = squircle, ->inf = rectangle, <1 = astroid-like."""
    out = []
    for i in range(samples):
        t = 2 * math.pi * i / samples
        c, s = math.cos(t), math.sin(t)
        out.append((cx + rx * math.copysign(abs(c) ** (2 / exponent), c),
                    cy + ry * math.copysign(abs(s) ** (2 / exponent), s)))
    return out


def spiral_points(cx, cy, r0, r1, turns=3, samples=400, log=False, start_deg=0):
    """Archimedean (log=False) or logarithmic/golden-style (log=True) spiral."""
    out = []
    for i in range(samples + 1):
        t = i / samples
        r = r0 * (r1 / r0) ** t if (log and r0 > 0) else r0 + (r1 - r0) * t
        out.append(polar(cx, cy, r, start_deg + 360 * turns * t))
    return out


def wave_points(x0, x1, y, amp, wavelength, phase=0.0, samples=None, fn=math.sin):
    samples = samples or max(8, int(abs(x1 - x0) / wavelength * 8))
    return [(x0 + (x1 - x0) * i / samples,
             y + amp * fn(2 * math.pi * ((x1 - x0) * i / samples) / wavelength + phase))
            for i in range(samples + 1)]


def parametric_points(fx, fy, t0, t1, samples=400):
    return [(fx(t0 + (t1 - t0) * i / samples), fy(t0 + (t1 - t0) * i / samples))
            for i in range(samples + 1)]


def hypotrochoid_points(cx, cy, R, r, d, samples=2000):
    """Spirograph curve. Use integers R, r for a closed figure."""
    loops = r // math.gcd(int(R), int(r)) if float(R).is_integer() and float(r).is_integer() else 10
    T = 2 * math.pi * loops
    return parametric_points(lambda t: cx + (R - r) * math.cos(t) + d * math.cos((R - r) / r * t),
                             lambda t: cy + (R - r) * math.sin(t) - d * math.sin((R - r) / r * t),
                             0, T, samples)


def polygon_area(points):
    a = 0.0
    for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def point_in_polygon(p, poly):
    x, y = p
    inside = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-12) + x1:
            inside = not inside
    return inside


def bbox(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


# ---------------------------------------------------------------------------
# Noise & randomness
# ---------------------------------------------------------------------------
def rng(seed=0):
    """Seeded random.Random — always seed generative art so it is reproducible & tweakable."""
    return random.Random(seed)


class Noise:
    """2D Perlin gradient noise. n(x, y) in about [-1, 1]; n.fbm(...) for layered detail.
    Typical spatial scale: n(x * 0.004, y * 0.004) on a 1000-unit canvas."""

    def __init__(self, seed=0):
        p = list(range(256))
        random.Random(seed).shuffle(p)
        self.p = p + p

    @staticmethod
    def _fade(t):
        return t * t * t * (t * (t * 6 - 15) + 10)

    @staticmethod
    def _grad(h, x, y):
        h &= 7
        u, v = (x, y) if h < 4 else (y, x)
        return (u if h & 1 == 0 else -u) + (2 * v if h & 2 == 0 else -2 * v) * 0.5

    def __call__(self, x, y):
        X, Y = math.floor(x) & 255, math.floor(y) & 255
        x -= math.floor(x)
        y -= math.floor(y)
        u, v = self._fade(x), self._fade(y)
        p = self.p
        a, b = p[X] + Y, p[X + 1] + Y
        n00, n10 = self._grad(p[a], x, y), self._grad(p[b], x - 1, y)
        n01, n11 = self._grad(p[a + 1], x, y - 1), self._grad(p[b + 1], x - 1, y - 1)
        nx0 = n00 + u * (n10 - n00)
        nx1 = n01 + u * (n11 - n01)
        return max(-1.0, min(1.0, (nx0 + v * (nx1 - nx0)) * 1.4))

    def fbm(self, x, y, octaves=4, lacunarity=2.0, gain=0.5):
        amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
        for _ in range(octaves):
            total += amp * self(x * freq, y * freq)
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm


# ---------------------------------------------------------------------------
# Sampling & layout
# ---------------------------------------------------------------------------
def poisson_disk(width, height, r, seed=0, k=30, x0=0, y0=0, inside=None):
    """Bridson Poisson-disk sampling: evenly spread but natural-looking points (min distance r).
    inside: optional predicate (x, y) -> bool to restrict to a shape."""
    R = random.Random(seed)
    cell = r / math.sqrt(2)
    gw, gh = int(width / cell) + 1, int(height / cell) + 1
    grid = [[None] * gh for _ in range(gw)]
    samples, active = [], []

    def ok(p):
        if not (0 <= p[0] < width and 0 <= p[1] < height):
            return False
        if inside and not inside(p[0] + x0, p[1] + y0):
            return False
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        for i in range(max(0, gx - 2), min(gw, gx + 3)):
            for j in range(max(0, gy - 2), min(gh, gy + 3)):
                q = grid[i][j]
                if q and (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < r * r:
                    return False
        return True

    for _ in range(200):
        first = (R.uniform(0, width), R.uniform(0, height))
        if ok(first):
            break
    else:
        return []
    samples.append(first)
    active.append(first)
    grid[int(first[0] / cell)][int(first[1] / cell)] = first
    while active:
        idx = R.randrange(len(active))
        base = active[idx]
        for _ in range(k):
            a = R.uniform(0, 2 * math.pi)
            d = R.uniform(r, 2 * r)
            p = (base[0] + d * math.cos(a), base[1] + d * math.sin(a))
            if ok(p):
                samples.append(p)
                active.append(p)
                grid[int(p[0] / cell)][int(p[1] / cell)] = p
                break
        else:
            active.pop(idx)
    return [(x + x0, y + y0) for x, y in samples]


def circle_pack(width, height, r_min=4, r_max=80, padding=2, max_circles=800, attempts=20000,
                seed=0, x0=0, y0=0, inside=None, boundary=True):
    """Greedy random circle packing -> list of (x, y, r), naturally large-to-small.
    inside: predicate (x, y) -> bool in canvas coords (e.g. lambda x, y: point_in_polygon((x, y), poly))
    to pack inside any shape — circles are shrunk until their rim fits."""
    R = random.Random(seed)
    cell = 2 * r_max + padding
    grid = {}
    out = []
    for _ in range(attempts):
        if len(out) >= max_circles:
            break
        x, y = R.uniform(0, width), R.uniform(0, height)
        if inside and not inside(x + x0, y + y0):
            continue
        r = r_max
        if boundary:
            r = min(r, x - padding, y - padding, width - x - padding, height - y - padding)
        if r < r_min:
            continue
        gx, gy = int(x / cell), int(y / cell)
        for i in range(gx - 1, gx + 2):
            for j in range(gy - 1, gy + 2):
                for (ox, oy, orr) in grid.get((i, j), ()):
                    r = min(r, math.hypot(ox - x, oy - y) - orr - padding)
                    if r < r_min:
                        break
        if r < r_min:
            continue
        if inside:  # shrink until the whole rim (not just the centre) lies inside the shape
            while r >= r_min and not all(inside(x + x0 + r * math.cos(a), y + y0 + r * math.sin(a))
                                         for a in (k * math.pi / 6 for k in range(12))):
                r *= 0.9
            if r < r_min:
                continue
        c = (x, y, r)
        out.append(c)
        grid.setdefault((gx, gy), []).append(c)
    return [(x + x0, y + y0, r) for x, y, r in out]


def voronoi_polygons(points, width, height, x0=0, y0=0):
    """Voronoi cells clipped to the rectangle (mirror trick => every cell finite).
    Returns list of polygons aligned with `points`. Needs numpy + scipy."""
    import numpy as np
    from scipy.spatial import Voronoi
    P = np.asarray(points, dtype=float) - [x0, y0]
    mirrored = [P,
                np.column_stack([-P[:, 0], P[:, 1]]),
                np.column_stack([2 * width - P[:, 0], P[:, 1]]),
                np.column_stack([P[:, 0], -P[:, 1]]),
                np.column_stack([P[:, 0], 2 * height - P[:, 1]])]
    vor = Voronoi(np.vstack(mirrored))
    polys = []
    for i in range(len(P)):
        region = vor.regions[vor.point_region[i]]
        verts = [tuple(vor.vertices[v]) for v in region if v != -1]
        verts = [(min(max(x, 0), width) + x0, min(max(y, 0), height) + y0) for x, y in verts]
        polys.append(verts)
    return polys


def delaunay_triangles(points):
    """Delaunay triangulation -> list of 3-point tuples (low-poly art). Needs scipy."""
    import numpy as np
    from scipy.spatial import Delaunay
    P = np.asarray(points, dtype=float)
    tri = Delaunay(P)
    return [tuple(tuple(P[i]) for i in s) for s in tri.simplices]


def flow_lines(width, height, angle_fn, spacing=12, step=2.0, max_steps=400, min_len=10,
               seed=0, x0=0, y0=0, seeds=None):
    """Evenly-spaced streamlines through a vector field (Jobard-Lefer style).
    angle_fn(x, y) -> radians. Returns polylines (lists of points).
    Tip: angle_fn = lambda x, y: noise.fbm(x*.003, y*.003) * math.pi * 2"""
    R = random.Random(seed)
    sep, test = spacing, spacing * 0.6
    cell = test
    grid = {}

    def free(p, d, own):
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        rng_c = int(d / cell) + 1
        for i in range(gx - rng_c, gx + rng_c + 1):
            for j in range(gy - rng_c, gy + rng_c + 1):
                for (qx, qy, lid) in grid.get((i, j), ()):
                    if lid != own and (qx - p[0]) ** 2 + (qy - p[1]) ** 2 < d * d:
                        return False
        return True

    def trace(start, direction, lid):
        pts_, p = [], start
        for _ in range(max_steps):
            a = angle_fn(p[0] + x0, p[1] + y0)
            q = (p[0] + direction * step * math.cos(a), p[1] + direction * step * math.sin(a))
            if not (0 <= q[0] < width and 0 <= q[1] < height) or not free(q, test, lid):
                break
            pts_.append(q)
            p = q
        return pts_

    if seeds is None:
        seeds = [(R.uniform(0, width), R.uniform(0, height))
                 for _ in range(int(width * height / (sep * sep) * 2))]
    else:
        seeds = [(sx - x0, sy - y0) for sx, sy in seeds]
    lines = []
    for lid, s in enumerate(seeds):
        if not (0 <= s[0] < width and 0 <= s[1] < height) or not free(s, sep, -1):
            continue
        fwd, back = trace(s, 1, lid), trace(s, -1, lid)
        pl = back[::-1] + [s] + fwd
        length = sum(dist(a, b) for a, b in zip(pl, pl[1:]))
        if length < min_len:
            continue
        for (x, y) in pl:
            grid.setdefault((int(x / cell), int(y / cell)), []).append((x, y, lid))
        lines.append([(x + x0, y + y0) for x, y in pl])
    return lines


_MS_CASES = {1: [("L", "B")], 2: [("B", "R")], 3: [("L", "R")], 4: [("T", "R")],
             6: [("T", "B")], 7: [("L", "T")], 8: [("L", "T")], 9: [("T", "B")],
             11: [("T", "R")], 12: [("L", "R")], 13: [("B", "R")], 14: [("L", "B")]}


def contour_lines(field, width, height, levels, res=4, x0=0, y0=0):
    """Marching squares iso-lines of field(x, y) -> {level: [polyline, ...]}.
    Joined into continuous polylines (closed loops repeat their first point).
    Great for topographic maps, wavy line art, op-art."""
    nx, ny = int(width / res) + 1, int(height / res) + 1
    V = [[field(x0 + i * res, y0 + j * res) for i in range(nx)] for j in range(ny)]
    result = {}
    for lv in levels:
        pos, segs = {}, []

        def edge_pt(key):
            if key in pos:
                return pos[key]
            kind, i, j = key
            if kind == "h":
                va, vb = V[j][i], V[j][i + 1]
                t = (lv - va) / ((vb - va) or 1e-12)
                p = (x0 + (i + t) * res, y0 + j * res)
            else:
                va, vb = V[j][i], V[j + 1][i]
                t = (lv - va) / ((vb - va) or 1e-12)
                p = (x0 + i * res, y0 + (j + t) * res)
            pos[key] = p
            return p

        for j in range(ny - 1):
            for i in range(nx - 1):
                a, b, c, d = V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]
                idx = (a > lv) << 3 | (b > lv) << 2 | (c > lv) << 1 | (d > lv)
                if idx in (0, 15):
                    continue
                E = {"T": ("h", i, j), "B": ("h", i, j + 1), "L": ("v", i, j), "R": ("v", i + 1, j)}
                if idx in (5, 10):
                    center = (a + b + c + d) / 4 > lv
                    if (idx == 5) == center:
                        pairs = [("L", "T"), ("R", "B")]
                    else:
                        pairs = [("T", "R"), ("L", "B")]
                else:
                    pairs = _MS_CASES[idx]
                for e1, e2 in pairs:
                    segs.append((E[e1], E[e2]))
        adj = {}
        for s_i, (k1, k2) in enumerate(segs):
            adj.setdefault(k1, []).append(s_i)
            adj.setdefault(k2, []).append(s_i)
        used = [False] * len(segs)
        lines = []
        # start from open ends first so open lines come out whole
        starts = [k for k, v in adj.items() if len(v) == 1] + list(adj.keys())
        for sk in starts:
            for s_i in adj[sk]:
                if used[s_i]:
                    continue
                chain, cur = [sk], sk
                while True:
                    nxt = None
                    for cand in adj[cur]:
                        if not used[cand]:
                            nxt = cand
                            break
                    if nxt is None:
                        break
                    used[nxt] = True
                    k1, k2 = segs[nxt]
                    cur = k2 if k1 == cur else k1
                    chain.append(cur)
                    if cur == sk:
                        break
                if len(chain) > 1:
                    lines.append([edge_pt(k) for k in chain])
        result[lv] = lines
    return result


# ---------------------------------------------------------------------------
# Color — OKLab / OKLCH (perceptually uniform: even lightness ramps, honest hue shifts)
# ---------------------------------------------------------------------------
def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c * 255))):02x}" for c in rgb)


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def to_oklab(hexcolor):
    r, g_, b = (_lin(c) for c in hex_to_rgb(hexcolor))
    l = 0.4122214708 * r + 0.5363325363 * g_ + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g_ + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g_ + 0.6299787005 * b
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def _oklab_to_linear(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def from_oklab(L, a, b):
    return rgb_to_hex(tuple(_gam(max(0.0, min(1.0, c))) for c in _oklab_to_linear(L, a, b)))


def to_oklch(hexcolor):
    L, a, b = to_oklab(hexcolor)
    return (L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360)


def oklch(L, C, h):
    """OKLCH -> hex, gamut-mapped by reducing chroma (keeps hue & lightness honest).
    L 0..1, C ~0..0.37, h degrees. e.g. oklch(0.7, 0.15, 250) = clear sky blue."""
    def in_gamut(c):
        rgb = _oklab_to_linear(L, c * math.cos(math.radians(h)), c * math.sin(math.radians(h)))
        return all(-1e-4 <= v <= 1 + 1e-4 for v in rgb)
    if not in_gamut(C):
        lo, hi = 0.0, C
        for _ in range(24):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if in_gamut(mid) else (lo, mid)
        C = lo
    return from_oklab(L, C * math.cos(math.radians(h)), C * math.sin(math.radians(h)))


def mix(c1, c2, t=0.5, space="oklab"):
    """Perceptual mix.
    space='oklab' : straight line in OKLab — even lightness steps; best for analogous colors,
                    tints/shades, value ramps. Complements (blue->orange) still pass through grey.
    space='oklch' : travels the shorter way round the hue wheel keeping chroma — vivid
                    blue->magenta->orange sunsets, rainbow-ish transitions, no grey dead zone."""
    if space == "oklch":
        L1, C1, h1 = to_oklch(c1)
        L2, C2, h2 = to_oklch(c2)
        if C1 < 0.02:           # achromatic endpoint: borrow the other hue
            h1 = h2
        if C2 < 0.02:
            h2 = h1
        dh = (h2 - h1 + 180) % 360 - 180
        return oklch(L1 + (L2 - L1) * t, C1 + (C2 - C1) * t, h1 + dh * t)
    a, b = to_oklab(c1), to_oklab(c2)
    return from_oklab(*(x + (y - x) * t for x, y in zip(a, b)))


def ramp(colors, n, space="oklab"):
    """n colors evenly spaced along a multi-stop path (space: 'oklab' | 'oklch', see mix)."""
    if n == 1:
        return [colors[0]]
    out = []
    segs = len(colors) - 1
    for i in range(n):
        t = i / (n - 1) * segs
        k = min(int(t), segs - 1)
        out.append(mix(colors[k], colors[k + 1], t - k, space))
    return out


def _adjust(c, dL=0.0, cmul=1.0, dh=0.0):
    L, C, h = to_oklch(c)
    return oklch(max(0, min(1, L + dL)), C * cmul, h + dh)


def lighten(c, amount=0.1):
    return _adjust(c, dL=amount)


def darken(c, amount=0.1):
    return _adjust(c, dL=-amount)


def saturate(c, factor=1.2):
    return _adjust(c, cmul=factor)


def hue_shift(c, degrees):
    return _adjust(c, dh=degrees)


def _toward(h, target, amt):
    """Rotate hue h toward target along the shorter arc by fraction amt (0..1)."""
    d = (target - h + 180) % 360 - 180
    return (h + d * amt) % 360


def tone_ramp(base, steps=5, spread=0.36, shadow_hue=285, light_hue=95, hue_pull=0.3):
    """Painterly value ramp for flat shading: darker steps lose a little chroma and rotate toward
    a cool shadow hue (violet-blue), lighter steps toward a warm light hue (yellow). Returns dark->light.
    For a cool light source (moonlight, overcast) swap: shadow_hue=40, light_hue=220."""
    L, C, h = to_oklch(base)
    out = []
    for i in range(steps):
        d = (i / (steps - 1) - 0.5) * spread if steps > 1 else 0.0
        frac = abs(d) / (spread / 2) if spread else 0
        hh = _toward(h, shadow_hue if d < 0 else light_hue, hue_pull * frac)
        out.append(oklch(max(0.05, min(0.98, L + d)), C * (1 - 0.35 * frac), hh))
    return out


def harmony(base, scheme="analogous", spread=30):
    """Palette in OKLCH: analogous | complementary | split | triadic | tetradic | shades."""
    L, C, h = to_oklch(base)
    offs = {"analogous": [-spread, 0, spread], "complementary": [0, 180],
            "split": [0, 180 - spread, 180 + spread], "triadic": [0, 120, 240],
            "tetradic": [0, 90, 180, 270]}.get(scheme)
    if scheme == "shades":
        return [oklch(l, C, h) for l in (0.25, 0.4, 0.55, 0.7, 0.85)]
    return [oklch(L, C, h + o) for o in offs]


def relative_luminance(c):
    r, g_, b = (_lin(v) for v in hex_to_rgb(c))
    return 0.2126 * r + 0.7152 * g_ + 0.0722 * b


def contrast_ratio(c1, c2):
    a, b = sorted((relative_luminance(c1), relative_luminance(c2)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def multiply(c1, c2):
    """Overprint color of two inks (what mix-blend-mode:multiply would show). Precompute overlap
    colors with this for risograph/screenprint looks that render identically everywhere."""
    return rgb_to_hex(tuple(a * b for a, b in zip(hex_to_rgb(c1), hex_to_rgb(c2))))


def screen(c1, c2):
    """Additive-ish light overlap (mix-blend-mode:screen), for glows and light leaks."""
    return rgb_to_hex(tuple(1 - (1 - a) * (1 - b) for a, b in zip(hex_to_rgb(c1), hex_to_rgb(c2))))


# ---------------------------------------------------------------------------
# Gradients
# ---------------------------------------------------------------------------
def _stops(stops):
    """Accepts ['#a', '#b'] (even spacing) or [(offset, color), (offset, color, opacity)]."""
    out = []
    n = len(stops)
    for i, s in enumerate(stops):
        if isinstance(s, str):
            off, col, op = (i / (n - 1) if n > 1 else 0), s, None
        else:
            off, col = s[0], s[1]
            op = s[2] if len(s) > 2 else None
        out.append(el("stop", offset=fmt(off, 4), stop_color=col,
                      stop_opacity=None if op is None or op == 1 else fmt(op, 3)))
    return out


def smooth_stops(colors, per_segment=4, opacities=None, space="oklch"):
    """Expand key colors into many interpolated stops. Renderers interpolate gradients in sRGB,
    which dulls and darkens the middle (blue->orange turns grey-purple). Pre-computing stops in
    OKLCH keeps the transition vivid; use space='oklab' for calm, even value ramps."""
    n = (len(colors) - 1) * per_segment + 1
    cols = ramp(colors, n, space)
    out = []
    for i, c in enumerate(cols):
        t = i / (n - 1)
        out.append((t, c, ramp_scalar(opacities, t)) if opacities else (t, c))
    return out


def ramp_scalar(values, t):
    segs = len(values) - 1
    x = t * segs
    k = min(int(x), segs - 1)
    return values[k] + (values[k + 1] - values[k]) * (x - k)


def linear_gradient(id, stops, x1=0, y1=0, x2=1, y2=0, units="objectBoundingBox", **a):
    """Default is objectBoundingBox (0..1 of each shape). Pass units='userSpaceOnUse' and
    absolute coords when one gradient must span several shapes consistently (skies, light)."""
    return el("linearGradient", *_stops(stops), id=id, x1=x1, y1=y1, x2=x2, y2=y2,
              gradientUnits=units if units != "objectBoundingBox" else None, **a)


def radial_gradient(id, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None,
                    units="objectBoundingBox", **a):
    """fx/fy move the focal point -> off-center highlight for spheres & glossy forms.
    Caution: in objectBoundingBox units a wide shape gets an elliptical gradient."""
    return el("radialGradient", *_stops(stops), id=id, cx=cx, cy=cy, r=r, fx=fx, fy=fy,
              gradientUnits=units if units != "objectBoundingBox" else None, **a)


# ---------------------------------------------------------------------------
# Filters — portable recipes (tested in Chromium, resvg and librsvg)
# All set color-interpolation-filters="sRGB" so colors match what you specify.
# ---------------------------------------------------------------------------
def filter_region(pad=None, region=None):
    """Attributes for the filter effect region.
    pad: fraction of bbox added on each side (default region is only 10% -> glows get clipped).
    region: (x, y, w, h) in user space (best for canvas-wide effects)."""
    if region:
        x, y, w, h = region
        return dict(filterUnits="userSpaceOnUse", x=x, y=y, width=w, height=h)
    p = 0.25 if pad is None else pad
    return dict(x=f"{-p * 100:g}%", y=f"{-p * 100:g}%", width=f"{100 + 2 * p * 100:g}%",
                height=f"{100 + 2 * p * 100:g}%")


# Force noise alpha to 1 before using it as a displacement map. Without this, engines disagree
# on premultiplied alpha and resvg shifts the whole shape down-right.
OPAQUE = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1"


def _filter(id, *prims, pad=None, region=None):
    return el("filter", *prims, id=id, color_interpolation_filters="sRGB",
              **filter_region(pad, region))


def grain_filter(id="grain", strength=0.3, freq=0.75, octaves=3, seed=4, region=None):
    """Film/print grain made of equal light + dark specks, so average color is preserved and no
    blend mode is needed (consistent in Chromium, resvg, librsvg). Apply with Canvas.texture():
        c.defs(grain_filter("grain", strength=0.25)); ...art...; c.texture("grain")
    (= an invisible full-canvas rect carrying the filter, so filter-less renderers show nothing
    instead of an opaque sheet over the artwork)
    strength: 0.12 whisper, 0.25 film, 0.4 risograph, 0.7 gritty.  freq: 0.5 coarse .. 1.2 fine."""
    a = 2 * strength
    dark = f"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  {-a:g} 0 0 0 {strength:g}"
    light = f"0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  {a:g} 0 0 0 {-strength:g}"
    return el("filter",
              el("feTurbulence", type="fractalNoise", baseFrequency=freq, numOctaves=octaves,
                 seed=seed, stitchTiles="stitch", result="noise"),
              el("feColorMatrix", in_="noise", type="matrix", values=dark, result="dark"),
              el("feColorMatrix", in_="noise", type="matrix", values=light, result="light"),
              el("feMerge", el("feMergeNode", in_="dark"), el("feMergeNode", in_="light")),
              id=id, color_interpolation_filters="sRGB",
              **(filter_region(region=region) if region else dict(x="0", y="0", width="100%", height="100%")))


def shadow_filter(id="shadow", dx=0, dy=8, blur=10, color="#000", opacity=0.35, pad=0.3):
    """Drop shadow via the classic primitive chain (feDropShadow is not supported by
    Illustrator / older tools). Tint the shadow with a dark hue of the scene, not pure black."""
    return _filter(id,
                   el("feGaussianBlur", in_="SourceAlpha", stdDeviation=blur),
                   el("feOffset", dx=dx, dy=dy, result="b"),
                   el("feFlood", flood_color=color, flood_opacity=opacity),
                   el("feComposite", in2="b", operator="in"),
                   el("feMerge", el("feMergeNode"), el("feMergeNode", in_="SourceGraphic")),
                   pad=pad)


def glow_filter(id="glow", blur=8, strength=2, pad=0.6):
    """Luminous glow in the element's own colors (neon, stars, lamps). strength = stacked blurs."""
    nodes = [el("feMergeNode", in_="blur") for _ in range(strength)] + [el("feMergeNode", in_="SourceGraphic")]
    return _filter(id, el("feGaussianBlur", in_="SourceGraphic", stdDeviation=blur, result="blur"),
                   el("feMerge", *nodes), pad=pad)


def rough_filter(id="rough", scale=4, freq=0.03, octaves=3, seed=2, pad=0.1):
    """Displaces edges -> hand-cut paper / ink / hand-drawn wobble. scale 2-8 subtle..wild."""
    return _filter(id,
                   el("feTurbulence", type="fractalNoise", baseFrequency=freq, numOctaves=octaves,
                      seed=seed, result="n0"),
                   el("feColorMatrix", in_="n0", type="matrix", values=OPAQUE, result="n"),
                   el("feDisplacementMap", in_="SourceGraphic", in2="n", scale=scale,
                      xChannelSelector="R", yChannelSelector="G"),
                   pad=pad)


def watercolor_filter(id="watercolor", scale=18, blur=1.2, seed=7, pad=0.2):
    """Bleeding wet edges + pigment granulation. Apply to flat shapes with fill-opacity ~0.75,
    and overlap several washes."""
    return _filter(id,
                   el("feTurbulence", type="fractalNoise", baseFrequency=0.025, numOctaves=4,
                      seed=seed, result="w0"),
                   el("feColorMatrix", in_="w0", type="matrix", values=OPAQUE, result="warp"),
                   el("feDisplacementMap", in_="SourceGraphic", in2="warp", scale=scale,
                      xChannelSelector="R", yChannelSelector="G", result="bled"),
                   el("feGaussianBlur", in_="bled", stdDeviation=blur, result="soft"),
                   el("feTurbulence", type="fractalNoise", baseFrequency=0.6, numOctaves=2,
                      seed=seed + 1, result="grain"),
                   el("feColorMatrix", in_="grain", type="matrix",
                      values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.8 1.2", result="mask"),
                   el("feComposite", in_="soft", in2="mask", operator="in"),
                   pad=pad)


def paper_filter(id="paper", color="#f2e8d5", relief=1.6, freq=0.04, seed=11, region=None):
    """Textured paper/canvas BACKGROUND (fibre relief via diffuse lighting, tinted to `color`).
    Use on the background rect with the same fill, so filter-less renderers still show flat paper:
        c = Canvas(..., bg=None); c.defs(paper_filter("paper", "#efe4cf"))
        c.add(c.full_rect(fill="#efe4cf", filter="url(#paper)"))
    relief: 0.8 smooth stock .. 3 rough watercolor paper. freq: 0.02 cloudy .. 0.1 fine tooth."""
    fn = [el(t, type="linear", slope=1.16) for t in ("feFuncR", "feFuncG", "feFuncB")]
    return el("filter",
              el("feTurbulence", type="fractalNoise", baseFrequency=freq, numOctaves=5, seed=seed,
                 result="n"),
              el("feDiffuseLighting", el("feDistantLight", azimuth=45, elevation=60), in_="n",
                 lighting_color="#fff", surfaceScale=relief, result="lit"),
              el("feComponentTransfer", *fn, in_="lit", result="shade"),
              el("feFlood", flood_color=color, result="paper"),
              el("feComposite", in_="paper", in2="shade", operator="arithmetic", k1=1, k2=0, k3=0, k4=0),
              id=id, color_interpolation_filters="sRGB",
              **(filter_region(region=region) if region else dict(x="0", y="0", width="100%", height="100%")))


def inner_shadow_filter(id="inner", dx=0, dy=6, blur=6, color="#000", opacity=0.5):
    """Shadow inside the shape (carved / inset / pressed look)."""
    return _filter(id,
                   el("feOffset", in_="SourceAlpha", dx=dx, dy=dy),
                   el("feGaussianBlur", stdDeviation=blur, result="o"),
                   el("feComposite", in_="SourceAlpha", in2="o", operator="arithmetic",
                      k2=-1, k3=1, result="rim"),
                   el("feFlood", flood_color=color, flood_opacity=opacity),
                   el("feComposite", in2="rim", operator="in", result="sh"),
                   el("feMerge", el("feMergeNode", in_="SourceGraphic"), el("feMergeNode", in_="sh")),
                   pad=0.05)


def gooey_filter(id="goo", blur=10, contrast=20, pad=0.3):
    """Metaball merge: shapes in one group fuse where they come close (blur + alpha threshold)."""
    return _filter(id,
                   el("feGaussianBlur", in_="SourceGraphic", stdDeviation=blur, result="b"),
                   el("feColorMatrix", in_="b", type="matrix",
                      values=f"1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 {contrast} {-contrast / 2 + 1:g}"),
                   pad=pad)


def blur_filter(id="blur", std=40, region=None, pad=1.0):
    """Big soft blur for mesh-gradient/aurora blobs and atmospheric haze.
    Prefer region=canvas rect so huge blurs are never clipped."""
    return el("filter", el("feGaussianBlur", stdDeviation=std), id=id,
              color_interpolation_filters="sRGB", **filter_region(pad, region))


# ---------------------------------------------------------------------------
# Text -> outlines (fonts are the #1 portability failure of standalone SVG files)
# ---------------------------------------------------------------------------
def find_font(family="DejaVu Sans", style=None):
    """Font file path via fontconfig (fc-match). style e.g. 'Bold', 'Italic'."""
    if shutil.which("fc-match"):
        q = family + (f":style={style}" if style else "")
        try:
            out = subprocess.run(["fc-match", "-f", "%{file}", q], capture_output=True,
                                 text=True, timeout=10).stdout.strip()
            if out and os.path.exists(out):
                return out
        except Exception:
            pass
    for d in ("/usr/share/fonts", "/Library/Fonts", "/System/Library/Fonts",
              os.path.expanduser("~/.fonts"), "C:/Windows/Fonts"):
        for root, _, files in os.walk(d):
            for f in files:
                if family.replace(" ", "").lower() in f.replace(" ", "").lower() and f.lower().endswith((".ttf", ".otf")):
                    return os.path.join(root, f)
    raise FileNotFoundError(f"No font found for {family!r}")


def text_to_path(s, font_path, size, x=0, y=0, anchor="start", letter_spacing=0.0, kerning=True):
    """Outline text -> (path_d, width). anchor: start | middle | end. y is the baseline.
    font_path: a file or a fallback list of files. Applies GPOS + legacy pair kerning
    (no ligatures or complex shaping). Warns on stderr about characters with no glyph."""
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    run = _glyph_run(s, font_path, size, letter_spacing, kerning)
    width = sum(a for _, _, a, _ in run) - (letter_spacing if run else 0)
    cursor = x - {"start": 0, "middle": width / 2, "end": width}[anchor]
    parts = []
    for gs, name, adv, k in run:
        pen = SVGPathPen(gs, ntos=lambda v: fmt(v))      # per glyph: composites resolve in their own font
        gs[name].draw(TransformPen(pen, (k, 0, 0, -k, cursor, y)))
        parts.append(pen.getCommands())
        cursor += adv
    return " ".join(p for p in parts if p), width


def _kerning(font):
    """Pair kerning from the legacy 'kern' table AND OpenType GPOS 'kern' (PairPos formats 1 and 2,
    incl. extension lookups). Modern fonts (e.g. Fontsource/Google Fonts) only ship GPOS kerning."""
    pairs, classes = {}, []
    if "kern" in font:
        for t in font["kern"].kernTables:
            if hasattr(t, "kernTable"):
                pairs.update(t.kernTable)
    if "GPOS" in font and font["GPOS"].table.FeatureList and font["GPOS"].table.LookupList:
        g = font["GPOS"].table
        idx = sorted({i for fr in g.FeatureList.FeatureRecord if fr.FeatureTag == "kern"
                      for i in fr.Feature.LookupListIndex})
        for i in idx:
            lk = g.LookupList.Lookup[i]
            for st in lk.SubTable:
                if lk.LookupType == 9:
                    if st.ExtensionLookupType != 2:
                        continue
                    st = st.ExtSubTable
                elif lk.LookupType != 2:
                    continue
                if st.Format == 1:
                    for g1, ps in zip(st.Coverage.glyphs, st.PairSet):
                        for r in ps.PairValueRecord:
                            v = getattr(r.Value1, "XAdvance", 0) if r.Value1 is not None else 0
                            if v:
                                pairs.setdefault((g1, r.SecondGlyph), v)
                elif st.Format == 2:
                    classes.append((set(st.Coverage.glyphs), st.ClassDef1.classDefs,
                                    st.ClassDef2.classDefs, st.Class1Record))
    def kern(a, b):
        if (a, b) in pairs:
            return pairs[(a, b)]
        for cov, cd1, cd2, recs in classes:
            if a in cov:
                r = recs[cd1.get(a, 0)].Class2Record[cd2.get(b, 0)]
                return getattr(r.Value1, "XAdvance", 0) if r.Value1 is not None else 0
        return 0
    return kern


_FONTS = {}


def _load(font_path):
    if font_path not in _FONTS:
        from fontTools.ttLib import TTFont
        f = TTFont(font_path)
        _FONTS[font_path] = (f, f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm, _kerning(f))
    return _FONTS[font_path]


def _glyph_run(s, font_path, size, letter_spacing, kerning):
    """font_path: one file or a fallback list (e.g. latin + latin-ext subset files of one family).
    Each character uses the first font that has it; pair kerning applies within the same font.
    Returns [(glyphset, glyph_name, advance, scale)]. Warns about characters no font covers."""
    paths = [font_path] if isinstance(font_path, (str, os.PathLike)) else list(font_path)
    fonts = [_load(str(p)) for p in paths]
    run, missing = [], []
    for ch in s:
        for f, gs, cmap, upm, kern in fonts:
            if ord(ch) in cmap:
                run.append([f, gs, cmap[ord(ch)], size / upm, kern])
                break
        else:
            f, gs, cmap, upm, kern = fonts[0]
            run.append([f, gs, ".notdef", size / upm, kern])
            if not ch.isspace():
                missing.append(ch)
    if missing:
        import sys
        print(f"svgkit: no glyph for {''.join(sorted(set(missing)))!r} in {[os.path.basename(str(p)) for p in paths]} "
              f"-> drawn as .notdef boxes. Add a subset/fallback font (get_fonts(..., subsets=...)).", file=sys.stderr)
    out = []
    for i, (f, gs, name, k, kern) in enumerate(run):
        a = f["hmtx"][name][0] * k + letter_spacing
        if kerning and i + 1 < len(run) and run[i + 1][0] is f:
            a += kern(name, run[i + 1][2]) * k
        out.append((gs, name, a, k))
    return out


def text_on_circle(s, font_path, size, cx, cy, r, center_deg=-90, letter_spacing=0.0,
                   inward=False, kerning=True):
    """Outlined text along a circle -> path d. Portable replacement for <textPath>
    (librsvg — GNOME, Wikipedia, sharp/ImageMagick pipelines — does not render textPath at all).
    center_deg: where the middle of the text sits (-90 top, 90 bottom; 0 = 3 o'clock).
    inward=False: reads clockwise, glyph tops point outward (top arc of a badge).
    inward=True : reads left->right along the bottom, glyph tops point to the centre.
    r is the baseline radius."""
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    run = _glyph_run(s, font_path, size, letter_spacing, kerning)
    total = sum(a for _, _, a, _ in run) - (letter_spacing if run else 0)
    direction = -1 if inward else 1
    parts = []
    pos = -total / 2
    for gs, n, a, k in run:
        glyph_w = a - letter_spacing
        th = math.radians(center_deg) + direction * (pos + glyph_w / 2) / r
        bx, by = cx + r * math.cos(th), cy + r * math.sin(th)
        if inward:
            tx, ty, nx, ny = math.sin(th), -math.cos(th), -math.cos(th), -math.sin(th)
        else:
            tx, ty, nx, ny = -math.sin(th), math.cos(th), math.cos(th), math.sin(th)
        e = bx - glyph_w / 2 * tx
        f = by - glyph_w / 2 * ty
        pen = SVGPathPen(gs, ntos=lambda v: fmt(v))
        gs[n].draw(TransformPen(pen, (k * tx, k * ty, k * nx, k * ny, e, f)))
        parts.append(pen.getCommands())
        pos += a
    return " ".join(p for p in parts if p)


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------
def preview(svg_path, png_path=None, size=1200, backend="auto"):
    """Render to PNG for visual review (uses render.py next to this file)."""
    here = os.path.dirname(os.path.abspath(__file__))
    import sys
    if here not in sys.path:
        sys.path.insert(0, here)
    import render as _render
    png_path = png_path or os.path.splitext(svg_path)[0] + ".png"
    return _render.render(svg_path, png_path, size=size, backend=backend)

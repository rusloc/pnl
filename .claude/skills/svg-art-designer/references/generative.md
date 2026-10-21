# Generative SVG Art with svgkit

Use a generator script whenever the piece has more than ~50 elements, organic variation, or repetition with variation. Code computes clean geometry, seeds make results reproducible, and tweaking a parameter beats hand-editing 400 paths.

## Contents
1. Script template & workflow
2. svgkit API at a glance
3. Recipes (each runs as-is after `from svgkit import *` with a 1000×1000 canvas `c`)
   Layered ridges · Topographic map · Flow field · Circle packing in a shape · Stained glass (Voronoi) · Low poly · Truchet tiles · Halftone · Mandala · Starfield · Recursive subdivision (Bauhaus/Mondrian) · Marble veins · Hand-drawn sketch lines · Synthwave grid & striped sun · Isometric blocks
4. Size & performance tips

---

## 1. Script template & workflow

```python
#!/usr/bin/env python3
"""Harbour at Dusk — generator. Re-run after every tweak; change SEED for variations."""
import sys, math
sys.path.insert(0, "/path/to/svg-art-designer/scripts")   # the skill's scripts/ directory
from svgkit import *

SEED = 7
R, N = rng(SEED), Noise(SEED)
c = Canvas(1600, 1000, bg="#1b1f3b", title="Harbour at Dusk", desc="Generative vector illustration")
c.defs(linear_gradient("sky-grad", smooth_stops(["#1b1f3b", "#5b2a6e", "#f79d5c"]), x2=0, y2=1),
       grain_filter("grain", strength=0.2))          # defs get suffixed ids (…-grad), layers plain names
c.layer("sky", c.full_rect(fill="url(#sky-grad)"))
# … layers back to front: far → mid → near → foreground details → light effects
c.texture("grain")                                     # always last
c.save("out/harbour.svg", preview=True)                # writes .svg + .png preview
```
Iterate: run → view the PNG → change parameters or seed → run again. Keep the generator script next to the SVG so the user can regenerate variations.

## 2. svgkit API at a glance

| Area | Functions |
|---|---|
| Document | `Canvas(w, h, viewbox=None, bg, title, desc, units="", precision=None)`, `.defs()`, `.layer(name, *items, **attrs)`, `.add()`, `.texture(filter_id)`, `.full_rect()`, `.cx .cy .w .h`, `.uid(prefix)`, `.save(path, preview=True)` |
| Elements | `el(tag, *children, **attrs)` (underscores → hyphens, `in_`/`class_`), `g rect circle ellipse line path polygon polyline text use`, `translate rotate scale` |
| Paths | `poly_d smooth_d(points, closed, k) circle_d arc_d ring_sector_d rounded_poly_d ribbon_d(points, width, taper, profile) dot_paths(dots)` |
| Shapes (points) | `regular_polygon star_points blob_points superellipse_points spiral_points wave_points parametric_points hypotrochoid_points` |
| Geometry | `polar(cx, cy, r, deg) lerp dist bbox polygon_area point_in_polygon` |
| Random/noise | `rng(seed)`, `Noise(seed)(x, y)` ∈ [-1, 1], `.fbm(x, y, octaves)` |
| Layout | `poisson_disk circle_pack(inside=…) voronoi_polygons delaunay_triangles flow_lines contour_lines` |
| Color | `oklch to_oklch mix(a, b, t, space) ramp(colors, n, space) tone_ramp lighten darken saturate hue_shift harmony multiply screen contrast_ratio` |
| Gradients | `linear_gradient radial_gradient smooth_stops` |
| Filters | `grain_filter shadow_filter glow_filter rough_filter watercolor_filter paper_filter inner_shadow_filter gooey_filter blur_filter filter_region` |
| Text | `find_font(family, style)`, `text_to_path(s, font_or_fallback_list, size, x, y, anchor, letter_spacing)` → `(d, width)`, `text_on_circle(...)` → `d` (GPOS kerning, missing-glyph warnings) |

Angles are degrees, 0 = 3 o'clock, positive = clockwise. Noise input scale: `N(x * 0.004, y * 0.004)` gives a few features across a 1000-unit canvas.

## 3. Recipes

### Layered ridges (mountain parallax)
```python
# recipe: ridges
N = Noise(7)
c.defs(linear_gradient("sky-grad", smooth_stops(["#1b1f3b", "#5b2a6e", "#d1495b", "#f79d5c", "#ffd166"]), x2=0, y2=1),
       radial_gradient("sunglow", [(0, "#ffe8a3", .6), (1, "#ffe8a3", 0)]))
c.layer("sky", c.full_rect(fill="url(#sky-grad)"))
c.layer("sun", circle(640, 540, 260, fill="url(#sunglow)"), circle(640, 540, 85, fill="#fff1c1"))
n = 6
cols = ramp(["#e98a7a", "#1c1230"], n)                 # far ≈ horizon color → near = darkest
for i in range(n):
    base, amp, freq = 520 + i * 75, 40 + i * 28, 0.003 + i * 0.0012   # nearer: lower, taller, more jagged
    ridge = [(x, base - amp * (N.fbm(x * freq, i * 7.3, 4) + 0.6)) for x in range(-20, 1021, 10)]
    c.layer(f"ridge-{i}", path(smooth_d(ridge) + " L1020,1000 L-20,1000 Z", fill=cols[i]))
```

### Topographic map
```python
# recipe: topo
N = Noise(3)
height = lambda x, y: N.fbm(x * .004, y * .004, 5) * .6 + 1 - math.hypot(x - 500, y - 500) / 520
levels = [i * .08 for i in range(1, 14)]
lines = contour_lines(height, 1000, 1000, levels, res=5)
cols = ramp(["#1d3557", "#457b9d", "#e76f51"], len(levels), "oklch")
for k, lv in enumerate(levels):
    w = 3.2 if k % 5 == 4 else 1.5                         # every 5th = index contour
    for pl in lines[lv]:
        if len(pl) < 4:
            continue
        closed = dist(pl[0], pl[-1]) < 1e-6
        d = smooth_d(pl[:-1] if closed else pl, closed=closed, k=.6)
        c.add(path(d, fill="none", stroke=cols[k], stroke_width=w, stroke_linejoin="round"))
```

### Flow field (with a vortex)
```python
# recipe: flow
N = Noise(11)
def angle(x, y):
    a = N.fbm(x * .0025, y * .0025, 3) * math.pi * 2
    dx, dy = x - 650, y - 400
    r = math.hypot(dx, dy) + 1e-6
    t = math.exp(-r / 160)                                 # vortex influence
    vx, vy = (1 - t) * math.cos(a) - t * dy / r, (1 - t) * math.sin(a) + t * dx / r
    return math.atan2(vy, vx)
cols = ramp(["#0b3c5d", "#328cc1", "#d9b310"], 9, "oklch")
for pl in flow_lines(1000, 1000, angle, spacing=9, step=2.5, seed=4):
    if len(pl) < 6:
        continue
    L = sum(dist(a, b) for a, b in zip(pl, pl[1:]))
    c.add(path(smooth_d(pl[::2]), fill="none", stroke=cols[min(8, int(pl[0][1] / 1000 * 9))],
               stroke_width=.6 + min(L, 400) / 220, stroke_linecap="round"))
```

### Circle packing inside a shape
```python
# recipe: pack
heart = parametric_points(lambda t: 500 + 24 * 16 * math.sin(t) ** 3,
                          lambda t: 440 - 24 * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)),
                          0, 2 * math.pi, 120)
circles = circle_pack(1000, 1000, r_min=3, r_max=70, padding=3, max_circles=1500, attempts=15000, seed=2,
                      inside=lambda x, y: point_in_polygon((x, y), heart))
R = rng(9)
pal = ["#ff4d6d", "#c9184a", "#ff8fa3", "#590d22"]
for x, y, r in circles:
    c.add(circle(x, y, r, fill=R.choice(pal)))
```
`inside` works with any predicate: a letter (sample `text_to_path` outlines into polygons), a blob, or a noise threshold.

### Stained glass (Voronoi)
```python
# recipe: glass
pts_ = poisson_disk(1000, 1000, 38, seed=5)
R = rng(3)
jewels = ["#0b3c5d", "#1f6f8b", "#e6a400", "#c84b31", "#6a2c70", "#2e8b57"]
c.add(c.full_rect(fill="#14110f"))
for (px, py), cell in zip(pts_, voronoi_polygons(pts_, 1000, 1000)):
    if len(cell) < 3:
        continue
    glow = max(0, 1 - math.hypot(px - 500, py - 380) / 600)     # light source behind the glass
    c.add(path(rounded_poly_d(cell, 5), fill=lighten(R.choice(jewels), .28 * glow),
               stroke="#14110f", stroke_width=7, stroke_linejoin="round"))
```

### Low poly (with border points)
```python
# recipe: lowpoly
sp = 45
pts_ = poisson_disk(1000, 1000, sp, seed=8)
edge = [i * sp for i in range(int(1000 / sp) + 1)] + [1000]
pts_ += [(x, 0) for x in edge] + [(x, 1000) for x in edge] + [(0, y) for y in edge] + [(1000, y) for y in edge]
N = Noise(2)
for tri in delaunay_triangles(list(set(pts_))):
    cx_, cy_ = sum(p[0] for p in tri) / 3, sum(p[1] for p in tri) / 3
    col = lighten(mix("#ffb703", "#3a0ca3", cy_ / 1000, "oklch"), .05 * N(cx_ * .01, cy_ * .01))
    c.add(polygon(tri, fill=col, stroke=col, stroke_width=.8, stroke_linejoin="round"))   # stroke hides seams
```

### Truchet tiles
```python
# recipe: truchet
R, s = rng(4), 50
arcs = []
for gy in range(0, 1000, s):
    for gx in range(0, 1000, s):
        h = s / 2
        if R.random() < .5:   # arcs around top-left and bottom-right corners
            arcs.append(f"M{gx + h},{gy} A{h},{h} 0 0,1 {gx},{gy + h} M{gx + s},{gy + h} A{h},{h} 0 0,0 {gx + h},{gy + s}")
        else:                 # arcs around top-right and bottom-left corners
            arcs.append(f"M{gx + h},{gy} A{h},{h} 0 0,0 {gx + s},{gy + h} M{gx},{gy + h} A{h},{h} 0 0,1 {gx + h},{gy + s}")
c.add(c.full_rect(fill="#1d3557"),
      path(" ".join(arcs), fill="none", stroke="#f1faee", stroke_width=s * .22, stroke_linecap="round"))
```
Variants: fill alternate regions, use diagonal lines instead of arcs, or mix tile sizes (quadtree).

### Halftone
```python
# recipe: halftone
spacing, ang = 14, math.radians(15)                    # screen angles: 15 / 45 / 75 per ink
N = Noise(5)
def tone(x, y):                                       # 0 = paper, 1 = solid ink
    sun = max(0, 1 - math.hypot(x - 500, y - 420) / 330)
    return min(1, max(0, .12 + .75 * sun + .15 * N(x * .006, y * .006)))
dots = []
for i in range(-80, 80):
    for j in range(-80, 80):
        x = 500 + i * spacing * math.cos(ang) - j * spacing * math.sin(ang)
        y = 500 + i * spacing * math.sin(ang) + j * spacing * math.cos(ang)
        if -spacing < x < 1000 + spacing and -spacing < y < 1000 + spacing:
            r = spacing * .71 * math.sqrt(tone(x, y))  # dot AREA proportional to tone
            if r > .4:
                dots.append((x, y, r))
c.add(c.full_rect(fill="#f3ead8"), g(*dot_paths(dots, stroke="#ff48b0")))   # ~4x smaller than circles
```
`dot_paths` encodes each dot as a zero-length round-capped subpath, one path per radius bucket. Use it for any large dot field (halftones, stars, stipple, pollen). To clip a halftone to a shape, wrap the group: `g(*dot_paths(...), clip_path="url(#shape)")`.

### Mandala (radial symmetry with `<use>`)
```python
# recipe: mandala
c = Canvas(1000, 1000, viewbox=(-500, -500, 1000, 1000), bg="#14122b")
ink = "#e9c46a"
def petal(r0, r1, w):
    axis = [(0, -(r0 + (r1 - r0) * i / 16)) for i in range(17)]
    return ribbon_d(axis, w, profile=lambda t: math.sin(math.pi * t) ** .7)
c.defs(path(petal(70, 200, 70), id="p1"), path(petal(225, 300, 34), id="p2"), path(petal(325, 440, 46), id="p3"))
for ref, n, off in (("p1", 12, 0), ("p2", 24, 7.5), ("p3", 16, 11.25)):
    c.add(g(*[use(ref, transform=rotate(k * 360 / n + off)) for k in range(n)],
            fill="none", stroke=ink, stroke_width=2, stroke_linejoin="round"))
for r, n, dot in ((212, 48, 3), (312, 64, 2.5), (458, 96, 2)):            # bead rings
    c.add(path(" ".join(circle_d(*polar(0, 0, r, k * 360 / n), dot) for k in range(n)), fill=ink))
c.add(circle(0, 0, 50, fill="none", stroke=ink, stroke_width=2), circle(0, 0, 16, fill=ink))
```
For kaleidoscope symmetry, draw one wedge, then add a mirrored copy (`scale(1 -1)` in the wedge's rotated frame) before repeating.

### Starfield
```python
# recipe: stars
c = Canvas(1000, 1000, bg="#05060f")
c.defs(radial_gradient("milky", [(0, "#3b2f6b", .55), (1, "#3b2f6b", 0)]), glow_filter("starglow", blur=3, strength=2))
c.add(ellipse(500, 420, 620, 150, fill="url(#milky)", transform=rotate(-25, 500, 420)))
R = rng(1)
small = [(x, y, .4 + 1.6 * R.random() ** 4) for x, y in poisson_disk(1000, 1000, 9, seed=2)]  # power-law sizes
c.add(g(*dot_paths(small, quantum=.2, stroke="#e8ecff"), opacity=.85))
c.add(g(*[circle(R.uniform(50, 950), R.uniform(50, 950), R.uniform(2, 3.5),
                 fill=R.choice(["#fff4e0", "#dbe8ff", "#ffffff"])) for _ in range(9)], filter="url(#starglow)"))
```

### Recursive subdivision (Bauhaus / Mondrian)
```python
# recipe: subdivide
R = rng(6)
paper = "#f4efe6"
pal = ["#d62828", "#1d4e89", "#f2c14e", "#111111"] + [paper] * 5     # mostly empty: negative space
def split(x, y, w, h, depth):
    if depth == 0 or (w < 160 and h < 160) or (depth < 3 and R.random() < .25):
        col = R.choice(pal)
        c.add(rect(x, y, w, h, fill=col, stroke="#111111", stroke_width=10))
        if col == paper and min(w, h) > 140 and R.random() < .45:      # geometric motif in empty cells
            c.add(path(ring_sector_d(x + 5, y + h - 5, 0, min(w, h) - 10, 270, 360), fill=R.choice(pal[:3])))
        return
    golden = R.choice([.382, .5, .618])
    if w > h:
        split(x, y, w * golden, h, depth - 1); split(x + w * golden, y, w * (1 - golden), h, depth - 1)
    else:
        split(x, y, w, h * golden, depth - 1); split(x, y + h * golden, w, h * (1 - golden), depth - 1)
split(0, 0, 1000, 1000, 5)
```

### Marble veins (domain-warped contours)
```python
# recipe: marble
N = Noise(21)
a = math.radians(-35)                                       # veins run diagonally
def field(x, y):
    u, v = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
    return N.fbm(u * .0008 + 1.5 * N.fbm(x * .0015, y * .0015, 3), v * .0035, 4)   # warped + stretched
lines = contour_lines(field, 1000, 1000, [-.05, .2], res=5)
c.defs(blur_filter("halo", 9, region=(0, 0, 1000, 1000)))
c.add(c.full_rect(fill="#ece7df"))
halo, crisp = [], []
for lv, w, col in ((-.05, 3.5, "#5f566c"), (.2, 1.4, "#857c92")):
    for pl in lines[lv]:
        if sum(dist(p, q) for p, q in zip(pl, pl[1:])) < 350:     # drop short loops: veins cross the slab
            continue
        halo.append(path(ribbon_d(pl[::2], w * 5, taper=.35), fill="#c4bccd"))
        crisp.append(path(ribbon_d(pl[::2], w, taper=.35), fill=col))
c.add(g(*halo, filter="url(#halo)", opacity=.6), g(*crisp, opacity=.85))
```

### Hand-drawn sketch lines
```python
# recipe: sketch
N = Noise(4)
def resample(p0, p1, step=8):
    n = max(2, int(dist(p0, p1) / step))
    return [lerp(p0, p1, t / n) for t in range(n + 1)]
def wobble(points, amount=3.0, freq=.07, seed=0.0):
    return [(x + amount * N(i * freq, seed + .5), y + amount * N(seed + 3.7, i * freq)) for i, (x, y) in enumerate(points)]
def sketch(poly, seed, closed=True, color="#2b2722"):
    pts_ = poly + [poly[0]] if closed else poly
    for k in range(2):                                          # two passes = pencil feel
        for i, (p0, p1) in enumerate(zip(pts_, pts_[1:])):
            seg = wobble(resample(lerp(p0, p1, -.03), lerp(p0, p1, 1.03)), seed=seed * 9 + i * 2.3 + k * 5.1)  # overshoot corners
            c.add(path(smooth_d(seg), fill="none", stroke=color, stroke_width=2.4 - k, stroke_linecap="round", opacity=.9))
c.add(c.full_rect(fill="#fbf7ef"))
c.add(path(poly_d([(300, 600), (700, 600), (700, 380), (500, 230), (300, 380)]), fill="#f2c14e", opacity=.55,
           transform=translate(8, 6)))                            # loose color fill, off-register
sketch([(300, 600), (700, 600), (700, 380), (500, 230), (300, 380)], 1)
sketch([(450, 600), (450, 470), (550, 470), (550, 600)], 2, closed=False)
```

### Synthwave grid & striped sun
```python
# recipe: synthwave
c = Canvas(1000, 1000, bg="#0d0221")
hz, scx, scy, sr = 600, 500, 480, 210
bars = [rect(scx - sr, scy + 20 + i * 30, 2 * sr, 3 + i * 3.4, fill="#000") for i in range(7)]
c.defs(linear_gradient("sky", smooth_stops(["#0d0221", "#3a0c5e", "#a3007d"]), x2=0, y2=1),
       linear_gradient("sun", smooth_stops(["#ffd319", "#ff2975", "#8c1eff"]), x2=0, y2=1),
       el("mask", rect(scx - sr, scy - sr, 2 * sr, 2 * sr, fill="#fff"), *bars, id="stripes",
          maskUnits="userSpaceOnUse", x=scx - sr, y=scy - sr, width=2 * sr, height=2 * sr),
       glow_filter("neon", blur=4, strength=2))
c.add(rect(0, 0, 1000, hz, fill="url(#sky)"), circle(scx, scy, sr, fill="url(#sun)", mask="url(#stripes)"))
c.add(rect(0, hz, 1000, 400, fill="#12002b"))
grid, y, gap = [], hz, 5.0
while y < 1000:
    grid.append(f"M0,{fmt(y)} H1000")
    y, gap = y + gap, gap * 1.24                              # geometric spacing = perspective
grid += [f"M{scx},{hz} L{fmt(scx + k * 150)},1000" for k in range(-24, 25)]
c.add(path(" ".join(grid), fill="none", stroke="#2de2e6", stroke_width=2, filter="url(#neon)"))
```

### Isometric blocks
```python
# recipe: iso
S = 1.8
def iso(x, y, z, ox=500, oy=560):
    return (ox + (x - y) * .866 * S, oy + (x + y) * .5 * S - z * S)
def iso_box(x, y, z, w, d, h, col):
    dark, _, mid, _, light = tone_ramp(col, 5)
    top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]
    left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]
    right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)]
    return [polygon(top, fill=light), polygon(left, fill=mid), polygon(right, fill=dark)]
c.add(c.full_rect(fill="#e8eef2"))
boxes = [(0, 0, 0, 200, 200, 24, "#8ecae6"), (30, 30, 24, 80, 80, 150, "#ffb703"),
         (130, 40, 24, 50, 60, 80, "#fb8500"), (40, 140, 24, 130, 40, 40, "#219ebc")]
for b in sorted(boxes, key=lambda b: (b[0] + b[1], b[2])):    # paint back to front
    c.add(*iso_box(*b))
```
The sort is correct for non-overlapping footprints. For stacked or interlocking blocks, split them into unit cubes and sort by (x + y, z).

## 4. Size & performance tips

- **One path, many shapes:** join subpaths that share a style (`" ".join(...)`). 10,000 shapes become one element: smaller and much faster to render.
- **Dots:** `dot_paths(dots)` encodes each dot as `M x y h0` with a round cap, about 4× smaller than arc circles and identical in all engines.
- **Thin out points** before smoothing: `smooth_d(pl[::2])`. Catmull-Rom stays smooth with fewer points.
- **Precision:** Canvas sets coordinate decimals from the canvas size (1 decimal for 1000+ units). Don't raise it.
- **Repeated motifs → `<use>`**: define once in defs and place by transform.
- **Filters on groups**, not per element.
- Pure-Python algorithms handle tens of thousands of elements in seconds. If a loop crawls, reduce `attempts`, polygon point counts, or noise octaves before reaching for anything heavier.

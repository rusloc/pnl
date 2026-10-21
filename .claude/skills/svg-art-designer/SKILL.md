---
name: svg-art-designer
description: Professional workflow and toolkit for creating complex standalone SVG artwork as files, such as illustrations, posters, landscapes, generative and abstract art, patterns, mandalas, badges and seals, album and book art, wallpapers and prints. It covers art direction, advanced techniques (paths, gradients, masks, filters, textures), a Python generative toolkit, multi-renderer visual verification and safe optimization. Use this skill whenever the user asks to draw, design, illustrate, generate or make anything as SVG or vector art, even if they only say "make me an SVG of…", "vector illustration", "poster", "generative art" or "pattern". Also use it to critique, fix, restyle or optimize an existing SVG artwork, or to export it to PNG or prepare it for print. Not for UI icon sets or SVG inside web app components, where frontend skills fit better.
compatibility: Python 3 with Pillow and lxml; optional numpy+scipy (Voronoi/Delaunay) and fontTools (text outlining). A renderer is needed for previews, any one of Playwright+Chromium, resvg-js, resvg-py, rsvg-convert or cairosvg. Optional svgo (npm) for best optimization.
---

# SVG Art Designer

You are an art director and a graphics engineer in one. The art director decides what the piece *is* (concept, composition, palette, mood). The engineer makes it precise, portable and lean. Most weak SVG art fails on the first role, not the second: shapes are guessed instead of designed, every element gets equal weight, and colors aren't related to each other. This skill fixes both sides.

Everything here was tested by rendering in Chromium, resvg, librsvg and cairosvg. Items marked ⚠ are traps that silently break artwork in some renderers.

## Toolkit (in `scripts/` next to this file)

| Script | Purpose |
|---|---|
| `svgkit.py` | Python library for building art: Canvas with named layers, smooth curves through points, arcs/sectors, tapered brush strokes (`ribbon_d`), compact dot fields (`dot_paths`), blobs, spirals, noise, Poisson sampling, circle packing, Voronoi, Delaunay, flow fields, contour lines, OKLab/OKLCH color tools, gradient stops without sRGB mud, tested filter recipes, text outlining (`text_to_path`, `text_on_circle`) |
| `render.py` | Render to PNG (`-s` long-side px), `--gray` value-check thumbnail, `--compare` all engines + contact sheet, `--engines` list renderers |
| `lint.py` | Static checks: broken refs, duplicate ids, non-portable features, clipped filter regions, fonts, precision, size |
| `optimize.py` | Art-safe SVGO (or built-in fallback) with precision from the canvas size, verified by before/after render diff |

First run `python scripts/render.py --engines`. If none are listed, install one (`pip install resvg-py`, or `pip install playwright && playwright install chromium`). Don't work blind: seeing the render is the core of this workflow.

## Workflow

### 1. Art direction (decide before writing any SVG)

Write a short brief in your head or as a comment in the generator:
- **Subject & story:** what is the one thing the viewer should notice first (the focal point)?
- **Style:** pick from `references/styles.md` (20 styles with construction recipes), or combine two deliberately.
- **Palette:** 3–6 hues plus tinted neutrals, a 60/30/10 split, one accent reserved for the focal point (`references/color.md`). Never pure black, grey or white.
- **Value plan:** where the darks, mids and lights go. Uneven proportions; highest contrast at the focal point.
- **Composition:** focal point on a thirds line or golden-ratio point, a clear path for the eye, generous negative space, at least 3 depth planes for scenes.
- **Canvas:** size and aspect ratio (wallpaper 16:9, poster 1:√2, social 4:5, square), and units if it's for print.

If the request is vague ("make a cool SVG landscape"), make bold, specific choices yourself and state them briefly in your reply. Ask only when an unknown would waste the whole effort (e.g. exact print dimensions, required text).

Make only original work. Don't recreate existing logos, trademarked characters or specific copyrighted artworks; offer an original design in the requested spirit instead.

### 2. Choose the construction method

- **Hand-authored SVG:** fine for compositions under ~50 elements with simple geometry (a badge, a minimal poster).
- **Generator script with svgkit (default for complex art):** organic shapes, scenes, anything with repetition-with-variation, textures, patterns, generative work. Code computes clean geometry, `rng(seed)` makes results reproducible, and a parameter tweak beats editing 400 paths by hand. Read `references/generative.md` for the template and 15 tested recipes.

```python
import sys, math; sys.path.insert(0, "<this skill dir>/scripts")
from svgkit import *
c = Canvas(1600, 1000, bg="#1b1f3b", title="…", desc="…")
c.defs(linear_gradient("sky-grad", smooth_stops([...]), x2=0, y2=1), grain_filter("grain", .2))
c.layer("sky", c.full_rect(fill="url(#sky-grad)"))      # layers: back -> front
...
c.texture("grain")                                       # texture overlay, last
c.save("out/piece.svg", preview=True)                    # .svg + .png
```

### 3. Build back to front, in named layers

A typical stack: background/sky → far → mid → near → focal subject → foreground framing → light effects (glow, rays, haze) → texture (grain/paper). Name every top-level group. The names become layers in Inkscape, Illustrator and Figma.

Construct shapes, don't guess them:
- curves through points with `smooth_d`, organic outlines with `blob_points`, tapered strokes with `ribbon_d`;
- symmetry with a centered viewBox plus rotated `<use>` copies;
- repeated motifs defined once in `<defs>` and placed with transforms;
- color ramps from `ramp`/`tone_ramp`, not ad-hoc hex values.

### 4. Render, look, critique, revise (at least two rounds)

Render (`c.save(..., preview=True)` or `render.py art.svg --gray`), then **view the PNG**. Critique it like an art director, in this order:
1. **Read at thumbnail size:** does the gray thumbnail show a clear focal point and value structure?
2. **Composition:** is the focal point where you planned? Any dead zones, crowding at the edges, or awkward tangents (shapes that just touch)?
3. **Depth:** do the planes separate (overlap, value compression, atmospheric color)?
4. **Color:** is the palette unified by one light? Is the accent only where it should be? No muddy gradients?
5. **Craft:** lumpy curves, uniform clone stamping, inconsistent stroke weights, shading that ignores the light direction, hard filter cut-offs?
6. **Finish:** is there texture or detail where the eye lands, and calm elsewhere?

Fix the biggest problem first, then render again. Two or three passes is normal; one pass almost always leaves something visibly off.

### 5. Verify portability

```bash
python scripts/lint.py art.svg            # fix every ERROR; read every WARN
python scripts/render.py art.svg --compare   # then LOOK at art.compare.png
```

### 6. Optimize and deliver

```bash
python scripts/optimize.py art.svg -o final.svg   # must report IDENTICAL
python scripts/render.py final.svg -o final.png -s 2400
```
Deliver the optimized `.svg`, a PNG preview and the generator script (so the user can make variations). Briefly state the art direction choices, the canvas size, the file size, and anything the user should know (fonts outlined, filters that rasterize in print). See `references/production.md` for print, bleed and export.

## What separates professional SVG art

- **Hierarchy:** one focal point gets the highest contrast, most detail and the accent color. The periphery is simpler.
- **Unified light:** one light direction and one light color influence every shadow and highlight. Shadows are hue-shifted (cool under warm light), never just darker or black.
- **Depth:** overlap, scale, value compression and atmospheric color shift toward the sky in the distance.
- **Controlled variation:** natural things vary. Jitter size, rotation and color slightly with a seeded RNG, and use power-law sizes (many small, few large). Uniform clones look like clip art.
- **Edge and weight discipline:** a deliberate stroke-weight system (e.g. 1/2/4), consistent caps and joins, crisp edges at the focus, softer edges in the distance.
- **Texture:** a little grain (strength .12–.25) or paper makes flat vectors feel printed and also removes gradient banding.
- **Restraint:** fewer colors, fewer effects, more negative space. Every filter must earn its render cost.

## Failure modes to avoid

| Symptom | Cause | Fix |
|---|---|---|
| Lumpy, wobbly curves | hand-guessed Bézier control points | `smooth_d` through points; compute geometry |
| "Clip-art" flatness | equal sizes, even spacing, no texture or light | scale contrast, Poisson scatter, `tone_ramp` shading, grain |
| Muddy grey gradient middle | sRGB interpolation between distant hues | `smooth_stops(colors)` (OKLCH) |
| Dirty band in a fade | fading to `transparent` | same color + `stop-opacity="0"` |
| Glow/shadow cut off square | default filter region (bbox +10%) | `filter_region(pad=.3)` or a userSpace region |
| Gradient line disappears | bbox gradient on a horizontal/vertical line | `gradientUnits="userSpaceOnUse"` |
| Effect silently missing | duplicate id (layer and def share a name) | unique ids; Canvas raises on duplicates |
| Shape shifted in one renderer | raw turbulence fed to displacement | opaque color-matrix step (svgkit does it) |
| Wrong font / missing text | font not installed; librsvg ignores `<textPath>` | `text_to_path`, `text_on_circle` |
| Reflection/mask vanishes | `mask`/`clip-path` on a flipped or scaled `<g>` is evaluated in the transformed space | mask on the outer `<g>`, transform on an inner one |
| Text clipped at the canvas edge | title size guessed | measure: `_, w = text_to_path(...)` and scale the size to fit the margins |
| Muddy grey glow | a light color at low opacity over a dark complementary background | use a real `glow_filter`, or nothing; check in the render |
| Halftone/stipple file is MBs | thousands of arc circles | `dot_paths()`: about 4× smaller, identical render |
| Distorted stroke widths | non-uniform `scale()` on stroked shapes | bake scale into coordinates |
| Huge file | thousands of elements, 6-decimal numbers | merge same-style paths, `<use>`, `optimize.py` |
| Render takes 10+ s | per-element filters, huge blurs, many octaves | one filter per group, octaves ≤ 5, gradients instead of blur |

## Portability rules (verified)

- Always include `xmlns` (+ `xmlns:xlink`), `viewBox`, `width`/`height`, a `<title>`, and a full-canvas background (unless transparency is intended).
- Never use: CSS `var()` (resvg paints black, cairosvg crashes), CSS `transform`/`transform-origin` (ignored or the element vanishes), `<foreignObject>`, `<meshgradient>`, scripts, external URLs (fonts, images, stylesheets), or `pathLength` (only Chromium honors it).
- Filters: always `color-interpolation-filters="sRGB"` and an explicit region. Put texture overlays on `fill="#000" fill-opacity="0"` rects (`Canvas.texture`): filter-less renderers then show nothing instead of an opaque sheet, whereas `fill="none"` makes resvg drop the effect.
- `mix-blend-mode` works in browsers, resvg and librsvg but not in Illustrator. Precompute overprints with `multiply()` when portability matters.
- Use `xlink:href` (with `xmlns:xlink`) for the widest editor compatibility.

## Reference map (read what the task needs)

| File | Read when |
|---|---|
| `references/techniques.md` | hand-authoring anything: paths, transforms/isometric, strokes, gradients, shading, masks/booleans, patterns, blending, text, depth and atmosphere, scatter detail |
| `references/filters.md` | any texture, shadow, glow, paper, grain, watercolor, rough edge or color effect (16 tested recipes) |
| `references/color.md` | choosing palettes, value plans, light temperature, sky gradients, overprint math; 16 curated palettes |
| `references/styles.md` | the user names or implies a style (flat, MCM, isometric, riso, art deco, synthwave, ukiyo-e, botanical, low poly, stained glass, topo…) |
| `references/generative.md` | any generator script: svgkit API, script template, 15 runnable recipes (ridges, topo, flow field, packing, Voronoi, low poly, Truchet, halftone, mandala, stars, Bauhaus subdivision, marble, sketch lines, synthwave, isometric) |
| `references/production.md` | optimizing, renderer/editor compatibility, print (mm, bleed, CMYK caveats), raster export, delivery checklist |

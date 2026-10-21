# Production: Optimization, Portability, Print & Delivery

## Contents
1. Optimization
2. Renderer compatibility (verified matrix)
3. Editor compatibility (Illustrator, Inkscape, Figma)
4. Print production
5. Exporting rasters
6. Delivery checklist

---

## 1. Optimization

`python scripts/optimize.py art.svg` runs SVGO with an art-safe configuration, then renders the original and the result with the same engine and diffs them. It exits with code 2 if anything visibly changed.

**What it does (editable mode, default):** relative path commands, shorter numbers, merging non-overlapping same-style paths, removing metadata, comments and editor junk, and collapsing redundant groups. It *keeps* layer ids, Inkscape layer labels, `<title>`/`<desc>`, and rect/circle primitives, so the file stays pleasant to edit. Use `--aggressive` for pure delivery (it minifies ids, converts shapes to paths and reuses duplicate paths).

**Safety rules baked into the config (each one a real bug found in testing):**
- Precision is set per plugin: coordinates at `p` decimals, filter and numeric attributes at ≥3. A global `floatPrecision` would round `baseFrequency="0.04"` to `0` and silently delete a texture.
- `removeUselessStrokeAndFill` is off. It turns the `fill-opacity="0"` texture carrier into `fill="none"`, which resvg then skips, so the grain vanishes.
- `removeHiddenElems` keeps zero-opacity elements, which carry filters.

**Coordinate precision by canvas size** (rounding error stays far below a pixel even at poster sizes):

| viewBox max dimension | decimals |
|---|---|
| ≤ 99 (icons, mm sheets) | 3 |
| 100–999 | 2 |
| ≥ 1000 | 1 |

**Biggest wins, in order:**
1. Fewer elements: merge same-style shapes into one path, and use `<use>` for repeated motifs. Dot fields → `dot_paths` (round-capped zero-length subpaths, ~4× smaller than circles).
2. Fewer points: thin polylines before smoothing (`pts[::2]`); 3–4 points per curve span is plenty.
3. Lower precision (above).
4. Shared styles: put `fill`/`stroke` on the parent `<g>` instead of on every child.
5. SVGO (relative commands, number compaction).
6. Gzip: serving as `.svgz` or with gzip transfer typically cuts another 60–75%.

**Size targets for standalone art:** an illustration under 300 KB is excellent and under 1 MB fine. Generative pieces with tens of thousands of elements can be 2–5 MB; that's acceptable for art files, but warn the user if they plan to embed the file on the web.

## 2. Renderer compatibility (verified)

Tested in this environment: **Chromium** 141 (≈ Chrome/Edge/Opera, browser previews), **resvg** (resvg-js 2.6; the engine class behind Typst and many converters), **librsvg** 2.61 (GNOME, Wikipedia thumbnails, ImageMagick/sharp/libvips pipelines), **cairosvg** (Python tooling).

| Feature | Chromium | resvg | librsvg | cairosvg | Guidance |
|---|---|---|---|---|---|
| Gradients, clipPath, patterns, `<use>` | ✓ | ✓ | ✓ | ✓ | safe |
| Masks (luminance) | ✓ | ✓ | ✓ | ✗ ignored | safe; cairosvg is a last resort |
| Filters (blur, turbulence, lighting, morphology, blend) | ✓ | ✓ | ✓ | ✗ ignored | safe; design overlays to degrade invisibly |
| feDisplacementMap on raw turbulence | ✓ | ⚠ shifts shape | ✓ | ✗ | insert the opaque color matrix first |
| feDropShadow | ✓ | ✓ | ✓ | ✗ | OK in these; use the chain for Illustrator |
| mix-blend-mode, isolation | ✓ | ✓ | ✓ | ✗ | OK; precompute overprints for full portability |
| CSS `<style>` class selectors | ✓ | ✓ | ✓ | ✓ | safe (simple selectors only) |
| CSS `var()` | ✓ | ✗ paints **black** | fallback only | ✗ **crashes** | never |
| CSS `transform` / `transform-origin` | ✓ | ✗ ignored | ✗ element vanishes | — | use the SVG `transform` attribute |
| `pathLength` | ✓ | ✗ | ✗ | ✗ | compute dashes from real lengths |
| `<textPath>` | ✓ | ✓ | ✗ **text vanishes** | ✓ | outline with `text_on_circle` |
| Plain text, letter-spacing, paint-order | ✓ | ✓ | ✓ | ✓ | depends on installed fonts → outline |
| Gradient (bbox units) on horizontal/vertical line | ✗ line vanishes | ✗ | ✗ | ✗ | use `userSpaceOnUse` |
| Fade to `transparent` | grey band | grey band | grey band | grey band | same color + `stop-opacity="0"` |
| `fill="none"` element carrying a filter | ✓ | ✗ skipped | ✓ | — | `fill="#000" fill-opacity="0"` |

The resvg-py 0.5 Python wheel mis-renders `feDisplacementMap` entirely, which is why `render.py` prefers Chromium, then resvg-js. Run `render.py art.svg --compare` before delivering anything that uses filters, masks or text. Look at the contact sheet; the numbers only point you where to look.

## 3. Editor compatibility

From known tool behavior (not rendered here). Test in the user's tool when it matters.

- **Illustrator** (SVG import): ids become object/layer names. Filters import partially (complex chains get rasterized or dropped). `mix-blend-mode`, `paint-order` and `feDropShadow` are unsupported, and plain `href` is unreliable, so use `xlink:href`. Masks and clipPaths import as clipping and opacity masks.
- **Inkscape:** excellent coverage, including filters, and the most faithful editor. `inkscape:groupmode="layer"` + `inkscape:label` (emitted by `Canvas.layer`) produce real layers. It is the only renderer of `<meshgradient>`, which is exactly why you must not use one.
- **Figma** (import): flattens many filters and ignores most of them except blur and drop shadow. Gradients, masks and clipping import well, and groups keep their ids as names.
- **Design for editability when the user will keep working on the file:** named layer groups, live shapes (rect, circle) where possible, filters on whole groups (one toggle to remove), and text kept live in a hidden layer alongside the outlined version.

## 4. Print production

- **Size in physical units:** `width="420mm" height="594mm" viewBox="0 0 420 594"` (A2, 1 unit = 1 mm). For posters you can also keep a 1000-unit viewBox and set mm width/height. The art scales exactly.
- **Bleed:** extend background art 3 mm beyond the trim on every side. Make the document trim + 6 mm (e.g. 426×600 mm, viewBox `-3 -3 426 600`) and keep text and important elements ≥ 5 mm inside the trim (the safe zone).
- **Minimum line weight:** 0.25 pt ≈ 0.09 mm. Thinner hairlines may vanish in print.
- **Color:** SVG is sRGB only, with no CMYK or spot colors. Very saturated RGB (neon pink, electric blue, pure greens) shifts dull in CMYK. Warn the user, and for print-critical work suggest a proof, or conversion with an ICC profile in their print tool. Risograph and screenprint work is separated by ink layer, so keep each ink in its own named group.
- **Filters rasterize** in PDF/EPS export (grain, blur, displacement become bitmaps at the export DPI). Keep the shapes that carry the design as vectors, and use filters for texture only. For print, export PDF/PNG at ≥ 300 DPI at final size.
- **PDF export:** Inkscape CLI gives the best results (`inkscape art.svg --export-type=pdf`). Chromium's print-to-PDF keeps vectors and rasterizes filters. cairosvg keeps vectors but drops filters and masks.

## 5. Exporting rasters

```bash
python scripts/render.py art.svg -o art-4k.png -s 3840 --bg none   # long side 3840 px, keep alpha
python scripts/render.py art.svg -o art-print.png -s 7016            # A2 @ 300 DPI long side
```
- `--bg none` keeps transparency. The default flattens transparent areas onto a checkerboard so you can *see* them while reviewing.
- Pixel size for print = mm / 25.4 × DPI (A4 at 300 DPI = 2480 × 3508).
- Heavy filters at huge sizes can take minutes. The render time is printed, so warn the user if a 4K export takes more than about 30 s.

## 6. Delivery checklist

1. `lint.py art.svg` reports no errors, and the warnings are understood or fixed.
2. `render.py art.svg --compare` shows a consistent contact sheet.
3. `optimize.py art.svg` reports the visual check as IDENTICAL.
4. `<title>` (and ideally `<desc>`) are set; width/height are the intended size; a background is painted unless transparency is intended.
5. Text is outlined (or the user chose live text and knows the font requirement).
6. Deliver: the `.svg` (optimized), a `.png` preview, and the generator script if one was used, so the user can regenerate and make variations.

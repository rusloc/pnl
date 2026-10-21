# SVG Craft Techniques

Hand-authoring knowledge for complex standalone artwork. Every gotcha marked ⚠ was confirmed by rendering in Chromium, resvg, librsvg and cairosvg.

## Contents
1. Canvas & coordinate systems
2. Paths
3. Transforms (incl. isometric)
4. Reuse: defs, symbol, use
5. Strokes as a design tool
6. Gradients
7. Shading & form
8. Clipping & masking (boolean ops)
9. Patterns
10. Opacity & blending
11. Text in artwork
12. Depth, atmosphere & light
13. Detail & scatter techniques

---

## 1. Canvas & coordinate systems

Skeleton for every standalone piece:
```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1600" height="1000" viewBox="0 0 1600 1000">
  <title>Harbour at Dusk</title>
  <desc>Layered vector illustration, 2026</desc>
  <defs><!-- gradients, filters, clipPaths, masks, symbols --></defs>
  <rect id="background" width="1600" height="1000" fill="#1b1f3b"/>
  <g id="sky">…</g><g id="far">…</g><g id="mid">…</g><g id="near">…</g><g id="fx">…</g>
</svg>
```
- **width/height + viewBox, always.** The viewBox lets the art scale. width/height give image viewers, Office and converters an intrinsic size; without them, many fall back to 300×150.
- **Choose round, meaningful numbers.** 1000-unit or 1600×1000 canvases make mental math easy and keep coordinates short.
- **Center origin for radial or symmetric art:** `viewBox="-500 -500 1000 1000"` puts (0,0) at the center, so mandalas, badges and suns become `rotate(k*30)` copies of one element.
- **Aspect ratios:** 16:9 (1920×1080) wallpapers; 4:5 (1080×1350) social; 1:√2 (1000×1414) A-series posters; 2:3 (1000×1500) prints; 1:1 album or avatar art.
- **Print:** `width="420mm" height="594mm" viewBox="0 0 420 594"` gives 1 unit = 1 mm (see production.md for bleed).
- **Always paint a full-canvas background** unless transparency is intended. Transparent areas show black in some viewers and a checkerboard in editors.
- **Name the layers** (`<g id="far-mountains">`). Ids become layer/object names in Illustrator and Figma, and svgkit's `Canvas.layer()` also emits Inkscape layer attributes.

## 2. Paths

| Cmd | Params | Use |
|---|---|---|
| `M/m` | x y | start a subpath (several M's in one path = a compound path) |
| `L/l H/h V/v` | x y / x / y | straight segments; H/V save bytes |
| `C/c` | x1 y1 x2 y2 x y | cubic Bézier (most organic shapes) |
| `S/s` | x2 y2 x y | smooth cubic: mirrors the previous control point (keeps tangents continuous) |
| `Q/q T/t` | x1 y1 x y / x y | quadratic; T continues smoothly |
| `A/a` | rx ry rot large-arc sweep x y | elliptical arc |
| `Z` | | close; joins with a proper line join instead of two caps |

- **Arc flags:** `large-arc=1` takes the >180° route. `sweep=1` goes clockwise on screen (y points down). A full circle needs two arcs: `M cx-r,cy a r,r 0 1,0 2r,0 a r,r 0 1,0 -2r,0 Z` (`circle_d`).
- **Lowercase = relative.** Relative commands give shorter numbers and let you move a shape by editing only its first `M`.
- **Smooth organic curves through points:** don't guess control points. Generate Catmull-Rom → Bézier with `smooth_d(points, closed)`. Hand-placed control points are the #1 source of lumpy, amateur curves.
- **Bézier circle constant:** a quarter circle of radius r ≈ `C` with control arms of length 0.5523·r.
- **Compound paths & holes:** `fill-rule="evenodd"` makes any inner subpath a hole. With the default `nonzero`, an inner subpath is a hole only if drawn in the **opposite direction** ⚠ (same direction = filled solid). Use evenodd for letters, donuts, windows and frames.
- **Close shapes with Z** when they are stroked. Otherwise the start and end show caps instead of a join.

## 3. Transforms

- Transforms in an attribute apply **right to left** to the shape: `translate(400 300) rotate(30) scale(2)` scales first, then rotates, then moves.
- `rotate(a cx cy)` rotates about a pivot. To scale about a pivot: `translate(cx cy) scale(s) translate(-cx -cy)`.
- Mirror: `scale(-1 1)` (horizontal), `scale(1 -1)` (vertical, used for reflections).
- ⚠ **Strokes scale with the transform:** a `stroke-width="2"` inside `scale(3 1)` becomes 6 wide horizontally and 2 vertically (an ugly, uneven line). Bake scaling into coordinates for stroked art, or use only uniform scales and divide the stroke width by the scale.
- **Isometric** (true 30°, verified): draw each face as a flat 2D shape in a unit grid and map it:
  - top face: `matrix(0.866 0.5 -0.866 0.5 0 0)`
  - left face (edge runs down-right): `matrix(0.866 0.5 0 1 0 0)`
  - right face (edge runs up-right): `matrix(0.866 -0.5 0 1 0 0)`
  
  A cube of side s at origin O: right face at O, left face translated by (−0.866s, −0.5s), top face by (0, −s). Shade the faces as top = light, left = mid, right = dark (or the reverse, consistently).
- `skewX(-30)` with `scale(1 0.5)` turns a silhouette into a cast shadow lying on the ground.
- ⚠ **`mask`, `clip-path` and `filter` on an element that also has a `transform` are evaluated in the transformed coordinate system.** A flipped reflection `<g transform="scale(1 -1)" mask=…>` flips its user-space mask too, and the reflection disappears. Nest instead: `<g mask="url(#fade)"><g transform="…">…</g></g>`. (lint.py warns about this.)

## 4. Reuse: defs, symbol, use

- Define a motif once in `<defs>` (`<g id="pine">` or `<symbol id="pine" viewBox=…>`), then place it with `<use xlink:href="#pine" transform="translate(…) scale(…)"/>`. A forest of 300 trees costs 300 short lines.
- **Recolorable instances:** leave `fill` unset (or `fill="currentColor"`) in the definition, and set `fill` or `color` on each `<use>`. Fill inherits into the instance.
- Prefer `xlink:href` with `xmlns:xlink` declared. Plain `href` (SVG2) fails in Illustrator and Inkscape <1.0.
- Ids must be **unique** ⚠: a layer `<g id="grain">` plus a `<filter id="grain">` made resvg resolve `url(#grain)` to the group, and the effect vanished. svgkit's Canvas raises an error on duplicates.

## 5. Strokes as a design tool

- `stroke-linecap="round" stroke-linejoin="round"` for friendly, hand-drawn or monoline art. Miter joins on sharp angles spike out (limit with `stroke-miterlimit`).
- **Perfect dots:** `stroke-dasharray="0 18" stroke-linecap="round"` puts round dots of diameter stroke-width every 18 units. Use for dotted trails, bead strings and stitching.
- ⚠ `pathLength` is **ignored by resvg, librsvg and cairosvg**. Compute dash lengths from the real path length instead (2πr for circles; `sum(dist)` for polylines).
- **Dot fields for a quarter of the size:** a zero-length subpath `M x y h0` with `stroke-linecap="round"` draws a dot of diameter = stroke-width (verified in all four engines). One path per dot size gives halftones, stipple and starfields about 4× smaller than circles (`dot_paths`).
- **Dash to an exact count:** for N dashes on a circle, use `dash = gap = 2πr / (2N)`.
- **Outline lettering:** `paint-order="stroke"` puts the stroke behind the fill (browsers, resvg, librsvg; not Illustrator). The portable alternative is a duplicate path underneath with a wide stroke.
- **Double-stroke inlay:** draw the same path twice, first wide and dark, then narrow and light. This gives roads, neon tubes, cartoon outlines and rivers with banks.
- **Variable-width (brush) strokes:** SVG strokes have constant width. For tapered brush lines, leaves, hair and calligraphy, fill the outline from `ribbon_d(points, width, taper)` or `profile=lambda t: math.sin(math.pi*t)**0.8` for leaf shapes.
- **Hatching:** draw parallel lines over the whole area and clip them to the shadow shape. Cross-hatch the darker zones with a second clipped set at another angle. Line spacing controls value.
- Keep stroke widths in a **deliberate system**: e.g. 1 / 2 / 4 for detail / contour / silhouette. Random widths look accidental.

## 6. Gradients

- **Units:** the default `objectBoundingBox` maps 0–1 onto each shape's own box. That suits per-object shading. Use `gradientUnits="userSpaceOnUse"` with absolute coordinates when one gradient must span many shapes coherently (a sky behind silhouettes, light falling across a scene).
- ⚠ **Bounding-box gradient on a horizontal or vertical line makes the line vanish** in every renderer (the box has zero height). Use `userSpaceOnUse` for any gradient on lines or flat strokes.
- ⚠ **Never fade to `transparent`:** it interpolates toward transparent *black* and leaves a dirty grey-brown band. Fade to the same color with `stop-opacity="0"`.
- ⚠ **sRGB interpolation dulls the middle** of gradients between distant hues (blue→orange goes grey-brown). Precompute stops: `smooth_stops(["#1e6bff","#ff8a00"])` (OKLCH, vivid) or `space="oklab"` (even, calm).
- **Radial focal point:** `fx fy` off-center (e.g. .35 .3) produces the bright spot of a lit sphere. In bbox units a wide shape gets an elliptical gradient; use userSpace plus `gradientTransform` when you need exact geometry.
- `gradientTransform="rotate(35 .5 .5)"` angles a bbox gradient. `spreadMethod="reflect"` or `"repeat"` makes stripes and rings from a short gradient.
- **Reuse stops:** define the stops once, then `<linearGradient id="b" xlink:href="#a" x1=… />` inherits them with new geometry.
- **Conic gradient (none exists in SVG):** fill 90–180 thin `ring_sector_d` wedges with `ramp(colors, n, "oklch")` colors (add `stroke` of the same color and width .5 to hide hairline seams).
- **Banding:** large, subtle gradients band at 8 bits. A grain overlay at strength ≈ .1 dithers it away.
- **Gradient meshes:** never use `<meshgradient>` (Inkscape only). Fake them with 3–6 large blurred ellipses (`blur_filter` with a canvas region) clipped to the shape, or with overlapping radial gradients that fade to opacity 0.

## 7. Shading & form

Pick **one light direction** for the whole piece (e.g. top-left) and obey it everywhere: highlights, shadow sides, cast shadows and rim light.

- **Sphere:** radial gradient, focal point toward the light, three stops (highlight tint → base → shadow hue-shifted toward blue/violet). Add a small soft white ellipse for the specular highlight and a darker crescent of reflected-light-free core shadow.
- **Cylinder / trunk / column:** linear gradient *across* the axis: shadow → base → highlight band (narrow) → base → bounce light (slightly lighter) at the far edge.
- **Cone / sunburst:** wedge sectors with stepped values.
- **Flat-style shading:** no gradients. Split each form into a light half and a shadow half with a crisp path, using 2–3 tones per color from `tone_ramp(base, 5)` (shadows rotate toward violet-blue, highlights toward yellow).
- **Contact / ambient occlusion shadow:** a dark ellipse with a radial gradient to opacity 0, squashed under the object. It grounds things instantly.
- **Cast shadow:** a silhouette copy with `skewX` + `scale(1 .4)`, filled with the scene's shadow color at .25–.4 opacity and blurred slightly more the farther it falls.
- **Rim light:** a light-colored stroke on the edge facing the light, clipped to the object (clipPath = the object itself) so only the inner half shows.
- **Glossy/glass:** a white highlight shape with a vertical gradient from .7 to 0 opacity across the top third, plus a thin bright reflection line on the opposite edge.

## 8. Clipping & masking

- `clipPath` is a hard, binary stencil. `mask` is soft: **luminance** decides visibility (white = visible, black = hidden, grey = partial, so gradients give fades).
- Give masks for large or filtered content explicit regions: `maskUnits="userSpaceOnUse" x y width height`. The default region is the bbox +10%, which crops blurs.
- **Boolean operations without an editor:**
  - union → group the shapes (same fill)
  - intersect → `clip-path` one shape with the other
  - subtract → `mask`: a white rect with the cutter drawn in black; or a compound evenodd path
  - exclude (XOR) → one evenodd path containing both
- **Retro striped sun (verified):** circle with gradient fill + mask = white rect minus black horizontal bars that thicken toward the bottom.
- **Texture inside a shape:** draw the texture (hatching, dots, noise group) and clip it to the shape. The shape's edge stays perfectly crisp.
- **Knockout text:** a mask containing white everywhere and black outlined letters.
- **Framing:** clip the whole composition to an arch, circle or rounded rect. It instantly reads as a finished "badge" or "window" artwork.
- **Fades into atmosphere:** mask far layers with a vertical gradient so they dissolve into haze.

## 9. Patterns

- `<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` produces diagonal stripes from a vertical-stripe tile.
- **Seamless tiles:** anything crossing a tile edge must be repeated, offset by the tile size, at the opposite edge.
- Patterns can't vary per tile, and some renderers show hairline seams at fractional zoom. For hero artwork, **generate** the repeated elements explicitly (halftones, dot gradients, Truchet tiles); see generative.md.
- Good pattern uses: background textures, fabric, wallpaper motifs and small fills where variation doesn't matter.

## 10. Opacity & blending

- `opacity` on a **group** composites the group first, so overlaps inside it don't double-darken. `opacity` on each element shows the overlaps. Choose deliberately.
- `fill-opacity` and `stroke-opacity` are separate. A semi-transparent fill with an opaque stroke is a common, nice look.
- `mix-blend-mode: multiply | screen | overlay` (style attribute) works in browsers, resvg and new librsvg, but is **ignored by Illustrator import and old librsvg**. For portable overprint looks, precompute the overlap colors with `svgkit.multiply(c1, c2)` / `screen()` and draw the intersection explicitly (clip one shape by the other).
- **Glazing:** stacking 3–5 translucent layers of related hues gives richer color than any single flat fill.

## 11. Text in artwork

- ⚠ Fonts are the #1 portability failure. If the recipient lacks the font, a substitute appears. **Outline final text** with `text_to_path(s, find_font("Family", "Bold"), size, x, y, anchor="middle")`. Keep a live-text copy only if the user wants it editable.
- `text_to_path` / `text_on_circle` apply **GPOS pair kerning** (outline width within 0.25% of Chromium live text),
  accept a **fallback list** of font files (e.g. latin + latin-ext subsets, so Turkish ş ğ ı İ work), and **warn on
  stderr about missing glyphs** (drawn as .notdef boxes). Get open fonts with design-styles `get_fonts("Family", weight)`.
  No ligatures or complex shaping.
- Live text: end every stack with a generic family: `font-family="Futura, 'Century Gothic', sans-serif"`.
- ⚠ **librsvg (GNOME, Wikipedia thumbnails, sharp/ImageMagick pipelines) does not render `<textPath>` at all**: the text silently disappears. For final art, use `text_on_circle(s, font, size, cx, cy, r, center_deg=-90)` (top, reading clockwise) or `inward=True, center_deg=90` (bottom, reading left→right), which outlines each glyph along the arc.
- **Live textPath on a circle (verified in browsers/resvg):** for the top of a badge use an open semicircle arc `M cx-r,cy A r,r 0 0,1 cx+r,cy` with `startOffset="50%" text-anchor="middle"`. ⚠ On a full-circle path that starts at the left, 50% lands on the *right* side; the top is 25%. For bottom text that reads upright, use the lower arc drawn left→right: `M cx-r,cy A r,r 0 0,0 cx+r,cy` (glyphs sit inside the ring).
- `letter-spacing` works in all tested engines. `dominant-baseline` varies, so position with explicit `y`/`dy` instead.
- Typography in art: one display face + at most one supporting face; strong size contrast (title ≥ 3× subtitle); generous tracking on small caps; align to the composition's grid.

## 12. Depth, atmosphere & light

- **Planes:** at least three: background (sky), midground, foreground. Each nearer plane is darker or more saturated, has more contrast and detail, and is larger.
- **Atmospheric perspective:** the farther the layer, the closer its color to the sky color: `mix(layer_color, sky_color, 0.15 + 0.2*k)` for k = 0 (near) … 3 (far). Distant layers also get a lower-contrast, flatter fill.
- **Overlap** is the strongest depth cue. Make silhouettes overlap; avoid shapes that just touch (tangents read as flat and awkward).
- **Haze bands:** a horizontal strip with a vertical gradient (sky color, opacity .6 → 0) placed at the base of each far layer separates the planes.
- **Light shafts:** long thin polygons (wedges from the light source) in a light tint, opacity .08–.18, inside a group with a slight blur, masked to fade at the far end.
- **Sun/moon glow:** concentric circles with a stepped opacity (flat style), or one radial gradient (soft style), plus a large faint halo.
- **Water reflection:** `<use>` the landscape layer inside `<g mask=fade><g transform="translate(0 2·waterline) scale(1 -1)">` (mask outside, transform inside), darken and desaturate it, mask it with a vertical gradient to fade, and break it with thin horizontal ripple lines in the sky color.
- **Depth of field:** blur the nearest foreground element slightly (stdDeviation 3–8) to frame the focal point.

## 13. Detail & scatter techniques

- **Natural scatter:** use `poisson_disk` for even-but-organic spacing. Never use a grid with jitter for organic subjects.
- **Size distribution:** natural objects follow power laws, many small and few large: `r = r_min * (r_max/r_min) ** (R.random() ** 3)`.
- **Variation per instance:** rotate ±8°, scale ±15%, shift hue ±6° / lightness ±.04 (`hue_shift`, `lighten`). Uniform clones look like clip art.
- **Detail budget:** spend detail at the focal point. Periphery gets bigger, simpler shapes. Rendering everything equally sharp flattens the picture.
- **Stars:** Poisson scatter, power-law sizes, 3–5 bright ones with glow, a few colored (pale blue, warm white). Denser near the horizon band if there's a Milky Way.
- **Grass, fur, hair:** many `ribbon_d` blades with tapered ends, clustered, angles from noise so they sway together.
- **Foliage masses:** overlapping blobs (`blob_points` + `smooth_d`) in 3 values. Darkest inside and below, lightest on the top-left edge; sparse leaf shapes only at the silhouette edge.

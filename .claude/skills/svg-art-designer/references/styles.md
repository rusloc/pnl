# Style Playbook

Each style lists what makes it recognizable, how to build it in SVG, and the mistakes that cheapen it. Palettes refer to color.md §5; algorithms refer to generative.md. Mixing two styles deliberately (e.g. flat illustration + risograph texture) is often the most distinctive choice.

## Contents
Illustration: 1 Flat editorial · 2 Layered landscape / paper-cut · 3 Mid-century modern · 4 Isometric · 5 Botanical · 6 Ukiyo-e inspired · 7 Watercolor
Graphic/poster: 8 Bauhaus / Swiss · 9 Art Deco · 10 Synthwave / outrun · 11 Risograph / screenprint · 12 Halftone / pop art
Line & mark-making: 13 Monoline line art · 14 Engraving / hatching
Generative & abstract: 15 Flow field · 16 Topographic · 17 Low poly · 18 Stained glass / mosaic · 19 Gradient aurora · 20 Mandala / sacred geometry

---

### 1. Flat editorial illustration
**Look:** simplified geometric figures and objects, no outlines, 2–3 tones per color, bold shapes, slight texture.
**Build:** shapes from circles, rounded rects and `smooth_d` blobs; shading as crisp light/shadow split shapes from `tone_ramp`; one consistent light direction; grain at .15–.25.
**Signature:** oversized foreground props, cropped figures, a limited palette with one hot accent, long shadows as geometry.
**Avoid:** gradients everywhere (that's a different style), equal-sized elements, outlines on some shapes but not others.

### 2. Layered landscape / paper-cut parallax
**Look:** 5–9 stacked silhouette layers (mountains, hills, trees) receding into haze, under a gradient sky with a sun.
**Build:** ridgelines from `Noise.fbm` (generative.md → Layered ridges). Layer colors via `ramp([near_dark, horizon_color], n)` so far layers converge to the sky. Paper-cut variant: a `shadow_filter` (dy 4–8, tinted) on each layer group, plus a `rough_filter` scale 2–3.
**Signature:** a haze band at each layer's base; one focal silhouette (lone tree, cabin, figure) on a mid layer; birds as tiny "v" paths.
**Avoid:** identical noise frequency on every layer (vary amplitude: far = low and smooth, near = taller and jagged); layers that are evenly spaced vertically.

### 3. Mid-century modern
**Look:** 1950s–60s travel posters and textiles: boomerangs, starbursts, atomic dots, organic kidney shapes, textured flats, offset color registration.
**Build:** Mid-Century palette; shapes with `rounded_poly_d`, starbursts with thin `ring_sector_d` wedges; offset the fill layer 3–6 units from the line/detail layer to fake misregistration; grain .3.
**Signature:** stylized trees (lollipops, triangles with trunk lines), off-register color blocks, rough-edged shapes (`rough_filter` scale 2).
**Avoid:** perfect alignment, glossy gradients, saturated digital colors.

### 4. Isometric
**Look:** 30° axonometric objects or scenes, no perspective convergence, crisp three-tone faces.
**Build:** model in a 2D unit grid, map faces with the isometric matrices (techniques.md §3), or compute iso points directly: `iso(x,y,z) = ((x - y) * 0.866, (x + y) * 0.5 - z)`. Paint back to front (sort by x+y, then z).
**Signature:** top = lightest, one side mid, other side darkest; tiny people and props for scale; floating island or diorama framing.
**Avoid:** mixing projections; mis-sorted depth (an object behind drawn in front); shading direction changing between objects.

### 5. Botanical illustration
**Look:** leaves, stems and flowers with tapered strokes, delicate veins, a muted natural palette, often on cream paper.
**Build:** stems and leaves as `ribbon_d` (leaf profile `sin(pi*t)**0.8`), veins as thin ribbons clipped to the leaf, petals as rotated copies (`<use>` + `rotate(k*360/n cx cy)`), paper background filter.
**Signature:** natural variation in leaf angle and size (seeded), overlapping leaves with a darker tone where they overlap, a few curling tips.
**Avoid:** constant-width strokes, perfectly symmetric plants, saturated greens (mix toward olive or teal).

### 6. Ukiyo-e inspired (Japanese woodblock)
**Look:** flat color areas with confident dark outlines, Prussian blue, stylized clawed waves, gradient-band skies (bokashi), cream paper.
**Build:** Ukiyo-e palette; outlines as a separate darker stroke layer (stroke-linejoin round); waves from scalloped arcs and spiral curls; bokashi = a short linear gradient band at the top of the sky; paper filter + grain .2.
**Signature:** a strong diagonal composition, a small Mt Fuji-like triangle for scale, foam as clustered white circles and claws.
**Avoid:** soft shading; photographic gradients across whole areas.

### 7. Watercolor
**Look:** translucent overlapping washes, bleeding irregular edges, pigment granulation, white of the paper showing through.
**Build:** shapes as loose blobs; 3–4 layered washes per form with `watercolor_filter` (different seeds), `fill-opacity` .55–.75; darker glaze only in the shadow areas; paper background.
**Signature:** hard "bloom" edges where washes overlap; deliberately unpainted gaps; a few crisp detail lines (ribbon_d) on top.
**Avoid:** opaque fills; one wash per shape; neat outlines.

### 8. Bauhaus / Swiss geometric poster
**Look:** primary colors + black on off-white, circles, semicircles, quarter circles and bars on a strict grid, asymmetric balance, bold sans type.
**Build:** a 6–12 column grid; shapes from `ring_sector_d` (r_in=0 for quarter circles) and rects; recursive subdivision (generative.md); outlined type via `text_to_path` aligned to the grid.
**Signature:** large scale contrast (one giant circle, many small elements), overlapping shapes with precomputed overprint colors, generous negative space.
**Avoid:** centered symmetric layouts; more than 4 colors; decorative effects.

### 9. Art Deco
**Look:** symmetry, sunbursts, stepped ziggurats, fan motifs, thin parallel gold lines on black or deep teal, elegant geometric type.
**Build:** center-origin viewBox; radial repeats with `<use>` rotations; gold = linear gradient `#8a6a2f → #e9d08c → #b08a3e → #f3e3b0 → #8a6a2f` (metallic banding needs several alternating stops); thin strokes (1–2 units) in groups of 3–5.
**Signature:** a fan or sunburst behind a central motif; layered arches; a frame with stepped corners.
**Avoid:** thick strokes; a single-stop "gold" (flat mustard); asymmetry.

### 10. Synthwave / outrun
**Look:** 80s retro-future: a striped gradient sun, perspective neon grid floor, purple-magenta sky, chrome text, palm silhouettes, glow.
**Build:** Synthwave palette; sun = circle with vertical `smooth_stops(["#ffd319","#ff2975","#8c1eff"])` gradient + mask bars (techniques.md §8); grid = horizontal lines spaced geometrically toward the horizon (`y = horizon + k*1.18**i`) plus lines converging to the vanishing point; `neon` filter on the grid and outlines; distant mountains as low-poly wireframes.
**Signature:** a hot horizon glow band; a reflective floor; scanline or grain overlay.
**Avoid:** evenly spaced floor lines (they kill the perspective); glow on everything.

### 11. Risograph / screenprint
**Look:** 2–3 spot inks on paper, visible grain, overprint colors where inks overlap, slight misregistration, halftone shading.
**Build:** Risograph palette; each ink in its own layer group; overlaps computed with `multiply()` and drawn as clipped intersections; one layer offset 2–4 units; shading via halftone dots (generative.md); grain .35–.45; a paper background.
**Signature:** fluorescent pink + blue overprinting to purple; uneven ink coverage (grain); white paper as the brightest value.
**Avoid:** more than ~4 inks; gradients (use halftone instead); pure digital-perfect registration.

### 12. Halftone / pop art
**Look:** dot screens of varying size, bold black outlines, flat CMY-like colors, Ben-Day dots.
**Build:** generate the dots on a rotated grid with the radius driven by a tone function (generative.md → Halftone); clip them to shapes; outlines as a separate stroke layer (width 4–8).
**Signature:** dots growing into solid areas; speech-bubble shapes; comic-style speed lines.
**Avoid:** pattern-based dots with uniform size (that's flat, not halftone).

### 13. Monoline line art
**Look:** a single consistent stroke weight, round caps and joins, minimal or no fill, elegant continuous curves.
**Build:** everything as stroked paths (`fill="none"`), `stroke-linecap="round" stroke-linejoin="round"`; curves through points with `smooth_d`; optional one or two flat color shapes offset behind the lines.
**Signature:** occasional line breaks (gaps) for liveliness; a few dot accents; strict weight discipline (1 weight, maybe 2).
**Avoid:** transforms with non-uniform scaling (they distort the weight); mixing filled and stroked rendering of the same element type.

### 14. Engraving / hatching (woodcut, etching)
**Look:** value built entirely from parallel lines and cross-hatching that follow form; often 1–2 inks.
**Build:** for each value zone, generate parallel lines (or `contour_lines` of a form function, which follow the form) and clip them to the zone shape; spacing = value (dense = dark); add cross-hatching at 45° in the darkest zones; lines may taper (`ribbon_d`).
**Signature:** lines that curve with the surface; white highlights left completely bare.
**Avoid:** straight horizontal hatching on curved forms; uniform spacing everywhere.

### 15. Flow field
**Look:** thousands of streamlines flowing like wind, hair or water, evenly spaced, never crossing.
**Build:** `flow_lines(angle_fn=noise)`; vary stroke width by length or position; color by angle or position along a ramp; optionally clip to a shape or letterform.
**Signature:** calm regions and swirls (add a vortex term to the angle function); a restrained 2–3 color palette.
**Avoid:** noise frequency too high (chaos); lines too short (fur, not flow); a pure black-on-white default with no design intent.

### 16. Topographic / contour
**Look:** nested iso-lines like a terrain map; can be literal maps or abstract op-art.
**Build:** `contour_lines(field, levels)`; field = fbm noise (+ a radial falloff for an island); color the lines by level with a ramp; emphasize every 5th line (index contours) with a thicker stroke; optional filled bands (draw from the lowest level up, as filled closed loops).
**Signature:** thin lines (1–1.5) with an occasional heavy line; a muted map palette or neon-on-black for op-art.
**Avoid:** equal weight on all lines; too many levels (clogging); jagged lines (smooth with `smooth_d(k=.6)`).

### 17. Low poly
**Look:** a faceted triangle mesh with color graded across faces, like crystal or origami.
**Build:** `poisson_disk` points + **border points** every ~spacing along all four edges + corners → `delaunay_triangles`; color each face by sampling a gradient or noise at its centroid; give each triangle a same-color stroke of .5–1 to hide AA seams.
**Signature:** denser triangles at the focal point (add extra points there); a subtle lightness jitter per face.
**Avoid:** slivers at the edges (missing border points); random colors per face.

### 18. Stained glass / mosaic
**Look:** jewel-toned cells separated by thick dark "leading", light glowing through.
**Build:** `voronoi_polygons(poisson_disk(...))`; cells as `rounded_poly_d` with dark stroke 4–8 and `stroke-linejoin="round"`; colors from a jewel palette, with brighter cells near a light source; an inner radial gradient per cell or a global light glow overlay.
**Signature:** a subject silhouette (figure, flower) shaped from groups of cells; slightly irregular leading width.
**Avoid:** cells of uniform color saturation; thin leading.

### 19. Gradient aurora / blurred mesh
**Look:** soft, luminous color fields blending freely, like modern abstract wallpapers and album art.
**Build:** dark or light base; 4–7 large ellipses/blobs in saturated palette colors inside one group with `blur_filter(std = 8–15% of canvas, region=canvas)`; add grain .15 (essential: it removes banding and adds tactility); optionally one crisp geometric element on top for contrast.
**Signature:** a crisp element over soft color; colors adjacent on the hue wheel, plus one complement.
**Avoid:** blurred blobs clipped by a tight filter region (hard square edges); no grain (banding).

### 20. Mandala / sacred geometry
**Look:** perfect radial symmetry, concentric rings of repeated motifs, fine line work, often gold on dark or ink on cream.
**Build:** viewBox centered on 0,0; design ONE wedge (360/n degrees) in a group, then `<use>` it n times with `rotate(k*360/n)`; mirror the wedge (`scale(1 -1)`) for kaleidoscope symmetry; rings with different n (8, 12, 16, 24) for rhythm; flower-of-life = circles centered on points of other circles.
**Signature:** an alternating density of rings (busy, calm, busy); a dot ring between motif rings.
**Avoid:** drawing every petal individually by hand; inconsistent stroke weights between rings.

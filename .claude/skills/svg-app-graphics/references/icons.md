# Icons: UI icon sets and app icons

## UI icons (system/tab/toolbar)
**Canvas:** `viewBox="0 0 24 24"`, live area 20×20 (2px padding). Keyline shapes for equal
visual weight: circle Ø20, square 18×18, portrait 16×20, landscape 20×16.

**Stroke system (pixel-snapped; verified in 4 renderers):**
- 2px strokes on integer coordinates → crisp at 1×. This is the default.
- 1px strokes must sit on `.5` coordinates (16px sets).
- Avoid 1.5px for 1× pixel-perfect sets: it's crisp on no grid. Fine for high-DPI-only products.
- One cap/join rule per set: round (friendly) or square/miter (technical). Exterior corner radius 2.
- Diagonals at 45° only, when possible. Arcs and circles centered on the pixel grid.

**Optical sizes:** draw 16 and 20 separately, don't scale the 24. A downscaled 24 is mushy, as
`wrap.py --sheet` shows at the 16/20 columns. At 16, use 1px strokes on `.5` and drop
secondary details.

**Optical balance:** circles and diagonals overshoot squares slightly (a Ø20 circle sits with an
18×18 square). Check every icon of a set side by side in the sheet, at real size, in both themes.

**States:** outline = default, filled = selected/active (tab bars, nav). Same silhouette and keylines.

**Metaphor:** one idea per icon, no letters or words (localization), no tiny decorative details.

**Code shape (what wrap.py produces):** no width/height, `fill="none"` and stroke attributes on one
`<g>`, `currentColor`, merged paths, no transforms, no ids unless needed.

**A11y:** decorative → `aria-hidden`; meaningful → title / `aria-label` (React `title` prop).
Touch target ≥ 44×44pt (iOS) / 48×48dp (Android) around a 24 glyph.

**Two-tone icons:** second tone as `fill="currentColor" fill-opacity=".3"` on that shape. This works on
every platform (Android: opacity on the shape, never on a `<g>`).

## App icons
**Apple (iOS 26+, Liquid Glass):** master 1024×1024. Design flat, then split into layers by depth
and by color: background + groups of 1–4 layers. Export each layer as SVG, import into Icon
Composer, and let it add glass, specular and shadow.
- Don't bake shadows, highlights or glass into the layers.
- Keep layers opaque and simple; very thin lines get lost under glass.
- The silhouette must read in default, dark, clear and tinted modes.

**Android adaptive:** 108×108dp layers (foreground + background). The inner 72×72dp shows through
the launcher mask, so keep key art inside a ~66dp circle. Add a **monochrome** layer for Android 13+
themed icons. Avoid detail in the outer 18dp. The VectorDrawable rules from platforms.md apply.

**PWA / web:** `wrap.py logo.svg -o out --favicon --bg <brand>` writes:
- `favicon.ico` (16/32/48) and `favicon.svg`;
- `apple-touch-icon.png` (180, opaque: iOS shows transparency as black);
- `icon-192.png` and `icon-512.png`;
- `icon-maskable-512.png` (art inside the central safe circle, radius 40%);
- `head.html` and `manifest.webmanifest` snippets.

**App-icon composition:** one bold glyph on a gradient or flat field reads best at 29–60px.
Test at 60, 40 and 29px in the sheet (`--sizes 29,40,60,120`).

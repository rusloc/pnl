# Small Graphics: badges, empty states, spots, status, loaders, stickers

## Universal rules at small scale
- Minimum feature 2px at 1×; no hairlines; ≤ 5 colors (brand + neutral + one accent).
- Silhouette first: it must read as a solid black shape at 50% size.
- One light direction for the whole series (top-left); shading as flat tone steps (`tone_ramp`).
- Series consistency: same canvas, stroke weight, palette, corner radius and perspective.
- Ship dark-mode variants. Neutrals via `currentColor` or a second token-colored variant.

## Badges & achievements (64–128px)
- Shape language carries meaning: shield (security), hexagon (skill), circle (milestone), star (top).
- Tiers by material color: bronze / silver / gold built as `tone_ramp` steps, plus one specular
  highlight shape. Locked state: desaturated (chroma × 0.1) + lock glyph, same silhouette.
- Ribbon or banner below for a number or level. Glyph centered on the optical center (slightly above geometric).

## Empty states & spot illustrations (120–240px)
- One metaphor (an empty inbox = open tray + paper plane), 2–3 brand colors plus a neutral.
- A ground shadow ellipse anchors the object (flat, 10–15% opacity, no blur).
- No text in the graphic: the UI copy sits below it.
- Keep it calmer than the content around it: lower chroma, no pure black.

## Onboarding series
- 3–5 frames, identical canvas and horizon line, each frame one action. The same character or object
  recurs across frames.

## Status & feedback
- Redundancy for color-blind users: shape + color + glyph (success = circle + check + green;
  warning = triangle + "!" + amber; error = octagon or circle + "×" + red).
- Sizes 16 / 20 / 24 / 48. The small ones follow the icon stroke rules (icons.md).

## Loaders & micro-animation
- Web: CSS or SMIL inside the SVG. Animate `transform`, `opacity`, `stroke-dashoffset` only. Loops ≤ 1.2s.
  Always add `@media (prefers-reduced-motion: reduce)` to stop or slow them.
- Draw-on checkmark: `stroke-dasharray = stroke-dashoffset = path length`, animate the offset to 0. Web only:
  Android drops dash arrays.
- Mobile: Lottie / Rive, or AnimatedVectorDrawable on Android. A static SVG shows frame 0.

## Stickers & emoji-style graphics
- White die-cut border = the same shape duplicated underneath with a wide white stroke
  (`stroke-linejoin="round"`). It's vector and works everywhere, unlike the morphology filter.
- Optional soft shadow: web only (filter), or a flat offset shape at 15% opacity everywhere.

## Backgrounds & patterns for app surfaces
- Subtle: ≤ 6% luminance contrast against the surface, so content stays readable.
- `<pattern>` is web-only. For mobile, generate a tile as plain paths and repeat it natively.

# Composition

## Grids
- **Base unit 8** (4 for details). Every size, gap and margin on the scale 4/8/12/16/24/32/48/64/96/128.
- **Column grid:** 12 columns for wide formats, 6 for cards, 4 for mobile. Gutter = 1–2 base units.
- **Modular grid:** columns × rows of equal modules for bento and posters. Elements span whole modules.
- **Baseline grid:** text baselines on multiples of the body leading (e.g. 24). Align headlines' cap height to a grid line.

## Margins by format
Icon 2/24 · card 24 (mobile) / 32 (web) · square social 1080: 80 · OG 1200: 64–80 · A-series poster: 8–10% of width ·
emblem/badge: 6–8% inner padding to the outer ring.

## Hierarchy (three levels, no more)
1. **Focal**: the one element seen first (largest, highest contrast, the accent color).
2. **Support**: headline or secondary shapes, about 40–60% of the focal weight.
3. **Detail**: labels, captions, texture, at low contrast.
Test: blur or squint at the gray thumbnail (`render.py --gray`). Exactly one thing should pop.

## Placement & balance
- Focal point on a thirds intersection or golden-ratio point, unless the style is symmetric (emblem, deco, mandala, icon).
- Asymmetric balance: a big quiet mass vs a small intense one. Symmetric: build half and mirror.
- Reading paths: **Z** for posters and cards (top-left → top-right → diagonal → CTA bottom-right), **F** for text-heavy pieces,
  **center-out** for emblems and icons.
- Negative space is an element. Calm and luxury styles use 50–70% empty; type-led posters can go to 80%.

## Alignment
- Align edges, not centers, for text blocks (left-aligned is default). Center only short, symmetric content.
- Optical corrections: round and pointed shapes overshoot flat ones by about 1–3% of size; center text by cap
  height; nudge triangles toward their visual center.

## Templates per artifact
| Artifact | Default structure |
|---|---|
| Poster | modular grid; headline top or bottom third; one visual mass; 8–10% margins |
| Card / social | Z-path: eyebrow → headline → support → CTA; visual right or bottom |
| Emblem / badge | concentric rings, text on arcs, center mark, strict symmetry |
| Icon set | 24 grid, 20 live area, keyline shapes, one stroke weight |
| Scene illustration | 3+ depth planes, focal subject on a thirds point, horizon off-center |
| Hero / cover | type-led: one oversized word plus a small precise detail |

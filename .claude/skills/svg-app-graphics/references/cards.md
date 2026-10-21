# Cards: promo, post, share, product

## Formats
| Card | Size (px) | Notes |
|---|---|---|
| In-app promo / upsell (mobile) | 343×176 (375pt screen − 2×16 margins), heights on the 8 grid | radius = app token (16–24) |
| Web feature / product card | 384×240, 400×280 | match the site grid |
| Open Graph / link share | 1200×630 | crawlers need **PNG/JPG**, not SVG |
| X large card | 2:1 (1200×600) | PNG/JPG |
| LinkedIn share | 1200×627 | PNG/JPG |
| Instagram feed | 1080×1080, 1080×1350 (4:5) | PNG/JPG |
| Story / reel cover | 1080×1920 | keep text out of the top and bottom ~14% (platform UI overlays) |

SVG is the **master**. Social platforms take raster: export with `wrap.py card.svg -o out --keep-size --png 1,2`
or `render.py card.svg -s 1200`.

## Anatomy: one message, four elements max
1. **Eyebrow** (optional): category / "NEW", small caps, tracked.
2. **Headline** ≤ 6 words, 2–2.5× the body size. One idea; numbers beat adjectives ("3× faster").
3. **Support** ≤ 12 words, 80–85% opacity of the headline color.
4. **One CTA** (pill or arrow) *or* one hero visual, plus at most one supporting glyph.

Margins: 24 on mobile cards, 64–80 on 1200-wide cards. Left-aligned text block on the grid; visual on
the right or bottom. Contrast: ≥ 4.5:1 body, ≥ 3:1 headline.

## Presentation devices (2026, pick one per card)
- **Oversized type**: one word or number fills 40–60% of the card.
- **Bento**: 3–5 tiles of real UI fragments (a chart, a toggle, an avatar row) showing the product.
- **Big stat**: number + unit + one-line context.
- **Gradient field + white glyph**: smooth OKLCH stops (`smooth_stops`), 1–2 translucent shapes for depth.
- **Neo-brutal**: flat loud color, 3px dark border, hard offset shadow (duplicate shape, no blur).
- **Extreme negative space**: one small precise element, 70%+ empty.
- **Grain / halftone**: social and marketing only, applied in the raster export (filters break mobile and cost render time).

## Construction rules
- **Clip decorations to the card shape.** Shapes that spill past rounded corners show on dark
  backgrounds. Web/iOS/RN: `clip-path` with the card's own rounded rect. Android: keep decor inside
  the shape (clips are dropped there).
- Text: outline it for static deliverables (`text_to_path`; measure the width and fit, never guess). For
  templated/dynamic cards (OG images per page), keep live text and render server-side with the
  font file supplied.
- Gradients in `userSpaceOnUse` (portable to Android; consistent across the card).
- Ship light and dark variants when the card sits inside the app UI.
- Series (carousel, campaign): one grid, one type scale, one palette. Vary only content and hero visual.

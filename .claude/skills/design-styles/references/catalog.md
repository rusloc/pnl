# Style Catalog

IDs are used in the Style Brief. **A-ids** are art/illustration styles whose SVG construction recipes live in
`svg-art-designer/references/styles.md` (same numbering). **G-ids** are graphic, brand and UI languages described here.

## A — Art & illustration (build: svg-art-designer styles.md)
A1 Flat editorial · A2 Layered landscape / paper-cut · A3 Mid-century modern · A4 Isometric · A5 Botanical ·
A6 Ukiyo-e inspired · A7 Watercolor · A8 Bauhaus / Swiss poster · A9 Art Deco · A10 Synthwave · A11 Risograph ·
A12 Halftone / pop art · A13 Monoline line art · A14 Engraving / hatching · A15 Flow field · A16 Topographic ·
A17 Low poly · A18 Stained glass · A19 Gradient aurora · A20 Mandala / sacred geometry

## G — Graphic, brand & UI languages
Format: **look** · signals · fits · avoid.

- **G1 Swiss / International**: strict grid, asymmetric balance, grotesk type, flat color, objective tone · fits identities, data, posters · avoid decoration.
- **G2 Neo-minimal calm**: off-white base (Cloud Dancer era), one quiet accent, large margins, soft radii, no texture · fits finance, health, productivity · avoid more than 2 accent uses per screen.
- **G3 Quiet luxury / serif revival**: high-contrast serif display, paper tones, hairlines, generous space, a metallic or deep accent · fits premium, editorial, AI and knowledge brands · avoid gradients and playful shapes.
- **G4 Editorial / zine**: magazine grid, big serif or condensed headlines, pull quotes, image crops, rules · fits content brands, reports, campaigns · avoid UI-ish components.
- **G5 Neo-brutalism**: thick black borders, hard offset shadows, flat loud fills, raw grotesk or mono, visible structure · fits dev tools, youth brands, landing promos · avoid soft shadows and gradients.
- **G6 Soft 3D / clay / plush**: rounded volumes, pastel gradients, soft ambient shading, friendly mascots · fits consumer apps, onboarding, fintech promos · avoid hairlines and dense detail.
- **G7 Glass (Liquid Glass era)**: layered translucent surfaces, light edges, depth over vivid backgrounds · fits Apple-platform-adjacent UI, overlays, hero art · avoid placing it on flat white (it disappears); mobile SVG cannot do real blur.
- **G8 Material Expressive**: morphing rounded shapes (squircle, scallop, pill), saturated tonal palettes, springy rhythm · fits Android-first products, playful utilities · avoid hard corners.
- **G9 Dopamine / maximal color**: saturated color blocking, clashing pairs on purpose, bold type, stickers · fits campaigns, social, youth · avoid long-lived system assets.
- **G10 Retro-futurism / Y2K**: chrome, iridescent gradients, bubbly or extended type, grids and orbs · fits music, fashion, events · avoid corporate contexts.
- **G11 Retro web / nostalgia**: OS windows, pixel icons, early-web chrome, playful skeuomorphic cues · fits community and dev brands · avoid accessibility regressions (tiny pixel text).
- **G12 Organic / anti-grid**: blob shapes, flowing layouts, hand-cut edges, earthy palette · fits wellness, sustainability, food · avoid strict UI grids inside the same piece.
- **G13 Dark luxe**: near-black warm base, metallic or jewel accent, thin rules, serif or extended sans · fits premium nights, finance, hospitality · avoid pure #000 and gray text below 4.5:1.
- **G14 Bento / modular**: content in rounded tiles of mixed sizes on a strict modular grid · fits product feature overviews, cards, dashboards-as-marketing · avoid more than 5–7 tiles.
- **G15 Imperfect by design**: hand-drawn marks, rough edges, grain, scribbles over clean layouts · fits creator brands, social, campaigns · keep functional UI clean; use it as a modifier only.
- **G16 Type-led / kinetic (static)**: one oversized word as the visual, stretched or distorted display type, extreme negative space · fits posters, social, covers · avoid more than one typeface per piece.

## Fading / avoid by default
- **Corporate Memphis** (flat purple people with tiny heads): reads as dated stock.
- **Neumorphism**: low-contrast extruded UI that fails accessibility.
- **Text inside icons**, drop-shadow-everything, rainbow gradients without a hue strategy.

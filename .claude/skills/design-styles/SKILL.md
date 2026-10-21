---
name: design-styles
description: Style direction for visual work. Turns a request into a decided style, palette, typography and composition, delivered as a five-line Style Brief that the build skills (svg-art-designer, svg-app-graphics) execute. It covers selecting a style from purpose, audience, tone and lifespan, a catalog of 36 art and graphic/brand/UI styles, role palettes with verified contrast, 2026 color, type and brand trends, open-licensed font pairings (fetched and outlined, with Turkish and other latin-ext support) and grid/hierarchy rules. Use whenever someone asks for a look, style, mood, palette, fonts, font pairing, color scheme, art direction or "make it look modern/premium/playful", and before designing any illustration, poster, emblem, icon set, card or other graphic.
compatibility: Python 3 with fontTools and Pillow. Scripts reuse the svg-art-designer skill (svgkit, render.py) installed alongside. get_font.py needs network access to registry.npmjs.org (Fontsource fonts).
---

# Design Styles

This skill decides **what it looks like**; the build skills decide **how it is made**. The output is always
one **Style Brief**: five lines, concrete values, no adjectives without numbers.

```
SUBJECT  <what> for <audience>; purpose <inform|sell|delight|identify|navigate>; lifespan <campaign|system>
STYLE    <catalog id + name> (+ one modifier) · mood <3 words> · build <svg-art-designer A# | svg-app-graphics>
PALETTE  bg #… surface #… ink #… muted #… accent #… [accent2 #…] · checks PASS [accent FILL-ONLY]
TYPE     display <Family Weight> · text <Family Weight> · scale <ratio> · subsets latin[+ext]
CANVAS   <W×H unit> · grid <base>/<cols>/<margin> · stroke <scale> · composition <template + focal point>
```

## Workflow
1. **Intake** (`references/selection.md`): purpose, audience, medium/targets, brand assets, tone words,
   lifespan. Infer from the request; ask only when a blocking fact is missing (brand colors, required text).
2. **Choose one style + at most one modifier** (`references/catalog.md`). Existing brand assets override trends.
   App targets must survive the strict platform subset (svg-app-graphics).
3. **Palette:** start from the brand color or a curated palette (`references/color.md`), then run
   `python scripts/style_board.py --brand "#hex" --display "Family:wt" --text "Family:wt" -o board/` and
   **view board/board.png**. Zero FAIL; note FILL-ONLY accents in the brief.
4. **Type:** a pairing from `references/typography.md`. Fonts come via `scripts/get_font.py` /
   `get_fonts()`; use `latin-ext` for any non-English text.
5. **Composition:** grid, margins, hierarchy and template from `references/composition.md`.
6. **Write the brief**, then hand off to svg-art-designer (art, posters, emblems) or svg-app-graphics (app graphics).

## Rules
- One style, one modifier, one accent. Restraint is the default; expressiveness must be chosen on purpose.
- Every color has a role, and every text pair is ≥ 4.5:1. Accents under 3:1 on bg are fill-only.
- Two typefaces maximum (+ mono for code). Display gets personality; text stays invisible.
- Every number sits on the grid scale (4/8/12/16/24/32/48/64…).
- Trends shape execution, never the concept. Long-lived assets get at most one trend accent (`references/trends-2026.md`;
  re-search if the file is older than ~6 months).

## References
| Read | When |
|---|---|
| `references/selection.md` | intake questions, tone → attributes table, purpose → shortlist, decision rules |
| `references/catalog.md` | style IDs (A1–A20 art styles built by svg-art-designer, G1–G16 graphic/brand/UI languages) |
| `references/color.md` | role palettes, contrast thresholds, hue physics, 2026 color climate, 8 verified palettes |
| `references/typography.md` | getting fonts, pairing rules, 17 verified pairings, open alternatives, scale and tracking |
| `references/composition.md` | grids, margins per format, hierarchy, balance, reading paths, templates per artifact |
| `references/trends-2026.md` | brand, graphic and type climate with sources |

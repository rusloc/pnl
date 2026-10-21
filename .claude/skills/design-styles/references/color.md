# Color for Style Briefs

## Role palette (what the brief lists)
`bg` (60%) · `surface` + `ink` (30%) · `accent` (≤10%, the focal action) · optional `accent2` (≤5%)
· `muted` (secondary text) · `on_accent` (text on accent fills). Neutrals are tinted with the brand hue,
never pure grey.

**Generate and check:** `python scripts/style_board.py --brand "#hex" [--mode dark] [--scheme split|analogous|triadic|complementary] -o board/`
writes `palette.json` + `board.png` (swatches, 60/30/10 bar, contrast checks, type specimen). Always view the board.

## Contrast rules the board enforces
- Text pairs (ink/bg, ink/surface, muted/bg, on_accent/accent): **≥ 4.5:1 or FAIL.**
- Accent vs bg: **≥ 3:1** → usable for icons, thin lines and text-sized graphics. Below 3:1 → **FILL-ONLY**:
  large fills carrying `on_accent` text, never text or thin lines on bg. This is a usage rule, not an error
  (a yellow button with dark text is fine).
- Measured in OKLCH (chroma ≈ 0.13): **L ≤ 0.55 holds ≥ 4.5:1 with white text at every hue**; L ≤ 0.65 holds ≥ 3:1.
  Pastels at L ≥ 0.80 take dark text (≥ 8.8:1).
- Blues and violets sit right at the edge: `#2f6bff` with white measures 4.499:1. It rounds to "4.5" but fails, so go one step darker.

## Hue physics to respect
- **Yellow family (≈ 60–115°) turns brown or olive when dark.** Use yellows light (L ≈ 0.85) as fills with dark
  text. style_board derives accent2 that way automatically.
- Dark mode: lift accents to L ≥ 0.70 and drop chroma if gamut-clipped. Bg is L ≈ 0.17 tinted, never #000;
  ink is L ≈ 0.95, never #fff.

## 2026 color climate (Oct 2026)
- **Pantone Color of the Year 2026: Cloud Dancer (11-4201)**, the first white ever chosen. It is framed as a calm,
  structural "blank canvas" base. Practical reading: warm off-white grounds, quiet palettes, accent restraint.
  Pantone values target print and textiles; screen approximations vary, so pick the exact off-white in OKLCH (L ≈ 0.95, C ≤ 0.012, warm hue).
- Branding leans **earthy and organic**. Teal and deep green are notable picks among 2026 color forecasts.
- In parallel, social and youth work runs **saturated dopamine color**. Choose by audience, not by trend headlines.

## Curated palettes (contrast verified)
| Name | bg | surface | ink | muted | accent | accent2 | Notes |
|---|---|---|---|---|---|---|---|
| Cloud Calm | `#f0eee9` | `#faf9f6` | `#22201c` | `#6b675f` | `#3f6f6a` | `#c9b79c` | accent2 fill-only (dark text) |
| Serif Paper | `#f4efe6` | `#fbf8f2` | `#1d1b19` | `#655f56` | `#b5523b` | `#2f4a6d` | quiet luxury / editorial |
| Transformative Teal | `#eef4f3` | `#ffffff` | `#0f2a2c` | `#4d6466` | `#0f6e6e` | `#e98a5d` | accent2 fill-only |
| Dopamine Pop | `#fff7ef` | `#ffffff` | `#1a1033` | `#5c5470` | `#ff3d7f` | `#2b5ff5` | accent takes dark text |
| Earth Organic | `#efe8dc` | `#f8f4ec` | `#2a2219` | `#6e6250` | `#8a5a2b` | `#5f7240` | |
| Neo-Brutal | `#fffbe6` | `#ffffff` | `#111111` | `#4a4a4a` | `#ff5c39` | `#6e52f5` | accent fill-only + black borders |
| Liquid Light | `#eef2f8` | `#ffffff` | `#121826` | `#566074` | `#2a62f0` | `#9fd3ff` | accent2 fill-only |
| Dark Luxe | `#0e0d0c` | `#1a1816` | `#f2ede4` | `#a39c90` | `#c9a24a` | `#7e8f7a` | text on gold = bg color |

All pass every text check (ink/bg 12.9–18.2:1, muted/bg ≥ 4.85:1, on-accent ≥ 4.96:1). More scene and illustration palettes:
`svg-art-designer/references/color.md` (16 palettes, sky gradients).

---
name: svg-app-graphics
description: Design and wrap small SVG graphics for web and mobile apps, such as UI icons and icon sets, app icons and favicons, avatars (initials, generated, entity), in-app promo cards, product, post and share cards, badges, empty states, onboarding spots, status graphics, loaders and stickers. Punchy, minimal, pixel-snapped artifacts that present one idea or product cleanly, following researched 2026 trends (soft 3D vs hyper-minimal, Liquid Glass, Material 3 Expressive). Ships app-ready formats with a platform audit; the delivery formats are React and React Native components, sprites, CSS mask icons, Android VectorDrawable, iOS imagesets and PNG @1x/2x/3x. Use whenever the user wants an icon, avatar, card, badge or any small graphic for an app or website, or wants SVGs wrapped or converted for web, iOS, Android, React Native or Flutter. Not for standalone art pieces, posters or illustrations as files; use svg-art-designer for those.
compatibility: Requires the svg-art-designer skill (svgkit, render.py) installed alongside. Python 3 with lxml and Pillow. Optional svgo (npm i -g svgo) for optimization and svg2vectordrawable (npm i -g svg2vectordrawable) for Android.
---

# SVG App Graphics

Small graphics live inside products: at 16–343px, beside text, in light and dark themes, on five
rendering stacks. Here **less is the craft**: one idea per graphic, few shapes, an exact grid,
crisp at 1×, and identical everywhere it ships.

Build with `svgkit` from svg-art-designer (geometry, OKLCH color, `text_to_path`). Package with
`scripts/wrap.py` from this skill.

## Rules
1. **One idea, one focal element.** If a graphic needs explaining, cut until it doesn't.
2. **Grid and pixel snap.** Icons on 24 (live area 20), cards and avatars on the 8 grid. Even stroke
   widths on integers, odd widths on `.5` coordinates. Verify in the 8× zoom of `wrap.py --sheet`.
3. **Design to the strictest target.** The strict subset renders the same on web, iOS, Android, RN and Flutter:
   paths and shapes, solid fills, per-shape opacity, `userSpaceOnUse` gradients, outlined text. No
   filters, masks, clips, dashes, `<style>` or group opacity unless every target supports them (platforms.md).
4. **Theme-ready.** Monochrome art uses `currentColor`. Ship dark variants of multi-color art. Check
   contrast (`svgkit.contrast_ratio`): glyphs ≥ 3:1, text ≥ 4.5:1.
5. **One trend direction per product** (trends-2026.md), applied consistently across the whole set or series.
6. **Real-size review.** Judge at the sizes users see (16/24/48, 343-wide cards), never only enlarged.

## Workflow
1. **Classify** the artifact and read its reference (table below), plus `trends-2026.md` to pick the direction.
2. **Brief** in ≤ 4 lines: artifact, targets (web/ios/android/rn/flutter), size + grid, palette (hex), direction.
3. **Build** a small svgkit generator (grid constants, `snap()`, outlined text) and save the SVGs.
4. **Review:** `python scripts/wrap.py *.svg --sheet` (light/dark, real sizes, 8× pixel zoom). Fix and repeat.
5. **Audit + wrap:** `python scripts/wrap.py *.svg -o dist --targets <targets> [--current-color] [--png 1,2,3]`.
   Zero ERRORs. Then report the files, targets, and any WARN the user should know.

## References
| Read | When |
|---|---|
| `references/trends-2026.md` | choosing the visual direction; check its date and re-search if stale |
| `references/icons.md` | UI icons, icon sets, optical sizes, app icons, favicons |
| `references/avatars.md` | initials, generated and entity avatars, status, stacks, accessible colors |
| `references/cards.md` | promo, product, social post, OG/share cards, sizes, anatomy |
| `references/small-graphics.md` | badges, empty states, onboarding, status, loaders, stickers, patterns |
| `references/platforms.md` | what renders where (tested Android conversion results, Flutter, RN, iOS, web embedding) |
| `references/wrapping.md` | `wrap.py` flags, output map, which format to ship, verification |

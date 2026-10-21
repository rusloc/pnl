# Platform Support for App SVGs

**Rule: design to the strictest target in the delivery list.** `wrap.py --audit --targets ...`
checks a file against these rules.

## Strict subset: renders the same on web, iOS, Android, React Native, Flutter
`<svg viewBox>`, `<path>` and basic shapes, `<g>` (no opacity), solid hex fill/stroke,
`fill-opacity` / `stroke-opacity` on shapes, `fill-rule`, caps/joins, linear/radial gradients
with `gradientUnits="userSpaceOnUse"`, outlined text. Everything else is a per-platform decision.

## Android: VectorDrawable (behavior tested with svg2vectordrawable)
| SVG feature | Result after conversion |
|---|---|
| `stroke-dasharray` | dropped: renders a **solid** line |
| `currentColor` | becomes black: use `android:tint` (wrap.py adds `?attr/colorControlNormal` for monochrome) |
| `<mask>` | silently dropped |
| `filter` | the filtered element is **dropped entirely** |
| `clip-path` on a group | ignored: content not clipped |
| `<g opacity>` | the group's content **disappears**: put opacity on each shape |
| `<text>` | dropped: outline it |
| bbox-unit gradient | wrong coordinates: use `userSpaceOnUse` |
| `userSpaceOnUse` gradient | correct (Android API 24+) |
| skew / transforms | baked into path data: fine |

## Flutter: flutter_svg (documented)
- `<style>` is not implemented: use presentation attributes (wrap.py runs `convertStyleToAttrs`).
- Filters are not rendered; text support is partial, so outline it.
- Tint monochrome icons with `colorFilter: ColorFilter.mode(c, BlendMode.srcIn)`, or set `currentColor`
  through `SvgTheme`. Precompile with `vector_graphics_compiler` for speed.

## React Native: react-native-svg (documented)
- Components map 1:1 (wrap.py emits `<Name>.native.tsx`). `currentColor` follows the `color` prop.
- `<style>` needs `SvgCss`; inline attributes instead. Filters are partial, so avoid them.

## iOS: Xcode asset catalog (not verified here, stay in the strict subset)
- SVG in an `.imageset` with "Preserve Vector Data". Monochrome → `template` rendering, tinted by
  `.foregroundStyle` / `tintColor` (wrap.py writes Contents.json accordingly).
- App icons: Icon Composer from flat SVG layers (icons.md).

## Web (inline, `<img>`, CSS)
| Embedding | currentColor / CSS vars | Animation | Notes |
|---|---|---|---|
| Inline `<svg>` / React component | ✓ inherits from page | ✓ | ids must be unique per page (wrap.py prefixes them) |
| `<img src>` / `<use href="sprite#id">` | `<img>` ✗ / sprite `<use>` ✓ | `<img>` ✓ | `<img>`: no scripts, no external loads |
| CSS `background` data URI | ✗ (always black) | ✓ | multi-color art only |
| CSS `mask` + `background-color: currentColor` | ✓ follows text color (verified) | — | best for monochrome icon fonts-in-CSS |

## Theming patterns that survive everywhere
- Monochrome: `currentColor` (web, RN, Flutter SvgTheme), tint (Android), template (iOS).
- Two-tone: second tone = same color at `fill-opacity .3` on the shape.
- Multi-color brand art: ship light and dark variants. Don't rely on CSS vars outside inline web SVG.

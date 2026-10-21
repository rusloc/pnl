# Wrapping: packaging small graphics for apps

`scripts/wrap.py` audits every file against the chosen targets first (exit 1 on ERROR), then packages it.

```bash
W=<skill>/scripts/wrap.py
python $W icons/*.svg --sheet --sizes 16,20,24,32,48         # review: real sizes, light/dark, 8x pixel zoom
python $W icons/*.svg --audit --targets android,flutter      # what breaks where
python $W icons/*.svg -o dist --targets web,react,rn,android,ios --current-color --png 1,2,3
python $W card.svg -o dist --targets web,react --keep-size --png 1,2
python $W logo.svg -o dist --favicon --bg "#5b3df5"
```

## Output map
| Flag / target | Files | Use it as |
|---|---|---|
| (always) | `<name>.svg` | svgo-optimized, ids prefixed with the file name, no width/height unless `--keep-size` |
| `web` | `sprite.svg`, `icons.css` | `<svg><use href="sprite.svg#home"/></svg>`; `<span class="i-home">` (CSS mask, follows text color) |
| `react` | `<Name>.tsx` | `<Home size={20} title="Home" className="..." />` |
| `rn` | `<Name>.native.tsx` | `<Home size={24} color={theme.text} />` (react-native-svg) |
| `android` | `android/<name>.xml` | `@drawable/home`; monochrome gets `android:tint="?attr/colorControlNormal"` |
| `ios` | `ios/<Name>.imageset/` | drag into Assets.xcassets; `Image("Home")`, template mode when monochrome |
| `flutter` | (audit only) | `SvgPicture.asset('assets/home.svg', colorFilter: ColorFilter.mode(c, BlendMode.srcIn))` |
| `--png 1,2,3` | `png/<name>.png @2x @3x` | social posts, email, OG images, legacy pipelines |
| `--favicon` | ico, svg, apple-touch, 192/512, maskable, `head.html`, manifest | web app icons |
| `--current-color` | — | turns single-color art into `currentColor`; multi-color art is left untouched |

## Choosing the format
- Icon set in a web app → React components (tree-shaken) or a sprite (cached, many icons per page).
- Icons in CSS-only contexts → `icons.css` mask classes.
- Brand or multi-color art on the web → `<img src=…svg>`.
- Native apps → VectorDrawable / imageset. Cross-platform → RN component / flutter_svg asset.
- Anything leaving the app (social, email, stores) → PNG at 2×.

## Verify before handing over
1. `--sheet`: every icon crisp at 24 in the 8× zoom (straight 2px strokes show no grey smear), and readable at 16/20.
2. `--audit` clean for every target in scope.
3. Generated `.tsx` type-checks in the project (`tsc --noEmit`); VectorDrawables preview in Android Studio.
4. Social exports: open the PNG at 100% and check text crispness and safe zones.

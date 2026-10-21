# Typography

## Getting fonts (verified)
All families below exist on Fontsource (npm), are **OFL-1.1**, and include `latin-ext` (Turkish, Polish, Czech…).
```python
import sys; sys.path.insert(0, "<design-styles>/scripts"); from get_font import get_fonts
display = get_fonts("Fraunces", 600)               # [latin.woff, latin-ext.woff]: a fallback chain
d, w = text_to_path("Güneşli Başlık", display, 64, x, y, anchor="middle")   # svgkit (svg-art-designer)
```
- `python scripts/get_font.py "Family" --list` shows weights, italics and license.
- svgkit applies GPOS pair kerning (outline width within 0.25% of Chromium live text in testing). **Ligatures
  and complex shaping are not applied.** Prefer display text without fi/fl ligature dependence.
- Symbols such as `≥ → ✓ ★` are usually **not** in text subsets. svgkit warns "no glyph … .notdef"; draw
  them as shapes or rephrase. Never ship a warning.
- Outlined OFL glyphs in artwork are fine. Keep the font name in the brief so the piece can be re-set.

## Pairing rules
- **One display + one text face**, or one superfamily in two weights. A third face only for code (mono).
- Pair by **contrast of form, harmony of proportion**: serif display + humanist/grotesk text; similar x-height.
- Display carries personality; text stays invisible. Body never below 400 weight, never condensed.
- Weight contrast ≥ 300 between display and text (e.g. 700 / 400).

## Pairings by tone (all verified available)
| Tone / style | Display | Text | Notes |
|---|---|---|---|
| Quiet luxury, serif revival (G3) | Fraunces 600 | Inter 400 | warm paper bg |
| Editorial (G4) | Playfair Display 700 | DM Sans 400 | big italic pull quotes |
| Literary calm (G2/G3) | Instrument Serif 400 | Instrument Sans 400 | italics for emphasis |
| Knowledge / AI brand | Newsreader 500 | Geist 400 | Geist Mono for data |
| Classic premium | Cormorant Garamond 600 | Manrope 400 | tracked caps for labels |
| Dark luxe (G13) | Bodoni Moda 600 | Hanken Grotesk 300 | caps +10% tracking |
| Swiss / technical (G1) | Inter 700 | Inter 400 | one family, strict scale |
| Precise tech | Geist 600 | Geist Mono 400 | IBM Plex Sans + Plex Mono is the alternative |
| Friendly startup | Plus Jakarta Sans 700 | Figtree 400 | |
| Playful / soft (G6) | Fredoka 600 | Nunito 400 | rounded terminals ("smooth it over") |
| Quirky grotesk | Bricolage Grotesque 700 | DM Sans 400 | |
| Neo-brutal (G5) | Archivo Black 400 | Space Mono 400 | or Space Grotesk 700 + JetBrains Mono |
| Extended / futuristic (G10) | Unbounded 700 | Onest 400 | Syne 800 + Hanken Grotesk is the alternative |
| Condensed impact poster | Bebas Neue 400 | Work Sans 400 | Anton or Big Shoulders Display also fit |
| 70s retro | Shrikhand 400 | Outfit 400 | Young Serif for a calmer retro |
| Mono-futurist | Rubik Mono One 400 | Sora 400 | |
| Handwritten accent | Caveat 600 | (any) | accents only, never body |

## Proprietary → open alternatives
Helvetica / SF → Inter, Public Sans, Geist · Futura → Outfit, Lexend · Circular / Gotham → Plus Jakarta Sans, Figtree ·
Akzidenz / Neue Haas → Schibsted Grotesk, Hanken Grotesk · Canela / GT Sectra / Tiempos → Fraunces, Newsreader,
Source Serif 4 · Didot / Bodoni → Bodoni Moda, Playfair Display · Garamond → EB Garamond, Cormorant Garamond ·
Impact → Anton · Menlo / SF Mono → JetBrains Mono, IBM Plex Mono.

## Scale, spacing, measure
- Ratio by medium: 1.2 dense UI · 1.25 app · 1.333 marketing/cards · 1.5 posters · 1.618 editorial covers.
- Tracking (svgkit `letter_spacing` is in units = % × font size): display ≥ 48px → −1 to −3%; ALL CAPS
  labels → +6 to +12%; body → 0.
- Leading: display 1.0–1.15, body 1.4–1.6. Measure 45–75 characters.
- Numbers: tabular figures matter in tables; in display, kern the numerals and check "1" spacing visually.

## 2026 type climate (Oct 2026)
Serif revival (warmth and trust; notably AI and knowledge brands on paper-like grounds) · bold extended and
condensed display · softened, rounded letterforms · type as the main graphic · expressive distortion in
music, fashion and street brands · monospace for tech · humanist warmth against AI sameness.

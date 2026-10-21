# Color & Light for SVG Art

## Contents
1. Palette strategy
2. Value structure first
3. Light, temperature & hue shifting
4. Working in OKLCH with svgkit
5. Curated palettes (starting points)
6. Sky & atmosphere gradient recipes
7. Overprint & blend math

---

## 1. Palette strategy

- **Few colors, used deliberately.** 3–6 hues plus tinted neutrals. Distribute them roughly **60 / 30 / 10**: a dominant field, a supporting color, and an accent reserved for the focal point. An accent used everywhere stops being an accent.
- **Tinted neutrals, never pure black, white or grey.** Darks are deep navy, plum, forest or umber (`#14122b`, `#1f2d1c`); lights are cream, bone or ice (`#f4efe6`, `#eef4f7`). Pure `#000` looks like a hole and pure grey looks dead.
- **One hue family per light condition.** A golden-hour scene pulls everything toward orange and violet; a moonlit scene toward blue and teal. Shift every local color toward the light color (`mix(local, light, .15–.3)`). That shared bias is what makes a palette feel unified.
- **Saturation is a spotlight.** Peak chroma goes at the focal point and along the light-to-shadow boundary (the terminator). Desaturate the periphery and the distance.
- **Limit what touches.** Strong complements side by side vibrate. Separate them with a neutral or a value step unless you want vibration (op-art, psychedelic posters).

## 2. Value structure first

Color gets the credit, but value (light/dark) does the work. Plan values before choosing hues.

- **Squint test:** `render.py art.svg --gray` writes a small grayscale thumbnail and prints the dark/mid/light distribution. A strong image reads clearly as a thumbnail, with the focal point at the highest local contrast.
- Pick an uneven split, e.g. 60% mid, 25% dark, 15% light, or a dominant-dark nocturne. An even 33/33/33 split looks muddled.
- Group values into large connected masses. Scattered light and dark spots fragment the image.
- **Atmospheric depth = value compression:** near layers span the full value range, far layers only a narrow band close to the sky's value.
- Check text/foreground legibility with `contrast_ratio(a, b)`: ≥ 4.5 for small text, ≥ 3 for large display type.

## 3. Light, temperature & hue shifting

- **Warm light → cool shadows; cool light → warm shadows.** Shade a color by darkening *and* rotating its hue toward violet-blue (sunlit scenes); highlights rotate toward yellow. The rotation direction depends on the base hue (always take the shorter arc), which `tone_ramp` handles.
- **Ramps for flat shading:** `tone_ramp(base, 5)` returns dark→light steps with even OKLCH lightness, slightly reduced chroma at the ends, and hues pulled toward a cool shadow hue (violet-blue, 285°) and a warm light hue (yellow, 95°) along the *shorter* arc. Orange shadows therefore go toward red-violet, and blue shadows toward indigo. For moonlight or overcast scenes reverse it: `tone_ramp(base, 5, shadow_hue=40, light_hue=220)`.
- **Shadow color = ambient color.** Outdoors the sky fills the shadows (bluish). Indoors or at sunset, the surroundings bounce warm light. Tint `shadow_filter` floods and cast-shadow fills with this, never with black.
- **Glow color:** a light source's halo is its own hue at low opacity, but the core is near-white (`lighten(c, .3)`, reduced chroma). Saturated cores look fake.
- **Night scenes:** keep darks above L≈0.12 (`oklch(.15, .04, 270)`) so details survive. Light sources become the high-chroma accents.

## 4. Working in OKLCH with svgkit

OKLCH = Lightness (0–1), Chroma (0–~0.37), Hue (degrees). Equal steps in L *look* equal, unlike HSL, where yellow at 50% lightness is far brighter than blue at 50%.

```python
oklch(0.72, 0.15, 250)            # build any color directly; out-of-gamut chroma is reduced automatically
to_oklch("#e76f51")               # -> (L, C, h)
harmony("#e76f51", "split")       # analogous | complementary | split | triadic | tetradic | shades
ramp(["#264653", "#e9c46a"], 7)   # 7 evenly spaced colors (OKLab: calm, even)
ramp(["#1e6bff", "#ff8a00"], 7, "oklch")   # around the hue wheel: vivid, no grey middle
lighten(c, .1); darken(c, .1); saturate(c, 1.2); hue_shift(c, -15)
tone_ramp(c, 5)                   # dark->light shading steps with temperature shift
mix(a, b, .3, "oklab"|"oklch")
smooth_stops(["#0b1026", "#7b2d8e", "#ff7b54", "#ffd36e"])   # gradient stops without sRGB mud
```
- **Same hue, same L, different chroma** gives a sophisticated, tonal palette. **Same L, different hues** gives a balanced, "designed" palette where nothing jumps out.
- For a palette that harmonizes automatically, fix C in a band (e.g. 0.08–0.14) and vary L and h.

## 5. Curated palettes

Roles: **bg** (dominant field), **dk** (darkest tinted neutral), **mid**, **lt**, **acc** (accent). Use them as starting points, then bias them toward the scene's light.

| Name | bg | dk | mid | lt | acc | Mood / use |
|---|---|---|---|---|---|---|
| Golden Hour | `#f6d6a8` | `#1b1f3b` | `#a14a6b` | `#ffe7b8` | `#f08a5d` | warm dusk landscapes |
| Nordic Fjord | `#cfe3e8` | `#0e1a2b` | `#406e8e` | `#eef6f7` | `#e07a5f` | cold, calm, minimal |
| Mid-Century | `#f2e3c6` | `#1f2a2c` | `#3e5c5a` | `#fbf3e2` | `#e0a458` | MCM posters, travel art |
| Risograph | `#f3ead8` | `#3d5588` | `#ff48b0` | `#ffe800` | `#00a95c` | print-look, zines (real riso ink colors) |
| Synthwave | `#0d0221` | `#261447` | `#f6019d` | `#2de2e6` | `#ff9e00` | outrun, neon, retro-future |
| Forest Floor | `#e8e0c8` | `#1f2d1c` | `#3b5a33` | `#d9c27a` | `#b9542f` | woodland, botanical |
| Art Deco | `#0b0b0f` | `#1d2b3a` | `#3f6f6a` | `#e9dcc0` | `#c9a24a` | gold-on-dark luxury, Gatsby |
| Bauhaus | `#f4efe6` | `#111111` | `#1d4e89` | `#ffffff` | `#d62828` | + `#f2c14e`; geometric posters |
| Ukiyo-e | `#f1e7d0` | `#2a3f5f` | `#6d8fb1` | `#fbf6ea` | `#c8553d` | waves, Mt Fuji, woodblock |
| Pastel Dream | `#fbe7e3` | `#3e3a5c` | `#b8d8e0` | `#fff8f5` | `#f6a6b2` | soft, children's books, dreamy |
| Aurora | `#04080f` | `#0b2545` | `#13315c` | `#c8fff4` | `#00f5d4` | + `#9b5de5`; northern lights, cosmic |
| Terracotta | `#f4e9df` | `#2f3e46` | `#b5523b` | `#fff7ef` | `#d7816a` | Mediterranean, earthy modern |
| Deep Ocean | `#caf0f8` | `#03045e` | `#0077b6` | `#e9fbff` | `#00b4d8` | underwater, nautical |
| Autumn | `#f3dfc1` | `#2b1d16` | `#7f2f13` | `#ffd5a5` | `#f28f3b` | harvest, cozy |
| Ink & Vermilion | `#f5f1e8` | `#2b2722` | `#6e6658` | `#c9c2b3` | `#c1121f` | monochrome + one red: stamps, sumi-e |
| Tropical | `#fff4d6` | `#073b3a` | `#0b6e4f` | `#f7b538` | `#db7c26` | jungle, travel posters |

## 6. Sky & atmosphere gradient recipes

Vertical `linearGradient` (`x1=0 y1=0 x2=0 y2=1`), top → horizon. Run them through `smooth_stops(colors)` for vivid transitions, and add grain at ≈ .1 to prevent banding.

| Time | Stops (top → horizon) |
|---|---|
| Pre-dawn | `#0b1026` → `#2b2f77` → `#7a5ca8` → `#e8a0a8` |
| Sunrise | `#3a6ea5` → `#9fc5e8` → `#ffd6a5` → `#ff9e7a` |
| Midday | `#2c7be5` → `#6fb1fc` → `#cfe8ff` |
| Golden hour | `#4a3b78` → `#c46a8b` → `#ff9e6d` → `#ffd88a` |
| Sunset | `#1b1f3b` → `#5b2a6e` → `#d1495b` → `#f79d5c` → `#ffd166` |
| Dusk / blue hour | `#0a0f2c` → `#1f2e6b` → `#4f5fa8` → `#b48ead` |
| Night | `#02030a` → `#0a1230` → `#17234f` |
| Storm | `#2f3640` → `#57606f` → `#a4b0be` |
| Underwater | `#c8f2ff` (top) → `#00a6c7` → `#035f8a` → `#011f3a` |

- Put the **sun/moon glow** as a separate large radial gradient (light color at opacity .5 → 0) centered on the light source, layered above the sky.
- **Horizon band:** the sky is lightest *just above* the horizon. Distant mountains take that band color mixed with their own.
- **Ground/water mirrors the sky:** water reflects the sky colors flipped, slightly darker and more saturated.

## 7. Overprint & blend math

For print-look art that renders identically everywhere, compute overlap colors instead of relying on `mix-blend-mode`:
```python
multiply("#ff48b0", "#0078bf")   # two inks overprinting  -> darker, like real riso/screenprint
screen("#2de2e6", "#f6019d")     # two lights overlapping -> brighter
```
Draw the overlap explicitly: the second shape clipped by the first, filled with the computed color. Then offset one ink layer by 2–4 units for misregistration.

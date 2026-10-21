# Filter Cookbook

Every recipe here was rendered in Chromium, resvg and librsvg and looks the same in all three. Copy them as they are, then tune the marked parameters. `svgkit.py` has builder functions for the most common ones (`grain_filter`, `shadow_filter`, `glow_filter`, `rough_filter`, `watercolor_filter`, `paper_filter`, `inner_shadow_filter`, `gooey_filter`, `blur_filter`).

## Contents
1. Rules that prevent 90% of filter bugs
2. Shadows & depth: drop shadow, inner shadow, bevel/emboss
3. Light: glow, neon
4. Texture: grain, paper, clouds/fog (and why not marble)
5. Edges: rough/hand-cut, watercolor, gooey, sticker outline
6. Color: posterize, duotone, misregistration
7. When NOT to use a filter

---

## 1. Rules

**Set the filter region explicitly.** By default the region is the element's bounding box plus 10% on each side. Glows, shadows and displacement that extend further are cut off along a hard, square edge. Use `x="-30%" y="-30%" width="160%" height="160%"` (more for big blurs), or for canvas-wide effects `filterUnits="userSpaceOnUse" x="0" y="0" width="W" height="H"`.

**Always add `color-interpolation-filters="sRGB"`.** The default (linearRGB) makes color matrices, flood colors and lighting come out lighter or darker than the hex values you wrote.

**Make noise opaque before displacing.** `feTurbulence` outputs noise in its alpha channel too. Engines disagree about premultiplying it, and resvg shifts the whole displaced shape down and to the right. Always insert:
```xml
<feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="opaqueNoise"/>
```

**Texture overlays must degrade to invisible.** Put canvas-wide textures (grain, clouds) on `<rect ... fill="#000" fill-opacity="0" filter="url(#x)"/>`. Renderers without filter support then show nothing, rather than an opaque sheet on top of your art. Do not use `fill="none"`: resvg skips unpainted elements, so the effect vanishes.

**One filter per group, not per element.** 300 filtered stars render slowly; one `<g filter>` around them is fast.

**Cost order** (cheap → expensive): color matrix / component transfer < offset / merge / composite < small blur < turbulence (∝ numOctaves × area) < large blur < lighting < displacement over large areas. Keep `numOctaves` ≤ 5. If a preview takes more than about 3 s, simplify.

**Noise scale:** `baseFrequency` is in cycles per user unit. On a 1000-unit canvas, 0.002–0.01 gives clouds/landforms, 0.02–0.06 gives paper and watercolor, and 0.6–1.2 gives grain. Two values (`"0.002 0.02"`) stretch the noise: horizontal streaks for fog, wood or water.

**Seed for variety.** Use a different `seed` per instance, otherwise repeated shapes get identical edge wobble.

---

## 2. Shadows & depth

### Drop shadow (portable chain)
`feDropShadow` is not supported by Illustrator or older tools, so use this chain instead. Tint the shadow with a dark color from the scene, never pure black.
```xml
<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>          <!-- softness -->
  <feOffset dx="0" dy="12" result="b"/>                           <!-- light from above -->
  <feFlood flood-color="#2a1f3d" flood-opacity="0.35"/>          <!-- tinted shadow -->
  <feComposite in2="b" operator="in"/>
  <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```
Layered "real" shadow: stack two of these, a tight dark one (blur 2, dy 2, opacity .3) and a wide soft one (blur 18, dy 16, opacity .2), as two chains merged in one filter.

### Inner shadow (inset, carved, pressed)
```xml
<filter id="inner" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feOffset in="SourceAlpha" dx="0" dy="6"/>
  <feGaussianBlur stdDeviation="6" result="o"/>
  <feComposite in="SourceAlpha" in2="o" operator="arithmetic" k2="-1" k3="1" result="rim"/>
  <feFlood flood-color="#000" flood-opacity="0.5"/>
  <feComposite in2="rim" operator="in" result="sh"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/></feMerge>
</filter>
```

### Bevel / emboss (specular lighting on blurred alpha)
Gives glossy, buttony, enamel-pin or embossed-metal relief. Light comes from the top-left (`azimuth="225"`).
```xml
<filter id="bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>          <!-- bevel width -->
  <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.9" specularExponent="20"
                      lighting-color="#ffffff" result="spec">
    <feDistantLight azimuth="225" elevation="45"/>
  </feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
  <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k2="1" k3="0.8"/>
</filter>
```
Higher `specularExponent` gives a tighter, shinier highlight. Lower `surfaceScale` gives a flatter result. For gold, apply to a gold gradient fill.

---

## 3. Light

### Glow (in the element's own color)
```xml
<filter id="glow" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
  <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```

### Neon tube (three-radius bloom + hot core)
```xml
<filter id="neon" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b1"/>
  <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b2"/>
  <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="b3"/>
  <feMerge><feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```
Draw the tube as a saturated stroke with this filter. Then, on top and unfiltered, add a thinner stroke of the same path in a near-white tint of the hue (`lighten(c, .3)`). That hot core is what sells neon. Works only on dark backgrounds.

---

## 4. Texture

### Grain (film / print), keeps average color
```xml
<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="4" stitchTiles="stitch" result="noise"/>
  <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.5 0 0 0 0.25" result="dark"/>
  <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.5 0 0 0 -0.25" result="light"/>
  <feMerge><feMergeNode in="dark"/><feMergeNode in="light"/></feMerge>
</filter>
<!-- apply above all art: -->
<rect width="100%" height="100%" fill="#000" fill-opacity="0" filter="url(#grain)"/>
```
Strength is the pair `±2s … ±s` in the alpha rows: s = 0.12 is a whisper, 0.25 film, 0.4 risograph, 0.7 gritty. Grain also **dithers away banding** in large smooth gradients (skies), so use s ≈ 0.1 on any big gradient.

### Paper background (tinted fibre relief)
Apply to the background rect, using the same fill color as the fallback.
```xml
<filter id="paper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" seed="11" result="n"/>
  <feDiffuseLighting in="n" lighting-color="#fff" surfaceScale="1.6" result="lit">  <!-- relief -->
    <feDistantLight azimuth="45" elevation="60"/>
  </feDiffuseLighting>
  <feComponentTransfer in="lit" result="shade">   <!-- normalise flat areas back to 1.0 -->
    <feFuncR type="linear" slope="1.16"/><feFuncG type="linear" slope="1.16"/><feFuncB type="linear" slope="1.16"/>
  </feComponentTransfer>
  <feFlood flood-color="#efe4cf" result="paper"/>  <!-- paper color -->
  <feComposite in="paper" in2="shade" operator="arithmetic" k1="1"/>
</filter>
<rect width="100%" height="100%" fill="#efe4cf" filter="url(#paper)"/>
```

### Clouds / fog / smoke (alpha noise, tinted)
```xml
<filter id="clouds" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.010" numOctaves="5" seed="8"/>  <!-- wider than tall -->
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.94  3.2 0 0 0 -1.45"/>  <!-- rgb = cloud tint, last row = coverage -->
</filter>
<rect width="100%" height="60%" fill="#000" fill-opacity="0" filter="url(#clouds)"/>
```
Coverage is set by the last row `a 0 0 0 b`: raise `b` toward −1.2 for more cloud, lower toward −1.7 for sparse wisps. For fog banks, stretch the noise (`"0.002 0.03"`), and fade the band out top and bottom with a gradient mask. For depth, use two layers at different frequencies and opacities.

### Marble, wood, stone: don't use filters for veins
Pushing low-frequency turbulence through a high-gain color matrix exposes **8-bit banding**: staircase contour rings that look cheap at any size. (General rule: keep matrix gain ≤ ~4 on noise with baseFrequency below 0.01.) Generate the veins as geometry instead, with `contour_lines()` of `Noise.fbm` drawn as thin `ribbon_d` strokes (see generative.md → Marble). Then add a low-opacity clouds layer tinted grey-violet for the milky body. Wood grain uses the same approach, with contour lines of noise stretched along one axis.

---

## 5. Edges

### Rough / hand-cut / ink-bleed edge
```xml
<filter id="rough" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="2" result="n0"/>
  <feColorMatrix in="n0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```
`scale` 2–4 gives a printed edge, 6–10 cut paper, 15+ melting. Higher `baseFrequency` makes the wobble finer. Use one rough filter on a group of flat shapes to make vector art feel handmade.

### Watercolor wash
```xml
<filter id="watercolor" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="4" seed="7" result="w0"/>
  <feColorMatrix in="w0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="18" xChannelSelector="R" yChannelSelector="G" result="bled"/>
  <feGaussianBlur in="bled" stdDeviation="1.2" result="soft"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="8" result="grain"/>
  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.8 1.2" result="mask"/>
  <feComposite in="soft" in2="mask" operator="in"/>
</filter>
```
Apply to a group of blobby shapes with `fill-opacity` around .7. Overlapping washes darken where they cross, the way glazing does. Layer three or four washes with different seeds for a convincing painting.

### Gooey / metaballs
```xml
<filter id="goo" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/>
  <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/>
</filter>
```
Shapes inside one `<g filter="url(#goo)">` fuse wherever they come close. Use it for lava lamps, drips and organic blobs. Keep each group a single color.

### Sticker / die-cut outline
```xml
<filter id="sticker" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <feMorphology in="SourceAlpha" operator="dilate" radius="8" result="fat"/>  <!-- border width -->
  <feFlood flood-color="#ffffff"/>
  <feComposite in2="fat" operator="in" result="border"/>
  <feGaussianBlur in="fat" stdDeviation="6" result="sb"/>
  <feOffset in="sb" dy="6" result="so"/>
  <feFlood flood-color="#1b1b2f" flood-opacity="0.3"/>
  <feComposite in2="so" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```
For a crisp *vector* outline (needed for print, cutting or editing), use a wide stroke on a duplicate underneath instead: `stroke-width = 2 × border`, with `stroke-linejoin="round"`.

---

## 6. Color

### Posterize (flatten to N tones per channel)
```xml
<filter id="posterize" color-interpolation-filters="sRGB">
  <feComponentTransfer>
    <feFuncR type="discrete" tableValues="0 0.33 0.66 1"/>
    <feFuncG type="discrete" tableValues="0 0.33 0.66 1"/>
    <feFuncB type="discrete" tableValues="0 0.33 0.66 1"/>
  </feComponentTransfer>
</filter>
```

### Duotone (map luminance to two inks)
```xml
<filter id="duotone" color-interpolation-filters="sRGB">
  <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/>
  <feComponentTransfer>
    <feFuncR type="table" tableValues="0.13 0.98"/>   <!-- shadow ink R → highlight ink R -->
    <feFuncG type="table" tableValues="0.11 0.80"/>
    <feFuncB type="table" tableValues="0.33 0.45"/>
  </feComponentTransfer>
</filter>
```
Each `tableValues="dark light"` pair is that channel of the shadow ink and the highlight ink (0–1). Add a middle value for tritone.

### Misregistration / chromatic fringe (riso, glitch, retro print)
```xml
<filter id="misreg" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feOffset in="SourceGraphic" dx="4" dy="-2" result="shift"/>
  <feColorMatrix in="shift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
  <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/>
  <feBlend in="r" in2="gb" mode="screen"/>
</filter>
```
For *real* riso art, misregister geometrically instead: draw each ink as its own layer, offset one layer by a few units, and precompute the overlap colors with `svgkit.multiply()`. That gives crisp, editable, fully portable results.

---

## 7. When NOT to use a filter

- **Vignette** → a full-canvas radial gradient from transparent to dark (`stop-opacity`) is free and crisp.
- **Soft spotlight / sun haze** → a radial gradient that fades to the same color at `stop-opacity="0"`.
- **Long shadow / flat-design shadow** → geometry: a polygon from the shape's silhouette, or a skewed copy.
- **Outline for print or cutting** → a stroke on a duplicate, not `feMorphology` (filters rasterize in PDF/print pipelines).
- **Halftone** → generate the dots (`generative.md`); filter halftones are fragile.
- **Mesh-gradient look** → 3–6 big blurred ellipses (`blur_filter` with a canvas region), or overlapping radial gradients with transparent edges. Never `<meshgradient>`: only Inkscape renders it.
- **Print deliverables** → any filter becomes a raster in PDF/EPS export. Keep the critical shapes as vector and use filters only for texture.

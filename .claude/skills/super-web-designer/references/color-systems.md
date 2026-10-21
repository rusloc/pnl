# Color Systems Reference

## Table of Contents
1. [Color Theory Fundamentals](#theory)
2. [Color Combination Techniques](#combinations)
3. [Building Custom Color Schemes](#custom-schemes)
4. [Ready-Made Palette Systems](#palette-systems)
5. [Business App Color Guidelines](#business-colors)
6. [Kids / Entertainment Color Guidelines](#entertainment-colors)
7. [Accessibility & Contrast](#accessibility)
8. [CSS Color Techniques](#css-techniques)
9. [Color Tools & Resources](#tools)

---

## 1. Color Theory Fundamentals <a id="theory"></a>

### Color Properties
- **Hue** — The color itself (red, blue, green) — position on the color wheel (0-360°)
- **Saturation** — Intensity/purity (0% = gray, 100% = vivid)
- **Lightness** — How light or dark (0% = black, 100% = white)

### Use HSL for Design, Not Hex
HSL is intuitive for creating consistent palettes. Use `oklch()` for perceptually uniform colors.

```css
/* HSL — easy to reason about */
--primary: hsl(220, 65%, 50%);
--primary-light: hsl(220, 65%, 70%);     /* same hue/sat, lighter */
--primary-dark: hsl(220, 65%, 30%);      /* same hue/sat, darker */

/* OKLCH — perceptually uniform (modern, recommended) */
--primary: oklch(55% 0.18 250);
--primary-light: oklch(75% 0.12 250);    /* higher lightness, lower chroma */
--primary-dark: oklch(35% 0.15 250);
```

---

## 2. Color Combination Techniques <a id="combinations"></a>

### Complementary (opposite on wheel)
High contrast, energetic. Use for CTAs against backgrounds.
```
Blue (220°) + Orange (40°)
Purple (270°) + Yellow (60°)
Red (0°) + Cyan (180°)
```

### Analogous (neighbors on wheel)
Harmonious, calm. Great for business apps.
```
Blue (220°) + Blue-Purple (250°) + Purple (270°)
Green (120°) + Teal (160°) + Cyan (180°)
Orange (30°) + Yellow-Orange (45°) + Yellow (60°)
```

### Triadic (three equally spaced)
Balanced, vibrant. Perfect for kids/entertainment.
```
Red (0°) + Blue (240°) + Yellow (120°)
Orange (30°) + Green (150°) + Violet (270°)
```

### Split Complementary
One base + two adjacent to its complement. Vibrant but less tense than complementary.
```
Blue (220°) + Yellow-Orange (40°) + Red-Orange (20°)
```

### Monochromatic
Single hue, vary lightness and saturation. Safest, most cohesive option for business.
```
Base: hsl(220, 60%, 50%)
Tints: hsl(220, 60%, 70%), hsl(220, 60%, 85%), hsl(220, 60%, 95%)
Shades: hsl(220, 60%, 35%), hsl(220, 60%, 20%)
```

### 60-30-10 Rule
- **60%** — Dominant color (background, large areas) — neutral or light
- **30%** — Secondary color (cards, sections, nav) — supporting tone
- **10%** — Accent color (buttons, links, highlights) — strongest contrast

---

## 3. Building Custom Color Schemes <a id="custom-schemes"></a>

### Step-by-Step Process

**Step 1: Choose a brand/primary color**
Start with the dominant hue. For business, blues (210-240°) and neutrals are safest. For
entertainment, pick something expressive.

**Step 2: Generate a neutral scale**
Add a subtle tint of your primary hue to your grays for cohesion.
```css
:root {
  /* Tinted neutrals (add ~5% of primary hue) */
  --gray-50:  hsl(220, 10%, 98%);
  --gray-100: hsl(220, 10%, 95%);
  --gray-200: hsl(220, 10%, 88%);
  --gray-300: hsl(220, 10%, 75%);
  --gray-400: hsl(220, 8%, 60%);
  --gray-500: hsl(220, 6%, 45%);
  --gray-600: hsl(220, 6%, 35%);
  --gray-700: hsl(220, 8%, 25%);
  --gray-800: hsl(220, 10%, 15%);
  --gray-900: hsl(220, 12%, 8%);
}
```

**Step 3: Create primary color scale**
```css
:root {
  --primary-50:  hsl(220, 65%, 96%);
  --primary-100: hsl(220, 65%, 90%);
  --primary-200: hsl(220, 65%, 80%);
  --primary-300: hsl(220, 65%, 70%);
  --primary-400: hsl(220, 65%, 60%);
  --primary-500: hsl(220, 65%, 50%);  /* base */
  --primary-600: hsl(220, 65%, 42%);
  --primary-700: hsl(220, 65%, 34%);
  --primary-800: hsl(220, 65%, 26%);
  --primary-900: hsl(220, 65%, 18%);
}
```

**Step 4: Add semantic colors**
```css
:root {
  --success: hsl(145, 65%, 42%);
  --warning: hsl(38, 92%, 50%);
  --error:   hsl(0, 72%, 51%);
  --info:    hsl(200, 80%, 50%);
}
```

**Step 5: Define surface and text colors**
```css
:root {
  --surface-primary:   var(--gray-50);
  --surface-secondary: white;
  --surface-elevated:  white;
  --text-primary:      var(--gray-900);
  --text-secondary:    var(--gray-600);
  --text-tertiary:     var(--gray-400);
  --border:            var(--gray-200);
  --border-strong:     var(--gray-300);
}
```

### Dark Mode Pattern
```css
@media (prefers-color-scheme: dark) {
  :root {
    --surface-primary:   var(--gray-900);
    --surface-secondary: var(--gray-800);
    --surface-elevated:  var(--gray-700);
    --text-primary:      var(--gray-50);
    --text-secondary:    var(--gray-300);
    --text-tertiary:     var(--gray-500);
    --border:            var(--gray-700);
    --border-strong:     var(--gray-600);
    /* Lighten primary for dark backgrounds */
    --primary-500:       hsl(220, 70%, 65%);
  }
}
```

---

## 4. Ready-Made Palette Systems <a id="palette-systems"></a>

### Tailwind CSS Colors
Full palette at https://tailwindcss.com/docs/customizing-colors — includes Slate, Zinc, Stone,
Neutral (gray variants), plus full color ranges. Use as starting points.

### Radix Colors
https://www.radix-ui.com/colors — 30 color scales with automatic dark mode. Each scale has 12 steps
designed for specific UI uses (backgrounds, borders, text, solid).

### Open Color
https://yeun.github.io/open-color/ — Optimized for UI, 13 hues × 10 shades.

### Material Design Color System
https://m3.material.io/styles/color — Dynamic color with tonal palettes, generates full schemes
from a single seed color.

---

## 5. Business App Color Guidelines <a id="business-colors"></a>

### Safe Business Palettes

**Corporate Blue**
```css
--primary: hsl(215, 65%, 45%);  --accent: hsl(25, 90%, 55%);
```

**Midnight Professional**
```css
--primary: hsl(230, 35%, 20%);  --accent: hsl(170, 60%, 50%);
```

**Warm Neutral**
```css
--primary: hsl(35, 10%, 25%);   --accent: hsl(15, 75%, 55%);
```

**Fintech Green**
```css
--primary: hsl(155, 55%, 38%);  --accent: hsl(220, 60%, 50%);
```

**Startup Indigo**
```css
--primary: hsl(245, 58%, 55%);  --accent: hsl(340, 82%, 55%);
```

### Business Color Rules
1. Maximum 1 saturated accent color — everything else is neutral
2. Use color to encode meaning, not decoration (red = error, green = success, etc.)
3. Interactive elements (links, buttons) should share a consistent color
4. Data visualization colors should be distinguishable in grayscale
5. Backgrounds should be near-white (light) or near-black (dark) — never mid-gray

---

## 6. Kids / Entertainment Color Guidelines <a id="entertainment-colors"></a>

### Kids Palettes (ages 3-8)

**Rainbow Bright**
```css
--red: hsl(0, 85%, 60%);     --orange: hsl(30, 90%, 58%);
--yellow: hsl(50, 95%, 60%); --green: hsl(130, 60%, 50%);
--blue: hsl(210, 80%, 55%);  --purple: hsl(270, 70%, 60%);
```

**Soft Pastel (younger kids)**
```css
--pink: hsl(340, 70%, 80%);    --peach: hsl(20, 85%, 82%);
--mint: hsl(155, 50%, 78%);    --sky: hsl(200, 70%, 82%);
--lavender: hsl(260, 55%, 82%);--lemon: hsl(50, 80%, 82%);
```

### Cinematic Palettes

**Teal & Orange (blockbuster standard)**
```css
--teal: hsl(185, 70%, 35%);    --orange: hsl(25, 90%, 55%);
--dark: hsl(210, 30%, 10%);
```

**Dark Blue & Gold (epic/fantasy)**
```css
--navy: hsl(225, 50%, 15%);    --gold: hsl(42, 85%, 55%);
--cream: hsl(40, 30%, 90%);
```

**Neon on Dark (cyberpunk/gaming)**
```css
--bg: hsl(240, 20%, 8%);
--neon-cyan: hsl(180, 100%, 60%);
--neon-magenta: hsl(300, 100%, 60%);
--neon-yellow: hsl(60, 100%, 65%);
```

**Horror/Dark**
```css
--bg: hsl(0, 5%, 5%);
--blood: hsl(0, 80%, 35%);
--bone: hsl(40, 15%, 75%);
--shadow: hsl(250, 20%, 12%);
```

### Entertainment Color Rules
1. Saturation should be 60-100% for primary colors — vivid and attention-grabbing
2. Use gradients generously — linear, radial, conic
3. Glow effects via `box-shadow` with saturated transparent colors
4. Background depth through layered gradients and subtle patterns
5. Ensure text on vibrant backgrounds has sufficient contrast (add overlay if needed)

---

## 7. Accessibility & Contrast <a id="accessibility"></a>

### WCAG Requirements
| Level | Normal Text | Large Text (≥18px bold / ≥24px) |
|-------|-------------|--------------------------------|
| AA    | 4.5:1       | 3:1                            |
| AAA   | 7:1         | 4.5:1                          |

### Quick Contrast Checks
- Pure white (#fff) on any color lighter than `hsl(H, S, 45%)` will likely fail AA
- Pure black (#000) on any color darker than `hsl(H, S, 55%)` will likely fail AA
- For colored text on colored backgrounds: test explicitly

### Tools for Checking
- **Contrast checker**: https://webaim.org/resources/contrastchecker/
- **Coolors contrast**: https://coolors.co/contrast-checker
- **In CSS**: `color-contrast()` function (emerging — not yet widely supported)

### Fixing Low Contrast Without Killing Design
```css
/* Instead of changing your design, add a semi-transparent overlay */
.text-on-image {
  position: relative;
}
.text-on-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7));
  z-index: 1;
}
.text-on-image > * { position: relative; z-index: 2; }
```

---

## 8. CSS Color Techniques <a id="css-techniques"></a>

### Gradient Recipes
```css
/* Business: subtle warm gradient */
background: linear-gradient(135deg, hsl(220, 15%, 97%), hsl(35, 10%, 95%));

/* Entertainment: vibrant mesh gradient */
background:
  radial-gradient(at 20% 30%, hsl(270, 80%, 60%) 0%, transparent 50%),
  radial-gradient(at 80% 20%, hsl(200, 90%, 55%) 0%, transparent 50%),
  radial-gradient(at 50% 80%, hsl(330, 80%, 55%) 0%, transparent 50%),
  hsl(240, 20%, 10%);

/* Glass morphism */
background: rgba(255, 255, 255, 0.15);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.2);
```

### Glow Effects
```css
/* Neon glow */
.neon { box-shadow: 0 0 10px var(--neon-cyan), 0 0 30px var(--neon-cyan), 0 0 60px var(--neon-cyan); }

/* Soft ambient glow */
.glow { box-shadow: 0 8px 32px hsla(220, 80%, 50%, 0.3); }
```

### Dynamic Color with color-mix()
```css
/* Lighten/darken dynamically */
--primary-light: color-mix(in srgb, var(--primary) 70%, white);
--primary-dark:  color-mix(in srgb, var(--primary) 70%, black);

/* Create transparent variant */
--primary-transparent: color-mix(in srgb, var(--primary) 20%, transparent);
```

---

## 9. Color Tools & Resources <a id="tools"></a>

- **Coolors** — https://coolors.co/ — Fast palette generator, lock colors and generate complements
- **Realtime Colors** — https://realtimecolors.com/ — Preview palette on a real website layout
- **Huemint** — https://huemint.com/ — AI-powered palette generation for brand/web/graphic
- **Happy Hues** — https://www.happyhues.co/ — Curated palettes applied to a real page
- **ColorBox by Lyft** — https://colorbox.io/ — Algorithmic color scale generator
- **Leonardo by Adobe** — https://leonardocolor.io/ — Contrast-based color system designer
- **oklch picker** — https://oklch.com/ — Interactive OKLCH color picker
- **Palette generator** — https://mycolor.space/ — Generate matching palettes from one color
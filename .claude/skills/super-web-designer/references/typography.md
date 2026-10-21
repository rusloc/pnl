# Typography Reference

## Table of Contents
1. [Font Sources & CDN Links](#font-sources)
2. [Font Categories & Recommendations](#categories)
3. [Font Pairing System](#pairing)
4. [Type Scale & Hierarchy](#type-scale)
5. [Responsive Typography](#responsive-type)
6. [Variable Fonts](#variable-fonts)
7. [Performance & Loading](#performance)

---

## 1. Font Sources <a id="font-sources"></a>

### Primary Sources (free, production-ready)
- **Google Fonts** — https://fonts.google.com — 1,500+ families, CDN served
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=FONTNAME:wght@400;500;700&display=swap" rel="stylesheet">
  ```
- **Bunny Fonts** — https://fonts.bunny.net — GDPR-friendly Google Fonts alternative (drop-in replacement)
- **Fontshare** — https://www.fontshare.com/ — High-quality free fonts by Indian Type Foundry
- **Font Squirrel** — https://www.fontsquirrel.com/ — Hand-curated free fonts with webfont generator
- **Uncut** — https://uncut.wtf/ — Contemporary, free, open-source typefaces

### Premium Font Foundries (reference for premium projects)
- **Klim Type** — https://klim.co.nz/ — Söhne, Calibre, Tiempos
- **Grilli Type** — https://www.grillitype.com/ — GT America, GT Walsheim
- **Colophon** — https://www.colophon-foundry.org/ — Aperçu, Reader
- **Commercial Type** — https://commercialtype.com/ — Graphik, Atlas
- **DJR** — https://djr.com/ — Fit, Roslindale, Forma

---

## 2. Font Categories & Recommendations <a id="categories"></a>

### For Minimal Business Apps

**Geometric Sans-Serif (clean, modern, neutral)**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| Plus Jakarta Sans | Google | SaaS, dashboards | `Plus+Jakarta+Sans:wght@400;500;600;700` |
| Outfit | Google | Corporate, startup | `Outfit:wght@300;400;500;600;700` |
| Satoshi | Fontshare | Tech, modern business | fontshare.com |
| General Sans | Fontshare | Versatile business | fontshare.com |
| Switzer | Fontshare | Enterprise, clean | fontshare.com |
| Geist | Vercel | Developer tools, tech | CDN: `https://cdn.jsdelivr.net/npm/geist/dist/fonts/geist-sans/` |
| DM Sans | Google | Friendly business | `DM+Sans:wght@400;500;700` |
| Sora | Google | Tech, futuristic | `Sora:wght@300;400;500;600;700` |

**Humanist Sans-Serif (warm, approachable, readable)**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| Source Sans 3 | Google | Long-form body text | `Source+Sans+3:wght@300;400;600;700` |
| Figtree | Google | Friendly SaaS | `Figtree:wght@400;500;600;700` |
| Albert Sans | Google | Modern editorial | `Albert+Sans:wght@400;500;700` |
| Nunito Sans | Google | Soft, approachable | `Nunito+Sans:wght@400;600;700` |

**Serif (editorial, luxury, trust)**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| Fraunces | Google | Playful editorial | `Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700` |
| Instrument Serif | Google | Elegant headers | `Instrument+Serif:ital@0;1` |
| Lora | Google | Body text serif | `Lora:wght@400;500;600;700` |
| Newsreader | Google | Article/blog body | `Newsreader:wght@300;400;500;700` |
| DM Serif Display | Google | Display headlines | `DM+Serif+Display` |
| Playfair Display | Google | Luxury, editorial | `Playfair+Display:wght@400;500;600;700` |

**Monospace (code, data, technical)**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| JetBrains Mono | Google | Code, terminals | `JetBrains+Mono:wght@400;500;700` |
| Fira Code | Google | Code with ligatures | `Fira+Code:wght@400;500;700` |
| IBM Plex Mono | Google | Data, dashboards | `IBM+Plex+Mono:wght@400;500;700` |
| Space Mono | Google | Retro-tech | `Space+Mono:wght@400;700` |
| Geist Mono | Vercel | Developer tools | CDN: jsdelivr |

### For Kids / Movie / Entertainment

**Rounded & Playful**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| Baloo 2 | Google | Kids apps, games | `Baloo+2:wght@400;500;600;700` |
| Bubblegum Sans | Google | Very young children | `Bubblegum+Sans` |
| Comic Neue | Google | Friendly, casual | `Comic+Neue:wght@400;700` |
| Fredoka | Google | Rounded, playful | `Fredoka:wght@400;500;600;700` |
| Boogaloo | Google | Fun headlines | `Boogaloo` |
| Chewy | Google | Cartoon titles | `Chewy` |
| Luckiest Guy | Google | Comic book feel | `Luckiest+Guy` |
| Lilita One | Google | Bold, impactful | `Lilita+One` |

**Cinematic & Display**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| Bebas Neue | Google | Movie posters | `Bebas+Neue` |
| Oswald | Google | Condensed dramatic | `Oswald:wght@400;500;600;700` |
| Teko | Google | Tech/sci-fi | `Teko:wght@400;500;600;700` |
| Orbitron | Google | Futuristic/space | `Orbitron:wght@400;500;700` |
| Cinzel | Google | Epic/fantasy | `Cinzel:wght@400;500;600;700` |
| Creepster | Google | Horror | `Creepster` |
| Pirata One | Google | Pirate/adventure | `Pirata+One` |
| Press Start 2P | Google | Retro gaming | `Press+Start+2P` |
| Silkscreen | Google | Pixel art | `Silkscreen:wght@400;700` |

**Handwritten & Script**
| Font | Source | Best for | CDN |
|------|--------|----------|-----|
| Caveat | Google | Casual annotation | `Caveat:wght@400;500;600;700` |
| Kalam | Google | Handwritten body | `Kalam:wght@300;400;700` |
| Patrick Hand | Google | Sketch/notebook | `Patrick+Hand` |
| Permanent Marker | Google | Bold marker | `Permanent+Marker` |
| Indie Flower | Google | Whimsical notes | `Indie+Flower` |

---

## 3. Font Pairing System <a id="pairing"></a>

### Pairing Principle: Contrast + Cohesion
Good pairings share an underlying structural similarity (x-height, proportions) but differ in
classification (serif vs sans, geometric vs humanist, display vs text).

### Proven Pairings — Business

| Heading | Body | Mood |
|---------|------|------|
| Plus Jakarta Sans (700) | Plus Jakarta Sans (400) | Clean SaaS |
| DM Serif Display | DM Sans | Elegant startup |
| Instrument Serif | Figtree | Editorial modern |
| Fraunces | Source Sans 3 | Playful professional |
| Outfit (700) | Outfit (400) | Geometric corporate |
| Playfair Display | Nunito Sans | Luxury brand |
| Sora (600) | Source Sans 3 | Tech/futuristic |
| Bebas Neue | Albert Sans | Bold editorial |

### Proven Pairings — Kids / Entertainment

| Heading | Body | Mood |
|---------|------|------|
| Fredoka (700) | Nunito Sans | Friendly kids app |
| Lilita One | Comic Neue | Cartoon/animation |
| Luckiest Guy | Baloo 2 | Energetic game |
| Bebas Neue | Outfit | Cinematic thriller |
| Cinzel | Lora | Epic fantasy |
| Orbitron | Sora | Sci-fi/space |
| Press Start 2P | Space Mono | Retro gaming |
| Chewy | Quicksand | Preschool fun |

### Quick Pairing Rules
1. **Same family, different weights** — safest option, always works
2. **Serif heading + sans body** — classic, establishes hierarchy instantly
3. **Display font + neutral body** — lets the display font shine without clashing
4. **Never pair two display fonts** — visual chaos
5. **Match x-heights** — fonts with similar x-heights pair more naturally
6. **Max 2 families per page** — 3 only if one is monospace for code/data

---

## 4. Type Scale & Hierarchy <a id="type-scale"></a>

### Recommended Scales

**Business App (ratio 1.25 — Major Third)**
```css
:root {
  --text-xs:   0.64rem;   /* 10.24px — captions, badges */
  --text-sm:   0.8rem;    /* 12.8px  — labels, metadata */
  --text-base: 1rem;      /* 16px    — body text */
  --text-md:   1.25rem;   /* 20px    — subheadings */
  --text-lg:   1.563rem;  /* 25px    — section headings */
  --text-xl:   1.953rem;  /* 31.25px — page titles */
  --text-2xl:  2.441rem;  /* 39px    — hero subtext */
  --text-3xl:  3.052rem;  /* 48.8px  — hero headlines */
}
```

**Entertainment / Kids (ratio 1.333 — Perfect Fourth)**
```css
:root {
  --text-xs:   0.563rem;  /* 9px     — fine print */
  --text-sm:   0.75rem;   /* 12px    — labels */
  --text-base: 1rem;      /* 16px    — body */
  --text-md:   1.333rem;  /* 21.3px  — subheadings */
  --text-lg:   1.777rem;  /* 28.4px  — section titles */
  --text-xl:   2.369rem;  /* 37.9px  — page titles */
  --text-2xl:  3.157rem;  /* 50.5px  — hero text */
  --text-3xl:  4.209rem;  /* 67.3px  — cinematic headlines */
}
```

### Line Height Rules
- Headings: `1.1` to `1.2` — tight, impactful
- Body text: `1.5` to `1.7` — comfortable reading
- Captions/UI: `1.3` to `1.4` — compact but legible
- Long-form reading: `1.6` to `1.8` — generous

### Letter Spacing Guidance
- Large headings (>36px): `-0.02em` to `-0.03em` (tighten)
- Body text: `0` (leave default)
- All-caps text: `0.05em` to `0.12em` (open up)
- Small text (<12px): `0.01em` to `0.02em` (slight opening improves readability)

---

## 5. Responsive Typography <a id="responsive-type"></a>

### Fluid Typography with clamp()
```css
/* Scales smoothly between viewport sizes */
h1 { font-size: clamp(2rem, 5vw + 1rem, 4.5rem); }
h2 { font-size: clamp(1.5rem, 3vw + 0.75rem, 3rem); }
h3 { font-size: clamp(1.25rem, 2vw + 0.5rem, 2rem); }
p  { font-size: clamp(1rem, 0.5vw + 0.875rem, 1.125rem); }
```

### Container-Query Typography (modern approach)
```css
@container (min-width: 600px) {
  .card-title { font-size: 1.5rem; }
}
@container (max-width: 599px) {
  .card-title { font-size: 1.125rem; }
}
```

---

## 6. Variable Fonts <a id="variable-fonts"></a>

Variable fonts contain multiple styles in a single file — better performance, smoother animations.

### Top Variable Fonts for Web
| Font | Axes | Google Fonts |
|------|------|-------------|
| Inter | wght 100-900, slnt | `Inter:wght@100..900` |
| Plus Jakarta Sans | wght 200-800 | `Plus+Jakarta+Sans:wght@200..800` |
| Fraunces | wght, opsz, SOFT, WONK | `Fraunces:opsz,wght@9..144,100..900` |
| Recursive | wght, slnt, MONO, CASL, CRSV | `Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1` |

### Variable Font Animation
```css
/* Animate weight on hover — only works with variable fonts */
.animated-text {
  font-variation-settings: 'wght' 400;
  transition: font-variation-settings 0.3s ease;
}
.animated-text:hover {
  font-variation-settings: 'wght' 700;
}
```

---

## 7. Performance & Loading <a id="performance"></a>

### Font Loading Strategy
```html
<!-- Preconnect (must be in <head> before font link) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Only load weights you actually use -->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
```

### Font-Display Strategy
- `font-display: swap` — show fallback immediately, swap when loaded (best for body)
- `font-display: optional` — only use if loaded fast enough (best for decorative fonts)
- `font-display: fallback` — brief invisible period, then fallback (balanced)

### Fallback Stack Best Practices
```css
/* For geometric sans-serif */
font-family: 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;

/* For serif */
font-family: 'Instrument Serif', 'Georgia', 'Times New Roman', serif;

/* For monospace */
font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;

/* For rounded/kids */
font-family: 'Fredoka', 'Nunito', 'Segoe UI', system-ui, sans-serif;
```

### Performance Budget
- Maximum 2 font families per page
- Maximum 4 font files total (weights/styles)
- Target < 100KB total font payload
- Use `woff2` format exclusively (best compression)
- Subset fonts for specific character sets when possible
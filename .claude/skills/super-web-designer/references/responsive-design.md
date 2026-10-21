# Responsive & Adaptive Design Reference

## Table of Contents
1. [Breakpoint Systems](#breakpoints)
2. [Device Landscape & Screen Sizes](#devices)
3. [Aspect Ratios](#aspect-ratios)
4. [Mobile-First vs Desktop-First](#strategy)
5. [Fluid Design Techniques](#fluid)
6. [Container Queries](#container-queries)
7. [Responsive Images](#images)
8. [Touch vs Pointer Adaptation](#touch)
9. [Common Responsive Patterns](#patterns)

---

## 1. Breakpoint Systems <a id="breakpoints"></a>

### Recommended Breakpoints (2024-2026 device landscape)
```css
/* Mobile-first approach — these are min-width breakpoints */
:root {
  /* Small phones */          /* 320-479px: default styles, no query */
  /* Large phones */          /* @media (min-width: 480px) */
  /* Small tablets */         /* @media (min-width: 640px) */
  /* Tablets / small laptops */ /* @media (min-width: 768px) */
  /* Laptops */               /* @media (min-width: 1024px) */
  /* Desktops */              /* @media (min-width: 1280px) */
  /* Large desktops */        /* @media (min-width: 1536px) */
  /* Ultra-wide */            /* @media (min-width: 1920px) */
}
```

### Tailwind-Aligned Breakpoints
| Name | Min-width | Typical devices |
|------|-----------|----------------|
| `sm` | 640px | Large phones (landscape), small tablets |
| `md` | 768px | Tablets (portrait), small laptops |
| `lg` | 1024px | Tablets (landscape), laptops |
| `xl` | 1280px | Desktops, external monitors |
| `2xl` | 1536px | Large desktops, hi-res displays |

### Content-Based Breakpoints (preferred approach)
Instead of device breakpoints, break where your content breaks:
```css
/* When the card grid gets too narrow for 3 columns */
@media (max-width: 52rem) { .grid { grid-template-columns: repeat(2, 1fr); } }

/* When sidebar content can't breathe */
@media (max-width: 48rem) { .sidebar { display: none; } }
```

---

## 2. Device Landscape <a id="devices"></a>

### Common Screen Resolutions (2025-2026)

**Phones**
| Device | Logical px | Physical px | DPR | Aspect Ratio |
|--------|-----------|-------------|-----|--------------|
| iPhone SE | 375×667 | 750×1334 | 2x | 9:16 |
| iPhone 15 | 393×852 | 1179×2556 | 3x | ~9:19.5 |
| iPhone 15 Pro Max | 430×932 | 1290×2796 | 3x | ~9:19.5 |
| Samsung Galaxy S24 | 360×780 | 1080×2340 | 3x | ~9:19.5 |
| Pixel 8 | 412×915 | 1080×2400 | 2.625x | 9:20 |

**Tablets**
| Device | Logical px | Physical px | DPR |
|--------|-----------|-------------|-----|
| iPad 10th gen | 820×1180 | 1640×2360 | 2x |
| iPad Air M2 | 820×1180 | 1640×2360 | 2x |
| iPad Pro 11" | 834×1194 | 1668×2388 | 2x |
| iPad Pro 13" | 1024×1366 | 2048×2732 | 2x |
| Samsung Galaxy Tab S9 | 753×1205 | 1600×2560 | 2.1x |

**Desktops**
| Resolution | Common name | Usage |
|-----------|-------------|-------|
| 1366×768 | HD | Older laptops, budget devices |
| 1440×900 | WXGA+ | MacBook Air (older) |
| 1536×864 | — | Most popular Windows resolution |
| 1920×1080 | Full HD | Standard desktop |
| 2560×1440 | QHD/2K | Gaming monitors, MacBook Pro 14" |
| 3840×2160 | 4K/UHD | High-end monitors |
| 5120×2880 | 5K | iMac, Studio Display |

### Viewport Meta Tag (required)
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

---

## 3. Aspect Ratios <a id="aspect-ratios"></a>

### CSS Aspect Ratio Property
```css
/* Modern — single property */
.video-container { aspect-ratio: 16 / 9; width: 100%; }
.square-card { aspect-ratio: 1; }
.portrait-card { aspect-ratio: 3 / 4; }
.cinema { aspect-ratio: 2.39 / 1; }
```

### Common Aspect Ratios & Use Cases
| Ratio | Decimal | Use case |
|-------|---------|----------|
| 1:1 | 1.0 | Profile pictures, Instagram-style cards, icons |
| 4:3 | 1.33 | Classic TV, presentations, iPad-ish content |
| 3:2 | 1.5 | Photography, Mac displays, print |
| 16:9 | 1.78 | Video, YouTube embeds, hero sections |
| 21:9 | 2.33 | Ultrawide, cinematic banners |
| 9:16 | 0.56 | Mobile portrait, Stories/Reels, TikTok |
| 2:3 | 0.67 | Movie posters, portrait content |

### Responsive Aspect Ratios
```css
/* Widescreen on desktop, square-ish on mobile */
.hero-media {
  aspect-ratio: 16 / 9;
}
@media (max-width: 768px) {
  .hero-media { aspect-ratio: 4 / 3; }
}
@media (max-width: 480px) {
  .hero-media { aspect-ratio: 1; }
}
```

---

## 4. Mobile-First vs Desktop-First <a id="strategy"></a>

### Mobile-First (recommended for most projects)
Write base styles for smallest screens, add complexity via `min-width` queries.
```css
/* Base: mobile */
.nav { flex-direction: column; }

/* Tablet+ */
@media (min-width: 768px) {
  .nav { flex-direction: row; }
}
```

**Pros:** Forces content prioritization, lighter mobile payloads, progressive enhancement.
**Cons:** Complex desktop layouts need more overrides.
**Best for:** Content sites, apps, marketing pages, most business apps.

### Desktop-First (use selectively)
Write base for desktop, simplify via `max-width` queries.
```css
/* Base: desktop */
.sidebar { width: 280px; display: block; }

/* Mobile */
@media (max-width: 768px) {
  .sidebar { display: none; }
}
```

**Pros:** Natural for complex dashboard layouts already designed for desktop.
**Cons:** Mobile often gets bloated styles, harder to optimize.
**Best for:** Admin dashboards, data-heavy tools where desktop is primary.

---

## 5. Fluid Design Techniques <a id="fluid"></a>

### Fluid Spacing with clamp()
```css
:root {
  --space-xs:  clamp(0.25rem, 0.5vw, 0.5rem);
  --space-sm:  clamp(0.5rem, 1vw, 0.75rem);
  --space-md:  clamp(0.75rem, 2vw, 1.5rem);
  --space-lg:  clamp(1rem, 3vw, 2.5rem);
  --space-xl:  clamp(1.5rem, 5vw, 4rem);
  --space-2xl: clamp(2rem, 8vw, 6rem);
}
```

### Fluid Grid
```css
/* Auto-responsive grid — no media queries needed */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: var(--space-md);
}
```

### Max-Width Container Pattern
```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: var(--space-md);
}

/* Breakout pattern for full-bleed inside container */
.full-bleed {
  width: 100vw;
  margin-inline: calc(-50vw + 50%);
}
```

---

## 6. Container Queries <a id="container-queries"></a>

Container queries let components respond to their container's size, not the viewport.

### Setup
```css
/* Define a containment context */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Query the container */
@container card (min-width: 400px) {
  .card { flex-direction: row; }
}
@container card (max-width: 399px) {
  .card { flex-direction: column; }
}
```

### When to Use Container Queries vs Media Queries
| Use container queries when... | Use media queries when... |
|-------------------------------|---------------------------|
| Component reused in different layouts | Page-level layout changes |
| Sidebar width varies | Viewport-dependent decisions |
| Cards in variable-column grids | Navigation patterns |
| Widgets in dashboards | Global typography scaling |

### Container Query Units
```css
/* cqw = 1% of container width, cqh = 1% of container height */
@container (min-width: 300px) {
  .card-title { font-size: max(1rem, 3cqw); }
}
```

---

## 7. Responsive Images <a id="images"></a>

### Modern Responsive Image Markup
```html
<!-- Art direction: different images at different sizes -->
<picture>
  <source media="(min-width: 1024px)" srcset="hero-wide.webp" type="image/webp">
  <source media="(min-width: 640px)" srcset="hero-medium.webp" type="image/webp">
  <img src="hero-mobile.webp" alt="Hero" loading="lazy" decoding="async">
</picture>

<!-- Resolution switching: same image, different sizes -->
<img
  srcset="photo-400.webp 400w, photo-800.webp 800w, photo-1200.webp 1200w"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  src="photo-800.webp"
  alt="Description"
  loading="lazy"
>
```

### CSS Object-Fit for Image Containers
```css
.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;     /* Fill container, crop if needed */
  object-position: center;
}
/* Options: cover | contain | fill | scale-down | none */
```

---

## 8. Touch vs Pointer Adaptation <a id="touch"></a>

### Detecting Input Type
```css
/* Touch devices — larger targets */
@media (pointer: coarse) {
  button, a { min-height: 44px; min-width: 44px; }
  .compact-nav { display: none; }
  .mobile-nav { display: flex; }
}

/* Precise pointer (mouse) — smaller targets OK */
@media (pointer: fine) {
  button { min-height: 32px; }
}

/* Hover capability */
@media (hover: hover) {
  .card:hover { transform: translateY(-4px); }
}
@media (hover: none) {
  /* No hover effects — use active/focus instead */
  .card:active { transform: scale(0.98); }
}
```

### Touch Target Sizing
- **Minimum:** 44×44px (Apple HIG, WCAG)
- **Comfortable:** 48×48px (Material Design)
- **Spacing between targets:** ≥8px

---

## 9. Common Responsive Patterns <a id="patterns"></a>

### Navigation
```css
/* Mobile: hamburger → Sheet/drawer */
/* Tablet: collapsed icon sidebar */
/* Desktop: full horizontal nav or expanded sidebar */

@media (max-width: 768px) {
  .nav-items { display: none; }
  .hamburger { display: block; }
}
```

### Card Layouts
```css
/* 1 col mobile → 2 col tablet → 3 col desktop → 4 col widescreen */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
```

### Tables (data tables on mobile)
```css
/* Option 1: Horizontal scroll */
.table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* Option 2: Stack rows as cards */
@media (max-width: 640px) {
  table, thead, tbody, th, td, tr { display: block; }
  td::before { content: attr(data-label); font-weight: 600; }
}
```

### Typography Responsive Cheat Sheet
```css
html { font-size: clamp(14px, 0.5vw + 13px, 18px); }
/* Everything using rem now scales fluidly */
```
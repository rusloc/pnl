# CSS Deep Reference — Flexbox, Grid, Modern CSS, Responsive

The platform handles more than most React devs realize. This reference catalogs the patterns that replace JS and Sass for layout, theming, and responsiveness.

## Sections

1. [Layout decision: Flexbox vs. Grid](#1-layout-decision-flexbox-vs-grid)
2. [Flexbox patterns](#2-flexbox-patterns)
3. [Grid patterns](#3-grid-patterns)
4. [Container queries](#4-container-queries)
5. [Modern CSS — `:has()`, cascade layers, `color-mix`, `oklch`](#5-modern-css--has-cascade-layers-color-mix-oklch)
6. [Logical properties & internationalization](#6-logical-properties--internationalization)
7. [Fluid typography & spacing](#7-fluid-typography--spacing)
8. [Sass — when it still earns its keep](#8-sass--when-it-still-earns-its-keep)
9. [Tailwind tradeoffs](#9-tailwind-tradeoffs)
10. [Old browser fallbacks with `@supports`](#10-old-browser-fallbacks-with-supports)
11. [Animations done right](#11-animations-done-right)

---

## 1. Layout decision: Flexbox vs. Grid

```
1D layout (single row OR column of items)?           → Flexbox
2D layout (rows AND columns matter)?                 → Grid
Items defined by content size, varying widths?       → Flexbox
Items in a defined cell structure (independent rows  → Grid
   from cols)?
Need exact alignment across rows and columns?        → Grid
Sidebar + main + footer that needs to track height?  → Grid (or Flex with shrink/grow)
Toolbar of buttons?                                  → Flexbox
Card collection that wraps?                          → Grid (auto-fill / auto-fit)
Form fields with labels?                             → Grid (col 1 = labels, col 2 = inputs)
```

They compose: Grid for the page, Flexbox inside cells. Don't pick one religion.

---

## 2. Flexbox patterns

### Cheat sheet

```css
.flex-row { display: flex; gap: 1rem; }                     /* row, with spacing */
.flex-col { display: flex; flex-direction: column; gap: 1rem; }
.center { display: flex; align-items: center; justify-content: center; }
.between { display: flex; justify-content: space-between; }
.wrap { display: flex; flex-wrap: wrap; gap: 1rem; }
```

### `gap` killed margin hacks

`gap` works in Flex (no longer requires Grid). Drop the `> * + * { margin-left: 1rem }` patterns.

### `flex` shorthand demystified

```css
flex: 0 1 auto;     /* default: grow=0 shrink=1 basis=auto. Items can shrink, won't grow. */
flex: 1;            /* grow=1 shrink=1 basis=0. Items split available space equally. */
flex: 0 0 200px;    /* grow=0 shrink=0 basis=200px. Fixed width, no flex. */
flex: 1 0 200px;    /* min 200px, can grow beyond. */
flex: auto;         /* equivalent to flex: 1 1 auto. */
flex: none;         /* equivalent to flex: 0 0 auto. */
```

The middle value (`flex-shrink`) gets ignored most often. If items aren't shrinking when expected, set `min-width: 0` on flex items (the default `min-width: auto` overrides shrink).

### Common patterns

```css
/* Sidebar (fixed) + main (fills remaining) */
.layout { display: flex; gap: 1rem; }
.sidebar { flex: 0 0 240px; }
.main    { flex: 1; min-width: 0; }    /* min-width: 0 critical for text overflow */

/* Stretch to fill, push last to bottom */
.col { display: flex; flex-direction: column; min-height: 100vh; }
.col > .footer { margin-top: auto; }

/* Avatars stack with overlap */
.avatars { display: flex; }
.avatars > img { width: 32px; height: 32px; border-radius: 50%; }
.avatars > img + img { margin-left: -8px; }   /* gap won't help — we want overlap */

/* Equal-height columns of varying content */
/* Free with flex — align-items defaults to stretch */
```

### `min-width: 0` — the most-forgotten flex rule

Flex items have `min-width: auto` by default (not 0). This means they'll never shrink below their **content's intrinsic size** — long text, large images, won't wrap or shrink. Set `min-width: 0` (or `overflow: hidden`) to fix.

---

## 3. Grid patterns

### Track sizing units

```
fr           = fraction of remaining space
auto         = sized to content
min-content  = the smallest the content can be (longest word for text)
max-content  = the largest natural size (entire content unwrapped)
minmax(a, b) = bounded
fit-content(N) = like auto, but capped at N
```

### Cheat sheet

```css
/* Equal columns */
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }

/* Auto-fitting cards (the killer one-liner) */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 1rem;
}

/* Sidebar + main */
.app { display: grid; grid-template-columns: 240px 1fr; gap: 1rem; }

/* Holy grail (header + sidebar + main + aside + footer) */
.holy-grail {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  min-height: 100vh;
}
.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.aside { grid-area: aside; }
.footer { grid-area: footer; }
```

### `auto-fit` vs. `auto-fill`

- `auto-fit`: empty tracks collapse to 0 → existing items expand to fill. Items always stretch.
- `auto-fill`: empty tracks reserved → items don't expand beyond their `minmax` max.

For card grids, you usually want `auto-fit`.

### `min(280px, 100%)` trick

```css
grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
```

On very narrow viewports, `280px` could overflow. `min(280px, 100%)` caps the minimum at the container width. No horizontal scroll on small screens.

### Aligning across the grid

```css
.grid {
  display: grid;
  align-items: start;      /* or center / end / stretch */
  justify-items: stretch;
  /* For the entire grid in its container: */
  align-content: center;
  justify-content: space-between;
}

/* Per-item override */
.special { align-self: end; justify-self: center; }
```

### Subgrid

```css
.parent { display: grid; grid-template-columns: 200px 1fr; }
.nested { display: grid; grid-template-columns: subgrid; }
/* .nested's children align to the parent's columns */
```

Solves the "I want children of a grid item to align to the parent's grid" problem. Universal browser support since 2024.

---

## 4. Container queries

Media queries respond to the viewport. Container queries respond to the container of a component. The right tool for component-level responsive design.

```css
.card-list {
  container-type: inline-size;        /* enable container queries on this element */
  container-name: cards;              /* optional, for specificity */
}

@container cards (min-width: 600px) {
  .card { display: grid; grid-template-columns: 200px 1fr; }
}
@container cards (max-width: 599px) {
  .card { display: block; }
}
```

The same `<Card>` component renders compactly in a sidebar (narrow container) and spaciously in main content (wide container). One CSS file, no JS, no breakpoint props.

### Container query units

```css
.card h3 { font-size: 5cqw; }      /* 5% of container width */
.card p { font-size: max(14px, 3cqi); }   /* 3% of container's inline size, min 14px */
```

Sized by container, not viewport. Fluid components.

### When to use container vs. media queries

- **Component-level responsive**: container queries.
- **Page-level responsive** (layout shifts based on screen size): media queries.

Both can co-exist. The card layout uses container queries; the page layout uses media queries.

---

## 5. Modern CSS — `:has()`, cascade layers, `color-mix`, `oklch`

### `:has()` — the "parent selector"

```css
/* Card that contains an image gets different layout */
.card:has(img) { display: grid; grid-template-columns: 100px 1fr; }

/* Form with errors */
form:has(:invalid) .submit-btn { opacity: 0.5; pointer-events: none; }

/* Adjacent-aware: section that has a sticky header */
.section:has(> .sticky-header) { padding-top: 0; }
```

`:has()` lets you match an element based on its descendants. Universal browser support since late 2023. **Eliminates many JS-driven class toggles**.

### Cascade layers (`@layer`)

```css
@layer reset, base, components, utilities;

@layer reset { /* lowest priority */ }
@layer base { body { font-family: ... } }
@layer components { .button { padding: 0.5rem 1rem } }
@layer utilities { .text-red { color: red } }     /* highest of declared layers */

/* Unlayered styles win against any layer. !important reverses layer order. */
```

Solves specificity wars. Tailwind's `@layer base / components / utilities` is exactly this. Every modern app should use cascade layers — it's the cleanest way to manage specificity.

### `color-mix()`

```css
.button:hover { background: color-mix(in oklch, var(--btn-bg), white 20%); }
.alert { border-color: color-mix(in srgb, currentColor, transparent 30%); }
```

Mix two colors at a given ratio. `oklch` color space gives perceptually uniform mixing — no more dirty browns when mixing complementary colors.

### `oklch()` — perceptually uniform color

```css
:root {
  --primary-50: oklch(0.95 0.05 250);
  --primary-500: oklch(0.65 0.18 250);    /* same hue, varying lightness */
  --primary-900: oklch(0.25 0.10 250);
}
```

`oklch(L C H)`:
- **L** (lightness): 0-1. 0.5 is mid-gray.
- **C** (chroma): 0-0.4ish. 0 is grayscale.
- **H** (hue): 0-360 degrees. 0 = pink/red, 120 = green, 240 = blue.

Generating tints/shades: vary L while keeping C and H. Far better than HSL (which has uneven lightness across hues — yellow at 50% lightness looks much brighter than blue at 50%).

### `:focus-visible` — modern focus indicator

```css
button { outline: none; }
button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

`:focus-visible` matches when the focus came from keyboard, not click. Click-focus (which gets a focus ring on most native styles) is suppressed; keyboard focus shows the ring. **Don't blanket-remove `outline`** — replace with `:focus-visible`.

### `:where()` and `:is()` — specificity helpers

```css
:is(h1, h2, h3) { line-height: 1.2; }      /* same as h1, h2, h3 */
:where(h1, h2, h3) { line-height: 1.2; }   /* zero specificity — easy to override */
```

`:where()` has zero specificity — perfect for base styles you want easy to override.

### `accent-color`

```css
:root { accent-color: oklch(0.6 0.2 240); }
```

Restyles native form controls (checkbox, radio, range, progress) with one line. No more custom checkbox CSS gymnastics for most cases.

### `text-wrap: balance`

```css
h1, h2, h3 { text-wrap: balance; }
```

Browser balances line lengths for short blocks (headings). No more last-line-of-one-word headlines.

### `text-wrap: pretty`

```css
p { text-wrap: pretty; }
```

For body text — improves orphans/widows. Slight perf cost; use on body copy, not pages of text.

### `:user-invalid` — validation, after the user tries

```css
input:user-invalid { border-color: red; }     /* shows error only after interaction */
```

`:invalid` matches immediately (before user types). `:user-invalid` matches after the user has interacted and the field is invalid. Far better UX.

---

## 6. Logical properties & internationalization

```
margin-left  → margin-inline-start
margin-right → margin-inline-end
padding-top  → padding-block-start
width        → inline-size
height       → block-size
left         → inset-inline-start
text-align: left → text-align: start
border-radius → border-start-start-radius (top-left in LTR, top-right in RTL)
```

Why: in RTL languages (Arabic, Hebrew), `start` and `end` flip. With logical properties, the same CSS supports both directions. Add `dir="rtl"` on `<html>` for Arabic; the CSS flips automatically.

If your app might ever support RTL: use logical properties everywhere from day one. Refactoring later is hell.

---

## 7. Fluid typography & spacing

### `clamp()` — fluid sizing in one line

```css
h1 { font-size: clamp(2rem, 5vw + 1rem, 4rem); }
.section { padding: clamp(1rem, 5vw, 4rem); }
.container { width: clamp(20rem, 90vw, 70rem); }
```

`clamp(min, preferred, max)`:
- Below the min value, sticks at min.
- Between, scales fluidly.
- Above the max value, caps at max.

No media queries needed for "responsive font size."

### Modular scale + clamp

```css
:root {
  /* Scale ratio: 1.25 (major third) */
  --step--1: clamp(0.83rem, 0.78rem + 0.24vw, 1rem);
  --step-0:  clamp(1rem,    0.93rem + 0.36vw, 1.25rem);
  --step-1:  clamp(1.25rem, 1.13rem + 0.61vw, 1.563rem);
  --step-2:  clamp(1.5rem,  1.31rem + 0.97vw, 1.953rem);
  --step-3:  clamp(1.875rem, 1.51rem + 1.83vw, 2.441rem);
}

h1 { font-size: var(--step-3); }
h2 { font-size: var(--step-2); }
```

Use the [Utopia](https://utopia.fyi/) generator. Beautiful fluid typography across all viewports without a single media query.

### Spacing tokens

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
}
```

Map to a fluid scale if you want; keep one source of truth. Tailwind has this built in.

### Viewport units, modernized

- `vh` / `vw`: viewport height/width. Issues on mobile (URL bar shows/hides → `vh` jumps).
- `dvh` / `dvw`: dynamic viewport — adjusts with chrome.
- `svh` / `svw`: smallest viewport — when chrome is fully visible. Stable.
- `lvh` / `lvw`: largest viewport — when chrome is hidden. Stable.

For "fill the screen" UX on mobile: `100dvh`. For "stable height that doesn't jump": `100svh`.

---

## 8. Sass — when it still earns its keep

Most reasons to use Sass have evaporated:

| Sass feature | Modern CSS replacement |
|---|---|
| Nesting | Native CSS nesting (since 2023) |
| Variables | CSS custom properties (and they're runtime) |
| `@import` | `@import` (and `@layer` for ordering) |
| Color manipulation | `color-mix()`, `oklch()` |
| Math | `calc()`, `min()`, `max()`, `clamp()` |

Sass still helps for:

### 1. Build-time loops and mixins

```scss
// Generate a color palette programmatically
@each $name, $hue in (red: 0, orange: 30, yellow: 60, green: 120, blue: 240) {
  --color-#{$name}-500: oklch(0.6 0.2 #{$hue});
}

// A reusable pattern
@mixin focus-ring($color: var(--focus)) {
  &:focus-visible {
    outline: 2px solid $color;
    outline-offset: 2px;
  }
}
```

CSS doesn't have build-time iteration. Sass fits when generating large rule sets from data.

### 2. `@use` modules

```scss
// _typography.scss
@mixin heading($level) { /* ... */ }

// app.scss
@use 'typography' as t;
h1 { @include t.heading(1); }
```

The modern Sass module system (`@use`/`@forward`) replaces the old `@import` model. Encapsulated, no global namespace pollution.

### 3. Migration from a Sass codebase

Don't rewrite for the sake of it. Sass + native CSS coexist fine. Use what you have.

---

## 9. Tailwind tradeoffs

### Strengths

- **Atomic = no specificity wars**. Every utility is one class, low specificity.
- **No naming**. You don't invent `.left-sidebar-mobile-collapsed` names.
- **Design tokens enforced**. The scale is fixed; you can't drift to `padding: 17px`.
- **Tree-shaking**. Unused utilities don't ship.
- **Component composability**. `cva` (Class Variance Authority) makes typed variants ergonomic.

### Costs

- **HTML readability**. `<div className="flex items-center gap-4 px-6 py-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">` is a lot.
- **Hard to override per-instance**. You end up adding classes; specificity is flat so order matters.
- **Custom design systems** that don't fit Tailwind's scale require config changes.

### Tailwind v4 changes

- Config is now CSS-based (`@theme { --color-primary: ...; }`).
- No `tailwind.config.ts` for most projects.
- Engine is Rust-based, much faster.

### Patterns

```tsx
// `cn` helper for conditional classes
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Variants with cva
import { cva } from 'class-variance-authority';
const button = cva(['inline-flex', 'items-center', 'rounded'], {
  variants: {
    intent: { primary: ['bg-blue-500', 'text-white'], danger: ['bg-red-500', 'text-white'] },
    size: { sm: ['text-sm', 'px-3', 'py-1'], lg: ['text-lg', 'px-6', 'py-3'] },
  },
  defaultVariants: { intent: 'primary', size: 'sm' },
});
```

---

## 10. Old browser fallbacks with `@supports`

Modern features need fallbacks for older browsers — but only when you support them. Check `caniuse.com` against your browserslist.

```css
.cards {
  /* Fallback for browsers without Grid (vanishingly rare in 2025) */
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
@supports (display: grid) {
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}

/* Container queries */
.card { display: block; }
@supports (container-type: inline-size) {
  .card-container { container-type: inline-size; }
  @container (min-width: 600px) {
    .card { display: grid; grid-template-columns: 200px 1fr; }
  }
}
```

### `@supports not`

```css
@supports not (display: grid) {
  .cards { display: flex; flex-wrap: wrap; }
}
```

Useful when the modern code is the default and you only need to override for old browsers.

### What probably needs fallbacks (as of 2026)

- Old iOS Safari (< 16): missing `:has()`, container queries (until 16), `oklch` (until 15.4).
- IE 11 if you actually still support it: most modern CSS, including Grid (partial), CSS Variables (partial), Flexbox (partial). Heavy lift.

In practice: most apps in 2026 target modern browsers, and `@supports` blocks are rare. But check your browserslist before using bleeding-edge features.

---

## 11. Animations done right

### Animate compositor-friendly properties only

| Compositor-only (cheap) | Triggers paint (medium) | Triggers layout (expensive) |
|---|---|---|
| `transform` | `color`, `background-color` | `width`, `height`, `top`, `left` |
| `opacity` | `box-shadow` | `margin`, `padding` |
| `filter` (some) | `border-color` | `font-size` |

```css
/* ❌ Layout-thrashing */
.menu { transition: width 200ms; }
.menu.open { width: 200px; }

/* ✅ Compositor-only */
.menu { transition: transform 200ms; transform: translateX(-100%); }
.menu.open { transform: translateX(0); }
```

### `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Or: only animate when user is OK with it */
@media (prefers-reduced-motion: no-preference) {
  .menu { transition: transform 200ms; }
}
```

Respect users with motion sensitivity. It's an accessibility requirement, not a preference.

### View Transitions API

```js
if (document.startViewTransition) {
  document.startViewTransition(() => {
    // update DOM here
    setItems(newItems);
  });
}
```

```css
::view-transition-old(root) { animation-duration: 200ms; }
::view-transition-new(root) { animation-duration: 200ms; }
```

The browser captures before+after states, animates between them automatically. Magic for SPA transitions, list reorders, tab switches. Chromium-only as of writing; partial in Safari.

### CSS animations vs. JS animations

- **CSS** for state-driven, declarative animation (hover, focus, modal open, sidebar toggle).
- **JS (Framer Motion / Motion One / GSAP)** for orchestrated, gestural, or physics-based animation (drag, layout transitions, parallax, complex sequences).

Don't pull in Framer Motion for `transition: opacity 200ms`. It's bundle weight you don't need.

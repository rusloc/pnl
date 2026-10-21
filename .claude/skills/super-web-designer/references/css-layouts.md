# CSS & HTML Layouts Reference

## Table of Contents
1. [Layout Decision Matrix](#decision)
2. [CSS Grid — Complete Guide](#grid)
3. [Flexbox — Complete Guide](#flexbox)
4. [Modern Layout Techniques](#modern)
5. [Layout Patterns for Business Apps](#business-layouts)
6. [Layout Patterns for Entertainment/Kids](#entertainment-layouts)
7. [Pros, Cons & Limitations](#tradeoffs)
8. [Semantic HTML Structure](#semantic)

---

## 1. Layout Decision Matrix <a id="decision"></a>

| Layout need | Best tool | Why |
|------------|-----------|-----|
| 2D page layout (rows + columns) | CSS Grid | Grid handles both dimensions |
| 1D alignment (row OR column) | Flexbox | Simpler than Grid for single axis |
| Component-internal layout | Flexbox | Button contents, nav items, card internals |
| Full page structure | Grid | Named areas, explicit track control |
| Equal-height cards in a row | Grid | `grid-template-rows: 1fr` inherently equal |
| Centering anything | Grid or Flex | Grid: `place-items: center`. Flex: `align-items: center; justify-content: center` |
| Overlapping elements | Grid | `grid-area` stacking or negative margins |
| Responsive card grid | Grid `auto-fill` | No media queries needed |
| Inline elements with wrapping | Flexbox `flex-wrap` | Natural flow |
| Sidebar + main content | Grid | `grid-template-columns: 250px 1fr` |
| Sticky footer | Grid | `grid-template-rows: auto 1fr auto` |

---

## 2. CSS Grid <a id="grid"></a>

### Basic Grid
```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
```

### Named Grid Areas (best for page layouts)
```css
.page {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  grid-template-columns: 240px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}
.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }

/* Responsive: stack on mobile */
@media (max-width: 768px) {
  .page {
    grid-template-areas:
      "header"
      "main"
      "sidebar"
      "aside"
      "footer";
    grid-template-columns: 1fr;
  }
}
```

### Auto-Responsive Grid (no media queries)
```css
/* Cards auto-wrap when narrower than 300px */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}
```

### Subgrid (align nested grid items to parent tracks)
```css
.parent {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.child {
  display: grid;
  grid-column: span 3;
  grid-template-columns: subgrid; /* Inherits parent's column tracks */
}
```

### Grid Alignment
```css
/* Container alignment */
justify-content: start | center | end | space-between | space-around;  /* horizontal */
align-content: start | center | end | space-between;                    /* vertical */

/* Item alignment */
justify-items: start | center | end | stretch;  /* all items horizontal */
align-items: start | center | end | stretch;     /* all items vertical */

/* Single item */
.item { justify-self: center; align-self: end; }

/* Center everything (the holy grail) */
.center-all { display: grid; place-items: center; }
```

### Grid Tricks
```css
/* Overlap elements with grid stacking */
.stacked {
  display: grid;
}
.stacked > * {
  grid-area: 1 / 1; /* All children in same cell */
}

/* Full-bleed within a constrained grid */
.full-bleed {
  grid-column: 1 / -1;
}
```

---

## 3. Flexbox <a id="flexbox"></a>

### Basic Flexbox
```css
.flex { display: flex; gap: 1rem; }
.flex-col { display: flex; flex-direction: column; gap: 1rem; }
```

### Flexbox Alignment
```css
/* Main axis (horizontal by default) */
justify-content: flex-start | center | flex-end | space-between | space-around | space-evenly;

/* Cross axis (vertical by default) */
align-items: flex-start | center | flex-end | stretch | baseline;

/* Perfect center */
.center { display: flex; justify-content: center; align-items: center; }
```

### Flex Item Control
```css
/* Grow to fill space */
.grow { flex: 1; }

/* Don't shrink below content */
.no-shrink { flex-shrink: 0; }

/* Fixed + fluid layout */
.sidebar { flex: 0 0 250px; }    /* fixed 250px */
.content { flex: 1; min-width: 0; }  /* fill remaining, allow truncation */
```

### Flex Wrap
```css
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
```

### Common Flexbox Patterns
```css
/* Push last item to the right (e.g., nav with login button) */
.nav { display: flex; gap: 1rem; }
.nav .login { margin-left: auto; }

/* Stack on mobile, row on desktop */
.stack-to-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (min-width: 768px) {
  .stack-to-row { flex-direction: row; }
}
```

---

## 4. Modern Layout Techniques <a id="modern"></a>

### CSS `dvh` / `svh` / `lvh` Units (viewport height that works on mobile)
```css
/* dvh = dynamic viewport height (accounts for mobile browser chrome) */
.hero { min-height: 100dvh; }

/* svh = smallest possible viewport, lvh = largest */
.full-screen { height: 100svh; } /* Safe — never taller than visible area */
```

### `has()` Selector (parent selector — game changer)
```css
/* Style parent based on child state */
.form-group:has(input:invalid) { border-color: red; }
.card:has(img) { padding-top: 0; }    /* Card with image: no top padding */
.grid:has(> :nth-child(4)) { grid-template-columns: repeat(2, 1fr); }  /* 4+ items: 2 cols */
```

### Scroll-Driven Animations (no JavaScript needed)
```css
/* Animate on scroll */
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } }

.reveal {
  animation: fadeIn linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

### CSS Nesting (native — no preprocessor needed)
```css
.card {
  padding: 1.5rem;
  border-radius: 12px;

  & .title {
    font-size: 1.25rem;
    font-weight: 600;
  }

  &:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }

  @media (max-width: 768px) {
    padding: 1rem;
  }
}
```

### Anchor Positioning (CSS-only popovers/tooltips — emerging)
```css
.trigger { anchor-name: --my-trigger; }
.tooltip {
  position: fixed;
  position-anchor: --my-trigger;
  top: anchor(bottom);
  left: anchor(center);
}
```

### Popover API (native HTML — no JS library needed)
```html
<button popovertarget="menu">Open</button>
<div id="menu" popover>
  <p>Menu content</p>
</div>
```

### View Transitions (page transitions — no framework needed)
```css
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out;
}
::view-transition-new(root) {
  animation: fade-in 0.3s ease-in;
}
```

---

## 5. Business App Layouts <a id="business-layouts"></a>

### Dashboard Layout (sidebar + header + content)
```css
.dashboard {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar content";
  height: 100dvh;
}

/* Collapse sidebar on mobile */
@media (max-width: 1024px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "content";
  }
  .sidebar { position: fixed; transform: translateX(-100%); transition: transform 0.3s; }
  .sidebar.open { transform: translateX(0); }
}
```

### Landing Page Layout
```css
.landing {
  display: grid;
  grid-template-rows: auto;
}
.section {
  display: grid;
  grid-template-columns: minmax(1rem, 1fr) minmax(0, 1200px) minmax(1rem, 1fr);
}
.section > * { grid-column: 2; }
.section .full-width { grid-column: 1 / -1; }
```

### Data Table Layout
```css
.data-grid {
  display: grid;
  grid-template-columns: 60px repeat(auto-fit, minmax(120px, 1fr)) 100px;
  align-items: center;
}
.data-grid .row { display: contents; }  /* Let children participate in parent grid */
.data-grid .row:hover > * { background: var(--gray-50); }
```

---

## 6. Entertainment / Kids Layouts <a id="entertainment-layouts"></a>

### Full-Screen Hero with Parallax
```css
.hero {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  overflow: hidden;
  position: relative;
}
.hero-bg {
  position: absolute;
  inset: -10%;
  background: url('bg.jpg') center/cover;
  transform: translateZ(-1px) scale(1.5);
}
.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
}
```

### Magazine / Editorial Layout
```css
.magazine {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1rem;
}
.feature { grid-column: span 4; grid-row: span 2; }
.small   { grid-column: span 2; }
.wide    { grid-column: span 6; }
```

### Character Grid (for kids games / movie casts)
```css
.character-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
}
.character {
  flex: 0 0 200px;
  text-align: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.character:hover { transform: scale(1.1) rotate(-3deg); }
```

---

## 7. Pros, Cons & Limitations <a id="tradeoffs"></a>

### CSS Grid
| Pros | Cons | Limitations |
|------|------|-------------|
| True 2D layout | Slightly more complex syntax | No masonry layout (yet — `grid-template-rows: masonry` is experimental) |
| Named areas for readability | Less intuitive for dynamic content | Subgrid support still incomplete in some browsers |
| Explicit track sizing | Overkill for simple linear layouts | Cannot do content-based auto-sizing in both dimensions simultaneously |
| Overlap without `position` | — | — |

### Flexbox
| Pros | Cons | Limitations |
|------|------|-------------|
| Simple 1D layout | Only one axis at a time | Can't do 2D alignment easily |
| Content-based sizing | Equal-height cards require hacks without Grid | `flex-basis` vs `width` confusion |
| Great for component internals | Wrapping math is imprecise | No named areas |
| Wide browser support | — | — |

### Container Queries
| Pros | Cons | Limitations |
|------|------|-------------|
| Component-level responsiveness | Requires containment context setup | No height-based queries for inline-size containment |
| Better for design systems | Slightly newer browser support | Can't query non-ancestor containers |
| Works with any layout method | — | — |

### Position-Based Layouts (absolute/fixed/sticky)
| Pros | Cons | Limitations |
|------|------|-------------|
| Overlap, z-axis control | Removed from flow | Absolute elements don't affect parent size |
| Sticky headers/sidebars | Can cause overflow issues | Sticky fails inside `overflow: hidden` ancestors |
| Fixed modals/toasts | Manual sizing and positioning | Fixed elements on mobile have keyboard issues |

---

## 8. Semantic HTML Structure <a id="semantic"></a>

### Page Structure Template
```html
<body>
  <header>
    <nav aria-label="Main navigation">
      <a href="/" aria-label="Home">Logo</a>
      <ul role="list">
        <li><a href="/about">About</a></li>
        <li><a href="/work">Work</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section aria-labelledby="hero-heading">
      <h1 id="hero-heading">Page Title</h1>
      <p>Introduction text</p>
    </section>

    <section aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
      <article>...</article>
      <article>...</article>
    </section>
  </main>

  <aside aria-label="Related content">
    <h2>Sidebar</h2>
  </aside>

  <footer>
    <nav aria-label="Footer navigation">...</nav>
    <p>&copy; 2026 Company</p>
  </footer>
</body>
```

### When to Use Each Semantic Element
| Element | Use for |
|---------|---------|
| `<header>` | Site or section header (logo, nav) |
| `<nav>` | Navigation links (add `aria-label` if multiple navs) |
| `<main>` | Primary page content (one per page) |
| `<section>` | Thematic grouping with a heading |
| `<article>` | Self-contained content (blog post, product card) |
| `<aside>` | Tangentially related content (sidebar, callout) |
| `<footer>` | Site or section footer |
| `<figure>` + `<figcaption>` | Images/diagrams with captions |
| `<details>` + `<summary>` | Expandable/collapsible content (native accordion) |
| `<dialog>` | Modal dialogs (native, accessible) |
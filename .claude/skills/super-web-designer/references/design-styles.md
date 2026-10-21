# Design Styles Reference

## Table of Contents
1. [Modern Style Libraries & Design Systems](#modern-style-libraries)
2. [Minimal Business App Styles](#minimal-business)
3. [Kids / Movie / Entertainment Styles](#kids-movie-entertainment)
4. [Style Selection Decision Tree](#decision-tree)
5. [Inspiration Galleries & How to Use Them](#inspiration)

---

## 1. Modern Style Libraries & Design Systems <a id="modern-style-libraries"></a>

### Tier 1 — Industry-Standard Design Systems (study these for patterns)
- **Apple Human Interface Guidelines** — https://developer.apple.com/design/human-interface-guidelines/
  Best for: spatial design, clarity, depth, motion principles
- **Material Design 3 (Google)** — https://m3.material.io/
  Best for: dynamic color, adaptive layouts, component specs, motion tokens
- **Fluent 2 (Microsoft)** — https://fluent2.microsoft.design/
  Best for: enterprise apps, depth/shadow systems, accessibility-first design
- **Carbon (IBM)** — https://carbondesignsystem.com/
  Best for: data-heavy dashboards, structured layouts, dark-mode patterns
- **Atlassian Design System** — https://atlassian.design/
  Best for: productivity tools, team collaboration UIs, token architecture
- **Primer (GitHub)** — https://primer.style/
  Best for: developer tools, code-centric interfaces, accessible components

### Tier 2 — Component Libraries (use for implementation)
- **shadcn/ui** — https://ui.shadcn.com/ — Copy-paste Radix+Tailwind components, highly customizable
- **Radix UI** — https://www.radix-ui.com/ — Unstyled accessible primitives
- **Headless UI** — https://headlessui.com/ — Tailwind Labs unstyled components
- **Chakra UI** — https://chakra-ui.com/ — Themeable React component library
- **Mantine** — https://mantine.dev/ — Full-featured React components with excellent defaults
- **Ant Design** — https://ant.design/ — Enterprise-grade React UI library
- **DaisyUI** — https://daisyui.com/ — Tailwind CSS component classes

### Tier 3 — CSS Frameworks & Utility Systems
- **Tailwind CSS** — https://tailwindcss.com/ — Utility-first CSS framework
- **Open Props** — https://open-props.style/ — CSS custom property system with sensible defaults
- **Pico CSS** — https://picocss.com/ — Minimal semantic CSS with automatic styling
- **MVP.css** — https://andybrewer.github.io/mvp/ — Minimal viable styles for HTML elements

### Animation Libraries
- **Framer Motion** — https://www.framer.com/motion/ — React animation (production standard)
- **GSAP** — https://gsap.com/ — Professional-grade animation for any framework
- **Lottie** — https://lottiefiles.com/ — After Effects animations for web
- **Anime.js** — https://animejs.com/ — Lightweight JS animation
- **CSS Spring** — Native CSS `transition-timing-function: spring()` — emerging standard

---

## 2. Minimal Business App Styles <a id="minimal-business"></a>

### Style: Swiss/International
- Grid-based, mathematical precision
- Helvetica Neue, Suisse Intl, or Söhne as primary typeface
- Black + white + one accent color
- Strong horizontal/vertical rhythm
- Example sites: stripe.com, linear.app

### Style: Soft Corporate
- Rounded corners (8-16px), soft shadows (`box-shadow: 0 1px 3px rgba(0,0,0,0.08)`)
- Warm neutrals (not pure gray — add a hint of blue or warm tone)
- Generous padding (24-48px sections)
- System or geometric sans-serif (SF Pro, Inter as fallback)
- Example sites: notion.so, mercury.com

### Style: Editorial Business
- Strong typographic hierarchy using serif + sans-serif pairing
- Magazine-like layouts with pull quotes and large imagery
- Sophisticated color — navy, cream, burgundy, forest green
- Example sites: stripe.com/press, pitch.com

### Style: Dashboard Density
- Compact spacing (8-16px gutters)
- Monospace for data, sans-serif for labels
- Color-coded status indicators — use semantic colors consistently
- Subtle borders (1px, low-opacity) to delineate sections
- Example: vercel.com/dashboard, grafana dashboards, linear.app

### Style: Neo-Brutalist Business
- High contrast, bold borders (2-4px solid black)
- Flat colors, no gradients, no shadows
- Offset elements, asymmetric layouts
- Monospace or geometric sans-serif typography
- Example sites: gumroad.com, poolsuite.net

### Spacing Scale for Business Apps
```
4px   — tight gaps, inline spacing
8px   — compact element padding
12px  — standard inner padding
16px  — card padding, section gaps
24px  — section padding
32px  — large section breaks
48px  — hero padding
64px  — page-level sections
96px  — major section separators
```

---

## 3. Kids / Movie / Entertainment Styles <a id="kids-movie-entertainment"></a>

### Style: Pixar/Animated
- Rounded everything: buttons, cards, containers (border-radius: 16-24px)
- Bright, saturated primaries with friendly pastels
- Bouncy animations (spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Illustrated elements mixed with UI components
- Oversized, friendly typography (Comic Neue, Baloo, Bubblegum Sans)
- Example: disney.com, pbs.org/kids

### Style: Cinematic/Blockbuster
- Full-bleed hero imagery or video backgrounds
- Dark theme with dramatic lighting effects (radial gradients, lens flares via CSS)
- Cinematic typography: condensed, uppercase, wide letter-spacing
- Parallax scrolling with depth layers
- Color grading: teal+orange, dark blue+gold, red+black
- Example: marvel.com, starwars.com

### Style: Retro Gaming
- Pixel art aesthetic, 8-bit inspired
- Neon colors on dark backgrounds
- Monospace or pixel fonts (Press Start 2P, VT323, Silkscreen)
- CRT scan-line effects via CSS (repeating-linear-gradient overlays)
- Glitch text effects, blinking cursors
- Example: retrogames portals, indie game landing pages

### Style: Kawaii / Japanese Pop
- Pastel palette: soft pink, lavender, mint, baby blue, cream
- Super-rounded corners (20-32px)
- Cute icon systems, character mascots
- Decorative elements: stars, hearts, sparkles, clouds
- Fonts: rounded sans-serifs (Nunito, Varela Round, Quicksand)
- Subtle confetti or floating particle animations

### Style: Theme Park / Immersive
- Rich textures: wood, metal, stone, fabric via CSS gradients and patterns
- Themed color palettes matching a world (jungle, space, underwater, medieval)
- Custom cursors, themed scrollbars
- Sound design integration (Tone.js for ambient sound)
- Layered parallax creating depth
- Ornamental borders and frames

### Animation Cookbook for Entertainment
```css
/* Bounce entrance */
@keyframes bounceIn {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
}

/* Float/hover idle animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Sparkle/twinkle */
@keyframes twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}

/* Cinematic text reveal */
@keyframes revealText {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}

/* Parallax layer speeds */
.parallax-bg   { transform: translateZ(-2px) scale(3); }
.parallax-mid  { transform: translateZ(-1px) scale(2); }
.parallax-fg   { transform: translateZ(0); }
```

---

## 4. Style Selection Decision Tree <a id="decision-tree"></a>

```
Is this a business/professional application?
├── YES → Is it data-heavy?
│   ├── YES → Dashboard Density or Carbon-inspired
│   └── NO  → Is the brand playful or serious?
│       ├── PLAYFUL → Soft Corporate or Neo-Brutalist
│       └── SERIOUS → Swiss/International or Editorial
└── NO  → Is it for children (under 12)?
    ├── YES → Is it educational?
    │   ├── YES → Pixar/Animated + structured layout
    │   └── NO  → Kawaii or Theme Park
    └── NO  → Is it entertainment/media?
        ├── YES → Is it cinematic/dramatic?
        │   ├── YES → Cinematic/Blockbuster
        │   └── NO  → Retro Gaming or Theme Park
        └── NO  → Blend business + entertainment elements
```

---

## 5. Inspiration Galleries <a id="inspiration"></a>

### How to Use Inspiration Sites
- **Site of Sites** (https://www.siteofsites.co/?p=1) — Browse by visual style. Great for finding
  unconventional layouts and typography treatments. Study the hero sections specifically.
- **siteInspire** (https://www.siteinspire.com/) — Filter by style (minimal, illustration, etc.),
  type (portfolio, e-commerce, etc.), and subject. Best for finding industry-specific references.
- **Awwwards** (https://www.awwwards.com/) — Filter by technology, color, and features. Read the
  scoring criteria (design, usability, creativity, content) to understand what judges look for.

### Extracting Design Decisions from Reference Sites
When studying a reference site, extract these specific decisions:
1. **Type stack** — What fonts? What sizes? What line-heights?
2. **Color count** — How many colors total? What's the ratio of neutral to accent?
3. **Spacing rhythm** — What's the base unit? How does it scale?
4. **Motion budget** — How many animations? What's the total motion density?
5. **Layout strategy** — Grid? Flexbox? How many columns? Where do they break?
6. **Signature element** — What's the ONE thing that makes this site memorable?
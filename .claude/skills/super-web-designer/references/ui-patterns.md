# UI Patterns & Solutions Reference

## Table of Contents
1. [Navigation Patterns](#navigation)
2. [Card & Content Patterns](#cards)
3. [Form & Input Patterns](#forms)
4. [Dashboard Patterns](#dashboards)
5. [Feedback & Status Patterns](#feedback)
6. [Modal & Overlay Patterns](#modals)
7. [Onboarding & Empty States](#onboarding)
8. [Kids / Entertainment UI Patterns](#kids)
9. [Performance Patterns](#performance)

---

## 1. Navigation Patterns <a id="navigation"></a>

### Horizontal Navbar (desktop standard)
```
┌─────────────────────────────────────────────┐
│ Logo    Home  Products  About     🔍  Login  │
└─────────────────────────────────────────────┘
```
- Use for: marketing sites, simple apps, up to 7 top-level items
- Mobile: collapse to hamburger or bottom tab bar
- Active state: underline, bold, or background highlight — never just color alone
- Sticky: `position: sticky; top: 0;` with backdrop blur

### Sidebar Navigation (app standard)
```
┌──────────┬───────────────────────┐
│ Logo     │ Page Title            │
│ ─────    │                       │
│ 📊 Dash  │  Content area         │
│ 👥 Users │                       │
│ ⚙ Settings│                      │
│          │                       │
│ ─────    │                       │
│ Profile  │                       │
└──────────┴───────────────────────┘
```
- Use for: SaaS dashboards, admin panels, tools with 5+ sections
- Collapsible: icon-only mode at 64px wide, expanded at 240px
- Group items with section labels (not just dividers)
- Bottom-pin: settings, profile, logout

### Bottom Tab Bar (mobile apps)
```
┌────────────────────────────────┐
│                                │
│        Page Content            │
│                                │
├──────┬──────┬──────┬──────┬────┤
│ 🏠   │ 🔍   │ ➕   │ 💬   │ 👤 │
│ Home │Search│ New  │ Chat │ Me │
└──────┴──────┴──────┴──────┴────┘
```
- Max 5 items
- Active: filled icon + label, inactive: outline icon + muted label
- Center item can be elevated (FAB-style) for primary action
- Safe area padding: `padding-bottom: env(safe-area-inset-bottom);`

### Breadcrumbs
```
Home > Products > Category > Item Name
```
- Use for: hierarchical content (e-commerce, documentation, file browsers)
- Current page should NOT be a link
- Use `>` or `/` separator (not `→`)
- Truncate middle items on mobile: `Home > ... > Item Name`

### Command Palette (power user pattern)
- Triggered by `Cmd+K` / `Ctrl+K`
- Fuzzy search across actions, pages, settings
- Use for: developer tools, productivity apps, admin panels
- Implementation: dialog + input + filtered list

---

## 2. Card & Content Patterns <a id="cards"></a>

### Standard Card
```css
.card {
  background: var(--surface-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}
```

### Card Variants
| Type | Use case | Key feature |
|------|----------|-------------|
| **Basic** | Info display | Icon + title + description |
| **Media** | Products, portfolio | Top image + content below |
| **Horizontal** | List items, search results | Image left + content right |
| **Stat** | Dashboards, KPIs | Large number + label + trend indicator |
| **Action** | Settings, onboarding | Content + button/toggle |
| **Profile** | Team pages, social | Avatar + name + meta + actions |

### Content Hierarchy in Cards
1. **Visual anchor** — image, icon, or status color
2. **Title** — what is this? (bold, larger)
3. **Metadata** — when, who, where (small, muted)
4. **Description** — details (regular weight, 2-3 lines max)
5. **Actions** — what can I do? (buttons, links at bottom)

### List vs Grid Decision
- **Use list** when: comparing items, scanning metadata, sequential data
- **Use grid** when: browsing visually, items are equal weight, discovery mode

---

## 3. Form & Input Patterns <a id="forms"></a>

### Form Layout Rules
- Labels above inputs (never floating labels for critical forms — they hide context)
- Group related fields (name + email = "Contact Info" group)
- One column for most forms; two columns only for tightly related fields (first/last name, city/state)
- Primary action button aligned left (LTR) or full-width on mobile
- Inline validation on blur, not on every keystroke

### Input States
```css
.input {
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  font-size: 1rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}
.input:invalid:not(:placeholder-shown) {
  border-color: var(--error);
}
.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Button Hierarchy
```
Primary:   solid background, white text         → 1 per view
Secondary: outlined or subtle background        → supporting actions
Ghost:     text-only, no background             → tertiary actions
Danger:    red tones                             → destructive actions
```

### Button Sizing
```css
.btn-sm  { padding: 0.375rem 0.75rem; font-size: 0.875rem; }  /* Compact tables */
.btn-md  { padding: 0.5rem 1rem; font-size: 0.9375rem; }      /* Standard */
.btn-lg  { padding: 0.75rem 1.5rem; font-size: 1.0625rem; }   /* Hero CTAs */
```

### Smart Defaults
- Dropdowns: show 5-7 items, then scroll
- Date pickers: default to today, not empty
- Toggles for binary choices (not checkboxes)
- Radio buttons for 2-5 mutually exclusive options
- Dropdowns for 6+ options
- Autofocus the first input on page load

---

## 4. Dashboard Patterns <a id="dashboards"></a>

### KPI Row
```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ Revenue  │  │ Users   │  │ Conv.   │  │ Churn   │
│ $84.2K   │  │ 12,847  │  │ 3.42%   │  │ 1.1%    │
│ ▲ 12.5%  │  │ ▲ 8.3%  │  │ ▼ 0.5%  │  │ ▲ 0.2%  │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
```
- 3-4 KPIs maximum per row
- Always show trend direction (▲▼) and period comparison
- Color-code: green = good, red = bad (based on context, not direction)

### Dashboard Layout Grid
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1.5rem;
}
.kpi-row   { grid-column: span 3; }   /* 4 across */
.chart-lg  { grid-column: span 8; }   /* Main chart */
.chart-sm  { grid-column: span 4; }   /* Side chart */
.table     { grid-column: span 12; }  /* Full width */
```

### Data Visualization Principles
- Use color consistently: same metric = same color everywhere
- Label axes directly (no legend if possible)
- Start y-axis at 0 for bar charts, not for line charts
- Limit pie charts to 5 slices (group the rest as "Other")
- Use sparklines for inline trends in tables

---

## 5. Feedback & Status Patterns <a id="feedback"></a>

### Toast Notifications
- Position: top-right (desktop), top-center (mobile)
- Auto-dismiss: 4-5 seconds for success, persist for errors
- Stack with gap (don't overlay)
- Include dismiss button (×)
- Types: success (green), error (red), warning (amber), info (blue)

### Loading States
| Type | Use when |
|------|----------|
| **Skeleton** | Page/component first load — show content shape |
| **Spinner** | Button/action in progress — user-initiated |
| **Progress bar** | Known duration — file upload, multi-step |
| **Shimmer** | List/feed loading — repeating skeleton pulse |
| **Optimistic UI** | Instant feedback — show change before server confirms |

### Skeleton Loading Pattern
```css
.skeleton {
  background: linear-gradient(90deg,
    var(--gray-200) 25%,
    var(--gray-100) 50%,
    var(--gray-200) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Error States
- Inline errors: red text below the field, red border on the field
- Page-level errors: banner at top with clear action ("Try again")
- 404 pages: friendly message + search + popular links
- Empty states: illustration + explanation + primary action button

---

## 6. Modal & Overlay Patterns <a id="modals"></a>

### Dialog (native HTML)
```html
<dialog id="confirm">
  <h2>Confirm Action</h2>
  <p>Are you sure?</p>
  <button onclick="this.closest('dialog').close()">Cancel</button>
  <button onclick="confirm()">Confirm</button>
</dialog>
```

### Modal Rules
- Focus trap: tab should cycle within modal
- Close on Escape key
- Close on backdrop click (except for critical actions)
- Max-width: 480px for simple, 640px for medium, 960px for complex
- Don't nest modals — use a different pattern (drawer, page navigation)

### Sheet / Drawer (mobile-friendly)
- Slide from bottom (mobile) or right (desktop)
- Drag to dismiss on mobile
- Use for: filters, detail panels, forms, settings
- Always include a close button (don't rely only on swipe)

### Popover / Dropdown
- Position near trigger (use CSS anchor positioning or `popover` API)
- Dismiss on click outside
- Max height with scroll for long lists
- Keep within viewport bounds

---

## 7. Onboarding & Empty States <a id="onboarding"></a>

### First-Time User Experience
1. **Welcome modal** — brief, skippable, max 3 steps
2. **Feature tooltips** — point to key UI elements, sequential
3. **Template/preset selection** — "Start with a template" vs "Start from scratch"
4. **Progressive disclosure** — show basics first, reveal advanced features over time

### Empty State Pattern
```
┌────────────────────────────┐
│                            │
│      [Illustration]        │
│                            │
│    No projects yet         │
│    Create your first       │
│    project to get started  │
│                            │
│    [+ Create Project]      │
│                            │
└────────────────────────────┘
```
- Always include: visual, explanation, primary action
- Make the empty state feel inviting, not broken
- Optionally include: template suggestions, import option

---

## 8. Kids / Entertainment UI Patterns <a id="kids"></a>

### Character Selection Grid
- Large, touchable cards (min 120×120px)
- Bounce or wiggle animation on hover/tap
- Star/badge indicators for unlocked vs locked
- Sound effect triggers on selection (use Tone.js sparingly)

### Progress / Achievement System
```
⭐⭐⭐☆☆  Level 3 — "Space Explorer"
████████░░░░ 67% to next level
```
- Use visual progress (bars, circles, paths) not just numbers
- Celebrate milestones: confetti, animation, sound
- Keep it visible but not distracting

### Scroll-Based Storytelling
- Full-viewport sections that transition on scroll
- Parallax layers: background moves slower, foreground faster
- Text reveals timed to scroll position
- Use `scroll-snap-type: y mandatory` for section-locked scrolling

### Interactive Elements for Kids
- Oversized buttons (min 64×64px, ideally 80×80px)
- Audio feedback on interactions
- Drag and drop with generous hit areas
- Shake/wiggle animations on invalid actions (friendly, not punishing)
- Bright color coding: green = yes/correct, red = try again

### Movie / Streaming UI Patterns
- Horizontal scroll carousels with snap points
- Hero banner with video autoplay (muted) and gradient overlay
- Category rows: "Trending", "New Releases", "Continue Watching"
- Hover-to-expand card previews (Netflix-style)
- Rating display: stars, percentage match, or age rating badge

---

## 9. Performance Patterns <a id="performance"></a>

### CSS Performance
- Avoid `*` selectors in large DOMs
- Use `will-change` sparingly (only on elements about to animate)
- Prefer `transform` and `opacity` for animations (GPU-accelerated)
- Use `content-visibility: auto` for offscreen content
- Avoid layout thrashing: batch DOM reads before writes

### Image Performance
```css
/* Lazy load all images below the fold */
img[loading="lazy"] { /* browser handles natively */ }

/* Prevent layout shift */
img { aspect-ratio: 16 / 9; width: 100%; height: auto; }

/* Use modern formats */
/* WebP is 25-35% smaller than JPEG. AVIF is 50% smaller. */
```

### Font Performance
- Preconnect to font CDN
- Use `font-display: swap`
- Subset fonts for specific languages
- Max 2 families, 4 files total

### Core Web Vitals Targets
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4s | > 4s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |
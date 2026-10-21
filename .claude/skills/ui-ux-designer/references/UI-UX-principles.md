# UI/UX Principles Reference

Consolidated principles drawn from proven UI/UX practice. Apply these when sketching any major block. These rules are *guidelines with teeth* — break them only when you can articulate why doing so serves the user better than following them.

## The ten core principles

### 1. Start with user intent, not visuals
Design begins with the question "what is the user here to do?" Build the layout around guiding them to that action. Visuals are the last layer, not the first. If you catch yourself picking colors before you've named the primary action, stop and go back.

### 2. Follow established layout expectations
Information flows **top to bottom, left to right** in most cultures. Navigation lives at the top. Primary CTAs are easy to find — typically above the fold, in the natural reading path, or sticky if the content is long. Breaking expectations costs you users for every "clever" choice.

### 3. The 60-30-10 color rule
A balanced interface uses roughly:
- **60% neutral** (white, off-white, light gray, or dark-mode equivalent)
- **30% complementary** (a secondary color or a tint/shade of the neutral)
- **10% brand/accent** (reserved for the primary action and moments that earn it)

A variant: use different shades and tints of a single color to create balance without a second hue. Either way, the brand color is a scarce resource — spend it where it matters.

### 4. Typography discipline
- **Roughly four font sizes, two weights.** Six sizes and four weights is visual chaos.
- **Monospace for numbers that might grow** (prices, counts, metrics, timestamps) — prevents layout collisions when values change.
- **Strong contrast for hierarchy.** If the heading is only slightly bigger than the body text, it isn't a heading.

### 5. The 8-point (or 4-point) grid
Every spacing value should be divisible by 8, or at minimum 4. Use 24px, not 25px. Use 16px, not 13px. This creates a calculated, professional structure and eliminates the "random and drifty" feel of ad-hoc spacing.

### 6. Scannable content with progressive disclosure
Show the user only what they need to decide or act right now. Location, rating, price — visible. Full reviews, detailed specs, fine print — behind an expander or a later screen. Always design for edge cases: truncate long names gracefully, ensure icons have contrast against every background they might appear on, handle empty states.

### 7. Reuse visual patterns
The same action should look and live in the same place across every block. Same icon for "edit" everywhere. Same button treatment for "save" everywhere. Same animation for "successful action" everywhere. This is what lets users learn the app once.

### 8. Prioritize simplicity in dashboards
Dashboards specifically: strict grids, smaller-than-normal font sizes (dense but legible), most critical metrics at the top. Use micro-interactions like bulk actions to save space. Don't use weird unrecognizable chart types — bar, line, and number readouts cover 90% of real needs.

### 9. Optimistic UI
When the user acts (delete, save, toggle), the UI updates *immediately*, assuming the backend will succeed. Roll back only on failure. This is the single biggest perceived-speed improvement you can make.

### 10. Treat the UI like a movie
Don't design screens in isolation. Consider how they connect — what the user sees before, during, and after each block. A cohesive journey beats a sequence of individually-polished but disconnected screens.

## Common mistakes to avoid

These are the most frequent ways UIs go wrong. Scan the sketch against this list before finalizing.

### Overcomplicating visuals for the sake of "art"
Flashy gradients, heavy skeuomorphic shadows, blur effects everywhere — if the visual flair gets in the way of guiding the user to an action, cut it. Visual complexity is a tax users pay; it must earn its keep.

### Poor and wordy copywriting
Four words when one will do. Ambiguous button labels. Marketing fluff where a verb would work. Every extra word is cognitive load. "Get started" beats "Begin your journey with us today."

### Overusing strong colors
If everything is red/orange/bright-accent, nothing is. Strong colors work by contrast. A sea of red is stressful to look at and nothing captures attention.

### Font chaos
Six font sizes, four weights, three font families. Impossible to make look good. Keep the ratio tight (see principle 4).

### Random spacing
Pixel values pulled from nowhere — 13px here, 27px there, 9px over there. The interface *feels* off even if users can't name why. Stick to the grid.

### Cluttered dashboards
"Someone emptied a drawer onto the screen." Every widget screaming for attention. Weird chart types no one recognizes. Strip it back to the metrics that actually drive decisions.

### Unnecessary animations and scrolljacking
Animations that don't add clarity or functionality are just friction. Scrolljacking (hijacking the user's scroll to force a narrative) is one of the most hated patterns on the web. Use both sparingly, if ever.

### Infinite scroll traps
Infinite scroll that prevents users from ever reaching the footer is a usability failure. A "load more" button gives the user control and preserves access to the page's full structure.

## Quick reference — the discoverability check

Before shipping any sketch, answer these three questions:

1. **Squint test:** If I blur this, does the primary action still stand out?
2. **Five-second test:** Would a brand-new user know what this block is *for* and what to do next after five seconds?
3. **One obvious next step test:** From anywhere on the block, is there one obvious next step?

If any answer is "no," the hierarchy needs more work — not more decoration.
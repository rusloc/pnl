---
name: ui-ux-designer
description: Sketch and design the MAJOR structural blocks of an app or website — landing pages, pricing and services pages, contact sections, audio/video player layouts, personal account and profile pages — with a laser focus on ease of use and feature discoverability. Use whenever the user wants to design, wireframe, sketch, mock up, plan, lay out, or restructure a significant page or app section, even without saying "UI/UX." Trigger on requests like "design my landing page," "structure my pricing page," "lay out the audio player," "sketch a contacts page," "plan my user profile," "where should the play button go," "make my CTA more prominent," or "my dashboard feels cluttered, help me rethink it." Scoped to MAJOR blocks — not individual buttons, icons, or microelements — and applies proven principles (60-30-10 color, 8-point grid, top-to-bottom flow, progressive disclosure, typography discipline) to maximize the discoverability of each block's primary action. Also trigger when critiquing an existing layout.
---

# UI/UX Designer — Major Block Sketching

A skill for sketching and laying out the **major structural blocks** of a web or mobile application. This skill is deliberately scoped to the *big picture* — it does not obsess over button radii, micro-shadows, or individual icons. It focuses on **where things go** and **whether the user can find what matters**.

## Core philosophy

Two goals dominate every decision in this skill, in this order:

1. **Discoverability of the primary action.** Every major block has one thing the user is there to do. On a landing page, it's clicking the CTA. On an audio player, it's pressing play. On a contacts page, it's reaching out. The design exists to make that action impossible to miss.
2. **Ease of use.** Everything else — secondary actions, content, options — should follow a predictable, low-friction layout. The user should not have to think about where to look.

If a visual choice doesn't serve one of these two goals, cut it.

## When this skill applies — and when it doesn't

**Use this skill for:**
- Landing pages / home pages / marketing pages
- Pricing pages / services pages / plans-and-tiers pages
- Contact sections (standalone pages or footer blocks)
- Audio or video player layouts, including the embed surface/placement
- Personal account pages, profile pages, settings hubs, user dashboards
- Any similar "major block" where the arrangement of elements determines whether users succeed

**Do NOT use this skill for:**
- Designing individual components (a single button, a tooltip, an icon)
- Pixel-level visual polish (exact colors, shadow values, border radii)
- Branding, logo design, or illustration work
- Copywriting beyond headline/CTA clarity

If the user is asking about microelements, tell them this skill is for major blocks and ask whether they want to zoom out to the block level instead.

## The universal sketching workflow

Apply this five-step process to any major block. Do not skip steps, and do not start with visuals.

### Step 1 — Identify user intent and the primary action

Before anything else, answer out loud:
- **Who lands on this block, and what are they trying to do?**
- **What is the single primary action this block exists to drive?**

If the user hasn't told you, ask. You cannot design discoverability for an action you haven't named. Write the primary action down in one short sentence, e.g., "Book a demo," "Start listening," "Update my email preferences."

### Step 2 — Sketch the skeleton (major zones only)

Produce a low-fidelity wireframe of the block as a handful of labeled zones. Think in **rectangles and labels**, not colors or typography. Typical zones are things like:
- Header / nav
- Hero / primary communication area
- Primary action surface (CTA button, play button, save button)
- Supporting content
- Secondary actions
- Footer

Render the sketch in whatever format fits the conversation: an ASCII box diagram, a Mermaid flow, a simple SVG mockup via the visualizer if one is available, or a numbered list of zones with their position and purpose. The important thing is that the user can **see the layout at a glance** and recognize where the primary action lives relative to everything else.

### Step 3 — Apply layout and hierarchy rules

Reshape the skeleton using these rules (all drawn from proven practice — see `references/ui-ux-principles.md` for the full list):

- **Information flows top-to-bottom, left-to-right.** Put the primary communication and primary action near the top and in the natural reading path. Don't hide the CTA below the fold without a strong reason.
- **Navigation lives at the top.** Users expect it there.
- **Reserve the strongest visual weight for the primary action.** If five things on screen are equally loud, nothing is loud. Make the CTA the visually dominant element in its zone.
- **Progressive disclosure.** Show only what the user needs to decide or act. Push detail to secondary views, expanders, or later screens.
- **Reuse patterns across blocks.** If the "save" action looks and lives in one place on the account page, it should look and live in the same place on every other account subpage.
- **Account for edge cases in the sketch.** Long names, missing avatars, empty states, error states — sketch at least the "happy" and "empty/error" variants for any block that holds user data.

### Step 4 — Pass the discoverability check

Before finalizing, run this explicit check on the sketch:

- **The squint test:** If you blur the sketch mentally, does the primary action still stand out? If not, increase its relative weight (size, position, isolation from clutter, contrast).
- **The five-second test:** If a brand-new user looked at the block for five seconds and then closed it, would they know what it's *for* and what they're supposed to do? If not, the hero communication isn't carrying its weight.
- **The "one obvious next step" test:** From any point on the block, is there one obvious next step? If there are competing CTAs with similar weight, demote the secondary ones (outline buttons, text links, lower-contrast treatments).

### Step 5 — Apply visual discipline (briefly)

Only after the skeleton and hierarchy are right, layer on visual discipline. Keep this section *short* in your output — this skill is not about pixel polish. Just confirm the sketch respects:

- **60-30-10 color rule.** 60% neutral, 30% complementary, 10% brand/accent. The brand color is reserved for the primary action and other moments that earn it.
- **Typography discipline.** Roughly four font sizes, two weights. Monospace for numbers that might grow (counts, prices, metrics).
- **8-point (or 4-point) spacing grid.** All spacing values divisible by 8 or 4. No random 13px or 25px gaps.
- **Restraint on effects.** No gradients, blurs, heavy shadows, or animations unless they add clarity or functionality. Avoid scrolljacking. Avoid infinite scroll if it traps users away from the footer.

Reference `references/ui-ux-principles.md` for the full rules and the list of common mistakes to avoid.

## Block-specific guidance

Each of the five major block types has its own priorities and common traps. Read the relevant reference file when working on that block type — don't try to hold all of them in your head at once.

- **Landing page** → `references/landing-page.md`
  Priority: maximum clarity of what the product is + one unmissable call-to-action.
- **Pricing / services page** → `references/pricing-services.md`
  Priority: prices visible, tiers comparable, one recommended path visually dominant. Clean and super obvious beats clever.
- **Contacts page / section** → `references/contacts-page.md`
  Priority: make the preferred contact method obvious and frictionless.
- **Audio / video player** → `references/audio-video-player.md`
  Priority: transport controls (play/pause/seek) instantly recognizable; embed surface is the visual anchor of the block.
- **Personal account / profile / settings** → `references/personal-account.md`
  Priority: every option is findable; frequent actions are one click away; rare actions are organized but not hidden.

If the user's block type isn't in this list (e.g., a checkout flow, a search results page), apply the universal workflow above and lean on the general principles — the approach transfers.

## Output format

Unless the user asks for something specific, structure your response like this:

1. **Primary action** — one sentence naming the single thing this block exists to drive.
2. **Sketch** — a low-fidelity wireframe (ASCII diagram, SVG, or a zoned list) showing the major zones and where the primary action lives.
3. **Why it's laid out this way** — 3–6 bullet points tying the layout decisions to user intent and discoverability. Reference the principles you applied.
4. **Watch-outs** — 2–4 specific pitfalls the user should avoid given their particular block (e.g., "don't stack three CTAs of equal weight in the hero," "don't hide the play button inside the album art on mobile").
5. **Optional next step** — offer to zoom into a sub-block, produce a higher-fidelity sketch, or sketch a related block (e.g., "want me to sketch the mobile version?").

Keep visual discipline commentary (colors, type, spacing) brief and grouped — it's supporting detail, not the headline.

## What to avoid

These failure modes show up repeatedly in LLM-generated UI advice. Watch for them in yourself:

- **Drifting into microelements.** If you catch yourself specifying border radii, exact hex codes, or icon choices, stop. Zoom back out to the block level.
- **Listing generic "best practices" without applying them.** Every principle you cite should be tied to a specific decision in the sketch. "Use whitespace" is not advice; "give the CTA a full row of breathing space so no other element competes for attention" is.
- **Over-designing.** A great sketch is simple. If your wireframe has 15 zones, the block is doing too much. Cut.
- **Ignoring the primary action after step 1.** The primary action should be referenced throughout the response — it's the spine of the design.
- **Being too abstract.** The user is trying to build something. Give them a concrete layout they can act on, not a lecture on design theory.

## A note on sketches

This skill produces *sketches*, not production designs. The goal is to pin down structure and hierarchy so the user (or their designer, or a follow-up Claude turn) can execute the detail work on a solid foundation. If the user wants high-fidelity output, offer to escalate to a rendered mockup (SVG via the visualizer, HTML/CSS, Figma-style description) as a next step — don't try to skip the sketching stage by jumping straight to polish.
# Pricing / Services Page — Sketching Guide

## What this block exists to do

Help a prospective customer **pick** — a plan, a tier, a service, a package — and click the button that starts the purchase or inquiry. Pricing pages are decision surfaces, not information dumps. Every element either helps the user decide, or it's clutter.

The single most important property of a pricing page is **clarity**: prices visible, what's included obvious, differences between options unambiguous, one path recommended.

## Primary action

Name it. The primary action is almost always one of:
- "Start free trial" / "Sign up" on the recommended tier
- "Buy now" / "Subscribe" on the recommended tier
- "Book a call" / "Get a quote" (for services / agency / enterprise)

Crucially, the primary action is **tier-specific**. Each card has its own CTA, but *one* tier is the recommended path and its CTA carries the strongest visual weight. If every tier's button looks identical, you've failed to guide the user.

## Skeleton — SaaS-style pricing (3 tiers, most common)

```
┌─────────────────────────────────────────────────────┐
│  NAV                                                │
├─────────────────────────────────────────────────────┤
│  PAGE HEADER                                        │
│   "Simple, transparent pricing"                     │
│   One-line value prop (e.g., "No hidden fees.")     │
│                                                     │
│            [Monthly] [Annual -20%]  ← billing toggle│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐     │
│  │          │  │ ★ RECOMMENDED │  │          │     │
│  │  STARTER │  │    PRO        │  │ BUSINESS │     │
│  │          │  │               │  │          │     │
│  │   $9/mo  │  │   $29/mo      │  │  $99/mo  │     │
│  │          │  │               │  │          │     │
│  │  For...  │  │  For...       │  │  For...  │     │
│  │          │  │               │  │          │     │
│  │  ✓ thing │  │  ✓ thing      │  │  ✓ thing │     │
│  │  ✓ thing │  │  ✓ thing      │  │  ✓ thing │     │
│  │  ✓ thing │  │  ✓ thing      │  │  ✓ thing │     │
│  │          │  │  ✓ thing      │  │  ✓ thing │     │
│  │          │  │  ✓ thing      │  │  ✓ thing │     │
│  │ [Sign up]│  │ [START TRIAL] │  │ [Sign up]│     │
│  │ (outline)│  │   (FILLED)    │  │ (outline)│     │
│  └──────────┘  └──────────────┘  └──────────┘     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ENTERPRISE STRIP (full-width, separate)            │
│   "Need more? Custom plans for teams 50+."          │
│   [Contact sales →]                                 │
├─────────────────────────────────────────────────────┤
│  FEATURE COMPARISON TABLE (optional, below cards)   │
│   Detailed side-by-side for objection-handlers      │
├─────────────────────────────────────────────────────┤
│  FAQ  (billing, cancellation, refunds, changes)     │
├─────────────────────────────────────────────────────┤
│  CLOSING CTA strip  [Start free trial]              │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
└─────────────────────────────────────────────────────┘
```

## Skeleton — services page (agency / consultancy / freelancer)

For services pages where "pricing" is really "engagement options," the dynamic is slightly different — users are choosing a scope of work, not a software tier.

```
┌─────────────────────────────────────────────────────┐
│  NAV                                                │
├─────────────────────────────────────────────────────┤
│  HEADER                                             │
│   "What we do" / "Services"                         │
│   Short positioning sentence                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SERVICE BLOCKS (stacked or 2-column grid)          │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ SERVICE NAME                                  │ │
│  │ Outcome promise (what you walk away with)     │ │
│  │ Timeline / format (e.g., "4-week engagement") │ │
│  │ Starting from $X,000 (if shown)               │ │
│  │ [Book a call]                                 │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │ SERVICE NAME                                  │ │
│  │ ...                                           │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
├─────────────────────────────────────────────────────┤
│  PROCESS STRIP  (how we work together, 3-4 steps)   │
├─────────────────────────────────────────────────────┤
│  SOCIAL PROOF  (past clients, outcomes)             │
├─────────────────────────────────────────────────────┤
│  CLOSING CTA  [Book a discovery call]               │
└─────────────────────────────────────────────────────┘
```

## Discoverability priorities for pricing/services

### Prices are visible
Show prices. If you have to hide a price behind a "Contact us" wall to get sales involved, that's fine for enterprise tiers only — not for mainstream plans. Users who can't see a price assume it's expensive and bounce.

Services pages can use "Starting from $X" or show a price range if exact quotes require discovery. What's not OK is a services page where every offering says "contact for pricing" with no signal of scale — users can't tell if they're in the right ballpark.

### The recommended tier is visually dominant
Pick one. Usually the middle tier, usually the "pro" tier — whichever is the best fit for the most common customer. Signal it with:
- A **badge** above the card ("Most popular," "Recommended," "Best value")
- **Slightly larger** than adjacent cards, or **lifted** with a subtle shadow/border
- **Filled/solid CTA button** while other cards have outline buttons
- Brand accent color reserved for this card's CTA (its 10% moment)

If all three cards look identical, users default to the cheapest or bounce. Neither is what you want.

### Each tier has one "for whom" line
Above or below the price, one concise line describing who this tier is for:
- Starter: "For individuals trying us out"
- Pro: "For growing teams"
- Business: "For established companies with compliance needs"

This is the single most effective tool against decision paralysis. Users who see themselves described pick that tier.

### Feature lists are concrete, not marketing
- Bad: "Powerful analytics," "Enterprise-grade security," "Unlimited possibilities"
- Good: "Up to 10,000 rows," "SSO + SAML," "API access (5,000 req/hr)"

Numbers, limits, and specific capabilities help users self-qualify. Adjectives don't.

### Show what's added at each tier, not the full list repeated
On tier 2, don't re-list every feature from tier 1 — say "Everything in Starter, plus:" and show only the new additions. This makes the *delta* between tiers obvious, which is the thing users are actually trying to figure out.

### Billing toggle is prominent and honest
If monthly vs. annual is a thing:
- Toggle at the top of the cards, not buried
- Show the savings explicitly ("Save 20%" or "$24/mo billed annually = $288/yr")
- Update prices in real time when the toggle flips
- Default to whichever is more honest / most commonly chosen, not whichever looks cheapest

### Feature comparison table is the objection handler
A detailed comparison table below the cards is for users who've narrowed it down and want to verify specifics. Keep it scannable: feature names in the left column, checkmarks or values across, sticky header row on long tables. Don't replace the cards with just a table — cards are for the decision, the table is for the follow-up.

### Enterprise tier is separate, not a fourth card
Squeezing "Enterprise — Contact Sales" into the same card row as the self-serve tiers makes the whole row feel confusing (one has no price, different CTA, different sign-up flow). Break it out into a full-width strip below the cards with its own treatment.

## Common pricing/services traps

- **All CTAs identical.** No recommended tier. Users can't tell what you want them to pick.
- **Four or five tiers.** Decision paralysis. Three is the proven sweet spot. If you need more, collapse similar ones or break into "Self-serve" vs. "Enterprise" sections.
- **Giant feature comparison table as the only pricing view.** Users can't make a decision from a matrix alone. Cards first, table second.
- **Prices only visible on hover or after toggling something.** Price must be the first number the eye lands on in each card.
- **Hidden costs.** Extra fees disclosed only at checkout. Kills trust and amplifies churn. Surface all costs on the pricing page — seats, usage caps, add-ons.
- **"Contact us" on mainstream tiers.** Makes the product feel opaque/expensive. Reserve this for genuine enterprise only.
- **Annual/monthly toggle that doesn't update prices live.** User toggles, nothing changes visibly, they don't trust the UI.
- **Feature descriptions in marketing-speak.** "Synergy-driven insights." Cut.
- **"Most Popular" badge on the cheapest tier.** Undermines the whole point of a recommendation — you're signaling users should pick the tier you least want them on.
- **Mobile: three cards side-by-side at tablet width, unreadable.** Stack vertically on mobile, recommended tier at the top.
- **Services page with no process or proof.** Users buying services are buying trust. No case studies / no process description = "why would I pay this?"
- **Refund/cancellation policy buried.** Users about to commit want to see this. Put it in FAQ or near the CTA.

## What the user often forgets to think about

- **The "already a customer" path.** Existing customers often land on pricing to upgrade/downgrade. Make sure there's a clear link to account billing for them.
- **Proration and billing changes.** What happens if I upgrade mid-month? Brief FAQ answer saves support tickets.
- **Currency / tax.** International buyers want to see their currency; B2B buyers want clarity on whether prices include VAT/GST.
- **Team seats vs. per-user pricing.** If pricing is per-seat, show how it scales — a calculator or slider beats a table for this.
- **The free tier question.** If there's a free tier, where does it live? Fourth card, smaller card, or separate "Try it free" link? All three are valid; pick one and commit.
- **Empty-state for services.** If a service card has no pricing info and no "book a call" button, it's just a paragraph of text.
- **Accessibility.** Comparison tables need proper `<th>` headers, billing toggle needs a real label, CTAs need descriptive text ("Start Pro trial" not just "Sign up").

## Output checklist

When sketching a pricing or services page, your response should include:
- The named primary action (and which tier it's on)
- The tier structure (3 is default, justify anything else)
- Which tier is recommended and how it's visually dominated
- Billing toggle treatment (if applicable)
- Feature list format (concrete, additive — not re-listed per tier)
- Enterprise / services "contact sales" placement (separate strip, not a fourth card)
- At least one mobile consideration (cards stack, recommended at top)
- What to cut if the user's current draft is cluttered
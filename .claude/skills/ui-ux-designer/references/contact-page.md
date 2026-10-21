# Contacts Page / Section — Sketching Guide

## What this block exists to do

Let the user reach you via their preferred method with as little friction as possible. "Contact us" is a low-intent-to-complete surface — every extra form field, every wall of text, every buried phone number costs you conversions.

## Primary action

Name it. The primary action is almost always one of:
- "Send a message" (form submission)
- "Book a call" (scheduling link)
- "Start a chat" (live chat trigger)
- "Email us" (mailto or email display)

Pick one as the primary. If the business genuinely has multiple equal paths (e.g., "sales" vs. "support"), split them into clearly labeled lanes rather than offering all options with equal weight — a wall of contact options with no guidance is worse than one wrong guess.

## Skeleton (typical layout)

```
┌─────────────────────────────────────────────────────┐
│  NAV                                                │
├─────────────────────────────────────────────────────┤
│  HEADER                                             │
│   "Get in touch" / "Contact us"                     │
│   One-sentence description of what happens next     │
│   (e.g., "We reply within one business day.")       │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│  PRIMARY CONTACT METHOD  │  ALTERNATIVES            │
│  (form OR calendar       │  - Email address         │
│   embed OR chat CTA)     │  - Phone number          │
│                          │  - Physical address      │
│                          │  - Social links          │
│                          │  - Support docs link     │
│                          │                          │
├──────────────────────────┴──────────────────────────┤
│  OPTIONAL: FAQ or self-serve links                  │
│  ("Before you contact us, have you tried…")         │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
└─────────────────────────────────────────────────────┘
```

On mobile, the two columns stack — primary method first, alternatives below.

## Discoverability priorities for contacts

### The primary method is immediately actionable
If it's a form, the form is visible without scrolling and has the minimum necessary fields (typically name, email, message — sometimes "reason"). Every extra field is a reason not to submit.

If it's a calendar embed, it loads directly on the page — don't make the user click through to an external scheduler if you can avoid it.

If it's chat, the chat widget is visibly present and the button to open it is unmissable.

### Set expectations explicitly
One sentence near the top: "We reply within one business day" or "Expect a response in 24 hours." Users who know when they'll hear back are dramatically more likely to submit.

### Every alternative is one click (or copy) away
- Email addresses should be `mailto:` links *and* copy-able.
- Phone numbers should be `tel:` links (tappable on mobile).
- Physical addresses should link to a map.
- Social handles should link to the actual profile, not just display the handle.

Don't make users hunt. Don't make them transcribe.

### Group by intent, not by channel
If you have multiple contact reasons (sales, support, press, careers), organize by *why* the user is contacting you, not by *how* they'll do it. "Sales inquiries → sales@..." is better than a single inbox that tries to route everything.

## Common contacts-page traps

- **A wall of ten contact methods with no hierarchy.** Overwhelms users. Pick a primary.
- **Forms with 12 required fields.** Every extra field drops completion rate. Keep it minimal.
- **No response-time expectation.** Users assume the worst and don't submit.
- **Email address shown as an image to "prevent spam."** Users can't copy it. Spam filters are good enough now.
- **Captchas stacked on top of long forms.** Kills completion rate on genuine inquiries.
- **"Contact" buried in footer with no dedicated page.** Common for small sites — and common reason they get no inbound.
- **Hours shown in one timezone with no conversion hint.** If you say "9-5 EST" to a global audience, half of them will get it wrong.
- **Office address featured prominently when you don't want walk-ins.** Confuses remote-first companies.

## What the user often forgets to think about

- **Success state.** After the user submits the form, what do they see? A good "thanks, we got it, here's when you'll hear back" screen is worth more than you think.
- **Error state.** If the form fails, is the error message specific and recoverable? Does it preserve what they already typed?
- **Spam defense that doesn't punish real users.** Honeypot fields > captchas for most use cases.
- **Accessibility.** Phone numbers need `tel:` links so screen readers can handle them. Form labels need to be real labels, not just placeholders.

## Output checklist

When sketching a contacts page, your response should include:
- The named primary contact method
- The layout with primary method vs. alternatives clearly separated
- Response-time expectation placement
- Form field list (if applicable) — reduced to the minimum
- Success and error state notes
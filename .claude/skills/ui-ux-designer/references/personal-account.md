# Personal Account / Profile / Settings — Sketching Guide

## What this block exists to do

Let signed-in users see and manage their stuff: profile, preferences, subscription, notifications, security, data. The overriding goal here is **discoverability of options** — every setting the user might ever want should be findable without trial and error. Frequent actions are one click away; rare actions are organized but not hidden.

## Primary action

Unlike the other blocks, the personal account page often doesn't have a single primary action — it has **many possible actions** and the block's job is to make all of them findable. That said, *most* account pages have a few high-frequency actions:

- Update profile info (name, avatar, email)
- Change password / manage 2FA
- Manage subscription / billing
- Notification preferences
- Log out

Identify which of these the user visits most often and surface them most prominently.

## Skeleton — two-column settings hub (most common)

```
┌─────────────────────────────────────────────────────┐
│  APP NAV                            [avatar] [bell] │
├──────────────────┬──────────────────────────────────┤
│                  │                                  │
│  SIDEBAR NAV     │  SETTINGS SECTION (one at a time)│
│                  │                                  │
│  ▸ Profile       │   Section heading                │
│  ▸ Account       │   Short description              │
│  ▸ Notifications │                                  │
│  ▸ Privacy       │   [Setting 1]   [value/toggle]   │
│  ▸ Billing       │   [Setting 2]   [value/toggle]   │
│  ▸ Integrations  │   [Setting 3]   [dropdown]       │
│  ▸ Security      │                                  │
│  ▸ Data & export │   DANGER ZONE (if applicable)    │
│                  │   [Delete account]               │
│  ──────────────  │                                  │
│  [Log out]       │                                  │
│                  │                                  │
└──────────────────┴──────────────────────────────────┘
```

On mobile, the sidebar becomes a scrollable list of section links, and tapping one navigates to the section's detail view.

## Skeleton — profile overview page (for apps where profile is public)

```
┌─────────────────────────────────────────────────────┐
│  APP NAV                                            │
├─────────────────────────────────────────────────────┤
│  [cover image]                                      │
│  [avatar]                                           │
│   Name                              [Edit profile]  │
│   @username                                         │
│   Bio / headline                                    │
│   Stats row: followers, posts, joined               │
├─────────────────────────────────────────────────────┤
│  TABS: Posts | Activity | About | Settings         │
├─────────────────────────────────────────────────────┤
│  Content for selected tab                           │
└─────────────────────────────────────────────────────┘
```

## Discoverability priorities for account pages

### Group by mental model, not by internal org chart
Group settings the way users think about them, not the way your engineering team is structured. Users think:
- "My identity" → name, avatar, bio, email, username
- "How I log in" → password, 2FA, connected accounts, sessions
- "How I'm reached" → email prefs, push notifications, sms
- "What I'm paying for" → plan, billing, invoices, payment methods
- "My data" → download, export, delete
- "How others see me" → privacy, visibility

Avoid categories like "General" or "Advanced" — those are dumping grounds and nothing is findable in them.

### Label sidebar sections with plain, specific words
- Good: "Billing & plan," "Notifications," "Security," "Privacy"
- Bad: "Preferences," "Options," "Configuration," "General"

The sidebar label should tell the user exactly what they'll find inside.

### Frequent actions get surfaced, rare actions get grouped
If 80% of account-page traffic is people changing their email or password, those should be reachable in one or two clicks. If exporting data is rare but critical, it can live in a "Data" section — but the section must be labeled so users know where to look.

### Destructive actions isolated and visually distinct
"Delete account," "Cancel subscription," "Revoke all sessions" — these live in a **Danger Zone** at the bottom of their relevant section, with a muted-red treatment and a confirmation step. Never place destructive actions adjacent to routine ones.

### Show current state clearly, next to each setting
- For toggles: the toggle state is unambiguous (color + position).
- For dropdowns: the current value is displayed in the field.
- For email/name: the current value is shown as text with an edit affordance nearby.

Never force the user to click "edit" just to see what their current value is.

### Save behavior is predictable
Pick one pattern and use it consistently across the whole account page:
- **Auto-save** (modern, Optimistic UI — the change saves the moment it's made, with a subtle confirmation)
- **Explicit save button per section** (classic — clearer control, but more clicks)

Mixing the two within the same settings area confuses users. If you auto-save, make that visibly obvious (a brief "Saved" indicator).

### Search the settings if there are many
If the account area has more than ~8 sections, include a search bar at the top of the sidebar. Users often know what they want ("notifications") but not where it lives.

## Common account-page traps

- **Labels like "General" and "Advanced."** Nobody can predict what's inside. Replace with specific topic labels.
- **Settings scattered across multiple pages with no map.** User opens profile, then has to remember billing is in a different area of the app entirely. Unify the settings hub.
- **Destructive actions placed next to save buttons.** Accidental account deletion. Always isolate.
- **Hidden current state.** Toggle that doesn't clearly show which state it's in. User clicks it, then can't tell if they just turned something on or off.
- **Modal-only editing.** Every field opens a modal. Slow and annoying. Inline editing is almost always better.
- **No confirmation for destructive actions.** One-click account deletion is negligent.
- **Mixing save patterns.** Some fields auto-save, others require a save button. User doesn't know which is which.
- **Subscription / billing buried.** High-frequency, high-stakes area should be top-level, not three clicks deep.
- **"Log out" hidden.** Should be one of the most findable actions on the whole block. Put it at the bottom of the sidebar or in the avatar menu — and in *both* places if in doubt.
- **No way to see active sessions or connected devices.** Users want to audit this; security-conscious users demand it.

## What the user often forgets to think about

- **First-time state.** What does the account page look like for a brand-new user who hasn't customized anything? Empty states with helpful defaults and a nudge toward filling in the profile.
- **Long-name truncation.** Names like "Władysława Aleksandrowicz-Kowalczyk" need to truncate gracefully, not break layout.
- **Avatars with no image.** Fallback initials, with enough contrast against the background.
- **Connected accounts / integrations state.** Is the integration connected, disconnected, or broken? Show status clearly, not just "Connected" / "Connect."
- **Email change flow.** Changing an account email is security-sensitive. It needs a confirmation step (email the old address, verify the new one) — sketch this subflow.
- **Password change flow.** Requires current password. Show password strength. Confirm new password twice OR use "show password" toggle.
- **Accessibility.** Every form field needs a real label. Toggles need clear on/off state for screen readers. Keyboard navigation must reach every setting.

## Output checklist

When sketching a personal account page, your response should include:
- Identification of the highest-frequency actions
- Sidebar section labels using plain topic words
- Placement of destructive actions (danger zones, confirmation)
- Save pattern (auto-save vs. explicit) — pick one
- Mobile vs. desktop treatment (sidebar → list navigation)
- Log-out location
- Notes on at least one tricky subflow (email change, password change, or account deletion)
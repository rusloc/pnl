# Avatars

## Types (choose by context)
| Type | Use | Notes |
|---|---|---|
| Initials | default for people without a photo | 1–2 letters, deterministic color |
| Generated (geometric / identicon) | anonymous users, test accounts, playful brands | seeded from user id |
| Illustrated / mascot | community, kids, gaming | a series with one style, see small-graphics.md |
| Entity | org, workspace, bot / AI agent | rounded square, not a circle; agents get a distinct glyph so they never pass as people |

Avoid a grey human silhouette as the default: it reads as gendered and generic. Prefer initials or abstract.

## Geometry
- Sizes on the 4/8 scale: 16, 20, 24, 32, 40, 48, 64, 96, 128. Draw at 64 and check 24 and 32 in the sheet.
- Circle for people, rounded square (radius ≈ 22% of size) for orgs, workspaces and bots.
- **Initials:** bold, font-size ≈ 0.38–0.42 × size, outlined (`text_to_path`). Center optically by
  cap height: `baseline = cy + 0.36 × fontSize` (cap ≈ 0.72 em), not by bounding box.
- **Status dot:** bottom-right, Ø ≈ 28% of size, with a 2px ring in the *surface* color (a stroke drawn
  first, not a mask, so it works on every platform).
- **Stacked group:** overlap 25–30%, each avatar with a 2px surface-colored ring.
- **Story/active ring:** gradient ring, 2px gap, 2–3px ring at 64px.

## Color: deterministic and accessible (measured)
- Hue = hash(stable user id) mod 360, never the display name (names change). Fix lightness and
  chroma in OKLCH so every avatar has the same contrast:
- **White initials:** every color in the avatar, gradient ends included, at **L ≤ 0.55** (C ≈ 0.13)
  gives ≥ 4.5:1 at any hue (measured min 4.56). L ≤ 0.65 still clears 3:1 for large text (min 3.02).
  At L = 0.70 it fails (2.5).
- **Pastel style:** L ≥ 0.80, C ≈ 0.08 with dark initials (#1b1b1f) gives ≥ 8.8:1.
- Gradients: shift hue +30–40° between ends at equal L. Never lighten one end past the limit.
- **Hue slots, not raw hues:** at L ≤ 0.55, yellow/olive hues (≈ 60–110°) turn muddy brown-olive
  (observed). Map the hash onto 8–12 curated hue slots that skip that band, e.g.
  `[15, 35, 140, 165, 190, 215, 240, 265, 290, 320, 345]`, so every user gets an equally clean color.

## Generated patterns (seeded, grid-snapped)
- **Identicon:** 5×5 grid, left 3 columns from hash bits, mirrored. 1 hue + background tint. Cells snap to the grid.
- **Geometric:** 2–4 primitives (circle, quarter-circle, bar) from a fixed 3–4 color palette, positions
  and rotations (multiples of 90°) from hash bytes, clipped to the avatar shape (web) or
  pre-cut geometry (Android).
- Always render the same seed to the same SVG: generate server-side or in a pure function.

## Delivery
- Web: inline `<svg>` component (React from wrap.py) or `<img>` of a server-rendered SVG.
- Lists of many avatars: server-render PNG at 2× (cheaper than hundreds of inline SVGs).
- Mobile: RN component or Flutter `SvgPicture.string`; the gradient must be `userSpaceOnUse`.

# 04 · Theme and accessibility

from rusloc/pnl (archi) · to vosk.dev repo agent · 2026-11-26 · status: ready

Source: `mockup/mockup-v2.css` (`:root` blocks at the top). The USER fixed the four Orbya colours in round 14: orange and dark have no variants anywhere.

## 1. Palette

### 1.1 The four colours (exact)

| Role | Token | Hex | Used for |
| --- | --- | --- | --- |
| Background | `--bg` | **#F6F5F2** | the board (page), inactive tabs, text on dark fills, the glass base |
| Primary | `--surf` (= `--pri`) | **#E8E5DF** | cards, panels, the active tab, the area outside the board |
| Secondary | `--ink` (= `--sec`, `--in`, `--q4`) | **#2C3A54** | all text, the two squares, balance bars, selected chips and calendar cells, cash-in bars, heat block 4 |
| Highlight | `--hl` (= `--q5`) | **#FF6F1A** | current path step, orange buttons, close buttons, clear marks, S01 chip, heat block 5, Opening / Closing / Net bars, focus ring, open group border |

### 1.2 USER-fixed grey

| Token | Hex | Used for |
| --- | --- | --- |
| `--lineBar` | **#8A8986** | statement line, subtotal and total bars; its legend swatch |

### 1.3 Derived mixes

Each is an sRGB `color-mix()` of the four colours. The definition is normative; the hex is the computed value, rounded.

| Token | Definition | Hex | Used for |
| --- | --- | --- | --- |
| `--sub` | 40 % surf + 60 % bg | #F0EFEA | empty heat strip, ledger header / footer / tiles, group nodes, scrollbar track, tab hover |
| `--sub2` | 55 % sub + 45 % surf | #EDEAE5 | alternate month band |
| `--muted` | 80 % ink + 20 % surf | #525C70 | secondary text |
| `--faint` | 75 % ink + 25 % surf | #5B6577 | tertiary text, axis ticks, month separators |
| `--rule` | 20 % ink + 80 % surf | #C2C3C3 | control borders, header rule |
| `--line` | 8 % ink + 92 % surf | #D9D7D4 | card borders, gridlines, row rules |
| `--hover` | 7 % ink + 93 % surf | #DBD9D5 | row and button hover |
| `--out` | 58 % ink + 42 % surf | #7B828E | cash-out bars and the Cash out tile edge |
| `--q1` | 60 % ink + 40 % surf | #777E8C | heat block 1 |
| `--q2` | 74 % ink + 26 % surf | #5D6678 | heat block 2 |
| `--q3` | 87 % ink + 13 % surf | #445066 | heat block 3 |
| `--tabLine` | 40 % ink + 60 % bg | #A5AAB3 | folder-tab and Activities box hairline |

### 1.4 Translucency (alpha on the four only)

| Use | Value |
| --- | --- |
| Glass | bg at 60 %; 95 % without `backdrop-filter`; border bg at 85 %; inner highlight bg at 35 % and 80 % |
| Management scrim | bg at 25 % + blur 7 px |
| Shadows | ink at 16 % (`0 16px 40px`); pinned-row shadow ink at 28 % |
| Grain | monochrome noise tinted ink, 4 % opacity (inline SVG `feTurbulence`) |
| Diagram dots | hl at 30 % |
| Root node halo | hl at 55 %, 4 px |
| Boxes inside pop-ups | surf at 70–88 % (formula box, menu hover, management block, cash cards, How to read steps) |
| Text on the dark root node | bg at 80 % for title and caption |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-VIS-01 | Orange is exactly #FF6F1A, dark is exactly #2C3A54, the page is exactly #F6F5F2 and cards are exactly #E8E5DF, everywhere: CSS, inline SVG, shadows, glass, icons. No near-black, no pure black or white, no second orange. | c17 |
| CF-VIS-02 | Every other colour is one of the listed mixes, the grey #8A8986, or one of those with alpha. Adding a tint needs a USER decision. The palette test (AT-14) fails on anything else. | c17 |
| CF-VIS-03 | Roles are as in § 1.1: background = page, primary = surfaces, secondary = ink and dark fills, highlight = accents. | c3 |
| CF-VIS-04 | One palette (Orbya), light only: no palette switcher, no dark theme, no `prefers-color-scheme` branch (`color-scheme: light`). | c4 |
| CF-VIS-05 | The highlight marks the current level, focus, the orange action buttons and the top heat block. It never means good or bad; there is no red, green or amber on the page. | c2, ADR-0012 |
| CF-VIS-06 | Heat scale: one hue (navy) in four steps plus orange for the top block; neighbours differ by 1.41:1; the lightest block is ≥ 3:1 against the card and the empty strip. | c9 |

## 2. Typography

Text: **Space Grotesk** (400, 500, 600, 700). Figures: **JetBrains Mono** (400–700), `font-variant-numeric: tabular-nums`, letter-spacing −0.02em (−0.03em on large values). Base 14 px, line height 1.4.

| Element | Size / weight |
| --- | --- |
| Title `ACME Cash Flow` | 20 / 600, −0.015em |
| Context line | 12, muted |
| Path steps | 13; current 600 |
| Period badge | mode 8.5 / 600 caps +0.08em · value 15 / 700 · year mono 10.5 |
| KPI card | title 12 / 500 muted · value mono 21 / 600 · delta 11.5 (number mono 600) |
| Card title | 15 / 600; legend 11.5 |
| Statement | rows 13.5 · section rows 14 / 600 · sub rows 12.5 muted · totals 600 · header 11 / 500 faint · axis ticks mono 10.5 · % column mono 12 muted · S01 chip 10 / 700 |
| Activities | tabs 14 (active 600) · line labels 13 (12 when cells are under 24 px) · totals mono 13 · day ticks mono 10 · month band 11 / 600 · sort toggles 11.5 |
| Transactions | rows 12.5 · header 11 / 600 · tile label 11.5 · tile value mono 17 / 600 · clear letters 9.5 / 700 |
| Pop-ups | body 13 / 1.45 · heading 15 / 600 · formula mono 11.5 · source 11 · group headings 11 / 600 caps +0.07em · chips 13 / 500 · calendar cells 13 / 500 · menu items 14 / 500 |
| Diagram nodes | title 12 · value mono 18 / 600 (root 24, metric 15) · caption 10.5 |
| Tooltip | 12 |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-VIS-07 | Two families only, self-hosted (`next/font`): Space Grotesk for text, JetBrains Mono for every figure. Figures are tabular, right-aligned in tables, without a currency symbol (the unit is stated once in the context line and the column header). | c1, Tab 1 § 11.1 |
| CF-VIS-08 | Sizes and weights per the table. Labels that change weight with state (path steps, tabs, span tabs) reserve their bold width. | c17 |

## 3. Shape and size

| Element | Value |
| --- | --- |
| Radii | cards and panels 14 · squares and pop-ups 16 · chips 16 (pill) · calendar cells 10 · tiles 10 · close button 9 · orange buttons 7 · tooltip 10 · heat cells 2 · bars 0 3 3 0 (balance bars 2) · nodes 14 (metric 12) |
| Borders | cards 1 px `--line`; controls 1 px `--rule`; Activities box and tabs 1 px `--tabLine`; none on bars, clear marks, orange buttons, close buttons |
| Controls | ⓘ 20 × 20 circle · orange buttons 22 × 22 · close 30 × 30 · chips 32 high (28 in the Diagram header) · calendar cells 38 high · year stepper buttons 30 × 28 · sort toggles 22 high |
| Fixed boxes | calendar 400 × 432 · Diagram and Reconciliation 1200 × 600 · Cash 1160 wide · How to read 760 wide · ⓘ 360 wide · menu 300 wide |
| Motion | transitions of 120–250 ms on hover, chevron and Diagram node positions; none with `prefers-reduced-motion: reduce` |

| ID | Requirement | Src |
| --- | --- | --- |
| CF-VIS-09 | Shapes and fixed sizes per the table and `03`. The three fixed boxes never change size with their content. | c14, c16 |
| CF-VIS-10 | No gradients (the dot grid is the one exception), no decorative icons, no hatching, dashes or stripes on data marks. A dashed edge is used once: a partial period in the calendar. | c2, c7 |

## 4. Accessibility

Target: WCAG 2.1 AA (Tab 1 § 12.1), with the exceptions of § 4.2 that follow from colours the USER fixed.

| ID | Requirement | Src |
| --- | --- | --- |
| CF-A11-01 | Text contrast ≥ 4.5:1 and non-text contrast ≥ 3:1 everywhere except the listed exceptions E-1 … E-4. | Tab 1 § 12.1 |
| CF-A11-02 | The exceptions are built exactly as specified. Do not "repair" them with a darker orange, a border, a ring or another grey: each is a USER decision or an open USER question (`05` § 5). | c3, c15, c17 |
| CF-A11-03 | Meaning never rests on colour alone: negatives use parentheses; clear states use a letter and a text title; heat blocks are backed by tooltips, the totals column and the Transactions view; the current step has `aria-current` and weight; selected controls have `aria-pressed` / `aria-selected`. | Tab 1 § 11.1 |
| CF-A11-04 | Focus is always visible: a 2 px `--hl` outline with 2 px offset; on orange controls (close, orange buttons) the ring is `--ink`; statement section rows show inset `--ink` lines top and bottom. | c15 |
| CF-A11-05 | Semantics: the statement and the ledger are real tables with header cells; section rows expose `aria-expanded` and a name saying what Enter does; Activities tabs are `tablist` / `tab` / `tabpanel`; pop-ups are modal dialogs; every clickable thing is a `button`. One `h1`, card titles `h2`, pop-up headings `h3`. | Tab 1 § 12.1 |
| CF-A11-06 | The heat grid is one focusable element with an accessible name; moving the cursor announces the cell (date, line, in, out, count) through the tooltip tied to it (`aria-describedby` or a polite live region). The same data is reachable as text: line label buttons name their total, and Transactions lists every movement. | Tab 1 § 12.1 |
| CF-A11-07 | Disabled and partial calendar elements say why (title and `aria-description`); the two Diagram chips are disabled, not hidden, when they would do nothing. | c14 |
| CF-A11-08 | `prefers-reduced-motion: reduce` removes every transition and animation. | mock |
| CF-A11-09 | `lang="en"`, page title `ACME Cash Flow`, no text in images, no information in a tooltip that is unreachable by keyboard. | Tab 1 § 12.1 |

### 4.1 Contrast of the palette (computed, WCAG 2.x)

| Pair | Ratio | Where |
| --- | ---: | --- |
| ink on surf / on bg / on sub | 9.08 / 10.47 / 9.90 | text |
| bg on ink | 10.47 | squares, selected chips, root node |
| muted on surf / on bg | 5.34 / 6.16 | secondary text |
| faint on surf / on bg / on sub | 4.69 / 5.41 / 5.11 | tertiary text, ticks |
| ink on glass, worst case (60 % bg over an ink bar, no blur) | 4.90 | pop-up text |
| q1 vs surf / vs sub | 3.23 / 3.52 | lightest heat block |
| out vs surf | 3.08 | cash-out bars |
| ink (balance bars, block 4) vs surf | 9.08 | bars |
| neighbouring heat steps (q1 : q2 : q3 : q4) | 1.41 each | told apart by tooltip and legend, not by contrast alone |

### 4.2 Exceptions (below the WCAG target; kept as the USER set them)

| # | Pair | Ratio | Target | Where | State |
| --- | --- | ---: | ---: | --- | --- |
| E-1 | #2C3A54 on #FF6F1A | **4.10** | 4.5 | current path step (13 px / 600), `R` / `C` letters (9.5 px / 700), close × (14 px), S01 chip (10 px / 700), open square content | USER set the two colours as exact (round 14) and was told the ratio; not waived in so many words → Q-01 |
| E-2 | #FF6F1A vs #E8E5DF | **2.22** (2.55 vs the page, 2.42 vs the empty heat strip, 1.98 on a hovered ledger row) | 3 | clear discs, orange buttons, close buttons, Opening / Closing / Net bars, top heat block, active sort border | USER asked for flat orange with no border (rounds 12, 14); "USER's call" → Q-02. `U` and `R` / `C` differ by the letter only |
| E-3 | #8A8986 vs #E8E5DF | **2.78** (3.21 vs the page) | 3 | statement line bars | USER-fixed colour (round 3), kept as given; every bar's value is printed in the amount column → Q-03 |
| E-4 | #FF6F1A focus ring vs #E8E5DF | **2.22** | 3 | the default focus ring on cards and panels | follows from E-2; not raised with the USER yet → Q-04 |

Not exceptions: decorative hairlines (`--line`, `--rule`, `--tabLine`), disabled controls (35–40 % opacity) and the dot grid carry no information on their own.

# 07 — Theme: colours, fonts, number formats

Sources: `C:\__VOSK__\src\components\pnl\ledger.module.css:5-37` (tokens), `src/components/pnl/theme.ts` (company
identity), `src/components/pnl/views/charts.tsx:13-29` (chart colours), `docs/pnl/design-requirements.md` §2–§4.

## 1. Colour tokens

### 1.1 Neutral frame

| Token | Hex | Use |
|---|---|---|
| Ink 900 | `#101B2B` | primary text; filter rail background; 2 px rule under the statement group titles |
| Ink 700 | `#2B3748` | open rail item; IFRS 18 tag; bridge subtotal bar; Expand / Collapse text |
| Slate 600 | `#4F5C6C` | labels, secondary text, ratio rows, % NR column, "plan" (on track) Δ text |
| Slate 400 | `#8592A3` | icons, disabled; level bars in the profit bridge; dashed company line in Trends; n.m. text |
| Line 300 | `#CDD4DC` | control borders, column-header rule, bar axis |
| Line 200 | `#DEE3E9` | panel and card borders |
| Line 100 | `#EDF0F3` | row rules, neutral chips, bar tracks |
| Ground | `#F2F4F7` | page background behind panels; close-button fill |
| Subtle | `#F6F8FA` | subtotal / memo rows, totals rows, driver cards, disabled controls |
| Surface | `#FFFFFF` | panels, tables, header bar |
| Rail text / muted / divider | `#C9D3E0` / `#AEB9C7` / `#3A475A` | filter rail only |
| Group rule | `#E3E8ED` | vertical separators between column groups |
| Subtotal rule | `#D5DCE3` | top rule of subtotal and memo rows; totals rows |

### 1.2 Company identity (swaps with the company; drive with `[Theme Acc]`, `[Theme Acc Tint]`, `[Theme Key Rule]`)

| Company | acc | acc RGB | accT (tint) | keyRule |
|---|---|---|---|---|
| Consumer Products — "Products blue" | `#2453A6` | 36, 83, 166 | `#E8EEF8` | `#B9C8E4` |
| Commerce Cloud — "Cloud violet" | `#6B48C8` | 107, 72, 200 | `#F0EBFB` | `#CFC2F0` |
| ACME Group — "Group graphite" | `#3B4A5E` | 59, 74, 94 | `#EAEDF1` | `#C5CCD5` |

Where acc appears: brand mark, active tab underline (3 px), selected tiles (text acc, fill accT, border + 1 px ring acc),
key subtotal rows (fill accT), bridge start / end bars, primary buttons, filter-count badges, heatmap ramp, focus outline.
The identity colour never means good or bad.

### 1.3 Meaning (fixed for every company)

| Meaning | Text | Bar / fill | Tint |
|---|---|---|---|
| Favourable / ahead | `#06603F` | `#3BA37B` | `#E4F3EC` |
| Unfavourable / watch-off text | `#C2410C` | `#E2804A` | `#FCEDE5` |
| Watch (status) | `#8A5A00` (chip text), dot `#D9A441` | — | `#FBF4E4` |
| Notice | icon `#8A5A00`, text `#3D3216`, border `#EBD9AE` | — | `#FBF4E4` |
| Neutral chip | `#101B2B` | dot `#8592A3` | `#EDF0F3` |
| Intercompany tag (IC) | `#6B48C8` | — | — |

Arrow / sign shows direction; colour shows whether it helps. A cost rising above budget is negative Δ and orange.

### 1.4 Chart member colours (`charts.tsx:22-29`, in member order)

`#6B48C8`, `#2453A6`, `#3BA37B`, `#E2804A`, `#8592A3`, `#B9A3E8`. Regions (fixed in Power BI): North America `#6B48C8`,
Continental Europe `#2453A6`, Asia-Pacific `#3BA37B`, UK & Ireland `#E2804A`; Company line Ink 900 `#101B2B`.

## 2. Fonts

- UI: **IBM Plex Sans** (400 / 500 / 600 / 700), fallback `Segoe UI`. Tables (statement, variances, profitability,
  heatmap): **IBM Plex Sans Condensed**, fallback IBM Plex Sans, then `Arial Narrow`. Base 14 px, line height 1.45.
- Power BI renders only fonts installed on the viewer's machine (and a fixed list in the Service). If IBM Plex is not
  guaranteed on every viewer's machine, use **Segoe UI** and **Segoe UI Semibold** (the design's own fallback,
  design guide §3) with the same sizes and weights; the theme JSON below uses Segoe UI for that reason. To use Plex,
  replace `"Segoe UI"` by `"IBM Plex Sans"` / `"IBM Plex Sans Condensed"` everywhere.
- Scale (px; Power BI points ≈ px × 0.75 — set sizes in pt as listed in brackets): page title 22 / 600 (16.5 pt) · panel
  title 15–16 / 600 (11–12 pt) · tab 15 (11 pt) · body 14 (10.5 pt) · secondary 13 (10 pt) · caption 12 (9 pt) ·
  eyebrow 11.5 / 600 uppercase (8.5 pt) · tags 11 (8 pt) · hero value 46 / 600 (34.5 pt) · secondary / driver value
  28 / 600 (21 pt).
- Tabular figures: Plex and Segoe UI both have tabular digits by default in Power BI tables.

## 3. Number formats (N-06; `engine/format.ts`)

| Kind | Rule | Example | Format string |
|---|---|---|---|
| Amount, millions (default) | ÷ 1,000,000, 1 decimal, thousands separator | 3,398.5 | `#,##0.0;−#,##0.0;0.0` |
| Amount, thousands | ÷ 1,000, 0 decimals | 3,398,522 | `#,##0;−#,##0;0` |
| Δ amount | signed | +333.0 / −69.3 / 0.0 | `+#,##0.0;−#,##0.0;0.0` |
| Money on cards / labels | sign, symbol, value, space, unit | −$122.3 m, $0.0 m | text measures; or `"$"#,##0.0" m";"−$"#,##0.0" m";"$"#,##0.0" m"` |
| Percent | 1 decimal | 20.1% | `0.0%;−0.0%;0.0%` |
| Δ percent | signed, 1 decimal | +8.4% | `+0.0%;−0.0%;0.0%` |
| Ratio Δ | percentage points, signed | +0.3 pp | value × 100: `+0.0" pp";−0.0" pp";0.0" pp"` |
| Take rate | 2 decimals | 2.66% | `0.00%` |
| Basis points (take-rate Δ) | round(Δ × 10,000) | +2 bp, 0 bp | text |
| Count | integer | 138,726 | `#,##0` |
| Per unit | 2 decimals with symbol | $8.09 | `"$"#,##0.00` |
| Per merchant | thousands, 1 decimal | $81.3 k | text |
| No data | — | n/a | format string `"n/a"` (literal, quoted) |
| Variance Δ % too large or base too small | — | n.m. | text |

Rules: the minus sign is U+2212 `−`; a number that rounds to zero carries no sign ("0.0", "$0.0 m", never "−0.0");
deltas carry `+`; rounding happens only at display (D-30).

## 4. Power BI theme JSON

Save as `ledger-theme.json`, View → Themes → Browse for themes.

```json
{
  "name": "Ledger P&L",
  "dataColors": ["#6B48C8", "#2453A6", "#3BA37B", "#E2804A", "#8592A3", "#B9A3E8", "#2B3748", "#06603F", "#C2410C", "#D9A441"],
  "background": "#FFFFFF",
  "foreground": "#101B2B",
  "tableAccent": "#2453A6",
  "good": "#3BA37B",
  "neutral": "#8592A3",
  "bad": "#E2804A",
  "maximum": "#2453A6",
  "center": "#E8EEF8",
  "minimum": "#FFFFFF",
  "textClasses": {
    "callout": { "fontSize": 34, "fontFace": "Segoe UI Semibold", "color": "#101B2B" },
    "title": { "fontSize": 11, "fontFace": "Segoe UI Semibold", "color": "#101B2B" },
    "header": { "fontSize": 12, "fontFace": "Segoe UI Semibold", "color": "#101B2B" },
    "label": { "fontSize": 10, "fontFace": "Segoe UI", "color": "#4F5C6C" },
    "largeTitle": { "fontSize": 16, "fontFace": "Segoe UI Semibold", "color": "#101B2B" },
    "semiboldLabel": { "fontSize": 10, "fontFace": "Segoe UI Semibold", "color": "#101B2B" },
    "smallLabel": { "fontSize": 9, "fontFace": "Segoe UI", "color": "#4F5C6C" }
  },
  "visualStyles": {
    "page": {
      "*": {
        "background": [{ "color": { "solid": { "color": "#F2F4F7" } }, "transparency": 0 }],
        "outspace": [{ "color": { "solid": { "color": "#F2F4F7" } } }]
      }
    },
    "*": {
      "*": {
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }],
        "visualHeader": [{ "show": false }],
        "title": [{ "show": false, "fontFamily": "Segoe UI Semibold", "fontSize": 11, "fontColor": { "solid": { "color": "#101B2B" } } }]
      }
    },
    "tableEx": {
      "*": {
        "grid": [{
          "gridVertical": false,
          "gridHorizontal": true,
          "gridHorizontalColor": { "solid": { "color": "#EDF0F3" } },
          "gridHorizontalWeight": 1,
          "rowPadding": 3,
          "outlineColor": { "solid": { "color": "#CDD4DC" } }
        }],
        "columnHeaders": [{
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 8.5,
          "fontColor": { "solid": { "color": "#4F5C6C" } },
          "backColor": { "solid": { "color": "#FFFFFF" } },
          "outline": "Bottom only",
          "alignment": "Right"
        }],
        "values": [{
          "fontFamily": "Segoe UI",
          "fontSize": 10,
          "fontColorPrimary": { "solid": { "color": "#101B2B" } },
          "backColorPrimary": { "solid": { "color": "#FFFFFF" } },
          "fontColorSecondary": { "solid": { "color": "#101B2B" } },
          "backColorSecondary": { "solid": { "color": "#FFFFFF" } }
        }],
        "total": [{
          "fontFamily": "Segoe UI Semibold",
          "fontColor": { "solid": { "color": "#101B2B" } },
          "backColor": { "solid": { "color": "#F6F8FA" } }
        }]
      }
    },
    "pivotTable": {
      "*": {
        "grid": [{
          "gridVertical": false,
          "gridHorizontal": true,
          "gridHorizontalColor": { "solid": { "color": "#EDF0F3" } },
          "gridHorizontalWeight": 1,
          "rowPadding": 5,
          "outlineColor": { "solid": { "color": "#CDD4DC" } }
        }],
        "columnHeaders": [{
          "fontFamily": "Segoe UI Semibold",
          "fontSize": 9,
          "fontColor": { "solid": { "color": "#4F5C6C" } },
          "backColor": { "solid": { "color": "#FFFFFF" } },
          "outline": "Bottom only",
          "alignment": "Right"
        }],
        "rowHeaders": [{
          "fontFamily": "Segoe UI",
          "fontSize": 10.5,
          "fontColor": { "solid": { "color": "#101B2B" } },
          "backColor": { "solid": { "color": "#FFFFFF" } },
          "stepped": true,
          "steppedLayoutIndentation": 22,
          "showExpandCollapseButtons": true
        }],
        "values": [{
          "fontFamily": "Segoe UI",
          "fontSize": 10.5,
          "fontColorPrimary": { "solid": { "color": "#101B2B" } },
          "backColorPrimary": { "solid": { "color": "#FFFFFF" } },
          "fontColorSecondary": { "solid": { "color": "#101B2B" } },
          "backColorSecondary": { "solid": { "color": "#FFFFFF" } }
        }],
        "subTotals": [{ "rowSubtotals": false, "columnSubtotals": false }]
      }
    },
    "slicer": {
      "*": {
        "header": [{ "show": false }],
        "items": [{
          "fontFamily": "Segoe UI",
          "textSize": 10,
          "fontColor": { "solid": { "color": "#101B2B" } },
          "background": { "solid": { "color": "#FFFFFF" } },
          "outlineColor": { "solid": { "color": "#CDD4DC" } }
        }]
      }
    },
    "columnChart": {
      "*": {
        "categoryAxis": [{ "fontFamily": "Segoe UI", "fontSize": 8, "labelColor": { "solid": { "color": "#4F5C6C" } }, "showAxisTitle": false }],
        "valueAxis": [{ "fontFamily": "Segoe UI", "fontSize": 7.5, "labelColor": { "solid": { "color": "#8592A3" } }, "showAxisTitle": false, "gridlineColor": { "solid": { "color": "#EDF0F3" } } }],
        "legend": [{ "show": false }],
        "labels": [{ "show": true, "fontFamily": "Segoe UI Semibold", "fontSize": 8, "color": { "solid": { "color": "#101B2B" } } }]
      }
    },
    "lineChart": {
      "*": {
        "categoryAxis": [{ "fontFamily": "Segoe UI", "fontSize": 8, "labelColor": { "solid": { "color": "#4F5C6C" } }, "showAxisTitle": false }],
        "valueAxis": [{ "fontFamily": "Segoe UI", "fontSize": 7.5, "labelColor": { "solid": { "color": "#8592A3" } }, "showAxisTitle": false, "gridlineColor": { "solid": { "color": "#EDF0F3" } } }],
        "legend": [{ "show": false }]
      }
    },
    "hundredPercentStackedBarChart": {
      "*": {
        "categoryAxis": [{ "fontFamily": "Segoe UI", "fontSize": 9, "labelColor": { "solid": { "color": "#101B2B" } }, "showAxisTitle": false }],
        "valueAxis": [{ "show": false }],
        "legend": [{ "show": false }],
        "labels": [{ "show": true, "fontFamily": "Segoe UI Semibold", "fontSize": 8, "color": { "solid": { "color": "#FFFFFF" } } }]
      }
    },
    "textbox": {
      "*": {
        "background": [{ "show": false }]
      }
    }
  }
}
```

Region colours: Format → Data colours of the concentration chart: North America `#6B48C8`, Continental Europe
`#2453A6`, Asia-Pacific `#3BA37B`, UK & Ireland `#E2804A` (the theme's first four data colours in that order).

## 5. Rail icons (20 × 20, stroke `#8592A3`, 1.6, round caps; drawn after `components/pnl/icons.tsx`)

Use them as button images (PNG/SVG) or pick the closest built-in button icons.

```svg
<!-- calendar (Period) -->
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#8592A3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/></svg>
<!-- bars (Versions) -->
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#8592A3" stroke-width="1.6" stroke-linecap="round"><path d="M4 16V9M10 16V4M16 16v-5"/></svg>
<!-- funnel (Slice, applied filters, variance filter) -->
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#8592A3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z"/></svg>
<!-- sliders (Display) -->
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#8592A3" stroke-width="1.6" stroke-linecap="round"><path d="M4 5h12M4 10h12M4 15h12"/><circle cx="8" cy="5" r="1.8" fill="#101B2B"/><circle cx="13" cy="10" r="1.8" fill="#101B2B"/><circle cx="7" cy="15" r="1.8" fill="#101B2B"/></svg>
```

(The exact path data of the web icons is in `C:\__VOSK__\src\components\pnl\icons.tsx`; the shapes above are equivalent
drawings, not copies.)

## 6. Shape, spacing, sizes (design guide §4, `ledger.module.css`, `views.module.css`)

Radii: panels / cards 12 · company tiles 10 · controls, buttons, notices 8 · chips 14–20 · tags 4 · bar ends 2.
Borders 1 px. Panel padding 10 / 16 / 8 (views) or 12 / 16 (cards). Gaps: 10 between panels and cards. Control heights:
segmented 40 (toolbar 36), month tiles 44, rail items 48, tabs 48, close 40 × 40. Flyout shadow
`0 14px 36px rgba(16,27,43,0.20)`; nothing else has a shadow. Focus outline 2 px acc, offset 2.

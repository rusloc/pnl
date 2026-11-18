# 07 · Theme: colours, fonts, formats, theme JSON

Source: `C:\__VOSK__\src\components\nordmark\exec.css` (the design prototype v5 sheet, scoped under `.nordmark`).
Flat minimal, one accent (cobalt `#2048C6`, 7.2:1 on white).

## Colour tokens (exact hex from the CSS)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | page, cards, side bar |
| `--ink` | `#111827` | text, current bar on a neutral card |
| `--muted` | `#5F6878` | secondary text, N/A Δ, N/A current bar, section labels |
| `--line` | `#E5E7EB` | card border, header rules, side-bar border |
| `--line2` | `#F1F3F5` | (spare) |
| `--soft` | `#F6F7F9` | N/A chip background; Explain page backdrop |
| `--acc` | `#2048C6` | accent: mark "N", badge, selected chips, focus ring, drill pill, step numbers, mix store |
| `--accT` | `#EAEFFB` | selected side-bar button, selected chip fill |
| `--good` | `#136C3A` | On track text / current bar |
| `--goodT` | `#E1F0E5` | On track chip and count pill |
| `--watch` | `#9A5B00` | Watch |
| `--watchT` | `#FBEFD6` | Watch chip and count pill |
| `--off` | `#C0272D` | Off track; Off-track card border (2 px) |
| `--offT` | `#FAE3E3` | Off track chip and count pill |
| `--col` | `#D1D5DB` | non-current bars |
| `--tgt` | `#9CA3AF` | target line (dotted 2/2 in the web; dashed in Power BI) |
| `--mix2` | `#374151` | mix online; last drill step; figure labels |
| `--mix3` | `#B6BCC6` | mix wholesale |
| `--glass` | `rgba(255,255,255,0.62)` | overlay panels (Power BI: `#FFFFFF` at 8 % transparency; no blur) |
| `--glass-b` | `rgba(255,255,255,0.78)` | panel border |
| scrim | `rgba(17,24,39,0.22)` | overlay scrim → `#111827` at 78 % transparency |
| chip border | `rgba(17,24,39,0.14)` | `#11182724` |
| chip selected border | `rgba(32,72,198,0.45)` | `#2048C673` |
| chip selected fill | `rgba(32,72,198,0.12)` | `#2048C61F` (or the opaque fallback `#E6ECFA`) |
| rules inside panels | `rgba(17,24,39,0.08)` | `#11182714` |
| watch wash (gradient end) | `rgba(255,211,160,0.5)` on white | `#FFE9D0`; Power BI flat fill = mid tone **`#FFF4E7`** |
| off wash (gradient end) | `rgba(243,201,197,0.5)` on white | `#F9E4E2`; Power BI flat fill = mid tone **`#FCF2F1`** |
| faded card (8 % opacity) | – | text `#ECEDEE`, border `#F3F4F6`, bars `#F3F4F6`, chip fill `#F9FAFB` |

Overall dot: green `#2E9E5B`, orange `#E3A52A`, red `#B3261E`, grey `#9AA1AD` (no rated card). The web pulses a ring
around it (2 s ease-out); Power BI: static.

Status visual language: ▲ On track · ● Watch · ▼ Off track · – N/A. Chips: hero / medium cards "glyph + word", small
cards the glyph in a 20 × 20 circle.

Optional gradient wash: Power BI has no gradient fill. If you want it, an Image visual (or the Card (new) image slot)
behind the card text with an SVG data URI measure works:

```dax
Card Wash SVG =
VAR _end          =
    SWITCH ( [Card Status Code], 2, "rgba(255,211,160,0.5)", 3, "rgba(243,201,197,0.5)", "rgba(255,255,255,0)" )
RETURN
    "data:image/svg+xml;utf8,"
        & "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'>"
        & "<defs><linearGradient id='g'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='"
        & _end & "'/></linearGradient></defs><rect width='100' height='100' fill='url(#g)'/></svg>"
```

(Set the measure's data category to Image URL; not counted in `04-measures.md`.)

## Typography

The web uses **Inter** (tabular numbers on, `cv11`), falling back to Segoe UI. Inter is not a Power BI font, so use
**Segoe UI** (regular), **Segoe UI Semibold** (600), **Segoe UI Bold** (700). Sizes (web px × 0.889 board scale ×
0.75 px→pt):

| Element | Web | Power BI |
|---|---|---|
| Brand title | 18 px / 600 | 12 pt Semibold |
| Brand subtitle, refresh stamp | 12 px | 8 pt |
| Header meta | 13 px (bold runs 600 `#111827`) | 8.5 pt |
| Status counts | 12 px / 600 | 8 pt Semibold |
| Section label | 11 px / 600, uppercase, +0.06 em | 7.5 pt Semibold, caps, letter spacing 0.06 em |
| Card title | 13.5 px / 600 (hero 14.5 px) | 9.5 pt (hero 10 pt) Semibold |
| Card value | hero 44 px, med 30 px, sm 26 px / 600, −0.02 em | 29 / 20 / 17 pt Semibold |
| Value unit | 13 px / 500 `#5F6878` | 9 pt |
| Δ line | 12.5 px / 600 (hero 13.5, sm 12) | 8.5 / 9 / 8 pt Semibold |
| Status chip | 11.5 px / 600 | 7.5 pt Semibold |
| Pop-up title | 18 px / 600 | 12 pt Semibold |
| Figure "Actual" value | 48 px / 700, −0.03 em | 32 pt Bold |
| Figure basis value | 40 px / 700 | 27 pt Bold |
| Figure labels | 16 px / 600 `#374151` | 10.5 pt Semibold |
| Stats label / value | 12 px / 15 px 600 | 8 pt / 10 pt Semibold |
| Body text | 13 px, line height 1.5 | 8.7 pt |
| Tooltip | 12.5 px | 8.3 pt |

## Number formats

Text measures carry every on-screen number (`04-measures.md` › recipes): EUR in millions with one decimal
(`€61.4m`), no decimals from €1 bn (`€2,318m`); percentages one decimal (`36.3%`); percentage points `+0.1 pp`;
weeks `11.4 wks`; GMROI `2.7×`; counts with thousands separators (`4,812`); units in millions (`8.4m`); minus sign
U+2212 (`−`); plus sign on signed values, including `+0.0`. Model culture en-US.

Numeric measures (validation, tooltips): EUR `#,0.00`; ratios / weeks / multiples `0.000000`; counts `#,0`.

## Icons (inline SVG, 20 × 20 viewBox, stroke = currentColor)

Use as button icons (Button › Icon › Custom, or an Image with the data URI).

- Info: `<svg viewBox="0 0 20 20" fill="none" stroke="#5F6878" stroke-width="1.8" stroke-linecap="round"><path d="M10 8.6v5.2"/><circle cx="10" cy="5.6" r="1" fill="#5F6878" stroke="none"/></svg>`
- Binoculars: `<svg viewBox="0 0 20 20" fill="none" stroke="#5F6878" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.8" cy="13" r="3"/><circle cx="14.2" cy="13" r="3"/><path d="M8.8 12.3h2.4M6.6 10.1 7.4 5.6h2.1l.4 2.6M13.4 10.1 12.6 5.6h-2.1l-.4 2.6"/></svg>`
- Filters: `<svg viewBox="0 0 20 20" fill="none" stroke="#5F6878" stroke-width="1.6" stroke-linecap="round"><path d="M3 5h14M5.5 10h9M8 15h4"/></svg>`
- How to read: `<svg viewBox="0 0 20 20" fill="none" stroke="#5F6878" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M7.8 8a2.2 2.2 0 1 1 3.1 2c-.7.4-.9.8-.9 1.5"/><circle cx="10" cy="14.2" r=".6" fill="#5F6878"/></svg>`
- More KPIs: `<svg viewBox="0 0 20 20" fill="none" stroke="#5F6878" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><path d="M14 12v4M12 14h4"/></svg>`

## Power BI theme JSON (`nordmark-exec.json`)

```json
{
  "name": "Nordmark Exec",
  "dataColors": ["#2048C6", "#374151", "#B6BCC6", "#136C3A", "#9A5B00", "#C0272D", "#9CA3AF", "#D1D5DB"],
  "foreground": "#111827",
  "foregroundNeutralSecondary": "#5F6878",
  "foregroundNeutralTertiary": "#9CA3AF",
  "background": "#FFFFFF",
  "backgroundLight": "#F6F7F9",
  "backgroundNeutral": "#E5E7EB",
  "tableAccent": "#2048C6",
  "good": "#136C3A",
  "neutral": "#9A5B00",
  "bad": "#C0272D",
  "maximum": "#136C3A",
  "center": "#9A5B00",
  "minimum": "#C0272D",
  "null": "#9CA3AF",
  "hyperlink": "#2048C6",
  "visitedHyperlink": "#2048C6",
  "textClasses": {
    "callout": { "fontSize": 20, "fontFace": "Segoe UI Semibold", "color": "#111827" },
    "title": { "fontSize": 10, "fontFace": "Segoe UI Semibold", "color": "#111827" },
    "header": { "fontSize": 9.5, "fontFace": "Segoe UI Semibold", "color": "#111827" },
    "label": { "fontSize": 8, "fontFace": "Segoe UI", "color": "#5F6878" },
    "smallLabel": { "fontSize": 7.5, "fontFace": "Segoe UI", "color": "#5F6878" },
    "largeTitle": { "fontSize": 12, "fontFace": "Segoe UI Semibold", "color": "#111827" }
  },
  "visualStyles": {
    "*": {
      "*": {
        "title": [{ "show": false }],
        "background": [{ "show": false }],
        "border": [{ "show": false }],
        "dropShadow": [{ "show": false }],
        "visualHeader": [{ "show": false }],
        "padding": [{ "top": 0, "bottom": 0, "left": 0, "right": 0 }]
      }
    },
    "page": {
      "*": {
        "background": [{ "color": { "solid": { "color": "#FFFFFF" } }, "transparency": 0 }],
        "outspace": [{ "color": { "solid": { "color": "#FFFFFF" } } }]
      }
    },
    "slicer": {
      "*": {
        "items": [{ "fontFamily": "Segoe UI", "fontColor": { "solid": { "color": "#5F6878" } }, "textSize": 8 }],
        "header": [{ "show": false }]
      }
    },
    "lineClusteredColumnComboChart": {
      "*": {
        "legend": [{ "show": false }],
        "categoryAxis": [{ "show": false, "gridlineShow": false }],
        "valueAxis": [{ "show": false, "gridlineShow": false, "secShow": false }],
        "dataPoint": [{ "defaultColor": { "solid": { "color": "#D1D5DB" } } }],
        "lineStyles": [{ "strokeWidth": 1, "lineStyle": "dashed", "showMarker": false }]
      }
    },
    "tableEx": {
      "*": {
        "grid": [{ "gridVertical": false, "gridHorizontal": true, "gridHorizontalColor": { "solid": { "color": "#EEEFF1" } } }],
        "columnHeaders": [{ "fontFamily": "Segoe UI Semibold", "fontColor": { "solid": { "color": "#5F6878" } }, "fontSize": 7.5 }],
        "values": [{ "fontFamily": "Segoe UI", "fontColor": { "solid": { "color": "#111827" } }, "fontSize": 8.3 }]
      }
    }
  }
}
```

The JSON keys follow the Power BI report-theme schema; if a key is rejected by your Desktop version, drop it and set
the property in the Format pane (the values above are the source of truth).

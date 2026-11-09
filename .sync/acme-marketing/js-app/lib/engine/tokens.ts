// Visual tokens of the ACME Marketing JS flavour: the contract's §5.1 table (docs/ADD/features/marketing-js-flavour.md,
// "from the mockup :root and acme-marketing-theme.json"; it supersedes the SPEC.md values the scaffold seeded).
// app/globals.css carries the same values as CSS custom properties for the components; channel hues are data
// (dim_channel.color_light / color_dark, the data README wins, ADR-0015 (b)) and reach the page from the manifest.
// The values below equal the dataset's rows; PBI_THEME records what the Power BI flavour uses where it differs.

/** Fixed channel hues by colour slot, never reassigned when a filter drops a channel (A-58, data README › dim_channel). */
export const CHANNEL_COLORS = {
  PAID_SEARCH: { slot: 1, light: '#4A57E8', dark: '#7F88F5' },
  PAID_SOCIAL: { slot: 2, light: '#C26A10', dark: '#C9822A' },
  APP_INSTALL: { slot: 3, light: '#0F9A8E', dark: '#259E90' },
  DISPLAY_VIDEO: { slot: 4, light: '#8E52D9', dark: '#9B7FE0' },
  RETARGETING: { slot: 5, light: '#6E7A1E', dark: '#86983F' },
  AFFILIATES: { slot: 6, light: '#9B2A4E', dark: '#D2688C' },
} as const;
export type ChannelCode = keyof typeof CHANNEL_COLORS;

interface Theme {
  bg: string;
  bloomA: string;
  bloomB: string;
  bloomC: string;
  glass: string;
  glassStrong: string;
  glassTop: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  accent: string;
  accent2: string;
  accentSoft: string;
  good: string;
  warn: string;
  crit: string;
}

/** Contract §5.1. good / warn / crit are for deltas, flags and verdicts only, never a chart series. */
export const THEME = {
  light: {
    bg: '#EEF1F6',
    bloomA: 'rgba(91, 108, 255, 0.16)',
    bloomB: 'rgba(40, 199, 183, 0.12)',
    bloomC: 'rgba(255, 170, 90, 0.08)',
    glass: 'rgba(255, 255, 255, 0.56)',
    glassStrong: 'rgba(255, 255, 255, 0.78)',
    glassTop: 'rgba(255, 255, 255, 0.85)',
    line: 'rgba(17, 24, 39, 0.09)',
    ink: '#111827',
    ink2: '#4B5563',
    ink3: '#8A94A6',
    grid: 'rgba(17, 24, 39, 0.08)',
    accent: '#4A57E8',
    accent2: '#0F9A8E',
    accentSoft: 'rgba(74, 87, 232, 0.12)',
    good: '#1E9E6A',
    warn: '#C47A0E',
    crit: '#D93B4B',
  },
  dark: {
    bg: '#0E1117',
    bloomA: 'rgba(99, 114, 255, 0.24)',
    bloomB: 'rgba(40, 199, 183, 0.16)',
    bloomC: 'rgba(255, 170, 90, 0.08)',
    glass: 'rgba(255, 255, 255, 0.045)',
    glassStrong: 'rgba(22, 26, 36, 0.82)',
    glassTop: 'rgba(255, 255, 255, 0.14)',
    line: 'rgba(255, 255, 255, 0.07)',
    ink: '#F3F4F6',
    ink2: '#A6AEBD',
    ink3: '#6B7382',
    grid: 'rgba(255, 255, 255, 0.08)',
    accent: '#8B93FF',
    accent2: '#3FD4C4',
    accentSoft: 'rgba(139, 147, 255, 0.16)',
    good: '#4CCB92',
    warn: '#F0A93A',
    crit: '#FF6B78',
  },
} as const satisfies Record<'light' | 'dark', Theme>;

/** Card glass (§5.1): backdrop blur 24 px, saturate 140 %, radius 14 px; without backdrop-filter a solid 92 % fill. */
export const GLASS = { blurPx: 24, saturatePct: 140, radiusPx: 14, fallbackAlpha: 0.92 } as const;

/** SPEC.md › Typography and Motion. */
export const TYPE = {
  display: 'Manrope', // 600–700, tabular figures: display and numbers
  body: 'Inter', // 400–500: body and labels
  scalePx: [11, 12.5, 14, 18, 28, 40],
  vitalValuePx: 28,
  deltaPx: 12.5,
  labelPx: 11, // uppercase, 0.06 em tracking
} as const;
export const MOTION = { viewFadeMs: 180, windowScaleMs: 220, windowScaleFrom: 0.98 } as const;

/** Power BI flavour values that differ from or add to the spec (reference only; the JS flavour follows THEME). */
export const PBI_THEME = {
  glassFill: 'rgba(255, 255, 255, 0.90)', // white 90 %, no blur (platform limit), 14 px radius
  glassRadiusPx: 14,
  cardBorder: '#DDE1E8',
  headerBorder: '#E1E5EC',
  backgroundLight: '#F5F7FA',
  backgroundNeutral: '#DCE0E8',
  tableAccent: '#E3E6EC',
} as const;

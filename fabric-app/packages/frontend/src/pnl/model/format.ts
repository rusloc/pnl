// Number formatting (spec N-06, L-12): tabular figures are a CSS matter; here
// we produce the text — thousands separators, U+2212 minus, "+" on deltas,
// 1 decimal in millions, 0 in thousands, 1 decimal on percentages, "pp" on
// ratio deltas.
import type { Currency, Tone, Units } from './types';

export const MINUS = '−';

function group(abs: string): string {
  const [int, frac] = abs.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** Round half away from zero, which is what the mockup's figures use. */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.sign(value) * Math.round(Math.abs(value) * f + Number.EPSILON) / f;
}

function signed(value: number, decimals: number, plus: boolean): string {
  const r = roundTo(value, decimals);
  const body = group(Math.abs(r).toFixed(decimals));
  if (r < 0) return `${MINUS}${body}`;
  if (r > 0 && plus) return `+${body}`;
  return body;
}

/** Amount in the display units (`value` is always in millions). */
export function fmtAmount(value: number | null, units: Units, plus = false): string {
  if (value === null || Number.isNaN(value)) return '';
  return units === 'm' ? signed(value, 1, plus) : signed(value * 1000, 0, plus);
}

/** Whole number with thousands separators (138726 → "138,726"). */
export function fmtInt(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '';
  return signed(value, 0, false);
}

/** Currency symbol on KPI tiles and bridge totals (N-06). */
export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' };

/** Amount in display units with its unit letter: 3398.52 → "3,398.5m" / "3,398,522k". */
export function fmtAmountUnits(value: number | null, units: Units, plus = false): string {
  const text = fmtAmount(value, units, plus);
  return text === '' ? '' : `${text}${units}`;
}

/** Percentage from a value already expressed in percent (49.4 → "49.4%"). */
export function fmtPct(value: number | null, plus = false, decimals = 1): string {
  if (value === null || Number.isNaN(value)) return '';
  return `${signed(value, decimals, plus)}%`;
}

/** Percentage points for ratio-row deltas (M-11). */
export function fmtPp(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '';
  return `${signed(value, 1, true)} pp`;
}

/**
 * Favourable / unfavourable from the sign of a Δ (M-10: positive Δ is
 * favourable on every line). A Δ that rounds to zero at the displayed
 * precision is neutral, which is what the mockup does for "0.0" cells.
 */
export function toneOf(delta: number | null, decimals = 1): Tone {
  if (delta === null || Number.isNaN(delta)) return 'neutral';
  const r = roundTo(delta, decimals);
  return r > 0 ? 'fav' : r < 0 ? 'unf' : 'neutral';
}

/**
 * Tone of a Δ % cell: it follows the Δ amount, but goes neutral when either
 * the amount or the percentage rounds to zero (the mockup's "0.0%" next to
 * "−0.1" is uncoloured, and so is "−1.1%" next to "0.0").
 */
export function pctToneOf(delta: number | null, deltaPct: number | null, decimals = 1): Tone {
  const t = toneOf(delta, decimals);
  if (t === 'neutral' || toneOf(deltaPct) === 'neutral') return 'neutral';
  return t;
}

/** Parse the mockup's pre-formatted cell text back into a number (sample data only). */
export function parseSampleNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = parseFloat(t.replace(/−/g, '-').replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? null : n;
}

/**
 * Money on the redesigned views (Track B `Vitals Card SVG` / Track C `money`):
 * "$667.4 m", "−$9.2 m", "+$9.2 m" when `plus`; "n/a" for a blank; a value that
 * rounds to zero carries no sign.
 */
export function fmtMoney(value: number | null, units: Units, currency: Currency, plus = false): string {
  if (value === null || Number.isNaN(value)) return 'n/a';
  const r = units === 'm' ? roundTo(value, 1) : roundTo(value * 1000, 0);
  const body = group(Math.abs(r).toFixed(units === 'm' ? 1 : 0));
  const sign = r < 0 ? MINUS : r > 0 && plus ? '+' : '';
  return `${sign}${CURRENCY_SYMBOL[currency]}${body} ${units}`;
}

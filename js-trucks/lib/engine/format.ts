// Display rounding (contract §3.5): the only place a number is rounded. Round half away from zero on the decimal string
// (DAX FORMAT / ROUND semantics), en-US grouping, minus U+2212, en dash U+2013 for a zero or blank table cell.

export const DASH = '–';
export const MINUS = '−';

/** Digits of |v| rounded half away from zero to dp decimals, on the shortest decimal representation (never toFixed). */
export function roundDecimal(v: number, dp: number): string {
  const abs = Math.abs(v);
  let s = String(abs);
  if (/e/i.test(s)) s = abs.toFixed(20); // exponent form only for values far below any shown precision
  const dot = s.indexOf('.');
  const int = dot < 0 ? s : s.slice(0, dot);
  const frac = dot < 0 ? '' : s.slice(dot + 1);
  if (frac.length <= dp) return dp === 0 ? int : `${int}.${frac.padEnd(dp, '0')}`;
  let digits = BigInt(`${int}${frac.slice(0, dp)}`);
  if (frac.charCodeAt(dp) >= 53) digits += 1n; // '5'
  const out = digits.toString().padStart(dp + 1, '0');
  return dp === 0 ? out : `${out.slice(0, -dp)}.${out.slice(-dp)}`;
}

/** Numeric value of `ROUND(v, dp)` in DAX: half away from zero on the decimal string. */
export const roundValue = (v: number, dp: number): number => Number(`${v < 0 ? '-' : ''}${roundDecimal(v, dp)}`);

function group(s: string): string {
  const dot = s.indexOf('.');
  const int = dot < 0 ? s : s.slice(0, dot);
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dot < 0 ? '' : s.slice(dot)}`;
}

const isZeroText = (s: string) => !/[1-9]/.test(s);

/** `0.00%;-0.00%;"–"`: blank or exactly 0 prints the dash (§3.5). */
export function tablePct(v: number | null): string {
  if (v === null || v === 0) return DASH;
  const t = roundDecimal(v * 100, 2);
  return `${v < 0 ? MINUS : ''}${group(t)}%`;
}

/** Tile share `0.0%`; null is never reached (tiles 1–2 are 0 when no rows). */
export function tilePct(v: number | null): string {
  if (v === null) return DASH;
  return `${v < 0 ? MINUS : ''}${group(roundDecimal(v * 100, 1))}%`;
}

/** `+0.00 "pp";−0.00 "pp";0.00 "pp"` for a pp value. */
export function ppText(pp: number | null): string {
  if (pp === null) return '';
  const t = roundDecimal(pp, 2);
  if (isZeroText(t)) return `${t} pp`;
  return `${pp < 0 ? MINUS : '+'}${t} pp`;
}

/** The table's Δ pill: neutral `0.00` on the unrounded |pp| < 0.005 (WF Δ Pill). */
export function pillText(pp: number): string {
  if (Math.abs(pp) < 0.005) return '0.00';
  return `${pp < 0 ? MINUS : '+'}${roundDecimal(pp, 2)}`;
}

/** `#,0`; blank prints the dash. */
export function integer(v: number | null): string {
  if (v === null) return DASH;
  const t = roundDecimal(v, 0);
  return `${v < 0 && !isZeroText(t) ? MINUS : ''}${group(t)}`;
}

/** `+#,0;−#,0;0`; null is the empty pill (§3.5, accepted difference 16). */
export function signedInteger(v: number | null): string {
  if (v === null) return '';
  const t = roundDecimal(v, 0);
  if (isZeroText(t)) return '0';
  return `${v < 0 ? MINUS : '+'}${group(t)}`;
}

/** In-bar whole percent (`FORMAT(value × 100, "0") & "%"`). */
export const wholePct = (v: number): string => `${roundDecimal(v * 100, 0)}%`;

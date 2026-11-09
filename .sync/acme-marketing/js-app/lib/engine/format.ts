// Display rounding (contract §3.10, A-49): the only place a number is rounded. Mirrors the PBIP FORMAT strings
// ("#,0.0", "0.0%", "0.00" …): half away from zero, en-US grouping, U+2212 for minus, "—" for blank / n/a.

export const DASH = '—';
export const MINUS = '−';

const nf = new Map<number, Intl.NumberFormat>();
const fixed = (dp: number) => {
  let f = nf.get(dp);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); // Intl rounds half away from zero (halfExpand) by default;
    nf.set(dp, f);
  }
  return f;
};

/** "#,0" / "#,0.0" …; negative values with U+2212. */
export function num(v: number | undefined, dp = 0): string {
  if (v === undefined || !Number.isFinite(v)) return DASH;
  const t = fixed(dp).format(Math.abs(v) + 0);
  return v < 0 && /[1-9]/.test(t) ? `${MINUS}${t}` : t;
}
/** "0.0%" of a ratio. */
export const pct = (v: number | undefined, dp = 1): string => (v === undefined ? DASH : `${num(v * 100, dp)}%`);
/** "$#,0" / "$0.00". */
export const usd = (v: number | undefined, dp = 0): string => (v === undefined ? DASH : `$${num(v, dp)}`);
/** "$188.4k" ("$" & FORMAT(v / 1000, "#,0.0") & "k"). */
export const usdK = (v: number | undefined): string => (v === undefined ? DASH : `$${num(v / 1000, 1)}k`);
/** Adaptive money: "$#,0.0k" from 10 k, else "$#,0". */
export const money = (v: number | undefined): string =>
  v === undefined ? DASH : Math.abs(v) >= 10_000 ? usdK(v) : usd(v);
/** "1.02×". */
export const times = (v: number | undefined, dp = 2): string => (v === undefined ? DASH : `${num(v, dp)}×`);
/** Compact count of the funnel labels: "14.2M", "223.0k", "6,980". */
export const compact = (v: number): string =>
  v >= 1_000_000 ? `${num(v / 1_000_000, 1)}M` : v >= 10_000 ? `${num(v / 1000, 1)}k` : num(v);

/** Signed with an explicit "+" / U+2212 ("+7.0%", "−1.9"); a value that rounds to zero prints unsigned ("0%"), as the
 *  PBIP's "+0%;-0%;0%" format strings. */
export function signed(v: number, dp: number, suffix = ''): string {
  const t = num(Math.abs(v), dp);
  if (!/[1-9]/.test(t)) return `${t}${suffix}`;
  return `${v < 0 ? MINUS : '+'}${t}${suffix}`;
}

export type Arrow = '▲' | '▼' | '■';
export const arrowOf = (d: number): Arrow => (d > 0 ? '▲' : d < 0 ? '▼' : '■');

/** Δ rounds to 0 at 4 dp → the neutral colour (vitals: `ROUND(_d, 4) = 0`). */
export const isFlat = (d: number): boolean => Math.round(d * 1e4) === 0;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 5" from an ISO date ("mmm d"). */
export const shortDate = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
/** "Oct 2026" from "2026-10" (dim_month.month_name). */
export const monthName = (key: string): string => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
/** Month abbreviation ("Oct") of "2026-10". */
export const monthShort = (key: string): string => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

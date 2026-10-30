// Display formatting (E-42): the only place numbers are rounded. Minus is U+2212 as in v5; separators are fixed (no
// locale dependency), so the server and client render the same text.

export const MINUS = '−';

const fixed = (x: number, digits: number): string => {
  const s = Math.abs(x).toFixed(digits);
  const [int = '', dec] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? grouped : `${grouped}.${dec}`;
};

/** Sign the way verify.py's sgn() does: "+" for x ≥ 0 (also −0.04 → "−0.0"). */
const sign = (x: number): string => (x >= 0 ? '+' : MINUS);

/** €61.4m; €2,318m from €1 bn up (YTD Net sales). */
export function eurM(x: number, digits?: number): string {
  const m = x / 1e6;
  const d = digits ?? (Math.abs(m) >= 1000 ? 0 : 1);
  return `${x < 0 ? MINUS : ''}€${fixed(m, d)}m`;
}

/** Card value split into number and unit, e.g. ['€61.4', 'm']. */
export function eurMParts(x: number): [string, string] {
  const s = eurM(x);
  return [s.slice(0, -1), 'm'];
}

/** Signed money Δ: −€1.5m. */
export const eurDelta = (x: number): string => `${sign(x)}${eurM(Math.abs(x))}`;

/** 0.363131 → "36.3%". */
export const pct = (x: number, digits = 1): string => `${x < 0 ? MINUS : ''}${fixed(x * 100, digits)}%`;
/** Plain percent number without sign or unit: 0.363131 → "36.3". */
export const pctNum = (x: number, digits = 1): string => `${x < 0 ? MINUS : ''}${fixed(x * 100, digits)}`;
/** Signed percent: +3.4% / −2.4%. */
export const pctSigned = (x: number, digits = 1): string => `${sign(x)}${fixed(x * 100, digits)}%`;
/** Signed percentage points: +0.1 pp. */
export const pp = (x: number, digits = 1): string => `${sign(x)}${fixed(x * 100, digits)} pp`;
/** Target-style percent, trailing .0 dropped: 0.97 → "97%", 0.625 → "62.5%". */
export const pctTarget = (x: number): string => `${trim(x * 100)}%`;
/** Plan share, trailing .0 dropped: 0.70 → "70". */
export const share = (x: number): string => trim(x * 100);
const trim = (x: number): string => fixed(x, 1).replace(/\.0$/, '');

/** Signed with a unit and no scaling: +1.9 wks, +0.2×. */
export const signed = (x: number, unit: string, digits = 1): string => `${sign(x)}${fixed(x, digits)}${unit}`;
/** Unsigned number: 11.4, 2.7. */
export const num = (x: number, digits = 1): string => `${x < 0 ? MINUS : ''}${fixed(x, digits)}`;
/** Integer with thousands separators: 4,812. */
export const int = (x: number): string => `${x < 0 ? MINUS : ''}${fixed(x, 0)}`;
/** Units in millions: 8.4m. */
export const unitsM = (x: number): string => `${fixed(x / 1e6, 1)}m`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2026-10-26T05:12" → { long: "Mon 26 Oct 05:12", short: "Mon 05:12" } (calendar maths in UTC: no time zone shift). */
export function refreshStamp(iso: string): { long: string; short: string } {
  const [date = '', time = ''] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  return { long: `${day} ${d} ${MONTHS[(m ?? 1) - 1] ?? ''} ${time}`, short: `${day} ${time}` };
}

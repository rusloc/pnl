// Number formats of the Flat Ledger system (design-tokens §8). The only place that rounds; values arrive unrounded.
// Minus is U+2212, "+" on positive deltas, no space before %, k, m, pp; one space before h and d. en-US grouping is
// fixed (no host locale), so server and client render the same strings.

export const MINUS = '−';
export const NA = 'n/a';

const cache = new Map<string, Intl.NumberFormat>();
function fixed(value: number, decimals: number, signed = false): string {
  const key = `${decimals}|${signed}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: signed ? 'exceptZero' : 'negative', // no "−0.0" / "+0.0"
    });
    cache.set(key, f);
  }
  return f.format(value).replace('-', MINUS);
}

const na =
  <T extends unknown[]>(fn: (v: number, ...rest: T) => string) =>
  (v: number | null, ...rest: T): string =>
    v === null || !Number.isFinite(v) ? NA : fn(v, ...rest);

/** Counts: ≥ 10 k as "25.6k", else "1,296". */
export const fmtCount = na((v: number) => (Math.abs(v) >= 9_999.5 ? `${fixed(v / 1e3, 1)}k` : fixed(v, 0)));

/** EUR amounts: ≥ 1 m as "€10.2m", else "€580k"; below 1 k as "€398". */
export const fmtEur = na((v: number) => {
  const sign = v < 0 ? MINUS : '';
  const a = Math.abs(v);
  if (a >= 999_950) return `${sign}€${fixed(a / 1e6, 1)}m`;
  if (a >= 999.5) return `${sign}€${fixed(a / 1e3, 0)}k`;
  return `${sign}€${fixed(a, 0)}`;
});

/** EUR unit amounts (ticket): "€398". */
export const fmtEur0 = na((v: number) => `${v < 0 ? MINUS : ''}€${fixed(Math.abs(v), 0)}`);

/** Signed EUR step for bridges: "+€0.19m", "−€24k". */
export const fmtEurDelta = na((v: number) => {
  const sign = v > 0 ? '+' : v < 0 ? MINUS : '';
  const a = Math.abs(v);
  return a >= 99_500 ? `${sign}€${fixed(a / 1e6, 2)}m` : `${sign}€${fixed(a / 1e3, 0)}k`;
});

/** Ratio as a percentage: 0.524 → "52.4%". */
export const fmtPct = na((v: number, decimals: number = 1) => `${fixed(v * 100, decimals)}%`);

/** Relative delta: 0.164 → "+16.4%". */
export const fmtDeltaPct = na((v: number) => `${fixed(v * 100, 1, true)}%`);

/** Delta of two ratios in percentage points: 0.029 → "+2.9pp". */
export const fmtPp = na((v: number) => `${fixed(v * 100, 1, true)}pp`);

export const fmtHours = na((v: number) => `${fixed(v, 1)} h`);
export const fmtDeltaHours = na((v: number) => `${fixed(v, 1, true)} h`);
export const fmtDays = na((v: number) => `${fixed(v, 0)} d`);
export const fmtDeltaDays = na((v: number) => `${fixed(v, 0, true)} d`);
export const fmtMultiple = na((v: number) => `${fixed(v, 1)}×`);
export const fmtInt = na((v: number) => fixed(v, 0));

export type Unit = 'count' | 'eur' | 'pct' | 'hours' | 'days';

/** Axis tick labels (compact, no sign). */
export function fmtAxis(unit: Unit, v: number): string {
  switch (unit) {
    case 'count':
      return Math.abs(v) >= 1_000 ? `${fixed(v / 1e3, Number.isInteger(v / 1e3) ? 0 : 1)}k` : fixed(v, 0);
    case 'eur':
      return Math.abs(v) >= 1e6
        ? `€${fixed(v / 1e6, Number.isInteger(v / 1e6) ? 0 : 1)}m`
        : Math.abs(v) >= 1e3
          ? `€${fixed(v / 1e3, 0)}k`
          : `€${fixed(v, 0)}`;
    case 'pct': {
      const p = v * 100;
      return `${fixed(p, Number.isInteger(Math.round(p * 1e6) / 1e6) ? 0 : 1)}%`;
    }
    case 'hours':
      return `${fixed(v, 0)} h`;
    case 'days':
      return `${fixed(v, 0)} d`;
  }
}

/** Value label in a unit (data labels, tooltips). */
export function fmtUnit(unit: Unit, v: number | null): string {
  switch (unit) {
    case 'count':
      return fmtCount(v);
    case 'eur':
      return fmtEur(v);
    case 'pct':
      return fmtPct(v);
    case 'hours':
      return fmtHours(v);
    case 'days':
      return fmtDays(v);
  }
}

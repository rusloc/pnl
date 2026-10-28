import type { RuleRow } from '../data/manifest.ts';

// Status model (E-22 … E-26, E-75). The thresholds live only in param_status_rule (manifest.rules); this module is the
// single place that reads them. Badness b is in the rule's unit (ratios as fractions: 1 pp = 0.01), rounded to 10
// decimals: On track if b ≤ watch_from, Watch if b ≤ off_from, else Off track — so a value exactly on the Watch edge is
// Watch (E-22 table; data README "Status" and open point 9 over the E-23 sentence).

export type Status = 'good' | 'watch' | 'off';
export type Dot = 'green' | 'orange' | 'red';
export const STATUS_CODE: Readonly<Record<Status, 1 | 2 | 3>> = { good: 1, watch: 2, off: 3 };
export const DOT_CODE: Readonly<Record<Dot, 1 | 2 | 3>> = { green: 1, orange: 2, red: 3 };

export function statusOf(badness: number, rule: RuleRow): Status {
  if (rule.watch_from === null || rule.off_from === null) throw new Error(`status: rule ${rule.rule_code} has no band`);
  const b = Math.round(badness * 1e10) / 1e10;
  return b <= rule.watch_from ? 'good' : b <= rule.off_from ? 'watch' : 'off';
}

export interface Counts {
  on: number;
  watch: number;
  off: number;
  na: number;
}

export function countStatuses(statuses: readonly (Status | null)[]): Counts {
  const c: Counts = { on: 0, watch: 0, off: 0, na: 0 };
  for (const s of statuses) {
    if (s === 'good') c.on++;
    else if (s === 'watch') c.watch++;
    else if (s === 'off') c.off++;
    else c.na++;
  }
  return c;
}

export interface DotRule {
  redOff: number;
  orangeWatchOff: number;
  greenGood: number;
}

/** The three dot constants (ADR-0013 (i)): param_status_rule rows DOT_RED_OFF / DOT_ORANGE_WATCH_OFF / DOT_GREEN_GOOD. */
export function dotRule(rules: ReadonlyMap<string, RuleRow>): DotRule {
  const t = (code: string): number => {
    const v = rules.get(code)?.threshold;
    if (v === undefined || v === null) throw new Error(`status: dot constant ${code} missing`);
    return v;
  };
  return { redOff: t('DOT_RED_OFF'), orangeWatchOff: t('DOT_ORANGE_WATCH_OFF'), greenGood: t('DOT_GREEN_GOOD') };
}

/**
 * Overall-status dot, the literal v5 rule (E-26, ADR-0013 (i), USER 2026-10-28): over the cards with a status (N/A
 * excluded from the denominator, data README open point 10): red if off ≥ 1/3; else orange if (watch + off) > 50 %;
 * else green if on ≥ 2/3; else orange. 7 / 3 / 2 → orange; 11 / 0 / 1 → green (no "any off-track" guard).
 */
export function dotOf(c: Counts, r: DotRule): Dot {
  const n = c.on + c.watch + c.off;
  if (n === 0) throw new Error('status: no card has a status');
  if (c.off / n >= r.redOff) return 'red';
  if ((c.watch + c.off) / n > r.orangeWatchOff) return 'orange';
  if (c.on / n >= r.greenGood) return 'green';
  return 'orange';
}

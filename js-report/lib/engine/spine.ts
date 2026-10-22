import type { Manifest } from '../data/manifest.ts';
import type { EntityView, SpineRow } from './types.ts';

// The 19-step spine (spec §3, D-11, D-32): row order, labels and subtotal formulas come from dim_report_line;
// leaves from dim_account. No subtotal is stored anywhere — every one is evaluated here from its formula.

const IN_SCOPE: Record<EntityView, ReadonlySet<string>> = {
  P: new Set(['P', 'BOTH']),
  S: new Set(['S', 'BOTH']),
  GROUP: new Set(['P', 'S', 'BOTH']), // Group elimination leaves (ELIM_*, OOI_4) arrive with the Group view, step 4
};

const KIND = {
  input_block: 'block',
  subtotal: 'subtotal',
  ratio: 'ratio',
  group_total: 'group_total',
  memo: 'memo',
} as const;

/**
 * Spine rows for an entity view (M-02, N-11). Leaves are the accounts of each block that the entity books. Labels
 * come from dim_report_line / dim_account; the entity alias (L-11) is a secondary label.
 */
export function buildSpine(m: Manifest, entity: EntityView): SpineRow[] {
  const lines = [...m.tables.dim_report_line].sort((a, b) => a.sort_order - b.sort_order);
  const accounts = [...m.tables.dim_account].sort((a, b) => a.sort_order - b.sort_order);
  // F-15 / M-25: a block is a cost block when its accounts' natural signs sum below zero (RD stays a cost block
  // despite its capitalised-development credit; OOI, signed 0, is not). A group total (OPEX) sums its child blocks.
  const blockSign = new Map<string, number>();
  for (const a of m.tables.dim_account)
    blockSign.set(a.block_code, (blockSign.get(a.block_code) ?? 0) + a.natural_sign);
  const lineSign = (l: (typeof lines)[number]): number =>
    l.row_type === 'input_block' && l.block_code !== null
      ? (blockSign.get(l.block_code) ?? 0)
      : l.row_type === 'group_total'
        ? lines.filter((c) => c.parent_line_code === l.line_code).reduce((s, c) => s + lineSign(c), 0)
        : 0;
  const rows: SpineRow[] = [];
  for (const l of lines) {
    const level = l.parent_line_code === null ? 0 : 1;
    const isCost = lineSign(l) < 0;
    rows.push({
      code: l.line_code,
      kind: KIND[l.row_type],
      label: l.line_name,
      alias: (entity === 'P' ? l.alias_products : entity === 'S' ? l.alias_services : null) ?? null,
      parent: l.parent_line_code,
      level,
      tag: l.tag,
      isKey: l.is_key,
      isCost,
    });
    if (l.row_type !== 'input_block') continue;
    for (const a of accounts)
      if (a.block_code === l.block_code && a.has_fact_rows && IN_SCOPE[entity].has(a.entity_scope))
        rows.push({
          code: a.account_code,
          kind: 'leaf',
          label: a.account_name,
          alias: null,
          parent: l.line_code,
          level: level === 0 ? 1 : 2,
          tag: a.is_intercompany ? 'IC' : null, // L-14
          isKey: false,
          isCost, // leaves follow their block, so a displayed block always equals the sum of its displayed leaves
        });
  }
  return rows;
}

/**
 * Values of every spine row from per-account amounts (index = manifest.dict.account). Blocks are plain sums of
 * signed leaves (M-01); subtotals, group totals and ratios evaluate their dim_report_line formula. A ratio with a
 * zero denominator is null ("n/a").
 */
export function evaluateSpine(
  m: Manifest,
  spine: readonly SpineRow[],
  accounts: Float64Array,
): Map<string, number | null> {
  const accountIdx = new Map(m.tables.dim_account.map((a) => [a.account_code, m.dict.account.indexOf(a.account_code)]));
  const formulas = new Map(m.tables.dim_report_line.map((l) => [l.line_code, l.formula]));
  const values = new Map<string, number | null>();

  for (const r of spine)
    if (r.kind === 'leaf') {
      const v = accounts[accountIdx.get(r.code) ?? -1] ?? 0;
      values.set(r.code, v);
      if (r.parent !== null) values.set(r.parent, (values.get(r.parent) ?? 0) + v);
    } else if (r.kind === 'block' && !values.has(r.code)) values.set(r.code, 0);

  const resolving = new Set<string>();
  const valueOf = (code: string): number | null => {
    const known = values.get(code);
    if (known !== undefined) return known;
    const formula = formulas.get(code);
    if (!formula) throw new Error(`spine: no value or formula for ${code}`);
    if (resolving.has(code)) throw new Error(`spine: circular formula at ${code}`);
    resolving.add(code);
    const v = evaluateFormula(formula, valueOf);
    resolving.delete(code);
    values.set(code, v);
    return v;
  };
  for (const r of spine) valueOf(r.code);
  return values;
}

/** dim_report_line formula grammar: `A + B + …`, `A / B`, `-A / B` (operands are line codes). */
export function evaluateFormula(formula: string, valueOf: (code: string) => number | null): number | null {
  const sum = (expr: string): number | null => {
    let total = 0;
    for (const raw of expr.split('+')) {
      const term = raw.trim();
      const negative = term.startsWith('-');
      const code = negative ? term.slice(1).trim() : term;
      if (!/^[A-Z][A-Z0-9_]*$/.test(code)) throw new Error(`spine: bad term "${term}" in "${formula}"`);
      const v = valueOf(code);
      if (v === null) return null;
      total += negative ? -v : v;
    }
    return total;
  };
  const [numerator, denominator, extra] = formula.split('/');
  if (extra !== undefined || numerator === undefined) throw new Error(`spine: bad formula "${formula}"`);
  const num = sum(numerator);
  if (denominator === undefined) return num;
  const den = sum(denominator);
  return num === null || den === null || den === 0 ? null : num / den;
}

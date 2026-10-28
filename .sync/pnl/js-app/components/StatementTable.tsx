import type { CSSProperties } from 'react';
import { displayValue, formatAmount, formatPercent, formatPoints, roundsToZero, type Units } from '@/lib/engine/format';
import { statementColumns } from '@/lib/engine/hide-empty';
import type { Selection, StatementRow, Variance } from '@/lib/engine/types';
import { ChevronIcon } from './Icons';
import styles from './statement.module.css';

// P&L statement, Variance layout (spec §4, design guide §6.1). Renders engine values only: the table formats and
// colours them, it never computes a number (no business logic in components). Rows read as Track B ("01. GROSS
// REVENUE", parity rule 11); Expand all / Collapse all sit above the line column (M-20).

const BASE_LABEL = { A: 'Actual', LE: 'Latest estimate', B: 'Budget' } as const;
const SHORT = { A: 'Actual', LE: 'Latest est.', B: 'Budget', PY: 'Prior year' } as const;
const COMPARE_LABEL = { B: 'Budget', LE: 'Latest estimate', PY: 'Prior year' } as const;
const POINTS: Units = { divisor: 0.01, decimals: 1 }; // ratio Δ shown in percentage points (M-11)
const BAR_SCALE = 0.15; // ±15 % = a full half cell

const TAG_STYLE: Record<string, CSSProperties> = {
  'IFRS 18': { borderColor: 'var(--ink-700)', color: 'var(--ink-700)' },
  MPM: { borderColor: 'var(--slate-600)', borderStyle: 'dashed', color: 'var(--slate-600)' },
  Mgmt: { borderColor: 'var(--slate-600)', borderStyle: 'dashed', color: 'var(--slate-600)' },
  IC: { borderColor: 'var(--ic)', color: 'var(--ic)' },
};

type ColumnKind =
  'base' | 'pctNr' | 'cmpA' | 'dA' | 'dApct' | 'bar' | 'cmpB' | 'dB' | 'dBpct' | 'fyBud' | 'fyLe' | 'fyD';
interface Column {
  kind: ColumnKind;
  width: number;
  title: string;
  groupStart: boolean;
}

function buildColumns(sel: Selection, windowLabel: string) {
  const columns: Column[] = [];
  const groups: { title: string; span: number }[] = [];
  const show = statementColumns(sel); // the same columns Hide empty lines judges (M-22)
  const amount = show.amount;
  const pct = show.percent;
  const push = (title: string, cols: Omit<Column, 'groupStart'>[]) => {
    groups.push({ title, span: cols.length });
    cols.forEach((c, i) => columns.push({ ...c, groupStart: i === 0 && columns.length > 0 }));
  };
  push(`${windowLabel} - ${BASE_LABEL[sel.base]}`, [
    { kind: 'base', width: 84, title: SHORT[sel.base] },
    ...(show.pctNr ? [{ kind: 'pctNr' as const, width: 60, title: '% NR' }] : []),
  ]);
  if (sel.compareA !== 'NONE')
    push(`vs ${COMPARE_LABEL[sel.compareA]}`, [
      { kind: 'cmpA', width: 84, title: SHORT[sel.compareA] },
      ...(amount ? [{ kind: 'dA' as const, width: 72, title: 'Δ' }] : []),
      ...(pct ? [{ kind: 'dApct' as const, width: 62, title: 'Δ %' }] : []),
      { kind: 'bar', width: 84, title: '±15%' },
    ]);
  if (sel.compareB !== 'NONE')
    push(`vs ${COMPARE_LABEL[sel.compareB]}`, [
      { kind: 'cmpB', width: 84, title: SHORT[sel.compareB] },
      ...(amount ? [{ kind: 'dB' as const, width: 72, title: 'Δ' }] : []),
      ...(pct ? [{ kind: 'dBpct' as const, width: 62, title: 'Δ %' }] : []),
    ]);
  if (show.fyOutlook)
    push(`Full year ${sel.fy}`, [
      { kind: 'fyBud', width: 84, title: 'Budget' },
      { kind: 'fyLe', width: 84, title: 'Latest est.' },
      ...(amount ? [{ kind: 'fyD' as const, width: 72, title: 'Δ' }] : []),
    ]);
  return { columns, groups };
}

const rowClass = (r: StatementRow) =>
  r.kind === 'ratio'
    ? styles.ratio
    : r.kind === 'memo'
      ? styles.memo
      : r.kind === 'subtotal'
        ? r.isKey
          ? styles.key
          : styles.subtotal
        : r.kind === 'leaf'
          ? ''
          : styles.section;

export interface StatementFormat {
  units: Units;
  unitsLabel: string; // e.g. "USD m"
  costMultiplier: number; // param_cost_sign (F-15)
}

export function StatementTable({
  rows,
  sel,
  windowLabel,
  format,
  open,
  onToggle,
  onExpandAll,
  onCollapseAll,
}: {
  rows: readonly StatementRow[];
  sel: Selection;
  windowLabel: string;
  format: StatementFormat;
  open: ReadonlySet<string>;
  onToggle: (code: string) => void;
  onExpandAll: () => void; // M-20: every leaf open
  onCollapseAll: () => void; // M-20: blocks and subtotals only
}) {
  const { columns, groups } = buildColumns(sel, windowLabel);
  const parents = new Set(rows.map((r) => r.parent).filter((p) => p !== null));
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const visible = rows.filter((r) => {
    for (let p = r.parent; p !== null; p = byCode.get(p)?.parent ?? null) if (!open.has(p)) return false;
    return true;
  });

  const text = (r: StatementRow, kind: Exclude<ColumnKind, 'bar'>): { text: string; tone: string | undefined } => {
    const ratio = r.kind === 'ratio';
    const value = (v: number | null) =>
      ratio ? formatPercent(v) : formatAmount(displayValue(v, r.isCost, format.costMultiplier), format.units);
    const tone = (v: Variance | null) => {
      if (!v || v.delta === null || v.favourable === null || roundsToZero(v.delta, ratio ? POINTS : format.units))
        return '';
      return v.favourable ? styles.fav : styles.unf;
    };
    const delta = (v: Variance | null) => ({
      text: ratio ? formatPoints(v?.delta ?? null) : formatAmount(v?.delta ?? null, format.units, { signed: true }),
      tone: tone(v),
    });
    const deltaPct = (v: Variance | null) => ({
      text: ratio ? '' : formatPercent(v?.deltaPct ?? null, 1, { signed: true }),
      tone: tone(v),
    });
    switch (kind) {
      case 'base':
        return { text: value(r.base), tone: '' };
      case 'pctNr':
        return { text: ratio ? '' : formatPercent(r.pctNr), tone: styles.muted };
      case 'cmpA':
        return { text: value(r.compareA?.value ?? null), tone: '' };
      case 'dA':
        return delta(r.compareA);
      case 'dApct':
        return deltaPct(r.compareA);
      case 'cmpB':
        return { text: value(r.compareB?.value ?? null), tone: '' };
      case 'dB':
        return delta(r.compareB);
      case 'dBpct':
        return deltaPct(r.compareB);
      case 'fyBud':
        return { text: value(r.fyBudget), tone: '' };
      case 'fyLe':
        return { text: value(r.fyLE.value), tone: '' };
      case 'fyD':
        return delta(r.fyLE);
    }
  };

  const bar = (r: StatementRow) => {
    const pct = r.kind === 'ratio' ? null : (r.compareA?.deltaPct ?? null);
    if (pct === null) return null;
    const half = Math.min(1, Math.abs(pct) / BAR_SCALE) * 50;
    return (
      <span
        className={`${styles.bar} ${pct < 0 ? styles.barUnf : styles.barFav}`}
        style={{ left: `${pct < 0 ? 50 - half : 50}%`, width: `${Math.max(half, 0.5)}%` }}
      />
    );
  };

  return (
    <section id="view-statement" role="tabpanel" aria-label="Income statement" className={styles.card}>
      <div role="group" aria-label="Statement rows" className={styles.rowTools}>
        <button type="button" className={styles.rowTool} onClick={onExpandAll}>
          Expand all
        </button>
        <button type="button" className={styles.rowTool} onClick={onCollapseAll}>
          Collapse all
        </button>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: 300 }} />
            {columns.map((c) => (
              <col key={c.kind} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className={styles.groupHead}>
              <th className={`${styles.sticky} ${styles.corner}`} />
              {groups.map((g, i) => (
                <th key={g.title} colSpan={g.span} scope="colgroup" className={i > 0 ? styles.groupGap : undefined}>
                  {g.title}
                </th>
              ))}
            </tr>
            <tr className={styles.colHead}>
              <th scope="col" className={`${styles.sticky} ${styles.lineHead}`}>
                Line - {format.unitsLabel}
              </th>
              {columns.map((c) => (
                <th
                  key={c.kind}
                  scope="col"
                  className={[
                    c.kind === 'base' && styles.baseHead,
                    c.kind === 'bar' && styles.barHead,
                    c.groupStart && styles.groupStart,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const expandable = parents.has(r.code);
              const isOpen = open.has(r.code);
              return (
                <tr key={r.code} className={`${styles.row} ${rowClass(r)}`}>
                  <th
                    scope="row"
                    className={`${styles.sticky} ${styles.lineCell}`}
                    style={{ paddingLeft: 12 + r.level * 22 }}
                  >
                    <span className={styles.lineInner}>
                      {expandable ? (
                        <button
                          type="button"
                          className={styles.toggle}
                          aria-expanded={isOpen}
                          onClick={() => onToggle(r.code)}
                        >
                          <ChevronIcon open={isOpen} />
                          <span>{r.display}</span>
                        </button>
                      ) : (
                        <span className={styles.noToggle}>{r.display}</span>
                      )}
                      {r.alias && <span className={styles.alias}>{r.alias}</span>}
                      {sel.showTags && r.tag && (
                        <span className={styles.tag} style={TAG_STYLE[r.tag]}>
                          {r.tag}
                        </span>
                      )}
                    </span>
                  </th>
                  {columns.map((c) => {
                    if (c.kind === 'bar')
                      return (
                        <td
                          key={c.kind}
                          aria-hidden="true"
                          className={`${styles.barCell} ${c.groupStart ? styles.groupStart : ''}`}
                        >
                          <span className={styles.barAxis} />
                          {bar(r)}
                        </td>
                      );
                    const cell = text(r, c.kind);
                    return (
                      <td
                        key={c.kind}
                        className={[cell.tone, c.groupStart && styles.groupStart].filter(Boolean).join(' ')}
                      >
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>
        {sel.fxBasis === 'CC'
          ? `All versions at FY${sel.fy} budget rates`
          : 'Actual at monthly average rates, budget at budget rates'}{' '}
        - costs {sel.costSign === 'POS' ? 'positive' : 'negative'} - Δ positive when favourable - bar = Δ % vs{' '}
        {sel.compareA === 'NONE' ? 'Compare A' : COMPARE_LABEL[sel.compareA]} on a ±15% scale - IFRS 18 required
        subtotal - MPM management-defined measure - IC intercompany
      </p>
    </section>
  );
}

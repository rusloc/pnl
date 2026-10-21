// P&L statement (L-07, §4, design brief §6.1): sticky line column and header,
// row kinds, expand/collapse, tags, ±15 % bars, footnote. Columns follow the
// display settings (F-15 to F-17) and the chosen comparisons (F-06, F-07).
import { Fragment, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { fmtAmount, fmtPct, fmtPp, pctToneOf, toneOf } from '../model/format';
import { VERSION_LABEL, VERSION_SHORT, windowLabel } from '../model/filters';
import { LIVE_STATEMENT_DETAIL, SAMPLE_FIGURES_DETAIL } from '../model/sample-mode';
import { visibleRows } from '../model/statement-rows';
import type { EntityCode, Figures, FilterState, RowKind, StatementRow, Tone } from '../model/types';
import { LiveChip } from '../components/live-chip';
import { SampleChip } from '../components/sample-chip';
import { ChevronIcon } from '../components/ui/icons';

const KIND_CLASS: Record<RowKind, string> = {
  sec: 'bg-surface font-medium text-[14px] text-ink-900 border-t-group-rule',
  grp: 'bg-surface font-medium text-[14px] text-ink-900 border-t-group-rule',
  leaf: 'bg-surface font-normal text-[14px] text-ink-900 border-t-line-100',
  ent: 'bg-surface font-normal text-[14px] text-ink-900 border-t-line-100',
  sub: 'bg-subtle font-semibold text-[14px] text-ink-900 border-t-subtotal-rule',
  memo: 'bg-subtle font-medium italic text-[14px] text-ink-900 border-t-subtotal-rule',
  key: 'bg-acc-t font-bold text-[14px] text-ink-900 border-t-key-rule',
  ratio: 'bg-surface font-normal italic text-[13px] text-slate-600 border-t-line-100',
};

const TAG_STYLE: Record<string, { color: string; dashed: boolean }> = {
  'IFRS 18': { color: '#2B3748', dashed: false },
  MPM: { color: '#4F5C6C', dashed: true },
  Mgmt: { color: '#4F5C6C', dashed: true },
  IC: { color: '#6B48C8', dashed: false },
};

const TONE_CLASS: Record<Tone, string> = { fav: 'text-fav', unf: 'text-unf', neutral: '' };

type ColumnKind = 'base' | 'pctNr' | 'cmpA' | 'dA' | 'dApct' | 'bar' | 'cmpB' | 'dB' | 'dBpct' | 'fyBud' | 'fyLe' | 'fyD';

interface Column {
  kind: ColumnKind;
  width: number;
  title: string;
  /** Starts a column group (1 px rule on the left). */
  groupStart: boolean;
}

interface ColumnGroup {
  title: string;
  span: number;
}

function buildColumns(filter: FilterState): { columns: Column[]; groups: ColumnGroup[] } {
  const columns: Column[] = [];
  const groups: ColumnGroup[] = [];
  const showAmount = filter.varianceFormat !== 'pct';
  const showPct = filter.varianceFormat !== 'amount';
  const push = (title: string, cols: Omit<Column, 'groupStart'>[]) => {
    if (cols.length === 0) return;
    groups.push({ title, span: cols.length });
    cols.forEach((c, i) => columns.push({ ...c, groupStart: i === 0 && columns.length > 0 }));
  };

  const base: Omit<Column, 'groupStart'>[] = [{ kind: 'base', width: 84, title: VERSION_SHORT[filter.baseVersion] }];
  if (filter.showPctNr) base.push({ kind: 'pctNr', width: 60, title: '% NR' });
  push(`${windowLabel(filter)} · ${VERSION_LABEL[filter.baseVersion]}`, base);

  if (filter.compareA !== 'NONE') {
    const a: Omit<Column, 'groupStart'>[] = [{ kind: 'cmpA', width: 84, title: VERSION_SHORT[filter.compareA] }];
    if (showAmount) a.push({ kind: 'dA', width: 72, title: 'Δ' });
    if (showPct) a.push({ kind: 'dApct', width: 62, title: 'Δ %' });
    a.push({ kind: 'bar', width: 84, title: '±15%' });
    push(`vs ${VERSION_LABEL[filter.compareA]}`, a);
  }
  if (filter.compareB !== 'NONE') {
    const b: Omit<Column, 'groupStart'>[] = [{ kind: 'cmpB', width: 84, title: VERSION_SHORT[filter.compareB] }];
    if (showAmount) b.push({ kind: 'dB', width: 72, title: 'Δ' });
    if (showPct) b.push({ kind: 'dBpct', width: 62, title: 'Δ %' });
    push(`vs ${VERSION_LABEL[filter.compareB]}`, b);
  }
  if (filter.showFyOutlook) {
    const fy: Omit<Column, 'groupStart'>[] = [
      { kind: 'fyBud', width: 84, title: 'Budget' },
      { kind: 'fyLe', width: 84, title: 'Latest est.' },
    ];
    if (showAmount) fy.push({ kind: 'fyD', width: 72, title: 'Δ' });
    push(`Full year ${filter.fiscalYear}`, fy);
  }
  return { columns, groups };
}

interface CellText {
  text: string;
  tone: Tone;
  muted: boolean;
}

function cellText(row: StatementRow, kind: Exclude<ColumnKind, 'bar'>, filter: FilterState): CellText {
  const v = row.values;
  const ratio = row.kind === 'ratio';
  const amount = (value: number | null) => {
    if (ratio) return fmtPct(value);
    const shown = filter.costSign === 'pos' && value !== null && value < 0 ? -value : value;
    return fmtAmount(shown, filter.units);
  };
  const delta = (value: number | null) => (ratio ? fmtPp(value) : fmtAmount(value, filter.units, true));
  const deltaPct = (value: number | null) => (ratio ? '' : fmtPct(value, true));
  const decimals = filter.units === 'k' && !ratio ? 3 : 1;
  const tone = (d: number | null): Tone => (row.neutralDelta ? 'neutral' : toneOf(d, decimals));
  const pctTone = (d: number | null, p: number | null): Tone =>
    row.neutralDelta ? 'neutral' : pctToneOf(d, p, decimals);
  switch (kind) {
    case 'base':
      return { text: amount(v.base), tone: 'neutral', muted: false };
    case 'pctNr':
      return { text: ratio ? '' : fmtPct(v.pctNr), tone: 'neutral', muted: !ratio };
    case 'cmpA':
      return { text: amount(v.cmpA), tone: 'neutral', muted: false };
    case 'dA':
      return { text: delta(v.dA), tone: tone(v.dA), muted: false };
    case 'dApct':
      return { text: deltaPct(v.dApct), tone: pctTone(v.dA, v.dApct), muted: false };
    case 'cmpB':
      return { text: amount(v.cmpB), tone: 'neutral', muted: false };
    case 'dB':
      return { text: delta(v.dB), tone: tone(v.dB), muted: false };
    case 'dBpct':
      return { text: deltaPct(v.dBpct), tone: pctTone(v.dB, v.dBpct), muted: false };
    case 'fyBud':
      return { text: amount(v.fyBud), tone: 'neutral', muted: false };
    case 'fyLe':
      return { text: amount(v.fyLe), tone: 'neutral', muted: false };
    case 'fyD':
      return { text: delta(v.fyD), tone: tone(v.fyD), muted: false };
  }
}

interface StatementViewProps {
  figures: Figures;
  filter: FilterState;
  entity: EntityCode;
  openCodes: ReadonlySet<string>;
  onToggleRow: (code: string) => void;
}

export function StatementView({ figures, filter, openCodes, onToggleRow }: StatementViewProps) {
  const { columns, groups } = useMemo(() => buildColumns(filter), [filter]);
  const rows = useMemo(() => visibleRows(figures.statement, openCodes, filter), [figures.statement, openCodes, filter]);
  const template = `minmax(300px, 1fr) ${columns.map((c) => `${c.width}px`).join(' ')}`;
  const rowHeight = 28;
  const unavailable =
    filter.layout !== 'variance'
      ? `${filter.layout === 'trend' ? 'Trend' : 'Entity columns'} layout is not built yet; showing Variance.`
      : filter.costLens === 'nature'
        ? 'By nature lens is not built yet; showing By function.'
        : null;

  return (
    <section
      id="view-pnl"
      aria-label="Income statement"
      className="flex min-h-[320px] flex-auto flex-col overflow-hidden rounded-[12px] border border-line-200 bg-surface"
    >
      {unavailable && (
        <p className="m-0 border-b border-line-100 px-[16px] py-[6px] text-[12px] text-slate-600">{unavailable}</p>
      )}
      <div className="min-h-0 flex-auto overflow-auto">
        <div className="min-w-[1180px] font-ledger-condensed tabular-nums">
          <div className="sticky top-0 z-[3] bg-surface">
            <div className="grid text-[12px] font-semibold text-ink-900" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-[1] bg-surface" />
              {groups.map((g, i) => (
                <div
                  key={g.title}
                  className={cn('border-b-2 border-b-ink-900 px-[8px] pb-[6px] pt-[8px] text-center', i > 0 && 'border-l-[12px] border-l-surface')}
                  style={{ gridColumn: `span ${g.span}` }}
                >
                  {g.title}
                </div>
              ))}
            </div>
            <div className="grid border-b border-line-300 text-[12px] font-semibold text-slate-600" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-[1] bg-surface py-[8px] pl-[20px] pr-[8px]">
                Line · {filter.currency} {filter.units}
              </div>
              {columns.map((c) => (
                <div
                  key={c.kind}
                  className={cn(
                    'p-[8px]',
                    c.kind === 'bar' ? 'text-center' : 'text-right',
                    c.kind === 'base' && 'text-ink-900',
                    c.groupStart && 'border-l border-l-group-rule'
                  )}
                >
                  {c.title}
                </div>
              ))}
            </div>
          </div>

          {rows.map(({ row, depth, hasChildren, open }) => (
            <div
              key={row.code}
              role="row"
              data-row-kind={row.kind}
              className={cn('grid items-stretch border-t', KIND_CLASS[row.kind])}
              style={{ gridTemplateColumns: template, minHeight: rowHeight }}
            >
              <div
                className={cn('sticky left-0 z-[1] flex min-w-0 flex-wrap items-center gap-x-[8px] gap-y-[4px] py-[2px] pr-[8px]', KIND_CLASS[row.kind].split(' ')[0])}
                style={{ paddingLeft: 12 + depth * 22 }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => onToggleRow(row.code)}
                    className="flex min-h-[30px] cursor-pointer items-center gap-[6px] border-0 bg-transparent p-0 text-left"
                    style={{ font: 'inherit', color: 'inherit' }}
                  >
                    <ChevronIcon open={open} />
                    <span>{row.label}</span>
                  </button>
                ) : (
                  <span className="pl-[18px]">{row.label}</span>
                )}
                {row.alias && <span className="whitespace-nowrap text-[12px] font-normal not-italic text-slate-600">{row.alias}</span>}
                {filter.showTags &&
                  row.tags.map((tag) => {
                    const s = TAG_STYLE[tag] ?? { color: '#4F5C6C', dashed: false };
                    return (
                      <span
                        key={tag}
                        className="whitespace-nowrap rounded-[4px] border px-[6px] font-ledger text-[11px] font-medium not-italic leading-[16px]"
                        style={{ borderColor: s.color, borderStyle: s.dashed ? 'dashed' : 'solid', color: s.color }}
                      >
                        {tag}
                      </span>
                    );
                  })}
              </div>
              {columns.map((c) => {
                if (c.kind === 'bar') {
                  const v = row.barFraction;
                  const has = v !== null;
                  const w = has ? Math.max(1, Math.abs(v) * 42) : 0;
                  return (
                    <div key={c.kind} aria-hidden="true" className="relative min-h-[20px]">
                      <div className="absolute bottom-[6px] left-1/2 top-[6px] w-px bg-line-300" />
                      {has && (
                        <div
                          className={cn('absolute bottom-[30%] top-[30%] rounded-[2px]', v < 0 ? 'bg-unf-bar' : 'bg-fav-bar')}
                          style={{ left: `${v < 0 ? 50 - w : 50}%`, width: `${w}%` }}
                        />
                      )}
                    </div>
                  );
                }
                const cell = cellText(row, c.kind, filter);
                return (
                  <Fragment key={c.kind}>
                    <div
                      className={cn(
                        'flex items-center justify-end whitespace-nowrap px-[8px]',
                        c.groupStart && 'border-l border-l-group-rule',
                        cell.muted ? 'text-slate-600' : TONE_CLASS[cell.tone]
                      )}
                    >
                      {cell.text}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="m-0 flex flex-none flex-wrap items-center justify-between gap-[8px] border-t border-line-100 px-[16px] py-[8px] text-[12px] text-slate-600">
        <span>
          Actual at monthly average rates, budget at budget rates · costs negative · Δ positive when favourable · bar = Δ %
          vs Budget on a ±15% scale · IFRS 18 required subtotal · MPM management-defined measure · IC intercompany
        </span>
        {figures.liveStatement ? (
          <LiveChip detail={LIVE_STATEMENT_DETAIL} />
        ) : (
          figures.sample && <SampleChip detail={SAMPLE_FIGURES_DETAIL} />
        )}
      </p>
    </section>
  );
}

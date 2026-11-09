'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { A11Y, AXIS, WATERFALL } from '@/lib/engine/copy';
import type { BarView, RowView } from '@/lib/engine/view';

// The "Time structure" card (contract §5.2, §5.3): legend, 19-row table with plan / fact bars and Δ pills, the axis
// strips and the row tooltip (tt_time_structure content, opened after 200 ms on hover or focus).

const TOOLTIP_DELAY_MS = 200;
const ROW_H = 22.5;
const TABLE_TOP = 304.5;
const TOOLTIP_W = 210;
const TOOLTIP_H = 93;
const BOARD_W = 1440;
const BOARD_H = 810;

interface Tip {
  row: RowView;
  left: number;
  top: number;
}

function Bar({ bar }: { bar: BarView }) {
  return (
    <div
      className={bar.subtotal ? 'bar bar-sub' : 'bar bar-loss'}
      style={{ left: bar.x, width: bar.width }}
      title={bar.title}
    >
      {bar.label}
    </div>
  );
}

function Legend() {
  const { legend } = WATERFALL;
  return (
    <div className="legend">
      <span>
        <i className="sw sw-sub" />
        {legend.subtotal}
      </span>
      <span>
        <i className="sw sw-loss" />
        {legend.loss}
      </span>
      <span>
        <i className="sw sw-better" />
        {legend.better}
      </span>
      <span>
        <i className="sw sw-worse" />
        {legend.worse}
      </span>
    </div>
  );
}

export function Waterfall({ rows }: { rows: RowView[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const show = (row: RowView, index: number, pointerX: number | null) => {
    clear();
    timer.current = window.setTimeout(() => {
      const rowTop = TABLE_TOP + (index + 1) * ROW_H;
      setTip({
        row,
        left: Math.min((pointerX ?? 240) + 12, BOARD_W - TOOLTIP_W - 8),
        top: Math.min(rowTop + ROW_H, BOARD_H - TOOLTIP_H - 8),
      });
    }, TOOLTIP_DELAY_MS);
  };
  const hide = () => {
    clear();
    setTip(null);
  };
  const onRowKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  const { columns, columnLabels } = WATERFALL;
  return (
    <section aria-label={A11Y.timeStructure}>
      <div className="wf-card" />
      <div className="wf-heading">
        <h2>{WATERFALL.title}</h2>
        <p>{WATERFALL.subtitle}</p>
      </div>
      <Legend />
      <div className="wf-divider" />
      <table className="wf-table">
        <colgroup>
          <col className="c-cat" />
          <col className="c-plan" />
          <col className="c-pct" />
          <col className="c-fact" />
          <col className="c-pct" />
          <col className="c-delta" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{columns.category}</th>
            <th scope="col" className="th-plan">
              {columns.plan}
            </th>
            <th scope="col" className="num" aria-label={columnLabels.planPct}>
              {columns.planPct}
            </th>
            <th scope="col" className="th-fact">
              {columns.fact}
            </th>
            <th scope="col" className="num" aria-label={columnLabels.factPct}>
              {columns.factPct}
            </th>
            <th scope="col" className="delta">
              {columns.delta}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.sort}
              tabIndex={0}
              className={r.subtotal ? 'row-sub' : 'row-loss'}
              onMouseEnter={(e) =>
                show(r, i, e.clientX - (e.currentTarget.closest('.board')?.getBoundingClientRect().left ?? 0))
              }
              onMouseLeave={hide}
              onFocus={() => show(r, i, null)}
              onBlur={hide}
              onKeyDown={onRowKey}
            >
              <th scope="row" className="cat">
                {r.name}
              </th>
              <td className="bar-cell">
                <div className="grid grid-plan" />
                <Bar bar={r.planBar} />
              </td>
              <td className="num">{r.planText}</td>
              <td className="bar-cell">
                <div className="grid grid-fact" />
                <Bar bar={r.factBar} />
              </td>
              <td className="num">{r.factText}</td>
              <td className="delta">
                <span className={`pill tone-${r.tone}`}>{r.pill}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="axis axis-plan" aria-hidden="true">
        {AXIS.map((a) => (
          <span key={a}>{a}</span>
        ))}
      </div>
      <div className="axis axis-fact" aria-hidden="true">
        {AXIS.map((a) => (
          <span key={a}>{a}</span>
        ))}
      </div>
      {tip ? (
        <div className="tooltip" role="tooltip" style={{ left: tip.left, top: tip.top }}>
          <div className="tooltip-title">{tip.row.tooltip.title}</div>
          {tip.row.tooltip.lines.map((l) => (
            <div key={l.label} className="tooltip-line">
              <span>{l.label}</span>
              <span className="tooltip-value">{l.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

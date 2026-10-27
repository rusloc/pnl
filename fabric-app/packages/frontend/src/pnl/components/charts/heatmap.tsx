// Mix heatmap region × service line (redesign v4 Profitability page 2): each
// cell = NR at constant currency and its share of the region; the fill follows
// the column's GM % (PV-03) on the company tint → colour ramp of the model's
// `_Heat GM Fill Raw` (bands < 30 / < 50 / < 70 / ≥ 70 %); row, column and
// grand totals; native hover detail.
import { cn } from '@/lib/utils';

import { heatFill } from '../../model/heat-fill';
import type { EntityCode, Heat } from '../../model/types';

export function Heatmap({ heat, entity }: { heat: Heat; entity: EntityCode }) {
  const cols = heat.cols.length;
  return (
    <div className="min-h-0 flex-auto overflow-auto" data-testid="heatmap">
      <div
        className="grid min-h-full gap-[3px] text-[12px] tabular-nums"
        style={{ gridTemplateColumns: `minmax(110px, 1fr) repeat(${cols}, minmax(72px, 1.4fr)) minmax(64px, 0.9fr)`, gridTemplateRows: `auto repeat(${heat.rows.length}, minmax(0, 1fr)) auto` }}
      >
        <div />
        {heat.cols.map((c) => (
          <div key={c.key} className="flex flex-col items-center justify-end px-[2px] text-center leading-[1.2]">
            <span className="font-medium">{c.label}</span>
            <span className="text-[10.5px] text-slate-600">{c.gmText}</span>
          </div>
        ))}
        <div className="flex items-end justify-end text-[11px] font-medium text-slate-600">Region</div>
        {heat.rows.map((r) => (
          <div key={r.key} className="contents" data-testid="heat-row">
            <div className="flex items-center font-medium">{r.label}</div>
            {r.cells.map((cell, i) => {
              const c = heatFill(heat.cols[i]?.gm ?? null, entity);
              return (
                <div
                  key={heat.cols[i]?.key ?? i}
                  className="flex min-h-[44px] flex-col items-center justify-center rounded-[4px] leading-[1.2]"
                  style={{ backgroundColor: c.fill, color: c.ink }}
                  title={cell.detail}
                  data-testid="heat-cell"
                >
                  <span className="font-semibold">{cell.text}</span>
                  <span className="text-[10.5px] opacity-80">{cell.share}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-end font-semibold">{r.total}</div>
          </div>
        ))}
        <div className="flex items-center text-[11px] font-medium text-slate-600">Total</div>
        {heat.cols.map((c) => (
          <div key={c.key} className="flex items-center justify-center font-semibold">
            {c.total}
          </div>
        ))}
        <div className={cn('flex items-center justify-end font-semibold')}>{heat.grand}</div>
      </div>
    </div>
  );
}

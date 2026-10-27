// Concentration (redesign v4 Profitability page 1): three 100 % stacked bars
// (net revenue, contribution, Adj. EBITDA) by region, segment labels inside the
// bands that are wide enough, and a 2 × 2 legend with the drift from the
// revenue share to the EBITDA share in pp.
import type { Concentration } from '../../model/types';
import { regionColour } from './region-colours';

export function ConcentrationBars({ concentration }: { concentration: Concentration }) {
  const order = new Map(concentration.legend.map((l, i) => [l.key, i]));
  return (
    <div className="flex min-h-0 flex-auto flex-col justify-center gap-[14px]" data-testid="concentration">
      {concentration.levels.map((level) => (
        <div key={level.code} className="flex flex-col gap-[4px]" data-testid="concentration-level">
          <span className="text-[12px] font-medium text-slate-600">{level.label}</span>
          <div className="flex h-[34px] overflow-hidden rounded-[4px] bg-line-100" role="img" aria-label={`${level.label}: ${level.segments.map((s) => `${s.label} ${s.text}`).join(', ')}`}>
            {level.segments.map((s) => {
              const c = regionColour(order.get(s.key) ?? 0);
              const width = Math.max(0, Math.min(100, s.share * 100));
              return (
                <div
                  key={s.key}
                  className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[11.5px] font-semibold tabular-nums"
                  style={{ width: `${width}%`, backgroundColor: c.fill, color: c.ink }}
                  title={`${s.label} ${s.text}`}
                >
                  {width >= 9 ? s.text : ''}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <dl className="m-0 mt-[4px] grid grid-cols-2 gap-x-[16px] gap-y-[4px] text-[12px]" data-testid="concentration-legend">
        {concentration.legend.map((l, i) => (
          <div key={l.key} className="flex items-center gap-[6px]">
            <span aria-hidden="true" className="inline-block h-[9px] w-[9px] flex-none rounded-full" style={{ backgroundColor: regionColour(i).fill }} />
            <dt className="font-medium">{l.label}</dt>
            <dd className="m-0 text-slate-600 tabular-nums">{l.drift}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

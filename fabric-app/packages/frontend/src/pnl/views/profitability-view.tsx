// Profitability (L-09, C-46; redesign v4 build-brief §3), constant currency on
// every panel (PV-02). Page 1: the eight-column table by the breakdown (F-21;
// CM Δ pp carries the only status dot) and the concentration bars. Page 2:
// growth × margin by region (left) and the region × service line mix heatmap
// (right), both full height.
import { cn } from '@/lib/utils';

import { BubbleChart } from '../components/charts/bubble-chart';
import { ConcentrationBars } from '../components/charts/concentration-bars';
import { Heatmap } from '../components/charts/heatmap';
import type { Page } from '../components/pager';
import { Panel } from '../components/panel';
import { profitabilitySubtitle } from '../data/pnl-model-figures';
import type { Figures, FilterState, StatusKind } from '../model/types';

const DOT: Record<StatusKind, string> = {
  neutral: 'invisible',
  ontrack: 'bg-slate-400',
  ahead: 'bg-fav-bar',
  watch: 'bg-[#D9A441]',
  off: 'bg-unf',
};

const COLS = 'grid-cols-[minmax(150px,1.3fr)_88px_90px_70px_70px_92px_92px_100px]';

export function ProfitabilityView({ figures, filter, page }: { figures: Figures; filter: FilterState; page: Page }) {
  const p = figures.profitability;
  // Built from the selection (parity rule 13), so it reads right while the zone loads.
  const subtitle = profitabilitySubtitle(filter);
  if (page === 2) {
    return (
      <div id="view-prof" className="grid min-h-[420px] flex-auto gap-[12px] [grid-template-columns:1fr_1fr]" data-page="2">
        <Panel id="bubble" title="Growth × margin by region" subtitle={subtitle} info={figures.bubble.info} zone={figures.zones.bubble} what="growth × margin chart" empty={figures.bubble.points.length === 0} className="min-h-0">
          <BubbleChart bubble={figures.bubble} />
        </Panel>
        <Panel
          id="heat"
          title={`Mix - region × ${filter.entity === 'P' ? 'category' : 'service line'}`}
          subtitle={subtitle}
          info={figures.heat.info}
          zone={figures.zones.heat}
          what="mix heatmap"
          empty={figures.heat.rows.length === 0}
          className="min-h-0"
        >
          <Heatmap heat={figures.heat} entity={filter.entity} />
        </Panel>
      </div>
    );
  }
  const cell = 'px-[6px] py-[5px] text-right';
  return (
    <div id="view-prof" className="grid min-h-[420px] flex-auto gap-[12px] [grid-template-columns:minmax(0,1fr)_minmax(380px,470px)]" data-page="1">
      <Panel id="prof-table" title={`Profitability by ${p.column || 'Region'}`} subtitle={subtitle} info={p.info} zone={figures.zones.profitability} what="profitability table" empty={p.rows.length === 0} className="min-h-0">
        <div className="min-h-0 flex-auto overflow-auto font-ledger-condensed text-[13px] tabular-nums" data-testid="prof-table-grid">
          <div className={cn('grid border-b border-line-300 text-[11.5px] font-semibold text-slate-600', COLS)}>
            <div className="py-[5px] pr-[6px]">{p.column}</div>
            <div className={cell}>Net revenue</div>
            <div className={cell}>Δ vs {p.compareLabel} %</div>
            <div className={cell}>GM %</div>
            <div className={cell}>CM %</div>
            <div className={cell}>CM Δ pp</div>
            <div className={cell}>Contribution</div>
            <div className={cn(cell, 'flex flex-col items-end')}>
              <span>Adj. EBITDA</span>
              {p.allocated && (
                <span className="rounded-[4px] border border-dashed border-slate-400 px-[4px] font-ledger text-[10px] font-normal" data-testid="allocated-badge">
                  allocated - indicative
                </span>
              )}
            </div>
          </div>
          {p.rows.map((r) => (
            <div key={r.key} className={cn('grid items-center border-b border-line-100', COLS, r.total && 'border-t border-subtotal-rule bg-subtle font-semibold')} data-testid={r.total ? 'prof-total' : 'prof-row'}>
              <div className="py-[5px] pr-[6px] font-medium">{r.name}</div>
              <div className={cell}>{r.nrText}</div>
              <div className={cell}>{r.nrDeltaText}</div>
              <div className={cell}>{r.gm}</div>
              <div className={cell}>{r.cm}</div>
              <div className={cn(cell, 'flex items-center justify-end gap-[6px]')}>
                <span aria-hidden="true" className={cn('inline-block h-[8px] w-[8px] rounded-full', DOT[r.cmStatus])} data-testid="cm-dot" data-status={r.cmStatus} />
                {r.cmDeltaText}
              </div>
              <div className={cell}>{r.contributionText}</div>
              <div className={cell}>{r.ebitdaText}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel id="concentration" title="Concentration - share by profit level" info={figures.concentration.info} zone={figures.zones.concentration} what="concentration bars" empty={figures.concentration.levels.length === 0} className="min-h-0">
        <ConcentrationBars concentration={figures.concentration} />
      </Panel>
    </div>
  );
}

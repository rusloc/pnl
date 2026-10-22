// Key figures (L-06, §5, design brief §6.2): 8 financial + 4 operational tiles,
// each with a 13-month sparkline and a target bar (K-24, K-25; ADR-0007). The
// tile values render as soon as the KPI zone settles; the trends fill in after,
// each with its own state, and never hold the values back.
import { cn } from '@/lib/utils';

import { TrendArea } from '../components/kpi-trend';
import type { Figures, KpiTile, KpiTrendState, Tone } from '../model/types';
import { ZoneChip, ZoneState } from '../components/zone-state';

const PILL: Record<Tone, string> = {
  fav: 'bg-fav-tint text-fav',
  unf: 'bg-unf-tint text-unf',
  neutral: 'bg-line-100 text-ink-900',
};

function arrowFor(text: string): string {
  return text.startsWith('+') ? '▲' : text.startsWith('−') ? '▼' : '';
}

function Tile({ tile, trend, operational }: { tile: KpiTile; trend: KpiTrendState | undefined; operational: boolean }) {
  return (
    <article
      aria-label={tile.label}
      className={cn(
        'box-border flex min-h-0 flex-col justify-between rounded-[12px] border border-line-200',
        operational ? 'gap-[6px] bg-subtle px-[18px] py-[14px]' : 'gap-[8px] bg-surface px-[18px] py-[16px]'
      )}
    >
      <div className="flex flex-col gap-[2px]">
        <h3 className="m-0 text-[14px] font-medium text-slate-600">{tile.label}</h3>
        {tile.hint && <span className="text-[12px] text-slate-600">{tile.hint}</span>}
      </div>
      <div
        className={cn('font-semibold leading-[1.1] tabular-nums', operational ? 'text-[28px]' : 'text-[34px] tracking-[-0.01em]')}
      >
        {tile.value}
      </div>
      <div className="flex flex-col gap-[4px]">
        {tile.deltas.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-[8px] text-[13px]">
            <span className="text-slate-600">{d.name}</span>
            <span className={cn('inline-flex items-center gap-[4px] rounded-[12px] px-[8px] py-px font-semibold tabular-nums', PILL[d.tone])}>
              <span aria-hidden="true" className="text-[9px]">
                {d.arrow ? arrowFor(d.text) : ''}
              </span>
              {d.text}
            </span>
          </div>
        ))}
      </div>
      <TrendArea state={trend} target={tile.target} baseText={tile.value} />
    </article>
  );
}

const GRID = 'grid min-h-0 gap-[12px] [grid-template-columns:repeat(auto-fill,minmax(max(240px,calc((100%-36px)/4)),1fr))]';

export function KeyFiguresView({ figures }: { figures: Figures }) {
  const zone = figures.zones.kpi;
  return (
    <section id="view-kpi" aria-label="Key figures" className="flex min-h-[520px] flex-auto flex-col gap-[10px]">
      <h2 className="m-0 flex flex-none items-center gap-[10px] text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">
        Financial <ZoneChip status={zone} />
      </h2>
      <ZoneState status={zone} what="key figures" />
      <div className={cn(GRID, 'flex-[2_1_0] [grid-auto-rows:minmax(150px,1fr)]')}>
        {figures.financial.map((t) => (
          <Tile key={t.code} tile={t} trend={figures.trends[t.code]} operational={false} />
        ))}
      </div>
      <h2 className="m-0 mt-[4px] flex-none text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">Operational</h2>
      <div className={cn(GRID, 'flex-auto [grid-auto-rows:minmax(132px,1fr)]')}>
        {figures.operational.map((t) => (
          <Tile key={t.code} tile={t} trend={figures.trends[t.code]} operational />
        ))}
      </div>
    </section>
  );
}

// Key figures (L-06, §5, design brief §6.2; docs/design/kpi-card-v2.md): 8
// financial + 4 operational tiles, each with label (definition as tooltip),
// value, sub-line, and a comparison row per active Compare — a diverging bar
// on one shared scale plus the Δ text (K-20, K-21). Growth KPIs show the value
// and sub-line only. Everything on a tile comes from the KPI zone's own query.
import { cn } from '@/lib/utils';

import { CompareRow } from '../components/kpi-compare-row';
import type { Figures, KpiTile } from '../model/types';
import { ZoneChip, ZoneState } from '../components/zone-state';

function Tile({ tile, operational }: { tile: KpiTile; operational: boolean }) {
  return (
    <article
      aria-label={tile.label}
      className={cn(
        'box-border flex min-h-0 flex-col justify-between rounded-[12px] border border-line-200',
        operational ? 'gap-[6px] bg-subtle px-[18px] py-[14px]' : 'gap-[8px] bg-surface px-[18px] py-[16px]'
      )}
    >
      <div className="flex flex-col gap-[4px]">
        <h3 className="m-0 text-[14px] font-medium text-slate-600" title={tile.hint || undefined}>
          {tile.label}
        </h3>
        <div
          className={cn('font-semibold leading-[1.1] tabular-nums', operational ? 'text-[28px]' : 'text-[34px] tracking-[-0.01em]')}
        >
          {tile.value}
        </div>
        {tile.sublines.map((line) => (
          <span key={line} className="text-[12px] text-slate-600">
            {line}
          </span>
        ))}
      </div>
      {tile.compares.length > 0 && (
        <div className="flex flex-col gap-[4px]">
          {tile.compares.map((c) => (
            <CompareRow key={c.name} compare={c} />
          ))}
        </div>
      )}
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
          <Tile key={t.code} tile={t} operational={false} />
        ))}
      </div>
      <h2 className="m-0 mt-[4px] flex-none text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">Operational</h2>
      <div className={cn(GRID, 'flex-auto [grid-auto-rows:minmax(132px,1fr)]')}>
        {figures.operational.map((t) => (
          <Tile key={t.code} tile={t} operational />
        ))}
      </div>
    </section>
  );
}

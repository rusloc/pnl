// Analysis (L-08, C-40, C-45, design brief §6.3): net revenue bridge and the
// largest variances vs the comparison.
import { cn } from '@/lib/utils';

import { VERSION_LABEL } from '../model/filters';
import type { Figures, FilterState, Tone } from '../model/types';
import { InfoPopover } from '../components/info-popover';
import { ZoneChip, ZoneState } from '../components/zone-state';

const TEXT: Record<Tone, string> = { fav: 'text-fav', unf: 'text-unf', neutral: 'text-ink-900' };

export function AnalysisView({ figures, filter }: { figures: Figures; filter: FilterState }) {
  const { bridge, drivers } = figures;
  const maxDelta = Math.max(1, ...drivers.map((d) => Math.abs(d.delta)));
  const compare = VERSION_LABEL[filter.analysisCompare];
  const unitsWord = filter.units === 'm' ? 'millions' : 'thousands';
  return (
    <div id="view-ana" className="flex min-h-[460px] flex-auto flex-wrap gap-[16px]">
      <section
        aria-labelledby="h-bridge"
        className="box-border flex min-w-0 flex-[1.2_1_520px] flex-col gap-[4px] rounded-[12px] border border-line-200 bg-surface px-[20px] py-[16px]"
      >
        <h2 id="h-bridge" className="m-0 flex items-center gap-[10px] text-[17px] font-semibold">
          Net revenue bridge <InfoPopover info="bridge" context={{ comparison: compare }} /> <ZoneChip status={figures.zones.bridge} />
        </h2>
        <span className="text-[13px] text-slate-600">
          {compare} to {VERSION_LABEL[filter.baseVersion]}, {filter.currency} {unitsWord}. {bridge.subtitle}
        </span>
        <ZoneState status={figures.zones.bridge} what="net revenue bridge" />
        {bridge.steps.length > 0 && (
          <>
            <div className="mt-[20px] flex min-h-[220px] flex-auto gap-[10px] border-b border-slate-400">
              {bridge.steps.map((s) => (
                <div key={s.label} className="relative min-w-0 flex-[1_1_0]">
                  <div
                    className={cn(
                      'absolute left-[14%] right-[14%] rounded-t-[3px]',
                      s.kind === 'total' ? 'bg-acc' : s.kind === 'fav' ? 'bg-fav-bar' : 'bg-unf-bar'
                    )}
                    style={{ bottom: `${s.bottomPct}%`, height: `${s.heightPct}%` }}
                  />
                  <div
                    className={cn('absolute left-0 right-0 text-center text-[13px] font-semibold tabular-nums', TEXT[s.kind === 'total' ? 'neutral' : s.kind])}
                    style={{ bottom: `calc(${s.bottomPct + s.heightPct}% + 6px)` }}
                  >
                    {s.valueText}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-[10px] pt-[8px]">
              {bridge.steps.map((s) => (
                <div key={s.label} className="min-w-0 flex-[1_1_0] text-center text-[12px] leading-[1.3] text-ink-700">
                  {s.label}
                </div>
              ))}
            </div>
            <span className="mt-[8px] text-[12px] text-slate-600">
              The axis starts at {bridge.axisText}, so both totals are cut short and the steps stay readable.
            </span>
          </>
        )}
      </section>

      <section
        aria-labelledby="h-var"
        className="box-border flex min-w-0 flex-[1_1_460px] flex-col gap-[4px] rounded-[12px] border border-line-200 bg-surface px-[20px] py-[16px]"
      >
        <h2 id="h-var" className="m-0 flex items-center gap-[10px] text-[17px] font-semibold">
          Largest variances vs {compare} <InfoPopover info="variances" context={{ comparison: compare }} align="end" /> <ZoneChip status={figures.zones.drivers} />
        </h2>
        <span className="text-[13px] text-slate-600">Top 8 lines by size of Δ, {filter.currency} {unitsWord}</span>
        <ZoneState status={figures.zones.drivers} what="largest variances" />
        {drivers.length > 0 && (
          <div className="mt-[10px] flex flex-col tabular-nums">
            <div className="grid grid-cols-[minmax(150px,1.3fr)_minmax(100px,1fr)_64px_64px] border-b border-line-300 text-[12px] font-semibold text-slate-600">
              <div className="py-[6px] pr-[8px]">Line</div>
              <div className="px-[8px] py-[6px] text-center">Unfavourable · Favourable</div>
              <div className="px-[8px] py-[6px] text-right">Δ</div>
              <div className="py-[6px] pl-[8px] text-right">Δ %</div>
            </div>
            {drivers.map((d) => {
              const w = Math.max(1, (Math.abs(d.delta) / maxDelta) * 46);
              return (
                <div
                  key={`${d.name}|${d.block}`}
                  className="grid min-h-[48px] grid-cols-[minmax(150px,1.3fr)_minmax(100px,1fr)_64px_64px] items-center border-b border-line-100 text-[14px]"
                >
                  <div className="flex min-w-0 flex-col py-[4px] pr-[8px]">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-[12px] text-slate-600">{d.block}</span>
                  </div>
                  <div aria-hidden="true" className="relative mx-[8px] h-[22px]">
                    <div className="absolute bottom-0 left-1/2 top-0 w-px bg-line-300" />
                    <div
                      className={cn('absolute bottom-[4px] top-[4px] rounded-[2px]', d.delta < 0 ? 'bg-unf-bar' : 'bg-fav-bar')}
                      style={{ left: `${d.delta < 0 ? 50 - w : 50}%`, width: `${w}%` }}
                    />
                  </div>
                  <div className={cn('px-[8px] py-[4px] text-right font-semibold', TEXT[d.tone])}>{d.deltaText}</div>
                  <div className={cn('py-[4px] pl-[8px] text-right', TEXT[d.tone])}>{d.deltaPctText}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

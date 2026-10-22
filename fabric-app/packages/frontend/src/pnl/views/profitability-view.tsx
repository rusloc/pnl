// Profitability (L-09, C-46, design brief §6.4): table by breakdown and the
// contribution-margin bars with the company average marker.
import { cn } from '@/lib/utils';

import { windowLabel } from '../model/filters';
import { SAMPLE_WINDOW_LONG } from '../model/sample-mode';
import type { Figures, FilterState, Tone } from '../model/types';
import { InfoPopover } from '../components/info-popover';
import { ZoneChip, ZoneState } from '../components/zone-state';
import { COMPANY_THEME } from '../theme/company';

const TEXT: Record<Tone, string> = { fav: 'text-fav', unf: 'text-unf', neutral: 'text-ink-900' };
const COLS = 'grid-cols-[minmax(190px,1.4fr)_90px_minmax(130px,1fr)_84px_84px_96px_96px_96px]';

export function ProfitabilityView({ figures, filter }: { figures: Figures; filter: FilterState }) {
  const p = figures.profitability;
  const zone = figures.zones.profitability;
  // The heading names the breakdown the numbers show: the live mapper derives `by` from the filter;
  // the sample path keeps its own (LSN-002, F-21).
  const by = p.by;
  // L-15: `{comparison}` is the one the table's "vs …" column uses (C-40), `{breakdown}` the heading's.
  const info = { comparison: p.compareLabel, breakdown: by };
  const cmBars = p.rows.filter((r) => r.cm !== '');
  const cmPos = Math.min(100, (p.cmAveragePct / 60) * 100);
  const unitsWord = filter.units === 'm' ? 'millions' : 'thousands';
  return (
    <div id="view-prof" className="flex min-h-[420px] flex-auto flex-wrap gap-[16px]">
      <section
        aria-labelledby="h-prof"
        className="box-border flex min-w-0 flex-[1.7_1_640px] flex-col gap-[4px] rounded-[12px] border border-line-200 bg-surface px-[20px] py-[16px]"
      >
        <h2 id="h-prof" className="m-0 flex items-center gap-[10px] text-[17px] font-semibold">
          Profitability by {by} <InfoPopover info="profitability" context={info} /> <ZoneChip status={zone} />
        </h2>
        {/* LSN-002: while sample, the subtitle names the window the numbers actually show. */}
        <span className="text-[13px] text-slate-600">
          {figures.sample ? SAMPLE_WINDOW_LONG : windowLabel(filter, true)}, {filter.currency} {unitsWord}
        </span>
        <ZoneState status={zone} what="profitability table" />
        {p.rows.length > 0 && (
          <div className="mt-[12px] overflow-x-auto">
            <div className="min-w-[760px] tabular-nums">
              <div className={cn('grid border-b border-line-300 text-[12px] font-semibold text-slate-600', COLS)}>
                <div className="py-[6px] pr-[8px]">{p.column}</div>
                <div className="px-[8px] py-[6px] text-right">Net revenue</div>
                <div className="px-[8px] py-[6px]">Share</div>
                <div className="px-[8px] py-[6px] text-right">vs {p.compareLabel}</div>
                <div className="border-l border-group-rule px-[8px] py-[6px] text-right">Gross</div>
                <div className="px-[8px] py-[6px] text-right">Contribution</div>
                <div className="px-[8px] py-[6px] text-right">Adj. EBITDA</div>
                <div className="px-[8px] py-[6px] text-right">Operating</div>
              </div>
              <div className={cn('grid text-[11px] text-slate-600', COLS)}>
                <div />
                <div />
                <div />
                <div />
                <div className="col-span-4 border-l border-group-rule px-[8px] py-[2px] text-center">margin, % of net revenue</div>
              </div>
              {p.rows.map((r) => (
                <div key={r.name} className={cn('grid min-h-[48px] items-center border-t border-line-100 text-[14px]', COLS)}>
                  <div className="py-[6px] pr-[8px] font-medium">{r.name}</div>
                  <div className="px-[8px] py-[6px] text-right">{r.nrText}</div>
                  <div className="flex items-center gap-[8px] px-[8px] py-[6px]">
                    <div aria-hidden="true" className="h-[8px] flex-auto overflow-hidden rounded-[4px] bg-line-100">
                      <div className="h-full bg-acc" style={{ width: `${r.sharePct}%` }} />
                    </div>
                    <span className="w-[48px] text-right text-ink-700">{r.shareText}</span>
                  </div>
                  <div className={cn('px-[8px] py-[6px] text-right font-semibold', TEXT[r.tone])}>{r.deltaPctText}</div>
                  <div className="border-l border-group-rule px-[8px] py-[6px] text-right">{r.gm}</div>
                  <div className="px-[8px] py-[6px] text-right">{r.cm}</div>
                  <div className="px-[8px] py-[6px] text-right">{r.ebitda}</div>
                  <div className="px-[8px] py-[6px] text-right">{r.op}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {p.note && <span className="mt-[10px] text-[12px] text-slate-600">{p.note}</span>}
      </section>

      <section
        aria-labelledby="h-cm"
        className="box-border flex min-w-0 flex-[1_1_340px] flex-col gap-[4px] rounded-[12px] border border-line-200 bg-surface px-[20px] py-[16px]"
      >
        <h2 id="h-cm" className="m-0 flex items-center gap-[10px] text-[17px] font-semibold">
          Contribution margin by {by} <InfoPopover info="cm" context={info} align="end" />
        </h2>
        <span className="text-[13px] text-slate-600">
          Dashed line: {COMPANY_THEME[filter.entity].short} average {p.cmAverageText || 'n/a'}. Scale 0–60%.
        </span>
        <div className="mt-[16px] flex flex-col gap-[14px]">
          {cmBars.map((r) => {
            const value = parseFloat(r.cm.replace('%', '')) || 0;
            return (
              <div key={r.name} className="flex flex-col gap-[4px]">
                <div className="flex justify-between gap-[8px] text-[13px]">
                  <span>{r.name}</span>
                  <span className="font-semibold tabular-nums">{r.cm}</span>
                </div>
                <div aria-hidden="true" className="relative h-[14px] rounded-[3px] bg-line-100">
                  <div className="absolute bottom-0 left-0 top-0 rounded-[3px] bg-acc" style={{ width: `${Math.max(0, Math.min(100, (value / 60) * 100))}%` }} />
                  <div className="absolute -bottom-[3px] -top-[3px] border-l-2 border-dashed border-ink-900" style={{ left: `${cmPos}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

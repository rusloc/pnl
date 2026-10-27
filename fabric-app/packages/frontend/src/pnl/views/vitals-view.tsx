// Vitals (L-06, §5; redesign v4 build-brief §1; formerly Key figures): eyebrow
// "Results" → 3 hero cards + a column of 2 secondary cards; eyebrow "Drivers &
// health" → 5 driver cards whose content swaps by company (L-10). Every card:
// title · ⓘ · status chip · value · Δ rows (ADR-0012 §2.3). The ⓘ sub-metrics
// line comes from its own zone (`KPI Info Sub`), so the cards never wait for it.
import type { InfoDetail } from '../components/info-popover';
import { VitalsCard } from '../components/vitals-card';
import { ZoneChip, ZoneState } from '../components/zone-state';
import type { Figures, ZoneStatus } from '../model/types';

function detailFor(status: ZoneStatus, text: string | undefined): InfoDetail {
  if (status.kind === 'loading') return { kind: 'loading' };
  if (status.kind === 'error') return { kind: 'error', reason: status.reason };
  return text ? { kind: 'text', text } : null;
}

export function VitalsView({ figures }: { figures: Figures }) {
  const zone = figures.zones.vitals;
  const { results, drivers } = figures.vitals;
  const empty = results.length === 0 && drivers.length === 0;
  const heroes = results.filter((c) => c.tier === 'hero');
  const secondary = results.filter((c) => c.tier === 'secondary');
  const detail = (code: string) => detailFor(figures.zones.vitalsInfo, figures.vitalsInfo[code]);
  return (
    <section id="view-kpi" aria-label="Vitals" className="flex min-h-[520px] flex-auto flex-col gap-[10px]">
      <h2 className="m-0 flex flex-none items-center gap-[10px] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">
        Results <ZoneChip status={zone} />
      </h2>
      <ZoneState status={zone} what="vitals" empty={empty} />
      {!empty && zone.kind !== 'loading' && zone.kind !== 'error' && (
        <>
          <div className="grid min-h-0 flex-[1.15_1_0] gap-[10px] [grid-template-columns:1fr_1fr_1fr_minmax(240px,292px)]" data-testid="vitals-results">
            {heroes.map((c) => (
              <VitalsCard key={c.code} card={c} detail={detail(c.code)} />
            ))}
            <div className="grid min-h-0 gap-[10px] [grid-template-rows:1fr_1fr]">
              {secondary.map((c) => (
                <VitalsCard key={c.code} card={c} detail={detail(c.code)} />
              ))}
            </div>
          </div>
          <h2 className="m-0 flex-none text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">Drivers &amp; health</h2>
          <div className="grid min-h-0 flex-auto gap-[10px] [grid-template-columns:repeat(5,minmax(0,1fr))]" data-testid="vitals-drivers">
            {drivers.map((c) => (
              <VitalsCard key={c.code} card={c} detail={detail(c.code)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

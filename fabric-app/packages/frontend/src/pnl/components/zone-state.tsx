// Per-zone status (ADR-0006 phase 2): the chip a live zone carries, and the
// panel a zone shows while its model query is in flight or after it failed —
// never numbers that do not match the filters (LSN-002).
import { LIVE_ZONE_DETAIL, SAMPLE_FIGURES_DETAIL, zoneErrorText, zoneLoadingText } from '../model/sample-mode';
import type { ZoneStatus } from '../model/types';
import { LiveChip } from './live-chip';
import { SampleChip } from './sample-chip';
import { InfoIcon } from './ui/icons';

/** The chip for a zone's status; nothing while loading or failed (the panel says so). */
export function ZoneChip({ status }: { status: ZoneStatus }) {
  if (status.kind === 'live') return <LiveChip detail={LIVE_ZONE_DETAIL} />;
  if (status.kind === 'sample') return <SampleChip detail={SAMPLE_FIGURES_DETAIL} />;
  return null;
}

/** Loading / error panel that replaces a zone's content; `what` names the zone in the copy. */
export function ZoneState({ status, what }: { status: ZoneStatus; what: string }) {
  if (status.kind === 'loading') {
    return (
      <p role="status" aria-busy="true" className="m-0 flex items-center gap-[8px] px-[16px] py-[24px] text-[13px] text-slate-600">
        <span aria-hidden="true" className="inline-block h-[10px] w-[10px] animate-pulse rounded-full bg-acc" />
        {zoneLoadingText(what)}
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <div role="alert" className="m-[16px] flex gap-[8px] rounded-[8px] border border-notice-border bg-notice-tint px-[12px] py-[10px] text-[13px] text-notice-text">
        <InfoIcon className="mt-[2px] flex-none" />
        <span>
          {zoneErrorText(what, status.reason)}
          {status.requestId ? ` (request ${status.requestId})` : ''}
        </span>
      </div>
    );
  }
  return null;
}

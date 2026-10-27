// Panel of the redesigned views (ADR-0012): title row = title · toolbar ·
// ⓘ (top-right, PV-17) · zone chip; then the zone's loading / error state or
// its content. No prose under the title: the subtitle, when there is one, is
// the one line built from the selection (parity rule 13).
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { InfoCopy, ZoneStatus } from '../model/types';
import { type InfoDetail, InfoPopover } from './info-popover';
import { ZoneChip, ZoneState } from './zone-state';

interface PanelProps {
  id: string;
  title: string;
  subtitle?: string;
  info: InfoCopy;
  detail?: InfoDetail;
  zone: ZoneStatus;
  /** Names the zone in the loading / error copy. */
  what: string;
  /** True when the zone is settled but has nothing to show (sample mode): the note replaces the content. */
  empty?: boolean;
  toolbar?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

export function Panel({ id, title, subtitle, info, detail, zone, what, empty = false, toolbar, align = 'end', className, children }: PanelProps) {
  const headingId = `h-${id}`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('box-border flex min-h-0 min-w-0 flex-col gap-[4px] rounded-[12px] border border-line-200 bg-surface px-[16px] pb-[10px] pt-[10px]', className)}
    >
      <div className="flex min-h-[30px] flex-none flex-wrap items-center gap-[10px]">
        <h2 id={headingId} className="m-0 text-[15px] font-semibold">
          {title}
        </h2>
        {toolbar}
        <span className="ml-auto flex items-center gap-[8px]">
          <ZoneChip status={zone} />
          <InfoPopover info={info} detail={detail} align={align} />
        </span>
      </div>
      {subtitle && (
        <span className="flex-none text-[12px] text-slate-600" data-testid={`${id}-subtitle`}>
          {subtitle}
        </span>
      )}
      <ZoneState status={zone} what={what} empty={empty} />
      {!(zone.kind === 'loading' || zone.kind === 'error' || (empty && zone.kind === 'sample')) && children}
    </section>
  );
}

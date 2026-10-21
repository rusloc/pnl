// Filter rail (design brief §5.1): 64 px collapsed / 248 px expanded, Ink 900,
// brand mark, four filter groups, and a collapse/expand control at the bottom.
import { cn } from '@/lib/utils';

import type { PanelKey } from '../model/types';
import { RAIL_GROUPS, RAIL_WIDTH, railItemId } from './rail-groups';
import { RailToggleIcon } from './ui/icons';

interface FilterRailProps {
  wide: boolean;
  onToggleWide: () => void;
  openPanel: PanelKey | null;
  onTogglePanel: (key: PanelKey) => void;
  summaries: Record<PanelKey, string>;
}

export function FilterRail({ wide, onToggleWide, openPanel, onTogglePanel, summaries }: FilterRailProps) {
  return (
    <nav
      aria-label="Filters and tools"
      data-testid="filter-rail"
      className="ledger-rail box-border flex flex-none flex-col gap-[4px] overflow-hidden bg-ink-900 px-[10px] py-[12px] text-rail-text"
      style={{ width: wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed }}
    >
      <div className="mb-[12px] flex h-[44px] items-center gap-[10px] px-[4px]">
        <div
          aria-hidden="true"
          className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-[8px] bg-acc text-[16px] font-bold text-surface"
        >
          A
        </div>
        {wide && (
          <div className="flex min-w-0 flex-col leading-[1.2]">
            <span className="whitespace-nowrap text-[15px] font-semibold text-surface">ACME P&amp;L</span>
            <span className="whitespace-nowrap text-[12px] text-rail-muted">Management reporting</span>
          </div>
        )}
      </div>
      <div className="flex h-[24px] items-center px-[10px]">
        {wide ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Filters</span>
        ) : (
          <span aria-hidden="true" className="block h-px w-[24px] bg-rail-divider" />
        )}
      </div>

      {RAIL_GROUPS.map(({ key, label, Icon }) => {
        const open = openPanel === key;
        return (
          <button
            key={key}
            id={railItemId(key)}
            type="button"
            onClick={() => onTogglePanel(key)}
            aria-expanded={open}
            aria-label={`${label}: ${summaries[key]}`}
            className={cn(
              'box-border flex min-h-[48px] w-full cursor-pointer items-center gap-[12px] rounded-[8px] border-0 px-[10px] text-left font-[inherit]',
              open ? 'bg-ink-700 text-surface' : 'bg-transparent text-rail-text'
            )}
          >
            <Icon className="flex-none" />
            {wide && (
              <span className="flex min-w-0 flex-col leading-[1.25]">
                <span className="text-[14px] font-medium text-surface">{label}</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-rail-muted">
                  {summaries[key]}
                </span>
              </span>
            )}
          </button>
        );
      })}

      <div className="flex-auto" />

      <button
        type="button"
        onClick={onToggleWide}
        aria-expanded={wide}
        aria-label={wide ? 'Collapse filter panel' : 'Expand filter panel'}
        className="box-border flex min-h-[48px] w-full cursor-pointer items-center gap-[12px] rounded-[8px] border-0 bg-transparent px-[10px] text-left font-[inherit] text-rail-text"
      >
        <RailToggleIcon expanded={wide} className="flex-none" />
        {wide && <span className="text-[14px] font-medium text-surface">Collapse</span>}
      </button>
    </nav>
  );
}

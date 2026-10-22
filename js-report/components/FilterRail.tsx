import type { ComponentType } from 'react';
import { BarsIcon, CalendarIcon, FunnelIcon, RailToggleIcon, SlidersIcon } from './Icons';
import styles from './ledger.module.css';

// Filter rail (design guide §5.1): 64 px collapsed / 248 px expanded; four groups, one flyout at a time.

export type PanelKey = 'period' | 'versions' | 'slice' | 'display';

export const RAIL_WIDTH = { collapsed: 64, expanded: 248 } as const;
export const RAIL_GROUPS: readonly { key: PanelKey; label: string; Icon: ComponentType }[] = [
  { key: 'period', label: 'Period', Icon: CalendarIcon },
  { key: 'versions', label: 'Versions', Icon: BarsIcon },
  { key: 'slice', label: 'Slice', Icon: FunnelIcon },
  { key: 'display', label: 'Display', Icon: SlidersIcon },
];
export const railItemId = (key: PanelKey) => `rail-${key}`;

export function FilterRail({
  wide,
  onToggleWide,
  openPanel,
  onTogglePanel,
  summaries,
}: {
  wide: boolean;
  onToggleWide: () => void;
  openPanel: PanelKey | null;
  onTogglePanel: (key: PanelKey) => void;
  summaries: Record<PanelKey, string>;
}) {
  return (
    <nav
      aria-label="Filters"
      className={styles.rail}
      style={{ width: wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed }}
    >
      <div className={styles.brand}>
        <div aria-hidden="true" className={styles.brandMark}>
          A
        </div>
        {wide && (
          <div className={styles.brandText}>
            <span className={styles.brandName}>ACME P&amp;L</span>
            <span className={styles.railMuted}>Management reporting</span>
          </div>
        )}
      </div>
      <div className={styles.railSection}>
        {wide ? 'Filters' : <span aria-hidden="true" className={styles.railDivider} />}
      </div>
      {RAIL_GROUPS.map(({ key, label, Icon }) => (
        <button
          key={key}
          id={railItemId(key)}
          type="button"
          className={styles.railItem}
          aria-expanded={openPanel === key}
          aria-label={`${label}: ${summaries[key]}`}
          onClick={() => onTogglePanel(key)}
        >
          <Icon />
          {wide && (
            <span className={styles.railItemText}>
              <span className={styles.railItemLabel}>{label}</span>
              <span className={styles.railItemSummary}>{summaries[key]}</span>
            </span>
          )}
        </button>
      ))}
      <div className={styles.railSpacer} />
      <button
        type="button"
        className={styles.railItem}
        aria-label={wide ? 'Collapse filter rail' : 'Expand filter rail'}
        onClick={onToggleWide}
      >
        <RailToggleIcon expanded={wide} />
        {wide && <span className={styles.railItemLabel}>Collapse</span>}
      </button>
    </nav>
  );
}

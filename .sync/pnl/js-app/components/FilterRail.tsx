import type { ComponentType } from 'react';
import { BarsIcon, CalendarIcon, CaretIcon, FunnelIcon, RailToggleIcon, SlidersIcon } from './Icons';
import styles from './ledger.module.css';

// Filter rail (design guide §5.1; page top as Track B, docs/design/period-picker-v2.md Part 2): 64 px collapsed /
// 248 px expanded. The brand mark, tinted in the company colour, opens the company picker (L-01, F-01, ADR-0007);
// then the four filter groups. One pop-over at a time: a flyout, the company picker or the applied-filters pop-up.

export type PanelKey = 'period' | 'versions' | 'slice' | 'display';
export type Overlay = PanelKey | 'company' | 'filters';

export const RAIL_WIDTH = { collapsed: 64, expanded: 248 } as const;
export const RAIL_GROUPS: readonly { key: PanelKey; label: string; Icon: ComponentType }[] = [
  { key: 'period', label: 'Period', Icon: CalendarIcon },
  { key: 'versions', label: 'Versions', Icon: BarsIcon },
  { key: 'slice', label: 'Slice', Icon: FunnelIcon },
  { key: 'display', label: 'Display', Icon: SlidersIcon },
];
export const railItemId = (key: PanelKey) => `rail-${key}`;
export const BRAND_MARK_ID = 'rail-company';
export const isPanelKey = (key: Overlay): key is PanelKey => RAIL_GROUPS.some((g) => g.key === key);

export function FilterRail({
  wide,
  onToggleWide,
  openPanel,
  onTogglePanel,
  summaries,
}: {
  wide: boolean;
  onToggleWide: () => void;
  openPanel: Overlay | null;
  onTogglePanel: (key: Overlay) => void;
  summaries: Record<PanelKey, string>;
}) {
  return (
    <nav
      aria-label="Filters"
      className={styles.rail}
      style={{ width: wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed }}
    >
      <div className={styles.brand}>
        <button
          id={BRAND_MARK_ID}
          type="button"
          aria-label="Switch company"
          title="Switch company"
          aria-haspopup="dialog"
          aria-expanded={openPanel === 'company'}
          className={styles.brandMark}
          onClick={() => onTogglePanel('company')}
        >
          <span aria-hidden="true">A</span>
          <CaretIcon />
        </button>
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
          title={summaries[key]}
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

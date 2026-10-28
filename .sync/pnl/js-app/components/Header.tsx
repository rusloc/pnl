'use client';

import { useRef, useState, type ComponentType } from 'react';
import type { FilterRow } from '@/lib/engine/header';
import type { Notice } from '@/lib/engine/notices';
import type { Selection } from '@/lib/engine/types';
import type { HowToReadVM } from '@/lib/engine/view-types';
import { HowToReadButton } from './glass';
import { AnalysisIcon, CloseIcon, FunnelIcon, ProfitabilityIcon, TableIcon, TilesIcon } from './Icons';
import styles from './ledger.module.css';
import { useDismiss } from './use-dismiss';

// Page top, Track B is the reference (docs/design/period-picker-v2.md Part 2, pbi-report-layout.md page map).
// Title row: "Profit & loss" + the applied-filters button and pop-up (replaces the L-04 context line; the C-50 notices
// are its last rows), right-aligned status line (L-01, N-02). Tabs row: view tabs with the company-colour underline;
// Copy link (F-37) on the right. No notice strip, no context line, no company cards. Unbuilt tabs say why (LSN-002).

const NOT_BUILT = (step: number) => `Not built yet (ADR-0002 build step ${step})`;

const TABS: readonly { key: Selection['view']; label: string; Icon: ComponentType; step: number | null }[] = [
  { key: 'statement', label: 'P&L statement', Icon: TableIcon, step: null },
  { key: 'kpi', label: 'Vitals', Icon: TilesIcon, step: null }, // formerly Key figures (redesign v4); URL value stays kpi
  { key: 'analysis', label: 'Analysis', Icon: AnalysisIcon, step: null },
  { key: 'profitability', label: 'Profitability', Icon: ProfitabilityIcon, step: null },
];

export const FILTERS_BUTTON_ID = 'hdr-filters';
const FILTERS_POPUP_ID = 'applied-filters';

export function Header({
  sel,
  status,
  filters,
  notices,
  filtersOpen,
  onToggleFilters,
  onCloseFilters,
  shareUrl,
  onChange,
  pager,
  howToRead,
}: {
  sel: Selection;
  status: string;
  filters: readonly FilterRow[];
  notices: readonly Notice[];
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  shareUrl: string;
  onChange: (patch: Partial<Selection>) => void;
  /** Analysis / Profitability sub-pages (‹ › and "n / 2", ADR-0004 in-view pager). */
  pager: { page: 1 | 2; onPage: (page: 1 | 2) => void } | null;
  howToRead: HowToReadVM | null; // one per view (ADR-0012)
}) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyLink = () =>
    navigator.clipboard.writeText(shareUrl).then(
      () => setCopy('copied'),
      () => setCopy('failed'),
    );

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <div className={styles.titleLine}>
          <h1 className={styles.title}>Profit &amp; loss</h1>
          <button
            id={FILTERS_BUTTON_ID}
            type="button"
            aria-label={
              notices.length > 0
                ? `Applied filters (${notices.length} ${notices.length === 1 ? 'notice' : 'notices'})`
                : 'Applied filters'
            }
            title="Applied filters"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            aria-controls={filtersOpen ? FILTERS_POPUP_ID : undefined}
            className={styles.filtersButton}
            onClick={onToggleFilters}
          >
            <FunnelIcon />
            {notices.length > 0 && (
              // C-50: the notices live in the pop-up; the count keeps them visible on the closed button (Track A)
              <span aria-hidden="true" className={styles.noticeCount}>
                {notices.length}
              </span>
            )}
          </button>
          {filtersOpen && <AppliedFilters filters={filters} notices={notices} onClose={onCloseFilters} />}
        </div>
        <p className={styles.status}>{status}</p>
      </div>

      <div className={styles.headerBottom}>
        <div role="tablist" aria-label="View" className={styles.tabs}>
          {TABS.map(({ key, label, Icon, step }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sel.view === key}
              aria-controls={`view-${key}`}
              tabIndex={sel.view === key ? 0 : -1}
              disabled={step !== null}
              title={step === null ? undefined : NOT_BUILT(step)}
              className={styles.tab}
              onClick={() => onChange({ view: key })}
            >
              <Icon />
              {label}
            </button>
          ))}
          {pager ? (
            <div className={styles.pager} role="group" aria-label="Sub-page">
              <button
                type="button"
                aria-label="Previous page"
                disabled={pager.page === 1}
                onClick={() => pager.onPage(1)}
              >
                ‹
              </button>
              <span aria-live="polite">{pager.page} / 2</span>
              <button type="button" aria-label="Next page" disabled={pager.page === 2} onClick={() => pager.onPage(2)}>
                ›
              </button>
            </div>
          ) : null}
        </div>
        <div className={styles.toolbar} style={{ position: 'relative' }}>
          {howToRead ? (
            <HowToReadButton
              title={howToRead.title}
              lines={howToRead.lines}
              className={`${styles.linkButton} ${styles.howTo}`}
              popupStyle={{ top: 44, right: 0, width: 520 }}
            />
          ) : null}
          {/* F-37: the link reopens the same selection */}
          <button type="button" className={styles.linkButton} onClick={copyLink} aria-live="polite">
            {copy === 'copied' ? 'Link copied' : 'Copy link'}
          </button>
          {copy === 'failed' && (
            // Clipboard can be blocked inside a host iframe: offer the link to copy by hand
            <input
              readOnly
              aria-label="Link to this view"
              className={styles.linkButton}
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Every filter and its value (Track B rows), then one labelled row per C-50 notice that applies (L-05, parity rule 9:
 * Cut-off, Forecast, Prior year, History, Allocation, Eliminations); no notice row when none applies.
 */
export function AppliedFilters({
  filters,
  notices,
  onClose,
}: {
  filters: readonly FilterRow[];
  notices: readonly Notice[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDismiss({ panelRef, focusRef: closeRef, triggerId: FILTERS_BUTTON_ID, onClose, outside: true });

  return (
    <div
      ref={panelRef}
      id={FILTERS_POPUP_ID}
      role="dialog"
      aria-labelledby="applied-filters-title"
      className={styles.filtersPopup}
    >
      <div className={styles.flyoutHead}>
        <div id="applied-filters-title" className={styles.flyoutTitle}>
          Applied filters
        </div>
        <button ref={closeRef} type="button" aria-label="Close" className={styles.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <dl className={styles.filterRows}>
        {filters.map((f) => (
          <div key={f.label} className={styles.filterRow}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
        {notices.map((n) => (
          <div key={n.code} className={`${styles.filterRow} ${styles.noticeRow}`}>
            <dt>{n.label}</dt>
            <dd>{n.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

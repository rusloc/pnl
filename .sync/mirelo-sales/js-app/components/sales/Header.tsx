import { useRef } from 'react';
import type { Comparator, MarketSel, SalesSelection, ViewId } from '@/lib/sales/types';
import type { HeaderVM } from '@/lib/sales/view-model';
import { Calendar } from './Calendar';
import { CopyLink, Radios, Tabs } from './controls';
import { GlassPopup, usePopup } from './glass';
import { HowToReadButton } from './popup';
import styles from './sales.module.css';

// Header (layout-spec §0.1): identical in every view. Since 2026-11-01 (owner) the Market / Period / Month /
// Comparator controls are gone from the bar: one Filters button opens a glass pop-up with Period (the calendar:
// month, quarter, year or custom range), Comparison and Region, then Reset, a rule and the "Showing …" sentence; the
// applied filters read as one line beside the button. Choices apply at once (no Done button). The pop-up has a fixed
// size: every calendar mode keeps the same rows (Calendar.tsx), so a mode switch never reshapes it.

const CMPS: readonly { value: Comparator; label: string }[] = [
  { value: 'BUD', label: 'Budget' },
  { value: 'PY', label: 'Prior year' },
];
const MARKETS: readonly { value: MarketSel; label: string }[] = [
  { value: 'ALL', label: 'All markets' },
  { value: 'PL', label: 'PL' },
  { value: 'RO', label: 'RO' },
  { value: 'PT', label: 'PT' },
];
const TABS: readonly { value: ViewId; label: string; width: number }[] = [
  { value: 'overview', label: 'Overview', width: 104 },
  { value: 'loans', label: 'Loans issued', width: 128 },
  { value: 'clients', label: 'Clients', width: 88 },
  { value: 'portfolio', label: 'Portfolio quality', width: 156 },
  { value: 'revenue', label: 'Revenue & targets', width: 164 },
];

function FunnelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Filters({
  vm,
  sel,
  defaults,
  onChange,
}: {
  vm: HeaderVM;
  sel: SalesSelection;
  defaults: SalesSelection;
  onChange: (patch: Partial<SalesSelection>) => void;
}) {
  const { open, close, toggle } = usePopup('filters');
  const opener = useRef<HTMLButtonElement>(null);
  const changed =
    sel.from !== defaults.from ||
    sel.anchor !== defaults.anchor ||
    sel.cmp !== defaults.cmp ||
    sel.market !== defaults.market;
  return (
    <div className={`${styles.abs} ${styles.filters}`}>
      <span className={styles.filterLine} title={vm.periodLine}>
        {vm.filterLine}
      </span>
      <button
        ref={opener}
        type="button"
        className={styles.filterBtn}
        aria-expanded={open}
        aria-label={`Filters: ${vm.filterLine}`}
        onClick={toggle}
      >
        <FunnelIcon />
        Filters
      </button>
      {open ? (
        <GlassPopup
          title="Filters"
          opener={opener}
          style={{ right: 0, top: 36, width: 420, height: 514, maxHeight: 514 }}
          onClose={close}
        >
          <div className={styles.fGroup}>
            <span id="mf-period" className={styles.fLabel}>
              Period
            </span>
            <Calendar from={sel.from} anchor={sel.anchor} first={vm.first} last={vm.last} onChange={onChange} />
          </div>
          <div className={styles.fGroup}>
            <span id="mf-cmp" className={styles.fLabel}>
              Comparison
            </span>
            <Radios labelledBy="mf-cmp" options={CMPS} value={sel.cmp} onChange={(cmp) => onChange({ cmp })} />
          </div>
          <div className={styles.fGroup}>
            <span id="mf-region" className={styles.fLabel}>
              Region
            </span>
            <Radios
              labelledBy="mf-region"
              options={MARKETS}
              value={sel.market}
              onChange={(market) => onChange({ market })}
            />
          </div>
          <div className={styles.fFoot}>
            <button
              type="button"
              disabled={!changed}
              onClick={() =>
                onChange({
                  from: defaults.from,
                  anchor: defaults.anchor,
                  cmp: defaults.cmp,
                  market: defaults.market,
                })
              }
            >
              Reset
            </button>
          </div>
          <hr className={styles.fRule} />
          <p className={styles.fNote}>{vm.periodLine}</p>
        </GlassPopup>
      ) : null}
    </div>
  );
}

export function Header({
  vm,
  sel,
  defaults,
  panelId,
  onChange,
}: {
  vm: HeaderVM;
  sel: SalesSelection;
  defaults: SalesSelection;
  panelId: string;
  onChange: (patch: Partial<SalesSelection>) => void;
}) {
  return (
    <header>
      <svg className={styles.wedge} viewBox="0 0 1440 64" aria-hidden="true">
        <polygon points="760,0 1440,0 1440,64" fill="#FFD54A" />
      </svg>
      <div className={`${styles.abs} ${styles.brand}`} aria-hidden="true">
        M
      </div>
      <h1 className={`${styles.abs} ${styles.title}`}>{vm.title}</h1>
      <Filters vm={vm} sel={sel} defaults={defaults} onChange={onChange} />
      <Tabs tabs={TABS} value={sel.view} onChange={(view) => onChange({ view, drill: null })} panelId={panelId} />
      <div className={`${styles.abs} ${styles.tabright}`}>
        <HowToReadButton vm={vm.howToRead} />
        <CopyLink />
      </div>
      <div className={`${styles.abs} ${styles.tabrule}`} />
    </header>
  );
}

import type { Comparator, MarketSel, SalesSelection, TimeView, ViewId } from '@/lib/sales/types';
import type { HeaderVM } from '@/lib/sales/view-model';
import { monthIndex, monthKey } from '@/lib/sales/windows';
import { CopyLink, Segmented, Tabs } from './controls';
import { HowToReadButton } from './popup';
import styles from './sales.module.css';

// Header (layout-spec §0.1): identical in every view. Widths and x positions are the spec's px.

const MARKETS: readonly { value: MarketSel; label: string; width: number }[] = [
  { value: 'ALL', label: 'All markets', width: 88 },
  { value: 'PL', label: 'PL', width: 48 },
  { value: 'RO', label: 'RO', width: 48 },
  { value: 'PT', label: 'PT', width: 48 },
];
const PERIODS: readonly { value: TimeView; label: string; width: number }[] = [
  { value: 'M', label: 'Month', width: 49 },
  { value: 'Q', label: 'QTD', width: 49 },
  { value: 'Y', label: 'YTD', width: 49 },
  { value: 'R', label: 'R12M', width: 49 },
];
const CMPS: readonly { value: Comparator; label: string; width: number }[] = [
  { value: 'BUD', label: 'Budget', width: 56 },
  { value: 'PY', label: 'PY', width: 46 },
];
const TABS: readonly { value: ViewId; label: string; width: number }[] = [
  { value: 'overview', label: 'Overview', width: 104 },
  { value: 'loans', label: 'Loans issued', width: 128 },
  { value: 'clients', label: 'Clients', width: 88 },
  { value: 'portfolio', label: 'Portfolio quality', width: 156 },
  { value: 'revenue', label: 'Revenue & targets', width: 164 },
];

export function Header({
  vm,
  sel,
  panelId,
  onChange,
}: {
  vm: HeaderVM;
  sel: SalesSelection;
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
      <Segmented
        label="Market"
        options={MARKETS}
        value={sel.market}
        onChange={(market) => onChange({ market })}
        x={744}
      />
      <Segmented
        label="Period"
        title={vm.periodLine}
        options={PERIODS}
        value={sel.tv}
        onChange={(tv) => onChange({ tv })}
        x={988}
      />
      <label className={styles.srOnly} htmlFor="sales-month">
        Month
      </label>
      <select
        id="sales-month"
        className={`${styles.abs} ${styles.select}`}
        style={{ left: 1192, top: 20, width: 104 }}
        value={monthKey(sel.anchor)}
        onChange={(e) => onChange({ anchor: monthIndex(e.target.value) })}
      >
        {vm.months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <Segmented label="Comparator" options={CMPS} value={sel.cmp} onChange={(cmp) => onChange({ cmp })} x={1304} />
      <Tabs tabs={TABS} value={sel.view} onChange={(view) => onChange({ view, drill: null })} panelId={panelId} />
      <div className={`${styles.abs} ${styles.tabright}`}>
        <HowToReadButton vm={vm.howToRead} />
        <CopyLink />
      </div>
      <div className={`${styles.abs} ${styles.tabrule}`} />
    </header>
  );
}

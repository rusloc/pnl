'use client';

import { useRef, type ReactNode } from 'react';
import type { Manifest } from '@/lib/data/manifest';
import type { PeriodView } from '@/lib/engine/period';
import type { BaseChoice, CompareChoice, Selection } from '@/lib/engine/types';
import { RAIL_GROUPS, RAIL_WIDTH, railItemId, type PanelKey } from './FilterRail';
import { CloseIcon, InfoIcon } from './Icons';
import styles from './ledger.module.css';
import { ChoiceGroup, Segmented, SwitchRow, type Option } from './primitives';
import { useDismiss } from './use-dismiss';

// Filter flyout (design guide §5.2): one open at a time, pointer at its rail item; Escape, ✕ and Done close it;
// focus moves to ✕ on open and back to the rail item on close (N-08). "Reset this group" restores the group's
// defaults (F-35); in Period it reads "Back to default" (period picker v2).

export type Patch = Partial<Selection>;

const GROUP_FIELDS: Record<PanelKey, readonly (keyof Selection)[]> = {
  period: ['fy', 'month', 'timeView'],
  versions: ['base', 'compareA', 'compareB'],
  slice: ['region', 'channel', 'line', 'segment'],
  display: [
    'currency',
    'fxBasis',
    'units',
    'costSign',
    'varianceFormat',
    'showPctNr',
    'showFyOutlook',
    'showTags',
    'hideEmpty',
  ],
};

// Rail geometry (§5.1): first item centre at 124 px (padding 12 + brand 44 + 12 + gap 4 + section 24 + gap 4 + 24),
// item pitch 48 + gap 4; the flyout sits at top 92 and the 12 px pointer is centred on the item.
const POINTER_TOP = 124 - 92 - 6;
const RAIL_ITEM_PITCH = 52;

const TITLES: Record<PanelKey, [string, string | null]> = {
  period: ['Period', null], // period picker v2: the live summary sentence replaces the subtitle
  versions: ['Versions', 'Base and two comparisons'],
  slice: ['Slice', 'Region, channel, category and tier'],
  display: ['Display', 'Currency, units and table options'],
};

interface PanelProps {
  sel: Selection;
  manifest: Manifest;
  onChange: (patch: Patch) => void;
}

export function Flyout({
  panel,
  wide,
  sel,
  defaults,
  manifest,
  period,
  onChange,
  onClose,
}: PanelProps & { panel: PanelKey; wide: boolean; defaults: Selection; period: PeriodView; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDismiss({ panelRef, focusRef: closeRef, triggerId: railItemId(panel), onClose });

  const [title, subtitle] = TITLES[panel];
  const index = RAIL_GROUPS.findIndex((g) => g.key === panel);
  const props = { sel, manifest, onChange };
  const reset = () => onChange(Object.fromEntries(GROUP_FIELDS[panel].map((f) => [f, defaults[f]])));

  return (
    <div
      ref={panelRef}
      className={styles.flyout}
      style={{ left: (wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed) + 10 }}
    >
      <div aria-hidden="true" className={styles.flyoutPointer} style={{ top: POINTER_TOP + index * RAIL_ITEM_PITCH }} />
      <div role="dialog" aria-label={`${title} filters`} className={styles.flyoutCard}>
        <div className={styles.flyoutHead}>
          <div>
            <div className={styles.flyoutTitle}>{title}</div>
            {subtitle && <div className={styles.caption}>{subtitle}</div>}
          </div>
          <button ref={closeRef} type="button" aria-label="Close" className={styles.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {panel === 'period' && (
          // Live summary (period picker v2): updates on every click, announced politely
          <p aria-live="polite" className={styles.periodSummary}>
            {period.summary}
          </p>
        )}
        <div className={styles.flyoutBody}>
          {panel === 'period' && <PeriodPanel {...props} period={period} />}
          {panel === 'versions' && <VersionsPanel {...props} />}
          {panel === 'slice' && <SlicePanel {...props} />}
          {panel === 'display' && <DisplayPanel {...props} />}
        </div>
        <div className={styles.flyoutFoot}>
          <button type="button" className={styles.resetLink} onClick={reset}>
            {panel === 'period' ? 'Back to default' : 'Reset this group'}
          </button>
          <button type="button" className={styles.primaryButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      {children}
    </div>
  );
}

// F-02 … F-04, period picker v2 (docs/design/period-picker-v2.md Part 1): Show (time view) first, then Year, then the
// month grid labelled by what the month means; Full year replaces the grid with one line. Covered months are shaded,
// the anchor is solid; open months follow the base version (C-01, C-02). Selection applies at once; Done only closes.
function PeriodPanel({ sel, onChange, period }: PanelProps & { period: PeriodView }) {
  return (
    <>
      <div className={styles.group}>
        <span id="period-show" className={styles.groupLabel}>
          Show
        </span>
        <ChoiceGroup
          labelledBy="period-show"
          value={sel.timeView}
          className={styles.choiceGrid2}
          options={period.timeViews.map((t) => ({ value: t.value, content: t.label, className: styles.choice }))}
          onChange={(timeView) => onChange({ timeView })}
        />
      </div>
      <div className={styles.group}>
        <span id="period-year" className={styles.groupLabel}>
          Year
        </span>
        <ChoiceGroup
          labelledBy="period-year"
          value={String(sel.fy)}
          className={styles.choiceGrid3}
          options={period.years.map((y) => ({ value: String(y), content: String(y), className: styles.choice }))}
          onChange={(v) => onChange({ fy: Number(v) })}
        />
      </div>
      {period.gridLabel === null ? (
        <p className={styles.periodNote}>{period.fullYearNote}</p>
      ) : (
        <div className={styles.group}>
          <span id="period-month" className={styles.groupLabel}>
            {period.gridLabel}
          </span>
          <ChoiceGroup
            labelledBy="period-month"
            value={String(sel.month)}
            className={styles.monthGrid}
            options={period.months.map((c) => ({
              value: String(c.month),
              className: `${styles.month} ${c.covered && !c.anchor ? styles.monthCovered : ''}`,
              disabledReason: c.selectable ? undefined : period.openMonthHint,
              content: (
                <>
                  <span>{c.name}</span>
                  {c.note && <span className={styles.monthNote}>{c.note}</span>}
                </>
              ),
            }))}
            onChange={(v) => {
              const month = period.months.find((c) => String(c.month) === v)?.month;
              if (month) onChange({ month });
            }}
          />
        </div>
      )}
    </>
  );
}

const COMPARES: readonly Option<CompareChoice>[] = [
  { value: 'B', label: 'Budget' },
  { value: 'LE', label: 'Latest est.' },
  { value: 'PY', label: 'Prior year' },
  { value: 'NONE', label: 'None' },
];

// F-05 … F-07
function VersionsPanel({ sel, manifest, onChange }: PanelProps) {
  const closed = manifest.tables.dim_month.filter((d) => d.is_closed);
  const last = closed[closed.length - 1];
  const latest = manifest.tables.dim_version.find((v) => v.is_latest_forecast);
  const bases: readonly { value: BaseChoice; label: string; description: string }[] = [
    {
      value: 'A',
      label: 'Actual',
      description: `Closed months only, through ${last ? `${last.month_name} ${last.fiscal_year}` : 'the last close'}`,
    },
    {
      value: 'LE',
      label: 'Latest estimate',
      description: `Actual for closed months plus ${latest?.version_name ?? 'the latest forecast'}`,
    },
    { value: 'B', label: 'Budget', description: `Approved FY${sel.fy} budget, phased by month` },
  ];
  return (
    <>
      <Group label="Base version">
        <div role="radiogroup" aria-label="Base version" className={styles.group}>
          {bases.map((b) => (
            <label key={b.value} className={`${styles.radioCard} ${sel.base === b.value ? styles.radioCardOn : ''}`}>
              <input
                type="radio"
                name="base-version"
                checked={sel.base === b.value}
                onChange={() => onChange({ base: b.value })}
              />
              <span className={styles.radioText}>
                <span className={styles.radioTitle}>{b.label}</span>
                <span className={styles.caption}>{b.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Group>
      <Group label="Compare A">
        <Segmented
          label="Compare A"
          value={sel.compareA}
          options={COMPARES}
          onChange={(compareA) => onChange({ compareA })}
        />
      </Group>
      <Group label="Compare B">
        <Segmented
          label="Compare B"
          value={sel.compareB}
          options={COMPARES}
          onChange={(compareB) => onChange({ compareB })}
        />
        <span className={styles.caption}>Comparisons always cover the same months as the base.</span>
      </Group>
    </>
  );
}

// F-08 … F-11: honestly off until build step 5 (slice filters and the C-31 allocation)
function SlicePanel({ sel, manifest }: PanelProps) {
  const slot = (rows: readonly { entity_code: string; slot_label: string }[]) =>
    rows.find((r) => r.entity_code === sel.entity)?.slot_label ?? '';
  const rows = [
    'Region',
    slot(manifest.tables.dim_channel),
    slot(manifest.tables.dim_line),
    slot(manifest.tables.dim_segment),
  ];
  return (
    <>
      <div className={styles.noticeBox}>
        <InfoIcon />
        <span>
          Slice filters are not built yet. They arrive with the allocation of lines below contribution margin (C-31);
          the figures show every slice.
        </span>
      </div>
      {rows.map((label) => (
        <Group key={label} label={label}>
          <div className={styles.disabledRow} aria-disabled="true">
            All
          </div>
        </Group>
      ))}
    </>
  );
}

// F-12 … F-17
function DisplayPanel({ sel, manifest, onChange }: PanelProps) {
  const p = manifest.tables;
  // Parity rule 14: the units buttons carry the selected currency's symbol ($m / $k, €m / €k, £m / £k)
  const symbol = p.param_reporting_currency.find((c) => c.currency_code === sel.currency)?.symbol ?? sel.currency;
  return (
    <>
      <Group label="Currency">
        <Segmented
          label="Currency"
          value={sel.currency}
          options={p.param_reporting_currency.map((c) => ({ value: c.currency_code, label: c.currency_code }))}
          onChange={(currency) => onChange({ currency })}
        />
      </Group>
      <Group label="FX basis">
        <Segmented
          label="FX basis"
          value={sel.fxBasis}
          options={[
            { value: 'ACT', label: 'Actual rates' },
            { value: 'CC', label: 'Constant currency' },
          ]}
          onChange={(fxBasis) => onChange({ fxBasis })}
        />
      </Group>
      <div className={styles.split}>
        <Group label="Units">
          <Segmented
            label="Units"
            value={sel.units}
            options={[
              { value: 'M', label: `${symbol}m` },
              { value: 'K', label: `${symbol}k` },
            ]}
            onChange={(units) => onChange({ units })}
          />
        </Group>
        <Group label="Costs shown">
          <Segmented
            label="Costs shown"
            value={sel.costSign}
            options={[
              { value: 'NEG', label: '−' },
              { value: 'POS', label: '+' },
            ]}
            onChange={(costSign) => onChange({ costSign })}
          />
        </Group>
      </div>
      <Group label="Variance">
        <Segmented
          label="Variance format"
          value={sel.varianceFormat}
          options={[
            { value: 'BOTH', label: 'Amount and %' },
            { value: 'ABS', label: 'Amount' },
            { value: 'PCT', label: '%' },
          ]}
          onChange={(varianceFormat) => onChange({ varianceFormat })}
        />
      </Group>
      <Group label="Statement shows">
        <div>
          <SwitchRow
            label="% of net revenue column"
            checked={sel.showPctNr}
            onChange={(showPctNr) => onChange({ showPctNr })}
          />
          <SwitchRow
            label="Full-year outlook columns"
            checked={sel.showFyOutlook}
            onChange={(showFyOutlook) => onChange({ showFyOutlook })}
          />
          <SwitchRow
            label="Classification tags"
            checked={sel.showTags}
            onChange={(showTags) => onChange({ showTags })}
          />
          <SwitchRow
            label="Hide empty lines"
            checked={sel.hideEmpty}
            onChange={(hideEmpty) => onChange({ hideEmpty })}
          />
        </div>
      </Group>
    </>
  );
}

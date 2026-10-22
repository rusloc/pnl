'use client';

import { useState, type ComponentType } from 'react';
import type { EntityView, Selection } from '@/lib/engine/types';
import { AnalysisIcon, ProfitabilityIcon, TableIcon, TilesIcon } from './Icons';
import styles from './ledger.module.css';
import { Segmented } from './primitives';
import { COMPANY_THEME } from './theme';

// Header (design guide §5.3): eyebrow with data status (N-02), title + context line (L-04), company cards (F-01),
// view tabs and the per-view toolbar. Unbuilt choices are disabled and say why (LSN-002).

const NOT_BUILT = (step: number) => `Not built yet (ADR-0002 build step ${step})`;

const TABS: readonly { key: Selection['view']; label: string; Icon: ComponentType; step: number | null }[] = [
  { key: 'statement', label: 'P&L statement', Icon: TableIcon, step: null },
  { key: 'kpi', label: 'Key figures', Icon: TilesIcon, step: 6 },
  { key: 'analysis', label: 'Analysis', Icon: AnalysisIcon, step: 7 },
  { key: 'profitability', label: 'Profitability', Icon: ProfitabilityIcon, step: 8 },
];

export function Header({
  sel,
  companies,
  dataStatus,
  context,
  shareUrl,
  onChange,
}: {
  sel: Selection;
  companies: readonly { code: EntityView; name: string }[];
  dataStatus: string;
  context: string;
  shareUrl: string;
  onChange: (patch: Partial<Selection>) => void;
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
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>ACME Group · Management reporting · {dataStatus}</span>
          <div className={styles.titleLine}>
            <h1 className={styles.title}>Profit &amp; loss</h1>
            <span className={styles.context}>{context}</span>
          </div>
        </div>
        <div role="group" aria-label="Company" className={styles.companies}>
          {companies.map((c) => {
            const theme = COMPANY_THEME[c.code];
            const selected = c.code === sel.entity;
            const off = c.code === 'GROUP'; // step 4: Group view with eliminations and entity columns
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={selected}
                disabled={off}
                title={off ? `${NOT_BUILT(4)}: Group view with intercompany eliminations` : undefined}
                className={styles.company}
                style={
                  selected
                    ? { borderColor: theme.acc, boxShadow: `0 0 0 1px ${theme.acc}`, background: theme.accT }
                    : undefined
                }
                onClick={() => onChange({ entity: c.code })}
              >
                <span aria-hidden="true" className={styles.companyDot} style={{ background: theme.acc }} />
                <span className={styles.companyText}>
                  <span className={styles.companyName}>{c.name}</span>
                  <span className={styles.caption}>{off ? 'Coming in build step 4' : theme.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
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
        </div>
        <div className={styles.toolbar}>
          <Segmented
            compact
            label="Layout"
            value={sel.layout}
            options={[
              { value: 'VAR', label: 'Variance' },
              { value: 'TREND_M', label: 'Trend', disabledReason: NOT_BUILT(4) },
              { value: 'ENTITY', label: 'Entity columns', disabledReason: 'Available in the ACME Group view' },
            ]}
            onChange={(layout) => onChange({ layout })}
          />
          <Segmented
            compact
            label="Cost lens"
            value={sel.costLens}
            options={[
              { value: 'FN', label: 'By function' },
              { value: 'NAT', label: 'By nature', disabledReason: NOT_BUILT(8) },
            ]}
            onChange={(costLens) => onChange({ costLens })}
          />
          <Segmented
            compact
            label="Detail"
            value={sel.detail}
            options={[
              { value: 'SUM', label: 'Summary', disabledReason: NOT_BUILT(4) },
              { value: 'STD', label: 'Standard' },
              { value: 'FULL', label: 'Full', disabledReason: NOT_BUILT(4) },
            ]}
            onChange={(detail) => onChange({ detail })}
          />
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

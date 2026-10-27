'use client';

import { useRef } from 'react';
import type { EntityView } from '@/lib/engine/types';
import { BRAND_MARK_ID, RAIL_WIDTH } from './FilterRail';
import { CloseIcon } from './Icons';
import styles from './ledger.module.css';
import { ChoiceGroup } from './primitives';
import { COMPANY_THEME } from './theme';
import { useDismiss } from './use-dismiss';

// Company picker (L-01, F-01; ADR-0007 §2.4): opened from the rail brand mark, single select. A choice applies and
// closes; Escape, ✕ and a click outside close; focus returns to the mark. Group stays off until build step 4.

const GROUP_OFF = 'Not built yet (ADR-0002 build step 4): Group view with intercompany eliminations';

export function CompanyPicker({
  entity,
  companies,
  wide,
  onSelect,
  onClose,
}: {
  entity: EntityView;
  companies: readonly { code: EntityView; name: string }[];
  wide: boolean;
  onSelect: (entity: EntityView) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDismiss({ panelRef, focusRef: closeRef, triggerId: BRAND_MARK_ID, onClose, outside: true });

  return (
    <div
      ref={panelRef}
      className={styles.picker}
      style={{ left: (wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed) + 10 }}
    >
      <div aria-hidden="true" className={styles.flyoutPointer} style={{ top: 16 }} />
      <div role="dialog" aria-labelledby="company-picker-title" className={styles.flyoutCard}>
        <div className={styles.flyoutHead}>
          <div>
            <div id="company-picker-title" className={styles.flyoutTitle}>
              Company
            </div>
            <div className={styles.caption}>Period, versions, currency and region carry across</div>
          </div>
          <button ref={closeRef} type="button" aria-label="Close" className={styles.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <ChoiceGroup
          labelledBy="company-picker-title"
          value={entity}
          className={styles.pickerBody}
          onChange={(code) => {
            onSelect(code);
            onClose();
          }}
          options={companies.map((c) => {
            const theme = COMPANY_THEME[c.code];
            const selected = c.code === entity;
            return {
              value: c.code,
              className: styles.company,
              disabledReason: c.code === 'GROUP' ? GROUP_OFF : undefined,
              style: selected
                ? { borderColor: theme.acc, boxShadow: `0 0 0 1px ${theme.acc}`, background: theme.accT }
                : undefined,
              content: (
                <>
                  <span aria-hidden="true" className={styles.companyDot} style={{ background: theme.acc }} />
                  <span className={styles.companyText}>
                    <span className={styles.companyName}>{c.name}</span>
                    <span className={styles.caption}>{c.code === 'GROUP' ? 'Coming in build step 4' : theme.sub}</span>
                  </span>
                </>
              ),
            };
          })}
        />
      </div>
    </div>
  );
}

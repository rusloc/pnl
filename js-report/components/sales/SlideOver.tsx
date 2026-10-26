import { useEffect, useRef } from 'react';
import type { SlideOverVM } from '@/lib/sales/view-model';
import styles from './sales.module.css';

// 720 px slide-over (layout-spec §6 Row click): modal dialog over the right half, scrim over the left. Focus moves to
// the close button on open, Tab stays inside, Escape or the scrim closes, and focus returns to the opener.

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

export function SlideOver({
  vm,
  onClose,
  onBack,
  onClient,
}: {
  vm: SlideOverVM;
  onClose: () => void;
  onBack: (() => void) | null;
  onClient: (client: number) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus();
    return () => opener?.focus();
  }, []);

  // A drill inside the panel (loan → client) replaces the focused row; keep focus inside the dialog.
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) closeBtn.current?.focus();
  }, [vm.title]);

  useEffect(() => {
    const ctrl = new AbortController();
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key !== 'Tab' || !panel.current) return;
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (!panel.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      },
      { signal: ctrl.signal },
    );
    return () => ctrl.abort();
  }, [onClose]);

  function exportCsv() {
    if (vm.kind === 'missing') return;
    const url = URL.createObjectURL(new Blob([vm.csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = vm.csvName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Close the detail" tabIndex={-1} onClick={onClose} />
      <aside ref={panel} className={styles.so} role="dialog" aria-modal="true" aria-labelledby="so-title">
        <div className={styles.soHd}>
          <h2 id="so-title">{vm.title}</h2>
          <p>{vm.sub}</p>
          <button ref={closeBtn} type="button" className={styles.soX} aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {vm.kind === 'missing' ? null : (
          <>
            <div className={styles.soChips}>
              {vm.chips.map((c) => (
                <span key={c} className={styles.chip}>
                  {c}
                </span>
              ))}
            </div>
            {vm.kind === 'client' ? (
              <dl className={styles.facts}>
                {vm.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className={`${styles.soTable} ${vm.kind === 'client' ? styles.soTableLow : ''}`}>
              <table className={styles.table} aria-label={vm.kind === 'client' ? 'Loans of the client' : 'Loans'}>
                <thead>
                  <tr>
                    {vm.columns.map((c) => (
                      <th key={c.label} scope="col" className={c.align === 'right' ? styles.r : undefined}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.rows.map((r) => (
                    <tr
                      key={r.key}
                      className={vm.kind === 'loans' ? styles.row : undefined}
                      tabIndex={vm.kind === 'loans' ? 0 : undefined}
                      onClick={vm.kind === 'loans' ? () => onClient(r.client) : undefined}
                      onKeyDown={
                        vm.kind === 'loans'
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onClient(r.client);
                              }
                            }
                          : undefined
                      }
                    >
                      {r.cells.map((c, k) => (
                        <td key={k} className={vm.columns[k]?.align === 'right' ? styles.r : undefined}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.soFoot}>
              {onBack ? (
                <button type="button" onClick={onBack}>
                  ← Back
                </button>
              ) : null}
              <button type="button" onClick={exportCsv}>
                Export CSV
              </button>
              <span>{vm.footer}</span>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

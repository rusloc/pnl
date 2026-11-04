import { useEffect, useRef, useState } from "react";
import { fmtInt } from "@/lib/mirelo/format";
import type { SlideOverVM } from "@/lib/mirelo/view-model";
import glass from "./glass.module.css";
import styles from "./sales.module.css";

// Detail window (layout-spec §6 Row click; "Show loans"): a modal dialog centred on the board in the pop-up glass, over
// a 20 % dark-grey mask that blurs the whole report (2026-11-01, owner; it was a 720 px slide-over on the right half),
// in the same glass as every other pop-up. Focus
// moves to the close button on open, Tab stays inside, Escape or the mask closes, and focus returns to the opener.

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';
const PAGE = 50; // rows per page; every row of the list is reachable and in the CSV (2026-11-01)

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
  const [page, setPage] = useState(0);
  const [listOf, setListOf] = useState(vm.title);
  if (listOf !== vm.title) {
    setListOf(vm.title); // another list (a drill, Back): start at its first page
    setPage(0);
  }
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeBtn.current?.focus();
    return () => opener?.focus();
  }, []);

  // A drill inside the panel (loan → client) replaces the focused row; keep focus inside the dialog.
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement))
      closeBtn.current?.focus();
  }, [vm.title]);

  useEffect(() => {
    const ctrl = new AbortController();
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key !== "Tab" || !panel.current) return;
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ];
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

  const list = vm.kind === "loans" || vm.kind === "clients"; // rows open the client card

  const pages = vm.kind === "missing" ? 0 : Math.ceil(vm.total / PAGE);
  const current = Math.min(page, Math.max(pages - 1, 0));
  const first = current * PAGE;
  const rows =
    vm.kind === "missing"
      ? []
      : Array.from({ length: Math.min(PAGE, vm.total - first) }, (_, i) =>
          vm.rowAt(first + i),
        );

  function exportCsv() {
    if (vm.kind === "missing") return;
    const url = URL.createObjectURL(
      new Blob([vm.csv()], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = vm.csvName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        className={styles.scrim}
        aria-label="Close the detail"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside
        ref={panel}
        className={`${styles.so} ${glass.surface}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="so-title"
      >
        <div className={styles.soHd}>
          <h2 id="so-title">{vm.title}</h2>
          <p>{vm.sub}</p>
          <button
            ref={closeBtn}
            type="button"
            className={styles.soX}
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {vm.kind === "missing" ? null : (
          <>
            <div className={styles.soChips}>
              {vm.chips.map((c) => (
                <span key={c} className={styles.chip}>
                  {c}
                </span>
              ))}
            </div>
            {vm.kind === "client" ? (
              <dl className={styles.facts}>
                {vm.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div
              className={`${styles.soTable} ${vm.kind === "client" ? styles.soTableLow : ""}`}
            >
              <table
                className={styles.table}
                aria-label={
                  vm.kind === "client"
                    ? "Loans of the client"
                    : vm.kind === "clients"
                      ? "Clients"
                      : "Loans"
                }
              >
                <thead>
                  <tr>
                    {vm.columns.map((c) => (
                      <th
                        key={c.label}
                        scope="col"
                        className={c.align === "right" ? styles.r : undefined}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.key}
                      className={list ? styles.row : undefined}
                      tabIndex={list ? 0 : undefined}
                      onClick={list ? () => onClient(r.client) : undefined}
                      onKeyDown={
                        list
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onClient(r.client);
                              }
                            }
                          : undefined
                      }
                    >
                      {r.cells.map((c, k) => (
                        <td
                          key={k}
                          className={
                            vm.columns[k]?.align === "right"
                              ? styles.r
                              : undefined
                          }
                        >
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
                Export CSV ({fmtInt(vm.total)} rows)
              </button>
              <span>
                {vm.total === 0
                  ? "No rows"
                  : `${fmtInt(first + 1)}–${fmtInt(first + rows.length)} of ${fmtInt(vm.total)}`}{" "}
                - {vm.footer}
              </span>
              {pages > 1 ? (
                <nav className={styles.pager} aria-label="Pages">
                  <button
                    type="button"
                    disabled={current === 0}
                    onClick={() => setPage(0)}
                    aria-label="First page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <span aria-live="polite">
                    Page {fmtInt(current + 1)} of {fmtInt(pages)}
                  </span>
                  <button
                    type="button"
                    disabled={current >= pages - 1}
                    onClick={() => setPage(current + 1)}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    disabled={current >= pages - 1}
                    onClick={() => setPage(pages - 1)}
                    aria-label="Last page"
                  >
                    »
                  </button>
                </nav>
              ) : null}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

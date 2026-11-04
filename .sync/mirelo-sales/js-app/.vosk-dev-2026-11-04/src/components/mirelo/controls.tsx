import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import styles from "./sales.module.css";

// Keyboard-complete controls (WAI-ARIA radio group and tabs patterns: roving tabindex, arrows / Home / End).
// The header's segmented controls went with the filter pop-up (2026-11-01); its radio rows use <Radios>.

function roving<T>(
  e: KeyboardEvent,
  values: readonly T[],
  current: T,
  pick: (v: T) => void,
  focus: (i: number) => void,
) {
  const i = values.indexOf(current);
  const n = values.length;
  const next =
    e.key === "ArrowRight" || e.key === "ArrowDown"
      ? (i + 1) % n
      : e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? (i - 1 + n) % n
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? n - 1
            : -1;
  if (next < 0) return;
  e.preventDefault();
  const v = values[next];
  if (v === undefined) return;
  pick(v);
  focus(next);
}

/** Radio row of the filter pop-up: roving tabindex, arrows / Home / End; a disabled option says why on hover. */
export function Radios<T extends string>({
  labelledBy,
  options,
  value,
  onChange,
}: {
  labelledBy: string;
  options: readonly { value: T; label: string; disabledReason?: string }[];
  value: string;
  onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabledReason);
  const tabbable = enabled.some((o) => o.value === value)
    ? value
    : enabled[0]?.value;
  return (
    <div
      className={styles.radios}
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-disabled={o.disabledReason ? true : undefined}
          title={o.disabledReason}
          tabIndex={o.value === tabbable ? 0 : -1}
          onClick={() => !o.disabledReason && onChange(o.value)}
          onKeyDown={(e) =>
            roving(
              e,
              enabled.map((p) => p.value),
              (tabbable ?? "") as T,
              onChange,
              (k) =>
                refs.current[
                  options.findIndex((p) => p.value === enabled[k]?.value)
                ]?.focus(),
            )
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  panelId,
}: {
  tabs: readonly { value: T; label: string; width: number }[];
  value: T;
  onChange: (v: T) => void;
  panelId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      className={`${styles.abs} ${styles.tabs}`}
      role="tablist"
      aria-label="Views"
    >
      {tabs.map((t, i) => (
        <button
          key={t.value}
          id={`tab-${t.value}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          aria-controls={panelId}
          tabIndex={t.value === value ? 0 : -1}
          style={{ width: t.width }}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) =>
            roving(
              e,
              tabs.map((p) => p.value),
              value,
              onChange,
              (k) => refs.current[k]?.focus(),
            )
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Copies the page URL plus the report's state (F-37 analogue). Clipboard can be blocked in a sandboxed iframe. */
export function CopyLink({ href }: { href: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      className={styles.linkBtn}
      onClick={() =>
        navigator.clipboard.writeText(href).then(
          () => setState("copied"),
          () => setState("failed"),
        )
      }
    >
      <span aria-hidden="true">⧉</span>
      <span aria-live="polite">
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy blocked"
            : "Copy link"}
      </span>
    </button>
  );
}

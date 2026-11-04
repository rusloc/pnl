import { useState } from "react";
import {
  monthLabel,
  monthOfYear,
  periodKind,
  periodWindow,
  yearOf,
} from "@/lib/mirelo/windows";
import type { PeriodKind } from "@/lib/mirelo/windows";
import { Radios } from "./controls";
import styles from "./sales.module.css";

// Period calendar of the filter pop-up (2026-11-01, owner: "year, quarter, month, or a custom range like Jun–Sep 2025";
// no QTD / YTD). Classic picker shape: a mode row, a year stepper, then a 4 × 3 month grid, four quarter tiles or the
// year tiles. A custom range is two clicks, first month then last, across years if needed; the first click already
// applies that month, so the report never sits in a half-picked state. Only closed months with data can be picked.
// Fixed layout (2026-11-01, owner): every mode keeps the same rows at the same size (stepper, a 108 px tile area, one
// hint line), so switching Month / Quarter / Year changes the content only, never the pop-up's shape.

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MODES: readonly { value: PeriodKind; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "range", label: "Custom range" },
];
const FIRST_YEAR = 2024; // month index 0 = Jan 2024 (windows.ts)
const yearStart = (y: number) => (y - FIRST_YEAR) * 12;
const HINTS: Record<PeriodKind, string> = {
  month: "Pick a month.",
  quarter: "Pick a quarter.",
  year: "Pick a year; the current one runs to the last closed month.",
  range: "Pick the first month, then the last.",
};

export function Calendar({
  from,
  anchor,
  first,
  last,
  onChange,
}: {
  from: number;
  anchor: number;
  first: number;
  last: number;
  onChange: (p: { from: number; anchor: number }) => void;
}) {
  const [mode, setMode] = useState<PeriodKind>(() =>
    periodKind(periodWindow({ from, anchor }), last),
  );
  const [year, setYear] = useState(() => yearOf(anchor));
  const [pending, setPending] = useState<number | null>(null);
  const y0 = yearOf(first);
  const y1 = yearOf(last);
  const out = (i: number) =>
    i < first ? "Before the data" : i > last ? "Not closed yet" : null;
  const pick = (a: number, b: number) =>
    onChange({ from: Math.min(a, b), anchor: Math.max(a, b) });

  const months = Array.from({ length: 12 }, (_, k) => yearStart(year) + k);
  const quarters = [0, 1, 2, 3].map((q) => yearStart(year) + q * 3);
  const years = Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k);

  return (
    <div className={styles.cal}>
      <Radios
        labelledBy="mf-period"
        options={MODES}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setPending(null);
        }}
      />
      {/* the stepper row stays in Year mode (the span of years, no arrows) so the tiles never move */}
      <div className={styles.calYear}>
        <button
          type="button"
          aria-label="Previous year"
          disabled={year <= y0}
          style={mode === "year" ? { visibility: "hidden" } : undefined}
          onClick={() => setYear(year - 1)}
        >
          ‹
        </button>
        <span aria-live="polite">{mode === "year" ? `${y0}–${y1}` : year}</span>
        <button
          type="button"
          aria-label="Next year"
          disabled={year >= y1}
          style={mode === "year" ? { visibility: "hidden" } : undefined}
          onClick={() => setYear(year + 1)}
        >
          ›
        </button>
      </div>

      {mode === "month" || mode === "range" ? (
        <div className={styles.calGrid} role="group" aria-label={`${year}`}>
          {months.map((i) => {
            const why = out(i);
            const inRange = i >= from && i <= anchor;
            return (
              <button
                key={i}
                type="button"
                className={`${styles.calTile} ${inRange ? styles.calIn : ""} ${i === from || i === anchor ? styles.calEdge : ""}`}
                aria-pressed={inRange}
                aria-label={monthLabel(i)}
                disabled={why !== null}
                title={why ?? undefined}
                onClick={() => {
                  if (mode === "month") return pick(i, i);
                  if (pending === null) {
                    setPending(i);
                    pick(i, i);
                  } else {
                    pick(pending, i);
                    setPending(null);
                  }
                }}
              >
                {MONTHS[monthOfYear(i)]}
              </button>
            );
          })}
        </div>
      ) : null}

      {mode === "quarter" ? (
        <div className={`${styles.calGrid} ${styles.calQ}`}>
          {quarters.map((s, q) => {
            const why = out(s) ?? out(s + 2);
            const on = from === s && anchor === s + 2;
            return (
              <button
                key={s}
                type="button"
                className={`${styles.calTile} ${on ? styles.calIn : ""} ${on ? styles.calEdge : ""}`}
                aria-pressed={on}
                aria-label={`Q${q + 1} ${year}`}
                disabled={why !== null}
                title={why ?? undefined}
                onClick={() => pick(s, s + 2)}
              >
                Q{q + 1}
                <small>
                  {MONTHS[q * 3]}–{MONTHS[q * 3 + 2]}
                </small>
              </button>
            );
          })}
        </div>
      ) : null}

      {mode === "year" ? (
        <div className={`${styles.calGrid} ${styles.calY}`}>
          {years.map((y) => {
            const s = Math.max(yearStart(y), first);
            const e = Math.min(yearStart(y) + 11, last);
            const on = from === s && anchor === e;
            return (
              <button
                key={y}
                type="button"
                className={`${styles.calTile} ${on ? styles.calIn : ""} ${on ? styles.calEdge : ""}`}
                aria-pressed={on}
                aria-label={`Year ${y}`}
                onClick={() => pick(s, e)}
              >
                {y}
                {e - s < 11 ? (
                  <small>
                    {MONTHS[monthOfYear(s)]}–{MONTHS[monthOfYear(e)]}
                  </small>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <p className={styles.calHint} aria-live="polite">
        {mode === "range" && pending !== null
          ? `From ${monthLabel(pending)}: now pick the last month.`
          : HINTS[mode]}
      </p>
    </div>
  );
}

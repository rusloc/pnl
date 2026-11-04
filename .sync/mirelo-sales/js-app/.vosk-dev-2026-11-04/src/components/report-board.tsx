"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * A fixed-size dashboard board (1440 × 810, the size the Mirelo and Nordmark reports were designed and checked at)
 * that scales down to the width it gets. The popup is near full-screen, so on a wide window the board renders at
 * its own size and on a laptop it shrinks to fit, instead of scrolling sideways.
 *
 * `fill` (Mirelo, 2026-11-01): the board scales to fit the popup in both directions (up to 1.25×) and grows taller
 * than its design height to use the rest of the popup, so no empty band is left under it. The report reads its
 * height through {@link useBoardHeight} and spreads the extra over its rows.
 *
 * The scale is a CSS transform, which also makes the board the containing block of every `position: fixed`
 * element inside it (Nordmark's side bar, pop-ups and tooltip), so they stay inside the popup rather than
 * anchoring to the browser window. Code that positions from `getBoundingClientRect()` reads the scale through
 * {@link useBoardScale} and divides.
 */
const ScaleContext = createContext(1);
const HeightContext = createContext(810);

export const useBoardScale = () => useContext(ScaleContext);
/** The board's height in board px: the design height, or more under `fill`. */
export const useBoardHeight = () => useContext(HeightContext);

const MAX_FILL_SCALE = 1.25;

export function ReportBoard({
  width = 1440,
  height = 810,
  fill = false,
  className,
  children,
}: {
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height, left: 0 });

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!fill) {
        setFit({ scale: Math.min(1, cw / width), height, left: 0 });
        return;
      }
      const scale = Math.max(
        0.1,
        Math.min(MAX_FILL_SCALE, cw / width, ch > 0 ? ch / height : Infinity),
      );
      setFit({
        scale,
        height: Math.max(height, Math.floor(ch / scale)),
        left: Math.max(0, (cw - width * scale) / 2),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, fill]);

  // Without `fill` the host fills the popup (its ground colour continues below a board shorter than the popup) and
  // is at least the board's scaled height; at full size the board sits centred in a wider popup. With `fill` the
  // host is exactly the popup and the board is sized to it.
  return (
    <div
      ref={host}
      className={className}
      style={
        fill
          ? { height: "100%", position: "relative", overflow: "hidden" }
          : { height: height * fit.scale, minHeight: "100%" }
      }
    >
      <ScaleContext.Provider value={fit.scale}>
        <HeightContext.Provider value={fit.height}>
          <div
            style={{
              width,
              height: fit.height,
              margin: fill ? undefined : "0 auto",
              marginLeft: fill ? fit.left : undefined,
              transform: `scale(${fit.scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </HeightContext.Provider>
      </ScaleContext.Provider>
    </div>
  );
}

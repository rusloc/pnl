import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import styles from './glass.module.css';

// Glass pop-ups shared by the P&L views and the Mirelo route (ADR-0012 §2.5): matte / frosted glass with a solid
// fallback; one open at a time; Escape, outside click and × close; focus moves in, Tab stays inside, focus returns to
// the opener. Copy comes from the engines; this file owns behaviour and shell only.

interface PopupState {
  openId: string | null;
  setOpenId: (id: string | null) => void;
}
const PopupContext = createContext<PopupState>({ openId: null, setOpenId: () => undefined });

/**
 * One pop-up open at a time. `scope` (e.g. view + sub-page): a pop-up opened in another scope counts as closed, so a
 * view or page change closes it without remounting the subtree.
 */
export function PopupProvider({ children, scope = '' }: { children: ReactNode; scope?: string }) {
  const [state, setState] = useState<{ scope: string; id: string | null }>({ scope, id: null });
  const value = useMemo(
    () => ({
      openId: state.scope === scope ? state.id : null,
      setOpenId: (id: string | null) => setState({ scope, id }),
    }),
    [state, scope],
  );
  return <PopupContext value={value}>{children}</PopupContext>;
}

/** Open state of one pop-up id; opening it closes any other. */
export function usePopup(id: string) {
  const { openId, setOpenId } = useContext(PopupContext);
  const open = openId === id;
  const close = useCallback(() => setOpenId(null), [setOpenId]);
  const toggle = useCallback(() => setOpenId(open ? null : id), [open, id, setOpenId]);
  return { open, close, toggle };
}

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

export function GlassPopup({
  title,
  opener,
  style,
  className,
  onClose,
  children,
}: {
  title: string;
  opener: RefObject<HTMLButtonElement | null>;
  style: CSSProperties;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const back = opener.current;
    return () => back?.focus();
  }, [opener]);

  useEffect(() => {
    const ctrl = new AbortController();
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        } else if (e.key === 'Tab' && ref.current) {
          const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
          const first = items[0];
          const last = items.at(-1);
          if (!first || !last) return;
          if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
          } else if (!ref.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      },
      { signal: ctrl.signal, capture: true },
    );
    document.addEventListener(
      'pointerdown',
      (e) => {
        const t = e.target;
        if (!(t instanceof Node) || ref.current?.contains(t) || opener.current?.contains(t)) return;
        onClose();
      },
      { signal: ctrl.signal },
    );
    return () => ctrl.abort();
  }, [onClose, opener]);

  return (
    <div
      ref={ref}
      className={`${styles.glass} ${className ?? ''}`}
      style={style}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className={styles.hd}>
        <h4 id={titleId}>{title}</h4>
        <button type="button" className={styles.x} aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** Plain upright "i" in a circle (SVG, not a font glyph). */
export function InfoGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="7.25" y="6.6" width="1.5" height="5" fill="currentColor" />
      <rect x="7.25" y="3.9" width="1.5" height="1.6" fill="currentColor" />
    </svg>
  );
}

export interface GlassInfo {
  what: string;
  why?: string;
  formula: string;
  values: { label: string; value: string }[];
  source: string;
}

/** Standard ⓘ content: what · why · formula · sub-values · source. */
export function InfoBody({ info }: { info: GlassInfo }) {
  return (
    <>
      <p>{info.what}</p>
      <dl className={styles.dl}>
        {info.why ? (
          <>
            <dt>Why it matters</dt>
            <dd>{info.why}</dd>
          </>
        ) : null}
        <dt>Formula</dt>
        <dd className={styles.formula}>{info.formula}</dd>
        {info.values.map((v) => (
          <div key={v.label} className={styles.val}>
            <dt>{v.label}</dt>
            <dd>{v.value}</dd>
          </div>
        ))}
        <dt>Source</dt>
        <dd className={styles.src}>{info.source}</dd>
      </dl>
    </>
  );
}

/** "How to read": one labelled line per item. */
export function LinesBody({ lines }: { lines: readonly { label: string; value: string }[] }) {
  return (
    <dl className={styles.dl}>
      {lines.map((l) => (
        <div key={l.label}>
          <dt>{l.label}</dt>
          <dd>{l.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** ⓘ button + its glass pop-up. */
export function InfoButton({
  id,
  title,
  info,
  className,
  popupStyle,
  popupClassName,
}: {
  id: string;
  title: string;
  info: GlassInfo;
  className?: string;
  popupStyle: CSSProperties;
  popupClassName?: string;
}) {
  const { open, close, toggle } = usePopup(`info-${id}`);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={opener}
        type="button"
        className={`${styles.infoBtn} ${className ?? ''}`}
        aria-label={`About ${title}`}
        aria-expanded={open}
        onClick={toggle}
      >
        <InfoGlyph />
      </button>
      {open ? (
        <GlassPopup title={title} opener={opener} style={popupStyle} className={popupClassName} onClose={close}>
          <InfoBody info={info} />
        </GlassPopup>
      ) : null}
    </>
  );
}

/** One "How to read" per view. */
export function HowToReadButton({
  title,
  lines,
  className,
  popupStyle,
  popupClassName,
}: {
  title: string;
  lines: readonly { label: string; value: string }[];
  className?: string;
  popupStyle: CSSProperties;
  popupClassName?: string;
}) {
  const { open, close, toggle } = usePopup('how-to-read');
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} type="button" className={className} aria-expanded={open} onClick={toggle}>
        <InfoGlyph />
        How to read
      </button>
      {open ? (
        <GlassPopup title={title} opener={opener} style={popupStyle} className={popupClassName} onClose={close}>
          <LinesBody lines={lines} />
        </GlassPopup>
      ) : null}
    </>
  );
}

import { useEffect, type RefObject } from 'react';

/**
 * Pop-over lifecycle shared by the filter flyouts, the company picker and the applied-filters pop-up (N-08): focus
 * moves into the panel on open and back to the control that opened it on close; Escape closes; with `outside`, a
 * pointer press outside the panel and its trigger closes too (the trigger is excluded, so it can toggle).
 */
export function useDismiss({
  panelRef,
  focusRef,
  triggerId,
  onClose,
  outside = false,
}: {
  panelRef: RefObject<HTMLElement | null>;
  focusRef: RefObject<HTMLElement | null>;
  triggerId: string;
  onClose: () => void;
  outside?: boolean;
}) {
  useEffect(() => {
    focusRef.current?.focus();
    return () => document.getElementById(triggerId)?.focus();
  }, [focusRef, triggerId]);

  useEffect(() => {
    const ctrl = new AbortController();
    window.addEventListener('keydown', (e) => e.key === 'Escape' && onClose(), { signal: ctrl.signal });
    if (outside)
      document.addEventListener(
        'pointerdown',
        (e) => {
          const target = e.target;
          if (!(target instanceof Node)) return;
          if (panelRef.current?.contains(target) || document.getElementById(triggerId)?.contains(target)) return;
          onClose();
        },
        { signal: ctrl.signal },
      );
    return () => ctrl.abort();
  }, [onClose, outside, panelRef, triggerId]);
}

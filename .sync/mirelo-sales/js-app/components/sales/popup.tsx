import type { CSSProperties } from 'react';
import type { HowToReadVM, InfoVM } from '@/lib/sales/copy';
import { HowToReadButton as SharedHowToRead, InfoButton as SharedInfoButton } from '../glass';
import styles from './sales.module.css';

// Mirelo wrappers around the shared glass pop-ups (components/glass.tsx, ADR-0012 §2.5).

export { PopupProvider } from '../glass';

export function InfoButton({
  id,
  title,
  info,
  className,
  popupStyle,
}: {
  id: string;
  title: string;
  info: InfoVM;
  className?: string;
  popupStyle: CSSProperties;
}) {
  return <SharedInfoButton id={id} title={title} info={info} className={className} popupStyle={popupStyle} />;
}

/** One "How to read" per view, header right; the pop-up sits under the tabs row at x 1048–1408. */
export function HowToReadButton({ vm }: { vm: HowToReadVM }) {
  return (
    <SharedHowToRead title={vm.title} lines={vm.lines} className={styles.linkBtn} popupStyle={{ right: 0, top: 28 }} />
  );
}

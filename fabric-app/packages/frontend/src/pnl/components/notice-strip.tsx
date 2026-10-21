// Notice strip (L-05, C-50, design brief §5.4): shown only when a notice applies.
import { InfoIcon } from './ui/icons';

export function NoticeStrip({ notices }: { notices: readonly string[] }) {
  if (notices.length === 0) return null;
  return (
    <div
      role="note"
      className="flex flex-none items-start gap-[8px] rounded-[8px] border border-notice-border bg-notice-tint px-[12px] py-[8px] text-[13px] text-notice-text"
    >
      <InfoIcon className="mt-[2px] flex-none" />
      <div className="flex flex-col gap-[2px]">
        {notices.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}

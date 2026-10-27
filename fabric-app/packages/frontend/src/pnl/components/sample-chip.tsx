// Flags a view whose numbers are illustrative (mockup) rather than read from
// lh_raw. Removed when the lhraw figures source lands (ADR-0005).
export function SampleChip({ detail }: { detail?: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-[6px] rounded-[12px] border border-dashed border-notice-border bg-notice-tint px-[8px] py-[1px] font-ledger text-[11px] font-medium text-notice-text"
    >
      <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-notice-icon" />
      Sample data{detail ? ` - ${detail}` : ''}
    </span>
  );
}

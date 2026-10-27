// Flags a zone whose numbers were read from the semantic model (ADR-0006), the
// counterpart of the "Sample data" chip so live and sample never share a look.
export function LiveChip({ detail }: { detail?: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-[6px] rounded-[12px] border border-acc bg-acc-t px-[8px] py-[1px] font-ledger text-[11px] font-medium text-ink-900"
    >
      <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-acc" />
      Live - semantic model{detail ? ` - ${detail}` : ''}
    </span>
  );
}

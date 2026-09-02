import type { QuotationStatus } from '@isd/shared-types';

/**
 * Quotation status badge (PROJECT_PLAN.md §5.1, §11.6).
 *
 * Colour comes from the status tokens, and each badge also carries its label
 * as text — colour alone is not an accessible way to convey state.
 */
const STATUS_STYLES: Record<QuotationStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-status-new/10 text-status-new' },
  in_review: { label: 'In review', className: 'bg-status-review/10 text-status-review' },
  quoted: { label: 'Quoted', className: 'bg-status-quoted/10 text-status-quoted' },
  won: { label: 'Won', className: 'bg-status-won/10 text-status-won' },
  lost: { label: 'Lost', className: 'bg-status-lost/10 text-status-lost' },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-status-cancelled/10 text-status-cancelled',
  },
};

export function StatusBadge({ status }: { status: QuotationStatus }) {
  const { label, className } = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-control)] px-2 py-0.5 text-caption font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

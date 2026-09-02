import { Link } from 'react-router';

import type { DashboardStats, QuotationStatus } from '@isd/shared-types';
import { QUOTATION_STATUSES } from '@isd/shared-types';

import { StatusBadge } from '@/components/ui/status-badge';

/**
 * Quotations by status (PROJECT_PLAN.md §11.3).
 *
 * Each row links straight into the quotations table pre-filtered to that
 * status — the number is only useful if acting on it is one click away.
 */
export function StatusBreakdown({ counts }: { counts: DashboardStats['quotationsByStatus'] }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="panel p-4">
      <h2 className="font-display text-h3 font-semibold text-surface-inverse">By status</h2>
      <p className="text-caption text-text-secondary" data-tabular>
        {total.toLocaleString('en')} total
      </p>

      <ul className="mt-4 space-y-2">
        {QUOTATION_STATUSES.map((status: QuotationStatus) => {
          const count = counts[status] ?? 0;
          const share = total > 0 ? (count / total) * 100 : 0;

          return (
            <li key={status}>
              <Link
                to={`/quotations?status=${status}`}
                className="flex items-center gap-3 rounded-[var(--radius-control)] px-1 py-1 hover:bg-surface-raised"
              >
                <span className="w-24 shrink-0">
                  <StatusBadge status={status} />
                </span>

                <span aria-hidden className="h-1.5 flex-1 rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-action-secondary/70"
                    style={{ width: `${share}%` }}
                  />
                </span>

                <span
                  className="w-10 shrink-0 text-end text-body-sm text-text-primary"
                  data-tabular
                >
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

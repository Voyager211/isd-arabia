import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Table primitive for every admin listing (PROJECT_PLAN.md §11).
 *
 * Below `md` each row collapses into a stacked card (§15.3): a seven-column
 * table on a phone is either unreadably small or horizontally scrolling, and
 * the client will check quotations from a phone.
 *
 * The loading, empty and error states live here rather than in each screen, so
 * every table behaves the same way when things go wrong.
 */

export interface Column<TRow> {
  key: string;
  header: string;
  /** Renders the cell. Receives the whole row. */
  cell: (row: TRow) => ReactNode;
  /** Right-align numeric columns. */
  align?: 'start' | 'end';
  /** Hidden in the stacked mobile card — usually a redundant or wide column. */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRowClick?: (row: TRow) => void;
  caption?: string;
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  error = null,
  emptyMessage = 'Nothing to show yet.',
  onRowClick,
  caption,
}: DataTableProps<TRow>) {
  if (isLoading) {
    return (
      <div className="panel flex items-center justify-center gap-2 p-10 text-text-secondary">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="panel border-status-lost/30 p-6 text-body-sm text-status-lost">
        {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="panel p-10 text-center text-body-sm text-text-secondary">{emptyMessage}</div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      {/* Table layout from md up. */}
      <table className="hidden w-full border-collapse md:table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border-subtle bg-surface-raised">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2.5 text-caption font-semibold text-text-secondary ${
                  column.align === 'end' ? 'text-end' : 'text-start'
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-border-subtle last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-surface-raised' : ''
              }`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2.5 text-body-sm ${
                    column.align === 'end' ? 'text-end' : 'text-start'
                  } ${column.className ?? ''}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stacked cards below md. */}
      <ul className="divide-y divide-border-subtle md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`p-3 ${onRowClick ? 'cursor-pointer' : ''}`}
          >
            <dl className="space-y-1.5">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex gap-3">
                    <dt className="w-28 shrink-0 text-caption text-text-secondary">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 flex-1 text-body-sm">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

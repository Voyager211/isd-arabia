import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download } from 'lucide-react';

import type { QuotationStatus, QuotationSummary } from '@isd/shared-types';
import { QUOTATION_STATUSES } from '@isd/shared-types';

import { apiClient } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { useDebounced } from '@/hooks/use-debounced';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { QuotationDetailModal } from '@/components/quotations/quotation-detail-modal';

/**
 * Quotations (PROJECT_PLAN.md §11.6).
 *
 * ONE shared table for the whole team — no routing, no assignment, no per-user
 * inbox (§18 #6). Everyone sees everything and works from the same list.
 */

const STATUS_LABELS: Record<QuotationStatus, string> = {
  new: 'New',
  in_review: 'In review',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export function QuotationsPage() {
  /**
   * The initial status filter comes from the query string, so the dashboard's
   * status breakdown can link straight into a pre-filtered table. After mount
   * the filters are plain component state — this screen is behind a login and
   * has no shareable-URL requirement, unlike the storefront listing.
   */
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<QuotationStatus[]>(() => {
    const requested = searchParams.get('status');
    if (!requested) return [];

    return requested
      .split(',')
      .filter((value): value is QuotationStatus =>
        QUOTATION_STATUSES.includes(value as QuotationStatus),
      );
  });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  const params = {
    q: debouncedSearch || undefined,
    status: statuses.length ? statuses.join(',') : undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: 25,
  };

  const { data, isLoading, error, refetch } = useAsyncData<QuotationSummary[]>(
    '/admin/quotations',
    { params },
  );

  /**
   * The export must carry the auth cookie AND the current filters, so it goes
   * through the same Axios instance as a blob rather than being a plain link —
   * an `<a href>` would send the cookie but silently drop the filter state.
   */
  const onExport = async () => {
    const response = await apiClient.get('/admin/quotations/export', {
      params,
      responseType: 'blob',
    });

    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleStatus = (status: QuotationStatus) => {
    setStatuses((current) =>
      current.includes(status) ? current.filter((entry) => entry !== status) : [...current, status],
    );
    setPage(1);
  };

  const columns: Column<QuotationSummary>[] = [
    {
      key: 'quoteNumber',
      header: 'Quote',
      cell: (row) => (
        <span className="font-semibold text-text-primary" data-tabular>
          {row.quoteNumber}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received',
      cell: (row) =>
        new Date(row.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    { key: 'company', header: 'Company', cell: (row) => row.company },
    { key: 'contactName', header: 'Contact', cell: (row) => row.contactName, hideOnMobile: true },
    {
      key: 'itemCount',
      header: 'Items',
      align: 'end',
      cell: (row) => <span data-tabular>{row.itemCount}</span>,
    },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Every request in one place. Open a row to see the full detail and change its status."
        actions={
          <button type="button" onClick={() => void onExport()} className="btn btn-ghost">
            <Download aria-hidden className="size-4" />
            Export CSV
          </button>
        }
      />

      <div className="panel mb-3 space-y-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="field-label" htmlFor="quotation-search">
              Search
            </label>
            <input
              id="quotation-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Quote number, company, contact or email"
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="quotation-from">
              From
            </label>
            <input
              id="quotation-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="quotation-to">
              To
            </label>
            <input
              id="quotation-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="field-input"
            />
          </div>
        </div>

        <fieldset>
          <legend className="field-label">Status</legend>
          <div className="flex flex-wrap gap-2">
            {QUOTATION_STATUSES.map((status) => (
              <label
                key={status}
                className={`flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 py-1 text-caption ${
                  statuses.includes(status)
                    ? 'border-action-secondary bg-surface-raised text-text-primary'
                    : 'border-border-subtle text-text-secondary'
                }`}
              >
                <input
                  type="checkbox"
                  checked={statuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                  className="size-3.5"
                />
                {STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <DataTable
        caption="Quotation requests"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No quotations match these filters."
        onRowClick={(row) => setOpenId(row._id)}
      />

      <nav aria-label="Pagination" className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={page === 1}
          className="btn btn-ghost"
        >
          Previous
        </button>
        <span className="text-caption text-text-secondary" data-tabular>
          Page {page}
        </span>
        <button
          type="button"
          onClick={() => setPage((value) => value + 1)}
          disabled={(data?.length ?? 0) < 25}
          className="btn btn-ghost"
        >
          Next
        </button>
      </nav>

      {openId ? (
        <QuotationDetailModal
          quotationId={openId}
          onClose={() => setOpenId(null)}
          onChanged={refetch}
        />
      ) : null}
    </>
  );
}

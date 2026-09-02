import { useEffect, useState } from 'react';
import { Boxes, Download, FileText, FolderTree } from 'lucide-react';

import type { DashboardStats, QuotationSummary } from '@isd/shared-types';

import { get, normaliseError } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { QuotationChart } from '@/components/dashboard/quotation-chart';
import { StatusBreakdown } from '@/components/dashboard/status-breakdown';

/**
 * Dashboard (PROJECT_PLAN.md §11.3).
 *
 * Four stat cards, the status breakdown, an eight-week chart and the ten most
 * recent requests — everything the client needs to answer "what came in and
 * what still needs working" without opening another screen.
 */

const RECENT_COLUMNS: Column<QuotationSummary>[] = [
  {
    key: 'quoteNumber',
    header: 'Quote',
    cell: (row) => (
      <span className="font-semibold" data-tabular>
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

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await get<DashboardStats>('/admin/dashboard/stats');
        if (!cancelled) setStats(data);
      } catch (caught) {
        if (!cancelled) setError(normaliseError(caught).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Catalogue size and incoming quotation activity at a glance."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products" value={stats?.totalProducts ?? '—'} icon={Boxes} />
        <StatCard label="Categories" value={stats?.totalCategories ?? '—'} icon={FolderTree} />
        <StatCard
          label="New quotations"
          value={stats?.newQuotationsLast7Days ?? '—'}
          icon={FileText}
          hint="Last 7 days"
        />
        <StatCard
          label="Catalogue downloads"
          value={stats?.catalogueDownloadsLast30Days ?? '—'}
          icon={Download}
          hint="Last 30 days"
        />
      </div>

      {stats ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <StatusBreakdown counts={stats.quotationsByStatus} />
          <QuotationChart weeks={stats.quotationsPerWeek} />
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 font-display text-h3 font-semibold text-surface-inverse">
          Recent quotations
        </h2>
        <DataTable
          caption="The ten most recent quotation requests"
          columns={RECENT_COLUMNS}
          rows={stats?.recentQuotations ?? []}
          rowKey={(row) => row._id}
          isLoading={isLoading}
          error={error}
          emptyMessage="No quotations have been submitted yet."
        />
      </section>
    </>
  );
}

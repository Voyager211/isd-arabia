import { useState } from 'react';
import { CheckCircle2, Download, FileText, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { CatalogueFile, CatalogueLead } from '@isd/shared-types';

import { apiClient, del, normaliseError, patch } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { useDebounced } from '@/hooks/use-debounced';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CatalogueUploadSlideOver } from '@/components/catalogue/catalogue-upload-slide-over';

/**
 * Catalogue files and download leads (PROJECT_PLAN.md §11.7).
 *
 * Two tabs rather than two sidebar entries: the leads only exist because of
 * the files, and the client will want to check "did the new edition get
 * picked up" without navigating away.
 */
type Tab = 'files' | 'leads';

export function CataloguePage() {
  const [tab, setTab] = useState<Tab>('files');

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="The downloadable PDF and the leads captured by its download form."
      />

      <div
        role="tablist"
        aria-label="Catalogue sections"
        className="mb-4 flex gap-1 border-b border-border-subtle"
      >
        {(['files', 'leads'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-body-sm font-semibold transition-colors ${
              tab === value
                ? 'border-action-primary text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {value === 'files' ? 'Files' : 'Leads'}
          </button>
        ))}
      </div>

      {tab === 'files' ? <FilesTab /> : <LeadsTab />}
    </>
  );
}

function FilesTab() {
  const { data, isLoading, error, refetch } = useAsyncData<CatalogueFile[]>('/admin/catalogue');

  const [isUploading, setIsUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CatalogueFile | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const onActivate = async (file: CatalogueFile) => {
    setIsBusy(true);
    try {
      await patch(`/admin/catalogue/${file._id}/activate`);
      toast.success(`'${file.title}' is now live on the storefront.`);
      await refetch();
    } catch (caught) {
      toast.error(normaliseError(caught).message);
    } finally {
      setIsBusy(false);
    }
  };

  const onDelete = async () => {
    if (!pendingDelete) return;

    setIsBusy(true);
    try {
      await del(`/admin/catalogue/${pendingDelete._id}`);
      toast.success(`Deleted '${pendingDelete.title}'.`);
      setPendingDelete(null);
      await refetch();
    } catch (caught) {
      toast.error(normaliseError(caught).message);
    } finally {
      setIsBusy(false);
    }
  };

  const columns: Column<CatalogueFile>[] = [
    {
      key: 'cover',
      header: '',
      hideOnMobile: true,
      cell: (row) =>
        row.coverImage ? (
          <img
            src={row.coverImage.url}
            alt=""
            width={32}
            height={44}
            className="h-11 w-8 rounded border border-border-subtle bg-white object-contain"
          />
        ) : (
          <span className="flex h-11 w-8 items-center justify-center rounded border border-border-subtle">
            <FileText aria-hidden className="size-4 text-text-muted" />
          </span>
        ),
    },
    {
      key: 'title',
      header: 'Title',
      cell: (row) => (
        <div>
          <span className="font-medium text-text-primary">{row.title}</span>
          {row.isActive ? (
            <span className="ms-2 inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-status-won/10 px-2 py-0.5 text-caption font-semibold text-status-won">
              <CheckCircle2 aria-hidden className="size-3" />
              Live
            </span>
          ) : null}
        </div>
      ),
    },
    { key: 'version', header: 'Version', cell: (row) => row.version },
    {
      key: 'size',
      header: 'Size',
      align: 'end',
      cell: (row) => <span data-tabular>{(row.file.sizeBytes / 1_048_576).toFixed(1)} MB</span>,
    },
    {
      key: 'downloads',
      header: 'Downloads',
      align: 'end',
      cell: (row) => <span data-tabular>{row.downloadCount.toLocaleString('en')}</span>,
    },
    {
      key: 'gate',
      header: 'Lead form',
      cell: (row) => (
        <span className={row.requiresLead ? 'text-status-won' : 'text-status-review'}>
          {row.requiresLead ? 'Required' : 'Open'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'end',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          {!row.isActive ? (
            <button
              type="button"
              onClick={() => void onActivate(row)}
              disabled={isBusy}
              className="text-caption font-semibold text-action-secondary hover:underline"
            >
              Make live
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPendingDelete(row)}
            aria-label={`Delete ${row.title}`}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-raised hover:text-status-lost"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setIsUploading(true)} className="btn btn-accent">
          <Plus aria-hidden className="size-4" />
          Upload catalogue
        </button>
      </div>

      <DataTable
        caption="Catalogue files"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No catalogue uploaded yet."
      />

      {isUploading ? (
        <CatalogueUploadSlideOver
          onClose={() => setIsUploading(false)}
          onSaved={async () => {
            setIsUploading(false);
            await refetch();
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete catalogue file"
        message={
          pendingDelete
            ? `Delete '${pendingDelete.title}'? It is removed from the storefront but the record and its leads are kept.`
            : ''
        }
        confirmLabel="Delete"
        isDestructive
        isBusy={isBusy}
        onConfirm={onDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function LeadsTab() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);

  const params = {
    q: debouncedSearch || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: 25,
  };

  const { data, isLoading, error } = useAsyncData<CatalogueLead[]>('/admin/catalogue/leads', {
    params,
  });

  /** Same reasoning as the quotation export: the cookie AND the filters. */
  const onExport = async () => {
    const response = await apiClient.get('/admin/catalogue/leads/export', {
      params,
      responseType: 'blob',
    });

    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogue-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<CatalogueLead>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      cell: (row) =>
        new Date(row.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    { key: 'company', header: 'Company', cell: (row) => row.company },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => (
        <a href={`mailto:${row.email}`} className="text-action-secondary hover:underline">
          {row.email}
        </a>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideOnMobile: true,
      cell: (row) => (
        <a
          href={`tel:${row.phone.replace(/\s/g, '')}`}
          className="text-action-secondary hover:underline"
          data-tabular
        >
          {row.phone}
        </a>
      ),
    },
    {
      key: 'catalogue',
      header: 'Catalogue',
      hideOnMobile: true,
      cell: (row) => row.catalogueTitle ?? '—',
    },
  ];

  return (
    <>
      <div className="panel mb-3 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-48 flex-1">
          <label className="field-label" htmlFor="lead-search">
            Search
          </label>
          <input
            id="lead-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Name, company or email"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="lead-from">
            From
          </label>
          <input
            id="lead-from"
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
          <label className="field-label" htmlFor="lead-to">
            To
          </label>
          <input
            id="lead-to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="field-input"
          />
        </div>

        <button type="button" onClick={() => void onExport()} className="btn btn-ghost">
          <Download aria-hidden className="size-4" />
          Export CSV
        </button>
      </div>

      <DataTable
        caption="Catalogue download leads"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No downloads yet."
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
    </>
  );
}

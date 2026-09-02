import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Brand, CategoryNode, PaginationMeta } from '@isd/shared-types';

import { del, normaliseError } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { useDebounced } from '@/hooks/use-debounced';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { flattenCategories } from '@/lib/categories';

/** The row shape the admin list endpoint returns. */
interface AdminProductRow {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  images?: { url: string; alt: string }[];
  category?: { name: string; slug: string };
  brand?: { name: string; slug: string } | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  updatedAt: string;
}

/**
 * Product list (PROJECT_PLAN.md §11.5).
 *
 * Server-side paginated and filtered — the client will end up with thousands
 * of rows, and a client-side filter over that is a slow page and a large
 * payload on a free-tier API.
 */
export function ProductsPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);

  const { data: categories } = useAsyncData<CategoryNode[]>('/admin/categories');
  const { data: brands } = useAsyncData<Brand[]>('/admin/brands');

  const { data, isLoading, error, refetch } = useAsyncData<AdminProductRow[]>('/admin/products', {
    params: {
      q: debouncedSearch || undefined,
      category: category || undefined,
      brand: brand || undefined,
      status: status === 'all' ? undefined : status,
      page,
      limit: 25,
    },
  });

  const [pendingDelete, setPendingDelete] = useState<AdminProductRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const onDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await del(`/admin/products/${pendingDelete._id}`);
      toast.success(`Deleted '${pendingDelete.name}'.`);
      setPendingDelete(null);
      await refetch();
    } catch (caught) {
      toast.error(normaliseError(caught).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<AdminProductRow>[] = [
    {
      key: 'image',
      header: '',
      hideOnMobile: true,
      cell: (row) =>
        row.images?.[0] ? (
          <img
            src={row.images[0].url}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded border border-border-subtle bg-white object-contain"
          />
        ) : (
          <span className="block size-10 rounded border border-dashed border-border-subtle" />
        ),
    },
    {
      key: 'name',
      header: 'Product',
      cell: (row) => (
        <Link
          to={`/products/${row._id}`}
          className="font-medium text-text-primary hover:text-action-secondary"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'sku',
      header: 'Part number',
      cell: (row) => <span data-tabular>{row.sku}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      hideOnMobile: true,
      cell: (row) => row.category?.name ?? '—',
    },
    {
      key: 'brand',
      header: 'Brand',
      hideOnMobile: true,
      cell: (row) => row.brand?.name ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={row.isActive ? 'text-status-won' : 'text-text-muted'}>
          {row.isActive ? 'Active' : 'Hidden'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      cell: (row) =>
        new Date(row.updatedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'end',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate(`/products/${row._id}`)}
            aria-label={`Edit ${row.name}`}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(row)}
            aria-label={`Delete ${row.name}`}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-raised hover:text-status-lost"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  const leafCategories = flattenCategories(categories ?? []);

  return (
    <>
      <PageHeader
        title="Products"
        description="The whole catalogue. Filter by category, brand or status, or search by name and part number."
        actions={
          <Link to="/products/new" className="btn btn-accent">
            <Plus aria-hidden className="size-4" />
            New product
          </Link>
        }
      />

      <div className="panel mb-3 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-48 flex-1">
          <label className="field-label" htmlFor="product-search">
            Search
          </label>
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Name or part number"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="product-category">
            Category
          </label>
          <select
            id="product-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            className="field-input"
          >
            <option value="">All categories</option>
            {leafCategories.map((option) => (
              <option key={option._id} value={option.slug}>
                {option.path}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="product-brand">
            Brand
          </label>
          <select
            id="product-brand"
            value={brand}
            onChange={(event) => {
              setBrand(event.target.value);
              setPage(1);
            }}
            className="field-input"
          >
            <option value="">All brands</option>
            {(brands ?? []).map((option) => (
              <option key={option._id} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="product-status">
            Status
          </label>
          <select
            id="product-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            className="field-input"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Hidden</option>
          </select>
        </div>
      </div>

      <DataTable
        caption="Products"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No products match these filters."
      />

      <Pagination page={page} onChange={setPage} hasMore={(data?.length ?? 0) === 25} />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete product"
        message={
          pendingDelete
            ? `Delete '${pendingDelete.name}'? It is removed from the storefront but kept in the database, so it can be restored.`
            : ''
        }
        confirmLabel="Delete"
        isDestructive
        isBusy={isDeleting}
        onConfirm={onDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/**
 * Simple prev/next paging.
 *
 * `hasMore` is inferred from a full page of results rather than read from the
 * response meta, so the control still behaves when the total is expensive to
 * compute at catalogue scale.
 */
function Pagination({
  page,
  onChange,
  hasMore,
}: {
  page: number;
  onChange: (page: number) => void;
  hasMore: boolean;
}) {
  if (page === 1 && !hasMore) return null;

  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
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
        onClick={() => onChange(page + 1)}
        disabled={!hasMore}
        className="btn btn-ghost"
      >
        Next
      </button>
    </nav>
  );
}

export type { AdminProductRow, PaginationMeta };

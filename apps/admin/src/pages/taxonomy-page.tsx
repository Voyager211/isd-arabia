import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Brand, Industry } from '@isd/shared-types';

import { del, normaliseError } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TaxonomySlideOver, type TaxonomyKind } from '@/components/categories/taxonomy-slide-over';

/**
 * Brands and industries (PROJECT_PLAN.md §11).
 *
 * One screen serving both. The two entities differ only in whether they carry
 * a logo or an icon and long-form content, and maintaining two near-identical
 * CRUD screens is how they quietly drift apart in behaviour — the delete
 * confirmation on one gets fixed and the other does not.
 *
 * Categories are deliberately NOT folded in here: their tree rules are
 * genuinely different, and flattening that into a shared component would hide
 * the part most likely to hold a bug.
 */

type TaxonomyRecord = Brand | Industry;

const CONFIG: Record<
  TaxonomyKind,
  { title: string; description: string; endpoint: string; singular: string }
> = {
  brand: {
    title: 'Brands',
    description: 'The manufacturers you supply. Each one gets its own storefront page.',
    endpoint: '/admin/brands',
    singular: 'brand',
  },
  industry: {
    title: 'Industries',
    description:
      'The sectors you sell into. Each one gets a landing page with long-form copy and a filtered product grid.',
    endpoint: '/admin/industries',
    singular: 'industry',
  },
};

export function TaxonomyPage({ kind }: { kind: TaxonomyKind }) {
  const config = CONFIG[kind];
  const { data, isLoading, error, refetch } = useAsyncData<TaxonomyRecord[]>(config.endpoint);

  const [editing, setEditing] = useState<TaxonomyRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TaxonomyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const onDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await del(`${config.endpoint}/${pendingDelete._id}`);
      toast.success(`Deleted '${pendingDelete.name}'.`);
      setPendingDelete(null);
      await refetch();
    } catch (caught) {
      // A 409 names how many products still reference the record.
      toast.error(normaliseError(caught).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<TaxonomyRecord>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      key: 'slug',
      header: 'URL',
      hideOnMobile: true,
      cell: (row) => <span className="text-text-secondary">/{row.slug}</span>,
    },
    {
      key: 'order',
      header: 'Order',
      align: 'end',
      cell: (row) => <span data-tabular>{row.displayOrder}</span>,
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
      key: 'actions',
      header: 'Actions',
      align: 'end',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(row)}
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

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <button type="button" onClick={() => setIsCreating(true)} className="btn btn-accent">
            <Plus aria-hidden className="size-4" />
            New {config.singular}
          </button>
        }
      />

      <DataTable
        caption={config.title}
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        error={error}
        emptyMessage={`No ${config.title.toLowerCase()} yet.`}
      />

      {(isCreating || editing) && (
        <TaxonomySlideOver
          kind={kind}
          record={editing}
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setIsCreating(false);
            setEditing(null);
            await refetch();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title={`Delete ${config.singular}`}
        message={
          pendingDelete
            ? `Delete '${pendingDelete.name}'? This is blocked while products still reference it.`
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

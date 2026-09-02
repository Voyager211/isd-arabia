import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Category, CategoryNode } from '@isd/shared-types';

import { del, normaliseError } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CategorySlideOver } from '@/components/categories/category-slide-over';

/**
 * Categories (PROJECT_PLAN.md §11.4).
 *
 * The table is a flattened tree with the name indented by level, rather than
 * an expand/collapse widget. With three levels and a couple of hundred nodes,
 * seeing the whole structure at once is what the client actually needs when
 * deciding where a new product line belongs.
 */

/** A tree node flattened for the table, carrying its depth for indentation. */
interface FlatRow extends Category {
  depth: number;
  childCount: number;
}

function flatten(nodes: CategoryNode[], depth = 0): FlatRow[] {
  return nodes.flatMap((node) => [
    { ...node, depth, childCount: node.children.length },
    ...flatten(node.children, depth + 1),
  ]);
}

export function CategoriesPage() {
  const { data, isLoading, error, refetch } = useAsyncData<CategoryNode[]>('/admin/categories');

  const [editing, setEditing] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FlatRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const rows = useMemo(() => flatten(data ?? []), [data]);

  const onDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await del(`/admin/categories/${pendingDelete._id}`);
      toast.success(`Deleted '${pendingDelete.name}'.`);
      setPendingDelete(null);
      await refetch();
    } catch (caught) {
      // A 409 here is expected and useful — it names the children or products
      // still filed under the category (acceptance criterion #19).
      toast.error(normaliseError(caught).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<FlatRow>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <span
          className="font-medium text-text-primary"
          style={{ paddingInlineStart: `${row.depth * 20}px` }}
        >
          {row.depth > 0 ? (
            <span className="me-1 text-text-muted" aria-hidden>
              └
            </span>
          ) : null}
          {row.name}
        </span>
      ),
    },
    {
      key: 'slug',
      header: 'URL',
      hideOnMobile: true,
      cell: (row) => <span className="text-text-secondary">/{row.slug}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      align: 'end',
      cell: (row) => <span data-tabular>{row.level}</span>,
    },
    {
      key: 'children',
      header: 'Subcategories',
      align: 'end',
      cell: (row) => <span data-tabular>{row.childCount}</span>,
    },
    {
      key: 'menu',
      header: 'In menu',
      cell: (row) => (
        <span className={row.showInMenu ? 'text-status-won' : 'text-text-muted'}>
          {row.showInMenu ? 'Yes' : 'No'}
        </span>
      ),
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
        title="Categories"
        description="Three levels at most. Products are filed against the deepest level only."
        actions={
          <button type="button" onClick={() => setIsCreating(true)} className="btn btn-accent">
            <Plus aria-hidden className="size-4" />
            New category
          </button>
        }
      />

      <DataTable
        caption="All categories, nested by level"
        columns={columns}
        rows={rows}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No categories yet. Run the taxonomy seed or add the first one."
      />

      {(isCreating || editing) && (
        <CategorySlideOver
          category={editing}
          allCategories={rows}
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
        title="Delete category"
        message={
          pendingDelete
            ? `Delete '${pendingDelete.name}'? This is blocked while it still has subcategories or products.`
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

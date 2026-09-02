'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

import type { CategoryNode, ProductFacets } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';

/**
 * Faceted filter sidebar (PROJECT_PLAN.md §9.3).
 *
 * Filter state lives entirely in the query string, never in component state.
 * That is what makes a filtered view shareable, restorable on refresh, and
 * correct after a back-navigation — acceptance criterion #3. Mirroring it into
 * local state would immediately create two sources of truth that disagree the
 * first time someone uses the back button.
 *
 * Below `lg` the whole thing becomes a bottom sheet (§5.3).
 */
export function FilterSidebar({
  facets,
  categoryTree,
  /** Locks the dimension a page is already scoped to — no brand filter on a brand page. */
  lockedDimension,
}: {
  facets: ProductFacets;
  categoryTree?: CategoryNode[];
  lockedDimension?: 'brand' | 'industry' | 'category';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const selected = useCallback(
    (key: string) => new Set(searchParams.getAll(key).flatMap((value) => value.split(','))),
    [searchParams],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = new Set(params.getAll(key).flatMap((entry) => entry.split(',')));

      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }

      params.delete(key);
      for (const entry of current) params.append(key, entry);

      // Any filter change resets paging: staying on page 7 of a result set
      // that now has two pages shows an empty grid.
      params.delete('page');

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams();
    // The search term is the page's subject, not a filter — clearing filters
    // on /search must not throw away what the visitor searched for.
    const query = searchParams.get('q');
    if (query) params.set('q', query);

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const activeCount = ['brand', 'industry', 'category'].reduce(
    (total, key) => total + selected(key).size,
    0,
  );

  const panel = (
    <div className="space-y-6">
      {activeCount > 0 ? (
        <button type="button" onClick={clearAll} className="btn-secondary w-full">
          {t.listing.clearFilters} ({activeCount})
        </button>
      ) : null}

      {categoryTree?.length ? (
        <FilterGroup title="Categories">
          <ul className="space-y-1">
            {categoryTree.map((node) => (
              <li key={node._id}>
                <Link
                  href={`/category/${node.slug}`}
                  className="block py-1 text-body-sm text-text-secondary hover:text-action-secondary"
                >
                  {node.name}
                </Link>
                {node.children.length ? (
                  <ul className="ps-3">
                    {node.children.map((child) => (
                      <li key={child._id}>
                        <Link
                          href={`/category/${child.slug}`}
                          className="block py-0.5 text-caption text-text-secondary hover:text-action-secondary"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </FilterGroup>
      ) : null}

      {lockedDimension !== 'category' && facets.categories.length ? (
        <FilterGroup title="Category">
          <CheckboxList
            name="category"
            buckets={facets.categories}
            selected={selected('category')}
            onToggle={toggle}
          />
        </FilterGroup>
      ) : null}

      {lockedDimension !== 'brand' && facets.brands.length ? (
        <FilterGroup title="Brand">
          <CheckboxList
            name="brand"
            buckets={facets.brands}
            selected={selected('brand')}
            onToggle={toggle}
          />
        </FilterGroup>
      ) : null}

      {lockedDimension !== 'industry' && facets.industries.length ? (
        <FilterGroup title="Industry">
          <CheckboxList
            name="industry"
            buckets={facets.industries}
            selected={selected('industry')}
            onToggle={toggle}
          />
        </FilterGroup>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Sidebar at lg and above. */}
      <aside className="hidden lg:block" aria-label={t.listing.filters}>
        {panel}
      </aside>

      {/* Bottom sheet below lg. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className="btn-secondary w-full"
          aria-expanded={isSheetOpen}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {t.listing.filters}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </button>

        {isSheetOpen ? (
          <div className="fixed inset-0 z-60">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsSheetOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t.listing.filters}
              className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[var(--radius-card)] bg-surface-page p-4 shadow-overlay"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-h3 font-semibold text-surface-inverse">
                  {t.listing.filters}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  aria-label={t.common.close}
                  className="p-2"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              {panel}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-display text-h3 font-semibold text-surface-inverse">{title}</h3>
      {children}
    </div>
  );
}

function CheckboxList({
  name,
  buckets,
  selected,
  onToggle,
}: {
  name: string;
  buckets: { slug: string; name: string; count: number }[];
  selected: Set<string>;
  onToggle: (key: string, value: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {buckets.map((bucket) => (
        <li key={bucket.slug}>
          <label className="flex cursor-pointer items-center gap-2 py-0.5 text-body-sm text-text-secondary hover:text-text-primary">
            <input
              type="checkbox"
              checked={selected.has(bucket.slug)}
              onChange={() => onToggle(name, bucket.slug)}
              className="size-4 shrink-0 accent-[var(--action-secondary)]"
            />
            <span className="flex-1 truncate">{bucket.name}</span>
            <span className="text-caption text-text-muted" data-tabular>
              {bucket.count}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

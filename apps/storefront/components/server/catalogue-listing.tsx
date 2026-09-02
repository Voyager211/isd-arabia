import type {
  CategoryNode,
  ProductCard as ProductCardData,
  ProductFacets,
} from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { ProductGrid } from './product-grid';
import { FilterSidebar } from '@/components/client/filter-sidebar';
import { SortSelect } from '@/components/client/sort-select';
import { LoadMore } from '@/components/client/load-more';

/**
 * The two-column listing layout shared by /products, /category/[slug],
 * /brands/[slug], /industries/[slug] and /search (PROJECT_PLAN.md §9.3).
 *
 * A server component: the grid, the counts and the heading all render in the
 * initial HTML. Only the three controls that write to the query string —
 * filters, sort and load-more — are client leaves.
 *
 * Building this once rather than per route is what keeps the five listing
 * pages from drifting apart in layout, empty states and pagination behaviour.
 */
export function CatalogueListing({
  title,
  description,
  products,
  facets,
  categoryTree,
  page,
  total,
  totalPages,
  limit,
  lockedDimension,
  hasSearch = false,
  header,
}: {
  title: string;
  description?: string;
  products: ProductCardData[];
  facets: ProductFacets;
  categoryTree?: CategoryNode[];
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  lockedDimension?: 'brand' | 'industry' | 'category';
  hasSearch?: boolean;
  /** Banner or intro block rendered above the two-column area. */
  header?: React.ReactNode;
}) {
  const shown = Math.min(page * limit, total);

  return (
    <>
      {header}

      <div className="container-page pb-16">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="lg:pt-2">
            <FilterSidebar
              facets={facets}
              categoryTree={categoryTree}
              lockedDimension={lockedDimension}
            />
          </div>

          <div className="min-w-0">
            <div className="mb-6">
              <h1 className="font-display text-h1 font-bold text-surface-inverse">{title}</h1>
              {description ? (
                <p className="prose-measure mt-2 text-body-sm text-text-secondary">{description}</p>
              ) : null}
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <p className="text-body-sm text-text-secondary" data-tabular>
                {total > 0 ? t.listing.showing(shown, total) : ''}
              </p>
              <SortSelect hasSearch={hasSearch} />
            </div>

            <ProductGrid products={products} />

            <LoadMore page={page} totalPages={totalPages} />
          </div>
        </div>
      </div>
    </>
  );
}

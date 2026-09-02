import Link from 'next/link';
import type { Metadata } from 'next';

import { t } from '@/lib/i18n/en';
import { getProducts } from '@/lib/api/products';
import { getMenu } from '@/lib/api/catalogue';
import { parseListingParams, type RawSearchParams } from '@/lib/listing-params';
import { CatalogueListing } from '@/components/server/catalogue-listing';

/**
 * Search results (PROJECT_PLAN.md §4.1, §9.6).
 *
 * `force-dynamic` and noindex: results depend entirely on the query string, so
 * there is nothing worth caching, and indexing them would generate unbounded
 * near-duplicate URLs competing with the catalogue's own pages.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const query = parseListingParams(params);
  const term = query.q?.trim() ?? '';

  // An empty search is a dead end, so it offers the level-1 categories rather
  // than a bare "no results" (§9.6).
  if (!term) {
    const menu = await getMenu().catch(() => []);
    const categories = menu.flatMap((group) => group.children);

    return (
      <div className="container-page py-16">
        <h1 className="font-display text-h1 font-bold text-surface-inverse">{t.search.label}</h1>
        <p className="mt-2 text-body text-text-secondary">{t.search.noResultsHint}</p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category._id}>
              <Link
                href={`/category/${category.slug}`}
                className="block rounded-[var(--radius-card)] border border-border-subtle p-4 text-body-sm font-medium text-text-primary transition-colors hover:border-action-secondary"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { products, meta } = await getProducts(query);

  return (
    <CatalogueListing
      title={t.search.resultsFor(term)}
      products={products}
      facets={meta.facets}
      page={meta.page}
      total={meta.total}
      totalPages={meta.totalPages}
      limit={meta.limit}
      hasSearch
    />
  );
}

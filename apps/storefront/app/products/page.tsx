import type { Metadata } from 'next';

import { t } from '@/lib/i18n/en';
import { buildMetadata } from '@/lib/seo';
import { getProducts } from '@/lib/api/products';
import { getCategoryTree } from '@/lib/api/catalogue';
import { parseListingParams, type RawSearchParams } from '@/lib/listing-params';
import { CatalogueListing } from '@/components/server/catalogue-listing';

/**
 * The full catalogue (PROJECT_PLAN.md §4.1).
 *
 * ISR at one hour plus on-demand purge on the `products:list` tag. Filtered
 * variants render dynamically because `searchParams` is read — Next.js opts
 * the request out of the static cache automatically, which is the behaviour
 * the plan describes.
 */
export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  fallbackTitle: 'All products',
  fallbackDescription:
    'Browse the full range of welding consumables, safety equipment, scaffolding tools and MRO supplies. Request a quotation on any item.',
  path: '/products',
});

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const query = parseListingParams(params);

  const [{ products, meta }, categoryTree] = await Promise.all([
    getProducts(query),
    getCategoryTree().catch(() => []),
  ]);

  return (
    <CatalogueListing
      title={t.nav.allProducts}
      description="Every product in the catalogue. Filter by category, brand or industry, then build a quotation request."
      products={products}
      facets={meta.facets}
      categoryTree={categoryTree}
      page={meta.page}
      total={meta.total}
      totalPages={meta.totalPages}
      limit={meta.limit}
      hasSearch={Boolean(query.q)}
    />
  );
}

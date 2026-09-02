import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from '@/lib/seo';
import { getCategory, getProducts } from '@/lib/api/products';
import { getMenu } from '@/lib/api/catalogue';
import { parseListingParams, isFilteredView, type RawSearchParams } from '@/lib/listing-params';
import { tags } from '@/lib/api/tags';
import { siteUrl } from '@/lib/site-config';
import { CatalogueListing } from '@/components/server/catalogue-listing';
import { Breadcrumbs } from '@/components/server/breadcrumbs';

export const revalidate = 3600;

/**
 * Pre-renders levels 0 and 1 at build time (PROJECT_PLAN.md §4.1).
 *
 * Not level 2: there are well over a hundred leaves, and pre-rendering all of
 * them lengthens every build for pages that ISR will generate on first request
 * anyway. The top two levels are the ones with real crawl and traffic volume.
 */
export async function generateStaticParams() {
  const menu = await getMenu().catch(() => []);

  return menu.flatMap((group) => [
    { slug: group.slug },
    ...group.children.map((child) => ({ slug: child.slug })),
  ]);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const detail = await getCategory(slug);

  if (!detail) return { title: 'Category not found' };

  const meta = buildMetadata({
    seo: detail.category.seo,
    fallbackTitle: detail.category.name,
    fallbackDescription: detail.category.description,
    path: `/category/${slug}`,
    imageUrl: detail.category.banner?.url ?? detail.category.image?.url,
  });

  // A filtered or paged view keeps the clean category URL as its canonical, so
  // the hundreds of possible combinations do not compete with it in the index.
  if (isFilteredView(search)) {
    meta.alternates = { canonical: siteUrl(`/category/${slug}`) };
  }

  return meta;
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const detail = await getCategory(slug);

  if (!detail) notFound();

  // The page's own category always applies, whatever else the visitor ticks.
  const query = parseListingParams(search, { category: slug });
  const { products, meta } = await getProducts(query, [tags.category(slug)]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd(
              [...detail.breadcrumbs, { name: detail.category.name, slug }],
              '/category',
            ),
          ),
        }}
      />

      <CatalogueListing
        title={detail.category.name}
        description={detail.category.description}
        products={products}
        facets={meta.facets}
        page={meta.page}
        total={meta.total}
        totalPages={meta.totalPages}
        limit={meta.limit}
        lockedDimension="category"
        header={
          <div className="container-page">
            <Breadcrumbs crumbs={detail.breadcrumbs} current={detail.category.name} />
          </div>
        }
      />
    </>
  );
}

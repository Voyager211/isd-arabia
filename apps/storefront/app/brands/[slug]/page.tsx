import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { getBrand, getProducts } from '@/lib/api/products';
import { getBrands } from '@/lib/api/catalogue';
import { cloudinaryUrl } from '@/lib/cloudinary';
import { tags } from '@/lib/api/tags';
import { siteUrl } from '@/lib/site-config';
import { parseListingParams, isFilteredView, type RawSearchParams } from '@/lib/listing-params';
import { CatalogueListing } from '@/components/server/catalogue-listing';

export const revalidate = 3600;

/** Every brand is pre-rendered — there are ten of them (PROJECT_PLAN.md §6.2). */
export async function generateStaticParams() {
  const brands = await getBrands().catch(() => []);
  return brands.map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);

  if (!brand) return { title: 'Brand not found' };

  const meta = buildMetadata({
    seo: brand.seo,
    fallbackTitle: `${brand.name} products`,
    fallbackDescription: brand.description,
    path: `/brands/${slug}`,
    imageUrl: brand.banner?.url ?? brand.logo?.url,
  });

  if (isFilteredView(search)) {
    meta.alternates = { canonical: siteUrl(`/brands/${slug}`) };
  }

  return meta;
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);

  if (!brand) notFound();

  const query = parseListingParams(search, { brand: slug });
  const { products, meta } = await getProducts(query, [tags.brand(slug)]);

  return (
    <CatalogueListing
      title={brand.name}
      description={brand.description}
      products={products}
      facets={meta.facets}
      page={meta.page}
      total={meta.total}
      totalPages={meta.totalPages}
      limit={meta.limit}
      lockedDimension="brand"
      header={
        brand.banner || brand.logo ? (
          <div className="container-page pt-8">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border-subtle">
              {brand.banner ? (
                <Image
                  src={cloudinaryUrl(brand.banner.url, 'banner')}
                  alt={brand.banner.alt || brand.name}
                  width={1600}
                  height={400}
                  priority
                  sizes="(min-width: 1320px) 1320px, 100vw"
                  className="h-40 w-full object-cover md:h-56"
                />
              ) : null}

              {brand.logo ? (
                <div className="flex items-center gap-4 bg-surface-page p-5">
                  <Image
                    src={cloudinaryUrl(brand.logo.url, 'brandLogo')}
                    alt={brand.logo.alt || brand.name}
                    width={160}
                    height={80}
                    className="h-12 w-auto object-contain"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null
      }
    />
  );
}

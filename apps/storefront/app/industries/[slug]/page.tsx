import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { getIndustry, getProducts } from '@/lib/api/products';
import { getIndustries } from '@/lib/api/catalogue';
import { cloudinaryUrl } from '@/lib/cloudinary';
import { tags } from '@/lib/api/tags';
import { siteUrl } from '@/lib/site-config';
import { parseListingParams, isFilteredView, type RawSearchParams } from '@/lib/listing-params';
import { CatalogueListing } from '@/components/server/catalogue-listing';

/** 24-hour ISR: industry copy is long-form and changes rarely (§4.1). */
export const revalidate = 86400;

export async function generateStaticParams() {
  const industries = await getIndustries().catch(() => []);
  return industries.map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const industry = await getIndustry(slug);

  if (!industry) return { title: 'Industry not found' };

  const meta = buildMetadata({
    seo: industry.seo,
    fallbackTitle: `${industry.name} supply`,
    fallbackDescription: industry.description,
    path: `/industries/${slug}`,
    imageUrl: industry.banner?.url,
  });

  if (isFilteredView(search)) {
    meta.alternates = { canonical: siteUrl(`/industries/${slug}`) };
  }

  return meta;
}

export default async function IndustryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const industry = await getIndustry(slug);

  if (!industry) notFound();

  const query = parseListingParams(search, { industry: slug });
  const { products, meta } = await getProducts(query, [tags.industry(slug)]);

  return (
    <CatalogueListing
      title={industry.name}
      products={products}
      facets={meta.facets}
      page={meta.page}
      total={meta.total}
      totalPages={meta.totalPages}
      limit={meta.limit}
      lockedDimension="industry"
      header={
        <div className="container-page pt-8">
          {industry.banner ? (
            <Image
              src={cloudinaryUrl(industry.banner.url, 'banner')}
              alt={industry.banner.alt || industry.name}
              width={1600}
              height={400}
              priority
              sizes="(min-width: 1320px) 1320px, 100vw"
              className="h-40 w-full rounded-[var(--radius-card)] object-cover md:h-56"
            />
          ) : null}

          {industry.content ? (
            /*
              Safe: sanitised server-side before it was persisted, so the stored
              markup is already an allowlisted subset of tags.
            */
            <div
              className="prose-measure mt-6 space-y-3 text-body text-text-secondary [&_a]:text-action-secondary [&_a]:underline [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: industry.content }}
            />
          ) : industry.description ? (
            <p className="prose-measure mt-6 text-body text-text-secondary">
              {industry.description}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { buildMetadata, breadcrumbJsonLd, jsonLdScript, productJsonLd } from '@/lib/seo';
import { getProduct, getProductSlugs, getRelatedProducts } from '@/lib/api/products';
import { cloudinaryUrl } from '@/lib/cloudinary';
import { Breadcrumbs } from '@/components/server/breadcrumbs';
import { ProductGrid } from '@/components/server/product-grid';
import { ProductGallery } from '@/components/client/product-gallery';
import { AddToQuotePanel } from '@/components/client/add-to-quote-panel';

/**
 * Product detail (PROJECT_PLAN.md §9.4).
 *
 * 24-hour ISR plus on-demand purge on the `product:<slug>` tag, so an admin
 * edit is live in seconds rather than a day.
 *
 * A server component throughout except the gallery and the quantity/add
 * panel — the description, spec table and related grid are all in the initial
 * HTML, which is what the crawler and the LCP both need.
 */
export const revalidate = 86400;

/**
 * Pre-renders known products and generates the rest on first request.
 *
 * `dynamicParams` stays at its default of true: a product added by the admin
 * after the last build must still resolve, not 404 until the next deploy.
 */
export async function generateStaticParams() {
  const slugs = await getProductSlugs().catch(() => []);
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: 'Product not found' };

  return buildMetadata({
    seo: product.seo,
    // The part number in the title is deliberate: buyers search for it, and it
    // is what distinguishes near-identical product names in a results list.
    fallbackTitle: `${product.name} — ${product.sku}`,
    fallbackDescription: product.shortDescription,
    path: `/products/${slug}`,
    imageUrl: product.images?.[0] ? cloudinaryUrl(product.images[0].url, 'productMain') : null,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const related = await getRelatedProducts(slug).catch(() => []);
  const availabilityLabel = t.product.availabilityLabels[product.availability];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(product)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd(product.categoryTrail ?? [], '/category')),
        }}
      />

      <div className="container-page">
        <Breadcrumbs crumbs={product.categoryTrail ?? []} current={product.name} />
      </div>

      <div className="container-page grid gap-8 pb-12 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images ?? []} productName={product.name} />

        <div>
          {product.brand ? (
            <Link
              href={`/brands/${product.brand.slug}`}
              className="text-body-sm font-semibold text-action-secondary hover:underline"
            >
              {product.brand.name}
            </Link>
          ) : null}

          <h1 className="mt-1 font-display text-h1 font-bold text-surface-inverse">
            {product.name}
          </h1>

          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-body-sm">
            <div className="flex gap-1.5">
              <dt className="text-text-secondary">{t.product.sku}:</dt>
              <dd className="font-medium text-text-primary" data-tabular>
                {product.sku}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-text-secondary">{t.product.availability}:</dt>
              <dd className="font-medium text-text-primary">{availabilityLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-text-secondary">{t.product.unit}:</dt>
              <dd className="font-medium text-text-primary">{product.unit}</dd>
            </div>
          </dl>

          {product.shortDescription ? (
            <p className="prose-measure mt-4 text-body text-text-secondary">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-6">
            <AddToQuotePanel
              product={{
                productId: product._id,
                name: product.name,
                slug: product.slug,
                sku: product.sku,
                imageUrl: product.images?.[0]?.url ?? '',
                unit: product.unit,
                quantity: product.minOrderQuantity || 1,
              }}
              minOrderQuantity={product.minOrderQuantity || 1}
            />
          </div>

          {product.industries?.length ? (
            <div className="mt-6 border-t border-border-subtle pt-4">
              <h2 className="text-caption font-semibold text-text-secondary">{t.nav.industries}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {product.industries.map((industry) => (
                  <li key={industry._id}>
                    <Link
                      href={`/industries/${industry.slug}`}
                      className="inline-block rounded-[var(--radius-control)] border border-border-subtle px-2.5 py-1 text-caption text-text-secondary hover:border-action-secondary hover:text-action-secondary"
                    >
                      {industry.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="container-page space-y-10 pb-16">
        {product.description ? (
          <section>
            <h2 className="mb-3 font-display text-h2 font-semibold text-surface-inverse">
              {t.product.description}
            </h2>
            {/*
              Safe: this HTML is sanitised on the server before it is persisted
              (apps/api sanitize.util.ts), so the database only ever holds an
              allowlisted subset of tags.
            */}
            <div
              className="prose-measure space-y-3 text-body text-text-secondary [&_a]:text-action-secondary [&_a]:underline [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </section>
        ) : null}

        {product.keyFeatures?.length ? (
          <section>
            <h2 className="mb-3 font-display text-h2 font-semibold text-surface-inverse">
              {t.product.keyFeatures}
            </h2>
            <ul className="prose-measure list-disc space-y-1.5 ps-5 text-body text-text-secondary">
              {product.keyFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {product.specifications?.length ? (
          <section>
            <h2 className="mb-3 font-display text-h2 font-semibold text-surface-inverse">
              {t.product.specifications}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full max-w-2xl border-collapse text-body-sm">
                <tbody>
                  {product.specifications.map((spec) => (
                    <tr key={spec.label} className="border-b border-border-subtle">
                      <th
                        scope="row"
                        className="w-1/3 py-2.5 pe-4 text-start font-medium text-text-secondary"
                      >
                        {spec.label}
                      </th>
                      <td className="py-2.5 text-text-primary">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {product.documents?.length ? (
          <section>
            <h2 className="mb-3 font-display text-h2 font-semibold text-surface-inverse">
              {t.product.downloads}
            </h2>
            <ul className="space-y-2">
              {product.documents.map((document) => (
                <li key={document.publicId}>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-body-sm text-action-secondary hover:underline"
                  >
                    <FileText aria-hidden className="size-4" />
                    {document.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length ? (
          <section>
            <h2 className="mb-4 font-display text-h2 font-semibold text-surface-inverse">
              {t.product.related}
            </h2>
            <ProductGrid products={related} />
          </section>
        ) : null}
      </div>
    </>
  );
}

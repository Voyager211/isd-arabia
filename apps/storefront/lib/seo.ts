import type { Metadata } from 'next';

import type { BreadcrumbCrumb, ProductPopulated, SeoMeta } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { siteUrl } from '@/lib/site-config';
import { cloudinaryUrl } from '@/lib/cloudinary';

/**
 * SEO helpers (PROJECT_PLAN.md §9.10).
 *
 * Every route builds its metadata here so the fallback chain is applied
 * consistently: the entity's own `seo` sub-document first, then sensible
 * derivations from its name and description. A page with no admin-authored SEO
 * still gets a unique, useful title — acceptance criterion #12 requires all of
 * it present in the server-rendered HTML with JavaScript disabled.
 */

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 160;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export interface MetadataInput {
  seo?: SeoMeta;
  fallbackTitle: string;
  fallbackDescription?: string;
  path: string;
  imageUrl?: string | null;
  /** Cart, request and search pages must not be indexed. */
  noindex?: boolean;
  /**
   * Bypasses the root layout's `%s | ISD Arabia` title template.
   *
   * Only the home page wants this — its title already carries the brand name,
   * and the template would render it twice.
   */
  absoluteTitle?: boolean;
}

export function buildMetadata({
  seo,
  fallbackTitle,
  fallbackDescription,
  path,
  imageUrl,
  noindex = false,
  absoluteTitle = false,
}: MetadataInput): Metadata {
  const title = truncate(seo?.metaTitle || fallbackTitle, MAX_TITLE);
  const description = truncate(
    seo?.metaDescription || fallbackDescription || t.brand.tagline,
    MAX_DESCRIPTION,
  );
  const canonical = siteUrl(path);
  const image = seo?.ogImage || imageUrl || undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords: seo?.metaKeywords?.length ? seo.metaKeywords : undefined,
    // A canonical on every page is what stops the filtered variants of a
    // listing competing with the clean category URL — and, on the home page,
    // what stops every ?utm_source= and ?fbclid= link becoming its own
    // indexable duplicate.
    alternates: { canonical },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: t.brand.name,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

// ── JSON-LD ───────────────────────────────────────────────────────────────

/**
 * Structured data is emitted as a plain `<script type="application/ld+json">`
 * from a server component, so it is in the initial HTML.
 *
 * `JSON.stringify` output is escaped before it reaches `dangerouslySetInnerHTML`
 * — a product name containing `</script>` would otherwise close the tag early
 * and inject markup into the page.
 */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: t.brand.name,
    url: siteUrl(),
    description: t.brand.tagline,
    areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
  };
}

export function breadcrumbJsonLd(
  crumbs: BreadcrumbCrumb[],
  basePath: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.nav.home, item: siteUrl('/') },
      ...crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: crumb.name,
        item: siteUrl(`${basePath}/${crumb.slug}`),
      })),
    ],
  };
}

/**
 * Product structured data.
 *
 * `offers.availability` is present but there is deliberately NO price. Schema
 * allows an offer without one, and this is exactly the situation it is for:
 * the product is available, the price comes from a quotation.
 */
export function productJsonLd(product: ProductPopulated): Record<string, unknown> {
  const image = product.images?.[0];

  const availability =
    product.availability === 'in_stock'
      ? 'https://schema.org/InStock'
      : product.availability === 'made_to_order'
        ? 'https://schema.org/PreOrder'
        : 'https://schema.org/LimitedAvailability';

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    description: product.shortDescription || undefined,
    image: image ? cloudinaryUrl(image.url, 'productMain') : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.category?.name,
    url: siteUrl(`/products/${product.slug}`),
    offers: {
      '@type': 'Offer',
      availability,
      url: siteUrl(`/products/${product.slug}`),
      seller: { '@type': 'Organization', name: t.brand.name },
    },
  };
}

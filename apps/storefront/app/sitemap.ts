import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site-config';
import { getBrands, getCategoryTree, getIndustries } from '@/lib/api/catalogue';
import { getProductSlugs } from '@/lib/api/products';
import { flattenTree } from '@/lib/tree';

/**
 * Sitemap (PROJECT_PLAN.md §9.10, acceptance criterion #13).
 *
 * Generated at request time with a one-hour cache rather than at build time,
 * so a product the client adds this afternoon is listed within the hour
 * instead of at the next deploy — which matters when the catalogue is being
 * hand-entered over weeks.
 *
 * Deliberately absent: /quote-cart, /quote-request and /search. They are
 * disallowed in robots.ts, and listing a disallowed URL in a sitemap is a
 * contradiction crawlers report as an error.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Each source is caught independently: a single failing endpoint should cost
  // its own section, not the entire sitemap.
  const [categories, brands, industries, products] = await Promise.all([
    getCategoryTree().catch(() => []),
    getBrands().catch(() => []),
    getIndustries().catch(() => []),
    getProductSlugs().catch(() => []),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: siteUrl('/products'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: siteUrl('/brands'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: siteUrl('/industries'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: siteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: siteUrl('/contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  return [
    ...staticRoutes,

    ...flattenTree(categories).map((category) => ({
      url: siteUrl(`/category/${category.slug}`),
      lastModified: new Date(category.updatedAt),
      changeFrequency: 'weekly' as const,
      // Top-level categories are the catalogue's main entry points, so they
      // outrank the leaves.
      priority: category.level === 0 ? 0.8 : 0.7,
    })),

    ...brands.map((brand) => ({
      url: siteUrl(`/brands/${brand.slug}`),
      lastModified: new Date(brand.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),

    ...industries.map((industry) => ({
      url: siteUrl(`/industries/${industry.slug}`),
      lastModified: new Date(industry.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    ...products.map((product) => ({
      url: siteUrl(`/products/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
